-- ═══════════════════════════════════════════════════════════════
-- Seed: 160 demo design requests (20 per country × 8 countries)
-- ═══════════════════════════════════════════════════════════════
-- Run after seed_demo_designers.sql so the demo customer pool exists.
-- Each batch of 20 has a mix:
--   - 6 open (모집중)
--   - 4 in_progress (진행중)
--   - 4 completed (진행완료)
--   - 6 closed (마감) — shows the red CLOSED badge
--
-- We use a synthetic customer_id (gen_random_uuid()) marked is_demo
-- via a sentinel in the title prefix so we can identify and clean up.
-- The FK on customer_id → auth.users(id) is dropped first.

-- 1) Drop FK if it exists (one-time, idempotent)
ALTER TABLE public.design_requests
    DROP CONSTRAINT IF EXISTS design_requests_customer_id_fkey;

-- 2) Add a 'closed' status if the existing CHECK constraint is too strict
-- (some installs use a CHECK constraint that excludes 'closed').
-- This is a no-op if already permissive.
DO $$ BEGIN
    ALTER TABLE public.design_requests DROP CONSTRAINT IF EXISTS design_requests_status_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3) Add is_demo flag to design_requests so we can filter/clean up later
ALTER TABLE public.design_requests
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 4) Insert 160 demo requests
WITH demo_data AS (
    SELECT * FROM (VALUES
    -- ──────────────── KOREA (KR) ────────────────
    ('KR', 'open',        '카페 브랜드 로고 디자인 의뢰', '신규 오픈하는 디저트 카페 로고 작업이 필요합니다. 미니멀하고 따뜻한 느낌으로 부탁드려요.', '로고', 300000, 500000),
    ('KR', 'open',        '회사 명함 100매 디자인', '스타트업 명함 디자인 의뢰합니다. 양면, CMYK로 인쇄 가능하도록.', '명함', 50000, 100000),
    ('KR', 'open',        '인스타그램 광고 배너 5종', '의류 브랜드 SS시즌 광고 배너 5종이 필요합니다.', '배너', 200000, 400000),
    ('KR', 'open',        '신제품 출시 상세페이지', '화장품 신제품 상세페이지 제작 의뢰합니다.', '리플릿', 400000, 800000),
    ('KR', 'open',        '회사 브로슈어 8페이지', 'IT 솔루션 회사 회사소개서 브로슈어 8페이지 디자인.', '리플릿', 500000, 900000),
    ('KR', 'open',        '식당 메뉴판 리디자인', '한식당 메뉴판 리디자인 의뢰. A3 양면, 단품 30종.', '전단지', 150000, 300000),
    ('KR', 'in_progress', '브랜드 패키지 박스 디자인', '수제 쿠키 박스 패키지 디자인 진행중입니다.', '기타', 600000, 1000000),
    ('KR', 'in_progress', '팝업스토어 허니콤보드 디자인', '강남 팝업스토어 허니콤보드 디스플레이 디자인 진행중.', '허니콤보드-가벽', 1500000, 2500000),
    ('KR', 'in_progress', '유튜브 채널 썸네일 10종', '뷰티 유튜버 썸네일 10종 작업중.', '배너', 200000, 400000),
    ('KR', 'in_progress', '온라인 쇼핑몰 메인 디자인', '여성의류 쇼핑몰 메인페이지 리뉴얼.', '리플릿', 800000, 1200000),
    ('KR', 'completed',   '회사 연간 보고서 디자인', '연간 보고서 60페이지 디자인 완료.', '리플릿', 1500000, 2000000),
    ('KR', 'completed',   '신제품 런칭 배너 디자인', '런칭 배너 작업 완료.', '배너', 300000, 500000),
    ('KR', 'completed',   '카페 메뉴판 + 명함 세트', '카페 BI 작업 완료.', '명함', 400000, 700000),
    ('KR', 'completed',   '전시회 부스 글씨스카시', '코엑스 전시회 글씨스카시 작업 완료.', '허니콤보드-글씨스카시', 800000, 1200000),
    ('KR', 'closed',      '결혼식 청첩장 디자인 의뢰', '결혼식 청첩장 디자인이 필요합니다. (마감됨)', '명함', 100000, 200000),
    ('KR', 'closed',      '학원 광고 전단지 의뢰', '영어학원 전단지 5000매 의뢰. (마감됨)', '전단지', 200000, 400000),
    ('KR', 'closed',      '병원 간판 디자인 의뢰', '치과 간판 디자인 의뢰. (마감됨)', '기타', 500000, 800000),
    ('KR', 'closed',      '스타트업 BI 패키지', '스타트업 BI 풀 패키지 의뢰. (마감됨)', '로고', 1500000, 2500000),
    ('KR', 'closed',      '회사 소개 영상 썸네일', '회사 홍보 영상 썸네일 의뢰. (마감됨)', '배너', 150000, 300000),
    ('KR', 'closed',      '학회 포스터 디자인', '학술대회 포스터 의뢰. (마감됨)', '리플릿', 200000, 400000),

    -- ──────────────── JAPAN (JP) ────────────────
    ('JP', 'open',        'カフェのロゴデザイン依頼', '新規オープンする和カフェのロゴ作業をお願いします。和モダンな雰囲気でお願いします。', '로고', 300000, 500000),
    ('JP', 'open',        '名刺デザインのご依頼', '新会社の名刺デザインをお願いします。シンプルで上品なデザイン希望。', '명함', 50000, 100000),
    ('JP', 'open',        'インスタグラム広告バナー', 'アパレルブランドの春夏キャンペーン用バナー5種。', '배너', 200000, 400000),
    ('JP', 'open',        '商品ランディングページ', '化粧品の新商品LPデザイン依頼。', '리플릿', 400000, 800000),
    ('JP', 'open',        '会社案内パンフレット', 'IT会社の8ページパンフレット制作。', '리플릿', 500000, 900000),
    ('JP', 'open',        'レストランメニュー', '和食レストランのメニュー表デザイン。', '전단지', 150000, 300000),
    ('JP', 'in_progress', '商品パッケージデザイン', '手作り菓子の箱パッケージ進行中。', '기타', 600000, 1000000),
    ('JP', 'in_progress', 'ポップアップ展示デザイン', '渋谷ポップアップ展示デザイン進行中。', '허니콤보드-가벽', 1500000, 2500000),
    ('JP', 'in_progress', 'YouTubeサムネイル10種', 'ビューティYouTuberサムネイル進行中。', '배너', 200000, 400000),
    ('JP', 'in_progress', 'オンラインショップメイン', '女性ファッションサイトメインリニューアル。', '리플릿', 800000, 1200000),
    ('JP', 'completed',   '年次報告書デザイン', '60ページの年次報告書デザイン完了。', '리플릿', 1500000, 2000000),
    ('JP', 'completed',   '新商品ローンチバナー', 'ローンチバナー作業完了。', '배너', 300000, 500000),
    ('JP', 'completed',   'カフェメニュー＋名刺', 'カフェBI作業完了。', '명함', 400000, 700000),
    ('JP', 'completed',   '展示会ブース文字看板', '東京ビッグサイト展示会作業完了。', '허니콤보드-글씨스카시', 800000, 1200000),
    ('JP', 'closed',      '結婚式招待状デザイン', '結婚式招待状デザインが必要です。（締切済）', '명함', 100000, 200000),
    ('JP', 'closed',      '学習塾の広告チラシ', '英語学習塾チラシ5000部依頼。（締切済）', '전단지', 200000, 400000),
    ('JP', 'closed',      'クリニック看板デザイン', '歯科クリニック看板依頼。（締切済）', '기타', 500000, 800000),
    ('JP', 'closed',      'スタートアップBIパッケージ', 'スタートアップBIフルパッケージ。（締切済）', '로고', 1500000, 2500000),
    ('JP', 'closed',      '会社紹介動画サムネイル', '会社PR動画サムネイル依頼。（締切済）', '배너', 150000, 300000),
    ('JP', 'closed',      '学会ポスターデザイン', '学術大会ポスター依頼。（締切済）', '리플릿', 200000, 400000),

    -- ──────────────── USA (US) ────────────────
    ('US', 'open',        'Coffee Shop Logo Design', 'Need a logo for a new specialty coffee shop. Modern, warm, hand-drawn feel.', '로고', 300000, 500000),
    ('US', 'open',        'Business Card Design', 'Looking for a clean business card design for a tech startup. Two-sided, CMYK ready.', '명함', 50000, 100000),
    ('US', 'open',        'Instagram Ad Banner Set', 'Need 5 Instagram ads for our SS apparel collection.', '배너', 200000, 400000),
    ('US', 'open',        'Product Detail Page', 'Skincare product detail page design needed.', '리플릿', 400000, 800000),
    ('US', 'open',        'Company Brochure 8 Pages', 'B2B SaaS company 8-page brochure design.', '리플릿', 500000, 900000),
    ('US', 'open',        'Restaurant Menu Redesign', 'Mexican restaurant menu redesign. A3 double-sided, 30 dishes.', '전단지', 150000, 300000),
    ('US', 'in_progress', 'Product Packaging Box', 'Artisan cookie box packaging in progress.', '기타', 600000, 1000000),
    ('US', 'in_progress', 'Pop-up Store Display', 'Manhattan pop-up store honeycomb display in progress.', '허니콤보드-가벽', 1500000, 2500000),
    ('US', 'in_progress', 'YouTube Thumbnails 10x', 'Beauty YouTuber thumbnails in progress.', '배너', 200000, 400000),
    ('US', 'in_progress', 'E-commerce Main Page', 'Women''s fashion store homepage redesign.', '리플릿', 800000, 1200000),
    ('US', 'completed',   'Annual Report Design', '60-page annual report design completed.', '리플릿', 1500000, 2000000),
    ('US', 'completed',   'Product Launch Banner', 'Launch banner work completed.', '배너', 300000, 500000),
    ('US', 'completed',   'Cafe Menu + Cards Set', 'Cafe BI work completed.', '명함', 400000, 700000),
    ('US', 'completed',   'Trade Show Signage', 'Las Vegas trade show signage completed.', '허니콤보드-글씨스카시', 800000, 1200000),
    ('US', 'closed',      'Wedding Invitation Design', 'Need wedding invitation design. (Closed)', '명함', 100000, 200000),
    ('US', 'closed',      'Tutoring Center Flyer', 'English tutoring center 5000 flyers. (Closed)', '전단지', 200000, 400000),
    ('US', 'closed',      'Dental Clinic Signage', 'Dental clinic signage. (Closed)', '기타', 500000, 800000),
    ('US', 'closed',      'Startup Brand Package', 'Full startup BI package. (Closed)', '로고', 1500000, 2500000),
    ('US', 'closed',      'Promo Video Thumbnail', 'Company promo video thumbnail. (Closed)', '배너', 150000, 300000),
    ('US', 'closed',      'Conference Poster', 'Academic conference poster. (Closed)', '리플릿', 200000, 400000),

    -- ──────────────── CHINA (CN) ────────────────
    ('CN', 'open',        '咖啡店标志设计', '新开业的精品咖啡店标志设计需求。现代、温暖的感觉。', '로고', 300000, 500000),
    ('CN', 'open',        '公司名片设计', '科技初创公司名片设计。简洁双面CMYK。', '명함', 50000, 100000),
    ('CN', 'open',        '小红书广告横幅5种', '服装品牌春夏季广告横幅。', '배너', 200000, 400000),
    ('CN', 'open',        '新产品详情页', '化妆品新品详情页设计。', '리플릿', 400000, 800000),
    ('CN', 'open',        '公司宣传册8页', 'IT解决方案公司8页宣传册。', '리플릿', 500000, 900000),
    ('CN', 'open',        '餐厅菜单重新设计', '中餐厅菜单A3双面30道菜。', '전단지', 150000, 300000),
    ('CN', 'in_progress', '产品包装盒设计', '手工饼干礼盒包装进行中。', '기타', 600000, 1000000),
    ('CN', 'in_progress', '快闪店蜂窝展示', '上海快闪店蜂窝板展示设计中。', '허니콤보드-가벽', 1500000, 2500000),
    ('CN', 'in_progress', 'B站缩略图10种', '美妆UP主缩略图设计中。', '배너', 200000, 400000),
    ('CN', 'in_progress', '电商主页设计', '女装电商主页改版。', '리플릿', 800000, 1200000),
    ('CN', 'completed',   '年度报告设计', '60页年度报告设计完成。', '리플릿', 1500000, 2000000),
    ('CN', 'completed',   '新品发布横幅', '发布横幅工作完成。', '배너', 300000, 500000),
    ('CN', 'completed',   '咖啡店菜单+名片', '咖啡店BI完成。', '명함', 400000, 700000),
    ('CN', 'completed',   '展会展位文字招牌', '上海展会文字招牌完成。', '허니콤보드-글씨스카시', 800000, 1200000),
    ('CN', 'closed',      '婚礼请柬设计', '婚礼请柬设计需求。（已截止）', '명함', 100000, 200000),
    ('CN', 'closed',      '培训中心传单', '英语培训中心5000份传单。（已截止）', '전단지', 200000, 400000),
    ('CN', 'closed',      '诊所招牌设计', '牙科诊所招牌。（已截止）', '기타', 500000, 800000),
    ('CN', 'closed',      '初创公司品牌套装', '初创BI完整套装。（已截止）', '로고', 1500000, 2500000),
    ('CN', 'closed',      '宣传视频缩略图', '公司宣传视频缩略图。（已截止）', '배너', 150000, 300000),
    ('CN', 'closed',      '会议海报设计', '学术会议海报。（已截止）', '리플릿', 200000, 400000),

    -- ──────────────── SAUDI (SA) ────────────────
    ('SA', 'open',        'تصميم شعار مقهى', 'مطلوب تصميم شعار لمقهى متخصص جديد. حديث ودافئ.', '로고', 300000, 500000),
    ('SA', 'open',        'تصميم بطاقات العمل', 'تصميم بطاقات عمل لشركة ناشئة. بسيط ومحترم.', '명함', 50000, 100000),
    ('SA', 'open',        'بنرات إعلانية إنستغرام', '5 بنرات إعلانية لمجموعة ملابس صيفية.', '배너', 200000, 400000),
    ('SA', 'open',        'صفحة تفاصيل المنتج', 'تصميم صفحة تفاصيل منتجات تجميلية.', '리플릿', 400000, 800000),
    ('SA', 'open',        'كتيب الشركة 8 صفحات', 'كتيب 8 صفحات لشركة حلول رقمية.', '리플릿', 500000, 900000),
    ('SA', 'open',        'إعادة تصميم قائمة طعام', 'قائمة مطعم سعودي A3 وجهين 30 طبق.', '전단지', 150000, 300000),
    ('SA', 'in_progress', 'تصميم عبوة منتج', 'عبوة بسكويت يدوي قيد التنفيذ.', '기타', 600000, 1000000),
    ('SA', 'in_progress', 'متجر مؤقت لوحة عرض', 'متجر مؤقت في الرياض، لوحات قيد التنفيذ.', '허니콤보드-가벽', 1500000, 2500000),
    ('SA', 'in_progress', 'صور مصغرة لـ10 فيديوهات', 'صور مصغرة ليوتيوبر تجميل قيد العمل.', '배너', 200000, 400000),
    ('SA', 'in_progress', 'صفحة رئيسية للتسوق', 'إعادة تصميم متجر أزياء نسائية.', '리플릿', 800000, 1200000),
    ('SA', 'completed',   'تصميم تقرير سنوي', 'تقرير سنوي 60 صفحة مكتمل.', '리플릿', 1500000, 2000000),
    ('SA', 'completed',   'بانر إطلاق منتج', 'بانر إطلاق مكتمل.', '배너', 300000, 500000),
    ('SA', 'completed',   'قائمة مقهى وبطاقات', 'هوية مقهى مكتملة.', '명함', 400000, 700000),
    ('SA', 'completed',   'لافتات معرض', 'لافتات معرض الرياض مكتملة.', '허니콤보드-글씨스카시', 800000, 1200000),
    ('SA', 'closed',      'تصميم دعوة زفاف', 'دعوة زفاف. (مغلق)', '명함', 100000, 200000),
    ('SA', 'closed',      'منشورات مركز تعليم', 'مركز تعليم لغات 5000 منشور. (مغلق)', '전단지', 200000, 400000),
    ('SA', 'closed',      'لافتة عيادة أسنان', 'لافتة عيادة أسنان. (مغلق)', '기타', 500000, 800000),
    ('SA', 'closed',      'حزمة هوية ناشئة', 'هوية كاملة لشركة ناشئة. (مغلق)', '로고', 1500000, 2500000),
    ('SA', 'closed',      'صورة مصغرة لفيديو', 'فيديو ترويجي للشركة. (مغلق)', '배너', 150000, 300000),
    ('SA', 'closed',      'ملصق مؤتمر', 'ملصق مؤتمر علمي. (مغلق)', '리플릿', 200000, 400000),

    -- ──────────────── SPAIN (ES) ────────────────
    ('ES', 'open',        'Logo para Cafetería', 'Necesito un logo para una nueva cafetería de especialidad. Estilo moderno y cálido.', '로고', 300000, 500000),
    ('ES', 'open',        'Tarjetas de Visita', 'Diseño limpio para startup tecnológica. Doble cara CMYK.', '명함', 50000, 100000),
    ('ES', 'open',        'Banners Instagram x5', '5 banners para colección primavera-verano.', '배너', 200000, 400000),
    ('ES', 'open',        'Página de Producto', 'Página de detalle para producto cosmético.', '리플릿', 400000, 800000),
    ('ES', 'open',        'Folleto Empresa 8 pág.', 'Folleto de 8 páginas para empresa de software.', '리플릿', 500000, 900000),
    ('ES', 'open',        'Rediseño Menú Restaurante', 'Menú de restaurante español A3 doble cara.', '전단지', 150000, 300000),
    ('ES', 'in_progress', 'Packaging Galletas', 'Packaging para galletas artesanas en curso.', '기타', 600000, 1000000),
    ('ES', 'in_progress', 'Display Pop-up Store', 'Tienda emergente Madrid en curso.', '허니콤보드-가벽', 1500000, 2500000),
    ('ES', 'in_progress', 'Miniaturas YouTube x10', 'Miniaturas para YouTuber de belleza.', '배너', 200000, 400000),
    ('ES', 'in_progress', 'Página Principal Tienda', 'Rediseño web tienda de moda.', '리플릿', 800000, 1200000),
    ('ES', 'completed',   'Memoria Anual', 'Memoria anual de 60 páginas completada.', '리플릿', 1500000, 2000000),
    ('ES', 'completed',   'Banner Lanzamiento', 'Banner de lanzamiento completado.', '배너', 300000, 500000),
    ('ES', 'completed',   'Menú + Tarjetas Café', 'BI cafetería completada.', '명함', 400000, 700000),
    ('ES', 'completed',   'Stand Feria Comercial', 'Stand IFEMA Madrid completado.', '허니콤보드-글씨스카시', 800000, 1200000),
    ('ES', 'closed',      'Invitaciones Boda', 'Invitaciones de boda. (Cerrado)', '명함', 100000, 200000),
    ('ES', 'closed',      'Folletos Academia', 'Academia inglés 5000 folletos. (Cerrado)', '전단지', 200000, 400000),
    ('ES', 'closed',      'Cartel Clínica Dental', 'Cartel clínica dental. (Cerrado)', '기타', 500000, 800000),
    ('ES', 'closed',      'Pack Marca Startup', 'Pack BI completo startup. (Cerrado)', '로고', 1500000, 2500000),
    ('ES', 'closed',      'Miniatura Vídeo Promo', 'Miniatura vídeo promocional. (Cerrado)', '배너', 150000, 300000),
    ('ES', 'closed',      'Póster Conferencia', 'Póster conferencia académica. (Cerrado)', '리플릿', 200000, 400000),

    -- ──────────────── GERMANY (DE) ────────────────
    ('DE', 'open',        'Logo für Café gesucht', 'Ich brauche ein Logo für ein neues Spezialitäten-Café. Modern und warm.', '로고', 300000, 500000),
    ('DE', 'open',        'Visitenkarten-Design', 'Sauberes Visitenkarten-Design für Tech-Startup. Doppelseitig CMYK.', '명함', 50000, 100000),
    ('DE', 'open',        'Instagram Werbebanner x5', '5 Banner für SS-Modekollektion.', '배너', 200000, 400000),
    ('DE', 'open',        'Produktdetailseite', 'Detailseite für Hautpflegeprodukt.', '리플릿', 400000, 800000),
    ('DE', 'open',        'Firmenbroschüre 8 Seiten', '8-seitige Broschüre für SaaS-Unternehmen.', '리플릿', 500000, 900000),
    ('DE', 'open',        'Restaurant-Menü Redesign', 'Deutsches Restaurant Menü A3 doppelseitig.', '전단지', 150000, 300000),
    ('DE', 'in_progress', 'Produktverpackung Box', 'Handwerks-Keksverpackung in Bearbeitung.', '기타', 600000, 1000000),
    ('DE', 'in_progress', 'Pop-up Store Display', 'Berlin Pop-up Store in Bearbeitung.', '허니콤보드-가벽', 1500000, 2500000),
    ('DE', 'in_progress', 'YouTube Thumbnails x10', 'Thumbnails für Beauty-YouTuber.', '배너', 200000, 400000),
    ('DE', 'in_progress', 'E-Commerce Hauptseite', 'Damenmode Online-Shop Redesign.', '리플릿', 800000, 1200000),
    ('DE', 'completed',   'Geschäftsbericht Design', '60-seitiger Geschäftsbericht abgeschlossen.', '리플릿', 1500000, 2000000),
    ('DE', 'completed',   'Produktlaunch Banner', 'Launch-Banner abgeschlossen.', '배너', 300000, 500000),
    ('DE', 'completed',   'Café Menü + Karten', 'Café BI abgeschlossen.', '명함', 400000, 700000),
    ('DE', 'completed',   'Messe-Beschilderung', 'Frankfurt Messe abgeschlossen.', '허니콤보드-글씨스카시', 800000, 1200000),
    ('DE', 'closed',      'Hochzeitseinladungen', 'Hochzeitseinladungen. (Geschlossen)', '명함', 100000, 200000),
    ('DE', 'closed',      'Sprachschule Flyer', 'Englisch-Sprachschule 5000 Flyer. (Geschlossen)', '전단지', 200000, 400000),
    ('DE', 'closed',      'Zahnarzt Schild', 'Zahnarztpraxis Schild. (Geschlossen)', '기타', 500000, 800000),
    ('DE', 'closed',      'Startup Brand Paket', 'Komplettes BI Startup. (Geschlossen)', '로고', 1500000, 2500000),
    ('DE', 'closed',      'Promo-Video Thumbnail', 'Firmen-Promo Video. (Geschlossen)', '배너', 150000, 300000),
    ('DE', 'closed',      'Konferenz-Poster', 'Wissenschafts-Konferenz. (Geschlossen)', '리플릿', 200000, 400000),

    -- ──────────────── FRANCE (FR) ────────────────
    ('FR', 'open',        'Logo pour Café', 'Recherche un logo pour un nouveau café de spécialité. Moderne et chaleureux.', '로고', 300000, 500000),
    ('FR', 'open',        'Cartes de Visite', 'Design propre pour startup tech. Double face CMYK.', '명함', 50000, 100000),
    ('FR', 'open',        'Bannières Instagram x5', '5 bannières pour collection printemps-été.', '배너', 200000, 400000),
    ('FR', 'open',        'Page Produit', 'Page de détail pour produit cosmétique.', '리플릿', 400000, 800000),
    ('FR', 'open',        'Brochure Entreprise 8p', 'Brochure 8 pages pour entreprise SaaS.', '리플릿', 500000, 900000),
    ('FR', 'open',        'Refonte Menu Restaurant', 'Menu restaurant français A3 recto-verso.', '전단지', 150000, 300000),
    ('FR', 'in_progress', 'Emballage Biscuits', 'Emballage biscuits artisanaux en cours.', '기타', 600000, 1000000),
    ('FR', 'in_progress', 'Pop-up Store Paris', 'Pop-up store Paris en cours.', '허니콤보드-가벽', 1500000, 2500000),
    ('FR', 'in_progress', 'Miniatures YouTube x10', 'Miniatures pour YouTubeuse beauté.', '배너', 200000, 400000),
    ('FR', 'in_progress', 'Page Accueil E-shop', 'Refonte boutique mode féminine.', '리플릿', 800000, 1200000),
    ('FR', 'completed',   'Rapport Annuel', 'Rapport annuel 60 pages terminé.', '리플릿', 1500000, 2000000),
    ('FR', 'completed',   'Bannière Lancement', 'Bannière de lancement terminée.', '배너', 300000, 500000),
    ('FR', 'completed',   'Menu + Cartes Café', 'BI café terminée.', '명함', 400000, 700000),
    ('FR', 'completed',   'Stand Salon', 'Stand Porte de Versailles terminé.', '허니콤보드-글씨스카시', 800000, 1200000),
    ('FR', 'closed',      'Faire-part Mariage', 'Faire-part de mariage. (Fermé)', '명함', 100000, 200000),
    ('FR', 'closed',      'Flyers École de Langues', 'École langues 5000 flyers. (Fermé)', '전단지', 200000, 400000),
    ('FR', 'closed',      'Enseigne Cabinet Dentaire', 'Enseigne cabinet dentaire. (Fermé)', '기타', 500000, 800000),
    ('FR', 'closed',      'Pack Identité Startup', 'Pack BI startup complet. (Fermé)', '로고', 1500000, 2500000),
    ('FR', 'closed',      'Miniature Vidéo Promo', 'Vidéo promo entreprise. (Fermé)', '배너', 150000, 300000),
    ('FR', 'closed',      'Affiche Conférence', 'Affiche conférence académique. (Fermé)', '리플릿', 200000, 400000)
    ) AS d(country, status, title, description, category, budget_min, budget_max)
)
INSERT INTO public.design_requests
    (customer_id, country, status, title, description, category,
     budget_min, budget_max, files, is_demo, created_at)
SELECT
    gen_random_uuid(),
    d.country,
    d.status,
    d.title,
    d.description,
    d.category,
    d.budget_min,
    d.budget_max,
    '[]'::jsonb,
    true,
    NOW() - (random() * interval '30 days')
FROM demo_data d
WHERE NOT EXISTS (
    SELECT 1 FROM public.design_requests
    WHERE title = d.title AND is_demo = true
);

-- Diagnostic
DO $$
DECLARE _demo_count int;
BEGIN
    SELECT COUNT(*) INTO _demo_count FROM public.design_requests WHERE is_demo = true;
    RAISE NOTICE 'Demo requests seeded: % rows', _demo_count;
END;
$$;
