import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. 호출자 JWT 확인
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "인증 필요" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. 호출자가 admin인지 확인
        const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: caller } } = await callerClient.auth.getUser(
            authHeader.replace("Bearer ", "")
        );
        if (!caller) {
            return new Response(JSON.stringify({ error: "유효하지 않은 토큰" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: profile } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", caller.id)
            .single();

        if (!profile || !["admin", "superadmin"].includes(profile.role)) {
            return new Response(JSON.stringify({ error: "관리자 권한 필요" }), {
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. 요청 본문 파싱
        const { user_id, new_password } = await req.json();
        if (!user_id || !new_password) {
            return new Response(JSON.stringify({ error: "user_id, new_password 필수" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. 비밀번호 6자 미만 → 자동 패딩
        let padded = new_password;
        while (padded.length < 6) padded += "0";

        // 5. 비밀번호 변경
        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
            password: padded,
        });

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
