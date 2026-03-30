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
      jp: { name: "Japanese", instruction: "日本語で書いてください。", currency: `¥${Math.round(price * 0.1).toLocaleString()}` },
      us: { name: "English", instruction: "Write in English.", currency: `$${(price * 0.001).toFixed(2)}` },
      cn: { name: "Chinese Simplified", instruction: "请用简体中文写作。", currency: `¥${Math.round(price * 0.05).toLocaleString()}` },
      ar: { name: "Arabic", instruction: "اكتب بالعربية.", currency: `$${(price * 0.001).toFixed(2)}` },
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

      return `You are a world-class e-commerce product detail page designer. Create a CLEAN, WHITE-THEMED product detail page for Chameleon Printing.

DESIGN PHILOSOPHY:
- Clean white background with dark text (#333, #111)
- Professional, modern, easy-to-read layout
- Images displayed in a 2-column grid (2 images per row)
- Short, informative text — let the images do the talking
- Accent colors: #6366f1 (indigo), #4f46e5 (blue), #16a34a (green)

HTML RULES:
- You CAN use <div> with inline styles for layout
- Use: <div>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <img>, <hr>, <br>
- 2-column image grid: <div style="display:flex; flex-wrap:wrap; gap:8px;"> then each image: <div style="flex:0 0 calc(50% - 4px);"><img src="URL" alt="text" style="width:100%; height:auto; object-fit:cover; border-radius:8px;"></div>
- DO NOT use dark backgrounds. All backgrounds must be white or transparent.
- Text color must be dark (#333 or #111).

PRODUCT INFO:
- Name: ${product_name}
- Category: ${product_category || 'General'}
${reference_text ? `- Reference/Notes: ${reference_text}` : ''}
${original_description ? `
EXISTING PRODUCT DESCRIPTION (incorporate useful details):
---
${original_description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000)}
---` : ''}

IMAGES (${allImages.length} total — use ALL of them):
${imageListText}

REQUIRED STRUCTURE:

1. PRODUCT TITLE
   <h2 style="font-size:24px; font-weight:900; color:#111; margin-bottom:20px;">${product_name}</h2>

2. IMAGE GALLERY — ALL images in a 2-column grid (2 per row)
   <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">
     <div style="flex:0 0 calc(50% - 4px);"><img src="IMAGE_1" alt="product" style="width:100%; height:auto; object-fit:cover; border-radius:8px;"></div>
     <div style="flex:0 0 calc(50% - 4px);"><img src="IMAGE_2" alt="product" style="width:100%; height:auto; object-fit:cover; border-radius:8px;"></div>
   </div>

3. PRODUCT DESCRIPTION — 2-3 sentences about the product
   <p style="color:#333; font-size:15px; line-height:1.8;">Description text</p>

4. KEY FEATURES
   <h3 style="color:#111; font-size:18px; margin-top:20px;">Features</h3>
   <ul style="color:#444; font-size:14px; line-height:2;">
     <li>Feature text</li>
   </ul>

5. DETAILS — Specs, materials, use cases (if applicable)

CRITICAL RULES:
- Use ALL ${allImages.length} images in a 2-column grid (2 images per row)
- Grid: flex layout with calc(50% - 4px) width, height:auto
- NO dark backgrounds — white/transparent only
- NO dark text colors — use #333 or #111
- Keep text concise and informative
- NEVER include any price, cost, or monetary amount
- Do NOT use <table> tags

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
- NEVER include any price, cost, or monetary amount — no won, yen, dollar amounts

Product info:
- Name: ${product_name}
- Category: ${product_category}
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
        const maxTokens = isWizard ? 4000 : 1500;
        const models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"];

        for (const model of models) {
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
            console.error(`Claude API error (${model}) for ${lang}: ${res.status} - ${errBody}`);
            if (model === models[models.length - 1]) {
              return { lang, html: null, error: `API ${res.status}: ${errBody.substring(0, 200)}` };
            }
            console.log(`Falling back to next model...`);
            continue;
          }

          const data = await res.json();
          if (!data.content || data.content.length === 0) {
            console.error(`Claude empty response (${model}) for ${lang}`);
            continue;
          }
          let html = data.content.map((b: any) => b.text || "").join("");
          html = html.replace(/```html?\s*\n?/g, '').replace(/```\s*$/g, '').trim();
          if (html) return { lang, html };
        }
        return { lang, html: null, error: 'All models failed' };
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
