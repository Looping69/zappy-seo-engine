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
    if (isAnthropicMissing() && process.env.DEEPSEEK_API_KEY) {
        const res = await callDeepSeek(prompt, options);
        return { data: res.text, usage: res.usage };
    }

    const res = await callClaude(prompt, options);
    return { data: res.text, usage: res.usage };
}

export async function callAIJSON<T>(
    prompt: string,
    options: { systemPrompt?: string; maxTokens?: number; temperature?: number } = {}
): Promise<AIResult<T>> {
    if (isAnthropicMissing() && process.env.DEEPSEEK_API_KEY) {
        const res = await callDeepSeekJSON<T>(prompt, options);
        return res;
    }

    const res = await callClaudeJSON<T>(prompt, options);
    return res;
}
