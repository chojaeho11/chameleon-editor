-- ============================================================
-- 현재 대기(pending) 가맹/리셀러 신청 전체 반려  (2026-09-15 사장님 지시)
-- "이 신청들은 일단 반려해줘" — 반려해도 재신청 가능(신청자가 다시 저장하면 pending 으로 복귀).
-- Supabase → SQL Editor 에서 실행.
-- ============================================================

-- 미리보기
SELECT slug, company_name, status FROM franchises WHERE COALESCE(status,'pending')='pending';

-- 전체 반려
UPDATE franchises SET status='rejected' WHERE COALESCE(status,'pending')='pending';

-- 확인
SELECT status, COUNT(*) FROM franchises GROUP BY status;
