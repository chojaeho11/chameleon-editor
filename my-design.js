import { sb, currentUser, cartData, PRODUCT_DB } from "./config.js?v=288";
import { canvas } from "./canvas-core.js?v=288";
import { applySize } from "./canvas-size.js?v=288";

// [초기화] 에디터 로드 시 버튼 연결
export function initMyDesign() {
    // 1. 상단 '보관함' 버튼 (기존 유지, 이름 변경)
    const btnLib = document.getElementById("btnMyLibrary");
    if(btnLib) {
        // [수정] innerHTML 내부는 data-i18n으로 처리되므로 놔두고, 알림 메시지만 수정
        btnLib.innerHTML = `<span data-i18n="btn_my_library">📂 MY page</span>`;
        btnLib.onclick = () => {
            if (!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }
            location.href = 'mypage.html';
        };
    }

    // ★ [추가됨] 2. 사이드바 'MY page' 버튼 연결
    const btnMyPageSide = document.getElementById("btnMyPageSide");
    if(btnMyPageSide) {
        btnMyPageSide.onclick = () => {
            if (!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }
            location.href = 'mypage.html'; 
        };
    }

    // 3. 사이드바 '저장 버튼' -> 저장 모달 열기 (미로그인 시 가입 유도)
    const btnOpenSave = document.getElementById("btnOpenSaveModal");
    if (btnOpenSave) {
        btnOpenSave.onclick = () => {
            if (!currentUser) {
                // 가입/로그인 모달 자동 표시 → 완료 후 저장 모달 열기
                if (window.openAuthModal) {
                    window.openAuthModal('signup', () => {
                        document.getElementById("saveDesignModal").style.display = "flex";
                    });
                } else {
                    showToast(window.t('msg_login_required', "Login is required to save."), "warn");
                }
                return;
            }
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
    
    if(!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }
    if(!title.trim()) { showToast(window.t('msg_enter_title', "Please enter a title."), "warn"); return; }

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
            showToast(window.t?.('design_storage_full','Storage full (max 20). Please delete designs from My Page.'), "warn");
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

        showToast(window.t('msg_design_saved') || "Design Saved!", "success");
        document.getElementById("saveDesignModal").style.display = "none";
        if(titleInput) titleInput.value = ""; 

    } catch(e) {
        console.error("Save Error:", e);
        showToast((window.t('msg_save_failed') || "Save Failed: ") + e.message, "error");
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
    try { localStorage.setItem('load_design_id', id); } catch(e) {}
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

            html += '<div style="border-radius:10px; border:1px solid #e2e8f0; overflow:hidden; cursor:pointer; transition:all 0.15s; background:#fff;" '
                + 'onmouseenter="this.style.borderColor=\'#6366f1\';this.style.boxShadow=\'0 2px 8px rgba(99,102,241,0.12)\'" '
                + 'onmouseleave="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
                + '<div style="width:100%; aspect-ratio:4/3;' + thumbStyle + '">' + thumbInner + '</div>'
                + '<div style="padding:8px 10px;">'
                + '<div style="font-size:12px; font-weight:500; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + title + '</div>'
                + '<div style="display:flex; align-items:center; justify-content:space-between; margin-top:5px;">'
                + '<span style="font-size:10px; color:#94a3b8;">' + dateStr + '</span>'
                + '<div style="display:flex; gap:5px;">'
                + '<button onclick="event.stopPropagation(); window._loadSavedDesign(' + item.id + ')" style="font-size:10px; padding:3px 10px; border-radius:6px; border:1px solid #6366f1; background:#6366f1; color:#fff; cursor:pointer; font-weight:500;">Load</button>'
                + '<button onclick="event.stopPropagation(); window._deleteSavedDesign(' + item.id + ')" style="font-size:10px; padding:3px 10px; border-radius:6px; border:1px solid #e2e8f0; background:#fff; color:#94a3b8; cursor:pointer;">Del</button>'
                + '</div></div></div></div>';
        });

        html += '</div>';
        list.innerHTML = html;
    } catch(e) {
        console.error('loadSavedDesigns error:', e);
        list.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:11px; padding:16px;">Error loading designs</div>';
    }
};

// [불러오기] 저장된 디자인 → 현재 대지에 바로 로드
window._loadSavedDesign = async function(id) {
    if (!confirm(window.t('msg_load_design_confirm', '기존 디자인은 사라집니다. 이전 디자인을 로드하시겠습니까?'))) return;

    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
        const p = loading.querySelector('p');
        if (p) p.innerText = window.t ? window.t('msg_loading', 'Loading...') : 'Loading...';
    }

    try {
        const { data, error } = await sb.from('user_designs')
            .select('*').eq('id', id).single();
        if (error || !data) throw error || new Error('Design not found');

        const jsonData = typeof data.json_data === 'string' ? JSON.parse(data.json_data) : data.json_data;
        const nonBoardObjects = (jsonData.objects || []).filter(o => !o.isBoard);

        // 원본 보드 정보 (저장 시점의 대지 크기/위치)
        const savedBoard = (jsonData.objects || []).find(o => o.isBoard);
        const origW = savedBoard ? (savedBoard.width * (savedBoard.scaleX || 1)) : (data.width || canvas.width);
        const origH = savedBoard ? (savedBoard.height * (savedBoard.scaleY || 1)) : (data.height || canvas.height);
        const origCX = savedBoard ? (savedBoard.left + origW / 2) : (canvas.width / 2);
        const origCY = savedBoard ? (savedBoard.top + origH / 2) : (canvas.height / 2);

        // 현재 보드 정보
        const board = canvas.getObjects().find(o => o.isBoard);
        const curW = board ? board.getScaledWidth() : canvas.width;
        const curH = board ? board.getScaledHeight() : canvas.height;
        const curCX = board ? (board.left + curW / 2) : (canvas.width / 2);
        const curCY = board ? (board.top + curH / 2) : (canvas.height / 2);

        // 스케일 팩터: 110% 꽉 채우기 (cover)
        const scaleFactor = Math.max(curW / origW, curH / origH) * 1.1;

        // 현재 캔버스에서 보드 제외 모든 객체 삭제
        const toRemove = canvas.getObjects().filter(o => !o.isBoard);
        toRemove.forEach(o => canvas.remove(o));

        // 저장된 디자인 객체를 현재 대지에 스케일 맞춰 로드
        fabric.util.enlivenObjects(nonBoardObjects, function(objs) {
            objs.forEach(function(obj) {
                if (obj.isMockup || obj.excludeFromExport) return;
                // 원본 보드 중심 기준 상대좌표 → 스케일 → 현재 보드 중심으로 배치
                const relX = obj.left - origCX;
                const relY = obj.top - origCY;
                obj.set({
                    left: curCX + relX * scaleFactor,
                    top: curCY + relY * scaleFactor,
                    scaleX: (obj.scaleX || 1) * scaleFactor,
                    scaleY: (obj.scaleY || 1) * scaleFactor
                });
                obj.setCoords();
                canvas.add(obj);
            });
            canvas.requestRenderAll();
            if (loading) loading.style.display = 'none';
            console.log('✅ 저장된 디자인 로드 완료:', objs.length + '개 객체, 스케일:', scaleFactor.toFixed(2));
        });
    } catch(e) {
        console.error('Load design error:', e);
        showToast(window.t?.('design_load_failed','Failed to load design: ') + e.message, "error");
        if (loading) loading.style.display = 'none';
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
        showToast('Delete failed: ' + e.message, "error");
    }
};

window.deleteDesign = async (id) => { window._deleteSavedDesign(id); };