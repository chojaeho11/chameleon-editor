-- 2026-06-17: 템플릿 등록 가능 카테고리 화이트리스트
--   admin_products 의 모든 카테고리를 보여주는 게 아니라, 관리자가 명시적으로 등록한 카테고리만 표시.
--   디자이너 / admin 의 템플릿 등록 picker, 고객의 템플릿 picker, 모두 이 테이블 기준으로 필터.

CREATE TABLE IF NOT EXISTS public.template_eligible_categories (
    id              BIGSERIAL PRIMARY KEY,
    category_code   TEXT NOT NULL UNIQUE,   -- admin_products.category 값
    display_name_kr TEXT,                    -- 한글 노출명 (없으면 admin_products.name 첫 항목)
    display_name_jp TEXT,                    -- 일본어 노출명
    display_name_us TEXT,                    -- 영문 노출명
    sort_order      INTEGER DEFAULT 999,
    is_active       BOOLEAN DEFAULT TRUE,
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tec_active
    ON public.template_eligible_categories(sort_order, category_code)
    WHERE is_active = true;

-- 모든 사용자 — is_active 만 SELECT
ALTER TABLE public.template_eligible_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tec_select_active" ON public.template_eligible_categories;
CREATE POLICY "tec_select_active" ON public.template_eligible_categories
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "tec_admin_all" ON public.template_eligible_categories;
CREATE POLICY "tec_admin_all" ON public.template_eligible_categories
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

GRANT SELECT ON public.template_eligible_categories TO anon;
GRANT ALL ON public.template_eligible_categories TO authenticated;
GRANT USAGE ON SEQUENCE public.template_eligible_categories_id_seq TO authenticated;

-- 기본 화이트리스트 (관리자가 추후 추가/제거)
INSERT INTO public.template_eligible_categories (category_code, display_name_kr, display_name_jp, display_name_us, sort_order)
VALUES
    ('pp_business_card', '명함',             '名刺',                  'Business Cards',    10),
    ('pp_leaflet',       '전단지',           'チラシ',                'Leaflets',          20),
    ('placard',          '현수막',           '横断幕',                'Placards',          30),
    ('banner',           '배너',             'バナー',                'Banners',           40),
    ('hb_display_wall',  '허니콤 가벽',      'ハニカム間仕切り',      'Honeycomb Walls',   50),
    ('paper_display',    '종이매대',         '紙売り場',              'Paper Displays',    60),
    ('hb_insta',         '인스타판넬',       'インスタパネル',        'Insta Panels',      70)
ON CONFLICT (category_code) DO NOTHING;
