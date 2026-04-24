import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_DAILY_LIMIT = 3;
const PRO_DAILY_LIMIT  = 50;

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + ":chameleon-ai-salt");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPA_URL   = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!OPENAI_KEY || !SUPA_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Server config missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const prompt: string = (body?.prompt || "").toString().trim();
    const size: string = (body?.size || "1024x1024").toString();

    if (!prompt || prompt.length < 3) {
      return new Response(JSON.stringify({ error: "프롬프트를 입력해주세요 (3자 이상)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (prompt.length > 1000) {
      return new Response(JSON.stringify({ error: "프롬프트가 너무 깁니다 (1000자 이하)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const allowedSizes = ["1024x1024", "1024x1536", "1536x1024"];
    const finalSize = allowedSizes.includes(size) ? size : "1024x1024";

    const supa = createClient(SUPA_URL, SERVICE_KEY);

    // ── 유저 식별 ──
    let userId: string | null = null;
    let isPro = false;
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: userRes } = await supa.auth.getUser(token);
      if (userRes?.user) {
        userId = userRes.user.id;
        // PRO 판정: subscriptions active/trialing OR profiles.role='subscriber'
        const [{ data: subs }, { data: prof }] = await Promise.all([
          supa.from("subscriptions").select("status").eq("user_id", userId).in("status", ["active", "trialing"]).limit(1),
          supa.from("profiles").select("role").eq("id", userId).maybeSingle(),
        ]);
        if ((subs && subs.length > 0) || prof?.role === "subscriber" || prof?.role === "admin") isPro = true;
      }
    }

    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0.0.0.0").split(",")[0].trim();
    const ipHash = await hashIp(clientIp);

    // ── 일일 사용량 체크 (KST 기준 24시간 롤링) ──
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let usageCount = 0;
    if (userId) {
      const { count } = await supa.from("ai_design_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      usageCount = count || 0;
    } else {
      const { count } = await supa.from("ai_design_usage")
        .select("*", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .is("user_id", null)
        .gte("created_at", since);
      usageCount = count || 0;
    }

    const dailyLimit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    if (usageCount >= dailyLimit) {
      return new Response(JSON.stringify({
        error: `오늘 사용 한도(${dailyLimit}회)에 도달했습니다.${isPro ? "" : " PRO 구독 시 50회까지 가능합니다."}`,
        limit: dailyLimit,
        used: usageCount,
        isPro,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── OpenAI gpt-image-1 호출 ──
    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        size: finalSize,
        n: 1,
        quality: "medium",
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return new Response(JSON.stringify({ error: `이미지 생성 실패: ${openaiRes.status}`, detail: errText.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const aiData = await openaiRes.json();
    const b64 = aiData?.data?.[0]?.b64_json;
    if (!b64) {
      return new Response(JSON.stringify({ error: "이미지 데이터 누락" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Storage 업로드 ──
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fname = `ai/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supa.storage.from("generated-images")
      .upload(fname, bin, { contentType: "image/png", upsert: false });
    let imageUrl = "";
    if (upErr) {
      console.warn("Storage upload failed, returning base64:", upErr.message);
      imageUrl = `data:image/png;base64,${b64}`;
    } else {
      const { data: pub } = supa.storage.from("generated-images").getPublicUrl(fname);
      imageUrl = pub.publicUrl;
    }

    // ── 사용 기록 ──
    await supa.from("ai_design_usage").insert({
      user_id: userId,
      ip_hash: userId ? null : ipHash,
      prompt,
      image_url: imageUrl.startsWith("data:") ? null : imageUrl,
    });

    return new Response(JSON.stringify({
      imageUrl,
      used: usageCount + 1,
      limit: dailyLimit,
      isPro,
      remaining: dailyLimit - usageCount - 1,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("ai-design-gen error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
