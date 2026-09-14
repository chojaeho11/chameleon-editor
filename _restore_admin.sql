-- ============================================================
-- 관리자 계정 복구 (2026-09-15)
-- 사장님 계정(korea900as)을 본인 홈페이지의 가맹점으로 승인하면서 role 이 admin→franchise 로 바뀜.
-- global_common.js checkAdminAccess 는 role='admin' 만 통과 → 관리자 페이지 로그인 튕김.
-- 아래 실행하면 즉시 복구됩니다.
-- ============================================================

UPDATE profiles SET role = 'admin' WHERE email = 'korea900as@gmail.com';

-- 확인
SELECT id, email, role FROM profiles WHERE email = 'korea900as@gmail.com';
