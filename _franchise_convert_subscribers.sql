-- ============================================================
-- 기존 PRO 구독회원 → 리셀러(reseller) 전환  (2026-09-15 사장님 지시)
-- "기존 구독회원은 가맹점이 아닌 리셀러로 10% 할인으로 변경"
--   reseller role = fetchUserDiscountRate 에서 매입 할인 10% 로 매핑됨.
--   (가맹점 franchise = 20%, 리셀러 reseller = 10%)
-- Supabase → SQL Editor 에서 실행하세요.
-- ============================================================

-- STEP 1) 먼저 대상 미리보기 (몇 명인지 확인 — 예상 28명)
SELECT p.id, p.email, p.role,
       (SELECT string_agg(s.plan_type || ':' || s.status, ', ')
          FROM subscriptions s WHERE s.user_id = p.id) AS subs
FROM profiles p
WHERE (
        p.role = 'subscriber'
        OR p.id IN (SELECT user_id FROM subscriptions WHERE status = 'active')
      )
  AND COALESCE(p.role, '') NOT IN ('admin', 'manager')   -- 관리자/매니저 제외
ORDER BY p.email;

-- STEP 2) 위 목록이 맞으면 실행 — 리셀러로 전환
UPDATE profiles
SET role = 'reseller'
WHERE (
        role = 'subscriber'
        OR id IN (SELECT user_id FROM subscriptions WHERE status = 'active')
      )
  AND COALESCE(role, '') NOT IN ('admin', 'manager');

-- STEP 3) 확인 — 리셀러 인원수
SELECT COUNT(*) AS reseller_count FROM profiles WHERE role = 'reseller';

-- ============================================================
-- 참고) 특정 가맹점주를 가맹점(20%)으로 지정하려면:
--   UPDATE profiles SET role = 'franchise' WHERE email = 'owner@example.com';
-- 관리자 페이지(회원관리)에서 등급 드롭다운으로도 리셀러/가맹점 지정 가능.
-- ============================================================
