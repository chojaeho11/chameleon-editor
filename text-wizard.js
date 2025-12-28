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
        // 4. [메뉴판] - 완벽한 돔(Dome)형 아치 배경
        else if (type === 'menu') {
            // 아치형 배경 색상 (크림색) & 테두리
            const BG_COLOR = '#FFFDF9'; 
            const BORDER_COLOR = '#D4AF37'; // 샴페인 골드
            const TEXT_COLOR = '#4A4A4A';   // 짙은 회색

            // 1. 아치형 배경 (SVG Arc 이용 - 종 모양/돔 형태)
            // M(시작) -> L(직선) -> A(반원 아치) -> L(직선) -> Z(닫기)
            // A 250 250 ... 부분이 완벽한 반원을 그리는 명령어입니다.
            const archPath = "M -250 350 L -250 -150 A 250 250 0 0 1 250 -150 L 250 350 Z";

            const bgArch = new fabric.Path(archPath, {
                fill: BG_COLOR,
                stroke: BORDER_COLOR,
                strokeWidth: 2,
                opacity: 0.85, // 투명도 유지
                originX: 'center', originY: 'center',
                left: cx, top: cy,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 10, offsetX: 5, offsetY: 5 })
            });

            objs.push(bgArch);

            // 2. 타이틀 (아치가 높아진 만큼 위로 조정)
            // top: cy - 230 -> cy - 260 (위로 30px 이동)
            const title = new fabric.IText(data.menu.title, { 
                fontFamily: FONT_TITLE, fontSize: 45, fill: '#8B4513', 
                charSpacing: TIGHT_SPACING, fontWeight: 'bold', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy - 260 
            });
            
            // 타이틀 장식 선
            const titleLine = new fabric.Rect({ 
                width: 60, height: 2, fill: '#8B4513', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy - 220 
            });

            objs.push(title, titleLine);

            // 3. 메뉴 리스트 배치 (기존 위치 유지)
            const startY = cy - 140; 
            const gap = 35; 
            const textLeft = cx - 180; 
            const priceRight = cx + 180; 
            
            // 점선 생성 헬퍼
            const makeDotLine = (y) => {
                const dots = new fabric.IText("..........................................", {
                    fontFamily: FONT_SUB, fontSize: 12, fill: '#ccc',
                    originX: 'center', originY: 'center',
                    left: cx, top: y
                });
                if(dots.width > 280) dots.scaleX = 280 / dots.width;
                return dots;
            };

            data.menu.items.forEach((item, i) => {
                const currentY = startY + (i * gap);

                // 메뉴명
                const menuName = new fabric.IText(item, { 
                    fontFamily: FONT_SUB, fontSize: 15, fill: TEXT_COLOR, 
                    fontWeight: 'normal', textAlign: 'left',
                    originX: 'left', originY: 'center', 
                    left: textLeft, top: currentY 
                });
                
                // 가격
                const menuPrice = new fabric.IText(data.menu.prices[i], { 
                    fontFamily: FONT_SUB, fontSize: 15, fill: '#8B4513', 
                    fontWeight: 'bold', textAlign: 'right',
                    originX: 'right', originY: 'center', 
                    left: priceRight, top: currentY 
                });

                // 점선
                const dotLine = makeDotLine(currentY + 2);

                objs.push(dotLine, menuName, menuPrice);
            });

            // 4. 하단 문구
            const footer = new fabric.IText("Bon Appetit", { 
                fontFamily: 'cursive', fontSize: 24, fill: '#D4AF37', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy + 280 
            });
            
            objs.push(footer);
        }

        // 5. [가로 현수막]
        // 5. [가로 현수막] - 둥근 별 & 텍스트 위치 하향 조정
        else if (type === 'banner-h') {
            // 색상 설정
            const STAR_COLOR = '#FFD700'; // 예쁜 노랑 (Gold)
            const TEXT_COLOR = '#E6A000'; // 글씨용 진한 노랑 (Dark Goldenrod)
            
            // ★ 둥근 별 모양 벡터 경로 (Rounded Star Path)
            // 베지어 곡선을 사용하여 모서리가 둥글게 처리된 별입니다.
            const starPath = "M26,3.6c1.1-3.3,5.8-3.3,6.9,0l6.1,18.7c0.5,1.5,1.9,2.5,3.4,2.5h19.7c3.5,0,4.9,4.4,2.1,6.5L48.3,44.2 c-1.2,0.9-1.8,2.4-1.3,3.9l6.1,18.7c1.1,3.3-2.7,6.1-5.6,3.9L31.4,59.3c-1.2-0.9-2.9-0.9-4.1,0L11.4,70.7 c-2.8,2.1-6.7-0.6-5.6-3.9l6.1-18.7c0.5-1.5-0.1-3-1.3-3.9L-5.3,31.3c-2.8-2.1-1.4-6.5,2.1-6.5h19.7c1.5,0,2.9-1,3.4-2.5L26,3.6z";

            // 1. 왼쪽 메인 별
            const starL = new fabric.Path(starPath, {
                scaleX: 1.3, scaleY: 1.3, // 크기 조정
                fill: STAR_COLOR, stroke: '#e0c000', strokeWidth: 1,
                originX: 'center', originY: 'center', 
                left: cx - 360, top: cy - 20
            });

            // 2. 오른쪽 메인 별
            const starR = new fabric.Path(starPath, {
                scaleX: 1.3, scaleY: 1.3, // 크기 조정
                fill: STAR_COLOR, stroke: '#e0c000', strokeWidth: 1,
                originX: 'center', originY: 'center', 
                left: cx + 360, top: cy - 20
            });

            // 3. 꾸밈용 작은 별들 생성 함수
            const makeMiniStar = (x, y, scale) => new fabric.Path(starPath, {
                scaleX: scale, scaleY: scale, 
                fill: STAR_COLOR, 
                originX: 'center', originY: 'center', 
                left: x, top: y
            });

            // 작은 별들 배치
            const s1 = makeMiniStar(cx - 300, cy - 60, 0.5);
            const s2 = makeMiniStar(cx - 410, cy + 20, 0.4);
            const s3 = makeMiniStar(cx - 340, cy + 50, 0.3);

            const s4 = makeMiniStar(cx + 300, cy - 60, 0.5);
            const s5 = makeMiniStar(cx + 410, cy + 20, 0.4);
            const s6 = makeMiniStar(cx + 340, cy + 50, 0.3);

            // 4. 텍스트 설정 (위치 하향 조정)
            // 메인 타이틀: cy - 20 -> cy + 10 (30px 내림)
            const main = new fabric.IText(data.bannerH.main, { 
                fontFamily: FONT_TITLE, fontSize: 50, fill: TEXT_COLOR, 
                charSpacing: TIGHT_SPACING, fontWeight: 'bold', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy + 10 
            });

            // 서브 타이틀: cy - 70 -> cy - 40 (30px 내림)
            const sub = new fabric.IText(data.bannerH.sub, { 
                fontFamily: FONT_SUB, fontSize: 20, fill: TEXT_COLOR, 
                charSpacing: -10, fontWeight: 'normal', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy - 40 
            });

            // 라인: cy + 40 -> cy + 70 (30px 내림)
            const line = new fabric.Rect({ 
                width: 500, height: 2, fill: TEXT_COLOR, 
                originX: 'center', originY: 'center', 
                left: cx, top: cy + 70 
            });

            // 설명: cy + 70 -> cy + 100 (30px 내림)
            const desc = new fabric.IText(data.bannerH.desc, { 
                fontFamily: FONT_SUB, fontSize: 16, fill: TEXT_COLOR, 
                charSpacing: -10, fontWeight: 'normal', 
                originX: 'center', originY: 'center', 
                left: cx, top: cy + 100 
            });

            // 최종 객체 목록
            objs = [starL, starR, s1, s2, s3, s4, s5, s6, main, sub, line, desc];
        }

        // 6. [세로 배너]
        // 6. [세로 배너] - 그림자/효과 제거 & 순수 도형/텍스트 버전
        else if (type === 'banner-v') {
            // 컬러 팔레트
            const NAVY = '#1a237e';   
            const BLUE = '#283593';   
            const YELLOW = '#fdd835'; 
            
            // 도형 위치 기준점 (이전과 동일하게 멀리 배치)
            const topShapeY = cy - 520; 
            const botShapeY = cy + 580; 

            // 1. 상단 브랜드 로고 바
            const brandBar = new fabric.Rect({
                width: 180, height: 35, fill: NAVY,
                originX: 'left', originY: 'top', left: cx - 280, top: topShapeY
            });
            const brandText = new fabric.IText("CHAMELEON", {
                fontFamily: 'sans-serif', fontSize: 16, fill: '#fff', fontWeight: 'bold',
                originX: 'left', originY: 'center', left: cx - 270, top: topShapeY + 17
            });

            // 2. 상단 우측 삼각형
            const topTri = new fabric.Triangle({
                width: 160, height: 160, fill: BLUE, opacity: 1, // 투명도 제거 (순수 색상)
                originX: 'center', originY: 'center', 
                left: cx + 220, top: topShapeY, angle: 180
            });

            // === 메인 타이틀 영역 (그림자 제거) ===
            // SHOP (그림자 속성 삭제, 노란색)
            const title1 = new fabric.IText("SHOP", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: YELLOW, fontWeight: 'bold',
                originX: 'center', originY: 'bottom', left: cx, top: cy - 250
            });
            // FORUM
            const title2 = new fabric.IText("FORUM", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                originX: 'center', originY: 'top', left: cx, top: cy - 250
            });
            // 2025
            const title3 = new fabric.IText("2025", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                originX: 'center', originY: 'top', left: cx, top: cy - 140
            });
            
            // (글로우 효과 제거됨 - 깔끔한 흰 배경 유지를 위해 삭제)

            // 중간 구분선
            const divider = new fabric.Rect({
                width: 500, height: 4, fill: NAVY,
                originX: 'center', originY: 'center', left: cx, top: cy - 20
            });

            // === 본문 컨텐츠 ===
            const startContentY = cy + 40;

            // 1. QR 코드 섹션
            const step1 = new fabric.IText("1. QR코드를 찍어주세요", {
                fontFamily: FONT_SUB, fontSize: 22, fill: NAVY, fontWeight: 'bold',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY
            });
            const step1Sub = new fabric.IText("※ 홈페이지 신청가능\nwww.chameleon.co.kr", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#666', lineHeight: 1.4,
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 35
            });
            // QR 박스 (단순 선 도형)
            const qrBox = new fabric.Rect({
                width: 80, height: 80, fill: 'transparent', stroke: NAVY, strokeWidth: 3,
                originX: 'right', originY: 'top', left: cx + 240, top: startContentY
            });
            const qrText = new fabric.IText("QR", {
                fontFamily: FONT_SUB, fontSize: 24, fill: NAVY, fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx + 200, top: startContentY + 40
            });

            // 2. 사전등록 안내
            const step2 = new fabric.IText("2. 사전 등록 하신 분은", {
                fontFamily: FONT_SUB, fontSize: 20, fill: NAVY, fontWeight: 'bold',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 120
            });

            // [수정] EVENT 배지 -> 순수 도형(Rect) + 글자(IText) 조합
            const badge1Bg = new fabric.Rect({
                width: 70, height: 24, fill: YELLOW, rx: 4, ry: 4, // 둥근 모서리
                originX: 'left', originY: 'top', left: cx + 10, top: startContentY + 120
            });
            const badge1Text = new fabric.IText("EVENT", {
                fontFamily: FONT_SUB, fontSize: 14, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx + 45, top: startContentY + 132
            });

            const step2Desc = new fabric.IText("등록하신 정보로 Log In (샵 포럼 참여하기)\n▶ Log In 화면을 STAFF 에게 보여 주세요!", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#444', lineHeight: 1.5,
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 155
            });

            // 3. 현장등록 안내
            const step3 = new fabric.IText("3. 사전 등록을 하지 못한 분은", {
                fontFamily: FONT_SUB, fontSize: 20, fill: NAVY, fontWeight: 'bold',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 230
            });

            // [수정] 참가신청 배지 -> 순수 도형(Rect) + 글자(IText) 조합
            const badge2Bg = new fabric.Rect({
                width: 80, height: 24, fill: YELLOW, rx: 4, ry: 4,
                originX: 'left', originY: 'top', left: cx + 65, top: startContentY + 230
            });
            const badge2Text = new fabric.IText("참가신청", {
                fontFamily: FONT_SUB, fontSize: 14, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx + 105, top: startContentY + 242
            });

            const step3Desc = new fabric.IText("정보 입력 후 위 2번을 진행해 주세요.", {
                fontFamily: FONT_SUB, fontSize: 15, fill: '#444',
                originX: 'left', originY: 'top', left: cx - 240, top: startContentY + 265
            });

            // === 하단 기하학적 패턴 ===
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

            // 최종 객체 목록
            objs = [
                brandBar, brandText, topTri, 
                title1, title2, title3, divider, // glow 제거됨
                step1, step1Sub, qrBox, qrText,
                step2, badge1Bg, badge1Text, step2Desc,
                step3, badge2Bg, badge2Text, step3Desc,
                botRightTri, stripeGroup
            ];
        }

        // 7. [패브릭]
        // 7. [패브릭] - 기울임 제거 & 기본 서체 최적화
        else if (type === 'fabric') {
            // 컬러 팔레트
            const NAVY = '#0b1e47';    
            const BROWN = '#5d4c44';   
            const GOLD = '#fecb00';    
            const BTN_BLUE = '#5282d6';
            const SNOW_COLOR = '#a2cdf6'; 

            // === 1. 상단 장식 및 소제목 ===
            const topLabel = new fabric.IText("Chameleon Event", {
                fontFamily: 'sans-serif', fontSize: 16, fill: '#2e7d32', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx, top: cy - 350
            });
            
            // [수정] 이탤릭 제거
            const subLine = new fabric.IText("카멜레온, 디자인, 적립금, 2배 LET'S GO", {
                fontFamily: FONT_SUB, fontSize: 14, fill: '#666', fontWeight: 'normal',
                originX: 'center', originY: 'center', left: cx, top: cy - 320
            });
            
            const lineDecor = new fabric.Rect({
                width: 400, height: 1, fill: '#ddd',
                originX: 'center', originY: 'center', left: cx, top: cy - 300
            });

            // === 2. 메인 타이틀 ===
            const title1 = new fabric.IText("걸어서", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                charSpacing: -50, 
                originX: 'center', originY: 'bottom', left: cx, top: cy - 140
            });

            const title2 = new fabric.IText("혜택속으로", {
                fontFamily: FONT_TITLE, fontSize: 110, fill: NAVY, fontWeight: 'bold',
                charSpacing: -50,
                originX: 'center', originY: 'top', left: cx, top: cy - 140
            });

            const desc = new fabric.IText("운영자 피셜, 지금껏 오픈한 서비스 중\n가장 뜨거운 관심을 받았던 <카멜레온 만보기>", {
                fontFamily: FONT_SUB, fontSize: 16, fill: '#555', textAlign: 'center', lineHeight: 1.5,
                originX: 'center', originY: 'center', left: cx, top: cy + 20
            });

            // === 3. 하단 브라운 박스 ===
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
            
            // [수정] 이탤릭 제거 & 굵게 강조
            const coinText = new fabric.IText("P", {
                fontFamily: 'sans-serif', fontSize: 40, fill: 'white', fontWeight: 'bold', 
                originX: 'center', originY: 'center', left: cx, top: boxTopY
            });
            
            const benefitLabel = new fabric.IText("BENEFIT", {
                fontFamily: 'sans-serif', fontSize: 12, fill: 'white', fontWeight: 'bold',
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

            // === 4. 눈송이 장식 ===
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
            const FRAME_H = 980; // ★ 높이 설정
            
            // 1. 인스타 그라데이션
            const instaGradient = new fabric.Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: FRAME_W, y2: 0 },
                colorStops: [
                    { offset: 0, color: '#833ab4' },
                    { offset: 0.5, color: '#fd1d1d' },
                    { offset: 1, color: '#fcb045' }
                ]
            });

            // 2. 전체 흰색 배경 카드
            const cardBg = new fabric.Rect({
                width: FRAME_W, height: FRAME_H, fill: 'white',
                originX: 'center', originY: 'center', left: cx, top: cy,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 20 })
            });

            objs.push(cardBg);

            // === 3. 상단 바 (높이 100) ===
            const topBarH = 100; 
            const topBar = new fabric.Rect({
                width: FRAME_W, height: topBarH, fill: instaGradient,
                originX: 'center', originY: 'top', left: cx, top: cy - FRAME_H/2
            });

            // 카메라 아이콘
            const camPath = "M10,8 L18,8 L20,4 L36,4 L38,8 L46,8 C48,8 50,10 50,12 L50,36 C50,38 48,40 46,40 L10,40 C8,40 6,38 6,36 L6,12 C6,10 8,8 10,8 M28,14 C22,14 18,18 18,24 C18,30 22,34 28,34 C34,34 38,30 38,24 C38,18 34,14 28,14 M28,18 C31,18 34,21 34,24 C34,27 31,30 28,30 C25,30 22,27 22,24 C22,21 25,18 28,18 M42,11 C42,12 41,13 40,13 C39,13 38,12 38,11 C38,10 39,9 40,9 C41,9 42,10 42,11";
            const camIcon = new fabric.Path(camPath, {
                scaleX: 1.0, scaleY: 1.0, fill: 'transparent', stroke: 'white', strokeWidth: 2,
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 25, top: cy - FRAME_H/2 + topBarH/2
            });

            // 로고 텍스트
            const logoText = new fabric.IText("Chameleon Printing", {
                fontFamily: FONT_TITLE, fontSize: 36, fill: 'white', fontWeight: 'bold',
                originX: 'center', originY: 'center', left: cx, top: cy - FRAME_H/2 + topBarH/2
            });

            // DM 종이비행기
            const planePath = "M2,21L23,12L2,3V10L17,12L2,14V21Z";
            const dmIcon = new fabric.Path(planePath, {
                scaleX: 1.2, scaleY: 1.2, fill: 'white',
                originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 25, top: cy - FRAME_H/2 + topBarH/2
            });

            objs.push(topBar, camIcon, logoText, dmIcon);

            // === 4. 프로필 영역 ===
            const profileY = cy - FRAME_H/2 + topBarH + 20; 
            const profileH = 70;
            
            const avatar = new fabric.Circle({
                radius: 22, fill: 'white', stroke: '#d6249f', strokeWidth: 2,
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 30, top: profileY + profileH/2
            });

            const username = new fabric.IText("DYB송파_Holloween Day", {
                fontFamily: 'sans-serif', fontSize: 20, fill: '#262626', fontWeight: 'bold',
                originX: 'left', originY: 'center', left: cx - FRAME_W/2 + 85, top: profileY + profileH/2
            });

            const moreOpts = new fabric.IText("...", {
                fontFamily: 'sans-serif', fontSize: 24, fill: '#262626', fontWeight: 'bold',
                originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 30, top: profileY + profileH/2 - 5
            });

            objs.push(avatar, username, moreOpts);

            // === 5. 메인 포토 영역 ===
            const sideMargin = 80; 
            const photoSize = FRAME_W - (sideMargin * 2);
            const imgY = profileY + profileH + 30; 

            const photoBox = new fabric.Rect({
                width: photoSize, height: photoSize, fill: '#555555', 
                originX: 'center', originY: 'top', left: cx, top: imgY
            });
            
            const guideText = new fabric.IText("PHOTO HERE", {
                fontFamily: 'sans-serif', fontSize: 24, fill: '#888',
                originX: 'center', originY: 'center', left: cx, top: imgY + photoSize/2
            });

            objs.push(photoBox, guideText);

            // === 6. 액션 버튼 (수정: 종이비행기 삭제) ===
            const actionY = imgY + photoSize + 40; 
            const iconScale = 1.3;
            const leftStart = cx - FRAME_W/2 + 30;

            const heartPath = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
            const bubblePath = "M20,2H4C2.9,2,2,2.9,2,4v18l4-4h14c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z";
            const bookmarkPath = "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z";

            // 종이비행기(sharePath, iShare) 코드 삭제함
            const iHeart = new fabric.Path(heartPath, { scaleX: iconScale, scaleY: iconScale, fill: '#ed4956', stroke: '#ed4956', strokeWidth: 1, originX: 'left', originY: 'center', left: leftStart, top: actionY });
            const iComment = new fabric.Path(bubblePath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'left', originY: 'center', left: leftStart + 50, top: actionY });
            // const iShare = ... 삭제됨
            const iSave = new fabric.Path(bookmarkPath, { scaleX: iconScale, scaleY: iconScale, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'right', originY: 'center', left: cx + FRAME_W/2 - 30, top: actionY });

            objs.push(iHeart, iComment, iSave); // push 목록에서도 iShare 제거

            // === 7. 좋아요 및 해시태그 ===
            const textStartY = actionY + 45; 
            
            const likeIconSmall = new fabric.Path(heartPath, { scaleX: 0.6, scaleY: 0.6, fill: '#ed4956', originX: 'left', originY: 'center', left: leftStart, top: textStartY });
            const likesText = new fabric.IText("송오현님 외 999,999명이 좋아합니다", {
                fontFamily: 'sans-serif', fontSize: 15, fill: '#262626', fontWeight: 'bold',
                originX: 'left', originY: 'center', left: leftStart + 25, top: textStartY
            });
            
            const hashtags = new fabric.IText("#dyb송파 #할로윈데이 #영어는 #역시 #최선이최고지\n#꿀잼영어 #내가바로 #최선의주인공 #행복 #BAAAMM!", {
                fontFamily: 'sans-serif', fontSize: 15, fill: '#00376b', lineHeight: 1.4,
                originX: 'left', originY: 'top', left: leftStart, top: textStartY + 25,
                width: FRAME_W - 60, splitByGrapheme: true
            });

            objs.push(likeIconSmall, likesText, hashtags);

            // === 8. 하단 바 (수정: 그룹화 적용) ===
            const bottomBarH = 60;
            
            // 그룹 내부에서의 좌표 계산 (Group의 top-left가 (0,0) 기준이 됨)
            // 배경 바 (0, 0 위치)
            const botBarRect = new fabric.Rect({
                width: FRAME_W, height: bottomBarH, fill: instaGradient,
                left: 0, top: 0
            });

            // 아이콘 경로
            const homePath = "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z";
            const searchPath = "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
            const boxPlusPath = "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z";
            
            // 그룹 내부 배치를 위한 계산
            const step = FRAME_W / 5;
            const iconY = bottomBarH / 2; // 그룹 높이의 중간

            // 각 아이콘 생성 (origin을 center로 잡고, 그룹 내 상대 좌표 사용)
            const bHome = new fabric.Path(homePath, { scaleX: 1.5, scaleY: 1.5, fill: 'white', originX: 'center', originY: 'center', left: step/2, top: iconY });
            const bSearch = new fabric.Path(searchPath, { scaleX: 1.5, scaleY: 1.5, fill: 'white', originX: 'center', originY: 'center', left: step/2 + step, top: iconY });
            const bPlus = new fabric.Path(boxPlusPath, { scaleX: 1.5, scaleY: 1.5, fill: 'white', originX: 'center', originY: 'center', left: step/2 + step*2, top: iconY });
            const bHeart = new fabric.Path(heartPath, { scaleX: 1.2, scaleY: 1.2, fill: 'white', originX: 'center', originY: 'center', left: step/2 + step*3, top: iconY });
            const bUser = new fabric.Circle({ radius: 14, fill: 'white', stroke: 'white', strokeWidth: 1, originX: 'center', originY: 'center', left: step/2 + step*4, top: iconY });

            // ★ 그룹 생성 (통째로 묶음)
            const bottomGroup = new fabric.Group([botBarRect, bHome, bSearch, bPlus, bHeart, bUser], {
                left: cx, 
                top: cy + FRAME_H/2,  // 프레임의 가장 하단에 배치
                originX: 'center', 
                originY: 'bottom'     // 그룹의 기준점을 하단 중앙으로 설정하여 바닥에 딱 붙게 함
            });

            objs.push(bottomGroup);
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