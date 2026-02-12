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

// 제품별 SEO 설명 (3개국어)
const productSeoDesc: Record<string, Record<string, string>> = {
    honeycomb: { KR: "친환경 허니콤보드 맞춤 인쇄", JP: "エコハニカムボードカスタム印刷", US: "Custom eco-friendly honeycomb board printing" },
    "fabric-print": { KR: "고화질 패브릭(천) 맞춤 인쇄", JP: "高画質ファブリック印刷", US: "High-quality custom fabric printing" },
    "paper-stand": { KR: "친환경 종이매대 맞춤 제작", JP: "エコ紙什器カスタム制作", US: "Custom eco paper display stands" },
    "paper-furniture": { KR: "친환경 종이가구 맞춤 제작", JP: "エコ紙家具カスタム制作", US: "Custom eco paper furniture" },
    "foamex-print": { KR: "포맥스(PVC폼보드) 맞춤 인쇄", JP: "フォーレックス印刷", US: "Foamex PVC foam board printing" },
    "foamboard-print": { KR: "폼보드(우드락) 맞춤 인쇄", JP: "フォームボード印刷", US: "Custom foam board printing" },
    goods: { KR: "아크릴 굿즈 맞춤 제작", JP: "アクリルグッズ制作", US: "Custom acrylic goods" },
    "foamex-stand": { KR: "포맥스 매대 맞춤 제작", JP: "フォーレックス什器制作", US: "Custom Foamex display stands" },
    "biz-print": { KR: "명함·전단지·브로셔 인쇄", JP: "名刺・チラシ印刷", US: "Business cards, flyers & brochures" },
    "roll-blind": { KR: "맞춤 롤블라인드 인쇄 제작", JP: "オーダーロールブラインド", US: "Custom printed roll blinds" },
    "home-interior": { KR: "맞춤 홈 인테리어 인쇄", JP: "ホームインテリア印刷", US: "Custom home interior printing" },
    "promo-items": { KR: "판촉물·기념품 맞춤 제작", JP: "販促品・記念品制作", US: "Custom promotional items" },
    "flexible-package": { KR: "연포장(파우치) 맞춤 인쇄", JP: "軟包装パウチ印刷", US: "Custom flexible packaging" },
    "box-package": { KR: "박스 패키지 맞춤 제작", JP: "ボックスパッケージ制作", US: "Custom box packaging" },
    "shopping-bag": { KR: "쇼핑백 맞춤 인쇄 제작", JP: "ショッピングバッグ制作", US: "Custom shopping bags" },
    "acrylic-print": { KR: "아크릴 UV 인쇄", JP: "アクリルUV印刷", US: "Acrylic UV printing" },
    "banner-stand": { KR: "배너 스탠드 맞춤 제작", JP: "バナースタンド制作", US: "Custom banner stands" },
    standee: { KR: "등신대 맞춤 제작", JP: "等身大パネル制作", US: "Custom life-size standees" },
    "rubber-magnet": { KR: "고무자석 맞춤 인쇄", JP: "ラバーマグネット印刷", US: "Custom rubber magnets" },
    placard: { KR: "피켓 맞춤 인쇄 제작", JP: "プラカード制作", US: "Custom placards & signs" },
    "sheet-print": { KR: "시트·스티커 맞춤 인쇄", JP: "シート・ステッカー印刷", US: "Custom sheet & sticker printing" },
    "flex-sign": { KR: "플렉스 간판 맞춤 제작", JP: "フレックス看板制作", US: "Custom flex signs" },
    "uv-print": { KR: "UV 인쇄 서비스", JP: "UV印刷サービス", US: "UV printing service" },
    "tshirt-print": { KR: "티셔츠 맞춤 인쇄", JP: "Tシャツ印刷", US: "Custom t-shirt printing" },
    "blackout-blind": { KR: "암막 블라인드 맞춤 제작", JP: "遮光ブラインド制作", US: "Custom blackout blinds" },
    curtain: { KR: "커튼 맞춤 인쇄 제작", JP: "オーダーカーテン制作", US: "Custom printed curtains" },
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const sb = createClient(supabaseUrl, supabaseKey);

        // URL 파라미터에서 국가 필터
        const url = new URL(req.url);
        const filterCountry = url.searchParams.get("country")?.toUpperCase() || "KR";

        const domain = domainMap[filterCountry] || domainMap.KR;
        const lang = langMap[filterCountry] || "ko";

        // 제품 목록 조회
        const { data: products, error } = await sb
            .from("admin_products")
            .select("code, name, name_jp, name_us, img_url, price, price_jp, price_us, category, description")
            .or("partner_id.is.null,partner_status.eq.approved")
            .order("sort_order", { ascending: true });

        if (error) throw error;

        // XML 사이트맵 생성
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

        for (const product of (products || [])) {
            const code = product.code;
            const productUrl = `${domain}/${code}`;

            // 언어별 이름
            let name = product.name || code;
            if (filterCountry === "JP" && product.name_jp) name = product.name_jp;
            if (filterCountry === "US" && product.name_us) name = product.name_us;

            // SEO 설명
            const seoDesc = productSeoDesc[code]?.[filterCountry] || name;

            xml += `  <url>
    <loc>${escapeXml(productUrl)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
`;

            // hreflang (3개 도메인)
            for (const [cc, d] of Object.entries(domainMap)) {
                xml += `    <xhtml:link rel="alternate" hreflang="${langMap[cc]}" href="${d}/${code}"/>
`;
            }
            xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${domainMap.KR}/${code}"/>
`;

            // 이미지 사이트맵
            if (product.img_url) {
                xml += `    <image:image>
      <image:loc>${escapeXml(product.img_url)}</image:loc>
      <image:title>${escapeXml(name)}</image:title>
      <image:caption>${escapeXml(seoDesc)}</image:caption>
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
                "Cache-Control": "public, max-age=3600",
            },
        });

    } catch (error: any) {
        console.error("Product Sitemap Error:", error);
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
