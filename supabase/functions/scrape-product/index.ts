import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ★ 네이버 스마트스토어 전용 크롤러
async function scrapeSmartStore(url: string) {
  // URL에서 상품번호 추출: /products/{productNo}
  const productMatch = url.match(/\/products\/(\d+)/);
  if (!productMatch) throw new Error("스마트스토어 상품 URL에서 상품번호를 찾을 수 없습니다.");
  const productNo = productMatch[1];

  // URL에서 스토어명 추출: smartstore.naver.com/{storeName}/
  const storeMatch = url.match(/smartstore\.naver\.com\/([^\/]+)\//);
  const storeName = storeMatch ? storeMatch[1] : '';

  // 1) 스토어 정보 조회 (merchantNo 필요)
  let channelNo = '';
  if (storeName) {
    try {
      const storeRes = await fetch(`https://smartstore.naver.com/i/v1/stores?url=${storeName}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json',
          'Referer': 'https://smartstore.naver.com/',
        }
      });
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        channelNo = storeData?.channel?.channelNo || storeData?.channelNo || '';
      }
    } catch (e) {
      console.log("스토어 정보 조회 실패 (무시):", e.message);
    }
  }

  // 2) 상품 상세 API 호출 (여러 경로 시도)
  const apiUrls = [
    `https://m.smartstore.naver.com/i/v1/contents/products/${productNo}`,
    `https://smartstore.naver.com/i/v1/contents/products/${productNo}`,
    channelNo ? `https://smartstore.naver.com/i/v1/stores/${channelNo}/products/${productNo}` : '',
  ].filter(Boolean);

  let productData: any = null;

  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'application/json, text/plain, */*',
          'Referer': url,
          'Origin': 'https://smartstore.naver.com',
        }
      });
      if (res.ok) {
        productData = await res.json();
        console.log("스마트스토어 API 성공:", apiUrl);
        break;
      }
    } catch (e) {
      console.log("API 실패:", apiUrl, e.message);
    }
  }

  // 3) API 실패 시 → 모바일 HTML에서 __NEXT_DATA__ 추출 시도
  if (!productData) {
    console.log("API 실패, 모바일 HTML 시도...");
    const mobileUrl = url.replace('smartstore.naver.com', 'm.smartstore.naver.com');
    const htmlRes = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://m.naver.com/',
      },
      redirect: 'follow',
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      // __NEXT_DATA__ JSON 추출
      const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          productData = nextData?.props?.pageProps?.product || nextData?.props?.pageProps || nextData;
        } catch (e) {
          console.log("__NEXT_DATA__ 파싱 실패:", e.message);
        }
      }

      // OG 태그에서 기본 정보 추출
      if (!productData) {
        const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i);
        const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i);
        const ogDesc = html.match(/property="og:description"\s+content="([^"]+)"/i);
        const priceMatch = html.match(/(\d[\d,]+)\s*원/);

        if (ogTitle) {
          productData = {
            _ogFallback: true,
            name: ogTitle[1],
            images: ogImage ? [ogImage[1]] : [],
            description: ogDesc ? ogDesc[1] : '',
            price: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
          };
        }
      }
    }
  }

  if (!productData) {
    throw new Error("스마트스토어 상품 데이터를 가져올 수 없습니다. (API/HTML 모두 실패)");
  }

  // 4) 데이터 정규화
  // API 응답 구조에 따라 파싱
  const name = productData.name || productData.productName || productData.title || '';
  const price = productData.salePrice || productData.price || productData.discountedSalePrice || 0;
  const desc = productData.description || productData.productInfoProvidedNotice || '';

  // 이미지 추출
  let images: string[] = [];
  let mainImage = '';

  if (productData.representImage) {
    mainImage = productData.representImage.url || productData.representImage;
  }
  if (productData.productImages) {
    images = productData.productImages.map((img: any) => img.url || img).filter(Boolean);
  }
  if (productData.images) {
    images = Array.isArray(productData.images) ? productData.images : [];
  }
  if (!mainImage && images.length > 0) mainImage = images[0];

  // OG fallback
  if (productData._ogFallback) {
    mainImage = productData.images?.[0] || '';
    images = productData.images || [];
  }

  return {
    name,
    price: typeof price === 'number' ? price : parseInt(String(price).replace(/[^0-9]/g, '')) || 0,
    currency: 'KRW',
    price_krw: typeof price === 'number' ? price : parseInt(String(price).replace(/[^0-9]/g, '')) || 0,
    description: typeof desc === 'string' ? desc.substring(0, 500) : '',
    images,
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
