-- ============================================================
-- (필요 시에만) 본사 관리자 가맹 승인 RLS 정책  (2026-09-15)
-- franchise_hq 승인/반려/취소 버튼이 "동작 안 함/권한 오류" 가 뜰 때만 실행하세요.
-- 정상 동작하면 이 파일은 실행할 필요 없습니다.
--
-- 증상: franchise_hq 에서 ✅승인 눌렀는데 상태가 안 바뀜 (RLS 가 남의 franchises 행 UPDATE 를 막음).
-- 원인: franchises 는 원래 "본인 소유 행만 수정" RLS 라, 관리자가 남의 신청을 승인 못 함.
-- 해결: profiles.role='admin' 인 사용자는 모든 franchises 행을 수정할 수 있게 허용.
-- ============================================================

-- 관리자(본사) 계정이 admin 등급인지 먼저 확인
SELECT id, email, role FROM profiles WHERE email = 'korea900as@gmail.com';
-- role 이 'admin' 이 아니면:  UPDATE profiles SET role='admin' WHERE email='korea900as@gmail.com';

-- franchises UPDATE 관리자 정책 (승인/반려/취소용)
DROP POLICY IF EXISTS hq_admin_update_franchises ON franchises;
CREATE POLICY hq_admin_update_franchises ON franchises
  FOR UPDATE
  USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- (profiles.role 변경 정책은 이미 global_admin 회원관리에서 동작 중이므로 별도 불필요.
--  만약 승인 시 등급 부여가 안 되면 profiles 에도 동일 admin UPDATE 정책이 필요합니다.)
