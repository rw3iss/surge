-- Form actions: each form performs one action on submit (submit | subscribe |
-- email) with action-specific settings in JSON, plus anti-double-submit
-- (per-render nonce) and an optional max-submission cap.

ALTER TABLE forms ADD COLUMN IF NOT EXISTS action VARCHAR(16) NOT NULL DEFAULT 'submit';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS action_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS max_submissions INTEGER;

-- Per-render idempotency token. A partial unique index makes the submission
-- insert idempotent for a given (form, nonce) while leaving legacy/nonce-less
-- rows unconstrained.
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS nonce VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS form_submissions_form_nonce_uniq
    ON form_submissions (form_id, nonce)
    WHERE nonce IS NOT NULL;
