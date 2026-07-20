-- 2026-07-20: design_gallery — 거절을 소프트 삭제로 + 고객 본인 조회 허용
--
-- 배경
--   design_gallery 는 마이그레이션 없이 Supabase 대시보드에서 직접 만들어진 테이블이라
--   이 파일이 유일한 변경 기록이다. (기존 정책: dg_insert / dg_read = status='public')
--
--   [문제 1] dg_moderate 의 reject 분기가 DELETE 였다. 관리자가 작품을 거절하면
--            고객이 만든 기록까지 복구 불가로 사라졌다.
--   [문제 2] dg_read 가 status='public' 만 허용해서, 고객이 자기가 만든 디자인조차
--            (pending/hidden 이면) 다시 볼 수 없었다.
--
-- 조치
--   reject → status='rejected' (공개 갤러리에선 빠지지만 고객 보관함에는 남는다)
--   dg_read_own 정책 추가 → 본인 행은 status 와 무관하게 읽을 수 있다.
--   RLS 정책은 permissive OR 로 합쳐지므로 dg_read(공개) 와 공존해도 의도대로 동작한다.

CREATE OR REPLACE FUNCTION public.dg_moderate(_id bigint, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not public.dg_is_admin() then raise exception 'not authorized'; end if;
  if _action = 'approve' then
    update public.design_gallery set status = 'public' where id = _id;
  elsif _action = 'reject' then
    -- 2026-07-20: DELETE → 상태 변경. 고객 개인 보관함에서는 계속 보여야 한다.
    update public.design_gallery set status = 'rejected' where id = _id;
  elsif _action = 'hide' then
    update public.design_gallery set status = 'hidden' where id = _id;
  else
    raise exception 'bad action';
  end if;
end;
$$;

DROP POLICY IF EXISTS dg_read_own ON public.design_gallery;
CREATE POLICY dg_read_own ON public.design_gallery
  FOR SELECT
  USING (auth.uid() = user_id);
