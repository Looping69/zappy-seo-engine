import { callAIJSON } from "../utils/ai.js";
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

export async function medicalReviewerAgent(draft: ArticleDraft): Promise<AgentResult<MedicalCritique>> {
  const prompt = `Review this article for medical accuracy and patient safety.

TITLE: ${draft.title}

ARTICLE:
${draft.body}

Review:
1. Identify every medical claim made
2. Verify accuracy (flag anything uncertain or wrong)
3. Check for missing warnings/contraindications
4. Ensure appropriate disclaimers are present
5. Flag anything that could harm patients

BE STRICT. Patient safety is paramount.

Output JSON only:
{
  "claims_found": 15,
  "claims_verified": 13,
  "flagged_claims": [
    {
      "claim": "The specific claim text",
      "issue": "What's wrong with it",
      "severity": "low|medium|high"
    }
  ],
  "missing_disclaimers": ["Should mention X", "Needs consult provider warning for Y"],
  "overall_accuracy": 8.5,
  "approved": false,
  "revision_required": ["Fix the dosing in paragraph 3", "Add contraindication for kidney disease"]
}`;

  try {
    const res = await callAIJSON<MedicalCritique>(prompt, {
      systemPrompt: MEDICAL_REVIEWER_SYSTEM,
      maxTokens: 2000
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

export async function editorialReviewerAgent(draft: ArticleDraft): Promise<AgentResult<EditorialCritique>> {
  const prompt = `Review this article for editorial quality.

TITLE: ${draft.title}
META: ${draft.meta_description}

ARTICLE:
${draft.body}

Score each dimension 1-10:
1. **Clarity**: Is it easy to understand? Jargon explained?
2. **Voice**: Does it sound like a helpful doctor, not a corporation?
3. **Structure**: Logical flow? Good use of headings? Scannable?
4. **Engagement**: Does it hook the reader? Keep them reading?
5. **SEO**: Natural keyword usage? Good meta? Proper headings?

For each score below 8, provide specific fixes.

Output JSON only:
{
  "scores": {
    "clarity": {"dimension": "clarity", "score": 8, "feedback": "Clear overall, but X paragraph is dense", "must_fix": false},
    "voice": {"dimension": "voice", "score": 7, "feedback": "Sounds too corporate in intro", "must_fix": true},
    "structure": {"dimension": "structure", "score": 9, "feedback": "Excellent use of subheadings", "must_fix": false},
    "engagement": {"dimension": "engagement", "score": 7, "feedback": "Opening is weak, doesn't hook", "must_fix": true},
    "seo": {"dimension": "seo", "score": 8, "feedback": "Good keyword placement", "must_fix": false}
  },
  "overall_score": 7.8,
  "approved": false,
  "revision_required": ["Rewrite opening to be more engaging", "Fix corporate tone in paragraph 2"],
  "specific_edits": [
    {
      "location": "Opening paragraph",
      "current": "Semaglutide is a medication that...",
      "suggested": "If you're considering semaglutide, you probably have questions..."
    }
  ]
}`;

  try {
    const res = await callAIJSON<EditorialCritique>(prompt, {
      systemPrompt: EDITORIAL_REVIEWER_SYSTEM,
      maxTokens: 2500
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// COMBINED CRITIQUE - Run both and merge feedback
// ============================================================================

export async function runCritique(draft: ArticleDraft): Promise<{
  medical: MedicalCritique | null;
  editorial: EditorialCritique | null;
  approved: boolean;
  revisionNeeded: string[];
}> {
  // Run both critics in parallel
  const [medicalResult, editorialResult] = await Promise.all([
    medicalReviewerAgent(draft),
    editorialReviewerAgent(draft)
  ]);

  const medical = medicalResult.success ? medicalResult.data! : null;
  const editorial = editorialResult.success ? editorialResult.data! : null;

  const totalTokens = (medicalResult.usage?.total_tokens || 0) + (editorialResult.usage?.total_tokens || 0);

  // Combine revision requirements
  const revisionNeeded: string[] = [];

  if (medical) {
    revisionNeeded.push(...medical.revision_required);
  }

  if (editorial) {
    revisionNeeded.push(...editorial.revision_required);
  }

  // Both must approve for overall approval
  const approved = (medical?.approved ?? false) && (editorial?.approved ?? false);

  return { medical, editorial, approved, revisionNeeded, usage: { total_tokens: totalTokens } };
}
