// supabase/functions/bg-remove/index.ts
// 배경 제거 프록시: HuggingFace BiRefNet (무료, fail-fast) → remove.bg (유료 fallback).
// 2026-08-14: 무료 HF 단계가 함수를 멈춰 세우던 문제(콜드스타트 45s 블로킹 대기 → 타임아웃 → 브라우저 CORS/ERR_FAILED) 수정.
//   HF 는 8s AbortController 로 fail-fast, 콜드스타트 장시간 대기 제거 → remove.bg(잔여 크레딧)로 확실히 fallback.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HF_MODELS = [
  "https://router.huggingface.co/hf-inference/models/briaai/RMBG-2.0",
  "https://router.huggingface.co/hf-inference/models/ZhengPeng7/BiRefNet",
];

// 무료 단계가 함수를 멈춰 세우지 않게 — 타임아웃 붙은 fetch (fail-fast).
async function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { image_base64 } = body;
    if (!image_base64) throw new Error("image_base64 required");

    // base64 → binary
    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/png" });

    console.log(`[bg-remove] image_size=${(image_base64.length * 0.75 / 1024).toFixed(0)}KB`);

    // 키 조회 (env 우선 → secrets 테이블 fallback). client 는 1회만 생성.
    let sbClient: ReturnType<typeof createClient> | null = null;
    const getSecret = async (name: string): Promise<string | undefined> => {
      const env = Deno.env.get(name);
      if (env) return env;
      try {
        if (!sbClient) {
          sbClient = createClient(
            Deno.env.get("SUPABASE_URL") || "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
          );
        }
        const { data } = await sbClient.from("secrets").select("value").eq("name", name).single();
        return data?.value || undefined;
      } catch (_) {
        return undefined;
      }
    };

    let resultBlob: Blob | null = null;
    let lastError = "";

    // ─── 1차: HuggingFace (무료) — 8s fail-fast, 콜드스타트 장시간 대기 없음 ───
    const hfKey = await getSecret("HF_API_KEY");
    if (hfKey) {
      for (const modelUrl of HF_MODELS) {
        try {
          const res = await fetchWithTimeout(modelUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${hfKey}`, "Content-Type": "application/octet-stream" },
            body: blob,
          }, 8000);
          if (res.ok && (res.headers.get("content-type") || "").includes("image")) {
            resultBlob = await res.blob();
            console.log(`[bg-remove] HF success: ${modelUrl}`);
            break;
          }
          lastError = `HF ${modelUrl}: ${res.status}`;
        } catch (e) {
          lastError = `HF: ${(e as Error).message}`;
        }
      }
    } else {
      console.log("[bg-remove] No HF_API_KEY, skipping HuggingFace");
    }

    // ─── 2차: remove.bg API (유료 fallback) ───
    let creditError = false;
    if (!resultBlob) {
      const removeBgKey = (await getSecret("REMOVE_BG_API_KEY")) || (await getSecret("REMOVEBG_API_KEY"));
      if (removeBgKey) {
        try {
          console.log("[bg-remove] Trying remove.bg...");
          const formData = new FormData();
          formData.append("image_file", blob, "image.png");
          formData.append("size", "auto");

          const res = await fetchWithTimeout("https://api.remove.bg/v1.0/removebg", {
            method: "POST",
            headers: { "X-Api-Key": removeBgKey },
            body: formData,
          }, 40000);

          if (res.ok) {
            resultBlob = await res.blob();
            console.log("[bg-remove] remove.bg success");
          } else {
            const errText = await res.text().catch(() => "");
            if (res.status === 402) creditError = true;
            lastError = `remove.bg: ${res.status} ${errText.slice(0, 300)}`;
            console.error(`[bg-remove] remove.bg failed: ${lastError}`);
          }
        } catch (e) {
          lastError = `remove.bg: ${(e as Error).message}`;
        }
      } else {
        lastError = "No REMOVE_BG_API_KEY";
        console.log("[bg-remove] No REMOVE_BG_API_KEY either");
      }
    }

    if (!resultBlob) {
      const msg = creditError
        ? "remove.bg credits exhausted. Please top up remove.bg credits."
        : `All methods failed: ${lastError}`;
      return new Response(
        JSON.stringify({ error: msg, credit: creditError }),
        { status: creditError ? 402 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // result blob → base64
    const arrBuf = await resultBlob.arrayBuffer();
    const u8 = new Uint8Array(arrBuf);
    let binary = "";
    for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
    const resultBase64 = btoa(binary);

    return new Response(
      JSON.stringify({ image_base64: resultBase64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[bg-remove] Error:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
