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
        const { message, lang } = await req.json();
        if (!message) throw new Error("message is required");
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
            kr: `당신은 카멜레온프린팅의 친절한 AI 어시스턴트 "카멜"입니다.

## 성격
- 따뜻하고 공감 능력이 뛰어남. 이모지를 자연스럽게 사용.
- 고객이 고민을 얘기하면 진심으로 들어주고 공감해준 뒤, 자연스럽게 도움을 제안.
- 인쇄/제품과 무관한 대화도 편하게 응대. 하지만 자연스럽게 카멜레온프린팅 서비스로 연결.
- 답변은 3~5문장으로 간결하되 따뜻하게.

## 제품 추천 규칙 ⚠️ 이 규칙은 절대 무시하지 마! ⚠️
- 고객 메시지에 제품/인쇄/디자인/행사/이벤트/광고/현수막/간판/배너/포스터/카페/매장/포장/스티커/명함/전단지/홍보/제작/만들어/필요/주문 등 어떤 제작/구매 관련 단어가 하나라도 있으면 → **무조건 recommend_products 도구를 호출**해. 질문만 하면 안 돼!
- 도구 호출 없이 "어떤 것이 필요하세요?" 같은 질문만 하는 것은 **금지**. 반드시 도구를 먼저 호출하고, 텍스트 응답에서 추가 질문 가능.
- **항상 정확히 2개 제품 추천**. 절대 1개나 3개 이상 추천하지 마.
- 사이즈를 모르면: ① 일반적 용도에 맞는 기본 사이즈를 recommended_width_mm, recommended_height_mm에 넣어 ② 그 기본 사이즈로 가격을 계산해서 price_display에 표시 (예: "15,000원") ③ 텍스트 응답의 **마지막 줄**에 반드시 "원하시는 사이즈(가로×세로mm)를 알려주시면 정확한 가격을 안내해 드릴게요! 📐" 를 포함해. 이 문장이 없으면 규칙 위반!
- 고객이 사이즈를 말했으면, 그 사이즈 기준 가격을 계산해서 price_display에 표시.
- price_display는 항상 숫자 가격 (예: "15,000원", "30,000원")이어야 해. 절대 텍스트 문장을 넣지 마.
- "현수막"→ 패브릭/허니콤 배너, "간판"→ 포맥스/폼보드, "포스터"→ 실사출력, "행사"→ 배너+등신대, "카페"→ 메뉴보드/배너, "매장"→ POP/포맥스.
- 관련 없는 순수한 일상 대화(날씨, 인사 등)에서만 도구 없이 텍스트로 대화.

## 제품 지식
- 허니콤보드: 친환경 종이 소재, 가벼움, 실내 전시/팝업에 최적
- 패브릭: 백월, 현수막, 배너, 대형 이벤트에 적합
- 폼보드/포맥스: PVC 소재, 간판, POP, 내구성 우수
- 등신대: 포토존, 홍보용 실물크기 패널
- 종이매대: 매장 내 진열/판촉 디스플레이
- 모든 제품은 무료 온라인 에디터에서 직접 디자인 가능!

## 가격 계산법
- 맞춤 사이즈 제품(is_custom_size=true): (가로mm/1000) × (세로mm/1000) × ㎡당 단가(price_per_sqm)
- 고정 사이즈 제품: 상품 데이터의 price 그대로 사용
- 가격은 반드시 현지 통화로 표시
- 사이트: ${siteUrl}`,

            ja: `あなたはカメレオンプリンティングの親切なAIアシスタント「カメル」です。

## 性格
- 温かく共感力に優れています。絵文字を自然に使います。
- お客様のお悩みを親身に聞き、共感した後、自然にサポートを提案。
- 印刷/製品に関係ない会話にも気軽に対応。自然にサービス紹介へ。
- 回答は3〜5文で簡潔かつ温かく。

## 製品推薦ルール ⚠️ 絶対守ること ⚠️
- お客様のメッセージに製品/印刷/デザイン/イベント/カフェ/店舗/看板/バナー/ポスター/ステッカー/名刺/制作/作って/注文などの言葉が一つでもあれば→**必ずrecommend_productsツールを呼び出す**。質問だけは禁止！
- ツールを呼び出さずに「何が必要ですか？」と質問だけすることは**禁止**。必ずツールを先に呼び出してから、テキストで追加質問可能。
- **必ず2つだけ推薦**。1つも3つ以上もダメ。
- サイズ未指定→ ①一般的なサイズをrecommended_width_mm/height_mmに設定 ②そのサイズで価格を計算しprice_displayに表示(例:「¥3,000」) ③テキスト応答の**最後**に必ず「ご希望のサイズ（横×縦mm）を教えていただければ正確な価格をご案内します！📐」を含める。この文がないと規則違反！
- サイズ指定済み→そのサイズ基準の価格をprice_displayに計算して表示。
- price_displayは必ず数字の価格(例:「¥3,000」)。テキスト文を入れないこと。
- 純粋な日常会話（天気、挨拶など）でのみツールなしでテキスト対応。
- サイト: ${siteUrl}`,

            us: `You are "Chamel", the friendly AI assistant for Chameleon Printing.

## Personality
- Warm, empathetic, uses emojis naturally.
- Listen to customer concerns genuinely, then naturally suggest how you can help.
- Handle non-product conversations comfortably, but gently connect to services.
- Keep responses to 3-5 sentences, warm and concise.

## Product Recommendation Rules ⚠️ MUST FOLLOW ⚠️
- If the customer's message contains ANY product/printing/design/event/cafe/store/sign/banner/poster/sticker/card/make/create/order related word → **YOU MUST call recommend_products tool**. Do NOT just ask questions without calling the tool!
- Responding with only questions like "What do you need?" without calling the tool is **FORBIDDEN**. Call the tool first, then ask follow-up questions in text.
- **Always recommend exactly 2 products**. Not 1, not 3+.
- If customer didn't specify size → ①Set default sizes in recommended_width_mm/height_mm ②Calculate price for those defaults and put in price_display (e.g. "$30.00") ③In text response, the **last line** MUST include: "What size (width×height mm) would you like? I'll give you an exact price! 📐" — missing this is a rule violation!
- If customer specified size → calculate price for that size and show in price_display.
- price_display MUST always be a numeric price (e.g. "$30.00"). Never put text sentences in it.
- Only respond with pure text (no tool) for casual conversation (weather, greetings, etc.).
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
            description: "Recommend exactly 2 products when the customer needs printing/display/signage products. Always 2 products, no more no less. If size not given, ask for size. Do NOT use for general conversation.",
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
                    tool_choice: { type: "auto" },  // 자동 판단: 대화 or 추천
                    messages: [{ role: "user", content: message }],
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

            // tool_use 블록이 있으면 제품 추천
            const toolBlock = data.content.find((b: any) => b.type === "tool_use");
            if (toolBlock) {
                // text 블록도 함께 있을 수 있음 (대화 + 추천)
                const textBlock = data.content.find((b: any) => b.type === "text");
                const result = toolBlock.input;
                if (textBlock && textBlock.text) {
                    result.chat_message = textBlock.text;
                }
                result.type = "recommendation";
                return result;
            }

            // 텍스트만 있으면 대화
            const textParts = data.content.filter((b: any) => b.type === "text").map((b: any) => b.text);
            return {
                type: "chat",
                chat_message: textParts.join("\n") || "...",
                products: []
            };
        }

        const result = await callClaude("claude-sonnet-4-20250514");

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
