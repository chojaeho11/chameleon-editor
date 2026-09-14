-- ============================================================
-- 기존 회원 등급 정리 → 전부 리셀러(reseller) 로  (2026-09-15 사장님 지시)
-- "현재 가맹점이 없어야 하는데 엄청 많아. 리셀러만 있어야해."
--   지난 세션에서 구독회원들이 role='franchise'(가맹점 20%)로 저장됨 → 전부 리셀러(10%)로 전환.
--   reseller = 매입 할인 10% / franchise = 20% (가맹점은 본사가 개별 승인 시에만 지정)
-- Supabase → SQL Editor 에서 실행하세요.
-- ============================================================

-- STEP 1) 먼저 대상 미리보기 (현재 가맹점/구독자 인원 확인)
SELECT p.id, p.email, p.role,
       (SELECT string_agg(s.plan_type || ':' || s.status, ', ')
          FROM subscriptions s WHERE s.user_id = p.id) AS subs
FROM profiles p
WHERE p.role IN ('franchise', 'subscriber')
   OR p.id IN (SELECT user_id FROM subscriptions WHERE status = 'active')
ORDER BY p.role, p.email;

-- STEP 2) 위 목록이 맞으면 실행 — 전부 리셀러로 전환 (관리자/매니저 제외)
UPDATE profiles
SET role = 'reseller'
WHERE (
        role IN ('franchise', 'subscriber')
        OR id IN (SELECT user_id FROM subscriptions WHERE status = 'active')
      )
  AND COALESCE(role, '') NOT IN ('admin', 'manager');

-- STEP 3) 확인 — 등급별 인원수 (franchise 는 0 이어야 함)
SELECT role, COUNT(*) FROM profiles WHERE role IN ('franchise','reseller','subscriber') GROUP BY role;

-- ============================================================
-- 참고) 나중에 특정 회원을 진짜 가맹점(20%, 장비 보유)으로 올리려면:
--   UPDATE profiles SET role = 'franchise' WHERE email = 'owner@example.com';
-- 또는 관리자 페이지(고객관리)의 등급 변경 드롭다운에서 지정.
-- ============================================================
