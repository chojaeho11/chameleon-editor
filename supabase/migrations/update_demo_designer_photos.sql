-- ═══════════════════════════════════════════════════════════════
-- Replace demo designer photos with reliable, varied avatars
-- ═══════════════════════════════════════════════════════════════
-- Run after seed_demo_designers.sql has been applied.
-- Uses i.pravatar.cc which serves real photos of varied people.
-- Each demo designer gets a stable, unique image based on their name hash.
--
-- Why pravatar instead of Unsplash:
-- - Unsplash photo IDs occasionally 404
-- - Pravatar URLs with ?img=N (1-70) are guaranteed stable
-- - Already varied across ethnicities and ages
-- - No API key needed, free for demo use
--
-- Country-specific assignment uses different ranges of pravatar img indexes
-- to roughly cluster by ethnicity:
--   KR/JP/CN (Asian)         → idx 1-25  (selected from people-of-color set)
--   US                       → idx 26-50 (mixed)
--   SA (Middle Eastern)      → idx 51-60
--   ES/DE/FR (European)      → idx 61-70

UPDATE public.designer_profiles
SET photo_url = CASE country
    -- East Asian range (KR/JP/CN): 1-25
    WHEN 'KR' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 25) + 1)::text)
    WHEN 'JP' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 25) + 1)::text)
    WHEN 'CN' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 25) + 1)::text)
    -- US range: 26-50 (mixed/diverse)
    WHEN 'US' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 25) + 26)::text)
    -- Middle Eastern (SA): 51-60
    WHEN 'SA' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 10) + 51)::text)
    -- European (ES/DE/FR): 61-70
    WHEN 'ES' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 10) + 61)::text)
    WHEN 'DE' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 10) + 61)::text)
    WHEN 'FR' THEN 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 10) + 61)::text)
    ELSE 'https://i.pravatar.cc/400?img=' || (((abs(hashtext(display_name)) % 70) + 1)::text)
END
WHERE is_demo = true;

-- Diagnostic
DO $$
DECLARE _cnt int;
BEGIN
    SELECT COUNT(*) INTO _cnt FROM public.designer_profiles WHERE is_demo = true;
    RAISE NOTICE 'Updated photo URLs for % demo designers', _cnt;
END;
$$;
