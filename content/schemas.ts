/**
 * Shared Schemas for all AI Agents
 * 
 * These schemas are used to constrain Gemini's JSON output.
 * All schemas should use simple structures to minimize parse errors.
 * 
 * IMPORTANT: Keep string fields short where possible to reduce
 * the chance of unescaped quotes corrupting JSON.
 */

// ============================================================================
// RESEARCH SCHEMAS
// ============================================================================

export const SEO_RESEARCH_SCHEMA = {
    type: "OBJECT",
    properties: {
        search_intent: { type: "STRING", description: "One of: informational, transactional, navigational" },
        serp_features: { type: "ARRAY", items: { type: "STRING" }, description: "SERP features to target (max 5)" },
        top_ranking_factors: { type: "ARRAY", items: { type: "STRING" }, description: "Key ranking factors (max 5)" },
        keyword_variations: { type: "ARRAY", items: { type: "STRING" }, description: "Related keywords (max 10)" },
        recommended_word_count: { type: "INTEGER", description: "Target word count" },
        content_format: { type: "STRING", description: "Recommended format (e.g., guide, listicle, how-to)" }
    },
    required: ["search_intent", "serp_features", "top_ranking_factors", "keyword_variations", "recommended_word_count", "content_format"]
};

export const MEDICAL_RESEARCH_SCHEMA = {
    type: "OBJECT",
    properties: {
        key_facts: { type: "ARRAY", items: { type: "STRING" }, description: "Key medical facts (max 10, keep each under 100 chars)" },
        mechanisms: { type: "ARRAY", items: { type: "STRING" }, description: "Mechanisms of action (max 5)" },
        contraindications: { type: "ARRAY", items: { type: "STRING" }, description: "Contraindications (max 5)" },
        side_effects: { type: "ARRAY", items: { type: "STRING" }, description: "Side effects (max 10)" },
        dosing_info: { type: "ARRAY", items: { type: "STRING" }, description: "Dosing information (max 3)" },
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
            },
            description: "Source references (max 5)"
        },
        accuracy_requirements: { type: "ARRAY", items: { type: "STRING" }, description: "Accuracy requirements (max 5)" }
    },
    required: ["key_facts", "mechanisms", "contraindications", "side_effects", "sources", "accuracy_requirements"]
};

export const COMPETITOR_RESEARCH_SCHEMA = {
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
            },
            description: "Top competitor articles (max 3)"
        },
        content_gaps: { type: "ARRAY", items: { type: "STRING" }, description: "Content gaps to exploit (max 5)" },
        unique_angles: { type: "ARRAY", items: { type: "STRING" }, description: "Unique angles to consider (max 5)" },
        questions_unanswered: { type: "ARRAY", items: { type: "STRING" }, description: "Unanswered questions (max 5)" }
    },
    required: ["top_articles", "content_gaps", "unique_angles", "questions_unanswered"]
};

// ============================================================================
// SYNTHESIZER SCHEMA
// ============================================================================

export const SYNTHESIZED_RESEARCH_SCHEMA = {
    type: "OBJECT",
    properties: {
        primary_angle: { type: "STRING", description: "Primary content angle (under 100 chars)" },
        target_audience: { type: "STRING", description: "Target audience description" },
        key_questions: { type: "ARRAY", items: { type: "STRING" }, description: "Key questions to answer (max 7)" },
        must_include: { type: "ARRAY", items: { type: "STRING" }, description: "Must-include elements (max 10)" },
        differentiation: { type: "STRING", description: "How to differentiate (under 150 chars)" },
        structure: { type: "ARRAY", items: { type: "STRING" }, description: "Article structure/sections (max 8)" },
        word_count: { type: "INTEGER", description: "Target word count" }
    },
    required: ["primary_angle", "target_audience", "key_questions", "must_include", "differentiation", "structure", "word_count"]
};

// ============================================================================
// ARTICLE SCHEMA (Writers & Revision)
// ============================================================================

export const ARTICLE_SCHEMA = {
    type: "OBJECT",
    properties: {
        angle: { type: "STRING", description: "Article angle (e.g., clinical, empathetic)" },
        title: { type: "STRING", description: "SEO title under 60 chars" },
        meta_description: { type: "STRING", description: "Meta description under 155 chars" },
        slug: { type: "STRING", description: "URL-friendly slug" },
        body: { type: "STRING", description: "Full article body in markdown" },
        sources_cited: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Sources cited (max 5)"
        }
    },
    required: ["angle", "title", "meta_description", "slug", "body"]
};

// ============================================================================
// JUDGE SCHEMA (Simplified to prevent JSON errors)
// ============================================================================

export const JUDGE_DECISION_SCHEMA = {
    type: "OBJECT",
    properties: {
        winner: { type: "INTEGER", description: "0-indexed winning draft number" },
        reasoning: { type: "STRING", description: "Brief explanation (under 300 chars)" },
        scores: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    draft_index: { type: "INTEGER" },
                    overall: { type: "NUMBER", description: "Score 1-10" },
                    strengths: { type: "ARRAY", items: { type: "STRING" }, description: "Max 3 strengths, each under 50 chars" },
                    weaknesses: { type: "ARRAY", items: { type: "STRING" }, description: "Max 3 weaknesses, each under 50 chars" }
                },
                required: ["draft_index", "overall", "strengths", "weaknesses"]
            },
            description: "Scores for each draft"
        },
        synthesis_opportunity: { type: "BOOLEAN", description: "Whether combining drafts would be beneficial" },
        elements_to_combine: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    from_draft: { type: "INTEGER" },
                    element: { type: "STRING", description: "Element to combine (under 100 chars)" }
                },
                required: ["from_draft", "element"]
            },
            description: "Elements to combine if synthesis_opportunity is true"
        }
    },
    required: ["winner", "reasoning", "scores", "synthesis_opportunity"]
};

// ============================================================================
// CRITIC SCHEMAS
// ============================================================================

export const MEDICAL_CRITIQUE_SCHEMA = {
    type: "OBJECT",
    properties: {
        claims_found: { type: "INTEGER" },
        claims_verified: { type: "INTEGER" },
        flagged_claims: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    claim: { type: "STRING", description: "The claim under 100 chars" },
                    issue: { type: "STRING", description: "The issue under 100 chars" },
                    severity: { type: "STRING", description: "low, medium, or high" }
                },
                required: ["claim", "issue", "severity"]
            },
            description: "Max 5 flagged claims"
        },
        missing_disclaimers: { type: "ARRAY", items: { type: "STRING" }, description: "Max 3" },
        overall_accuracy: { type: "NUMBER", description: "Score 1-10" },
        approved: { type: "BOOLEAN" },
        revision_required: { type: "ARRAY", items: { type: "STRING" }, description: "Max 5 revisions, each under 100 chars" }
    },
    required: ["claims_found", "claims_verified", "overall_accuracy", "approved", "revision_required"]
};

export const EDITORIAL_CRITIQUE_SCHEMA = {
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
                        feedback: { type: "STRING", description: "Under 100 chars" },
                        must_fix: { type: "BOOLEAN" }
                    },
                    required: ["dimension", "score", "feedback", "must_fix"]
                },
                voice: {
                    type: "OBJECT",
                    properties: {
                        dimension: { type: "STRING" },
                        score: { type: "NUMBER" },
                        feedback: { type: "STRING", description: "Under 100 chars" },
                        must_fix: { type: "BOOLEAN" }
                    },
                    required: ["dimension", "score", "feedback", "must_fix"]
                },
                structure: {
                    type: "OBJECT",
                    properties: {
                        dimension: { type: "STRING" },
                        score: { type: "NUMBER" },
                        feedback: { type: "STRING", description: "Under 100 chars" },
                        must_fix: { type: "BOOLEAN" }
                    },
                    required: ["dimension", "score", "feedback", "must_fix"]
                },
                engagement: {
                    type: "OBJECT",
                    properties: {
                        dimension: { type: "STRING" },
                        score: { type: "NUMBER" },
                        feedback: { type: "STRING", description: "Under 100 chars" },
                        must_fix: { type: "BOOLEAN" }
                    },
                    required: ["dimension", "score", "feedback", "must_fix"]
                },
                seo: {
                    type: "OBJECT",
                    properties: {
                        dimension: { type: "STRING" },
                        score: { type: "NUMBER" },
                        feedback: { type: "STRING", description: "Under 100 chars" },
                        must_fix: { type: "BOOLEAN" }
                    },
                    required: ["dimension", "score", "feedback", "must_fix"]
                }
            },
            required: ["clarity", "voice", "structure", "engagement", "seo"]
        },
        overall_score: { type: "NUMBER" },
        approved: { type: "BOOLEAN" },
        revision_required: { type: "ARRAY", items: { type: "STRING" }, description: "Max 5, each under 100 chars" },
        specific_edits: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    location: { type: "STRING" },
                    current: { type: "STRING", description: "Under 100 chars" },
                    suggested: { type: "STRING", description: "Under 100 chars" }
                },
                required: ["location", "current", "suggested"]
            },
            description: "Max 3 specific edits"
        }
    },
    required: ["scores", "overall_score", "approved", "revision_required"]
};

// ============================================================================
// SEO FINALIZER SCHEMA
// ============================================================================

export const SEO_FINAL_SCHEMA = {
    type: "OBJECT",
    properties: {
        title: { type: "STRING", description: "SEO-optimized title under 60 chars" },
        meta_description: { type: "STRING", description: "Meta description under 155 chars" },
        slug: { type: "STRING" },
        body: { type: "STRING", description: "Article with internal links added" },
        sources: { type: "ARRAY", items: { type: "STRING" } },
        internal_links: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    anchor: { type: "STRING" },
                    slug: { type: "STRING" }
                },
                required: ["anchor", "slug"]
            },
            description: "Max 4 internal links"
        },
        quality_score: { type: "NUMBER" },
        iterations: { type: "INTEGER" }
    },
    required: ["title", "meta_description", "slug", "body"]
};
