-- Add is_paper_display flag to admin_products for paper display collection
ALTER TABLE admin_products ADD COLUMN IF NOT EXISTS is_paper_display boolean DEFAULT false;
