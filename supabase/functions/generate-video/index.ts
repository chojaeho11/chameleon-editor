// supabase/functions/generate-video/index.ts
// AI Image-to-Video generation using Replicate (minimax/video-01-live)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    const body = await req.json();
    const { action } = body;

    // ─── ACTION: create ───
    // Accepts base64 image, uploads to storage, creates Replicate prediction
    if (action === 'create') {
      const { imageBase64, prompt, duration } = body;
      if (!imageBase64) throw new Error('imageBase64 is required');

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase env not set');

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Upload base64 image to Supabase storage for a public URL
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `ai_video_src_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;

      const { error: uploadError } = await supabase.storage
        .from('design')
        .upload(`ai_video/${fileName}`, imageBytes, { contentType: 'image/png', upsert: false });

      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('design')
        .getPublicUrl(`ai_video/${fileName}`);

      // Create Replicate prediction (async — returns immediately)
      const replicateRes = await fetch("https://api.replicate.com/v1/models/minimax/video-01-live/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Prefer": "respond-async",
        },
        body: JSON.stringify({
          input: {
            prompt: prompt || "gentle smooth camera movement, cinematic",
            first_frame_image: publicUrl,
          }
        }),
      });

      if (!replicateRes.ok) {
        const errText = await replicateRes.text();
        throw new Error(`Replicate request failed: ${errText}`);
      }

      const prediction = await replicateRes.json();

      return new Response(JSON.stringify({
        predictionId: prediction.id,
        status: prediction.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: check ───
    // Polls prediction status by ID
    if (action === 'check') {
      const { predictionId } = body;
      if (!predictionId) throw new Error('predictionId is required');

      const checkRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_TOKEN}` },
      });

      if (!checkRes.ok) {
        const errText = await checkRes.text();
        throw new Error(`Status check failed: ${errText}`);
      }

      const prediction = await checkRes.json();

      return new Response(JSON.stringify({
        status: prediction.status,
        output: prediction.output,
        error: prediction.error,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error("Invalid action. Use 'create' or 'check'.");

  } catch (error) {
    console.error("generate-video error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
