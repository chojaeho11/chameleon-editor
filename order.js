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
    const num = parseInt(amount) || 0;
    if (CURRENT_LANG === 'jp') return '¥' + num.toLocaleString();
    else if (CURRENT_LANG === 'us') return '$' + num.toLocaleString();
    else return num.toLocaleString() + '원';
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
            if(cartData.length === 0) return alert("장바구니가 비어있습니다."); 
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
            if(cartData.length === 0) return alert("데이터가 없습니다.");
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

    cartData.push({ 
        uid: Date.now(), 
        product: calcProduct,
        type: 'design',
        thumb: thumbUrl, 
        json: json, // 썸네일용 대표 JSON (현재 보고있는 페이지)
        pages: finalPages, // ★ [핵심] 전체 페이지 데이터 저장
        originalUrl: originalFileUrl,
        fileName: fileName, 
        width: finalW, 
        height: finalH, 
        boardX: boardX, 
        boardY: boardY, 
        isOpen: true,
        qty: 1, 
        selectedAddons: {}, 
        addonQuantities: {} 
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
        
        const div = document.createElement("div"); div.className = "cart-item"; 
        div.innerHTML = `
            <div class="cart-top-row" onclick="window.toggleCartAccordion(${idx})" style="display:flex; gap:15px; align-items:center; cursor:pointer;">
                <div style="width:80px; height:80px; background:#f8fafc; border:1px solid #eee; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                    <img src="${item.thumb}" style="max-width:100%; max-height:100%; object-fit:contain;">
                </div>
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:16px;">${item.product.name}</h4>
                    <div style="font-size:13px; color:#666; margin-top:4px;">${item.fileName || window.t('label_user_design')}</div>
                    <div style="font-weight:bold; color:#6366f1; margin-top:5px;">${formatCurrency(totalItemPrice)}</div>
                </div>
                <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        
        if(item.isOpen) {
            const optionContainer = document.createElement("div"); optionContainer.style.marginTop = "15px";
            
            if (matOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
            box.innerHTML = `<div class="opt-group-header">① ${window.t('label_opt_material')} <span class="badge-req">${window.t('badge_required')}</span></div>`;
            const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_mat', e.target.value);
                let optsHTML = `<option value="">${window.t('msg_select_option') || "Select Option"}</option>`;
                matOpts.forEach(opt => {
                    const selected = item.selectedAddons['opt_mat'] === opt.code ? 'selected' : ''; 
                    const priceStr = opt.price > 0 ? ` (+${formatCurrency(opt.price)})` : ''; 
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; 
                });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }
            if (finOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
            box.innerHTML = `<div class="opt-group-header">② ${window.t('label_opt_finish')} <span class="badge-req">${window.t('badge_required')}</span></div>`;
            const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_fin', e.target.value);
                let optsHTML = `<option value="">선택해주세요</option>`;
                finOpts.forEach(opt => { 
                    const selected = item.selectedAddons['opt_fin'] === opt.code ? 'selected' : ''; 
                    const priceStr = opt.price > 0 ? ` (+${formatCurrency(opt.price)})` : ''; 
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; 
                });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }
            if (addOpts.length > 0) {
            const box = document.createElement("div"); box.className = "cart-opt-group optional-group";
            box.innerHTML = `<div class="opt-group-header">③ ${window.t('label_opt_addon')} <span class="badge-sel">${window.t('badge_optional')}</span></div>`;
            const grid = document.createElement("div");
                grid.style.display = "flex"; grid.style.flexDirection = "column"; grid.style.gap = "8px";
                addOpts.forEach(opt => {
                    const key = `addon_${opt.code}`;
                    const isChecked = item.selectedAddons[key] === opt.code;
                    const currentQty = (item.addonQuantities[opt.code] || 1);
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex; align-items:center; justify-content:space-between; border:1px solid #eee; padding:8px; border-radius:6px;";
                    row.innerHTML = `
                        <label style="display:flex; align-items:center; cursor:pointer; flex:1;">
                            <input type="checkbox" onchange="window.toggleCartAddon(${idx}, '${opt.code}', this.checked)" ${isChecked?'checked':''} style="margin-right:8px; accent-color:#6366f1;">
                            <span style="font-size:13px;">${opt.name} <span style="color:#6366f1; font-weight:bold;">(+${formatCurrency(opt.price)})</span></span>
                        </label>
                        ${isChecked ? `<div style="display:flex; align-items:center; gap:5px; margin-left:10px;"><span style="font-size:11px; color:#888;">Qty</span><input type="number" min="1" value="${currentQty}" onchange="window.updateCartAddonQty(${idx}, '${opt.code}', this.value)" onclick="event.stopPropagation()" style="width:40px; text-align:center; border:1px solid #ddd; border-radius:4px; font-size:12px; padding:2px;"></div>` : ''}`;
                    grid.appendChild(row);
                });
                box.appendChild(grid); optionContainer.appendChild(box);
            }
            const qtyBox = document.createElement("div"); 
            qtyBox.style.cssText = "display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:15px;";
            qtyBox.innerHTML = `<span style="font-size:13px; font-weight:bold;">${window.t('label_quantity')}</span><div class="qty-wrapper" style="border:1px solid #ddd; border-radius:5px; display:flex;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button><input type="number" value="${item.qty}" onchange="window.updateCartQtyInput(${idx}, this.value)" style="width:50px; text-align:center; border:none; border-left:1px solid #eee; border-right:1px solid #eee; height:30px; font-weight:bold; outline:none;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button></div>`;
            optionContainer.appendChild(qtyBox); div.appendChild(optionContainer);
        }
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
// [6] 주문 제출 및 DB 저장
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
    
    const btn = document.getElementById("btnSubmitOrderInfo"); 
    btn.disabled = true; 
    const loading = document.getElementById("loading");
    loading.style.display = "flex";
    loading.querySelector('p').innerText = window.t('msg_creating_order');
    
    let newOrderId = null;
    
    try {
        let rawTotal = 0;
        
        const itemsToSave = cartData.map(item => {
            if (!item.product) return null; 
            
            // 1. 가격 분리 계산 (견적서 로직과 통일)
            const unitPrice = item.product.price || 0;
            const qty = item.qty || 1;
            
            // 본품 총액
            const productTotal = unitPrice * qty;
            
            // 옵션 총액 (본품 수량과 곱하지 않고, 옵션 수량만 더함)
            let optionTotal = 0;
            if(item.selectedAddons) {
                Object.values(item.selectedAddons).forEach(code => {
                    const addon = ADDON_DB[code];
                    const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
                    if(addon) optionTotal += addon.price * aq;
                });
            }

            // 이 아이템의 최종 합계 금액 (옵션 중복 곱하기 방지)
            const itemFinalTotal = productTotal + optionTotal;
            
            // 전체 주문 총액에 합산
            rawTotal += itemFinalTotal;

            // [핵심] 관리자 페이지 호환용 단가 계산 (총액 ÷ 수량)
            // 관리자 페이지는 (단가 × 수량)으로 총액을 보여주므로, 여기서 나누어서 저장해야 함
            // [수정] 소수점 발생 시 오류가 나므로 정수로 내림 처리 (Math.floor)
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
                
                // [수정] 오류가 나던 itemPrice 대신 계산된 호환 단가를 저장
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

        // 할인 적용된 최종 금액 계산
        const discountAmt = Math.floor(rawTotal * currentUserDiscountRate);
        const finalTotal = rawTotal - discountAmt;
        
        finalPaymentAmount = finalTotal; // 전역 변수 업데이트

        const { data: orderData, error: orderError } = await sb.from('orders').insert([{ 
            user_id: currentUser?.id, 
            order_date: new Date().toISOString(),           
            delivery_target_date: selectedDeliveryDate, 
            manager_name: manager, 
            phone, 
            address, 
            request_note: request, 
            status: '임시작성', // [수정] 결제 전에는 관리자에 안 보이게 '임시작성'으로 저장
            payment_status: '미결제', 
            total_amount: finalTotal, 
            items: itemsToSave, 
            site_code: CURRENT_LANG.toUpperCase() 
        }]).select();
        
        if (orderError) throw orderError; 
        newOrderId = orderData[0].id; 
        window.currentDbId = newOrderId;
        window.isOrderCompleted = true; 
        
        let uploadedFiles = [];
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
            id: newOrderId, // QR 코드용 ID 추가
            manager, phone, address, note: request, date: selectedDeliveryDate 
        };
        
        // PDF 생성 (비동기 병렬 처리 추천하지만, 안정성을 위해 순차 처리 유지)
        try {
            loading.querySelector('p').innerText = window.t('msg_generating_order_sheet') || "Generating Order Sheet...";
            const orderSheetBlob = await generateOrderSheetPDF(orderInfoForPDF, cartData);
            if(orderSheetBlob) { 
                const url = await uploadFileToSupabase(orderSheetBlob, `orders/${newOrderId}/order_sheet.pdf`); 
                if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
            }
        } catch(pdfErr) { console.warn("지시서 생성 오류:", pdfErr); }

        try {
            loading.querySelector('p').innerText = "견적서 생성 중...";
            // [수정] 3번째 인자로 할인율(currentUserDiscountRate) 전달
const quoteBlob = await generateQuotationPDF(orderInfoForPDF, cartData, currentUserDiscountRate);
            if(quoteBlob) { 
                const url = await uploadFileToSupabase(quoteBlob, `orders/${newOrderId}/quotation.pdf`); 
                if(url) uploadedFiles.push({ name: `견적서.pdf`, url: url, type: 'quotation' }); 
            } 
        } catch(quoteErr) { console.warn("견적서 생성 오류:", quoteErr); }
            
        // 디자인 파일 PDF 변환
        for (let i = 0; i < cartData.length; i++) {
            const item = cartData[i]; 
            const idx = String(i + 1).padStart(2, '0');
            
            // [수정] 빈 디자인(배경만 있는 경우) 체크하여 쓸데없는 파일 생성 방지
            if (!item.originalUrl && item.type === 'design' && item.json && item.product) {
                
                // 1. 내용물 확인: 배경(isBoard)을 제외한 객체가 있는지 검사
                let hasContent = false;
                if (item.json.objects && Array.isArray(item.json.objects)) {
                    // isBoard가 아닌 객체가 하나라도 있으면 내용이 있는 것으로 간주
                    const validObjects = item.json.objects.filter(obj => !obj.isBoard);
                    if (validObjects.length > 0) hasContent = true;
                }

                // 2. 내용이 없으면 PDF 생성 스킵
                if (!hasContent) {
                    console.log(`[Info] 디자인(${i+1})은 내용이 없어 PDF 생성을 건너뜁니다.`);
                    continue; 
                }

                loading.querySelector('p').innerText = `디자인 변환 중 (${i+1}/${cartData.length})...`;
                try { 
                    // [수정] 멀티 페이지 처리를 위해 배열(pages)을 전달
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

        if (uploadedFiles.length > 0) {
            await sb.from('orders').update({ files: uploadedFiles, status: '접수됨' }).eq('id', newOrderId);
        }

        // 모달 전환
        document.getElementById("deliveryInfoModal").style.display = "none"; 
        const checkoutModal = document.getElementById("checkoutModal");
        checkoutModal.style.display = "flex";
        
        document.getElementById("orderName").value = manager; 
        document.getElementById("orderPhone").value = phone; 
        document.getElementById("orderAddr").value = address; 
        document.getElementById("orderMemo").value = request;

        // [NEW] 마일리지 10% 제한 로직 초기화
        if (currentUser) {
            const { data: profile } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
            const myMileage = profile ? (profile.mileage || 0) : 0;
            
            // 1. 5% 한도 계산 (할인 적용된 finalTotal 기준)
            const fivePercent = Math.floor(finalTotal * 0.05);
            
            // 2. 실제 사용 가능 금액 (내 보유량 vs 5% 한도 중 작은 값)
            const realLimit = Math.min(myMileage, fivePercent);

            // 3. 전역 변수 및 UI 세팅
            window.mileageLimitMax = realLimit; // 전역변수 저장
            window.originalPayAmount = finalTotal; // 원래 결제해야할 금액

            document.getElementById('userOwnMileage').innerText = myMileage.toLocaleString() + ' P';
            document.getElementById('mileageLimitDisplay').innerText = realLimit.toLocaleString() + ' P';
            document.getElementById('inputUseMileage').value = ''; 
            document.getElementById('inputUseMileage').placeholder = `최대 ${realLimit.toLocaleString()}`;
            
            // 초기 최종 금액 표시
            document.getElementById('finalPayAmountDisplay').innerText = finalTotal.toLocaleString() + '원';
        } else {
            // 비회원 처리
            window.mileageLimitMax = 0;
            window.originalPayAmount = finalTotal;
            document.getElementById('userOwnMileage').innerText = '-';
            document.getElementById('mileageLimitDisplay').innerText = '0 P';
            document.getElementById('finalPayAmountDisplay').innerText = finalTotal.toLocaleString() + '원';
        }

        // 예치금 잔액 업데이트 (UI)
        if(currentUser) {
            const { data: profile } = await sb.from('profiles').select('deposit').eq('id', currentUser.id).single();
            const balance = profile ? profile.deposit : 0;
            const elBal = document.getElementById('myCurrentDepositDisplay');
            if(elBal) {
                elBal.innerText = `(보유: ${balance.toLocaleString()}원)`;
                elBal.dataset.balance = balance;
            }
        } else {
            const elBal = document.getElementById('myCurrentDepositDisplay');
            if(elBal) elBal.innerText = "(로그인 필요)";
        }

        alert(window.t('msg_order_received').replace('{rate}', (currentUserDiscountRate*100).toFixed(0)));

        btn.innerText = window.t('btn_submit_complete');

    } catch (e) { 
        console.error(e); 
        alert("주문 처리 중 오류 발생: " + e.message); 
        btn.innerText = "주문서 생성 및 결제"; 
        btn.disabled = false; 
    } finally { 
        loading.style.display = "none"; 
    }
}

// ============================================================
// [7] 결제 프로세스 (통합)
// ============================================================
// [NEW] 마일리지 계산 헬퍼 함수들 (전역 연결)
window.calcMileageLimit = function(input) {
    let val = parseInt(input.value) || 0;
    const limit = window.mileageLimitMax || 0;

    if (val > limit) {
        alert(`마일리지는 구매금액의 최대 5%(${limit.toLocaleString()}P)까지만 사용 가능합니다.`);
        val = limit;
        input.value = val;
    }
    
    // [수정] 전역 변수 window.finalPaymentAmount 업데이트 (카드 결제 연동용)
    window.finalPaymentAmount = window.originalPayAmount - val;
    
    document.getElementById('finalPayAmountDisplay').innerText = window.finalPaymentAmount.toLocaleString() + '원';
    document.getElementById('btnFinalPay').innerText = `${window.finalPaymentAmount.toLocaleString()}원 결제하기`;
};

window.applyMaxMileage = function() {
    const input = document.getElementById('inputUseMileage');
    input.value = window.mileageLimitMax || 0;
    window.calcMileageLimit(input);
};

// [수정된 결제 프로세스]
// [수정됨] 결제 시 최종 검사 (전역 변수 사용)
async function processFinalPayment() {
    if (!window.currentDbId) return alert("주문 정보가 없습니다.");
    
    const useMileage = parseInt(document.getElementById('inputUseMileage').value) || 0;
    
    if (useMileage > 0) {
        if (!currentUser) return alert("로그인이 필요합니다.");

        // 안전장치
        const excludedSet = window.excludedCategoryCodes || new Set();

        let isSafe = true;
        cartData.forEach(item => {
            if (item.product && excludedSet.has(item.product.category)) {
                isSafe = false;
            }
        });

        if (!isSafe) {
            alert("🚫 포함된 상품 중 마일리지 사용이 불가능한 품목이 있습니다.\n마일리지 입력을 취소합니다.");
            document.getElementById('inputUseMileage').value = "";
            if(window.calcMileageLimit) window.calcMileageLimit(document.getElementById('inputUseMileage'));
            return;
        }

        const { data: check } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
        if (!check || check.mileage < useMileage) return alert("보유 마일리지가 부족합니다.");

        await sb.from('profiles').update({ mileage: check.mileage - useMileage }).eq('id', currentUser.id);
        await sb.from('wallet_logs').insert({
            user_id: currentUser.id, type: 'usage_purchase', amount: -useMileage, description: `주문 결제 사용`
        });

        // 전역 변수 사용
        const payAmt = window.finalPaymentAmount || finalPaymentAmount;

        await sb.from('orders').update({ 
            discount_amount: useMileage, 
            total_amount: payAmt 
        }).eq('id', window.currentDbId);
    }

    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    const method = selected ? selected.value : 'card';

    if (method === 'deposit') {
        await processDepositPayment();
    } else if (method === 'bank') {
        const depositorName = document.getElementById('inputDepositorName').value;
        if (!depositorName) return alert("입금자명을 입력해주세요.");
        if(confirm(window.t('confirm_bank_payment'))) {
            await sb.from('orders').update({ 
                status: '접수됨', payment_method: '무통장입금', payment_status: '입금대기', depositor_name: depositorName 
            }).eq('id', window.currentDbId);
            alert(window.t('msg_order_complete_bank'));
            location.reload();
        }
    } else {
        processCardPayment();
    }
}

// ★ [예치금 결제 로직]
async function processDepositPayment() {
    if (!currentUser) return alert("로그인이 필요합니다.");
    
    const balanceSpan = document.getElementById('myCurrentDepositDisplay');
    const currentBalance = parseInt(balanceSpan.dataset.balance || 0);
    const payAmount = finalPaymentAmount;

    if (currentBalance < payAmount) {
        const shortage = (payAmount - currentBalance).toLocaleString();
        return alert(window.t('alert_deposit_shortage').replace('{amount}', shortage));
    }

    if (!confirm(window.t('confirm_deposit_pay').replace('{amount}', payAmount.toLocaleString()))) return;

    const loading = document.getElementById("loading");
    loading.style.display = 'flex'; loading.querySelector('p').innerText = window.t('msg_processing_payment');

    try {
        // 1. 차감 후 잔액 계산
        const newBalance = currentBalance - payAmount;

        // 2. 프로필 업데이트 (차감)
        const { error: profileErr } = await sb.from('profiles').update({ deposit: newBalance }).eq('id', currentUser.id);
        if (profileErr) throw profileErr;

        // 3. 로그 기록
        await sb.from('wallet_logs').insert({
            user_id: currentUser.id,
            type: 'payment_order',
            amount: -payAmount,
            description: `주문 결제 (주문번호: ${window.currentDbId})`
        });

        // 4. 주문 상태 변경 (결제완료)
        await sb.from('orders').update({ 
            payment_status: '결제완료', 
            payment_method: '예치금',
            status: '접수됨' // 바로 접수 상태로 변경
        }).eq('id', window.currentDbId);

        alert(window.t('msg_payment_complete'));
        location.reload();

    } catch (e) {
        console.error(e);
        alert("결제 처리 중 오류가 발생했습니다: " + e.message);
    } finally {
        loading.style.display = 'none';
    }
}

// [카드 결제 로직]
function processCardPayment() {
    const country = SITE_CONFIG.COUNTRY;
    const pgConfig = SITE_CONFIG.PG_CONFIG[country];
    if (!pgConfig) return alert("PG 설정 오류: 해당 국가의 결제 설정이 없습니다.");

    const orderName = `Chameleon Order #${window.currentDbId}`;
    const customerName = document.getElementById("orderName").value;

    // [수정] 입력된 마일리지 값을 가져와 실시간으로 최종 결제액 계산
    const mileageInput = document.getElementById('inputUseMileage');
    const useMileage = mileageInput ? (parseInt(mileageInput.value) || 0) : 0;
    
    // 원래금액(finalPaymentAmount) - 마일리지사용액 = 실결제금액
    const realPayAmount = finalPaymentAmount - useMileage;

    // (안전장치) 금액이 0원 이하인 경우
    if (realPayAmount < 0) return alert("결제 금액 오류입니다.");

    if (pgConfig.provider === 'toss') {
        if (!window.TossPayments) return alert("Toss Payments SDK가 로드되지 않았습니다.");
        
        const tossPayments = TossPayments(pgConfig.clientKey);
        tossPayments.requestPayment("카드", { 
            amount: realPayAmount,  // [핵심] 차감된 금액 적용
            orderId: "ORD-" + new Date().getTime() + "-" + window.currentDbId, 
            orderName: orderName, 
            customerName: customerName, 
            successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}`, 
            failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, 
        }).catch(error => { 
            if (error.code !== "USER_CANCEL") alert("결제 오류: " + error.message); 
        });

    } else if (pgConfig.provider === 'stripe') {
        // 스트라이프도 동일하게 차감된 금액 적용
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

// 1. 에디터 없이 상품만 장바구니에 담기
// [수정] 수량(targetQty) 파라미터 추가
export function addProductToCartDirectly(productInfo, targetQty = 1) {
    if (!productInfo) return;

    // [방어 코드 1] 1초 이내 재실행 방지 (더블클릭 문제 차단)
    const now = Date.now();
    if (now - lastCartAddTime < 1000) {
        console.warn("중복 추가 방지됨");
        return;
    }
    lastCartAddTime = now;

    // [방어 코드 2] 디자인 저장 기능(회색박스 생성)이 동시에 실행되지 않도록 깃발 꽂기
    window.isDirectCartAddInProgress = true;
    setTimeout(() => { window.isDirectCartAddInProgress = false; }, 2000); // 2초간 유지

    cartData.push({
        uid: now, // Date.now() 사용
        product: productInfo,
        type: 'product_only', // 에디터 작업 아님 표시
        fileName: '(파일 별도 첨부)',
        thumb: productInfo.img || 'https://placehold.co/100?text=Product',
        json: null,
        width: productInfo.w || 0,
        height: productInfo.h || 0,
        isOpen: true,
        qty: parseInt(targetQty) || 1, // [수정] 전달받은 수량 적용
        selectedAddons: {},
        addonQuantities: {}
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