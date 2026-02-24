-- Set all keyring hook addon prices to ¥100 uniform
UPDATE admin_addons SET price_jp = 100 WHERE category_code = 'opt_8796';
