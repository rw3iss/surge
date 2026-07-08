-- @feature shop

-- ≤3 options per product enforced in the application layer.
CREATE TABLE IF NOT EXISTS shop_product_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_product_options_product_id ON shop_product_options (product_id);
