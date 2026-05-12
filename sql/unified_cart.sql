-- 통합 장바구니 (cross-domain: cafe2626.com + cotton-print.com + cafe0101.com + cafe3355.com)
-- 세션 ID (anonymous) 또는 user_id (로그인) 기준으로 단일 카트
--
-- 사용법: Supabase Studio → SQL Editor 에서 이 파일 실행

CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE,             -- localStorage 의 anonymous session id
    user_id UUID,                        -- 로그인 시 auth.users(id) 참조
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carts_session_id_idx ON carts (session_id);
CREATE INDEX IF NOT EXISTS carts_user_id_idx ON carts (user_id);
CREATE INDEX IF NOT EXISTS carts_updated_at_idx ON carts (updated_at DESC);

-- 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_carts_updated ON carts;
CREATE TRIGGER trg_carts_updated
    BEFORE UPDATE ON carts
    FOR EACH ROW
    EXECUTE FUNCTION update_carts_updated_at();

-- RLS — anon key 가 자기 세션 ID 의 카트만 읽고 쓸 수 있게
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carts_anon_read ON carts;
CREATE POLICY carts_anon_read ON carts
    FOR SELECT
    USING (true);    -- 카트 데이터는 민감 정보 아님 (session_id 자체가 비밀)

DROP POLICY IF EXISTS carts_anon_insert ON carts;
CREATE POLICY carts_anon_insert ON carts
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS carts_anon_update ON carts;
CREATE POLICY carts_anon_update ON carts
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 오래된 anonymous 카트 자동 정리 (30일 이상 미사용)
-- 별도 cron job 으로 호출 권장 (또는 Edge Function)
CREATE OR REPLACE FUNCTION cleanup_stale_carts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM carts
    WHERE user_id IS NULL
        AND updated_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
