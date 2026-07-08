-- @feature shop

CREATE TABLE IF NOT EXISTS shop_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    parent_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL,
    description TEXT,
    image_id UUID REFERENCES media(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_categories_slug ON shop_categories (slug);
CREATE INDEX IF NOT EXISTS idx_shop_categories_parent_id ON shop_categories (parent_id);

CREATE OR REPLACE FUNCTION shop_categories_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_categories_updated_at ON shop_categories;
CREATE TRIGGER trg_shop_categories_updated_at
    BEFORE UPDATE ON shop_categories
    FOR EACH ROW EXECUTE FUNCTION shop_categories_updated_at();

CREATE TABLE IF NOT EXISTS shop_product_categories (
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES shop_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_product_categories_category_id ON shop_product_categories (category_id);
