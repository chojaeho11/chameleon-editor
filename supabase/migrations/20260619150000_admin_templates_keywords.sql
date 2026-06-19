-- 2026-06-19 v642: 디자이너 자산에 다국어 키워드 저장
--   keywords JSONB: { ko, ja, en, fr, ar } 5개 언어 — 디자이너는 한국어로 입력,
--   업로드 시점에 Google Translate 로 자동 번역 후 저장.
--   고객 검색 시 사이트 언어에 맞춰 노출.

ALTER TABLE admin_templates
    ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_admin_templates_keywords_gin
    ON admin_templates USING gin (keywords);
