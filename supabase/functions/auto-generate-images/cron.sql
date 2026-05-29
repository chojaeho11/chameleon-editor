-- ════════════════════════════════════════════════════════════════════════════
-- auto-generate-images Edge Function 자동 호출 cron 스케줄
--
-- 사용 방법:
--   1) 이 파일의 SQL 을 Supabase Dashboard → SQL Editor 에 붙여넣기 → 실행
--   2) pg_cron 확장 활성화 (Dashboard → Database → Extensions → pg_cron 켜기)
--   3) pg_net 확장 활성화 (Dashboard → Database → Extensions → pg_net 켜기)
--   4) cron.schedule 의 url 부분에 본인 프로젝트 ref 들어있는지 확인
--
-- 결과:
--   - 매 10분마다 Edge Function 자동 호출
--   - 한 번에 6개 이미지 생성 → 큐 비면 자동 종료
--   - 큐가 비어있을 때 호출돼도 비용 0 (조회만 하고 return)
--
-- 제어:
--   - 일시정지: SELECT cron.unschedule('auto-generate-images');
--   - 재개:    아래 cron.schedule 다시 실행
--   - 주기 변경: '*/10 * * * *' 부분 수정 (cron 표현식)
-- ════════════════════════════════════════════════════════════════════════════

-- 1. 확장 활성화 (이미 켜져 있으면 skip)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 기존 동일 이름 스케줄 제거 (재실행 안전)
SELECT cron.unschedule('auto-generate-images')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-generate-images');

-- 3. 스케줄 등록 — 매 10분
SELECT cron.schedule(
    'auto-generate-images',
    '*/10 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/auto-generate-images',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('batchLimit', 6, 'categoryPrefix', 'pkg_')
    ) AS request_id;
    $$
);

-- ─── 옵션: service_role_key 를 GUC 에 저장하지 않고 직접 박는 방식 ───
-- (위의 current_setting 이 빈 값이면 아래 주석 풀고 키 직접 입력)
--
-- SELECT cron.unschedule('auto-generate-images');
-- SELECT cron.schedule(
--     'auto-generate-images',
--     '*/10 * * * *',
--     $$
--     SELECT net.http_post(
--         url := 'https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/auto-generate-images',
--         headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'Authorization', 'Bearer eyJhbGc...'  -- service_role_key 여기 붙여넣기
--         ),
--         body := jsonb_build_object('batchLimit', 6)
--     );
--     $$
-- );

-- ─── 점검 쿼리 ───
-- 등록된 잡 확인:
--   SELECT * FROM cron.job WHERE jobname = 'auto-generate-images';
-- 최근 실행 이력 확인 (성공/실패):
--   SELECT * FROM cron.job_run_details WHERE jobname = 'auto-generate-images' ORDER BY start_time DESC LIMIT 20;
-- HTTP 응답 확인:
--   SELECT * FROM net._http_response ORDER BY id DESC LIMIT 10;
