import { callSmartAIJSON } from "../utils/ai.js";
import type { ArticleDraft, SynthesizedResearch, AgentResult, HeartbeatFn } from "../types.js";
import { JUDGE_DECISION_SCHEMA, ARTICLE_SCHEMA } from "../schemas.js";

const JUDGE_SYSTEM = `You are a senior content director who evaluates article drafts.
You can identify what makes content excellent: clarity, accuracy, engagement, SEO strength.
You're decisive - you pick winners and explain why briefly.
IMPORTANT: Keep ALL your responses CONCISE. Reasoning under 200 chars. Strengths/weaknesses under 50 chars each.`;

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

Pick a winner (0-indexed).

IMPORTANT JSON FORMATTING RULES:
- "reasoning": Keep under 200 characters, NO QUOTES in the text
- "strengths" and "weaknesses": Max 3 items each, each under 50 characters, NO QUOTES
- "elements_to_combine": Max 3 items, "element" under 100 characters
- Use single quotes or apostrophes if needed, NEVER double quotes inside strings

Output JSON only matching the requested schema.`;

  try {
    const res = await callSmartAIJSON<JudgeDecision>(prompt, {
      systemPrompt: JUDGE_SYSTEM,
      maxTokens: 4000,
      responseSchema: JUDGE_DECISION_SCHEMA,
      model: "gemini-1.5-flash",
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
      responseSchema: ARTICLE_SCHEMA,
      heartbeat,
      agentName: "Judge-Synthesis"
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
