-- @feature shop

CREATE TABLE IF NOT EXISTS shop_option_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id UUID NOT NULL REFERENCES shop_product_options(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    position INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shop_option_values_option_id ON shop_option_values (option_id);
