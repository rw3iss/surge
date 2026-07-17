-- Per-page / per-post header position ("static" vs "float").
--
-- The Site Header settings gain a "Header Position" default (replacing the
-- old "Float header above content" boolean). A page or post can override it:
--   NULL  → inherit the site default (Site Header → Header Position)
--   'static' → header sits at the top, content below it
--   'float'  → header floats (overlays) above the content

ALTER TABLE pages ADD COLUMN IF NOT EXISTS header_position VARCHAR(16);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS header_position VARCHAR(16);
