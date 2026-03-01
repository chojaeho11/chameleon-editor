-- Add featured/pinned columns to library table for priority display on start page
ALTER TABLE library ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE library ADD COLUMN IF NOT EXISTS featured_at timestamptz;

-- Index for fast sorting (featured first, then by featured_at desc)
CREATE INDEX IF NOT EXISTS idx_library_featured ON library (is_featured DESC, featured_at DESC NULLS LAST);
