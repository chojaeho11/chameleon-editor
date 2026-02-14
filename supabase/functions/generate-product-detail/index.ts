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
      price = 0,
      original_description,
      langs = ["kr"]
    } = await req.json();

    if (!product_name) throw new Error("product_name is required");

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

    // 각 언어별 생성 함수
    async function generateForLang(lang: string): Promise<{ lang: string, html: string | null }> {
      const lc = langMap[lang];
      if (!lc) return { lang, html: null };

      try {
        const systemPrompt = `You are a product detail page writer for a printing company.

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
- Image: ${image_url}
- Specs: ${JSON.stringify(product_specs)}
${original_description ? '- Reference: ' + original_description.substring(0, 200) : ''}

Required structure:
1. <h2> with product name
2. <p><img src="${image_url}" alt="${product_name}"></p>
3. <p> with 2-3 sentence product description
4. <h3> for key features heading
5. <ul> with 3-5 <li> feature items
6. <h3> for specs/details heading (if specs available)
7. <p> with specs info
8. <hr>
9. <p> with short order/shipping info

${lc.instruction}

Output ONLY the HTML. No markdown, no code blocks, no explanation.`;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: "user", content: "Generate the product detail page HTML now." }],
          }),
        });

        if (!res.ok) {
          console.error(`Claude API error for ${lang}: ${res.status}`);
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

    // ★ 병렬 실행 (6개 언어 동시 호출 → 타임아웃 방지)
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
