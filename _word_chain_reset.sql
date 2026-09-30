-- ============================================================
-- 끝말잇기 새로 시작(리셋) RPC (2026-09-30 사장님)
--   너무 어려운 글자에서 막히면 체인을 초기화 → 누구나 새 단어로 시작.
--   Supabase SQL Editor 에서 실행.
-- ============================================================
create or replace function public.word_chain_reset(p_lang text default 'kr')
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _lang text := coalesce(nullif(p_lang,''),'kr');
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  delete from public.word_chain where lang = _lang;   -- 체인 초기화(다음 단어는 아무거나 가능)
  return jsonb_build_object('ok', true, 'lang', _lang);
end $$;
grant execute on function public.word_chain_reset(text) to authenticated;

select 'word_chain_reset ready' as ok;
