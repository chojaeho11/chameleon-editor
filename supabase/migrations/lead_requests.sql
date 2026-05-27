-- ============================================================
-- lead_requests : 해외 영업 리드 (Sample Request / Distributor Application)
-- 2026-05-27
-- ============================================================
-- 용도:
--   hexa-board.com (Hexalite 원지) + cafe3355.com (종이매대) 등에서
--   고객이 폼 제출 시 anon-key 로 INSERT.
--   관리자만 SELECT/UPDATE 가능 (RLS).
-- ============================================================

create table if not exists public.lead_requests (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    type            text not null,          -- 'sample' | 'distributor'
    site            text,                   -- 'hexa-board' | 'cafe3355' | 'cafe2626' ...
    lang            text default 'en',      -- 'ko' | 'ja' | 'en' | 'zh' | ...
    company         text,
    name            text,
    email           text,
    phone           text,
    country         text,                   -- ISO code or free text
    address         text,
    website         text,
    details         jsonb default '{}'::jsonb,  -- product_type, qty, market_size, years_in_business, current_lines, etc.
    message         text,
    files           jsonb,                  -- [{name, url, type}]
    status          text not null default 'new',  -- 'new' | 'contacted' | 'qualified' | 'closed' | 'lost'
    admin_note      text,
    contacted_at    timestamptz,
    closed_at       timestamptz
);

create index if not exists lead_requests_created_at_idx on public.lead_requests (created_at desc);
create index if not exists lead_requests_status_idx     on public.lead_requests (status);
create index if not exists lead_requests_type_idx       on public.lead_requests (type);
create index if not exists lead_requests_site_idx       on public.lead_requests (site);

-- ============================================================
-- RLS: anon 은 INSERT 만, authenticated 는 모두
-- ============================================================
alter table public.lead_requests enable row level security;

drop policy if exists "anon can insert lead" on public.lead_requests;
create policy "anon can insert lead"
    on public.lead_requests for insert
    to anon, authenticated
    with check (true);

drop policy if exists "auth can read lead" on public.lead_requests;
create policy "auth can read lead"
    on public.lead_requests for select
    to authenticated
    using (true);

drop policy if exists "auth can update lead" on public.lead_requests;
create policy "auth can update lead"
    on public.lead_requests for update
    to authenticated
    using (true)
    with check (true);
