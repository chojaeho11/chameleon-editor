-- 아바타 URL 저장 컬럼 (완성된 이미지 선택 방식)
-- 사용자가 갤러리에서 선택한 아바타 이미지 경로 저장 (예: '/avatar/xxx.jpg')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN profiles.avatar_url IS 'Path or URL to the selected avatar image (e.g. /avatar/filename.jpg)';
