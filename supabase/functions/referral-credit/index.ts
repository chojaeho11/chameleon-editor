// 추천인(레퍼럴) 적립 — service_role 로 추천인+본인 양쪽 event_coupon += 10,000 KRW (JP 1,000엔 / US $10 환산표시).
// cotton-print.com 등 anon 도메인에서 호출 (타인 profile 수정은 anon 불가 → 이 함수가 service_role 로 처리).
// action: 'search' (추천인 검색) | 'credit' (적립).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REFERRAL_KRW = 10000; // DB 는 KRW 저장 → 프론트에서 JP×0.1=1,000엔 / US×0.001=$10 환산표시

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// 부분 마스킹 — 추천인 식별은 되되 전체 PII 노출은 방지
function maskMid(s: string, keepStart = 2, keepEnd = 2): string {
    if (!s) return "";
    if (s.length <= keepStart + keepEnd) return s[0] + "*".repeat(Math.max(1, s.length - 1));
    return s.slice(0, keepStart) + "*".repeat(Math.min(4, s.length - keepStart - keepEnd)) + s.slice(s.length - keepEnd);
}
function maskEmail(e: string): string {
    if (!e || e.indexOf("@") < 0) return maskMid(e || "");
    const [u, d] = e.split("@");
    return maskMid(u, 2, 1) + "@" + d;
}
function labelFor(p: any): string {
    const name = p.biz_name || p.username || "";
    const parts: string[] = [];
    if (name) parts.push(name);
    if (p.email) parts.push(maskEmail(p.email));
    if (p.phone) parts.push(maskMid(String(p.phone), 3, 2));
    return parts.join(" · ") || "(이름없음)";
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const body = await req.json().catch(() => ({}));
        const action = body.action || "";

        // ── 추천인 검색 (아이디 / 이메일 / 전화번호 / 상호명) ──
        if (action === "search") {
            const q = String(body.query || "").trim();
            if (q.length < 2) return json({ results: [] });
            const like = `%${q.replace(/[%,]/g, "")}%`;
            const { data, error } = await admin
                .from("profiles")
                .select("id, username, email, phone, biz_name")
                .or(`username.ilike.${like},email.ilike.${like},phone.ilike.${like},biz_name.ilike.${like}`)
                .limit(8);
            if (error) return json({ error: error.message });
            return json({ results: (data || []).map((p: any) => ({ id: p.id, label: labelFor(p) })) });
        }

        // ── 적립 (추천인 + 본인 각 1만원) ──
        if (action === "credit") {
            const referrerId = String(body.referrerId || "").trim();
            const rawApplicant = String(body.applicant || "").trim().toLowerCase();
            if (!referrerId) return json({ error: "추천인을 선택해 주세요." });

            let applicant: any = null;
            // 1순위: 로그인 토큰으로 본인 식별 (메인 사이트 가입 직후 — 남용 차단)
            const authH = req.headers.get("authorization") || "";
            const token = authH.replace(/^Bearer\s+/i, "");
            if (token) {
                try {
                    const { data: ures } = await admin.auth.getUser(token);
                    const u = ures && ures.user;
                    if (u) {
                        const { data: prof } = await admin.from("profiles")
                            .select("id, event_coupon, email, username").eq("id", u.id).maybeSingle();
                        if (prof) applicant = prof;
                    }
                } catch (_e) { /* 토큰 무효 → 아래 이메일 경로로 폴백 */ }
            }
            // 2순위: 이메일/아이디 입력 (비로그인 도메인 폴백)
            if (!applicant) {
                if (!rawApplicant) return json({ error: "본인 가입 아이디/이메일을 입력해 주세요." });
                const candidates = [rawApplicant];
                if (rawApplicant.indexOf("@") < 0) candidates.push(rawApplicant + "@cafe2626.com");
                const { data: byEmail } = await admin.from("profiles")
                    .select("id, event_coupon, email, username").in("email", candidates).limit(1);
                if (byEmail && byEmail.length) applicant = byEmail[0];
                if (!applicant) {
                    const { data: byUser } = await admin.from("profiles")
                        .select("id, event_coupon, email, username").eq("username", rawApplicant).limit(1);
                    if (byUser && byUser.length) applicant = byUser[0];
                }
            }
            if (!applicant) return json({ error: "본인 계정을 찾을 수 없습니다. 먼저 회원가입 후, 가입한 아이디/이메일을 정확히 입력해 주세요." });

            const { data: referrer } = await admin.from("profiles")
                .select("id, event_coupon, username, email").eq("id", referrerId).maybeSingle();
            if (!referrer) return json({ error: "추천인을 찾을 수 없습니다." });
            if (referrer.id === applicant.id) return json({ error: "본인을 추천인으로 입력할 수 없습니다." });

            // 본인은 추천 적립 1회만
            const { data: prev } = await admin.from("wallet_logs")
                .select("id").eq("user_id", applicant.id).eq("type", "event_referral").limit(1);
            if (prev && prev.length) return json({ error: "이미 추천인 적립을 받으셨습니다. (계정당 1회)" });

            // 양쪽 event_coupon 증액
            await admin.from("profiles").update({ event_coupon: (applicant.event_coupon || 0) + REFERRAL_KRW }).eq("id", applicant.id);
            await admin.from("profiles").update({ event_coupon: (referrer.event_coupon || 0) + REFERRAL_KRW }).eq("id", referrer.id);
            // 원장 기록 (감사·중복방지)
            await admin.from("wallet_logs").insert([
                { user_id: applicant.id, type: "event_referral", amount: REFERRAL_KRW, description: "추천인 적립(피추천) ref=" + referrer.id },
                { user_id: referrer.id, type: "event_referral", amount: REFERRAL_KRW, description: "추천 적립(추천인) applicant=" + applicant.id },
            ]);
            return json({ ok: true, amount: REFERRAL_KRW });
        }

        return json({ error: "unknown action" });
    } catch (e) {
        return json({ error: (e as Error).message || String(e) });
    }
});
