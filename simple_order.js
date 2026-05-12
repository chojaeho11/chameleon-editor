/* simple_order.js — 간편 주문 모달
 *
 * 사용:
 *   <script src="simple_order.js?v=1"></script>
 *   window.openSimpleOrderModal(productCode)   ← 어디서든 호출 가능
 *
 * 특징:
 *   - 자체 모달 HTML + CSS 주입 (외부 의존 없음)
 *   - 파일 업로드 (PDF / PNG / JPG, 최대 10MB) — 패브릭 디자이너와 동일 정책
 *   - 수량 선택 + 자동 할인 가격 계산 (수량 할인 테이블)
 *   - 장바구니 / 바로 주문 두 버튼
 *   - 기존 cart 시스템과 통합 (localStorage chameleon_cart_current + window.renderCart)
 *
 * 할인 테이블 (수량 기준):
 *   1-2개     : 0%
 *   3-9개     : 20%
 *   10-100개  : 30%
 *   101-500개 : 40%
 *   501+개    : 50%
 */
(function() {
    'use strict';

    if (window.__SO_LOADED) return;
    window.__SO_LOADED = true;

    // ─────────────────────────────────────────────
    // 상수 & 상태
    // ─────────────────────────────────────────────
    const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
    const MAX_FILE_BYTES = 10 * 1024 * 1024;
    const CART_KEY = 'chameleon_cart_current';

    const DISCOUNT_TIERS = [
        { min: 1,   max: 2,        pct: 0  },
        { min: 3,   max: 9,        pct: 20 },
        { min: 10,  max: 100,      pct: 30 },
        { min: 101, max: 500,      pct: 40 },
        { min: 501, max: Infinity, pct: 50 },
    ];

    let state = {
        product: null,
        file: null,
        thumbDataUrl: null,
        qty: 1,
    };

    let _sb = null;
    function getSb() {
        if (_sb) return _sb;
        if (!window.supabase) return null;
        _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return _sb;
    }

    function getLang() {
        const u = new URLSearchParams(location.search);
        return u.get('lang') ||
               (location.hostname.includes('cafe0101.com') ? 'ja' :
                location.hostname.includes('cafe3355.com') || location.hostname.includes('chameleon.design') ? 'en' :
                window.CURRENT_LANG || 'kr');
    }

    function fmtPrice(amt) {
        const lang = getLang();
        const v = Math.max(0, Math.round(amt || 0));
        if (lang === 'ja') return '¥' + Math.round(v * 0.1).toLocaleString();
        if (lang === 'en') {
            const usd = v * 0.001;
            return usd >= 10 ? '$' + Math.round(usd).toLocaleString() : '$' + usd.toFixed(2);
        }
        return v.toLocaleString() + '원';
    }

    function getDiscountTier(qty) {
        for (const t of DISCOUNT_TIERS) {
            if (qty >= t.min && qty <= t.max) return t;
        }
        return DISCOUNT_TIERS[0];
    }

    function tr(ko, ja, en) {
        const lang = getLang();
        if (lang === 'ja') return ja || ko;
        if (lang === 'en') return en || ko;
        return ko;
    }

    // ─────────────────────────────────────────────
    // 다국어 상품 정보 헬퍼
    // ─────────────────────────────────────────────
    function pickName(p) {
        const lang = getLang();
        if (lang === 'ja' && p.name_jp) return p.name_jp;
        if (lang === 'en' && p.name_us) return p.name_us;
        return p.name_kr || p.name || '';
    }
    function pickDesc(p) {
        const lang = getLang();
        if (lang === 'ja' && p.description_jp) return p.description_jp;
        if (lang === 'en' && p.description_us) return p.description_us;
        return p.description_kr || p.description || '';
    }
    function pickPrice(p) {
        const lang = getLang();
        if (lang === 'ja' && p.price_jp) return p.price_jp * 10;  // JPY→KRW 환산 안 함, 원 단위로 fmtPrice가 처리
        return p.price || 0;
    }
    function pickImg(p) {
        return p.image_url || p.image_kr || p.image || p.thumb_url || '';
    }

    // ─────────────────────────────────────────────
    // 모달 HTML + CSS 주입
    // ─────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('so-styles')) return;
        const css = `
.so-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 50000;
    display: none; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(3px);
}
.so-overlay.open { display: flex; }
.so-modal {
    background: #fff; border-radius: 18px; width: 520px; max-width: 100%;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 24px 60px rgba(0,0,0,0.4);
    font-family: 'Pretendard', -apple-system, system-ui, sans-serif;
}
.so-head {
    padding: 18px 22px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #f1f1f1;
}
.so-head h2 { margin: 0; font-size: 18px; font-weight: 800; color: #1a1a1a; }
.so-close {
    width: 32px; height: 32px; border: none; background: #f5f5f5; border-radius: 50%;
    cursor: pointer; font-size: 20px; color: #555;
}
.so-close:hover { background: #e5e5e5; }
.so-body { padding: 18px 22px; }
.so-prod-row { display: flex; gap: 14px; margin-bottom: 16px; }
.so-prod-img {
    width: 92px; height: 92px; border-radius: 10px; background: #f5f5f5;
    object-fit: cover; flex-shrink: 0;
}
.so-prod-meta { flex: 1; min-width: 0; }
.so-prod-name { font-size: 15px; font-weight: 800; color: #1a1a1a; margin: 4px 0; line-height: 1.3; }
.so-prod-desc { font-size: 12px; color: #666; line-height: 1.5; }
.so-section-label { font-size: 12px; font-weight: 800; color: #444; margin: 14px 0 6px; }
.so-upload {
    border: 2px dashed #d6d3d1; border-radius: 12px; padding: 24px 16px;
    text-align: center; cursor: pointer; background: #fafaf9;
    transition: all 0.2s;
}
.so-upload:hover, .so-upload.dragover { border-color: #b45309; background: #fef7e6; }
.so-upload-icon { font-size: 32px; color: #b45309; }
.so-upload-title { font-size: 13px; font-weight: 700; color: #451a03; margin-top: 6px; }
.so-upload-hint { font-size: 11px; color: #888; margin-top: 4px; }
.so-upload-done {
    border: 1px solid #16a34a; background: #f0fdf4;
}
.so-upload-done .so-upload-icon { color: #16a34a; }
.so-qty-row {
    display: flex; align-items: center; gap: 12px;
    background: #fafaf9; border-radius: 10px; padding: 12px; margin-top: 6px;
}
.so-qty-btn {
    width: 38px; height: 38px; border-radius: 10px; border: 1px solid #d6d3d1;
    background: #fff; cursor: pointer; font-size: 18px; font-weight: 900; color: #451a03;
}
.so-qty-btn:hover { background: #f5f5f5; }
.so-qty-input {
    flex: 1; height: 38px; border: 1px solid #d6d3d1; border-radius: 10px;
    text-align: center; font-size: 15px; font-weight: 700; padding: 0 8px;
    font-family: inherit;
}
.so-qty-unit { font-size: 12px; color: #888; }
.so-price-box {
    background: linear-gradient(135deg, #fef7e6, #fafaf9);
    border: 1px solid #fde68a; border-radius: 12px;
    padding: 14px 16px; margin-top: 16px;
}
.so-price-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #555; margin: 4px 0; }
.so-price-row.discount span:last-child { color: #dc2626; font-weight: 700; }
.so-price-row.total { font-size: 17px; font-weight: 900; color: #451a03; padding-top: 8px; border-top: 1px dashed #d6d3d1; margin-top: 8px; }
.so-discount-tier-tag {
    display: inline-block; font-size: 10px; font-weight: 800;
    background: #fde68a; color: #92400e; padding: 2px 7px; border-radius: 50px;
    margin-left: 6px;
}
.so-discount-table {
    background: #f8fafc; border-radius: 8px; padding: 8px 10px;
    margin-top: 10px; font-size: 10.5px; color: #475569; line-height: 1.6;
    display: flex; flex-wrap: wrap; gap: 4px 12px;
}
.so-discount-table b { color: #1e293b; font-weight: 700; }
.so-actions { display: flex; gap: 8px; margin-top: 18px; }
.so-btn {
    flex: 1; padding: 14px; border: none; border-radius: 12px; cursor: pointer;
    font-size: 14px; font-weight: 800; font-family: inherit; transition: all 0.2s;
}
.so-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.so-btn-cart {
    background: #fff; border: 1.5px solid #451a03; color: #451a03;
}
.so-btn-cart:hover:not(:disabled) { background: #fef7e6; }
.so-btn-buy {
    background: linear-gradient(135deg, #451a03, #78350f); color: #fde047;
}
.so-btn-buy:hover:not(:disabled) { filter: brightness(1.1); }
.so-loading { position: relative; pointer-events: none; opacity: 0.6; }
.so-status {
    margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 8px;
    font-size: 12px; color: #166534; display: none;
}
.so-status.err { background: #fef2f2; color: #991b1b; }
@media (max-width: 600px) {
    .so-modal { width: 100%; border-radius: 12px 12px 0 0; max-height: 100vh; }
    .so-prod-img { width: 72px; height: 72px; }
}
        `;
        const st = document.createElement('style');
        st.id = 'so-styles';
        st.textContent = css;
        document.head.appendChild(st);
    }

    function injectModal() {
        if (document.getElementById('simpleOrderModal')) return;
        const html = `
<div id="simpleOrderModal" class="so-overlay" onclick="if(event.target===this)window.closeSimpleOrderModal()">
  <div class="so-modal">
    <div class="so-head">
      <h2 id="soTitle">${tr('상품 주문', '商品注文', 'Order Product')}</h2>
      <button class="so-close" onclick="window.closeSimpleOrderModal()">×</button>
    </div>
    <div class="so-body">
      <div class="so-prod-row">
        <img id="soImg" class="so-prod-img" src="" alt="" />
        <div class="so-prod-meta">
          <div id="soName" class="so-prod-name">-</div>
          <div id="soDesc" class="so-prod-desc"></div>
        </div>
      </div>

      <div class="so-section-label">${tr('📤 디자인 파일', '📤 デザインファイル', '📤 Design file')}</div>
      <div id="soUpload" class="so-upload" onclick="document.getElementById('soFile').click()">
        <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />
        <div class="so-upload-icon">📁</div>
        <div class="so-upload-title">${tr('파일을 선택하거나 끌어다 놓으세요', 'ファイルを選択またはドロップ', 'Click or drop a file')}</div>
        <div class="so-upload-hint">${tr('PDF · PNG · JPG · 최대 10MB', 'PDF · PNG · JPG · 最大10MB', 'PDF · PNG · JPG · max 10MB')}</div>
      </div>

      <div class="so-section-label">${tr('수량', '数量', 'Quantity')}</div>
      <div class="so-qty-row">
        <button class="so-qty-btn" onclick="window._soQtyChg(-1)">−</button>
        <input type="number" id="soQty" class="so-qty-input" value="1" min="1" max="9999" oninput="window._soOnQtyInput()" />
        <button class="so-qty-btn" onclick="window._soQtyChg(1)">+</button>
        <span class="so-qty-unit">${tr('개', '個', 'pcs')}</span>
      </div>

      <div class="so-price-box">
        <div class="so-price-row"><span>${tr('단가', '単価', 'Unit price')}</span><span id="soUnit">-</span></div>
        <div class="so-price-row discount"><span>${tr('수량 할인', '数量割引', 'Volume discount')} <span class="so-discount-tier-tag" id="soTier">-</span></span><span id="soDisc">-0원</span></div>
        <div class="so-price-row total"><span>${tr('합계', '合計', 'Total')}</span><span id="soTotal">-</span></div>
      </div>

      <div class="so-discount-table">
        <div><b>1-2</b>${tr('개', '個', 'pcs')} 0%</div>
        <div><b>3-9</b>${tr('개', '個', 'pcs')} 20%</div>
        <div><b>10-100</b>${tr('개', '個', 'pcs')} 30%</div>
        <div><b>101-500</b>${tr('개', '個', 'pcs')} 40%</div>
        <div><b>501+</b>${tr('개', '個', 'pcs')} 50%</div>
      </div>

      <div class="so-actions">
        <button class="so-btn so-btn-cart" id="soBtnCart" onclick="window._soAddCart()" disabled>
          🛒 ${tr('장바구니', 'カート追加', 'Add to cart')}
        </button>
        <button class="so-btn so-btn-buy" id="soBtnBuy" onclick="window._soBuyNow()" disabled>
          ⚡ ${tr('바로 주문', '今すぐ注文', 'Order now')}
        </button>
      </div>

      <div id="soStatus" class="so-status"></div>
    </div>
  </div>
</div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        wireUploadEvents();
    }

    // ─────────────────────────────────────────────
    // 파일 업로드 이벤트
    // ─────────────────────────────────────────────
    function wireUploadEvents() {
        const fileInput = document.getElementById('soFile');
        const dropZone = document.getElementById('soUpload');
        if (!fileInput || !dropZone) return;
        fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            handleFile(e.dataTransfer.files[0]);
        });
    }

    function handleFile(file) {
        if (!file) return;
        const name = (file.name || '').toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
        const isPng = name.endsWith('.png') || file.type === 'image/png';
        const isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg') || file.type === 'image/jpeg';
        if (!(isPdf || isPng || isJpg)) {
            showStatus(tr('PDF · PNG · JPG 파일만 가능합니다.', 'PDF・PNG・JPGのみ可能です。', 'Only PDF / PNG / JPG allowed.'), 'err');
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            showStatus(tr('10MB를 초과합니다.', '10MBを超えます。', 'Exceeds 10MB.'), 'err');
            return;
        }
        state.file = file;
        const reader = new FileReader();
        reader.onload = e => { state.thumbDataUrl = e.target.result; };
        reader.readAsDataURL(file);

        const zone = document.getElementById('soUpload');
        zone.classList.add('so-upload-done');
        zone.innerHTML = `
            <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf" style="display:none" />
            <div class="so-upload-icon">✅</div>
            <div class="so-upload-title">${escapeHtml(file.name)}</div>
            <div class="so-upload-hint">${(file.size / 1024 / 1024).toFixed(1)} MB — ${tr('클릭해서 다른 파일 선택', 'クリックで別ファイル選択', 'Click to change file')}</div>
        `;
        zone.onclick = () => document.getElementById('soFile').click();
        // 이벤트 다시 와이어 (innerHTML로 교체됐으니까)
        const fi = document.getElementById('soFile');
        if (fi) fi.addEventListener('change', e => handleFile(e.target.files[0]));
        updateButtons();
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function showStatus(msg, kind) {
        const el = document.getElementById('soStatus');
        if (!el) return;
        el.style.display = 'block';
        el.textContent = msg;
        el.classList.toggle('err', kind === 'err');
    }

    function updateButtons() {
        const ready = !!(state.product && state.file && state.qty > 0);
        const cart = document.getElementById('soBtnCart');
        const buy = document.getElementById('soBtnBuy');
        if (cart) cart.disabled = !ready;
        if (buy) buy.disabled = !ready;
    }

    // ─────────────────────────────────────────────
    // 가격 계산
    // ─────────────────────────────────────────────
    function recalc() {
        if (!state.product) return;
        const unit = pickPrice(state.product);
        const subtotal = unit * state.qty;
        const tier = getDiscountTier(state.qty);
        const discount = Math.round(subtotal * tier.pct / 100);
        const final = subtotal - discount;

        document.getElementById('soUnit').textContent = fmtPrice(unit);
        document.getElementById('soDisc').textContent = '-' + fmtPrice(discount);
        document.getElementById('soTotal').textContent = fmtPrice(final);
        const tierEl = document.getElementById('soTier');
        if (tierEl) tierEl.textContent = tier.pct + '%';
    }

    window._soQtyChg = function(delta) {
        const input = document.getElementById('soQty');
        const cur = parseInt(input.value) || 1;
        const next = Math.max(1, Math.min(9999, cur + delta));
        input.value = next;
        state.qty = next;
        recalc();
    };

    window._soOnQtyInput = function() {
        const input = document.getElementById('soQty');
        const v = Math.max(1, Math.min(9999, parseInt(input.value) || 1));
        if (v !== parseInt(input.value)) input.value = v;
        state.qty = v;
        recalc();
    };

    // ─────────────────────────────────────────────
    // 모달 열기 / 닫기
    // ─────────────────────────────────────────────
    window.openSimpleOrderModal = async function(productCode, productData) {
        injectStyles();
        injectModal();
        state = { product: null, file: null, thumbDataUrl: null, qty: 1 };

        // 1) 상품 데이터 — 전달된 거 우선, 없으면 캐시, 없으면 DB
        let p = productData;
        if (!p && window.PRODUCT_DB && window.PRODUCT_DB[productCode]) p = window.PRODUCT_DB[productCode];
        if (!p) {
            const sb = getSb();
            if (!sb) {
                showStatus(tr('상품 정보를 불러올 수 없습니다.', '商品情報を取得できません。', 'Failed to load product info.'), 'err');
                document.getElementById('simpleOrderModal').classList.add('open');
                return;
            }
            const { data, error } = await sb.from('admin_products').select('*').eq('code', productCode).single();
            if (error || !data) {
                showStatus(tr('상품을 찾을 수 없습니다.', '商品が見つかりません。', 'Product not found.'), 'err');
                document.getElementById('simpleOrderModal').classList.add('open');
                return;
            }
            p = data;
            if (!window.PRODUCT_DB) window.PRODUCT_DB = {};
            window.PRODUCT_DB[productCode] = p;
        }
        state.product = p;

        // 2) 렌더
        document.getElementById('soName').textContent = pickName(p);
        document.getElementById('soDesc').textContent = pickDesc(p);
        const img = document.getElementById('soImg');
        const imgUrl = pickImg(p);
        if (imgUrl) { img.src = imgUrl; img.style.display = ''; }
        else { img.style.display = 'none'; }
        document.getElementById('soQty').value = 1;
        state.qty = 1;
        recalc();
        updateButtons();

        // 업로드 영역 초기화 (이전 파일 흔적 제거)
        const zone = document.getElementById('soUpload');
        if (zone) {
            zone.classList.remove('so-upload-done');
            zone.innerHTML = `
                <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />
                <div class="so-upload-icon">📁</div>
                <div class="so-upload-title">${tr('파일을 선택하거나 끌어다 놓으세요', 'ファイルを選択またはドロップ', 'Click or drop a file')}</div>
                <div class="so-upload-hint">${tr('PDF · PNG · JPG · 최대 10MB', 'PDF · PNG · JPG · 最大10MB', 'PDF · PNG · JPG · max 10MB')}</div>
            `;
            zone.onclick = () => document.getElementById('soFile').click();
            wireUploadEvents();
        }
        const statusEl = document.getElementById('soStatus');
        if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }

        document.getElementById('simpleOrderModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    window.closeSimpleOrderModal = function() {
        const m = document.getElementById('simpleOrderModal');
        if (m) m.classList.remove('open');
        document.body.style.overflow = '';
    };

    // ─────────────────────────────────────────────
    // 장바구니 / 주문
    // ─────────────────────────────────────────────
    async function uploadFile() {
        const sb = getSb();
        if (!sb) throw new Error('Supabase not available');
        const ts = Date.now();
        const safeName = (state.file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = 'simple_order/' + ts + '_' + safeName;
        const { data, error } = await sb.storage.from('design').upload(path, state.file);
        if (error) throw error;
        const pub = sb.storage.from('design').getPublicUrl(path).data.publicUrl;
        return { path, url: pub };
    }

    function calcFinal() {
        const unit = pickPrice(state.product);
        const subtotal = unit * state.qty;
        const tier = getDiscountTier(state.qty);
        const discount = Math.round(subtotal * tier.pct / 100);
        return { unit, subtotal, discount, final: subtotal - discount, tierPct: tier.pct };
    }

    function buildCartItem(fileUrl, filePath) {
        const p = state.product;
        const calc = calcFinal();
        return {
            uid: Date.now(),
            product: {
                code: p.code,
                name: pickName(p),
                name_kr: p.name_kr || p.name,
                name_jp: p.name_jp,
                name_us: p.name_us,
                price: p.price,
                price_jp: p.price_jp,
                category: p.category,
                w_mm: p.w_mm,
                h_mm: p.h_mm,
            },
            type: 'file_upload',
            fileName: state.file.name,
            mimeType: state.file.type,
            fileData: null,
            originalUrl: fileUrl,
            filePath: filePath,
            thumb: state.thumbDataUrl,
            isOpen: false,
            qty: state.qty,
            selectedAddons: [],
            addonQuantities: {},
            // 간편 주문에서 계산한 가격 정보 (디버그/표시용)
            _simple: {
                unit: calc.unit,
                subtotal: calc.subtotal,
                discountPct: calc.tierPct,
                discount: calc.discount,
                final: calc.final,
            },
        };
    }

    function readCart() {
        try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function writeCart(arr) {
        try { localStorage.setItem(CART_KEY, JSON.stringify(arr)); } catch (e) {}
    }

    async function doAddToCart() {
        if (!state.product || !state.file) return false;
        const btn1 = document.getElementById('soBtnCart');
        const btn2 = document.getElementById('soBtnBuy');
        if (btn1) btn1.disabled = true;
        if (btn2) btn2.disabled = true;
        showStatus(tr('파일 업로드 중...', 'アップロード中...', 'Uploading...'), 'ok');
        try {
            const { url, path } = await uploadFile();
            const item = buildCartItem(url, path);
            const cart = readCart();
            cart.push(item);
            writeCart(cart);
            // 기존 cartData 갱신 (order.js 모듈)
            try {
                if (Array.isArray(window.cartData)) {
                    window.cartData.length = 0;
                    cart.forEach(i => window.cartData.push(i));
                }
            } catch (e) {}
            // 기존 UI 갱신
            try { if (window.renderCart) window.renderCart(); } catch (e) {}
            showStatus(tr('✅ 장바구니에 담겼습니다.', '✅ カートに追加しました。', '✅ Added to cart.'), 'ok');
            // Google Ads 추적 (있으면)
            try { if (window.gtagTrackAddToCart) window.gtagTrackAddToCart(); } catch (e) {}
            return true;
        } catch (e) {
            console.error('[simple_order] addToCart error', e);
            showStatus(tr('실패: ', '失敗: ', 'Failed: ') + (e.message || e), 'err');
            return false;
        } finally {
            updateButtons();
        }
    }

    window._soAddCart = async function() {
        const ok = await doAddToCart();
        if (ok) {
            setTimeout(() => window.closeSimpleOrderModal(), 800);
        }
    };

    window._soBuyNow = async function() {
        const ok = await doAddToCart();
        if (!ok) return;
        // 카트 패널 / 체크아웃 열기 (기존 시스템)
        try {
            if (window.openCartPanel) window.openCartPanel();
            else if (window.toggleCart) window.toggleCart(true);
            else if (window.showCart) window.showCart();
            else {
                // 폴백 — 카트 페이지 이동
                location.href = '/?cart=open';
            }
        } catch (e) {
            location.href = '/?cart=open';
        }
        setTimeout(() => window.closeSimpleOrderModal(), 300);
    };

    // ─────────────────────────────────────────────
    // 초기화 — DOM 준비되면 스타일/모달 미리 주입
    // ─────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
            injectModal();
        });
    } else {
        injectStyles();
        injectModal();
    }

    console.log('[simple_order] v=1 loaded. window.openSimpleOrderModal(code) available.');
})();
