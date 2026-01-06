import { callAIJSON, callAI } from "../utils/ai.js";
import type { ArticleDraft, SynthesizedResearch, AgentResult } from "../types.js";

const JUDGE_SYSTEM = `You are a senior content director who evaluates article drafts.
You can identify what makes content excellent: clarity, accuracy, engagement, SEO strength.
You're decisive - you pick winners and explain why.
You can also synthesize: take the best elements from multiple drafts to create something better.`;

interface JudgeDecision {
  winner: number; // 0, 1, or 2 (index of winning draft)
  reasoning: string;
  scores: {
    draft_index: number;
    overall: number;
    strengths: string[];
    weaknesses: string[];
  }[];
  synthesis_opportunity: boolean;
  elements_to_combine?: {
    from_draft: number;
    element: string;
  }[];
}

export async function judgeAgent(
  drafts: ArticleDraft[],
  research: SynthesizedResearch
): Promise<AgentResult<{ selectedDraft: ArticleDraft; decision: JudgeDecision }>> {

  const prompt = `Evaluate these ${drafts.length} article drafts and pick the best one.

ORIGINAL BRIEF:
Keyword: targeting "${research.primary_angle}"
Key questions to answer: ${research.key_questions.join(", ")}
Must include: ${research.must_include.join(", ")}

DRAFT 1 (${drafts[0].angle}):
Title: ${drafts[0].title}
${drafts[0].body.substring(0, 2000)}...

DRAFT 2 (${drafts[1].angle}):
Title: ${drafts[1].title}
${drafts[1].body.substring(0, 2000)}...

DRAFT 3 (${drafts[2].angle}):
Title: ${drafts[2].title}
${drafts[2].body.substring(0, 2000)}...

Evaluate each on:
1. Does it answer the key questions?
2. Medical accuracy signals (cites sources, appropriate disclaimers)
3. Readability and engagement
4. Voice (sounds like a helpful doctor, not a corporation)
5. SEO optimization

Pick a winner. Also note if combining elements from multiple drafts would be better.

Output JSON only:
{
  "winner": 0,
  "reasoning": "Why this draft wins",
  "scores": [
    {"draft_index": 0, "overall": 8.5, "strengths": [".."], "weaknesses": [".."]},
    {"draft_index": 1, "overall": 7.2, "strengths": [".."], "weaknesses": [".."]},
    {"draft_index": 2, "overall": 7.8, "strengths": [".."], "weaknesses": [".."]}
  ],
  "synthesis_opportunity": true,
  "elements_to_combine": [
    {"from_draft": 1, "element": "The opening hook about patient struggle"},
    {"from_draft": 2, "element": "The dosing table format"}
  ]
}`;

  try {
    const res = await callAIJSON<JudgeDecision>(prompt, {
      systemPrompt: JUDGE_SYSTEM,
      maxTokens: 2000
    });

    let totalTokens = res.usage.total_tokens;
    const decision = res.data;

    let selectedDraft = drafts[decision.winner];

    if (decision.synthesis_opportunity && decision.elements_to_combine && decision.elements_to_combine.length > 0) {
      const synthesisResult = await synthesizeDrafts(selectedDraft, drafts, decision.elements_to_combine);
      if (synthesisResult.success && synthesisResult.data) {
        selectedDraft = synthesisResult.data;
        totalTokens += synthesisResult.usage?.total_tokens || 0;
      }
    }

    return {
      success: true,
      data: { selectedDraft, decision },
      usage: { total_tokens: totalTokens }
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function synthesizeDrafts(
  baseDraft: ArticleDraft,
  allDrafts: ArticleDraft[],
  elementsToInclude: { from_draft: number; element: string }[]
): Promise<AgentResult<ArticleDraft>> {

  const elementsDescription = elementsToInclude
    .map(e => `From draft ${e.from_draft + 1}: ${e.element}`)
    .join("\n");

  const prompt = `Improve this article by incorporating the best elements from other drafts.

BASE ARTICLE (keep this structure):
${baseDraft.body}

ELEMENTS TO INCORPORATE:
${elementsDescription}

OTHER DRAFTS FOR REFERENCE:
${allDrafts.map((d, i) => `Draft ${i + 1}:\n${d.body.substring(0, 1500)}...`).join("\n\n")}

Create an improved version that incorporates the specified elements naturally.
Keep the base structure but enhance with the best parts of other drafts.

Output JSON only:
{
  "angle": "synthesized",
  "title": "${baseDraft.title}",
  "meta_description": "${baseDraft.meta_description}",
  "slug": "${baseDraft.slug}",
  "body": "Improved full article",
  "sources_cited": []
}`;

  try {
    const res = await callAIJSON<ArticleDraft>(prompt, {
      systemPrompt: JUDGE_SYSTEM,
      maxTokens: 8000
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
