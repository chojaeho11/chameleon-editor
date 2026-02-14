import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

    const { url } = await req.json();
    if (!url) throw new Error("URL is required");

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
    // <head> 에서 meta 정보 추출 (og:image, title, description 등)
    let metaInfo = "";
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const head = headMatch[1];
      // og: 메타태그, title, description 추출
      const metaTags = head.match(/<meta[^>]+(og:|name="description"|name="keywords"|property="product")[^>]*>/gi);
      if (metaTags) metaInfo = metaTags.join('\n');
      const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) metaInfo = `<title>${titleMatch[1]}</title>\n` + metaInfo;
    }

    // body만 추출
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) html = bodyMatch[1];

    // script/style/주석/svg/iframe 제거
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    // 속성 정리 (data-*, class, style 제거로 크기 축소)
    html = html.replace(/\s(data-[a-z-]+|class|style|onclick|onload|onerror)="[^"]*"/gi, '');
    html = html.replace(/\s+/g, ' ').trim();

    // meta 정보를 앞에 붙이기
    html = metaInfo + '\n---BODY---\n' + html;

    // 80KB 제한 (meta + body)
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

    // JSON 파싱 (여러 형태 처리)
    let cleaned = rawText.trim();
    // 코드블록 제거
    const codeMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeMatch) cleaned = codeMatch[1].trim();
    // 첫 번째 { 부터 마지막 } 까지 추출
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
