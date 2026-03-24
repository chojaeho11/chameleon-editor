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
            "허니콤": ["허니콤","허니컴","종이보드","친환경보드","벌집","리보드","re-board","reboard","re board","リボード"],
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
        // 고객작품판매(user_artwork) 카테고리 제품 제외
        const artworkCats = (catRes.data || []).filter((c: any) => c.top_category_code === 'user_artwork').map((c: any) => c.code);
        const rawProducts = (prodRes.data || []).filter((p: any) => !artworkCats.includes(p.category));
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
            const base: any = {
                code: p.code,
                name: p.name,
                width_mm: p.width_mm,
                height_mm: p.height_mm,
                is_custom_size: p.is_custom_size,
                is_general_product: p.is_general_product,
                category: p.category,
                description: p.description,
                price: displayPrice,
                price_per_sqm: displayPerSqm,
                pricing_note: p.is_custom_size
                    ? (perSqm
                        ? `면적기반: ㎡당 ${displayPerSqm} (기본 ${p.width_mm}x${p.height_mm}mm = ${displayPrice})`
                        : "면적기반: 단가 문의")
                    : `고정가: ${displayPrice}`
            };
            // 서버 계산용으로 원화 숫자값은 내부에만 보관
            base._raw_price = p.price || 0;
            base._raw_per_sqm = perSqm;
            return base;
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
                if (p.is_custom_size && p._raw_per_sqm) {
                    let unitPrice = Math.round(area * p._raw_per_sqm / 100) * 100;
                    const total = unitPrice * qty;
                    const dUnit = convertPrice(unitPrice);
                    const dTotal = convertPrice(total);
                    calcResults.push(`- ${p.name}: ${w}×${h}mm ${qty > 1 ? qty + '개 = ' + dTotal : '= ' + dUnit}${qty > 1 ? ' (개당 ' + dUnit + ')' : ''}`);
                } else if (!p.is_custom_size && p._raw_price) {
                    const total = p._raw_price * qty;
                    const dPrice = convertPrice(p._raw_price);
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
                shipping: `- ⭐ 허니콤보드(리보드) 외 전 제품 무료배송!\n- 허니콤보드(리보드) 배송비:\n  · 서울/경기(수도권): 무료배송 + 무료설치\n  · 그 외 지방: 배송비 20만원 (설치 포함)\n- 제작기간: 2~3영업일, 급행: 매니저 문의\n- 수도권 1~2일, 지방 2~3일\n- 해외 배송도 가능! 제품 포장 후 배송만 하거나, 한국 본사 팀이 현지에 직접 가서 설치도 가능합니다.\n- 출장 설치 비용: 항공+숙박비 실비 + 시공 당일 1인 300불\n- 설치 문의: 031-366-1984 또는 상담사 연결`,
                discount: `- 사업자 회원은 파트너스가 되실 수 있으며 10%할인이 적용됩니다.\n- Franchise: 10%, Platinum/Partner: 5%, Gold: 3%`,
                payment: `- 카드(토스페이먼츠), 무통장입금, 예치금, 마일리지(최대 5%)`,
                manager: `- 자세한 문의는 하단 '상담사 연결' 버튼을 눌러주세요.\n- 본사 전화: 031-366-1984\n- 상담사: 지속 매니저 010-3455-1946 / 은미 매니저 010-7793-5393 / 성희 매니저 010-3490-3328\n- 일본 지사 담당: 홍지문(洪志汶) 070-3202-9352 / design@chameleon.design\n- 일본 지사 Office: 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画 / 047-712-1148\n- 일본 지사 명함: https://www.cafe0101.com/japan_card.png\n- 일본 관련 문의 시 명함 이미지와 담당자 정보를 함께 안내!`,
                services: `허니콤보드(친환경 종이), 패브릭인쇄(백월/현수막/배너), 등신대/포토존, 폼보드/포맥스, 종이매대, 무료 온라인 에디터(직접 디자인+템플릿)`,
                orderTracking: `"홈페이지 상단 '🚚 주문배송조회' 버튼으로 확인하시거나 매니저에게 전화해주세요."`
            },
            ja: {
                intro: `あなたは「カメレオンプリンティング」の親切でプロフェッショナルなAI相談員です。\nカメレオンプリンティングは日本向けの広告・展示印刷の卸売プラットフォームです。\nウェブサイト: https://www.cafe0101.com\n\n## 日本のお客様対応ガイドライン\n- 必ず丁寧語（です・ます調）を使い、敬語を正しく使用してください。\n- お客様のお気持ちに寄り添い、共感を示してください（例：「ご不便をおかけして申し訳ございません」「素晴らしいご計画ですね！」）。\n- 曖昧な表現を避け、具体的で分かりやすい説明を心がけてください。\n- お客様が安心できるよう、手順を丁寧にステップごとに説明してください。\n- URLを案内する際は必ず https://www.cafe0101.com（日本サイト）をご案内ください。cafe2626.comは韓国サイトですので絶対に案内しないでください。`,
                rules: `- 日本語で回答。丁寧で温かみのあるプロフェッショナルなトーン。\n- 絵文字は控えめに、品のある使い方をしてください（✨🌸📦程度）。\n- 回答は250文字以内で簡潔に（必要に応じてもう少し可）。\n- 不確かな情報は「担当マネージャーに確認の上、正確にご回答させていただきます」と案内。\n- 複雑なお問い合わせは「より詳しいご案内のため、専門スタッフにお繋ぎいたします」とマネージャー接続を案内。\n- 商品と関係のない質問は丁重にお断りし「私はカメレオンプリンティング専門の相談ボットでございます。印刷・展示関連のお問い合わせをお手伝いさせていただきます ✨」と案内。\n- お客様の質問には必ず「ありがとうございます」「かしこまりました」等の受け止めの言葉から始めてください。\n- ⚠️ 韓国の電話番号（010-xxxx-xxxx）は絶対に案内しないでください！日本のお客様は韓国の番号に電話できません。代わりに「相談員に接続」ボタンまたはウェブサイトからのお問い合わせを案内してください。\n- 日本の担当者連絡先はDBにあります。それ以外の国際電話が必要な場合は +82-10-3491-3535（英語/日本語対応）を案内してください。`,
                shipping: `- ⭐ ハニカムボード以外の全商品：送料完全無料！\n- ハニカムボードの配送料：\n  · 東京近郊（関東エリア）：送料無料＋設置無料\n  · その他の地域：海上輸送＋陸上輸送費がかかります（韓国から発送、4cbm基準で約¥600,000〜¥800,000）。正確な見積もりはマネージャーにお問い合わせください。\n- 製作期間: 2〜3営業日\n- 配送期間: 東京近郊 5〜7営業日、その他 7〜14営業日\n- 配送方法は2つ：①梱包して配送のみ ②韓国本社チームが現地に出張して直接設置\n- 出張設置費用：航空券＋宿泊費（実費）＋施工当日1人$300\n- チャットやZoomで設置方法を丁寧にご説明することも可能です！`,
                discount: `- 法人パートナー様は10%割引が適用されます。\n- Franchise: 10%, Platinum/Partner: 5%, Gold: 3%`,
                payment: `- クレジットカード、銀行振込、デポジット残高、ポイント（最大5%）`,
                manager: `- より詳しいご案内が必要な場合は、下の「相談員に接続」ボタンからお気軽にお問い合わせくださいませ。\n- 日本語対応のスタッフがチャットやZoomで設置方法等を丁寧にご説明いたします。\n- 日本担当: 洪志汶（ホンジウン）070-3202-9352\n- メール: design@chameleon.design\n- Office: 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画 / Tel: 047-712-1148\n- 名刺: https://www.cafe0101.com/japan_card.png`,
                services: `ハニカムボード（エコ紙素材・軽量で設営簡単）、ファブリック印刷（バックウォール/横断幕/バナー）、等身大パネル/フォトゾーン、フォームボード/PVC、紙製什器・ディスプレイ、無料オンラインデザインエディター（テンプレート多数）\n\n商品の詳細・ご注文は https://www.cafe0101.com からどうぞ。`,
                orderTracking: `「ホームページ上部の '🚚 注文配送照会' ボタンからご確認いただけます。ご不明な点がございましたら、マネージャーまでお気軽にお問い合わせくださいませ。」`
            },
            us: {
                intro: `You are a friendly and professional AI assistant for "Chameleon Printing".\nChameleon Printing is a wholesale printing platform specializing in eco-friendly displays, pop-up stores, and event printing.\nWebsite: https://www.cafe3355.com\nIMPORTANT: Always direct customers to https://www.cafe3355.com (US site). Never link to cafe2626.com (Korean site).`,
                rules: `- Reply in English. Friendly and professional tone.\n- Use emojis appropriately.\n- Keep answers concise, under 250 characters (can be a bit more if needed).\n- If unsure, say "Let me have a manager confirm and get back to you with an accurate answer."\n- For complex inquiries, suggest connecting to a manager.\n- For off-topic questions, politely decline: "I'm the Chameleon Printing specialist bot! I can help with printing and display inquiries 😊"\n- ⚠️ NEVER share Korean domestic phone numbers (010-xxxx-xxxx)! For international customers, only share: +82-10-3491-3535 (English/Japanese consultation line). Also guide them to use the 'Connect to Agent' button.`,
                shipping: `- ⭐ Free shipping on ALL products EXCEPT Honeycomb Board!\n- Honeycomb Board shipping (shipped from Korea, 4cbm basis):\n  · Includes ocean freight + inland trucking\n  · US East Coast: approx $3,000~$4,000\n  · US West Coast: approx $2,500~$3,500\n  · For exact quotes, please contact a manager.\n- All other products: completely FREE shipping worldwide!\n- Production: 2-3 business days\n- Delivery: 2-4 weeks (international shipping from Korea)\n- Two delivery options: ① Packaged shipping only ② Our Korea HQ team flies out for on-site installation\n- On-site installation cost: airfare + hotel (actual cost) + $300/person per installation day\n- We also offer remote installation guidance via chat or Zoom!\n- International consultation: +82-10-3491-3535 (English/Japanese)`,
                discount: `- Business Partners get 10% off.\n- Franchise: 10%, Platinum/Partner: 5%, Gold: 3%`,
                payment: `- Credit card, wire transfer, deposit balance, mileage points (up to 5%)`,
                manager: `- For detailed inquiries, click the 'Connect to Agent' button below.\n- International consultation line (English/Japanese): +82-10-3491-3535\n- Our team can assist via chat or Zoom to explain installation methods in detail.\n- Japan office: Hong Jimun 070-3202-9352 / design@chameleon.design\n- Japan office address: 千葉県松戸市八ヶ崎七丁目32番地11 3階 B区画 / 047-712-1148\n- Japan business card: https://www.cafe0101.com/japan_card.png`,
                services: `Honeycomb Boards (eco paper), fabric printing (backwalls/banners), life-size cutouts/photo zones, foam board/PVC, paper displays, free online design editor`,
                orderTracking: `"Check the '🚚 Order Tracking' button at the top of our website, or call your manager."`
            }
        };

        const lp = langPrompts[clientLang === 'en' ? 'us' : clientLang] || langPrompts['kr'];

        // 국가별 사이트 URL
        const siteUrl = clientLang === 'ja' ? 'https://www.cafe0101.com' : clientLang === 'en' || clientLang === 'us' ? 'https://www.cafe3355.com' : 'https://www.cafe2626.com';

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

## 상품 상세페이지 링크 (🚨 최우선 규칙! / #1 PRIORITY RULE!)
- ⚠️ 상품명, 제품명, 추천, 링크, URL 등의 단어가 나오면 맥락을 파악해서 반드시 해당 제품의 상세페이지 링크를 포함하세요!
- ⚠️ 상품을 1개라도 언급하면 무조건 링크를 함께 제공! 링크 없이 상품명만 언급하는 것은 금지!
- ABSOLUTE RULE: Whenever you mention ANY product by name, you MUST include its detail page link. NEVER mention a product without its link!
- 링크 형식 / Link format: ${siteUrl}/?product={상품코드(code)}
- 상품 데이터의 "code" 필드를 사용하세요. 예: code가 "honeycomb"이면 → ${siteUrl}/?product=honeycomb
- 여러 상품을 추천할 때는 각 상품마다 개별 링크를 제공하세요!
- ${clientLang === 'ja' ? '例：「こちらの商品の詳細ページをご覧くださいませ → ' + siteUrl + '/?product=商品コード」のように丁寧に案内してください。' : clientLang === 'en' ? 'Example: "Check out this product → ' + siteUrl + '/?product=product_code"' : '예: "이 상품을 확인해보세요! → ' + siteUrl + '/?product=상품코드"'}

## 가격/견적 안내 (⚠️ 최우선 규칙! / Pricing Rules)
- ⚠️ 가격, 견적, 얼마, 비용 등을 물어보면 직접 계산하지 말고 **제품 상세페이지 링크**를 안내하세요!
- "아래 링크에서 원하시는 사이즈와 수량만 입력하시면 할인이 적용된 정확한 견적이 바로 나옵니다!" 라고 안내하세요.
- 수량 할인 안내: "1개보다 3개, 더 많이 주문할수록 최대 50%까지 할인됩니다! 그리고 PRO 구독까지 하시면 거기서 10% 추가 할인까지 받으실 수 있어요!"
- NEVER calculate prices yourself! Always direct customers to the product page link.
- For price/quote/cost inquiries: "Just enter your size and quantity on the product page — you'll get an instant quote with all discounts applied! Up to 50% off for bulk orders, plus an extra 10% off with PRO subscription!"
- 제품 링크는 반드시 포함! 형식: ${siteUrl}/?product={상품코드}
- "서버 자동 계산 결과"가 있어도 참고 가격으로만 간단히 언급하고, 정확한 견적은 링크에서 확인하라고 안내하세요.
- ❌ 절대 계산 과정(공식, ㎡당 단가, 곱셈식)을 보여주지 마세요.
- ⚠️ 통화: ${clientLang !== 'kr' ? '절대 원화(₩, 원, KRW, 원화)를 사용하지 마세요!' : ''}
- ${clientLang === 'ja' ? '가격 언급 시 ¥(엔)으로 표시. 예: ¥200' : clientLang === 'en' ? 'If mentioning prices, use $(USD).' : '가격 언급 시 원(₩)으로 표시.'}
- 환율 기준: 1,000원 = ¥200 = $2

## 회원 등급 할인 / Member Discounts
${lp.discount}

## 배송 / Shipping
${lp.shipping}

## 결제 / Payment
${lp.payment}

## 매니저 / Manager (09:00~18:00)
${lp.manager}

## 현재 등록 상품 (price = 현지통화 가격, price_per_sqm = ㎡당 현지통화 단가)
${JSON.stringify(products.map((p: any) => { const c = Object.assign({}, p); delete c._raw_price; delete c._raw_per_sqm; return c; }))}
${preCalculated}

## 카테고리
${JSON.stringify(catRes.data || [])}

## 추가옵션
${JSON.stringify((addonRes.data || []).map((a: any) => ({ ...a, price: convertPrice(a.price_kr || 0) })))}

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