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

    const {
      product_name,
      product_category,
      product_specs = {},
      image_url,
      image_urls = [],
      price = 0,
      original_description,
      reference_text,
      mode,
      langs = ["kr"]
    } = await req.json();

    if (!product_name) throw new Error("product_name is required");

    const isWizard = mode === 'wizard';
    const allImages: string[] = image_urls.length > 0 ? image_urls : (image_url ? [image_url] : []);
    const heroImage = image_url || allImages[0] || '';

    const langMap: Record<string, { name: string, instruction: string, currency: string }> = {
      kr: { name: "Korean", instruction: "한국어로 작성하세요.", currency: `${price.toLocaleString()}원` },
      jp: { name: "Japanese", instruction: "日本語で書いてください。", currency: `¥${Math.round(price * 0.2).toLocaleString()}` },
      us: { name: "English", instruction: "Write in English.", currency: `$${(price * 0.002).toFixed(2)}` },
      cn: { name: "Chinese Simplified", instruction: "请用简体中文写作。", currency: `¥${Math.round(price * 0.01).toLocaleString()}` },
      ar: { name: "Arabic", instruction: "اكتب بالعربية.", currency: `${Math.round(price * 0.005).toLocaleString()} ﷼` },
      es: { name: "Spanish", instruction: "Escribe en español.", currency: `€${(price * 0.001).toFixed(2)}` },
      de: { name: "German", instruction: "Schreiben Sie auf Deutsch.", currency: `€${(price * 0.001).toFixed(2)}` },
      fr: { name: "French", instruction: "Écrivez en français.", currency: `€${(price * 0.001).toFixed(2)}` },
    };

    // 이미지 목록 텍스트 생성
    const imageListText = allImages.map((url: string, i: number) => `IMAGE_${i + 1}: ${url}`).join('\n');

    // ★ 위자드 모드 프롬프트 (풍부한 다중 이미지)
    function buildWizardPrompt(lang: string): string {
      const lc = langMap[lang];
      if (!lc) return '';

      return `You are a premium e-commerce product detail page designer for Chameleon Printing, a global printing company.

Create a visually stunning, dynamic, and professional product detail page.

STRICT HTML RULES:
- Use ONLY: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <img>, <hr>, <br>
- NEVER use <div>, <span>, <table>, <section>, or any container tags
- NEVER use inline styles or CSS classes
- Every image MUST be: <p><img src="URL" alt="description"></p>
- Structure must be flat (no nesting containers)

PRODUCT INFO:
- Name: ${product_name}
- Category: ${product_category || 'General'}
${price > 0 ? `- Price: ${lc.currency}` : ''}
${reference_text ? `- Reference/Notes: ${reference_text}` : ''}

AVAILABLE IMAGES (${allImages.length} total):
${imageListText}

REQUIRED STRUCTURE — You MUST use ALL ${allImages.length} images:

1. <h2> Product title (compelling, with product name)
2. <p><img src="IMAGE_1" alt="..."></p>  ← Hero/main product shot
3. <p> Eye-catching 2-3 sentence product introduction. Highlight what makes this product special.
4. <h3> Key Features / Highlights
5. <ul> with 5-7 compelling <li> feature points (use <strong> for emphasis)
${allImages.length >= 2 ? `6. <p><img src="IMAGE_2" alt="..."></p>  ← Detail/close-up shot` : ''}
7. <h3> Product Details / Specifications
8. <p> Material, printing method, finish quality, durability description
${allImages.length >= 3 ? `9. <p><img src="IMAGE_3" alt="..."></p>  ← Application/usage example` : ''}
${allImages.length >= 4 ? `10. <h3> Gallery / More Views` : ''}
${allImages.slice(3).map((_: string, i: number) => `${11 + i}. <p><img src="IMAGE_${i + 4}" alt="..."></p>`).join('\n')}
${allImages.length >= 4 ? `${11 + allImages.length - 3}. <p> Brief description of the additional views shown above` : ''}
${allImages.length >= 2 ? `\n<h3> Why Choose Chameleon Printing?` : ''}
${allImages.length >= 2 ? `<ul> with 3-4 <li> about company strengths (quality, speed, global service)` : ''}
<hr>
<p> Order info: custom sizes available, fast production, worldwide shipping

IMPORTANT:
- Make content feel premium, professional, and persuasive
- Each image should have a descriptive, relevant alt text
- Use <strong> and <em> to create visual hierarchy in text
- Content should be informative yet concise — no filler text
- Think like a top-tier product photographer's website

${lc.instruction}

Output ONLY the HTML. No markdown, no code blocks, no explanation.`;
    }

    // 기본 모드 프롬프트 (기존 호환)
    function buildSimplePrompt(lang: string): string {
      const lc = langMap[lang];
      if (!lc) return '';

      return `You are a product detail page writer for a printing company.

Create a SIMPLE product detail page using ONLY these HTML tags: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <img>, <hr>, <br>.

STRICT RULES:
- NEVER use <div>, <span>, <table>, <section>, or any container tags
- NEVER use inline styles (no style="" attribute at all)
- NEVER use CSS classes
- Images: <p><img src="URL" alt="text"></p> (one image per paragraph)
- Structure must be flat: heading → image → text → list → heading → text
- Keep it concise: 5-8 sections maximum

Product info:
- Name: ${product_name}
- Category: ${product_category}
- Price: ${lc.currency}
- Image: ${heroImage}
- Specs: ${JSON.stringify(product_specs)}
${original_description ? '- Reference: ' + original_description.substring(0, 200) : ''}

Required structure:
1. <h2> with product name
2. <p><img src="${heroImage}" alt="${product_name}"></p>
3. <p> with 2-3 sentence product description
4. <h3> for key features heading
5. <ul> with 3-5 <li> feature items
6. <h3> for specs/details heading (if specs available)
7. <p> with specs info
8. <hr>
9. <p> with short order/shipping info

${lc.instruction}

Output ONLY the HTML. No markdown, no code blocks, no explanation.`;
    }

    // 각 언어별 생성 함수
    async function generateForLang(lang: string): Promise<{ lang: string, html: string | null }> {
      const lc = langMap[lang];
      if (!lc) return { lang, html: null };

      try {
        const systemPrompt = isWizard ? buildWizardPrompt(lang) : buildSimplePrompt(lang);
        const model = "claude-haiku-4-5-20251001";
        const maxTokens = isWizard ? 4000 : 1500;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: "Generate the product detail page HTML now." }],
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Claude API error for ${lang}: ${res.status} - ${errBody}`);
          return { lang, html: null };
        }

        const data = await res.json();
        let html = data.content.map((b: any) => b.text || "").join("");
        html = html.replace(/```html?\s*\n?/g, '').replace(/```\s*$/g, '').trim();
        return { lang, html };
      } catch (e) {
        console.error(`Error generating ${lang}:`, e.message);
        return { lang, html: null };
      }
    }

    // ★ 병렬 실행
    const validLangs = langs.filter((l: string) => langMap[l]);
    const results = await Promise.allSettled(validLangs.map((l: string) => generateForLang(l)));

    const details: Record<string, string> = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.html) {
        details[result.value.lang] = result.value.html;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      details,
      generated_langs: Object.keys(details)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("generate-product-detail error:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
