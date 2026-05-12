-- 2026-05-12: 통합 카트 v2 — 로그인 사용자 user_id 기반 키잉
-- 기존 carts 테이블에 user_id 부분 unique 인덱스 추가
--
-- 이유: localStorage 의 session_id 는 도메인별로 격리되어 직접 URL 타이핑으로
-- 다른 도메인을 열면 카트가 동기화되지 않음. 로그인된 사용자는 user_id (auth.uid())
-- 가 모든 도메인에서 동일하므로 user_id 기준으로 upsert 하면 자동 동기화.
--
-- 사용법: Supabase Studio → SQL Editor 에서 실행

-- user_id 가 NULL 이 아닌 행만 unique — 익명 세션은 user_id NULL 로 여러 행 허용
CREATE UNIQUE INDEX IF NOT EXISTS carts_user_id_unique
    ON carts (user_id)
    WHERE user_id IS NOT NULL;

-- 익명 → 로그인 전환 시 세션 카트를 user_id 행에 머지하는 헬퍼
-- (옵션: 백엔드에서 호출. 프론트에서는 cart_sync.js 가 직접 머지 처리)
CREATE OR REPLACE FUNCTION claim_anon_cart(p_session_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_anon_items JSONB;
    v_user_items JSONB;
    v_merged JSONB;
BEGIN
    -- 익명 세션 카트
    SELECT items INTO v_anon_items FROM carts WHERE session_id = p_session_id AND user_id IS NULL;
    -- 기존 user 카트
    SELECT items INTO v_user_items FROM carts WHERE user_id = p_user_id;

    IF v_anon_items IS NULL THEN
        RETURN COALESCE(v_user_items, '[]'::jsonb);
    END IF;

    IF v_user_items IS NULL THEN
        -- 익명 카트를 user 카트로 승격
        UPDATE carts SET user_id = p_user_id WHERE session_id = p_session_id AND user_id IS NULL;
        RETURN v_anon_items;
    END IF;

    -- 둘 다 있으면: 단순 concat (cart_sync.js 가 __cart_id 로 중복 제거)
    v_merged := v_user_items || v_anon_items;
    UPDATE carts SET items = v_merged WHERE user_id = p_user_id;
    -- 익명 행은 삭제
    DELETE FROM carts WHERE session_id = p_session_id AND user_id IS NULL;
    RETURN v_merged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
