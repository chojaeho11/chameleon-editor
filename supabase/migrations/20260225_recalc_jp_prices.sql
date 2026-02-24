-- Recalculate all JP prices: KRW * 0.1 = JPY (1000원 = 100엔)
-- Products
UPDATE admin_products SET price_jp = ROUND(price * 0.1) WHERE price > 0;

-- Addons (opt_8796 keyring hooks were manually set to 100, keep that logic: 1000*0.1=100 anyway)
UPDATE admin_addons SET price_jp = ROUND(price * 0.1) WHERE price > 0;
