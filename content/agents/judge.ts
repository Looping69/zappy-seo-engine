import { callSmartAIJSON } from "../utils/ai.js";
import type { ArticleDraft, SynthesizedResearch, AgentResult, HeartbeatFn } from "../types.js";

const JUDGE_SYSTEM = `You are a senior content director who evaluates article drafts.
You can identify what makes content excellent: clarity, accuracy, engagement, SEO strength.
You're decisive - you pick winners and explain why.
You can also synthesize: take the best elements from multiple drafts to create something better.`;

interface JudgeDecision {
  winner: number;
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

const JUDGE_DECISION_SCHEMA = {
  type: "OBJECT",
  properties: {
    winner: { type: "INTEGER" },
    reasoning: { type: "STRING" },
    scores: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          draft_index: { type: "INTEGER" },
          overall: { type: "NUMBER" },
          strengths: { type: "ARRAY", items: { type: "STRING" } },
          weaknesses: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["draft_index", "overall", "strengths", "weaknesses"]
      }
    },
    synthesis_opportunity: { type: "BOOLEAN" },
    elements_to_combine: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          from_draft: { type: "INTEGER" },
          element: { type: "STRING" }
        },
        required: ["from_draft", "element"]
      }
    }
  },
  required: ["winner", "reasoning", "scores", "synthesis_opportunity"]
};

// Re-use ARTICLE_SCHEMA logic via a shared type or just redefine it here for the synthesis step
const SYNTHESIS_ARTICLE_SCHEMA = {
  type: "OBJECT",
  properties: {
    angle: { type: "STRING" },
    title: { type: "STRING" },
    meta_description: { type: "STRING" },
    slug: { type: "STRING" },
    body: { type: "STRING" },
    sources_cited: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["angle", "title", "meta_description", "slug", "body"]
};

export async function judgeAgent(
  drafts: ArticleDraft[],
  research: SynthesizedResearch,
  heartbeat?: HeartbeatFn
): Promise<AgentResult<{ selectedDraft: ArticleDraft; decision: JudgeDecision }>> {

  // Defensive check: ensure we have valid drafts
  if (!drafts || drafts.length === 0) {
    return { success: false, error: "No drafts provided to judge agent" };
  }

  // Filter out any undefined/null drafts
  const validDrafts = drafts.filter(d => d && d.body);
  if (validDrafts.length === 0) {
    return { success: false, error: "No valid drafts with body content to evaluate" };
  }

  // Build draft descriptions dynamically
  const draftDescriptions = validDrafts.map((draft, i) =>
    `DRAFT ${i + 1} (${draft.angle || 'Unknown'}):\nTitle: ${draft.title || 'Untitled'}\n${(draft.body || '').substring(0, 1500)}...`
  ).join("\n\n");

  const prompt = `Evaluate these ${validDrafts.length} article drafts and pick the best one.

ORIGINAL BRIEF:
Keyword: targeting "${research.primary_angle}"
Key questions to answer: ${research.key_questions.join(", ")}
Must include: ${research.must_include.join(", ")}

${draftDescriptions}

Pick a winner (0-indexed). Note if combining elements would be better.

Output JSON only matching the requested schema.`;

  try {
    const res = await callSmartAIJSON<JudgeDecision>(prompt, {
      systemPrompt: JUDGE_SYSTEM,
      maxTokens: 4000,
      responseSchema: JUDGE_DECISION_SCHEMA,
      heartbeat,
      agentName: "Judge"
    });

    let totalTokens = res.usage.total_tokens;
    const decision = res.data;

    // Safe access with bounds check
    const winnerIdx = Math.min(decision.winner, validDrafts.length - 1);
    let selectedDraft = validDrafts[winnerIdx];

    if (decision.synthesis_opportunity && decision.elements_to_combine && decision.elements_to_combine.length > 0) {
      const synthesisResult = await synthesizeDrafts(selectedDraft, validDrafts, decision.elements_to_combine, heartbeat);
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
  elementsToInclude: { from_draft: number; element: string }[],
  heartbeat?: HeartbeatFn
): Promise<AgentResult<ArticleDraft>> {

  const elementsDescription = elementsToInclude
    .map(e => `From draft ${e.from_draft + 1}: ${e.element}`)
    .join("\n");

  const prompt = `Improve this article by incorporating the best elements from other drafts.

BASE ARTICLE:
${baseDraft.body}

ELEMENTS TO INCORPORATE:
${elementsDescription}

OTHER DRAFTS:
${allDrafts.map((d, i) => `Draft ${i + 1}:\n${d.body.substring(0, 1500)}...`).join("\n\n")}

Output JSON only matching the requested schema.`;

  try {
    const res = await callSmartAIJSON<ArticleDraft>(prompt, {
      systemPrompt: JUDGE_SYSTEM,
      maxTokens: 8192,
      responseSchema: SYNTHESIS_ARTICLE_SCHEMA,
      heartbeat,
      agentName: "Judge-Synthesis"
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
