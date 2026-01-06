import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = new SQLDatabase("keywords", {
    migrations: "./migrations",
});

// Data types
export interface Keyword {
    id: number;
    keyword: string;
    status: string;
    search_volume: number;
    difficulty: number;
    intent: string;
    cluster: string;
}

// Request param interfaces
export interface IdParams {
    id: number;
}

export interface UpdateStatusParams {
    id: number;
    status: string;
}

export interface AddKeywordParams {
    keyword: string;
    search_volume: number;
    difficulty: number;
    intent: string;
    cluster: string;
}

export interface SeedParams {
    topic: string;
}

// Response interfaces
export interface KeywordsListResponse {
    keywords: Keyword[];
}

export interface SeedResponse {
    count: number;
}

// Get queued keywords for batch processing
export const getQueued = api(
    { expose: true, method: "GET", path: "/keywords/queued" },
    async (): Promise<KeywordsListResponse> => {
        const rows = db.query`
            SELECT id, keyword, status, search_volume, difficulty, intent, cluster
            FROM keywords
            WHERE status = 'queued'
            ORDER BY priority DESC, id ASC
            LIMIT 10
        `;
        const keywords: Keyword[] = [];
        for await (const row of rows) {
            keywords.push(row as Keyword);
        }
        return { keywords };
    }
);

// Update keyword status
export const updateStatus = api(
    { expose: true, method: "POST", path: "/keywords/:id/status" },
    async ({ id, status }: UpdateStatusParams): Promise<void> => {
        await db.exec`
            UPDATE keywords SET status = ${status} WHERE id = ${id}
        `;
    }
);

// Get keyword by ID
export const getById = api(
    { expose: true, method: "GET", path: "/keywords/:id" },
    async ({ id }: IdParams): Promise<Keyword> => {
        const row = await db.queryRow`
            SELECT id, keyword, status, search_volume, difficulty, intent, cluster
            FROM keywords
            WHERE id = ${id}
        `;
        if (!row) throw new Error("Keyword not found");
        return row as Keyword;
    }
);

// Add new keyword
export const add = api(
    { expose: true, method: "POST", path: "/keywords" },
    async (params: AddKeywordParams): Promise<Keyword> => {
        const row = await db.queryRow`
            INSERT INTO keywords (keyword, search_volume, difficulty, intent, cluster, status)
            VALUES (${params.keyword}, ${params.search_volume}, ${params.difficulty}, ${params.intent}, ${params.cluster}, 'queued')
            RETURNING id, keyword, status, search_volume, difficulty, intent, cluster
        `;
        if (!row) throw new Error("Failed to insert keyword");
        return row as Keyword;
    }
);

// Seed keywords from a topic (simplified - no AI call for bootstrap)
export const seed = api(
    { expose: true, method: "POST", path: "/keywords/seed" },
    async (params: SeedParams): Promise<SeedResponse> => {
        // Simplified for bootstrap - add a sample keyword
        await db.exec`
            INSERT INTO keywords (keyword, search_volume, difficulty, intent, cluster, status)
            VALUES (${params.topic + ' guide'}, 1000, 50, 'informational', ${params.topic}, 'queued')
        `;
        return { count: 1 };
    }
);

// List all keywords (for the dashboard)
export const list = api(
    { expose: true, method: "GET", path: "/keywords" },
    async (): Promise<KeywordsListResponse> => {
        const rows = db.query`
            SELECT id, keyword, status, search_volume, difficulty, intent, cluster
            FROM keywords
            ORDER BY created_at DESC
        `;
        const keywords: Keyword[] = [];
        for await (const row of rows) {
            keywords.push(row as Keyword);
        }
        return { keywords };
    }
);
