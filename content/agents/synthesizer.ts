import { callGeminiJSON } from "../utils/gemini.js";
import type {
  SEOResearch,
  MedicalResearch,
  CompetitorResearch,
  SynthesizedResearch,
  AgentResult,
  HeartbeatFn
} from "../types.js";
import { SYNTHESIZED_RESEARCH_SCHEMA } from "../schemas.js";

const SYNTHESIZER_SYSTEM = `You are a content strategist who synthesizes multiple research perspectives into a unified content brief.
You balance SEO requirements, medical accuracy, and competitive differentiation.
You create clear, actionable briefs that writers can execute.`;

export async function synthesizerAgent(
  keyword: string,
  seo: SEOResearch,
  medical: MedicalResearch,
  competitors: CompetitorResearch,
  heartbeat?: HeartbeatFn
): Promise<AgentResult<SynthesizedResearch>> {

  const prompt = `Synthesize this research into a content strategy.

KEYWORD: "${keyword}"

SEO RESEARCH:
${JSON.stringify(seo, null, 2)}

MEDICAL RESEARCH:
${JSON.stringify(medical, null, 2)}

COMPETITOR RESEARCH:
${JSON.stringify(competitors, null, 2)}

Create a unified strategy that balances SEO, medical accuracy, and differentiation.

Output JSON only matching the requested schema.`;

  try {
    const res = await callGeminiJSON<SynthesizedResearch>(prompt, {
      systemPrompt: SYNTHESIZER_SYSTEM,
      maxTokens: 10000,
      responseSchema: SYNTHESIZED_RESEARCH_SCHEMA,
      model: "models/gemini-1.5-flash",
      heartbeat,
      agentName: "Synthesizer"
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
