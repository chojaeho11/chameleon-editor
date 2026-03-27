-- Allow customers to delete their own design requests
CREATE POLICY "Customer can delete own requests" ON public.design_requests
    FOR DELETE TO authenticated
    USING (auth.uid() = customer_id);

-- Allow request owner to delete related bids (via cascade, but explicit policy needed)
CREATE POLICY "Request owner can delete bids" ON public.design_bids
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.design_requests
            WHERE id = design_bids.request_id AND customer_id = auth.uid()
        )
    );
