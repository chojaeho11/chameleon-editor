// canvas-guides.js
import { canvas, isGuideOn, setGuideOn, baseW, baseH, currentMode } from "./canvas-core.js";

export function initGuides() {
    const btnGuide = document.getElementById("guideToggle");
    if (btnGuide) {
        btnGuide.onclick = () => {
            const newState = !isGuideOn;
            setGuideOn(newState);
            
            if (newState) {
                btnGuide.classList.add("active");
                btnGuide.innerHTML = '<i class="fa-solid fa-ruler-combined"></i> 가이드 끄기';
                drawGuides();
            } else {
                btnGuide.classList.remove("active");
                btnGuide.innerHTML = '<i class="fa-solid fa-ruler-horizontal"></i> 가이드 켜기';
                clearGuides();
            }
        };
    }

    // [추가] 객체가 추가될 때마다 가이드를 맨 위로 올림 (가려짐 방지)
    canvas.on('object:added', (e) => {
        if (isGuideOn && !e.target.isGuide) {
            // 렌더링 사이클을 맞추기 위해 약간의 지연 후 실행
            setTimeout(() => {
                canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));
            }, 0);
        }
    });
}

export function drawGuides() {
    clearGuides();
    if (!isGuideOn) return;

    const width = baseW || canvas.width;
    const height = baseH || canvas.height;
    
    // [수정] 가이드선 스타일 강화 (굵게, 잘 보이는 색상)
    const gridOption = {
        stroke: '#06b6d4', // Cyan 계열 (기본)
        strokeWidth: 2,    // [요청] 선 굵게
        strokeDashArray: [10, 5], // 점선 간격 조정
        selectable: false, // [요청] 선택 불가
        evented: false,    // 클릭 이벤트 무시
        excludeFromExport: true, 
        isGuide: true,
        opacity: 0.8
    };

    if (currentMode === 'wall') {
        // [가벽 모드] : 100mm (여백) - 1000mm (패널) 패턴 유지
        
        // 1. 왼쪽 여백 라인 (100mm)
        canvas.add(new fabric.Line([100, 0, 100, height], gridOption));
        
        // 2. 패널 간격 라인 (1000mm 씩 추가)
        let x = 100; 
        while (x < width - 100) {
            x += 1000;
            if (x <= width - 100 + 1) { 
                canvas.add(new fabric.Line([x, 0, x, height], gridOption));
            }
        }
    } else {
        // [수정] 일반 모드: 십자선 + 5mm 재단선
        
        // 1. 십자선 (정중앙) - Magenta 색상
        const centerOpt = { ...gridOption, stroke: '#d946ef' };
        const centerX = width / 2;
        const centerY = height / 2;

        // 세로 중앙선
        canvas.add(new fabric.Line([centerX, 0, centerX, height], centerOpt));
        // 가로 중앙선
        canvas.add(new fabric.Line([0, centerY, width, centerY], centerOpt));

        // 2. 5mm 재단선 (테두리 안쪽) - Red 색상
        // (72dpi 기준 1mm = 약 2.83px)
        const pxPerMm = 2.8333; 
        const margin = 5 * pxPerMm; // 5mm 여백

        const cutOpt = { ...gridOption, stroke: '#ef4444' }; // 빨간색

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
    
    // [요청] 가이드선을 항상 제일 위로 (선택 불가)
    canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));

    canvas.requestRenderAll();
}

export function clearGuides() {
    const guides = canvas.getObjects().filter(o => o.isGuide);
    guides.forEach(g => canvas.remove(g));
    canvas.requestRenderAll();
}