// ============================================================
// 파일명: supabase/functions/product-advisor/index.ts
// AI 제품 어드바이저 — 자연어 → 구조화된 제품 추천 (tool_use)
//
// [배포]
// supabase functions deploy product-advisor
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ㎡당 단가 계산 (chatbot-ai와 동일 로직)
function calcPricePerSqm(product: any, allProducts: any[]): number | null {
    if (!product.is_custom_size) return null;
    if (!product.price || !product.width_mm || !product.height_mm) return null;
    if (product.width_mm === 1000 && product.height_mm === 1000) return product.price;

    const nameWords = product.name.replace(/\[.*?\]/g, '').trim().split(/\s+/);
    const hasDan = nameWords.some((w: string) => w.includes('단면'));
    const hasYang = nameWords.some((w: string) => w.includes('양면'));

    const sqmProduct = allProducts.find((p: any) => {
        if (!p.is_custom_size || !p.price) return false;
        if (p.width_mm !== 1000 || p.height_mm !== 1000) return false;
        if (p.code === product.code) return false;
        const pName = p.name.replace(/\[.*?\]/g, '').trim();
        if (hasDan && !pName.includes('단면')) return false;
        if (hasYang && !pName.includes('양면')) return false;
        if (!hasDan && !hasYang && (pName.includes('단면') || pName.includes('양면'))) return false;
        const coreWords = nameWords.filter((w: string) => w.length >= 2 && w !== '단면' && w !== '양면' && !w.startsWith('['));
        return coreWords.every((w: string) => pName.includes(w));
    });
    if (sqmProduct) return sqmProduct.price;

    const area = (product.width_mm / 1000) * (product.height_mm / 1000);
    return area > 0 ? Math.round(product.price / area) : null;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { message, lang } = await req.json();
        if (!message) throw new Error("message is required");
        const clientLang = (lang || 'kr').toLowerCase();

        // 통화 변환
        function convertPrice(krw: number): string {
            if (clientLang === 'ja') return '¥' + Math.round(krw * 0.2).toLocaleString();
            if (clientLang === 'en' || clientLang === 'us') return '$' + (krw * 0.002).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            return krw.toLocaleString() + '원';
        }

        // DB 조회
        const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const [prodRes, baseRes, catRes] = await Promise.all([
            sb.from("admin_products")
                .select("code,name,price,width_mm,height_mm,is_custom_size,is_general_product,category,description")
                .order("sort_order", { ascending: true })
                .limit(120),
            sb.from("admin_products")
                .select("code,name,price,width_mm,height_mm,is_custom_size,category")
                .eq("width_mm", 1000).eq("height_mm", 1000).eq("is_custom_size", true),
            sb.from("admin_categories")
                .select("code,name,top_category_code,description")
                .order("sort_order", { ascending: true }),
        ]);

        const baseProducts = baseRes.data || [];
        const rawProducts = prodRes.data || [];
        const allRaw = [...rawProducts];
        baseProducts.forEach((bp: any) => {
            if (!allRaw.find((p: any) => p.code === bp.code)) allRaw.push(bp);
        });

        const products = rawProducts.map((p: any) => {
            const perSqm = calcPricePerSqm(p, allRaw);
            return {
                code: p.code,
                name: p.name,
                category: p.category,
                description: p.description,
                width_mm: p.width_mm,
                height_mm: p.height_mm,
                is_custom_size: p.is_custom_size,
                price_display: convertPrice(p.price || 0),
                price_per_sqm_display: perSqm ? convertPrice(perSqm) : null,
                _raw_price: p.price || 0,
                _raw_per_sqm: perSqm,
            };
        });

        const categories = catRes.data || [];

        // 언어별 시스템 프롬프트
        const langIntro: Record<string, string> = {
            kr: `당신은 카멜레온프린팅의 AI 제품 추천 전문가입니다.
고객이 자연어로 요청하면, 가장 적합한 제품 1~3개를 추천하세요.
각 제품에 대해: 추천 이유, 적정 사이즈(mm), 예상 가격, 디자인 타이틀을 제안하세요.
반드시 recommend_products 도구를 사용하여 구조화된 형식으로 응답하세요.`,
            ja: `あなたはカメレオンプリンティングのAI製品推薦エキスパートです。
お客様の自然言語リクエストに基づき、最適な製品を1〜3つ推薦してください。
各製品について：推薦理由、適切なサイズ(mm)、予想価格、デザインタイトルを提案してください。
必ずrecommend_productsツールを使用して構造化された形式で応答してください。`,
            us: `You are an AI product recommendation expert for Chameleon Printing.
Based on the customer's natural language request, recommend 1-3 most suitable products.
For each: provide reason, recommended size(mm), estimated price, and a design title suggestion.
You MUST use the recommend_products tool to respond in structured format.`,
        };

        const systemPrompt = `${langIntro[clientLang === 'en' ? 'us' : clientLang] || langIntro['kr']}

## 추천 가이드라인
- 고객 요청의 용도, 설치 장소, 크기 힌트를 분석하세요.
- 실내/실외, 일회성/상시, 크기 등을 고려하여 최적의 소재를 선택하세요.
- 허니콤보드: 실내 전시, 팝업, 가벼운 설치물에 적합
- 패브릭: 백월, 현수막, 대형 배너에 적합
- 폼보드/포맥스: 간판, POP, 내구성 필요 시
- 종이매대: 매장 진열, 판촉 디스플레이
- 등신대: 포토존, 홍보용 인물 패널
- 사이즈는 용도에 맞게 현실적으로 추천하세요 (예: 선거 포스터 → 600x900mm)
- design_title은 고객 요청에서 핵심 문구를 추출하세요
- design_keywords는 디자인 배경/요소 검색에 사용할 키워드 (영어)

## 가격 계산
- 면적 기반 상품: (가로mm/1000) × (세로mm/1000) × ㎡당 단가, 100원 단위 반올림
- 고정가 상품: DB 가격 그대로
- 가격은 이미 현지 통화로 변환되어 있음

## 상품 목록
${JSON.stringify(products.map(p => ({ code: p.code, name: p.name, category: p.category, description: p.description, size: p.width_mm + 'x' + p.height_mm + 'mm', is_custom_size: p.is_custom_size, price: p.price_display, price_per_sqm: p.price_per_sqm_display })))}

## 카테고리
${JSON.stringify(categories)}`;

        // Claude API with tool_use
        const tools = [{
            name: "recommend_products",
            description: "Recommend products based on customer request. Always use this tool to respond.",
            input_schema: {
                type: "object" as const,
                properties: {
                    summary: {
                        type: "string" as const,
                        description: "Brief summary of what the customer needs (in customer's language)"
                    },
                    products: {
                        type: "array" as const,
                        items: {
                            type: "object" as const,
                            properties: {
                                code: { type: "string" as const, description: "Product code from DB" },
                                name: { type: "string" as const, description: "Product name (localized)" },
                                reason: { type: "string" as const, description: "Why this product is recommended (1-2 sentences, in customer's language)" },
                                recommended_width_mm: { type: "number" as const, description: "Recommended width in mm" },
                                recommended_height_mm: { type: "number" as const, description: "Recommended height in mm" },
                                price_display: { type: "string" as const, description: "Calculated price in local currency" },
                                design_title: { type: "string" as const, description: "Suggested main text for the design" },
                                design_keywords: {
                                    type: "array" as const,
                                    items: { type: "string" as const },
                                    description: "English keywords for design background/elements (e.g. 'election', 'school', 'vote')"
                                }
                            },
                            required: ["code", "name", "reason", "recommended_width_mm", "recommended_height_mm", "price_display", "design_title"]
                        }
                    }
                },
                required: ["summary", "products"]
            }
        }];

        async function callClaude(model: string, retries = 0): Promise<any> {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 1024,
                    system: systemPrompt,
                    tools,
                    tool_choice: { type: "tool", name: "recommend_products" },
                    messages: [{ role: "user", content: message }],
                }),
            });

            if (res.status === 429) {
                if (retries < 2) {
                    await new Promise(r => setTimeout(r, 1500 * (retries + 1)));
                    return callClaude(model, retries + 1);
                }
                if (model !== "claude-haiku-4-5-20251001") {
                    console.log("Sonnet 429 → Haiku fallback");
                    return callClaude("claude-haiku-4-5-20251001", 0);
                }
                throw new Error("API rate limit");
            }

            if (!res.ok) {
                const errText = await res.text();
                console.error("Claude API Error:", res.status, errText);
                throw new Error("API error " + res.status);
            }

            const data = await res.json();

            // tool_use 응답에서 input 추출
            const toolBlock = data.content.find((b: any) => b.type === "tool_use");
            if (toolBlock) {
                return toolBlock.input;
            }

            // fallback: text 응답
            const textBlock = data.content.find((b: any) => b.type === "text");
            return { summary: textBlock?.text || "", products: [] };
        }

        const result = await callClaude("claude-sonnet-4-20250514");

        // 각 추천 제품에 raw price 정보 보강 (프론트엔드 장바구니용)
        if (result.products) {
            result.products.forEach((rec: any) => {
                const dbProduct = products.find(p => p.code === rec.code);
                if (dbProduct) {
                    rec._raw_price_krw = dbProduct._raw_price;
                    rec._raw_per_sqm_krw = dbProduct._raw_per_sqm;
                    rec.is_custom_size = dbProduct.is_custom_size;
                }
            });
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Product Advisor Error:", error);
        const errMsgs: Record<string, string> = {
            kr: "추천을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
            ja: "推薦を取得できませんでした。しばらくしてからもう一度お試しください。",
            us: "Could not get recommendations. Please try again shortly.",
        };
        let errLang = 'kr';
        try { errLang = (await req.json()).lang || 'kr'; } catch {}
        return new Response(
            JSON.stringify({ summary: errMsgs[errLang === 'en' ? 'us' : errLang] || errMsgs['kr'], products: [] }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
