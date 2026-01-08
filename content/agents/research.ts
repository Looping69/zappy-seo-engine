import { callGeminiJSON } from "../utils/gemini.js";
import type { SEOResearch, MedicalResearch, CompetitorResearch, AgentResult, HeartbeatFn } from "../types.js";

// Debug logging helper
function debug(agent: string, message: string, data?: unknown) {
  console.log(`[AGENT:${agent}] ${new Date().toISOString()} | ${message}`, data ? JSON.stringify(data, null, 2).substring(0, 500) : "");
}

// ============================================================================
// SCHEMAS FOR CONSTRAINED OUTPUT
// ============================================================================

const SEO_RESEARCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    search_intent: { type: "STRING" },
    serp_features: { type: "ARRAY", items: { type: "STRING" } },
    top_ranking_factors: { type: "ARRAY", items: { type: "STRING" } },
    keyword_variations: { type: "ARRAY", items: { type: "STRING" } },
    recommended_word_count: { type: "INTEGER" },
    content_format: { type: "STRING" }
  },
  required: ["search_intent", "serp_features", "top_ranking_factors", "keyword_variations", "recommended_word_count", "content_format"]
};

const MEDICAL_RESEARCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    key_facts: { type: "ARRAY", items: { type: "STRING" } },
    mechanisms: { type: "ARRAY", items: { type: "STRING" } },
    contraindications: { type: "ARRAY", items: { type: "STRING" } },
    side_effects: { type: "ARRAY", items: { type: "STRING" } },
    dosing_info: { type: "ARRAY", items: { type: "STRING" } },
    sources: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          type: { type: "STRING" },
          year: { type: "INTEGER" }
        },
        required: ["title", "type"]
      }
    },
    accuracy_requirements: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["key_facts", "mechanisms", "contraindications", "side_effects", "sources", "accuracy_requirements"]
};

const COMPETITOR_RESEARCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    top_articles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          angle: { type: "STRING" },
          strengths: { type: "ARRAY", items: { type: "STRING" } },
          weaknesses: { type: "ARRAY", items: { type: "STRING" } },
          word_count: { type: "INTEGER" }
        },
        required: ["title", "angle", "strengths", "weaknesses"]
      }
    },
    content_gaps: { type: "ARRAY", items: { type: "STRING" } },
    unique_angles: { type: "ARRAY", items: { type: "STRING" } },
    questions_unanswered: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["top_articles", "content_gaps", "unique_angles", "questions_unanswered"]
};

// ============================================================================
// SEO RESEARCH AGENT
// ============================================================================

const SEO_SYSTEM = `You are an expert SEO strategist specializing in healthcare content. 
You understand search intent, SERP features, and what makes content rank for medical queries.
Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) is critical for health content.`;

export async function seoResearchAgent(keyword: string, heartbeat?: HeartbeatFn): Promise<AgentResult<SEOResearch>> {
  debug("SEO", `Starting SEO research for: "${keyword}"`);

  const prompt = `Analyze this keyword for SEO: "${keyword}"

Context: This is for Zappy Health, a telehealth company specializing in GLP-1 weight loss medications, men's health, women's health, and hair loss.

Analyze search intent, SERP features, ranking factors, keyword variations, recommended word count, and content format.

Output JSON only matching the requested schema.`;

  try {
    debug("SEO", "Calling AI for SEO analysis...");
    const res = await callGeminiJSON<SEOResearch>(prompt, {
      systemPrompt: SEO_SYSTEM,
      maxTokens: 4000,
      responseSchema: SEO_RESEARCH_SCHEMA,
      heartbeat,
      agentName: "SEO-Research"
    });
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

export async function medicalResearchAgent(keyword: string, heartbeat?: HeartbeatFn): Promise<AgentResult<MedicalResearch>> {
  debug("MEDICAL", `Starting medical research for: "${keyword}"`);

  const prompt = `Research the medical aspects of: "${keyword}"

Context: Zappy Health prescribes GLP-1 medications (semaglutide, tirzepatide), testosterone, hair loss treatments, and other telehealth services.

Provide key facts, mechanisms, contraindications, side effects, dosing info, sources, and accuracy requirements.

Output JSON only matching the requested schema.`;

  try {
    debug("MEDICAL", "Calling AI for medical research...");
    const res = await callGeminiJSON<MedicalResearch>(prompt, {
      systemPrompt: MEDICAL_SYSTEM,
      maxTokens: 8192,
      responseSchema: MEDICAL_RESEARCH_SCHEMA,
      heartbeat,
      agentName: "Medical-Research"
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

export async function competitorResearchAgent(keyword: string, heartbeat?: HeartbeatFn): Promise<AgentResult<CompetitorResearch>> {
  debug("COMPETITOR", `Starting competitor research for: "${keyword}"`);

  const prompt = `Analyze what competitors likely have for: "${keyword}"

Context: Zappy Health competes with Hims, Ro, Noom, WeightWatchers, and traditional healthcare content from WebMD, Healthline, Mayo Clinic.

Analyze top articles, angles, gaps, unanswered questions, and unique angles.

Output JSON only matching the requested schema.`;

  try {
    debug("COMPETITOR", "Calling AI for competitor analysis...");
    const res = await callGeminiJSON<CompetitorResearch>(prompt, {
      systemPrompt: COMPETITOR_SYSTEM,
      maxTokens: 6000,
      responseSchema: COMPETITOR_RESEARCH_SCHEMA,
      heartbeat,
      agentName: "Competitor-Research"
    });
    debug("COMPETITOR", "Competitor research completed successfully", { tokens: res.usage.total_tokens, gapsCount: res.data.content_gaps?.length });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    debug("COMPETITOR", "Competitor research FAILED", { error: String(error) });
    return { success: false, error: String(error) };
  }
}
