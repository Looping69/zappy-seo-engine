-- Add direction column for content generation preset
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS direction VARCHAR(50) DEFAULT 'balanced';
