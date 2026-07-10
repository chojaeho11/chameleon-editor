// 2026-06-15: 패브릭 인쇄 메인 페이지(cotton-print.com)의 미니에디터에서 AI 이미지 생성 호출 받는 함수.
// 클라이언트에서 prompt 받아 이미지 생성 후 dataURL 반환.
//
// 배포: npx supabase functions deploy ai-image-gen --project-ref qinvtnhiidtmrzosyvys
//
// 2026-06-15: dall-e-3 → gpt-image-1.
// 2026-07-10: gpt-image-1 → Ideogram v3 (이미지 안 텍스트 정확도 우수 — 포스터/전단/라벨용).
//   시크릿: IDEOGRAM_API_KEY (신규 설정 필요)
//     npx supabase secrets set IDEOGRAM_API_KEY=xxxx --project-ref qinvtnhiidtmrzosyvys
//   Ideogram 응답은 호스팅 URL 이라 그대로 넘기면 캔버스 CORS 오염(export 깨짐) → 서버측에서
//   받아 base64 dataURL 로 변환해 기존과 동일한 { url } 형태로 반환 (프론트 무수정).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { encodeBase64 } from 'jsr:@std/encoding/base64';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// gpt-image-1 시절 사이즈 → Ideogram v3 aspect_ratio 매핑 (프론트 호환)
const SIZE_TO_ASPECT: Record<string, string> = {
    '1024x1024': '1x1',
    '1536x1024': '3x2',   // landscape
    '1024x1536': '2x3',   // portrait
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const IDEOGRAM_KEY = Deno.env.get('IDEOGRAM_API_KEY');
    if (!IDEOGRAM_KEY) {
        return new Response(JSON.stringify({ error: 'IDEOGRAM_API_KEY not set on this function.' }), {
            status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }

    let body: { prompt?: string; size?: string; rendering_speed?: string } = {};
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

    const aspect_ratio = SIZE_TO_ASPECT[body.size || ''] || '1x1';
    // TURBO($0.03) / DEFAULT($0.06) / QUALITY($0.09). 기본 DEFAULT.
    const rendering_speed = ['TURBO', 'DEFAULT', 'QUALITY'].includes(body.rendering_speed || '')
        ? body.rendering_speed : 'DEFAULT';

    try {
        const ideoRes = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
            method: 'POST',
            headers: {
                'Api-Key': IDEOGRAM_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                aspect_ratio,
                rendering_speed,
                style_type: 'AUTO',
                num_images: 1,
            }),
        });

        if (!ideoRes.ok) {
            const errText = await ideoRes.text();
            console.warn('[ai-image-gen] Ideogram error:', ideoRes.status, errText);
            return new Response(JSON.stringify({ error: 'Ideogram API error', status: ideoRes.status, detail: errText.slice(0, 800) }), {
                status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const json = await ideoRes.json();
        const imgUrl = json?.data?.[0]?.url;
        if (!imgUrl) {
            return new Response(JSON.stringify({ error: 'No image in Ideogram response' }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }

        // 호스팅 URL → base64 dataURL 로 변환 (캔버스 CORS 오염 방지, 프론트 무수정)
        const imgResp = await fetch(imgUrl);
        if (!imgResp.ok) {
            // 변환 실패 시 최후수단으로 URL 직접 반환 (표시는 되나 export 시 CORS 주의)
            return new Response(JSON.stringify({ url: imgUrl }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        const ct = imgResp.headers.get('content-type') || 'image/png';
        const buf = new Uint8Array(await imgResp.arrayBuffer());
        const dataUrl = `data:${ct};base64,${encodeBase64(buf)}`;
        return new Response(JSON.stringify({ url: dataUrl }), {
            status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('[ai-image-gen] fetch error:', e);
        return new Response(JSON.stringify({ error: 'Internal error', detail: String(e?.message || e) }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
});
