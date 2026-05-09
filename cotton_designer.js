// ════════════════════════════════════════════════════════════
// Cotton Print Designer — 이미지 → 패턴 원단 미리보기
// ════════════════════════════════════════════════════════════
(function(){
'use strict';

// 원단 데이터 (실제 카멜레온 admin_products 와 매핑)
// type: 원단 카테고리 코드 → admin_products.code 매핑
const FABRICS = {
    cotton: [
        { code: 'cb20001', name: '면20수 평직 (소폭:110cm)',
          desc: '두께가 얇고 가장 일반적으로 사용되는 20수 평직 원단입니다.\n봄·가을용 원피스, 셔츠, 바지뿐만 아니라 주방용품, 식탁보, 커튼 등 다양한 제품에 활용하기 좋습니다.',
          width_cm: 110, height_per_ma_cm: 91,
          price_sample: 9460, price_1ma: 17820,
          img: 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1767690223510_KakaoTalk_20250530_165125661_16.jpg' },
        { code: 'cb30001', name: '면30수 평직 (백아이보리)',
          desc: '30수 평직 원단. 얇고 부드러우며 통기성이 좋아 여름용 의류와 인테리어 소품에 적합합니다.',
          width_cm: 110, height_per_ma_cm: 91,
          price_sample: 9460, price_1ma: 17820,
          img: 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/wizard/1771881492818_0.jpg' },
        { code: '456456546', name: '광목20수 아이보리 대폭 롤인쇄',
          desc: '대폭(150cm) 광목 원단. 백월·포토존 배경·현수막 천 제작에 추천.',
          width_cm: 150, height_per_ma_cm: 91,
          price_sample: 12000, price_1ma: 24000,
          img: 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1767690223510_KakaoTalk_20250530_165125661_16.jpg' }
    ],
    poly: [
        { code: 'poly_1', name: '폴리에스터 옥스포드 (소폭:110cm)',
          desc: '내구성이 뛰어난 폴리에스터 원단. 가방·파우치·실외 디스플레이용으로 적합.',
          width_cm: 110, height_per_ma_cm: 91,
          price_sample: 8500, price_1ma: 16500,
          img: 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1767690223510_KakaoTalk_20250530_165125661_16.jpg' }
    ],
    sticker: [
        { code: 'sticker_fab', name: '점착 패브릭 스티커',
          desc: '뒷면 접착이 가능한 점착 패브릭. 벽면·유리·매장 디스플레이용.',
          width_cm: 110, height_per_ma_cm: 91,
          price_sample: 11000, price_1ma: 22000,
          img: 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1767690223510_KakaoTalk_20250530_165125661_16.jpg' }
    ],
    silk: [
        { code: 'silk_chiffon', name: '쉬폰 (소폭:110cm)',
          desc: '얇고 비치는 쉬폰 원단. 인테리어 커튼·드레스·베일·드레이프에 적합.',
          width_cm: 110, height_per_ma_cm: 91,
          price_sample: 13000, price_1ma: 26000,
          img: 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/products/products/1767690223510_KakaoTalk_20250530_165125661_16.jpg' }
    ]
};

// 상태
const state = {
    fabricType: 'cotton',
    fabricCode: 'cb20001',
    layout: 'basic',
    qty: '1ma', // 'sample' / '1ma' / number (마)
    customQty: 0,
    imgWcm: 10,
    imgHcm: 10,
    img: null,         // HTMLImageElement
    imgDataUrl: null,  // base64 for upload
    imgFileName: ''
};

// ────────────────────────────────────────────────
// 이미지 업로드
// ────────────────────────────────────────────────
window._cdUploadImage = function(files) {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
        showToast('이미지 파일만 업로드 가능합니다 (PDF/AI는 별도 문의)');
        return;
    }
    if (file.size > 50 * 1024 * 1024) {
        showToast('50MB 이하 파일만 업로드 가능합니다');
        return;
    }
    state.imgFileName = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        state.imgDataUrl = e.target.result;
        const img = new Image();
        img.onload = function() {
            state.img = img;
            // 이미지 비율 그대로 기본 사이즈 추측 (cm)
            const ratio = img.width / img.height;
            state.imgWcm = 10;
            state.imgHcm = Math.round(10 / ratio * 10) / 10;
            document.getElementById('imgWcm').value = state.imgWcm;
            document.getElementById('imgHcm').value = state.imgHcm;
            document.getElementById('uploadZone').style.display = 'none';
            document.getElementById('previewArea').classList.add('active');
            document.getElementById('btnReset').style.display = '';
            document.getElementById('btnReplace').style.display = '';
            document.getElementById('orderBtn').disabled = false;
            window._cdRender();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window._cdResetImage = function() {
    state.img = null; state.imgDataUrl = null; state.imgFileName = '';
    document.getElementById('uploadZone').style.display = '';
    document.getElementById('previewArea').classList.remove('active');
    document.getElementById('btnReset').style.display = 'none';
    document.getElementById('btnReplace').style.display = 'none';
    document.getElementById('orderBtn').disabled = true;
    document.getElementById('btnUpload').value = '';
};

// 드래그앤드롭
(function setupDragDrop(){
    const zone = document.getElementById('uploadZone');
    if (!zone) return;
    ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover');
    }));
    ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation();
        if (ev === 'dragleave' && zone.contains(e.relatedTarget)) return;
        zone.classList.remove('dragover');
    }));
    zone.addEventListener('drop', e => window._cdUploadImage(e.dataTransfer.files));
})();

// ────────────────────────────────────────────────
// 원단 선택
// ────────────────────────────────────────────────
window._cdSelectFabric = function(type) {
    state.fabricType = type;
    document.querySelectorAll('.fabric-type').forEach(el => el.classList.toggle('active', el.dataset.fabric === type));
    populateFabricSelect();
    state.fabricCode = FABRICS[type][0].code;
    updateFabricDetail();
    updateSizeLabels();
    updatePrice();
    window._cdRender();
};

function populateFabricSelect() {
    const sel = document.getElementById('fabricSelect');
    if (!sel) return;
    sel.innerHTML = '';
    FABRICS[state.fabricType].forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.code; opt.textContent = f.name;
        sel.appendChild(opt);
    });
    sel.value = state.fabricCode;
}

window._cdOnFabricChange = function() {
    state.fabricCode = document.getElementById('fabricSelect').value;
    updateFabricDetail();
    updateSizeLabels();
    updatePrice();
    window._cdRender();
};

function getFabric() {
    const list = FABRICS[state.fabricType] || [];
    return list.find(f => f.code === state.fabricCode) || list[0];
}

function updateFabricDetail() {
    const f = getFabric();
    if (!f) return;
    document.getElementById('fabricImg').style.backgroundImage = `url(${f.img})`;
    document.getElementById('fabricDesc').innerHTML = `<b>${f.name}</b>${(f.desc||'').replace(/\n/g,'<br>')}`;
}

function updateSizeLabels() {
    const f = getFabric();
    if (!f) return;
    const ma = state.qty === 'sample' ? 0.5 : (state.qty === '1ma' ? 1 : (state.customQty || 1));
    const totalH = state.qty === 'sample' ? 45 : Math.round(f.height_per_ma_cm * ma);
    const totalW = state.qty === 'sample' ? 54 : f.width_cm;
    document.getElementById('topSizeLabel').textContent = totalW + 'cm';
    document.getElementById('sideSizeLabel').textContent = totalH + 'cm';
}

// ────────────────────────────────────────────────
// 레이아웃 선택
// ────────────────────────────────────────────────
window._cdSelectLayout = function(name) {
    state.layout = name;
    document.querySelectorAll('.layout-btn').forEach(el => el.classList.toggle('active', el.dataset.layout === name));
    window._cdRender();
};

// ────────────────────────────────────────────────
// 수량 선택
// ────────────────────────────────────────────────
window._cdSelectQty = function(q) {
    state.qty = q; state.customQty = 0;
    document.querySelectorAll('.qty-option').forEach(el => el.classList.toggle('active', el.dataset.qty === q));
    document.getElementById('qtyCustom').value = '';
    updateSizeLabels();
    updatePrice();
    window._cdRender();
};

window._cdApplyCustomQty = function() {
    const v = parseInt(document.getElementById('qtyCustom').value);
    if (!v || v < 1) { showToast('1마 이상 입력해주세요'); return; }
    if (v > 500) { showToast('최대 500마까지 가능합니다'); return; }
    state.qty = 'custom'; state.customQty = v;
    document.querySelectorAll('.qty-option').forEach(el => el.classList.remove('active'));
    updateSizeLabels();
    updatePrice();
    window._cdRender();
};

function updatePrice() {
    const f = getFabric();
    if (!f) return;
    let unit, qtyLabel, total;
    if (state.qty === 'sample') {
        unit = f.price_sample; qtyLabel = '샘플 1장'; total = unit;
    } else if (state.qty === 'custom' && state.customQty > 0) {
        unit = f.price_1ma; qtyLabel = state.customQty + '마'; total = unit * state.customQty;
    } else {
        unit = f.price_1ma; qtyLabel = '1마'; total = unit;
    }
    document.getElementById('pUnit').textContent = unit.toLocaleString() + '원';
    document.getElementById('pQty').textContent = qtyLabel;
    document.getElementById('pTotal').textContent = total.toLocaleString() + '원';
}

// ────────────────────────────────────────────────
// 캔버스 렌더링
// ────────────────────────────────────────────────
window._cdRender = function() {
    if (!state.img) return;
    const f = getFabric();
    if (!f) return;

    state.imgWcm = parseFloat(document.getElementById('imgWcm').value) || 10;
    state.imgHcm = parseFloat(document.getElementById('imgHcm').value) || 10;

    // 캔버스 사이즈 결정 (가로 max 800px, 비율 유지)
    const fabricW = state.qty === 'sample' ? 54 : f.width_cm;
    const fabricH = state.qty === 'sample' ? 45 :
                    state.qty === 'custom' ? Math.min(state.customQty, 5) * f.height_per_ma_cm :
                    f.height_per_ma_cm;
    const maxW = 800, maxH = 660;
    const scaleByW = maxW / fabricW;
    const scaleByH = maxH / fabricH;
    const pxPerCm = Math.min(scaleByW, scaleByH);
    const cw = Math.floor(fabricW * pxPerCm);
    const ch = Math.floor(fabricH * pxPerCm);

    const canvas = document.getElementById('fabricCanvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);

    const tileW = state.imgWcm * pxPerCm;
    const tileH = state.imgHcm * pxPerCm;
    if (tileW < 2 || tileH < 2) return;

    const layout = state.layout;

    if (layout === 'centered') {
        const x = (cw - tileW) / 2, y = (ch - tileH) / 2;
        ctx.drawImage(state.img, x, y, tileW, tileH);
    }
    else if (layout === 'basic') {
        for (let y = 0; y < ch; y += tileH) {
            for (let x = 0; x < cw; x += tileW) {
                ctx.drawImage(state.img, x, y, tileW, tileH);
            }
        }
    }
    else if (layout === 'halfdrop') {
        // 매 두 번째 컬럼은 세로로 절반 내림
        const cols = Math.ceil(cw / tileW) + 1;
        for (let c = 0; c < cols; c++) {
            const x = c * tileW;
            const offsetY = (c % 2) * (tileH / 2);
            for (let y = -tileH; y < ch; y += tileH) {
                ctx.drawImage(state.img, x, y + offsetY, tileW, tileH);
            }
        }
    }
    else if (layout === 'halfbrick') {
        // 매 두 번째 행은 가로로 절반 밂
        const rows = Math.ceil(ch / tileH) + 1;
        for (let r = 0; r < rows; r++) {
            const y = r * tileH;
            const offsetX = (r % 2) * (tileW / 2);
            for (let x = -tileW; x < cw; x += tileW) {
                ctx.drawImage(state.img, x + offsetX, y, tileW, tileH);
            }
        }
    }
    else if (layout === 'mirror') {
        const cols = Math.ceil(cw / tileW), rows = Math.ceil(ch / tileH);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const flipX = c % 2 === 1, flipY = r % 2 === 1;
                ctx.save();
                ctx.translate(c * tileW + (flipX ? tileW : 0), r * tileH + (flipY ? tileH : 0));
                ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                ctx.drawImage(state.img, 0, 0, tileW, tileH);
                ctx.restore();
            }
        }
    }

    // 가장자리 살짝 페이드 (실제 인쇄 영역 표현)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1);
};

// ────────────────────────────────────────────────
// 주문 → cafe2626.com 장바구니
// ────────────────────────────────────────────────
window._cdSubmitOrder = async function() {
    if (!state.img || !state.imgDataUrl) { showToast('먼저 이미지를 업로드해주세요'); return; }

    const f = getFabric();
    if (!f) { showToast('원단을 선택해주세요'); return; }

    const orderBtn = document.getElementById('orderBtn');
    const originalText = orderBtn.innerHTML;
    orderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> &nbsp;업로드 중...';
    orderBtn.disabled = true;

    try {
        // Supabase 클라이언트
        const sb = window.supabase ? window.supabase.createClient(
            'https://qinvtnhiidtmrzosyvys.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
        ) : null;
        if (!sb) throw new Error('서버 연결 실패');

        // base64 → blob
        const b64 = state.imgDataUrl.split(',')[1];
        const byteChars = atob(b64);
        const byteArrays = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArrays[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArrays], { type: 'image/png' });

        // 업로드 (Supabase Storage: orders 버킷의 cotton-print 폴더)
        const ts = Date.now(); const rnd = Math.random().toString(36).substring(2, 8);
        const ext = (state.imgFileName.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '');
        const path = `cotton-print/${ts}_${rnd}.${ext}`;
        const { error: upErr } = await sb.storage.from('orders').upload(path, blob);
        if (upErr) throw upErr;
        const { data: pubData } = sb.storage.from('orders').getPublicUrl(path);
        const fileUrl = pubData.publicUrl;

        // 카멜레온 메인몰 장바구니로 이동 — URL 파라미터로 전달
        const params = new URLSearchParams({
            product: f.code,
            cotton_design: fileUrl,
            cotton_pattern: state.layout,
            cotton_img_w: state.imgWcm,
            cotton_img_h: state.imgHcm,
            cotton_qty: state.qty === 'custom' ? state.customQty : state.qty
        });
        const url = 'https://www.cafe2626.com/?' + params.toString();
        showToast('업로드 완료! 장바구니로 이동합니다...');
        setTimeout(() => { location.href = url; }, 800);
    } catch (e) {
        console.error('[cd-order] error', e);
        showToast('업로드 실패: ' + (e.message || '알 수 없는 오류'));
        orderBtn.innerHTML = originalText;
        orderBtn.disabled = false;
    }
};

// ────────────────────────────────────────────────
// 토스트
// ────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(window._cdToastT);
    window._cdToastT = setTimeout(() => t.style.display = 'none', 3000);
}

// ────────────────────────────────────────────────
// 초기화
// ────────────────────────────────────────────────
populateFabricSelect();
updateFabricDetail();
updateSizeLabels();
updatePrice();

})();
