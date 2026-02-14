import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body = await req.json();
        const { texts, voice, speed, lang } = body;

        if (!texts || !Array.isArray(texts) || texts.length === 0) {
            return new Response(
                JSON.stringify({ error: "texts array is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 전체 나레이션 텍스트를 하나로 합침 (문장 간 자연스러운 쉼표 포함)
        const fullText = texts.join('. ... ');

        // 언어별 추천 voice
        const voiceMap: Record<string, string> = { kr: 'nova', ja: 'nova', en: 'onyx' };
        const selectedVoice = voice || voiceMap[lang] || 'nova';
        const selectedSpeed = speed || 1.05;

        // OpenAI TTS API (tts-1-hd = 고품질 모델)
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "tts-1-hd",
                input: fullText,
                voice: selectedVoice,
                speed: selectedSpeed,
                response_format: "mp3",
            }),
        });

        if (!ttsResponse.ok) {
            const errText = await ttsResponse.text();
            return new Response(
                JSON.stringify({ error: `OpenAI TTS error: ${errText}` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // MP3 바이너리를 base64로 인코딩 (Deno std 사용)
        const audioBuffer = new Uint8Array(await ttsResponse.arrayBuffer());
        const base64Audio = base64Encode(audioBuffer);

        return new Response(
            JSON.stringify({ audio: base64Audio, format: "mp3", sentenceCount: texts.length }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
