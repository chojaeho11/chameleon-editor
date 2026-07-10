// 미니에디터 "AI 이미지 — 글씨까지 넣기" 호출을 받는 함수.
// 클라이언트에서 prompt 받아 이미지 생성 후 dataURL 반환.
//
// 배포: npx supabase functions deploy ai-image-gen --project-ref qinvtnhiidtmrzosyvys
// 시크릿: OPENAI_API_KEY (ai-design-gen / ai-inpaint 와 공유)
//
// 이력:
//  2026-06-15: dall-e-3 → gpt-image-1
//  2026-07-10a: gpt-image-1 → Ideogram v3 (텍스트 시도) — 그러나 한국어/일본어 글자 깨짐 확인.
//  2026-07-10b: Ideogram → gpt-image-2 (OpenAI, 2026-04 출시. 픽셀 단위 텍스트 렌더링, CJK 우수).
//   응답 b64_json → dataURL 로 감싸서 반환 (캔버스 CORS 안전).

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

    // gpt-image-2 지원 사이즈: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
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
                model: 'gpt-image-2',
                prompt,
                size,
                quality: 'medium',   // 'high' 는 150s 엣지 타임아웃 초과 위험 — medium 도 텍스트/품질 충분
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
            return new Response(JSON.stringify({ url: `data:image/png;base64,${b64}` }), {
                status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }
        if (url) {
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
