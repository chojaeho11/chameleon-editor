-- 2026-05-14: 스태프 목록 (admin_staff role='manager') 의 모든 매니저를
--             profiles.role='manager' 로 일괄 승격
--
-- 효과: 로그인 시 isAdmin 검사가 ADMIN_EMAILS 미일치라도 profiles.role 로 통과
--       → 메인 홈 결제대기 배너 + 카트 '🎁 고객 결제창 만들어주기' 버튼 자동 노출
--
-- profiles 컬럼: id, email, username, role, site, deposit, mileage, nickname, avatar_url ...
-- admin_staff 컬럼: id, name, role, color
--
-- ────────────────────────────────────────────────────────────────────
-- 매칭 방식: admin_staff.name = profiles.username 또는 profiles.nickname
-- ────────────────────────────────────────────────────────────────────
UPDATE profiles
SET role = 'manager'
WHERE id IN (
    SELECT p.id FROM profiles p
    INNER JOIN admin_staff s ON (s.name = p.username OR s.name = p.nickname)
    WHERE s.role = 'manager'
      AND (p.role IS NULL OR p.role NOT IN ('admin', 'manager'))
);

-- ────────────────────────────────────────────────────────────────────
-- 옵션 B) 이메일 직접 지정 (위 매칭에서 누락된 매니저)
-- ────────────────────────────────────────────────────────────────────
-- UPDATE profiles SET role = 'manager'
-- WHERE email IN (
--     'scr3257@naver.com',           -- 박성희
--     '강은미 이메일',
--     '조지숙 이메일',
--     '최연두 이메일',
--     '이명현 이메일',
--     '임혜민 이메일',
--     '이선율 이메일',
--     '정미선 이메일',
--     '이가현 이메일'
-- );

-- ────────────────────────────────────────────────────────────────────
-- 결과 확인 — 옵션 A 실행 후 이걸 돌려서 매니저로 잡힌 사람 확인
-- ────────────────────────────────────────────────────────────────────
-- SELECT p.id, p.email, p.username, p.nickname, p.role, s.name as staff_name, s.role as staff_role
-- FROM profiles p
-- LEFT JOIN admin_staff s ON (s.name = p.username OR s.name = p.nickname)
-- WHERE p.role = 'manager' OR s.role = 'manager'
-- ORDER BY p.role DESC NULLS LAST, p.email;

-- ────────────────────────────────────────────────────────────────────
-- (참고) 어떤 admin_staff 매니저가 profiles 와 매칭이 안 됐는지 진단
-- ────────────────────────────────────────────────────────────────────
-- SELECT s.id, s.name, s.role
-- FROM admin_staff s
-- LEFT JOIN profiles p ON (s.name = p.username OR s.name = p.nickname)
-- WHERE s.role = 'manager' AND p.id IS NULL;
