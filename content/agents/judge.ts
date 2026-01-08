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

Pick a winner. Note if combining elements would be better.

Output JSON only matching the requested schema.`;

  try {
    const res = await callSmartAIJSON<JudgeDecision>(prompt, {
      systemPrompt: JUDGE_SYSTEM,
      maxTokens: 4000,
      responseSchema: JUDGE_DECISION_SCHEMA
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
      responseSchema: SYNTHESIS_ARTICLE_SCHEMA
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
