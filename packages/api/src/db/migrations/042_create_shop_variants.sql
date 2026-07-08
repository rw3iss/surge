-- @feature shop

CREATE TABLE IF NOT EXISTS shop_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    price_cents INT NOT NULL DEFAULT 0,
    compare_at_price_cents INT,
    inventory_qty INT NOT NULL DEFAULT 0,
    weight_grams INT,
    requires_shipping BOOLEAN NOT NULL DEFAULT TRUE,
    option1 VARCHAR(255),
    option2 VARCHAR(255),
    option3 VARCHAR(255),
    image_id UUID REFERENCES media(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, option1, option2, option3)
);

CREATE INDEX IF NOT EXISTS idx_shop_variants_product_id ON shop_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_shop_variants_sku ON shop_variants (sku);

CREATE OR REPLACE FUNCTION shop_variants_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_variants_updated_at ON shop_variants;
CREATE TRIGGER trg_shop_variants_updated_at
    BEFORE UPDATE ON shop_variants
    FOR EACH ROW EXECUTE FUNCTION shop_variants_updated_at();
