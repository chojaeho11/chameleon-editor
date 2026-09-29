-- ============================================================
-- 주문별 메모 (리셀러 ↔ 본사) (2026-09-29)
--   리셀러 주문 콘솔에서 주문별로 본사와 소통. 보안: RLS 잠금 + SECURITY DEFINER RPC 로만 접근.
--   Supabase SQL Editor 에서 실행.
-- ============================================================
create table if not exists order_notes (
  id          bigint generated always as identity primary key,
  order_id    bigint not null,
  user_id     uuid,
  author      text,
  role        text,        -- 'reseller' | 'hq'
  body        text,
  created_at  timestamptz default now()
);
create index if not exists order_notes_order_idx on order_notes(order_id);
alter table order_notes enable row level security;   -- 정책 없음 → 아래 RPC(SECURITY DEFINER)로만 접근

-- 접근 권한 판정: 관리자 OR 그 주문의 가맹점 소유자
create or replace function _on_can_access(p_order_id bigint, p_uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select ((auth.jwt()->>'email') = 'korea900as@gmail.com')
      or exists (
           select 1 from orders o
             join franchises f on f.slug = o.franchise_slug
            where o.id = p_order_id and f.owner_id = p_uid
         );
$$;

-- 목록
create or replace function order_notes_list(p_order_id bigint)
returns setof order_notes language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not _on_can_access(p_order_id, v_uid) then raise exception 'forbidden'; end if;
  return query select * from order_notes where order_id = p_order_id order by created_at asc;
end; $$;

-- 등록 (관리자=hq / 그 외=reseller). author 는 서버에서 결정.
create or replace function order_notes_add(p_order_id bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_admin boolean; v_role text; v_author text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_body),'') = '' then return; end if;
  v_admin := ((auth.jwt()->>'email') = 'korea900as@gmail.com');
  if not (v_admin or _on_can_access(p_order_id, v_uid)) then raise exception 'forbidden'; end if;
  if v_admin then
    v_role := 'hq'; v_author := '본사';
  else
    v_role := 'reseller';
    select f.company_name into v_author
      from orders o join franchises f on f.slug = o.franchise_slug
     where o.id = p_order_id limit 1;
    v_author := coalesce(v_author, '가맹점');
  end if;
  insert into order_notes(order_id, user_id, author, role, body)
  values (p_order_id, v_uid, v_author, v_role, trim(p_body));
end; $$;

-- 카운트/최신 (리셀러 콘솔 배지 + 본사 미답변 목록용). p_slug 주면 그 가맹점 주문만.
create or replace function order_notes_counts(p_slug text default null)
returns table(order_id bigint, cnt bigint, last_role text, last_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_admin boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_admin := ((auth.jwt()->>'email') = 'korea900as@gmail.com');
  return query
    select n.order_id, count(*)::bigint,
           (array_agg(n.role order by n.created_at desc))[1],
           max(n.created_at)
      from order_notes n
      join orders o on o.id = n.order_id
     where (p_slug is null or o.franchise_slug = p_slug)
       and (
             v_admin
          or exists (select 1 from franchises f where f.slug = o.franchise_slug and f.owner_id = v_uid)
           )
     group by n.order_id;
end; $$;

grant execute on function order_notes_list(bigint)       to authenticated, anon;
grant execute on function order_notes_add(bigint, text)  to authenticated, anon;
grant execute on function order_notes_counts(text)       to authenticated, anon;

select 'order_notes ready' as ok;
