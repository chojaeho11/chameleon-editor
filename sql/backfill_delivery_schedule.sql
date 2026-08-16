-- 2026-08-16 과거 간편주문 설치 스케줄 백필 (KR, 아이템에 설치일정 남은 건만)
-- delivery_period null + items 에 비원지 설치항목(shipping.delivery_date<>'') 있는 KR 주문
-- → delivery_target_date(관리자 수동날짜 우선)/delivery_period(시간 없으면 any)/installation_time/
--    delivery_time_flexible/assigned_team(주소)/is_province_install/install_duration_min
-- order.js·simple_order._soDeriveScheduleFields 와 동일 로직. 원지-only 는 대상 아님(0건).
with cand as (
  select o.id, o.address, o.total_amount, o.delivery_target_date as cur_date, o.items
  from orders o
  where o.delivery_period is null and jsonb_typeof(o.items)='array'
    and (o.site_code is null or o.site_code='KR')
    and exists (select 1 from jsonb_array_elements(o.items) e
                where coalesce(e->'shipping'->>'delivery_date','')<>''
                  and not ( lower(coalesce(e->'product'->>'category','')) = 'wholesale board prices'
                         or lower(coalesce(e->'product'->>'code','')) like 'hb_rb%'
                         or lower(coalesce(e->'product'->>'name','')) ~ '원판|raw board|raw sheet' ))
),
elems as (
  select c.id, c.address, c.total_amount, c.cur_date, ea.ord,
    coalesce(ea.elem->'shipping'->>'delivery_date','') as ddate,
    coalesce(ea.elem->'shipping'->>'delivery_time','') as dtime,
    ( lower(coalesce(ea.elem->'product'->>'category','')) = 'wholesale board prices'
      or lower(coalesce(ea.elem->'product'->>'code','')) like 'hb_rb%'
      or lower(coalesce(ea.elem->'product'->>'name','')) ~ '원판|raw board|raw sheet' ) as is_raw
  from cand c cross join lateral jsonb_array_elements(c.items) with ordinality as ea(elem, ord)
),
picked as (
  select id, max(address) as address, max(total_amount) as total_amount, max(cur_date) as cur_date,
    (array_agg(dtime order by ord) filter (where ddate<>'' and not is_raw))[1] as si_time,
    (array_agg(ddate order by ord) filter (where ddate<>'' and not is_raw))[1] as si_date,
    bool_or(ddate<>'' and not is_raw) as has_install
  from elems group by id
),
derived as (
  select id, address, total_amount,
    coalesce(cur_date::text, si_date) as new_target,
    (case when si_time in ('am','pm','night','any') then si_time else 'any' end) as new_period,
    (case when regexp_replace(coalesce(address,''),'\s','','g') ~ '화성|수원|오산|평택|안성|용인|이천|여주|광주시|하남|안양|군포|안산|시흥|과천|의왕|성남|강남|서초|송파|동작' then 'hwaseong'
          when regexp_replace(coalesce(address,''),'\s','','g') ~ '의정부|양주|고양|파주|동두천|포천|남양주|구리|가평|연천|강북구|도봉|노원|중랑|광진|성북|동대문' then 'north'
          else 'seoul' end) as new_team,
    (case when regexp_replace(coalesce(address,''),'\s','','g') ~ '서울|경기|인천' then false
          when coalesce(total_amount,0) >= 700000 then true else false end) as new_prov
  from picked where has_install
)
update orders o set
  delivery_target_date = d.new_target::date,
  delivery_period = d.new_period,
  installation_time = case d.new_period when 'am' then '09:00' when 'pm' then '14:00' when 'night' then '19:00' else null end,
  delivery_time_flexible = (d.new_period = 'any'),
  assigned_team = d.new_team,
  is_province_install = d.new_prov,
  install_duration_min = case when d.new_prov then 480 else greatest(60, floor(coalesce(d.total_amount,0)/1000000)::int*60)+60 end
from derived d
where o.id = d.id;
