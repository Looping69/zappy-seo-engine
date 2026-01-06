import { callAIJSON } from "../utils/ai.js";
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

Create a unified strategy that:
1. Picks the BEST angle that balances SEO potential, medical accuracy, and differentiation
2. Defines the target audience precisely
3. Lists the key questions to answer (in order of importance)
4. Specifies what MUST be included for accuracy and completeness
5. Clarifies how to differentiate from competitors
6. Outlines the structure (H2s and their purpose)

Output JSON only:
{
  "primary_angle": "The unique angle to take",
  "target_audience": "Specific audience description",
  "key_questions": ["Question 1 to answer", "Question 2", ...],
  "must_include": ["Medical fact that must be accurate", "SEO element", ...],
  "differentiation": "How this will stand out from competitors",
  "structure": ["H2: Introduction - hook them", "H2: The Quick Answer", "H2: Deep Dive", ...],
  "word_count": 1800,
  "seo": <include the seo research>,
  "medical": <include the medical research>,
  "competitors": <include the competitor research>
}`;

  try {
    const res = await callAIJSON<SynthesizedResearch>(prompt, {
      systemPrompt: SYNTHESIZER_SYSTEM,
      maxTokens: 4000
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
