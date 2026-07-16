-- ============================================================
-- promo-publish 매일 자동 발행 (pg_cron)
-- 2026-07-17
--
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 1회 실행하세요.
-- (auto-generate-images/cron.sql 과 같은 방식 — 코드에서 자동 등록되지 않습니다)
--
-- 매일 한국시간 18:00 (= UTC 09:00) 에 홍보사진 대기열을 모아 한/일/영 블로그를 발행합니다.
-- 킬스위치: update promo_settings set auto_publish=false where id=1;  → cron 이 돌아도 발행 안 함
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 이미 등록돼 있으면 먼저 제거 (재실행 안전)
select cron.unschedule('promo-publish-daily')
where exists (select 1 from cron.job where jobname = 'promo-publish-daily');

select cron.schedule(
  'promo-publish-daily',
  '0 9 * * *',                  -- UTC 09:00 = KST 18:00
  $$
  select net.http_post(
    url     := 'https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/promo-publish',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <<SERVICE_ROLE_KEY 를 여기에>>'
               ),
    body    := '{"maxPhotos":12}'::jsonb
  );
  $$
);

-- 확인:  select jobname, schedule, active from cron.job where jobname='promo-publish-daily';
-- 해제:  select cron.unschedule('promo-publish-daily');
