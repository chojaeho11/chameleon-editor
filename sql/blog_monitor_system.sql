-- ===== 블로그 체험단 (일본 モニター) 무료쿠폰 시스템 : 1) 스키마 =====
-- profiles.blog_coupon : 잔액 미러 (체크아웃 빠른 조회용)
alter table public.profiles add column if not exists blog_coupon integer not null default 0;

-- 명단 + 회차관리
create table if not exists public.blog_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  id_key text not null unique,           -- 이메일 또는 username (엑셀 id)
  monthly_amount integer not null default 100000,
  is_active boolean not null default true,
  last_grant_cycle text,                 -- 'YYYY-MM' (10일 경계 회차)
  created_at timestamptz not null default now()
);
create index if not exists idx_blog_monitors_user on public.blog_monitors(user_id);

-- 사용/지급 원장
create table if not exists public.blog_coupon_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  order_id uuid,
  amount integer not null default 0,
  kind text not null default 'use',       -- 'grant' | 'use'
  cycle text,
  created_at timestamptz not null default now()
);
create index if not exists idx_blog_usages_user on public.blog_coupon_usages(user_id, created_at desc);

-- 후기 블로그 링크
create table if not exists public.blog_monitor_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  url text not null,
  memo text,
  admin_checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_blog_links_user on public.blog_monitor_links(user_id, created_at desc);

-- RLS: 본인행만 select. 쓰기는 SECURITY DEFINER RPC 로만 (관리자는 RPC 가 우회).
alter table public.blog_monitors enable row level security;
alter table public.blog_coupon_usages enable row level security;
alter table public.blog_monitor_links enable row level security;

drop policy if exists bm_sel_own on public.blog_monitors;
create policy bm_sel_own on public.blog_monitors for select using (user_id = auth.uid());

drop policy if exists bcu_sel_own on public.blog_coupon_usages;
create policy bcu_sel_own on public.blog_coupon_usages for select using (user_id = auth.uid());

drop policy if exists bml_sel_own on public.blog_monitor_links;
create policy bml_sel_own on public.blog_monitor_links for select using (user_id = auth.uid());
-- ===== 블로그 체험단 : 2) RPC (SECURITY DEFINER) =====

-- 현재 회차 'YYYY-MM' (매월 10일 경계, JST 기준)
create or replace function public._blog_current_cycle() returns text
language sql stable as $$
  select to_char(
    case when extract(day from (now() at time zone 'Asia/Tokyo')) >= 10
         then date_trunc('month', (now() at time zone 'Asia/Tokyo'))
         else date_trunc('month', (now() at time zone 'Asia/Tokyo')) - interval '1 month'
    end, 'YYYY-MM');
$$;

create or replace function public._blog_is_admin() returns boolean
language sql stable security definer as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 호출자 동기화: 활성 체험단이면 (미연결이면 이메일/username 매칭해 연결) 현재 회차 미지급 시 10만원 리셋 지급.
create or replace function public.blog_monitor_sync() returns jsonb
language plpgsql security definer as $$
declare
  _uid   uuid := auth.uid();
  _m     public.blog_monitors%rowtype;
  _cycle text := public._blog_current_cycle();
  _bal   int;
  _mail  text;
  _uname text;
begin
  if _uid is null then return jsonb_build_object('is_monitor', false); end if;

  select * into _m from public.blog_monitors where user_id = _uid and is_active = true limit 1;
  if not found then
    -- 미연결 명단을 이메일/username 으로 자동 연결 (예: 가입 후 최초 로그인)
    select email into _mail  from public.profiles where id = _uid;
    select username into _uname from public.profiles where id = _uid;
    select * into _m from public.blog_monitors bm
      where bm.user_id is null and bm.is_active = true
        and ( lower(bm.id_key) = lower(coalesce(_mail,'')) or lower(bm.id_key) = lower(coalesce(_uname,'')) )
      limit 1;
    if found then
      update public.blog_monitors set user_id = _uid where id = _m.id;
      _m.user_id := _uid;
    end if;
  end if;
  if _m.id is null then return jsonb_build_object('is_monitor', false); end if;

  if _m.last_grant_cycle is distinct from _cycle then
    update public.profiles set blog_coupon = _m.monthly_amount where id = _uid;
    update public.blog_monitors set last_grant_cycle = _cycle where id = _m.id;
    insert into public.blog_coupon_usages(user_id, order_id, amount, kind, cycle)
      values (_uid, null, _m.monthly_amount, 'grant', _cycle);
  end if;

  select coalesce(blog_coupon,0) into _bal from public.profiles where id = _uid;
  return jsonb_build_object('is_monitor', true, 'balance', _bal,
                            'monthly_amount', _m.monthly_amount, 'cycle', _cycle);
end; $$;

-- 잔액 범위 내 차감 (원자적) + 사용 원장. 실제 차감액 반환.
create or replace function public.blog_coupon_consume(_order_id uuid, _amount int) returns jsonb
language plpgsql security definer as $$
declare
  _uid   uuid := auth.uid();
  _bal   int;
  _use   int;
  _cycle text := public._blog_current_cycle();
begin
  if _uid is null then return jsonb_build_object('ok', false, 'used', 0); end if;
  if not exists(select 1 from public.blog_monitors where user_id = _uid and is_active = true) then
    return jsonb_build_object('ok', false, 'used', 0);
  end if;

  select coalesce(blog_coupon,0) into _bal from public.profiles where id = _uid for update;
  _use := least(greatest(coalesce(_amount,0),0), _bal);
  if _use <= 0 then return jsonb_build_object('ok', false, 'used', 0, 'balance', _bal); end if;

  update public.profiles set blog_coupon = _bal - _use where id = _uid;
  insert into public.blog_coupon_usages(user_id, order_id, amount, kind, cycle)
    values (_uid, _order_id, _use, 'use', _cycle);
  return jsonb_build_object('ok', true, 'used', _use, 'balance', _bal - _use);
end; $$;

-- 후기 링크 추가 (활성 체험단만) + 본인 링크목록 반환
create or replace function public.blog_link_add(_url text, _memo text) returns jsonb
language plpgsql security definer as $$
declare _uid uuid := auth.uid(); _list jsonb;
begin
  if _uid is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not exists(select 1 from public.blog_monitors where user_id = _uid and is_active = true) then
    return jsonb_build_object('ok', false, 'error', 'not_monitor');
  end if;
  if coalesce(trim(_url),'') = '' then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  insert into public.blog_monitor_links(user_id, url, memo) values (_uid, trim(_url), _memo);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'url',url,'memo',memo,'admin_checked',admin_checked,'created_at',created_at) order by created_at desc), '[]'::jsonb)
    into _list from public.blog_monitor_links where user_id = _uid;
  return jsonb_build_object('ok', true, 'links', _list);
end; $$;

-- 본인 링크목록 조회
create or replace function public.blog_my_links() returns jsonb
language plpgsql security definer as $$
declare _uid uuid := auth.uid(); _list jsonb;
begin
  if _uid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'url',url,'memo',memo,'admin_checked',admin_checked,'created_at',created_at) order by created_at desc), '[]'::jsonb)
    into _list from public.blog_monitor_links where user_id = _uid;
  return _list;
end; $$;

-- ===== 관리자용 (role='admin' 게이트 내장) =====
create or replace function public.blog_monitor_admin_list() returns jsonb
language plpgsql security definer as $$
declare _cycle text := public._blog_current_cycle(); _res jsonb;
begin
  if not public._blog_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  select jsonb_build_object('cycle', _cycle,
           'monitors', coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb))
  into _res
  from (
    select bm.id, bm.name, bm.id_key, bm.user_id, bm.monthly_amount, bm.is_active,
           bm.last_grant_cycle, bm.created_at,
           coalesce(p.blog_coupon,0) as balance,
           coalesce(p.email, au.email) as email,
           (bm.user_id is not null) as linked,
           (select coalesce(sum(amount),0) from public.blog_coupon_usages u
              where u.user_id = bm.user_id and u.kind='use') as total_used,
           (select coalesce(sum(amount),0) from public.blog_coupon_usages u
              where u.user_id = bm.user_id and u.kind='use' and u.cycle = _cycle) as cycle_used,
           (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'url',l.url,'memo',l.memo,
                     'admin_checked',l.admin_checked,'created_at',l.created_at) order by l.created_at desc), '[]'::jsonb)
              from public.blog_monitor_links l where l.user_id = bm.user_id) as links,
           (select coalesce(jsonb_agg(jsonb_build_object('amount',u.amount,'kind',u.kind,
                     'order_id',u.order_id,'cycle',u.cycle,'created_at',u.created_at) order by u.created_at desc), '[]'::jsonb)
              from public.blog_coupon_usages u where u.user_id = bm.user_id) as usages
    from public.blog_monitors bm
    left join public.profiles p on p.id = bm.user_id
    left join auth.users au on au.id = bm.user_id
  ) m;
  return _res;
end; $$;

-- 현재 회차 일괄 지급 (미지급 활성 회원만 리셋). 지급 인원수 반환.
create or replace function public.blog_monitor_grant_all() returns jsonb
language plpgsql security definer as $$
declare _cycle text := public._blog_current_cycle(); _n int := 0; _r record;
begin
  if not public._blog_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  for _r in select * from public.blog_monitors
             where is_active = true and user_id is not null
               and last_grant_cycle is distinct from _cycle loop
    update public.profiles set blog_coupon = _r.monthly_amount where id = _r.user_id;
    update public.blog_monitors set last_grant_cycle = _cycle where id = _r.id;
    insert into public.blog_coupon_usages(user_id, order_id, amount, kind, cycle)
      values (_r.user_id, null, _r.monthly_amount, 'grant', _cycle);
    _n := _n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'granted', _n, 'cycle', _cycle);
end; $$;

-- 회원 추가/편집 (user_id 는 id_key 로 재매칭)
create or replace function public.blog_monitor_upsert(_id uuid, _name text, _id_key text, _monthly int, _active bool) returns jsonb
language plpgsql security definer as $$
declare _uid uuid; _newid uuid;
begin
  if not public._blog_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  if coalesce(trim(_id_key),'') = '' then return jsonb_build_object('ok', false, 'error', 'id_key required'); end if;
  select id into _uid from public.profiles
    where lower(email) = lower(_id_key) or lower(username) = lower(_id_key) limit 1;
  if _id is null then
    insert into public.blog_monitors(user_id, name, id_key, monthly_amount, is_active)
      values (_uid, _name, trim(_id_key), coalesce(_monthly,100000), coalesce(_active,true))
    on conflict (id_key) do update
      set name = excluded.name, monthly_amount = excluded.monthly_amount,
          is_active = excluded.is_active, user_id = coalesce(public.blog_monitors.user_id, excluded.user_id)
    returning id into _newid;
  else
    update public.blog_monitors
      set name = _name, id_key = trim(_id_key), monthly_amount = coalesce(_monthly,100000),
          is_active = coalesce(_active,true), user_id = coalesce(_uid, user_id)
      where id = _id returning id into _newid;
  end if;
  return jsonb_build_object('ok', true, 'id', _newid, 'linked', (_uid is not null));
end; $$;

create or replace function public.blog_monitor_set_active(_id uuid, _active bool) returns jsonb
language plpgsql security definer as $$
begin
  if not public._blog_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update public.blog_monitors set is_active = coalesce(_active,true) where id = _id;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.blog_link_check(_id uuid, _checked bool) returns jsonb
language plpgsql security definer as $$
begin
  if not public._blog_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update public.blog_monitor_links set admin_checked = coalesce(_checked,true) where id = _id;
  return jsonb_build_object('ok', true);
end; $$;

-- execute 권한 (authenticated). 관리자 함수는 내부에서 role 게이트.
grant execute on function public.blog_monitor_sync() to authenticated;
grant execute on function public.blog_coupon_consume(uuid,int) to authenticated;
grant execute on function public.blog_link_add(text,text) to authenticated;
grant execute on function public.blog_my_links() to authenticated;
grant execute on function public.blog_monitor_admin_list() to authenticated;
grant execute on function public.blog_monitor_grant_all() to authenticated;
grant execute on function public.blog_monitor_upsert(uuid,text,text,int,bool) to authenticated;
grant execute on function public.blog_monitor_set_active(uuid,bool) to authenticated;
grant execute on function public.blog_link_check(uuid,bool) to authenticated;
-- ===== 블로그 체험단 : 3) 명단 시드 (모니토.xlsx 8명) =====
-- id_key(이메일/username) 로 profiles 매칭해 user_id 연결. 중복 재실행 안전.
insert into public.blog_monitors(user_id, name, id_key, monthly_amount, is_active)
select p.id, v.name, v.idkey, 100000, true
from (values
  ('小林 美樹 Miki Kobayashi',   'happy.m.m.0204@icloud.com'),
  ('日高 好花 Konoka Hidaka',    'shopikeybib.official@gmail.com'),
  ('川添 紗代美 Sayomi Kawasoe', 'maison.nakanomaru@gmail.com'),
  ('白尾 莉奈 Shirao Rina',      'f.rina0129@gmail.com'),
  ('喜多 優菜 Yuna Kita',        'meee_wan.24@docomo.ne.jp'),
  ('棚倉実代 Tanagura Miyo',     'yapopopo.my3434@gmail.com'),
  ('植松沙由未 Uematsu Sayumi',  'ttttweety14@yahoo.co.jp'),
  ('安部 有梨花 Abe Yurika',     '87design')
) as v(name, idkey)
left join public.profiles p
  on lower(p.email) = lower(v.idkey) or lower(p.username) = lower(v.idkey)
on conflict (id_key) do update
  set user_id = coalesce(public.blog_monitors.user_id, excluded.user_id),
      name = excluded.name;

-- 오늘(매월 10일)이 지급일 → 연결된 활성 회원에게 이번 회차 즉시 지급(리셋).
do $$
declare _cycle text := public._blog_current_cycle(); _r record;
begin
  for _r in select * from public.blog_monitors
             where is_active = true and user_id is not null
               and last_grant_cycle is distinct from _cycle loop
    update public.profiles set blog_coupon = _r.monthly_amount where id = _r.user_id;
    update public.blog_monitors set last_grant_cycle = _cycle where id = _r.id;
    insert into public.blog_coupon_usages(user_id, order_id, amount, kind, cycle)
      values (_r.user_id, null, _r.monthly_amount, 'grant', _cycle);
  end loop;
end $$;

-- 결과 확인
select bm.name, bm.id_key, (bm.user_id is not null) as linked,
       bm.last_grant_cycle, coalesce(p.blog_coupon,0) as balance
from public.blog_monitors bm
left join public.profiles p on p.id = bm.user_id
order by bm.created_at;
