import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Lazy initialization for Encore Cloud compatibility
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!_genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is not set");
        }
        _genAI = new GoogleGenerativeAI(apiKey);
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

    const geminiModel = getGenAI().getGenerativeModel({
        model,
        systemInstruction: systemPrompt
    });

    const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: temperature,
        },
    });

    const response = await result.response;

    return {
        text: response.text(),
        usage: {
            total_tokens: response.usageMetadata?.totalTokenCount || 0
        }
    };
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
