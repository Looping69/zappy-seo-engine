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
    responseSchema?: any;
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
        jsonMode = false,
        responseSchema
    } = options;

    debug("callGemini called", { promptLength: prompt.length, maxTokens, temperature, model, hasSystemPrompt: !!systemPrompt, jsonMode, hasSchema: !!responseSchema });

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
                ...(jsonMode && {
                    responseMimeType: "application/json",
                    ...(responseSchema && { responseSchema })
                })
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

/**
 * Bulletproof JSON Repair Logic
 * Specially designed to handle unescaped quotes in long markdown bodies
 */
function repairJson(jsonStr: string): string {
    // 1. Basic structural cleanup
    let repaired = jsonStr.trim()
        .replace(/,(\s*[}\]])/g, '$1') // Trailing commas
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ' '); // Control chars

    // 2. Fix unescaped newlines in strings first (essential for the next step)
    repaired = repaired.replace(/"((?:\\.|[^"\\])*)"/g, (match, group) => {
        return '"' + group.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    });

    // 3. Aggressive Quote Repair
    // We look for patterns where a quote is definitely part of the text, not a JSON delimiter.
    // Heuristic: A quote is LIKELY a typo if it's NOT:
    // - Preceded by: { , [ : (with optional whitespace)
    // - Followed by: , } ] : (with optional whitespace)

    // We do this by identifying ALL valid JSON structural delimiters first
    // This is a "best effort" string repair
    try {
        // Try to identify "naked" quotes in large blocks of text
        // Most common issue: "body": "... "quote" ..."
        // We'll escape any quote that is surrounded by alphanumeric characters
        repaired = repaired.replace(/([a-zA-Z0-9])"([a-zA-Z0-9])/g, '$1\\"$2');

        // Escape quotes followed by a space (and not a delimiter)
        repaired = repaired.replace(/"(\s+[^,}\]:\]])/g, '\\"$1');

        // Escape quotes preceded by common text patterns (e.g. He said ")
        repaired = repaired.replace(/([a-z])\s*"(?!\s*[,}\]:\]])/gi, '$1\\\"');
    } catch (e) {
        debug("Aggressive quote repair failed, skipping...", { error: String(e) });
    }

    // 4. Final attempt to fix common escape sequences
    repaired = repaired.replace(/\\(?!(["\\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\');

    return repaired;
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

        const cleanedJson = repairJson(jsonStr);

        try {
            return JSON.parse(cleanedJson);
        } catch (secondError) {
            debug("Second JSON parse attempt failed, trying aggressive balancing...", { error: String(secondError) });

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
                    const balancedJson = repairJson(jsonStr.substring(startIdx, endIdx));
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
3. Do NOT include unescaped double quotes inside of string values. If you need to use a quote, use \\\" instead.
4. Ensure the response is a complete, valid JSON object`;

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

