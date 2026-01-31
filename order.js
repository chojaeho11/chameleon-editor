import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js";
import { SITE_CONFIG } from "./site-config.js";
import { applySize } from "./canvas-size.js";
import { pageDataList, currentPageIndex } from "./canvas-pages.js"; // [추가] 페이지 데이터 가져오기
import { 
    generateOrderSheetPDF,
    generateQuotationPDF, 
    generateProductVectorPDF, 
    generateRasterPDF,
    generateReceiptPDF,              // [추가됨]
    generateTransactionStatementPDF  // [추가됨]
} from "./export.js";

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

    if (country === 'JP') {
        return '¥' + Math.floor(num).toLocaleString();
    } else if (country === 'US') {
        return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } else {
        return num.toLocaleString() + '원';
    }
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
        
        const canvas = document.createElement('canvas'); 
        const context = canvas.getContext('2d');
        canvas.height = scaledViewport.height; 
        canvas.width = scaledViewport.width;
        
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
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
                const canvas = document.createElement('canvas'); 
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d'); 
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(resolve, 'image/jpeg', 0.8);
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

// ============================================================
// [2] 주문 시스템 초기화 및 이벤트 바인딩
// ============================================================
// [수정됨] 제외 목록을 'window' 전역 변수에 안전하게 로드
export async function initOrderSystem() {
    await fetchUserDiscountRate(); 
    
    // 1. 제외 목록 불러오기 (window 객체에 저장)
    window.excludedCategoryCodes = new Set(); // 초기화
    try {
        const { data: topCats } = await sb.from('admin_top_categories').select('code').eq('is_excluded', true);
        if (topCats && topCats.length > 0) {
            const topCodes = topCats.map(c => c.code);
            const { data: subCats } = await sb.from('admin_categories').select('code').in('top_category_code', topCodes);
            
            if (subCats) {
                subCats.forEach(sc => window.excludedCategoryCodes.add(sc.code));
                console.log("✅ 제외 목록 로드됨(전역):", Array.from(window.excludedCategoryCodes));
            }
        }
    } catch(e) { console.warn("제외 목록 로드 실패:", e); }

    // 2. UI 설정
    const krForm = document.getElementById("addrFormKR");
    const globalForm = document.getElementById("addrFormGlobal");
    const bankArea = document.getElementById("bankTransferInfoArea");

    if (CURRENT_LANG === 'kr') {
        if(krForm) krForm.style.display = 'block';
        if(globalForm) globalForm.style.display = 'none';
    } else {
        if(krForm) krForm.style.display = 'none';
        if(globalForm) globalForm.style.display = 'flex';
    }

    const btnOrderTop = document.getElementById("btnOrderTop");
    if(btnOrderTop) btnOrderTop.onclick = addCanvasToCart;

    // [신규] 장바구니 열기 버튼(아이콘) 강제 연결
    const btnViewCart = document.getElementById("btnViewCart");
    if (btnViewCart) {
        btnViewCart.onclick = function() {
            document.getElementById("cartPage").style.display = "block";
            // 모바일 메뉴 등에서 겹치지 않게 클래스 제거
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
            if(cartData.length === 0) return alert(window.t('msg_cart_empty', "Your cart is empty.")); 
            openCalendarModal(); 
        }; 
    }

    const btnPrintQuote = document.getElementById("btnPrintQuote");
    if(btnPrintQuote) {
        btnPrintQuote.onclick = async () => {
            if(cartData.length === 0) return alert("상품이 없습니다.");
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
                else alert(window.t('err_quote_gen_failed') || "Failed to generate quotation.");
            } catch(e) {
                console.error(e);
                alert((window.t('err_quote_error') || "Quote Error: ") + e.message);
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
    
    // [UI 이벤트] 결제 수단 라디오 버튼 변경 시 UI 대응
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

    // 전역 함수 연결 (HTML onclick 대응)
    window.handleFinalPayment = processFinalPayment;

    const btnDownSheet = document.getElementById("btnDownOrderSheetCheckout");
    const btnDownQuote = document.getElementById("btnDownQuotationCheckout");

    if(btnDownSheet) {
        btnDownSheet.onclick = async () => {
            if(cartData.length === 0) return alert(window.t('msg_no_data', "No data available."));
            const info = getOrderInfo();
            if(window.currentDbId) info.id = window.currentDbId;
            try {
                const blob = await generateOrderSheetPDF(info, cartData);
                if(blob) downloadBlob(blob, `작업지시서_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("PDF 생성 실패"); }
        };
    }
    if(btnDownQuote) {
        btnDownQuote.onclick = async () => {
            if(cartData.length === 0) return alert("데이터가 없습니다.");
            const info = getOrderInfo();
            
            // [수정] 현재 입력된 마일리지 값 가져오기
            const mileageInput = document.getElementById('inputUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                // [수정] 마일리지 값(useMileage)을 4번째 인자로 전달
                const blob = await generateQuotationPDF(info, cartData, currentUserDiscountRate, useMileage);
                if(blob) downloadBlob(blob, `견적서_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("PDF 생성 실패"); }
        };
    }
    // [추가] 영수증 다운로드 버튼 연결
    const btnReceipt = document.getElementById("btnDownReceipt");
    if(btnReceipt) {
        btnReceipt.onclick = async () => {
            if(cartData.length === 0) return alert("장바구니가 비어있습니다.");
            
            const info = getOrderInfo();
            // 마일리지 사용값 가져오기
            const mileageInput = document.getElementById('inputUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateReceiptPDF(info, cartData, currentUserDiscountRate, useMileage);
                if(blob) downloadBlob(blob, `영수증_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("영수증 생성 실패: " + e.message); }
        };
    }

    // [추가] 거래명세서 다운로드 버튼 연결
    const btnStatement = document.getElementById("btnDownStatement");
    if(btnStatement) {
        btnStatement.onclick = async () => {
            if(cartData.length === 0) return alert("장바구니가 비어있습니다.");
            
            const info = getOrderInfo();
            const mileageInput = document.getElementById('inputUseMileage');
            const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;

            try {
                const blob = await generateTransactionStatementPDF(info, cartData, currentUserDiscountRate, useMileage);
                if(blob) downloadBlob(blob, `거래명세서_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("거래명세서 생성 실패: " + e.message); }
        };
    }
    renderCart(); // 초기 렌더링
}

// 사용자 등급별 할인율 가져오기
async function fetchUserDiscountRate() {
    if (!currentUser) {
        currentUserDiscountRate = 0;
        return;
    }
    try {
        const { data } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
        const role = data?.role;
        
        // [수정] 등급별 할인율 변경 (가맹점 10%, 플레티넘 5%, 골드 3%)
        if (role === 'franchise') currentUserDiscountRate = 0.10; // 10%
        else if (role === 'platinum' || role === 'partner' || role === 'partners') currentUserDiscountRate = 0.05; // 5% (플레티넘/파트너스)
        else if (role === 'gold') currentUserDiscountRate = 0.03; // 3%
        else currentUserDiscountRate = 0;
        
    } catch(e) {
        console.warn("등급 정보 로드 실패:", e);
        currentUserDiscountRate = 0;
    }
}

function getOrderInfo() {
    return {
        manager: document.getElementById("orderName").value || "고객",
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
    document.getElementById("cartPage").style.display = "none"; 
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
    
    const days = ['일','월','화','수','목','금','토'];
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

function saveCart() { 
    try { 
        const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
        const dataStr = JSON.stringify(cartData);
        localStorage.setItem(storageKey, dataStr); 
    } catch(e) { console.warn("장바구니 로컬 저장 실패:", e); } 
}

// ============================================================
// [4] 디자인/파일 장바구니 담기
// ============================================================
export function openProductDetail(key, w, h, mode) {
    let product = PRODUCT_DB[key]; 
    if (!product) { product = { name: key, price: 0, img: '', addons: [] }; }
    
    currentTargetProduct = { key, w, h, mode, info: product };
    
    document.getElementById("pdpTitle").innerText = product.name; 
    document.getElementById("pdpPrice").innerText = formatCurrency(product.price);
    
    const imgElem = document.getElementById("pdpImage"); 
    if(imgElem) imgElem.src = product.img || 'https://placehold.co/400';
    
    document.getElementById("productDetailModal").style.display = "flex";
}

export async function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    
    document.getElementById("productDetailModal").style.display = "none"; 
    
    localStorage.setItem('current_product_key', currentTargetProduct.key);

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

// [수정됨] 장바구니 담기 (상품 정보 누락 시 자동 복구 기능 추가)
async function addCanvasToCart() {
    // [방어 코드 1] 상품 직접 담기 로직이 돌고 있으면 중단
    if (window.isDirectCartAddInProgress) return;

    // [방어 코드 2] ★핵심★ 에디터 화면(mainEditor)이 숨겨져 있다면 저장하지 않음
    const mainEditor = document.getElementById("mainEditor");
// 에디터 화면(mainEditor)이 숨겨져 있다면 (즉, 시작 화면이라면)
if (mainEditor && window.getComputedStyle(mainEditor).display === 'none') {
    
    // 1. 경고창 대신 장바구니 화면을 바로 엽니다.
    const cartPage = document.getElementById('cartPage');
    if (cartPage) {
        cartPage.style.display = 'block';
        
        // 2. 혹시 모를 레이아웃 꼬임 방지를 위해 클래스 제거
        document.body.classList.remove('editor-active');
        
        // 3. 장바구니 데이터 갱신 (안전장치)
        if (typeof renderCart === 'function') renderCart();
    }

    // 4. 캔버스 저장 로직은 실행하지 않고 여기서 함수 종료
    return; 
}

    if (!canvas) return;
    
    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = window.t('msg_processing_design') || "Processing design...";
    }

    const originalVpt = canvas.viewportTransform;
    const board = canvas.getObjects().find(o => o.isBoard);
    let thumbUrl = "https://placehold.co/100?text=Design";
    
    // 1. 썸네일 생성
    // 1. 썸네일 생성 (작업지시서 이미지 복구 로직 포함)
    try {
        let blob = null;
        if (board) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // 뷰포트 초기화
            
            const targetW = board.width * board.scaleX;
            const targetH = board.height * board.scaleY;
            
            // 메모리 보호를 위해 800px 제한
            const maxDimension = 800; 
            let dynamicMultiplier = 1.0;
            const maxSide = Math.max(targetW, targetH);
            
            if (maxSide > maxDimension) {
                dynamicMultiplier = maxDimension / maxSide;
            }

            try {
                // [시도 1] 정상적인 캔버스 캡처 시도
                const dataUrl = canvas.toDataURL({ 
                    format: 'jpeg', left: board.left, top: board.top, 
                    width: targetW, height: targetH, 
                    multiplier: dynamicMultiplier, quality: 0.7 
                });
                blob = await (await fetch(dataUrl)).blob();
            } catch (innerErr) {
                console.warn("캔버스 캡처 차단됨(CORS), 대체 이미지 탐색:", innerErr);
                
                // [시도 2] 캡처가 막혔다면, 캔버스 안에 있는 '이미지 객체'의 원본 URL을 사용
                // 배경 이미지나 가장 큰 이미지를 찾아서 썸네일로 씁니다.
                const objects = canvas.getObjects();
                let mainImgUrl = null;

                // 배경 이미지 확인
                if (canvas.backgroundImage && canvas.backgroundImage.src) {
                    mainImgUrl = canvas.backgroundImage.src;
                }
                // 없으면 객체 중 가장 큰 이미지 찾기
                else {
                    const imgObj = objects.find(o => o.type === 'image');
                    if (imgObj && imgObj.getSrc()) {
                        mainImgUrl = imgObj.getSrc();
                    }
                }

                if (mainImgUrl) {
                    console.log("대체 썸네일 발견:", mainImgUrl);
                    // 원본 URL을 썸네일 주소로 바로 사용 (업로드 불필요)
                    thumbUrl = mainImgUrl; 
                }
            }
            canvas.setViewportTransform(originalVpt); // 뷰포트 복구
        }
        
        // 캡처에 성공하여 blob이 있는 경우에만 업로드 진행
        if (blob) {
             const thumbUrlUpload = await uploadFileToSupabase(blob, 'thumbs');
             if(thumbUrlUpload) thumbUrl = thumbUrlUpload;
        }

    } catch(e) { 
        console.error("썸네일 프로세스 오류:", e); 
        try { canvas.setViewportTransform(originalVpt); } catch(ex){}
    }

    // 2. 상품 정보 확인 (없으면 복구)
    let key = window.currentProductKey || canvas.currentProductKey;
    if (!key) key = localStorage.getItem('current_product_key') || 'A4';

    // ★ [핵심 수정 1] index.html에서 수정한(가격이 확정된) 정보를 최우선으로 가져옵니다.
    // window.PRODUCT_DB에 정보가 있으면 그걸 쓰고, 없으면 모듈 내부의 PRODUCT_DB를 씁니다.
    let product = (window.PRODUCT_DB && window.PRODUCT_DB[key]) ? window.PRODUCT_DB[key] : PRODUCT_DB[key];

    // 정보가 없거나, 커스텀인데 가격이 0원(데이터 유실)인 경우에만 DB에서 다시 가져옵니다.
    if (!product || (product.is_custom_size && product.price === 0)) {
        try {
            console.log(`상품 정보('${key}') 복구 시도...`);
            const { data: prodData, error } = await sb.from('admin_products').select('*').eq('code', key).single();
            
            if (prodData) {
                // config.js의 데이터 구조에 맞춰 변환
                const scaleFactor = 3.7795;
                const pxW = Math.round((prodData.width_mm || 210) * scaleFactor);
                const pxH = Math.round((prodData.height_mm || 297) * scaleFactor);
                
                // 다국어 처리 (SITE_CONFIG 필요, 없으면 KR 기본)
                const country = (typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG.COUNTRY : 'KR');
                let dName = prodData.name;
                let dPrice = prodData.price;
                
                if (country === 'JP') { dName = prodData.name_jp || dName; dPrice = prodData.price_jp || 0; }
                else if (country === 'US') { dName = prodData.name_us || dName; dPrice = prodData.price_us || 0; }

                PRODUCT_DB[key] = {
                    name: dName,
                    price: dPrice,
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

    // ★ [핵심 수정 2] 위에서 정의한 product 변수를 갱신합니다 (여기서 다시 PRODUCT_DB[key]로 덮어쓰면 안됩니다)
    product = (window.PRODUCT_DB && window.PRODUCT_DB[key]) ? window.PRODUCT_DB[key] : PRODUCT_DB[key];
    
    // 그래도 없으면 안전장치
    if (!product) {
        product = { name: '상품 정보 없음', price: 0, img: 'https://placehold.co/100', addons: [] };
    }
    
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst', 'shadow']);
    const finalW = board ? board.width * board.scaleX : (product.w || canvas.width); 
    const finalH = board ? board.height * board.scaleY : (product.h || canvas.height);
    const boardX = board ? board.left : 0;
    const boardY = board ? board.top : 0;

    let calcProduct = { ...product }; 

    const currentMmW = finalW / 3.7795;

    if (product.is_custom_size && product.price > 0 && Math.abs(product.w_mm - currentMmW) < 5) {
         console.log(`[가격 유지] 기존 계산된 가격 사용: ${product.price.toLocaleString()}원`);

    }
    else if (product.is_custom_size) {
        
        // 1-1. 단가 설정 (사장님 환경에 맞게 숫자 수정 필요)
        const sqmPrice = 50000;  // 1제곱미터(헤베)당 가격
        const minPrice = 60000;  // 최소 주문 금액

        // 1-2. mm 단위 및 면적(m2) 계산
        const mmToPx = 3.7795; // Fabric.js 기준 (96DPI)
        const w_mm = finalW / mmToPx;
        const h_mm = finalH / mmToPx;
        const area_m2 = (w_mm / 1000) * (h_mm / 1000); // 가로(m) x 세로(m)

        // 1-3. 가격 계산 (100원 단위 반올림)
        let calcPrice = Math.round((area_m2 * sqmPrice) / 100) * 100;
        
        // 1-4. 최소 금액 적용
        if (calcPrice < minPrice) calcPrice = minPrice;

        // 1-5. 계산된 가격으로 덮어쓰기
        calcProduct.price = calcPrice;
        
        // (옵션) 이름 뒤에 사이즈 표기
        // calcProduct.name = `${product.name} (${Math.round(w_mm)}x${Math.round(h_mm)}mm)`;

        console.log(`[가격계산 적용] ${Math.round(w_mm)}x${Math.round(h_mm)}mm / 면적:${area_m2.toFixed(2)}m2 / 계산가:${calcPrice.toLocaleString()}원`);
    
    } else {
        // 커스텀 제품이 아니면(핫딜 등), 원래 DB 가격을 사용합니다.
        console.log(`[고정가 적용] ${product.name}: ${product.price.toLocaleString()}원`);
    }
    // =================================================================
    let originalFileUrl = null; 
    let fileName = window.t('default_design_name') || "My Design";
    if (window.currentUploadedPdfUrl) {
        originalFileUrl = window.currentUploadedPdfUrl;
        fileName = "Uploaded_Original_PDF.pdf"; 
        window.currentUploadedPdfUrl = null; 
    }

    if(loading) loading.style.display = "none";

    // [중복 방지 2차 체크] 이미지 생성 중에 직접 담기가 실행되었다면 여기서 중단
    if (window.isDirectCartAddInProgress) return;

    // 3. 카트에 담기 (멀티 페이지 데이터 저장)
    // [중요] 현재 화면의 최신 상태를 pageDataList의 해당 인덱스에 업데이트
    let finalPages = [json]; // 기본값: 현재 1장
    
    if (typeof pageDataList !== 'undefined' && pageDataList.length > 0) {
        // 배열 복사
        finalPages = [...pageDataList];
        
        // 현재 보고 있는 페이지가 있다면 최신 상태(json)로 덮어쓰기
        if (typeof currentPageIndex !== 'undefined' && currentPageIndex >= 0 && currentPageIndex < finalPages.length) {
            finalPages[currentPageIndex] = json;
        } else {
            // 인덱스 오류 시 마지막에 추가하거나 현재꺼만 씀
            if(finalPages.length === 0) finalPages = [json];
        }
    }

    // [추가] 에디터 진입 전 선택했던 옵션 정보 복구 로직
    const recoveredAddons = {};
    const recoveredAddonQtys = {};
    
    if (window.pendingSelectedAddons && window.pendingSelectedAddons.length > 0) {
        window.pendingSelectedAddons.forEach(code => {
            recoveredAddons[`opt_${code}`] = code;
            recoveredAddonQtys[code] = 1;
        });
        // 사용 후 초기화 (다음 주문에 섞이지 않도록)
        // window.pendingSelectedAddons = null; 
    }

    cartData.push({ 
        uid: Date.now(), 
        product: calcProduct,
        type: 'design',
        thumb: thumbUrl, 
        json: json, 
        pages: finalPages, 
        originalUrl: originalFileUrl,
        fileName: fileName, 
        width: finalW, 
        height: finalH, 
        boardX: boardX, 
        boardY: boardY, 
        isOpen: true,
        qty: 1, 
        selectedAddons: recoveredAddons, // 복구된 옵션 적용
        addonQuantities: recoveredAddonQtys // 복구된 옵션 수량 적용
    });
    
    // 4. 저장 및 갱신
    try { 
        const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
        localStorage.setItem(storageKey, JSON.stringify(cartData)); 
    } catch(e) {}

    renderCart(); 

    if(loading) loading.style.display = "none";
    
    // [수정] 장바구니로 바로 이동하는 코드를 주석 처리하고 팝업을 띄움
    // document.getElementById('cartPage').style.display = 'block'; 
    document.getElementById('cartAddedModal').style.display = 'flex';
    
    if(document.body.classList.contains('editor-active')) {
        document.body.classList.remove('editor-active');
    }
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
        alert(window.t('msg_file_added_to_cart') || "File order added to cart.");
    } catch(err) { 
        console.error(err); 
        alert((window.t('msg_failed') || "Failed: ") + err.message);
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
    cartData.forEach((item, idx) => {
        if (!item.product) return;

        if (!item.qty) item.qty = 1; 
        if (item.isOpen === undefined) item.isOpen = true; 
        if (!item.selectedAddons) item.selectedAddons = {};
        
        let matOpts = []; let finOpts = []; let addOpts = [];
        if (item.product.addons) {
             const arr = Array.isArray(item.product.addons) ? item.product.addons : item.product.addons.split(',');
             arr.forEach(c => {
                 const code = c.trim(); 
                 const info = ADDON_DB[code];
                 if(info) {
                     const cat = (info.category||'').toLowerCase();
                     if(cat==='material') matOpts.push({code,...info});
                     else if(cat==='finish') finOpts.push({code,...info});
                     else addOpts.push({code,...info});
                 }
             });
        }

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
        div.className = "cart-item"; 
        
        // [중요] 화면 너비에 따라 레이아웃 구조를 동적으로 결정
        const isMobile = window.innerWidth <= 768;
        
        div.style.cssText = `
            background:#fff; border-radius:12px; margin-bottom:15px; border:1px solid #e2e8f0; 
            overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.02); display:flex; 
            flex-direction: ${isMobile ? 'column' : 'row'};
        `;

        // [옵션 생성 로직] 작고 콤팩트한 디자인
        let addonHtml = '';
        if (item.product.addons) {
            const addonCodes = Array.isArray(item.product.addons) ? item.product.addons : (item.product.addons.split(',') || []);
            const allAddons = addonCodes.map(c => ({ code: c.trim(), ...ADDON_DB[c.trim()] })).filter(a => a.name);
            const categories = [...new Set(allAddons.map(a => a.category_code || '옵션'))];

            categories.forEach(cat => {
                const catAddons = allAddons.filter(a => (a.category_code || '옵션') === cat);
                addonHtml += `
                    <div style="margin-bottom:10px;">
                        <div style="font-size:11px; font-weight:800; color:#6366f1; margin-bottom:5px; opacity:0.8;"># ${cat.toUpperCase()}</div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            ${catAddons.map(opt => {
                                const isSelected = Object.values(item.selectedAddons).includes(opt.code);
                                return `
                                    <label style="display:flex; align-items:center; justify-content:space-between; padding:5px 10px; border-radius:8px; border:1px solid ${isSelected ? '#6366f1' : '#f1f5f9'}; background:${isSelected ? '#f5f3ff' : '#fff'}; cursor:pointer; transition:0.2s;">
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <input type="checkbox" onchange="window.toggleCartAddon(${idx}, '${opt.code}', this.checked)" ${isSelected ? 'checked' : ''} style="width:14px; height:14px; accent-color:#6366f1; cursor:pointer;">
                                            <div style="width:24px; height:24px; background:#f8fafc; border:1px solid #eee; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                                                ${opt.img_url ? `<img src="${opt.img_url}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid fa-cube" style="font-size:10px; color:#cbd5e1;"></i>`}
                                            </div>
                                            <div style="display:flex; flex-direction:column;">
                                                <span style="font-size:11px; font-weight:bold; color:${isSelected ? '#6366f1' : '#475569'};">${opt.name_kr || opt.name}</span>
                                                <span style="font-size:10px; color:#94a3b8;">+${formatCurrency(opt.price)}</span>
                                            </div>
                                        </div>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            });
        }

        // [최종 레이아웃 주입]
        if (!isMobile) {
            // PC 레이아웃: 정보 좌측 / 옵션 영역 우측 끝으로 이동
            div.innerHTML = `
                <div style="display:flex; width:100%; padding:20px; gap:30px; align-items:flex-start;">
                    <div style="width:100px; height:100px; background:#f8fafc; border:1px solid #eee; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                        <img src="${item.thumb}" style="width:100%; height:100%; object-fit:contain;">
                    </div>

                    <div style="flex:1; min-width:300px;">
                        <h4 style="margin:0; font-size:18px; color:#1e293b; font-weight:900; line-height:1.4;">${item.product.name}</h4>
                        <div style="font-size:13px; color:#64748b; margin-top:5px;">단가: ${formatCurrency(item.product.price)}</div>
                        <div style="display:flex; align-items:center; gap:12px; margin-top:15px;">
                            <div class="qty-wrapper" style="display:flex; border:1px solid #e2e8f0; border-radius:6px; background:#fff; overflow:hidden;">
                                <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, -1)" style="border:none; background:none; padding:4px 10px; cursor:pointer;">-</button>
                                <input type="number" value="${item.qty}" readonly style="width:35px; text-align:center; border:none; font-weight:bold; font-size:14px;">
                                <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, 1)" style="border:none; background:none; padding:4px 10px; cursor:pointer;">+</button>
                            </div>
                            <span style="font-size:12px; color:#64748b; font-weight:bold;">본품 수량</span>
                        </div>
                    </div>

                    <div style="width:320px; max-height:220px; overflow-y:auto; background:#f8fafc; border:1px solid #f1f5f9; border-radius:12px; padding:15px; flex-shrink:0;">
                        <div style="font-size:12px; font-weight:800; color:#334155; margin-bottom:10px;"><i class="fa-solid fa-circle-plus"></i> 추가 구성 상품</div>
                        ${addonHtml || '<div style="font-size:11px; color:#94a3b8; text-align:center;">연결된 옵션 없음</div>'}
                    </div>

                    <div style="width:160px; text-align:right; display:flex; flex-direction:column; justify-content:space-between; align-self:stretch; flex-shrink:0;">
                        <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#cbd5e1; cursor:pointer; align-self:flex-end;"><i class="fa-solid fa-trash-can"></i></button>
                        <div>
                            <div style="font-size:11px; color:#6366f1; font-weight:bold; margin-bottom:3px;">옵션포함 총액</div>
                            <div style="font-size:22px; font-weight:900; color:#1e1b4b;">${formatCurrency(totalItemPrice)}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 모바일 레이아웃: 상품 요약 아래로 옵션 영역을 배치
            div.innerHTML = `
                <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:12px; border-bottom:1px solid #f1f5f9; padding-bottom:15px; align-items:center;">
                        <img src="${item.thumb}" style="width:80px; height:80px; object-fit:contain; border:1px solid #eee; border-radius:8px; background:#fff;">
                        <div style="flex:1;">
                            <h4 style="margin:0; font-size:15px; color:#1e293b; font-weight:800; line-height:1.3;">${item.product.name}</h4>
                            <div style="font-size:14px; font-weight:900; color:#1e1b4b; margin-top:8px;">합계: ${formatCurrency(totalItemPrice)}</div>
                        </div>
                        <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444; font-size:20px; padding:10px;"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    
                    <div style="background:#f1f5f9; border-radius:12px; padding:12px;">
                        <div style="font-size:12px; font-weight:800; color:#475569; margin-bottom:10px; display:flex; align-items:center; gap:5px;">
                            <i class="fa-solid fa-circle-plus" style="color:#6366f1;"></i> 선택된 옵션 관리
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${addonHtml || '<div style="font-size:12px; color:#94a3b8; text-align:center;">연결된 옵션이 없습니다.</div>'}
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0;">
                        <span style="font-size:13px; font-weight:bold; color:#475569;">주문 수량</span>
                        <div class="qty-wrapper" style="display:flex; border:1px solid #cbd5e1; border-radius:8px; background:#fff; overflow:hidden;">
                            <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, -1)" style="border:none; background:none; padding:10px 20px; font-weight:bold; font-size:18px;">-</button>
                            <input type="number" value="${item.qty}" readonly style="width:50px; text-align:center; border:none; font-weight:bold; font-size:16px;">
                            <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, 1)" style="border:none; background:none; padding:10px 20px; font-weight:bold; font-size:18px;">+</button>
                        </div>
                    </div>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="cart-top-row" style="display:flex; padding:20px; gap:20px;">
                <div style="width:100px; height:100px; background:#f8fafc; border:1px solid #eee; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                    <img src="${item.thumb}" style="width:100%; height:100%; object-fit:contain;">
                </div>

                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <h4 style="margin:0; font-size:18px; color:#1e293b; font-weight:900;">${item.product.name}</h4>
                    <div style="font-size:13px; color:#64748b; margin-top:4px;">(${item.fileName || '파일 별도 첨부'})</div>
                    <div style="font-size:12px; color:#94a3b8; margin-top:8px;">본품 단가: ${formatCurrency(item.product.price)}</div>
                </div>

                <div style="width:320px; max-height:220px; overflow-y:auto; background:#f8fafc; border:1px solid #e2e8f0; border-radius:15px; padding:15px; flex-shrink:0;">
                    <div style="font-size:13px; font-weight:800; color:#1e1b4b; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-circle-plus" style="color:#6366f1;"></i> 추가 상품
                        <span style="font-size:10px; font-weight:normal; color:#94a3b8; margin-left:auto;">선택/추가</span>
                    </div>
                    ${addonHtml || '<div style="font-size:12px; color:#94a3b8; text-align:center; padding:20px;">선택 가능한 옵션이 없습니다.</div>'}
                </div>

                <div style="width:200px; display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; flex-shrink:0;">
                    <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#cbd5e1; font-size:18px; cursor:pointer; transition:0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'" title="삭제">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    
                    <div style="text-align:right; margin-bottom: 12px;">
                        <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">옵션포함 합계</div>
                        <div style="font-size:24px; font-weight:900; color:#1e1b4b;">${formatCurrency(totalItemPrice)}</div>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px; background:#f1f5f9; padding:8px 12px; border-radius:12px; width:100%; justify-content:space-between;">
                        <span style="font-size:12px; font-weight:bold; color:#475569;">본품 수량</span>
                        <div class="qty-wrapper" style="display:flex; border:1px solid #cbd5e1; border-radius:8px; background:#fff; overflow:hidden;">
                            <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, -1)" style="border:none; background:none; padding:5px 12px; font-weight:bold; cursor:pointer;">-</button>
                            <input type="number" value="${item.qty}" readonly style="width:35px; text-align:center; border:none; border-left:1px solid #eee; border-right:1px solid #eee; font-weight:bold; font-size:15px;">
                            <button onclick="event.stopPropagation(); window.updateCartQty(${idx}, 1)" style="border:none; background:none; padding:5px 12px; font-weight:bold; cursor:pointer;">+</button>
                        </div>
                    </div>
                </div>
            </div>`;
        listArea.appendChild(div);
    });
    
    updateSummary(grandProductTotal, grandAddonTotal, grandTotal);
}

// [수정됨] 전역 변수를 사용하여 마일리지 제한 적용
function updateSummary(prodTotal, addonTotal, total) { 
    const elItem = document.getElementById("summaryItemPrice"); if(elItem) elItem.innerText = formatCurrency(prodTotal); 
    const elAddon = document.getElementById("summaryAddonPrice"); if(elAddon) elAddon.innerText = formatCurrency(addonTotal);
    
    // 안전장치: 목록이 없으면 빈 값으로 생성
    const excludedSet = window.excludedCategoryCodes || new Set();

    let discountableAmount = 0;
    let hasExcludedItem = false;

    // 1. 할인 대상 금액 계산
    cartData.forEach(item => {
        const prodCat = item.product ? item.product.category : '';
        
        // 전역 변수 확인
        if (excludedSet.has(prodCat)) {
            hasExcludedItem = true;
            console.log(`🚫 제외 상품 감지: ${item.product.name}`);
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

    // 2. 할인 금액 계산
    const discountAmount = Math.floor(discountableAmount * currentUserDiscountRate);
    const finalTotal = total - discountAmount;
    
    // 전역 변수 업데이트
    window.finalPaymentAmount = finalTotal; 
    // 호환성을 위해 로컬 변수도 업데이트 (필요시)
    finalPaymentAmount = finalTotal;

    // 3. 마일리지 한도 설정
    if (typeof currentUser !== 'undefined' && currentUser) {
        const elOwn = document.getElementById('userOwnMileage');
        const myMileage = elOwn ? parseInt(elOwn.innerText.replace(/[^0-9]/g, '')) || 0 : 0;
        
        let realLimit = 0;
        // 할인 대상 금액이 있을 때만 5% 한도 부여
        if (discountableAmount > 0) {
            const fivePercent = Math.floor((discountableAmount - discountAmount) * 0.05); // 0.05 = 5%
            realLimit = Math.min(myMileage, fivePercent);
        }
        
        window.mileageLimitMax = realLimit; 
        
        const limitDisp = document.getElementById('mileageLimitDisplay');
        if(limitDisp) limitDisp.innerText = realLimit.toLocaleString() + ' P';
        
        const mileInput = document.getElementById('inputUseMileage');
        if(mileInput) {
            mileInput.placeholder = `최대 ${realLimit.toLocaleString()}`;
            // 제외 상품만 있어서 한도가 0이면 입력 막기
            if (realLimit === 0 && hasExcludedItem) {
                mileInput.value = "";
                mileInput.placeholder = "사용 불가 (제외 상품 포함)";
                mileInput.disabled = true;
            } else {
                mileInput.disabled = false;
                // 입력값이 한도보다 크면 줄임
                if(parseInt(mileInput.value || 0) > realLimit) {
                    mileInput.value = realLimit > 0 ? realLimit : "";
                }
            }
        }
    }

    const elDiscount = document.getElementById("summaryDiscount");
    if(elDiscount) {
        if(discountAmount > 0) elDiscount.innerText = `-${formatCurrency(discountAmount)} (${(currentUserDiscountRate*100).toFixed(0)}%)`;
        else elDiscount.innerText = "0원 (0%)";
    }
    const elTotal = document.getElementById("summaryTotal"); if(elTotal) elTotal.innerText = formatCurrency(finalTotal); 
    const cartCount = document.getElementById("cartCount"); if(cartCount) cartCount.innerText = `(${cartData.length})`; 
    const btnCart = document.getElementById("btnViewCart"); if (btnCart) btnCart.style.display = (cartData.length > 0 || (typeof currentUser !== 'undefined' && currentUser)) ? "inline-flex" : "none"; 
}

// ============================================================
// [수정] 주문 정보 제출 (DB 저장 X, 임시 데이터 저장 및 UI 전환만 수행)
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

    if(!manager || !address) return alert(window.t('alert_input_shipping'));
    
    // 1. 임시 데이터 생성 (DB에 아직 안 넣음)
    const deliveryDate = selectedDeliveryDate || new Date().toISOString().split('T')[0];

    // 전역 변수에 임시 저장 (결제 시점에 사용)
    window.tempOrderInfo = {
        manager,
        phone,
        address,
        request,
        deliveryDate
    };

    // 2. 할인 적용 전 총액 계산 (단순 표시용)
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
    
    // UI 표시용 전역 변수 세팅
    window.originalPayAmount = finalTotal; 
    window.finalPaymentAmount = finalTotal; 

    // 3. UI 전환 (DB 저장 과정 없이 바로 모달 띄움)
    document.getElementById("deliveryInfoModal").style.display = "none"; 
    const checkoutModal = document.getElementById("checkoutModal");
    checkoutModal.style.display = "flex";
    
    // 결제창 UI 세팅
    document.getElementById("orderName").value = manager; 
    document.getElementById("orderPhone").value = phone; 
    document.getElementById("orderAddr").value = address; 
    document.getElementById("orderMemo").value = request;

    // 마일리지 UI 초기화 로직
    if (currentUser) {
        const { data: profile } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
        const myMileage = profile ? (profile.mileage || 0) : 0;
        
        const fivePercent = Math.floor(finalTotal * 0.05);
        const realLimit = Math.min(myMileage, fivePercent);

        window.mileageLimitMax = realLimit; 
        
        document.getElementById('userOwnMileage').innerText = myMileage.toLocaleString() + ' P';
        document.getElementById('mileageLimitDisplay').innerText = realLimit.toLocaleString() + ' P';
        document.getElementById('inputUseMileage').value = ''; 
        document.getElementById('inputUseMileage').placeholder = `최대 ${realLimit.toLocaleString()}`;
        document.getElementById('finalPayAmountDisplay').innerText = finalTotal.toLocaleString() + '원';
        
        // 버튼 텍스트 초기화
        document.getElementById('btnFinalPay').innerText = `${finalTotal.toLocaleString()}원 결제하기`;
    } else {
        window.mileageLimitMax = 0;
        document.getElementById('userOwnMileage').innerText = '-';
        document.getElementById('mileageLimitDisplay').innerText = '0 P';
        document.getElementById('finalPayAmountDisplay').innerText = finalTotal.toLocaleString() + '원';
        document.getElementById('btnFinalPay').innerText = `${finalTotal.toLocaleString()}원 결제하기`;
    }

    // 예치금 잔액 표시
    if(currentUser) {
        const { data: profile } = await sb.from('profiles').select('deposit').eq('id', currentUser.id).single();
        const balance = profile ? profile.deposit : 0;
        const elBal = document.getElementById('myCurrentDepositDisplay');
        if(elBal) {
            elBal.innerText = `(보유: ${balance.toLocaleString()}원)`;
            elBal.dataset.balance = balance;
        }
    }
}

// ============================================================
// [신규] 실제 DB 생성 및 파일 업로드 (결제 버튼 클릭 시 호출됨)
// ============================================================
// [수정됨] 마일리지 값이 견적서에 반영되도록 수정
async function createRealOrderInDb(finalPayAmount, useMileage) {
    if (!window.tempOrderInfo) throw new Error("주문 임시 데이터가 없습니다.");

    const loading = document.getElementById("loading");
    loading.style.display = "flex";
    loading.querySelector('p').innerText = "주문 데이터 생성 중...";

    const { manager, phone, address, request, deliveryDate } = window.tempOrderInfo;

    // 1. 주문 아이템 데이터 구성
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
                name: item.product.name, 
                price: item.product.price, 
                code: item.product.code || item.product.key,
                img: item.product.img 
            },
            productName: item.product.name,
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

    // 2. DB Insert (결제 대기 상태로 생성)
    const { data: orderData, error: orderError } = await sb.from('orders').insert([{ 
        user_id: currentUser?.id, 
        order_date: new Date().toISOString(),           
        delivery_target_date: deliveryDate, 
        manager_name: manager, 
        phone, 
        address, 
        request_note: request, 
        status: '임시작성', 
        payment_status: '미결제', 
        total_amount: finalPayAmount, 
        discount_amount: useMileage, // DB에는 잘 들어가고 있음
        items: itemsToSave, 
        site_code: CURRENT_LANG.toUpperCase() 
    }]).select();
    
    if (orderError) throw orderError; 
    
    const newOrderId = orderData[0].id;
    window.currentDbId = newOrderId; 

    // 3. 파일 업로드 및 PDF 생성 프로세스
    let uploadedFiles = [];
    
    // (1) 고객 업로드 파일
    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i]; 
        const idx = String(i + 1).padStart(2, '0');
        if (item.originalUrl) {
            uploadedFiles.push({ 
                name: `고객파일_${idx}_${item.fileName || 'file'}`, 
                url: item.originalUrl, 
                type: 'customer_file' 
            });
        }
    }
    
    const orderInfoForPDF = { 
        id: newOrderId, 
        manager, phone, address, note: request, date: deliveryDate 
    };
    
    // (2) 문서 생성 (작업지시서, 견적서)
    try {
        loading.querySelector('p').innerText = "문서 생성 중...";
        const orderSheetBlob = await generateOrderSheetPDF(orderInfoForPDF, cartData);
        if(orderSheetBlob) { 
            const url = await uploadFileToSupabase(orderSheetBlob, `orders/${newOrderId}/order_sheet.pdf`); 
            if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
        }
        
        // ★★★ [수정된 부분] ★★★
        // 기존: generateQuotationPDF(orderInfoForPDF, cartData, currentUserDiscountRate);
        // 변경: 4번째 인자로 useMileage를 전달해야 PDF 생성기가 마일리지 차감을 반영합니다.
        const quoteBlob = await generateQuotationPDF(orderInfoForPDF, cartData, currentUserDiscountRate, useMileage);
        
        if(quoteBlob) { 
            const url = await uploadFileToSupabase(quoteBlob, `orders/${newOrderId}/quotation.pdf`); 
            if(url) uploadedFiles.push({ name: `견적서.pdf`, url: url, type: 'quotation' }); 
        } 
    } catch(pdfErr) { console.warn("문서 생성 오류:", pdfErr); }

    // (3) 디자인 파일 변환
    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i]; 
        const idx = String(i + 1).padStart(2, '0');
        
        if (!item.originalUrl && item.type === 'design' && item.json && item.product) {
            // 내용물 체크
            let hasContent = false;
            if (item.json.objects && Array.isArray(item.json.objects)) {
                const validObjects = item.json.objects.filter(obj => !obj.isBoard);
                if (validObjects.length > 0) hasContent = true;
            }
            if (!hasContent) continue;

            loading.querySelector('p').innerText = `디자인 변환 중 (${i+1}/${cartData.length})...`;
            try { 
                const targetPages = (item.pages && item.pages.length > 0) ? item.pages : [item.json];
                let fileBlob = await generateProductVectorPDF(targetPages, item.width, item.height, item.boardX || 0, item.boardY || 0); 
                if (!fileBlob) fileBlob = await generateRasterPDF(targetPages, item.width, item.height, item.boardX || 0, item.boardY || 0);
                
                if(fileBlob) {
                    const url = await uploadFileToSupabase(fileBlob, `orders/${newOrderId}/design_${idx}.pdf`); 
                    if(url) uploadedFiles.push({ name: `제작물_${idx}_${item.product.name}.pdf`, url: url, type: 'product' }); 
                }
            } catch(err) { console.warn("디자인 변환 실패:", err); }
        }
    }

    // 파일 정보 업데이트
    if (uploadedFiles.length > 0) {
        await sb.from('orders').update({ files: uploadedFiles }).eq('id', newOrderId);
    }

    return newOrderId;
}

// ============================================================
// [수정됨] 최종 결제 버튼 클릭 시 실행 (DB 생성 -> 결제)
// ============================================================
async function processFinalPayment() {
    // 1. 임시 데이터 확인
    if (!window.tempOrderInfo && !window.currentDbId) return alert("주문 정보가 없습니다. 처음부터 다시 시도해주세요.");
    
    // 2. 금액 및 마일리지 계산
    const mileageInput = document.getElementById('inputUseMileage');
    const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;
    const baseAmount = window.originalPayAmount || 0;
    const realFinalPayAmount = baseAmount - useMileage;

    if (realFinalPayAmount < 0) return alert("결제 금액 오류입니다.");
    
    // 마일리지 유효성 검사
    if (useMileage > 0) {
        if (!currentUser) return alert(window.t('msg_login_required', "Login is required."));
        const excludedSet = window.excludedCategoryCodes || new Set();
        let isSafe = true;
        cartData.forEach(item => { if (item.product && excludedSet.has(item.product.category)) isSafe = false; });
        if (!isSafe) return alert("마일리지 사용 불가 상품이 포함되어 있습니다.");

        const { data: check } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
        if (!check || check.mileage < useMileage) return alert(window.t('alert_mileage_shortage', "Insufficient mileage."));
    }

    const btn = document.getElementById("btnFinalPay");
    btn.disabled = true;

    try {
        // ★★★ 여기서 DB를 생성합니다. (이미 생성된 상태면 건너뜀) ★★★
        if (!window.currentDbId) {
            await createRealOrderInDb(realFinalPayAmount, useMileage);
        } else {
            // 혹시라도 재시도인 경우 금액 업데이트
             await sb.from('orders').update({ 
                discount_amount: useMileage, 
                total_amount: realFinalPayAmount 
            }).eq('id', window.currentDbId);
        }
        
        const orderId = window.currentDbId; // 이제 DB ID가 확실히 존재함

        // 3. 결제 수단별 분기 처리
        const selected = document.querySelector('input[name="paymentMethod"]:checked');
        const method = selected ? selected.value : 'card';

        if (method === 'deposit') {
            await processDepositPayment(realFinalPayAmount, useMileage); // 파라미터 전달
        } else if (method === 'bank') {
            const depositorName = document.getElementById('inputDepositorName').value;
            if (!depositorName) { btn.disabled = false; return alert(window.t('alert_input_depositor', "Please enter depositor name.")); }
            
            if(confirm(window.t('confirm_bank_payment', "Proceed with Bank Transfer?"))) {
                // 마일리지 차감 수행
                if(useMileage > 0) {
                     const { data: m } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
                     await sb.from('profiles').update({ mileage: m.mileage - useMileage }).eq('id', currentUser.id);
                     await sb.from('wallet_logs').insert({ user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용` });
                }

                await sb.from('orders').update({ 
                    status: '접수됨', payment_method: '무통장입금', payment_status: '입금대기', depositor_name: depositorName 
                }).eq('id', orderId);
                
                alert(window.t('msg_order_complete_bank'));
                location.reload();
            }
        } else {
            // (C) 카드 결제 (Toss / Stripe)
            processCardPayment(realFinalPayAmount);
        }

    } catch (e) {
        console.error(e);
        alert("주문 생성 중 오류가 발생했습니다: " + e.message);
        document.getElementById("loading").style.display = "none";
        btn.disabled = false;
    }
}

// ============================================================
// [수정] 예치금 결제 (파라미터로 금액과 마일리지를 받아서 처리)
// ============================================================
async function processDepositPayment(payAmount, useMileage) {
    if (!currentUser) return alert("로그인이 필요합니다.");
    
    const balanceSpan = document.getElementById('myCurrentDepositDisplay');
    const currentBalance = parseInt(balanceSpan.dataset.balance || 0);

    if (currentBalance < payAmount) {
        const shortage = (payAmount - currentBalance).toLocaleString();
        document.getElementById("loading").style.display = "none";
        document.getElementById("btnFinalPay").disabled = false;
        return alert(window.t('alert_deposit_shortage').replace('{amount}', shortage));
    }

    if (!confirm(window.t('confirm_deposit_pay').replace('{amount}', payAmount.toLocaleString()))) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("btnFinalPay").disabled = false;
        return;
    }

    try {
        // 1. 마일리지 차감 (있을 경우)
        if (useMileage > 0) {
            const { data: m } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
            await sb.from('profiles').update({ mileage: m.mileage - useMileage }).eq('id', currentUser.id);
            await sb.from('wallet_logs').insert({ user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용` });
        }

        // 2. 예치금 차감
        const newBalance = currentBalance - payAmount;
        const { error: profileErr } = await sb.from('profiles').update({ deposit: newBalance }).eq('id', currentUser.id);
        if (profileErr) throw profileErr;

        // 3. 로그 기록
        await sb.from('wallet_logs').insert({
            user_id: currentUser.id,
            type: 'payment_order',
            amount: -payAmount,
            description: `주문 결제 (주문번호: ${window.currentDbId})`
        });

        // 4. 주문 상태 변경
        await sb.from('orders').update({ 
            payment_status: '결제완료', 
            payment_method: '예치금',
            status: '접수됨' 
        }).eq('id', window.currentDbId);

        alert(window.t('msg_payment_complete'));
        location.reload();

    } catch (e) {
        console.error(e);
        alert("결제 처리 중 오류가 발생했습니다: " + e.message);
        document.getElementById("loading").style.display = "none";
        document.getElementById("btnFinalPay").disabled = false;
    }
}

// ============================================================
// [수정] 카드 결제 (확정된 금액 파라미터 사용)
// ============================================================
function processCardPayment(confirmedAmount) {
    const country = SITE_CONFIG.COUNTRY;
    const pgConfig = SITE_CONFIG.PG_CONFIG[country];
    if (!pgConfig) return alert("PG 설정 오류: 해당 국가의 결제 설정이 없습니다.");

    const orderName = `Chameleon Order #${window.currentDbId}`;
    const customerName = document.getElementById("orderName").value;

    // processFinalPayment에서 넘겨준 확정 금액 사용
    const realPayAmount = (confirmedAmount !== undefined) ? confirmedAmount : window.finalPaymentAmount;

    // (안전장치) 금액이 0원 이하인 경우
    if (realPayAmount < 0) return alert("결제 금액 오류입니다.");

    if (pgConfig.provider === 'toss') {
        if (!window.TossPayments) return alert("Toss Payments SDK가 로드되지 않았습니다.");
        
        const tossPayments = TossPayments(pgConfig.clientKey);
        tossPayments.requestPayment("카드", { 
            amount: realPayAmount,  // DB에 저장된 그 금액으로 결제 요청
            orderId: "ORD-" + new Date().getTime() + "-" + window.currentDbId, 
            orderName: orderName, 
            customerName: customerName, 
            successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}`, 
            failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, 
        }).catch(error => { 
            if (error.code !== "USER_CANCEL") alert("결제 오류: " + error.message); 
        });

    } else if (pgConfig.provider === 'stripe') {
        initiateStripeCheckout(pgConfig.publishableKey, realPayAmount, country, window.currentDbId);
    }
}

async function initiateStripeCheckout(pubKey, amount, currencyCountry, orderDbId) {
    if (typeof Stripe === 'undefined') return alert("Stripe 모듈 로드 실패");
    
    const stripe = Stripe(pubKey);
    const btn = document.getElementById("btnFinalPay"); // 버튼 ID 변경 대응
    const originalText = btn.innerText;
    
    btn.innerText = "Stripe 연결 중...";
    btn.disabled = true;

    const currency = currencyCountry === 'JP' ? 'jpy' : 'usd';

    try {
        const { data, error } = await sb.functions.invoke('create-stripe-session', {
            body: {
                amount: amount,
                currency: currency,
                order_id: orderDbId,
                cancel_url: window.location.href,
                success_url: window.location.origin + `/success.html?db_id=${orderDbId}`
            }
        });

        if (error) throw error;

        const result = await stripe.redirectToCheckout({
            sessionId: data.sessionId
        });

        if (result.error) alert(result.error.message);
        
    } catch (e) {
        console.error("Stripe Error:", e);
        alert("결제 초기화 실패: " + e.message);
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
    if (confirm("삭제하시겠습니까?")) { 
        cartData.splice(idx, 1); 
        saveCart(); 
        renderCart(); 
    } 
};
window.updateCartOption = function(idx, key, value) { 
    if (cartData[idx]) { 
        cartData[idx].selectedAddons[key] = value; 
        saveCart(); 
        renderCart(); 
    } 
};
window.toggleCartAddon = function(idx, code, isChecked) {
    if (cartData[idx]) {
        const key = `addon_${code}`;
        if (isChecked) { 
            cartData[idx].selectedAddons[key] = code; 
            if (!cartData[idx].addonQuantities[code]) cartData[idx].addonQuantities[code] = 1; 
        } else { 
            delete cartData[idx].selectedAddons[key]; 
        }
        saveCart(); 
        renderCart();
    }
};
window.updateCartAddonQty = function(idx, code, qty) {
    const quantity = parseInt(qty); 
    if (quantity < 1) return;
    if (cartData[idx]) { 
        cartData[idx].addonQuantities[code] = quantity; 
        saveCart(); 
        renderCart(); 
    }
};
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
// [9] 직접 장바구니 담기 및 일괄 업로드 (추가 기능)
// ============================================================

// 중복 방지용 타임스탬프 변수
let lastCartAddTime = 0;

export function addProductToCartDirectly(productInfo, targetQty = 1, addonCodes = []) {
    if (!productInfo) return;

    const now = Date.now();
    if (now - lastCartAddTime < 1000) return;
    lastCartAddTime = now;

    window.isDirectCartAddInProgress = true;
    setTimeout(() => { window.isDirectCartAddInProgress = false; }, 2000);

    // [추가] 전달받은 옵션 코드를 장바구니 데이터 형식(selectedAddons)으로 변환
    const selectedAddons = {};
    const addonQuantities = {};
    
    if (addonCodes && addonCodes.length > 0) {
        addonCodes.forEach(code => {
            // 카테고리를 알 수 없는 경우 임시로 'addon_' 접두사를 붙여 저장
            // renderCart 로직이 selectedAddons의 value 값을 기반으로 그리므로 핵심은 value입니다.
            selectedAddons[`opt_${code}`] = code; 
            addonQuantities[code] = 1; // 기본 수량 1
        });
    }

    cartData.push({
        uid: now,
        product: productInfo,
        type: 'product_only',
        fileName: '(파일 별도 첨부)',
        thumb: productInfo.img || 'https://placehold.co/100?text=Product',
        json: null,
        width: productInfo.w || 0,
        height: productInfo.h || 0,
        isOpen: true,
        qty: parseInt(targetQty) || 1,
        selectedAddons: selectedAddons, // 수집된 옵션 적용
        addonQuantities: addonQuantities
    });

    saveCart();
    renderCart();
}

// 2. 장바구니 내 파일 일괄 업로드 처리 (수정됨: 배열 복사 및 병렬 처리)
export async function processBulkCartUpload(files) {
    if (!files || files.length === 0) return;

    // [중요] FileList를 즉시 배열로 복사하여, 외부에서 input이 초기화되어도 안전하게 유지함
    const fileList = Array.from(files);

    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = `파일 ${fileList.length}개 업로드 중...`;
    }

    try {
        let successCount = 0;

        // [성능 개선] Promise.all을 사용하여 모든 파일을 동시에 업로드 (하나씩 기다리지 않음)
        const uploadPromises = fileList.map(async (file, index) => {
            try {
                // 1. 원본 파일 업로드
                const originalUrl = await uploadFileToSupabase(file, 'customer_uploads');
                
                // 2. 썸네일 생성
                let thumbUrl = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
                if (file.type.startsWith('image/')) {
                    try {
                        const thumbBlob = await resizeImageToBlob(file);
                        const uploadedThumb = await uploadFileToSupabase(thumbBlob, 'thumbs');
                        if (uploadedThumb) thumbUrl = uploadedThumb;
                    } catch(e) {}
                }

                // 3. 결과 객체 반환
                return {
                    uid: Date.now() + index + Math.random(), // 고유 ID 보장
                    product: { 
                        name: '📄 첨부 파일', 
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

        // 모든 업로드가 끝날 때까지 대기
        const results = await Promise.all(uploadPromises);

        // 성공한 결과만 장바구니에 담기
        results.forEach(item => {
            if (item) {
                cartData.push(item);
                successCount++;
            }
        });

        saveCart();
        renderCart();
        
        if (successCount > 0) {
            alert(`${successCount}개의 파일이 장바구니에 추가되었습니다.`);
        } else {
            alert("파일 업로드에 실패했습니다.");
        }

    } catch (e) {
        console.error("일괄 업로드 실패:", e);
        alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
        if(loading) loading.style.display = "none";
    }
}
// ============================================================
// [8] 마일리지 계산 헬퍼 함수 (필수 추가)
// ============================================================

// 1. 마일리지 입력 시 한도 체크 및 금액 실시간 반영
window.calcMileageLimit = function(input) {
    let val = parseInt(input.value) || 0;
    const limit = window.mileageLimitMax || 0;

    // 한도 초과 시 조정
    if (val > limit) {
        alert(`마일리지는 구매금액의 최대 5%(${limit.toLocaleString()}P)까지만 사용 가능합니다.`);
        val = limit;
        input.value = val;
    }
    
    // 최종 금액 계산 (원금 - 마일리지)
    // window.originalPayAmount가 정의되어 있어야 정확합니다.
    const baseAmount = window.originalPayAmount || 0;
    
    // 만약 originalPayAmount가 0이면(로직 오류 등), 현재 finalPaymentAmount + val로 역산 시도
    const safeBase = baseAmount > 0 ? baseAmount : (window.finalPaymentAmount || 0) + val;
    
    window.finalPaymentAmount = safeBase - val;
    
    // UI 업데이트
    const amountDisplay = document.getElementById('finalPayAmountDisplay');
    if(amountDisplay) amountDisplay.innerText = window.finalPaymentAmount.toLocaleString() + '원';
    
    const payBtn = document.getElementById('btnFinalPay');
    if(payBtn) payBtn.innerText = `${window.finalPaymentAmount.toLocaleString()}원 결제하기`;
};

// 2. '최대' 버튼 클릭 시 호출되는 함수
window.applyMaxMileage = function() {
    const input = document.getElementById('inputUseMileage');
    if(input) {
        input.value = window.mileageLimitMax || 0;
        // 값 입력 후 계산 함수 강제 실행
        window.calcMileageLimit(input);
    }
};