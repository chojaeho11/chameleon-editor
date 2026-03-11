// supabase/functions/bg-remove/index.ts
// BiRefNet (BRIA RMBG-2.0) 배경 제거 프록시
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HF_MODELS = [
  "https://router.huggingface.co/hf-inference/models/briaai/RMBG-2.0",
  "https://router.huggingface.co/hf-inference/models/ZhengPeng7/BiRefNet",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { image_base64 } = body;
    if (!image_base64) throw new Error("image_base64 required");

    // HF API Key
    let hfKey = Deno.env.get("HF_API_KEY");
    if (!hfKey) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      const { data } = await sb.from("secrets").select("value").eq("name", "HF_API_KEY").single();
      hfKey = data?.value;
    }
    if (!hfKey) throw new Error("HF_API_KEY not configured");

    // base64 → binary
    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/png" });

    console.log(`[bg-remove] image_size=${(image_base64.length * 0.75 / 1024).toFixed(0)}KB`);

    let resultBlob: Blob | null = null;
    let lastError = "";

    for (const modelUrl of HF_MODELS) {
      try {
        const res = await fetch(modelUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${hfKey}`, "Content-Type": "application/octet-stream" },
          body: blob,
        });

        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("image")) {
            resultBlob = await res.blob();
            break;
          }
        }

        // Cold start - wait and retry
        if (res.status === 503) {
          const info = await res.json().catch(() => ({}));
          const wait = Math.min((info.estimated_time || 20) * 1000, 45000);
          console.log(`[bg-remove] Model loading, waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
          const retry = await fetch(modelUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${hfKey}`, "Content-Type": "application/octet-stream" },
            body: blob,
          });
          if (retry.ok) { resultBlob = await retry.blob(); break; }
        }

        lastError = `${modelUrl}: ${res.status}`;
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!resultBlob) throw new Error(`All models failed: ${lastError}`);

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
    console.error("[bg-remove] Error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
