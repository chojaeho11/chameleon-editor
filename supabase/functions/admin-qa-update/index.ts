// ============================================================
// admin-qa-update: AI 학습 시스템 — 답변 저장/번역 프록시
// [배포] supabase functions deploy admin-qa-update --no-verify-jwt
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED_ORIGINS = [
    'https://www.cafe2626.com', 'https://www.cafe0101.com', 'https://www.cafe3355.com',
    'https://cafe2626.com', 'https://cafe0101.com', 'https://cafe3355.com',
];

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('origin') || '';
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
}

async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
    const langNames: Record<string, string> = { kr: 'Korean', ja: 'Japanese', us: 'English', en: 'English' };
    const from = langNames[fromLang] || fromLang;
    const to = langNames[toLang] || toLang;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            messages: [{
                role: "user",
                content: `Translate the following ${from} text to ${to}. Return ONLY the translated text, nothing else. Keep emojis, product names, and technical printing terms accurate.\n\n${text}`
            }],
        }),
    });

    if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || text;
}

serve(async (req) => {
    const cors = getCorsHeaders(req);
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }

    try {
        const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const body = await req.json();
        const { action } = body;

        // ── save_answer: 관리자 답변 저장 + 자동 번역 ──
        if (action === "save_answer") {
            const { qa_id, admin_answer_ko, lang, category } = body;
            if (!qa_id || !admin_answer_ko) {
                return new Response(JSON.stringify({ error: "qa_id and admin_answer_ko required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            let adminAnswer = admin_answer_ko;

            // 비-KR이면 해당 언어로 번역
            if (lang && lang !== 'kr') {
                adminAnswer = await translateText(admin_answer_ko, 'kr', lang);
            }

            const { error } = await sb.from('advisor_qa_log').update({
                admin_answer: adminAnswer,
                admin_answer_ko: admin_answer_ko,
                is_reviewed: true,
                reviewed_at: new Date().toISOString(),
                category: category || 'general',
            }).eq('id', qa_id);

            if (error) throw error;

            return new Response(JSON.stringify({
                success: true,
                admin_answer: adminAnswer,
                admin_answer_ko: admin_answer_ko,
            }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // ── translate_message: 고객 메시지 한국어 번역 (캐싱) ──
        if (action === "translate_message") {
            const { qa_id, customer_message, lang } = body;
            if (!qa_id) {
                return new Response(JSON.stringify({ error: "qa_id required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            // 캐시 확인
            const { data: existing } = await sb.from('advisor_qa_log')
                .select('customer_message_ko')
                .eq('id', qa_id)
                .single();

            if (existing?.customer_message_ko) {
                return new Response(JSON.stringify({ translated: existing.customer_message_ko, cached: true }),
                    { headers: { ...cors, "Content-Type": "application/json" } });
            }

            // 번역
            const msgToTranslate = customer_message || '';
            if (!msgToTranslate || msgToTranslate === '(image)') {
                return new Response(JSON.stringify({ translated: msgToTranslate, cached: false }),
                    { headers: { ...cors, "Content-Type": "application/json" } });
            }

            const translated = await translateText(msgToTranslate, lang || 'ja', 'kr');

            // DB에 캐시 저장
            await sb.from('advisor_qa_log').update({
                customer_message_ko: translated
            }).eq('id', qa_id);

            return new Response(JSON.stringify({ translated, cached: false }),
                { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // ── translate_ai_response: AI 응답 한국어 번역 ──
        if (action === "translate_ai_response") {
            const { qa_id, ai_response, lang } = body;
            if (!qa_id || !ai_response) {
                return new Response(JSON.stringify({ error: "qa_id and ai_response required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            const translated = await translateText(ai_response, lang || 'ja', 'kr');
            return new Response(JSON.stringify({ translated }),
                { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // ── bulk_translate: 일괄 번역 ──
        if (action === "bulk_translate") {
            const { qa_ids } = body;
            if (!qa_ids || !Array.isArray(qa_ids)) {
                return new Response(JSON.stringify({ error: "qa_ids array required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            const results: Record<string, string> = {};
            for (const id of qa_ids.slice(0, 20)) { // 최대 20개
                const { data } = await sb.from('advisor_qa_log')
                    .select('customer_message, lang, customer_message_ko')
                    .eq('id', id)
                    .single();

                if (!data || data.customer_message_ko) {
                    results[id] = data?.customer_message_ko || '';
                    continue;
                }

                if (!data.customer_message || data.customer_message === '(image)') {
                    results[id] = data.customer_message || '';
                    continue;
                }

                const translated = await translateText(data.customer_message, data.lang || 'ja', 'kr');
                await sb.from('advisor_qa_log').update({ customer_message_ko: translated }).eq('id', id);
                results[id] = translated;
            }

            return new Response(JSON.stringify({ success: true, translations: results }),
                { headers: { ...cors, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "Unknown action: " + action }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("admin-qa-update error:", error);
        return new Response(JSON.stringify({ error: error.message || "Internal error" }),
            { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
});
