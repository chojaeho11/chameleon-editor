// Auto-complete design bids 15+ days after customer payment.
// Protects designers from unresponsive customers who never click "Mark Complete".
// Safe: only runs for card-paid orders (bank-transfer/deposit design fees are blocked client-side).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRACE_DAYS = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPA_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPA_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Server config missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const supa = createClient(SUPA_URL, SERVICE_KEY);

    // 1) 카드결제로 15일 이상 지난 주문들 검색 (디자인비 주문)
    // payment_method: "카드(31)", "카드(51)" 등 접미사 포함이므로 LIKE 사용
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 3600 * 1000).toISOString();
    const { data: oldOrders, error: ordErr } = await supa
      .from("orders")
      .select("id, created_at, items, status, payment_method, payment_status")
      .ilike("payment_method", "카드%")
      .lt("created_at", cutoff)
      .in("status", ["결제완료", "칼선작업", "완료됨", "발송완료", "배송", "배송완료"])
      .limit(500);

    if (ordErr) throw ordErr;

    const autoCompleted: any[] = [];
    const errors: any[] = [];

    for (const o of (oldOrders || [])) {
      let items: any[] = [];
      try { items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []); } catch(_) { continue; }
      for (const it of items) {
        const bidId = it?._designBidId;
        if (!bidId) continue;
        // 해당 bid 상태 조회
        const { data: bid } = await supa.from("design_bids")
          .select("id, payment_status, client_completed_at, request_id, designer_id, price")
          .eq("id", bidId)
          .maybeSingle();
        if (!bid) continue;
        // 이미 완료됐거나 아직 결제 전이면 skip
        if (bid.client_completed_at) continue;
        if (bid.payment_status !== "paid") continue;

        // 자동 완료 처리
        try {
          // 1. bid: client_completed_at 설정 (auto-completed 표시)
          const now = new Date().toISOString();
          const { error: bUpdErr } = await supa.from("design_bids")
            .update({
              payment_status: "completed_pending_files",
              client_completed_at: now,
              auto_completed: true,
              auto_completed_at: now,
            })
            .eq("id", bid.id);
          if (bUpdErr && bUpdErr.message && !bUpdErr.message.includes("auto_completed")) throw bUpdErr;
          // auto_completed 컬럼이 없으면 재시도 (컬럼 없이 업데이트)
          if (bUpdErr) {
            const { error: retry } = await supa.from("design_bids")
              .update({ payment_status: "completed_pending_files", client_completed_at: now })
              .eq("id", bid.id);
            if (retry) throw retry;
          }

          // 2. release_design_bid_payment RPC 호출 — 디자이너 지갑으로 금액 이동
          const { error: rpcErr } = await supa.rpc("release_design_bid_payment", { _bid_id: bid.id });
          if (rpcErr) console.warn(`[bid ${bid.id}] release RPC failed:`, rpcErr.message);

          // 3. 요청도 완료 상태로
          if (bid.request_id) {
            await supa.from("design_requests").update({ status: "completed" }).eq("id", bid.request_id);
          }

          autoCompleted.push({ bid_id: bid.id, order_id: o.id, designer_id: bid.designer_id, amount: bid.price });
        } catch (e: any) {
          console.error(`[bid ${bid.id}] auto-complete error:`, e?.message || e);
          errors.push({ bid_id: bid.id, error: String(e?.message || e) });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      cutoff,
      scanned_orders: (oldOrders || []).length,
      auto_completed: autoCompleted.length,
      errors: errors.length,
      details: { autoCompleted, errors },
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("auto-complete error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
