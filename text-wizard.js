/**
 * text-wizard.js
 * 텍스트 디자인 마법사 (V15: 서체명 긴급 수정 & 디자인 최적화)
 * * [수정 사항]
 * 1. ★서체명 수정: 'JalnanGothic' -> 'jalnangodic' (관리자 화면 ID와 일치시킴)
 * 2. 서체 설정:
 * - 제목: 'jalnangodic' (잘난고딕)
 * - 본문: 'Paperlogy' (페이퍼로지)
 * - 감성: 'Nanum Pen Script' (나눔손글씨)
 * 3. 볼드 제거: 서체 본연의 모양을 살리기 위해 fontWeight: 'normal' 고정
 * 4. 자간/행간: 세련된 비율로 미세 조정
 */

(function() {
    // 1. 언어 감지
    const urlParams = new URLSearchParams(window.location.search);
    const currentLang = urlParams.get('lang') ? urlParams.get('lang').toLowerCase() : 'kr';

    // 2. 폰트 설정 (관리자 화면 ID 기준)
    // ★ 여기가 틀려서 안 나왔던 것 수정 완료!
    const FONT_TITLE = 'jalnangodic';      // 관리자 ID: jalnangodic
    const FONT_SUB   = 'Paperlogy';        // 본문용
    const FONT_EMO   = 'Nanum Pen Script'; // 감성용
    
    // 3. 스타일 설정
    const COLOR_MAIN = '#222222'; 
    const COLOR_GRAY = '#555555'; 
    const TIGHT_SPACING = -30;    // 자간 좁게
    const LINE_HEIGHT_TITLE = 0.85; // 제목 행간 (밀도있게)

    // 4. 내용 데이터
    const WIZ_DATA = {
        kr: {
            basic:   { main: "CHAMELEON\nEXHIBITION", sub: "친환경 전시 부스 솔루션", deco: "01" },
            flyer:   { main: "PAPER\nWORLD", sub: "종이로 만드는 새로운 세상\n허니콤보드 디자인 전시", host: "주최 : 카멜레온 프린팅   |   주관 : 디자인연구소\n후원 : 한국전시산업진흥회" },
            card:    { name: "행복한마을", job: "Design Team Manager", phone: "010-1234-5678", email: "design@chameleon.co.kr", company: "CHAMELEON" },
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
    window.applyNewWizard = function(type) {
        if (!window.canvas) {
            alert("캔버스가 준비되지 않았습니다.");
            return;
        }

        const canvas = window.canvas;
        const data = WIZ_DATA[currentLang] || WIZ_DATA['kr'];

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

        let objs = [];

        // ====================================================
        // 디자인 생성
        // ====================================================

        // 1. [행사부스]
        if (type === 'basic') {
            const lineTop = new fabric.Rect({ width: 400, height: 4, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy - 120 });
            const lineBot = new fabric.Rect({ width: 400, height: 4, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 120 });
            
            const main = new fabric.IText(data.basic.main, {
                fontFamily: FONT_TITLE, fontSize: 55, fill: COLOR_MAIN, textAlign: 'center', 
                lineHeight: LINE_HEIGHT_TITLE, charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy
            });
            const sub = new fabric.IText(data.basic.sub, {
                fontFamily: FONT_SUB, fontSize: 18, fill: COLOR_GRAY, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy + 70
            });
            const circleDeco = new fabric.Circle({ radius: 30, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy - 180 });
            const num = new fabric.IText("01", {
                fontFamily: FONT_TITLE, fontSize: 24, fill: '#fff', 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 180
            });
            objs = [lineTop, lineBot, main, sub, circleDeco, num];
        }

        // 2. [포스터]
        else if (type === 'flyer') {
            const title = new fabric.IText(data.flyer.main, {
                fontFamily: FONT_TITLE, fontSize: 80, fill: COLOR_MAIN, textAlign: 'left', 
                lineHeight: LINE_HEIGHT_TITLE, charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'left', originY: 'top', left: cx - 200, top: cy - 300
            });
            
            const sub = new fabric.IText(data.flyer.sub, {
                fontFamily: FONT_SUB, fontSize: 20, fill: COLOR_MAIN, textAlign: 'left', 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'left', originY: 'top', left: cx - 200, top: cy + 50
            });
            const line = new fabric.Rect({ width: 400, height: 2, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 200 });
            
            const host = new fabric.IText(data.flyer.host, {
                fontFamily: FONT_SUB, fontSize: 14, fill: COLOR_GRAY, textAlign: 'center', lineHeight: 1.6, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'top', left: cx, top: cy + 220
            });
            objs = [title, sub, line, host];
        }

        // 3. [명함]
        else if (type === 'card') {
            const company = new fabric.IText(data.card.company, {
                fontFamily: FONT_TITLE, fontSize: 20, fill: COLOR_MAIN, 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'left', originY: 'center', left: cx - 200, top: cy - 100
            });
            
            const name = new fabric.IText(data.card.name, {
                fontFamily: FONT_TITLE, fontSize: 36, fill: COLOR_MAIN, 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'left', originY: 'center', left: cx - 200, top: cy
            });
            const job = new fabric.IText(data.card.job, {
                fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_GRAY, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'left', originY: 'top', left: cx - 200, top: cy + 30
            });
            const contact = new fabric.IText(data.card.phone + "\n" + data.card.email, {
                fontFamily: FONT_SUB, fontSize: 14, fill: COLOR_GRAY, textAlign: 'right', lineHeight: 1.6, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'right', originY: 'top', left: cx + 200, top: cy + 80
            });
            objs = [company, name, job, contact];
        }

        // 4. [메뉴판]
        else if (type === 'menu') {
            const title = new fabric.IText(data.menu.title, {
                fontFamily: FONT_TITLE, fontSize: 40, fill: COLOR_MAIN, 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 260
            });
            const titleBar = new fabric.Rect({ width: 100, height: 6, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy - 220 });

            const startY = cy - 180;
            const gap = 38; 
            const centerGap = 130; 
            
            data.menu.items.forEach((item, i) => {
                const text = new fabric.IText(item, {
                    fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_MAIN, 
                    charSpacing: -10, fontWeight: 'normal',
                    originX: 'left', originY: 'center', left: cx - centerGap, top: startY + (i * gap)
                });
                objs.push(text);
                
                const price = new fabric.IText(data.menu.prices[i], {
                    fontFamily: FONT_TITLE, fontSize: 16, fill: COLOR_MAIN, 
                    charSpacing: 0, fontWeight: 'normal',
                    originX: 'right', originY: 'center', left: cx + centerGap, top: startY + (i * gap)
                });
                objs.push(price);
            });
            objs.push(title, titleBar);
        }

        // 5. [가로 현수막]
        else if (type === 'banner-h') {
            const circleL = new fabric.Circle({ radius: 30, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx - 320, top: cy });
            const circleR = new fabric.Circle({ radius: 30, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx + 320, top: cy });
            
            const main = new fabric.IText(data.bannerH.main, {
                fontFamily: FONT_TITLE, fontSize: 50, fill: COLOR_MAIN, 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 20
            });
            const sub = new fabric.IText(data.bannerH.sub, {
                fontFamily: FONT_SUB, fontSize: 20, fill: COLOR_MAIN, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 70
            });
            const line = new fabric.Rect({ width: 500, height: 2, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 40 });
            const desc = new fabric.IText(data.bannerH.desc, {
                fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_MAIN, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy + 70
            });
            objs = [circleL, circleR, main, sub, line, desc];
        }

        // 6. [세로 배너]
        else if (type === 'banner-v') {
            const triTop = new fabric.Triangle({ width: 120, height: 100, fill: COLOR_MAIN, angle: 180, originX: 'center', originY: 'center', left: cx, top: cy - 260 });
            const triBot = new fabric.Triangle({ width: 120, height: 100, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 260 });
            
            const main = new fabric.IText(data.bannerV.main, {
                fontFamily: FONT_TITLE, fontSize: 45, fill: COLOR_MAIN, textAlign: 'center', 
                lineHeight: LINE_HEIGHT_TITLE, charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 40
            });
            const sub = new fabric.IText(data.bannerV.sub, {
                fontFamily: FONT_SUB, fontSize: 18, fill: COLOR_GRAY, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 140
            });
            const box = new fabric.Rect({ width: 150, height: 6, fill: COLOR_MAIN, originX: 'center', originY: 'center', left: cx, top: cy + 60 });
            const desc = new fabric.IText(data.bannerV.desc, {
                fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_MAIN, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy + 100
            });
            objs = [triTop, triBot, main, sub, box, desc];
        }

        // 7. [패브릭]
        else if (type === 'fabric') {
            const main = new fabric.IText(data.fabric.main, {
                fontFamily: FONT_EMO, fontSize: 40, fill: COLOR_MAIN, textAlign: 'center', lineHeight: 1.0, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 150
            });
            const sub = new fabric.IText(data.fabric.sub, {
                fontFamily: FONT_SUB, fontSize: 16, fill: COLOR_GRAY, textAlign: 'center',
                charSpacing: -10, fontWeight: 'normal', lineHeight: 1.5,
                originX: 'center', originY: 'center', left: cx, top: cy - 90
            });
            
            const guideCircle = new fabric.Circle({ radius: 80, fill: '#f0f0f0', originX: 'center', originY: 'center', left: cx, top: cy + 20 });
            const guideText = new fabric.IText("Photo Here", {
                fontFamily: FONT_SUB, fontSize: 14, fill: '#ccc', fontWeight: 'normal', originX: 'center', originY: 'center', left: cx, top: cy + 20
            });
            
            const bottom = new fabric.IText(data.fabric.bottom, {
                fontFamily: FONT_SUB, fontSize: 14, fill: COLOR_MAIN, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy + 180
            });
            objs = [main, sub, guideCircle, guideText, bottom];
        }

        // 8. [세로 글씨 - 인스타]
        else if (type === 'vertical-text') {
            const profileName = new fabric.IText(data.insta.id, {
                fontFamily: FONT_TITLE, fontSize: 16, fill: COLOR_MAIN, 
                charSpacing: -10, fontWeight: 'normal', 
                originX: 'left', originY: 'bottom', left: cx - 120, top: cy - 170
            });

            // 점 3개
            const dot1 = new fabric.Circle({ radius: 2, fill: COLOR_MAIN, left: cx + 100, top: cy - 175 });
            const dot2 = new fabric.Circle({ radius: 2, fill: COLOR_MAIN, left: cx + 108, top: cy - 175 });
            const dot3 = new fabric.Circle({ radius: 2, fill: COLOR_MAIN, left: cx + 116, top: cy - 175 });

            const photoArea = new fabric.Rect({ 
                width: 240, height: 240, fill: '#f0f0f0', 
                originX: 'center', originY: 'center', left: cx, top: cy - 40 
            });
            const photoText = new fabric.IText("PHOTO HERE", {
                fontFamily: FONT_SUB, fontSize: 16, fill: '#ccc', fontWeight: 'normal', 
                originX: 'center', originY: 'center', left: cx, top: cy - 40
            });

            const likes = new fabric.IText(data.insta.likes, {
                fontFamily: FONT_TITLE, fontSize: 14, fill: COLOR_MAIN, 
                charSpacing: TIGHT_SPACING, fontWeight: 'normal',
                originX: 'left', originY: 'top', left: cx - 120, top: cy + 90
            });
            const desc = new fabric.IText(data.insta.desc, {
                fontFamily: FONT_SUB, fontSize: 13, fill: COLOR_MAIN, lineHeight: 1.4, 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'left', originY: 'top', left: cx - 120, top: cy + 115
            });
            const hash = new fabric.IText(data.insta.hash, {
                fontFamily: FONT_SUB, fontSize: 12, fill: '#00376b', 
                charSpacing: -10, fontWeight: 'normal',
                originX: 'left', originY: 'top', left: cx - 120, top: cy + 160
            });

            objs = [
                profileName, dot1, dot2, dot3,
                photoArea, photoText,
                likes, desc, hash
            ];
        }

        // ===============================================
        // 스마트 리사이징 & 배치
        // ===============================================
        if (objs.length > 0) {
            const group = new fabric.Group(objs, {
                left: cx, top: cy, originX: 'center', originY: 'center'
            });

            const safeW = boardW * 0.85;
            const safeH = boardH * 0.85;
            const scale = Math.min(safeW / group.width, safeH / group.height);

            group.scale(scale);
            group.setCoords();

            canvas.add(group);
            canvas.requestRenderAll();

            const activeSel = group.toActiveSelection();
            canvas.setActiveObject(activeSel);
            
            activeSel.set('opacity', 0);
            activeSel.animate('opacity', 1, {
                duration: 500,
                onChange: canvas.renderAll.bind(canvas),
                easing: fabric.util.ease.easeOutQuad
            });
        }
    };
})();