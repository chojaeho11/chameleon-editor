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
                JSON.stringify({ translated: "", error: "API key not configured" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body = await req.json();
        const text = body.text;
        const from = body.from || "auto";
        const to = body.to || "kr";

        if (!text) {
            return new Response(
                JSON.stringify({ translated: "", error: "text is required" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const langNames: Record<string, string> = {
            kr: "Korean", ja: "Japanese", en: "English"
        };
        const fromLang = langNames[from] || "auto-detect";
        const toLang = langNames[to] || "Korean";

        const systemPrompt = `You are a professional translator. Translate the following text ${fromLang !== 'auto-detect' ? 'from ' + fromLang + ' ' : ''}to ${toLang}.
Rules:
- Output ONLY the translated text, nothing else.
- Preserve formatting, line breaks, and emojis.
- Use natural, fluent ${toLang} appropriate for customer service context.
- Do not add explanations or notes.`;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1000,
                system: systemPrompt,
                messages: [{ role: "user", content: text }],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Claude API Error:", res.status, errText);
            return new Response(
                JSON.stringify({ translated: "", error: "Claude API " + res.status + ": " + errText.substring(0, 200) }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await res.json();
        const translated = data.content
            .map((b: any) => (b.type === "text" ? b.text : ""))
            .filter(Boolean)
            .join("\n");

        return new Response(
            JSON.stringify({ translated }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("Translate Error:", error);
        return new Response(
            JSON.stringify({ translated: "", error: String(error?.message || error) }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
