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
    cursor: default;
}
.so-upload.done .so-upload-icon { color: #16a34a; font-size: 36px; }
.so-file-preview {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    background: #fff; border: 1px solid #d1fae5; border-radius: 10px;
    margin-bottom: 10px; text-align: left; max-width: 100%;
}
.so-file-thumb {
    width: 56px; height: 56px; border-radius: 8px; background: #f5f5f5;
    object-fit: cover; flex-shrink: 0; border: 1px solid #e5e5e5;
}
.so-file-info { flex: 1; min-width: 0; }
.so-file-name { font-size: 13px; font-weight: 700; color: #1a1a1a; word-break: break-all; }
.so-file-size { font-size: 11px; color: #888; margin-top: 2px; }
.so-file-change {
    border: 1px solid #d6d3d1; background: #fff; color: #78350f; font-weight: 700;
    padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
    font-family: inherit; flex-shrink: 0;
}
.so-file-change:hover { background: #fef7e6; }

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
          ← ${tr('메인으로', 'メインへ', 'Back')}
        </button>
        <span class="so-brand">Chameleon</span>
        <h2>${tr('상품 주문', '商品注文', 'Order')}</h2>
      </div>
      <button class="so-close" onclick="window.closeSimpleOrderModal()" title="${tr('닫기', '閉じる', 'Close')}">×</button>
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
        // 이미지는 썸네일 dataUrl, PDF는 아이콘 사용
        if (isPng || isJpg) {
            const r = new FileReader();
            r.onload = e => {
                state.thumbDataUrl = e.target.result;
                renderUploadDone();
            };
            r.readAsDataURL(file);
        } else {
            state.thumbDataUrl = null;
            renderUploadDone();
        }
    }

    function renderUploadDone() {
        const zone = document.getElementById('soUpload');
        if (!zone) return;
        zone.classList.add('done');
        const thumbHtml = state.thumbDataUrl
            ? `<img class="so-file-thumb" src="${state.thumbDataUrl}" alt="" />`
            : `<div class="so-file-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px;color:#dc2626;">📄</div>`;
        const sizeMB = (state.file.size / 1024 / 1024).toFixed(2);
        zone.innerHTML = `
            <input type="file" id="soFile" accept="image/png,image/jpeg,application/pdf,.pdf,.png,.jpg,.jpeg" style="display:none" />
            <div class="so-file-preview" style="width:100%;max-width:420px;">
                ${thumbHtml}
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
        zone.onclick = null;  // 영역 클릭 → 입력 활성화 안 함 (변경 버튼으로만)
        wireUploadEvents();
        updateButtons();
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

        document.getElementById('soQty').value = 1;
        state.qty = 1;
        recalc();
        updateButtons();
        resetUploadZone();
        hideStatus();

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
        if (ok) setTimeout(() => window.closeSimpleOrderModal(), 900);
    };

    window._soBuyNow = async function() {
        const ok = await doAddToCart();
        if (!ok) return;
        try {
            if (window.openCartPanel) window.openCartPanel();
            else if (window.toggleCart) window.toggleCart(true);
            else if (window.showCart) window.showCart();
            else location.href = '/?cart=open';
        } catch (e) {
            location.href = '/?cart=open';
        }
        setTimeout(() => window.closeSimpleOrderModal(), 300);
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

    console.log('[simple_order] v=5 (fullscreen 2-column layout) loaded. window.openSimpleOrderModal(code) available.');
})();
