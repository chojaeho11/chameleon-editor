import { sb } from "./global_config.js";
import { showLoading, formatCurrency } from "./global_common.js";

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
    btn.innerText = "수정하기";
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-vip');
};

window.addTopCategoryDB = async () => {
    const code = document.getElementById('newTopCatCode').value;
    const name = document.getElementById('newTopCatName').value;
    if(!code || !name) return alert("코드와 한국명은 필수입니다.");

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

    if(error) alert("오류: " + error.message);
    else {
        alert(editingTopCatId ? "수정되었습니다." : "저장되었습니다.");
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
    btn.innerText = "수정하기";
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-vip');
};

window.addCategoryDB = async () => {
    const code = document.getElementById('newCatCode').value;
    const name = document.getElementById('newCatName').value;
    if(!code || !name) return alert("필수 항목 누락");

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

    if(error) alert("오류: " + error.message);
    else {
        alert(editingCategoryId ? "수정되었습니다." : "저장되었습니다.");
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
        const path = `addons/${Date.now()}_${file.name}`;
        const { error } = await sb.storage.from('products').upload(path, file);
        if (error) throw error;

        const { data } = sb.storage.from('products').getPublicUrl(path);
        
        const imgInput = document.getElementById('newAddonImgUrl');
        if (imgInput) {
            imgInput.value = data.publicUrl;
            alert("✅ 이미지 업로드 성공!");
        }
    } catch(e) { 
        console.error("이미지 업로드 오류:", e);
        alert("업로드 실패: " + e.message); 
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

    const filtered = (window.cachedAddons || []).filter(a => a.category_code === categoryCode);
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
            <img src="${item.img_url || 'https://placehold.co/80'}" style="width:50px; height:50px; border-radius:6px; object-fit:cover;">
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
        alert("✅ 삭제되었습니다.");
        loadAddonCategories(); 
    } catch (err) { alert("삭제 실패: " + err.message); } finally { showLoading(false); }
};

window.addAddonDB = async () => {
    const code = document.getElementById('newAddonCode').value;
    if(!code) return alert("코드를 입력하세요.");

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
        alert("✅ 저장되었습니다.");
        resetAddonForm();
        loadAddonCategories();
    } catch (err) { alert("저장 실패: " + err.message); } finally { showLoading(false); }
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
    document.getElementById('addonCatModal').style.display = 'flex';
    document.getElementById('modalCatNameKR').focus();
    document.getElementById('modalCatCode').disabled = false;
};

window.autoTranslateAddonCatModal = async () => {
    const krName = document.getElementById('modalCatNameKR').value;
    if(!krName) return alert("한국어 명칭을 먼저 입력해주세요.");

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
    } catch(e) {
        alert("번역 오류: " + e.message);
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

    if(!code || !nameKR) return alert("코드와 한국어 명칭은 필수입니다.");

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
        alert("✅ 카테고리가 저장되었습니다.");
        document.getElementById('addonCatModal').style.display = 'none';
        loadAddonCategories();
    } catch(e) {
        alert("저장 실패: " + e.message);
    } finally {
        showLoading(false);
    }
};

window.editCurrentAddonCategory = async () => {
    const select = document.getElementById('newAddonCatCode');
    const selectedCode = select.value;
    if (!selectedCode) return alert("수정할 카테고리를 선택해주세요.");
    const catData = window.cachedAddonCategories.find(c => c.code === selectedCode);
    if (!catData) return alert("정보를 찾을 수 없습니다.");
    document.getElementById('modalCatCode').value = catData.code;
    document.getElementById('modalCatCode').disabled = true;
    document.getElementById('modalCatNameKR').value = catData.name_kr || catData.name || "";
    document.getElementById('modalCatNameJP').value = catData.name_jp || "";
    document.getElementById('modalCatNameUS').value = catData.name_us || "";
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
        let query = sb.from('admin_products').select('*');
        
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
                <td><img src="${p.img_url}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"></td>
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

// [수정] 소수점 저장 오류 수정 및 정수 변환
// [수정] 상품 저장 시 Base64 이미지를 자동으로 서버에 업로드 후 URL 저장
// [수정] 소수점 저장 오류 수정 및 정수 변환
// [수정] 상품 저장 시 Base64 이미지를 자동으로 서버에 업로드 후 URL 저장
window.addProductDB = async () => {
    const site = document.getElementById('newProdSite').value;
    const cat = document.getElementById('newProdCategory').value;
    const code = document.getElementById('newProdCode').value;
    
    // 1. 입력값 가져오기
    let imgUrl = document.getElementById('newProdImg').value; // let으로 선언 (수정 가능하게)

    if(!cat || !code) return alert("카테고리와 코드는 필수입니다.");

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
            
            console.log("이미지 자동 변환 성공:", imgUrl);

        } catch (err) {
            console.error("이미지 변환 실패:", err);
            btn.innerText = oldText;
            btn.disabled = false;
            return alert("이미지 자동 업로드에 실패했습니다. 용량이 너무 크거나 네트워크 문제일 수 있습니다.\n(직접 파일 선택 버튼으로 업로드해주세요)");
        }
        
        btn.innerText = oldText;
        btn.disabled = false;
    }

    const addons = Array.from(document.querySelectorAll('input[name="prodAddon"]:checked')).map(cb => cb.value).join(',');
    const isCustom = document.getElementById('newProdIsCustom').checked;
    const isGeneral = document.getElementById('newProdIsGeneral').checked;

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

    if(error) alert("실패: " + error.message);
    else {
        alert("저장되었습니다.");
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

    // 상세 설명
    document.getElementById('newProdDetailKR').value = data.description || '';
    document.getElementById('newProdDetailJP').value = data.description_jp || '';
    document.getElementById('newProdDetailUS').value = data.description_us || '';
    document.getElementById('newProdDetailCN').value = data.description_cn || '';
    document.getElementById('newProdDetailAR').value = data.description_ar || '';
    document.getElementById('newProdDetailES').value = data.description_es || '';
    if (document.getElementById('newProdDetailDE')) document.getElementById('newProdDetailDE').value = data.description_de || '';
    if (document.getElementById('newProdDetailFR')) document.getElementById('newProdDetailFR').value = data.description_fr || '';

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
        const path = `products/${Date.now()}_${file.name}`;
        // Bucket 이름이 'products'가 맞는지 확인 필요
        const { error } = await sb.storage.from('products').upload(path, file);
        
        if (error) {
            console.error("Supabase Storage Error:", error);
            if (error.message.includes("Bucket not found") || error.statusCode === '404') {
                alert("오류: Supabase에 'products' 스토리지 버킷이 없습니다.");
            } else {
                alert("업로드 실패: " + error.message);
            }
            return;
        }

        const { data } = sb.storage.from('products').getPublicUrl(path);
        // [중요] 업로드가 성공해야만 URL 입력칸에 값을 넣음
        document.getElementById('newProdImg').value = data.publicUrl;
        console.log("업로드 완료:", data.publicUrl);

    } catch(e) { 
        alert("업로드 처리 중 오류 발생"); 
    } 
    finally { 
        btn.innerText = oldText; 
        btn.disabled = false; 
    }
};
window.bulkApplyAddonsToCategory = async () => {
    const cat = document.getElementById('newProdCategory').value;
    if(!cat) return alert("카테고리 선택 필요");
    const addons = Array.from(document.querySelectorAll('input[name="prodAddon"]:checked')).map(cb => cb.value).join(',');
    if(!confirm(`[${cat}] 카테고리 전체 상품에 현재 옵션을 적용합니까?`)) return;
    
    const { error } = await sb.from('admin_products').update({ addons: addons }).eq('category', cat);
    if(error) alert("실패: " + error.message); else alert("적용 완료");
};

// ==========================================
// 번역 및 기타 기능
// ==========================================
async function googleTranslate(text, targetLang) {
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

window.autoTranslateInputs = async () => {
    const krName = document.getElementById('newProdName').value;
    const krPrice = document.getElementById('newProdPrice').value;

    if (!krName) return alert("한국어 상품명을 입력해주세요.");

    if (document.getElementById('newProdNameJP').value || document.getElementById('newProdNameUS').value) {
        if (!confirm("이미 입력된 번역 데이터가 있습니다. 기존 내용을 유지하시겠습니까? (취소 시 새로 번역)")) return;
    }

    const btn = document.querySelector('button[onclick="autoTranslateInputs()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    btn.disabled = true;

    try {
        const rateJPY = 0.2, rateUSD = 0.002, rateCNY = 0.01, rateSAR = 0.005, rateEUR = 0.001;

        if (krPrice && krPrice > 0) {
            document.getElementById('newProdPriceJP').value = Math.round(krPrice * rateJPY);
            document.getElementById('newProdPriceUS').value = (krPrice * rateUSD).toFixed(2);
            document.getElementById('newProdPriceCN').value = Math.round(krPrice * rateCNY);
            document.getElementById('newProdPriceAR').value = Math.round(krPrice * rateSAR);
            document.getElementById('newProdPriceES').value = (krPrice * rateEUR).toFixed(2);
        }

        document.getElementById('newProdNameJP').value = await googleTranslate(krName, 'ja');
        const enName = await googleTranslate(krName, 'en');
        document.getElementById('newProdNameUS').value = enName;
        document.getElementById('newProdNameCN').value = await googleTranslate(enName, 'zh-CN');
        document.getElementById('newProdNameAR').value = await googleTranslate(enName, 'ar');
        document.getElementById('newProdNameES').value = await googleTranslate(enName, 'es');
        if (document.getElementById('newProdNameDE')) document.getElementById('newProdNameDE').value = await googleTranslate(enName, 'de');
        if (document.getElementById('newProdNameFR')) document.getElementById('newProdNameFR').value = await googleTranslate(enName, 'fr');

        alert("✅ 상품명 및 가격 번역 완료!");

    } catch (e) {
        alert("번역 실패: " + e.message);
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.autoTranslateTopCategoryInputs = async () => {
    const krName = document.getElementById('newTopCatName').value;
    const krDesc = document.getElementById('newTopCatDesc') ? document.getElementById('newTopCatDesc').value : '';
    if (!krName) return alert("한국어 명칭을 입력해주세요.");
    document.getElementById('newTopCatNameJP').value = await googleTranslate(krName, 'ja');
    const enName = await googleTranslate(krName, 'en');
    document.getElementById('newTopCatNameUS').value = enName;
    document.getElementById('newTopCatNameCN').value = await googleTranslate(enName, 'zh-CN');
    document.getElementById('newTopCatNameAR').value = await googleTranslate(enName, 'ar');
    document.getElementById('newTopCatNameES').value = await googleTranslate(enName, 'es');
    if (krDesc) {
        if(document.getElementById('newTopCatDescJP')) document.getElementById('newTopCatDescJP').value = await googleTranslate(krDesc, 'ja');
        if(document.getElementById('newTopCatDescUS')) document.getElementById('newTopCatDescUS').value = await googleTranslate(krDesc, 'en');
    }
    alert("✅ 대분류 번역 완료");
};

window.autoTranslateCategoryInputs = async () => {
    const krName = document.getElementById('newCatName').value;
    const krDesc = document.getElementById('newCatDesc') ? document.getElementById('newCatDesc').value : '';
    if (!krName) return alert("한국어 명칭을 입력해주세요.");
    document.getElementById('newCatNameJP').value = await googleTranslate(krName, 'ja');
    const enName = await googleTranslate(krName, 'en');
    document.getElementById('newCatNameUS').value = enName;
    document.getElementById('newCatNameCN').value = await googleTranslate(enName, 'zh-CN');
    document.getElementById('newCatNameAR').value = await googleTranslate(enName, 'ar');
    document.getElementById('newCatNameES').value = await googleTranslate(enName, 'es');
    if (krDesc) {
        if(document.getElementById('newCatDescJP')) document.getElementById('newCatDescJP').value = await googleTranslate(krDesc, 'ja');
        const enDesc = await googleTranslate(krDesc, 'en');
        if(document.getElementById('newCatDescUS')) document.getElementById('newCatDescUS').value = enDesc;
        if(document.getElementById('newCatDescCN')) document.getElementById('newCatDescCN').value = await googleTranslate(enDesc, 'zh-CN');
        if(document.getElementById('newCatDescAR')) document.getElementById('newCatDescAR').value = await googleTranslate(enDesc, 'ar');
        if(document.getElementById('newCatDescES')) document.getElementById('newCatDescES').value = await googleTranslate(enDesc, 'es');
    }
    alert("✅ 소분류 번역 완료");
};

window.autoTranslateAddonInputs = async () => {
    const krName = document.getElementById('nmKR').value;
    const krPrice = document.getElementById('prKR').value;
    if (!krName) return alert("한국어 명칭을 입력해주세요.");
    const rateJPY = 0.2, rateUSD = 0.002, rateCNY = 0.01, rateSAR = 0.005, rateEUR = 0.001;
    if (krPrice) {
        document.getElementById('prJP').value = Math.round(krPrice * rateJPY);
        document.getElementById('prUS').value = (krPrice * rateUSD).toFixed(2);
        document.getElementById('prCN').value = Math.round(krPrice * rateCNY);
        document.getElementById('prAR').value = Math.round(krPrice * rateSAR);
        document.getElementById('prES').value = (krPrice * rateEUR).toFixed(2);
    }
    document.getElementById('nmJP').value = await googleTranslate(krName, 'ja');
    const enName = await googleTranslate(krName, 'en');
    document.getElementById('nmUS').value = enName;
    document.getElementById('nmCN').value = await googleTranslate(enName, 'zh-CN');
    document.getElementById('nmAR').value = await googleTranslate(enName, 'ar');
    document.getElementById('nmES').value = await googleTranslate(enName, 'es');
    if (document.getElementById('nmDE')) document.getElementById('nmDE').value = await googleTranslate(enName, 'de');
    if (document.getElementById('nmFR')) document.getElementById('nmFR').value = await googleTranslate(enName, 'fr');
    alert("✅ 옵션 번역 완료");
};

window.bulkTranslateAll = async () => {
    if (!confirm("전체 상품/옵션/카테고리의 빈 번역을 자동으로 채우시겠습니까?\n(JP/US/CN/AR/ES/DE/FR 모두 포함, 시간이 다소 소요됩니다)")) return;
    const btn = document.getElementById('btnBulkTranslate') || document.activeElement;
    const oldText = btn.innerText;
    btn.disabled = true;

    // 영어 번역 캐시 (동일 원문 중복 호출 방지)
    const enCache = {};
    async function getEnglish(krText) {
        if (!krText) return '';
        if (enCache[krText]) return enCache[krText];
        enCache[krText] = await googleTranslate(krText, 'en');
        return enCache[krText];
    }

    try {
        // ── 1. 상품 (admin_products) ──
        const { data: products } = await sb.from('admin_products').select('*');
        let pCount = 0;
        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            btn.innerText = `번역 중... (상품 ${i+1}/${products.length})`;
            let updates = {};
            let needUpdate = false;
            if (!p.name_jp && p.name) { updates.name_jp = await googleTranslate(p.name, 'ja'); needUpdate = true; }
            if (!p.name_us && p.name) { updates.name_us = await getEnglish(p.name); needUpdate = true; }
            const enName = p.name_us || updates.name_us || await getEnglish(p.name);
            if (!p.name_cn && enName) { updates.name_cn = await googleTranslate(enName, 'zh-CN'); needUpdate = true; }
            if (!p.name_ar && enName) { updates.name_ar = await googleTranslate(enName, 'ar'); needUpdate = true; }
            if (!p.name_es && enName) { updates.name_es = await googleTranslate(enName, 'es'); needUpdate = true; }
            if (!p.name_de && enName) { updates.name_de = await googleTranslate(enName, 'de'); needUpdate = true; }
            if (!p.name_fr && enName) { updates.name_fr = await googleTranslate(enName, 'fr'); needUpdate = true; }
            if (needUpdate) {
                await sb.from('admin_products').update(updates).eq('id', p.id);
                pCount++;
            }
        }

        // ── 2. 옵션 (admin_addons) ──
        const { data: addons } = await sb.from('admin_addons').select('*');
        let aCount = 0;
        for (let i = 0; i < addons.length; i++) {
            const a = addons[i];
            btn.innerText = `번역 중... (옵션 ${i+1}/${addons.length})`;
            let updates = {};
            let needUpdate = false;
            const srcName = a.name_kr || a.name;
            if (!a.name_jp && srcName) { updates.name_jp = await googleTranslate(srcName, 'ja'); needUpdate = true; }
            if (!a.name_us && srcName) { updates.name_us = await getEnglish(srcName); needUpdate = true; }
            const enName = a.name_us || updates.name_us || await getEnglish(srcName);
            if (!a.name_cn && enName) { updates.name_cn = await googleTranslate(enName, 'zh-CN'); needUpdate = true; }
            if (!a.name_ar && enName) { updates.name_ar = await googleTranslate(enName, 'ar'); needUpdate = true; }
            if (!a.name_es && enName) { updates.name_es = await googleTranslate(enName, 'es'); needUpdate = true; }
            if (!a.name_de && enName) { updates.name_de = await googleTranslate(enName, 'de'); needUpdate = true; }
            if (!a.name_fr && enName) { updates.name_fr = await googleTranslate(enName, 'fr'); needUpdate = true; }
            if (needUpdate) {
                await sb.from('admin_addons').update(updates).eq('id', a.id);
                aCount++;
            }
        }

        // ── 3. 대분류 (admin_top_categories) ──
        const { data: topCats } = await sb.from('admin_top_categories').select('*');
        let tcCount = 0;
        for (const tc of (topCats || [])) {
            btn.innerText = `번역 중... (대분류)`;
            let updates = {};
            let needUpdate = false;
            if (!tc.name_jp && tc.name) { updates.name_jp = await googleTranslate(tc.name, 'ja'); needUpdate = true; }
            if (!tc.name_us && tc.name) { updates.name_us = await getEnglish(tc.name); needUpdate = true; }
            const enN = tc.name_us || updates.name_us || await getEnglish(tc.name);
            if (!tc.name_cn && enN) { updates.name_cn = await googleTranslate(enN, 'zh-CN'); needUpdate = true; }
            if (!tc.name_ar && enN) { updates.name_ar = await googleTranslate(enN, 'ar'); needUpdate = true; }
            if (!tc.name_es && enN) { updates.name_es = await googleTranslate(enN, 'es'); needUpdate = true; }
            if (!tc.name_de && enN) { updates.name_de = await googleTranslate(enN, 'de'); needUpdate = true; }
            if (!tc.name_fr && enN) { updates.name_fr = await googleTranslate(enN, 'fr'); needUpdate = true; }
            if (needUpdate) { await sb.from('admin_top_categories').update(updates).eq('id', tc.id); tcCount++; }
        }

        // ── 4. 소분류 (admin_categories) ──
        const { data: subCats } = await sb.from('admin_categories').select('*');
        let scCount = 0;
        for (const sc of (subCats || [])) {
            btn.innerText = `번역 중... (소분류)`;
            let updates = {};
            let needUpdate = false;
            if (!sc.name_jp && sc.name) { updates.name_jp = await googleTranslate(sc.name, 'ja'); needUpdate = true; }
            if (!sc.name_us && sc.name) { updates.name_us = await getEnglish(sc.name); needUpdate = true; }
            const enN = sc.name_us || updates.name_us || await getEnglish(sc.name);
            if (!sc.name_cn && enN) { updates.name_cn = await googleTranslate(enN, 'zh-CN'); needUpdate = true; }
            if (!sc.name_ar && enN) { updates.name_ar = await googleTranslate(enN, 'ar'); needUpdate = true; }
            if (!sc.name_es && enN) { updates.name_es = await googleTranslate(enN, 'es'); needUpdate = true; }
            if (!sc.name_de && enN) { updates.name_de = await googleTranslate(enN, 'de'); needUpdate = true; }
            if (!sc.name_fr && enN) { updates.name_fr = await googleTranslate(enN, 'fr'); needUpdate = true; }
            if (needUpdate) { await sb.from('admin_categories').update(updates).eq('id', sc.id); scCount++; }
        }

        // ── 5. 옵션 카테고리 (addon_categories) ──
        const { data: addonCats } = await sb.from('addon_categories').select('*');
        let acCount = 0;
        for (const ac of (addonCats || [])) {
            btn.innerText = `번역 중... (옵션카테고리)`;
            let updates = {};
            let needUpdate = false;
            const src = ac.name_kr || ac.name;
            if (!ac.name_jp && src) { updates.name_jp = await googleTranslate(src, 'ja'); needUpdate = true; }
            if (!ac.name_us && src) { updates.name_us = await getEnglish(src); needUpdate = true; }
            const enN = ac.name_us || updates.name_us || await getEnglish(src);
            if (!ac.name_cn && enN) { updates.name_cn = await googleTranslate(enN, 'zh-CN'); needUpdate = true; }
            if (!ac.name_ar && enN) { updates.name_ar = await googleTranslate(enN, 'ar'); needUpdate = true; }
            if (!ac.name_es && enN) { updates.name_es = await googleTranslate(enN, 'es'); needUpdate = true; }
            if (!ac.name_de && enN) { updates.name_de = await googleTranslate(enN, 'de'); needUpdate = true; }
            if (!ac.name_fr && enN) { updates.name_fr = await googleTranslate(enN, 'fr'); needUpdate = true; }
            if (needUpdate) { await sb.from('addon_categories').update(updates).eq('id', ac.id); acCount++; }
        }

        const total = pCount + aCount + tcCount + scCount + acCount;
        alert(`✅ 일괄 번역 완료!\n\n상품 ${pCount}개 | 옵션 ${aCount}개 | 대분류 ${tcCount}개 | 소분류 ${scCount}개 | 옵션카테고리 ${acCount}개\n총 ${total}개 업데이트`);
    } catch (e) {
        alert("일괄 번역 중 오류: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
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
    alert("📝 내용이 복제되었습니다.\n새로운 [상품코드]를 입력하고 저장 버튼을 눌러주세요.");
};

window.updateAllCurrency = async () => {
    if (!confirm("전체 상품의 가격을 아래 환율로 일괄 변경하시겠습니까?\n\n🇯🇵 1000원 = 100엔 (10:1)\n🇺🇸 1000원 = 1달러 (1000:1)\n\n(주의: 기존에 입력된 해외 가격이 모두 덮어씌워집니다.)")) return;
    const btn = document.getElementById('btnCurrencyUpdate');
    const oldText = btn.innerText;
    btn.innerText = "업데이트 중...";
    btn.disabled = true;
    try {
        const { data: products, error } = await sb.from('admin_products').select('id, price');
        if (error) throw error;
        if (!products || products.length === 0) {
            alert("상품이 없습니다.");
            return;
        }
        let successCount = 0;
        for (const p of products) {
            const krw = p.price || 0;
            const priceJP = Math.round(krw * 0.2);   
            const priceUS = Math.round(krw * 0.002); 
            const { error: updateErr } = await sb.from('admin_products')
                .update({ 
                    price_jp: priceJP, 
                    price_us: priceUS 
                })
                .eq('id', p.id);
            if (!updateErr) successCount++;
        }
        alert(`✅ 총 ${successCount}개 상품의 환율 가격이 업데이트되었습니다.`);
        if (window.filterProductList) window.filterProductList();
    } catch (e) {
        console.error(e);
        alert("업데이트 중 오류 발생: " + e.message);
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
                                // 1. Supabase Storage에 자동 업로드
                                const fileName = `detail_${Date.now()}_${file.name}`;
                                const path = `products/${fileName}`;
                                
                                // global_config.js에서 가져온 sb 객체 사용
                                const { data, error } = await sb.storage.from('products').upload(path, file);
                                if (error) throw error;

                                // 2. 업로드된 이미지의 공용 URL 가져오기
                                const { data: urlData } = sb.storage.from('products').getPublicUrl(path);
                                const publicUrl = urlData.publicUrl;

                                // 3. 에디터에 Base64가 아닌 짧은 URL 주소로 이미지 삽입
                                this.quill.insertEmbed(range.index, 'image', publicUrl);
                                this.quill.setSelection(range.index + 1);
                                
                                console.log("이미지 서버 업로드 완료:", publicUrl);
                            } catch (err) {
                                console.error("자동 업로드 실패:", err);
                                alert("이미지 업로드 중 오류가 발생했습니다. 파일 크기나 네트워크를 확인해주세요.");
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
                alert("이미지는 복사+붙여넣기 대신 '이미지 버튼'을 눌러서 업로드해주세요. (웹사이트 속도 유지 목적)");
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
// [개선] 공통 정보(Common Info) 관리 로직 (다국어 + 카테고리 + 백업)
// ==========================================
window.openCommonInfoModal = async () => {
    const dbClient = window.sb || window._supabase;
    if (!dbClient) return alert("DB 연결 실패");

    document.getElementById('commonInfoModal').style.display = 'flex';
    
    // 카테고리 목록 로드
    const catSelect = document.getElementById('commonInfoCategory');
    if (catSelect.options.length <= 1) { 
        const { data: cats } = await dbClient.from('admin_top_categories').select('code, name');
        if(cats) {
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.code;
                opt.innerText = c.name;
                catSelect.appendChild(opt);
            });
        }
    }
    loadCommonInfoContent('all');
};

window.loadCommonInfoContent = async (categoryCode) => {
    const dbClient = window.sb || window._supabase;
    ['commonHtmlKR', 'commonHtmlJP', 'commonHtmlUS', 'commonHtmlCN', 'commonHtmlAR', 'commonHtmlES'].forEach(id => { const el = document.getElementById(id); if(el) el.value = "로딩 중..."; });

    const { data } = await dbClient.from('common_info').select('*')
        .eq('section', 'top').eq('category_code', categoryCode).single();

    document.getElementById('commonHtmlKR').value = data ? (data.content || '') : '';
    document.getElementById('commonHtmlJP').value = data ? (data.content_jp || '') : '';
    document.getElementById('commonHtmlUS').value = data ? (data.content_us || '') : '';
    document.getElementById('commonHtmlCN').value = data ? (data.content_cn || '') : '';
    document.getElementById('commonHtmlAR').value = data ? (data.content_ar || '') : '';
    document.getElementById('commonHtmlES').value = data ? (data.content_es || '') : '';
    
    const btnRestore = document.getElementById('btnRestoreCommon');
    if (data && (data.content_backup || data.content_backup_jp)) {
        btnRestore.disabled = false;
        btnRestore.innerText = "↺ 이전 백업 불러오기";
        btnRestore.onclick = () => restoreCommonInfo(data);
    } else {
        btnRestore.disabled = true;
        btnRestore.innerText = "이전 백업 없음";
    }
};

window.saveCommonInfo = async () => {
    const dbClient = window.sb || window._supabase;
    const catCode = document.getElementById('commonInfoCategory').value || 'all';
    
    if(!confirm(`[${catCode === 'all' ? '전체상품' : catCode}] 공통정보를 저장하시겠습니까?`)) return;

    // 기존 데이터 백업용 조회
    const { data: oldData } = await dbClient.from('common_info')
        .select('*').eq('section', 'top').eq('category_code', catCode).single();

    const payload = {
        section: 'top', category_code: catCode,
        content: document.getElementById('commonHtmlKR').value,
        content_jp: document.getElementById('commonHtmlJP').value,
        content_us: document.getElementById('commonHtmlUS').value,
        content_cn: document.getElementById('commonHtmlCN').value,
        content_ar: document.getElementById('commonHtmlAR').value,
        content_es: document.getElementById('commonHtmlES').value,
        content_backup: oldData ? oldData.content : null,
        content_backup_jp: oldData ? oldData.content_jp : null,
        content_backup_us: oldData ? oldData.content_us : null,
        content_backup_cn: oldData ? oldData.content_cn : null,
        content_backup_ar: oldData ? oldData.content_ar : null,
        content_backup_es: oldData ? oldData.content_es : null
    };

    const { error } = await dbClient.from('common_info').upsert(payload, { onConflict: 'section, category_code' });
    if (error) alert("저장 실패: " + error.message);
    else { alert("✅ 저장 및 백업 완료!"); loadCommonInfoContent(catCode); }
};

window.restoreCommonInfo = async (data) => {
    if(!confirm("가장 최근 백업본으로 되돌리시겠습니까?")) return;
    document.getElementById('commonHtmlKR').value = data.content_backup || '';
    document.getElementById('commonHtmlJP').value = data.content_backup_jp || '';
    document.getElementById('commonHtmlUS').value = data.content_backup_us || '';
    document.getElementById('commonHtmlCN').value = data.content_backup_cn || '';
    document.getElementById('commonHtmlAR').value = data.content_backup_ar || '';
    document.getElementById('commonHtmlES').value = data.content_backup_es || '';
    alert("백업본을 불러왔습니다. [저장] 버튼을 눌러 확정하세요.");
};

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
    alert("상세페이지가 임시 저장되었습니다.\n최종 등록을 위해 [수정사항 저장] 버튼을 꼭 눌러주세요.");
};

window.autoTranslatePopupDetail = async () => {
    const sourceHtml = popupQuill.root.innerHTML;
    if(!sourceHtml || sourceHtml === "<p><br></p>") return alert("번역할 한국어 내용이 없습니다.");
    if(!confirm("한국어 본문을 바탕으로 일본어와 영어 상세페이지를 자동 생성하시겠습니까?")) return;

    const btn = document.querySelector('button[onclick*="autoTranslatePopupDetail"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    btn.disabled = true;

    try {
        const targets = [ {code:'ja', f:'JP'}, {code:'en', f:'US'}, {code:'zh-CN', f:'CN'}, {code:'ar', f:'AR'}, {code:'es', f:'ES'}, {code:'de', f:'DE'}, {code:'fr', f:'FR'} ];
        for(const t of targets) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sourceHtml;
            async function translateNode(node) {
                for (let child of node.childNodes) {
                    if (child.nodeType === 3 && child.nodeValue.trim().length > 0) {
                        child.nodeValue = await window.googleTranslateSimple(child.nodeValue, t.code);
                    } else if (child.nodeType === 1) await translateNode(child);
                }
            }
            await translateNode(tempDiv);
            document.getElementById(`newProdDetail${t.f}`).value = tempDiv.innerHTML;
        }
        alert("✅ 다국어 번역 완료! 탭을 넘겨 확인하세요.");
    } catch(e) { 
        console.error(e);
        alert("번역 중 오류 발생"); 
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

        alert("✅ 완료되었습니다! 모든 상품이 정상적으로 복구되었습니다.");
        
        if (window.filterProductList) window.filterProductList();

    } catch (e) {
        console.error(e);
        alert("오류 발생: " + e.message);
    } finally {
        if(btn) btn.innerText = originalText;
    }
};
// [긴급 복구] 영어/일본어 내용을 기반으로 -> 이미지 제거 후 -> 한국어로 복구
window.recoverDescription = async () => {
    if (!confirm("⚠️ 주의: 한국어 상세페이지가 비어있는 상품들을 복구합니다.\n\n1. 영어(없으면 일본어) 내용을 가져옵니다.\n2. 이미지(Base64)는 모두 제거합니다.\n3. 텍스트를 한국어로 번역해 저장합니다.\n\n진행하시겠습니까?")) return;

    console.log("🚀 복구 작업 시작...");
    const btn = document.getElementById('btnProductSave'); // 로딩 표시용 버튼 아무거나
    if(btn) btn.innerText = "복구 중... (콘솔 확인)";

    try {
        // 1. 전체 상품 가져오기
        const { data: products, error } = await sb.from('admin_products').select('*');
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
                
                console.log(`✅ [${p.code}] 복구 완료`);
                count++;
            }
        }

        alert(`🎉 총 ${count}개의 상품 상세페이지가 복구되었습니다!`);
        location.reload(); // 새로고침

    } catch (e) {
        console.error(e);
        alert("복구 중 오류 발생: " + e.message);
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
    if (!url) return alert("URL을 입력해주세요.");
    if (!url.startsWith('http')) return alert("올바른 URL을 입력해주세요 (https://...)");

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
        alert("크롤링 실패: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 수집 시작';
    }
};

// [2] 이미지 AI 재생성
window.reimagineProduct = async (mode) => {
    const imgEl = document.getElementById('crawlPreviewImg');
    const imgSrc = imgEl.src;
    if (!imgSrc || imgSrc.endsWith('/')) return alert("이미지가 없습니다.");

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
        alert("이미지 재생성 실패: " + e.message);
    }
};

// [3] AI 상세페이지 자동 생성 (6개 언어)
window.generateCrawledDetail = async () => {
    if (!crawledProduct) return alert("먼저 상품을 수집해주세요.");

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
                langs: ["kr", "jp", "us", "cn", "ar", "es"]
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
        alert("상세페이지 생성 실패: " + e.message);
    }
};

// [4] 수집 데이터를 기존 상품 등록 폼에 적용
window.applyCrawledToForm = () => {
    if (!crawledProduct) return alert("수집된 데이터가 없습니다.");

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

    alert("✅ 수집 데이터가 폼에 적용되었습니다!\n\n• 상세페이지 에디터를 열어 내용을 확인하세요\n• 카테고리를 선택해주세요\n• 최종 확인 후 [상품 등록하기] 버튼을 눌러주세요");

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
    if (!urlsText) return alert("URL을 입력해주세요.");

    const category = document.getElementById('batchSubCategory').value;
    if (!category) return alert("소분류 카테고리를 선택해주세요.");

    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return alert("유효한 URL이 없습니다.");

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
                            langs: ["kr", "jp", "us", "cn", "ar", "es"]
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
                price_jp: Math.round(price * 0.2),
                price_us: Math.round(price * 0.002),
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

    alert(`✅ 일괄 수집 완료!\n\n총 ${urls.length}건 중 ${successCount}건 등록 성공`);
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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
<p><img src="${img}" alt="${n}"></p>
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

    if (error) return alert('상품 조회 실패: ' + error.message);

    const isEmpty = (d) => !d || d.trim() === '' || d === '<p><br></p>';

    // 한국어가 완전히 비어있는 상품 OR 특정 언어가 비어있는 상품 모두 포함
    const targets = products.filter(p =>
        isEmpty(p.description) || isEmpty(p.description_jp) || isEmpty(p.description_us) ||
        isEmpty(p.description_cn) || isEmpty(p.description_ar) || isEmpty(p.description_es) ||
        isEmpty(p.description_de) || isEmpty(p.description_fr)
    );

    if (targets.length === 0) return alert('상세페이지가 없는 상품이 없습니다. (모든 8개 언어 채워짐)');
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
    alert(`상세페이지 일괄 생성 완료!\n\n성공: ${success}건\n실패: ${fail}건`);
};