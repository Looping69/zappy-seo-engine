import Anthropic from "@anthropic-ai/sdk";
import { secret } from "encore.dev/config";

// Encore secret for Anthropic API key
const anthropicApiKey = secret("ANTHROPIC_API_KEY");

// Debug logging helper
function debug(message: string, data?: unknown) {
  console.log(`[CLAUDE-DEBUG] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

// Lazy initialization for Encore Cloud compatibility
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = anthropicApiKey();
    debug(`Initializing Anthropic client, API key present: ${!!apiKey}`);
    if (!apiKey) {
      debug("ERROR: ANTHROPIC_API_KEY not set!");
      throw new Error("ANTHROPIC_API_KEY secret is not set");
    }
    _client = new Anthropic({ apiKey });
    debug("Anthropic client initialized successfully");
  }
  return _client;
}

export interface ClaudeOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  // Heartbeat callback to signal progress during long AI operations
  heartbeat?: (agentName: string, status: string) => Promise<void>;
  agentName?: string;
}

export interface AIResult {
  text: string;
  usage: {
    total_tokens: number;
  };
}

export async function callClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<AIResult> {
  const { systemPrompt, maxTokens = 4000, temperature = 0.7, heartbeat, agentName = "claude" } = options;
  debug("callClaude called", { promptLength: prompt.length, maxTokens, temperature, hasSystemPrompt: !!systemPrompt });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt }
  ];

  try {
    // Signal heartbeat before AI call
    if (heartbeat) {
      await heartbeat(agentName, "calling AI...").catch(() => { });
    }

    debug("Making API request to Claude...");
    const response = await getClient().messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: maxTokens,
      messages,
      ...(systemPrompt && { system: systemPrompt }),
    });

    const textBlock = response.content.find(block => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
    debug("Claude response received", { responseLength: text.length, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });

    // Signal heartbeat after AI call completes
    if (heartbeat) {
      await heartbeat(agentName, `AI response received (${totalTokens} tokens)`).catch(() => { });
    }

    return {
      text,
      usage: {
        total_tokens: totalTokens
      }
    };
  } catch (error) {
    debug("ERROR in callClaude", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
    throw error;
  }
}

export function parseJSON<T>(text: string): T {
  // Handle markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonStr);
}

export async function callClaudeJSON<T>(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<{ data: T; usage: { total_tokens: number } }> {
  const res = await callClaude(prompt, options);
  return {
    data: parseJSON<T>(res.text),
    usage: res.usage
  };
}

// Parallel execution helper
export async function parallel<T>(
  tasks: (() => Promise<T>)[]
): Promise<T[]> {
  return Promise.all(tasks.map(task => task()));
}
