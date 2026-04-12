-- Fix: simpler image URLs that actually work
-- Previous version used encode() which may have produced bad URLs

-- Realty: 3 photos per listing
UPDATE community_realty SET images = jsonb_build_array(
    'https://picsum.photos/seed/r' || left(id::text, 8) || 'a/800/600',
    'https://picsum.photos/seed/r' || left(id::text, 8) || 'b/800/600',
    'https://picsum.photos/seed/r' || left(id::text, 8) || 'c/800/600'
);

-- Secondhand: 2 photos per item
UPDATE community_secondhand SET images = jsonb_build_array(
    'https://picsum.photos/seed/s' || left(id::text, 8) || 'a/600/600',
    'https://picsum.photos/seed/s' || left(id::text, 8) || 'b/600/600'
);

-- Dating profiles: face photo via pravatar (use id hash for variety)
UPDATE community_dating_profiles SET photos = jsonb_build_array(
    'https://i.pravatar.cc/400?img=' || ((abs(hashtext(display_name)) % 70) + 1)::text
);

-- Experts: face photo
UPDATE community_experts SET photo_url = 
    'https://i.pravatar.cc/200?img=' || ((abs(hashtext(display_name)) % 70) + 1)::text;

-- Community groups: cover image
UPDATE community_groups SET image_url = 
    'https://picsum.photos/seed/g' || left(id::text, 8) || '/400/300';

-- Verify
DO $$
DECLARE r int; s int; d int; e int; g int;
BEGIN
    SELECT count(*) INTO r FROM community_realty WHERE images != '[]'::jsonb;
    SELECT count(*) INTO s FROM community_secondhand WHERE images != '[]'::jsonb;
    SELECT count(*) INTO d FROM community_dating_profiles WHERE photos != '[]'::jsonb;
    SELECT count(*) INTO e FROM community_experts WHERE photo_url IS NOT NULL;
    SELECT count(*) INTO g FROM community_groups WHERE image_url IS NOT NULL;
    RAISE NOTICE 'Images: realty=%, secondhand=%, dating=%, experts=%, groups=%', r, s, d, e, g;
END $$;
