-- ============================================================================
-- 캐시백 무한루프(자가치유 dedup 결함) 중복지급 정리 + 잔액 교정
-- 2026-09-10  ※ Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 1회 실행하세요.
--
-- 배경: 9/1 캐시백 "자가치유" 로직이 매 10분 크론마다 재지급하여
--       jc_lee(6186)/joo(6116)/vince(6196) 3명에게 총 2,444건(약 2.6억) 중복지급됨.
--       (지급 함수는 이미 수정되어 루프는 멈춤. 이 스크립트는 남은 중복 데이터 정리용.)
-- 이 스크립트: 3명의 해당 주문 캐시백/회수 기록을 전부 지우고, 정당한 1건만 남긴 뒤
--             잔액을 정상값으로 교정 (jc_lee 116,400 / joo 100,000 / vince 108,000).
-- 세 주문 모두 결제완료 상태이므로 각 1회 지급이 정당합니다.
-- ============================================================================
with
dr1 as (delete from reward_events where user_id='e74ecb17-a9d0-4594-90a7-d67964662b5d'
   and ref='6186' and event_type in ('first_purchase_cashback','first_ever_cashback','cashback_reversed') returning 1),
dr2 as (delete from reward_events where user_id='65437e7c-80a6-48ab-a2fc-b68251faa88a'
   and ref='6116' and event_type in ('first_purchase_cashback','first_ever_cashback','cashback_reversed') returning 1),
dr3 as (delete from reward_events where user_id='83e1b581-a9f7-41f8-8f7c-6e562f592a16'
   and ref='6196' and event_type in ('first_purchase_cashback','first_ever_cashback','cashback_reversed') returning 1),
dw1 as (delete from wallet_logs where user_id='e74ecb17-a9d0-4594-90a7-d67964662b5d'
   and type in ('first_purchase_cashback','first_ever_cashback','cashback_reversed') and description like '%6186%' returning 1),
dw2 as (delete from wallet_logs where user_id='65437e7c-80a6-48ab-a2fc-b68251faa88a'
   and type in ('first_purchase_cashback','first_ever_cashback','cashback_reversed') and description like '%6116%' returning 1),
dw3 as (delete from wallet_logs where user_id='83e1b581-a9f7-41f8-8f7c-6e562f592a16'
   and type in ('first_purchase_cashback','first_ever_cashback','cashback_reversed') and description like '%6196%' returning 1),
ir1 as (insert into reward_events(user_id,event_type,mileage_delta,credit_delta,ref)
   values ('e74ecb17-a9d0-4594-90a7-d67964662b5d','first_purchase_cashback',116400,0,'6186') returning 1),
ir2 as (insert into reward_events(user_id,event_type,mileage_delta,credit_delta,ref)
   values ('65437e7c-80a6-48ab-a2fc-b68251faa88a','first_ever_cashback',100000,0,'6116') returning 1),
ir3 as (insert into reward_events(user_id,event_type,mileage_delta,credit_delta,ref)
   values ('83e1b581-a9f7-41f8-8f7c-6e562f592a16','first_purchase_cashback',98000,0,'6196') returning 1),
iw1 as (insert into wallet_logs(user_id,type,amount,description)
   values ('e74ecb17-a9d0-4594-90a7-d67964662b5d','first_purchase_cashback',116400,'##FIRST_CASHBACK## 20% monthly order 6186 (dedup fix)') returning 1),
iw2 as (insert into wallet_logs(user_id,type,amount,description)
   values ('65437e7c-80a6-48ab-a2fc-b68251faa88a','first_ever_cashback',100000,'##FIRST_EVER## 100% order 6116 (dedup fix)') returning 1),
iw3 as (insert into wallet_logs(user_id,type,amount,description)
   values ('83e1b581-a9f7-41f8-8f7c-6e562f592a16','first_purchase_cashback',98000,'##FIRST_CASHBACK## 20% monthly order 6196 (dedup fix)') returning 1),
p1 as (update profiles set mileage=116400 where id='e74ecb17-a9d0-4594-90a7-d67964662b5d' returning 1),
p2 as (update profiles set mileage=100000 where id='65437e7c-80a6-48ab-a2fc-b68251faa88a' returning 1),
p3 as (update profiles set mileage=108000 where id='83e1b581-a9f7-41f8-8f7c-6e562f592a16' returning 1)
select
  (select count(*) from dr1)+(select count(*) from dr2)+(select count(*) from dr3) as deleted_reward_events,
  (select count(*) from dw1)+(select count(*) from dw2)+(select count(*) from dw3) as deleted_wallet_logs,
  (select count(*) from ir1)+(select count(*) from ir2)+(select count(*) from ir3) as inserted_grants,
  (select count(*) from p1)+(select count(*) from p2)+(select count(*) from p3) as balances_reset;

-- 실행 후 확인 (선택): 아래를 따로 실행하면 3명 최종 잔액이 116400/100000/108000 인지 볼 수 있습니다.
-- select u.email, p.mileage from auth.users u join profiles p on p.id=u.id
--  where u.id in ('e74ecb17-a9d0-4594-90a7-d67964662b5d','65437e7c-80a6-48ab-a2fc-b68251faa88a','83e1b581-a9f7-41f8-8f7c-6e562f592a16');
