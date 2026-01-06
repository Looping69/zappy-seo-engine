CREATE TABLE content_records (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER, -- Reference to keywords service ID
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    slug TEXT NOT NULL,
    meta_description TEXT,
    quality_score DECIMAL(3, 1),
    sanity_id TEXT,
    iterations INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_logs (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER,
    percent INTEGER,
    step TEXT,
    log_line TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
