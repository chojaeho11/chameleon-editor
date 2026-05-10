// ════════════════════════════════════════════════════════════
// Cotton Print Designer — 이미지 → 패턴 원단 미리보기
// ════════════════════════════════════════════════════════════
(function(){
'use strict';

// ════════════════════════════════════════════════════
// 회배 단가 (1회배 = 1 m² = 100×100cm)
// 130×100cm = 1.3회배, 100×50cm = 0.5회배 등 비례 계산
// 최소 1회배 (1m² 미만은 1로 처리)
// ════════════════════════════════════════════════════
const HOEBAE_UNIT_PRICE = 15000;
const HOEBAE_AREA_CM2 = 100 * 100; // 1 m² = 10,000 cm²

// 원단 8종 (가격 동일, 회배 단가 사용)
const FABRIC_TYPES = {
    cotton20: { name: '면20수 평직', isCotton: true, desc: '얇고 일반적인 20수 평직. 의류·인테리어 소품 활용 좋음.' },
    cotton30: { name: '면30수 평직', isCotton: true, desc: '얇고 부드러운 30수 평직. 통기성 좋아 여름 의류 적합.' },
    cotton16: { name: '면16수 평직', isCotton: true, desc: '두께감 있는 16수. 가방·파우치·러너 등 적합.' },
    cotton10: { name: '면10수 평직', isCotton: true, desc: '두꺼운 10수. 백월·매장 디스플레이·인테리어용.' },
    chiffon:  { name: '쉬폰', isCotton: false, desc: '얇고 비치는 원단. 커튼·드레스·드레이프 적합.' },
    oxford:   { name: '옥스포드', isCotton: false, desc: '내구성 뛰어난 폴리. 가방·실외 디스플레이용.' },
    rayon:    { name: '레이온/인견', isCotton: false, desc: '시원한 인견 원단. 여름 의류·블라우스 적합.' },
    linen:    { name: '린넬', isCotton: false, desc: '천연 린넨. 고급 인테리어·식탁보·앞치마.' }
};
const COLOR_LABELS = { white: '화이트', natural: '네츄럴', ivory: '백아이보리' };

// 대량 할인 정책 (수량 기준)
function getVolumeDiscount(qty) {
    if (qty >= 100) return { pct: 30, label: '100마+ 30%↓' };
    if (qty >= 50)  return { pct: 20, label: '50마+ 20%↓' };
    if (qty >= 10)  return { pct: 10, label: '10마+ 10%↓' };
    return { pct: 0, label: '' };
}

// admin_products / admin_categories 동기화 결과 — 런타임에 채워짐
let DB_FABRICS = [];     // 패브릭만
let DB_HOOKS = [];       // 고리 (선택)
let DB_ACCESSORIES = []; // 그 외 부자재 (집게링/봉 등)
let DB_GROUPS = {};      // group_label -> [products]

// 원단 키워드로 그룹 분류
// 반환: 패브릭 그룹명 / '__hook__' (고리) / '__accessory__' (그 외 부자재) / null (노출 안 함)
function classifyGroup(p) {
    const n = (p.name || '').toLowerCase();
    // 고리 부자재 (고리/아일릿/후크/걸이만)
    if (/^고리|\s고리|아일릿|후크|걸이|hook|eyelet/.test(n)) return '__hook__';
    // 그 외 부자재 (집게/봉/벨크로/행거/클립/받침/스탠드/배접/재단)
    if (/집게|링|봉|벨크로|행거|클립|받침|스탠드|배접|재단/.test(n)) return '__accessory__';
    if (/광목|면\b|cotton|cb/i.test(n) || (p.code||'').startsWith('cb')) return '면/광목';
    if (/쉬폰|chiffon|실크|silk/.test(n)) return '쉬폰/실크';
    if (/레이온|rayon|인견/.test(n)) return '레이온/인견';
    if (/폴리|polyester|oxford|옥스포드/.test(n)) return '폴리/옥스포드';
    if (/스티커|점착|sticker/.test(n)) return '점착/스티커';
    return null;
}

// 상태
const state = {
    fabricType: 'cotton20',           // 8종 중 1
    fabricColor: 'white',             // 면 종류일 때만 사용
    fabricCode: 'cotton20_white',     // 합성 코드 (orders.items 저장용)
    layout: 'basic',
    orderWcm: 130,
    orderHcm: 100,
    orderQty: 1,
    imgWcm: 10,
    imgHcm: 10,
    imgAspect: 1,
    img: null,
    imgDataUrl: null,
    imgFileName: '',
    // 1) 원단 마감 (필수, 기본 롤인쇄, m²당 가격)
    finishCode: 'roll',
    finishName: '롤인쇄',
    finishExtra: 0,                   // 단가/m²
    // 2) 고리 (선택, 1회 가격)
    hookCode: '',
    hookName: '',
    hookExtra: 0,
    // 3) 부자재 (선택, 1회 가격)
    accCode: '',
    accName: '',
    accExtra: 0
};

function getFabric() {
    const t = FABRIC_TYPES[state.fabricType] || FABRIC_TYPES.cotton20;
    const isCotton = t.isCotton;
    const colorLabel = isCotton ? (' (' + (COLOR_LABELS[state.fabricColor]||'') + ')') : '';
    return {
        code: state.fabricCode,
        name: t.name + colorLabel,
        desc: t.desc,
        isCotton: isCotton,
        type: state.fabricType,
        color: isCotton ? state.fabricColor : null
    };
}

window._cdSelectFabricType = function(type) {
    state.fabricType = type;
    const t = FABRIC_TYPES[type] || FABRIC_TYPES.cotton20;
    state.fabricCode = type + (t.isCotton ? '_' + state.fabricColor : '');
    document.querySelectorAll('.fabric-type').forEach(el => el.classList.toggle('active', el.dataset.fab === type));
    document.getElementById('fabricColorWrap').style.display = t.isCotton ? '' : 'none';
    updateFabricDetail();
    updatePrice();
};

window._cdSelectColor = function(color, btn) {
    state.fabricColor = color;
    const t = FABRIC_TYPES[state.fabricType] || FABRIC_TYPES.cotton20;
    if (t.isCotton) state.fabricCode = state.fabricType + '_' + color;
    document.querySelectorAll('.color-chip').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateFabricDetail();
    updatePrice();
};

function calcHoebae() {
    const w = state.orderWcm || 0;
    const h = state.orderHcm || 0;
    return (w * h) / HOEBAE_AREA_CM2;
}

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

// ════════════════════════════════════════════════════
// DB에서 부자재 옵션만 로드 (원단은 하드코딩 8종)
// ════════════════════════════════════════════════════
async function loadDbFabrics() {
    const sb = window.supabase ? window.supabase.createClient(
        'https://qinvtnhiidtmrzosyvys.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
    ) : null;
    if (!sb) return;
    try {
        const { data: subCats } = await sb.from('admin_categories').select('code').eq('top_category_code', '22222');
        const codes = (subCats||[]).map(c => c.code);
        let products = [];
        if (codes.length > 0) {
            const { data } = await sb.from('admin_products').select('code, name, price, sort_order').in('category', codes);
            products = data || [];
        }
        const classified = products
            .filter(p => !(p.code||'').startsWith('ua_'))
            .sort((a,b) => (a.sort_order||999) - (b.sort_order||999))
            .map(p => Object.assign(p, { group: classifyGroup(p) }));

        DB_ACCESSORIES = classified.filter(p => p.group === '__accessory__');
        renderAccessoryOptions();
    } catch(e) { console.error('[loadDbFabrics]', e); }
}

// 고리 옵션 렌더 (DB_HOOKS)
function renderHookOptions() {
    const list = document.getElementById('hookExtraList');
    if (!list) return;
    if (!DB_HOOKS.length) {
        list.innerHTML = '<div style="padding:8px 12px; font-size:11px; color:var(--text-light);">현재 등록된 고리 옵션이 없습니다</div>';
        return;
    }
    list.innerHTML = DB_HOOKS.map(h => {
        const p = parseInt(h.price) || 0;
        return `<label class="fin-opt" data-hook="${h.code}" data-name="${(h.name||'').replace(/"/g,'&quot;')}" data-extra="${p}">
            <input type="radio" name="hook" value="${h.code}" onchange="window._cdOnHookChange()">
            <span class="fin-opt-label"><b>${h.name}</b></span>
            <span class="fin-opt-price">+${p.toLocaleString()}원</span>
        </label>`;
    }).join('');
}

// 부자재 옵션 렌더 (DB_ACCESSORIES)
function renderAccessoryOptions() {
    const list = document.getElementById('accessoryExtraList');
    if (!list) return;
    if (!DB_ACCESSORIES.length) {
        list.innerHTML = '<div style="padding:8px 12px; font-size:11px; color:var(--text-light);">현재 등록된 부자재가 없습니다</div>';
        return;
    }
    list.innerHTML = DB_ACCESSORIES.map(a => {
        const p = parseInt(a.price) || 0;
        return `<label class="fin-opt" data-acc="${a.code}" data-name="${(a.name||'').replace(/"/g,'&quot;')}" data-extra="${p}">
            <input type="radio" name="accessory" value="${a.code}" onchange="window._cdOnAccessoryChange()">
            <span class="fin-opt-label"><b>${a.name}</b></span>
            <span class="fin-opt-price">+${p.toLocaleString()}원</span>
        </label>`;
    }).join('');
}

function updateFabricDetail() {
    const f = getFabric();
    if (!f) return;
    const img = document.getElementById('fabricImg');
    if (img) img.style.background = '#f5f5f4';
    document.getElementById('fabricDesc').innerHTML = `<b>${f.name}</b><div style="font-size:11px; color:var(--text-light); margin-top:4px;">${f.desc} · 대폭 130cm</div>`;
}

// 원단 마감은 HTML에 하드코딩 (가재단/오버록/인터록/말아박기) — 여기서는 noop
function renderFinishOptions() { /* 마감은 HTML 하드코딩 */ }

function updateSizeLabels() {
    document.getElementById('topSizeLabel').textContent = state.orderWcm.toFixed(0) + 'cm';
    document.getElementById('sideSizeLabel').textContent = state.orderHcm.toFixed(0) + 'cm';
}

// ────────────────────────────────────────────────
// 레이아웃 선택
// ────────────────────────────────────────────────
window._cdSelectLayout = function(name) {
    state.layout = name;
    document.querySelectorAll('.layout-btn').forEach(el => el.classList.toggle('active', el.dataset.layout === name));
    window._cdRender();
};

// ════════════════════════════════════════════════════
// 회배 계산기 + 수량
// ════════════════════════════════════════════════════
window._cdCalcHoebae = function() {
    const wEl = document.getElementById('orderWcm');
    const hEl = document.getElementById('orderHcm');
    const qEl = document.getElementById('orderQty');
    let w = parseFloat(wEl.value) || 130;
    let h = parseFloat(hEl.value) || 100;
    let q = parseInt(qEl.value) || 1;
    if (w > 130) { w = 130; wEl.value = 130; showToast('가로는 최대 130cm입니다'); }
    if (w < 10) w = 10;
    if (h < 10) h = 10;
    if (q < 1) q = 1;
    state.orderWcm = w; state.orderHcm = h; state.orderQty = q;
    const rawHoebae = calcHoebae();
    const hoebae = Math.max(1, rawHoebae); // 최소 1배 청구
    const itemPrice = Math.round(hoebae * HOEBAE_UNIT_PRICE);
    document.getElementById('hoebaeAmount').textContent = hoebae.toFixed(2) + ' 회배' + (rawHoebae < 1 ? ' (최소 1배)' : '');
    document.getElementById('hoebaePrice').textContent = itemPrice.toLocaleString() + '원';
    updateSizeLabels();
    updatePrice();
    window._cdRender();
};

window._cdQtyChg = function(d) {
    const qEl = document.getElementById('orderQty');
    let q = (parseInt(qEl.value) || 1) + d;
    if (q < 1) q = 1; if (q > 999) q = 999;
    qEl.value = q;
    window._cdCalcHoebae();
};

// 토글: 고리/부자재 collapse
window._cdToggleCollapse = function(id, head) {
    const body = document.getElementById(id);
    const card = head.closest('.collapse-card');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'flex';
    if (card) card.classList.toggle('open', !open);
};

// 회배 (최소 1배) — 1m² 미만은 1로 처리
function calcBillableHoebae() {
    return Math.max(1, calcHoebae());
}

function updatePrice() {
    const rawHoebae = calcHoebae();           // 표시용 (실제 비율)
    const hoebae = calcBillableHoebae();      // 청구용 (최소 1)
    const itemPrice = Math.round(hoebae * HOEBAE_UNIT_PRICE);
    const finishPerItem = Math.round((state.finishExtra || 0) * hoebae); // 회배 비례
    const otherPerItem = (state.hookExtra || 0) + (state.accExtra || 0);
    const perItem = itemPrice + finishPerItem + otherPerItem;
    const subtotal = perItem * state.orderQty;
    const disc = getVolumeDiscount(state.orderQty);
    const discountAmt = Math.round(subtotal * disc.pct / 100);
    const total = subtotal - discountAmt;

    document.getElementById('pUnit').textContent = itemPrice.toLocaleString() + '원 (' + hoebae.toFixed(2) + '회배)';
    document.getElementById('pQty').textContent = state.orderQty + '개';

    const extraParts = [];
    extraParts.push(state.finishName + (finishPerItem > 0 ? ' ×' + hoebae.toFixed(2) + '회배 = ' + finishPerItem.toLocaleString() + '원' : ''));
    if (state.hookCode) extraParts.push('고리: ' + state.hookName + ' (' + (state.hookExtra||0).toLocaleString() + '원)');
    if (state.accCode) extraParts.push('부자재: ' + state.accName + ' (' + (state.accExtra||0).toLocaleString() + '원)');
    document.getElementById('pFinish').innerHTML = extraParts.join('<br>');

    const dRow = document.getElementById('pDiscountRow');
    if (disc.pct > 0) {
        dRow.style.display = '';
        document.getElementById('pDiscBadge').textContent = disc.label;
        document.getElementById('pDiscount').textContent = '-' + discountAmt.toLocaleString() + '원';
    } else {
        dRow.style.display = 'none';
    }

    // 고리/부자재 헤더 요약 표시
    const hs = document.getElementById('hookSummary');
    if (hs) hs.textContent = state.hookCode ? state.hookName + ' (+' + (state.hookExtra||0).toLocaleString() + ')' : '선택 안 함';
    const as = document.getElementById('accSummary');
    if (as) as.textContent = state.accCode ? state.accName + ' (+' + (state.accExtra||0).toLocaleString() + ')' : '선택 안 함';

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
// 1) 원단 마감 변경
// ────────────────────────────────────────────────
window._cdOnFinishChange = function() {
    const checked = document.querySelector('input[name="finish"]:checked');
    if (!checked) return;
    const label = checked.closest('.fin-opt');
    state.finishCode = checked.value;
    state.finishName = label.dataset.name || label.querySelector('b').textContent;
    state.finishExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};
// 2) 고리 변경
window._cdOnHookChange = function() {
    const checked = document.querySelector('input[name="hook"]:checked');
    if (!checked) return;
    const label = checked.closest('.fin-opt');
    state.hookCode = checked.value || '';
    state.hookName = label.dataset.name || (state.hookCode ? label.querySelector('b').textContent : '');
    state.hookExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};
// 3) 부자재 변경
window._cdOnAccessoryChange = function() {
    const checked = document.querySelector('input[name="accessory"]:checked');
    if (!checked) return;
    const label = checked.closest('.fin-opt');
    state.accCode = checked.value || '';
    state.accName = label.dataset.name || (state.accCode ? label.querySelector('b').textContent : '');
    state.accExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};

// ────────────────────────────────────────────────
// 캔버스 렌더링
// ────────────────────────────────────────────────
window._cdRender = function() {
    if (!state.img) return;

    state.imgWcm = parseFloat(document.getElementById('imgWcm').value) || 10;
    state.imgHcm = parseFloat(document.getElementById('imgHcm').value) || 10;

    // 출력 사이즈 (cm)
    const fabricW = state.orderWcm || 130;
    const fabricH = state.orderHcm || 100;
    const maxW = 780, maxH = 620;
    const scaleByW = maxW / fabricW;
    const scaleByH = maxH / fabricH;
    const pxPerCm = Math.min(scaleByW, scaleByH);
    const cw = Math.max(120, Math.floor(fabricW * pxPerCm));
    const ch = Math.max(120, Math.floor(fabricH * pxPerCm));

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
                const sz = it.orderSize || ((it.orderWcm||(it.orderWmm/10)) + '×' + (it.orderHcm||(it.orderHmm/10)) + 'cm');
                const opts = [
                    it.fabricName,
                    '출력 ' + sz,
                    it.hoebae ? it.hoebae.toFixed(2) + '회배' : null,
                    it.qtyLabel,
                    (it.finishCode && it.finishCode !== 'raw' && it.finishCode !== 'none') ? '마감: ' + (it.finishName || '') : (it.finishCode === 'raw' ? '가재단' : null),
                    it.hookCode ? '고리: ' + (it.hookName||'') : null,
                    it.accCode ? '부자재: ' + (it.accName||'') : null
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
    if (!f) { showToast('원단을 선택해주세요'); return null; }
    const rawHoebae = calcHoebae();
    const hoebae = Math.max(1, rawHoebae);
    const itemPrice = Math.round(hoebae * HOEBAE_UNIT_PRICE);
    const finishPerItem = Math.round((state.finishExtra||0) * hoebae);
    const otherPerItem = (state.hookExtra||0) + (state.accExtra||0);
    const subtotal = (itemPrice + finishPerItem + otherPerItem) * state.orderQty;
    const disc = getVolumeDiscount(state.orderQty);
    const discountAmt = Math.round(subtotal * disc.pct / 100);
    const price = subtotal - discountAmt;

    const cleanFile = state.imgFileName
        ? state.imgFileName.replace(/\.[^.]+$/, '').replace(/^[a-f0-9-]{20,}$/i, '').slice(0, 20)
        : '';
    const title = (f.name || '내 패턴 원단') + (cleanFile ? ' — ' + cleanFile : '');
    return {
        id: 't' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
        title: title,
        thumbDataUrl: captureThumbDataUrl(),
        imgDataUrl: state.imgDataUrl,
        imgFileName: state.imgFileName,
        fabricCode: f.code,
        fabricName: f.name,
        fabricType: state.fabricType,
        fabricColor: f.isCotton ? state.fabricColor : null,
        orderWcm: state.orderWcm,
        orderHcm: state.orderHcm,
        orderSize: state.orderWcm + '×' + state.orderHcm + 'cm',
        width_mm: Math.round(state.orderWcm * 10),
        height_mm: Math.round(state.orderHcm * 10),
        hoebae: hoebae,
        rawHoebae: rawHoebae,
        unitPrice: itemPrice,
        imageSize: state.imgWcm + '×' + state.imgHcm + 'cm',
        layout: state.layout,
        qtyValue: state.orderQty,
        qtyLabel: state.orderQty + '개',
        finishCode: state.finishCode, finishName: state.finishName, finishUnit: state.finishExtra || 0, finishTotal: finishPerItem,
        hookCode: state.hookCode, hookName: state.hookName, hookExtra: state.hookExtra || 0,
        accCode: state.accCode, accName: state.accName, accExtra: state.accExtra || 0,
        subtotal: subtotal,
        discountPct: disc.pct,
        discountAmt: discountAmt,
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
        const parts = [it.fabricName, '출력 ' + (it.orderSize||''), it.qtyLabel, '마감: '+(it.finishName||'가재단')];
        if (it.hookCode) parts.push('고리: '+it.hookName);
        if (it.accCode) parts.push('부자재: '+it.accName);
        const opts = parts.filter(Boolean).join(' · ');
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

// 무통장 입금 안내 모달
window._cpCloseBankInfo = function() {
    const o = document.getElementById('bankInfoOverlay');
    if (o) o.style.display = 'none';
    document.body.style.overflow = '';
};
window._cpCopyAccount = function() {
    const acc = '64770104277763'; // 하이픈 없는 숫자만
    const btn = document.getElementById('biCopyBtn');
    const orig = btn.innerHTML;
    function done(ok) {
        btn.innerHTML = ok ? '<i class="fa-solid fa-check"></i> 복사됨' : '<i class="fa-solid fa-xmark"></i> 실패';
        btn.style.background = ok ? '#16a34a' : '#dc2626';
        btn.style.color = '#fff';
        setTimeout(function(){
            btn.innerHTML = orig;
            btn.style.background = '#451a03';
            btn.style.color = '#fde047';
        }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(acc).then(function(){ done(true); }).catch(function(){
            // fallback
            const ta = document.createElement('textarea');
            ta.value = acc; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(true); } catch(e){ done(false); }
            document.body.removeChild(ta);
        });
    } else {
        const ta = document.createElement('textarea');
        ta.value = acc; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(true); } catch(e){ done(false); }
        document.body.removeChild(ta);
    }
};

// 체크아웃 → orders 테이블 등록 + Toss/무통장 처리
// Toss Payments 클라이언트 키 (cafe2626 메인몰과 동일 — 운영용)
const TOSS_CLIENT_KEY = 'live_ck_KNbdOvk5rkkQE9aLdzlV3n07xlzm';

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

        // 1) 디자인 이미지 업로드 (각 카트 아이템)
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
        // orders.items: 통합주문관리에서 인식할 수 있는 형식으로
        const items = cart.map(function(it){
            return {
                product_code: it.fabricCode,
                product_name: it.title,
                fabric: it.fabricName,
                width_mm: it.width_mm || Math.round((it.orderWcm||130)*10),
                height_mm: it.height_mm || Math.round((it.orderHcm||100)*10),
                width_cm: it.orderWcm,
                height_cm: it.orderHcm,
                hoebae: it.hoebae,
                layout: it.layout,
                qty: it.qtyValue,
                addons: (function(){
                    const arr = [];
                    if (it.finishCode) arr.push({ type:'finish', code:it.finishCode, name:it.finishName, price:it.finishExtra||0 });
                    if (it.hookCode) arr.push({ type:'hook', code:it.hookCode, name:it.hookName, price:it.hookExtra||0 });
                    if (it.accCode) arr.push({ type:'accessory', code:it.accCode, name:it.accName, price:it.accExtra||0 });
                    return arr;
                })(),
                unit_price: it.unitPrice,
                price: it.price,
                source: 'cotton-print'
            };
        });

        const fullAddr = '[' + zip + '] ' + addr1 + ' ' + addr2;
        const adminNote = '[COTTON-PRINT] 출처: cotton-print.com\n결제방법: ' + (payMethod==='bank'?'무통장입금':'카드결제(Toss)') + '\n이메일: ' + (email||'없음');

        // 2) orders 테이블에 등록 → 통합주문관리에 즉시 표시
        const orderInsertPayload = {
            order_date: new Date().toISOString(),
            manager_name: name,         // 통합주문관리에서 "고객 정보" 컬럼에 표시됨
            phone: phone,
            address: fullAddr,
            request_note: memo || '',
            status: payMethod === 'bank' ? '접수됨' : '임시작성',
            payment_status: payMethod === 'bank' ? '입금대기' : '미결제',
            payment_method: payMethod === 'bank' ? '무통장입금' : '카드',
            total_amount: total,
            discount_amount: 0,
            items: items,
            site_code: 'KR',
            files: uploadedFiles.length ? uploadedFiles : null,
            admin_note: adminNote
        };
        const { data: orderData, error: orderErr } = await sb.from('orders').insert([orderInsertPayload]).select();
        if (orderErr) throw orderErr;
        const newOrderId = orderData[0].id;

        // 3) 결제 분기 — 언어별 PG 자동 분기
        if (payMethod === 'card') {
            saveCart([]);
            window._cpUpdateCartUI();
            var lang = window.__CD_LANG || 'ko';
            if (lang === 'ko') {
                // 한국: Toss (cafe2626.com 등록 도메인)
                location.href = 'https://www.cafe2626.com/cotton_checkout.html?order_id=' + newOrderId;
            } else {
                // 해외 (JP/EN): Stripe Checkout
                location.href = '/cotton_stripe_checkout.html?order_id=' + newOrderId + '&lang=' + lang;
            }
            return;
        }

        // 4) 무통장입금: 예쁜 모달로 안내
        saveCart([]);
        window._cpUpdateCartUI();
        window._cpCloseCheckout();
        window._cpCartClose();
        // 폼 초기화
        ['coName','coPhone','coEmail','coZip','coAddr1','coAddr2','coMemo'].forEach(function(id){ const e=document.getElementById(id); if(e) e.value=''; });
        // 입금 안내 모달 표시
        document.getElementById('biOrderId').textContent = '#' + newOrderId;
        document.getElementById('biAmount').textContent = total.toLocaleString() + '원';
        document.getElementById('bankInfoOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
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
// DB에서 원단/마감 옵션 로드 후 첫 그룹 자동 선택
loadDbFabrics().then(() => {
    updateSizeLabels();
    updatePrice();
    if (window._cdCalcHoebae) window._cdCalcHoebae();
});
autoLoadPatternFromUrl();
if (window._cpUpdateCartUI) window._cpUpdateCartUI();

})();
