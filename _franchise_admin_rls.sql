-- ============================================================
-- 본사 관리자 가맹/리셀러 승인·반려 RLS 정책  (2026-09-15)
-- 관리자 페이지(고객관리)의 승인/반려/취소 버튼이 "토스트만 뜨고 실제로 안 바뀔" 때 실행하세요.
--
-- 원인: franchises 테이블 RLS 가 "본인 소유 행만 수정" 이라, 관리자가 남의 신청을
--       승인/반려하려 하면 UPDATE 가 0행만 반영(조용한 실패) → 화면이 안 바뀜.
-- 해결: 관리자 이메일(korea900as@gmail.com) 은 franchises 전체를 수정할 수 있게 허용.
-- ============================================================

-- franchises: 관리자 전체 접근(조회·수정) 정책
DROP POLICY IF EXISTS hq_admin_all_franchises ON franchises;
CREATE POLICY hq_admin_all_franchises ON franchises
  FOR ALL
  USING ( (auth.jwt() ->> 'email') = 'korea900as@gmail.com' )
  WITH CHECK ( (auth.jwt() ->> 'email') = 'korea900as@gmail.com' );

-- profiles: 승인 시 등급(role) 부여도 관리자가 할 수 있어야 함.
--   (이미 회원관리 등급변경이 되고 있으면 이 블록은 없어도 됩니다. 안 되면 같이 실행.)
DROP POLICY IF EXISTS hq_admin_update_profiles ON profiles;
CREATE POLICY hq_admin_update_profiles ON profiles
  FOR UPDATE
  USING ( (auth.jwt() ->> 'email') = 'korea900as@gmail.com' )
  WITH CHECK ( (auth.jwt() ->> 'email') = 'korea900as@gmail.com' );

-- 확인: 정책 목록
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('franchises','profiles') ORDER BY tablename, policyname;
