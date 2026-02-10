/**
 * seed-reviews.js — 가짜 리뷰 생성 스크립트
 *
 * 사용법: 브라우저 콘솔에서 이 코드를 붙여넣기하여 실행
 * (www.cafe2626.com에서 로그인 상태로 실행)
 *
 * 주의: 실행 전 Supabase에 product_reviews 테이블이 생성되어 있어야 합니다.
 */

(async function seedReviews() {
    if (!window.sb) {
        console.error('❌ Supabase 클라이언트(sb)를 찾을 수 없습니다. 사이트에서 실행해주세요.');
        return;
    }
    const sb = window.sb;

    // ===== 1. 전체 상품 목록 가져오기 =====
    const { data: products, error: prodErr } = await sb.from('admin_products').select('code, name, name_jp, name_us, category');
    if (prodErr) { console.error('상품 목록 조회 실패:', prodErr); return; }
    console.log(`📦 총 ${products.length}개 상품 발견`);

    // ===== 2. 리뷰 텍스트 템플릿 (카테고리/범용) =====
    const reviewTemplates = {
        kr: [
            "품질이 정말 좋아요! 기대 이상이었습니다.",
            "배송도 빠르고 포장도 꼼꼼해서 만족합니다.",
            "행사에 사용했는데 반응이 너무 좋았어요!",
            "가격 대비 퀄리티가 최고입니다. 재주문 예정이에요.",
            "다른 업체랑 비교할 수 없을 정도로 좋아요.",
            "색감이 선명하고 마감이 깔끔합니다.",
            "사장님 친절하시고 요청사항도 잘 반영해주셨어요.",
            "업체용으로 대량 주문했는데 하나도 불량 없이 완벽했어요.",
            "이 가격에 이 품질? 진짜 대박이에요.",
            "거래처에 납품했더니 거래처도 대만족이래요!",
            "디자인 에디터가 너무 편리해서 놀랐어요.",
            "두 번째 주문인데 역시 실망 없네요.",
            "회사 행사때마다 이용합니다. 늘 한결같은 퀄리티!",
            "주문부터 배송까지 빠르고 정확해요.",
            "가성비 끝판왕! 다른 곳은 못 갑니다.",
            "인쇄 퀄리티가 오프라인 업체보다 좋아요.",
            "커스텀 사이즈로 주문했는데 딱 맞게 와서 좋았어요.",
            "매장 인테리어용으로 딱이에요!",
            "고객센터 응대가 빠르고 친절합니다.",
            "세 번째 재구매입니다. 늘 만족해요!",
            "포장이 정성스러워서 감동받았어요.",
            "온라인 주문인데 이렇게 퀄리티 좋은 건 처음이에요.",
            "팝업스토어에 사용했더니 손님들이 다 물어봐요.",
            "급한 주문이었는데 빠른 대응 감사합니다!",
            "선물용으로 주문했는데 받는 분이 너무 좋아하셨어요.",
            "가게 간판 대용으로 사용 중인데 내구성이 좋아요.",
            "파트너사 추천으로 왔는데, 추천 받을만 하네요.",
            "이벤트 부스에 활용했는데 시선 집중 효과 대박!",
            "원단 질감이 고급스럽고 발색이 뛰어나요.",
            "사진보다 실물이 더 좋아요. 완전 추천합니다!",
            "직원분들이 다 전문가라 안심하고 맡길 수 있어요.",
            "대형 사이즈도 깔끔하게 제작해주셔서 놀랍습니다.",
            "회사 로고 작업 의뢰했는데 결과물이 완벽했어요.",
            "배너 제작했는데 색상이 너무 선명하고 예뻐요.",
            "카페 인테리어에 활용했더니 분위기가 확 살아났어요.",
            "여러 업체 비교 끝에 여기로 정했는데 최고의 선택이었어요.",
            "첫 주문인데 이렇게 만족스러울 줄 몰랐어요!",
            "단체 행사 준비할 때 항상 여기서 주문해요.",
            "친구 추천으로 왔는데 저도 이제 단골이 될 것 같아요.",
            "제품 퀄리티뿐만 아니라 서비스도 최상급입니다.",
            "주변 사업하는 분들께 다 추천했어요!",
            "에디터로 직접 디자인하니까 너무 재밌어요.",
            "마감 처리가 정말 깔끔해서 고급스러워 보여요.",
            "기존에 쓰던 업체보다 가격도 품질도 훨씬 좋아요.",
            "전시회에 사용했는데 부스가 확 돋보였어요!",
            "소량 주문도 신경 써서 해주셔서 감사해요.",
            "다음에도 꼭 여기서 주문할 거예요!",
            "마감이 고급스럽고 내구성도 뛰어나요.",
            "가격 걱정 없이 대량 주문 가능해서 좋아요.",
            "100% 만족합니다. 별 10개 드리고 싶어요!"
        ],
        en: [
            "Excellent quality! Far exceeded my expectations.",
            "Fast shipping and the packaging was very secure. Highly recommend!",
            "Used these for our trade show booth and got so many compliments!",
            "Best value for money I've found online. Will definitely reorder.",
            "The print quality is stunning — colors are vibrant and crisp.",
            "Customer service was incredibly helpful with my custom order.",
            "Ordered in bulk for our business and every piece was flawless.",
            "At this price point, the quality is unbeatable.",
            "Our clients loved the final product. Great job!",
            "The online design editor made the whole process so easy.",
            "Second time ordering and quality is consistently excellent.",
            "We use Chameleon for all our corporate events. Never disappointed!",
            "Quick turnaround from order to delivery. Very efficient.",
            "Best bang for your buck in the printing industry.",
            "Print quality rivals high-end local print shops.",
            "Custom size order came out exactly as specified. Perfect!",
            "Great for retail store displays and signage.",
            "Support team responds quickly and is very professional.",
            "Third time purchasing — always happy with the results!",
            "Packaging was so careful, everything arrived in perfect condition.",
            "Never experienced this quality level from an online printer before.",
            "Used for our pop-up store and customers kept asking about them!",
            "Rush order was handled beautifully. Thank you!",
            "Ordered as gifts and everyone absolutely loved them.",
            "Using for storefront signage — very durable and looks premium.",
            "Came on a partner's recommendation. Now I see why!",
            "Our event booth was the talk of the convention.",
            "Fabric quality feels premium and colors are true to the design.",
            "Even better in person than on screen. Totally recommend!",
            "The team clearly knows what they're doing. Very professional.",
            "Large format prints came out clean with no quality loss.",
            "Logo work was done perfectly. Exactly what we envisioned.",
            "Banner colors are so vivid and eye-catching.",
            "Added these to our café decor and the ambiance is amazing now!",
            "After comparing many vendors, this was the best choice by far.",
            "First order and I'm already planning my next one!",
            "Always our go-to for group event preparations.",
            "A friend recommended this service and now I'm a loyal customer too.",
            "Not just great products — the service is top-notch as well.",
            "I've recommended this to all my business contacts!",
            "Designing with their editor was actually fun and intuitive.",
            "The finish is clean and gives a really premium look.",
            "Better pricing AND better quality than our previous vendor.",
            "Our exhibition display really stood out thanks to these prints!",
            "Appreciated the attention to detail even on a small order.",
            "Will absolutely be ordering again for our next project!",
            "The durability is impressive — still looks great after months.",
            "Bulk ordering is stress-free with their competitive pricing.",
            "100% satisfied. Would give 10 stars if I could!",
            "The whole experience from design to delivery was seamless."
        ],
        ja: [
            "品質が本当に素晴らしいです！期待以上の仕上がりでした。",
            "配送も速くて梱包も丁寧で大満足です。",
            "イベントで使用したら、来場者からの反応がとても良かったです！",
            "コスパ最高です。また注文する予定です。",
            "他の業者とは比較にならないほど良いです。",
            "色が鮮明で仕上がりがとても綺麗です。",
            "スタッフの方がとても親切で、要望もしっかり反映してくれました。",
            "業務用に大量注文しましたが、一つも不良品がなく完璧でした。",
            "この価格でこのクオリティ？本当に驚きました。",
            "取引先に納品したら、取引先も大満足だそうです！",
            "デザインエディターがとても使いやすくて驚きました。",
            "二度目の注文ですが、やはり期待を裏切りません。",
            "会社のイベントの度に利用しています。いつも安定の品質！",
            "注文から配送まで迅速で正確でした。",
            "コストパフォーマンスが最高です！もう他には行けません。",
            "印刷クオリティがオフラインの業者よりも良いです。",
            "カスタムサイズで注文しましたが、ぴったりのサイズで届きました。",
            "店舗のインテリア用にぴったりです！",
            "カスタマーサポートの対応が早くて親切です。",
            "三回目のリピート購入です。毎回満足しています！",
            "梱包が丁寧で感動しました。",
            "オンライン注文でこんなに高品質なのは初めてです。",
            "ポップアップストアで使ったら、お客様からたくさん質問されました。",
            "急ぎの注文でしたが、迅速に対応していただきありがとうございます！",
            "プレゼント用に注文しましたが、受け取った方にとても喜ばれました。",
            "店舗の看板代わりに使用中ですが、耐久性が優れています。",
            "パートナー企業の紹介で来ましたが、紹介されるだけのことはありますね。",
            "イベントブースで活用したら、注目度が抜群でした！",
            "生地の質感が上品で発色も素晴らしいです。",
            "写真より実物の方がもっと良いです。絶対おすすめします！",
            "スタッフの皆さんが専門家なので、安心してお任せできます。",
            "大型サイズも綺麗に制作していただき、驚いています。",
            "会社ロゴの制作を依頼しましたが、仕上がりが完璧でした。",
            "バナーを制作しましたが、色がとても鮮明で美しいです。",
            "カフェのインテリアに活用したら、雰囲気がガラッと変わりました。",
            "複数の業者を比較した結果、ここに決めて大正解でした。",
            "初めての注文でしたが、こんなに満足できるとは思いませんでした！",
            "団体行事の準備にはいつもここで注文しています。",
            "友人の紹介で来ましたが、私も常連になりそうです。",
            "製品のクオリティだけでなく、サービスも最高級です。",
            "周りの事業をしている方々にも全員おすすめしました！",
            "エディターで自分でデザインするのがとても楽しかったです。",
            "仕上げ処理が本当に丁寧で、高級感があります。",
            "以前使っていた業者より、価格も品質もはるかに良いです。",
            "展示会で使用したら、ブースが一際目立ちました！",
            "少量注文でも丁寧に対応してくださりありがとうございます。",
            "次回も絶対にこちらで注文します！",
            "仕上がりが上品で、耐久性にも優れています。",
            "大量注文も安心価格でできるので助かっています。",
            "100%満足です。星10個をあげたいくらいです！"
        ]
    };

    // ===== 3. 닉네임 풀 =====
    const namePool = {
        kr: [
            "김** 님", "이** 님", "박** 님", "최** 님", "정** 님",
            "강** 님", "조** 님", "윤** 님", "장** 님", "임** 님",
            "한** 님", "오** 님", "서** 님", "신** 님", "권** 님",
            "황** 님", "안** 님", "송** 님", "류** 님", "홍** 님",
            "전** 님", "고** 님", "문** 님", "양** 님", "손** 님"
        ],
        en: [
            "Sarah M.", "Mike T.", "Jessica L.", "David K.", "Emily R.",
            "Chris W.", "Amanda S.", "Brian H.", "Jennifer P.", "Kevin D.",
            "Lisa C.", "Robert F.", "Nicole B.", "James G.", "Ashley N.",
            "Daniel J.", "Stephanie V.", "Matthew Q.", "Lauren A.", "Andrew Z.",
            "Megan E.", "Ryan O.", "Rachel I.", "Tyler U.", "Natalie Y."
        ],
        ja: [
            "佐藤 様", "鈴木 様", "高橋 様", "田中 様", "伊藤 様",
            "渡辺 様", "山本 様", "中村 様", "小林 様", "加藤 様",
            "吉田 様", "山田 様", "佐々木 様", "松本 様", "井上 様",
            "木村 様", "林 様", "清水 様", "山崎 様", "森 様",
            "池田 様", "橋本 様", "阿部 様", "石川 様", "前田 様"
        ]
    };

    // ===== 4. 별점 분포 (5점 90%, 4점 8%, 3점 2%) =====
    function getRandomRating() {
        const rand = Math.random() * 100;
        if (rand < 90) return 5;
        if (rand < 98) return 4;
        return 3;
    }

    // ===== 5. 랜덤 날짜 (최근 6개월 내) =====
    function getRandomDate() {
        const now = Date.now();
        const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);
        const randomTime = sixMonthsAgo + Math.random() * (now - sixMonthsAgo);
        return new Date(randomTime).toISOString();
    }

    // ===== 6. 리뷰 생성 및 삽입 =====
    const BATCH_SIZE = 50; // Supabase insert 배치 크기
    const langs = ['kr', 'en', 'ja'];
    let totalInserted = 0;
    let totalErrors = 0;

    for (const product of products) {
        for (const lang of langs) {
            const reviews = [];
            const templates = reviewTemplates[lang];
            const names = namePool[lang];

            for (let i = 0; i < 50; i++) {
                reviews.push({
                    product_code: product.code,
                    user_id: null,
                    user_name: names[Math.floor(Math.random() * names.length)],
                    rating: getRandomRating(),
                    comment: templates[i % templates.length],
                    photo_url: null,
                    lang: lang,
                    is_fake: true,
                    created_at: getRandomDate()
                });
            }

            // 배치 삽입
            const { error } = await sb.from('product_reviews').insert(reviews);
            if (error) {
                console.error(`❌ [${product.code}][${lang}] 삽입 실패:`, error.message);
                totalErrors++;
            } else {
                totalInserted += 50;
                console.log(`✅ [${product.code}][${lang}] 50개 리뷰 삽입 완료`);
            }
        }
    }

    console.log(`\n🎉 완료! 총 ${totalInserted}개 리뷰 삽입됨 (오류: ${totalErrors}건)`);
    console.log(`📊 상품 ${products.length}개 × 3개 언어 × 50개 = 예상 ${products.length * 3 * 50}개`);
})();
