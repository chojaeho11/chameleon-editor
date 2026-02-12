import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const domainMap: Record<string, string> = {
    KR: "https://www.cafe2626.com",
    JP: "https://www.cafe0101.com",
    US: "https://www.cafe3355.com",
};

const langMap: Record<string, string> = {
    KR: "ko",
    JP: "ja",
    US: "en",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const sb = createClient(supabaseUrl, supabaseKey);

        // URL 파라미터에서 도메인 필터 (선택)
        const url = new URL(req.url);
        const filterCountry = url.searchParams.get("country")?.toUpperCase(); // KR, JP, US

        // 블로그 포스트 조회 (최근 500개)
        let query = sb
            .from("community_posts")
            .select("id, title, created_at, country_code, thumbnail")
            .eq("category", "blog")
            .order("created_at", { ascending: false })
            .limit(500);

        if (filterCountry && domainMap[filterCountry]) {
            query = query.eq("country_code", filterCountry);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        // XML 사이트맵 생성
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

        for (const post of (posts || [])) {
            const cc = post.country_code || "KR";
            const domain = domainMap[cc] || domainMap.KR;
            const postUrl = `${domain}/board.html?cat=blog&country=${cc}&id=${post.id}`;
            const lastmod = new Date(post.created_at).toISOString().split("T")[0];

            xml += `  <url>
    <loc>${escapeXml(postUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
`;

            // 이미지 사이트맵 (썸네일이 있으면)
            if (post.thumbnail) {
                xml += `    <image:image>
      <image:loc>${escapeXml(post.thumbnail)}</image:loc>
      <image:title>${escapeXml(post.title || "")}</image:title>
    </image:image>
`;
            }

            xml += `  </url>
`;
        }

        xml += `</urlset>`;

        return new Response(xml, {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "public, max-age=3600", // 1시간 캐시
            },
        });

    } catch (error: any) {
        console.error("Sitemap Error:", error);
        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/xml" } }
        );
    }
});

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
