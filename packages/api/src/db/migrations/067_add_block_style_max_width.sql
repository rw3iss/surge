-- Max-width for block style templates (inline custom styles ride in JSONB).
ALTER TABLE block_styles ADD COLUMN IF NOT EXISTS max_width VARCHAR(100);
