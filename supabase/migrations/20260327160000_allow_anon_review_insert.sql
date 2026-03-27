-- Allow anonymous (guest) review inserts
DROP POLICY IF EXISTS "product_reviews_insert_auth" ON public.product_reviews;
DROP POLICY IF EXISTS "product_reviews_insert_anon" ON public.product_reviews;

CREATE POLICY "product_reviews_insert_anon" ON public.product_reviews
  FOR INSERT WITH CHECK (true);
