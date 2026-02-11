// ============================================================
// 파일명: supabase/functions/chatbot-ai/index.ts
// 위치: Supabase Edge Functions
//
// [배포 방법]
// 1. Supabase CLI 설치: npm install -g supabase
// 2. 프로젝트 연결: supabase login && supabase link --project-ref qinvtnhiidtmrzosyvys
// 3. 시크릿 등록: supabase secrets set ANTHROPIC_API_KEY=your-api-key-here
// 4. 배포: supabase functions deploy chatbot-ai
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

// ㎡당 단가 계산
// 핵심: 해당 상품의 기본사이즈가 1000x1000이면 price가 곧 ㎡당 단가
//       아니면, 같은 이름(단면/양면 포함)의 1000x1000 상품을 찾아서 사용
//       그것도 없으면 price / 면적으로 역산
function calcPricePerSqm(product: any, allProducts: any[] = []) {
    if (!product.is_custom_size) return null;
    if (!product.price || !product.width_mm || !product.height_mm) return null;
    
    // 1) 자기 자신이 1000x1000이면 바로 사용
    if (product.width_mm === 1000 && product.height_mm === 1000) {
        return product.price;
    }
    
    // 2) 같은 이름 계열에서 1000x1000 찾기 (단면/양면 구분 유지!)
    //    "양면 허니콤 가벽" → "양면", "허니콤", "가벽" 키워드로 매칭
    const nameWords = product.name.replace(/\[.*?\]/g, '').trim().split(/\s+/);
    const hasDanmyeon = nameWords.some((w: string) => w === '단면' || w.includes('단면'));
    const hasYangmyeon = nameWords.some((w: string) => w === '양면' || w.includes('양면'));
    
    const sqmProduct = allProducts.find((p: any) => {
        if (!p.is_custom_size || !p.price) return false;
        if (p.width_mm !== 1000 || p.height_mm !== 1000) return false;
        if (p.code === product.code) return false; // 자기 자신 제외
        
        const pName = p.name.replace(/\[.*?\]/g, '').trim();
        const pHasDan = pName.includes('단면');
        const pHasYang = pName.includes('양면');
        
        // 단면/양면 구분이 있으면 반드시 일치해야 함
        if (hasDanmyeon && !pHasDan) return false;
        if (hasYangmyeon && !pHasYang) return false;
        if (!hasDanmyeon && !hasYangmyeon && (pHasDan || pHasYang)) return false;
        
        // 상품명의 핵심 키워드가 포함되어야 함 (2글자 이상 단어)
        const coreWords = nameWords.filter((w: string) => w.length >= 2 && w !== '단면' && w !== '양면' && !w.startsWith('['));
        return coreWords.every((w: string) => pName.includes(w));
    });
    
    if (sqmProduct) {
        return sqmProduct.price;
    }
    
    // 3) fallback: 면적 역산
    const area = (product.width_mm / 1000) * (product.height_mm / 1000);
    if (area <= 0) return null;
    return Math.round(product.price / area);
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { message, history, lang } = await req.json();
        if (!message) throw new Error("message is required");
        const clientLang = (lang || 'kr').toLowerCase();

        // -- Supabase에서 상품/카테고리/옵션 정보 실시간 조회 --
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const msgLower = message.toLowerCase();
        
        // 동의어 사전: 고객 표현 → DB 상품명
        const synonymMap: Record<string, string[]> = {
            "허니콤": ["허니콤","허니컴","종이보드","친환경보드","벌집"],
            "폼보드": ["폼보드","폼","foam","스티로폼"],
            "포맥스": ["포맥스","포멕스","포맥","pvc보드","pvc"],
            "패브릭": ["패브릭","천","원단","fabric","백월","가림막"],
            "현수막": ["현수막","플랜카드","펼침막"],
            "배너": ["배너","banner","x배너","엑스배너","거치대"],
            "등신대": ["등신대","포토존","입간판","사람크기"],
            "종이매대": ["종이매대","매대","진열대","선반"],
            "실사출력": ["실사출력","실사","대형출력","출력"],
            "텐션": ["텐션","tension","텐션패브릭"],
            "연포장": ["연포장","포장지","포장"],
            "롤업": ["롤업","rollup","롤업배너"],
            "키링": ["키링","열쇠고리","keyring"],
            "메뉴판": ["메뉴판","메뉴","menu"],
            "보드류": ["보드류","보드","board"],
            "굿즈": ["굿즈","판촉물","기념품","goods"],
            "인테리어": ["인테리어","벽장식","액자","캔버스"],
            "후렉스": ["후렉스","플렉스","flex","후레쉬","플랙스","라텍스","latex","대형인쇄"],
            "광목": ["광목","광목천","면천","면직"],
            "타폴린": ["타폴린","타포린","방수천","방수"],
            "아크릴": ["아크릴","acrylic","투명판"],
            "스티커": ["스티커","시트지","라벨","sticker"],
            "종이": ["종이매대","종이","페이퍼"],
            "합판": ["합판","mdf","나무"],
        };
        // 두께 동의어
        const thickMap: Record<string,string> = {"3미리":"3T","3mm":"3T","5미리":"5T","5mm":"5T","10미리":"10T","10mm":"10T","1센치":"10T","8미리":"8T","8mm":"8T"};
        
        // 메시지에서 키워드 추출
        const searchTerms: string[] = [];
        for (const [canon, syns] of Object.entries(synonymMap)) {
            if (syns.some(s => msgLower.includes(s.toLowerCase()))) searchTerms.push(canon);
        }
        let thick = "";
        for (const [expr, mapped] of Object.entries(thickMap)) {
            if (msgLower.includes(expr.toLowerCase())) { thick = mapped; break; }
        }
        
        // 상품 쿼리 + 기준 상품(1000x1000) 별도 조회
        let prodQuery = sb.from("admin_products")
            .select("code,name,price,width_mm,height_mm,is_custom_size,is_general_product,category,description")
            .order("sort_order", { ascending: true });
        
        // 1000x1000 기준 상품도 함께 조회 (㎡당 단가 계산용)
        const baseQuery = sb.from("admin_products")
            .select("code,name,price,width_mm,height_mm,is_custom_size,category")
            .eq("width_mm", 1000).eq("height_mm", 1000).eq("is_custom_size", true);
        
        if (searchTerms.length > 0) {
            const filters = searchTerms.flatMap(k => [`name.ilike.%${k}%`, `category.ilike.%${k}%`]).join(",");
            prodQuery = prodQuery.or(filters).limit(80);
        } else {
            // 동의어에 없으면 메시지에서 2글자 이상 한글 단어 추출 → DB 직접 검색
            const words = message.match(/[가-힣]{2,}/g) || [];
            const stopWords = ["얼마","가격","사이즈","인쇄","주문","배송","문의","어떻게","있나요","할인","제품","상품","견적","단가","미리"];
            const searchWords = words.filter((w: string) => !stopWords.includes(w) && w.length >= 2).slice(0, 3);
            
            if (searchWords.length > 0) {
                const wordFilters = searchWords.flatMap((w: string) => [`name.ilike.%${w}%`, `category.ilike.%${w}%`]).join(",");
                prodQuery = prodQuery.or(wordFilters).limit(80);
            } else {
                prodQuery = prodQuery.limit(60);
            }
        }
        
        const [prodRes, baseRes, catRes, addonRes] = await Promise.all([
            prodQuery,
            baseQuery,
            sb.from("admin_categories")
                .select("code,name,top_category_code,description")
                .order("sort_order", { ascending: true }),
            sb.from("admin_addons")
                .select("code,name_kr,price_kr,category_code")
                .order("sort_order", { ascending: true }).limit(80),
        ]);
        
        // 상품별 ㎡당 단가 역산 + enriched 데이터 생성
        // 기준 상품(1000x1000) 포함한 전체 목록
        const baseProducts = baseRes.data || [];
        const rawProducts = prodRes.data || [];
        const allRawProducts = [...rawProducts];
        // 기준 상품이 rawProducts에 없으면 추가
        baseProducts.forEach((bp: any) => {
            if (!allRawProducts.find((p: any) => p.code === bp.code)) {
                allRawProducts.push(bp);
            }
        });
        let products = rawProducts.map((p: any) => {
            const perSqm = calcPricePerSqm(p, allRawProducts);
            // 통화 변환 적용된 가격
            const displayPrice = convertPrice(p.price || 0);
            const displayPerSqm = perSqm ? convertPrice(perSqm) : null;
            return {
                ...p,
                price: p.price,
                display_price: displayPrice,
                price_per_sqm: perSqm,
                display_price_per_sqm: displayPerSqm,
                pricing_note: p.is_custom_size
                    ? (perSqm
                        ? `면적기반: ㎡당 ${displayPerSqm} (기본 ${p.width_mm}x${p.height_mm}mm = ${displayPrice})`
                        : "면적기반: 단가 문의")
                    : `고정가: ${displayPrice}`
            };
        });
        
        // 두께 필터가 있으면 결과에서 추가 필터링
        if (thick && searchTerms.length > 0) {
            const filtered = products.filter((p: any) => p.name && p.name.includes(thick));
            if (filtered.length > 0) products = filtered;
        }
        
        // ── 사이즈 추출 → 서버에서 직접 가격 계산 ──
        let preCalculated = "";
        const sizeMatch = message.match(/(\d{2,5})\s*[x×X\-]\s*(\d{2,5})/);
        const qtyMatch = message.match(/(\d+)\s*(개|장|매|부|ea)/);
        if (sizeMatch) {
            let w = parseInt(sizeMatch[1]);
            let h = parseInt(sizeMatch[2]);
            // 작은 숫자면 mm가 아니라 cm일 수 있으니 보정
            if (w < 100) w *= 10;
            if (h < 100) h *= 10;
            const area = (w / 1000) * (h / 1000);
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            
            const calcResults: string[] = [];
            products.forEach((p: any) => {
                if (p.is_custom_size && p.price_per_sqm) {
                    let unitPrice = Math.round(area * p.price_per_sqm / 100) * 100;
                    const total = unitPrice * qty;
                    const dUnit = convertPrice(unitPrice);
                    const dTotal = convertPrice(total);
                    calcResults.push(`- ${p.name}: ${w}×${h}mm ${qty > 1 ? qty + '개 = ' + dTotal : '= ' + dUnit}${qty > 1 ? ' (개당 ' + dUnit + ')' : ''}`);
                } else if (!p.is_custom_size && p.price) {
                    const total = p.price * qty;
                    const dPrice = convertPrice(p.price);
                    const dTotal = convertPrice(total);
                    calcResults.push(`- ${p.name}: ${qty > 1 ? qty + '개 = ' + dTotal : dPrice} (고정가)`);
                }
            });
            
            if (calcResults.length > 0) {
                preCalculated = `\n\n## ⚡ 서버 자동 계산 결과 (${w}×${h}mm, ${qty}개)\n이 계산 결과를 그대로 고객에게 안내하세요! 직접 계산하지 마세요!\n${calcResults.join('\n')}`;
            }
        }

        // -- 시스템 프롬프트 (카멜레온프린팅 전문 상담원, 다국어 지원) --
        const langPrompts: Record<string, { intro: string; rules: string; shipping: string; discount: string; payment: string; manager: string; services: string; orderTracking: string }> = {
            kr: {
                intro: `당신은 "카멜레온프린팅"의 친절하고 전문적인 AI 상담원입니다.\n카멜레온프린팅은 대한민국 친환경 전시·팝업스토어 인쇄 전문 도매쇼핑몰입니다.\n웹사이트: https://www.cafe2626.com`,
                rules: `- 한국어로 답변. 친근하고 전문적인 톤.\n- 이모지를 적절히 사용.\n- 답변은 250자 이내로 간결하게 (필요하면 조금 더 가능).\n- 확실하지 않은 정보는 "매니저에게 확인 후 정확한 답변 드리겠습니다"라고 안내.\n- 복잡한 문의는 매니저 연결 안내.\n- 상품과 관련 없는 질문은 정중히 거절하고 "저는 카멜레온프린팅 상담 전문 봇이에요! 인쇄·전시 관련 문의를 도와드릴 수 있습니다 😊"라고 안내.`,
                shipping: `- 수도권: 1~2일(사업자 무료배송), 지방: 2~3일\n- 제작기간: 2~3영업일, 급행: 매니저 문의`,
                discount: `- 사업자 회원은 파트너스가 되실 수 있으며 10%할인 플러스 서울·경기 수도권 무료배송 무료설치 서비스가 지원됩니다.\n- Franchise: 10%, Platinum/Partner: 5%, Gold: 3%`,
                payment: `- 카드(토스페이먼츠), 무통장입금, 예치금, 마일리지(최대 5%)`,
                manager: `- 자세한 문의는 하단 '상담사 연결' 버튼을 눌러주세요.`,
                services: `허니콤보드(친환경 종이), 패브릭인쇄(백월/현수막/배너), 등신대/포토존, 폼보드/포맥스, 종이매대, 무료 온라인 에디터(직접 디자인+템플릿)`,
                orderTracking: `"홈페이지 상단 '🚚 주문배송조회' 버튼으로 확인하시거나 매니저에게 전화해주세요."`
            },
            ja: {
                intro: `あなたは「カメレオンプリンティング」の親切でプロフェッショナルなAI相談員です。\nカメレオンプリンティングは日本の広告・展示印刷卸売プラットフォームです。\nウェブサイト: https://www.cafe2626.com`,
                rules: `- 日本語で回答。丁寧でプロフェッショナルなトーン。\n- 絵文字を適切に使用。\n- 回答は250文字以内で簡潔に（必要に応じてもう少し可）。\n- 不確かな情報は「マネージャーに確認後、正確にご回答いたします」と案内。\n- 複雑なお問い合わせはマネージャー接続を案内。\n- 商品と関係のない質問は丁重にお断りし「私はカメレオンプリンティング専門の相談ボットです！印刷・展示関連のお問い合わせをお手伝いいたします 😊」と案内。`,
                shipping: `- 東京都内: 1〜2日（法人送料無料）、その他地域: 2〜3日\n- 製作期間: 2〜3営業日、急ぎ: マネージャーにお問い合わせ`,
                discount: `- 法人パートナーは10%オフ＋東京都内送料無料サービスが適用されます。\n- Franchise: 10%, Platinum/Partner: 5%, Gold: 3%`,
                payment: `- クレジットカード、銀行振込、デポジット、ポイント（最大5%）`,
                manager: `- 詳しいお問い合わせは下の「相談員に接続」ボタンを押してください。`,
                services: `ハニカムボード（エコ紙製）、ファブリック印刷（バックウォール/横断幕/バナー）、等身大パネル/フォトゾーン、フォームボード/PVC、紙製什器、無料オンラインエディター`,
                orderTracking: `「ホームページ上部の '🚚 注文配送照会' ボタンでご確認いただくか、マネージャーにお電話ください。」`
            },
            us: {
                intro: `You are a friendly and professional AI assistant for "Chameleon Printing".\nChameleon Printing is a wholesale printing platform specializing in eco-friendly displays, pop-up stores, and event printing.\nWebsite: https://www.cafe2626.com`,
                rules: `- Reply in English. Friendly and professional tone.\n- Use emojis appropriately.\n- Keep answers concise, under 250 characters (can be a bit more if needed).\n- If unsure, say "Let me have a manager confirm and get back to you with an accurate answer."\n- For complex inquiries, suggest connecting to a manager.\n- For off-topic questions, politely decline: "I'm the Chameleon Printing specialist bot! I can help with printing and display inquiries 😊"`,
                shipping: `- Las Vegas metro: 1-2 days (free business shipping), other areas: 2-3 days\n- Production: 2-3 business days, rush: contact manager`,
                discount: `- Business Partners get 10% off + free Las Vegas metro shipping.\n- Franchise: 10%, Platinum/Partner: 5%, Gold: 3%`,
                payment: `- Credit card, wire transfer, deposit balance, mileage points (up to 5%)`,
                manager: `- For detailed inquiries, click the 'Connect to Agent' button below.`,
                services: `Honeycomb boards (eco paper), fabric printing (backwalls/banners), life-size cutouts/photo zones, foam board/PVC, paper displays, free online design editor`,
                orderTracking: `"Check the '🚚 Order Tracking' button at the top of our website, or call your manager."`
            }
        };

        const lp = langPrompts[clientLang === 'en' ? 'us' : clientLang] || langPrompts['kr'];

        // 통화 변환 헬퍼 (1000원 = 200엔 = $2)
        function convertPrice(krw: number): string {
            if (clientLang === 'ja') {
                const jpy = Math.round(krw * 0.2);
                return '¥' + jpy.toLocaleString();
            } else if (clientLang === 'en' || clientLang === 'us') {
                const usd = krw * 0.002;
                return '$' + usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            }
            return krw.toLocaleString() + '원';
        }
        function currencyUnit(): string {
            if (clientLang === 'ja') return '円';
            if (clientLang === 'en' || clientLang === 'us') return 'USD';
            return '원';
        }

        const systemPrompt = `${lp.intro}

## 핵심 규칙 / Core Rules
${lp.rules}

## 상품명 동의어 (고객이 이렇게 물어볼 수 있음)
- "5미리", "5mm", "5밀리" → 5T 상품
- "3미리", "3mm", "3밀리" → 3T 상품
- "10미리", "10mm", "1센치" → 10T 상품
- "포멕스" → 포맥스
- "아크릴" → 포맥스/폼보드 안내
- "현수막" → 패브릭 백월, 현수막 카테고리
- 상품 목록에 있는 상품은 반드시 가격과 함께 안내하세요!

## 가격 안내 (⚠️ 매우 중요! / Pricing Rules)
- "서버 자동 계산 결과"가 있으면 그 금액을 **그대로** 안내하세요! 직접 계산하지 마세요!
- If "서버 자동 계산 결과" exists, use those prices AS-IS! Do not calculate yourself!
- 서버 계산이 없을 때만: (가로mm / 1000) × (세로mm / 1000) × 해당 상품의 price_per_sqm, 100원 단위 반올림
- 고정가 상품(is_general_product=true): DB 가격 그대로.
- ❌ 절대 계산 과정(공식, ㎡당 단가, 곱셈식)을 보여주지 마세요.
- ⚠️ 통화: display_price, display_price_per_sqm 필드가 이미 현지 통화(${currencyUnit()})로 변환되어 있습니다. 반드시 이 값을 사용하세요! 원화(₩, 원)로 표시하지 마세요!
- 환율 기준: 1,000원 = ¥200 = $2

## 회원 등급 할인 / Member Discounts
${lp.discount}

## 배송 / Shipping
${lp.shipping}

## 결제 / Payment
${lp.payment}

## 매니저 / Manager (09:00~18:00)
${lp.manager}

## 현재 등록 상품 (price_per_sqm = ㎡당 단가)
${JSON.stringify(products)}
${preCalculated}

## 카테고리
${JSON.stringify(catRes.data || [])}

## 추가옵션
${JSON.stringify(addonRes.data || [])}

## 주요 서비스 / Key Services
${lp.services}

## 주문 조회 안내 / Order Tracking
${lp.orderTracking}`;

        // -- 대화 히스토리 구성 (최근 8턴) --
        const messages = [];
        if (history && Array.isArray(history)) {
            history.slice(-8).forEach((h) => {
                messages.push({ role: h.role, content: h.content });
            });
        }
        messages.push({ role: "user", content: message });

        // -- Claude API 호출 (429 재시도 + Haiku fallback) --
        async function callClaude(model: string, retries = 0): Promise<string> {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 500,
                    system: systemPrompt,
                    messages,
                }),
            });
            
            if (res.status === 429) {
                // Rate limit: 1초 대기 후 재시도 (최대 2회), 그래도 실패시 Haiku로
                if (retries < 2) {
                    await new Promise(r => setTimeout(r, 1500 * (retries + 1)));
                    return callClaude(model, retries + 1);
                }
                if (model !== "claude-haiku-4-5-20251001") {
                    console.log("Sonnet 429 → Haiku fallback");
                    return callClaude("claude-haiku-4-5-20251001", 0);
                }
                throw new Error("API 요청 한도 초과");
            }
            
            if (!res.ok) {
                const errText = await res.text();
                console.error("Claude API Error:", res.status, errText);
                throw new Error("API 오류 " + res.status);
            }
            
            const data = await res.json();
            return data.content
                .map((b: any) => (b.type === "text" ? b.text : ""))
                .filter(Boolean)
                .join("\n");
        }
        
        const reply = await callClaude("claude-sonnet-4-20250514");

        return new Response(
            JSON.stringify({ reply }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Edge Function Error:", error);
        const { lang: errLang } = await req.json().catch(() => ({ lang: 'kr' }));
        const errLangKey = (errLang || 'kr').toLowerCase();
        const friendlyMsgs: Record<string, string> = {
            kr: "앗, 지금 잠깐 머리가 복잡해졌어요! 😅 잠시 후 다시 질문해주시거나, 하단 '상담사 연결' 버튼으로 매니저에게 문의해주세요!",
            ja: "申し訳ございません、一時的なエラーが発生しました！😅 しばらくしてから再度ご質問いただくか、下の「相談員に接続」ボタンでマネージャーにお問い合わせください！",
            us: "Oops, something went wrong! 😅 Please try again shortly, or click 'Connect to Agent' below to reach a manager!"
        };
        const friendlyMsg = friendlyMsgs[errLangKey === 'en' ? 'us' : errLangKey] || friendlyMsgs['kr'];
        return new Response(
            JSON.stringify({ reply: friendlyMsg }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});