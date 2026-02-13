// context-menu.js
import { canvas } from "./canvas-core.js?v=122";

// 클립보드 저장 변수
let _clipboard = null;

export function initContextMenu() {
    const menu = document.getElementById("contextMenu");
    
    // 메뉴 요소가 없거나 캔버스가 준비되지 않았으면 중단
    if (!menu || !canvas) return;

    // ★ 핵심: Fabric.js가 이벤트를 받는 실제 레이어(upper-canvas) 찾기
    // canvas.upperCanvasEl이 가장 확실하지만, 혹시 없을 경우를 대비해 querySelector 사용
    const canvasEl = canvas.upperCanvasEl || document.querySelector('.upper-canvas');

    if (!canvasEl) {
        console.warn("캔버스 상호작용 레이어를 찾을 수 없습니다.");
        return;
    }

    // 1. 우클릭 이벤트 리스너 등록
    canvasEl.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // 브라우저 기본 우클릭 메뉴 차단 (매우 중요)

        // 클릭한 위치에 있는 객체 찾기
        const target = canvas.findTarget(e, false);

        if (target) {
            // 객체 위에서 클릭했다면 그 객체 선택
            canvas.setActiveObject(target);
        } else {
            // 빈 공간 클릭하면 선택 해제
            canvas.discardActiveObject();
        }
        
        canvas.requestRenderAll();

        // 메뉴 표시 함수 호출
        const activeObj = canvas.getActiveObject();
        showMenu(e.clientX, e.clientY, activeObj);
    });

    // 2. 메뉴 닫기 이벤트 (클릭, 스크롤, 휠, 좌클릭 시 닫힘)
    const hideMenu = () => { menu.style.display = 'none'; };
    
    window.addEventListener('click', hideMenu);
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu);
    
    if (canvas) {
        canvas.on('mouse:wheel', hideMenu);
        canvas.on('mouse:down', (opt) => {
            // 캔버스 내부에서 좌클릭(button: 0)하면 메뉴 닫기
            if (opt.e.button === 0) hideMenu();
        });
    }

    // 3. 메뉴 아이템 기능 연결
    // (각 버튼이 존재하는지 확인 후 이벤트 연결)
    
    bindAction("ctxUndo", () => document.getElementById("btnUndo")?.click());
    bindAction("ctxRedo", () => document.getElementById("btnRedo")?.click());

    bindAction("ctxCopy", () => {
        const active = canvas.getActiveObject();
        if (active) {
            active.clone((cloned) => { _clipboard = cloned; });
        }
    });

    bindAction("ctxPaste", () => {
        // [수정] 다국어 적용 (이미 적용되어 있다면 유지)
        if (!_clipboard) return alert(window.t('msg_clipboard_empty', "Clipboard is empty."));
        _clipboard.clone((cloned) => {
            canvas.discardActiveObject();
            cloned.set({
                left: cloned.left + 20,
                top: cloned.top + 20,
                evented: true,
            });
            if (cloned.type === 'activeSelection') {
                cloned.canvas = canvas;
                cloned.forEachObject(o => canvas.add(o));
                cloned.setCoords();
            } else {
                canvas.add(cloned);
            }
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
        });
    });

    bindAction("ctxDelete", () => {
        const active = canvas.getActiveObject();
        if (!active) return;
        
        if (active.type === 'activeSelection') {
            active.getObjects().forEach(obj => canvas.remove(obj));
            canvas.discardActiveObject();
        } else {
            canvas.remove(active);
        }
        canvas.requestRenderAll();
    });

    bindAction("ctxFront", () => {
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.bringToFront(active);
        // 가이드선이 있다면 가이드선은 항상 최상단 유지
        canvas.getObjects().filter(o => o.isGuide).forEach(g => canvas.bringToFront(g));
        canvas.requestRenderAll();
    });

    bindAction("ctxBack", () => {
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.sendToBack(active);
        // 대지(Board)가 있다면 대지는 항상 맨 뒤로 유지
        const board = canvas.getObjects().find(o => o.isBoard);
        if (board) canvas.sendToBack(board);
        canvas.requestRenderAll();
    });

    bindAction("ctxLock", () => {
        if (window.toggleLockSelection) window.toggleLockSelection();
    });
}

// 메뉴 위치 잡기 및 UI 갱신
function showMenu(x, y, activeObj) {
    const menu = document.getElementById("contextMenu");
    menu.style.display = 'block';

    // 화면 밖으로 나가지 않도록 위치 조정
    let menuX = x;
    let menuY = y;
    const w = menu.offsetWidth || 180;
    const h = menu.offsetHeight || 200;

    if (x + w > window.innerWidth) menuX = window.innerWidth - w - 10;
    if (y + h > window.innerHeight) menuY = window.innerHeight - h - 10;

    menu.style.left = `${menuX}px`;
    menu.style.top = `${menuY}px`;

    // 객체 선택 여부에 따라 메뉴 활성/비활성 처리
    const btnLock = document.getElementById("ctxLock");
    const activeGroup = [
        document.getElementById("ctxCopy"),
        document.getElementById("ctxDelete"),
        document.getElementById("ctxFront"),
        document.getElementById("ctxBack")
    ];

    if (activeObj) {
        // 객체 선택됨: 편집 메뉴 보이기
        activeGroup.forEach(el => { if(el) el.style.display = 'flex'; });
        
        if (btnLock) {
            btnLock.style.display = 'flex';
            if (activeObj.lockMovementX) {
                // [수정] 기본값 fallback 추가
                btnLock.innerHTML = `<i class="fa-solid fa-lock-open"></i> ${window.t('ctx_unlock', "Unlock")}`;
            } else {
                btnLock.innerHTML = `<i class="fa-solid fa-lock"></i> ${window.t('ctx_lock', "Lock")}`;
            }
        }
    } else {
        // 빈 공간: 편집 메뉴 숨기기
        activeGroup.forEach(el => { if(el) el.style.display = 'none'; });
        
        // 잠긴 객체가 있으면 '전체 해제' 메뉴 표시
        const hasLocked = canvas.getObjects().some(o => o.lockMovementX);
        if (btnLock) {
            if (hasLocked) {
                // [수정] 기본값 fallback 추가
                btnLock.innerHTML = `<i class="fa-solid fa-lock-open"></i> ${window.t('ctx_unlock_all', "Unlock All")}`;
                btnLock.style.display = 'flex';
            } else {
                btnLock.style.display = 'none';
            }
        }
    }
}

// 버튼 클릭 이벤트 헬퍼
function bindAction(id, callback) {
    const el = document.getElementById(id);
    if (el) {
        // 기존 이벤트 제거 (중복 방지) 후 새로 등록
        el.onclick = (e) => {
            e.stopPropagation(); // 클릭 이벤트 전파 방지
            callback();
            document.getElementById("contextMenu").style.display = 'none';
        };
    }
}