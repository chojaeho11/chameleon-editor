-- ============================================================
-- 회원 등급 4단계로 정리  (2026-09-15 사장님 지시)
--   최종 등급 = 일반(customer) / 리셀러(reseller, 10%) / 가맹점(franchise, 20%) / 관리자(admin)
--   전환 규칙:
--     · 가맹점(franchise) + 구독자(subscriber) + 활성 구독  →  리셀러(reseller)   ["리셀러만 있어야해"]
--     · 파트너스(platinum/partner/partners) + 골드(gold)      →  일반(customer)     ["전부 일반으로"]
--     · 관리자(admin)/매니저(manager)                          →  그대로 유지
-- Supabase → SQL Editor 에서 실행하세요.
-- ============================================================

-- STEP 1) 현재 등급별 인원 미리보기
SELECT role, COUNT(*) AS n FROM profiles GROUP BY role ORDER BY n DESC;

-- STEP 2-A) 가맹점·구독자·활성구독 → 리셀러(10%)
UPDATE profiles
SET role = 'reseller'
WHERE (
        role IN ('franchise', 'subscriber')
        OR id IN (SELECT user_id FROM subscriptions WHERE status = 'active')
      )
  AND COALESCE(role, '') NOT IN ('admin', 'manager');

-- STEP 2-B) 파트너스·골드 → 일반(0%)
UPDATE profiles
SET role = 'customer'
WHERE role IN ('platinum', 'partner', 'partners', 'gold');

-- STEP 3) 확인 — 최종 등급별 인원 (franchise/platinum/gold/subscriber 는 0 이어야 함)
SELECT role, COUNT(*) AS n FROM profiles GROUP BY role ORDER BY n DESC;

-- ============================================================
-- 참고) 나중에 특정 회원을 진짜 가맹점(20%, 장비 보유)으로 올리려면:
--   UPDATE profiles SET role = 'franchise' WHERE email = 'owner@example.com';
-- 또는 관리자 페이지(고객관리)의 등급 변경 드롭다운 / 가맹 신청 승인 패널에서 지정.
-- ============================================================
