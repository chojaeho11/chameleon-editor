/* canvas-guides.js */
import { canvas, isGuideOn, setGuideOn, baseW, baseH } from "./canvas-core.js?v=123";

// 현재 가이드 모드 상태 (기본값: 십자)
let currentGuideMode = 'cross'; 
let guideBringToFrontTimeout = null;

// [1] 초기화 및 이벤트 연결
export function initGuides() {
    // 가이드 버튼 클릭 시 메뉴 열기/닫기
    const btnGuide = document.getElementById("guideToggle");
    const guideMenu = document.getElementById("guideMenuPanel");

    if (btnGuide && guideMenu) {
        btnGuide.onclick = (e) => {
            e.stopPropagation();
            const isHidden = guideMenu.style.display === 'none';
            guideMenu.style.display = isHidden ? 'flex' : 'none';
            
            // 메뉴가 열릴 때 현재 상태에 따라 버튼 활성화
            if (isHidden) updateGuideMenuUI();
        };

        // 외부 클릭 시 메뉴 닫기
        document.addEventListener('click', (e) => {
            if (!guideMenu.contains(e.target) && !btnGuide.contains(e.target)) {
                guideMenu.style.display = 'none';
            }
        });
    }

    // 전역 함수 등록 (HTML에서 호출용)
    window.setGuideMode = (mode) => {
        currentGuideMode = mode;
        if (mode === 'off') {
            setGuideOn(false);
            clearGuides();
        } else {
            setGuideOn(true);
            drawGuides();
        }
        updateGuideMenuUI();
        // 모바일이나 팝업인 경우 선택 후 닫기
        if(guideMenu) guideMenu.style.display = 'none';
    };

    // 객체 추가 시 가이드를 맨 위로 올리는 로직 (기존 유지)
    if (canvas) {
        canvas.on('object:added', (e) => {
            if (isGuideOn && !e.target.isGuide) {
                if (guideBringToFrontTimeout) clearTimeout(guideBringToFrontTimeout);
                guideBringToFrontTimeout = setTimeout(() => {
                    if (!canvas) return;
                    const guides = canvas.getObjects().filter(o => o.isGuide);
                    if (guides.length > 0) {
                        guides.forEach(g => canvas.bringToFront(g));
                        canvas.requestRenderAll();
                    }
                }, 100);
            }
        });
    }
}

// UI 상태 업데이트
function updateGuideMenuUI() {
    const btnGuide = document.getElementById("guideToggle");
    const btns = document.querySelectorAll('.guide-opt-btn');
    
    // 메인 버튼 상태
    if (isGuideOn) {
        btnGuide.classList.add("active");
        btnGuide.innerHTML = `<i class="fa-solid fa-ruler-combined"></i> ON`;
    } else {
        btnGuide.classList.remove("active");
        // [수정] 다국어 적용
        btnGuide.innerHTML = `<i class="fa-solid fa-ruler-horizontal"></i> ${window.t('btn_guide_on', 'Guides')}`;
    }

    // 서브 메뉴 버튼 활성화
    btns.forEach(btn => {
        if (btn.dataset.mode === currentGuideMode && isGuideOn) {
            btn.classList.add('active');
        } else if (btn.dataset.mode === 'off' && !isGuideOn) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// [2] 가이드 그리기 (핵심 로직)
export function drawGuides() {
    clearGuides();
    if (!isGuideOn) return;

    const width = baseW || canvas.width;
    const height = baseH || canvas.height;
    
    // 스타일 정의
    const minSide = Math.min(width, height);
    const strokeW = Math.max(1, minSide * 0.002); 
    const fontSize = Math.max(12, minSide * 0.025);

    const commonOpt = {
        selectable: false, evented: false, 
        excludeFromExport: true, isGuide: true,
        opacity: 0.8, strokeWidth: strokeW
    };

    const mainLineOpt = { ...commonOpt, stroke: '#d946ef', strokeDashArray: [strokeW*4, strokeW*2] }; // 보라색 점선
    const subLineOpt = { ...commonOpt, stroke: '#06b6d4', strokeDashArray: [strokeW*2, strokeW*2] }; // 하늘색 점선

    // 1. 외곽선 (안전영역 대신 대지 테두리 표시)
    canvas.add(new fabric.Rect({
        left: 0, top: 0, width: width, height: height,
        fill: 'transparent', stroke: '#ddd', strokeWidth: strokeW,
        selectable: false, evented: false, isGuide: true
    }));

    // 2. 모드별 가이드 그리기
    switch (currentGuideMode) {
        case 'cross': // 십자 (중앙)
            drawVerticalLine(width / 2, mainLineOpt);
            drawHorizontalLine(height / 2, mainLineOpt);
            break;

        case '3': // 3단 (가로 3등분)
            drawVerticalSplits(3, width, height, mainLineOpt);
            break;

        case '4': // 4단 (가로 4등분)
            drawVerticalSplits(4, width, height, mainLineOpt);
            // 4단은 중앙선도 강조
            drawVerticalLine(width / 2, { ...mainLineOpt, stroke: '#ef4444' }); 
            break;

        case '5': // 5단 (가로 5등분)
            drawVerticalSplits(5, width, height, mainLineOpt);
            break;
            
        case 'grid': // 격자 (3x3)
            drawVerticalSplits(3, width, height, subLineOpt);
            drawHorizontalSplits(3, width, height, subLineOpt);
            break;
    }

    // 3. 자(Ruler) 그리기 (수치 표시)
    drawRulers(width, height, strokeW, fontSize, commonOpt);
    
    // 가이드 맨 위로
    canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));
    canvas.requestRenderAll();
}

// 수직 분할선 그리기 헬퍼
function drawVerticalSplits(count, w, h, opt) {
    const step = w / count;
    for (let i = 1; i < count; i++) {
        const x = step * i;
        canvas.add(new fabric.Line([x, 0, x, h], opt));
    }
}

// 수평 분할선 그리기 헬퍼
function drawHorizontalSplits(count, w, h, opt) {
    const step = h / count;
    for (let i = 1; i < count; i++) {
        const y = step * i;
        canvas.add(new fabric.Line([0, y, w, y], opt));
    }
}

function drawVerticalLine(x, opt) {
    canvas.add(new fabric.Line([x, 0, x, baseH || canvas.height], opt));
}

function drawHorizontalLine(y, opt) {
    canvas.add(new fabric.Line([0, y, baseW || canvas.width, y], opt));
}

export function clearGuides() {
    if (!canvas) return;
    const guides = canvas.getObjects().filter(o => o.isGuide);
    guides.forEach(g => canvas.remove(g));
    canvas.requestRenderAll();
}

// 자(Ruler) 그리기 함수 (기존 로직 유지 및 최적화)
function drawRulers(w, h, strokeW, fontSize, commonOpt) {
    const rulerSize = fontSize * 1.5;
    const rulerBg = "#f8f9fa";
    const rulerStroke = "#ced4da";
    const textColor = "#868e96";

    // 상단 자
    canvas.add(new fabric.Rect({
        ...commonOpt, left: 0, top: 0, width: w, height: rulerSize,
        fill: rulerBg, stroke: null
    }));
    
    // 좌측 자
    canvas.add(new fabric.Rect({
        ...commonOpt, left: 0, top: 0, width: rulerSize, height: h,
        fill: rulerBg, stroke: null
    }));

    // 눈금 간격 계산 (반응형)
    const longSide = Math.max(w, h);
    let step = 100;
    if (longSide > 3000) step = 500;
    else if (longSide < 500) step = 50;

    // 눈금 그리기 (X축)
    for (let x = 0; x <= w; x += step) {
        if(x === 0) continue;
        canvas.add(new fabric.Line([x, 0, x, rulerSize], { ...commonOpt, stroke: rulerStroke }));
        const t = new fabric.Text(x.toString(), {
            ...commonOpt, left: x + 2, top: 2, fontSize: fontSize * 0.7, fill: textColor
        });
        if(t.width < step) canvas.add(t);
    }

    // 눈금 그리기 (Y축)
    for (let y = 0; y <= h; y += step) {
        if(y === 0) continue;
        canvas.add(new fabric.Line([0, y, rulerSize, y], { ...commonOpt, stroke: rulerStroke }));
        const t = new fabric.Text(y.toString(), {
            ...commonOpt, left: 2, top: y + 2, fontSize: fontSize * 0.7, fill: textColor, angle: -90
        });
        if(t.width < step) canvas.add(t);
    }
}