// ================================================================
// Cloudflare Pages Function Middleware
// Bot-only pre-rendering for Google Image Search SEO
// Regular users → context.next() → _redirects → SPA
// ================================================================

const BOT_UA = /googlebot|google-inspectiontool|bingbot|yandex|baiduspider|slurp|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|msnbot|applebot|petalbot/i;

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

// 26 SEO category codes → top_category_code mapping for DB query
const SEO_CATEGORIES = {
    honeycomb:         { top: 'honeycomb_board', nameUS: 'Honeycomb Board Printing', nameJP: 'ハニカムボード印刷', nameKR: '허니콤보드 인쇄' },
    'fabric-print':    { top: '23434242',       nameUS: 'Fabric Printing',          nameJP: 'ファブリック印刷',    nameKR: '패브릭 인쇄' },
    'paper-stand':     { top: null, prefix: 'pd_',  nameUS: 'Paper Display Stand',  nameJP: '紙什器',            nameKR: '종이매대' },
    goods:             { top: '77777',          nameUS: 'Acrylic Goods',            nameJP: 'アクリルグッズ',      nameKR: '아크릴 굿즈' },
    'banner-stand':    { top: null, prefix: 'banner', nameUS: 'Banner Stand',       nameJP: 'バナースタンド',     nameKR: '배너 스탠드' },
    standee:           { top: null, prefix: 'hb_point', nameUS: 'Life-Size Standee', nameJP: '等身大パネル',     nameKR: '등신대' },
    'acrylic-print':   { top: null, prefix: 'acrylic', nameUS: 'Acrylic UV Printing', nameJP: 'アクリルUV印刷', nameKR: '아크릴 UV 인쇄' },
};

// Domain → country mapping
function getCountry(hostname) {
    if (hostname.includes('cafe0101')) return 'JP';
    if (hostname.includes('cafe3355')) return 'US';
    return 'KR';
}

function getLang(cc) {
    return cc === 'JP' ? 'ja' : cc === 'US' ? 'en' : 'ko';
}

function getProductName(p, cc) {
    if (cc === 'JP' && p.name_jp) return p.name_jp;
    if (cc === 'US' && p.name_us) return p.name_us;
    if (cc === 'CN' && (p.name_cn || p.name_us)) return p.name_cn || p.name_us;
    return p.name || '';
}

async function fetchFromSupabase(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
    });
    if (!res.ok) return null;
    return res.json();
}

function generateProductListHtml(products, categoryName, cc, lang, domain, seoPath) {
    const title = categoryName + (cc === 'US' ? ' | Chameleon Printing' : cc === 'JP' ? ' | カメレオンプリンティング' : ' | 카멜레온프린팅');
    const siteName = cc === 'JP' ? 'カメレオンプリンティング' : cc === 'US' ? 'Chameleon Printing' : '카멜레온프린팅';
    const ogImage = products[0]?.img_url || '';

    let imagesHtml = '';
    products.forEach(p => {
        const name = getProductName(p, cc);
        if (p.img_url) {
            imagesHtml += `<article style="display:inline-block;margin:10px;text-align:center;max-width:300px;">
<a href="${domain}/${p.code}"><img src="${p.img_url}" alt="${name} - ${categoryName}" width="300" height="300" style="object-fit:cover;border-radius:8px;" loading="lazy"></a>
<h3 style="font-size:14px;margin:8px 0;">${name}</h3>
</article>\n`;
        }
    });

    // JSON-LD
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": categoryName,
        "url": `${domain}/${seoPath}`,
        "description": title,
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": products.slice(0, 50).map((p, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "item": {
                    "@type": "Product",
                    "name": getProductName(p, cc),
                    "url": `${domain}/${p.code}`,
                    "image": p.img_url || '',
                    "brand": { "@type": "Brand", "name": siteName }
                }
            }))
        }
    };

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${categoryName} - ${siteName}. ${products.length} products available.">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${categoryName} - ${siteName}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${domain}/${seoPath}">
<meta property="og:type" content="website">
<link rel="canonical" href="${domain}/${seoPath}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<h1>${categoryName}</h1>
<p>${products.length} products - ${siteName}</p>
<div>${imagesHtml}</div>
<nav><a href="${domain}/">← ${siteName} Home</a></nav>
</body>
</html>`;
}

function generateSingleProductHtml(product, cc, lang, domain) {
    const name = getProductName(product, cc);
    const siteName = cc === 'JP' ? 'カメレオンプリンティング' : cc === 'US' ? 'Chameleon Printing' : '카멜레온프린팅';
    const title = name + (cc === 'US' ? ' | Chameleon Printing' : cc === 'JP' ? ' | カメレオンプリンティング' : ' | 카멜레온프린팅');
    const desc = cc === 'JP' ? product.description_jp : cc === 'US' ? product.description_us : product.description;
    const imgUrl = product.img_url || '';
    const price = cc === 'JP' ? (product.price_jp || product.price) : cc === 'US' ? (product.price_us || product.price) : product.price;
    const currency = cc === 'JP' ? 'JPY' : cc === 'US' ? 'USD' : 'KRW';

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "description": desc || name,
        "url": `${domain}/${product.code}`,
        "image": imgUrl,
        "brand": { "@type": "Brand", "name": siteName },
        "offers": {
            "@type": "Offer",
            "priceCurrency": currency,
            "price": price || 0,
            "availability": "https://schema.org/InStock",
            "seller": { "@type": "Organization", "name": siteName }
        }
    };

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc || name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc || name}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:url" content="${domain}/${product.code}">
<meta property="og:type" content="product">
<link rel="canonical" href="${domain}/${product.code}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<h1>${name}</h1>
${imgUrl ? `<img src="${imgUrl}" alt="${name}" width="600" height="600" style="object-fit:contain;">` : ''}
${desc ? `<p>${desc}</p>` : ''}
<nav><a href="${domain}/">← ${siteName} Home</a></nav>
</body>
</html>`;
}

export async function onRequest(context) {
    const { request } = context;
    const ua = request.headers.get('user-agent') || '';

    // ★ CRITICAL: Only intercept for bots. Regular users get normal SPA.
    if (!BOT_UA.test(ua)) {
        return context.next();
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/|\/$/g, '');

    // Skip: root, static files, known HTML pages, admin pages
    if (!path ||
        path.includes('.') ||
        ['board', 'mypage', 'success', 'fail', 'partner', 'global_admin', 'driver', 'admin_m_secret_882', 'marketing_bot'].includes(path)) {
        return context.next();
    }

    try {
        const hostname = url.hostname;
        const cc = getCountry(hostname);
        const lang = getLang(cc);
        const domains = { KR: 'https://www.cafe2626.com', JP: 'https://www.cafe0101.com', US: 'https://www.cafe3355.com' };
        const domain = domains[cc] || domains.KR;

        // 1. Check if this is a known SEO category page
        const catInfo = SEO_CATEGORIES[path];
        if (catInfo) {
            // Fetch products for this category
            let query = `admin_products?select=code,name,name_jp,name_us,img_url,price,price_jp,price_us,description,description_jp,description_us&or=(partner_id.is.null,partner_status.eq.approved)&order=sort_order.asc&limit=100`;

            // Get subcategories for this top category, then fetch products
            if (catInfo.top) {
                const subCats = await fetchFromSupabase(
                    `admin_categories?select=code&top_category_code=eq.${catInfo.top}`
                );
                if (subCats && subCats.length > 0) {
                    const catCodes = subCats.map(c => c.code);
                    query += `&category=in.(${catCodes.join(',')})`;
                }
            } else if (catInfo.prefix) {
                query += `&category=like.${catInfo.prefix}*`;
            }

            const products = await fetchFromSupabase(query);
            if (products && products.length > 0) {
                const categoryName = cc === 'JP' ? catInfo.nameJP : cc === 'US' ? catInfo.nameUS : catInfo.nameKR;
                const html = generateProductListHtml(products, categoryName, cc, lang, domain, path);
                return new Response(html, {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
                });
            }
        }

        // 2. Try as individual product code
        const product = await fetchFromSupabase(
            `admin_products?select=code,name,name_jp,name_us,name_cn,name_ar,name_es,name_de,name_fr,img_url,price,price_jp,price_us,description,description_jp,description_us,category&code=eq.${encodeURIComponent(path)}&limit=1`
        );

        if (product && product.length > 0) {
            const html = generateSingleProductHtml(product[0], cc, lang, domain);
            return new Response(html, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
            });
        }

        // 3. Not a product — pass through to SPA
        return context.next();

    } catch (err) {
        // On any error, fall back to normal SPA behavior
        console.error('Middleware error:', err);
        return context.next();
    }
}
