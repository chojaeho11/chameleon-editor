// keyring-mini-editor.js — 키링 미니 에디터 (모달 내 자동 누끼 + 지우개 + 아크릴 미리보기)
// 순수 Canvas 2D API만 사용 (Fabric.js 의존 없음)

import { sb } from './config.js?v=123';

let es = null; // editor state

// ============================================================
// PUBLIC API
// ============================================================
export async function openMiniKeyringEditor(containerEl, imageFile, onConfirm, onCancel) {
    containerEl.style.display = 'block';
    containerEl.innerHTML = buildEditorHTML();

    const canvas = containerEl.querySelector('#mkrCanvas');
    const wrapper = containerEl.querySelector('.mkr-canvas-wrapper');

    es = {
        container: containerEl,
        canvas, ctx: null,
        offCanvas: null, offCtx: null,
        origW: 0, origH: 0,
        origDataURL: null,
        strokes: [], currentStroke: [],
        drawing: false, eraserMode: false,
        brushSize: 20,
        drawX: 0, drawY: 0, drawW: 0, drawH: 0, displayScale: 1,
        dpr: 1, logW: 0, logH: 0,
        holeAngle: -90, // 고리 위치 각도 (deg, -90=상단 중앙)
        draggingHole: false,
        onConfirm, onCancel
    };

    // 1. 파일 읽기
    const dataURL = await readFileAsDataURL(imageFile);
    const origImg = await loadImage(dataURL);

    // 이미지 크기 제한 (모바일 메모리)
    const MAX = 2000;
    let w = origImg.width, h = origImg.height;
    if (w > MAX || h > MAX) {
        const s = Math.min(MAX / w, MAX / h);
        w = Math.round(w * s); h = Math.round(h * s);
    }
    es.origW = w; es.origH = h;

    // off-screen canvas
    es.offCanvas = document.createElement('canvas');
    es.offCanvas.width = w; es.offCanvas.height = h;
    es.offCtx = es.offCanvas.getContext('2d');
    es.offCtx.drawImage(origImg, 0, 0, w, h);
    es.origDataURL = es.offCanvas.toDataURL('image/png');

    // display canvas 세팅
    setupDisplayCanvas(wrapper, canvas);

    // 초기 렌더
    renderPreview();

    // 2. 배경 제거 시작
    const loadingEl = containerEl.querySelector('.mkr-loading');
    const canvasArea = containerEl.querySelector('.mkr-canvas-wrapper');
    loadingEl.style.display = 'flex';
    canvasArea.style.display = 'none';

    try {
        const bgRemovedURL = await removeBackground(dataURL);
        const bgImg = await loadImage(bgRemovedURL);
        // offCanvas에 누끼 이미지 다시 그리기
        es.offCtx.clearRect(0, 0, w, h);
        es.offCtx.drawImage(bgImg, 0, 0, w, h);
        es.origDataURL = es.offCanvas.toDataURL('image/png');
        URL.revokeObjectURL(bgRemovedURL);
    } catch (err) {
        console.warn('배경 제거 실패:', err);
        if (window.showToast) window.showToast(window.t?.('mkr_bg_fail', 'Background removal failed. You can edit manually.'), 'warn');
        // 원본 이미지로 계속 진행
    }

    loadingEl.style.display = 'none';
    canvasArea.style.display = 'flex';
    renderPreview();

    // 3. 이벤트 바인딩
    bindToolbarEvents(containerEl);
    bindCanvasEvents(canvas);
}

export function closeMiniKeyringEditor() {
    if (!es) return;
    unbindCanvasEvents(es.canvas);
    es.container.style.display = 'none';
    es.container.innerHTML = '';
    es = null;
}

// ============================================================
// HTML 생성
// ============================================================
function buildEditorHTML() {
    const t = (k, d) => window.t?.(k, d) || d;
    return `
        <div class="mini-keyring-editor">
            <div class="mkr-loading">
                <div style="width:28px;height:28px;border:3px solid #e2e8f0;border-top:3px solid #6366f1;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                <p style="margin:8px 0 0;font-size:13px;color:#64748b;">${t('mkr_removing_bg', 'Removing background...')}</p>
            </div>
            <div class="mkr-canvas-wrapper" style="display:none;">
                <canvas id="mkrCanvas"></canvas>
                <div class="mkr-eraser-cursor"></div>
            </div>
            <div class="mkr-toolbar">
                <button class="mkr-tool-btn" id="mkrEraserToggle" title="${t('mkr_eraser', 'Eraser')}">
                    <i class="fa-solid fa-eraser"></i>
                </button>
                <input type="range" id="mkrBrushSize" min="5" max="80" value="20" class="mkr-slider" style="display:none;width:70px;">
                <button class="mkr-tool-btn" id="mkrUndo" style="display:none;" title="${t('mkr_undo', 'Undo')}">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
                <div style="flex:1;"></div>
                <button class="mkr-cancel-btn" id="mkrCancel">${t('mkr_cancel', 'Cancel')}</button>
                <button class="mkr-confirm-btn" id="mkrConfirm"><i class="fa-solid fa-check"></i> OK</button>
            </div>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
}

// ============================================================
// Canvas 세팅
// ============================================================
function setupDisplayCanvas(wrapper, canvas) {
    const displayW = wrapper.clientWidth || 300;
    const displayH = Math.min(displayW, 350);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';

    es.ctx = canvas.getContext('2d');
    es.dpr = dpr;
    es.logW = displayW;
    es.logH = displayH;
}

// ============================================================
// 렌더링
// ============================================================
function renderPreview() {
    if (!es) return;
    const ctx = es.ctx;
    const dpr = es.dpr;
    const W = es.logW, H = es.logH;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 1. 배경 (밝은 체크보드)
    drawCheckerboard(ctx, W, H, 10);

    // 2. 이미지 영역 계산 (패딩 + 상단 고리 공간)
    const pad = 15;
    const holeSpace = 30;
    const availW = W - pad * 2;
    const availH = H - pad * 2 - holeSpace;
    const scale = Math.min(availW / es.origW, availH / es.origH);
    const drawW = es.origW * scale;
    const drawH = es.origH * scale;
    const drawX = (W - drawW) / 2;
    const drawY = holeSpace + (H - holeSpace - drawH) / 2;

    es.drawX = drawX; es.drawY = drawY;
    es.drawW = drawW; es.drawH = drawH;
    es.displayScale = scale;

    // 3. 아크릴 외곽 테두리 (실루엣 blur 방식)
    drawAcrylicOutline(ctx, drawX, drawY, drawW, drawH, scale);

    // 4. 편집된 이미지
    ctx.drawImage(es.offCanvas, drawX, drawY, drawW, drawH);

    // 5. 키링 고리 구멍 (holeAngle 기반 위치)
    const holePt = getHolePosition(drawX, drawY, drawW, drawH, es.holeAngle);
    es._holeCx = holePt.cx; es._holeCy = holePt.cy; // 히트 테스트용 캐시
    drawKeyringHole(ctx, holePt.cx, holePt.cy, holePt.connX, holePt.connY, scale);

    ctx.restore();
}

function drawAcrylicOutline(ctx, dx, dy, dw, dh, scale) {
    // 실루엣 생성 (알파 채널 기반)
    const tmpCanvas = document.createElement('canvas');
    const tmpW = Math.round(dw + 20);
    const tmpH = Math.round(dh + 20);
    tmpCanvas.width = tmpW; tmpCanvas.height = tmpH;
    const tmpCtx = tmpCanvas.getContext('2d');

    // 이미지를 offset해서 그리기 (10px 패딩)
    tmpCtx.drawImage(es.offCanvas, 10, 10, dw, dh);

    // 알파 → 단색 실루엣
    tmpCtx.globalCompositeOperation = 'source-in';
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, tmpW, tmpH);

    // 팽창: blur + 다중 패스
    const expandCanvas = document.createElement('canvas');
    expandCanvas.width = tmpW; expandCanvas.height = tmpH;
    const expCtx = expandCanvas.getContext('2d');
    const blurPx = Math.max(4, Math.round(6 * scale));

    // 여러 번 blur 적용으로 팽창
    expCtx.filter = `blur(${blurPx}px)`;
    expCtx.drawImage(tmpCanvas, 0, 0);
    expCtx.drawImage(expandCanvas, 0, 0);
    expCtx.filter = 'none';

    // threshold 적용
    const imgData = expCtx.getImageData(0, 0, tmpW, tmpH);
    const d = imgData.data;
    for (let i = 3; i < d.length; i += 4) {
        d[i] = d[i] > 15 ? 255 : 0;
    }
    expCtx.putImageData(imgData, 0, 0);

    // 아크릴 반투명 채우기
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.drawImage(expandCanvas, dx - 10, dy - 10);
    ctx.globalAlpha = 1;

    // 빨간 커트라인 테두리
    // 확장 마스크의 edge를 그리기 위해 source-in 트릭
    const edgeCanvas = document.createElement('canvas');
    edgeCanvas.width = tmpW; edgeCanvas.height = tmpH;
    const edgeCtx = edgeCanvas.getContext('2d');
    edgeCtx.drawImage(expandCanvas, 0, 0);
    // 안쪽 2px 축소해서 빼기
    edgeCtx.globalCompositeOperation = 'destination-out';
    edgeCtx.filter = 'none';
    const innerCanvas = document.createElement('canvas');
    innerCanvas.width = tmpW; innerCanvas.height = tmpH;
    const innerCtx = innerCanvas.getContext('2d');
    innerCtx.drawImage(expandCanvas, 0, 0);
    // erode: 안쪽으로 2px
    const innerData = innerCtx.getImageData(0, 0, tmpW, tmpH);
    erodeAlpha(innerData, 2);
    innerCtx.putImageData(innerData, 0, 0);
    edgeCtx.drawImage(innerCanvas, 0, 0);

    // edge를 빨간색으로
    edgeCtx.globalCompositeOperation = 'source-in';
    edgeCtx.fillStyle = '#FF0000';
    edgeCtx.fillRect(0, 0, tmpW, tmpH);

    ctx.globalAlpha = 0.7;
    ctx.drawImage(edgeCanvas, dx - 10, dy - 10);
    ctx.globalAlpha = 1;
    ctx.restore();
}

function erodeAlpha(imgData, pixels) {
    const w = imgData.width, h = imgData.height;
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4 + 3;
            if (copy[idx] === 0) continue;
            let edge = false;
            for (let dy = -pixels; dy <= pixels && !edge; dy++) {
                for (let dx = -pixels; dx <= pixels && !edge; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) { edge = true; }
                    else if (copy[(ny * w + nx) * 4 + 3] === 0) { edge = true; }
                }
            }
            if (edge) d[idx] = 0;
        }
    }
}

function getHolePosition(drawX, drawY, drawW, drawH, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cx = drawX + drawW / 2;
    const cy = drawY + drawH / 2;
    const rx = drawW / 2 + 2; // 이미지 가장자리에서 약간 바깥
    const ry = drawH / 2 + 2;
    // 타원 위의 점 (이미지 경계)
    const edgeX = cx + rx * Math.cos(rad);
    const edgeY = cy + ry * Math.sin(rad);
    // 고리 중심은 가장자리에서 더 바깥으로
    const dist = 16;
    const holeX = edgeX + dist * Math.cos(rad);
    const holeY = edgeY + dist * Math.sin(rad);
    return { cx: holeX, cy: holeY, connX: edgeX, connY: edgeY };
}

function drawKeyringHole(ctx, cx, cy, connX, connY, scale) {
    const outerR = Math.max(10, 14 * scale);
    const innerR = Math.max(6, 8.5 * scale);

    // 연결 바 (이미지 가장자리 → 고리 중심)
    ctx.beginPath();
    ctx.moveTo(connX, connY);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = 'rgba(200,200,200,0.5)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // 외곽 원
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,200,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 내부 구멍
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 드래그 힌트 (반투명 이동 아이콘)
    ctx.fillStyle = 'rgba(99,102,241,0.6)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⤡', cx, cy + 3);
}

function drawCheckerboard(ctx, w, h, size) {
    for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
            ctx.fillStyle = ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) ? '#f8f8f8' : '#e8e8e8';
            ctx.fillRect(x, y, size, size);
        }
    }
}

// ============================================================
// 지우개
// ============================================================
function screenToOriginal(clientX, clientY) {
    if (!es) return { x: 0, y: 0 };
    const rect = es.canvas.getBoundingClientRect();
    const logX = clientX - rect.left;
    const logY = clientY - rect.top;
    return {
        x: (logX - es.drawX) / es.displayScale,
        y: (logY - es.drawY) / es.displayScale
    };
}

function getEraserBrushRadius() {
    if (!es) return 10;
    const rect = es.canvas.getBoundingClientRect();
    const sx = es.origW / (es.drawW * (rect.width / es.logW));
    return (es.brushSize / 2) * sx;
}

function canvasDown(e) {
    if (!es) return;
    const rect = es.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 고리 히트 테스트 (지우개 모드가 아닐 때)
    if (!es.eraserMode && es._holeCx !== undefined) {
        const dx = mx - es._holeCx, dy = my - es._holeCy;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
            es.draggingHole = true;
            return;
        }
    }

    // 지우개 모드
    if (!es.eraserMode) return;
    eraserDown(e);
}

function canvasMove(e) {
    if (!es) return;
    if (es.draggingHole) {
        const rect = es.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // 이미지 중심 기준 각도 계산
        const imgCx = es.drawX + es.drawW / 2;
        const imgCy = es.drawY + es.drawH / 2;
        es.holeAngle = Math.atan2(my - imgCy, mx - imgCx) * 180 / Math.PI;
        renderPreview();
        return;
    }
    updateCursor(e);
    eraserMove(e);
}

function canvasUp() {
    if (!es) return;
    if (es.draggingHole) { es.draggingHole = false; return; }
    eraserUp();
}

function eraserDown(e) {
    if (!es || !es.eraserMode) return;
    es.drawing = true;
    const pt = screenToOriginal(e.clientX, e.clientY);
    pt.r = getEraserBrushRadius();
    es.currentStroke = [pt];
    const ctx = es.offCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    renderPreview();
}

function eraserMove(e) {
    if (!es || !es.drawing) return;
    const pt = screenToOriginal(e.clientX, e.clientY);
    pt.r = getEraserBrushRadius();
    es.currentStroke.push(pt);
    const prev = es.currentStroke[es.currentStroke.length - 2];
    const ctx = es.offCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = pt.r * 2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    renderPreview();
}

function eraserUp() {
    if (!es || !es.drawing) return;
    es.drawing = false;
    if (es.currentStroke.length > 0) {
        es.strokes.push(es.currentStroke);
        es.currentStroke = [];
    }
}

function canvasTouchDown(e) { e.preventDefault(); const t = e.touches[0]; canvasDown({ clientX: t.clientX, clientY: t.clientY }); }
function canvasTouchMove(e) { e.preventDefault(); const t = e.touches[0]; canvasMove({ clientX: t.clientX, clientY: t.clientY }); }
function canvasTouchUp() { canvasUp(); }

function updateCursor(e) {
    if (!es) return;
    const rect = es.canvas.getBoundingClientRect();

    // 고리 근처 → grab 커서
    if (!es.eraserMode && es._holeCx !== undefined) {
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const dx = mx - es._holeCx, dy = my - es._holeCy;
        es.canvas.style.cursor = Math.sqrt(dx*dx + dy*dy) < 25 ? 'grab' : 'default';
    }

    if (!es.eraserMode) return;
    const cursor = es.container.querySelector('.mkr-eraser-cursor');
    if (!cursor) return;
    const s = es.brushSize;
    cursor.style.display = 'block';
    cursor.style.width = s + 'px';
    cursor.style.height = s + 'px';
    cursor.style.left = (e.clientX - rect.left - s / 2) + 'px';
    cursor.style.top = (e.clientY - rect.top - s / 2) + 'px';
}
function updateCursorTouch(e) {
    if (e.touches[0]) updateCursor({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
}

function eraserUndo() {
    if (!es || es.strokes.length === 0) return;
    es.strokes.pop();
    // 원본에서 다시 그리고 모든 스트로크 재적용
    const img = new Image();
    img.onload = () => {
        es.offCtx.clearRect(0, 0, es.origW, es.origH);
        es.offCtx.globalCompositeOperation = 'source-over';
        es.offCtx.drawImage(img, 0, 0, es.origW, es.origH);
        es.offCtx.globalCompositeOperation = 'destination-out';
        for (const stroke of es.strokes) {
            applyStroke(es.offCtx, stroke);
        }
        es.offCtx.globalCompositeOperation = 'source-over';
        renderPreview();
    };
    img.src = es.origDataURL;
}

function applyStroke(ctx, stroke) {
    if (!stroke || stroke.length === 0) return;
    const brushR = stroke[0].r || 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushR * 2;
    if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, brushR, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
    }
}

// ============================================================
// 이벤트 바인딩
// ============================================================
function bindCanvasEvents(canvas) {
    canvas.addEventListener('mousedown', canvasDown);
    canvas.addEventListener('mousemove', canvasMove);
    canvas.addEventListener('mouseup', canvasUp);
    canvas.addEventListener('mouseleave', canvasUp);
    canvas.addEventListener('touchstart', canvasTouchDown, { passive: false });
    canvas.addEventListener('touchmove', canvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', canvasTouchUp);
    canvas.addEventListener('touchcancel', canvasTouchUp);
}

function unbindCanvasEvents(canvas) {
    if (!canvas) return;
    canvas.removeEventListener('mousedown', canvasDown);
    canvas.removeEventListener('mousemove', canvasMove);
    canvas.removeEventListener('mouseup', canvasUp);
    canvas.removeEventListener('mouseleave', canvasUp);
    canvas.removeEventListener('touchstart', canvasTouchDown);
    canvas.removeEventListener('touchmove', canvasTouchMove);
    canvas.removeEventListener('touchend', canvasTouchUp);
    canvas.removeEventListener('touchcancel', canvasTouchUp);
}

function bindToolbarEvents(container) {
    const eraserBtn = container.querySelector('#mkrEraserToggle');
    const slider = container.querySelector('#mkrBrushSize');
    const undoBtn = container.querySelector('#mkrUndo');
    const cancelBtn = container.querySelector('#mkrCancel');
    const confirmBtn = container.querySelector('#mkrConfirm');

    eraserBtn.onclick = () => {
        es.eraserMode = !es.eraserMode;
        eraserBtn.classList.toggle('active', es.eraserMode);
        slider.style.display = es.eraserMode ? '' : 'none';
        undoBtn.style.display = es.eraserMode ? '' : 'none';
        es.canvas.style.cursor = es.eraserMode ? 'none' : 'default';
        const cursor = container.querySelector('.mkr-eraser-cursor');
        if (cursor && !es.eraserMode) cursor.style.display = 'none';
    };

    slider.oninput = () => { es.brushSize = parseInt(slider.value); };

    undoBtn.onclick = () => eraserUndo();

    cancelBtn.onclick = () => {
        if (es.onCancel) es.onCancel();
        closeMiniKeyringEditor();
    };

    confirmBtn.onclick = () => handleConfirm();
}

// ============================================================
// 확인 → 칼선 생성 → 업로드 → 장바구니
// ============================================================
async function handleConfirm() {
    if (!es) return;
    const dataURL = es.offCanvas.toDataURL('image/png');
    const cutlineDataURL = generateCutlineImage();
    if (es.onConfirm) es.onConfirm(dataURL, cutlineDataURL);
    closeMiniKeyringEditor();
}

// 칼선(커트라인) 이미지 생성 — 원본 해상도로 디자인 + 빨간 외곽선 + 고리 구멍
function generateCutlineImage() {
    if (!es) return null;
    const w = es.origW, h = es.origH;
    // 고리 공간 추가 (상단/좌우/하단 여백)
    const margin = Math.round(Math.max(w, h) * 0.08);
    const holeExtra = Math.round(Math.max(w, h) * 0.1);
    const cW = w + margin * 2;
    const cH = h + margin * 2 + holeExtra;

    const cv = document.createElement('canvas');
    cv.width = cW; cv.height = cH;
    const ctx = cv.getContext('2d');

    // 투명 배경
    ctx.clearRect(0, 0, cW, cH);

    const imgX = margin, imgY = margin + holeExtra;

    // 1. 아크릴 외곽선 (blur+threshold 방식, 원본 해상도)
    drawCutlineOutline(ctx, imgX, imgY, w, h);

    // 2. 편집된 이미지
    ctx.drawImage(es.offCanvas, imgX, imgY, w, h);

    // 3. 키링 고리 구멍 (holeAngle 기반)
    const holePt = getHolePosition(imgX, imgY, w, h, es.holeAngle);
    drawKeyringHole(ctx, holePt.cx, holePt.cy, holePt.connX, holePt.connY, 1);

    return cv.toDataURL('image/png');
}

// 칼선 전용 외곽선 (원본 해상도)
function drawCutlineOutline(ctx, dx, dy, dw, dh) {
    const padPx = 16;
    const tmpW = dw + padPx * 2, tmpH = dh + padPx * 2;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tmpW; tmpCanvas.height = tmpH;
    const tmpCtx = tmpCanvas.getContext('2d');

    // 이미지 실루엣
    tmpCtx.drawImage(es.offCanvas, padPx, padPx, dw, dh);
    tmpCtx.globalCompositeOperation = 'source-in';
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, tmpW, tmpH);

    // blur 팽창
    const expandCanvas = document.createElement('canvas');
    expandCanvas.width = tmpW; expandCanvas.height = tmpH;
    const expCtx = expandCanvas.getContext('2d');
    const blurPx = Math.max(6, Math.round(dw * 0.015));
    expCtx.filter = `blur(${blurPx}px)`;
    expCtx.drawImage(tmpCanvas, 0, 0);
    expCtx.drawImage(expandCanvas, 0, 0);
    expCtx.filter = 'none';

    // threshold
    const imgData = expCtx.getImageData(0, 0, tmpW, tmpH);
    const d = imgData.data;
    for (let i = 3; i < d.length; i += 4) {
        d[i] = d[i] > 15 ? 255 : 0;
    }
    expCtx.putImageData(imgData, 0, 0);

    // 빨간 커트라인 테두리 (3px)
    const edgeCanvas = document.createElement('canvas');
    edgeCanvas.width = tmpW; edgeCanvas.height = tmpH;
    const edgeCtx = edgeCanvas.getContext('2d');
    edgeCtx.drawImage(expandCanvas, 0, 0);
    edgeCtx.globalCompositeOperation = 'destination-out';
    const innerCanvas = document.createElement('canvas');
    innerCanvas.width = tmpW; innerCanvas.height = tmpH;
    const innerCtx = innerCanvas.getContext('2d');
    innerCtx.drawImage(expandCanvas, 0, 0);
    const innerData = innerCtx.getImageData(0, 0, tmpW, tmpH);
    erodeAlpha(innerData, 3);
    innerCtx.putImageData(innerData, 0, 0);
    edgeCtx.drawImage(innerCanvas, 0, 0);

    edgeCtx.globalCompositeOperation = 'source-in';
    edgeCtx.fillStyle = '#FF0000';
    edgeCtx.fillRect(0, 0, tmpW, tmpH);

    ctx.drawImage(edgeCanvas, dx - padPx, dy - padPx);
}

// ============================================================
// 배경 제거 (Remove.bg API)
// ============================================================
async function removeBackground(imageDataURL) {
    const key = await getApiKey('REMOVE_BG_API_KEY');
    if (!key) throw new Error('No API key');

    const blob = await (await fetch(imageDataURL)).blob();
    const form = new FormData();
    form.append('image_file', blob);
    form.append('size', 'auto');

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': key },
        body: form
    });

    if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(errTxt);
    }

    return URL.createObjectURL(await res.blob());
}

async function getApiKey(keyName) {
    const _sb = sb || window.sb;
    if (!_sb) return null;
    try {
        const { data, error } = await _sb.from('secrets').select('value').eq('name', keyName).single();
        if (error || !data) return null;
        return data.value;
    } catch (e) { return null; }
}

// ============================================================
// 유틸리티
// ============================================================
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
