import { callClaudeJSON, callClaude } from "./claude.js";
import { callGeminiJSON, callGemini } from "./gemini.js";

// Debug logging helper
function debug(message: string, data?: unknown) {
    console.log(`[AI-DEBUG] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

/**
 * Unified AI caller that prioritizes Claude but falls back to Gemini
 * if the Anthropic key is missing or a placeholder.
 */
function isAnthropicMissing(): boolean {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const missing = !anthropicKey || anthropicKey.startsWith("sk-ant-") || anthropicKey.includes("...");
    debug(`Checking Anthropic key: ${missing ? "MISSING/INVALID" : "PRESENT"}`);
    return missing;
}

export interface AIUsage {
    total_tokens: number;
}

export interface AIResult<T = string> {
    data: T;
    usage: AIUsage;
}

export async function callAI(
    prompt: string,
    options: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}
): Promise<AIResult<string>> {
    const useGemini = isAnthropicMissing() && process.env.GEMINI_API_KEY;
    debug(`callAI: Using ${useGemini ? "GEMINI" : "CLAUDE"}`, { promptLength: prompt.length, options });

    try {
        if (useGemini) {
            debug("Calling Gemini...");
            const res = await callGemini(prompt, options);
            debug("Gemini response received", { tokens: res.usage.total_tokens, textLength: res.text.length });
            return { data: res.text, usage: res.usage };
        }

        debug("Calling Claude...");
        const res = await callClaude(prompt, options);
        debug("Claude response received", { tokens: res.usage.total_tokens, textLength: res.text.length });
        return { data: res.text, usage: res.usage };
    } catch (error) {
        debug("ERROR in callAI", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
        throw error;
    }
}

export async function callAIJSON<T>(
    prompt: string,
    options: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}
): Promise<AIResult<T>> {
    const useGemini = isAnthropicMissing() && process.env.GEMINI_API_KEY;
    debug(`callAIJSON: Using ${useGemini ? "GEMINI" : "CLAUDE"}`, { promptLength: prompt.length });

    try {
        if (useGemini) {
            debug("Calling GeminiJSON...");
            const res = await callGeminiJSON<T>(prompt, options);
            debug("GeminiJSON response received", { tokens: res.usage.total_tokens });
            return res;
        }

        debug("Calling ClaudeJSON...");
        const res = await callClaudeJSON<T>(prompt, options);
        debug("ClaudeJSON response received", { tokens: res.usage.total_tokens });
        return res;
    } catch (error) {
        debug("ERROR in callAIJSON", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
        throw error;
    }
}

