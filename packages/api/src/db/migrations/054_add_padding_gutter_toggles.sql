-- Per-page / per-post layout padding toggles.
--
-- The Appearance → Layout settings gain a "Page Padding" and "Post
-- Padding" value (top/bottom by default; the gutter handles left/right).
-- Each page/post opts in independently:
--   apply_page_padding / apply_post_padding → vertical padding
--   apply_site_gutter                       → left/right gutter
--
-- All default true so existing content keeps applying the gutter (and
-- picks up the new vertical padding once an operator sets a value —
-- which defaults to 0, so nothing shifts until configured).

ALTER TABLE pages ADD COLUMN IF NOT EXISTS apply_page_padding BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS apply_site_gutter  BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS apply_post_padding BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS apply_site_gutter  BOOLEAN NOT NULL DEFAULT true;
