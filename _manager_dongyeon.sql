-- 2026-10-07(사장님): 새 매니저 '동연'(yeon4211@naver.com) 등록.
--   profiles.role='manager' → 관리자 접근 권한. admin_staff → 페이정산/배정.
--   chatbot_knowledge._managers (전화번호 없음) → 주문관리 매니저 배정 드롭다운에 노출.
--     (고객용 전화안내는 전화번호 있는 '혜림'만 코드필터로 노출하므로 동연은 안 뜸)
--   Supabase SQL Editor 에서 실행.

-- 1) 등급(접근권한)
UPDATE profiles
SET role = 'manager'
WHERE id = (SELECT id FROM auth.users WHERE email = 'yeon4211@naver.com');

-- 2) 페이정산/배정용 직원
INSERT INTO admin_staff (name, role, color)
SELECT '동연', 'manager', '#f59e0b'
WHERE NOT EXISTS (
    SELECT 1 FROM admin_staff WHERE name='동연' AND role='manager'
);

-- 3) 주문관리 매니저 배정 드롭다운 노출용 (_managers, 전화번호 없음)
INSERT INTO chatbot_knowledge (category, question, answer, is_active, keywords, priority)
SELECT '_managers', '동연', '{}'::jsonb, true,
       ARRAY['동연','manager','매니저'], 100
WHERE NOT EXISTS (
    SELECT 1 FROM chatbot_knowledge WHERE category='_managers' AND question='동연'
);

select 'manager dongyeon ready' as ok,
       (SELECT role FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email='yeon4211@naver.com')) as profile_role;
