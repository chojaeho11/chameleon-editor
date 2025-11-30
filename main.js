import { initConfig } from "./config.js";
import { initCanvas } from "./canvas-core.js";
import { initSizeControls } from "./canvas-size.js";
import { initGuides } from "./canvas-guides.js";
import { initZoomPan } from "./canvas-zoom-pan.js";
import { initObjectTools } from "./canvas-objects.js";
import { initImageTools } from "./canvas-image.js";
import { initTemplateTools } from "./canvas-template.js";

// ★ 사용자 확인: 가지고 계신 canvas-ai.js의 함수명이 initAiTools 이므로 이에 맞춤
import { initAiTools } from "./canvas-ai.js";

import { initExport } from "./export.js";
import { initOrderSystem } from "./order.js";
import { initAuth } from "./login.js";
import { initMyDesign } from "./my-design.js";

// ★ 새로 추가된 기능들 (실행 취소, 단축키, 우클릭 메뉴)
import { initCanvasUtils } from "./canvas-utils.js";
import { initShortcuts } from "./shortcuts.js";
import { initContextMenu } from "./context-menu.js";

window.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. 설정 및 DB 연결 (가장 먼저 실행)
        await initConfig();
        
        // 2. 캔버스 코어 초기화 (Fabric.js 캔버스 생성)
        initCanvas();
        
        // 3. 유틸리티 & 단축키 초기화 (캔버스 생성 직후 실행)
        initCanvasUtils();  // 실행 취소(Undo/Redo), 복사/붙여넣기 로직
        initShortcuts();    // 키보드 단축키 이벤트 연결
        initContextMenu();  // 마우스 우클릭 메뉴 연결

        // 4. 각종 도구 및 UI 초기화
        initSizeControls(); // 사이즈 변경 패널
        initGuides();       // 가이드선 토글
        initZoomPan();      // 줌/팬 기능
        initObjectTools();  // 도형, 텍스트 추가 도구
        initImageTools();   // 이미지 업로드
        initTemplateTools();// 템플릿 시스템
        
        // 5. AI 도구 초기화 (initAiTools 호출)
        initAiTools(); 
        
        // 6. 비즈니스 로직 초기화 (내보내기, 주문, 로그인, 보관함)
        initExport();
        initOrderSystem();
        initAuth();
        initMyDesign();

        console.log("🚀 모든 모듈 초기화 완료");

        // 7. 로딩 완료 후 화면 전환 (약간의 딜레이를 주어 자연스럽게)
        setTimeout(() => {
            const loading = document.getElementById("loading");
            const startScreen = document.getElementById("startScreen");
            const mainEditor = document.getElementById("mainEditor");

            if (loading) loading.style.display = "none";
            
            // 시작 화면이 있으면 보여주고, 없으면 바로 에디터로 (구조에 따라 다름)
            if (startScreen && startScreen.style.display !== 'none') {
                // 이미 HTML/CSS에서 startScreen이 보이도록 설정되어 있다면 유지
            } else {
                if (mainEditor) mainEditor.style.display = "flex";
            }
        }, 300);

    } catch (error) {
        console.error("🚨 초기화 중 치명적 오류 발생:", error);
        alert("시스템 초기화 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
});