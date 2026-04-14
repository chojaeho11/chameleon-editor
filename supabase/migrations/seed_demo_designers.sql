-- ═══════════════════════════════════════════════════════════════
-- Seed: 80 demo designers (10 per country) with Unsplash photos
-- ═══════════════════════════════════════════════════════════════
-- These are FAKE marketing/priming profiles. They cannot log in
-- (no auth.users entry) so they cannot place real bids or chat.
-- They appear in the showcase to make the marketplace look lived-in.
-- Re-running is idempotent — uses display_name as a uniqueness key.

-- 1) Add is_demo flag (so we can filter them out in actions later)
ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2) Drop the FK to auth.users so demo rows can have synthetic UUIDs
ALTER TABLE public.designer_profiles
    DROP CONSTRAINT IF EXISTS designer_profiles_id_fkey;

-- 3) Insert demo designers
INSERT INTO public.designer_profiles
    (id, display_name, bio, intro, photo_url, country, specialties, languages,
     years_experience, response_time, contact_hours,
     is_active, is_demo, avg_rating, total_reviews,
     avg_communication, avg_quality, avg_speed, total_earnings,
     wallet_balance, wallet_pending_withdrawal,
     portfolio_urls)
SELECT
    gen_random_uuid(),
    s.name,
    s.bio,
    s.intro,
    s.photo,
    s.country,
    s.specialties::jsonb,
    s.languages::jsonb,
    s.years_exp,
    s.response_time,
    s.contact_hours,
    true, true,
    s.rating, s.reviews,
    s.comm_rating, s.qual_rating, s.spd_rating,
    0, 0, 0,
    '[]'::jsonb
FROM (VALUES
    -- ──────────── KOREA (KR) — 10 designers ────────────
    ('Min Joon Kim',     'Brand identity specialist · 8 years',    E'8년차 브랜드 아이덴티티 디자이너입니다. 스타트업과 중소기업의 로고, BX 시스템, 그래픽 가이드라인을 만들어 왔습니다.\n\n지금까지 200개 이상의 브랜드 작업을 했고, 명확한 컨셉과 빠른 커뮤니케이션을 약속드립니다.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', 'KR', '["로고","브랜딩","BX"]', '["한국어","English"]', 8, '평균 30분 이내', '평일 9시-19시', 4.95, 87, 4.9, 4.95, 4.9),
    ('Soo Yeon Park',    'Editorial & print designer · 6 years',    E'편집디자인 전문가입니다. 잡지, 단행본, 카탈로그, 회사소개서를 주로 만듭니다. InDesign / Illustrator 능숙.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'KR', '["편집디자인","브로슈어","카탈로그"]', '["한국어","English"]', 6, '평균 1시간 이내', '평일 10시-18시', 4.85, 62, 4.9, 4.85, 4.7),
    ('Hyun Woo Lee',     'Logo & character design · 5 years',       E'캐릭터와 로고를 동시에 잘하는 디자이너입니다. 귀여운 마스코트부터 미니멀한 로고까지 폭넓게 작업합니다.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'KR', '["로고","캐릭터","일러스트"]', '["한국어"]', 5, '평균 2시간 이내', '평일 11시-20시', 4.8, 41, 4.7, 4.85, 4.8),
    ('Ji Eun Choi',      'Web & app UI/UX · 7 years',               E'웹/앱 UI 디자이너입니다. Figma 기반으로 작업하며, 디자인 시스템부터 컴포넌트까지 일관성 있게 만듭니다.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'KR', '["웹디자인","UI/UX","Figma"]', '["한국어","English"]', 7, '평균 1시간 이내', '평일 10시-19시', 4.9, 73, 4.95, 4.9, 4.85),
    ('Sang Hoon Jung',   'Packaging & label design · 9 years',      E'9년차 패키지 디자이너입니다. 화장품, 식품, 생활용품 패키지 전문이며 양산까지 책임집니다.', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80', 'KR', '["패키지","라벨","인쇄"]', '["한국어"]', 9, '평균 30분 이내', '평일 9시-18시', 4.92, 95, 4.95, 4.9, 4.9),
    ('Yu Na Han',        'SNS & banner specialist · 4 years',       E'SNS 콘텐츠와 광고 배너를 주로 작업합니다. 인스타, 유튜브 썸네일, 페이스북 광고용 크리에이티브 전문.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80', 'KR', '["SNS","배너","썸네일"]', '["한국어","English"]', 4, '평균 1시간 이내', '평일 9시-21시', 4.75, 38, 4.7, 4.8, 4.7),
    ('Tae Hyung Bae',    'Honeycomb display expert · 6 years',      E'친환경 허니콤 보드 디스플레이 디자인 전문입니다. 팝업스토어, 박람회 부스, 매장 디스플레이를 주로 작업합니다.', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', 'KR', '["허니콤보드","디스플레이","전시"]', '["한국어"]', 6, '평균 2시간 이내', '평일 9시-18시', 4.88, 54, 4.9, 4.9, 4.8),
    ('Eun Ji Yoon',      'Illustrator & character artist · 5 years', E'손그림 일러스트와 디지털 페인팅 모두 가능합니다. 책 표지, 카드뉴스, 캐릭터 굿즈 등 다양한 영역.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'KR', '["일러스트","캐릭터","책표지"]', '["한국어","English"]', 5, '평균 3시간 이내', '평일 14시-22시', 4.85, 47, 4.85, 4.9, 4.75),
    ('Dong Hyun Shin',   'Signboard & display design · 10 years',   E'10년차 간판/디스플레이 디자이너. 옥외광고와 실내 사이니지 모두 다룹니다. 인쇄 양산 노하우 풍부.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'KR', '["간판","사이니지","옥외광고"]', '["한국어"]', 10, '평균 1시간 이내', '평일 9시-19시', 4.93, 102, 4.95, 4.95, 4.85),
    ('Hye Jin Oh',       'E-commerce detail page expert · 7 years', E'네이버 스마트스토어, 쿠팡, 11번가 상품 상세페이지 전문입니다. 전환율 높이는 스토리텔링 강점.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80', 'KR', '["상세페이지","이커머스","스토리텔링"]', '["한국어"]', 7, '평균 30분 이내', '평일 10시-20시', 4.9, 81, 4.9, 4.95, 4.85),

    -- ──────────── JAPAN (JP) — 10 designers ────────────
    ('Yuki Tanaka',      '7年のロゴ・ブランディング',                E'7年間ロゴとブランディングの仕事をしています。スタートアップから大手企業まで幅広く対応します。', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', 'JP', '["ロゴ","ブランディング"]', '["日本語","English"]', 7, '30分以内', '平日 9時-18時', 4.92, 76, 4.95, 4.9, 4.85),
    ('Haruto Sato',      '5年のWeb・アプリUI',                      E'Figmaを中心にWeb・モバイルアプリのUIデザインを手がけています。UXリサーチも対応可能。', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', 'JP', '["Web","UI/UX","Figma"]', '["日本語","English"]', 5, '1時間以内', '平日 10時-19時', 4.85, 54, 4.9, 4.85, 4.75),
    ('Aoi Suzuki',       '6年のパッケージデザイナー',                E'食品・化粧品のパッケージを得意としています。印刷のルールに詳しく、量産までサポートします。', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'JP', '["パッケージ","ラベル","印刷"]', '["日本語"]', 6, '2時間以内', '平日 9時-18時', 4.88, 63, 4.9, 4.9, 4.8),
    ('Hinata Takahashi', '4年のSNS・広告クリエイティブ',            E'インスタグラム、Twitter、TikTok向けの広告クリエイティブを制作しています。', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'JP', '["SNS","広告","クリエイティブ"]', '["日本語","English"]', 4, '1時間以内', '平日 11時-20時', 4.78, 42, 4.8, 4.8, 4.7),
    ('Sakura Yamamoto',  '8年のエディトリアル',                      E'雑誌、書籍、カタログの編集デザインが専門です。InDesignでの組版経験豊富。', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', 'JP', '["編集","書籍","カタログ"]', '["日本語"]', 8, '1時間以内', '平日 10時-18時', 4.9, 88, 4.95, 4.9, 4.85),
    ('Riku Watanabe',    '6年のキャラクター作家',                    E'オリジナルキャラクター制作とLINEスタンプ専門です。可愛いものから渋いものまで幅広く。', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', 'JP', '["キャラクター","LINEスタンプ","イラスト"]', '["日本語"]', 6, '2時間以内', '平日 13時-21時', 4.86, 57, 4.85, 4.9, 4.8),
    ('Mio Nakamura',     '5年のYouTubeサムネイル',                  E'YouTube動画のサムネイル専門デザイナー。クリック率を意識した強いビジュアルが得意。', 'https://images.unsplash.com/photo-1521252659862-eec69941b071?w=400&q=80', 'JP', '["YouTube","サムネイル","バナー"]', '["日本語"]', 5, '30分以内', '平日 9時-23時', 4.82, 68, 4.85, 4.8, 4.8),
    ('Kenji Ito',        '9年の名刺・ステーショナリー',              E'名刺、レターヘッド、封筒、ロゴから名刺まで一貫した企業VIを制作します。', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'JP', '["名刺","ステーショナリー","VI"]', '["日本語","English"]', 9, '1時間以内', '平日 9時-18時', 4.93, 95, 4.95, 4.9, 4.9),
    ('Nanami Kobayashi', '4年のEC商品ページ',                       E'楽天、Amazon、Shopify向けの商品詳細ページデザインが得意です。', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'JP', '["EC","商品ページ","ランディング"]', '["日本語","English"]', 4, '1時間以内', '平日 10時-19時', 4.78, 39, 4.8, 4.8, 4.7),
    ('Sora Yamada',      '7年のブースデザイン',                      E'展示会・イベントブースのデザインを手がけています。ハニカムボード、紙什器の量産経験豊富。', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'JP', '["ブース","ディスプレイ","紙什器"]', '["日本語"]', 7, '2時間以内', '平日 9時-18時', 4.88, 71, 4.9, 4.85, 4.85),

    -- ──────────── USA (US) — 10 designers ────────────
    ('Emma Johnson',     'Brand identity expert · 9 years',         'Specialized in startup branding for 9 years. From wordmarks to full brand systems, I help founders express their vision visually.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'US', '["logo","branding","identity"]', '["English"]', 9, 'within 1 hour', 'Mon-Fri 9am-6pm EST', 4.93, 142, 4.95, 4.95, 4.85),
    ('Liam Williams',    'Web & product designer · 6 years',        'Figma-first product designer. SaaS dashboards, marketing sites, design systems. Worked with 30+ startups.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'US', '["web","ui/ux","figma"]', '["English"]', 6, 'within 30 min', 'Mon-Fri 10am-7pm PST', 4.9, 98, 4.9, 4.9, 4.85),
    ('Olivia Brown',     'Packaging design · 5 years',              'Sustainable packaging design for food, beauty and CPG brands. Mockup-ready, print-ready, retail-tested.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'US', '["packaging","label","cpg"]', '["English","Spanish"]', 5, 'within 2 hours', 'Mon-Fri 9am-5pm CST', 4.85, 64, 4.9, 4.85, 4.75),
    ('Noah Davis',       'Logo & brand mark · 7 years',             'Bold, distinctive logo design. Vector-only, source files always included. 100+ brand marks delivered.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'US', '["logo","brandmark","vector"]', '["English"]', 7, 'within 1 hour', 'Mon-Fri 9am-6pm EST', 4.92, 115, 4.95, 4.9, 4.9),
    ('Ava Miller',       'Editorial & print designer · 8 years',    'Magazine layouts, book covers, annual reports. InDesign expert with a strong typographic eye.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', 'US', '["editorial","print","typography"]', '["English","French"]', 8, 'within 1 hour', 'Mon-Fri 10am-6pm EST', 4.88, 87, 4.9, 4.9, 4.8),
    ('Ethan Wilson',     'YouTube thumbnail wizard · 4 years',      'High-CTR thumbnails for creators with 100K+ subscribers. Bold, punchy, click-tested.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', 'US', '["youtube","thumbnail","viral"]', '["English"]', 4, 'within 30 min', '7 days a week', 4.86, 79, 4.85, 4.9, 4.85),
    ('Sophia Moore',     'SNS & ad creative · 5 years',             'Instagram, Facebook, TikTok ad creatives that convert. Performance-focused design.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'US', '["sns","ads","instagram"]', '["English","Spanish"]', 5, 'within 1 hour', 'Mon-Fri 9am-6pm PST', 4.84, 71, 4.85, 4.85, 4.8),
    ('Mason Taylor',     'E-commerce specialist · 6 years',         'Shopify, BigCommerce product pages and email design. Conversion-driven layouts.', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', 'US', '["shopify","email","ecommerce"]', '["English"]', 6, 'within 1 hour', 'Mon-Fri 10am-6pm CST', 4.89, 92, 4.9, 4.9, 4.85),
    ('Isabella Anderson','Illustrator & character artist · 7 years','Editorial illustration, children''s books, character design. Hand-drawn meets digital.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'US', '["illustration","character","editorial"]', '["English"]', 7, 'within 2 hours', 'Mon-Fri 11am-7pm EST', 4.91, 86, 4.95, 4.95, 4.8),
    ('Lucas Thomas',     'Signage & exhibition design · 10 years',  'Trade show booths, retail signage, environmental graphics. Production-ready files always.', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', 'US', '["signage","booth","exhibition"]', '["English"]', 10, 'within 1 hour', 'Mon-Fri 9am-5pm EST', 4.94, 134, 4.95, 4.95, 4.9),

    -- ──────────── CHINA (CN) — 10 designers ────────────
    ('Wei Zhang',        '8年品牌标识设计专家',                       '8年品牌标识设计经验。为初创公司和成熟企业打造视觉识别系统。', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', 'CN', '["logo","branding"]', '["中文","English"]', 8, '30分钟内', '工作日 9-18点', 4.9, 88, 4.9, 4.95, 4.85),
    ('Li Wang',          '6年Web设计师',                              '专注于Web和移动应用的UI/UX设计。Figma和Sketch熟练。', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'CN', '["web","ui","figma"]', '["中文","English"]', 6, '1小时内', '工作日 10-19点', 4.85, 64, 4.9, 4.85, 4.75),
    ('Fang Chen',        '5年包装设计',                               '食品和化妆品包装设计专家。从设计到印刷一站式服务。', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'CN', '["packaging","label"]', '["中文"]', 5, '2小时内', '工作日 9-18点', 4.82, 51, 4.85, 4.85, 4.7),
    ('Hao Liu',          '7年插画师',                                 '商业插画、儿童读物、角色设计。手绘风格独特。', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'CN', '["illustration","character"]', '["中文","English"]', 7, '2小时内', '工作日 13-22点', 4.88, 73, 4.9, 4.9, 4.8),
    ('Yang Yang',        '4年社交媒体设计',                           '微博、小红书、抖音内容设计。把握年轻用户审美。', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'CN', '["sns","weibo","ads"]', '["中文"]', 4, '1小时内', '工作日 10-21点', 4.78, 47, 4.8, 4.8, 4.7),
    ('Mei Lin',          '9年印刷设计师',                             '名片、传单、宣传册等印刷品设计。CMYK规范严谨。', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'CN', '["print","brochure","businesscard"]', '["中文"]', 9, '1小时内', '工作日 9-18点', 4.92, 102, 4.95, 4.9, 4.9),
    ('Bo Sun',           '6年电商详情页',                             '淘宝、天猫、京东商品详情页设计专家。提升转化率。', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80', 'CN', '["taobao","tmall","detail"]', '["中文"]', 6, '30分钟内', '工作日 10-20点', 4.86, 79, 4.9, 4.85, 4.8),
    ('Jing Xu',          '5年品牌视觉',                               '完整的品牌视觉系统设计。Logo、VI手册、应用规范。', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'CN', '["branding","vi","identity"]', '["中文","English"]', 5, '1小时内', '工作日 10-19点', 4.84, 58, 4.85, 4.85, 4.75),
    ('Tian Huang',       '7年角色设计',                               '原创IP角色设计、表情包、周边商品。', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', 'CN', '["character","ip","sticker"]', '["中文"]', 7, '2小时内', '工作日 14-23点', 4.89, 86, 4.9, 4.95, 4.8),
    ('Lan Zhao',         '8年包装与展示',                             '产品包装和零售展示设计。蜂窝纸板专精。', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80', 'CN', '["packaging","display","honeycomb"]', '["中文","English"]', 8, '1小时内', '工作日 9-18点', 4.91, 94, 4.95, 4.9, 4.85),

    -- ──────────── SAUDI ARABIA (SA) — 10 designers ────────────
    ('Ahmed Al-Saud',    'مصمم هويات بصرية · 9 سنوات',                'خبرة 9 سنوات في تصميم الهويات البصرية للشركات السعودية والخليجية. تركيز على الأصالة العربية الحديثة.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', 'SA', '["logo","branding","arabic"]', '["العربية","English"]', 9, 'خلال ساعة', 'الأحد-الخميس 9-18', 4.92, 78, 4.95, 4.9, 4.85),
    ('Fatima Al-Mansour','مصممة عبوات · 6 سنوات',                    'تصميم عبوات منتجات الجمال والأطعمة. ملف جاهز للطباعة.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'SA', '["packaging","beauty","food"]', '["العربية","English"]', 6, 'خلال ساعتين', 'الأحد-الخميس 10-18', 4.86, 53, 4.9, 4.85, 4.8),
    ('Mohammed Al-Rashid','مصمم ويب · 7 سنوات',                      'تصميم وتطوير واجهات الويب والتطبيقات. خبرة في المتاجر الإلكترونية.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'SA', '["web","ui","ecommerce"]', '["العربية","English"]', 7, 'خلال ساعة', 'الأحد-الخميس 9-19', 4.88, 67, 4.9, 4.9, 4.8),
    ('Layla Al-Otaibi',  'مصممة محتوى رقمي · 5 سنوات',                'محتوى السوشيال ميديا والإعلانات الرقمية. متابعة ترندات العالم العربي.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'SA', '["sns","ads","digital"]', '["العربية","English"]', 5, 'خلال ساعة', 'يوميًا 10-22', 4.83, 49, 4.85, 4.8, 4.75),
    ('Khalid Al-Harbi',  'مصمم لافتات · 10 سنوات',                    'تصميم اللافتات التجارية والمعارض. خبرة في الإنتاج الميداني.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'SA', '["signage","exhibition","outdoor"]', '["العربية"]', 10, 'خلال ساعة', 'الأحد-الخميس 8-17', 4.94, 96, 4.95, 4.95, 4.9),
    ('Noura Al-Qahtani', 'مصممة كتالوجات · 4 سنوات',                  'تصميم الكتالوجات والمطبوعات الشركاتية باللغة العربية والإنجليزية.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', 'SA', '["catalog","brochure","print"]', '["العربية","English"]', 4, 'خلال ساعتين', 'الأحد-الخميس 10-18', 4.78, 41, 4.8, 4.8, 4.7),
    ('Omar Al-Zahrani',  'مصمم شعارات · 6 سنوات',                    'شعارات حصرية وأصلية بأسلوب عصري. خبرة في الأسواق العربية.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', 'SA', '["logo","brandmark"]', '["العربية","English"]', 6, 'خلال 30 دقيقة', 'الأحد-الخميس 9-18', 4.89, 71, 4.9, 4.95, 4.8),
    ('Hessa Al-Subaie',  'مصممة رسوم توضيحية · 5 سنوات',              'رسوم توضيحية رقمية وتقليدية. كتب أطفال، مجلات، إعلانات.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'SA', '["illustration","editorial","children"]', '["العربية","English"]', 5, 'خلال ساعتين', 'الأحد-الخميس 14-22', 4.85, 56, 4.85, 4.9, 4.75),
    ('Saud Al-Ghamdi',   'مصمم متاجر إلكترونية · 7 سنوات',            'تصميم صفحات منتجات للمتاجر العربية. تركيز على معدلات التحويل.', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', 'SA', '["ecommerce","detail","conversion"]', '["العربية","English"]', 7, 'خلال ساعة', 'الأحد-الخميس 10-19', 4.87, 64, 4.9, 4.85, 4.85),
    ('Reem Al-Dosari',   'مصممة هوية مطاعم · 6 سنوات',                'هويات بصرية للمطاعم والكافيهات. من الشعار إلى قائمة الطعام.', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', 'SA', '["restaurant","menu","branding"]', '["العربية","English"]', 6, 'خلال ساعة', 'الأحد-الخميس 11-19', 4.9, 73, 4.9, 4.95, 4.85),

    -- ──────────── SPAIN (ES) — 10 designers ────────────
    ('Diego García',     'Diseñador de marca · 8 años',              'Especializado en branding para startups españolas y latinoamericanas. Proceso colaborativo.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', 'ES', '["logo","branding","identity"]', '["Español","English"]', 8, 'en 1 hora', 'L-V 9-18 CET', 4.9, 82, 4.9, 4.95, 4.85),
    ('María López',      'Diseñadora editorial · 7 años',            'Maquetación de libros, revistas y catálogos. Dominio de InDesign y tipografía.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'ES', '["editorial","print","typography"]', '["Español","English"]', 7, 'en 1 hora', 'L-V 10-18 CET', 4.88, 69, 4.9, 4.9, 4.8),
    ('Pablo Martínez',   'Diseñador web · 6 años',                   'UI/UX para empresas españolas. Figma y diseño responsive.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'ES', '["web","ui","figma"]', '["Español","English"]', 6, 'en 1 hora', 'L-V 9-19 CET', 4.86, 58, 4.85, 4.9, 4.8),
    ('Carmen Rodríguez', 'Ilustradora · 5 años',                     'Ilustraciones editoriales, infantiles y de moda. Estilo personal y reconocible.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'ES', '["illustration","editorial","fashion"]', '["Español","English","French"]', 5, 'en 2 horas', 'L-V 11-19 CET', 4.84, 51, 4.85, 4.85, 4.75),
    ('Javier Sánchez',   'Packaging y etiquetado · 9 años',          'Packaging para vinos, gourmet y cosmética. Conexión con imprentas locales.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'ES', '["packaging","wine","gourmet"]', '["Español","English","Italian"]', 9, 'en 30 min', 'L-V 9-18 CET', 4.93, 91, 4.95, 4.95, 4.85),
    ('Lucía Pérez',      'Diseño SNS y publicidad · 4 años',         'Contenido para Instagram, TikTok y campañas pagadas.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'ES', '["sns","ads","instagram"]', '["Español","English"]', 4, 'en 1 hora', 'L-V 10-20 CET', 4.79, 43, 4.8, 4.8, 4.7),
    ('Antonio Ruiz',     'Diseñador de stands · 10 años',            'Stands para ferias y eventos. Especialista en cartón nido de abeja.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'ES', '["booth","exhibition","honeycomb"]', '["Español","English"]', 10, 'en 1 hora', 'L-V 9-18 CET', 4.94, 108, 4.95, 4.95, 4.9),
    ('Elena Jiménez',    'E-commerce y Shopify · 6 años',            'Diseño de tiendas online y páginas de producto para mercado europeo.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80', 'ES', '["shopify","ecommerce","product"]', '["Español","English"]', 6, 'en 1 hora', 'L-V 10-19 CET', 4.87, 65, 4.9, 4.85, 4.85),
    ('Sergio Moreno',    'Logo y marca · 5 años',                    'Logotipos memorables para pymes. Vectorial, escalable, eterno.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', 'ES', '["logo","brandmark"]', '["Español","English"]', 5, 'en 30 min', 'L-V 9-18 CET', 4.85, 54, 4.9, 4.85, 4.8),
    ('Andrea Fernández', 'Diseño de personajes · 6 años',            'Creación de personajes para marcas, libros infantiles y animación.', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', 'ES', '["character","children","animation"]', '["Español","English"]', 6, 'en 2 horas', 'L-V 11-19 CET', 4.88, 67, 4.9, 4.9, 4.8),

    -- ──────────── GERMANY (DE) — 10 designers ────────────
    ('Lukas Müller',     'Brand designer · 9 Jahre',                 'Markenidentität für deutsche Mittelständler und Startups. Klar, präzise, langlebig.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', 'DE', '["logo","branding","identity"]', '["Deutsch","English"]', 9, 'innerhalb 1 Std.', 'Mo-Fr 9-18 MEZ', 4.94, 96, 4.95, 4.95, 4.9),
    ('Hannah Schmidt',   'Editorial designer · 7 Jahre',             'Magazinlayouts, Geschäftsberichte, Bücher. InDesign-Spezialistin.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'DE', '["editorial","print","reports"]', '["Deutsch","English"]', 7, 'innerhalb 1 Std.', 'Mo-Fr 10-18 MEZ', 4.9, 74, 4.95, 4.9, 4.85),
    ('Felix Fischer',    'UI/UX Designer · 6 Jahre',                 'Web- und App-Design für SaaS und E-Commerce. Figma & Design Systems.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'DE', '["web","ui","figma"]', '["Deutsch","English"]', 6, 'innerhalb 1 Std.', 'Mo-Fr 9-19 MEZ', 4.88, 67, 4.9, 4.9, 4.8),
    ('Sophie Weber',     'Verpackungsdesign · 5 Jahre',              'Verpackungsdesign für Bio-Marken und Lebensmittel. Nachhaltigkeit im Fokus.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'DE', '["packaging","bio","sustainable"]', '["Deutsch","English"]', 5, 'innerhalb 2 Std.', 'Mo-Fr 9-17 MEZ', 4.86, 58, 4.85, 4.9, 4.8),
    ('Maximilian Wagner','Logo & Brand · 8 Jahre',                   'Minimalistische Logos im deutschen Funktionalismus. Klare Konzepte.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', 'DE', '["logo","minimal","brand"]', '["Deutsch","English","French"]', 8, 'innerhalb 30 Min.', 'Mo-Fr 9-18 MEZ', 4.92, 88, 4.95, 4.95, 4.85),
    ('Lena Becker',      'SNS & Werbung · 4 Jahre',                  'Instagram- und Facebook-Werbedesigns für deutsche Marken.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'DE', '["sns","instagram","ads"]', '["Deutsch","English"]', 4, 'innerhalb 1 Std.', 'Mo-Fr 10-19 MEZ', 4.81, 47, 4.85, 4.8, 4.75),
    ('Jonas Hoffmann',   'Messestand-Designer · 10 Jahre',           'Messestände und Ausstellungssysteme. Spezialist für Wabenkartone.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'DE', '["booth","exhibition","honeycomb"]', '["Deutsch","English"]', 10, 'innerhalb 1 Std.', 'Mo-Fr 9-17 MEZ', 4.95, 112, 4.95, 4.95, 4.95),
    ('Mia Schäfer',      'Illustratorin · 6 Jahre',                  'Editorial- und Kinderbuchillustration. Aquarell- und Digitalstil.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'DE', '["illustration","editorial","children"]', '["Deutsch","English"]', 6, 'innerhalb 2 Std.', 'Mo-Fr 11-19 MEZ', 4.87, 63, 4.9, 4.9, 4.8),
    ('Tobias Koch',      'E-Commerce-Designer · 7 Jahre',            'Shopify- und WooCommerce-Designs für deutsche Onlineshops.', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', 'DE', '["shopify","ecommerce","woocommerce"]', '["Deutsch","English"]', 7, 'innerhalb 1 Std.', 'Mo-Fr 10-19 MEZ', 4.89, 71, 4.9, 4.9, 4.85),
    ('Laura Bauer',      'Buchgestalterin · 5 Jahre',                'Buchcover und Innenlayout für Verlage und Self-Publisher.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', 'DE', '["book","cover","publishing"]', '["Deutsch","English"]', 5, 'innerhalb 2 Std.', 'Mo-Fr 10-18 MEZ', 4.85, 54, 4.85, 4.9, 4.75),

    -- ──────────── FRANCE (FR) — 10 designers ────────────
    ('Lucas Dubois',     'Designer de marque · 8 ans',               'Identité visuelle pour startups et marques françaises. Approche minimaliste et élégante.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', 'FR', '["logo","branding","identity"]', '["Français","English"]', 8, 'sous 1 heure', 'L-V 9-18 CET', 4.93, 89, 4.95, 4.95, 4.85),
    ('Camille Bernard',  'Directrice artistique · 9 ans',            'Direction artistique pour magazines et marques de mode parisiennes.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', 'FR', '["editorial","fashion","art_direction"]', '["Français","English","Italian"]', 9, 'sous 1 heure', 'L-V 10-18 CET', 4.91, 96, 4.95, 4.9, 4.85),
    ('Hugo Petit',       'Designer web · 6 ans',                     'UI/UX pour SaaS et sites e-commerce. Figma et code (HTML/CSS).', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', 'FR', '["web","ui","figma"]', '["Français","English"]', 6, 'sous 1 heure', 'L-V 9-19 CET', 4.87, 64, 4.9, 4.85, 4.8),
    ('Léa Robert',       'Illustratrice · 7 ans',                    'Illustrations éditoriales, livres jeunesse, packaging. Style aquarelle distinctif.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'FR', '["illustration","children","watercolor"]', '["Français","English"]', 7, 'sous 2 heures', 'L-V 11-19 CET', 4.9, 78, 4.9, 4.95, 4.8),
    ('Antoine Richard',  'Designer packaging · 5 ans',               'Packaging pour vins, parfums et produits de luxe français.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', 'FR', '["packaging","luxury","wine"]', '["Français","English"]', 5, 'sous 1 heure', 'L-V 9-18 CET', 4.86, 57, 4.9, 4.85, 4.8),
    ('Manon Durand',     'Designer SNS · 4 ans',                     'Création visuelle pour Instagram, TikTok et campagnes publicitaires.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', 'FR', '["sns","instagram","ads"]', '["Français","English"]', 4, 'sous 1 heure', 'L-V 10-20 CET', 4.8, 46, 4.85, 4.8, 4.75),
    ('Théo Moreau',      'Designer logo · 6 ans',                    'Logotypes audacieux et mémorables pour entrepreneurs.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', 'FR', '["logo","brandmark"]', '["Français","English"]', 6, 'sous 30 min', 'L-V 9-18 CET', 4.88, 71, 4.9, 4.9, 4.8),
    ('Chloé Laurent',    'Designer print · 8 ans',                   'Brochures, catalogues, rapports annuels. Maîtrise InDesign et impression.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', 'FR', '["print","brochure","catalog"]', '["Français","English"]', 8, 'sous 1 heure', 'L-V 9-18 CET', 4.92, 84, 4.95, 4.9, 4.85),
    ('Nathan Simon',     'Designer de stands · 10 ans',              'Stands d''exposition et displays en carton alvéolé. Production rapide.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', 'FR', '["booth","exhibition","honeycomb"]', '["Français","English"]', 10, 'sous 1 heure', 'L-V 9-17 CET', 4.94, 105, 4.95, 4.95, 4.9),
    ('Emma Michel',      'Designer e-commerce · 7 ans',              'Pages produits Shopify et Prestashop pour le marché européen.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80', 'FR', '["ecommerce","shopify","prestashop"]', '["Français","English"]', 7, 'sous 1 heure', 'L-V 10-19 CET', 4.89, 73, 4.9, 4.9, 4.85)

) AS s(name, bio, intro, photo, country, specialties, languages, years_exp, response_time, contact_hours, rating, reviews, comm_rating, qual_rating, spd_rating)
WHERE NOT EXISTS (
    SELECT 1 FROM public.designer_profiles
    WHERE display_name = s.name AND is_demo = true
);

-- Fix the broken sample gig thumbnail (Unsplash photo 404)
UPDATE public.designer_gigs
    SET thumbnail = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80'
WHERE thumbnail = 'https://images.unsplash.com/photo-1606293459416-6b88c2e8c3eb?w=800&q=80';

-- Diagnostic
DO $$
DECLARE _demo_count int; _total int;
BEGIN
    SELECT COUNT(*) INTO _demo_count FROM public.designer_profiles WHERE is_demo = true;
    SELECT COUNT(*) INTO _total FROM public.designer_profiles WHERE is_active = true;
    RAISE NOTICE 'Demo seed complete: % demo designers (out of % total active)', _demo_count, _total;
END;
$$;
