import { callAIJSON } from "../utils/ai.js";
import type { SEOResearch, MedicalResearch, CompetitorResearch, AgentResult } from "../types.js";

// Debug logging helper
function debug(agent: string, message: string, data?: unknown) {
  console.log(`[AGENT:${agent}] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2).substring(0, 500) : "");
}

// ============================================================================
// SEO RESEARCH AGENT
// ============================================================================

const SEO_SYSTEM = `You are an expert SEO strategist specializing in healthcare content. 
You understand search intent, SERP features, and what makes content rank for medical queries.
Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) is critical for health content.`;

export async function seoResearchAgent(keyword: string): Promise<AgentResult<SEOResearch>> {
  debug("SEO", `Starting SEO research for: "${keyword}"`);

  const prompt = `Analyze this keyword for SEO: "${keyword}"

Context: This is for Zappy Health, a telehealth company specializing in GLP-1 weight loss medications, men's health, women's health, and hair loss.

Analyze:
1. What is the TRUE search intent? (What does the person really want to know/do?)
2. What SERP features likely appear? (Featured snippets, PAA, knowledge panels, etc.)
3. What factors will determine ranking for this query?
4. What related keywords should be included naturally?
5. What word count typically ranks?
6. What content format works best?

Output JSON only:
{
  "search_intent": "informational|transactional|comparison|navigational",
  "serp_features": ["featured snippet", "people also ask", ...],
  "top_ranking_factors": ["comprehensive coverage of X", "medical credentials", ...],
  "keyword_variations": ["related keyword 1", "related keyword 2", ...],
  "recommended_word_count": 1800,
  "content_format": "comprehensive guide|comparison|listicle|FAQ|how-to"
}`;

  try {
    debug("SEO", "Calling AI for SEO analysis...");
    const res = await callAIJSON<SEOResearch>(prompt, { systemPrompt: SEO_SYSTEM });
    debug("SEO", "SEO research completed successfully", { tokens: res.usage.total_tokens, intent: res.data.search_intent });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    debug("SEO", "SEO research FAILED", { error: String(error) });
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// MEDICAL RESEARCH AGENT
// ============================================================================

const MEDICAL_SYSTEM = `You are a medical research specialist with expertise in pharmacology, endocrinology, and evidence-based medicine.
You prioritize accuracy above all else. You know the difference between established facts and emerging research.
You understand FDA guidelines, clinical trial data, and how to communicate medical information responsibly.`;

export async function medicalResearchAgent(keyword: string): Promise<AgentResult<MedicalResearch>> {
  debug("MEDICAL", `Starting medical research for: "${keyword}"`);

  const prompt = `Research the medical aspects of: "${keyword}"

Context: Zappy Health prescribes GLP-1 medications (semaglutide, tirzepatide), testosterone, hair loss treatments, and other telehealth services.

Provide:
1. Key medical facts that MUST be accurate
2. Mechanism of action (if medication-related)
3. Important contraindications or warnings
4. Common and serious side effects
5. Dosing information (if relevant)
6. Credible sources (FDA, clinical trials, medical guidelines)
7. Specific accuracy requirements (what claims need citations)

Output JSON only:
{
  "key_facts": ["fact 1", "fact 2", ...],
  "mechanisms": ["how it works explanation", ...],
  "contraindications": ["who should not use", ...],
  "side_effects": ["common: X, Y", "serious: Z", ...],
  "dosing_info": ["typical doses", "titration schedules", ...],
  "sources": [{"title": "FDA label", "type": "regulatory", "year": 2023}, ...],
  "accuracy_requirements": ["claim X requires citation", ...]
}`;

  try {
    debug("MEDICAL", "Calling AI for medical research...");
    const res = await callAIJSON<MedicalResearch>(prompt, {
      systemPrompt: MEDICAL_SYSTEM,
      maxTokens: 3000
    });
    debug("MEDICAL", "Medical research completed successfully", { tokens: res.usage.total_tokens, factsCount: res.data.key_facts?.length });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    debug("MEDICAL", "Medical research FAILED", { error: String(error) });
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// COMPETITOR RESEARCH AGENT
// ============================================================================

const COMPETITOR_SYSTEM = `You are a competitive intelligence analyst specializing in healthcare content marketing.
You understand what makes content successful, identify gaps in existing coverage, and find unique angles.
You think strategically about differentiation.`;

export async function competitorResearchAgent(keyword: string): Promise<AgentResult<CompetitorResearch>> {
  debug("COMPETITOR", `Starting competitor research for: "${keyword}"`);

  const prompt = `Analyze what competitors likely have for: "${keyword}"

Context: Zappy Health competes with Hims, Ro, Noom, WeightWatchers, and traditional healthcare content from WebMD, Healthline, Mayo Clinic.

Analyze what top-ranking content probably looks like:
1. What angles are they taking?
2. What are their strengths?
3. What are their weaknesses or gaps?
4. What questions remain unanswered?
5. What unique angle could Zappy take?

Zappy's differentiators:
- Founded by an oncologist with 20+ years experience
- Direct telehealth access (not just information)
- Clinical expertise + practical guidance

Output JSON only:
{
  "top_articles": [
    {
      "title": "Likely competitor article title",
      "angle": "Their approach",
      "strengths": ["what they do well"],
      "weaknesses": ["what they miss"],
      "word_count": 1500
    }
  ],
  "content_gaps": ["topic not well covered", ...],
  "unique_angles": ["angle Zappy could own", ...],
  "questions_unanswered": ["question competitors don't answer well", ...]
}`;

  try {
    debug("COMPETITOR", "Calling AI for competitor analysis...");
    const res = await callAIJSON<CompetitorResearch>(prompt, { systemPrompt: COMPETITOR_SYSTEM });
    debug("COMPETITOR", "Competitor research completed successfully", { tokens: res.usage.total_tokens, gapsCount: res.data.content_gaps?.length });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    debug("COMPETITOR", "Competitor research FAILED", { error: String(error) });
    return { success: false, error: String(error) };
  }
}
