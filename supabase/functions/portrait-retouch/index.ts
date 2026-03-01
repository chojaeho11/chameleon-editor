// supabase/functions/portrait-retouch/index.ts
// AILab Tools API 프록시 — 인물 보정 (피부, 잡티, 얼굴 성형, 전체 보정)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AILab API 엔드포인트 매핑
const ENDPOINTS: Record<string, string> = {
    face_beauty:  "https://www.ailabapi.com/api/portrait/effects/face-beauty",
    blemish:      "https://www.ailabapi.com/api/portrait/effects/smart-skin",
    face_shape:   "https://www.ailabapi.com/api/portrait/effects/face-beauty-pro",
    full_beauty:  "https://www.ailabapi.com/api/portrait/effects/face-beauty-pro",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, image_base64 } = body;

        if (!action || !image_base64) {
            throw new Error("action and image_base64 are required");
        }

        const endpoint = ENDPOINTS[action];
        if (!endpoint) throw new Error(`Unknown action: ${action}`);

        // API 키 가져오기 — 환경변수 또는 DB secrets
        let apiKey = Deno.env.get("AILAB_API_KEY");
        if (!apiKey) {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
            const sb = createClient(supabaseUrl, supabaseKey);
            const { data } = await sb
                .from("secrets")
                .select("value")
                .eq("name", "AILAB_API_KEY")
                .single();
            apiKey = data?.value;
        }

        if (!apiKey) throw new Error("AILAB_API_KEY not configured");

        // base64 → Blob (multipart/form-data 용)
        const binaryStr = atob(image_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "image/png" });

        // FormData 구성
        const formData = new FormData();
        formData.append("image", blob, "image.png");

        // 액션별 파라미터
        if (action === "face_beauty") {
            // 기본 피부 보정: smooth + white + sharp
            formData.append("smooth", "0.8");
            formData.append("white", "0.5");
            formData.append("sharp", "0.3");
        } else if (action === "blemish") {
            // 잡티 제거 (smart-skin): 강한 dermabrasion
            formData.append("retouch_degree", "1.2");
            formData.append("whitening_degree", "0.3");
        } else if (action === "face_shape") {
            // 얼굴 성형: thinface + enlarge_eye + shrink_face
            formData.append("thinface", "60");
            formData.append("shrink_face", "50");
            formData.append("enlarge_eye", "40");
            formData.append("smoothing", "30");
            formData.append("whitening", "20");
        } else if (action === "full_beauty") {
            // 전체 보정: 모든 파라미터 적당히
            formData.append("whitening", "50");
            formData.append("smoothing", "50");
            formData.append("thinface", "30");
            formData.append("shrink_face", "30");
            formData.append("enlarge_eye", "30");
        }

        // AILab API 호출
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "ailabapi-api-key": apiKey,
            },
            body: formData,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`AILab API error ${res.status}: ${errText.slice(0, 200)}`);
        }

        const result = await res.json();

        if (result.error_code && result.error_code !== 0) {
            throw new Error(`AILab error: ${result.error_msg || result.error_code}`);
        }

        // 결과 처리 — face-beauty-pro는 base64, 다른 건 image_url
        let responseData: Record<string, any> = {};

        if (result.result) {
            // face-beauty-pro: result 필드에 base64
            responseData.image_base64 = result.result;
        } else if (result.data?.image_url) {
            // smart-skin, face-beauty: data.image_url
            responseData.image_url = result.data.image_url;
        } else {
            throw new Error("Unexpected API response format");
        }

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Portrait Retouch Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
