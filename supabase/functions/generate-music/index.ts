// supabase/functions/generate-music/index.ts
// AI Music generation using Replicate (meta/musicgen)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    if (action === 'create') {
      const { prompt, style, duration } = body;
      if (!prompt && !style) throw new Error('prompt or style is required');

      const fullPrompt = [prompt, style].filter(Boolean).join(', ');

      // Use version-based endpoint for meta/musicgen
      const replicateRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Prefer": "respond-async",
        },
        body: JSON.stringify({
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
          input: {
            prompt: fullPrompt,
            duration: duration || 10,
            model_version: "stereo-melody-large",
            output_format: "mp3",
            normalization_strategy: "loudness",
            top_k: 250,
            top_p: 0,
            temperature: 1,
            classifier_free_guidance: 3,
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
    console.error("generate-music error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
