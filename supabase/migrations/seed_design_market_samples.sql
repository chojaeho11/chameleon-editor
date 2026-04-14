-- ═══════════════════════════════════════════════════════════════
-- Seed: sample gigs + designer ratings (priming the marketplace)
-- ═══════════════════════════════════════════════════════════════
-- Run AFTER all phase migrations.
-- This is idempotent — re-running will not duplicate gigs.

-- ──────────────────────────────────────────────────────────
-- 1) Distribute sample gigs to existing designers (round-robin)
-- ──────────────────────────────────────────────────────────
WITH active_designers AS (
    SELECT id, country, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM public.designer_profiles
    WHERE is_active = true
),
designer_count AS (
    SELECT COUNT(*) AS cnt FROM active_designers
),
samples AS (
    SELECT * FROM (VALUES
    (1,
     '[Sample] Modern Logo Design for Your Brand',
     'logo',
     E'I will design a clean, modern logo that represents your brand identity.\n\nWhat is included:\n- Original concept (no templates)\n- Vector files (AI / EPS / SVG / PDF)\n- Print-ready and web-ready exports\n- Color and black-and-white variations\n\nWhat I need from you: brand name, business description, target audience, color preferences (if any), and 2-3 example logos you like.',
     '["modern","minimal","vector","brand","logo"]',
     50000,  'Basic Logo',     '1 concept · 2 revisions · PNG and JPG',                                  3, 2,
     100000, 'Standard Pack',  '2 concepts · 4 revisions · All file formats · Source files',            5, 4,
     200000, 'Premium Brand',  '3 concepts · Unlimited revisions · Logo + business card + social kit',  7, 999,
     'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80'),

    (2,
     '[Sample] Eye-Catching YouTube Thumbnail',
     'thumbnail',
     E'I will design a high-CTR thumbnail for your YouTube video.\n\nWhat is included:\n- Bold text and contrast\n- Face cutout and effects\n- A/B variant included in Standard tier and above\n\nSend me: video title, your face photo (high quality), 1-2 reference thumbnails you like, and the main keyword.',
     '["youtube","thumbnail","viral","ctr"]',
     20000, 'Single Thumbnail', '1 concept · 1 revision · PNG',                                 1, 1,
     35000, 'A/B Pair',         '2 variant thumbnails · 3 revisions · PNG and PSD source',      2, 3,
     60000, 'Series Pack 5',    '5 thumbnails for a series · Unlimited revisions · PSD source', 4, 999,
     'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80'),

    (3,
     '[Sample] SNS Banner and Ad Creative',
     'banner',
     E'I will design banners optimized for Instagram, Facebook, and Naver.\n\nWhat is included:\n- Platform-specific sizing\n- Korean and English versions\n- Editable source files\n\nTell me your campaign message, target sizes, brand colors and logo.',
     '["banner","sns","instagram","facebook","ad"]',
     30000, 'Single Banner',  '1 size · 2 revisions · PNG',                            2, 2,
     55000, 'Multi-platform', '3 platform sizes · 4 revisions · PNG and PSD',          3, 4,
     90000, 'Campaign Set',   '6 sizes · Unlimited revisions · PSD and Figma source',  5, 999,
     'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80'),

    (4,
     '[Sample] Business Card and Flyer Design',
     'business_card',
     E'I will design business cards and flyers that represent your brand professionally.\n\nWhat is included:\n- Print-ready CMYK files\n- Front and back design\n- Bleed and trim marks included\n\nProvide your contact info, logo, brand colors, and any text or photos you want to include.',
     '["businesscard","flyer","print","cmyk"]',
     25000, 'Card Only',    '1 design · 2 revisions · CMYK PDF',                          2, 2,
     45000, 'Card + Flyer', 'Card + 1-page flyer · 4 revisions · Source files included', 4, 4,
     80000, 'Stationery',   'Card + Flyer + Letterhead + Envelope · Unlimited revisions', 6, 999,
     'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80'),

    (5,
     '[Sample] E-commerce Product Detail Page',
     'product_detail',
     E'I will design a high-converting product detail page for your online store.\n\nWhat is included:\n- Mobile-optimized layout\n- Hero section + features + reviews + FAQ\n- Naver Smartstore / Coupang / Shopify compatible\n\nSend me your product photos, key selling points, target audience and brand reference.',
     '["productpage","ecommerce","smartstore","coupang","shopify"]',
     80000,  'Short Page',    'About 5 sections · 2 revisions · JPG output',                          5, 2,
     150000, 'Standard Page', 'About 10 sections · 4 revisions · PSD source',                         7, 4,
     280000, 'Premium Page',  'Full storytelling page · Unlimited revisions · PSD + animations',     10, 999,
     'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80'),

    (6,
     '[Sample] Product Packaging and Label Design',
     'packaging',
     E'I will design beautiful packaging and labels for your physical products.\n\nWhat is included:\n- Die-line and bleed setup\n- Multiple mockup previews\n- Print-ready CMYK files\n\nShare your product, dimensions, brand identity and any reference packaging you admire.',
     '["packaging","label","print","cmyk","mockup"]',
     70000,  'Label Only',     'Front label · 2 revisions · CMYK PDF',                       4, 2,
     130000, 'Box Design',     'Full box wrap · 4 revisions · Die-line + mockups',           6, 4,
     250000, 'Premium Series', 'Multi-product line · Unlimited revisions · 3D mockups',     10, 999,
     'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80'),

    (7,
     '[Sample] Honeycomb Board Display Design',
     'honeycomb',
     E'I will design custom artwork for honeycomb cardboard displays — perfect for popup stores, exhibitions and retail.\n\nWhat is included:\n- Eco-friendly material optimized\n- Layered die-cut compatible\n- Production-ready files\n\nTell me the display size, brand, target audience and event purpose.',
     '["honeycomb","display","exhibition","popup","ecofriendly"]',
     120000, 'Single Panel', '1 panel · 2 revisions · Print-ready PDF',                  5, 2,
     220000, 'Display Set',  '3 panels with consistent theme · 4 revisions · Source',    7, 4,
     400000, 'Full Booth',   'Complete booth design · Unlimited revisions · 3D mockups',12, 999,
     'https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?w=800&q=80'),

    (8,
     '[Sample] Company Brochure and Catalog Design',
     'brochure',
     E'I will design a professional brochure or product catalog for your company.\n\nWhat is included:\n- Bi-fold, tri-fold, or multi-page\n- Print-ready CMYK\n- Editable InDesign source\n\nProvide your company info, products, photos and brand guidelines.',
     '["brochure","catalog","print","corporate"]',
     60000,  'Bi-fold',     '4 pages · 2 revisions · PDF print-ready',                         4, 2,
     130000, 'Tri-fold',    '6 panels · 4 revisions · InDesign source',                        6, 4,
     280000, 'Catalog 16p', '16-page product catalog · Unlimited revisions · Source files',  10, 999,
     'https://images.unsplash.com/photo-1542435503-956c469947f6?w=800&q=80')
    ) AS s(
        idx, title, category, description, tags,
        std_price, std_title, std_desc, std_days, std_rev,
        dlx_price, dlx_title, dlx_desc, dlx_days, dlx_rev,
        prm_price, prm_title, prm_desc, prm_days, prm_rev,
        thumbnail
    )
)
INSERT INTO public.designer_gigs (
    designer_id, country, title, category, description, tags, status, thumbnail, gallery,
    standard_price, standard_title, standard_desc, standard_days, standard_revisions,
    has_deluxe, deluxe_price, deluxe_title, deluxe_desc, deluxe_days, deluxe_revisions,
    has_premium, premium_price, premium_title, premium_desc, premium_days, premium_revisions,
    view_count, order_count, avg_rating, total_reviews
)
SELECT
    d.id,
    COALESCE(d.country, 'KR'),
    s.title,
    s.category,
    s.description,
    s.tags::jsonb,
    'active',
    s.thumbnail,
    '[]'::jsonb,
    s.std_price, s.std_title, s.std_desc, s.std_days, s.std_rev,
    true,  s.dlx_price, s.dlx_title, s.dlx_desc, s.dlx_days, s.dlx_rev,
    true,  s.prm_price, s.prm_title, s.prm_desc, s.prm_days, s.prm_rev,
    (s.idx * 73 + 50)::int,
    (s.idx * 7 + 3)::int,
    (4.5 + ((s.idx % 5) * 0.1))::numeric(3,2),
    (s.idx * 4 + 5)::int
FROM samples s
CROSS JOIN designer_count dc
JOIN active_designers d
    ON dc.cnt > 0
   AND d.rn = (((s.idx - 1) % dc.cnt) + 1)
WHERE NOT EXISTS (
    SELECT 1 FROM public.designer_gigs g
    WHERE g.designer_id = d.id AND g.title = s.title
);

-- ──────────────────────────────────────────────────────────
-- 2) Seed designer ratings (only for designers with no real reviews)
-- ──────────────────────────────────────────────────────────
UPDATE public.designer_profiles d
SET avg_rating = (4.6 + (random() * 0.4))::numeric(3,2),
    avg_communication = (4.5 + (random() * 0.5))::numeric(3,2),
    avg_quality = (4.6 + (random() * 0.4))::numeric(3,2),
    avg_speed = (4.4 + (random() * 0.6))::numeric(3,2),
    total_reviews = 12 + (random() * 30)::int
WHERE d.is_active = true
  AND COALESCE(d.total_reviews, 0) = 0
  AND NOT EXISTS (
      SELECT 1 FROM public.design_reviews r WHERE r.designer_id = d.id
  );

-- ──────────────────────────────────────────────────────────
-- 3) Diagnostic
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE
    _gig_count int;
    _designer_count int;
BEGIN
    SELECT COUNT(*) INTO _gig_count FROM public.designer_gigs WHERE title LIKE '[Sample]%';
    SELECT COUNT(*) INTO _designer_count FROM public.designer_profiles WHERE is_active = true;
    RAISE NOTICE 'Seed complete: % sample gigs across % active designers', _gig_count, _designer_count;
END;
$$;
