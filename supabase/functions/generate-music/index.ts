// supabase/functions/generate-music/index.ts
// AI Music generation using Replicate (minimax/music-01)
// Supports vocals + lyrics generation
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
      const { prompt, lyrics } = body;
      if (!prompt && !lyrics) throw new Error('prompt or lyrics is required');

      // Build input for minimax/music-01
      const input: Record<string, unknown> = {};
      if (prompt) input.prompt = prompt;
      if (lyrics) input.lyrics = lyrics.substring(0, 400); // max 400 chars

      // Use model-based endpoint for minimax/music-01
      const replicateRes = await fetch("https://api.replicate.com/v1/models/minimax/music-01/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Prefer": "respond-async",
        },
        body: JSON.stringify({ input }),
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
