import { initConfig } from "./config.js";
import { initCanvas, canvas } from "./canvas-core.js";
import { initSizeControls } from "./canvas-size.js";
import { initGuides } from "./canvas-guides.js";
import { initZoomPan } from "./canvas-zoom-pan.js";
import { initObjectTools } from "./canvas-objects.js";
import { initImageTools } from "./canvas-image.js";
import { initTemplateTools } from "./canvas-template.js";
import { initAiTools } from "./canvas-ai.js";
import { initExport } from "./export.js";
import { initOrderSystem } from "./order.js";
import { initAuth } from "./login.js";
import { initMyDesign } from "./my-design.js";
import { initCanvasUtils } from "./canvas-utils.js";
import { initShortcuts } from "./shortcuts.js";
import { initContextMenu } from "./context-menu.js";
// 벡터 생성 모듈
import { createVectorOutline } from "./outlineMaker.js";

window.addEventListener("DOMContentLoaded", async () => {
    try {
        await initConfig();
        initCanvas();
        initCanvasUtils();
        initShortcuts();
        initContextMenu();
        initSizeControls();
        initGuides();
        initZoomPan();
        initObjectTools();
        initImageTools();
        initTemplateTools();
        initAiTools(); 
        initExport();
        initOrderSystem();
        initAuth();
        initMyDesign();
        initMobileTextEditor();
        initOutlineTool(); // 칼선 도구

        console.log("🚀 모든 모듈 초기화 완료");

        setTimeout(() => {
            const loading = document.getElementById("loading");
            const startScreen = document.getElementById("startScreen");
            const mainEditor = document.getElementById("mainEditor");
            if (loading) loading.style.display = "none";
            if (startScreen && startScreen.style.display !== 'none') {
            } else {
                if (mainEditor) mainEditor.style.display = "flex";
            }
        }, 300);
    } catch (error) {
        console.error("🚨 초기화 오류:", error);
        alert("시스템 초기화 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
});

/**
 * ★ 벡터(Path) 칼선 만들기 도구 초기화
 */
function initOutlineTool() {
    const btn = document.getElementById("btn-create-outline");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const currentCanvas = window.canvas || canvas;
        if (!currentCanvas) return;

        const activeObj = currentCanvas.getActiveObject();
        if (!activeObj || activeObj.type !== 'image') {
            alert("외곽선을 만들 이미지를 선택해주세요!");
            return;
        }

        const originalText = btn.innerText;
        btn.innerText = "생성 중...";
        btn.disabled = true;

        try {
            const src = activeObj.getSrc();
            
            // 1. 벡터 생성 요청 (outlineMaker.js)
            const result = await createVectorOutline(src, {
                dilation: 15,       // ★ 칼선 여백 (캐릭터와 선 사이 거리)
                color: '#FF00FF',   // 칼선 색상
                strokeWidth: 2      // 선 두께
            });

            // 2. 패스 객체 생성
            const pathObj = new fabric.Path(result.pathData, {
                fill: '',           // 내부는 투명
                stroke: result.color,
                strokeWidth: result.strokeWidth,
                
                // ★ 선을 부드럽게 (Round Join) - 오버컷 방지
                strokeLineJoin: 'round',
                strokeLineCap: 'round',

                objectCaching: false,
                selectable: true,
                evented: true,
                originX: 'center',
                originY: 'center'
            });

            // 3. 정밀 위치 보정 (중요)
            // Potrace 캔버스의 중심과 Path의 중심 차이를 계산하여 보정합니다.
            
            // (A) Potrace 캔버스 상의 중심
            const svgImageCenterX = result.width / 2;
            const svgImageCenterY = result.height / 2;

            // (B) 생성된 Path의 자체 중심 (Bounding Box 기준)
            const pathCenterX = pathObj.pathOffset.x;
            const pathCenterY = pathObj.pathOffset.y;

            // (C) 오차 계산
            const diffX = pathCenterX - svgImageCenterX;
            const diffY = pathCenterY - svgImageCenterY;

            // (D) 이미지의 회전/스케일에 맞춰 오차 적용
            const imgCenter = activeObj.getCenterPoint();
            const angleRad = fabric.util.degreesToRadians(activeObj.angle);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            // 회전된 좌표계에서의 오차값 변환
            const finalOffsetX = (diffX * activeObj.scaleX * cos) - (diffY * activeObj.scaleY * sin);
            const finalOffsetY = (diffX * activeObj.scaleX * sin) + (diffY * activeObj.scaleY * cos);

            // 최종 위치 설정
            pathObj.set({
                left: imgCenter.x + finalOffsetX,
                top: imgCenter.y + finalOffsetY,
                scaleX: activeObj.scaleX, // 스케일 동기화
                scaleY: activeObj.scaleY,
                angle: activeObj.angle    // 회전 동기화
            });

            currentCanvas.add(pathObj);
            currentCanvas.bringToFront(pathObj);
            currentCanvas.requestRenderAll();
            
            console.log("✂️ 칼선 생성 완료 (사각형 방지 적용)");

        } catch (error) {
            console.error("벡터 생성 실패:", error);
            alert("생성 실패: " + error.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

/**
 * 모바일 전용 텍스트 에디터 로직 (기존 유지)
 */
function initMobileTextEditor() {
    const mobileEditor = document.getElementById('mobileTextEditor');
    const mobileInput = document.getElementById('mobileTextInput');
    const btnFinish = document.getElementById('btnFinishText');
    let activeTextObj = null;

    if (!window.canvas) return;

    window.canvas.on('selection:created', handleSelection);
    window.canvas.on('selection:updated', handleSelection);
    window.canvas.on('selection:cleared', closeMobileEditor);

    function handleSelection(e) {
        if (window.innerWidth > 768) return;
        const obj = e.selected ? e.selected[0] : window.canvas.getActiveObject();
        if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text')) {
            activeTextObj = obj;
            if(mobileInput) mobileInput.value = obj.text;
            if(mobileEditor) mobileEditor.style.display = 'flex';
            obj.enterEditing = function() {}; 
        } else {
            closeMobileEditor();
        }
    }

    if(mobileInput) {
        mobileInput.addEventListener('input', function() {
            if (activeTextObj) {
                activeTextObj.set('text', this.value);
                window.canvas.requestRenderAll();
            }
        });
    }

    if(btnFinish) {
        btnFinish.addEventListener('click', function() {
            closeMobileEditor();
            if(mobileInput) mobileInput.blur();
            window.canvas.discardActiveObject();
            window.canvas.requestRenderAll();
        });
    }

    window.closeMobileTextEditor = closeMobileEditor;
    function closeMobileEditor() {
        if(mobileEditor) mobileEditor.style.display = 'none';
        activeTextObj = null;
    }
    
    window.deleteMobileObject = function() {
        const active = window.canvas.getActiveObject();
        if(active) {
            window.canvas.remove(active);
            window.canvas.requestRenderAll();
        }
        closeMobileEditor();
    };
}

// 패널 토글 함수
window.toggleMobilePanel = function(side) {
    const leftPanel = document.getElementById('toolsPanel');
    const rightPanel = document.getElementById('rightStackPanel');
    if (side === 'left') {
        if (leftPanel) leftPanel.classList.toggle('open');
        if (rightPanel) rightPanel.classList.remove('open');
    } else if (side === 'right') {
        if (rightPanel) rightPanel.classList.toggle('open');
        if (leftPanel) leftPanel.classList.remove('open');
    }
};

// 캔버스 빈 곳 터치 시 패널 닫기
document.addEventListener('DOMContentLoaded', () => {
    const stage = document.getElementById('stage');
    if(stage) {
        stage.addEventListener('click', (e) => {
            if (!e.target.closest('.mobile-fab') && !e.target.closest('.side') && !e.target.closest('.right-stack')) {
                const leftPanel = document.getElementById('toolsPanel');
                const rightPanel = document.getElementById('rightStackPanel');
                if(leftPanel) leftPanel.classList.remove('open');
                if(rightPanel) rightPanel.classList.remove('open');
            }
        });
    }
});