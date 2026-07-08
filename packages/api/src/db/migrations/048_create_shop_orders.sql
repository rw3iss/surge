-- @feature shop

CREATE TABLE IF NOT EXISTS shop_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal_cents INT NOT NULL DEFAULT 0,
    tax_cents INT NOT NULL DEFAULT 0,
    shipping_cents INT NOT NULL DEFAULT 0,
    discount_cents INT NOT NULL DEFAULT 0,
    total_cents INT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    shipping_address JSONB,
    billing_address JSONB,
    fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled')),
    tracking_number VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON shop_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders (status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_order_number ON shop_orders (order_number);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created_at ON shop_orders (created_at);

CREATE OR REPLACE FUNCTION shop_orders_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_orders_updated_at ON shop_orders;
CREATE TRIGGER trg_shop_orders_updated_at
    BEFORE UPDATE ON shop_orders
    FOR EACH ROW EXECUTE FUNCTION shop_orders_updated_at();
