-- ═══════════════════════════════════════════════════════════════
-- Phase 5: Designer tax & banking profiles
-- ═══════════════════════════════════════════════════════════════
-- Stores the legal/tax/banking info the platform needs to pay
-- designers correctly across borders and to meet domestic tax
-- reporting obligations (KR source withholding, 지급조서 submission
-- for overseas payments, etc). Each designer has ONE row — filled
-- in once via the "세금·은행 정보" settings dialog.

CREATE TABLE IF NOT EXISTS public.designer_tax_profiles (
    designer_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Country of residence (ISO2 — KR/JP/US/CN/GB/DE/FR/SA/MA/SG/...)
    country            text NOT NULL,

    -- Legal identity (must match bank account holder exactly for wire
    -- transfers and tax reporting)
    legal_name         text NOT NULL,
    tax_id_type        text NOT NULL,   -- 'personal' | 'business'
    tax_id             text NOT NULL,   -- country-specific (RRN, My Number, SSN/EIN, VAT ID, ...)
    date_of_birth      date,            -- required by some jurisdictions for tax reporting
    residence_address  text NOT NULL,   -- full address incl. country

    -- Banking (domestic fields)
    bank_name          text NOT NULL,
    bank_holder        text NOT NULL,
    bank_account       text NOT NULL,

    -- Banking (international fields — required when country != KR)
    swift_bic          text,
    iban               text,
    routing_number     text,  -- US ABA / other domestic clearing codes
    bank_address       text,  -- required for SWIFT wires

    -- Payout preferences
    payout_currency    text NOT NULL DEFAULT 'KRW',  -- KRW / USD / EUR / JPY / ...

    -- Tax treaty claim (designer affirms under penalty of perjury —
    -- admin verifies before applying reduced withholding)
    claim_tax_treaty   boolean NOT NULL DEFAULT false,

    -- Admin verification workflow
    verified           boolean NOT NULL DEFAULT false,
    verified_at        timestamptz,
    verified_by        uuid REFERENCES auth.users(id),
    admin_note         text,

    created_at         timestamptz NOT NULL DEFAULT NOW(),
    updated_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_designer_tax_profiles_country
    ON public.designer_tax_profiles(country);
CREATE INDEX IF NOT EXISTS idx_designer_tax_profiles_verified
    ON public.designer_tax_profiles(verified);

ALTER TABLE public.designer_tax_profiles ENABLE ROW LEVEL SECURITY;

-- Designer can read & upsert their own profile
DROP POLICY IF EXISTS "dtp_select_own" ON public.designer_tax_profiles;
CREATE POLICY "dtp_select_own" ON public.designer_tax_profiles
FOR SELECT USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "dtp_insert_own" ON public.designer_tax_profiles;
CREATE POLICY "dtp_insert_own" ON public.designer_tax_profiles
FOR INSERT WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "dtp_update_own" ON public.designer_tax_profiles;
CREATE POLICY "dtp_update_own" ON public.designer_tax_profiles
FOR UPDATE USING (designer_id = auth.uid())
WITH CHECK (designer_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- Extend design_withdrawal_requests with the fields copied
-- from the tax profile at submission time (so admin sees a
-- frozen snapshot even if the designer edits later)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.design_withdrawal_requests
    ADD COLUMN IF NOT EXISTS country           text,
    ADD COLUMN IF NOT EXISTS legal_name        text,
    ADD COLUMN IF NOT EXISTS tax_id_type       text,
    ADD COLUMN IF NOT EXISTS tax_id            text,
    ADD COLUMN IF NOT EXISTS residence_address text,
    ADD COLUMN IF NOT EXISTS swift_bic         text,
    ADD COLUMN IF NOT EXISTS iban              text,
    ADD COLUMN IF NOT EXISTS routing_number    text,
    ADD COLUMN IF NOT EXISTS bank_address      text,
    ADD COLUMN IF NOT EXISTS payout_currency   text,
    ADD COLUMN IF NOT EXISTS claim_tax_treaty  boolean DEFAULT false;

-- ──────────────────────────────────────────────────────────
-- Replace the withdrawal RPC: reads tax profile, blocks if
-- missing, copies frozen snapshot into the request row.
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_design_withdrawal_request(bigint, text, text, text, text);

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
    _vat     bigint;
    _card    bigint;
    _plat    bigint;
    _net     bigint;
    _new_id  uuid;
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

    _vat  := FLOOR(_gross * 10 / 100.0);
    _card := FLOOR(_gross *  4 / 100.0);
    _plat := FLOOR(_gross * 20 / 100.0);
    _net  := _gross - _vat - _card - _plat;

    INSERT INTO public.design_withdrawal_requests (
        designer_id, gross_amount, vat_amount, card_fee_amount, platform_fee_amount, net_amount,
        bank_name, bank_account, bank_holder, memo, status,
        country, legal_name, tax_id_type, tax_id, residence_address,
        swift_bic, iban, routing_number, bank_address, payout_currency, claim_tax_treaty
    ) VALUES (
        auth.uid(), _gross, _vat, _card, _plat, _net,
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

-- updated_at trigger for tax profiles
CREATE OR REPLACE FUNCTION public.touch_designer_tax_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_designer_tax_profile_updated_at
    ON public.designer_tax_profiles;
CREATE TRIGGER trg_designer_tax_profile_updated_at
    BEFORE UPDATE ON public.designer_tax_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_designer_tax_profile_updated_at();
