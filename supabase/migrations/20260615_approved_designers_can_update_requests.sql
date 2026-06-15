-- 2026-06-15: 디자이너가 design_requests 를 claim/unclaim/complete 할 수 있도록 RLS 정책 추가.
--
-- 기존 정책 "Owner can update own requests" 는 customer_id (의뢰한 고객) 본인만 UPDATE 허용.
-- 디자이너 보드에서 다른 디자이너가 "의뢰 받기" 누르면 RLS 가 silent reject 해서 0 rows 업데이트 됨
-- (Supabase 는 error 객체 없이 성공 응답을 돌려주므로 프론트엔드가 실패를 감지 못함).
--
-- 해결: designer_profiles 에 is_active=true 로 등록된 승인 디자이너는 모든 design_requests 를 UPDATE 가능.
-- 프론트엔드 코드(designer-board.html) 가 어떤 컬럼/전환을 허용할지 제어.

CREATE POLICY "Approved designers can update requests"
ON public.design_requests
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.designer_profiles dp
        WHERE dp.id = auth.uid()
          AND dp.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.designer_profiles dp
        WHERE dp.id = auth.uid()
          AND dp.is_active = true
    )
);
