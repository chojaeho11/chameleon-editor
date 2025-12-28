/**
 * text-wizard.js
 * 텍스트 디자인 마법사 (최종 수정: 포스터 테두리 중앙 정렬 & 선택 가능)
 */

(function() {
    // 1. 언어 감지
    const urlParams = new URLSearchParams(window.location.search);
    const currentLang = urlParams.get('lang') ? urlParams.get('lang').toLowerCase() : 'kr';

    // 2. 폰트 설정
    const FONT_TITLE = 'jalnangodic';      // 잘난체
    const FONT_SUB   = 'asdfasfasfsfdf';   // 페이퍼로지
    const FONT_EMO   = 'asfgdfggfgfdg';    // 나눔손글씨
    
    // 3. 스타일 설정
    const COLOR_MAIN = '#5dade2';  // 연하늘색
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
                title: "CAFE MENU", 
                items: [
                    "1. 아메리카노 (HOT/ICE)", "2. 카페라떼", "3. 바닐라 라떼", "4. 카라멜 마키아또", "5. 콜드브루", 
                    "6. 초코 라떼", "7. 녹차 라떼", "8. 레몬 에이드", "9. 자몽 에이드", "10. 허브티"
                ],
                prices: [ "3.5", "4.0", "4.5", "4.5", "4.0", "4.5", "4.5", "5.0", "5.0", "4.0" ]
            },
            bannerH: { main: "GRAND OPENING", sub: "카멜레온 프린팅 신규 런칭", desc: "전시 / 홍보 / 인쇄의 모든 것" },
            bannerV: { main: "ECO-FRIENDLY\nDISPLAY", sub: "친환경 종이집기 제작", desc: "가볍고 튼튼한 허니콤보드" },
            fabric:  { main: "Natural Mood", sub: "Every moment is a fresh beginning.\nKeep your face always toward the sunshine.", bottom: "Since 2025. Chameleon Printing Lab" },
            insta:   { id: "chameleon_official", likes: "좋아요 9,999개", desc: "카멜레온 프린팅과 함께하는\n친환경 전시 라이프 🌱", hash: "#전시 #디자인 #팝업스토어" }
        }
    };

    // 5. 실행 함수
    // 5. 실행 함수
    window.applyNewWizard = function(type) {
        if (!window.canvas) {
            alert("캔버스가 준비되지 않았습니다.");
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
        // ★ 중요: 모든 타입에 대해 자동 리사이징(그룹화) 적용
        let useSafetyGroup = true;

        // ====================================================
        // 디자인 생성
        // ====================================================

        // 1. [행사부스]
        if (type === 'basic') {
            const OFF_WHITE = '#f2f2f2'; 

            // 검정 반투명 배경 상자
            const bgBox = new fabric.Rect({
                width: 650, height: 240, fill: '#d8b909ff', opacity: 0.6,
                originX: 'center', originY: 'center', left: cx, top: cy
            });

            // 라인
            const lineTop = new fabric.Rect({ width: 400, height: STROKE_THIN, fill: OFF_WHITE, originX: 'center', originY: 'center', left: cx, top: cy - 120 });
            const lineBot = new fabric.Rect({ width: 400, height: STROKE_THIN, fill: OFF_WHITE, originX: 'center', originY: 'center', left: cx, top: cy + 120 });
            
            // 텍스트
            const main = new fabric.IText(data.basic.main, {
                fontFamily: FONT_TITLE, fontSize: 65, fill: OFF_WHITE, textAlign: 'center', 
                lineHeight: 0.95, charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 10
            });

            const sub = new fabric.IText(data.basic.sub, {
                fontFamily: FONT_SUB, fontSize: 9, fill: OFF_WHITE, textAlign: 'center',
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy + 150
            });

            // 장식 (01)
            const circleDeco = new fabric.Circle({ 
                radius: 30, fill: 'transparent', stroke: OFF_WHITE, strokeWidth: STROKE_THIN, 
                originX: 'center', originY: 'center', left: cx, top: cy - 180 
            });
            const num = new fabric.IText("01", {
                fontFamily: FONT_TITLE, fontSize: 24, fill: OFF_WHITE, 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 180
            });

            // 도형 4개
            const shapeSize = 22; const gap = 45; const shapeY = cy + 95;
            const shape1 = new fabric.Rect({ width: shapeSize, height: shapeSize, fill: OFF_WHITE, originX: 'center', originY: 'center', left: cx - (gap * 1.5) - (shapeSize/2), top: shapeY });
            const shape2 = new fabric.Triangle({ width: shapeSize + 2, height: shapeSize, fill: OFF_WHITE, originX: 'center', originY: 'center', left: cx - (gap * 0.5), top: shapeY });
            const shape3 = new fabric.Circle({ radius: shapeSize / 2, fill: OFF_WHITE, originX: 'center', originY: 'center', left: cx + (gap * 0.5), top: shapeY });
            const shape4 = new fabric.Rect({ width: shapeSize, height: shapeSize, rx: 3, ry: 3, fill: OFF_WHITE, originX: 'center', originY: 'center', left: cx + (gap * 1.5) + (shapeSize/2), top: shapeY });

            objs = [bgBox, lineTop, lineBot, main, sub, circleDeco, num, shape1, shape2, shape3, shape4];
        }

        // 2. [포스터] (★ 수정됨: 가상 좌표계 사용 + 자동 리사이징)
        else if (type === 'flyer') {
            // useSafetyGroup = true; (기본값)

            // 1. 기준 크기 설정 (이 크기로 만든 후 대지에 맞춰 자동 축소됨)
            const baseW = 600;  // 포스터 기준 너비
            const baseH = 850;  // 포스터 기준 높이
            const refCx = cx;
            const refCy = cy;
            
            // 기준점(좌상단) 계산
            const refLeft = refCx - (baseW / 2);
            const refTop = refCy - (baseH / 2);

            const strokeSize = 20; 
            const padding = 30;    
            const textPadding = 50;

            // 2. 테두리 박스 (기준 크기 내에서 생성)
            const bgBox = new fabric.Rect({
                width: baseW - (padding * 2) - strokeSize, 
                height: baseH - (padding * 2) - strokeSize,
                fill: 'transparent',    
                stroke: '#6a0dad',      
                strokeWidth: strokeSize,            
                opacity: 0.8,
                left: refCx, 
                top: refCy,
                originX: 'center', originY: 'center',
                selectable: true, evented: true, id: 'wizard_bg_frame'
            });

            // 3. 텍스트 요소들 (refLeft, refTop 기준으로 배치)
            const title = new fabric.IText('POSTER\nDESIGN', { 
                fontFamily: FONT_TITLE, fontSize: 75, 
                fill: '#6a0dad',        
                textAlign: 'left', lineHeight: 0.9, charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                left: refLeft + padding + textPadding, 
                top: refTop + (baseH * 0.2), 
                originX: 'left', originY: 'top'
            });
            
            const sub = new fabric.IText(data.flyer.sub, {
                fontFamily: FONT_SUB, fontSize: 16, 
                fill: '#6a0dad',        
                textAlign: 'left', lineHeight: 1.5, charSpacing: 0, fontWeight: 'normal',
                left: refLeft + padding + textPadding,
                top: title.top + title.height + 50,
                originX: 'left', originY: 'top',
                width: (baseW / 2)
            });

            const line = new fabric.Rect({
                width: 250,
                height: 3,              
                fill: '#6a0dad',        
                left: refLeft + padding + textPadding,
                top: sub.top + sub.height + 40,
                originX: 'left', originY: 'center'
            });
            
            const host = new fabric.IText(data.flyer.host, {
                fontFamily: FONT_SUB, fontSize: 14, 
                fill: '#6a0dad',        
                textAlign: 'left', lineHeight: 1.6, charSpacing: 0, fontWeight: 'normal',
                left: refLeft + padding + textPadding,
                top: line.top + 30,
                originX: 'left', originY: 'top'
            });

            objs = [bgBox, title, sub, line, host];
        }

        // 3. [명함] (기존 유지 - 자동 리사이징 적용됨)
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
            const title = new fabric.IText(data.menu.title, { fontFamily: FONT_TITLE, fontSize: 40, fill: COLOR_MAIN, charSpacing: TIGHT_SPACING, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 260 });
            const titleBar = new fabric.Rect({ width: 100, height: STROKE_THIN + 2, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy - 220 });
            const startY = cy - 180; const gap = 38; const centerGap = 130; 
            data.menu.items.forEach((item, i) => {
                const text = new fabric.IText(item, { fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_MAIN, charSpacing: -10, fontWeight: 'normal', originX: 'left', originY: 'center', left: cx - centerGap, top: startY + (i * gap) });
                objs.push(text);
                const price = new fabric.IText(data.menu.prices[i], { fontFamily: FONT_TITLE, fontSize: 16, fill: COLOR_MAIN, charSpacing: 0, fontWeight: 'normal', originX: 'right', originY: 'center', left: cx + centerGap, top: startY + (i * gap) });
                objs.push(price);
            });
            objs.push(title, titleBar);
        }

        // 5. [가로 현수막]
        else if (type === 'banner-h') {
            const circleL = new fabric.Circle({ radius: 30, fill: 'transparent', stroke: COLOR_MAIN, strokeWidth: STROKE_THIN, originX: 'center', originY: 'center', left: cx - 320, top: cy });
            const circleR = new fabric.Circle({ radius: 30, fill: 'transparent', stroke: COLOR_MAIN, strokeWidth: STROKE_THIN, originX: 'center', originY: 'center', left: cx + 320, top: cy });
            const main = new fabric.IText(data.bannerH.main, { fontFamily: FONT_TITLE, fontSize: 50, fill: COLOR_MAIN, charSpacing: TIGHT_SPACING, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 20 });
            const sub = new fabric.IText(data.bannerH.sub, { fontFamily: FONT_SUB, fontSize: 20, fill: COLOR_SUB, charSpacing: -10, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 70 });
            const line = new fabric.Rect({ width: 500, height: STROKE_THIN, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 40 });
            const desc = new fabric.IText(data.bannerH.desc, { fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_SUB, charSpacing: -10, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy + 70 });
            objs = [circleL, circleR, main, sub, line, desc];
        }

        // 6. [세로 배너]
        else if (type === 'banner-v') {
            const triTop = new fabric.Triangle({ width: 120, height: 100, fill: 'transparent', stroke: COLOR_MAIN, strokeWidth: STROKE_THIN, angle: 180, originX: 'center', originY: 'center', left: cx, top: cy - 260 });
            const triBot = new fabric.Triangle({ width: 120, height: 100, fill: 'transparent', stroke: COLOR_MAIN, strokeWidth: STROKE_THIN, originX: 'center', originY: 'center', left: cx, top: cy + 260 });
            const main = new fabric.IText(data.bannerV.main, { fontFamily: FONT_TITLE, fontSize: 45, fill: COLOR_MAIN, textAlign: 'center', lineHeight: 0.85, charSpacing: TIGHT_SPACING, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 40 });
            const sub = new fabric.IText(data.bannerV.sub, { fontFamily: FONT_SUB, fontSize: 18, fill: COLOR_SUB, charSpacing: -10, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 140 });
            const box = new fabric.Rect({ width: 150, height: STROKE_THIN + 2, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 60 });
            const desc = new fabric.IText(data.bannerV.desc, { fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_SUB, charSpacing: -10, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy + 100 });
            objs = [triTop, triBot, main, sub, box, desc];
        }

        // 7. [패브릭]
        else if (type === 'fabric') {
            const main = new fabric.IText(data.fabric.main, { fontFamily: FONT_EMO, fontSize: 40, fill: COLOR_MAIN, textAlign: 'center', lineHeight: 1.0, charSpacing: -10, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 150 });
            const sub = new fabric.IText(data.fabric.sub, { fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_SUB, textAlign: 'center', charSpacing: -10, fontWeight: 'normal', lineHeight: 1.5, originX: 'center', originY: 'center', left: cx, top: cy - 90 });
            const guideCircle = new fabric.Circle({ radius: 80, fill: '#f0f8ff', originX: 'center', originY: 'center', left: cx, top: cy + 20 });
            const guideText = new fabric.IText("Photo Here", { fontFamily: FONT_SUB, fontSize: 14, fill: '#87ceeb', fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy + 20 });
            const bottom = new fabric.IText(data.fabric.bottom, { fontFamily: FONT_SUB, fontSize: 14, fill: COLOR_MAIN, charSpacing: -10, fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy + 180 });
            objs = [main, sub, guideCircle, guideText, bottom];
        }

        // 8. [세로 글씨 - 인스타]
        else if (type === 'vertical-text') {
            const profileName = new fabric.IText(data.insta.id, { fontFamily: FONT_TITLE, fontSize: 16, fill: COLOR_MAIN, charSpacing: -10, fontWeight: 'normal', originX: 'left', originY: 'bottom', left: cx - 120, top: cy - 170 });
            const dot1 = new fabric.Circle({ radius: 2, fill: COLOR_MAIN, left: cx + 100, top: cy - 175 });
            const dot2 = new fabric.Circle({ radius: 2, fill: COLOR_MAIN, left: cx + 108, top: cy - 175 });
            const dot3 = new fabric.Circle({ radius: 2, fill: COLOR_MAIN, left: cx + 116, top: cy - 175 });
            const photoArea = new fabric.Rect({ width: 240, height: 240, fill: '#f0f8ff', originX: 'center', originY: 'center', left: cx, top: cy - 40 });
            const photoText = new fabric.IText("PHOTO HERE", { fontFamily: FONT_SUB, fontSize: 16, fill: '#87ceeb', fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy - 40 });
            const likes = new fabric.IText(data.insta.likes, { fontFamily: FONT_TITLE, fontSize: 14, fill: COLOR_MAIN, charSpacing: TIGHT_SPACING, fontWeight: 'normal', originX: 'left', originY: 'top', left: cx - 120, top: cy + 90 });
            const desc = new fabric.IText(data.insta.desc, { fontFamily: FONT_SUB, fontSize: 13, fill: COLOR_SUB, lineHeight: 1.4, charSpacing: -10, fontWeight: 'normal', originX: 'left', originY: 'top', left: cx - 120, top: cy + 115 });
            const hash = new fabric.IText(data.insta.hash, { fontFamily: FONT_SUB, fontSize: 12, fill: '#0077b6', charSpacing: -10, fontWeight: 'normal', originX: 'left', originY: 'top', left: cx - 120, top: cy + 160 });
            objs = [profileName, dot1, dot2, dot3, photoArea, photoText, likes, desc, hash];
        }

        // ===============================================
        // 캔버스 추가 및 렌더링
        // ===============================================
        if (objs.length > 0) {
            if (useSafetyGroup) {
                // [기존 방식] 중앙 정렬 및 안전 스케일링
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
                // [신규 방식] 포스터 타입: 절대 위치 배치 + 개별 선택
                objs.forEach(obj => { 
                    canvas.add(obj); 
                    obj.setCoords(); 
                });
                canvas.requestRenderAll();

                // 렌더링 안정화 후 모든 객체(테두리 포함)를 ActiveSelection으로 만듦
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