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

    // 2026-07-18: refImage 추가 — 고객이 합성할 사진을 넣으면 그 사진을 활용해 디자인(gpt-image-2 edits).
    //   refImage 는 dataURL(data:image/...;base64,...) 또는 base64 문자열.
    let body: { prompt?: string; size?: string; refImage?: string } = {};
    try { body = await req.json(); } catch (_) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const prompt = (body.prompt || '').trim();
    if (!prompt || prompt.length < 3) {
        return new Response(JSON.stringify({ error: 'prompt is required (min 3 chars)' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (prompt.length > 4000) {   // 2026-07-18: 2000→4000 (스카시 등 상세 지시 프롬프트가 길어짐. gpt-image-2 는 여유 있게 처리)
        return new Response(JSON.stringify({ error: 'prompt too long (max 4000 chars)' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // gpt-image-2 지원 사이즈: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
    const validSizes = ['1024x1024', '1536x1024', '1024x1536'];
    const size = validSizes.includes(body.size || '') ? body.size : '1024x1024';

    // 참조 이미지 파싱 (dataURL / 순수 base64 모두 허용)
    let refBytes: Uint8Array | null = null;
    let refMime = 'image/png';
    if (body.refImage && typeof body.refImage === 'string') {
        try {
            let b64 = body.refImage;
            const m = b64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
            if (m) { refMime = m[1]; b64 = m[2]; }
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            // 너무 큰 이미지는 거부 (edits 는 처리 느림 — 대략 8MB 상한)
            if (arr.length > 8 * 1024 * 1024) {
                return new Response(JSON.stringify({ error: 'reference image too large (max 8MB)' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
            }
            refBytes = arr;
        } catch (_e) {
            return new Response(JSON.stringify({ error: 'invalid refImage' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
    }

    try {
        let openaiRes: Response;
        if (refBytes) {
            // ── 참조 이미지 합성 → /v1/images/edits (multipart)
            const ext = refMime.includes('jpeg') || refMime.includes('jpg') ? 'jpg' : refMime.includes('webp') ? 'webp' : 'png';
            const fd = new FormData();
            fd.append('model', 'gpt-image-2');
            fd.append('prompt', prompt);
            fd.append('size', size!);
            fd.append('quality', 'medium');
            fd.append('n', '1');
            fd.append('image[]', new Blob([refBytes], { type: refMime }), `ref.${ext}`);
            openaiRes = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },   // Content-Type 은 FormData 가 자동 설정
                body: fd,
            });
        } else {
            // ── 텍스트만 → /v1/images/generations
            openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
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
        }

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
