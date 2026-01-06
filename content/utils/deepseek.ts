import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export interface DeepSeekOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface DeepSeekResult {
  text: string;
  usage: {
    total_tokens: number;
  };
}

export async function callDeepSeek(
  prompt: string,
  options: DeepSeekOptions = {}
): Promise<DeepSeekResult> {
  const {
    systemPrompt,
    maxTokens = 4000,
    temperature = 0.7,
    model = "deepseek-chat"
  } = options;

  const response = await client.chat.completions.create({
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user" as const, content: prompt },
    ],
    max_tokens: maxTokens,
    temperature,
    response_format: { type: "text" },
  });

  return {
    text: response.choices[0]?.message?.content || "",
    usage: {
      total_tokens: response.usage?.total_tokens || 0
    }
  };
}

export function parseJSON<T>(text: string): T {
  // Handle markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in DeepSeek response");
  }
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonStr);
}

export async function callDeepSeekJSON<T>(
  prompt: string,
  options: DeepSeekOptions = {}
): Promise<{ data: T; usage: { total_tokens: number } }> {
  const res = await callDeepSeek(prompt, options);
  return {
    data: parseJSON<T>(res.text),
    usage: res.usage
  };
}
