import Airtable from "airtable";
import "dotenv/config";
import { callAIJSON } from "./utils/ai.js";

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID!);

async function seedKeywords(topic: string) {
    console.log(`\n🔍 Researching keywords for: "${topic}"...`);

    const prompt = `Generate a list of 10 high-value, long-tail SEO keywords for a medical telehealth company related to the topic: "${topic}".
  
  Focus on:
  - Intent: informational (how to, vs, what is)
  - Search volume: likely high
  - Medical relevance: specific conditions, treatments, or side effects
  
  Output JSON only:
  {
    "keywords": [
      {
        "keyword": "clinically accurate full keyword",
        "searchVolume": 1500,
        "difficulty": 45,
        "intent": "informational",
        "cluster": "sub-topic name"
      }
    ]
  }`;

    try {
        const result = await callAIJSON<{ keywords: any[] }>(prompt, {
            systemPrompt: "You are an expert SEO strategist for a medical company."
        });

        console.log(`✨ Generated ${result.keywords.length} keywords. Populating Airtable...`);

        for (const kw of result.keywords) {
            await base("Keywords").create({
                "Keyword": kw.keyword,
                "Status": "queued",
                "Search Volume": kw.searchVolume,
                "Difficulty": kw.difficulty,
                "Intent": kw.intent,
                "Cluster": kw.cluster,
                "Priority": 3
            });
            console.log(`  ✓ Added: ${kw.keyword}`);
        }

        console.log("\n✅ Seeding complete. You can now run a batch generation.");
    } catch (error) {
        console.error("❌ Seeding failed:", error);
    }
}

const topic = process.argv[2];
if (!topic) {
    console.error("Please provide a topic as an argument.");
    process.exit(1);
}

seedKeywords(topic);
