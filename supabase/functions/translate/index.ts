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
            kr: "Korean", ko: "Korean", ja: "Japanese", en: "English",
            zh: "Chinese Simplified", ar: "Arabic", es: "Spanish", de: "German", fr: "French"
        };

        // 배치 번역 모드 (targetLangs가 배열이면)
        const targetLangs = body.targetLangs;
        const sourceLang = body.sourceLang || body.from || "auto";
        if (targetLangs && Array.isArray(targetLangs)) {
            const fromName = langNames[sourceLang] || "auto-detect";
            const langList = targetLangs.map((l: string) => `${l}: ${langNames[l] || l}`).join(', ');
            const batchPrompt = `You are a professional translator. Translate the following text ${fromName !== 'auto-detect' ? 'from ' + fromName + ' ' : ''}into these languages: ${langList}.
Rules:
- Output ONLY a JSON object with language codes as keys and translations as values.
- Example: {"ja": "翻訳", "en": "Translation"}
- Use natural, fluent expressions for each language.
- No explanations, no markdown, just pure JSON.`;
            const batchRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
                body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2000, system: batchPrompt, messages: [{ role: "user", content: text }] }),
            });
            if (!batchRes.ok) {
                return new Response(JSON.stringify({ translations: {}, error: "API " + batchRes.status }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const batchData = await batchRes.json();
            let rawText = batchData.content.map((b: any) => b.type === "text" ? b.text : "").join("");
            rawText = rawText.replace(/```(?:json)?\s*\n?/g, '').replace(/```\s*$/g, '').trim();
            try {
                const translations = JSON.parse(rawText);
                return new Response(JSON.stringify({ translations }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } catch (e) {
                return new Response(JSON.stringify({ translations: {}, error: "Parse failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }
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
