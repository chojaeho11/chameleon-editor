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

    // ── Stage 1: 문화 레퍼런스 인식 (영화/K-pop/브랜드 등) — GPT-5.5 가벼운 호출 ──
    // 사용자 원본 텍스트는 보존하고, 컨텍스트를 짧게 덧붙이기만 함.
    let enrichedPrompt = prompt;
    const stage1Start = Date.now();
    try {
      const ctxAbort = new AbortController();
      const ctxTimer = setTimeout(() => ctxAbort.abort(), 15_000);
      const ctxRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.5-2026-04-23",
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: `You are a cultural-reference detector for image generation prompts. Read the user's brief and identify if it references a real movie, song, K-pop group, brand, anime, novel, historical event, or any well-known cultural touchstone.

If YES: output 80-150 English words describing the iconic visual elements of that reference (key cast/characters, era, color palette, signature scenes, costume style, mood, typography style). Do NOT translate or paraphrase the user's original title text. Do NOT add any small/body text.

If NO cultural reference detected: output the single word "NONE".

Output ONLY the description (or "NONE") — no preamble, no markdown, no quotes.`,
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: ctxAbort.signal,
      });
      clearTimeout(ctxTimer);
      if (ctxRes.ok) {
        const ctxData: any = await ctxRes.json();
        const ctxText = ctxData?.choices?.[0]?.message?.content?.trim();
        const stage1Ms = Date.now() - stage1Start;
        if (ctxText && ctxText !== "NONE" && ctxText.length > 30) {
          enrichedPrompt = `${prompt}\n\n=== CULTURAL CONTEXT (use as visual reference) ===\n${ctxText}`;
          console.log(`[stage1] cultural ref detected (${ctxText.length} chars) in ${stage1Ms}ms`);
        } else {
          console.log(`[stage1] no cultural ref (${stage1Ms}ms)`);
        }
      } else {
        console.warn(`[stage1] ${ctxRes.status} — skipping context enrichment`);
      }
    } catch (e: any) {
      console.warn(`[stage1] error: ${e?.message || e} — skipping`);
    }

    // ── Stage 2: Images API 직접 호출 ──
    // 첨부 이미지 있으면 /images/edits, 없으면 /images/generations
    const IMAGE_MODEL: string = "gpt-image-2";
    const hasInputImages = inputImages.length > 0;
    const usedModel = IMAGE_MODEL;

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 180_000);
    let openaiRes: Response;
    const t0 = Date.now();

    try {
      if (hasInputImages) {
        const fd = new FormData();
        fd.append("model", IMAGE_MODEL);
        fd.append("prompt", enrichedPrompt);
        fd.append("size", finalSize);
        fd.append("quality", "high");
        fd.append("output_format", "png");
        fd.append("n", "1");
        // input_fidelity: gpt-image-1.5만 지원, gpt-image-2는 거부 (invalid_input_fidelity_model)
        if (IMAGE_MODEL === "gpt-image-1.5") fd.append("input_fidelity", "high");
        for (let i = 0; i < inputImages.length; i++) {
          const img = inputImages[i];
          const ab = img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + img.data.byteLength) as ArrayBuffer;
          const blob = new Blob([ab], { type: img.type || "image/png" });
          fd.append("image[]", blob, img.name || `ref-${i}.png`);
        }
        openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
          body: fd,
          signal: abort.signal,
        });
      } else {
        openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            prompt: enrichedPrompt,
            size: finalSize,
            quality: "high",
            output_format: "png",
            n: 1,
          }),
          signal: abort.signal,
        });
      }
    } catch (e: any) {
      clearTimeout(timer);
      const elapsed = Date.now() - t0;
      console.error(`[images-api] fetch error after ${elapsed}ms: ${e?.message || e}`);
      return new Response(JSON.stringify({ error: "OpenAI 호출 실패", detail: String(e?.message || e) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    console.log(`[images-api] status=${openaiRes.status} elapsed=${elapsed}ms`);

    if (!openaiRes.ok) {
      const errTxt = await openaiRes.text();
      console.error(`[images-api] ${openaiRes.status}: ${errTxt.slice(0, 400)}`);
      return new Response(JSON.stringify({ error: `이미지 생성 실패: ${openaiRes.status}`, detail: errTxt.slice(0, 800) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const aiData = await openaiRes.json();
    const b64: string | null = aiData?.data?.[0]?.b64_json || null;
    if (!b64) {
      console.error("No b64_json in response:", JSON.stringify(aiData).slice(0, 1000));
      return new Response(JSON.stringify({ error: "이미지 데이터 누락", detail: JSON.stringify(aiData).slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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
      model: usedModel,
      imageModel: IMAGE_MODEL,
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
