import { canvas } from "./canvas-core.js?v=123";
import { addToCenter } from "./canvas-objects.js?v=123";

/* ─────────────────────────────────────────────
   Canva-style Floating Toolbar + Eraser + BG Remove
   ───────────────────────────────────────────── */

// ─── State ──────────────────────────────────
let eraserState = null;   // { img, origDataURL, offCanvas, offCtx, strokes:[], drawing:false }
const TOOLBAR_GAP = 12;   // px above image

// ─── Floating Toolbar: show / hide / position ──
function getScreenBounds(obj) {
    const br = obj.getBoundingRect(true);          // canvas-relative
    const cEl = canvas.getElement();
    const rect = cEl.getBoundingClientRect();
    return {
        left:   rect.left + br.left,
        top:    rect.top  + br.top,
        width:  br.width,
        height: br.height
    };
}

function positionFloatingToolbar() {
    const tb = document.getElementById('imageFloatingToolbar');
    if (!tb) return;
    const active = canvas.getActiveObject();
    if (!active || active.type !== 'image') { tb.style.display = 'none'; return; }

    const b = getScreenBounds(active);
    tb.style.display = 'flex';
    const tbW = tb.offsetWidth;
    let left = b.left + (b.width - tbW) / 2;
    let top  = b.top - tb.offsetHeight - TOOLBAR_GAP;
    // 화면 위로 넘어가면 아래로
    if (top < 4) top = b.top + b.height + TOOLBAR_GAP;
    // 좌우 클램프
    left = Math.max(4, Math.min(left, window.innerWidth - tbW - 4));
    tb.style.left = left + 'px';
    tb.style.top  = top  + 'px';
}

function hideFloatingToolbar() {
    const tb = document.getElementById('imageFloatingToolbar');
    if (tb) tb.style.display = 'none';
}

function hookSelectionEvents() {
    const show = () => requestAnimationFrame(positionFloatingToolbar);
    canvas.on('selection:created', show);
    canvas.on('selection:updated', show);
    canvas.on('selection:cleared', hideFloatingToolbar);
    canvas.on('object:moving',  show);
    canvas.on('object:scaling', show);
    canvas.on('object:rotating', show);
    // viewport 변경 시에도 업데이트
    canvas.on('mouse:wheel', () => setTimeout(show, 50));
}

// ─── Eraser Mode ────────────────────────────
function enterEraserMode() {
    const active = canvas.getActiveObject();
    if (!active || active.type !== 'image') return alert(window.t?.('msg_select_image','Please select an image.') || 'Please select an image.');
    hideFloatingToolbar();

    // 원본 이미지를 off-screen canvas에 캡처 (원본 해상도)
    const origW = active.width;
    const origH = active.height;
    const offCanvas = document.createElement('canvas');
    offCanvas.width  = origW;
    offCanvas.height = origH;
    const offCtx = offCanvas.getContext('2d');

    // 원본 이미지를 임시 캔버스에 그리기 (필터 적용 상태)
    const imgEl = active.getElement();
    offCtx.drawImage(imgEl, 0, 0, origW, origH);
    // 필터 적용된 상태라면 fabric의 toCanvasElement 사용
    try {
        const filteredCanvas = active.toCanvasElement();
        offCtx.clearRect(0, 0, origW, origH);
        offCtx.drawImage(filteredCanvas, 0, 0, origW, origH);
    } catch(e) { /* fallback to imgEl above */ }

    const origDataURL = offCanvas.toDataURL('image/png');

    eraserState = {
        img: active,
        origW, origH,
        origDataURL,
        offCanvas, offCtx,
        strokes: [],    // [ [{x,y}, ...], [...], ... ]
        currentStroke: [],
        drawing: false,
        brushSize: parseInt(document.getElementById('eraserSizeSlider')?.value || 30)
    };

    // 오버레이 표시
    const overlay = document.getElementById('eraserOverlay');
    const eraserCanvas = document.getElementById('eraserCanvas');
    const cursor = document.getElementById('eraserCursor');
    overlay.style.display = 'block';
    cursor.style.display = 'block';

    // eraserCanvas를 이미지 화면 위치에 맞추기
    positionEraserCanvas();

    // fabric 인터랙션 비활성화
    canvas.discardActiveObject();
    canvas.selection = false;
    canvas.forEachObject(o => { o._origEvented = o.evented; o.evented = false; });
    canvas.requestRenderAll();

    // 이벤트 바인딩
    eraserCanvas.addEventListener('mousedown', eraserDown);
    eraserCanvas.addEventListener('mousemove', eraserMove);
    eraserCanvas.addEventListener('mouseup',   eraserUp);
    eraserCanvas.addEventListener('mouseleave', eraserUp);
    // 터치
    eraserCanvas.addEventListener('touchstart', eraserTouchDown, { passive: false });
    eraserCanvas.addEventListener('touchmove',  eraserTouchMove, { passive: false });
    eraserCanvas.addEventListener('touchend',   eraserTouchUp);
    eraserCanvas.addEventListener('touchcancel', eraserTouchUp);
    // 커서 추적
    overlay.addEventListener('mousemove', updateCursorPos);
    overlay.addEventListener('touchmove', updateCursorTouchPos, { passive: false });
}

function positionEraserCanvas() {
    const es = eraserState; if (!es) return;
    const eraserCanvas = document.getElementById('eraserCanvas');
    const b = getScreenBounds(es.img);

    // eraserCanvas를 화면 좌표에 맞춤
    eraserCanvas.style.left   = b.left + 'px';
    eraserCanvas.style.top    = b.top  + 'px';
    eraserCanvas.style.width  = b.width  + 'px';
    eraserCanvas.style.height = b.height + 'px';
    // 내부 해상도는 원본과 동일
    eraserCanvas.width  = es.origW;
    eraserCanvas.height = es.origH;

    // 현재 상태 다시 그리기
    redrawEraser();
}

function redrawEraser() {
    const es = eraserState; if (!es) return;
    const ctx = es.offCtx;
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, es.origW, es.origH);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 0, 0, es.origW, es.origH);
        // 모든 스트로크 재적용
        ctx.globalCompositeOperation = 'destination-out';
        for (const stroke of es.strokes) {
            applyStroke(ctx, stroke, es);
        }
        ctx.globalCompositeOperation = 'source-over';
        // eraserCanvas에 복사
        const dispCtx = document.getElementById('eraserCanvas').getContext('2d');
        dispCtx.clearRect(0, 0, es.origW, es.origH);
        // 체크보드 배경 (투명 표시)
        drawCheckerboard(dispCtx, es.origW, es.origH);
        dispCtx.drawImage(es.offCanvas, 0, 0);
    };
    img.src = es.origDataURL;
}

function drawCheckerboard(ctx, w, h) {
    const size = 16;
    for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
            ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#ffffff' : '#e0e0e0';
            ctx.fillRect(x, y, size, size);
        }
    }
}

function applyStroke(ctx, stroke, es) {
    if (!stroke || stroke.length === 0) return;
    const brushR = stroke[0].r || es.brushSize / 2;
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

// 화면 좌표 → 원본 이미지 좌표
function screenToOriginal(clientX, clientY) {
    const es = eraserState; if (!es) return { x: 0, y: 0 };
    const ec = document.getElementById('eraserCanvas');
    const rect = ec.getBoundingClientRect();
    const sx = es.origW / rect.width;
    const sy = es.origH / rect.height;
    return {
        x: (clientX - rect.left) * sx,
        y: (clientY - rect.top)  * sy
    };
}

function getEraserBrushRadius() {
    const es = eraserState; if (!es) return 15;
    const ec = document.getElementById('eraserCanvas');
    const rect = ec.getBoundingClientRect();
    const sx = es.origW / rect.width;
    return (es.brushSize / 2) * sx;
}

function eraserDown(e) {
    const es = eraserState; if (!es) return;
    es.drawing = true;
    const pt = screenToOriginal(e.clientX, e.clientY);
    pt.r = getEraserBrushRadius();
    es.currentStroke = [pt];
    // 즉시 지우기 시작
    const ctx = es.offCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    copyToDisplay();
}

function eraserMove(e) {
    const es = eraserState; if (!es || !es.drawing) return;
    const pt = screenToOriginal(e.clientX, e.clientY);
    pt.r = getEraserBrushRadius();
    es.currentStroke.push(pt);
    // 지우기
    const ctx = es.offCtx;
    const prev = es.currentStroke[es.currentStroke.length - 2];
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = pt.r * 2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    copyToDisplay();
}

function eraserUp() {
    const es = eraserState; if (!es || !es.drawing) return;
    es.drawing = false;
    if (es.currentStroke.length > 0) {
        es.strokes.push(es.currentStroke);
        es.currentStroke = [];
    }
}

// 터치 이벤트 래퍼
function eraserTouchDown(e) { e.preventDefault(); const t = e.touches[0]; eraserDown({ clientX: t.clientX, clientY: t.clientY }); }
function eraserTouchMove(e) { e.preventDefault(); const t = e.touches[0]; eraserMove({ clientX: t.clientX, clientY: t.clientY }); }
function eraserTouchUp(e) { eraserUp(); }

function updateCursorPos(e) {
    const cursor = document.getElementById('eraserCursor');
    const es = eraserState; if (!cursor || !es) return;
    const s = es.brushSize;
    cursor.style.width  = s + 'px';
    cursor.style.height = s + 'px';
    cursor.style.left   = (e.clientX - s/2) + 'px';
    cursor.style.top    = (e.clientY - s/2) + 'px';
}
function updateCursorTouchPos(e) {
    e.preventDefault();
    const t = e.touches[0];
    updateCursorPos({ clientX: t.clientX, clientY: t.clientY });
}

function copyToDisplay() {
    const es = eraserState; if (!es) return;
    const dispCtx = document.getElementById('eraserCanvas').getContext('2d');
    dispCtx.clearRect(0, 0, es.origW, es.origH);
    drawCheckerboard(dispCtx, es.origW, es.origH);
    dispCtx.drawImage(es.offCanvas, 0, 0);
}

function eraserUndo() {
    const es = eraserState; if (!es || es.strokes.length === 0) return;
    es.strokes.pop();
    redrawEraser();
}

function exitEraserMode(apply) {
    const es = eraserState; if (!es) return;
    const overlay = document.getElementById('eraserOverlay');
    const eraserCanvas = document.getElementById('eraserCanvas');
    const cursor = document.getElementById('eraserCursor');

    // 이벤트 제거
    eraserCanvas.removeEventListener('mousedown', eraserDown);
    eraserCanvas.removeEventListener('mousemove', eraserMove);
    eraserCanvas.removeEventListener('mouseup',   eraserUp);
    eraserCanvas.removeEventListener('mouseleave', eraserUp);
    eraserCanvas.removeEventListener('touchstart', eraserTouchDown);
    eraserCanvas.removeEventListener('touchmove',  eraserTouchMove);
    eraserCanvas.removeEventListener('touchend',   eraserTouchUp);
    eraserCanvas.removeEventListener('touchcancel', eraserTouchUp);
    overlay.removeEventListener('mousemove', updateCursorPos);
    overlay.removeEventListener('touchmove', updateCursorTouchPos);

    overlay.style.display = 'none';
    cursor.style.display  = 'none';

    // fabric 인터랙션 복원
    canvas.selection = true;
    canvas.forEachObject(o => {
        if (o._origEvented !== undefined) { o.evented = o._origEvented; delete o._origEvented; }
        else o.evented = true;
    });

    if (apply && es.strokes.length > 0) {
        // 결과물 → 새 fabric.Image로 교체
        const dataURL = es.offCanvas.toDataURL('image/png');
        const oldImg = es.img;
        const props = {
            left: oldImg.left, top: oldImg.top,
            scaleX: oldImg.scaleX, scaleY: oldImg.scaleY,
            angle: oldImg.angle, flipX: oldImg.flipX, flipY: oldImg.flipY,
            opacity: oldImg.opacity, originX: oldImg.originX, originY: oldImg.originY
        };
        // z-order 보존
        const objects = canvas.getObjects();
        const idx = objects.indexOf(oldImg);

        fabric.Image.fromURL(dataURL, (newImg) => {
            newImg.set(props);
            canvas.remove(oldImg);
            if (idx >= 0 && idx < canvas.getObjects().length) {
                canvas.insertAt(newImg, idx);
            } else {
                canvas.add(newImg);
            }
            canvas.setActiveObject(newImg);
            canvas.requestRenderAll();
        }, { crossOrigin: 'anonymous' });
    } else {
        // 취소: 원본 이미지 다시 선택
        canvas.setActiveObject(es.img);
        canvas.requestRenderAll();
    }

    eraserState = null;
}

// ─── Background Removal → canvas-ai.js의 remove.bg API 사용 ───
function triggerBgRemove() {
    hideFloatingToolbar();
    // canvas-ai.js에서 btnCutout.onclick에 remove.bg API 연결됨
    const btn = document.getElementById('btnCutout');
    if (btn) btn.click();
}

// ─── Edit → 좌측 정렬&레이어 패널 열기 ────────
function openAlignPanel() {
    hideFloatingToolbar();
    if (typeof window.toggleSubPanel === 'function') {
        window.toggleSubPanel('sub-align');
    }
}

// ─── Main Init ──────────────────────────────
export function initImageTools() {
    // 1. 이미지 업로드
    const fileInput = document.getElementById("imgUpload");
    if (fileInput) {
        fileInput.onchange = (e) => handleImageUpload(e.target.files[0]);
    }

    // 2. 밝게 보정
    const btnEnhance = document.getElementById("btnEnhance");
    if (btnEnhance) {
        btnEnhance.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active || active.type !== 'image') return alert(window.t?.('msg_select_image','Please select an image.') || 'Please select an image.');
            if (!active.filters) active.filters = [];
            let brightFilter = active.filters.find(f => f.type === 'Brightness');
            if (brightFilter) {
                brightFilter.brightness = Math.min(brightFilter.brightness + 0.1, 1);
            } else {
                brightFilter = new fabric.Image.filters.Brightness({ brightness: 0.1 });
                active.filters.push(brightFilter);
            }
            active.applyFilters();
            canvas.requestRenderAll();
        };
    }

    // 4. 플로팅 툴바 버튼 연결
    const btnEdit = document.getElementById('imgToolEdit');
    const btnBgRemove = document.getElementById('imgToolBgRemove');
    const btnEraser = document.getElementById('imgToolEraser');

    if (btnEdit)     btnEdit.onclick     = () => openAlignPanel();
    if (btnBgRemove) btnBgRemove.onclick = () => triggerBgRemove();
    if (btnEraser)   btnEraser.onclick   = () => enterEraserMode();

    // 5. 지우개 컨트롤 바 버튼 연결
    const eraserSizeSlider = document.getElementById('eraserSizeSlider');
    const eraserUndoBtn    = document.getElementById('eraserUndo');
    const eraserCancelBtn  = document.getElementById('eraserCancel');
    const eraserDoneBtn    = document.getElementById('eraserDone');

    if (eraserSizeSlider) {
        eraserSizeSlider.oninput = () => {
            if (eraserState) eraserState.brushSize = parseInt(eraserSizeSlider.value);
        };
    }
    if (eraserUndoBtn)   eraserUndoBtn.onclick   = () => eraserUndo();
    if (eraserCancelBtn) eraserCancelBtn.onclick  = () => exitEraserMode(false);
    if (eraserDoneBtn)   eraserDoneBtn.onclick    = () => exitEraserMode(true);

    // 6. 선택 이벤트 훅 (플로팅 툴바)
    hookSelectionEvents();
}

// ─── Image Upload ───────────────────────────
function handleImageUpload(file) {
    if (!file) return;

    if (file.type === 'application/pdf') {
        alert(window.t?.('msg_pdf_error', "Please upload PDF in the 'Order' step. Only images are supported in the editor.") || "Please upload PDF in the 'Order' step.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const imgObj = new Image();
        imgObj.src = e.target.result;
        imgObj.onload = () => {
            const fabricImg = new fabric.Image(imgObj);
            const board = canvas.getObjects().find(o => o.isBoard);
            const maxW = board ? board.width * 0.3 : 200;
            const maxH = board ? board.height * 0.3 : 200;
            const scale = Math.min(maxW / fabricImg.width, maxH / fabricImg.height, 1);
            fabricImg.set({ scaleX: scale, scaleY: scale });
            addToCenter(fabricImg);
            canvas.bringToFront(fabricImg);
            canvas.requestRenderAll();
        };
    };
    reader.readAsDataURL(file);
}
