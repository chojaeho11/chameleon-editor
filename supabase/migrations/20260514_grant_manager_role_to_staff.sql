-- 2026-05-14: 스태프 목록 (admin_staff role='manager') 의 모든 매니저를
--             profiles.role='manager' 로 일괄 승격
--
-- 효과: 로그인 시 isAdmin 검사가 ADMIN_EMAILS 미일치라도 profiles.role 로 통과
--       → 메인 홈 결제대기 배너 + 카트 '🎁 고객 결제창 만들어주기' 버튼 자동 노출
--
-- ⚠ 실행 전 admin_staff 와 profiles 사이의 매칭 방식을 확인하세요.
--   기본 가정: admin_staff.name 과 profiles.username 또는 profiles.full_name 일치
--
-- ────────────────────────────────────────────────────────────────────
-- 옵션 A) admin_staff.name = profiles.username 으로 매칭 (가장 흔한 케이스)
-- ────────────────────────────────────────────────────────────────────
UPDATE profiles SET role = 'manager'
WHERE id IN (
    SELECT p.id FROM profiles p
    INNER JOIN admin_staff s ON (s.name = p.username OR s.name = p.full_name)
    WHERE s.role = 'manager'
      AND (p.role IS NULL OR p.role NOT IN ('admin', 'manager'))
);

-- ────────────────────────────────────────────────────────────────────
-- 옵션 B) 위로도 안 잡히면, 알려진 매니저 이메일 직접 지정 (확장 가능)
-- ────────────────────────────────────────────────────────────────────
-- UPDATE profiles SET role = 'manager'
-- WHERE email IN (
--     'scr3257@naver.com',           -- 박성희
--     '추가 매니저 이메일',
--     '...'
-- );

-- ────────────────────────────────────────────────────────────────────
-- 결과 확인
-- ────────────────────────────────────────────────────────────────────
-- SELECT p.id, p.email, p.username, p.role, s.name as staff_name, s.role as staff_role
-- FROM profiles p
-- LEFT JOIN admin_staff s ON (s.name = p.username OR s.name = p.full_name)
-- WHERE p.role IN ('admin', 'manager') OR s.role = 'manager'
-- ORDER BY p.role NULLS LAST, p.email;
