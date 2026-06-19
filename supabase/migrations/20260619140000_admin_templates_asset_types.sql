-- 2026-06-19 v631: admin_templates 에 asset_type 컬럼 추가 — 디자이너가 업로드 가능한 종류 확장
--   기존 template/vector/image/logo 4종. 보상 금액 차등:
--     template/vector: 1000 KRW (JP 100엔, US 1달러)
--     image:           500 KRW
--     logo:            100 KRW
--   asset_url 컬럼: 업로드된 원본 파일 URL (벡터 SVG / 이미지 PNG / 로고 PNG).
--     템플릿(기존 행) 은 NULL — slots/background_url 그대로 사용.

ALTER TABLE admin_templates
    ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'template',
    ADD COLUMN IF NOT EXISTS asset_url TEXT,
    ADD COLUMN IF NOT EXISTS asset_path TEXT;

-- 기존 행은 template 로 마크
UPDATE admin_templates SET asset_type = 'template' WHERE asset_type IS NULL;

-- asset_type 인덱스 (검토 페이지 필터링용)
CREATE INDEX IF NOT EXISTS idx_admin_templates_asset_type
    ON admin_templates (asset_type, status);
