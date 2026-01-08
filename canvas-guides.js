// canvas-guides.js
import { canvas, isGuideOn, setGuideOn, baseW, baseH, currentMode } from "./canvas-core.js";

// [핵심 수정] 가이드라인 정렬 과부하 방지를 위한 타이머 변수
let guideBringToFrontTimeout = null;

export function initGuides() {
    const btnGuide = document.getElementById("guideToggle");
    if (btnGuide) {
        btnGuide.onclick = () => {
            const newState = !isGuideOn;
            setGuideOn(newState);
            
            const t = window.translations || {};
            
            if (newState) {
                btnGuide.classList.add("active");
                const text = t['btn_guide_off'] || "Hide Guides";
                btnGuide.innerHTML = `<i class="fa-solid fa-ruler-combined"></i> ${text}`;
                drawGuides();
            } else {
                btnGuide.classList.remove("active");
                const text = t['btn_guide_on'] || "Show Guides";
                btnGuide.innerHTML = `<i class="fa-solid fa-ruler-horizontal"></i> ${text}`;
                clearGuides();
            }
        };
    }

    if (canvas) {
        // [핵심 수정] 객체 추가 시 즉시 실행하지 않고 0.1초 딜레이를 주어
        // 수십 개의 객체가 동시에 추가될 때(그룹 해제 등) 한 번만 실행되도록 최적화
        canvas.on('object:added', (e) => {
            if (isGuideOn && !e.target.isGuide) {
                // 기존에 대기 중이던 명령이 있다면 취소
                if (guideBringToFrontTimeout) {
                    clearTimeout(guideBringToFrontTimeout);
                }
                
                // 새로운 명령 예약 (100ms 후 실행)
                guideBringToFrontTimeout = setTimeout(() => {
                    if (!canvas) return;
                    
                    // 가이드 객체만 찾아서 맨 위로 올리기
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

export function drawGuides() {
    clearGuides();
    if (!isGuideOn) return;

    const width = baseW || canvas.width;
    const height = baseH || canvas.height;
    
    // [1] 스마트 크기 계산 (비율 기반)
    const minSide = Math.min(width, height);
    
    // 메인 선 두께 (가이드라인)
    const mainStroke = minSide * 0.0015; 
    const auxStroke = mainStroke * 0.6;
    
    // 폰트 크기: 자가 얇아지므로 폰트도 비율에 맞춰 살짝 조정
    const smartFontSize = minSide * 0.02; 

    const guideCommonOpt = {
        selectable: false, 
        evented: false,    
        excludeFromExport: true, 
        isGuide: true,
        opacity: 0.8
    };

    // 스타일 정의
    const mainLineOpt = { 
        ...guideCommonOpt,
        stroke: '#d946ef', 
        strokeWidth: mainStroke,    
        strokeDashArray: [mainStroke * 8, mainStroke * 4], 
    };

    const auxLineOpt = { 
        ...guideCommonOpt,
        stroke: '#06b6d4', 
        strokeWidth: auxStroke,
        strokeDashArray: [auxStroke * 6, auxStroke * 4], 
        opacity: 0.6
    };

    // 1. 가이드 라인 그리기
    if (currentMode === 'wall') {
        const xStep = 1000;
        let x = 100; 
        canvas.add(new fabric.Line([100, 0, 100, height], mainLineOpt));
        while (x < width - 100) {
            x += xStep;
            if (x <= width - 100 + 1) { 
                canvas.add(new fabric.Line([x, 0, x, height], mainLineOpt));
            }
        }
    } else {
        const centerX = width / 2;
        const centerY = height / 2;

        // 중앙 십자가
        canvas.add(new fabric.Line([centerX, 0, centerX, height], mainLineOpt));
        canvas.add(new fabric.Line([0, centerY, width, centerY], mainLineOpt));

        // 보조 가이드선 (4분할)
        canvas.add(new fabric.Line([width * 0.25, 0, width * 0.25, height], auxLineOpt));
        canvas.add(new fabric.Line([width * 0.75, 0, width * 0.75, height], auxLineOpt));
        canvas.add(new fabric.Line([0, height * 0.25, width, height * 0.25], auxLineOpt));
        canvas.add(new fabric.Line([0, height * 0.75, width, height * 0.75], auxLineOpt));

        // 안전 영역 (1.5%)
        const safeMargin = minSide * 0.015; 
        const cutOpt = { 
            ...guideCommonOpt, 
            stroke: '#ef4444', 
            strokeWidth: mainStroke, 
            strokeDashArray: null 
        }; 
        canvas.add(new fabric.Rect({
            left: safeMargin, top: safeMargin,
            width: width - (safeMargin * 2), height: height - (safeMargin * 2),
            fill: 'transparent', ...cutOpt
        }));
    }

    // [2] 자(Ruler) 그리기 (4면 모두)
    drawRulers(width, height, mainStroke, smartFontSize, guideCommonOpt);
    
    // 그리기 직후에도 가이드를 맨 위로 정렬
    canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));
    canvas.requestRenderAll();
}

/**
 * 스마트 눈금 자 그리기 (4면: 상하좌우)
 */
function drawRulers(w, h, strokeW, fontSize, commonOpt) {
    // 눈금 간격 계산
    const longSide = Math.max(w, h);
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let step = 100;
    for (let s of steps) {
        if (longSide / s <= 20) { 
            step = s;
            break;
        }
    }

    const rulerColor = "#666";
    const rulerBgColor = "#f0f0f0"; 
    
    // 자 두께 설정
    const rulerSize = fontSize * 1.3; 

    // 텍스트 스타일
    const textOpt = {
        ...commonOpt,
        fill: "#555",
        fontSize: fontSize * 0.9, 
        fontFamily: 'sans-serif',
        originX: 'left',
        originY: 'top'
    };

    // ==========================================================
    // 1. Top Ruler (상단)
    // ==========================================================
    canvas.add(new fabric.Rect({
        ...commonOpt,
        left: 0, top: 0,
        width: w, height: rulerSize,
        fill: rulerBgColor,
        stroke: '#ccc', strokeWidth: strokeW
    }));

    for (let x = 0; x <= w; x += step) {
        // 눈금 (아래쪽 정렬)
        canvas.add(new fabric.Line([x, rulerSize * 0.6, x, rulerSize], {
            ...commonOpt, stroke: rulerColor, strokeWidth: strokeW
        }));
        if (x > 0 && x < w) {
            const tObj = new fabric.Text(x.toString(), {
                ...textOpt, left: x + 2, top: 0
            });
            if (tObj.width < step * 0.9) canvas.add(tObj);
        }
    }

    // ==========================================================
    // 2. Bottom Ruler (하단)
    // ==========================================================
    canvas.add(new fabric.Rect({
        ...commonOpt,
        left: 0, top: h - rulerSize,
        width: w, height: rulerSize,
        fill: rulerBgColor,
        stroke: '#ccc', strokeWidth: strokeW
    }));

    for (let x = 0; x <= w; x += step) {
        // 눈금 (위쪽 정렬)
        canvas.add(new fabric.Line([x, h - rulerSize, x, h - rulerSize * 0.6], {
            ...commonOpt, stroke: rulerColor, strokeWidth: strokeW
        }));
        // 숫자 (눈금 아래에 배치)
        if (x > 0 && x < w) {
            const tObj = new fabric.Text(x.toString(), {
                ...textOpt, left: x + 2, top: h - rulerSize + 2
            });
            if (tObj.width < step * 0.9) canvas.add(tObj);
        }
    }

    // ==========================================================
    // 3. Left Ruler (좌측)
    // ==========================================================
    canvas.add(new fabric.Rect({
        ...commonOpt,
        left: 0, top: 0,
        width: rulerSize, height: h,
        fill: rulerBgColor,
        stroke: '#ccc', strokeWidth: strokeW
    }));

    for (let y = 0; y <= h; y += step) {
        // 눈금 (오른쪽 정렬)
        canvas.add(new fabric.Line([rulerSize * 0.6, y, rulerSize, y], {
            ...commonOpt, stroke: rulerColor, strokeWidth: strokeW
        }));
        if (y > 0 && y < h) {
            const tObj = new fabric.Text(y.toString(), {
                ...textOpt, 
                left: 0, top: y + 2,
                angle: -90, 
                originX: 'right', originY: 'top'
            });
            if (tObj.width < step * 0.9) canvas.add(tObj);
        }
    }

    // ==========================================================
    // 4. Right Ruler (우측)
    // ==========================================================
    canvas.add(new fabric.Rect({
        ...commonOpt,
        left: w - rulerSize, top: 0,
        width: rulerSize, height: h,
        fill: rulerBgColor,
        stroke: '#ccc', strokeWidth: strokeW
    }));

    for (let y = 0; y <= h; y += step) {
        // 눈금 (왼쪽 정렬)
        canvas.add(new fabric.Line([w - rulerSize, y, w - rulerSize * 0.6, y], {
            ...commonOpt, stroke: rulerColor, strokeWidth: strokeW
        }));
        if (y > 0 && y < h) {
            const tObj = new fabric.Text(y.toString(), {
                ...textOpt, 
                left: w, top: y + 2, // 오른쪽 끝에서 시작
                angle: -90, 
                originX: 'right', originY: 'top'
            });
            tObj.left = w - 2; 
            if (tObj.width < step * 0.9) canvas.add(tObj);
        }
    }

    // 4귀퉁이 코너 박스 (마감 처리)
    const corners = [
        { l: 0, t: 0 },
        { l: w - rulerSize, t: 0 },
        { l: 0, t: h - rulerSize },
        { l: w - rulerSize, t: h - rulerSize }
    ];

    corners.forEach(pos => {
        canvas.add(new fabric.Rect({
            ...commonOpt,
            left: pos.l, top: pos.t,
            width: rulerSize, height: rulerSize,
            fill: '#e0e0e0', // 코너는 조금 더 진하게
            stroke: '#bbb', strokeWidth: strokeW
        }));
    });
}

export function clearGuides() {
    if (!canvas) return;
    const guides = canvas.getObjects().filter(o => o.isGuide);
    guides.forEach(g => canvas.remove(g));
    canvas.requestRenderAll();
}