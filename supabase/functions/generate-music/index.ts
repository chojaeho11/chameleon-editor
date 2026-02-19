// supabase/functions/generate-music/index.ts
// AI Music generation using Replicate (minimax/music-01)
// Supports vocals + lyrics generation + photo analysis via Claude Vision
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: analyze-photo (Claude Vision) ───
    if (action === 'analyze-photo') {
      const { imageBase64 } = body;
      if (!imageBase64) throw new Error('imageBase64 is required');
      console.log('analyze-photo: image size =', Math.round(imageBase64.length / 1024), 'KB');

      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
      if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

      // Detect media type from base64 header or default to jpeg
      let mediaType = 'image/jpeg';
      if (imageBase64.startsWith('/9j/')) mediaType = 'image/jpeg';
      else if (imageBase64.startsWith('iVBOR')) mediaType = 'image/png';
      else if (imageBase64.startsWith('R0lGOD')) mediaType = 'image/gif';
      else if (imageBase64.startsWith('UklGR')) mediaType = 'image/webp';
      console.log('analyze-photo: mediaType =', mediaType);

      const claudeBody = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `Analyze this image and suggest music that matches its mood, theme, and atmosphere.
Return JSON ONLY (no markdown, no code fences):
{
  "style": "one of: pop, cinematic, lofi, jazz, electronic, acoustic, classical, hiphop",
  "prompt": "a short English music description (10-30 words) matching the image mood and atmosphere",
  "lyrics": "creative song lyrics inspired by this image (English, max 400 chars). Use [verse] and [chorus] tags. Write emotionally resonant lyrics."
}`
            }
          ]
        }]
      };

      console.log('analyze-photo: calling Claude API...');
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(claudeBody),
      });

      console.log('analyze-photo: Claude response status =', claudeRes.status);
      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        console.error('analyze-photo: Claude API error:', errText);
        throw new Error(`Claude API error (${claudeRes.status}): ${errText.substring(0, 300)}`);
      }

      const claudeData = await claudeRes.json();
      const text = claudeData.content?.[0]?.text || '';
      console.log('analyze-photo: Claude response text =', text.substring(0, 200));

      // Parse JSON (handle potential markdown fences)
      let parsed;
      try {
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (_e) {
        throw new Error('Failed to parse Claude response: ' + text.substring(0, 200));
      }

      return new Response(JSON.stringify({
        style: parsed.style || 'cinematic',
        prompt: parsed.prompt || '',
        lyrics: parsed.lyrics || ''
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

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

    throw new Error("Invalid action. Use 'create', 'check', or 'analyze-photo'.");

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("generate-music error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
