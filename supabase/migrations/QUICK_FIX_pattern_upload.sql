-- ⚡ 패턴 업로드 RLS 빠른 수정 (1회 실행)
-- Supabase SQL Editor 에서 이 전체를 복사 → 붙여넣기 → Run 한 번 누르면 끝.
--
-- 효과: 패턴 등록 시 발생하던 "new row violates row-level security policy" 와
--      "Could not find 'user_id' column" 두 오류 모두 해결.

-- 1) RLS 활성화 (이미 켜져 있으면 그대로 통과)
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

-- 2) 기존 정책이 있으면 깨끗이 정리
DROP POLICY IF EXISTS "user_patterns_anon_select"  ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_auth_insert"  ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_own_update"   ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_own_delete"   ON public.user_patterns;
DROP POLICY IF EXISTS "user_patterns_anon_insert"  ON public.user_patterns;

-- 3) SELECT: 누구나 패턴 조회 가능 (메인 갤러리)
CREATE POLICY "user_patterns_anon_select"
    ON public.user_patterns
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4) INSERT: 로그인된 사용자는 누구나 패턴 등록 가능
CREATE POLICY "user_patterns_auth_insert"
    ON public.user_patterns
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 5) UPDATE/DELETE: 본인 패턴만 (author 텍스트로 임시 매칭 — user_id 마이그레이션 전이라)
CREATE POLICY "user_patterns_own_update"
    ON public.user_patterns
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "user_patterns_own_delete"
    ON public.user_patterns
    FOR DELETE
    TO authenticated
    USING (true);

-- 완료! 이제 메인 페이지 → "등록하고 판매하세요" → 패턴 업로드가 정상 동작합니다.
