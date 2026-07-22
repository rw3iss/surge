-- Block style: font-family (a font customId from the Font manager). The cms
-- editor has always offered this, but it was never persisted for saved style
-- TEMPLATES (only inline block styles, which ride JSONB) — a silent data loss.
ALTER TABLE block_styles ADD COLUMN IF NOT EXISTS font_family VARCHAR(100);
