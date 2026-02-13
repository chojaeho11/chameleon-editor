import { canvas } from "./canvas-core.js?v=122";
// canvas-utils.js에 구현된(혹은 구현될) 기능들을 가져옵니다.
import { undo, redo, copy, paste, deleteActiveObject, toggleLockWizard } from "./canvas-utils.js?v=122";

export function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 1. 입력창(input, textarea)에 포커스가 있을 땐 단축키 무시 (타이핑 방해 금지)
        const tag = e.target.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        // 키 설정
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey; // Windows는 Ctrl, Mac은 Cmd
        const shift = e.shiftKey;

        // 2. Delete / Backspace : 객체 삭제
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const active = canvas.getActiveObject();
            // 텍스트 편집 중이 아닐 때만 삭제 실행
            if (active && !active.isEditing) {
                e.preventDefault();
                deleteActiveObject(); 
            }
            return;
        }

        // 3. Ctrl + Z : 실행 취소 (Undo)
        if (ctrl && !shift && key === 'z') {
            e.preventDefault();
            undo();
            return;
        }

        // 4. Ctrl + Shift + Z  또는 Ctrl + Y : 다시 실행 (Redo)
        if ((ctrl && shift && key === 'z') || (ctrl && key === 'y')) {
            e.preventDefault();
            redo();
            return;
        }

        // 5. Ctrl + C : 복사 (Copy)
        if (ctrl && key === 'c') {
            e.preventDefault();
            copy();
            return;
        }

        // 6. Ctrl + V : 붙여넣기 (Paste)
        if (ctrl && key === 'v') {
            e.preventDefault();
            paste();
            return;
        }

        // 7. Ctrl + G : 그룹화 (Group)
        if (ctrl && !shift && key === 'g') {
            e.preventDefault();
            groupObjects();
            return;
        }

        // 8. Ctrl + Shift + G : 그룹 해제 (Ungroup)
        if (ctrl && shift && key === 'g') {
            e.preventDefault();
            ungroupObjects();
            return;
        }

        // 9. Ctrl + L : 잠금 마법사 토글 (Lock Wizard)
        if (ctrl && key === 'l') {
            e.preventDefault();
            toggleLockWizard();
            return;
        }

        // 10. 방향키 이동 (선택된 객체 미세 조정)
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            const active = canvas.getActiveObject();
            if (active && !active.isEditing) {
                e.preventDefault();
                const step = shift ? 10 : 1; // Shift 누르면 10px, 아니면 1px 이동
                
                switch (key) {
                    case 'arrowleft': active.set('left', active.left - step); break;
                    case 'arrowright': active.set('left', active.left + step); break;
                    case 'arrowup': active.set('top', active.top - step); break;
                    case 'arrowdown': active.set('top', active.top + step); break;
                }
                active.setCoords();
                canvas.requestRenderAll();
            }
        }
    });

    console.log("⌨️ 단축키 설정 완료 (Undo/Redo, Copy/Paste, Group, Lock, Del, Arrows)");
}

// --- 내부 헬퍼 함수 ---

// 그룹화 기능
function groupObjects() {
    const active = canvas.getActiveObject();
    // 여러 개가 선택된 상태(ActiveSelection)일 때만 그룹화 가능
    if (!active || active.type !== 'activeSelection') return;
    
    active.toGroup();
    canvas.requestRenderAll();
    
    // (선택 사항) 그룹화 동작 후 히스토리 저장을 위해 이벤트를 발생시키거나 saveHistory() 호출
    canvas.fire('object:modified'); 
}

// 그룹 해제 기능
function ungroupObjects() {
    const active = canvas.getActiveObject();
    // 그룹(Group)일 때만 해제 가능
    if (!active || active.type !== 'group') return;
    
    active.toActiveSelection();
    canvas.requestRenderAll();
    
    canvas.fire('object:modified');
}