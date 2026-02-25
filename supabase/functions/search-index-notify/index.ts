import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOMAINS: Record<string, string> = {
    KR: "https://www.cafe2626.com",
    JP: "https://www.cafe0101.com",
    US: "https://www.cafe3355.com",
};

const INDEXNOW_KEY = "cf8e9a2b4d6f1c3e5a7b9d0f2e4c6a8b";

const SEO_CATEGORIES = [
    "honeycomb", "fabric-print", "paper-stand", "goods", "acrylic-print",
    "paper-furniture", "foamex-print", "foamboard-print", "foamex-stand",
    "biz-print", "promo-items", "tshirt-print", "banner-stand", "standee",
];

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const action = body.action; // "single" | "bulk" | "ping"

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const sb = createClient(supabaseUrl, supabaseKey);

        const googleSaJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

        let productCodes: string[] = [];

        if (action === "single" && body.product_code) {
            productCodes = [body.product_code];
        } else if (action === "bulk") {
            const { data: products } = await sb
                .from("admin_products")
                .select("code")
                .or("partner_id.is.null,partner_status.eq.approved");
            productCodes = (products || []).map((p: any) => p.code);
        }

        // Build URLs for all 3 domains
        const allUrls: string[] = [];
        for (const code of productCodes) {
            for (const domain of Object.values(DOMAINS)) {
                allUrls.push(`${domain}/${code}`);
            }
        }

        // Add category pages for bulk
        if (action === "bulk") {
            for (const cat of SEO_CATEGORIES) {
                for (const domain of Object.values(DOMAINS)) {
                    allUrls.push(`${domain}/${cat}`);
                }
            }
            // Add homepages
            for (const domain of Object.values(DOMAINS)) {
                allUrls.push(domain + "/");
            }
        }

        const results: Record<string, any> = {};

        // 1. IndexNow — Bing, Yandex, Seznam, and others
        results.indexNow = await submitIndexNow(allUrls);

        // 2. Google Indexing API
        if (googleSaJson) {
            try {
                const sa = JSON.parse(googleSaJson);
                results.google = await submitGoogleIndexing(allUrls, sa);
            } catch (e: any) {
                results.google = { error: "Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: " + e.message };
            }
        } else {
            results.google = { skipped: true, reason: "GOOGLE_SERVICE_ACCOUNT_JSON not set" };
        }

        // 3. Sitemap ping — Google, Bing, Yandex, Naver
        results.sitemapPing = await pingSitemaps();

        return new Response(JSON.stringify({
            success: true,
            urlCount: allUrls.length,
            productCount: productCodes.length,
            results,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Search Index Notify Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

// ========== IndexNow ==========
async function submitIndexNow(urls: string[]): Promise<any> {
    const results: any[] = [];

    for (const [country, domain] of Object.entries(DOMAINS)) {
        const hostUrls = urls.filter(u => u.startsWith(domain));
        if (hostUrls.length === 0) continue;

        const host = new URL(domain).hostname;

        // Batch max 10,000
        for (let i = 0; i < hostUrls.length; i += 10000) {
            const batch = hostUrls.slice(i, i + 10000);
            try {
                const res = await fetch("https://yandex.com/indexnow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({
                        host,
                        key: INDEXNOW_KEY,
                        keyLocation: `${domain}/${INDEXNOW_KEY}.txt`,
                        urlList: batch,
                    }),
                });
                results.push({
                    country, host,
                    urlCount: batch.length,
                    status: res.status,
                    statusText: res.statusText,
                });
            } catch (e: any) {
                results.push({ country, host, error: e.message });
            }
        }
    }
    return results;
}

// ========== Google Indexing API ==========
async function submitGoogleIndexing(urls: string[], serviceAccount: any): Promise<any> {
    try {
        const accessToken = await getGoogleAccessToken(serviceAccount);
        let submitted = 0;
        let errors = 0;
        const errorDetails: string[] = [];
        const maxPerCall = 200; // daily limit

        const batch = urls.slice(0, maxPerCall);

        for (const url of batch) {
            try {
                const res = await fetch(
                    "https://indexing.googleapis.com/v3/urlNotifications:publish",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ url, type: "URL_UPDATED" }),
                    }
                );
                if (res.ok) {
                    submitted++;
                } else {
                    errors++;
                    if (errorDetails.length < 5) {
                        const errText = await res.text();
                        errorDetails.push(`${url}: ${res.status} ${errText.slice(0, 100)}`);
                    }
                }
            } catch {
                errors++;
            }
        }

        return {
            submitted,
            errors,
            total: batch.length,
            remaining: Math.max(0, urls.length - maxPerCall),
            errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        };
    } catch (e: any) {
        return { error: e.message };
    }
}

// JWT for Google Service Account
async function getGoogleAccessToken(sa: any): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const headerObj = { alg: "RS256", typ: "JWT" };
    const payloadObj = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/indexing",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    };

    const pemContent = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s/g, "");

    const binaryKey = Uint8Array.from(atob(pemContent), (c: string) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const b64url = (s: string) =>
        btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const headerB64 = b64url(JSON.stringify(headerObj));
    const payloadB64 = b64url(JSON.stringify(payloadObj));
    const signInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signInput);
    const sigB64 = b64url(String.fromCharCode(...new Uint8Array(signature)));

    const jwt = `${headerB64}.${payloadB64}.${sigB64}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        throw new Error(`Google token error: ${JSON.stringify(tokenData)}`);
    }
    return tokenData.access_token;
}

// ========== Sitemap Ping ==========
async function pingSitemaps(): Promise<any> {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://qinvtnhiidtmrzosyvys.supabase.co";
    const results: any[] = [];

    const sitemapEndpoints = [
        `${supabaseUrl}/functions/v1/sitemap-products?country=KR`,
        `${supabaseUrl}/functions/v1/sitemap-products?country=JP`,
        `${supabaseUrl}/functions/v1/sitemap-products?country=US`,
        `${supabaseUrl}/functions/v1/sitemap-blog?country=KR`,
        `${supabaseUrl}/functions/v1/sitemap-blog?country=JP`,
        `${supabaseUrl}/functions/v1/sitemap-blog?country=US`,
    ];

    // Yandex sitemap ping (still active)
    for (const sitemapUrl of sitemapEndpoints) {
        try {
            const res = await fetch(`https://webmaster.yandex.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
            results.push({ engine: "yandex", sitemap: sitemapUrl, status: res.status });
        } catch (e: any) {
            results.push({ engine: "yandex", sitemap: sitemapUrl, error: e.message });
        }
    }

    // IndexNow submission for sitemaps (Yandex shares with Bing/Seznam/Naver)
    for (const [_cc, domain] of Object.entries(DOMAINS)) {
        const host = new URL(domain).hostname;
        const sitemapUrlsForDomain = sitemapEndpoints.map(s => `${domain}/sitemap.xml`);
        try {
            const res = await fetch("https://yandex.com/indexnow", {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify({
                    host,
                    key: INDEXNOW_KEY,
                    keyLocation: `${domain}/${INDEXNOW_KEY}.txt`,
                    urlList: [domain + "/"],
                }),
            });
            results.push({ engine: "indexnow-home", host, status: res.status });
        } catch (e: any) {
            results.push({ engine: "indexnow-home", host, error: e.message });
        }
    }

    return results;
}
