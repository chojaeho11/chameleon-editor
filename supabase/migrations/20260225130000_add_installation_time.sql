-- Add installation_time column for honeycomb installation reservations
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS installation_time text;

-- Index for querying slot availability by date
CREATE INDEX IF NOT EXISTS idx_orders_installation
  ON public.orders(delivery_target_date, installation_time)
  WHERE installation_time IS NOT NULL;
