-- ═══════════════════════════════════════════════════════════════
-- Phase 3b: Designer Gigs (Kmong-style services) + profile expansion
-- Run in Supabase SQL Editor after Phase 3a.
-- ═══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- 1) Designer profile expansion
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS intro text,
    ADD COLUMN IF NOT EXISTS contact_hours text,
    ADD COLUMN IF NOT EXISTS response_time text,
    ADD COLUMN IF NOT EXISTS languages jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS years_experience int;

-- ──────────────────────────────────────────────────────────
-- 2) designer_gigs table (Kmong-style service catalog)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.designer_gigs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    country text,                          -- ISO-2 country code
    title text NOT NULL,
    category text NOT NULL,
    description text,
    tags jsonb DEFAULT '[]'::jsonb,
    thumbnail text,                        -- main image url
    gallery jsonb DEFAULT '[]'::jsonb,     -- additional image urls

    -- Standard tier (required)
    standard_price bigint NOT NULL,
    standard_title text,
    standard_desc text,
    standard_days int DEFAULT 3,
    standard_revisions int DEFAULT 2,      -- -1 = unlimited

    -- Deluxe tier (optional)
    has_deluxe boolean DEFAULT false,
    deluxe_price bigint,
    deluxe_title text,
    deluxe_desc text,
    deluxe_days int,
    deluxe_revisions int,

    -- Premium tier (optional)
    has_premium boolean DEFAULT false,
    premium_price bigint,
    premium_title text,
    premium_desc text,
    premium_days int,
    premium_revisions int,

    -- Stats & status
    status text NOT NULL DEFAULT 'active', -- active | draft | paused
    view_count bigint NOT NULL DEFAULT 0,
    order_count bigint NOT NULL DEFAULT 0,
    avg_rating numeric(3,2) DEFAULT 0,
    total_reviews int DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_designer_gigs_designer ON public.designer_gigs(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_gigs_category ON public.designer_gigs(category);
CREATE INDEX IF NOT EXISTS idx_designer_gigs_country  ON public.designer_gigs(country);
CREATE INDEX IF NOT EXISTS idx_designer_gigs_status   ON public.designer_gigs(status);
CREATE INDEX IF NOT EXISTS idx_designer_gigs_rating   ON public.designer_gigs(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_designer_gigs_orders   ON public.designer_gigs(order_count DESC);

ALTER TABLE public.designer_gigs ENABLE ROW LEVEL SECURITY;

-- Everyone can see active gigs
DROP POLICY IF EXISTS "gigs_select_active" ON public.designer_gigs;
CREATE POLICY "gigs_select_active" ON public.designer_gigs
FOR SELECT USING (status = 'active' OR designer_id = auth.uid());

-- Only the owning designer can insert
DROP POLICY IF EXISTS "gigs_insert_own" ON public.designer_gigs;
CREATE POLICY "gigs_insert_own" ON public.designer_gigs
FOR INSERT WITH CHECK (designer_id = auth.uid());

-- Only the owning designer can update their own gigs
DROP POLICY IF EXISTS "gigs_update_own" ON public.designer_gigs;
CREATE POLICY "gigs_update_own" ON public.designer_gigs
FOR UPDATE USING (designer_id = auth.uid())
WITH CHECK (designer_id = auth.uid());

-- Only the owning designer can delete their own gigs
DROP POLICY IF EXISTS "gigs_delete_own" ON public.designer_gigs;
CREATE POLICY "gigs_delete_own" ON public.designer_gigs
FOR DELETE USING (designer_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 3) design_requests: link to source gig
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.design_requests
    ADD COLUMN IF NOT EXISTS gig_id uuid REFERENCES public.designer_gigs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS gig_tier text;  -- 'standard' | 'deluxe' | 'premium'

CREATE INDEX IF NOT EXISTS idx_design_requests_gig ON public.design_requests(gig_id);

-- ──────────────────────────────────────────────────────────
-- 4) RPC: purchase a gig
--    Atomically creates a design_request + preselected design_bid
--    and returns the bid_id so the client can push it to cart.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purchase_gig(
    _gig_id uuid,
    _tier text,
    _brief text,
    _country text DEFAULT NULL
)
RETURNS TABLE (request_id uuid, bid_id uuid, price bigint, title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _gig record;
    _price bigint;
    _days int;
    _tier_title text;
    _req_id uuid;
    _bid_id uuid;
BEGIN
    SELECT * INTO _gig FROM public.designer_gigs WHERE id = _gig_id AND status = 'active';
    IF _gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found or not active'; END IF;

    -- Disallow buying own gig
    IF _gig.designer_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot purchase your own gig';
    END IF;

    -- Resolve tier pricing
    IF _tier = 'standard' THEN
        _price := _gig.standard_price;
        _days  := COALESCE(_gig.standard_days, 3);
        _tier_title := COALESCE(_gig.standard_title, 'Standard');
    ELSIF _tier = 'deluxe' THEN
        IF NOT _gig.has_deluxe OR _gig.deluxe_price IS NULL THEN
            RAISE EXCEPTION 'Deluxe tier is not available for this gig';
        END IF;
        _price := _gig.deluxe_price;
        _days  := COALESCE(_gig.deluxe_days, _gig.standard_days, 5);
        _tier_title := COALESCE(_gig.deluxe_title, 'Deluxe');
    ELSIF _tier = 'premium' THEN
        IF NOT _gig.has_premium OR _gig.premium_price IS NULL THEN
            RAISE EXCEPTION 'Premium tier is not available for this gig';
        END IF;
        _price := _gig.premium_price;
        _days  := COALESCE(_gig.premium_days, _gig.standard_days, 7);
        _tier_title := COALESCE(_gig.premium_title, 'Premium');
    ELSE
        RAISE EXCEPTION 'Invalid tier: %', _tier;
    END IF;

    -- Create design request
    INSERT INTO public.design_requests (
        customer_id, title, description, category,
        budget_min, budget_max, files, status,
        country, gig_id, gig_tier
    ) VALUES (
        auth.uid(),
        '[' || _tier_title || '] ' || _gig.title,
        COALESCE(_brief, ''),
        _gig.category,
        _price, _price,
        '[]'::jsonb,
        'in_progress',
        COALESCE(_country, _gig.country),
        _gig.id,
        _tier
    ) RETURNING id INTO _req_id;

    -- Create the matching (already selected) bid
    INSERT INTO public.design_bids (
        request_id, designer_id, price, timeline_days,
        message, portfolio_urls, status, payment_status
    ) VALUES (
        _req_id, _gig.designer_id, _price, _days,
        'Gig order: ' || _tier_title,
        '[]'::jsonb,
        'selected',
        'pending'
    ) RETURNING id INTO _bid_id;

    -- Link selected bid on the request
    UPDATE public.design_requests SET selected_bid_id = _bid_id WHERE id = _req_id;

    -- Increment order count on the gig
    UPDATE public.designer_gigs SET order_count = order_count + 1 WHERE id = _gig.id;

    RETURN QUERY SELECT _req_id, _bid_id, _price, _tier_title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_gig(uuid, text, text, text) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 5) RPC: increment gig view count (bypasses RLS UPDATE restriction)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_gig_view(_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.designer_gigs SET view_count = view_count + 1 WHERE id = _gig_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_gig_view(uuid) TO anon, authenticated;
