-- 2026-08-02: admin_country_report 수정
--   ① 매출: 전 주문 total_amount 합 → payment_status='결제완료'(실결제)만 합산 (미결제/환불/취소/실패 제외)
--   ② 유입채널 광고: 'Google Ads%' 만 잡던 것 → '%(광고)%' 로 넓혀 Naver/Yahoo/기타 광고도 집계
CREATE OR REPLACE FUNCTION public.admin_country_report(p_cc text, p_days integer DEFAULT 90)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with pv as (
  select * from page_views
  where site = p_cc
    and created_at > now() - (p_days || ' days')::interval
    and coalesce(referrer,'') not ilike 'Bot%'
),
cls as (
  select *, normalize(coalesce(referrer,''), nfc) as ref_n from pv
),
cls2 as (
  select *,
    -- 광고: 트래커가 'Google/Naver/Yahoo Ads (광고)' 로 태깅 → 영문 'Ads (' 로 전부 잡음(정규화 무관)
    case
      when ref_n ilike '%Ads (%' or ref_n ilike '%doubleclick%' or ref_n ilike '%googleads%'
           or ref_n = 'syndicatedsearch.goog' then normalize('광고', nfc)
      when ref_n ilike '%Search (%' then normalize('자연검색', nfc)
      when ref_n ilike '%SNS%' or ref_n ilike '%threads%' or ref_n ilike '%instagram%'
           or ref_n ilike '%twitter%' or ref_n ilike '%youtube%' or ref_n ilike '%tiktok%' then 'SNS'
      when ref_n ilike 'Direct%' or ref_n ilike normalize('%즐겨찾기%', nfc)
           or ref_n ilike normalize('%직접%', nfc) then normalize('직접/북마크', nfc)
      else normalize('외부사이트', nfc)
    end as cat
  from cls
),
ord as (
  select * from orders
  where site_code = p_cc
    and order_date > now() - (p_days || ' days')::interval
    and normalize(payment_status, nfc) ilike normalize('%결제완료%', nfc)   -- '결제완료'+'카드결제완료' (NFC 정규화)
    and coalesce(normalize(payment_method, nfc),'') <> normalize('블로그체험단쿠폰', nfc)  -- 2026-08-10: 블로그체험단 무료쿠폰 주문은 실매출 아님 → 제외
)
select jsonb_build_object(
  'cc', p_cc,
  'days', p_days,
  'summary', (select jsonb_build_object(
      'pv', count(*),
      'uv', count(distinct visitor_id),
      'avg_sec', coalesce(round(avg(duration) filter (where duration>0)),0),
      'orders', (select count(*) from ord),
      'revenue', (select coalesce(sum(total_amount),0) from ord),
      'conv_pct', case when count(*)>0
                       then round(100.0*(select count(*) from ord)/count(*),2) else 0 end
    ) from cls2),
  'channels', (select coalesce(jsonb_agg(jsonb_build_object(
      'cat', cat, 'n', n, 'pct', pct, 'avg_sec', avg_sec) order by n desc), '[]'::jsonb)
    from (select cat, count(*) n,
             round(100.0*count(*)/nullif(sum(count(*)) over(),0),1) pct,
             coalesce(round(avg(duration) filter (where duration>0)),0) avg_sec
          from cls2 group by cat) t),
  'monthly', (select coalesce(jsonb_agg(jsonb_build_object('ym', ym, 'pv', pv, 'orders', orders) order by ym), '[]'::jsonb)
    from (
      select to_char(m,'YYYY-MM') ym,
        (select count(*) from cls2 where date_trunc('month',created_at)=m) pv,
        (select count(*) from ord where date_trunc('month',order_date)=m) orders
      from generate_series(date_trunc('month', now() - (p_days||' days')::interval), date_trunc('month',now()), interval '1 month') m
    ) t),
  'returning', (select jsonb_build_object(
      'new', count(distinct visitor_id) filter (where is_returning is false),
      'ret', count(distinct visitor_id) filter (where is_returning is true)
    ) from cls2 where visitor_id is not null),
  'orders_breakdown', (select jsonb_build_object(
      'member', count(user_id), 'guest', count(*)-count(user_id)) from ord),
  'top_channels', (select coalesce(jsonb_agg(jsonb_build_object('ref', referrer, 'n', n, 'avg_sec', avg_sec) order by n desc), '[]'::jsonb)
    from (select referrer, count(*) n, coalesce(round(avg(duration) filter (where duration>0)),0) avg_sec
          from cls2 group by referrer order by count(*) desc limit 15) t),
  'top_external', (select coalesce(jsonb_agg(jsonb_build_object('ref', referrer, 'n', n, 'avg_sec', avg_sec) order by n desc), '[]'::jsonb)
    from (select referrer, count(*) n, coalesce(round(avg(duration) filter (where duration>0)),0) avg_sec
          from cls2 where cat = normalize('외부사이트', nfc) group by referrer order by count(*) desc limit 12) t),
  'landing', (select coalesce(jsonb_agg(jsonb_build_object('dom', dom, 'n', n) order by n desc), '[]'::jsonb)
    from (select nullif(site_domain,'') dom, count(*) n from cls2 group by dom order by count(*) desc limit 8) t)
);
$function$
