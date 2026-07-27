-- 2026-07-28: 끝말잇기 다국어화 — KR(끝말잇기)/JP(しりとり)/EN(word chain) 별도 체인.
alter table public.word_chain add column if not exists lang text not null default 'kr';
create index if not exists idx_word_chain_lang on public.word_chain(lang, id desc);

drop function if exists public.word_chain_status();
drop function if exists public.word_chain_play(text);

create or replace function public.word_chain_status(p_lang text default 'kr')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _lang text := coalesce(nullif(p_lang,''),'kr');
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _last_word text; _last_char text; _recent jsonb; _plays int := 0;
begin
  select word, last_char into _last_word, _last_char
    from public.word_chain where lang = _lang order by id desc limit 1;
  select coalesce(jsonb_agg(x.word order by x.id desc), '[]'::jsonb) into _recent
    from (select word, id from public.word_chain where lang = _lang order by id desc limit 10) x;
  if _uid is not null then
    select count(*) into _plays from public.reward_events
     where user_id = _uid and event_type = 'wordchain'
       and (created_at at time zone 'Asia/Seoul')::date = _today;
  end if;
  return jsonb_build_object('ok', true, 'lang', _lang, 'last_word', _last_word,
    'next_char', _last_char, 'recent', _recent, 'plays_today', coalesce(_plays,0), 'cap', 3);
end $$;

create or replace function public.word_chain_play(p_word text, p_lang text default 'kr')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _lang text := coalesce(nullif(p_lang,''),'kr');
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _w text := btrim(coalesce(p_word,''));
  _cap int := 3; _rew_today int;
  _last_word text; _last_char text; _fc text; _lc text; _fc_cmp text; _dup boolean;
  _mil int; _cred int; _reward boolean := true;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if char_length(_w) < 2 then return jsonb_build_object('ok', false, 'reason', 'short'); end if;
  if _lang = 'ja' then
    if _w ~ '[^ぁ-んァ-ヶー]' then return jsonb_build_object('ok', false, 'reason', 'notvalid'); end if;
    if right(_w,1) = 'ん' then return jsonb_build_object('ok', false, 'reason', 'endn'); end if;
  elsif _lang = 'en' then
    if _w ~ '[^a-zA-Z]' then return jsonb_build_object('ok', false, 'reason', 'notvalid'); end if;
  else
    if _w ~ '[^가-힣]' then return jsonb_build_object('ok', false, 'reason', 'notvalid'); end if;
  end if;

  select word, last_char into _last_word, _last_char
    from public.word_chain where lang = _lang order by id desc limit 1;
  _fc := left(_w,1); _lc := right(_w,1);
  if _lang = 'en' then _fc_cmp := lower(_fc); _lc := lower(_lc); else _fc_cmp := _fc; end if;
  if _last_word is not null and _last_char is not null and _fc_cmp <> _last_char then
    return jsonb_build_object('ok', false, 'reason', 'chain', 'need', _last_char);
  end if;
  select exists(select 1 from public.word_chain where lang = _lang and lower(word) = lower(_w)) into _dup;
  if _dup then return jsonb_build_object('ok', false, 'reason', 'dup'); end if;

  insert into public.word_chain(word, first_char, last_char, user_id, lang)
    values (_w, _fc_cmp, _lc, _uid, _lang);

  select count(*) into _rew_today from public.reward_events
   where user_id = _uid and event_type = 'wordchain'
     and (created_at at time zone 'Asia/Seoul')::date = _today;
  if coalesce(_rew_today,0) >= _cap then _reward := false; end if;

  if _reward then
    update public.profiles set mileage = coalesce(mileage,0)+500, ai_credit = coalesce(ai_credit,3)+1
      where id = _uid returning mileage, ai_credit into _mil, _cred;
    insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
      values (_uid, 'wordchain', 500, 1, _lang || ':' || _w);
    begin insert into public.wallet_logs(user_id, type, amount, description)
      values (_uid, 'wordchain', 500, 'wordchain reward'); exception when others then null; end;
  end if;

  return jsonb_build_object('ok', true, 'rewarded', _reward,
    'mileage_added', case when _reward then 500 else 0 end,
    'credit_added', case when _reward then 1 else 0 end,
    'next_char', _lc, 'word', _w, 'lang', _lang, 'cap', _cap);
end $$;

grant execute on function public.word_chain_status(text)       to authenticated, anon;
grant execute on function public.word_chain_play(text, text)   to authenticated;
