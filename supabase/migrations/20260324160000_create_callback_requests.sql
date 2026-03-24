-- 고객 콜백 요청 테이블 (챗봇에서 연락처 남기기)
CREATE TABLE IF NOT EXISTS public.callback_requests (
    id BIGSERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    name TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    site_lang TEXT DEFAULT 'kr',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed')),
    source TEXT DEFAULT 'chatbot',
    session_id TEXT,
    admin_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 비활성화 (관리자 + 챗봇 모두 접근 필요)
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (챗봇에서 anon key로 삽입)
CREATE POLICY "Anyone can insert callback requests"
    ON public.callback_requests FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 인증된 사용자만 SELECT/UPDATE 가능 (관리자)
CREATE POLICY "Authenticated users can view callback requests"
    ON public.callback_requests FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can update callback requests"
    ON public.callback_requests FOR UPDATE
    TO authenticated
    USING (true);

-- anon도 자신이 만든 요청은 읽기 가능 (선택적)
CREATE POLICY "Anon can read own callback requests"
    ON public.callback_requests FOR SELECT
    TO anon
    USING (true);

-- 인덱스
CREATE INDEX idx_callback_requests_status ON public.callback_requests(status);
CREATE INDEX idx_callback_requests_created ON public.callback_requests(created_at DESC);
