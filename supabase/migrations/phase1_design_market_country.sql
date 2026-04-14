-- Phase 1: design-market country column
-- Run this in Supabase SQL Editor.
-- Adds ISO-2 country code to designer_profiles and design_requests
-- so the marketplace can be filtered by country flag.

-- 1) designer_profiles
ALTER TABLE designer_profiles
    ADD COLUMN IF NOT EXISTS country text;

-- 기존 레코드 기본값: 한국 (KR)
UPDATE designer_profiles SET country = 'KR' WHERE country IS NULL;

CREATE INDEX IF NOT EXISTS idx_designer_profiles_country
    ON designer_profiles(country);

-- 2) design_requests
ALTER TABLE design_requests
    ADD COLUMN IF NOT EXISTS country text;

-- 기존 레코드 기본값: 한국 (KR)
UPDATE design_requests SET country = 'KR' WHERE country IS NULL;

CREATE INDEX IF NOT EXISTS idx_design_requests_country
    ON design_requests(country);

-- 참고: ISO 3166-1 alpha-2 코드 사용
--   KR 한국 / JP 일본 / US 미국 / CN 중국
--   SA 사우디 / ES 스페인 / DE 독일 / FR 프랑스
