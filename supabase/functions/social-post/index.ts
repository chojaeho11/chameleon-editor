import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const body = await req.json();
        const { platform, title, summary, link, image_url, hashtags } = body;

        if (!platform) return jsonRes({ error: "platform is required" }, 400);

        // 플랫폼 설정 조회
        const { data: config } = await sb
            .from("marketing_social_config")
            .select("*")
            .eq("platform", platform)
            .single();

        if (!config || !config.enabled) {
            return jsonRes({ success: false, skipped: true, reason: `${platform} is not enabled` });
        }

        const cfg = config.config || {};
        let result: any;

        switch (platform) {
            case "twitter":
                result = await postToTwitter(cfg, title, summary, link, hashtags);
                break;
            case "facebook":
                result = await postToFacebook(cfg, title, summary, link, image_url, hashtags);
                break;
            case "instagram":
                result = await postToInstagram(cfg, title, summary, link, image_url, hashtags);
                break;
            case "reddit":
                result = await postToReddit(cfg, title, summary, link);
                break;
            default:
                return jsonRes({ error: "Unknown platform: " + platform }, 400);
        }

        return jsonRes({ success: true, platform, result });

    } catch (error: any) {
        console.error("Social Post Error:", error);
        return jsonRes({ error: String(error?.message || error) }, 500);
    }
});

// ═══ Twitter/X API v2 (OAuth 1.0a) ═══
async function postToTwitter(
    cfg: any, title: string, summary: string, link: string, hashtags: string[]
) {
    const { api_key, api_secret, access_token, access_token_secret } = cfg;
    if (!api_key || !access_token) throw new Error("Twitter API credentials missing");

    // 280자 제한 트윗 구성
    const tags = (hashtags || []).slice(0, 3).map((t: string) => "#" + t.replace(/\s/g, "")).join(" ");
    let text = title;
    if (summary) {
        const maxSummary = 280 - title.length - link.length - tags.length - 10;
        if (maxSummary > 20) text += "\n\n" + summary.substring(0, maxSummary);
    }
    text += "\n\n" + link;
    if (tags) text += "\n" + tags;
    if (text.length > 280) text = text.substring(0, 277) + "...";

    // OAuth 1.0a 서명
    const url = "https://api.twitter.com/2/tweets";
    const method = "POST";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID().replace(/-/g, "");

    const oauthParams: Record<string, string> = {
        oauth_consumer_key: api_key,
        oauth_nonce: nonce,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: timestamp,
        oauth_token: access_token,
        oauth_version: "1.0",
    };

    // 서명 베이스 문자열
    const paramStr = Object.keys(oauthParams)
        .sort()
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
        .join("&");
    const baseStr = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
    const signingKey = `${encodeURIComponent(api_secret)}&${encodeURIComponent(access_token_secret)}`;

    // HMAC-SHA1
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseStr));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

    const authHeader = "OAuth " + Object.entries({
        ...oauthParams,
        oauth_signature: signature,
    }).map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error("Twitter error: " + JSON.stringify(data));
    return { tweet_id: data.data?.id, text };
}

// ═══ Facebook Graph API ═══
async function postToFacebook(
    cfg: any, title: string, summary: string, link: string,
    image_url: string, hashtags: string[]
) {
    const { page_id, access_token } = cfg;
    if (!page_id || !access_token) throw new Error("Facebook credentials missing");

    const tags = (hashtags || []).slice(0, 10).map((t: string) => "#" + t.replace(/\s/g, "")).join(" ");
    const message = `${title}\n\n${summary || ""}\n\n${tags}`.trim();

    const res = await fetch(
        `https://graph.facebook.com/v19.0/${page_id}/feed`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                link,
                access_token,
            }),
        }
    );

    const data = await res.json();
    if (data.error) throw new Error("Facebook error: " + data.error.message);
    return { post_id: data.id };
}

// ═══ Instagram Graph API ═══
async function postToInstagram(
    cfg: any, title: string, summary: string, link: string,
    image_url: string, hashtags: string[]
) {
    const { ig_user_id, access_token } = cfg;
    if (!ig_user_id || !access_token) throw new Error("Instagram credentials missing");
    if (!image_url) throw new Error("Instagram requires an image");

    const tags = (hashtags || []).slice(0, 20).map((t: string) => "#" + t.replace(/\s/g, "")).join(" ");
    const caption = `${title}\n\n${summary || ""}\n\n🔗 ${link}\n\n${tags}`.trim();

    // Step 1: 미디어 컨테이너 생성
    const createRes = await fetch(
        `https://graph.facebook.com/v19.0/${ig_user_id}/media`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_url,
                caption,
                access_token,
            }),
        }
    );
    const createData = await createRes.json();
    if (createData.error) throw new Error("Instagram create error: " + createData.error.message);
    const creationId = createData.id;

    // Step 2: 발행
    const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${ig_user_id}/media_publish`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                creation_id: creationId,
                access_token,
            }),
        }
    );
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error("Instagram publish error: " + publishData.error.message);
    return { media_id: publishData.id };
}

// ═══ Reddit API ═══
async function postToReddit(
    cfg: any, title: string, summary: string, link: string
) {
    const { client_id, client_secret, username, password, subreddit } = cfg;
    if (!client_id || !username) throw new Error("Reddit credentials missing");

    // Step 1: Access token 획득
    const authStr = btoa(`${client_id}:${client_secret || ""}`);
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${authStr}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ChameleonPrint/1.0",
        },
        body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error("Reddit auth error: " + tokenData.error);
    const accessToken = tokenData.access_token;

    // Step 2: Link 포스트 제출
    const sr = subreddit || "printing";
    const submitRes = await fetch("https://oauth.reddit.com/api/submit", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ChameleonPrint/1.0",
        },
        body: `sr=${encodeURIComponent(sr)}&kind=link&title=${encodeURIComponent(title)}&url=${encodeURIComponent(link)}&resubmit=true`,
    });
    const submitData = await submitRes.json();
    if (!submitData.success && submitData.jquery) {
        const errors = submitData.jquery?.filter((e: any) => Array.isArray(e) && e[3]?.[0] === "error");
        if (errors?.length) throw new Error("Reddit submit error: " + JSON.stringify(errors));
    }
    return { reddit_url: submitData?.json?.data?.url || "posted" };
}
