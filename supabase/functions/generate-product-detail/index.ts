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
    };

    // 각 언어별 생성 함수
    async function generateForLang(lang: string): Promise<{ lang: string, html: string | null }> {
      const lc = langMap[lang];
      if (!lc) return { lang, html: null };

      try {
        const systemPrompt = `You are a premium product detail page HTML designer for a professional printing company.

Create a beautiful, modern product detail page HTML.

Design Rules:
- Use ONLY inline HTML with inline styles (no external CSS, no <style> tags, no <script>)
- Modern premium design: gradients, box-shadows, border-radius
- Sections: hero banner with product image, key features (3-4 icons), specifications table, usage examples, order benefits
- Brand colors: primary purple (#6366f1), dark (#1e1b4b), accent (#a855f7)
- Image URL: ${image_url}
- Product: ${product_name}
- Category: ${product_category}
- Price: ${lc.currency}
- Specs: ${JSON.stringify(product_specs)}
- Use percentage widths for responsiveness (max-width: 800px, margin: 0 auto)
- Add relevant emojis for visual appeal
${original_description ? '- Reference: ' + original_description.substring(0, 200) : ''}

${lc.instruction}

Output ONLY the HTML content. No markdown code blocks, no explanation.`;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4000,
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
