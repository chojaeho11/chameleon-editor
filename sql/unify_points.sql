-- ===== 통합 포인트 : profiles.mileage 를 유일한 '포인트'로 =====
-- event_coupon(이벤트쿠폰/가입·추천/SNS공유) + blog_coupon(블로그체험단 월지급) 을 mileage 로 흡수.
-- 모든 적립 소스 코드는 그대로 두고, 트리거가 event_coupon/blog_coupon 증가분을 즉시 mileage 로 접어넣음.

-- (1) 기존 잔액 1회 합산 이전 (원장 기록)
insert into public.wallet_logs(user_id, type, amount, description)
select id, 'point_unify', coalesce(event_coupon,0)+coalesce(blog_coupon,0),
       '포인트 통합 이전 (이벤트쿠폰+SNS/블로그 → 포인트)'
  from public.profiles
 where coalesce(event_coupon,0)+coalesce(blog_coupon,0) > 0;

update public.profiles
   set mileage      = coalesce(mileage,0) + coalesce(event_coupon,0) + coalesce(blog_coupon,0),
       event_coupon = 0,
       blog_coupon  = 0
 where coalesce(event_coupon,0)+coalesce(blog_coupon,0) > 0;

-- (2) 향후 자동 통합 트리거 — event_coupon/blog_coupon 로 적립되는 값을 즉시 mileage 로 흡수.
--   (가입·추천 edge fn, SNS공유 admin, 블로그체험단 월지급 RPC 등 모든 기존 적립코드 수정 없이 통합)
create or replace function public._fold_promo_to_mileage() returns trigger
language plpgsql as $$
begin
  if coalesce(NEW.event_coupon,0) > 0 or coalesce(NEW.blog_coupon,0) > 0 then
    NEW.mileage      := coalesce(NEW.mileage,0) + coalesce(NEW.event_coupon,0) + coalesce(NEW.blog_coupon,0);
    NEW.event_coupon := 0;
    NEW.blog_coupon  := 0;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_fold_promo_to_mileage on public.profiles;
create trigger trg_fold_promo_to_mileage
  before insert or update on public.profiles
  for each row execute function public._fold_promo_to_mileage();

-- 확인
select
  (select count(*) from public.profiles where coalesce(event_coupon,0)<>0 or coalesce(blog_coupon,0)<>0) as remaining_nonzero,
  (select coalesce(sum(mileage),0) from public.profiles) as total_mileage;
