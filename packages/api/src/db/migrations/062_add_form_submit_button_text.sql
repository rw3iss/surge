-- Customizable submit button label. NULL/empty falls back to 'Submit'.

ALTER TABLE forms ADD COLUMN IF NOT EXISTS submit_button_text VARCHAR(100);
