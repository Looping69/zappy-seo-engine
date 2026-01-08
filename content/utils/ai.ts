import { callClaudeJSON } from "./claude.js";
import { callGeminiJSON } from "./gemini.js";

// Debug logging helper
function debug(message: string, data?: unknown) {
    console.log(`[SMART-AI] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

interface SmartAIOptions {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Smart AI caller that prioritizes Claude but falls back to Gemini
 * if Claude fails due to credit exhaustion (400) or rate limits (429).
 */
export async function callSmartAIJSON<T>(
    prompt: string,
    options: SmartAIOptions = {}
): Promise<{ data: T; usage: { total_tokens: number }; provider: "claude" | "gemini" }> {
    try {
        debug("Attempting call with Claude...");
        const res = await callClaudeJSON<T>(prompt, options);
        debug("Claude call successful");
        return { ...res, provider: "claude" };
    } catch (error) {
        const errorStr = String(error);
        const isCreditError = errorStr.includes("400") && errorStr.includes("credit balance is too low");
        const isRateLimitError = errorStr.includes("429");

        if (isCreditError || isRateLimitError) {
            debug(`Claude failed (${isCreditError ? "credits" : "rate limit"}). Falling back to Gemini...`, { error: errorStr });
            const res = await callGeminiJSON<T>(prompt, options);
            debug("Gemini fallback successful");
            return { ...res, provider: "gemini" };
        }

        // Rethrow other errors
        debug("Claude failed with non-fallback error", { error: errorStr });
        throw error;
    }
}
