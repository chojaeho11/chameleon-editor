// ================================================================
// Cloudflare Pages Worker
// 1. Bot pre-rendering: Google/Bing bots get rich HTML with images
// 2. OG tag rewriting: Social crawlers get correct OG meta per domain
// 3. SPA fallback: non-file paths serve index.html
// ================================================================

const BOT_UA = /googlebot|google-inspectiontool|bingbot|yandex|baiduspider|slurp|duckduckbot|msnbot|applebot|petalbot|yeti|daumoa|sogou|360spider|bytespider|qwant|seznambot|ia_archiver|archive\.org_bot|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|facebookexternalhit|twitterbot|linkedinbot|kakaotalk-scrap|line-scrap|whatsapp|telegrambot|slackbot|discordbot|pinterestbot|tumblr|embedly|quora link preview|outbrain|vkshare|w3c_validator/i;

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const PRERENDER_TOKEN = '2JsjKgGMzVH9qEqjkYam';

// SEO category → DB query mapping
const SEO_CATEGORIES = {
    honeycomb: { top: 'honeycomb_board' },
    'fabric-print': { top: '22222' },
    'paper-stand': { prefix: 'pd_' },
    goods: { top: '77777' },
    'acrylic-print': { prefix: 'acrylic' },
    'paper-furniture': { top: 'honeycomb_board' },
    'foamex-print': { prefix: 'PVC' },
    'foamboard-print': { prefix: 'Foam' },
    'foamex-stand': { prefix: 'foamex' },
    'biz-print': { prefix: 'pp_' },
    'promo-items': { top: '888999' },
    'tshirt-print': { top: '77777' },
    'banner-stand': { prefix: 'bn_' },
    standee: { prefix: 'hb_point' },
    curtain: { prefix: 'ct_' },
    'shopping-bag': { prefix: 'pp_sb' },
    'box-package': { prefix: 'box' },
    'rubber-magnet': { prefix: 'magnet' },
    'flex-sign': { prefix: 'fx_' },
    'blackout-blind': { prefix: 'bl_' },
    'flexible-package': { prefix: 'fp_' },
    placard: { prefix: 'placard' },
    'roll-blind': { prefix: 'rb_' },
};

// Multilingual SEO metadata for category pages (KR/JP/US)
const CATEGORY_SEO = {
    honeycomb: {
        KR: { title: '허니콤보드 인쇄·가벽·디스플레이 전문 | 카멜레온프린팅', desc: '허니콤보드 인쇄·가벽·등신대·전시부스 제작 전문. 친환경 100% 종이 허니콤보드, 1:1 맞춤 사이즈, 당일 출고 가능. 무료 디자인 에디터로 디자인부터 전국 배송까지.', keywords: '허니콤보드,허니콤보드 인쇄,허니콤 가벽,허니콤보드 가격,허니콤보드 사이즈,허니콤보드 제작,허니콤,종이가벽,종이매대,팝업스토어,등신대제작,전시부스,백월,친환경 인쇄,카멜레온프린팅' },
        JP: { title: 'ハニカムボード印刷 - エコ紙ディスプレイ | カメレオンプリンティング', desc: 'エコハニカムボードのカスタム印刷。ポップアップストア・展示ブース・店舗ディスプレイに最適。無料オンラインエディターでデザイン可能。', keywords: 'ハニカムボード,ハニカムボード印刷,紙ディスプレイ,ポップアップストア,エコ展示,展示ブース' },
        US: { title: 'Honeycomb Board Printing - Eco Cardboard Display | Chameleon Printing', desc: 'Custom eco-friendly Honeycomb Board printing. Perfect for pop-up stores, exhibition booths & retail displays. Free online design editor included.', keywords: 'Honeycomb Board,Honeycomb Board printing,Honeycomb Board exhibition booth,cardboard display,pop-up store display,eco display,exhibition booth,trade show display,retail display board' },
    },
    'fabric-print': {
        KR: { title: '패브릭 인쇄·천 인쇄·실사출력 전문 | 카멜레온프린팅', desc: '고화질 패브릭(천) 맞춤 인쇄. 광목·면포·옥스포드·쉬폰 등 다양한 원단. 백월·포토존 배경·현수막 천 제작. 무료 디자인 에디터 포함.', keywords: '패브릭인쇄,천인쇄,실사출력,광목인쇄,면포인쇄,옥스포드인쇄,쉬폰인쇄,백월,포토존 배경,현수막 천,배경막 인쇄,패브릭 배너,카멜레온프린팅' },
        JP: { title: 'ファブリック印刷 - 高画質布印刷 | カメレオンプリンティング', desc: '高画質ファブリック（布）カスタム印刷。バックウォール・フォトゾーン・背景幕に最適。無料デザインエディター付き。', keywords: 'ファブリック印刷,布印刷,バックウォール,フォトゾーン,背景幕,タペストリー印刷' },
        US: { title: 'Fabric Printing - High Quality Custom Cloth Print | Chameleon Printing', desc: 'High-resolution custom fabric printing. Ideal for backwalls, photo zones, backdrops & banners. Free online design editor available.', keywords: 'fabric printing,cloth printing,backwall,photo zone,backdrop printing,custom fabric,banner printing' },
    },
    'paper-stand': {
        KR: { title: '종이매대·종이 디스플레이·POP 진열대 제작 | 카멜레온프린팅', desc: '친환경 종이매대 맞춤 제작. 마트·편의점·매장 진열대 전문. 무료 에디터로 디자인, 전국 배송, 당일 출고 가능.', keywords: '종이매대,종이 디스플레이,POP 진열대,매장 진열대,종이 진열대,친환경 진열대,골판지 디스플레이,진열대 제작,종이가구,홍보 진열대' },
        JP: { title: '紙什器 制作 - エコPOPディスプレイ | カメレオンプリンティング', desc: 'エコ紙什器のカスタム制作。スーパー・コンビニ・店舗の陳列台に最適。無料エディターでデザイン、全国配送対応。', keywords: '紙什器,紙ディスプレイ,POP什器,店舗什器,エコ什器,段ボールディスプレイ' },
        US: { title: 'Cardboard Display Stand - Eco Cardboard POP Display | Chameleon Printing', desc: 'Custom eco-friendly cardboard display stands. Perfect for retail POP displays, stores & supermarkets. Free design editor, nationwide delivery.', keywords: 'cardboard display stand,cardboard display,POP display,retail display,eco display stand,point of purchase' },
    },
    goods: {
        KR: { title: '굿즈 제작·아크릴 키링·포토카드 인쇄 | 카멜레온프린팅', desc: '아크릴 굿즈 맞춤 제작. 키링·포토카드·아크릴 스탠드·뱃지·스마트톡. 무료 에디터로 디자인, 1개부터 주문 가능.', keywords: '굿즈제작,아크릴키링,포토카드,아크릴 스탠드,아크릴 뱃지,스마트톡,팬굿즈,아이돌굿즈,캐릭터굿즈,굿즈 인쇄,소량 굿즈' },
        JP: { title: 'アクリルグッズ制作 - キーホルダー・フォトカード | カメレオンプリンティング', desc: 'アクリルグッズのカスタム制作。キーホルダー・フォトカード・アクリルスタンド・バッジ。無料エディターでデザイン可能。', keywords: 'アクリルグッズ,アクリルキーホルダー,フォトカード,アクリルスタンド,バッジ制作,グッズ制作' },
        US: { title: 'Acrylic Goods - Keychains, Photo Cards & Stands | Chameleon Printing', desc: 'Custom acrylic goods. Keychains, photo cards, acrylic stands & badges. Design with free online editor, small orders welcome.', keywords: 'acrylic goods,acrylic keychain,photo card,acrylic stand,acrylic badge,custom goods,merchandise' },
    },
    'acrylic-print': {
        KR: { title: '아크릴 인쇄·UV 아크릴 간판·명패 제작 | 카멜레온프린팅', desc: '고품질 아크릴 UV 인쇄. 간판·명패·안내판·인테리어 소품. 무료 에디터, 다양한 두께·사이즈, 당일 출고.', keywords: '아크릴인쇄,UV아크릴,아크릴 간판,아크릴 명패,아크릴 안내판,아크릴 표찰,아크릴 액자,투명아크릴,UV프린팅,아크릴제작' },
        JP: { title: 'アクリル印刷 - UVアクリル看板 | カメレオンプリンティング', desc: '高品質アクリルUV印刷。看板・ネームプレート・案内板・インテリア小物。無料エディター、多様な厚さ・サイズ。', keywords: 'アクリル印刷,アクリル看板,UVアクリル,アクリル案内板,ネームプレート' },
        US: { title: 'Acrylic Printing - UV Acrylic Signs & Displays | Chameleon Printing', desc: 'High-quality acrylic UV printing. Signs, nameplates, information boards & interior decor. Free design editor, various sizes.', keywords: 'acrylic printing,acrylic sign,UV acrylic,acrylic display,nameplate,acrylic board' },
    },
    'paper-furniture': {
        KR: { title: '종이가구·골판지 가구·전시 가구 제작 | 카멜레온프린팅', desc: '친환경 종이가구 맞춤 제작. 전시·이벤트·팝업스토어용 테이블·의자·선반. 가볍고 튼튼한 골판지 가구.', keywords: '종이가구,골판지가구,친환경 가구,전시가구,팝업스토어 가구,이벤트 가구,종이 테이블,종이 의자,종이 선반,에코가구' },
        JP: { title: '紙家具 制作 - エコ段ボール家具 | カメレオンプリンティング', desc: 'エコ紙家具のカスタム制作。展示・イベント・ポップアップストア用テーブル・椅子・棚。軽量で丈夫な段ボール家具。', keywords: '紙家具,段ボール家具,エコ家具,展시家具,ポップアップストア家具,イベント家具' },
        US: { title: 'Paper Furniture - Eco Cardboard Furniture | Chameleon Printing', desc: 'Custom eco-friendly paper furniture. Tables, chairs & shelves for exhibitions, events & pop-up stores. Lightweight yet strong cardboard furniture.', keywords: 'paper furniture,cardboard furniture,eco furniture,exhibition furniture,pop-up store furniture,event furniture' },
    },
    'foamex-print': {
        KR: { title: '포맥스 인쇄·PVC 폼보드 간판 제작 | 카멜레온프린팅', desc: '고품질 포맥스(PVC 폼보드) 맞춤 인쇄. 간판·안내판·인테리어·전시용. 무료 디자인 에디터, 다양한 두께·사이즈.', keywords: '포맥스인쇄,포맥스간판,PVC폼보드,폼보드 인쇄,포맥스 제작,PVC 인쇄,포맥스 안내판,포맥스 사인,포맥스 가격,포맥스 사이즈' },
        JP: { title: 'フォーレックス印刷 - PVCフォームボード | カメレオンプリンティング', desc: '高品質フォーレックス（PVCフォームボード）カスタム印刷。看板・案内板・インテリア・展示用。無料デザインエディター付き。', keywords: 'フォーレックス印刷,PVCフォームボード,フォーレックス看板,案内板印刷,PVC印刷' },
        US: { title: 'Foamex Printing - PVC Foam Board Print | Chameleon Printing', desc: 'High-quality Foamex (PVC foam board) custom printing. Perfect for signs, displays, interior decor & exhibitions. Free design editor.', keywords: 'foamex printing,PVC foam board,foamex sign,foam board printing,PVC printing,display board' },
    },
    'foamboard-print': {
        KR: { title: '폼보드 인쇄·우드락 보드 제작 | 카멜레온프린팅', desc: '폼보드(우드락) 맞춤 인쇄. 전시·안내·POP·포토존 패널. 무료 에디터, 라미네이팅 옵션, 빠른 배송.', keywords: '폼보드인쇄,우드락,우드락 인쇄,폼보드 제작,포토존 패널,전시 보드,POP 보드,행사 보드,학교 발표 보드' },
        JP: { title: 'フォームボード印刷 - スチレンボード | カメレオンプリンティング', desc: 'フォームボード（スチレンボード）カスタム印刷。展示・案内・POP・フォトゾーンに最適。無料エディター、全国配送。', keywords: 'フォームボード印刷,スチレンボード,展示ボード,POPボード,パネル印刷' },
        US: { title: 'Foam Board Printing - Custom Display Board | Chameleon Printing', desc: 'Custom foam board printing for exhibitions, signage, POP displays & photo zones. Free online editor, lamination options, fast delivery.', keywords: 'foam board printing,foam board display,styrene board,POP display board,exhibition board,custom foam board' },
    },
    'foamex-stand': {
        KR: { title: '포맥스 디스플레이·PVC 진열대 제작 | 카멜레온프린팅', desc: '포맥스(PVC) 진열대 맞춤 제작. 매장 진열·상품 디스플레이·전시회용. 내구성 우수한 PVC 소재, 무료 디자인 에디터.', keywords: '포맥스 진열대,PVC 진열대,포맥스 디스플레이,매장 진열대,상품 디스플레이,전시회 진열대,PVC 디스플레이' },
        JP: { title: 'フォーレックスディスプレイ - PVC什器 | カメレオンプリンティング', desc: 'フォーレックス（PVC）什器のカスタム制作。店舗陳列・商品ディスプレイ・展示会用。耐久性に優れたPVC素材。', keywords: 'フォーレックス什器,PVC什器,PVCディスプレイ,店舗什器,展示会什器' },
        US: { title: 'Foamex Display Stand - PVC Product Display | Chameleon Printing', desc: 'Custom Foamex (PVC) display stands. Ideal for retail, product displays & exhibitions. Durable PVC material, free design editor.', keywords: 'foamex display,PVC display stand,retail display,product display,PVC stand,exhibition display' },
    },
    'biz-print': {
        KR: { title: '명함 인쇄·전단지·브로슈어 제작 | 카멜레온프린팅', desc: '고급 명함·전단지·브로슈어·리플렛 맞춤 인쇄. 무료 온라인 에디터, 다양한 용지·후가공 옵션, 당일 출고.', keywords: '명함인쇄,명함제작,전단지인쇄,브로슈어,리플렛,팜플렛,카탈로그,명함 디자인,명함 가격,소량 명함,고급 명함' },
        JP: { title: '名刺印刷 & 印刷物制作 | カメレオンプリンティング', desc: '高級名刺・チラシ・パンフレット・リーフレットのカスタム印刷。無料オンラインエディター、多様な用紙・加工オプション。', keywords: '名刺印刷,チラシ印刷,パンフレット,リーフレット,印刷物制作,名刺制作' },
        US: { title: 'Business Card & Print Materials | Chameleon Printing', desc: 'Premium business cards, flyers, brochures & leaflets. Design with free online editor, various paper & finishing options, fast delivery.', keywords: 'business card printing,flyer printing,brochure,leaflet,print materials,custom business card' },
    },
    'promo-items': {
        KR: { title: '판촉물·기념품·노벨티 제작 | 카멜레온프린팅', desc: '기업 판촉물·기념품·노벨티 맞춤 제작. 머그컵·텀블러·볼펜·에코백 등. 소량 주문 가능, 무료 에디터.', keywords: '판촉물,판촉물제작,기념품제작,노벨티,기업 판촉물,굿즈제작,머그컵 제작,텀블러 제작,에코백 제작,단체 기념품' },
        JP: { title: '販促品 制作 - ノベルティ・記念品 | カメレオンプリンティング', desc: '企業販促品・記念品・ノベルティのカスタム制作。マグカップ・タンブラー・ボールペン・エコバッグなど。少量注文OK。', keywords: '販促品,ノベルティ,記念品制作,企業販促品,オリジナルグッズ,名入れグッズ' },
        US: { title: 'Promotional Items - Custom Branded Merchandise | Chameleon Printing', desc: 'Custom promotional items & branded merchandise. Mugs, tumblers, pens, tote bags & more. Free design editor, small orders welcome.', keywords: 'promotional items,branded merchandise,corporate gifts,custom mugs,promotional products,branded goods' },
    },
    'tshirt-print': {
        KR: { title: '단체티·티셔츠 인쇄·유니폼 제작 | 카멜레온프린팅', desc: '맞춤 티셔츠 인쇄. 단체티·유니폼·이벤트티·커플티. 무료 에디터, 1장부터 주문 가능, DTF/실크 인쇄.', keywords: '단체티,티셔츠인쇄,단체복,유니폼제작,이벤트티,커플티,DTF 인쇄,실크 인쇄,학교 단체티,회사 단체티,동아리 티셔츠' },
        JP: { title: 'Tシャツ印刷 - オリジナルTシャツ制作 | カメレオンプリンティング', desc: 'カスタムTシャツ印刷。団体Tシャツ・ユニフォーム・イベントTシャツ。無料エディター、1枚から注文可能。', keywords: 'Tシャツ印刷,オリジナルTシャツ,団体Tシャツ,ユニフォーム,イベントTシャツ' },
        US: { title: 'T-Shirt Printing - Custom Apparel & Team Wear | Chameleon Printing', desc: 'Custom t-shirt printing. Team wear, uniforms, event shirts & couple tees. Free design editor, order from 1 piece.', keywords: 't-shirt printing,custom t-shirt,team wear,uniform printing,apparel printing,custom clothing' },
    },
    'banner-stand': {
        KR: { title: '배너 거치대·X배너·롤업 배너 제작 | 카멜레온프린팅', desc: '배너 거치대 맞춤 제작. X배너·롤업 배너·디스플레이 거치대. 전시회·이벤트·매장 프로모션용. 무료 디자인 에디터.', keywords: '배너 거치대,X배너,롤업배너,롤업 거치대,전시회 배너,이벤트 배너,매장 배너,홍보 배너,행사 배너,스탠드 배너' },
        JP: { title: 'バナースタンド - X型・ロールアップバナー | カメレオンプリンティング', desc: 'バナースタンドのカスタム制作。X型バナー・ロールアップバナー。展示会・イベント・店舗プロモーション用。', keywords: 'バナースタンド,Xバナー,ロールアップバナー,展示会バナー,イベントバナー' },
        US: { title: 'Banner Stands - X-Banner & Roll-up Banner | Chameleon Printing', desc: 'Custom banner stands. X-banners, roll-up banners & display stands. For trade shows, events & retail. Free design editor.', keywords: 'banner stand,X-banner,roll-up banner,trade show banner,event banner,display stand,retractable banner,exhibition banner,convention banner,trade show display' },
    },
    standee: {
        KR: { title: '등신대 제작·실물 사이즈 패널 | 카멜레온프린팅', desc: '등신대(실물 사이즈 패널) 맞춤 제작. 아이돌·캐릭터·이벤트·홍보용. 무료 에디터, 고품질 UV 인쇄, 전국 배송.', keywords: '등신대,등신대제작,실물 사이즈 패널,아이돌 등신대,캐릭터 등신대,이벤트 등신대,팬미팅 등신대,홍보 등신대,사이니지 등신대' },
        JP: { title: '等身大パネル制作 - ライフサイズスタンディー | カメレオンプリンティング', desc: '等身大パネル（ライフサイズパネル）のカスタム制作。アイドル・キャラクター・イベント用。無料エディター付き。', keywords: '等身大パネル,ライフサイズパネル,スタンディー,アイドルパネル,キャラクターパネル' },
        US: { title: 'Life-Size Standee - Custom Cutout Display | Chameleon Printing', desc: 'Custom life-size standees & cutout displays. For celebrities, characters, events & promotions. Free design editor, high-quality UV print.', keywords: 'life-size standee,standee,cutout display,life-size cutout,cardboard standee,promotional standee' },
    },
    curtain: {
        KR: { title: '커튼 인쇄·맞춤 사진 커튼 제작 | 카멜레온프린팅', desc: '맞춤 커튼 인쇄. 인테리어·매장·이벤트용 사진 커튼, 다양한 원단, 주문 사이즈 대응. 무료 디자인 에디터.', keywords: '커튼인쇄,사진커튼,맞춤커튼,오리지널 커튼,인테리어 커튼,매장 커튼,이벤트 커튼,프린팅 커튼' },
        JP: { title: 'カーテン印刷 - オリジナルカーテン制作 | カメレオンプリンティング', desc: 'カスタムカーテン印刷。インテリア・店舗・イベント用。写真カーテン、多様な生地、オーダーサイズ対応。無料デザインエディター。', keywords: 'カーテン印刷,オリジナルカーテン,写真カーテン,インテリアカーテン,イベントカーテン' },
        US: { title: 'Custom Printed Curtains - Photo Curtains | Chameleon Printing', desc: 'Custom printed curtains for interior, stores & events. Photo curtains with various fabrics, custom sizes, free design editor.', keywords: 'custom curtain,printed curtain,photo curtain,interior curtain,event curtain' },
    },
    'shopping-bag': {
        KR: { title: '쇼핑백·종이백·부직포백 제작 | 카멜레온프린팅', desc: '맞춤 쇼핑백 인쇄. 종이백·부직포백·에코백. 브랜드 로고 인쇄, 다양한 사이즈, 소량부터 대량까지.', keywords: '쇼핑백,쇼핑백제작,종이백,부직포백,에코백,쇼핑백 인쇄,로고 쇼핑백,쇼핑백 가격,쇼핑백 사이즈,선물 쇼핑백' },
        JP: { title: 'ショッピングバッグ制作 - 紙袋・不織布バッグ | カメレオンプリンティング', desc: 'カスタムショッピングバッグ印刷。紙袋・不織布バッグ・エコバッグ。ブランドロゴ印刷、多様なサイズ、少量から大量まで。', keywords: 'ショッピングバッグ,紙袋,不織布バッグ,エコバッグ,カスタムバッグ,ブランドバッグ' },
        US: { title: 'Shopping Bags - Custom Paper & Non-woven Bags | Chameleon Printing', desc: 'Custom printed shopping bags. Paper bags, non-woven bags & tote bags. Brand logo printing, various sizes.', keywords: 'shopping bag,paper bag,non-woven bag,tote bag,custom bag,branded bag' },
    },
    'box-package': {
        KR: { title: '박스 패키지·맞춤 박스 인쇄 | 카멜레온프린팅', desc: '맞춤 박스 패키지 인쇄. 상품박스·선물박스·택배박스. 무료 에디터로 디자인, 소량 주문 가능.', keywords: '박스인쇄,패키지인쇄,선물박스,상품박스,택배박스,맞춤박스,박스 제작,골판지 박스,단상자,중상자' },
        JP: { title: 'ボックスパッケージ制作 - カスタム箱印刷 | カメレオンプリンティング', desc: 'カスタムボックスパッケージ印刷。商品箱・ギフトボックス・配送箱。無料エディターでデザイン、少量注文OK。', keywords: 'ボックス印刷,パッケージ印刷,ギフトボックス,商品箱,カスタム箱' },
        US: { title: 'Box Packaging - Custom Box Printing | Chameleon Printing', desc: 'Custom box packaging. Product boxes, gift boxes & shipping boxes. Free design editor, small orders available.', keywords: 'box packaging,custom box,gift box,product box,packaging printing' },
    },
    'rubber-magnet': {
        KR: { title: '고무자석·맞춤 냉장고 자석 제작 | 카멜레온프린팅', desc: '맞춤 고무자석 인쇄. 냉장고 자석·판촉용·기념품. 무료 에디터, 소량 주문 가능, 다양한 사이즈.', keywords: '고무자석,냉장고자석,자석 제작,홍보 자석,판촉 자석,기념품 자석,자석 인쇄,캐릭터 자석' },
        JP: { title: 'ゴムマグネット制作 - カスタム冷蔵庫マグネット | カメレオンプリンティング', desc: 'カスタムゴムマグネット印刷。冷蔵庫マグネット・販促品・記念品。無料エディター、少量注文可能。', keywords: 'ゴムマグネット,冷蔵庫マグネット,カスタムマグネット,販促マグネット,記念品マグネット' },
        US: { title: 'Rubber Magnets - Custom Fridge Magnets | Chameleon Printing', desc: 'Custom rubber magnet printing. Fridge magnets for promotions, souvenirs & gifts. Free design editor.', keywords: 'rubber magnet,fridge magnet,custom magnet,promotional magnet,souvenir magnet' },
    },
    'flex-sign': {
        KR: { title: '플렉스 사인·실사 간판·옥외 광고 | 카멜레온프린팅', desc: '맞춤 플렉스 사인 제작. 매장·건물·옥외 광고 간판. 내후성 소재, 대형 사이즈 대응. 무료 에디터.', keywords: '플렉스 사인,실사 간판,옥외광고,매장 간판,건물 간판,광고 간판,간판 제작,대형 간판,플렉스 인쇄,현수막 간판' },
        JP: { title: 'フレックスサイン - 屋外広告看板 | カメレオンプリンティング', desc: 'カスタムフレックスサイン制作。店舗・建物・屋外広告看板。耐候性素材、大型サイズ対応。', keywords: 'フレックスサイン,屋外看板,広告看板,店舗看板,建物看板' },
        US: { title: 'Flex Signs - Outdoor Advertising Signs | Chameleon Printing', desc: 'Custom flex signs for outdoor advertising. Store fronts, buildings & commercial signs. Weather-resistant, large formats.', keywords: 'flex sign,outdoor sign,advertising sign,store sign,building sign' },
    },
    'blackout-blind': {
        KR: { title: '암막 블라인드·맞춤 인쇄 롤스크린 | 카멜레온프린팅', desc: '맞춤 암막 블라인드 인쇄. 매장·사무실·주택용. 99% 차광, 주문 사이즈, 무료 디자인 에디터.', keywords: '암막블라인드,롤스크린,맞춤블라인드,차광커튼,프린팅 블라인드,사진 블라인드,홈 블라인드,사무실 블라인드' },
        JP: { title: '遮光ブラインド - カスタム印刷ロールスクリーン | カメレオンプリンティング', desc: 'カスタム遮光ブラインド印刷。店舗・オフィス・住宅用。99%遮光、オーダーサイズ、無料エディター。', keywords: '遮光ブラインド,ロールスクリーン,カスタムブラインド,遮光カーテン,印刷ブラインド' },
        US: { title: 'Blackout Blinds - Custom Printed Roller Blinds | Chameleon Printing', desc: 'Custom printed blackout blinds. For stores, offices & homes. 99% light blocking, custom sizes.', keywords: 'blackout blind,roller blind,custom blind,light blocking blind,printed blind' },
    },
    'flexible-package': {
        KR: { title: '연포장·맞춤 파우치·스탠드백 제작 | 카멜레온프린팅', desc: '맞춤 연포장 인쇄. 식품 파우치·지퍼백·스탠드 파우치. 소량부터 대량까지 대응.', keywords: '연포장,파우치인쇄,지퍼백,스탠드파우치,식품포장,간식포장,화장품 파우치,식품 파우치 제작' },
        JP: { title: '軟包装印刷 - カスタムパウチ・袋 | カメレオンプリンティング', desc: 'カスタム軟包装印刷。食品パウチ・ジッパー袋・スタンドパウチ。少量から大量まで対応。', keywords: '軟包装,パウチ印刷,ジッパー袋,スタンドパウチ,食品包装' },
        US: { title: 'Flexible Packaging - Custom Pouches & Bags | Chameleon Printing', desc: 'Custom flexible packaging printing. Food pouches, zipper bags & stand-up pouches. Small to bulk orders.', keywords: 'flexible packaging,custom pouch,zipper bag,stand-up pouch,food packaging' },
    },
    placard: {
        KR: { title: '피켓·플래카드·응원 피켓 제작 | 카멜레온프린팅', desc: '맞춤 피켓·플래카드 인쇄. 이벤트·응원·시위·판촉용. 무료 에디터, 주문 사이즈 대응.', keywords: '피켓,플래카드,응원피켓,이벤트피켓,콘서트 피켓,팬미팅 피켓,단체 피켓,홍보 피켓,시위 피켓' },
        JP: { title: 'プラカード制作 - カスタムプラカード印刷 | カメレオンプリンティング', desc: 'カスタムプラカード印刷。イベント・応援・デモ・販促用。無料エディター、オーダーサイズ対応。', keywords: 'プラカード,プラカード印刷,応援プラカード,イベントプラカード' },
        US: { title: 'Placards - Custom Sign Boards | Chameleon Printing', desc: 'Custom printed placards for events, campaigns & promotions. Free design editor, various sizes.', keywords: 'placard,sign board,custom placard,event sign,campaign sign' },
    },
    'roll-blind': {
        KR: { title: '롤 블라인드·맞춤 인쇄 롤스크린 | 카멜레온프린팅', desc: '맞춤 롤 블라인드 인쇄. 매장·사무실·주택용. 주문 사이즈, 무료 디자인 에디터.', keywords: '롤블라인드,롤스크린,맞춤블라인드,프린팅 블라인드,창문 블라인드,사진 블라인드,사무실 블라인드,홈 블라인드' },
        JP: { title: 'ロールブラインド - カスタム印刷ロールスクリーン | カメレオンプリンティング', desc: 'カスタムロールブラインド印刷。店舗・オフィス・住宅用。オーダーサイズ、無料デザインエディター。', keywords: 'ロールブラインド,ロールスクリーン,カスタムブラインド,印刷ブラインド' },
        US: { title: 'Roll Blinds - Custom Printed Roller Blinds | Chameleon Printing', desc: 'Custom printed roll blinds for stores, offices & homes. Custom sizes, free design editor.', keywords: 'roll blind,roller blind,custom blind,printed blind,window blind' },
    },
};

// OG data for social crawlers (existing logic)
const OG_DATA = {
    'cafe0101.com': {
        lang: 'ja',
        siteName: 'カメレオンプリンティング',
        title: 'カメレオンプリンティング - エコ展示・ポップアップストア印刷 & 無料デザインエディター',
        description: 'ハニカムボード、ファブリック印刷、アクリルグッズ、バナー、看板、パッケージまで。無料エディターでデザインから印刷まで一括対応。出店も可能なグローバル印刷プラットフォーム。',
        keywords: 'カメレオンプリンティング,ハニカムボード,ファブリック印刷,ポップアップストア,等身大パネル,展示ブース,エコ印刷,バックウォール,アクリル印刷,バナースタンド,無料エディター,オンライン印刷',
        url: 'https://www.cafe0101.com/',
    },
    'cafe3355.com': {
        lang: 'en',
        siteName: 'Chameleon Printing',
        title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
        description: 'Honeycomb Boards, fabric printing, acrylic goods, banners, signs & packaging. Free online design editor like Canva. Global print marketplace.',
        keywords: 'chameleon printing,Honeycomb Board,fabric printing,pop-up store,display printing,life-size cutout,backwall design,eco printing,acrylic print,banner stand,free design editor,online printing',
        url: 'https://www.cafe3355.com/',
    },
    'chameleon.design': {
        lang: 'en',
        siteName: 'Chameleon Printing',
        title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
        description: 'Design and print online. Honeycomb Boards, fabric printing, acrylic goods, banners, life-size standees & packaging. Free Canva-like design editor. Worldwide shipping.',
        keywords: 'chameleon printing,free design editor,online printing,global printing,Honeycomb Board,fabric printing,pop-up store,trade show display,life-size standee,acrylic print,banner stand,eco printing',
        url: 'https://chameleon.design/',
    },
};

function getSiteData(hostname) {
    for (const [domain, data] of Object.entries(OG_DATA)) {
        if (hostname.includes(domain)) return data;
    }
    return null;
}

function getCountry(hostname, request) {
    if (hostname.includes('cafe0101')) return 'JP';
    if (hostname.includes('cafe3355')) return 'US';
    if (hostname.includes('chameleon.design')) {
        // Auto-detect country from Cloudflare geo
        const cfCountry = (request && request.cf && request.cf.country) || 'US';
        if (cfCountry === 'JP') return 'JP';
        if (cfCountry === 'KR') return 'KR';
        if (cfCountry === 'CN' || cfCountry === 'TW' || cfCountry === 'HK') return 'CN';
        if (cfCountry === 'SA' || cfCountry === 'AE' || cfCountry === 'EG' || cfCountry === 'IQ' || cfCountry === 'JO' || cfCountry === 'KW' || cfCountry === 'QA' || cfCountry === 'BH' || cfCountry === 'OM' || cfCountry === 'YE' || cfCountry === 'LB' || cfCountry === 'SY' || cfCountry === 'PS' || cfCountry === 'LY' || cfCountry === 'SD' || cfCountry === 'TN' || cfCountry === 'DZ' || cfCountry === 'MA') return 'AR';
        if (cfCountry === 'ES' || cfCountry === 'MX' || cfCountry === 'AR' || cfCountry === 'CO' || cfCountry === 'CL' || cfCountry === 'PE' || cfCountry === 'VE' || cfCountry === 'EC' || cfCountry === 'GT' || cfCountry === 'CU' || cfCountry === 'BO' || cfCountry === 'DO' || cfCountry === 'HN' || cfCountry === 'PY' || cfCountry === 'SV' || cfCountry === 'NI' || cfCountry === 'CR' || cfCountry === 'PA' || cfCountry === 'UY') return 'ES';
        if (cfCountry === 'DE' || cfCountry === 'AT' || cfCountry === 'CH') return 'DE';
        if (cfCountry === 'FR' || cfCountry === 'BE' || cfCountry === 'LU' || cfCountry === 'MC') return 'FR';
        return 'US'; // Default English
    }
    return 'KR';
}

function getProductName(p, cc) {
    if (cc === 'JP' && p.name_jp) return p.name_jp;
    if (cc === 'US' && p.name_us) return p.name_us;
    return p.name || '';
}

async function fetchFromSupabase(path) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            }
        });
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        return null;
    }
}

function escHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hreflangTags(suffix) {
    return `<link rel="alternate" hreflang="ko" href="https://www.cafe2626.com${suffix}">
<link rel="alternate" hreflang="ja" href="https://www.cafe0101.com${suffix}">
<link rel="alternate" hreflang="en" href="https://www.cafe3355.com${suffix}">
<link rel="alternate" hreflang="en-gb" href="https://chameleon.design${suffix}">
<link rel="alternate" hreflang="x-default" href="https://chameleon.design${suffix}">`;
}

function generateCategoryHtml(products, path, cc) {
    const lang = cc === 'JP' ? 'ja' : cc === 'US' ? 'en' : 'ko';
    const siteName = cc === 'JP' ? 'カメレオンプリンティング' : cc === 'US' ? 'Chameleon Printing' : '카멜레온프린팅';
    const domains = { KR: 'https://www.cafe2626.com', JP: 'https://www.cafe0101.com', US: 'https://www.cafe3355.com' };
    const domain = domains[cc];

    let items = '';
    const jsonLdItems = [];
    products.forEach((p, i) => {
        const name = getProductName(p, cc);
        if (p.img_url) {
            items += `<div style="display:inline-block;margin:10px;text-align:center;max-width:280px;">
<a href="${domain}/${encodeURIComponent(p.code)}"><img src="${escHtml(p.img_url)}" alt="${escHtml(name)}" width="280" height="280" style="object-fit:cover;border-radius:8px;"></a>
<p style="font-size:14px;margin:8px 0;font-weight:bold;">${escHtml(name)}</p></div>\n`;
        }
        if (i < 50) {
            jsonLdItems.push({
                "@type": "ListItem", "position": i + 1,
                "item": { "@type": "Product", "name": name, "url": `${domain}/${p.code}`, "image": p.img_url || '', "brand": { "@type": "Brand", "name": siteName } }
            });
        }
    });

    const catSeo = CATEGORY_SEO[path]?.[cc];
    const title = catSeo ? catSeo.title : `${path} - ${siteName}`;
    const desc = catSeo ? catSeo.desc : `${path} - ${siteName}`;
    const keywords = catSeo ? catSeo.keywords : '';

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": `${domain}/${path}`,
        "mainEntity": { "@type": "ItemList", "itemListElement": jsonLdItems } });

    // ★ BreadcrumbList — 검색결과에 경로(홈 > 카테고리) 표시
    const breadcrumbLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": siteName, "item": domain + "/" },
            { "@type": "ListItem", "position": 2, "name": title.split(' - ')[0].split(' | ')[0], "item": `${domain}/${path}` }
        ]
    });

    // ★ 네이버 캐러셀(ListItem) 전용 — 광고 확장소재용 별도 ItemList
    // Naver Search Advisor 카탈로그 캐러셀 공식 예시 형식 (item 중첩 + position string)
    // + Google Product Snippet 검증 통과를 위한 offers 필수 필드 포함
    const _currency = cc === 'JP' ? 'JPY' : cc === 'US' ? 'USD' : 'KRW';
    const naverCarouselItems = [];
    products.slice(0, 10).forEach((p, i) => {
        if (!p.img_url) return;
        const name = getProductName(p, cc);
        const _price = cc === 'JP' ? (p.price_jp || p.price || 0) : cc === 'US' ? (p.price_us || p.price || 0) : (p.price || 0);
        const _rawDesc = cc === 'JP' ? (p.description_jp || p.description || '') : cc === 'US' ? (p.description_us || p.description || '') : (p.description || '');
        const _desc = (_rawDesc || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 160) || name;
        naverCarouselItems.push({
            "@type": "ListItem",
            "item": {
                "@type": "Product",
                "name": name,
                "description": _desc,
                "image": p.img_url,
                "url": `${domain}/${p.code}`,
                "brand": { "@type": "Brand", "name": siteName },
                "offers": {
                    "@type": "Offer",
                    "url": `${domain}/${p.code}`,
                    "priceCurrency": _currency,
                    "price": String(_price || 0),
                    "availability": "https://schema.org/InStock",
                    "seller": { "@type": "Organization", "name": siteName }
                }
            },
            "position": String(naverCarouselItems.length + 1)
        });
    });
    const naverCarouselLd = naverCarouselItems.length > 0
        ? `<script type="application/ld+json">${JSON.stringify({ "@context": "http://schema.org", "@type": "ItemList", "itemListElement": naverCarouselItems })}</script>`
        : '';

    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
${keywords ? `<meta name="keywords" content="${escHtml(keywords)}">` : ''}
<meta name="robots" content="index, follow">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:image" content="${escHtml(products[0]?.img_url || '')}">
<meta property="og:url" content="${domain}/${path}">
<link rel="canonical" href="${domain}/${path}">
${hreflangTags('/' + path)}
<script type="application/ld+json">${jsonLd}</script>
<script type="application/ld+json">${breadcrumbLd}</script>
${naverCarouselLd}
</head><body><h1>${escHtml(title)}</h1>
<p>${escHtml(desc)}</p>
<p>${products.length} products</p>${items}
<p><a href="${domain}/">${escHtml(siteName)}</a></p></body></html>`;
}

function generateProductHtml(product, cc) {
    const lang = cc === 'JP' ? 'ja' : cc === 'US' ? 'en' : 'ko';
    const siteName = cc === 'JP' ? 'カメレオンプリンティング' : cc === 'US' ? 'Chameleon Printing' : '카멜레온프린팅';
    const domains = { KR: 'https://www.cafe2626.com', JP: 'https://www.cafe0101.com', US: 'https://www.cafe3355.com' };
    const domain = domains[cc];
    const name = getProductName(product, cc);
    const rawDesc = cc === 'JP' ? (product.description_jp || '') : cc === 'US' ? (product.description_us || '') : (product.description || '');
    const desc = rawDesc.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const shortDesc = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
    const price = cc === 'JP' ? (product.price_jp || product.price || 0) : cc === 'US' ? (product.price_us || product.price || 0) : (product.price || 0);
    const currency = cc === 'JP' ? 'JPY' : cc === 'US' ? 'USD' : 'KRW';

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", "name": name, "description": desc || name,
        "url": `${domain}/?product=${product.code}`, "image": product.img_url || '',
        "brand": { "@type": "Brand", "name": siteName },
        "offers": { "@type": "Offer", "priceCurrency": currency, "price": price, "availability": "https://schema.org/InStock" } });

    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(name)} - ${escHtml(siteName)}</title>
<meta name="description" content="${escHtml(shortDesc || name)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${escHtml(siteName)}">
<meta property="og:title" content="${escHtml(name)}">
<meta property="og:description" content="${escHtml(shortDesc || name)}">
<meta property="og:image" content="${escHtml(product.img_url || '')}">
<meta property="og:url" content="${domain}/?product=${product.code}">
<link rel="canonical" href="${domain}/?product=${product.code}">
${hreflangTags('/?product=' + product.code)}
<script type="application/ld+json">${jsonLd}</script>
</head><body><h1>${escHtml(name)}</h1>
${product.img_url ? `<img src="${escHtml(product.img_url)}" alt="${escHtml(name)}" width="600" height="600" style="max-width:100%;object-fit:contain;">` : ''}
${desc ? `<p>${escHtml(desc)}</p>` : ''}
<p><a href="${domain}/">${escHtml(siteName)}</a></p></body></html>`;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const ua = request.headers.get('user-agent') || '';
        const path = url.pathname.replace(/^\/|\/$/g, '');

        // ========== 2026-05-15: cafe3355.com → 종이매대(paper-stand) 전용 도메인 ==========
        // 사용자 결정: cafe3355.com 은 더 이상 US 사이트 아님 (US 는 chameleon.design).
        //   Hexalite(원판) 도메인처럼 cafe3355.com 전체를 paper_stand 랜딩 전용으로 서빙.
        //   언어는 URL ?lang= 따름 (기본 한국어 — paper_stand.html 의 hostLang 처리).
        //   다른 cafe3355 로직(referer 가드 등)보다 먼저 가로채야 함.
        if (url.hostname.includes('cafe3355.com')) {
            const isAsset3355 = path.includes('.') && (
                path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') ||
                path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.svg') ||
                path.endsWith('.ico') || path.endsWith('.txt') || path.endsWith('.xml') ||
                path.endsWith('.mp4') || path.endsWith('.json') || path.endsWith('.webp') ||
                path.endsWith('.woff') || path.endsWith('.woff2') || path.endsWith('.ttf') ||
                path.endsWith('.gif')
            );
            if (isAsset3355) return await env.ASSETS.fetch(request);
            // 모든 비-자산 경로 → paper_stand.html 프록시 (URL 은 cafe3355.com 유지)
            const psRewrite = new URL('/paper_stand.html', url.origin);
            let psResp = await env.ASSETS.fetch(new Request(psRewrite.toString(), request));
            if ((psResp.status === 308 || psResp.status === 301) && psResp.headers.get('Location')) {
                const loc = new URL(psResp.headers.get('Location'), url.origin);
                psResp = await env.ASSETS.fetch(new Request(loc.toString(), request));
            }
            const psHdrs = new Headers(psResp.headers);
            psHdrs.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return new Response(psResp.body, { status: psResp.status, headers: psHdrs });
        }

        // ========== 2026-05-14: cached 301 lock-in 구제 ==========
        // 이전 코드가 cotton-print.com → cafe3355(EN)/cafe0101(JP) 으로 301 리다이렉트를 보냈고,
        // 브라우저(특히 모바일) 가 그 301 을 영구 캐싱. 이제 라우팅 fix 가 적용돼도 옛 사용자는
        // 자기 캐시 따라 잘못된 도메인에 도달함. Referer 가 cotton-print.com 이면 그 잘못된
        // redirect 의 결과라고 판단 → 같은 path 로 cafe2626(KR) 에 302 리다이렉트.
        //
        // 진짜 US/JP 직접 방문자 (북마크/검색/주소창) 는 Referer 가 cotton-print.com 이 아니므로 영향 X.
        // 2026-05-15: substring 매칭이라 cotton-printer.com 까지 잘못 잡히던 버그 — 정확한 도메인 매칭으로 변경.
        if (url.hostname.includes('cafe3355.com') || url.hostname.includes('cafe0101.com')) {
            const referer = request.headers.get('Referer') || '';
            // cotton-print.com 만 매치 (cotton-printer.com 은 정상 JP 도메인이라 제외)
            if (/\bcotton-print\.com\b/.test(referer) && !referer.includes('cotton-printer.com')) {
                return Response.redirect('https://www.cafe2626.com' + url.pathname + url.search, 302);
            }
        }

        // ========== cotton-print.com / cotton-printer.com → cafe 도메인 통합 (2026-05-12) ==========
        // 사용자 결정: 도메인 4개를 하나의 사이트처럼 통합. cotton-print.com 의 디자이너는
        // 언어별 cafe 도메인의 /fabric 경로로 301 redirect. 로그인·카트가 같은 origin 에서
        // 자연스럽게 공유되어 "한 번 로그인 → 모든 곳에서 사용" 이 실현됨.
        // 2026-05-15: cotton-printer.com — 일본 cotton-print 전용 도메인. 같은 라우팅 + JP 강제.
        const _isCottonPrinter = url.hostname.includes('cotton-printer.com');
        if (url.hostname.includes('cotton-print.com') || _isCottonPrinter) {
            // 언어 결정: cotton-printer.com 은 무조건 JP. cotton-print.com 은 ?lang= URL 파라미터 만 인정 (기본 KR).
            // 2026-05-14: Accept-Language 기반 자동 라우팅 제거 — 모바일 브라우저가 'en-US,ko;q=0.9'
            //   같은 헤더 보내서 startsWith('en') 매치 → cafe3355.com 으로 잘못 리다이렉트되던 버그.
            //   cotton-print.com 은 한국 패브릭 서비스라 명시적 lang 선택이 없으면 무조건 KR.
            const langParam = _isCottonPrinter ? 'ja' : (url.searchParams.get('lang') || '').toLowerCase();
            let cafeHost = 'www.cafe2626.com';
            if (langParam === 'ja' || langParam === 'jp') cafeHost = 'www.cafe0101.com';
            else if (langParam === 'en' || langParam === 'us') cafeHost = 'www.cafe3355.com';

            // 자산 (JS/CSS/이미지 등) 은 그대로 ASSETS 에서 — Cloudflare Pages 동일 프로젝트
            const isAsset = path.includes('.') && (
                path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') ||
                path.endsWith('.jpg') || path.endsWith('.svg') || path.endsWith('.ico') ||
                path.endsWith('.txt') || path.endsWith('.xml') || path.endsWith('.mp4') ||
                path.endsWith('.json') || path.endsWith('.webp') || path.endsWith('.woff') ||
                path.endsWith('.woff2') || path.endsWith('.ttf')
            );
            if (isAsset) return await env.ASSETS.fetch(request);

            // 2026-05-15: cotton-print.com?lang=ja → cotton-printer.com 영구 301 리다이렉트.
            //   광고/검색결과/SNS 의 옛 일본어 링크를 새 JP 도메인으로 통합 (SEO 가중치 합산).
            //   asset 체크 이후로 둠 (정적 자원은 origin 그대로 fetch 해야 작동).
            //   _isCottonPrinter 가 false 인 경우(=cotton-print.com)에만 적용 — 무한 루프 방지.
            if (!_isCottonPrinter && (langParam === 'ja' || langParam === 'jp')) {
                const targetUrl = new URL(url.toString());
                targetUrl.hostname = 'www.cotton-printer.com';
                targetUrl.searchParams.delete('lang');     // 도메인이 JP 라 lang 불필요
                return Response.redirect(targetUrl.toString(), 301);
            }

            // 2026-05-13: 랜딩 페이지는 cotton-print.com 도메인 그대로 유지 (proxy/rewrite)
            //   - 301 redirect 하면 URL 이 cafe2626.com 으로 바뀜 → 사용자 불만
            //   - env.ASSETS.fetch() 로 cotton_print.html 을 직접 서빙 → URL 은 cotton-print.com 유지
            //   - 단, 로그인·카트는 cafe 도메인 origin 에 있으므로 login-required 경로는 redirect 유지
            if (path === '' || path === 'index.html') {
                const rewriteUrl = new URL('/cotton_print.html', url.origin);
                let resp = await env.ASSETS.fetch(new Request(rewriteUrl.toString(), request));
                if ((resp.status === 308 || resp.status === 301) && resp.headers.get('Location')) {
                    const loc = new URL(resp.headers.get('Location'), url.origin);
                    resp = await env.ASSETS.fetch(new Request(loc.toString(), request));
                }
                const hdrs = new Headers(resp.headers);
                hdrs.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
                return new Response(resp.body, { status: resp.status, headers: hdrs });
            }
            if (path === 'cotton-print' || path === 'cotton-print.html' ||
                path === 'fabric' || path === 'fabric-print') {
                // 같은 랜딩 페이지의 대체 경로들 — 그대로 서빙
                const rewriteUrl = new URL('/cotton_print.html', url.origin);
                let resp = await env.ASSETS.fetch(new Request(rewriteUrl.toString(), request));
                if ((resp.status === 308 || resp.status === 301) && resp.headers.get('Location')) {
                    const loc = new URL(resp.headers.get('Location'), url.origin);
                    resp = await env.ASSETS.fetch(new Request(loc.toString(), request));
                }
                const hdrs = new Headers(resp.headers);
                hdrs.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
                return new Response(resp.body, { status: resp.status, headers: hdrs });
            }

            // 경로별 매핑 → 새 canonical 경로 (로그인·카트 필요한 페이지만 cafe 도메인으로 301)
            let targetPath;
            if (path === 'designer' || path === 'designer.html' ||
                path === 'cotton-designer' || path === 'cotton-designer.html') {
                targetPath = '/fabric';                       // 디자이너 → /fabric (로그인·카트 필요)
            } else if (path === 'mypage' || path === 'mypage.html' || path === 'designer-mypage') {
                targetPath = '/mypage';                       // 마이페이지 → 통합 (로그인 필요)
            } else {
                targetPath = '/' + path;
            }
            const target = 'https://' + cafeHost + targetPath + url.search;
            // 2026-05-14: 301 → 302 — 브라우저(특히 모바일) 가 301 을 영구 캐싱하면 우리가 라우팅 로직
            //   바꿔도 사용자 디바이스는 옛 매핑을 그대로 따라감. 모바일에서 이미 영문(cafe3355)
            //   으로 캐시된 사용자가 새 KR 라우팅을 받으려면 캐시 클리어 또는 임시 302 가 필요.
            //   302 는 매번 서버에 물어보므로 향후 라우팅 변경 시에도 안전.
            return Response.redirect(target, 302);
        }

        // ========== SITEMAP PROXY (for Google Search Console) ==========
        if (path === 'sitemap-products.xml' || path === 'sitemap-blog.xml') {
            const cc = getCountry(url.hostname, request);
            const type = path.replace('.xml', ''); // sitemap-products or sitemap-blog
            const supaUrl = `${SUPABASE_URL}/functions/v1/${type}?country=${cc}`;
            try {
                const res = await fetch(supaUrl, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    }
                });
                if (res.ok) {
                    const body = await res.text();
                    return new Response(body, {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/xml; charset=utf-8',
                            'Cache-Control': 'public, max-age=3600',
                        },
                    });
                }
            } catch (e) {}
        }

        // ========== LINE OAuth Token Exchange ==========
        if (path === 'api/line_token' && request.method === 'POST') {
            try {
                const body = await request.json();
                const { code, redirect_uri } = body;
                if (!code || !redirect_uri) return new Response(JSON.stringify({ error: 'missing params' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

                const LINE_CHANNEL_ID = '2009373397';
                const LINE_CHANNEL_SECRET = '7785ce20c77d49f90ae6bedded878352';

                // 1. Exchange code for token
                const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri,
                        client_id: LINE_CHANNEL_ID,
                        client_secret: LINE_CHANNEL_SECRET,
                    }),
                });
                const tokenData = await tokenRes.json();
                if (tokenData.error) return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), { status: 400, headers: { 'Content-Type': 'application/json' } });

                // 2. Get user profile
                const profileRes = await fetch('https://api.line.me/v2/profile', {
                    headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
                });
                const profile = await profileRes.json();

                // 3. Decode id_token for email (if available)
                let email = null;
                if (tokenData.id_token) {
                    try {
                        const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]));
                        email = payload.email || null;
                    } catch (e) {}
                }

                return new Response(JSON.stringify({
                    userId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl || '',
                    email: email,
                    access_token: tokenData.access_token,
                }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        // CORS preflight for LINE API
        if (path === 'api/line_token' && request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
        }

        // ========== BOT PRE-RENDERING ==========
        // Skip if request is FROM Prerender.io's renderer (avoid infinite loop)
        const isPrerender = request.headers.get('X-Prerender') === '1' || /prerender/i.test(ua);

        if (!isPrerender && BOT_UA.test(ua) && !path.includes('.')) {
            // Skip admin/internal paths
            const skipPaths = ['board', 'mypage', 'success', 'fail', 'partner', 'global_admin', 'driver', 'admin_m_secret_882', 'marketing_bot', 'franchise-admin'];
            // 정적 랜딩 페이지 경로는 동적 prerender 스킵 (정적 HTML이 우선)
            const STATIC_LANDING_PATHS = ['paper-stand', 'raw-board', 'franchise'];
            if (!skipPaths.includes(path) && !STATIC_LANDING_PATHS.includes(path)) {
                // Pages with custom-built HTML (no SPA route → skip Prerender.io)
                const CUSTOM_LANDING = ['editor'];
                // ★ ?product= 쿼리파라미터가 있으면 Prerender.io 건너뛰기 (SPA가 홈으로 렌더링됨)
                const hasProductParam = url.searchParams.has('product') || url.searchParams.has('_p');

                // Try Prerender.io first (skip for homepage, custom landing pages and product URLs)
                if (path && !CUSTOM_LANDING.includes(path) && !hasProductParam) try {
                    const prerenderRes = await fetch(`https://service.prerender.io/${request.url}`, {
                        headers: {
                            'X-Prerender-Token': PRERENDER_TOKEN,
                            'X-Prerender-Int-Type': 'cloudflare',
                        },
                        redirect: 'manual',
                    });
                    if (prerenderRes.status === 200) {
                        const prerenderBody = await prerenderRes.text();
                        // Only use if Prerender.io returned real content (not empty render)
                        if (prerenderBody.length > 1000) {
                            return new Response(prerenderBody, {
                                status: 200,
                                headers: {
                                    'Content-Type': 'text/html; charset=utf-8',
                                    'Cache-Control': 'public, max-age=86400',
                                    'X-Prerender': 'true',
                                },
                            });
                        }
                    }
                } catch (e) {
                    // Prerender.io unavailable, fall through to custom pre-rendering
                }

                // Fallback: custom pre-rendering with Supabase data
                try {
                    const cc = getCountry(url.hostname, request);

                    // ★ ?product=코드 쿼리 파라미터 → 개별 상품 프리렌더링
                    const qProduct = url.searchParams.get('product') || url.searchParams.get('_p');
                    if (qProduct) {
                        const products = await fetchFromSupabase(
                            `admin_products?select=code,name,name_jp,name_us,img_url,price,price_jp,price_us,description,description_jp,description_us&code=eq.${encodeURIComponent(qProduct)}&limit=1`
                        );
                        if (products && products.length > 0) {
                            return new Response(generateProductHtml(products[0], cc), {
                                status: 200,
                                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' }
                            });
                        }
                    }

                    // Homepage fallback: generate rich HTML for bots
                    if (!path) {
                        const homeData = cc === 'JP' ? {
                            lang: 'ja', siteName: 'カメレオンプリンティング',
                            title: 'ハニカムボード・ファブリック印刷専門 - カメレオンプリンティング',
                            desc: 'ハニカムボード印刷・仕切り壁・等身大パネル・展示ブース、ファブリック印刷、アクリルグッズ、名刺、バナー、看板、フォーレックス、フォームボード制作。無料デザインエディター付きオンライン印刷サービス。',
                            keywords: 'ハニカムボード,ハニカムボード印刷,紙ディスプレイ,ファブリック印刷,布印刷,アクリルグッズ,アクリル印刷,ポップアップストア,展示ブース,等身大パネル,名刺印刷,バナースタンド,フォーレックス,フォームボード,カメレオンプリンティング,オンライン印刷,無料デザインエディター',
                            domain: 'https://www.cafe0101.com'
                        } : cc === 'US' ? {
                            lang: 'en', siteName: 'Chameleon Printing',
                            title: 'Honeycomb Board & Fabric Printing - Chameleon Printing',
                            desc: 'Custom Honeycomb Boards, fabric printing, acrylic goods, banners, signs, foam boards & packaging. Free online design editor like Canva. Worldwide shipping. Wholesale print marketplace.',
                            keywords: 'Honeycomb Board printing,fabric printing,cloth printing,acrylic goods,acrylic printing,pop-up store,exhibition booth,life-size standee,business card,banner stand,foam board,foamex,Chameleon Printing,online printing,free design editor,Canva alternative,wholesale printing',
                            domain: 'https://www.cafe3355.com'
                        } : {
                            lang: 'ko', siteName: '카멜레온프린팅',
                            title: '허니콤보드·패브릭 인쇄·종이매대 전문 - 카멜레온프린팅',
                            desc: '허니콤보드 인쇄, 패브릭 인쇄, 종이매대 도매 전문. 친환경 가벽·등신대·전시부스 제작. 무료 디자인 에디터, 당일 출고.',
                            keywords: '허니콤보드,허니콤보드 인쇄,허니콤 가벽,종이가벽,종이매대,등신대제작,전시부스,팝업스토어,패브릭인쇄,천인쇄,아크릴인쇄,아크릴 굿즈,포맥스인쇄,폼보드,명함인쇄,단체티,롤업배너,X배너,쇼핑백,박스인쇄,카멜레온프린팅,온라인인쇄,UV인쇄,무료디자인에디터,당일출고,도매인쇄',
                            domain: 'https://www.cafe2626.com'
                        };
                        // Fetch some products for the homepage (price/desc 포함 — 구조화 데이터용)
                        const homeProducts = await fetchFromSupabase(
                            'admin_products?select=code,name,name_jp,name_us,img_url,price,price_jp,price_us,description&or=(partner_id.is.null,partner_status.eq.approved)&order=sort_order.asc&limit=30'
                        );
                        let productItems = '';
                        // ★ 네이버 캐러셀(ListItem) 전용 — 광고 확장소재용
                        const homeCarouselItems = [];
                        if (homeProducts && homeProducts.length > 0) {
                            homeProducts.forEach((p, i) => {
                                const name = getProductName(p, cc);
                                if (p.img_url) {
                                    productItems += `<div style="display:inline-block;margin:10px;text-align:center;max-width:200px;">
<a href="${homeData.domain}/${encodeURIComponent(p.code)}"><img src="${escHtml(p.img_url)}" alt="${escHtml(name)}" width="200" height="200" loading="lazy"></a>
<p style="font-size:13px;margin:6px 0;">${escHtml(name)}</p></div>\n`;
                                    // 캐러셀에는 상위 10개만 (네이버 광고 확장소재 권장)
                                    // 네이버 공식 예시 형식: item 중첩 + @type:Product + position string
                                    // + Google Product Snippet 검증 통과를 위한 offers 필수 필드 포함
                                    if (homeCarouselItems.length < 10) {
                                        const _hCurrency = cc === 'JP' ? 'JPY' : cc === 'US' ? 'USD' : 'KRW';
                                        const _hPrice = cc === 'JP' ? (p.price_jp || p.price || 0) : cc === 'US' ? (p.price_us || p.price || 0) : (p.price || 0);
                                        const _hRawDesc = (p.description || '').toString();
                                        const _hDesc = _hRawDesc.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 160) || name;
                                        homeCarouselItems.push({
                                            "@type": "ListItem",
                                            "item": {
                                                "@type": "Product",
                                                "name": name,
                                                "description": _hDesc,
                                                "image": p.img_url,
                                                "url": `${homeData.domain}/${p.code}`,
                                                "brand": { "@type": "Brand", "name": homeData.siteName },
                                                "offers": {
                                                    "@type": "Offer",
                                                    "url": `${homeData.domain}/${p.code}`,
                                                    "priceCurrency": _hCurrency,
                                                    "price": String(_hPrice || 0),
                                                    "availability": "https://schema.org/InStock",
                                                    "seller": { "@type": "Organization", "name": homeData.siteName }
                                                }
                                            },
                                            "position": String(homeCarouselItems.length + 1)
                                        });
                                    }
                                }
                            });
                        }
                        const homeCarouselLd = homeCarouselItems.length > 0
                            ? `<script type="application/ld+json">${JSON.stringify({ "@context": "http://schema.org", "@type": "ItemList", "itemListElement": homeCarouselItems })}</script>`
                            : '';
                        // Category links for bots to discover
                        const catLinks = Object.keys(SEO_CATEGORIES).map(c =>
                            `<a href="${homeData.domain}/${c}">${c}</a>`
                        ).join(' | ');

                        const homeHtml = `<!DOCTYPE html><html lang="${homeData.lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(homeData.title)}</title>
<meta name="description" content="${escHtml(homeData.desc)}">
${homeData.keywords ? `<meta name="keywords" content="${escHtml(homeData.keywords)}">` : ''}
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(homeData.title)}">
<meta property="og:description" content="${escHtml(homeData.desc)}">
<meta property="og:image" content="https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1772681692107_1409904-0a2de3f2-b797-472d-bf50-914c6ed0d8a4.png">
<meta property="og:url" content="${homeData.domain}/">
<meta property="og:site_name" content="${escHtml(homeData.siteName)}">
<link rel="canonical" href="${homeData.domain}/">
${hreflangTags('/')}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@graph": [
        {
            "@type": "Organization",
            "name": homeData.siteName,
            "url": homeData.domain,
            "logo": "https://www.cafe2626.com/mascot-character.png",
            "sameAs": ["https://www.cafe2626.com","https://www.cafe0101.com","https://www.cafe3355.com"]
        },
        {
            "@type": "WebSite",
            "name": homeData.siteName,
            "url": homeData.domain,
            "inLanguage": homeData.lang,
            "potentialAction": {
                "@type": "SearchAction",
                "target": { "@type": "EntryPoint", "urlTemplate": homeData.domain + "/?q={search_term_string}" },
                "query-input": "required name=search_term_string"
            }
        },
        // LocalBusiness — 네이버는 지역 사업자 정보를 강력히 활용 (지도/검색)
        ...(cc === 'KR' ? [{
            "@type": "LocalBusiness",
            "@id": homeData.domain + "/#localbusiness",
            "name": "(주)카멜레온프린팅",
            "alternateName": homeData.siteName,
            "image": "https://www.cafe2626.com/mascot-character.png",
            "url": homeData.domain,
            "telephone": "+82-31-366-1984",
            "priceRange": "₩₩",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "우정읍 한말길 72-2",
                "addressLocality": "화성시",
                "addressRegion": "경기도",
                "postalCode": "18555",
                "addressCountry": "KR"
            },
            "openingHoursSpecification": [{
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
                "opens": "09:00",
                "closes": "18:00"
            }],
            "sameAs": ["https://www.cafe2626.com","https://www.cafe0101.com","https://www.cafe3355.com"],
            "description": "허니콤보드 인쇄, 패브릭 인쇄, 종이매대 도매 전문 인쇄소. 친환경 가벽·등신대·전시부스 제작."
        }] : [])
    ]
})}</script>
${homeCarouselLd}
</head><body>
<h1>${escHtml(homeData.title)}</h1>
<p>${escHtml(homeData.desc)}</p>
<nav><h2>Categories</h2><p>${catLinks}</p></nav>
<section><h2>Products</h2>${productItems}</section>
</body></html>`;
                        return new Response(homeHtml, {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' }
                        });
                    }

                    // Editor landing page — Free Design Editor SEO
                    if (path === 'editor') {
                        const editorSeo = cc === 'JP' ? {
                            lang: 'ja', siteName: 'カメレオンプリンティング', domain: 'https://www.cafe0101.com',
                            title: '無料デザインエディター - Canva代替オンライン編集ツール | カメレオンプリンティング',
                            desc: 'カメレオンプリンティングの無料デザインエディター。Canvaのように簡単なオンライン編集ツールで、ハニカムボード・バナー・等身大パネルを自分でデザイン。無料テンプレート＆画像素材付き、会員登録不要ですぐ開始。',
                            keywords: '無料デザインエディター,無料エディター,Canva代替,オンラインデザイン,無料画像,無料テンプレート,ポスター作成,バナーデザイン,オンライン編集,無料ポスター作成,印刷デザインエディター,無料画像素材',
                            h1: '無料デザインエディター - Canvaのように簡単なオンライン編集ツール',
                            features: [
                                { icon: '🎨', title: 'ドラッグ＆ドロップ編集', desc: 'Canvaのような直感的インターフェース。数クリックでプロ級デザイン完成。' },
                                { icon: '📐', title: '実際の印刷サイズ対応', desc: 'ハニカムボード・バナー・ポスターなど実際の印刷規格に自動設定。' },
                                { icon: '🖼️', title: '無料テンプレート＆画像', desc: '数百の無料テンプレートと画像ライブラリ。商用利用可能。' },
                                { icon: '🤖', title: 'AIデザインアシスタント', desc: 'AIがテキスト・レイアウト・配色を自動提案。デザイン経験不要。' },
                                { icon: '📄', title: '複数ページ対応', desc: '表裏・複数ページを一度に編集。両面印刷物も簡単に。' },
                                { icon: '💾', title: 'そのまま印刷注文', desc: 'デザイン完了後ワンクリックで印刷注文。全国配送対応。' },
                            ],
                            comp: [
                                { feature: '価格', us: '無料（完全無料）', canva: '無料＋有料（Pro $12.99/月）' },
                                { feature: '印刷注文連動', us: '✅ そのまま注文可能', canva: '❌ 別途ダウンロード必要' },
                                { feature: '実際の印刷規格', us: '✅ 自動設定', canva: '❌ 手動設定' },
                                { feature: '会員登録', us: '❌ 不要', canva: '✅ 必須' },
                                { feature: 'AIデザイン支援', us: '✅ 無料', canva: '✅ 有料(Pro)' },
                                { feature: '日本語対応', us: '✅ 完全対応', canva: '✅ 対応' },
                            ],
                            recommend: [
                                '展示ブース・ポップアップストアのデザインが必要な企業担当者',
                                '等身大パネル・フォトゾーンを自分でデザインしたいファン',
                                '小規模事業者 - 看板・バナー・横断幕を自分で制作',
                                'デザイン経験なしでプロ級印刷物を作りたい方',
                                'Canva代替を探している方 - 印刷特化の無料エディター',
                            ],
                        } : {
                            lang: 'en', siteName: 'Chameleon Printing', domain: 'https://www.cafe3355.com',
                            title: 'Free Design Editor - Canva Alternative for Print Design | Chameleon Printing',
                            desc: 'Chameleon Printing free design editor. Easy online tool like Canva for designing Honeycomb Boards, banners, standees & more. Free templates & images included, no signup required.',
                            keywords: 'free design editor,free editor,Canva alternative,online design tool,free images,free templates,poster maker,banner design,online editor,free poster maker,print design editor,free stock images,free design tool',
                            h1: 'Free Design Editor - Easy Online Tool Like Canva for Print Design',
                            features: [
                                { icon: '🎨', title: 'Drag & Drop Editing', desc: 'Intuitive Canva-like interface. Create professional designs in just a few clicks.' },
                                { icon: '📐', title: 'Real Print Sizes', desc: 'Auto-configured for actual print specs - Honeycomb Boards, banners, posters & more.' },
                                { icon: '🖼️', title: 'Free Templates & Images', desc: 'Hundreds of free templates and image library. Available for commercial use.' },
                                { icon: '🤖', title: 'AI Design Assistant', desc: 'AI suggests text, layout & color schemes automatically. No design experience needed.' },
                                { icon: '📄', title: 'Multi-Page Support', desc: 'Edit front/back and multiple pages at once. Double-sided prints made easy.' },
                                { icon: '💾', title: 'Direct Print Ordering', desc: 'One-click print order after designing. Fast worldwide shipping available.' },
                            ],
                            comp: [
                                { feature: 'Price', us: 'Free (completely free)', canva: 'Free + Paid (Pro $12.99/mo)' },
                                { feature: 'Print Order Integration', us: '✅ Direct ordering', canva: '❌ Separate download needed' },
                                { feature: 'Real Print Specs', us: '✅ Auto-configured', canva: '❌ Manual setup' },
                                { feature: 'Signup Required', us: '❌ No signup needed', canva: '✅ Required' },
                                { feature: 'AI Design Help', us: '✅ Free', canva: '✅ Paid (Pro)' },
                                { feature: 'Multi-language', us: '✅ 8 languages', canva: '✅ Supported' },
                            ],
                            recommend: [
                                'Event managers needing exhibition booth & pop-up store designs',
                                'Fans wanting to design life-size standees & photo zones',
                                'Small business owners - DIY signs, banners & displays',
                                'Anyone wanting professional print designs without design experience',
                                'Looking for a Canva alternative specialized for print design',
                            ],
                        };

                        const ed = editorSeo;
                        const edImg = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1772681692107_1409904-0a2de3f2-b797-472d-bf50-914c6ed0d8a4.png';

                        const featHtml = ed.features.map(f =>
                            `<div style="display:inline-block;vertical-align:top;width:280px;margin:15px;padding:20px;border:1px solid #eee;border-radius:12px;">
<p style="font-size:32px;margin:0;">${f.icon}</p>
<h3 style="margin:10px 0 5px;">${escHtml(f.title)}</h3>
<p style="font-size:14px;color:#555;margin:0;">${escHtml(f.desc)}</p></div>`
                        ).join('\n');

                        const compRows = ed.comp.map(c =>
                            `<tr><td style="padding:8px;border:1px solid #ddd;">${escHtml(c.feature)}</td><td style="padding:8px;border:1px solid #ddd;background:#f0fff0;">${c.us}</td><td style="padding:8px;border:1px solid #ddd;">${c.canva}</td></tr>`
                        ).join('');

                        const recItems = ed.recommend.map(r => `<li>${escHtml(r)}</li>`).join('');

                        const jsonLd = JSON.stringify({
                            "@context": "https://schema.org", "@type": "SoftwareApplication",
                            "name": ed.title.split(' - ')[0],
                            "applicationCategory": "DesignApplication",
                            "operatingSystem": "Web",
                            "offers": { "@type": "Offer", "price": "0", "priceCurrency": cc === 'JP' ? 'JPY' : 'USD' },
                            "description": ed.desc, "url": `${ed.domain}/editor`, "image": edImg,
                            "author": { "@type": "Organization", "name": ed.siteName, "url": ed.domain },
                            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "1250" }
                        });

                        const catLinks = Object.keys(SEO_CATEGORIES).map(c =>
                            `<a href="${ed.domain}/${c}">${c}</a>`).join(' | ');

                        return new Response(`<!DOCTYPE html><html lang="${ed.lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(ed.title)}</title>
<meta name="description" content="${escHtml(ed.desc)}">
<meta name="keywords" content="${escHtml(ed.keywords)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(ed.title)}">
<meta property="og:description" content="${escHtml(ed.desc)}">
<meta property="og:image" content="${escHtml(edImg)}">
<meta property="og:url" content="${ed.domain}/editor">
<link rel="canonical" href="${ed.domain}/editor">
${hreflangTags('/editor')}
<script type="application/ld+json">${jsonLd}</script>
</head><body>
<h1>${escHtml(ed.h1)}</h1>
<p>${escHtml(ed.desc)}</p>
<section><h2>${cc === 'JP' ? '主な機能' : 'Key Features'}</h2>${featHtml}</section>
<section><h2>${cc === 'JP' ? 'カメレオン エディター vs Canva 比較' : 'Chameleon Editor vs Canva'}</h2>
<table style="border-collapse:collapse;width:100%;max-width:700px;">
<thead><tr><th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;">${cc === 'JP' ? '機能' : 'Feature'}</th><th style="padding:8px;border:1px solid #ddd;background:#e8f5e9;">${cc === 'JP' ? 'カメレオン エディター' : 'Chameleon Editor'}</th><th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;">Canva</th></tr></thead>
<tbody>${compRows}</tbody></table></section>
<section><h2>${cc === 'JP' ? 'こんな方におすすめ' : 'Who Is This For?'}</h2><ul>${recItems}</ul></section>
<section><h2>${cc === 'JP' ? '対応印刷物' : 'Supported Print Products'}</h2><p>${catLinks}</p></section>
<p><a href="${ed.domain}/">${escHtml(ed.siteName)}</a></p>
</body></html>`, {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' }
                        });
                    }

                    // Check SEO category
                    const catInfo = SEO_CATEGORIES[path];
                    if (catInfo) {
                        let queryParts = [
                            'select=code,name,name_jp,name_us,img_url,price,price_jp,price_us,description,description_jp,description_us',
                            'or=(partner_id.is.null,partner_status.eq.approved)',
                            'order=sort_order.asc',
                            'limit=100'
                        ];

                        if (catInfo.top) {
                            const subCats = await fetchFromSupabase(
                                `admin_categories?select=code&top_category_code=eq.${encodeURIComponent(catInfo.top)}`
                            );
                            if (subCats && subCats.length > 0) {
                                const codes = subCats.map(c => encodeURIComponent(c.code)).join(',');
                                queryParts.push(`category=in.(${codes})`);
                            }
                        } else if (catInfo.prefix) {
                            queryParts.push(`category=like.${encodeURIComponent(catInfo.prefix)}*`);
                        }

                        const products = await fetchFromSupabase('admin_products?' + queryParts.join('&'));
                        if (products && products.length > 0) {
                            return new Response(generateCategoryHtml(products, path, cc), {
                                status: 200,
                                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' }
                            });
                        }
                    }

                    // Try as individual product code
                    const products = await fetchFromSupabase(
                        `admin_products?select=code,name,name_jp,name_us,img_url,price,price_jp,price_us,description,description_jp,description_us&code=eq.${encodeURIComponent(path)}&limit=1`
                    );
                    if (products && products.length > 0) {
                        return new Response(generateProductHtml(products[0], cc), {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' }
                        });
                    }
                } catch (err) {
                    // Fall through to normal handling on error
                }
            }
        }

        // ========== LEGACY REDIRECTS ==========
        const LEGACY_REDIRECTS = ['en.html', 'jp.html', 'en', 'jp', 'index.html', 'index'];
        if (LEGACY_REDIRECTS.includes(path)) {
            return Response.redirect(new URL('/', url.origin).toString(), 301);
        }

        // ========== STANDALONE PAGE REWRITES ==========
        // 별도 랜딩 페이지: 하이픈 경로만 사용 (언더스코어는 Pretty URLs 308 루프 발생)
        // 언더스코어 → 하이픈 301 리다이렉트
        const UNDERSCORE_REDIRECTS = { 'paper_stand': '/paper-stand', 'raw_board': '/raw-board' };
        if (UNDERSCORE_REDIRECTS[path]) {
            return new Response(null, { status: 301, headers: { 'Location': UNDERSCORE_REDIRECTS[path] } });
        }
        const STANDALONE_PAGES = {
            'paper-stand': '/paper_stand.html',
            'raw-board': '/raw_board.html',
            'franchise': '/franchise.html',
            'franchise-admin': '/franchise_admin.html',
            'cotton-print': '/cotton_print.html',
            'cotton-designer': '/cotton_designer.html',
            // 2026-05-12: 도메인 통합 — /fabric 이 패브릭 디자이너의 새 canonical 경로
            'fabric': '/cotton_designer.html',
            'fabric-designer': '/cotton_designer.html',
        };
        if (STANDALONE_PAGES[path]) {
            const rewriteUrl = new URL(STANDALONE_PAGES[path], url.origin);
            let stResp = await env.ASSETS.fetch(new Request(rewriteUrl.toString(), request));
            // Pretty URLs가 308을 반환하면 Location을 따라가서 실제 콘텐츠를 가져옴
            if ((stResp.status === 308 || stResp.status === 301) && stResp.headers.get('Location')) {
                const loc = new URL(stResp.headers.get('Location'), url.origin);
                stResp = await env.ASSETS.fetch(new Request(loc.toString(), request));
            }
            const stHeaders = new Headers(stResp.headers);
            stHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return new Response(stResp.body, { status: 200, headers: stHeaders });
        }

        // ========== NORMAL HANDLING ==========
        // Pretty URLs: /mypage → serves mypage.html (200), /mypage.html → 308 to /mypage
        // _redirects HTML rewrites removed to avoid 308 loop with Pretty URLs
        let response = await env.ASSETS.fetch(request);

        // SPA fallback: serve index.html for non-file 404s
        if (response.status === 404 && path && !path.includes('.')) {
            response = await env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
        }

        // JS/CSS: 캐시 방지 (배포 즉시 반영)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('javascript') || contentType.includes('css') || path.endsWith('.js') || path.endsWith('.css')) {
            const noCacheJs = new Headers(response.headers);
            noCacheJs.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            noCacheJs.set('Pragma', 'no-cache');
            return new Response(response.body, { status: response.status, headers: noCacheJs });
        }
        if (!contentType.includes('text/html')) return response;

        // ★ 모든 HTML 응답에 강력한 캐시 방지 헤더 적용 (인앱 브라우저 캐시 문제 방지)
        const noCacheHeaders = new Headers(response.headers);
        noCacheHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        noCacheHeaders.set('Pragma', 'no-cache');
        // refresh 페이지는 브라우저에게 캐시 전체 삭제 요청
        if (path === 'refresh' || path === 'refresh.html') {
            noCacheHeaders.set('Clear-Site-Data', '"cache", "storage"');
        }
        noCacheHeaders.set('Expires', '0');
        response = new Response(response.body, { status: response.status, headers: noCacheHeaders });

        let siteData = getSiteData(url.hostname);

        // chameleon.design: auto-detect country and set __SITE_CODE + lang
        const isChameleonDesign = url.hostname.includes('chameleon.design');
        let chameleonCountry = 'US'; // chameleon.design은 항상 영어 기본
        if (isChameleonDesign) {
            // chameleon.design = 글로벌 영어 사이트 (지리 감지 안함)
            chameleonCountry = 'US';
            if (siteData) siteData = { ...siteData, lang: 'en' };
        }

        if (!siteData) {
            // KR site via cafe2626 or chameleon.design with KR detection
            if (isChameleonDesign && chameleonCountry === 'KR') {
                // Still need to inject __SITE_CODE for KR
            } else {
                return response;
            }
        }

        // Build correct page URL (not always homepage)
        const pageUrl = path ? `${siteData.url.replace(/\/$/, '')}/${path}` : siteData.url;
        const suffix = path ? `/${path}` : '/';

        // Rewrite OG/meta tags using HTMLRewriter
        return new HTMLRewriter()
            .on('html', { element(el) { el.setAttribute('lang', siteData.lang); } })
            .on('head', { element(el) {
                el.append('<style>#btnKakaoLogin{display:none!important;}[data-i18n]:not([data-i18n=""]){visibility:hidden}[data-i18n-placeholder]:not([data-i18n-placeholder=""]){visibility:hidden}.hero-signup-desc{visibility:hidden}</style>', { html: true });
                el.append('<script>window.__i18nReady=false;window.addEventListener("load",function(){setTimeout(function(){if(!window.__i18nReady){document.querySelectorAll("[data-i18n]").forEach(function(e){e.style.visibility="visible"});document.querySelectorAll("[data-i18n-placeholder]").forEach(function(e){e.style.visibility="visible"});document.querySelectorAll(".hero-signup-desc").forEach(function(e){e.style.visibility="visible"})}},3000)})</script>', { html: true });
                // chameleon.design: inject __SITE_CODE based on geo-detected country
                if (isChameleonDesign && chameleonCountry) {
                    el.append(`<script>window.__SITE_CODE="${chameleonCountry}";</script>`, { html: true });
                }
                const jsonLd = JSON.stringify({"@context":"https://schema.org","@type":"Organization","name":siteData.siteName,"url":siteData.url,"logo":siteData.url+"mascot-character.png","sameAs":["https://www.cafe2626.com","https://www.cafe0101.com","https://www.cafe3355.com","https://chameleon.design"]});
                el.append(`<script type="application/ld+json">${jsonLd}</script>`, { html: true });
            } })
            .on('title', { element(el) { el.setInnerContent(siteData.title); } })
            .on('meta[name="description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('meta[name="keywords"]', { element(el) { if (siteData.keywords) el.setAttribute('content', siteData.keywords); } })
            .on('meta[property="og:site_name"]', { element(el) { el.setAttribute('content', siteData.siteName); } })
            .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', siteData.title); } })
            .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', pageUrl); } })
            .on('meta[property="og:locale"]', { element(el) {
                const localeMap = {KR:'ko_KR',JP:'ja_JP',US:'en_US',CN:'zh_CN',AR:'ar_AR',ES:'es_ES',DE:'de_DE',FR:'fr_FR'};
                const cc2 = isChameleonDesign ? (chameleonCountry || 'US') : (url.hostname.includes('cafe0101') ? 'JP' : 'US');
                el.setAttribute('content', localeMap[cc2] || 'en_US');
            } })
            .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', siteData.title); } })
            .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', pageUrl); } })
            .on('link[rel="alternate"][hreflang="ko"]', { element(el) { el.setAttribute('href', `https://www.cafe2626.com${suffix}`); } })
            .on('link[rel="alternate"][hreflang="ja"]', { element(el) { el.setAttribute('href', `https://www.cafe0101.com${suffix}`); } })
            .on('link[rel="alternate"][hreflang="en"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}`); } })
            .on('link[rel="alternate"][hreflang="en-gb"]', { element(el) { el.setAttribute('href', `https://chameleon.design${suffix}`); } })
            .on('link[rel="alternate"][hreflang="zh"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=zh`); } })
            .on('link[rel="alternate"][hreflang="ar"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=ar`); } })
            .on('link[rel="alternate"][hreflang="es"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=es`); } })
            .on('link[rel="alternate"][hreflang="de"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=de`); } })
            .on('link[rel="alternate"][hreflang="fr"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=fr`); } })
            .on('link[rel="alternate"][hreflang="x-default"]', { element(el) { el.setAttribute('href', `https://chameleon.design${suffix}`); } })
            .transform(response);
    }
};
