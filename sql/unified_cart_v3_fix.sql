-- 2026-05-12: 42P10 ON CONFLICT 호환 fix
-- 원인: partial unique INDEX (WHERE user_id IS NOT NULL) 는 PostgREST upsert
--      의 ON CONFLICT 와 호환되지 않음. 일반 UNIQUE CONSTRAINT 로 교체.
--      PostgreSQL 표준 UNIQUE 는 NULL 을 distinct 로 취급하므로 익명 행
--      (user_id IS NULL) 다수 존재 가능 — 기존 익명 세션 동작에 영향 없음.
--
-- 사용법: Supabase Studio → SQL Editor 에서 실행

-- 0) 만약 동일 user_id 로 중복 행이 있다면 (이번 테스트 중에는 없음) 정리
WITH ranked AS (
    SELECT id, user_id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
    FROM carts
    WHERE user_id IS NOT NULL
)
DELETE FROM carts USING ranked
WHERE carts.id = ranked.id AND ranked.rn > 1;

-- 1) 기존 partial unique index 제거
DROP INDEX IF EXISTS carts_user_id_unique;

-- 2) 정규 UNIQUE 제약 추가 (NULL 다수 허용 — PG 표준 동작)
ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_user_id_key;
ALTER TABLE carts ADD CONSTRAINT carts_user_id_key UNIQUE (user_id);
