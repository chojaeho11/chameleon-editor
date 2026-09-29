-- ============================================================
-- 참여형 리워드 4종 단순화 (2026-09-29 사장님)
--   끝말잇기 1,000(하루1회) · 출석 1,000(기존) · 이달 첫방문 10,000(월1회 자동) · 이번주 첫방문 5,000(주1회 자동)
--   + 첫구매/생애첫 페이백 자동지급 중단.
--   Supabase SQL Editor 에서 실행.
-- ============================================================

-- 1) 끝말잇기: 500 → 1,000, 하루 3회 → 1회 -------------------------------------
create or replace function public.word_chain_play(p_word text, p_lang text default 'kr')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _lang text := coalesce(nullif(p_lang,''),'kr');
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _w text := btrim(coalesce(p_word,''));
  _cap int := 1; _rew_today int;      -- 2026-09-29: 하루 1회 보상
  _last_word text; _last_char text; _fc text; _lc text; _fc_cmp text; _dup boolean;
  _mil int; _cred int; _reward boolean := true;
  _amt int := 1000;                   -- 2026-09-29: 500 → 1,000
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
    update public.profiles set mileage = coalesce(mileage,0)+_amt, ai_credit = coalesce(ai_credit,3)+1
      where id = _uid returning mileage, ai_credit into _mil, _cred;
    insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
      values (_uid, 'wordchain', _amt, 1, _lang || ':' || _w);
    begin insert into public.wallet_logs(user_id, type, amount, description)
      values (_uid, 'wordchain', _amt, 'wordchain reward'); exception when others then null; end;
  end if;

  return jsonb_build_object('ok', true, 'rewarded', _reward,
    'mileage_added', case when _reward then _amt else 0 end,
    'credit_added', case when _reward then 1 else 0 end,
    'next_char', _lc, 'word', _w, 'lang', _lang, 'cap', _cap);
end $$;
grant execute on function public.word_chain_play(text, text) to authenticated;

-- 2) 이번주 첫방문 5,000 (ISO주 1회, 자동) --------------------------------------
create or replace function public.weekly_visit_claim()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _wk  text := to_char(now() at time zone 'Asia/Seoul','IYYY-IW');
  _ref text; _has boolean; _mil int; _amt int := 5000;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  _ref := 'wvisit_' || _wk;
  select exists(select 1 from public.reward_events
                where user_id=_uid and event_type='weekly_visit' and ref=_ref) into _has;
  if _has then return jsonb_build_object('ok', true, 'granted', false, 'already', true); end if;

  update public.profiles set mileage = coalesce(mileage,0) + _amt
    where id = _uid returning mileage into _mil;
  insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
    values (_uid, 'weekly_visit', _amt, 0, _ref);
  begin insert into public.wallet_logs(user_id, type, amount, description)
    values (_uid, 'weekly_visit', _amt, '이번주 첫방문'); exception when others then null; end;

  return jsonb_build_object('ok', true, 'granted', true, 'mileage_added', _amt, 'mileage', _mil);
end $$;
grant execute on function public.weekly_visit_claim() to authenticated;

-- 3) 이달 첫방문 10,000 (월 1회, 자동) -------------------------------------------
create or replace function public.monthly_visit_claim()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _mon text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM');
  _ref text; _has boolean; _mil int; _amt int := 10000;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  _ref := 'mvisit_' || _mon;
  select exists(select 1 from public.reward_events
                where user_id=_uid and event_type='monthly_visit' and ref=_ref) into _has;
  if _has then return jsonb_build_object('ok', true, 'granted', false, 'already', true); end if;

  update public.profiles set mileage = coalesce(mileage,0) + _amt
    where id = _uid returning mileage into _mil;
  insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
    values (_uid, 'monthly_visit', _amt, 0, _ref);
  begin insert into public.wallet_logs(user_id, type, amount, description)
    values (_uid, 'monthly_visit', _amt, '이달 첫방문'); exception when others then null; end;

  return jsonb_build_object('ok', true, 'granted', true, 'mileage_added', _amt, 'mileage', _mil);
end $$;
grant execute on function public.monthly_visit_claim() to authenticated;

-- 4) reward_hub_status: 첫방문 상태 필드 추가 -----------------------------------
create or replace function public.reward_hub_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _wk text := to_char(now() at time zone 'Asia/Seoul','IYYY-IW');
  _mon text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM');
  _mil int;
begin
  if _uid is null then return jsonb_build_object('ok', true, 'logged_in', false); end if;
  select coalesce(mileage,0) into _mil from profiles where id=_uid;
  return jsonb_build_object('ok', true, 'logged_in', true, 'mileage', coalesce(_mil,0),
    'attendance_done', exists(select 1 from reward_events where user_id=_uid and event_type='attendance' and (created_at at time zone 'Asia/Seoul')::date=_today),
    'weekly_visit_done',  exists(select 1 from reward_events where user_id=_uid and event_type='weekly_visit'  and ref='wvisit_'||_wk),
    'monthly_visit_done', exists(select 1 from reward_events where user_id=_uid and event_type='monthly_visit' and ref='mvisit_'||_mon)
  );
end $$;

-- 5) 페이백 자동지급 크론 중단 (첫구매 20% / 생애첫 100%) -------------------------
--    ※ 회수(취소분 환수) 크론 reverse-cancelled-cashback 은 유지 권장 — 여기서 건드리지 않음.
--    실제 잡 이름 확인:  select jobname, schedule, command from cron.job;
do $$ begin perform cron.unschedule('first-ever-cashback');     exception when others then null; end $$;
do $$ begin perform cron.unschedule('first-purchase-cashback'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('first_ever_cashback_run'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('first_purchase_cashback_run'); exception when others then null; end $$;

select 'rewards simplified: wordchain 1000/1x, weekly_visit 5000, monthly_visit 10000, cashback crons unscheduled' as ok;
-- 확인: 남은 크론 보기
select jobname, schedule from cron.job order by jobname;
