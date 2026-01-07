CREATE TABLE debug_logs (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(20) NOT NULL,
    source VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB
);

CREATE INDEX idx_debug_logs_keyword ON debug_logs(keyword_id);
CREATE INDEX idx_debug_logs_ts ON debug_logs(timestamp DESC);
