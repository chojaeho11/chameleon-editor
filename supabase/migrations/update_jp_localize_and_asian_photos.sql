-- ═══════════════════════════════════════════════════════════════
-- Update: Japanese demo designers → native names + Asian photos
-- ═══════════════════════════════════════════════════════════════
-- 1) Replace romaji display_name with 漢字/ひらがな for JP demo rows
-- 2) Point JP/KR/CN demo photos at curated Unsplash Asian-face URLs
-- 3) Point SA/MA demo photos at curated Middle Eastern face URLs
--
-- The previous seed used Unsplash IDs that sometimes returned
-- Western-looking portraits, which felt incoherent on the JP page.
-- Here we update in place, keeping everything else untouched.

-- ──────────────────────────────────────────────────────────
-- 1) JP names → Japanese script (idempotent on romaji key)
-- ──────────────────────────────────────────────────────────
UPDATE public.designer_profiles SET display_name = '田中 由紀'       WHERE display_name = 'Yuki Tanaka'      AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '佐藤 陽翔'       WHERE display_name = 'Haruto Sato'      AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '鈴木 葵'         WHERE display_name = 'Aoi Suzuki'       AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '高橋 ひなた'     WHERE display_name = 'Hinata Takahashi' AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '山本 さくら'     WHERE display_name = 'Sakura Yamamoto'  AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '渡辺 陸'         WHERE display_name = 'Riku Watanabe'    AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '中村 美桜'       WHERE display_name = 'Mio Nakamura'     AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '伊藤 健司'       WHERE display_name = 'Kenji Ito'        AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '小林 七海'       WHERE display_name = 'Nanami Kobayashi' AND country = 'JP' AND is_demo = true;
UPDATE public.designer_profiles SET display_name = '山田 空'         WHERE display_name = 'Sora Yamada'      AND country = 'JP' AND is_demo = true;

-- ──────────────────────────────────────────────────────────
-- 2) Curated Asian-face photo URLs for JP/KR/CN demo rows
-- ──────────────────────────────────────────────────────────
-- These are specific Unsplash photos verified to show East Asian
-- subjects. Distribution by display_name hash for variety.
WITH asian_photos(idx, url) AS (
    VALUES
    (0, 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80'),
    (1, 'https://images.unsplash.com/photo-1509967419605-b8ceff28a3a4?w=400&q=80'),
    (2, 'https://images.unsplash.com/photo-1546961342-0e62fe1b54c5?w=400&q=80'),
    (3, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'),
    (4, 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80'),
    (5, 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&q=80'),
    (6, 'https://images.unsplash.com/photo-1505503693641-1926193e8d57?w=400&q=80'),
    (7, 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80'),
    (8, 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80'),
    (9, 'https://images.unsplash.com/photo-1541647376583-8934aaf3448a?w=400&q=80'),
    (10, 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=400&q=80'),
    (11, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80'),
    (12, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80'),
    (13, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80'),
    (14, 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80')
)
UPDATE public.designer_profiles p
SET photo_url = ap.url
FROM asian_photos ap
WHERE p.is_demo = true
  AND p.country IN ('JP', 'KR', 'CN')
  AND ap.idx = (abs(hashtext(p.display_name)) % 15);

-- ──────────────────────────────────────────────────────────
-- 3) Curated Middle Eastern face photos for SA/MA demo rows
-- ──────────────────────────────────────────────────────────
WITH me_photos(idx, url) AS (
    VALUES
    (0, 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80'),
    (1, 'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=400&q=80'),
    (2, 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=400&q=80'),
    (3, 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80'),
    (4, 'https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=400&q=80'),
    (5, 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&q=80'),
    (6, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80'),
    (7, 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400&q=80')
)
UPDATE public.designer_profiles p
SET photo_url = mep.url
FROM me_photos mep
WHERE p.is_demo = true
  AND p.country IN ('SA', 'MA')
  AND mep.idx = (abs(hashtext(p.display_name)) % 8);

-- Diagnostic
DO $$
DECLARE _jp int; _kr int; _cn int; _sa int; _ma int;
BEGIN
    SELECT COUNT(*) INTO _jp FROM public.designer_profiles WHERE is_demo = true AND country = 'JP';
    SELECT COUNT(*) INTO _kr FROM public.designer_profiles WHERE is_demo = true AND country = 'KR';
    SELECT COUNT(*) INTO _cn FROM public.designer_profiles WHERE is_demo = true AND country = 'CN';
    SELECT COUNT(*) INTO _sa FROM public.designer_profiles WHERE is_demo = true AND country = 'SA';
    SELECT COUNT(*) INTO _ma FROM public.designer_profiles WHERE is_demo = true AND country = 'MA';
    RAISE NOTICE 'Photo update: JP=%, KR=%, CN=%, SA=%, MA=%', _jp, _kr, _cn, _sa, _ma;
END;
$$;
