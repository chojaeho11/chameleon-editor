-- ============================================================
-- 가맹점 팁 & 노하우 게시판 (2026-09-25)
--   franchise_tips : 방장(관리자) 글 = 팁 공지(상단 고정), 회원 글 = 자유게시판
-- Supabase SQL Editor 에 붙여넣고 실행하세요.
-- ============================================================
create table if not exists franchise_tips (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  author      text,
  title       text,
  body        text,
  image_url   text,
  is_pinned   boolean default false,   -- 관리자(방장) 팁 공지 = 상단 고정
  created_at  timestamptz default now()
);
alter table franchise_tips enable row level security;
drop policy if exists ft_read   on franchise_tips;
drop policy if exists ft_insert on franchise_tips;
drop policy if exists ft_del    on franchise_tips;
drop policy if exists ft_upd    on franchise_tips;
create policy ft_read   on franchise_tips for select using ( true );
create policy ft_insert on franchise_tips for insert with check ( auth.uid() = user_id );
create policy ft_del    on franchise_tips for delete using ( auth.uid() = user_id or (auth.jwt()->>'email') = 'korea900as@gmail.com' );
create policy ft_upd    on franchise_tips for update
  using ( (auth.jwt()->>'email') = 'korea900as@gmail.com' )
  with check ( (auth.jwt()->>'email') = 'korea900as@gmail.com' );

alter publication supabase_realtime add table franchise_tips;

select policyname, cmd from pg_policies where tablename='franchise_tips' order by policyname;
