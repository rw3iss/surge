-- Per-question rendered width: 'full' (100%, default) or 'half' (50% of the row).
-- Existing questions fall back to 'full'.

ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS width VARCHAR(8) NOT NULL DEFAULT 'full';
