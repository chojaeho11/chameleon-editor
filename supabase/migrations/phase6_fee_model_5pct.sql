-- ═══════════════════════════════════════════════════════════════
-- Phase 6: Industry-lowest 5% fee model
-- ═══════════════════════════════════════════════════════════════
-- Replaces the old 34% (10% VAT + 4% card + 20% platform) model.
-- Company keeps exactly 5% real net regardless of payment route.
--
-- Route split:
--   KR (TossPay, Korean entity):
--       pg 2.9% + platform 5.5% (VAT incl.) + withholding 3.3% (사업소득세)
--       → designer net 88.3%
--   Non-KR (Stripe, US LLC):
--       pg 5.0% + platform 5.0% (no VAT)
--       → designer net 90.0%
--
-- Korean freelancer 원천징수 3.3% is mandatory by Korean tax law
-- (소득세법 일용직/프리랜서 사업소득 원천징수) — the platform acts
-- as the withholding agent and remits to NTS quarterly.
--
-- The withdrawal RPC picks the route from the designer's country
-- in their tax profile, and freezes the numbers on the withdrawal
-- request row so the admin sees exactly what the designer saw.

-- Add withholding_amount column for 사업소득 원천징수 tracking
ALTER TABLE public.design_withdrawal_requests
    ADD COLUMN IF NOT EXISTS withholding_amount bigint DEFAULT 0;

DROP FUNCTION IF EXISTS public.submit_design_withdrawal_request(bigint, text);

CREATE OR REPLACE FUNCTION public.submit_design_withdrawal_request(
    _gross bigint,
    _memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _balance bigint;
    _prof    record;
    _pg_pct        numeric;
    _plat_pct      numeric;
    _withhold_pct  numeric;
    _pg_amt        bigint;
    _plat_amt      bigint;
    _vat_amt       bigint;
    _withhold_amt  bigint;
    _net           bigint;
    _is_kr         boolean;
    _new_id        uuid;
BEGIN
    IF _gross <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

    SELECT wallet_balance INTO _balance
        FROM public.designer_profiles
        WHERE id = auth.uid();
    IF _balance IS NULL THEN RAISE EXCEPTION 'Designer profile not found'; END IF;
    IF _balance < _gross THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

    SELECT * INTO _prof
        FROM public.designer_tax_profiles
        WHERE designer_id = auth.uid();
    IF _prof.designer_id IS NULL THEN
        RAISE EXCEPTION 'Tax profile missing — please complete 세금·은행 정보 first';
    END IF;

    -- Route-aware fee model
    _is_kr := (_prof.country = 'KR');
    IF _is_kr THEN
        _pg_pct       := 2.9;   -- TossPay average
        _plat_pct     := 5.5;   -- VAT-inclusive (KR corporate)
        _withhold_pct := 3.3;   -- 사업소득 원천징수 (소득세 3% + 지방세 0.3%)
    ELSE
        _pg_pct       := 5.0;   -- Stripe international + FX
        _plat_pct     := 5.0;   -- US LLC, no VAT
        _withhold_pct := 0.0;   -- Intl: designer self-reports in country of residence
    END IF;

    _pg_amt       := FLOOR(_gross * _pg_pct       / 100.0);
    _plat_amt     := FLOOR(_gross * _plat_pct     / 100.0);
    _withhold_amt := FLOOR(_gross * _withhold_pct / 100.0);
    _vat_amt      := CASE WHEN _is_kr THEN FLOOR(_plat_amt * 10 / 110.0) ELSE 0 END;
    _net          := _gross - _pg_amt - _plat_amt - _withhold_amt;

    INSERT INTO public.design_withdrawal_requests (
        designer_id, gross_amount, vat_amount, card_fee_amount, platform_fee_amount,
        withholding_amount, net_amount,
        bank_name, bank_account, bank_holder, memo, status,
        country, legal_name, tax_id_type, tax_id, residence_address,
        swift_bic, iban, routing_number, bank_address, payout_currency, claim_tax_treaty
    ) VALUES (
        auth.uid(), _gross, _vat_amt, _pg_amt, _plat_amt,
        _withhold_amt, _net,
        _prof.bank_name, _prof.bank_account, _prof.bank_holder, _memo, 'pending',
        _prof.country, _prof.legal_name, _prof.tax_id_type, _prof.tax_id, _prof.residence_address,
        _prof.swift_bic, _prof.iban, _prof.routing_number, _prof.bank_address,
        _prof.payout_currency, _prof.claim_tax_treaty
    ) RETURNING id INTO _new_id;

    UPDATE public.designer_profiles
        SET wallet_balance = wallet_balance - _gross,
            wallet_pending_withdrawal = wallet_pending_withdrawal + _gross
        WHERE id = auth.uid();

    RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_design_withdrawal_request(bigint, text) TO authenticated;
