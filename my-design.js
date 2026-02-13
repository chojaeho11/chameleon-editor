import { sb, currentUser, cartData, PRODUCT_DB } from "./config.js?v=121";
import { canvas } from "./canvas-core.js?v=121";
import { applySize } from "./canvas-size.js?v=121";

// [초기화] 에디터 로드 시 버튼 연결
export function initMyDesign() {
    // 1. 상단 '보관함' 버튼 (기존 유지, 이름 변경)
    const btnLib = document.getElementById("btnMyLibrary");
    if(btnLib) {
        // [수정] innerHTML 내부는 data-i18n으로 처리되므로 놔두고, 알림 메시지만 수정
        btnLib.innerHTML = `<span data-i18n="btn_my_library">📂 MY page</span>`;
        btnLib.onclick = () => {
            if (!currentUser) return alert(window.t('msg_login_required', "Login is required."));
            location.href = 'mypage.html'; 
        };
    }

    // ★ [추가됨] 2. 사이드바 'MY page' 버튼 연결
    const btnMyPageSide = document.getElementById("btnMyPageSide");
    if(btnMyPageSide) {
        btnMyPageSide.onclick = () => {
            if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
            location.href = 'mypage.html'; 
        };
    }

    // 3. 사이드바 '저장 버튼' -> 저장 모달 열기
    const btnOpenSave = document.getElementById("btnOpenSaveModal");
    if (btnOpenSave) {
        btnOpenSave.onclick = () => {
            if (!currentUser) return alert(window.t('msg_login_required', "Login is required to save."));
            document.getElementById("saveDesignModal").style.display = "flex";
        };
    }

    // 4. 모달 내부 '저장하기' 버튼
    const btnConfirmSave = document.getElementById("btnConfirmSave");
    if(btnConfirmSave) {
        btnConfirmSave.onclick = saveCurrentDesign;
    }
}

// [핵심 기능 1] 디자인 저장하기
async function saveCurrentDesign() {
    const titleInput = document.getElementById("saveDesignTitle");
    const title = titleInput ? titleInput.value : "";
    
    if(!currentUser) return alert(window.t('msg_login_required', "Login is required."));
    if(!title.trim()) return alert(window.t('msg_enter_title', "Please enter a title."));

    const btn = document.getElementById("btnConfirmSave");
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_saving') || "Saving...";
    try {
        const { count, error: countError } = await sb
            .from('user_designs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (countError) throw countError;
        if (count >= 20) { 
            alert("보관함이 가득 찼습니다 (최대 20개).\n마이페이지에서 기존 디자인을 삭제해주세요.");
            btn.innerText = originalText;
            return;
        }

        const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth']);
        const thumb = window.getCleanThumbnail ? window.getCleanThumbnail() : canvas.toDataURL({ format: 'png', multiplier: 0.5, quality: 0.8 });
        
        const board = canvas.getObjects().find(o => o.isBoard);
        const saveW = board ? (board.width * board.scaleX) : canvas.width;
        const saveH = board ? (board.height * board.scaleY) : canvas.height;
        
        const prodKey = window.currentProductKey || canvas.currentProductKey || 'A4';

        const { error } = await sb.from('user_designs').insert([{
            user_id: currentUser.id,
            title: title,
            product_key: prodKey, 
            json_data: json,
            thumb_url: thumb,
            width: saveW,
            height: saveH
        }]);

        if(error) throw error;

        alert(window.t('msg_design_saved') || "✅ Design Saved!");
        document.getElementById("saveDesignModal").style.display = "none";
        if(titleInput) titleInput.value = ""; 

    } catch(e) {
        console.error("Save Error:", e);
        alert((window.t('msg_save_failed') || "Save Failed: ") + e.message);
    } finally {
        btn.innerText = originalText;
    }
}

// [핵심 기능 2] 디자인 복구하기
window.restoreDesignFromData = (data) => {
    if(!data) return;

    const savedKey = data.product_key || 'A4';
    window.currentProductKey = savedKey;
    
    if (window.PRODUCT_DB && window.PRODUCT_DB[savedKey]) {
        window.selectedProductForChoice = window.PRODUCT_DB[savedKey];
        const limitLabel = document.getElementById("limitLabel");
        if(limitLabel) limitLabel.innerText = `Max: ${window.selectedProductForChoice.w}x${window.selectedProductForChoice.h}`;
    }

    const targetW = data.width || 210;
    const targetH = data.height || 297;
    
    applySize(targetW, targetH, savedKey, 'standard', 'replace');

    const jsonData = typeof data.json_data === 'string' ? JSON.parse(data.json_data) : data.json_data;

    canvas.loadFromJSON(jsonData, () => {
        const objects = canvas.getObjects();
        const board = objects.find(o => o.isBoard);
        
        if (board) {
            board.set({
                selectable: false, evented: false, hasControls: false, hasBorders: false,
                lockMovementX: true, lockMovementY: true, hoverCursor: 'default'
            });
            canvas.sendToBack(board);
        }
        
        canvas.requestRenderAll();
        
        const loading = document.getElementById("loading");
        if(loading) loading.style.display = 'none';
        
        console.log("디자인 복구 완료");
    });
};

window.loadDesignToCanvas = (id) => {
    console.log("Old loader called, redirecting...");
    localStorage.setItem('load_design_id', id);
    location.reload();
};

window.addDesignToCart = (id) => { };
window.deleteDesign = async (id) => { };