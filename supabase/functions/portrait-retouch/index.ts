// supabase/functions/portrait-retouch/index.ts
// AILab Tools 전체 AI 보정 API 프록시
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== 엔드포인트 매핑 ==========
const ENDPOINTS: Record<string, string> = {
    // Beauty / Enhancement
    smart_beauty:      "https://www.ailabapi.com/api/portrait/effects/smart-beauty",
    face_beauty_pro:   "https://www.ailabapi.com/api/portrait/effects/face-beauty-pro",
    smart_skin:        "https://www.ailabapi.com/api/portrait/effects/smart-skin",
    face_enhancer:     "https://www.ailabapi.com/api/portrait/effects/enhance-face",
    face_slimming:     "https://www.ailabapi.com/api/portrait/effects/smart-face-slimming",
    // Fun / Creative
    age_gender:        "https://www.ailabapi.com/api/portrait/effects/face-attribute-editing",
    emotion:           "https://www.ailabapi.com/api/portrait/effects/emotion-editor",
    face_filter:       "https://www.ailabapi.com/api/portrait/effects/face-filter",
    cartoon:           "https://www.ailabapi.com/api/portrait/effects/portrait-animation",
    hairstyle:         "https://www.ailabapi.com/api/portrait/effects/hairstyle-editor-pro",
    lips_color:        "https://www.ailabapi.com/api/portrait/effects/lips-color-changer",
    face_blur:         "https://www.ailabapi.com/api/portrait/effects/blurred-faces",
    face_fusion:       "https://www.ailabapi.com/api/portrait/effects/face-fusion",
    // Analysis
    skin_analysis:     "https://www.ailabapi.com/api/portrait/analysis/skin-analysis",
};

// image_target 사용하는 API들
const IMAGE_TARGET_APIS = new Set(["smart_beauty", "emotion", "face_fusion"]);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, image_base64, image_base64_2, params } = body;

        if (!action || !image_base64) {
            throw new Error("action and image_base64 are required");
        }

        const endpoint = ENDPOINTS[action];
        if (!endpoint) throw new Error(`Unknown action: ${action}`);

        // API 키
        let apiKey = Deno.env.get("AILAB_API_KEY");
        if (!apiKey) {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
            const sb = createClient(supabaseUrl, supabaseKey);
            const { data } = await sb.from("secrets").select("value").eq("name", "AILAB_API_KEY").single();
            apiKey = data?.value;
        }
        if (!apiKey) throw new Error("AILAB_API_KEY not configured");

        // base64 → Blob
        const binaryStr = atob(image_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/png" });

        // FormData 구성
        const formData = new FormData();

        // 이미지 필드명 결정
        const imageField = IMAGE_TARGET_APIS.has(action) ? "image_target" : "image";
        formData.append(imageField, blob, "image.png");

        // 두 번째 이미지 (face_fusion)
        if (action === "face_fusion" && image_base64_2) {
            const bin2 = atob(image_base64_2);
            const bytes2 = new Uint8Array(bin2.length);
            for (let i = 0; i < bin2.length; i++) bytes2[i] = bin2.charCodeAt(i);
            formData.append("image_template", new Blob([bytes2], { type: "image/png" }), "template.png");
        }

        // ========== 액션별 파라미터 ==========
        const p = params || {};

        switch (action) {
            case "smart_beauty":
                formData.append("beauty_level", String(p.beauty_level ?? 1));
                formData.append("task_type", "sync");
                break;

            case "face_beauty_pro":
                formData.append("whitening", String(p.whitening ?? 50));
                formData.append("smoothing", String(p.smoothing ?? 50));
                formData.append("thinface", String(p.thinface ?? 30));
                formData.append("shrink_face", String(p.shrink_face ?? 30));
                formData.append("enlarge_eye", String(p.enlarge_eye ?? 30));
                if (p.filter_type) formData.append("filter_type", String(p.filter_type));
                break;

            case "smart_skin":
                formData.append("retouch_degree", String(p.retouch_degree ?? 1.2));
                formData.append("whitening_degree", String(p.whitening_degree ?? 0.5));
                break;

            case "face_enhancer":
                // 파라미터 없음
                break;

            case "face_slimming":
                formData.append("slim_degree", String(p.slim_degree ?? 1.0));
                break;

            case "age_gender":
                formData.append("action_type", String(p.action_type || "TO_KID"));
                if (p.target !== undefined) formData.append("target", String(p.target));
                break;

            case "emotion":
                formData.append("service_choice", String(p.service_choice || 10));
                break;

            case "face_filter":
                formData.append("resource_type", String(p.resource_type || "10001"));
                formData.append("strength", String(p.strength ?? 0.8));
                break;

            case "cartoon":
                formData.append("type", String(p.type || "3d_cartoon"));
                break;

            case "hairstyle":
                formData.append("task_type", "async");
                formData.append("auto", "1");
                formData.append("hair_style", String(p.hair_style || "FemaleShortCurlyBob"));
                if (p.color) formData.append("color", p.color);
                break;

            case "lips_color":
                formData.append("lip_color_infos", JSON.stringify(p.lip_color_infos || [
                    { rgba: { r: 200, g: 50, b: 50, a: 60 } }
                ]));
                break;

            case "face_blur":
                // 파라미터 없음
                break;

            case "face_fusion":
                if (p.source_similarity !== undefined) {
                    formData.append("source_similarity", String(p.source_similarity));
                }
                break;

            case "skin_analysis":
                // 파라미터 없음
                break;
        }

        // ========== API 호출 ==========
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "ailabapi-api-key": apiKey },
            body: formData,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`AILab API error ${res.status}: ${errText.slice(0, 300)}`);
        }

        const result = await res.json();
        if (result.error_code && result.error_code !== 0) {
            throw new Error(`AILab: ${result.error_msg || result.error_code}`);
        }

        // ========== 응답 처리 ==========
        const responseData: Record<string, any> = {};

        // 비동기 API (hairstyle) — 폴링 필요
        if (action === "hairstyle" && result.task_id) {
            // 최대 60초 폴링
            let taskResult = null;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const checkRes = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "ailabapi-api-key": apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ task_id: result.task_id }),
                });
                const checkJson = await checkRes.json();
                if (checkJson.data?.task_status === 2) {
                    taskResult = checkJson;
                    break;
                } else if (checkJson.data?.task_status === -1) {
                    throw new Error("Hairstyle generation failed");
                }
            }
            if (!taskResult) throw new Error("Hairstyle generation timeout");
            responseData.image_url = taskResult.data?.images?.[0];
        }
        // 피부 분석 — JSON 데이터 반환
        else if (action === "skin_analysis") {
            responseData.analysis = result.result || result;
        }
        // base64 응답들
        else if (result.result && typeof result.result === "string") {
            responseData.image_base64 = result.result; // face_beauty_pro
        } else if (result.result?.image) {
            responseData.image_base64 = result.result.image; // age_gender
        } else if (result.data?.image) {
            responseData.image_base64 = result.data.image; // emotion, smart_beauty, face_fusion
        } else if (result.result_image) {
            responseData.image_base64 = result.result_image; // lips_color
        }
        // URL 응답들
        else if (result.data?.image_url) {
            responseData.image_url = result.data.image_url; // smart_skin, face_enhancer, etc.
        }
        // 알 수 없는 형식
        else {
            responseData.raw = result;
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
