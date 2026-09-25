-- ============================================================
-- 가맹점 커뮤니티 (2026-09-25)  — /franchise 하단 커뮤니티용 3테이블
--   1) franchise_chat            : 가맹점 단톡방 (텍스트 + 사진)
--   2) franchise_notices         : 본사 공지사항 (관리자만 작성)
--   3) franchise_notice_comments : 공지 댓글 (로그인 회원)
-- Supabase SQL Editor 에 그대로 붙여넣고 실행하세요.
-- ============================================================

-- 1) 단톡방 ------------------------------------------------
create table if not exists franchise_chat (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  author      text,
  message     text,
  image_url   text,
  created_at  timestamptz default now()
);
alter table franchise_chat enable row level security;
drop policy if exists fc_read   on franchise_chat;
drop policy if exists fc_insert on franchise_chat;
drop policy if exists fc_del    on franchise_chat;
-- 로그인(가맹점/리셀러/관리자)한 회원은 읽기·작성 가능. 본인 글만 삭제.
create policy fc_read   on franchise_chat for select using ( auth.role() = 'authenticated' );
create policy fc_insert on franchise_chat for insert with check ( auth.uid() = user_id );
create policy fc_del    on franchise_chat for delete using ( auth.uid() = user_id or (auth.jwt()->>'email') = 'korea900as@gmail.com' );

-- 2) 공지사항 (관리자만 작성/수정/삭제, 누구나 읽기) ------------
create table if not exists franchise_notices (
  id          bigint generated always as identity primary key,
  title       text,
  body        text,
  created_by  text,
  created_at  timestamptz default now()
);
alter table franchise_notices enable row level security;
drop policy if exists fn_read  on franchise_notices;
drop policy if exists fn_admin on franchise_notices;
create policy fn_read  on franchise_notices for select using ( true );
create policy fn_admin on franchise_notices for all
  using ( (auth.jwt()->>'email') = 'korea900as@gmail.com' )
  with check ( (auth.jwt()->>'email') = 'korea900as@gmail.com' );

-- 3) 공지 댓글 (로그인 회원 작성, 누구나 읽기) -------------------
create table if not exists franchise_notice_comments (
  id          bigint generated always as identity primary key,
  notice_id   bigint references franchise_notices(id) on delete cascade,
  user_id     uuid,
  author      text,
  body        text,
  created_at  timestamptz default now()
);
alter table franchise_notice_comments enable row level security;
drop policy if exists fnc_read   on franchise_notice_comments;
drop policy if exists fnc_insert on franchise_notice_comments;
drop policy if exists fnc_del    on franchise_notice_comments;
create policy fnc_read   on franchise_notice_comments for select using ( true );
create policy fnc_insert on franchise_notice_comments for insert with check ( auth.uid() = user_id );
create policy fnc_del    on franchise_notice_comments for delete using ( auth.uid() = user_id or (auth.jwt()->>'email') = 'korea900as@gmail.com' );

-- 실시간(선택) — 단톡방/공지 즉시 반영을 원하면 realtime publication 에 추가
alter publication supabase_realtime add table franchise_chat;
alter publication supabase_realtime add table franchise_notices;
alter publication supabase_realtime add table franchise_notice_comments;

-- 확인
select tablename, policyname, cmd from pg_policies
where tablename in ('franchise_chat','franchise_notices','franchise_notice_comments')
order by tablename, policyname;
