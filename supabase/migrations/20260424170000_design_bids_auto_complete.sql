-- Track auto-completion of design bids (after 15-day grace period)
ALTER TABLE public.design_bids
    ADD COLUMN IF NOT EXISTS auto_completed       boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_completed_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_design_bids_auto_pending
    ON public.design_bids (payment_status, client_completed_at)
    WHERE payment_status = 'paid' AND client_completed_at IS NULL;
