import { callSmartAIJSON } from "../utils/ai.js";
import type { ArticleDraft, MedicalCritique, EditorialCritique, AgentResult } from "../types.js";

// ============================================================================
// MEDICAL REVIEWER AGENT
// ============================================================================

const MEDICAL_REVIEWER_SYSTEM = `You are a physician reviewer ensuring medical content is accurate and safe.
You are cautious - you flag anything that could mislead patients or cause harm.
You understand FDA regulations, clinical guidelines, and evidence-based medicine.
Your job is patient safety first, then accuracy, then completeness.

CRITICAL FLAGS:
- Incorrect dosing information
- Missing serious side effects or contraindications  
- Overstated benefits without evidence
- Claims that could delay proper medical care
- Missing "consult your provider" where needed`;

const MEDICAL_CRITIQUE_SCHEMA = {
  type: "OBJECT",
  properties: {
    claims_found: { type: "INTEGER" },
    claims_verified: { type: "INTEGER" },
    flagged_claims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          claim: { type: "STRING" },
          issue: { type: "STRING" },
          severity: { type: "STRING" }
        },
        required: ["claim", "issue", "severity"]
      }
    },
    missing_disclaimers: { type: "ARRAY", items: { type: "STRING" } },
    overall_accuracy: { type: "NUMBER" },
    approved: { type: "BOOLEAN" },
    revision_required: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["claims_found", "claims_verified", "overall_accuracy", "approved", "revision_required"]
};

export async function medicalReviewerAgent(draft: ArticleDraft): Promise<AgentResult<MedicalCritique>> {
  const prompt = `Review this article for medical accuracy.

Title: ${draft.title}
Body:
${draft.body.substring(0, 8000)}

Analyze the article and output JSON:
{
  "claims_found": <number of medical claims>,
  "claims_verified": <number of accurate claims>,
  "flagged_claims": [{"claim": "...", "issue": "...", "severity": "low|medium|high"}],
  "missing_disclaimers": ["..."],
  "overall_accuracy": <1-10 score>,
  "approved": <true if safe and accurate>,
  "revision_required": ["list of fixes needed"]
}`;

  try {
    const res = await callSmartAIJSON<MedicalCritique>(prompt, {
      systemPrompt: MEDICAL_REVIEWER_SYSTEM,
      maxTokens: 4000,
      responseSchema: MEDICAL_CRITIQUE_SCHEMA
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// EDITORIAL REVIEWER AGENT
// ============================================================================

const EDITORIAL_REVIEWER_SYSTEM = `You are a senior editor specializing in healthcare content.
You evaluate clarity, voice, structure, engagement, and SEO.
You give specific, actionable feedback - not vague critiques.
You understand that medical content must be accurate, but it also must be readable and helpful.

VOICE TARGET: A knowledgeable physician explaining to a patient - warm, clear, authoritative but not intimidating.`;

const EDITORIAL_CRITIQUE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scores: {
      type: "OBJECT",
      properties: {
        clarity: {
          type: "OBJECT",
          properties: {
            dimension: { type: "STRING" },
            score: { type: "NUMBER" },
            feedback: { type: "STRING" },
            must_fix: { type: "BOOLEAN" }
          },
          required: ["dimension", "score", "feedback", "must_fix"]
        },
        voice: {
          type: "OBJECT",
          properties: {
            dimension: { type: "STRING" },
            score: { type: "NUMBER" },
            feedback: { type: "STRING" },
            must_fix: { type: "BOOLEAN" }
          },
          required: ["dimension", "score", "feedback", "must_fix"]
        },
        structure: {
          type: "OBJECT",
          properties: {
            dimension: { type: "STRING" },
            score: { type: "NUMBER" },
            feedback: { type: "STRING" },
            must_fix: { type: "BOOLEAN" }
          },
          required: ["dimension", "score", "feedback", "must_fix"]
        },
        engagement: {
          type: "OBJECT",
          properties: {
            dimension: { type: "STRING" },
            score: { type: "NUMBER" },
            feedback: { type: "STRING" },
            must_fix: { type: "BOOLEAN" }
          },
          required: ["dimension", "score", "feedback", "must_fix"]
        },
        seo: {
          type: "OBJECT",
          properties: {
            dimension: { type: "STRING" },
            score: { type: "NUMBER" },
            feedback: { type: "STRING" },
            must_fix: { type: "BOOLEAN" }
          },
          required: ["dimension", "score", "feedback", "must_fix"]
        }
      },
      required: ["clarity", "voice", "structure", "engagement", "seo"]
    },
    overall_score: { type: "NUMBER" },
    approved: { type: "BOOLEAN" },
    revision_required: { type: "ARRAY", items: { type: "STRING" } },
    specific_edits: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          location: { type: "STRING" },
          current: { type: "STRING" },
          suggested: { type: "STRING" }
        },
        required: ["location", "current", "suggested"]
      }
    }
  },
  required: ["scores", "overall_score", "approved", "revision_required"]
};

export async function editorialReviewerAgent(draft: ArticleDraft): Promise<AgentResult<EditorialCritique>> {
  const prompt = `Review this article for editorial quality.

TITLE: ${draft.title}
META: ${draft.meta_description}

ARTICLE (first 8000 chars):
${draft.body.substring(0, 8000)}

Score each dimension 1-10 and output JSON matching the schema.`;

  try {
    const res = await callSmartAIJSON<EditorialCritique>(prompt, {
      systemPrompt: EDITORIAL_REVIEWER_SYSTEM,
      maxTokens: 4000,
      responseSchema: EDITORIAL_CRITIQUE_SCHEMA
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// COMBINED CRITIQUE - Run sequentially and merge feedback
// ============================================================================

export async function runCritique(draft: ArticleDraft): Promise<{
  medical: MedicalCritique | null;
  editorial: EditorialCritique | null;
  approved: boolean;
  revisionNeeded: string[];
  usage: { total_tokens: number };
}> {
  let totalTokens = 0;

  // Run critics sequentially
  const medicalResult = await medicalReviewerAgent(draft);
  const medical = medicalResult.success ? medicalResult.data! : null;
  totalTokens += medicalResult.usage?.total_tokens || 0;

  const editorialResult = await editorialReviewerAgent(draft);
  const editorial = editorialResult.success ? editorialResult.data! : null;
  totalTokens += editorialResult.usage?.total_tokens || 0;

  // Combine revision requirements
  const revisionNeeded: string[] = [];

  if (medical?.revision_required) {
    revisionNeeded.push(...medical.revision_required);
  }

  if (editorial?.revision_required) {
    revisionNeeded.push(...editorial.revision_required);
  }

  // Both must approve for overall approval
  const approved = (medical?.approved ?? false) && (editorial?.approved ?? false);

  return { medical, editorial, approved, revisionNeeded, usage: { total_tokens: totalTokens } };
}
