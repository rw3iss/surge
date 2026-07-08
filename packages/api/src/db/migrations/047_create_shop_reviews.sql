-- @feature shop

CREATE TABLE IF NOT EXISTS shop_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- references shop_orders(id); FK omitted here because shop_orders is created in 048.
    order_id UUID,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    body TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    helpful_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_reviews_product_id ON shop_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_status ON shop_reviews (status);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_user_id ON shop_reviews (user_id);

CREATE OR REPLACE FUNCTION shop_reviews_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_reviews_updated_at ON shop_reviews;
CREATE TRIGGER trg_shop_reviews_updated_at
    BEFORE UPDATE ON shop_reviews
    FOR EACH ROW EXECUTE FUNCTION shop_reviews_updated_at();
