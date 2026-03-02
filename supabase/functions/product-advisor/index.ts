// ============================================================
// 파일명: supabase/functions/product-advisor/index.ts
// AI 어드바이저 — 대화형 AI + 제품 추천 (tool_use: auto)
//
// [배포] supabase functions deploy product-advisor
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
        const { message, lang, image, image_type } = await req.json();
        if (!message && !image) throw new Error("message or image is required");
        const clientLang = (lang || 'kr').toLowerCase();

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
                .order("sort_order", { ascending: true }).limit(120),
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
                code: p.code, name: p.name, category: p.category, description: p.description,
                width_mm: p.width_mm, height_mm: p.height_mm, is_custom_size: p.is_custom_size,
                price_display: convertPrice(p.price || 0),
                price_per_sqm_display: perSqm ? convertPrice(perSqm) : null,
                _raw_price: p.price || 0, _raw_per_sqm: perSqm,
            };
        });

        const categories = catRes.data || [];
        const siteUrl = clientLang === 'ja' ? 'https://www.cafe0101.com' : clientLang === 'en' || clientLang === 'us' ? 'https://www.cafe3355.com' : 'https://www.cafe2626.com';

        // 시스템 프롬프트 — 친근한 대화형 AI
        const langPrompts: Record<string, string> = {
            kr: `카멜레온프린팅 AI 어시스턴트. 따뜻하고 친근하게 응대. 이모지 사용. 3~5문장.

규칙: products 배열에 항상 정확히 2개 제품을 넣어. 0개 금지. 1개 금지. 3개 이상 금지.
- 제품 관련 질문 → 고객 요청에 맞는 2개 추천
- 일상 대화(인사 등) → 인기 제품 2개를 자연스럽게 소개
- 이미지 분석 → 이미지에 어울리는 2개 추천
- price_display는 숫자 가격만 (예: "15,000원"). 텍스트 금지.
- 사이즈 미지정 시 기본 사이즈로 추천. summary 마지막에 "원하시는 사이즈(가로×세로mm)를 알려주시면 정확한 가격을 안내해 드릴게요! 📐" 포함.
- 가격: is_custom_size면 (가로mm/1000)×(세로mm/1000)×price_per_sqm. 고정사이즈면 price 그대로.
- 사이트: ${siteUrl}`,

            ja: `カメレオンプリンティングAIアシスタント。温かく丁寧に対応。絵文字使用。3〜5文。

規則: products配列に必ず正確に2つの製品を入れる。0個禁止。1個禁止。3個以上禁止。
- 製品関連の質問 → お客様の要望に合う2つを推薦
- 日常会話（挨拶等）→ 人気製品2つを自然に紹介
- 画像分析 → 画像に合う2つを推薦
- price_displayは数字の価格のみ（例:「¥3,000」）。テキスト禁止。
- サイズ未指定時はデフォルトサイズで推薦。summaryの最後に「ご希望のサイズ（横×縦mm）を教えていただければ正確な価格をご案内します！📐」を含める。
- 価格: is_custom_sizeなら(横mm/1000)×(縦mm/1000)×price_per_sqm。固定サイズならpriceそのまま。
- サイト: ${siteUrl}`,

            us: `Chameleon Printing AI assistant. Warm and friendly. Use emojis. 3-5 sentences.

Rule: ALWAYS put exactly 2 products in the products array. 0 forbidden. 1 forbidden. 3+ forbidden.
- Product questions → recommend 2 relevant products
- Casual chat (greetings etc.) → naturally introduce 2 popular products
- Image analysis → recommend 2 products matching the image
- price_display must be numeric price only (e.g. "$30.00"). No text.
- If size not specified, use default sizes. Include at end of summary: "What size (width×height mm) would you like? I'll give you an exact price! 📐"
- Price: if is_custom_size, (width_mm/1000)×(height_mm/1000)×price_per_sqm. Fixed size: use price directly.
- Site: ${siteUrl}`,
        };

        const systemPrompt = `${langPrompts[clientLang === 'en' ? 'us' : clientLang] || langPrompts['kr']}

## 상품 데이터
${JSON.stringify(products.map(p => ({ code: p.code, name: p.name, category: p.category, size: p.width_mm + 'x' + p.height_mm + 'mm', is_custom_size: p.is_custom_size, price: p.price_display, price_per_sqm: p.price_per_sqm_display })))}

## 카테고리
${JSON.stringify(categories)}`;

        // Claude API — tool_choice: auto (대화 or 추천)
        const tools = [{
            name: "recommend_products",
            description: "ALWAYS return exactly 2 products. For product requests: recommend relevant items. For casual chat: recommend popular items. NEVER return 0 products.",
            input_schema: {
                type: "object" as const,
                properties: {
                    summary: { type: "string" as const, description: "Brief summary (customer's language)" },
                    products: {
                        type: "array" as const,
                        items: {
                            type: "object" as const,
                            properties: {
                                code: { type: "string" as const },
                                name: { type: "string" as const },
                                reason: { type: "string" as const },
                                recommended_width_mm: { type: "number" as const },
                                recommended_height_mm: { type: "number" as const },
                                price_display: { type: "string" as const },
                                design_title: { type: "string" as const },
                                design_keywords: { type: "array" as const, items: { type: "string" as const } }
                            },
                            required: ["code", "name", "reason", "recommended_width_mm", "recommended_height_mm", "price_display", "design_title"]
                        }
                    }
                },
                required: ["summary", "products"]
            }
        }];

        // 이미지 포함 시 multimodal content 구성
        function buildUserContent(text: string, img?: string, imgType?: string): any {
            if (!img) return text || "이 제품에 대해 알려주세요";
            const content: any[] = [
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: imgType || "image/jpeg",
                        data: img,
                    },
                },
            ];
            if (text) {
                content.push({ type: "text", text });
            } else {
                const defaultTexts: Record<string, string> = {
                    kr: "이 이미지를 분석해주세요. 관련 인쇄 제품이 있으면 추천해주세요.",
                    ja: "この画像を分析してください。関連する印刷製品があれば推薦してください。",
                    us: "Please analyze this image. If there are related printing products, please recommend them.",
                };
                content.push({ type: "text", text: defaultTexts[clientLang === 'en' ? 'us' : clientLang] || defaultTexts['kr'] });
            }
            return content;
        }

        // 항상 tool 강제 — 시스템 프롬프트에서 일상대화는 빈 products로 처리
        const toolChoice = { type: "tool" as const, name: "recommend_products" };
        console.log(`toolChoice=forced, msg="${(message||'').substring(0,30)}"`);

        async function callClaude(model: string, retries = 0): Promise<any> {
            console.log(`Calling Claude: model=${model}, retries=${retries}`);
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
                    tool_choice: toolChoice,
                    messages: [{ role: "user", content: buildUserContent(message, image, image_type) }],
                }),
            });

            if (res.status === 429) {
                if (retries < 2) {
                    await new Promise(r => setTimeout(r, 1500 * (retries + 1)));
                    return callClaude(model, retries + 1);
                }
                if (model !== "claude-haiku-4-5-20251001") {
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

            // tool_use 블록 처리 (항상 있어야 함 — tool_choice 강제)
            const toolBlock = data.content.find((b: any) => b.type === "tool_use");
            console.log(`Response: stop=${data.stop_reason}, blocks=${data.content.map((b:any)=>b.type).join(',')}, hasTool=${!!toolBlock}`);
            if (toolBlock) {
                const result = toolBlock.input;
                // chat_message 설정: summary를 기본으로 사용
                if (!result.chat_message) {
                    result.chat_message = result.summary || '';
                }
                // products가 비어있으면 일상대화 → chat 타입
                const hasProducts = result.products && result.products.length > 0;
                result.type = hasProducts ? "recommendation" : "chat";
                if (!hasProducts) result.products = [];
                result._model = model;
                return result;
            }

            // fallback: 텍스트만 있으면 대화
            const textParts = data.content.filter((b: any) => b.type === "text").map((b: any) => b.text);
            return {
                type: "chat",
                chat_message: textParts.join("\n") || "...",
                products: [],
                _model: model
            };
        }

        const result = await callClaude("claude-sonnet-4-20250514");
        result._v = "2026-03-02-v7-forced-tool";

        // 추천 제품에 raw price 보강 + 사이즈 질문 자동 추가
        if (result.products && result.products.length > 0) {
            result.products.forEach((rec: any) => {
                const dbProduct = products.find(p => p.code === rec.code);
                if (dbProduct) {
                    rec._raw_price_krw = dbProduct._raw_price;
                    rec._raw_per_sqm_krw = dbProduct._raw_per_sqm;
                    rec.is_custom_size = dbProduct.is_custom_size;
                }
            });

            // AI가 사이즈 질문을 빠뜨릴 수 있으므로 프로그래밍적으로 보장
            const sizeQs: Record<string, string> = {
                kr: "\n\n원하시는 사이즈(가로×세로mm)를 알려주시면 정확한 가격을 안내해 드릴게요! 📐",
                ja: "\n\nご希望のサイズ（横×縦mm）を教えていただければ正確な価格をご案内します！📐",
                us: "\n\nWhat size (width×height mm) would you like? I'll give you an exact price! 📐",
            };
            const sizeQ = sizeQs[clientLang === 'en' ? 'us' : clientLang] || sizeQs['kr'];
            const chatMsg = result.chat_message || result.summary || '';
            // 사이즈 관련 키워드가 이미 있으면 추가하지 않음
            const hasSizeQ = chatMsg.includes('사이즈') || chatMsg.includes('サイズ') || chatMsg.includes('size') || chatMsg.includes('Size');
            if (!hasSizeQ) {
                result.chat_message = chatMsg + sizeQ;
            }
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Product Advisor Error:", error);
        const errMsgs: Record<string, string> = {
            kr: "앗, 잠시 연결이 불안정해요 😅 다시 시도해주세요!",
            ja: "一時的にエラーが発生しました 😅 もう一度お試しください！",
            us: "Oops, something went wrong 😅 Please try again!",
        };
        let errLang = 'kr';
        try { errLang = (await req.json()).lang || 'kr'; } catch {}
        return new Response(
            JSON.stringify({ type: "chat", chat_message: errMsgs[errLang === 'en' ? 'us' : errLang] || errMsgs['kr'], products: [] }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
