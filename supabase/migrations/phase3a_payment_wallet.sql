-- ═══════════════════════════════════════════════════════════════
-- Phase 3a: Payment, completion and withdrawal flow
-- Run this in Supabase SQL Editor after Phase 1 and Phase 2.
-- ═══════════════════════════════════════════════════════════════
-- Fee model (designer receives 66% of gross):
--   - VAT (부가세)              10%
--   - Card processing fee        4%
--   - Platform commission       20%
--   - Net payout to designer    66%
--
-- Note: We use 'design_withdrawal_requests' (not 'withdrawal_requests')
-- because the main site already has a 'withdrawal_requests' table for
-- partner/referral payouts that uses a different schema.

-- ──────────────────────────────────────────────────────────
-- 1) design_bids payment lifecycle
-- ──────────────────────────────────────────────────────────
-- payment_status lifecycle:
--   pending                    — bid selected but not yet paid by client
--   paid                       — client paid, work in progress
--   completed_pending_files    — client clicked Complete, waiting for designer's final archive
--   released                   — designer uploaded final image + PDF, payout credited to wallet
ALTER TABLE public.design_bids
    ADD COLUMN IF NOT EXISTS payment_status text,
    ADD COLUMN IF NOT EXISTS payment_method text, -- 'card' | 'bank' | 'cart'
    ADD COLUMN IF NOT EXISTS paid_at timestamptz,
    ADD COLUMN IF NOT EXISTS client_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS released_at timestamptz,
    ADD COLUMN IF NOT EXISTS paid_order_id bigint,  -- link to orders.id (main cart PG)
    ADD COLUMN IF NOT EXISTS final_archive_urls jsonb DEFAULT '[]'::jsonb;

-- Back-fill existing selected bids so the new state machine is consistent
UPDATE public.design_bids b
    SET payment_status = 'released'
FROM public.design_requests r
WHERE b.request_id = r.id
    AND b.status = 'selected'
    AND r.status = 'completed'
    AND b.payment_status IS NULL;

UPDATE public.design_bids b
    SET payment_status = 'paid'
FROM public.design_requests r
WHERE b.request_id = r.id
    AND b.status = 'selected'
    AND r.status = 'in_progress'
    AND b.payment_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_design_bids_payment_status
    ON public.design_bids(payment_status);

-- ──────────────────────────────────────────────────────────
-- 2) Designer wallet balance
-- ──────────────────────────────────────────────────────────
-- We reuse designer_profiles.total_earnings and add an available balance
-- that tracks undrawn funds. Withdrawals deduct from wallet_balance only.
ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS wallet_balance bigint NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_pending_withdrawal bigint NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────
-- 3) Design withdrawal requests (separate from main site's
--    partner withdrawal_requests table)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.design_withdrawal_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gross_amount bigint NOT NULL,       -- requested withdrawal amount (from wallet)
    vat_amount bigint NOT NULL,         -- 10%
    card_fee_amount bigint NOT NULL,    -- 4%
    platform_fee_amount bigint NOT NULL,-- 20%
    net_amount bigint NOT NULL,         -- 66% net payout
    bank_name text,
    bank_account text,
    bank_holder text,
    memo text,
    status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
    admin_note text,
    requested_at timestamptz NOT NULL DEFAULT NOW(),
    processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_design_withdrawal_requests_designer
    ON public.design_withdrawal_requests(designer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_withdrawal_requests_status
    ON public.design_withdrawal_requests(status);

ALTER TABLE public.design_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dwr_select_own" ON public.design_withdrawal_requests;
CREATE POLICY "dwr_select_own" ON public.design_withdrawal_requests
FOR SELECT USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "dwr_insert_own" ON public.design_withdrawal_requests;
CREATE POLICY "dwr_insert_own" ON public.design_withdrawal_requests
FOR INSERT WITH CHECK (designer_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 4) Payment logs (audit trail)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.design_payment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id uuid NOT NULL REFERENCES public.design_bids(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES public.design_requests(id) ON DELETE CASCADE,
    event text NOT NULL, -- 'paid' | 'released' | 'refunded' | ...
    method text,         -- 'card' | 'bank' | 'cart'
    amount bigint NOT NULL,
    actor_id uuid,
    note text,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_payment_logs_bid
    ON public.design_payment_logs(bid_id, created_at);

-- Allow authenticated users to read/write their own audit entries
ALTER TABLE public.design_payment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dpl_select_participants" ON public.design_payment_logs;
CREATE POLICY "dpl_select_participants" ON public.design_payment_logs
FOR SELECT USING (
    auth.uid() = actor_id
    OR auth.uid() IN (SELECT customer_id FROM public.design_requests WHERE id = design_payment_logs.request_id)
    OR auth.uid() IN (SELECT designer_id FROM public.design_bids WHERE id = design_payment_logs.bid_id)
);
DROP POLICY IF EXISTS "dpl_insert_own" ON public.design_payment_logs;
CREATE POLICY "dpl_insert_own" ON public.design_payment_logs
FOR INSERT WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- ──────────────────────────────────────────────────────────
-- 5) RPC: mark a design_bid as paid (called after cart PG success)
-- ──────────────────────────────────────────────────────────
-- Called from success.html after the main cart PG confirms payment.
-- Verifies the caller owns the request (is the customer).
CREATE OR REPLACE FUNCTION public.mark_design_bid_paid(
    _bid_id uuid,
    _method text DEFAULT 'cart',
    _order_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _bid record;
    _req record;
BEGIN
    SELECT * INTO _bid FROM public.design_bids WHERE id = _bid_id;
    IF _bid.id IS NULL THEN RAISE EXCEPTION 'Bid not found'; END IF;

    SELECT * INTO _req FROM public.design_requests WHERE id = _bid.request_id;
    IF _req.customer_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the request owner can mark the bid as paid';
    END IF;
    IF _bid.payment_status = 'paid'
        OR _bid.payment_status = 'completed_pending_files'
        OR _bid.payment_status = 'released' THEN
        -- already marked, idempotent no-op
        RETURN;
    END IF;

    UPDATE public.design_bids
        SET payment_status = 'paid',
            payment_method = COALESCE(_method, 'cart'),
            paid_order_id = _order_id,
            paid_at = NOW()
        WHERE id = _bid_id;

    INSERT INTO public.design_payment_logs (bid_id, request_id, event, method, amount, actor_id, note)
        VALUES (_bid_id, _bid.request_id, 'paid', COALESCE(_method, 'cart'), _bid.price, auth.uid(),
                CASE WHEN _order_id IS NOT NULL THEN 'Paid via cart (order ' || _order_id || ')' ELSE 'Paid' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_design_bid_paid(uuid, text, bigint) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 6) RPC: credit wallet and log, called when designer uploads final archive
-- ──────────────────────────────────────────────────────────
-- Verifies the caller is the designer of the bid and the bid is in
-- 'completed_pending_files' state.
CREATE OR REPLACE FUNCTION public.release_design_bid_payment(_bid_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _bid record;
BEGIN
    SELECT * INTO _bid FROM public.design_bids WHERE id = _bid_id;
    IF _bid.id IS NULL THEN
        RAISE EXCEPTION 'Bid not found';
    END IF;
    IF _bid.designer_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the designer can release their own bid';
    END IF;
    IF _bid.payment_status <> 'completed_pending_files' THEN
        RAISE EXCEPTION 'Bid is not in completed_pending_files state (current: %)', _bid.payment_status;
    END IF;

    -- Update bid
    UPDATE public.design_bids
        SET payment_status = 'released',
            released_at = NOW()
        WHERE id = _bid_id;

    -- Credit designer wallet
    UPDATE public.designer_profiles
        SET wallet_balance = wallet_balance + _bid.price,
            total_earnings = COALESCE(total_earnings, 0) + _bid.price
        WHERE id = _bid.designer_id;

    -- Log
    INSERT INTO public.design_payment_logs (bid_id, request_id, event, amount, actor_id, note)
        VALUES (_bid_id, _bid.request_id, 'released', _bid.price, auth.uid(), 'Final archive uploaded');
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_design_bid_payment(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 7) RPC: submit withdrawal request (moves wallet → pending)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_design_withdrawal_request(
    _gross bigint,
    _bank_name text,
    _bank_account text,
    _bank_holder text,
    _memo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _balance bigint;
    _vat bigint;
    _card bigint;
    _plat bigint;
    _net bigint;
    _new_id uuid;
BEGIN
    IF _gross <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

    SELECT wallet_balance INTO _balance FROM public.designer_profiles WHERE id = auth.uid();
    IF _balance IS NULL THEN RAISE EXCEPTION 'Designer profile not found'; END IF;
    IF _balance < _gross THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

    _vat  := FLOOR(_gross * 10 / 100.0);
    _card := FLOOR(_gross *  4 / 100.0);
    _plat := FLOOR(_gross * 20 / 100.0);
    _net  := _gross - _vat - _card - _plat;

    INSERT INTO public.design_withdrawal_requests (
        designer_id, gross_amount, vat_amount, card_fee_amount, platform_fee_amount, net_amount,
        bank_name, bank_account, bank_holder, memo, status
    ) VALUES (
        auth.uid(), _gross, _vat, _card, _plat, _net,
        _bank_name, _bank_account, _bank_holder, _memo, 'pending'
    ) RETURNING id INTO _new_id;

    -- Move wallet balance to pending
    UPDATE public.designer_profiles
        SET wallet_balance = wallet_balance - _gross,
            wallet_pending_withdrawal = wallet_pending_withdrawal + _gross
        WHERE id = auth.uid();

    RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_design_withdrawal_request(bigint, text, text, text, text) TO authenticated;
