-- 2026-07-24: 관리자 대시보드 국가별 상세 보고서 RPC
--   page_views(referrer=채널라벨, duration, is_returning, visitor_id, site=국가코드) +
--   orders(site_code, user_id, total_amount) 를 서버에서 집계해 JSON 하나로 반환.
--   page_views/orders 는 이미 대시보드가 anon 으로 직접 읽는 테이블이라 노출 범위는 동일.
--   효율을 위해 SECURITY DEFINER + 서버측 GROUP BY (수만 행을 클라이언트로 안 끌어옴).

create or replace function public.admin_country_report(p_cc text, p_days int default 90)
returns jsonb
language sql
security definer
set search_path = public
as $$
with pv as (
  select * from page_views
  where site = p_cc
    and created_at > now() - (p_days || ' days')::interval
    and coalesce(referrer,'') not ilike 'Bot%'
),
cls as (
  select *,
    case
      when referrer ilike 'Google Ads%' or referrer ilike '%doubleclick%'
           or referrer = 'syndicatedsearch.goog' or referrer ilike '%googleads%' then '광고'
      when referrer ilike '%Search (%' then '자연검색'
      when referrer ilike '%SNS%' or referrer ilike '%threads%' or referrer ilike '%instagram%'
           or referrer ilike '%twitter%' or referrer ilike '%youtube%' or referrer ilike '%tiktok%' then 'SNS'
      when referrer ilike 'Direct%' or referrer ~ '즐겨찾기|직접' then '직접/북마크'
      else '외부사이트'
    end as cat
  from pv
),
ord as (
  select * from orders
  where site_code = p_cc
    and order_date > now() - (p_days || ' days')::interval
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
      -- visitor_id 는 최근에야 채워져 UV 기반 전환율이 왜곡된다 → 방문(PV) 대비 주문 비율(안정적)
      'conv_pct', case when count(*)>0
                       then round(100.0*(select count(*) from ord)/count(*),2) else 0 end
    ) from cls),
  'channels', (select coalesce(jsonb_agg(jsonb_build_object(
      'cat', cat, 'n', n, 'pct', pct, 'avg_sec', avg_sec) order by n desc), '[]'::jsonb)
    from (select cat, count(*) n,
             round(100.0*count(*)/nullif(sum(count(*)) over(),0),1) pct,
             coalesce(round(avg(duration) filter (where duration>0)),0) avg_sec
          from cls group by cat) t),
  'monthly', (select coalesce(jsonb_agg(jsonb_build_object('ym', ym, 'pv', pv, 'orders', orders) order by ym), '[]'::jsonb)
    from (
      select to_char(m,'YYYY-MM') ym,
        (select count(*) from cls where date_trunc('month',created_at)=m) pv,
        (select count(*) from ord where date_trunc('month',order_date)=m) orders
      from generate_series(date_trunc('month', now() - (p_days||' days')::interval), date_trunc('month',now()), interval '1 month') m
    ) t),
  'returning', (select jsonb_build_object(
      'new', count(distinct visitor_id) filter (where is_returning is false),
      'ret', count(distinct visitor_id) filter (where is_returning is true)
    ) from cls where visitor_id is not null),
  'orders_breakdown', (select jsonb_build_object(
      'member', count(user_id), 'guest', count(*)-count(user_id)) from ord),
  'top_channels', (select coalesce(jsonb_agg(jsonb_build_object('ref', referrer, 'n', n, 'avg_sec', avg_sec) order by n desc), '[]'::jsonb)
    from (select referrer, count(*) n, coalesce(round(avg(duration) filter (where duration>0)),0) avg_sec
          from cls group by referrer order by count(*) desc limit 15) t),
  'top_external', (select coalesce(jsonb_agg(jsonb_build_object('ref', referrer, 'n', n, 'avg_sec', avg_sec) order by n desc), '[]'::jsonb)
    from (select referrer, count(*) n, coalesce(round(avg(duration) filter (where duration>0)),0) avg_sec
          from cls where cat='외부사이트' group by referrer order by count(*) desc limit 12) t),
  'landing', (select coalesce(jsonb_agg(jsonb_build_object('dom', dom, 'n', n) order by n desc), '[]'::jsonb)
    from (select nullif(site_domain,'') dom, count(*) n from cls group by dom order by count(*) desc limit 8) t)
);
$$;

grant execute on function public.admin_country_report(text, int) to anon, authenticated;
