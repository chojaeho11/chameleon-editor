-- ============================================================
-- 가맹점·리셀러 즉시 활성화 (2026-09-29, 사장님: 본사 승인 없이 가입 즉시 활성)
--   저장 시 본인 소유 franchise 를 approved 로, 본인 profiles.role 을 신청유형으로 부여.
--   보안: SECURITY DEFINER + auth.uid() 소유 확인 + 관리자/매니저 등급은 건드리지 않음.
--   Supabase SQL Editor 에 붙여넣고 실행하세요.
-- ============================================================
create or replace function fr_self_activate(p_slug text, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_role := case when p_type in ('gold','franchise','reseller') then p_type else 'reseller' end;

  -- 본인 소유 가맹점만 즉시 승인
  update franchises
     set status = 'approved'
   where slug = p_slug and owner_id = v_uid;

  -- 본인 등급 부여 (관리자/매니저 계정은 보호 — 강등 방지)
  update profiles
     set role = v_role
   where id = v_uid
     and coalesce(role,'') not in ('admin','superadmin','manager');
end;
$$;

grant execute on function fr_self_activate(text, text) to authenticated, anon;

select 'fr_self_activate ready' as ok;
