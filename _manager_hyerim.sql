-- 2026-10-02(사장님): 새 매니저 '혜림'(nadiaseo@kakao.com / 서혜림 이사) 등록. 전화 010-3491-3535.
--   chatbot_knowledge _managers → 매니저 휴가관리·챗봇 전화안내 노출. admin_staff → 페이정산/배정.
--   (등급 role='manager' 은 고객관리에서 별도 설정) Supabase SQL Editor 에서 실행.

INSERT INTO chatbot_knowledge (category, question, answer, is_active, keywords, priority)
SELECT '_managers', '혜림', '{"phone":"01034913535"}'::jsonb, true,
       ARRAY['혜림','서혜림','나디아','manager','매니저'], 100
WHERE NOT EXISTS (
    SELECT 1 FROM chatbot_knowledge WHERE category='_managers' AND question='혜림'
);

INSERT INTO admin_staff (name, role, color)
SELECT '혜림', 'manager', '#0ea5e9'
WHERE NOT EXISTS (
    SELECT 1 FROM admin_staff WHERE name='혜림' AND role='manager'
);

select 'manager hyerim ready' as ok;
