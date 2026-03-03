import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* --------------------------------------------------
   CORS
-------------------------------------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* --------------------------------------------------
   Base64 안전 변환 (대용량 대응)
-------------------------------------------------- */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/* --------------------------------------------------
   Server
-------------------------------------------------- */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { keyword } = await req.json();

    if (!keyword) {
      throw new Error("Keyword is required");
    }

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const REPLICATE_TOKEN = Deno.env.get("REPLICATE_TOKEN");

    if (!OPENAI_KEY || !REPLICATE_TOKEN) {
      throw new Error("API Keys missing");
    }

    /* ==================================================
       1️⃣ GPT : 벡터 친화 + 전단지/현수막 배경 기획
    ================================================== */
    const gptRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You output JSON only. No markdown. No explanation.",
            },
            {
              role: "user",
              content: `
You are designing a BACKGROUND IMAGE that will be converted into a VECTOR (SVG).

PURPOSE:
- Flyers
- Posters
- Banners
- Signage backgrounds

ABSOLUTE RULES:
- VERY SIMPLE, LARGE COLOR AREAS
- FLAT COLORS ONLY
- NO gradients
- NO textures
- NO noise
- NO shadows
- NO outlines
- NO thin details
- MUST be easy to convert to vector
- FAST Potrace processing

LAYOUT RULES:
- CENTER AREA must be EMPTY and SIMPLE (for text placement)
- Visual elements should be placed mostly at TOP and BOTTOM
- Background should feel balanced and calm
- Use 2~4 solid colors maximum

STYLE:
- Clean geometric shapes
- Modern flat design
- Print-friendly
- Vector-friendly
- Banner / flyer background style

SUBJECT THEME:
"${keyword}"

RETURN JSON ONLY in this exact format:
{
  "image_prompt": "Simple flat vector background for flyer or banner. Large solid color shapes. Center area empty and clean for text. Decorative shapes only at top and bottom. No gradients, no textures, no shadows. Modern minimal design. Print friendly. Vector friendly.",
  "title": "Minimal ${keyword} Background",
  "tags": ["background", "vector", "flyer", "banner", "simple", "flat"],
  "color": "#000000"
}
`,
            },
          ],
        }),
      },
    );

    const gptData = await gptRes.json();
    const concept = JSON.parse(gptData.choices[0].message.content);

    /* ==================================================
       2️⃣ Replicate : 이미지 생성
    ================================================== */
    const repRes = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: concept.image_prompt,
            aspect_ratio: "1:1",
            safety_tolerance: 5,
          },
        }),
      },
    );

    if (!repRes.ok) {
      throw new Error("Replicate generation failed");
    }

    const prediction = await repRes.json();
    const getUrl = prediction.urls.get;

    /* ==================================================
       3️⃣ Polling
    ================================================== */
    let imageUrl: string | null = null;

    while (!imageUrl) {
      await new Promise((r) => setTimeout(r, 1200));

      const check = await fetch(getUrl, {
        headers: { Authorization: `Token ${REPLICATE_TOKEN}` },
      });

      const statusData = await check.json();

      if (statusData.status === "succeeded") {
        const output = statusData.output;

        if (Array.isArray(output)) {
          imageUrl = output[0];
        } else if (
          typeof output === "object" &&
          output !== null &&
          "image" in output
        ) {
          imageUrl = output.image;
        } else if (typeof output === "string") {
          imageUrl = output;
        } else {
          throw new Error("Unknown Replicate output format");
        }
      }

      if (statusData.status === "failed") {
        throw new Error("Replicate prediction failed");
      }
    }

    /* ==================================================
       4️⃣ Image → Base64
    ================================================== */
    const imageResp = await fetch(imageUrl);
    const imageBuffer = await imageResp.arrayBuffer();
    const base64 = arrayBufferToBase64(imageBuffer);
    const dataUri = `data:image/png;base64,${base64}`;

    /* ==================================================
       5️⃣ Response
    ================================================== */
    return new Response(
      JSON.stringify({
        imageUrl: dataUri,
        concept,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("EDGE ERROR:", error);

    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
