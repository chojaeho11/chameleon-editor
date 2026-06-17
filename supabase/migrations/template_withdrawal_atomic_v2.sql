-- 2026-06-18 v559b: 이전 마이그레이션에서 source 컬럼 사용 — 환경에 따라 source 컬럼이 없을 수 있음.
--   memo 의 [템플릿 prefix 만으로 필터링 + INSERT 시에도 source 컬럼 사용 안 함.

-- 기존 RPC 삭제 후 재생성
DROP FUNCTION IF EXISTS public.request_template_withdrawal(TEXT);

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

    -- 이미 요청한 템플릿 정산 — memo 의 [템플릿 prefix 로만 식별 (source 컬럼 사용 안 함)
    SELECT COALESCE(SUM(gross_amount), 0)
        INTO _withdrawn_sum
        FROM public.design_withdrawal_requests
        WHERE designer_id = _user_id
          AND status IN ('pending', 'approved', 'paid')
          AND memo LIKE '[템플릿%';

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

    -- 정산 요청 INSERT (source 컬럼 제외)
    INSERT INTO public.design_withdrawal_requests (
        designer_id, country, gross_amount, net_amount,
        vat_amount, card_fee_amount, platform_fee_amount,
        legal_name, tax_id, tax_id_type, residence_address,
        bank_name, bank_holder, bank_account,
        status, requested_at, memo
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

-- ──────────────────────────────────────────────────────────
-- 중복 template_royalty pending 정리 — memo 만 사용
-- ──────────────────────────────────────────────────────────
-- 본인의 [템플릿 출금 요청 중 가장 오래된 1건만 남기고 나머지 삭제 (가장 최근 N-1 건 삭제)
-- ※ 만약 모두 잘못 만들어진 거라면 LIMIT 을 더 크게 하거나 WHERE 조건 조정.
DELETE FROM public.design_withdrawal_requests
WHERE id IN (
    SELECT id FROM public.design_withdrawal_requests
    WHERE designer_id = (SELECT id FROM public.profiles WHERE email = 'korea900as@gmail.com' LIMIT 1)
      AND status = 'pending'
      AND memo LIKE '[템플릿%'
    ORDER BY id DESC      -- 최신 row 삭제 (오래된 1건 유지)
    LIMIT 1               -- 2건 중 1건만 삭제
);
