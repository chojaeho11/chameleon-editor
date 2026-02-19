-- ============================================================
-- Migration: RLS Policies + Performance Indexes
-- Date: 2026-02-20
-- Purpose: Fix 82 security issues (missing RLS) + 368 performance issues
-- ============================================================

-- ============================================================
-- PART 0: Helper function for admin checks
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'platinum', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PART 1: RLS POLICIES
-- ============================================================

-- ----------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------
-- 2. orders
-- ----------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_auth" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;

CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "orders_select_admin" ON public.orders
  FOR SELECT USING (public.is_admin());
CREATE POLICY "orders_insert_auth" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "orders_update_admin" ON public.orders
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "orders_delete_admin" ON public.orders
  FOR DELETE USING (public.is_admin());

-- ----------------------------------------------------------
-- 3. admin_products (public catalog - read only for everyone)
-- ----------------------------------------------------------
ALTER TABLE public.admin_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_products_select_public" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_insert_admin" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_update_admin" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_delete_admin" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_insert_partner" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_update_partner" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_delete_partner" ON public.admin_products;

CREATE POLICY "admin_products_select_public" ON public.admin_products
  FOR SELECT USING (true);
CREATE POLICY "admin_products_insert_admin" ON public.admin_products
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "admin_products_update_admin" ON public.admin_products
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "admin_products_delete_admin" ON public.admin_products
  FOR DELETE USING (public.is_admin());
-- Partners can manage their own products
CREATE POLICY "admin_products_insert_partner" ON public.admin_products
  FOR INSERT WITH CHECK (partner_id = auth.uid());
CREATE POLICY "admin_products_update_partner" ON public.admin_products
  FOR UPDATE USING (partner_id = auth.uid());
CREATE POLICY "admin_products_delete_partner" ON public.admin_products
  FOR DELETE USING (partner_id = auth.uid());

-- ----------------------------------------------------------
-- 4. admin_top_categories (public catalog)
-- ----------------------------------------------------------
ALTER TABLE public.admin_top_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_top_categories_select_public" ON public.admin_top_categories;
DROP POLICY IF EXISTS "admin_top_categories_all_admin" ON public.admin_top_categories;

CREATE POLICY "admin_top_categories_select_public" ON public.admin_top_categories
  FOR SELECT USING (true);
CREATE POLICY "admin_top_categories_all_admin" ON public.admin_top_categories
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 5. admin_categories (public catalog)
-- ----------------------------------------------------------
ALTER TABLE public.admin_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_categories_select_public" ON public.admin_categories;
DROP POLICY IF EXISTS "admin_categories_all_admin" ON public.admin_categories;

CREATE POLICY "admin_categories_select_public" ON public.admin_categories
  FOR SELECT USING (true);
CREATE POLICY "admin_categories_all_admin" ON public.admin_categories
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 6. admin_addons (public catalog)
-- ----------------------------------------------------------
ALTER TABLE public.admin_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_addons_select_public" ON public.admin_addons;
DROP POLICY IF EXISTS "admin_addons_all_admin" ON public.admin_addons;

CREATE POLICY "admin_addons_select_public" ON public.admin_addons
  FOR SELECT USING (true);
CREATE POLICY "admin_addons_all_admin" ON public.admin_addons
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 7. addon_categories (public catalog)
-- ----------------------------------------------------------
ALTER TABLE public.addon_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addon_categories_select_public" ON public.addon_categories;
DROP POLICY IF EXISTS "addon_categories_all_admin" ON public.addon_categories;

CREATE POLICY "addon_categories_select_public" ON public.addon_categories
  FOR SELECT USING (true);
CREATE POLICY "addon_categories_all_admin" ON public.addon_categories
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 8. library (public read for approved, user manages own)
-- ----------------------------------------------------------
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "library_select_approved" ON public.library;
DROP POLICY IF EXISTS "library_select_own" ON public.library;
DROP POLICY IF EXISTS "library_select_admin" ON public.library;
DROP POLICY IF EXISTS "library_insert_auth" ON public.library;
DROP POLICY IF EXISTS "library_delete_own" ON public.library;
DROP POLICY IF EXISTS "library_delete_admin" ON public.library;
DROP POLICY IF EXISTS "library_update_admin" ON public.library;

CREATE POLICY "library_select_approved" ON public.library
  FOR SELECT USING (status = 'approved');
CREATE POLICY "library_select_own" ON public.library
  FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "library_select_admin" ON public.library
  FOR SELECT USING (public.is_admin());
CREATE POLICY "library_insert_auth" ON public.library
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "library_delete_own" ON public.library
  FOR DELETE USING (user_id = auth.uid()::text);
CREATE POLICY "library_delete_admin" ON public.library
  FOR DELETE USING (public.is_admin());
CREATE POLICY "library_update_admin" ON public.library
  FOR UPDATE USING (public.is_admin());

-- ----------------------------------------------------------
-- 9. site_fonts (public read)
-- ----------------------------------------------------------
ALTER TABLE public.site_fonts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_fonts_select_public" ON public.site_fonts;
DROP POLICY IF EXISTS "site_fonts_all_admin" ON public.site_fonts;

CREATE POLICY "site_fonts_select_public" ON public.site_fonts
  FOR SELECT USING (true);
CREATE POLICY "site_fonts_all_admin" ON public.site_fonts
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 10. user_designs (user owns their designs)
-- ----------------------------------------------------------
ALTER TABLE public.user_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_designs_select_own" ON public.user_designs;
DROP POLICY IF EXISTS "user_designs_insert_own" ON public.user_designs;
DROP POLICY IF EXISTS "user_designs_delete_own" ON public.user_designs;
DROP POLICY IF EXISTS "user_designs_all_admin" ON public.user_designs;

CREATE POLICY "user_designs_select_own" ON public.user_designs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_designs_insert_own" ON public.user_designs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_designs_delete_own" ON public.user_designs
  FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "user_designs_all_admin" ON public.user_designs
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 11. subscriptions (user's own)
-- ----------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_all_admin" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "subscriptions_all_admin" ON public.subscriptions
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 12. vip_orders (admin only + insert from auth)
-- ----------------------------------------------------------
ALTER TABLE public.vip_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vip_orders_select_admin" ON public.vip_orders;
DROP POLICY IF EXISTS "vip_orders_insert_auth" ON public.vip_orders;
DROP POLICY IF EXISTS "vip_orders_update_admin" ON public.vip_orders;
DROP POLICY IF EXISTS "vip_orders_delete_admin" ON public.vip_orders;

CREATE POLICY "vip_orders_select_admin" ON public.vip_orders
  FOR SELECT USING (public.is_admin());
CREATE POLICY "vip_orders_insert_auth" ON public.vip_orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "vip_orders_update_admin" ON public.vip_orders
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "vip_orders_delete_admin" ON public.vip_orders
  FOR DELETE USING (public.is_admin());

-- ----------------------------------------------------------
-- 13. bids (related to user's orders)
-- ----------------------------------------------------------
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bids_select_public" ON public.bids;
DROP POLICY IF EXISTS "bids_insert_auth" ON public.bids;
DROP POLICY IF EXISTS "bids_update_auth" ON public.bids;
DROP POLICY IF EXISTS "bids_all_admin" ON public.bids;

-- Bids are visible when viewing order details
CREATE POLICY "bids_select_public" ON public.bids
  FOR SELECT USING (true);
CREATE POLICY "bids_insert_auth" ON public.bids
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bids_update_auth" ON public.bids
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "bids_all_admin" ON public.bids
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 14. partner_reviews (public read, auth insert)
-- ----------------------------------------------------------
ALTER TABLE public.partner_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_reviews_select_public" ON public.partner_reviews;
DROP POLICY IF EXISTS "partner_reviews_insert_auth" ON public.partner_reviews;

CREATE POLICY "partner_reviews_select_public" ON public.partner_reviews
  FOR SELECT USING (true);
CREATE POLICY "partner_reviews_insert_auth" ON public.partner_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- 15. partner_applications (user inserts own, admin manages)
-- ----------------------------------------------------------
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_applications_insert_auth" ON public.partner_applications;
DROP POLICY IF EXISTS "partner_applications_select_admin" ON public.partner_applications;
DROP POLICY IF EXISTS "partner_applications_update_admin" ON public.partner_applications;

CREATE POLICY "partner_applications_insert_auth" ON public.partner_applications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "partner_applications_select_admin" ON public.partner_applications
  FOR SELECT USING (public.is_admin());
CREATE POLICY "partner_applications_update_admin" ON public.partner_applications
  FOR UPDATE USING (public.is_admin());

-- ----------------------------------------------------------
-- 16. partner_settlements (partner sees own, admin all)
-- ----------------------------------------------------------
ALTER TABLE public.partner_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_settlements_select_own" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_insert_auth" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_update_own" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_all_admin" ON public.partner_settlements;

CREATE POLICY "partner_settlements_select_own" ON public.partner_settlements
  FOR SELECT USING (partner_id = auth.uid());
CREATE POLICY "partner_settlements_insert_auth" ON public.partner_settlements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "partner_settlements_update_own" ON public.partner_settlements
  FOR UPDATE USING (partner_id = auth.uid());
CREATE POLICY "partner_settlements_all_admin" ON public.partner_settlements
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 17. admin_staff (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_staff_select_staff" ON public.admin_staff;
DROP POLICY IF EXISTS "admin_staff_all_admin" ON public.admin_staff;

CREATE POLICY "admin_staff_select_staff" ON public.admin_staff
  FOR SELECT USING (public.is_staff());
CREATE POLICY "admin_staff_all_admin" ON public.admin_staff
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 18. bank_transactions (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_transactions_all_admin" ON public.bank_transactions;

CREATE POLICY "bank_transactions_all_admin" ON public.bank_transactions
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 19. secrets (NO access from client - use edge functions only)
-- ----------------------------------------------------------
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "secrets_select_admin" ON public.secrets;

-- Only admin can read secrets from client; ideally use service_role in edge functions
CREATE POLICY "secrets_select_admin" ON public.secrets
  FOR SELECT USING (public.is_admin());

-- ----------------------------------------------------------
-- 20. common_info (public read, admin write)
-- ----------------------------------------------------------
ALTER TABLE public.common_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "common_info_select_public" ON public.common_info;
DROP POLICY IF EXISTS "common_info_all_admin" ON public.common_info;

CREATE POLICY "common_info_select_public" ON public.common_info
  FOR SELECT USING (true);
CREATE POLICY "common_info_all_admin" ON public.common_info
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 21. product_reviews (public read, auth insert)
-- ----------------------------------------------------------
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_reviews_select_public" ON public.product_reviews;
DROP POLICY IF EXISTS "product_reviews_insert_auth" ON public.product_reviews;

CREATE POLICY "product_reviews_select_public" ON public.product_reviews
  FOR SELECT USING (true);
CREATE POLICY "product_reviews_insert_auth" ON public.product_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- 22. page_views (anon insert, admin read)
-- ----------------------------------------------------------
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_views_insert_anon" ON public.page_views;
DROP POLICY IF EXISTS "page_views_update_anon" ON public.page_views;
DROP POLICY IF EXISTS "page_views_select_admin" ON public.page_views;

CREATE POLICY "page_views_insert_anon" ON public.page_views
  FOR INSERT WITH CHECK (true);
CREATE POLICY "page_views_update_anon" ON public.page_views
  FOR UPDATE USING (true);
CREATE POLICY "page_views_select_admin" ON public.page_views
  FOR SELECT USING (public.is_admin());

-- ----------------------------------------------------------
-- 23. community_posts (public read, auth write)
-- ----------------------------------------------------------
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_posts_select_public" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert_auth" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update_auth" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete_admin" ON public.community_posts;

CREATE POLICY "community_posts_select_public" ON public.community_posts
  FOR SELECT USING (true);
CREATE POLICY "community_posts_insert_auth" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "community_posts_update_auth" ON public.community_posts
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "community_posts_delete_admin" ON public.community_posts
  FOR DELETE USING (public.is_admin());

-- ----------------------------------------------------------
-- 24. community_comments (public read, auth write)
-- ----------------------------------------------------------
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_comments_select_public" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_insert_auth" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_update_auth" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_delete_admin" ON public.community_comments;

CREATE POLICY "community_comments_select_public" ON public.community_comments
  FOR SELECT USING (true);
CREATE POLICY "community_comments_insert_auth" ON public.community_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "community_comments_update_auth" ON public.community_comments
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "community_comments_delete_admin" ON public.community_comments
  FOR DELETE USING (public.is_admin());

-- ----------------------------------------------------------
-- 25. delivery_knowhow (staff only)
-- ----------------------------------------------------------
ALTER TABLE public.delivery_knowhow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_knowhow_all_staff" ON public.delivery_knowhow;

CREATE POLICY "delivery_knowhow_all_staff" ON public.delivery_knowhow
  FOR ALL USING (public.is_staff());

-- ----------------------------------------------------------
-- 26. chatbot_knowledge (public read for active, admin manage)
-- ----------------------------------------------------------
ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_knowledge_select_active" ON public.chatbot_knowledge;
DROP POLICY IF EXISTS "chatbot_knowledge_all_admin" ON public.chatbot_knowledge;

CREATE POLICY "chatbot_knowledge_select_active" ON public.chatbot_knowledge
  FOR SELECT USING (is_active = true);
CREATE POLICY "chatbot_knowledge_all_admin" ON public.chatbot_knowledge
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 27. chatbot_logs (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_logs_insert_anon" ON public.chatbot_logs;
DROP POLICY IF EXISTS "chatbot_logs_select_admin" ON public.chatbot_logs;
DROP POLICY IF EXISTS "chatbot_logs_update_admin" ON public.chatbot_logs;

CREATE POLICY "chatbot_logs_insert_anon" ON public.chatbot_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "chatbot_logs_select_admin" ON public.chatbot_logs
  FOR SELECT USING (public.is_admin());
CREATE POLICY "chatbot_logs_update_admin" ON public.chatbot_logs
  FOR UPDATE USING (public.is_admin());

-- ----------------------------------------------------------
-- 28. chat_rooms (user sees own, admin all)
-- ----------------------------------------------------------
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_rooms_insert_anon" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_select_admin" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update_admin" ON public.chat_rooms;

CREATE POLICY "chat_rooms_insert_anon" ON public.chat_rooms
  FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_rooms_select_admin" ON public.chat_rooms
  FOR SELECT USING (public.is_admin());
CREATE POLICY "chat_rooms_update_admin" ON public.chat_rooms
  FOR UPDATE USING (public.is_admin());

-- ----------------------------------------------------------
-- 29. chat_messages (admin manage, anon insert for customer)
-- ----------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_messages_insert_anon" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_admin" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_admin" ON public.chat_messages;

CREATE POLICY "chat_messages_insert_anon" ON public.chat_messages
  FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_messages_select_admin" ON public.chat_messages
  FOR SELECT USING (public.is_admin());
CREATE POLICY "chat_messages_update_admin" ON public.chat_messages
  FOR UPDATE USING (public.is_admin());

-- ----------------------------------------------------------
-- 30. marketing_content (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_content_all_admin" ON public.marketing_content;

CREATE POLICY "marketing_content_all_admin" ON public.marketing_content
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 31. marketing_topics (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.marketing_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_topics_all_admin" ON public.marketing_topics;

CREATE POLICY "marketing_topics_all_admin" ON public.marketing_topics
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 32. marketing_youtube_config (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.marketing_youtube_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_youtube_config_all_admin" ON public.marketing_youtube_config;

CREATE POLICY "marketing_youtube_config_all_admin" ON public.marketing_youtube_config
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------
-- 33. marketing_comment_replies (admin only)
-- ----------------------------------------------------------
ALTER TABLE public.marketing_comment_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_comment_replies_all_admin" ON public.marketing_comment_replies;

CREATE POLICY "marketing_comment_replies_all_admin" ON public.marketing_comment_replies
  FOR ALL USING (public.is_admin());

-- wallet_logs and withdrawal_requests already have RLS from previous migration


-- ============================================================
-- PART 2: PERFORMANCE INDEXES
-- ============================================================

-- ----------------------------------------------------------
-- orders (most queried table, currently slowest)
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_target_date ON public.orders (delivery_target_date);
CREATE INDEX IF NOT EXISTS idx_orders_site_code ON public.orders (site_code);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
-- Composite for admin order list (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_site_status_created ON public.orders (site_code, status, created_at DESC);

-- ----------------------------------------------------------
-- admin_products (2-4s avg query time → target <100ms)
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_products_code ON public.admin_products (code);
CREATE INDEX IF NOT EXISTS idx_admin_products_category ON public.admin_products (category);
CREATE INDEX IF NOT EXISTS idx_admin_products_sort_order ON public.admin_products (sort_order);
CREATE INDEX IF NOT EXISTS idx_admin_products_partner_id ON public.admin_products (partner_id);
CREATE INDEX IF NOT EXISTS idx_admin_products_partner_status ON public.admin_products (partner_status);
CREATE INDEX IF NOT EXISTS idx_admin_products_is_hot_deal ON public.admin_products (is_hot_deal) WHERE is_hot_deal = true;
CREATE INDEX IF NOT EXISTS idx_admin_products_is_biz_deal ON public.admin_products (is_biz_deal) WHERE is_biz_deal = true;
-- Composite for catalog queries (category + visibility + sort)
CREATE INDEX IF NOT EXISTS idx_admin_products_cat_sort ON public.admin_products (category, sort_order);

-- ----------------------------------------------------------
-- library (heavy ilike + pagination queries)
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_library_category ON public.library (category);
CREATE INDEX IF NOT EXISTS idx_library_status ON public.library (status);
CREATE INDEX IF NOT EXISTS idx_library_user_id ON public.library (user_id);
CREATE INDEX IF NOT EXISTS idx_library_product_key ON public.library (product_key);
CREATE INDEX IF NOT EXISTS idx_library_created_at ON public.library (created_at DESC);
-- Composite for template browser (most common pattern)
CREATE INDEX IF NOT EXISTS idx_library_status_category ON public.library (status, category);
-- pg_trgm extension for ILIKE search on tags (if not exists)
-- NOTE: Run this manually if pg_trgm is not enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_library_tags_trgm ON public.library USING gin (tags gin_trgm_ops);

-- ----------------------------------------------------------
-- profiles
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- ----------------------------------------------------------
-- bids
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bids_order_id ON public.bids (order_id);
CREATE INDEX IF NOT EXISTS idx_bids_partner_id ON public.bids (partner_id);

-- ----------------------------------------------------------
-- wallet_logs
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wallet_logs_user_id ON public.wallet_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_type ON public.wallet_logs (type);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_created_at ON public.wallet_logs (created_at DESC);

-- ----------------------------------------------------------
-- product_reviews (composite for review loading)
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_reviews_code_lang ON public.product_reviews (product_code, lang);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON public.product_reviews (created_at DESC);

-- ----------------------------------------------------------
-- page_views
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views (created_at);

-- ----------------------------------------------------------
-- user_designs
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_designs_user_id ON public.user_designs (user_id);
CREATE INDEX IF NOT EXISTS idx_user_designs_created_at ON public.user_designs (created_at DESC);

-- ----------------------------------------------------------
-- partner_settlements
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_partner_settlements_partner_id ON public.partner_settlements (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_settlements_status ON public.partner_settlements (settlement_status);

-- ----------------------------------------------------------
-- chatbot_logs
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_created_at ON public.chatbot_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_resolved ON public.chatbot_logs (is_resolved);

-- ----------------------------------------------------------
-- chat_messages
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at);

-- ----------------------------------------------------------
-- community_posts
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts (category);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts (created_at DESC);

-- ----------------------------------------------------------
-- community_comments
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON public.community_comments (post_id);

-- ----------------------------------------------------------
-- bank_transactions
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON public.bank_transactions (transaction_date DESC);

-- ----------------------------------------------------------
-- admin_categories
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_categories_top_code ON public.admin_categories (top_category_code);
CREATE INDEX IF NOT EXISTS idx_admin_categories_sort ON public.admin_categories (sort_order);

-- ----------------------------------------------------------
-- subscriptions
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);

-- ----------------------------------------------------------
-- vip_orders
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vip_orders_created_at ON public.vip_orders (created_at DESC);

-- ----------------------------------------------------------
-- partner_applications
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON public.partner_applications (created_at DESC);

-- ----------------------------------------------------------
-- withdrawal_requests
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests (user_id);


-- ============================================================
-- DONE
-- ============================================================
-- Expected results:
-- - All 35 tables now have RLS enabled
-- - 50+ indexes created for common query patterns
-- - admin_products queries: 2-4s → <100ms
-- - orders list with pagination: should see 5-10x improvement
-- - library search: category/status filters now indexed
