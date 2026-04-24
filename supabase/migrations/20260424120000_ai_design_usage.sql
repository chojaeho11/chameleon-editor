-- ============================================================
-- AI Design Generator — usage log for daily rate limiting
-- Guest: 3/day (by IP hash)
-- Logged-in free: 3/day (by user_id)
-- Logged-in PRO:  50/day (by user_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_design_usage (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_hash      text,
    prompt       text NOT NULL,
    image_url    text,
    created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON public.ai_design_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ip_day   ON public.ai_design_usage (ip_hash, created_at DESC);

ALTER TABLE public.ai_design_usage ENABLE ROW LEVEL SECURITY;
-- Edge function uses service role, so no policies needed for API writes.
-- Expose read-only to own user for "내 기록":
CREATE POLICY ai_usage_self_read ON public.ai_design_usage
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Storage bucket (public) for generated images
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read; only service role can write (default for non-authenticated inserts)
DROP POLICY IF EXISTS gen_img_public_read ON storage.objects;
CREATE POLICY gen_img_public_read ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'generated-images');
