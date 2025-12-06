import { initConfig } from "./config.js";
import { initCanvas, canvas } from "./canvas-core.js"; // canvas 변수도 필요하다면 가져오기 (보통 window.canvas로 접근 가능하지만 명시적이면 좋음)
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

window.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. 설정 및 DB 연결
        await initConfig();
        
        // 2. 캔버스 코어 초기화
        initCanvas();
        
        // 3. 유틸리티 & 단축키 초기화
        initCanvasUtils();
        initShortcuts();
        initContextMenu();

        // 4. 각종 도구 및 UI 초기화
        initSizeControls();
        initGuides();
        initZoomPan();
        initObjectTools();
        initImageTools();
        initTemplateTools();
        
        // 5. AI 도구 초기화
        initAiTools(); 
        
        // 6. 비즈니스 로직 초기화
        initExport();
        initOrderSystem();
        initAuth();
        initMyDesign();

        // ★ [추가됨] 7. 모바일 텍스트 에디터 초기화
        // 아래쪽에 정의된 함수를 여기서 실행합니다.
        initMobileTextEditor();

        console.log("🚀 모든 모듈 초기화 완료");

        // 8. 로딩 완료 후 화면 전환
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
        console.error("🚨 초기화 중 치명적 오류 발생:", error);
        alert("시스템 초기화 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
});

/**
 * ★ [추가됨] 모바일 전용 텍스트 에디터 로직
 * 모바일 환경에서 텍스트 수정 시 키보드 가림 현상을 방지하기 위해
 * 별도의 상단 입력창을 띄우는 함수입니다.
 */
function initMobileTextEditor() {
    const mobileEditor = document.getElementById('mobileTextEditor');
    const mobileInput = document.getElementById('mobileTextInput');
    const btnFinish = document.getElementById('btnFinishText');
    let activeTextObj = null;

    // 캔버스 객체가 없으면 중단 (안전장치)
    // window.canvas는 canvas-core.js에서 전역 변수로 할당되었다고 가정합니다.
    if (!window.canvas) return;

    // 1. 캔버스 이벤트 리스너 등록
    window.canvas.on('selection:created', handleSelection);
    window.canvas.on('selection:updated', handleSelection);
    window.canvas.on('selection:cleared', closeMobileEditor);

    function handleSelection(e) {
        // 화면 너비가 768px 이하(모바일)일 때만 작동
        if (window.innerWidth > 768) return;

        const obj = e.selected ? e.selected[0] : window.canvas.getActiveObject();
        
        // 선택된 객체가 텍스트라면
        if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text')) {
            activeTextObj = obj;
            
            // 텍스트 내용 가져오기
            mobileInput.value = obj.text;
            
            // 입력창 보이기
            if(mobileEditor) mobileEditor.style.display = 'flex';
            
            // 캔버스 기본 편집 모드 진입 방지 (키보드 중복 방지)
            obj.enterEditing = function() {}; 
        } else {
            closeMobileEditor();
        }
    }

    // 2. 입력창 타이핑 시 실시간 반영
    if(mobileInput) {
        mobileInput.addEventListener('input', function() {
            if (activeTextObj) {
                activeTextObj.set('text', this.value);
                window.canvas.requestRenderAll();
            }
        });
    }

    // 3. 완료 버튼 클릭
    if(btnFinish) {
        btnFinish.addEventListener('click', function() {
            closeMobileEditor();
            if(mobileInput) mobileInput.blur(); // 키보드 내리기
            window.canvas.discardActiveObject(); // 선택 해제
            window.canvas.requestRenderAll();
        });
    }

    function closeMobileEditor() {
        if(mobileEditor) mobileEditor.style.display = 'none';
        activeTextObj = null;
    }
}