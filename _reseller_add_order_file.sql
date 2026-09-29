-- ============================================================
-- 리셀러 주문 콘솔 — 수정본 파일 첨부 (2026-09-29)
--   리셀러가 자기 주문(franchise_slug 소유)에만 파일 URL 을 orders.files 에 추가.
--   보안: SECURITY DEFINER + 소유 확인. Supabase SQL Editor 에서 실행.
--   ※ orders.files 가 jsonb 가 아니면 아래 '||' 부분에서 오류날 수 있음 — 그 경우 알려주세요(캐스팅 추가).
-- ============================================================
create or replace function reseller_add_order_file(p_order_id bigint, p_url text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_slug  text;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select franchise_slug into v_slug from orders where id = p_order_id;
  if v_slug is null then raise exception 'not a reseller order'; end if;

  select owner_id into v_owner from franchises where slug = v_slug;
  if v_owner is distinct from v_uid then raise exception 'not your order'; end if;

  update orders
     set files = coalesce(files, '[]'::jsonb)
                 || jsonb_build_array(jsonb_build_object('url', p_url, 'name', p_name, 'by', 'reseller', 'at', now()))
   where id = p_order_id;
end;
$$;

grant execute on function reseller_add_order_file(bigint, text, text) to authenticated, anon;

select 'reseller_add_order_file ready' as ok;
