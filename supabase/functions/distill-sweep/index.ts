// ============================================================
// distill-sweep — 서버 자동학습 스케줄러 (2026-10-16 사장님: "컴퓨터 꺼져 있어도 24시간 자동 학습")
//   매니저가 응대했지만 아직 증류(학습)되지 않은 대화방을 서버가 주기적으로 스스로 찾아 distill-chat 호출.
//   브라우저(자비스) closeConv 트리거에 의존하던 것을 보완 — 담당자 PC 가 꺼져 있어도 학습됨.
//   [호출] pg_cron + pg_net 이 20분마다 POST (아래 _setup SQL). 수동 호출도 가능.
//   [배포] npx supabase functions deploy distill-sweep --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
    const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
    try {
        const sb = createClient(SUPABASE_URL, SERVICE_KEY);

        // 선택적 파라미터: 며칠치 / 최대 몇 개 처리 (기본 최근 5일, 한 번에 25개)
        let days = 5, max = 25;
        try { const b = await req.json(); if (b?.days) days = Math.min(30, Math.max(1, +b.days)); if (b?.max) max = Math.min(100, Math.max(1, +b.max)); } catch (_) {}

        const since = new Date(Date.now() - days * 86400000).toISOString();

        // 1) 최근 매니저(관리자) 발화가 있었던 방 id 수집
        const { data: mgrMsgs } = await sb.from('chat_messages')
            .select('room_id')
            .neq('sender_type', 'customer')
            .ilike('sender_name', '%관리자%')
            .gte('created_at', since)
            .limit(5000);
        const roomIds = [...new Set((mgrMsgs || []).map((m: any) => m.room_id).filter(Boolean))];
        if (!roomIds.length) return json({ ok: true, swept: 0, learned: 0, note: 'no manager rooms' });

        // 2) 그 중 아직 증류 안 된 방(distilled_at IS NULL)만 — 브라우저 트리거가 놓친 것들
        const todo: string[] = [];
        for (let i = 0; i < roomIds.length; i += 200) {
            const chunk = roomIds.slice(i, i + 200);
            const { data: rooms } = await sb.from('chat_rooms').select('id, distilled_at').in('id', chunk);
            (rooms || []).forEach((r: any) => { if (!r.distilled_at) todo.push(r.id); });
        }
        if (!todo.length) return json({ ok: true, swept: 0, learned: 0, note: 'all distilled' });

        // 3) distill-chat 을 방마다 호출 (순차, 소량 배치 — API/비용 보호). distill-chat 이 멱등 처리 + distilled_at 마킹.
        const distillUrl = `${SUPABASE_URL}/functions/v1/distill-chat`;
        let learned = 0, swept = 0;
        for (const id of todo.slice(0, max)) {
            swept++;
            try {
                const r = await fetch(distillUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY },
                    body: JSON.stringify({ room_id: id }),
                });
                const d = await r.json().catch(() => ({}));
                if (d && d.count) learned += d.count;
            } catch (e) { console.warn('[sweep] distill fail', id, (e as any)?.message); }
        }
        return json({ ok: true, swept, learned, remaining: Math.max(0, todo.length - swept) });
    } catch (e) {
        return json({ ok: false, error: (e as any)?.message || String(e) }, 200);
    }
});
