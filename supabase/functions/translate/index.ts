import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { text, from, to } = await req.json();
        if (!text) throw new Error("text is required");

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
                "x-api-key": ANTHROPIC_API_KEY!,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20241022",
                max_tokens: 1000,
                system: systemPrompt,
                messages: [{ role: "user", content: text }],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Claude API Error:", res.status, errText);
            throw new Error("API error " + res.status);
        }

        const data = await res.json();
        const translated = data.content
            .map((b: any) => (b.type === "text" ? b.text : ""))
            .filter(Boolean)
            .join("\n");

        return new Response(
            JSON.stringify({ translated }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Translate Error:", error);
        return new Response(
            JSON.stringify({ error: "Translation failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
