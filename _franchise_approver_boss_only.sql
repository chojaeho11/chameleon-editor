-- ============================================================
-- 가맹점·리셀러 승인/반려/승인취소 권한을 대표 계정 1개로 한정 (2026-10-12 사장님)
--   기존 _is_hq_admin() 는 admin/superadmin/manager 전원 허용 → 매니저도 승인 가능했음.
--   요청: korea900as@gmail.com 만 승인/반려/승인취소 가능하게.
--   방법: 전용 게이트 _is_fr_approver() (이메일 1개) 추가 + 3개 RPC 가 이걸 쓰도록 교체.
-- ============================================================

create or replace function public._is_fr_approver()
returns boolean language sql security definer set search_path = public stable as $$
  select lower(coalesce(auth.jwt()->>'email','')) = 'korea900as@gmail.com';
$$;

-- 승인
create or replace function public.fr_admin_approve(p_slug text, p_owner uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _cur text; _role text := p_role; _n int;
begin
  if not public._is_fr_approver() then raise exception 'forbidden'; end if;
  if _role not in ('reseller','franchise','gold') then _role := 'reseller'; end if;
  update public.franchises set status='approved' where slug=p_slug;
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'slug not found: %', p_slug; end if;
  if p_owner is not null then
    select role into _cur from public.profiles where id=p_owner;
    if coalesce(_cur,'') not in ('admin','superadmin','manager') then
      update public.profiles set role=_role where id=p_owner;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'role', _role, 'role_skipped', (coalesce(_cur,'') in ('admin','superadmin','manager')));
end $$;

-- 반려
create or replace function public.fr_admin_reject(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._is_fr_approver() then raise exception 'forbidden'; end if;
  update public.franchises set status='rejected' where slug=p_slug;
  return jsonb_build_object('ok', true);
end $$;

-- 승인취소
create or replace function public.fr_admin_revoke(p_slug text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _cur text;
begin
  if not public._is_fr_approver() then raise exception 'forbidden'; end if;
  update public.franchises set status='cancelled' where slug=p_slug;
  if p_owner is not null then
    select role into _cur from public.profiles where id=p_owner;
    if coalesce(_cur,'') not in ('admin','superadmin','manager') then
      update public.profiles set role='customer' where id=p_owner;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public._is_fr_approver() to authenticated;

select 'franchise approver restricted to boss only' as ok;
