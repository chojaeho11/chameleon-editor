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

        // ── extract_qa: 상담 종료 시 대화에서 Q&A 자동 추출 ──
        if (action === "extract_qa") {
            const { room_id } = body;
            if (!room_id) {
                return new Response(JSON.stringify({ error: "room_id required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            // 1) 채팅 메시지 가져오기
            const { data: messages, error: msgErr } = await sb.from('chat_messages')
                .select('sender_type, sender_name, message, created_at')
                .eq('room_id', room_id)
                .neq('sender_type', 'admin_memo')
                .neq('sender_type', 'internal')
                .order('created_at', { ascending: true })
                .limit(100);

            if (msgErr || !messages || messages.length < 2) {
                return new Response(JSON.stringify({ success: true, extracted: 0, reason: 'too_few_messages' }),
                    { headers: { ...cors, "Content-Type": "application/json" } });
            }

            // 2) 채팅방 정보
            const { data: room } = await sb.from('chat_rooms')
                .select('customer_name, site_lang, source')
                .eq('id', room_id).single();
            const lang = room?.site_lang || 'kr';

            // 3) 대화 텍스트 구성
            const chatText = messages.map((m: any) => {
                const role = m.sender_type === 'customer' ? '고객'
                    : m.sender_type === 'manager' ? '매니저(' + (m.sender_name || '') + ')'
                    : m.sender_type === 'chatbot' ? 'AI봇' : '시스템';
                return `[${role}] ${m.message}`;
            }).join('\n');

            // 4) Claude에게 Q&A 추출 요청
            const extractRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: "claude-haiku-4-5-20251001",
                    max_tokens: 4000,
                    messages: [{
                        role: "user",
                        content: `다음은 인쇄 쇼핑몰 "카멜레온프린팅"의 고객 상담 대화입니다.
이 대화에서 다른 고객에게도 유용할 Q&A 쌍을 추출하세요.

규칙:
- 단순 인사, 감사 등은 제외
- 제품 정보, 가격, 사이즈, 배송, 제작 방법 등 실질적인 내용만 추출
- 매니저가 답변한 내용을 기준으로 정확한 답변 작성
- 고객 질문은 일반화하여 다른 고객도 물어볼 수 있는 형태로
- 카테고리: 상품사례, 가격, 배송, 사이즈, 제작방법, 결제, 일반 중 선택
- 키워드를 쉼표로 구분하여 포함
- 최대 5개 Q&A 추출
- JSON 배열로만 응답, 다른 텍스트 없이

응답 형식:
[{"question":"고객 질문","answer":"매니저 답변 기반 정확한 답","category":"카테고리","keywords":"키워드1,키워드2"}]

추출할 내용이 없으면 빈 배열 [] 반환.

=== 대화 내용 ===
${chatText}`
                    }],
                }),
            });

            if (!extractRes.ok) {
                console.error('Q&A extraction API error:', extractRes.status);
                return new Response(JSON.stringify({ success: false, error: 'API error' }),
                    { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
            }

            const extractData = await extractRes.json();
            const rawText = extractData.content?.[0]?.text || '[]';

            // JSON 파싱 (코드블록 제거)
            let qaList: any[] = [];
            try {
                const cleaned = rawText.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
                qaList = JSON.parse(cleaned);
            } catch (e) {
                console.warn('Q&A JSON parse failed:', rawText);
                return new Response(JSON.stringify({ success: true, extracted: 0, reason: 'parse_error' }),
                    { headers: { ...cors, "Content-Type": "application/json" } });
            }

            if (!Array.isArray(qaList) || qaList.length === 0) {
                return new Response(JSON.stringify({ success: true, extracted: 0 }),
                    { headers: { ...cors, "Content-Type": "application/json" } });
            }

            // 5) advisor_qa_log에 자동 저장 (is_reviewed=true, 출처 표시)
            const inserts = qaList.slice(0, 5).map((qa: any) => ({
                lang: lang,
                customer_message: qa.question || '',
                customer_message_ko: lang !== 'kr' ? null : qa.question,
                ai_response: '[자동추출] 매니저 상담 기반',
                admin_answer: qa.answer || '',
                admin_answer_ko: qa.answer || '',
                is_reviewed: true,
                reviewed_at: new Date().toISOString(),
                category: qa.category || 'general',
                is_active: true,
                has_image: false,
            }));

            const { error: insErr } = await sb.from('advisor_qa_log').insert(inserts);
            if (insErr) console.error('Q&A insert error:', insErr);

            // 6) 채팅방에 추출 결과 메모
            await sb.from('chat_messages').insert({
                room_id: room_id,
                sender_type: 'admin_memo',
                sender_name: 'AI 학습',
                message: `📚 대화에서 ${qaList.length}개 Q&A 자동 추출 완료\n` +
                    qaList.map((q: any, i: number) => `${i+1}. ${q.question}`).join('\n'),
            });

            return new Response(JSON.stringify({
                success: true,
                extracted: qaList.length,
                qa_list: qaList,
            }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // ── natural_learn: 자연어 학습 (한국어 → Q&A 파싱 + 키워드 8개국어 번역) ──
        if (action === "natural_learn") {
            const { text } = body;
            if (!text || !text.trim()) {
                return new Response(JSON.stringify({ error: "text required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            // Claude로 자연어를 Q&A + 키워드로 파싱
            const parseRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: "claude-haiku-4-5-20251001",
                    max_tokens: 1000,
                    messages: [{
                        role: "user",
                        content: `다음 한국어 텍스트를 고객 Q&A 학습 데이터로 변환하세요.

텍스트: "${text.trim()}"

규칙:
- question: 고객이 물어볼 법한 질문으로 변환
- answer: 원본 텍스트의 정보를 바탕으로 친절한 답변
- keywords: 핵심 키워드 2~4개 (한국어, 쉼표 구분)
- JSON만 응답, 다른 텍스트 없이

응답 형식:
{"question":"고객 질문","answer":"답변","keywords":"키워드1,키워드2"}`
                    }],
                }),
            });

            if (!parseRes.ok) throw new Error(`Parse API error: ${parseRes.status}`);
            const parseData = await parseRes.json();
            const rawText = (parseData.content?.[0]?.text || '{}').replace(/```json?\s*/g, '').replace(/```/g, '').trim();

            let parsed: any;
            try { parsed = JSON.parse(rawText); } catch(e) { throw new Error('AI 응답 파싱 실패: ' + rawText.substring(0, 200)); }

            // 키워드 8개국어 번역
            const kwKo = parsed.keywords || '';
            let kwTranslations: any = { ko: kwKo.split(',').map((k: string) => k.trim()).filter(Boolean) };

            if (kwKo) {
                const kwRes = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": ANTHROPIC_API_KEY!,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: "claude-haiku-4-5-20251001",
                        max_tokens: 500,
                        messages: [{
                            role: "user",
                            content: `Translate these Korean keywords to 7 languages. Return JSON only, no other text.
Keywords: ${kwKo}
Format: {"ja":["..."],"en":["..."],"zh":["..."],"ar":["..."],"es":["..."],"de":["..."],"fr":["..."]}`
                        }],
                    }),
                });
                if (kwRes.ok) {
                    const kwData = await kwRes.json();
                    const kwRaw = (kwData.content?.[0]?.text || '{}').replace(/```json?\s*/g, '').replace(/```/g, '').trim();
                    try {
                        const kwParsed = JSON.parse(kwRaw);
                        kwTranslations = { ko: kwTranslations.ko, ...kwParsed };
                    } catch(e) {}
                }
            }

            // chatbot_knowledge에 저장
            const { data: knData, error: knErr } = await sb.from('chatbot_knowledge').insert({
                question: parsed.question || text.trim(),
                answer: parsed.answer || text.trim(),
                keywords: kwKo,
                keywords_translations: kwTranslations,
                language: 'ko',
                category: 'general',
                priority: 50,
                is_active: true,
            }).select();

            // advisor_qa_log에도 저장 (product-advisor가 읽는 테이블)
            await sb.from('advisor_qa_log').insert({
                lang: 'kr',
                customer_message: parsed.question || text.trim(),
                customer_message_ko: parsed.question || text.trim(),
                ai_response: '[자연어학습]',
                admin_answer: parsed.answer || text.trim(),
                admin_answer_ko: parsed.answer || text.trim(),
                is_reviewed: true,
                reviewed_at: new Date().toISOString(),
                category: 'general',
                is_active: true,
                has_image: false,
            });

            if (knErr) throw knErr;

            return new Response(JSON.stringify({
                success: true,
                parsed: {
                    question: parsed.question,
                    answer: parsed.answer,
                    keywords: kwKo,
                    keywords_translations: kwTranslations,
                },
            }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // ── translate_keywords: 키워드 8개국어 번역 ──
        if (action === "translate_keywords") {
            const { knowledge_id, keywords } = body;
            if (!knowledge_id || !keywords) {
                return new Response(JSON.stringify({ error: "knowledge_id and keywords required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            const kwRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: "claude-haiku-4-5-20251001",
                    max_tokens: 500,
                    messages: [{
                        role: "user",
                        content: `Translate these Korean keywords to 7 languages. Return JSON only.
Keywords: ${keywords}
Format: {"ja":["..."],"en":["..."],"zh":["..."],"ar":["..."],"es":["..."],"de":["..."],"fr":["..."]}`
                    }],
                }),
            });

            if (!kwRes.ok) throw new Error(`Keyword translation API error: ${kwRes.status}`);
            const kwData = await kwRes.json();
            const kwRaw = (kwData.content?.[0]?.text || '{}').replace(/```json?\s*/g, '').replace(/```/g, '').trim();

            let translations: any = {};
            try { translations = JSON.parse(kwRaw); } catch(e) { throw new Error('Keyword parse error'); }

            const koArr = keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
            const fullTranslations = { ko: koArr, ...translations };

            await sb.from('chatbot_knowledge').update({
                keywords_translations: fullTranslations
            }).eq('id', knowledge_id);

            return new Response(JSON.stringify({ success: true, translations: fullTranslations }),
                { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // ── load_conversation: 대화 스레드 로드 ──
        if (action === "load_conversation") {
            const { room_id } = body;
            if (!room_id) {
                return new Response(JSON.stringify({ error: "room_id required" }),
                    { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
            }

            const [msgRes, roomRes] = await Promise.all([
                sb.from('chat_messages')
                    .select('sender_type, sender_name, message, created_at, file_url, file_name')
                    .eq('room_id', room_id)
                    .neq('sender_type', 'admin_memo')
                    .neq('sender_type', 'internal')
                    .order('created_at', { ascending: true })
                    .limit(100),
                sb.from('chat_rooms')
                    .select('customer_name, site_lang, source, created_at')
                    .eq('id', room_id).single(),
            ]);

            return new Response(JSON.stringify({
                messages: msgRes.data || [],
                room: roomRes.data || null,
            }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "Unknown action: " + action }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("admin-qa-update error:", error);
        return new Response(JSON.stringify({ error: error.message || "Internal error" }),
            { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
});
