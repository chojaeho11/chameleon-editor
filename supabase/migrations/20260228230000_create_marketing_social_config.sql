-- marketing_social_config: stores API credentials for social media platforms
CREATE TABLE IF NOT EXISTS public.marketing_social_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform text NOT NULL UNIQUE,
    config jsonb NOT NULL DEFAULT '{}',
    enabled boolean DEFAULT false,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_social_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_social_config' AND policyname='marketing_social_config_admin') THEN
    CREATE POLICY marketing_social_config_admin ON public.marketing_social_config FOR ALL USING (public.is_admin());
  END IF;
END $$;
