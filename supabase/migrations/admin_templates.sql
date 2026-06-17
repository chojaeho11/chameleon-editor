-- 2026-06-17: admin_templates — 관리자가 등록한 디자인 템플릿 (PNG/JPG 배경 + 편집 가능한 슬롯)
--   고객은 mini editor 의 "템플릿" 버튼으로 그 상품 카테고리의 템플릿 골라 불러옴.
--   슬롯: text(고객이 글씨 입력) / image(고객이 로고/사진 업로드) — 위치·크기·기본 속성은 관리자가 설정.

CREATE TABLE IF NOT EXISTS public.admin_templates (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- 분류: product_category (필수) — 'pp_bc'/'placard'/'pp_lf'/'hb_dw' 등 admin_products.category 값 사용.
    --       product_code (선택) — 특정 상품에만 노출하고 싶을 때 (예: 'lll0' 인스타판넬 A2).
    product_category TEXT NOT NULL,
    product_code     TEXT,

    -- 기본 정보
    name             TEXT NOT NULL,
    site_code        TEXT DEFAULT 'KR',
    notes            TEXT,

    -- 파일 (PNG/JPG)
    background_url   TEXT NOT NULL,       -- 디자인 배경 이미지 URL (Supabase Storage 'design' bucket / templates/ 폴더)
    thumbnail_url    TEXT,                -- 썸네일 (없으면 background_url 사용)
    width_mm         INTEGER,
    height_mm        INTEGER,

    -- 편집 가능한 슬롯들 (JSON 배열)
    --   각 슬롯 형식:
    --     { id, type:'text'|'image',
    --       x, y, w, h (canvas 자연좌표, 0~width_mm/height_mm 비율은 아님),
    --       (text 슬롯) default_text, fontFamily, fontSize, fontWeight, color, textAlign,
    --       (image 슬롯) placeholder_url (선택, 비어있을 때 미리보기) }
    slots            JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 관리
    is_active        BOOLEAN DEFAULT TRUE,
    sort_order       INTEGER DEFAULT 999
);

CREATE INDEX IF NOT EXISTS idx_admin_templates_category
    ON public.admin_templates(product_category, sort_order)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_admin_templates_code
    ON public.admin_templates(product_code, sort_order)
    WHERE is_active = true AND product_code IS NOT NULL;

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public._touch_admin_templates_updated() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_templates_updated ON public.admin_templates;
CREATE TRIGGER trg_admin_templates_updated
    BEFORE UPDATE ON public.admin_templates
    FOR EACH ROW EXECUTE FUNCTION public._touch_admin_templates_updated();

-- RLS
ALTER TABLE public.admin_templates ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 (anon 포함) — is_active = true 인 row 만 SELECT.
DROP POLICY IF EXISTS "admin_templates_select_active" ON public.admin_templates;
CREATE POLICY "admin_templates_select_active" ON public.admin_templates
    FOR SELECT USING (is_active = true);

-- 관리자만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "admin_templates_admin_write" ON public.admin_templates;
CREATE POLICY "admin_templates_admin_write" ON public.admin_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 권한 부여 (anon 은 SELECT 만, authenticated 는 RLS 따라)
GRANT SELECT ON public.admin_templates TO anon;
GRANT ALL ON public.admin_templates TO authenticated;
GRANT USAGE ON SEQUENCE public.admin_templates_id_seq TO authenticated;
