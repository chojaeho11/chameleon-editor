-- 페이백 회수 크론 (reverse-cancelled-cashback, */10분)
-- 2026-08-31 최초: 주문 취소/삭제 시 first_purchase/first_ever 페이백 회수
-- 2026-09-01 확대: 미결제(payment_status 결제완료 아님 = 입금대기/미결제/결제실패/환불) 도 회수
--   지급게이트(first_*_cashback_run 의 payment_status ilike '%결제완료%')와 물려 동작:
--   미결제엔 애초에 안 나가고, 결제 후 환불/취소되면 회수, 회수 후 재결제되면 재지급(자가치유).
CREATE OR REPLACE FUNCTION public.reverse_cancelled_cashback_run()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _rev int := 0; _amt int := 0; _rec record;
begin
  for _rec in
    select re.user_id uid, re.mileage_delta amt, re.ref oid
    from reward_events re
    join orders o on o.id::text = re.ref
    where re.event_type in ('first_purchase_cashback','first_ever_cashback')
      and coalesce(re.mileage_delta,0) > 0
      and ( o.status in ('취소됨','취소','삭제됨','삭제','deleted','trash','관리자차단')
            or coalesce(o.payment_status,'') not ilike '%결제완료%' )   -- 미결제/실패/환불도 회수
      and not exists (
        select 1 from reward_events r2
        where r2.event_type = 'cashback_reversed' and r2.ref = re.ref and r2.user_id = re.user_id
      )
  loop
    _amt := _rec.amt;
    update profiles set mileage = greatest(0, coalesce(mileage,0) - _amt) where id = _rec.uid;
    insert into reward_events(user_id, event_type, mileage_delta, credit_delta, ref)
      values (_rec.uid, 'cashback_reversed', -_amt, 0, _rec.oid);
    insert into wallet_logs(user_id, type, amount, description)
      values (_rec.uid, 'cashback_reversed', -_amt, '##CASHBACK_REVERSED## 미결제/취소 페이백 회수 (주문 ' || _rec.oid || ')');
    _rev := _rev + 1;
  end loop;
  return jsonb_build_object('ok', true, 'reversed', _rev);
end $function$;

-- 크론 (이미 등록됨; 재등록 필요시)
-- do $$ begin perform cron.unschedule('reverse-cancelled-cashback'); exception when others then null; end $$;
-- select cron.schedule('reverse-cancelled-cashback','*/10 * * * *','select public.reverse_cancelled_cashback_run();');
