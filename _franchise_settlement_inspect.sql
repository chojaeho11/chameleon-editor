-- ============================================================
-- 가맹 정산 원장/트리거 확인용 (2026-09-15)
-- franchise_settlements 자동 생성 트리거가 예전 20% 커미션인지 확인 → 1% 로열티로 교정 예정.
-- 아래 3개를 실행하고 결과를 붙여 주세요.
-- ============================================================

-- 1) franchise_settlements 컬럼 구조
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'franchise_settlements'
ORDER BY ordinal_position;

-- 2) orders / franchise_settlements 에 걸린 트리거 목록
SELECT event_object_table AS tbl, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('orders', 'franchise_settlements')
ORDER BY tbl, trigger_name;

-- 3) 정산 관련 함수 정의(소스) — 이름에 franchise/settlement 포함
SELECT p.proname AS func_name, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%franchise%' OR p.proname ILIKE '%settlement%');
