// canvas-core.js
import { updateLockUI } from "./canvas-utils.js";

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

    // Fabric.js 설정
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
        preserveObjectStacking: true,
        selection: true
    });

    window.canvas = canvas;

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

    console.log("✅ 캔버스 코어 초기화 완료");
}

export function setMaxLimits(w_mm, h_mm) { maxLimitMM.w = w_mm; maxLimitMM.h = h_mm; }
export function setBaseSize(w, h) { baseW = w; baseH = h; }
export function setGlobalSize(w, h) { setBaseSize(w, h); }
export function setGlobalMode(mode) { currentMode = mode; }
export function setGlobalSizeName(name) { currentSizeName = name; }
export function setCurrentSizeName(name) { setGlobalSizeName(name); }
export function setGuideOn(state) { isGuideOn = state; }

document.fonts.ready.then(() => { if (window.canvas) window.canvas.requestRenderAll(); });