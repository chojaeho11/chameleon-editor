-- ============================================================
-- Phase 8: Community Services Tables
-- 6 services: Jobs, Realty, Experts, Dating, Community, Secondhand
-- ============================================================

-- ────────────────────────────────────────────
-- 1) Part-time Jobs (타임알바)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_id uuid REFERENCES auth.users(id),
    title text NOT NULL,
    description text,
    job_type text DEFAULT 'part-time',
    hourly_rate integer DEFAULT 0,
    location_city text,
    location_detail text,
    country text DEFAULT 'KR',
    work_days text,
    work_hours text,
    contact_phone text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_job_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES community_jobs(id) ON DELETE CASCADE,
    applicant_id uuid REFERENCES auth.users(id),
    message text,
    phone text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- 2) Real Estate (부동산)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_realty (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_id uuid REFERENCES auth.users(id),
    listing_type text DEFAULT 'rent',
    title text NOT NULL,
    description text,
    price integer DEFAULT 0,
    deposit integer DEFAULT 0,
    monthly_rent integer DEFAULT 0,
    area_sqm numeric,
    rooms integer,
    floor_info text,
    address text,
    city text,
    country text DEFAULT 'KR',
    images jsonb DEFAULT '[]',
    contact_phone text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- 3) Expert Matching (숨고/전문가)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_experts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    display_name text NOT NULL,
    category text,
    description text,
    hourly_rate integer DEFAULT 0,
    city text,
    country text DEFAULT 'KR',
    photo_url text,
    rating numeric DEFAULT 0,
    review_count integer DEFAULT 0,
    verified boolean DEFAULT false,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_expert_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid REFERENCES auth.users(id),
    category text,
    title text NOT NULL,
    description text,
    budget_min integer,
    budget_max integer,
    city text,
    country text DEFAULT 'KR',
    status text DEFAULT 'open',
    created_at timestamptz DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- 4) Dating/Social (만남)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_dating_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES auth.users(id),
    display_name text NOT NULL,
    age integer,
    gender text,
    bio text,
    interests jsonb DEFAULT '[]',
    photos jsonb DEFAULT '[]',
    city text,
    country text DEFAULT 'KR',
    looking_for text,
    age_min integer DEFAULT 18,
    age_max integer DEFAULT 99,
    is_active boolean DEFAULT true,
    last_active timestamptz DEFAULT NOW(),
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_dating_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user uuid REFERENCES auth.users(id),
    to_user uuid REFERENCES auth.users(id),
    is_like boolean DEFAULT true,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(from_user, to_user)
);

-- ────────────────────────────────────────────
-- 5) Local Community (지역커뮤니티)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id uuid REFERENCES auth.users(id),
    name text NOT NULL,
    description text,
    category text,
    city text,
    country text DEFAULT 'KR',
    member_count integer DEFAULT 1,
    image_url text,
    is_public boolean DEFAULT true,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid REFERENCES auth.users(id),
    group_id uuid REFERENCES community_groups(id) ON DELETE CASCADE,
    title text,
    content text NOT NULL,
    images jsonb DEFAULT '[]',
    likes integer DEFAULT 0,
    comments integer DEFAULT 0,
    city text,
    country text DEFAULT 'KR',
    created_at timestamptz DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- 6) Secondhand Market (중고거래)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_secondhand (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid REFERENCES auth.users(id),
    title text NOT NULL,
    description text,
    price integer DEFAULT 0,
    category text,
    condition text DEFAULT 'good',
    images jsonb DEFAULT '[]',
    city text,
    country text DEFAULT 'KR',
    is_negotiable boolean DEFAULT true,
    status text DEFAULT 'active',
    view_count integer DEFAULT 0,
    chat_count integer DEFAULT 0,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_user_temperature (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id),
    temperature numeric DEFAULT 36.5,
    total_transactions integer DEFAULT 0,
    positive_reviews integer DEFAULT 0,
    negative_reviews integer DEFAULT 0,
    last_updated timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_safe_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid REFERENCES community_secondhand(id),
    buyer_id uuid REFERENCES auth.users(id),
    seller_id uuid REFERENCES auth.users(id),
    amount integer NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT NOW()
);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Helper: enable RLS on all tables
ALTER TABLE community_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_realty ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_expert_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_dating_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_dating_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_secondhand ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_user_temperature ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_safe_transactions ENABLE ROW LEVEL SECURITY;

-- ── community_jobs ──
CREATE POLICY "community_jobs_select" ON community_jobs FOR SELECT USING (true);
CREATE POLICY "community_jobs_insert" ON community_jobs FOR INSERT WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "community_jobs_update" ON community_jobs FOR UPDATE USING (auth.uid() = poster_id);

-- ── community_job_applications ──
CREATE POLICY "community_job_applications_select" ON community_job_applications FOR SELECT USING (true);
CREATE POLICY "community_job_applications_insert" ON community_job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "community_job_applications_update" ON community_job_applications FOR UPDATE USING (auth.uid() = applicant_id);

-- ── community_realty ──
CREATE POLICY "community_realty_select" ON community_realty FOR SELECT USING (true);
CREATE POLICY "community_realty_insert" ON community_realty FOR INSERT WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "community_realty_update" ON community_realty FOR UPDATE USING (auth.uid() = poster_id);

-- ── community_experts ──
CREATE POLICY "community_experts_select" ON community_experts FOR SELECT USING (true);
CREATE POLICY "community_experts_insert" ON community_experts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_experts_update" ON community_experts FOR UPDATE USING (auth.uid() = user_id);

-- ── community_expert_requests ──
CREATE POLICY "community_expert_requests_select" ON community_expert_requests FOR SELECT USING (true);
CREATE POLICY "community_expert_requests_insert" ON community_expert_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "community_expert_requests_update" ON community_expert_requests FOR UPDATE USING (auth.uid() = requester_id);

-- ── community_dating_profiles ──
CREATE POLICY "community_dating_profiles_select" ON community_dating_profiles FOR SELECT USING (true);
CREATE POLICY "community_dating_profiles_insert" ON community_dating_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_dating_profiles_update" ON community_dating_profiles FOR UPDATE USING (auth.uid() = user_id);

-- ── community_dating_likes ──
CREATE POLICY "community_dating_likes_select" ON community_dating_likes FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "community_dating_likes_insert" ON community_dating_likes FOR INSERT WITH CHECK (auth.uid() = from_user);

-- ── community_groups ──
CREATE POLICY "community_groups_select" ON community_groups FOR SELECT USING (true);
CREATE POLICY "community_groups_insert" ON community_groups FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "community_groups_update" ON community_groups FOR UPDATE USING (auth.uid() = creator_id);

-- ── community_posts ──
CREATE POLICY "community_posts_select" ON community_posts FOR SELECT USING (true);
CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "community_posts_update" ON community_posts FOR UPDATE USING (auth.uid() = author_id);

-- ── community_secondhand ──
CREATE POLICY "community_secondhand_select" ON community_secondhand FOR SELECT USING (true);
CREATE POLICY "community_secondhand_insert" ON community_secondhand FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "community_secondhand_update" ON community_secondhand FOR UPDATE USING (auth.uid() = seller_id);

-- ── community_user_temperature ──
CREATE POLICY "community_user_temperature_select" ON community_user_temperature FOR SELECT USING (true);
CREATE POLICY "community_user_temperature_insert" ON community_user_temperature FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_user_temperature_update" ON community_user_temperature FOR UPDATE USING (auth.uid() = user_id);

-- ── community_safe_transactions ──
CREATE POLICY "community_safe_transactions_select" ON community_safe_transactions FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "community_safe_transactions_insert" ON community_safe_transactions FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "community_safe_transactions_update" ON community_safe_transactions FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ============================================================
-- Indexes
-- ============================================================

-- community_jobs
CREATE INDEX IF NOT EXISTS idx_community_jobs_country ON community_jobs(country);
CREATE INDEX IF NOT EXISTS idx_community_jobs_city ON community_jobs(location_city);
CREATE INDEX IF NOT EXISTS idx_community_jobs_status ON community_jobs(status);
CREATE INDEX IF NOT EXISTS idx_community_jobs_created ON community_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_jobs_type ON community_jobs(job_type);

-- community_job_applications
CREATE INDEX IF NOT EXISTS idx_community_job_apps_job ON community_job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_community_job_apps_applicant ON community_job_applications(applicant_id);

-- community_realty
CREATE INDEX IF NOT EXISTS idx_community_realty_country ON community_realty(country);
CREATE INDEX IF NOT EXISTS idx_community_realty_city ON community_realty(city);
CREATE INDEX IF NOT EXISTS idx_community_realty_status ON community_realty(status);
CREATE INDEX IF NOT EXISTS idx_community_realty_type ON community_realty(listing_type);
CREATE INDEX IF NOT EXISTS idx_community_realty_created ON community_realty(created_at DESC);

-- community_experts
CREATE INDEX IF NOT EXISTS idx_community_experts_country ON community_experts(country);
CREATE INDEX IF NOT EXISTS idx_community_experts_city ON community_experts(city);
CREATE INDEX IF NOT EXISTS idx_community_experts_category ON community_experts(category);
CREATE INDEX IF NOT EXISTS idx_community_experts_status ON community_experts(status);
CREATE INDEX IF NOT EXISTS idx_community_experts_created ON community_experts(created_at DESC);

-- community_expert_requests
CREATE INDEX IF NOT EXISTS idx_community_expert_req_country ON community_expert_requests(country);
CREATE INDEX IF NOT EXISTS idx_community_expert_req_category ON community_expert_requests(category);
CREATE INDEX IF NOT EXISTS idx_community_expert_req_status ON community_expert_requests(status);
CREATE INDEX IF NOT EXISTS idx_community_expert_req_created ON community_expert_requests(created_at DESC);

-- community_dating_profiles
CREATE INDEX IF NOT EXISTS idx_community_dating_country ON community_dating_profiles(country);
CREATE INDEX IF NOT EXISTS idx_community_dating_city ON community_dating_profiles(city);
CREATE INDEX IF NOT EXISTS idx_community_dating_gender ON community_dating_profiles(gender);
CREATE INDEX IF NOT EXISTS idx_community_dating_active ON community_dating_profiles(is_active);

-- community_dating_likes
CREATE INDEX IF NOT EXISTS idx_community_dating_likes_from ON community_dating_likes(from_user);
CREATE INDEX IF NOT EXISTS idx_community_dating_likes_to ON community_dating_likes(to_user);

-- community_groups
CREATE INDEX IF NOT EXISTS idx_community_groups_country ON community_groups(country);
CREATE INDEX IF NOT EXISTS idx_community_groups_city ON community_groups(city);
CREATE INDEX IF NOT EXISTS idx_community_groups_category ON community_groups(category);
CREATE INDEX IF NOT EXISTS idx_community_groups_created ON community_groups(created_at DESC);

-- community_posts
CREATE INDEX IF NOT EXISTS idx_community_posts_group ON community_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_country ON community_posts(country);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);

-- community_secondhand
CREATE INDEX IF NOT EXISTS idx_community_secondhand_country ON community_secondhand(country);
CREATE INDEX IF NOT EXISTS idx_community_secondhand_city ON community_secondhand(city);
CREATE INDEX IF NOT EXISTS idx_community_secondhand_status ON community_secondhand(status);
CREATE INDEX IF NOT EXISTS idx_community_secondhand_category ON community_secondhand(category);
CREATE INDEX IF NOT EXISTS idx_community_secondhand_created ON community_secondhand(created_at DESC);

-- community_safe_transactions
CREATE INDEX IF NOT EXISTS idx_community_safe_tx_item ON community_safe_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_community_safe_tx_buyer ON community_safe_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_community_safe_tx_seller ON community_safe_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_community_safe_tx_status ON community_safe_transactions(status);
