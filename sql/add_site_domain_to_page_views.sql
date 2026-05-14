-- 2026-05-14: page_views 테이블에 site_domain 컬럼 추가.
-- 도메인별 (cafe2626 / cafe0101 / cafe3355 / cotton-print.com) 트래픽 분리 추적용.
-- 기존 'site' 컬럼은 국가 코드 (KR/JP/US/CN/...) 그대로 유지.

ALTER TABLE page_views
ADD COLUMN IF NOT EXISTS site_domain TEXT;

-- 인덱스 — 도메인별 + 날짜별 자주 조회됨
CREATE INDEX IF NOT EXISTS idx_page_views_site_domain_created
ON page_views (site_domain, created_at DESC);

-- 기존 데이터 보정 (선택) — site_domain 이 NULL 인 행은 'cafe2626.com' 으로 채움
-- (옛 데이터는 어차피 대부분 cafe2626 였을 것이므로 안전한 기본값).
-- UPDATE page_views SET site_domain = 'cafe2626.com' WHERE site_domain IS NULL;

-- 확인 쿼리
-- SELECT site_domain, COUNT(*) FROM page_views
-- WHERE created_at >= NOW() - INTERVAL '7 days'
-- GROUP BY 1 ORDER BY 2 DESC;
