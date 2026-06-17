-- 2026-06-17: admin_templates 디자이너 워크플로우 확장
--   - 디자이너가 템플릿 제출 → status='pending' → 관리자 승인/거절
--   - 승인 시 30,000원 디자이너 지급 (profiles.deposit + wallet_logs 적립)
--   - 거절 시 row 삭제 (관리자가 trigger)

-- 새 컬럼들
ALTER TABLE public.admin_templates
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',  -- 'pending' / 'approved' / 'rejected'
    ADD COLUMN IF NOT EXISTS submitted_by UUID,                          -- 디자이너 user_id (admin 이 직접 만든 건 null)
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewer_id UUID,                            -- 승인/거절한 admin
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_note TEXT,
    ADD COLUMN IF NOT EXISTS payment_amount INTEGER DEFAULT 30000,        -- 디자이너 지급액 (기본 3만원)
    ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;

-- 기존 row 들은 모두 approved 로 (관리자가 만든 것)
UPDATE public.admin_templates SET status = 'approved' WHERE status IS NULL;

-- 인덱스: 대기 중 템플릿 빠른 조회
CREATE INDEX IF NOT EXISTS idx_admin_templates_pending
    ON public.admin_templates(submitted_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_admin_templates_designer
    ON public.admin_templates(submitted_by, status)
    WHERE submitted_by IS NOT NULL;

-- 기존 RLS 정책 — anon 의 SELECT 는 status='approved' 만
DROP POLICY IF EXISTS "admin_templates_select_active" ON public.admin_templates;
CREATE POLICY "admin_templates_select_approved" ON public.admin_templates
    FOR SELECT USING (is_active = true AND status = 'approved');

-- 디자이너는 자신이 제출한 row 도 SELECT 가능 (자신의 검토 상태 확인용)
DROP POLICY IF EXISTS "admin_templates_select_own" ON public.admin_templates;
CREATE POLICY "admin_templates_select_own" ON public.admin_templates
    FOR SELECT USING (
        submitted_by = auth.uid()
    );

-- 관리자는 모든 row SELECT 가능 (대기·승인·거절 모두)
DROP POLICY IF EXISTS "admin_templates_select_admin" ON public.admin_templates;
CREATE POLICY "admin_templates_select_admin" ON public.admin_templates
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 디자이너는 status='pending' 으로만 INSERT 가능 (자기 user_id 로)
DROP POLICY IF EXISTS "admin_templates_insert_designer" ON public.admin_templates;
CREATE POLICY "admin_templates_insert_designer" ON public.admin_templates
    FOR INSERT WITH CHECK (
        submitted_by = auth.uid() AND status = 'pending'
    );

-- 디자이너는 자기 pending row 만 UPDATE 가능 (이름·슬롯 수정용)
DROP POLICY IF EXISTS "admin_templates_update_designer" ON public.admin_templates;
CREATE POLICY "admin_templates_update_designer" ON public.admin_templates
    FOR UPDATE USING (
        submitted_by = auth.uid() AND status = 'pending'
    );

-- 관리자는 INSERT/UPDATE/DELETE 모두 가능
DROP POLICY IF EXISTS "admin_templates_admin_write" ON public.admin_templates;
CREATE POLICY "admin_templates_admin_write" ON public.admin_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ──────────────────────────────────────────────────────────
-- 승인/거절 RPC — 트랜잭션 안에서 status 변경 + 지급 처리
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_template_submission(
    _template_id BIGINT,
    _note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    _t public.admin_templates%ROWTYPE;
    _designer_id UUID;
    _payment INTEGER;
    _is_admin BOOLEAN;
    _curr_deposit INTEGER;
BEGIN
    -- admin 검증
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO _is_admin;
    IF NOT _is_admin THEN RAISE EXCEPTION 'admin only'; END IF;

    -- 템플릿 row 락
    SELECT * INTO _t FROM public.admin_templates WHERE id = _template_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'template not found'; END IF;
    IF _t.status <> 'pending' THEN RAISE EXCEPTION 'template not pending (current: %)', _t.status; END IF;

    _designer_id := _t.submitted_by;
    _payment := COALESCE(_t.payment_amount, 30000);

    -- 1) 템플릿 status = approved
    UPDATE public.admin_templates
        SET status = 'approved',
            reviewer_id = auth.uid(),
            reviewed_at = NOW(),
            review_note = _note,
            payment_paid_at = NOW()
        WHERE id = _template_id;

    -- 2) 디자이너 deposit 적립 (있는 경우)
    IF _designer_id IS NOT NULL AND _payment > 0 THEN
        SELECT COALESCE(deposit, 0) INTO _curr_deposit FROM public.profiles WHERE id = _designer_id;
        UPDATE public.profiles
            SET deposit = COALESCE(deposit, 0) + _payment
            WHERE id = _designer_id;
        -- 3) 적립 로그
        INSERT INTO public.wallet_logs (user_id, type, amount, description)
            VALUES (_designer_id, 'template_approval', _payment,
                    '템플릿 승인 적립: ' || COALESCE(_t.name, '?') || ' (#' || _template_id || ')');
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'template_id', _template_id,
        'designer_id', _designer_id,
        'paid', _payment
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.approve_template_submission(BIGINT, TEXT) TO authenticated;

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

    -- 거절 = row 삭제 (사용자 요청: 비승인되면 삭제됨)
    DELETE FROM public.admin_templates WHERE id = _template_id;

    RETURN jsonb_build_object('ok', true, 'deleted_id', _template_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reject_template_submission(BIGINT, TEXT) TO authenticated;
