-- 2026-06-18 v553: reject_template_submission 변경 — 더이상 row 삭제하지 않고 status='rejected' 로 표시.
--   디자이너 마이페이지에서 반려 사유 확인 + 재제출 가능.
--   완전 삭제는 별도 RPC (admin_delete_template) 추가 — admin 만 가능.

CREATE OR REPLACE FUNCTION public.reject_template_submission(
    _template_id BIGINT,
    _note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    _t public.admin_templates%ROWTYPE;
    _is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO _is_admin;
    IF NOT _is_admin THEN RAISE EXCEPTION 'admin only'; END IF;

    SELECT * INTO _t FROM public.admin_templates WHERE id = _template_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'template not found'; END IF;
    IF _t.status <> 'pending' THEN RAISE EXCEPTION 'template not pending (current: %)', _t.status; END IF;

    -- 거절 = status='rejected' + is_active=false (고객 페이지 노출 차단)
    UPDATE public.admin_templates
        SET status = 'rejected',
            is_active = false,
            reviewer_id = auth.uid(),
            reviewed_at = NOW(),
            review_note = _note
        WHERE id = _template_id;

    RETURN jsonb_build_object('ok', true, 'rejected_id', _template_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reject_template_submission(BIGINT, TEXT) TO authenticated;
