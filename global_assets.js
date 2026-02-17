import { sb } from "./global_config.js";
import { showLoading } from "./global_common.js";

// [전역 변수]
let currentTplPage = 1;
const tplItemsPerPage = 12; // 한 페이지에 보여줄 개수

// ==========================================
// 1. 템플릿 관리 (Templates)
// ==========================================

// [템플릿 목록 로드]
window.loadTemplates = async (isNewSearch = false) => {
    const grid = document.getElementById('tplGrid');
    const catFilter = document.getElementById('filterTplCat').value;
    const prodFilter = document.getElementById('filterTplProduct').value;
    const searchKeyword = document.getElementById('tplSearchInput').value.trim();

    if (isNewSearch) currentTplPage = 1;

    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;"><div class="spinner"></div> 로딩 중...</div>';

    // 1. 쿼리 구성
    let query = sb.from('library')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    // 필터 적용
    if (catFilter !== 'all') query = query.eq('category', catFilter);
    
    // 제품 연결 필터
    if (prodFilter === 'custom') query = query.or('product_key.eq.custom,product_key.is.null'); // 공통
    else if (prodFilter === 'assigned') query = query.neq('product_key', 'custom').not('product_key', 'is', null); // 전용
    else if (prodFilter !== 'all') query = query.eq('product_key', prodFilter); // 특정 제품

    // 검색어
    if (searchKeyword) {
        query = query.ilike('tags', `%${searchKeyword}%`);
    }

    // 페이지네이션
    const from = (currentTplPage - 1) * tplItemsPerPage;
    const to = from + tplItemsPerPage - 1;
    
    const { data, error, count } = await query.range(from, to);

    if (error) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:red; text-align:center;">오류: ${error.message}</div>`;
        return;
    }

    // 2. 페이지 UI 업데이트
    const totalPages = Math.ceil((count || 0) / tplItemsPerPage) || 1;
    const pageLabel = document.getElementById('tplPageLabel');
    if(pageLabel) pageLabel.innerText = `Page ${currentTplPage} / ${totalPages}`;

    // 3. 그리드 렌더링
    grid.innerHTML = '';
    if (!data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">등록된 템플릿이 없습니다.</div>';
        return;
    }

    data.forEach(t => {
        let thumbUrl = t.thumb_url;
        // Supabase 이미지 리사이징 (옵션)
        if(thumbUrl && thumbUrl.includes('supabase.co')) {
            thumbUrl += '?width=200&height=200&resize=cover&quality=50';
        }

        const badgeColor = (t.product_key && t.product_key !== 'custom') ? '#dbeafe' : '#f1f5f9';
        const badgeText = (t.product_key && t.product_key !== 'custom') ? '#1e40af' : '#64748b';
        const prodName = (t.product_key === 'custom' || !t.product_key) ? '공통' : t.product_key;

        grid.innerHTML += `
            <div class="tpl-card">
                <div style="position:absolute; top:8px; right:8px; z-index:5;">
                    <input type="checkbox" class="tpl-chk" value="${t.id}" style="width:16px; height:16px; cursor:pointer;">
                </div>
                <div class="tpl-thumb" style="background-image:url('${thumbUrl}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>
                <div class="tpl-info">
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                        <span style="font-weight:bold; color:#334155;">${t.category}</span>
                        <span style="background:${badgeColor}; color:${badgeText}; padding:1px 4px; border-radius:3px;">${prodName}</span>
                    </div>
                    <div style="font-size:12px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${t.tags}">
                        ${t.tags || '-'}
                    </div>
                    <button class="tpl-del-btn" onclick="deleteTemplate(${t.id})">삭제</button>
                </div>
            </div>
        `;
    });
};

// [템플릿 등록]
window.uploadTemplate = async () => {
    const cat = document.getElementById('tplCategory').value;
    const tags = document.getElementById('tplTags').value;
    const prodKey = document.getElementById('tplProductKey').value;
    const thumbFile = document.getElementById('fileThumb').files[0];
    const dataFile = document.getElementById('fileData').files[0];

    if (!thumbFile) return alert("썸네일 이미지는 필수입니다.");

    const btn = document.querySelector('.tpl-form .btn-primary');
    const oldText = btn.innerText;
    btn.innerText = "업로드 중...";
    btn.disabled = true;

    try {
        const timestamp = Date.now();
        
        // 1. 썸네일 업로드
        const thumbPath = `thumbs/${timestamp}_${thumbFile.name}`;
        const { error: thumbErr } = await sb.storage.from('design').upload(thumbPath, thumbFile);
        if (thumbErr) throw thumbErr;
        const { data: thumbData } = sb.storage.from('design').getPublicUrl(thumbPath);
        
        // 2. 데이터 파일 업로드 (선택)
        let dataUrl = thumbData.publicUrl; 
        if (dataFile) {
            const dataPath = `assets/${timestamp}_${dataFile.name}`;
            const { error: dataErr } = await sb.storage.from('design').upload(dataPath, dataFile);
            if (dataErr) throw dataErr;
            const { data: dData } = sb.storage.from('design').getPublicUrl(dataPath);
            dataUrl = dData.publicUrl;
        }

        // 3. DB 저장
        const { error: dbErr } = await sb.from('library').insert({
            category: cat,
            tags: tags || 'No Tag',
            thumb_url: thumbData.publicUrl,
            data_url: dataUrl,
            product_key: prodKey,
            width: 1000, 
            height: 1000 
        });

        if (dbErr) throw dbErr;

        alert("✅ 등록되었습니다.");
        resetTemplateForm();
        loadTemplates();

    } catch (e) {
        alert("업로드 실패: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// [템플릿 삭제]
window.deleteTemplate = async (id) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await sb.from('library').delete().eq('id', id);
    if (error) alert("실패: " + error.message);
    else loadTemplates();
};

// [선택 삭제]
window.deleteSelectedTemplates = async () => {
    const checks = document.querySelectorAll('.tpl-chk:checked');
    if (checks.length === 0) return alert("선택된 항목이 없습니다.");
    
    if (!confirm(`선택한 ${checks.length}개를 삭제하시겠습니까?`)) return;

    const ids = Array.from(checks).map(c => c.value);
    const { error } = await sb.from('library').delete().in('id', ids);
    
    if (error) alert("실패: " + error.message);
    else {
        alert("삭제되었습니다.");
        loadTemplates();
    }
};

// [유틸 함수들]
window.toggleAllTemplates = (source) => {
    document.querySelectorAll('.tpl-chk').forEach(c => c.checked = source.checked);
};

window.changeTplPage = (step) => {
    const next = currentTplPage + step;
    if (next < 1) return alert("첫 페이지입니다.");
    currentTplPage = next;
    loadTemplates(false);
};

window.previewTemplateImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('previewThumb');
            if(img) {
                img.src = e.target.result;
                img.style.display = 'block';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.resetTemplateForm = () => {
    document.getElementById('tplTags').value = '';
    document.getElementById('fileThumb').value = '';
    document.getElementById('fileData').value = '';
    const img = document.getElementById('previewThumb');
    if(img) img.style.display = 'none';
};

window.loadProductKeys = async () => {
    const { data } = await sb.from('admin_products').select('code, name').order('name');
    const select1 = document.getElementById('tplProductKey');
    const select2 = document.getElementById('filterTplProduct');
    
    if (select1 && data) {
        select1.innerHTML = '<option value="custom">공통 / 지정안함</option>';
        if(select2) select2.innerHTML = '<option value="all">📦 제품연결 전체</option><option value="custom">🔹 공통 템플릿만</option><option value="assigned">🔸 제품 전용만</option>';
        
        data.forEach(p => {
            const opt = `<option value="${p.code}">${p.name}</option>`;
            select1.innerHTML += opt;
            if(select2) select2.innerHTML += opt;
        });
    }
};

window.toggleFileInputs = () => {
    const cat = document.getElementById('tplCategory').value;
    const groupData = document.getElementById('groupDataFile');
    const thumbInput = document.getElementById('fileThumb');
    const lblThumb = document.getElementById('lblThumb');
    if (['vector', 'transparent-graphic', 'graphic'].includes(cat)) {
        if(groupData) groupData.style.display = 'block';
        if(thumbInput) thumbInput.accept = 'image/*';
        if(lblThumb) lblThumb.textContent = '1. 썸네일 (이미지)';
    } else if (cat === 'audio') {
        if(groupData) groupData.style.display = 'block';
        if(thumbInput) thumbInput.accept = 'image/*';
        if(lblThumb) lblThumb.textContent = '1. 커버 이미지 (선택)';
        // change data file to accept audio
        const dataInput = document.getElementById('fileData');
        if(dataInput) dataInput.accept = 'audio/*,.mp3,.wav,.ogg,.m4a';
    } else {
        if(groupData) groupData.style.display = 'none';
        if(thumbInput) thumbInput.accept = 'image/*';
        if(lblThumb) lblThumb.textContent = '1. 썸네일 (이미지)';
    }
};


// [폰트 목록 로드]
window.loadFonts = async () => {
    const tbody = document.getElementById('fontListBody');
    if (!tbody) return; // 폰트 화면이 아니면 중단
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">로딩 중...</td></tr>';

    try {
        const { data, error } = await sb.from('site_fonts').select('*').order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">등록된 폰트가 없습니다.</td></tr>';
            return;
        }

        data.forEach(f => {
            // [에러 수정] URL이 유효할 때만 FontFace 생성 시도
            if (f.file_url && f.file_url.startsWith('http')) {
                try {
                    const fontFace = new FontFace(f.font_family, `url("${f.file_url}")`);
                    fontFace.load().then(loadedFace => {
                        document.fonts.add(loadedFace);
                    }).catch(e => {
                        // 로딩 실패 시 조용히 넘어가기
                        console.warn(`Font load skip: ${f.font_family}`); 
                    });
                } catch (err) {
                    console.warn("Font syntax error");
                }
            }

            const flagMap = { 'KR':'🇰🇷', 'JA':'🇯🇵', 'JP':'🇯🇵', 'EN':'🇺🇸', 'US':'🇺🇸', 'ZH':'🇨🇳', 'CN':'🇨🇳', 'AR':'🇸🇦', 'ES':'🇪🇸' };
            let flag = flagMap[f.site_code] || '🌐';

            tbody.innerHTML += `
                <tr>
                    <td style="text-align:center; font-size:14px;">${flag}</td>
                    <td>
                        <div style="font-weight:bold; color:#334155;">${f.font_name}</div>
                        <div style="font-size:11px; color:#888;">Family: ${f.font_family}</div>
                    </td>
                    <td style="font-size:16px; color:#0f172a;">
                        <span style="font-family:'${f.font_family}', sans-serif;">Preview 1234</span>
                    </td>
                    <td style="text-align:center;">
                        <button class="btn btn-danger btn-sm" onclick="deleteFontDB(${f.id})">삭제</button>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};

// [폰트 업로드]
window.uploadFont = async () => {
    const site = document.getElementById('fontSite').value;
    const name = document.getElementById('fontName').value;
    const family = document.getElementById('fontFamily').value.trim(); 
    const file = document.getElementById('fontFile').files[0];

    if (!name || !family || !file) return alert("모든 항목을 입력해주세요.");
    if (/\s/.test(family)) return alert("Family Name에는 공백을 넣을 수 없습니다. (예: NotoSansKR)");

    const btn = document.querySelector('#sec-fonts .btn-primary');
    const oldText = btn.innerText;
    btn.innerText = "업로드 중...";
    btn.disabled = true;

    try {
        const timestamp = Date.now();
        const ext = file.name.split('.').pop();
        const path = `${site}/${timestamp}_${family}.${ext}`;

        // 1. 스토리지 업로드
        const { error: upErr } = await sb.storage.from('fonts').upload(path, file);
        if (upErr) throw upErr;

        const { data: urlData } = sb.storage.from('fonts').getPublicUrl(path);

        // 2. DB 저장
        const { error: dbErr } = await sb.from('site_fonts').insert({
            site_code: site,
            font_name: name,
            font_family: family,
            file_url: urlData.publicUrl
        });

        if (dbErr) throw dbErr;

        alert("✅ 폰트가 등록되었습니다.");
        document.getElementById('fontName').value = '';
        document.getElementById('fontFamily').value = '';
        document.getElementById('fontFile').value = '';
        loadFonts();

    } catch (e) {
        alert("오류 발생: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// [폰트 삭제]
window.deleteFontDB = async (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await sb.from('site_fonts').delete().eq('id', id);
    if (error) alert("삭제 실패: " + error.message);
    else loadFonts();
};