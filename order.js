console.log('🔵 order.js v174 loaded');
import { canvas } from "./canvas-core.js?v=404";
import { PRODUCT_DB, ADDON_DB, ADDON_CAT_DB, cartData, currentUser, sb } from "./config.js?v=404";
import { SITE_CONFIG } from "./site-config.js?v=404";
import { applySize } from "./canvas-size.js?v=404";
import { pageDataList, currentPageIndex } from "./canvas-pages.js?v=404";
import {
    generateOrderSheetPDF,
    generateQuotationPDF,
    generateProductVectorPDF,
    generateRasterPDF,
    generateReceiptPDF,
    generateTransactionStatementPDF
} from "./export.js?v=404";

// [안전장치] 번역 함수가 없으면 기본값 반환
window.t = window.t || function(key, def) { return def || key; };

// [안전장치] 타임아웃 래퍼 — Promise가 ms 이내에 resolve되지 않으면 fallback 반환
function withTimeout(promise, ms, fallback = null) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => {
            console.error(`[타임아웃] ${ms}ms 초과 — 파일 업로드/PDF 생성이 시간 내 완료되지 않음`);
            resolve(fallback);
        }, ms))
    ]);
}

// ============================================================
// [설정] 전역 변수
// ============================================================
let currentTargetProduct = null;
let selectedDeliveryDate = null;
let currentUserDiscountRate = 0; 
let finalPaymentAmount = 0; // 최종 결제 금액 저장용

const urlParams = new URLSearchParams(window.location.search);
const CURRENT_LANG = (urlParams.get('lang') || (window.location.hostname.includes('cafe0101') ? 'ja' : (window.location.hostname.includes('cafe3355') || window.location.hostname.includes('chameleon.design')) ? 'en' : 'kr')).toLowerCase();

// ============================================================
// [1] 헬퍼 함수 (유틸리티)
// ============================================================
function formatCurrency(amount) {
    const num = Number(amount) || 0;
    const country = SITE_CONFIG.COUNTRY;
    const rate = SITE_CONFIG.CURRENCY_RATE?.[country] || 1;
    const converted = num * rate;

    if (country === 'JP') return '¥' + Math.round(converted).toLocaleString();
    if (country === 'US') return converted >= 10 ? '$' + Math.round(converted).toLocaleString() : '$' + converted.toFixed(2);
    if (country === 'CN') return '¥' + Math.round(converted).toLocaleString();
    if (country === 'AR') return (converted >= 10 ? '$' + Math.round(converted).toLocaleString() : '$' + converted.toFixed(2));
    if (country === 'ES') return '€' + converted.toFixed(2);
    if (country === 'DE') return '€' + converted.toFixed(2);
    if (country === 'FR') return '€' + converted.toFixed(2);
    if (country === 'KR' || !country) return converted.toLocaleString() + '원';
    return '$' + (converted < 1 ? converted.toFixed(2) : Math.round(converted).toLocaleString());
}
window.formatCurrency = formatCurrency;

// 국가별 상품명 표시
function localName(product) {
    const c = SITE_CONFIG.COUNTRY;
    if (c === 'JP') return product.name_jp || product.name_us || product.name || '';
    if (c === 'US') return product.name_us || product.name || '';
    if (c === 'CN') return product.name_cn || product.name_us || product.name || '';
    if (c === 'AR') return product.name_ar || product.name_us || product.name || '';
    if (c === 'ES') return product.name_es || product.name_us || product.name || '';
    if (c === 'DE') return product.name_de || product.name_us || product.name || '';
    if (c === 'FR') return product.name_fr || product.name_us || product.name || '';
    return product.name || '';
}

function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// PDF 라이브러리 로드 체크
async function loadPdfLib() {
    if (!window.pdfjsLib) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
}

// PDF 썸네일 생성
async function createPdfThumbnailBlob(file) {
    if (file.size > 50 * 1024 * 1024) return null; 
    await loadPdfLib();
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = 800 / viewport.width; 
        const scaledViewport = page.getViewport({ scale });
        
        const tempCanvas = document.createElement('canvas'); 
        const context = tempCanvas.getContext('2d');
        tempCanvas.height = scaledViewport.height; 
        tempCanvas.width = scaledViewport.width;
        
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        return new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg', 0.8));
    } catch (e) { return null; }
}

// 이미지 리사이즈
const resizeImageToBlob = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); 
            img.src = e.target.result;
            img.onload = () => {
                const maxDim = 1000;
                let w = img.width; let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                    else { w = Math.round(w * maxDim / h); h = maxDim; }
                }
                const tempCanvas = document.createElement('canvas'); 
                tempCanvas.width = w; tempCanvas.height = h;
                const ctx = tempCanvas.getContext('2d'); 
                ctx.drawImage(img, 0, 0, w, h);
                tempCanvas.toBlob(resolve, 'image/jpeg', 0.8);
            };
        };
    });
};

// 파일 업로드 헬퍼 (최대 3회 재시도)
async function uploadFileToSupabase(file, folder, retries = 3) {
    if (!sb) return null;
    const timestamp = Date.now();
    // Blob type에서 확장자 추출 (file.name이 없는 경우)
    let ext = 'jpg';
    if (file.name) { ext = file.name.split('.').pop(); }
    else if (file.type) {
        if (file.type.includes('png')) ext = 'png';
        else if (file.type.includes('pdf')) ext = 'pdf';
        else if (file.type.includes('jpeg') || file.type.includes('jpg')) ext = 'jpg';
        else if (file.type.includes('svg')) ext = 'svg';
    }
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeName = `${timestamp}_${randomStr}.${ext}`;
    const filePath = `${folder}/${safeName}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data, error } = await sb.storage.from('orders').upload(filePath, file);
            if (error) {
                console.error(`업로드 에러 (시도 ${attempt}/${retries}):`, error);
                if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
                return null;
            }
            const { data: publicData } = sb.storage.from('orders').getPublicUrl(filePath);
            return publicData.publicUrl;
        } catch(e) {
            console.error(`업로드 예외 (시도 ${attempt}/${retries}):`, e);
            if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
            return null;
        }
    }
    return null;
}

// ★ 장바구니 키: 로그인 무관 단일 키 (로그인/로그아웃해도 장바구니 유지)
function cartStorageKey() { return 'chameleon_cart_current'; }

// [추가] 장바구니 로드 함수
export function loadCartFromStorage() {
    try {
        const storageKey = cartStorageKey();
        let savedCart = localStorage.getItem(storageKey);
        // debug log removed
        // 마이그레이션: 이전 키에서 복구 (1회만 — 복구 후 구 키 삭제)
        if (!savedCart) {
            const oldKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
            savedCart = localStorage.getItem(oldKey) || localStorage.getItem('chameleon_cart_guest');
            if (savedCart) {
                localStorage.setItem(storageKey, savedCart);
                // ★ 구 키 삭제 (좀비 데이터 재발 방지)
                try { Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('chameleon_cart_') && k !== storageKey) localStorage.removeItem(k);
                }); } catch(e2) {}
            }
        }
        if (savedCart) {
            const parsed = JSON.parse(savedCart);
            if (Array.isArray(parsed)) {
                cartData.length = 0;
                parsed.forEach(item => cartData.push(item));
            }
        }
    } catch (e) {
        console.warn("장바구니 로드 실패:", e);
    }
}

// ============================================================
// [2] 주문 시스템 초기화 및 이벤트 바인딩
// ============================================================
export async function initOrderSystem() {
    // [수정] 무조건적인 초기화 코드 제거 (기존 상품 보존)
    // 용량 부족 문제는 addProductToCartDirectly나 saveCart의 에러 핸들링에서 처리합니다.
    
    loadCartFromStorage();
    
    await fetchUserDiscountRate(); 
    
    window.excludedCategoryCodes = new Set();
    try {
        const _sb = sb || window.sb;
        if (!_sb) throw new Error('DB not ready');
        const { data: topCats } = await _sb.from('admin_top_categories').select('code').eq('is_excluded', true);
        if (topCats && topCats.length > 0) {
            const topCodes = topCats.map(c => c.code);
            const { data: subCats } = await _sb.from('admin_categories').select('code').in('top_category_code', topCodes);
            
            if (subCats) {
                subCats.forEach(sc => window.excludedCategoryCodes.add(sc.code));
            }
        }
    } catch(e) { console.warn("제외 목록 로드 실패:", e); }

    const krForm = document.getElementById("addrFormKR");
    const globalForm = document.getElementById("addrFormGlobal");
    
    if (CURRENT_LANG === 'kr') {
        if(krForm) krForm.style.display = 'block';
        if(globalForm) globalForm.style.display = 'none';
    } else {
        if(krForm) krForm.style.display = 'none';
        if(globalForm) globalForm.style.display = 'flex';
    }

    const btnOrderTop = document.getElementById("btnOrderTop");
    if(btnOrderTop) btnOrderTop.onclick = function() {
        const startScreen = document.getElementById('startScreen');
        const isEditorOpen = startScreen && window.getComputedStyle(startScreen).display === 'none';

        if (isEditorOpen && window.canvas) {
            // 에디터에서 작업 중 + 캔버스 준비됨 → 장바구니에 담기
            addCanvasToCart();
        } else if (isEditorOpen && !window.canvas) {
            // 에디터 열려있지만 캔버스 미초기화 → 장바구니 페이지로 이동
            loadCartFromStorage();
            renderCart();
            document.getElementById('cartPage').style.display = 'block';
        } else {
            // 시작 화면 → 장바구니 바로가기
            loadCartFromStorage();
            renderCart();
            document.getElementById('cartPage').style.display = 'block';
        }
    };

    // addCanvasToCart, renderCart를 외부에서도 접근 가능하게
    window.addCanvasToCart = addCanvasToCart;
    window.renderCart = renderCart;
    window.fetchUserDiscountRate = fetchUserDiscountRate;

    const btnViewCart = document.getElementById("btnViewCart");
    if (btnViewCart) {
        btnViewCart.onclick = function() {
            loadCartFromStorage();
            renderCart();
            document.getElementById("cartPage").style.display = "block";
            document.body.classList.remove('editor-active');
        };
    }
    
    const btnActionDesign = document.getElementById("btnActionDesign");
    if(btnActionDesign) btnActionDesign.onclick = startDesignFromProduct;
    
    const pdpFileUpload = document.getElementById("pdpFileUpload");
    if(pdpFileUpload) pdpFileUpload.onchange = addFileToCart;
    
    const btnGoCheckout = document.getElementById("btnGoCheckout");
    if(btnGoCheckout) {
        btnGoCheckout.onclick = () => {
            if(cartData.length === 0) { showToast(window.t('msg_cart_empty', "Your cart is empty."), "warn"); return; }

            // ★ 장바구니 내 배송 폼이 채워져 있으면 → 배송옵션 체크 건너뛰고 바로 결제
            const _cartDate = document.getElementById('cartDeliveryDate');
            const _cartName = document.getElementById('cartReceiverName');
            const _hasCartForm = _cartDate && _cartDate.value;
            if (_hasCartForm) {
                const info = getOrderInfo();
                selectedDeliveryDate = info.date;

                // ★ 기존 모달 필드에 값 채우기 (processOrderSubmission이 읽음)
                const _setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                _setVal('inputManagerName', info.manager);
                _setVal('inputManagerPhone', info.phone);
                _setVal('inputRequest', info.note);
                if (CURRENT_LANG === 'kr') _setVal('inputAddressKR', info.address);
                // 담당 매니저: 장바구니에서 선택한 값 → 기존 모달 필드에 매핑
                const _staffEl = document.getElementById('inputStaffManager');
                if (_staffEl) _staffEl.value = info.staffManager || '__hq__';
                // 비수도권 배송비
                window._nonMetroFeeApplied = info.shippingFee || 0;

                processOrderSubmission();
                return;
            }

            // 배송 옵션 필수 체크 (기존 모달 경로에서만)
            const shippingKeywords = ['배송', 'shipping', 'delivery', '配送', '発送', '운송'];
            let hasShippingCategory = false;
            let hasAnyShippingSelected = false;
            for (let i = 0; i < cartData.length; i++) {
                const item = cartData[i];
                if (!item.product || !item.product.addons) continue;
                const addonCodes = Array.isArray(item.product.addons) ? item.product.addons : (item.product.addons.split(',') || []);
                const allAddons = addonCodes.map(c => ({ code: c.trim(), ...ADDON_DB[c.trim()] })).filter(a => a.name);
                const categories = [...new Set(allAddons.map(a => a.category_code).filter(Boolean))];
                for (const cat of categories) {
                    const catInfo = ADDON_CAT_DB[cat];
                    if (!catInfo) continue;
                    const allNames = [catInfo.name_kr, catInfo.name_jp, catInfo.name_us, catInfo.display_name, catInfo.code].filter(Boolean).join(' ').toLowerCase();
                    if (!shippingKeywords.some(kw => allNames.includes(kw.toLowerCase()))) continue;
                    hasShippingCategory = true;
                    const catAddonCodes = allAddons.filter(a => a.category_code === cat).map(a => a.code);
                    if (catAddonCodes.some(c => Object.values(item.selectedAddons || {}).includes(c))) hasAnyShippingSelected = true;
                }
            }
            if (hasShippingCategory && !hasAnyShippingSelected) {
                showToast(window.t('msg_shipping_required', '배송옵션은 필수입니다.'), "warn");
                return;
            }

            openCalendarModal();
        };
    }

    const btnPrintQuote = document.getElementById("btnPrintQuote");
    if(btnPrintQuote) {
        btnPrintQuote.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_cart_empty', "Your cart is empty."), "warn"); return; }
            const btn = btnPrintQuote;
            btn.innerText = window.t('msg_generating_quote') || "Generating Quote..."; btn.disabled = true;
            try {
                if (!window.jspdf && window.loadEditorLibraries) await window.loadEditorLibraries();
                const info = {
                    manager: currentUser?.user_metadata?.full_name || window.t('default_customer') || 'Customer',
                    phone: currentUser?.user_metadata?.phone || '-',
                    address: '-',
                    note: '',
                    date: new Date().toLocaleDateString(),
                    shippingFee: (window._nonMetroFeeApplied || 0)
                };
                const cartMileageInput = document.getElementById('cartUseMileage');
                const cartUsedMileage = cartMileageInput ? (parseInt(cartMileageInput.value) || 0) : 0;
                const totalDiscountRate = currentUserDiscountRate + 0;
                const blob = await generateQuotationPDF(info, cartData, totalDiscountRate, cartUsedMileage);
                if(blob) downloadBlob(blob, "quotation.pdf");
                else showToast(window.t('err_quote_gen_failed') || "Failed to generate quotation.", "error");
            } catch(e) {
                console.error(e);
                showToast((window.t('err_quote_error') || "Quote Error: ") + e.message, "error");
            } finally {
                btn.innerText = window.t('btn_print_quote') || "Print Quote"; btn.disabled = false;
            }
        };
    }
    
    const btnPrev = document.getElementById("btnPrevMonth");
    if(btnPrev) btnPrev.onclick = () => changeMonth(-1);
    const btnNext = document.getElementById("btnNextMonth");
    if(btnNext) btnNext.onclick = () => changeMonth(1);
    
    const btnSubmit = document.getElementById("btnSubmitOrderInfo");
    if(btnSubmit) btnSubmit.onclick = processOrderSubmission;
    
    const radios = document.getElementsByName('paymentMethod');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const bankBox = document.getElementById('bankInfoBox');
            const receiptBox = document.getElementById('receiptInfoBox');
            const isBank = e.target.value === 'bank';
            const isKR = window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY === 'KR';
            if (isBank) {
                if(bankBox) bankBox.style.display = 'block';
                if(receiptBox && isKR) receiptBox.style.display = 'block';
                document.getElementById('btnFinalPay').innerText = window.t('btn_complete_order') || "Complete Order";
            } else {
                if(bankBox) bankBox.style.display = 'none';
                if(receiptBox) receiptBox.style.display = 'none';
                document.getElementById('btnFinalPay').innerText = window.t('btn_pay_now') || "Pay Now";
            }
        });
    });

    window.handleFinalPayment = processFinalPayment;
    window.processFinalPayment = processFinalPayment;

    // ★ 소셜 로그인 후 결제 복원
    window.restorePendingPayment = async function() {
        try {
            const raw = sessionStorage.getItem('_pendingPayment');
            if (!raw) return;
            sessionStorage.removeItem('_pendingPayment');
            const pd = JSON.parse(raw);
            if (!pd.tempOrderInfo) return;

            // 할인율 재로드 (로그인 후이므로)
            await fetchUserDiscountRate();

            window.tempOrderInfo = pd.tempOrderInfo;
            window._nonMetroFeeApplied = pd.nonMetroFee || 0;

            // 금액 재계산 (로그인 후 할인율이 달라질 수 있음)
            let rawTotal = 0;
            cartData.forEach(item => {
                if (!item.product) return;
                const up = item.product.price || 0;
                const qty = item.qty || 1;
                let itemBase = up * qty;
                // 수량 할인
                const _pc = item.product.code || '';
                const _cat = item.product.category || '';
                const _tc = window._getTopCategoryCode ? window._getTopCategoryCode(_cat) : '';
                const _nd = _pc === '21355677' || _pc === '21355677_copy' || _tc === 'Wholesale Board Prices' || _tc === 'honeycomb_board' || _cat === 'hb_display_wall' || _pc.startsWith('hb_dw') || item.product._calculated_price;
                let dr = 0;
                if (!_nd && qty >= 3) { if (qty >= 501) dr = 0.50; else if (qty >= 101) dr = 0.40; else if (qty >= 10) dr = 0.30; else dr = 0.20; }
                itemBase -= Math.floor(itemBase * dr / 100) * 100;
                // 옵션
                if (item.selectedAddons) {
                    Object.values(item.selectedAddons).forEach(code => {
                        const addon = (typeof ADDON_DB !== 'undefined' ? ADDON_DB : window.ADDON_DB || {})[code];
                        if (addon) {
                            const _sw = addon.category_code === 'opt_8796' || addon.is_swatch;
                            const aq = _sw ? qty : ((item.addonQuantities && item.addonQuantities[code]) || 1);
                            itemBase += addon.price * aq;
                        }
                    });
                }
                rawTotal += itemBase;
            });
            rawTotal += window._nonMetroFeeApplied;
            const gradeDisc = Math.floor(rawTotal * currentUserDiscountRate);
            const finalTotal = rawTotal - gradeDisc;

            window.originalPayAmount = finalTotal;
            window.finalPaymentAmount = finalTotal;

            const info = pd.tempOrderInfo;

            // checkout 모달 채우기
            const el = (id) => document.getElementById(id);
            if (el('orderName')) el('orderName').value = info.manager || '';
            if (el('orderPhone')) el('orderPhone').value = info.phone || '';
            if (el('orderAddr')) el('orderAddr').value = info.address || '';
            if (el('orderMemo')) el('orderMemo').value = info.request || '';
            if (el('finalPayAmountDisplay')) el('finalPayAmountDisplay').innerText = formatCurrency(finalTotal);
            if (el('btnFinalPay')) el('btnFinalPay').innerText = `${formatCurrency(finalTotal)} ${window.t('btn_pay', 'Pay')}`;

            // 모달 열기
            const checkoutModal = el('checkoutModal');
            if (checkoutModal) checkoutModal.style.display = 'flex';

            const msg = window.t ? window.t('msg_login_complete_pay', 'Login complete! Please continue with payment.') : 'Login complete! Please continue with payment.';
            showToast(msg, 'success');
        } catch(e) { console.error('결제 복원 실패:', e); }
    };

    const btnDownSheet = document.getElementById("btnDownOrderSheetCheckout");
    const btnDownQuote = document.getElementById("btnDownQuotationCheckout");

    if(btnDownSheet) {
        btnDownSheet.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_no_data', "No data available."), "warn"); return; }
            const info = getOrderInfo();
            if(window.currentDbId) info.id = window.currentDbId;
            try {
                if (!window.jspdf && window.loadEditorLibraries) await window.loadEditorLibraries();
                const blob = await generateOrderSheetPDF(info, cartData);
                if(blob) downloadBlob(blob, `order_sheet_${info.manager}.pdf`);
            } catch(e) { console.error(e); showToast(window.t('msg_pdf_gen_failed', "PDF generation failed"), "error"); }
        };
    }
    if(btnDownQuote) {
        btnDownQuote.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_no_data', "No data available."), "warn"); return; }
            const info = getOrderInfo();
            const mileageInput = document.getElementById('cartUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                if (!window.jspdf && window.loadEditorLibraries) await window.loadEditorLibraries();
                const blob = await generateQuotationPDF(info, cartData, currentUserDiscountRate + 0, useMileage);
                if(blob) downloadBlob(blob, `quotation_${info.manager}.pdf`);
            } catch(e) { console.error(e); showToast(window.t('msg_pdf_gen_failed', "PDF generation failed"), "error"); }
        };
    }
    const btnReceipt = document.getElementById("btnDownReceipt");
    if(btnReceipt) {
        btnReceipt.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_cart_empty', "Your cart is empty."), "warn"); return; }
            const info = getOrderInfo();

            // [추가] 결제정보(카드/무통장) 및 입금자명 확인
            const payRadio = document.querySelector('input[name="paymentMethod"]:checked');
            info.payMethod = payRadio ? payRadio.value : 'card';

            const depositorInput = document.getElementById('inputDepositorName');
            // 입금자명이 입력되어 있으면 쓰고, 없으면 주문자명 사용
            info.depositor = (depositorInput && depositorInput.value) ? depositorInput.value : info.manager;

            const mileageInput = document.getElementById('cartUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateReceiptPDF(info, cartData, currentUserDiscountRate + 0, useMileage);
                if(blob) downloadBlob(blob, `receipt_${info.manager}.pdf`);
            } catch(e) { console.error(e); showToast(window.t('msg_receipt_gen_failed', "Receipt generation failed: ") + e.message, "error"); }
        };
    }

    const btnStatement = document.getElementById("btnDownStatement");
    if(btnStatement) {
        btnStatement.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_cart_empty', "Your cart is empty."), "warn"); return; }
            const info = getOrderInfo();

            // [추가] 결제정보(카드/무통장) 및 입금자명 확인
            const payRadio = document.querySelector('input[name="paymentMethod"]:checked');
            info.payMethod = payRadio ? payRadio.value : 'card';

            const depositorInput = document.getElementById('inputDepositorName');
            // 입금자명이 입력되어 있으면 쓰고, 없으면 주문자명 사용
            info.depositor = (depositorInput && depositorInput.value) ? depositorInput.value : info.manager;

            const mileageInput = document.getElementById('cartUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateTransactionStatementPDF(info, cartData, currentUserDiscountRate + 0, useMileage);
                if(blob) downloadBlob(blob, `statement_${info.manager}.pdf`);
            } catch(e) { console.error(e); showToast(window.t('msg_statement_gen_failed', "Statement generation failed: ") + e.message, "error"); }
        };
    }
    renderCart(); 
}

// 사용자 등급별 할인율 가져오기
async function fetchUserDiscountRate() {
    if (!currentUser) {
        currentUserDiscountRate = 0;
        return;
    }
    try {
        const { data } = await sb.from('profiles').select('role').eq('id', currentUser.id).maybeSingle();
        const role = data?.role;

        if (role === 'franchise') currentUserDiscountRate = 0.10;
        else if (role === 'platinum' || role === 'partner' || role === 'partners') currentUserDiscountRate = 0.05;
        else if (role === 'gold') currentUserDiscountRate = 0.03;
        else if (role === 'subscriber') currentUserDiscountRate = 0.10;
        else currentUserDiscountRate = 0;

        // PRO 구독자는 최소 10% 할인 보장 (등급 할인이 더 낮을 경우)
        if (role !== 'subscriber' && currentUserDiscountRate < 0.10) {
            try {
                const { data: subData } = await sb.from('subscriptions')
                    .select('status')
                    .eq('user_id', currentUser.id)
                    .eq('status', 'active')
                    .maybeSingle();
                if (subData) {
                    currentUserDiscountRate = Math.max(currentUserDiscountRate, 0.10);
                }
            } catch(subErr) { /* ignore */ }
        }

    } catch(e) {
        console.warn("등급 정보 로드 실패:", e);
        currentUserDiscountRate = 0;
    }
}

function getOrderInfo() {
    // ★ 장바구니 내 배송 폼 우선, 없으면 기존 모달 필드 사용
    const cartName = document.getElementById("cartReceiverName");
    const cartPhone = document.getElementById("cartReceiverPhone");
    const cartAddr = document.getElementById("cartReceiverAddr");
    const cartDate = document.getElementById("cartDeliveryDate");
    const cartTime = document.getElementById("cartDeliveryTime");
    const cartNote = document.getElementById("cartRequestNote");
    const cartManager = document.getElementById("cartStaffManager");

    return {
        manager: (cartName && cartName.value) || document.getElementById("orderName")?.value || window.t('default_customer', "Customer"),
        phone: (cartPhone && cartPhone.value) || document.getElementById("orderPhone")?.value || "",
        address: (cartAddr && cartAddr.value) || document.getElementById("orderAddr")?.value || "",
        note: (cartNote && cartNote.value) || document.getElementById("orderMemo")?.value || "",
        date: (cartDate && cartDate.value) || selectedDeliveryDate || new Date().toISOString().split('T')[0],
        installationTime: (cartTime && cartTime.value) || null,
        staffManager: (cartManager && cartManager.value) || null,
        shippingFee: (window._nonMetroFeeApplied || 0)
    };
}

// ============================================================
// [3] 달력 및 배송 정보 모달 + 설치 예약
// ============================================================
let currentCalDate = new Date();
let selectedInstallationTime = null;

const LEAD_DAYS_MAP = { 'KR': 3, 'JP': 5, 'US': 5 };
const INSTALL_TIME_SLOTS = ["08:00","10:00","12:00","14:00","16:00","18:00","20:00"];
const MAX_TEAMS = 3;

const DAY_HEADERS = {
    'kr': ['일','월','화','수','목','금','토'],
    'ja': ['日','月','火','水','木','金','土'],
    'zh': ['日','一','二','三','四','五','六'],
    'ar': ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'],
    'en': ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    'es': ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
    'de': ['So','Mo','Di','Mi','Do','Fr','Sa'],
    'fr': ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
};

function getCountryCode() {
    return (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.COUNTRY) ? SITE_CONFIG.COUNTRY : 'KR';
}

function computeEarliestDate() {
    const country = getCountryCode();
    const leadDays = LEAD_DAYS_MAP[country] || 10;
    let d = new Date(); let count = 0;
    while (count < leadDays) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    }
    return d;
}

function openCalendarModal() {
    selectedInstallationTime = null;
    const earliest = computeEarliestDate();
    currentCalDate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

    // 동적 타이틀
    const country = getCountryCode();
    const leadDays = LEAD_DAYS_MAP[country] || 10;
    const titleEl = document.getElementById('calendarTitleText');
    if (titleEl) {
        const titles = {
            'kr': `배송요청 [제작기간: 약 ${leadDays}영업일]`,
            'ja': `配送希望日 [納期:約${leadDays}営業日]`,
            'en': `Delivery Request [Lead: ~${leadDays} business days]`,
            'zh': `配送请求 [制作周期:约${leadDays}个工作日]`,
            'ar': `طلب التوصيل [المدة: ${leadDays} أيام عمل]`,
            'es': `Solicitud de Envío [Plazo: ~${leadDays} días hábiles]`,
            'de': `Lieferanfrage [Vorlauf: ~${leadDays} Werktage]`,
            'fr': `Demande de Livraison [Délai: ~${leadDays} jours ouvrés]`
        };
        titleEl.textContent = titles[CURRENT_LANG] || titles['en'];
    }

    document.getElementById("calendarModal").style.display = "flex";
    renderCalendar();
}

function changeMonth(delta) {
    currentCalDate.setMonth(currentCalDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    document.getElementById("currentMonthYear").innerText = `${year}. ${String(month+1).padStart(2,'0')}`;
    grid.innerHTML = "";

    const days = DAY_HEADERS[CURRENT_LANG] || DAY_HEADERS['en'];
    days.forEach(d => grid.innerHTML += `<div class="cal-day-header">${d}</div>`);

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;

    const minDate = computeEarliestDate();
    const limitDate = new Date(minDate); limitDate.setHours(0,0,0,0);

    let firstAvailableSelected = false;

    for (let i = 1; i <= lastDate; i++) {
        const dateObj = new Date(year, month, i);
        const div = document.createElement("div");
        div.className = "cal-day";
        div.innerText = i;

        const checkDate = new Date(dateObj); checkDate.setHours(0,0,0,0);

        if (checkDate < limitDate || dateObj.getDay() === 0 || dateObj.getDay() === 6) {
            div.classList.add("disabled");
        } else {
            // 가장 빠른 날짜 자동 선택
            if (!firstAvailableSelected) {
                div.classList.add("selected");
                selectedDeliveryDate = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                firstAvailableSelected = true;
            }
            div.onclick = () => {
                document.querySelectorAll(".cal-day").forEach(d => d.classList.remove("selected"));
                div.classList.add("selected");
                selectedDeliveryDate = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            };
        }
        grid.appendChild(div);
    }

    // 확인 버튼 핸들러 (날짜 선택 확정)
    const confirmBtn = document.getElementById("btnCalendarConfirm");
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            if (!selectedDeliveryDate) { showToast(window.t('msg_select_date','날짜를 선택해주세요.'), 'warn'); return; }
            if (hasHoneycombInCart()) {
                openInstallationTimeModal();
            } else {
                openDeliveryInfoModal();
            }
        };
    }
}

// ── 허니콤보드 감지 ──
function isHoneycombProduct(product) {
    if (!product) return false;
    const cat = (product.category || '').toLowerCase();
    if (cat.includes('honeycomb')) return true;
    // sub-category → top_category_code 조회
    if (window.globalSubCats) {
        const sub = window.globalSubCats.find(s => s.code === product.category);
        if (sub && sub.top_category_code) {
            if (sub.top_category_code.toLowerCase().includes('honeycomb')) return true;
            // 자기 자신의 소분류 이름에 허니콤 포함 여부
            if (sub.name && (sub.name.includes('허니콤') || sub.name.toLowerCase().includes('honeycomb'))) return true;
        }
    }
    // 상품명 폴백
    const name = ((product.name || '') + ' ' + (product.name_jp || '') + ' ' + (product.name_us || '')).toLowerCase();
    if (name.includes('허니콤') || name.includes('honeycomb') || name.includes('ハニカムボード') || name.includes('ハニカム') || name.includes('リボード') || name.includes('re-board')) return true;
    return false;
}
function hasHoneycombInCart() {
    return cartData.some(item => isHoneycombProduct(item.product));
}

// ── 보드류 감지 (허니콤보드, 포맥스, 폼보드) ──
function isBoardProduct(product) {
    if (!product) return false;
    if (isHoneycombProduct(product)) return true;
    const cat = (product.category || '').toLowerCase();
    if (cat.includes('pvc') || cat.includes('foamex') || cat.includes('foam') || cat.includes('fomax')) return true;
    if (window.globalSubCats) {
        const sub = window.globalSubCats.find(s => s.code === product.category);
        if (sub && sub.top_category_code) {
            const top = sub.top_category_code.toLowerCase();
            if (top.includes('pvc') || top.includes('foamex') || top.includes('foam') || top.includes('fomax')) return true;
        }
    }
    const name = ((product.name || '') + ' ' + (product.name_jp || '') + ' ' + (product.name_us || '')).toLowerCase();
    if (name.includes('포맥스') || name.includes('폼보드') || name.includes('foamex') || name.includes('foam board') || name.includes('fomax') || name.includes('フォームボード') || name.includes('フォーマックス')) return true;
    return false;
}
function hasBoardInCart() {
    return cartData.some(item => isBoardProduct(item.product));
}

// ── 최소 주문금액 / 소량배송비: 완전 삭제 (v174) ──
// 모든 금액 주문 가능, 제한 없음

// ── 장바구니 합계 (KRW) ──
function calculateCartTotalKRW() {
    let total = 0;
    cartData.forEach(item => {
        if (!item.product) return;
        const unitPrice = item.product.price || 0;
        const qty = item.qty || 1;
        let optTotal = 0;
        if (item.selectedAddons && typeof ADDON_DB !== 'undefined') {
            const codes = Array.isArray(item.selectedAddons) ? item.selectedAddons : Object.values(item.selectedAddons);
            codes.forEach(code => {
                const addon = ADDON_DB[code];
                if (!addon) return;
                const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
                optTotal += (addon.price || 0) * aq;
            });
        }
        total += (unitPrice * qty) + optTotal;
    });
    return total;
}

// ── 설치 슬롯 정보 (금액 기반) ──
function getInstallationSlotInfo(totalKRW) {
    if (totalKRW < 1000000) return { type: 'date_only', slots: 0 };
    if (totalKRW < 3000000) return { type: '2hour', slots: 1 };
    if (totalKRW < 5000000) return { type: '4hour', slots: 2 };
    return { type: 'fullday', slots: 7 };
}

// ── 해당 날짜 예약 현황 조회 ──
async function fetchInstallationSlots(date) {
    const slotTeams = {};
    INSTALL_TIME_SLOTS.forEach(s => slotTeams[s] = 0);

    try {
        const _sb = window.sb || sb;
        const { data } = await _sb.from('orders')
            .select('installation_time, total_amount')
            .eq('delivery_target_date', date)
            .not('installation_time', 'is', null);

        (data || []).forEach(order => {
            const startIdx = INSTALL_TIME_SLOTS.indexOf(order.installation_time);
            if (startIdx === -1) return;
            const info = getInstallationSlotInfo(order.total_amount || 0);
            const endIdx = info.type === 'fullday' ? INSTALL_TIME_SLOTS.length : Math.min(startIdx + info.slots, INSTALL_TIME_SLOTS.length);
            for (let i = (info.type === 'fullday' ? 0 : startIdx); i < endIdx; i++) {
                slotTeams[INSTALL_TIME_SLOTS[i]]++;
            }
        });
    } catch(e) { console.warn('설치 슬롯 조회 실패:', e); }
    return slotTeams;
}

// ── 설치 시간 모달 ──
async function openInstallationTimeModal() {
    document.getElementById("calendarModal").style.display = "none";
    const modal = document.getElementById("installationTimeModal");
    if (!modal) { openDeliveryInfoModal(); return; }
    modal.style.display = "flex";

    const grid = document.getElementById("installTimeGrid");
    const notice = document.getElementById("installTimeNotice");
    const btnConfirm = document.getElementById("btnConfirmInstallTime");
    selectedInstallationTime = null;
    if (btnConfirm) btnConfirm.disabled = true;

    const cartTotalKRW = calculateCartTotalKRW();
    const slotInfo = getInstallationSlotInfo(cartTotalKRW);

    // 100만원 미만: 시간 선택 불가
    if (slotInfo.type === 'date_only') {
        grid.innerHTML = '';
        // ★ 타이틀 번역
        const titleEl0 = document.getElementById("installTimeTitle");
        if (titleEl0) {
            const t0 = { 'kr':'🔧 설치 시간 선택','ja':'🔧 設置時間の選択','en':'🔧 Select Installation Time','zh':'🔧 选择安装时间','ar':'🔧 اختيار وقت التركيب','es':'🔧 Seleccionar hora de instalación','de':'🔧 Installationszeit wählen','fr':'🔧 Sélectionner l\'heure d\'installation' };
            titleEl0.textContent = t0[CURRENT_LANG] || t0['en'];
        }
        if (notice) {
            notice.style.display = 'block';
            const msgs = {
                'kr': '허니콤보드 100만원 미만 주문은 지정시간 설치 서비스가 불가합니다.\n\n배송팀이 해당 날짜에 순차적으로 무료배송 및 설치해 드립니다.\n\n시간 지정 설치가 꼭 필요한 경우 별도의 비용이 발생하며, 채팅을 통해 담당자에게 문의해주세요.',
                'ja': 'ハニカムボード10万円未満のご注文は、時間指定の設置サービスをご利用いただけません。\n\n配送チームがご指定の日に順次、無料で配送・設置いたします。\n\n時間指定の設置をご希望の場合は別途費用が発生いたします。チャットにて担当者までお問い合わせください。',
                'en': 'Honeycomb Board orders under $1,000 are not eligible for scheduled installation service.\n\nOur delivery team will provide free delivery and installation in order on the selected date.\n\nIf you need a specific time slot, additional fees apply. Please contact us via chat.',
                'zh': '蜂窝板订单金额低于100万日元，无法使用定时安装服务。\n\n配送团队将在所选日期按顺序提供免费配送和安装。\n\n如需指定时间安装，将产生额外费用，请通过聊天联系客服。',
                'ar': 'Honeycomb Board orders under $1,000 are not eligible for scheduled installation service.\n\nOur delivery team will provide free delivery and installation in order on the selected date.\n\nIf you need a specific time slot, additional fees apply. Please contact us via chat.',
                'es': 'Los pedidos de paneles Honeycomb Board inferiores a $1,000 no son elegibles para el servicio de instalación programada.\n\nNuestro equipo realizará la entrega e instalación gratuita en orden en la fecha seleccionada.\n\nSi necesita una hora específica, se aplicarán cargos adicionales. Contáctenos por chat.',
                'de': 'Honeycomb Board-Bestellungen unter $1.000 sind nicht für den geplanten Installationsservice berechtigt.\n\nUnser Lieferteam liefert und installiert kostenlos in der Reihenfolge am gewählten Datum.\n\nWenn Sie einen bestimmten Zeitpunkt benötigen, fallen zusätzliche Kosten an. Bitte kontaktieren Sie uns per Chat.',
                'fr': "Les commandes de panneaux nid d'abeille inférieures à 1 000 $ ne sont pas éligibles au service d'installation programmée.\n\nNotre équipe assurera la livraison et l'installation gratuites dans l'ordre à la date choisie.\n\nSi vous avez besoin d'un créneau horaire précis, des frais supplémentaires s'appliquent. Veuillez nous contacter par chat."
            };
            notice.innerHTML = (msgs[CURRENT_LANG] || msgs['en']).replace(/\n/g, '<br>');
        }
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.onclick = () => { modal.style.display = 'none'; openDeliveryInfoModal(); };
        }
        return;
    }

    if (notice) notice.style.display = 'none';
    grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; padding:20px; color:#6366f1;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    const bookedSlots = await fetchInstallationSlots(selectedDeliveryDate);

    // 타이틀 업데이트
    const titleEl = document.getElementById("installTimeTitle");
    if (titleEl) {
        const durLabel = slotInfo.type === 'fullday' ? (CURRENT_LANG==='kr'?'종일':CURRENT_LANG==='ja'?'終日':'Full day')
            : slotInfo.type === '4hour' ? '4h' : '2h';
        const titles = {
            'kr': `🔧 설치 시간 선택 (${durLabel})`,
            'ja': `🔧 設置時間の選択 (${durLabel})`,
            'en': `🔧 Select Installation Time (${durLabel})`,
            'zh': `🔧 选择安装时间 (${durLabel})`
        };
        titleEl.textContent = titles[CURRENT_LANG] || titles['en'];
    }

    // 설명
    const descEl = document.getElementById("installTimeDesc");
    if (descEl) {
        const dateStr = selectedDeliveryDate;
        const descs = {
            'kr': `📅 ${dateStr} | 잔여 팀 수를 확인하고 원하는 시간을 선택하세요.`,
            'ja': `📅 ${dateStr} | 残りチーム数を確認し、ご希望の時間を選択してください。`,
            'en': `📅 ${dateStr} | Check available teams and select your preferred time.`,
            'zh': `📅 ${dateStr} | 查看剩余团队数并选择您希望的时间。`
        };
        descEl.textContent = descs[CURRENT_LANG] || descs['en'];
    }

    renderTimeSlots(grid, bookedSlots, slotInfo);

    if (btnConfirm) {
        btnConfirm.onclick = () => {
            if (!selectedInstallationTime) return;
            modal.style.display = "none";
            openDeliveryInfoModal();
        };
    }
}

// ── 시간 슬롯 렌더링 ──
function renderTimeSlots(grid, bookedSlots, slotInfo) {
    grid.innerHTML = '';

    // 종일
    if (slotInfo.type === 'fullday') {
        const maxUsed = Math.max(...INSTALL_TIME_SLOTS.map(s => bookedSlots[s] || 0));
        const canBook = maxUsed < MAX_TEAMS;
        const div = document.createElement('div');
        div.className = 'time-slot' + (canBook ? ' slot-available' : ' slot-full');
        div.style.gridColumn = '1 / -1';
        div.innerHTML = `<div>08:00 ~ 22:00</div>`;
        if (canBook) {
            div.onclick = () => {
                grid.querySelectorAll('.time-slot').forEach(s => s.classList.remove('slot-selected'));
                div.classList.add('slot-selected');
                selectedInstallationTime = '08:00';
                document.getElementById("btnConfirmInstallTime").disabled = false;
            };
            // 종일은 옵션이 하나뿐이므로 자동 선택
            div.classList.add('slot-selected');
            selectedInstallationTime = '08:00';
            document.getElementById("btnConfirmInstallTime").disabled = false;
        }
        grid.appendChild(div);
        return;
    }

    // 2시간 / 4시간 슬롯
    INSTALL_TIME_SLOTS.forEach((slot, idx) => {
        let canBook = true;
        for (let i = 0; i < slotInfo.slots; i++) {
            if (idx + i >= INSTALL_TIME_SLOTS.length) { canBook = false; break; }
            const used = bookedSlots[INSTALL_TIME_SLOTS[idx + i]] || 0;
            if (used >= MAX_TEAMS) { canBook = false; break; }
        }

        const endIdx = Math.min(idx + slotInfo.slots, INSTALL_TIME_SLOTS.length);
        const endTime = endIdx < INSTALL_TIME_SLOTS.length ? INSTALL_TIME_SLOTS[endIdx] : '22:00';

        const div = document.createElement('div');
        div.className = `time-slot ${canBook ? 'slot-available' : 'slot-full'}`;
        div.innerHTML = `<div>${slot} ~ ${endTime}</div>`;

        if (canBook) {
            div.onclick = () => {
                grid.querySelectorAll('.time-slot').forEach(s => s.classList.remove('slot-selected'));
                div.classList.add('slot-selected');
                selectedInstallationTime = slot;
                document.getElementById("btnConfirmInstallTime").disabled = false;
            };
        }
        grid.appendChild(div);
    });
}

async function openDeliveryInfoModal() {
    document.getElementById("calendarModal").style.display = "none";
    document.getElementById("deliveryInfoModal").style.display = "flex";

    // ★ 담당 매니저 선택 (컬러 버튼)
    const mgrWrap = document.getElementById('staffManagerSelectWrap');
    const mgrHidden = document.getElementById('inputStaffManager');
    const mgrBtns = document.getElementById('staffManagerBtns');
    const mgrLabel = document.getElementById('staffManagerLabel');
    if (mgrWrap && mgrHidden && mgrBtns && sb) {
        try {
            const { data: managers } = await sb.from('admin_staff').select('id, name, color').eq('role', 'manager');
            if (managers && managers.length > 0) {
                mgrWrap.style.display = 'block';
                mgrHidden.value = '';
                // 다국어 라벨
                const lang = CURRENT_LANG || 'kr';
                const labels = {
                    kr: '담당 매니저 선택',
                    ja: 'ご担当のマネージャーがいらっしゃいましたらお選びください。',
                    en: 'If you have a dedicated manager, please select below.',
                    zh: '如果您有专属经理，请选择。',
                    es: 'Si tiene un gerente asignado, selecciónelo.',
                    de: 'Wenn Sie einen zuständigen Manager haben, wählen Sie bitte aus.',
                    fr: 'Si vous avez un responsable dédié, veuillez le sélectionner.',
                    ar: 'إذا كان لديك مدير مختص، يرجى الاختيار.'
                };
                if (mgrLabel) mgrLabel.textContent = labels[lang] || labels['en'];

                // 본사 + 매니저 버튼 (고정 4개: 본사, 은미, 성희, 지숙)
                const btnConfig = [
                    { label: { kr:'🏢 본사', ja:'🏢 本社', en:'🏢 HQ', zh:'🏢 总部', es:'🏢 Sede', de:'🏢 Zentrale', fr:'🏢 Siège', ar:'🏢 المقر' }, color:'#0ea5e9', id:'__hq__' },
                    { name:'은미', label:{ kr:'👩 은미', ja:'👩 ウンミ', en:'👩 Eunmi', zh:'👩 恩美', es:'👩 Eunmi', de:'👩 Eunmi', fr:'👩 Eunmi', ar:'👩 أونمي' }, color:'#8b5cf6' },
                    { name:'성희', label:{ kr:'👩 성희', ja:'👩 ソンヒ', en:'👩 Sunghee', zh:'👩 成熙', es:'👩 Sunghee', de:'👩 Sunghee', fr:'👩 Sunghee', ar:'👩 سونغهي' }, color:'#ec4899' },
                    { name:'지숙', label:{ kr:'👩 지숙', ja:'👩 ジスク', en:'👩 Jisook', zh:'👩 智淑', es:'👩 Jisook', de:'👩 Jisook', fr:'👩 Jisook', ar:'👩 جيسوك' }, color:'#f59e0b' }
                ];

                const hqWrap = document.getElementById('staffManagerHqBtn');
                const guideEl = document.getElementById('staffManagerGuide');
                mgrBtns.innerHTML = '';
                if (hqWrap) hqWrap.innerHTML = '';

                // 모든 매니저 버튼 선택 상태 동기화 함수
                const _syncAllMgrBtns = () => {
                    const allBtns = [...(hqWrap ? hqWrap.querySelectorAll('button') : []), ...mgrBtns.querySelectorAll('button')];
                    allBtns.forEach(b => {
                        const c = b.dataset.color;
                        if (b.dataset.staffId === mgrHidden.value) {
                            b.style.background = c; b.style.color = '#fff';
                        } else {
                            b.style.background = '#fff'; b.style.color = c;
                        }
                    });
                };

                btnConfig.forEach((cfg, idx) => {
                    const matchMgr = cfg.name ? managers.find(m => m.name.includes(cfg.name)) : null;
                    const staffId = matchMgr ? String(matchMgr.id) : (cfg.id || '');
                    const bgColor = (matchMgr && matchMgr.color) || cfg.color;
                    const text = cfg.label[lang] || cfg.label['en'];
                    const isHq = idx === 0;

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = text;
                    btn.dataset.staffId = staffId;
                    btn.dataset.color = bgColor;
                    btn.style.cssText = isHq
                        ? `width:100%;padding:16px 8px;border:2.5px solid ${bgColor};border-radius:12px;font-size:17px;font-weight:800;cursor:pointer;background:${bgColor};color:#fff;transition:all 0.2s;`
                        : `width:100%;padding:12px 4px;border:2.5px solid ${bgColor};border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:${bgColor};transition:all 0.2s;min-width:0;white-space:nowrap;`;
                    btn.onmouseenter = () => { if (mgrHidden.value !== staffId) { btn.style.background = bgColor + '18'; } };
                    btn.onmouseleave = () => { if (mgrHidden.value !== staffId) { btn.style.background = '#fff'; } };
                    btn.onclick = () => {
                        if (mgrHidden.value === staffId) {
                            mgrHidden.value = '';
                        } else {
                            mgrHidden.value = staffId;
                        }
                        _syncAllMgrBtns();
                    };

                    if (isHq) {
                        (hqWrap || mgrBtns).appendChild(btn);
                    } else {
                        mgrBtns.appendChild(btn);
                    }
                });

                // ★ 본사 기본 선택
                const hqBtn = btnConfig[0];
                const hqStaffId = hqBtn.id || '__hq__';
                mgrHidden.value = hqStaffId;
                _syncAllMgrBtns();

                // ★ 안내 문구 (한국어 전용)
                if (guideEl) {
                    if (lang === 'kr') {
                        guideEl.textContent = '상담하신 매니저가 없다면 본사에서 연락드릴게요 😊';
                        guideEl.style.display = 'block';
                    } else {
                        guideEl.style.display = 'none';
                    }
                }
                // ★ 본사 전용 카테고리 자동 배정: 보드류도매가, 종이매대, 굿즈판촉물
                const HQ_ONLY_TOP_CATS = ['Wholesale Board Prices', 'paper_display', '77777'];
                const hasHqOnlyItem = cartData.some(item => {
                    const cat = item.product?.category || '';
                    const topCat = window._getTopCategoryCode ? window._getTopCategoryCode(cat) : '';
                    return HQ_ONLY_TOP_CATS.includes(topCat) || HQ_ONLY_TOP_CATS.includes(cat);
                });
                if (hasHqOnlyItem) {
                    // 본사 자동 선택 + 잠금
                    mgrHidden.value = '__hq__';
                    const allLockBtns = [...(hqWrap ? hqWrap.querySelectorAll('button') : []), ...mgrBtns.querySelectorAll('button')];
                    allLockBtns.forEach(b => {
                        const c = b.dataset.color;
                        if (b.dataset.staffId === '__hq__') {
                            b.style.background = c;
                            b.style.color = '#fff';
                        } else {
                            b.style.background = '#f1f5f9';
                            b.style.color = '#94a3b8';
                            b.style.borderColor = '#e2e8f0';
                            b.style.cursor = 'not-allowed';
                        }
                        b.disabled = true;
                    });
                    const lockMsgs = {
                        kr: '이 상품은 본사에서 직접 처리합니다.',
                        ja: 'この商品は本社が直接対応します。',
                        en: 'This product is handled directly by HQ.',
                        zh: '此产品由总部直接处理。',
                        es: 'Este producto es gestionado directamente por la sede.',
                        de: 'Dieses Produkt wird direkt von der Zentrale bearbeitet.',
                        fr: 'Ce produit est géré directement par le siège.',
                        ar: 'هذا المنتج يتم التعامل معه مباشرة من المقر.'
                    };
                    if (mgrLabel) mgrLabel.textContent = lockMsgs[lang] || lockMsgs['en'];
                }
            }
        } catch(e) { console.error('매니저 목록 로드 실패:', e); }
    }

    // 허니콤보드 포함 여부 체크 → 배송 지역 선택 표시
    const hasHoneycomb = hasHoneycombInCart();

    const metroSection = document.getElementById('metroAreaSection');
    if (metroSection) {
        metroSection.style.display = hasHoneycomb ? 'block' : 'none';
        // 국가별 설명/옵션 라벨 업데이트
        const descEl = document.getElementById('metroAreaDesc');
        const opts = metroSection.querySelectorAll('.metro-opt');
        const feeNotice = document.getElementById('nonMetroFeeNotice');
        const feeText = document.getElementById('nonMetroFeeText');
        const country = (typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG.COUNTRY : 'KR');

        if (country === 'JP') {
            if(descEl) descEl.textContent = window.t('desc_delivery_area_jp', 'ハニカムボードは東京23区外の場合、追加送料がかかります。');
            if(opts[0]) opts[0].textContent = window.t('opt_metro_area_jp', '東京23区内');
            if(opts[1]) opts[1].textContent = window.t('opt_non_metro_area_jp', 'その他地域');
            if(feeText) feeText.textContent = window.t('msg_non_metro_fee_jp', 'その他地域 追加送料: ¥40,000が適用されます。');
        } else if (country === 'KR') {
            if(descEl) descEl.textContent = window.t('desc_delivery_area_kr', '허니콤보드 제품은 서울·경기 외 지역에 추가 배송비가 적용됩니다.');
            if(opts[0]) opts[0].textContent = window.t('opt_metro_area', '수도권 (서울·경기)');
            if(opts[1]) opts[1].textContent = window.t('opt_non_metro_area', '기타 지역');
            if(feeText) feeText.textContent = window.t('msg_non_metro_fee', '기타 지역 추가 배송비: 200,000원이 적용됩니다.');
        } else {
            if(descEl) descEl.textContent = window.t('desc_delivery_area_global', 'Honeycomb Board products have additional shipping fees for non-metropolitan areas.');
            if(opts[0]) opts[0].textContent = window.t('opt_metro_area_global', 'Major metro area');
            if(opts[1]) opts[1].textContent = window.t('opt_non_metro_area_global', 'Other regions');
            if(feeText) feeText.textContent = window.t('msg_non_metro_fee_global', 'Additional shipping fee for non-metro area: ' + formatCurrency(200000) + ' will be applied.');
        }

        // 라디오 토글 이벤트
        if (!metroSection.dataset.init) {
            metroSection.dataset.init = '1';
            metroSection.querySelectorAll('input[name="metroArea"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    opts.forEach(o => o.classList.remove('selected-metro'));
                    radio.closest('label').querySelector('.metro-opt').classList.add('selected-metro');
                    if (feeNotice) feeNotice.style.display = radio.value === 'non-metro' ? 'block' : 'none';
                });
            });
        }
        // 초기화: metro 선택으로 리셋
        const metroRadio = metroSection.querySelector('input[value="metro"]');
        if (metroRadio) { metroRadio.checked = true; metroRadio.dispatchEvent(new Event('change')); }
    }
}

// [수정] 용량 초과 방지: 잘못된 이미지 데이터 자동 청소
function saveCart() {
    const storageKey = cartStorageKey();

    // ★ 안전장치: cartData가 비어있는데 localStorage에 데이터가 있으면 덮어쓰지 않음
    if (cartData.length === 0) {
        try {
            const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (existing.length > 0) {
                console.warn('[saveCart] BLOCKED: cartData is empty but localStorage has', existing.length, 'items. Refusing to overwrite.');
                return;
            }
        } catch(e) {}
    }

    // 1. 데이터 다이어트: 무거운 데이터는 빼고 저장
    const cleanData = cartData.map(item => {
        const { json, pages, fileData, ...rest } = item;
        
        // [핵심] 썸네일 검사: URL 형식이 아니거나(Base64), 길이가 너무 길면 삭제
        if (rest.thumb && (!rest.thumb.startsWith('http') || rest.thumb.length > 500)) {
            rest.thumb = null; // 여기서 null로 만들면 renderCart에서 제품 이미지(product.img)를 대신 보여줌
        }
        return rest;
    });
    
    try { 
        localStorage.setItem(storageKey, JSON.stringify(cleanData)); 
    } catch(e) { 
        // 2. 용량 부족 시 비상 청소 (기존 찌꺼기 데이터 제거)
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn("저장 공간 부족! 불필요한 데이터 정리 중...");
            
            Object.keys(localStorage).forEach(key => {
                if (key !== storageKey && !key.startsWith('sb-') && !key.includes('token')) {
                    localStorage.removeItem(key);
                }
            });

            // 3. 재시도
            try {
                // 썸네일을 아예 제거한 초경량 버전으로 저장 시도
                const superClean = cleanData.map(item => ({ ...item, thumb: null }));
                localStorage.setItem(storageKey, JSON.stringify(superClean));
            } catch (finalErr) {
                showToast(window.t('msg_storage_full', "Browser storage is full. Please remove unnecessary cart items."), "warn");
            }
        }
    } 
}

// ============================================================
// [4] 디자인/파일 장바구니 담기
// ============================================================
// 상품 공통 하단 안내문 캐시
let _pdpFooterCache = {};
async function loadPdpFooter() {
    const lang = CURRENT_LANG || 'kr';
    if (_pdpFooterCache[lang] !== undefined) return _pdpFooterCache[lang];
    try {
        const { data } = await sb.from('chatbot_knowledge').select('answer')
            .eq('category', '_product_footer').eq('language', lang).eq('is_active', true).maybeSingle();
        _pdpFooterCache[lang] = data ? data.answer : '';
    } catch(e) { _pdpFooterCache[lang] = ''; }
    return _pdpFooterCache[lang];
}

export function openProductDetail(key, w, h, mode) {
    // ★ [수정] window.PRODUCT_DB 우선 조회 (module PRODUCT_DB는 비어있을 수 있음)
    let product = (window.PRODUCT_DB && window.PRODUCT_DB[key]) || PRODUCT_DB[key];
    if (!product) { product = { name: key, price: 0, img: '', addons: [] }; }

    currentTargetProduct = { key, w, h, mode, info: product };

    document.getElementById("pdpTitle").innerText = localName(product);
    document.getElementById("pdpPrice").innerText = formatCurrency(product.price);

    const imgElem = document.getElementById("pdpImage");
    if(imgElem) imgElem.src = product.img || 'https://placehold.co/400';

    document.getElementById("productDetailModal").style.display = "flex";

    // 공통 하단 안내문 로드
    const footerEl = document.getElementById('pdpFooterContent');
    if (footerEl) {
        loadPdpFooter().then(content => {
            if (content) {
                footerEl.innerHTML = content.replace(/\n/g, '<br>');
                footerEl.style.display = 'block';
            } else {
                footerEl.style.display = 'none';
            }
        });
    }
}

export async function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    
    document.getElementById("productDetailModal").style.display = "none"; 
    
    try { localStorage.setItem('current_product_key', currentTargetProduct.key); } catch(e) {}

    if(window.applySize) {
        window.applySize(currentTargetProduct.w, currentTargetProduct.h, currentTargetProduct.key, currentTargetProduct.mode, 'replace'); 
    }
    
    const startScreen = document.getElementById("startScreen");
    const mainEditor = document.getElementById("mainEditor");
    if(startScreen) startScreen.style.display = "none";
    if(mainEditor) mainEditor.style.display = "flex";
    
    window.dispatchEvent(new Event('resize')); 
    
    if(canvas) canvas.currentProductKey = currentTargetProduct.key; 
    window.currentProductKey = currentTargetProduct.key;
    
    try {
        const { data } = await sb.from('library')
            .select('data_url')
            .eq('product_key', currentTargetProduct.key)
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (data && data.length > 0) {
            setTimeout(async () => {
                if (!window.loadProductFixedTemplate) return;
                let tplData = data[0].data_url;
                // Storage JSON URL이면 fetch 후 이미지 URL 추출
                if (tplData && typeof tplData === 'string' && tplData.endsWith('.json')) {
                    try {
                        const res = await fetch(tplData);
                        const json = await res.json();
                        if (json.objects) {
                            for (const obj of json.objects) {
                                if (obj.src && (obj.src.startsWith('http') || obj.src.startsWith('data:'))) { tplData = obj.src; break; }
                            }
                        }
                    } catch(e) {}
                }
                window.loadProductFixedTemplate(tplData);
            }, 500);
        }
    } catch (e) { console.error("템플릿 로드 오류:", e); }
}

// [수정됨] 장바구니 담기 (용량 초과 방지: JSON 클라우드 업로드)
async function addCanvasToCart() {
    if (window.isDirectCartAddInProgress) { console.warn('[장바구니] isDirectCartAddInProgress 중복 방지'); return; }
    let canvas = window.canvas;
    if (!canvas) {
        // 에디터 라이브러리 미로드 시 동적 로드 후 캔버스 초기화
        console.warn('[장바구니] canvas 없음 — 에디터 초기화 시도');
        try {
            if (!window._editorLibsLoaded && window.loadEditorLibraries) {
                const _ld = document.getElementById('loading');
                if (_ld) _ld.style.display = 'flex';
                await window.loadEditorLibraries();
                if (window._pendingEditorInits) { window._pendingEditorInits(); delete window._pendingEditorInits; }
                if (_ld) _ld.style.display = 'none';
            }
            canvas = window.canvas;
        } catch(e) { console.error('에디터 초기화 실패:', e); }
        if (!canvas) { showToast('Canvas not ready. Please try again.', 'error'); return; }
    }
    console.log('[장바구니] addCanvasToCart 시작');
    
    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = window.t('msg_processing_design') || "Processing design...";
    }

    // 1. 상품 정보 먼저 확보
    let key = window.currentProductKey || canvas.currentProductKey;
    try { if (!key) key = localStorage.getItem('current_product_key') || 'A4'; } catch(e) { if (!key) key = 'A4'; }

    let product = (window.PRODUCT_DB && window.PRODUCT_DB[key]) ? window.PRODUCT_DB[key] : PRODUCT_DB[key];

    // 상품 정보 복구 로직
    if (!product || (product.is_custom_size && product.price === 0)) {
        try {
            const { data: prodData, error } = await sb.from('admin_products').select('code, name, name_jp, name_us, price, price_jp, price_us, img_url, width_mm, height_mm, addons, category, is_file_upload, is_custom_size, material').eq('code', key).maybeSingle();
            
            if (prodData) {
                const scaleFactor = 3.7795;
                const pxW = Math.round((prodData.width_mm || 210) * scaleFactor);
                const pxH = Math.round((prodData.height_mm || 297) * scaleFactor);
                
                const country = (typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG.COUNTRY : 'KR');
                let dName = prodData.name;

                if (country === 'JP') { dName = prodData.name_jp || dName; }
                else if (country === 'US') { dName = prodData.name_us || dName; }

                PRODUCT_DB[key] = {
                    name: dName,
                    name_jp: prodData.name_jp || '',
                    name_us: prodData.name_us || '',
                    price: prodData.price,  // 항상 KRW (formatCurrency가 환산)
                    price_jp: prodData.price_jp, price_us: prodData.price_us,
                    img: prodData.img_url,
                    w: pxW, h: pxH,
                    w_mm: prodData.width_mm, h_mm: prodData.height_mm,
                    addons: prodData.addons ? prodData.addons.split(',') : [],
                    category: prodData.category
                };
            }
        } catch(e) {
            console.error("상품 정보 복구 실패:", e);
        }
    }

    product = (window.PRODUCT_DB && window.PRODUCT_DB[key]) ? window.PRODUCT_DB[key] : PRODUCT_DB[key];
    
    if (!product) {
        if (loading) loading.style.display = "none";
        document.getElementById('cartPage').style.display = 'block';
        document.body.classList.remove('editor-active');
        return; 
    }

    let thumbUrl = product.img || "https://placehold.co/100?text=No+Image";

    const originalVpt = canvas.viewportTransform;
    const board = canvas.getObjects().find(o => o.isBoard);
    
    // 2. 캔버스 캡처 시도
    try {
        let blob = null;
        if (board) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); 
            
            const targetW = board.width * board.scaleX;
            const targetH = board.height * board.scaleY;
            
            const maxDimension = 800; 
            let dynamicMultiplier = 1.0;
            const maxSide = Math.max(targetW, targetH);
            
            if (maxSide > maxDimension) {
                dynamicMultiplier = maxDimension / maxSide;
            }

            try {
                const dataUrl = canvas.toDataURL({ 
                    format: 'jpeg', left: board.left, top: board.top, 
                    width: targetW, height: targetH, 
                    multiplier: dynamicMultiplier, quality: 0.7 
                });
                blob = await (await fetch(dataUrl)).blob();
            } catch (innerErr) {
                console.warn("캔버스 캡처 차단됨(CORS), 대체 이미지 탐색:", innerErr);
                
                const objects = canvas.getObjects();
                let mainImgUrl = null;

                if (canvas.backgroundImage && canvas.backgroundImage.src) {
                    mainImgUrl = canvas.backgroundImage.src;
                }
                else {
                    const imgObj = objects.find(o => o.type === 'image');
                    if (imgObj && imgObj.getSrc()) {
                        mainImgUrl = imgObj.getSrc();
                    }
                }

                if (mainImgUrl) {
                    thumbUrl = mainImgUrl; 
                }
            }
            canvas.setViewportTransform(originalVpt); 
        }
        
        if (blob) {
             const thumbUrlUpload = await uploadFileToSupabase(blob, 'thumbs');
             if(thumbUrlUpload) thumbUrl = thumbUrlUpload;
        }

    } catch(e) { 
        console.error("썸네일 프로세스 오류:", e); 
        try { canvas.setViewportTransform(originalVpt); } catch(ex){}
    }

    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst', 'shadow', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone']);
    const finalW = board ? board.width * board.scaleX : (product.w || canvas.width);
    const finalH = board ? board.height * board.scaleY : (product.h || canvas.height);
    const boardX = board ? board.left : 0;
    const boardY = board ? board.top : 0;

    // ★ PNG 다운로드와 100% 동일한 방식으로 고화질 PNG 캡처
    let designPdfUrl = null;
    try {
        const _tempEl = document.createElement('canvas');
        const _tempCvs = new fabric.StaticCanvas(_tempEl);
        _tempCvs.setWidth(finalW);
        _tempCvs.setHeight(finalH);
        _tempCvs.setBackgroundColor('#ffffff');

        // 목업/가이드 제거, 보드 테두리 제거
        const _filteredJson = { ...json };
        if (_filteredJson.objects) {
            _filteredJson.objects = _filteredJson.objects
                .filter(o => !o.isMockup && !o.excludeFromExport)
                .map(o => o.isBoard ? { ...o, strokeWidth: 0, stroke: null, shadow: null } : o);
        }

        await new Promise(resolve => {
            _tempCvs.loadFromJSON(_filteredJson, () => {
                _tempCvs.setViewportTransform([1, 0, 0, 1, -boardX, -boardY]);
                _tempCvs.setBackgroundColor('#ffffff');
                _tempCvs.renderAll();
                setTimeout(resolve, 500);
            });
        });

        // 300 DPI 목표지만 Supabase Storage 5MB 제한을 고려해 동적 조정
        // 큰 캔버스(가벽 등)는 mult 낮추고, JPEG로 압축
        const _maxPx = 50000000; // 50M pixels (이전 150M에서 축소 — Storage 제한 대응)
        const _basePx = finalW * finalH;
        let _mult = 4;
        if (_basePx * _mult * _mult > _maxPx) _mult = Math.max(1.5, Math.sqrt(_maxPx / _basePx));

        // ★ Storage 5MB 제한 대응: JPEG 사용 + 사이즈 따라 품질 조정
        const _outFormat = 'jpeg';
        const _quality = _basePx > 4000000 ? 0.75 : 0.85;
        const _dataUrl = _tempCvs.toDataURL({ format: _outFormat, multiplier: _mult, quality: _quality });
        _tempCvs.dispose();

        // DataURL → Blob → 업로드
        const _resp = await fetch(_dataUrl);
        let _blob = await _resp.blob();
        console.log('[장바구니] 디자인 PNG 1차 시도 size:', Math.round(_blob.size/1024), 'KB, mult:', _mult.toFixed(2));

        // ★ 5MB 초과 시 자동 다운스케일 재시도 (최대 2회)
        const _MAX_BYTES = 4500000; // 4.5MB 안전 마진
        let _retryMult = _mult;
        let _retryQuality = _quality;
        for (let _retry = 0; _retry < 2 && _blob.size > _MAX_BYTES; _retry++) {
            _retryMult = _retryMult * 0.7;
            _retryQuality = Math.max(0.6, _retryQuality - 0.1);
            console.log(`[장바구니] PNG 너무 큼 (${Math.round(_blob.size/1024)}KB) → 재시도 mult=${_retryMult.toFixed(2)} q=${_retryQuality}`);
            // 임시 캔버스 재생성
            const _tempEl2 = document.createElement('canvas');
            const _tempCvs2 = new fabric.StaticCanvas(_tempEl2);
            _tempCvs2.setWidth(finalW);
            _tempCvs2.setHeight(finalH);
            _tempCvs2.setBackgroundColor('#ffffff');
            await new Promise(resolve => {
                _tempCvs2.loadFromJSON(_filteredJson, () => {
                    _tempCvs2.setViewportTransform([1, 0, 0, 1, -boardX, -boardY]);
                    _tempCvs2.setBackgroundColor('#ffffff');
                    _tempCvs2.renderAll();
                    setTimeout(resolve, 300);
                });
            });
            const _dataUrl2 = _tempCvs2.toDataURL({ format: 'jpeg', multiplier: _retryMult, quality: _retryQuality });
            _tempCvs2.dispose();
            const _resp2 = await fetch(_dataUrl2);
            _blob = await _resp2.blob();
            console.log('[장바구니] 재시도 결과 size:', Math.round(_blob.size/1024), 'KB');
        }

        if (_blob && _blob.size > 500 && _blob.size <= _MAX_BYTES) {
            designPdfUrl = await uploadFileToSupabase(_blob, 'cart_designs');
        } else if (_blob && _blob.size > _MAX_BYTES) {
            console.warn('[장바구니] PNG 업로드 포기 — 여전히 너무 큼:', Math.round(_blob.size/1024), 'KB');
        }
    } catch(e) {
        console.warn("디자인 PNG 캡처 실패:", e);
    }

    // ★ 박스 배치도 PDF 생성 + 업로드
    let boxLayoutPdfUrl = null;
    if (window.__boxMode && window.__boxNesting && window.__boxDims) {
        try {
            const { generateBoxLayoutPDF } = await import('./export.js?v=404');
            const layoutBlob = await generateBoxLayoutPDF(
                window.__boxNesting.sheets,
                window.__boxDims,
                pdfPages
            );
            if (layoutBlob && layoutBlob.size > 500) {
                boxLayoutPdfUrl = await uploadFileToSupabase(layoutBlob, 'cart_pdf');
            }
        } catch(e) {
            console.warn("박스 배치도 PDF 생성 실패:", e);
        }
    }

    // ★ 상품 정보 다이어트 (select('*')로 불러온 거대 데이터 방지 — addProductToCartDirectly와 동일 패턴)
    const _imgField = product.img || product.img_url || '';
    let calcProduct = {
        name: product.name,
        name_jp: product.name_jp || '',
        name_us: product.name_us || '',
        code: product.code || product.key,
        price: product.price,
        price_jp: product.price_jp || 0,
        price_us: product.price_us || 0,
        img: (_imgField && _imgField.length < 500 && !_imgField.startsWith('data:')) ? _imgField : null,
        w: product.w || 0,
        h: product.h || 0,
        w_mm: product.w_mm || product.width_mm || 0,
        h_mm: product.h_mm || product.height_mm || 0,
        category: product.category || '',
        addons: product.addons || [],
        is_custom_size: product.is_custom_size || false,
        is_file_upload: product.is_file_upload || false,
        _calculated_price: product._calculated_price || false,
        _quote_item: product._quote_item || false,
        _base_sqm_price: product._base_sqm_price || 0,
        partner_id: product.partner_id || null,
        material: product.material || '',
        artworkType: product._artworkType || null,
        artworkTypePrice: product._artworkTypePrice || null,
        artworkTypeFixed: product._artworkTypeFixed || false,
        blindSide: product._blindSide || null,
        tshirtColor: product._tshirtColor || null,
        tshirtColorName: product._tshirtColorName || null,
        tshirtSize: product._tshirtSize || null
    };

    const mmToPx = 3.7795;
    const currentMmW = finalW / mmToPx;
    const currentMmH = finalH / mmToPx;

    // ★ 박스 상품 가격: 시트수 × 장당가격 (배치 알고리즘 기반)
    if (window.__boxMode && window.__boxCalculatedPrice) {
        calcProduct.price = window.__boxCalculatedPrice;
        calcProduct._calculated_price = true;
        calcProduct.is_custom_size = true;
        calcProduct._box_sheet_count = window.__boxSheetCount;
        calcProduct._box_dims = window.__boxDims ? { ...window.__boxDims } : null;
    // ★ 가벽 상품 가격: 면적 × m²단가 × 면수 × 벽수
    } else if (window.__wallMode && window.__wallCalculatedPrice) {
        calcProduct.price = window.__wallCalculatedPrice;
        calcProduct._calculated_price = true;
        calcProduct.is_custom_size = true;
        calcProduct._wall_config = window.__wallConfig ? { ...window.__wallConfig } : null;
    // ★ 글씨 스카시: 면적 기반 가격 사용 (위자드에서 계산됨)
    } else if (window.__letterSignData && product._calculated_price) {
        calcProduct._calculated_price = true;
        calcProduct.is_custom_size = true;
        calcProduct._letter_sign_data = { ...window.__letterSignData };
    // ★ 종이매대: 고정가격 사용 (회배계산 적용 안함)
    } else if (window.__paperDisplayData) {
        calcProduct.is_custom = true;
        calcProduct._calculated_price = true;
    // ★ 사이즈고정상품: 고정단가 유지 (면적 재계산 안함, 수량할인 적용 가능)
    } else if (product.is_file_upload) {
        calcProduct._calculated_price = false;
        calcProduct.is_custom_size = true;
    } else if (product.is_custom_size) {
        // 이미 계산된 가격이 있고, 사이즈가 일치하면 유지 (수량할인 가능하도록 _calculated_price = false)
        // ★ 견적서에서 담은 상품은 가격 재계산하지 않음
        if (product._quote_item) {
            calcProduct._calculated_price = true;
        } else if (product._calculated_price && product.price > 0 && Math.abs((product.w_mm || product.width_mm || 0) - currentMmW) < 5) {
            calcProduct._calculated_price = false; // 고정단가 유지 → 수량할인 적용 가능
        } else {
            // 제품 실제 회배 단가(price)로 면적 계산
            const sqmPrice = product._base_sqm_price || product.price || 50000;
            const area_m2 = (currentMmW / 1000) * (currentMmH / 1000);
            let calcPrice = Math.round((area_m2 * sqmPrice) / 10) * 10;
            if (calcPrice < 100) calcPrice = sqmPrice; // 최소 단가 = 기본 단가
            calcProduct.price = calcPrice;
            calcProduct._calculated_price = true; // 면적 기반 재계산 → 수량할인 제외
        }
    }
    
    let originalFileUrl = null; 
    let fileName = window.t('default_design_name') || "My Design";
    if (window.currentUploadedPdfUrl) {
        originalFileUrl = window.currentUploadedPdfUrl;
        fileName = "Uploaded_Original_PDF.pdf"; 
        window.currentUploadedPdfUrl = null; 
    }

    if(loading) loading.style.display = "none";

    if (window.isDirectCartAddInProgress) return;

    let finalPages = [json];
    const _pdl2 = window.__pageDataList || pageDataList;
    const _cpi2 = (typeof window._getPageIndex === 'function') ? window._getPageIndex() : currentPageIndex;
    if (_pdl2 && _pdl2.length > 0) {
        finalPages = [..._pdl2];
        if (typeof _cpi2 === 'number' && _cpi2 >= 0 && _cpi2 < finalPages.length) {
            finalPages[_cpi2] = json;
        } else {
            if(finalPages.length === 0) finalPages = [json];
        }
    }

    const recoveredAddons = {};
    const recoveredAddonQtys = {};

    console.log('[장바구니] pendingSelectedAddons:', window.pendingSelectedAddons, 'pendingAddonQtys:', window.pendingSelectedAddonQtys);
    console.log('[장바구니] product.addons:', calcProduct.addons);

    if (window.pendingSelectedAddons && window.pendingSelectedAddons.length > 0) {
        const savedQtys = window.pendingSelectedAddonQtys || {};
        window.pendingSelectedAddons.forEach(code => {
            recoveredAddons[`opt_${code}`] = code;
            recoveredAddonQtys[code] = savedQtys[code] || 1;
        });
        console.log('[장바구니] 복구된 addons:', recoveredAddons, 'qtys:', recoveredAddonQtys);
    }

    // ★ 가벽 3D 액세서리 → 장바구니 addon 자동 연동
    // ★ PDP에서 명시적으로 선택한 addon은 삭제하지 않음
    if (window.__wallMode && window.__wallAccessories) {
        const _pendingSet = new Set(window.pendingSelectedAddons || []);
        const _ADDON_MAP = { cornerPillar: 'For', topLight: '87545', outdoorStand: 'b0001' };
        const _counts = (window.__wallConfig && window.__wallConfig.accessoryCounts) || {};
        Object.entries(window.__wallAccessories).forEach(([key, enabled]) => {
            const code = _ADDON_MAP[key];
            if (!code) return;
            if (enabled) {
                recoveredAddons['opt_' + code] = code;
                recoveredAddonQtys[code] = _counts[key] || 1;
            } else if (!_pendingSet.has(code)) {
                // PDP에서 사용자가 직접 선택한 addon은 3D 설정으로 삭제하지 않음
                delete recoveredAddons['opt_' + code];
                delete recoveredAddonQtys[code];
            }
        });
    }

    // [수정] 수량이 1로 리셋되는 문제 해결
    let initialQty = 1;
    let storedQty = null; try { storedQty = localStorage.getItem('pending_product_qty'); } catch(e) {}
    if (storedQty) {
        initialQty = parseInt(storedQty);
        localStorage.removeItem('pending_product_qty'); 
    }

    // [수정] 용량 초과 방지: 모든 디자인 데이터를 클라우드에 업로드하고 로컬 저장소에는 URL만 남깁니다.
    let savedJsonUrl = null;
    if (json) {
        try {
            const _pdl3 = window.__pageDataList || pageDataList;
            const jsonStr = JSON.stringify({ main: json, pages: (_pdl3 && _pdl3.length > 0 ? _pdl3 : []) });
            const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
            // 'cart_json' 폴더에 업로드하여 로컬 스토리지 점유율을 0에 가깝게 만듭니다.
            savedJsonUrl = await uploadFileToSupabase(jsonBlob, 'cart_json');
        } catch (err) {
            console.error("JSON 업로드 필수 실패:", err);
            showToast(window.t('msg_design_save_failed', "Failed to save design data. Please check your internet connection."), "error"); return;
        }
    }

    // ★ 가벽: 벽 수 저장 (PDF 견적서에서 "N벽" 표시용)
    const _wallCount = (window.__wallMode && window.__wallConfig && window.__wallConfig.walls)
        ? window.__wallConfig.walls.length : 0;

    const newItem = {
        uid: Date.now() + Math.random().toString(36).substr(2, 5),
        product: calcProduct,
        type: 'design',
        thumb: thumbUrl,
        json: null,      // 로컬에는 거대 데이터를 저장하지 않음
        pages: [],       // 로컬에는 거대 데이터를 저장하지 않음
        pageCount: finalPages.length, // ★ 페이지(면) 수 보존
        wallCount: _wallCount,        // ★ 가벽 수 보존
        jsonUrl: savedJsonUrl,
        designPdfUrl: designPdfUrl,
        boxLayoutPdfUrl: boxLayoutPdfUrl,
        boxDims: window.__boxMode ? { ...window.__boxDims } : null,
        boxSheetCount: window.__boxMode ? window.__boxSheetCount : null,
        originalUrl: originalFileUrl,
        fileName: fileName,
        width: finalW,
        height: finalH,
        boardX: boardX,
        boardY: boardY,
        isOpen: true,
        qty: initialQty, // [수정] 불러온 수량 적용
        selectedAddons: recoveredAddons,
        addonQuantities: recoveredAddonQtys
    };

    // 1. 저장소에서 최신 데이터 가져오기
    const storageKey = cartStorageKey();
    let currentCartList = [];
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) currentCartList = JSON.parse(saved);
        if (!Array.isArray(currentCartList)) currentCartList = [];
    } catch(e) { currentCartList = []; }

    // 2. 리스트에 추가 또는 기존 아이템 업데이트 (다시 편집 시)
    if (typeof window.editingCartItemIdx === 'number' && window.editingCartItemIdx >= 0 && window.editingCartItemIdx < currentCartList.length) {
        console.log('[장바구니] 기존 아이템 편집 모드, idx:', window.editingCartItemIdx);
        // 기존 아이템의 수량/옵션/가격 보존하면서 디자인 데이터만 교체
        const oldItem = currentCartList[window.editingCartItemIdx];
        newItem.qty = oldItem.qty || newItem.qty;
        // ★ PDP에서 새로 선택한 옵션이 있으면 그것을 우선 사용 (복구된 addons > 기존 addons)
        if (window.pendingSelectedAddons && window.pendingSelectedAddons.length > 0) {
            // recoveredAddons가 이미 newItem에 반영됨 — 기존 아이템으로 덮어쓰지 않음
            console.log('[장바구니] pendingSelectedAddons 존재 → 새 옵션 유지');
        } else {
            newItem.selectedAddons = oldItem.selectedAddons || newItem.selectedAddons;
            newItem.addonQuantities = oldItem.addonQuantities || newItem.addonQuantities;
        }
        // ★ 기존 단가/사이즈 보존 (회배계산기 결과 + 커스텀 사이즈)
        if (oldItem.product) {
            if (oldItem.product.price) newItem.product.price = oldItem.product.price;
            if (oldItem.product.w_mm) newItem.product.w_mm = oldItem.product.w_mm;
            if (oldItem.product.h_mm) newItem.product.h_mm = oldItem.product.h_mm;
            if (oldItem.product.width_mm) newItem.product.width_mm = oldItem.product.width_mm;
            if (oldItem.product.height_mm) newItem.product.height_mm = oldItem.product.height_mm;
            if (oldItem.product.is_custom) newItem.product.is_custom = oldItem.product.is_custom;
            if (oldItem.product.is_custom_size) newItem.product.is_custom_size = oldItem.product.is_custom_size;
        }
        currentCartList[window.editingCartItemIdx] = newItem;
        window.editingCartItemIdx = undefined;
    } else {
        currentCartList.push(newItem);
    }

    // 3. [핵심] 저장소에 저장 (용량 다이어트 적용)
    try { 
        const optimizedList = currentCartList.map(item => {
            const { json, pages, ...rest } = item;
            return rest;
        });
        localStorage.setItem(storageKey, JSON.stringify(optimizedList)); 
    } catch(e) { 
        if (e.name === 'QuotaExceededError' || e.code === 22) {
             // 다른 사용자의 장바구니 찌꺼기 삭제
             Object.keys(localStorage).forEach(key => {
                 if (key.startsWith('chameleon_cart_') && !key.includes(currentUser?.id || 'guest')) {
                     localStorage.removeItem(key);
                 }
             });
             showToast(window.t('msg_storage_full', "Browser storage is full. Please close unnecessary tabs or clear cache."), "warn");
        }
    }

    // 4. 그 다음 메모리(cartData) 동기화 및 렌더링
    cartData.length = 0;
    currentCartList.forEach(item => cartData.push(item));

    // ★ [안전장치] 방금 추가한 아이템에 addon이 제대로 붙었는지 최종 확인
    const latestItem = cartData[cartData.length - 1];
    if (latestItem && window.pendingSelectedAddons && window.pendingSelectedAddons.length > 0) {
        const hasAddons = latestItem.selectedAddons && Object.keys(latestItem.selectedAddons).length > 0;
        if (!hasAddons) {
            console.warn('[장바구니] selectedAddons 누락 감지! pendingSelectedAddons에서 강제 복원');
            const _savedQtys = window.pendingSelectedAddonQtys || {};
            latestItem.selectedAddons = {};
            latestItem.addonQuantities = {};
            window.pendingSelectedAddons.forEach(code => {
                latestItem.selectedAddons[`opt_${code}`] = code;
                latestItem.addonQuantities[code] = _savedQtys[code] || 1;
            });
        }
        console.log('[장바구니] 최종 selectedAddons:', JSON.stringify(latestItem.selectedAddons));
    }

    // ★ [버그수정] pendingSelectedAddons 초기화 (다음 렌더링에서 다른 아이템에 잘못 적용 방지)
    window.pendingSelectedAddons = null;
    window.pendingSelectedAddonQtys = null;

    renderCart();

    if(loading) loading.style.display = "none";

    const modal = document.getElementById('cartAddedModal');
    if (modal) modal.style.display = 'none';

    const cartPage = document.getElementById('cartPage');
    if (cartPage) cartPage.style.display = 'block';

    document.body.classList.remove('editor-active');
}

async function addFileToCart(e) {
    const file = e.target.files[0];
    if(!file || !currentTargetProduct) return;

    // ★ 50MB 초과 파일 차단
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(0);
        const _fileMsgs = {
            kr: `${sizeMB}MB 파일은 접수가 불가능합니다 (최대 50MB).\n파일 용량을 줄이시거나 이메일로 보내주세요.`,
            ja: `${sizeMB}MBのファイルはアップロードできません（最大50MB）。\nファイルサイズを小さくするか、メールでお送りください。`,
            en: `This file (${sizeMB}MB) exceeds the 50MB limit.\nPlease reduce the file size or send it via email.`,
            zh: `文件(${sizeMB}MB)超过50MB限制。\n请缩小文件或通过邮件发送。`,
            ar: `هذا الملف (${sizeMB}MB) يتجاوز الحد الأقصى 50MB.\nيرجى تقليل حجم الملف أو إرساله عبر البريد الإلكتروني.`,
            es: `Este archivo (${sizeMB}MB) excede el límite de 50MB.\nPor favor, reduce el tamaño o envíalo por correo.`,
            de: `Diese Datei (${sizeMB}MB) überschreitet das 50MB-Limit.\nBitte verkleinern Sie die Datei oder senden Sie sie per E-Mail.`,
            fr: `Ce fichier (${sizeMB}MB) dépasse la limite de 50MB.\nVeuillez réduire sa taille ou l'envoyer par e-mail.`
        };
        const _lang = CURRENT_LANG || 'en';
        const msg = (_fileMsgs[_lang] || _fileMsgs.en) + '\n📧 design@chameleon.design';
        alert(msg);
        e.target.value = '';
        return;
    }

    const loading = document.getElementById("loading");
    if(loading) { loading.style.display = "flex"; loading.querySelector('p').innerText = window.t('msg_uploading_file') || "Uploading file..."; }
    
    try {
        let originalUrl = await uploadFileToSupabase(file, 'customer_uploads');
        let thumbUrl = 'https://cdn-icons-png.flaticon.com/512/337/337946.png'; 
        
        let thumbBlob = null;
        if (file.type === 'application/pdf') thumbBlob = await createPdfThumbnailBlob(file);
        else if (file.type.startsWith('image/')) thumbBlob = await resizeImageToBlob(file);

        if (thumbBlob) {
            const uploadedThumbUrl = await uploadFileToSupabase(thumbBlob, 'thumbs');
            if (uploadedThumbUrl) thumbUrl = uploadedThumbUrl;
        }

        // ★ [수정] 상품 정보를 복사본으로 저장 (참조 공유 방지)
        const pInfo = currentTargetProduct.info || {};
        const cleanProduct = {
            name: pInfo.name || currentTargetProduct.key,
            name_jp: pInfo.name_jp || '', name_us: pInfo.name_us || '',
            price: pInfo.price || 0,
            price_jp: pInfo.price_jp || 0, price_us: pInfo.price_us || 0,
            code: pInfo.code || currentTargetProduct.key,
            img: (pInfo.img || pInfo.img_url || ''),
            w: pInfo.w || pInfo.width_mm || 0, h: pInfo.h || pInfo.height_mm || 0,
            w_mm: pInfo.w_mm || pInfo.width_mm || 0, h_mm: pInfo.h_mm || pInfo.height_mm || 0,
            category: pInfo.category || '',
            addons: pInfo.addons || [],
            partner_id: pInfo.partner_id || null
        };

        // ★ [수정] pendingSelectedAddons에서 선택된 옵션 즉시 적용 (renderCart 의존 제거)
        const selectedAddons = {};
        const addonQuantities = {};
        if (window.pendingSelectedAddons && window.pendingSelectedAddons.length > 0) {
            const _sq = window.pendingSelectedAddonQtys || {};
            window.pendingSelectedAddons.forEach(code => {
                selectedAddons[`opt_${code}`] = code;
                addonQuantities[code] = _sq[code] || 1;
            });
        }

        cartData.push({
            uid: Date.now(),
            product: cleanProduct,
            type: 'file_upload',
            fileName: file.name,
            mimeType: file.type,
            fileData: null,
            originalUrl: originalUrl,
            thumb: thumbUrl,
            isOpen: true,
            qty: 1,
            selectedAddons: selectedAddons,
            addonQuantities: addonQuantities
        });

        // ★ pendingSelectedAddons 초기화
        window.pendingSelectedAddons = null;
        window.pendingSelectedAddonQtys = null;

        saveCart();
        document.getElementById("productDetailModal").style.display = "none";
        renderCart();
        showToast(window.t('msg_file_added_to_cart') || "File order added to cart.", "success");
        // Google Ads 전환 추적
        if (window.gtagTrackAddToCart) window.gtagTrackAddToCart();
    } catch(err) { 
        console.error(err); 
        showToast((window.t('msg_failed') || "Failed: ") + err.message, "error");
    } finally {
        if(loading) { loading.style.display = "none"; } 
        e.target.value = ''; 
    }
}

// ============================================================
// [5] 장바구니 렌더링
// ============================================================
function renderCart() {
    const listArea = document.getElementById("cartListArea");
    if(!listArea) return;

    // ★ renderCart 진입 시 localStorage와 cartData 동기화 (모듈 버전 불일치 방어)
    try {
        const stored = JSON.parse(localStorage.getItem('chameleon_cart_current') || '[]');
        if (Array.isArray(stored) && stored.length > 0 && cartData.length === 0) {
            stored.forEach(item => cartData.push(item));
        }
    } catch(e) {}

    listArea.innerHTML = "";

    let grandTotal = 0; let grandProductTotal = 0; let grandAddonTotal = 0;

    if(cartData.length === 0) {
        listArea.innerHTML = `<div style="text-align:center; padding:60px 0; color:#94a3b8;">${window.t('msg_cart_empty')}</div>`;
        updateSummary(0, 0, 0); return;
    }

    // 기존 장바구니 데이터 보강: name_jp/name_us 없으면 PRODUCT_DB에서 채움
    cartData.forEach(item => {
        if (item.product && item.product.code) {
            const needsJp = !item.product.name_jp;
            const needsUs = !item.product.name_us;
            if (needsJp || needsUs) {
                const dbProd = (window.PRODUCT_DB && window.PRODUCT_DB[item.product.code]) || PRODUCT_DB[item.product.code];
                if (dbProd) {
                    if (needsJp && dbProd.name_jp) item.product.name_jp = dbProd.name_jp;
                    if (needsUs && dbProd.name_us) item.product.name_us = dbProd.name_us;
                }
            }
        }
    });

    cartData.forEach((item, idx) => {
        if (!item.product) return;

        if (!item.qty) item.qty = 1;
        if (item.isOpen === undefined) item.isOpen = true;
        if (!item.selectedAddons) item.selectedAddons = {};

        // pendingSelectedAddons는 addCanvasToCart/addFileToCart/addProductToCartDirectly에서 이미 적용 후 초기화됨
        
        let baseProductTotal = (item.product.price || 0) * item.qty;

        // 수량 할인 적용 (커스텀사이즈, 허니콤보드, 보드류 도매, 천원단위 주문, 가벽 제외)
        // ★ 커스텀사이즈 상품은 상세페이지에서 이미 할인 적용된 가격으로 담기므로 제외
        const _pCode = item.product.code || '';
        const _pCat = item.product.category || '';
        const _pTopCat = window._getTopCategoryCode ? window._getTopCategoryCode(_pCat) : '';
        const _noDiscount = _pCode === '21355677' || _pCode === '21355677_copy'
            || _pTopCat === 'Wholesale Board Prices'
            || _pTopCat === 'honeycomb_board'
            || _pCat === 'hb_display_wall' || _pCode.startsWith('hb_dw')
            || item.product._calculated_price;
        let _qtyDiscountRate = 0;
        if (!_noDiscount && item.qty >= 3) {
            if (item.qty >= 501) _qtyDiscountRate = 0.50;
            else if (item.qty >= 101) _qtyDiscountRate = 0.40;
            else if (item.qty >= 10) _qtyDiscountRate = 0.30;
            else _qtyDiscountRate = 0.20;
        }
        const _qtyDiscountAmt = Math.floor(baseProductTotal * _qtyDiscountRate / 100) * 100;
        baseProductTotal -= _qtyDiscountAmt;

        let optionTotal = 0;

        Object.values(item.selectedAddons).forEach(code => {
            const addon = ADDON_DB[code];
            if (addon) {
                const isSwatchAddon = addon.category_code === 'opt_8796' || addon.is_swatch;
                let aq = isSwatchAddon ? item.qty : ((item.addonQuantities && item.addonQuantities[code]) || 1);
                optionTotal += addon.price * aq;
            }
        });

        const totalItemPrice = baseProductTotal + optionTotal;
        grandProductTotal += baseProductTotal; 
        grandAddonTotal += optionTotal; 
        grandTotal += totalItemPrice;
        
       const div = document.createElement("div"); 
        
        // [수정됨] 썸네일 우선순위 및 유효성 검사 강화
        let displayImg = null;
// 1. 에디터 작업물 또는 파일업로드인 경우 (업로드된 썸네일 URL이 있는 경우만)
if ((item.type === 'design' || item.type === 'file_upload') && item.thumb && (item.thumb.startsWith('http') || item.thumb.startsWith('data:'))) {
    displayImg = item.thumb;
}
// 2. 일반 제품이거나 썸네일이 없는 경우, 제품 DB의 이미지 URL을 직접 참조
else if (item.product && item.product.img && (item.product.img.startsWith('http') || item.product.img.startsWith('data:') || item.product.img.startsWith('/'))) {
    displayImg = item.product.img;
}
        
        // 2. 썸네일이 없으면 제품 원본 이미지 사용
        if (!displayImg && item.product && item.product.img) {
            displayImg = item.product.img;
        }
        
        // 3. 그래도 없으면 기본 이미지
        if (!displayImg) {
            displayImg = 'https://placehold.co/100?text=No+Image';
        }

        div.className = "cart-item";
        const isMobile = window.innerWidth <= 768;
        
        div.style.cssText = `
            background:#fff; border-radius:12px; margin-bottom:15px; border:1px solid #e2e8f0; 
            overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.02); display:flex; 
            flex-direction: ${isMobile ? 'column' : 'row'};
        `;

        // 에디터(type=design)는 px 단위, 직접추가(product_only/file_upload)는 mm 단위
        const _mmToPxR = 3.7795;
        const displayMmW = (item.width && item.type === 'design') ? Math.round(item.width / _mmToPxR) : (item.width || 0);
        const displayMmH = (item.height && item.type === 'design') ? Math.round(item.height / _mmToPxR) : (item.height || 0);

        let addonHtml = '';
        // ★ 견적서 아이템: selectedAddons에 있는 옵션을 직접 표시
        if (item.product._quote_item && item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
            addonHtml += '<div style="margin-bottom:8px;"><div style="font-size:11px; font-weight:800; color:#6366f1; margin-bottom:5px;"># 추가 옵션</div>';
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code];
                const aQty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                const addName = add ? (add.display_name || add.name) : code;
                const addPrice = add ? add.price : 0;
                addonHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; font-size:12px;">
                    <span style="color:#334155;">✅ ${addName} × ${aQty}</span>
                    <span style="font-weight:700; color:#1e293b;">${formatCurrency(addPrice * aQty)}</span>
                </div>`;
            });
            addonHtml += '</div>';
        }
        if (item.product.addons) {
            const addonCodes = Array.isArray(item.product.addons) ? item.product.addons : (item.product.addons.split(',') || []);
            const allAddons = addonCodes.map(c => ({ code: c.trim(), ...ADDON_DB[c.trim()] })).filter(a => a.name)
                .sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
            // debug log removed
            const categories = [...new Set(allAddons.map(a => a.category_code || '_default'))]
                .sort((a, b) => ((ADDON_CAT_DB[a]||{}).sort_order||999) - ((ADDON_CAT_DB[b]||{}).sort_order||999));

            if(categories.length > 0 && allAddons.length > 0) {
                // ★ 2개 이상의 카테고리는 좌우 2단 그리드로 표시
                const _visibleCats = categories.filter(cat => {
                    const catInfo = ADDON_CAT_DB[cat];
                    const isSwatch = cat === 'opt_8796' || (catInfo && catInfo.is_swatch);
                    return !isSwatch;
                });
                if (_visibleCats.length >= 2) {
                    addonHtml += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">';
                }
                categories.forEach(cat => {
                    const catAddons = allAddons.filter(a => (a.category_code || '_default') === cat);
                    const catInfo = ADDON_CAT_DB[cat];
                    const catDisplayName = catInfo ? catInfo.display_name : (cat === '_default' ? window.t('label_options', 'Options') : cat);
                    const isSwatchCat = cat === 'opt_8796' || (catInfo && catInfo.is_swatch) || catAddons.some(a => a.is_swatch);

                    // 스와치 모드: 장바구니에서는 숨김 (제품 모달에서만 선택)
                    if (isSwatchCat) return;

                    addonHtml += `
                        <div style="margin-bottom:12px; min-width:0;">
                            <div style="font-size:11px; font-weight:800; color:#6366f1; margin-bottom:5px; opacity:0.8;"># ${catDisplayName}</div>`;

                    {
                        // 일반 옵션: 리스트형
                        addonHtml += `<div style="display:flex; flex-direction:column; gap:6px;">
                                ${catAddons.map(opt => {
                                    const _vals = Object.values(item.selectedAddons);
                                    const isSelected = _vals.includes(opt.code);
                                    // debug log removed
                                    const currentAddonQty = (item.addonQuantities && item.addonQuantities[opt.code]) || 1;
                                    return `
                                        <div style="display:flex; flex-direction:column; padding:8px; border-radius:10px; border:1px solid ${isSelected ? '#6366f1' : '#f1f5f9'}; background:${isSelected ? '#f5f3ff' : '#fff'}; transition:0.2s; margin-bottom:6px;">
                                            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;">
                                                    <input type="checkbox" onchange="window.toggleCartAddon(${idx}, '${opt.code}', this.checked)" ${isSelected ? 'checked' : ''} style="width:16px; height:16px; accent-color:#6366f1;">
                                                    <div style="display:flex; flex-direction:column;">
                                                        <span style="font-size:11px; font-weight:bold; color:${isSelected ? '#6366f1' : '#475569'};">${opt.display_name || opt.name}</span>
                                                        <span style="font-size:10px; color:#94a3b8;">+${formatCurrency(opt.price)}</span>
                                                    </div>
                                                </label>

                                                ${isSelected ? `
                                                <div style="display:flex; align-items:center; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden; background:#fff; height:26px;">
                                                    <button onclick="window.updateCartAddonQty(${idx}, '${opt.code}', ${currentAddonQty - 1})"
                                                            style="border:none; background:#f8fafc; width:22px; height:100%; cursor:pointer; font-weight:bold; font-size:13px;">-</button>
                                                    <input type="number"
                                                           value="${currentAddonQty}"
                                                           onchange="window.updateCartAddonQty(${idx}, '${opt.code}', this.value)"
                                                           style="width:50px; height:100%; text-align:center; border:none; border-left:1px solid #eee; border-right:1px solid #eee; font-size:11px; font-weight:bold; outline:none; -webkit-appearance:none; margin:0;">
                                                    <button onclick="window.updateCartAddonQty(${idx}, '${opt.code}', ${currentAddonQty + 1})"
                                                            style="border:none; background:#f8fafc; width:22px; height:100%; cursor:pointer; font-weight:bold; font-size:13px;">+</button>
                                                </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>`;
                    }
                    addonHtml += `</div>`;
                });
                if (_visibleCats.length >= 2) {
                    addonHtml += '</div>';
                }
            }
        }

        if (!isMobile) {
            div.innerHTML = `
                <div style="display:flex; width:100%; padding:20px; gap:30px; align-items:flex-start;">
                    <div style="width:100px; height:100px; background:#f8fafc; border:1px solid #eee; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                        <img src="${displayImg}" loading="lazy" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='https://placehold.co/100?text=No+Image'">
                    </div>

                    <div style="flex:1; min-width:200px;">
                        <h4 style="margin:0; font-size:18px; color:#1e293b; font-weight:900; line-height:1.4;">${localName(item.product)}</h4>
                        ${(displayMmW && displayMmH) ? `<div style="font-size:12px; color:#6366f1; margin-top:4px; font-weight:bold;">📐 ${window._isUSsite && window._isUSsite() ? (displayMmW/25.4).toFixed(2)+'x'+(displayMmH/25.4).toFixed(2)+' in' : displayMmW+'x'+displayMmH+'mm'}</div>` : ''}
                        <div style="font-size:13px; color:#64748b; margin-top:5px;">${item.type === 'file_upload' ? item.fileName : (item.fileName || window.t('msg_file_attached_separately', '(File attached separately)'))}</div>
                        <div style="font-size:12px; color:#94a3b8; margin-top:5px;">${window.t('label_unit_price', 'Unit Price')}: ${formatCurrency(item.product.price)}</div>
                        ${item.type === 'design' && item.jsonUrl ? `<button onclick="event.stopPropagation(); window.reEditCartItem(${idx})" style="margin-top:8px; border:1px solid #6366f1; background:#f5f3ff; color:#6366f1; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700;"><i class="fa-solid fa-pen-to-square"></i> ${window.t('btn_re_edit', '다시 편집하기')}</button>` : ''}
                        <div style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                            ${item.originalUrl
                                ? `<label style="cursor:pointer; font-size:12px; color:#fff; background:#f97316; padding:6px 14px; border-radius:8px; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-rotate"></i> 파일 재첨부<input type="file" style="display:none;" onchange="window._uploadCartItemFile(${idx}, this)"></label>`
                                : `<label style="cursor:pointer; font-size:12px; color:#fff; background:#dc2626; padding:6px 14px; border-radius:8px; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-paperclip"></i> 파일 첨부<input type="file" style="display:none;" onchange="window._uploadCartItemFile(${idx}, this)"></label>`}
                        </div>
                        <div style="display:flex; align-items:center; gap:12px; margin-top:15px;">
                            <div class="qty-wrapper" style="display:flex; border:1px solid #e2e8f0; border-radius:6px; background:#fff; overflow:hidden;">
                                <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, -1)" style="border:none; background:none; padding:4px 10px; cursor:pointer;">-</button>
                                <input type="number" value="${item.qty}" onchange="window.updateCartQtyInput(${idx}, this.value)" style="width:160px; text-align:center; border:none; font-weight:bold; font-size:14px;">
                                <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, 1)" style="border:none; background:none; padding:4px 10px; cursor:pointer;">+</button>
                            </div>
                            <span style="font-size:12px; color:#64748b; font-weight:bold;">${window.t('label_product_qty', 'Product Qty')}</span>
                        </div>
                    </div>

                    ${addonHtml ? `
                    <div style="width:320px; max-height:220px; overflow-y:auto; background:#f8fafc; border:1px solid #f1f5f9; border-radius:12px; padding:15px; flex-shrink:0;">
                        <div style="font-size:12px; font-weight:800; color:#334155; margin-bottom:10px;"><i class="fa-solid fa-circle-plus"></i> ${window.t('label_addon_products', 'Add-on Products')}</div>
                        ${addonHtml}
                    </div>` : ''}

                    <div style="width:160px; margin-left:auto; text-align:right; display:flex; flex-direction:column; justify-content:space-between; align-self:stretch; flex-shrink:0;">
                        <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#cbd5e1; cursor:pointer; align-self:flex-end; font-size:18px;"><i class="fa-solid fa-trash-can"></i></button>
                        <div>
                            <div style="font-size:11px; color:#6366f1; font-weight:bold; margin-bottom:3px;">${window.t('label_total_with_options', 'Total (incl. options)')}</div>
                            <div style="font-size:22px; font-weight:900; color:#1e1b4b;">${formatCurrency(totalItemPrice)}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            div.innerHTML = `
                <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:14px; border-bottom:1px solid #f1f5f9; padding-bottom:15px; align-items:flex-start;">
                        <img src="${displayImg}" loading="lazy" style="width:120px; height:120px; object-fit:contain; border:1px solid #eee; border-radius:10px; background:#fff; flex-shrink:0;" onerror="this.src='https://placehold.co/100?text=No+Image'">
                        <div style="flex:1; min-width:0;">
                            <h4 style="margin:0; font-size:15px; color:#1e293b; font-weight:800; line-height:1.3;">${localName(item.product)}</h4>
                            <div style="display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;">
                                ${(displayMmW && displayMmH) ? `<span style="font-size:11px; color:#6366f1; font-weight:bold;">📐 ${window._isUSsite && window._isUSsite() ? (displayMmW/25.4).toFixed(2)+'x'+(displayMmH/25.4).toFixed(2)+' in' : displayMmW+'x'+displayMmH+'mm'}</span>` : ''}
                                <span style="font-size:14px; font-weight:900; color:#1e1b4b;">${formatCurrency(totalItemPrice)}</span>
                            </div>
                            <div style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                                ${item.type === 'design' && item.jsonUrl ? `<button onclick="event.stopPropagation(); window.reEditCartItem(${idx})" style="border:1px solid #6366f1; background:#f5f3ff; color:#6366f1; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700;"><i class="fa-solid fa-pen-to-square"></i> ${window.t('btn_re_edit', '다시 편집')}</button>` : ''}
                                ${item.originalUrl
                                    ? `<label style="cursor:pointer; font-size:11px; color:#fff; background:#f97316; padding:5px 10px; border-radius:6px; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><i class="fa-solid fa-rotate"></i> 파일 재첨부<input type="file" style="display:none;" onchange="window._uploadCartItemFile(${idx}, this)"></label>`
                                    : `<label style="cursor:pointer; font-size:11px; color:#fff; background:#dc2626; padding:5px 10px; border-radius:6px; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><i class="fa-solid fa-paperclip"></i> 파일 첨부<input type="file" style="display:none;" onchange="window._uploadCartItemFile(${idx}, this)"></label>`}
                                <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444; font-size:18px; padding:5px 8px; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                            </div>
                        </div>
                    </div>
                    
                    ${addonHtml ? `
                    <div style="background:#f1f5f9; border-radius:12px; padding:12px;">
                        <div style="font-size:12px; font-weight:800; color:#475569; margin-bottom:10px; display:flex; align-items:center; gap:5px;">
                            <i class="fa-solid fa-circle-plus" style="color:#6366f1;"></i> ${window.t('label_manage_options', 'Manage Options')}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${addonHtml}
                        </div>
                    </div>` : ''}

                    <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0;">
                        <span style="font-size:13px; font-weight:bold; color:#475569;">${window.t('label_order_qty', 'Order Qty')}</span>
                        <div class="qty-wrapper" style="display:flex; border:1px solid #cbd5e1; border-radius:8px; background:#fff; overflow:hidden;">
                            <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, -1)" style="border:none; background:none; padding:10px 20px; font-weight:bold; font-size:18px;">-</button>
                            <input type="number" value="${item.qty}" onchange="window.updateCartQtyInput(${idx}, this.value)" style="width:60px; text-align:center; border:none; font-weight:bold; font-size:16px;">
                            <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, 1)" style="border:none; background:none; padding:10px 20px; font-weight:bold; font-size:18px;">+</button>
                        </div>
                    </div>
                </div>
            `;
        }

        listArea.appendChild(div);
    });
    
    updateSummary(grandProductTotal, grandAddonTotal, grandTotal);
}

function updateSummary(prodTotal, addonTotal, total) {
    const elItem = document.getElementById("summaryItemPrice"); if(elItem) elItem.innerText = formatCurrency(prodTotal);
    const elAddon = document.getElementById("summaryAddonPrice"); if(elAddon) elAddon.innerText = formatCurrency(addonTotal);

    const excludedSet = window.excludedCategoryCodes || new Set();

    let discountableAmount = 0;
    let hasExcludedItem = false;

    cartData.forEach(item => {
        const prodCat = item.product ? item.product.category : '';

        if (excludedSet.has(prodCat)) {
            hasExcludedItem = true;
        } else {
            const unitPrice = item.product.price || 0;
            const qty = item.qty || 1;
            let baseTotal = unitPrice * qty;

            // ★ 수량 할인 적용 (renderCartUI와 동일 로직)
            const _pCode3 = item.product.code || '';
            const _pCat3 = item.product.category || '';
            const _pTopCat3 = window._getTopCategoryCode ? window._getTopCategoryCode(_pCat3) : '';
            const _noDisc3 = _pCode3 === '21355677' || _pCode3 === '21355677_copy'
                || _pTopCat3 === 'Wholesale Board Prices'
                || _pTopCat3 === 'honeycomb_board'
                || _pCat3 === 'hb_display_wall' || _pCode3.startsWith('hb_dw')
                || item.product._calculated_price;
            if (!_noDisc3 && qty >= 3) {
                let _qdr = 0;
                if (qty >= 501) _qdr = 0.50;
                else if (qty >= 101) _qdr = 0.40;
                else if (qty >= 10) _qdr = 0.30;
                else _qdr = 0.20;
                baseTotal -= Math.floor(baseTotal * _qdr / 100) * 100;
            }

            let itemTotal = baseTotal;

            if (item.selectedAddons) {
                Object.values(item.selectedAddons).forEach(code => {
                    const db = typeof ADDON_DB !== 'undefined' ? ADDON_DB : (window.ADDON_DB || {});
                    const addon = db[code];
                    if (addon) {
                        const _sw = addon.category_code === 'opt_8796' || addon.is_swatch;
                        let _aq = _sw ? qty : (item.addonQuantities[code] || 1);
                        itemTotal += addon.price * _aq;
                    }
                });
            }
            discountableAmount += itemTotal;
        }
    });

    const gradeDiscount = Math.floor(discountableAmount * currentUserDiscountRate);
    const discountAmount = gradeDiscount;
    const finalTotal = total - discountAmount;

    // finalPaymentAmount는 배송비 반영 후 아래에서 설정

    if (typeof currentUser !== 'undefined' && currentUser) {
        const elOwn = document.getElementById('cartOwnMileage');
        const myMileage = elOwn ? parseInt(elOwn.innerText.replace(/[^0-9]/g, '')) || 0 : 0;

        let realLimit = 0;
        if (discountableAmount > 0) {
            const fivePercent = Math.floor(discountableAmount * 0.05);
            realLimit = Math.min(myMileage, fivePercent);
        }

        window.mileageLimitMax = realLimit; // KRW 기준 저장

        // 표시용 환산
        const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
        const limitLocal = realLimit * mileRate;

        const limitDisp = document.getElementById('cartMileageLimit');
        if(limitDisp) limitDisp.innerText = formatCurrency(realLimit).replace(/[원¥$]/g, '').trim() + ' P';

        const mileInput = document.getElementById('cartUseMileage');
        if(mileInput) {
            mileInput.placeholder = `${window.t('label_max', 'Max')} ${formatCurrency(realLimit).replace(/[원¥$]/g, '').trim()}`;
            if (realLimit === 0 && hasExcludedItem) {
                mileInput.value = "";
                mileInput.placeholder = window.t('msg_mileage_unavailable', "Unavailable (excluded products)");
                mileInput.disabled = true;
            } else {
                mileInput.disabled = false;
                const inputLocalVal = parseFloat(mileInput.value || 0);
                if(inputLocalVal > limitLocal) {
                    mileInput.value = limitLocal > 0 ? limitLocal : "";
                }
            }
        }
    }

    const elDiscount = document.getElementById("summaryDiscount");
    if(elDiscount) {
        if(gradeDiscount > 0) elDiscount.innerText = `-${formatCurrency(gradeDiscount)} (${(currentUserDiscountRate*100).toFixed(0)}%)`;
        else elDiscount.innerText = formatCurrency(0) + " (0%)";
    }
    // ★ 견적서 배송/시공비 + 주문 정보 표시
    let quoteShipping = 0;
    const shRow = document.getElementById('cartShippingFeeRow');
    if (shRow) shRow.style.display = 'none'; // 기본 숨김
    try {
        const shData = JSON.parse(localStorage.getItem('chameleon_quote_shipping') || '{}');
        if (shData.ts && (Date.now() - shData.ts < 86400000)) { // 24시간 유효
            // 배송비: fee > 0일 때만 표시
            if (shData.fee > 0) {
                quoteShipping = shData.fee;
                const shLabel = document.getElementById('cartShippingLabel');
                const shAmt = document.getElementById('cartShippingAmount');
                if (shRow) shRow.style.display = 'flex';
                if (shLabel) shLabel.textContent = '🚚 ' + (shData.label || '배송비');
                if (shAmt) shAmt.textContent = '+' + formatCurrency(quoteShipping);
            }
            // 주문 정보 섹션
            const infoSection = document.getElementById('cartQuoteInfoSection');
            const infoContent = document.getElementById('cartQuoteInfoContent');
            if (infoSection && infoContent && (shData.delivery_note || shData.shipping_region)) {
                let infoHtml = '';
                if (shData.shipping_region === 'seoul_gyeonggi') infoHtml += '<div>📍 <b>지역:</b> 서울/경기 (무료배송+설치)</div>';
                else if (shData.shipping_region === 'province') infoHtml += '<div>📍 <b>지역:</b> 지방 (' + (shData.wants_install ? '배송+시공' : '배송만') + ')</div>';
                if (shData.delivery_note) infoHtml += '<div>📋 <b>메모:</b> ' + shData.delivery_note.replace(/\//g, ' / ') + '</div>';
                if (infoHtml) {
                    infoContent.innerHTML = infoHtml;
                    infoSection.style.display = 'block';
                }
            }
            // ★ 챗봇에서 수집한 정보를 배송 폼에 자동 채우기
            if (shData.delivery_note) {
                const note = shData.delivery_note;
                const noteEl = document.getElementById('cartRequestNote');
                if (noteEl && !noteEl.value) noteEl.value = note;
            }
        }
    } catch(e) {}

    // ★ 배송일 최소값 설정 (오늘 + 3영업일)
    const dateInput = document.getElementById('cartDeliveryDate');
    if (dateInput && !dateInput.min) {
        const d = new Date();
        let biz = 0;
        while (biz < 3) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) biz++; }
        dateInput.min = d.toISOString().split('T')[0];
        if (!dateInput.value) dateInput.value = d.toISOString().split('T')[0];
    }
    // ★ 챗봇 견적서 PDF 링크 표시
    const _quotePdfUrl = localStorage.getItem('chameleon_quote_pdf_url');
    const _quotePdfLink = document.getElementById('cartQuotePdfLink');
    const _quotePdfBtn = document.getElementById('cartQuotePdfBtn');
    if (_quotePdfLink && _quotePdfBtn && _quotePdfUrl) {
        _quotePdfBtn.href = _quotePdfUrl;
        _quotePdfLink.style.display = 'block';
    }

    const displayTotal = finalTotal + quoteShipping;
    window.finalPaymentAmount = displayTotal;
    finalPaymentAmount = displayTotal;

    // ★ 배송비 추가/삭제 행 표시
    const shAddRow = document.getElementById('cartShippingAddRow');
    if (shAddRow) shAddRow.style.display = (quoteShipping > 0 || cartData.length === 0) ? 'none' : 'block';

    const elTotal = document.getElementById("summaryTotal"); if(elTotal) elTotal.innerText = formatCurrency(displayTotal);
    const cartCount = document.getElementById("cartCount"); if(cartCount) cartCount.innerText = `(${cartData.length})`;
    const btnCart = document.getElementById("btnViewCart"); if (btnCart) btnCart.style.display = (cartData.length > 0 || (typeof currentUser !== 'undefined' && currentUser)) ? "inline-flex" : "none";

    // ★ 장바구니 매니저 드롭다운에 DB 매니저 추가 (1회만)
    const _cartMgrSel = document.getElementById('cartStaffManager');
    if (_cartMgrSel && !_cartMgrSel.dataset.loaded && sb) {
        _cartMgrSel.dataset.loaded = '1';
        sb.from('admin_staff').select('id,name').eq('role','manager').then(({ data }) => {
            if (data) data.forEach(m => {
                const opt = document.createElement('option');
                opt.value = String(m.id);
                opt.textContent = m.name;
                _cartMgrSel.appendChild(opt);
            });
        });
    }

    // 장바구니 마일리지 섹션: 로그인 시만 표시
    const _cartMileSec = document.getElementById('cartMileageSection');
    const _isLoggedIn = typeof currentUser !== 'undefined' && currentUser;
    if (_cartMileSec) _cartMileSec.style.display = _isLoggedIn ? 'block' : 'none';

    // 장바구니 마일리지 한도 업데이트
    if (_isLoggedIn) {
        if (window._cartMileageLoaded && window.updateCartMileageLimit) window.updateCartMileageLimit();
        else if (window.loadCartMileage) window.loadCartMileage();
    }
}

// ============================================================
// [추천인] 이메일 검증
// ============================================================
window.validateReferrer = async function() {
    const emailInput = document.getElementById('inputReferrerEmail');
    const status = document.getElementById('referrerStatus');
    const notice = document.getElementById('referralNotice');
    const email = (emailInput ? emailInput.value.trim() : '');

    if (!email) {
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
        if (status) status.innerHTML = '';
        if (notice) notice.style.display = 'none';
        return;
    }

    // 자기 자신 차단
    if (currentUser && currentUser.email === email) {
        if (status) { status.innerHTML = '❌ ' + window.t('referral_self_error', '자기 자신은 추천인으로 등록할 수 없습니다.'); status.style.color = '#dc2626'; }
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
        if (notice) notice.style.display = 'none';
        return;
    }

    if (status) { status.innerHTML = '⏳ ...'; status.style.color = '#666'; }

    const { data } = await sb.from('profiles').select('id, email').eq('email', email).maybeSingle();
    if (data) {
        if (status) { status.innerHTML = '✅ ' + window.t('referral_verified', '추천인이 확인되었습니다!'); status.style.color = '#16a34a'; }
        window.verifiedReferrerId = data.id;
        window.verifiedReferrerEmail = email;
        if (notice) notice.style.display = 'block';
        // 장바구니 추천인 필드 동기화
        const cartRef = document.getElementById('cartReferrerEmail');
        const cartStatus = document.getElementById('cartReferrerStatus');
        if (cartRef) cartRef.value = email;
        if (cartStatus) { cartStatus.innerHTML = '✅ ' + window.t('referral_verified', '추천인이 확인되었습니다!') + ' (-5%)'; cartStatus.style.color = '#16a34a'; }
    } else {
        if (status) { status.innerHTML = '❌ ' + window.t('referral_not_found', '존재하지 않는 이메일입니다.'); status.style.color = '#dc2626'; }
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
        if (notice) notice.style.display = 'none';
    }
    renderCart();
};

// ============================================================
// [추천인] 적립 함수 (결제 완료 후 호출)
// ============================================================
async function creditReferralBonus(orderId, referrerId) {
    if (!referrerId) return;
    try {
        // 중복 적립 방지
        const { data: existing } = await sb.from('wallet_logs')
            .select('id').eq('user_id', referrerId)
            .eq('type', 'referral_bonus').ilike('description', `%##${orderId}##%`).maybeSingle();
        if (existing) return;

        // 주문 금액 + 주문자명 조회
        const { data: order } = await sb.from('orders')
            .select('total_amount, manager_name').eq('id', orderId).maybeSingle();
        if (!order || !order.total_amount) return;

        const bonusAmount = Math.floor(order.total_amount * 0.05);
        if (bonusAmount <= 0) return;

        const buyerName = order.manager_name || '고객';

        // 예치금 적립
        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', referrerId).single();
        const newDeposit = (parseInt(pf?.deposit || 0)) + bonusAmount;
        await sb.from('profiles').update({ deposit: newDeposit }).eq('id', referrerId);
        await sb.from('wallet_logs').insert({
            user_id: referrerId, type: 'referral_bonus',
            amount: bonusAmount, description: `##REFERRAL##${buyerName}##${orderId}##`
        });
    } catch (e) {
        console.error('[추천인] 적립 오류:', e);
    }
}

// ============================================================
// [수정] 주문 정보 제출
// ============================================================
async function processOrderSubmission() {
    const manager = document.getElementById("inputManagerName").value;
    const phone = document.getElementById("inputManagerPhone").value;
    const request = document.getElementById("inputRequest").value;
    
    let address = "";
    if (CURRENT_LANG === 'kr') {
        address = document.getElementById("inputAddressKR").value;
    } else {
        const zip = document.getElementById("inputZipCode").value;
        const state = document.getElementById("inputState").value;
        const city = document.getElementById("inputCity").value;
        const st1 = document.getElementById("inputStreet1").value;
        const st2 = document.getElementById("inputStreet2").value;
        address = `${st1} ${st2}, ${city}, ${state} ${zip}`;
    }

    if(!manager || !address) { showToast(window.t('alert_input_shipping'), "warn"); return; }
    
    const deliveryDate = selectedDeliveryDate || new Date().toISOString().split('T')[0];

    // ★ 고객이 선택한 담당 매니저 (필수)
    const staffMgrEl = document.getElementById('inputStaffManager');
    const rawStaffMgrId = staffMgrEl ? staffMgrEl.value : '';
    if (!rawStaffMgrId) {
        const lang = CURRENT_LANG || 'kr';
        const msgs = {
            kr: '담당 매니저를 선택해주세요.',
            ja: '担当マネージャーを選択してください。',
            en: 'Please select a manager.',
            zh: '请选择负责经理。',
            es: 'Por favor seleccione un gerente.',
            de: 'Bitte wählen Sie einen Manager.',
            fr: 'Veuillez sélectionner un responsable.',
            ar: 'يرجى اختيار المدير المسؤول.'
        };
        showToast(msgs[lang] || msgs['en'], 'warn');
        // 버튼 영역 강조
        const wrap = document.getElementById('staffManagerSelectWrap');
        if (wrap) { wrap.style.outline = '2px solid #ef4444'; wrap.style.borderRadius = '12px'; setTimeout(() => { wrap.style.outline = ''; }, 2000); }
        return;
    }
    // '__hq__'는 본사 직접 처리 → staff_manager_id는 null, admin_note에 기록
    const isHqSelected = rawStaffMgrId === '__hq__';
    let selectedStaffManagerId = (rawStaffMgrId && !isHqSelected) ? rawStaffMgrId : null;
    // ★ 장바구니 매니저 버튼이 문자열 이름(eunmi, sunghee 등)인 경우 DB ID로 변환
    if (selectedStaffManagerId && isNaN(Number(selectedStaffManagerId))) {
        const _nameMap = { eunmi:'은미', sunghee:'성희', jisook:'지숙' };
        const _lookupName = _nameMap[selectedStaffManagerId.toLowerCase()] || selectedStaffManagerId;
        try {
            const { data: _mgrRow } = await sb.from('admin_staff').select('id').eq('role','manager').ilike('name', '%' + _lookupName + '%').single();
            selectedStaffManagerId = _mgrRow ? String(_mgrRow.id) : null;
        } catch(e) { selectedStaffManagerId = null; }
    }

    window.tempOrderInfo = {
        manager,
        phone,
        address,
        request,
        deliveryDate,
        installationTime: selectedInstallationTime || null,
        referrerId: window.verifiedReferrerId || null,
        referrerEmail: window.verifiedReferrerEmail || null,
        staffManagerId: selectedStaffManagerId,
        isHqOrder: isHqSelected
    };

    let rawTotal = 0;
    cartData.forEach(item => {
        if (!item.product) return;
        const unitPrice = item.product.price || 0;
        const qty = item.qty || 1;

        // 수량 할인
        const _pc2 = item.product.code || '';
        const _cat2 = item.product.category || '';
        const _tc2 = window._getTopCategoryCode ? window._getTopCategoryCode(_cat2) : '';
        const _nd2 = _pc2 === '21355677' || _pc2 === '21355677_copy' || _tc2 === 'Wholesale Board Prices' || _tc2 === 'honeycomb_board' || _cat2 === 'hb_display_wall' || _pc2.startsWith('hb_dw') || item.product._calculated_price;
        let _dr2 = 0;
        if (!_nd2 && qty >= 3) {
            if (qty >= 501) _dr2 = 0.50;
            else if (qty >= 101) _dr2 = 0.40;
            else if (qty >= 10) _dr2 = 0.30;
            else _dr2 = 0.20;
        }
        let optionTotal = 0;
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const addon = ADDON_DB[code];
                const _sw = addon && (addon.category_code === 'opt_8796' || addon.is_swatch);
                const aq = _sw ? qty : ((item.addonQuantities && item.addonQuantities[code]) || 1);
                if(addon) optionTotal += addon.price * aq;
            });
        }
        const _baseAmt = unitPrice * qty;
        const _discAmt = Math.floor(_baseAmt * _dr2 / 100) * 100;
        rawTotal += (_baseAmt - _discAmt) + optionTotal;
    });

    const _cc = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';

    // ★ 최소 주문금액 10,000원 (천원단위 주문상품 21355677 예외)
    const MIN_ORDER_KRW = 10000;
    const isExempt = cartData.some(item => item.product && (String(item.product.code) === '21355677' || String(item.product.product_key) === '21355677' || String(item.product.id) === '21355677'));
    if (!isExempt && rawTotal < MIN_ORDER_KRW) {
        const lang = CURRENT_LANG;
        const minAmounts = { kr: '10,000원', ja: '1,000円', en: '$10', zh: '¥70', ar: '10,000 ₩', es: '$10', de: '10€', fr: '10€' };
        const titles = { kr: '최소 주문금액 안내', ja: '最低注文金額のご案内', en: 'Minimum Order Notice', zh: '最低订购金额提示', ar: 'إشعار الحد الأدنى للطلب', es: 'Aviso de pedido mínimo', de: 'Mindestbestellwert', fr: 'Montant minimum de commande' };
        const line1 = { kr: '카멜레온프린팅은 도매쇼핑몰로', ja: 'カメレオンプリンティングは卸売サイトのため', en: 'Chameleon Printing is a wholesale shop.', zh: '变色龙印刷是批发商城', ar: 'طباعة كاميليون متجر جملة', es: 'Chameleon Printing es una tienda mayorista.', de: 'Chameleon Printing ist ein Großhandelsshop.', fr: 'Chameleon Printing est une boutique en gros.' };
        const line2 = { kr: '최소 주문금액은', ja: '最低注文金額は', en: 'The minimum order amount is', zh: '最低订购金额为', ar: 'الحد الأدنى للطلب', es: 'El pedido mínimo es de', de: 'Der Mindestbestellwert beträgt', fr: 'Le montant minimum est de' };
        const line3 = { kr: '고퀄리티 제품을 가장 저렴한 가격에 공급합니다.', ja: '最高品質の製品を最安値でご提供いたします。', en: 'We provide the highest quality products at the lowest prices.', zh: '我们以最低的价格提供最高品质的产品。', ar: 'نوفر أعلى جودة بأقل الأسعار', es: 'Ofrecemos productos de la más alta calidad al mejor precio.', de: 'Wir bieten höchste Qualität zu den günstigsten Preisen.', fr: 'Nous offrons la plus haute qualité aux meilleurs prix.' };
        const btnText = { kr: '확인', ja: '確認', en: 'OK', zh: '确认', ar: 'موافق', es: 'Aceptar', de: 'OK', fr: 'OK' };
        const L = lang || 'kr';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:30000;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `<div style="background:#fff;border-radius:20px;width:400px;max-width:90%;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,0.3);text-align:center;">
            <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:24px 20px 18px;">
                <div style="font-size:42px;margin-bottom:8px;">🛒</div>
                <div style="color:#fff;font-size:18px;font-weight:800;">${titles[L] || titles['kr']}</div>
            </div>
            <div style="padding:24px 28px 20px;">
                <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.6;">${line1[L] || line1['kr']}</p>
                <div style="background:linear-gradient(135deg,#fef3c7,#fffbeb);border:2px solid #f59e0b;border-radius:12px;padding:14px;margin-bottom:14px;">
                    <span style="font-size:13px;color:#92400e;">${line2[L] || line2['kr']}</span>
                    <div style="font-size:28px;font-weight:900;color:#d97706;margin:4px 0;">${minAmounts[L] || minAmounts['kr']}</div>
                </div>
                <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${line3[L] || line3['kr']}</p>
            </div>
            <div style="padding:0 28px 24px;">
                <button onclick="this.closest('div[style*=fixed]').remove();" style="width:100%;padding:14px;border:none;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;border-radius:12px;font-size:15px;font-weight:bold;cursor:pointer;">${btnText[L] || btnText['kr']}</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        return;
    }

    // 허니콤보드 배송비: 챗봇 견적에서 이미 설정된 값 또는 모달의 라디오 버튼
    const _existingShipFee = window._nonMetroFeeApplied || 0;
    const NON_METRO_FEE_KRW = _cc === 'JP' ? 310000 : 200000;
    const metroRadio = document.querySelector('input[name="metroArea"]:checked');
    const metroSection = document.getElementById('metroAreaSection');
    const isNonMetroModal = metroSection && metroSection.style.display !== 'none' && metroRadio && metroRadio.value === 'non-metro';
    const isNonMetro = isNonMetroModal || _existingShipFee > 0;
    if (isNonMetroModal) {
        rawTotal += NON_METRO_FEE_KRW;
        window._nonMetroFeeApplied = NON_METRO_FEE_KRW;
    } else if (_existingShipFee > 0) {
        // ★ 챗봇 견적서에서 설정된 배송비 사용
        rawTotal += _existingShipFee;
    } else {
        window._nonMetroFeeApplied = 0;
    }

    // ★ 등급 할인은 상품+옵션에만 적용 (배송비 제외)
    const _rawWithoutShip = rawTotal - (_existingShipFee > 0 ? _existingShipFee : (isNonMetroModal ? NON_METRO_FEE_KRW : 0));
    const gradeDisc = Math.floor(_rawWithoutShip * currentUserDiscountRate);
    const refDisc = window.verifiedReferrerId ? Math.floor(_rawWithoutShip * 0.05) : 0;
    const discountAmt = gradeDisc + refDisc;
    let finalTotal = rawTotal - discountAmt;

    // ★ 장바구니 displayTotal이 있으면 그것을 기준으로 (재계산 오차 방지)
    // 챗봇 견적서 아이템이 있으면 장바구니 합계를 신뢰
    const _hasQuoteItems = cartData.some(i => i.product && i.product._quote_item);
    if (_hasQuoteItems && window.finalPaymentAmount > 0) {
        finalTotal = window.finalPaymentAmount;
    }

    window.originalPayAmount = finalTotal;
    window.finalPaymentAmount = finalTotal;

    document.getElementById("deliveryInfoModal").style.display = "none";
    const checkoutModal = document.getElementById("checkoutModal");
    checkoutModal.style.display = "flex";

    // 비수도권 배송비 표시
    const nmFeeCheckout = document.getElementById('nonMetroFeeCheckout');
    const nmFeeAmountEl = document.getElementById('nonMetroFeeAmount');
    if (nmFeeCheckout) {
        const _showFee = isNonMetroModal ? NON_METRO_FEE_KRW : _existingShipFee;
        if (_showFee > 0) {
            nmFeeCheckout.style.display = 'block';
            if (nmFeeAmountEl) nmFeeAmountEl.textContent = formatCurrency(_showFee);
        } else {
            nmFeeCheckout.style.display = 'none';
        }
    }

    document.getElementById("orderName").value = manager;
    document.getElementById("orderPhone").value = phone;
    document.getElementById("orderAddr").value = address;
    document.getElementById("orderMemo").value = request;

    // 추천인 정보 표시
    const refInfoEl = document.getElementById('checkoutReferralInfo');
    const refEmailEl = document.getElementById('checkoutReferrerEmail');
    const refDiscEl = document.getElementById('checkoutReferralDiscount');
    if (refInfoEl) {
        if (window.verifiedReferrerId && window.verifiedReferrerEmail) {
            refInfoEl.style.display = 'block';
            if (refEmailEl) refEmailEl.textContent = window.verifiedReferrerEmail;
            if (refDiscEl) refDiscEl.textContent = `-${formatCurrency(refDisc)} (5%)`;
        } else {
            refInfoEl.style.display = 'none';
        }
    }

    // 장바구니에서 입력한 마일리지 반영 (현지 통화 → KRW 역환산)
    const cartUsedMileageKRW = window.getCartMileageKRW ? window.getCartMileageKRW() : 0;
    const checkoutFinal = finalTotal - cartUsedMileageKRW;

    window.originalPayAmount = checkoutFinal > 0 ? checkoutFinal : 0;
    window.finalPaymentAmount = window.originalPayAmount;

    document.getElementById('finalPayAmountDisplay').innerText = formatCurrency(window.finalPaymentAmount);
    document.getElementById('btnFinalPay').innerText = `${formatCurrency(window.finalPaymentAmount)} ${window.t('btn_pay', 'Pay')}`;

    if(currentUser) {
        const { data: profile } = await sb.from('profiles').select('deposit').eq('id', currentUser.id).maybeSingle();
        const balance = profile ? profile.deposit : 0;
        const elBal = document.getElementById('myCurrentDepositDisplay');
        if(elBal) {
            elBal.innerText = `(${window.t('label_balance', 'Balance')}: ${formatCurrency(balance)})`;
            elBal.dataset.balance = balance;
        }
    }
}

// ============================================================
// [공통] 주문 파일 업로드 (고객파일 + PDF 생성)
// ★ 재진입 경로에서도 호출하여 파일 누락 방지
// ============================================================
async function uploadOrderFiles(orderId, cartData, useMileage) {
    const loading = document.getElementById("loading");
    const { manager, phone, address, request, deliveryDate } = window.tempOrderInfo || {};

    let uploadedFiles = [];

    // [1] 고객 업로드 파일 수집
    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i];
        const idx = String(i + 1).padStart(2, '0');
        if (item.uploadedFiles && item.uploadedFiles.length > 0) {
            item.uploadedFiles.forEach((f, fi) => {
                uploadedFiles.push({
                    name: `customer_file_${idx}_${String(fi+1).padStart(2,'0')}_${f.fileName || 'file'}`,
                    url: f.originalUrl,
                    type: 'customer_file'
                });
                if (f.cutlineUrl) {
                    uploadedFiles.push({
                        name: `cutline_${idx}_${String(fi+1).padStart(2,'0')}_${f.fileName || 'keyring'}.png`,
                        url: f.cutlineUrl,
                        type: 'cutline'
                    });
                }
            });
        } else if (item.originalUrl) {
            uploadedFiles.push({
                name: `customer_file_${idx}_${item.fileName || 'file'}`,
                url: item.originalUrl,
                type: 'customer_file'
            });
        }
        if (item.cutlineUrl) {
            uploadedFiles.push({
                name: `cutline_${idx}_${item.fileName || 'keyring'}.png`,
                url: item.cutlineUrl,
                type: 'cutline'
            });
        }
    }

    // [2] PDF 생성 (작업지시서 + 견적서)
    const orderInfoForPDF = {
        id: orderId,
        manager, phone, address, note: request, date: deliveryDate,
        shippingFee: (window._nonMetroFeeApplied || 0)
    };

    const isMobile = window.innerWidth <= 768;
    const PDF_TIMEOUT = isMobile ? 45000 : 90000;   // ★ 타임아웃 여유 확보 (30→45, 60→90)
    const UPLOAD_TIMEOUT = 30000;                     // ★ 업로드 타임아웃 확보 (20→30)
    const errors = []; // ★ 에러 추적용

    try {
        if (!window.jspdf && window.loadEditorLibraries) await window.loadEditorLibraries();
        if (loading) loading.querySelector('p').innerText = window.t('msg_generating_docs', "Generating documents...");
        const orderSheetBlob = await withTimeout(generateOrderSheetPDF(orderInfoForPDF, cartData), PDF_TIMEOUT);
        if(orderSheetBlob) {
            const url = await withTimeout(uploadFileToSupabase(orderSheetBlob, `orders/${orderId}/order_sheet.pdf`), UPLOAD_TIMEOUT);
            if(url) uploadedFiles.push({ name: ({ja:'作業指示書',en:'order_sheet',kr:'작업지시서'}[CURRENT_LANG]||'order_sheet') + '.pdf', url: url, type: 'order_sheet' });
            else errors.push('order_sheet upload failed');
        } else { errors.push('order_sheet PDF generation timeout/failed'); }

        const _totalDiscRate = currentUserDiscountRate + 0;
        const _mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
        const _localMileage = Math.round(useMileage * _mileRate);
        const quoteBlob = await withTimeout(generateQuotationPDF(orderInfoForPDF, cartData, _totalDiscRate, _localMileage), PDF_TIMEOUT);
        if(quoteBlob) {
            const url = await withTimeout(uploadFileToSupabase(quoteBlob, `orders/${orderId}/quotation.pdf`), UPLOAD_TIMEOUT);
            if(url) uploadedFiles.push({ name: ({ja:'見積書',en:'quotation',kr:'견적서'}[CURRENT_LANG]||'quotation') + '.pdf', url: url, type: 'quotation' });
            else errors.push('quotation upload failed');
        } else { errors.push('quotation PDF generation timeout/failed'); }
    } catch(pdfErr) {
        console.error("문서 생성 오류:", pdfErr);
        errors.push('doc generation error: ' + (pdfErr.message || pdfErr));
    }

    // [3] 디자인 PDF 업로드 + 가이드 캡처본
    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i];
        const idx = String(i + 1).padStart(2, '0');

        if (item.designPdfUrl && item.type === 'design') {
            if (loading) loading.querySelector('p').innerText = `${window.t('msg_converting_design', "Converting design...")} (${i+1}/${cartData.length})`;
            try {
                const res = await withTimeout(fetch(item.designPdfUrl), PDF_TIMEOUT);
                if (res && res.ok) {
                    const imgBlob = await res.blob();
                    const ext = (imgBlob.type && imgBlob.type.includes('png')) ? 'png' : 'png';
                    const url = await withTimeout(uploadFileToSupabase(imgBlob, `orders/${orderId}/design_${idx}.${ext}`), UPLOAD_TIMEOUT);
                    if (url) uploadedFiles.push({ name: `product_${idx}_${item.product?.name || 'design'}.${ext}`, url: url, type: 'product' });
                    else errors.push(`design_${idx} upload failed`);
                } else { errors.push(`design_${idx} fetch failed`); }
            } catch(err) {
                console.error("사전생성 디자인 전송 실패:", err);
                errors.push(`design_${idx}: ${err.message || err}`);
            }

            // ★ 가이드 위치 캡처본 (thumb) 도 함께 업로드
            if (item.thumb && item.thumb.startsWith('http')) {
                try {
                    const thumbRes = await withTimeout(fetch(item.thumb), PDF_TIMEOUT);
                    if (thumbRes && thumbRes.ok) {
                        const thumbBlob = await thumbRes.blob();
                        const thumbUrl = await withTimeout(uploadFileToSupabase(thumbBlob, `orders/${orderId}/guide_preview_${idx}.jpg`), UPLOAD_TIMEOUT);
                        if (thumbUrl) uploadedFiles.push({ name: `guide_preview_${idx}_${item.product?.name || 'preview'}.jpg`, url: thumbUrl, type: 'guide_preview' });
                    }
                } catch(err) { console.warn('가이드 캡처본 업로드 실패:', err); }
            }

            if (item.boxLayoutPdfUrl) {
                try {
                    const layoutRes = await withTimeout(fetch(item.boxLayoutPdfUrl), PDF_TIMEOUT);
                    if (layoutRes && layoutRes.ok) {
                        const layoutBlob = await layoutRes.blob();
                        const layoutUrl = await withTimeout(uploadFileToSupabase(layoutBlob, `orders/${orderId}/box_layout_${idx}.pdf`), UPLOAD_TIMEOUT);
                        if (layoutUrl) uploadedFiles.push({ name: `box_layout_${idx}_${item.product?.name || 'layout'}.pdf`, url: layoutUrl, type: 'box_layout' });
                        else errors.push(`box_layout_${idx} upload failed`);
                    }
                } catch(err) { errors.push(`box_layout_${idx}: ${err.message || err}`); }
            }
            continue;
        }

        // ★ 작품 마켓플레이스: 원본 이미지 업로드 (product_only + partner_id)
        if (item.type === 'product_only' && item.product?.partner_id && item.product?.img) {
            try {
                // 썸네일 URL에서 원본 URL 도출 (thumb_ 접두사 제거)
                let artOrigUrl = item.product.img;
                if (artOrigUrl.includes('/thumb_')) {
                    artOrigUrl = artOrigUrl.replace('/thumb_', '/');
                }
                const artRes = await withTimeout(fetch(artOrigUrl), PDF_TIMEOUT);
                if (artRes && artRes.ok) {
                    const artBlob = await artRes.blob();
                    const artExt = (artBlob.type && artBlob.type.includes('png')) ? 'png' : 'jpg';
                    const artUrl = await withTimeout(uploadFileToSupabase(artBlob, `orders/${orderId}/artwork_${idx}.${artExt}`), UPLOAD_TIMEOUT);
                    if (artUrl) uploadedFiles.push({ name: `artwork_${idx}_${item.product?.name || 'artwork'}.${artExt}`, url: artUrl, type: 'product' });
                }
            } catch(err) { console.warn('작품 원본 이미지 업로드 실패:', err); }
            continue;
        }

        if (!item.originalUrl && item.type === 'design' && item.json && item.product) {
            let hasContent = false;
            if (item.json.objects && Array.isArray(item.json.objects)) {
                const validObjects = item.json.objects.filter(obj => !obj.isBoard);
                if (validObjects.length > 0) hasContent = true;
            }
            if (!hasContent) continue;

            if (loading) loading.querySelector('p').innerText = `${window.t('msg_converting_design', "Converting design...")} (${i+1}/${cartData.length})`;
            try {
                // 고화질 PNG 생성 (loadFromJSON → 캡처)
                const targetPages = (item.pages && item.pages.length > 0) ? item.pages : [item.json];
                const { generateDesignPNG } = await import('./export.js?v=404');
                let fileBlob = await withTimeout(generateDesignPNG(targetPages, item.width, item.height, item.boardX || 0, item.boardY || 0), PDF_TIMEOUT);

                if(fileBlob) {
                    const url = await withTimeout(uploadFileToSupabase(fileBlob, `orders/${orderId}/design_${idx}.png`), UPLOAD_TIMEOUT);
                    if(url) uploadedFiles.push({ name: `product_${idx}_${item.product.name}.png`, url: url, type: 'product' });
                    else errors.push(`product_${idx} upload failed`);
                } else { errors.push(`product_${idx} PNG generation timeout/failed`); }
            } catch(err) {
                console.error("디자인 변환 실패:", err);
                errors.push(`product_${idx}: ${err.message || err}`);
            }

            // ★ 가이드 위치 캡처본 (JSON fallback 경로에서도)
            if (item.thumb && item.thumb.startsWith('http')) {
                try {
                    const thumbRes = await withTimeout(fetch(item.thumb), PDF_TIMEOUT);
                    if (thumbRes && thumbRes.ok) {
                        const thumbBlob = await thumbRes.blob();
                        const thumbUrl = await withTimeout(uploadFileToSupabase(thumbBlob, `orders/${orderId}/guide_preview_${idx}.jpg`), UPLOAD_TIMEOUT);
                        if (thumbUrl) uploadedFiles.push({ name: `guide_preview_${idx}_${item.product?.name || 'preview'}.jpg`, url: thumbUrl, type: 'guide_preview' });
                    }
                } catch(err) { console.warn('가이드 캡처본 업로드 실패:', err); }
            }
        }
    }

    // [4] DB 업데이트 (파일 목록 + 에러 기록)
    // ★ 에러를 files 배열 끝에 메타 항목으로 추가 (별도 컬럼 불필요)
    if (errors.length > 0) {
        uploadedFiles.push({ name: '_upload_errors', type: '_error_log', url: '', errors: errors });
        console.error(`[파일업로드경고] 주문 ${orderId}: ${errors.length}건 에러 — ${errors.join(', ')}`);
    }
    const updatePayload = { files: uploadedFiles };

    try {
        const { error: updateError } = await sb.from('orders').update(updatePayload).eq('id', orderId);
        if (updateError) {
            console.error(`[DB업데이트실패] 주문 ${orderId} 파일 정보 저장 실패:`, updateError);
            // ★ 1회 재시도
            await new Promise(r => setTimeout(r, 2000));
            const { error: retryErr } = await sb.from('orders').update(updatePayload).eq('id', orderId);
            if (retryErr) console.error(`[DB업데이트재시도실패] 주문 ${orderId}:`, retryErr);
        }
    } catch(dbErr) {
        console.error(`[DB업데이트예외] 주문 ${orderId}:`, dbErr);
    }

    if (uploadedFiles.length === 0 && cartData.length > 0) {
        console.error(`[파일누락경고] 주문 ${orderId}: 장바구니 ${cartData.length}개 상품이 있지만 업로드된 파일이 0개`);
    }

    return uploadedFiles;
}

// ============================================================
// [신규] 실제 DB 생성 및 파일 업로드
// ============================================================
async function createRealOrderInDb(finalPayAmount, useMileage) {
    if (!window.tempOrderInfo) throw new Error(window.t('msg_no_temp_order', "No temporary order data found."));

    const loading = document.getElementById("loading");
    loading.style.display = "flex";
    loading.querySelector('p').innerText = window.t('msg_creating_order', "Creating order data...");

    const { manager, phone, address, request, deliveryDate } = window.tempOrderInfo;

    // [중요] 주문 생성 직전에만 클라우드에서 디자인 데이터를 일시적으로 복구합니다.
    for(let item of cartData) {
        if(item.jsonUrl) {
            try {
                const res = await fetch(item.jsonUrl);
                if(res.ok) {
                    const recovered = await res.json();
                    item.json = recovered.main || recovered;
                    item.pages = recovered.pages || [];
                }
            } catch(e) { console.error("데이터 복구 실패:", e); }
        }
    }

    const itemsToSave = cartData.map(item => {
        if (!item.product) return null; 
        
        const unitPrice = item.product.price || 0;
        const qty = item.qty || 1;
        const productTotal = unitPrice * qty;
        
        let optionTotal = 0;
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const addon = ADDON_DB[code];
                const _sw = addon && (addon.category_code === 'opt_8796' || addon.is_swatch);
                const aq = _sw ? (item.qty || 1) : ((item.addonQuantities && item.addonQuantities[code]) || 1);
                if(addon) optionTotal += addon.price * aq;
            });
        }
        const itemFinalTotal = productTotal + optionTotal;
        const compatibleUnitPrice = Math.floor(itemFinalTotal / qty);

        return {
            product: {
                name: localName(item.product),
                price: item.product.price,
                code: item.product.code || item.product.key,
                img: item.product.img,
                partner_id: item.product.partner_id || null,
                w_mm: item.product.w_mm || item.product.width_mm || 0,
                h_mm: item.product.h_mm || item.product.height_mm || 0,
                _artworkType: item.product._artworkType || '',
                _tshirtColor: item.product._tshirtColor || '',
                _tshirtColorName: item.product._tshirtColorName || '',
                _tshirtSize: item.product._tshirtSize || '',
                _blindSide: item.product._blindSide || ''
            },
            productName: localName(item.product),
            qty: qty,
            price: compatibleUnitPrice,
            selectedAddons: item.selectedAddons || {},
            addonQuantities: item.addonQuantities || {},
            type: item.type || 'design',
            json: item.json || null,
            thumb: item.thumb || '',
            width: item.width || 0,
            height: item.height || 0,
            fileName: item.fileName || '',
            originalUrl: item.originalUrl || '',
            uploadedFiles: item.uploadedFiles || null,
            cutlineUrl: item.cutlineUrl || '',
            // Phase 3a: design-market bid linkage (for DB trigger that marks
            // design_bids.payment_status='paid' when this order is marked completed)
            _designBidId: item._designBidId || null,
            _designRequestId: item._designRequestId || null,
            _designerId: item._designerId || null,
            _gigId: item._gigId || null
        };
    }).filter(i => i !== null);

    // ★ items가 비어있으면 주문 생성 중단 (주문 내역 공란 방지)
    if (itemsToSave.length === 0) {
        console.error('ORDER: itemsToSave is empty! cartData:', cartData);
        throw new Error(window.t('msg_cart_empty', "Your cart is empty."));
    }

    // [핵심] 3중 사이트 코드 결정:
    // 1순위: HTML 인라인 스크립트 (CDN 캐시 불가)
    // 2순위: SITE_CONFIG 모듈
    // 3순위: hostname 직접 체크 (폴백)
    const _hostname = window.location.hostname;
    const _fromHTML = window.__SITE_CODE;
    const _fromConfig = SITE_CONFIG?.COUNTRY;
    const _fromHostname = _hostname.includes('cafe0101') ? 'JP' : (_hostname.includes('cafe3355') || _hostname.includes('chameleon.design')) ? 'US' : 'KR';
    const _siteCode = (_fromHTML && _fromHTML !== 'KR') ? _fromHTML
                    : (_fromConfig && _fromConfig !== 'KR') ? _fromConfig
                    : _fromHostname;

    // 추천인 정보를 request_note에 태그로 저장
    let finalRequestNote = request;
    const _refId = window.tempOrderInfo?.referrerId;
    const _refEmail = window.tempOrderInfo?.referrerEmail;
    if (_refId && _refEmail) {
        finalRequestNote = (request || '') + `\n##REF:${_refId}:${_refEmail}##`;
    }

    const { data: orderData, error: orderError } = await sb.from('orders').insert([{
        user_id: currentUser?.id,
        order_date: new Date().toISOString(),
        delivery_target_date: deliveryDate,
        installation_time: window.tempOrderInfo?.installationTime || null,
        manager_name: manager,
        phone,
        address,
        request_note: finalRequestNote,
        status: '임시작성',
        payment_status: '미결제',
        total_amount: finalPayAmount,
        discount_amount: useMileage,
        items: itemsToSave,
        site_code: _siteCode,
        staff_manager_id: window.tempOrderInfo?.staffManagerId || null,
        admin_note: (window.tempOrderInfo?.isHqOrder ? '[고객지정] 본사 직접 처리 요청\n' : '') + (localStorage.getItem('chameleon_quote_pdf_url') ? '[견적서] ' + localStorage.getItem('chameleon_quote_pdf_url') : '') || null
    }]).select();
    
    if (orderError) throw orderError; 
    
    const newOrderId = orderData[0].id;
    window.currentDbId = newOrderId; 

    // ★ 공통 함수로 파일 업로드 (고객파일 + PDF 생성)
    // ★ try-catch로 감싸서 파일 업로드 실패해도 주문 자체는 유지
    try {
        await uploadOrderFiles(newOrderId, cartData, useMileage);
    } catch(uploadErr) {
        console.error(`[파일업로드실패] 주문 ${newOrderId}: 파일 업로드 중 오류 발생, 주문은 유지됨`, uploadErr);
        // 에러 기록을 DB에 남김 (files 배열에 에러 로그 저장)
        try {
            await sb.from('orders').update({
                files: [{ name: '_upload_errors', type: '_error_log', url: '', errors: ['CRITICAL: ' + (uploadErr.message || uploadErr)] }]
            }).eq('id', newOrderId);
        } catch(e) { /* ignore */ }
    }

    // [파트너 마켓플레이스] 파트너 상품이 포함된 경우 partner_settlements 생성 + 예치금 적립
    try {
        const partnerItems = itemsToSave.filter(i => i.product?.partner_id);
        if (partnerItems.length > 0) {
            await sb.from('orders').update({ has_partner_items: true }).eq('id', newOrderId);
            // 파트너별 수익 합산
            const partnerCommMap = {};
            for (const item of partnerItems) {
                const amt = (item.price || 0) * (item.qty || 1);
                const comm = Math.floor(amt * 0.10);
                const pid = item.product.partner_id;
                await sb.from('partner_settlements').insert({
                    order_id: newOrderId,
                    partner_id: pid,
                    item_code: item.product.code || 'unknown',
                    item_amount: amt,
                    commission_rate: 10.0,
                    commission_amount: comm,
                    net_amount: amt - comm,
                    settlement_status: 'completed'
                });
                if (!partnerCommMap[pid]) partnerCommMap[pid] = 0;
                partnerCommMap[pid] += comm;
            }
            // 파트너별 예치금 적립
            for (const [pid, totalComm] of Object.entries(partnerCommMap)) {
                if (totalComm <= 0) continue;
                const { data: pf } = await sb.from('profiles').select('deposit').eq('id', pid).single();
                const newDeposit = (parseInt(pf?.deposit || 0)) + totalComm;
                await sb.from('profiles').update({ deposit: newDeposit }).eq('id', pid);
                await sb.from('wallet_logs').insert({
                    user_id: pid,
                    type: 'partner_commission',
                    amount: totalComm,
                    description: `작품 판매 수익 적립 (주문: ${newOrderId})`
                });
            }
        }
    } catch(e) { console.warn('partner_settlements 생성:', e); }

    return newOrderId;
}

// ============================================================
// [수정됨] 최종 결제 버튼 클릭 시 실행
// ============================================================
async function processFinalPayment() {
    // ★ 미로그인 시 가입 유도 (결제 정보 유지)
    if (!currentUser) {
        // 소셜 로그인 대비: 결제 상태를 sessionStorage에 보존
        try {
            sessionStorage.setItem('_pendingPayment', JSON.stringify({
                tempOrderInfo: window.tempOrderInfo,
                originalPayAmount: window.originalPayAmount,
                finalPaymentAmount: window.finalPaymentAmount,
                nonMetroFee: window._nonMetroFeeApplied || 0,
                discountRate: currentUserDiscountRate || 0
            }));
        } catch(e) {}
        if (window.openAuthModal) {
            window.openAuthModal('signup', () => processFinalPayment());
        } else {
            showToast(window.t('msg_login_required', "Login is required."), "warn");
        }
        return;
    }

    if (!window.tempOrderInfo && !window.currentDbId) { showToast(window.t('msg_no_order_info', "No order info. Please try again from the start."), "error"); return; }

    // 마일리지는 이미 originalPayAmount에 반영됨 (processOrderSubmission에서 차감)
    const useMileage = window.getCartMileageKRW ? window.getCartMileageKRW() : 0;
    const baseAmount = window.originalPayAmount || 0;
    let realFinalPayAmount = baseAmount; // 이미 마일리지 차감된 금액

    if (realFinalPayAmount < 0) { showToast(window.t('msg_payment_amount_error', "Payment amount error."), "error"); return; }

    if (useMileage > 0) {
        if (!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }
        const excludedSet = window.excludedCategoryCodes || new Set();
        let isSafe = true;
        cartData.forEach(item => { if (item.product && excludedSet.has(item.product.category)) isSafe = false; });
        if (!isSafe) { showToast(window.t('msg_mileage_excluded_items', "Cart contains items where mileage cannot be used."), "warn"); return; }

        const { data: check } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
        if (!check || check.mileage < useMileage) { showToast(window.t('alert_mileage_shortage', "Insufficient mileage."), "warn"); return; }
    }

    const btn = document.getElementById("btnFinalPay");
    if (btn) btn.disabled = true;

    try {
        if (!window.currentDbId) {
            await createRealOrderInDb(realFinalPayAmount, useMileage);
        } else {
            const itemsToSave = cartData.map(item => {
                 if (!item.product) return null;
                 let unitPrice = item.product.price || 0;
                 let qty = item.qty || 1;
                 let optTotal = 0;
                 if(item.selectedAddons) {
                    Object.values(item.selectedAddons).forEach(code => {
                        let ad = ADDON_DB[code];
                        if(ad) {
                            const _sw = ad.category_code === 'opt_8796' || ad.is_swatch;
                            optTotal += ad.price * (_sw ? qty : (item.addonQuantities[code] || 1));
                        }
                    });
                 }
                 let compatible = Math.floor((unitPrice*qty + optTotal)/qty);
                 return {
                    productName: localName(item.product),
                    qty: qty,
                    price: compatible,
                    product: { name: localName(item.product), price: item.product.price, code: item.product.code||item.product.key, img: item.product.img },
                    selectedAddons: item.selectedAddons,
                    addonQuantities: item.addonQuantities,
                    // Phase 3a: design-market bid linkage
                    _designBidId: item._designBidId || null,
                    _designRequestId: item._designRequestId || null,
                    _designerId: item._designerId || null,
                    _gigId: item._gigId || null
                 };
            }).filter(x=>x);

            const _updateData = {
                discount_amount: useMileage,
                total_amount: realFinalPayAmount,
                items: itemsToSave
            };
            // 추천인 정보를 request_note에 태그로 저장
            if (window.tempOrderInfo?.referrerId && window.tempOrderInfo?.referrerEmail) {
                const _existNote = window.tempOrderInfo?.request || '';
                _updateData.request_note = _existNote + `\n##REF:${window.tempOrderInfo.referrerId}:${window.tempOrderInfo.referrerEmail}##`;
            }
            await sb.from('orders').update(_updateData).eq('id', window.currentDbId);

            // ★ [버그수정] 재진입 시에도 파일 업로드 실행 (기존: 파일 업로드가 완전히 건너뛰어짐)
            try {
                await uploadOrderFiles(window.currentDbId, cartData, useMileage);
            } catch(uploadErr) {
                console.error(`[파일업로드실패-재진입] 주문 ${window.currentDbId}:`, uploadErr);
                try {
                    await sb.from('orders').update({
                        files: [{ name: '_upload_errors', type: '_error_log', url: '', errors: ['RETRY CRITICAL: ' + (uploadErr.message || uploadErr)] }]
                    }).eq('id', window.currentDbId);
                } catch(e) { /* ignore */ }
            }
        }

        const orderId = window.currentDbId; 

        const selected = document.querySelector('input[name="paymentMethod"]:checked');
        const method = selected ? selected.value : 'card';

        if (method === 'deposit') {
            const balanceSpan = document.getElementById('myCurrentDepositDisplay');
            const depositBalance = parseInt(balanceSpan?.dataset?.balance || 0);

            if (depositBalance >= realFinalPayAmount) {
                // 예치금으로 전액 결제
                await processDepositPayment(realFinalPayAmount, useMileage);
            } else if (depositBalance > 0) {
                // ★ 혼합결제: 예치금 차감 + 나머지 카드결제
                const cardAmount = realFinalPayAmount - depositBalance;
                const msg = window.t('confirm_mixed_pay',
                    `예치금 ${formatCurrency(depositBalance)} 사용 + 카드 ${formatCurrency(cardAmount)} 결제하시겠습니까?`)
                    .replace('{deposit}', formatCurrency(depositBalance))
                    .replace('{card}', formatCurrency(cardAmount));
                if (!confirm(msg)) {
                    btn.disabled = false;
                    document.getElementById("loading").style.display = "none";
                    return;
                }

                // 1) 예치금 차감
                const newBalance = depositBalance - depositBalance; // = 0
                await sb.from('profiles').update({ deposit: newBalance }).eq('id', currentUser.id);
                await sb.from('wallet_logs').insert({
                    user_id: currentUser.id,
                    type: 'payment_order',
                    amount: -depositBalance,
                    description: `주문 결제 예치금 사용 (주문번호: ${window.currentDbId})`
                });

                // 마일리지도 차감
                if (useMileage > 0) {
                    const { data: m } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
                    await sb.from('profiles').update({ mileage: m.mileage - useMileage }).eq('id', currentUser.id);
                    await sb.from('wallet_logs').insert({ user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용` });
                }

                // 2) 주문에 예치금 사용 금액 기록
                await sb.from('orders').update({
                    discount_amount: (useMileage || 0) + depositBalance,
                    request_note: (window.tempOrderInfo?.request || '') + `\n[예치금 ${depositBalance}원 사용, 카드 ${cardAmount}원 결제]`
                }).eq('id', window.currentDbId);

                // 3) 나머지 금액 카드결제
                processCardPayment(cardAmount);
            } else {
                // 예치금 0원 → 카드결제로 전환
                showToast(window.t('msg_no_deposit', '예치금이 없습니다. 카드결제로 진행합니다.'), 'warn');
                processCardPayment(realFinalPayAmount);
            }
        } else if (method === 'bank') {
            const depositorName = document.getElementById('inputDepositorName').value;
            if (!depositorName) { btn.disabled = false; showToast(window.t('alert_input_depositor', "Please enter depositor name."), "warn"); return; }
            
            // ★ 증빙 정보 수집 (KR 무통장입금만)
            let receiptInfo = null;
            if (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY === 'KR' && window.collectReceiptInfo) {
                receiptInfo = window.collectReceiptInfo();
                if (receiptInfo === null) { btn.disabled = false; return; } // 필수값 누락
            }

            if(confirm(window.t('confirm_bank_payment', "Proceed with Bank Transfer?"))) {
                if(useMileage > 0) {
                     const { data: m } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
                     await sb.from('profiles').update({ mileage: m.mileage - useMileage }).eq('id', currentUser.id);
                     await sb.from('wallet_logs').insert({ user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용` });
                }

                const bankUpdate = { status: '접수됨', payment_method: '무통장입금', payment_status: '입금대기', depositor_name: depositorName };
                if (receiptInfo) bankUpdate.receipt_info = receiptInfo;
                await sb.from('orders').update(bankUpdate).eq('id', orderId);
                
                // 장바구니 비우기
                try {
                    localStorage.setItem(cartStorageKey(), '[]');
                    Object.keys(localStorage).forEach(k => {
                        if (k.startsWith('chameleon_cart_') && k !== cartStorageKey()) localStorage.removeItem(k);
                    });
                    cartData.length = 0;
                } catch(e) {}

                // ★ 계좌번호 안내 팝업 표시
                const bankPopup = document.createElement('div');
                bankPopup.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
                const _country = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
                const _isKR = _country === 'KR';
                const _bankName = _isKR ? '국민은행' : 'Community Federal Savings Bank';
                const acctNum = _isKR ? '647701-04-277763' : '8487335989';
                const _holder = _isKR ? '(예금주: 카멜레온프린팅)' : '(CHAMELEON PRINTING INC)';
                const _orderMsg = _isKR ? '✅ 주문이 접수되었습니다' : '✅ Order Confirmed';
                const _noteMsg = _isKR ? '입금 확인 후 제작이 시작됩니다.' : 'Production begins after payment is confirmed.';
                const _copyBtn = _isKR ? '📋 계좌번호 복사' : '📋 Copy Account';
                const _printBtn = _isKR ? '🖨️ 인쇄하기' : '🖨️ Print';
                const _closeBtn = _isKR ? '닫기' : 'Close';
                const _extraInfo = _isKR ? '' : '<div style="color:#93c5fd;font-size:11px;margin-top:8px;line-height:1.6;">ACH Routing: 026073150 | Fedwire: 026073008<br>SWIFT: CMFGUS33<br>89-16 Jamaica Ave, Woodhaven, NY 11421</div>';
                bankPopup.innerHTML = `
                    <div style="background:#fff;border-radius:16px;padding:30px;max-width:400px;width:90%;text-align:center;">
                        <div style="font-size:18px;font-weight:800;color:#1e3a8a;margin-bottom:20px;">${_orderMsg}</div>
                        <div style="background:#1e3a8a;border-radius:12px;padding:20px;margin-bottom:20px;">
                            <div style="color:#93c5fd;font-size:13px;margin-bottom:6px;">${_bankName}</div>
                            <div style="color:#fff;font-size:${_isKR ? '26' : '20'}px;font-weight:900;letter-spacing:1.5px;margin-bottom:6px;">${acctNum}</div>
                            <div style="color:#bfdbfe;font-size:13px;">${_holder}</div>
                            ${_extraInfo}
                        </div>
                        <div style="color:#64748b;font-size:13px;margin-bottom:20px;">${_noteMsg}</div>
                        <div style="display:flex;gap:10px;">
                            <button onclick="navigator.clipboard.writeText('${acctNum}').then(()=>this.textContent='✓ Copied')" style="flex:1;padding:12px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">${_copyBtn}</button>
                            <button onclick="window.print()" style="flex:1;padding:12px;border:none;border-radius:8px;background:#e2e8f0;color:#334155;font-size:14px;font-weight:700;cursor:pointer;">${_printBtn}</button>
                        </div>
                        <button onclick="location.reload()" style="margin-top:12px;width:100%;padding:12px;border:none;border-radius:8px;background:#f1f5f9;color:#64748b;font-size:13px;cursor:pointer;">${_closeBtn}</button>
                    </div>
                `;
                document.body.appendChild(bankPopup);
            }
        } else {
            processCardPayment(realFinalPayAmount);
        }

    } catch (e) {
        console.error(e);
        showToast(window.t('msg_order_create_error', "Error creating order: ") + e.message, "error");
    } finally {
        document.getElementById("loading").style.display = "none";
        btn.disabled = false;
    }
}

// ============================================================
// [수정] 예치금 결제
// ============================================================
async function processDepositPayment(payAmount, useMileage) {
    if (!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }

    const balanceSpan = document.getElementById('myCurrentDepositDisplay');
    const currentBalance = parseInt(balanceSpan.dataset.balance || 0);

    if (currentBalance < payAmount) {
        const shortage = formatCurrency(payAmount - currentBalance);
        document.getElementById("loading").style.display = "none";
        document.getElementById("btnFinalPay").disabled = false;
        showToast(window.t('alert_deposit_shortage').replace('{amount}', shortage), "warn"); return;
    }

    if (!confirm(window.t('confirm_deposit_pay').replace('{amount}', formatCurrency(payAmount)))) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("btnFinalPay").disabled = false;
        return;
    }

    try {
        if (useMileage > 0) {
            const { data: m } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
            await sb.from('profiles').update({ mileage: m.mileage - useMileage }).eq('id', currentUser.id);
            await sb.from('wallet_logs').insert({ user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용` });
        }

        const newBalance = currentBalance - payAmount;
        const { error: profileErr } = await sb.from('profiles').update({ deposit: newBalance }).eq('id', currentUser.id);
        if (profileErr) throw profileErr;

        await sb.from('wallet_logs').insert({
            user_id: currentUser.id,
            type: 'payment_order',
            amount: -payAmount,
            description: `주문 결제 (주문번호: ${window.currentDbId})`
        });

        await sb.from('orders').update({
            payment_status: '결제완료',
            payment_method: '예치금',
            status: '접수됨'
        }).eq('id', window.currentDbId);

        // 추천인 적립
        if (window.tempOrderInfo?.referrerId) {
            await creditReferralBonus(window.currentDbId, window.tempOrderInfo.referrerId);
        }

        showToast(window.t('msg_payment_complete'), "success");
        // ★ [버그수정] 예치금 결제 완료 후 장바구니 비우기 (중복 주문 방지)
        try {
            // ★ [수정] removeItem 대신 빈 배열 저장 (구 키 마이그레이션 방지)
            localStorage.setItem(cartStorageKey(), '[]');
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('chameleon_cart_') && k !== cartStorageKey()) localStorage.removeItem(k);
            });
            cartData.length = 0;
        } catch(e2) {}
        location.reload();

    } catch (e) {
        console.error(e);
        showToast(window.t('msg_payment_error', "Payment processing error: ") + e.message, "error");
        document.getElementById("loading").style.display = "none";
        document.getElementById("btnFinalPay").disabled = false;
    }
}

// ============================================================
// [수정] 카드 결제
// ============================================================
function processCardPayment(confirmedAmount) {
    const country = SITE_CONFIG.COUNTRY;
    const pgConfig = SITE_CONFIG.PG_CONFIG[country];
    if (!pgConfig) { showToast(window.t('msg_pg_config_error', "PG config error: No payment settings for this country."), "error"); return; }

    const orderName = `Chameleon Order #${window.currentDbId}`;
    const customerName = document.getElementById("orderName").value;

    const realPayAmount = (confirmedAmount !== undefined) ? confirmedAmount : window.finalPaymentAmount;

    if (realPayAmount < 0) { showToast(window.t('msg_payment_amount_error', "Payment amount error."), "error"); return; }

    if (pgConfig.provider === 'toss') {
        if (!window.TossPayments) { showToast(window.t('msg_toss_sdk_missing', "Toss Payments SDK is not loaded."), "error"); return; }
        
        const tossPayments = TossPayments(pgConfig.clientKey);
        tossPayments.requestPayment("카드", {
            amount: realPayAmount,  
            orderId: "ORD-" + new Date().getTime() + "-" + window.currentDbId, 
            orderName: orderName, 
            customerName: customerName, 
            successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}` + (window.tempOrderInfo?.referrerId ? `&ref_id=${window.tempOrderInfo.referrerId}` : ''),
            failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, 
        }).catch(error => { 
            if (error.code !== "USER_CANCEL") showToast(window.t('msg_payment_error_prefix', "Payment Error: ") + error.message, "error");
        });

    } else if (pgConfig.provider === 'stripe') {
        initiateStripeCheckout(pgConfig.publishableKey, realPayAmount, country, window.currentDbId);
    }
}

async function initiateStripeCheckout(pubKey, amount, currencyCountry, orderDbId) {
    if (typeof Stripe === 'undefined') { showToast(window.t('msg_stripe_load_failed', "Stripe module load failed"), "error"); return; }

    const stripe = Stripe(pubKey);
    const btn = document.getElementById("btnFinalPay");
    const originalText = btn.innerText;

    btn.innerText = window.t('msg_connecting_stripe', "Connecting to Stripe...");
    btn.disabled = true;

    // 국가별 Stripe 통화 매핑
    const currencyMap = { JP: 'jpy', US: 'usd', CN: 'cny', AR: 'usd', ES: 'eur', DE: 'eur', FR: 'eur' };
    const currency = currencyMap[currencyCountry] || 'usd';
    const zeroDec = ['jpy']; // 소수점 없는 통화

    // KRW → 현지 통화 변환 (DB는 KRW 기준 저장)
    const rate = SITE_CONFIG.CURRENCY_RATE[currencyCountry] || 1;
    const localAmount = zeroDec.includes(currency)
        ? Math.round(amount * rate)       // JPY: 정수 (소수점 없음)
        : Math.round(amount * rate * 100) / 100; // USD/CNY/SAR/EUR: 소수 2자리

    // Stripe 최소 결제금액 체크
    const minAmount = zeroDec.includes(currency) ? 100 : 0.50;
    const currSymbol = { jpy: '¥', usd: '$', cny: '¥', sar: '$', eur: '€' };
    const minLabel = (currSymbol[currency] || '') + minAmount;
    if (localAmount < minAmount) {
        btn.innerText = originalText;
        btn.disabled = false;
        showToast(window.t('msg_stripe_min_amount', `Minimum payment amount is ${minLabel}. Current: `) + (currSymbol[currency] || '') + localAmount, "warn"); return;
    }

    try {
        const { data, error } = await sb.functions.invoke('create-stripe-session', {
            body: {
                amount: localAmount,
                currency: currency,
                order_id: orderDbId,
                cancel_url: window.location.href,
                success_url: window.location.origin + `/success.html?db_id=${orderDbId}` + (window.tempOrderInfo?.referrerId ? `&ref_id=${window.tempOrderInfo.referrerId}` : '')
            }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const result = await stripe.redirectToCheckout({
            sessionId: data.sessionId
        });

        if (result.error) showToast(result.error.message, "error");
        
    } catch (e) {
        console.error("Stripe Error:", e);
        showToast(window.t('msg_payment_init_failed', "Payment initialization failed: ") + e.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ============================================================
// [8] Window 전역 함수 연결
// ============================================================
window.toggleCartAccordion = function(idx) { 
    if (cartData[idx]) { 
        cartData[idx].isOpen = !cartData[idx].isOpen; 
        renderCart(); 
    } 
};
// ★ 장바구니 상품별 파일 업로드
window._uploadCartItemFile = async function(idx, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('50MB 이하 파일만 업로드 가능합니다.'); return; }
    const CART_KEY = 'chameleon_cart_current';
    let items = [];
    try { items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return; }
    if (idx < 0 || idx >= items.length) return;

    const btn = input.parentElement;
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 업로드중...';
    btn.style.pointerEvents = 'none';
    try {
        const url = await uploadFileToSupabase(file, 'customer_uploads');
        if (!url) throw new Error('업로드 실패');
        // ★ 기존 파일 완전 교체
        items[idx].originalUrl = url;
        items[idx].fileName = file.name;
        items[idx].type = 'file_upload';
        // ★ 썸네일 갱신
        if (file.type.startsWith('image/')) {
            items[idx].thumb = url + '?t=' + Date.now(); // 캐시 방지
        } else if (file.type === 'application/pdf') {
            // PDF 첫 페이지 썸네일 생성
            try {
                if (window.pdfjsLib) {
                    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    const ab = await file.arrayBuffer();
                    const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
                    const pg = await pdf.getPage(1);
                    const vp = pg.getViewport({ scale: 150 / pg.getViewport({ scale: 1 }).width });
                    const cvs = document.createElement('canvas');
                    cvs.width = vp.width; cvs.height = vp.height;
                    await pg.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
                    items[idx].thumb = cvs.toDataURL('image/jpeg', 0.7);
                }
            } catch(pe) { console.warn('PDF thumb failed:', pe); items[idx].thumb = null; }
        } else {
            items[idx].thumb = null;
        }
        // ★ 기존 json/jsonUrl 제거 (재첨부이므로 이전 디자인 데이터 무효화)
        items[idx].json = null;
        items[idx].jsonUrl = null;
        localStorage.setItem(CART_KEY, JSON.stringify(items));
        cartData.length = 0; items.forEach(i => cartData.push(i));
        renderCart();
    } catch(e) {
        console.error('파일 업로드 실패:', e);
        btn.innerHTML = origHtml;
        btn.style.pointerEvents = '';
        alert('파일 업로드에 실패했습니다. 다시 시도해주세요.');
    }
};

window.removeCartItem = function(idx) {
    // ★★★ v133 완전 재구성: localStorage를 유일한 진실의 원천으로 사용 ★★★
    // cartData 모듈 바인딩에 의존하지 않음 (버전 불일치 시에도 안전)
    const CART_KEY = 'chameleon_cart_current';

    // 1. localStorage에서 직접 읽기
    let items = [];
    try { items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return; }

    if (idx < 0 || idx >= items.length) return;

    if (!confirm(window.t('confirm_delete', "Delete this item?"))) return;

    // 2. confirm 후 localStorage를 다시 읽기 (confirm 중 변경 대비)
    try { items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return; }

    // 3. splice 후 즉시 localStorage에 쓰기
    if (idx >= 0 && idx < items.length) {
        items.splice(idx, 1);
    }
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch(e) {}

    // 4. 모든 cartData 참조 동기화 (어떤 모듈 인스턴스든)
    try {
        cartData.length = 0;
        items.forEach(item => cartData.push(item));
    } catch(e) {}

    // 5. 렌더링
    renderCart();
};

// ★ 장바구니 아이템 다시 편집하기
window.reEditCartItem = async function(idx) {
    const item = cartData[idx];
    if (!item || !item.jsonUrl) { showToast(window.t ? window.t('err_no_edit_data', 'Edit data not found.') : 'Edit data not found.', "error"); return; }

    const loading = document.getElementById("loading");
    if (loading) { loading.style.display = "flex"; loading.querySelector('p').innerText = window.t ? window.t('msg_loading_design', 'Loading design data...') : 'Loading design data...'; }

    try {
        // 1. 클라우드에서 JSON 복구
        const res = await fetch(item.jsonUrl);
        if (!res.ok) throw new Error("JSON 로드 실패");
        const recovered = await res.json();
        const mainJson = recovered.main || recovered;
        const pages = recovered.pages || [];

        // 2. 편집 중인 아이템 인덱스 저장 (담기 시 업데이트용)
        window.editingCartItemIdx = idx;

        // 3. 상품 코드로 에디터 열기
        const productCode = item.product?.code || item.product?.key || window.currentProductKey;
        if (!productCode) throw new Error("상품 코드 없음");

        // 4. 에디터 열기 + JSON 로드
        document.getElementById('cartPage').style.display = 'none';
        await window.startEditorDirect(productCode);

        // 5. 캔버스 초기화 폴링 후 JSON 로드 (최대 10초 대기)
        const _waitForCanvas = async () => {
            for (let i = 0; i < 100; i++) {
                if (window.canvas && typeof window.canvas.loadFromJSON === 'function') {
                    return window.canvas;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            return null;
        };
        const _cvs = await _waitForCanvas();
        if (!_cvs) {
            console.error("캔버스 로드 실패: canvas 초기화 타임아웃");
            if (loading) loading.style.display = "none";
            showToast((window.t ? window.t('err_load_edit_data', 'Cannot load edit data: ') : 'Cannot load edit data: ') + 'canvas not ready', "error");
            return;
        }
        try {
            // 페이지 데이터 복원
            if (pages.length > 0 && typeof pageDataList !== 'undefined') {
                pageDataList.length = 0;
                pages.forEach(p => pageDataList.push(p));
            }
            // 메인 캔버스에 JSON 로드
            _cvs.loadFromJSON(mainJson, () => {
                _cvs.renderAll();
                if (loading) loading.style.display = "none";
            });
        } catch(e) {
            console.error("캔버스 로드 실패:", e);
            if (loading) loading.style.display = "none";
        }
    } catch(e) {
        console.error("다시 편집 실패:", e);
        if (loading) loading.style.display = "none";
        showToast((window.t ? window.t('err_load_edit_data', 'Cannot load edit data: ') : 'Cannot load edit data: ') + e.message, "error");
    }
};
window.updateCartOption = function(idx, key, value) { 
    if (cartData[idx]) { 
        cartData[idx].selectedAddons[key] = value; 
        saveCart(); 
        renderCart(); 
    } 
};
// [수정] 옵션 체크/해제 로직 개선 (키값 불일치 문제 해결)
window.toggleCartAddon = function(idx, code, isChecked) {
    if (cartData[idx]) {
        if (isChecked) { 
            // 체크 시: 'opt_' 접두사로 통일하여 저장
            const key = `opt_${code}`;
            cartData[idx].selectedAddons[key] = code; 
            
            // 스와치(키링고리 등): 수량 = 제품 수량 자동, 일반: 1로 초기화
            const _addonInfo = ADDON_DB[code];
            const _isSwatchAddon = _addonInfo && (_addonInfo.category_code === 'opt_8796' || _addonInfo.is_swatch);
            cartData[idx].addonQuantities[code] = _isSwatchAddon ? (cartData[idx].qty || 1) : (cartData[idx].addonQuantities[code] || 1);
        } else {
            // 해제 시
            const addons = cartData[idx].selectedAddons;
            Object.keys(addons).forEach(key => {
                if (addons[key] === code) {
                    delete addons[key];
                }
            });
            if (cartData[idx].addonQuantities) delete cartData[idx].addonQuantities[code];
        }
        // ★ 스와치 옵션 체크/해제 후 전체 수량 동기화
        const _ai = ADDON_DB[code];
        if (_ai && (_ai.category_code === 'opt_8796' || _ai.is_swatch)) {
            let totalSw = 0;
            Object.values(cartData[idx].selectedAddons || {}).forEach(ac => {
                const ad = ADDON_DB[ac];
                if (ad && (ad.category_code === 'opt_8796' || ad.is_swatch)) {
                    totalSw += (cartData[idx].addonQuantities[ac] || 1);
                }
            });
            if (totalSw > 0) cartData[idx].qty = totalSw;
        }
        saveCart();
        renderCart();
    }
};
window.updateCartAddonQty = function(idx, code, qty) {
    let quantity = parseInt(qty);
    if (isNaN(quantity) || quantity < 1) quantity = 1;

    if (cartData[idx]) {
        if (!cartData[idx].addonQuantities) cartData[idx].addonQuantities = {};
        cartData[idx].addonQuantities[code] = quantity;

        // ★ 스와치(사이즈/색상) 옵션: 전체 스와치 수량 합계 = 제품 수량
        const addonInfo = ADDON_DB[code];
        const isSwatch = addonInfo && (addonInfo.category_code === 'opt_8796' || addonInfo.is_swatch);
        if (isSwatch) {
            let totalSwatchQty = 0;
            const selectedAddons = cartData[idx].selectedAddons || {};
            Object.values(selectedAddons).forEach(addonCode => {
                const ad = ADDON_DB[addonCode];
                if (ad && (ad.category_code === 'opt_8796' || ad.is_swatch)) {
                    totalSwatchQty += (cartData[idx].addonQuantities[addonCode] || 1);
                }
            });
            if (totalSwatchQty > 0) cartData[idx].qty = totalSwatchQty;
        }

        saveCart();
        renderCart();
    }
};

export function addProductToCartDirectly(productInfo, targetQty = 1, addonCodes = [], addonQtys = {}, extraFields = null) {
    if (!productInfo) return;

    const now = Date.now();
    const productCode = productInfo.code || productInfo.key || '';

    // ★ 중복 추가 방지: 같은 상품이 3초 이내에 다시 추가되면 차단
    // _quote_item이면 건너뛰기 (견적서에서 같은 코드 여러 개 의도적 추가)
    if (!productInfo._quote_item && window._lastCartAdd && productCode) {
        const elapsed = now - window._lastCartAdd.time;
        if (elapsed < 3000 && window._lastCartAdd.code === productCode) {
            console.warn('[addProductToCartDirectly] BLOCKED duplicate add:', productCode, 'elapsed:', elapsed, 'ms');
            return;
        }
    }
    window._lastCartAdd = { code: productCode, time: now };

    window.isDirectCartAddInProgress = true;
    setTimeout(() => { window.isDirectCartAddInProgress = false; }, 2000);

    const selectedAddons = {};
    const addonQuantities = {};
    
    if (addonCodes && addonCodes.length > 0) {
        addonCodes.forEach(code => {
            selectedAddons[`opt_${code}`] = code; 
            addonQuantities[code] = addonQtys[code] || 1; 
        });
    }

    const storageKey = cartStorageKey();
    let currentCartList = [];
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) currentCartList = parsed;
        }
    } catch(e) {}

    // [1] 상품 정보 다이어트 (거대 이미지 코드 원천 차단)
// productInfo를 그대로 쓰지 않고, 필요한 정보만 골라 담으면서 이미지가 길면 삭제합니다.
// 가격 역환산: 관리자 설정 현지 가격이 있으면 KRW 등가로 변환 (formatCurrency가 정확한 현지 가격 표시)
let finalPrice = productInfo.price;
const _siteRate = SITE_CONFIG.CURRENCY_RATE;
// ★ JP만 price_jp 역환산, US/기타는 KRW 원가 유지 (formatCurrency에서 환산)
if (!productInfo.is_custom) {
    if (SITE_CONFIG.COUNTRY === 'JP' && productInfo.price_jp && _siteRate.JP) {
        finalPrice = Math.round(productInfo.price_jp / _siteRate.JP);
    }
}

const cleanProduct = {
    name: productInfo.name,
    name_jp: productInfo.name_jp || '',
    name_us: productInfo.name_us || '',
    price: finalPrice,
    price_jp: productInfo.price_jp || 0,
    price_us: productInfo.price_us || 0,
    code: productInfo.code || productInfo.key,
    img: ((productInfo.img || productInfo.img_url) && (productInfo.img || productInfo.img_url).length < 2000 && !(productInfo.img || productInfo.img_url).startsWith('data:')) ? (productInfo.img || productInfo.img_url) : null,
    w: productInfo.w || productInfo.width_mm || 0,
    h: productInfo.h || productInfo.height_mm || 0,
    w_mm: productInfo.w_mm || productInfo.width_mm || 0,
    h_mm: productInfo.h_mm || productInfo.height_mm || 0,
    category: productInfo.category || '',
    addons: productInfo.addons || [],
    partner_id: productInfo.partner_id || null,
    material: productInfo.material || '',
    // ★ 마켓플레이스/커스텀 제품 추가 정보
    _artworkType: productInfo._artworkType || '',
    _tshirtColor: productInfo._tshirtColor || '',
    _tshirtColorName: productInfo._tshirtColorName || '',
    _tshirtSize: productInfo._tshirtSize || '',
    _blindSide: productInfo._blindSide || '',
    // ★ 벽면 제품 정보
    _wallPanels: productInfo._wallPanels || null,
    _wallTotalPanels: productInfo._wallTotalPanels || 0,
    _wallDiscountRate: productInfo._wallDiscountRate || 0,
    _wallUnitPricePerSqm: productInfo._wallUnitPricePerSqm || 0,
    // ★ 견적서/커스텀 가격 플래그
    is_custom_size: productInfo.is_custom_size || false,
    _calculated_price: productInfo._calculated_price || false,
    _quote_item: productInfo._quote_item || false
};

// [2] 장바구니 아이템 생성
const newItem = {
    uid: now,
    product: cleanProduct, // ★ 세탁된 상품 정보 사용
    type: 'product_only',
    fileName: window.t('msg_file_attached_separately', '(File attached separately)'),
    
    // [3] 썸네일도 동일한 규칙으로 한 번 더 방어
    thumb: cleanProduct.img, 
    
    json: null,
    width: cleanProduct.w,
    height: cleanProduct.h,
    isOpen: true,
    qty: parseInt(targetQty) || 1,
    selectedAddons: selectedAddons,
    addonQuantities: addonQuantities
};

    // extraFields로 파일업로드 등 추가 필드 머지
    if (extraFields && typeof extraFields === 'object') {
        Object.assign(newItem, extraFields);
    }

    currentCartList.push(newItem);

    cartData.length = 0;
    currentCartList.forEach(item => cartData.push(item));

    // ★ pendingSelectedAddons 초기화
    window.pendingSelectedAddons = null;
    window.pendingSelectedAddonQtys = null;

    saveCart();
    renderCart();
}
// ★ 패브릭: 제품 수량 변경 시 후가공 수량도 비례 변경
function _syncFabricAddonQty(item, oldQty, newQty) {
    if (!item.addonQuantities) return;
    // 패브릭 카테고리 체크 (category가 있으면 확인, 없으면 addon 코드로 판별)
    const cat = item.product && item.product.category;
    const isFab = (cat && window._getTopCategoryCode && window._getTopCategoryCode(cat) === '22222');
    // 패브릭 후가공 addon 코드 (카테고리 매칭 실패 시에도 동작)
    const _fabricAddonCodes = new Set(['txl0001','txl0002','txl0003','txl0004','txl0005','MS023','3254352','45783','45722','45787','45646456','3453453','355353']);
    const hasFabricAddon = Object.keys(item.addonQuantities).some(c => _fabricAddonCodes.has(c));
    if (!isFab && !hasFabricAddon) return;
    Object.keys(item.addonQuantities).forEach(code => {
        const oldAq = item.addonQuantities[code] || 1;
        // 비례 조정: 기존 비율 유지 (올림)
        item.addonQuantities[code] = Math.max(1, Math.round(oldAq * newQty / oldQty));
    });
}

window.updateCartQty = function(idx, delta) {
    if (cartData[idx]) {
        const oldQty = cartData[idx].qty || 1;
        let newQty = oldQty + delta;
        if (newQty < 1) newQty = 1;
        _syncFabricAddonQty(cartData[idx], oldQty, newQty);
        cartData[idx].qty = newQty;
        saveCart();
        renderCart();
    }
};
window.updateCartQtyInput = function(idx, val) {
    let newQty = parseInt(val);
    if (!newQty || newQty < 1) newQty = 1;
    if (cartData[idx]) {
        const oldQty = cartData[idx].qty || 1;
        _syncFabricAddonQty(cartData[idx], oldQty, newQty);
        cartData[idx].qty = newQty;
        saveCart();
        renderCart();
    }
};

// ============================================================
// [9] 직접 장바구니 담기 및 일괄 업로드
// ============================================================
export async function processBulkCartUpload(files) {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = `${window.t('msg_uploading_files', "Uploading files...")} (${fileList.length})`;
    }

    try {
        let successCount = 0;

        const uploadPromises = fileList.map(async (file, index) => {
            try {
                const originalUrl = await uploadFileToSupabase(file, 'customer_uploads');
                
                let thumbUrl = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
                if (file.type.startsWith('image/')) {
                    try {
                        const thumbBlob = await resizeImageToBlob(file);
                        const uploadedThumb = await uploadFileToSupabase(thumbBlob, 'thumbs');
                        if (uploadedThumb) thumbUrl = uploadedThumb;
                    } catch(e) {}
                }

                return {
                    uid: Date.now() + index + Math.random(),
                    product: {
                        name: window.t('label_attached_file', 'Attached File'),
                        price: 0,
                        img: thumbUrl,
                        addons: []
                    },
                    type: 'file_upload',
                    fileName: file.name,
                    mimeType: file.type,
                    originalUrl: originalUrl,
                    thumb: thumbUrl,
                    isOpen: false,
                    qty: 1,
                    selectedAddons: {},
                    addonQuantities: {}
                };
            } catch (err) {
                console.error(`파일 업로드 실패 (${file.name}):`, err);
                return null;
            }
        });

        const results = await Promise.all(uploadPromises);

        results.forEach(item => {
            if (item) {
                cartData.push(item);
                successCount++;
            }
        });

        saveCart();
        renderCart();
        
        if (successCount > 0) {
            showToast(`${successCount} ${window.t('msg_files_added_to_cart', "file(s) added to cart.")}`, "success");
            if (window.gtagTrackAddToCart) window.gtagTrackAddToCart();
        } else {
            showToast(window.t('msg_upload_failed', "File upload failed."), "error");
        }

    } catch (e) {
        console.error("일괄 업로드 실패:", e);
        showToast(window.t('msg_upload_error', "Error occurred during file upload."), "error");
    } finally {
        if(loading) loading.style.display = "none";
    }
}

// ============================================================
// [8] 마일리지 계산 헬퍼 함수
// ============================================================

window.calcMileageLimit = function(input) {
    // 사용자 입력은 현지 통화 기준
    let localVal = parseFloat(input.value) || 0;
    const limitKRW = window.mileageLimitMax || 0;
    const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
    const limitLocal = limitKRW * mileRate;

    if (localVal > limitLocal) {
        showToast(window.t('msg_mileage_limit', `Mileage can be used up to 5% of purchase amount.`), "warn");
        localVal = limitLocal;
        input.value = localVal;
    }

    // 역환산하여 KRW 기준으로 계산
    const valKRW = Math.round(localVal / mileRate);

    const baseAmount = window.originalPayAmount || 0;
    const safeBase = baseAmount > 0 ? baseAmount : (window.finalPaymentAmount || 0) + valKRW;

    window.finalPaymentAmount = safeBase - valKRW;

    const amountDisplay = document.getElementById('finalPayAmountDisplay');
    if(amountDisplay) amountDisplay.innerText = formatCurrency(window.finalPaymentAmount);

    const payBtn = document.getElementById('btnFinalPay');
    if(payBtn) payBtn.innerText = `${formatCurrency(window.finalPaymentAmount)} ${window.t('btn_pay', 'Pay')}`;
};

window.applyMaxMileage = function() {
    const input = document.getElementById('cartUseMileage');
    if(input) {
        const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
        input.value = (window.mileageLimitMax || 0) * mileRate;
        window.calcMileageLimit(input);
    }
};

// ============================================================
// [장바구니] 추천인 검증 (장바구니 전용)
// ============================================================
window.validateCartReferrer = async function() {
    const emailInput = document.getElementById('cartReferrerEmail');
    const status = document.getElementById('cartReferrerStatus');
    const email = (emailInput ? emailInput.value.trim() : '');

    if (!email) {
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
        if (status) status.innerHTML = '';
        renderCart();
        return;
    }

    if (currentUser && currentUser.email === email) {
        if (status) { status.innerHTML = '❌ ' + window.t('referral_self_error', '자기 자신은 추천인으로 등록할 수 없습니다.'); status.style.color = '#dc2626'; }
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
        return;
    }

    if (status) { status.innerHTML = '⏳ ...'; status.style.color = '#666'; }

    const { data } = await sb.from('profiles').select('id, email').eq('email', email).maybeSingle();
    if (data) {
        if (status) { status.innerHTML = '✅ ' + window.t('referral_verified', '추천인이 확인되었습니다!') + ' (-5%)'; status.style.color = '#16a34a'; }
        window.verifiedReferrerId = data.id;
        window.verifiedReferrerEmail = email;
        // 배송정보 모달의 추천인 필드도 동기화
        const refInput = document.getElementById('inputReferrerEmail');
        if (refInput) refInput.value = email;
    } else {
        if (status) { status.innerHTML = '❌ ' + window.t('referral_not_found', '존재하지 않는 이메일입니다.'); status.style.color = '#dc2626'; }
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
    }
    renderCart();
};

// ============================================================
// [장바구니] 마일리지 로드 & 계산
// ============================================================
window._cartMileageLoaded = false;

window.loadCartMileage = async function() {
    if (!currentUser) {
        const sec = document.getElementById('cartMileageSection');
        if (sec) sec.style.display = 'none';
        return;
    }
    try {
        const { data: profile } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
        const myMileage = profile ? (profile.mileage || 0) : 0;
        window._cartUserMileage = myMileage;

        const elOwn = document.getElementById('cartOwnMileage');
        if (elOwn) elOwn.innerText = formatCurrency(myMileage).replace(/[원¥$]/g, '').trim() + ' P';

        window._cartMileageLoaded = true;
        window.updateCartMileageLimit();
    } catch(e) { console.error(e); }
};

window.updateCartMileageLimit = function() {
    const myMileage = window._cartUserMileage || 0; // KRW
    const cartTotalKRW = calculateCartTotalKRW();
    const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;

    // 원래 금액 기준 5% 한도 계산 (KRW)
    const fivePercentKRW = Math.floor(cartTotalKRW * 0.05);
    const realLimitKRW = Math.min(myMileage, fivePercentKRW);

    window._cartMileageLimitMax = realLimitKRW; // KRW 기준 저장

    // 표시는 현지 통화로
    const limitLocal = Math.floor(realLimitKRW * mileRate);

    const limitEl = document.getElementById('cartMileageLimit');
    if (limitEl) limitEl.innerText = limitLocal.toLocaleString() + ' P';

    const mileInput = document.getElementById('cartUseMileage');
    if (mileInput) {
        mileInput.placeholder = `${window.t('label_max', 'Max')} ${limitLocal.toLocaleString()}`;
        const curVal = parseFloat(mileInput.value) || 0;
        if (curVal > limitLocal) mileInput.value = limitLocal > 0 ? limitLocal : '';
    }
    window.updateCartFinalTotal();
};

window.calcCartMileage = function(input) {
    // 사용자 입력은 현지 통화 기준
    let localVal = parseFloat(input.value) || 0;
    const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
    const limitLocal = Math.floor((window._cartMileageLimitMax || 0) * mileRate);

    if (localVal > limitLocal) {
        showToast(window.t('msg_mileage_limit', 'Mileage can be used up to 5% of purchase amount.'), 'warn');
        localVal = limitLocal;
        input.value = localVal;
    }
    window.updateCartFinalTotal();
};

window.applyCartMaxMileage = function() {
    const input = document.getElementById('cartUseMileage');
    if (input) {
        const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
        input.value = Math.floor((window._cartMileageLimitMax || 0) * mileRate);
        window.updateCartFinalTotal();
    }
};

window.updateCartFinalTotal = function() {
    const cartTotalKRW = calculateCartTotalKRW();
    const gradeDiscount = Math.floor(cartTotalKRW * currentUserDiscountRate);
    const referralDiscount = window.verifiedReferrerId ? Math.floor(cartTotalKRW * 0.05) : 0;
    const afterDiscountKRW = cartTotalKRW - gradeDiscount - referralDiscount;

    // 배송비 포함 (견적서 배송비 또는 비수도권 배송비)
    let shippingKRW = window._nonMetroFeeApplied || 0;
    if (!shippingKRW) {
        try {
            const shData = JSON.parse(localStorage.getItem('chameleon_quote_shipping') || '{}');
            if (shData.ts && (Date.now() - shData.ts < 86400000) && shData.fee > 0) shippingKRW = shData.fee;
        } catch(e) {}
    }

    // 입력값(현지 통화)을 KRW로 역환산
    const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
    const mileInput = document.getElementById('cartUseMileage');
    const localMileageVal = mileInput ? (parseFloat(mileInput.value) || 0) : 0;
    const usedMileageKRW = mileRate > 0 ? Math.round(localMileageVal / mileRate) : 0;
    const finalTotalKRW = afterDiscountKRW + shippingKRW - usedMileageKRW;

    const finalRow = document.getElementById('cartFinalRow');
    const finalEl = document.getElementById('cartFinalTotal');
    if (finalRow && finalEl) {
        if (localMileageVal > 0) {
            finalRow.style.display = 'flex';
            finalEl.innerText = formatCurrency(finalTotalKRW);
        } else {
            finalRow.style.display = 'none';
        }
    }
};

// ★ 장바구니 배송비 추가/삭제
window._addCartShipping = function(fee, label) {
    const shData = { fee, label, ts: Date.now(), shipping_region: 'province', wants_install: fee >= 700000 };
    localStorage.setItem('chameleon_quote_shipping', JSON.stringify(shData));
    window._nonMetroFeeApplied = fee;
    if (window.renderCart) window.renderCart();
};
window._removeCartShipping = function() {
    localStorage.removeItem('chameleon_quote_shipping');
    window._nonMetroFeeApplied = 0;
    if (window.renderCart) window.renderCart();
};

// 장바구니 마일리지 값을 KRW로 반환하는 헬퍼
window.getCartMileageKRW = function() {
    const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
    const mileInput = document.getElementById('cartUseMileage');
    const localVal = mileInput ? (parseFloat(mileInput.value) || 0) : 0;
    return mileRate > 0 ? Math.round(localVal / mileRate) : 0;
};