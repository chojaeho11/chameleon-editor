-- ============================================================
-- 메인페이지 하단 고객 댓글/포토댓글 (2026-09-29 사장님)
--   포토댓글(사진+글) = reward_grant('comment') 3,000 / 일반댓글(글) = reward_grant('post') 1,000
--   저장 테이블만 신규. 보상은 기존 reward_grant 재사용(하루한도/중복방지 포함).
--   Supabase SQL Editor 에서 실행.
-- ============================================================
create table if not exists public.home_comments (
  id           bigint generated always as identity primary key,
  user_id      uuid,
  author_name  text,
  content      text,
  photo_url    text,
  country_code text default 'KR',
  created_at   timestamptz default now()
);
create index if not exists home_comments_created_idx on public.home_comments(country_code, created_at desc);
alter table public.home_comments enable row level security;

-- 공개 읽기
drop policy if exists home_comments_read on public.home_comments;
create policy home_comments_read on public.home_comments for select using (true);

-- 로그인 사용자는 본인 글만 등록
drop policy if exists home_comments_insert on public.home_comments;
create policy home_comments_insert on public.home_comments for insert to authenticated with check (user_id = auth.uid());

-- 본인 글 삭제 + 본사 관리자 삭제
drop policy if exists home_comments_delete on public.home_comments;
create policy home_comments_delete on public.home_comments for delete to authenticated
  using (user_id = auth.uid() or (auth.jwt()->>'email') = 'korea900as@gmail.com');

grant select on public.home_comments to anon, authenticated;
grant insert, delete on public.home_comments to authenticated;

select 'home_comments ready' as ok;
