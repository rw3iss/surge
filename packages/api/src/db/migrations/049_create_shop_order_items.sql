-- @feature shop

CREATE TABLE IF NOT EXISTS shop_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES shop_products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES shop_variants(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    variant_title VARCHAR(255),
    sku VARCHAR(100),
    unit_price_cents INT NOT NULL,
    quantity INT NOT NULL,
    subtotal_cents INT NOT NULL,
    is_digital BOOLEAN NOT NULL DEFAULT FALSE,
    download_token VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON shop_order_items (order_id);
