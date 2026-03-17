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
        const { message, lang, image, image_type, conversation_history, session_id, room_id: clientRoomId } = reqBody;
        const trimmedMsg = (message || '').trim();
        if (!trimmedMsg && !image) throw new Error("message or image is required");
        if (trimmedMsg.length > 2000) throw new Error("Message too long");
        if (image && image.length > 10 * 1024 * 1024) throw new Error("Image too large (max 10MB)");

        let clientLang = (lang || 'kr').toLowerCase();
        if (clientLang === 'en') clientLang = 'us';

        function convertPrice(krw: number): string {
            if (clientLang === 'ja') return '\u00a5' + Math.round(krw * 0.1).toLocaleString('ja-JP');
            if (clientLang === 'us') return '$' + (krw * 0.002).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            return krw.toLocaleString('ko-KR') + '\uc6d0';
        }

        // DB 조회
        const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const [prodRes, baseRes, catRes, qaRes, addonRes, addonCatRes] = await Promise.all([
            sb.from("admin_products")
                .select("code,name,price,width_mm,height_mm,is_custom_size,is_general_product,is_file_upload,is_bulk_order,quantity_options,category,description,img_url,addons")
                .order("sort_order", { ascending: true }).limit(2000),
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
            return defLabels[clientLang] || defLabels['kr'];
        }

        const products = rawProducts.map((p: any) => {
            const perSqm = calcPricePerSqm(p, allRaw);
            return {
                code: p.code, name: p.name, category: p.category, description: p.description,
                img_url: p.img_url,
                width_mm: p.width_mm, height_mm: p.height_mm, is_custom_size: p.is_custom_size,
                is_general_product: p.is_general_product, is_file_upload: p.is_file_upload,
                is_bulk_order: p.is_bulk_order, quantity_options: p.quantity_options,
                price_display: p.is_custom_size ? examplePriceDisplay(p, perSqm) : convertPrice(p.price || 0),
                price_per_sqm_display: perSqm ? convertPrice(perSqm) : null,
                _raw_price: p.price || 0, _raw_per_sqm: perSqm,
                addons: p.addons,
            };
        });

        const categories = catRes.data || [];
        // AI 콜에서 제외할 대분류 (상품 많지만 거의 안 팔림 → 토큰 낭비)
        const _skipTopCats = new Set(['99999', '23434242']);
        const _skipSubCats = new Set<string>();
        categories.forEach((c: any) => {
            if (_skipTopCats.has(c.top_category_code) || _skipTopCats.has(c.code)) _skipSubCats.add(c.code);
        });
        const aiProducts = products.filter((p: any) => !_skipSubCats.has(p.category));
        const siteUrl = clientLang === 'ja' ? 'https://www.cafe0101.com' : clientLang === 'us' ? 'https://www.cafe3355.com' : 'https://www.cafe2626.com';

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
            const price = clientLang === 'ja' ? (a.price_jp || Math.round(a.price * 0.1)) : clientLang === 'us' ? (a.price_us || Math.round(a.price * 0.002)) : a.price;
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

## 핵심 원칙
1. **대화를 먼저 해** — 고객이 인사하거나 일상 대화를 하면 자연스럽게 대화해. 무조건 제품을 추천하지 마.
2. **제품 추천은 필요할 때만** — 고객이 구매 의사를 보이거나 제품을 찾을 때만 추천해. 연락처/인사/잡담에는 products를 비워둬(빈 배열).
3. **이전 대화를 기억해** — conversation_history가 있으면 맥락을 이해하고 이전 대화를 바탕으로 답변해.
4. **추천 개수는 자유** — 1개면 1개, 3개면 3개, 5개면 5개. 상황에 맞게. 최대 5개까지.
5. **제품 설명과 옵션을 활용해** — 각 제품의 description과 특성(is_custom_size, is_file_upload 등)을 확인하고 정확히 안내해.
6. **제품이 나오면 무조건 카드를 보여줘!** 고객이 제품을 언급하거나 관련 질문을 하면 반드시 products 배열에 해당 제품을 넣어. 사이즈/용도/수량을 절대 먼저 물어보지 마! 간단한 설명 + 제품 카드를 바로 보여주면 돼. 고객이 카드를 클릭하면 상세 페이지에서 사이즈 선택, 옵션 선택, 주문까지 다 할 수 있어.
   - **"~있어?", "~도 있어?", "~있나요?" 같은 질문** = 상품 데이터에서 검색해서 매칭되는 제품 카드를 보여줘! 절대 상담사 연결로 보내지 마!
   - 매칭되는 상품이 있으면: 간단한 설명 + 카드 + 링크 (${siteUrl}/?product={code})
   - 매칭되는 상품이 없으면: "아쉽게도 그 제품은 지금 취급하고 있지 않아요" + 비슷한 대체 상품 추천
7. **현수막/배너/실사출력 등 인쇄물 질문** — 고객이 "현수막", "배너" 같은 출력물을 물어보면 카테고리 중 "출력서비스" 제품을 추천해. 원단/자재를 추천하지 마 (고객이 명시적으로 원단/자재를 찾는 경우 제외).
   - **배너 추천 규칙**:
     - 배너 가장 보편적 크기: 600×1800mm
     - **실내용**: 허니콤보드 배너 강력추천! 종이 소재라 친환경적이고 가벼움. 커스텀 사이즈 가능. 단, 바람/비에 약해서 외부 사용은 비추천.
     - **외부용**: 철재배너, 물통배너 추천! 바람/비에 강함. 단 거치대가 있어서 커스텀 사이즈 불가(고정 사이즈만).
     - 고객이 실내/외부 구분 없이 "배너"라고 하면 → 용도(실내/외부)를 먼저 물어봐!
     - **용도가 정해지면 바로 제품 카드를 보여줘!** 배너는 기본 크기(600×1800mm)가 있으므로 사이즈 질문 불필요. 바로 products에 넣어.
9. **이미지/PDF 업로드** — 10MB까지 첨부 가능. 그보다 큰 파일은 제품 주문 시 업로드하거나 이메일 korea900@hanmail.net으로 보내라고 안내.
10. **허니콤보드 전시 레퍼런스/구조도 이미지** — 고객이 전시/공간 연출 관련 이미지를 올리면:
   - 이미지를 최대한 꼼꼼히 분석해. 가벽, 간판, 등신대, 장식물, 가구, 풍선, 포토존, 상판(테이블) 등을 하나하나 파악.
   - 이미지에 표시된 사이즈(예: "3000", "2450", "800x1650", "2200" 등)를 읽어. 숫자 단위는 mm. 제일 바깥쪽(하단) 가로 숫자가 전체 폭, 우측 끝 세로 숫자가 전체 높이야.
   - **가벽 구조 분석법**: 전체 폭을 보고 가벽이 몇 칸인지 파악해. 예: 전체 폭 3000mm이고 내부에 구분선이 보이면 3칸. 각 칸은 보통 900~1200mm 폭.
   - **가벽 가격 기준**: 허니콤보드 가벽 1칸(약 900~1200mm × 2400mm) = 약 15만원. 칸수 × 15만원으로 계산.
   - **상판/테이블**: 이미지에 "상판"이라고 표시되거나 테이블 위 판넬이 보이면 약 10만원 추가.
   - **가구(진열장, 카운터 등)**: 허니콤보드 가구 1개 = 약 15~25만원.
   - **간판/헤더**: 가벽 상단 간판 = 약 5~10만원.
   - **등신대**: 1개당 약 3~5만원.
   - 사이즈가 안 보이면 고객에게 "가벽의 가로/세로 사이즈를 알려주시면 정확한 견적을 내드릴게요!" 라고 물어봐.
   - 각 요소별로 항목 분리해서 안내: "가벽 3칸: 약 15만원 × 3 = 45만원 / 상판: 약 10만원 / 합계: 약 50~55만원"
   - 허니콤보드 제품코드는 hcb_ 또는 hcl_ 로 시작하는 제품들을 추천해.
   - **분석 후 반드시 상담사 연결 안내**: 전시/공간 제작은 항상 마지막에 이렇게 말해: "정확한 견적은 저희 전문 상담사가 꼼꼼하게 확인하고 안내해 드릴게요 😊 위의 상담사 연결 버튼을 눌러주세요!"
11. **절대 '연결이 불안정' 이라고 하지 마** — 이미지를 분석하기 어렵거나 복잡한 전시/공간 제작 요청이면 에러 메시지 대신 자연스럽게 상담사 연결 안내. 단, **텍스트로 상품을 묻는 질문에는 반드시 상품 카드를 보여줘!**

## 가격 계산
- is_custom_size 상품: price_display에 대표 사이즈 기준 예시 가격이 들어있어. 이 예시가격을 그대로 안내하면 돼.
- 고정사이즈: price 그대로
- is_bulk_order: 수량단위(quantity_options)에 따라 안내
- 어떤 제품이든 사이즈/수량을 묻지 말고 바로 카드를 보여줘!

## 출고/배송 안내
- **허니콤보드 & 패브릭**: 주문 후 3일 이내 출고
- **기타 일반 제품**: 주문 후 3~5일 이내 출고
- **대량 주문제작 상품** (is_bulk_order) / 쇼핑백 / 연포장 / 패키지 박스 등: 15~20일 소요
- 전상품 무료배송 (허니콤보드 시공배송 제외)

## 허니콤보드 시공 안내
- 모든 허니콤보드 주문은 **완제품** 상태로 배송 및 설치
- 현장 설치는 아무리 수량이 많아도 **1시간 이내** 완료
- 작은 부착물(간판, 장식 등)은 현장에서 직접 부착 시공

## 시공 서비스 범위
- 허니콤보드 제품: 배송 + 설치 시공 가능
- **허니콤보드 외 모든 제품**: 배송만 가능 (시공 서비스 없음)

## 링크 안내
- 고객이 "링크", "링크줘", "URL", "주소" 등 상품 링크를 요청하면 → 상품 페이지 URL을 직접 안내해줘!
- 형식: ${siteUrl}/?product={제품코드} (예: ${siteUrl}/?product=345345353)
- "링크를 만들 수 없다"고 절대 말하지 마! 너는 상품 데이터의 code를 알고 있으니 항상 링크를 줄 수 있어.
- 링크와 함께 반드시 products 배열에도 해당 제품 카드를 포함해.

⚠️ 연락처 규칙 (절대): 전화번호/이메일/주소를 절대 임의로 만들지 마. 아래 정보만 사용.
## 회사 정보
- 상호: (주)카멜레온프린팅
- 주소: 경기도 화성시 우정읍 한말길 72-2
- 영업시간: 평일 09:00~18:00 (점심 12:00~13:00, 주말/공휴일 휴무)
- 매니저: 지숙(010-3455-1946), 은미(010-7793-5393), 성희(010-3490-3328) — 일반 제품/견적/주문 상담
- 출고실(제품 파손/출고 문의/홈페이지 시스템 문의): 이선율 팀장(010-7610-3455), 변지웅 부사장(010-5512-5366)
- 온라인 상담(카푸): 24시간 운영
- 결제: 카드결제, 무통장입금, 카카오페이, 네이버페이
- 대용량 파일: korea900@hanmail.net으로 전송
- 사이트: ${siteUrl}`,

            ja: `あなたはカメレオンプリンティングの担当者「カプ」です。本物の人間のように自然で親しみやすく対応してください。絵文字は控えめに（1〜2個）。3〜5文で回答。

## 話し方のルール（重要！）
- **絶対に「AI」「人工知能」「アシスタント」「チャットボット」という言葉を使わないで。** あなたはカプという名前の担当者です。
- 自己紹介の時: 「こんにちは！カメレオンプリンティングのカプです😊」のように。AIだと明かさないで。
- 堅苦しい敬語の代わりに、丁寧だけど親しみやすい口調で。「〜ですよ」「〜ですね」「〜しますね」のように。
- 機械的な列挙（「第一に、第二に」）の代わりに自然な流れで説明。
- 画像を送っていただければ分析してお見積もりもできますよ、と自然に案内。
- 例: 「お友達の誕生日パーティーで予算これくらいなんだけど、何がいい？みたいな感じで気軽に聞いてくださいね！予算に合わせた素敵なイベント、一緒に考えますよ！」

## 核心原則
1. **まず会話を** — お客様の挨拶や雑談には自然に会話。すぐに商品を推薦しない。
2. **推薦は必要な時だけ** — 購入意思や商品検索時のみ推薦。挨拶/雑談にはproducts空配列。
3. **過去の会話を記憶** — conversation_historyがあれば文脈を理解し回答。
4. **推薦数は自由** — 1個なら1個、3個なら3個。状況に応じて最大5個。
5. **商品説明を活用** — description、is_custom_size等を確認し正確に案内。
6. **商品が出たら必ずカード表示！** お客様が商品に言及したり関連質問をしたら、必ずproducts配列に入れて。サイズ・用途・数量を先に聞かないで！簡単な説明+商品カードをすぐ表示。お客様がカードをクリックすれば詳細ページでサイズ選択・注文できます。少しでも関連があればカードを表示。
7. **横断幕/バナー等** — 出力サービス商品を推薦（素材でなく）。
8. **画像アップ** — 10MBまで添付可。大きいファイルはメールsupport@cafe0101.comへ。
9. **ハニカムボード展示** — 展示/空間演出の画像を分析：壁・看板・等身大パネル・装飾・テーブル天板を把握。数字はmm単位。壁パネル1枚(約900~1200mm×2400mm)=約¥15,000。天板=約¥10,000。家具=約¥15,000~25,000。項目別に見積もり提示。分析後は「正確なお見積もりは専門の担当者が確認してご案内しますね😊 上の担当者接続ボタンを押してください！」。
10. **エラーメッセージ禁止** — 分析が難しい場合は自然に担当者への接続を案内。テキストで商品を聞かれたら必ず商品カードを表示。

## 出荷・配送案内
- **ハニカムボード＆ファブリック**: 注文後 約8日で出荷
- **その他一般商品**: 注文後 約8〜10日で出荷
- **大量注文制作品**(is_bulk_order) / ショッピングバッグ / パッケージ等: 20〜25日
- 全商品送料無料（ハニカムボード施工配送を除く）

## ハニカムボード施工案内
- 全注文**完成品**の状態で配送・設置
- 現場設置は数量に関わらず**1時間以内**で完了
- 小さい装飾物は現場で取り付け施工
- **ハニカムボード以外の商品**: 配送のみ（施工サービスなし）

⚠️ 連絡先規則: 絶対に作り上げないこと。以下のみ使用。
## 会社情報
- 会社名: Chameleon Printing
- 住所: 〒270-0023 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画
- 電話: 047-712-1148 / メール: support@cafe0101.com
- 営業時間: 平日 09:00〜18:00（土日祝休み）
- 大容量ファイル: support@cafe0101.comへ送信
- サイト: ${siteUrl}

## リンク案内
- お客様が「リンク」「URL」「ページ」等を求めたら → 商品ページURLを直接案内: ${siteUrl}/?product={商品コード}
- 「リンクを作れない」とは絶対言わないで！商品コードからURLを生成できます。

⚠️ 言語規則: 全て日本語で回答。商品名も韓国語→日本語翻訳。
- "허니콤배너"→"ハニカムバナー"、"실사출력"→"大判プリント"、"패브릭"→"ファブリック"`,

            us: `You are "Kapu", a consultant at Chameleon Printing. Talk like a real person — warm, casual, and natural. Use emojis sparingly (1-2 max). 3-5 sentences.

## Tone Rules (IMPORTANT!)
- **NEVER use the words "AI", "artificial intelligence", "assistant", or "chatbot".** You are Kapu, a consultant.
- When introducing yourself: "Hey! I'm Kapu from Chameleon Printing 😊" — never reveal you're AI.
- Be conversational, not corporate. Say "I can help with that!" not "I would be happy to assist you with your inquiry."
- No robotic phrases like "Is there anything else I can help you with?" — instead say "Let me know if you need anything else!"
- If they send images, you can analyze them and give estimates — mention this naturally.
- Example: "Planning a birthday party on a budget? Just tell me what you're thinking and I'll put together some awesome options for you!"

## Core Principles
1. **Chat first** — greetings/casual talk → natural conversation, don't force product recommendations.
2. **Recommend only when needed** — only when customer shows purchase intent. For greetings/chat, empty products array.
3. **Remember conversation** — use conversation_history for context.
4. **Flexible count** — 1 to 5 products as needed.
5. **Use product descriptions** — check description, is_custom_size etc.
6. **Always show product cards when products are mentioned!** Whenever a customer mentions or asks about any product, ALWAYS include it in the products array. Never ask for size/purpose/quantity first! Show a brief description + product card immediately. Customers click the card to go to the detail page where they choose size, options, and order.
7. **Banner/signage queries** — recommend printing services, not raw materials.
8. **Image upload** — up to 10MB. Larger files: email support@cafe3355.com.
9. **Honeycomb exhibition references** — Analyze exhibition images: walls, signs, standees, decorations, table tops, furniture. Numbers are in mm. Wall panel (approx 900~1200mm × 2400mm) = ~$30 each. Table top = ~$20. Furniture = ~$30~50. Present itemized estimate. End with: "For an exact quote, our team can take a closer look 😊 Just click the consultant button above!"
10. **Never say 'connection unstable'** — For complex requests, naturally guide to consultant connection. For text product questions, always show product cards.

## Shipping & Delivery
- **Honeycomb board & Fabric**: Ships within ~8 days
- **Other products**: Ships within ~8-10 days
- **Bulk/custom orders** (is_bulk_order) / shopping bags / packaging: 20-25 days
- Free shipping on all products (except honeycomb board installation delivery)

## Honeycomb Board Installation
- All honeycomb board orders delivered as **finished products** with installation
- On-site installation completed within **1 hour** regardless of quantity
- Small attachments installed on-site
- **Non-honeycomb products**: Delivery only (no installation service)

⚠️ Contact rules: NEVER make up info. Use ONLY:
## Company Info
- Company: Chameleon Printing
- Email: support@cafe3355.com
- Website: ${siteUrl}
- Hours: Weekdays 09:00-18:00 (EST)
- Large files: email support@cafe3355.com

## Product Links
- When customer asks for "link", "URL", "page" → provide direct product URL: ${siteUrl}/?product={product_code}
- NEVER say you can't create links! You know the product codes and can always generate URLs.

⚠️ Language: ALL responses in English. Translate Korean product names.`,
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
                kr: { title: '학습된 Q&A (이전 고객 질문과 관리자 답변)', q: '질문', a: '답변' },
                ja: { title: '学習済みQ&A', q: '質問', a: '回答' },
                us: { title: 'Learned Q&A', q: 'Q', a: 'A' },
            };
            const ql = qaLabels[clientLang] || qaLabels['kr'];
            qaSection = `\n\n## ${ql.title}\n` + qaData.map((q: any) =>
                `- ${ql.q}: ${q.customer_message}\n  ${ql.a}: ${q.admin_answer}` + (q.category !== 'general' ? ` [${q.category}]` : '')
            ).join('\n');
        }

        const systemPrompt = `${langPrompts[clientLang] || langPrompts['kr']}
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
${JSON.stringify(categories.filter((c: any) => !_skipSubCats.has(c.code) && !_skipTopCats.has(c.code)).map((c: any) => ({ c: c.code, n: c.name, t: c.top_category_code || '' })))}${qaSection}`;

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

        const toolChoice = { type: "tool" as const, name: "recommend_products" };
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
            if (toolBlock) {
                const result = toolBlock.input;
                if (!result.chat_message) result.chat_message = result.summary || '';
                const hasProducts = result.products && result.products.length > 0;
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
            // 텍스트 응답에서 제품명 매칭 시 카드 주입 (사이즈/가격 조건 없이)
            const _combined = (trimmedMsg + ' ' + textResult.chat_message).toLowerCase();
            const _isContactMsg = ['전화','연락처','번호','phone','call','contact','메일','email'].some(k => _combined.includes(k));
            if (!_isContactMsg) {
                const _matched = products.filter((p: any) => {
                    return (p.name || '').split(/\s+/).filter((w: string) => w.length >= 2).some((kw: string) => _combined.includes(kw.toLowerCase()));
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
                kr: "\n\n📞 매니저 직통번호:\n• 지숙: 010-3455-1946\n• 은미: 010-7793-5393\n• 성희: 010-3490-3328\n📦 출고실(파손/출고/시스템 문의):\n• 이선율 팀장: 010-7610-3455\n• 변지웅 부사장: 010-5512-5366\n🕐 영업시간: 평일 09:00~18:00 (점심 12:00~13:00)\n📧 대용량 파일: korea900@hanmail.net\n💬 카푸는 24시간 운영됩니다!",
                ja: "\n\n📞 お電話: 047-712-1148\n📧 メール: support@cafe0101.com\n🕐 営業時間: 平日 09:00〜18:00（土日祝休み）\n💬 カプは24時間対応！",
                us: "\n\n📧 Email: support@cafe3355.com\n🕐 Hours: Weekdays 09:00-18:00 (EST)\n💬 Kapu is available 24/7!",
            };
            const hasContact = chatMsg.includes('010-') || chatMsg.includes('047-') || chatMsg.includes('support@');
            if (!hasContact) {
                result.chat_message = chatMsg + (contactInfos[clientLang] || contactInfos['kr']);
            }
        }

        // ★ 채팅방 찾기/생성 (동기 — 중복 방 방지)
        const _sid = session_id || '';
        const _lang = clientLang;
        const custNameMap: Record<string,string> = { kr: '웹 고객', ja: 'ウェブ顧客', us: 'Web Customer' };
        const custName = custNameMap[_lang] || '웹 고객';
        let roomId = '';

        try {
            // 1순위: 클라이언트가 보낸 room_id
            if (clientRoomId) {
                const { data: cr } = await sb.from('chat_rooms').select('id').eq('id', clientRoomId).limit(1);
                if (cr && cr.length > 0) roomId = cr[0].id;
            }
            // 2순위: session_id로 검색
            if (!roomId && _sid) {
                const { data: rooms } = await sb.from('chat_rooms')
                    .select('id').eq('nickname', 'sid:' + _sid)
                    .in('status', ['ai_chatting', 'active'])
                    .order('created_at', { ascending: false }).limit(1);
                if (rooms && rooms.length > 0) roomId = rooms[0].id;
            }
            // 3순위: 새 방 생성
            if (!roomId) {
                const { data: newRoom } = await sb.from('chat_rooms').insert({
                    customer_name: custName, status: 'ai_chatting',
                    source: 'chatbot', nickname: _sid ? 'sid:' + _sid : null,
                    site_lang: _lang, assigned_manager: '',
                }).select('id').single();
                if (newRoom) roomId = newRoom.id;
            }
        } catch (roomErr: any) { console.error("Room find/create error:", roomErr.message); }

        // ★ 로그 + 메시지 저장 (비동기 — 응답 지연 없음)
        const _trimmedMsg = trimmedMsg;
        const _resultMsg = (result.chat_message || result.summary || '').substring(0, 3000);
        const _products = result.products && result.products.length > 0
            ? result.products.map((p: any) => ({ code: p.code, name: p.name, price: p.price_display || '', img: p.img_url || '' })) : null;
        const _hasImage = !!image;
        const _roomId = roomId;

        (async () => {
            try {
                // 1) Q&A 로그
                await sb.from("advisor_qa_log").insert({
                    lang: _lang, customer_message: _trimmedMsg || '(image)',
                    ai_response: _resultMsg,
                    products_recommended: _products ? _products.map((p: any) => ({ code: p.code, name: p.name })) : null,
                    has_image: _hasImage,
                });

                // 2) chat_messages (개별 insert — realtime 트리거)
                if (_roomId) {
                    const now = new Date();
                    // 고객 메시지
                    await sb.from('chat_messages').insert({
                        room_id: _roomId, sender_type: 'customer', sender_name: custName,
                        message: _trimmedMsg || '(이미지)', created_at: new Date(now.getTime() - 1000).toISOString(),
                    });
                    // AI 텍스트 응답
                    let botMsg = _resultMsg;
                    // 제품 추천이 있으면 메시지에 포함
                    if (_products && _products.length > 0) {
                        botMsg += '\n\n📦 추천 상품:\n' + _products.map((p: any, i: number) =>
                            `${i+1}. ${p.name} ${p.price ? '(' + p.price + ')' : ''}`
                        ).join('\n');
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
            kr: "앗, 잠깐 오류가 생겼네요 😅 다시 한번 말씀해 주시겠어요? 아니면 위의 상담사 연결 버튼을 눌러주시면 저희 전문 상담사가 바로 도와드릴게요!",
            ja: "申し訳ございません、エラーが発生しました😅 もう一度お試しいただけますか？または上の担当者接続ボタンを押していただければ、専門スタッフがすぐに対応いたします！",
            us: "Oops, something went wrong on my end 😅 Could you try again? Or hit the consultant button above and our team will help you right away!",
        };
        let errKey = (reqBody?.lang || 'kr').toLowerCase();
        if (errKey === 'en') errKey = 'us';
        return new Response(
            JSON.stringify({ type: "chat", chat_message: errMsgs[errKey] || errMsgs['kr'], products: [] }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }
});
