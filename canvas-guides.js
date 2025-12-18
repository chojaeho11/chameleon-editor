// canvas-guides.js
import { canvas, isGuideOn, setGuideOn, baseW, baseH, currentMode } from "./canvas-core.js";

export function initGuides() {
    const btnGuide = document.getElementById("guideToggle");
    if (btnGuide) {
        btnGuide.onclick = () => {
            const newState = !isGuideOn;
            setGuideOn(newState);
            
            // ★ [수정됨] 클릭 시 번역 데이터 가져오기
            const t = window.translations || {};
            
            if (newState) {
                // 가이드 켜짐 상태 -> 버튼은 "끄기(Hide)"라고 보여야 함
                btnGuide.classList.add("active");
                // 번역 키 사용 (없으면 기본 한글)
                const text = t['btn_guide_off'] || "가이드 끄기";
                btnGuide.innerHTML = `<i class="fa-solid fa-ruler-combined"></i> ${text}`;
                drawGuides();
            } else {
                // 가이드 꺼짐 상태 -> 버튼은 "켜기(Show)"라고 보여야 함
                btnGuide.classList.remove("active");
                // 번역 키 사용
                const text = t['btn_guide_on'] || "가이드 켜기";
                btnGuide.innerHTML = `<i class="fa-solid fa-ruler-horizontal"></i> ${text}`;
                clearGuides();
            }
        };
    }

    // [추가] 객체가 추가될 때마다 가이드를 맨 위로 올림 (가려짐 방지)
    if (canvas) {
        canvas.on('object:added', (e) => {
            if (isGuideOn && !e.target.isGuide) {
                setTimeout(() => {
                    canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));
                }, 0);
            }
        });
    }
}

export function drawGuides() {
    clearGuides();
    if (!isGuideOn) return;

    const width = baseW || canvas.width;
    const height = baseH || canvas.height;
    
    // 가이드선 스타일
    const gridOption = {
        stroke: '#06b6d4', 
        strokeWidth: 2,    
        strokeDashArray: [10, 5], 
        selectable: false, 
        evented: false,    
        excludeFromExport: true, 
        isGuide: true,
        opacity: 0.8
    };

    if (currentMode === 'wall') {
        // [가벽 모드]
        canvas.add(new fabric.Line([100, 0, 100, height], gridOption));
        let x = 100; 
        while (x < width - 100) {
            x += 1000;
            if (x <= width - 100 + 1) { 
                canvas.add(new fabric.Line([x, 0, x, height], gridOption));
            }
        }
    } else {
        // [일반 모드]
        const centerOpt = { ...gridOption, stroke: '#d946ef' };
        const centerX = width / 2;
        const centerY = height / 2;

        canvas.add(new fabric.Line([centerX, 0, centerX, height], centerOpt));
        canvas.add(new fabric.Line([0, centerY, width, centerY], centerOpt));

        const pxPerMm = 2.8333; 
        const margin = 5 * pxPerMm; 
        const cutOpt = { ...gridOption, stroke: '#ef4444' }; 

        const cutRect = new fabric.Rect({
            left: margin,
            top: margin,
            width: width - (margin * 2),
            height: height - (margin * 2),
            fill: 'transparent',
            ...cutOpt
        });
        canvas.add(cutRect);
    }
    
    // 가이드선을 항상 제일 위로 (선택 불가)
    canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));
    canvas.requestRenderAll();
}

export function clearGuides() {
    if (!canvas) return;
    const guides = canvas.getObjects().filter(o => o.isGuide);
    guides.forEach(g => canvas.remove(g));
    canvas.requestRenderAll();
}