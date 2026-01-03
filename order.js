import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js";
import { SITE_CONFIG } from "./site-config.js";
import { applySize } from "./canvas-size.js";
import { 
    generateOrderSheetPDF, 
    generateQuotationPDF, 
    generateProductVectorPDF, 
    generateRasterPDF 
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
export async function initOrderSystem() {
    await fetchUserDiscountRate(); // 할인율 조회

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
            btn.innerText = "생성 중..."; btn.disabled = true;
            try {
                const info = { 
                    manager: currentUser?.user_metadata?.full_name || '고객', 
                    phone: currentUser?.user_metadata?.phone || '-', 
                    address: '-', 
                    note: '', 
                    date: new Date().toLocaleDateString() 
                };
                const blob = await generateQuotationPDF(info, cartData);
                if(blob) downloadBlob(blob, "견적서.pdf");
                else alert("견적서 생성 실패");
            } catch(e) {
                console.error(e);
                alert("견적서 오류: " + e.message);
            } finally {
                btn.innerText = "견적서 출력"; btn.disabled = false;
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
                document.getElementById('btnFinalPay').innerText = "주문 완료하기";
            } else {
                if(bankBox) bankBox.style.display = 'none';
                document.getElementById('btnFinalPay').innerText = "결제하기";
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
            try {
                const blob = await generateQuotationPDF(info, cartData);
                if(blob) downloadBlob(blob, `견적서_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("PDF 생성 실패"); }
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
        
        if (role === 'franchise') currentUserDiscountRate = 0.15; // 15%
        else if (role === 'platinum') currentUserDiscountRate = 0.10; // 10%
        else if (role === 'gold') currentUserDiscountRate = 0.05; // 5%
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
    if (!canvas) return;
    
    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = "디자인 처리 중...";
    }

    const originalVpt = canvas.viewportTransform;
    const board = canvas.getObjects().find(o => o.isBoard);
    let thumbUrl = "https://placehold.co/100?text=Design";
    
    // 1. 썸네일 생성
    try {
        let blob;
        if (board) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            const dataUrl = canvas.toDataURL({ 
                format: 'png', 
                left: board.left, 
                top: board.top, 
                width: board.width * board.scaleX, 
                height: board.height * board.scaleY, 
                multiplier: 0.5, 
                quality: 0.8 
            });
            blob = await (await fetch(dataUrl)).blob();
            canvas.setViewportTransform(originalVpt);
        } else {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            blob = await new Promise(resolve => canvas.getElement().toBlob(resolve, 'image/jpeg', 0.5));
            canvas.setViewportTransform(originalVpt);
        }
        
        if(blob) {
            const uploadedThumb = await uploadFileToSupabase(blob, 'thumbs');
            if(uploadedThumb) thumbUrl = uploadedThumb;
        }
    } catch(e) { 
        console.warn("썸네일 생성 실패", e); 
        canvas.setViewportTransform(originalVpt);
    } 

    // 2. 상품 정보 확인 (없으면 복구)
    let key = window.currentProductKey || canvas.currentProductKey;
    if (!key) key = localStorage.getItem('current_product_key') || 'A4';

    // ★ [핵심] 상품 정보가 없으면 서버에서 가져와서 채워넣음
    if (!PRODUCT_DB[key]) {
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

    let product = PRODUCT_DB[key];
    
    // 그래도 없으면 안전장치
    if (!product) {
        product = { name: '상품 정보 없음', price: 0, img: 'https://placehold.co/100', addons: [] };
    }
    
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst', 'shadow']);
    const finalW = board ? board.width * board.scaleX : (product.w || canvas.width); 
    const finalH = board ? board.height * board.scaleY : (product.h || canvas.height);
    const boardX = board ? board.left : 0;
    const boardY = board ? board.top : 0;

    let originalFileUrl = null; 
    let fileName = "나만의 디자인";
    if (window.currentUploadedPdfUrl) {
        originalFileUrl = window.currentUploadedPdfUrl;
        fileName = "업로드된_PDF_원본.pdf"; 
        window.currentUploadedPdfUrl = null; 
    }

    if(loading) loading.style.display = "none";

    // 3. 카트에 담기
    cartData.push({ 
        uid: Date.now(), 
        product: product, // 이제 정보가 들어있음
        type: 'design', 
        thumb: thumbUrl, 
        json: json, 
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
    document.getElementById('cartPage').style.display = 'block';
    
    if(document.body.classList.contains('editor-active')) {
        document.body.classList.remove('editor-active');
    }
}

async function addFileToCart(e) {
    const file = e.target.files[0]; 
    if(!file || !currentTargetProduct) return;
    
    const loading = document.getElementById("loading");
    if(loading) { loading.style.display = "flex"; loading.querySelector('p').innerText = "파일 업로드 중..."; }
    
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
        alert("파일 주문이 장바구니에 담겼습니다.");
    } catch(err) { 
        console.error(err); 
        alert("실패: " + err.message); 
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
        listArea.innerHTML = `<div style="text-align:center; padding:60px 0; color:#94a3b8;">장바구니가 비어있습니다.</div>`; 
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
                    <div style="font-size:13px; color:#666; margin-top:4px;">${item.fileName || "사용자 디자인"}</div>
                    <div style="font-weight:bold; color:#6366f1; margin-top:5px;">${formatCurrency(totalItemPrice)}</div>
                </div>
                <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        
        if(item.isOpen) {
            const optionContainer = document.createElement("div"); optionContainer.style.marginTop = "15px";
            
            if (matOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">① 재질/두께 <span class="badge-req">필수</span></div>`;
                const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_mat', e.target.value);
                let optsHTML = `<option value="">선택해주세요</option>`;
                matOpts.forEach(opt => { 
                    const selected = item.selectedAddons['opt_mat'] === opt.code ? 'selected' : ''; 
                    const priceStr = opt.price > 0 ? ` (+${formatCurrency(opt.price)})` : ''; 
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; 
                });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }
            if (finOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">② 마감 방식 <span class="badge-req">필수</span></div>`;
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
                box.innerHTML = `<div class="opt-group-header">③ 추가 상품 <span class="badge-sel">선택</span></div>`;
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
            qtyBox.innerHTML = `<span style="font-size:13px; font-weight:bold;">본품 수량</span><div class="qty-wrapper" style="border:1px solid #ddd; border-radius:5px; display:flex;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button><input type="number" value="${item.qty}" onchange="window.updateCartQtyInput(${idx}, this.value)" style="width:50px; text-align:center; border:none; border-left:1px solid #eee; border-right:1px solid #eee; height:30px; font-weight:bold; outline:none;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button></div>`;
            optionContainer.appendChild(qtyBox); div.appendChild(optionContainer);
        }
        listArea.appendChild(div);
    });
    
    updateSummary(grandProductTotal, grandAddonTotal, grandTotal);
}

function updateSummary(prodTotal, addonTotal, total) { 
    const elItem = document.getElementById("summaryItemPrice"); if(elItem) elItem.innerText = formatCurrency(prodTotal); 
    const elAddon = document.getElementById("summaryAddonPrice"); if(elAddon) elAddon.innerText = formatCurrency(addonTotal);
    
    const discountAmount = Math.floor(total * currentUserDiscountRate);
    const finalTotal = total - discountAmount;
    
    // [중요] 최종 결제 금액을 전역변수에 저장 (결제 함수에서 사용)
    finalPaymentAmount = finalTotal;

    const elDiscount = document.getElementById("summaryDiscount");
    if(elDiscount) {
        if(discountAmount > 0) {
            elDiscount.innerText = `-${formatCurrency(discountAmount)} (${(currentUserDiscountRate*100).toFixed(0)}%)`;
        } else {
            elDiscount.innerText = "0원 (0%)";
        }
    }

    const elTotal = document.getElementById("summaryTotal"); 
    if(elTotal) elTotal.innerText = formatCurrency(finalTotal); 
    
    const cartCount = document.getElementById("cartCount"); if(cartCount) cartCount.innerText = `(${cartData.length})`; 
    const btnCart = document.getElementById("btnViewCart"); 
    if (btnCart) btnCart.style.display = (cartData.length > 0 || currentUser) ? "inline-flex" : "none"; 
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

    if(!manager || !address) return alert("배송 정보를 모두 입력해주세요.");
    
    const btn = document.getElementById("btnSubmitOrderInfo"); 
    btn.disabled = true; 
    const loading = document.getElementById("loading");
    loading.style.display = "flex";
    loading.querySelector('p').innerText = "주문서를 작성하고 있습니다...";
    
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
            const compatibleUnitPrice = itemFinalTotal / qty;

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
            status: '접수대기', 
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
            loading.querySelector('p').innerText = "작업지시서 생성 중...";
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
            if (!item.originalUrl && item.type === 'design' && item.json && item.product) {
                loading.querySelector('p').innerText = `디자인 변환 중 (${i+1}/${cartData.length})...`;
                try { 
                    // [수정] 대지 좌표(x, y)까지 전달하여 정확한 위치 크롭
let fileBlob = await generateProductVectorPDF(item.json, item.width, item.height, item.boardX || 0, item.boardY || 0); 
if (!fileBlob) fileBlob = await generateRasterPDF(item.json, item.width, item.height, item.boardX || 0, item.boardY || 0);
                    
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

        alert(`주문이 정상적으로 접수되었습니다.\n회원 등급 할인(${(currentUserDiscountRate*100).toFixed(0)}%)이 적용된 금액입니다.`);
        
        btn.innerText = "접수 완료";

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
async function processFinalPayment() {
    if (!window.currentDbId) return alert("주문 정보가 없습니다.");
    
    // 선택된 결제 방식 확인
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    const method = selected ? selected.value : 'card';

    if (method === 'deposit') {
        // [예치금 결제]
        await processDepositPayment();
    } else if (method === 'bank') {
        // [무통장 입금]
        if(confirm("무통장 입금으로 주문하시겠습니까?\n입금 확인 후 제작이 진행됩니다.")) {
            await sb.from('orders').update({ payment_method: '무통장입금', payment_status: '입금대기' }).eq('id', window.currentDbId);
            alert("주문이 완료되었습니다.\n안내된 계좌로 입금해주세요.");
            location.reload();
        }
    } else {
        // [카드/간편결제]
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
        return alert(`예치금 잔액이 부족합니다.\n(부족금액: ${(payAmount - currentBalance).toLocaleString()}원)`);
    }

    if (!confirm(`예치금 ${payAmount.toLocaleString()}원을 사용하여 결제하시겠습니까?`)) return;

    const loading = document.getElementById("loading");
    loading.style.display = 'flex'; loading.querySelector('p').innerText = "예치금 결제 중...";

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

        alert("결제가 완료되었습니다!");
        location.reload();

    } catch (e) {
        console.error(e);
        alert("결제 처리 중 오류가 발생했습니다: " + e.message);
    } finally {
        loading.style.display = 'none';
    }
}

// [수정된 카드 결제 함수]
function processCardPayment() {
    // 주문명 설정
    const orderName = `Chameleon Order #${window.currentDbId}`;
    // 주문자명 가져오기
    const nameInput = document.getElementById("orderName");
    const customerName = nameInput ? nameInput.value : "고객";

    // 1. 한국 (토스 결제)
    if (SITE_CONFIG.pgProvider === 'toss') {
        if (!window.TossPayments) return alert("토스 결제 모듈을 불러오지 못했습니다.");
        
        // site-config.js에 있는 토스 키 사용
        const tossPayments = TossPayments(SITE_CONFIG.tossClientKey);

        tossPayments.requestPayment("카드", { 
            amount: finalPaymentAmount, 
            orderId: "ORD-" + new Date().getTime() + "-" + window.currentDbId, 
            orderName: orderName, 
            customerName: customerName, 
            successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}`, 
            failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, 
        }).catch(error => { 
            if (error.code !== "USER_CANCEL") alert("결제 오류: " + error.message); 
        });

    } 
    // 2. 해외 (스트라이프 결제)
    else if (SITE_CONFIG.pgProvider === 'stripe') {
        // 스트라이프 키 사용
        initiateStripeCheckout(SITE_CONFIG.stripePublicKey, finalPaymentAmount, SITE_CONFIG.code, window.currentDbId);
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