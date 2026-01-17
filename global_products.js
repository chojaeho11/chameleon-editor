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
    listArea.innerHTML = '';
    if(prodCatSelect) prodCatSelect.innerHTML = '<option value="">카테고리 선택</option>';
    if(filterProdCat) filterProdCat.innerHTML = '<option value="all">📂 전체</option>';

    let q = sb.from('admin_categories').select('*').order('sort_order', {ascending: true});
    if(filterTopVal && filterTopVal !== 'all') q = q.eq('top_category_code', filterTopVal);

    const { data } = await q;

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
// 3. 옵션 관리 (Addons)
// ==========================================
window.loadSystemDB = async (filterSite = 'KR') => {
    const tbody = document.getElementById('addonTableBody');
    const chkArea = document.getElementById('addonCheckboxArea');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3">로딩...</td></tr>';
    if(chkArea) chkArea.innerHTML = '';

    const { data } = await sb.from('admin_addons').select('*').order('category').order('code');
    
    tbody.innerHTML = '';
    if(data) {
        data.forEach(item => {
            let dName = item.name_kr || item.name;
            let dPrice = item.price_kr || item.price || 0;
            let symbol = '₩';

            if(filterSite === 'JP') { dName = item.name_jp || item.name; dPrice = item.price_jp || 0; symbol = '¥'; }
            if(filterSite === 'US') { dName = item.name_us || item.name; dPrice = item.price_us || 0; symbol = '$'; }

            tbody.innerHTML += `
                <tr style="${editingAddonId === item.id ? 'background:#eff6ff' : ''}">
                    <td><span class="badge" style="background:#f1f5f9; font-size:10px;">${item.category}</span><br><b>${item.code}</b></td>
                    <td>${dName}<br><span style="color:#666;">${symbol}${dPrice}</span></td>
                    <td>
                        <button class="btn btn-outline btn-sm" style="padding:2px 4px;" onclick="editAddonLoad(${item.id})">수정</button>
                        <button class="btn btn-danger btn-sm" style="padding:2px 4px;" onclick="deleteAddonDB(${item.id})">x</button>
                    </td>
                </tr>`;

            if(chkArea) {
                const badgeClass = item.category === 'material' ? 'kr' : (item.category === 'finish' ? 'jp' : 'us');
                chkArea.innerHTML += `
                    <label class="addon-check-item">
                        <input type="checkbox" name="prodAddon" value="${item.code}">
                        <span class="badge-site ${badgeClass}" style="font-size:9px; padding:1px 3px;">${item.category.substr(0,1).toUpperCase()}</span>
                        ${item.name_kr || item.name}
                    </label>`;
            }
        });
    }
};

window.addAddonDB = async () => {
    const code = document.getElementById('newAddonCode').value;
    if(!code) return alert("코드 필수");

    // [중요] 옵션 가격도 소수점 없이 정수로 저장 (Math.round 추가)
    const payload = {
        category: document.getElementById('newAddonCat').value,
        code: code,
        name_kr: document.getElementById('nmKR').value, 
        price_kr: Math.round(parseFloat(document.getElementById('prKR').value || 0)),
        name_jp: document.getElementById('nmJP').value, 
        price_jp: Math.round(parseFloat(document.getElementById('prJP').value || 0)),
        name_us: document.getElementById('nmUS').value, 
        price_us: Math.round(parseFloat(document.getElementById('prUS').value || 0)),
        name: document.getElementById('nmKR').value, 
        price: Math.round(parseFloat(document.getElementById('prKR').value || 0))
    };

    let error;
    if(editingAddonId) {
        const res = await sb.from('admin_addons').update(payload).eq('id', editingAddonId);
        error = res.error;
    } else {
        const res = await sb.from('admin_addons').insert([payload]);
        error = res.error;
    }

    if(error) alert("실패: " + error.message);
    else { alert("저장됨"); resetAddonForm(); }
};

window.editAddonLoad = async (id) => {
    const { data } = await sb.from('admin_addons').select('*').eq('id', id).single();
    if(!data) return;
    editingAddonId = id;
    document.getElementById('newAddonCat').value = data.category;
    document.getElementById('newAddonCode').value = data.code;
    document.getElementById('nmKR').value = data.name_kr || data.name; document.getElementById('prKR').value = data.price_kr || data.price;
    document.getElementById('nmJP').value = data.name_jp || ''; document.getElementById('prJP').value = data.price_jp || 0;
    document.getElementById('nmUS').value = data.name_us || ''; document.getElementById('prUS').value = data.price_us || 0;
    
    const siteVal = document.getElementById('newAddonSite') ? document.getElementById('newAddonSite').value : 'KR';
    loadSystemDB(siteVal);
};

window.deleteAddonDB = async (id) => {
    if(confirm("삭제?")) {
        await sb.from('admin_addons').delete().eq('id', id);
        loadSystemDB();
    }
};

window.resetAddonForm = () => {
    editingAddonId = null;
    document.getElementById('newAddonCode').value = '';
    document.getElementById('nmKR').value = ''; document.getElementById('prKR').value = '';
    document.getElementById('nmJP').value = ''; document.getElementById('prJP').value = '';
    document.getElementById('nmUS').value = ''; document.getElementById('prUS').value = '';
    loadSystemDB();
};

// ==========================================
// 4. 상품 관리 (Products)
// ==========================================
window.filterProductList = async () => {
    const cat = document.getElementById('filterProdCat').value;
    const tbody = document.getElementById('prodTableBody');
    if(!cat || cat === 'all') {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#aaa;">카테고리를 선택하세요</td></tr>';
        return;
    }

    // 1. 데이터 로드 (sort_order 기준)
    if(cat !== lastFetchedCategory) {
        showLoading(true);
        const { data } = await sb.from('admin_products').select('*').eq('category', cat).order('sort_order', {ascending: true});
        allProducts = data || [];
        lastFetchedCategory = cat;
        showLoading(false);
    }
    renderProductList(allProducts);

    // 2. 드래그 앤 드롭 활성화 (SortableJS)
    if(tbody) {
        new Sortable(tbody, {
            animation: 150,
            handle: '.drag-handle', // 햄버거 아이콘으로만 드래그 가능
            onEnd: function (evt) {
                updateProductSortOrder(); // 드래그가 끝나면 DB 업데이트
            }
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
        description: document.getElementById('newProdDesc').value,

        name_jp: document.getElementById('newProdNameJP').value, 
        price_jp: priceJP,
        description_jp: document.getElementById('newProdDescJP').value,

        name_us: document.getElementById('newProdNameUS').value, 
        price_us: priceUS, // 이제 에러 없이 정수로 저장됨
        description_us: document.getElementById('newProdDescUS').value,
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
    // [추가] 수정 모드일 때 복제 버튼 표시
    document.getElementById('btnCloneProduct').style.display = 'inline-block';
    document.querySelector('.product-form').scrollIntoView({ behavior: 'smooth' });

    document.getElementById('newProdSite').value = data.site_code;
    document.getElementById('newProdCategory').value = data.category;
    document.getElementById('newProdCode').value = data.code;
    document.getElementById('newProdW').value = data.width_mm;
    document.getElementById('newProdH').value = data.height_mm;
    document.getElementById('newProdIsCustom').checked = data.is_custom_size;
    // [추가] 일반 상품 체크박스 값 불러오기
    document.getElementById('newProdIsGeneral').checked = data.is_general_product || false;
    document.getElementById('newProdImg').value = data.img_url;
    document.getElementById('prodPreview').src = data.img_url || '';

    document.getElementById('newProdName').value = data.name; 
    document.getElementById('newProdPrice').value = data.price; 
    document.getElementById('newProdDesc').value = data.description || '';
    
    document.getElementById('newProdNameJP').value = data.name_jp || ''; 
    document.getElementById('newProdPriceJP').value = data.price_jp || 0; 
    document.getElementById('newProdDescJP').value = data.description_jp || '';
    
    document.getElementById('newProdNameUS').value = data.name_us || ''; 
    document.getElementById('newProdPriceUS').value = data.price_us || 0; 
    document.getElementById('newProdDescUS').value = data.description_us || '';

    const addonList = data.addons ? data.addons.split(',') : [];
    document.querySelectorAll('input[name="prodAddon"]').forEach(cb => { cb.checked = addonList.includes(cb.value); });
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
    const krDesc = document.getElementById('newProdDesc').value;
    const krPrice = document.getElementById('newProdPrice').value;
    
    const wMM = document.getElementById('newProdW').value || 0;
    const hMM = document.getElementById('newProdH').value || 0;

    if (!krName) return alert("한국어 상품명을 입력해주세요.");

    const btn = document.querySelector('button[onclick="autoTranslateInputs()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중...';
    btn.disabled = true;

    try {
        // [수정] 요청하신 환율 반영 (1000원 -> 200엔 / 1000원 -> 2달러)
        const rateJPY = 0.2; 
        const rateUSD = 0.002;

        if (krPrice) {
            // 일본: 1000 * 0.2 = 200 (정수)
            document.getElementById('newProdPriceJP').value = Math.round(krPrice * rateJPY);
            
            // 미국: 1000 * 0.002 = 2.00 (UI에는 소수점 보이게, 저장 시엔 addProductDB에서 정수로 변환됨)
            document.getElementById('newProdPriceUS').value = (krPrice * rateUSD).toFixed(2);
        }

        document.getElementById('newProdNameJP').value = await googleTranslate(krName, 'ja');
        
        let enName = await googleTranslate(krName, 'en');
        if (wMM > 0 && hMM > 0) {
            const wFt = (wMM * 0.00328084).toFixed(1);
            const hFt = (hMM * 0.00328084).toFixed(1);
            enName += ` (${wFt} x ${hFt} ft)`;
        }
        document.getElementById('newProdNameUS').value = enName;

        if (krDesc) {
            document.getElementById('newProdDescJP').value = await googleTranslate(krDesc, 'ja');
            document.getElementById('newProdDescUS').value = await googleTranslate(krDesc, 'en');
        }

        alert("✅ 번역 및 환율 계산 완료!");

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