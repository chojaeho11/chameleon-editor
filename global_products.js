import { sb } from "./global_config.js";
import { showLoading, formatCurrency } from "./global_common.js";

// [전역 변수]
let editingTopCatId = null;
let editingCategoryId = null;
let editingProdId = null;
let editingAddonId = null;
let lastFetchedCategory = null;
let allProducts = [];

// ==========================================
// 1. 대분류 관리 (Top Categories)
// ==========================================
window.loadTopCategoriesList = async () => {
    const listArea = document.getElementById('topCategoryListArea');
    if(!listArea) return;
    listArea.innerHTML = '';

    const { data } = await sb.from('admin_top_categories').select('*').order('sort_order', {ascending: true});
    
    const newCatTop = document.getElementById('newCatTop');
    const filterSelect = document.getElementById('filterCategoryTop');
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
};

window.editTopCategoryLoad = async (id) => {
    const { data } = await sb.from('admin_top_categories').select('*').eq('id', id).single();
    if(!data) return;

    editingTopCatId = id;
    document.getElementById('newTopCatCode').value = data.code;
    document.getElementById('newTopCatName').value = data.name;
    document.getElementById('newTopCatNameJP').value = data.name_jp || '';
    document.getElementById('newTopCatNameUS').value = data.name_us || '';
    // [추가] 저장된 체크박스 값 불러오기
    const chk = document.getElementById('newTopCatExcluded');
    if(chk) chk.checked = data.is_excluded || false;
    
    // [추가] 설명 로드
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

    // [추가] 체크박스 값 읽기
    const isExcluded = document.getElementById('newTopCatExcluded') ? document.getElementById('newTopCatExcluded').checked : false;

    const payload = {
        code, name,
        is_excluded: isExcluded, // ★ DB에 저장
        name_jp: document.getElementById('newTopCatNameJP').value,
        name_us: document.getElementById('newTopCatNameUS').value,
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
    if(document.getElementById('newTopCatDesc')) document.getElementById('newTopCatDesc').value = '';
    if(document.getElementById('newTopCatDescJP')) document.getElementById('newTopCatDescJP').value = '';
    if(document.getElementById('newTopCatDescUS')) document.getElementById('newTopCatDescUS').value = '';
    // [추가] 체크박스 초기화
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
    const filterTopVal = document.getElementById('filterCategoryTop').value;
    
    const prodCatSelect = document.getElementById('newProdCategory');
    const filterProdCat = document.getElementById('filterProdCat');

    if(!listArea) return;
    
    // [수정] 대분류가 선택되지 않았거나 '전체보기'인 경우 목록을 비우고 종료
    if(!filterTopVal || filterTopVal === 'all') {
        listArea.innerHTML = '<div style="width:100%; text-align:center; padding:40px; color:#94a3b8; font-size:14px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">왼쪽 상단에서 [대분류]를 선택하시면 해당 소분류 목록이 나타납니다.</div>';
        return;
    }

    listArea.innerHTML = '<div style="padding:20px;">로딩 중...</div>';
    if(prodCatSelect) prodCatSelect.innerHTML = '<option value="">카테고리 선택</option>';
    if(filterProdCat) filterProdCat.innerHTML = '<option value="all">📂 전체</option>';

    // 데이터 조회 (선택된 대분류 코드 기반)
    let q = sb.from('admin_categories').select('*').order('sort_order', {ascending: true});
    q = q.eq('top_category_code', filterTopVal);

    const { data } = await q;

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
    
    if(document.getElementById('newCatDesc')) document.getElementById('newCatDesc').value = data.description || '';
    if(document.getElementById('newCatDescJP')) document.getElementById('newCatDescJP').value = data.description_jp || '';
    if(document.getElementById('newCatDescUS')) document.getElementById('newCatDescUS').value = data.description_us || '';

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
        description: document.getElementById('newCatDesc') ? document.getElementById('newCatDesc').value : '',
        description_jp: document.getElementById('newCatDescJP') ? document.getElementById('newCatDescJP').value : '',
        description_us: document.getElementById('newCatDescUS') ? document.getElementById('newCatDescUS').value : ''
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
    document.getElementById('newCatTop').value = '';
    document.getElementById('newCatCode').value = '';
    document.getElementById('newCatName').value = '';
    document.getElementById('newCatNameJP').value = '';
    document.getElementById('newCatNameUS').value = '';
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
    const items = container.querySelectorAll('.badge');
    const updates = [];
    items.forEach((el, idx) => {
        updates.push(sb.from(table).update({ sort_order: idx + 1 }).eq('id', el.dataset.id));
    });
    await Promise.all(updates);
}

// ==========================================
// 3. 옵션 및 카테고리 관리 (Addons & Categories)
// ==========================================
// [주의] 파일 상단(Line 9 부근)에 이미 editingAddonId가 선언되어 있으므로 여기서 let으로 다시 선언하지 않습니다.

// 1. 카테고리 및 옵션 전체 데이터 초기 로드
window.loadAddonCategories = async () => {
    try {
        const [catRes, addonRes] = await Promise.all([
            sb.from('addon_categories').select('*').order('sort_order', {ascending: true}),
            sb.from('admin_addons').select('*').order('code', {ascending: true})
        ]);

        if (catRes.error) throw catRes.error;
        window.cachedAddonCategories = catRes.data || [];
        window.cachedAddons = addonRes.data || [];

        // 마스터 관리용 셀렉트 박스 갱신
        ['newAddonCatCode', 'filterAddonCategory'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = (id === 'filterAddonCategory') ? '<option value="all">📁 카테고리 전체</option>' : '';
                window.cachedAddonCategories.forEach(c => {
                    el.innerHTML += `<option value="${c.code}">${c.name_kr || c.name}</option>`;
                });
            }
        });

        // 상품 연결용 동적 컨테이너 초기화 및 첫 줄 생성
        const container = document.getElementById('dynamicCategoryContainer');
        if (container) {
            container.innerHTML = '';
            addCategorySelectRow(); 
        }
        
        loadSystemDB(); // 우측 옵션 리스트 렌더링
    } catch (err) {
        console.error("데이터 로딩 오류:", err);
    }
};

// 2. [핵심] 옵션 이미지 업로드 기능 (이 함수가 활성화되어야 업로드가 됩니다)
window.previewAddonImage = async (input) => {
    if(!input.files[0]) return;
    const file = input.files[0];
    
    showLoading(true);
    try {
        // Supabase storage의 'products' 버킷 내 'addons' 폴더에 저장
        const path = `addons/${Date.now()}_${file.name}`;
        const { error } = await sb.storage.from('products').upload(path, file);
        if (error) throw error;

        const { data } = sb.storage.from('products').getPublicUrl(path);
        
        // 업로드된 URL을 입력창에 자동 삽입
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

// 3. 카테고리별 개별 옵션 목록 생성 (따로따로 표시용)
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

// 4. 우측 옵션 리스트 렌더링 (수정/삭제 버튼 포함)
window.loadSystemDB = async (filterSite) => {
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

    filtered.forEach(item => {
        const dPrice = (filterSite === 'JP') ? (item.price_jp || 0) : (filterSite === 'US' ? (item.price_us || 0) : (item.price_kr || item.price || 0));
        const symbol = (filterSite === 'JP') ? '¥' : (filterSite === 'US' ? '$' : '₩');

        listArea.innerHTML += `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:10px; display:flex; gap:10px; align-items:center;">
                <img src="${item.img_url || 'https://placehold.co/80'}" style="width:50px; height:50px; border-radius:6px; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-size:10px; color:#6366f1; font-weight:800;">${item.category_code || '미분류'}</div>
                    <div style="font-size:13px; font-weight:bold;">${item.name_kr || item.name}</div>
                    <div style="font-size:12px; font-weight:900;">${symbol}${dPrice.toLocaleString()}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <i class="fa-solid fa-pen" onclick="editAddonLoad(${item.id})" style="cursor:pointer; color:#94a3b8; font-size:14px; padding:5px;"></i>
                    <i class="fa-solid fa-trash" onclick="deleteAddonDB(${item.id})" style="cursor:pointer; color:#ef4444; font-size:14px; padding:5px;"></i>
                </div>
            </div>`;
    });
};

// 5. 옵션 수정 로직
window.editAddonLoad = (id) => {
    const item = window.cachedAddons.find(a => a.id === id);
    if(!item) return;

    editingAddonId = id; // 전역 변수 사용
    document.getElementById('newAddonCatCode').value = item.category_code || '';
    document.getElementById('newAddonCode').value = item.code;
    document.getElementById('newAddonImgUrl').value = item.img_url || '';
    document.getElementById('nmKR').value = item.name_kr || item.name || '';
    document.getElementById('prKR').value = item.price_kr || item.price || 0;
    document.getElementById('nmJP').value = item.name_jp || '';
    document.getElementById('prJP').value = item.price_jp || 0;
    document.getElementById('nmUS').value = item.name_us || '';
    document.getElementById('prUS').value = item.price_us || 0;

    const btn = document.querySelector('button[onclick="addAddonDB()"]');
    if(btn) btn.innerText = "옵션 수정저장";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 6. 옵션 삭제 로직
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

// 7. 옵션 저장/수정 실행 (스와치 모드 포함)
window.addAddonDB = async () => {
    const code = document.getElementById('newAddonCode').value;
    if(!code) return alert("코드를 입력하세요.");

    // 스와치 모드 체크박스가 있다면 값 읽기 (없으면 false)
    const isSwatchEl = document.getElementById('newAddonIsSwatch');
    const isSwatch = isSwatchEl ? isSwatchEl.checked : false;

    const payload = {
        category_code: document.getElementById('newAddonCatCode').value,
        code: code,
        img_url: document.getElementById('newAddonImgUrl').value,
        is_swatch: isSwatch, // ★ 스와치 모드 저장
        name_kr: document.getElementById('nmKR').value,
        price_kr: Math.round(parseFloat(document.getElementById('prKR').value || 0)),
        name_jp: document.getElementById('nmJP').value,
        price_jp: Math.round(parseFloat(document.getElementById('prJP').value || 0)),
        name_us: document.getElementById('nmUS').value,
        price_us: Math.round(parseFloat(document.getElementById('prUS').value || 0)),
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
    ['newAddonCode', 'newAddonImgUrl', 'nmKR', 'prKR', 'nmJP', 'prJP', 'nmUS', 'prUS'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = '';
    });
    const btn = document.querySelector('button[onclick="addAddonDB()"]');
    if(btn) btn.innerText = "옵션 저장";
};

// [신규] 옵션 카테고리 관리 모달 열기
window.openAddonCatManager = async () => {
    // 입력창 초기화
    document.getElementById('modalCatCode').value = "opt_" + Date.now().toString().slice(-4);
    document.getElementById('modalCatNameKR').value = "";
    document.getElementById('modalCatNameJP').value = "";
    document.getElementById('modalCatNameUS').value = "";
    
    // 모달 표시
    document.getElementById('addonCatModal').style.display = 'flex';
    document.getElementById('modalCatNameKR').focus();
};

// [신규] 모달 내부 자동 번역 실행
window.autoTranslateAddonCatModal = async () => {
    const krName = document.getElementById('modalCatNameKR').value;
    if(!krName) return alert("한국어 명칭을 먼저 입력해주세요.");

    const btn = document.querySelector('button[onclick="autoTranslateAddonCatModal()"]');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리중';
    btn.disabled = true;

    try {
        // googleTranslate 함수 재사용 (이미 파일 하단에 존재함)
        const jp = await googleTranslate(krName, 'ja');
        const us = await googleTranslate(krName, 'en');
        
        document.getElementById('modalCatNameJP').value = jp;
        document.getElementById('modalCatNameUS').value = us;
    } catch(e) {
        alert("번역 오류: " + e.message);
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
};

// [신규] 카테고리 저장 (모달에서 호출)
window.saveAddonCategoryFromModal = async () => {
    const code = document.getElementById('modalCatCode').value.trim();
    const nameKR = document.getElementById('modalCatNameKR').value.trim();
    const nameJP = document.getElementById('modalCatNameJP').value.trim();
    const nameUS = document.getElementById('modalCatNameUS').value.trim();

    if(!code || !nameKR) return alert("코드와 한국어 명칭은 필수입니다.");

    showLoading(true);
    try {
        // 기존에 존재하는 코드인지 확인 (중복 방지)
        const { data: existing } = await sb.from('addon_categories').select('id').eq('code', code).single();
        
        const payload = {
            code: code,
            name_kr: nameKR,
            name_jp: nameJP,
            name_us: nameUS,
            // name: nameKR, <-- 이 부분이 에러 원인이므로 삭제했습니다.
            sort_order: 99
        };
        let error;
        if(existing) {
            // 이미 존재하면 업데이트 (코드는 그대로, 이름만)
            const { error: upErr } = await sb.from('addon_categories').update(payload).eq('code', code);
            error = upErr;
        } else {
            // 신규 추가
            const { error: inErr } = await sb.from('addon_categories').insert([payload]);
            error = inErr;
        }

        if(error) throw error;
        
        alert("✅ 카테고리가 저장되었습니다.");
        document.getElementById('addonCatModal').style.display = 'none';
        loadAddonCategories(); // 목록 새로고침

    } catch(e) {
        alert("저장 실패: " + e.message);
    } finally {
        showLoading(false);
    }
};
// [신규] 선택된 카테고리 수정 모드 진입
window.editCurrentAddonCategory = async () => {
    const select = document.getElementById('newAddonCatCode');
    const selectedCode = select.value;

    if (!selectedCode) return alert("수정할 카테고리를 선택해주세요.");

    // 캐시된 데이터에서 정보 찾기
    const catData = window.cachedAddonCategories.find(c => c.code === selectedCode);
    if (!catData) return alert("정보를 찾을 수 없습니다.");

    // 모달에 값 채우기
    document.getElementById('modalCatCode').value = catData.code;
    document.getElementById('modalCatCode').disabled = true; // 코드는 수정 불가
    
    document.getElementById('modalCatNameKR').value = catData.name_kr || catData.name || "";
    document.getElementById('modalCatNameJP').value = catData.name_jp || "";
    document.getElementById('modalCatNameUS').value = catData.name_us || "";

    // 모달 열기
    document.getElementById('addonCatModal').style.display = 'flex';
    
    // 안내 메시지 (선택 사항)
    // alert("기존 정보를 불러왔습니다. [자동번역]을 누르고 저장하세요.");
};

// [보완] 새 카테고리 추가 시에는 코드 입력창 활성화
const originalOpenAddonCatManager = window.openAddonCatManager;
window.openAddonCatManager = async () => {
    await originalOpenAddonCatManager(); // 기존 로직 실행
    document.getElementById('modalCatCode').disabled = false; // 코드 입력 가능하게 풀기
};
// 8. 초기 실행
loadAddonCategories();
// ==========================================
// 4. 상품 관리 (Products)
// ==========================================
// [수정된 함수] 상품 목록 필터링 및 로드
window.filterProductList = async () => {
    const cat = document.getElementById('filterProdCat').value;
    const siteFilter = document.getElementById('filterProdSite').value;
    const keyword = document.getElementById('prodSearchInput').value.toLowerCase().trim();
    const tbody = document.getElementById('prodTableBody');
    
    showLoading(true);

    // 1. 데이터 로드 (조건을 완화하여 카테고리가 'all'이거나 변경될 때 항상 최신화 가능하게 수정)
    let query = sb.from('admin_products').select('*');
    
    if(cat && cat !== 'all') {
        query = query.eq('category', cat);
    }
    
    const { data, error } = await query.order('sort_order', {ascending: true});
    
    if(error) {
        console.error("데이터 로드 실패:", error);
        showLoading(false);
        return;
    }

    allProducts = data || [];
    lastFetchedCategory = cat; // 현재 카테고리 상태 업데이트

    // 2. 메모리 상에서 국가 및 검색어 필터링
    const filteredList = allProducts.filter(p => {
        const matchSite = (siteFilter === 'all' || p.site_code === siteFilter);
        const matchKeyword = !keyword || `${p.name} ${p.code} ${p.name_us||''} ${p.name_jp||''}`.toLowerCase().includes(keyword);
        return matchSite && matchKeyword;
    });

    // 3. 렌더링
    renderProductList(filteredList);
    showLoading(false);
    
    // 4. 드래그 앤 드롭 재설정
    if(tbody && !keyword && siteFilter === 'all') {
        // 기존 Sortable 인스턴스 파괴 후 재설정 권장 (중복 방지)
        if (tbody.sortable) tbody.sortable.destroy();
        tbody.sortable = new Sortable(tbody, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: () => updateProductSortOrder()
        });
    }
};
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

        // [수정] tr에 data-id 추가 및 드래그 핸들 아이콘 추가
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

// [신규] 상품 순서 변경 DB 저장 함수
window.updateProductSortOrder = async () => {
    const rows = document.querySelectorAll('#prodTableBody tr');
    if(rows.length === 0) return;

    const updates = [];
    rows.forEach((row, index) => {
        const id = row.getAttribute('data-id');
        if(id) {
            // 현재 화면 순서(index)대로 sort_order 업데이트
            updates.push(sb.from('admin_products').update({ sort_order: index + 1 }).eq('id', id));
        }
    });

    await Promise.all(updates);
    // console.log("순서 저장 완료");
};

// [수정됨] 상품 저장 함수: 소수점 오류 해결 및 정수 변환
window.addProductDB = async () => {
    const site = document.getElementById('newProdSite').value;
    const cat = document.getElementById('newProdCategory').value;
    const code = document.getElementById('newProdCode').value;
    
    if(!cat || !code) return alert("카테고리와 코드는 필수입니다.");

    const addons = Array.from(document.querySelectorAll('input[name="prodAddon"]:checked')).map(cb => cb.value).join(',');
    const isCustom = document.getElementById('newProdIsCustom').checked;
    const isGeneral = document.getElementById('newProdIsGeneral').checked;

    // [핵심 수정] 금액을 저장할 때 반드시 정수(Integer)로 변환
    const priceKR = Math.round(parseFloat(document.getElementById('newProdPrice').value || 0));
    const priceJP = Math.round(parseFloat(document.getElementById('newProdPriceJP').value || 0));
    const priceUS = Math.round(parseFloat(document.getElementById('newProdPriceUS').value || 0)); // "50.00" -> 50

    const payload = {
        site_code: site, category: cat, code: code,
        width_mm: document.getElementById('newProdW').value || 0,
        height_mm: document.getElementById('newProdH').value || 0,
        is_custom_size: isCustom,
        is_general_product: isGeneral, // [추가] DB에 저장
        img_url: document.getElementById('newProdImg').value,
        
        name: document.getElementById('newProdName').value, 
        price: priceKR,
        description: document.getElementById('newProdDetailKR').value || (window.popupQuill ? window.popupQuill.root.innerHTML : ""),

        name_jp: document.getElementById('newProdNameJP').value, 
        price_jp: priceJP,
        description_jp: document.getElementById('newProdDetailJP').value,

        name_us: document.getElementById('newProdNameUS').value, 
        price_us: priceUS, // 이제 에러 없이 정수로 저장됨
        description_us: document.getElementById('newProdDetailUS').value,
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
            lastFetchedCategory = null; 
            filterProductList();
        }
    }
};

window.editProductLoad = async (id) => {
    const { data } = await sb.from('admin_products').select('*').eq('id', id).single();
    if(!data) return;
    
    editingProdId = id;
    document.getElementById('btnProductSave').innerText = "수정사항 저장";
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    document.getElementById('btnCloneProduct').style.display = 'inline-block';
    document.querySelector('.product-form').scrollIntoView({ behavior: 'smooth' });

    // 기본 정보 로드
    document.getElementById('newProdSite').value = data.site_code || 'KR';
    document.getElementById('newProdCategory').value = data.category || '';
    document.getElementById('newProdCode').value = data.code || '';
    document.getElementById('newProdW').value = data.width_mm || 0;
    document.getElementById('newProdH').value = data.height_mm || 0;
    document.getElementById('newProdIsCustom').checked = data.is_custom_size || false;
    document.getElementById('newProdIsGeneral').checked = data.is_general_product || false;
    document.getElementById('newProdImg').value = data.img_url || '';
    document.getElementById('prodPreview').src = data.img_url || '';

    // [핵심] 한국어/일본어/영어 이름과 가격 보존
    document.getElementById('newProdName').value = data.name || ''; 
    document.getElementById('newProdPrice').value = data.price || 0; 
    
    document.getElementById('newProdNameJP').value = data.name_jp || ''; 
    document.getElementById('newProdPriceJP').value = data.price_jp || 0; 
    
    document.getElementById('newProdNameUS').value = data.name_us || ''; 
    document.getElementById('newProdPriceUS').value = data.price_us || 0; 

    // [핵심] 상세페이지 데이터(description) 보존
    document.getElementById('newProdDetailKR').value = data.description || '';
    document.getElementById('newProdDetailJP').value = data.description_jp || '';
    document.getElementById('newProdDetailUS').value = data.description_us || '';
    
    // 에디터용 일반 설명 필드(있는 경우) 대응
    if(document.getElementById('newProdDesc')) {
        document.getElementById('newProdDesc').value = data.description || '';
    }

    // 옵션 체크박스 복구
    const addonList = data.addons ? data.addons.split(',') : [];
    document.querySelectorAll('input[name="prodAddon"]').forEach(cb => { 
        cb.checked = addonList.includes(cb.value); 
    });
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
    // [추가] 초기화 시 복제 버튼 숨김
    document.getElementById('btnCloneProduct').style.display = 'none';
    const inputs = document.querySelectorAll('.product-form input:not([type=checkbox])');
    inputs.forEach(i => i.value = '');
    document.getElementById('prodPreview').src = '';
    document.querySelectorAll('input[name="prodAddon"]').forEach(cb => cb.checked = false);
    // [추가] 체크박스들 초기화
    document.getElementById('newProdIsCustom').checked = false;
    document.getElementById('newProdIsGeneral').checked = false;
};

window.previewProductImage = async (input) => {
    if(!input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => document.getElementById('prodPreview').src = e.target.result;
    reader.readAsDataURL(file);
    
    const btn = document.getElementById('btnProductSave');
    const oldText = btn.innerText; btn.innerText = "이미지 업로드..."; btn.disabled = true;

    try {
        const path = `products/${Date.now()}_${file.name}`;
        await sb.storage.from('products').upload(path, file);
        const { data } = sb.storage.from('products').getPublicUrl(path);
        document.getElementById('newProdImg').value = data.publicUrl;
    } catch(e) { alert("업로드 실패"); } 
    finally { btn.innerText = oldText; btn.disabled = false; }
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
// [수정됨] 구글 번역 API 연동 & 환율 자동 계산 (요청 사항 반영)
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

// 1. 상품 등록 화면 번역 (환율 업데이트됨)
window.autoTranslateInputs = async () => {
    const krName = document.getElementById('newProdName').value;
    const krPrice = document.getElementById('newProdPrice').value;

    if (!krName) return alert("한국어 상품명을 입력해주세요.");

    // [보완] 이미 입력된 값이 있는 경우 덮어쓰기 확인
    if (document.getElementById('newProdNameJP').value || document.getElementById('newProdNameUS').value) {
        if (!confirm("이미 입력된 번역 데이터가 있습니다. 기존 내용을 유지하시겠습니까? (취소 시 새로 번역)")) return;
    }

    const btn = document.querySelector('button[onclick="autoTranslateInputs()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    btn.disabled = true;

    try {
        const rateJPY = 0.2; 
        const rateUSD = 0.002;

        // 가격이 입력되어 있을 때만 환율 적용
        if (krPrice && krPrice > 0) {
            document.getElementById('newProdPriceJP').value = Math.round(krPrice * rateJPY);
            document.getElementById('newProdPriceUS').value = (krPrice * rateUSD).toFixed(2);
        }

        // 비어있는 상품명만 번역하거나 전체 갱신
        document.getElementById('newProdNameJP').value = await googleTranslate(krName, 'ja');
        document.getElementById('newProdNameUS').value = await googleTranslate(krName, 'en');

        alert("✅ 상품명 및 가격 번역 완료!");

    } catch (e) {
        alert("번역 실패: " + e.message);
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};
// 2. 대분류 번역
window.autoTranslateTopCategoryInputs = async () => {
    const krName = document.getElementById('newTopCatName').value;
    const krDesc = document.getElementById('newTopCatDesc') ? document.getElementById('newTopCatDesc').value : '';

    if (!krName) return alert("한국어 명칭을 입력해주세요.");

    document.getElementById('newTopCatNameJP').value = await googleTranslate(krName, 'ja');
    document.getElementById('newTopCatNameUS').value = await googleTranslate(krName, 'en');

    if (krDesc) {
        if(document.getElementById('newTopCatDescJP')) document.getElementById('newTopCatDescJP').value = await googleTranslate(krDesc, 'ja');
        if(document.getElementById('newTopCatDescUS')) document.getElementById('newTopCatDescUS').value = await googleTranslate(krDesc, 'en');
    }
    alert("✅ 대분류 번역 완료");
};

// 3. 소분류 번역
window.autoTranslateCategoryInputs = async () => {
    const krName = document.getElementById('newCatName').value;
    const krDesc = document.getElementById('newCatDesc') ? document.getElementById('newCatDesc').value : '';

    if (!krName) return alert("한국어 명칭을 입력해주세요.");

    document.getElementById('newCatNameJP').value = await googleTranslate(krName, 'ja');
    document.getElementById('newCatNameUS').value = await googleTranslate(krName, 'en');

    if (krDesc) {
        if(document.getElementById('newCatDescJP')) document.getElementById('newCatDescJP').value = await googleTranslate(krDesc, 'ja');
        if(document.getElementById('newCatDescUS')) document.getElementById('newCatDescUS').value = await googleTranslate(krDesc, 'en');
    }
    alert("✅ 소분류 번역 완료");
};

// 4. 옵션(Addon) 번역
window.autoTranslateAddonInputs = async () => {
    const krName = document.getElementById('nmKR').value;
    const krPrice = document.getElementById('prKR').value;

    if (!krName) return alert("한국어 명칭을 입력해주세요.");

    const rateJPY = 0.2; // 옵션도 동일한 환율 적용
    const rateUSD = 0.002;

    if (krPrice) {
        document.getElementById('prJP').value = Math.round(krPrice * rateJPY);
        document.getElementById('prUS').value = (krPrice * rateUSD).toFixed(2);
    }

    document.getElementById('nmJP').value = await googleTranslate(krName, 'ja');
    document.getElementById('nmUS').value = await googleTranslate(krName, 'en');

    alert("✅ 옵션 번역 완료");
};

// 5. 일괄 번역 (Bulk)
window.bulkTranslateAll = async () => {
    if (!confirm("전체 상품/옵션의 빈 칸을 자동으로 번역하시겠습니까?\n(시간이 다소 소요될 수 있습니다)")) return;

    const btn = document.getElementById('btnBulkTranslate') || document.activeElement;
    const oldText = btn.innerText;
    btn.innerText = "번역 진행중...";
    btn.disabled = true;

    try {
        const { data: products } = await sb.from('admin_products').select('*');
        let pCount = 0;
        
        for (const p of products) {
            let updates = {};
            let needUpdate = false;

            if (!p.name_jp) { updates.name_jp = await googleTranslate(p.name, 'ja'); needUpdate = true; }
            if (!p.name_us) { updates.name_us = await googleTranslate(p.name, 'en'); needUpdate = true; }
            
            if (needUpdate) {
                await sb.from('admin_products').update(updates).eq('id', p.id);
                pCount++;
            }
        }

        const { data: addons } = await sb.from('admin_addons').select('*');
        let aCount = 0;
        
        for (const a of addons) {
            let updates = {};
            let needUpdate = false;
            const srcName = a.name_kr || a.name;

            if (!a.name_jp) { updates.name_jp = await googleTranslate(srcName, 'ja'); needUpdate = true; }
            if (!a.name_us) { updates.name_us = await googleTranslate(srcName, 'en'); needUpdate = true; }

            if (needUpdate) {
                await sb.from('admin_addons').update(updates).eq('id', a.id);
                aCount++;
            }
        }

        alert(`완료되었습니다! (상품 ${pCount}개, 옵션 ${aCount}개 업데이트)`);
        
    } catch (e) {
        alert("일괄 번역 중 오류: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};
// [신규] 상품 복제 모드 전환 함수
window.cloneProductMode = () => {
    // 1. 수정 모드 해제 (새 상품으로 인식되게 함)
    editingProdId = null; 
    
    // 2. 코드는 중복될 수 없으므로 비움
    const codeInput = document.getElementById('newProdCode');
    codeInput.value = ''; 
    codeInput.focus();
    codeInput.placeholder = "새 상품 코드를 입력하세요";

    // 3. 버튼 상태 변경
    document.getElementById('btnProductSave').innerText = "새 상품 등록하기";
    document.getElementById('btnProductSave').classList.remove('btn-vip');
    document.getElementById('btnProductSave').classList.add('btn-primary');
    
    // 4. 복제/취소 버튼 숨김 (이미 내용은 폼에 들어가 있음)
    document.getElementById('btnCloneProduct').style.display = 'none';
    document.getElementById('btnCancelEdit').style.display = 'none';

    alert("📝 내용이 복제되었습니다.\n새로운 [상품코드]를 입력하고 저장 버튼을 눌러주세요.");
};
// ==========================================
// [신규 기능] 전체 상품 환율 일괄 적용
// 1000원 -> 100엔 (0.1배)
// 1000원 -> 1달러 (0.001배)
// ==========================================
window.updateAllCurrency = async () => {
    if (!confirm("전체 상품의 가격을 아래 환율로 일괄 변경하시겠습니까?\n\n🇯🇵 1000원 = 100엔 (10:1)\n🇺🇸 1000원 = 1달러 (1000:1)\n\n(주의: 기존에 입력된 해외 가격이 모두 덮어씌워집니다.)")) return;

    const btn = document.getElementById('btnCurrencyUpdate');
    const oldText = btn.innerText;
    btn.innerText = "업데이트 중...";
    btn.disabled = true;

    try {
        // 1. 전체 상품의 ID와 한국 가격 가져오기
        const { data: products, error } = await sb.from('admin_products').select('id, price');
        
        if (error) throw error;
        if (!products || products.length === 0) {
            alert("상품이 없습니다.");
            return;
        }

        let successCount = 0;

        // 2. 루프 돌면서 업데이트 (서버 부하 방지를 위해 순차 처리)
        for (const p of products) {
            const krw = p.price || 0;

            // 계산 로직 (정수 반올림)
            const priceJP = Math.round(krw * 0.2);   // 1000원 -> 200엔
            const priceUS = Math.round(krw * 0.002); // 1000원 -> 2달러

            // 업데이트 실행
            const { error: updateErr } = await sb.from('admin_products')
                .update({ 
                    price_jp: priceJP, 
                    price_us: priceUS 
                })
                .eq('id', p.id);

            if (!updateErr) successCount++;
        }

        alert(`✅ 총 ${successCount}개 상품의 환율 가격이 업데이트되었습니다.`);
        
        // 목록 새로고침
        if (window.filterProductList) window.filterProductList();

    } catch (e) {
        console.error(e);
        alert("업데이트 중 오류 발생: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};
// [신규] 옵션 연결 체크박스 필터링 함수
window.filterAddonsMulti = () => {
    const container = document.getElementById('addonCheckboxArea');
    if (!container) return;

    // 현재 생성된 모든 .dynamic-cat-select의 선택값들을 수집
    const selects = document.querySelectorAll('.dynamic-cat-select');
    const activeFilters = Array.from(selects).map(s => s.value).filter(v => v !== 'all');

    const labels = container.getElementsByTagName('label');

    for (let i = 0; i < labels.length; i++) {
        const addonCat = labels[i].dataset.category;
        
        // 필터가 '전체' 뿐이면 모두 보여줌
        if (activeFilters.length === 0) {
            labels[i].style.display = "flex";
            continue;
        }

        // 선택된 필터들 중 하나라도 일치하는 카테고리면 표시 (OR 조건)
        const isMatch = activeFilters.includes(addonCat);
        labels[i].style.display = isMatch ? "flex" : "none";
    }
};

// ==========================================
// [최종 완성형] 팝업 에디터 & 번역 엔진 통합 시스템
// ==========================================

let popupQuill;
let currentPopupLang = 'KR';

// 1. 번역 실행 엔진 (is not a function 오류 해결용 전역 등록)
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

// 2. 에디터 초기화 및 비디오 핸들러
window.initPopupQuill = () => {
    if (popupQuill) return;

    async function videoHandler() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'video/mp4,video/webm');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 50 * 1024 * 1024) return alert("50MB 이하 영상만 가능합니다.");
            
            showLoading(true);
            try {
                const fileExt = file.name.split('.').pop();
                const filePath = `${Date.now()}.${fileExt}`;
                const { error } = await sb.storage.from('videos').upload(filePath, file);
                if (error) throw error;

                const { data: { publicUrl } } = sb.storage.from('videos').getPublicUrl(filePath);
                const range = popupQuill.getSelection();
                popupQuill.insertEmbed(range.index, 'video', publicUrl);
                
                // 삽입 즉시 스타일 강제 보정
                setTimeout(() => {
                    const vids = document.querySelectorAll('#popup-quill-editor video');
                    vids.forEach(v => {
                        v.style.width = '100%';
                        v.setAttribute('controls', 'true');
                    });
                }, 100);
            } catch (err) { alert("업로드 중 오류 발생"); } 
            finally { showLoading(false); }
        };
    }

    popupQuill = new Quill('#popup-quill-editor', {
        modules: {
            toolbar: {
                container: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    ['image', 'video', 'link'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                ],
                handlers: { 'video': videoHandler }
            }
        },
        theme: 'snow',
        placeholder: '보드와 동일한 방식으로 사진과 영상을 드래그하거나 버튼을 눌러 넣으세요...'
    });
};

// 3. 팝업 에디터 열기
window.openDetailPageEditor = () => {
    window.initPopupQuill();
    document.getElementById('detailEditorModal').style.display = 'flex';
    currentPopupLang = 'KR';
    const krData = document.getElementById('newProdDetailKR').value;
    popupQuill.root.innerHTML = (krData === "" || krData === "<p><br></p>") ? "" : krData;
    document.querySelectorAll('.pop-editor-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tabKR').classList.add('active');
};

// 4. 언어 전환 (내용 자동 저장 포함)
window.switchPopupLang = (lang) => {
    // 1. 현재 편집 중인 내용을 현재 언어 변수(currentPopupLang)에 해당하는 필드에 즉시 저장
    const currentContent = popupQuill.root.innerHTML;
    if (currentContent !== "<p><br></p>") {
        document.getElementById(`newProdDetail${currentPopupLang}`).value = currentContent;
    }

    // 2. 언어 타겟 변경
    currentPopupLang = lang;

    // 3. 변경된 언어의 기존 데이터를 불러와서 에디터에 세팅
    const savedData = document.getElementById(`newProdDetail${lang}`).value;
    popupQuill.root.innerHTML = (savedData === "" || savedData === "<p><br></p>") ? "" : savedData;

    // 4. UI 탭 활성화 처리
    document.querySelectorAll('.pop-editor-tab').forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById(`tab${lang}`);
    if (targetTab) targetTab.classList.add('active');
};

// 5. 작업 완료 및 닫기
window.saveDetailAndClose = () => {
    document.getElementById(`newProdDetail${currentPopupLang}`).value = popupQuill.root.innerHTML;
    document.getElementById('detailEditorModal').style.display = 'none';
    alert("상세페이지가 임시 저장되었습니다.\n최종 등록을 위해 [수정사항 저장] 버튼을 꼭 눌러주세요.");
};

// 6. 다국어 자동 번역 로직 (is not a function 오류 완전 해결)
window.autoTranslatePopupDetail = async () => {
    const sourceHtml = popupQuill.root.innerHTML;
    if(!sourceHtml || sourceHtml === "<p><br></p>") return alert("번역할 한국어 내용이 없습니다.");
    if(!confirm("한국어 본문을 바탕으로 일본어와 영어 상세페이지를 자동 생성하시겠습니까?")) return;

    const btn = document.querySelector('button[onclick*="autoTranslatePopupDetail"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    btn.disabled = true;

    try {
        const targets = [ {code:'ja', f:'JP'}, {code:'en', f:'US'} ];
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

// ==========================================
// [신규] 프론트엔드 상품 상세페이지 전용 옵션 로드 함수
// ==========================================
window.loadProductOptionsFront = async (addonCodesStr) => {
    const area = document.getElementById('productOptionsArea'); // index.html의 빨간 원 영역 ID
    if (!area) return;
    area.innerHTML = '';

    if (!addonCodesStr || addonCodesStr.trim() === '') {
        area.innerHTML = '<div style="color:#94a3b8; font-size:13px; text-align:center; padding:20px;">선택 가능한 옵션이 없습니다.</div>';
        return;
    }

    const codes = addonCodesStr.split(',').map(c => c.trim()).filter(c => c);
    const { data, error } = await sb.from('admin_addons').select('*').in('code', codes);
    
    if (error || !data || data.length === 0) return;

    area.innerHTML = '<div style="font-weight:800; margin-bottom:12px; font-size:14px; color:#1e293b; padding-left:5px;">🎁 추가 옵션 선택</div>';
    
    data.forEach(addon => {
        const itemLabel = document.createElement('label');
        itemLabel.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:8px; background:#fff; cursor:pointer; transition:0.2s; font-size:13px; box-shadow:0 2px 4px rgba(0,0,0,0.02);";
        
        // 마우스 호버 효과
        itemLabel.onmouseover = () => { itemLabel.style.borderColor = "#6366f1"; itemLabel.style.background = "#f5f3ff"; };
        itemLabel.onmouseout = () => { itemLabel.style.borderColor = "#e2e8f0"; itemLabel.style.background = "#fff"; };

        itemLabel.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <input type="checkbox" name="userOption" value="${addon.code}" data-price="${addon.price}" style="width:18px; height:18px; accent-color:#6366f1; cursor:pointer;">
                <span style="font-weight:600; color:#334155;">${addon.name_kr || addon.name}</span>
            </div>
            <span style="color:#6366f1; font-weight:800; font-size:14px;">+${addon.price.toLocaleString()}원</span>
        `;
        area.appendChild(itemLabel);
    });
};
// [긴급 복구] 모든 상품의 '에디터 없이 장바구니' 체크 해제 함수
window.resetAllGeneralProducts = async () => {
    if (!confirm("⚠️ 정말로 모든 상품의 [에디터 없이 장바구니] 설정을 해제하시겠습니까?\n\n모든 상품이 다시 '디자인 에디터' 모드로 작동하게 됩니다.")) return;

    // 로딩 표시
    const btn = document.getElementById('btnEmergencyReset');
    const originalText = btn ? btn.innerText : '';
    if(btn) btn.innerText = "처리 중...";

    try {
        // DB 업데이트: is_general_product가 true인 것들을 모두 false로 변경
        const { error } = await sb
            .from('admin_products')
            .update({ is_general_product: false })
            .eq('is_general_product', true);

        if (error) throw error;

        alert("✅ 완료되었습니다! 모든 상품이 정상적으로 복구되었습니다.");
        
        // 목록 새로고침
        if (window.filterProductList) window.filterProductList();

    } catch (e) {
        console.error(e);
        alert("오류 발생: " + e.message);
    } finally {
        if(btn) btn.innerText = originalText;
    }
};