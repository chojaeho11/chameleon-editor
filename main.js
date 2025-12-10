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
// 벡터 생성 모듈 (수정된 outlineMaker.js와 연결)
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
        initOutlineTool(); // ★ 칼선 도구 초기화

        console.log("🚀 모든 모듈 초기화 완료");

        setTimeout(() => {
            const loading = document.getElementById("loading");
            const startScreen = document.getElementById("startScreen");
            const mainEditor = document.getElementById("mainEditor");

            if (loading) loading.style.display = "none";
            if (startScreen && startScreen.style.display !== 'none') {
                // 시작 화면 유지
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
 * - 3개 버튼 (일반, 등신대, 키링) 통합 처리
 * - 검증된 위치 보정 로직 적용
 */
function initOutlineTool() {
    // 공통으로 사용할 외곽선 생성 함수
    const runOutlineMaker = async (btnId, type) => {
        const btn = document.getElementById(btnId);
        if (!btn) return; // 해당 버튼이 없으면 패스

        const currentCanvas = window.canvas || canvas;
        const activeObj = currentCanvas.getActiveObject();

        if (!activeObj || activeObj.type !== 'image') {
            alert("외곽선을 만들 이미지를 선택해주세요!");
            return;
        }

        // 버튼 상태 변경 (로딩 중)
        const originalText = btn.innerHTML;
        btn.innerText = "생성 중...";
        btn.disabled = true;

        try {
            const src = activeObj.getSrc();
            
            // 1. 벡터 생성 요청 (outlineMaker.js)
            // type 파라미터를 넘겨서 'normal', 'keyring', 'standee'를 구분합니다.
            const result = await createVectorOutline(src, {
                dilation: 15,       
                color: '#FF00FF',   
                strokeWidth: 2,
                type: type // ★ 핵심: 버튼에 따라 타입 전달
            });

            // 2. 패스 객체 생성 (검증된 설정)
            const pathObj = new fabric.Path(result.pathData, {
                fill: '', 
                stroke: result.color,
                strokeWidth: result.strokeWidth,
                strokeLineJoin: 'round',
                strokeLineCap: 'round',
                objectCaching: false, // 렌더링 이슈 방지
                selectable: true,
                evented: true,
                originX: 'center',
                originY: 'center'
            });

            // 3. ★ 정밀 위치 보정 (사용자님께서 확인해주신 '잘 되는 코드' 로직)
            
            // (A) Potrace 캔버스의 중심
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

            const finalOffsetX = (diffX * activeObj.scaleX * cos) - (diffY * activeObj.scaleY * sin);
            const finalOffsetY = (diffX * activeObj.scaleX * sin) + (diffY * activeObj.scaleY * cos);

            // 최종 위치 적용
            pathObj.set({
                left: imgCenter.x + finalOffsetX,
                top: imgCenter.y + finalOffsetY,
                scaleX: activeObj.scaleX,
                scaleY: activeObj.scaleY,
                angle: activeObj.angle
            });

            // 캔버스에 추가
            currentCanvas.add(pathObj);
            currentCanvas.bringToFront(pathObj);
            
            // 렌더링 갱신
            pathObj.setCoords();
            currentCanvas.requestRenderAll();
            
            console.log(`✂️ ${type} 모드 칼선 생성 완료`);

        } catch (error) {
            console.error("벡터 생성 실패:", error);
            alert("생성 실패: " + error.message);
        } finally {
            // 버튼 복구
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    // 버튼 3개에 대해 각각 이벤트 리스너 등록
    
    // 1. 일반 외곽선 버튼
    const btnNormal = document.getElementById("btn-create-outline");
    if (btnNormal) {
        btnNormal.onclick = () => runOutlineMaker("btn-create-outline", "normal");
    }

    // 2. 등신대 만들기 버튼
    const btnStandee = document.getElementById("btn-make-standee");
    if (btnStandee) {
        btnStandee.onclick = () => runOutlineMaker("btn-make-standee", "standee");
    }

    // 3. 키링 만들기 버튼
    const btnKeyring = document.getElementById("btn-make-keyring");
    if (btnKeyring) {
        btnKeyring.onclick = () => runOutlineMaker("btn-make-keyring", "keyring");
    }
}

/**
 * 모바일 전용 텍스트 에디터 로직
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

// 패널 토글 함수 (모바일용)
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