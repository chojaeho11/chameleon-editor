-- ============================================================
-- EMERGENCY: Disable ALL RLS to restore site functionality
-- Data is NOT deleted — RLS policies are blocking queries
-- ============================================================

-- Drop ALL custom policies first, then disable RLS on every table

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_deposit_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Public Access" ON public.profiles;
DROP POLICY IF EXISTS "Admin All" ON public.profiles;
DROP POLICY IF EXISTS "Allow all" ON public.profiles;
DROP POLICY IF EXISTS "Allow read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow update own" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert" ON public.profiles;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- orders
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_select_staff" ON public.orders;
DROP POLICY IF EXISTS "orders_select_partner" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_auth" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;
DROP POLICY IF EXISTS "orders_update_partner" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;
DROP POLICY IF EXISTS "Public Access" ON public.orders;
DROP POLICY IF EXISTS "Admin All" ON public.orders;
DROP POLICY IF EXISTS "Allow all" ON public.orders;
DROP POLICY IF EXISTS "Allow read access" ON public.orders;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- admin_products
DROP POLICY IF EXISTS "admin_products_select_public" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_insert_admin" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_update_admin" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_delete_admin" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_insert_partner" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_update_partner" ON public.admin_products;
DROP POLICY IF EXISTS "admin_products_delete_partner" ON public.admin_products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_products;
DROP POLICY IF EXISTS "Public Access" ON public.admin_products;
DROP POLICY IF EXISTS "Admin All" ON public.admin_products;
DROP POLICY IF EXISTS "Allow all" ON public.admin_products;
ALTER TABLE public.admin_products DISABLE ROW LEVEL SECURITY;

-- admin_top_categories
DROP POLICY IF EXISTS "admin_top_categories_select_public" ON public.admin_top_categories;
DROP POLICY IF EXISTS "admin_top_categories_all_admin" ON public.admin_top_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_top_categories;
DROP POLICY IF EXISTS "Public Access" ON public.admin_top_categories;
DROP POLICY IF EXISTS "Admin All" ON public.admin_top_categories;
DROP POLICY IF EXISTS "Allow all" ON public.admin_top_categories;
ALTER TABLE public.admin_top_categories DISABLE ROW LEVEL SECURITY;

-- admin_categories
DROP POLICY IF EXISTS "admin_categories_select_public" ON public.admin_categories;
DROP POLICY IF EXISTS "admin_categories_all_admin" ON public.admin_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_categories;
DROP POLICY IF EXISTS "Public Access" ON public.admin_categories;
DROP POLICY IF EXISTS "Admin All" ON public.admin_categories;
DROP POLICY IF EXISTS "Allow all" ON public.admin_categories;
ALTER TABLE public.admin_categories DISABLE ROW LEVEL SECURITY;

-- admin_addons
DROP POLICY IF EXISTS "admin_addons_select_public" ON public.admin_addons;
DROP POLICY IF EXISTS "admin_addons_all_admin" ON public.admin_addons;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_addons;
DROP POLICY IF EXISTS "Public Access" ON public.admin_addons;
DROP POLICY IF EXISTS "Admin All" ON public.admin_addons;
DROP POLICY IF EXISTS "Allow all" ON public.admin_addons;
ALTER TABLE public.admin_addons DISABLE ROW LEVEL SECURITY;

-- addon_categories
DROP POLICY IF EXISTS "addon_categories_select_public" ON public.addon_categories;
DROP POLICY IF EXISTS "addon_categories_all_admin" ON public.addon_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.addon_categories;
DROP POLICY IF EXISTS "Public Access" ON public.addon_categories;
DROP POLICY IF EXISTS "Admin All" ON public.addon_categories;
DROP POLICY IF EXISTS "Allow all" ON public.addon_categories;
ALTER TABLE public.addon_categories DISABLE ROW LEVEL SECURITY;

-- library
DROP POLICY IF EXISTS "library_select_approved" ON public.library;
DROP POLICY IF EXISTS "library_select_own" ON public.library;
DROP POLICY IF EXISTS "library_select_admin" ON public.library;
DROP POLICY IF EXISTS "library_insert_auth" ON public.library;
DROP POLICY IF EXISTS "library_delete_own" ON public.library;
DROP POLICY IF EXISTS "library_delete_admin" ON public.library;
DROP POLICY IF EXISTS "library_update_admin" ON public.library;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.library;
DROP POLICY IF EXISTS "Public Access" ON public.library;
DROP POLICY IF EXISTS "Admin All" ON public.library;
DROP POLICY IF EXISTS "Allow all" ON public.library;
ALTER TABLE public.library DISABLE ROW LEVEL SECURITY;

-- site_fonts
DROP POLICY IF EXISTS "site_fonts_select_public" ON public.site_fonts;
DROP POLICY IF EXISTS "site_fonts_all_admin" ON public.site_fonts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.site_fonts;
DROP POLICY IF EXISTS "Public Access" ON public.site_fonts;
DROP POLICY IF EXISTS "Admin All" ON public.site_fonts;
ALTER TABLE public.site_fonts DISABLE ROW LEVEL SECURITY;

-- user_designs
DROP POLICY IF EXISTS "user_designs_select_own" ON public.user_designs;
DROP POLICY IF EXISTS "user_designs_insert_own" ON public.user_designs;
DROP POLICY IF EXISTS "user_designs_delete_own" ON public.user_designs;
DROP POLICY IF EXISTS "user_designs_all_admin" ON public.user_designs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_designs;
DROP POLICY IF EXISTS "Public Access" ON public.user_designs;
DROP POLICY IF EXISTS "Admin All" ON public.user_designs;
ALTER TABLE public.user_designs DISABLE ROW LEVEL SECURITY;

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_all_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.subscriptions;
DROP POLICY IF EXISTS "Public Access" ON public.subscriptions;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;

-- vip_orders
DROP POLICY IF EXISTS "vip_orders_select_admin" ON public.vip_orders;
DROP POLICY IF EXISTS "vip_orders_insert_auth" ON public.vip_orders;
DROP POLICY IF EXISTS "vip_orders_update_admin" ON public.vip_orders;
DROP POLICY IF EXISTS "vip_orders_delete_admin" ON public.vip_orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vip_orders;
DROP POLICY IF EXISTS "Public Access" ON public.vip_orders;
DROP POLICY IF EXISTS "Admin All" ON public.vip_orders;
ALTER TABLE public.vip_orders DISABLE ROW LEVEL SECURITY;

-- bids
DROP POLICY IF EXISTS "bids_select_public" ON public.bids;
DROP POLICY IF EXISTS "bids_insert_auth" ON public.bids;
DROP POLICY IF EXISTS "bids_update_auth" ON public.bids;
DROP POLICY IF EXISTS "bids_all_admin" ON public.bids;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bids;
DROP POLICY IF EXISTS "Public Access" ON public.bids;
DROP POLICY IF EXISTS "Admin All" ON public.bids;
ALTER TABLE public.bids DISABLE ROW LEVEL SECURITY;

-- partner_reviews
DROP POLICY IF EXISTS "partner_reviews_select_public" ON public.partner_reviews;
DROP POLICY IF EXISTS "partner_reviews_insert_auth" ON public.partner_reviews;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.partner_reviews;
DROP POLICY IF EXISTS "Public Access" ON public.partner_reviews;
ALTER TABLE public.partner_reviews DISABLE ROW LEVEL SECURITY;

-- partner_applications
DROP POLICY IF EXISTS "partner_applications_insert_auth" ON public.partner_applications;
DROP POLICY IF EXISTS "partner_applications_select_admin" ON public.partner_applications;
DROP POLICY IF EXISTS "partner_applications_update_admin" ON public.partner_applications;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.partner_applications;
DROP POLICY IF EXISTS "Public Access" ON public.partner_applications;
ALTER TABLE public.partner_applications DISABLE ROW LEVEL SECURITY;

-- partner_settlements
DROP POLICY IF EXISTS "partner_settlements_select_own" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_insert_auth" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_update_own" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_update_auth" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_all_admin" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_select_admin" ON public.partner_settlements;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.partner_settlements;
DROP POLICY IF EXISTS "Public Access" ON public.partner_settlements;
ALTER TABLE public.partner_settlements DISABLE ROW LEVEL SECURITY;

-- admin_staff
DROP POLICY IF EXISTS "admin_staff_select_staff" ON public.admin_staff;
DROP POLICY IF EXISTS "admin_staff_all_admin" ON public.admin_staff;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_staff;
DROP POLICY IF EXISTS "Public Access" ON public.admin_staff;
ALTER TABLE public.admin_staff DISABLE ROW LEVEL SECURITY;

-- bank_transactions
DROP POLICY IF EXISTS "bank_transactions_all_admin" ON public.bank_transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bank_transactions;
DROP POLICY IF EXISTS "Public Access" ON public.bank_transactions;
DROP POLICY IF EXISTS "Admin All" ON public.bank_transactions;
ALTER TABLE public.bank_transactions DISABLE ROW LEVEL SECURITY;

-- secrets
DROP POLICY IF EXISTS "secrets_select_admin" ON public.secrets;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.secrets;
DROP POLICY IF EXISTS "Public Access" ON public.secrets;
DROP POLICY IF EXISTS "Admin All" ON public.secrets;
ALTER TABLE public.secrets DISABLE ROW LEVEL SECURITY;

-- common_info
DROP POLICY IF EXISTS "common_info_select_public" ON public.common_info;
DROP POLICY IF EXISTS "common_info_all_admin" ON public.common_info;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.common_info;
DROP POLICY IF EXISTS "Public Access" ON public.common_info;
ALTER TABLE public.common_info DISABLE ROW LEVEL SECURITY;

-- product_reviews
DROP POLICY IF EXISTS "product_reviews_select_public" ON public.product_reviews;
DROP POLICY IF EXISTS "product_reviews_insert_auth" ON public.product_reviews;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.product_reviews;
DROP POLICY IF EXISTS "Public Access" ON public.product_reviews;
ALTER TABLE public.product_reviews DISABLE ROW LEVEL SECURITY;

-- page_views
DROP POLICY IF EXISTS "page_views_insert_anon" ON public.page_views;
DROP POLICY IF EXISTS "page_views_update_anon" ON public.page_views;
DROP POLICY IF EXISTS "page_views_select_admin" ON public.page_views;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.page_views;
DROP POLICY IF EXISTS "Public Access" ON public.page_views;
ALTER TABLE public.page_views DISABLE ROW LEVEL SECURITY;

-- community_posts
DROP POLICY IF EXISTS "community_posts_select_public" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert_auth" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update_auth" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete_admin" ON public.community_posts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.community_posts;
DROP POLICY IF EXISTS "Public Access" ON public.community_posts;
DROP POLICY IF EXISTS "Admin All" ON public.community_posts;
ALTER TABLE public.community_posts DISABLE ROW LEVEL SECURITY;

-- community_comments
DROP POLICY IF EXISTS "community_comments_select_public" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_insert_auth" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_update_auth" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_delete_admin" ON public.community_comments;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.community_comments;
DROP POLICY IF EXISTS "Public Access" ON public.community_comments;
DROP POLICY IF EXISTS "Admin All" ON public.community_comments;
ALTER TABLE public.community_comments DISABLE ROW LEVEL SECURITY;

-- delivery_knowhow
DROP POLICY IF EXISTS "delivery_knowhow_all_staff" ON public.delivery_knowhow;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.delivery_knowhow;
DROP POLICY IF EXISTS "Public Access" ON public.delivery_knowhow;
ALTER TABLE public.delivery_knowhow DISABLE ROW LEVEL SECURITY;

-- chatbot_knowledge
DROP POLICY IF EXISTS "chatbot_knowledge_select_active" ON public.chatbot_knowledge;
DROP POLICY IF EXISTS "chatbot_knowledge_all_admin" ON public.chatbot_knowledge;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.chatbot_knowledge;
DROP POLICY IF EXISTS "Public Access" ON public.chatbot_knowledge;
ALTER TABLE public.chatbot_knowledge DISABLE ROW LEVEL SECURITY;

-- chatbot_logs
DROP POLICY IF EXISTS "chatbot_logs_insert_anon" ON public.chatbot_logs;
DROP POLICY IF EXISTS "chatbot_logs_select_admin" ON public.chatbot_logs;
DROP POLICY IF EXISTS "chatbot_logs_update_admin" ON public.chatbot_logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.chatbot_logs;
DROP POLICY IF EXISTS "Public Access" ON public.chatbot_logs;
ALTER TABLE public.chatbot_logs DISABLE ROW LEVEL SECURITY;

-- chat_rooms
DROP POLICY IF EXISTS "chat_rooms_insert_anon" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_select_admin" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update_admin" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.chat_rooms;
DROP POLICY IF EXISTS "Public Access" ON public.chat_rooms;
ALTER TABLE public.chat_rooms DISABLE ROW LEVEL SECURITY;

-- chat_messages
DROP POLICY IF EXISTS "chat_messages_insert_anon" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_admin" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_admin" ON public.chat_messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.chat_messages;
DROP POLICY IF EXISTS "Public Access" ON public.chat_messages;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

-- marketing_content
DROP POLICY IF EXISTS "marketing_content_all_admin" ON public.marketing_content;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.marketing_content;
DROP POLICY IF EXISTS "Public Access" ON public.marketing_content;
ALTER TABLE public.marketing_content DISABLE ROW LEVEL SECURITY;

-- marketing_topics
DROP POLICY IF EXISTS "marketing_topics_all_admin" ON public.marketing_topics;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.marketing_topics;
DROP POLICY IF EXISTS "Public Access" ON public.marketing_topics;
ALTER TABLE public.marketing_topics DISABLE ROW LEVEL SECURITY;

-- marketing_youtube_config
DROP POLICY IF EXISTS "marketing_youtube_config_all_admin" ON public.marketing_youtube_config;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.marketing_youtube_config;
DROP POLICY IF EXISTS "Public Access" ON public.marketing_youtube_config;
ALTER TABLE public.marketing_youtube_config DISABLE ROW LEVEL SECURITY;

-- marketing_comment_replies
DROP POLICY IF EXISTS "marketing_comment_replies_all_admin" ON public.marketing_comment_replies;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.marketing_comment_replies;
DROP POLICY IF EXISTS "Public Access" ON public.marketing_comment_replies;
ALTER TABLE public.marketing_comment_replies DISABLE ROW LEVEL SECURITY;

-- wallet_logs (fix previous migration too)
DROP POLICY IF EXISTS "wallet_logs_insert_authenticated" ON public.wallet_logs;
DROP POLICY IF EXISTS "wallet_logs_select_own" ON public.wallet_logs;
DROP POLICY IF EXISTS "wallet_logs_select_admin" ON public.wallet_logs;
DROP POLICY IF EXISTS "Users can insert own wallet logs" ON public.wallet_logs;
DROP POLICY IF EXISTS "Users can view own wallet logs" ON public.wallet_logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.wallet_logs;
DROP POLICY IF EXISTS "Public Access" ON public.wallet_logs;
DROP POLICY IF EXISTS "Admin All" ON public.wallet_logs;
ALTER TABLE public.wallet_logs DISABLE ROW LEVEL SECURITY;

-- withdrawal_requests (fix previous migration too)
DROP POLICY IF EXISTS "withdrawal_requests_insert_own" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_select_own" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_select_admin" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_update_admin" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can insert own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admin full access withdrawal_requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Public Access" ON public.withdrawal_requests;
ALTER TABLE public.withdrawal_requests DISABLE ROW LEVEL SECURITY;

-- Other tables that may have pre-existing policies
ALTER TABLE IF EXISTS public.admin_grand_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.manager_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mileage_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sellers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shared_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.template_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.visitor_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wizard_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wizard_steps DISABLE ROW LEVEL SECURITY;

-- Keep the helper functions (no harm) and indexes (pure performance benefit)
-- Only RLS policies are being reverted

-- ============================================================
-- DONE — All RLS disabled, site should be fully functional again
-- Indexes from previous migration are KEPT (they only help performance)
-- ============================================================
