-- ═══════════════════════════════════════
-- 디자인 마켓플레이스 테이블 (크몽 스타일)
-- ═══════════════════════════════════════

-- 1) 디자이너 프로필
CREATE TABLE IF NOT EXISTS public.designer_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name TEXT NOT NULL DEFAULT '',
    bio TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    portfolio_urls JSONB DEFAULT '[]',
    specialties JSONB DEFAULT '[]',
    avg_rating NUMERIC(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_earnings INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.designer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active designers" ON public.designer_profiles FOR SELECT USING (is_active = true);
CREATE POLICY "Users can insert own profile" ON public.designer_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.designer_profiles FOR UPDATE USING (auth.uid() = id);

-- 2) 디자인 의뢰 요청
CREATE TABLE IF NOT EXISTS public.design_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT DEFAULT 'other',
    budget_min INTEGER DEFAULT 0,
    budget_max INTEGER DEFAULT 0,
    phone TEXT DEFAULT '',
    files JSONB DEFAULT '[]',
    status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
    selected_bid_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view open requests" ON public.design_requests FOR SELECT USING (true);
CREATE POLICY "Auth users can insert requests" ON public.design_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Owner can update own requests" ON public.design_requests FOR UPDATE USING (auth.uid() = customer_id);

CREATE INDEX idx_design_requests_status ON public.design_requests(status);
CREATE INDEX idx_design_requests_created ON public.design_requests(created_at DESC);

-- 3) 디자이너 입찰
CREATE TABLE IF NOT EXISTS public.design_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.design_requests(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES auth.users(id),
    price INTEGER NOT NULL,
    timeline_days INTEGER DEFAULT 7,
    message TEXT DEFAULT '',
    portfolio_urls JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','selected','rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.design_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Request owner and bid owner can view bids" ON public.design_bids FOR SELECT USING (true);
CREATE POLICY "Designers can insert bids" ON public.design_bids FOR INSERT TO authenticated WITH CHECK (auth.uid() = designer_id);
CREATE POLICY "System can update bids" ON public.design_bids FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_design_bids_request ON public.design_bids(request_id);

-- 4) 리뷰/평점
CREATE TABLE IF NOT EXISTS public.design_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.design_requests(id),
    designer_id UUID NOT NULL REFERENCES auth.users(id),
    customer_id UUID NOT NULL REFERENCES auth.users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.design_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.design_reviews FOR SELECT USING (true);
CREATE POLICY "Customer can insert review" ON public.design_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

-- 5) 정산 내역
CREATE TABLE IF NOT EXISTS public.design_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.design_requests(id),
    customer_id UUID NOT NULL,
    designer_id UUID NOT NULL,
    total_amount INTEGER NOT NULL,
    designer_share INTEGER NOT NULL,
    platform_share INTEGER NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.design_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.design_transactions FOR SELECT TO authenticated USING (auth.uid() = designer_id OR auth.uid() = customer_id);
CREATE POLICY "System can insert transactions" ON public.design_transactions FOR INSERT TO authenticated WITH CHECK (true);
