-- 2026-06-01: event_coupon column for separate event-promo balance.
-- Distinct from profiles.mileage (legacy loyalty points) so old customers'
-- accumulated mileage doesn't get conflated with new event promo coupons.
--
-- Usage rules differ:
--   mileage      : used at 5% of order amount, no absolute cap (legacy)
--   event_coupon : used at 50% of order AND max 50,000 KRW absolute (event)
--   deposit      : full balance usable (legacy)
--   PRO subscriber 10% : computed live, not a balance
--
-- All four are MUTUALLY EXCLUSIVE — only the largest discount applies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS event_coupon INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.event_coupon IS
  '이벤트 쿠폰 잔액 (KRW). 회원가입 30K + SNS 공유 100K 등. mileage(legacy 5%)와 별도. 구매금액 50% + 절대 50K 한도.';

-- RLS: 사용자는 본인의 event_coupon 만 SELECT/UPDATE 가능 (기존 profiles_*_own 정책에 자동 포함됨 — column 단위가 아닌 row 단위).
-- 관리자(approver) 가 다른 사용자의 event_coupon 을 UPDATE 하려면 service_role 또는 admin role 정책 필요.
-- 기존 profiles 테이블에 admin upsert/update 정책이 이미 있다면 그대로 작동.

-- 검증용 쿼리 (실행 후 확인):
-- SELECT column_name, data_type, column_default FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='profiles' AND column_name='event_coupon';
