import { callGeminiJSON } from "../utils/gemini.js";
import type {
  SEOResearch,
  MedicalResearch,
  CompetitorResearch,
  SynthesizedResearch,
  AgentResult
} from "../types.js";

const SYNTHESIZER_SYSTEM = `You are a content strategist who synthesizes multiple research perspectives into a unified content brief.
You balance SEO requirements, medical accuracy, and competitive differentiation.
You create clear, actionable briefs that writers can execute.`;

const SYNTHESIZED_RESEARCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    primary_angle: { type: "STRING" },
    target_audience: { type: "STRING" },
    key_questions: { type: "ARRAY", items: { type: "STRING" } },
    must_include: { type: "ARRAY", items: { type: "STRING" } },
    differentiation: { type: "STRING" },
    structure: { type: "ARRAY", items: { type: "STRING" } },
    word_count: { type: "INTEGER" }
  },
  required: ["primary_angle", "target_audience", "key_questions", "must_include", "differentiation", "structure", "word_count"]
};

export async function synthesizerAgent(
  keyword: string,
  seo: SEOResearch,
  medical: MedicalResearch,
  competitors: CompetitorResearch
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
      responseSchema: SYNTHESIZED_RESEARCH_SCHEMA
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
