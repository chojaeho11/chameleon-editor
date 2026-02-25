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

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": path, "url": `${domain}/${path}`,
        "mainEntity": { "@type": "ItemList", "itemListElement": jsonLdItems } });

    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(path)} - ${escHtml(siteName)}</title>
<meta name="robots" content="index, follow">
<meta property="og:image" content="${escHtml(products[0]?.img_url || '')}">
<meta property="og:url" content="${domain}/${path}">
<link rel="canonical" href="${domain}/${path}">
<script type="application/ld+json">${jsonLd}</script>
</head><body><h1>${escHtml(path)} - ${escHtml(siteName)}</h1>
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
        // For Google/Bing bots on product pages, return rich HTML with images
        if (BOT_UA.test(ua) && path && !path.includes('.')) {
            // Skip admin/internal paths
            if (!['board', 'mypage', 'success', 'fail', 'partner', 'global_admin', 'driver', 'admin_m_secret_882', 'marketing_bot'].includes(path)) {
                try {
                    const cc = getCountry(url.hostname);

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

        // Rewrite OG/meta tags using HTMLRewriter
        return new HTMLRewriter()
            .on('html', { element(el) { el.setAttribute('lang', siteData.lang); } })
            .on('title', { element(el) { el.setInnerContent(siteData.title); } })
            .on('meta[name="description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('meta[property="og:site_name"]', { element(el) { el.setAttribute('content', siteData.siteName); } })
            .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', siteData.title); } })
            .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', siteData.url); } })
            .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', siteData.title); } })
            .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', siteData.description); } })
            .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', siteData.url); } })
            .transform(response);
    }
};
