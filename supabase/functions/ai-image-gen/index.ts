// 2026-06-15: 패브릭 인쇄 메인 페이지(cotton-print.com)의 미니에디터에서 AI 이미지 생성 호출 받는 함수.
// 클라이언트에서 prompt 받아 OpenAI gpt-image-1 으로 이미지 생성 후 dataURL 반환.
//
// 배포: npx supabase functions deploy ai-image-gen --project-ref qinvtnhiidtmrzosyvys
// 시크릿: OPENAI_API_KEY (이미 설정됨 — ai-design-gen / ai-inpaint 와 공유)
//
// 2026-06-15 update: dall-e-3 → gpt-image-1 (ai-design-gen 과 동일 모델). base64 응답을 dataURL 로 변환해 프론트에 전달.

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
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set on this function.' }), {
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
    if (prompt.length > 2000) {
        return new Response(JSON.stringify({ error: 'prompt too long (max 2000 chars)' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // gpt-image-1 지원 사이즈: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
    const validSizes = ['1024x1024', '1536x1024', '1024x1536'];
    const size = validSizes.includes(body.size || '') ? body.size : '1024x1024';

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt,
                size,
                quality: 'high',
                output_format: 'png',
                n: 1,
            }),
        });

        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.warn('[ai-image-gen] OpenAI error:', openaiRes.status, errText);
            return new Response(JSON.stringify({ error: 'OpenAI API error', status: openaiRes.status, detail: errText.slice(0, 800) }), {
                status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const json = await openaiRes.json();
        const b64 = json?.data?.[0]?.b64_json;
        const url = json?.data?.[0]?.url;
        if (b64) {
            // gpt-image-1 — base64 응답을 dataURL 로 감싸서 클라이언트에 전달.
            return new Response(JSON.stringify({ url: `data:image/png;base64,${b64}` }), {
                status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }
        if (url) {
            // dall-e fallback — URL 직접 반환.
            return new Response(JSON.stringify({ url }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'No image in OpenAI response' }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    } catch (e: any) {
        console.error('[ai-image-gen] fetch error:', e);
        return new Response(JSON.stringify({ error: 'Internal error', detail: String(e?.message || e) }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
});
