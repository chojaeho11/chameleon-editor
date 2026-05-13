-- 2026-05-13: user_patterns 테이블에 user_id 컬럼 + 로그인 사용자만 본인 명의로 INSERT 가능
-- 카멜레온 프린팅 메인 페이지의 "등록하고 판매하세요" → 패턴 업로드 모달이
-- "new row violates row-level security policy for table user_patterns" 오류로 실패하던 문제 수정.
--
-- 적용 효과:
--  1) user_id uuid 컬럼 추가 (없을 때만)
--  2) INSERT 정책 — 로그인된 사용자가 자기 user_id 로 등록 가능
--  3) SELECT 정책 — approved 패턴은 누구나 (anon 포함) 볼 수 있음 (기존 동작 유지)
--  4) UPDATE / DELETE 정책 — 본인 패턴만 수정/삭제 가능 (어드민 별도)

-- 1) user_id 컬럼 (이미 있으면 SKIP)
ALTER TABLE public.user_patterns
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 인덱스 (적립금 조회 시 author 매핑보다 user_id 가 정확)
CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id ON public.user_patterns(user_id);

-- 2) RLS 활성화 (이미 켜져있으면 NOP)
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

-- 3) 기존 정책 깔끔하게 정리 (이름이 같은 게 있으면 교체)
DROP POLICY IF EXISTS "user_patterns_anon_select"    ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_auth_insert"    ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_own_update"     ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_own_delete"     ON public.user_patterns;

-- 4) SELECT: 누구나 approved 패턴 조회 가능 (홈 갤러리·검색)
CREATE POLICY "user_patterns_anon_select"
    ON public.user_patterns
    FOR SELECT
    TO anon, authenticated
    USING (status = 'approved' OR auth.uid() = user_id);

-- 5) INSERT: 로그인된 사용자가 본인 user_id 로만 등록 가능
CREATE POLICY "user_patterns_auth_insert"
    ON public.user_patterns
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 6) UPDATE: 본인 패턴만 (이름 수정 등)
CREATE POLICY "user_patterns_own_update"
    ON public.user_patterns
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7) DELETE: 본인 패턴만
CREATE POLICY "user_patterns_own_delete"
    ON public.user_patterns
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 참고: 기존 시드 패턴들 (user_id = NULL) 은 anon SELECT 조건의
-- status='approved' 분기로 계속 보입니다. 어드민이 향후 적립금을 위해
-- author 텍스트 매칭으로 user_id 를 backfill 할 수 있도록 컬럼만 추가해뒀습니다.
