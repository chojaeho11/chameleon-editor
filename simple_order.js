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

    let state = { product: null, file: null, fileBack: null, thumbDataUrl: null, thumbDataUrlBack: null, qty: 1 };

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

    // 2026-05-13: 통화 변환 — 1000원 기준 ja:100엔 / en,es,de,fr:1$/€ / zh:5위안 / ar:1리얄
    function fmtPrice(amt) {
        const lang = getLang();
        const v = Math.max(0, Math.round(amt || 0));
        if (lang === 'ja') return '¥' + Math.round(v * 0.1).toLocaleString();
        if (lang === 'en') {
            const usd = v * 0.001;
            return usd >= 10 ? '$' + Math.round(usd).toLocaleString() : '$' + usd.toFixed(2);
        }
        if (lang === 'es' || lang === 'de' || lang === 'fr') {
            const eur = v * 0.001;
            return eur >= 10 ? '€' + Math.round(eur).toLocaleString() : '€' + eur.toFixed(2);
        }
        if (lang === 'zh') return '¥' + Math.round(v * 0.005).toLocaleString();
        if (lang === 'ar') {
            const sar = v * 0.003;
            return sar >= 10 ? Math.round(sar).toLocaleString() + ' ر.س' : sar.toFixed(2) + ' ر.س';
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
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 90000;
    display: none; opacity: 0; transition: opacity 0.25s;
}
.so-cart-drawer-overlay.open { display: block; opacity: 1; }
.so-cart-drawer {
    position: fixed; right: 0; top: 0; height: 100%; width: 440px;
    max-width: 100%; background: #fff; z-index: 90001;
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

/* 2026-05-13: 스크롤바 매우 연한 하늘색 */
.so-cart-body::-webkit-scrollbar,
.so-right::-webkit-scrollbar,
.so-left::-webkit-scrollbar,
.so-modal::-webkit-scrollbar,
.so-overlay::-webkit-scrollbar {
    width: 10px; height: 10px;
}
.so-cart-body::-webkit-scrollbar-track,
.so-right::-webkit-scrollbar-track,
.so-left::-webkit-scrollbar-track,
.so-modal::-webkit-scrollbar-track,
.so-overlay::-webkit-scrollbar-track {
    background: #f0f9ff;
}
.so-cart-body::-webkit-scrollbar-thumb,
.so-right::-webkit-scrollbar-thumb,
.so-left::-webkit-scrollbar-thumb,
.so-modal::-webkit-scrollbar-thumb,
.so-overlay::-webkit-scrollbar-thumb {
    background: #bfdbfe; border-radius: 8px; border: 2px solid #f0f9ff;
}
.so-cart-body::-webkit-scrollbar-thumb:hover,
.so-right::-webkit-scrollbar-thumb:hover,
.so-left::-webkit-scrollbar-thumb:hover,
.so-modal::-webkit-scrollbar-thumb:hover,
.so-overlay::-webkit-scrollbar-thumb:hover {
    background: #93c5fd;
}
/* Firefox */
.so-cart-body, .so-right, .so-left, .so-modal, .so-overlay {
    scrollbar-color: #bfdbfe #f0f9ff;
    scrollbar-width: thin;
}
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

/* 2026-05-13: 시공/배송 버튼형 옵션 */
.so-ship-btn {
    padding: 14px 10px; border: 2px solid #e7e5e4; border-radius: 10px;
    background: #fff; color: #451a03; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: all 0.15s; text-align: center; line-height: 1.4;
    font-family: inherit;
}
.so-ship-btn:hover { background: #faf6ed; border-color: #d4b896; }
.so-ship-btn.active {
    background: #4338ca; border-color: #4338ca; color: #fff;
    box-shadow: 0 4px 12px rgba(67, 56, 202, 0.25);
}
.so-wall-info-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 50px;
    background: #fff7e6; color: #b35900; font-size: 12px; font-weight: 700;
    border: 1px solid #ffd18f; white-space: nowrap;
}

/* 2026-05-12: 빠른 결제 모달 (패브릭과 동일 스타일) */
.so-co-overlay {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7);
    z-index: 60000; display: none; align-items: center; justify-content: center;
    padding: 20px;
}
.so-co-overlay.open { display: flex !important; }
.so-co-card {
    width: 100%; max-width: 960px; height: 100%; max-height: 720px;
    background: #fff; border-radius: 16px; display: flex; overflow: hidden;
    box-shadow: 0 25px 60px rgba(0,0,0,0.35); position: relative;
}
.so-co-close {
    position: absolute; top: 12px; right: 14px; width: 36px; height: 36px;
    background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 50%;
    font-size: 20px; cursor: pointer; z-index: 1; line-height: 1;
}
.so-co-form {
    flex: 1; padding: 30px 35px; overflow-y: auto; background: #fff;
}
.so-co-section { margin-bottom: 16px; }
.so-co-label {
    display: block; font-size: 12px; font-weight: 800; color: #451a03;
    margin-bottom: 6px;
}
.so-co-input {
    width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 14px; box-sizing: border-box; transition: border-color 0.15s;
}
.so-co-input:focus { outline: none; border-color: #f59e0b; }
.so-co-row { display: flex; gap: 8px; }
.so-co-row > .so-co-input { flex: 1; }
.so-co-pay-opts { display: flex; flex-direction: column; gap: 6px; }
.so-co-pay-opt {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px;
    border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 600; transition: all 0.15s;
}
.so-co-pay-opt:has(input:checked) { border-color: #f59e0b; background: #fef3c7; }
.so-co-summary {
    width: 320px; padding: 24px 20px; background: #faf6ed;
    display: flex; flex-direction: column; border-left: 1px solid #e7e5e4;
}
.so-co-summary-item {
    background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px;
    font-size: 12px;
}
.so-co-summary-item-name { font-weight: 700; color: #451a03; margin-bottom: 4px; }
.so-co-summary-item-opts { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
.so-co-summary-item-price { font-weight: 800; color: #dc2626; text-align: right; }
.so-co-total {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 0; border-top: 2px solid #d6d3d1; margin-bottom: 10px;
}
.so-co-total-amt { font-size: 22px; font-weight: 900; color: #dc2626; }
.so-co-submit-btn {
    width: 100%; padding: 14px; background: #451a03; color: #fde047;
    border: none; border-radius: 10px; font-size: 15px; font-weight: 800;
    cursor: pointer; transition: all 0.15s;
}
.so-co-submit-btn:hover { background: #78350f; }
.so-co-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
    .so-co-card { flex-direction: column; max-height: 95vh; }
    .so-co-summary { width: 100%; border-left: none; border-top: 1px solid #e7e5e4; }
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

    <!-- 2026-05-13: 자체 카테고리 nav 제거 — 메인 페이지의 #topCatMenu (z-index 60000) 가 위에서 표시됨 -->
    <!-- simple_order 본문이 메인 nav 와 안 겹치도록 상단 padding 약간 확보 -->
    <div style="height:46px; flex-shrink:0;"></div>

    <div class="so-body">
      <!-- 좌측: 큰 파일 업로드 -->
      <div class="so-left">
        <div class="so-prod-banner">
          <img id="soImg" class="so-prod-img" alt="" />
          <div class="so-prod-meta">
            <div id="soName" class="so-prod-name">-</div>
            <div id="soDesc" class="so-prod-desc"></div>
            <!-- 2026-05-13: 가벽 상품 전용 안내 (버튼 형태) — 일반 설명 대신 표시 -->
            <div id="soWallGuide" style="display:none; margin-top:10px;">
              <div id="soWallGuideChips" style="display:flex; flex-wrap:wrap; gap:6px;">
                <span class="so-wall-info-btn">📐 ${tr('가로 1m 단위', '横 1m単位', 'Width per 1m')}</span>
                <span class="so-wall-info-btn" id="soWallChipHeight">📏 ${tr('세로 2 · 2.2 · 2.4 · 3m', '縦 2/2.2/2.4/3m', 'Height 2/2.2/2.4/3m')}</span>
                <span class="so-wall-info-btn">🎨 ${tr('작업은 1/10 사이즈', 'デザイン1/10サイズ', '1/10 scale design')}</span>
                <span class="so-wall-info-btn">📄 ${tr('파일은 PDF로', 'PDFファイルで', 'PDF file please')}</span>
              </div>
              <div id="soWallGuideText" style="font-size:12px; color:#451a03; margin-top:10px; line-height:1.6; background:#faf6ed; padding:10px 12px; border-radius:8px; border-left:3px solid #b35900;">
                <span id="soWallGuideRange">${tr('허니콤 가벽은 가로 1m 단위로 제작됩니다. 가로 길이는 1m부터 8m까지 선택 가능하며, 세로는 2m / 2.2m / 2.4m / 3m 중 선택하실 수 있습니다.', 'ハニカム壁は横1m単位で製作されます。横は1m〜8m、縦は2/2.2/2.4/3mから選択。', 'Honeycomb walls are produced in 1m width units. Width 1m-8m, height 2/2.2/2.4/3m.')}</span><br><br>
                <b>${tr('🎨 디자인 작업', 'デザイン', 'Design')}:</b> ${tr('실제 사이즈의 1/10로 작업해주세요. 예: 3m × 2.4m 가벽 → 30cm × 24cm 작업.', '実サイズの1/10で作業。例：3m×2.4m → 30cm×24cm。', 'Work at 1/10 of actual size. e.g., 3m × 2.4m wall → 30cm × 24cm.')}<br>
                <b>${tr('📄 파일 형식', 'ファイル形式', 'Format')}:</b> ${tr('PDF 권장 (인쇄 품질 최상). PNG/JPG 도 가능.', 'PDF推奨。PNG/JPGも可。', 'PDF recommended. PNG/JPG also OK.')}
              </div>
            </div>
          </div>
        </div>

        <!-- 2026-05-14: 칼선 도안 제공 안내 + 다운로드 (admin_products.cutline_url 있을 때만 표시) -->
        <div id="soCutlineDownload" style="display:none; margin-bottom:14px; padding:14px 16px; background:linear-gradient(135deg,#fef9e7 0%,#fed7aa 100%); border:1.5px solid #fbbf24; border-radius:14px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:26px;">✂️</span>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:800; color:#78350f; font-size:13px;">${tr('칼선 도안 제공', '型抜きテンプレート提供', 'Die-cut template available')}</div>
              <div style="font-size:11px; color:#92400e; margin-top:2px;">${tr('이 제품 전용 칼선 템플릿을 다운받아 디자인에 맞춰주세요.', 'この商品専用の型抜きテンプレートをダウンロードしてデザインしてください。', 'Download the die-cut template for this product to align your design.')}</div>
            </div>
            <a id="soCutlineDownloadBtn" href="#" download target="_blank" rel="noopener" style="flex-shrink:0; padding:10px 16px; background:linear-gradient(135deg,#b45309 0%,#78350f 100%); color:#fde047; border-radius:999px; font-size:12px; font-weight:800; text-decoration:none; box-shadow:0 4px 12px rgba(120,53,15,0.3); white-space:nowrap;">
              <i class="fa-solid fa-download"></i> ${tr('칼선 다운받기', 'ダウンロード', 'Download')}
            </a>
          </div>
        </div>

        <div class="so-upload-section-label" id="soUploadLabel">${tr('📤 디자인 파일 업로드', '📤 デザインファイルをアップロード', '📤 Upload design file')}</div>
        <div id="soUpload" class="so-upload" onclick="document.getElementById('soFile').click()">
          <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />
          <div class="so-upload-icon">📤</div>
          <div class="so-upload-title" id="soUploadTitle">${tr('이미지를 올려주세요', '画像をアップロード', 'Upload your file')}</div>
          <div class="so-upload-hint">${tr('여기를 클릭하거나 파일을 끌어다 놓으세요', 'クリックまたはドラッグ&ドロップ', 'Click or drag & drop')}</div>
          <div class="so-upload-formats">${tr('PDF · PNG · JPG · 10MB 이하', 'PDF・PNG・JPG・10MB以下', 'PDF / PNG / JPG · max 10MB')}</div>
        </div>

        <!-- 2026-05-13: 양면 선택 시 뒷면 파일 업로드 영역 (가벽 양면만) -->
        <div id="soBackUploadWrap" style="display:none; margin-top:20px; padding:14px; background:#ede9fe; border:2px solid #7c3aed; border-radius:14px;">
          <div class="so-upload-section-label" style="color:#5b21b6; font-weight:800;">📤 ${tr('뒷면 디자인 파일 업로드', '裏面デザインファイル', 'Upload BACK side design file')}</div>
          <div id="soBackUpload" class="so-upload" onclick="document.getElementById('soBackFile').click()" style="background:#fff; max-width:none;">
            <input type="file" id="soBackFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" onchange="window._soOnBackFileChange(this.files)" style="display:none" />
            <div class="so-upload-icon" style="color:#7c3aed;">📤</div>
            <div class="so-upload-title">${tr('뒷면 이미지를 올려주세요', '裏面画像をアップロード', 'Upload back side')}</div>
            <div class="so-upload-hint">${tr('여기를 클릭하거나 파일을 끌어다 놓으세요', 'クリックまたはドラッグ&ドロップ', 'Click or drag & drop')}</div>
            <div class="so-upload-formats">${tr('PDF · PNG · JPG · 10MB 이하', 'PDF・PNG・JPG・10MB以下', 'PDF / PNG / JPG · max 10MB')}</div>
          </div>
        </div>
      </div>

      <!-- 우측: 옵션 + 가격 + 버튼 -->
      <div class="so-right">
        <div class="so-section" id="soQtySection">
          <div class="so-section-title">${tr('주문 수량', '注文数量', 'Quantity')}</div>
          <div class="so-qty-row">
            <button class="so-qty-btn" onclick="window._soQtyChg(-1)">−</button>
            <input type="number" id="soQty" class="so-qty-input" value="1" min="1" max="9999" oninput="window._soOnQtyInput()" />
            <button class="so-qty-btn" onclick="window._soQtyChg(1)">+</button>
            <span class="so-qty-unit">${tr('개', '個', 'pcs')}</span>
          </div>
          <!-- 2026-05-13: 수량 할인 제거 → 구매금액 할인으로 교체 -->
          <div class="so-tier-table" id="soTierTable">
            <div data-amt-tier="10"><b>${fmtPrice(1000000)}+</b> 10%</div>
            <div data-amt-tier="20"><b>${fmtPrice(5000000)}+</b> 20%</div>
            <div data-amt-tier="30"><b>${fmtPrice(10000000)}+</b> 30%</div>
            <div style="background:#ede9fe; color:#5b21b6; font-weight:800;">${tr('PRO 구독자', 'PRO会員', 'PRO')} 10%</div>
          </div>
        </div>

        <!-- 2026-05-13: 가벽 카테고리 전용 사이즈 입력 (가로 m 단위). 안내는 좌측 #soWallGuide 로 이동 -->
        <div class="so-section" id="soWallSizeSection" style="display:none;">
          <div class="so-section-title">${tr('가벽 사이즈', '壁面サイズ', 'Wall size')}</div>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('가로', '横', 'Width')}</label>
            <select id="soWallWidth" class="so-input" onchange="window._soUpdateAddonQty(); window._soUpdatePrice();" style="flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px;">
              <option value="1">1 m</option>
              <option value="2">2 m</option>
              <option value="3" selected>3 m</option>
              <option value="4">4 m</option>
              <option value="5">5 m</option>
              <option value="6">6 m</option>
              <option value="7">7 m</option>
              <option value="8">8 m</option>
            </select>
          </div>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
            <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('세로', '縦', 'Height')}</label>
            <select id="soWallHeight" class="so-input" onchange="window._soUpdatePrice();" style="flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px;">
              <option value="2">2 m</option>
              <option value="2.2">2.2 m</option>
              <option value="2.4" selected>2.4 m</option>
              <option value="3">3 m</option>
            </select>
          </div>
          <!-- 2026-05-13: 단면 / 양면 선택 (2026-05-14: 일부 가벽 변종은 숨김 — 허니콤 가벽만 표시) -->
          <div id="soWallSideRow" style="display:flex; gap:8px; align-items:center;">
            <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('인쇄면', '印刷面', 'Side')}</label>
            <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              <button type="button" class="so-side-btn active" data-side="single" onclick="window._soPickSide('single')" style="padding:8px 10px; border:2px solid #4338ca; background:#4338ca; color:#fff; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit;">${tr('단면', '片面', 'Single')}</button>
              <button type="button" class="so-side-btn" data-side="double" onclick="window._soPickSide('double')" style="padding:8px 10px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit;">${tr('양면', '両面', 'Double')}</button>
            </div>
          </div>
        </div>

        <!-- 2026-05-13: 허니콤 자유인쇄커팅 사이즈 (한판/반판) -->
        <div class="so-section" id="soCutPrintSizeSection" style="display:none;">
          <div class="so-section-title">${tr('재단 사이즈', 'カットサイズ', 'Cut size')}</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button type="button" class="so-cut-btn active" data-cut="full" onclick="window._soPickCutSize('full')"
              style="padding:14px 10px; border:2px solid #4338ca; background:#4338ca; color:#fff; border-radius:8px; cursor:pointer; font-size:13px; font-weight:800; font-family:inherit; line-height:1.4;">
              ${tr('한판', 'フル', 'Full')}<br>
              <span style="font-size:11px; font-weight:600; opacity:0.9;">2400 × 1200</span><br>
              <span style="font-size:13px; font-weight:800;">${fmtPrice(150000)}</span>
            </button>
            <button type="button" class="so-cut-btn" data-cut="half" onclick="window._soPickCutSize('half')"
              style="padding:14px 10px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:13px; font-weight:800; font-family:inherit; line-height:1.4;">
              ${tr('반판 이내', 'ハーフ以内', 'Half or less')}<br>
              <span style="font-size:11px; font-weight:600; color:#6b7280;">1200×1200 / 600×2400</span><br>
              <span style="font-size:13px; font-weight:800;">${fmtPrice(100000)}</span>
            </button>
          </div>
        </div>

        <!-- 2026-05-13: 허니콤 박스 사이즈 입력 (가로×세로×높이 mm → 자동 단가 계산) -->
        <div class="so-section" id="soBoxSizeSection" style="display:none;">
          <div class="so-section-title">📦 ${tr('박스 사이즈 입력', 'ボックスサイズ入力', 'Box Size')} <span style="font-size:10px; color:#94a3b8; font-weight:400;">(mm)</span></div>
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
            <div style="flex:1; text-align:center;">
              <div style="font-size:10px; color:#64748b; font-weight:700; margin-bottom:3px;">${tr('가로 (W)', '幅 (W)', 'Width (W)')}</div>
              <input type="number" id="soBoxW" value="400" min="50" max="1200" oninput="window._soOnBoxDimsChange()"
                style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:800; text-align:center; box-sizing:border-box;">
            </div>
            <span style="color:#94a3b8; font-weight:bold; margin-top:14px;">×</span>
            <div style="flex:1; text-align:center;">
              <div style="font-size:10px; color:#64748b; font-weight:700; margin-bottom:3px;">${tr('높이 (H)', '高さ (H)', 'Height (H)')}</div>
              <input type="number" id="soBoxH" value="400" min="50" max="1200" oninput="window._soOnBoxDimsChange()"
                style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:800; text-align:center; box-sizing:border-box;">
            </div>
            <span style="color:#94a3b8; font-weight:bold; margin-top:14px;">×</span>
            <div style="flex:1; text-align:center;">
              <div style="font-size:10px; color:#64748b; font-weight:700; margin-bottom:3px;">${tr('깊이 (D)', '奥行 (D)', 'Depth (D)')}</div>
              <input type="number" id="soBoxD" value="400" min="50" max="1200" oninput="window._soOnBoxDimsChange()"
                style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:800; text-align:center; box-sizing:border-box;">
            </div>
          </div>
          <div id="soBoxCalcResult" style="margin-top:10px; padding:10px 12px; background:linear-gradient(135deg,#eef2ff,#f5f3ff); border:1.5px solid #c7d2fe; border-radius:10px; text-align:center;">
            <div style="font-size:11px; color:#6366f1; font-weight:700; margin-bottom:4px;">💰 ${tr('박스 단가', 'ボックス単価', 'Box unit price')}</div>
            <div id="soBoxUnitPrice" style="font-size:20px; font-weight:900; color:#1e1b4b;">-</div>
            <div id="soBoxSheetInfo" style="font-size:10px; color:#64748b; margin-top:4px;"></div>
          </div>
        </div>

        <!-- 2026-05-13: 사이즈 입력 → 면적 × 단가 자동계산 (현수막·실사출력 등) -->
        <div class="so-section" id="soCustomSizeSection" style="display:none;">
          <div class="so-section-title">📐 ${tr('사이즈 입력', 'サイズ入力', 'Size Input')} <span style="font-size:10px; color:#94a3b8; font-weight:400;">(cm)</span></div>
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
            <div style="flex:1; text-align:center;">
              <div style="font-size:10px; color:#64748b; font-weight:700; margin-bottom:3px;">${tr('가로 (W)', '横 (W)', 'Width (W)')}</div>
              <input type="number" id="soCustomW" value="100" min="10" max="2000" oninput="window._soOnCustomDimsChange()"
                style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:800; text-align:center; box-sizing:border-box;">
            </div>
            <span style="color:#94a3b8; font-weight:bold; margin-top:14px;">×</span>
            <div style="flex:1; text-align:center;">
              <div style="font-size:10px; color:#64748b; font-weight:700; margin-bottom:3px;">${tr('세로 (H)', '縦 (H)', 'Height (H)')}</div>
              <input type="number" id="soCustomH" value="60" min="10" max="2000" oninput="window._soOnCustomDimsChange()"
                style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:800; text-align:center; box-sizing:border-box;">
            </div>
          </div>
          <div id="soCustomCalcResult" style="margin-top:10px; padding:10px 12px; background:linear-gradient(135deg,#fef3c7,#fde68a); border:1.5px solid #fbbf24; border-radius:10px; text-align:center;">
            <div style="font-size:11px; color:#92400e; font-weight:700; margin-bottom:4px;">💰 ${tr('단가 (면적 × 단가)', '単価 (面積 × 単価)', 'Unit price (area × rate)')}</div>
            <div id="soCustomUnitPrice" style="font-size:20px; font-weight:900; color:#451a03;">-</div>
            <div id="soCustomAreaInfo" style="font-size:10px; color:#92400e; margin-top:4px;"></div>
          </div>
        </div>

        <!-- 2026-05-13: 받침대 옵션 (등신대 + 자유인쇄커팅) -->
        <div class="so-section" id="soBaseStandSection" style="display:none;">
          <div class="so-section-title">🦵 ${tr('받침대 옵션', 'スタンドオプション', 'Stand option')}</div>
          <div id="soBaseStandList" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" class="so-base-btn active" data-base="none" onclick="window._soPickBaseStand('none')"
              style="padding:10px 8px; border:2px solid #4338ca; background:#4338ca; color:#fff; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4;">${tr('받침대 없음', 'なし', 'No stand')}<br><span style="font-size:11px; font-weight:600; opacity:0.9;">${fmtPrice(0)}</span></button>
            <button type="button" class="so-base-btn" data-base="a4" onclick="window._soPickBaseStand('a4')"
              style="padding:10px 8px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4;">${tr('A4 이하용 받침대', 'A4以下スタンド', 'A4 stand')}<br><span style="font-size:11px; font-weight:600; color:#6b7280;">+${fmtPrice(3000)}</span></button>
            <button type="button" class="so-base-btn" data-base="a3" onclick="window._soPickBaseStand('a3')"
              style="padding:10px 8px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4;">${tr('A3 이하용 받침대', 'A3以下スタンド', 'A3 stand')}<br><span style="font-size:11px; font-weight:600; color:#6b7280;">+${fmtPrice(5000)}</span></button>
            <button type="button" class="so-base-btn" data-base="a2" onclick="window._soPickBaseStand('a2')"
              style="padding:10px 8px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4;">${tr('A2 이하용 받침대', 'A2以下スタンド', 'A2 stand')}<br><span style="font-size:11px; font-weight:600; color:#6b7280;">+${fmtPrice(10000)}</span></button>
            <button type="button" class="so-base-btn" data-base="rear" onclick="window._soPickBaseStand('rear')"
              style="padding:10px 8px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4;">${tr('등신대용 후면받침', '等身大 背面支持', 'Life-size rear')}<br><span style="font-size:11px; font-weight:600; color:#6b7280;">+${fmtPrice(20000)}</span></button>
            <button type="button" class="so-base-btn" data-base="banner_small" onclick="window._soPickBaseStand('banner_small')"
              style="padding:10px 8px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4;">${tr('배너형 (가로 ≤60cm)', 'バナー型 ≤60cm', 'Banner ≤60cm')}<br><span style="font-size:11px; font-weight:600; color:#6b7280;">+${fmtPrice(20000)}</span></button>
            <button type="button" class="so-base-btn" data-base="banner_large" onclick="window._soPickBaseStand('banner_large')"
              style="padding:10px 8px; border:2px solid #e7e5e4; background:#fff; color:#451a03; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; line-height:1.4; grid-column:span 2;">${tr('배너형 (가로 ≥70cm)', 'バナー型 ≥70cm', 'Banner ≥70cm')}<br><span style="font-size:11px; font-weight:600; color:#6b7280;">+${fmtPrice(50000)}</span></button>
          </div>
        </div>

        <!-- 2026-05-13: 상품별 추가 옵션 (admin_addons) -->
        <div class="so-section" id="soAddonSection" style="display:none;">
          <div class="so-section-title">${tr('추가 옵션', '追加オプション', 'Add-ons')}</div>
          <div id="soAddonList" style="display:flex; flex-direction:column; gap:6px;"></div>
        </div>

        <!-- 2026-05-13: 시공/배송 일정 (가벽·포토존 카테고리만) — 버튼형 디자인 + 가격 자동 breakdown -->
        <div class="so-section" id="soScheduleSection" style="display:none;">
          <div class="so-section-title">${tr('시공/배송 옵션', '施工/配送オプション', 'Install/Delivery')}</div>
          <!-- 배송 옵션 (버튼형 — 가격 라벨 없이 깔끔하게) -->
          <div id="soShipBtnGrid" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
            <button type="button" class="so-ship-btn" data-ship="self_pickup" onclick="window._soPickShip('self_pickup')">🏪 ${tr('본사 방문 수령', '本社受取', 'HQ pickup')}</button>
            <button type="button" class="so-ship-btn" data-ship="metro_install" onclick="window._soPickShip('metro_install')">🚚 ${tr('수도권 설치', '首都圏設置', 'Metro install')}</button>
            <button type="button" class="so-ship-btn" data-ship="metro_weekend" onclick="window._soPickShip('metro_weekend')">🌙 ${tr('수도권 야간/주말 설치', '首都圏夜間/週末', 'Metro night/wkd')}</button>
            <button type="button" class="so-ship-btn" data-ship="metro_install_removal" onclick="window._soPickShip('metro_install_removal')">🔧 ${tr('수도권 설치+철거', '首都圏設置+撤去', 'Metro install+remove')}</button>
            <button type="button" class="so-ship-btn" data-ship="regional_truck" onclick="window._soPickShip('regional_truck')">🛻 ${tr('지방 용차배송', '地方トラック', 'Regional truck')}</button>
            <button type="button" class="so-ship-btn" data-ship="regional_install" onclick="window._soPickShip('regional_install')">🚛 ${tr('지방 설치배송', '地方設置配送', 'Regional install')}</button>
            <!-- 2026-05-13: 자유인쇄커팅 전용 (시공 없이 배송만) -->
            <button type="button" class="so-ship-btn" data-ship="metro_delivery" onclick="window._soPickShip('metro_delivery')" style="display:none;">📦 ${tr('수도권 배송', '首都圏配送', 'Metro delivery')}<br><span style="font-size:11px; opacity:0.8;">${fmtPrice(100000)}</span></button>
            <button type="button" class="so-ship-btn" data-ship="regional_delivery" onclick="window._soPickShip('regional_delivery')" style="display:none;">📦 ${tr('지방 배송', '地方配送', 'Regional delivery')}<br><span style="font-size:11px; opacity:0.8;">${fmtPrice(200000)}</span></button>
            <!-- 2026-05-13: 택배배송 (배너·인스타판넬만, 2장 묶음 3만원) -->
            <button type="button" class="so-ship-btn" data-ship="parcel_shipping" onclick="window._soPickShip('parcel_shipping')" style="display:none;">📮 ${tr('택배배송', '宅配便', 'Parcel')}<br><span style="font-size:11px; opacity:0.8;">${fmtPrice(30000)} / ${tr('2장 묶음', '2枚まとめ', '2 per box')}</span></button>
            <!-- 2026-05-13: 포맥스·폼보드 대형택배 (3만원) -->
            <button type="button" class="so-ship-btn" data-ship="large_parcel" onclick="window._soPickShip('large_parcel')" style="display:none;">📦 ${tr('대형택배', '大型宅配', 'Large parcel')}<br><span style="font-size:11px; opacity:0.8;">${fmtPrice(30000)}</span></button>
            <!-- 2026-05-13: 일반 인쇄물 소형 묶음택배 (5천원) -->
            <button type="button" class="so-ship-btn" data-ship="small_parcel" onclick="window._soPickShip('small_parcel')" style="display:none;">📨 ${tr('묶음 소형택배', '小型宅配', 'Small parcel')}<br><span style="font-size:11px; opacity:0.8;">${fmtPrice(5000)}</span></button>
            <!-- 2026-05-13: 등신대·자유인쇄커팅 컴팩트 택배 (60×40 이하, 1만원) -->
            <button type="button" class="so-ship-btn" data-ship="compact_parcel" onclick="window._soPickShip('compact_parcel')" style="display:none;">📬 ${tr('택배배송 (60×40 이하)', '宅配 ≤60×40', 'Parcel ≤60×40')}<br><span style="font-size:11px; opacity:0.8;">${fmtPrice(10000)}</span></button>
          </div>
          <!-- 2026-05-13: 다른 제품과 묶음배송 토글 (잘보이는 큰 버튼) -->
          <button type="button" id="soBundleShipBtn" onclick="window._soToggleBundle()"
            style="display:none; width:100%; padding:12px 14px; margin-bottom:12px; border:2px dashed #16a34a; background:#f0fdf4; color:#15803d; border-radius:10px; cursor:pointer; font-size:13px; font-weight:800; font-family:inherit; transition:all 0.2s;">
            📦 ${tr('다른 제품과 묶음배송', '他の商品と合わせて配送', 'Bundle with other items')}
            <div style="font-size:11px; font-weight:600; color:#16a34a; margin-top:4px;">
              ${tr('다른 허니콤 상품에서 배송을 선택한 경우 무료', '他のハニカム商品の配送と一緒', 'Free if another honeycomb item has shipping')}
            </div>
          </button>
          <!-- 배송일 / 시공 시간 -->
          <div id="soScheduleDateWrap" style="display:none;">
            <div style="font-size:11px; color:#6b7280; margin-bottom:6px;">📅 ${tr('영업일 기준 최소 3일 이후부터 선택 가능', '営業日基準で最短3日後から', 'From 3 business days after')}</div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
              <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('배송 희망일', '配送希望日', 'Delivery date')}</label>
              <input type="date" id="soScheduleDate" onchange="window._soUpdateShipBreakdown()" style="flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
              <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('배송 시간', '配送時間', 'Time')}</label>
              <select id="soScheduleTime" onchange="window._soUpdateShipBreakdown()" style="flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
                <option value="">${tr('시간 선택', '時間選択', 'Select')}</option>
                <option value="am">🌅 ${tr('오전 (08-12)', '午前 (08-12)', 'AM (08-12)')}</option>
                <option value="pm">☀️ ${tr('오후 (12-18)', '午後 (12-18)', 'PM (12-18)')}</option>
                <option value="night">🌙 ${tr('야간 (18-22)', '夜間 (18-22)', 'Night (18-22)')}</option>
                <option value="any">📅 ${tr('시간 상관없음', '時間指定なし', 'Any time')}</option>
              </select>
            </div>
            <!-- 철거 일정 (수도권 설치+철거 선택 시만) -->
            <div id="soRemovalWrap" style="display:none; background:#fef3c7; border:1px solid #fbbf24; border-radius:8px; padding:10px; margin-bottom:10px;">
              <div style="font-size:11px; color:#92400e; font-weight:700; margin-bottom:6px;">🔧 ${tr('철거 일정 (야간만 가능)', '撤去日程 (夜間のみ)', 'Removal (night only)')}</div>
              <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('철거 희망일', '撤去希望日', 'Date')}</label>
                <input type="date" id="soRemovalDate" onchange="window._soUpdateShipBreakdown()" style="flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <label style="flex:1; font-size:12px; color:#451a03; font-weight:700;">${tr('철거 시간', '撤去時間', 'Time')}</label>
                <select id="soRemovalTime" onchange="window._soUpdateShipBreakdown()" style="flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
                  <option value="">${tr('시간 선택', '時間選択', 'Select')}</option>
                  <option value="night">🌙 ${tr('야간 (18-22)', '夜間 (18-22)', 'Night (18-22)')}</option>
                  <option value="any">📅 ${tr('시간 상관없음', '時間指定なし', 'Any time')}</option>
                </select>
              </div>
            </div>
            <!-- 가격 breakdown 자동 표시 -->
            <div id="soShipBreakdown" style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:10px 12px; font-size:12px; color:#3730a3; line-height:1.7;"></div>
          </div>
        </div>

        <!-- 2026-05-13: 전달사항 (제작 요청사항) -->
        <div class="so-section">
          <div class="so-section-title">${tr('전달사항 (선택)', '備考 (任意)', 'Notes (optional)')}</div>
          <textarea id="soItemNote" placeholder="${tr('예: 색상 강조, 특정 부분 수정 요청 등', '例：色の強調、特定部分の修正要望など', 'e.g., emphasize color, request specific changes')}" rows="3"
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; font-family:inherit; resize:vertical; box-sizing:border-box;"></textarea>
        </div>

        <div class="so-section so-price-box">
          <div class="so-section-title">${tr('가격', '価格', 'Price')}</div>
          <div class="so-price-row"><span id="soUnitLabel">${tr('단가', '単価', 'Unit')}</span><span id="soUnit">-</span></div>
          <!-- 가벽 사이즈 라인 (가벽 상품만) -->
          <div class="so-price-row" id="soWallSizeRow" style="display:none;"><span>${tr('가벽 사이즈', '壁面サイズ', 'Wall')}</span><span id="soWallSizeText">-</span></div>
          <!-- 옵션별 라인 (동적) -->
          <div id="soAddonBreakdown"></div>
          <!-- 2026-05-13: 구매금액 할인 (100만 10% / 500만 20% / 1000만 30%) -->
          <div class="so-price-row discount" id="soAmountDiscRow" style="display:none;"><span>${tr('구매금액 할인', '購入金額割引', 'Volume disc')} <span class="so-tier-tag" id="soAmountTier">10%</span></span><span id="soAmountDisc">-0원</span></div>
          <!-- 구독자 할인 (PRO 회원, 중복 가능) -->
          <div class="so-price-row discount" id="soProDiscRow" style="display:none;"><span>${tr('PRO 구독자 할인', 'PRO会員割引', 'PRO discount')} <span class="so-tier-tag" style="background:#7c3aed; color:#fff;">10%</span></span><span id="soProDisc">-0원</span></div>
          <!-- 배송/시공 라인 -->
          <div class="so-price-row" id="soShipRow" style="display:none;"><span id="soShipLabel">${tr('배송/시공', '配送', 'Shipping')}</span><span id="soShipAmount">-</span></div>
          <div class="so-price-row total"><span>${tr('합계', '合計', 'Total')}</span><span id="soTotal">-</span></div>
        </div>

        <div id="soStatus" class="so-status"></div>

        <div class="so-actions">
          <!-- 2026-05-12: 장바구니 보기 버튼 — 담지 않고 현재 카트만 열어보기 -->
          <button class="so-btn" id="soBtnViewCart" onclick="window._soToggleCart(true)" style="background:#fff; color:#92400e; border:2px solid #f59e0b; font-weight:700;">
            👀 ${tr('장바구니 보기', 'カートを見る', 'View cart')}
          </button>
          <button class="so-btn so-btn-cart" id="soBtnCart" onclick="window._soAddCart()" disabled>
            🛒 ${tr('장바구니에 담기', 'カートに追加', 'Add to cart')}
          </button>
          <button class="so-btn so-btn-buy" id="soBtnBuy" onclick="window._soBuyNow()" disabled>
            ⚡ ${tr('바로 주문하기', '今すぐ注文', 'Order now')}
          </button>
        </div>
      </div>
    </div>

    <!-- 2026-05-13: 카트 드로어를 simpleOrderModal 외부로 분리 — stacking context 문제 해결 -->
  </div>
</div>

<!-- 카트 드로어 (우측 슬라이드) — simpleOrderModal 바깥. 메인 nav(60000) 위에 떠야 하므로 별도 stacking context. -->
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

<!-- 2026-05-12: 빠른 결제 모달 (패브릭과 동일한 단순 결제) -->
<!-- 2026-05-12: 모달 전환 시 background 깜빡임 방지용 loading shield -->
<div id="soLoadingShield" style="position:fixed; inset:0; background:#faf6ed; z-index:99999; display:none; align-items:center; justify-content:center; flex-direction:column; gap:14px;">
  <div style="font-size:42px; color:#78350f;"><i class="fa-solid fa-spinner fa-spin"></i></div>
  <div style="font-size:13px; color:#78350f; font-weight:700;">${tr('잠시만 기다려주세요...', 'お待ちください...', 'Please wait...')}</div>
</div>

<div id="soCheckoutOverlay" class="so-co-overlay" style="display:none;">
  <div class="so-co-card">
    <button class="so-co-close" onclick="window._soCloseCheckout()" aria-label="Close">×</button>
    <div class="so-co-form">
      <h3 style="margin:0 0 4px; font-size:22px; font-weight:800; color:#451a03;">${tr('주문 정보 입력', '注文情報入力', 'Order details')}</h3>
      <div class="so-co-sub" style="font-size:13px; color:#6b7280; margin-bottom:20px;">${tr('정확히 입력해주세요.', '正確に入力してください。', 'Please fill in carefully.')}</div>
      <div class="so-co-section">
        <span class="so-co-label">${tr('받으시는 분', 'お受取人', 'Recipient')} <span style="color:#dc2626;">*</span></span>
        <input id="soCoName" class="so-co-input" placeholder="${tr('홍길동', '山田太郎', 'Full name')}">
      </div>
      <div class="so-co-section">
        <span class="so-co-label">${tr('연락처', '連絡先', 'Phone')} <span style="color:#dc2626;">*</span></span>
        <div class="so-co-row">
          <input id="soCoPhone" class="so-co-input" placeholder="010-0000-0000">
          <input id="soCoEmail" class="so-co-input" type="email" placeholder="${tr('이메일 (선택)', 'メール (任意)', 'Email (optional)')}">
        </div>
      </div>
      <div class="so-co-section">
        <span class="so-co-label">${tr('배송지', 'お届け先', 'Shipping address')} <span style="color:#dc2626;">*</span></span>
        <input id="soCoZip" class="so-co-input" placeholder="${tr('우편번호', '郵便番号', 'ZIP')}" style="width:160px; margin-bottom:6px;">
        <input id="soCoAddr1" class="so-co-input" placeholder="${tr('기본 주소', '住所', 'Address line 1')}" style="margin-bottom:6px;">
        <input id="soCoAddr2" class="so-co-input" placeholder="${tr('상세 주소 (동/호수)', '建物名・部屋番号', 'Address line 2')}">
      </div>
      <div class="so-co-section">
        <span class="so-co-label">${tr('배송 메모 (선택)', '配送メモ (任意)', 'Delivery note (optional)')}</span>
        <input id="soCoMemo" class="so-co-input" placeholder="${tr('예: 부재 시 경비실에 맡겨주세요', '例: 不在時は管理人室へ', 'e.g. Leave at front desk if absent')}">
      </div>
      <div class="so-co-section">
        <span class="so-co-label">${tr('결제 방법', 'お支払い方法', 'Payment method')}</span>
        <div class="so-co-pay-opts">
          <label class="so-co-pay-opt"><input type="radio" name="soPayMethod" value="card" checked onchange="window._soOnPayMethodChange()"> 💳 ${tr('카드 결제', 'カード決済', 'Card payment')} <span style="color:#9ca3af; margin-left:auto; font-size:11px;">Toss/Stripe</span></label>
          <label class="so-co-pay-opt"><input type="radio" name="soPayMethod" value="bank" onchange="window._soOnPayMethodChange()"> 🏦 ${tr('무통장 입금', '銀行振込', 'Bank transfer')} <span style="color:#9ca3af; margin-left:auto; font-size:11px;">${tr('즉시 처리', 'すぐ処理', 'Instant')}</span></label>
        </div>
      </div>

      <!-- 2026-05-14: 무통장 입금 — 증빙 서류 선택 (KR 전용, 세금계산서/현금영수증) -->
      <div class="so-co-section" id="soCoReceiptBox">
        <span class="so-co-label">📄 ${tr('증빙 서류 선택 (선택)', '証憑書類選択 (任意)', 'Tax document (optional)')}</span>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
          <label style="cursor:pointer;"><input type="radio" name="soRcptType" value="none" checked onchange="window._soOnReceiptTypeChange()"> ${tr('발행안함', '発行しない', 'None')}</label>
          <label style="cursor:pointer;"><input type="radio" name="soRcptType" value="tax_invoice" onchange="window._soOnReceiptTypeChange()"> ${tr('세금계산서', '税金計算書', 'Tax invoice')}</label>
          <label style="cursor:pointer;"><input type="radio" name="soRcptType" value="cash_receipt_biz" onchange="window._soOnReceiptTypeChange()"> ${tr('현금영수증 (지출증빙)', '現金領収証 (事業)', 'Cash receipt (business)')}</label>
          <label style="cursor:pointer;"><input type="radio" name="soRcptType" value="cash_receipt_personal" onchange="window._soOnReceiptTypeChange()"> ${tr('현금영수증 (개인소득공제)', '現金領収証 (個人)', 'Cash receipt (personal)')}</label>
        </div>
        <!-- 세금계산서 입력 폼 -->
        <div id="soTaxInvoiceFields" style="display:none; margin-top:10px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e7d6b8;">
          <div style="font-weight:800; margin-bottom:8px; color:#78350f; font-size:12px;">${tr('세금계산서 정보', '税金計算書 情報', 'Tax invoice info')}</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div><label style="font-size:11px; color:#6b7280;">${tr('사업자번호', '事業者番号', 'Biz reg no.')} *</label><input type="text" id="soRcptBizNumber" class="so-co-input" placeholder="000-00-00000"></div>
            <div><label style="font-size:11px; color:#6b7280;">${tr('회사명', '会社名', 'Company')} *</label><input type="text" id="soRcptCompany" class="so-co-input" placeholder="${tr('주식회사 예시', '株式会社例', 'ABC Co., Ltd.')}"></div>
            <div><label style="font-size:11px; color:#6b7280;">${tr('대표자명', '代表者名', 'Representative')} *</label><input type="text" id="soRcptRepName" class="so-co-input" placeholder="${tr('홍길동', '山田太郎', 'John Doe')}"></div>
            <div><label style="font-size:11px; color:#6b7280;">${tr('업태', '業態', 'Biz type')}</label><input type="text" id="soRcptBizType" class="so-co-input" placeholder="${tr('서비스', 'サービス', 'Service')}"></div>
            <div><label style="font-size:11px; color:#6b7280;">${tr('종목', '種目', 'Biz category')}</label><input type="text" id="soRcptBizCategory" class="so-co-input" placeholder="${tr('인쇄', '印刷', 'Printing')}"></div>
            <div><label style="font-size:11px; color:#6b7280;">${tr('이메일', 'メール', 'Email')} *</label><input type="email" id="soRcptEmail" class="so-co-input" placeholder="tax@company.com"></div>
          </div>
          <div style="margin-top:8px;"><label style="font-size:11px; color:#6b7280;">${tr('사업장 주소', '事業所住所', 'Biz address')}</label><input type="text" id="soRcptBizAddress" class="so-co-input" placeholder="${tr('서울시 강남구...', '東京都...', 'City, address...')}"></div>
        </div>
        <!-- 현금영수증 입력 폼 -->
        <div id="soCashReceiptFields" style="display:none; margin-top:10px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e7d6b8;">
          <div style="font-weight:800; margin-bottom:8px; color:#78350f; font-size:12px;">${tr('현금영수증 정보', '現金領収証 情報', 'Cash receipt info')}</div>
          <label style="font-size:11px; color:#6b7280;" id="soCashReceiptLabel">${tr('식별번호 (사업자번호 또는 핸드폰번호)', '識別番号', 'ID number')} *</label>
          <input type="text" id="soRcptIdNumber" class="so-co-input" placeholder="000-00-00000 / 010-0000-0000">
        </div>
      </div>

      <!-- 2026-05-14: 견적서 다운로드 (결제 전 미리보기) -->
      <div class="so-co-section">
        <button type="button" onclick="window._soDownloadQuotePreview(this)"
          style="width:100%; padding:12px 16px; background:#fff; color:#78350f; border:2px solid #fbbf24; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit;">
          <i class="fa-solid fa-file-invoice"></i> ${tr('견적서 미리 다운받기', '見積書ダウンロード', 'Download quotation preview')}
        </button>
      </div>
    </div>
    <aside class="so-co-summary">
      <h4 style="margin:0 0 12px; font-size:14px; font-weight:800; color:#451a03;">${tr('주문 요약', '注文要約', 'Order summary')}</h4>
      <div id="soCoItemList" style="flex:1; overflow-y:auto; margin-bottom:12px;"></div>
      <div class="so-co-total">
        <span style="font-size:13px; color:#6b7280; font-weight:700;">${tr('합계', '合計', 'Total')}</span>
        <span class="so-co-total-amt" id="soCoTotalAmt">0원</span>
      </div>
      <button class="so-co-submit-btn" id="soCoSubmitBtn" onclick="window._soSubmitOrder()">
        ✓ ${tr('주문 완료하기', '注文を確定', 'Place order')}
      </button>
      <div style="font-size:10px; color:#9ca3af; text-align:center; margin-top:8px;">
        ${tr('결제 확인 후 영업일 내 제작 시작', '入金確認後、営業日内に製作開始', 'Production starts after payment confirmation')}
      </div>
    </aside>
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
        // 2026-05-13: 뒷면 파일 (양면 가벽용)
        const bfi = document.getElementById('soBackFile');
        const bdz = document.getElementById('soBackUpload');
        if (bfi) bfi.onchange = e => window._soOnBackFileChange(e.target.files);
        if (bdz) {
            bdz.ondragover = e => { e.preventDefault(); bdz.classList.add('dragover'); };
            bdz.ondragleave = () => bdz.classList.remove('dragover');
            bdz.ondrop = e => {
                e.preventDefault();
                bdz.classList.remove('dragover');
                window._soOnBackFileChange(e.dataTransfer.files);
            };
        }
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
        const maxW = 420;
        const maxH = 220;
        let frameW = maxW;
        let frameH = frameW / aspectRatio;
        if (frameH > maxH) {
            frameH = maxH;
            frameW = frameH * aspectRatio;
        }
        frameW = Math.round(frameW);
        frameH = Math.round(frameH);

        const thumbHtml = state.thumbDataUrl
            ? `<img src="${state.thumbDataUrl}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;background:#fff;" />`
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
        // 2026-05-13: 양면 가벽이면 뒷면 파일도 필수
        const needBack = !!(state.isWall && state.wallSide === 'double');
        const backOk = !needBack || !!state.fileBack;
        const ready = !!(state.product && state.file && state.qty > 0 && backOk);
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
        let unit = pickPrice(state.product);
        let qty, subtotal;
        // 2026-05-13: 가벽 세로 3m → 가로 m당 +50,000원 + 양면 2배
        let heightExtra = 0;
        if (state.isWall) {
            qty = state.wallWidth || 1;
            state.qty = qty;
            subtotal = unit * qty;
            // 양면이면 가격 2배 (인쇄 비용)
            if (state.wallSide === 'double') {
                subtotal *= 2;
            }
            // 세로 3m: 가로 m당 +5만원 (양면이면 2배)
            if (parseFloat(state.wallHeight) === 3) {
                heightExtra = 50000 * qty;
                if (state.wallSide === 'double') heightExtra *= 2;
            }
            state.wallHeightExtra = heightExtra;
        } else if (state.isCutPrint) {
            // 자유인쇄커팅: 한판 15만, 반판 10만 (수량은 곱셈)
            unit = (state.cutSize === 'half') ? 100000 : 150000;
            qty = state.qty || 1;
            subtotal = unit * qty;
            state.wallHeightExtra = 0;
        } else if (state.isBox) {
            // 허니콤 박스: 가로/세로/높이로 계산된 박스 단가 사용
            unit = state.boxUnitPrice || 0;
            qty = state.qty || 1;
            subtotal = unit * qty;
            state.wallHeightExtra = 0;
        } else if (state.isCustomSize) {
            // 현수막·실사출력 등 면적 기반: 계산된 단가 × 수량
            unit = state.customUnitPrice || 0;
            qty = state.qty || 1;
            subtotal = unit * qty;
            state.wallHeightExtra = 0;
        } else {
            state.wallHeightExtra = 0;
            qty = state.qty;
            // 2026-05-13: 허니콤보드 원판인쇄 양면 → 단가 2배 (DB 등록가가 단면과 동일하므로 프론트 보정)
            if (state.isRawBoardDouble) {
                unit = unit * 2;
            }
            subtotal = unit * qty;
        }
        const tierPct = 0;
        const discount = 0;
        // 옵션별 breakdown (이름 + 가격)
        const addonBreakdownLines = [];
        let addonTotal = 0;
        try {
            Object.values(state.selectedAddons || {}).forEach(function (code) {
                const addon = (window.ADDON_DB || {})[code];
                if (!addon) return;
                const aQty = (state.addonQuantities && state.addonQuantities[code]) || 1;
                const line = (addon.price || 0) * aQty;
                addonTotal += line;
                let nm = addon.name || code;
                addonBreakdownLines.push(
                    '<div class="so-price-row"><span>· ' + nm + ' × ' + aQty + '</span><span>+' + fmtPrice(line) + '</span></div>'
                );
            });
        } catch (e) {}

        // 2026-05-13: 받침대 옵션 (등신대·자유인쇄커팅)
        var baseStandFee = 0;
        if (state.baseStand && state.baseStand !== 'none' && BASE_STAND_OPTS[state.baseStand]) {
            var bOpt = BASE_STAND_OPTS[state.baseStand];
            baseStandFee = bOpt.fee || 0;
            if (baseStandFee > 0) {
                addonTotal += baseStandFee;
                addonBreakdownLines.push(
                    '<div class="so-price-row"><span>🦵 ' + bOpt.label_ko + '</span><span>+' + fmtPrice(baseStandFee) + '</span></div>'
                );
            }
        }

        // 배송/시공 비용 (야간 시간 보정 포함)
        const shipFee = _soComputeShipFee();
        state.shipFee = shipFee;

        // 2026-05-13: 할인 정책 — 구매금액 할인 + 구독자 할인 (중복 가능)
        // 100만+ 10%, 500만+ 20%, 1000만+ 30%, PRO 구독자 +10%
        // 적용 대상: 상품가 + 옵션 + 세로 3m 옵션 (배송 제외)
        const taxBase = subtotal + addonTotal + heightExtra;
        let amountPct = 0;
        if (taxBase >= 10000000) amountPct = 30;
        else if (taxBase >= 5000000) amountPct = 20;
        else if (taxBase >= 1000000) amountPct = 10;
        const isPro = !!window.isProSubscriber;
        const proPct = isPro ? 10 : 0;
        const totalDiscPct = amountPct + proPct;
        const amountDiscount = Math.round(taxBase * amountPct / 100);
        const proDiscount = Math.round(taxBase * proPct / 100);

        const final = taxBase - amountDiscount - proDiscount + shipFee;

        // 렌더
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const setHTML = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
        const showRow = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };

        if (state.isWall) {
            var sideLabel = (state.wallSide === 'double') ? ' ' + tr('(양면 ×2)', '(両面 ×2)', '(Double ×2)') : '';
            var faceTxt = tr('2면', '2面', '2 sides');
            var unitSubLabel = (state.wallSide === 'double')
                ? fmtPrice(unit) + ' × ' + qty + 'm × ' + faceTxt + ' = ' + fmtPrice(subtotal)
                : fmtPrice(unit) + ' × ' + qty + 'm = ' + fmtPrice(subtotal);
            setText('soUnit', unitSubLabel);
            setText('soUnitLabel', tr('단가', '単価', 'Unit') + sideLabel);
            showRow('soWallSizeRow', true);
            var sideTxt = (state.wallSide === 'double') ? tr('양면', '両面', 'Double') : tr('단면', '片面', 'Single');
            setText('soWallSizeText', qty + 'm × ' + (state.wallHeight || 2.4) + 'm · ' + sideTxt);
        } else if (state.isCutPrint) {
            var cutLabel = (state.cutSize === 'half') ? tr('반판 이내', 'ハーフ', 'Half') : tr('한판', 'フル', 'Full');
            setText('soUnitLabel', tr('단가', '単価', 'Unit') + ' (' + cutLabel + ')');
            setText('soUnit', fmtPrice(unit) + (qty > 1 ? (' × ' + qty + ' = ' + fmtPrice(subtotal)) : ''));
            showRow('soWallSizeRow', false);
        } else if (state.isBox) {
            var dimStr = (state.boxW || 0) + '×' + (state.boxH || 0) + '×' + (state.boxD || 0) + 'mm';
            setText('soUnitLabel', tr('박스 단가', 'ボックス単価', 'Box unit') + ' (' + dimStr + ')');
            setText('soUnit', fmtPrice(unit) + (qty > 1 ? (' × ' + qty + ' = ' + fmtPrice(subtotal)) : ''));
            showRow('soWallSizeRow', false);
        } else if (state.isCustomSize) {
            var custDim = (state.customW || 0) + '×' + (state.customH || 0) + 'cm';
            setText('soUnitLabel', tr('단가', '単価', 'Unit') + ' (' + custDim + ')');
            setText('soUnit', fmtPrice(unit) + (qty > 1 ? (' × ' + qty + ' = ' + fmtPrice(subtotal)) : ''));
            showRow('soWallSizeRow', false);
        } else {
            // 2026-05-13: 일반 상품 — 라벨을 단순 "단가"로 리셋 (이전 가벽 상태 잔존 방지)
            // 원판 양면이면 (양면 ×2) 라벨 표시
            var unitLabel = tr('단가', '単価', 'Unit');
            if (state.isRawBoardDouble) unitLabel += ' ' + tr('(양면 ×2)', '(両面 ×2)', '(2-side ×2)');
            setText('soUnitLabel', unitLabel);
            setText('soUnit', fmtPrice(unit) + (qty > 1 ? (' × ' + qty + ' = ' + fmtPrice(subtotal)) : ''));
            showRow('soWallSizeRow', false);
        }
        // 옵션 breakdown 라인 + 세로 3m 추가 옵션 (가로 m × 5만, 양면이면 2배)
        var bdHtml = addonBreakdownLines.join('');
        if (heightExtra > 0) {
            var hPrefix = '· ' + tr('세로 3m 추가', '縦3m追加', 'Height 3m extra');
            var hUnit = fmtPrice(50000);
            var hLabel = (state.wallSide === 'double')
                ? hPrefix + ' (' + hUnit + ' × ' + qty + 'm × ' + tr('2면', '2面', '2 sides') + ')'
                : hPrefix + ' (' + hUnit + ' × ' + qty + 'm)';
            bdHtml += '<div class="so-price-row"><span>' + hLabel + '</span><span>+' + fmtPrice(heightExtra) + '</span></div>';
        }
        setHTML('soAddonBreakdown', bdHtml);
        // 2026-05-13: 구매금액 할인 라인 (구간 적용 시만)
        showRow('soAmountDiscRow', amountPct > 0);
        setText('soAmountTier', amountPct + '%');
        setText('soAmountDisc', '-' + fmtPrice(amountDiscount));
        // 구독자 할인
        showRow('soProDiscRow', proDiscount > 0);
        setText('soProDisc', '-' + fmtPrice(proDiscount));
        // 배송/시공 (묶음배송이면 0원이어도 표시)
        showRow('soShipRow', shipFee > 0 || !!state.bundleShipping);
        var shipName;
        if (state.bundleShipping) {
            shipName = tr('다른 제품과 묶음배송', '合わせて配送', 'Bundled');
        } else {
            shipName = (window.SHIP_OPTS && window.SHIP_OPTS[state.shipMethod] && window.SHIP_OPTS[state.shipMethod].label_ko) || '';
            // 2026-05-13: 택배배송이면 박스 수 표시 (qty/2 올림)
            if (state.shipMethod === 'parcel_shipping' && qty > 0) {
                var boxes = Math.ceil(qty / 2);
                shipName += ' · ' + boxes + tr('박스 (2장 묶음)', '箱 (2枚まとめ)', ' boxes (2 per)');
            }
        }
        setText('soShipLabel', tr('배송/시공', '配送', 'Ship') + (shipName ? ' (' + shipName + ')' : ''));
        setText('soShipAmount', state.bundleShipping ? fmtPrice(0) : ('+' + fmtPrice(shipFee)));
        // 합계
        setText('soTotal', fmtPrice(final));

        // 활성 금액 티어 하이라이트
        const tbl = document.getElementById('soTierTable');
        if (tbl) {
            tbl.querySelectorAll('[data-amt-tier]').forEach(el => {
                el.classList.toggle('active', parseInt(el.dataset.amtTier) === amountPct);
            });
        }
    }

    // 2026-05-13: 가벽 카테고리 감지 (hb_dw_*, hb_display_wall, 또는 product.name 에 "가벽")
    function _soIsWallProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const name = (p.name || '') + ' ' + (p.name_us || '');
        if (code.startsWith('hb_dw') || cat === 'hb_display_wall') return true;
        if (name.indexOf('가벽') >= 0 || name.toLowerCase().indexOf('display wall') >= 0) return true;
        // 2026-05-14: 파티션 가림막도 가벽 UI 사용 (사이즈/시공옵션 동일 골격)
        if (_soIsPartitionProduct(p)) return true;
        return false;
    }

    // 2026-05-14: 가벽 사이즈 select 옵션 재구성
    // - regular wall   : 가로 1~8m, 세로 2/2.2/2.4/3m (기본 가로 3, 세로 2.4)
    // - partition      : 가로 1~10m, 세로 1.2/1.0/0.8m (기본 가로 3, 세로 1.2)
    // - reinforced     : 가로 1m 고정, 세로 2.2m 고정 (강화 골판지)
    function _soRebuildWallSizeOptions(variant) {
        var wEl = document.getElementById('soWallWidth');
        var hEl = document.getElementById('soWallHeight');
        if (!wEl || !hEl) return;

        var widths, heights;
        if (variant === 'reinforced') {
            widths = [{ v: '1', label: '1 m', selected: true }];
            heights = [{ v: '2.2', label: '2.2 m', selected: true }];
        } else if (variant === 'partition') {
            widths = [];
            for (var p = 1; p <= 10; p++) widths.push({ v: String(p), label: p + ' m', selected: p === 3 });
            heights = [{ v: '1.2', label: '1.2 m', selected: true }, { v: '1', label: '1.0 m' }, { v: '0.8', label: '0.8 m' }];
        } else {
            widths = [];
            for (var w = 1; w <= 8; w++) widths.push({ v: String(w), label: w + ' m', selected: w === 3 });
            heights = [{ v: '2', label: '2 m' }, { v: '2.2', label: '2.2 m' }, { v: '2.4', label: '2.4 m', selected: true }, { v: '3', label: '3 m' }];
        }
        var mkOpts = function (arr) {
            return arr.map(function (o) {
                return '<option value="' + o.v + '"' + (o.selected ? ' selected' : '') + '>' + o.label + '</option>';
            }).join('');
        };
        wEl.innerHTML = mkOpts(widths);
        hEl.innerHTML = mkOpts(heights);
        // 옵션이 1개뿐이면 비활성화 (강화 골판지)
        wEl.disabled = (variant === 'reinforced');
        hEl.disabled = (variant === 'reinforced');

        // 가이드 카드 chip / 본문 범위 텍스트도 동시 업데이트
        var chip = document.getElementById('soWallChipHeight');
        var range = document.getElementById('soWallGuideRange');
        var lang = getLang();
        var fmtLine = function(kr, ja, en) { return lang === 'ja' ? ja : (/^(en|us)$/i.test(lang) || lang === 'en' ? en : (/(es|de|fr|zh|ar)/i.test(lang) ? en : kr)); };
        if (variant === 'reinforced') {
            if (chip) chip.innerHTML = '📏 ' + fmtLine('1m × 2.2m 고정', '1m × 2.2m 固定', 'Fixed 1m × 2.2m');
            if (range) range.textContent = fmtLine(
                '강화 골판지 가벽은 1m × 2.2m 사이즈로 고정 제작되며, 기본 양면 인쇄입니다.',
                '強化段ボール壁は1m×2.2mサイズ固定で、両面印刷が標準です。',
                'Reinforced corrugated walls ship fixed at 1m × 2.2m with double-sided print by default.'
            );
        } else if (variant === 'partition') {
            if (chip) chip.innerHTML = '📏 ' + fmtLine('세로 1.2 · 1.0 · 0.8m', '縦 1.2/1.0/0.8m', 'Height 1.2/1.0/0.8m');
            if (range) range.textContent = fmtLine(
                '파티션 가림막은 가로 1m 단위로 제작됩니다. 가로 길이는 1m부터 10m까지 선택 가능하며, 세로는 1.2m / 1.0m / 0.8m 중 선택하실 수 있습니다.',
                'パーティション目隠しは横1m単位で製作されます。横は1m〜10m、縦は1.2/1.0/0.8mから選択。',
                'Partition screens are produced in 1m width units. Width 1m-10m, height 1.2/1.0/0.8m.'
            );
        } else {
            if (chip) chip.innerHTML = '📏 ' + fmtLine('세로 2 · 2.2 · 2.4 · 3m', '縦 2/2.2/2.4/3m', 'Height 2/2.2/2.4/3m');
            if (range) range.textContent = fmtLine(
                '허니콤 가벽은 가로 1m 단위로 제작됩니다. 가로 길이는 1m부터 8m까지 선택 가능하며, 세로는 2m / 2.2m / 2.4m / 3m 중 선택하실 수 있습니다.',
                'ハニカム壁は横1m単位で製作されます。横は1m〜8m、縦は2/2.2/2.4/3mから選択。',
                'Honeycomb walls are produced in 1m width units. Width 1m-8m, height 2/2.2/2.4/3m.'
            );
        }
    }

    // 2026-05-14: 허니콤보드 파티션 가림막 감지
    // - code: hb_par_* / hb_dw_par_* / 또는 admin 이 다른 코드로 등록한 경우 이름으로 매칭
    // - name: '파티션 가림막' / 'partition' / 'screen' / '간이 가벽'
    // 가로 1~10m (가벽 1~8m 보다 넓음), 세로 1.2m / 1.0m / 0.8m (가벽 2~3m 와 다름)
    function _soIsPartitionProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        if (/^hb_par|^hb_dw_par|^hb_pt_par|^partition/i.test(code)) return true;
        if (/partition|hb_par/.test(cat)) return true;
        if (/파티션|가림막|간이\s*가벽|partition\s*screen|partition\s*wall|room\s*divider/i.test(name)) return true;
        return false;
    }

    // 2026-05-14: 강화 골판지 가벽 — 양면 고정 + 사이즈 1m × 2.2m 고정
    function _soIsReinforcedWall(p) {
        if (!p) return false;
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        return /강화\s*골판지|골판지\s*가벽|corrugated\s*wall|reinforced\s*corrugated/i.test(name);
    }

    // 2026-05-14: 단면 전용 가벽 변종 (병풍형 / 지붕형 / 파티션 가림막)
    // 인쇄면 선택 UI 숨김 + wallSide='single' 고정
    function _soIsSingleSideWall(p) {
        if (!p) return false;
        if (_soIsPartitionProduct(p)) return true;
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        if (/병풍|byeongpung|folding\s*wall|folding\s*partition/i.test(name)) return true;
        if (/지붕|roof|gable|tent\s*wall/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 글씨 포토존 감지 (제품명에 "포토존" 또는 "photo zone")
    function _soIsPhotozoneProduct(p) {
        if (!p) return false;
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        return /포토존|글씨|photo\s*zone|letter\s*sign/i.test(name);
    }

    // 2026-05-13: 허니콤보드 카테고리 감지 (hb_* — 가벽/박스/자유인쇄커팅/원판 등 전체)
    function _soIsHoneycombProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        if (code.startsWith('hb_')) return true;
        if (cat.indexOf('hb_') === 0 || cat.indexOf('honeycomb') >= 0) return true;
        if (name.indexOf('허니콤') >= 0 || name.indexOf('honeycomb') >= 0) return true;
        return false;
    }

    // 2026-05-13: 배송만 (시공 없이) 사용하는 상품 — 허니콤 가벽 제외 모든 허니콤 상품
    // 수도권 배송 10만 / 지방 용차 20만 / 묶음배송 무료 옵션 노출
    function _soUsesDeliveryShipping(p) {
        if (!p) return false;
        return _soIsHoneycombProduct(p) && !_soIsWallProduct(p);
    }

    // 2026-05-13: 허니콤보드 원판인쇄 감지 (Wholesale Board Prices · 이름에 "원판" 포함)
    function _soIsRawBoardProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '') + ' ' + (p.name_kr || '')).toLowerCase();
        if (cat === 'wholesale board prices' || cat.indexOf('raw') >= 0 || cat.indexOf('원판') >= 0) return true;
        if (code.startsWith('hb_rb') || code.startsWith('hb_raw')) return true;
        if (/원판|raw\s*board|raw\s*sheet/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 원판인쇄 양면 여부 (이름에 "양면" 포함 시)
    function _soIsRawBoardDoubleSided(p) {
        if (!_soIsRawBoardProduct(p)) return false;
        const name = ((p.name || '') + ' ' + (p.name_us || '') + ' ' + (p.name_kr || '')).toLowerCase();
        return /양면|double.?sided|two.?side/i.test(name);
    }

    // 2026-05-13: 등신대 감지 (hb_ss_*, hb_pi_5, hb_point*, acr_crt_stand_*, 또는 이름에 등신대)
    function _soIsStandeeProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '') + ' ' + (p.name_kr || '')).toLowerCase();
        if (code.startsWith('hb_ss') || code.startsWith('hb_point')) return true;
        if (code === 'hb_pi_5' || code.startsWith('acr_crt_stand')) return true;
        if (/등신대|standee|life-?size|cardboard\s*cutout/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 받침대 옵션이 필요한 상품 — 등신대 + 자유인쇄커팅
    function _soNeedsBaseStand(p) {
        return _soIsStandeeProduct(p) || _soIsCutPrintProduct(p);
    }

    // 2026-05-13: 받침대 옵션 카탈로그
    var BASE_STAND_OPTS = {
        none:         { fee: 0,     label_ko: '받침대 없음',                label_jp: 'なし',           label_us: 'No stand' },
        a4:           { fee: 3000,  label_ko: 'A4 이하용 받침대',            label_jp: 'A4以下 スタンド',  label_us: 'A4 stand' },
        a3:           { fee: 5000,  label_ko: 'A3 이하용 받침대',            label_jp: 'A3以下 スタンド',  label_us: 'A3 stand' },
        a2:           { fee: 10000, label_ko: 'A2 이하용 받침대',            label_jp: 'A2以下 スタンド',  label_us: 'A2 stand' },
        rear:         { fee: 20000, label_ko: '등신대용 후면받침',           label_jp: '等身大 背面支持',  label_us: 'Life-size rear support' },
        banner_small: { fee: 20000, label_ko: '가로 60cm 이하 배너형 받침',   label_jp: 'バナー型 ≤60cm',   label_us: 'Banner ≤60cm' },
        banner_large: { fee: 50000, label_ko: '가로 70cm 이상 배너형 받침',   label_jp: 'バナー型 ≥70cm',   label_us: 'Banner ≥70cm' }
    };

    // 2026-05-13: 사이즈 입력 → 면적 × 단가 (m²) 자동 계산 상품 — 현수막·실사출력 등
    // admin_products.is_custom_size = true 이면서 가벽/박스/자유인쇄커팅 처럼 자체 UI가 없는 상품
    function _soIsCustomSizeProduct(p) {
        if (!p) return false;
        // 가벽·박스·자유인쇄커팅 은 별도 사이즈 UI 사용
        if (_soIsWallProduct(p)) return false;
        if (_soIsBoxProduct(p)) return false;
        if (_soIsCutPrintProduct(p)) return false;
        // is_custom_size 또는 width_mm/height_mm 있고 name 에 현수막/배너/실사출력
        if (p.is_custom_size === true) return true;
        const name = ((p.name || '') + ' ' + (p.name_us || '') + ' ' + (p.name_kr || '')).toLowerCase();
        if (/현수막|배너|실사\s*출력|시트지|광고\s*인쇄|banner|hyunsumak/i.test(name)) return true;
        // 2026-05-14: 아크릴 굿즈 (키링·코롯도·키홀더 등) — 소형이지만 cm² 단가 계산
        if (_soIsAcrylicGoodsProduct(p)) return true;
        return false;
    }

    // 2026-05-14: 아크릴 굿즈 감지 (키링·코롯도·아크릴 굿즈 등)
    // - code prefix: gds_acr / gds_kr / acr_kr
    // - 이름: 키링/코롯도/아크릴 키홀더/keyring/korotto
    // 이런 제품은 5cm×5cm 같은 소형 사이즈가 정상 → min 1cm 허용 + 고리/부자재 자동 표시
    function _soIsAcrylicGoodsProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '') + ' ' + (p.name_kr || '')).toLowerCase();
        if (/^gds_acr|^gds_kr|^acr_kr|^acr_g/.test(code)) return true;
        if (/^(gds_acr|acrylic_goods|acrylic|굿즈|goods)$/.test(cat)) return true;
        if (/아크릴\s*키링|아크릴\s*키홀더|아크릴\s*굿즈|아크릴\s*스탠드|코롯도|korotto|acrylic\s*(keyring|charm|stand|goods|holder|tag)/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 포맥스/폼보드 감지 (대형택배 3만원)
    function _soIsForexFoamProduct(p) {
        if (!p) return false;
        const name = ((p.name || '') + ' ' + (p.name_us || '') + ' ' + (p.name_kr || '')).toLowerCase();
        return /포맥스|폼보드|forex|foam\s*board|pvc\s*foam/i.test(name);
    }

    // 2026-05-13: 일반 인쇄물 감지 (광고/상업/홈/굿즈/기타) — 허니콤·포맥스·폼보드 제외 모든 상품
    // 패브릭은 자체 designer, 종이매대는 자체 페이지라 simple_order 에 들어오지 않음
    function _soIsGeneralPrintProduct(p) {
        if (!p) return false;
        if (_soIsHoneycombProduct(p)) return false;
        if (_soIsForexFoamProduct(p)) return false;
        return true;
    }

    // 2026-05-13: 택배배송 가능 상품 — 허니콤보드배너(hb_bn_*) + 인스타판넬(hb_insta / lll0 / 0ll / lllllp / ppp)
    // 택배 1박스에 2장 묶음 가능 → 가격 = ceil(qty/2) × 30,000원
    function _soIsParcelShipProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        if (code.startsWith('hb_bn')) return true;        // 허니콤배너 단/양면/연결형
        if (cat === 'hb_insta' || cat.indexOf('insta') >= 0) return true;
        if (['lll0', '0ll', 'lllllp', 'ppp'].indexOf(code) >= 0) return true;
        if (/배너|banner|인스타\s*판넬|instagram\s*panel|photo\s*booth/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 허니콤 박스 감지 (hb_bx_*)
    // 가로×세로×높이 입력 → calculateBoxPrice 로 자동 계산 (product.price = 시트당 단가)
    function _soIsBoxProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        if (code.startsWith('hb_bx')) return true;
        if (/허니콤\s*박스|honeycomb\s*box/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 박스 가격 계산 (box-nesting.js 동적 임포트)
    var _soBoxCalcModule = null;
    async function _soLoadBoxCalc() {
        if (_soBoxCalcModule) return _soBoxCalcModule;
        try {
            _soBoxCalcModule = await import('./box-nesting.js?v=434');
            return _soBoxCalcModule;
        } catch (e) {
            console.warn('[simple_order] box-nesting load failed:', e);
            return null;
        }
    }

    // 2026-05-13: 허니콤 자유인쇄커팅 감지 (hb_pt_* 또는 제품명에 "자유인쇄")
    // 한판(2400×1200) 15만 · 반판(1200×1200 or 600×2400) 10만, 시공X, 배송만
    function _soIsCutPrintProduct(p) {
        if (!p) return false;
        const code = (p.code || '').toLowerCase();
        const name = ((p.name || '') + ' ' + (p.name_us || '')).toLowerCase();
        if (code.startsWith('hb_pt')) return true;
        if (/자유\s*인쇄|free\s*print|free\s*cut/i.test(name)) return true;
        return false;
    }

    // 2026-05-13: 배송 옵션별 가격 + breakdown 정보 (window 노출 — recalc 가 라벨 사용)
    var SHIP_OPTS = {
        self_pickup:          { fee: 0,      label_ko: '본사 방문 수령',      parts: [] },
        metro_install:        { fee: 100000, label_ko: '수도권 설치',         parts: [['수도권 설치', 100000]] },
        metro_weekend:        { fee: 200000, label_ko: '수도권 야간/주말 설치', parts: [['수도권 야간/주말 설치', 200000]] },
        metro_install_removal:{ fee: 300000, label_ko: '수도권 설치+철거',     parts: [['수도권 설치', 100000], ['수도권 철거', 200000]] },
        regional_truck:       { fee: 200000, label_ko: '지방 용차배송',       parts: [['지방 용차배송', 200000]] },
        regional_install:     { fee: 700000, label_ko: '지방 설치배송',       parts: [['지방 설치배송', 700000]] },
        // 2026-05-13: 허니콤 자유인쇄커팅용 (시공 없이 배송만)
        metro_delivery:       { fee: 100000, label_ko: '수도권 배송',         parts: [['수도권 배송', 100000]] },
        regional_delivery:    { fee: 200000, label_ko: '지방 배송',           parts: [['지방 배송', 200000]] },
        // 2026-05-13: 다른 제품과 묶음배송 (이 상품 자체 배송비는 0)
        bundle_shipping:      { fee: 0,      label_ko: '다른 제품과 묶음배송', parts: [] },
        // 2026-05-13: 택배배송 (배너·인스타판넬만) — 2장 묶음 = 3만원, 3장 이상은 ceil(qty/2)*3만
        parcel_shipping:      { fee: 30000,  label_ko: '택배배송',           parts: [['택배배송 (2장 묶음)', 30000]] },
        // 2026-05-13: 포맥스·폼보드 대형택배 (3만원 고정)
        large_parcel:         { fee: 30000,  label_ko: '대형택배',           parts: [['대형택배', 30000]] },
        // 2026-05-13: 일반 인쇄물 묶음 소형택배 (5천원, 모든 수량 동일)
        small_parcel:         { fee: 5000,   label_ko: '묶음 소형택배',     parts: [['묶음 소형택배', 5000]] },
        // 2026-05-13: 등신대·자유인쇄커팅 택배 (60×40cm 이하, 1만원)
        compact_parcel:       { fee: 10000,  label_ko: '택배배송 (60×40cm 이하)', parts: [['택배배송 60×40 이하', 10000]] }
    };
    window.SHIP_OPTS = SHIP_OPTS;

    // 2026-05-13: 야간/주말 자동 보정 — 수도권 설치(10만) 인데 시간이 야간이면 자동 20만(야간 설치)
    function _soComputeShipFee() {
        // 2026-05-13: 묶음배송 모드면 이 상품의 배송비는 0
        if (state.bundleShipping) {
            state._shipUpgradeReason = null;
            return 0;
        }
        var method = state.shipMethod || 'self_pickup';
        var opt = SHIP_OPTS[method] || SHIP_OPTS.self_pickup;
        var baseFee = opt.fee || 0;
        // 2026-05-13: 택배배송은 2장당 3만원 (qty 1~2 = 3만, 3~4 = 6만, ...)
        if (method === 'parcel_shipping') {
            var q = state.qty || 1;
            baseFee = Math.ceil(q / 2) * 30000;
            state._shipUpgradeReason = (q > 2) ? ('택배 ' + Math.ceil(q / 2) + '박스 (2장씩 묶음)') : null;
            return baseFee;
        }
        // 시간이 야간 이고 옵션이 metro_install 이면 → 20만원 (야간/주말 설치 가격으로 자동 업그레이드)
        var timeEl = document.getElementById('soScheduleTime');
        var timeVal = timeEl ? timeEl.value : '';
        var dateEl = document.getElementById('soScheduleDate');
        var dateVal = dateEl ? dateEl.value : '';
        var isWeekend = false;
        if (dateVal) {
            try {
                var dow = new Date(dateVal + 'T00:00:00').getDay();
                isWeekend = (dow === 0 || dow === 6);
            } catch (e) {}
        }
        var nightOrWeekend = (timeVal === 'night') || isWeekend;
        if (method === 'metro_install' && nightOrWeekend) {
            baseFee = 200000;
            state._shipUpgradeReason = '야간/주말 설치';
        } else {
            state._shipUpgradeReason = null;
        }
        return baseFee;
    }

    // 2026-05-13: 영업일 기준 N일 후 (주말 제외) — YYYY-MM-DD
    function _soAddBusinessDays(startDate, days) {
        var d = new Date(startDate);
        var added = 0;
        while (added < days) {
            d.setDate(d.getDate() + 1);
            var dow = d.getDay();
            if (dow !== 0 && dow !== 6) added++;
        }
        // 로컬 타임존 YYYY-MM-DD
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + dd;
    }

    // 2026-05-13: 시공/배송 버튼 클릭
    window._soPickShip = function (method) {
        state.shipMethod = method;
        // 2026-05-13: 사용자가 일반 ship 버튼을 누르면 묶음배송 모드 해제
        if (state.bundleShipping && method !== 'bundle_shipping') {
            state.bundleShipping = false;
            var bBtn = document.getElementById('soBundleShipBtn');
            if (bBtn) {
                bBtn.style.background = '#f0fdf4';
                bBtn.style.color = '#15803d';
                bBtn.style.borderStyle = 'dashed';
                bBtn.innerHTML = '📦 ' + tr('다른 제품과 묶음배송', '他の商品と合わせて配送', 'Bundle with other items') +
                    '<div style="font-size:11px; font-weight:600; color:#16a34a; margin-top:4px;">' +
                    tr('다른 허니콤 상품에서 배송을 선택한 경우 무료', '他のハニカム商品の配送と一緒', 'Free if another honeycomb item has shipping') +
                    '</div>';
            }
        }
        // 버튼 active 상태 토글
        document.querySelectorAll('.so-ship-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.ship === method);
            b.style.opacity = '1';
            b.style.pointerEvents = '';
        });
        var dateWrap = document.getElementById('soScheduleDateWrap');
        var remWrap = document.getElementById('soRemovalWrap');
        // self_pickup 또는 단순 배송/택배(metro/regional_delivery·parcel·large/small_parcel)이면 날짜·시간 안 보임
        var noScheduleMethods = ['self_pickup', 'metro_delivery', 'regional_delivery', 'parcel_shipping', 'large_parcel', 'small_parcel', 'compact_parcel', 'bundle_shipping'];
        var needsSchedule = noScheduleMethods.indexOf(method) < 0;
        if (dateWrap) dateWrap.style.display = needsSchedule ? '' : 'none';
        // 철거 옵션 (수도권 설치+철거 시만)
        if (remWrap) remWrap.style.display = (method === 'metro_install_removal') ? '' : 'none';
        // 배송 희망일 최소값 = 오늘 + 영업일 3일
        var sd = document.getElementById('soScheduleDate');
        if (sd) {
            var minD = _soAddBusinessDays(new Date(), 3);
            sd.min = minD;
            if (!sd.value || sd.value < minD) sd.value = minD;
        }
        var rd = document.getElementById('soRemovalDate');
        if (rd) {
            var minR = _soAddBusinessDays(new Date(), 3);
            rd.min = minR;
            if (!rd.value || rd.value < minR) rd.value = minR;
        }
        recalcWithShipping();
        _soUpdateShipBreakdown();
    };

    // 2026-05-13: 가격 breakdown 박스 갱신 (시간 변경 등에서 호출)
    window._soUpdateShipBreakdown = function () {
        var box = document.getElementById('soShipBreakdown');
        if (!box) return;
        var opt = SHIP_OPTS[state.shipMethod];
        if (!opt || !opt.parts || !opt.parts.length) { box.innerHTML = ''; recalc(); return; }
        var sd = document.getElementById('soScheduleDate');
        var st = document.getElementById('soScheduleTime');
        var rd = document.getElementById('soRemovalDate');
        var rt = document.getElementById('soRemovalTime');
        // 야간/주말 자동 보정 (수도권 설치만)
        var actualFee = _soComputeShipFee();
        var parts = opt.parts.slice();
        if (state.shipMethod === 'metro_install' && actualFee === 200000) {
            parts = [['수도권 야간/주말 설치 (자동 적용)', 200000]];
        }
        var lines = [];
        lines.push('<div style="font-weight:800; color:#1e1b4b; margin-bottom:4px;">📋 ' + tr('비용 안내', '料金案内', 'Cost') + '</div>');
        parts.forEach(function (p) {
            lines.push('<div style="display:flex; justify-content:space-between;"><span>· ' + p[0] + '</span><span style="font-weight:700;">' + fmtPrice(p[1]) + '</span></div>');
        });
        if (parts.length > 1) {
            var sum = parts.reduce(function (s, p) { return s + p[1]; }, 0);
            lines.push('<div style="display:flex; justify-content:space-between; border-top:1px solid #c7d2fe; padding-top:4px; margin-top:4px;"><span style="font-weight:800;">' + tr('합계', '合計', 'Total') + '</span><span style="font-weight:900; color:#dc2626;">' + fmtPrice(sum) + '</span></div>');
        }
        if (sd && sd.value) {
            var timeLabel = { am:'오전', pm:'오후', night:'야간', any:'시간상관없음', '':'시간 미지정' }[st ? st.value : ''] || '';
            lines.push('<div style="margin-top:6px; font-size:11px;">🚚 ' + tr('배송', '配送', 'Ship') + ': ' + sd.value + (timeLabel ? ' / ' + timeLabel : '') + '</div>');
        }
        if (state.shipMethod === 'metro_install_removal' && rd && rd.value) {
            var rTimeLabel = { night:'야간', any:'시간상관없음', '':'시간 미지정' }[rt ? rt.value : ''] || '';
            lines.push('<div style="font-size:11px;">🔧 ' + tr('철거', '撤去', 'Removal') + ': ' + rd.value + (rTimeLabel ? ' / ' + rTimeLabel : '') + '</div>');
        }
        box.innerHTML = lines.join('');
        // 가격 박스도 재계산 (배송비 반영)
        recalc();
    };

    function recalcWithShipping() {
        // recalc() 가 _soComputeShipFee() 로 직접 가격 계산하므로 여기서는 그냥 호출만
        recalc();
    }

    // 2026-05-14: WALL_DEFAULT_ADDONS (조명추가/보조받침대 하드코딩) 제거.
    // 관리자가 admin_addons 에 등록하므로 더 이상 코드에 박아둘 필요 없음. (사용자 요청)

    // 2026-05-13: 상품의 admin_addons 옵션을 우측 패널에 체크박스로 렌더
    async function _soPopulateAddons(p) {
        const sec = document.getElementById('soAddonSection');
        const list = document.getElementById('soAddonList');
        if (!sec || !list) return;
        list.innerHTML = '';
        sec.style.display = 'none';

        // 2026-05-13: getLang() (kr/ja/en/es/de/fr/zh) 사용 — 기존 'ko' 디폴트가 cafe0101 에서 미작동
        var lang = getLang();

        var renderList = [];
        // admin_products.addons 에 정의된 일반 addon 표시
        if (p && p.addons) {
            var codes = Array.isArray(p.addons) ? p.addons : String(p.addons).split(',');
            codes.map(function (c) { return String(c || '').trim(); }).filter(Boolean).forEach(function (code) {
                var a = (window.ADDON_DB || {})[code];
                if (a && renderList.indexOf(a) < 0) renderList.push(a);
            });
        }
        // 2026-05-14: 아크릴 굿즈 — 키링용 부자재만 자동 포함 (ADDON_DB 스캔)
        // 화이트리스트: 와이어링/키링/오링/볼체인/랍스터/jump ring 등 키링 전용 명칭
        // 블랙리스트: 봉/조명/글루건/받침대/타공/멜빵/텐션/허니콤 등 가벽·배너 전용 → 무조건 제외
        if (state.isAcrylicGoods && window.ADDON_DB) {
            var keyringWhiteRe = /와이어\s*링|wire\s*ring|키링|key\s*ring|key\s*chain|keyring|키체인|오링|원형\s*링|o-?ring|볼\s*체인|ball\s*chain|랍스터|lobster|jump\s*ring|메탈\s*링|metal\s*ring|키홀더|key\s*holder|핸드폰\s*고리|폰\s*고리|버블링|크리스탈\s*링/i;
            var bannerBlackRe = /봉|조명|글루건|받침대|타공|아일렛|eyelet|멜빵|텐션|tension|허니콤|honeycomb|광고|배너(?!\s*키링)|banner(?!\s*key)|가벽|wall\s*panel|상단끈|하단끈|마감|finish|POP|판넬|panel|글루|grout|매대|stand(?!ee)|히터|heat|박스|box/i;
            Object.keys(window.ADDON_DB).forEach(function (k) {
                var a = window.ADDON_DB[k];
                if (!a) return;
                var nm = ((a.name || '') + ' ' + (a.name_kr || '') + ' ' + (a.name_us || '') + ' ' + (a.code || '')).toLowerCase();
                if (bannerBlackRe.test(nm)) return;        // 가벽·배너용 → 제외
                if (!keyringWhiteRe.test(nm)) return;      // 키링 키워드 미부합 → 제외
                if (renderList.indexOf(a) < 0) renderList.push(a);
            });
        }
        if (!renderList.length) return;

        var html = renderList.map(function (a) {
            var name = a.name || a.code;
            if (lang === 'ja' && a.name_jp) name = a.name_jp;
            else if ((lang === 'en' || lang === 'es' || lang === 'de' || lang === 'fr' || lang === 'zh' || lang === 'ar') && a.name_us) name = a.name_us;
            var price = a.price || 0;
            var safe = String(name).replace(/[<>"'&]/g, function (c) {
                return ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c];
            });
            // 2026-05-13: desc 도 다국어 (desc_jp/desc_us 있으면 사용, 없으면 desc fallback)
            var descTxt = a.desc || '';
            if (lang === 'ja' && a.desc_jp) descTxt = a.desc_jp;
            else if ((lang === 'en' || lang === 'es' || lang === 'de' || lang === 'fr' || lang === 'zh' || lang === 'ar') && a.desc_us) descTxt = a.desc_us;
            var descSafe = descTxt ? String(descTxt).replace(/[<>"'&]/g, function (c) {
                return ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c];
            }) : '';
            var isLight = a.isLight === true || /조명|light|lamp/i.test(name);
            // 2026-05-14: 원형 썸네일 — admin_addons.img_url 사용, 없으면 작은 점 아이콘
            var imgUrl = a.img_url || a.image_url || a.thumb_url || '';
            var imgHtml;
            if (imgUrl) {
                imgHtml = '<img src="' + String(imgUrl).replace(/"/g,'&quot;') +
                    '" loading="lazy" alt="" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1.5px solid #e7d6b8; background:#fff; flex-shrink:0;" ' +
                    'onerror="this.style.display=&quot;none&quot;">';
            } else {
                imgHtml = '<span style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#fef3c7,#fed7aa); display:inline-flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">🔗</span>';
            }
            return '<label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:2px solid #e7e5e4; border-radius:12px; cursor:pointer; font-size:13px; background:#fff; transition:all 0.15s;">' +
                '<input type="checkbox" data-addon-code="' + String(a.code).replace(/"/g,'&quot;') + '" data-addon-light="' + (isLight && state.isWall ? '1' : '0') + '" onchange="window._soToggleAddon(this)" style="margin:0; width:16px; height:16px;">' +
                imgHtml +
                '<div style="flex:1; min-width:0;">' +
                  '<div style="font-weight:700; color:#451a03;">' + safe + '</div>' +
                  (descSafe ? '<div style="font-size:11px; color:#6b7280; margin-top:2px;">' + descSafe + '</div>' : '') +
                '</div>' +
                '<span style="font-weight:800; color:#dc2626; font-size:13px;">+' + fmtPrice(price) + '</span>' +
                '</label>';
        }).join('');
        list.innerHTML = html;
        sec.style.display = '';
    }

    // 2026-05-13: 가벽 가로 변경 시 조명 옵션 수량 자동 재계산
    window._soUpdateAddonQty = function () {
        var wallW = parseFloat(document.getElementById('soWallWidth') && document.getElementById('soWallWidth').value) || 1;
        state.wallWidth = wallW;
        state.wallHeight = parseFloat(document.getElementById('soWallHeight') && document.getElementById('soWallHeight').value) || 2.4;
        // 조명 (data-addon-light="1") 의 수량을 가로(m)로 set
        var lightInputs = document.querySelectorAll('#soAddonList input[data-addon-light="1"]');
        lightInputs.forEach(function (inp) {
            var code = inp.dataset.addonCode;
            if (inp.checked) {
                state.addonQuantities[code] = wallW;
            }
        });
        recalc();
    };
    window._soUpdatePrice = function () {
        state.wallHeight = parseFloat(document.getElementById('soWallHeight') && document.getElementById('soWallHeight').value) || 2.4;
        recalc();
    };

    // 2026-05-13: 사용자 정의 사이즈 변경 → 면적 × 단가 (현수막·실사출력 등)
    // 공식: area_m² × per_m²_rate, 최소 product.price (1m² 미만은 평방미터당 단가 그대로 적용)
    window._soOnCustomDimsChange = function () {
        var wEl = document.getElementById('soCustomW');
        var hEl = document.getElementById('soCustomH');
        if (!wEl || !hEl) return;
        var wCm = parseInt(wEl.value, 10) || 0;
        var hCm = parseInt(hEl.value, 10) || 0;
        state.customW = wCm;
        state.customH = hCm;
        var unitEl = document.getElementById('soCustomUnitPrice');
        var infoEl = document.getElementById('soCustomAreaInfo');
        // 2026-05-14: 아크릴 굿즈는 5cm×5cm 같은 소형이 정상 → min 1cm 허용 (현수막·배너만 min 10cm)
        var isAcrGoods = state.isAcrylicGoods;
        var minDim = isAcrGoods ? 1 : 10;
        if (wCm < minDim || hCm < minDim) {
            if (unitEl) unitEl.textContent = '-';
            if (infoEl) infoEl.textContent = '';
            state.customUnitPrice = 0;
            recalc();
            return;
        }
        var perSqm = (state.product && (state.product._base_sqm_price || state.product.price)) || 0;
        var areaM2 = (wCm / 100) * (hCm / 100);
        var raw = areaM2 * perSqm;
        var calcPrice = Math.round(raw / 10) * 10;
        // 너무 작은 사이즈는 최소 단가 (per_m² 그대로) 보장 — 현수막용
        if (!isAcrGoods && calcPrice < perSqm * 0.1) calcPrice = Math.round(perSqm * 0.1 / 10) * 10;
        // 아크릴 굿즈 — 최소 100원 (사이즈 1×1cm 같은 극단값 방지)
        if (isAcrGoods && calcPrice < 100) calcPrice = 100;
        state.customUnitPrice = calcPrice;
        state.customAreaM2 = areaM2;
        if (unitEl) unitEl.textContent = fmtPrice(calcPrice);
        if (infoEl) {
            if (isAcrGoods) {
                // 아크릴 굿즈 — cm² 단위로 표시 (m² 보다 직관적)
                var areaCm2 = wCm * hCm;
                var perCm2 = perSqm / 10000; // m² → cm² 환산
                infoEl.textContent =
                    wCm + '×' + hCm + 'cm · ' +
                    areaCm2 + 'cm² × ' + fmtPrice(Math.round(perCm2)) + '/cm²';
            } else {
                infoEl.textContent =
                    wCm + '×' + hCm + 'cm · ' +
                    areaM2.toFixed(2) + 'm² × ' + fmtPrice(perSqm) + '/m²';
            }
        }
        recalc();
    };

    // 2026-05-13: 박스 사이즈 변경 → 단가 자동 계산
    window._soOnBoxDimsChange = async function () {
        var wEl = document.getElementById('soBoxW');
        var hEl = document.getElementById('soBoxH');
        var dEl = document.getElementById('soBoxD');
        if (!wEl || !hEl || !dEl) return;
        var w = parseInt(wEl.value, 10) || 0;
        var h = parseInt(hEl.value, 10) || 0;
        var d = parseInt(dEl.value, 10) || 0;
        state.boxW = w; state.boxH = h; state.boxD = d;
        var unitEl = document.getElementById('soBoxUnitPrice');
        var infoEl = document.getElementById('soBoxSheetInfo');
        if (w < 50 || h < 50 || d < 50) {
            if (unitEl) unitEl.textContent = '-';
            if (infoEl) infoEl.textContent = '';
            state.boxUnitPrice = 0;
            recalc();
            return;
        }
        var mod = await _soLoadBoxCalc();
        if (!mod || !mod.calculateBoxPrice) return;
        var pricePerSheet = pickPrice(state.product) || 0;
        var r = mod.calculateBoxPrice(w, h, d, pricePerSheet);
        if (r.error) {
            if (unitEl) {
                unitEl.style.fontSize = '13px';
                unitEl.textContent = tr('면이 시트(2400×1200mm)보다 큽니다', '面がシート(2400×1200mm)より大きい', 'Face exceeds sheet (2400×1200mm)');
            }
            if (infoEl) infoEl.textContent = '';
            state.boxUnitPrice = 0;
            state.boxNesting = null;
            recalc();
            return;
        }
        state.boxUnitPrice = r.totalPrice;
        state.boxNesting = { sheetCount: r.sheetCount, setsPerSheet: r.setsPerSheet };
        if (unitEl) {
            unitEl.style.fontSize = '20px';
            unitEl.textContent = fmtPrice(r.totalPrice);
        }
        if (infoEl) {
            var sheetLabel = tr('시트', 'シート', 'Sheet');
            var setLabel = tr('세트/시트', 'セット/シート', 'sets/sheet');
            if (r.setsPerSheet > 1) {
                infoEl.textContent = sheetLabel + ': ' + r.sheetCount + ' (' + r.setsPerSheet + ' ' + setLabel + ')';
            } else {
                infoEl.textContent = sheetLabel + ': ' + r.sheetCount;
            }
        }
        recalc();
    };

    // 2026-05-13: 받침대 옵션 선택 (등신대·자유인쇄커팅)
    window._soPickBaseStand = function (key) {
        if (!BASE_STAND_OPTS[key]) key = 'none';
        state.baseStand = key;
        document.querySelectorAll('.so-base-btn').forEach(function (b) {
            var on = b.dataset.base === key;
            b.classList.toggle('active', on);
            b.style.background = on ? '#4338ca' : '#fff';
            b.style.color = on ? '#fff' : '#451a03';
            b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
        });
        recalc();
    };

    // 2026-05-13: 자유인쇄커팅 사이즈 선택 (한판 15만 / 반판 10만)
    window._soPickCutSize = function (size) {
        state.cutSize = (size === 'half') ? 'half' : 'full';
        document.querySelectorAll('.so-cut-btn').forEach(function (b) {
            var on = b.dataset.cut === state.cutSize;
            b.classList.toggle('active', on);
            b.style.background = on ? '#4338ca' : '#fff';
            b.style.color = on ? '#fff' : '#451a03';
            b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
        });
        recalc();
    };

    // 2026-05-13: 다른 제품과 묶음배송 토글
    window._soToggleBundle = function () {
        state.bundleShipping = !state.bundleShipping;
        var btn = document.getElementById('soBundleShipBtn');
        if (btn) {
            if (state.bundleShipping) {
                btn.style.background = '#16a34a';
                btn.style.color = '#fff';
                btn.style.borderStyle = 'solid';
                btn.innerHTML = '✅ ' + tr('다른 제품과 묶음배송 (선택됨)', '合わせて配送 (選択中)', 'Bundled with other items (selected)') +
                    '<div style="font-size:11px; font-weight:600; color:#dcfce7; margin-top:4px;">' +
                    tr('이 상품의 배송비는 0원으로 계산됩니다', 'この商品の配送費は0円', 'Shipping fee for this item is 0') +
                    '</div>';
                // 묶음배송 켜면 다른 ship 버튼 비활성화
                state.shipMethod = 'bundle_shipping';
            } else {
                btn.style.background = '#f0fdf4';
                btn.style.color = '#15803d';
                btn.style.borderStyle = 'dashed';
                btn.innerHTML = '📦 ' + tr('다른 제품과 묶음배송', '他の商品と合わせて配送', 'Bundle with other items') +
                    '<div style="font-size:11px; font-weight:600; color:#16a34a; margin-top:4px;">' +
                    tr('다른 허니콤 상품에서 배송을 선택한 경우 무료', '他のハニカム商品の配送と一緒', 'Free if another honeycomb item has shipping') +
                    '</div>';
                state.shipMethod = 'self_pickup';
            }
        }
        // ship 버튼 active 상태 동기화
        document.querySelectorAll('.so-ship-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.ship === state.shipMethod);
            // 묶음배송 모드일 때 ship 버튼 비활성화 (시각만)
            b.style.opacity = state.bundleShipping ? '0.5' : '1';
            b.style.pointerEvents = state.bundleShipping ? 'none' : '';
        });
        recalc();
    };

    // 2026-05-13: 단면/양면 선택
    window._soPickSide = function (side) {
        state.wallSide = (side === 'double') ? 'double' : 'single';
        document.querySelectorAll('.so-side-btn').forEach(function (b) {
            var on = b.dataset.side === state.wallSide;
            b.classList.toggle('active', on);
            b.style.background = on ? '#4338ca' : '#fff';
            b.style.color = on ? '#fff' : '#451a03';
            b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
        });
        var backWrap = document.getElementById('soBackUploadWrap');
        if (backWrap) backWrap.style.display = (state.wallSide === 'double') ? '' : 'none';
        recalc();
        updateButtons();
    };

    // 2026-05-13: 뒷면 파일 변경 핸들러 — 미리보기 포함
    window._soOnBackFileChange = async function (files) {
        if (!files || !files.length) return;
        var f = files[0];
        var name = (f.name || '').toLowerCase();
        var isPdf = name.endsWith('.pdf') || f.type === 'application/pdf';
        var isPng = name.endsWith('.png') || f.type === 'image/png';
        var isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg') || f.type === 'image/jpeg';
        if (!(isPdf || isPng || isJpg)) {
            alert('PDF · PNG · JPG 파일만 가능합니다.');
            return;
        }
        if (f.size > MAX_FILE_BYTES) {
            alert('10MB를 초과합니다.');
            return;
        }
        state.fileBack = f;
        state.thumbDataUrlBack = null;
        // 일단 빠르게 placeholder 표시
        renderBackUploadDone();
        // PDF면 PDF.js 로 첫 페이지 → dataURL (앞면과 동일한 처리)
        try {
            if (isPdf) {
                var r = await pdfFirstPageToDataUrl(f);
                state.thumbDataUrlBack = r.dataUrl;
            } else {
                var r2 = await imageDataUrlWithDims(f);
                state.thumbDataUrlBack = r2.dataUrl;
            }
        } catch (e) {
            console.warn('[simple_order] back thumb 생성 실패:', e);
        }
        renderBackUploadDone();
    };

    function renderBackUploadDone() {
        var zone = document.getElementById('soBackUpload');
        if (!zone || !state.fileBack) return;
        zone.classList.add('done');
        var f = state.fileBack;
        var sizeMB = (f.size / 1024 / 1024).toFixed(2);
        var safe = (typeof escapeHtml === 'function') ? escapeHtml(f.name) : String(f.name).replace(/[<>"'&]/g, function(c){
            return ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c];
        });
        // 썸네일 — dataUrl 있으면 이미지, 없으면 (변환 중) 아이콘
        var thumbInner;
        if (state.thumbDataUrlBack) {
            thumbInner = '<img src="' + state.thumbDataUrlBack + '" style="max-width:100%; max-height:100%; object-fit:contain; display:block; background:#fff;" />';
        } else if (f.type === 'application/pdf') {
            thumbInner = '<div style="font-size:36px; color:#dc2626;">📄</div><div style="font-size:11px; color:#6b7280; margin-top:4px;">변환 중...</div>';
        } else {
            thumbInner = '<div style="font-size:36px; color:#9ca3af;">🖼️</div>';
        }
        var thumbHtml =
            '<div class="so-back-thumb" style="' +
              'width:280px; max-width:100%; height:200px; ' +
              'margin:0 auto 10px; ' +
              'background:#fff; border:1.5px solid #7c3aed; border-radius:8px; ' +
              'display:flex; align-items:center; justify-content:center; ' +
              'overflow:hidden; padding:8px; box-sizing:border-box;">' +
              thumbInner +
            '</div>';
        zone.innerHTML =
            '<input type="file" id="soBackFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" onchange="window._soOnBackFileChange(this.files)" style="display:none" />' +
            thumbHtml +
            '<div style="font-weight:700; color:#451a03; font-size:13px; text-align:center;">✅ ' + safe + '</div>' +
            '<div style="font-size:11px; color:#6b7280; margin-top:2px; text-align:center;">' + sizeMB + ' MB</div>' +
            '<button type="button" onclick="event.stopPropagation();document.getElementById(\'soBackFile\').click()" ' +
              'style="display:block; margin:8px auto 0; padding:5px 12px; border:1px solid #d1d5db; background:#fff; border-radius:6px; cursor:pointer; font-size:12px; font-family:inherit;">변경</button>';
        zone.onclick = null;
        wireUploadEvents();
        updateButtons();
    }

    // 2026-05-13: 추가 옵션 체크박스 토글
    window._soToggleAddon = function (inp) {
        var code = inp.dataset.addonCode;
        var isLight = inp.dataset.addonLight === '1';
        if (!state.selectedAddons) state.selectedAddons = {};
        if (!state.addonQuantities) state.addonQuantities = {};
        if (inp.checked) {
            state.selectedAddons[code] = code;
            // 조명이면 가로(m), 아크릴 굿즈면 제품 수량과 동일, 그 외는 1개
            if (isLight) {
                state.addonQuantities[code] = state.wallWidth || 1;
            } else if (state.isAcrylicGoods) {
                state.addonQuantities[code] = state.qty || 1;
            } else {
                state.addonQuantities[code] = 1;
            }
        } else {
            delete state.selectedAddons[code];
            delete state.addonQuantities[code];
        }
        recalc();
    };

    // 2026-05-14: 아크릴 굿즈 — 제품 수량 변경 시 체크된 모든 부자재 수량을 제품 수량과 동일하게 동기화
    function _soSyncAcrylicAddonQty() {
        if (!state.isAcrylicGoods) return;
        if (!state.selectedAddons || !state.addonQuantities) return;
        var newQty = state.qty || 1;
        Object.keys(state.selectedAddons).forEach(function (code) {
            state.addonQuantities[code] = newQty;
        });
    }

    window._soQtyChg = function(delta) {
        const input = document.getElementById('soQty');
        const cur = parseInt(input.value) || 1;
        const next = Math.max(1, Math.min(9999, cur + delta));
        input.value = next;
        state.qty = next;
        _soSyncAcrylicAddonQty();
        recalc();
    };

    window._soOnQtyInput = function() {
        const input = document.getElementById('soQty');
        const v = Math.max(1, Math.min(9999, parseInt(input.value) || 1));
        if (v !== parseInt(input.value)) input.value = v;
        state.qty = v;
        _soSyncAcrylicAddonQty();
        recalc();
    };

    // ─────────────────────────────────────────────
    // 모달 열기 / 닫기
    // ─────────────────────────────────────────────
    // 2026-05-12: 화면 전환 시 background 깜빡임 방지
    function _showLoadingShield() {
        var sh = document.getElementById('soLoadingShield');
        if (sh) sh.style.display = 'flex';
    }
    function _hideLoadingShield() {
        var sh = document.getElementById('soLoadingShield');
        if (sh) sh.style.display = 'none';
    }

    // 2026-05-13: 자체 카테고리 nav 제거 — 메인 페이지의 #topCatMenu 가 z-index 60000 으로
    // simple_order overlay 위에서 표시됨. 별도 nav 코드 불필요.
    var _soNavPopulated = false;  // (사용 안 함, 호환성 유지)
    async function populateSoCategoryNav() {
        var navEl = document.getElementById('soCategoryNav');
        if (!navEl || _soNavPopulated) return;
        var sb = getSb();
        if (!sb) return;
        try {
            var res = await sb.from('admin_top_categories').select('*').order('sort_order', { ascending: true });
            var topCats = res && res.data;
            if (!topCats || !topCats.length) return;
            var lang = (function(){
                if (window.CURRENT_LANG) return window.CURRENT_LANG;
                var h = (location.hostname || '').toLowerCase();
                if (h.indexOf('cafe0101') >= 0) return 'ja';
                if (h.indexOf('cafe3355') >= 0) return 'en';
                return 'ko';
            })();
            navEl.innerHTML = '<div style="display:inline-flex; gap:8px; align-items:center;">' +
                topCats.map(function(top){
                    var name = top.name;
                    if (lang === 'ja' && top.name_jp) name = top.name_jp;
                    else if (lang === 'en' && top.name_us) name = top.name_us;
                    else if (lang === 'zh' && top.name_cn) name = top.name_cn;
                    var safe = String(name || '').replace(/[<>"'&]/g, function(c){
                        return ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c];
                    });
                    return '<button type="button" class="so-nav-btn" data-top-code="' + String(top.code || '').replace(/"/g,'&quot;') + '" ' +
                        'style="display:inline-block; padding:8px 14px; border-radius:20px; background:#f3f4f6; color:#374151; border:none; cursor:pointer; font-size:13px; font-weight:700; white-space:nowrap; transition:all 0.15s;" ' +
                        'onmouseover="this.style.background=\'#dbeafe\'; this.style.color=\'#1d4ed8\';" ' +
                        'onmouseout="this.style.background=\'#f3f4f6\'; this.style.color=\'#374151\';">' +
                        safe + '</button>';
                }).join('') +
                '</div>';
            // 2026-05-12: 클릭 핸들러 — productPickerModal 열고 해당 카테고리 탭 자동 클릭.
            // 사용자가 봤던 정상 화면 (sub-카테고리 + 상품 카드들) 이 그 모달 안에 표시됨.
            navEl.querySelectorAll('.so-nav-btn').forEach(function(btn){
                btn.onclick = function(){
                    var code = btn.dataset.topCode;
                    _showLoadingShield();
                    var cl = window.CURRENT_LANG || lang;
                    var langMap = {ja:'ja',en:'en',zh:'zh',ar:'ar',es:'es',de:'de',fr:'fr',kr:'ko'};
                    // 특수 케이스 — 별도 페이지 navigate
                    if (code === 'paper_display') {
                        var psLang = langMap[cl] || '';
                        location.href = '/paper-stand' + (psLang && psLang !== 'ko' ? '?lang=' + psLang : '');
                        return;
                    }
                    if (code === 'Wholesale Board Prices') {
                        var rbLang = langMap[cl] || '';
                        location.href = '/raw-board' + (rbLang && rbLang !== 'ko' ? '?lang=' + rbLang : '');
                        return;
                    }
                    if (code === '22222') {
                        // 2026-05-13: lang 보존 (cafe0101 → ja, cafe3355 → en, 그 외 ?lang= 명시)
                        var fbLang = langMap[cl] || '';
                        location.href = '/fabric' + (fbLang && fbLang !== 'ko' ? '?lang=' + fbLang : '');
                        return;
                    }
                    if (code === 'user_artwork') {
                        location.href = '/#artworkMarketBanner';
                        return;
                    }
                    // 일반 카테고리: productPickerModal 열기 + 해당 탭 자동 클릭 + simple_order 닫기
                    if (typeof window.openProductPickerModal === 'function') {
                        try { window.openProductPickerModal(); } catch (e) { console.warn('[so-nav]', e); }
                        // 모달 내 탭 클릭 (DOM 복제 완료 대기 위해 약간 지연)
                        setTimeout(function(){
                            var modalTab = document.querySelector('#modalCategoryTabs .cat-tab[data-top-code="' + (CSS && CSS.escape ? CSS.escape(code) : code.replace(/"/g,'\\"')) + '"]');
                            if (modalTab) {
                                modalTab.click();
                            } else {
                                // 모달 탭이 아직 없으면 원본 탭 클릭으로 fallback
                                var origTab = document.querySelector('#topCategoryTabs .cat-tab[data-top-code="' + (CSS && CSS.escape ? CSS.escape(code) : code.replace(/"/g,'\\"')) + '"]');
                                if (origTab) origTab.click();
                            }
                            if (window.closeSimpleOrderModal) window.closeSimpleOrderModal();
                            _hideLoadingShield();
                        }, 250);
                    } else {
                        // openProductPickerModal 없으면 메인페이지 navigate + sessionStorage
                        try { sessionStorage.setItem('pendingTopCat', code); } catch (e) {}
                        location.href = '/';
                    }
                };
            });
            _soNavPopulated = true;
        } catch (e) { console.warn('[so-nav]', e); }
    }

    // 2026-05-13: 외부 코드 (매니저 견적 빠른 주문 등) 가 결제 모달을 띄우기 전 DOM 준비
    window._soEnsureModalReady = function () {
        if (!document.getElementById('simpleOrderModal')) {
            injectStyles();
            injectModal();
        }
    };

    window.openSimpleOrderModal = async function(productCode, productData) {
        injectStyles();
        injectModal();
        // 2026-05-13: 자체 nav 제거 — 메인의 #topCatMenu 가 z-index 60000 으로 표시됨
        state = { product: null, file: null, fileBack: null, thumbDataUrl: null, thumbDataUrlBack: null, qty: 1 };

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
        // 2026-05-13: 가벽이면 일반 설명 숨기고 가벽 전용 안내 카드 표시
        var descEl = document.getElementById('soDesc');
        var wallGuide = document.getElementById('soWallGuide');
        var isWallNow = _soIsWallProduct(p);
        if (descEl) descEl.style.display = isWallNow ? 'none' : '';
        if (wallGuide) wallGuide.style.display = isWallNow ? '' : 'none';
        const img = document.getElementById('soImg');
        const imgUrl = pickImg(p);
        if (imgUrl) { img.src = imgUrl; img.style.display = ''; img.onerror = () => { img.style.display = 'none'; }; }
        else { img.style.display = 'none'; }

        // 2026-05-14: 칼선 도안 다운로드 — admin_products.cutline_url 있을 때만 표시
        var cutWrap = document.getElementById('soCutlineDownload');
        var cutBtn = document.getElementById('soCutlineDownloadBtn');
        var cutlineUrl = p.cutline_url || p.cutlineUrl || '';
        if (cutWrap && cutBtn) {
            if (cutlineUrl) {
                cutBtn.href = cutlineUrl;
                // 파일명 추출 — URL 끝부분 또는 제품코드_cutline 기본값
                try {
                    var pathPart = cutlineUrl.split('?')[0].split('#')[0];
                    var fileName = pathPart.substring(pathPart.lastIndexOf('/') + 1) || ((p.code || 'cutline') + '_cutline');
                    cutBtn.setAttribute('download', fileName);
                } catch(e) { cutBtn.setAttribute('download', ''); }
                cutWrap.style.display = '';
            } else {
                cutWrap.style.display = 'none';
            }
        }

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
        // 2026-05-13: 가벽 카테고리 감지 + 추가 옵션 / 노트 초기화
        state.selectedAddons = {};
        state.addonQuantities = {};
        // 2026-05-14: 가벽 변종 분기 — 파티션 / 강화 골판지 / 단면 전용 / 기본
        state.isPartition = _soIsPartitionProduct(p);
        state.isReinforcedWall = _soIsReinforcedWall(p);
        state.isSingleSideWall = state.isReinforcedWall ? false : _soIsSingleSideWall(p);
        if (state.isReinforcedWall) {
            state.wallWidth = 1;      // 1m 고정
            state.wallHeight = 2.2;   // 2.2m 고정
        } else if (state.isPartition) {
            state.wallWidth = 3;      // 기본 가로 3m (1~10m 범위)
            state.wallHeight = 1.2;   // 기본 세로 1.2m
        } else {
            state.wallWidth = 3;
            state.wallHeight = 2.4;
        }
        state.wallSide = 'single'; // single / double — 양면이면 가격 2배
        state.fileBack = null;
        state.fileBackData = null;
        state.itemNote = '';
        state.shipMethod = 'self_pickup';
        state.scheduleDate = '';
        state.scheduleTime = '';
        state.removalDate = '';
        state.removalTime = '';
        var noteEl = document.getElementById('soItemNote'); if (noteEl) noteEl.value = '';

        // 가벽 카테고리 감지 (hb_dw_* 또는 hb_display_wall 등)
        state.isWall = _soIsWallProduct(p);
        state.isPhotozone = _soIsPhotozoneProduct(p);
        // 2026-05-13: 허니콤 자유인쇄커팅 감지 (hb_pt_*)
        state.isCutPrint = _soIsCutPrintProduct(p);
        state.cutSize = 'full';
        state.bundleShipping = false;
        // 2026-05-13: 허니콤 박스 감지 (hb_bx_*) — 가로/세로/높이로 동적 가격
        state.isBox = _soIsBoxProduct(p);
        state.boxW = parseInt(p.width_mm || 400, 10) || 400;
        state.boxH = parseInt(p.height_mm || 400, 10) || 400;
        state.boxD = 400;
        state.boxUnitPrice = 0;
        state.boxNesting = null;
        var wallSec = document.getElementById('soWallSizeSection');
        if (wallSec) wallSec.style.display = state.isWall ? '' : 'none';
        // 2026-05-14: 가벽 변종별 옵션 재구성 + 인쇄면 UI 토글
        if (state.isWall) {
            var variant = state.isReinforcedWall ? 'reinforced'
                        : state.isPartition ? 'partition'
                        : 'default';
            _soRebuildWallSizeOptions(variant);
            // 인쇄면 row: 허니콤 가벽 (기본 변종) 만 표시
            var sideRow = document.getElementById('soWallSideRow');
            if (sideRow) {
                sideRow.style.display = (state.isReinforcedWall || state.isPartition || state.isSingleSideWall) ? 'none' : '';
            }
            // wallSide 강제 세팅 — 강화 골판지=양면, 단면 전용=단면, 기본=단면
            if (state.isReinforcedWall) state.wallSide = 'double';
            else state.wallSide = 'single';
            // 단면/양면 버튼 활성화 표시도 동기화 (보이지 않더라도 안전하게)
            document.querySelectorAll('.so-side-btn').forEach(function (b) {
                var on = b.dataset.side === state.wallSide;
                b.classList.toggle('active', on);
                b.style.background = on ? '#4338ca' : '#fff';
                b.style.color = on ? '#fff' : '#451a03';
                b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
            });
        }
        // 자유인쇄커팅 사이즈 섹션
        var cutSec = document.getElementById('soCutPrintSizeSection');
        if (cutSec) cutSec.style.display = state.isCutPrint ? '' : 'none';
        // 박스 사이즈 입력 섹션 + 초기 계산
        var boxSec = document.getElementById('soBoxSizeSection');
        if (boxSec) boxSec.style.display = state.isBox ? '' : 'none';
        if (state.isBox) {
            var bwEl = document.getElementById('soBoxW'); if (bwEl) bwEl.value = state.boxW;
            var bhEl = document.getElementById('soBoxH'); if (bhEl) bhEl.value = state.boxH;
            var bdEl = document.getElementById('soBoxD'); if (bdEl) bdEl.value = state.boxD;
            // 초기 가격 계산 (비동기)
            if (typeof window._soOnBoxDimsChange === 'function') window._soOnBoxDimsChange();
        }
        // 2026-05-13: 허니콤보드 원판인쇄 — 양면이면 단가 2배 자동
        state.isRawBoard = _soIsRawBoardProduct(p);
        state.isRawBoardDouble = _soIsRawBoardDoubleSided(p);

        // 2026-05-13: 받침대 옵션이 필요한 상품 (등신대 + 자유인쇄커팅)
        state.needsBaseStand = _soNeedsBaseStand(p);
        state.baseStand = 'none';
        var baseSec = document.getElementById('soBaseStandSection');
        if (baseSec) baseSec.style.display = state.needsBaseStand ? '' : 'none';
        // 받침대 버튼 초기화
        document.querySelectorAll('.so-base-btn').forEach(function (b) {
            var on = b.dataset.base === 'none';
            b.classList.toggle('active', on);
            b.style.background = on ? '#4338ca' : '#fff';
            b.style.color = on ? '#fff' : '#451a03';
            b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
        });
        state.isStandee = _soIsStandeeProduct(p);

        // 2026-05-13: 사용자 정의 사이즈 (현수막·실사출력) — 가벽/박스/자유인쇄커팅 외
        state.isCustomSize = _soIsCustomSizeProduct(p);
        // 2026-05-14: 아크릴 굿즈 (키링·코롯도 등) — min 1cm + 고리/부자재 자동 표시
        state.isAcrylicGoods = _soIsAcrylicGoodsProduct(p);
        // 2026-05-14: 기본 사이즈 — 아크릴 굿즈는 5×5cm (보통 키링 사이즈), 그 외는 width_mm/height_mm 또는 100×60
        if (state.isAcrylicGoods) {
            state.customW = parseInt(p.width_mm ? p.width_mm/10 : 5, 10) || 5;
            state.customH = parseInt(p.height_mm ? p.height_mm/10 : 5, 10) || 5;
            // width_mm 이 100mm (1cm) 같은 너무 큰 값으로 잘못 저장된 경우는 5로 강제
            if (state.customW > 30) state.customW = 5;
            if (state.customH > 30) state.customH = 5;
        } else {
            state.customW = parseInt(p.width_mm ? p.width_mm/10 : 100, 10) || 100;
            state.customH = parseInt(p.height_mm ? p.height_mm/10 : 60, 10) || 60;
        }
        state.customUnitPrice = 0;
        var custSec = document.getElementById('soCustomSizeSection');
        if (custSec) custSec.style.display = state.isCustomSize ? '' : 'none';
        if (state.isCustomSize) {
            var cwEl = document.getElementById('soCustomW'); if (cwEl) cwEl.value = state.customW;
            var chEl = document.getElementById('soCustomH'); if (chEl) chEl.value = state.customH;
            if (typeof window._soOnCustomDimsChange === 'function') window._soOnCustomDimsChange();
        }
        // 2026-05-13: 가벽이면 주문 수량 섹션 숨김 (가로 m 수가 수량 역할)
        var qtySec = document.getElementById('soQtySection');
        if (qtySec) qtySec.style.display = state.isWall ? 'none' : '';
        // 2026-05-13: 배송만 사용하는 상품 — 허니콤 가벽 제외 모든 허니콤 (박스/자유인쇄커팅/원판 등)
        state.isDeliveryOnly = _soUsesDeliveryShipping(p);
        // 2026-05-13: 택배배송 가능 (배너·인스타판넬)
        state.isParcelShip = _soIsParcelShipProduct(p);
        // 2026-05-13: 포맥스/폼보드 (대형택배 3만)
        state.isForexFoam = _soIsForexFoamProduct(p);
        // 2026-05-13: 일반 인쇄물 (광고/상업/홈/굿즈/기타) — 5천원 묶음 소형택배
        state.isGeneralPrint = _soIsGeneralPrintProduct(p) && !state.isForexFoam;
        // 시공/배송 일정 섹션 — 가벽·포토존·배송전용허니콤·포맥스폼보드·일반인쇄물 모두 표시 (사실상 모든 상품)
        var schedSec = document.getElementById('soScheduleSection');
        var anyShipScope = state.isWall || state.isPhotozone || state.isDeliveryOnly || state.isForexFoam || state.isGeneralPrint;
        if (schedSec) schedSec.style.display = anyShipScope ? '' : 'none';
        // 2026-05-13: 카테고리별 ship 버튼 화이트리스트
        var installKeys = ['metro_install', 'metro_weekend', 'metro_install_removal', 'regional_truck', 'regional_install'];
        var hbDeliveryKeys = ['metro_delivery', 'regional_delivery'];
        var allowed; // 노출할 ship 버튼 키 집합
        if (state.isWall || state.isPhotozone) {
            // 가벽/포토존 — 시공 옵션
            allowed = ['self_pickup'].concat(installKeys);
        } else if (state.isDeliveryOnly) {
            // 가벽 외 허니콤 — 수도권/지방 배송 (+ 배너·인스타판넬이면 택배도)
            allowed = ['self_pickup'].concat(hbDeliveryKeys);
            if (state.isParcelShip) allowed.push('parcel_shipping');
            // 등신대·자유인쇄커팅이면 60×40 컴팩트 택배도 추가
            if (state.isStandee || _soIsCutPrintProduct(p)) allowed.push('compact_parcel');
        } else if (state.isForexFoam) {
            // 포맥스·폼보드 — 대형택배만
            allowed = ['self_pickup', 'large_parcel'];
        } else if (state.isGeneralPrint) {
            // 일반 인쇄물 — 묶음 소형택배만
            allowed = ['self_pickup', 'small_parcel'];
        } else {
            allowed = ['self_pickup'];
        }
        // 2026-05-14: 택배 옵션이 있는 상품은 택배를 기본 선택 (본사 방문 대신)
        var parcelKeys = ['parcel_shipping', 'large_parcel', 'small_parcel', 'compact_parcel'];
        var defaultShip = 'self_pickup';
        for (var pi = 0; pi < parcelKeys.length; pi++) {
            if (allowed.indexOf(parcelKeys[pi]) >= 0) { defaultShip = parcelKeys[pi]; break; }
        }
        state.shipMethod = defaultShip;
        document.querySelectorAll('.so-ship-btn').forEach(function (b) {
            var k = b.dataset.ship;
            b.style.display = (allowed.indexOf(k) >= 0) ? '' : 'none';
            b.classList.toggle('active', k === defaultShip);
            b.style.opacity = '1';
            b.style.pointerEvents = '';
        });
        // 묶음배송 버튼 — 가벽·포토존 제외 모두 표시
        var bundleBtn = document.getElementById('soBundleShipBtn');
        if (bundleBtn) {
            var showBundle = state.isDeliveryOnly || state.isForexFoam || state.isGeneralPrint;
            bundleBtn.style.display = showBundle ? '' : 'none';
            bundleBtn.style.background = '#f0fdf4';
            bundleBtn.style.color = '#15803d';
            bundleBtn.style.borderStyle = 'dashed';
        }
        // 가벽 사이즈 폼 초기값 동기화 — 변종별 기본값 매칭
        var wwEl = document.getElementById('soWallWidth');
        var whEl = document.getElementById('soWallHeight');
        if (state.isReinforcedWall) {
            if (wwEl) wwEl.value = '1';
            if (whEl) whEl.value = '2.2';
        } else if (state.isPartition) {
            if (wwEl) wwEl.value = '3';
            if (whEl) whEl.value = '1.2';
        } else {
            if (wwEl) wwEl.value = '3';
            if (whEl) whEl.value = '2.4';
        }
        // 2026-05-13: 자유인쇄커팅 사이즈 초기화 (한판)
        document.querySelectorAll('.so-cut-btn').forEach(function (b) {
            var on = b.dataset.cut === 'full';
            b.classList.toggle('active', on);
            b.style.background = on ? '#4338ca' : '#fff';
            b.style.color = on ? '#fff' : '#451a03';
            b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
        });
        // 2026-05-13: 단면/양면 초기화 (단면)
        document.querySelectorAll('.so-side-btn').forEach(function (b) {
            var on = b.dataset.side === 'single';
            b.classList.toggle('active', on);
            b.style.background = on ? '#4338ca' : '#fff';
            b.style.color = on ? '#fff' : '#451a03';
            b.style.borderColor = on ? '#4338ca' : '#e7e5e4';
        });
        // 2026-05-14: 강화 골판지 가벽은 기본 양면 → 뒷면 업로드 영역 즉시 표시
        var backWrap = document.getElementById('soBackUploadWrap');
        if (backWrap) backWrap.style.display = (state.isReinforcedWall) ? '' : 'none';
        // 2026-05-13/14: 배송 버튼 시각 상태 — state.shipMethod (위 default 결정 결과) 와 동기화
        document.querySelectorAll('.so-ship-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.ship === state.shipMethod);
        });
        var dateWrap = document.getElementById('soScheduleDateWrap'); if (dateWrap) dateWrap.style.display = 'none';
        var remWrap = document.getElementById('soRemovalWrap'); if (remWrap) remWrap.style.display = 'none';
        var bdBox = document.getElementById('soShipBreakdown'); if (bdBox) bdBox.innerHTML = '';

        // 상품 추가 옵션 로드 (admin_addons 매칭)
        await _soPopulateAddons(p);

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
        return uploadFileGeneric(state.file);
    }
    // 2026-05-13: 임의 파일 업로드 (앞면/뒷면 공용)
    async function uploadFileGeneric(file) {
        const sb = getSb();
        if (!sb) throw new Error('Supabase not available');
        if (!file) throw new Error('No file');
        const ts = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = 'simple_order/' + ts + '_' + safeName;
        const { error } = await sb.storage.from('design').upload(path, file);
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
        // 2026-05-13: 전달사항 + 선택된 addon + 가벽 사이즈 정보 + 시공/배송 일정 캡처
        var noteEl = document.getElementById('soItemNote');
        var itemNote = noteEl ? (noteEl.value || '').trim() : '';
        var sdEl = document.getElementById('soScheduleDate');
        var stEl = document.getElementById('soScheduleTime');
        var rdEl = document.getElementById('soRemovalDate');
        var rtEl = document.getElementById('soRemovalTime');
        var shipping = null;
        // 2026-05-13: 묶음배송이면 별도 처리 — fee 0, method='bundle_shipping'
        if (state.bundleShipping) {
            shipping = {
                method: 'bundle_shipping',
                fee: 0,
                upgrade_reason: null,
                delivery_date: '',
                delivery_time: '',
                removal_date: '',
                removal_time: ''
            };
        } else if (state.shipMethod && state.shipMethod !== 'self_pickup') {
            // 2026-05-13: 야간/주말 자동 보정된 실제 fee 사용
            var actualFee = (typeof _soComputeShipFee === 'function') ? _soComputeShipFee() : (state.shipFee || 0);
            shipping = {
                method: state.shipMethod,
                fee: actualFee,
                upgrade_reason: state._shipUpgradeReason || null,
                delivery_date: sdEl ? sdEl.value : '',
                delivery_time: stEl ? stEl.value : '',
                removal_date: rdEl ? rdEl.value : '',
                removal_time: rtEl ? rtEl.value : ''
            };
        }
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
            qty: state.isWall ? (state.wallWidth || 1) : state.qty,
            selectedAddons: Object.assign({}, state.selectedAddons || {}),
            addonQuantities: Object.assign({}, state.addonQuantities || {}),
            // 2026-05-13: 가벽 사이즈 (가로/세로 m)
            wallSize: state.isWall ? { w_m: state.wallWidth, h_m: state.wallHeight } : null,
            // 2026-05-13: 단면/양면 (가벽만)
            wallSide: state.isWall ? (state.wallSide || 'single') : null,
            // 2026-05-13: 자유인쇄커팅 사이즈 (한판/반판) + 묶음배송 여부
            cutPrint: state.isCutPrint ? { size: state.cutSize || 'full' } : null,
            bundleShipping: !!state.bundleShipping,
            // 2026-05-13: 허니콤 박스 사이즈 + 계산된 단가 (장바구니/주문관리에서 재계산 안전 보존)
            boxSize: state.isBox ? { w: state.boxW, h: state.boxH, d: state.boxD, unit: state.boxUnitPrice, nesting: state.boxNesting } : null,
            // 2026-05-13: 사용자 정의 사이즈 (현수막·실사출력) — W×H cm + 계산된 단가
            customSize: state.isCustomSize ? { w_cm: state.customW, h_cm: state.customH, unit: state.customUnitPrice, area_m2: state.customAreaM2 } : null,
            // 2026-05-13: 허니콤보드 원판인쇄 양면 플래그 (단가 2배 재계산용)
            rawBoardDouble: !!state.isRawBoardDouble,
            // 2026-05-13: 받침대 옵션 (등신대·자유인쇄커팅)
            baseStand: (state.baseStand && state.baseStand !== 'none') ? {
                key: state.baseStand,
                fee: (BASE_STAND_OPTS[state.baseStand] && BASE_STAND_OPTS[state.baseStand].fee) || 0,
                label: (BASE_STAND_OPTS[state.baseStand] && BASE_STAND_OPTS[state.baseStand].label_ko) || ''
            } : null,
            // 2026-05-13: 뒷면 파일 (양면 가벽만) — 업로드는 _soSubmitOrder 에서 처리
            backFileName: (state.wallSide === 'double' && state.fileBack) ? state.fileBack.name : null,
            backFileType: (state.wallSide === 'double' && state.fileBack) ? state.fileBack.type : null,
            backFileSize: (state.wallSide === 'double' && state.fileBack) ? state.fileBack.size : null,
            _backFileBlob: (state.wallSide === 'double' && state.fileBack) ? state.fileBack : null,  // 임시 — 결제 시 업로드
            // 2026-05-13: 전달사항 (제작 요청)
            itemNote: itemNote,
            // 2026-05-13: 시공/배송 일정 (가벽/포토존만)
            shipping: shipping,
            _simple: { unit: calc.unit, subtotal: calc.subtotal, discountPct: calc.tierPct, discount: calc.discount, final: calc.final },
        };
    }

    // 2026-05-12: 도메인 통합 — 패브릭(__source='cotton-print') 항목은 cotton_designer 드로어에서 렌더,
    // simple_order 드로어는 일반 상품만 표시. 쓰기 시 패브릭 항목은 그대로 보존.
    function isFabricItem(it) {
        return it && (it.__source === 'cotton-print' || it.fabricCode || it.orderWcm != null);
    }
    function readCart() {
        try {
            var all = JSON.parse(localStorage.getItem(CART_KEY) || '[]') || [];
            return all.filter(function (it) { return !isFabricItem(it); });
        } catch (e) { return []; }
    }
    function writeCart(arr) {
        try {
            // 기존 패브릭 항목 보존 + 새 일반상품 배열 머지
            var existing = [];
            try { existing = JSON.parse(localStorage.getItem(CART_KEY) || '[]') || []; } catch (e) {}
            var fabrics = existing.filter(isFabricItem);
            localStorage.setItem(CART_KEY, JSON.stringify(fabrics.concat(arr || [])));
        } catch (e) {}
    }

    // 2026-05-12: 중복 호출 방지 (빠른 더블 클릭 또는 외부 트리거 중복)
    var _soInFlight = false;

    async function doAddToCart() {
        if (_soInFlight) {
            console.warn('[simple_order] doAddToCart 이미 진행 중 — 중복 호출 무시');
            return false;
        }
        if (!state.product || !state.file) return false;
        _soInFlight = true;
        const btnC = document.getElementById('soBtnCart');
        const btnB = document.getElementById('soBtnBuy');
        if (btnC) btnC.disabled = true;
        if (btnB) btnB.disabled = true;
        showStatus(tr('📤 파일 업로드 중...', '📤 アップロード中...', '📤 Uploading...'), 'ok');
        try {
            const { url, path } = await uploadFile();
            // 2026-05-13: 양면 가벽이면 뒷면 파일도 같이 업로드
            let backUrl = null, backPath = null;
            if (state.wallSide === 'double' && state.fileBack) {
                showStatus(tr('📤 뒷면 파일 업로드 중...', '📤 裏面ファイル...', '📤 Uploading back...'), 'ok');
                const backResult = await uploadFileGeneric(state.fileBack);
                backUrl = backResult.url;
                backPath = backResult.path;
            }
            const item = buildCartItem(url, path);
            // 뒷면 파일 URL 부착 (localStorage 호환 — Blob 직접 저장 안 함)
            if (backUrl) {
                item.backFileUrl = backUrl;
                item.backFilePath = backPath;
                delete item._backFileBlob;
            }
            const cart = readCart();
            cart.push(item);
            writeCart(cart);
            // 2026-05-12: 중복 push 방지 — writeCart 후 localStorage 가 cart_sync 의 tagItem 으로
            // __cart_id 부여됨. cartData 도 그 최신 상태로 sync 해야 renderCart 가 중복 push 안 함.
            try {
                if (Array.isArray(window.cartData)) {
                    var freshAll = JSON.parse(localStorage.getItem(CART_KEY) || '[]') || [];
                    window.cartData.length = 0;
                    freshAll.forEach(function (i) { window.cartData.push(i); });
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
            _soInFlight = false;
        }
    }

    window._soAddCart = async function() {
        if (_soInFlight) return;
        const ok = await doAddToCart();
        if (ok) {
            // 카트 드로어를 우측에서 슬라이드해서 보여줌 (모달은 그대로 유지)
            renderSoCart();
            setTimeout(() => window._soToggleCart(true), 200);
        }
    };

    window._soBuyNow = async function() {
        if (_soInFlight) return;
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
        // 2026-05-13: _soCalcItemPrice 와 동일 로직 사용 — 가벽/addon/shipping/PRO 할인 모두 반영
        const isWall = !!(item.wallSize);
        const qty = item.qty || 1;
        const unit = (item._simple && item._simple.unit) || (item.product && item.product.price) || 0;
        const subtotal = unit * qty;
        let tierPct = 0;
        if (!isWall) {
            const tier = getDiscountTier(qty);
            tierPct = tier.pct;
        }
        const discount = Math.round(subtotal * tierPct / 100);
        // final 은 _soCalcItemPrice 통해 정확히 계산 (addon + shipping + PRO 할인 포함)
        const final = (typeof _soCalcItemPrice === 'function')
            ? _soCalcItemPrice(item)
            : subtotal - discount;
        return { unit, subtotal, discount, final, tierPct };
    }

    function renderSoCart() {
        const list = document.getElementById('soCartList');
        const totalEl = document.getElementById('soCartTotalAmt');
        const countEl = document.getElementById('soCartCount');
        const titleCountEl = document.getElementById('soCartCountTitle');
        const checkBtn = document.getElementById('soCartCheckoutBtn');
        if (!list || !totalEl) return;

        // 2026-05-12: 통합 카트 — 패브릭 + 일반상품 둘 다 렌더
        let allItems = (typeof _soReadAllCart === 'function')
            ? _soReadAllCart()
            : (function(){ try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') || []; } catch(e){ return []; } })();
        // 빈/손상된 항목 방어 필터 (cart_sync 가 놓친 케이스)
        const _isValidItem = function (it) {
            if (!it || typeof it !== 'object') return false;
            if (it.fabricCode || it.fabricName || it.title || it.orderWcm != null) return true;
            if (it.product && (it.product.code || it.product.name)) return true;
            if (it.productCode || it.productName) return true;
            return false;
        };
        allItems = allItems.filter(_isValidItem);
        const isFab = function (it) {
            return it && (it.__source === 'cotton-print' || it.fabricCode || it.orderWcm != null);
        };
        const fabricItems  = allItems.filter(isFab);
        const generalItems = allItems.filter(function (it) { return !isFab(it); });
        const totalCount = allItems.length;

        countEl && (countEl.textContent = totalCount);
        titleCountEl && (titleCountEl.textContent = '(' + totalCount + ')');

        if (totalCount === 0) {
            list.innerHTML = '<div class="so-cart-empty"><i>🛒</i>' +
                tr('장바구니가 비어있습니다', 'カートは空です', 'Your cart is empty') +
                '</div>';
            totalEl.textContent = fmtPrice(0);
            if (checkBtn) checkBtn.disabled = true;
            return;
        }

        let totalAmt = 0;
        const sections = [];

        // 일반상품 섹션
        if (generalItems.length > 0) {
            const genHtml = generalItems.map((item) => {
                const idx = allItems.indexOf(item); // 전체 카트 인덱스 (qty 조절 핸들러용 — 이제 일반 카트 인덱스로 변환 필요)
                const genIdx = generalItems.indexOf(item); // 일반상품 카트 인덱스
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
                                <button class="so-cart-qty-btn" onclick="window._soCartQtyChg(${genIdx}, -1)">−</button>
                                <input type="number" class="so-cart-qty-input" min="1" max="9999"
                                    value="${item.qty || 1}"
                                    onchange="window._soCartQtySet(${genIdx}, this.value)" />
                                <button class="so-cart-qty-btn" onclick="window._soCartQtyChg(${genIdx}, 1)">+</button>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="so-cart-item-price">${fmtPrice(calc.final)}</span>
                                <button class="so-cart-item-remove" onclick="window._soCartRemove(${genIdx})" title="${tr('삭제', '削除', 'Remove')}">🗑</button>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            sections.push(genHtml);
        }

        // 패브릭 섹션 (2026-05-12: 같은 카트 안에 함께 표시)
        if (fabricItems.length > 0) {
            sections.push('<div style="font-size:11px; font-weight:800; color:#64748b; margin:10px 0 6px;">✂️ ' + tr('패브릭', 'ファブリック', 'Fabric') + '</div>');
            const fabHtml = fabricItems.map((it) => {
                const sz = it.orderSize || ((it.orderWcm || (it.orderWmm/10)) + '×' + (it.orderHcm || (it.orderHmm/10)) + 'cm');
                const opts = [it.fabricName, '출력 ' + sz, it.qtyLabel, it.finishName ? '마감: ' + it.finishName : ''].filter(Boolean).join(' · ');
                const thumb = it.thumbDataUrl || it.img || '';
                const allIdx = allItems.indexOf(it);
                totalAmt += (it.price || 0);
                return `
                <div class="so-cart-item">
                    ${thumb
                        ? `<img class="so-cart-item-thumb" src="${escapeHtml(thumb)}" alt="" />`
                        : `<div class="so-cart-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px;">✂️</div>`}
                    <div class="so-cart-item-info">
                        <div class="so-cart-item-name">${escapeHtml(it.title || it.fabricName || '패브릭')}</div>
                        <div class="so-cart-item-meta">${escapeHtml(opts)}</div>
                        <div class="so-cart-item-bottom">
                            <span></span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="so-cart-item-price">${fmtPrice(it.price || 0)}</span>
                                <button class="so-cart-item-remove" onclick="window._soRemoveFabricItem(${allIdx})" title="${tr('삭제', '削除', 'Remove')}">🗑</button>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            sections.push(fabHtml);
        }

        list.innerHTML = sections.join('');
        totalEl.textContent = fmtPrice(totalAmt);
        if (checkBtn) checkBtn.disabled = false;
    }

    // 2026-05-12: 카트 드로어에서 패브릭 항목 삭제
    window._soRemoveFabricItem = function (allIdx) {
        try {
            var all = JSON.parse(localStorage.getItem('chameleon_cart_current') || '[]') || [];
            if (!all[allIdx]) return;
            all.splice(allIdx, 1);
            localStorage.setItem('chameleon_cart_current', JSON.stringify(all));
            renderSoCart();
        } catch (e) {}
    };

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

    window._soGoCheckout = function () {
        // 2026-05-12: 패브릭처럼 빠른 결제 모달 띄우기 — cartPage 우회
        window._soToggleCart(false);
        window._soOpenCheckout();
    };

    // ─────────────────────────────────────────────
    // 2026-05-12: 빠른 결제 모달 (패브릭과 동일 흐름)
    // ─────────────────────────────────────────────
    function _soReadAllCart() {
        try { return JSON.parse(localStorage.getItem('chameleon_cart_current') || '[]') || []; }
        catch (e) { return []; }
    }
    function _soIsFabricItem(it) {
        return it && (it.__source === 'cotton-print' || it.fabricCode || it.orderWcm != null);
    }
    function _soCalcItemPrice(it) {
        if (_soIsFabricItem(it)) return it.price || 0;
        var qty = it.qty || 1;
        var unit = (it.product && it.product.price) || 0;
        // 2026-05-13: 자유인쇄커팅 — 사이즈별 고정 단가
        if (it.cutPrint) {
            unit = (it.cutPrint.size === 'half') ? 100000 : 150000;
        }
        // 2026-05-13: 허니콤 박스 — 저장된 박스 단가 사용 (가로×세로×높이로 산출된 값)
        if (it.boxSize && typeof it.boxSize.unit === 'number') {
            unit = it.boxSize.unit;
        }
        // 2026-05-13: 사용자 정의 사이즈 (현수막 등) — 저장된 단가 사용
        if (it.customSize && typeof it.customSize.unit === 'number') {
            unit = it.customSize.unit;
        }
        // 2026-05-13: 허니콤보드 원판인쇄 양면 → 단가 2배 (재계산 안전)
        if (it.rawBoardDouble || (it.product && _soIsRawBoardDoubleSided(it.product))) {
            unit = unit * 2;
        }
        var subtotal = unit * qty;
        // 가벽 양면 → 가격 2배
        var isDouble = (it.wallSide === 'double');
        if (isDouble) subtotal *= 2;
        var base = subtotal;
        // 가벽 세로 3m → 가로 m당 +5만 (양면이면 2배)
        if (it.wallSize && parseFloat(it.wallSize.h_m) === 3) {
            var hExtra = 50000 * qty;
            if (isDouble) hExtra *= 2;
            base += hExtra;
        }
        // addon 가격
        if (it.selectedAddons && window.ADDON_DB) {
            Object.values(it.selectedAddons).forEach(function (code) {
                var addon = window.ADDON_DB[code];
                if (!addon) return;
                var aQty = (it.addonQuantities && it.addonQuantities[code]) || 1;
                base += (addon.price || 0) * aQty;
            });
        }
        // 2026-05-13: 받침대 옵션 (등신대·자유인쇄커팅)
        if (it.baseStand && typeof it.baseStand.fee === 'number') {
            base += it.baseStand.fee;
        }
        // 2026-05-13: 할인 정책 (단일 항목 가격에는 미적용 — 카트 전체 합산 기준이라 각 항목별로는 base 만 반환)
        // 시공/배송비 합산 (묶음배송이면 0)
        if (it.bundleShipping) {
            // skip — 배송비 0
        } else if (it.shipping && it.shipping.fee) {
            base += (it.shipping.fee || 0);
        }
        return base;
    }

    // 2026-05-13: 매니저 견적 주문 항목 감지 — 할인 중복 방지 (매니저가 이미 할인된 금액을 입력)
    function _soIsManagerQuoteItem(it) {
        if (!it) return false;
        if (it.type === 'manager_quote') return true;
        if (it.product && it.product.category === 'manager_quote') return true;
        if (it.product && typeof it.product.code === 'string' && it.product.code.indexOf('manager_quote_') === 0) return true;
        return false;
    }

    // 2026-05-13: 카트 전체 합계 + 할인 계산 (구매금액 + 구독자 중복)
    function _soCalcCartTotal(cart) {
        if (!Array.isArray(cart)) cart = [];
        var taxBase = 0;          // 할인 적용 대상 (일반 상품가 + 옵션)
        var nonDiscountBase = 0;  // 할인 비적용 (매니저 견적 — 이미 협의가)
        var shipTotal = 0;        // 배송비 (할인 미적용)
        cart.forEach(function (it) {
            if (_soIsFabricItem(it)) {
                taxBase += (it.price || 0);
                return;
            }
            var subPrice = _soCalcItemPrice(it);
            var shipFee = (it.shipping && it.shipping.fee) || 0;
            // 2026-05-13: 매니저 견적 주문은 할인 대상에서 제외 (담당자가 이미 할인 반영)
            if (_soIsManagerQuoteItem(it)) {
                nonDiscountBase += (subPrice - shipFee);
            } else {
                taxBase += (subPrice - shipFee);
            }
            shipTotal += shipFee;
        });
        var amountPct = 0;
        if (taxBase >= 10000000) amountPct = 30;
        else if (taxBase >= 5000000) amountPct = 20;
        else if (taxBase >= 1000000) amountPct = 10;
        var proPct = window.isProSubscriber ? 10 : 0;
        var amountDisc = Math.round(taxBase * amountPct / 100);
        var proDisc = Math.round(taxBase * proPct / 100);
        var grandTotal = taxBase + nonDiscountBase - amountDisc - proDisc + shipTotal;
        return {
            taxBase: taxBase,
            nonDiscountBase: nonDiscountBase,
            shipTotal: shipTotal,
            amountPct: amountPct,
            amountDisc: amountDisc,
            proPct: proPct,
            proDisc: proDisc,
            grandTotal: grandTotal
        };
    }
    // 2026-05-13: 카트 합계 등 — fmtPrice 와 동일하게 통화 변환
    function _soFormatPrice(krw) {
        return fmtPrice(krw || 0);
    }

    window._soOpenCheckout = function () {
        var cart = _soReadAllCart();
        if (cart.length === 0) {
            alert('장바구니가 비어있습니다.');
            return;
        }
        _renderCheckoutSummary();
        document.getElementById('soCheckoutOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        // 2026-05-14: 결제수단 초기상태 동기화 (해외 사이트는 증빙 박스 숨김, 한국은 표시)
        if (typeof window._soOnPayMethodChange === 'function') window._soOnPayMethodChange();
    };

    // 2026-05-13: 주문 요약 렌더 — 항목 + 할인 breakdown + 합계
    function _renderCheckoutSummary() {
        var cart = _soReadAllCart();
        var list = document.getElementById('soCoItemList');
        if (!list) return;
        if (cart.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#9ca3af; font-size:13px;">장바구니가 비어있습니다</div>';
            document.getElementById('soCoTotalAmt').textContent = _soFormatPrice(0);
            var subBtn = document.getElementById('soCoSubmitBtn');
            if (subBtn) subBtn.disabled = true;
            return;
        }
        // 항목 카드들
        var itemsHtml = cart.map(function (it, idx) {
            var name, opts;
            if (_soIsFabricItem(it)) {
                name = it.title || it.fabricName || '패브릭';
                var sz = it.orderSize || ((it.orderWcm || (it.orderWmm/10)) + '×' + (it.orderHcm || (it.orderHmm/10)) + 'cm');
                opts = [it.fabricName, '출력 ' + sz, it.qtyLabel, it.finishName ? ('마감: ' + it.finishName) : ''].filter(Boolean).join(' · ');
            } else {
                name = (it.product && (it.product.name || it.product.name_jp || it.product.name_us)) || (it.productName || '상품');
                opts = (it.qty || 1) + '개';
            }
            var p = _soCalcItemPrice(it);
            return '<div class="so-co-summary-item" style="position:relative;">' +
                '<button type="button" onclick="window._soRemoveCheckoutItem(' + idx + ')" title="삭제" ' +
                  'style="position:absolute; top:6px; right:6px; width:22px; height:22px; padding:0; border:none; background:transparent; color:#9ca3af; font-size:16px; cursor:pointer; border-radius:50%; line-height:1;" ' +
                  'onmouseover="this.style.background=\'#fee2e2\'; this.style.color=\'#dc2626\';" ' +
                  'onmouseout="this.style.background=\'transparent\'; this.style.color=\'#9ca3af\';">×</button>' +
                '<div class="so-co-summary-item-name" style="padding-right:24px;">' + name + '</div>' +
                '<div class="so-co-summary-item-opts">' + opts + '</div>' +
                '<div class="so-co-summary-item-price">' + _soFormatPrice(p) + '</div>' +
                '</div>';
        }).join('');

        // 2026-05-13: 카트 전체 할인 계산
        var calc = _soCalcCartTotal(cart);
        var discHtml = '';
        if (calc.amountPct > 0 || calc.proPct > 0 || calc.shipTotal > 0) {
            discHtml = '<div style="margin:10px 0; padding:10px 12px; background:#fff; border-radius:10px; font-size:12px; line-height:1.7;">' +
                '<div style="display:flex; justify-content:space-between; color:#6b7280;"><span>소계 (상품+옵션)</span><span>' + _soFormatPrice(calc.taxBase) + '</span></div>';
            if (calc.amountPct > 0) {
                discHtml += '<div style="display:flex; justify-content:space-between; color:#dc2626;"><span>· 구매금액 ' + calc.amountPct + '% 할인</span><span>-' + _soFormatPrice(calc.amountDisc) + '</span></div>';
            }
            if (calc.proPct > 0) {
                discHtml += '<div style="display:flex; justify-content:space-between; color:#7c3aed;"><span>· PRO 구독자 10% 할인</span><span>-' + _soFormatPrice(calc.proDisc) + '</span></div>';
            }
            if (calc.shipTotal > 0) {
                discHtml += '<div style="display:flex; justify-content:space-between; color:#6b7280;"><span>+ 배송/시공비</span><span>+' + _soFormatPrice(calc.shipTotal) + '</span></div>';
            }
            discHtml += '</div>';
        }

        list.innerHTML = itemsHtml + discHtml;
        document.getElementById('soCoTotalAmt').textContent = _soFormatPrice(calc.grandTotal);
        var subBtn2 = document.getElementById('soCoSubmitBtn');
        if (subBtn2) subBtn2.disabled = false;
    }

    // 2026-05-13: 주문 요약에서 항목 삭제
    window._soRemoveCheckoutItem = function (idx) {
        try {
            var cart = JSON.parse(localStorage.getItem('chameleon_cart_current') || '[]') || [];
            if (idx >= 0 && idx < cart.length) {
                cart.splice(idx, 1);
                localStorage.setItem('chameleon_cart_current', JSON.stringify(cart));
            }
        } catch (e) {}
        _renderCheckoutSummary();
    };

    window._soCloseCheckout = function () {
        document.getElementById('soCheckoutOverlay').classList.remove('open');
        document.body.style.overflow = '';
    };

    // 2026-05-14: 결제수단 토글 — 무통장이면 증빙 박스 표시, 카드면 숨김 (KR 한정)
    window._soOnPayMethodChange = function () {
        var pay = (document.querySelector('input[name="soPayMethod"]:checked') || {}).value || 'bank';
        var box = document.getElementById('soCoReceiptBox');
        if (!box) return;
        // 한국만 노출 (해외는 카드 결제만 사용 → 증빙 메뉴 자체 숨김)
        var isKR = (window.__SITE_CODE || 'KR') === 'KR';
        box.style.display = (pay === 'bank' && isKR) ? '' : 'none';
    };

    // 2026-05-14: 증빙 타입 토글 (세금계산서 / 현금영수증 입력 폼 표시)
    window._soOnReceiptTypeChange = function () {
        var t = (document.querySelector('input[name="soRcptType"]:checked') || {}).value || 'none';
        var taxFs = document.getElementById('soTaxInvoiceFields');
        var cashFs = document.getElementById('soCashReceiptFields');
        if (taxFs) taxFs.style.display = (t === 'tax_invoice') ? 'block' : 'none';
        if (cashFs) cashFs.style.display = (t === 'cash_receipt_biz' || t === 'cash_receipt_personal') ? 'block' : 'none';
        var label = document.getElementById('soCashReceiptLabel');
        var input = document.getElementById('soRcptIdNumber');
        if (label && input) {
            if (t === 'cash_receipt_biz') {
                label.textContent = '사업자번호 *';
                input.placeholder = '000-00-00000';
            } else if (t === 'cash_receipt_personal') {
                label.textContent = '핸드폰번호 *';
                input.placeholder = '010-0000-0000';
            }
        }
    };

    // 2026-05-14: 증빙 정보 수집 (orderRow.receipt_info 로 저장 → 관리자 페이지에서 표시)
    function _soCollectReceiptInfo() {
        var box = document.getElementById('soCoReceiptBox');
        if (!box || box.style.display === 'none') return null;
        var t = (document.querySelector('input[name="soRcptType"]:checked') || {}).value || 'none';
        if (t === 'none') return { type: 'none' };
        if (t === 'tax_invoice') {
            var biz = (document.getElementById('soRcptBizNumber').value || '').trim();
            var company = (document.getElementById('soRcptCompany').value || '').trim();
            var rep = (document.getElementById('soRcptRepName').value || '').trim();
            var em = (document.getElementById('soRcptEmail').value || '').trim();
            if (!biz || !company || !rep || !em) { alert('세금계산서 필수 항목을 모두 입력해주세요. (사업자번호/회사명/대표자명/이메일)'); return false; }
            return {
                type: t,
                biz_number: biz, company_name: company, rep_name: rep, email: em,
                biz_type: (document.getElementById('soRcptBizType').value || '').trim(),
                biz_category: (document.getElementById('soRcptBizCategory').value || '').trim(),
                biz_address: (document.getElementById('soRcptBizAddress').value || '').trim()
            };
        }
        var idNum = (document.getElementById('soRcptIdNumber').value || '').trim();
        if (!idNum) { alert('현금영수증 식별번호를 입력해주세요.'); return false; }
        return { type: t, id_number: idNum };
    }

    // 2026-05-14: 견적서 미리보기 다운로드 — 현재 카트 + 입력 폼 기반 PDF 생성
    window._soDownloadQuotePreview = async function (btnEl) {
        var origLabel = btnEl ? btnEl.innerHTML : '';
        try {
            if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 생성중'; }
            var cart = _soReadAllCart();
            if (!cart || cart.length === 0) { alert('장바구니가 비어있습니다.'); return; }

            // export.js 동적 import (ES module)
            var mod = await import('./export.js?v=292');
            if (!mod || !mod.generateQuotationPDF) { alert('견적서 생성 모듈을 로드할 수 없습니다.'); return; }

            var name = (document.getElementById('soCoName').value || '').trim() || '-';
            var phone = (document.getElementById('soCoPhone').value || '').trim();
            var zip = (document.getElementById('soCoZip').value || '').trim();
            var addr1 = (document.getElementById('soCoAddr1').value || '').trim();
            var addr2 = (document.getElementById('soCoAddr2').value || '').trim();
            var memo = (document.getElementById('soCoMemo').value || '').trim();
            var fullAddr = [zip ? '(' + zip + ')' : '', addr1, addr2].filter(Boolean).join(' ');

            var cartCalc = _soCalcCartTotal(cart);
            var orderInfo = {
                id: '미리보기',
                manager: name, phone: phone, address: fullAddr,
                note: memo, date: '',
                shippingFee: 0
            };

            // window.cartData 와 동일한 shape 으로 변환 (export.js 가 item.product 참조)
            // simple_order cart 의 일반 항목은 이미 product 객체를 가지고 있음
            var pdfCart = cart.filter(function (it) { return !!it.product || it.fabricCode; });
            var blob = await mod.generateQuotationPDF(orderInfo, pdfCart, 0, 0);
            if (!blob) { alert('견적서 생성 실패. 콘솔 확인.'); return; }

            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = '견적서_미리보기_' + Date.now() + '.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        } catch (e) {
            console.error('[_soDownloadQuotePreview]', e);
            alert('견적서 생성 오류: ' + (e.message || e));
        } finally {
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origLabel; }
        }
    };

    window._soSubmitOrder = async function () {
        var name = (document.getElementById('soCoName').value || '').trim();
        var phone = (document.getElementById('soCoPhone').value || '').trim();
        var email = (document.getElementById('soCoEmail').value || '').trim();
        var zip = (document.getElementById('soCoZip').value || '').trim();
        var addr1 = (document.getElementById('soCoAddr1').value || '').trim();
        var addr2 = (document.getElementById('soCoAddr2').value || '').trim();
        var memo = (document.getElementById('soCoMemo').value || '').trim();
        var payMethod = (document.querySelector('input[name="soPayMethod"]:checked') || {}).value || 'bank';

        if (!name)  { alert('받으시는 분 성함을 입력해주세요.'); return; }
        if (!phone) { alert('연락처를 입력해주세요.'); return; }
        if (!addr1) { alert('배송지를 입력해주세요.'); return; }

        // 2026-05-14: 무통장 입금 + KR 한정으로 증빙 정보 수집 (선택)
        var receiptInfo = null;
        if (payMethod === 'bank') {
            var collected = _soCollectReceiptInfo();
            if (collected === false) return; // 필수 미입력 → 사용자에게 알림 후 중단
            if (collected && collected.type && collected.type !== 'none') receiptInfo = collected;
        }

        var cart = _soReadAllCart();
        if (cart.length === 0) return;

        var btn = document.getElementById('soCoSubmitBtn');
        btn.disabled = true;
        var origLabel = btn.innerHTML;
        btn.innerHTML = '⏳ 처리 중...';

        try {
            var sb = getSb();
            if (!sb) throw new Error('Supabase 연결 실패');

            // 2026-05-13: 카트 전체 할인 (구매금액 + PRO 중복) 반영된 총액
            var cartCalc = _soCalcCartTotal(cart);
            var total = cartCalc.grandTotal;

            // 카트 항목 → orders.items 형식 (관리자 페이지에서 인식)
            // 동시에 orderRow.files 도 채우기 위해 파일 정보 수집
            var orderFiles = [];
            var items = cart.map(function (it) {
                if (_soIsFabricItem(it)) {
                    // 패브릭 항목 — 마켓플레이스 원본 또는 업로드 디자인 URL
                    var fabUrl  = it.designerOriginalUrl || it.imgUrl || null;
                    var fabName = it.imgFileName || (it.title || it.fabricName || 'fabric') + '.png';
                    if (fabUrl) orderFiles.push({ name: fabName, url: fabUrl, type: 'image/png' });
                    return {
                        product_code: it.fabricCode,
                        product_name: it.title || it.fabricName,
                        fabric: it.fabricName,
                        width_cm: it.orderWcm,
                        height_cm: it.orderHcm,
                        qty: it.qtyValue || 1,
                        price: it.price || 0,
                        source: 'cotton-print',
                        artwork_url: fabUrl,
                        artwork_filename: fabName,
                        addons: [
                            it.finishCode ? { type: 'finish', code: it.finishCode, name: it.finishName, price: it.finishExtra || 0 } : null,
                            it.hookCode ? { type: 'hook', code: it.hookCode, name: it.hookName, price: it.hookExtra || 0 } : null,
                            it.accCode ? { type: 'accessory', code: it.accCode, name: it.accName, price: it.accExtra || 0 } : null
                        ].filter(Boolean)
                    };
                }
                // 일반 상품 — buildCartItem 에서 originalUrl(storage URL) + filePath 저장됨
                // 2026-05-13: addon (수량 자동 포함), 가벽 사이즈, 전달사항 모두 캡처
                var addons = [];
                if (it.selectedAddons && window.ADDON_DB) {
                    Object.values(it.selectedAddons).forEach(function (code) {
                        var a = window.ADDON_DB[code];
                        if (!a) return;
                        var aQty = (it.addonQuantities && it.addonQuantities[code]) || 1;
                        addons.push({
                            type: 'addon',
                            code: code,
                            name: a.display_name || a.name,
                            qty: aQty,
                            price: a.price || 0,
                            total: (a.price || 0) * aQty
                        });
                    });
                }
                var fileUrl  = it.originalUrl || it.fileUrl || it.thumb || null;
                var fileName = it.fileName || ((it.product && it.product.name) || 'item') + '.png';
                var fileType = it.mimeType || 'image/png';
                if (fileUrl) orderFiles.push({ name: '[앞면] ' + fileName, url: fileUrl, type: fileType });
                // 2026-05-13: 양면 가벽이면 뒷면 파일도 orders.files 에 포함
                if (it.backFileUrl) {
                    orderFiles.push({ name: '[뒷면] ' + (it.backFileName || 'back.png'), url: it.backFileUrl, type: it.backFileType || 'image/png' });
                }
                var wallSizeMm = null;
                if (it.wallSize) {
                    wallSizeMm = {
                        width_mm: Math.round((it.wallSize.w_m || 0) * 1000),
                        height_mm: Math.round((it.wallSize.h_m || 0) * 1000)
                    };
                }
                return {
                    product_code: (it.product && it.product.code) || '',
                    product_name: (it.product && (it.product.name || it.product.name_jp || it.product.name_us)) || (it.productName || ''),
                    qty: it.qty || 1,
                    width_mm: (wallSizeMm && wallSizeMm.width_mm) || it.width || (it.product && it.product.w_mm) || null,
                    height_mm: (wallSizeMm && wallSizeMm.height_mm) || it.height || (it.product && it.product.h_mm) || null,
                    unit_price: (it.product && it.product.price) || 0,
                    price: _soCalcItemPrice(it),
                    source: 'cafe2626',
                    addons: addons,
                    wall_size: it.wallSize || null,           // 가벽 사이즈 (m 단위)
                    wall_side: it.wallSide || null,           // single / double (양면이면 가격 2배)
                    item_note: it.itemNote || '',             // 전달사항 (제작 요청)
                    shipping: it.shipping || null,            // 시공/배송 일정 + 철거
                    file_url: fileUrl,
                    file_name: fileName,
                    file_path: it.filePath || null,
                    back_file_url: it.backFileUrl || null,   // 뒷면 (양면 가벽만)
                    back_file_name: it.backFileName || null,
                    back_file_path: it.backFilePath || null,
                    artwork_url: fileUrl,
                    artwork_filename: fileName
                };
            });

            var fullAddr = (zip ? '[' + zip + '] ' : '') + addr1 + ' ' + addr2;
            // 로그인 사용자 정보 조회 (admin_note 에 기록)
            var loggedInEmail = null;
            try {
                var sess = await sb.auth.getSession();
                if (sess && sess.data && sess.data.session && sess.data.session.user) {
                    loggedInEmail = sess.data.session.user.email;
                }
            } catch (e) {}
            // 2026-05-13: admin_note 에 각 항목별 옵션·전달사항·가벽사이즈·시공일정 요약 포함
            var itemSummaries = [];
            var totalShippingFee = 0;
            var shipLabel = {
                metro_install: '수도권 설치 (10만원)',
                metro_weekend: '수도권 야간/주말 설치 (20만원)',
                metro_install_removal: '수도권 설치+철거 (10+20=30만원)',
                regional_truck: '지방 용차배송 (20만원)',
                regional_install: '지방 설치배송 (70만원)',
                self_pickup: '본사 방문 수령'
            };
            cart.forEach(function (it, idx) {
                if (_soIsFabricItem(it)) return; // 패브릭은 별도 처리
                var pname = (it.product && (it.product.name || it.product.name_jp || it.product.name_us)) || (it.productName || '상품');
                var lines = ['#' + (idx + 1) + ' ' + pname + ' x ' + (it.qty || 1)];
                if (it.wallSize) {
                    var sideLbl = (it.wallSide === 'double') ? ' / 양면' : ' / 단면';
                    lines.push('  · 가벽 사이즈: ' + it.wallSize.w_m + 'm × ' + it.wallSize.h_m + 'm' + sideLbl);
                    if (parseFloat(it.wallSize.h_m) === 3) {
                        var hWidth = it.wallSize.w_m || 1;
                        var hExtra = 50000 * hWidth * (it.wallSide === 'double' ? 2 : 1);
                        lines.push('  · 세로 3m 추가 (5만 × ' + hWidth + 'm' + (it.wallSide === 'double' ? ' × 2면' : '') + '): +' + hExtra.toLocaleString() + '원');
                    }
                    if (it.backFileUrl) {
                        lines.push('  · 뒷면 파일: ' + (it.backFileName || it.backFileUrl));
                    }
                }
                if (it.selectedAddons && window.ADDON_DB) {
                    Object.values(it.selectedAddons).forEach(function (code) {
                        var a = window.ADDON_DB[code];
                        if (!a) return;
                        var aQty = (it.addonQuantities && it.addonQuantities[code]) || 1;
                        lines.push('  · ' + (a.display_name || a.name) + ' x ' + aQty + ' = ' + (((a.price || 0) * aQty).toLocaleString()) + '원');
                    });
                }
                if (it.itemNote) lines.push('  · 전달사항: ' + it.itemNote);
                if (it.shipping) {
                    lines.push('  · 시공/배송: ' + (shipLabel[it.shipping.method] || it.shipping.method));
                    if (it.shipping.delivery_date) lines.push('    - 배송: ' + it.shipping.delivery_date + ' ' + (it.shipping.delivery_time || ''));
                    if (it.shipping.removal_date) lines.push('    - 철거: ' + it.shipping.removal_date + ' ' + (it.shipping.removal_time || ''));
                    totalShippingFee += (it.shipping.fee || 0);
                }
                itemSummaries.push(lines.join('\n'));
            });
            // 2026-05-13: total 은 이미 _soCalcCartTotal 에서 shipping 포함 — 이중 합산 방지
            // (배송비 안내만 admin_note 에 별도 명시)
            var discountSummary = '';
            if (cartCalc.amountPct > 0) {
                discountSummary += '\n할인: 구매금액 ' + cartCalc.amountPct + '% (-' + cartCalc.amountDisc.toLocaleString() + '원)';
            }
            if (cartCalc.proPct > 0) {
                discountSummary += '\nPRO 구독자 10% (-' + cartCalc.proDisc.toLocaleString() + '원)';
            }
            var adminNote =
                '[간편주문] 결제수단: ' + (payMethod === 'bank' ? '무통장입금' : '카드결제') +
                '\n이메일: ' + (email || loggedInEmail || '없음') +
                (memo ? '\n배송메모: ' + memo : '') +
                (totalShippingFee > 0 ? '\n배송/시공비: ' + totalShippingFee.toLocaleString() + '원' : '') +
                discountSummary +
                (itemSummaries.length ? '\n\n=== 상품별 옵션·요청 ===\n' + itemSummaries.join('\n\n') : '');

            // 2026-05-12: 패브릭 (_cpSubmitOrder) 와 동일 schema 사용 — orders 테이블 컬럼 일치
            var orderRow = {
                order_date: new Date().toISOString(),
                manager_name: name,
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
                files: orderFiles.length ? orderFiles : null,
                admin_note: adminNote
            };
            // 2026-05-14: 무통장 입금 증빙 정보 (세금계산서/현금영수증) — 관리자 페이지 receipt_info 컬럼과 연결
            if (receiptInfo) orderRow.receipt_info = receiptInfo;

            var { data: insertedOrder, error: insertErr } = await sb.from('orders').insert([orderRow]).select().single();
            if (insertErr) throw insertErr;

            var newOrderId = insertedOrder && (insertedOrder.id || insertedOrder.order_id);

            // 2026-05-12: Google Drive 동기화 트리거 (패브릭과 동일)
            // 무통장(status=접수됨) → 즉시 폴더 생성. 카드(status=임시작성) → Edge Function 이 skip,
            // 결제 완료 시 confirm-payment 등에서 재호출 (멱등성)
            try {
                sb.functions.invoke('sync-order-to-drive', { body: { order_id: newOrderId } })
                    .then(function (r) {
                        if (r && r.error) console.warn('[drive sync] failed:', r.error.message || r.error);
                        else console.log('[drive sync]', (r && r.data) || r);
                    })
                    .catch(function (e) { console.warn('[drive sync] enqueue failed:', e && e.message || e); });
            } catch (e) { console.warn('[drive sync] try failed:', e && e.message || e); }

            // 무통장: 안내 메시지 + 카트 비우기
            if (payMethod === 'bank') {
                alert(
                    '주문이 접수되었습니다!\n\n' +
                    '주문번호: #' + (newOrderId || '확인중') + '\n' +
                    '입금하실 금액: ' + _soFormatPrice(total) + '\n\n' +
                    '국민은행 647701-04-277763\n' +
                    '예금주: (주)카멜레온프린팅\n\n' +
                    '입금 후 영업일 내 제작이 시작됩니다.'
                );
                // 카트 비우기 + shield 로 전환 가림 + 메인 화면으로 이동
                try { localStorage.setItem('chameleon_cart_current', '[]'); } catch (e) {}
                _showLoadingShield();
                window._soCloseCheckout();
                setTimeout(function () { location.href = '/'; }, 600);
                return;
            }

            // 카드 결제: shield 로 전환 화면 가리고 한국=Toss, 해외=Stripe
            try { localStorage.setItem('chameleon_cart_current', '[]'); } catch (e) {}
            _showLoadingShield();
            window._soCloseCheckout();
            // simple_order 모달은 closeSimpleOrderModal 생략 — shield 가 위를 가리므로 background 안 보임

            var country = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
            var host = (location.hostname || '').toLowerCase();
            if (!country || country === 'KR') {
                if (host.indexOf('cafe0101') >= 0) country = 'JP';
                else if (host.indexOf('cafe3355') >= 0) country = 'US';
            }
            if (country === 'KR') {
                // 한국: Toss
                location.href = '/cotton_checkout.html?order_id=' + newOrderId;
            } else {
                // 해외: Stripe (lang 파라미터로 일본/영어 결제 메시지 분기)
                var clang = (country === 'JP') ? 'ja' : 'en';
                location.href = '/cotton_stripe_checkout.html?order_id=' + newOrderId + '&lang=' + clang;
            }
        } catch (e) {
            console.error('[_soSubmitOrder]', e);
            alert('주문 처리 중 오류: ' + (e.message || e));
            btn.disabled = false;
            btn.innerHTML = origLabel;
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
    // 자동 라우팅 — 2026-05-12: 모든 상품 통일된 simple_order 모달로
    // 사용자 결정: "모든 카테고리 모든 제품의 상세페이지와 장바구니 인터페이스를 통일"
    // 비상시에만 기존 #choiceModal 로 복귀하도록 __SO_FALLBACK_TO_LEGACY 플래그 남김.
    // ─────────────────────────────────────────────
    function isComplexProduct(code, product) {
        // 명시적으로 레거시 모달로 보낼 때만 (특정 코드만 일시적으로 예외 처리하고 싶을 때)
        if (window.__SO_FALLBACK_TO_LEGACY) {
            if (!code) return false;
            const c = String(code).toUpperCase();
            if (c.startsWith('DESIGN_FEE') || c.startsWith('UA_')) return true; // 디자인비/업로드는 예외
        }
        return false; // 기본: 전부 simple_order 통일
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
        console.log('[simple_order] 통일 모달 라우팅 활성화 — 모든 상품이 simple_order 모달 사용 (비상복귀: window.__SO_FALLBACK_TO_LEGACY=true)');
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
