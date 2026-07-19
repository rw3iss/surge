-- Per-question field presentation config.
--   placeholder   — text-type inputs (text/textarea/email/number); empty = none.
--   rows          — textarea default visible rows (null → renderer default 4).
--   allow_resize  — textarea user-resizable (default true).
--   max_height    — textarea max resize height, any CSS length (null = unbounded).

ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS placeholder VARCHAR(255);
ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS "rows" INTEGER;
ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS allow_resize BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS max_height VARCHAR(20);
