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

    // ★ 핵심: 외부 이미지를 Supabase Storage에 먼저 업로드 (프록시)
    // Replicate가 외부 사이트 이미지에 접근 못하는 문제 해결
    let proxyImageUrl = image_url;
    if (!image_url.includes('supabase.co')) {
      console.log("외부 이미지 프록시 업로드 중:", image_url);
      const proxyRes = await fetch(image_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
          'Referer': new URL(image_url).origin,
        }
      });

      if (!proxyRes.ok) throw new Error(`이미지 다운로드 실패: ${proxyRes.status}`);

      const proxyBlob = await proxyRes.blob();
      const contentType = proxyRes.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const proxyPath = `products/proxy_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;

      const { error: proxyErr } = await supabase.storage
        .from('products')
        .upload(proxyPath, proxyBlob, { contentType, upsert: false });

      if (proxyErr) throw new Error("프록시 이미지 업로드 실패: " + proxyErr.message);

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(proxyPath);
      proxyImageUrl = publicUrl;
      console.log("프록시 완료:", proxyImageUrl);
    }

    let generatedImageUrl: string;
    let promptUsed = "";

    if (mode === 'variation') {
      // Track A: Flux Redux-Schnell (이미지 변형)
      const output = await replicate.run(
        "black-forest-labs/flux-redux-schnell",
        {
          input: {
            redux_image: proxyImageUrl,
            aspect_ratio: aspect_ratio,
            num_outputs: 1,
            num_inference_steps: 4,
            output_format: "jpg",
            output_quality: 90
          }
        }
      );
      generatedImageUrl = Array.isArray(output) ? String(output[0]) : String(output);
      promptUsed = `[flux-redux-schnell] variation`;

    } else {
      // Track B/C: Claude Vision → Flux Schnell
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set for reimagine/bg_change mode");

      // 이미지 다운로드 → base64 (Claude Vision 용)
      const imgRes = await fetch(proxyImageUrl);
      const imgArrayBuffer = await imgRes.arrayBuffer();
      const imgBytes = new Uint8Array(imgArrayBuffer);

      // 청크 단위로 base64 변환 (대용량 이미지 메모리 오류 방지)
      const chunks: string[] = [];
      const chunkSize = 32768;
      for (let i = 0; i < imgBytes.length; i += chunkSize) {
        const chunk = imgBytes.subarray(i, i + chunkSize);
        chunks.push(String.fromCharCode(...chunk));
      }
      const base64 = btoa(chunks.join(''));
      const mediaType = imgRes.headers.get('content-type') || 'image/jpeg';

      // 모드별 시스템 프롬프트 분기
      const systemPrompt = mode === 'bg_change'
        ? `You are an AI product photographer. Analyze the given product image and create a prompt for Flux image generation.
The goal is to keep the EXACT SAME product (shape, color, design, text, logo) but place it on a DIFFERENT clean background.

Rules:
- Describe the product in EXTREME detail (exact shape, colors, materials, text/logos, proportions)
- The product must look IDENTICAL to the original
- Change ONLY the background: use a clean white studio background with soft shadows
- Professional product photography style, centered composition
- Output ONLY the English prompt, nothing else
- Keep it under 200 words
${prompt_hint ? '- Product name: ' + prompt_hint : ''}`
        : `You are an AI art director. Analyze the given product image and create a detailed prompt for Flux image generation.
The generated image should look SIMILAR in concept but NOT identical (for copyright safety).

Rules:
- Describe the product type, colors, composition, lighting, background
- Change subtle details (angle, lighting direction, background texture)
- Output ONLY the English prompt, nothing else
- Keep it under 150 words
${prompt_hint ? '- Product name hint: ' + prompt_hint : ''}`;

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
          system: systemPrompt,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: mode === 'bg_change'
                ? "Describe this product precisely and create a prompt to recreate it on a clean white background:"
                : "Create a Flux generation prompt for a similar product image:" }
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

    // 생성된 이미지를 Supabase Storage에 저장
    const finalRes = await fetch(generatedImageUrl);
    const finalBlob = await finalRes.blob();
    const finalPath = `products/ai_reimagine_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(finalPath, finalBlob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

    const { data: { publicUrl: finalUrl } } = supabase.storage.from('products').getPublicUrl(finalPath);

    return new Response(JSON.stringify({
      success: true,
      image_url: finalUrl,
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
