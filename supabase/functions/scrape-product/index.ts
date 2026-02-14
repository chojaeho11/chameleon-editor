import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 메타태그 추출 헬퍼
function extractMeta(html: string, property: string): string {
  // 속성 순서가 다를 수 있으므로 두 가지 패턴 시도
  const p1 = new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const p2 = new RegExp(`content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i');
  const m = html.match(p1) || html.match(p2);
  return m ? m[1] : '';
}

// ★ 네이버 스마트스토어 전용 크롤러
async function scrapeSmartStore(url: string) {
  const productMatch = url.match(/\/products\/(\d+)/);
  if (!productMatch) throw new Error("스마트스토어 상품 URL에서 상품번호를 찾을 수 없습니다.");
  const productNo = productMatch[1];
  const storeMatch = url.match(/smartstore\.naver\.com\/([^\/\?]+)/);
  const storeName = storeMatch ? storeMatch[1] : '';

  // 여러 UA/URL 조합으로 시도 (네이버는 클라우드 IP를 차단하므로 다양한 전략)
  const userAgents = [
    // Googlebot: 네이버가 검색 인덱싱을 위해 허용할 가능성 높음
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    // Naver 자체 봇
    'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
    // 일반 모바일 브라우저
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ];

  const fetchUrls = [
    `https://m.smartstore.naver.com/${storeName}/products/${productNo}`,
    `https://smartstore.naver.com/${storeName}/products/${productNo}`,
  ];

  let html = '';
  const diagLog: string[] = [];
  for (const ua of userAgents) {
    if (html.length > 1000) break;
    for (const fetchUrl of fetchUrls) {
      try {
        const res = await fetch(fetchUrl, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
          redirect: 'follow',
        });
        const bodyText = await res.text();
        diagLog.push(`${res.status} len=${bodyText.length} ua=${ua.substring(0,20)}`);
        // ★ 핵심: 429여도 본문이 크면 OG 태그가 포함된 HTML임
        if (bodyText.length > html.length) {
          html = bodyText; // 가장 큰 응답을 사용
        }
        if (res.ok && bodyText.length > 5000) break;
      } catch (e) {
        diagLog.push(`ERR: ${e.message.substring(0,50)}`);
      }
    }
  }
  console.log("SmartStore 진단:", diagLog.join(' | '));

  if (!html || html.length < 200) {
    throw new Error(`스마트스토어 차단됨 [${diagLog.join(', ')}]`);
  }

  // ★ kakao:commerce 메타태그에서 상품 정보 추출 (가장 안정적)
  const kakaoName = extractMeta(html, 'kakao:commerce:product_name');
  const kakaoPrice = extractMeta(html, 'kakao:commerce:price');
  const kakaoRegPrice = extractMeta(html, 'kakao:commerce:regular_price');
  const kakaoImage = extractMeta(html, 'kakao:commerce:product_image_url');

  // OG 태그 fallback
  const ogTitle = extractMeta(html, 'og:title');
  const ogImage = extractMeta(html, 'og:image');
  const ogDesc = extractMeta(html, 'og:description');

  const name = kakaoName || ogTitle?.replace(/\s*:\s*[^:]+$/, '') || ''; // ": 스토어명" 제거
  const mainImage = kakaoImage || ogImage || '';
  const price = parseInt(kakaoPrice || kakaoRegPrice || '0') || 0;
  const description = ogDesc || '';

  if (!name && !mainImage) {
    // __NEXT_DATA__ 마지막 시도
    const nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextMatch) {
      try {
        const nd = JSON.parse(nextMatch[1]);
        const p = nd?.props?.pageProps?.product || nd?.props?.pageProps;
        if (p) {
          return {
            name: p.name || p.productName || '',
            price: p.salePrice || p.price || 0,
            currency: 'KRW',
            price_krw: p.salePrice || p.price || 0,
            description: p.description || '',
            images: (p.productImages || []).map((i: any) => i.url || i),
            main_image: p.representImage?.url || '',
            specs: {},
            category_guess: '기타',
            original_url: url,
          };
        }
      } catch (e) { /* ignore */ }
    }
    throw new Error("스마트스토어 상품 정보를 HTML에서 추출할 수 없습니다.");
  }

  return {
    name,
    price,
    currency: 'KRW',
    price_krw: price,
    description: description.substring(0, 500),
    images: mainImage ? [mainImage] : [],
    main_image: mainImage,
    specs: {},
    category_guess: '기타',
    original_url: url,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

    const { url } = await req.json();
    if (!url) throw new Error("URL is required");

    // ★ 스마트스토어 감지 → 전용 크롤러 사용
    if (url.includes('smartstore.naver.com') || url.includes('m.smartstore.naver.com')) {
      console.log("스마트스토어 감지 → 전용 API 크롤러 사용");
      const product = await scrapeSmartStore(url);
      return new Response(JSON.stringify({
        success: true,
        product,
        raw_html_length: 0,
        method: 'smartstore_api'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === 일반 사이트: 기존 HTML 크롤링 ===

    // 1. HTML 가져오기 (리다이렉트 따라감)
    const htmlRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8,ja;q=0.7',
      },
      redirect: 'follow',
    });

    if (!htmlRes.ok) throw new Error(`Fetch failed: ${htmlRes.status} ${htmlRes.statusText}`);

    let html = await htmlRes.text();

    // 2. HTML 전처리 (토큰 절약)
    let metaInfo = "";
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const head = headMatch[1];
      const metaTags = head.match(/<meta[^>]+(og:|name="description"|name="keywords"|property="product")[^>]*>/gi);
      if (metaTags) metaInfo = metaTags.join('\n');
      const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) metaInfo = `<title>${titleMatch[1]}</title>\n` + metaInfo;
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) html = bodyMatch[1];

    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/\s(data-[a-z-]+|class|style|onclick|onload|onerror)="[^"]*"/gi, '');
    html = html.replace(/\s+/g, ' ').trim();

    html = metaInfo + '\n---BODY---\n' + html;
    if (html.length > 80000) html = html.substring(0, 80000);

    // 3. 도메인 추출
    const baseUrl = new URL(url);
    const baseDomain = `${baseUrl.protocol}//${baseUrl.host}`;

    // 4. Claude로 제품 정보 추출
    const systemPrompt = `You are a product data extraction specialist. Your ONLY job is to extract product data from HTML and return JSON.

URL: ${url}
Base domain: ${baseDomain}

RULES:
- Extract product name, price, description, images, and specs from the HTML
- Convert relative image URLs to absolute using "${baseDomain}"
- Detect currency: KRW(₩/원), JPY(¥/円), USD($), CNY(¥/元), EUR(€)
- Convert to KRW: 1 USD≈1350, 1 JPY≈9, 1 CNY≈190, 1 EUR≈1450
- Look for og:image, product gallery images, img tags with product photos
- category_guess: one of [허니콤, 패브릭, 폼보드, 포맥스, 배너, 등신대, 현수막, 실사출력, 종이매대, 키링, 메뉴판, 스티커, 아크릴, 캔버스, 포토존, 기타]

You MUST respond with ONLY a JSON object. No explanation, no markdown, no code blocks. Just pure JSON:
{"name":"...","price":0,"currency":"KRW","price_krw":0,"description":"...","images":["url1"],"main_image":"url","specs":{},"category_guess":"기타"}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: html }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Claude API error: ${res.status} ${errBody}`);
    }

    const data = await res.json();
    const rawText = data.content.map((b: any) => b.type === "text" ? b.text : "").join("");

    let cleaned = rawText.trim();
    const codeMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeMatch) cleaned = codeMatch[1].trim();
    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (braceMatch) cleaned = braceMatch[0];

    let product;
    try {
      product = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`AI 응답 파싱 실패. 원본: ${rawText.substring(0, 200)}`);
    }

    product.original_url = url;

    return new Response(JSON.stringify({
      success: true,
      product,
      raw_html_length: html.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("scrape-product error:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
