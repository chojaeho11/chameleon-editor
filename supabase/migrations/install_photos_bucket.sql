-- ── install-photos 버킷 + 공개 정책 ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('install-photos', 'install-photos', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 20971520;

-- 공개 읽기
DROP POLICY IF EXISTS "install_photos_public_read" ON storage.objects;
CREATE POLICY "install_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'install-photos');

-- 누구나 업로드 (배송기사 모바일 앱: 익명 키 사용)
DROP POLICY IF EXISTS "install_photos_anon_insert" ON storage.objects;
CREATE POLICY "install_photos_anon_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'install-photos');

-- 관리자/기사 본인이 삭제 (편의상 누구나 허용 — 운영 후 조정)
DROP POLICY IF EXISTS "install_photos_anon_delete" ON storage.objects;
CREATE POLICY "install_photos_anon_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'install-photos');
