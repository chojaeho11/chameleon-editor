-- ============================================================
-- Google Indexing API 자동 실행 설정
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1. 진행 상태 추적 테이블
CREATE TABLE IF NOT EXISTS indexing_progress (
    id INT PRIMARY KEY DEFAULT 1,
    current_offset INT DEFAULT 0,
    total_urls INT DEFAULT 0,
    last_run TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT FALSE,
    CHECK (id = 1)  -- 싱글턴: 항상 1행만
);

-- 초기 offset 설정 (4일차 완료 = 800)
INSERT INTO indexing_progress (id, current_offset)
VALUES (1, 800)
ON CONFLICT (id) DO UPDATE SET current_offset = 800;

-- 2. pg_net 확장 (HTTP 요청용)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. pg_cron 확장
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 4. 매일 오전 6시(UTC) = 한국시간 오후 3시에 자동 실행
SELECT cron.schedule(
    'daily-google-indexing',           -- job 이름
    '0 6 * * *',                       -- 매일 06:00 UTC (KST 15:00)
    $$
    SELECT net.http_post(
        url := 'https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/search-index-notify',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y"}'::jsonb,
        body := '{"action": "bulk-auto"}'::jsonb
    );
    $$
);

-- ============================================================
-- 확인 명령어 (선택사항)
-- ============================================================

-- 현재 등록된 cron 작업 확인
-- SELECT * FROM cron.job;

-- 진행 상태 확인
-- SELECT * FROM indexing_progress;

-- cron 실행 이력 확인
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- ============================================================
-- 삭제 (필요시)
-- ============================================================
-- SELECT cron.unschedule('daily-google-indexing');
-- DROP TABLE IF EXISTS indexing_progress;
