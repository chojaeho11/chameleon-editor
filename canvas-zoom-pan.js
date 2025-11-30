import { canvas } from "./canvas-core.js";

// 전역 상태 변수 (window 객체에 할당하여 다른 곳에서도 접근 가능하게 함)
window.isPanningMode = false;

export function initZoomPan() {
    // 1. 줌 인/아웃 버튼 로직
    const btnZoomIn = document.getElementById("btnZoomIn");
    const btnZoomOut = document.getElementById("btnZoomOut");
    const btnFit = document.getElementById("btnFitScreen");

    if (btnZoomIn) {
        btnZoomIn.onclick = () => {
            let zoom = canvas.getZoom();
            zoom *= 1.1;
            if (zoom > 20) zoom = 20;
            canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
        };
    }

    if (btnZoomOut) {
        btnZoomOut.onclick = () => {
            let zoom = canvas.getZoom();
            zoom *= 0.9;
            if (zoom < 0.01) zoom = 0.01;
            canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
        };
    }

    // 2. 화면 꽉 채우기 (Fit)
    if(btnFit) {
        btnFit.onclick = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            if (!board) return;

            const canvasW = canvas.width;
            const canvasH = canvas.height;
            const padding = 50; // 여백

            const boardW = board.width * board.scaleX;
            const boardH = board.height * board.scaleY;

            const availW = canvasW - (padding * 2);
            const availH = canvasH - (padding * 2);

            const zoom = Math.min(availW / boardW, availH / boardH);
            
            // 줌 적용
            canvas.setZoom(zoom);

            // 화면 중앙으로 이동 (Panning)
            const vpt = canvas.viewportTransform;
            vpt[4] = (canvasW - boardW * zoom) / 2;
            vpt[5] = (canvasH - boardH * zoom) / 2;
            
            canvas.requestRenderAll();
        };
    }

    // 3. 마우스 휠 줌
    canvas.on('mouse:wheel', function(opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // =========================================================
    // ★ [수정됨] 스페이스바 패닝 (Panning) 구현부
    // =========================================================
    let isDragging = false;
    let lastPosX;
    let lastPosY;

    // (1) 스페이스바 누름 감지
    window.addEventListener('keydown', (e) => {
        // 텍스트 입력 중이면 무시
        const activeObj = canvas.getActiveObject();
        const isEditing = activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox') && activeObj.isEditing;
        
        if (e.code === 'Space' && !isEditing) {
            if (!window.isPanningMode) {
                window.isPanningMode = true;
                canvas.defaultCursor = 'grab'; // 커서 모양 변경
                canvas.selection = false;      // 드래그 선택 비활성화
                canvas.requestRenderAll();
            }
            // 스크롤 등 기본 동작 방지
            e.preventDefault(); 
        }
    });

    // (2) 스페이스바 뗌 감지
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            window.isPanningMode = false;
            canvas.defaultCursor = 'default';
            canvas.selection = true; // 드래그 선택 다시 활성화
            canvas.requestRenderAll();
        }
    });

    // (3) 마우스 다운
    canvas.on('mouse:down', function(opt) {
        const evt = opt.e;
        // Alt키 혹은 스페이스바 모드일 때
        if (evt.altKey || window.isPanningMode) { 
            isDragging = true;
            canvas.selection = false;
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
            canvas.defaultCursor = 'grabbing'; // 잡은 모양
        }
    });

    // (4) 마우스 이동
    canvas.on('mouse:move', function(opt) {
        if (isDragging) {
            const e = opt.e;
            const vpt = canvas.viewportTransform;
            vpt[4] += e.clientX - lastPosX;
            vpt[5] += e.clientY - lastPosY;
            canvas.requestRenderAll();
            lastPosX = e.clientX;
            lastPosY = e.clientY;
        }
    });

    // (5) 마우스 업
    canvas.on('mouse:up', function(opt) {
        if(isDragging) {
            canvas.setViewportTransform(canvas.viewportTransform);
            isDragging = false;
            
            // 패닝 모드가 유지 중이면 grab, 아니면 default
            canvas.defaultCursor = window.isPanningMode ? 'grab' : 'default';
            
            // 패닝 모드가 아닐 때만 선택 활성화
            if (!window.isPanningMode) {
                canvas.selection = true;
            }
        }
    });
}