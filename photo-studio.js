// photo-studio.js — 사진 한 장으로 작품 만들기 미니 에디터
(function(){'use strict';

// ── 커시브 폰트 로드 ──
const _fl = document.createElement('link');
_fl.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap';
_fl.rel = 'stylesheet'; document.head.appendChild(_fl);

// ── 언어 감지 ──
const _cc = ((window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || new URLSearchParams(location.search).get('lang') || 'kr').toUpperCase();
const _L = (_cc==='JP'||_cc==='JA') ? 'ja' : (_cc==='KR'||_cc==='KO') ? 'kr' : 'en';

const T = {
    kr: { trigger:'사진으로 작품 만들기', title:'Photo Studio', desc:'사진 한 장으로 멋진 작품을 만들 수 있어요.\n자동으로 보정하고 디자인합니다.', upload:'사진 올리기', drag:'또는 여기에 드래그', processing:'보정 중...', done:'작품이 완성되었습니다!', orderTitle:'이 작품으로 주문하기', fabric:'패브릭 인쇄', paper:'종이 인쇄물', honeycomb:'허니콤보드', canvas:'캔버스 액자', blind:'롤블라인드', sell:'내 작품 판매하기', size:'사이즈', price:'예상 금액', order:'주문하기', retry:'다른 사진으로', custom:'직접 입력', w:'가로(mm)', h:'세로(mm)', sellMsg:'곧 카멜레온 마켓플레이스가 오픈합니다!\n내 작품을 상품으로 판매해보세요.', sellSub:'사전 등록하시면 오픈 시 알려드립니다.', sellBtn:'사전 등록', sellDone:'등록되었습니다! 오픈 시 알려드릴게요.', fromPrice:'~부터' },
    ja: { trigger:'写真で作品作り', title:'Photo Studio', desc:'写真1枚で素敵な作品が作れます。\n自動で補正してデザインします。', upload:'写真をアップ', drag:'またはここにドラッグ', processing:'補正中...', done:'作品が完成しました！', orderTitle:'この作品で注文する', fabric:'ファブリック', paper:'紙印刷', honeycomb:'ハニカムボード', canvas:'キャンバス額', blind:'ロールブラインド', sell:'作品を販売する', size:'サイズ', price:'予想金額', order:'注文する', retry:'別の写真で', custom:'カスタム', w:'横(mm)', h:'縦(mm)', sellMsg:'カメレオンマーケットプレイスが間もなくオープン！\nあなたの作品を商品として販売しましょう。', sellSub:'事前登録で、オープン時にお知らせします。', sellBtn:'事前登録', sellDone:'登録しました！', fromPrice:'〜から' },
    en: { trigger:'Create from Photo', title:'Photo Studio', desc:'Turn a single photo into stunning artwork.\nAuto-enhanced and beautifully designed.', upload:'Upload Photo', drag:'or drag & drop here', processing:'Enhancing...', done:'Your artwork is ready!', orderTitle:'Order this artwork', fabric:'Fabric Print', paper:'Paper Print', honeycomb:'Honeycomb Board', canvas:'Canvas Frame', blind:'Roller Blind', sell:'Sell My Artwork', size:'Size', price:'Estimated Price', order:'Order Now', retry:'Try another photo', custom:'Custom', w:'Width(mm)', h:'Height(mm)', sellMsg:'Chameleon Marketplace is coming soon!\nSell your artwork as products.', sellSub:'Pre-register to get notified at launch.', sellBtn:'Pre-register', sellDone:'Registered! We\'ll notify you.', fromPrice:'from' },
};
const t = (k) => (T[_L] && T[_L][k]) || T.en[k] || k;

// ── 통화 ──
const _cur = (_cc==='JP'||_cc==='JA') ? {r:0.1,s:'¥',pre:true} : (_cc==='US'||_cc==='EN') ? {r:0.001,s:'$',pre:true} : (_cc==='CN'||_cc==='ZH') ? {r:0.005,s:'¥',pre:true} : (_cc==='ES'||_cc==='DE'||_cc==='FR') ? {r:0.00065,s:'€',pre:true} : (_cc==='AR') ? {r:0.003,s:' ﷼',pre:false} : (_cc==='KR'||_cc==='KO') ? {r:1,s:'원',pre:false} : {r:0.001,s:'$',pre:true};
function fmtPrice(krw) {
    const v = Math.round(krw * _cur.r);
    return _cur.pre ? _cur.s + v.toLocaleString() : v.toLocaleString() + _cur.s;
}

// ── 상품 DB ──
const PRODUCTS = {
    fabric:    { icon:'🧵', sqm:50000,  min:25000 },
    paper:     { icon:'📄', sqm:15000,  min:5000 },
    honeycomb: { icon:'🍯', sqm:80000,  min:40000 },
    canvas:    { icon:'🖼️', sqm:120000, min:50000 },
    blind:     { icon:'🪟', sqm:90000,  min:40000 },
};

// ── 상태 ──
let _panel=null, _state='welcome', _imgRatio=1, _imgDataUrl=null, _selectedProduct=null;

// ── CSS ──
const _css = document.createElement('style');
_css.textContent = `
#ps-trigger{position:fixed;bottom:90px;right:24px;z-index:99990;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:none;padding:10px 18px;border-radius:50px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,0.4);transition:all .3s;display:flex;align-items:center;gap:8px;font-family:inherit;}
#ps-trigger:hover{transform:translateY(-2px);box-shadow:0 6px 25px rgba(124,58,237,0.5);}
#ps-trigger .ps-icon{font-size:18px;}
#ps-panel{position:fixed;bottom:90px;right:24px;z-index:99991;width:380px;max-height:75vh;background:#fff;border-radius:20px;box-shadow:0 10px 50px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;animation:psSlideUp .35s ease;}
#ps-panel.visible{display:flex;}
@keyframes psSlideUp{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
.ps-header{background:linear-gradient(135deg,#7c3aed,#ec4899);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;color:#fff;}
.ps-header h3{margin:0;font-size:16px;font-weight:700;letter-spacing:.5px;}
.ps-close{background:rgba(255,255,255,.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .2s;}
.ps-close:hover{background:rgba(255,255,255,.3);}
.ps-body{padding:20px;overflow-y:auto;flex:1;}
.ps-welcome{text-align:center;padding:10px 0;}
.ps-welcome .ps-emoji{font-size:48px;margin-bottom:12px;}
.ps-welcome p{color:#64748b;font-size:14px;line-height:1.6;white-space:pre-line;margin:0 0 20px;}
.ps-upload-area{border:2px dashed #c4b5fd;border-radius:16px;padding:30px 20px;text-align:center;cursor:pointer;transition:all .3s;background:#faf5ff;}
.ps-upload-area:hover{border-color:#7c3aed;background:#f3e8ff;}
.ps-upload-area .ps-up-icon{font-size:32px;color:#7c3aed;margin-bottom:8px;}
.ps-upload-area .ps-up-text{font-size:15px;font-weight:600;color:#7c3aed;}
.ps-upload-area .ps-up-sub{font-size:12px;color:#a78bfa;margin-top:4px;}
.ps-processing{text-align:center;padding:40px 20px;}
.ps-processing .ps-spinner{width:48px;height:48px;border:4px solid #e9d5ff;border-top:4px solid #7c3aed;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px;}
.ps-processing p{color:#7c3aed;font-weight:600;}
.ps-result{}
.ps-preview{position:relative;border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);}
.ps-preview img{width:100%;display:block;}
.ps-preview .ps-badge{position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.5);color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;backdrop-filter:blur(4px);}
.ps-section-title{font-size:14px;font-weight:700;color:#1e1b4b;margin:16px 0 10px;display:flex;align-items:center;gap:6px;}
.ps-products{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
.ps-prod-btn{border:2px solid #e2e8f0;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .2s;background:#fff;font-size:12px;font-weight:600;color:#334155;}
.ps-prod-btn:hover{border-color:#7c3aed;background:#faf5ff;color:#7c3aed;}
.ps-prod-btn.active{border-color:#7c3aed;background:#7c3aed;color:#fff;}
.ps-prod-btn .ps-prod-icon{font-size:22px;display:block;margin-bottom:4px;}
.ps-prod-btn .ps-prod-price{font-size:10px;font-weight:400;opacity:.7;margin-top:2px;display:block;}
.ps-sell-btn{border:2px solid #f59e0b;background:#fffbeb;color:#92400e;}
.ps-sell-btn:hover{border-color:#f59e0b;background:#fef3c7;color:#92400e;}
.ps-sell-btn.active{background:#f59e0b;color:#fff;border-color:#f59e0b;}
.ps-sizing{background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:12px;animation:psSlideUp .25s ease;}
.ps-sizes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
.ps-size-btn{padding:6px 12px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;color:#475569;}
.ps-size-btn:hover{border-color:#7c3aed;color:#7c3aed;}
.ps-size-btn.active{background:#7c3aed;color:#fff;border-color:#7c3aed;}
.ps-custom-row{display:flex;gap:8px;align-items:center;margin-bottom:10px;}
.ps-custom-row input{width:80px;padding:6px 8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;text-align:center;}
.ps-custom-row input:focus{border-color:#7c3aed;outline:none;}
.ps-custom-row span{color:#94a3b8;font-weight:600;}
.ps-price-row{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#7c3aed,#ec4899);border-radius:12px;color:#fff;margin-bottom:8px;}
.ps-price-label{font-size:13px;font-weight:600;}
.ps-price-value{font-size:20px;font-weight:800;}
.ps-order-btn{width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
.ps-order-btn:hover{opacity:.9;transform:translateY(-1px);}
.ps-retry{display:block;text-align:center;color:#94a3b8;font-size:13px;margin-top:12px;cursor:pointer;text-decoration:none;}
.ps-retry:hover{color:#7c3aed;}
.ps-sell-panel{text-align:center;padding:10px 0;animation:psSlideUp .25s ease;}
.ps-sell-panel p{font-size:14px;color:#64748b;white-space:pre-line;line-height:1.5;}
.ps-sell-panel .ps-sell-sub{font-size:12px;color:#94a3b8;margin:8px 0 12px;}
.ps-sell-register{width:100%;padding:12px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;}
@media(max-width:480px){
    #ps-panel{bottom:0;right:0;left:0;width:auto;max-height:85vh;border-radius:20px 20px 0 0;}
    #ps-trigger{bottom:80px;right:16px;padding:8px 14px;font-size:13px;}
}
`;
document.head.appendChild(_css);

// ── 위젯 생성 ──
function create() {
    // 트리거 버튼
    const trigger = document.createElement('button');
    trigger.id = 'ps-trigger';
    trigger.innerHTML = `<span class="ps-icon">📸</span><span>${t('trigger')}</span>`;
    trigger.onclick = () => toggle();
    document.body.appendChild(trigger);

    // 패널
    const panel = document.createElement('div');
    panel.id = 'ps-panel';
    panel.innerHTML = `
        <div class="ps-header">
            <h3>✨ ${t('title')}</h3>
            <button class="ps-close" onclick="document.getElementById('ps-panel').classList.remove('visible');document.getElementById('ps-trigger').style.display='flex';">✕</button>
        </div>
        <div class="ps-body" id="psBody"></div>
    `;
    document.body.appendChild(panel);
    _panel = panel;
    showWelcome();
}

function toggle() {
    const p = document.getElementById('ps-panel');
    const tr = document.getElementById('ps-trigger');
    if (p.classList.contains('visible')) {
        p.classList.remove('visible'); tr.style.display = 'flex';
    } else {
        p.classList.add('visible'); tr.style.display = 'none';
    }
}

// ── 상태별 렌더링 ──
function showWelcome() {
    const body = document.getElementById('psBody');
    body.innerHTML = `
        <div class="ps-welcome">
            <div class="ps-emoji">📸</div>
            <p>${t('desc')}</p>
            <div class="ps-upload-area" id="psUploadArea">
                <div class="ps-up-icon">☁️</div>
                <div class="ps-up-text">${t('upload')}</div>
                <div class="ps-up-sub">${t('drag')}</div>
            </div>
            <input type="file" id="psFileInput" accept="image/*" style="display:none">
        </div>
    `;
    const area = document.getElementById('psUploadArea');
    const inp = document.getElementById('psFileInput');
    area.onclick = () => inp.click();
    area.ondragover = (e) => { e.preventDefault(); area.style.borderColor = '#7c3aed'; };
    area.ondragleave = () => { area.style.borderColor = '#c4b5fd'; };
    area.ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) processImage(e.dataTransfer.files[0]); };
    inp.onchange = (e) => { if (e.target.files[0]) processImage(e.target.files[0]); };
}

function showProcessing() {
    document.getElementById('psBody').innerHTML = `
        <div class="ps-processing">
            <div class="ps-spinner"></div>
            <p>${t('processing')}</p>
        </div>
    `;
}

// ── 이미지 처리 ──
async function processImage(file) {
    showProcessing();
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
        URL.revokeObjectURL(url);
        // 리사이즈 (최대 2000px)
        let w = img.width, h = img.height;
        const maxDim = 2000;
        if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
        }
        _imgRatio = w / h;

        const cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d');

        // 밝기/대비 보정
        ctx.filter = 'brightness(1.12) contrast(1.08) saturate(1.05)';
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';

        // 하단 그라데이션 오버레이
        const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // 폰트 로드 대기
        try {
            await document.fonts.load('48px "Dancing Script"');
        } catch(e) {}
        await new Promise(r => setTimeout(r, 300));

        // 텍스트 오버레이
        const fontSize = Math.round(w * 0.065);
        ctx.font = `${fontSize}px "Dancing Script", cursive`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.fillText('Love of my life', w / 2, h * 0.88);
        ctx.shadowColor = 'transparent';

        _imgDataUrl = cvs.toDataURL('image/jpeg', 0.92);
        showResult();
    };
    img.onerror = () => { showWelcome(); };
    img.src = url;
}

// ── 결과 표시 ──
function showResult() {
    const body = document.getElementById('psBody');
    body.innerHTML = `
        <div class="ps-result">
            <div class="ps-preview">
                <img src="${_imgDataUrl}" alt="artwork">
                <div class="ps-badge">✨ ${t('done')}</div>
            </div>
            <div class="ps-section-title">🛒 ${t('orderTitle')}</div>
            <div class="ps-products">
                <div class="ps-prod-btn" data-key="fabric"><span class="ps-prod-icon">🧵</span>${t('fabric')}<span class="ps-prod-price">${fmtPrice(PRODUCTS.fabric.min)} ${t('fromPrice')}</span></div>
                <div class="ps-prod-btn" data-key="paper"><span class="ps-prod-icon">📄</span>${t('paper')}<span class="ps-prod-price">${fmtPrice(PRODUCTS.paper.min)} ${t('fromPrice')}</span></div>
                <div class="ps-prod-btn" data-key="honeycomb"><span class="ps-prod-icon">🍯</span>${t('honeycomb')}<span class="ps-prod-price">${fmtPrice(PRODUCTS.honeycomb.min)} ${t('fromPrice')}</span></div>
                <div class="ps-prod-btn" data-key="canvas"><span class="ps-prod-icon">🖼️</span>${t('canvas')}<span class="ps-prod-price">${fmtPrice(PRODUCTS.canvas.min)} ${t('fromPrice')}</span></div>
                <div class="ps-prod-btn" data-key="blind"><span class="ps-prod-icon">🪟</span>${t('blind')}<span class="ps-prod-price">${fmtPrice(PRODUCTS.blind.min)} ${t('fromPrice')}</span></div>
                <div class="ps-prod-btn ps-sell-btn" data-key="sell"><span class="ps-prod-icon">💰</span>${t('sell')}</div>
            </div>
            <div id="psSizing"></div>
            <a class="ps-retry" onclick="showWelcome()">🔄 ${t('retry')}</a>
        </div>
    `;
    // 상품 버튼 이벤트
    body.querySelectorAll('.ps-prod-btn').forEach(btn => {
        btn.onclick = () => {
            body.querySelectorAll('.ps-prod-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const key = btn.dataset.key;
            if (key === 'sell') showSellPanel();
            else showSizing(key);
        };
    });
}
// showWelcome을 전역으로
window.showWelcome = showWelcome;

// ── 사이즈 & 가격 ──
function showSizing(key) {
    _selectedProduct = key;
    const prod = PRODUCTS[key];
    // 비율 기반 사이즈 프리셋 (짧은 쪽 기준)
    const shorts = [300, 500, 700, 900, 1200];
    const sizes = shorts.map(s => {
        let w, h;
        if (_imgRatio >= 1) { h = s; w = Math.round(s * _imgRatio); }
        else { w = s; h = Math.round(s / _imgRatio); }
        return { label: `${w}×${h}`, w, h };
    });

    const sizeBtns = sizes.map((s, i) => `<button class="ps-size-btn" data-w="${s.w}" data-h="${s.h}">${s.label}</button>`).join('');

    document.getElementById('psSizing').innerHTML = `
        <div class="ps-sizing">
            <div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:8px;">📐 ${t('size')} (mm)</div>
            <div class="ps-sizes">${sizeBtns}<button class="ps-size-btn" data-custom="1">${t('custom')}</button></div>
            <div id="psCustomRow" style="display:none;" class="ps-custom-row">
                <input type="number" id="psW" placeholder="${t('w')}" min="100" max="5000">
                <span>×</span>
                <input type="number" id="psH" placeholder="${t('h')}" min="100" max="5000">
                <button class="ps-size-btn" onclick="calcCustomPrice()" style="padding:6px 14px;">OK</button>
            </div>
            <div id="psPriceArea"></div>
        </div>
    `;
    // 사이즈 버튼 이벤트
    document.getElementById('psSizing').querySelectorAll('.ps-size-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#psSizing .ps-size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.custom) {
                document.getElementById('psCustomRow').style.display = 'flex';
            } else {
                document.getElementById('psCustomRow').style.display = 'none';
                calcPrice(parseInt(btn.dataset.w), parseInt(btn.dataset.h));
            }
        };
    });
}

function calcPrice(w, h) {
    const prod = PRODUCTS[_selectedProduct];
    const area = (w / 1000) * (h / 1000);
    let price = Math.round((area * prod.sqm) / 100) * 100;
    if (price < prod.min) price = prod.min;

    document.getElementById('psPriceArea').innerHTML = `
        <div class="ps-price-row">
            <span class="ps-price-label">${t('price')} (${w}×${h}mm)</span>
            <span class="ps-price-value">${fmtPrice(price)}</span>
        </div>
        <button class="ps-order-btn" onclick="psOrder(${w},${h},'${_selectedProduct}')">🛒 ${t('order')}</button>
    `;
}

window.calcCustomPrice = function() {
    const w = parseInt(document.getElementById('psW').value);
    const h = parseInt(document.getElementById('psH').value);
    if (w >= 100 && h >= 100) calcPrice(w, h);
};

// ── 주문하기 ──
window.psOrder = function(w, h, productKey) {
    // 이미지를 세션에 저장
    try { sessionStorage.setItem('ps_artwork', _imgDataUrl); } catch(e) {}
    window._photoStudioImage = _imgDataUrl;
    window._photoStudioSize = { w, h, product: productKey };

    // 카프 어드바이저에 주문 요청 전달
    const names = { fabric: t('fabric'), paper: t('paper'), honeycomb: t('honeycomb'), canvas: t('canvas'), blind: t('blind') };
    const msg = `${names[productKey]} ${w}×${h}mm`;

    // 패널 닫기
    document.getElementById('ps-panel').classList.remove('visible');
    document.getElementById('ps-trigger').style.display = 'flex';

    // 카프 열기 & 메시지 전달
    if (window.openAdvisorPanel) {
        window.openAdvisorPanel();
        setTimeout(() => {
            const input = document.querySelector('.adv-input');
            if (input) {
                input.value = msg + ' 주문하고 싶습니다. 사진 작업을 했습니다.';
                const sendBtn = document.querySelector('.adv-send');
                if (sendBtn) sendBtn.click();
            }
        }, 500);
    } else {
        // 폴백: 상품 페이지로 이동
        const prodMap = { fabric:'ch20001', paper:'ch10001', honeycomb:'ch30001', canvas:'ch40001', blind:'ch50001' };
        location.href = `/?product=${prodMap[productKey] || 'ch20001'}`;
    }
};

// ── 작품 판매 패널 ──
function showSellPanel() {
    document.getElementById('psSizing').innerHTML = `
        <div class="ps-sell-panel">
            <p>${t('sellMsg')}</p>
            <div class="ps-sell-sub">${t('sellSub')}</div>
            <button class="ps-sell-register" onclick="psRegisterSell(this)">${t('sellBtn')}</button>
        </div>
    `;
}

window.psRegisterSell = function(btn) {
    btn.textContent = '✅ ' + t('sellDone');
    btn.style.background = '#10b981';
    btn.disabled = true;
    // TODO: 실제 등록 로직 연동
};

// ── 초기화 ──
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', create);
} else {
    create();
}

})();
