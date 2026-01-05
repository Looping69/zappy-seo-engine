import Airtable from "airtable";
import { createClient } from "@sanity/client";
import "dotenv/config";
import { ContentOrchestrator } from "./orchestrator/index.js";
import type { Keyword, FinalArticle } from "./types.js";

// ============================================================================
// EXTERNAL CONNECTIONS
// ============================================================================

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID!);

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET || "production",
  token: process.env.SANITY_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

// ============================================================================
// AIRTABLE HELPERS
// ============================================================================

async function getQueuedKeywords(limit = 5): Promise<Keyword[]> {
  const records = await base("Keywords")
    .select({
      filterByFormula: '{Status} = "queued"',
      maxRecords: limit,
      sort: [{ field: "Priority", direction: "desc" }],
    })
    .firstPage();

  return records.map((r) => ({
    id: r.id,
    keyword: r.get("Keyword") as string,
    searchVolume: r.get("Search Volume") as number,
    difficulty: r.get("Difficulty") as number,
    intent: r.get("Intent") as string,
    cluster: r.get("Cluster") as string,
  }));
}

async function updateKeywordStatus(id: string, status: string): Promise<void> {
  if (id === "manual") return;
  await base("Keywords").update(id, { Status: status });
}

async function createContentRecord(
  keywordId: string,
  article: FinalArticle,
  sanityId: string
): Promise<string> {
  const fields: Record<string, unknown> = {
    Title: article.title,
    Slug: article.slug,
    Body: article.body,
    "Meta Description": article.meta_description,
    "Quality Score": article.quality_score,
    "Iterations": article.iterations,
    Status: article.quality_score >= 7 ? "draft" : "review",
    "Sanity ID": sanityId,
  };

  if (keywordId !== "manual") {
    fields.Keyword = [keywordId];
  }

  const record = await base("Content").create(fields);
  return record.id;
}

// ============================================================================
// SANITY PUBLISHING
// ============================================================================

async function pushToSanity(article: FinalArticle, keyword: string): Promise<string> {
  // ⚠️ ADJUST THIS TO MATCH YOUR SANITY SCHEMA
  const doc = {
    _type: "post",
    title: article.title,
    slug: { _type: "slug", current: article.slug },
    metaDescription: article.meta_description,
    body: article.body,
    seoKeyword: keyword,
    qualityScore: article.quality_score,
    // Add schema markup as JSON if your schema supports it
    // schemaMarkup: article.schema_markup,
  };

  const result = await sanity.create(doc);
  return result._id;
}

// ============================================================================
// MAIN
// ============================================================================

async function generateArticle(keyword: Keyword): Promise<boolean> {
  console.log(`\n${"█".repeat(60)}`);
  console.log(`  STARTING: "${keyword.keyword}"`);
  console.log(`${"█".repeat(60)}`);

  try {
    // Update status
    await updateKeywordStatus(keyword.id, "generating");

    // Run the multi-agent orchestrator
    const orchestrator = new ContentOrchestrator(keyword, {
      verbose: true,
      maxRevisions: 3
    });

    const result = await orchestrator.run();

    if (!result.success || !result.article) {
      console.error("Generation failed");
      await updateKeywordStatus(keyword.id, "error");
      return false;
    }

    // Push to Sanity
    console.log("  📤 Publishing to Sanity...");
    const sanityId = await pushToSanity(result.article, keyword.keyword);
    console.log(`  ✓ Sanity ID: ${sanityId}`);

    // Save to Airtable
    console.log("  📋 Saving to Airtable...");
    await createContentRecord(keyword.id, result.article, sanityId);

    // Update keyword status
    const finalStatus = result.article.quality_score >= 7 ? "published" : "review";
    await updateKeywordStatus(keyword.id, finalStatus);

    console.log(`  ✅ Complete: ${finalStatus}`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error: ${error}`);
    await updateKeywordStatus(keyword.id, "error");
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes("--test");
  const isBatch = args.includes("--batch");
  const singleKeyword = args.find((a) => !a.startsWith("--"));

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         ZAPPY MULTI-AGENT CONTENT ENGINE v2.0                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Agents: SEO Research, Medical Research, Competitor Research,   ║
║          Synthesizer, 3x Writers, Judge, Medical Reviewer,       ║
║          Editorial Reviewer, Revision Writer, SEO Finalizer      ║
╚══════════════════════════════════════════════════════════════════╝
`);

  if (isTest) {
    // Test mode - just run with a sample keyword, no Airtable
    console.log("MODE: Test (no Airtable/Sanity)\n");
    const testKeyword: Keyword = {
      id: "test",
      keyword: singleKeyword || "semaglutide weight loss results"
    };
    
    const orchestrator = new ContentOrchestrator(testKeyword, { verbose: true });
    const result = await orchestrator.run();
    
    if (result.success && result.article) {
      console.log("\n📄 GENERATED ARTICLE:\n");
      console.log(`Title: ${result.article.title}`);
      console.log(`Meta: ${result.article.meta_description}`);
      console.log(`Quality: ${result.article.quality_score}/10`);
      console.log(`Iterations: ${result.article.iterations}`);
      console.log(`\n--- BODY ---\n`);
      console.log(result.article.body.substring(0, 2000) + "...");
    }
    return;
  }

  if (singleKeyword) {
    // Single keyword mode
    console.log(`MODE: Single keyword\n`);
    await generateArticle({
      id: "manual",
      keyword: singleKeyword
    });
  } else {
    // Batch mode from Airtable
    const limit = isBatch ? 10 : 5;
    console.log(`MODE: Batch (${limit} keywords from Airtable)\n`);
    
    const keywords = await getQueuedKeywords(limit);

    if (keywords.length === 0) {
      console.log("⚠️  No keywords queued.");
      console.log('   Add keywords to Airtable with Status = "queued"\n');
      return;
    }

    console.log(`Found ${keywords.length} keywords to process\n`);

    for (const kw of keywords) {
      await generateArticle(kw);
      // Delay between articles
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                         ALL COMPLETE                             ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
