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

// Korean SEO metadata for category pages (from product-seo.js)
const CATEGORY_SEO = {
    honeycomb: {
        title: '허니콤보드 인쇄 - 친환경 종이 디스플레이 | 카멜레온프린팅',
        desc: '친환경 허니콤보드 맞춤 인쇄. 팝업스토어·전시부스·매장 디스플레이에 최적. 무료 온라인 에디터로 직접 디자인하고 전국 당일배송.',
        keywords: '허니콤보드,허니콤보드인쇄,종이디스플레이,팝업스토어디스플레이,친환경전시,종이보드인쇄,전시부스,매장디스플레이'
    },
    'fabric-print': {
        title: '패브릭 인쇄 - 고화질 천 인쇄 & 출력 | 카멜레온프린팅',
        desc: '고화질 패브릭(천) 맞춤 인쇄. 백월·포토존·배경막·현수막에 최적. 무료 디자인 에디터로 직접 제작, 전국 당일배송.',
        keywords: '패브릭인쇄,천인쇄,백월,포토존,배경막인쇄,현수막,패브릭출력,천출력'
    },
    'paper-stand': {
        title: '종이매대 제작 - 친환경 POP 진열대 | 카멜레온프린팅',
        desc: '친환경 종이매대 맞춤 제작. 마트·편의점·매장 진열대에 최적. 무료 에디터로 디자인, 소량부터 대량까지 전국 배송.',
        keywords: '종이매대,종이진열대,POP진열대,매장진열대,친환경매대,종이매대제작,카드보드디스플레이'
    },
    goods: {
        title: '아크릴 굿즈 제작 - 키링·포토카드·스탠드 | 카멜레온프린팅',
        desc: '아크릴 굿즈 맞춤 제작. 키링·포토카드·아크릴스탠드·뱃지. 무료 에디터로 직접 디자인, 소량 주문 가능, 전국 배송.',
        keywords: '아크릴굿즈,아크릴키링,포토카드제작,아크릴스탠드,아크릴뱃지,굿즈제작,맞춤굿즈'
    },
    'acrylic-print': {
        title: '아크릴 인쇄 - UV 아크릴 간판 & 디스플레이 | 카멜레온프린팅',
        desc: '고품질 아크릴 UV 인쇄. 간판·네임플레이트·안내판·인테리어 소품. 무료 에디터로 디자인, 다양한 두께·사이즈.',
        keywords: '아크릴인쇄,아크릴간판,UV아크릴,아크릴안내판,아크릴네임플레이트,아크릴디스플레이'
    },
    'paper-furniture': {
        title: '종이가구 제작 - 친환경 골판지 가구 | 카멜레온프린팅',
        desc: '친환경 종이가구 맞춤 제작. 전시·이벤트·팝업스토어용 테이블·의자·선반. 가볍고 튼튼한 골판지 가구, 전국 배송.',
        keywords: '종이가구,골판지가구,친환경가구,전시가구,팝업스토어가구,이벤트가구,카드보드가구'
    },
    'foamex-print': {
        title: '포맥스 인쇄 - PVC 폼 보드 출력 | 카멜레온프린팅',
        desc: '고품질 포맥스(PVC폼보드) 맞춤 인쇄. 간판·안내판·인테리어·전시용. 무료 디자인 에디터, 다양한 두께 선택 가능.',
        keywords: '포맥스인쇄,PVC폼보드,포맥스출력,간판제작,안내판,포맥스간판,PVC인쇄'
    },
    'foamboard-print': {
        title: '폼보드 인쇄 - 우드락 출력 & 제작 | 카멜레온프린팅',
        desc: '폼보드(우드락) 맞춤 인쇄. 전시·안내·POP·포토존에 최적. 무료 에디터로 디자인, 재단·라미네이팅 옵션, 전국 당일배송.',
        keywords: '폼보드인쇄,우드락인쇄,폼보드출력,우드락출력,전시보드,POP보드,폼보드제작'
    },
    'foamex-stand': {
        title: '포맥스 매대 - PVC 진열대 & 디스플레이 | 카멜레온프린팅',
        desc: '포맥스(PVC) 매대 맞춤 제작. 매장 진열·제품 디스플레이·전시회용. 내구성 뛰어난 PVC 소재, 무료 디자인 에디터.',
        keywords: '포맥스매대,PVC매대,PVC진열대,포맥스디스플레이,매장진열대,PVC디스플레이'
    },
    'biz-print': {
        title: '명함 인쇄 & 인쇄물 제작 | 카멜레온프린팅',
        desc: '고급 명함·전단지·브로셔·리플렛 맞춤 인쇄. 무료 온라인 에디터로 직접 디자인, 다양한 용지·후가공 옵션, 전국 빠른배송.',
        keywords: '명함인쇄,전단지인쇄,브로셔제작,리플렛인쇄,인쇄물제작,명함제작,전단지제작'
    },
    'promo-items': {
        title: '판촉물 제작 - 맞춤 홍보물 & 기념품 | 카멜레온프린팅',
        desc: '기업 판촉물·기념품·홍보물 맞춤 제작. 머그컵·텀블러·볼펜·에코백 등. 무료 에디터, 소량 주문 가능, 전국 배송.',
        keywords: '판촉물,판촉물제작,홍보물,기념품제작,기업판촉물,맞춤판촉물,기업기념품'
    },
    'tshirt-print': {
        title: '티셔츠 인쇄 - 맞춤 단체복 & 의류 프린팅 | 카멜레온프린팅',
        desc: '맞춤 티셔츠 인쇄. 단체복·유니폼·이벤트복·커플티. 무료 에디터로 디자인, 1장부터 주문, 다양한 원단.',
        keywords: '티셔츠인쇄,맞춤티셔츠,단체복,유니폼제작,의류인쇄,커플티,이벤트복'
    },
    'banner-stand': {
        title: '배너 스탠드 - 실내외 X배너·롤업배너 | 카멜레온프린팅',
        desc: '배너 스탠드 맞춤 제작. X배너·롤업배너·거치대. 전시회·행사·매장 홍보용. 무료 에디터, 당일 출고 가능.',
        keywords: '배너스탠드,X배너,롤업배너,실내배너,전시배너,행사배너,배너거치대,배너제작'
    },
    standee: {
        title: '등신대 제작 - 실물 크기 인물 패널 | 카멜레온프린팅',
        desc: '등신대(실물크기 패널) 맞춤 제작. 아이돌·캐릭터·이벤트용. 무료 에디터로 직접 디자인, 고화질 UV 인쇄.',
        keywords: '등신대,등신대제작,실물크기패널,아이돌등신대,캐릭터등신대,이벤트등신대,포토존등신대'
    },
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

    const seo = CATEGORY_SEO[path];
    const title = seo ? seo.title : `${path} - 카멜레온프린팅`;
    const desc = seo ? seo.desc : `${path} - 카멜레온프린팅`;
    const keywords = seo ? seo.keywords : '';

    const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": `${DOMAIN}/${path}`,
        "mainEntity": { "@type": "ItemList", "itemListElement": jsonLdItems } });

    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${keywords ? `<meta name="keywords" content="${esc(keywords)}">` : ''}
<meta name="robots" content="index, follow">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(products[0]?.img_url || '')}">
<meta property="og:url" content="${DOMAIN}/${path}">
<link rel="canonical" href="${DOMAIN}/${path}">
${hreflangTags('/' + path)}
<script type="application/ld+json">${jsonLd}</script>
</head><body><h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
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
