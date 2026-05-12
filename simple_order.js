/* simple_order.js — 간편 주문 모달 (v=4 — 2단 레이아웃: 좌 업로드 / 우 옵션)
 *
 * 사용:
 *   <script src="simple_order.js?v=4"></script>
 *   window.openSimpleOrderModal(productCode)   ← 어디서든 호출 가능
 *
 * 디자인 가이드:
 *   - 패브릭 디자이너(cotton_designer)와 동일한 레이아웃 패턴
 *   - 좌측: 큰 파일 업로드 + 미리보기 영역
 *   - 우측: 상품 정보 + 수량 + 가격 + 장바구니/주문 버튼
 *   - 모바일: 세로로 스택
 *
 * 카트 통합:
 *   - 기존 chameleon_cart_current localStorage + window.renderCart()
 *   - 다양한 종류의 상품이 같은 카트에 누적됨
 *
 * 할인 테이블 (수량 기준):
 *   1-2개 0% / 3-9개 20% / 10-100개 30% / 101-500개 40% / 501+개 50%
 */
(function() {
    'use strict';

    if (window.__SO_LOADED) return;
    window.__SO_LOADED = true;

    // ─────────────────────────────────────────────
    // 상수
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

    let state = { product: null, file: null, thumbDataUrl: null, qty: 1 };

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
        for (const t of DISCOUNT_TIERS) if (qty >= t.min && qty <= t.max) return t;
        return DISCOUNT_TIERS[0];
    }

    function tr(ko, ja, en) {
        const lang = getLang();
        if (lang === 'ja') return ja || ko;
        if (lang === 'en') return en || ko;
        return ko;
    }

    // ─────────────────────────────────────────────
    // 상품 정보 헬퍼 (다국어 + HTML 제거)
    // ─────────────────────────────────────────────
    function pickName(p) {
        const lang = getLang();
        if (lang === 'ja' && p.name_jp) return p.name_jp;
        if (lang === 'en' && p.name_us) return p.name_us;
        const raw = p.name_kr || p.name || '';
        return raw.replace(/\s*\([\d.,]+\s*[×xX]\s*[\d.,]+\s*(ft|in|mm|cm|m)\)/gi, '').trim();
    }
    function pickDescPlain(p, maxLen) {
        const lang = getLang();
        let raw = '';
        if (lang === 'ja' && p.description_jp) raw = p.description_jp;
        else if (lang === 'en' && p.description_us) raw = p.description_us;
        else raw = p.description_kr || p.description || '';
        if (!raw) return '';
        const s = String(raw)
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ').trim();
        const limit = maxLen || 150;
        return s.length > limit ? s.slice(0, limit) + '…' : s;
    }
    function pickPrice(p) { return p.price || 0; }
    function pickImg(p) { return p.img || p.image_url || p.image_kr || p.image || p.thumb_url || ''; }

    // ─────────────────────────────────────────────
    // CSS + 모달 HTML 주입
    // ─────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('so-styles')) return;
        const css = `
/* 풀스크린 오버레이 — 패브릭 디자이너처럼 화면 가득 */
.so-overlay {
    position: fixed; inset: 0; background: #faf6ed; z-index: 50000;
    display: none;
}
.so-overlay.open { display: block; }
.so-modal {
    background: #faf6ed;
    width: 100%; height: 100%;
    max-height: none; max-width: none;
    border-radius: 0; box-shadow: none;
    display: flex; flex-direction: column; overflow: hidden;
    font-family: 'Pretendard', -apple-system, system-ui, sans-serif;
}
.so-head {
    padding: 14px 28px; display: flex; align-items: center; justify-content: space-between;
    background: #fff; border-bottom: 1px solid #ede4d3; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(69,26,3,0.06);
}
.so-head-left { display: flex; align-items: center; gap: 14px; }
.so-brand {
    font-size: 18px; font-weight: 900; color: #451a03;
    letter-spacing: 0.5px;
}
.so-back {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; background: #fef7e6; border: 1px solid #e7e5e4;
    border-radius: 50px; cursor: pointer;
    font-size: 13px; font-weight: 700; color: #78350f;
    font-family: inherit; transition: all 0.2s;
}
.so-back:hover { background: #fde68a; }
.so-head h2 {
    margin: 0; font-size: 15px; font-weight: 700; color: #78350f;
}
.so-close {
    width: 34px; height: 34px; border: 1px solid #e7e5e4; background: #fff;
    border-radius: 50%; cursor: pointer; font-size: 18px; color: #555;
}
.so-close:hover { background: #f5f5f5; }

.so-body {
    display: flex; gap: 24px; flex: 1; overflow: hidden;
    padding: 24px 28px;
    max-width: 1400px; margin: 0 auto; width: 100%; box-sizing: border-box;
}

/* 좌측: 큰 업로드 영역 */
.so-left {
    flex: 1.5; background: #fff; padding: 24px; overflow-y: auto;
    display: flex; flex-direction: column;
    border-radius: 14px; border: 1px solid #ede4d3;
}
.so-prod-banner {
    display: flex; gap: 12px; padding-bottom: 14px; margin-bottom: 14px;
    border-bottom: 1px solid #f1f1f1;
}
.so-prod-img {
    width: 64px; height: 64px; border-radius: 8px; background: #f5f5f5;
    object-fit: cover; flex-shrink: 0;
}
.so-prod-meta { flex: 1; min-width: 0; }
.so-prod-name { font-size: 16px; font-weight: 800; color: #1a1a1a; margin: 0 0 4px; line-height: 1.3; }
.so-prod-desc { font-size: 11.5px; color: #777; line-height: 1.5; }

.so-upload-section-label {
    font-size: 12px; font-weight: 800; color: #444;
    margin: 0 0 10px;
}
.so-upload {
    flex: 1; min-height: 320px;
    border: 2px dashed #d6d3d1; border-radius: 14px; padding: 32px 16px;
    text-align: center; cursor: pointer; background: var(--cream, #faf6ed);
    transition: all 0.2s;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.so-upload:hover, .so-upload.dragover {
    border-color: #b45309; background: #fef7e6;
}
.so-upload-icon { font-size: 48px; color: #b45309; margin-bottom: 12px; }
.so-upload-title { font-size: 16px; font-weight: 800; color: #451a03; margin-bottom: 6px; }
.so-upload-hint { font-size: 12px; color: #888; line-height: 1.6; }
.so-upload-formats {
    margin-top: 12px; display: inline-block; background: #fff; border: 1px solid #e7e5e4;
    padding: 4px 12px; border-radius: 50px; font-size: 11px; color: #78350f; font-weight: 700;
}

/* 업로드 완료 상태 */
.so-upload.done {
    border: 1.5px solid #16a34a; background: #f0fdf4;
    cursor: default; padding: 20px;
    justify-content: flex-start; align-items: center;
}

/* 인쇄 사이즈 라벨 */
.so-size-label-row { width: 100%; text-align: center; margin-bottom: 12px; }
.so-size-tag {
    display: inline-block; padding: 6px 14px; background: #fff;
    border: 1px solid #16a34a; border-radius: 50px; font-size: 12px;
    color: #166534; font-weight: 700;
}
.so-size-tag b { color: #15803d; }

/* 프레임 + 줄자 래퍼 */
.so-print-frame-wrap {
    display: flex; flex-direction: column; align-items: flex-start;
    margin: 0 auto 12px; padding-left: 22px; padding-top: 22px;
    position: relative;
}
.so-print-frame {
    border: 1.5px solid #78350f; background: #fff;
    box-shadow: 0 6px 20px rgba(69,26,3,0.12);
    overflow: hidden; position: relative;
}

/* 줄자 (cm 눈금) */
.so-ruler {
    position: relative; background: #fef7e6; flex-shrink: 0;
}
.so-ruler-top {
    height: 22px;
    border-bottom: 1px solid #d6d3d1;
    margin-left: 22px; /* 좌측 줄자 폭만큼 들여 */
}
.so-ruler-left {
    width: 22px;
    border-right: 1px solid #d6d3d1;
    margin-top: 0;
}
.so-ruler-tick {
    position: absolute; left: 0; bottom: 0;
    width: 1px; height: 5px; background: #78350f;
}
.so-ruler-tick.major { height: 9px; background: #451a03; }
.so-ruler-tick.vertical {
    position: absolute; top: 0; right: 0; left: auto; bottom: auto;
    width: 5px; height: 1px;
}
.so-ruler-tick.vertical.major { width: 9px; }
.so-ruler-label {
    position: absolute; left: 2px; top: -2px;
    font-size: 9px; color: #451a03; font-weight: 700;
}
.so-ruler-label.vertical {
    position: absolute; right: 6px; left: auto; top: -6px;
    font-size: 9px; color: #451a03; font-weight: 700;
    transform: none;
}

/* 파일 정보 카드 */
.so-file-preview {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    background: #fff; border: 1px solid #d1fae5; border-radius: 10px;
    margin-top: 6px; text-align: left; max-width: 540px; width: 100%;
}
.so-file-icon {
    width: 44px; height: 44px; border-radius: 8px; background: #f0fdf4;
    display: flex; align-items: center; justify-content: center; font-size: 22px;
    flex-shrink: 0;
}
.so-file-info { flex: 1; min-width: 0; }
.so-file-name { font-size: 13px; font-weight: 700; color: #1a1a1a; word-break: break-all; }
.so-file-size { font-size: 11px; color: #888; margin-top: 2px; }
.so-file-change {
    border: 1px solid #d6d3d1; background: #fff; color: #78350f; font-weight: 700;
    padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px;
    font-family: inherit; flex-shrink: 0;
}
.so-file-change:hover { background: #fef7e6; }

/* 카트 드로어 — 우측 슬라이드 */
.so-cart-drawer-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50100;
    display: none; opacity: 0; transition: opacity 0.25s;
}
.so-cart-drawer-overlay.open { display: block; opacity: 1; }
.so-cart-drawer {
    position: fixed; right: 0; top: 0; height: 100%; width: 440px;
    max-width: 100%; background: #fff; z-index: 50101;
    box-shadow: -8px 0 40px rgba(0,0,0,0.2);
    transform: translateX(100%); transition: transform 0.3s ease;
    display: flex; flex-direction: column;
}
.so-cart-drawer.open { transform: translateX(0); }
.so-cart-head {
    padding: 16px 20px; border-bottom: 1px solid #ede4d3;
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(135deg, #451a03, #78350f); color: #fde047;
}
.so-cart-head h3 { margin: 0; font-size: 17px; font-weight: 800; }
.so-cart-close {
    width: 30px; height: 30px; border: none; background: rgba(255,255,255,0.15);
    color: #fde047; border-radius: 50%; cursor: pointer; font-size: 18px;
}
.so-cart-close:hover { background: rgba(255,255,255,0.25); }
.so-cart-body { flex: 1; overflow-y: auto; padding: 16px 20px; background: #faf6ed; }
.so-cart-empty {
    text-align: center; padding: 40px 20px; color: #888; font-size: 13px;
}
.so-cart-empty i { font-size: 48px; opacity: 0.4; display: block; margin-bottom: 10px; }
.so-cart-item {
    display: flex; gap: 12px; padding: 12px; background: #fff;
    border-radius: 10px; border: 1px solid #ede4d3; margin-bottom: 10px;
}
.so-cart-item-thumb {
    width: 64px; height: 64px; border-radius: 8px; background: #f5f5f5;
    object-fit: cover; flex-shrink: 0; border: 1px solid #eaeaea;
}
.so-cart-item-info { flex: 1; min-width: 0; }
.so-cart-item-name { font-size: 13px; font-weight: 700; color: #1a1a1a; line-height: 1.3; margin-bottom: 4px; }
.so-cart-item-meta { font-size: 11px; color: #888; line-height: 1.5; }
.so-cart-item-bottom {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 6px;
}
.so-cart-qty-controls { display: flex; align-items: center; gap: 4px; }
.so-cart-qty-btn {
    width: 24px; height: 24px; border: 1px solid #d6d3d1; background: #fff;
    border-radius: 4px; cursor: pointer; font-weight: 800; color: #451a03;
    font-size: 13px; padding: 0;
}
.so-cart-qty-input {
    width: 40px; height: 24px; text-align: center; border: 1px solid #d6d3d1;
    border-radius: 4px; font-weight: 700; font-size: 12px; font-family: inherit;
}
.so-cart-item-price { font-size: 13px; font-weight: 800; color: #451a03; }
.so-cart-item-remove {
    background: none; border: none; color: #dc2626; font-size: 11px; cursor: pointer;
    padding: 2px 4px;
}
.so-cart-foot {
    padding: 16px 20px; border-top: 1px solid #ede4d3; background: #fff;
}
.so-cart-total {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px;
}
.so-cart-total-label { font-size: 14px; font-weight: 700; color: #78350f; }
.so-cart-total-amt { font-size: 22px; font-weight: 900; color: #451a03; }
.so-cart-checkout-btn {
    width: 100%; padding: 14px; border: none; border-radius: 10px;
    background: linear-gradient(135deg, #451a03, #78350f); color: #fde047;
    font-size: 15px; font-weight: 800; cursor: pointer; font-family: inherit;
}
.so-cart-checkout-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
    .so-cart-drawer { width: 100%; }
}

/* 우측: 옵션 패널 */
.so-right {
    flex: 1; background: #faf6ed; padding: 0;
    overflow-y: auto; min-width: 320px; max-width: 420px;
    display: flex; flex-direction: column; gap: 14px;
}
.so-section {
    background: #fff; border: 1px solid #e7e5e4; border-radius: 10px;
    padding: 14px;
}
.so-section-title {
    font-size: 12px; font-weight: 800; color: #451a03;
    margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;
}
.so-qty-row {
    display: flex; align-items: center; gap: 10px; background: #fafaf9;
    border-radius: 10px; padding: 8px;
}
.so-qty-btn {
    width: 36px; height: 36px; border-radius: 8px; border: 1px solid #d6d3d1;
    background: #fff; cursor: pointer; font-size: 16px; font-weight: 900; color: #451a03;
}
.so-qty-btn:hover { background: #f5f5f5; }
.so-qty-input {
    flex: 1; height: 36px; border: 1px solid #d6d3d1; border-radius: 8px;
    text-align: center; font-size: 15px; font-weight: 700; padding: 0 8px;
    font-family: inherit;
}
.so-qty-unit { font-size: 12px; color: #888; }

.so-tier-table {
    background: #fafaf9; border-radius: 8px; padding: 8px 10px;
    margin-top: 10px; font-size: 10.5px; color: #475569; line-height: 1.6;
    display: flex; flex-wrap: wrap; gap: 4px 10px;
}
.so-tier-table b { color: #1e293b; font-weight: 700; }
.so-tier-table .active { background: #fde68a; padding: 1px 5px; border-radius: 4px; color: #78350f; }

.so-price-box .so-price-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; color: #555; margin: 4px 0;
}
.so-price-row.discount span:last-child { color: #dc2626; font-weight: 700; }
.so-price-row.total {
    font-size: 18px; font-weight: 900; color: #451a03;
    padding-top: 10px; border-top: 1px dashed #d6d3d1; margin-top: 10px;
}
.so-tier-tag {
    display: inline-block; font-size: 10px; font-weight: 800;
    background: #fde68a; color: #92400e; padding: 2px 7px; border-radius: 50px;
    margin-left: 6px;
}

.so-actions { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
.so-btn {
    padding: 14px; border: none; border-radius: 10px; cursor: pointer;
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

.so-status {
    padding: 10px; background: #f0fdf4; border-radius: 8px;
    font-size: 12px; color: #166534; display: none;
}
.so-status.err { background: #fef2f2; color: #991b1b; }

/* 모바일 — 세로 스택, 풀스크린 유지 */
@media (max-width: 768px) {
    .so-head { padding: 12px 16px; }
    .so-brand { font-size: 16px; }
    .so-back { padding: 6px 10px; font-size: 12px; }
    .so-head h2 { display: none; }
    .so-body {
        flex-direction: column; gap: 14px;
        padding: 14px; overflow-y: auto;
    }
    .so-left { padding: 16px; border-radius: 12px; }
    .so-right { padding: 0; min-width: 0; max-width: none; }
    .so-upload { min-height: 220px; padding: 24px 12px; }
    .so-upload-icon { font-size: 40px; }
    .so-upload-title { font-size: 15px; }
    .so-prod-banner { padding-bottom: 10px; margin-bottom: 10px; }
    .so-prod-img { width: 52px; height: 52px; }
    .so-prod-name { font-size: 15px; }
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
<div id="simpleOrderModal" class="so-overlay">
  <div class="so-modal">
    <div class="so-head">
      <div class="so-head-left">
        <button class="so-back" onclick="window.closeSimpleOrderModal()" title="${tr('메인으로', 'メインへ', 'Back')}">
          ← ${tr('메인으로', 'メインへ', 'Main')}
        </button>
        <button class="so-back so-cat-home" id="soCatHome" style="display:none" onclick="window._soBackToCategory()" title="${tr('카테고리 목록', 'カテゴリー一覧', 'Category list')}">
          📂 <span id="soCatHomeLabel"></span>
        </button>
        <span class="so-brand">Chameleon</span>
        <h2 id="soHeadTitle">${tr('상품 주문', '商品注文', 'Order')}</h2>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="so-back" id="soCartBtn" onclick="window._soToggleCart(true)" title="${tr('장바구니', 'カート', 'Cart')}">
          🛒 <span id="soCartCount">0</span>
        </button>
        <button class="so-close" onclick="window.closeSimpleOrderModal()" title="${tr('닫기', '閉じる', 'Close')}">×</button>
      </div>
    </div>

    <div class="so-body">
      <!-- 좌측: 큰 파일 업로드 -->
      <div class="so-left">
        <div class="so-prod-banner">
          <img id="soImg" class="so-prod-img" alt="" />
          <div class="so-prod-meta">
            <div id="soName" class="so-prod-name">-</div>
            <div id="soDesc" class="so-prod-desc"></div>
          </div>
        </div>

        <div class="so-upload-section-label">${tr('📤 디자인 파일 업로드', '📤 デザインファイルをアップロード', '📤 Upload design file')}</div>
        <div id="soUpload" class="so-upload" onclick="document.getElementById('soFile').click()">
          <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />
          <div class="so-upload-icon">📤</div>
          <div class="so-upload-title">${tr('이미지를 올려주세요', '画像をアップロード', 'Upload your file')}</div>
          <div class="so-upload-hint">${tr('여기를 클릭하거나 파일을 끌어다 놓으세요', 'クリックまたはドラッグ&ドロップ', 'Click or drag & drop')}</div>
          <div class="so-upload-formats">${tr('PDF · PNG · JPG · 10MB 이하', 'PDF・PNG・JPG・10MB以下', 'PDF / PNG / JPG · max 10MB')}</div>
        </div>
      </div>

      <!-- 우측: 옵션 + 가격 + 버튼 -->
      <div class="so-right">
        <div class="so-section">
          <div class="so-section-title">${tr('주문 수량', '注文数量', 'Quantity')}</div>
          <div class="so-qty-row">
            <button class="so-qty-btn" onclick="window._soQtyChg(-1)">−</button>
            <input type="number" id="soQty" class="so-qty-input" value="1" min="1" max="9999" oninput="window._soOnQtyInput()" />
            <button class="so-qty-btn" onclick="window._soQtyChg(1)">+</button>
            <span class="so-qty-unit">${tr('개', '個', 'pcs')}</span>
          </div>
          <div class="so-tier-table" id="soTierTable">
            <div data-tier="0"><b>1-2</b>${tr('개', '個', 'pcs')} 0%</div>
            <div data-tier="20"><b>3-9</b>${tr('개', '個', 'pcs')} 20%</div>
            <div data-tier="30"><b>10-100</b>${tr('개', '個', 'pcs')} 30%</div>
            <div data-tier="40"><b>101-500</b>${tr('개', '個', 'pcs')} 40%</div>
            <div data-tier="50"><b>501+</b>${tr('개', '個', 'pcs')} 50%</div>
          </div>
        </div>

        <div class="so-section so-price-box">
          <div class="so-section-title">${tr('가격', '価格', 'Price')}</div>
          <div class="so-price-row"><span>${tr('단가', '単価', 'Unit')}</span><span id="soUnit">-</span></div>
          <div class="so-price-row discount"><span>${tr('수량 할인', '数量割引', 'Discount')} <span class="so-tier-tag" id="soTier">0%</span></span><span id="soDisc">-0원</span></div>
          <div class="so-price-row total"><span>${tr('합계', '合計', 'Total')}</span><span id="soTotal">-</span></div>
        </div>

        <div id="soStatus" class="so-status"></div>

        <div class="so-actions">
          <button class="so-btn so-btn-cart" id="soBtnCart" onclick="window._soAddCart()" disabled>
            🛒 ${tr('장바구니에 담기', 'カートに追加', 'Add to cart')}
          </button>
          <button class="so-btn so-btn-buy" id="soBtnBuy" onclick="window._soBuyNow()" disabled>
            ⚡ ${tr('바로 주문하기', '今すぐ注文', 'Order now')}
          </button>
        </div>
      </div>
    </div>

    <!-- 카트 드로어 (우측 슬라이드) -->
    <div class="so-cart-drawer-overlay" id="soCartOverlay" onclick="window._soToggleCart(false)"></div>
    <div class="so-cart-drawer" id="soCartDrawer">
      <div class="so-cart-head">
        <h3>🛒 ${tr('장바구니', 'カート', 'Cart')} <span id="soCartCountTitle" style="font-size:13px; opacity:0.7;">(0)</span></h3>
        <button class="so-cart-close" onclick="window._soToggleCart(false)">×</button>
      </div>
      <!-- 2026-05-12: 크로스도메인 카트 배너 (cart_sync.js 가 채움) -->
      <div id="cartCrossBanner" style="display:none;"></div>
      <div class="so-cart-body" id="soCartList">
        <!-- 카트 아이템 동적 렌더 -->
      </div>
      <div class="so-cart-foot">
        <div class="so-cart-total">
          <span class="so-cart-total-label">${tr('총 결제금액', '合計', 'Total')}</span>
          <span class="so-cart-total-amt" id="soCartTotalAmt">0원</span>
        </div>
        <button class="so-cart-checkout-btn" id="soCartCheckoutBtn" onclick="window._soGoCheckout()" disabled>
          ${tr('주문하기', '注文する', 'Checkout')}
        </button>
      </div>
    </div>
  </div>
</div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        wireUploadEvents();
    }

    // ─────────────────────────────────────────────
    // 파일 업로드
    // ─────────────────────────────────────────────
    function wireUploadEvents() {
        const fi = document.getElementById('soFile');
        const dz = document.getElementById('soUpload');
        if (!fi || !dz) return;
        fi.onchange = e => handleFile(e.target.files[0]);
        dz.ondragover = e => { e.preventDefault(); dz.classList.add('dragover'); };
        dz.ondragleave = () => dz.classList.remove('dragover');
        dz.ondrop = e => {
            e.preventDefault();
            dz.classList.remove('dragover');
            handleFile(e.dataTransfer.files[0]);
        };
    }

    // PDF.js 지연 로드 — 사용자가 PDF 업로드 시점에만 로드
    function loadPdfJs() {
        if (typeof window.pdfjsLib !== 'undefined') return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
                resolve();
            };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function pdfFirstPageToDataUrl(file) {
        await loadPdfJs();
        if (!window.pdfjsLib) throw new Error('PDF.js not loaded');
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        // PDF 페이지의 실제 사이즈 (pt 단위 → mm 변환)
        const vp1 = page.getViewport({ scale: 1 });
        const widthMm = vp1.width * 25.4 / 72;
        const heightMm = vp1.height * 25.4 / 72;
        // 렌더 — 적당한 해상도 (모달 미리보기용)
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return {
            dataUrl: canvas.toDataURL('image/png'),
            widthMm: Math.round(widthMm),
            heightMm: Math.round(heightMm),
        };
    }

    // 이미지 (PNG/JPG) — 픽셀 사이즈만 추출 (DPI 불명 — 환산 불가)
    function imageDataUrlWithDims(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => {
                const dataUrl = e.target.result;
                const i = new Image();
                i.onload = () => resolve({
                    dataUrl: dataUrl,
                    widthPx: i.naturalWidth,
                    heightPx: i.naturalHeight,
                });
                i.onerror = () => resolve({ dataUrl: dataUrl, widthPx: 0, heightPx: 0 });
                i.src = dataUrl;
            };
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }

    async function handleFile(file) {
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
        state.thumbDataUrl = null;
        state.fileWidthMm = null;
        state.fileHeightMm = null;
        state.fileWidthPx = null;
        state.fileHeightPx = null;
        state.fileKind = isPdf ? 'pdf' : (isPng ? 'png' : 'jpg');

        try {
            if (isPdf) {
                showStatus(tr('PDF 미리보기 변환 중...', 'PDFプレビュー変換中...', 'Converting PDF preview...'), 'ok');
                const r = await pdfFirstPageToDataUrl(file);
                state.thumbDataUrl = r.dataUrl;
                state.fileWidthMm = r.widthMm;
                state.fileHeightMm = r.heightMm;
                hideStatus();
            } else {
                // PNG / JPG
                const r = await imageDataUrlWithDims(file);
                state.thumbDataUrl = r.dataUrl;
                state.fileWidthPx = r.widthPx;
                state.fileHeightPx = r.heightPx;
            }
        } catch (e) {
            console.warn('[simple_order] thumb 생성 실패:', e);
            state.thumbDataUrl = null;
        }
        renderUploadDone();
    }

    function renderUploadDone() {
        const zone = document.getElementById('soUpload');
        if (!zone) return;
        zone.classList.add('done');

        // 1) 사이즈 결정 — 우선순위:
        //    PDF면: PDF 페이지의 실제 mm
        //    PNG/JPG면: 이미지 픽셀 → 300 DPI 가정해 mm 환산 (인쇄용 표준 가정)
        //    추출 실패 시: 상품 스펙 (p.w_mm/h_mm), 그것도 없으면 기본 300×600
        const p = state.product || {};
        let w_mm, h_mm, sizeSource;
        if (state.fileWidthMm && state.fileHeightMm) {
            w_mm = state.fileWidthMm;
            h_mm = state.fileHeightMm;
            sizeSource = 'pdf';
        } else if (state.fileWidthPx && state.fileHeightPx) {
            // 300 DPI 가정: px / 300 * 25.4 = mm
            w_mm = Math.round(state.fileWidthPx / 300 * 25.4);
            h_mm = Math.round(state.fileHeightPx / 300 * 25.4);
            sizeSource = 'img300';
        } else {
            w_mm = p.w_mm || 300;
            h_mm = p.h_mm || 600;
            sizeSource = 'product';
        }
        const w_cm = (w_mm / 10).toFixed(1).replace(/\.0$/, '');
        const h_cm = (h_mm / 10).toFixed(1).replace(/\.0$/, '');

        // 2) 프리뷰 영역 — 파일 비율에 맞춰 프레임 크기 결정
        const aspectRatio = w_mm / h_mm;
        const maxW = 500;
        const maxH = 460;
        let frameW = maxW;
        let frameH = frameW / aspectRatio;
        if (frameH > maxH) {
            frameH = maxH;
            frameW = frameH * aspectRatio;
        }
        frameW = Math.round(frameW);
        frameH = Math.round(frameH);

        const thumbHtml = state.thumbDataUrl
            ? `<img src="${state.thumbDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;color:#dc2626;">📄</div>`;

        const sizeMB = (state.file.size / 1024 / 1024).toFixed(2);

        // 사이즈 출처에 따라 라벨 다르게
        let sizeLabelHtml;
        if (sizeSource === 'pdf') {
            sizeLabelHtml = `📐 ${tr('파일 사이즈', 'ファイルサイズ', 'File size')}: <b>${w_cm} × ${h_cm} cm</b> <span style="opacity:0.7;font-size:11px;">(${w_mm} × ${h_mm} mm, PDF)</span>`;
        } else if (sizeSource === 'img300') {
            sizeLabelHtml = `📐 ${tr('파일 사이즈', 'ファイルサイズ', 'File size')}: <b>${w_cm} × ${h_cm} cm</b> <span style="opacity:0.7;font-size:11px;">(${state.fileWidthPx} × ${state.fileHeightPx} px @ 300 DPI 가정)</span>`;
        } else {
            sizeLabelHtml = `📐 ${tr('출력 사이즈', '出力サイズ', 'Print size')}: <b>${w_cm} × ${h_cm} cm</b>`;
        }

        // 상품 기본 사이즈와 차이 비교 (있는 경우)
        let mismatchHtml = '';
        if (p.w_mm && p.h_mm && (sizeSource === 'pdf' || sizeSource === 'img300')) {
            const prodW = p.w_mm, prodH = p.h_mm;
            const wDiff = Math.abs(w_mm - prodW) / prodW;
            const hDiff = Math.abs(h_mm - prodH) / prodH;
            if (wDiff > 0.05 || hDiff > 0.05) {
                mismatchHtml = `<div style="font-size:11px;color:#dc2626;margin-top:4px;text-align:center;">⚠️ ${tr('상품 권장 사이즈', '推奨サイズ', 'Recommended')}: ${prodW/10} × ${prodH/10} cm</div>`;
            }
        }

        zone.innerHTML = `
            <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />

            <!-- 사이즈 라벨 -->
            <div class="so-size-label-row">
                <span class="so-size-tag">${sizeLabelHtml}</span>
                ${mismatchHtml}
            </div>

            <!-- 프레임 + 줄자 -->
            <div class="so-print-frame-wrap">
                <div class="so-ruler so-ruler-top" data-width="${w_cm}" style="width:${frameW}px;"></div>
                <div style="display:flex; align-items:flex-start;">
                    <div class="so-ruler so-ruler-left" data-height="${h_cm}" style="height:${frameH}px;"></div>
                    <div class="so-print-frame" style="width:${frameW}px; height:${frameH}px;">
                        ${thumbHtml}
                    </div>
                </div>
            </div>

            <!-- 파일 정보 카드 -->
            <div class="so-file-preview">
                <div class="so-file-icon">${state.file.type === 'application/pdf' ? '📄' : '🖼️'}</div>
                <div class="so-file-info">
                    <div class="so-file-name">${escapeHtml(state.file.name)}</div>
                    <div class="so-file-size">${sizeMB} MB</div>
                </div>
                <button class="so-file-change" onclick="event.stopPropagation();document.getElementById('soFile').click()">${tr('변경', '変更', 'Change')}</button>
            </div>

            <div style="font-size:12px;color:#16a34a;font-weight:700;margin-top:6px;">
                ✅ ${tr('파일 업로드 준비 완료', 'ファイル準備完了', 'File ready')}
            </div>
        `;
        zone.onclick = null;
        wireUploadEvents();
        drawRulers(parseFloat(w_cm), parseFloat(h_cm), frameW, frameH);
        updateButtons();
    }

    // 줄자 그리기 — canvas로 cm 눈금
    function drawRulers(widthCm, heightCm, frameW, frameH) {
        const topRuler = document.querySelector('.so-ruler-top');
        const leftRuler = document.querySelector('.so-ruler-left');
        if (!topRuler || !leftRuler) return;

        // 상단 줄자
        topRuler.innerHTML = '';
        const pxPerCmW = frameW / widthCm;
        for (let cm = 0; cm <= widthCm; cm++) {
            const tick = document.createElement('div');
            const isMajor = cm % 5 === 0;
            const isLabel = cm % 10 === 0 || (widthCm <= 30 && cm % 5 === 0);
            tick.className = 'so-ruler-tick ' + (isMajor ? 'major' : 'minor');
            tick.style.left = (cm * pxPerCmW) + 'px';
            if (isLabel && cm > 0) {
                const lbl = document.createElement('span');
                lbl.className = 'so-ruler-label';
                lbl.textContent = cm;
                tick.appendChild(lbl);
            }
            topRuler.appendChild(tick);
        }

        // 좌측 줄자
        leftRuler.innerHTML = '';
        const pxPerCmH = frameH / heightCm;
        for (let cm = 0; cm <= heightCm; cm++) {
            const tick = document.createElement('div');
            const isMajor = cm % 5 === 0;
            const isLabel = cm % 10 === 0 || (heightCm <= 30 && cm % 5 === 0);
            tick.className = 'so-ruler-tick vertical ' + (isMajor ? 'major' : 'minor');
            tick.style.top = (cm * pxPerCmH) + 'px';
            if (isLabel && cm > 0) {
                const lbl = document.createElement('span');
                lbl.className = 'so-ruler-label vertical';
                lbl.textContent = cm;
                tick.appendChild(lbl);
            }
            leftRuler.appendChild(tick);
        }
    }

    function resetUploadZone() {
        const zone = document.getElementById('soUpload');
        if (!zone) return;
        zone.classList.remove('done');
        zone.innerHTML = `
            <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />
            <div class="so-upload-icon">📤</div>
            <div class="so-upload-title">${tr('이미지를 올려주세요', '画像をアップロード', 'Upload your file')}</div>
            <div class="so-upload-hint">${tr('여기를 클릭하거나 파일을 끌어다 놓으세요', 'クリックまたはドラッグ&ドロップ', 'Click or drag & drop')}</div>
            <div class="so-upload-formats">${tr('PDF · PNG · JPG · 10MB 이하', 'PDF・PNG・JPG・10MB以下', 'PDF / PNG / JPG · max 10MB')}</div>
        `;
        zone.onclick = () => document.getElementById('soFile').click();
        wireUploadEvents();
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
    function hideStatus() {
        const el = document.getElementById('soStatus');
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    }

    function updateButtons() {
        const ready = !!(state.product && state.file && state.qty > 0);
        const btnC = document.getElementById('soBtnCart');
        const btnB = document.getElementById('soBtnBuy');
        if (btnC) btnC.disabled = !ready;
        if (btnB) btnB.disabled = !ready;
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

        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('soUnit', fmtPrice(unit));
        setText('soDisc', '-' + fmtPrice(discount));
        setText('soTotal', fmtPrice(final));
        setText('soTier', tier.pct + '%');

        // 활성 티어 하이라이트
        const tbl = document.getElementById('soTierTable');
        if (tbl) {
            tbl.querySelectorAll('[data-tier]').forEach(el => {
                el.classList.toggle('active', parseInt(el.dataset.tier) === tier.pct);
            });
        }
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

        let p = productData;
        if (!p && window.PRODUCT_DB && window.PRODUCT_DB[productCode]) p = window.PRODUCT_DB[productCode];
        if (!p) {
            const sb = getSb();
            if (!sb) {
                showStatus(tr('상품 정보를 불러올 수 없습니다.', '商品情報を取得できません。', 'Failed to load.'), 'err');
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

        document.getElementById('soName').textContent = pickName(p);
        document.getElementById('soDesc').textContent = pickDescPlain(p, 150);
        const img = document.getElementById('soImg');
        const imgUrl = pickImg(p);
        if (imgUrl) { img.src = imgUrl; img.style.display = ''; img.onerror = () => { img.style.display = 'none'; }; }
        else { img.style.display = 'none'; }

        // 카테고리 홈 버튼 (있을 때만 표시)
        const catBtn = document.getElementById('soCatHome');
        const catLabel = document.getElementById('soCatHomeLabel');
        const catName = getCategoryLabel(p.category);
        if (catBtn && catName) {
            catBtn.style.display = '';
            if (catLabel) catLabel.textContent = catName;
        } else if (catBtn) {
            catBtn.style.display = 'none';
        }
        // 헤더 제목에 상품명 (보조)
        const headTitle = document.getElementById('soHeadTitle');
        if (headTitle) headTitle.textContent = pickName(p);

        document.getElementById('soQty').value = 1;
        state.qty = 1;
        recalc();
        updateButtons();
        resetUploadZone();
        hideStatus();

        // 카트 카운트 갱신
        try {
            const c = readCart().length;
            const cc = document.getElementById('soCartCount'); if (cc) cc.textContent = c;
        } catch (e) {}

        document.getElementById('simpleOrderModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    window.closeSimpleOrderModal = function() {
        const m = document.getElementById('simpleOrderModal');
        if (m) m.classList.remove('open');
        document.body.style.overflow = '';
    };

    // ─────────────────────────────────────────────
    // 카트 / 주문
    // ─────────────────────────────────────────────
    async function uploadFile() {
        const sb = getSb();
        if (!sb) throw new Error('Supabase not available');
        const ts = Date.now();
        const safeName = (state.file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = 'simple_order/' + ts + '_' + safeName;
        const { error } = await sb.storage.from('design').upload(path, state.file);
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
                img: pickImg(p),
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
            _simple: { unit: calc.unit, subtotal: calc.subtotal, discountPct: calc.tierPct, discount: calc.discount, final: calc.final },
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
        const btnC = document.getElementById('soBtnCart');
        const btnB = document.getElementById('soBtnBuy');
        if (btnC) btnC.disabled = true;
        if (btnB) btnB.disabled = true;
        showStatus(tr('📤 파일 업로드 중...', '📤 アップロード中...', '📤 Uploading...'), 'ok');
        try {
            const { url, path } = await uploadFile();
            const item = buildCartItem(url, path);
            const cart = readCart();
            cart.push(item);
            writeCart(cart);
            try {
                if (Array.isArray(window.cartData)) {
                    window.cartData.length = 0;
                    cart.forEach(i => window.cartData.push(i));
                }
            } catch (e) {}
            try { if (window.renderCart) window.renderCart(); } catch (e) {}
            try { if (window.gtagTrackAddToCart) window.gtagTrackAddToCart(); } catch (e) {}
            showStatus(tr('✅ 장바구니에 담겼습니다.', '✅ カートに追加しました。', '✅ Added to cart.'), 'ok');
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
            // 카트 드로어를 우측에서 슬라이드해서 보여줌 (모달은 그대로 유지)
            renderSoCart();
            setTimeout(() => window._soToggleCart(true), 200);
        }
    };

    window._soBuyNow = async function() {
        const ok = await doAddToCart();
        if (!ok) return;
        // 카트 드로어 슬라이드 + 자동 체크아웃 진행
        renderSoCart();
        window._soToggleCart(true);
    };

    // ─────────────────────────────────────────────
    // 카트 드로어 — 우측 슬라이드 + 아이템 목록 + 수량 조절
    // ─────────────────────────────────────────────
    window._soToggleCart = function(open) {
        const ov = document.getElementById('soCartOverlay');
        const dr = document.getElementById('soCartDrawer');
        if (!ov || !dr) return;
        if (open === undefined) open = !dr.classList.contains('open');
        if (open) {
            ov.classList.add('open');
            dr.classList.add('open');
            renderSoCart();
            // 2026-05-12: 크로스도메인 배너 렌더 (cart_sync.js)
            try { if (window.cartSync && window.cartSync.renderBanner) window.cartSync.renderBanner(); } catch (e) {}
        } else {
            ov.classList.remove('open');
            dr.classList.remove('open');
        }
    };

    function fmtCartName(item) {
        if (!item) return '-';
        const p = item.product || {};
        const lang = getLang();
        if (lang === 'ja' && p.name_jp) return p.name_jp;
        if (lang === 'en' && p.name_us) return p.name_us;
        return p.name || p.name_kr || '-';
    }

    function calcCartItemPrice(item) {
        // _simple 우선 (간편 주문에서 담은 거)
        if (item._simple) {
            const tier = getDiscountTier(item.qty || 1);
            const unit = item._simple.unit || (item.product && item.product.price) || 0;
            const subtotal = unit * (item.qty || 1);
            const discount = Math.round(subtotal * tier.pct / 100);
            return { unit, subtotal, discount, final: subtotal - discount, tierPct: tier.pct };
        }
        // 일반 카트 아이템 (다른 흐름에서 담은 거)
        const p = item.product || {};
        const unit = p.price || 0;
        const qty = item.qty || 1;
        const subtotal = unit * qty;
        return { unit, subtotal, discount: 0, final: subtotal, tierPct: 0 };
    }

    function renderSoCart() {
        const list = document.getElementById('soCartList');
        const totalEl = document.getElementById('soCartTotalAmt');
        const countEl = document.getElementById('soCartCount');
        const titleCountEl = document.getElementById('soCartCountTitle');
        const checkBtn = document.getElementById('soCartCheckoutBtn');
        if (!list || !totalEl) return;
        const cart = readCart();
        countEl && (countEl.textContent = cart.length);
        titleCountEl && (titleCountEl.textContent = '(' + cart.length + ')');

        if (cart.length === 0) {
            list.innerHTML = '<div class="so-cart-empty"><i>🛒</i>' +
                tr('장바구니가 비어있습니다', 'カートは空です', 'Your cart is empty') +
                '</div>';
            totalEl.textContent = fmtPrice(0);
            if (checkBtn) checkBtn.disabled = true;
            return;
        }

        let totalAmt = 0;
        list.innerHTML = cart.map((item, idx) => {
            const calc = calcCartItemPrice(item);
            totalAmt += calc.final;
            const thumb = item.thumb || (item.product && item.product.img) || '';
            const meta = [];
            if (calc.tierPct > 0) meta.push(`${calc.tierPct}% ${tr('할인', '割引', 'off')}`);
            if (item.fileName) meta.push(`📎 ${escapeHtml(item.fileName)}`);
            return `
            <div class="so-cart-item">
                ${thumb
                    ? `<img class="so-cart-item-thumb" src="${escapeHtml(thumb)}" alt="" />`
                    : `<div class="so-cart-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>`}
                <div class="so-cart-item-info">
                    <div class="so-cart-item-name">${escapeHtml(fmtCartName(item))}</div>
                    <div class="so-cart-item-meta">${meta.join(' · ')}</div>
                    <div class="so-cart-item-bottom">
                        <div class="so-cart-qty-controls">
                            <button class="so-cart-qty-btn" onclick="window._soCartQtyChg(${idx}, -1)">−</button>
                            <input type="number" class="so-cart-qty-input" min="1" max="9999"
                                value="${item.qty || 1}"
                                onchange="window._soCartQtySet(${idx}, this.value)" />
                            <button class="so-cart-qty-btn" onclick="window._soCartQtyChg(${idx}, 1)">+</button>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="so-cart-item-price">${fmtPrice(calc.final)}</span>
                            <button class="so-cart-item-remove" onclick="window._soCartRemove(${idx})" title="${tr('삭제', '削除', 'Remove')}">🗑</button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        totalEl.textContent = fmtPrice(totalAmt);
        if (checkBtn) checkBtn.disabled = false;
    }

    window._soCartQtyChg = function(idx, delta) {
        const cart = readCart();
        if (!cart[idx]) return;
        cart[idx].qty = Math.max(1, Math.min(9999, (cart[idx].qty || 1) + delta));
        // _simple 가격 재계산
        if (cart[idx]._simple) {
            const unit = cart[idx]._simple.unit;
            const qty = cart[idx].qty;
            const tier = getDiscountTier(qty);
            cart[idx]._simple.subtotal = unit * qty;
            cart[idx]._simple.discountPct = tier.pct;
            cart[idx]._simple.discount = Math.round(unit * qty * tier.pct / 100);
            cart[idx]._simple.final = cart[idx]._simple.subtotal - cart[idx]._simple.discount;
        }
        writeCart(cart);
        syncWindowCart(cart);
        renderSoCart();
    };

    window._soCartQtySet = function(idx, val) {
        const cart = readCart();
        if (!cart[idx]) return;
        cart[idx].qty = Math.max(1, Math.min(9999, parseInt(val) || 1));
        if (cart[idx]._simple) {
            const unit = cart[idx]._simple.unit;
            const qty = cart[idx].qty;
            const tier = getDiscountTier(qty);
            cart[idx]._simple.subtotal = unit * qty;
            cart[idx]._simple.discountPct = tier.pct;
            cart[idx]._simple.discount = Math.round(unit * qty * tier.pct / 100);
            cart[idx]._simple.final = cart[idx]._simple.subtotal - cart[idx]._simple.discount;
        }
        writeCart(cart);
        syncWindowCart(cart);
        renderSoCart();
    };

    window._soCartRemove = function(idx) {
        const cart = readCart();
        cart.splice(idx, 1);
        writeCart(cart);
        syncWindowCart(cart);
        renderSoCart();
    };

    function syncWindowCart(cart) {
        try {
            if (Array.isArray(window.cartData)) {
                window.cartData.length = 0;
                cart.forEach(i => window.cartData.push(i));
            }
            if (window.renderCart) window.renderCart();
        } catch (e) {}
    }

    window._soGoCheckout = function() {
        // 카트 드로어 닫고 메인 사이트의 카트/체크아웃 페이지로
        window._soToggleCart(false);
        try {
            if (window.openCartPanel) window.openCartPanel();
            else if (window.toggleCart) window.toggleCart(true);
            else location.href = '/?cart=open';
        } catch (e) {
            location.href = '/?cart=open';
        }
    };

    // 카테고리 라벨 매핑 (한국어 사이트 기준)
    const CATEGORY_LABELS_KR = {
        'paper_display': '종이매대', 'honeycomb_board': '허니콤보드',
        'business_card': '명함', 'leaflet': '전단', 'poster': '포스터',
        'goods': '굿즈', 'sticker': '스티커', 'banner': '배너',
        'paper_stand': '종이매대',
    };
    function getCategoryLabel(code) {
        if (!code) return '';
        const lang = getLang();
        const kr = CATEGORY_LABELS_KR[code] || '';
        if (lang === 'ja') {
            return ({'paper_display':'紙陳列棚', 'honeycomb_board':'ハニカムボード',
                    'business_card':'名刺', 'leaflet':'チラシ', 'poster':'ポスター',
                    'goods':'グッズ', 'sticker':'ステッカー', 'banner':'バナー',
                    'paper_stand':'紙陳列棚'}[code]) || kr;
        }
        if (lang === 'en') {
            return ({'paper_display':'Paper display', 'honeycomb_board':'Honeycomb board',
                    'business_card':'Business card', 'leaflet':'Leaflet', 'poster':'Poster',
                    'goods':'Goods', 'sticker':'Sticker', 'banner':'Banner',
                    'paper_stand':'Paper display'}[code]) || kr;
        }
        return kr;
    }

    window._soBackToCategory = function() {
        const p = state.product;
        if (!p || !p.category) {
            window.closeSimpleOrderModal();
            return;
        }
        // 카테고리 페이지로 — 메인 페이지 + category 파라미터
        location.href = '/?category=' + encodeURIComponent(p.category);
    };

    // ─────────────────────────────────────────────
    // 자동 라우팅 (일반 상품 → 간편 모달)
    // ─────────────────────────────────────────────
    function isComplexProduct(code, product) {
        if (window.__SO_ROUTE_ALL_OFF) return true;
        if (!code) return false;
        const c = String(code).toUpperCase();
        if (/^HW\d+/.test(c)) return true;
        if (/^(HD|HB|HY|HP|HR|HT|HS|GB|GW)/.test(c)) return true;
        if (c.startsWith('DESIGN_FEE') || c.startsWith('UA_')) return true;
        if (product) {
            const cat = String(product.category || '').toLowerCase();
            if (cat === 'honeycomb_wall' || cat === 'wall' || cat === 'banner') return true;
        }
        return false;
    }

    function setupRouting(retries) {
        retries = retries || 0;
        if (typeof window.showChoiceModal !== 'function') {
            if (retries < 50) setTimeout(() => setupRouting(retries + 1), 100);
            return;
        }
        if (window.__SO_WRAPPED) return;
        window.__SO_WRAPPED = true;
        const _orig = window.showChoiceModal;
        window._origShowChoiceModal = _orig;
        window.showChoiceModal = function(key) {
            const prod = window.PRODUCT_DB ? window.PRODUCT_DB[key] : null;
            if (isComplexProduct(key, prod)) return _orig.apply(this, arguments);
            return window.openSimpleOrderModal(key, prod);
        };
        console.log('[simple_order] showChoiceModal 래핑 완료 — 일반 상품은 간편모달로 자동 라우팅 (해제: window.__SO_ROUTE_ALL_OFF=true 후 새로고침)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles(); injectModal(); setupRouting();
        });
    } else {
        injectStyles(); injectModal(); setupRouting();
    }

    console.log('[simple_order] v=7 (actual file size detection for frame/ruler) loaded.');
})();
