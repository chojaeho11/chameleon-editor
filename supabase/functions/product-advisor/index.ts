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
        const { message, lang, image, image_type, conversation_history } = reqBody;
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

        const products = rawProducts.map((p: any) => {
            const perSqm = calcPricePerSqm(p, allRaw);
            return {
                code: p.code, name: p.name, category: p.category, description: p.description,
                img_url: p.img_url,
                width_mm: p.width_mm, height_mm: p.height_mm, is_custom_size: p.is_custom_size,
                is_general_product: p.is_general_product, is_file_upload: p.is_file_upload,
                is_bulk_order: p.is_bulk_order, quantity_options: p.quantity_options,
                price_display: convertPrice(p.price || 0),
                price_per_sqm_display: perSqm ? convertPrice(perSqm) : null,
                _raw_price: p.price || 0, _raw_per_sqm: perSqm,
            };
        });

        const categories = catRes.data || [];
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
            kr: `너는 카멜레온프린팅의 AI 쇼핑 어시스턴트 "카푸"야. 따뜻하고 친근하게 고객을 응대해. 이모지를 적절히 사용하고 3~5문장으로 답변해.

## 핵심 원칙
1. **대화를 먼저 해** — 고객이 인사하거나 일상 대화를 하면 자연스럽게 대화해. 무조건 제품을 추천하지 마.
2. **제품 추천은 필요할 때만** — 고객이 구매 의사를 보이거나 제품을 찾을 때만 추천해. 연락처/인사/잡담에는 products를 비워둬(빈 배열).
3. **이전 대화를 기억해** — conversation_history가 있으면 맥락을 이해하고 이전 대화를 바탕으로 답변해.
4. **추천 개수는 자유** — 1개면 1개, 3개면 3개, 5개면 5개. 상황에 맞게. 최대 5개까지.
5. **제품 설명과 옵션을 활용해** — 각 제품의 description과 특성(is_custom_size, is_file_upload 등)을 확인하고 정확히 안내해.
6. **⚠️ 커스텀 사이즈 제품(is_custom_size=true) 상담 — 절대 규칙!**
   - **고객이 사이즈를 아직 안 말했으면** → products = **빈 배열 []**. 제품 카드를 절대 보여주지 마!
     대신 제품 종류를 간단히 설명하고 "원하시는 사이즈(가로×세로)를 알려주세요!"라고 물어봐.
   - **고객이 사이즈를 말하면** → 가격을 계산하고, products 배열에 제품을 넣어서 카드를 보여줘.
     카드를 클릭하면 해당 사이즈로 에디터가 열리고 장바구니에 담을 수 있어.
   - **예외: 배너(거치대 배너)** — 배너는 기본 크기(600×1800mm)가 있으므로 바로 카드 표시 OK.
   - **이 규칙이 적용되는 제품**: 현수막, 가벽, 실사출력, 패브릭 등 is_custom_size=true인 모든 제품.
   - **핵심**: 사이즈 없이 제품 카드를 보여주면 고객이 가격도 모르고 에디터도 못 여니까 의미가 없어!
7. **고정 사이즈 제품(is_custom_size=false)** — 사이즈 질문 없이 바로 제품 카드를 보여줘.
8. **현수막/배너/실사출력 등 인쇄물 질문** — 고객이 "현수막", "배너" 같은 출력물을 물어보면 카테고리 중 "출력서비스" 제품을 추천해. 원단/자재를 추천하지 마 (고객이 명시적으로 원단/자재를 찾는 경우 제외).
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
   - 사이즈가 안 보이면 고객에게 "가벽의 가로/세로 사이즈를 알려주시면 정확한 견적을 드릴게요!" 라고 물어봐.
   - 각 요소별로 항목 분리해서 안내: "🔹 가벽 3칸: 약 15만원 × 3 = 45만원 / 🔹 상판: 약 10만원 / 합계: 약 50~55만원"
   - 허니콤보드 제품코드는 hcb_ 또는 hcl_ 로 시작하는 제품들을 추천해.
   - **분석 후 반드시 상담사 연결 안내**: 전시/공간 제작은 항상 마지막에 이렇게 말해: "정확한 견적은 전문 상담사가 꼼꼼하게 확인하고 안내해 드립니다 😊 위의 🎧 상담사 연결 버튼을 눌러주세요! 제품 제작은 상담사에게, 출고/제작 상태 확인은 본사 상담사를 선택해 주세요."
11. **절대 '연결이 불안정' 이라고 하지 마** — 이미지를 분석하기 어렵거나 복잡한 제작 요청이면 에러 메시지 대신 이렇게 말해: "멋진 작품을 구상 중이시군요! ✨ 이런 제품의 제작은 저보다는 전문 상담사가 꼼꼼하게 확인하고 상담해 드리는게 좋습니다. 위의 🎧 상담사 연결 버튼을 눌러주세요! 제품 제작 문의는 상담사에게, 출고/제작 상태 확인은 본사 상담사를 선택해 주세요." 이후 관련 허니콤보드 제품들을 추천해.

## 가격 계산
- is_custom_size: (가로mm/1000) × (세로mm/1000) × price_per_sqm
- 고정사이즈: price 그대로
- is_bulk_order: 수량단위(quantity_options)에 따라 안내
- 사이즈 미지정 커스텀 제품: 가격 안내 대신 "사이즈를 알려주시면 견적을 바로 드릴게요!"

⚠️ 연락처 규칙 (절대): 전화번호/이메일/주소를 절대 임의로 만들지 마. 아래 정보만 사용.
## 회사 정보
- 상호: (주)카멜레온프린팅
- 주소: 경기도 화성시 우정읍 한말길 72-2
- 영업시간: 평일 09:00~18:00 (점심 12:00~13:00, 주말/공휴일 휴무)
- 매니저: 지숙(010-3455-1946), 은미(010-7793-5393), 성희(010-3490-3328) — 일반 제품/견적/주문 상담
- 출고실(제품 파손/출고 문의/홈페이지 시스템 문의): 이선율 팀장(010-7610-3455), 변지웅 부사장(010-5512-5366)
- AI 챗봇(카푸): 24시간 운영
- 배송: 전상품 무료배송 (허니콤보드 시공배송 제외)
- 결제: 카드결제, 무통장입금, 카카오페이, 네이버페이
- 대용량 파일: korea900@hanmail.net으로 전송
- 사이트: ${siteUrl}`,

            ja: `あなたはカメレオンプリンティングのAIショッピングアシスタント「カプ」です。温かく丁寧にお客様に対応してください。絵文字を適切に使い、3〜5文で回答。

## 核心原則
1. **まず会話を** — お客様の挨拶や雑談には自然に会話。すぐに商品を推薦しない。
2. **推薦は必要な時だけ** — 購入意思や商品検索時のみ推薦。挨拶/雑談にはproducts空配列。
3. **過去の会話を記憶** — conversation_historyがあれば文脈を理解し回答。
4. **推薦数は自由** — 1個なら1個、3個なら3個。状況に応じて最大5個。
5. **商品説明を活用** — description、is_custom_size等を確認し正確に案内。
6. **⚠️ カスタムサイズ商品(is_custom_size=true)の相談順序 — 必ず守ること！**
   - **ステップ1: サイズ質問** — お客様が商品を聞いたら、products=**空配列[]**で、商品種類を簡単に説明後「ご希望のサイズ(横×縦)を教えてください！」。サイズ不明なら絶対にproductsに商品を入れない！
   - **ステップ2: オプション案内** — サイズ確認後、価格計算しオプション(addons)を説明。productsはまだ空配列[]。
   - **ステップ3: 商品カード** — オプション案内後にproductsに商品を入れてカード表示。
   - **核心: お客様がサイズを言う前はproducts=[]。これは絶対ルール！**
7. **横断幕/バナー等** — 出力サービス商品を推薦（素材でなく）。
8. **画像アップ** — 10MBまで添付可。大きいファイルはメールsupport@cafe0101.comへ。
9. **ハニカムボード展示** — 展示/空間演出の画像を分析：壁・看板・等身大パネル・装飾・テーブル天板を把握。数字はmm単位。下部の横幅が全体幅、右端の縦が全体高さ。壁パネル1枚(約900~1200mm×2400mm)=約¥15,000。天板=約¥10,000。家具=約¥15,000~25,000。項目別に見積もり提示。分析後必ず「正確なお見積りは専門相談員がご案内いたします 😊 上の🎧ボタンを押してください」。
10. **エラーメッセージ禁止** — 分析が難しい場合「接続が不安定」と言わず、素敵な作品の構想ですね！と言い、相談員接続を案内。

⚠️ 連絡先規則: 絶対に作り上げないこと。以下のみ使用。
## 会社情報
- 会社名: Chameleon Printing
- 住所: 〒270-0023 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画
- 電話: 047-712-1148 / メール: support@cafe0101.com
- 営業時間: 平日 09:00〜18:00（土日祝休み）
- 大容量ファイル: support@cafe0101.comへ送信
- サイト: ${siteUrl}

⚠️ 言語規則: 全て日本語で回答。商品名も韓国語→日本語翻訳。
- "허니콤배너"→"ハニカムバナー"、"실사출력"→"大判プリント"、"패브릭"→"ファブリック"`,

            us: `You are "Kapu", Chameleon Printing's AI shopping assistant. Be warm and friendly. Use emojis appropriately. 3-5 sentences.

## Core Principles
1. **Chat first** — greetings/casual talk → natural conversation, don't force product recommendations.
2. **Recommend only when needed** — only when customer shows purchase intent. For greetings/chat, empty products array.
3. **Remember conversation** — use conversation_history for context.
4. **Flexible count** — 1 to 5 products as needed.
5. **Use product descriptions** — check description, is_custom_size etc.
6. **⚠️ Custom size product (is_custom_size=true) consultation flow — MUST follow!**
   - **Step 1: Ask size** — When customer asks about a product, set products=**empty array []**, briefly describe product types, then ask "What size (width×height) would you like?". NEVER put products in array if size is unknown!
   - **Step 2: Explain options** — After customer provides size, calculate price and explain addons. Products still empty [].
   - **Step 3: Product cards** — Only after options explained, put products in array.
   - **KEY RULE: Before customer states size, products MUST be []. This is absolute!**
7. **Banner/signage queries** — recommend printing services, not raw materials.
8. **Image upload** — up to 10MB. Larger files: email korea900as@gmail.com.
9. **Honeycomb exhibition references** — Analyze exhibition images carefully: walls, signs, standees, decorations, table tops, furniture. Numbers are in mm. Bottom width = total width, right side = total height. Wall panel (approx 900~1200mm × 2400mm) = ~$30 each. Table top = ~$20. Furniture = ~$30~50. Present itemized estimate. If no sizes visible, ask. Always end with: "For an accurate quote, our specialist consultants can help 😊 Click the 🎧 button above!"
10. **Never say 'connection unstable'** — For complex requests, say "What a wonderful project! ✨ Our specialist consultants can help better with this" and recommend consultant connection + related products.

⚠️ Contact rules: NEVER make up info. Use ONLY:
## Company Info
- Company: Chameleon Printing
- Email: support@cafe0101.com / korea900as@gmail.com
- Website: ${siteUrl}
- Hours: Weekdays 09:00-18:00 KST
- Large files: email korea900as@gmail.com

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
${JSON.stringify(products.map(p => {
    const addonCodes = p.addons ? p.addons.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
    const productAddons = addonCodes.map((c: string) => addonMap[c]).filter(Boolean);
    return { code: p.code, name: p.name, category: p.category, desc: (p.description || '').substring(0, 100), img: p.img_url || '', size: p.width_mm + 'x' + p.height_mm + 'mm', is_custom_size: p.is_custom_size, is_bulk_order: p.is_bulk_order, qty_options: p.quantity_options, price: p.price_display, price_per_sqm: p.price_per_sqm_display, addons: productAddons.length > 0 ? productAddons : undefined };
}))}

## ${labels.categories}
${JSON.stringify(categories)}${qaSection}`;

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
                                recommended_width_mm: { type: "number" as const, description: "0 if custom size product and customer hasn't specified size" },
                                recommended_height_mm: { type: "number" as const, description: "0 if custom size product and customer hasn't specified size" },
                                price_display: { type: "string" as const, description: "Price string. For custom size without dimensions, say 'size needed' in customer language" },
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
                    max_tokens: 2048,
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

                // img_url 보강: AI가 빠뜨려도 DB에서 매칭
                if (result.products) {
                    result.products.forEach((rec: any) => {
                        const dbProduct = products.find(p => p.code === rec.code);
                        if (dbProduct) {
                            if (!rec.img_url) rec.img_url = dbProduct.img_url || '';
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

                // ★ 서버 측 사이즈 기반 제품 카드 제어
                // AI가 가격을 계산했으면 = 사이즈를 받은 것. 가격 패턴: "14만원", "120,000원", "¥15,000", "$30"
                const _aiMsg = result.chat_message || '';
                const _userHasDigit = /\d/.test(trimmedMsg || '') && !/010[-\s]?\d/.test(trimmedMsg || '');
                // 가격 패턴: "120,000" "60,000" "14400" "15000" 등 큰 숫자 or $¥
                const _aiHasPrice = /\d{2,3},\d{3}|\d{5,}|[$¥]\s*\d/.test(_aiMsg);
                const hasUserSize = _userHasDigit && _aiHasPrice;
                const hasBannerDefault = /600.*1800/.test(_aiMsg);

                // A) 사이즈 없으면 → 커스텀 사이즈 제품만 제거 (고정 사이즈는 유지)
                if (result.products && result.products.length > 0 && !hasUserSize && !hasBannerDefault) {
                    const before = result.products.length;
                    result.products = result.products.filter((p: any) => !p.is_custom_size);
                    if (result.products.length < before) {
                        console.log('[kapu] Strip custom-size products:', before, '->', result.products.length);
                    }
                    if (result.products.length === 0) result.type = "chat";
                }

                // B) 카드가 없는데 사이즈가 있으면 → 유저 메시지+AI 텍스트에서 제품 매칭하여 주입
                if ((!result.products || result.products.length === 0) && hasUserSize) {
                    const combined = (_userMsg + ' ' + (result.chat_message || '')).toLowerCase();
                    // DB에서 커스텀 사이즈 제품 중 이름 키워드가 언급된 것 찾기
                    const matched = products.filter((p: any) => {
                        if (!p.is_custom_size) return false;
                        const name = (p.name || '');
                        const keywords = name.split(/\s+/).filter((w: string) => w.length >= 2);
                        return keywords.some((kw: string) => combined.includes(kw.toLowerCase()));
                    }).slice(0, 3);
                    if (matched.length > 0) {
                        result.products = matched.map((p: any) => {
                            const rawP = rawProducts.find((r: any) => r.code === p.code);
                            const addonCodes = rawP?.addons ? rawP.addons.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
                            return {
                                code: p.code, name: p.name, img_url: p.img_url || '',
                                _raw_price_krw: p._raw_price, _raw_per_sqm_krw: p._raw_per_sqm,
                                is_custom_size: p.is_custom_size,
                                addons: addonCodes.map((c: string) => addonMap[c]).filter(Boolean),
                            };
                        });
                        result.type = "recommendation";
                        console.log('[kapu] Inject products: user gave size →', matched.map((p:any) => p.code));
                    }
                }

                return result;
            }

            const textParts = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text);
            const textResult: any = { type: "chat", chat_message: textParts.join("\n") || "...", products: [], _model: model };
            // 텍스트 응답에서도 사이즈+제품명 매칭 시 카드 주입
            const _um2 = trimmedMsg || '';
            const _ud2 = /\d/.test(_um2) && !/010[-\s]?\d/.test(_um2);
            const _ap2 = /\d{2,3},\d{3}|\d{5,}|[$¥]\s*\d/.test(textResult.chat_message);
            if (_ud2 && _ap2) {
                const _c2 = (_um2 + ' ' + textResult.chat_message).toLowerCase();
                const _m2 = products.filter((p: any) => {
                    if (!p.is_custom_size) return false;
                    return (p.name || '').split(/\s+/).filter((w: string) => w.length >= 2).some((kw: string) => _c2.includes(kw.toLowerCase()));
                }).slice(0, 3);
                if (_m2.length > 0) {
                    textResult.products = _m2.map((p: any) => {
                        const rp = rawProducts.find((r: any) => r.code === p.code);
                        const ac = rp?.addons ? rp.addons.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
                        return { code: p.code, name: p.name, img_url: p.img_url || '', _raw_price_krw: p._raw_price, _raw_per_sqm_krw: p._raw_per_sqm, is_custom_size: p.is_custom_size, addons: ac.map((c: string) => addonMap[c]).filter(Boolean) };
                    });
                    textResult.type = "recommendation";
                }
            }
            return textResult;
        }

        const result = await callClaude("claude-sonnet-4-20250514");
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
                us: "\n\n📧 Email: support@cafe0101.com / korea900as@gmail.com\n🕐 Hours: Weekdays 09:00-18:00 KST\n💬 Kapu is available 24/7!",
            };
            const hasContact = chatMsg.includes('010-') || chatMsg.includes('047-') || chatMsg.includes('support@');
            if (!hasContact) {
                result.chat_message = chatMsg + (contactInfos[clientLang] || contactInfos['kr']);
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
            kr: "멋진 작품을 구상 중이시군요! ✨ 이런 제품의 제작은 저보다는 전문 상담사가 꼼꼼하게 확인하고 상담해 드리는게 좋습니다. 위의 🎧 상담사 연결 버튼을 눌러주세요!\n\n제품 제작 문의는 상담사에게, 출고/제작 상태 확인은 본사 상담사를 선택해 주세요 😊",
            ja: "素敵な作品の構想ですね！✨ このような制作は専門相談員が丁寧にご対応いたします。上の🎧相談員接続ボタンを押してください 😊",
            us: "What a wonderful project! ✨ For this kind of work, our specialist consultants can provide the best guidance. Click the 🎧 consultant button above! 😊",
        };
        let errKey = (reqBody?.lang || 'kr').toLowerCase();
        if (errKey === 'en') errKey = 'us';
        return new Response(
            JSON.stringify({ type: "chat", chat_message: errMsgs[errKey] || errMsgs['kr'], products: [] }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }
});
