/**
 * text-wizard.js
 * 텍스트 디자인 마법사 (다국어 + DB 폰트 반영)
 */

(function() {
    // 1. 언어 감지 (URL 파라미터 우선, 없으면 도메인 기반)
    const urlParams = new URLSearchParams(window.location.search);
    let currentLang = urlParams.get('lang') ? urlParams.get('lang').toLowerCase() : null;
    if (!currentLang) {
        const _h = window.location.hostname;
        if (_h.includes('cafe0101.com')) currentLang = 'jp';
        else if (_h.includes('cafe3355.com')) currentLang = 'us';
        else currentLang = 'kr';
    }
    // KR/JP만 고유, 나머지 모든 국가는 EN(미국)과 동일
    const langKey = (currentLang === 'ja' || currentLang === 'jp') ? 'ja'
        : (currentLang === 'kr') ? 'kr'
        : 'en';

    // 2. 폰트 선택 함수 (DYNAMIC_FONTS가 로드된 후 실행 시점에 호출)
    function getFonts() {
        const fonts = window.DYNAMIC_FONTS || [];
        const fallbacks = {
            kr: { title: 'Noto Sans KR', sub: 'Noto Sans KR', emo: 'Noto Sans KR', point: 'Noto Sans KR', deco: 'Noto Sans KR' },
            ja: { title: 'Noto Sans JP', sub: 'Noto Sans JP', emo: 'Noto Sans JP', point: 'Noto Sans JP', deco: 'Noto Sans JP' },
            en: { title: 'Inter', sub: 'Inter', emo: 'Inter', point: 'Inter', deco: 'Inter' },
            zh: { title: 'Noto Sans SC', sub: 'Noto Sans SC', emo: 'Noto Sans SC', point: 'Noto Sans SC', deco: 'Noto Sans SC' },
            ar: { title: 'Noto Sans Arabic', sub: 'Noto Sans Arabic', emo: 'Noto Sans Arabic', point: 'Noto Sans Arabic', deco: 'Noto Sans Arabic' },
            es: { title: 'Inter', sub: 'Inter', emo: 'Inter', point: 'Inter', deco: 'Inter' }
        };
        const fb = fallbacks[langKey] || fallbacks['en'];
        return {
            TITLE: (fonts[0] && fonts[0].font_family) || fb.title,
            SUB:   (fonts[1] && fonts[1].font_family) || fb.sub,
            EMO:   (fonts[2] && fonts[2].font_family) || fb.emo,
            POINT: (fonts[3] && fonts[3].font_family) || fb.point,
            DECO:  (fonts[4] && fonts[4].font_family) || fb.deco
        };
    }

    // 3. 스타일 설정
    const COLOR_MAIN = '#5dade2';
    const COLOR_SUB  = '#5dade2';
    const STROKE_THIN = 1.5;
    const TIGHT_SPACING = -30;

    // 4. 내용 데이터 (다국어 — 전 템플릿 완전 지원)
    const WIZ_DATA = {
        kr: {
            basic: {
                brand: "GRACE FLOWER",
                main: "Grace\nFlower",
                sub: "주문 겨울에도 꽃내음은 따뜻한 봄처럼",
                sections: [
                    { title: "꽃제품", items: "꽃다발/꽃바구니/플라워박스/부케\n꽃장식구독/화환꽃리스/센터피스" },
                    { title: "플라워레슨", items: "기업 강의/원데이클래스/취미반수업\n1:1레슨/그룹레슨/방문레슨" }
                ],
                event: "이벤트",
                eventDesc: "전단지 찍어서 오신분 10%DC",
                footer: "서울지역 | 꽃배달 가능",
                contact: "문의 010.4567.8900 인스타그램 flower"
            },
            flyer: {
                topLabel: "EXHIBITION 2024",
                main: "SIMPLE\nDESIGN",
                detail: "2024. 05. 01 — 05. 31\nART CENTER HALL A",
                footer: "CHAMELEON DESIGN"
            },
            card: {
                company: "COMPANY NAME",
                slogan: "TAG LINE HERE",
                name: "JHONATHAN DOE",
                job: "Solution Manager",
                phone: "010-1234-5678",
                email: "design@chameleon.co.kr",
                location: "서울특별시 강남구"
            },
            menu: {
                title: "MENU DESIGN",
                items: [
                    "1. 아메리카노 (HOT/ICE)", "2. 카페라떼", "3. 바닐라 라떼", "4. 카라멜 마키아또", "5. 콜드브루",
                    "6. 초코 라떼", "7. 녹차 라떼", "8. 레몬 에이드", "9. 자몽 에이드", "10. 허브티"
                ],
                prices: [ "3.5", "4.0", "4.5", "4.5", "4.0", "4.5", "4.5", "5.0", "5.0", "4.0" ]
            },
            bannerH: { main: "GRAND OPEN SALE", sub: "카멜레온프린팅과 함께 행복한 현수막 만들기", desc: "기관로고는 상단 로고PNG에서 검색해주세요. 당신이 가지고 있는 로고를 공유해 주세요 " },
            bannerV: {
                brand: "CHAMELEON",
                title1: "SHOP", title2: "FORUM", title3: "2025",
                step1: "1. QR코드를 찍어주세요",
                step1Sub: "※ 홈페이지 신청가능\nwww.chameleon.co.kr",
                step2: "2. 사전 등록 하신 분은",
                step2Badge: "EVENT",
                step2Desc: "등록하신 정보로 Log In (샵 포럼 참여하기)\n▶ Log In 화면을 STAFF 에게 보여 주세요!",
                step3: "3. 사전 등록을 하지 못한 분은",
                step3Badge: "참가신청",
                step3Desc: "정보 입력 후 위 2번을 진행해 주세요."
            },
            fabric: {
                topLabel: "Chameleon Event",
                subLine: "카멜레온, 디자인, 적립금, 2배 LET'S GO",
                title1: "Walk Into",
                title2: "THE SALE",
                desc: "운영자 피셜, 지금껏 오픈한 서비스 중\n가장 뜨거운 관심을 받았던 <카멜레온 만보기>",
                boxText: "회원님들의 열렬한 사랑에 힘입어\n12월에도 적립금 2배 이벤트를 진행합니다!",
                btnText: "만보기 연동하러 가기 >"
            },
            insta: {
                logoText: "Chameleon Printing",
                username: "DYB송파_Halloween Day",
                likes: "송오현님 외 999,999명이 좋아합니다",
                hashtags: "#dyb송파 #할로윈데이 #영어는 #역시 #최선이최고지\n#꿀잼영어 #내가바로 #최선의주인공 #행복 #BAAAMM!"
            }
        },
        en: {
            basic: {
                brand: "GRACE FLOWER",
                main: "Grace\nFlower",
                sub: "Beautiful blooms delivered with warmth, all year round",
                sections: [
                    { title: "Flowers", items: "Bouquets / Baskets / Flower Boxes / Bridal\nSubscriptions / Wreaths / Centerpieces" },
                    { title: "Flower Lessons", items: "Corporate Workshops / One-Day Class\n1:1 Lessons / Group Lessons / Home Visit" }
                ],
                event: "Event",
                eventDesc: "Show this flyer for 10% OFF",
                footer: "Delivery Available",
                contact: "Call 010.4567.8900  IG @flower"
            },
            flyer: {
                topLabel: "EXHIBITION 2024",
                main: "SIMPLE\nDESIGN",
                detail: "2024. 05. 01 — 05. 31\nART CENTER HALL A",
                footer: "CHAMELEON DESIGN"
            },
            card: {
                company: "COMPANY NAME",
                slogan: "TAG LINE HERE",
                name: "JHONATHAN DOE",
                job: "Solution Manager",
                phone: "+1-234-567-890",
                email: "design@chameleon.com",
                location: "New York, USA"
            },
            menu: {
                title: "MENU DESIGN",
                items: [
                    "1. Americano (HOT/ICE)", "2. Cafe Latte", "3. Vanilla Latte", "4. Caramel Macchiato", "5. Cold Brew",
                    "6. Choco Latte", "7. Green Tea Latte", "8. Lemonade", "9. Grapefruit Ade", "10. Herbal Tea"
                ],
                prices: [ "$3.5", "$4.0", "$4.5", "$4.5", "$4.0", "$4.5", "$4.5", "$5.0", "$5.0", "$4.0" ]
            },
            bannerH: { main: "GRAND OPEN SALE", sub: "Happy Banner Making with Chameleon Printing", desc: "Search for logos in the PNG tab. Share your own logos!" },
            bannerV: {
                brand: "CHAMELEON",
                title1: "SHOP", title2: "FORUM", title3: "2025",
                step1: "1. Scan the QR Code",
                step1Sub: "※ Online registration available\nwww.chameleon.com",
                step2: "2. If you pre-registered",
                step2Badge: "EVENT",
                step2Desc: "Log In with your registered info (Join Shop Forum)\n▶ Show your Login screen to STAFF!",
                step3: "3. If you haven't registered",
                step3Badge: "REGISTER",
                step3Desc: "Enter your info, then follow Step 2."
            },
            fabric: {
                topLabel: "Chameleon Event",
                subLine: "Chameleon, Design, Points, 2X LET'S GO",
                title1: "Walk Into",
                title2: "THE SALE",
                desc: "The most talked-about service we've ever launched:\n<Chameleon Pedometer> is here!",
                boxText: "Thanks to your incredible support,\nwe're running 2X Points again this December!",
                btnText: "Connect Pedometer >"
            },
            insta: {
                logoText: "Chameleon Printing",
                username: "chameleon_official",
                likes: "999,999 likes",
                hashtags: "#design #creative #printshop #chameleon #art\n#branding #popup #exhibition #style #LetsGo"
            }
        },
        ja: {
            basic: {
                brand: "GRACE FLOWER",
                main: "グレース\nフラワー",
                sub: "冬でも花の香りは暖かい春のように",
                sections: [
                    { title: "花製品", items: "花束/フラワーバスケット/フラワーボックス/ブーケ\n花の定期便/リース/センターピース" },
                    { title: "フラワーレッスン", items: "企業研修/ワンデイクラス/趣味コース\nマンツーマン/グループ/出張レッスン" }
                ],
                event: "イベント",
                eventDesc: "このチラシご提示で10%OFF",
                footer: "東京都内 | 配達対応",
                contact: "お問合せ 03.4567.8900  IG @flower"
            },
            flyer: {
                topLabel: "EXHIBITION 2024",
                main: "SIMPLE\nDESIGN",
                detail: "2024. 05. 01 — 05. 31\nART CENTER HALL A",
                footer: "CHAMELEON DESIGN"
            },
            card: {
                company: "COMPANY NAME",
                slogan: "TAG LINE HERE",
                name: "JHONATHAN DOE",
                job: "Solution Manager",
                phone: "03-1234-5678",
                email: "design@chameleon.jp",
                location: "東京都渋谷区"
            },
            menu: {
                title: "メニューデザイン",
                items: [
                    "1. アメリカーノ (HOT/ICE)", "2. カフェラテ", "3. バニララテ", "4. キャラメルマキアート", "5. コールドブリュー",
                    "6. チョコラテ", "7. 抹茶ラテ", "8. レモネード", "9. グレープフルーツエイド", "10. ハーブティー"
                ],
                prices: [ "¥350", "¥400", "¥450", "¥450", "¥400", "¥450", "¥450", "¥500", "¥500", "¥400" ]
            },
            bannerH: { main: "GRAND OPEN SALE", sub: "カメレオンプリンティングと一緒に素敵な横断幕作り", desc: "ロゴは上段のロゴPNGから検索してください。お持ちのロゴを共有してください。" },
            bannerV: {
                brand: "CHAMELEON",
                title1: "SHOP", title2: "FORUM", title3: "2025",
                step1: "1. QRコードをスキャン",
                step1Sub: "※ ホームページからも申請可能\nwww.chameleon.jp",
                step2: "2. 事前登録済みの方は",
                step2Badge: "EVENT",
                step2Desc: "登録情報でログイン（ショップフォーラムに参加）\n▶ ログイン画面をスタッフにお見せください！",
                step3: "3. まだ登録されていない方は",
                step3Badge: "参加申請",
                step3Desc: "情報を入力して上記2番をお進みください。"
            },
            fabric: {
                topLabel: "Chameleon Event",
                subLine: "カメレオン、デザイン、ポイント2倍 LET'S GO",
                title1: "歩いて",
                title2: "SALEの中へ",
                desc: "運営者イチオシ！これまでのサービスの中で\n最も注目を集めた＜カメレオン万歩計＞",
                boxText: "皆様の熱い応援のおかげで\n12月もポイント2倍イベントを開催します！",
                btnText: "万歩計を連携する >"
            },
            insta: {
                logoText: "Chameleon Printing",
                username: "chameleon_tokyo",
                likes: "999,999件のいいね",
                hashtags: "#デザイン #クリエイティブ #印刷 #カメレオン #アート\n#ブランディング #ポップアップ #展示会 #おしゃれ #最高"
            }
        },
        zh: {
            basic: {
                brand: "GRACE FLOWER",
                main: "优雅\n花坊",
                sub: "即使在冬天，花香也如春天般温暖",
                sections: [
                    { title: "花卉产品", items: "花束/花篮/花盒/新娘捧花\n鲜花订阅/花环/桌花装饰" },
                    { title: "花艺课程", items: "企业培训/一日体验课/兴趣班\n一对一/小组课/上门教学" }
                ],
                event: "活动",
                eventDesc: "出示传单享9折优惠",
                footer: "全城配送",
                contact: "咨询 010.4567.8900  IG @flower"
            }
        },
        ar: {
            basic: {
                brand: "GRACE FLOWER",
                main: "غريس\nفلاور",
                sub: "حتى في الشتاء، عطر الزهور دافئ كالربيع",
                sections: [
                    { title: "منتجات الزهور", items: "باقات / سلال / صناديق زهور / بوكيه عروس\nاشتراك زهور / أكاليل / تنسيقات" },
                    { title: "دروس تنسيق الزهور", items: "ورش عمل / حصة يوم واحد / صف هواية\nدرس خاص / مجموعات / زيارة منزلية" }
                ],
                event: "عرض خاص",
                eventDesc: "أظهر هذا المنشور واحصل على خصم 10%",
                footer: "التوصيل متاح",
                contact: "للاستفسار 010.4567.8900  IG @flower"
            }
        },
        es: {
            basic: {
                brand: "GRACE FLOWER",
                main: "Grace\nFlower",
                sub: "Incluso en invierno, el aroma floral es cálido como la primavera",
                sections: [
                    { title: "Productos Florales", items: "Ramos / Cestas / Cajas de Flores / Ramo Nupcial\nSuscripción Floral / Coronas / Centros de Mesa" },
                    { title: "Clases de Flores", items: "Talleres Corporativos / Clase de Un Día\nClase Privada / Grupal / A Domicilio" }
                ],
                event: "Promoción",
                eventDesc: "Muestra este folleto y obtén 10% de descuento",
                footer: "Envío Disponible",
                contact: "Consulta 010.4567.8900  IG @flower"
            }
        }
    };

    // 5. 실행 함수
    window.applyNewWizard = function(type) {
        if (!window.canvas) {
            alert(window.t ? window.t('err_canvas_not_ready') : "Canvas is not ready.");
            return;
        }

        const canvas = window.canvas;
        // fallback: 해당 언어에 해당 템플릿이 없으면 en → kr 순으로 fallback
        const rawData = WIZ_DATA[langKey] || {};
        const fallback = WIZ_DATA['en'] || {};
        const fallback2 = WIZ_DATA['kr'] || {};
        const data = {};
        const allTypes = ['basic','flyer','card','menu','bannerH','bannerV','fabric','insta'];
        allTypes.forEach(t => { data[t] = rawData[t] || fallback[t] || fallback2[t]; });

        const F = getFonts();

        canvas.discardActiveObject();

        const board = canvas.getObjects().find(o => o.isBoard);
        let boardW = canvas.width;
        let boardH = canvas.height;
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;

        if (board) {
            boardW = board.width * board.scaleX;
            boardH = board.height * board.scaleY;
            cx = board.left + boardW / 2;
            cy = board.top + boardH / 2;
        }

        const leftEdgeX = cx - (boardW / 2);
        const topEdgeY = cy - (boardH / 2);

        let objs = [];
        let useSafetyGroup = true;

        // ====================================================
        // 디자인 생성
        // ====================================================

        // 1. [전단지] — 심플 스타일 (제목 + 부제 + 섹션2개 + 밑줄)
        if (type === 'basic') {
            const ACCENT = '#d4826a';      // 따뜻한 코랄/살몬 계열
            const LINE_COLOR = '#d4826a';

            const refS = Math.min(boardW, boardH);
            const d = data.basic;

            // 기준 좌표
            const padX = boardW * 0.12;
            const leftX = cx - (boardW / 2) + padX;
            const rightX = cx + (boardW / 2) - padX;
            const contentW = rightX - leftX;
            let curY = cy - (boardH * 0.38);

            // (1) 브랜드명 (작은 글씨, 상단)
            const brandText = new fabric.IText(d.brand, {
                fontFamily: F.POINT, fontSize: refS * 0.028,
                fill: ACCENT, fontWeight: '100',
                charSpacing: 300,
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(brandText);
            curY += refS * 0.06;

            // (2) 메인 타이틀 (큰 글씨)
            const mainTitle = new fabric.IText(d.main, {
                fontFamily: F.TITLE, fontSize: refS * 0.12,
                fill: ACCENT, fontWeight: '100',
                textAlign: 'center', lineHeight: 1.1,
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(mainTitle);
            curY += refS * 0.27;

            // (3) 서브타이틀
            const subText = new fabric.IText(d.sub, {
                fontFamily: F.SUB, fontSize: refS * 0.032,
                fill: ACCENT, fontWeight: '100',
                textAlign: 'center', lineHeight: 1.4,
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(subText);
            curY += refS * 0.07;

            // (4) 첫 번째 구분선
            const line1 = new fabric.Rect({
                width: contentW * 0.6, height: 1, fill: LINE_COLOR,
                originX: 'center', originY: 'center',
                left: cx, top: curY
            });
            objs.push(line1);
            curY += refS * 0.04;

            // (5) 섹션들
            d.sections.forEach((sec, i) => {
                const sectionTitle = new fabric.IText(sec.title, {
                    fontFamily: F.SUB, fontSize: refS * 0.04,
                    fill: ACCENT, fontWeight: '100',
                    textAlign: 'center',
                    originX: 'center', originY: 'top',
                    left: cx, top: curY
                });
                objs.push(sectionTitle);
                curY += refS * 0.055;

                const sectionItems = new fabric.IText(sec.items, {
                    fontFamily: F.SUB, fontSize: refS * 0.025,
                    fill: ACCENT, fontWeight: '100',
                    textAlign: 'center', lineHeight: 1.5,
                    originX: 'center', originY: 'top',
                    left: cx, top: curY
                });
                objs.push(sectionItems);
                curY += refS * 0.08;
            });

            // (6) 이벤트 섹션
            const eventTitle = new fabric.IText(d.event, {
                fontFamily: F.SUB, fontSize: refS * 0.04,
                fill: ACCENT, fontWeight: '100',
                textAlign: 'center',
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(eventTitle);
            curY += refS * 0.055;

            const eventDesc = new fabric.IText(d.eventDesc, {
                fontFamily: F.SUB, fontSize: refS * 0.025,
                fill: ACCENT, fontWeight: '100',
                textAlign: 'center',
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(eventDesc);
            curY += refS * 0.06;

            // (7) 두 번째 구분선
            const line2 = new fabric.Rect({
                width: contentW * 0.6, height: 1, fill: LINE_COLOR,
                originX: 'center', originY: 'center',
                left: cx, top: curY
            });
            objs.push(line2);
            curY += refS * 0.04;

            // (8) 하단 연락처
            const footerText = new fabric.IText(d.footer, {
                fontFamily: F.SUB, fontSize: refS * 0.028,
                fill: ACCENT, fontWeight: '100',
                textAlign: 'center',
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(footerText);
            curY += refS * 0.045;

            const contactText = new fabric.IText(d.contact, {
                fontFamily: F.SUB, fontSize: refS * 0.022,
                fill: ACCENT, fontWeight: '100',
                textAlign: 'center', lineHeight: 1.4,
                originX: 'center', originY: 'top',
                left: cx, top: curY
            });
            objs.push(contactText);
        }

        // 2. [포스터/전단지]
        else if (type === 'flyer') {
            useSafetyGroup = false;

            const COLOR_MAIN = '#e8e8e8';
            const COLOR_DIM = '#999999';
            const refS = Math.min(boardW, boardH);

            const OFFSET = boardH * 0.08;

            const topLabel = new fabric.IText(data.flyer.topLabel, {
                fontFamily: F.SUB,
                fontSize: refS * 0.026,
                fill: COLOR_DIM,
                fontWeight: '300',
                charSpacing: 400,
                originX: 'center', originY: 'center',
                left: cx,
                top: cy - (boardH * 0.25) - OFFSET
            });

            const mainTitle = new fabric.IText(data.flyer.main, {
                fontFamily: F.TITLE,
                fontSize: refS * 0.14,
                fill: COLOR_MAIN,
                fontWeight: '100',
                textAlign: 'center',
                lineHeight: 0.95,
                originX: 'center', originY: 'center',
                left: cx,
                top: cy - (boardH * 0.05) - OFFSET
            });

            const centerLine = new fabric.Rect({
                width: boardW * 0.06,
                height: 1,
                fill: COLOR_DIM,
                originX: 'center', originY: 'center',
                left: cx,
                top: cy + (boardH * 0.15) - OFFSET
            });

            const subDetail = new fabric.IText(data.flyer.detail, {
                fontFamily: F.POINT,
                fontSize: refS * 0.028,
                fill: COLOR_DIM,
                fontWeight: '300',
                textAlign: 'center',
                lineHeight: 1.6,
                originX: 'center', originY: 'center',
                left: cx,
                top: cy + (boardH * 0.25) - OFFSET
            });

            objs = [ topLabel, mainTitle, centerLine, subDetail ];
        }

        // 3. [명함]
        else if (type === 'card') {
            const ACCENT = '#6366f1';

            const baseW = 500;
            const baseH = 300;
            const refCx = cx;
            const refCy = cy;

            const centerLine = new fabric.Rect({
                width: 1, height: baseH * 0.4, fill: '#e2e8f0',
                left: refCx + 20, top: refCy - 20, originX: 'center', originY: 'center'
            });

            const company = new fabric.IText(data.card.company, { fontFamily: F.TITLE, fontSize: 24, fill: '#1e293b', fontWeight: '100', originX: 'center', originY: 'top', left: refCx - 120, top: refCy - 20 });
            const slogan = new fabric.IText(data.card.slogan, { fontFamily: F.SUB, fontSize: 10, fill: '#94a3b8', fontWeight: '100', originX: 'center', originY: 'top', left: refCx - 120, top: refCy + 10 });

            const name = new fabric.IText(data.card.name, { fontFamily: F.TITLE, fontSize: 20, fill: '#1e293b', fontWeight: '100', originX: 'right', originY: 'bottom', left: refCx + (baseW/2) - 40, top: refCy - 50 });
            const job = new fabric.IText(data.card.job, { fontFamily: F.SUB, fontSize: 12, fill: '#94a3b8', fontWeight: '100', originX: 'right', originY: 'top', left: refCx + (baseW/2) - 40, top: refCy - 45 });

            const infoGap = 30; const startY = refCy + 10;
            const textX = refCx + (baseW/2) - 40;

            const txtPhone = new fabric.IText(data.card.phone, { fontFamily: F.SUB, fontSize: 10, fill: '#64748b', fontWeight: '100', textAlign: 'right', originX: 'right', originY: 'center', left: textX, top: startY });
            const txtMail = new fabric.IText(data.card.email, { fontFamily: F.SUB, fontSize: 10, fill: '#64748b', fontWeight: '100', textAlign: 'right', originX: 'right', originY: 'center', left: textX, top: startY + infoGap });
            const txtLoc = new fabric.IText(data.card.location, { fontFamily: F.SUB, fontSize: 10, fill: '#64748b', fontWeight: '100', textAlign: 'right', originX: 'right', originY: 'center', left: textX, top: startY + (infoGap * 2) });

            objs = [centerLine, company, slogan, name, job, txtPhone, txtMail, txtLoc];
        }

        // 4. [메뉴판]
        else if (type === 'menu') {
            const BG_COLOR = '#FFFDF9';
            const BORDER_COLOR = '#c9b88c';
            const TEXT_COLOR = '#5a5a5a';
            const ACCENT = '#8B7355';

            const archPath = "M -250 350 L -250 -150 A 250 250 0 0 1 250 -150 L 250 350 Z";

            const bgArch = new fabric.Path(archPath, {
                fill: BG_COLOR, stroke: BORDER_COLOR, strokeWidth: 1,
                opacity: 0.85, originX: 'center', originY: 'center',
                left: cx, top: cy,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.06)', blur: 15, offsetX: 3, offsetY: 3 })
            });
            objs.push(bgArch);

            const title = new fabric.IText(data.menu.title, {
                fontFamily: F.TITLE, fontSize: 38, fill: ACCENT,
                charSpacing: 200, fontWeight: '100',
                originX: 'center', originY: 'center',
                left: cx, top: cy - 260
            });

            const titleLine = new fabric.Rect({
                width: 40, height: 1, fill: BORDER_COLOR,
                originX: 'center', originY: 'center',
                left: cx, top: cy - 225
            });
            objs.push(title, titleLine);

            const startY = cy - 140;
            const gap = 35;
            const textLeft = cx - 180;
            const priceRight = cx + 180;

            const makeDotLine = (y) => {
                const dots = new fabric.IText("..........................................", {
                    fontFamily: F.SUB, fontSize: 10, fill: '#ddd',
                    originX: 'center', originY: 'center', left: cx, top: y
                });
                if(dots.width > 280) dots.scaleX = 280 / dots.width;
                return dots;
            };

            data.menu.items.forEach((item, i) => {
                const currentY = startY + (i * gap);

                const menuName = new fabric.IText(item, {
                    fontFamily: F.SUB, fontSize: 14, fill: TEXT_COLOR,
                    fontWeight: '300', textAlign: 'left',
                    originX: 'left', originY: 'center',
                    left: textLeft, top: currentY
                });

                const menuPrice = new fabric.IText(data.menu.prices[i], {
                    fontFamily: F.SUB, fontSize: 14, fill: ACCENT,
                    fontWeight: '300', textAlign: 'right',
                    originX: 'right', originY: 'center',
                    left: priceRight, top: currentY
                });

                const dotLine = makeDotLine(currentY + 2);
                objs.push(dotLine, menuName, menuPrice);
            });

            const footer = new fabric.IText("Bon Appetit", {
                fontFamily: F.DECO, fontSize: 22, fill: BORDER_COLOR,
                fontWeight: '300',
                originX: 'center', originY: 'center',
                left: cx, top: cy + 280
            });
            objs.push(footer);
        }

        // 5. [가로 현수막]
        else if (type === 'banner-h') {
            const ACCENT = '#c9a84c';
            const TEXT_DARK = '#3a3a3a';
            const TEXT_DIM = '#888888';

            // 좌우 세로 라인 장식
            const lineL = new fabric.Rect({
                width: 1, height: 120, fill: ACCENT,
                originX: 'center', originY: 'center',
                left: cx - 380, top: cy
            });
            const lineR = new fabric.Rect({
                width: 1, height: 120, fill: ACCENT,
                originX: 'center', originY: 'center',
                left: cx + 380, top: cy
            });

            // 좌우 작은 다이아몬드 장식
            const makeDiamond = (x, y, size) => new fabric.Rect({
                width: size, height: size, fill: ACCENT, angle: 45,
                originX: 'center', originY: 'center', left: x, top: y
            });
            const diaL = makeDiamond(cx - 380, cy - 75, 8);
            const diaR = makeDiamond(cx + 380, cy - 75, 8);
            const diaL2 = makeDiamond(cx - 380, cy + 75, 8);
            const diaR2 = makeDiamond(cx + 380, cy + 75, 8);

            const sub = new fabric.IText(data.bannerH.sub, {
                fontFamily: F.SUB, fontSize: 16, fill: TEXT_DIM,
                fontWeight: '300', charSpacing: 50,
                originX: 'center', originY: 'center', left: cx, top: cy - 50
            });

            const main = new fabric.IText(data.bannerH.main, {
                fontFamily: F.TITLE, fontSize: 46, fill: TEXT_DARK,
                charSpacing: 100, fontWeight: '100',
                originX: 'center', originY: 'center', left: cx, top: cy + 5
            });

            const line = new fabric.Rect({
                width: 60, height: 1, fill: ACCENT,
                originX: 'center', originY: 'center', left: cx, top: cy + 50
            });

            const desc = new fabric.IText(data.bannerH.desc, {
                fontFamily: F.SUB, fontSize: 14, fill: TEXT_DIM,
                fontWeight: '300',
                originX: 'center', originY: 'center', left: cx, top: cy + 80
            });

            objs = [lineL, lineR, diaL, diaR, diaL2, diaR2, sub, main, line, desc];
        }

        // 6. [세로 배너]
        else if (type === 'banner-v') {
            const DARK = '#1e293b';
            const ACCENT = '#64748b';
            const HIGHLIGHT = '#94a3b8';
            const DIM = '#94a3b8';

            const topShapeY = cy - 520;
            const botShapeY = cy + 580;

            // 상단 브랜드
            const brandText = new fabric.IText(data.bannerV.brand, {
                fontFamily: F.POINT, fontSize: 14, fill: ACCENT, fontWeight: '300',
                charSpacing: 600,
                originX: 'left', originY: 'center', left: cx - 240, top: topShapeY + 20
            });
            const brandLine = new fabric.Rect({
                width: 480, height: 1, fill: HIGHLIGHT,
                originX: 'center', originY: 'center', left: cx, top: topShapeY + 45
            });

            const title1 = new fabric.IText(data.bannerV.title1, {
                fontFamily: F.TITLE, fontSize: 100, fill: DARK, fontWeight: '100',
                charSpacing: 50,
                originX: 'center', originY: 'bottom', left: cx, top: cy - 250
            });
            const title2 = new fabric.IText(data.bannerV.title2, {
                fontFamily: F.TITLE, fontSize: 100, fill: DARK, fontWeight: '100',
                charSpacing: 50,
                originX: 'center', originY: 'top', left: cx, top: cy - 250
            });
            const title3 = new fabric.IText(data.bannerV.title3, {
                fontFamily: F.TITLE, fontSize: 100, fill: ACCENT, fontWeight: '100',
                charSpacing: 50,
                originX: 'center', originY: 'top', left: cx, top: cy - 150
            });

            const divider = new fabric.Rect({
                width: 480, height: 1, fill: HIGHLIGHT,
                originX: 'center', originY: 'center', left: cx, top: cy - 20
            });

            const startContentY = cy + 40;

            const step1 = new fabric.IText(data.bannerV.step1, {
                fontFamily: F.SUB, fontSize: 20, fill: DARK, fontWeight: '300',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY
            });
            const step1Sub = new fabric.IText(data.bannerV.step1Sub, {
                fontFamily: F.SUB, fontSize: 14, fill: DIM, fontWeight: '300', lineHeight: 1.4,
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 35
            });

            const qrBox = new fabric.Rect({
                width: 70, height: 70, fill: 'transparent', stroke: HIGHLIGHT, strokeWidth: 1,
                originX: 'right', originY: 'top', left: cx + 240, top: startContentY
            });
            const qrText = new fabric.IText("QR", {
                fontFamily: F.POINT, fontSize: 20, fill: ACCENT, fontWeight: '300',
                originX: 'center', originY: 'center', left: cx + 205, top: startContentY + 35
            });

            const step2 = new fabric.IText(data.bannerV.step2, {
                fontFamily: F.SUB, fontSize: 18, fill: DARK, fontWeight: '300',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 120
            });

            const badge1Bg = new fabric.Rect({
                width: 70, height: 22, fill: 'transparent', stroke: ACCENT, strokeWidth: 1, rx: 11, ry: 11,
                originX: 'left', originY: 'top', left: cx + 10, top: startContentY + 121
            });
            const badge1Text = new fabric.IText(data.bannerV.step2Badge, {
                fontFamily: F.POINT, fontSize: 11, fill: ACCENT, fontWeight: '300',
                charSpacing: 100,
                originX: 'center', originY: 'center', left: cx + 45, top: startContentY + 132
            });

            const step2Desc = new fabric.IText(data.bannerV.step2Desc, {
                fontFamily: F.SUB, fontSize: 14, fill: DIM, fontWeight: '300', lineHeight: 1.5,
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 155
            });

            const step3 = new fabric.IText(data.bannerV.step3, {
                fontFamily: F.SUB, fontSize: 18, fill: DARK, fontWeight: '300',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 230
            });

            const badge2Bg = new fabric.Rect({
                width: 80, height: 22, fill: 'transparent', stroke: ACCENT, strokeWidth: 1, rx: 11, ry: 11,
                originX: 'left', originY: 'top', left: cx + 65, top: startContentY + 231
            });
            const badge2Text = new fabric.IText(data.bannerV.step3Badge, {
                fontFamily: F.POINT, fontSize: 11, fill: ACCENT, fontWeight: '300',
                charSpacing: 100,
                originX: 'center', originY: 'center', left: cx + 105, top: startContentY + 242
            });

            const step3Desc = new fabric.IText(data.bannerV.step3Desc, {
                fontFamily: F.SUB, fontSize: 14, fill: DIM, fontWeight: '300',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 265
            });

            // 하단 라인 장식
            const botLine = new fabric.Rect({
                width: 480, height: 1, fill: HIGHLIGHT,
                originX: 'center', originY: 'center', left: cx, top: botShapeY
            });

            objs = [
                brandText, brandLine,
                title1, title2, title3, divider,
                step1, step1Sub, qrBox, qrText,
                step2, badge1Bg, badge1Text, step2Desc,
                step3, badge2Bg, badge2Text, step3Desc,
                botLine
            ];
        }

        // 7. [패브릭 / SALE]
        else if (type === 'fabric') {
            const DARK = '#1e293b';
            const ACCENT = '#64748b';
            const CARD_BG = '#f1f5f9';
            const BTN_COLOR = '#475569';

            const topLabel = new fabric.IText(data.fabric.topLabel, {
                fontFamily: F.POINT, fontSize: 13, fill: ACCENT, fontWeight: '300',
                charSpacing: 300,
                originX: 'center', originY: 'center', left: cx, top: cy - 350
            });

            const subLine = new fabric.IText(data.fabric.subLine, {
                fontFamily: F.SUB, fontSize: 12, fill: '#94a3b8', fontWeight: '300',
                originX: 'center', originY: 'center', left: cx, top: cy - 320
            });

            const lineDecor = new fabric.Rect({
                width: 60, height: 1, fill: '#cbd5e1',
                originX: 'center', originY: 'center', left: cx, top: cy - 300
            });

            const title1 = new fabric.IText(data.fabric.title1, {
                fontFamily: F.TITLE, fontSize: 100, fill: DARK, fontWeight: '100',
                charSpacing: 50,
                originX: 'center', originY: 'bottom', left: cx, top: cy - 140
            });

            const title2 = new fabric.IText(data.fabric.title2, {
                fontFamily: F.TITLE, fontSize: 100, fill: DARK, fontWeight: '100',
                charSpacing: 50,
                originX: 'center', originY: 'top', left: cx, top: cy - 140
            });

            const desc = new fabric.IText(data.fabric.desc, {
                fontFamily: F.SUB, fontSize: 14, fill: '#64748b', fontWeight: '300',
                textAlign: 'center', lineHeight: 1.6,
                originX: 'center', originY: 'center', left: cx, top: cy + 20
            });

            const boxHeight = 260;
            const boxWidth = 460;
            const boxTopY = cy + 100;

            const benefitBox = new fabric.Rect({
                width: boxWidth, height: boxHeight, fill: CARD_BG, rx: 16, ry: 16,
                stroke: '#e2e8f0', strokeWidth: 1,
                originX: 'center', originY: 'top', left: cx, top: boxTopY
            });

            const benefitLabel = new fabric.IText("BENEFIT", {
                fontFamily: F.POINT, fontSize: 11, fill: ACCENT, fontWeight: '300',
                charSpacing: 400,
                originX: 'center', originY: 'center', left: cx, top: boxTopY + 30
            });

            const boxText = new fabric.IText(data.fabric.boxText, {
                fontFamily: F.SUB, fontSize: 14, fill: '#475569', fontWeight: '300',
                textAlign: 'center', lineHeight: 1.7,
                originX: 'center', originY: 'top', left: cx, top: boxTopY + 60
            });

            const btnRect = new fabric.Rect({
                width: 320, height: 48, fill: BTN_COLOR, rx: 24, ry: 24,
                originX: 'center', originY: 'bottom', left: cx, top: boxTopY + boxHeight - 30
            });
            const btnText = new fabric.IText(data.fabric.btnText, {
                fontFamily: F.SUB, fontSize: 14, fill: 'white', fontWeight: '300',
                originX: 'center', originY: 'center', left: cx, top: boxTopY + boxHeight - 54
            });

            // 미니멀 십자 장식 (+)
            const makeCross = (x, y, size) => {
                const h = new fabric.Rect({ width: size, height: 1, fill: '#cbd5e1', originX: 'center', originY: 'center', left: x, top: y });
                const v = new fabric.Rect({ width: 1, height: size, fill: '#cbd5e1', originX: 'center', originY: 'center', left: x, top: y });
                return new fabric.Group([h, v]);
            };
            const c1 = makeCross(cx - 240, cy - 200, 16);
            const c2 = makeCross(cx + 240, cy - 60, 12);
            const c3 = makeCross(cx - 200, cy + 30, 10);
            const c4 = makeCross(cx + 210, cy - 220, 14);

            objs = [
                topLabel, subLine, lineDecor,
                title1, title2, desc,
                benefitBox, benefitLabel,
                boxText, btnRect, btnText,
                c1, c2, c3, c4
            ];
        }

        // 8. [세로 글씨 - 인스타]
        else if (type === 'vertical-text') {
            const FRAME_W = 600;
            const FRAME_H = 980;
            const TEXT_COLOR = '#262626';
            const DIM_COLOR = '#8e8e8e';

            const instaGradient = new fabric.Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: FRAME_W, y2: 0 },
                colorStops: [
                    { offset: 0, color: '#833ab4' },
                    { offset: 0.5, color: '#fd1d1d' },
                    { offset: 1, color: '#fcb045' }
                ]
            });

            const cardBg = new fabric.Rect({
                width: FRAME_W, height: FRAME_H, fill: 'white',
                originX: 'center', originY: 'center', left: cx, top: cy,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.08)', blur: 25 })
            });

            objs.push(cardBg);

            const topBarH = 80;
            const topBar = new fabric.Rect({
                width: FRAME_W, height: topBarH, fill: instaGradient,
                originX: 'center', originY: 'top', left: cx, top: cy - FRAME_H/2
            });

            const camPath = "M10,8 L18,8 L20,4 L36,4 L38,8 L46,8 C48,8 50,10 50,12 L50,36 C50,38 48,40 46,40 L10,40 C8,40 6,38 6,36 L6,12 C6,10 8,8 10,8 M28,14 C22,14 18,18 18,24 C18,30 22,34 28,34 C34,34 38,30 38,24 C38,18 34,14 28,14 M28,18 C31,18 34,21 34,24 C34,27 31,30 28,30 C25,30 22,27 22,24 C22,21 25,18 28,18 M42,11 C42,12 41,13 40,13 C39,13 38,12 38,11 C38,10 39,9 40,9 C41,9 42,10 42,11";
            const camIcon = new fabric.Path(camPath, {
                scaleX: 0.9, scaleY: 0.9, fill: 'transparent', stroke: 'white', strokeWidth: 1.5,
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 25, top: cy - FRAME_H/2 + topBarH/2
            });

            const logoText = new fabric.IText(data.insta.logoText, {
                fontFamily: F.POINT, fontSize: 30, fill: 'white', fontWeight: '300',
                originX: 'center', originY: 'center', left: cx, top: cy - FRAME_H/2 + topBarH/2
            });

            const planePath = "M2,21L23,12L2,3V10L17,12L2,14V21Z";
            const dmIcon = new fabric.Path(planePath, {
                scaleX: 1.0, scaleY: 1.0, fill: 'white',
                originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 25, top: cy - FRAME_H/2 + topBarH/2
            });

            objs.push(topBar, camIcon, logoText, dmIcon);

            const profileY = cy - FRAME_H/2 + topBarH + 20;
            const profileH = 60;

            const avatar = new fabric.Circle({
                radius: 20, fill: '#f5f5f5', stroke: '#dbdbdb', strokeWidth: 1,
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 30, top: profileY + profileH/2
            });

            const username = new fabric.IText(data.insta.username, {
                fontFamily: F.SUB, fontSize: 18, fill: TEXT_COLOR, fontWeight: '300',
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 80, top: profileY + profileH/2
            });

            const moreOpts = new fabric.IText("...", {
                fontFamily: 'sans-serif', fontSize: 20, fill: DIM_COLOR, fontWeight: '300',
                originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 30, top: profileY + profileH/2 - 5
            });

            objs.push(avatar, username, moreOpts);

            const sideMargin = 80;
            const photoSize = FRAME_W - (sideMargin * 2);
            const imgY = profileY + profileH + 20;

            const photoBox = new fabric.Rect({
                width: photoSize, height: photoSize, fill: '#eeeeee',
                originX: 'center', originY: 'top', left: cx, top: imgY
            });

            const guideText = new fabric.IText("PHOTO HERE", {
                fontFamily: F.POINT, fontSize: 20, fill: '#bbb', fontWeight: '300',
                charSpacing: 200,
                originX: 'center', originY: 'center', left: cx, top: imgY + photoSize/2
            });

            objs.push(photoBox, guideText);

            const actionY = imgY + photoSize + 35;
            const iconScale = 1.1;
            const leftStart = cx - FRAME_W/2 + 30;

            const heartPath = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
            const bubblePath = "M20,2H4C2.9,2,2,2.9,2,4v18l4-4h14c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z";
            const bookmarkPath = "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z";

            const iHeart = new fabric.Path(heartPath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: TEXT_COLOR, strokeWidth: 1.5, originX: 'left', originY: 'center', left: leftStart, top: actionY });
            const iComment = new fabric.Path(bubblePath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: TEXT_COLOR, strokeWidth: 1.5, originX: 'left', originY: 'center', left: leftStart + 45, top: actionY });
            const iSave = new fabric.Path(bookmarkPath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: TEXT_COLOR, strokeWidth: 1.5, originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 30, top: actionY });

            objs.push(iHeart, iComment, iSave);

            const textStartY = actionY + 40;

            const likesText = new fabric.IText(data.insta.likes, {
                fontFamily: F.SUB, fontSize: 14, fill: TEXT_COLOR, fontWeight: '300',
                originX: 'left', originY: 'center', left: leftStart, top: textStartY
            });

            const hashtags = new fabric.IText(data.insta.hashtags, {
                fontFamily: F.EMO, fontSize: 17, fill: '#00376b', fontWeight: '300', lineHeight: 1.5,
                originX: 'left', originY: 'top', left: leftStart, top: textStartY + 25,
                width: FRAME_W - 60, splitByGrapheme: true
            });

            objs.push(likesText, hashtags);

            const bottomBarH = 50;

            const botBarRect = new fabric.Rect({
                width: FRAME_W, height: bottomBarH, fill: '#fafafa',
                stroke: '#dbdbdb', strokeWidth: 1,
                left: 0, top: 0
            });

            const homePath = "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z";
            const searchPath = "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
            const boxPlusPath = "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z";

            const step = FRAME_W / 5;
            const iconY = bottomBarH / 2;

            const bHome = new fabric.Path(homePath, { scaleX: 1.3, scaleY: 1.3, fill: TEXT_COLOR, originX: 'center', originY: 'center', left: step/2, top: iconY });
            const bSearch = new fabric.Path(searchPath, { scaleX: 1.3, scaleY: 1.3, fill: DIM_COLOR, originX: 'center', originY: 'center', left: step/2 + step, top: iconY });
            const bPlus = new fabric.Path(boxPlusPath, { scaleX: 1.3, scaleY: 1.3, fill: DIM_COLOR, originX: 'center', originY: 'center', left: step/2 + step*2, top: iconY });
            const bHeart = new fabric.Path(heartPath, { scaleX: 1.0, scaleY: 1.0, fill: DIM_COLOR, originX: 'center', originY: 'center', left: step/2 + step*3, top: iconY });
            const bUser = new fabric.Circle({ radius: 12, fill: '#ddd', stroke: '#bbb', strokeWidth: 1, originX: 'center', originY: 'center', left: step/2 + step*4, top: iconY });

            const bottomGroup = new fabric.Group([botBarRect, bHome, bSearch, bPlus, bHeart, bUser], {
                left: cx,
                top: cy + FRAME_H/2,
                originX: 'center',
                originY: 'bottom'
            });

            objs.push(bottomGroup);
        }

        // ===============================================
        // 캔버스 추가 및 렌더링
        // ===============================================
        if (objs.length > 0) {
            if (useSafetyGroup) {
                const group = new fabric.Group(objs, { left: cx, top: cy, originX: 'center', originY: 'center' });
                const safeW = boardW * 0.72; const safeH = boardH * 0.72;
                const scale = Math.min(safeW / group.width, safeH / group.height);
                group.scale(scale); group.setCoords();
                canvas.add(group); canvas.requestRenderAll();

                setTimeout(() => {
                    if (group && canvas.contains(group)) {
                        const activeSel = group.toActiveSelection();
                        canvas.setActiveObject(activeSel);
                        activeSel.set('opacity', 0);
                        activeSel.animate('opacity', 1, { duration: 500, onChange: canvas.renderAll.bind(canvas), easing: fabric.util.ease.easeOutQuad });
                    }
                }, 50);
            } else {
                objs.forEach(obj => { canvas.add(obj); obj.setCoords(); });
                canvas.requestRenderAll();
                setTimeout(() => {
                    const selectableObjs = objs.filter(o => o.selectable);
                    if (selectableObjs.length > 0) {
                        const selection = new fabric.ActiveSelection(selectableObjs, { canvas: canvas });
                        canvas.setActiveObject(selection);
                        canvas.requestRenderAll();
                    }
                }, 50);
            }
        }
    };
})();
