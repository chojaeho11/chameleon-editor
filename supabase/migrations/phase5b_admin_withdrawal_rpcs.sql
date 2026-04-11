-- ═══════════════════════════════════════════════════════════════
-- Phase 5b: Admin RPCs for design marketplace withdrawal processing
-- ═══════════════════════════════════════════════════════════════
-- The RLS policies on design_withdrawal_requests, designer_profiles
-- and designer_tax_profiles all scope writes to the owning user.
-- Admins (profiles.role = 'admin') need to approve/reject/pay
-- withdrawals and verify tax profiles. These SECURITY DEFINER RPCs
-- perform the caller's admin check and then run the updates as
-- the function owner (bypassing RLS).

-- Helper: raise if caller is not admin
CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _role text;
BEGIN
    SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
    IF _role IS NULL OR _role <> 'admin' THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- Verify a designer's tax profile (admin reviewed the info)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_verify_designer_tax_profile(_designer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public._require_admin();
    UPDATE public.designer_tax_profiles
        SET verified = true,
            verified_at = NOW(),
            verified_by = auth.uid()
        WHERE designer_id = _designer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_designer_tax_profile(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Approve a withdrawal request (admin will then send money)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_design_withdrawal(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public._require_admin();
    UPDATE public.design_withdrawal_requests
        SET status = 'approved',
            processed_at = NOW()
        WHERE id = _req_id
          AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not pending'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_design_withdrawal(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Reject a withdrawal — restore the designer's wallet balance
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reject_design_withdrawal(_req_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r record;
BEGIN
    PERFORM public._require_admin();

    SELECT * INTO _r FROM public.design_withdrawal_requests WHERE id = _req_id;
    IF _r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;

    UPDATE public.design_withdrawal_requests
        SET status = 'rejected',
            processed_at = NOW(),
            admin_note = _reason
        WHERE id = _req_id;

    -- Move the gross amount back from pending_withdrawal to wallet_balance
    UPDATE public.designer_profiles
        SET wallet_balance = COALESCE(wallet_balance, 0) + _r.gross_amount,
            wallet_pending_withdrawal = GREATEST(0, COALESCE(wallet_pending_withdrawal, 0) - _r.gross_amount)
        WHERE id = _r.designer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_design_withdrawal(uuid, text) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Mark a withdrawal as paid — clears pending_withdrawal.
-- Works from either 'pending' (direct paid) or 'approved'.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_mark_design_withdrawal_paid(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r record;
BEGIN
    PERFORM public._require_admin();

    SELECT * INTO _r FROM public.design_withdrawal_requests WHERE id = _req_id;
    IF _r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF _r.status NOT IN ('pending','approved') THEN
        RAISE EXCEPTION 'Only pending/approved requests can be marked as paid';
    END IF;

    UPDATE public.design_withdrawal_requests
        SET status = 'paid',
            processed_at = NOW()
        WHERE id = _req_id;

    -- Clear the pending_withdrawal balance (money actually went out)
    UPDATE public.designer_profiles
        SET wallet_pending_withdrawal = GREATEST(0, COALESCE(wallet_pending_withdrawal, 0) - _r.gross_amount)
        WHERE id = _r.designer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_design_withdrawal_paid(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Admin read policies (so the admin list page can see every row)
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dwr_select_admin" ON public.design_withdrawal_requests;
CREATE POLICY "dwr_select_admin" ON public.design_withdrawal_requests
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "dtp_select_admin" ON public.designer_tax_profiles;
CREATE POLICY "dtp_select_admin" ON public.designer_tax_profiles
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
