import { callClaudeJSON, callClaude } from "./claude.js";
import { callDeepSeekJSON, callDeepSeek } from "./deepseek.js";

/**
 * Unified AI caller that prioritizes Claude but falls back to DeepSeek
 * if the Anthropic key is missing or a placeholder.
 */
function isAnthropicMissing(): boolean {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    return !anthropicKey || anthropicKey.startsWith("sk-ant-") || anthropicKey.includes("...");
}

export async function callAI(
    prompt: string,
    options: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
    if (isAnthropicMissing() && process.env.DEEPSEEK_API_KEY) {
        if (!globalThis.hasLoggedDeepSeekFallback) {
            console.log("  ⚠️ Using DeepSeek as primary engine (Anthropic key is missing or placeholder)");
            (globalThis as any).hasLoggedDeepSeekFallback = true;
        }
        return callDeepSeek(prompt, options);
    }

    return callClaude(prompt, options);
}

export async function callAIJSON<T>(
    prompt: string,
    options: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}
): Promise<T> {
    if (isAnthropicMissing() && process.env.DEEPSEEK_API_KEY) {
        return callDeepSeekJSON<T>(prompt, options);
    }

    return callClaudeJSON<T>(prompt, options);
}
