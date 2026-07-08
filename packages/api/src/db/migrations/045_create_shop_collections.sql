-- @feature shop

CREATE TABLE IF NOT EXISTS shop_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image_id UUID REFERENCES media(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_collections_slug ON shop_collections (slug);

CREATE OR REPLACE FUNCTION shop_collections_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_collections_updated_at ON shop_collections;
CREATE TRIGGER trg_shop_collections_updated_at
    BEFORE UPDATE ON shop_collections
    FOR EACH ROW EXECUTE FUNCTION shop_collections_updated_at();

CREATE TABLE IF NOT EXISTS shop_collection_products (
    collection_id UUID NOT NULL REFERENCES shop_collections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_collection_products_product_id ON shop_collection_products (product_id);
