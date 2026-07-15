-- Add the `editor` role: content-editing staff who can sign into the
-- admin and be attributed as a post author, but can't manage plugins,
-- settings, or users. Mirrors 012 (sysadmin). Idempotent.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'editor';
