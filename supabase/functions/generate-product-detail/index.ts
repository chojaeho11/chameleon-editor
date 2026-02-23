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

      return `You are a world-class e-commerce product detail page designer. Create a PREMIUM, DARK-THEMED product detail page for Chameleon Printing.

DESIGN PHILOSOPHY:
- Dark backgrounds (#1a1a2e, #16213e, #0f3460, #1b1b2f) with light text (#f0f0f0, #e0e0e0)
- Luxurious, high-end, magazine-quality feel
- LOTS of breathing space / whitespace between sections (use padding and margins generously)
- Images should be LARGE and IMPACTFUL — always full width (100%), one image per row
- NEVER place two images side-by-side. Each image gets its own full-width row
- Short, punchy text — let the images do the talking
- Elegant typography with subtle accent colors (#c9a84c gold, #e74c3c red, #3498db blue)

HTML RULES:
- You CAN use <div> with inline styles for layout
- You CAN use inline style="" attributes (this is important for the dark theme)
- Use: <div>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <img>, <hr>, <br>
- Full-width image: <div style="margin:40px 0;"><img src="URL" alt="text" style="width:100%; border-radius:8px;"></div>
- NEVER use side-by-side layout. Always one image per row, full width
- Section wrapper: <div style="background:#1a1a2e; padding:60px 40px; text-align:center;">

PRODUCT INFO:
- Name: ${product_name}
- Category: ${product_category || 'General'}
${price > 0 ? `- Price: ${lc.currency}` : ''}
${reference_text ? `- Reference/Notes: ${reference_text}` : ''}

IMAGES (${allImages.length} total — use ALL of them):
${imageListText}

REQUIRED STRUCTURE:

1. HERO SECTION — Dark bg (#0f3460), product name in large gold text, 1-2 line tagline in light gray
   <div style="background:#0f3460; padding:80px 40px; text-align:center;">
     <h2 style="color:#c9a84c; font-size:32px; margin:0; letter-spacing:2px;">PRODUCT NAME</h2>
     <p style="color:#a0a0a0; font-size:16px; margin-top:16px;">Short elegant tagline</p>
   </div>

2. HERO IMAGE — First image full-width, no padding
   <div style="margin:0;"><img src="IMAGE_1" style="width:100%; display:block;"></div>

3. INTRO — Dark bg, centered text, generous padding
   <div style="background:#1a1a2e; padding:60px 40px; text-align:center;">
     <p style="color:#e0e0e0; font-size:17px; line-height:1.9; max-width:700px; margin:0 auto;">2-3 elegant sentences</p>
   </div>

4. KEY FEATURES — Dark bg with subtle border accents
   <div style="background:#16213e; padding:50px 40px;">
     <h3 style="color:#c9a84c; text-align:center; font-size:22px;">Features heading</h3>
     <ul style="color:#d0d0d0; font-size:15px; line-height:2.2; max-width:600px; margin:20px auto;">
       <li>Feature with <strong style="color:#fff;">emphasis</strong></li>
     </ul>
   </div>

5. IMAGE GALLERY — All images full-width, one per row, with dark spacers between
${allImages.length >= 2 ? `   Each image full-width (100%) with spacer section between them` : ''}
${allImages.length >= 3 ? `   Use <div style="background:#1b1b2f; padding:20px 0;"> as spacer between images` : ''}

6. DETAILS SECTION — Specs, materials, use cases
   <div style="background:#1a1a2e; padding:60px 40px; text-align:center;">

7. CLOSING — Order info, CTA feel
   <div style="background:#0f3460; padding:50px 40px; text-align:center;">
     <p style="color:#c9a84c; font-size:18px;">Chameleon Printing</p>
     <p style="color:#808080; font-size:13px;">tagline</p>
   </div>

CRITICAL RULES:
- Use ALL ${allImages.length} images throughout the page
- Every image must be full-width (100%), one per row — NEVER side-by-side
- Every section must have generous padding (50px-80px vertical)
- Background colors should alternate between the dark palette
- Text should be light (#e0e0e0, #d0d0d0) on dark backgrounds
- Headings in gold (#c9a84c) or white
- Keep text SHORT and ELEGANT — this is a visual showcase, not an essay
- Make it look like a premium brand's product page

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
          return { lang, html: null, error: `API ${res.status}: ${errBody.substring(0, 200)}` };
        }

        const data = await res.json();
        if (!data.content || data.content.length === 0) {
          console.error(`Claude empty response for ${lang}:`, JSON.stringify(data).substring(0, 500));
          return { lang, html: null, error: 'Empty response from Claude' };
        }
        let html = data.content.map((b: any) => b.text || "").join("");
        html = html.replace(/```html?\s*\n?/g, '').replace(/```\s*$/g, '').trim();
        return { lang, html: html || null, error: html ? undefined : 'Generated HTML was empty' };
      } catch (e) {
        console.error(`Error generating ${lang}:`, e.message);
        return { lang, html: null, error: e.message };
      }
    }

    // ★ 병렬 실행
    const validLangs = langs.filter((l: string) => langMap[l]);
    const results = await Promise.allSettled(validLangs.map((l: string) => generateForLang(l)));

    const details: Record<string, string> = {};
    const errors: Record<string, string> = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.html) {
        details[result.value.lang] = result.value.html;
      } else if (result.status === 'fulfilled') {
        errors[result.value.lang] = result.value.error || 'AI returned empty HTML';
      } else {
        errors['unknown'] = result.reason?.message || 'Promise rejected';
      }
    }

    return new Response(JSON.stringify({
      success: true,
      details,
      errors,
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
