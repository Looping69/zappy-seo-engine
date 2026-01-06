import { callAIJSON } from "../utils/ai.js";
import type { ArticleDraft, FinalArticle, SEOResearch, AgentResult } from "../types.js";

const SEO_FINALIZER_SYSTEM = `You are an SEO specialist finalizing content for publication.
You optimize meta tags, add internal linking opportunities, and generate schema markup.
You make surgical improvements without changing the medical content.`;

export async function seoFinalizerAgent(
  draft: ArticleDraft,
  seoResearch: SEOResearch,
  existingContent?: { title: string; slug: string }[]
): Promise<AgentResult<FinalArticle>> {

  const internalLinksContext = existingContent
    ? `\nEXISTING CONTENT TO LINK TO:\n${existingContent.map(c => `- "${c.title}" (/${c.slug})`).join("\n")}`
    : "\nNo existing content provided for internal linking.";

  const prompt = `Finalize this article for SEO.

ARTICLE:
Title: ${draft.title}
Meta: ${draft.meta_description}
Slug: ${draft.slug}

Body:
${draft.body}

SEO REQUIREMENTS:
- Target intent: ${seoResearch.search_intent}
- SERP features to target: ${seoResearch.serp_features.join(", ")}
- Keywords to include: ${seoResearch.keyword_variations.join(", ")}
${internalLinksContext}

Tasks:
1. Optimize title (under 60 chars, keyword near front)
2. Perfect meta description (under 155 chars, compelling, includes keyword)
3. Identify 2-4 internal linking opportunities
4. Generate Article schema markup

Output JSON only:
{
  "title": "Optimized SEO title",
  "meta_description": "Compelling meta under 155 chars",
  "slug": "${draft.slug}",
  "body": "Article with internal links added naturally as markdown links",
  "sources": ${JSON.stringify(draft.sources_cited)},
  "internal_links": [
    {"anchor": "anchor text used", "slug": "target-page-slug"}
  ],
  "schema_markup": {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "...",
    "description": "...",
    "author": {
      "@type": "Organization",
      "name": "Zappy Health"
    },
    "publisher": {
      "@type": "Organization", 
      "name": "Zappy Health"
    },
    "datePublished": "${new Date().toISOString().split('T')[0]}",
    "medicalAudience": "Patient"
  },
  "quality_score": 8.5,
  "iterations": 1
}`;

  try {
    const res = await callAIJSON<FinalArticle>(prompt, {
      systemPrompt: SEO_FINALIZER_SYSTEM,
      maxTokens: 8000
    });
    return { success: true, data: res.data, usage: res.usage };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
