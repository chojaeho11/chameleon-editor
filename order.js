import { canvas } from "./canvas-core.js?v=123";
import { PRODUCT_DB, ADDON_DB, ADDON_CAT_DB, cartData, currentUser, sb } from "./config.js?v=123";
import { SITE_CONFIG } from "./site-config.js?v=123";
import { applySize } from "./canvas-size.js?v=123";
import { pageDataList, currentPageIndex } from "./canvas-pages.js?v=123";
import {
    generateOrderSheetPDF,
    generateQuotationPDF,
    generateProductVectorPDF,
    generateRasterPDF,
    generateReceiptPDF,
    generateTransactionStatementPDF
} from "./export.js?v=123";

// [안전장치] 번역 함수가 없으면 기본값 반환
window.t = window.t || function(key, def) { return def || key; };

// [안전장치] 타임아웃 래퍼 — Promise가 ms 이내에 resolve되지 않으면 fallback 반환
function withTimeout(promise, ms, fallback = null) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => {
            console.warn(`[타임아웃] ${ms}ms 초과 — fallback 반환`);
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
const CURRENT_LANG = (urlParams.get('lang') || 'kr').toLowerCase();

// ============================================================
// [1] 헬퍼 함수 (유틸리티)
// ============================================================
function formatCurrency(amount) {
    const num = Number(amount) || 0;
    const country = SITE_CONFIG.COUNTRY;
    const rate = SITE_CONFIG.CURRENCY_RATE?.[country] || 1;
    const converted = num * rate;

    if (country === 'JP') return '¥' + Math.floor(converted).toLocaleString();
    if (country === 'US') return '$' + Math.round(converted).toLocaleString();
    if (country === 'CN') return '¥' + Math.round(converted).toLocaleString();
    if (country === 'AR') return Math.round(converted).toLocaleString() + ' ﷼';
    if (country === 'ES') return '€' + converted.toFixed(2);
    if (country === 'DE') return '€' + converted.toFixed(2);
    if (country === 'FR') return '€' + converted.toFixed(2);
    return converted.toLocaleString() + '원';
}
window.formatCurrency = formatCurrency;

// 국가별 상품명 표시
function localName(product) {
    const c = SITE_CONFIG.COUNTRY;
    if (c === 'JP') return product.name_jp || product.name || '';
    if (c === 'US') return product.name_us || product.name || '';
    if (c === 'CN' || c === 'AR' || c === 'ES' || c === 'DE' || c === 'FR') return product.name_us || product.name || '';
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

// 파일 업로드 헬퍼
async function uploadFileToSupabase(file, folder) {
    if (!sb) return null;
    const timestamp = Date.now();
    const ext = file.name ? file.name.split('.').pop() : 'jpg';
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeName = `${timestamp}_${randomStr}.${ext}`;
    const filePath = `${folder}/${safeName}`;
    
    const { data, error } = await sb.storage.from('orders').upload(filePath, file);
    if (error) { 
        console.error("업로드 에러:", error); 
        return null; 
    }
    const { data: publicData } = sb.storage.from('orders').getPublicUrl(filePath);
    return publicData.publicUrl;
}

// [추가] 장바구니 로드 함수
function loadCartFromStorage() {
    try {
        const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
        const savedCart = localStorage.getItem(storageKey);
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
        const { data: topCats } = await sb.from('admin_top_categories').select('code').eq('is_excluded', true);
        if (topCats && topCats.length > 0) {
            const topCodes = topCats.map(c => c.code);
            const { data: subCats } = await sb.from('admin_categories').select('code').in('top_category_code', topCodes);
            
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

        if (isEditorOpen) {
            // 에디터에서 작업 중 → 바로 장바구니에 담기
            addCanvasToCart();
        } else {
            // 시작 화면 → 장바구니 바로가기
            loadCartFromStorage();
            renderCart();
            document.getElementById('cartPage').style.display = 'block';
        }
    };

    // addCanvasToCart를 외부에서도 접근 가능하게
    window.addCanvasToCart = addCanvasToCart;

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

            // 배송 옵션 필수 체크 (묶음배송: 전체 상품 중 1개라도 배송옵션 선택되면 OK)
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
                    // 모든 언어 이름을 합쳐서 검사 (어느 사이트든 동일하게 감지)
                    const allNames = [catInfo.name_kr, catInfo.name_jp, catInfo.name_us, catInfo.name_cn, catInfo.name_ar, catInfo.name_es, catInfo.display_name, catInfo.code].filter(Boolean).join(' ').toLowerCase();
                    const isShipping = shippingKeywords.some(kw => allNames.includes(kw.toLowerCase()));
                    if (!isShipping) continue;

                    hasShippingCategory = true;
                    const catAddonCodes = allAddons.filter(a => a.category_code === cat).map(a => a.code);
                    const selectedCodes = Object.values(item.selectedAddons || {});
                    if (catAddonCodes.some(c => selectedCodes.includes(c))) {
                        hasAnyShippingSelected = true;
                    }
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
                const info = { 
                    manager: currentUser?.user_metadata?.full_name || window.t('default_customer') || 'Customer',
                    phone: currentUser?.user_metadata?.phone || '-', 
                    address: '-', 
                    note: '', 
                    date: new Date().toLocaleDateString() 
                };
                const blob = await generateQuotationPDF(info, cartData);
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
            if (e.target.value === 'bank') {
                if(bankBox) bankBox.style.display = 'block';
                document.getElementById('btnFinalPay').innerText = window.t('btn_complete_order') || "Complete Order";
            } else {
                if(bankBox) bankBox.style.display = 'none';
                document.getElementById('btnFinalPay').innerText = window.t('btn_pay_now') || "Pay Now";
            }
        });
    });

    window.handleFinalPayment = processFinalPayment;

    const btnDownSheet = document.getElementById("btnDownOrderSheetCheckout");
    const btnDownQuote = document.getElementById("btnDownQuotationCheckout");

    if(btnDownSheet) {
        btnDownSheet.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_no_data', "No data available."), "warn"); return; }
            const info = getOrderInfo();
            if(window.currentDbId) info.id = window.currentDbId;
            try {
                const blob = await generateOrderSheetPDF(info, cartData);
                if(blob) downloadBlob(blob, `order_sheet_${info.manager}.pdf`);
            } catch(e) { console.error(e); showToast(window.t('msg_pdf_gen_failed', "PDF generation failed"), "error"); }
        };
    }
    if(btnDownQuote) {
        btnDownQuote.onclick = async () => {
            if(cartData.length === 0) { showToast(window.t('msg_no_data', "No data available."), "warn"); return; }
            const info = getOrderInfo();
            const mileageInput = document.getElementById('inputUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateQuotationPDF(info, cartData, currentUserDiscountRate, useMileage);
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

            const mileageInput = document.getElementById('inputUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateReceiptPDF(info, cartData, currentUserDiscountRate, useMileage);
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

            const mileageInput = document.getElementById('inputUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateTransactionStatementPDF(info, cartData, currentUserDiscountRate, useMileage);
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
    return {
        manager: document.getElementById("orderName").value || window.t('default_customer', "Customer"),
        phone: document.getElementById("orderPhone").value || "",
        address: document.getElementById("orderAddr").value || "",
        note: document.getElementById("orderMemo").value || "",
        date: selectedDeliveryDate || new Date().toISOString().split('T')[0]
    };
}

// ============================================================
// [3] 달력 및 배송 정보 모달
// ============================================================
let currentCalDate = new Date();

function openCalendarModal() {
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
    
    const days = CURRENT_LANG === 'kr' ? ['일','월','화','수','목','금','토'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    days.forEach(d => grid.innerHTML += `<div class="cal-day-header">${d}</div>`);
    
    const firstDay = new Date(year, month, 1).getDay(); 
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
    
    let minDate = new Date(); 
    let count = 0; 
    while(count < 3) { 
        minDate.setDate(minDate.getDate() + 1); 
        if(minDate.getDay() !== 0 && minDate.getDay() !== 6) count++; 
    }
    
    for(let i=1; i<=lastDate; i++) {
        const dateObj = new Date(year, month, i); 
        const div = document.createElement("div"); 
        div.className = "cal-day"; 
        div.innerText = i;
        
        const checkDate = new Date(dateObj); 
        checkDate.setHours(0,0,0,0); 
        const limitDate = new Date(minDate); 
        limitDate.setHours(0,0,0,0);
        
        if(checkDate < limitDate || dateObj.getDay() === 0 || dateObj.getDay() === 6) { 
            div.classList.add("disabled"); 
        } else { 
            div.onclick = () => { 
                document.querySelectorAll(".cal-day").forEach(d => d.classList.remove("selected")); 
                div.classList.add("selected"); 
                selectedDeliveryDate = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`; 
                openDeliveryInfoModal(); 
            }; 
        }
        grid.appendChild(div);
    }
}

function openDeliveryInfoModal() { 
    document.getElementById("calendarModal").style.display = "none"; 
    document.getElementById("deliveryInfoModal").style.display = "flex"; 
}

// [수정] 용량 초과 방지: 잘못된 이미지 데이터 자동 청소
function saveCart() { 
    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';

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
export function openProductDetail(key, w, h, mode) {
    let product = PRODUCT_DB[key]; 
    if (!product) { product = { name: key, price: 0, img: '', addons: [] }; }
    
    currentTargetProduct = { key, w, h, mode, info: product };
    
    document.getElementById("pdpTitle").innerText = localName(product);
    document.getElementById("pdpPrice").innerText = formatCurrency(product.price);
    
    const imgElem = document.getElementById("pdpImage"); 
    if(imgElem) imgElem.src = product.img || 'https://placehold.co/400';
    
    document.getElementById("productDetailModal").style.display = "flex";
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
            setTimeout(() => { 
                if (window.loadProductFixedTemplate) window.loadProductFixedTemplate(data[0].data_url); 
            }, 500);
        }
    } catch (e) { console.error("템플릿 로드 오류:", e); }
}

// [수정됨] 장바구니 담기 (용량 초과 방지: JSON 클라우드 업로드)
async function addCanvasToCart() {
    if (window.isDirectCartAddInProgress) return;
    if (!canvas) return;
    
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
            const { data: prodData, error } = await sb.from('admin_products').select('code, name, name_jp, name_us, price, price_jp, price_us, img_url, width_mm, height_mm, addons, category').eq('code', key).maybeSingle();
            
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

    // ★ [핵심] 벡터 PDF 우선 (텍스트→패스 변환, 효과 그룹 Z-order 유지)
    let designPdfUrl = null;
    try {
        let pdfPages = [json];
        if (typeof pageDataList !== 'undefined' && pageDataList.length > 0) {
            pdfPages = [...pageDataList];
            if (typeof currentPageIndex !== 'undefined' && currentPageIndex >= 0) {
                pdfPages[currentPageIndex] = json;
            }
        }
        // 1차: 벡터 PDF
        let pdfBlob = await generateProductVectorPDF(pdfPages, finalW, finalH, boardX, boardY);
        // 2차: 벡터 실패 시 래스터 폴백
        if (!pdfBlob || pdfBlob.size < 1000) {
            pdfBlob = await generateRasterPDF(pdfPages, finalW, finalH, boardX, boardY);
        }
        if (pdfBlob && pdfBlob.size > 500) {
            designPdfUrl = await uploadFileToSupabase(pdfBlob, 'cart_pdf');
        }
    } catch(e) {
        console.warn("사전 PDF 생성 실패:", e);
    }

    // ★ 박스 배치도 PDF 생성 + 업로드
    let boxLayoutPdfUrl = null;
    if (window.__boxMode && window.__boxNesting && window.__boxDims) {
        try {
            const { generateBoxLayoutPDF } = await import('./export.js?v=123');
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

    let calcProduct = { ...product };

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
    } else if (product.is_custom_size) {
        // 이미 계산된 가격이 있고, 사이즈가 일치하면 유지
        if (product._calculated_price && product.price > 0 && Math.abs((product.w_mm || 0) - currentMmW) < 5) {
        } else {
            // 제품 실제 회배 단가(price)로 면적 계산
            const sqmPrice = product._base_sqm_price || product.price || 50000;
            const area_m2 = (currentMmW / 1000) * (currentMmH / 1000);
            let calcPrice = Math.round((area_m2 * sqmPrice) / 10) * 10;
            if (calcPrice < 100) calcPrice = sqmPrice; // 최소 단가 = 기본 단가
            calcProduct.price = calcPrice;
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
    if (typeof pageDataList !== 'undefined' && pageDataList.length > 0) {
        finalPages = [...pageDataList];
        if (typeof currentPageIndex !== 'undefined' && currentPageIndex >= 0 && currentPageIndex < finalPages.length) {
            finalPages[currentPageIndex] = json;
        } else {
            if(finalPages.length === 0) finalPages = [json];
        }
    }

    const recoveredAddons = {};
    const recoveredAddonQtys = {};

    if (window.pendingSelectedAddons && window.pendingSelectedAddons.length > 0) {
        const savedQtys = window.pendingSelectedAddonQtys || {};
        window.pendingSelectedAddons.forEach(code => {
            recoveredAddons[`opt_${code}`] = code;
            recoveredAddonQtys[code] = savedQtys[code] || 1;
        });
    }

    // ★ 가벽 3D 액세서리 → 장바구니 addon 자동 연동
    if (window.__wallMode && window.__wallAccessories) {
        const _ADDON_MAP = { cornerPillar: 'For', topLight: '87545', outdoorStand: 'b0001' };
        const _counts = (window.__wallConfig && window.__wallConfig.accessoryCounts) || {};
        Object.entries(window.__wallAccessories).forEach(([key, enabled]) => {
            const code = _ADDON_MAP[key];
            if (!code) return;
            if (enabled) {
                recoveredAddons['opt_' + code] = code;
                recoveredAddonQtys[code] = _counts[key] || 1;
            } else {
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
            const jsonStr = JSON.stringify({ main: json, pages: (typeof pageDataList !== 'undefined' ? pageDataList : []) });
            const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
            // 'cart_json' 폴더에 업로드하여 로컬 스토리지 점유율을 0에 가깝게 만듭니다.
            savedJsonUrl = await uploadFileToSupabase(jsonBlob, 'cart_json');
        } catch (err) {
            console.error("JSON 업로드 필수 실패:", err);
            showToast(window.t('msg_design_save_failed', "Failed to save design data. Please check your internet connection."), "error"); return;
        }
    }

    const newItem = { 
        uid: Date.now() + Math.random().toString(36).substr(2, 5), 
        product: calcProduct,
        type: 'design',
        thumb: thumbUrl, 
        json: null,      // 로컬에는 거대 데이터를 저장하지 않음
        pages: [],       // 로컬에는 거대 데이터를 저장하지 않음
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
    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
    let currentCartList = [];
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) currentCartList = JSON.parse(saved);
        if (!Array.isArray(currentCartList)) currentCartList = [];
    } catch(e) { currentCartList = []; }

    // 2. 리스트에 추가 또는 기존 아이템 업데이트 (다시 편집 시)
    if (typeof window.editingCartItemIdx === 'number' && window.editingCartItemIdx >= 0 && window.editingCartItemIdx < currentCartList.length) {
        // 기존 아이템의 수량/옵션/가격 보존하면서 디자인 데이터만 교체
        const oldItem = currentCartList[window.editingCartItemIdx];
        newItem.qty = oldItem.qty || newItem.qty;
        newItem.selectedAddons = oldItem.selectedAddons || newItem.selectedAddons;
        newItem.addonQuantities = oldItem.addonQuantities || newItem.addonQuantities;
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

        cartData.push({ 
            uid: Date.now(), 
            product: currentTargetProduct.info, 
            type: 'file', 
            fileName: file.name, 
            mimeType: file.type, 
            fileData: null, 
            originalUrl: originalUrl, 
            thumb: thumbUrl, 
            isOpen: true, 
            qty: 1, 
            selectedAddons: {}, 
            addonQuantities: {} 
        });
        
        saveCart(); 
        document.getElementById("productDetailModal").style.display = "none"; 
        renderCart(); 
        showToast(window.t('msg_file_added_to_cart') || "File order added to cart.", "success");
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
        
        let baseProductTotal = (item.product.price || 0) * item.qty;
        let optionTotal = 0;
        
        Object.values(item.selectedAddons).forEach(code => {
            const addon = ADDON_DB[code];
            if (addon) {
                const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
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
// 1. 에디터 작업물인 경우 (업로드된 썸네일 URL이 있는 경우만)
if (item.type === 'design' && item.thumb && item.thumb.startsWith('http')) {
    displayImg = item.thumb;
} 
// 2. 일반 제품이거나 썸네일이 없는 경우, 제품 DB의 이미지 URL을 직접 참조
else if (item.product && item.product.img && item.product.img.startsWith('http')) {
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

        let addonHtml = '';
        if (item.product.addons) {
            const addonCodes = Array.isArray(item.product.addons) ? item.product.addons : (item.product.addons.split(',') || []);
            const allAddons = addonCodes.map(c => ({ code: c.trim(), ...ADDON_DB[c.trim()] })).filter(a => a.name);
            const categories = [...new Set(allAddons.map(a => a.category_code || '_default'))];

            if(categories.length > 0 && allAddons.length > 0) {
                categories.forEach(cat => {
                    const catAddons = allAddons.filter(a => (a.category_code || '_default') === cat);
                    const catInfo = ADDON_CAT_DB[cat];
                    const catDisplayName = catInfo ? catInfo.display_name : (cat === '_default' ? window.t('label_options', 'Options') : cat);
                    addonHtml += `
                        <div style="margin-bottom:12px;">
                            <div style="font-size:11px; font-weight:800; color:#6366f1; margin-bottom:5px; opacity:0.8;"># ${catDisplayName}</div>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                ${catAddons.map(opt => {
                                    const isSelected = Object.values(item.selectedAddons).includes(opt.code);
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
                                                
                                                ${isSelected && opt.is_swatch !== true ? `
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
                            </div>
                        </div>
                    `;
                });
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
                        <div style="font-size:13px; color:#64748b; margin-top:5px;">${item.fileName ? item.fileName : window.t('msg_file_attached_separately', '(File attached separately)')}</div>
                        <div style="font-size:12px; color:#94a3b8; margin-top:5px;">${window.t('label_unit_price', 'Unit Price')}: ${formatCurrency(item.product.price)}</div>
                        ${item.type === 'design' && item.jsonUrl ? `<button onclick="event.stopPropagation(); window.reEditCartItem(${idx})" style="margin-top:8px; border:1px solid #6366f1; background:#f5f3ff; color:#6366f1; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700;"><i class="fa-solid fa-pen-to-square"></i> ${window.t('btn_re_edit', '다시 편집하기')}</button>` : ''}
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
                    <div style="display:flex; gap:12px; border-bottom:1px solid #f1f5f9; padding-bottom:15px; align-items:center;">
                        <img src="${displayImg}" loading="lazy" style="width:80px; height:80px; object-fit:contain; border:1px solid #eee; border-radius:8px; background:#fff;" onerror="this.src='https://placehold.co/100?text=No+Image'">
                        <div style="flex:1;">
                            <h4 style="margin:0; font-size:15px; color:#1e293b; font-weight:800; line-height:1.3;">${localName(item.product)}</h4>
                            <div style="font-size:14px; font-weight:900; color:#1e1b4b; margin-top:8px;">${window.t('label_subtotal', 'Total')}: ${formatCurrency(totalItemPrice)}</div>
                            ${item.type === 'design' && item.jsonUrl ? `<button onclick="event.stopPropagation(); window.reEditCartItem(${idx})" style="margin-top:6px; border:1px solid #6366f1; background:#f5f3ff; color:#6366f1; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700;"><i class="fa-solid fa-pen-to-square"></i> ${window.t('btn_re_edit', '다시 편집하기')}</button>` : ''}
                        </div>
                        <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444; font-size:20px; padding:10px;"><i class="fa-solid fa-trash-can"></i></button>
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
            let itemTotal = unitPrice * qty; 
            
            if (item.selectedAddons) {
                Object.values(item.selectedAddons).forEach(code => {
                    const db = typeof ADDON_DB !== 'undefined' ? ADDON_DB : (window.ADDON_DB || {});
                    const addon = db[code];
                    if (addon) itemTotal += addon.price * (item.addonQuantities[code] || 1);
                });
            }
            discountableAmount += itemTotal;
        }
    });

    const discountAmount = Math.floor(discountableAmount * currentUserDiscountRate);
    const finalTotal = total - discountAmount;
    
    window.finalPaymentAmount = finalTotal; 
    finalPaymentAmount = finalTotal;

    if (typeof currentUser !== 'undefined' && currentUser) {
        const elOwn = document.getElementById('userOwnMileage');
        const myMileage = elOwn ? parseInt(elOwn.innerText.replace(/[^0-9]/g, '')) || 0 : 0;
        
        let realLimit = 0;
        if (discountableAmount > 0) {
            const fivePercent = Math.floor((discountableAmount - discountAmount) * 0.05);
            realLimit = Math.min(myMileage, fivePercent);
        }
        
        window.mileageLimitMax = realLimit; // KRW 기준 저장

        // 표시용 환산
        const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
        const limitLocal = realLimit * mileRate;

        const limitDisp = document.getElementById('mileageLimitDisplay');
        if(limitDisp) limitDisp.innerText = formatCurrency(realLimit).replace(/[원¥$]/g, '').trim() + ' P';

        const mileInput = document.getElementById('inputUseMileage');
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
        if(discountAmount > 0) elDiscount.innerText = `-${formatCurrency(discountAmount)} (${(currentUserDiscountRate*100).toFixed(0)}%)`;
        else elDiscount.innerText = formatCurrency(0) + " (0%)";
    }
    const elTotal = document.getElementById("summaryTotal"); if(elTotal) elTotal.innerText = formatCurrency(finalTotal); 
    const cartCount = document.getElementById("cartCount"); if(cartCount) cartCount.innerText = `(${cartData.length})`; 
    const btnCart = document.getElementById("btnViewCart"); if (btnCart) btnCart.style.display = (cartData.length > 0 || (typeof currentUser !== 'undefined' && currentUser)) ? "inline-flex" : "none"; 
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
    } else {
        if (status) { status.innerHTML = '❌ ' + window.t('referral_not_found', '존재하지 않는 이메일입니다.'); status.style.color = '#dc2626'; }
        window.verifiedReferrerId = null;
        window.verifiedReferrerEmail = null;
        if (notice) notice.style.display = 'none';
    }
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

        const bonusAmount = Math.floor(order.total_amount * 0.1);
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

    window.tempOrderInfo = {
        manager,
        phone,
        address,
        request,
        deliveryDate,
        referrerId: window.verifiedReferrerId || null,
        referrerEmail: window.verifiedReferrerEmail || null
    };

    let rawTotal = 0;
    cartData.forEach(item => {
        if (!item.product) return;
        const unitPrice = item.product.price || 0;
        const qty = item.qty || 1;
        let optionTotal = 0;
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const addon = ADDON_DB[code];
                const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
                if(addon) optionTotal += addon.price * aq;
            });
        }
        rawTotal += (unitPrice * qty) + optionTotal;
    });

    const discountAmt = Math.floor(rawTotal * currentUserDiscountRate);
    const finalTotal = rawTotal - discountAmt;
    
    window.originalPayAmount = finalTotal; 
    window.finalPaymentAmount = finalTotal; 

    document.getElementById("deliveryInfoModal").style.display = "none"; 
    const checkoutModal = document.getElementById("checkoutModal");
    checkoutModal.style.display = "flex";
    
    document.getElementById("orderName").value = manager; 
    document.getElementById("orderPhone").value = phone; 
    document.getElementById("orderAddr").value = address;
    document.getElementById("orderMemo").value = request;

    // 추천인 정보 표시
    const refInfoEl = document.getElementById('checkoutReferralInfo');
    const refEmailEl = document.getElementById('checkoutReferrerEmail');
    if (refInfoEl) {
        if (window.verifiedReferrerId && window.verifiedReferrerEmail) {
            refInfoEl.style.display = 'block';
            if (refEmailEl) refEmailEl.textContent = window.verifiedReferrerEmail;
        } else {
            refInfoEl.style.display = 'none';
        }
    }

    if (currentUser) {
        const { data: profile } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
        const myMileage = profile ? (profile.mileage || 0) : 0;
        
        const fivePercent = Math.floor(finalTotal * 0.05);
        const realLimit = Math.min(myMileage, fivePercent);

        window.mileageLimitMax = realLimit; 
        
        document.getElementById('userOwnMileage').innerText = formatCurrency(myMileage).replace(/[원¥$]/g, '').trim() + ' P';
        document.getElementById('mileageLimitDisplay').innerText = formatCurrency(realLimit).replace(/[원¥$]/g, '').trim() + ' P';
        document.getElementById('inputUseMileage').value = '';
        document.getElementById('inputUseMileage').placeholder = `${window.t('label_max', 'Max')} ${formatCurrency(realLimit).replace(/[원¥$]/g, '').trim()}`;
        document.getElementById('finalPayAmountDisplay').innerText = formatCurrency(finalTotal);

        document.getElementById('btnFinalPay').innerText = `${formatCurrency(finalTotal)} ${window.t('btn_pay', 'Pay')}`;
    } else {
        window.mileageLimitMax = 0;
        document.getElementById('userOwnMileage').innerText = '-';
        document.getElementById('mileageLimitDisplay').innerText = '0 P';
        document.getElementById('finalPayAmountDisplay').innerText = formatCurrency(finalTotal);
        document.getElementById('btnFinalPay').innerText = `${formatCurrency(finalTotal)} ${window.t('btn_pay', 'Pay')}`;
    }

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
                const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
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
                img: item.product.img 
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
            originalUrl: item.originalUrl || ''
        };
    }).filter(i => i !== null);

    // [핵심] 3중 사이트 코드 결정:
    // 1순위: HTML 인라인 스크립트 (CDN 캐시 불가)
    // 2순위: SITE_CONFIG 모듈
    // 3순위: hostname 직접 체크 (폴백)
    const _hostname = window.location.hostname;
    const _fromHTML = window.__SITE_CODE;
    const _fromConfig = SITE_CONFIG?.COUNTRY;
    const _fromHostname = _hostname.includes('cafe0101') ? 'JP' : _hostname.includes('cafe3355') ? 'US' : 'KR';
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
        manager_name: manager,
        phone,
        address,
        request_note: finalRequestNote,
        status: '임시작성',
        payment_status: '미결제',
        total_amount: finalPayAmount,
        discount_amount: useMileage,
        items: itemsToSave,
        site_code: _siteCode
    }]).select();
    
    if (orderError) throw orderError; 
    
    const newOrderId = orderData[0].id;
    window.currentDbId = newOrderId; 

    let uploadedFiles = [];
    
    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i]; 
        const idx = String(i + 1).padStart(2, '0');
        if (item.originalUrl) {
            uploadedFiles.push({ 
                name: `customer_file_${idx}_${item.fileName || 'file'}`,
                url: item.originalUrl, 
                type: 'customer_file' 
            });
        }
    }
    
    const orderInfoForPDF = { 
        id: newOrderId, 
        manager, phone, address, note: request, date: deliveryDate 
    };
    
    // [모바일 감지] 모바일에서는 타임아웃을 짧게 설정
    const isMobile = window.innerWidth <= 768;
    const PDF_TIMEOUT = isMobile ? 30000 : 60000;
    const UPLOAD_TIMEOUT = 20000;

    try {
        loading.querySelector('p').innerText = window.t('msg_generating_docs', "Generating documents...");
        const orderSheetBlob = await withTimeout(generateOrderSheetPDF(orderInfoForPDF, cartData), PDF_TIMEOUT);
        if(orderSheetBlob) {
            const url = await withTimeout(uploadFileToSupabase(orderSheetBlob, `orders/${newOrderId}/order_sheet.pdf`), UPLOAD_TIMEOUT);
            if(url) uploadedFiles.push({ name: `order_sheet.pdf`, url: url, type: 'order_sheet' });
        }

        const quoteBlob = await withTimeout(generateQuotationPDF(orderInfoForPDF, cartData, currentUserDiscountRate, useMileage), PDF_TIMEOUT);

        if(quoteBlob) {
            const url = await withTimeout(uploadFileToSupabase(quoteBlob, `orders/${newOrderId}/quotation.pdf`), UPLOAD_TIMEOUT);
            if(url) uploadedFiles.push({ name: `quotation.pdf`, url: url, type: 'quotation' });
        }
    } catch(pdfErr) { console.warn("문서 생성 오류:", pdfErr); }

    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i];
        const idx = String(i + 1).padStart(2, '0');

        // ★ [1순위] 사전 생성된 PDF가 있으면 그대로 사용 (라이브 캔버스에서 생성한 것)
        if (item.designPdfUrl && item.type === 'design') {
            loading.querySelector('p').innerText = `${window.t('msg_converting_design', "Converting design...")} (${i+1}/${cartData.length})`;
            try {
                const res = await withTimeout(fetch(item.designPdfUrl), PDF_TIMEOUT);
                if (res.ok) {
                    const pdfBlob = await res.blob();
                    const url = await withTimeout(uploadFileToSupabase(pdfBlob, `orders/${newOrderId}/design_${idx}.pdf`), UPLOAD_TIMEOUT);
                    if (url) uploadedFiles.push({ name: `product_${idx}_${item.product?.name || 'design'}.pdf`, url: url, type: 'product' });
                }
            } catch(err) { console.warn("사전생성 PDF 전송 실패:", err); }

            // ★ 박스 배치도 PDF 업로드
            if (item.boxLayoutPdfUrl) {
                try {
                    const layoutRes = await withTimeout(fetch(item.boxLayoutPdfUrl), PDF_TIMEOUT);
                    if (layoutRes.ok) {
                        const layoutBlob = await layoutRes.blob();
                        const layoutUrl = await withTimeout(uploadFileToSupabase(layoutBlob, `orders/${newOrderId}/box_layout_${idx}.pdf`), UPLOAD_TIMEOUT);
                        if (layoutUrl) uploadedFiles.push({ name: `box_layout_${idx}_${item.product?.name || 'layout'}.pdf`, url: layoutUrl, type: 'box_layout' });
                    }
                } catch(err) { console.warn("박스 배치도 PDF 전송 실패:", err); }
            }

            continue;
        }

        // ★ [2순위] 사전 PDF 없으면 기존 방식으로 재생성
        if (!item.originalUrl && item.type === 'design' && item.json && item.product) {
            let hasContent = false;
            if (item.json.objects && Array.isArray(item.json.objects)) {
                const validObjects = item.json.objects.filter(obj => !obj.isBoard);
                if (validObjects.length > 0) hasContent = true;
            }
            if (!hasContent) continue;

            loading.querySelector('p').innerText = `${window.t('msg_converting_design', "Converting design...")} (${i+1}/${cartData.length})`;
            try {
                const targetPages = (item.pages && item.pages.length > 0) ? item.pages : [item.json];
                let fileBlob = await withTimeout(generateProductVectorPDF(targetPages, item.width, item.height, item.boardX || 0, item.boardY || 0), PDF_TIMEOUT);
                if (!fileBlob || fileBlob.size < 5000) {
                    fileBlob = await withTimeout(generateRasterPDF(targetPages, item.width, item.height, item.boardX || 0, item.boardY || 0), PDF_TIMEOUT);
                }

                if(fileBlob) {
                    const url = await withTimeout(uploadFileToSupabase(fileBlob, `orders/${newOrderId}/design_${idx}.pdf`), UPLOAD_TIMEOUT);
                    if(url) uploadedFiles.push({ name: `product_${idx}_${item.product.name}.pdf`, url: url, type: 'product' });
                }
            } catch(err) { console.warn("디자인 변환 실패:", err); }
        }
    }

    if (uploadedFiles.length > 0) {
        await sb.from('orders').update({ files: uploadedFiles }).eq('id', newOrderId);
    }

    // [파트너 마켓플레이스] 파트너 상품이 포함된 경우 partner_settlements 생성
    try {
        const partnerItems = itemsToSave.filter(i => i.product?.partner_id);
        if (partnerItems.length > 0) {
            await sb.from('orders').update({ has_partner_items: true }).eq('id', newOrderId);
            for (const item of partnerItems) {
                const amt = (item.price || 0) * (item.qty || 1);
                const comm = Math.floor(amt * 0.10);
                await sb.from('partner_settlements').insert({
                    order_id: newOrderId,
                    partner_id: item.product.partner_id,
                    item_code: item.product.code || 'unknown',
                    item_amount: amt,
                    commission_rate: 10.0,
                    commission_amount: comm,
                    net_amount: amt - comm,
                    settlement_status: 'pending'
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
    if (!window.tempOrderInfo && !window.currentDbId) { showToast(window.t('msg_no_order_info', "No order info. Please try again from the start."), "error"); return; }
    
    const mileageInput = document.getElementById('inputUseMileage');
    const localMileageVal = mileageInput ? (parseFloat(mileageInput.value) || 0) : 0;
    // 역환산: 현지 통화 → KRW
    const payRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
    const useMileage = Math.round(localMileageVal / payRate);
    const baseAmount = window.originalPayAmount || 0;
    const realFinalPayAmount = baseAmount - useMileage;

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
    btn.disabled = true;

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
                        if(ad) optTotal += ad.price * (item.addonQuantities[code] || 1);
                    });
                 }
                 let compatible = Math.floor((unitPrice*qty + optTotal)/qty);
                 return {
                    productName: localName(item.product),
                    qty: qty,
                    price: compatible,
                    product: { name: localName(item.product), price: item.product.price, code: item.product.code||item.product.key, img: item.product.img },
                    selectedAddons: item.selectedAddons,
                    addonQuantities: item.addonQuantities
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
        }
        
        const orderId = window.currentDbId; 

        const selected = document.querySelector('input[name="paymentMethod"]:checked');
        const method = selected ? selected.value : 'card';

        if (method === 'deposit') {
            await processDepositPayment(realFinalPayAmount, useMileage); 
        } else if (method === 'bank') {
            const depositorName = document.getElementById('inputDepositorName').value;
            if (!depositorName) { btn.disabled = false; showToast(window.t('alert_input_depositor', "Please enter depositor name."), "warn"); return; }
            
            if(confirm(window.t('confirm_bank_payment', "Proceed with Bank Transfer?"))) {
                if(useMileage > 0) {
                     const { data: m } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).maybeSingle();
                     await sb.from('profiles').update({ mileage: m.mileage - useMileage }).eq('id', currentUser.id);
                     await sb.from('wallet_logs').insert({ user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용` });
                }

                await sb.from('orders').update({ 
                    status: '접수됨', payment_method: '무통장입금', payment_status: '입금대기', depositor_name: depositorName 
                }).eq('id', orderId);
                
                showToast(window.t('msg_order_complete_bank'), "success");
                location.reload();
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
    const currencyMap = { JP: 'jpy', US: 'usd', CN: 'cny', AR: 'sar', ES: 'eur' };
    const currency = currencyMap[currencyCountry] || 'usd';
    const zeroDec = ['jpy']; // 소수점 없는 통화

    // KRW → 현지 통화 변환 (DB는 KRW 기준 저장)
    const rate = SITE_CONFIG.CURRENCY_RATE[currencyCountry] || 1;
    const localAmount = zeroDec.includes(currency)
        ? Math.round(amount * rate)       // JPY: 정수 (소수점 없음)
        : Math.round(amount * rate * 100) / 100; // USD/CNY/SAR/EUR: 소수 2자리

    // Stripe 최소 결제금액 체크
    const minAmount = zeroDec.includes(currency) ? 100 : 0.50;
    const currSymbol = { jpy: '¥', usd: '$', cny: '¥', sar: '﷼', eur: '€' };
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
window.removeCartItem = function(idx) {
    if (confirm(window.t('confirm_delete', "Delete this item?"))) {
        cartData.splice(idx, 1);
        saveCart();
        renderCart();
    }
};

// ★ 장바구니 아이템 다시 편집하기
window.reEditCartItem = async function(idx) {
    const item = cartData[idx];
    if (!item || !item.jsonUrl) { showToast("편집 데이터를 찾을 수 없습니다.", "error"); return; }

    const loading = document.getElementById("loading");
    if (loading) { loading.style.display = "flex"; loading.querySelector('p').innerText = "디자인 데이터 로딩 중..."; }

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

        // 5. 캔버스에 JSON 로드 (에디터 초기화 대기)
        setTimeout(async () => {
            try {
                // 페이지 데이터 복원
                if (pages.length > 0 && typeof pageDataList !== 'undefined') {
                    pageDataList.length = 0;
                    pages.forEach(p => pageDataList.push(p));
                }
                // 메인 캔버스에 JSON 로드
                canvas.loadFromJSON(mainJson, () => {
                    canvas.renderAll();
                    if (loading) loading.style.display = "none";
                });
            } catch(e) {
                console.error("캔버스 로드 실패:", e);
                if (loading) loading.style.display = "none";
            }
        }, 1500); // 에디터 초기화 대기
    } catch(e) {
        console.error("다시 편집 실패:", e);
        if (loading) loading.style.display = "none";
        showToast("편집 데이터를 불러올 수 없습니다: " + e.message, "error");
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
            
            // 수량이 없으면 1로 초기화
            if (!cartData[idx].addonQuantities[code]) {
                cartData[idx].addonQuantities[code] = 1; 
            }
        } else { 
            // 해제 시: 키값(Prefix)이 'addon_'인지 'opt_'인지 상관없이
            // 해당 옵션 코드를 값으로 가지고 있는 모든 항목을 찾아서 삭제
            const addons = cartData[idx].selectedAddons;
            Object.keys(addons).forEach(key => {
                if (addons[key] === code) {
                    delete addons[key];
                }
            });
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
        saveCart(); 
        renderCart(); 
    }
};

export function addProductToCartDirectly(productInfo, targetQty = 1, addonCodes = [], addonQtys = {}) {
    if (!productInfo) return;

    const now = Date.now();
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

    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
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
if (!productInfo.is_custom) {
    if (SITE_CONFIG.COUNTRY === 'JP' && productInfo.price_jp && _siteRate.JP) {
        finalPrice = Math.round(productInfo.price_jp / _siteRate.JP);
    } else if (SITE_CONFIG.COUNTRY === 'US' && productInfo.price_us && _siteRate.US) {
        finalPrice = Math.round(productInfo.price_us / _siteRate.US);
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
    img: ((productInfo.img || productInfo.img_url) && (productInfo.img || productInfo.img_url).length < 500 && !(productInfo.img || productInfo.img_url).startsWith('data:')) ? (productInfo.img || productInfo.img_url) : null,
    w: productInfo.w || 0,
    h: productInfo.h || 0,
    w_mm: productInfo.w_mm || 0,
    h_mm: productInfo.h_mm || 0,
    category: productInfo.category || '',
    addons: productInfo.addons || [],
    partner_id: productInfo.partner_id || null
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

    currentCartList.push(newItem);

    cartData.length = 0;
    currentCartList.forEach(item => cartData.push(item));

    saveCart(); // 중복 코드를 제거하고 최적화된 saveCart 함수를 사용합니다.
    
    // 만약 saveCart 내부에서 에러가 처리되었더라도, 여기서 UI 렌더링은 진행

    renderCart();
}
window.updateCartQty = function(idx, delta) {
    if (cartData[idx]) { 
        let newQty = (cartData[idx].qty || 1) + delta; 
        if (newQty < 1) newQty = 1; 
        cartData[idx].qty = newQty; 
        saveCart(); 
        renderCart(); 
    }
};
window.updateCartQtyInput = function(idx, val) {
    let newQty = parseInt(val); 
    if (!newQty || newQty < 1) newQty = 1; 
    if (cartData[idx]) { 
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
                    type: 'file',
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
    const input = document.getElementById('inputUseMileage');
    if(input) {
        const mileRate = SITE_CONFIG.CURRENCY_RATE?.[SITE_CONFIG.COUNTRY] || 1;
        input.value = (window.mileageLimitMax || 0) * mileRate;
        window.calcMileageLimit(input);
    }
};