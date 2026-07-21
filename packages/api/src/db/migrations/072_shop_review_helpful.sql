-- @feature shop
-- Per-(review, actor) helpful marks so a visitor can mark a review helpful only
-- once — deduped by user_id (logged in) OR ip_address (anonymous). Backs the
-- toggle behavior: an existing mark → un-mark (delete + decrement).

CREATE TABLE IF NOT EXISTS shop_review_helpful (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES shop_reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_review_helpful_review ON shop_review_helpful(review_id);
CREATE INDEX IF NOT EXISTS idx_shop_review_helpful_user ON shop_review_helpful(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_review_helpful_ip ON shop_review_helpful(ip_address);
