import { api } from "encore.dev/api";
import { Topic, Subscription } from "encore.dev/pubsub";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { keywords } from "~encore/clients";
import { ContentOrchestrator } from "./orchestrator.js";

const db = new SQLDatabase("content", {
    migrations: "./migrations",
});

// ============ Types ============

export interface GenerateParams {
    keywordId: number;
    keyword: string;
}

export interface KeywordIdParams {
    keywordId: number;
}

export interface GenerationResponse {
    success: boolean;
}

export interface UpdateArticleParams {
    id: number;
    title: string;
    body: string;
    meta_description: string;
}

export interface BatchResponse {
    count: number;
}

export interface LogsResponse {
    logs: LogEntry[];
}

export interface LogEntry {
    percent: number;
    step: string;
    log_line: string | null;
    created_at: Date;
}

export interface ContentRecord {
    id: number;
    keyword_id: number;
    title: string;
    body: string;
    slug: string;
    meta_description: string | null;
    quality_score: number | null;
    iterations: number | null;
    total_tokens: number | null;
    created_at: Date;
}

export interface ContentListResponse {
    records: ContentRecord[];
}

export interface DashboardStats {
    totalKeywords: number;
    queuedKeywords: number;
    generatingKeywords: number;
    publishedKeywords: number;
    errorKeywords: number;
    totalContent: number;
    avgQualityScore: number;
}

// ============ PubSub Topic ============

export const generateTopic = new Topic<GenerateParams>("generate-article", {
    deliveryGuarantee: "at-least-once",
});

// ============ API Endpoints ============

// Start generation for a single keyword
export const startGeneration = api(
    { expose: true, method: "POST", path: "/content/generate/:keywordId" },
    async ({ keywordId }: KeywordIdParams): Promise<GenerationResponse> => {
        // Clear old logs for this keyword
        await db.exec`DELETE FROM generation_logs WHERE keyword_id = ${keywordId}`;

        // Fetch keyword details using cross-service call
        const kw = await keywords.getById({ id: keywordId });

        // Publish to background processing queue
        await generateTopic.publish({ keywordId, keyword: kw.keyword });

        // Update status
        await keywords.updateStatus({ id: keywordId, status: "generating" });

        return { success: true };
    }
);

// Start batch generation for all queued keywords
export const startBatch = api(
    { expose: true, method: "POST", path: "/content/batch" },
    async (): Promise<BatchResponse> => {
        const { keywords: queued } = await keywords.getQueued();

        for (const kw of queued) {
            await generateTopic.publish({ keywordId: kw.id, keyword: kw.keyword });
            await keywords.updateStatus({ id: kw.id, status: "generating" });
        }

        return { count: queued.length };
    }
);

// Get logs for a specific keyword
export const getLogs = api(
    { expose: true, method: "GET", path: "/content/logs/:keywordId" },
    async ({ keywordId }: KeywordIdParams): Promise<LogsResponse> => {
        const rows = db.query`
            SELECT percent, step, log_line, created_at 
            FROM generation_logs 
            WHERE keyword_id = ${keywordId} 
            ORDER BY id ASC
        `;
        const logs: LogEntry[] = [];
        for await (const row of rows) {
            logs.push(row as LogEntry);
        }
        return { logs };
    }
);

// List all content records
export const listContent = api(
    { expose: true, method: "GET", path: "/content" },
    async (): Promise<ContentListResponse> => {
        const rows = db.query`
            SELECT id, keyword_id, title, body, slug, meta_description, quality_score, iterations, total_tokens, created_at
            FROM content_records
            ORDER BY created_at DESC
        `;
        const records: ContentRecord[] = [];
        for await (const row of rows) {
            records.push(row as ContentRecord);
        }
        return { records };
    }
);

// Update a content record
export const updateArticle = api(
    { expose: true, method: "PATCH", path: "/content/:id" },
    async ({ id, title, body, meta_description }: UpdateArticleParams): Promise<GenerationResponse> => {
        await db.exec`
            UPDATE content_records
            SET title = ${title},
                body = ${body},
                meta_description = ${meta_description}
            WHERE id = ${id}
        `;
        return { success: true };
    }
);

// Get dashboard stats
export const getStats = api(
    { expose: true, method: "GET", path: "/content/stats" },
    async (): Promise<DashboardStats> => {
        // Get keyword stats from keywords service
        const { keywords: allKeywords } = await keywords.list();

        const stats = {
            totalKeywords: allKeywords.length,
            queuedKeywords: allKeywords.filter(k => k.status === "queued").length,
            generatingKeywords: allKeywords.filter(k => k.status === "generating").length,
            publishedKeywords: allKeywords.filter(k => k.status === "published").length,
            errorKeywords: allKeywords.filter(k => k.status === "error").length,
            totalContent: 0,
            avgQualityScore: 0
        };

        // Get content stats - use separate queries to avoid type issues
        let contentCount = 0;
        let avgScore = 0;

        const countRows = db.query`SELECT COUNT(*) as cnt FROM content_records`;
        for await (const row of countRows) {
            contentCount = Number((row as { cnt: bigint }).cnt) || 0;
        }

        const avgRows = db.query`SELECT AVG(quality_score) as avg_score FROM content_records WHERE quality_score IS NOT NULL`;
        for await (const row of avgRows) {
            const r = row as { avg_score: string | null };
            avgScore = r.avg_score ? parseFloat(parseFloat(r.avg_score).toFixed(1)) : 0;
        }

        stats.totalContent = contentCount;
        stats.avgQualityScore = avgScore;

        return stats;
    }
);

// ============ Background Subscriber with Full AI Pipeline ============

const _ = new Subscription(generateTopic, "run-content-generation", {
    handler: async (params: GenerateParams) => {
        const { keywordId, keyword } = params;

        // Helper to save progress logs
        const logProgress = async (percent: number, step: string) => {
            await db.exec`
                INSERT INTO generation_logs (keyword_id, percent, step)
                VALUES (${keywordId}, ${percent}, ${step})
            `;
        };

        try {
            await logProgress(5, "Initializing AI pipeline...");

            // Create orchestrator with database logging
            const orchestrator = new ContentOrchestrator(
                { id: keywordId, keyword },
                { verbose: true, maxRevisions: 3 }
            );

            // Override logProgress to save to database
            orchestrator.logProgress = logProgress;

            // Run the full multi-agent pipeline
            const result = await orchestrator.run();

            if (result.success && result.article) {
                // Save the generated article
                await db.exec`
                    INSERT INTO content_records (
                        keyword_id, title, body, slug, meta_description, 
                        quality_score, iterations, total_tokens
                    )
                    VALUES (
                        ${keywordId},
                        ${result.article.title},
                        ${result.article.body},
                        ${result.article.slug},
                        ${result.article.meta_description},
                        ${result.article.quality_score},
                        ${result.article.iterations},
                        ${result.article.total_tokens || 0}
                    )
                `;

                await logProgress(100, "Content generation complete!");
                await keywords.updateStatus({ id: keywordId, status: "published" });
            } else {
                // Pipeline failed
                const errorMsg = result.state.errors.join("; ") || "Unknown error";
                await logProgress(-1, `Pipeline failed: ${errorMsg}`);
                await keywords.updateStatus({ id: keywordId, status: "error" });
            }

        } catch (error) {
            // Unexpected error
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logProgress(-1, `Error: ${errorMessage}`);
            await keywords.updateStatus({ id: keywordId, status: "error" });
        }
    },
});
