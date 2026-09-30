-- ============================================================
-- 가맹/리셀러 승인·반려·승인취소 — 관리자 공용 RPC (2026-09-30 사장님)
--   기존: 프론트에서 직접 UPDATE → RLS 로 특정 계정만 허용되어 다른 관리자는 승인 불가.
--   변경: SECURITY DEFINER RPC 로 처리 + 내부 관리자 게이트(_is_hq_admin) → 페이지에 들어올 수 있는 관리자 전원 승인 가능.
--   Supabase SQL Editor 에서 실행.
-- ============================================================

-- 관리자 판정: 이메일 화이트리스트 OR profiles.role in (admin/superadmin/manager)
create or replace function public._is_hq_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select ((auth.jwt()->>'email') in ('korea900as@gmail.com','ceo@test.com','scr3257@naver.com'))
      or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin','manager'));
$$;

-- 승인: franchises.status=approved + owner 등급 부여 (관리자/매니저 계정은 등급 변경 안 함)
create or replace function public.fr_admin_approve(p_slug text, p_owner uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _cur text; _role text := p_role; _n int;
begin
  if not public._is_hq_admin() then raise exception 'forbidden'; end if;
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

-- 반려: status=rejected
create or replace function public.fr_admin_reject(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._is_hq_admin() then raise exception 'forbidden'; end if;
  update public.franchises set status='rejected' where slug=p_slug;
  return jsonb_build_object('ok', true);
end $$;

-- 승인취소: status=cancelled + owner 등급 customer 로 강등(관리자/매니저 제외)
create or replace function public.fr_admin_revoke(p_slug text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _cur text;
begin
  if not public._is_hq_admin() then raise exception 'forbidden'; end if;
  update public.franchises set status='cancelled' where slug=p_slug;
  if p_owner is not null then
    select role into _cur from public.profiles where id=p_owner;
    if coalesce(_cur,'') not in ('admin','superadmin','manager') then
      update public.profiles set role='customer' where id=p_owner;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public._is_hq_admin() to authenticated;
grant execute on function public.fr_admin_approve(text, uuid, text) to authenticated;
grant execute on function public.fr_admin_reject(text) to authenticated;
grant execute on function public.fr_admin_revoke(text, uuid) to authenticated;

select 'franchise admin rpcs ready' as ok;
