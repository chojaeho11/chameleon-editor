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

    // ── 2단계 파이프라인 + SSE 스트리밍 ──
    // Stage 1: GPT-5.5가 사용자 브리프를 시네마틱한 디테일 프롬프트로 확장 (~5-10s)
    // Stage 2: gpt-image-2 + partial_images=2 스트리밍으로 점진적 이미지 출력 (~30-180s)
    function bytesToB64(bytes: Uint8Array): string {
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(bin);
    }

    const PARENT_MODEL = "gpt-5.5-2026-04-23";
    const IMAGE_MODEL = "gpt-image-2";
    const hasInputImages = inputImages.length > 0;

    const expansionSystem = `You are a senior art director for movie posters, K-pop campaign art, magazine covers, and high-end commercial print.

Given a user brief, expand it into a single richly detailed image generation prompt (target 350-500 words) that fully realizes the creative vision: subjects, characters, props, composition, lighting, color palette, mood, atmosphere, brand integration, typography placement and style.

OUTPUT RULES:
- Output ONLY the expanded prompt as one continuous block of plain text.
- No preamble. No headings. No markdown. No bullet points. No commentary. No quotes around it.
- Preserve the user's specified language for any text that should appear in the image (e.g., if the brief says Korean Hangul, your prompt must explicitly instruct Korean Hangul text in the image).
- Reproduce any user-provided headline/title text VERBATIM with quotes around it so the downstream model copies it letter-for-letter.
- Enforce the small-text policy: explicitly state that ONLY the headline plus at most 1-2 short tagline phrases should be rendered as text; replace any body copy with iconography, shape blocks, photographic content, or negative space.
- Do not omit any concrete element from the user's brief (characters, products, style references).`;

    const stage2Instructions = `Render the user's prompt as a single high-quality image. Reproduce all quoted text VERBATIM. Avoid rendering any small or illegible text. Keep composition cinematic and editorial.`;

    // SSE 스트림 — 첫 바이트 즉시 전송 + 10초마다 heartbeat → 게이트웨이 타임아웃 방지
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };
        const ping = () => {
          try { controller.enqueue(encoder.encode(`: hb\n\n`)); } catch {}
        };

        // 1) 즉시 첫 바이트 전송 (게이트웨이 타임아웃 방지)
        send("meta", { model: PARENT_MODEL, imageModel: IMAGE_MODEL, phase: "starting" });
        const heartbeat = setInterval(ping, 10_000);
        const tStart = Date.now();
        let stage1Ms = 0;
        let expandedPrompt = prompt;
        let stage2Reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        const tm2 = setTimeout(() => { try { stage2Reader?.cancel(); } catch {} }, 350_000);

        try {
          // 2) Stage 1: prompt expansion
          send("phase", { phase: "expanding" });
          try {
            const t1 = Date.now();
            const ab1 = new AbortController();
            const tm1 = setTimeout(() => ab1.abort(), 30_000);
            const r1 = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: PARENT_MODEL,
                messages: [
                  { role: "system", content: expansionSystem },
                  { role: "user", content: `USER BRIEF:\n\n${prompt}` },
                ],
              }),
              signal: ab1.signal,
            });
            clearTimeout(tm1);
            stage1Ms = Date.now() - t1;
            if (r1.ok) {
              const j1: any = await r1.json();
              const txt = j1?.choices?.[0]?.message?.content?.trim();
              if (txt && txt.length > 50) {
                expandedPrompt = txt;
                console.log(`[stage1] expanded ${expandedPrompt.length} chars in ${stage1Ms}ms`);
              } else {
                console.warn(`[stage1] empty/short response — using raw prompt`);
              }
            } else {
              const errTxt = await r1.text();
              console.warn(`[stage1] ${r1.status}: ${errTxt.slice(0, 200)} — using raw prompt`);
            }
          } catch (e: any) {
            console.warn(`[stage1] error: ${e?.message || e} — using raw prompt`);
          }

          // 3) Stage 2: streaming image generation
          send("phase", { phase: "generating", stage1Ms });
          const userContent: any[] = [{ type: "input_text", text: expandedPrompt }];
          inputImages.forEach((img) => {
            const b64ref = bytesToB64(img.data);
            userContent.push({
              type: "input_image",
              image_url: `data:${img.type || "image/png"};base64,${b64ref}`,
            });
          });

          const imgTool: any = {
            type: "image_generation",
            model: IMAGE_MODEL,
            size: finalSize,
            quality: "high",
            output_format: "png",
            partial_images: 2,
          };
          if (hasInputImages) imgTool.input_fidelity = "high";

          const t2 = Date.now();
          const r2 = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: PARENT_MODEL,
              instructions: stage2Instructions,
              input: [{ role: "user", content: userContent }],
              tools: [imgTool],
              tool_choice: { type: "image_generation" },
              stream: true,
            }),
          });

          if (!r2.ok) {
            const errTxt = await r2.text();
            console.error(`[stage2] ${r2.status}: ${errTxt.slice(0, 400)}`);
            send("error", { error: `이미지 생성 실패 ${r2.status}`, detail: errTxt.slice(0, 600) });
            return;
          }

          stage2Reader = r2.body!.getReader();
          let buffer = "";
          let finalB64: string | null = null;
          while (true) {
            const { done, value } = await stage2Reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";
            for (const block of events) {
              let dataLine = "";
              for (const ln of block.split("\n")) {
                if (ln.startsWith("data: ")) dataLine = ln.slice(6);
                else if (ln.startsWith("data:")) dataLine = ln.slice(5);
              }
              if (!dataLine || dataLine === "[DONE]") continue;
              let evt: any;
              try { evt = JSON.parse(dataLine); } catch { continue; }
              const t = evt?.type;
              if (t === "response.image_generation_call.partial_image") {
                const partialB64 = evt.partial_image_b64;
                const idx = evt.partial_image_index ?? 0;
                if (partialB64) {
                  send("partial", { index: idx, b64: partialB64 });
                  console.log(`[stream] partial ${idx} @ ${Date.now() - t2}ms`);
                }
              } else if (t === "response.output_item.done" && evt?.item?.type === "image_generation_call") {
                if (evt.item.result) finalB64 = evt.item.result;
              } else if (t === "response.completed") {
                if (!finalB64 && evt?.response?.output) {
                  for (const it of evt.response.output) {
                    if (it?.type === "image_generation_call" && it?.result) { finalB64 = it.result; break; }
                  }
                }
              } else if (t === "error" || t === "response.error") {
                console.error(`[stream] error:`, JSON.stringify(evt).slice(0, 400));
                send("error", { error: evt?.error?.message || "스트림 에러" });
                return;
              }
            }
          }

          if (!finalB64) {
            send("error", { error: "최종 이미지 누락" });
            return;
          }

          // 4) Storage 업로드 + final 이벤트
          const bin = Uint8Array.from(atob(finalB64), (c) => c.charCodeAt(0));
          const fname = `ai/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.png`;
          const { error: upErr } = await supa.storage.from("generated-images")
            .upload(fname, bin, { contentType: "image/png", upsert: false });
          let imageUrl: string;
          if (upErr) {
            console.warn(`[upload] failed: ${upErr.message} — sending base64`);
            imageUrl = `data:image/png;base64,${finalB64}`;
          } else {
            const { data: pub } = supa.storage.from("generated-images").getPublicUrl(fname);
            imageUrl = pub.publicUrl;
          }

          try {
            await supa.from("ai_design_usage").insert({
              user_id: userId,
              ip_hash: userId ? null : ipHash,
              prompt,
              image_url: imageUrl.startsWith("data:") ? null : imageUrl,
            });
          } catch {}

          send("final", {
            imageUrl,
            used: usageCount + 1,
            limit: dailyLimit,
            isPro,
            remaining: dailyLimit - usageCount - 1,
            model: PARENT_MODEL,
            imageModel: IMAGE_MODEL,
            stage1Ms,
            totalMs: Date.now() - tStart,
          });
          send("done", {});
        } catch (e: any) {
          console.error(`[stream] fatal: ${e?.message || e}`);
          send("error", { error: String(e?.message || e) });
        } finally {
          clearInterval(heartbeat);
          clearTimeout(tm2);
          try { stage2Reader?.cancel(); } catch {}
          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (e) {
    console.error("ai-design-gen error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
