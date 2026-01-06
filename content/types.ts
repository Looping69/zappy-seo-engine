// ============================================================================
// SHARED TYPES FOR MULTI-AGENT CONTENT ENGINE
// ============================================================================

export interface Keyword {
  id: number;
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  intent?: string;
  cluster?: string;
}

// Research outputs from parallel agents
export interface SEOResearch {
  search_intent: "informational" | "transactional" | "comparison" | "navigational";
  serp_features: string[]; // featured snippets, PAA, etc.
  top_ranking_factors: string[];
  keyword_variations: string[];
  recommended_word_count: number;
  content_format: string; // listicle, guide, comparison, etc.
}

export interface MedicalResearch {
  key_facts: string[];
  mechanisms: string[];
  contraindications: string[];
  side_effects: string[];
  dosing_info: string[];
  sources: { title: string; type: string; year?: number }[];
  accuracy_requirements: string[];
}

export interface CompetitorResearch {
  top_articles: {
    title: string;
    angle: string;
    strengths: string[];
    weaknesses: string[];
    word_count: number;
  }[];
  content_gaps: string[];
  unique_angles: string[];
  questions_unanswered: string[];
}

export interface SynthesizedResearch {
  primary_angle: string;
  target_audience: string;
  key_questions: string[];
  must_include: string[];
  differentiation: string;
  structure: string[];
  word_count: number;
  seo: SEOResearch;
  medical: MedicalResearch;
  competitors: CompetitorResearch;
}

// Article drafts
export interface ArticleDraft {
  angle: string;
  title: string;
  meta_description: string;
  slug: string;
  body: string;
  sources_cited: string[];
}

// Critique and scoring
export interface CritiqueScore {
  dimension: string;
  score: number;
  feedback: string;
  must_fix: boolean;
}

export interface MedicalCritique {
  claims_found: number;
  claims_verified: number;
  flagged_claims: { claim: string; issue: string; severity: "low" | "medium" | "high" }[];
  missing_disclaimers: string[];
  overall_accuracy: number;
  approved: boolean;
  revision_required: string[];
}

export interface EditorialCritique {
  scores: {
    clarity: CritiqueScore;
    voice: CritiqueScore;
    structure: CritiqueScore;
    engagement: CritiqueScore;
    seo: CritiqueScore;
  };
  overall_score: number;
  approved: boolean;
  revision_required: string[];
  specific_edits: { location: string; current: string; suggested: string }[];
}

// Final article
export interface FinalArticle {
  title: string;
  meta_description: string;
  slug: string;
  body: string;
  sources: string[];
  internal_links: { anchor: string; slug: string }[];
  schema_markup: object;
  quality_score: number;
  iterations: number;
  total_tokens?: number;
}

// Pipeline state (passed through orchestrator)
export interface PipelineState {
  keyword: Keyword;
  status: "researching" | "synthesizing" | "drafting" | "critiquing" | "revising" | "finalizing" | "complete" | "failed";

  // Research phase
  seoResearch?: SEOResearch;
  medicalResearch?: MedicalResearch;
  competitorResearch?: CompetitorResearch;
  synthesizedResearch?: SynthesizedResearch;

  // Drafting phase
  drafts?: ArticleDraft[];
  selectedDraft?: ArticleDraft;

  // Critique phase
  medicalCritique?: MedicalCritique;
  editorialCritique?: EditorialCritique;

  // Revision tracking
  currentDraft?: ArticleDraft;
  revisionCount: number;
  maxRevisions: number;

  // Final output
  finalArticle?: FinalArticle;

  // Metadata
  startedAt: Date;
  completedAt?: Date;
  errors: string[];
  log: string[];
}

// Agent interface
export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  reasoning?: string;
  usage?: {
    total_tokens: number;
  };
}
