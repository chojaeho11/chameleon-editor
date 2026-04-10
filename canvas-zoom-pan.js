import { canvas } from "./canvas-core.js?v=291";

// 전역 상태 변수 (window 객체에 할당하여 다른 곳에서도 접근 가능하게 함)
window.isPanningMode = false;

export function initZoomPan() {
    const canvas = window.canvas; if (!canvas) { console.warn('ZoomPan: canvas not ready'); return; }
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

    // 2. 화면 꽉 채우기 (Fit) - 모바일은 상단 정렬, 도구바 영역 제외
    if(btnFit) {
        btnFit.onclick = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            if (!board) return;

            const canvasW = canvas.width;
            const canvasH = canvas.height;
            const _isMobile = window.innerWidth <= 768;

            // 모바일: 하단 도구바(컨트롤바+iconBar) 영역 제외, 상단 여백 최소
            const _topReserve = _isMobile ? 8 : 0;
            const _bottomReserve = _isMobile ? 110 : 0;
            const padding = _isMobile ? 24 : 50;

            const boardW = board.width * board.scaleX;
            const boardH = board.height * board.scaleY;

            const visibleH = canvasH - _topReserve - _bottomReserve;
            const availW = canvasW - (padding * 2);
            const availH = visibleH - padding;

            const zoom = Math.min(availW / boardW, availH / boardH);

            canvas.setZoom(zoom);

            const vpt = canvas.viewportTransform;
            vpt[4] = (canvasW - boardW * zoom) / 2;
            // 모바일: 상단 정렬 (가운데 X), PC: 가운데
            vpt[5] = _isMobile ? _topReserve : (canvasH - boardH * zoom) / 2;

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

    // =========================================================
    // ★ 모바일 핀치 줌 & 2손가락 패닝 (의도 감지: 데드존)
    // =========================================================
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        let pinchActive = false;
        let initialDist = 0;        // 처음 두 손가락 거리 (의도 판단용)
        let initialMidX = 0;
        let initialMidY = 0;
        let lastDist = 0;
        let lastMidX = 0;
        let lastMidY = 0;
        let lastZoom = 1;
        let zoomIntent = false;     // 줌 의도 감지 플래그
        let panIntent = false;      // 팬 의도 감지 플래그

        function getTouchDist(t1, t2) {
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function getTouchMid(t1, t2) {
            return {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            };
        }

        const upperEl = canvas.upperCanvasEl || canvas.getElement();

        upperEl.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                pinchActive = true;
                zoomIntent = false;
                panIntent = false;
                canvas.selection = false;
                canvas.discardActiveObject();
                canvas.requestRenderAll();

                initialDist = lastDist = getTouchDist(e.touches[0], e.touches[1]);
                const mid = getTouchMid(e.touches[0], e.touches[1]);
                initialMidX = lastMidX = mid.x;
                initialMidY = lastMidY = mid.y;
                lastZoom = canvas.getZoom();

                e.preventDefault();
            }
        }, { passive: false });

        upperEl.addEventListener('touchmove', function(e) {
            if (!pinchActive || e.touches.length !== 2) return;
            e.preventDefault();

            const dist = getTouchDist(e.touches[0], e.touches[1]);
            const mid = getTouchMid(e.touches[0], e.touches[1]);

            // ★ 의도 감지: 처음 시작점으로부터 거리/중심점 변화량 비교
            const distDelta = Math.abs(dist - initialDist);
            const midDelta = Math.sqrt(
                Math.pow(mid.x - initialMidX, 2) + Math.pow(mid.y - initialMidY, 2)
            );

            // 데드존 임계값 (픽셀) — 줌은 매우 큰 변화일 때만, 팬은 적당한 이동 시
            const ZOOM_DEADZONE = 60;   // 60px 이상 손가락 거리 변화해야 줌
            const PAN_DEADZONE = 8;     // 8px 이상 중심점 이동하면 팬

            if (!zoomIntent && !panIntent) {
                // 팬을 우선 (작은 이동에도 반응) → 부드러운 사용감
                if (midDelta > PAN_DEADZONE) {
                    panIntent = true;
                } else if (distDelta > ZOOM_DEADZONE) {
                    zoomIntent = true;
                } else {
                    // 아직 임계값 미달 → 아무것도 안 함 (대지 안 흔들림)
                    return;
                }
            }

            // 팬 (2손가락 이동)
            const vpt = canvas.viewportTransform;
            vpt[4] += mid.x - lastMidX;
            vpt[5] += mid.y - lastMidY;

            // 줌 (의도가 줌일 때만)
            if (zoomIntent) {
                const scale = dist / lastDist;
                let newZoom = canvas.getZoom() * scale;
                if (newZoom > 20) newZoom = 20;
                if (newZoom < 0.05) newZoom = 0.05;

                const rect = upperEl.getBoundingClientRect();
                const cx = mid.x - rect.left;
                const cy = mid.y - rect.top;
                canvas.zoomToPoint({ x: cx, y: cy }, newZoom);
            }

            canvas.requestRenderAll();
            lastDist = dist;
            lastMidX = mid.x;
            lastMidY = mid.y;
        }, { passive: false });

        upperEl.addEventListener('touchend', function(e) {
            if (pinchActive && e.touches.length < 2) {
                pinchActive = false;
                zoomIntent = false;
                panIntent = false;
                canvas.selection = true;
                canvas.setViewportTransform(canvas.viewportTransform);
            }
        });
    }
}