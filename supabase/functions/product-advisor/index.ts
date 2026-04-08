// ============================================================
// 파일명: supabase/functions/product-advisor/index.ts
// 카푸 AI 쇼핑 어시스턴트 — 대화형 AI + 스마트 제품 추천
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
    'https://chameleon.design', 'https://www.chameleon.design',
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
        const { message, lang, image, image_type, conversation_history, session_id, room_id: clientRoomId, customer_name: clientCustName, customer_phone: clientCustPhone } = reqBody;
        const trimmedMsg = (message || '').trim();
        if (!trimmedMsg && !image) throw new Error("message or image is required");
        if (trimmedMsg.length > 2000) throw new Error("Message too long");
        if (image && image.length > 10 * 1024 * 1024) throw new Error("Image too large (max 10MB)");

        let clientLang = (lang || 'kr').toLowerCase();
        if (clientLang === 'en') clientLang = 'us';

        const CURRENCY_RATES: Record<string, number> = { kr: 1, ja: 0.1, us: 0.001, zh: 0.05, ar: 0.001, es: 0.001, de: 0.001, fr: 0.001 };
        function convertPrice(krw: number): string {
            const rate = CURRENCY_RATES[clientLang] || 1;
            if (clientLang === 'ja') return '\u00a5' + Math.round(krw * rate).toLocaleString('ja-JP');
            if (['us','ar'].includes(clientLang)) return '$' + (krw * rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            if (['es','de','fr'].includes(clientLang)) return '\u20ac' + (krw * rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            if (clientLang === 'zh') return '\u00a5' + Math.round(krw * rate).toLocaleString('zh-CN');
            return krw.toLocaleString('ko-KR') + '\uc6d0';
        }

        // DB 조회
        const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const [prodRes, baseRes, catRes, qaRes, addonRes, addonCatRes] = await Promise.all([
            sb.from("admin_products")
                .select("code,name,name_jp,name_us,price,price_jp,price_us,width_mm,height_mm,is_custom_size,is_general_product,is_file_upload,is_bulk_order,quantity_options,category,description,img_url,addons")
                .not("code", "like", "ua_%")
                .order("sort_order", { ascending: true }).limit(500),
            sb.from("admin_products")
                .select("code,name,price,width_mm,height_mm,is_custom_size,category")
                .eq("width_mm", 1000).eq("height_mm", 1000).eq("is_custom_size", true),
            sb.from("admin_categories")
                .select("code,name,top_category_code,description")
                .order("sort_order", { ascending: true }),
            sb.from("advisor_qa_log")
                .select("customer_message,admin_answer,category,lang")
                .eq("is_reviewed", true).eq("is_active", true)
                .order("reviewed_at", { ascending: false }).limit(100),
            sb.from("admin_addons")
                .select("code,name,name_jp,name_us,category_code,price,price_jp,price_us"),
            sb.from("addon_categories")
                .select("code,name_kr,name_jp,name_us"),
        ]);

        const baseProducts = baseRes.data || [];
        const rawProducts = prodRes.data || [];
        const allRaw = [...rawProducts];
        baseProducts.forEach((bp: any) => {
            if (!allRaw.find((p: any) => p.code === bp.code)) allRaw.push(bp);
        });

        // 카테고리별 대표 사이즈 예시 (mm → m² 계산용)
        const SMALL_CATS = ['acr_key_ring','acr_crtt','acr_smt_tck','acr_etc']; // 작은 굿즈
        const WALL_CATS = ['hb_display_wall']; // 가벽
        const GATE_CATS = ['hb_tree']; // 입구 게이트
        const TABLE_CATS = ['hb_table']; // 가구/테이블
        function examplePriceDisplay(p: any, perSqm: number | null): string {
            if (!p.is_custom_size || !perSqm) return convertPrice(p.price || 0);
            const cat = p.category || '';
            // 작은 굿즈 (키링, 코롯토 등) → 5×5cm 예시
            if (SMALL_CATS.includes(cat)) {
                const area = 0.05 * 0.05; // 5cm × 5cm
                const ex = Math.round(perSqm * area / 100) * 100;
                const labels: Record<string, string> = {
                    kr: '5×5cm 약 ' + convertPrice(Math.max(ex, 500)),
                    ja: '5×5cm 約 ' + convertPrice(Math.max(ex, 500)),
                    us: '~' + convertPrice(Math.max(ex, 500)) + ' for 5×5cm',
                };
                return labels[clientLang] || labels['kr'];
            }
            // 가벽 → 1칸(1000×2400mm) 예시
            if (WALL_CATS.includes(cat)) {
                const area = 1.0 * 2.4;
                const ex = Math.round(perSqm * area / 1000) * 1000;
                const labels: Record<string, string> = {
                    kr: '1칸(1000×2400) 약 ' + convertPrice(ex),
                    ja: '1枚(1000×2400) 約 ' + convertPrice(ex),
                    us: '~' + convertPrice(ex) + ' per panel (1000×2400mm)',
                };
                return labels[clientLang] || labels['kr'];
            }
            // 게이트, 가구 → 원래 가격 그대로 (고정 상품 많음)
            if (GATE_CATS.includes(cat) || TABLE_CATS.includes(cat)) {
                return convertPrice(p.price || 0);
            }
            // 기타 커스텀 (포맥스, 허니콤인쇄, 아크릴, 현수막 등) → A4 예시
            const a4Area = 0.21 * 0.297; // A4
            const a4Ex = Math.round(perSqm * a4Area / 100) * 100;
            const defLabels: Record<string, string> = {
                kr: 'A4 약 ' + convertPrice(Math.max(a4Ex, 500)),
                ja: 'A4 約 ' + convertPrice(Math.max(a4Ex, 500)),
                us: '~' + convertPrice(Math.max(a4Ex, 500)) + ' for A4 size',
            };
            return defLabels[clientLang] || defLabels['us'];
        }

        // 국가별 실제 가격 사용 (price_us, price_jp가 있으면 환율 변환 대신 직접 사용)
        function getLocalPrice(p: any): number {
            if (clientLang === 'ja' && p.price_jp) return p.price_jp;
            if (clientLang !== 'kr' && p.price_us) return p.price_us;
            return p.price || 0;
        }
        function formatLocalPrice(amount: number): string {
            if (clientLang === 'ja') return '\u00a5' + Math.round(amount).toLocaleString('ja-JP');
            if (['us','ar'].includes(clientLang)) return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            if (['es','de','fr'].includes(clientLang)) return '\u20ac' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            if (clientLang === 'zh') return '\u00a5' + Math.round(amount).toLocaleString('zh-CN');
            return Math.round(amount).toLocaleString('ko-KR') + '\uc6d0';
        }
        function getLocalPerSqm(p: any, perSqmKrw: number | null): number | null {
            if (!perSqmKrw) return null;
            if (clientLang === 'ja' && p.price_jp && p.price) return Math.round(perSqmKrw * (p.price_jp / p.price));
            if (clientLang !== 'kr' && p.price_us && p.price) return Math.round(perSqmKrw * (p.price_us / p.price));
            return perSqmKrw;
        }

        const products = rawProducts.map((p: any) => {
            const perSqmKrw = calcPricePerSqm(p, allRaw);
            const localPrice = getLocalPrice(p);
            const localPerSqm = getLocalPerSqm(p, perSqmKrw);
            const displayName = clientLang === 'ja' ? (p.name_jp || p.name_us || p.name) : clientLang === 'kr' ? p.name : (p.name_us || p.name);

            let priceDisplay: string;
            if (p.is_custom_size && localPerSqm) {
                priceDisplay = examplePriceDisplay(p, perSqmKrw);
                // 국가별 가격이 있으면 직접 계산으로 덮어쓰기
                if ((clientLang === 'us' && p.price_us) || (clientLang === 'ja' && p.price_jp)) {
                    // A4 예시 기준 재계산
                    const a4Area = 0.21 * 0.297;
                    const a4Price = Math.round(localPerSqm * a4Area);
                    const labels: Record<string, string> = {
                        ja: 'A4 約 ' + formatLocalPrice(Math.max(a4Price, 50)),
                        us: '~' + formatLocalPrice(Math.max(a4Price, 1)) + ' for A4 size',
                    };
                    priceDisplay = labels[clientLang] || priceDisplay;
                }
            } else {
                priceDisplay = (clientLang !== 'kr' && (p.price_us || p.price_jp)) ? formatLocalPrice(localPrice) : convertPrice(p.price || 0);
            }

            return {
                code: p.code, name: displayName, _name_kr: p.name, category: p.category, description: p.description,
                img_url: p.img_url,
                width_mm: p.width_mm, height_mm: p.height_mm, is_custom_size: p.is_custom_size,
                is_general_product: p.is_general_product, is_file_upload: p.is_file_upload,
                is_bulk_order: p.is_bulk_order, quantity_options: p.quantity_options,
                price_display: priceDisplay,
                price_per_sqm_display: localPerSqm ? formatLocalPrice(localPerSqm) : (perSqmKrw ? convertPrice(perSqmKrw) : null),
                _raw_price: p.price || 0, _raw_per_sqm: perSqmKrw,
                addons: p.addons,
            };
        });

        const categories = catRes.data || [];
        // AI 콜에서 제외할 대분류 (상품 많지만 거의 안 팔림 → 토큰 낭비)
        const _skipTopCats = new Set(['99999', '23434242', 'user_artwork', '88888']);
        const _skipSubCats = new Set<string>();
        const _skipProductCodes = new Set(['21355677']); // 천원단위 주문 등 추천 제외
        categories.forEach((c: any) => {
            if (_skipTopCats.has(c.top_category_code) || _skipTopCats.has(c.code)) _skipSubCats.add(c.code);
        });
        const aiProducts = products.filter((p: any) => !_skipSubCats.has(p.category) && !_skipProductCodes.has(p.code));
        const siteUrlMap: Record<string, string> = { ja: 'https://www.cafe0101.com', us: 'https://www.cafe3355.com', kr: 'https://www.cafe2626.com' };
        const siteUrl = siteUrlMap[clientLang] || 'https://www.chameleon.design';
        const langSuffix = siteUrlMap[clientLang] ? '' : '&lang=' + clientLang;

        // Addon 데이터 정리
        const allAddons = addonRes.data || [];
        const addonCats = addonCatRes.data || [];
        const addonCatMap: Record<string, string> = {};
        addonCats.forEach((c: any) => {
            addonCatMap[c.code] = clientLang === 'ja' ? (c.name_jp || c.name_kr) : clientLang === 'us' ? (c.name_us || c.name_kr) : c.name_kr;
        });
        const addonMap: Record<string, any> = {};
        allAddons.forEach((a: any) => {
            const name = clientLang === 'ja' ? (a.name_jp || a.name) : clientLang === 'us' ? (a.name_us || a.name) : a.name;
            const price = clientLang === 'ja' ? (a.price_jp || Math.round(a.price * 0.1)) : clientLang === 'us' ? (a.price_us || Math.round(a.price * 0.001)) : a.price;
            addonMap[a.code] = { code: a.code, name, category: addonCatMap[a.category_code] || '', price: convertPrice(price) };
        });

        // 시스템 프롬프트 — 카푸 AI 쇼핑 어시스턴트
        const langPrompts: Record<string, string> = {
            kr: `너는 카멜레온프린팅 상담사 "카푸"야. 진짜 사람처럼 자연스럽고 편하게 말해. 반말/존댓말은 고객에 맞춰서 유연하게. 이모지는 가끔만(1~2개), 과하게 쓰지 마. 3~5문장으로 답변.

## 말투 규칙 (중요!)
- **절대 "AI", "인공지능", "어시스턴트", "챗봇"이라는 단어를 쓰지 마.** 너는 카푸라는 이름의 상담사야.
- 자기소개 할 때: "안녕하세요~ 카멜레온프린팅 카푸입니다!" 이런 식으로. AI라고 밝히지 마.
- "~해 드리겠습니다", "~입니다" 같은 딱딱한 경어 대신 "~해 드릴게요", "~이에요", "~거든요" 같이 부드럽게.
- 기계적인 나열("첫째, 둘째, 셋째") 대신 자연스러운 흐름으로 설명해.
- "궁금한 점이 있으시면 언제든 물어봐 주세요!" 같은 로봇 멘트 금지. 대신 "더 궁금한 거 있으면 편하게 말씀해 주세요~" 처럼.
- 이미지를 올려주시면 분석해서 견적도 내어드릴 수 있다고 자연스럽게 안내.
- 예시: "친구들 생일파티 하는데 예산 얼마야, 뭘 해야 할지 추천해줘~ 이런 식으로 편하게 물어봐 주시면 예산에 맞춘 멋진 이벤트 준비해 드릴게요!"

## 상품명 동의어 (고객이 이렇게 물어볼 수 있음)
- "리보드", "re-board", "reboard", "RE board" → 허니콤보드와 같은 제품! 해외에서 허니콤보드를 부르는 이름이야. 리보드 = 허니콤보드로 인식하고 허니콤보드 제품을 추천해줘.
- "포멕스" → 포맥스
- "후렉스", "플렉스" → 후렉스/라텍스 출력

## 가격/견적 규칙 (최우선!)
- ⚠️ 가격, 얼마, 비용 등을 물어보면 **직접 계산하지 말고 제품 상세페이지 링크를 안내해!**
- "아래 제품 링크에서 원하시는 사이즈와 수량만 입력하시면 할인이 적용된 정확한 견적이 바로 나와요!" 라고 안내해.
- 수량 할인 안내: "1개보다 3개, 더 많이 주문할수록 최대 50%까지 할인돼요! PRO 구독까지 하시면 거기서 10% 추가 할인까지!"
- 제품 카드(products 배열)를 반드시 함께 보여줘서 고객이 바로 클릭할 수 있게 해.
- ❌ 절대 계산 과정(공식, ㎡당 단가, 곱셈식)을 보여주지 마.

## 견적서 자동 생성 흐름 (매우 중요!)
- 고객이 제품에 대해 질문하면 이 흐름을 따라:
  1단계: 간단한 제품 설명 + 옵션 안내 (단면/양면, 사각커팅/모양커팅 등)
  2단계: 빠진 정보가 있으면 물어봐 (단면/양면, 사각/모양커팅 등)
  3단계: 정보가 충분하면 → 견적서 만들기 전에 **주문 내용을 확인**해!
    예시: "주문 내용을 정리해볼게요:\n- 허니콤 가벽 단면: 3000×2200mm × 1개\n- 허니콤배너: 600×1800mm × 2개 (사각커팅)\n맞으시면 견적서를 만들어드릴게요!"
  4단계: 고객이 "맞아", "네", "좋아", "ㅇㅇ", "OK" 등 확인하면 → generate_quote 도구로 견적서 생성!
  5단계: 견적서 + 결제 버튼 아래에 안내:
    "견적서와 결제 링크를 드렸습니다. 견적 확인하시고 구매링크 들어가시면 장바구니에 제품이 담겨있어요. 파일은 장바구니에서 올리실 수 있습니다. 에디터로 직접 디자인하시려면 아래 제품 링크를 클릭해서 수동으로 주문해 주세요."
  6단계: 견적서와 함께 해당 제품 카드(products 배열)도 반드시 보여줘!

- ★ 고객 메시지를 꼼꼼히 읽어! 여러 제품을 한번에 말할 수 있어:
  예) "가벽 3미터 2.2미터 1개, 배너 2개, 300×300 인쇄 모양커팅" → 3개 제품!
  - "가벽 3미터 높이 2.2미터" = 가벽 3000×2200mm (가로×세로)
  - "배너 2개" = 배너 600×1800mm (기본사이즈) × 2개
  - "300×300 인쇄 모양커팅" = 허니콤 인쇄커팅 300×300mm (별도 제품!)
- ★ 숫자를 정확히 파싱해! "3미터" = 3000mm, "2.2미터" = 2200mm, "300" = 300mm
- ★ "1개", "2개" 등 수량을 정확히 읽어! 숫자가 없으면 1개로 간주.
- 가격은 넣지 마 (서버에서 자동 계산함). code, name, width_mm, height_mm, quantity, note만 넣어.
- 가벽은 side: 1(단면) 또는 2(양면) 구분해서 넣어.
- ⚠️ items 배열을 절대 비우지 마! 대화에서 언급된 제품 정보를 반드시 items에 넣어!
- ★ 허니콤보드 제품은 최소 금액 10,000원이 적용됨 (서버에서 자동 처리)
- ★ 최소 주문금액은 10,000원. 제품 금액이 10,000원 미만이면 자동으로 10,000원이 적용돼 (서버에서 처리). 차단하지 말고 그냥 견적서를 만들어줘.
- ★ 허니콤보드 제품은 모양커팅(+3,000원) 또는 사각커팅(+1,000원)이 필수! 고객에게 반드시 물어봐! note에 "모양" 또는 "사각"을 적어줘.
- 제품 코드:
  · 허니콤 인쇄커팅 단면: code="hb_pt_1", 양면: code="hb_pt_2"
  · 가벽: code="hb_dw_1", width_mm/height_mm은 mm 단위 (3m = 3000mm)
  · 허니콤배너: code="hb_bn_1" (연결형: hb_bn_2, 양면: hb_bn_3)
  · 사이즈가 없으면 기본값 사용 (가벽: 1000x2200, 배너: 600x1800)
- 디자인 비용, 부가 서비스 비용 등 상품 데이터에 없는 비용을 임의로 만들어내지 마.

## 핵심 원칙
1. **대화를 먼저 해** — 고객이 인사하거나 일상 대화를 하면 자연스럽게 대화해. 무조건 제품을 추천하지 마.
2. **제품 추천은 필요할 때만** — 고객이 구매 의사를 보이거나 제품을 찾을 때만 추천해. 연락처/인사/잡담에는 products를 비워둬(빈 배열).
3. **이전 대화를 기억해** — conversation_history가 있으면 맥락을 이해하고 이전 대화를 바탕으로 답변해.
4. **추천 개수는 자유** — 1개면 1개, 3개면 3개, 5개면 5개. 상황에 맞게. 최대 5개까지.
5. **제품 설명과 옵션을 활용해** — 각 제품의 description과 특성(is_custom_size, is_file_upload 등)을 확인하고 정확히 안내해.
6. **⚠️ 제품 링크(카드)는 오직 2가지 경우에만! products 배열을 채워:**
   ① 견적서를 생성할 때 (generate_quote 도구 사용 시)
   ② 고객이 링크를 원할 때: "링크 줘", "URL", "보여줘", "어디서 사?", "어디서 살 수 있어?", "사는곳", "구매하는곳", "주문하는곳", "살수있는곳", "파는곳", "구매링크", "주문링크", "where to buy", "how to order", "どこで買える", "購入ページ"
   ❌ 그 외 모든 경우에는 products를 반드시 빈 배열[]로!
   ❌ 제품 안내/설명 → products 빈 배열!
   ❌ 옵션 질문(단면/양면? 사각/모양? 원단 종류?) → products 빈 배열!
   ❌ 주문 내용 확인(정리해볼게요) → products 빈 배열!
   ❌ "~있어?", "~안내해줘", "얼마야?" → products 빈 배열! 텍스트로만 설명!
7. **매칭되는 상품이 없으면**: "아쉽게도 그 제품은 지금 취급하고 있지 않아요" + 비슷한 대체 상품 추천

## 패브릭 인쇄 안내 흐름 (중요!)
- 고객이 패브릭/천/원단 인쇄를 물어보면 이 순서로 안내:
  1단계: 원단 종류 안내 + 선택 요청
    · **광목** - 가장 많이 사용. 질감 좋고 가격 합리적 (20수 백아이보리: cb20001, 네츄럴: 2343243, 30수: cb30001, 16수: ns16001)
    · **캔버스** - 두껍고 고급스러운 느낌 (10수 화이트: cs10001)
    · **쉬폰** - 반투명, 부드러운 소재. 커튼/파티션에 적합
    · **린넨** - 마 원단 같은 자연스러운 느낌
    · **옥스포드** - 두꺼운 면직물
  2단계: 마감(미싱) 방식 안내 + 선택 요청
    · **가재단**(txl0001, +2,000원) - 기본 재단만 (마감 없음)
    · **오버록**(txl0002, +3,000원) - 가장자리 풀림 방지 마감
    · **인터록**(txl0003, +5,000원) - 깔끔한 접어박기 마감
    · **말아박기**(txl0004, +5,000원) - 가장자리를 말아서 깔끔하게
    · **이어박기**(txl0005, +10,000원) - 여러 폭을 이어서 큰 사이즈 제작
    · **봉커튼마감**(3254352, +20,000원) - 상단에 봉 넣을 수 있는 주머니
  3단계: 고리/걸이 방식 안내 + 선택 요청 (필요한 경우)
    · **상단끈고리**(45783, +2,000원) - 끈으로 된 고리
    · **멜빵고리**(45722, +8,000원) - 멜빵 형태 고리
    · **상단봉마감**(45787, +2,000원) - 봉을 끼울 수 있는 마감 (봉 별매)
    · **집게링**(45646456, +1,000원) - 클립형 링
    · **목봉**(3453453, 10cm당 +1,000원) - 나무봉
    · **텐션봉**(355353, +5,000원) - 스프링 봉
    · 고리 없음도 가능
  4단계: 정보가 모이면 주문 내용 확인 → 견적서 생성
- 패브릭 견적서 items에 원단 제품 + 마감 옵션(is_addon:true) + 고리 옵션(is_addon:true)을 각각 넣어.
7. **배너 안내 규칙**:
   - ★ 고객이 가벽/허니콤보드와 함께 "배너"를 언급하면 → **허니콤보드 배너**(hb_bn_1)로 안내! 실내/실외를 묻지 마!
   - 허니콤보드 배너는 커팅 옵션 없음! 사이즈만 물어보면 됨. 기본 600×1800mm.
   - 제품코드: hb_bn_1(허니콤배너 단면), hb_bn_2(연결형), hb_bn_3(양면)
   - ★ 택배 가능! 서울/경기 무료배송, 지방 3만원(묶음배송)
   - 고객이 **별도로** "야외용", "실외용", "옥외" 등을 명시적으로 말할 때만 야외용 제품 안내:
     · 패트배너: 752002, 752004 / 현수막: 44578, 34453453 / 매쉬: 752007
8. **허니콤보드 견적 흐름 (매우 중요!)**:
   - 고객이 가벽, 배너, 인쇄커팅 등을 말하면 → 전부 허니콤보드 제품
   - ★ **가벽**: 단면 기준으로 바로 견적! 커팅 옵션 없음(가벽은 원래 사각형)
     · 견적 후 안내: "혹시 양면, 코너기둥, 보조받침대 등 다른 옵션이 필요하시면 말씀해 주세요."
     · **코너기둥**: ㄱ자, ㄷ자 형태로 가벽을 연결해서 넓은 공간을 만들 때 필요
     · **보조받침대**: 아이들이 많거나 야외 바람 부는 곳에서는 필수
   - ★ **배너**: 단면 기준. 사이즈와 수량만 확인. 커팅 옵션 없음.
   - ★ **사각/모양커팅이 필요한 제품**: 자유인쇄커팅(hb_pt_1/hb_pt_2), 등신대, 포맥스인쇄, 폼보드 등만! 가벽/배너에는 커팅 묻지 마!
   - ★ **지방 배송 질문 (중요!)**: 허니콤보드 주문 시 반드시 물어봐:
     "서울/경기 지역이시면 무료배송+무료설치입니다. 지방이시면 배송비 20만원이 추가되고, 설치도 필요하시면 설치비 50만원(1인)이 별도입니다. 어느 지역이세요?"
     · 서울/경기 → 무료 (견적에 배송비 없음)
     · 지방 배송만 → +200,000원
     · 지방 배송+설치 → +200,000원(배송) + 500,000원(설치) = +700,000원
     · 배송비가 있으면 견적서에 shipping_fee로 포함!
   - ★ 사이즈 + 수량 + 지역이 나오면 **바로 견적서 생성**!
9. **이미지/PDF 업로드** — 10MB까지 첨부 가능. 그보다 큰 파일은 제품 주문 시 업로드하거나 이메일 design@chameleon.design으로 보내라고 안내.
10. **패브릭 인쇄/포스터 추천 규칙 (중요!)**:
     - "패브릭포스터", "패브릭 포스터", "천 포스터", "원단 포스터", "fabric poster" → 제품코드 IP_1 (패브릭 포스터)
     - "패브릭 인쇄", "천 인쇄", "원단 인쇄", "광목 인쇄" → 제품코드: cb20001(광목20수 백아이보리), cs10001(캔버스10수 화이트), 2343243(광목20수 네츄럴), 54228_copy(광목인쇄 핫딜)
     - "캔버스액자", "액자" → 제품코드: 2342343422 (캔버스액자)
     - 패브릭 관련 질문에는 반드시 위 제품코드를 products 배열에 넣어서 카드로 보여줘!
     - ❌ 고객작품(ua_ 로 시작하는 코드)을 추천하지 마! 인쇄 서비스 제품만 추천해.
11. **허니콤보드 전시/부스/공간 이미지 분석** — 고객이 전시/부스/공간 연출 관련 이미지를 올리면:
   - 이미지를 꼼꼼히 분석해서 **카멜레온이 작업 가능한 영역과 불가능한 영역을 구분**해줘.
     · 카멜레온 작업 가능: 허니콤(리보드) 가벽, 등신대, 간판, 테이블 상판, 패브릭 인쇄물 등
     · 카멜레온 작업 불가: 목공 구조물, 철재 구조물, 전기/조명 시설, 바닥 시공 등
   - **공간 맥락을 분석**해서 단면/양면을 추천해줘:
     · 뒤쪽이 벽이면 → 단면 추천
     · 뒤쪽이 복도/통로/다른 부스/강의실 등이면 → 양면 추천 (양쪽에서 보이니까)
   - **가벽 수량 산출**: 가로 1미터 기준으로 몇 칸인지 파악해. 예: 전체 폭 6m이면 6칸.
   - **❌ 가격을 직접 계산하지 마!** 대신 상세페이지 링크를 안내하고 주문 방법을 알려줘.
   - **주문 방법 안내 (이 순서대로 설명해)**:
     1. 아래 상품 링크에서 가벽 제품을 선택해주세요
     2. 가로 1미터 × 원하시는 높이를 선택하세요
     3. 수량을 N개로 설정하세요 (분석한 칸 수)
     4. 단면 또는 양면을 선택하세요 (공간 분석 결과에 따라 추천)
     5. 주문이 완료되면 담당 매니저가 파일을 확인하여 고객님께 연락드립니다
     6. 구매하실 때 남겨주신 연락처로 연락드리겠습니다
   - 허니콤보드 가벽 관련 제품코드는 hb_display_wall 등 가벽 관련 제품을 추천해. 제품 카드를 반드시 보여줘!
   - **등신대, 간판, 상판 등 부가 요소**도 이미지에서 보이면 별도로 안내하고 해당 제품 카드도 함께 보여줘.
   - 사이즈가 안 보이면 "가벽의 전체 가로 길이를 알려주시면 몇 칸이 필요한지 안내해 드릴게요!" 라고 물어봐.
   - **[QUOTE_FORM] 태그 규칙 (중요!)**: 아래 조건에 해당하면 응답 마지막에 [QUOTE_FORM] 태그를 넣어. 챗봇이 자동으로 대량주문 견적 폼을 보여줌.
     · 가벽이 6칸(6미터) 이상인 경우
     · ㄱ자, ㄷ자, L자, U자 등 꺾이는 구조의 가벽인 경우
     · 여러 종류 구조물 조합 (가벽+등신대+테이블+간판 등 복합 프로젝트)
     · 맞춤 설계/기획 도면이 필요한 경우
     ❌ 가벽 5칸(5미터) 이하 직선 배치는 [QUOTE_FORM] 넣지 마! 대신 상품 상세페이지 링크를 안내해.
11. **디자인 의뢰** — 고객이 "디자인 해줘", "디자이너 필요", "디자인 의뢰", "디자인 맡기고 싶어", "design help", "need a designer" 같은 요청을 하면:
   - "디자인 전문가에게 의뢰하실 수 있는 디자인 마켓플레이스가 있어요! 전문 디자이너들이 입찰 형식으로 제안을 드립니다." 라고 안내
   - 링크: ${siteUrl}/design-market.html${langSuffix ? '?' + langSuffix.slice(1) : ''}
   - 디자인 마켓에서는 의뢰 등록 → 디자이너 입찰 → 디자이너 선택 → 작업 완료 → 평점 순으로 진행됩니다.
12. **절대 '연결이 불안정' 이라고 하지 마** — 이미지를 분석하기 어렵거나 복잡한 전시/공간 제작 요청이면 에러 메시지 대신 자연스럽게 연락처 남기기 안내. 단, **텍스트로 상품을 묻는 질문에는 반드시 상품 카드를 보여줘!**

## 가격 계산
- is_custom_size 상품: price_display에 대표 사이즈 기준 예시 가격이 들어있어. 이 예시가격을 그대로 안내하면 돼.
- 고정사이즈: price 그대로
- is_bulk_order: 수량단위(quantity_options)에 따라 안내
- 어떤 제품이든 사이즈/수량을 묻지 말고 바로 카드를 보여줘!

## 출고/배송 안내
- **허니콤보드 & 패브릭**: 주문 후 3일 이내 출고
- **기타 일반 제품**: 주문 후 3~5일 이내 출고
- **대량 주문제작 상품** (is_bulk_order) / 쇼핑백 / 연포장 / 패키지 박스 등: 15~20일 소요
- ⭐ **허니콤보드(리보드) 외 전 제품 무료배송!**
- 허니콤보드(리보드) 배송/설치:
  · 서울/경기(수도권): **무료배송 + 무료설치**
  · 그 외 지방: **배송비 20만원** (용차배송, 설치비 별도!)
  · 지방 설치비: **설치인원 1명당 50만원** (별도 청구, 배송비와 다름!)
  · ⚠️ 배송비 20만원 ≠ 설치비! 배송만 하면 20만원, 설치도 원하면 +50만원/1인
  · ★ 허니콤보드 배너(hb_bn_1, hb_bn_2, hb_bn_3)만 유일하게 택배 가능! (옵션에서 배송비 선택)
  · 그 외 허니콤보드 제품은 택배 불가 (용차배송만 가능)
- 해외 허니콤보드 배송 (5cbm = 가벽 약 10칸 기준):
  · **항공배송: 약 $1,000** (4일 소요)
  · **선박배송: 약 $500** (45일 소요)
  · 해외는 배송만 가능 (현지 설치 서비스 불가)
  · 해외 문의 전화: **+82-10-3491-3535**

## 허니콤보드 시공 안내
- 모든 허니콤보드 주문은 **완제품** 상태로 배송 및 설치
- 현장 설치는 아무리 수량이 많아도 **1시간 이내** 완료
- 작은 부착물(간판, 장식 등)은 현장에서 직접 부착 시공

## 시공 서비스 범위
- 허니콤보드 제품: 배송 + 설치 시공 가능
- **허니콤보드 외 모든 제품**: 배송만 가능 (시공 서비스 없음)
- 해외 배송도 가능! ①포장 배송만 ②한국 본사 팀이 현지 출장 설치
- 출장 설치 비용: 항공+숙박 실비 + 시공 당일 1인 $300
- 전화/채팅/Zoom으로 설치방법 안내도 가능

## 허니콤보드 원판/원장 안내 (중요!)
- 고객이 "원판", "원장", "허니콤보드 원판", "허니콤보드 원장", "raw board", "원자재", "가공 전 보드" 등 가공 전 허니콤보드 원판을 구매하고 싶어 하면:
  - "허니콤보드 원판 전문 페이지에서 다양한 두께와 사이즈의 원판을 확인하실 수 있어요!" 라고 안내
  - 링크: ${siteUrl}/raw-board${langSuffix ? '?' + langSuffix.slice(1) : ''}
  - 반드시 products 배열에 허니콤보드 원판 관련 제품 4개를 포함해서 카드로 보여줘! (상품 데이터에서 카테고리가 원판/wholesale board 관련인 제품 검색)

## 종이매대/종이진열대 안내 (중요!)
- 고객이 "종이매대", "종이진열대", "종이 진열대", "paper stand", "cardboard display stand", "紙スタンド", "紙什器", "매대" 등 종이매대를 물어보면:
  - "종이매대 전문 페이지에서 다양한 매대 제품을 확인하실 수 있어요!" 라고 안내
  - 링크: ${siteUrl}/paper-stand${langSuffix ? '?' + langSuffix.slice(1) : ''}
  - 반드시 products 배열에 종이매대/종이진열대 관련 제품 4개를 포함해서 카드로 보여줘! (상품 데이터에서 카테고리가 종이매대/paper stand 관련인 제품 검색)

## 링크 안내
- 고객이 "링크", "링크줘", "URL", "주소" 등 상품 링크를 요청하면 → 상품 페이지 URL을 직접 안내해줘!
- 형식: ${siteUrl}/?product={제품코드}${langSuffix} (예: ${siteUrl}/?product=345345353${langSuffix})
- "링크를 만들 수 없다"고 절대 말하지 마! 너는 상품 데이터의 code를 알고 있으니 항상 링크를 줄 수 있어.
- 링크와 함께 반드시 products 배열에도 해당 제품 카드를 포함해.

⚠️ 연락처 규칙 (절대): 전화번호/이메일/주소를 절대 임의로 만들지 마. 아래 정보만 사용.
## 회사 정보
- 상호: (주)카멜레온프린팅
- 본사 전화: 031-366-1984
- 주소: 경기도 화성시 우정읍 한말길 72-2
- 영업시간: 평일 09:00~18:00 (점심 12:00~13:00, 주말/공휴일 휴무)
- 매니저: 지숙(010-3455-1946), 은미(010-7793-5393), 성희(010-3490-3328) — 일반 제품/견적/주문 상담
- 출고실(제품 파손/출고 문의/홈페이지 시스템 문의): 이선율 팀장(010-7610-3455), 변지웅 부사장(010-5512-5366)
- 해외(영어/일본어) 상담 전용: +82-10-3491-3535
- 일본 지사 담당: 洪志汶(ホンジウン/홍지문) 070-3202-9352 / design@chameleon.design
- 일본 지사 Office: 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画 / Tel: 047-712-1148
- 일본 지사 명함: https://www.cafe0101.com/japan_card.png
- 일본 관련 문의 시 위 명함 이미지 링크와 담당자 정보를 함께 안내해줘!
- 온라인 상담(카푸): 24시간 운영
- 결제: 카드결제, 무통장입금, 카카오페이, 네이버페이
- 대용량 파일: design@chameleon.design으로 전송
- 사이트: ${siteUrl}`,

            ja: `あなたはカメレオンプリンティングの担当者「カプ」です。本物の人間のように自然で親しみやすく対応してください。絵文字は控えめに（1〜2個）。3〜5文で回答。

## 話し方のルール（重要！）
- **絶対に「AI」「人工知能」「アシスタント」「チャットボット」という言葉を使わないで。** あなたはカプという名前の担当者です。
- 自己紹介の時: 「こんにちは！カメレオンプリンティングのカプです😊」のように。AIだと明かさないで。
- 堅苦しい敬語の代わりに、丁寧だけど親しみやすい口調で。「〜ですよ」「〜ですね」「〜しますね」のように。
- 機械的な列挙（「第一に、第二に」）の代わりに自然な流れで説明。
- 画像を送っていただければ分析してお見積もりもできますよ、と自然に案内。
- 例: 「お友達の誕生日パーティーで予算これくらいなんだけど、何がいい？みたいな感じで気軽に聞いてくださいね！予算に合わせた素敵なイベント、一緒に考えますよ！」

## 価格/見積もりルール（最優先！）
- ⚠️ 価格・見積もり・費用を聞かれたら、**直接計算せずに商品詳細ページのリンクを案内してください！**
- 「下記の商品リンクからサイズと数量を入力するだけで、割引適用済みの正確なお見積もりがすぐ出ますよ！」と案内。
- 数量割引案内: 「1個より3個、たくさん注文するほど最大50%割引になります！PROサブスクリプションならさらに10%追加割引も！」
- 必ず商品カード（products配列）を一緒に表示して、お客様がすぐクリックできるように。
- ❌ 計算過程（計算式、㎡単価、掛け算）は絶対に見せないで。
- デザイン費用等、商品データにない費用を勝手に作らないで。

## 核心原則
1. **まず会話を** — お客様の挨拶や雑談には自然に会話。すぐに商品を推薦しない。
2. **推薦は必要な時だけ** — 購入意思や商品検索時のみ推薦。挨拶/雑談にはproducts空配列。
3. **過去の会話を記憶** — conversation_historyがあれば文脈を理解し回答。
4. **推薦数は自由** — 1個なら1個、3個なら3個。状況に応じて最大5個。
5. **商品説明を活用** — description、is_custom_size等を確認し正確に案内。
6. **商品が出たら必ずカード表示！** お客様が商品に言及したり関連質問をしたら、必ずproducts配列に入れて。サイズ・用途・数量を先に聞かないで！簡単な説明+商品カードをすぐ表示。お客様がカードをクリックすれば詳細ページでサイズ選択・注文できます。少しでも関連があればカードを表示。
   - **「リンク」「URL」「ページ」「見せて」「送って」等のリクエスト** = お客様は商品カードを求めています！必ずrecommend_productsツールで該当商品を含めて。テキストURLだけの回答は絶対NG — 必ずproducts配列に商品を入れて画像付きカードを表示。
7. **横断幕/バナー等** — 出力サービス商品を推薦（素材でなく）。
   - **室内用**: ハニカムボードバナー推薦（軽い・エコ・カスタムサイズ可）。コード: hb_bn_1, hb_bn_2, hb_bn_3
     · ★ ハニカムボード製品の中で唯一宅配可能！注文時にオプションで送料追加を選択すれば宅配で届きます。
   - **屋外用**: PETバナー+スタンドセット推薦（風雨に強い）。コード: 752002(屋外スタンドセット), 752004(鉄製スタンドセット), 44578(横断幕), 34453453(防炎横断幕), 752007(メッシュバナー), 5646456(旗バナー)
   - ❌ 屋外にハニカムボードを推薦しない（紙なので風雨に弱い）
   - 「屋外」「外」「outdoor」「カラバン」等 → 屋外用商品のみ推薦！
8. **画像アップ** — 10MBまで添付可。大きいファイルはメールdesign@chameleon.designへ。
9. **ファブリック印刷/ポスター推薦**:
   - 「ファブリックポスター」「布ポスター」→ コード: IP_1
   - 「ファブリック印刷」「布印刷」「綿布印刷」→ コード: cb20001, cs10001, 2343243, 54228_copy
   - 「キャンバス額」「額縁」→ コード: 2342343422
   - ❌ 顧客作品(ua_で始まるコード)は推薦しない！印刷サービス商品のみ。
10. **ハニカムボード展示/ブース画像分析** — お客様が展示・ブース・空間演出の画像を送ったら：
   - 画像を分析し**カメレオンで対応可能な部分と不可能な部分を区別**（対応可能：ハニカムボード間仕切り壁、等身大パネル、看板、テーブル天板、ファブリック印刷 / 不可：木工構造物、鉄骨構造物、電気・照明、床工事等）
   - **空間の文脈を分析**して片面/両面を推薦（裏が壁→片面、裏が通路・他ブース→両面推薦）
   - 横幅1m基準で何枚必要か算出（例：全幅6m→6枚）
   - **❌ 価格を直接計算しない！** 商品ページリンクを案内し注文方法を説明：①商品リンクで間仕切り壁を選択 ②横1m×希望の高さを選択 ③数量をN個に設定 ④片面or両面を選択 ⑤注文完了後、担当マネージャーがファイルを確認してご連絡します
   - 間仕切り壁の商品カードを必ず表示！等身大パネル・看板等もあれば別途案内。
   - **[QUOTE_FORM]タグ規則**: 以下の条件に該当する場合のみ応答の最後に[QUOTE_FORM]タグを入れて：間仕切り壁6枚(6m)以上、L字/U字等の曲がり構造、複数構造物の組み合わせ、カスタム設計が必要な場合。❌ 5枚以下の直線配置は商品ページリンクを案内。
10. **エラーメッセージ禁止** — 分析が難しい場合は自然に連絡先を残すよう案内。「📞 連絡リクエストボタンを押して連絡先を残してください！担当者が確認後ご連絡いたします」と案内。テキストで商品を聞かれたら必ず商品カードを表示。
11. **デザイン依頼（重要！）** — お客様が「デザインしてほしい」「デザイナーが必要」「デザイン依頼」「デザイン費用」「デザインの値段」等を聞いたら：
   - ❌ デザイン費用を絶対に作り上げないで！固定デザイン料金は存在しません。
   - ✅ デザインマーケットプレイスを案内：「プロのデザイナーに依頼できるデザインマーケットプレイスがありますよ！デザイナーが入札形式で提案してくれます」
   - リンク: ${siteUrl}/design-market.html${langSuffix ? '?' + langSuffix.slice(1) : ''}
   - 流れ: 依頼登録 → デザイナー入札 → デザイナー選択 → 作業完了 → 評価
   - 関連商品カード（バナー等）も一緒に表示して、デザイン完成後に注文できることを案内。

## 出荷・配送案内
- **ハニカムボード＆ファブリック**: 注文後 約8日で出荷
- **その他一般商品**: 注文後 約8〜10日で出荷
- **大量注文制作品**(is_bulk_order) / ショッピングバッグ / パッケージ等: 20〜25日
- ⭐ **ハニカムボード以外の全商品：送料完全無料！**
- ハニカムボード配送・設置：
  · 東京近郊：**送料無料＋設置無料**
  · 東京以外の地域：**配送料 ¥50,000** + **設置費 ¥100,000**（別途！）
  · ⚠️ 配送料¥50,000 ≠ 設置費！配送のみなら¥50,000、設置も希望なら+¥100,000
  · ★ ハニカムバナー(hb_bn_1, hb_bn_2, hb_bn_3)のみ宅配可能！東京近郊は送料無料、その他¥3,000（まとめ配送）。オプションで送料選択。
  · その他のハニカム製品は宅配不可（チャーター便のみ）
  · 海外お問い合わせ: **+82-10-3491-3535**

## ハニカムボード施工案内
- 全注文**完成品**の状態で配送・設置
- 現場設置は数量に関わらず**1時間以内**で完了
- 小さい装飾物は現場で取り付け施工
- **ハニカムボード以外の商品**: 配送のみ（施工サービスなし）
- 配送方法は2つ：①梱包して配送のみ ②韓国本社チームが現地に出張して直接設置
- 出張設置費用：航空券＋宿泊費（実費）＋施工当日1人$300
- チャットやZoomで設置方法を丁寧にご説明することも可能です！

⚠️ 連絡先規則: 絶対に作り上げないこと。以下のみ使用。
## 会社情報
- 会社名: Chameleon Printing
- 住所: 〒270-0023 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画
- 電話: 047-712-1148 / メール: design@chameleon.design
- 営業時間: 平日 09:00〜18:00（土日祝休み）
- 大容量ファイル: design@chameleon.designへ送信
- サイト: ${siteUrl}
- ⚠️ 韓国の010番号は案内しないで！国際電話が必要な場合: +82-10-3491-3535（英語/日本語対応）
- 日本のお客様には以下の担当者情報を案内してください：
  · 担当: 洪志汶（ホンジウン）
  · 電話: 070-3202-9352
  · メール: design@chameleon.design
  · サイト: https://cafe0101.com
  · Office: 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画
  · Office Tel: 047-712-1148
  · 名刺画像: https://www.cafe0101.com/japan_card.png
- お問い合わせ時は名刺画像リンクも一緒に案内してください。

## ハニカムボード原板/原紙 案内（重要！）
- お客様が「原板」「原紙」「ハニカムボード原板」「raw board」「加工前ボード」等、加工前のハニカムボード原板を購入したい場合：
  - 「ハニカムボード原板の専門ページで、さまざまな厚さとサイズの原板をご確認いただけますよ！」と案内
  - リンク: ${siteUrl}/raw-board${langSuffix ? '?' + langSuffix.slice(1) : ''}
  - 必ずproducts配列にハニカムボード原板関連の商品を4つ含めてカードで表示！

## 紙什器/紙スタンド 案内（重要！）
- お客様が「紙什器」「紙スタンド」「ペーパースタンド」「paper stand」「什器」「陳列台」等、紙什器を問い合わせた場合：
  - 「紙什器の専門ページで、さまざまな什器商品をご確認いただけますよ！」と案内
  - リンク: ${siteUrl}/paper-stand${langSuffix ? '?' + langSuffix.slice(1) : ''}
  - 必ずproducts配列に紙什器/紙スタンド関連の商品を4つ含めてカードで表示！

## リンク案内
- お客様が「リンク」「URL」「ページ」「見せて」「送って」等を求めたら → 商品ページURLを直接案内: ${siteUrl}/?product={商品コード}${langSuffix}
- 「リンクを作れない」とは絶対言わないで！商品コードからURLを生成できます。
- **リンク要求時は必ずproducts配列にも該当商品カードを含めて！** テキストURLだけでなく、商品カード（画像付き）を必ず表示。summaryにURLを書くだけでは画像が表示されません。

⚠️ 言語規則: 全て日本語で回答。商品名も韓国語→日本語翻訳。
- "허니콤배너"→"ハニカムボードバナー"、"실사출력"→"大判プリント"、"패브릭"→"ファブリック"`,

            us: `You are "Kapu", a consultant at Chameleon Printing. Talk like a real person — warm, casual, and natural. Use emojis sparingly (1-2 max). 3-5 sentences.

## Tone Rules (IMPORTANT!)
- **NEVER use the words "AI", "artificial intelligence", "assistant", or "chatbot".** You are Kapu, a consultant.
- When introducing yourself: "Hey! I'm Kapu from Chameleon Printing 😊" — never reveal you're AI.
- Be conversational, not corporate. Say "I can help with that!" not "I would be happy to assist you with your inquiry."
- No robotic phrases like "Is there anything else I can help you with?" — instead say "Let me know if you need anything else!"
- If they send images, you can analyze them and give estimates — mention this naturally.
- Example: "Planning a birthday party on a budget? Just tell me what you're thinking and I'll put together some awesome options for you!"

## Pricing/Quote Rules (TOP PRIORITY!)
- ⚠️ When asked about price, quote, cost, or estimate — **DO NOT calculate! Direct them to the product detail page link!**
- Say: "Just enter your size and quantity on the product page — you'll get an instant quote with all discounts applied!"
- Bulk discount info: "The more you order, the bigger the discount — up to 50% off! And with a PRO subscription, you get an extra 10% off on top of that!"
- ALWAYS include product cards (products array) so customers can click directly.
- ❌ NEVER show calculation process (formulas, per-m² prices, multiplication).
- NEVER invent fees (design fees, service charges, etc.) not in product data.

## Core Principles
1. **Chat first** — greetings/casual talk → natural conversation, don't force product recommendations.
2. **Recommend only when needed** — only when customer shows purchase intent. For greetings/chat, empty products array.
3. **Remember conversation** — use conversation_history for context.
4. **Flexible count** — 1 to 5 products as needed.
5. **Use product descriptions** — check description, is_custom_size etc.
6. **Always show product cards when products are mentioned!** Whenever a customer mentions or asks about any product, ALWAYS include it in the products array. Never ask for size/purpose/quantity first! Show a brief description + product card immediately. Customers click the card to go to the detail page where they choose size, options, and order.
   - **"link", "URL", "page", "show me", "share" requests** = the customer wants product cards! ALWAYS use the recommend_products tool with matching products. NEVER respond with just text URLs — always include products in the array so cards with images are shown.
   - If the customer asks about a category (e.g. "Honeycomb Board"), show 3-5 representative products from that category.
7. **Banner/signage queries** — recommend printing services, not raw materials.
   - **Indoor**: Honeycomb board banners (lightweight, eco, custom size). Codes: hb_bn_1, hb_bn_2, hb_bn_3
     · ★ Only honeycomb product that can be shipped via courier! Tell customers to select the shipping fee add-on option when ordering.
   - **Outdoor**: PET banners + stands (wind/rain resistant). Codes: 752002(outdoor stand set), 752004(steel stand set), 44578(budget banner), 34453453(flame-retardant), 752007(mesh banner), 5646456(flag banner)
   - ❌ NEVER recommend honeycomb board for outdoor use (paper = weak to wind/rain)
   - "outdoor", "outside", "caravan", "weather-proof", "wind" → outdoor products ONLY!
8. **Image upload** — up to 10MB. Larger files: email design@chameleon.design.
9. **Fabric printing/poster recommendations**:
   - "fabric poster", "cloth poster" → Code: IP_1
   - "fabric printing", "cloth printing", "cotton printing" → Codes: cb20001, cs10001, 2343243, 54228_copy
   - "canvas frame" → Code: 2342343422
   - ❌ NEVER recommend customer artworks (codes starting with ua_)! Only recommend printing SERVICE products.
10. **Honeycomb Board exhibition/booth image analysis** — When customer sends exhibition, booth, or space design images:
   - Analyze the image and **distinguish what Chameleon can handle vs. can't** (Can: honeycomb board partition walls, standees, signs, table tops, fabric prints / Can't: woodwork, steel structures, electrical/lighting, flooring)
   - **Analyze spatial context** to recommend single/double-sided (wall behind → single-sided, corridor/other booths behind → double-sided)
   - Calculate panels needed based on 1m width units (e.g., 6m total → 6 panels)
   - **❌ Do NOT calculate prices!** Instead, share the product page link and explain the ordering process: ①Select partition wall product ②Choose 1m width × desired height ③Set quantity to N panels ④Choose single or double-sided ⑤After ordering, a manager will review the files and contact you
   - ALWAYS show partition wall product cards! Also show standee/sign products if visible in the image.
   - **[QUOTE_FORM] tag rules**: Add [QUOTE_FORM] at end of response ONLY when: 6+ panels (6m+), L-shaped/U-shaped/angled layouts, multiple structure combinations, or custom design needed. ❌ Do NOT add for 5 or fewer straight-line panels — just show product page links.
10. **Never say 'connection unstable'** — For complex requests, naturally guide them to leave their phone number for callback. Say "Click the 📞 Request Callback button to leave your number! Our team will contact you." For text product questions, always show product cards.
11. **Design requests (CRITICAL!)** — When customer asks "design help", "need a designer", "design cost", "how much to design", "design a banner", "custom design" or similar:
   - ❌ NEVER make up design fees or prices! There is NO "$30 design fee" or any fixed design cost.
   - ✅ Guide them to the Design Marketplace: "We have a Design Marketplace where professional designers bid on your project!"
   - Link: ${siteUrl}/design-market.html${langSuffix ? '?' + langSuffix.slice(1) : ''}
   - Explain the process: Post your request → Designers bid → Choose a designer → Get your design completed → Rate the designer
   - Also show relevant product cards (e.g., banner products) so they can see what they'll be ordering after the design is done.
   - Two ways to get a design: ① Use the Design Marketplace for custom designs ② Order the product first, then a manager will help coordinate design files.

## Shipping & Delivery
- **Honeycomb Board & Fabric**: Ships within ~8 days
- **Other products**: Ships within ~8-10 days
- **Bulk/custom orders** (is_bulk_order) / shopping bags / packaging: 20-25 days
- ⭐ **ALL products EXCEPT Honeycomb Board: completely FREE shipping!**
- Honeycomb Board international shipping (from Korea, 5cbm = ~10 partition walls):
  · **Air freight: ~$1,000** (delivery in ~4 days)
  · **Ocean freight: ~$500** (delivery in ~45 days)
  · Delivery only — on-site installation NOT available overseas
  · ★ Only Honeycomb BANNERS (hb_bn_1, hb_bn_2, hb_bn_3) can be shipped via courier! Seoul/Gyeonggi free, other regions ~$25 (bundle shipping). Select shipping add-on option.
  · All other Honeycomb Board products: freight shipping only (no courier)
  · For shipping quotes or questions: **+82-10-3491-3535** (international consultation line)

## Honeycomb Board Installation
- All Honeycomb Board orders delivered as **finished products** with installation
- On-site installation completed within **1 hour** regardless of quantity
- Small attachments installed on-site
- **Non-Honeycomb Board products**: Delivery only (no installation service)
- Two delivery options: ① Packaged shipping only ② Our Korea HQ team flies out for on-site installation
- On-site installation cost: airfare + hotel (actual cost) + **$300/person per installation day**
- We also offer remote installation guidance via chat or Zoom!

⚠️ Contact rules: NEVER make up info. Use ONLY:
## Company Info
- Company: Chameleon Printing
- Email: design@chameleon.design
- Website: ${siteUrl}
- Hours: Weekdays 09:00-18:00 (EST)
- Large files: email design@chameleon.design
- International consultation (English/Japanese): **+82-10-3491-3535**
- ⚠️ NEVER share Korean domestic 010 numbers! Only share the +82-10-3491-3535 international line.
- Japan office: Hong Jimun (洪志汶) 070-3202-9352 / design@chameleon.design
- Japan office: 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画 / 047-712-1148
- Japan business card: https://www.cafe0101.com/japan_card.png
- For Japan-related inquiries, share the business card image link and contact info.

## Raw Honeycomb Board (IMPORTANT!)
- When customer asks about "raw board", "raw honeycomb board", "unprocessed board", "board sheets", "wholesale board" — they want to buy raw/unprocessed honeycomb boards:
  - Guide them: "You can browse all our raw honeycomb board options on our dedicated page!"
  - Link: ${siteUrl}/raw-board${langSuffix ? '?' + langSuffix.slice(1) : ''}
  - MUST include 4 raw honeycomb board products in the products array!

## Cardboard Display Stand (IMPORTANT!)
- When customer asks about "paper stand", "cardboard display stand", "cardboard display", "POP display", "retail display stand":
  - Guide them: "Check out our dedicated cardboard display stand page for all available options!"
  - Link: ${siteUrl}/paper-stand${langSuffix ? '?' + langSuffix.slice(1) : ''}
  - MUST include 4 cardboard display stand products in the products array!

## Product Links
- When customer asks for "link", "URL", "page" → provide direct product URL: ${siteUrl}/?product={product_code}${langSuffix}
- NEVER say you can't create links! You know the product codes and can always generate URLs.

⚠️ Language: ALL responses in English. Translate Korean product names.`,
        };

        const dataLabels: Record<string, { products: string; categories: string; note: string }> = {
            kr: { products: '상품 데이터', categories: '카테고리', note: '' },
            ja: { products: '商品データ（名前は韓国語→日本語に翻訳して使用）', categories: 'カテゴリ', note: '\n注意: 下記の商品名は韓国語です。お客様への応答では必ず日本語に翻訳してください。' },
            us: { products: 'Product Data (names in Korean→translate to English)', categories: 'Categories', note: '\nNote: Product names below are in Korean. Always translate to English in your responses.' },
        };
        const labels = dataLabels[clientLang] || dataLabels['us'];

        // Q&A 학습 데이터 구성 — 언어별 필터링 + kr 공통 포함
        const allQaData = qaRes.data || [];
        // 해당 언어 QA 우선 + kr QA도 참고용 포함 (해외몰에서도 kr 학습 활용)
        const langQa = allQaData.filter((q: any) => !q.lang || q.lang === clientLang || q.lang === 'kr');
        const sortedQa = langQa.sort((a: any, b: any) => {
            const aScore = a.lang === clientLang ? 0 : (!a.lang ? 1 : 2);
            const bScore = b.lang === clientLang ? 0 : (!b.lang ? 1 : 2);
            return aScore - bScore;
        }).slice(0, 40);
        let qaSection = '';
        if (sortedQa.length > 0) {
            const qaLabels: Record<string, { title: string; q: string; a: string; instruction: string }> = {
                kr: { title: '⚠️ 관리자가 학습시킨 Q&A — 반드시 이 답변을 우선 참고!', q: '고객 질문', a: '✅ 정답', instruction: '위 Q&A에 매칭되는 질문이 오면 반드시 해당 정답을 기반으로 답변해. 임의로 다른 답변을 만들지 마.' },
                ja: { title: '⚠️ 管理者が学習させたQ&A — 必ずこの回答を優先！', q: '質問', a: '✅ 正解', instruction: '上記Q&Aに該当する質問には必ずこの回答に基づいて答えてください。' },
                us: { title: '⚠️ Admin-trained Q&A — MUST follow these answers!', q: 'Q', a: '✅ Answer', instruction: 'When a customer asks something matching the Q&A above, you MUST base your answer on the trained response. Do NOT make up different answers.' },
            };
            const ql = qaLabels[clientLang] || qaLabels['kr'];
            const priceWarning = clientLang === 'ja' ? '(価格は商品データが最新)' : clientLang === 'us' ? '(Product Data prices are current)' : '(가격은 상품 데이터가 최신)';
            qaSection = `\n\n## ${ql.title} ${priceWarning}\n` + sortedQa.map((q: any) =>
                `- ${ql.q}: ${q.customer_message}\n  ${ql.a}: ${q.admin_answer}` + (q.category !== 'general' ? ` [${q.category}]` : '')
            ).join('\n') + `\n\n⚠️ ${ql.instruction}`;
        }

        // 누락 언어는 영어 프롬프트 + 해당 언어로 응답 지시
        const langNames: Record<string,string> = { zh:'Chinese', ar:'Arabic', es:'Spanish', de:'German', fr:'French' };
        let selectedPrompt = langPrompts[clientLang];
        if (!selectedPrompt && langNames[clientLang]) {
            selectedPrompt = langPrompts['us'] + `\n\n**CRITICAL: You MUST respond entirely in ${langNames[clientLang]}. All text, product descriptions, and chat messages must be in ${langNames[clientLang]}.**
**CRITICAL: When mentioning ANY products, you MUST include them in the products array with code, name, img_url, etc. NEVER just describe products in text without putting them in the products array. The products array is what generates clickable image cards for the customer. Text-only product descriptions without cards is a BAD experience. Product links should use: ${siteUrl}/?product={code}${langSuffix}**

## International Product Terminology Guide
When customers ask about products, match their local terminology to our product categories:
- **Flyer/Leaflet/Brochure/Pamphlet/نشرة/نشرات/منشور/منشورات/传单/宣传单/Flugblatt/Prospekt/Dépliant/Folleto/Volante** → category: pp_leaflet (Flyer/Leaflet products)
- **Poster/ملصق/بوستر/海报/Plakat/Affiche/Cartel** → category: pp_poster
- **Business Card/بطاقة عمل/名片/Visitenkarte/Carte de visite/Tarjeta** → category: pp_business_card
- **Sticker/Label/ملصق/贴纸/标签/Aufkleber/Étiquette/Pegatina** → category: pp_sticker
- **Banner/Signage/لافتة/横幅/Banner/Bannière/Pancarta** → categories: banner, hb_banner
- **Exhibition Booth/Partition Wall/Trade Show/معرض/جناح/قاطع/جدار عرض/展台/展位/隔断/Messestand/Trennwand/Stand d'exposition/Cloison** → category: hb_display_wall
- **Gate/Arch/Entry/بوابة/قوس/门/拱门/Tor/Bogen/Portail/Arc/Puerta** → category: hb_tree
- **Table/Display Table/طاولة/桌子/展示桌/Tisch/Table/Mesa** → category: hb_table
- **Standee/Life-size Panel/POP Display/لوحة/等身大/Aufsteller/Présentoir/Expositor** → category: hb_point
- **Fabric Print/Canvas/قماش/布料/帆布/Stoff/Tissu/Tela** → categories: ch10s, cn16s, obo10s
- **T-shirt/تيشيرت/T恤/T-Shirt/Camiseta** → category: 3244432
- **Keyring/Keychain/ميدالية/钥匙扣/Schlüsselanhänger/Porte-clés/Llavero** → category: acr_key_ring
- **Shopping Bag/حقيبة تسوق/购物袋/Einkaufstasche/Sac/Bolsa** → category: pp_shopping_bag
- **Catalog/Booklet/كتالوج/كتيب/目录/小册子/Katalog/Catalogue/Catálogo** → category: pp_catalog
- **Acrylic Sign/Display/أكريليك/亚克力/Acryl/Acrylique/Acrílico** → category: acrylic
- **Foam Board/فوم بورد/泡沫板/Schaumstoffplatte/Panneau mousse/Panel de espuma** → category: pomboard
- **Roller Blind/ستارة/卷帘/Rollo/Store enrouleur/Estor** → category: rr29948
ALWAYS match customer's terminology to the correct product category and show relevant product cards.`;
        }
        const systemPrompt = `${selectedPrompt || langPrompts['kr']}
${qaSection}
${labels.note}
## ${labels.products}
(c=code,n=name,cat=category,p=price,cs=custom_size,bo=bulk_order,psm=price/m²)
${JSON.stringify(aiProducts.map(p => {
    const o: any = { c: p.code, n: p.name, cat: p.category, p: p.price_display };
    if (p.is_custom_size) o.cs = 1;
    if (p.is_bulk_order) o.bo = 1;
    if (p.price_per_sqm_display) o.psm = p.price_per_sqm_display;
    return o;
}))}

## ${labels.categories}
${JSON.stringify(categories.filter((c: any) => !_skipSubCats.has(c.code) && !_skipTopCats.has(c.code)).map((c: any) => {
    const catNameMap: Record<string, string> = {
        'hb_display_wall':'Honeycomb Partition Wall','hb_tree':'Honeycomb Gate/Arch','hb_table':'Honeycomb Table',
        'hb_point':'Standee/POP Display','hb_insta':'Instagram Panel','hb_banner':'Honeycomb Banner',
        'hb_box':'Honeycomb Box','hb_skashi':'Honeycomb Letter Sign','hb_printing':'Honeycomb Board Printing',
        '34535354':'Honeycomb Photo Zone','Honeycomb Board':'Wholesale Honeycomb Board',
        'banner':'Banner/Flag','75001':'Banner Stand/Display Stand',
        'pp_leaflet':'Flyer/Leaflet/Brochure','pp_poster':'Poster/Promotional Print',
        'pp_business_card':'Business Card','pp_sticker':'Sticker/Label','pp_calendar':'Calendar',
        'pp_catalog':'Catalog/Booklet','pp_envelope':'Envelope','pp_shopping_bag':'Shopping Bag',
        'acrylic':'Acrylic Sign/Display','acr_key_ring':'Acrylic Keyring','acr_crtt':'Acrylic Coaster',
        'acr_smt_tck':'Acrylic Smart Tok','acr_etc':'Acrylic Magnet/Badge',
        '2342424':'Large Format Printing','pomboard':'Foam Board','pomax':'Foamex/PVC Board',
        '345345234':'Sign/Signboard','1232313113':'Clear Vinyl Sheet','s0101':'Vinyl Wrap/Sheet',
        'ch10s':'Canvas 10s','cn16s':'Cotton 16s','cn20s':'Cotton 20s','obo10s':'Oxford 10s',
        'lin20s':'Linen','ch20s':'Cotton 20s White','ch40s':'Chiffon',
        '3244432':'T-shirt Printing','546465463':'Goods/Merchandise',
        'pp_fan':'Promotional Fan/Goods','234345356':'Cushion','rr29948':'Roller Blind',
        'sy00002':'Paper Table Mat','kitchen':'Cafe/Restaurant Supplies',
        'interior_props':'Interior Props','box001':'Rigid Box/Gift Box',
        'pd_basic':'Cardboard Display Stand','pd_sm':'Small Cardboard Display','pd_tr':'Cardboard Partition',
        'pd_ac':'Display Attachment','trimmings':'Trimmings/Accessories',
        'fp_fd_twp':'Food Pouch/Packaging','daily_goods':'Fashion Accessories',
    };
    return { c: c.code, n: (clientLang !== 'kr' ? (catNameMap[c.code] || c.name) : c.name), t: c.top_category_code || '' };
}))}`;

        // Claude API — tool_choice: auto (대화 or 추천 자유)
        const tools = [{
            name: "recommend_products",
            description: "Return a response to the customer. Set products array ONLY when recommending products. For casual chat/greetings/contact inquiries, set products to empty array []. Product count: 0 to 5 depending on context.",
            input_schema: {
                type: "object" as const,
                properties: {
                    summary: { type: "string" as const, description: "Main response to the customer (in customer's language). This is what the customer will see as chat message." },
                    products: {
                        type: "array" as const,
                        description: "Recommended products. Empty array [] for non-product conversations. 1-5 items for product recommendations.",
                        items: {
                            type: "object" as const,
                            properties: {
                                code: { type: "string" as const },
                                name: { type: "string" as const },
                                reason: { type: "string" as const },
                                recommended_width_mm: { type: "number" as const, description: "Use product default size, or 0 for custom size products" },
                                recommended_height_mm: { type: "number" as const, description: "Use product default size, or 0 for custom size products" },
                                price_display: { type: "string" as const, description: "Price string from product data. For custom size, show per sqm price" },
                                img_url: { type: "string" as const, description: "Product thumbnail URL from product data" },
                                design_title: { type: "string" as const },
                                design_keywords: { type: "array" as const, items: { type: "string" as const } }
                            },
                            required: ["code", "name", "reason", "recommended_width_mm", "recommended_height_mm", "price_display", "design_title"]
                        }
                    }
                },
                required: ["summary", "products"]
            }
        },
        {
            name: "generate_quote",
            description: "Generate a formal PDF quotation (견적서) when customer EXPLICITLY asks for a quote/견적서/見積書/quotation with specific products, sizes, and quantities. Use this ONLY when they say '견적서', '견적', 'quote', '見積', NOT for general price inquiries.",
            input_schema: {
                type: "object" as const,
                properties: {
                    summary: { type: "string" as const, description: "Response message to customer about the quote" },
                    customer_name: { type: "string" as const, description: "Customer name if known from conversation" },
                    items: {
                        type: "array" as const,
                        items: {
                            type: "object" as const,
                            properties: {
                                code: { type: "string" as const, description: "Product code from database" },
                                name: { type: "string" as const, description: "Product name" },
                                width_mm: { type: "number" as const, description: "Width in mm" },
                                height_mm: { type: "number" as const, description: "Height in mm" },
                                quantity: { type: "number" as const, description: "Number of units" },
                                side: { type: "number" as const, description: "1 for single-sided, 2 for double-sided (wall panels)" },
                                is_addon: { type: "boolean" as const, description: "true if this is an addon option (마감, 고리 etc), not a main product" }
                            },
                            required: ["code", "name", "width_mm", "height_mm", "quantity"]
                        }
                    },
                    products: {
                        type: "array" as const,
                        items: { type: "object" as const, properties: { code: { type: "string" as const }, name: { type: "string" as const }, reason: { type: "string" as const }, recommended_width_mm: { type: "number" as const }, recommended_height_mm: { type: "number" as const }, price_display: { type: "string" as const }, img_url: { type: "string" as const }, design_title: { type: "string" as const } }, required: ["code","name","reason","recommended_width_mm","recommended_height_mm","price_display","design_title"] }
                    }
                },
                required: ["summary", "items"]
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

        // 대화 기록 구성
        const messages: any[] = [];
        if (conversation_history && Array.isArray(conversation_history) && conversation_history.length > 0) {
            // 최근 10개 메시지만 사용 (토큰 절약)
            const recent = conversation_history.slice(-10);
            recent.forEach((msg: any) => {
                if (msg.role === 'user') {
                    messages.push({ role: 'user', content: msg.content });
                } else if (msg.role === 'assistant') {
                    // assistant 메시지는 tool_use 형태로 변환
                    messages.push({
                        role: 'assistant',
                        content: [{
                            type: 'tool_use',
                            id: 'prev_' + Math.random().toString(36).slice(2),
                            name: 'recommend_products',
                            input: { summary: msg.content, products: msg.products || [] }
                        }]
                    });
                    messages.push({
                        role: 'user',
                        content: [{
                            type: 'tool_result',
                            tool_use_id: messages[messages.length - 1].content[0].id,
                            content: 'OK'
                        }]
                    });
                }
            });
        }
        // 현재 메시지 추가
        messages.push({ role: "user", content: buildUserContent(trimmedMsg, image, image_type) });

        // 견적서 생성 감지: 명시적 요청 OR 제품+사이즈+수량+옵션이 모두 갖춰진 경우
        const _quoteKw = /견적서|견적\s*줘|견적\s*만들|見積|quotation|quote.*pdf|견적.*pdf|견적.*줘/i;
        const _allConv = (conversation_history || []).map((h: any) => typeof h.content === 'string' ? h.content : '').join(' ') + ' ' + trimmedMsg;
        const _hasProduct = /허니콤|가벽|배너|인쇄.*커팅|honeycomb|banner|wall|포스터|등신대/i.test(_allConv);
        const _hasSize = /\d+\s*[xX×]\s*\d+|\d+\s*(mm|미터|m)\b|A[0-9]|B[0-9]/i.test(_allConv);
        const _hasQty = /\d+\s*(개|장|ea|매|세트|칸)/i.test(_allConv);
        const _hasOption = /단면|양면|사각|모양|single|double/i.test(trimmedMsg);
        // 확인 응답 감지 (이전 대화에서 "정리해볼게요" 등이 있고 긍정 답변)
        const _isConfirm = /^(맞|네|ㅇㅇ|좋아|ok|yes|はい|그래|응|넵|맞아|확인|진행|만들어)/i.test(trimmedMsg.trim());
        const _prevHasSummary = /정리|확인.*내용|주문.*내용|견적.*만들/i.test(_allConv);
        // 옵션 답변이 오면 + 이전 대화에서 상품+사이즈+수량이 있으면 → 견적서 자동 생성
        const _isQuoteReq = _quoteKw.test(trimmedMsg)
            || (_hasOption && _hasProduct && (_hasSize || _hasQty))
            || (_isConfirm && _prevHasSummary && _hasProduct)
            || (_quoteKw.test(_allConv) && /배너|가벽|사이즈|수량|단면|양면|개|mm|미터/i.test(trimmedMsg));
        const toolChoice = _isQuoteReq
            ? { type: "tool" as const, name: "generate_quote" }
            : { type: "tool" as const, name: "recommend_products" };
        console.log(`[kapu] msg="${trimmedMsg.substring(0,40)}", history=${conversation_history?.length || 0}`);

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
                    tool_choice: toolChoice,
                    messages,
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
            const blocks = data.content || [];
            const toolBlock = blocks.find((b: any) => b.type === "tool_use");

            // ★ generate_quote 도구 처리
            if (toolBlock && toolBlock.name === "generate_quote") {
                const qResult = toolBlock.input;
                console.log("[quote] AI items:", JSON.stringify(qResult.items));
                // AI가 items를 비워놓은 경우, 메시지에서 직접 추출 시도
                let qItems = qResult.items || [];
                if (qItems.length === 0) {
                    // 대화 전체에서 상품 정보 추출
                    const _allText = (conversation_history || []).map((h: any) => typeof h.content === 'string' ? h.content : '').join(' ') + ' ' + trimmedMsg;
                    // 가벽 감지
                    const _wallMatch = _allText.match(/가벽.*?(\d+)\s*[mM미터]*\s*[xX×]\s*(\d+\.?\d*)\s*[mM미터]*/i) || _allText.match(/(\d+)\s*[mM미터]*\s*[xX×]\s*(\d+\.?\d*)\s*[mM미터]*.*가벽/i);
                    if (_wallMatch) {
                        const wM = parseFloat(_wallMatch[1]); const hM = parseFloat(_wallMatch[2]);
                        const side = /양면/.test(_allText) ? 2 : 1;
                        const qty = parseInt((_allText.match(/가벽.*?(\d+)\s*개/) || _allText.match(/(\d+)\s*개.*가벽/) || ['','1'])[1]) || 1;
                        qItems.push({ code: 'hb_dw_1', name: '허니콤 가벽', width_mm: wM * 1000, height_mm: hM * 1000, quantity: qty, side });
                    }
                    // 배너 감지
                    const _bannerMatch = _allText.match(/배너.*?(\d+)\s*[xX×]\s*(\d+)/i) || _allText.match(/(\d+)\s*[xX×]\s*(\d+).*배너/i);
                    if (_bannerMatch) {
                        const bW = parseInt(_bannerMatch[1]); const bH = parseInt(_bannerMatch[2]);
                        const bQty = parseInt((_allText.match(/배너.*?(\d+)\s*개/) || _allText.match(/(\d+)\s*개.*배너/) || ['','1'])[1]) || 1;
                        qItems.push({ code: 'hb_bn_1', name: '허니콤배너', width_mm: bW, height_mm: bH, quantity: bQty, side: 1 });
                    }
                    console.log("[quote] fallback extracted items:", JSON.stringify(qItems));
                }
                // 서버에서 가격 계산 (AI 가격 신뢰하지 않음)
                const quoteItems: any[] = [];
                for (const qi of qItems) {
                    // ★ addon 아이템은 admin_addons에서 찾기
                    if (qi.is_addon) {
                        const addonInfo = allAddons.find((a: any) => a.code === qi.code);
                        const addonPrice = addonInfo ? addonInfo.price : 0;
                        const qty = qi.quantity || 1;
                        console.log("[quote] addon:", qi.code, "→", addonInfo ? addonInfo.name : "NOT FOUND", "price:", addonPrice);
                        if (addonPrice > 0 || addonInfo) {
                            quoteItems.push({
                                name: qi.name || (addonInfo ? addonInfo.name : qi.code),
                                spec: '추가 옵션',
                                qty, unit_price: addonPrice, total: addonPrice * qty,
                                _code: qi.code, _width_mm: 0, _height_mm: 0, is_addon: true
                            });
                        }
                        continue;
                    }
                    const dbP = products.find((p: any) => p.code === qi.code);
                    console.log("[quote] matching", qi.code, "→", dbP ? dbP.name : "NOT FOUND");
                    if (!dbP) continue;
                    const wMm = qi.width_mm || dbP.width_mm || 0;
                    const hMm = qi.height_mm || dbP.height_mm || 0;
                    const area = (wMm * hMm) / 1000000;
                    const side = qi.side || 1;
                    // 면적 기반 가격 계산: DB price가 m²당 단가
                    const perSqm = dbP._raw_price || 0;
                    let unitPrice = dbP.is_custom_size ? Math.floor(area * perSqm * side / 100) * 100 : (dbP._raw_price || 0);
                    // ★ 최소금액 10,000원 (모든 제품 공통, 21355677 제외)
                    if (qi.code !== '21355677' && unitPrice < 10000) unitPrice = 10000;
                    console.log("[quote] price calc:", qi.code, "area:", area, "→ unitPrice:", unitPrice);
                    const qty = qi.quantity || 1;
                    quoteItems.push({
                        name: qi.name || dbP.name,
                        spec: `${wMm}x${hMm}mm` + (side === 2 ? ' 양면' : ''),
                        qty, unit_price: unitPrice, total: unitPrice * qty,
                        _code: qi.code, _width_mm: wMm, _height_mm: hMm
                    });
                    // ★ 커팅 옵션: 자유인쇄커팅(hb_pt_), 등신대(hb_pi_) 등에만 추가
                    // 가벽(hb_dw_), 배너(hb_bn_)에는 커팅 없음!
                    const _isHoneycomb = (qi.code || '').startsWith('hb_');
                    const _needsCutting = _isHoneycomb && !(qi.code || '').startsWith('hb_bn') && !(qi.code || '').startsWith('hb_dw');
                    if (_needsCutting) {
                        const cutType = (qi.note || '').includes('모양') ? '모양커팅' : '사각 커팅';
                        const cutCode = cutType === '모양커팅' ? '23we324' : '3244234';
                        const cutPrice = cutType === '모양커팅' ? 3000 : 1000;
                        quoteItems.push({
                            name: cutType,
                            spec: '추가 옵션',
                            qty, unit_price: cutPrice, total: cutPrice * qty,
                            _code: cutCode, _width_mm: 0, _height_mm: 0, is_addon: true
                        });
                    }
                }
                // ★ 최소 주문금액 10,000원 전체 합계 체크 (addon 포함)
                let quoteTotal = quoteItems.reduce((s: number, i: any) => s + i.total, 0);
                if (quoteTotal < 10000 && !qItems.some((qi: any) => qi.code === '21355677')) {
                    // 메인 제품(addon 아닌 첫 번째)의 unit_price를 10,000원으로 올림
                    const mainItem = quoteItems.find((i: any) => !i.is_addon);
                    if (mainItem) {
                        const deficit = 10000 - quoteTotal + mainItem.total;
                        mainItem.unit_price = Math.ceil(deficit / (mainItem.qty || 1) / 100) * 100;
                        mainItem.total = mainItem.unit_price * mainItem.qty;
                    }
                }
                return {
                    type: "quote",
                    chat_message: qResult.summary || "견적서를 생성합니다.",
                    quote_data: { customer_name: qResult.customer_name || '', items: quoteItems },
                    products: qResult.products || []
                };
            }

            if (toolBlock) {
                const result = toolBlock.input;
                if (!result.chat_message) result.chat_message = result.summary || '';
                // AI가 반환한 제품 중 skip 대상 제거
                if (result.products && result.products.length > 0) {
                    result.products = result.products.filter((rec: any) => {
                        const dbP = products.find((p: any) => p.code === rec.code);
                        if (!dbP) return true; // DB에 없는 코드는 일단 유지
                        return !_skipSubCats.has(dbP.category) && !_skipProductCodes.has(rec.code);
                    });
                }
                let hasProducts = result.products && result.products.length > 0;
                // fallback: AI가 products 비워놓고 summary에 제품 설명만 한 경우 → 텍스트 매칭으로 카드 주입
                if (!hasProducts) {
                    const _comb = (trimmedMsg + ' ' + (result.summary || '') + ' ' + (result.chat_message || '')).toLowerCase();
                    const _isContact = ['전화','연락처','번호','phone','call','contact','메일','email'].some(k => _comb.includes(k));
                    // 디자인 의뢰/마켓 관련 → fallback 상품 주입 스킵 (AI의 디자인마켓 안내를 보존)
                    const _isDesignRequest = ['디자인 의뢰','디자인 맡기','디자인 해줘','디자이너','design help','need a designer','design market','デザイン依頼','デザイナー','design-market'].some(k => _comb.includes(k));
                    if (!_isContact && !_isDesignRequest) {
                        // 1차: 제품명(한/영/일) + 카테고리 매칭 (3글자 이상만, 일반 단어 제외)
                        const _commonWords = new Set(['인쇄','출력','제품','상품','가격','사이즈','주문','배송','디자인','printing','product','price','order','size','design','印刷','商品','価格','サイズ','注文','配送','デザイン','원판','도매','wholesale','大判']);
                        let _m = aiProducts.filter((p: any) => {
                            const rp = rawProducts.find((r: any) => r.code === p.code);
                            const names = [p.name || '', rp?.name_us || '', rp?.name_jp || '', p.category || ''];
                            return names.some((n: string) => n.split(/\s+/).filter((w: string) => w.length >= 3 && !_commonWords.has(w.toLowerCase())).some((kw: string) => _comb.includes(kw.toLowerCase())));
                        }).slice(0, 5);
                        // 2차: 다국어 키워드 → 카테고리 매칭 (아랍어/중국어 등 비라틴 언어 대응)
                        if (_m.length === 0) {
                            // 키워드 → 서브카테고리 직접 매칭 (대표 제품만 추천)
                            const _subCatKeywords: [string[], string[]][] = [
                                // [keywords, subcategory codes]
                                [['معرض','展示','booth','exhibition','exposición','exposition','ausstellung','展位','كشك','جناح','honeycomb','ハニカム','هاني'], ['hb_display_wall','hb_tree','hb_table','hb_point','hb_insta','34535354']],
                                [['بوابة','gate','ゲート'], ['hb_tree']],
                                [['جدار','قاطع','partition','wall','パーティション','가벽'], ['hb_display_wall']],
                                [['طاولة','table','テーブル','mesa','tisch','桌'], ['hb_table']],
                                [['banner','バナー','横幕','pancarta','bannière','横断幕','لافتة'], ['hb_banner','banner','75001']],
                                [['fabric','ファブリック','قماش','布料','tissu','tela','Stoff','canvas','キャンバス','帆布'], ['ch10s','cn16s','obo10s','lin20s']],
                                [['keyring','キーリング','ميدالية','钥匙扣'], ['acr_key_ring']],
                                [['sticker','ステッカー','ملصق','贴纸'], ['pp_sticker']],
                                [['print','印刷','طباعة','printing'], ['pp_leaflet','pp_poster','pp_business_card']],
                                [['acrylic','アクリル','أكريليك','亚克力'], ['acrylic']],
                            ];
                            for (const [keywords, subCats] of _subCatKeywords) {
                                if (keywords.some(k => _comb.includes(k.toLowerCase()))) {
                                    _m = aiProducts.filter((p: any) => subCats.includes(p.category)).slice(0, 5);
                                    if (_m.length > 0) break;
                                }
                            }
                        }
                        if (_m.length > 0) {
                            result.products = _m.map((p: any) => {
                                const rp = rawProducts.find((r: any) => r.code === p.code);
                                const ac = rp?.addons ? rp.addons.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
                                return { code: p.code, name: p.name, img_url: p.img_url || '', _raw_price_krw: p._raw_price, _raw_per_sqm_krw: p._raw_per_sqm, is_custom_size: p.is_custom_size, addons: ac.map((c: string) => addonMap[c]).filter(Boolean) };
                            });
                            hasProducts = true;
                        }
                    }
                }
                result.type = hasProducts ? "recommendation" : "chat";
                if (!hasProducts) result.products = [];
                result._model = model;

                // img_url 보강: AI가 잘못된 URL을 줄 수 있으므로 항상 DB 우선
                if (result.products) {
                    result.products.forEach((rec: any) => {
                        const dbProduct = products.find(p => p.code === rec.code);
                        if (dbProduct) {
                            rec.img_url = dbProduct.img_url || rec.img_url || '';
                            rec._raw_price_krw = dbProduct._raw_price;
                            rec._raw_per_sqm_krw = dbProduct._raw_per_sqm;
                            rec.is_custom_size = dbProduct.is_custom_size;
                            // addon 정보 보강
                            if (dbProduct.addons) {
                                const addonCodes = dbProduct.addons.split(',').map((c: string) => c.trim()).filter(Boolean);
                                rec.addons = addonCodes.map((c: string) => addonMap[c]).filter(Boolean);
                            }
                        }
                    });
                }

                return result;
            }

            const textParts = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text);
            const textResult: any = { type: "chat", chat_message: textParts.join("\n") || "...", products: [], _model: model };
            // 텍스트 응답에서 제품명 매칭 시 카드 주입 (디자인 의뢰/일반 단어 제외)
            const _combined = (trimmedMsg + ' ' + textResult.chat_message).toLowerCase();
            const _isContactMsg = ['전화','연락처','번호','phone','call','contact','메일','email'].some(k => _combined.includes(k));
            const _isDesignMsg = ['디자인 의뢰','디자인 맡기','디자인 해줘','디자이너','design help','need a designer','design market','デザイン依頼','デザイナー','design-market'].some(k => _combined.includes(k));
            if (!_isContactMsg && !_isDesignMsg) {
                const _commonWords2 = new Set(['인쇄','출력','제품','상품','가격','사이즈','주문','배송','디자인','printing','product','price','order','size','design','印刷','商品','価格','サイズ','注文','配送','デザイン','원판','도매','wholesale','大判']);
                const _matched = aiProducts.filter((p: any) => {
                    const rp = rawProducts.find((r: any) => r.code === p.code);
                    const names = [p.name || '', rp?.name_us || '', rp?.name_jp || '', p.category || ''];
                    return names.some((n: string) => n.split(/\s+/).filter((w: string) => w.length >= 3 && !_commonWords2.has(w.toLowerCase())).some((kw: string) => _combined.includes(kw.toLowerCase())));
                }).slice(0, 3);
                if (_matched.length > 0) {
                    textResult.products = _matched.map((p: any) => {
                        const rp = rawProducts.find((r: any) => r.code === p.code);
                        const ac = rp?.addons ? rp.addons.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
                        return { code: p.code, name: p.name, img_url: p.img_url || '', _raw_price_krw: p._raw_price, _raw_per_sqm_krw: p._raw_per_sqm, is_custom_size: p.is_custom_size, addons: ac.map((c: string) => addonMap[c]).filter(Boolean) };
                    });
                    textResult.type = "recommendation";
                }
            }
            return textResult;
        }

        const result = await callClaude("claude-haiku-4-5-20251001");
        result._v = "2026-03-03-v10-kapu-smart";

        // 연락처 관련 질문 감지 → 프로그래밍적 보장
        const msgLower = trimmedMsg.toLowerCase();
        const JP_DENWA = String.fromCharCode(0x96FB, 0x8A71);
        const JP_RENRAKU = String.fromCharCode(0x9023, 0x7D61);
        const JP_TOIAWASE = String.fromCharCode(0x554F, 0x3044, 0x5408, 0x308F, 0x305B);
        const JP_MAIL = String.fromCharCode(0x30E1, 0x30FC, 0x30EB);
        const isContactQuery = ['전화','연락처','번호','phone','call','contact','메일','email','이메일'].some(k => msgLower.includes(k))
            || [JP_DENWA, JP_RENRAKU, JP_TOIAWASE, JP_MAIL].some(k => trimmedMsg.includes(k));
        if (isContactQuery) {
            const chatMsg = result.chat_message || result.summary || '';
            const contactInfos: Record<string, string> = {
                kr: "\n\n📞 매니저 직통번호:\n• 지숙: 010-3455-1946\n• 은미: 010-7793-5393\n• 성희: 010-3490-3328\n📦 출고실(파손/출고/시스템 문의):\n• 이선율 팀장: 010-7610-3455\n• 변지웅 부사장: 010-5512-5366\n🕐 영업시간: 평일 09:00~18:00 (점심 12:00~13:00)\n📧 대용량 파일: design@chameleon.design\n💬 카푸는 24시간 운영됩니다!",
                ja: "\n\n📞 お電話: 047-712-1148\n📧 メール: design@chameleon.design\n🕐 営業時間: 平日 09:00〜18:00（土日祝休み）\n💬 カプは24時間対応！",
                us: "\n\n📧 Email: design@chameleon.design\n🕐 Hours: Weekdays 09:00-18:00 (EST)\n💬 Kapu is available 24/7!",
            };
            const hasContact = chatMsg.includes('010-') || chatMsg.includes('047-') || chatMsg.includes('support@');
            if (!hasContact) {
                result.chat_message = chatMsg + (contactInfos[clientLang] || contactInfos['us']);
            }
        }

        // ★ 채팅방 찾기/생성 (동기 — 중복 방 방지)
        const _sid = session_id || '';
        const _lang = clientLang;
        const custNameMap: Record<string,string> = { kr: '웹 고객', ja: 'ウェブ顧客', us: 'Web Customer' };
        const defaultName = custNameMap[_lang] || '웹 고객';
        const custName = clientCustName
            ? (clientCustName + (clientCustPhone ? ' | ' + clientCustPhone : ''))
            : defaultName;
        let roomId = '';

        try {
            // 1순위: 클라이언트가 보낸 room_id (확실한 캐시)
            if (clientRoomId) {
                roomId = clientRoomId;
                // 고객이 이름을 입력했으면 기존 방 이름 업데이트
                if (clientCustName) {
                    await sb.from('chat_rooms').update({ customer_name: custName }).eq('id', roomId);
                }
                console.log("[chat] reusing client room_id:", roomId);
            }
            // 2순위: source 필드로 검색
            if (!roomId && _sid) {
                const { data: rooms, error: findErr } = await sb.from('chat_rooms')
                    .select('id').eq('source', 'bot-' + _sid)
                    .order('created_at', { ascending: false }).limit(1);
                if (!findErr && rooms && rooms.length > 0) {
                    roomId = rooms[0].id;
                    console.log("[chat] found existing room:", roomId);
                }
            }
            // 3순위: 새 방 생성
            if (!roomId) {
                const { data: newRoom, error: createErr } = await sb.from('chat_rooms').insert({
                    customer_name: custName, status: 'ai_chatting',
                    source: _sid ? 'bot-' + _sid : 'chatbot',
                    site_lang: _lang, assigned_manager: '',
                }).select('id').single();
                if (createErr) console.error("[chat] room create error:", createErr);
                if (newRoom) { roomId = newRoom.id; console.log("[chat] created new room:", roomId); }
            }
        } catch (roomErr: any) { console.error("Room find/create error:", roomErr.message); }

        // ★ 로그 + 메시지 저장 (비동기 — 응답 지연 없음)
        const _trimmedMsg = trimmedMsg;
        const _resultMsg = (result.chat_message || result.summary || '').substring(0, 3000);
        const _products = result.products && result.products.length > 0
            ? result.products.map((p: any) => ({ code: p.code, name: p.name, price: p.price_display || '', img: p.img_url || '' })) : null;
        const _hasImage = !!image;
        const _roomId = roomId;

        // 상담사 연결 추천 감지 (학습 필요한 질문)
        const _needsLearning = /상담사|상담원|매니저|담당자|consultant|agent|担当|接続|스태프|contact you|team will|our team|callback|コールバック|请联系|contactar|kontaktieren|contacter/.test(_resultMsg)
            || /확인.*후.*답변|정확.*안내|도와드리|お手伝い|help you|get back to you|will assist|연락.*드리/.test(_resultMsg);

        (async () => {
            try {
                // 1) Q&A 로그
                await sb.from("advisor_qa_log").insert({
                    lang: _lang, customer_message: _trimmedMsg || '(image)',
                    ai_response: _resultMsg,
                    products_recommended: _products ? _products.map((p: any) => ({ code: p.code, name: p.name })) : null,
                    has_image: _hasImage,
                    needs_learning: _needsLearning,
                    room_id: _roomId || null,
                });

                // 2) chat_messages (개별 insert — realtime 트리거)
                if (_roomId) {
                    const now = new Date();
                    // 고객 이미지 → Storage 업로드
                    let _custFileUrl = '';
                    let _custFileName = '';
                    if (_hasImage && image) {
                        try {
                            const ext = (image_type || 'image/jpeg').split('/')[1] || 'jpg';
                            const path = `chat_images/${_roomId}_${Date.now()}.${ext}`;
                            const imgBuf = Uint8Array.from(atob(image), c => c.charCodeAt(0));
                            const { error: upErr } = await sb.storage.from('orders').upload(path, imgBuf, { contentType: image_type || 'image/jpeg' });
                            if (!upErr) {
                                const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                                _custFileUrl = urlData?.publicUrl || '';
                                _custFileName = `image.${ext}`;
                            }
                        } catch(ue) { console.error('Image upload error:', ue); }
                    }
                    // 고객 메시지
                    const custMsgData: any = {
                        room_id: _roomId, sender_type: 'customer', sender_name: custName,
                        message: _trimmedMsg || '(이미지)', created_at: new Date(now.getTime() - 1000).toISOString(),
                    };
                    if (_custFileUrl) {
                        custMsgData.file_url = _custFileUrl;
                        custMsgData.file_name = _custFileName;
                    }
                    await sb.from('chat_messages').insert(custMsgData);
                    // AI 텍스트 응답 + 제품 카드 데이터
                    let botMsg = _resultMsg;
                    if (_products && _products.length > 0) {
                        // JSON 블록으로 제품 데이터 포함 (관리자 렌더링용)
                        botMsg += '\n<!--PRODUCTS:' + JSON.stringify(_products) + '-->';
                    }
                    await sb.from('chat_messages').insert({
                        room_id: _roomId, sender_type: 'chatbot', sender_name: 'AI 카푸',
                        message: botMsg, created_at: now.toISOString(),
                    });
                    await sb.from('chat_rooms').update({ updated_at: now.toISOString() }).eq('id', _roomId);
                }
            } catch (e: any) { console.error("Async log error:", e.message); }
        })();

        // room_id를 응답에 포함
        if (roomId) result.room_id = roomId;

        return new Response(
            JSON.stringify(result),
            { headers: { ...cors, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Product Advisor Error:", error);
        const errMsgs: Record<string, string> = {
            kr: "앗, 잠깐 오류가 생겼네요 😅 다시 한번 말씀해 주시겠어요? 아니면 아래 📞 연락 요청하기 버튼을 눌러 연락처를 남겨주시면 담당자가 확인 후 연락드릴게요!",
            ja: "申し訳ございません、エラーが発生しました😅 もう一度お試しいただけますか？または📞 連絡リクエストボタンを押して連絡先を残してください！担当者が確認後ご連絡いたします。",
            us: "Oops, something went wrong on my end 😅 Could you try again? Or click the 📞 Request Callback button to leave your number — our team will get back to you!",
        };
        let errKey = (reqBody?.lang || 'kr').toLowerCase();
        if (errKey === 'en') errKey = 'us';
        return new Response(
            JSON.stringify({ type: "chat", chat_message: errMsgs[errKey] || errMsgs['kr'], products: [] }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }
});
