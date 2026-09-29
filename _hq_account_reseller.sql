-- ============================================================
-- 본사 계정(korea900as@gmail.com) 관리자 + 리셀러 겸용 (2026-09-29)
--   · profiles.role = 'reseller'  → 완제품 20% 할인 + 리셀러 주문 콘솔
--   · 관리자 접근은 코드의 이메일 화이트리스트로 유지(checkAdminAccess v436) → 관리자 페이지 그대로 사용
--   · 리셀러 콘솔(franchise.html)이 뜨려면 approved franchises 행이 필요 → 없으면 테스트용 생성
--   Supabase SQL Editor 에서 실행.
-- ============================================================

-- 1) 역할을 리셀러로
update profiles
   set role = 'reseller'
 where id = (select id from auth.users where lower(email) = 'korea900as@gmail.com');

-- 2) approved 가맹(리셀러) 행 보장
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = 'korea900as@gmail.com';
  if v_uid is null then raise exception '계정을 찾을 수 없습니다'; end if;

  if exists (select 1 from franchises where owner_id = v_uid) then
    update franchises set status = 'approved' where owner_id = v_uid;
  else
    insert into franchises (owner_id, slug, company_name, phone, country, status, updated_at)
    values (v_uid, 'hq-reseller-test', '본사 테스트(리셀러)', '01088212626', 'KR', 'approved', now());
  end if;
end $$;

-- 3) 확인
select 'role=' || coalesce((select role from profiles where id=(select id from auth.users where lower(email)='korea900as@gmail.com')),'(none)') as role_check;
select slug, status from franchises where owner_id = (select id from auth.users where lower(email)='korea900as@gmail.com');
