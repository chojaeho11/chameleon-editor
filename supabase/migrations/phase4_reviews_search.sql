-- ═══════════════════════════════════════════════════════════════
-- Phase 4: Enhanced reviews + designer aggregated sub-ratings
-- Run in Supabase SQL Editor after Phase 3b.
-- ═══════════════════════════════════════════════════════════════
-- Adds three sub-rating fields (communication, quality, speed)
-- plus optional review images and a link back to the source gig.
-- The existing single `rating` column is kept as the overall average.

-- ──────────────────────────────────────────────────────────
-- 1) design_reviews extension
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.design_reviews
    ADD COLUMN IF NOT EXISTS gig_id uuid REFERENCES public.designer_gigs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS gig_tier text,
    ADD COLUMN IF NOT EXISTS communication_rating int,
    ADD COLUMN IF NOT EXISTS quality_rating int,
    ADD COLUMN IF NOT EXISTS speed_rating int,
    ADD COLUMN IF NOT EXISTS review_images jsonb DEFAULT '[]'::jsonb;

-- Constraints (sub-ratings must be in 1-5)
DO $$ BEGIN
    ALTER TABLE public.design_reviews
        ADD CONSTRAINT design_reviews_communication_range
        CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.design_reviews
        ADD CONSTRAINT design_reviews_quality_range
        CHECK (quality_rating IS NULL OR (quality_rating >= 1 AND quality_rating <= 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.design_reviews
        ADD CONSTRAINT design_reviews_speed_range
        CHECK (speed_rating IS NULL OR (speed_rating >= 1 AND speed_rating <= 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_design_reviews_designer
    ON public.design_reviews(designer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_reviews_gig
    ON public.design_reviews(gig_id);

-- ──────────────────────────────────────────────────────────
-- 2) designer_profiles aggregated sub-rating columns
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS avg_communication numeric(3,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_quality numeric(3,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_speed numeric(3,2) DEFAULT 0;

-- ──────────────────────────────────────────────────────────
-- 3) RPC: recompute aggregated ratings for a designer
--    Called by the client after submitting a review.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_designer_ratings(_designer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _avg_overall numeric;
    _avg_comm numeric;
    _avg_qual numeric;
    _avg_spd numeric;
    _count int;
BEGIN
    SELECT
        AVG(rating)::numeric(3,2),
        AVG(NULLIF(communication_rating, 0))::numeric(3,2),
        AVG(NULLIF(quality_rating, 0))::numeric(3,2),
        AVG(NULLIF(speed_rating, 0))::numeric(3,2),
        COUNT(*)
    INTO _avg_overall, _avg_comm, _avg_qual, _avg_spd, _count
    FROM public.design_reviews
    WHERE designer_id = _designer_id;

    UPDATE public.designer_profiles
        SET avg_rating = COALESCE(_avg_overall, 0),
            avg_communication = COALESCE(_avg_comm, 0),
            avg_quality = COALESCE(_avg_qual, 0),
            avg_speed = COALESCE(_avg_spd, 0),
            total_reviews = _count
        WHERE id = _designer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_designer_ratings(uuid) TO authenticated;
