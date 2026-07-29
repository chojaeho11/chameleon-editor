-- 2026-07-29: reward_grant 에 'bookmark' 타입 추가 — 바로가기/앱 설치 시 3,000원, 1인 1회(all-time).
create or replace function public.reward_grant(p_type text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid   uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _cap int; _mil_amt int; _cred_amt int;
  _cnt int; _dup boolean;
  _mil int; _cred int;
  _alltime boolean := false;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if    p_type = 'comment'  then _cap := 3; _mil_amt := 3000; _cred_amt := 0;
  elsif p_type = 'post'     then _cap := 2; _mil_amt := 1000; _cred_amt := 1;
  elsif p_type = 'bookmark' then _cap := 1; _mil_amt := 3000; _cred_amt := 0; _alltime := true;
  else  return jsonb_build_object('ok', false, 'reason', 'type'); end if;

  if p_ref is not null then
    select exists(select 1 from public.reward_events
                  where user_id = _uid and event_type = p_type and ref = p_ref) into _dup;
    if _dup then return jsonb_build_object('ok', false, 'reason', 'dup'); end if;
  end if;

  select count(*) from public.reward_events
   where user_id = _uid and event_type = p_type
     and (_alltime or (created_at at time zone 'Asia/Seoul')::date = _today)
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
              case when p_type = 'comment'  then '댓글 작성 보상'
                   when p_type = 'bookmark' then '바로가기 추가 보상'
                   else '자유게시판 글 보상' end);
    exception when others then null; end;
  end if;

  return jsonb_build_object('ok', true, 'mileage_added', _mil_amt, 'credit_added', _cred_amt,
                            'mileage', _mil, 'ai_credit', _cred, 'remaining_today', _cap - _cnt - 1);
end;
$$;
grant execute on function public.reward_grant(text, text) to authenticated;
