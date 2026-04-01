-- Allow bidders to delete their own pending bids
CREATE POLICY "Bidder can delete own pending bids" ON public.design_bids
    FOR DELETE TO authenticated
    USING (auth.uid() = designer_id AND status = 'pending');
