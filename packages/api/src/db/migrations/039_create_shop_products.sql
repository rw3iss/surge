-- @feature shop

CREATE TABLE IF NOT EXISTS shop_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'physical' CHECK (type IN ('physical', 'digital')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    meta_title VARCHAR(255),
    meta_description TEXT,
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0,
    rating_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_slug ON shop_products (slug);
CREATE INDEX IF NOT EXISTS idx_shop_products_status ON shop_products (status);

CREATE OR REPLACE FUNCTION shop_products_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_products_updated_at ON shop_products;
CREATE TRIGGER trg_shop_products_updated_at
    BEFORE UPDATE ON shop_products
    FOR EACH ROW EXECUTE FUNCTION shop_products_updated_at();
