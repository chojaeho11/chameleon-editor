-- 2026-10-07(사장님): 새 매니저 '동연'(yeon4211@naver.com) 등록.
--   profiles.role='manager' → 관리자 접근 권한. admin_staff → 페이정산/배정.
--   전화번호 미제공 → 챗봇/휴가관리 전화안내(현재 혜림 전용)에는 넣지 않음.
--   Supabase SQL Editor 에서 실행.

UPDATE profiles
SET role = 'manager'
WHERE id = (SELECT id FROM auth.users WHERE email = 'yeon4211@naver.com');

INSERT INTO admin_staff (name, role, color)
SELECT '동연', 'manager', '#f59e0b'
WHERE NOT EXISTS (
    SELECT 1 FROM admin_staff WHERE name='동연' AND role='manager'
);

select 'manager dongyeon ready' as ok,
       (SELECT role FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email='yeon4211@naver.com')) as profile_role;
