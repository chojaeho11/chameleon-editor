-- 2026-07-28: 참여형 리워드 시스템 (마일리지 + AI 이미지 생성권)
--  - 무료 회원 기본 AI 생성권 3장 / 구독자 무제한
--  - 출석(하루 1회): 생성권 3 + 마일리지 1000
--  - 댓글(모든 게시판/후기, 하루 3회): 마일리지 3000
--  - 자유게시판 글(하루 2회): 마일리지 1000 + 생성권 1
-- 잔액변경/한도/중복은 전부 SECURITY DEFINER RPC 로 서버측 원자 처리(클라 위조 불가).

-- 1) 컬럼 + 원장 테이블 ---------------------------------------------------------
alter table public.profiles add column if not exists ai_credit int default 3;
update public.profiles set ai_credit = 3 where ai_credit is null;

create table if not exists public.reward_events (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  event_type   text not null,           -- 'attendance' | 'comment' | 'post' | 'ai_consume'
  mileage_delta int not null default 0,
  credit_delta  int not null default 0,
  ref          text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_reward_events_user_type_time on public.reward_events(user_id, event_type, created_at);
create index if not exists idx_reward_events_dup on public.reward_events(user_id, event_type, ref);

alter table public.reward_events enable row level security;
drop policy if exists reward_events_read_own on public.reward_events;
create policy reward_events_read_own on public.reward_events
  for select using (auth.uid() = user_id);
-- 직접 insert/update/delete 없음 — 아래 SECURITY DEFINER RPC 로만 기록.

-- 2) 구독자 판별(내부용) --------------------------------------------------------
create or replace function public._is_subscriber(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.subscriptions where user_id = p_uid and status = 'active')
      or exists(select 1 from public.profiles where id = p_uid and role = 'subscriber');
$$;

-- 3) 출석 보상 (하루 1회) -------------------------------------------------------
create or replace function public.attendance_claim()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid   uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _has   boolean;
  _mil   int; _cred int;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  select exists(
    select 1 from public.reward_events
    where user_id = _uid and event_type = 'attendance'
      and (created_at at time zone 'Asia/Seoul')::date = _today
  ) into _has;
  if _has then return jsonb_build_object('ok', false, 'already', true); end if;

  update public.profiles
     set ai_credit = coalesce(ai_credit, 3) + 3,
         mileage   = coalesce(mileage, 0) + 1000
   where id = _uid
   returning mileage, ai_credit into _mil, _cred;

  insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
  values (_uid, 'attendance', 1000, 3, _today::text);
  begin
    insert into public.wallet_logs(user_id, type, amount, description)
    values (_uid, 'attendance', 1000, '출석 보상');
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'mileage_added', 1000, 'credit_added', 3,
                            'mileage', _mil, 'ai_credit', _cred);
end $$;

-- 4) 댓글/글 보상 (타입별 하루 한도 + ref 중복방지) ------------------------------
create or replace function public.reward_grant(p_type text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid   uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _cap int; _mil_amt int; _cred_amt int;
  _cnt int; _dup boolean;
  _mil int; _cred int;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if    p_type = 'comment' then _cap := 3; _mil_amt := 3000; _cred_amt := 0;
  elsif p_type = 'post'    then _cap := 2; _mil_amt := 1000; _cred_amt := 1;
  else  return jsonb_build_object('ok', false, 'reason', 'type'); end if;

  if p_ref is not null then
    select exists(select 1 from public.reward_events
                  where user_id = _uid and event_type = p_type and ref = p_ref) into _dup;
    if _dup then return jsonb_build_object('ok', false, 'reason', 'dup'); end if;
  end if;

  select count(*) from public.reward_events
   where user_id = _uid and event_type = p_type
     and (created_at at time zone 'Asia/Seoul')::date = _today
   into _cnt;
  if _cnt >= _cap then
    return jsonb_build_object('ok', false, 'reason', 'cap', 'cap', _cap);
  end if;

  update public.profiles
     set mileage   = coalesce(mileage, 0) + _mil_amt,
         ai_credit = coalesce(ai_credit, 3) + _cred_amt
   where id = _uid
   returning mileage, ai_credit into _mil, _cred;

  insert into public.reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
  values (_uid, p_type, _mil_amt, _cred_amt, p_ref);
  if _mil_amt > 0 then
    begin
      insert into public.wallet_logs(user_id, type, amount, description)
      values (_uid, p_type || '_reward', _mil_amt,
              case when p_type = 'comment' then '댓글 작성 보상' else '자유게시판 글 보상' end);
    exception when others then null; end;
  end if;

  return jsonb_build_object('ok', true, 'mileage_added', _mil_amt, 'credit_added', _cred_amt,
                            'mileage', _mil, 'ai_credit', _cred, 'remaining_today', _cap - _cnt - 1);
end $$;

-- 5) AI 생성권 소비 (구독자 무제한 통과) ----------------------------------------
create or replace function public.ai_credit_consume()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _cred int;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if public._is_subscriber(_uid) then
    return jsonb_build_object('ok', true, 'unlimited', true);
  end if;
  update public.profiles
     set ai_credit = coalesce(ai_credit, 3) - 1
   where id = _uid and coalesce(ai_credit, 3) > 0
   returning ai_credit into _cred;
  if _cred is null then
    return jsonb_build_object('ok', false, 'reason', 'empty', 'ai_credit', 0);
  end if;
  insert into public.reward_events(user_id, event_type, credit_delta, ref)
  values (_uid, 'ai_consume', -1, null);
  return jsonb_build_object('ok', true, 'ai_credit', _cred);
end $$;

-- 6) 내 상태 조회 --------------------------------------------------------------
create or replace function public.reward_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid   uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _mil int; _cred int; _sub boolean; _att boolean; _cmt int; _post int;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  select coalesce(mileage, 0), coalesce(ai_credit, 3) from public.profiles where id = _uid into _mil, _cred;
  _sub := public._is_subscriber(_uid);
  select exists(select 1 from public.reward_events where user_id=_uid and event_type='attendance'
                and (created_at at time zone 'Asia/Seoul')::date=_today) into _att;
  select count(*) from public.reward_events where user_id=_uid and event_type='comment'
         and (created_at at time zone 'Asia/Seoul')::date=_today into _cmt;
  select count(*) from public.reward_events where user_id=_uid and event_type='post'
         and (created_at at time zone 'Asia/Seoul')::date=_today into _post;
  return jsonb_build_object('ok', true, 'mileage', _mil, 'ai_credit', _cred, 'is_subscriber', _sub,
                            'attendance_done', _att, 'comment_today', _cmt, 'post_today', _post);
end $$;

grant execute on function public.attendance_claim()             to authenticated;
grant execute on function public.reward_grant(text, text)       to authenticated;
grant execute on function public.ai_credit_consume()            to authenticated;
grant execute on function public.reward_status()                to authenticated;
