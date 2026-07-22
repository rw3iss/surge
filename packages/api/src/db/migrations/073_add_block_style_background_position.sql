-- Block style: background-position for the background image (e.g. 'center',
-- 'center center', 'center 100%', 'top left'). Inline custom styles ride JSONB.
ALTER TABLE block_styles ADD COLUMN IF NOT EXISTS background_position VARCHAR(100);
