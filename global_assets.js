import { sb } from "./global_config.js";
import { showLoading } from "./global_common.js";

// [전역 변수]
let currentTplPage = 1;
let totalTplPages = 1;
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
        .select('id, thumb_url, category, product_key, tags, data_url, is_featured, featured_at', { count: 'exact' })
        .order('is_featured', { ascending: false, nullsFirst: false })
        .order('featured_at', { ascending: false, nullsFirst: true })
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
    totalTplPages = Math.ceil((count || 0) / tplItemsPerPage) || 1;
    const pageInput = document.getElementById('tplPageInput');
    const totalLabel = document.getElementById('tplTotalPages');
    if(pageInput) { pageInput.value = currentTplPage; pageInput.max = totalTplPages; }
    if(totalLabel) totalLabel.innerText = totalTplPages;

    // 3. 그리드 렌더링
    grid.innerHTML = '';
    if (!data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">등록된 템플릿이 없습니다.</div>';
        return;
    }

    data.forEach(t => {
        let thumbUrl = t.thumb_url;
        const isAudio = t.category === 'audio';
        // Supabase 이미지 리사이징 (옵션) — 오디오 파일 URL에는 적용 안함
        if(thumbUrl && thumbUrl.includes('supabase.co') && !isAudio) {
            thumbUrl += '?width=200&height=200&resize=cover&quality=50';
        }

        const badgeColor = (t.product_key && t.product_key !== 'custom') ? '#dbeafe' : '#f1f5f9';
        const badgeText = (t.product_key && t.product_key !== 'custom') ? '#1e40af' : '#64748b';
        const prodName = (t.product_key === 'custom' || !t.product_key) ? '공통' : t.product_key;

        // 오디오: 커버 이미지 없으면 음악 아이콘 표시
        const isAudioUrl = isAudio && thumbUrl && (thumbUrl.endsWith('.mp3')||thumbUrl.endsWith('.wav')||thumbUrl.endsWith('.ogg')||thumbUrl.endsWith('.m4a')||thumbUrl.includes('/audio/'));
        const thumbContent = isAudioUrl
            ? `<div class="tpl-thumb" style="background:#f0f4ff; display:flex; align-items:center; justify-content:center; font-size:48px; color:#6366f1;">🎵</div>`
            : `<div class="tpl-thumb" style="background-image:url('${thumbUrl}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;

        // 오디오: 재생 버튼 추가
        const audioBtn = isAudio && t.data_url
            ? `<button class="tpl-del-btn" style="background:#e0e7ff;color:#4338ca;right:50px;" onclick="event.stopPropagation();window._adminPlayAudio('${t.data_url}',this)">▶ 재생</button>`
            : '';

        const isFeat = !!t.is_featured;
        const starStyle = isFeat
            ? 'background:#fef3c7; color:#f59e0b; border:2px solid #f59e0b;'
            : 'background:#f1f5f9; color:#94a3b8; border:2px solid #e2e8f0;';

        grid.innerHTML += `
            <div class="tpl-card" style="${isFeat ? 'box-shadow:0 0 0 2px #f59e0b; border:1px solid #f59e0b;' : ''}">
                <div style="position:absolute; top:8px; right:8px; z-index:5;">
                    <input type="checkbox" class="tpl-chk" value="${t.id}" style="width:16px; height:16px; cursor:pointer;">
                </div>
                <button onclick="event.stopPropagation();window.toggleFeatured(${t.id},${!isFeat})" title="${isFeat ? '우선표시 해제' : '우선표시'}" style="position:absolute; top:8px; left:8px; z-index:5; width:28px; height:28px; border-radius:50%; ${starStyle} cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; padding:0;">⭐</button>
                ${thumbContent}
                <div class="tpl-info">
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                        <span style="font-weight:bold; color:#334155;">${t.category}</span>
                        <span style="background:${badgeColor}; color:${badgeText}; padding:1px 4px; border-radius:3px;">${prodName}</span>
                    </div>
                    <div style="font-size:12px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${t.tags}">
                        ${t.tags || '-'}
                    </div>
                    ${audioBtn}
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

    // 오디오: 음원파일 필수, 썸네일 선택
    if (cat === 'audio') {
        if (!dataFile) { showToast("음원 파일을 선택해주세요.", "warn"); return; }
    } else {
        if (!thumbFile) { showToast("썸네일 이미지는 필수입니다.", "warn"); return; }
    }

    // PNG만 허용하는 카테고리 (사진배경, 패턴 제외)
    if (['logo', 'vector', 'graphic'].includes(cat) && thumbFile) {
        if (!thumbFile.name.toLowerCase().endsWith('.png') && thumbFile.type !== 'image/png') {
            showToast("이 카테고리는 PNG 파일만 업로드 가능합니다.", "warn"); return;
        }
    }

    const btn = document.querySelector('.tpl-form .btn-primary');
    const oldText = btn.innerText;
    btn.innerText = "업로드 중...";
    btn.disabled = true;

    try {
        const timestamp = Date.now();
        let thumbPublicUrl = '';
        let dataUrl = '';

        // 1. 썸네일 업로드 (오디오는 선택)
        if (thumbFile) {
            const thumbPath = `thumbs/${timestamp}_${thumbFile.name}`;
            const { error: thumbErr } = await sb.storage.from('design').upload(thumbPath, thumbFile);
            if (thumbErr) throw thumbErr;
            const { data: thumbData } = sb.storage.from('design').getPublicUrl(thumbPath);
            thumbPublicUrl = thumbData.publicUrl;
        }

        // 2. 데이터/음원 파일 업로드
        if (dataFile) {
            const folder = cat === 'audio' ? 'audio' : 'assets';
            const dataPath = `${folder}/${timestamp}_${dataFile.name}`;
            const { error: dataErr } = await sb.storage.from('design').upload(dataPath, dataFile);
            if (dataErr) throw dataErr;
            const { data: dData } = sb.storage.from('design').getPublicUrl(dataPath);
            dataUrl = dData.publicUrl;
        }

        // URL 결정
        if (!thumbPublicUrl) thumbPublicUrl = dataUrl; // 오디오: 커버 없으면 data_url 사용
        if (!dataUrl) dataUrl = thumbPublicUrl;         // 일반: 데이터 없으면 thumb 사용

        // 3. DB 저장
        const { error: dbErr } = await sb.from('library').insert({
            category: cat,
            tags: tags || 'No Tag',
            thumb_url: thumbPublicUrl,
            data_url: dataUrl,
            product_key: prodKey,
            width: 1000,
            height: 1000
        });

        if (dbErr) throw dbErr;

        showToast("등록되었습니다.", "success");
        resetTemplateForm();
        loadTemplates();

    } catch (e) {
        showToast("업로드 실패: " + e.message, "error");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// [관리자 오디오 미리듣기]
let _adminAudioEl = null;
window._adminPlayAudio = (url, btn) => {
    if(_adminAudioEl){_adminAudioEl.pause();_adminAudioEl=null;if(btn)btn.textContent='▶ 재생';return;}
    const a=new Audio(url); a.volume=0.5;
    a.play().catch(e=>showToast('재생 실패: '+e.message, "error"));
    _adminAudioEl=a; if(btn)btn.textContent='⏹ 정지';
    a.onended=()=>{_adminAudioEl=null;if(btn)btn.textContent='▶ 재생';};
};

// [우선표시 토글]
window.toggleFeatured = async (id, setFeatured) => {
    const updateData = setFeatured
        ? { is_featured: true, featured_at: new Date().toISOString() }
        : { is_featured: false, featured_at: null };
    const { error } = await sb.from('library').update(updateData).eq('id', id);
    if (error) { showToast("실패: " + error.message, "error"); return; }
    showToast(setFeatured ? "⭐ 우선표시 설정" : "우선표시 해제", "success");
    loadTemplates();
};

// [선택 항목 일괄 우선표시]
window.featureSelectedTemplates = async () => {
    const checks = document.querySelectorAll('.tpl-chk:checked');
    if (checks.length === 0) { showToast("선택된 항목이 없습니다.", "warn"); return; }
    const ids = Array.from(checks).map(c => Number(c.value));
    const { error } = await sb.from('library').update({ is_featured: true, featured_at: new Date().toISOString() }).in('id', ids);
    if (error) { showToast("실패: " + error.message, "error"); return; }
    showToast(`⭐ ${ids.length}개 우선표시 설정`, "success");
    loadTemplates();
};

// [선택 항목 일괄 우선표시 해제]
window.unfeatureSelectedTemplates = async () => {
    const checks = document.querySelectorAll('.tpl-chk:checked');
    if (checks.length === 0) { showToast("선택된 항목이 없습니다.", "warn"); return; }
    const ids = Array.from(checks).map(c => Number(c.value));
    const { error } = await sb.from('library').update({ is_featured: false, featured_at: null }).in('id', ids);
    if (error) { showToast("실패: " + error.message, "error"); return; }
    showToast(`${ids.length}개 우선표시 해제`, "success");
    loadTemplates();
};

// [템플릿 삭제]
window.deleteTemplate = async (id) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await sb.from('library').delete().eq('id', id);
    if (error) showToast("실패: " + error.message, "error");
    else loadTemplates();
};

// [선택 삭제]
window.deleteSelectedTemplates = async () => {
    const checks = document.querySelectorAll('.tpl-chk:checked');
    if (checks.length === 0) { showToast("선택된 항목이 없습니다.", "warn"); return; }
    
    if (!confirm(`선택한 ${checks.length}개를 삭제하시겠습니까?`)) return;

    const ids = Array.from(checks).map(c => c.value);
    const { error } = await sb.from('library').delete().in('id', ids);
    
    if (error) showToast("실패: " + error.message, "error");
    else {
        showToast("삭제되었습니다.", "success");
        loadTemplates();
    }
};

// [유틸 함수들]
window.toggleAllTemplates = (source) => {
    document.querySelectorAll('.tpl-chk').forEach(c => c.checked = source.checked);
};

window.changeTplPage = (step) => {
    const next = currentTplPage + step;
    if (next < 1) { showToast("첫 페이지입니다.", "info"); return; }
    if (next > totalTplPages) { showToast("마지막 페이지입니다.", "info"); return; }
    currentTplPage = next;
    loadTemplates(false);
};

window.goTplPageDirect = () => {
    const input = document.getElementById('tplPageInput');
    if (!input) return;
    let page = parseInt(input.value);
    if (isNaN(page) || page < 1) page = 1;
    if (page > totalTplPages) page = totalTplPages;
    currentTplPage = page;
    loadTemplates(false);
};

window.goTplPage = (where) => {
    if (where === 'first') currentTplPage = 1;
    else if (where === 'last') currentTplPage = totalTplPages;
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
    const lblData = document.getElementById('lblData');
    const dataInput = document.getElementById('fileData');
    // PNG만 허용하는 카테고리 (사진배경, 패턴 제외)
    const pngOnly = ['logo', 'vector', 'graphic'].includes(cat);
    const thumbAccept = pngOnly ? '.png,image/png' : 'image/*';

    if (cat === 'audio') {
        if(groupData) groupData.style.display = 'block';
        if(thumbInput) thumbInput.accept = 'image/*';
        if(lblThumb) lblThumb.textContent = '1. 커버 이미지 (선택, 없으면 기본 아이콘)';
        if(lblData) lblData.textContent = '2. 음원 파일 (필수) MP3/WAV/OGG';
        if(dataInput) dataInput.accept = 'audio/*,.mp3,.wav,.ogg,.m4a';
    } else if (['vector', 'transparent-graphic', 'graphic'].includes(cat)) {
        if(groupData) groupData.style.display = 'block';
        if(thumbInput) thumbInput.accept = thumbAccept;
        if(lblThumb) lblThumb.textContent = pngOnly ? '1. 썸네일 (PNG만 가능)' : '1. 썸네일 (이미지)';
        if(lblData) lblData.textContent = '2. 벡터 데이터 (SVG/JSON)';
        if(dataInput) dataInput.accept = '.svg,.json,image/*';
    } else if (cat === 'logo') {
        if(groupData) groupData.style.display = 'none';
        if(thumbInput) thumbInput.accept = thumbAccept;
        if(lblThumb) lblThumb.textContent = '1. 썸네일 (PNG만 가능)';
    } else {
        if(groupData) groupData.style.display = 'none';
        if(thumbInput) thumbInput.accept = thumbAccept;
        if(lblThumb) lblThumb.textContent = '1. 썸네일 (이미지)';
        if(lblData) lblData.textContent = '2. 벡터 데이터 (SVG/JSON)';
        if(dataInput) dataInput.accept = '.svg,.json,image/*';
    }
};


// [폰트 목록 로드]
window.loadFonts = async () => {
    const tbody = document.getElementById('fontListBody');
    if (!tbody) return; // 폰트 화면이 아니면 중단
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">로딩 중...</td></tr>';

    try {
        const { data, error } = await sb.from('site_fonts').select('id, font_name, font_family, file_url, site_code, created_at').order('created_at', { ascending: false });

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

    if (!name || !family || !file) { showToast("모든 항목을 입력해주세요.", "warn"); return; }
    if (/\s/.test(family)) { showToast("Family Name에는 공백을 넣을 수 없습니다. (예: NotoSansKR)", "warn"); return; }

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

        showToast("폰트가 등록되었습니다.", "success");
        document.getElementById('fontName').value = '';
        document.getElementById('fontFamily').value = '';
        document.getElementById('fontFile').value = '';
        loadFonts();

    } catch (e) {
        showToast("오류 발생: " + e.message, "error");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// [폰트 삭제]
window.deleteFontDB = async (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await sb.from('site_fonts').delete().eq('id', id);
    if (error) showToast("삭제 실패: " + error.message, "error");
    else loadFonts();
};