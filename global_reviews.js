// =========================================================
// AI 리뷰 생성기 (관리자 전용)
// =========================================================

let _rvGenPhotos = []; // [{file, base64, type, previewUrl}]
let _rvGenAllCategories = [];

// 초기화: 대분류 + 카테고리 로드
window.initReviewGen = async function() {
    const topSelect = document.getElementById('rvGenTopCategory');
    if (!topSelect || topSelect.options.length > 1) return;

    const { data: topCats } = await sb.from('admin_top_categories')
        .select('code, name')
        .order('sort_order');
    if (topCats) {
        topCats.forEach(tc => {
            topSelect.innerHTML += `<option value="${tc.code}">${tc.name}</option>`;
        });
    }

    const { data: cats } = await sb.from('admin_categories')
        .select('code, name, top_category_code')
        .order('name');
    _rvGenAllCategories = cats || [];
};

// 대분류 변경 → 소분류 필터링
window._rvGenTopCategoryChange = function() {
    const topCode = document.getElementById('rvGenTopCategory').value;
    const catSelect = document.getElementById('rvGenCategory');
    const prodSelect = document.getElementById('rvGenProduct');
    catSelect.innerHTML = '<option value="">선택 안함</option>';
    prodSelect.innerHTML = '<option value="">전체 상품</option>';
    if (!topCode) return;
    _rvGenAllCategories.filter(c => c.top_category_code === topCode).forEach(c => {
        catSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });
};

// 카테고리 변경 → 상품 목록 로드
window._rvGenCategoryChange = async function() {
    const catCode = document.getElementById('rvGenCategory').value;
    const prodSelect = document.getElementById('rvGenProduct');
    prodSelect.innerHTML = '<option value="">전체 상품</option>';
    if (!catCode) return;
    const { data } = await sb.from('admin_products')
        .select('code, name').eq('category', catCode).order('name');
    if (data) data.forEach(p => {
        prodSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
    });
};

// ===== 다중 사진 처리 =====
window._rvGenPhotosChanged = function(input) {
    const files = Array.from(input.files);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            _rvGenPhotos.push({
                file,
                base64: dataUrl.split(',')[1],
                type: file.type || 'image/jpeg',
                previewUrl: dataUrl
            });
            _rvRenderPhotoGrid();
        };
        reader.readAsDataURL(file);
    });
    input.value = ''; // 같은 파일 재선택 가능하게
};

window._rvGenRemovePhoto = function(idx) {
    _rvGenPhotos.splice(idx, 1);
    _rvRenderPhotoGrid();
};

window._rvGenClearAllPhotos = function() {
    _rvGenPhotos = [];
    _rvRenderPhotoGrid();
};

function _rvRenderPhotoGrid() {
    const grid = document.getElementById('rvGenPhotoGrid');
    const area = document.getElementById('rvGenPhotoArea');
    const countEl = document.getElementById('rvGenPhotoCount');

    if (_rvGenPhotos.length === 0) {
        grid.style.display = 'none';
        area.style.display = 'flex';
        if (countEl) countEl.textContent = '';
        return;
    }

    area.style.display = 'none';
    grid.style.display = 'block';
    if (countEl) countEl.textContent = `(${_rvGenPhotos.length}장 = 상품당 ${_rvGenPhotos.length}개 리뷰 × 8개 언어)`;

    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px,1fr)); gap:8px;">';
    _rvGenPhotos.forEach((p, i) => {
        html += `<div style="position:relative; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0;">
            <img src="${p.previewUrl}" style="width:100%; height:80px; object-fit:cover;">
            <button onclick="window._rvGenRemovePhoto(${i})" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; line-height:20px; padding:0;">&times;</button>
        </div>`;
    });
    html += '</div>';
    html += `<div style="display:flex; gap:8px; margin-top:8px;">
        <button onclick="document.getElementById('rvGenPhotoInput').click()" style="flex:1; padding:8px; border:1.5px dashed #6366f1; border-radius:8px; background:#fff; color:#6366f1; cursor:pointer; font-size:13px; font-weight:600;"><i class="fa-solid fa-plus"></i> 사진 추가</button>
        <button onclick="window._rvGenClearAllPhotos()" style="padding:8px 14px; border:1px solid #ef4444; border-radius:8px; background:#fff; color:#ef4444; cursor:pointer; font-size:13px;"><i class="fa-solid fa-trash"></i> 전체 삭제</button>
    </div>`;
    grid.innerHTML = html;
}

// ===== 사진 스토리지 업로드 =====
async function _uploadReviewPhoto(photoObj) {
    const ext = photoObj.file.name.split('.').pop() || 'jpg';
    const fileName = `review_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    try {
        const { data, error } = await sb.storage.from('review-photos').upload(fileName, photoObj.file, {
            cacheControl: '3600', upsert: false
        });
        if (error) {
            console.error('[리뷰 사진 업로드 실패]', error.message);
            return null;
        }
        const { data: urlData } = sb.storage.from('review-photos').getPublicUrl(data.path);
        return urlData.publicUrl;
    } catch (e) {
        console.error('[리뷰 사진 업로드 예외]', e);
        return null;
    }
}

// ===== 유틸 =====
function _rvLog(msg) {
    const log = document.getElementById('rvGenLog');
    if (log) {
        const time = new Date().toLocaleTimeString();
        log.innerHTML += `<div>[${time}] ${msg}</div>`;
        log.scrollTop = log.scrollHeight;
    }
}

function _rvProgress(pct, text) {
    const bar = document.getElementById('rvGenProgressBar');
    const txt = document.getElementById('rvGenProgressText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text || (pct + '%');
}

async function _resolveProducts() {
    const topCode = document.getElementById('rvGenTopCategory').value;
    const catCode = document.getElementById('rvGenCategory').value;
    const prodCode = document.getElementById('rvGenProduct').value;

    if (prodCode) {
        const { data } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, category, img_url')
            .eq('code', prodCode).single();
        return data ? [data] : [];
    }
    if (catCode) {
        const { data } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, category, img_url')
            .eq('category', catCode);
        return data || [];
    }
    if (topCode) {
        const catCodes = _rvGenAllCategories
            .filter(c => c.top_category_code === topCode).map(c => c.code);
        if (catCodes.length === 0) return [];
        const { data } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, category, img_url')
            .in('category', catCodes);
        return data || [];
    }
    return [];
}

// ===== AI 리뷰 생성 메인 =====
window.generateAIReviews = async function() {
    const topCode = document.getElementById('rvGenTopCategory').value;
    const catCode = document.getElementById('rvGenCategory').value;
    const prodCode = document.getElementById('rvGenProduct').value;

    if (!topCode && !catCode && !prodCode) {
        alert('대분류, 카테고리, 또는 상품을 선택해주세요.');
        return;
    }
    if (_rvGenPhotos.length === 0) {
        alert('사진을 1장 이상 업로드해주세요.\n사진 1장 = 리뷰 1개 × 8개 언어');
        return;
    }

    const products = await _resolveProducts();
    if (products.length === 0) {
        alert('선택된 상품이 없습니다.');
        return;
    }

    const photoCount = _rvGenPhotos.length;
    const isSingleProduct = !!prodCode;
    const photosPerProduct = isSingleProduct ? photoCount : 1;
    const totalEstimate = products.length * photosPerProduct * 8;
    const mode = prodCode ? '단일 상품' : catCode ? '카테고리' : '대분류';

    const confirmMsg = isSingleProduct
        ? `[${mode}] 1개 상품 × ${photoCount}장 사진 × 8개 언어\n= 총 약 ${totalEstimate}개 리뷰 생성\n\n계속할까요?`
        : `[${mode}] ${products.length}개 상품 × 랜덤 1장 사진 × 8개 언어\n= 총 약 ${totalEstimate}개 리뷰 생성\n(${photoCount}장 사진 풀에서 랜덤 배정)\n\n계속할까요?`;
    if (!confirm(confirmMsg)) {
        return;
    }

    // UI 상태 변경
    const btn = document.getElementById('rvGenBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...';
    document.getElementById('rvGenProgress').style.display = 'block';
    document.getElementById('rvGenLog').innerHTML = '';
    _rvProgress(0);

    // 1단계: 사진 모두 스토리지에 업로드
    _rvLog(`📸 ${photoCount}장 사진 업로드 중...`);
    const photoUrls = [];
    for (let i = 0; i < _rvGenPhotos.length; i++) {
        const url = await _uploadReviewPhoto(_rvGenPhotos[i]);
        if (url) {
            photoUrls.push(url);
            _rvLog(`  ✅ 사진 ${i + 1}/${photoCount} 업로드 완료`);
        } else {
            _rvLog(`  ⚠️ 사진 ${i + 1}/${photoCount} 업로드 실패 (건너뜀)`);
        }
    }

    if (photoUrls.length === 0) {
        _rvLog('❌ 업로드된 사진이 없어 중단합니다.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI 리뷰 생성 시작';
        return;
    }

    // 2단계: 단일 상품 → 모든 사진, 대분류/소분류 → 상품당 랜덤 1장
    const totalSteps = products.length * photosPerProduct;
    let step = 0;
    let totalReviews = 0;

    if (isSingleProduct) {
        _rvLog(`📦 [${mode}] 1개 상품 × ${photoCount}장 사진 = ${totalSteps}건 처리 시작`);
    } else {
        _rvLog(`📦 [${mode}] ${products.length}개 상품 × 각 1장 사진 = ${totalSteps}건 처리 시작`);
    }

    for (const product of products) {
        // 단일 상품: 모든 사진 순회, 카테고리: 랜덤 1장
        const photoIndices = isSingleProduct
            ? photoUrls.map((_, i) => i)
            : [Math.floor(Math.random() * photoUrls.length)];

        for (const pi of photoIndices) {
            const pct = Math.round((step / totalSteps) * 100);
            _rvProgress(pct, `${step}/${totalSteps}`);
            _rvLog(`🔄 [${step + 1}/${totalSteps}] "${product.name}" 사진${pi + 1} 리뷰 생성 중...`);

            try {
                const contextText = document.getElementById('rvGenContext')?.value?.trim() || '';
                const payload = {
                    product_code: product.code,
                    product_name: product.name,
                    category_name: product.category,
                    count_per_lang: 1,
                    photo_base64: _rvGenPhotos[pi]?.base64 || null,
                    photo_media_type: _rvGenPhotos[pi]?.type || 'image/jpeg',
                    photo_url: photoUrls[pi],
                    context: contextText,
                };

                const { data, error } = await sb.functions.invoke('generate-review', {
                    body: payload,
                });

                if (error) {
                    _rvLog(`  ❌ 실패: ${error.message || error}`);
                } else {
                    const result = typeof data === 'string' ? JSON.parse(data) : data;
                    if (result.error) {
                        _rvLog(`  ❌ 실패: ${result.error}`);
                    } else {
                        totalReviews += result.count || 0;
                        _rvLog(`  ✅ ${result.count}개 리뷰 생성 (사진 포함)`);
                    }
                }
            } catch (e) {
                _rvLog(`  ❌ 예외: ${e.message}`);
            }

            step++;
        }
    }

    _rvProgress(100, '완료!');
    _rvLog(`🎉 완료! 총 ${totalReviews}개 사진 리뷰가 ${products.length}개 상품에 생성되었습니다.`);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI 리뷰 생성 시작';
};
