// ================================================================
// Cloudflare Pages Worker
// 1. Bot pre-rendering: Google/Bing bots get rich HTML with images
// 2. OG tag rewriting: Social crawlers get correct OG meta per domain
// 3. SPA fallback: non-file paths serve index.html
// ================================================================

const BOT_UA = /googlebot|google-inspectiontool|bingbot|yandex|baiduspider|slurp|duckduckbot|msnbot|applebot|petalbot|yeti|naver|daum|sogou|360spider|bytespider|qwant|seznambot|ia_archiver|archive\.org_bot|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot/i;
const SOCIAL_BOT_UA = /facebookexternalhit|twitterbot|linkedinbot|kakaotalk|line\//i;

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const PRERENDER_TOKEN = '2JsjKgGMzVH9qEqjkYam';

// SEO category → DB query mapping
const SEO_CATEGORIES = {
    honeycomb: { top: 'honeycomb_board' },
    'fabric-print': { top: '23434242' },
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
};

// Multilingual SEO metadata for category pages (JP/US)
const CATEGORY_SEO = {
    honeycomb: {
        JP: { title: 'ハニカムボード印刷 - エコ紙ディスプレイ | カメレオンプリンティング', desc: 'エコハニカムボードのカスタム印刷。ポップアップストア・展示ブース・店舗ディスプレイに最適。無料オンラインエディターでデザイン可能。', keywords: 'ハニカムボード,ハニカムボード印刷,紙ディスプレイ,ポップアップストア,エコ展示,展示ブース' },
        US: { title: 'Honeycomb Board Printing - Eco Paper Display | Chameleon Printing', desc: 'Custom eco-friendly honeycomb board printing. Perfect for pop-up stores, exhibition booths & retail displays. Free online design editor included.', keywords: 'honeycomb board,honeycomb board printing,honeycomb board exhibition booth,paper display,pop-up store display,eco display,exhibition booth,trade show display,retail display board' },
    },
    'fabric-print': {
        JP: { title: 'ファブリック印刷 - 高画質布印刷 | カメレオンプリンティング', desc: '高画質ファブリック（布）カスタム印刷。バックウォール・フォトゾーン・背景幕に最適。無料デザインエディター付き。', keywords: 'ファブリック印刷,布印刷,バックウォール,フォトゾーン,背景幕,タペストリー印刷' },
        US: { title: 'Fabric Printing - High Quality Custom Cloth Print | Chameleon Printing', desc: 'High-resolution custom fabric printing. Ideal for backwalls, photo zones, backdrops & banners. Free online design editor available.', keywords: 'fabric printing,cloth printing,backwall,photo zone,backdrop printing,custom fabric,banner printing' },
    },
    'paper-stand': {
        JP: { title: '紙什器 制作 - エコPOPディスプレイ | カメレオンプリンティング', desc: 'エコ紙什器のカスタム制作。スーパー・コンビニ・店舗の陳列台に最適。無料エディターでデザイン、全国配送対応。', keywords: '紙什器,紙ディスプレイ,POP什器,店舗什器,エコ什器,段ボールディスプレイ' },
        US: { title: 'Paper Display Stand - Eco Cardboard POP Display | Chameleon Printing', desc: 'Custom eco-friendly paper display stands. Perfect for retail POP displays, stores & supermarkets. Free design editor, nationwide delivery.', keywords: 'paper display stand,cardboard display,POP display,retail display,eco display stand,point of purchase' },
    },
    goods: {
        JP: { title: 'アクリルグッズ制作 - キーホルダー・フォトカード | カメレオンプリンティング', desc: 'アクリルグッズのカスタム制作。キーホルダー・フォトカード・アクリルスタンド・バッジ。無料エディターでデザイン可能。', keywords: 'アクリルグッズ,アクリルキーホルダー,フォトカード,アクリルスタンド,バッジ制作,グッズ制作' },
        US: { title: 'Acrylic Goods - Keychains, Photo Cards & Stands | Chameleon Printing', desc: 'Custom acrylic goods. Keychains, photo cards, acrylic stands & badges. Design with free online editor, small orders welcome.', keywords: 'acrylic goods,acrylic keychain,photo card,acrylic stand,acrylic badge,custom goods,merchandise' },
    },
    'acrylic-print': {
        JP: { title: 'アクリル印刷 - UVアクリル看板 | カメレオンプリンティング', desc: '高品質アクリルUV印刷。看板・ネームプレート・案内板・インテリア小物。無料エディター、多様な厚さ・サイズ。', keywords: 'アクリル印刷,アクリル看板,UVアクリル,アクリル案内板,ネームプレート' },
        US: { title: 'Acrylic Printing - UV Acrylic Signs & Displays | Chameleon Printing', desc: 'High-quality acrylic UV printing. Signs, nameplates, information boards & interior decor. Free design editor, various sizes.', keywords: 'acrylic printing,acrylic sign,UV acrylic,acrylic display,nameplate,acrylic board' },
    },
    'paper-furniture': {
        JP: { title: '紙家具 制作 - エコ段ボール家具 | カメレオンプリンティング', desc: 'エコ紙家具のカスタム制作。展示・イベント・ポップアップストア用テーブル・椅子・棚。軽量で丈夫な段ボール家具。', keywords: '紙家具,段ボール家具,エコ家具,展示家具,ポップアップストア家具,イベント家具' },
        US: { title: 'Paper Furniture - Eco Cardboard Furniture | Chameleon Printing', desc: 'Custom eco-friendly paper furniture. Tables, chairs & shelves for exhibitions, events & pop-up stores. Lightweight yet strong cardboard furniture.', keywords: 'paper furniture,cardboard furniture,eco furniture,exhibition furniture,pop-up store furniture,event furniture' },
    },
    'foamex-print': {
        JP: { title: 'フォーレックス印刷 - PVCフォームボード | カメレオンプリンティング', desc: '高品質フォーレックス（PVCフォームボード）カスタム印刷。看板・案内板・インテリア・展示用。無料デザインエディター付き。', keywords: 'フォーレックス印刷,PVCフォームボード,フォーレックス看板,案内板印刷,PVC印刷' },
        US: { title: 'Foamex Printing - PVC Foam Board Print | Chameleon Printing', desc: 'High-quality Foamex (PVC foam board) custom printing. Perfect for signs, displays, interior decor & exhibitions. Free design editor.', keywords: 'foamex printing,PVC foam board,foamex sign,foam board printing,PVC printing,display board' },
    },
    'foamboard-print': {
        JP: { title: 'フォームボード印刷 - スチレンボード | カメレオンプリンティング', desc: 'フォームボード（スチレンボード）カスタム印刷。展示・案内・POP・フォトゾーンに最適。無料エディター、全国配送。', keywords: 'フォームボード印刷,スチレンボード,展示ボード,POPボード,パネル印刷' },
        US: { title: 'Foam Board Printing - Custom Display Board | Chameleon Printing', desc: 'Custom foam board printing for exhibitions, signage, POP displays & photo zones. Free online editor, lamination options, fast delivery.', keywords: 'foam board printing,foam board display,styrene board,POP display board,exhibition board,custom foam board' },
    },
    'foamex-stand': {
        JP: { title: 'フォーレックスディスプレイ - PVC什器 | カメレオンプリンティング', desc: 'フォーレックス（PVC）什器のカスタム制作。店舗陳列・商品ディスプレイ・展示会用。耐久性に優れたPVC素材。', keywords: 'フォーレックス什器,PVC什器,PVCディスプレイ,店舗什器,展示会什器' },
        US: { title: 'Foamex Display Stand - PVC Product Display | Chameleon Printing', desc: 'Custom Foamex (PVC) display stands. Ideal for retail, product displays & exhibitions. Durable PVC material, free design editor.', keywords: 'foamex display,PVC display stand,retail display,product display,PVC stand,exhibition display' },
    },
    'biz-print': {
        JP: { title: '名刺印刷 & 印刷物制作 | カメレオンプリンティング', desc: '高級名刺・チラシ・パンフレット・リーフレットのカスタム印刷。無料オンラインエディター、多様な用紙・加工オプション。', keywords: '名刺印刷,チラシ印刷,パンフレット,リーフレット,印刷物制作,名刺制作' },
        US: { title: 'Business Card & Print Materials | Chameleon Printing', desc: 'Premium business cards, flyers, brochures & leaflets. Design with free online editor, various paper & finishing options, fast delivery.', keywords: 'business card printing,flyer printing,brochure,leaflet,print materials,custom business card' },
    },
    'promo-items': {
        JP: { title: '販促品 制作 - ノベルティ・記念品 | カメレオンプリンティング', desc: '企業販促品・記念品・ノベルティのカスタム制作。マグカップ・タンブラー・ボールペン・エコバッグなど。少量注文OK。', keywords: '販促品,ノベルティ,記念品制作,企業販促品,オリジナルグッズ,名入れグッズ' },
        US: { title: 'Promotional Items - Custom Branded Merchandise | Chameleon Printing', desc: 'Custom promotional items & branded merchandise. Mugs, tumblers, pens, tote bags & more. Free design editor, small orders welcome.', keywords: 'promotional items,branded merchandise,corporate gifts,custom mugs,promotional products,branded goods' },
    },
    'tshirt-print': {
        JP: { title: 'Tシャツ印刷 - オリジナルTシャツ制作 | カメレオンプリンティング', desc: 'カスタムTシャツ印刷。団体Tシャツ・ユニフォーム・イベントTシャツ。無料エディター、1枚から注文可能。', keywords: 'Tシャツ印刷,オリジナルTシャツ,団体Tシャツ,ユニフォーム,イベントTシャツ' },
        US: { title: 'T-Shirt Printing - Custom Apparel & Team Wear | Chameleon Printing', desc: 'Custom t-shirt printing. Team wear, uniforms, event shirts & couple tees. Free design editor, order from 1 piece.', keywords: 't-shirt printing,custom t-shirt,team wear,uniform printing,apparel printing,custom clothing' },
    },
    'banner-stand': {
        JP: { title: 'バナースタンド - X型・ロールアップバナー | カメレオンプリンティング', desc: 'バナースタンドのカスタム制作。X型バナー・ロールアップバナー。展示会・イベント・店舗プロモーション用。', keywords: 'バナースタンド,Xバナー,ロールアップバナー,展示会バナー,イベントバナー' },
        US: { title: 'Banner Stands - X-Banner & Roll-up Banner | Chameleon Printing', desc: 'Custom banner stands. X-banners, roll-up banners & display stands. For trade shows, events & retail. Free design editor.', keywords: 'banner stand,X-banner,roll-up banner,trade show banner,event banner,display stand,retractable banner,exhibition banner,convention banner,trade show display' },
    },
    standee: {
        JP: { title: '等身大パネル制作 - ライフサイズスタンディー | カメレオンプリンティング', desc: '等身大パネル（ライフサイズパネル）のカスタム制作。アイドル・キャラクター・イベント用。無料エディター付き。', keywords: '等身大パネル,ライフサイズパネル,スタンディー,アイドルパネル,キャラクターパネル' },
        US: { title: 'Life-Size Standee - Custom Cutout Display | Chameleon Printing', desc: 'Custom life-size standees & cutout displays. For celebrities, characters, events & promotions. Free design editor, high-quality UV print.', keywords: 'life-size standee,standee,cutout display,life-size cutout,cardboard standee,promotional standee' },
    },
};

// OG data for social crawlers (existing logic)
const OG_DATA = {
    'cafe0101.com': {
        lang: 'ja',
        siteName: 'カメレオンプリンティング',
        title: 'カメレオンプリンティング - エコ展示・ポップアップストア印刷 & 無料デザインエディター',
        description: 'ハニカムボード、ファブリック印刷、ポップアップストア専門。無料エディターで等身大パネル・バックウォールのデザインから印刷まで一括対応。',
        url: 'https://www.cafe0101.com/',
    },
    'cafe3355.com': {
        lang: 'en',
        siteName: 'Chameleon Printing',
        title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
        description: 'Honeycomb boards, fabric printing, pop-up store displays. Free online editor for life-size cutouts, backwalls, and custom printing solutions.',
        url: 'https://www.cafe3355.com/',
    },
};

function getSiteData(hostname) {
    for (const [domain, data] of Object.entries(OG_DATA)) {
        if (hostname.includes(domain)) return data;
    }
    return null;
}

function getCountry(hostname) {
    if (hostname.includes('cafe0101')) return 'JP';
    if (hostname.includes('cafe3355')) return 'US';
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
<link rel="alternate" hreflang="x-default" href="https://www.cafe2626.com${suffix}">`;
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
    const desc = cc === 'JP' ? (product.description_jp || '') : cc === 'US' ? (product.description_us || '') : (product.description || '');
    const price = cc === 'JP' ? (product.price_jp || product.price || 0) : cc === 'US' ? (product.price_us || product.price || 0) : (product.price || 0);
    const currency = cc === 'JP' ? 'JPY' : cc === 'US' ? 'USD' : 'KRW';

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", "name": name, "description": desc || name,
        "url": `${domain}/${product.code}`, "image": product.img_url || '',
        "brand": { "@type": "Brand", "name": siteName },
        "offers": { "@type": "Offer", "priceCurrency": currency, "price": price, "availability": "https://schema.org/InStock" } });

    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(name)} - ${escHtml(siteName)}</title>
<meta name="description" content="${escHtml(desc || name)}">
<meta name="robots" content="index, follow">
<meta property="og:title" content="${escHtml(name)}">
<meta property="og:image" content="${escHtml(product.img_url || '')}">
<meta property="og:url" content="${domain}/${product.code}">
<link rel="canonical" href="${domain}/${product.code}">
${hreflangTags('/' + product.code)}
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

        // ========== BOT PRE-RENDERING ==========
        // Skip if request is FROM Prerender.io's renderer (avoid infinite loop)
        const isPrerender = request.headers.get('X-Prerender') === '1' || /prerender/i.test(ua);

        if (!isPrerender && BOT_UA.test(ua) && !path.includes('.')) {
            // Skip admin/internal paths
            const skipPaths = ['board', 'mypage', 'success', 'fail', 'partner', 'global_admin', 'driver', 'admin_m_secret_882', 'marketing_bot'];
            if (!skipPaths.includes(path)) {
                // Pages with custom-built HTML (no SPA route → skip Prerender.io)
                const CUSTOM_LANDING = ['editor'];

                // Try Prerender.io first (skip for custom landing pages)
                if (!CUSTOM_LANDING.includes(path)) try {
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
                    const cc = getCountry(url.hostname);

                    // Homepage fallback: generate rich HTML for bots
                    if (!path) {
                        const homeData = cc === 'JP' ? {
                            lang: 'ja', siteName: 'カメレオンプリンティング',
                            title: 'カメレオンプリンティング - エコ展示・ポップアップストア印刷 & 無料デザインエディター',
                            desc: 'ハニカムボード、ファブリック印刷、アクリルグッズ、バナー、看板、パッケージまで。無料エディターでデザインから印刷まで一括対応。出店も可能なグローバル印刷プラットフォーム。',
                            domain: 'https://www.cafe0101.com'
                        } : {
                            lang: 'en', siteName: 'Chameleon Printing',
                            title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
                            desc: 'Honeycomb boards, fabric printing, acrylic goods, banners, signs & packaging. Free online design editor like Canva. Global print marketplace - sell your products worldwide.',
                            domain: 'https://www.cafe3355.com'
                        };
                        // Fetch some products for the homepage
                        const homeProducts = await fetchFromSupabase(
                            'admin_products?select=code,name,name_jp,name_us,img_url&or=(partner_id.is.null,partner_status.eq.approved)&order=sort_order.asc&limit=30'
                        );
                        let productItems = '';
                        if (homeProducts && homeProducts.length > 0) {
                            homeProducts.forEach(p => {
                                const name = getProductName(p, cc);
                                if (p.img_url) {
                                    productItems += `<div style="display:inline-block;margin:10px;text-align:center;max-width:200px;">
<a href="${homeData.domain}/${encodeURIComponent(p.code)}"><img src="${escHtml(p.img_url)}" alt="${escHtml(name)}" width="200" height="200" loading="lazy"></a>
<p style="font-size:13px;margin:6px 0;">${escHtml(name)}</p></div>\n`;
                                }
                            });
                        }
                        // Category links for bots to discover
                        const catLinks = Object.keys(SEO_CATEGORIES).map(c =>
                            `<a href="${homeData.domain}/${c}">${c}</a>`
                        ).join(' | ');

                        const homeHtml = `<!DOCTYPE html><html lang="${homeData.lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(homeData.title)}</title>
<meta name="description" content="${escHtml(homeData.desc)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(homeData.title)}">
<meta property="og:description" content="${escHtml(homeData.desc)}">
<meta property="og:url" content="${homeData.domain}/">
<meta property="og:site_name" content="${escHtml(homeData.siteName)}">
<link rel="canonical" href="${homeData.domain}/">
${hreflangTags('/')}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", "name": homeData.siteName, "url": homeData.domain,
          "sameAs": ["https://www.cafe2626.com","https://www.cafe0101.com","https://www.cafe3355.com"] },
        { "@type": "WebSite", "name": homeData.siteName, "url": homeData.domain, "inLanguage": homeData.lang }
    ]
})}</script>
</head><body>
<h1>${escHtml(homeData.title)}</h1>
<p>${escHtml(homeData.desc)}</p>
<nav><h2>Categories</h2><p>${catLinks}</p></nav>
<section><h2>Products</h2>${productItems}</section>
</body></html>`;
                        return new Response(homeHtml, {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
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
                            desc: 'Chameleon Printing free design editor. Easy online tool like Canva for designing honeycomb boards, banners, standees & more. Free templates & images included, no signup required.',
                            keywords: 'free design editor,free editor,Canva alternative,online design tool,free images,free templates,poster maker,banner design,online editor,free poster maker,print design editor,free stock images,free design tool',
                            h1: 'Free Design Editor - Easy Online Tool Like Canva for Print Design',
                            features: [
                                { icon: '🎨', title: 'Drag & Drop Editing', desc: 'Intuitive Canva-like interface. Create professional designs in just a few clicks.' },
                                { icon: '📐', title: 'Real Print Sizes', desc: 'Auto-configured for actual print specs - honeycomb boards, banners, posters & more.' },
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
                        const edImg = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1769076824090_63416175887313310.png';

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
                            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
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
                                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
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
                            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
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

        // ========== NORMAL HANDLING (existing logic) ==========
        let response = await env.ASSETS.fetch(request);

        // SPA fallback: _worker.js overrides _redirects, so replicate /* /index.html 200
        if (response.status === 404 && path && !path.includes('.')) {
            response = await env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
        }

        // Only rewrite HTML responses for social crawler OG tags
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) return response;

        const siteData = getSiteData(url.hostname);
        if (!siteData) return response; // KR site, keep original Korean

        // Build correct page URL (not always homepage)
        const pageUrl = path ? `${siteData.url.replace(/\/$/, '')}/${path}` : siteData.url;
        const suffix = path ? `/${path}` : '/';

        // Rewrite OG/meta tags using HTMLRewriter
        return new HTMLRewriter()
            .on('html', { element(el) { el.setAttribute('lang', siteData.lang); } })
            .on('head', { element(el) { el.append('<style>#btnKakaoLogin{display:none!important;}</style>', { html: true }); } })
            .on('title', { element(el) { el.setInnerContent(siteData.title); } })
            .on('meta[name="description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('meta[property="og:site_name"]', { element(el) { el.setAttribute('content', siteData.siteName); } })
            .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', siteData.title); } })
            .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', pageUrl); } })
            .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', siteData.title); } })
            .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', pageUrl); } })
            .on('link[rel="alternate"][hreflang="ko"]', { element(el) { el.setAttribute('href', `https://www.cafe2626.com${suffix}`); } })
            .on('link[rel="alternate"][hreflang="ja"]', { element(el) { el.setAttribute('href', `https://www.cafe0101.com${suffix}`); } })
            .on('link[rel="alternate"][hreflang="en"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}`); } })
            .on('link[rel="alternate"][hreflang="zh"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=zh`); } })
            .on('link[rel="alternate"][hreflang="ar"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=ar`); } })
            .on('link[rel="alternate"][hreflang="es"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=es`); } })
            .on('link[rel="alternate"][hreflang="de"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=de`); } })
            .on('link[rel="alternate"][hreflang="fr"]', { element(el) { el.setAttribute('href', `https://www.cafe3355.com${suffix}${suffix === '/' ? '?' : '&'}lang=fr`); } })
            .on('link[rel="alternate"][hreflang="x-default"]', { element(el) { el.setAttribute('href', `https://www.cafe2626.com${suffix}`); } })
            .transform(response);
    }
};
