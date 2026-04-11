-- ═══════════════════════════════════════════════════════════════
-- Seed: new country demo data (SG/MA/GB) + extra gig samples
-- ═══════════════════════════════════════════════════════════════
-- Adds demo designers, sample gigs and demo requests for countries
-- that were added after the original seed: Singapore, Morocco, UK.
-- Also adds ~10 more sample gigs across existing countries so the
-- Gig Market looks lived-in.
-- Re-runnable — skips existing rows by name/title.

-- ──────────────────────────────────────────────────────────
-- 1) Demo designers for SG / MA / GB (10 each)
-- ──────────────────────────────────────────────────────────
INSERT INTO public.designer_profiles
    (id, display_name, bio, intro, photo_url, country, specialties, languages,
     years_experience, response_time, contact_hours,
     is_active, is_demo, avg_rating, total_reviews,
     avg_communication, avg_quality, avg_speed, total_earnings,
     wallet_balance, wallet_pending_withdrawal,
     portfolio_urls)
SELECT
    gen_random_uuid(),
    s.name, s.bio, s.intro, s.photo, s.country,
    s.specialties::jsonb, s.languages::jsonb,
    s.years_exp, s.response_time, s.contact_hours,
    true, true,
    s.rating, s.reviews,
    s.comm_rating, s.qual_rating, s.spd_rating,
    0, 0, 0,
    s.portfolio_urls::jsonb
FROM (VALUES
    -- Singapore (10)
    ('Min Tan',      'Bilingual designer (EN/ZH) — Singapore.', 'Modern branding for startups across SEA. Fast turnaround.', 'https://i.pravatar.cc/240?img=31', 'SG', '["logo","branding","web_ui"]', '["en","zh"]', 7,  '1-2 hours', 'Mon-Fri 9am-7pm SGT', 4.9, 87,  4.9, 4.9, 4.8, '["https://images.unsplash.com/photo-1561070791-2526d30994b8?w=600","https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600"]'),
    ('Wei Lin',      'Packaging & retail display specialist.', '10+ years working with F&B and beauty brands in Singapore.', 'https://i.pravatar.cc/240?img=32', 'SG', '["packaging","product_detail","illustration"]', '["en","zh","ms"]', 10, '2-4 hours', 'Mon-Sat 10am-6pm SGT', 4.8, 64,  4.8, 4.9, 4.7, '["https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600"]'),
    ('Priya Kumar',  'Editorial & infographic designer.', 'Infographics for finance and consulting firms. Clear visual thinking.', 'https://i.pravatar.cc/240?img=33', 'SG', '["infographic","presentation","brochure"]', '["en","ta"]', 6,  '< 1 hour',  'Tue-Sat 10am-8pm SGT', 4.9, 52,  5.0, 4.8, 4.9, '[]'),
    ('Jia Hao Lim',  'UI/UX designer for fintech apps.',       'Human-centered product design. SEA market focus.',                  'https://i.pravatar.cc/240?img=34', 'SG', '["web_ui","branding"]', '["en","zh"]', 8,  '1-2 hours', 'Mon-Fri 10am-7pm SGT', 4.7, 41,  4.8, 4.7, 4.6, '[]'),
    ('Cheryl Ng',    'YouTube thumbnails & social media.',    'Making your videos get clicked. Bold color and strong type.',       'https://i.pravatar.cc/240?img=35', 'SG', '["thumbnail","banner"]',       '["en","zh"]', 4,  '< 30 min',  'Daily 11am-11pm SGT',  4.8, 118, 4.9, 4.7, 4.9, '[]'),
    ('Kevin Teo',    'Event and exhibition designer.',         'Trade show booths, event collateral, pop-up displays.',             'https://i.pravatar.cc/240?img=36', 'SG', '["signboard","honeycomb"]',    '["en","zh"]', 9,  '2-6 hours', 'Mon-Fri 9am-6pm SGT',  4.6, 33,  4.7, 4.5, 4.6, '[]'),
    ('Rachel Ong',   'Watercolor illustrator & character artist.', 'Handmade illustrations for books, cards and branding.',          'https://i.pravatar.cc/240?img=37', 'SG', '["illustration","character","book"]', '["en","zh"]', 5,  '1-3 hours', 'Mon-Sat 12pm-8pm SGT', 4.9, 29,  5.0, 4.9, 4.8, '[]'),
    ('Daniel Wong',  'Corporate branding specialist.',         'Logos, identity systems and brand guidelines.',                     'https://i.pravatar.cc/240?img=38', 'SG', '["logo","branding","business_card"]', '["en","zh"]', 12, '2-4 hours', 'Mon-Fri 9am-6pm SGT',  4.7, 71,  4.7, 4.8, 4.6, '[]'),
    ('Aisha Rahman', 'Muslim-friendly brand and content designer.', 'Ramadan and Eid campaigns, halal product branding.',          'https://i.pravatar.cc/240?img=39', 'SG', '["banner","packaging","illustration"]', '["en","ms","ar"]', 6, '1-2 hours', 'Mon-Sat 9am-7pm SGT',  4.8, 58,  4.9, 4.8, 4.8, '[]'),
    ('Benjamin Lee', 'Minimalist print designer.',             'Business cards, menus, luxury packaging.',                          'https://i.pravatar.cc/240?img=40', 'SG', '["business_card","brochure","packaging"]', '["en","zh"]', 8,  '1-3 hours', 'Mon-Fri 10am-6pm SGT', 4.9, 95,  4.9, 4.9, 4.9, '[]'),

    -- Morocco (10)
    ('Yasmine El Fassi','Arabic/French bilingual brand designer.',  'Casablanca-based. Brand identity for hotels and retail.',           'https://i.pravatar.cc/240?img=41', 'MA', '["logo","branding","packaging"]',     '["ar","fr","en"]', 8,  '1-3 hours', 'Mon-Fri 9am-6pm WET', 4.8, 62,  4.8, 4.9, 4.7, '[]'),
    ('Omar Benali',    'Traditional Moroccan pattern illustrator.', 'Zellige and arabesque patterns for textile, packaging, print.',    'https://i.pravatar.cc/240?img=42', 'MA', '["illustration","packaging","branding"]','["ar","fr"]',     6,  '2-6 hours', 'Mon-Sat 10am-7pm WET', 4.9, 48,  4.9, 5.0, 4.8, '[]'),
    ('Sofia Amrani',   'Event and wedding stationery designer.',    'Elegant invitations, save-the-dates, ceremony materials.',          'https://i.pravatar.cc/240?img=43', 'MA', '["business_card","brochure","illustration"]','["ar","fr","en"]',5,  '1-2 hours', 'Tue-Sat 10am-6pm WET', 4.8, 37,  4.9, 4.8, 4.7, '[]'),
    ('Karim Tazi',     'Web designer for hotels and restaurants.',  'Responsive websites and menu design for hospitality.',              'https://i.pravatar.cc/240?img=44', 'MA', '["web_ui","branding","brochure"]',    '["ar","fr","en"]', 7,  '2-4 hours', 'Mon-Fri 9am-6pm WET',  4.7, 44,  4.8, 4.7, 4.6, '[]'),
    ('Nour Bensaid',   'Product photographer and catalog designer.','Argan oil, cosmetics, handcrafts — product pages and catalogs.',    'https://i.pravatar.cc/240?img=45', 'MA', '["product_detail","brochure","packaging"]','["ar","fr"]',    5,  '1-3 hours', 'Mon-Fri 9am-5pm WET',  4.8, 51,  4.7, 4.8, 4.8, '[]'),
    ('Hamza Idrissi',  'Logo and corporate identity designer.',     'Clean, professional logos for professional services.',              'https://i.pravatar.cc/240?img=46', 'MA', '["logo","business_card","branding"]', '["ar","fr","en"]', 9,  '2-4 hours', 'Mon-Fri 9am-6pm WET',  4.6, 68,  4.7, 4.6, 4.5, '[]'),
    ('Leila Chafik',   'Children book illustrator.',                'Illustrated stories for Arabic and French readers.',                'https://i.pravatar.cc/240?img=47', 'MA', '["illustration","character","book"]', '["ar","fr"]',      4,  '1-2 hours', 'Daily 10am-8pm WET',   4.9, 26,  5.0, 4.9, 4.8, '[]'),
    ('Youssef Amrani', 'Signboard and wayfinding designer.',        'Stores, offices, restaurants. Bilingual signage.',                  'https://i.pravatar.cc/240?img=48', 'MA', '["signboard","branding"]',            '["ar","fr"]',      11, '2-6 hours', 'Mon-Sat 9am-6pm WET',  4.7, 55,  4.6, 4.8, 4.6, '[]'),
    ('Fatima Zahra',   'Social media and banner ad designer.',       'High-converting creative for Moroccan e-commerce.',                 'https://i.pravatar.cc/240?img=49', 'MA', '["banner","thumbnail","packaging"]', '["ar","fr","en"]', 3,  '< 1 hour',  'Daily 9am-11pm WET',   4.9, 84,  5.0, 4.8, 4.9, '[]'),
    ('Anas El Malki',  'Brochure and magazine layout designer.',     'Editorial design for tourism and cultural publications.',           'https://i.pravatar.cc/240?img=50', 'MA', '["brochure","presentation","web_ui"]','["ar","fr","en"]',  6,  '1-3 hours', 'Mon-Fri 10am-6pm WET', 4.7, 42,  4.8, 4.7, 4.7, '[]'),

    -- UK (10)
    ('James Harrison', 'Editorial designer for magazines and books.','Clean typographic design, 15 years in London publishing.',        'https://i.pravatar.cc/240?img=51', 'GB', '["book","brochure","presentation"]', '["en"]',           15, '2-4 hours', 'Mon-Fri 9am-6pm BST', 4.9, 134, 4.9, 4.9, 4.9, '[]'),
    ('Emily Carter',   'Luxury brand identity.',                     'Fashion, hospitality, and boutique hotel branding.',               'https://i.pravatar.cc/240?img=52', 'GB', '["logo","branding","packaging"]',     '["en"]',           10, '1-3 hours', 'Mon-Fri 10am-6pm BST',4.9, 108, 5.0, 4.9, 4.9, '[]'),
    ('Oliver Bennett', 'Web and UI designer.',                       'Product design for UK fintech and SaaS.',                          'https://i.pravatar.cc/240?img=53', 'GB', '["web_ui","branding"]',               '["en"]',           8,  '1-2 hours', 'Mon-Fri 9am-6pm BST', 4.8, 76,  4.8, 4.8, 4.7, '[]'),
    ('Sophie Williams','Children book illustrator.',                 'Whimsical watercolor illustration for kids books.',                'https://i.pravatar.cc/240?img=54', 'GB', '["illustration","character","book"]', '["en"]',           6,  '2-4 hours', 'Mon-Sat 10am-6pm BST',4.9, 61,  5.0, 4.9, 4.8, '[]'),
    ('Harry Thompson', 'Motion graphic and thumbnail designer.',     'YouTube and social media creative for UK creators.',               'https://i.pravatar.cc/240?img=55', 'GB', '["thumbnail","banner","illustration"]', '["en"]',          4,  '< 1 hour',  'Daily 10am-11pm BST', 4.8, 157, 4.9, 4.7, 4.9, '[]'),
    ('Charlotte Hall', 'Event and retail display designer.',          'Trade fair stands, pop-up stores, retail windows.',                'https://i.pravatar.cc/240?img=56', 'GB', '["signboard","honeycomb","packaging"]','["en"]',           9,  '2-6 hours', 'Mon-Fri 9am-6pm BST', 4.7, 47,  4.7, 4.8, 4.6, '[]'),
    ('Daniel Foster',  'Infographic and data viz.',                   'Consulting, finance, and policy reports.',                         'https://i.pravatar.cc/240?img=57', 'GB', '["infographic","presentation","brochure"]','["en"]',       7,  '2-4 hours', 'Mon-Fri 9am-5pm BST', 4.8, 55,  4.7, 4.9, 4.8, '[]'),
    ('Lucy Edwards',   'Wedding and event stationery.',                'Elegant invitations and signage for UK weddings.',                 'https://i.pravatar.cc/240?img=58', 'GB', '["business_card","brochure","illustration"]','["en"]',     5,  '1-3 hours', 'Tue-Sat 10am-6pm BST', 4.9, 82,  5.0, 4.9, 4.9, '[]'),
    ('Ethan Clarke',   'Logo and brand identity.',                    'Minimalist, timeless marks for SMEs.',                             'https://i.pravatar.cc/240?img=59', 'GB', '["logo","branding","business_card"]', '["en"]',           12, '2-4 hours', 'Mon-Fri 9am-6pm BST',  4.7, 89,  4.8, 4.7, 4.6, '[]'),
    ('Grace Parker',   'Product packaging and label design.',         'Organic food, cosmetics, wellness brands.',                        'https://i.pravatar.cc/240?img=60', 'GB', '["packaging","product_detail","branding"]','["en"]',       6,  '1-3 hours', 'Mon-Fri 10am-6pm BST', 4.8, 63,  4.8, 4.8, 4.7, '[]')
) AS s(name, bio, intro, photo, country, specialties, languages,
       years_exp, response_time, contact_hours,
       rating, reviews, comm_rating, qual_rating, spd_rating,
       portfolio_urls)
WHERE NOT EXISTS (
    SELECT 1 FROM public.designer_profiles WHERE display_name = s.name AND country = s.country
);

-- ──────────────────────────────────────────────────────────
-- 2) Extra sample gigs (~10) across all countries
-- ──────────────────────────────────────────────────────────
-- These are attached to the first demo designer from the target
-- country. Skipped if a gig with the same title already exists.
WITH picks AS (
    SELECT country, id AS designer_id, ROW_NUMBER() OVER (PARTITION BY country ORDER BY display_name) AS rn
    FROM public.designer_profiles WHERE is_demo = true
)
INSERT INTO public.designer_gigs
    (designer_id, title, category, description, tags, country,
     thumbnail, gallery, standard_price, standard_days, standard_revisions, standard_desc,
     has_deluxe, deluxe_price, deluxe_days, deluxe_revisions, deluxe_desc,
     has_premium, premium_price, premium_days, premium_revisions, premium_desc,
     status, view_count, order_count, avg_rating, total_reviews)
SELECT p.designer_id, s.title, s.category, s.description, s.tags::jsonb, s.country,
       s.thumb, s.gallery::jsonb, s.std_price, s.std_days, s.std_rev, s.std_desc,
       s.has_dlx, s.dlx_price, s.dlx_days, s.dlx_rev, s.dlx_desc,
       s.has_prm, s.prm_price, s.prm_days, s.prm_rev, s.prm_desc,
       'active', s.views, s.orders, s.rating, s.reviews
FROM (VALUES
    -- Singapore gigs
    ('[Sample] Modern Startup Logo — Singapore', 'logo', 'Clean, modern logo design for SEA startups. Vector files, color variations, and brand guideline snippet.', '["logo","modern","startup","sg"]', 'SG',
     'https://images.unsplash.com/photo-1561070791-2526d30994b8?w=800', '["https://images.unsplash.com/photo-1561070791-2526d30994b8?w=800"]',
      80000, 3, 2, 'Logo + 2 color variants', true, 160000, 5, 4, 'Logo + full brand guideline', false, 0, 0, 0, '', 240, 18, 4.9, 12),
    ('[Sample] F&B Packaging Design', 'packaging', 'Food and beverage packaging for Singapore retail. Dieline, 3D mockup, and print-ready CMYK.', '["packaging","food","retail","sg"]', 'SG',
     'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', '["https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800"]',
      150000, 5, 2, 'One SKU package design', true, 280000, 7, 3, '2 SKU + label family', true, 450000, 10, 5, 'Full product line packaging', 180, 9, 4.8, 6),

    -- Morocco gigs
    ('[Sample] Arabic + Latin Bilingual Logo', 'logo', 'Bilingual brand identity with balanced Arabic and Latin script. Perfect for Moroccan businesses.', '["logo","bilingual","arabic","ma"]', 'MA',
     'https://i.pravatar.cc/800?img=41', '["https://i.pravatar.cc/800?img=41"]',
      60000, 4, 2, 'Bilingual logo + 2 variations', true, 120000, 6, 3, 'Full bilingual identity', false, 0, 0, 0, '', 165, 11, 4.9, 8),
    ('[Sample] Moroccan Pattern Illustration Pack', 'illustration', 'Traditional zellige and arabesque patterns you can use on products, web, or print.', '["illustration","pattern","moroccan","ma"]', 'MA',
     'https://i.pravatar.cc/800?img=42', '["https://i.pravatar.cc/800?img=42"]',
      45000, 5, 2, 'Set of 5 original patterns', true, 85000, 7, 3, 'Set of 10 + color variants', false, 0, 0, 0, '', 203, 14, 4.9, 9),

    -- UK gigs
    ('[Sample] Editorial Magazine Layout', 'brochure', 'Multi-page editorial layout with strong typography and grid. Perfect for magazines and long-form brochures.', '["editorial","magazine","layout","uk"]', 'GB',
     'https://i.pravatar.cc/800?img=51', '["https://i.pravatar.cc/800?img=51"]',
      120000, 7, 2, 'Up to 12 pages', true, 240000, 12, 4, 'Up to 28 pages', true, 380000, 18, 5, 'Full magazine + print-ready files', 312, 21, 4.9, 15),
    ('[Sample] Luxury Boutique Brand Identity', 'branding', 'Premium brand identity for boutique hotels, fashion and wellness brands.', '["branding","luxury","identity","uk"]', 'GB',
     'https://i.pravatar.cc/800?img=52', '["https://i.pravatar.cc/800?img=52"]',
      220000, 10, 3, 'Logo + basic guideline', true, 450000, 15, 5, 'Full visual identity system', true, 780000, 25, 7, 'Identity + collateral + brand book', 189, 8, 5.0, 7),

    -- Extra KR gig
    ('[Sample] 소량 결혼식 청첩장 디자인', 'business_card', '소량으로 주문 가능한 감성적인 청첩장을 디자인해 드립니다. 1장부터 주문 가능한 소량 인쇄와 함께 이용하세요.', '["청첩장","결혼식","소량","kr"]', 'KR',
     'https://i.pravatar.cc/800?img=11', '["https://i.pravatar.cc/800?img=11"]',
      50000, 3, 2, '청첩장 앞뒤 디자인', true, 90000, 5, 3, '청첩장 + 봉투 + 감사 카드', false, 0, 0, 0, '', 421, 47, 4.9, 32),

    -- Extra JP gig
    ('[Sample] 日本向けチラシ・パンフレットデザイン', 'brochure', '日本市場向けの高コンバージョンチラシとパンフレットをデザインします。A4・A5・三つ折り対応。', '["チラシ","パンフレット","日本","jp"]', 'JP',
     'https://i.pravatar.cc/800?img=21', '["https://i.pravatar.cc/800?img=21"]',
      7000, 4, 2, 'A4片面デザイン', true, 14000, 6, 3, 'A4両面 + パンフレット', true, 25000, 9, 5, '複数デザイン + 印刷データ', 256, 18, 4.8, 14),

    -- Extra US gig
    ('[Sample] Podcast Cover & Episode Thumbnail Pack', 'thumbnail', 'Cover art for your new podcast + reusable episode thumbnail templates. Spotify and Apple Podcasts ready.', '["podcast","cover","thumbnail","us"]', 'US',
     'https://i.pravatar.cc/800?img=61', '["https://i.pravatar.cc/800?img=61"]',
      120, 3, 2, 'Cover + 3 episode templates', true, 220, 5, 3, 'Cover + 10 templates + audiogram style', false, 0, 0, 0, '', 178, 15, 4.8, 11),

    -- Extra CN gig
    ('[Sample] 跨境电商产品详情页设计', 'product_detail', '为跨境电商卖家设计高转化率的产品详情页。包括手机端和桌面端布局。', '["详情页","跨境电商","产品","cn"]', 'CN',
     'https://i.pravatar.cc/800?img=71', '["https://i.pravatar.cc/800?img=71"]',
      600, 5, 2, '1个产品详情页', true, 1200, 8, 3, '3个产品 + 主图', true, 2000, 12, 5, '整店视觉升级', 293, 22, 4.7, 17)
) AS s(title, category, description, tags, country,
       thumb, gallery, std_price, std_days, std_rev, std_desc,
       has_dlx, dlx_price, dlx_days, dlx_rev, dlx_desc,
       has_prm, prm_price, prm_days, prm_rev, prm_desc,
       views, orders, rating, reviews)
JOIN picks p ON p.country = s.country AND p.rn = 1
WHERE NOT EXISTS (
    SELECT 1 FROM public.designer_gigs WHERE title = s.title
);

-- ──────────────────────────────────────────────────────────
-- 3) Demo design requests for SG / MA / GB (10 each)
-- ──────────────────────────────────────────────────────────
-- Small set so the "Open Requests" tab has something to show
-- when filtering by these countries.
INSERT INTO public.design_requests
    (id, customer_id, title, category, description, budget_min, budget_max, country,
     phone, files, is_demo, status, created_at)
SELECT gen_random_uuid(), NULL, s.title, s.category, s.description,
       s.budget_min, s.budget_max, s.country,
       '', '[]'::jsonb, true, 'completed', NOW() - (s.age_days || ' days')::interval
FROM (VALUES
    -- Singapore
    ('Logo for new coffee roaster in Tiong Bahru', 'logo',         'Boutique coffee shop opening in Tiong Bahru. Need a logo that fits minimalist SG aesthetic.', 40000, 80000, 'SG', 5),
    ('Product detail page for cosmetics brand',     'product_detail','Facial oil line, Shopify listing. Need mobile-first layout with before/after shots.',        120000, 200000, 'SG', 8),
    ('Wedding invitation set — bilingual EN/ZH',    'business_card', 'Bilingual English/Chinese wedding invitation + RSVP + ceremony program.',                     60000, 120000, 'SG', 12),
    ('Hawker stall signage redesign',                'signboard',    'Traditional chicken rice stall. Need bold, readable signage.',                                 30000, 60000, 'SG', 15),
    ('App icon + onboarding screens',                'web_ui',       'Delivery app for condos. Need icon and 5 onboarding screens.',                                80000, 150000, 'SG', 20),

    -- Morocco
    ('Packaging for argan oil export brand',        'packaging',    'Premium argan oil for export to EU and US. Need bottle label + outer box.',                    80000, 150000, 'MA', 6),
    ('Menu design for Marrakech riad restaurant',   'brochure',     'Bilingual menu (Arabic/French) for a rooftop restaurant. Elegant layout.',                     40000, 80000, 'MA', 9),
    ('Logo for traditional crafts e-shop',          'logo',         'Hand-woven rugs, lanterns, pottery. Need a logo that feels both traditional and modern.',     30000, 60000, 'MA', 13),
    ('Event flyer for Gnawa music festival',        'banner',       'Annual Gnawa music festival in Essaouira. Need a bilingual flyer.',                             25000, 50000, 'MA', 18),
    ('Tourism brochure for Fes medina tours',       'brochure',     'Walking tour brochure for the Fes medina. Need a map illustration + photo layout.',             60000, 110000, 'MA', 23),

    -- UK
    ('Brand identity for sustainable fashion label', 'branding',     'Organic cotton clothing brand, London. Need identity + tags + lookbook cover.',                250000, 450000, 'GB', 4),
    ('Magazine cover for quarterly culture zine',    'brochure',     '32-page indie culture magazine cover + section openers.',                                      150000, 280000, 'GB', 7),
    ('Pub signage for gastro pub in Shoreditch',     'signboard',    'New gastro pub opening. Need exterior sign + A-board design.',                                 80000, 150000, 'GB', 11),
    ('Book cover for debut novel',                   'book',         'Literary fiction debut novel. Need a striking cover that appeals to book club readers.',       120000, 220000, 'GB', 16),
    ('Wedding stationery suite — London venue',      'business_card', 'Full wedding stationery suite: save-the-date, invitation, RSVP, day-of signage.',              180000, 320000, 'GB', 21)
) AS s(title, category, description, budget_min, budget_max, country, age_days)
WHERE NOT EXISTS (
    SELECT 1 FROM public.design_requests WHERE title = s.title AND is_demo = true
);
