-- ═══════════════════════════════════════════════════════════════
-- Fix: Replace broken Unsplash URLs with reliable image sources
-- ═══════════════════════════════════════════════════════════════
-- Some of the Unsplash photo IDs we seeded have been deleted or
-- return 404 intermittently. Replace all demo gig thumbnails and
-- demo designer photos with deterministic URLs that are guaranteed
-- stable (picsum.photos for gig art, i.pravatar.cc for faces).
--
-- Safe to run multiple times — always produces the same result.

-- ──────────────────────────────────────────────────────────
-- 1) Gig thumbnails → picsum.photos/seed/X/800/600
-- ──────────────────────────────────────────────────────────
-- Picsum.photos serves random-but-stable photos based on seed.
-- We derive the seed from the gig title so the same gig always
-- gets the same image, and different gigs get different art.
UPDATE public.designer_gigs g
SET thumbnail = 'https://picsum.photos/seed/gig-' || (abs(hashtext(g.title)) % 1000)::text || '/800/600',
    gallery = ('["https://picsum.photos/seed/gig-' || (abs(hashtext(g.title)) % 1000)::text || '/800/600"]')::jsonb
WHERE EXISTS (
    SELECT 1 FROM public.designer_profiles p
    WHERE p.id = g.designer_id AND p.is_demo = true
);

-- ──────────────────────────────────────────────────────────
-- 2) Demo designer photos → i.pravatar.cc with ethnic clustering
-- ──────────────────────────────────────────────────────────
-- pravatar.cc img indices 1-70 are stable. We cluster by country
-- using specific known-good indices that match ethnicity:
--   East Asian (JP/KR/CN/SG): img 5,9,11,14,16,20,25,26,30,33,43,44,48,52,54
--   Middle Eastern (SA/MA):    img 1,4,8,13,17,19,22,27,35
--   European (GB/DE/ES/FR):    img 2,3,6,7,10,12,15,18,23,24,28,29,31
--   US (mixed):                img 32,34,36,37,38,39,40,41,45,46,50,53,55,56,58,60,61,63,67,68
--
-- These ranges are based on visual inspection of pravatar.cc's
-- public avatar set (as of 2026) — actual ethnicities are not
-- guaranteed by pravatar, but clustering works better than
-- random Unsplash URLs that 404.

WITH pravatar_by_country(country, idxs) AS (
    VALUES
    ('JP', ARRAY[5, 9, 11, 14, 16, 20, 25, 26, 30, 33, 43, 44, 48, 52, 54]),
    ('KR', ARRAY[5, 9, 11, 14, 16, 20, 25, 26, 30, 33, 43, 44, 48, 52, 54]),
    ('CN', ARRAY[5, 9, 11, 14, 16, 20, 25, 26, 30, 33, 43, 44, 48, 52, 54]),
    ('SG', ARRAY[5, 9, 11, 14, 16, 20, 25, 26, 30, 33, 43, 44, 48, 52, 54]),
    ('SA', ARRAY[1, 4, 8, 13, 17, 19, 22, 27, 35]),
    ('MA', ARRAY[1, 4, 8, 13, 17, 19, 22, 27, 35]),
    ('GB', ARRAY[2, 3, 6, 7, 10, 12, 15, 18, 23, 24, 28, 29, 31]),
    ('DE', ARRAY[2, 3, 6, 7, 10, 12, 15, 18, 23, 24, 28, 29, 31]),
    ('ES', ARRAY[2, 3, 6, 7, 10, 12, 15, 18, 23, 24, 28, 29, 31]),
    ('FR', ARRAY[2, 3, 6, 7, 10, 12, 15, 18, 23, 24, 28, 29, 31]),
    ('US', ARRAY[32, 34, 36, 37, 38, 39, 40, 41, 45, 46, 50, 53, 55, 56, 58, 60, 61, 63, 67, 68])
)
UPDATE public.designer_profiles p
SET photo_url = 'https://i.pravatar.cc/400?img=' ||
    (pbc.idxs[1 + (abs(hashtext(p.display_name)) % array_length(pbc.idxs, 1))])::text
FROM pravatar_by_country pbc
WHERE p.is_demo = true
  AND p.country = pbc.country;

-- Any demo designer whose country is not in the map → use mixed US range
UPDATE public.designer_profiles p
SET photo_url = 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(p.display_name)) % 70) + 1)::text)
WHERE p.is_demo = true
  AND p.country NOT IN ('JP','KR','CN','SG','SA','MA','GB','DE','ES','FR','US');

-- Diagnostic
DO $$
DECLARE _gigs int; _dsg int;
BEGIN
    SELECT COUNT(*) INTO _gigs FROM public.designer_gigs g
        JOIN public.designer_profiles p ON p.id = g.designer_id
        WHERE p.is_demo = true;
    SELECT COUNT(*) INTO _dsg FROM public.designer_profiles WHERE is_demo = true;
    RAISE NOTICE 'Fixed images: % demo gigs, % demo designers', _gigs, _dsg;
END;
$$;
