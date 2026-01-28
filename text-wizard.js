/**
 * text-wizard.js
 * 텍스트 디자인 마법사 (DB 폰트 반영 완료)
 */



(function() {
    // 1. 언어 감지
    const urlParams = new URLSearchParams(window.location.search);
    const currentLang = urlParams.get('lang') ? urlParams.get('lang').toLowerCase() : 'kr';

    // 2. 폰트 설정 (★중요: 수파베이스 DB의 CSS Family 코드값 적용)
    // 이미지 분석 결과 기반 매핑
    const FONT_TITLE = 'jalnangodic';  // 잘난고딕 (실제 DB 코드)
    const FONT_SUB   = 'asdfasfasfsfsdf';       // 페이퍼로지 중간 (추정)
    const FONT_EMO   = 'bndsmb';    // 북엔드바탕
    const FONT_POINT = 'lkhjljdgfgfg';         // 김대건
    const FONT_DECO  = 'asdfasdfffffff';           // 필산들
    // 3. 스타일 설정
    const COLOR_MAIN = '#5dade2';
    const COLOR_SUB  = '#5dade2';  
    const STROKE_THIN = 1.5;       
    const TIGHT_SPACING = -30;     

    // 4. 내용 데이터
    const WIZ_DATA = {
        kr: {
            basic:   { main: "전시부스디자인\n멋진연출을위한", sub: "전시부스 디자인의 배경은 템플릿 중\n배경용 백터를 이용하는게 이미지가 깨지지 않아서 좋습니다.", deco: "01" },
            flyer:   { main: "POSTER\nDESIGN", sub: "종이로 만드는 새로운 세상\n포스터 디자인 이곳에 행사\n내용을 넣으면 좋아요 매우\n로고는 상단 로고PNG에서\n검색하세요.", host: "주최 : 카멜레온 프린팅   |   주관 : 디자인연구소\n후원 : 한국전시산업진흥회" },
            card:    { name: "잘나가는회사", job: "Design Team Manager", phone: "010-1234-5678", email: "design@chameleon.co.kr", company: "CHAMELEON" },
            menu:    { 
                title: "메뉴판 디자인", 
                items: [
                    "1. 아메리카노 (HOT/ICE)", "2. 카페라떼", "3. 바닐라 라떼", "4. 카라멜 마키아또", "5. 콜드브루", 
                    "6. 초코 라떼", "7. 녹차 라떼", "8. 레몬 에이드", "9. 자몽 에이드", "10. 허브티"
                ],
                prices: [ "3.5", "4.0", "4.5", "4.5", "4.0", "4.5", "4.5", "5.0", "5.0", "4.0" ]
            },
            bannerH: { main: "GRAND OPEN SALE", sub: "카멜레온프린팅과 함께 행복한 현수막 만들기", desc: "기관로고는 상단 로고PNG에서 검색해주세요. 당신이 가지고 있는 로고를 공유해 주세요 " },
            bannerV: { main: "ECO-FRIENDLY\nDISPLAY", sub: "친환경 종이집기 제작", desc: "가볍고 튼튼한 허니콤보드" },
            fabric:  { main: "Natural Mood", sub: "Every moment is a fresh beginning.\nKeep your face always toward the sunshine.", bottom: "Since 2025. Chameleon Printing Lab" },
            insta:   { id: "chameleon_official", likes: "좋아요 9,999개", desc: "카멜레온 프린팅과 함께하는\n친환경 전시 라이프 🌱", hash: "#전시 #디자인 #팝업스토어" }
        }
    };

    // 5. 실행 함수
    window.applyNewWizard = function(type) {
        if (!window.canvas) {
            alert(window.t ? window.t('err_canvas_not_ready') : "Canvas is not ready.");
            return;
        }

        const canvas = window.canvas;
        const data = WIZ_DATA[currentLang] || WIZ_DATA['kr'];

        // 충돌 방지를 위해 기존 선택 해제
        canvas.discardActiveObject();

        // 대지 정보 확인 및 절대 좌표 계산
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

        // 1. [행사부스]
        if (type === 'basic') {
            const COLOR_SKY_BLUE = '#29b6f6'; 
            const COLOR_YELLOW   = '#fff59d'; 
            const COLOR_WHITE    = '#ffffff';
            const COLOR_TEXT     = '#333333'; 
            const COLOR_DATE_GREEN = '#64dd17'; 

            const centerY = cy;
            const sizeMainTitle = boardW * 0.14; 
            const sizeSubTitle  = boardW * 0.05; 
            const sizeGridTitle = boardW * 0.045; 
            const leftAlignX = cx - (boardW * 0.45);

            const badgeW = boardW * 0.28;
            const badgeH = boardW * 0.07;
            const badgeX = leftAlignX + (badgeW / 2); 
            const badgeY = centerY - (boardH * 0.42); 

            const topBadgeRect = new fabric.Rect({
                width: badgeW, height: badgeH,
                fill: 'transparent', 
                stroke: 'white', strokeWidth: 2, 
                rx: badgeH / 2, ry: badgeH / 2, 
                originX: 'center', originY: 'center',
                left: badgeX, top: badgeY
            });

            const topBadgeText = new fabric.IText("SKIN CARE", { 
                fontFamily: FONT_POINT, fontSize: badgeH * 0.45, 
                fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center',
                left: badgeX, top: badgeY
            });

            const titleY = badgeY + (badgeH) + 15;

            const mainTitle = new fabric.IText("숨어있던\n꿀피부 찾기", { 
                fontFamily: FONT_TITLE, 
                fontSize: sizeMainTitle, 
                fill: 'white', lineHeight: 1.2,
                originX: 'left', originY: 'top',
                left: leftAlignX, top: titleY
            });

            const roundRadius = boardW * 0.05; 
            const bottomBg = new fabric.Rect({
                width: boardW, height: boardH / 2,
                fill: COLOR_WHITE,
                rx: roundRadius, ry: roundRadius, 
                originX: 'center', originY: 'top',
                left: cx, top: centerY
            });

            const bottomFiller = new fabric.Rect({
                width: boardW, height: roundRadius * 2,
                fill: COLOR_WHITE,
                originX: 'center', originY: 'bottom',
                left: cx, top: centerY + (boardH / 2) 
            });

            const subHeadline = new fabric.IText("지친 피부에 '수분 에너지'를 채우세요!", {
                fontFamily: FONT_SUB, fontSize: sizeSubTitle, 
                fill: COLOR_TEXT, fontWeight: 'bold',
                originX: 'center', originY: 'top',
                left: cx, top: centerY + (boardH * 0.05)
            });

            const gridObjs = [];
            const gridMargin = boardW * 0.05;
            const availableW = boardW - (gridMargin * 2);
            const colWidth = availableW / 3;
            
            const startX = (cx - (availableW / 2)) + (colWidth / 2);
            const gridContentY = centerY + (boardH * 0.12);

            const gridData = [
                { badge: "꿀할인.01", title: "집중 보습", sub: "<2주 프로그램>", old: "50만원", new: "34만원" },
                { badge: "꿀할인.02", title: "여드름 흉터", sub: "<3주 프로그램>", old: "60만원", new: "52만원" },
                { badge: "꿀할인.03", title: "모공 관리", sub: "<1주 프로그램>", old: "25만원", new: "18만원" }
            ];

            gridData.forEach((item, i) => {
                const itemX = startX + (i * colWidth);
                const badgeRect = new fabric.Rect({
                    width: colWidth * 0.7, height: boardH * 0.03, fill: COLOR_YELLOW,
                    originX: 'center', originY: 'center', left: itemX, top: gridContentY
                });
                const badgeTxt = new fabric.IText(item.badge, {
                    fontFamily: FONT_SUB, fontSize: sizeGridTitle * 0.6, 
                    fill: '#333', fontWeight: 'bold',
                    originX: 'center', originY: 'center', left: itemX, top: gridContentY
                });
                const titleTxt = new fabric.IText(item.title, {
                    fontFamily: FONT_SUB, fontSize: sizeGridTitle, 
                    fill: 'black', fontWeight: 'bold',
                    originX: 'center', originY: 'top', left: itemX, top: gridContentY + (boardH * 0.03) + 5
                });
                const subTxt = new fabric.IText(item.sub, {
                    fontFamily: FONT_SUB, fontSize: sizeGridTitle * 0.6, fill: COLOR_SKY_BLUE,
                    originX: 'center', originY: 'top', left: itemX, top: titleTxt.top + titleTxt.height + 5
                });
                const oldPrice = new fabric.IText(item.old, {
                    fontFamily: FONT_SUB, fontSize: sizeGridTitle * 0.7, 
                    fill: '#888', textDecoration: 'line-through',
                    originX: 'center', originY: 'top', left: itemX, top: subTxt.top + subTxt.height + 15
                });
                const priceBtnH = boardH * 0.05;
                const priceBg = new fabric.Rect({
                    width: colWidth * 0.9, height: priceBtnH, 
                    fill: COLOR_SKY_BLUE, rx: priceBtnH/2, ry: priceBtnH/2,
                    originX: 'center', originY: 'top', left: itemX, top: oldPrice.top + oldPrice.height + 10
                });
                const newPrice = new fabric.IText(item.new, {
                    fontFamily: FONT_POINT, fontSize: sizeGridTitle * 0.9, 
                    fill: 'white', fontWeight: 'bold',
                    originX: 'center', originY: 'center', left: itemX, top: priceBg.top + (priceBtnH/2) + 2
                });
                if (i < 2) {
                    const divider = new fabric.Rect({
                        width: 1, height: boardH * 0.15, fill: '#eee',
                        originX: 'left', originY: 'top',
                        left: itemX + (colWidth/2), top: gridContentY + 20
                    });
                    gridObjs.push(divider);
                }
                gridObjs.push(badgeRect, badgeTxt, titleTxt, subTxt, oldPrice, priceBg, newPrice);
            });

            const footerHeight = boardH * 0.06;
            const footerBg = new fabric.Rect({
                width: boardW, height: footerHeight,
                fill: COLOR_SKY_BLUE,
                originX: 'center', originY: 'bottom',
                left: cx, top: boardH
            });

            const footerText = new fabric.IText("수험표 지참시 20% 할인 | 예약문의 : 012-3456-7890", {
                fontFamily: FONT_SUB, fontSize: sizeSubTitle * 0.6, fill: 'white',
                originX: 'center', originY: 'center',
                left: cx, top: boardH - (footerHeight / 2)
            });

            const dateText = new fabric.IText("EVENT 11.01 ~ 12.31", {
                fontFamily: FONT_POINT, fontSize: sizeSubTitle * 1.2, 
                fill: COLOR_DATE_GREEN, fontWeight: 'bold', 
                originX: 'center', originY: 'bottom', 
                left: cx, top: boardH - footerHeight - 15 
            });

            objs = [ topBadgeRect, topBadgeText, mainTitle, bottomBg, bottomFiller, subHeadline, ...gridObjs, dateText, footerBg, footerText ];
        }
        
        // 2. [포스터]
        // 2. [포스터/전단지] - 테두리 없음, 연한 회색 (모던 타이포)
        else if (type === 'flyer') {
            useSafetyGroup = false; 
            
            // ★ [수정] 흰색에 가까운 아주 연한 회색
            const COLOR_MAIN = '#eeeeee'; 
            
            const refS = Math.min(boardW, boardH); 
            const LINE_THICKNESS = 2; 
            
            // (테두리 코드 제거됨)

            // 1. 상단 소제목
            const topLabel = new fabric.IText("EXHIBITION 2024", {
                fontFamily: FONT_SUB, 
                fontSize: refS * 0.03, 
                fill: COLOR_MAIN, 
                fontWeight: 'bold',
                letterSpacing: 200, 
                originX: 'center', originY: 'center', 
                left: cx, 
                top: cy - (boardH * 0.25) 
            });

            // 2. 메인 타이틀 (크고 임팩트 있게)
            const mainTitle = new fabric.IText("SIMPLE\nDESIGN", {
                fontFamily: FONT_TITLE, 
                fontSize: refS * 0.15, 
                fill: COLOR_MAIN, 
                fontWeight: 'bold',
                textAlign: 'center',
                lineHeight: 0.9,
                originX: 'center', originY: 'center', 
                left: cx, 
                top: cy - (boardH * 0.05) 
            });

            // 3. 중앙 구분선
            const centerLine = new fabric.Rect({
                width: boardW * 0.1, 
                height: LINE_THICKNESS * 2, 
                fill: COLOR_MAIN,
                originX: 'center', originY: 'center', 
                left: cx, 
                top: cy + (boardH * 0.15)
            });

            // 4. 하단 상세 내용
            const subDetail = new fabric.IText("2024. 05. 01 — 05. 31\nART CENTER HALL A", {
                fontFamily: FONT_POINT, 
                fontSize: refS * 0.035, 
                fill: COLOR_MAIN, 
                fontWeight: 'normal',
                textAlign: 'center',
                lineHeight: 1.5,
                originX: 'center', originY: 'center', 
                left: cx, 
                top: cy + (boardH * 0.25)
            });

            // 5. 바닥 로고/기관명
            const footerText = new fabric.IText("CHAMELEON DESIGN", {
                fontFamily: FONT_SUB, 
                fontSize: refS * 0.025, 
                fill: COLOR_MAIN, 
                fontWeight: 'bold',
                originX: 'center', originY: 'bottom', 
                left: cx, 
                top: boardH - 30 // 위치 살짝 조정
            });

            // objs 배열에서 borderRect 제거
            objs = [ topLabel, mainTitle, centerLine, subDetail, footerText ];
        }
        
        // 3. [명함]
        else if (type === 'card') {
            const greenLight = '#82c91e'; 
            const greenDark = '#2b8a3e';  
            
            const baseW = 500;
            const baseH = 300;
            const refCx = cx; 
            const refCy = cy;

            const bottomHeight = baseH * 0.2; 
            const rectBottom1 = new fabric.Rect({
                width: baseW * 0.7, height: bottomHeight, fill: greenLight,
                left: refCx - (baseW/2), top: refCy + (baseH/2) - bottomHeight, originX: 'left', originY: 'top'
            });
            const rectBottom2 = new fabric.Rect({
                width: baseW * 0.3, height: bottomHeight, fill: greenDark,
                left: refCx - (baseW/2) + (baseW * 0.7), top: refCy + (baseH/2) - bottomHeight, originX: 'left', originY: 'top'
            });

            const centerLine = new fabric.Rect({
                width: 2, height: baseH * 0.4, fill: greenLight,
                left: refCx + 20, top: refCy - 20, originX: 'center', originY: 'center'
            });

            const logoSize = 15; const logoGap = 2;
            const diamond1 = new fabric.Rect({ width: logoSize, height: logoSize, fill: greenLight, angle: 45, left: 0, top: -logoSize - logoGap });
            const diamond2 = new fabric.Rect({ width: logoSize, height: logoSize, fill: greenLight, angle: 45, left: -logoSize - logoGap, top: 0 });
            const diamond3 = new fabric.Rect({ width: logoSize, height: logoSize, fill: greenLight, angle: 45, left: logoSize + logoGap, top: 0 });
            const diamond4 = new fabric.Rect({ width: logoSize, height: logoSize, fill: greenDark, angle: 45, left: 0, top: logoSize + logoGap });
            const logoGroup = new fabric.Group([diamond1, diamond2, diamond3, diamond4], { left: refCx - 120, top: refCy - 50, originX: 'center', originY: 'center' });

            const company = new fabric.IText("COMPANY NAME", { fontFamily: FONT_TITLE, fontSize: 24, fill: '#000000', originX: 'center', originY: 'top', left: refCx - 120, top: refCy + 10 });
            const slogan = new fabric.IText("TAG LINE HERE", { fontFamily: FONT_SUB, fontSize: 10, fill: '#666666', originX: 'center', originY: 'top', left: refCx - 120, top: refCy + 40 });

            const name = new fabric.IText("JHONATHAN DOE", { fontFamily: FONT_TITLE, fontSize: 20, fill: '#000000', originX: 'right', originY: 'bottom', left: refCx + (baseW/2) - 40, top: refCy - 50 });
            const job = new fabric.IText("Solution Manager", { fontFamily: FONT_SUB, fontSize: 12, fill: '#666666', originX: 'right', originY: 'top', left: refCx + (baseW/2) - 40, top: refCy - 45 });

            const iconSize = 20; const infoGap = 30; const startY = refCy + 10;
            const iconX = refCx + (baseW/2) - 50; const textX = iconX - 35;

            const iconPhoneBg = new fabric.Rect({ width: iconSize, height: iconSize, fill: greenLight, rx: 3, ry: 3, originX: 'center', originY: 'center', left: iconX, top: startY });
            const txtPhone = new fabric.IText("+012 345 6789", { fontFamily: FONT_SUB, fontSize: 10, fill: '#666', textAlign: 'right', originX: 'right', originY: 'center', left: textX, top: startY });
            const iconMailBg = new fabric.Rect({ width: iconSize, height: iconSize, fill: greenLight, rx: 3, ry: 3, originX: 'center', originY: 'center', left: iconX, top: startY + infoGap });
            const txtMail = new fabric.IText("your@email.com", { fontFamily: FONT_SUB, fontSize: 10, fill: '#666', textAlign: 'right', originX: 'right', originY: 'center', left: textX, top: startY + infoGap });
            const iconLocBg = new fabric.Rect({ width: iconSize, height: iconSize, fill: greenLight, rx: 3, ry: 3, originX: 'center', originY: 'center', left: iconX, top: startY + (infoGap * 2) });
            const txtLoc = new fabric.IText("New York, USA", { fontFamily: FONT_SUB, fontSize: 10, fill: '#666', textAlign: 'right', originX: 'right', originY: 'center', left: textX, top: startY + (infoGap * 2) });

            objs = [rectBottom1, rectBottom2, centerLine, logoGroup, company, slogan, name, job, iconPhoneBg, txtPhone, iconMailBg, txtMail, iconLocBg, txtLoc];
        }

        // 4. [메뉴판]
        else if (type === 'menu') {
            const BG_COLOR = '#FFFDF9'; 
            const BORDER_COLOR = '#D4AF37'; 
            const TEXT_COLOR = '#4A4A4A';   

            const archPath = "M -250 350 L -250 -150 A 250 250 0 0 1 250 -150 L 250 350 Z";

            const bgArch = new fabric.Path(archPath, {
                fill: BG_COLOR, stroke: BORDER_COLOR, strokeWidth: 2,
                opacity: 0.85, originX: 'center', originY: 'center',
                left: cx, top: cy,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 10, offsetX: 5, offsetY: 5 })
            });
            objs.push(bgArch);

            const title = new fabric.IText(data.menu.title, { 
                fontFamily: FONT_TITLE, fontSize: 45, fill: '#8B4513', 
                charSpacing: TIGHT_SPACING, fontWeight: 'bold', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy - 260 
            });
            
            const titleLine = new fabric.Rect({ 
                width: 60, height: 2, fill: '#8B4513', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy - 220 
            });
            objs.push(title, titleLine);

            const startY = cy - 140; 
            const gap = 35; 
            const textLeft = cx - 180; 
            const priceRight = cx + 180; 
            
            const makeDotLine = (y) => {
                const dots = new fabric.IText("..........................................", {
                    fontFamily: FONT_SUB, fontSize: 12, fill: '#ccc',
                    originX: 'center', originY: 'center', left: cx, top: y
                });
                if(dots.width > 280) dots.scaleX = 280 / dots.width;
                return dots;
            };

            data.menu.items.forEach((item, i) => {
                const currentY = startY + (i * gap);

                const menuName = new fabric.IText(item, { 
                    fontFamily: FONT_SUB, fontSize: 15, fill: TEXT_COLOR, 
                    fontWeight: 'normal', textAlign: 'left',
                    originX: 'left', originY: 'center', 
                    left: textLeft, top: currentY 
                });
                
                const menuPrice = new fabric.IText(data.menu.prices[i], { 
                    fontFamily: FONT_SUB, fontSize: 15, fill: '#8B4513', 
                    fontWeight: 'bold', textAlign: 'right',
                    originX: 'right', originY: 'center', 
                    left: priceRight, top: currentY 
                });

                const dotLine = makeDotLine(currentY + 2);
                objs.push(dotLine, menuName, menuPrice);
            });

            const footer = new fabric.IText("Bon Appetit", { 
                fontFamily: FONT_DECO, fontSize: 24, fill: '#D4AF37', // 마포꽃섬
                originX: 'center', originY: 'center', 
                left: cx, top: cy + 280 
            });
            objs.push(footer);
        }

        // 5. [가로 현수막]
        else if (type === 'banner-h') {
            const STAR_COLOR = '#FFD700'; 
            const TEXT_COLOR = '#E6A000'; 
            
            const starPath = "M26,3.6c1.1-3.3,5.8-3.3,6.9,0l6.1,18.7c0.5,1.5,1.9,2.5,3.4,2.5h19.7c3.5,0,4.9,4.4,2.1,6.5L48.3,44.2 c-1.2,0.9-1.8,2.4-1.3,3.9l6.1,18.7c1.1,3.3-2.7,6.1-5.6,3.9L31.4,59.3c-1.2-0.9-2.9-0.9-4.1,0L11.4,70.7 c-2.8,2.1-6.7-0.6-5.6-3.9l6.1-18.7c0.5-1.5-0.1-3-1.3-3.9L-5.3,31.3c-2.8-2.1-1.4-6.5,2.1-6.5h19.7c1.5,0,2.9-1,3.4-2.5L26,3.6z";

            const starL = new fabric.Path(starPath, {
                scaleX: 1.3, scaleY: 1.3, 
                fill: STAR_COLOR, stroke: '#e0c000', strokeWidth: 1,
                originX: 'center', originY: 'center', 
                left: cx - 360, top: cy - 20
            });
            const starR = new fabric.Path(starPath, {
                scaleX: 1.3, scaleY: 1.3, 
                fill: STAR_COLOR, stroke: '#e0c000', strokeWidth: 1,
                originX: 'center', originY: 'center', 
                left: cx + 360, top: cy - 20
            });

            const makeMiniStar = (x, y, scale) => new fabric.Path(starPath, {
                scaleX: scale, scaleY: scale, 
                fill: STAR_COLOR, originX: 'center', originY: 'center', left: x, top: y
            });

            const s1 = makeMiniStar(cx - 300, cy - 60, 0.5);
            const s2 = makeMiniStar(cx - 410, cy + 20, 0.4);
            const s3 = makeMiniStar(cx - 340, cy + 50, 0.3);
            const s4 = makeMiniStar(cx + 300, cy - 60, 0.5);
            const s5 = makeMiniStar(cx + 410, cy + 20, 0.4);
            const s6 = makeMiniStar(cx + 340, cy + 50, 0.3);

            const main = new fabric.IText(data.bannerH.main, { 
                fontFamily: FONT_TITLE, fontSize: 50, fill: TEXT_COLOR, 
                charSpacing: TIGHT_SPACING, fontWeight: 'bold', 
                originX: 'center', originY: 'center', left: cx, top: cy + 10 
            });

            const sub = new fabric.IText(data.bannerH.sub, { 
                fontFamily: FONT_SUB, fontSize: 20, fill: TEXT_COLOR, 
                charSpacing: -10, fontWeight: 'normal', 
                originX: 'center', originY: 'center', left: cx, top: cy - 40 
            });

            const line = new fabric.Rect({ 
                width: 500, height: 2, fill: TEXT_COLOR, 
                originX: 'center', originY: 'center', left: cx, top: cy + 70 
            });

            const desc = new fabric.IText(data.bannerH.desc, { 
                fontFamily: FONT_SUB, fontSize: 16, fill: TEXT_COLOR, 
                charSpacing: -10, fontWeight: 'normal', 
                originX: 'center', originY: 'center', left: cx, top: cy + 100 
            });

            objs = [starL, starR, s1, s2, s3, s4, s5, s6, main, sub, line, desc];
        }

        // 6. [세로 배너]
        else if (type === 'banner-v') {
            const NAVY = '#1a237e';   
            const BLUE = '#283593';   
            const YELLOW = '#fdd835'; 
            
            const topShapeY = cy - 520; 
            const botShapeY = cy + 580; 

            const brandBar = new fabric.Rect({
                width: 180, height: 35, fill: NAVY,
                originX: 'left', originY: 'top', left: cx - 280, top: topShapeY
            });
            const brandText = new fabric.IText("CHAMELEON", {
                fontFamily: FONT_POINT, fontSize: 16, fill: '#fff', fontWeight: 'bold',
                originX: 'left', originY: 'center', left: cx - 270, top: topShapeY + 17
            });

            const topTri = new fabric.Triangle({
                width: 160, height: 160, fill: BLUE, opacity: 1,
                originX: 'center', originY: 'center', 
                left: cx + 220, top: topShapeY, angle: 180
            });

            const title1 = new fabric.IText("SHOP", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: YELLOW, fontWeight: 'bold',
                originX: 'center', originY: 'bottom', left: cx, top: cy - 250
            });
            const title2 = new fabric.IText("FORUM", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                originX: 'center', originY: 'top', left: cx, top: cy - 250
            });
            const title3 = new fabric.IText("2025", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                originX: 'center', originY: 'top', left: cx, top: cy - 140
            });
            
            const divider = new fabric.Rect({
                width: 500, height: 4, fill: NAVY,
                originX: 'center', originY: 'center', left: cx, top: cy - 20
            });

            const startContentY = cy + 40;

            const step1 = new fabric.IText("1. QR코드를 찍어주세요", {
                fontFamily: FONT_SUB, fontSize: 22, fill: NAVY, fontWeight: 'bold',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY
            });
            const step1Sub = new fabric.IText("※ 홈페이지 신청가능\nwww.chameleon.co.kr", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#666', lineHeight: 1.4,
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 35
            });

            const qrBox = new fabric.Rect({
                width: 80, height: 80, fill: 'transparent', stroke: NAVY, strokeWidth: 3,
                originX: 'right', originY: 'top', left: cx + 240, top: startContentY
            });
            const qrText = new fabric.IText("QR", {
                fontFamily: FONT_POINT, fontSize: 24, fill: NAVY, fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx + 200, top: startContentY + 40
            });

            const step2 = new fabric.IText("2. 사전 등록 하신 분은", {
                fontFamily: FONT_SUB, fontSize: 20, fill: NAVY, fontWeight: 'bold',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 120
            });

            const badge1Bg = new fabric.Rect({
                width: 70, height: 24, fill: YELLOW, rx: 4, ry: 4,
                originX: 'left', originY: 'top', left: cx + 10, top: startContentY + 120
            });
            const badge1Text = new fabric.IText("EVENT", {
                fontFamily: FONT_POINT, fontSize: 14, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx + 45, top: startContentY + 132
            });

            const step2Desc = new fabric.IText("등록하신 정보로 Log In (샵 포럼 참여하기)\n▶ Log In 화면을 STAFF 에게 보여 주세요!", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#444', lineHeight: 1.5,
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 155
            });

            const step3 = new fabric.IText("3. 사전 등록을 하지 못한 분은", {
                fontFamily: FONT_SUB, fontSize: 20, fill: NAVY, fontWeight: 'bold',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 230
            });

            const badge2Bg = new fabric.Rect({
                width: 80, height: 24, fill: YELLOW, rx: 4, ry: 4,
                originX: 'left', originY: 'top', left: cx + 65, top: startContentY + 230
            });
            const badge2Text = new fabric.IText("참가신청", {
                fontFamily: FONT_POINT, fontSize: 14, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx + 105, top: startContentY + 242
            });

            const step3Desc = new fabric.IText("정보 입력 후 위 2번을 진행해 주세요.", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#444',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 265
            });

            const botTriPath = "M 0 0 L 300 0 L 300 300 Z";
            const botRightTri = new fabric.Path(botTriPath, {
                fill: NAVY, opacity: 1,
                originX: 'right', originY: 'bottom', left: cx + 300, top: botShapeY + 150
            });

            const stripes = [];
            const stripeCount = 7;
            const stripeW = 12;
            const maxHeight = 150;

            for(let i=0; i<stripeCount; i++) {
                let h = maxHeight * (1 - i/stripeCount);
                let s = new fabric.Rect({
                    width: stripeW, height: h, fill: BLUE,
                    left: (cx - 280) + (i * 24), 
                    top: botShapeY + 100,
                    originX: 'left', originY: 'bottom'
                });
                stripes.push(s);
            }
            const stripeGroup = new fabric.Group(stripes);

            objs = [
                brandBar, brandText, topTri, 
                title1, title2, title3, divider, 
                step1, step1Sub, qrBox, qrText,
                step2, badge1Bg, badge1Text, step2Desc,
                step3, badge2Bg, badge2Text, step3Desc,
                botRightTri, stripeGroup
            ];
        }

        // 7. [패브릭]
        else if (type === 'fabric') {
            const NAVY = '#0b1e47';    
            const BROWN = '#5d4c44';   
            const GOLD = '#fecb00';    
            const BTN_BLUE = '#5282d6';
            const SNOW_COLOR = '#a2cdf6'; 

            const topLabel = new fabric.IText("Chameleon Event", {
                fontFamily: FONT_POINT, fontSize: 16, fill: '#2e7d32', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx, top: cy - 350
            });
            
            const subLine = new fabric.IText("카멜레온, 디자인, 적립금, 2배 LET'S GO", {
                fontFamily: FONT_SUB, fontSize: 14, fill: '#666', fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 320
            });
            
            const lineDecor = new fabric.Rect({
                width: 400, height: 1, fill: '#ddd',
                originX: 'center', originY: 'center', left: cx, top: cy - 300
            });

            const title1 = new fabric.IText("걸어서", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                charSpacing: -50, 
                originX: 'center', originY: 'bottom', left: cx, top: cy - 140
            });

            const title2 = new fabric.IText("SALE속으로", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                charSpacing: -50,
                originX: 'center', originY: 'top', left: cx, top: cy - 140
            });

            const desc = new fabric.IText("운영자 피셜, 지금껏 오픈한 서비스 중\n가장 뜨거운 관심을 받았던 <카멜레온 만보기>", {
                fontFamily: FONT_SUB, fontSize: 16, fill: '#555', textAlign: 'center', lineHeight: 1.5,
                originX: 'center', originY: 'center', left: cx, top: cy + 20
            });

            const boxHeight = 280;
            const boxWidth = 500;
            const boxTopY = cy + 100;

            const benefitBox = new fabric.Rect({
                width: boxWidth, height: boxHeight, fill: BROWN, rx: 20, ry: 20,
                originX: 'center', originY: 'top', left: cx, top: boxTopY
            });

            const coinBg = new fabric.Circle({
                radius: 40, fill: BROWN, 
                originX: 'center', originY: 'center', left: cx, top: boxTopY
            });

            const goldCoin = new fabric.Circle({
                radius: 32, fill: GOLD, stroke: '#eeb000', strokeWidth: 3,
                originX: 'center', originY: 'center', left: cx, top: boxTopY
            });
            
            const coinText = new fabric.IText("P", {
                fontFamily: FONT_POINT, fontSize: 40, fill: 'white', fontWeight: 'bold', 
                originX: 'center', originY: 'center', left: cx, top: boxTopY
            });
            
            const benefitLabel = new fabric.IText("BENEFIT", {
                fontFamily: FONT_POINT, fontSize: 12, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'bottom', left: cx, top: boxTopY - 45
            });

            const boxText = new fabric.IText("회원님들의 열렬한 사랑에 힘입어\n12월에도 적립금 2배 이벤트를 진행합니다!", {
                fontFamily: FONT_SUB, fontSize: 16, fill: 'white', textAlign: 'center', lineHeight: 1.6,
                originX: 'center', originY: 'top', left: cx, top: boxTopY + 60
            });

            const btnRect = new fabric.Rect({
                width: 350, height: 60, fill: BTN_BLUE, rx: 10, ry: 10,
                originX: 'center', originY: 'bottom', left: cx, top: boxTopY + boxHeight - 40
            });
            const btnText = new fabric.IText("만보기 연동하러 가기 >", {
                fontFamily: FONT_SUB, fontSize: 18, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx, top: boxTopY + boxHeight - 70
            });

            const snowPath = "M10,0 L10,20 M0,10 L20,10 M2.9,2.9 L17.1,17.1 M17.1,2.9 L2.9,17.1";
            
            const makeSnow = (x, y, scale) => new fabric.Path(snowPath, {
                stroke: SNOW_COLOR, strokeWidth: 2, fill: 'transparent', strokeLineCap: 'round',
                scaleX: scale, scaleY: scale,
                originX: 'center', originY: 'center', left: x, top: y
            });

            const snow1 = makeSnow(cx - 240, cy - 180, 1.5);
            const snow2 = makeSnow(cx + 240, cy - 40, 1.2);
            const snow3 = makeSnow(cx - 220, cy + 20, 0.8);
            const snow4 = makeSnow(cx + 200, cy - 200, 1.0);

            objs = [
                topLabel, subLine, lineDecor,
                title1, title2, desc,
                benefitBox, coinBg, benefitLabel, goldCoin, coinText, 
                boxText, btnRect, btnText, 
                snow1, snow2, snow3, snow4 
            ];
        }

        // 8. [세로 글씨 - 인스타]
        else if (type === 'vertical-text') {
            const FRAME_W = 600;
            const FRAME_H = 980; 
            
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
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 20 })
            });

            objs.push(cardBg);

            const topBarH = 100; 
            const topBar = new fabric.Rect({
                width: FRAME_W, height: topBarH, fill: instaGradient,
                originX: 'center', originY: 'top', left: cx, top: cy - FRAME_H/2
            });

            const camPath = "M10,8 L18,8 L20,4 L36,4 L38,8 L46,8 C48,8 50,10 50,12 L50,36 C50,38 48,40 46,40 L10,40 C8,40 6,38 6,36 L6,12 C6,10 8,8 10,8 M28,14 C22,14 18,18 18,24 C18,30 22,34 28,34 C34,34 38,30 38,24 C38,18 34,14 28,14 M28,18 C31,18 34,21 34,24 C34,27 31,30 28,30 C25,30 22,27 22,24 C22,21 25,18 28,18 M42,11 C42,12 41,13 40,13 C39,13 38,12 38,11 C38,10 39,9 40,9 C41,9 42,10 42,11";
            const camIcon = new fabric.Path(camPath, {
                scaleX: 1.0, scaleY: 1.0, fill: 'transparent', stroke: 'white', strokeWidth: 2,
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 25, top: cy - FRAME_H/2 + topBarH/2
            });

            const logoText = new fabric.IText("Chameleon Printing", {
                fontFamily: FONT_POINT, fontSize: 36, fill: 'white', fontWeight: 'bold', // 지마켓산스
                originX: 'center', originY: 'center', left: cx, top: cy - FRAME_H/2 + topBarH/2
            });

            const planePath = "M2,21L23,12L2,3V10L17,12L2,14V21Z";
            const dmIcon = new fabric.Path(planePath, {
                scaleX: 1.2, scaleY: 1.2, fill: 'white',
                originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 25, top: cy - FRAME_H/2 + topBarH/2
            });

            objs.push(topBar, camIcon, logoText, dmIcon);

            const profileY = cy - FRAME_H/2 + topBarH + 20; 
            const profileH = 70;
            
            const avatar = new fabric.Circle({
                radius: 22, fill: 'white', stroke: '#d6249f', strokeWidth: 2,
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 30, top: profileY + profileH/2
            });

            const username = new fabric.IText("DYB송파_Holloween Day", {
                fontFamily: FONT_SUB, fontSize: 20, fill: '#262626', fontWeight: 'bold',
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 85, top: profileY + profileH/2
            });

            const moreOpts = new fabric.IText("...", {
                fontFamily: 'sans-serif', fontSize: 24, fill: '#262626', fontWeight: 'bold',
                originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 30, top: profileY + profileH/2 - 5
            });

            objs.push(avatar, username, moreOpts);

            const sideMargin = 80; 
            const photoSize = FRAME_W - (sideMargin * 2);
            const imgY = profileY + profileH + 30; 

            const photoBox = new fabric.Rect({
                width: photoSize, height: photoSize, fill: '#555555', 
                originX: 'center', originY: 'top', left: cx, top: imgY
            });
            
            const guideText = new fabric.IText("PHOTO HERE", {
                fontFamily: FONT_POINT, fontSize: 24, fill: '#888',
                originX: 'center', originY: 'center', left: cx, top: imgY + photoSize/2
            });

            objs.push(photoBox, guideText);

            const actionY = imgY + photoSize + 40; 
            const iconScale = 1.3;
            const leftStart = cx - FRAME_W/2 + 30;

            const heartPath = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
            const bubblePath = "M20,2H4C2.9,2,2,2.9,2,4v18l4-4h14c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z";
            const bookmarkPath = "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z";

            const iHeart = new fabric.Path(heartPath, { scaleX: iconScale, scaleY: iconScale, fill: '#ed4956', stroke: '#ed4956', strokeWidth: 1, originX: 'left', originY: 'center', left: leftStart, top: actionY });
            const iComment = new fabric.Path(bubblePath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'left', originY: 'center', left: leftStart + 50, top: actionY });
            const iSave = new fabric.Path(bookmarkPath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 30, top: actionY });

            objs.push(iHeart, iComment, iSave); 

            const textStartY = actionY + 45; 
            
            const likeIconSmall = new fabric.Path(heartPath, { scaleX: 0.6, scaleY: 0.6, fill: '#ed4956', originX: 'left', originY: 'center', left: leftStart, top: textStartY });
            const likesText = new fabric.IText("송오현님 외 999,999명이 좋아합니다", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#262626', fontWeight: 'bold',
                originX: 'left', originY: 'center', left: leftStart + 25, top: textStartY
            });
            
            const hashtags = new fabric.IText("#dyb송파 #할로윈데이 #영어는 #역시 #최선이최고지\n#꿀잼영어 #내가바로 #최선의주인공 #행복 #BAAAMM!", {
                fontFamily: FONT_EMO, fontSize: 20, fill: '#00376b', lineHeight: 1.4, // 나눔손글씨로 변경
                originX: 'left', originY: 'top', left: leftStart, top: textStartY + 25,
                width: FRAME_W - 60, splitByGrapheme: true
            });

            objs.push(likeIconSmall, likesText, hashtags);

            const bottomBarH = 60;
            
            const botBarRect = new fabric.Rect({
                width: FRAME_W, height: bottomBarH, fill: instaGradient,
                left: 0, top: 0
            });

            const homePath = "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z";
            const searchPath = "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
            const boxPlusPath = "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z";
            
            const step = FRAME_W / 5;
            const iconY = bottomBarH / 2; 

            const bHome = new fabric.Path(homePath, { scaleX: 1.5, scaleY: 1.5, fill: 'white', originX: 'center', originY: 'center', left: step/2, top: iconY });
            const bSearch = new fabric.Path(searchPath, { scaleX: 1.5, scaleY: 1.5, fill: 'white', originX: 'center', originY: 'center', left: step/2 + step, top: iconY });
            const bPlus = new fabric.Path(boxPlusPath, { scaleX: 1.5, scaleY: 1.5, fill: 'white', originX: 'center', originY: 'center', left: step/2 + step*2, top: iconY });
            const bHeart = new fabric.Path(heartPath, { scaleX: 1.2, scaleY: 1.2, fill: 'white', originX: 'center', originY: 'center', left: step/2 + step*3, top: iconY });
            const bUser = new fabric.Circle({ radius: 14, fill: 'white', stroke: 'white', strokeWidth: 1, originX: 'center', originY: 'center', left: step/2 + step*4, top: iconY });

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
                const safeW = boardW * 0.85; const safeH = boardH * 0.85;
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