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

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let size = "1024x1024";
    let inputImages: { name: string; data: Uint8Array; type: string }[] = [];
    let authHeaderRaw = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      prompt = (form.get("prompt")?.toString() || "").trim();
      size = (form.get("size")?.toString() || "1024x1024");
      authHeaderRaw = form.get("authToken")?.toString() || "";
      // 이미지 최대 4장까지
      const files = form.getAll("image");
      for (const f of files) {
        if (f instanceof File && f.size > 0) {
          const buf = new Uint8Array(await f.arrayBuffer());
          inputImages.push({ name: f.name || "upload.png", data: buf, type: f.type || "image/png" });
          if (inputImages.length >= 4) break;
        }
      }
    } else {
      const body = await req.json().catch(() => ({}));
      prompt = (body?.prompt || "").toString().trim();
      size = (body?.size || "1024x1024").toString();
      authHeaderRaw = (body?.authToken || "").toString();
    }

    if (!prompt || prompt.length < 3) {
      return new Response(JSON.stringify({ error: "프롬프트를 입력해주세요 (3자 이상)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (prompt.length > 2000) {
      return new Response(JSON.stringify({ error: "프롬프트가 너무 깁니다 (2000자 이하)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const allowedSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    const finalSize = allowedSizes.includes(size) ? size : "1024x1024";

    const supa = createClient(SUPA_URL, SERVICE_KEY);

    // ── 유저 식별 ──
    let userId: string | null = null;
    let isPro = false;
    let isUnlimited = false; // 테스트용 특수 계정: 한도 무제한
    const PRIV_EMAILS = ["doubleu202201@gmail.com", "korea900as@gmail.com"];
    const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // 토큰 후보: 1) form authToken 2) Authorization header (Bearer 제거)
    const rawHeader = req.headers.get("Authorization") || "";
    const headerToken = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7) : rawHeader;
    const tokenStr = authHeaderRaw || headerToken;

    console.log("[auth] hasFormToken=", !!authHeaderRaw, "hasHeader=", !!headerToken, "isAnon=", tokenStr === SUPA_ANON);

    if (tokenStr && tokenStr !== SUPA_ANON) {
      const { data: userRes, error: userErr } = await supa.auth.getUser(tokenStr);
      if (userErr) console.log("[auth] getUser error:", userErr.message);
      if (userRes?.user) {
        userId = userRes.user.id;
        const userEmail = (userRes.user.email || "").toLowerCase();
        console.log("[auth] userId=", userId, "email=", userEmail);
        if (PRIV_EMAILS.includes(userEmail)) isUnlimited = true;
        // PRO 판정: subscriptions active/trialing OR profiles.role='subscriber'
        const [{ data: subs }, { data: prof }] = await Promise.all([
          supa.from("subscriptions").select("status").eq("user_id", userId).in("status", ["active", "trialing"]).limit(1),
          supa.from("profiles").select("role").eq("id", userId).maybeSingle(),
        ]);
        if ((subs && subs.length > 0) || prof?.role === "subscriber" || prof?.role === "admin") isPro = true;
        console.log("[auth] isPro=", isPro, "isUnlimited=", isUnlimited, "role=", prof?.role);
      } else {
        console.log("[auth] no user resolved from token");
      }
    } else {
      console.log("[auth] anonymous request");
    }

    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0.0.0.0").split(",")[0].trim();
    const ipHash = await hashIp(clientIp);

    // ── 일일 한도 정책 제거됨 (로깅만 유지) ──
    const usageCount = 0;
    const dailyLimit = 99999;

    // ── OpenAI Responses API + image_generation 도구 (ChatGPT 웹과 동일 경로) ──
    // GPT-5가 업로드 이미지를 이해하고 프롬프트 요구사항을 반영한 새 이미지 생성
    function bytesToB64(bytes: Uint8Array): string {
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(bin);
    }

    const userContent: any[] = [{ type: "input_text", text: prompt }];
    inputImages.forEach((img) => {
      const b64 = bytesToB64(img.data);
      userContent.push({
        type: "input_image",
        image_url: `data:${img.type || "image/png"};base64,${b64}`,
      });
    });

    const systemInstructions = `You are a professional commercial print designer.

RULES:
1) Plan layout, colors, typography, and composition carefully based on the user's specifications.
2) Call image_generation tool with a detailed prompt.
3) CRITICAL: ALL TEXT must be ENGLISH Latin alphabet only. No Korean, Chinese, Japanese or other scripts. No gibberish.
4) CRITICAL: Design must be FULL-BLEED — edge-to-edge, filling the ENTIRE frame. NO white border, NO outer padding, NO margin, NO card-style inset. Composition extends to every corner.
5) Sharp, crisp, editorial-quality typography.
6) If reference images are attached, integrate them naturally.
7) Commercial-print quality: balanced composition, clear visual hierarchy, professional typography.`;

    // gpt-5.5: Frontier 모델 (API 공식 제공). 폴백으로 5.4 / 5.1 / 5.
    // 각 후보에 90초 타임아웃 — 100s Gateway 보호.
    const MODEL_CANDIDATES = ["gpt-5.5", "gpt-5.4", "gpt-5.1", "gpt-5"];
    let openaiRes: Response | null = null;
    let lastErrText = "";
    let usedModel = "";
    for (const m of MODEL_CANDIDATES) {
      const responsesBody: any = {
        model: m,
        instructions: systemInstructions,
        input: [{ role: "user", content: userContent }],
        tools: [{
          type: "image_generation",
          size: finalSize,
          quality: "high",
          output_format: "png",
        }],
        tool_choice: { type: "image_generation" },
      };
      // 모델별 90초 타임아웃 — 100s Gateway 제한 보호
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 90_000);
      let r: Response;
      try {
        r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(responsesBody),
          signal: abort.signal,
        });
      } catch (e: any) {
        clearTimeout(timer);
        console.error(`[${m}] fetch error: ${e?.message || e}`);
        lastErrText = `fetch error: ${e?.message || e}`;
        continue;
      }
      clearTimeout(timer);
      if (r.ok) { openaiRes = r; usedModel = m; break; }
      lastErrText = await r.text();
      console.error(`[${m}] ${r.status}: ${lastErrText.slice(0, 300)}`);
      if (r.status !== 404 && r.status !== 400 && r.status !== 403) {
        return new Response(JSON.stringify({ error: `이미지 생성 실패: ${r.status}`, detail: lastErrText.slice(0, 800) }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    if (!openaiRes) {
      return new Response(JSON.stringify({ error: "사용 가능한 모델 없음", detail: lastErrText.slice(0, 800) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    console.log("[ai] used model:", usedModel);

    const aiData = await openaiRes.json();
    // output 배열에서 image_generation_call 결과 추출
    let b64: string | null = null;
    const outputs: any[] = aiData?.output || [];
    for (const item of outputs) {
      if (item?.type === "image_generation_call" && item?.result) {
        b64 = item.result;
        break;
      }
    }
    if (!b64) {
      console.error("No image_generation_call result:", JSON.stringify(aiData).slice(0, 2000));
      return new Response(JSON.stringify({ error: "이미지 생성 결과 누락", detail: JSON.stringify(aiData).slice(0, 500) }), {
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
