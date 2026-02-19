// canvas-core.js
import { updateLockUI } from "./canvas-utils.js?v=123";

export let canvas;
export let baseW = 1000;
export let baseH = 1000;
export let currentMode = 'standard';
export let currentSizeName = 'custom';
export let isGuideOn = false;
export let maxLimitMM = { w: 0, h: 0 };

export function initCanvas() {
    const stageElem = document.querySelector(".stage");
    const canvasElem = document.getElementById("designCanvas");

    if (!canvasElem || !stageElem) return;
    if (typeof fabric === 'undefined') return;

    // Fabric.js 전역 객체 설정
    fabric.Object.prototype.set({
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
        padding: 10,
        borderColor: '#00D2FF',
        cornerColor: '#ffffff',
        cornerStrokeColor: '#00D2FF',
        borderScaleFactor: 2,
        
        // ★ [핵심 해결] 투명한 영역(빈 공간)은 클릭되지 않도록 설정
        // 이 설정이 있어야 큰 배경의 투명한 부분을 클릭해도 뒤의 글자를 선택할 수 있음
        perPixelTargetFind: true, 
        
        // 클릭 감지 민감도 (픽셀 단위)
        // 너무 정밀하면 얇은 선 클릭이 어려우므로 5px 정도의 여유를 줌
        targetFindTolerance: 5  
    });

    // ★★★ [핵심 패치] 이동 중 튕김(getRetinaScaling 오류) 원천 차단 ★★★
    const originalGetRetinaScaling = fabric.Object.prototype.getRetinaScaling;
    fabric.Object.prototype.getRetinaScaling = function() {
        // 캔버스 참조를 잃어버렸을 때 강제로 1을 반환하여 충돌 방지
        if (!this.canvas) return 1; 
        return this.canvas.getRetinaScaling();
    };
    // ----------------------------------------------------------------

    canvas = new fabric.Canvas('designCanvas', {
        width: stageElem.clientWidth || 800,
        height: stageElem.clientHeight || 600,
        backgroundColor: '#555555',
        preserveObjectStacking: true, // 선택해도 레이어 순서가 바뀌지 않도록 함
        selection: true,
        
        // 캔버스 자체에도 픽셀 기반 탐지 적용 (이중 안전장치)
        perPixelTargetFind: true,
        targetFindTolerance: 5
    });

    window.canvas = canvas;
    // ★ [핵심 패치] 페이지 이동/저장 시 커스텀 속성(배경, 잠금 등) 유지하기
    fabric.Object.prototype.toObject = (function(toObject) {
        return function(propertiesToInclude) {
            return toObject.call(this, (propertiesToInclude || []).concat([
                'id', 
                'isBoard', 
                'isTemplateBackground', // ★ 배경 식별 태그
                'product_key', 
                'category', 
                'selectable', 
                'evented', 
                'lockMovementX', 
                'lockMovementY', 
                'hasControls',
                'lockRotation',
                'lockScalingX',
                'lockScalingY',
                'isAiGenerated'
            ]));
        };
    })(fabric.Object.prototype.toObject);

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

    canvas.on("selection:created", updateLockUI);
    canvas.on("selection:updated", updateLockUI);
    canvas.on("selection:cleared", updateLockUI);

}
export function setMaxLimits(w_mm, h_mm) { maxLimitMM.w = w_mm; maxLimitMM.h = h_mm; }
export function setBaseSize(w, h) { baseW = w; baseH = h; }
export function setGlobalSize(w, h) { setBaseSize(w, h); }
export function setGlobalMode(mode) { currentMode = mode; }
export function setGlobalSizeName(name) { currentSizeName = name; }
export function setCurrentSizeName(name) { setGlobalSizeName(name); }
export function setGuideOn(state) { isGuideOn = state; }

document.fonts.ready.then(() => { if (window.canvas) window.canvas.requestRenderAll(); });