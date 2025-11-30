// canvas-core.js
import { updateLockUI } from "./canvas-utils.js";

// 전역 변수
export let canvas;
export let baseW = 1000;
export let baseH = 1000;
export let currentMode = 'standard';
export let currentSizeName = 'custom';
export let isGuideOn = false;

export function initCanvas() {
    const stageElem = document.querySelector(".stage");
    const canvasElem = document.getElementById("designCanvas");

    if (!canvasElem || !stageElem) {
        console.error("캔버스 엘리먼트를 찾을 수 없습니다.");
        return;
    }

    if (typeof fabric === 'undefined') {
        console.error("Fabric.js 라이브러리가 로드되지 않았습니다.");
        return;
    }

    // Fabric.js 기본 설정
    fabric.Object.prototype.set({
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
        padding: 10,
        borderColor: '#00D2FF',
        cornerColor: '#ffffff',
        cornerStrokeColor: '#00D2FF',
        borderScaleFactor: 2
    });

    // 캔버스 생성
    canvas = new fabric.Canvas('designCanvas', {
        width: stageElem.clientWidth || 800, // 너비가 0이면 기본값 800
        height: stageElem.clientHeight || 600,
        backgroundColor: '#555555',
        preserveObjectStacking: true,
        selection: true
    });

    // ★ [핵심 수정] 전역 변수에 캔버스 할당 (외부 접근 허용)
    window.canvas = canvas;

    // 반응형 리사이징 (화면 크기 변경 감지)
    const ro = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (canvas && width > 0 && height > 0) {
                canvas.setDimensions({ width, height });
                canvas.requestRenderAll();
            }
        }
    });
    ro.observe(stageElem);

    // 클릭 시 잠금 상태 UI 업데이트
    canvas.on("selection:created", updateLockUI);
    canvas.on("selection:updated", updateLockUI);
    canvas.on("selection:cleared", updateLockUI);

    console.log("✅ 캔버스 코어 초기화 완료");
}

// 사이즈 설정 함수들
export function setBaseSize(w, h) { baseW = w; baseH = h; }
export function setGlobalSize(w, h) { setBaseSize(w, h); }
export function setGlobalMode(mode) { currentMode = mode; }
export function setGlobalSizeName(name) { currentSizeName = name; }
export function setCurrentSizeName(name) { setGlobalSizeName(name); }
export function setGuideOn(state) { isGuideOn = state; }

// 폰트 로딩 대기
document.fonts.ready.then(() => {
    if (window.canvas) window.canvas.requestRenderAll();
});