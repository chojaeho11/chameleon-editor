// 2026-06-15: 패브릭 인쇄 메인 페이지(cotton-print.com)의 미니에디터에서 AI 이미지 생성 호출 받는 함수.
// 클라이언트에서 prompt 받아 OpenAI DALL-E 3 으로 이미지 생성 후 URL 반환.
//
// 배포: npx supabase functions deploy ai-image-gen --project-ref qinvtnhiidtmrzosyvys
// 시크릿: Supabase Dashboard > Functions > Secrets > 추가
//   OPENAI_API_KEY=sk-...  (필수)
//
// 키 미설정 상태에서는 503 응답 → 프론트가 "곧 출시" placeholder 안내 표시.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_KEY) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set on this function. Add it under Supabase Dashboard > Functions > Secrets.' }), {
            status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }

    let body: { prompt?: string; size?: string } = {};
    try { body = await req.json(); } catch (_) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const prompt = (body.prompt || '').trim();
    if (!prompt || prompt.length < 3) {
        return new Response(JSON.stringify({ error: 'prompt is required (min 3 chars)' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (prompt.length > 800) {
        return new Response(JSON.stringify({ error: 'prompt too long (max 800 chars)' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const size = (body.size === '1024x1024' || body.size === '1792x1024' || body.size === '1024x1792') ? body.size : '1024x1024';

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt,
                n: 1,
                size,
                response_format: 'url',
            }),
        });
        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.warn('[ai-image-gen] OpenAI error:', openaiRes.status, errText);
            return new Response(JSON.stringify({ error: 'OpenAI API error', status: openaiRes.status, detail: errText.slice(0, 500) }), {
                status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }
        const json = await openaiRes.json();
        const url = json?.data?.[0]?.url;
        if (!url) {
            return new Response(JSON.stringify({ error: 'No image URL in OpenAI response' }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ url, revised_prompt: json?.data?.[0]?.revised_prompt || null }), {
            status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('[ai-image-gen] fetch error:', e);
        return new Response(JSON.stringify({ error: 'Internal error', detail: String(e?.message || e) }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
});
