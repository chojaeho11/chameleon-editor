import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("필수 API 키가 설정되지 않았습니다.");
    }

    const { image_url, mode = 'variation', prompt_hint, aspect_ratio = '1:1' } = await req.json();
    if (!image_url) throw new Error("image_url is required");

    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let generatedImageUrl: string;
    let promptUsed = "";

    if (mode === 'variation') {
      // Track A: Flux Redux-Schnell (이미지 변형)
      const output = await replicate.run(
        "black-forest-labs/flux-redux-schnell",
        {
          input: {
            redux_image: image_url,
            aspect_ratio: aspect_ratio,
            num_outputs: 1,
            num_inference_steps: 4,
            output_format: "jpg",
            output_quality: 90
          }
        }
      );
      generatedImageUrl = Array.isArray(output) ? String(output[0]) : String(output);
      promptUsed = `[flux-redux-schnell] variation of: ${image_url}`;

    } else {
      // Track B: Claude Vision → Flux Schnell (텍스트 기반 재생성)
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set for reimagine mode");

      // 이미지 다운로드 → base64
      const imgRes = await fetch(image_url);
      const imgArrayBuffer = await imgRes.arrayBuffer();
      const imgBytes = new Uint8Array(imgArrayBuffer);
      let base64 = "";
      for (let i = 0; i < imgBytes.length; i++) {
        base64 += String.fromCharCode(imgBytes[i]);
      }
      base64 = btoa(base64);
      const mediaType = imgRes.headers.get('content-type') || 'image/jpeg';

      // Claude Vision으로 이미지 분석 → 생성 프롬프트
      const analysisRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          system: `You are an AI art director. Analyze the given product image and create a detailed prompt for Flux image generation.
The generated image should look SIMILAR in concept but NOT identical (for copyright safety).

Rules:
- Describe the product type, colors, composition, lighting, background
- Change subtle details (angle, lighting direction, background texture)
- Output ONLY the English prompt, nothing else
- Keep it under 150 words
${prompt_hint ? '- Product name hint: ' + prompt_hint : ''}`,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "Create a Flux generation prompt for a similar product image:" }
            ]
          }],
        }),
      });

      const analysisData = await analysisRes.json();
      promptUsed = analysisData.content.map((b: any) => b.text || "").join("");

      // Flux Schnell로 이미지 생성
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: promptUsed,
            aspect_ratio: aspect_ratio,
            output_format: "jpg",
            output_quality: 90,
            disable_safety_checker: true
          }
        }
      );
      generatedImageUrl = Array.isArray(output) ? String(output[0]) : String(output);
    }

    // Supabase Storage에 저장
    const imageRes = await fetch(generatedImageUrl);
    const imageBlob = await imageRes.blob();
    const fileName = `products/ai_reimagine_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, imageBlob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      prompt_used: promptUsed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("reimagine-product error:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
