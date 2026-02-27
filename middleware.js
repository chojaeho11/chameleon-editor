// ================================================================
// Vercel Edge Middleware — Bot pre-rendering for cafe2626.com (KR)
// Mirrors _worker.js logic (Cloudflare) but for Vercel deployment.
// When bot UA detected: serve pre-rendered HTML with proper meta/canonical.
// When normal user: return undefined → Vercel serves static SPA.
// ================================================================

const BOT_UA = /googlebot|google-inspectiontool|bingbot|yandex|baiduspider|slurp|duckduckbot|msnbot|applebot|petalbot|yeti|naver|daum|sogou|360spider|bytespider|qwant|seznambot|ia_archiver|archive\.org_bot|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot/i;

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const PRERENDER_TOKEN = '2JsjKgGMzVH9qEqjkYam';
const DOMAIN = 'https://www.cafe2626.com';

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

const SKIP_PATHS = ['board', 'mypage', 'success', 'fail', 'partner', 'global_admin', 'driver', 'admin_m_secret_882', 'marketing_bot'];

async function fetchFromSupabase(path) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) return null;
        return res.json();
    } catch (e) { return null; }
}

function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hreflangTags(suffix) {
    return `<link rel="alternate" hreflang="ko" href="https://www.cafe2626.com${suffix}">
<link rel="alternate" hreflang="ja" href="https://www.cafe0101.com${suffix}">
<link rel="alternate" hreflang="en" href="https://www.cafe3355.com${suffix}">
<link rel="alternate" hreflang="x-default" href="https://www.cafe2626.com${suffix}">`;
}

function generateCategoryHtml(products, path) {
    let items = '';
    const jsonLdItems = [];
    products.forEach((p, i) => {
        const name = p.name || '';
        if (p.img_url) {
            items += `<div style="display:inline-block;margin:10px;text-align:center;max-width:280px;">
<a href="${DOMAIN}/${encodeURIComponent(p.code)}"><img src="${esc(p.img_url)}" alt="${esc(name)}" width="280" height="280" style="object-fit:cover;border-radius:8px;"></a>
<p style="font-size:14px;margin:8px 0;font-weight:bold;">${esc(name)}</p></div>\n`;
        }
        if (i < 50) {
            jsonLdItems.push({
                "@type": "ListItem", "position": i + 1,
                "item": { "@type": "Product", "name": name, "url": `${DOMAIN}/${p.code}`, "image": p.img_url || '', "brand": { "@type": "Brand", "name": "카멜레온프린팅" } }
            });
        }
    });

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": path, "url": `${DOMAIN}/${path}`,
        "mainEntity": { "@type": "ItemList", "itemListElement": jsonLdItems } });

    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(path)} - 카멜레온프린팅</title>
<meta name="description" content="${esc(path)} - 카멜레온프린팅">
<meta name="robots" content="index, follow">
<meta property="og:image" content="${esc(products[0]?.img_url || '')}">
<meta property="og:url" content="${DOMAIN}/${path}">
<link rel="canonical" href="${DOMAIN}/${path}">
${hreflangTags('/' + path)}
<script type="application/ld+json">${jsonLd}</script>
</head><body><h1>${esc(path)} - 카멜레온프린팅</h1>
<p>${products.length} products</p>${items}
<p><a href="${DOMAIN}/">카멜레온프린팅</a></p></body></html>`;
}

function generateProductHtml(product) {
    const name = product.name || '';
    const desc = product.description || '';
    const price = product.price || 0;

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", "name": name, "description": desc || name,
        "url": `${DOMAIN}/${product.code}`, "image": product.img_url || '',
        "brand": { "@type": "Brand", "name": "카멜레온프린팅" },
        "offers": { "@type": "Offer", "priceCurrency": "KRW", "price": price, "availability": "https://schema.org/InStock" } });

    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} - 카멜레온프린팅</title>
<meta name="description" content="${esc(desc || name)}">
<meta name="robots" content="index, follow">
<meta property="og:title" content="${esc(name)}">
<meta property="og:image" content="${esc(product.img_url || '')}">
<meta property="og:url" content="${DOMAIN}/${product.code}">
<link rel="canonical" href="${DOMAIN}/${product.code}">
${hreflangTags('/' + product.code)}
<script type="application/ld+json">${jsonLd}</script>
</head><body><h1>${esc(name)}</h1>
${product.img_url ? `<img src="${esc(product.img_url)}" alt="${esc(name)}" width="600" height="600" style="max-width:100%;object-fit:contain;">` : ''}
${desc ? `<p>${esc(desc)}</p>` : ''}
<p><a href="${DOMAIN}/">카멜레온프린팅</a></p></body></html>`;
}

export const config = {
    matcher: ['/((?!api|_next|.*\\..*).*)', '/'],
};

export default async function middleware(request) {
    const ua = request.headers.get('user-agent') || '';
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/|\/$/g, '');

    // Only intercept bot requests for non-file, non-admin paths
    if (!BOT_UA.test(ua) || path.includes('.') || SKIP_PATHS.includes(path)) {
        return; // pass through to Vercel static files + SPA rewrite
    }

    // Skip if request is from Prerender.io renderer (avoid loop)
    const isPrerender = request.headers.get('X-Prerender') === '1' || /prerender/i.test(ua);
    if (isPrerender) return;

    // 1. Try Prerender.io first
    try {
        const prerenderRes = await fetch(`https://service.prerender.io/${request.url}`, {
            headers: {
                'X-Prerender-Token': PRERENDER_TOKEN,
                'X-Prerender-Int-Type': 'vercel',
            },
            redirect: 'manual',
        });
        if (prerenderRes.status === 200) {
            const body = await prerenderRes.text();
            if (body.length > 1000) {
                return new Response(body, {
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
        // Prerender.io unavailable, fall through
    }

    // 2. Fallback: custom pre-rendering with Supabase data
    try {
        // Homepage
        if (!path) {
            const homeProducts = await fetchFromSupabase(
                'admin_products?select=code,name,img_url&or=(partner_id.is.null,partner_status.eq.approved)&order=sort_order.asc&limit=30'
            );
            let productItems = '';
            if (homeProducts && homeProducts.length > 0) {
                homeProducts.forEach(p => {
                    if (p.img_url) {
                        productItems += `<div style="display:inline-block;margin:10px;text-align:center;max-width:200px;">
<a href="${DOMAIN}/${encodeURIComponent(p.code)}"><img src="${esc(p.img_url)}" alt="${esc(p.name)}" width="200" height="200" loading="lazy"></a>
<p style="font-size:13px;margin:6px 0;">${esc(p.name)}</p></div>\n`;
                    }
                });
            }
            const catLinks = Object.keys(SEO_CATEGORIES).map(c =>
                `<a href="${DOMAIN}/${c}">${c}</a>`
            ).join(' | ');

            const title = '카멜레온프린팅 - 친환경 전시·팝업스토어 인쇄 & 무료 디자인 에디터';
            const desc = '허니콤보드, 패브릭인쇄, 아크릴굿즈, 배너, 간판, 포장까지. 무료 에디터로 직접 디자인하고 전국 당일배송. 판매자 입점도 가능한 글로벌 인쇄 플랫폼.';

            return new Response(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${DOMAIN}/">
<meta property="og:site_name" content="카멜레온프린팅">
<link rel="canonical" href="${DOMAIN}/">
${hreflangTags('/')}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", "name": "카멜레온프린팅", "url": DOMAIN,
          "sameAs": ["https://www.cafe2626.com","https://www.cafe0101.com","https://www.cafe3355.com"] },
        { "@type": "WebSite", "name": "카멜레온프린팅", "url": DOMAIN, "inLanguage": "ko" }
    ]
})}</script>
</head><body>
<h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
<nav><h2>Categories</h2><p>${catLinks}</p></nav>
<section><h2>Products</h2>${productItems}</section>
</body></html>`, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
            });
        }

        // SEO category page
        const catInfo = SEO_CATEGORIES[path];
        if (catInfo) {
            let queryParts = [
                'select=code,name,img_url,price,description',
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
                return new Response(generateCategoryHtml(products, path), {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
                });
            }
        }

        // Individual product page
        const products = await fetchFromSupabase(
            `admin_products?select=code,name,img_url,price,description&code=eq.${encodeURIComponent(path)}&limit=1`
        );
        if (products && products.length > 0) {
            return new Response(generateProductHtml(products[0]), {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
            });
        }
    } catch (err) {
        // Fall through to normal SPA handling
    }

    // No pre-rendered content available → let Vercel serve index.html
    return;
}
