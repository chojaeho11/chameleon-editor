-- Add final_design_urls column to design_bids for designers to upload completed work
ALTER TABLE design_bids ADD COLUMN IF NOT EXISTS final_design_urls JSONB DEFAULT '[]'::jsonb;

-- Allow designers to update their own bids (for uploading final designs)
CREATE POLICY IF NOT EXISTS "designer_update_own_bid"
ON design_bids FOR UPDATE
USING (designer_id = auth.uid())
WITH CHECK (designer_id = auth.uid());
