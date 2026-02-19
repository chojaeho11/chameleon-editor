-- Performance: Add indexes for admin member management sorting
CREATE INDEX IF NOT EXISTS idx_profiles_deposit ON public.profiles (deposit);
CREATE INDEX IF NOT EXISTS idx_profiles_mileage ON public.profiles (mileage);
CREATE INDEX IF NOT EXISTS idx_profiles_total_spend ON public.profiles (total_spend);
