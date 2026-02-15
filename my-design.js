import { sb, currentUser, cartData, PRODUCT_DB } from "./config.js?v=123";
import { canvas } from "./canvas-core.js?v=123";
import { applySize } from "./canvas-size.js?v=123";

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
        btnConfirmSave.onclick = async () => {
            await saveCurrentDesign();
            // 저장 후 목록 새로고침
            window.loadSavedDesigns && window.loadSavedDesigns();
        };
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

        const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone', 'paintFirst']);
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

// ========================================================
// [사이드바 저장 목록] 저장된 디자인 로드/표시
// ========================================================
window.loadSavedDesigns = async function() {
    const list = document.getElementById('savedDesignsList');
    if (!list) return;

    if (!currentUser) {
        list.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:16px;">Login to see saved designs</div>';
        return;
    }

    list.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    try {
        const { data, error } = await sb
            .from('user_designs')
            .select('id, title, thumb_url, product_key, width, height, created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:11px; padding:16px; font-weight:300;">No saved designs</div>';
            return;
        }

        // 헤더
        let html = '<div style="font-size:11px; font-weight:300; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Saved Designs (' + data.length + ')</div>';
        html += '<div style="display:flex; flex-direction:column; gap:6px;">';

        data.forEach(function(item) {
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
            const title = item.title || 'Untitled';
            const thumbStyle = item.thumb_url
                ? 'background-image:url(' + item.thumb_url + '); background-size:cover; background-position:center;'
                : 'background:#f1f5f9; display:flex; align-items:center; justify-content:center;';
            const thumbInner = item.thumb_url ? '' : '<i class="fa-solid fa-file" style="color:#cbd5e1; font-size:16px;"></i>';

            html += '<div style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:10px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.15s; background:#fff;" '
                + 'onmouseenter="this.style.borderColor=\'#6366f1\';this.style.background=\'#f8fafc\'" '
                + 'onmouseleave="this.style.borderColor=\'#e2e8f0\';this.style.background=\'#fff\'">'
                + '<div style="width:52px; height:52px; border-radius:8px; flex-shrink:0; overflow:hidden; border:1px solid #f1f5f9;' + thumbStyle + '">' + thumbInner + '</div>'
                + '<div style="flex:1; min-width:0;">'
                + '<div style="font-size:12px; font-weight:400; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + title + '</div>'
                + '<div style="font-size:10px; color:#94a3b8; margin-top:2px;">' + dateStr + '</div>'
                + '<div style="display:flex; gap:6px; margin-top:4px;">'
                + '<button onclick="event.stopPropagation(); window._loadSavedDesign(' + item.id + ')" style="font-size:10px; padding:2px 8px; border-radius:4px; border:1px solid #6366f1; background:#fff; color:#6366f1; cursor:pointer;">Load</button>'
                + '<button onclick="event.stopPropagation(); window._deleteSavedDesign(' + item.id + ')" style="font-size:10px; padding:2px 8px; border-radius:4px; border:1px solid #e2e8f0; background:#fff; color:#ef4444; cursor:pointer;">Delete</button>'
                + '</div></div></div>';
        });

        html += '</div>';
        list.innerHTML = html;
    } catch(e) {
        console.error('loadSavedDesigns error:', e);
        list.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:11px; padding:16px;">Error loading designs</div>';
    }
};

// [불러오기] 저장된 디자인을 캔버스에 로드
window._loadSavedDesign = async function(id) {
    if (!confirm(window.t('msg_load_design_confirm', 'Load this design? Current work will be replaced.'))) return;

    const loading = document.getElementById("loading");
    if (loading) {
        loading.style.display = "flex";
        const p = loading.querySelector('p');
        if (p) p.innerText = window.t('msg_loading', 'Loading...');
    }

    try {
        const { data, error } = await sb
            .from('user_designs')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Design not found');

        window.restoreDesignFromData(data);
    } catch(e) {
        console.error('Load design error:', e);
        alert((window.t('msg_load_failed', 'Load failed: ') ) + e.message);
        if (loading) loading.style.display = "none";
    }
};

// [삭제] 저장된 디자인 삭제
window._deleteSavedDesign = async function(id) {
    if (!confirm(window.t('msg_delete_design_confirm', 'Delete this design?'))) return;

    try {
        const { error } = await sb
            .from('user_designs')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // 목록 새로고침
        window.loadSavedDesigns();
    } catch(e) {
        console.error('Delete design error:', e);
        alert('Delete failed: ' + e.message);
    }
};

window.deleteDesign = async (id) => { window._deleteSavedDesign(id); };