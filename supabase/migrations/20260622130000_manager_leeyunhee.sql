-- 2026-06-22 v695: 새 매니저 이윤희 등록 (010-5799-9953)
--   admin_staff 에는 직원관리 UI 로 이미 등록되어 있음 (role='manager').
--   chatbot_knowledge category='_managers' 에도 row 추가 → 챗봇/전화팝업/주문관리 자동 노출.
--   answer JSON: {"phone":"01057999953"} (하이픈 없이 11자리, UI 가 포맷팅)

INSERT INTO chatbot_knowledge (category, question, answer, is_active, keywords, priority)
SELECT '_managers', '이윤희', '{"phone":"01057999953"}'::jsonb, true,
       ARRAY['윤희','이윤희','manager','매니저'], 100
WHERE NOT EXISTS (
    SELECT 1 FROM chatbot_knowledge
    WHERE category='_managers' AND question='이윤희'
);

-- admin_staff 도 안전하게 보장 (UI 등록 이미 했더라도 IF NOT EXISTS 보호)
INSERT INTO admin_staff (name, role, color)
SELECT '이윤희', 'manager', '#ec4899'
WHERE NOT EXISTS (
    SELECT 1 FROM admin_staff WHERE name='이윤희' AND role='manager'
);
