-- Campaign donation-provider selector + GiveButter mapping. All nullable/defaulted
-- so existing rows are unaffected and the columns are harmless when the GiveButter
-- plugin is absent. `donation_provider` = which system collects donations for this
-- campaign: 'internal' (Stripe, default) or 'givebutter'. The GiveButter numeric id
-- + 6-char widget code are stored when the campaign is linked/created in GiveButter.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS donation_provider VARCHAR(16) NOT NULL DEFAULT 'internal';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS givebutter_campaign_id BIGINT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS givebutter_campaign_code VARCHAR(16);
