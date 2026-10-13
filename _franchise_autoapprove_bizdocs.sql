-- ============================================================
-- 리셀러·일반가맹점 자동승인 + 사업자등록증 업로드 + 관리자 확인 (2026-10-13 사장님)
--   - franchises 에 biz_no / biz_file_path 컬럼 추가
--   - fr_self_activate: 골드 자동승인 금지(가맹비 미결제 활성화 방지). 리셀러/일반가맹만 승인.
--   - 비공개 버킷 biz-docs + RLS(본인 업로드 / 관리자·본인 열람)
-- ============================================================

-- 1) 컬럼
alter table public.franchises
  add column if not exists biz_no text,
  add column if not exists biz_file_path text;

-- 2) fr_self_activate — 골드 제외(서버에서 차단, 클라만 믿지 않음)
create or replace function public.fr_self_activate(p_slug text, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- 골드(및 그 외)는 자동승인하지 않음 — 본사 수동승인 유지
  if p_type not in ('reseller','franchise') then
    return;
  end if;
  update public.franchises
     set status = 'approved'
   where slug = p_slug and owner_id = v_uid;
  update public.profiles
     set role = p_type
   where id = v_uid
     and coalesce(role,'') not in ('admin','superadmin','manager');
end;
$$;

grant execute on function public.fr_self_activate(text, text) to authenticated, anon;

-- 3) 비공개 버킷 biz-docs
insert into storage.buckets (id, name, public)
values ('biz-docs', 'biz-docs', false)
on conflict (id) do update set public = false;

-- 4) storage.objects RLS (idempotent: drop-then-create)
drop policy if exists "biz-docs own insert" on storage.objects;
create policy "biz-docs own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'biz-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "biz-docs own update" on storage.objects;
create policy "biz-docs own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'biz-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'biz-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "biz-docs admin owner select" on storage.objects;
create policy "biz-docs admin owner select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'biz-docs'
    and (
      public._is_fr_approver()
      or public._is_hq_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

select 'franchise autoapprove + biz-docs ready' as ok;
