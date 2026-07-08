-- @feature shop

CREATE TABLE IF NOT EXISTS shop_product_tags (
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY (product_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_shop_product_tags_tag ON shop_product_tags (tag);
