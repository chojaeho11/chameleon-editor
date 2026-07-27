-- 2026-07-28: 끝말잇기(word-chain) 커뮤니티 게임 — 출석체크 대체.
--  전 회원이 하나의 체인을 이어감. 유효한 단어를 이으면 선물(마일리지+생성권).
--  규칙: 이전 단어의 마지막 글자(음절)로 시작 / 2글자 이상 순수 한글 / 이미 쓴 단어 금지.
--  하루 3회까지 보상(그 이상은 이어갈 순 있지만 보상 없음). 잔액/한도/중복은 서버(RPC)가 확정.

create table if not exists public.word_chain (
  id         bigint generated always as identity primary key,
  word       text not null,
  first_char text,
  last_char  text,
  user_id    uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_word_chain_id on public.word_chain(id desc);
alter table public.word_chain enable row level security;
drop policy if exists word_chain_read on public.word_chain;
create policy word_chain_read on public.word_chain for select using (true);  -- 체인은 누구나 조회

-- 현재 상태 (마지막 단어 / 다음 시작글자 / 최근목록 / 오늘 내 플레이수)
create or replace function public.word_chain_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _last_word text; _last_char text; _recent jsonb; _plays int := 0;
begin
  select word, last_char into _last_word, _last_char from public.word_chain order by id desc limit 1;
  select coalesce(jsonb_agg(x.word order by x.id desc), '[]'::jsonb) into _recent
    from (select word, id from public.word_chain order by id desc limit 10) x;
  if _uid is not null then
    select count(*) into _plays from public.word_chain
     where user_id = _uid and (created_at at time zone 'Asia/Seoul')::date = _today;
  end if;
  return jsonb_build_object('ok', true, 'last_word', _last_word, 'next_char', _last_char,
                            'recent', _recent, 'plays_today', coalesce(_plays,0), 'cap', 3);
end $$;

-- 단어 이어가기 + 보상
create or replace function public.word_chain_play(p_word text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _w text := btrim(coalesce(p_word, ''));
  _cap int := 3; _plays int; _last_word text; _last_char text;
  _fc text; _lc text; _dup boolean;
  _mil int; _cred int; _reward boolean := true;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if char_length(_w) < 2 then return jsonb_build_object('ok', false, 'reason', 'short'); end if;
  -- 순수 한글(공백/특수문자/영문/숫자 불가)
  if _w ~ '[^가-힣]' then return jsonb_build_object('ok', false, 'reason', 'notkorean'); end if;

  select word, last_char into _last_word, _last_char from public.word_chain order by id desc limit 1;
  _fc := left(_w, 1); _lc := right(_w, 1);
  if _last_word is not null and _last_char is not null and _fc <> _last_char then
    return jsonb_build_object('ok', false, 'reason', 'chain', 'need', _last_char);
  end if;
  select exists(select 1 from public.word_chain where word = _w) into _dup;
  if _dup then return jsonb_build_object('ok', false, 'reason', 'dup'); end if;

  insert into public.word_chain(word, first_char, last_char, user_id) values (_w, _fc, _lc, _uid);

  -- 하루 3회까지만 보상 (이어가기는 무제한, 보상만 캡)
  select count(*) into _plays from public.word_chain
   where user_id = _uid and (created_at at time zone 'Asia/Seoul')::date = _today;
  if coalesce(_plays,0) > _cap then _reward := false; end if;

  if _reward then
    update public.profiles set mileage = coalesce(mileage,0) + 500,
                               ai_credit = coalesce(ai_credit,3) + 1
     where id = _uid returning mileage, ai_credit into _mil, _cred;
    insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
      values (_uid, 'wordchain', 500, 1, _w);
    begin insert into public.wallet_logs(user_id, type, amount, description)
      values (_uid, 'wordchain', 500, '끝말잇기 보상'); exception when others then null; end;
  end if;

  return jsonb_build_object('ok', true, 'rewarded', _reward,
     'mileage_added', case when _reward then 500 else 0 end,
     'credit_added', case when _reward then 1 else 0 end,
     'next_char', _lc, 'word', _w, 'plays_today', _plays, 'cap', _cap);
end $$;

grant execute on function public.word_chain_status()      to authenticated, anon;
grant execute on function public.word_chain_play(text)    to authenticated;
