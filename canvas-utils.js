import { canvas } from "./canvas-core.js?v=123";

// --- History (Undo/Redo) State ---
let undoStack = [];
let redoStack = [];
let isStateProcessing = false; // 상태 복원 중 이벤트 발생 방지
const MAX_HISTORY = 50;

// --- Clipboard State ---
let _clipboard = null;

export function initCanvasUtils() {
    if (!canvas) return;

    // 초기 상태 저장
    saveHistory();

    // 캔버스 변경 감지하여 히스토리 저장
    canvas.on('object:added', (e) => { if(!isStateProcessing && !e.target.isGuide) saveHistory(); });
    canvas.on('object:modified', (e) => { if(!isStateProcessing) saveHistory(); });
    canvas.on('object:removed', (e) => { if(!isStateProcessing && !e.target.isGuide) saveHistory(); });

    // UI 버튼 연결
    const btnUndo = document.getElementById("btnUndo");
    const btnRedo = document.getElementById("btnRedo");
    const btnCopy = document.getElementById("btnCopy");
    const btnPaste = document.getElementById("btnPaste");
    const btnLock = document.getElementById("btnLockWizard");

    if (btnUndo) btnUndo.onclick = undo;
    if (btnRedo) btnRedo.onclick = redo;
    if (btnCopy) btnCopy.onclick = copy;
    if (btnPaste) btnPaste.onclick = paste;
    if (btnLock) btnLock.onclick = toggleLockWizard;

    updateLockUI();
}

// --- History Functions ---
function saveHistory() {
    if (isStateProcessing) return;
    if (redoStack.length > 0) redoStack = []; // 새로운 동작 시 리두 초기화
    
    // 현재 상태를 JSON으로 저장 (배경 및 가이드 제외하고 싶으면 필터링 가능)
    // 여기서는 전체 상태를 심플하게 저장
    const json = JSON.stringify(canvas.toJSON(['id', 'locked', 'selectable', 'evented', 'isBoard', 'isGuide', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone', 'paintFirst']));
    
    // 중복 저장 방지 (마지막 상태와 같으면 무시)
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === json) return;

    undoStack.push(json);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

export function undo() {
    if (undoStack.length <= 1) return; // 초기 상태 유지를 위해 1개는 남김
    
    const current = undoStack.pop();
    redoStack.push(current);

    const prev = undoStack[undoStack.length - 1];
    loadState(prev);
}

export function redo() {
    if (redoStack.length === 0) return;

    const next = redoStack.pop();
    undoStack.push(next);
    loadState(next);
}

function loadState(json) {
    isStateProcessing = true;
    canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        isStateProcessing = false;
        updateLockUI(); // 상태 복원 후 UI 갱신
    });
}

// --- Clipboard Functions ---
export function copy() {
    const active = canvas.getActiveObject();
    if (!active) return;
    
    active.clone((cloned) => {
        _clipboard = cloned;
    });
}

export function paste() {
    if (!_clipboard) return;

    _clipboard.clone((cloned) => {
        canvas.discardActiveObject();
        
        cloned.set({
            left: cloned.left + 20,
            top: cloned.top + 20,
            evented: true,
        });

        if (cloned.type === 'activeSelection') {
            // 그룹 붙여넣기 시 개별 객체 처리
            cloned.canvas = canvas;
            cloned.forEachObject((obj) => {
                canvas.add(obj);
            });
            cloned.setCoords();
        } else {
            canvas.add(cloned);
        }
        
        _clipboard.top += 20;
        _clipboard.left += 20;
        
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        saveHistory();
    });
}

export function deleteActiveObject() {
    const active = canvas.getActiveObject();
    if (!active) return;

    if (active.type === 'activeSelection') {
        active.forEachObject((obj) => canvas.remove(obj));
        canvas.discardActiveObject();
    } else {
        canvas.remove(active);
    }
    canvas.requestRenderAll();
    saveHistory();
}

// --- Lock Wizard Functions ---
export function toggleLockWizard() {
    const active = canvas.getActiveObject();
    const btn = document.getElementById("btnLockWizard");
    const btnText = btn.querySelector("span");
    const btnIcon = btn.querySelector("i");

    // 1. 선택된 객체가 있으면 -> 잠금 실행
    if (active) {
        // Active Selection(다중 선택)일 경우 처리
        if (active.type === 'activeSelection') {
            active.forEachObject(o => lockObject(o));
            canvas.discardActiveObject();
        } else {
            lockObject(active);
            canvas.discardActiveObject(); // 선택 해제하여 잠금 효과 확인
        }
        canvas.requestRenderAll();
        saveHistory();
        updateLockUI();
        return;
    }

    // 2. 선택된 객체가 없는데 잠긴 객체가 있다면 -> 전체 잠금 해제
    const lockedObjects = canvas.getObjects().filter(o => o.locked);
    if (lockedObjects.length > 0) {
        const msg = window.t('confirm_unlock_all', "Unlock all objects?").replace('{count}', lockedObjects.length);
        if(confirm(msg)) {
            lockedObjects.forEach(o => unlockObject(o));
            canvas.requestRenderAll();
            saveHistory();
            updateLockUI();
        }
    } else {
        showToast(window.t('msg_select_obj_lock', "Please select an object to lock."), "info");
    }
}

function lockObject(obj) {
    if(obj.isBoard) return; // 대지는 제외
    obj.set({
        locked: true,
        selectable: false,
        evented: false, // 클릭 이벤트도 차단 (배경처럼 동작)
        hoverCursor: 'default',
        opacity: 0.8 // 시각적으로 잠긴 효과 (선택사항)
    });
}

function unlockObject(obj) {
    obj.set({
        locked: false,
        selectable: true,
        evented: true,
        hoverCursor: 'move',
        opacity: 1
    });
}

// UI 상태 업데이트 (선택 변경 시 호출됨)
export function updateLockUI() {
    const btn = document.getElementById("btnLockWizard");
    if (!btn) return;
    
    const active = canvas.getActiveObject();
    const hasLocked = canvas.getObjects().some(o => o.locked);

    if (active) {
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Lock Selection</span>';
        btn.classList.remove('active');
        btn.style.opacity = '1';
    } else {
        if (hasLocked) {
            btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> <span>Unlock All</span>';
            btn.classList.add('active'); // 스타일링 포인트
        } else {
            btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Lock Wizard</span>';
            btn.classList.remove('active');
        }
    }
}