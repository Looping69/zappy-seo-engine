CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    keyword TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    search_volume INTEGER,
    difficulty INTEGER,
    intent TEXT,
    cluster TEXT,
    priority INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
