import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ClaudeOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const { systemPrompt, maxTokens = 4000, temperature = 0.7 } = options;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt }
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages,
    ...(systemPrompt && { system: systemPrompt }),
  });

  const textBlock = response.content.find(block => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
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
): Promise<T> {
  const response = await callClaude(prompt, options);
  return parseJSON<T>(response);
}

// Parallel execution helper
export async function parallel<T>(
  tasks: (() => Promise<T>)[]
): Promise<T[]> {
  return Promise.all(tasks.map(task => task()));
}
