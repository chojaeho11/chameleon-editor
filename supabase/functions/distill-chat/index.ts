// ============================================================
// distill-chat — 매니저가 개입한 상담 대화를 AI가 재사용 가능한 지식으로 증류(전자동)
//   입력: { room_id }
//   동작: chat_messages(고객+관리자) 읽어 Claude 로 일반화 Q&A 추출(보수적) → 중복제거 →
//         chatbot_knowledge insert (category='auto_distilled', priority 40 → 검토/삭제 가능)
//   [배포] supabase functions deploy distill-chat
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED_ORIGINS = [
    'https://www.cafe2626.com', 'https://www.cafe0101.com', 'https://www.cafe3355.com',
    'https://cafe2626.com', 'https://cafe0101.com', 'https://cafe3355.com',
    'https://chameleon.design', 'https://www.chameleon.design',
];
function cors(req: Request) {
    const origin = req.headers.get('origin') || '';
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
}
const KB_LANG: Record<string, string> = { kr: 'ko', ko: 'ko', ja: 'ja', jp: 'ja', us: 'en', en: 'en' };

serve(async (req) => {
    const CORS = cors(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

    try {
        const { room_id } = await req.json();
        if (!room_id) return json({ ok: false, error: 'room_id required' }, 400);
        const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

        // 방 정보 + 최근 증류 시각(과도한 재처리 방지: 최근 60초 내 이미 처리했으면 스킵)
        const { data: room } = await sb.from('chat_rooms').select('site_lang, distilled_at').eq('id', room_id).maybeSingle();
        if (room && room.distilled_at) {
            const ageSec = (Date.now() - new Date(room.distilled_at).getTime()) / 1000;
            if (ageSec < 60) return json({ ok: true, count: 0, learned: [], skipped: 'recent' });
        }
        const lang = (room?.site_lang || 'kr').toLowerCase();
        const kb = KB_LANG[lang] || 'ko';

        // 대화 로드 (고객 + 관리자 발화 위주. AI 발화는 맥락용으로만)
        const { data: msgs } = await sb.from('chat_messages')
            .select('sender_type, sender_name, message, created_at')
            .eq('room_id', room_id).order('created_at', { ascending: true }).limit(200);
        const rows = (msgs || []).filter((m: any) => (m.message || '').trim());
        const hasMgr = rows.some((m: any) => m.sender_type !== 'customer' && String(m.sender_name || '').includes('관리자'));
        if (!hasMgr) { // 매니저 개입 없으면 학습 대상 아님
            await sb.from('chat_rooms').update({ distilled_at: new Date().toISOString() }).eq('id', room_id);
            return json({ ok: true, count: 0, learned: [], skipped: 'no_manager' });
        }

        const transcript = rows.map((m: any) => {
            const who = m.sender_type === 'customer' ? '고객' : (String(m.sender_name || '').includes('관리자') ? '관리자' : 'AI');
            return `[${who}] ${(m.message || '').slice(0, 500)}`;
        }).join('\n');

        const sys = `너는 인쇄회사(카멜레온프린팅) 챗봇의 지식 증류기다. 사람 매니저가 직접 응대한 상담 대화에서, 앞으로 다른 고객에게도 재사용 가능한 '일반 지식 Q&A'만 뽑아낸다.

엄격 규칙:
- 정책/사양/가격/제작과정/방법처럼 일반적으로 적용되는 사실만 포함.
- 일회성·맥락의존·특정 주문/개인정보(이름, 전화번호, 특정 주문번호, "고객님 주문") 인사말, 애매하거나 불완전한 답변은 제외.
- 매니저 답변이 모호하거나 재사용 불가면 SKIP.
- 질문은 독립적으로 이해되게, 답변은 간결한 일반 답변으로 재작성 (언어: ${kb}).
- 학습할 게 없으면 빈 배열.
- 최대 3개.
- 반드시 JSON 만 출력: {"items":[{"question":"...","answer":"..."}]}`;

        let items: any[] = [];
        try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
                body: JSON.stringify({
                    model: "claude-haiku-4-5-20251001", max_tokens: 900, system: sys,
                    messages: [{ role: "user", content: "대화:\n" + transcript + "\n\nJSON 만 출력." }],
                }),
            });
            const data = await res.json();
            const txt = (data?.content?.[0]?.text || '').trim();
            const mt = txt.match(/\{[\s\S]*\}/);
            if (mt) { const parsed = JSON.parse(mt[0]); items = Array.isArray(parsed.items) ? parsed.items : []; }
        } catch (e) { console.error('[distill] claude', (e as any)?.message); }

        // 증류 시각 기록 (성공/실패 무관 — 재처리 방지)
        await sb.from('chat_rooms').update({ distilled_at: new Date().toISOString() }).eq('id', room_id);

        const learned: any[] = [];
        for (const it of items.slice(0, 3)) {
            const q = (it.question || '').trim(), a = (it.answer || '').trim();
            if (!q || !a || a.length < 5) continue;
            // 중복 제거 — 동일 질문 이미 활성 지식으로 있으면 스킵
            const { data: dup } = await sb.from('chatbot_knowledge').select('id').eq('question', q).eq('is_active', true).limit(1);
            if (dup && dup.length) continue;
            const { error: insErr } = await sb.from('chatbot_knowledge').insert({
                category: 'auto_distilled', question: q, answer: a, language: kb, priority: 40, is_active: true
            });
            if (!insErr) learned.push({ question: q, answer: a });
        }
        return json({ ok: true, count: learned.length, learned });
    } catch (e) {
        return json({ ok: false, error: (e as any)?.message || String(e) }, 200);
    }
});
