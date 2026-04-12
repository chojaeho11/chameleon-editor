-- Add demo images to community services
-- Uses picsum.photos (always works, seeded for stability)

-- Realty images
UPDATE community_realty SET images = ('["https://picsum.photos/seed/realty-' || (abs(hashtext(title)) % 1000)::text || '/800/600","https://picsum.photos/seed/realty-' || (abs(hashtext(title)) % 1000 + 1)::text || '/800/600","https://picsum.photos/seed/realty-' || (abs(hashtext(title)) % 1000 + 2)::text || '/800/600"]')::jsonb;

-- Secondhand images
UPDATE community_secondhand SET images = ('["https://picsum.photos/seed/item-' || (abs(hashtext(title)) % 1000)::text || '/600/600","https://picsum.photos/seed/item-' || (abs(hashtext(title)) % 1000 + 1)::text || '/600/600"]')::jsonb;

-- Dating profile photos
UPDATE community_dating_profiles SET photos = ('["https://i.pravatar.cc/400?u=' || encode(display_name::bytea,'base64') || '"]')::jsonb;

-- Expert photos
UPDATE community_experts SET photo_url = 'https://i.pravatar.cc/200?u=' || encode(display_name::bytea,'base64');

-- Community group images
UPDATE community_groups SET image_url = 'https://picsum.photos/seed/group-' || (abs(hashtext(name)) % 1000)::text || '/400/300';
