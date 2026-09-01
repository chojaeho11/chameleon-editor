-- 2026-08-16 첫구매 페이백 2종
-- (A) first_purchase_cashback_run: 유저당 "생애 1회" -> "매월 1회"(그달 첫 구매 20%, 최대 20만) 로 변경
-- (B) first_ever_cashback_run: 신규 "생애 1회" 첫구매 100% 페이백(신규 고객만, 최대 10만) 추가
-- (C) reward_hub_status: first_cashback_done 월 스코프 + first_ever_cashback_done 추가
-- (D) cron: first-ever-cashback 10분마다
-- 유효주문 필터는 기존 함수에서 그대로 복사(취소/무통장/포인트전액/실패 제외)

-- (A) 매월 20% 페이백 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.first_purchase_cashback_run()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _granted int := 0; _amt int := 0; _rec record;
begin
  for _rec in
    select f.uid, f.oid, f.tot from (
      select distinct on (o.user_id) o.user_id uid, o.id oid, o.total_amount tot, o.created_at cat
      from orders o
      where o.user_id is not null
        and o.status not in ('결제대기','임시작성','취소됨','취소','삭제됨','삭제','deleted','trash','관리자차단')
        and o.payment_method is not null
        and o.payment_method not in ('포인트','예치금','블로그체험단쿠폰')
        and o.payment_method not ilike '%실패%'
        and o.payment_status ilike '%결제완료%'          -- ★2026-09-01 결제완료(카드완료/무통장 입금확인)만 지급
        -- 당월(KST) 주문만 -> distinct on 최이른 = 그달 첫 구매. 첫 시행월은 8/15 런치 이후만(8/1~14 소급 방지)
        and (o.created_at at time zone 'Asia/Seoul') >= greatest(
              date_trunc('month', now() at time zone 'Asia/Seoul'),
              timestamp '2026-08-15 00:00:00')
      order by o.user_id, o.created_at asc
    ) f
    -- 당월 중복 방지
    where not exists (
        select 1 from reward_events re
        where re.user_id=f.uid and re.event_type='first_purchase_cashback'
          and to_char(re.created_at at time zone 'Asia/Seoul','YYYY-MM')
              = to_char(now() at time zone 'Asia/Seoul','YYYY-MM')
          and not exists (                                -- ★2026-09-01 회수된 건은 제외(재입금 시 자가치유 재지급)
            select 1 from reward_events rr
            where rr.event_type='cashback_reversed' and rr.ref=re.ref and rr.user_id=re.user_id))
  loop
    _amt := least(floor(coalesce(_rec.tot,0) * 0.2)::int, 200000);
    if _amt > 0 then
      insert into reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
        values (_rec.uid, 'first_purchase_cashback', _amt, 0, _rec.oid::text);
      update profiles set mileage = coalesce(mileage,0) + _amt where id = _rec.uid;
      insert into wallet_logs(user_id, type, amount, description)
        values (_rec.uid, 'first_purchase_cashback', _amt, '##FIRST_CASHBACK## 20% monthly order ' || _rec.oid);
      _granted := _granted + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'granted', _granted);
end $function$;

-- (B) 생애 첫구매 100% 페이백(신규 고객만, 최대 10만) -------------------------
CREATE OR REPLACE FUNCTION public.first_ever_cashback_run()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _granted int := 0; _amt int := 0; _rec record;
begin
  for _rec in
    select f.uid, f.oid, f.tot from (
      select distinct on (o.user_id) o.user_id uid, o.id oid, o.total_amount tot, o.created_at cat
      from orders o
      where o.user_id is not null
        and o.status not in ('결제대기','임시작성','취소됨','취소','삭제됨','삭제','deleted','trash','관리자차단')
        and o.payment_method is not null
        and o.payment_method not in ('포인트','예치금','블로그체험단쿠폰')
        and o.payment_method not ilike '%실패%'
        and o.payment_status ilike '%결제완료%'          -- ★2026-09-01 결제완료만 지급
      order by o.user_id, o.created_at asc   -- 생애 가장 이른 유효주문
    ) f
    -- 생애 첫 주문이 런치(8/16) 이후여야 함 -> 기존 고객(첫 주문 런치 전) 자동 제외 = 신규 고객만
    where f.cat >= '2026-08-16 00:00:00+09'::timestamptz
      and not exists (
        select 1 from reward_events re
        where re.user_id=f.uid and re.event_type='first_ever_cashback'
          and not exists (                                -- ★2026-09-01 회수된 건은 제외(자가치유)
            select 1 from reward_events rr
            where rr.event_type='cashback_reversed' and rr.ref=re.ref and rr.user_id=re.user_id))
  loop
    _amt := least(coalesce(_rec.tot,0)::int, 100000);   -- 실입금액 100%, 최대 10만
    if _amt > 0 then
      insert into reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
        values (_rec.uid, 'first_ever_cashback', _amt, 0, _rec.oid::text);
      update profiles set mileage = coalesce(mileage,0) + _amt where id = _rec.uid;
      insert into wallet_logs(user_id, type, amount, description)
        values (_rec.uid, 'first_ever_cashback', _amt, '##FIRST_EVER## 100% order ' || _rec.oid);
      _granted := _granted + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'granted', _granted);
end $function$;

-- (C) reward_hub_status: first_cashback_done 월 스코프 + first_ever_cashback_done 추가
CREATE OR REPLACE FUNCTION public.reward_hub_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid();
  _today date := (now() at time zone 'Asia/Seoul')::date;
  _wk text := to_char(now() at time zone 'Asia/Seoul','IYYY-IW');
  _mon text := to_char(now() at time zone 'Asia/Seoul','YYYY-MM');
  _mil int;
begin
  if _uid is null then return jsonb_build_object('ok', true, 'logged_in', false); end if;
  select coalesce(mileage,0) into _mil from profiles where id=_uid;
  return jsonb_build_object('ok', true, 'logged_in', true, 'mileage', coalesce(_mil,0),
    'monthly_gift_done', exists(select 1 from reward_events where user_id=_uid and event_type='monthly_gift' and ref='weekly_gift_'||_wk),
    'attendance_done', exists(select 1 from reward_events where user_id=_uid and event_type='attendance' and (created_at at time zone 'Asia/Seoul')::date=_today),
    'first_cashback_done', exists(select 1 from reward_events where user_id=_uid and event_type='first_purchase_cashback' and to_char(created_at at time zone 'Asia/Seoul','YYYY-MM')=_mon),
    'first_ever_cashback_done', exists(select 1 from reward_events where user_id=_uid and event_type='first_ever_cashback')
  );
end $function$;

-- (D) cron: 생애 첫구매 100% 페이백 10분마다
do $$ begin perform cron.unschedule('first-ever-cashback'); exception when others then null; end $$;
select cron.schedule('first-ever-cashback','*/10 * * * *','select public.first_ever_cashback_run();');
