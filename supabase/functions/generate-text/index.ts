// ============================================================
// supabase/functions/generate-text/index.ts
// AI 디자인 마법사용 짧은 홍보 텍스트 생성
//
// [배포] supabase functions deploy generate-text --project-ref qinvtnhiidtmrzosyvys
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (!ANTHROPIC_API_KEY) {
            return new Response(
                JSON.stringify({ text: "" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { prompt, max_tokens } = await req.json();
        if (!prompt) {
            return new Response(
                JSON.stringify({ text: "" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: max_tokens || 200,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!res.ok) {
            console.error("Claude API error:", res.status);
            return new Response(
                JSON.stringify({ text: "" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await res.json();
        const text = data.content
            .map((b: any) => (b.type === "text" ? b.text : ""))
            .filter(Boolean)
            .join("")
            .trim();

        return new Response(
            JSON.stringify({ text }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("generate-text error:", error);
        return new Response(
            JSON.stringify({ text: "" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
