-- 2026-06-18 v559: 템플릿 정산 요청 — 서버 측 atomic RPC.
--   클라이언트가 available 을 계산하면 RLS 때문에 자신의 출금 row 를 못 봐서 무한 반복 가능.
--   RPC 안에서 단일 트랜잭션으로 approved_sum − withdrawn_sum 계산 + INSERT → race 차단.

-- 1) 디자이너가 자신의 출금 요청을 SELECT 할 수 있도록 RLS 추가 (마이페이지에서 정산 이력 표시용)
DROP POLICY IF EXISTS "dwr_select_own_designer" ON public.design_withdrawal_requests;
CREATE POLICY "dwr_select_own_designer" ON public.design_withdrawal_requests
    FOR SELECT USING (designer_id = auth.uid());

-- 2) Atomic 정산 요청 RPC
CREATE OR REPLACE FUNCTION public.request_template_withdrawal(
    _country TEXT DEFAULT 'KR'
) RETURNS JSONB AS $$
DECLARE
    _user_id        UUID    := auth.uid();
    _approved_sum   INTEGER := 0;
    _withdrawn_sum  INTEGER := 0;
    _available      INTEGER := 0;
    _tax_rate       NUMERIC := 0.033;
    _fee            INTEGER;
    _net            INTEGER;
    _dp             RECORD;
    _new_id         BIGINT;
BEGIN
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    -- 승인된 템플릿 총 적립금
    SELECT COALESCE(SUM(payment_amount), 0)
        INTO _approved_sum
        FROM public.admin_templates
        WHERE submitted_by = _user_id
          AND status = 'approved';

    -- 이미 요청한 템플릿 정산 (pending/approved/paid 모두 합산 — 취소된 것만 제외)
    SELECT COALESCE(SUM(gross_amount), 0)
        INTO _withdrawn_sum
        FROM public.design_withdrawal_requests
        WHERE designer_id = _user_id
          AND status IN ('pending', 'approved', 'paid')
          AND (source = 'template_royalty' OR memo LIKE '[템플릿%');

    _available := _approved_sum - _withdrawn_sum;

    IF _available <= 0 THEN
        RAISE EXCEPTION '정산 가능 금액이 없습니다 (적립: %원, 이미 요청: %원)', _approved_sum, _withdrawn_sum;
    END IF;

    -- 원천세 (KR 3.3%, JP 10%, US 0%)
    IF _country = 'JP' THEN _tax_rate := 0.10;
    ELSIF _country = 'US' THEN _tax_rate := 0.0;
    END IF;
    _fee := ROUND(_available * _tax_rate);
    _net := _available - _fee;

    -- 디자이너 은행/세금 정보 조회
    SELECT * INTO _dp FROM public.designer_profiles WHERE id = _user_id;

    -- 정산 요청 INSERT
    INSERT INTO public.design_withdrawal_requests (
        designer_id, country, gross_amount, net_amount,
        vat_amount, card_fee_amount, platform_fee_amount,
        legal_name, tax_id, tax_id_type, residence_address,
        bank_name, bank_holder, bank_account,
        status, requested_at, source, memo
    ) VALUES (
        _user_id, _country, _available, _net,
        0, 0, _fee,
        COALESCE(_dp.legal_name, _dp.display_name, ''),
        COALESCE(_dp.tax_id, ''),
        CASE WHEN _country = 'KR' THEN 'RRN' ELSE 'OTHER' END,
        COALESCE(_dp.residence_address, ''),
        COALESCE(_dp.bank_name, ''),
        COALESCE(_dp.bank_holder, ''),
        COALESCE(_dp.bank_account, ''),
        'pending', NOW(),
        'template_royalty',
        '[템플릿 정산 요청] ' || _available::TEXT || '원 (적립 ' || _approved_sum::TEXT || ' - 이전 요청 ' || _withdrawn_sum::TEXT || ')'
    ) RETURNING id INTO _new_id;

    RETURN jsonb_build_object(
        'ok',         true,
        'request_id', _new_id,
        'gross',      _available,
        'net',        _net,
        'fee',        _fee,
        'tax_rate',   _tax_rate
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_template_withdrawal(TEXT) TO authenticated;
