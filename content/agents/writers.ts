import { callAIJSON } from "../utils/ai.js";
import { callDeepSeekJSON } from "../utils/deepseek.js";
import type { SynthesizedResearch, ArticleDraft, AgentResult } from "../types.js";

// ============================================================================
// WRITER PERSONAS - Different angles/approaches
// ============================================================================

const WRITER_BASE_SYSTEM = `You are an Elite Medical Content Strategist for Zappy Health. 

CONTENT ARCHITECTURE RULES (STRICT):
1. HIERARCHY: Use ## for main sections (H2) and ### for subsections (H3). Every article MUST have at least 4 sections.
2. INTRODUCTION: Open with a compelling hook that acknowledges the patient's pain point and provides a clear "bottom line" answer within the first 2 paragraphs.
3. BULLET POINTS: Use bulleted or numbered lists for every medical procedure, set of symptoms, or list of recommendations. NEVER write these as long sentences.
4. PARAGRAPHS: Keep paragraphs to a maximum of 3 sentences. Whitespace is critical for readability in high-stress medical contexts.
5. TRANSITIONS: Every H2 section must flow logically from the previous one.
6. KEY TAKEAWAYS: Use a "Key Takeaway" or "Summary" block at the end of each major H2 section (using bold text).
7. CONCLUSION: Always end with a "Final Thoughts" section that summarizes the path forward.

VOICE PRINCIPLES:
- Write like a world-class physician explaining to a patient.
- Tone: Clinical Authority meets Radical Empathy.
- No fluff, no filler adjectives, zero corporate jargon.
- Use "you" to speak directly to the patient's experience.

MEDICAL ACCURACY:
- Cite specific medical mechanisms (e.g., "This works by inhibiting the GLP-1 receptor...")
- Explicitly list side effects and contraindications.
- Include a clear clinical disclaimer.`;

const WRITER_ANGLES = {
  clinical: `${WRITER_BASE_SYSTEM}

YOUR ANGLE: Clinical Authority
Write from deep medical expertise. Lead with mechanisms, cite research, explain the "why" behind recommendations. 
Target: Readers who want to understand the science.
Tone: Confident physician sharing knowledge.`,

  empathetic: `${WRITER_BASE_SYSTEM}

YOUR ANGLE: Patient-Centered Empathy  
Lead with understanding their struggle. Acknowledge fears and frustrations before educating.
Target: Readers who feel overwhelmed or uncertain.
Tone: Caring doctor who's seen this a thousand times and wants to help.`,

  practical: `${WRITER_BASE_SYSTEM}

YOUR ANGLE: Actionable Guidance
Focus on what to DO. Clear steps, practical advice, what to expect.
Target: Readers ready to take action, want a roadmap.
Tone: Experienced guide who's walked this path with many patients.`,

  innovative: `${WRITER_BASE_SYSTEM}

YOUR ANGLE: Innovative & Modern Perspectives
Focus on cutting-edge treatments, lifestyle integration, and the future of wait-less care.
Target: Tech-savvy readers, early adopters, and those looking for more than "standard" advice.
Tone: Forward-thinking, energetic, and optimistic health expert.`
};

async function writeArticle(
  angle: keyof typeof WRITER_ANGLES,
  keyword: string,
  research: SynthesizedResearch,
  useDeepSeek = false
): Promise<AgentResult<ArticleDraft>> {

  const prompt = `Write an article for: "${keyword}"

RESEARCH BRIEF:
${JSON.stringify(research, null, 2)}

REQUIREMENTS:
- Title: SEO-optimized, under 60 characters
- Meta description: Compelling, under 155 characters  
- Slug: URL-friendly
- Body: ${research.word_count} words in markdown
- Follow the structure provided in research
- Cite sources where making medical claims
- End with subtle CTA to Zappy (helpful, not salesy)

Output JSON only:
{
  "angle": "${angle}",
  "title": "SEO title",
  "meta_description": "Compelling meta description",
  "slug": "url-friendly-slug",
  "body": "Full article in markdown with ## headings",
  "sources_cited": ["Source 1", "Source 2"]
}`;

  try {
    let res;
    if (useDeepSeek) {
      res = await callDeepSeekJSON<ArticleDraft>(prompt, {
        systemPrompt: WRITER_ANGLES[angle],
        maxTokens: 8000
      });
    } else {
      res = await callAIJSON<ArticleDraft>(prompt, {
        systemPrompt: WRITER_ANGLES[angle],
        maxTokens: 8000
      });
    }
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Export individual angle writers
export const writeClinical = (keyword: string, research: SynthesizedResearch) =>
  writeArticle("clinical", keyword, research);

export const writeEmpathetic = (keyword: string, research: SynthesizedResearch) =>
  writeArticle("empathetic", keyword, research);

export const writePractical = (keyword: string, research: SynthesizedResearch) =>
  writeArticle("practical", keyword, research);

export const writeDeepSeek = (keyword: string, research: SynthesizedResearch) =>
  writeArticle("innovative", keyword, research, true);

// ============================================================================
// REVISION WRITER - Takes critique and revises
// ============================================================================

const REVISION_SYSTEM = `${WRITER_BASE_SYSTEM}

You are revising an existing article based on specific feedback.
Make ONLY the changes requested. Preserve what's working.
If feedback conflicts, prioritize medical accuracy over style.`;

export async function revisionWriter(
  currentDraft: ArticleDraft,
  medicalFeedback: string[],
  editorialFeedback: string[]
): Promise<AgentResult<ArticleDraft>> {

  const prompt = `Revise this article based on feedback.

CURRENT ARTICLE:
Title: ${currentDraft.title}
Body:
${currentDraft.body}

MEDICAL ACCURACY ISSUES (MUST FIX):
${medicalFeedback.map(f => `- ${f}`).join("\n")}

EDITORIAL IMPROVEMENTS:
${editorialFeedback.map(f => `- ${f}`).join("\n")}

Revise the article. Keep what's working, fix what's not.

Output JSON only:
{
  "angle": "${currentDraft.angle}",
  "title": "Updated title if needed",
  "meta_description": "Updated meta if needed",
  "slug": "${currentDraft.slug}",
  "body": "Revised full article in markdown",
  "sources_cited": ["Updated sources"]
}`;

  try {
    const res = await callAIJSON<ArticleDraft>(prompt, {
      systemPrompt: REVISION_SYSTEM,
      maxTokens: 8000
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
