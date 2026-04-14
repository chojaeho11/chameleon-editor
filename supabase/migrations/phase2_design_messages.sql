-- Phase 2: design-market messaging system
-- Run this in Supabase SQL Editor after Phase 1.
-- Creates a chat table where the request owner and each bidder can exchange
-- asynchronous messages (one channel per bid). Attachments are stored as an
-- array of storage URLs.

-- ──────────────────────────────────────────────────────────
-- 1) Table
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS design_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES design_requests(id) ON DELETE CASCADE,
    bid_id uuid NOT NULL REFERENCES design_bids(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message text,
    attachments jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_messages_bid
    ON design_messages(bid_id, created_at);
CREATE INDEX IF NOT EXISTS idx_design_messages_request
    ON design_messages(request_id);

-- ──────────────────────────────────────────────────────────
-- 2) Row-Level Security
-- ──────────────────────────────────────────────────────────
ALTER TABLE design_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: request owner OR the designer who placed this specific bid
DROP POLICY IF EXISTS "dm_select_participants" ON design_messages;
CREATE POLICY "dm_select_participants" ON design_messages
FOR SELECT USING (
    auth.uid() = sender_id
    OR auth.uid() IN (
        SELECT customer_id FROM design_requests WHERE id = design_messages.request_id
    )
    OR auth.uid() IN (
        SELECT designer_id FROM design_bids WHERE id = design_messages.bid_id
    )
);

-- INSERT: only participants can send, and sender_id must be self
DROP POLICY IF EXISTS "dm_insert_participants" ON design_messages;
CREATE POLICY "dm_insert_participants" ON design_messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
        auth.uid() IN (
            SELECT customer_id FROM design_requests WHERE id = design_messages.request_id
        )
        OR auth.uid() IN (
            SELECT designer_id FROM design_bids WHERE id = design_messages.bid_id
        )
    )
);

-- UPDATE: sender can soft-delete own message within 5 minutes
DROP POLICY IF EXISTS "dm_update_own_within_5min" ON design_messages;
CREATE POLICY "dm_update_own_within_5min" ON design_messages
FOR UPDATE USING (
    sender_id = auth.uid()
    AND created_at > (NOW() - INTERVAL '5 minutes')
) WITH CHECK (
    sender_id = auth.uid()
);

-- No DELETE policy on purpose — we keep rows as soft-delete audit trail.

-- ──────────────────────────────────────────────────────────
-- 3) Storage bucket reuse
-- ──────────────────────────────────────────────────────────
-- Message attachments go under: design-market/messages/{request_id}/{bid_id}/{filename}
-- The existing "design-market" bucket is assumed public-readable by authenticated users.
-- If your bucket policy is stricter, add a policy that allows the participants
-- of a bid to read paths starting with messages/{request_id}/{bid_id}/.
