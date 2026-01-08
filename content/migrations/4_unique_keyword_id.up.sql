-- Cleanup: Remove all but the latest record for each keyword_id to allow unique constraint
DELETE FROM content_records a USING content_records b
WHERE a.id < b.id AND a.keyword_id = b.keyword_id;

-- Add unique constraint to prevent duplicate content records for the same keyword
ALTER TABLE content_records ADD CONSTRAINT unique_keyword_id UNIQUE (keyword_id);
