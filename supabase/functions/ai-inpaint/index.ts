// supabase/functions/ai-inpaint/index.ts
// AI Inpainting: mask-based image editing (remove, replace, generate)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN not set");

    const { image_base64, mask_base64, prompt, mode } = await req.json();
    // mode: 'remove' (erase object), 'replace' (replace with prompt), 'edit' (AI edit with prompt)

    if (!image_base64 || !mask_base64) {
      throw new Error("image_base64 and mask_base64 are required");
    }

    console.log(`[ai-inpaint] mode=${mode}, prompt=${prompt?.substring(0,50)}, img=${(image_base64.length*0.75/1024).toFixed(0)}KB`);

    // Translate prompt if non-English
    let englishPrompt = prompt || '';
    if (englishPrompt && OPENAI_API_KEY && /[가-힣ぁ-んァ-ヶ]/.test(englishPrompt)) {
      try {
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Translate the following to a concise English description for AI image inpainting. Return ONLY the English text." },
            { role: "user", content: englishPrompt }
          ],
          max_tokens: 150,
        });
        englishPrompt = completion.choices[0].message.content?.trim() || englishPrompt;
        console.log(`[ai-inpaint] translated prompt: ${englishPrompt}`);
      } catch (e) {
        console.warn(`[ai-inpaint] translation failed:`, e.message);
      }
    }

    // Convert base64 to data URI if needed
    const imageUri = image_base64.startsWith('data:') ? image_base64 : `data:image/png;base64,${image_base64}`;
    const maskUri = mask_base64.startsWith('data:') ? mask_base64 : `data:image/png;base64,${mask_base64}`;

    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    let output;

    if (mode === 'remove' || !englishPrompt) {
      // Object removal: use LaMa or Flux Fill with empty prompt
      output = await replicate.run(
        "black-forest-labs/flux-fill-pro",
        {
          input: {
            image: imageUri,
            mask: maskUri,
            prompt: englishPrompt || "clean empty background, seamless natural texture",
            output_format: "jpg",
            safety_tolerance: 5,
          },
        }
      );
    } else {
      // Replace/Edit: use Flux Fill with descriptive prompt
      output = await replicate.run(
        "black-forest-labs/flux-fill-pro",
        {
          input: {
            image: imageUri,
            mask: maskUri,
            prompt: englishPrompt,
            output_format: "jpg",
            safety_tolerance: 5,
          },
        }
      );
    }

    let resultUrl = Array.isArray(output) ? output[0] : output;
    resultUrl = String(resultUrl);

    console.log(`[ai-inpaint] result: ${resultUrl.substring(0, 80)}...`);

    return new Response(
      JSON.stringify({ imageUrl: resultUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    console.error('[ai-inpaint] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
