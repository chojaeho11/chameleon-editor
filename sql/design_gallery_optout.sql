-- 2026-07-27: 고객이 방금 만든 AI 작품을 메인 갤러리에서 빼는 옵트아웃 RPC
--   design_gallery 는 RLS ON + UPDATE 정책이 없어 클라이언트 직접 update 가 막힌다.
--   본인(auth.uid()=user_id) 이거나, 방금 만든 건(최근 30분) 이면 status='hidden' 으로.
--   hidden 은 비파괴적 — 공개 갤러리(status='public')에서만 빠지고, 본인 보관함(dg_read_own)엔 그대로.
--   비회원(user_id null)도 생성 직후 30분 내엔 자기 작품을 뺄 수 있게 한다.

create or replace function public.dg_optout(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare _n int;
begin
  update design_gallery
     set status = 'hidden'
   where id = p_id
     and status <> 'hidden'
     and (auth.uid() = user_id or created_at > now() - interval '30 minutes');
  get diagnostics _n = row_count;
  return _n > 0;
end;
$$;

grant execute on function public.dg_optout(bigint) to anon, authenticated;
