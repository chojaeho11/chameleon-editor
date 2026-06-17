-- 2026-06-17 v548: 상품별 템플릿 등록 가능 플래그
--   기존 template_eligible_categories (카테고리 단위) 대신, 상품 단위로 명시.
--   global_admin 상품옵션 → "🎨 템플릿 등록상품" 체크박스로 토글.
--   디자이너/관리자의 템플릿 등록 picker, 고객의 템플릿 picker, 모두 is_template_eligible = true 만 조회.

ALTER TABLE public.admin_products
    ADD COLUMN IF NOT EXISTS is_template_eligible BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_admin_products_template_eligible
    ON public.admin_products(category, sort_order)
    WHERE is_template_eligible = true;
