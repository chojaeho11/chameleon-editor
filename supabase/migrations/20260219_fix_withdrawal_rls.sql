-- Fix RLS policies for withdrawal_requests table
-- Allow authenticated users to INSERT their own withdrawal requests
-- Allow authenticated users to SELECT their own withdrawal requests

-- Enable RLS if not already enabled
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admin full access withdrawal_requests" ON public.withdrawal_requests;

-- INSERT: authenticated users can create their own withdrawal requests
CREATE POLICY "Users can insert own withdrawal requests"
ON public.withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- SELECT: authenticated users can read their own withdrawal requests
CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Also fix wallet_logs if it has similar issues
ALTER TABLE public.wallet_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own wallet logs" ON public.wallet_logs;
DROP POLICY IF EXISTS "Users can view own wallet logs" ON public.wallet_logs;

CREATE POLICY "Users can insert own wallet logs"
ON public.wallet_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own wallet logs"
ON public.wallet_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
