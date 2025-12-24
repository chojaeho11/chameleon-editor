// supabase/functions/upscale-image/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { image, scale = 2 } = payload;

    if (!image) throw new Error('이미지 데이터가 없습니다.');

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!REPLICATE_API_TOKEN) throw new Error('API 토큰 설정 오류');

    // Replicate API 호출 (Real-ESRGAN)
    const startRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 가장 안정적인 Real-ESRGAN 버전
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        input: {
          image: image,
          scale: scale,
          face_enhance: true // 얼굴 보정 (사람 사진에 효과적)
        },
      }),
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      throw new Error(`Replicate 요청 거부: ${errText}`);
    }

    const prediction = await startRes.json();
    let status = prediction.status;
    let resultUrl = null;

    // 대기 (Polling)
    while (status !== "succeeded" && status !== "failed") {
      await new Promise(r => setTimeout(r, 1000));
      const checkRes = await fetch(prediction.urls.get, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` }
      });
      const checkJson = await checkRes.json();
      status = checkJson.status;
      
      if (status === "succeeded") {
        resultUrl = checkJson.output;
      } else if (status === "failed") {
        // ★ 실패 원인을 정확히 로그에 남김
        console.error("AI 실패 원인:", checkJson.error);
        throw new Error(`AI 변환 실패: ${checkJson.error || "이미지가 너무 크거나 호환되지 않음"}`);
      }
    }

    return new Response(JSON.stringify({ success: true, url: resultUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});