const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const body = await req.json();
    const { product_code, product_name, category_name, photo_base64, photo_media_type, count_per_lang } = body;

    if (!product_code || !product_name) {
      throw new Error("product_code and product_name are required");
    }

    const reviewCount = count_per_lang || 3;

    // Build content array for Claude
    const contentParts: any[] = [];

    // Add photo if provided
    if (photo_base64) {
      contentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: photo_media_type || "image/jpeg",
          data: photo_base64,
        },
      });
    }

    const langs = [
      { code: "kr", label: "Korean", nameField: "name" },
      { code: "ja", label: "Japanese", nameField: "name_jp" },
      { code: "en", label: "English", nameField: "name_us" },
      { code: "zh", label: "Chinese (Simplified)", nameField: "name_cn" },
      { code: "ar", label: "Arabic", nameField: "name_ar" },
      { code: "es", label: "Spanish", nameField: "name_es" },
      { code: "de", label: "German", nameField: "name_de" },
      { code: "fr", label: "French", nameField: "name_fr" },
    ];

    const prompt = `You are a review generator for a printing/custom product company. Generate realistic customer reviews that sound completely natural and human-written.

Product: "${product_name}"
${category_name ? `Category: "${category_name}"` : ""}
${photo_base64 ? "A product photo is attached. Analyze the photo carefully - describe the print quality, material texture, colors, finishing, and any details visible. Make reviews reference specific visual details from the photo." : ""}

Generate exactly ${reviewCount} reviews for EACH of these 8 languages: Korean, Japanese, English, Chinese (Simplified), Arabic, Spanish, German, French.

CRITICAL RULES:
1. Each review must sound like a REAL customer wrote it - varying lengths (30-150 chars), different writing styles, some casual, some detailed
2. Use realistic local names for each country:
   - Korean: 김**, 이**, 박**, 최**, 정**, 강**, 조**, 윤**, 장**, 임** (surname + **)
   - Japanese: 田中**, 佐藤**, 鈴木**, 高橋**, 渡辺**, 伊藤**, 山本**, 中村** (surname + **)
   - English: John D., Sarah M., Mike R., Emily K., David L., Anna W., Chris P., Jessica H.
   - Chinese: 王**, 李**, 张**, 刘**, 陈**, 杨**, 赵**, 黄**
   - Arabic: أحمد **، فاطمة **، محمد **، نورة **، خالد **، سارة **
   - Spanish: Carlos M., María L., Juan R., Ana G., Pedro S., Laura D.
   - German: Thomas M., Anna K., Stefan R., Maria H., Klaus W., Julia B.
   - French: Pierre D., Marie L., Jean M., Sophie R., Nicolas B., Claire V.
3. Ratings: 70% five stars, 20% four stars, 10% three stars. Never below 3.
4. If photo provided, 40% of reviews should mention specific details visible in the photo (material, color, print sharpness, texture, packaging)
5. Some reviews should mention: fast delivery, good quality, gift purpose, repeat purchase, comparison with expectations
6. Use natural punctuation - some with emoji, some without, some with typos or casual grammar
7. DO NOT use the word "review" in reviews. Write like real customers sharing experiences.
8. Vary the created_at dates - spread across the last 90 days randomly

Return a JSON object with this exact structure:
{
  "reviews": [
    {
      "lang": "kr",
      "user_name": "김** 님",
      "rating": 5,
      "comment": "...",
      "days_ago": 3
    }
  ]
}

Return ONLY the JSON, no markdown, no explanation.`;

    contentParts.push({ type: "text", text: prompt });

    console.log(`[generate-review] product=${product_code}, photo=${!!photo_base64}, count=${reviewCount}`);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8000,
        messages: [{ role: "user", content: contentParts }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[generate-review] Anthropic error: ${res.status}`, errText);
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const aiResult = await res.json();
    const rawText = aiResult.content?.[0]?.text || "";

    // Parse JSON from response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(rawText);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    const reviews = parsed.reviews || [];
    if (reviews.length === 0) {
      throw new Error("No reviews generated");
    }

    // Build insert rows
    const now = new Date();
    const insertRows = reviews.map((r: any) => ({
      product_code: product_code,
      user_id: null,
      user_name: r.user_name,
      rating: Math.min(5, Math.max(1, r.rating || 5)),
      comment: r.comment,
      photo_url: null,
      lang: r.lang,
      is_fake: true,
      created_at: new Date(now.getTime() - (r.days_ago || Math.floor(Math.random() * 90)) * 86400000).toISOString(),
    }));

    // Insert into database
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/product_reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(insertRows),
      });

      if (!dbRes.ok) {
        const dbErr = await dbRes.text();
        console.error(`[generate-review] DB insert error:`, dbErr);
        throw new Error(`DB insert failed: ${dbRes.status}`);
      }

      console.log(`[generate-review] Inserted ${insertRows.length} reviews for ${product_code}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: insertRows.length,
        langs: [...new Set(insertRows.map((r: any) => r.lang))],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error(`[generate-review] Error:`, error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
