-- @feature shop

CREATE TABLE IF NOT EXISTS shop_product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES shop_variants(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_product_media_product_id ON shop_product_media (product_id);
