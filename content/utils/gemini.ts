import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Debug logging helper
function debug(message: string, data?: unknown) {
    console.log(`[GEMINI-DEBUG] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

// Lazy initialization for Encore Cloud compatibility
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!_genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        debug(`Initializing Gemini client, API key present: ${!!apiKey}`);
        if (!apiKey) {
            debug("ERROR: GEMINI_API_KEY not set!");
            throw new Error("GEMINI_API_KEY environment variable is not set");
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
        model = "gemini-2.0-flash"
    } = options;

    debug("callGemini called", { promptLength: prompt.length, maxTokens, temperature, model, hasSystemPrompt: !!systemPrompt });

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
    // Handle markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("No JSON found in Gemini response");
    }
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
}

/**
 * JSON-structured generation with Gemini
 */
export async function callGeminiJSON<T>(
    prompt: string,
    options: GeminiOptions = {}
): Promise<{ data: T; usage: { total_tokens: number } }> {
    // Force JSON context in the prompt if not already there
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Output valid JSON only.`;

    const res = await callGemini(jsonPrompt, options);
    return {
        data: parseJSON<T>(res.text),
        usage: res.usage
    };
}
