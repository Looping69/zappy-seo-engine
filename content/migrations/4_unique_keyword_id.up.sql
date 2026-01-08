-- Add unique constraint to prevent duplicate content records for the same keyword
ALTER TABLE content_records ADD CONSTRAINT unique_keyword_id UNIQUE (keyword_id);
