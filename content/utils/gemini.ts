import { GoogleGenerativeAI } from "@google/generative-ai";
import { secret } from "encore.dev/config";

// Encore secret for Gemini API key
const geminiApiKey = secret("GEMINI_API_KEY");

// Debug logging helper
function debug(message: string, data?: unknown) {
    console.log(`[GEMINI-DEBUG] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

// Lazy initialization for Encore Cloud compatibility
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!_genAI) {
        const apiKey = geminiApiKey();
        debug(`Initializing Gemini client, API key present: ${!!apiKey}`);
        if (!apiKey) {
            debug("ERROR: GEMINI_API_KEY not set!");
            throw new Error("GEMINI_API_KEY secret is not set");
        }
        _genAI = new GoogleGenerativeAI(apiKey);
        debug("Gemini client initialized successfully");
    }
    return _genAI;
}

export interface GeminiOptions {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
    jsonMode?: boolean;
}

export interface GeminiResult {
    text: string;
    usage: {
        total_tokens: number;
    };
}

/**
 * Basic text generation with Gemini
 */
export async function callGemini(
    prompt: string,
    options: GeminiOptions = {}
): Promise<GeminiResult> {
    const {
        systemPrompt,
        maxTokens = 4000,
        temperature = 0.7,
        model = "gemini-2.5-flash",
        jsonMode = false
    } = options;

    debug("callGemini called", { promptLength: prompt.length, maxTokens, temperature, model, hasSystemPrompt: !!systemPrompt, jsonMode });

    try {
        const geminiModel = getGenAI().getGenerativeModel({
            model,
            systemInstruction: systemPrompt
        });

        debug("Making API request to Gemini...");
        const result = await geminiModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: temperature,
                ...(jsonMode && { responseMimeType: "application/json" })
            },
        });

        const response = await result.response;
        const text = response.text();
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        debug("Gemini response received", { responseLength: text.length, tokens });

        return {
            text,
            usage: {
                total_tokens: tokens
            }
        };
    } catch (error) {
        debug("ERROR in callGemini", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
        throw error;
    }
}

export function parseJSON<T>(text: string): T {
    debug("parseJSON called", { textLength: text.length });

    // Extract JSON from markdown code blocks or raw text
    let jsonStr = text.trim();

    // Try to extract from code blocks first
    const codeBlockMatch = text.match(/```(?:json)?[\r\n]+?([\s\S]*?)[\r\n]+?```/);
    if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
        debug("Extracted JSON from code block", { length: jsonStr.length });
    } else {
        // Try to find raw JSON object
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
            debug("Extracted raw JSON object", { length: jsonStr.length });
        }
    }

    if (!jsonStr || jsonStr.length === 0) {
        throw new Error("No JSON found in Gemini response");
    }

    // Try direct parsing first
    try {
        return JSON.parse(jsonStr);
    } catch (firstError) {
        debug("First JSON parse attempt failed, trying to fix common issues...", { error: String(firstError) });

        // Common fixes for LLM JSON output issues
        let cleanedJson = jsonStr
            // Remove trailing commas before ] or }
            .replace(/,(\s*[}\]])/g, '$1')

            // Fix unescaped newlines inside strings
            // This finds content between double quotes and replaces literal newlines with \n
            // The regex "((?:\\.|[^"\\])*)" matches strings correctly even with escaped quotes
            .replace(/"((?:\\.|[^"\\])*)"/g, (match, group) => {
                return '"' + group.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
            })

            // Remove control characters except tab and newline
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ' ')

            // Fix bad escape sequences like \I or \uXXXX that are invalid
            // This replaces \ with \\ if NOT followed by a valid escape character
            .replace(/\\(?!(["\\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\')

            // Fix truncated arrays - close any open arrays
            .replace(/\[[^\]]*$/g, (match) => {
                const lastComma = match.lastIndexOf(',');
                if (lastComma > 0) {
                    return match.substring(0, lastComma) + ']';
                }
                return match + ']';
            });

        try {
            return JSON.parse(cleanedJson);
        } catch (secondError) {
            debug("Second JSON parse attempt failed, trying aggressive cleanup...", { error: String(secondError) });

            // More aggressive: try to find and parse the first complete JSON object
            try {
                // Count braces to find complete object
                let braceCount = 0;
                let startIdx = -1;
                let endIdx = -1;

                for (let i = 0; i < jsonStr.length; i++) {
                    if (jsonStr[i] === '{') {
                        if (startIdx === -1) startIdx = i;
                        braceCount++;
                    } else if (jsonStr[i] === '}') {
                        braceCount--;
                        if (braceCount === 0 && startIdx !== -1) {
                            endIdx = i + 1;
                            break;
                        }
                    }
                }

                if (startIdx !== -1 && endIdx !== -1) {
                    const balancedJson = jsonStr.substring(startIdx, endIdx);
                    return JSON.parse(balancedJson);
                }
            } catch (thirdError) {
                debug("All JSON parse attempts failed", { thirdError: String(thirdError) });
            }

            // If all else fails, throw with context
            throw new Error(`Failed to parse JSON from Gemini response. Original error: ${firstError}. Text preview: ${jsonStr.substring(0, 500)}...`);
        }
    }
}

/**
 * JSON-structured generation with Gemini
 */
export async function callGeminiJSON<T>(
    prompt: string,
    options: GeminiOptions = {}
): Promise<{ data: T; usage: { total_tokens: number } }> {
    // Stronger JSON instructions
    const jsonPrompt = `${prompt}

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON
2. Escape all special characters in strings (especially newlines and backslashes)
3. Ensure the response is a complete, valid JSON object`;

    const res = await callGemini(jsonPrompt, { ...options, jsonMode: true });

    try {
        const data = parseJSON<T>(res.text);
        return { data, usage: res.usage };
    } catch (error) {
        debug("callGeminiJSON failed to parse response", {
            error: String(error),
            responsePreview: res.text.substring(0, 1000)
        });
        throw error;
    }
}

