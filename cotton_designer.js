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
    imgAspect: 1,      // width/height ratio of original image
    img: null,         // HTMLImageElement
    imgDataUrl: null,  // base64 for upload
    imgFileName: '',
    finish: 'raw',     // raw / hem / rod / eyelet / velcro
    finishExtra: 0
};

const FINISH_LABELS = {
    raw: '마감 없음',
    hem: '시접 처리',
    rod: '봉 거치',
    eyelet: '아일릿(고리)',
    velcro: '벨크로'
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
            state.imgAspect = img.width / img.height;
            state.imgWcm = 10;
            state.imgHcm = Math.round(10 / state.imgAspect * 10) / 10;
            document.getElementById('imgWcm').value = state.imgWcm;
            document.getElementById('imgHcm').value = state.imgHcm;
            document.getElementById('uploadZone').style.display = 'none';
            document.getElementById('previewArea').classList.add('active');
            document.getElementById('btnReset').style.display = '';
            document.getElementById('btnReplace').style.display = '';
            document.getElementById('orderBtn').disabled = false;
            const buyNowBtn = document.getElementById('buyNowBtn');
            if (buyNowBtn) buyNowBtn.disabled = false;
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
    total += (state.finishExtra || 0);
    document.getElementById('pUnit').textContent = unit.toLocaleString() + '원';
    document.getElementById('pQty').textContent = qtyLabel + (state.finishExtra ? ' + ' + FINISH_LABELS[state.finish] : '');
    document.getElementById('pTotal').textContent = total.toLocaleString() + '원';
}

// ────────────────────────────────────────────────
// 비율 유지 (가로 입력 → 세로 자동, 세로 입력 → 가로 자동)
// ────────────────────────────────────────────────
window._cdOnSizeInput = function(which) {
    const wInput = document.getElementById('imgWcm');
    const hInput = document.getElementById('imgHcm');
    const lockEl = document.getElementById('aspectLock');
    const locked = lockEl ? lockEl.checked : true;
    if (locked && state.imgAspect) {
        if (which === 'w') {
            const w = parseFloat(wInput.value) || 1;
            const h = Math.round((w / state.imgAspect) * 10) / 10;
            hInput.value = h;
        } else {
            const h = parseFloat(hInput.value) || 1;
            const w = Math.round((h * state.imgAspect) * 10) / 10;
            wInput.value = w;
        }
    }
    // 1300mm 폭 경고
    const w = parseFloat(wInput.value) || 0;
    if (w > 130) showToast('롤원단 최대폭은 130cm입니다');
    window._cdRender();
};

// ────────────────────────────────────────────────
// 마감 옵션 변경
// ────────────────────────────────────────────────
window._cdOnFinishChange = function() {
    const checked = document.querySelector('input[name="finish"]:checked');
    if (!checked) return;
    state.finish = checked.value;
    const label = checked.closest('.fin-opt');
    state.finishExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};

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

// ════════════════════════════════════════════════
// 🛒 cotton-print 자체 장바구니 (localStorage)
// ════════════════════════════════════════════════
const CART_KEY = 'cp_cart_v1';
function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return []; } }
function saveCart(c) { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch(e){} }

function calcCartTotal() {
    return getCart().reduce(function(s, it) { return s + (it.price || 0); }, 0);
}

window._cpUpdateCartUI = function() {
    const cart = getCart();
    const badge = document.getElementById('cartBadge');
    const inline = document.getElementById('cartCountInline');
    const body = document.getElementById('cartBody');
    const totalAmt = document.getElementById('cartTotalAmt');
    const checkoutBtn = document.getElementById('cartCheckoutBtn');

    if (badge) {
        if (cart.length > 0) { badge.style.display = 'flex'; badge.textContent = cart.length; }
        else { badge.style.display = 'none'; }
    }
    if (inline) inline.textContent = cart.length ? '(' + cart.length + ')' : '';
    if (totalAmt) totalAmt.textContent = calcCartTotal().toLocaleString() + '원';
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

    if (body) {
        if (cart.length === 0) {
            body.innerHTML = '<div class="cart-empty"><i class="fa-regular fa-folder-open"></i><div style="font-weight:700; color:var(--brown-dark); margin-bottom:4px;">장바구니가 비어있습니다</div><div style="font-size:12px;">디자인을 완성하고 장바구니에 담아보세요</div></div>';
        } else {
            body.innerHTML = cart.map(function(it, i) {
                const opts = [
                    it.fabricName,
                    it.imageSize,
                    it.layout,
                    it.qtyLabel,
                    it.finish !== 'raw' ? '마감: ' + (FINISH_LABELS[it.finish] || it.finish) : null
                ].filter(Boolean).join(' · ');
                return '<div class="cart-item">' +
                    '<img class="cart-item-thumb" src="' + (it.thumbDataUrl || '') + '" alt="">' +
                    '<div class="cart-item-info">' +
                        '<div class="cart-item-name">' + it.title + '</div>' +
                        '<div class="cart-item-opts">' + opts + '</div>' +
                        '<div class="cart-item-bottom">' +
                            '<span class="cart-item-price">' + (it.price||0).toLocaleString() + '원</span>' +
                            '<button class="cart-item-remove" onclick="window._cpCartRemove(' + i + ')"><i class="fa-solid fa-trash"></i> 삭제</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
    }
};

window._cpCartOpen = function() {
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    window._cpUpdateCartUI();
};
window._cpCartClose = function() {
    document.getElementById('cartOverlay').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
    document.body.style.overflow = '';
};
window._cpCartRemove = function(i) {
    const cart = getCart();
    cart.splice(i, 1);
    saveCart(cart);
    window._cpUpdateCartUI();
};

// 캔버스의 현재 미리보기를 썸네일로 (리사이즈된 데이터URL)
function captureThumbDataUrl() {
    const canvas = document.getElementById('fabricCanvas');
    if (!canvas) return null;
    try {
        const tmp = document.createElement('canvas');
        const targetW = 240;
        const ratio = canvas.width ? (canvas.height / canvas.width) : 1;
        tmp.width = targetW;
        tmp.height = Math.round(targetW * ratio);
        const ctx = tmp.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,tmp.width,tmp.height);
        ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
        return tmp.toDataURL('image/jpeg', 0.7);
    } catch (e) { return null; }
}

function buildCartItem() {
    const f = getFabric();
    if (!f) return null;
    let unit, qtyLabel, base, qtyVal;
    if (state.qty === 'sample') { unit = f.price_sample; qtyLabel = '샘플 1장'; base = unit; qtyVal = 'sample'; }
    else if (state.qty === 'custom' && state.customQty > 0) { unit = f.price_1ma; qtyLabel = state.customQty + '마'; base = unit * state.customQty; qtyVal = state.customQty + '마'; }
    else { unit = f.price_1ma; qtyLabel = '1마'; base = unit; qtyVal = '1마'; }
    const price = base + (state.finishExtra || 0);
    return {
        id: 't' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
        title: state.imgFileName ? state.imgFileName.replace(/\.[^.]+$/, '') : '내 패턴 원단',
        thumbDataUrl: captureThumbDataUrl(),
        imgDataUrl: state.imgDataUrl,
        imgFileName: state.imgFileName,
        fabricCode: f.code,
        fabricName: f.name,
        fabricWidth: f.width_cm,
        imageSize: state.imgWcm + 'x' + state.imgHcm + 'cm',
        layout: state.layout,
        qtyValue: qtyVal,
        qtyLabel: qtyLabel,
        finish: state.finish,
        finishExtra: state.finishExtra || 0,
        price: price,
        addedAt: new Date().toISOString()
    };
}

window._cdAddToCart = function() {
    if (!state.img || !state.imgDataUrl) { showToast('먼저 이미지를 업로드해주세요'); return; }
    const item = buildCartItem();
    if (!item) return;
    const cart = getCart();
    cart.push(item);
    saveCart(cart);
    window._cpUpdateCartUI();
    showToast('장바구니에 담았습니다 (' + cart.length + '개)');
    setTimeout(window._cpCartOpen, 400);
};

window._cdBuyNow = function() {
    if (!state.img || !state.imgDataUrl) { showToast('먼저 이미지를 업로드해주세요'); return; }
    const item = buildCartItem();
    if (!item) return;
    // 임시로 cart에 추가 후 즉시 체크아웃
    const cart = getCart();
    cart.push(item);
    saveCart(cart);
    window._cpUpdateCartUI();
    window._cpOpenCheckout();
};

window._cpOpenCheckout = function() {
    const cart = getCart();
    if (cart.length === 0) return;
    // 요약 렌더
    const list = document.getElementById('coItemList');
    list.innerHTML = cart.map(function(it){
        const opts = [it.fabricName, it.imageSize, it.qtyLabel, it.finish!=='raw'?FINISH_LABELS[it.finish]:''].filter(Boolean).join(' · ');
        return '<div class="co-summary-item"><div class="co-summary-item-name">' + it.title + '</div><div class="co-summary-item-opts">' + opts + '</div><div class="co-summary-item-price">' + it.price.toLocaleString() + '원</div></div>';
    }).join('');
    document.getElementById('coTotalAmt').textContent = calcCartTotal().toLocaleString() + '원';
    document.getElementById('checkoutOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
};

window._cpCloseCheckout = function() {
    document.getElementById('checkoutOverlay').classList.remove('open');
    document.body.style.overflow = '';
};

// 체크아웃 → vip_orders 등록 + 이미지들 업로드
window._cpSubmitOrder = async function() {
    const name = (document.getElementById('coName').value||'').trim();
    const phone = (document.getElementById('coPhone').value||'').trim();
    const email = (document.getElementById('coEmail').value||'').trim();
    const zip = (document.getElementById('coZip').value||'').trim();
    const addr1 = (document.getElementById('coAddr1').value||'').trim();
    const addr2 = (document.getElementById('coAddr2').value||'').trim();
    const memo = (document.getElementById('coMemo').value||'').trim();
    const payMethod = (document.querySelector('input[name="payMethod"]:checked')||{}).value || 'bank';

    if (!name) { alert('받으시는 분 성함을 입력해주세요.'); return; }
    if (!phone) { alert('연락처를 입력해주세요.'); return; }
    if (!addr1) { alert('배송지를 입력해주세요.'); return; }

    const cart = getCart();
    if (cart.length === 0) return;

    const btn = document.getElementById('coSubmitBtn');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리 중...';

    try {
        const sb = window.supabase ? window.supabase.createClient(
            'https://qinvtnhiidtmrzosyvys.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
        ) : null;
        if (!sb) throw new Error('연결 실패');

        // 디자인 이미지들 업로드
        const uploadedFiles = [];
        for (let i = 0; i < cart.length; i++) {
            const it = cart[i];
            if (!it.imgDataUrl) continue;
            const m = it.imgDataUrl.match(/^data:(.+?);base64,(.+)$/);
            if (!m) continue;
            const mime = m[1], b64 = m[2];
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let j=0; j<bin.length; j++) arr[j] = bin.charCodeAt(j);
            const blob = new Blob([arr], { type: mime });
            const ext = (mime.split('/')[1]||'png').replace(/[^a-z0-9]/gi,'');
            const path = 'cotton-print/orders/' + Date.now() + '_' + i + '.' + ext;
            const { error: upErr } = await sb.storage.from('orders').upload(path, blob);
            if (!upErr) {
                const u = sb.storage.from('orders').getPublicUrl(path).data.publicUrl;
                uploadedFiles.push({ name: it.imgFileName || ('item' + (i+1)), url: u, type: mime });
            }
        }

        const total = calcCartTotal();
        const lines = cart.map(function(it,i){
            return (i+1)+'. '+it.title+'\n   - '+it.fabricName+'\n   - 이미지 '+it.imageSize+' | 레이아웃 '+it.layout+' | '+it.qtyLabel+' | 마감: '+(FINISH_LABELS[it.finish]||it.finish)+'\n   - '+it.price.toLocaleString()+'원';
        }).join('\n');

        const fullAddr = '['+zip+'] '+addr1+' '+addr2;
        const memoText = '[Cotton Print 주문]\n결제: '+(payMethod==='bank'?'무통장 입금':'카드결제 (담당자 연락 후 처리)')+'\n주소: '+fullAddr+'\n메모: '+(memo||'없음')+'\n이메일: '+(email||'없음')+'\n\n=== 주문 상품 ===\n'+lines+'\n\n합계: '+total.toLocaleString()+'원';

        await sb.from('vip_orders').insert({
            customer_name: name,
            customer_phone: phone,
            preferred_manager: '본사담당자',
            memo: memoText,
            files: uploadedFiles.length ? uploadedFiles : null,
            status: 'pending'
        });

        // 카트 비우기
        saveCart([]);
        window._cpUpdateCartUI();
        window._cpCloseCheckout();
        window._cpCartClose();

        // 완료 안내
        if (payMethod === 'bank') {
            alert('✅ 주문이 접수되었습니다!\n\n[입금 안내]\n농협 351-1234-5678-90 (주)카멜레온프린팅\n금액: ' + total.toLocaleString() + '원\n\n* 입금 확인 후 영업일 내 제작 시작됩니다.\n* 담당자가 영업일 1~2일 내 연락드립니다.\n* 문의: 031-366-1984');
        } else {
            alert('✅ 주문이 접수되었습니다!\n\n카드결제 진행을 위해 담당자가 영업일 1~2일 내 연락드립니다.\n금액: ' + total.toLocaleString() + '원\n* 문의: 031-366-1984');
        }

        // 폼 초기화
        ['coName','coPhone','coEmail','coZip','coAddr1','coAddr2','coMemo'].forEach(function(id){ const e=document.getElementById(id); if(e) e.value=''; });
    } catch(e) {
        alert('주문 처리 실패: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
};

// ────────────────────────────────────────────────
// (구) 주문 → 메인몰 리다이렉트 (디자이너 패턴 자동로드 시 사용 가능)
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

        // 디자이너 패턴인 경우 — 판매시 10% 적립을 위해 royalty 레코드 prepare
        if (state.designerPatternId) {
            try {
                // pattern_royalties 테이블에 pending 레코드 생성 (주문 확정 시 어드민이 paid 처리)
                await sb.from('pattern_royalties').insert({
                    pattern_id: state.designerPatternId,
                    designer_name: state.designerName || null,
                    fabric_code: f.code,
                    qty: state.qty === 'custom' ? state.customQty : state.qty,
                    img_w_cm: state.imgWcm,
                    img_h_cm: state.imgHcm,
                    royalty_rate: 0.10,  // 10% 적립
                    status: 'pending',
                    source: 'cotton-print.com'
                });
            } catch(rErr) { console.warn('royalty record failed:', rErr); }
        }

        // 카멜레온 메인몰 장바구니로 이동 — URL 파라미터로 전달
        const params = new URLSearchParams({
            product: f.code,
            cotton_design: fileUrl,
            cotton_pattern: state.layout,
            cotton_img_w: state.imgWcm,
            cotton_img_h: state.imgHcm,
            cotton_qty: state.qty === 'custom' ? state.customQty : state.qty
        });
        if (state.designerPatternId) {
            params.set('designer_pattern_id', state.designerPatternId);
            if (state.designerName) params.set('designer_name', state.designerName);
        }
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
// URL ?pattern=ID 자동 로드 (디자이너 마켓플레이스에서 진입)
// ────────────────────────────────────────────────
async function autoLoadPatternFromUrl() {
    const params = new URLSearchParams(location.search);
    const patternId = params.get('pattern');
    if (!patternId) return;

    if (typeof window.supabase === 'undefined') {
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            if (typeof window.supabase !== 'undefined') break;
        }
    }
    if (typeof window.supabase === 'undefined') return;

    const sb = window.supabase.createClient(
        'https://qinvtnhiidtmrzosyvys.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
    );

    try {
        const { data, error } = await sb.from('user_patterns').select('*').eq('id', patternId).single();
        if (error || !data) return;

        // 썸네일 URL을 이미지로 자동 로드
        const url = data.thumb_url;
        if (!url) return;

        showToast('🎨 디자이너 패턴 "' + (data.name || '') + '" 로드 중...');

        // CORS 우회: fetch → blob → DataURL
        const resp = await fetch(url);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = function(e) {
            state.imgDataUrl = e.target.result;
            state.imgFileName = (data.name || 'pattern') + '.jpg';
            const img = new Image();
            img.onload = function() {
                state.img = img;
                state.designerPatternId = patternId;
                state.designerName = data.author || null;
                state.designerOriginalUrl = data.original_url || null;
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

                // 디자이너 패턴 배지 추가
                const previewArea = document.getElementById('previewArea');
                if (previewArea && !document.getElementById('designerBadge')) {
                    const badge = document.createElement('div');
                    badge.id = 'designerBadge';
                    badge.style.cssText = 'position:absolute; top:12px; left:12px; background:linear-gradient(135deg,#451a03,#78350f); color:#fde047; padding:6px 12px; border-radius:50px; font-size:11px; font-weight:800; z-index:10; box-shadow:0 4px 12px rgba(0,0,0,0.25);';
                    badge.innerHTML = '<i class="fa-solid fa-palette"></i> ' + (data.author ? data.author + ' · ' : '') + (data.name || 'Designer Pattern');
                    previewArea.style.position = 'relative';
                    previewArea.appendChild(badge);
                }

                window._cdRender();
                showToast('✅ 패턴 로드 완료! 원단을 선택하고 사이즈를 조정해보세요.');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.error('[autoLoadPattern] error:', e);
    }
}

// ────────────────────────────────────────────────
// 초기화
// ────────────────────────────────────────────────
populateFabricSelect();
updateFabricDetail();
updateSizeLabels();
updatePrice();
autoLoadPatternFromUrl();
if (window._cpUpdateCartUI) window._cpUpdateCartUI();

})();
