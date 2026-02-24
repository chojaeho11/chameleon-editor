-- Create customer_uploads bucket for file-upload products
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer_uploads',
  'customer_uploads',
  true,
  52428800,  -- 50MB limit
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','application/pdf','image/tiff','image/bmp']
) ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload (anon users / customers)
CREATE POLICY "Allow public upload to customer_uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'customer_uploads');

-- Allow anyone to read uploaded files
CREATE POLICY "Allow public read from customer_uploads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'customer_uploads');
