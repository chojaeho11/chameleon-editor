// supabase/functions/generate-image-flux/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate";
import OpenAI from "https://esm.sh/openai";

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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!REPLICATE_API_TOKEN || !OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("필수 API 키가 설정되지 않았습니다.");
    }

    const { prompt, ratio = "1:1" } = await req.json();

    // 1. GPT 번역 & 태그 추출
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" }, 
      messages: [
        {
          role: "system",
          content: `You are an AI prompt engineer.
          1. Translate input to English for Flux.1.
          2. Extract 5 Korean, 5 English, 5 Japanese keywords (comma separated).
          
          Output JSON:
          {
            "translated_prompt": "string",
            "keywords": "string"
          }`
        },
        { role: "user", content: prompt }
      ],
    });

    const gptResult = JSON.parse(completion.choices[0].message.content);
    const translatedPrompt = gptResult.translated_prompt;
    const searchKeywords = gptResult.keywords; 

    // 2. Flux 이미지 생성
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: translatedPrompt,
          aspect_ratio: ratio,
          output_format: "jpg",
          output_quality: 90,
          disable_safety_checker: true 
        },
      }
    );
    
    let tempImageUrl = Array.isArray(output) ? output[0] : output;
    tempImageUrl = String(tempImageUrl);

    // 3. 서버 저장 및 DB 등록
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const imageRes = await fetch(tempImageUrl);
    const imageBlob = await imageRes.blob();
    const fileName = `ai_gen_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    
    const { error: uploadError } = await supabase
      .storage
      .from('design') 
      .upload(`ai_uploads/${fileName}`, imageBlob, { contentType: 'image/jpeg', upsert: false });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase
        .storage
        .from('design')
        .getPublicUrl(`ai_uploads/${fileName}`);

      // Fabric JSON 생성
      const fabricJsonObj = {
        version: "5.3.0",
        objects: [
          {
            type: "image",
            version: "5.3.0",
            originX: "center",
            originY: "center",
            left: 500, top: 500,
            src: publicUrl,
            crossOrigin: "anonymous"
          }
        ]
      };

      // ★ [수정 핵심] 테이블에 확실히 존재하는 컬럼만 넣습니다.
      // width, height, product_key 등 없는 컬럼은 뺐습니다.
      const dbPayload = {
        category: 'photo-bg',
        tags: `auto,AI,${searchKeywords}`, 
        thumb_url: publicUrl,
        data_url: JSON.stringify(fabricJsonObj) // 객체를 문자열로 변환해서 저장
      };

      const { error: dbError } = await supabase
        .from('library')
        .insert(dbPayload);

      if (dbError) {
        console.error("DB Insert Error:", dbError);
      } else {
        tempImageUrl = publicUrl;
      }
    }

    return new Response(JSON.stringify({ imageUrl: tempImageUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});