-- 아바타 JSON 저장 컬럼 추가 (아바타 빌더용)
-- 파츠 선택값 + 색상 인덱스를 { gender, face, skin, hair, hairColor, brow, eye, glasses, mouth, outfit, outfitColor, bg } 형태로 저장
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_json jsonb;

COMMENT ON COLUMN profiles.avatar_json IS 'Cyworld-style avatar builder selections (gender, hair, eye, glasses, mouth, outfit, bg indexes + color codes)';
