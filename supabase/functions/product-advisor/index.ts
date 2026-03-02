// ============================================================
// 파일명: supabase/functions/product-advisor/index.ts
// AI 어드바이저 — 대화형 AI + 제품 추천 (tool_choice: forced)
//
// [배포] supabase functions deploy product-advisor
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED_ORIGINS = [
    'https://www.cafe2626.com', 'https://www.cafe0101.com', 'https://www.cafe3355.com',
    'https://cafe2626.com', 'https://cafe0101.com', 'https://cafe3355.com',
];

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('origin') || '';
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
}

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
    const cors = getCorsHeaders(req);

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }

    let reqBody: any = {};
    try {
        reqBody = await req.json();
        const { message, lang, image, image_type } = reqBody;
        const trimmedMsg = (message || '').trim();
        if (!trimmedMsg && !image) throw new Error("message or image is required");
        // 입력 크기 제한
        if (trimmedMsg.length > 2000) throw new Error("Message too long");
        if (image && image.length > 5 * 1024 * 1024) throw new Error("Image too large");

        // en→us 정규화 (한 번만)
        let clientLang = (lang || 'kr').toLowerCase();
        if (clientLang === 'en') clientLang = 'us';

        function convertPrice(krw: number): string {
            if (clientLang === 'ja') return '¥' + Math.round(krw * 0.1).toLocaleString('ja-JP');
            if (clientLang === 'us') return '$' + (krw * 0.002).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            return krw.toLocaleString('ko-KR') + '원';
        }

        // DB 조회
        const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const [prodRes, baseRes, catRes, qaRes] = await Promise.all([
            sb.from("admin_products")
                .select("code,name,price,width_mm,height_mm,is_custom_size,is_general_product,category,description")
                .order("sort_order", { ascending: true }).limit(120),
            sb.from("admin_products")
                .select("code,name,price,width_mm,height_mm,is_custom_size,category")
                .eq("width_mm", 1000).eq("height_mm", 1000).eq("is_custom_size", true),
            sb.from("admin_categories")
                .select("code,name,top_category_code,description")
                .order("sort_order", { ascending: true }),
            sb.from("advisor_qa_log")
                .select("customer_message,admin_answer,category")
                .eq("is_reviewed", true).eq("is_active", true)
                .order("reviewed_at", { ascending: false }).limit(30),
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
        const siteUrl = clientLang === 'ja' ? 'https://www.cafe0101.com' : clientLang === 'us' ? 'https://www.cafe3355.com' : 'https://www.cafe2626.com';

        // 시스템 프롬프트 — 친근한 대화형 AI
        const langPrompts: Record<string, string> = {
            kr: `카멜레온프린팅 AI 어시스턴트. 따뜻하고 친근하게 응대. 이모지 사용. 3~5문장.

⚠️ 연락처 규칙 (최중요): 절대로 전화번호, 이메일, 주소를 임의로 만들지 마. 아래 정보만 사용.
## 회사 정보
- 상호: (주)카멜레온프린팅
- 주소: 경기도 화성시 우정읍 한말길 72-2
- 영업시간: 평일 09:00~18:00 (점심 12:00~13:00, 주말/공휴일 휴무)
- 매니저: 지숙(010-3455-1946), 은미(010-7793-5393), 성희(010-3490-3328)
- AI 챗봇: 24시간 운영
- 배송: 전상품 무료배송 (허니콤보드 시공배송 제외)
- 결제: 카드결제, 무통장입금, 카카오페이, 네이버페이

규칙: products 배열에 항상 정확히 2개 제품을 넣어. 0개 금지. 1개 금지. 3개 이상 금지.
- 제품 관련 질문 → 고객 요청에 맞는 2개 추천
- 일상 대화(인사 등) → 인기 제품 2개를 자연스럽게 소개
- 이미지 분석 → 이미지에 어울리는 2개 추천
- 연락처/전화번호/영업시간/배송/결제 문의 → summary에 위 회사 정보를 직접 포함하여 답변. 전화번호를 그대로 summary에 넣어줘.
- price_display는 숫자 가격만 (예: "15,000원"). 텍스트 금지.
- 사이즈 미지정 시 기본 사이즈로 추천. summary 마지막에 "원하시는 사이즈(가로×세로mm)를 알려주시면 정확한 가격을 안내해 드릴게요! 📐" 포함.
- 가격: is_custom_size면 (가로mm/1000)×(세로mm/1000)×price_per_sqm. 고정사이즈면 price 그대로.
- 사이트: ${siteUrl}`,

            ja: `カメレオンプリンティングAIアシスタント。温かく丁寧に対応。絵文字使用。3〜5文。

⚠️ 連絡先規則（最重要）: 電話番号・メールアドレス・住所を絶対に作り上げないこと。以下の情報のみ使用。
## 会社情報
- 会社名: Chameleon Printing 株式会社
- 住所: 〒270-0023 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画
- 電話: 047-712-1148
- メール: support@cafe0101.com
- 営業時間: 平日 09:00〜18:00（土日祝休み）
- AI チャットボット: 24時間対応
- 配送: 全商品送料無料（ハニカムボード施工配送を除く）
- 決済: クレジットカード（Visa, Mastercard, JCB, AMEX）、銀行振込

⚠️ 言語規則（最重要）: summary、name、reason、全ての応答を必ず日本語で書くこと。韓国語の使用は絶対禁止。商品データの名前は韓国語だが、必ず日本語に翻訳して応答すること。
- 例: "허니콤배너" → "ハニカムバナー"、"포맥스" → "フォーメックス(PVC)"、"실사출력" → "大判プリント"、"패브릭" → "ファブリック"、"등신대" → "等身大パネル"、"아크릴인쇄" → "アクリルプリント"、"폼보드" → "フォームボード"、"천인쇄" → "布プリント"

規則: products配列に必ず正確に2つの製品を入れる。0個禁止。1個禁止。3個以上禁止。
- 製品関連の質問 → お客様の要望に合う2つを推薦
- 日常会話（挨拶等）→ 人気製品2つを自然に紹介
- 画像分析 → 画像に合う2つを推薦
- 連絡先・電話番号・営業時間・配送・決済の問い合わせ → summaryに上記の会社情報を直接含めて回答。電話番号をそのままsummaryに入れる。
- price_displayは数字の価格のみ（例:「¥3,000」）。テキスト禁止。
- nameは必ず日本語で書くこと（韓国語のままにしない）。
- サイズ未指定時はデフォルトサイズで推薦。summaryの最後に「ご希望のサイズ（横×縦mm）を教えていただければ正確な価格をご案内します！📐」を含める。
- 価格: is_custom_sizeなら(横mm/1000)×(縦mm/1000)×price_per_sqm。固定サイズならpriceそのまま。
- サイト: ${siteUrl}`,

            us: `Chameleon Printing AI assistant. Warm and friendly. Use emojis. 3-5 sentences.

⚠️ Contact info rule (CRITICAL): NEVER make up phone numbers, emails, or addresses. ONLY use the info below.
## Company Info
- Company: Chameleon Printing
- Website: ${siteUrl}
- Support: Use the chat widget on our website or email support@cafe0101.com
- Hours: Weekdays 09:00-18:00 KST (Korea Standard Time)
- AI Chatbot: Available 24/7
- Shipping: Free shipping on all products (except Honeycomb board installation delivery)
- Payment: Credit cards (Visa, Mastercard, JCB, AMEX)

⚠️ Language rule (CRITICAL): ALL responses including summary, name, reason MUST be in English. Product data names are in Korean — you MUST translate them to English.
- Examples: "허니콤배너" → "Honeycomb Banner", "포맥스" → "Foamex (PVC Board)", "실사출력" → "Large Format Print", "패브릭" → "Fabric Print", "등신대" → "Life-size Standee", "아크릴인쇄" → "Acrylic Print"

Rule: ALWAYS put exactly 2 products in the products array. 0 forbidden. 1 forbidden. 3+ forbidden.
- Product questions → recommend 2 relevant products
- Casual chat (greetings etc.) → naturally introduce 2 popular products
- Image analysis → recommend 2 products matching the image
- Contact/phone/hours/shipping/payment inquiries → include the company info directly in the summary text. Put actual contact details in the summary.
- price_display must be numeric price only (e.g. "$30.00"). No text.
- name MUST be in English (never leave Korean as-is).
- If size not specified, use default sizes. Include at end of summary: "What size (width×height mm) would you like? I'll give you an exact price! 📐"
- Price: if is_custom_size, (width_mm/1000)×(height_mm/1000)×price_per_sqm. Fixed size: use price directly.
- Site: ${siteUrl}`,
        };

        const dataLabels: Record<string, { products: string; categories: string; note: string }> = {
            kr: { products: '상품 데이터', categories: '카테고리', note: '' },
            ja: { products: '商品データ（名前は韓国語→日本語に翻訳して使用）', categories: 'カテゴリ', note: '\n注意: 下記の商品名は韓国語です。お客様への応答では必ず日本語に翻訳してください。' },
            us: { products: 'Product Data (names in Korean→translate to English)', categories: 'Categories', note: '\nNote: Product names below are in Korean. Always translate to English in your responses.' },
        };
        const labels = dataLabels[clientLang] || dataLabels['kr'];

        // Q&A 학습 데이터 구성
        const qaData = qaRes.data || [];
        let qaSection = '';
        if (qaData.length > 0) {
            const qaLabels: Record<string, { title: string; q: string; a: string }> = {
                kr: { title: '학습된 Q&A (이전 고객 질문과 관리자 답변 — 유사 질문에 활용)', q: '질문', a: '답변' },
                ja: { title: '学習済みQ&A（過去の質問と管理者回答 — 類似質問に活用）', q: '質問', a: '回答' },
                us: { title: 'Learned Q&A (past questions with admin answers — use for similar questions)', q: 'Q', a: 'A' },
            };
            const ql = qaLabels[clientLang] || qaLabels['kr'];
            qaSection = `\n\n## ${ql.title}\n` + qaData.map((q: any) =>
                `- ${ql.q}: ${q.customer_message}\n  ${ql.a}: ${q.admin_answer}` + (q.category !== 'general' ? ` [${q.category}]` : '')
            ).join('\n');
        }

        const systemPrompt = `${langPrompts[clientLang] || langPrompts['kr']}
${labels.note}
## ${labels.products}
${JSON.stringify(products.map(p => ({ code: p.code, name: p.name, category: p.category, size: p.width_mm + 'x' + p.height_mm + 'mm', is_custom_size: p.is_custom_size, price: p.price_display, price_per_sqm: p.price_per_sqm_display })))}

## ${labels.categories}
${JSON.stringify(categories)}${qaSection}`;

        // Claude API — tool_choice: auto (대화 or 추천)
        const tools = [{
            name: "recommend_products",
            description: "ALWAYS return exactly 2 products AND a summary. For contact/phone/hours inquiries: include actual company contact info (phone, email, address) in the summary field, AND also recommend 2 popular products. For product requests: recommend relevant items. For casual chat: recommend popular items. NEVER return 0 products.",
            input_schema: {
                type: "object" as const,
                properties: {
                    summary: { type: "string" as const, description: "Main response to the customer (in customer's language). For contact/phone/hours inquiries, MUST include actual company phone numbers and contact details here." },
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
            if (!img) {
                const fallback: Record<string, string> = {
                    kr: "이 제품에 대해 알려주세요",
                    ja: "この製品について教えてください",
                    us: "Tell me about this product",
                };
                return text || fallback[clientLang] || fallback['kr'];
            }
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
                content.push({ type: "text", text: defaultTexts[clientLang] || defaultTexts['kr'] });
            }
            return content;
        }

        // 항상 tool 강제 — 시스템 프롬프트에서 일상대화는 빈 products로 처리
        const toolChoice = { type: "tool" as const, name: "recommend_products" };
        console.log(`toolChoice=forced, msg="${trimmedMsg.substring(0,30)}"`);

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
                    messages: [{ role: "user", content: buildUserContent(trimmedMsg, image, image_type) }],
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
            const blocks = data.content || [];
            const toolBlock = blocks.find((b: any) => b.type === "tool_use");
            console.log(`Response: stop=${data.stop_reason}, blocks=${blocks.map((b:any)=>b.type).join(',')}, hasTool=${!!toolBlock}`);
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
            const textParts = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text);
            return {
                type: "chat",
                chat_message: textParts.join("\n") || "...",
                products: [],
                _model: model
            };
        }

        const result = await callClaude("claude-sonnet-4-20250514");
        result._v = "2026-03-03-v9-contact-info";

        // 연락처 관련 질문 감지 → AI가 빠뜨려도 프로그래밍적으로 보장
        const msgLower = trimmedMsg.toLowerCase();
        // Japanese chars via fromCharCode to avoid encoding issues on deploy
        const JP_DENWA = String.fromCharCode(0x96FB, 0x8A71);      // 電話
        const JP_RENRAKU = String.fromCharCode(0x9023, 0x7D61);    // 連絡
        const JP_TOIAWASE = String.fromCharCode(0x554F, 0x3044, 0x5408, 0x308F, 0x305B); // 問い合わせ
        const JP_MAIL = String.fromCharCode(0x30E1, 0x30FC, 0x30EB); // メール
        const isContactQuery = ['전화','연락처','번호','phone','call','contact','메일','email','이메일'].some(k => msgLower.includes(k))
            || [JP_DENWA, JP_RENRAKU, JP_TOIAWASE, JP_MAIL].some(k => trimmedMsg.includes(k));
        if (isContactQuery) {
            const chatMsg = result.chat_message || result.summary || '';
            const contactInfos: Record<string, string> = {
                kr: "\n\n📞 매니저 직통번호:\n• 지숙: 010-3455-1946\n• 은미: 010-7793-5393\n• 성희: 010-3490-3328\n🕐 영업시간: 평일 09:00~18:00 (점심 12:00~13:00)\n💬 AI 챗봇은 24시간 운영됩니다!",
                ja: "\n\n📞 お電話: 047-712-1148\n📧 メール: support@cafe0101.com\n🏢 住所: 〒270-0023 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画\n🕐 営業時間: 平日 09:00〜18:00（土日祝休み）\n💬 AIチャットボットは24時間対応しています！",
                us: "\n\n📧 Email: support@cafe0101.com\n🌐 Website: https://www.cafe3355.com\n🕐 Hours: Weekdays 09:00-18:00 KST\n💬 AI Chatbot available 24/7!",
            };
            const hasContact = chatMsg.includes('010-') || chatMsg.includes('047-') || chatMsg.includes('support@');
            if (!hasContact) {
                result.chat_message = chatMsg + (contactInfos[clientLang] || contactInfos['kr']);
            }
        }

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
            const sizeQ = sizeQs[clientLang] || sizeQs['kr'];
            const chatMsg = result.chat_message || result.summary || '';
            // 사이즈 관련 키워드가 이미 있으면 추가하지 않음
            const hasSizeQ = chatMsg.includes('사이즈') || chatMsg.includes('サイズ') || chatMsg.includes('size') || chatMsg.includes('Size');
            if (!hasSizeQ && !isContactQuery) {
                result.chat_message = chatMsg + sizeQ;
            }
        }

        // Q&A 로그 저장
        try {
            await sb.from("advisor_qa_log").insert({
                lang: clientLang,
                customer_message: trimmedMsg || '(image)',
                ai_response: result.chat_message || result.summary || '',
                products_recommended: result.products && result.products.length > 0
                    ? result.products.map((p: any) => ({ code: p.code, name: p.name }))
                    : null,
                has_image: !!image,
            });
        } catch (logErr: any) {
            console.error("QA log error:", logErr.message);
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...cors, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Product Advisor Error:", error);
        const errMsgs: Record<string, string> = {
            kr: "앗, 잠시 연결이 불안정해요 😅 다시 시도해주세요!",
            ja: "一時的にエラーが発生しました 😅 もう一度お試しください！",
            us: "Oops, something went wrong 😅 Please try again!",
        };
        let errKey = (reqBody?.lang || 'kr').toLowerCase();
        if (errKey === 'en') errKey = 'us';
        console.error("errKey:", errKey, "error:", (error as Error)?.message);
        return new Response(
            JSON.stringify({ type: "chat", chat_message: errMsgs[errKey] || errMsgs['kr'], products: [] }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }
});
