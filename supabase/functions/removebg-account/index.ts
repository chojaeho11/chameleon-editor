// supabase/functions/removebg-account/index.ts
// 2026-08-14: 관리자 대시보드용 — remove.bg 남은 크레딧 조회 (언제 충전할지 판단용).
//   호출자 JWT 로 로그인 유저 확인 → profiles.role='admin' 만 허용. 그 후 remove.bg GET /account 프록시.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // 1) 호출자 인증 — Authorization JWT 로 user 확인
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "auth" }, 401);

    // 2) 관리자 확인 (service role 로 role 조회)
    const svc = createClient(supabaseUrl, svcKey);
    const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!prof || prof.role !== "admin") return json({ error: "forbidden" }, 403);

    // 3) remove.bg 키 (env → secrets 테이블)
    let key = Deno.env.get("REMOVE_BG_API_KEY") || Deno.env.get("REMOVEBG_API_KEY");
    if (!key) {
      const { data } = await svc.from("secrets").select("value").eq("name", "REMOVE_BG_API_KEY").single();
      key = data?.value || undefined;
    }
    if (!key) return json({ error: "no_key" }, 500);

    // 4) remove.bg 계정 조회
    const res = await fetch("https://api.remove.bg/v1.0/account", { headers: { "X-Api-Key": key } });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return json({ error: `removebg ${res.status} ${t.slice(0, 200)}` }, 502);
    }
    const data = await res.json();
    const credits = data?.data?.attributes?.credits || {};
    const api = data?.data?.attributes?.api || {};
    return json({
      ok: true,
      total: credits.total ?? null,
      subscription: credits.subscription ?? null,
      payg: credits.payg ?? null,
      enterprise: credits.enterprise ?? null,
      free_api_calls: api.free_calls ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
