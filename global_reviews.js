// =========================================================
// AI 리뷰 생성기 (관리자 전용)
// =========================================================

let _rvGenPhotoBase64 = null;
let _rvGenPhotoType = null;

// 초기화: 카테고리 로드
window.initReviewGen = async function() {
    const catSelect = document.getElementById('rvGenCategory');
    if (!catSelect || catSelect.options.length > 1) return;

    const { data } = await sb.from('admin_categories')
        .select('code, name')
        .order('name');

    if (data) {
        data.forEach(c => {
            catSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
        });
    }
};

// 카테고리 변경 → 상품 목록 로드
window._rvGenCategoryChange = async function() {
    const catCode = document.getElementById('rvGenCategory').value;
    const prodSelect = document.getElementById('rvGenProduct');
    prodSelect.innerHTML = '<option value="">전체 상품 (카테고리 전체에 생성)</option>';

    if (!catCode) return;

    const { data } = await sb.from('admin_products')
        .select('code, name')
        .eq('category', catCode)
        .order('name');

    if (data) {
        data.forEach(p => {
            prodSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
        });
    }
};

// 사진 미리보기
window._rvGenPhotoPreview = function(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target.result;
        _rvGenPhotoBase64 = result.split(',')[1]; // remove data:xxx;base64, prefix
        _rvGenPhotoType = file.type || 'image/jpeg';

        document.getElementById('rvGenPhotoPreviewImg').src = result;
        document.getElementById('rvGenPhotoPreviewWrap').style.display = 'block';
        document.getElementById('rvGenPhotoArea').style.display = 'none';
    };
    reader.readAsDataURL(file);
};

// 사진 삭제
window._rvGenClearPhoto = function() {
    _rvGenPhotoBase64 = null;
    _rvGenPhotoType = null;
    document.getElementById('rvGenPhotoInput').value = '';
    document.getElementById('rvGenPhotoPreviewWrap').style.display = 'none';
    document.getElementById('rvGenPhotoArea').style.display = 'flex';
};

// 로그 추가
function _rvLog(msg) {
    const log = document.getElementById('rvGenLog');
    if (log) {
        const time = new Date().toLocaleTimeString();
        log.innerHTML += `<div>[${time}] ${msg}</div>`;
        log.scrollTop = log.scrollHeight;
    }
}

// 프로그레스 업데이트
function _rvProgress(pct, text) {
    const bar = document.getElementById('rvGenProgressBar');
    const txt = document.getElementById('rvGenProgressText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text || (pct + '%');
}

// AI 리뷰 생성 메인
window.generateAIReviews = async function() {
    const catCode = document.getElementById('rvGenCategory').value;
    const prodCode = document.getElementById('rvGenProduct').value;
    const countPerLang = parseInt(document.getElementById('rvGenCount').value) || 3;

    if (!catCode && !prodCode) {
        alert('카테고리 또는 상품을 선택해주세요.');
        return;
    }

    // 상품 목록 결정
    let products = [];
    if (prodCode) {
        // 단일 상품
        const { data } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, category, img_url')
            .eq('code', prodCode)
            .single();
        if (data) products = [data];
    } else {
        // 카테고리 전체
        const { data } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, category, img_url')
            .eq('category', catCode);
        if (data) products = data;
    }

    if (products.length === 0) {
        alert('선택된 상품이 없습니다.');
        return;
    }

    // UI 상태 변경
    const btn = document.getElementById('rvGenBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...';
    document.getElementById('rvGenProgress').style.display = 'block';
    document.getElementById('rvGenLog').innerHTML = '';
    _rvProgress(0);

    _rvLog(`📦 총 ${products.length}개 상품에 대해 리뷰 생성 시작 (언어당 ${countPerLang}개 × 8개 언어)`);

    let completed = 0;
    let totalReviews = 0;

    for (const product of products) {
        const pct = Math.round((completed / products.length) * 100);
        _rvProgress(pct, `${completed}/${products.length}`);
        _rvLog(`🔄 [${completed + 1}/${products.length}] "${product.name}" 리뷰 생성 중...`);

        try {
            const payload = {
                product_code: product.code,
                product_name: product.name,
                category_name: catCode || product.category,
                count_per_lang: countPerLang,
            };

            // 사진이 업로드되었으면 사용, 없으면 상품 이미지 URL에서 가져오기 시도
            if (_rvGenPhotoBase64) {
                payload.photo_base64 = _rvGenPhotoBase64;
                payload.photo_media_type = _rvGenPhotoType;
            }

            const { data, error } = await sb.functions.invoke('generate-review', {
                body: payload,
            });

            if (error) {
                _rvLog(`❌ "${product.name}" 실패: ${error.message || error}`);
            } else {
                const result = typeof data === 'string' ? JSON.parse(data) : data;
                if (result.error) {
                    _rvLog(`❌ "${product.name}" 실패: ${result.error}`);
                } else {
                    totalReviews += result.count || 0;
                    _rvLog(`✅ "${product.name}" — ${result.count}개 리뷰 생성 완료 (${(result.langs || []).join(', ')})`);
                }
            }
        } catch (e) {
            _rvLog(`❌ "${product.name}" 예외: ${e.message}`);
        }

        completed++;
    }

    _rvProgress(100, '완료!');
    _rvLog(`🎉 완료! 총 ${totalReviews}개 리뷰가 ${products.length}개 상품에 생성되었습니다.`);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI 리뷰 생성 시작';
};
