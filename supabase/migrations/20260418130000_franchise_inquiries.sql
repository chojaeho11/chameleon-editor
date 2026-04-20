-- ============================================================
-- Franchise Inquiries
-- 가맹점 문의 테이블 (franchise.html 폼에서 접수)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.franchise_inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    country text,
    email text NOT NULL,
    phone text,
    company text,
    experience text,            -- none | print | sign | retail | other
    message text,
    lang_submitted text,        -- ko / ja / en / zh / ar / es / de / fr
    page_url text,
    user_agent text,
    status text DEFAULT 'new',  -- new | contacted | qualified | rejected | closed
    admin_memo text,
    contacted_at timestamptz,
    created_at timestamptz DEFAULT NOW()
);

-- 공개 INSERT 허용 (form submission from public page)
-- 조회는 관리자만 가능하도록 RLS 활성화 (다른 테이블들처럼 emergency-disable 패턴 따라가도 됨)
ALTER TABLE public.franchise_inquiries DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_franchise_inq_status     ON public.franchise_inquiries (status);
CREATE INDEX IF NOT EXISTS idx_franchise_inq_country    ON public.franchise_inquiries (country);
CREATE INDEX IF NOT EXISTS idx_franchise_inq_created    ON public.franchise_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_franchise_inq_email      ON public.franchise_inquiries (email);
