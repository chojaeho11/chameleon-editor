// supabase/functions/daily-ops/index.ts
// 2026-10-22 (사장님: "내 대신 일하는 에이전트 ① 매일 운영 비서" — 데이터 자동층):
//   매일 크론으로 (1) 버그게시판 자동 승인 (2) 카푸 학습 보장(distill-sweep 호출)
//   (3) 그날 상담·운영 요약 리포트 생성 → daily_ops_reports 저장.
//   ※ 판단/수정/테스트/제안(코드 개선)은 별도 '스케줄 클라우드 Claude 에이전트'가 담당(배포는 승인제).
//   [호출] pg_cron 매일 00:10 UTC(=한국 09:10). body { date?:'YYYY-MM-DD', dryRun?:boolean }
//   [배포] npx supabase functions deploy daily-ops --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";

function kstDayRange(dateStr?: string) {
  // 기준일(KST). 미지정 시 '어제'(KST).
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  let y: number, m: number, d: number;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    [y, m, d] = dateStr.split("-").map(Number);
  } else {
    const yst = new Date(nowKst.getTime() - 24 * 3600 * 1000);
    y = yst.getUTCFullYear(); m = yst.getUTCMonth() + 1; d = yst.getUTCDate();
  }
  // KST 00:00~24:00 을 UTC 로 환산 (KST = UTC+9)
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 3600 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 3600 * 1000);
  const label = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString(), label };
}

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    let dateStr = "", dryRun = false;
    try { const b = await req.json(); if (b?.date) dateStr = b.date; if (b?.dryRun) dryRun = true; } catch (_) {}
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { startIso, endIso, label } = kstDayRange(dateStr);

    // (1) 버그게시판 자동 승인: status 'new' → 'approved' (반려/완료는 건드리지 않음)
    let bugsApproved = 0;
    const bugIds: number[] = [];
    try {
      const { data: news } = await sb.from("bug_reports").select("id").eq("status", "new");
      const ids = (news || []).map((b: any) => b.id);
      if (ids.length && !dryRun) {
        const { error } = await sb.from("bug_reports").update({ status: "approved" }).in("id", ids);
        if (!error) { bugsApproved = ids.length; bugIds.push(...ids); }
      } else { bugsApproved = ids.length; bugIds.push(...ids); }
    } catch (e) { console.warn("[daily-ops] bug approve", (e as any)?.message); }

    // (2) 카푸 학습 보장 — distill-sweep 호출 (브라우저 트리거가 놓친 매니저 상담 학습)
    let learnSwept = 0, learnLearned = 0;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/distill-sweep`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON || SERVICE_KEY}`, apikey: ANON || SERVICE_KEY },
        body: JSON.stringify({ days: 2, max: 40 }),
      });
      const d = await r.json().catch(() => ({}));
      learnSwept = d?.swept || 0; learnLearned = d?.learned || 0;
    } catch (e) { console.warn("[daily-ops] distill-sweep", (e as any)?.message); }

    // (3) 그날(기준일, 보통 어제) 지표 집계
    const countRange = async (table: string, extra?: (q: any) => any) => {
      try {
        let q = sb.from(table).select("*", { count: "exact", head: true }).gte("created_at", startIso).lt("created_at", endIso);
        if (extra) q = extra(q);
        const { count } = await q;
        return count || 0;
      } catch { return 0; }
    };

    const rooms = await countRange("chat_rooms");
    // 매니저가 개입한 상담(사람 응대) — 그날 관리자 발화가 있던 방 수
    let mgrHandled = 0;
    try {
      const { data: mm } = await sb.from("chat_messages").select("room_id").neq("sender_type", "customer").ilike("sender_name", "%관리자%").gte("created_at", startIso).lt("created_at", endIso).limit(5000);
      mgrHandled = new Set((mm || []).map((m: any) => m.room_id).filter(Boolean)).size;
    } catch (_) {}
    const aiQa = await countRange("advisor_qa_log");
    const learningsToday = await countRange("chatbot_knowledge", (q: any) => q.eq("category", "auto_distilled"));
    const ordersToday = await countRange("orders", (q: any) => q.neq("status", "임시작성").neq("status", "취소됨"));

    // 미처리 버그(승인/답변) 큐 — 판단 에이전트가 처리할 대상
    let bugsPending = 0;
    try { const { count } = await sb.from("bug_reports").select("*", { count: "exact", head: true }).in("status", ["approved", "replied"]); bugsPending = count || 0; } catch (_) {}

    const metrics = {
      consultations_total: rooms,
      consultations_manager_handled: mgrHandled,
      ai_qa_logged: aiQa,
      kapu_new_learnings: learningsToday,
      learn_sweep: { swept: learnSwept, learned: learnLearned },
      bugs_auto_approved: bugsApproved,
      bugs_auto_approved_ids: bugIds,
      bugs_pending_queue: bugsPending,
      orders_received: ordersToday,
    };
    const note = `자동: 버그 ${bugsApproved}건 승인 · 카푸 학습 ${learnLearned}건 · 상담 ${rooms}건(매니저개입 ${mgrHandled}) · 주문 ${ordersToday}건. 판단 에이전트가 미처리 버그 ${bugsPending}건 진단 예정.`;

    if (!dryRun) {
      await sb.from("daily_ops_reports").upsert({ report_date: label, metrics, note }, { onConflict: "report_date" });
    }
    return json({ ok: true, date: label, dryRun, metrics, note });
  } catch (e) {
    return json({ ok: false, error: (e as any)?.message || String(e) }, 200);
  }
});
