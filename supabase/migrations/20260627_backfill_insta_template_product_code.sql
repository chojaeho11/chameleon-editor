-- 2026-06-27: 인스타판넬 대형(0ll) 에서 등록했던 템플릿들이 product_code 없이(null) 저장되어
--   사이즈 공유 상태였음. 해당 레거시 템플릿을 대형(0ll) 전용으로 지정.
-- 적용 후: 인스타 대형에서만 노출되고 다른 사이즈에는 안 보임.
-- (다른 사이즈용 템플릿은 해당 사이즈 페이지에서 다시 등록하면 자동으로 그 제품코드로 저장됨.)

update public.admin_templates
   set product_code = '0ll'
 where id in (94, 95)
   and product_code is null
   and product_category = 'hb_insta';
