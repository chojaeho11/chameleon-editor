import { sb } from "./global_config.js?v=294";
import { showLoading, formatCurrency } from "./global_common.js?v=294";

// i18n helper (admin UI — falls back to Korean for admin context)
const _t = (k, kr) => (window.t ? window.t(k, kr) : kr);

// 한글/특수문자 파일명 → Storage 안전 ASCII 키로 변환
function _safeStoragePath(prefix, file) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = (file.name.replace(/\.[^.]+$/, '') || 'file').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'img';
    return `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${base}.${ext}`;
}
window._safeStoragePath = _safeStoragePath;

// 홈페이지 카테고리/제품 캐시 무효화 (관리자 저장 후 즉시 반영)
function _clearHomeCategoryCache() {
    try {
        const targets = ['cache:top_cats','cache:subcats','cache:all_prods_lite'];
        targets.forEach(k => localStorage.removeItem(k));
        console.log('[admin] home category cache cleared');
    } catch(e) {}
}
window._clearHomeCategoryCache = _clearHomeCategoryCache;

// [전역 변수]
let editingTopCatId = null;
let editingCategoryId = null;
let editingProdId = null;
let editingAddonId = null;
let lastFetchedCategory = null;
let allProducts = [];

// 🛑 [신규] 디바운스 함수 (서버 폭주 방지용)
// 연속된 입력/호출이 있을 경우 마지막 호출만 실행합니다.
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

// ==========================================
// 0. 작품 마켓플레이스 장르 카테고리 자동 정리 (관리자 권한으로 실행)
// ==========================================
const _UA_GENRE_CATS = [
    { code: 'ua_game', name: '게임 영화', name_us: 'Game Movie', name_jp: 'ゲーム映画', name_cn: '游戏电影', name_ar: 'ألعاب أفلام', name_es: 'Juegos Películas', name_de: 'Spiele Filme', name_fr: 'Jeux Films', top_category_code: 'user_artwork', sort_order: 1 },
    { code: 'ua_anime', name: '애니메이션', name_us: 'Animation', name_jp: 'アニメ', name_cn: '动漫', name_ar: 'أنمي', name_es: 'Animación', name_de: 'Animation', name_fr: 'Animation', top_category_code: 'user_artwork', sort_order: 2 },
    { code: 'ua_landscape', name: '풍경', name_us: 'Landscape', name_jp: '風景', name_cn: '风景', name_ar: 'مناظر طبيعية', name_es: 'Paisaje', name_de: 'Landschaft', name_fr: 'Paysage', top_category_code: 'user_artwork', sort_order: 3 },
    { code: 'ua_interior', name: '인테리어', name_us: 'Interior', name_jp: 'インテリア', name_cn: '室内', name_ar: 'ديكور', name_es: 'Interior', name_de: 'Interieur', name_fr: 'Intérieur', top_category_code: 'user_artwork', sort_order: 4 },
    { code: 'ua_fengshui', name: '풍수그림', name_us: 'Feng Shui Art', name_jp: '風水画', name_cn: '风水画', name_ar: 'فنغ شوي', name_es: 'Feng Shui', name_de: 'Feng Shui', name_fr: 'Feng Shui', top_category_code: 'user_artwork', sort_order: 5 },
    { code: 'ua_personal', name: '개인작품', name_us: 'Personal Art', name_jp: '個人作品', name_cn: '个人作品', name_ar: 'أعمال شخصية', name_es: 'Arte Personal', name_de: 'Persönliche Kunst', name_fr: 'Art Personnel', top_category_code: 'user_artwork', sort_order: 6 }
];
const _OLD_UA_CODES = ['ua_paper', 'ua_fabric', 'ua_canvas'];

// 관리자 인증 후 실행 (3초 대기)
setTimeout(async () => {
    if (!sb) return;
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { console.log('[소분류] 미인증 — 건너뜀'); return; }

        // 0. 대분류(user_artwork) 확인/생성
        const { data: topEx } = await sb.from('admin_top_categories').select('code').eq('code', 'user_artwork');
        if (!topEx || topEx.length === 0) {
            const { error: topErr } = await sb.from('admin_top_categories').insert({
                code: 'user_artwork', name: '고객작품판매', name_us: 'Artwork Shop', name_jp: '作品販売',
                name_cn: '作品商店', name_ar: 'متجر الأعمال', name_es: 'Tienda de Arte', name_de: 'Kunstshop', name_fr: 'Boutique Art',
                icon: 'fa-solid fa-paintbrush', sort_order: 50
            });
            if (topErr) { console.warn('대분류 생성 실패:', topErr.message); return; }
        }

        // 1. 예전 제품타입 카테고리 삭제
        for (const code of _OLD_UA_CODES) {
            await sb.from('admin_categories').delete().eq('code', code);
        }
        // 2. 장르 카테고리 upsert
        for (const cat of _UA_GENRE_CATS) {
            const { data: ex } = await sb.from('admin_categories').select('code').eq('code', cat.code);
            if (!ex || ex.length === 0) {
                const { error: insErr } = await sb.from('admin_categories').insert(cat);
                if (insErr) console.warn(`[소분류] ${cat.code} 삽입 실패:`, insErr.message);
            } else {
                await sb.from('admin_categories').update({ name: cat.name, name_us: cat.name_us, name_jp: cat.name_jp, name_cn: cat.name_cn, name_ar: cat.name_ar, name_es: cat.name_es, name_de: cat.name_de, name_fr: cat.name_fr, sort_order: cat.sort_order }).eq('code', cat.code);
            }
        }
        console.log('✅ 작품 마켓플레이스 장르 카테고리 동기화 완료');
    } catch(e) { console.warn('작품 카테고리 동기화:', e); }
}, 3000);

// ==========================================
// 1. 대분류 관리 (Top Categories)
// ==========================================
window.loadTopCategoriesList = async () => {
    const listArea = document.getElementById('topCategoryListArea');
    if(!listArea) return;
    listArea.innerHTML = '';

    const { data, error } = await sb.from('admin_top_categories').select('*').order('sort_order', {ascending: true});
    
    if (error) {
        console.error("대분류 로딩 실패:", error);
        return;
    }

    const newCatTop = document.getElementById('newCatTop');
    const filterSelect = document.getElementById('filterCategoryTop');
    
    // Select 박스 초기화 및 기본값 설정
    if(newCatTop) newCatTop.innerHTML = '<option value="">(상위 없음)</option>';
    if(filterSelect) filterSelect.innerHTML = '<option value="all">📂 전체 대분류 보기</option>';

    data?.forEach(t => {
        const div = document.createElement('div');
        div.className = 'badge draggable';
        div.dataset.id = t.id;
        div.style.cssText = "border:1px solid #fdba74; color:#c2410c; background:#fff7ed; padding:6px 10px; cursor:grab; display:flex; align-items:center; gap:5px;";
        div.innerHTML = `
            <b>${t.name}</b> <small>(${t.code})</small>
            <i class="fa-solid fa-pen" onclick="editTopCategoryLoad(${t.id})" style="cursor:pointer; color:#aaa; margin-left:3px;" title="수정"></i>
            <i class="fa-solid fa-language" onclick="bulkTranslateDetailsByTopCat('${t.code}','${t.name}')" style="cursor:pointer; color:#6366f1; margin-left:3px;" title="이 대분류 상세페이지 일괄번역"></i>
            <i class="fa-solid fa-xmark" onclick="deleteTopCategoryDB(${t.id})" style="cursor:pointer; color:red; margin-left:3px;" title="삭제"></i>
        `;
        listArea.appendChild(div);

        if(newCatTop) newCatTop.innerHTML += `<option value="${t.code}">${t.name}</option>`;
        if(filterSelect) filterSelect.innerHTML += `<option value="${t.code}">${t.name}</option>`;
    });

    new Sortable(listArea, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => updateOrder('admin_top_categories', listArea)
    });
    
    // [중요] 대분류 로딩 후 소분류도 갱신 시도 (순서 보장)
    if(window.loadCategories) window.loadCategories();
};

window.editTopCategoryLoad = async (id) => {
    const { data } = await sb.from('admin_top_categories').select('*').eq('id', id).single();
    if(!data) return;

    editingTopCatId = id;
    document.getElementById('newTopCatCode').value = data.code;
    document.getElementById('newTopCatName').value = data.name;
    document.getElementById('newTopCatNameJP').value = data.name_jp || '';
    document.getElementById('newTopCatNameUS').value = data.name_us || '';
    document.getElementById('newTopCatNameCN').value = data.name_cn || '';
    document.getElementById('newTopCatNameAR').value = data.name_ar || '';
    document.getElementById('newTopCatNameES').value = data.name_es || '';
    const chk = document.getElementById('newTopCatExcluded');
    if(chk) chk.checked = data.is_excluded || false;
    
    if(document.getElementById('newTopCatDesc')) document.getElementById('newTopCatDesc').value = data.description || '';
    if(document.getElementById('newTopCatDescJP')) document.getElementById('newTopCatDescJP').value = data.description_jp || '';
    if(document.getElementById('newTopCatDescUS')) document.getElementById('newTopCatDescUS').value = data.description_us || '';

    const btn = document.getElementById('btnTopCatSave');
    btn.innerText = _t('btn_edit','Edit');
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-vip');
};

window.addTopCategoryDB = async () => {
    const code = document.getElementById('newTopCatCode').value;
    const name = document.getElementById('newTopCatName').value;
    if(!code || !name) { showToast(_t("gp_code_name_required","Code and name are required."), "warn"); return; }

    const isExcluded = document.getElementById('newTopCatExcluded') ? document.getElementById('newTopCatExcluded').checked : false;

    const payload = {
        code, name,
        is_excluded: isExcluded,
        name_jp: document.getElementById('newTopCatNameJP').value,
        name_us: document.getElementById('newTopCatNameUS').value,
        name_cn: document.getElementById('newTopCatNameCN').value,
        name_ar: document.getElementById('newTopCatNameAR').value,
        name_es: document.getElementById('newTopCatNameES').value,
        name_de: document.getElementById('newTopCatNameDE') ? document.getElementById('newTopCatNameDE').value : '',
        name_fr: document.getElementById('newTopCatNameFR') ? document.getElementById('newTopCatNameFR').value : '',
        description: document.getElementById('newTopCatDesc') ? document.getElementById('newTopCatDesc').value : '',
        description_jp: document.getElementById('newTopCatDescJP') ? document.getElementById('newTopCatDescJP').value : '',
        description_us: document.getElementById('newTopCatDescUS') ? document.getElementById('newTopCatDescUS').value : ''
    };

    let error;
    if (editingTopCatId) {
        const res = await sb.from('admin_top_categories').update(payload).eq('id', editingTopCatId);
        error = res.error;
    } else {
        const res = await sb.from('admin_top_categories').insert([payload]);
        error = res.error;
    }

    if(error) showToast(_t('err_prefix','Error: ') + error.message, "error");
    else {
        _clearHomeCategoryCache();
        showToast(editingTopCatId ? _t('msg_updated','Updated.') : _t('msg_saved','Saved.'), "success");
        resetTopCategoryForm();
    }
};

window.resetTopCategoryForm = () => {
    editingTopCatId = null;
    document.getElementById('newTopCatCode').value = '';
    document.getElementById('newTopCatName').value = '';
    document.getElementById('newTopCatNameJP').value = '';
    document.getElementById('newTopCatNameUS').value = '';
    ['newTopCatNameCN','newTopCatNameAR','newTopCatNameES'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    if(document.getElementById('newTopCatDesc')) document.getElementById('newTopCatDesc').value = '';
    if(document.getElementById('newTopCatDescJP')) document.getElementById('newTopCatDescJP').value = '';
    if(document.getElementById('newTopCatDescUS')) document.getElementById('newTopCatDescUS').value = '';
    if(document.getElementById('newTopCatExcluded')) document.getElementById('newTopCatExcluded').checked = false;
    
    const btn = document.getElementById('btnTopCatSave');
    btn.innerText = "저장";
    btn.classList.remove('btn-vip');
    btn.classList.add('btn-primary');
    
    loadTopCategoriesList();
};

window.deleteTopCategoryDB = async (id) => {
    if(confirm("삭제하시겠습니까?")) {
        await sb.from('admin_top_categories').delete().eq('id', id);
        loadTopCategoriesList();
    }
};

// ==========================================
// 2. 소분류 관리 (Sub Categories)
// ==========================================
window.loadCategories = async () => {
    const listArea = document.getElementById('categoryListArea');
    const filterEl = document.getElementById('filterCategoryTop');
    
    if(!listArea || !filterEl) return;
    
    const filterTopVal = filterEl.value;
    
    const prodCatSelect = document.getElementById('newProdCategory');
    const filterProdCat = document.getElementById('filterProdCat');

    // [수정] 대분류가 로딩되지 않았거나 선택되지 않았으면 중단 (서버 에러 방지)
    if(!filterTopVal || filterTopVal === 'all') {
        listArea.innerHTML = '<div style="width:100%; text-align:center; padding:40px; color:#94a3b8; font-size:14px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">왼쪽 상단에서 [대분류]를 선택하시면 해당 소분류 목록이 나타납니다.</div>';
        return;
    }

    listArea.innerHTML = '<div style="padding:20px;">로딩 중...</div>';
    
    // 상품 등록용 셀렉트 박스 초기화 (누적 방지)
    if(prodCatSelect) prodCatSelect.innerHTML = '<option value="">카테고리 선택</option>';
    if(filterProdCat) filterProdCat.innerHTML = '<option value="all">📂 전체</option>';

    // 데이터 조회 (선택된 대분류 코드 기반)
    let q = sb.from('admin_categories').select('*').order('sort_order', {ascending: true});
    q = q.eq('top_category_code', filterTopVal);

    const { data, error } = await q;

    if (error) {
        console.error("소분류 로드 에러:", error);
        listArea.innerHTML = '<div style="color:red; padding:20px;">로드 실패 (관리자 문의)</div>';
        return;
    }

    listArea.innerHTML = '';
    
    if(!data || data.length === 0) {
        listArea.innerHTML = '<div style="padding:20px; color:#94a3b8;">등록된 소분류가 없습니다.</div>';
    }

    data?.forEach(c => {
        const div = document.createElement('div');
        div.className = 'badge draggable';
        div.dataset.id = c.id;
        div.style.cssText = "background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; padding:6px 10px; cursor:grab; display:flex; align-items:center; gap:5px;";
        div.innerHTML = `
            ${c.name} <small>(${c.code})</small> 
            <i class="fa-solid fa-pen" onclick="editCategoryLoad(${c.id})" style="cursor:pointer; color:#aaa; margin-left:3px;" title="수정"></i>
            <i class="fa-solid fa-xmark" onclick="deleteCategoryDB(${c.id})" style="cursor:pointer; color:red; margin-left:3px;" title="삭제"></i>
        `;
        listArea.appendChild(div);

        if(prodCatSelect) prodCatSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
        if(filterProdCat) filterProdCat.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });

    new Sortable(listArea, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => updateOrder('admin_categories', listArea)
    });
};

window.editCategoryLoad = async (id) => {
    const { data } = await sb.from('admin_categories').select('*').eq('id', id).single();
    if(!data) return;

    editingCategoryId = id;

    document.getElementById('newCatTop').value = data.top_category_code || '';
    document.getElementById('newCatCode').value = data.code;
    document.getElementById('newCatName').value = data.name;
    document.getElementById('newCatNameJP').value = data.name_jp || '';
    document.getElementById('newCatNameUS').value = data.name_us || '';
    if(document.getElementById('newCatNameCN')) document.getElementById('newCatNameCN').value = data.name_cn || '';
    if(document.getElementById('newCatNameAR')) document.getElementById('newCatNameAR').value = data.name_ar || '';
    if(document.getElementById('newCatNameES')) document.getElementById('newCatNameES').value = data.name_es || '';

    if(document.getElementById('newCatDesc')) document.getElementById('newCatDesc').value = data.description || '';
    if(document.getElementById('newCatDescJP')) document.getElementById('newCatDescJP').value = data.description_jp || '';
    if(document.getElementById('newCatDescUS')) document.getElementById('newCatDescUS').value = data.description_us || '';
    if(document.getElementById('newCatDescCN')) document.getElementById('newCatDescCN').value = data.description_cn || '';
    if(document.getElementById('newCatDescAR')) document.getElementById('newCatDescAR').value = data.description_ar || '';
    if(document.getElementById('newCatDescES')) document.getElementById('newCatDescES').value = data.description_es || '';

    const btn = document.getElementById('btnCatSave');
    btn.innerText = _t('btn_edit','Edit');
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-vip');
};

window.addCategoryDB = async () => {
    const code = document.getElementById('newCatCode').value;
    const name = document.getElementById('newCatName').value;
    if(!code || !name) { showToast(_t('err_required_fields','Required fields missing'), "warn"); return; }

    const payload = {
        code, name,
        top_category_code: document.getElementById('newCatTop').value || null,
        name_jp: document.getElementById('newCatNameJP').value,
        name_us: document.getElementById('newCatNameUS').value,
        name_cn: document.getElementById('newCatNameCN') ? document.getElementById('newCatNameCN').value : '',
        name_ar: document.getElementById('newCatNameAR') ? document.getElementById('newCatNameAR').value : '',
        name_es: document.getElementById('newCatNameES') ? document.getElementById('newCatNameES').value : '',
        description: document.getElementById('newCatDesc') ? document.getElementById('newCatDesc').value : '',
        description_jp: document.getElementById('newCatDescJP') ? document.getElementById('newCatDescJP').value : '',
        description_us: document.getElementById('newCatDescUS') ? document.getElementById('newCatDescUS').value : '',
        description_cn: document.getElementById('newCatDescCN') ? document.getElementById('newCatDescCN').value : '',
        description_ar: document.getElementById('newCatDescAR') ? document.getElementById('newCatDescAR').value : '',
        description_es: document.getElementById('newCatDescES') ? document.getElementById('newCatDescES').value : '',
        name_de: document.getElementById('newCatNameDE') ? document.getElementById('newCatNameDE').value : '',
        name_fr: document.getElementById('newCatNameFR') ? document.getElementById('newCatNameFR').value : '',
        description_de: document.getElementById('newCatDescDE') ? document.getElementById('newCatDescDE').value : '',
        description_fr: document.getElementById('newCatDescFR') ? document.getElementById('newCatDescFR').value : ''
    };

    let error;
    if (editingCategoryId) {
        const res = await sb.from('admin_categories').update(payload).eq('id', editingCategoryId);
        error = res.error;
    } else {
        const res = await sb.from('admin_categories').insert([payload]);
        error = res.error;
    }

    if(error) showToast(_t('err_prefix','Error: ') + error.message, "error");
    else {
        _clearHomeCategoryCache();
        showToast(editingCategoryId ? _t('msg_updated','Updated.') : _t('msg_saved','Saved.'), "success");
        resetCategoryForm();
    }
};

window.resetCategoryForm = () => {
    editingCategoryId = null;
    document.getElementById('newCatCode').value = '';
    document.getElementById('newCatName').value = '';
    document.getElementById('newCatNameJP').value = '';
    document.getElementById('newCatNameUS').value = '';
    ['newCatNameCN','newCatNameAR','newCatNameES','newCatDescCN','newCatDescAR','newCatDescES'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    if(document.getElementById('newCatDesc')) document.getElementById('newCatDesc').value = '';
    if(document.getElementById('newCatDescJP')) document.getElementById('newCatDescJP').value = '';
    if(document.getElementById('newCatDescUS')) document.getElementById('newCatDescUS').value = '';

    const btn = document.getElementById('btnCatSave');
    btn.innerText = "저장";
    btn.classList.remove('btn-vip');
    btn.classList.add('btn-primary');

    loadCategories();
};

window.deleteCategoryDB = async (id) => {
    if(confirm("삭제하시겠습니까?")) {
        await sb.from('admin_categories').delete().eq('id', id);
        loadCategories();
    }
};

async function updateOrder(table, container) {
    // [수정] .badge 클래스뿐만 아니라 data-id를 가진 직계 자식 요소를 모두 찾습니다.
    const items = Array.from(container.children).filter(el => el.dataset.id);
    
    // 순서대로 sort_order 업데이트
    const updates = items.map((el, idx) => {
        return sb.from(table).update({ sort_order: idx + 1 }).eq('id', el.dataset.id);
    });

    try {
        await Promise.all(updates);
    } catch (e) {
        console.error("순서 저장 실패:", e);
    }
}
// ==========================================
// 3. 옵션 및 카테고리 관리
// ==========================================
window.loadAddonCategories = async () => {
    try {
        const [catRes, addonRes] = await Promise.all([
            sb.from('addon_categories').select('*').order('sort_order', {ascending: true}),
            sb.from('admin_addons').select('*').order('sort_order', {ascending: true}) // 순서대로 정렬
        ]);

        if (catRes.error) throw catRes.error;
        window.cachedAddonCategories = catRes.data || [];
        window.cachedAddons = addonRes.data || [];

        // 1. Select 박스 갱신
        ['newAddonCatCode', 'filterAddonCategory'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const oldVal = el.value;
                el.innerHTML = (id === 'filterAddonCategory') ? '<option value="all">📁 카테고리 전체</option>' : '';
                window.cachedAddonCategories.forEach(c => {
                    el.innerHTML += `<option value="${c.code}">${c.name_kr || c.name}</option>`;
                });
                if(oldVal) el.value = oldVal;
            }
        });

        // 2. [신규] 카테고리 순서변경 영역 렌더링
        const catListArea = document.getElementById('addonCategoryListArea');
        if (catListArea) {
            catListArea.innerHTML = '';
            window.cachedAddonCategories.forEach(c => {
                const div = document.createElement('div');
                div.className = 'badge draggable-item'; // 식별용 클래스
                div.dataset.id = c.id;
                div.style.cssText = "background:#fff; border:1px solid #cbd5e1; color:#334155; padding:6px 12px; cursor:grab; display:flex; align-items:center; gap:6px; user-select:none;";
                div.innerHTML = `
                    <i class="fa-solid fa-bars" style="color:#94a3b8; font-size:11px;"></i>
                    <b>${c.name_kr || c.name}</b> <small style="color:#94a3b8;">(${c.code})</small>
                    <i class="fa-solid fa-pen" onclick="editCurrentAddonCategory('${c.code}')" style="cursor:pointer; color:#6366f1; margin-left:5px;" title="수정"></i>
                `;
                catListArea.appendChild(div);
            });

            // Sortable 연결
            if (catListArea.sortable) catListArea.sortable.destroy();
            catListArea.sortable = new Sortable(catListArea, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: () => updateOrder('addon_categories', catListArea)
            });
        }

        const container = document.getElementById('dynamicCategoryContainer');
        if (container && container.children.length === 0) {
            addCategorySelectRow(); 
        }
        
        loadSystemDB();
    } catch (err) {
        console.error("데이터 로딩 오류:", err);
    }
};

window.previewAddonImage = async (input) => {
    if(!input.files[0]) return;
    const file = input.files[0];
    
    showLoading(true);
    try {
        const path = _safeStoragePath('addons', file);
        const { error } = await sb.storage.from('products').upload(path, file);
        if (error) throw error;

        const { data } = sb.storage.from('products').getPublicUrl(path);
        
        const imgInput = document.getElementById('newAddonImgUrl');
        if (imgInput) {
            imgInput.value = data.publicUrl;
            showToast(_t('msg_image_uploaded','Image uploaded!'), "success");
        }
    } catch(e) { 
        console.error("이미지 업로드 오류:", e);
        showToast(_t('err_upload_failed','Upload failed: ') + e.message, "error");
    } finally {
        showLoading(false);
    }
};

window.addCategorySelectRow = () => {
    const container = document.getElementById('dynamicCategoryContainer');
    if (!container) return;

    const rowId = 'row_' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.id = rowId;
    wrapper.style.cssText = "background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:10px;";

    let optionsHtml = `<option value="">📦 카테고리 선택</option>`;
    (window.cachedAddonCategories || []).forEach(c => {
        optionsHtml += `<option value="${c.code}">${c.name_kr || c.name}</option>`;
    });

    wrapper.innerHTML = `
        <div style="display:flex; gap:5px; align-items:center; margin-bottom:8px;">
            <select class="input-text dynamic-cat-select" style="font-size:11px; font-weight:bold; flex:1;" onchange="renderAddonsInRow('${rowId}', this.value)">
                ${optionsHtml}
            </select>
            <button type="button" class="btn btn-outline btn-sm" onclick="removeCategorySelectRow('${rowId}')" style="color:#ef4444; border:none; background:transparent;">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </div>
        <div class="row-addon-area" style="display:flex; flex-wrap:wrap; gap:5px; min-height:20px;">
            <span style="font-size:11px; color:#94a3b8; padding:5px;">카테고리를 선택해 주세요.</span>
        </div>`;
    container.appendChild(wrapper);
};

window.renderAddonsInRow = (rowId, categoryCode) => {
    const rowEl = document.getElementById(rowId);
    if(!rowEl) return;
    const area = rowEl.querySelector('.row-addon-area');
    area.innerHTML = '';
    if (!categoryCode) return;

    const filtered = (window.cachedAddons || []).filter(a => a.category_code === categoryCode)
        .sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
    if (filtered.length === 0) {
        area.innerHTML = '<span style="font-size:11px; color:#94a3b8; padding:5px;">옵션이 없습니다.</span>';
        return;
    }

    filtered.forEach(addon => {
        area.innerHTML += `
            <label style="display:flex; align-items:center; gap:5px; padding:5px 8px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; cursor:pointer;">
                <input type="checkbox" name="prodAddon" value="${addon.code}">
                <span>${addon.name_kr || addon.name}</span>
            </label>`;
    });
};

window.removeCategorySelectRow = (rowId) => document.getElementById(rowId)?.remove();

// [수정] 옵션 검색에 디바운스 적용
window.loadSystemDB = debounce(async (filterSite) => {
    if (!filterSite) filterSite = document.getElementById('newAddonSite')?.value || 'KR';
    const listArea = document.getElementById('addonListArea');
    const searchKeyword = document.getElementById('addonSearchInput')?.value.toLowerCase().trim() || '';
    const catFilter = document.getElementById('filterAddonCategory')?.value || 'all';

    if(!listArea) return;
    listArea.innerHTML = '';

    const filtered = (window.cachedAddons || []).filter(item => {
        const dName = (item.name_kr || item.name || "").toLowerCase();
        const matchCat = (catFilter === 'all' || item.category_code === catFilter);
        const matchKey = !searchKeyword || dName.includes(searchKeyword) || item.code.toLowerCase().includes(searchKeyword);
        return matchCat && matchKey;
    });

    if(filtered.length === 0) {
        listArea.innerHTML = '<div style="width:100%; text-align:center; padding:20px; color:#999;">표시할 옵션이 없습니다.</div>';
        return;
    }

    filtered.forEach(item => {
        const dPrice = (filterSite === 'JP') ? (item.price_jp || 0) : (filterSite === 'US' ? (item.price_us || 0) : (item.price_kr || item.price || 0));
        const symbol = (filterSite === 'JP') ? '¥' : (filterSite === 'US' ? '$' : '₩');

        const div = document.createElement('div');
        div.className = 'draggable-item'; // 식별용
        div.dataset.id = item.id;
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:10px; display:flex; gap:10px; align-items:center; position:relative;";
        
        div.innerHTML = `
            <div class="drag-handle" style="cursor:grab; padding:5px; color:#cbd5e1; display:${searchKeyword ? 'none' : 'block'};">
                <i class="fa-solid fa-bars"></i>
            </div>
            <img src="${item.img_url || 'https://placehold.co/80'}" loading="lazy" style="width:50px; height:50px; border-radius:6px; object-fit:cover;">
            <div style="flex:1;">
                <div style="font-size:10px; color:#6366f1; font-weight:800;">
                    ${item.category_code || '미분류'}
                    ${item.is_swatch ? '<span style="background:#fecaca; color:#dc2626; padding:1px 4px; border-radius:4px; margin-left:5px;">🎨Swatch</span>' : ''}
                </div>
                <div style="font-size:13px; font-weight:bold;">${item.name_kr || item.name}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <i class="fa-solid fa-pen" onclick="editAddonLoad(${item.id})" style="cursor:pointer; color:#94a3b8; font-size:14px; padding:5px;"></i>
                <i class="fa-solid fa-trash" onclick="deleteAddonDB(${item.id})" style="cursor:pointer; color:#ef4444; font-size:14px; padding:5px;"></i>
            </div>`;
        listArea.appendChild(div);
    });

    // 검색어가 없을 때만 정렬 기능 활성화
    if (!searchKeyword) {
        if (listArea.sortable) listArea.sortable.destroy();
        listArea.sortable = new Sortable(listArea, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: () => updateOrder('admin_addons', listArea)
        });
    }
}, 300);

window.editAddonLoad = (id) => {
    const item = window.cachedAddons.find(a => a.id === id);
    if(!item) return;

    editingAddonId = id;
    document.getElementById('newAddonCatCode').value = item.category_code || '';
    document.getElementById('newAddonCode').value = item.code;
    document.getElementById('newAddonImgUrl').value = item.img_url || '';
    document.getElementById('nmKR').value = item.name_kr || item.name || '';
    document.getElementById('prKR').value = item.price_kr || item.price || 0;
    document.getElementById('nmJP').value = item.name_jp || '';
    document.getElementById('prJP').value = item.price_jp || 0;
    document.getElementById('nmUS').value = item.name_us || '';
    document.getElementById('prUS').value = item.price_us || 0;
    document.getElementById('nmCN').value = item.name_cn || '';
    document.getElementById('prCN').value = item.price_cn || 0;
    document.getElementById('nmAR').value = item.name_ar || '';
    document.getElementById('prAR').value = item.price_ar || 0;
    document.getElementById('nmES').value = item.name_es || '';
    document.getElementById('prES').value = item.price_es || 0;
    if (document.getElementById('nmDE')) document.getElementById('nmDE').value = item.name_de || '';
    if (document.getElementById('nmFR')) document.getElementById('nmFR').value = item.name_fr || '';

    // ▼▼▼ [누락된 코드 추가] 저장된 스와치 모드 상태를 불러와 체크박스에 반영 ▼▼▼
    const swatchEl = document.getElementById('newAddonIsSwatch');
    if(swatchEl) {
        swatchEl.checked = item.is_swatch || false; 
    }
    // ▲▲▲ 추가 끝 ▲▲▲

    const btn = document.querySelector('button[onclick="addAddonDB()"]');
    if(btn) btn.innerText = "옵션 수정저장";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteAddonDB = async (id) => {
    if(!confirm("정말로 삭제하시겠습니까?")) return;
    showLoading(true);
    try {
        const { error } = await sb.from('admin_addons').delete().eq('id', id);
        if (error) throw error;
        showToast(_t('msg_deleted','Deleted.'), "success");
        loadAddonCategories();
    } catch (err) { showToast(_t('err_delete_failed','Delete failed: ') + err.message, "error"); } finally { showLoading(false); }
};

window.addAddonDB = async () => {
    const code = document.getElementById('newAddonCode').value;
    if(!code) { showToast(_t('err_code_required','Please enter a code.'), "warn"); return; }

    const isSwatchEl = document.getElementById('newAddonIsSwatch');
    const isSwatch = isSwatchEl ? isSwatchEl.checked : false;

    const payload = {
        category_code: document.getElementById('newAddonCatCode').value,
        code: code,
        img_url: document.getElementById('newAddonImgUrl').value,
        is_swatch: isSwatch,
        name_kr: document.getElementById('nmKR').value,
        price_kr: Math.round(parseFloat(document.getElementById('prKR').value || 0)),
        name_jp: document.getElementById('nmJP').value,
        price_jp: Math.round(parseFloat(document.getElementById('prJP').value || 0)),
        name_us: document.getElementById('nmUS').value,
        price_us: Math.round(parseFloat(document.getElementById('prUS').value || 0)),
        name_cn: document.getElementById('nmCN').value,
        name_ar: document.getElementById('nmAR').value,
        name_es: document.getElementById('nmES').value,
        name_de: document.getElementById('nmDE') ? document.getElementById('nmDE').value : '',
        name_fr: document.getElementById('nmFR') ? document.getElementById('nmFR').value : '',
        name: document.getElementById('nmKR').value,
        price: Math.round(parseFloat(document.getElementById('prKR').value || 0))
    };

    showLoading(true);
    try {
        let error;
        if(editingAddonId) error = (await sb.from('admin_addons').update(payload).eq('id', editingAddonId)).error;
        else error = (await sb.from('admin_addons').insert([payload])).error;

        if(error) throw error;
        showToast(_t('msg_saved','Saved.'), "success");
        resetAddonForm();
        loadAddonCategories();
    } catch (err) { showToast(_t('err_save_failed','Save failed: ') + err.message, "error"); } finally { showLoading(false); }
};

window.resetAddonForm = () => {
    editingAddonId = null;
    ['newAddonCode', 'newAddonImgUrl', 'nmKR', 'prKR', 'nmJP', 'prJP', 'nmUS', 'prUS', 'nmCN', 'prCN', 'nmAR', 'prAR', 'nmES', 'prES', 'nmDE', 'nmFR'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = '';
    });
    
    // ▼▼▼ [누락된 코드 추가] 초기화 시 체크박스도 해제 ▼▼▼
    const swatchEl = document.getElementById('newAddonIsSwatch');
    if(swatchEl) swatchEl.checked = false;
    // ▲▲▲ 추가 끝 ▲▲▲

    const btn = document.querySelector('button[onclick="addAddonDB()"]');
    if(btn) btn.innerText = "옵션 저장";
};

window.openAddonCatManager = async () => {
    document.getElementById('modalCatCode').value = "opt_" + Date.now().toString().slice(-4);
    document.getElementById('modalCatNameKR').value = "";
    document.getElementById('modalCatNameJP').value = "";
    document.getElementById('modalCatNameUS').value = "";
    document.getElementById('modalCatNameCN').value = "";
    document.getElementById('modalCatNameAR').value = "";
    document.getElementById('modalCatNameES').value = "";
    document.getElementById('modalCatNameDE').value = "";
    document.getElementById('modalCatNameFR').value = "";
    document.getElementById('addonCatModal').style.display = 'flex';
    document.getElementById('modalCatNameKR').focus();
    document.getElementById('modalCatCode').disabled = false;
};

window.autoTranslateAddonCatModal = async () => {
    const krName = document.getElementById('modalCatNameKR').value;
    if(!krName) { showToast(_t('err_kr_name_required','Please enter a Korean name first.'), "warn"); return; }

    const btn = document.querySelector('button[onclick="autoTranslateAddonCatModal()"]');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리중';
    btn.disabled = true;

    try {
        const jp = await googleTranslate(krName, 'ja');
        const en = await googleTranslate(krName, 'en');
        document.getElementById('modalCatNameJP').value = jp;
        document.getElementById('modalCatNameUS').value = en;
        document.getElementById('modalCatNameCN').value = await googleTranslate(en, 'zh-CN');
        document.getElementById('modalCatNameAR').value = await googleTranslate(en, 'ar');
        document.getElementById('modalCatNameES').value = await googleTranslate(en, 'es');
        document.getElementById('modalCatNameDE').value = await googleTranslate(en, 'de');
        document.getElementById('modalCatNameFR').value = await googleTranslate(en, 'fr');
    } catch(e) {
        showToast(_t('err_translation_failed','Translation error: ') + e.message, "error");
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
};

window.saveAddonCategoryFromModal = async () => {
    const code = document.getElementById('modalCatCode').value.trim();
    const nameKR = document.getElementById('modalCatNameKR').value.trim();
    const nameJP = document.getElementById('modalCatNameJP').value.trim();
    const nameUS = document.getElementById('modalCatNameUS').value.trim();

    if(!code || !nameKR) { showToast(_t('err_code_kr_required','Code and Korean name are required.'), "warn"); return; }

    showLoading(true);
    try {
        const { data: existing } = await sb.from('addon_categories').select('id').eq('code', code).single();
        const payload = {
            code: code,
            name_kr: nameKR,
            name_jp: nameJP,
            name_us: nameUS,
            name_cn: document.getElementById('modalCatNameCN').value.trim(),
            name_ar: document.getElementById('modalCatNameAR').value.trim(),
            name_es: document.getElementById('modalCatNameES').value.trim(),
            name_de: document.getElementById('modalCatNameDE').value.trim(),
            name_fr: document.getElementById('modalCatNameFR').value.trim(),
            sort_order: 99
        };
        let error;
        if(existing) {
            const { error: upErr } = await sb.from('addon_categories').update(payload).eq('code', code);
            error = upErr;
        } else {
            const { error: inErr } = await sb.from('addon_categories').insert([payload]);
            error = inErr;
        }
        if(error) throw error;
        showToast(_t('msg_category_saved','Category saved.'), "success");
        document.getElementById('addonCatModal').style.display = 'none';
        loadAddonCategories();
    } catch(e) {
        showToast(_t('err_save_failed','Save failed: ') + e.message, "error");
    } finally {
        showLoading(false);
    }
};

window.editCurrentAddonCategory = async () => {
    const select = document.getElementById('newAddonCatCode');
    const selectedCode = select.value;
    if (!selectedCode) { showToast(_t('err_select_category','Please select a category to edit.'), "warn"); return; }
    const catData = window.cachedAddonCategories.find(c => c.code === selectedCode);
    if (!catData) { showToast(_t('err_not_found','Information not found.'), "warn"); return; }
    document.getElementById('modalCatCode').value = catData.code;
    document.getElementById('modalCatCode').disabled = true;
    document.getElementById('modalCatNameKR').value = catData.name_kr || catData.name || "";
    document.getElementById('modalCatNameJP').value = catData.name_jp || "";
    document.getElementById('modalCatNameUS').value = catData.name_us || "";
    document.getElementById('modalCatNameCN').value = catData.name_cn || "";
    document.getElementById('modalCatNameAR').value = catData.name_ar || "";
    document.getElementById('modalCatNameES').value = catData.name_es || "";
    document.getElementById('modalCatNameDE').value = catData.name_de || "";
    document.getElementById('modalCatNameFR').value = catData.name_fr || "";
    document.getElementById('addonCatModal').style.display = 'flex';
};

loadAddonCategories();

// [수정] 서버 폭주 방지: 디바운스 + 로딩 중복 방지(Lock) 적용
window.filterProductList = debounce(async () => {
    // [안전장치] DB 연결이 없으면 즉시 중단 (콘솔 에러 방지)
    if (!sb) { console.warn("DB 미연결"); return; }
    
    // [안전장치] 이미 로딩 중이면 중복 요청 차단
    if (window.isProductLoading) return; 
    window.isProductLoading = true; // 깃발 올림

    const cat = document.getElementById('filterProdCat')?.value || 'all'; // 요소가 없을 경우 대비
    const siteFilter = document.getElementById('filterProdSite')?.value || 'all';
    const keywordInput = document.getElementById('prodSearchInput');
    const keyword = keywordInput ? keywordInput.value.toLowerCase().trim() : '';
    const tbody = document.getElementById('prodTableBody');
    
    showLoading(true);

    try {
        let query = sb.from('admin_products').select('id, site_code, code, name, name_jp, name_us, price, price_jp, price_us, width_mm, height_mm, img_url, sort_order, category, is_hot_deal, is_biz_deal, is_popular, is_print_service, is_goods, is_paper_display, partner_id, partner_status');

        if(cat && cat !== 'all') {
            query = query.eq('category', cat);
        }
        
        // 데이터 조회 및 정렬
        const { data, error } = await query.order('sort_order', {ascending: true});
        
        if(error) throw error;

        allProducts = data || [];
        lastFetchedCategory = cat;

        const filteredList = allProducts.filter(p => {
            const matchSite = (siteFilter === 'all' || p.site_code === siteFilter);
            const matchKeyword = !keyword || `${p.name} ${p.code} ${p.name_us||''} ${p.name_jp||''}`.toLowerCase().includes(keyword);
            return matchSite && matchKeyword;
        });

        renderProductList(filteredList);

        // 드래그 앤 드롭 재설정
        if(tbody && !keyword && siteFilter === 'all') {
            if (tbody.sortable) tbody.sortable.destroy();
            tbody.sortable = new Sortable(tbody, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: () => updateProductSortOrder()
            });
        }
    } catch (err) {
        console.error("상품 로드 실패:", err);
    } finally {
        showLoading(false);
        window.isProductLoading = false; // 깃발 내림
    }
}, 500);

window.renderProductList = (products) => {
    const tbody = document.getElementById('prodTableBody');
    const filterSite = document.getElementById('filterProdSite').value;
    tbody.innerHTML = '';
    
    if(!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">상품 없음</td></tr>';
        return;
    }

    products.forEach(p => {
        let name = p.name;
        let price = p.price;
        if(filterSite === 'JP') { name = p.name_jp || p.name; price = p.price_jp || 0; }
        else if(filterSite === 'US') { name = p.name_us || p.name; price = p.price_us || 0; }
        
        const displayPrice = formatCurrency(price, filterSite === 'all' ? 'KR' : filterSite);

        tbody.innerHTML += `
            <tr data-id="${p.id}">
                <td>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-bars drag-handle" style="cursor:grab; color:#cbd5e1;" title="순서변경"></i>
                        <span class="badge-site ${(p.site_code||'KR').toLowerCase()}">${p.site_code||'KR'}</span>
                    </div>
                </td>
                <td><img src="${p.img_url}" loading="lazy" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"></td>
                <td><small style="color:#6366f1">${p.code}</small><br><b>${name}</b></td>
                <td>${p.width_mm}x${p.height_mm}</td>
                <td style="font-weight:bold;">${displayPrice}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editProductLoad(${p.id})">수정</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProductDB(${p.id})">삭제</button>
                </td>
            </tr>`;
    });
}

// [핵심 수정] 순서 변경 시 서버 부하 방지 (전체 동시 요청 -> 순차 처리)
window.updateProductSortOrder = async () => {
    const rows = document.querySelectorAll('#prodTableBody tr');
    if(rows.length === 0) return;

    // 사용자에게 작업 중임을 알림
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';
    
    // [안전장치] 변경된 항목만 찾으면 좋지만, sort_order는 전체가 밀리므로
    // Promise.all 대신 for loop로 순차 처리하여 429 에러 방지 (속도는 느려짐)
    // 혹은 5개씩 끊어서 보냄. 여기서는 일단 기존 로직 유지하되 에러 캐치 추가
    
    const updates = [];
    rows.forEach((row, index) => {
        const id = row.getAttribute('data-id');
        if(id) {
            updates.push(sb.from('admin_products').update({ sort_order: index + 1 }).eq('id', id));
        }
    });

    try {
        await Promise.all(updates);
    } catch (e) {
        console.error("순서 저장 중 오류 (너무 빠른 요청):", e);
        // 사용자에게 조용히 넘어감 (UX 방해 X)
    } finally {
        document.body.style.cursor = prevCursor;
    }
};

// ============================================================
// 칼선/목업 파일 업로드 핸들러
// ============================================================
window.previewCutlineFile = async function(input) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const code = document.getElementById('newProdCode').value || 'temp';
    const ext = file.name.split('.').pop();
    const path = `cutlines/${code}_${Date.now()}.${ext}`;
    document.getElementById('cutlineStatus').innerText = '업로드 중...';
    try {
        const { error } = await sb.storage.from('products').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = sb.storage.from('products').getPublicUrl(path);
        document.getElementById('newProdCutlineUrl').value = data.publicUrl;
        document.getElementById('cutlineStatus').innerText = '✅ ' + file.name;
        document.getElementById('btnCutlineClear').style.display = 'inline-flex';
    } catch(e) {
        document.getElementById('cutlineStatus').innerText = '❌ 업로드 실패';
        console.error(e);
    }
};
window.clearCutline = function() {
    document.getElementById('newProdCutlineUrl').value = '';
    document.getElementById('cutlineStatus').innerText = '';
    document.getElementById('btnCutlineClear').style.display = 'none';
    document.getElementById('newProdCutlineFile').value = '';
};
window.previewMockupFile = async function(input) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const code = document.getElementById('newProdCode').value || 'temp';
    const ext = file.name.split('.').pop();
    const path = `mockups/${code}_${Date.now()}.${ext}`;
    const preview = document.getElementById('mockupPreview');
    try {
        const { error } = await sb.storage.from('products').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = sb.storage.from('products').getPublicUrl(path);
        document.getElementById('newProdMockupUrl').value = data.publicUrl;
        preview.src = data.publicUrl;
        preview.style.display = 'block';
        document.getElementById('btnMockupClear').style.display = 'inline-flex';
    } catch(e) {
        console.error('목업 업로드 실패:', e);
        showToast(_t('err_mockup_upload_failed','Mockup upload failed: ') + e.message, "error");
    }
};
window.clearMockup = function() {
    document.getElementById('newProdMockupUrl').value = '';
    document.getElementById('mockupPreview').style.display = 'none';
    document.getElementById('btnMockupClear').style.display = 'none';
    document.getElementById('newProdMockupFile').value = '';
};

// [수정] 상품 저장
window.addProductDB = async () => {
    const site = document.getElementById('newProdSite').value;
    const cat = document.getElementById('newProdCategory').value;
    const code = document.getElementById('newProdCode').value;
    
    // 1. 입력값 가져오기
    let imgUrl = document.getElementById('newProdImg').value; // let으로 선언 (수정 가능하게)

    if(!cat || !code) { showToast(_t('err_cat_code_required','Category and code are required.'), "warn"); return; }

    // 2. [핵심] 이미지가 Base64(긴 문자열)인지 확인 후 자동 업로드 처리
    if (imgUrl && imgUrl.startsWith('data:image')) {
        const btn = document.getElementById('btnProductSave');
        const oldText = btn.innerText;
        btn.innerText = "이미지 변환 업로드 중...";
        btn.disabled = true;

        try {
            // (1) Base64 -> 파일(Blob) 변환
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            
            // (2) 파일명 생성 (코드_시간.jpg)
            // GIF인 경우 확장자를 gif로 유지하기 위해 type 확인
            const mimeType = blob.type; 
            let ext = 'jpg';
            if (mimeType.includes('gif')) ext = 'gif';
            else if (mimeType.includes('png')) ext = 'png';
            else if (mimeType.includes('webp')) ext = 'webp';

            const fileName = `products/${code}_${Date.now()}.${ext}`;

            // (3) 수파베이스 업로드
            const { error: uploadError } = await sb.storage.from('products').upload(fileName, blob);
            if (uploadError) throw uploadError;

            // (4) URL 주소 가져오기
            const { data: urlData } = sb.storage.from('products').getPublicUrl(fileName);
            imgUrl = urlData.publicUrl; // 긴 문자열을 짧은 URL로 교체!
            

        } catch (err) {
            console.error("이미지 변환 실패:", err);
            btn.innerText = oldText;
            btn.disabled = false;
            showToast(_t('err_auto_upload_failed','Auto upload failed. File may be too large or network issue.\n(Please use the file select button.)'), "error"); return;
        }
        
        btn.innerText = oldText;
        btn.disabled = false;
    }

    const addons = Array.from(document.querySelectorAll('input[name="prodAddon"]:checked')).map(cb => cb.value).join(',');
    const isCustom = document.getElementById('newProdIsCustom').checked;
    const isGeneral = document.getElementById('newProdIsGeneral').checked;
    const isHotDeal = document.getElementById('newProdIsHotDeal').checked;
    const isBizDeal = document.getElementById('newProdIsBizDeal').checked;
    const isPopular = document.getElementById('newProdIsPopular') ? document.getElementById('newProdIsPopular').checked : false;
    const isPrintService = document.getElementById('newProdIsPrintService') ? document.getElementById('newProdIsPrintService').checked : false;
    const isGoods = document.getElementById('newProdIsGoods') ? document.getElementById('newProdIsGoods').checked : false;
    const isPaperDisplay = document.getElementById('newProdIsPaperDisplay') ? document.getElementById('newProdIsPaperDisplay').checked : false;
    const isFileUpload = document.getElementById('newProdIsFileUpload').checked;
    const isBulkOrder = document.getElementById('newProdIsBulkOrder').checked;
    const bulkQtyStr = document.getElementById('newProdBulkQtyOptions') ? document.getElementById('newProdBulkQtyOptions').value : '';
    const quantityOptions = bulkQtyStr ? bulkQtyStr.split(',').map(s => parseInt(s.trim())).filter(n => n > 0) : [];

    const priceKR = Math.round(parseFloat(document.getElementById('newProdPrice').value || 0));
    const priceJP = Math.round(parseFloat(document.getElementById('newProdPriceJP').value || 0));
    const priceUS = Math.round(parseFloat(document.getElementById('newProdPriceUS').value || 0));

    // 3. 변환된 imgUrl을 사용하여 데이터 저장
    const payload = {
        site_code: site, category: cat, code: code,
        width_mm: document.getElementById('newProdW').value || 0,
        height_mm: document.getElementById('newProdH').value || 0,
        is_custom_size: isCustom,
        is_general_product: isGeneral,
        is_hot_deal: isHotDeal,
        is_biz_deal: isBizDeal,
        is_popular: isPopular,
        is_print_service: isPrintService,
        is_goods: isGoods,
        is_paper_display: isPaperDisplay,
        is_file_upload: isFileUpload,
        is_bulk_order: isBulkOrder,
        quantity_options: quantityOptions,
        img_url: imgUrl, // 여기에 짧은 주소가 들어감
        name: document.getElementById('newProdName').value, 
        price: priceKR,
        description: document.getElementById('newProdDetailKR').value || (window.popupQuill ? window.popupQuill.root.innerHTML : ""),
        name_jp: document.getElementById('newProdNameJP').value, 
        price_jp: priceJP,
        description_jp: document.getElementById('newProdDetailJP').value,
        name_us: document.getElementById('newProdNameUS').value,
        price_us: priceUS,
        description_us: document.getElementById('newProdDetailUS').value,
        name_cn: document.getElementById('newProdNameCN').value,
        description_cn: document.getElementById('newProdDetailCN').value,
        name_ar: document.getElementById('newProdNameAR').value,
        description_ar: document.getElementById('newProdDetailAR').value,
        name_es: document.getElementById('newProdNameES').value,
        description_es: document.getElementById('newProdDetailES').value,
        name_de: document.getElementById('newProdNameDE') ? document.getElementById('newProdNameDE').value : '',
        description_de: document.getElementById('newProdDetailDE') ? document.getElementById('newProdDetailDE').value : '',
        name_fr: document.getElementById('newProdNameFR') ? document.getElementById('newProdNameFR').value : '',
        description_fr: document.getElementById('newProdDetailFR') ? document.getElementById('newProdDetailFR').value : '',
        cutline_url: document.getElementById('newProdCutlineUrl') ? document.getElementById('newProdCutlineUrl').value : '',
        mockup_url: document.getElementById('newProdMockupUrl') ? document.getElementById('newProdMockupUrl').value : '',
        material: document.getElementById('newProdMaterial') ? document.getElementById('newProdMaterial').value : '',
        print_symbol: document.getElementById('newProdPrintSymbol') ? document.getElementById('newProdPrintSymbol').value.trim().toUpperCase() : '',
        print_label: document.getElementById('newProdPrintLabel') ? document.getElementById('newProdPrintLabel').value.trim() : '',
        addons: addons
    };

    let error;
    if(editingProdId) {
        const res = await sb.from('admin_products').update(payload).eq('id', editingProdId);
        error = res.error;
    } else {
        const res = await sb.from('admin_products').insert([payload]);
        error = res.error;
    }

    if(error) showToast(_t('err_failed','Failed: ') + error.message, "error");
    else {
        _clearHomeCategoryCache();
        showToast(_t('msg_saved','Saved.'), "success");
        resetProductForm();
        if(document.getElementById('filterProdCat').value === cat) {
            filterProductList();
        }
    }
};

window.editProductLoad = async (id) => {
    const { data } = await sb.from('admin_products').select('*').eq('id', id).single();
    if(!data) return;

    editingProdId = id;
    window.scrollTo(0, 0);

    // 기본 정보
    document.getElementById('newProdSite').value = data.site_code || 'KR';
    document.getElementById('newProdCategory').value = data.category;
    document.getElementById('newProdCode').value = data.code;
    document.getElementById('newProdName').value = data.name;
    document.getElementById('newProdPrice').value = data.price;
    document.getElementById('newProdNameJP').value = data.name_jp || '';
    document.getElementById('newProdPriceJP').value = data.price_jp || '';
    document.getElementById('newProdNameUS').value = data.name_us || '';
    document.getElementById('newProdPriceUS').value = data.price_us || '';
    document.getElementById('newProdNameCN').value = data.name_cn || '';
    document.getElementById('newProdPriceCN').value = data.price_cn || '';
    document.getElementById('newProdNameAR').value = data.name_ar || '';
    document.getElementById('newProdPriceAR').value = data.price_ar || '';
    document.getElementById('newProdNameES').value = data.name_es || '';
    document.getElementById('newProdPriceES').value = data.price_es || '';
    if (document.getElementById('newProdNameDE')) document.getElementById('newProdNameDE').value = data.name_de || '';
    if (document.getElementById('newProdNameFR')) document.getElementById('newProdNameFR').value = data.name_fr || '';

    // 상세 정보 및 미리보기
    document.getElementById('newProdW').value = data.width_mm;
    document.getElementById('newProdH').value = data.height_mm;
    document.getElementById('newProdImg').value = data.img_url || '';
    document.getElementById('prodPreview').src = data.img_url || '';
    
    document.getElementById('newProdIsCustom').checked = data.is_custom_size || false;
    document.getElementById('newProdIsGeneral').checked = data.is_general_product || false;
    document.getElementById('newProdIsHotDeal').checked = data.is_hot_deal || false;
    document.getElementById('newProdIsBizDeal').checked = data.is_biz_deal || false;
    if (document.getElementById('newProdIsPopular')) document.getElementById('newProdIsPopular').checked = data.is_popular || false;
    if (document.getElementById('newProdIsPrintService')) document.getElementById('newProdIsPrintService').checked = data.is_print_service || false;
    if (document.getElementById('newProdIsGoods')) document.getElementById('newProdIsGoods').checked = data.is_goods || false;
    if (document.getElementById('newProdIsPaperDisplay')) document.getElementById('newProdIsPaperDisplay').checked = data.is_paper_display || false;
    document.getElementById('newProdIsFileUpload').checked = data.is_file_upload || false;
    document.getElementById('newProdIsBulkOrder').checked = data.is_bulk_order || false;
    const bulkDiv = document.getElementById('bulkOrderOptions');
    if (bulkDiv) bulkDiv.style.display = data.is_bulk_order ? 'block' : 'none';
    if (document.getElementById('newProdBulkQtyOptions')) document.getElementById('newProdBulkQtyOptions').value = (data.quantity_options || []).join(', ');

    // 상세 설명
    document.getElementById('newProdDetailKR').value = data.description || '';
    document.getElementById('newProdDetailJP').value = data.description_jp || '';
    document.getElementById('newProdDetailUS').value = data.description_us || '';
    document.getElementById('newProdDetailCN').value = data.description_cn || '';
    document.getElementById('newProdDetailAR').value = data.description_ar || '';
    document.getElementById('newProdDetailES').value = data.description_es || '';
    if (document.getElementById('newProdDetailDE')) document.getElementById('newProdDetailDE').value = data.description_de || '';
    if (document.getElementById('newProdDetailFR')) document.getElementById('newProdDetailFR').value = data.description_fr || '';

    // 소재 로드
    if (document.getElementById('newProdMaterial')) {
        document.getElementById('newProdMaterial').value = data.material || '';
    }
    // 출력 기호 + 이름 로드
    if (document.getElementById('newProdPrintSymbol')) {
        document.getElementById('newProdPrintSymbol').value = data.print_symbol || '';
    }
    if (document.getElementById('newProdPrintLabel')) {
        document.getElementById('newProdPrintLabel').value = data.print_label || '';
    }

    // 칼선/목업 URL 로드
    if (document.getElementById('newProdCutlineUrl')) {
        document.getElementById('newProdCutlineUrl').value = data.cutline_url || '';
        if (data.cutline_url) {
            document.getElementById('btnCutlineClear').style.display = 'inline-block';
            document.getElementById('cutlineStatus').textContent = '✅ 칼선 파일 등록됨';
        }
    }
    if (document.getElementById('newProdMockupUrl')) {
        document.getElementById('newProdMockupUrl').value = data.mockup_url || '';
        if (data.mockup_url) {
            document.getElementById('btnMockupClear').style.display = 'inline-block';
            const preview = document.getElementById('mockupPreview');
            if (preview) { preview.src = data.mockup_url; preview.style.display = 'block'; }
        }
    }

    // 버튼 상태 변경
    document.getElementById('btnProductSave').innerText = "상품 수정 저장";
    document.getElementById('btnProductSave').classList.remove('btn-primary');
    document.getElementById('btnProductSave').classList.add('btn-vip');
    
    document.getElementById('btnCancelEdit').style.display = 'block';
    document.getElementById('btnCloneProduct').style.display = 'block';

    // ============================================================
    // 🛑 [수정됨] 옵션(Addon) 복구 로직
    // 저장된 옵션 코드를 분석하여 카테고리 행을 자동으로 생성하고 체크합니다.
    // ============================================================
    const container = document.getElementById('dynamicCategoryContainer');
    if (container) {
        container.innerHTML = ''; // 기존에 열려있던 행들 초기화

        const savedAddonCodes = data.addons ? data.addons.split(',') : [];

        // 저장된 옵션이 있고, 캐시된 데이터(전체 옵션 목록)가 있다면 복구 시도
        if (savedAddonCodes.length > 0 && window.cachedAddons) {
            
            // (1) 저장된 옵션들이 어떤 '카테고리'에 속해있는지 먼저 파악 (중복 제거)
            const activeCategories = new Set();
            savedAddonCodes.forEach(code => {
                const addonItem = window.cachedAddons.find(a => a.code === code);
                if (addonItem) activeCategories.add(addonItem.category_code);
            });

            // (2) 파악된 카테고리 개수만큼 행(Row)을 생성
            activeCategories.forEach(catCode => {
                const rowId = 'row_' + Math.random().toString(36).substr(2, 9);

                // Select 박스 HTML 생성 (해당 카테고리를 selected 상태로 만듦)
                let optionsHtml = `<option value="">📦 카테고리 선택</option>`;
                (window.cachedAddonCategories || []).forEach(c => {
                    const isSelected = (c.code === catCode) ? 'selected' : '';
                    optionsHtml += `<option value="${c.code}" ${isSelected}>${c.name_kr || c.name}</option>`;
                });

                // 행(Div) 생성
                const wrapper = document.createElement('div');
                wrapper.id = rowId;
                wrapper.style.cssText = "background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:10px;";
                wrapper.innerHTML = `
                    <div style="display:flex; gap:5px; align-items:center; margin-bottom:8px;">
                        <select class="input-text dynamic-cat-select" style="font-size:11px; font-weight:bold; flex:1;" onchange="renderAddonsInRow('${rowId}', this.value)">
                            ${optionsHtml}
                        </select>
                        <button type="button" class="btn btn-outline btn-sm" onclick="removeCategorySelectRow('${rowId}')" style="color:#ef4444; border:none; background:transparent;">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                    </div>
                    <div class="row-addon-area" style="display:flex; flex-wrap:wrap; gap:5px; min-height:20px;"></div>`;
                
                container.appendChild(wrapper);

                // (3) 해당 카테고리의 체크박스 목록 렌더링
                renderAddonsInRow(rowId, catCode);

                // (4) 렌더링된 체크박스 중 저장된 값과 일치하는 것 체크하기
                const checkboxes = wrapper.querySelectorAll('input[name="prodAddon"]');
                checkboxes.forEach(chk => {
                    if (savedAddonCodes.includes(chk.value)) {
                        chk.checked = true;
                    }
                });
            });

        } else {
            // 저장된 옵션이 없으면 기본 빈 줄 하나 추가 (기존 동작 유지)
            addCategorySelectRow();
        }
    }
    // ============================================================
};

window.deleteProductDB = async (id) => {
    if(confirm("삭제?")) {
        await sb.from('admin_products').delete().eq('id', id);
        lastFetchedCategory = null; 
        filterProductList();
    }
};

window.resetProductForm = () => {
    editingProdId = null;
    document.getElementById('btnProductSave').innerText = "상품 저장";
    document.getElementById('btnCancelEdit').style.display = 'none';
    document.getElementById('btnCloneProduct').style.display = 'none';
    const inputs = document.querySelectorAll('.product-form input:not([type=checkbox])');
    inputs.forEach(i => i.value = '');
    document.getElementById('prodPreview').src = '';
    document.querySelectorAll('input[name="prodAddon"]').forEach(cb => cb.checked = false);
    document.getElementById('newProdIsCustom').checked = false;
    document.getElementById('newProdIsGeneral').checked = false;
    if (document.getElementById('newProdIsBulkOrder')) document.getElementById('newProdIsBulkOrder').checked = false;
    const bulkDiv = document.getElementById('bulkOrderOptions');
    if (bulkDiv) bulkDiv.style.display = 'none';
    if (document.getElementById('newProdBulkQtyOptions')) document.getElementById('newProdBulkQtyOptions').value = '';
    // 칼선/목업 초기화
    const cutlineClear = document.getElementById('btnCutlineClear');
    if (cutlineClear) cutlineClear.style.display = 'none';
    const cutlineStatus = document.getElementById('cutlineStatus');
    if (cutlineStatus) cutlineStatus.textContent = '';
    const mockupClear = document.getElementById('btnMockupClear');
    if (mockupClear) mockupClear.style.display = 'none';
    const mockupPreview = document.getElementById('mockupPreview');
    if (mockupPreview) { mockupPreview.src = ''; mockupPreview.style.display = 'none'; }
};

// [수정] 이미지 업로드 에러 핸들링 강화 (폴더/버킷 없음 에러 잡기)
// [수정] 이미지 업로드 에러 핸들링 강화 (폴더/버킷 없음 에러 잡기)
window.previewProductImage = async (input) => {
    if(!input.files[0]) return;
    const file = input.files[0];
    
    // 1. 일단 미리보기는 즉시 보여줌 (UX용)
    const reader = new FileReader();
    reader.onload = (e) => document.getElementById('prodPreview').src = e.target.result;
    reader.readAsDataURL(file);
    
    const btn = document.getElementById('btnProductSave');
    const oldText = btn.innerText; 
    btn.innerText = "이미지 업로드 중... (대기)"; 
    btn.disabled = true; // 업로드 완료 전까지 저장 금지

    try {
        const path = _safeStoragePath('products', file);
        const { error } = await sb.storage.from('products').upload(path, file);
        
        if (error) {
            console.error("Supabase Storage Error:", error);
            if (error.message.includes("Bucket not found") || error.statusCode === '404') {
                showToast(_t('err_prefix','Error: ') + "Supabase에 'products' 스토리지 버킷이 없습니다.", "error");
            } else {
                showToast(_t('err_upload_failed','Upload failed: ') + error.message, "error");
            }
            return;
        }

        const { data } = sb.storage.from('products').getPublicUrl(path);
        // [중요] 업로드가 성공해야만 URL 입력칸에 값을 넣음
        document.getElementById('newProdImg').value = data.publicUrl;

    } catch(e) { 
        showToast(_t('err_upload_processing','Upload processing error'), "error");
    } 
    finally { 
        btn.innerText = oldText; 
        btn.disabled = false; 
    }
};
window.bulkApplyAddonsToCategory = async () => {
    const cat = document.getElementById('newProdCategory').value;
    if(!cat) { showToast(_t('err_category_required','Category selection required.'), "warn"); return; }
    const addons = Array.from(document.querySelectorAll('input[name="prodAddon"]:checked')).map(cb => cb.value).join(',');
    if(!confirm(`[${cat}] 카테고리 전체 상품에 현재 옵션을 적용합니까?`)) return;

    const { error } = await sb.from('admin_products').update({ addons: addons }).eq('category', cat);
    if(error) showToast(_t('err_failed','Failed: ') + error.message, "error"); else showToast(_t('msg_applied','Applied.'), "success");
};

// [소재] 카테고리 전체에 현재 소재 적용
window.applyMaterialToCategory = async () => {
    const cat = document.getElementById('newProdCategory').value;
    const material = document.getElementById('newProdMaterial').value;
    if (!cat) { showToast(_t('err_select_cat_first','Please select a category first.'), "warn"); return; }
    if (!material) { showToast(_t('err_select_material_first','Please select a material first.'), "warn"); return; }
    const label = document.getElementById('newProdMaterial').selectedOptions[0].textContent;
    if (!confirm(`[${cat}] 카테고리 전체 상품의 소재를 "${label}"(으)로 변경합니까?`)) return;
    const { error } = await sb.from('admin_products').update({ material }).eq('category', cat);
    if (error) showToast(_t('err_failed','Failed: ') + error.message, "error");
    else showToast(`${cat}: "${label}" ` + _t('msg_applied','applied.'), "success");
};

// [출력 기호+이름] 미리 정의된 프리셋 선택 → 입력칸 자동 채움
window.applyPrintPreset = () => {
    const sel = document.getElementById('newProdPrintPreset');
    if (!sel || !sel.value) return;
    const [symbol, label] = sel.value.split('|');
    const symEl = document.getElementById('newProdPrintSymbol');
    const lblEl = document.getElementById('newProdPrintLabel');
    if (symEl) symEl.value = symbol || '';
    if (lblEl) lblEl.value = label || '';
    // 적용 후 드롭다운 리셋 (다음 선택 가능하게)
    sel.value = '';
};

// [출력 기호+이름] 카테고리 전체에 일괄 적용
window.applyPrintCodeToCategory = async () => {
    const cat = document.getElementById('newProdCategory').value;
    const symbol = (document.getElementById('newProdPrintSymbol').value || '').trim().toUpperCase();
    const label = (document.getElementById('newProdPrintLabel').value || '').trim();
    if (!cat) { showToast(_t('err_select_cat_first','Please select a category first.'), "warn"); return; }
    if (!symbol && !label) { showToast('기호 또는 이름을 입력해주세요.', 'warn'); return; }
    if (!confirm(`[${cat}] 카테고리 전체 상품에 "${symbol} / ${label}"(을)를 적용합니까?`)) return;
    const { error } = await sb.from('admin_products').update({ print_symbol: symbol, print_label: label }).eq('category', cat);
    if (error) showToast(_t('err_failed','Failed: ') + error.message, "error");
    else showToast(`${cat}: "${symbol} / ${label}" ` + _t('msg_applied','applied.'), "success");
};

// [소재] 사용자 정의 소재 추가
window.addCustomMaterial = () => {
    const name = prompt('추가할 소재 이름을 입력하세요 (예: 알루미늄복합판 3mm)');
    if (!name || !name.trim()) return;
    const value = name.trim().replace(/[\s\/]/g, '_').toLowerCase();
    const select = document.getElementById('newProdMaterial');
    // 중복 체크
    for (const opt of select.options) {
        if (opt.value === value || opt.textContent === name.trim()) {
            showToast(_t('err_material_exists','Material already exists.'), 'warn');
            select.value = opt.value;
            return;
        }
    }
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = name.trim();
    // "미지정" 다음에 삽입하지 않고 맨 끝에 추가
    select.appendChild(opt);
    select.value = value;
    showToast(`"${name.trim()}" ` + _t('msg_material_added','material added.'), 'success');
};

// [소재] DB에 저장된 커스텀 소재를 드롭다운에 자동 추가
window.loadCustomMaterials = async () => {
    const select = document.getElementById('newProdMaterial');
    if (!select) return;
    const { data } = await sb.from('admin_products').select('material');
    if (!data) return;
    const existing = new Set(Array.from(select.options).map(o => o.value));
    const custom = [...new Set(data.map(p => p.material).filter(m => m && !existing.has(m)))];
    custom.forEach(mat => {
        const opt = document.createElement('option');
        opt.value = mat;
        opt.textContent = mat.replace(/_/g, ' ');
        select.appendChild(opt);
    });
    if (custom.length > 0) console.log('[소재] DB에서 커스텀 소재 로드:', custom);
};

// ==========================================
// 번역 및 기타 기능
// ==========================================
// ★ Claude AI 번역 (모든 언어를 한번에 번역)
async function claudeTranslateAll(text) {
    if (!text) return {};
    try {
        const { data, error } = await sb.functions.invoke('translate', {
            body: {
                text: text,
                sourceLang: 'kr',
                targetLangs: ['ja', 'en', 'zh', 'ar', 'es', 'de', 'fr']
            }
        });
        if (error) throw error;
        return (data && data.translations) || {};
    } catch(e) {
        console.warn('Claude 번역 실패, Google 번역으로 폴백:', e);
        const result = {};
        const langs = { ja: 'ja', en: 'en', zh: 'zh-CN', ar: 'ar', es: 'es', de: 'de', fr: 'fr' };
        for (const [key, code] of Object.entries(langs)) {
            result[key] = await googleTranslateFallback(text, code);
        }
        return result;
    }
}

async function googleTranslateFallback(text, targetLang) {
    if (!text) return "";
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetLang}&dt=t&q=${encodeURI(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data[0].map(x => x[0]).join('');
    } catch (e) {
        console.error("번역 API 오류:", e);
        return "";
    }
}

// 하위 호환용 (개별 언어 번역 — 기존 코드에서 사용)
async function googleTranslate(text, targetLang) {
    return googleTranslateFallback(text, targetLang);
}

// ★ KRW 가격 입력 시 실시간 환율 자동계산
window.autoFillPrices = (krwVal) => {
    const krw = parseFloat(krwVal) || 0;
    if (krw <= 0) return;
    const rates = { JP: 0.1, US: 0.001, CN: 0.05, AR: 0.001, EUR: 0.001 };
    const setVal = (id, val, dec) => {
        const el = document.getElementById(id);
        if (el) el.value = dec ? val.toFixed(dec) : Math.round(val);
    };
    setVal('newProdPriceJP', krw * rates.JP);
    setVal('newProdPriceUS', krw * rates.US, 2);
    setVal('newProdPriceCN', krw * rates.CN);
    setVal('newProdPriceAR', krw * rates.AR, 2);
    setVal('newProdPriceES', krw * rates.EUR, 2);
    setVal('newProdPriceDE', krw * rates.EUR, 2);
    setVal('newProdPriceFR', krw * rates.EUR, 2);
};

window.autoTranslateInputs = async () => {
    const krName = document.getElementById('newProdName').value;
    const krPrice = document.getElementById('newProdPrice').value;

    if (!krName) { showToast(_t('err_kr_product_name_required','Please enter a Korean product name.'), "warn"); return; }

    if (document.getElementById('newProdNameJP').value || document.getElementById('newProdNameUS').value) {
        if (!confirm("이미 입력된 번역 데이터가 있습니다. 기존 내용을 유지하시겠습니까? (취소 시 새로 번역)")) return;
    }

    const btn = document.querySelector('button[onclick="autoTranslateInputs()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    btn.disabled = true;

    try {
        const rateJPY = 0.1, rateUSD = 0.001, rateCNY = 0.05, rateSAR = 0.001, rateEUR = 0.001;

        if (krPrice && krPrice > 0) {
            document.getElementById('newProdPriceJP').value = Math.round(krPrice * rateJPY);
            document.getElementById('newProdPriceUS').value = (krPrice * rateUSD).toFixed(2);
            document.getElementById('newProdPriceCN').value = Math.round(krPrice * rateCNY);
            document.getElementById('newProdPriceAR').value = (krPrice * rateSAR).toFixed(2);
            document.getElementById('newProdPriceES').value = (krPrice * rateEUR).toFixed(2);
            document.getElementById('newProdPriceDE').value = (krPrice * rateEUR).toFixed(2);
            document.getElementById('newProdPriceFR').value = (krPrice * rateEUR).toFixed(2);
        }

        // Claude AI 번역 (한번에 모든 언어)
        const tr = await claudeTranslateAll(krName);
        if (tr.ja) document.getElementById('newProdNameJP').value = tr.ja;
        if (tr.en) document.getElementById('newProdNameUS').value = tr.en;
        if (tr.zh) document.getElementById('newProdNameCN').value = tr.zh;
        if (tr.ar) document.getElementById('newProdNameAR').value = tr.ar;
        if (tr.es) document.getElementById('newProdNameES').value = tr.es;
        if (tr.de && document.getElementById('newProdNameDE')) document.getElementById('newProdNameDE').value = tr.de;
        if (tr.fr && document.getElementById('newProdNameFR')) document.getElementById('newProdNameFR').value = tr.fr;

        showToast(_t('msg_product_translated','AI 번역 완료!'), "success");

    } catch (e) {
        showToast(_t('err_translation_failed','Translation failed: ') + e.message, "error");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.autoTranslateTopCategoryInputs = async () => {
    const krName = document.getElementById('newTopCatName').value;
    const krDesc = document.getElementById('newTopCatDesc') ? document.getElementById('newTopCatDesc').value : '';
    if (!krName) { showToast(_t('err_kr_name_input_required','Please enter a Korean name.'), "warn"); return; }
    const tr = await claudeTranslateAll(krName);
    if (tr.ja) document.getElementById('newTopCatNameJP').value = tr.ja;
    if (tr.en) document.getElementById('newTopCatNameUS').value = tr.en;
    if (tr.zh) document.getElementById('newTopCatNameCN').value = tr.zh;
    if (tr.ar) document.getElementById('newTopCatNameAR').value = tr.ar;
    if (tr.es) document.getElementById('newTopCatNameES').value = tr.es;
    if (krDesc) {
        const trD = await claudeTranslateAll(krDesc);
        if(trD.ja && document.getElementById('newTopCatDescJP')) document.getElementById('newTopCatDescJP').value = trD.ja;
        if(trD.en && document.getElementById('newTopCatDescUS')) document.getElementById('newTopCatDescUS').value = trD.en;
    }
    showToast(_t('msg_top_cat_translated','AI 번역 완료!'), "success");
};

window.autoTranslateCategoryInputs = async () => {
    const krName = document.getElementById('newCatName').value;
    const krDesc = document.getElementById('newCatDesc') ? document.getElementById('newCatDesc').value : '';
    if (!krName) { showToast(_t('err_kr_name_input_required','Please enter a Korean name.'), "warn"); return; }
    const tr = await claudeTranslateAll(krName);
    if (tr.ja) document.getElementById('newCatNameJP').value = tr.ja;
    if (tr.en) document.getElementById('newCatNameUS').value = tr.en;
    if (tr.zh) document.getElementById('newCatNameCN').value = tr.zh;
    if (tr.ar) document.getElementById('newCatNameAR').value = tr.ar;
    if (tr.es) document.getElementById('newCatNameES').value = tr.es;
    if (tr.de && document.getElementById('newCatNameDE')) document.getElementById('newCatNameDE').value = tr.de;
    if (tr.fr && document.getElementById('newCatNameFR')) document.getElementById('newCatNameFR').value = tr.fr;
    if (krDesc) {
        const trD = await claudeTranslateAll(krDesc);
        if(trD.ja && document.getElementById('newCatDescJP')) document.getElementById('newCatDescJP').value = trD.ja;
        if(trD.en && document.getElementById('newCatDescUS')) document.getElementById('newCatDescUS').value = trD.en;
        if(trD.zh && document.getElementById('newCatDescCN')) document.getElementById('newCatDescCN').value = trD.zh;
        if(trD.ar && document.getElementById('newCatDescAR')) document.getElementById('newCatDescAR').value = trD.ar;
        if(trD.es && document.getElementById('newCatDescES')) document.getElementById('newCatDescES').value = trD.es;
        if(trD.de && document.getElementById('newCatDescDE')) document.getElementById('newCatDescDE').value = trD.de;
        if(trD.fr && document.getElementById('newCatDescFR')) document.getElementById('newCatDescFR').value = trD.fr;
    }
    showToast(_t('msg_sub_cat_translated','AI 번역 완료!'), "success");
};

window.autoFillAddonPrices = (krwVal) => {
    const krw = parseFloat(krwVal) || 0;
    if (krw <= 0) return;
    const r = { JP: 0.1, US: 0.001, CN: 0.05, AR: 0.001, EUR: 0.001 };
    const s = (id, v, d) => { const el = document.getElementById(id); if (el) el.value = d ? v.toFixed(d) : Math.round(v); };
    s('prJP', krw * r.JP); s('prUS', krw * r.US, 2); s('prCN', krw * r.CN);
    s('prAR', krw * r.AR, 2); s('prES', krw * r.EUR, 2);
    if (document.getElementById('prDE')) s('prDE', krw * r.EUR, 2);
    if (document.getElementById('prFR')) s('prFR', krw * r.EUR, 2);
};

window.autoTranslateAddonInputs = async () => {
    const krName = document.getElementById('nmKR').value;
    const krPrice = document.getElementById('prKR').value;
    if (!krName) { showToast(_t('err_kr_name_input_required','Please enter a Korean name.'), "warn"); return; }
    const rateJPY = 0.1, rateUSD = 0.001, rateCNY = 0.05, rateSAR = 0.001, rateEUR = 0.001;
    if (krPrice) {
        document.getElementById('prJP').value = Math.round(krPrice * rateJPY);
        document.getElementById('prUS').value = (krPrice * rateUSD).toFixed(2);
        document.getElementById('prCN').value = (krPrice * rateCNY).toFixed(2);
        document.getElementById('prAR').value = (krPrice * rateSAR).toFixed(2);
        document.getElementById('prES').value = (krPrice * rateEUR).toFixed(2);
        if (document.getElementById('prDE')) document.getElementById('prDE').value = (krPrice * rateEUR).toFixed(2);
        if (document.getElementById('prFR')) document.getElementById('prFR').value = (krPrice * rateEUR).toFixed(2);
    }
    // Claude AI 번역
    const tr = await claudeTranslateAll(krName);
    if (tr.ja) document.getElementById('nmJP').value = tr.ja;
    if (tr.en) document.getElementById('nmUS').value = tr.en;
    if (tr.zh) document.getElementById('nmCN').value = tr.zh;
    if (tr.ar) document.getElementById('nmAR').value = tr.ar;
    if (tr.es) document.getElementById('nmES').value = tr.es;
    if (tr.de && document.getElementById('nmDE')) document.getElementById('nmDE').value = tr.de;
    if (tr.fr && document.getElementById('nmFR')) document.getElementById('nmFR').value = tr.fr;
    showToast(_t('msg_option_translated','AI 번역 완료!'), "success");
};

window.bulkTranslateAll = async () => {
    const mode = confirm("전체 상품/옵션/카테고리를 Claude AI로 번역합니다.\n\n[확인] = 모든 번역을 새로 덮어쓰기\n[취소] = 빈 번역만 채우기");
    const forceAll = mode;
    const btn = document.getElementById('btnBulkTranslate') || document.activeElement;
    const oldText = btn.innerText;
    btn.disabled = true;

    // Claude 번역 캐시
    const trCache = {};
    async function getTranslations(krText) {
        if (!krText) return {};
        if (trCache[krText]) return trCache[krText];
        trCache[krText] = await claudeTranslateAll(krText);
        return trCache[krText];
    }

    try {
        // ── 1. 상품 (admin_products) ──
        const { data: products } = await sb.from('admin_products').select('id, name, name_jp, name_us, name_cn, name_ar, name_es, name_de, name_fr');
        let pCount = 0;
        for (let i = 0; i < (products||[]).length; i++) {
            const p = products[i];
            if (!p.name) continue;
            btn.innerText = `AI 번역 중... (상품 ${i+1}/${products.length})`;
            const needsAny = forceAll || !p.name_jp || !p.name_us || !p.name_cn || !p.name_ar || !p.name_es || !p.name_de || !p.name_fr;
            if (!needsAny) continue;
            const tr = await getTranslations(p.name);
            let updates = {};
            if (tr.ja && (forceAll || !p.name_jp)) updates.name_jp = tr.ja;
            if (tr.en && (forceAll || !p.name_us)) updates.name_us = tr.en;
            if (tr.zh && (forceAll || !p.name_cn)) updates.name_cn = tr.zh;
            if (tr.ar && (forceAll || !p.name_ar)) updates.name_ar = tr.ar;
            if (tr.es && (forceAll || !p.name_es)) updates.name_es = tr.es;
            if (tr.de && (forceAll || !p.name_de)) updates.name_de = tr.de;
            if (tr.fr && (forceAll || !p.name_fr)) updates.name_fr = tr.fr;
            if (Object.keys(updates).length > 0) {
                await sb.from('admin_products').update(updates).eq('id', p.id);
                pCount++;
            }
        }

        // ── 2. 옵션 (admin_addons) ──
        const { data: addons } = await sb.from('admin_addons').select('*');
        let aCount = 0;
        for (let i = 0; i < (addons||[]).length; i++) {
            const a = addons[i];
            const srcName = a.name_kr || a.name;
            if (!srcName) continue;
            btn.innerText = `AI 번역 중... (옵션 ${i+1}/${addons.length})`;
            const needsAny = forceAll || !a.name_jp || !a.name_us || !a.name_cn || !a.name_ar || !a.name_es || !a.name_de || !a.name_fr;
            if (!needsAny) continue;
            const tr = await getTranslations(srcName);
            let updates = {};
            if (tr.ja && (forceAll || !a.name_jp)) updates.name_jp = tr.ja;
            if (tr.en && (forceAll || !a.name_us)) updates.name_us = tr.en;
            if (tr.zh && (forceAll || !a.name_cn)) updates.name_cn = tr.zh;
            if (tr.ar && (forceAll || !a.name_ar)) updates.name_ar = tr.ar;
            if (tr.es && (forceAll || !a.name_es)) updates.name_es = tr.es;
            if (tr.de && (forceAll || !a.name_de)) updates.name_de = tr.de;
            if (tr.fr && (forceAll || !a.name_fr)) updates.name_fr = tr.fr;
            if (Object.keys(updates).length > 0) {
                await sb.from('admin_addons').update(updates).eq('id', a.id);
                aCount++;
            }
        }

        // ── 3. 대분류 (admin_top_categories) ──
        const { data: topCats } = await sb.from('admin_top_categories').select('*');
        let tcCount = 0;
        for (const tc of (topCats || [])) {
            if (!tc.name) continue;
            btn.innerText = `AI 번역 중... (대분류)`;
            const tr = await getTranslations(tc.name);
            let updates = {};
            if (tr.ja && (forceAll || !tc.name_jp)) updates.name_jp = tr.ja;
            if (tr.en && (forceAll || !tc.name_us)) updates.name_us = tr.en;
            if (tr.zh && (forceAll || !tc.name_cn)) updates.name_cn = tr.zh;
            if (tr.ar && (forceAll || !tc.name_ar)) updates.name_ar = tr.ar;
            if (tr.es && (forceAll || !tc.name_es)) updates.name_es = tr.es;
            if (tr.de && (forceAll || !tc.name_de)) updates.name_de = tr.de;
            if (tr.fr && (forceAll || !tc.name_fr)) updates.name_fr = tr.fr;
            if (Object.keys(updates).length > 0) { await sb.from('admin_top_categories').update(updates).eq('id', tc.id); tcCount++; }
        }

        // ── 4. 소분류 (admin_categories) ──
        const { data: subCats } = await sb.from('admin_categories').select('*');
        let scCount = 0;
        for (const sc of (subCats || [])) {
            if (!sc.name) continue;
            btn.innerText = `AI 번역 중... (소분류)`;
            const tr = await getTranslations(sc.name);
            let updates = {};
            if (tr.ja && (forceAll || !sc.name_jp)) updates.name_jp = tr.ja;
            if (tr.en && (forceAll || !sc.name_us)) updates.name_us = tr.en;
            if (tr.zh && (forceAll || !sc.name_cn)) updates.name_cn = tr.zh;
            if (tr.ar && (forceAll || !sc.name_ar)) updates.name_ar = tr.ar;
            if (tr.es && (forceAll || !sc.name_es)) updates.name_es = tr.es;
            if (tr.de && (forceAll || !sc.name_de)) updates.name_de = tr.de;
            if (tr.fr && (forceAll || !sc.name_fr)) updates.name_fr = tr.fr;
            if (Object.keys(updates).length > 0) { await sb.from('admin_categories').update(updates).eq('id', sc.id); scCount++; }
        }

        // ── 5. 옵션 카테고리 (addon_categories) ──
        const { data: addonCats } = await sb.from('addon_categories').select('*');
        let acCount = 0;
        for (const ac of (addonCats || [])) {
            const src = ac.name_kr || ac.name;
            if (!src) continue;
            btn.innerText = `AI 번역 중... (옵션카테고리)`;
            const tr = await getTranslations(src);
            let updates = {};
            if (tr.ja && (forceAll || !ac.name_jp)) updates.name_jp = tr.ja;
            if (tr.en && (forceAll || !ac.name_us)) updates.name_us = tr.en;
            if (tr.zh && (forceAll || !ac.name_cn)) updates.name_cn = tr.zh;
            if (tr.ar && (forceAll || !ac.name_ar)) updates.name_ar = tr.ar;
            if (tr.es && (forceAll || !ac.name_es)) updates.name_es = tr.es;
            if (tr.de && (forceAll || !ac.name_de)) updates.name_de = tr.de;
            if (tr.fr && (forceAll || !ac.name_fr)) updates.name_fr = tr.fr;
            if (Object.keys(updates).length > 0) { await sb.from('addon_categories').update(updates).eq('id', ac.id); acCount++; }
        }

        const total = pCount + aCount + tcCount + scCount + acCount;
        showToast(_t('msg_bulk_translate_done','Bulk translation done!') + `\nP:${pCount} | A:${aCount} | TC:${tcCount} | SC:${scCount} | AC:${acCount} | Total:${total}`, "success");
    } catch (e) {
        showToast(_t('err_bulk_translate_failed','Bulk translation error: ') + e.message, "error");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// ★ 대분류별 상세페이지 일괄 번역 (Claude AI)
window.bulkTranslateDetailsByTopCat = async (topCatCode, topCatName) => {
    // 해당 대분류의 소분류 코드 조회
    const { data: subCats } = await sb.from('admin_categories').select('code').eq('parent_code', topCatCode);
    const catCodes = [topCatCode, ...(subCats || []).map(c => c.code)];

    // 해당 카테고리에 속하는 상품 조회
    const { data: products } = await sb.from('admin_products')
        .select('id, name, description, description_jp, description_us, description_cn, description_ar, description_es, description_de, description_fr, category')
        .in('category', catCodes);

    if (!products || products.length === 0) {
        showToast(`[${topCatName}] 상품이 없습니다.`, 'warn');
        return;
    }

    // 상세페이지가 있는 상품만 필터
    const withDesc = products.filter(p => p.description && p.description.trim() && p.description !== '<p><br></p>');
    if (withDesc.length === 0) {
        showToast(`[${topCatName}] 상세페이지가 있는 상품이 없습니다.`, 'warn');
        return;
    }

    const mode = confirm(`[${topCatName}] ${withDesc.length}개 상품의 상세페이지를 Claude AI로 번역합니다.\n\n[확인] = 모든 번역 덮어쓰기\n[취소] = 빈 번역만 채우기`);
    const forceAll = mode;

    // 진행 상태 오버레이
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:32px;width:420px;max-width:90%;text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">🌐</div>
        <div style="font-size:18px;font-weight:800;color:#1e293b;margin-bottom:8px;">${topCatName} 상세페이지 번역</div>
        <div id="_bulkDetailProgress" style="font-size:14px;color:#6366f1;font-weight:bold;margin-bottom:16px;">준비 중...</div>
        <div style="background:#f1f5f9;border-radius:8px;height:8px;overflow:hidden;"><div id="_bulkDetailBar" style="width:0%;height:100%;background:linear-gradient(90deg,#6366f1,#a855f7);transition:width 0.3s;"></div></div>
        <div id="_bulkDetailLog" style="margin-top:12px;font-size:11px;color:#94a3b8;max-height:120px;overflow-y:auto;text-align:left;"></div>
    </div>`;
    document.body.appendChild(overlay);

    const progressEl = document.getElementById('_bulkDetailProgress');
    const barEl = document.getElementById('_bulkDetailBar');
    const logEl = document.getElementById('_bulkDetailLog');
    let successCount = 0, skipCount = 0, failCount = 0;

    for (let i = 0; i < withDesc.length; i++) {
        const p = withDesc[i];
        const pct = Math.round(((i + 1) / withDesc.length) * 100);
        progressEl.textContent = `${i + 1} / ${withDesc.length} (${pct}%)`;
        barEl.style.width = pct + '%';

        const needsAny = forceAll || !p.description_jp || !p.description_us || !p.description_cn || !p.description_ar || !p.description_es || !p.description_de || !p.description_fr;
        if (!needsAny) { skipCount++; logEl.innerHTML += `<div>⏭ ${p.name} (이미 번역됨)</div>`; continue; }

        try {
            const { data, error } = await sb.functions.invoke('translate', {
                body: { text: p.description, sourceLang: 'ko', targetLangs: ['ja','en','zh','ar','es','de','fr'], html: true }
            });
            if (error) throw error;
            const tr = data?.translations || {};

            let updates = {};
            if (tr.ja && (forceAll || !p.description_jp)) updates.description_jp = tr.ja;
            if (tr.en && (forceAll || !p.description_us)) updates.description_us = tr.en;
            if (tr.zh && (forceAll || !p.description_cn)) updates.description_cn = tr.zh;
            if (tr.ar && (forceAll || !p.description_ar)) updates.description_ar = tr.ar;
            if (tr.es && (forceAll || !p.description_es)) updates.description_es = tr.es;
            if (tr.de && (forceAll || !p.description_de)) updates.description_de = tr.de;
            if (tr.fr && (forceAll || !p.description_fr)) updates.description_fr = tr.fr;

            if (Object.keys(updates).length > 0) {
                await sb.from('admin_products').update(updates).eq('id', p.id);
                successCount++;
                logEl.innerHTML += `<div style="color:#15803d;">✅ ${p.name}</div>`;
            } else {
                skipCount++;
                logEl.innerHTML += `<div>⏭ ${p.name}</div>`;
            }
        } catch(e) {
            failCount++;
            logEl.innerHTML += `<div style="color:#ef4444;">❌ ${p.name}: ${e.message || e}</div>`;
        }
        logEl.scrollTop = logEl.scrollHeight;
    }

    progressEl.textContent = `완료! 성공: ${successCount} | 건너뜀: ${skipCount} | 실패: ${failCount}`;
    barEl.style.width = '100%';
    barEl.style.background = '#22c55e';

    // 닫기 버튼
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = 'margin-top:16px;padding:10px 30px;border:none;background:#6366f1;color:#fff;border-radius:8px;font-weight:bold;cursor:pointer;';
    closeBtn.onclick = () => overlay.remove();
    overlay.querySelector('div > div').appendChild(closeBtn);
};

window.cloneProductMode = () => {
    editingProdId = null; 
    const codeInput = document.getElementById('newProdCode');
    codeInput.value = ''; 
    codeInput.focus();
    codeInput.placeholder = "새 상품 코드를 입력하세요";
    document.getElementById('btnProductSave').innerText = "새 상품 등록하기";
    document.getElementById('btnProductSave').classList.remove('btn-vip');
    document.getElementById('btnProductSave').classList.add('btn-primary');
    document.getElementById('btnCloneProduct').style.display = 'none';
    document.getElementById('btnCancelEdit').style.display = 'none';
    showToast(_t('msg_cloned','Content cloned. Enter a new [product code] and click Save.'), "info");
};

window.updateAllCurrency = async () => {
    if (!confirm("전체 상품의 가격을 아래 환율로 일괄 변경하시겠습니까?\n\n🇯🇵 1,000원 → 100엔 (×0.1)\n🇺🇸 1,000원 → $1 (×0.001)\n🇨🇳 1,000원 → ¥50 (×0.05)\n🇸🇦 1,000원 → $1 (×0.001)\n🇪🇸 1,000원 → €1 (×0.001)\n🇩🇪 1,000원 → €1 (×0.001)\n🇫🇷 1,000원 → €1 (×0.001)\n\n(주의: 기존에 입력된 해외 가격이 모두 덮어씌워집니다.)")) return;
    const btn = document.getElementById('btnCurrencyUpdate');
    const oldText = btn.innerText;
    btn.innerText = "업데이트 중...";
    btn.disabled = true;
    try {
        const { data: products, error } = await sb.from('admin_products').select('id, price');
        if (error) throw error;
        if (!products || products.length === 0) {
            showToast(_t('err_no_products','No products found.'), "warn");
            return;
        }
        let successCount = 0;
        for (const p of products) {
            const krw = p.price || 0;
            const updates = {
                price_jp: Math.round(krw * 0.1),
                price_us: +(krw * 0.001).toFixed(2),
                price_cn: +(krw * 0.05).toFixed(2),
                price_ar: +(krw * 0.001).toFixed(2),
                price_es: +(krw * 0.001).toFixed(2),
                price_de: +(krw * 0.001).toFixed(2),
                price_fr: +(krw * 0.001).toFixed(2)
            };
            const { error: updateErr } = await sb.from('admin_products').update(updates).eq('id', p.id);
            if (!updateErr) successCount++;
        }
        showToast(`환율 일괄 적용 완료: ${successCount}개 상품`, "success");
        if (window.filterProductList) window.filterProductList();
    } catch (e) {
        console.error(e);
        showToast(_t('err_update_failed','Update error: ') + e.message, "error");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

window.filterAddonsMulti = () => {
    const container = document.getElementById('addonCheckboxArea');
    if (!container) return;
    const selects = document.querySelectorAll('.dynamic-cat-select');
    const activeFilters = Array.from(selects).map(s => s.value).filter(v => v !== 'all');
    const labels = container.getElementsByTagName('label');
    for (let i = 0; i < labels.length; i++) {
        const addonCat = labels[i].dataset.category;
        if (activeFilters.length === 0) {
            labels[i].style.display = "flex";
            continue;
        }
        const isMatch = activeFilters.includes(addonCat);
        labels[i].style.display = isMatch ? "flex" : "none";
    }
};

let popupQuill;
let currentPopupLang = 'KR';

window.googleTranslateSimple = async (text, target) => {
    try {
        if (!text || text.trim().length === 0) return text;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        return json[0].map(item => item[0]).join('');
    } catch (e) {
        console.error("번역 엔진 통신 실패:", e);
        return text; 
    }
};

// ==========================================
// [개선된] 팝업 에디터 (줄간격, 유튜브 스타일, HTML편집, 구분선)
// ==========================================
// ==========================================
// [개선된] 팝업 에디터 (유튜브 라운딩 디자인 + 파라미터 자동 적용)
// ==========================================
window.initPopupQuill = () => {
    if (popupQuill) return;

    // 1. 스타일 CSS 강제 주입 (줄간격 & 유튜브 디자인)
    const style = document.createElement('style');
    style.innerHTML = `
        /* 텍스트 줄간격 */
        #popup-quill-editor .ql-editor p, 
        .product-detail-render p {
            margin-bottom: 5px !important;
            line-height: 1.6 !important;
            min-height: 1.6em;
        }
        
        /* [핵심] 유튜브/비디오 스타일링: 둥근 모서리 + 그림자 + 꽉 찬 화면 */
        #popup-quill-editor .ql-video,
        .product-detail-render iframe,
        .product-detail-render video {
            display: block; 
            width: 100% !important; 
            max-width: 100%; 
            height: auto;
            aspect-ratio: 16 / 9; /* 16:9 비율 고정 */
            border-radius: 24px !important; /* 둥근 모서리 (원하는 만큼 조절) */
            box-shadow: 0 15px 35px rgba(0,0,0,0.2); /* 고급스러운 그림자 */
            border: none; 
            margin: 30px auto; /* 위아래 여백 */
            background: #000; /* 로딩 전 검은 배경 */
        }

        /* 구분선 스타일 */
        hr { border: 0; height: 1px; background: #e2e8f0; margin: 30px 0; }
        hr.dashed { border-top: 2px dashed #cbd5e1; background: none; height: 0; }
        
        /* HTML 편집창 스타일 */
        .ql-html-editor {
            width: 100%; height: 100%; border: none; padding: 20px;
            font-family: monospace; font-size: 14px; background: #1e1e1e; color: #d4d4d4;
            resize: none; outline: none;
        }
    `;
    document.head.appendChild(style);

    // 2. [핵심] 유튜브 핸들러 (깔끔한 URL 변환)
    function videoHandler() {
        let url = prompt("유튜브 영상 주소(URL)를 입력하세요:");
        if (url) {
            // (1) 일반 주소를 임베드 주소로 변환
            // 예: https://www.youtube.com/watch?v=VIDEO_ID -> https://www.youtube.com/embed/VIDEO_ID
            let embedUrl = url;
            if (url.includes("watch?v=")) {
                embedUrl = url.replace("watch?v=", "embed/");
            } else if (url.includes("youtu.be/")) {
                embedUrl = url.replace("youtu.be/", "youtube.com/embed/");
            }

            // (2) 깔끔하게 보이는 파라미터 강제 추가
            // modestbranding=1 : 유튜브 로고 최소화
            // rel=0 : 재생 종료 후 관련 영상에 내 채널 영상만 표시 (타사 광고 방지)
            // showinfo=0 (deprecated되긴 했지만 일부 환경 지원)
            if (!embedUrl.includes('?')) {
                embedUrl += '?modestbranding=1&rel=0&controls=1&playsinline=1';
            } else {
                embedUrl += '&modestbranding=1&rel=0&controls=1&playsinline=1';
            }

            const range = popupQuill.getSelection();
            popupQuill.insertEmbed(range.index, 'video', embedUrl);
        }
    }

    // 3. HTML 직접 편집 핸들러
    function htmlEditHandler() {
        const container = document.getElementById('popup-quill-editor');
        const editorArea = container.querySelector('.ql-editor');
        let txtArea = container.querySelector('.ql-html-editor');

        if (txtArea) {
            const html = txtArea.value;
            popupQuill.clipboard.dangerouslyPasteHTML(html);
            txtArea.remove();
            editorArea.style.display = 'block';
        } else {
            const html = popupQuill.root.innerHTML;
            txtArea = document.createElement('textarea');
            txtArea.className = 'ql-html-editor';
            txtArea.value = html;
            container.appendChild(txtArea);
            editorArea.style.display = 'none';
            txtArea.focus();
        }
    }

    // 4. 구분선 핸들러
    function hrHandler() {
        const range = popupQuill.getSelection();
        if (range) {
            popupQuill.insertEmbed(range.index, 'divider', true, 'user');
            popupQuill.setSelection(range.index + 1, Quill.sources.SILENT);
        }
    }

    // Quill 모듈 등록
    const BlockEmbed = Quill.import('blots/block/embed');
    class DividerBlot extends BlockEmbed {
        static create() {
            let node = super.create();
            node.setAttribute('class', 'dashed');
            return node;
        }
    }
    DividerBlot.blotName = 'divider';
    DividerBlot.tagName = 'hr';
    Quill.register(DividerBlot);

    // 5. 에디터 생성
    popupQuill = new Quill('#popup-quill-editor', {
        modules: {
            toolbar: {
                container: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    ['image', 'video', 'link'],
                    ['divider', 'code-block'], 
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                ],
                handlers: {
                    'video': videoHandler,
                    'code-block': htmlEditHandler,
                    'divider': hrHandler,
                    'image': function() {
                        const input = document.createElement('input');
                        input.setAttribute('type', 'file');
                        input.setAttribute('accept', 'image/*');
                        input.click();

                        input.onchange = async () => {
                            const file = input.files[0];
                            if (!file) return;

                            // 로딩 표시 (임시)
                            const range = this.quill.getSelection(true);
                            
                            try {
                                // 1. Supabase Storage에 자동 업로드 (파일명 ASCII 안전화)
                                const path = _safeStoragePath('products/detail', file);
                                
                                // global_config.js에서 가져온 sb 객체 사용
                                const { data, error } = await sb.storage.from('products').upload(path, file);
                                if (error) throw error;

                                // 2. 업로드된 이미지의 공용 URL 가져오기
                                const { data: urlData } = sb.storage.from('products').getPublicUrl(path);
                                const publicUrl = urlData.publicUrl;

                                // 3. 에디터에 Base64가 아닌 짧은 URL 주소로 이미지 삽입
                                this.quill.insertEmbed(range.index, 'image', publicUrl);
                                this.quill.setSelection(range.index + 1);
                                
                            } catch (err) {
                                console.error("자동 업로드 실패:", err);
                                showToast(_t('err_img_upload_error','Image upload error. Check file size or network.'), "error");
                            }
                        };
                    }
                }
            }
        },
        theme: 'snow',
        placeholder: '내용을 입력하세요...'
    });
    // [추가] 복사+붙여넣기로 들어오는 Base64 이미지 자동 차단 및 안내
    popupQuill.clipboard.addMatcher('img', (node, delta) => {
        let ops = delta.ops.map(op => {
            if (op.insert && op.insert.image && op.insert.image.startsWith('data:')) {
                showToast(_t('err_paste_image','Please use the image button instead of copy+paste to upload images.'), "warn");
                return { insert: '' }; // 이미지 삽입 무효화
            }
            return op;
        });
        return { ops: ops };
    });

    // 아이콘 커스터마이징
    const codeBtn = document.querySelector('.ql-code-block');
    if(codeBtn) { codeBtn.innerHTML = '<i class="fa-solid fa-code" style="font-weight:bold;"></i>'; codeBtn.title = "HTML 소스 편집"; }
    const divBtn = document.querySelector('.ql-divider');
    if(divBtn) { divBtn.innerHTML = '<b>―</b>'; divBtn.title = "구분선 넣기"; }
};
// ==========================================
// [통합] 상세페이지 편집기 (공통정보 + 소분류 + 제품 상세)
// ==========================================
let _ciCurrentLang = 'KR';
let _ciBackupData = null;
let _ciEditMode = 'common'; // 'common' or 'product'
let _ciEditProductId = null;
let _ciImages = []; // [{file, preview, url}]
let _ciSourceMode = false; // false=preview, true=source

// 이미지 추가
window._ciAddImages = (files) => {
    if (!files || !files.length) return;
    Array.from(files).forEach(file => {
        if (_ciImages.length >= 20) return;
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            _ciImages.push({ file, preview: e.target.result, url: null });
            _ciRenderImgGrid();
        };
        reader.readAsDataURL(file);
    });
};
window._ciRemoveImage = (idx) => {
    _ciImages.splice(idx, 1);
    _ciRenderImgGrid();
};
function _ciRenderImgGrid() {
    const grid = document.getElementById('ciImgGrid');
    grid.innerHTML = _ciImages.map((img, i) => `
        <div class="ci-img-card">
            <img src="${img.preview}" alt="img${i}">
            <button class="ci-rm" onclick="event.stopPropagation(); window._ciRemoveImage(${i});">&times;</button>
        </div>
    `).join('');
}

// 초기화
window._ciReset = () => {
    _ciImages = [];
    _ciRenderImgGrid();
    const desc = document.getElementById('ciDescription');
    if (desc) desc.value = '';
    ['KR','JP','US','CN','AR','ES','DE','FR'].forEach(l => { document.getElementById('ciHtml'+l).value = ''; });
    _ciRenderPreview('');
    _ciSourceMode = false;
    document.getElementById('ciPreviewSection').style.display = 'none';
    document.getElementById('ciSaveSection').style.display = 'none';
    document.getElementById('ciStatus').textContent = '';
    showToast('초기화되었습니다.', 'info');
};

window.openCommonInfoModal = async () => {
    const dbClient = window.sb || window._supabase;
    if (!dbClient) { showToast('DB 연결 실패', 'error'); return; }
    document.getElementById('commonInfoModal').style.display = 'flex';

    // 대분류 로드 (DB에서)
    const topSel = document.getElementById('ciTopCat');
    if (topSel.options.length <= 1) {
        const { data: cats } = await dbClient.from('admin_top_categories').select('code, name').order('sort_order');
        if (cats) {
            cats.forEach(c => {
                const o = document.createElement('option');
                o.value = c.code; o.textContent = c.name;
                topSel.appendChild(o);
            });
        }
    }
    document.getElementById('ciSubCat').innerHTML = '<option value="">-- 소분류 선택 --</option>';
    document.getElementById('ciSubCat').disabled = true;
    document.getElementById('ciProduct').innerHTML = '<option value="">-- 제품 선택 --</option>';
    document.getElementById('ciProduct').disabled = true;
    topSel.value = 'all';
    _ciGetTarget();
};

window._ciLoadSubCats = async () => {
    const dbClient = window.sb || window._supabase;
    const topCode = document.getElementById('ciTopCat').value;
    const subSel = document.getElementById('ciSubCat');
    const prodSel = document.getElementById('ciProduct');
    subSel.innerHTML = '<option value="">-- 소분류 선택 --</option>';
    prodSel.innerHTML = '<option value="">-- 제품 선택 --</option>';
    prodSel.disabled = true;

    if (topCode === 'all') {
        subSel.disabled = true;
        _ciGetTarget();
        window._ciLoadContent();
        return;
    }
    subSel.disabled = false;
    const { data } = await dbClient.from('admin_categories').select('code, name').eq('top_category_code', topCode).order('sort_order');
    (data || []).forEach(c => {
        subSel.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });
    _ciGetTarget();
    window._ciLoadContent();
};

window._ciLoadProducts = async () => {
    const dbClient = window.sb || window._supabase;
    const subCode = document.getElementById('ciSubCat').value;
    const prodSel = document.getElementById('ciProduct');
    prodSel.innerHTML = '<option value="">-- 제품 선택 --</option>';

    if (!subCode) {
        prodSel.disabled = true;
        _ciGetTarget();
        window._ciLoadContent();
        return;
    }
    prodSel.disabled = false;
    const { data } = await dbClient.from('admin_products').select('id, code, name').eq('category', subCode).order('name');
    (data || []).forEach(p => {
        prodSel.innerHTML += `<option value="${p.id}">${p.name} (${p.code})</option>`;
    });
    _ciGetTarget();
    window._ciLoadContent();
};

// 현재 선택된 레벨과 코드 결정
function _ciGetTarget() {
    const topSel = document.getElementById('ciTopCat');
    const subSel = document.getElementById('ciSubCat');
    const prodSel = document.getElementById('ciProduct');
    const top = topSel.value;
    const sub = subSel.value;
    const prod = prodSel.value;
    const badge = document.getElementById('ciLevelBadge');

    // 드롭다운 텍스트에서 실제 이름 추출
    const topName = topSel.selectedOptions[0]?.textContent || '';
    const subName = subSel.selectedOptions[0]?.textContent || '';
    const prodName = prodSel.selectedOptions[0]?.textContent?.replace(/\s*\(.*\)\s*$/, '') || '';

    if (prod) {
        badge.textContent = '제품 상세';
        badge.style.background = '#059669';
        return { mode: 'product', id: prod, label: '제품 상세', name: prodName, categoryName: subName, topCategoryName: topName };
    }
    if (sub) {
        badge.textContent = '소분류 공통';
        badge.style.background = '#d97706';
        return { mode: 'common', code: sub, label: '소분류 공통', name: subName, topCategoryName: topName };
    }
    if (top && top !== 'all') {
        badge.textContent = '대분류 공통';
        badge.style.background = '#2563eb';
        return { mode: 'common', code: top, label: '대분류 공통', name: topName };
    }
    badge.textContent = '전체 공통';
    badge.style.background = '#7c3aed';
    return { mode: 'common', code: 'all', label: '전체 공통', name: '카멜레온 프린팅 전체 상품' };
}

window._ciLoadContent = async () => {
    const dbClient = window.sb || window._supabase;
    const target = _ciGetTarget();
    _ciCurrentLang = 'KR';
    ['KR','JP','US','CN','AR','ES','DE','FR'].forEach(l => { document.getElementById('ciHtml'+l).value = ''; });

    // ★ 대상 전환 시 미리보기/저장 영역 리셋 (빈 상태에서 저장 방지)
    document.getElementById('ciPreviewSection').style.display = 'none';
    document.getElementById('ciSaveSection').style.display = 'none';
    document.getElementById('ciStatus').textContent = '';

    if (target.mode === 'product') {
        _ciEditMode = 'product';
        _ciEditProductId = target.id;
        const { data } = await dbClient.from('admin_products').select('*').eq('id', target.id).single();
        if (data) {
            document.getElementById('ciHtmlKR').value = data.description || '';
            document.getElementById('ciHtmlJP').value = data.description_jp || '';
            document.getElementById('ciHtmlUS').value = data.description_us || '';
            document.getElementById('ciHtmlCN').value = data.description_cn || '';
            document.getElementById('ciHtmlAR').value = data.description_ar || '';
            document.getElementById('ciHtmlES').value = data.description_es || '';
            document.getElementById('ciHtmlDE').value = data.description_de || '';
            document.getElementById('ciHtmlFR').value = data.description_fr || '';
        }
        _ciBackupData = null;
    } else {
        _ciEditMode = 'common';
        _ciEditProductId = null;
        const { data } = await dbClient.from('common_info').select('*')
            .eq('section', 'top').eq('category_code', target.code).maybeSingle();
        if (data) {
            document.getElementById('ciHtmlKR').value = data.content || '';
            document.getElementById('ciHtmlJP').value = data.content_jp || '';
            document.getElementById('ciHtmlUS').value = data.content_us || '';
            document.getElementById('ciHtmlCN').value = data.content_cn || '';
            document.getElementById('ciHtmlAR').value = data.content_ar || '';
            document.getElementById('ciHtmlES').value = data.content_es || '';
            document.getElementById('ciHtmlDE').value = data.content_de || '';
            document.getElementById('ciHtmlFR').value = data.content_fr || '';
            _ciBackupData = (data.content_backup || data.content_backup_jp) ? data : null;
        } else {
            _ciBackupData = null;
        }
    }
    // 기존 내용 상태 표시
    const krHtml = document.getElementById('ciHtmlKR').value;
    const statusBox = document.getElementById('ciExistingStatus');
    if (statusBox) {
        const langs = [];
        if (document.getElementById('ciHtmlKR').value) langs.push('🇰🇷');
        if (document.getElementById('ciHtmlJP').value) langs.push('🇯🇵');
        if (document.getElementById('ciHtmlUS').value) langs.push('🇺🇸');
        if (document.getElementById('ciHtmlCN').value) langs.push('🇨🇳');
        if (document.getElementById('ciHtmlAR').value) langs.push('🇸🇦');
        if (document.getElementById('ciHtmlES').value) langs.push('🇪🇸');
        if (document.getElementById('ciHtmlDE').value) langs.push('🇩🇪');
        if (document.getElementById('ciHtmlFR').value) langs.push('🇫🇷');
        if (langs.length > 0) {
            statusBox.style.display = 'block';
            document.getElementById('ciExistingLangs').textContent = langs.join(' ');
        } else {
            statusBox.style.display = 'none';
        }
    }
    if (krHtml && krHtml.length > 10) {
        _ciShowPreview(krHtml);
    }
};

// iframe에 HTML 렌더링
function _ciRenderPreview(html) {
    const frame = document.getElementById('ciPreviewFrame');
    if (!frame) return;
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;} img{max-width:100%;height:auto;}</style></head><body>${html || '<p style="padding:40px;text-align:center;color:#999;">내용이 없습니다</p>'}</body></html>`);
    doc.close();
    // iframe 높이 자동 조절
    setTimeout(() => {
        try {
            const h = doc.body.scrollHeight;
            frame.style.height = Math.max(h + 20, 300) + 'px';
        } catch(e) {}
    }, 200);
}

// 미리보기 표시
function _ciShowPreview(html) {
    const previewSec = document.getElementById('ciPreviewSection');
    const saveSec = document.getElementById('ciSaveSection');
    previewSec.style.display = 'block';
    saveSec.style.display = 'block';

    _ciCurrentLang = 'KR';
    document.querySelectorAll('.ci-lang-tab').forEach(t => t.classList.remove('active'));
    const krTab = document.querySelector('.ci-lang-tab[data-lang="KR"]');
    if (krTab) krTab.classList.add('active');

    // 소스 모드 초기화
    _ciSourceMode = false;
    document.getElementById('ciPreviewView').style.display = 'block';
    document.getElementById('ciSourceView').style.display = 'none';
    const toggleBtn = document.getElementById('ciViewToggle');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-code"></i> 소스 편집';

    _ciRenderPreview(html);
    previewSec.scrollIntoView({ behavior: 'smooth' });
}

// 소스/미리보기 토글
window._ciToggleView = () => {
    const previewView = document.getElementById('ciPreviewView');
    const sourceView = document.getElementById('ciSourceView');
    const toggleBtn = document.getElementById('ciViewToggle');
    const sourceEditor = document.getElementById('ciSourceEditor');

    if (_ciSourceMode) {
        // 소스 → 미리보기: 소스 내용을 hidden field에 저장 후 미리보기
        const editedHtml = sourceEditor.value;
        document.getElementById('ciHtml' + _ciCurrentLang).value = editedHtml;
        _ciRenderPreview(editedHtml);
        previewView.style.display = 'block';
        sourceView.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fa-solid fa-code"></i> 소스 편집';
        _ciSourceMode = false;
    } else {
        // 미리보기 → 소스: hidden field 내용을 textarea에 표시
        const html = document.getElementById('ciHtml' + _ciCurrentLang).value;
        sourceEditor.value = html;
        previewView.style.display = 'none';
        sourceView.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> 미리보기';
        _ciSourceMode = true;
    }
};

// 소스 적용 버튼
window._ciApplySource = () => {
    const sourceEditor = document.getElementById('ciSourceEditor');
    const html = sourceEditor.value;
    document.getElementById('ciHtml' + _ciCurrentLang).value = html;
    _ciRenderPreview(html);
    document.getElementById('ciPreviewView').style.display = 'block';
    document.getElementById('ciSourceView').style.display = 'none';
    document.getElementById('ciViewToggle').innerHTML = '<i class="fa-solid fa-code"></i> 소스 편집';
    _ciSourceMode = false;
    showToast('소스 적용 완료', 'success');
};

// 언어 탭 전환
window._ciSwitchLang = (lang) => {
    // 소스 모드이면 현재 소스 저장
    if (_ciSourceMode) {
        const sourceEditor = document.getElementById('ciSourceEditor');
        document.getElementById('ciHtml' + _ciCurrentLang).value = sourceEditor.value;
    }

    _ciCurrentLang = lang;
    const saved = document.getElementById('ciHtml' + lang).value || '';

    if (_ciSourceMode) {
        document.getElementById('ciSourceEditor').value = saved;
    } else {
        _ciRenderPreview(saved);
    }

    document.querySelectorAll('.ci-lang-tab').forEach(t => t.classList.remove('active'));
    const target = document.querySelector(`.ci-lang-tab[data-lang="${lang}"]`);
    if (target) target.classList.add('active');
};

// AI 생성 + 번역
window._ciGenerate = async () => {
    const dbClient = window.sb || window._supabase;
    const target = _ciGetTarget();
    const descText = document.getElementById('ciDescription').value.trim();
    const status = document.getElementById('ciStatus');
    const btn = document.getElementById('ciGenerateBtn');

    if (!descText && _ciImages.length === 0) {
        showToast('사진을 올리거나 내용을 입력해주세요.', 'warn');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...';

    try {
        // 1단계: 이미지 업로드
        let imageUrls = [];
        if (_ciImages.length > 0) {
            status.textContent = '📤 이미지 업로드 중...';
            const timestamp = Date.now();
            await Promise.all(_ciImages.map(async (img, i) => {
                if (img.url) return;
                const resp = await fetch(img.preview);
                const blob = await resp.blob();
                const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
                const path = `common/${timestamp}_${i}.${ext}`;
                const { error } = await dbClient.storage.from('products').upload(path, blob, { contentType: blob.type });
                if (error) throw new Error('이미지 업로드 실패: ' + error.message);
                const { data: urlData } = dbClient.storage.from('products').getPublicUrl(path);
                img.url = urlData.publicUrl;
            }));
            imageUrls = _ciImages.map(img => img.url);
        }

        // 2단계: AI 상세페이지 생성 (한국어)
        status.textContent = '🤖 AI가 상세페이지를 생성 중... (약 30초)';

        // 실제 카테고리/제품 이름 사용
        const productName = target.name || '상품';
        const categoryName = target.categoryName || target.topCategoryName || target.name || '';

        // 기존 내용이 있으면 AI에 전달하여 참고하도록
        const existingKrHtml = document.getElementById('ciHtmlKR').value || '';

        console.log('[CI] AI 생성 요청:', { productName, categoryName, imageUrls: imageUrls.length, descText: descText.substring(0, 50), existingContent: existingKrHtml.length });

        const { data, error } = await dbClient.functions.invoke('generate-product-detail', {
            body: {
                product_name: productName,
                product_category: categoryName,
                image_urls: imageUrls,
                image_url: imageUrls[0] || '',
                reference_text: descText,
                original_description: existingKrHtml || '',
                price: 0,
                mode: 'wizard',
                langs: ["kr", "jp", "us", "cn", "ar", "es", "de", "fr"]
            }
        });

        if (error) throw new Error(error.message);
        console.log('[CI] AI 응답:', { success: data?.success, hasKr: !!data?.details?.kr, krLen: data?.details?.kr?.length, errors: data?.errors });
        if (!data || !data.success) throw new Error((data && data.error) || '생성 실패');

        const krHtml = data.details?.kr;
        if (!krHtml) throw new Error('한국어 생성 실패 (AI가 빈 결과 반환)');

        document.getElementById('ciHtmlKR').value = krHtml;

        // 한국어만 생성 완료 — 번역은 별도 버튼으로
        status.textContent = '✅ 한국어 상세페이지 생성 완료! 검토 후 [7개국어 번역만] 버튼을 눌러주세요.';
        _ciShowPreview(krHtml);
        showToast('한국어 상세페이지 생성 완료! 검토 후 번역하세요.', 'success');

    } catch(e) {
        console.error('CI Generate error:', e);
        status.textContent = '❌ 실패: ' + e.message;

        // 사진만 있고 AI 생성이 안될 때 → 사진 그리드 HTML 직접 생성
        if (_ciImages.length > 0) {
            const imageUrls = _ciImages.filter(img => img.url).map(img => img.url);
            if (imageUrls.length > 0) {
                let fallbackHtml = descText ? `<p>${descText}</p>` : '';
                fallbackHtml += imageUrls.map(u => `<p><img src="${u}" style="max-width:100%;"></p>`).join('');
                document.getElementById('ciHtmlKR').value = fallbackHtml;
                _ciShowPreview(fallbackHtml);
                status.textContent = '⚠ AI 생성 실패 → 사진+텍스트로 기본 페이지 생성됨';
            }
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-robot"></i> AI 한국어 상세페이지 생성';
    }
};

// 한국어 → 7개국어 번역만 (AI 재생성 없이)
window._ciTranslateOnly = async () => {
    const dbClient = window.sb || window._supabase;
    const status = document.getElementById('ciStatus');
    const btn = document.getElementById('ciTranslateOnlyBtn');

    // 소스 편집 중이면 현재 내용 저장
    if (_ciSourceMode) {
        document.getElementById('ciHtml' + _ciCurrentLang).value = document.getElementById('ciSourceEditor').value;
    }

    const krHtml = document.getElementById('ciHtmlKR').value;
    if (!krHtml || krHtml.length < 10) {
        showToast('번역할 한국어 내용이 없습니다. 먼저 AI 생성 또는 직접 작성해주세요.', 'warn');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    status.textContent = '🌐 Claude AI 7개국어 번역 중... (0/7)';

    try {
        const langMap = { ja: 'JP', en: 'US', zh: 'CN', ar: 'AR', es: 'ES', de: 'DE', fr: 'FR' };
        const langs = ['ja','en','zh','ar','es','de','fr'];
        let trCount = 0;
        // 순차 번역 (병렬 시 API rate limit으로 일부 실패 방지)
        for (const lang of langs) {
            try {
                const { data: trData, error: trError } = await dbClient.functions.invoke('translate', {
                    body: { text: krHtml, from: 'ko', to: lang, html: true }
                });
                if (!trError && trData?.translated) {
                    document.getElementById('ciHtml' + langMap[lang]).value = trData.translated;
                } else {
                    console.warn(`[CI] 번역 실패 (${lang}):`, trError);
                }
            } catch(e) { console.error(`[CI] 번역 예외 (${lang}):`, e); }
            trCount++;
            status.textContent = `🌐 Claude AI 7개국어 번역 중... (${trCount}/7)`;
        }
        status.textContent = '✅ 7개국어 번역 완료!';
        showToast('Claude AI 7개국어 번역 완료! 탭을 눌러 확인하세요.', 'success');

        // 미리보기가 아직 없으면 표시
        if (document.getElementById('ciPreviewSection').style.display === 'none') {
            _ciShowPreview(krHtml);
        }
    } catch(e) {
        console.error('Translate only error:', e);
        status.textContent = '❌ 번역 실패: ' + (e.message || e);
        showToast('번역 실패: ' + (e.message || e), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-language"></i> 한국어 → 7개국어 번역만';
    }
};

window._ciSave = async () => {
    const dbClient = window.sb || window._supabase;
    const target = _ciGetTarget();

    // 소스 편집 중이면 현재 내용 저장
    if (_ciSourceMode) {
        document.getElementById('ciHtml' + _ciCurrentLang).value = document.getElementById('ciSourceEditor').value;
    }

    if (!confirm(`[${target.label}] 상세정보를 저장하시겠습니까?`)) return;

    const kr = document.getElementById('ciHtmlKR').value;
    const jp = document.getElementById('ciHtmlJP').value;
    const us = document.getElementById('ciHtmlUS').value;
    const cn = document.getElementById('ciHtmlCN').value;
    const ar = document.getElementById('ciHtmlAR').value;
    const es = document.getElementById('ciHtmlES').value;
    const de = document.getElementById('ciHtmlDE').value;
    const fr = document.getElementById('ciHtmlFR').value;

    if (target.mode === 'product') {
        const { error } = await dbClient.from('admin_products').update({
            description: kr, description_jp: jp, description_us: us, description_cn: cn,
            description_ar: ar, description_es: es, description_de: de, description_fr: fr
        }).eq('id', target.id);
        if (error) showToast('저장 실패: ' + error.message, 'error');
        else showToast('제품 상세페이지 저장 완료!', 'success');
    } else {
        // ★ 빈 내용으로 공통페이지 덮어쓰기 방지
        if (!kr && !jp && !us && !cn && !ar && !es && !de && !fr) {
            showToast('저장할 내용이 없습니다. 먼저 AI 생성 또는 직접 작성해주세요.', 'warn');
            return;
        }
        const { data: oldData } = await dbClient.from('common_info')
            .select('*').eq('section', 'top').eq('category_code', target.code).maybeSingle();
        const payload = {
            section: 'top', category_code: target.code,
            content: kr, content_jp: jp, content_us: us, content_cn: cn,
            content_ar: ar, content_es: es, content_de: de, content_fr: fr,
            content_backup: oldData ? oldData.content : null,
            content_backup_jp: oldData ? oldData.content_jp : null,
            content_backup_us: oldData ? oldData.content_us : null,
            content_backup_cn: oldData ? oldData.content_cn : null,
            content_backup_ar: oldData ? oldData.content_ar : null,
            content_backup_es: oldData ? oldData.content_es : null
        };
        const { error } = await dbClient.from('common_info').upsert(payload, { onConflict: 'section, category_code' });
        if (error) showToast('저장 실패: ' + error.message, 'error');
        else showToast('저장 및 백업 완료!', 'success');
    }
};

window._ciRestoreBackup = () => {
    if (!_ciBackupData) return;
    if (!confirm('이전 백업으로 복원하시겠습니까?')) return;
    document.getElementById('ciHtmlKR').value = _ciBackupData.content_backup || '';
    document.getElementById('ciHtmlJP').value = _ciBackupData.content_backup_jp || '';
    document.getElementById('ciHtmlUS').value = _ciBackupData.content_backup_us || '';
    document.getElementById('ciHtmlCN').value = _ciBackupData.content_backup_cn || '';
    document.getElementById('ciHtmlAR').value = _ciBackupData.content_backup_ar || '';
    document.getElementById('ciHtmlES').value = _ciBackupData.content_backup_es || '';
    document.getElementById('ciHtmlDE').value = _ciBackupData.content_backup_de || '';
    document.getElementById('ciHtmlFR').value = _ciBackupData.content_backup_fr || '';
    _ciShowPreview(_ciBackupData.content_backup || '');
    showToast('백업 불러옴. [저장 및 적용]을 눌러 확정하세요.', 'info');
};

// 기존 내용 미리보기 버튼
window._ciPreviewExisting = () => {
    const krHtml = document.getElementById('ciHtmlKR').value;
    if (krHtml) _ciShowPreview(krHtml);
    else showToast('미리볼 내용이 없습니다.', 'info');
};

// 기존 내용 삭제
window._ciDelete = async () => {
    const dbClient = window.sb || window._supabase;
    const target = _ciGetTarget();
    if (!confirm(`[${target.label}] "${target.name}" 의 상세정보를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    if (target.mode === 'product') {
        const { error } = await dbClient.from('admin_products').update({
            description: null, description_jp: null, description_us: null, description_cn: null,
            description_ar: null, description_es: null, description_de: null, description_fr: null
        }).eq('id', target.id);
        if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
        showToast('제품 상세페이지 삭제 완료!', 'success');
    } else {
        const { error } = await dbClient.from('common_info')
            .delete().eq('section', 'top').eq('category_code', target.code);
        if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
        showToast('공통 정보 삭제 완료!', 'success');
    }
    // 입력 필드 초기화
    ['KR','JP','US','CN','AR','ES','DE','FR'].forEach(l => { document.getElementById('ciHtml'+l).value = ''; });
    const statusBox = document.getElementById('ciExistingStatus');
    if (statusBox) statusBox.style.display = 'none';
    document.getElementById('ciPreviewSection').style.display = 'none';
    document.getElementById('ciSaveSection').style.display = 'none';
};

// 기존 호환용 - old functions redirect
window.loadCommonInfoContent = (code) => { document.getElementById('ciTopCat').value = code; _ciLoadContent(); };
window.saveCommonInfo = () => { _ciSave(); };
window.restoreCommonInfo = () => { _ciRestoreBackup(); };

window.openDetailPageEditor = () => {
    window.initPopupQuill();
    document.getElementById('detailEditorModal').style.display = 'flex';
    currentPopupLang = 'KR';
    const krData = document.getElementById('newProdDetailKR').value;
    popupQuill.root.innerHTML = (krData === "" || krData === "<p><br></p>") ? "" : krData;
    document.querySelectorAll('.pop-editor-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tabKR').classList.add('active');
};

window.switchPopupLang = (lang) => {
    const currentContent = popupQuill.root.innerHTML;
    if (currentContent !== "<p><br></p>") {
        document.getElementById(`newProdDetail${currentPopupLang}`).value = currentContent;
    }
    currentPopupLang = lang;
    const savedData = document.getElementById(`newProdDetail${lang}`).value;
    popupQuill.root.innerHTML = (savedData === "" || savedData === "<p><br></p>") ? "" : savedData;
    document.querySelectorAll('.pop-editor-tab').forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById(`tab${lang}`);
    if (targetTab) targetTab.classList.add('active');
};

window.saveDetailAndClose = () => {
    document.getElementById(`newProdDetail${currentPopupLang}`).value = popupQuill.root.innerHTML;
    document.getElementById('detailEditorModal').style.display = 'none';
    showToast("상세페이지가 임시 저장되었습니다.\n최종 등록을 위해 [수정사항 저장] 버튼을 꼭 눌러주세요.", "info");
};

window.autoTranslatePopupDetail = async () => {
    const sourceHtml = popupQuill.root.innerHTML;
    if(!sourceHtml || sourceHtml === "<p><br></p>") { showToast("번역할 한국어 내용이 없습니다.", "warn"); return; }
    if(!confirm("한국어 본문을 Claude AI로 7개국어 번역합니다. 진행하시겠습니까?")) return;

    const btn = document.querySelector('button[onclick*="autoTranslatePopupDetail"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Claude AI 번역 중...';
    btn.disabled = true;

    try {
        const dbClient = window.sb || window._supabase;
        const { data, error } = await dbClient.functions.invoke('translate', {
            body: { text: sourceHtml, sourceLang: 'ko', targetLangs: ['ja','en','zh','ar','es','de','fr'], html: true }
        });
        if (error) throw error;
        const tr = data?.translations || {};
        if (tr.ja) document.getElementById('newProdDetailJP').value = tr.ja;
        if (tr.en) document.getElementById('newProdDetailUS').value = tr.en;
        if (tr.zh) document.getElementById('newProdDetailCN').value = tr.zh;
        if (tr.ar) document.getElementById('newProdDetailAR').value = tr.ar;
        if (tr.es) document.getElementById('newProdDetailES').value = tr.es;
        if (tr.de) document.getElementById('newProdDetailDE').value = tr.de;
        if (tr.fr) document.getElementById('newProdDetailFR').value = tr.fr;
        showToast("Claude AI 7개국 번역 완료! 탭을 넘겨 확인하세요.", "success");
    } catch(e) {
        console.error(e);
        showToast("번역 중 오류 발생: " + (e.message || e), "error");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

// [최종 수정] DB 연결 체크 기능이 추가된 옵션 로드 함수
// [최종 수정] index.html 내부의 함수 교체용
window.loadProductOptionsFront = async (addonCodesStr) => {
    const area = document.getElementById('productOptionsArea'); 
    if (!area) return;
    area.innerHTML = '';

    // [1] DB 연결 객체 찾기 (안전장치)
    let dbClient = window.sb; 
    if (!dbClient && typeof sb !== 'undefined') dbClient = sb;

    // [2] 연결 안 되어 있으면 0.3초 뒤에 재시도 (에러 방지 핵심)
    if (!dbClient) {
        console.warn("⏳ DB 연결 대기중...");
        setTimeout(() => window.loadProductOptionsFront(addonCodesStr), 300);
        return;
    }

    if (!addonCodesStr || addonCodesStr.trim() === '') {
        area.innerHTML = '<div style="color:#94a3b8; font-size:13px; text-align:center; padding:20px;">선택 가능한 옵션이 없습니다.</div>';
        return;
    }

    const codes = addonCodesStr.split(',').map(c => c.trim()).filter(c => c);
    
    // [3] 데이터 가져오기 (순서 정렬 포함)
    const { data, error } = await dbClient
        .from('admin_addons')
        .select('*')
        .in('code', codes)
        .order('sort_order', {ascending: true}); 
    
    if (error || !data || data.length === 0) return;

    area.innerHTML = '<div style="font-weight:800; margin-bottom:12px; font-size:14px; color:#1e293b; padding-left:5px;">🎁 추가 옵션 선택</div>';
    
    // [4] 디자인 그릇 만들기
    const swatchContainer = document.createElement('div');
    swatchContainer.style.cssText = "display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;";
    
    const listContainer = document.createElement('div');
    listContainer.style.cssText = "display:flex; flex-direction:column; gap:8px;";

    // [5] 스와치 vs 리스트 분류하여 담기
    data.forEach(addon => {
        const priceTag = addon.price > 0 ? `+${addon.price.toLocaleString()}원` : '';

        // (A) 스와치 모드인 경우 (DB의 is_swatch 값을 확인)
        if (addon.is_swatch) {
            const label = document.createElement('label');
            label.className = 'swatch-item';
            label.style.cssText = `
                position: relative; cursor: pointer; width: 50px; height: 50px; 
                border-radius: 8px; border: 2px solid #e2e8f0; overflow: hidden;
                background-image: url('${addon.img_url}'); background-size: cover; background-position: center;
                transition: 0.2s; box-sizing: border-box; background-color: #f8fafc;
            `;
            label.title = `${addon.name_kr || addon.name} (${priceTag})`;

            label.innerHTML = `
                <input type="checkbox" name="userOption" value="${addon.code}" data-price="${addon.price}" 
                    style="position:absolute; opacity:0; width:0; height:0;">
                <div class="check-overlay" style="position:absolute; inset:0; background:rgba(99,102,241,0.5); display:none; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-check" style="color:white; font-size:20px;"></i>
                </div>
            `;
            
            const input = label.querySelector('input');
            const overlay = label.querySelector('.check-overlay');
            
            input.addEventListener('change', () => {
                if(input.checked) {
                    label.style.borderColor = '#6366f1';
                    overlay.style.display = 'flex';
                } else {
                    label.style.borderColor = '#e2e8f0';
                    overlay.style.display = 'none';
                }
                // (중요) 모달의 총 금액 업데이트 함수 호출
                if(window.updateModalTotal) window.updateModalTotal();
            });
            swatchContainer.appendChild(label);
        } 
        // (B) 일반 리스트 모드인 경우
        else {
            const itemLabel = document.createElement('label');
            itemLabel.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; cursor:pointer; transition:0.2s; font-size:13px; box-shadow:0 2px 4px rgba(0,0,0,0.02);";
            
            itemLabel.onmouseover = () => { itemLabel.style.borderColor = "#6366f1"; itemLabel.style.background = "#f5f3ff"; };
            itemLabel.onmouseout = () => { 
                const chk = itemLabel.querySelector('input');
                if(!chk.checked) { itemLabel.style.borderColor = "#e2e8f0"; itemLabel.style.background = "#fff"; }
            };

            itemLabel.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <input type="checkbox" name="userOption" value="${addon.code}" data-price="${addon.price}" style="width:18px; height:18px; accent-color:#6366f1; cursor:pointer;">
                    ${addon.img_url ? `<img src="${addon.img_url}" style="width:30px; height:30px; border-radius:4px; object-fit:cover;">` : ''}
                    <span style="font-weight:600; color:#334155;">${addon.name_kr || addon.name}</span>
                </div>
                <span style="color:#6366f1; font-weight:800; font-size:14px;">${priceTag}</span>
            `;
            
            const input = itemLabel.querySelector('input');
            input.addEventListener('change', () => {
                itemLabel.style.borderColor = input.checked ? "#6366f1" : "#e2e8f0";
                itemLabel.style.background = input.checked ? "#f5f3ff" : "#fff";
                // (중요) 모달의 총 금액 업데이트 함수 호출
                if(window.updateModalTotal) window.updateModalTotal();
            });
            listContainer.appendChild(itemLabel);
        }
    });

    if(swatchContainer.children.length > 0) area.appendChild(swatchContainer);
    if(listContainer.children.length > 0) area.appendChild(listContainer);
};

window.resetAllGeneralProducts = async () => {
    if (!confirm("⚠️ 정말로 모든 상품의 [에디터 없이 장바구니] 설정을 해제하시겠습니까?\n\n모든 상품이 다시 '디자인 에디터' 모드로 작동하게 됩니다.")) return;

    const btn = document.getElementById('btnEmergencyReset');
    const originalText = btn ? btn.innerText : '';
    if(btn) btn.innerText = "처리 중...";

    try {
        const { error } = await sb
            .from('admin_products')
            .update({ is_general_product: false })
            .eq('is_general_product', true);

        if (error) throw error;

        showToast("완료되었습니다! 모든 상품이 정상적으로 복구되었습니다.", "success");
        
        if (window.filterProductList) window.filterProductList();

    } catch (e) {
        console.error(e);
        showToast("오류 발생: " + e.message, "error");
    } finally {
        if(btn) btn.innerText = originalText;
    }
};
// [긴급 복구] 영어/일본어 내용을 기반으로 -> 이미지 제거 후 -> 한국어로 복구
window.recoverDescription = async () => {
    if (!confirm("⚠️ 주의: 한국어 상세페이지가 비어있는 상품들을 복구합니다.\n\n1. 영어(없으면 일본어) 내용을 가져옵니다.\n2. 이미지(Base64)는 모두 제거합니다.\n3. 텍스트를 한국어로 번역해 저장합니다.\n\n진행하시겠습니까?")) return;

    const btn = document.getElementById('btnProductSave'); // 로딩 표시용 버튼 아무거나
    if(btn) btn.innerText = "복구 중... (콘솔 확인)";

    try {
        // 1. 전체 상품 가져오기
        const { data: products, error } = await sb.from('admin_products').select('id, description, description_us, description_jp');
        if (error) throw error;

        let count = 0;

        // 2. 하나씩 검사하며 복구
        for (let p of products) {
            // 한국어 설명이 비어있고, 외국어 설명은 있는 경우만 타겟
            if ((!p.description || p.description.trim() === '') && (p.description_us || p.description_jp)) {
                
                // 소스 선택 (영어가 있으면 영어, 없으면 일본어)
                let sourceHtml = p.description_us || p.description_jp;
                let sourceLang = p.description_us ? 'en' : 'ja';

                // [중요] HTML에서 <img> 태그만 싹 제거하기 (Base64 삭제)
                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = sourceHtml;
                const images = tempDiv.getElementsByTagName('img');
                while(images.length > 0){
                    images[0].parentNode.removeChild(images[0]);
                }
                
                // 이미지가 제거된 텍스트만 추출
                let cleanText = tempDiv.innerHTML;

                // 내용이 너무 짧으면 패스
                if (cleanText.trim().length < 2) continue;

                // 3. 한국어로 역번역 (전용 번역 함수 사용)
                let translatedText = await translateToKR(cleanText, sourceLang);

                // 4. 복구된 내용 저장 (안내 문구 추가)
                const finalHtml = `<p style="color:blue;">[시스템 복구됨]</p>` + translatedText;

                await sb.from('admin_products').update({ description: finalHtml }).eq('id', p.id);
                
                count++;
            }
        }

        showToast(`총 ${count}개의 상품 상세페이지가 복구되었습니다!`, "success");
        location.reload(); // 새로고침

    } catch (e) {
        console.error(e);
        showToast("복구 중 오류 발생: " + e.message, "error");
    }
};

// [보조] 한국어로 번역하는 전용 함수
async function translateToKR(text, sourceLang) {
    try {
        // HTML 태그를 유지하면서 번역하기 위해 간단한 처리 (완벽하진 않음)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data[0].map(x => x[0]).join('');
    } catch (e) {
        console.error("번역 실패:", e);
        return text; // 실패하면 원문 그대로 반환
    }
}

// ==========================================
// AI 상품 수집기 (경쟁사 크롤링)
// ==========================================

let crawledProduct = null;
let crawledDetailHtml = {};

// [1] 크롤링 시작
window.startProductCrawl = async () => {
    const url = document.getElementById('crawlUrl').value.trim();
    if (!url) { showToast("URL을 입력해주세요.", "warn"); return; }
    if (!url.startsWith('http')) { showToast("올바른 URL을 입력해주세요 (https://...)", "warn"); return; }

    const btn = document.getElementById('btnCrawlStart');
    const status = document.getElementById('crawlStatus');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 수집 중...';
    status.textContent = 'HTML 가져오는 중... AI가 분석합니다 (약 10~20초)';

    try {
        const { data, error } = await sb.functions.invoke('scrape-product', {
            body: { url }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "수집 실패");

        crawledProduct = data.product;

        // UI에 결과 표시
        document.getElementById('crawlPreviewImg').src = crawledProduct.main_image || '';
        document.getElementById('crawlName').value = crawledProduct.name || '';
        document.getElementById('crawlPrice').value = crawledProduct.price_krw || crawledProduct.price || 0;
        document.getElementById('crawlCurrency').value = crawledProduct.currency || 'KRW';
        document.getElementById('crawlCategory').value = crawledProduct.category_guess || '';
        document.getElementById('crawlDesc').value = crawledProduct.description || '';

        // 사양 표시
        if (crawledProduct.specs && Object.keys(crawledProduct.specs).length > 0) {
            const specsHtml = Object.entries(crawledProduct.specs)
                .map(([k, v]) => `<span style="display:inline-block; background:#312e81; padding:2px 8px; border-radius:4px; margin:2px;">${k}: ${v}</span>`)
                .join(' ');
            document.getElementById('crawlSpecs').innerHTML = specsHtml;
        }

        // 추가 이미지 썸네일 표시
        const extraDiv = document.getElementById('crawlExtraImages');
        extraDiv.innerHTML = '';
        if (crawledProduct.images && crawledProduct.images.length > 1) {
            crawledProduct.images.forEach((imgUrl, i) => {
                const thumb = document.createElement('img');
                thumb.src = imgUrl;
                thumb.style.cssText = 'width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid #4338ca; cursor:pointer;';
                thumb.title = `이미지 ${i + 1}`;
                thumb.onclick = () => {
                    document.getElementById('crawlPreviewImg').src = imgUrl;
                    crawledProduct.main_image = imgUrl;
                };
                extraDiv.appendChild(thumb);
            });
        }

        document.getElementById('crawlStep2').style.display = 'block';
        document.getElementById('crawlStep3').style.display = 'block';
        status.textContent = `✅ 수집 완료! (HTML ${data.raw_html_length}자 분석됨)`;

    } catch (e) {
        status.textContent = '❌ 수집 실패: ' + e.message;
        showToast("크롤링 실패: " + e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 수집 시작';
    }
};

// [2] 이미지 AI 재생성
window.reimagineProduct = async (mode) => {
    const imgEl = document.getElementById('crawlPreviewImg');
    const imgSrc = imgEl.src;
    if (!imgSrc || imgSrc.endsWith('/')) { showToast("이미지가 없습니다.", "warn"); return; }

    const status = document.getElementById('reimagineStatus');
    status.textContent = mode === 'variation'
        ? '🔄 Flux Redux로 이미지 변형 중... (약 15초)'
        : '🔄 Claude Vision 분석 + Flux 생성 중... (약 25초)';

    try {
        const { data, error } = await sb.functions.invoke('reimagine-product', {
            body: {
                image_url: imgSrc,
                mode: mode,
                prompt_hint: document.getElementById('crawlName').value
            }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "이미지 재생성 실패");

        imgEl.src = data.image_url;
        crawledProduct.main_image = data.image_url;
        status.textContent = `✅ 이미지 재생성 완료! (${mode === 'variation' ? '변형' : '재생성'})`;

    } catch (e) {
        status.textContent = '❌ 실패: ' + e.message;
        showToast("이미지 재생성 실패: " + e.message, "error");
    }
};

// [3] AI 상세페이지 자동 생성 (6개 언어)
window.generateCrawledDetail = async () => {
    if (!crawledProduct) { showToast("먼저 상품을 수집해주세요.", "warn"); return; }

    const status = document.getElementById('detailGenStatus');
    status.textContent = '🔄 Claude AI가 상세페이지를 작성 중... (6개 언어, 약 60초)';

    try {
        const { data, error } = await sb.functions.invoke('generate-product-detail', {
            body: {
                product_name: document.getElementById('crawlName').value,
                product_category: document.getElementById('crawlCategory').value,
                product_specs: crawledProduct.specs || {},
                image_url: crawledProduct.main_image,
                price: parseInt(document.getElementById('crawlPrice').value) || 0,
                original_description: document.getElementById('crawlDesc').value,
                langs: ["kr", "jp", "us", "cn", "ar", "es", "de", "fr"]
            }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "상세페이지 생성 실패");

        crawledDetailHtml = data.details;
        status.textContent = `✅ 상세페이지 생성 완료! (${data.generated_langs.join(', ')})`;

        if (confirm("상세페이지가 생성되었습니다.\n바로 상품 등록 폼에 적용하시겠습니까?")) {
            applyCrawledToForm();
        }

    } catch (e) {
        status.textContent = '❌ 실패: ' + e.message;
        showToast("상세페이지 생성 실패: " + e.message, "error");
    }
};

// [4] 수집 데이터를 기존 상품 등록 폼에 적용
window.applyCrawledToForm = () => {
    if (!crawledProduct) { showToast("수집된 데이터가 없습니다.", "warn"); return; }

    // 기본 정보
    const nameEl = document.getElementById('newProdName');
    const priceEl = document.getElementById('newProdPrice');
    const imgEl = document.getElementById('newProdImg');
    const previewEl = document.getElementById('prodPreview');

    if (nameEl) nameEl.value = document.getElementById('crawlName').value || crawledProduct.name || '';
    if (priceEl) priceEl.value = document.getElementById('crawlPrice').value || crawledProduct.price_krw || 0;
    if (imgEl) imgEl.value = crawledProduct.main_image || '';
    if (previewEl) previewEl.src = crawledProduct.main_image || '';

    // 사이즈 (specs에서 추출)
    if (crawledProduct.specs) {
        const sizeStr = crawledProduct.specs['사이즈'] || crawledProduct.specs['크기'] || crawledProduct.specs['size'] || '';
        const sizeMatch = sizeStr.match(/(\d+)\s*[x×X]\s*(\d+)/);
        if (sizeMatch) {
            const wEl = document.getElementById('newProdW');
            const hEl = document.getElementById('newProdH');
            if (wEl) wEl.value = sizeMatch[1];
            if (hEl) hEl.value = sizeMatch[2];
        }
    }

    // 상세페이지 HTML 적용
    const langFields = { kr: 'KR', jp: 'JP', us: 'US', cn: 'CN', ar: 'AR', es: 'ES' };
    for (const [lang, suffix] of Object.entries(langFields)) {
        if (crawledDetailHtml[lang]) {
            const el = document.getElementById(`newProdDetail${suffix}`);
            if (el) el.value = crawledDetailHtml[lang];
        }
    }

    // 자동번역 트리거 (상품명 다국어 번역)
    if (typeof autoTranslateInputs === 'function') {
        autoTranslateInputs();
    }

    showToast("수집 데이터가 폼에 적용되었습니다!\n\n• 상세페이지 에디터를 열어 내용을 확인하세요\n• 카테고리를 선택해주세요\n• 최종 확인 후 [상품 등록하기] 버튼을 눌러주세요", "success");

    // 폼으로 스크롤
    const formEl = document.querySelector('.product-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
};

// ==========================================
// 일괄 수집 모드
// ==========================================

// 탭 전환
window.switchCrawlMode = (mode) => {
    const singleEl = document.getElementById('crawlSingleMode');
    const batchEl = document.getElementById('crawlBatchMode');
    const tabSingle = document.getElementById('tabCrawlSingle');
    const tabBatch = document.getElementById('tabCrawlBatch');
    if (mode === 'batch') {
        singleEl.style.display = 'none';
        batchEl.style.display = 'block';
        tabSingle.style.background = 'transparent'; tabSingle.style.color = '#a5b4fc';
        tabBatch.style.background = '#6366f1'; tabBatch.style.color = '#fff';
        loadBatchTopCategories();
    } else {
        singleEl.style.display = 'block';
        batchEl.style.display = 'none';
        tabSingle.style.background = '#6366f1'; tabSingle.style.color = '#fff';
        tabBatch.style.background = 'transparent'; tabBatch.style.color = '#a5b4fc';
    }
};

// 대분류 로드
window.loadBatchTopCategories = async () => {
    const sel = document.getElementById('batchTopCategory');
    if (!sel) return;
    const { data } = await sb.from('admin_top_categories').select('code, name').order('sort_order');
    sel.innerHTML = '<option value="">대분류 선택</option>';
    (data || []).forEach(c => {
        sel.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });
};

// 소분류 로드
window.loadBatchSubCategories = async () => {
    const topCode = document.getElementById('batchTopCategory').value;
    const sel = document.getElementById('batchSubCategory');
    if (!topCode) { sel.innerHTML = '<option value="">대분류를 먼저 선택</option>'; return; }
    const { data } = await sb.from('admin_categories').select('code, name').eq('top_category_code', topCode).order('sort_order');
    sel.innerHTML = '<option value="">소분류 선택</option>';
    (data || []).forEach(c => {
        sel.innerHTML += `<option value="${c.code}">${c.name} (${c.code})</option>`;
    });
};

// 상품코드 자동 생성
function generateProductCode(prefix = 'AI') {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}_${ts}_${rand}`;
}

// 일괄 수집 & 자동 등록
window.batchCrawlProducts = async () => {
    const urlsText = document.getElementById('batchUrls').value.trim();
    if (!urlsText) { showToast("URL을 입력해주세요.", "warn"); return; }

    const category = document.getElementById('batchSubCategory').value;
    if (!category) { showToast("소분류 카테고리를 선택해주세요.", "warn"); return; }

    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) { showToast("유효한 URL이 없습니다.", "warn"); return; }

    const doBgChange = document.getElementById('batchBgChange').checked;
    const doGenDetail = document.getElementById('batchGenDetail').checked;
    const isGeneral = document.getElementById('batchIsGeneral').checked;

    const btn = document.getElementById('btnBatchStart');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리 중...';

    const progressDiv = document.getElementById('batchProgress');
    const countEl = document.getElementById('batchCount');
    const barEl = document.getElementById('batchBar');
    const logEl = document.getElementById('batchLog');

    progressDiv.style.display = 'block';
    logEl.innerHTML = '';
    let successCount = 0;

    const addLog = (msg, color = '#94a3b8') => {
        logEl.innerHTML += `<div style="color:${color};">${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    };

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const num = i + 1;
        countEl.textContent = `${num} / ${urls.length}`;
        barEl.style.width = `${(num / urls.length) * 100}%`;

        addLog(`[${num}/${urls.length}] 수집 중: ${url.substring(0, 60)}...`);

        try {
            // 1) 크롤링
            const { data: scrapeData, error: scrapeErr } = await sb.functions.invoke('scrape-product', {
                body: { url }
            });
            if (scrapeErr || !scrapeData?.success) {
                throw new Error(scrapeData?.error || scrapeErr?.message || '수집 실패');
            }
            const product = scrapeData.product;
            addLog(`  ✅ 수집 완료: ${(product.name || '').substring(0, 30)}`);

            // 2) 이미지 배경 교체
            let finalImgUrl = product.main_image || '';
            if (doBgChange && finalImgUrl) {
                addLog(`  🔄 이미지 배경 교체 중...`);
                try {
                    const { data: reimgData, error: reimgErr } = await sb.functions.invoke('reimagine-product', {
                        body: {
                            image_url: finalImgUrl,
                            mode: 'bg_change',
                            prompt_hint: product.name,
                            aspect_ratio: '1:1'
                        }
                    });
                    if (!reimgErr && reimgData?.success) {
                        finalImgUrl = reimgData.image_url;
                        addLog(`  ✅ 배경 교체 완료`, '#34d399');
                    } else {
                        addLog(`  ⚠️ 배경 교체 실패, 원본 사용`, '#fbbf24');
                    }
                } catch (e) {
                    addLog(`  ⚠️ 배경 교체 에러: ${e.message}`, '#fbbf24');
                }
            }

            // 3) 상세페이지 생성
            let detailHtml = {};
            if (doGenDetail) {
                addLog(`  🔄 상세페이지 생성 중 (6개 언어)...`);
                try {
                    const { data: detailData, error: detailErr } = await sb.functions.invoke('generate-product-detail', {
                        body: {
                            product_name: product.name,
                            product_category: category,
                            product_specs: product.specs || {},
                            image_url: finalImgUrl,
                            price: product.price_krw || product.price || 0,
                            original_description: product.description,
                            langs: ["kr", "jp", "us", "cn", "ar", "es", "de", "fr"]
                        }
                    });
                    if (!detailErr && detailData?.success) {
                        detailHtml = detailData.details || {};
                        addLog(`  ✅ 상세페이지 완료 (${Object.keys(detailHtml).join(',')})`, '#34d399');
                    } else {
                        addLog(`  ⚠️ 상세페이지 실패`, '#fbbf24');
                    }
                } catch (e) {
                    addLog(`  ⚠️ 상세페이지 에러: ${e.message}`, '#fbbf24');
                }
            }

            // 4) DB 저장
            const code = generateProductCode('AI');
            const price = product.price_krw || product.price || 0;

            const payload = {
                site_code: 'KR',
                category: category,
                code: code,
                is_general_product: isGeneral,
                is_custom_size: false,
                img_url: finalImgUrl,
                name: product.name || '',
                price: price,
                description: detailHtml.kr || product.description || '',
                name_jp: '', name_us: '', name_cn: '', name_ar: '', name_es: '',
                price_jp: Math.round(price * 0.1),
                price_us: Math.round(price * 0.001),
                description_jp: detailHtml.jp || '',
                description_us: detailHtml.us || '',
                description_cn: detailHtml.cn || '',
                description_ar: detailHtml.ar || '',
                description_es: detailHtml.es || '',
                width_mm: 0, height_mm: 0,
                addons: ''
            };

            const { error: insertErr } = await sb.from('admin_products').insert([payload]);
            if (insertErr) {
                addLog(`  ❌ DB 저장 실패: ${insertErr.message}`, '#f87171');
            } else {
                successCount++;
                addLog(`  ✅ 등록 완료! (코드: ${code})`, '#34d399');
            }

        } catch (e) {
            addLog(`  ❌ 실패: ${e.message}`, '#f87171');
        }

        // 건 사이 딜레이 (API 과부하 방지)
        if (i < urls.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    barEl.style.width = '100%';
    addLog(`\n🎉 완료! 총 ${urls.length}건 중 ${successCount}건 등록 성공`, '#fbbf24');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rocket"></i> 일괄 수집 & 자동 등록 시작';

    // 자동번역 트리거 (상품명 다국어)
    if (successCount > 0 && typeof autoTranslateInputs === 'function') {
        addLog('🔄 등록된 상품 이름 자동 번역 중...');
        // 등록된 상품들의 이름을 일괄 번역
        try {
            await batchTranslateNewProducts(category, successCount);
            addLog('✅ 이름 번역 완료', '#34d399');
        } catch (e) {
            addLog('⚠️ 이름 번역 실패: ' + e.message, '#fbbf24');
        }
    }

    showToast(`일괄 수집 완료!\n\n총 ${urls.length}건 중 ${successCount}건 등록 성공`, "success");
};

// 등록된 상품들의 이름 일괄 번역
async function batchTranslateNewProducts(category, count) {
    // 최근 등록된 AI 상품들 가져오기
    const { data: products } = await sb.from('admin_products')
        .select('id, name, name_jp')
        .eq('category', category)
        .like('code', 'AI_%')
        .order('id', { ascending: false })
        .limit(count);

    if (!products || products.length === 0) return;

    for (const p of products) {
        if (!p.name || (p.name_jp && p.name_jp.length > 0)) continue;
        try {
            const { data: trData } = await sb.functions.invoke('translate', {
                body: { text: p.name, sourceLang: 'ko', targetLangs: ['ja', 'en', 'zh', 'ar', 'es', 'de', 'fr'] }
            });
            if (trData?.translations) {
                await sb.from('admin_products').update({
                    name_jp: trData.translations.ja || '',
                    name_us: trData.translations.en || '',
                    name_cn: trData.translations.zh || '',
                    name_ar: trData.translations.ar || '',
                    name_es: trData.translations.es || '',
                    name_de: trData.translations.de || '',
                    name_fr: trData.translations.fr || ''
                }).eq('id', p.id);
            }
        } catch (e) {
            console.error('번역 실패:', p.id, e);
        }
    }
}

// ==========================================
// 상세페이지 템플릿 일괄 생성
// ==========================================

function generateDetailTemplate(name, nameLocal, imgUrl, lang) {
    const n = nameLocal || name || '';
    const img = imgUrl || '';

    const templates = {
        kr: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p>카멜레온프린팅에서 제공하는 <strong>${n}</strong>입니다. 최고의 인쇄 품질과 합리적인 가격으로 만나보세요.</p>
<p><br></p>
<h3>주요 특징</h3>
<ul>
<li>고품질 UV / 라텍스 인쇄로 선명한 색상 표현</li>
<li>내구성 높은 프리미엄 소재 사용</li>
<li>다양한 사이즈 맞춤 제작 가능</li>
<li>빠른 제작 및 안전한 포장 배송</li>
</ul>
<p><br></p>
<h3>주문 안내</h3>
<ul>
<li>디자인 파일을 업로드하여 간편하게 주문하세요</li>
<li>수량에 따른 할인 혜택이 적용됩니다</li>
<li>주문 후 1~3일 이내 제작 완료</li>
</ul>
<hr>
<p><strong>카멜레온프린팅</strong> - 당신의 디자인을 현실로 만듭니다</p>`,

        jp: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p>カメレオンプリンティングがお届けする<strong>${n}</strong>です。最高の印刷品質とお手頃な価格でご利用いただけます。</p>
<p><br></p>
<h3>主な特徴</h3>
<ul>
<li>高品質UV/ラテックス印刷で鮮やかな色彩表現</li>
<li>耐久性の高いプレミアム素材を使用</li>
<li>多様なサイズでオーダーメイド制作が可能</li>
<li>迅速な制作と安全な梱包配送</li>
</ul>
<p><br></p>
<h3>ご注文について</h3>
<ul>
<li>デザインファイルをアップロードして簡単にご注文いただけます</li>
<li>数量に応じた割引特典がございます</li>
<li>ご注文後1〜3日以内に制作完了</li>
</ul>
<hr>
<p><strong>カメレオンプリンティング</strong> - あなたのデザインを現実に</p>`,

        us: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p><strong>${n}</strong> by Chameleon Printing. Premium quality printing with vivid colors at competitive prices.</p>
<p><br></p>
<h3>Key Features</h3>
<ul>
<li>High-quality UV / Latex printing with vivid color reproduction</li>
<li>Durable premium materials for long-lasting results</li>
<li>Custom sizes available to fit your needs</li>
<li>Fast production and secure packaging</li>
</ul>
<p><br></p>
<h3>Order Information</h3>
<ul>
<li>Upload your design file for easy ordering</li>
<li>Volume discounts available for bulk orders</li>
<li>Production completed within 1-3 business days</li>
</ul>
<hr>
<p><strong>Chameleon Printing</strong> - Bringing your designs to life</p>`,

        cn: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p>变色龙印刷为您提供的<strong>${n}</strong>。以最优质的印刷品质和实惠的价格为您服务。</p>
<p><br></p>
<h3>主要特点</h3>
<ul>
<li>高品质UV/乳胶印刷，色彩鲜艳生动</li>
<li>高耐久性优质材料</li>
<li>多种尺寸可定制生产</li>
<li>快速制作与安全包装配送</li>
</ul>
<p><br></p>
<h3>订购说明</h3>
<ul>
<li>上传设计文件即可便捷下单</li>
<li>批量订购享受折扣优惠</li>
<li>下单后1-3个工作日内完成制作</li>
</ul>
<hr>
<p><strong>变色龙印刷</strong> - 将您的设计变为现实</p>`,

        ar: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p><strong>${n}</strong> من كاميليون للطباعة. جودة طباعة متميزة بأسعار تنافسية.</p>
<p><br></p>
<h3>المميزات الرئيسية</h3>
<ul>
<li>طباعة UV/لاتكس عالية الجودة بألوان زاهية</li>
<li>مواد متينة عالية الجودة</li>
<li>أحجام مخصصة حسب احتياجاتك</li>
<li>إنتاج سريع وتغليف آمن</li>
</ul>
<p><br></p>
<h3>معلومات الطلب</h3>
<ul>
<li>قم بتحميل ملف التصميم للطلب بسهولة</li>
<li>خصومات على الكميات الكبيرة</li>
<li>يتم الإنتاج خلال 1-3 أيام عمل</li>
</ul>
<hr>
<p><strong>كاميليون للطباعة</strong> - نحول تصاميمك إلى واقع</p>`,

        es: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p><strong>${n}</strong> de Chameleon Printing. Impresión de calidad premium con colores vivos a precios competitivos.</p>
<p><br></p>
<h3>Características Principales</h3>
<ul>
<li>Impresión UV/Látex de alta calidad con colores vibrantes</li>
<li>Materiales premium de alta durabilidad</li>
<li>Tamaños personalizados según sus necesidades</li>
<li>Producción rápida y embalaje seguro</li>
</ul>
<p><br></p>
<h3>Información de Pedido</h3>
<ul>
<li>Sube tu archivo de diseño para un pedido fácil</li>
<li>Descuentos por volumen disponibles</li>
<li>Producción completada en 1-3 días hábiles</li>
</ul>
<hr>
<p><strong>Chameleon Printing</strong> - Dando vida a tus diseños</p>`,

        de: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p><strong>${n}</strong> von Chameleon Printing. Premium-Druckqualität mit lebendigen Farben zu wettbewerbsfähigen Preisen.</p>
<p><br></p>
<h3>Hauptmerkmale</h3>
<ul>
<li>Hochwertiger UV-/Latexdruck mit lebendiger Farbwiedergabe</li>
<li>Langlebige Premium-Materialien</li>
<li>Individuelle Größen nach Ihren Bedürfnissen</li>
<li>Schnelle Produktion und sichere Verpackung</li>
</ul>
<p><br></p>
<h3>Bestellinformationen</h3>
<ul>
<li>Laden Sie Ihre Designdatei hoch für eine einfache Bestellung</li>
<li>Mengenrabatte für Großbestellungen verfügbar</li>
<li>Produktion innerhalb von 1-3 Werktagen abgeschlossen</li>
</ul>
<hr>
<p><strong>Chameleon Printing</strong> - Wir bringen Ihre Designs zum Leben</p>`,

        fr: `<h2>${n}</h2>
<p><img src="${img}" alt="${n}" loading="lazy"></p>
<p><br></p>
<p><strong>${n}</strong> par Chameleon Printing. Impression de qualité premium avec des couleurs vives à des prix compétitifs.</p>
<p><br></p>
<h3>Caractéristiques Principales</h3>
<ul>
<li>Impression UV/Latex haute qualité avec des couleurs éclatantes</li>
<li>Matériaux premium durables</li>
<li>Tailles personnalisées selon vos besoins</li>
<li>Production rapide et emballage sécurisé</li>
</ul>
<p><br></p>
<h3>Informations de Commande</h3>
<ul>
<li>Téléchargez votre fichier de design pour une commande facile</li>
<li>Remises sur volume disponibles</li>
<li>Production terminée sous 1 à 3 jours ouvrables</li>
</ul>
<hr>
<p><strong>Chameleon Printing</strong> - Donnons vie à vos designs</p>`
    };

    return templates[lang] || templates.kr;
}

// 상세페이지 없는 상품 일괄 생성 (빈 언어 포함)
window.batchFillDetailPages = async () => {
    const { data: products, error } = await sb.from('admin_products')
        .select('id, name, name_jp, name_us, name_cn, name_ar, name_es, name_de, name_fr, img_url, description, description_jp, description_us, description_cn, description_ar, description_es, description_de, description_fr')
        .order('id');

    if (error) { showToast('상품 조회 실패: ' + error.message, "error"); return; }

    const isEmpty = (d) => !d || d.trim() === '' || d === '<p><br></p>';

    // 한국어가 완전히 비어있는 상품 OR 특정 언어가 비어있는 상품 모두 포함
    const targets = products.filter(p =>
        isEmpty(p.description) || isEmpty(p.description_jp) || isEmpty(p.description_us) ||
        isEmpty(p.description_cn) || isEmpty(p.description_ar) || isEmpty(p.description_es) ||
        isEmpty(p.description_de) || isEmpty(p.description_fr)
    );

    if (targets.length === 0) { showToast('상세페이지가 없는 상품이 없습니다. (모든 8개 언어 채워짐)', "info"); return; }
    if (!confirm(`${targets.length}개 상품에 빈 언어 상세페이지를 일괄 생성하시겠습니까?`)) return;

    const btn = document.getElementById('btnBatchFillDetail');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...'; }

    let success = 0;
    let fail = 0;

    for (const p of targets) {
        try {
            const updates = {};
            if (isEmpty(p.description)) updates.description = generateDetailTemplate(p.name, p.name, p.img_url, 'kr');
            if (isEmpty(p.description_jp)) updates.description_jp = generateDetailTemplate(p.name, p.name_jp || p.name, p.img_url, 'jp');
            if (isEmpty(p.description_us)) updates.description_us = generateDetailTemplate(p.name, p.name_us || p.name, p.img_url, 'us');
            if (isEmpty(p.description_cn)) updates.description_cn = generateDetailTemplate(p.name, p.name_cn || p.name_us || p.name, p.img_url, 'cn');
            if (isEmpty(p.description_ar)) updates.description_ar = generateDetailTemplate(p.name, p.name_ar || p.name_us || p.name, p.img_url, 'ar');
            if (isEmpty(p.description_es)) updates.description_es = generateDetailTemplate(p.name, p.name_es || p.name_us || p.name, p.img_url, 'es');
            if (isEmpty(p.description_de)) updates.description_de = generateDetailTemplate(p.name, p.name_de || p.name_us || p.name, p.img_url, 'de');
            if (isEmpty(p.description_fr)) updates.description_fr = generateDetailTemplate(p.name, p.name_fr || p.name_us || p.name, p.img_url, 'fr');

            if (Object.keys(updates).length === 0) continue;

            const { error: updateErr } = await sb.from('admin_products').update(updates).eq('id', p.id);
            if (updateErr) { fail++; console.error('실패:', p.id, updateErr.message); }
            else { success++; }
        } catch (e) {
            fail++;
            console.error('에러:', p.id, e);
        }
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-lines"></i> 상세페이지 일괄 생성 (빈 상품)'; }
    showToast(`상세페이지 일괄 생성 완료!\n\n성공: ${success}건\n실패: ${fail}건`, "success");
};

// ═══════════════════════════════════════════════════════════════
// ★★★ AI 상세페이지 마법사 (Detail Page Wizard) ★★★
// ═══════════════════════════════════════════════════════════════

let wizImages = [];          // [{file, preview, url, isThumbnail}]
let wizGeneratedHtml = {};   // {kr:'<html>', jp:'...', ...}
let _wizCurrentLang = 'kr';
let _wizExistingDesc = '';   // 기존 상품의 상세페이지 HTML (AI 참조용)

// 마법사 열기 (상태 유지 — 닫았다 열어도 데이터 보존)
window.openDetailWizard = () => {
    // 카테고리 복사 (항상)
    const srcCat = document.getElementById('newProdCategory');
    const wizCat = document.getElementById('wizCategory');
    if (srcCat && wizCat && wizCat.options.length <= 1) {
        wizCat.innerHTML = srcCat.innerHTML;
    }

    // 기존 상품 편집 중이면 자동 연결
    if (window.editingProdId) {
        // 상품명, 카테고리 채우기
        if (!document.getElementById('wizTitle').value) {
            const name = document.getElementById('newProdName');
            if (name && name.value) document.getElementById('wizTitle').value = name.value;
            if (srcCat) document.getElementById('wizCategory').value = srcCat.value;
        }
        // "기존 상품에 적용" 자동 체크 + 상품 자동 선택
        document.getElementById('wizExistingCheck').checked = true;
        document.getElementById('wizExistingWrap').style.display = 'block';
        // 상품 목록 로드 후 자동 선택
        _wizLoadProductList().then(() => {
            const sel = document.getElementById('wizExistingSelect');
            if (sel) {
                sel.value = window.editingProdId;
                // 선택된 상품 정보 표시
                window.wizOnSelectExisting(sel);
            }
        });
    } else {
        // 기존 상품 목록 로드 (아직 안 불러왔으면)
        if (_wizAllProducts.length === 0) _wizLoadProductList();
    }

    document.getElementById('wizardModal').style.display = 'flex';
};

// 마법사 초기화 (새로 시작)
window.wizReset = () => {
    wizImages = [];
    wizGeneratedHtml = {};
    _wizCurrentLang = 'kr';
    _wizExistingDesc = '';
    document.getElementById('wizImgGrid').innerHTML = '';
    document.getElementById('wizTitle').value = '';
    document.getElementById('wizRef').value = '';
    const wizPriceEl = document.getElementById('wizPrice');
    if (wizPriceEl) wizPriceEl.value = '';
    document.getElementById('wizStatus').textContent = '';
    const pipeSection = document.getElementById('wizPipelineSection');
    if (pipeSection) pipeSection.style.display = 'none';
    document.getElementById('wizPreviewSection').style.display = 'none';
    document.getElementById('wizExistingCheck').checked = false;
    document.getElementById('wizExistingWrap').style.display = 'none';
    const search = document.getElementById('wizExistingSearch');
    if (search) search.value = '';
    showToast('마법사가 초기화되었습니다.', 'info');
};

// 기존 상품 목록 로드
let _wizAllProducts = [];
async function _wizLoadProductList() {
    try {
        const { data } = await sb.from('admin_products').select('id, code, name, img_url, category, price, description').order('name');
        _wizAllProducts = data || [];
        _wizRenderProductList(_wizAllProducts);
    } catch(e) { console.error('상품 목록 로드 실패:', e); }
}

function _wizRenderProductList(list) {
    const sel = document.getElementById('wizExistingSelect');
    if (!sel) return;
    sel.innerHTML = '';
    if (list.length === 0) {
        sel.innerHTML = '<option value="">검색 결과 없음</option>';
        return;
    }
    list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `[${p.code}] ${p.name}`;
        opt.dataset.imgUrl = p.img_url || '';
        opt.dataset.category = p.category || '';
        opt.dataset.name = p.name || '';
        opt.dataset.price = p.price || 0;
        opt.dataset.hasDesc = (p.description && p.description.length > 20) ? '1' : '0';
        sel.appendChild(opt);
    });
}

// 상품 검색 필터
window.wizFilterProducts = (query) => {
    const q = (query || '').toLowerCase().trim();
    if (!q) { _wizRenderProductList(_wizAllProducts); return; }
    const filtered = _wizAllProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q))
    );
    _wizRenderProductList(filtered);
};

// 기존 상품 선택 시 자동 채우기
window.wizOnSelectExisting = (sel) => {
    const opt = sel.options[sel.selectedIndex];
    const info = document.getElementById('wizExistingInfo');
    if (!opt || !opt.value) {
        if (info) info.style.display = 'none';
        return;
    }
    // 상품명, 카테고리, 가격 자동 채우기 (항상 덮어쓰기)
    const name = opt.dataset.name || '';
    const cat = opt.dataset.category || '';
    const imgUrl = opt.dataset.imgUrl || '';

    if (name) document.getElementById('wizTitle').value = name;
    if (cat) document.getElementById('wizCategory').value = cat;
    const priceVal = opt.dataset.price;
    if (priceVal && priceVal !== '0') {
        const priceEl = document.getElementById('wizPrice');
        if (priceEl) priceEl.value = priceVal;
    }

    // 기존 상세페이지 내용 로드 (AI 참조용)
    _wizExistingDesc = '';
    if (opt.dataset.hasDesc === '1') {
        sb.from('admin_products').select('description').eq('id', opt.value).single().then(({ data }) => {
            if (data?.description) {
                _wizExistingDesc = data.description;
                console.log('기존 상세페이지 로드:', _wizExistingDesc.length, '자');
            }
        }).catch(() => {});
    }

    // 기존 이미지를 위자드에 자동 로드 (사진이 아직 없을 때만)
    if (imgUrl && wizImages.length === 0) {
        // URL 이미지를 wizImages에 추가 (file 없이 url+preview만)
        wizImages.push({
            file: null,
            preview: imgUrl,
            url: imgUrl,
            isThumbnail: true
        });
        _wizRenderGrid();
    }

    // 기존 이미지 표시
    if (info) {
        info.style.display = 'block';
        info.innerHTML = `<strong>${name}</strong> 선택됨` +
            (imgUrl ? ` &nbsp;<img src="${imgUrl}" style="height:40px; vertical-align:middle; border-radius:4px; margin-left:6px;">` : '') +
            `<br><span style="color:#10b981; font-size:12px;">✅ 기존 이미지 로드됨. 사진을 추가로 올릴 수 있습니다.</span>`;
    }

    // "블로그+쇼츠만 바로 실행" 버튼 표시
    const directDiv = document.getElementById('wizDirectPipeline');
    if (directDiv) directDiv.style.display = 'block';
};

// 이미지 추가
window.wizAddImages = (files) => {
    if (!files || !files.length) return;
    const maxImages = 20;
    Array.from(files).forEach(file => {
        if (wizImages.length >= maxImages) return;
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            wizImages.push({
                file: file,
                preview: e.target.result,
                url: null,
                isThumbnail: wizImages.length === 0
            });
            _wizRenderGrid();
        };
        reader.readAsDataURL(file);
    });
};

// 썸네일 지정
window.wizSetThumbnail = (idx) => {
    wizImages.forEach((img, i) => img.isThumbnail = (i === idx));
    _wizRenderGrid();
};

// 이미지 삭제
window.wizRemoveImage = (idx) => {
    const wasThumbnail = wizImages[idx].isThumbnail;
    wizImages.splice(idx, 1);
    if (wasThumbnail && wizImages.length > 0) wizImages[0].isThumbnail = true;
    _wizRenderGrid();
};

// 이미지 그리드 렌더링
function _wizRenderGrid() {
    const grid = document.getElementById('wizImgGrid');
    grid.innerHTML = wizImages.map((img, i) => `
        <div class="wiz-img-card ${img.isThumbnail ? 'thumb' : ''}" onclick="window.wizSetThumbnail(${i})">
            <img src="${img.preview}" alt="img${i}">
            ${img.isThumbnail ? '<div class="wiz-thumb-badge">썸네일</div>' : ''}
            <button class="wiz-remove-btn" onclick="event.stopPropagation(); window.wizRemoveImage(${i});">&times;</button>
        </div>
    `).join('');
}

// ★ 메인 생성 함수
window.wizGenerate = async () => {
    const title = document.getElementById('wizTitle').value.trim();
    const category = document.getElementById('wizCategory').value;
    const ref = document.getElementById('wizRef')?.value?.trim() || '';
    const price = parseInt(document.getElementById('wizPrice')?.value) || 0;

    if (!title) { showToast('상품명을 입력해주세요.', 'warn'); return; }
    if (wizImages.length === 0) { showToast('사진을 1장 이상 올려주세요.', 'warn'); return; }

    const btn = document.getElementById('wizGenerateBtn');
    const status = document.getElementById('wizStatus');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...';

    try {
        // 1단계: 이미지 업로드 (이미 URL이 있는 이미지는 스킵)
        status.textContent = '📤 이미지 업로드 중... (0/' + wizImages.length + ')';
        const timestamp = Date.now();
        let uploadedCount = 0;

        await Promise.all(wizImages.map(async (img, i) => {
            // 이미 URL이 있는 이미지(기존 상품 이미지)는 업로드 스킵
            if (img.url) { uploadedCount++; return; }
            const resp = await fetch(img.preview);
            const blob = await resp.blob();
            const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
            const path = `wizard/${timestamp}_${i}.${ext}`;
            const { error } = await sb.storage.from('products').upload(path, blob, { contentType: blob.type });
            if (error) throw new Error('이미지 업로드 실패: ' + error.message);
            const { data: urlData } = sb.storage.from('products').getPublicUrl(path);
            img.url = urlData.publicUrl;
            uploadedCount++;
            status.textContent = `📤 이미지 업로드 중... (${uploadedCount}/${wizImages.length})`;
        }));

        const imageUrls = wizImages.map(img => img.url);
        const thumbnailUrl = wizImages.find(img => img.isThumbnail)?.url || imageUrls[0];

        // 2단계: AI 생성 (한국어)
        status.textContent = '🤖 AI가 상세페이지를 작성 중... (약 30초)';

        const { data, error } = await sb.functions.invoke('generate-product-detail', {
            body: {
                product_name: title,
                product_category: category,
                image_urls: imageUrls,
                image_url: thumbnailUrl,
                reference_text: ref,
                price: price,
                original_description: _wizExistingDesc || '',
                mode: 'wizard',
                langs: ["kr", "jp", "us", "cn", "ar", "es", "de", "fr"]
            }
        });

        if (error) throw new Error(error.message);
        if (!data || !data.success) throw new Error((data && data.error) || '생성 실패');

        const krHtml = data.details.kr;
        if (!krHtml) {
            const errDetail = data.errors?.kr || JSON.stringify(data.errors || {});
            throw new Error('한국어 상세페이지 생성 실패: ' + errDetail);
        }

        wizGeneratedHtml = { kr: krHtml };

        // 3단계: 7개 언어 자동 번역
        status.textContent = '🌐 다국어 번역 중... (7개 언어)';

        const targets = [
            { code: 'ja', key: 'jp' },
            { code: 'en', key: 'us' },
            { code: 'zh-CN', key: 'cn' },
            { code: 'ar', key: 'ar' },
            { code: 'es', key: 'es' },
            { code: 'de', key: 'de' },
            { code: 'fr', key: 'fr' }
        ];

        if (typeof window.googleTranslateSimple === 'function') {
            for (const t of targets) {
                try {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = krHtml;
                    async function trNode(node) {
                        for (let child of node.childNodes) {
                            if (child.nodeType === 3 && child.nodeValue.trim().length > 0) {
                                child.nodeValue = await window.googleTranslateSimple(child.nodeValue, t.code);
                            } else if (child.nodeType === 1 && child.tagName !== 'IMG') {
                                await trNode(child);
                            }
                        }
                    }
                    await trNode(tempDiv);
                    wizGeneratedHtml[t.key] = tempDiv.innerHTML;
                } catch(e) {
                    console.error('번역 실패 (' + t.key + '):', e);
                    wizGeneratedHtml[t.key] = krHtml;
                }
            }
        } else {
            targets.forEach(t => { wizGeneratedHtml[t.key] = krHtml; });
        }

        // 4단계: 미리보기 표시
        status.textContent = '✅ 8개 언어 상세페이지 생성 완료!';
        _wizCurrentLang = 'kr';
        document.getElementById('wizPreview').innerHTML = krHtml;
        document.getElementById('wizPreviewSection').style.display = 'block';
        document.querySelectorAll('.wiz-lang-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.wiz-lang-tab').classList.add('active');

        // 기존 상품 적용 버튼 표시
        document.getElementById('wizApplyExistingBtn').style.display = 'inline-block';

        // 미리보기로 스크롤
        document.getElementById('wizPreviewSection').scrollIntoView({ behavior: 'smooth' });

    } catch(e) {
        console.error('마법사 생성 오류:', e);
        status.textContent = '❌ 실패: ' + e.message;
        showToast('생성 실패: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-robot"></i> AI 상세페이지 생성';
    }
};

// 언어 탭 전환
window.wizPreviewLang = (lang) => {
    _wizCurrentLang = lang;
    const html = wizGeneratedHtml[lang] || '';
    document.getElementById('wizPreview').innerHTML = html || '<p style="color:#9ca3af;">이 언어의 콘텐츠가 없습니다.</p>';
    document.querySelectorAll('.wiz-lang-tab').forEach(t => t.classList.remove('active'));
    const tabs = document.querySelectorAll('.wiz-lang-tab');
    const langOrder = ['kr','jp','us','cn','ar','es','de','fr'];
    const idx = langOrder.indexOf(lang);
    if (idx >= 0 && tabs[idx]) tabs[idx].classList.add('active');
};

// 새 상품 폼에 적용
window.wizApplyToForm = () => {
    if (!wizGeneratedHtml.kr) { showToast('먼저 AI 생성을 실행해주세요.', 'warn'); return; }

    const langMap = { kr: 'KR', jp: 'JP', us: 'US', cn: 'CN', ar: 'AR', es: 'ES', de: 'DE', fr: 'FR' };
    for (const [lang, suffix] of Object.entries(langMap)) {
        const el = document.getElementById('newProdDetail' + suffix);
        if (el && wizGeneratedHtml[lang]) el.value = wizGeneratedHtml[lang];
    }

    // 썸네일 → 메인 이미지
    const thumb = wizImages.find(img => img.isThumbnail);
    if (thumb && thumb.url) {
        const imgEl = document.getElementById('newProdImg');
        const prevEl = document.getElementById('prodPreview');
        if (imgEl) imgEl.value = thumb.url;
        if (prevEl) prevEl.src = thumb.url;
    }

    // 상품명
    const title = document.getElementById('wizTitle').value.trim();
    if (title) {
        const nameEl = document.getElementById('newProdName');
        if (nameEl) nameEl.value = title;
    }

    // 카테고리
    const cat = document.getElementById('wizCategory').value;
    if (cat) {
        const catEl = document.getElementById('newProdCategory');
        if (catEl) catEl.value = cat;
    }

    // 상품코드 자동 생성
    const codeEl = document.getElementById('newProdCode');
    if (codeEl && !codeEl.value) {
        const prefix = cat || 'prod';
        codeEl.value = prefix + '_' + Date.now().toString(36);
    }

    // 상품명 자동 번역
    if (typeof window.autoTranslateInputs === 'function') {
        window.autoTranslateInputs();
    }

    document.getElementById('wizardModal').style.display = 'none';
    showToast('폼에 적용 완료! 🎉\n\n• 상세페이지, 이미지, 상품명 적용됨\n• 가격을 입력한 후 [상품 등록하기]를 눌러주세요', 'success');

    // 폼으로 스크롤
    const form = document.querySelector('.product-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
};

// 기존 상품에 직접 저장
window.wizApplyToExisting = async () => {
    const sel = document.getElementById('wizExistingSelect');
    let prodId = sel ? sel.value : '';
    // size 속성이 있는 select는 selectedIndex로도 확인
    if (!prodId && sel && sel.selectedIndex >= 0) {
        prodId = sel.options[sel.selectedIndex].value;
    }
    // 편집 중인 상품 ID fallback
    if (!prodId && window.editingProdId) {
        prodId = window.editingProdId;
    }
    if (!prodId) { showToast('기존 상품을 선택해주세요.', 'warn'); return; }
    if (!wizGeneratedHtml.kr) { showToast('먼저 AI 생성을 실행해주세요.', 'warn'); return; }

    if (!confirm('선택한 상품의 상세페이지를 덮어쓰시겠습니까?')) return;

    const thumb = wizImages.find(img => img.isThumbnail);
    const updates = {
        description: wizGeneratedHtml.kr || '',
        description_jp: wizGeneratedHtml.jp || '',
        description_us: wizGeneratedHtml.us || '',
        description_cn: wizGeneratedHtml.cn || '',
        description_ar: wizGeneratedHtml.ar || '',
        description_es: wizGeneratedHtml.es || '',
        description_de: wizGeneratedHtml.de || '',
        description_fr: wizGeneratedHtml.fr || ''
    };
    if (thumb && thumb.url) updates.img_url = thumb.url;

    const { error } = await sb.from('admin_products').update(updates).eq('id', prodId);
    if (error) {
        showToast(_t('err_save_failed','Save failed: ') + error.message, 'error');
    } else {
        showToast('기존 상품 상세페이지 업데이트 완료! 🎉', 'success');
    }
};

// 에디터에서 수정하기
window.wizOpenInEditor = () => {
    if (!wizGeneratedHtml.kr) { showToast('먼저 AI 생성을 실행해주세요.', 'warn'); return; }

    const langMap = { kr: 'KR', jp: 'JP', us: 'US', cn: 'CN', ar: 'AR', es: 'ES', de: 'DE', fr: 'FR' };
    for (const [lang, suffix] of Object.entries(langMap)) {
        const el = document.getElementById('newProdDetail' + suffix);
        if (el && wizGeneratedHtml[lang]) el.value = wizGeneratedHtml[lang];
    }

    document.getElementById('wizardModal').style.display = 'none';
    window.openDetailPageEditor();
};

// ═══════════════════════════════════════════════════════════════
// ★★★ 원클릭 자동 파이프라인 (상세페이지 저장 + 블로그 + 쇼츠) ★★★
// ═══════════════════════════════════════════════════════════════

const _wizLangConfig = {
    kr: { countryCode: 'KR', site: 'cafe2626.com', label: '한국어' },
    ja: { countryCode: 'JP', site: 'cafe0101.com', label: '日本語' },
    en: { countryCode: 'US', site: 'cafe3355.com', label: 'English' },
    cn: { countryCode: 'CN', site: 'cafe2626.com', label: '中文' },
    ar: { countryCode: 'AR', site: 'cafe3355.com', label: 'العربية' },
    es: { countryCode: 'ES', site: 'cafe3355.com', label: 'Español' },
    de: { countryCode: 'DE', site: 'cafe3355.com', label: 'Deutsch' },
    fr: { countryCode: 'FR', site: 'cafe3355.com', label: 'Français' }
};

function _wpStep(id, state) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'wp-step ' + state;
    const icon = el.querySelector('i');
    if (!icon) return;
    if (state === 'active') icon.className = 'fa-solid fa-circle-notch fa-spin';
    else if (state === 'done') icon.className = 'fa-solid fa-check-circle';
    else if (state === 'error') icon.className = 'fa-solid fa-circle-exclamation';
}

// ★ 메인 파이프라인 오케스트레이터
window.wizRunPipeline = async () => {
    if (!wizGeneratedHtml.kr) { showToast('먼저 AI 상세페이지를 생성해주세요.', 'warn'); return; }

    const pipeSection = document.getElementById('wizPipelineSection');
    const pipeResult = document.getElementById('wizPipelineResult');
    const pipeBtn = document.getElementById('wizPipelineBtn');
    pipeSection.style.display = 'block';
    pipeResult.style.display = 'none';
    pipeBtn.disabled = true;
    pipeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 파이프라인 실행 중...';

    // 스텝 초기화
    ['wp-save','wp-blog-kr','wp-blog-ja','wp-blog-en','wp-blog-cn','wp-blog-ar','wp-blog-es','wp-blog-de','wp-blog-fr','wp-shorts-ai','wp-shorts-tts','wp-shorts-render','wp-shorts-upload'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = 'wp-step';
    });

    const results = { save: false, blogs: 0, shorts: false };
    const title = document.getElementById('wizTitle').value.trim();
    const category = document.getElementById('wizCategory').value;
    const price = parseInt(document.getElementById('wizPrice')?.value) || 0;
    const thumb = wizImages.find(img => img.isThumbnail);
    const thumbnailUrl = thumb?.url || wizImages[0]?.url || '';
    const imageUrls = wizImages.filter(img => img.url).map(img => img.url);

    try {
        // ──────── STEP 1: 상품 저장 ────────
        _wpStep('wp-save', 'active');

        // 기존 상품 여부 판단: 체크박스 OR editingProdId
        const wizExistCheck = document.getElementById('wizExistingCheck');
        const sel = document.getElementById('wizExistingSelect');
        let prodId = null;

        // 3-tier fallback: select value → selectedIndex → editingProdId
        if (sel?.value) prodId = sel.value;
        if (!prodId && sel && sel.selectedIndex >= 0) prodId = sel.options[sel.selectedIndex]?.value;
        if (!prodId && window.editingProdId) prodId = window.editingProdId;

        const isExisting = !!(prodId && (wizExistCheck?.checked || window.editingProdId));

        if (isExisting) {

            const updates = {
                description: wizGeneratedHtml.kr || '',
                description_jp: wizGeneratedHtml.jp || '',
                description_us: wizGeneratedHtml.us || '',
                description_cn: wizGeneratedHtml.cn || '',
                description_ar: wizGeneratedHtml.ar || '',
                description_es: wizGeneratedHtml.es || '',
                description_de: wizGeneratedHtml.de || '',
                description_fr: wizGeneratedHtml.fr || ''
            };
            if (thumbnailUrl) updates.img_url = thumbnailUrl;
            if (price > 0) updates.price = price;

            const { error } = await sb.from('admin_products').update(updates).eq('id', prodId);
            if (error) throw new Error('상품 저장 실패: ' + error.message);
        } else {
            // 새 상품 등록
            const code = (category || 'prod') + '_' + Date.now().toString(36);
            const newProd = {
                code: code,
                name: title,
                category: category,
                price: price,
                img_url: thumbnailUrl,
                description: wizGeneratedHtml.kr || '',
                description_jp: wizGeneratedHtml.jp || '',
                description_us: wizGeneratedHtml.us || '',
                description_cn: wizGeneratedHtml.cn || '',
                description_ar: wizGeneratedHtml.ar || '',
                description_es: wizGeneratedHtml.es || '',
                description_de: wizGeneratedHtml.de || '',
                description_fr: wizGeneratedHtml.fr || '',
                addons: ''
            };
            const { data: inserted, error } = await sb.from('admin_products').insert(newProd).select('id').single();
            if (error) throw new Error('상품 등록 실패: ' + error.message);
            prodId = inserted?.id;
        }

        results.save = true;
        _wpStep('wp-save', 'done');

        // ──────── STEP 2: 8개국 블로그 생성 ────────
        const blogLangs = ['kr','ja','en','cn','ar','es','de','fr'];
        const { data: { user } } = await sb.auth.getUser();
        const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '카멜레온';
        let settings = {}; try { settings = JSON.parse(localStorage.getItem('mkt_settings') || '{}'); } catch(e) {}

        for (const lang of blogLangs) {
            const stepId = 'wp-blog-' + lang;
            _wpStep(stepId, 'active');

            try {
                const cfg = _wizLangConfig[lang];
                // AI 블로그 콘텐츠 생성
                const { data: aiData, error: aiErr } = await sb.functions.invoke('marketing-content', {
                    body: {
                        platform: 'blog',
                        topic: title + ' - 카멜레온프린팅 제품 소개',
                        tone: 'professional',
                        lang: lang,
                        instructions: `${cfg.site}에 게시될 ${cfg.label} 제품 블로그입니다. 상품명: ${title}. 카테고리: ${category}. 웹사이트: https://${cfg.site}`,
                        coreKeywords: settings.coreKeywords || '',
                        usp: settings.usp || '',
                        ctaMsg: settings.ctaMsg || ''
                    }
                });
                if (aiErr) throw new Error(aiErr.message);
                const content = aiData?.content || aiData;
                if (content?.error) throw new Error(content.error);

                // HTML 변환
                const bodyText = content.body || '';
                const focusKw = content.focus_keyword || '';
                let htmlBody = bodyText
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>')
                    .replace(/## (.*)/g, '<h2>$1</h2>')
                    .replace(/### (.*)/g, '<h3>$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                const altText = focusKw || title;
                htmlBody = `<p><img src="${thumbnailUrl}" alt="${altText}" style="max-width:100%; border-radius:12px; margin-bottom:20px;" loading="lazy"/></p><p>${htmlBody}</p>`;
                if (content.hashtags?.length) {
                    htmlBody += `<p style="color:#6366f1; margin-top:20px;">${content.hashtags.map(t => '#' + t).join(' ')}</p>`;
                }

                // blog_posts에 게시
                const seoMeta = JSON.stringify({
                    meta_description: content.meta_description || '',
                    focus_keyword: focusKw,
                    hashtags: content.hashtags || [],
                    og_image: thumbnailUrl
                });
                const { data: inserted, error: postErr } = await sb.from('blog_posts').insert({
                    category: 'blog',
                    country_code: cfg.countryCode,
                    title: content.title || title,
                    content: htmlBody,
                    author_name: authorName,
                    author_email: user?.email || '',
                    author_id: user?.id || null,
                    thumbnail: thumbnailUrl,
                    markdown: seoMeta
                }).select('id').single();
                if (postErr) throw new Error(postErr.message);

                // JA 블로그일 때 SNS 자동 포스팅 (일본 마케팅 포커스)
                if (inserted && lang === 'ja') {
                    const blogUrl = 'https://' + cfg.site + '/board?cat=blog&country=' + cfg.countryCode + '&id=' + inserted.id;
                    const metaDesc = content.meta_description || (content.body || '').substring(0, 150);
                    await _socialPostAfterBlog(content.title || title, metaDesc, blogUrl, thumbnailUrl, content.hashtags || [], console.log);
                }

                results.blogs++;
                _wpStep(stepId, 'done');
            } catch(e) {
                console.error(`블로그 ${lang} 실패:`, e);
                _wpStep(stepId, 'error');
            }

            // API 부하 방지
            await new Promise(r => setTimeout(r, 1500));
        }

        // Google sitemap ping
        if (results.blogs > 0) {
            ['https://www.cafe2626.com/sitemap.xml','https://www.cafe0101.com/sitemap.xml','https://www.cafe3355.com/sitemap.xml'].forEach(url => {
                fetch('https://www.google.com/ping?sitemap=' + encodeURIComponent(url), { mode: 'no-cors' }).catch(() => {});
            });
        }

        // ──────── STEP 3: 일본어 YouTube 쇼츠 ────────
        try {
            // 3a: AI 콘텐츠 생성
            _wpStep('wp-shorts-ai', 'active');
            let thumbFile = thumb?.file || wizImages[0]?.file;
            // file이 없으면 URL에서 fetch해서 blob으로 변환
            if (!thumbFile) {
                const thumbUrl = thumb?.url || wizImages[0]?.url;
                if (!thumbUrl) throw new Error('쇼츠용 이미지가 없습니다.');
                const resp = await fetch(thumbUrl);
                const blob = await resp.blob();
                thumbFile = new File([blob], 'thumb.jpg', { type: blob.type });
            }

            const base64 = await _wizResizeToBase64(thumbFile, 1024);
            const { data: shortsData, error: shortsErr } = await sb.functions.invoke('marketing-content', {
                body: {
                    platform: 'youtube_shorts_from_image',
                    topic: title + ' - 半額印刷の裏ワザ カメレオンプリンティング',
                    tone: 'fast_energetic',
                    lang: 'ja',
                    instructions: 'MUST write everything in 日本語 (Japanese) ONLY. No Korean. 早口で商品を紹介するショート動画のナレーションを日本語で生成してください。cafe0101.comを必ず言及してください。narration配列に5つの文を入れてください。タイトル、説明、ハッシュタグもすべて日本語で。',
                    coreKeywords: settings.coreKeywords || '',
                    usp: settings.usp || '',
                    ctaMsg: settings.ctaMsg || '',
                    imageBase64: base64
                }
            });
            if (shortsErr) throw new Error(shortsErr.message);
            const shortsContent = shortsData?.content || shortsData;
            if (shortsContent?.error) throw new Error(shortsContent.error);
            _wpStep('wp-shorts-ai', 'done');

            // 3b: TTS 음성 생성
            _wpStep('wp-shorts-tts', 'active');
            const narrationTexts = shortsContent.narration || [];
            let audioCtx, audioBuffer, hasTTS = false;
            if (narrationTexts.length > 0) {
                const tts = await _wizGenerateTTS(narrationTexts, 'ja');
                audioCtx = tts.audioCtx;
                audioBuffer = tts.audioBuffer;
                hasTTS = true;
            }
            _wpStep('wp-shorts-tts', 'done');

            // 3c: 영상 렌더링 (모든 이미지로 슬라이드쇼)
            _wpStep('wp-shorts-render', 'active');
            // wizImages에서 모든 이미지 파일 수집
            const allShortsFiles = [];
            for (const wImg of wizImages) {
                if (wImg.file) { allShortsFiles.push(wImg.file); }
                else if (wImg.url) {
                    const r = await fetch(wImg.url);
                    const b = await r.blob();
                    allShortsFiles.push(new File([b], 'img.jpg', { type: b.type }));
                }
            }
            const shortsFiles = allShortsFiles.length > 0 ? allShortsFiles : [thumbFile];
            const videoBlob = await _wizRenderShortsVideo(shortsFiles, shortsContent, hasTTS ? audioCtx : null, hasTTS ? audioBuffer : null, 'ja');
            _wpStep('wp-shorts-render', 'done');

            // 3d: YouTube 업로드
            _wpStep('wp-shorts-upload', 'active');
            const ytTitle = shortsContent.title || title + ' #Shorts';
            const ytDesc = shortsContent.body || title;
            const ytTags = shortsContent.hashtags || [];
            if (!ytTags.includes('Shorts')) ytTags.unshift('Shorts');

            const ytResult = await _wizUploadYoutube(videoBlob, ytTitle, ytDesc, ytTags);
            _wpStep('wp-shorts-upload', 'done');
            results.shorts = ytResult?.id || true;

            // marketing_content에 기록
            try {
                await sb.from('marketing_content').insert({
                    platform: 'youtube_shorts',
                    title: ytTitle,
                    body: ytDesc,
                    hashtags: ytTags,
                    thumbnail_prompt: '',
                    status: 'published',
                    published_at: new Date().toISOString()
                });
            } catch(_) {}

        } catch(shortsErr) {
            console.error('쇼츠 파이프라인 실패:', shortsErr);
            ['wp-shorts-ai','wp-shorts-tts','wp-shorts-render','wp-shorts-upload'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.classList.contains('active')) _wpStep(id, 'error');
            });
        }

    } catch(e) {
        console.error('파이프라인 오류:', e);
        showToast('파이프라인 오류: ' + e.message, 'error');
    }

    // 결과 표시
    pipeResult.style.display = 'block';
    pipeResult.innerHTML = `
        <div style="text-align:center;">
            <p style="font-weight:800; font-size:16px; color:#1e1b4b; margin-bottom:8px;">
                ${results.save ? '✅' : '❌'} 상품 저장 &nbsp;|&nbsp;
                ✅ 블로그 ${results.blogs}/8개 &nbsp;|&nbsp;
                ${results.shorts ? '✅' : '❌'} 쇼츠
            </p>
            ${results.shorts && typeof results.shorts === 'string' ? `<a href="https://youtube.com/shorts/${results.shorts}" target="_blank" style="color:#6366f1; font-size:13px;">YouTube에서 보기</a>` : ''}
        </div>`;

    pipeBtn.disabled = false;
    pipeBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> 원클릭 자동 파이프라인';
    showToast(`파이프라인 완료! 상품 저장${results.save?'✅':'❌'} / 블로그 ${results.blogs}개 / 쇼츠${results.shorts?'✅':'❌'}`, 'success');
};

// ★ 기존 상품 → 블로그 + 쇼츠만 바로 실행 (상세페이지 재생성 없이)
window.wizRunDirectPipeline = async () => {
    const sel = document.getElementById('wizExistingSelect');
    let prodId = sel?.value || '';
    if (!prodId && sel && sel.selectedIndex >= 0) prodId = sel.options[sel.selectedIndex]?.value;
    if (!prodId && window.editingProdId) prodId = window.editingProdId;
    if (!prodId) { showToast('상품을 먼저 선택해주세요.', 'warn'); return; }

    const directBtn = document.getElementById('wizDirectPipeBtn');
    directBtn.disabled = true;
    directBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 실행 중...';

    // 파이프라인 UI 표시
    const pipeSection = document.getElementById('wizPipelineSection');
    const pipeResult = document.getElementById('wizPipelineResult');
    pipeSection.style.display = 'block';
    pipeResult.style.display = 'none';
    pipeSection.scrollIntoView({ behavior: 'smooth' });

    // 스텝 초기화 (상품 저장은 스킵 표시)
    ['wp-save','wp-blog-kr','wp-blog-ja','wp-blog-en','wp-blog-cn','wp-blog-ar','wp-blog-es','wp-blog-de','wp-blog-fr','wp-shorts-ai','wp-shorts-tts','wp-shorts-render','wp-shorts-upload'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = 'wp-step';
    });
    _wpStep('wp-save', 'done'); // 이미 저장된 상품

    // DB에서 상품 정보 로드
    const { data: prod, error: loadErr } = await sb.from('admin_products')
        .select('id, name, category, price, img_url')
        .eq('id', prodId).single();
    if (loadErr || !prod) {
        showToast('상품 정보 로드 실패', 'error');
        directBtn.disabled = false;
        directBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> 블로그 + 쇼츠만 바로 실행';
        return;
    }

    const title = prod.name || '';
    const category = prod.category || '';
    const thumbnailUrl = prod.img_url || '';
    const results = { blogs: 0, shorts: false };
    let settings = {}; try { settings = JSON.parse(localStorage.getItem('mkt_settings') || '{}'); } catch(e) {}

    try {
        // ──────── 블로그 8개국 ────────
        const blogLangs = ['kr','ja','en','cn','ar','es','de','fr'];
        const { data: { user } } = await sb.auth.getUser();
        const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '카멜레온';

        for (const lang of blogLangs) {
            const stepId = 'wp-blog-' + lang;
            _wpStep(stepId, 'active');
            try {
                const cfg = _wizLangConfig[lang];
                const { data: aiData, error: aiErr } = await sb.functions.invoke('marketing-content', {
                    body: {
                        platform: 'blog',
                        topic: title + ' - 카멜레온프린팅 제품 소개',
                        tone: 'professional',
                        lang: lang,
                        instructions: `${cfg.site}에 게시될 ${cfg.label} 제품 블로그입니다. 상품명: ${title}. 카테고리: ${category}. 웹사이트: https://${cfg.site}`,
                        coreKeywords: settings.coreKeywords || '',
                        usp: settings.usp || '',
                        ctaMsg: settings.ctaMsg || ''
                    }
                });
                if (aiErr) throw new Error(aiErr.message);
                const content = aiData?.content || aiData;
                if (content?.error) throw new Error(content.error);

                const focusKw = content.focus_keyword || '';
                let htmlBody = (content.body || '')
                    .replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
                    .replace(/## (.*)/g, '<h2>$1</h2>').replace(/### (.*)/g, '<h3>$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                htmlBody = `<p><img src="${thumbnailUrl}" alt="${focusKw || title}" style="max-width:100%; border-radius:12px; margin-bottom:20px;" loading="lazy"/></p><p>${htmlBody}</p>`;
                if (content.hashtags?.length) htmlBody += `<p style="color:#6366f1; margin-top:20px;">${content.hashtags.map(t => '#' + t).join(' ')}</p>`;

                const seoMeta = JSON.stringify({ meta_description: content.meta_description || '', focus_keyword: focusKw, hashtags: content.hashtags || [], og_image: thumbnailUrl });
                const { error: postErr } = await sb.from('blog_posts').insert({
                    category: 'blog', country_code: cfg.countryCode,
                    title: content.title || title, content: htmlBody,
                    author_name: authorName, author_email: user?.email || '', author_id: user?.id || null,
                    thumbnail: thumbnailUrl, markdown: seoMeta
                });
                if (postErr) throw new Error(postErr.message);
                results.blogs++;
                _wpStep(stepId, 'done');
            } catch(e) {
                console.error(`블로그 ${lang} 실패:`, e);
                _wpStep(stepId, 'error');
            }
            await new Promise(r => setTimeout(r, 1500));
        }

        // Google sitemap ping
        if (results.blogs > 0) {
            ['https://www.cafe2626.com/sitemap.xml','https://www.cafe0101.com/sitemap.xml','https://www.cafe3355.com/sitemap.xml'].forEach(url => {
                fetch('https://www.google.com/ping?sitemap=' + encodeURIComponent(url), { mode: 'no-cors' }).catch(() => {});
            });
        }

        // ──────── 일본어 YouTube 쇼츠 ────────
        try {
            _wpStep('wp-shorts-ai', 'active');
            if (!thumbnailUrl) throw new Error('상품 이미지가 없습니다.');
            const resp = await fetch(thumbnailUrl);
            const blob = await resp.blob();
            const thumbFile = new File([blob], 'thumb.jpg', { type: blob.type });
            const base64 = await _wizResizeToBase64(thumbFile, 1024);

            const { data: shortsData, error: shortsErr } = await sb.functions.invoke('marketing-content', {
                body: {
                    platform: 'youtube_shorts_from_image',
                    topic: title + ' - 半額印刷の裏ワザ カメレオンプリンティング',
                    tone: 'fast_energetic', lang: 'ja',
                    instructions: 'MUST write everything in 日本語 (Japanese) ONLY. No Korean. 早口で商品を紹介するショート動画のナレーションを日本語で生成してください。cafe0101.comを必ず言及してください。narration配列に5つの文を入れてください。タイトル、説明、ハッシュタグもすべて日本語で。',
                    coreKeywords: settings.coreKeywords || '', usp: settings.usp || '', ctaMsg: settings.ctaMsg || '',
                    imageBase64: base64
                }
            });
            if (shortsErr) throw new Error(shortsErr.message);
            const shortsContent = shortsData?.content || shortsData;
            if (shortsContent?.error) throw new Error(shortsContent.error);
            _wpStep('wp-shorts-ai', 'done');

            _wpStep('wp-shorts-tts', 'active');
            const narrationTexts = shortsContent.narration || [];
            let audioCtx, audioBuffer, hasTTS = false;
            if (narrationTexts.length > 0) {
                const tts = await _wizGenerateTTS(narrationTexts, 'ja');
                audioCtx = tts.audioCtx; audioBuffer = tts.audioBuffer; hasTTS = true;
            }
            _wpStep('wp-shorts-tts', 'done');

            _wpStep('wp-shorts-render', 'active');
            // wizImages에 추가 사진이 있으면 슬라이드쇼로, 아니면 기본 1장
            const directShortsFiles = [];
            if (wizImages.length > 0) {
                for (const wImg of wizImages) {
                    if (wImg.file) { directShortsFiles.push(wImg.file); }
                    else if (wImg.url) {
                        const r2 = await fetch(wImg.url);
                        const b2 = await r2.blob();
                        directShortsFiles.push(new File([b2], 'img.jpg', { type: b2.type }));
                    }
                }
            }
            const dShortsFiles = directShortsFiles.length > 0 ? directShortsFiles : [thumbFile];
            const videoBlob = await _wizRenderShortsVideo(dShortsFiles, shortsContent, hasTTS ? audioCtx : null, hasTTS ? audioBuffer : null, 'ja');
            _wpStep('wp-shorts-render', 'done');

            _wpStep('wp-shorts-upload', 'active');
            const ytTitle = shortsContent.title || title + ' #Shorts';
            const ytTags = shortsContent.hashtags || [];
            if (!ytTags.includes('Shorts')) ytTags.unshift('Shorts');
            const ytResult = await _wizUploadYoutube(videoBlob, ytTitle, shortsContent.body || title, ytTags);
            _wpStep('wp-shorts-upload', 'done');
            results.shorts = ytResult?.id || true;

            try { await sb.from('marketing_content').insert({ platform: 'youtube_shorts', title: ytTitle, body: shortsContent.body || '', hashtags: ytTags, status: 'published', published_at: new Date().toISOString() }); } catch(_) {}
        } catch(shortsErr) {
            console.error('쇼츠 실패:', shortsErr);
            ['wp-shorts-ai','wp-shorts-tts','wp-shorts-render','wp-shorts-upload'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.classList.contains('active')) _wpStep(id, 'error');
            });
        }
    } catch(e) {
        console.error('다이렉트 파이프라인 오류:', e);
        showToast(_t('err_prefix','Error: ') + e.message, 'error');
    }

    pipeResult.style.display = 'block';
    pipeResult.innerHTML = `<div style="text-align:center;"><p style="font-weight:800; font-size:16px; color:#1e1b4b;">✅ 블로그 ${results.blogs}/8개 &nbsp;|&nbsp; ${results.shorts ? '✅' : '❌'} 쇼츠</p>
        ${results.shorts && typeof results.shorts === 'string' ? `<a href="https://youtube.com/shorts/${results.shorts}" target="_blank" style="color:#6366f1; font-size:13px;">YouTube에서 보기</a>` : ''}</div>`;
    directBtn.disabled = false;
    directBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> 블로그 + 쇼츠만 바로 실행';
    showToast(`완료! 블로그 ${results.blogs}개 / 쇼츠${results.shorts?'✅':'❌'}`, 'success');
};

// ── 이미지 리사이즈 → base64 ──
function _wizResizeToBase64(file, maxDim) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(cv.toDataURL('image/jpeg', 0.85).split(',')[1]);
            URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// ── TTS 음성 생성 (OpenAI via Supabase) ──
async function _wizGenerateTTS(texts, lang) {
    const supabaseUrl = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
    const resp = await fetch(`${supabaseUrl}/functions/v1/tts-generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ texts, lang, speed: 1.05 })
    });
    if (!resp.ok) throw new Error('TTS 생성 실패: ' + await resp.text());
    const mp3Buffer = await resp.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(mp3Buffer);
    return { audioCtx, audioBuffer };
}

// ── Canvas 텍스트 줄바꿈 ──
function _wizWrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    const words = text.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return [text];
    const lines = [];
    let cur = '';
    words.forEach(word => {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = word; }
        else cur = test;
    });
    if (cur) lines.push(cur);
    const result = [];
    lines.forEach(line => {
        if (ctx.measureText(line).width > maxWidth * 1.2) {
            let sub = '';
            for (const ch of line) {
                if (ctx.measureText(sub + ch).width > maxWidth && sub) { result.push(sub); sub = ch; }
                else sub += ch;
            }
            if (sub) result.push(sub);
        } else result.push(line);
    });
    return result.length > 0 ? result : [text];
}

// ── 쇼츠 영상 렌더링 (Canvas + TTS) ──
// imageFiles: File[] 또는 [{file, url}] — 여러 장 순서대로 슬라이드쇼
async function _wizRenderShortsVideo(imageFiles, aiContent, audioCtx, audioBuffer, lang) {
    // imageFiles를 배열로 정규화
    const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles];

    return new Promise(async (resolve, reject) => {
        try {
            // 모든 이미지 미리 로드
            const imgs = [];
            const imgUrls = [];
            for (let fi = 0; fi < files.length; fi++) {
                const f = files[fi];
                const im = new Image();
                im.crossOrigin = 'anonymous';
                let u;
                if (f instanceof File || f instanceof Blob) {
                    u = URL.createObjectURL(f);
                } else if (typeof f === 'string') {
                    u = f;
                } else {
                    u = f.url || f.preview || '';
                }
                imgUrls.push(u);
                await new Promise((res, rej) => {
                    im.onload = () => {
                        console.log(`[Shorts] Image ${fi+1}/${files.length} loaded: ${im.width}x${im.height}`);
                        res();
                    };
                    im.onerror = (e) => {
                        console.error(`[Shorts] Image ${fi+1} load failed:`, u, e);
                        rej(new Error(`Image ${fi+1} load failed`));
                    };
                    im.src = u;
                });
                if (im.width === 0 || im.height === 0) {
                    console.warn(`[Shorts] Image ${fi+1} has zero dimensions, skipping`);
                    continue;
                }
                imgs.push(im);
            }
            if (imgs.length === 0) throw new Error('No valid images loaded for shorts video');
            console.log(`[Shorts] Total ${imgs.length} images ready for slideshow`);

            const W = 1080, H = 1920;
            const cvs = document.getElementById('wizShortsCanvas');
            // display:none 캔버스는 captureStream이 검은 화면을 생성하므로 반드시 off-screen으로
            cvs.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;height:1920px;';
            cvs.width = W; cvs.height = H;
            const ctx = cvs.getContext('2d');

            // 테스트 프레임: 캔버스가 제대로 렌더링되는지 확인
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(imgs[0], 0, 0, W, H);
            console.log('[Shorts] Canvas test frame drawn OK');

            const narrationTexts = aiContent.narration || [];
            const overlays = aiContent.overlay_texts || {};
            const hasTTS = !!(audioCtx && audioBuffer);

            let durationSec = 30;
            let audioSource, audioDest;
            if (hasTTS) {
                durationSec = Math.max(15, Math.min(59, Math.ceil(audioBuffer.duration) + 2));
                audioDest = audioCtx.createMediaStreamDestination();
                audioSource = audioCtx.createBufferSource();
                audioSource.buffer = audioBuffer;
                audioSource.connect(audioDest);
            }

            const videoStream = cvs.captureStream(30);
            const combinedStream = hasTTS
                ? new MediaStream([...videoStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()])
                : videoStream;

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
            const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5000000 });
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                imgUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch(_){} });
                if (audioCtx) audioCtx.close();
                resolve(blob);
            };
            recorder.onerror = (e) => reject(e.error || new Error('MediaRecorder error'));

            // 자막 타이밍
            const segCount = narrationTexts.length || 5;
            const segDur = 1.0 / segCount;
            const textSegments = [];
            const captionTexts = narrationTexts.length > 0 ? narrationTexts : [
                overlays.hook || aiContent.title || '',
                overlays.main || '', overlays.detail || '', overlays.cta || ''
            ];
            captionTexts.forEach((text, i) => {
                if (!text) return;
                textSegments.push({
                    text, start: i * segDur, end: (i + 1) * segDur - 0.02,
                    fontSize: i === 0 ? 44 : i === captionTexts.length - 1 ? 42 : 38, y: 0.72
                });
            });

            // 이미지 슬라이드 계산 (각 이미지에 균등 시간 배분)
            const imgCount = imgs.length;
            const imgDur = 1.0 / imgCount; // 0~1 비율

            const totalMs = durationSec * 1000;
            const startTime = performance.now();
            const accentColor = aiContent.video_style?.color_accent || '#a78bfa';

            recorder.start(100);
            if (hasTTS && audioSource) audioSource.start(0);

            let _frameCount = 0;
            const _FPS = 30;
            const _frameInterval = 1000 / _FPS;

            function drawFrame() {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / totalMs, 1.0);
                _frameCount++;

                // 검은 배경
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, W, H);

                // 현재 이미지 결정 (균등 시간 배분)
                const imgIdx = Math.min(Math.floor(progress / imgDur), imgCount - 1);
                const img = imgs[imgIdx];
                if (!img || !img.width || !img.height) {
                    if (progress < 1.0) { setTimeout(drawFrame, _frameInterval); } else { setTimeout(() => recorder.stop(), 300); }
                    return;
                }

                // 이미지를 캔버스에 꽉 차게 (cover 방식)
                const imgAspect = img.width / img.height;
                const canvasAspect = W / H;
                let drawW, drawH, drawX, drawY;
                if (imgAspect > canvasAspect) {
                    drawH = H; drawW = H * imgAspect;
                    drawX = (W - drawW) / 2; drawY = 0;
                } else {
                    drawW = W; drawH = W / imgAspect;
                    drawX = 0; drawY = (H - drawH) / 2;
                }
                ctx.drawImage(img, drawX, drawY, drawW, drawH);

                // 하단 그라데이션 (자막 배경)
                const botGrad = ctx.createLinearGradient(0, H * 0.6, 0, H);
                botGrad.addColorStop(0, 'rgba(0,0,0,0)');
                botGrad.addColorStop(0.3, 'rgba(0,0,0,0.55)');
                botGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
                ctx.fillStyle = botGrad;
                ctx.fillRect(0, H * 0.55, W, H * 0.45);

                // 자막 렌더링
                textSegments.forEach(seg => {
                    if (progress >= seg.start && progress <= seg.end && seg.text) {
                        const segP = (progress - seg.start) / (seg.end - seg.start);
                        let alpha = 1;
                        if (segP < 0.06) alpha = segP / 0.06;
                        else if (segP > 0.94) alpha = (1 - segP) / 0.06;
                        alpha = Math.max(0, Math.min(1, alpha));

                        const charProgress = Math.min(segP * 2.0, 1.0);
                        const visibleChars = Math.ceil(seg.text.length * charProgress);
                        const displayText = seg.text.substring(0, visibleChars);

                        ctx.save();
                        ctx.globalAlpha = alpha;
                        ctx.textAlign = 'center';
                        ctx.font = `800 ${seg.fontSize}px "Pretendard", "Noto Sans JP", "Inter", sans-serif`;
                        const maxW = W - 120;
                        const lines = _wizWrapText(ctx, displayText, maxW);
                        const lineH = seg.fontSize * 1.45;
                        const startY = H * seg.y - ((lines.length - 1) * lineH) / 2;

                        lines.forEach((line, li) => {
                            const y = startY + li * lineH;
                            const tw = ctx.measureText(line).width;
                            const pad = 18;
                            ctx.fillStyle = 'rgba(0,0,0,0.55)';
                            ctx.beginPath();
                            if (ctx.roundRect) ctx.roundRect(W/2 - tw/2 - pad, y - seg.fontSize + 2, tw + pad*2, seg.fontSize + pad, 10);
                            else ctx.rect(W/2 - tw/2 - pad, y - seg.fontSize + 2, tw + pad*2, seg.fontSize + pad);
                            ctx.fill();
                        });
                        lines.forEach((line, li) => {
                            const y = startY + li * lineH;
                            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                            ctx.lineWidth = 6; ctx.lineJoin = 'round';
                            ctx.strokeText(line, W / 2, y);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(line, W / 2, y);
                        });
                        ctx.restore();
                    }
                });

                // 진행률 바
                const barGrad = ctx.createLinearGradient(0, 0, W * progress, 0);
                barGrad.addColorStop(0, accentColor);
                barGrad.addColorStop(1, '#ffffff');
                ctx.fillStyle = barGrad;
                ctx.fillRect(0, H - 6, W * progress, 6);

                // 브랜드 워터마크
                ctx.save();
                ctx.globalAlpha = 0.8;
                ctx.font = '700 28px "Pretendard", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 4; ctx.lineJoin = 'round';
                const domainByLang = { kr: 'cafe2626.com', ja: 'cafe0101.com', en: 'cafe3355.com' };
                const brandText = '\ud83e\udd8e \u30ab\u30e1\u30ec\u30aa\u30f3\u30d7\u30ea\u30f3\u30c6\u30a3\u30f3\u30b0 | ' + (domainByLang[lang] || 'cafe0101.com');
                ctx.strokeText(brandText, W / 2, 55);
                ctx.fillText(brandText, W / 2, 55);
                ctx.restore();

                if (progress < 1.0) {
                    setTimeout(drawFrame, _frameInterval);
                } else {
                    console.log(`[Shorts] Rendering complete. Total frames: ${_frameCount}`);
                    if (audioSource) try { audioSource.stop(); } catch(e) {}
                    setTimeout(() => recorder.stop(), 300);
                }
            }

            // setTimeout 사용 (requestAnimationFrame은 탭 비활성시 스로틀링됨)
            setTimeout(drawFrame, 10);
        } catch (err) { reject(err); }
    });
}

// ── YouTube 업로드 ──
async function _wizUploadYoutube(videoBlob, title, description, tags) {
    // 토큰 가져오기
    const { data: config } = await sb.from('marketing_youtube_config')
        .select('id, access_token, refresh_token, client_id, client_secret, token_expires_at')
        .limit(1).single();
    if (!config?.access_token) throw new Error('YouTube 채널이 연결되지 않았습니다. 마케팅봇에서 먼저 연결하세요.');

    let accessToken = config.access_token;

    // 토큰 만료 체크 (5분 여유)
    const expiresAt = config.token_expires_at ? new Date(config.token_expires_at).getTime() : 0;
    if (Date.now() >= expiresAt - 300000) {
        if (!config.refresh_token) throw new Error('Refresh token이 없습니다.');
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.client_id,
                client_secret: config.client_secret,
                refresh_token: config.refresh_token,
                grant_type: 'refresh_token'
            })
        });
        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error('토큰 갱신 실패: ' + (tokens.error_description || tokens.error));
        await sb.from('marketing_youtube_config').update({
            access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()
        }).eq('id', config.id);
        accessToken = tokens.access_token;
    }

    // 업로드
    const metadata = {
        snippet: { title, description, tags, categoryId: '22' },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
    };

    const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': videoBlob.size,
            'X-Upload-Content-Type': videoBlob.type
        },
        body: JSON.stringify(metadata)
    });
    if (!initRes.ok) throw new Error('YouTube 업로드 초기화 실패: ' + await initRes.text());
    const uploadUrl = initRes.headers.get('Location');

    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoBlob.type },
        body: videoBlob
    });
    if (!uploadRes.ok) throw new Error('YouTube 업로드 실패: ' + uploadRes.status);
    return await uploadRes.json();
}

// ═══════════════════════════════════════════════════════════════
// ★★★ 자동 상세페이지 구축 시스템 (Auto Detail Page Builder) ★★★
// ═══════════════════════════════════════════════════════════════

let _adpProducts = [];       // 대상 상품 목록
let _adpIndex = 0;           // 현재 처리 인덱스
// 제외할 대분류 카테고리 (실사출력소재, 패브릭부스, 종이매대, 보드류도매)
const _adpSkipTopCategories = ['99999', '23434242', 'paper_display', 'Wholesale Board Prices'];
let _adpRunning = false;     // 실행 중 여부
let _adpStopReq = false;     // 중지 요청
let _adpDoneCount = 0;
let _adpFailCount = 0;
let _adpReport = [];         // 작업 리포트 (밤새 작업 결과)
let _adpShortsCount = 0;     // 오늘 생성한 쇼츠 수

// ── 모달 열기 ──
window.openAutoDetailBuilder = function() {
    document.getElementById('adpModal').style.display = 'flex';
    // 이전 진행 상태 확인
    const saved = _adpLoadProgress();
    if (saved && saved.remaining > 0) {
        document.getElementById('adpBtnResume').style.display = '';
        _adpLog('⏸ 이전 진행이 있습니다: ' + saved.done + '/' + (saved.done + saved.remaining) + ' 완료. "이어서 진행" 클릭.');
    }
};

// ── 대상 상품 스캔 ──
window.adpScanProducts = async function() {
    const btn = document.getElementById('adpBtnScan');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 스캔 중...';
    _adpLog('🔍 전체 상품 조회 중...');

    try {
        // 카테고리 로드 → 제외 대분류에 속한 서브카테고리 코드 수집
        const { data: catData } = await sb.from('admin_categories')
            .select('code, top_category_code');
        const skipSubCats = new Set();
        (catData || []).forEach(c => {
            if (_adpSkipTopCategories.includes(c.top_category_code) || _adpSkipTopCategories.includes(c.code)) {
                skipSubCats.add(c.code);
            }
        });

        const { data, error } = await sb.from('admin_products')
            .select('id, name, code, category, price, img_url, description')
            .order('created_at', { ascending: false });
        if (error) throw error;

        _adpProducts = (data || []).filter(p => {
            if (skipSubCats.has(p.category)) return false;
            return _adpNeedsGeneration(p);
        });
        _adpIndex = 0;
        _adpDoneCount = 0;
        _adpFailCount = 0;

        document.getElementById('adpStatTotal').textContent = _adpProducts.length;
        document.getElementById('adpStatDone').textContent = '0';
        document.getElementById('adpStatFail').textContent = '0';
        const eta = _adpProducts.length * 5;
        document.getElementById('adpStatEta').textContent = eta < 60 ? eta + '분' : Math.round(eta / 60 * 10) / 10 + '시간';
        document.getElementById('adpProgressBar').style.width = '0%';

        _adpLog('✅ 총 ' + data.length + '개 상품 중 ' + _adpProducts.length + '개 대상 감지');
        if (_adpProducts.length > 0) {
            _adpProducts.slice(0, 5).forEach(p => _adpLog('   • ' + p.name + (p.category ? ' [' + p.category + ']' : '')));
            if (_adpProducts.length > 5) _adpLog('   ... 외 ' + (_adpProducts.length - 5) + '개');
            document.getElementById('adpBtnStart').disabled = false;
        } else {
            _adpLog('🎉 모든 상품에 상세페이지가 이미 있습니다.');
        }
    } catch(e) {
        _adpLog('❌ 스캔 실패: ' + e.message);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 대상 상품 스캔';
};

// ── 대상 판별 (이미지 1장 이하인 모든 상품) ──
function _adpNeedsGeneration(p) {
    if (!p.img_url) return false;
    const desc = (p.description || '').trim();
    // 이미 마법사로 생성된 상세페이지 → skip
    if (desc.includes('#0f3460') || desc.includes('#1a1a2e')) return false;
    // 상세페이지 내 이미지 1장 이하 → 대상 (글자수 무관)
    const imgCount = (desc.match(/<img\s/gi) || []).length;
    return imgCount <= 1;
}

// ── 시작 ──
window.adpStart = async function() {
    if (_adpRunning) return;
    if (_adpProducts.length === 0) { _adpLog('⚠ 먼저 스캔을 실행해주세요.'); return; }

    _adpRunning = true;
    _adpStopReq = false;
    _adpReport = [];
    _adpShortsCount = await _adpGetTodayShortsCount();
    const el = document.getElementById('adpShortsCount');
    if (el) el.textContent = _adpShortsCount;
    document.getElementById('adpBtnStart').style.display = 'none';
    document.getElementById('adpBtnScan').style.display = 'none';
    document.getElementById('adpBtnStop').style.display = '';
    document.getElementById('adpBtnResume').style.display = 'none';
    _adpLog('🚀 자동 구축 시작! (' + _adpProducts.length + '개 상품, 오늘 쇼츠 ' + _adpShortsCount + '/7)');
    _adpProcessLoop();
};

// ── 중지 ──
window.adpStop = function() {
    _adpStopReq = true;
    _adpLog('⏹ 중지 요청됨. 현재 상품 완료 후 중지합니다...');
};

// ── 이어하기 ──
window.adpResume = async function() {
    const saved = _adpLoadProgress();
    if (!saved || saved.remaining === 0) { _adpLog('⚠ 이전 진행 상태가 없습니다.'); return; }

    _adpLog('🔄 이전 진행 복원 중...');
    const { data, error } = await sb.from('admin_products')
        .select('id, name, code, category, price, img_url, description')
        .in('id', saved.remainingIds);
    if (error) { _adpLog('❌ 복원 실패: ' + error.message); return; }

    _adpProducts = (data || []).filter(_adpNeedsGeneration);
    _adpIndex = 0;
    _adpDoneCount = saved.done;
    _adpFailCount = saved.fail || 0;
    _adpReport = [];
    _adpShortsCount = await _adpGetTodayShortsCount();
    const el = document.getElementById('adpShortsCount');
    if (el) el.textContent = _adpShortsCount;

    document.getElementById('adpStatTotal').textContent = _adpDoneCount + _adpProducts.length;
    document.getElementById('adpStatDone').textContent = _adpDoneCount;
    document.getElementById('adpStatFail').textContent = _adpFailCount;

    _adpLog('✅ ' + _adpProducts.length + '개 남은 상품 복원 완료 (오늘 쇼츠 ' + _adpShortsCount + '/7)');
    _adpRunning = true;
    _adpStopReq = false;
    document.getElementById('adpBtnStart').style.display = 'none';
    document.getElementById('adpBtnScan').style.display = 'none';
    document.getElementById('adpBtnStop').style.display = '';
    document.getElementById('adpBtnResume').style.display = 'none';
    _adpProcessLoop();
};

// ── 핵심 처리 루프 ──
async function _adpProcessLoop() {
    const delay = (parseInt(document.getElementById('adpOptDelay').value) || 3) * 1000;
    const total = _adpDoneCount + _adpFailCount + _adpProducts.length;

    while (_adpIndex < _adpProducts.length) {
        if (_adpStopReq) {
            _adpLog('⏹ 중지됨. ' + _adpDoneCount + '개 완료, ' + (_adpProducts.length - _adpIndex) + '개 남음.');
            _adpSaveProgress();
            _adpShowReport();
            _adpFinishUI();
            return;
        }

        const prod = _adpProducts[_adpIndex];
        const num = _adpDoneCount + _adpFailCount + 1;
        _adpLog('━━━ [' + num + '/' + total + '] ' + prod.name + ' ━━━');
        _adpShowCurrent(prod, '준비 중...');
        const report = { name: prod.name, id: prod.id, success: false, detail: false, blogCount: 0, shorts: false, sns: false, error: '' };

        try {
            const imageUrls = [prod.img_url];

            // ── STEP 1: AI 상세페이지 KR 생성 ──
            _adpShowCurrent(prod, '🤖 AI 상세페이지 생성 중...');
            _adpLog('  🤖 AI 상세페이지 HTML 생성 중...');
            const { data: aiData, error: aiErr } = await sb.functions.invoke('generate-product-detail', {
                body: {
                    product_name: prod.name,
                    product_category: prod.category || '',
                    image_urls: imageUrls,
                    image_url: prod.img_url,
                    price: prod.price || 0,
                    original_description: prod.description || '',
                    mode: 'wizard',
                    langs: ["kr", "jp", "us", "cn", "ar", "es", "de", "fr"]
                }
            });
            if (aiErr) throw new Error('AI 생성 실패: ' + (aiErr.message || aiErr));
            if (!aiData || !aiData.success) throw new Error('AI 생성 실패: ' + (aiData?.error || '응답 없음'));
            const krHtml = aiData.details?.kr;
            if (!krHtml) throw new Error('KR HTML이 비어있습니다.');
            _adpLog('  ✅ KR 상세페이지 생성 완료 (' + krHtml.length + '자)');

            // ── STEP 2: 7개국 번역 ──
            _adpShowCurrent(prod, '🌐 다국어 번역 중 (7개국)...');
            _adpLog('  🌐 7개 언어 번역 중...');
            const translations = { kr: krHtml };
            const targets = [
                { code: 'ja', key: 'jp' }, { code: 'en', key: 'us' },
                { code: 'zh-CN', key: 'cn' }, { code: 'ar', key: 'ar' },
                { code: 'es', key: 'es' }, { code: 'de', key: 'de' }, { code: 'fr', key: 'fr' }
            ];

            if (typeof window.googleTranslateSimple === 'function') {
                for (const t of targets) {
                    try {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = krHtml;
                        async function trNode(node) {
                            for (let child of node.childNodes) {
                                if (child.nodeType === 3 && child.nodeValue.trim().length > 0) {
                                    child.nodeValue = await window.googleTranslateSimple(child.nodeValue, t.code);
                                } else if (child.nodeType === 1 && child.tagName !== 'IMG') {
                                    await trNode(child);
                                }
                            }
                        }
                        await trNode(tempDiv);
                        translations[t.key] = tempDiv.innerHTML;
                    } catch(e) {
                        translations[t.key] = krHtml;
                    }
                }
                _adpLog('  ✅ 번역 완료');
            } else {
                targets.forEach(t => { translations[t.key] = krHtml; });
                _adpLog('  ⚠ googleTranslateSimple 없음 → KR 원문으로 저장');
            }

            // ── STEP 3: DB 저장 ──
            _adpShowCurrent(prod, '💾 DB 저장 중...');
            const { error: saveErr } = await sb.from('admin_products').update({
                description: translations.kr,
                description_jp: translations.jp || '',
                description_us: translations.us || '',
                description_cn: translations.cn || '',
                description_ar: translations.ar || '',
                description_es: translations.es || '',
                description_de: translations.de || '',
                description_fr: translations.fr || ''
            }).eq('id', prod.id);
            if (saveErr) throw new Error('DB 저장 실패: ' + saveErr.message);
            _adpLog('  ✅ 8개국 상세페이지 저장 완료');
            report.detail = true;

            // ── STEP 4: 블로그 8개국 (필수) ──
            _adpShowCurrent(prod, '📝 블로그 생성 중 (8개국)...');
            report.blogCount = await _adpGenerateBlogs(prod, imageUrls[0]);
            report.sns = true; // SNS는 블로그 내에서 JA일 때 자동 호출됨

            // ── STEP 5: YouTube 쇼츠 — 비활성화 (불필요) ──
            // _adpLog('  ⏭ 쇼츠 스킵');

            _adpDoneCount++;
            report.success = true;
            _adpLog('  🎉 완료!');

        } catch(e) {
            _adpFailCount++;
            report.error = e.message;
            _adpLog('  ❌ 실패: ' + e.message);
        }

        _adpReport.push(report);
        _adpIndex++;
        _adpUpdateProgress(total);
        _adpSaveProgress();

        // API 부하 방지 딜레이
        if (_adpIndex < _adpProducts.length) {
            await new Promise(r => setTimeout(r, delay));
        }
    }

    _adpShowReport();
    _adpLog('');
    _adpLog('🏁 전체 완료! 성공: ' + _adpDoneCount + ', 실패: ' + _adpFailCount + ', 쇼츠: ' + _adpShortsCount + '/7');
    localStorage.removeItem('adp_progress');
    _adpFinishUI();
}

// ── 블로그 생성 (8개국) ──
async function _adpGenerateBlogs(prod, thumbnailUrl) {
    const blogLangs = ['kr','ja','en','cn','ar','es','de','fr'];
    const { data: { user } } = await sb.auth.getUser();
    const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '카멜레온';
    let settings = {}; try { settings = JSON.parse(localStorage.getItem('mkt_settings') || '{}'); } catch(e) {}
    let blogCount = 0;

    for (const lang of blogLangs) {
        try {
            const cfg = _wizLangConfig[lang];
            if (!cfg) continue;
            const { data: aiData, error: aiErr } = await sb.functions.invoke('marketing-content', {
                body: {
                    platform: 'blog',
                    topic: prod.name + ' - 카멜레온프린팅 제품 소개',
                    tone: 'professional',
                    lang: lang,
                    instructions: cfg.site + '에 게시될 ' + cfg.label + ' 제품 블로그입니다. 상품명: ' + prod.name + '. 카테고리: ' + (prod.category || '') + '. 웹사이트: https://' + cfg.site,
                    coreKeywords: settings.coreKeywords || '',
                    usp: settings.usp || '',
                    ctaMsg: settings.ctaMsg || ''
                }
            });
            if (aiErr) throw new Error(aiErr.message);
            const content = aiData?.content || aiData;
            if (content?.error) throw new Error(content.error);

            const bodyText = content.body || '';
            const focusKw = content.focus_keyword || '';
            let htmlBody = bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
                .replace(/## (.*)/g, '<h2>$1</h2>').replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            htmlBody = '<p><img src="' + thumbnailUrl + '" alt="' + (focusKw || prod.name) + '" style="max-width:100%; border-radius:12px; margin-bottom:20px;" loading="lazy"/></p><p>' + htmlBody + '</p>';
            if (content.hashtags?.length) {
                htmlBody += '<p style="color:#6366f1; margin-top:20px;">' + content.hashtags.map(t => '#' + t).join(' ') + '</p>';
            }

            const seoMeta = JSON.stringify({ meta_description: content.meta_description || '', focus_keyword: focusKw, hashtags: content.hashtags || [], og_image: thumbnailUrl });
            const { data: inserted } = await sb.from('blog_posts').insert({
                category: 'blog', country_code: cfg.countryCode,
                title: content.title || prod.name, content: htmlBody,
                author_name: authorName, author_email: user?.email || '',
                author_id: user?.id || null, thumbnail: thumbnailUrl, markdown: seoMeta
            }).select('id').single();
            blogCount++;

            // JA 블로그일 때 SNS 자동 포스팅 (일본 마케팅 포커스)
            if (inserted && lang === 'ja') {
                const blogUrl = 'https://' + cfg.site + '/board?cat=blog&country=' + cfg.countryCode + '&id=' + inserted.id;
                const metaDesc = content.meta_description || (content.body || '').substring(0, 150);
                await _socialPostAfterBlog(content.title || prod.name, metaDesc, blogUrl, thumbnailUrl, content.hashtags || [], _adpLog);
            }
        } catch(e) {
            _adpLog('  ⚠ 블로그 ' + lang + ' 실패: ' + e.message);
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    _adpLog('  📝 블로그 ' + blogCount + '/8 생성 완료');
    return blogCount;
}

// ── UI 헬퍼 ──
function _adpLog(msg) {
    const area = document.getElementById('adpLogArea');
    if (!area) return;
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    area.innerHTML += '<div><span style="color:#64748b;">[' + time + ']</span> ' + msg + '</div>';
    area.scrollTop = area.scrollHeight;
}

function _adpShowCurrent(prod, step) {
    const wrap = document.getElementById('adpCurrentWrap');
    wrap.style.display = '';
    document.getElementById('adpCurrentImg').src = prod.img_url || '';
    document.getElementById('adpCurrentName').textContent = prod.name;
    document.getElementById('adpCurrentStep').textContent = step;
}

function _adpUpdateProgress(total) {
    const done = _adpDoneCount + _adpFailCount;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    document.getElementById('adpProgressBar').style.width = pct + '%';
    document.getElementById('adpStatDone').textContent = _adpDoneCount;
    document.getElementById('adpStatFail').textContent = _adpFailCount;
    const remaining = total - done;
    const eta = remaining * 5;
    document.getElementById('adpStatEta').textContent = remaining === 0 ? '완료!' : (eta < 60 ? eta + '분' : Math.round(eta / 60 * 10) / 10 + '시간');
}

function _adpFinishUI() {
    _adpRunning = false;
    document.getElementById('adpBtnStart').style.display = '';
    document.getElementById('adpBtnStart').disabled = true;
    document.getElementById('adpBtnScan').style.display = '';
    document.getElementById('adpBtnStop').style.display = 'none';
    document.getElementById('adpCurrentWrap').style.display = 'none';
}

// ── 진행 상태 저장/복원 ──
function _adpSaveProgress() {
    const remainingIds = _adpProducts.slice(_adpIndex).map(p => p.id);
    localStorage.setItem('adp_progress', JSON.stringify({
        done: _adpDoneCount, fail: _adpFailCount,
        remaining: remainingIds.length, remainingIds: remainingIds,
        ts: Date.now()
    }));
}

function _adpLoadProgress() {
    try {
        const raw = localStorage.getItem('adp_progress');
        if (!raw) return null;
        const data = JSON.parse(raw);
        // 24시간 이상 지난 진행 상태는 무시
        if (Date.now() - data.ts > 24 * 60 * 60 * 1000) { localStorage.removeItem('adp_progress'); return null; }
        return data;
    } catch(e) { return null; }
}

// ── 오늘 쇼츠 수 조회 ──
async function _adpGetTodayShortsCount() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { count } = await sb.from('marketing_content')
            .select('id', { count: 'exact', head: true })
            .eq('platform', 'youtube_shorts')
            .gte('published_at', today + 'T00:00:00Z');
        return count || 0;
    } catch(e) { return 0; }
}

// ── ADP용 쇼츠 생성 (기존 wizRunPipeline 쇼츠 로직 재활용) ──
async function _adpGenerateShorts(prod) {
    let settings = {}; try { settings = JSON.parse(localStorage.getItem('mkt_settings') || '{}'); } catch(e) {}

    // 이미지 준비
    _adpLog('  🎬 쇼츠: 이미지 준비 중...');
    const resp = await fetch(prod.img_url);
    const blob = await resp.blob();
    const thumbFile = new File([blob], 'thumb.jpg', { type: blob.type });

    // AI 콘텐츠 생성
    _adpLog('  🎬 쇼츠: AI 콘텐츠 생성 중...');
    const base64 = await _wizResizeToBase64(thumbFile, 1024);
    const { data: shortsData, error: shortsErr } = await sb.functions.invoke('marketing-content', {
        body: {
            platform: 'youtube_shorts_from_image',
            topic: prod.name + ' - 半額印刷の裏ワザ カメレオンプリンティング',
            tone: 'fast_energetic',
            lang: 'ja',
            instructions: 'MUST write everything in 日本語 (Japanese) ONLY. No Korean. 早口で商品を紹介するショート動画のナレーションを日本語で生成してください。cafe0101.comを必ず言及してください。narration配列に5つの文を入れてください。タイトル、説明、ハッシュタグもすべて日本語で。',
            coreKeywords: settings.coreKeywords || '',
            usp: settings.usp || '',
            ctaMsg: settings.ctaMsg || '',
            imageBase64: base64
        }
    });
    if (shortsErr) throw new Error(shortsErr.message);
    const shortsContent = shortsData?.content || shortsData;
    if (shortsContent?.error) throw new Error(shortsContent.error);

    // TTS 음성 생성
    _adpLog('  🎬 쇼츠: TTS 음성 생성 중...');
    const narrationTexts = shortsContent.narration || [];
    let audioCtx = null, audioBuffer = null, hasTTS = false;
    if (narrationTexts.length > 0) {
        const tts = await _wizGenerateTTS(narrationTexts, 'ja');
        audioCtx = tts.audioCtx;
        audioBuffer = tts.audioBuffer;
        hasTTS = true;
    }

    // 영상 렌더링
    _adpLog('  🎬 쇼츠: 영상 렌더링 중...');
    const videoBlob = await _wizRenderShortsVideo([thumbFile], shortsContent, hasTTS ? audioCtx : null, hasTTS ? audioBuffer : null, 'ja');

    // YouTube 업로드
    _adpLog('  🎬 쇼츠: YouTube 업로드 중...');
    const ytTitle = shortsContent.title || prod.name + ' #Shorts';
    const ytDesc = shortsContent.body || prod.name;
    const ytTags = shortsContent.hashtags || [];
    if (!ytTags.includes('Shorts')) ytTags.unshift('Shorts');

    const ytResult = await _wizUploadYoutube(videoBlob, ytTitle, ytDesc, ytTags);

    // marketing_content에 기록
    try {
        await sb.from('marketing_content').insert({
            platform: 'youtube_shorts',
            title: ytTitle,
            body: ytDesc,
            hashtags: ytTags,
            thumbnail_prompt: '',
            status: 'published',
            published_at: new Date().toISOString()
        });
    } catch(_) {}

    return ytResult;
}

// ── 작업 리포트 출력 (밤새 작업 결과 요약) ──
function _adpShowReport() {
    if (_adpReport.length === 0) return;
    _adpLog('');
    _adpLog('═══════════════════════════════════════════');
    _adpLog('📋 작업 리포트 (처리 상품 목록)');
    _adpLog('═══════════════════════════════════════════');
    const ok = _adpReport.filter(r => r.success).length;
    const fail = _adpReport.filter(r => !r.success).length;
    _adpLog('✅ 성공: ' + ok + '개  |  ❌ 실패: ' + fail + '개  |  🎬 쇼츠: ' + _adpShortsCount + '/7');
    _adpLog('');
    _adpReport.forEach((r, i) => {
        const icon = r.success ? '✅' : '❌';
        const parts = [];
        if (r.detail) parts.push('상세O');
        if (r.blogCount > 0) parts.push('블로그' + r.blogCount + '개');
        if (r.shorts) parts.push('쇼츠O');
        if (r.sns) parts.push('SNS');
        _adpLog(icon + ' ' + (i + 1) + '. ' + r.name + (parts.length ? '  [' + parts.join(', ') + ']' : ''));
        if (r.error) _adpLog('   └ ' + r.error);
    });
    _adpLog('═══════════════════════════════════════════');
}

// ═══════════════════════════════════════════════════════════════
// ★★★ SNS 자동 포스팅 (블로그 발행 후 호출) ★★★
// ═══════════════════════════════════════════════════════════════

async function _socialPostAfterBlog(title, summary, blogUrl, imageUrl, hashtags, logFn) {
    const log = logFn || console.log;
    const platforms = ['twitter', 'facebook', 'instagram', 'reddit'];
    let posted = 0;

    for (const platform of platforms) {
        try {
            const { data, error } = await sb.functions.invoke('social-post', {
                body: { platform, title, summary, link: blogUrl, image_url: imageUrl, hashtags }
            });
            if (error) { log('  ⚠ SNS ' + platform + ': ' + error.message); continue; }
            if (data?.skipped) continue; // 비활성 플랫폼
            if (data?.success) { posted++; log('  📣 ' + platform + ' 포스팅 완료'); }
            else { log('  ⚠ SNS ' + platform + ': ' + (data?.error || '알 수 없는 오류')); }
        } catch(e) {
            log('  ⚠ SNS ' + platform + ' 실패: ' + e.message);
        }
    }
    if (posted > 0) log('  📢 SNS ' + posted + '개 플랫폼 포스팅 완료');
}