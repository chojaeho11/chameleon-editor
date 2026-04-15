-- Raise file size limit on 'orders' bucket to 500MB for VIP quick-quote uploads
UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB
WHERE id = 'orders';
