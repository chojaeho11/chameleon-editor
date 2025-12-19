// order.js

import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js";
import { SITE_CONFIG } from "./site-config.js"; 
import { applySize } from "./canvas-size.js";
import { generateOrderSheetPDF, generateQuotationPDF, generateProductVectorPDF, generateRasterPDF } from "./export.js"; 

let currentTargetProduct = null;
let selectedDeliveryDate = null;

// [헬퍼] 통화 포맷터 (국가별 화폐 단위 자동 적용)
function formatCurrency(amount) {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');
    
    // 숫자가 아니면 0으로 처리
    const num = parseInt(amount) || 0;

    if (lang === 'jp') {
        return '¥' + num.toLocaleString();
    } else if (lang === 'us') {
        return '$' + num.toLocaleString();
    } else {
        return num.toLocaleString() + '원';
    }
}

// [헬퍼] Blob 파일 다운로드
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// [헬퍼] PDF 라이브러리 로드 확인 및 설정
async function loadPdfLib() {
    if (!window.pdfjsLib) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    // 워커 설정 필수
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
}

// [헬퍼] PDF -> 이미지 Blob 변환 (캡쳐용)
async function createPdfThumbnailBlob(file) {
    // 50MB 이상 대용량은 브라우저 다운 방지를 위해 캡쳐 생략
    if (file.size > 50 * 1024 * 1024) return null;

    await loadPdfLib();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // 1페이지 캡쳐
        
        const viewport = page.getViewport({ scale: 1 }); // 원본 비율
        // 썸네일용 리사이징 (너비 800px 기준)
        const scale = 800 / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        
        return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    } catch (e) {
        console.warn("PDF 썸네일 생성 실패:", e);
        return null; 
    }
}

// [헬퍼] 이미지 리사이징 후 Blob 반환
const resizeImageToBlob = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const maxDim = 1000;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                    else { w = Math.round(w * maxDim / h); h = maxDim; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(resolve, 'image/jpeg', 0.8);
            };
        };
    });
};

// [헬퍼] 파일을 Supabase에 업로드하고 URL 반환
async function uploadFileToSupabase(file, folder) {
    if (!sb) return null;
    // 파일명 한글 안전하게 변환
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
// [1] 주문 시스템 초기화
// ============================================================
export function initOrderSystem() {
    // 국가별 주소 폼 및 결제 안내문 토글 로직
    const country = SITE_CONFIG.COUNTRY;
    const krForm = document.getElementById("addrFormKR");
    const globalForm = document.getElementById("addrFormGlobal");
    const bankArea = document.getElementById("bankTransferInfoArea");

    if (country === 'KR') {
        if(krForm) krForm.style.display = 'block';
        if(globalForm) globalForm.style.display = 'none';
        if(bankArea) bankArea.style.display = 'block'; // 한국만 무통장 입금 표시
    } else {
        if(krForm) krForm.style.display = 'none';
        if(globalForm) globalForm.style.display = 'flex';
        if(bankArea) bankArea.style.display = 'none'; // 해외는 카드결제만 유도
    }

    const btnOrderTop = document.getElementById("btnOrderTop");
    if(btnOrderTop) { 
        btnOrderTop.onclick = addCanvasToCart;
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
    const btnQuote = document.getElementById("btnPrintQuote");
    if (btnQuote) {
        btnQuote.onclick = async () => {
            // 1. 장바구니 비었는지 확인
            if (!cartData || cartData.length === 0) {
                return alert("장바구니에 담긴 상품이 없습니다.");
            }

            // 2. 버튼 텍스트 변경 (로딩 중 표시)
            const originalText = btnQuote.innerHTML;
            btnQuote.innerText = "생성 중...";
            btnQuote.disabled = true;
            
            try {
                // 3. 임시 주문 정보 만들기 (아직 배송지 입력 전이므로)
                const tempOrderInfo = {
                    manager: "고객 (온라인 견적)", 
                    date: new Date().toLocaleDateString(),
                    address: "(배송지 정보 없음)",
                    phone: "-",
                    note: "장바구니에서 출력된 가견적서입니다."
                };

                // 4. export.js에 있는 함수 호출
                const blob = await generateQuotationPDF(tempOrderInfo, cartData);
                
                // 5. 다운로드 실행
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `견적서_${new Date().getFullYear()}${new Date().getMonth()+1}${new Date().getDate()}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            } catch (e) {
                console.error(e);
                alert("견적서 생성 중 오류가 발생했습니다.");
            } finally {
                // 6. 버튼 원상복구
                btnQuote.innerHTML = originalText;
                btnQuote.disabled = false;
            }
        };
    }
    
    const btnPrev = document.getElementById("btnPrevMonth");
    if(btnPrev) btnPrev.onclick = () => changeMonth(-1);
    const btnNext = document.getElementById("btnNextMonth");
    if(btnNext) btnNext.onclick = () => changeMonth(1);
    
    const btnSubmit = document.getElementById("btnSubmitOrderInfo");
    if(btnSubmit) btnSubmit.onclick = processOrderSubmission;
    
    const btnPayment = document.getElementById("btnRealPayment");
    if(btnPayment) btnPayment.onclick = processPayment;

    // 결제 모달 닫기
    const checkoutModal = document.getElementById('checkoutModal');
    if(checkoutModal) {
        const closeBtns = checkoutModal.querySelectorAll('button');
        closeBtns.forEach(btn => {
            if(btn.innerText.includes('닫기')) {
                btn.onclick = () => {
                    checkoutModal.style.display = 'none';
                    if (window.isOrderCompleted) window.location.reload();
                };
            }
        });
    }

    // 다운로드 버튼
    const btnDownSheet = document.getElementById("btnDownOrderSheetCheckout");
    const btnDownQuote = document.getElementById("btnDownQuotationCheckout");

    if(btnDownSheet) {
        btnDownSheet.onclick = async () => {
            if(cartData.length === 0) return alert("주문할 상품이 없습니다.");
            const info = getOrderInfo();
            try {
                const blob = await generateOrderSheetPDF(info, cartData);
                if(blob) downloadBlob(blob, `작업지시서_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("PDF 생성 실패"); }
        };
    }
    if(btnDownQuote) {
        btnDownQuote.onclick = async () => {
            if(cartData.length === 0) return alert("주문할 상품이 없습니다.");
             const info = getOrderInfo();
            try {
                const blob = await generateQuotationPDF(info, cartData);
                if(blob) downloadBlob(blob, `견적서_${info.manager}.pdf`);
            } catch(e) { console.error(e); alert("PDF 생성 실패"); }
        };
    }
    renderCart();
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

let currentCalDate = new Date();
function openCalendarModal() { document.getElementById("cartPage").style.display = "none"; document.getElementById("calendarModal").style.display = "flex"; renderCalendar(); }
function changeMonth(delta) { currentCalDate.setMonth(currentCalDate.getMonth() + delta); renderCalendar(); }
function renderCalendar() {
    const grid = document.getElementById("calendarGrid"); const year = currentCalDate.getFullYear(); const month = currentCalDate.getMonth();
    document.getElementById("currentMonthYear").innerText = `${year}. ${String(month+1).padStart(2,'0')}`; grid.innerHTML = "";
    ['일','월','화','수','목','금','토'].forEach(d => grid.innerHTML += `<div class="cal-day-header">${d}</div>`);
    const firstDay = new Date(year, month, 1).getDay(); const lastDate = new Date(year, month + 1, 0).getDate();
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
    let minDate = new Date(); let count = 0; while(count < 3) { minDate.setDate(minDate.getDate() + 1); if(minDate.getDay() !== 0 && minDate.getDay() !== 6) count++; }
    for(let i=1; i<=lastDate; i++) {
        const dateObj = new Date(year, month, i); const div = document.createElement("div"); div.className = "cal-day"; div.innerText = i;
        const checkDate = new Date(dateObj); checkDate.setHours(0,0,0,0); const limitDate = new Date(minDate); limitDate.setHours(0,0,0,0);
        if(checkDate < limitDate || dateObj.getDay() === 0 || dateObj.getDay() === 6) { div.classList.add("disabled"); } 
        else { div.onclick = () => { document.querySelectorAll(".cal-day").forEach(d => d.classList.remove("selected")); div.classList.add("selected"); selectedDeliveryDate = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`; openDeliveryInfoModal(); }; }
        grid.appendChild(div);
    }
}
function openDeliveryInfoModal() { document.getElementById("calendarModal").style.display = "none"; document.getElementById("deliveryInfoModal").style.display = "flex"; }

function saveCart() { 
    try { 
        const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
        const dataStr = JSON.stringify(cartData);
        localStorage.setItem(storageKey, dataStr); 
    } catch(e) { console.warn("장바구니 로컬 저장 실패 (용량 초과):", e); } 
}

export function openProductDetail(key, w, h, mode) {
    let product = PRODUCT_DB[key]; if (!product) { product = { name: key, price: 0, img: '', addons: [] }; }
    currentTargetProduct = { key, w, h, mode, info: product };
    document.getElementById("pdpTitle").innerText = product.name; 
    document.getElementById("pdpPrice").innerText = formatCurrency(product.price);
    const imgElem = document.getElementById("pdpImage"); if(imgElem) imgElem.src = product.img || 'https://placehold.co/400';
    document.getElementById("productDetailModal").style.display = "flex";
}

// 상품 선택 -> 에디터 진입 -> DB 조회 -> 템플릿 자동 로드
export async function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    
    document.getElementById("productDetailModal").style.display = "none"; 
    
    if(window.applySize) {
        window.applySize(
            currentTargetProduct.w, 
            currentTargetProduct.h, 
            currentTargetProduct.key, 
            currentTargetProduct.mode, 
            'replace'
        ); 
    }

    const startScreen = document.getElementById("startScreen");
    const mainEditor = document.getElementById("mainEditor");
    if(startScreen) startScreen.style.display = "none";
    if(mainEditor) mainEditor.style.display = "flex";
    window.dispatchEvent(new Event('resize')); 
    
    if(canvas) canvas.currentProductKey = currentTargetProduct.key; 
    window.currentProductKey = currentTargetProduct.key;

    try {
        const pKey = currentTargetProduct.key;
        console.log(`🔎 자동 템플릿 검색 중... Product Key: [${pKey}]`);
        
        const { data, error } = await sb
            .from('library')
            .select('data_url')
            .eq('product_key', pKey)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            const templateUrl = data[0].data_url;
            console.log("🎯 자동 로드할 템플릿 발견! URL:", templateUrl);
            
            setTimeout(() => {
                if (window.loadProductFixedTemplate) {
                    window.loadProductFixedTemplate(templateUrl);
                }
            }, 500);
        }
    } catch (e) {
        console.error("🚨 자동 템플릿 로드 중 오류 발생:", e);
    }
}

// ============================================================
// 장바구니 담기 (PDF 원본 패스스루 적용)
// ============================================================
async function addCanvasToCart() {
    if (!canvas) return;
    
    const originalVpt = canvas.viewportTransform;
    const board = canvas.getObjects().find(o => o.isBoard);
    let thumbUrl = "https://placehold.co/100?text=Design";
    
    try {
        const loading = document.getElementById("loading");
        if(loading) loading.style.display = "flex";

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
    } finally {
        const loading = document.getElementById("loading");
        if(loading) loading.style.display = "none";
    }
    
    const key = window.currentProductKey || canvas.currentProductKey || 'A4'; 
    const product = PRODUCT_DB[key] || PRODUCT_DB['A4'];
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst']);
    const finalW = board ? board.width : (product.w || canvas.width); 
    const finalH = board ? board.height : (product.h || canvas.height);

    // ★ [핵심] 원본 PDF가 있는지 확인 (Pass-Through Logic)
    let originalFileUrl = null;
    let fileName = "나만의 디자인";

    if (window.currentUploadedPdfUrl) {
        originalFileUrl = window.currentUploadedPdfUrl;
        
        // [수정] 파일 이름 뒤에 '.pdf'를 꼭 붙여야 다운로드 시 오류가 안 납니다.
        fileName = "업로드된_PDF_원본.pdf"; 
        
        // 사용 후 초기화 (다음 주문을 위해)
        window.currentUploadedPdfUrl = null; 
    }

    cartData.push({ 
        uid: Date.now(), 
        product: product, 
        type: 'design', 
        thumb: thumbUrl, 
        json: json, 
        // 원본 주소 저장
        originalUrl: originalFileUrl, 
        fileName: fileName,
        width: finalW, 
        height: finalH, 
        isOpen: true, 
        qty: 1, 
        selectedAddons: {}, 
        addonQuantities: {} 
    });
    
    saveCart(); 
    renderCart(); 
    
    const t = window.translations || {};
    alert(`[${product.name}] ` + (t['msg_cart_added'] || "상품이 장바구니에 담겼습니다."));
}

// ============================================================
// 파일 업로드 (직접 업로드)
// ============================================================
async function addFileToCart(e) {
    const file = e.target.files[0]; 
    if(!file || !currentTargetProduct) return;
    
    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = "파일 분석 및 썸네일 생성 중...";
    }
    
    try {
        let originalUrl = null;
        let thumbUrl = 'https://cdn-icons-png.flaticon.com/512/337/337946.png'; 

        originalUrl = await uploadFileToSupabase(file, 'customer_uploads');
        
        let thumbBlob = null;
        if (file.type === 'application/pdf') {
            thumbBlob = await createPdfThumbnailBlob(file);
        } else if (file.type.startsWith('image/')) {
            thumbBlob = await resizeImageToBlob(file);
        }

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
        alert("업로드 완료");

    } catch(err) {
        console.error(err);
        alert("실패: " + err.message);
    } finally {
        if(loading) { loading.style.display = "none"; loading.querySelector('p').innerText = "로딩 중..."; }
        e.target.value = ''; 
    }
}

// ============================================================
// 장바구니 렌더링
// ============================================================
function renderCart() {
    const listArea = document.getElementById("cartListArea"); 
    if(!listArea) return;
    listArea.innerHTML = ""; 
    
    // [변수 추가] 상품합계, 옵션합계, 총합계를 분리해서 계산
    let grandTotal = 0;
    let grandProductTotal = 0; // 순수 상품 금액 합
    let grandAddonTotal = 0;   // 순수 옵션 금액 합
    
    const t = window.translations || {};
    const txt_empty = t['msg_cart_empty'] || "장바구니가 비어있습니다.";
    const txt_mat = t['label_material'] || "① 재질/두께";
    const txt_fin = t['label_finish'] || "② 마감 방식";
    const txt_add = t['label_addons'] || "③ 추가 상품";
    const txt_req = t['badge_required'] || "필수";
    const txt_sel = t['badge_select'] || "선택";
    const txt_qty = t['label_qty'] || "본품 수량";
    const txt_select_msg = t['msg_select_option'] || "선택해주세요";
    const txt_user_design = t['label_user_design'] || "사용자 디자인";
    
    if(cartData.length === 0) { 
        listArea.innerHTML = `<div style="text-align:center; padding:60px 0; color:#94a3b8;">${txt_empty}</div>`; 
        updateSummary(0, 0, 0); 
        return; 
    }
    
    cartData.forEach((item, idx) => {
        if (!item.qty) item.qty = 1; if (item.isOpen === undefined) item.isOpen = true; if (!item.selectedAddons) item.selectedAddons = {}; if (!item.addonQuantities) item.addonQuantities = {};
        
        let matOpts = []; let finOpts = []; let addOpts = []; 
        
        if (item.product && item.product.addons && Array.isArray(item.product.addons)) {
            item.product.addons.forEach(code => {
                const info = ADDON_DB[code]; 
                if (info) { 
                    const cat = (info.category || '').toLowerCase(); 
                    if (cat === 'material') matOpts.push({code, ...info}); 
                    else if (cat === 'finish') finOpts.push({code, ...info}); 
                    else addOpts.push({code, ...info}); 
                }
            });
        } else if (item.product && typeof item.product.addons === 'string') {
             item.product.addons.split(',').forEach(code => {
                const cleanCode = code.trim();
                const info = ADDON_DB[cleanCode];
                if(info) {
                    const cat = (info.category || '').toLowerCase();
                    if (cat === 'material') matOpts.push({code: cleanCode, ...info});
                    else if (cat === 'finish') finOpts.push({code: cleanCode, ...info});
                    else addOpts.push({code: cleanCode, ...info});
                }
             });
        }

        let basePrice = item.product.price || 0; 
        let addonPriceUnit = 0; // 개당 옵션 가격 합
        
        Object.values(item.selectedAddons).forEach(code => {
            const addon = ADDON_DB[code];
            if (addon) {
                const isAdditional = addOpts.some(a => a.code === code);
                const aq = isAdditional ? (item.addonQuantities[code] || 1) : 1;
                addonPriceUnit += addon.price * aq;
            }
        });

        const currentProductTotal = basePrice * item.qty;
        const currentAddonTotal = addonPriceUnit * item.qty;
        
        grandProductTotal += currentProductTotal;
        grandAddonTotal += currentAddonTotal;
        grandTotal += (currentProductTotal + currentAddonTotal);

        let totalItemPrice = currentProductTotal + currentAddonTotal;
        
        const div = document.createElement("div"); 
        div.className = "cart-item"; 
        
        div.innerHTML = `
            <div class="cart-top-row" onclick="window.toggleCartAccordion(${idx})" style="display:flex; gap:15px; align-items:center; cursor:pointer;">
                <div style="width:80px; height:80px; background:#f8fafc; border:1px solid #eee; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                    <img src="${item.thumb}" style="max-width:100%; max-height:100%; object-fit:contain;">
                </div>
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:16px;">${item.product.name}</h4>
                    <div style="font-size:13px; color:#666; margin-top:4px;">${item.fileName || txt_user_design}</div>
                    <div style="font-weight:bold; color:#6366f1; margin-top:5px;">${formatCurrency(totalItemPrice)}</div>
                </div>
                <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        
        if(item.isOpen) {
            const optionContainer = document.createElement("div"); optionContainer.style.marginTop = "15px";
            
            // 재질
            if (matOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">${txt_mat} <span class="badge-req">${txt_req}</span></div>`;
                const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_mat', e.target.value);
                
                let optsHTML = `<option value="">${txt_select_msg}</option>`;
                matOpts.forEach(opt => { 
                    const selected = item.selectedAddons['opt_mat'] === opt.code ? 'selected' : ''; 
                    const priceStr = opt.price > 0 ? ` (+${formatCurrency(opt.price)})` : ''; 
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; 
                });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }

            // 마감
            if (finOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">${txt_fin} <span class="badge-req">${txt_req}</span></div>`;
                const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_fin', e.target.value);
                
                let optsHTML = `<option value="">${txt_select_msg}</option>`;
                finOpts.forEach(opt => { 
                    const selected = item.selectedAddons['opt_fin'] === opt.code ? 'selected' : ''; 
                    const priceStr = opt.price > 0 ? ` (+${formatCurrency(opt.price)})` : ''; 
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; 
                });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }

            // 추가상품
            if (addOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group optional-group";
                box.innerHTML = `<div class="opt-group-header">${txt_add} <span class="badge-sel">${txt_sel}</span></div>`;
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

            // 본품 수량
            const qtyBox = document.createElement("div"); 
            qtyBox.style.cssText = "display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:15px;";
            qtyBox.innerHTML = `<span style="font-size:13px; font-weight:bold;">${txt_qty}</span><div class="qty-wrapper" style="border:1px solid #ddd; border-radius:5px; display:flex;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button><input type="number" value="${item.qty}" onchange="window.updateCartQtyInput(${idx}, this.value)" style="width:50px; text-align:center; border:none; border-left:1px solid #eee; border-right:1px solid #eee; height:30px; font-weight:bold; outline:none;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button></div>`;
            optionContainer.appendChild(qtyBox); div.appendChild(optionContainer);
        }
        listArea.appendChild(div);
    });
    
    updateSummary(grandProductTotal, grandAddonTotal, grandTotal);
}

function updateSummary(prodTotal, addonTotal, total) { 
    const elItem = document.getElementById("summaryItemPrice"); 
    const elAddon = document.getElementById("summaryAddonPrice"); 
    const elTotal = document.getElementById("summaryTotal"); 
    
    if(elItem) elItem.innerText = formatCurrency(prodTotal); 
    if(elAddon) elAddon.innerText = formatCurrency(addonTotal);
    if(elTotal) elTotal.innerText = formatCurrency(total); 
    
    const cartCount = document.getElementById("cartCount"); 
    if(cartCount) cartCount.innerText = `(${cartData.length})`; 
    
    const btnCart = document.getElementById("btnViewCart"); 
    if (btnCart) { 
        btnCart.style.display = (cartData.length > 0 || currentUser) ? "inline-flex" : "none"; 
    } 
}

// ============================================================
// [중요] 주문 제출 및 파일 안전 저장
// ============================================================
async function processOrderSubmission() {
    const manager = document.getElementById("inputManagerName").value;
    const phone = document.getElementById("inputManagerPhone").value;
    const request = document.getElementById("inputRequest").value;
    
    // 주소 조합 로직
    let address = "";
    if (SITE_CONFIG.COUNTRY === 'KR') {
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
    document.getElementById("loading").style.display = "flex";
    
    let newOrderId = null;
    
    try {
        let calculatedTotal = 0;
        const itemsToSave = cartData.map(item => {
            let itemPrice = item.product.price || 0;
            if(item.selectedAddons) {
                Object.values(item.selectedAddons).forEach(code => {
                    const addon = ADDON_DB[code];
                    const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
                    if(addon) itemPrice += addon.price * aq;
                });
            }
            calculatedTotal += itemPrice * (item.qty || 1);
            return {
                product: { name: item.product.name, price: item.product.price, code: item.product.code || item.product.key },
                qty: item.qty || 1, price: itemPrice, 
                selectedAddons: item.selectedAddons || {}, addonQuantities: item.addonQuantities || {}, 
                productName: item.product.name
            };
        });

        // 1. 주문 생성
        const { data: orderData, error: orderError } = await sb.from('orders').insert([{ 
            order_date: selectedDeliveryDate,           
            delivery_target_date: selectedDeliveryDate, 
            manager_name: manager, 
            phone, 
            address, 
            request_note: request, 
            status: '접수대기', 
            payment_status: '미결제', 
            total_amount: calculatedTotal, 
            items: itemsToSave
        }]).select();
        
        if (orderError) throw orderError; 
        newOrderId = orderData[0].id; window.currentDbId = newOrderId;
        
        // ============================================================
        // ★ [안전장치] 고객 파일부터 먼저 찾아내서 DB에 즉시 저장!
        // ============================================================
        let uploadedFiles = [];

        for (let i = 0; i < cartData.length; i++) {
            const item = cartData[i]; 
            const idx = String(i + 1).padStart(2, '0');
            
            // originalUrl이 있으면 (PDF 패스스루 또는 직접 업로드)
            if (item.originalUrl) {
                uploadedFiles.push({ 
                    name: `고객파일_${idx}_${item.fileName || 'file'}`, 
                    url: item.originalUrl, 
                    type: 'customer_file' 
                });
            }
        }

        // 1차 강제 업데이트: PDF 생성 전 저장
        if (uploadedFiles.length > 0) {
            await sb.from('orders').update({ files: uploadedFiles }).eq('id', newOrderId);
        }

        // ============================================================
        // 2. 문서 및 디자인 PDF 생성 (실패해도 진행)
        // ============================================================
        btn.innerText = "문서 생성 중...";
        
        try {
            const orderInfoForPDF = { manager, phone, address, note: request, date: selectedDeliveryDate };
            
            // 작업지시서
            try {
                const orderSheetBlob = await generateOrderSheetPDF(orderInfoForPDF, cartData); 
                if(orderSheetBlob) { 
                    const url = await uploadFileToSupabase(orderSheetBlob, `orders/${newOrderId}/order_sheet.pdf`); 
                    if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
                }
            } catch(pdfErr) { console.warn("지시서 생성 실패:", pdfErr); }

            // 견적서
            try {
                const quoteBlob = await generateQuotationPDF(orderInfoForPDF, cartData); 
                if(quoteBlob) { 
                    const url = await uploadFileToSupabase(quoteBlob, `orders/${newOrderId}/quotation.pdf`); 
                    if(url) uploadedFiles.push({ name: `견적서.pdf`, url: url, type: 'quotation' }); 
                } 
            } catch(quoteErr) { console.warn("견적서 생성 실패:", quoteErr); }
            
            // 디자인 파일 변환 (원본 없을 때만)
            for (let i = 0; i < cartData.length; i++) {
                const item = cartData[i]; 
                const idx = String(i + 1).padStart(2, '0');
                
                // 원본이 없고, 에디터에서 직접 그린 경우만 변환
                if (!item.originalUrl && item.type === 'design' && item.json) {
                    btn.innerText = `디자인 변환 중 (${i+1}/${cartData.length})...`;
                    try { 
                        // 벡터 시도 -> 실패시 래스터 자동 전환
                        let fileBlob = await generateProductVectorPDF(item.json, item.width, item.height); 
                        if (!fileBlob) fileBlob = await generateRasterPDF(item.json, item.width, item.height); 
                        
                        if(fileBlob) {
                            const url = await uploadFileToSupabase(fileBlob, `orders/${newOrderId}/design_${idx}.pdf`); 
                            if(url) uploadedFiles.push({ name: `제작물_${idx}_${item.product.name}.pdf`, url: url, type: 'product' }); 
                        }
                    } catch(designErr) { console.warn(`디자인 ${idx} 변환 실패:`, designErr); }
                }
            }

            // 3. 최종 업데이트 (생성된 PDF 포함)
            btn.innerText = "저장 중...";
            await sb.from('orders').update({ files: uploadedFiles, status: '접수됨' }).eq('id', newOrderId);

        } catch (fatalErr) {
            console.error("PDF 생성 단계 오류:", fatalErr);
        }
        
        // 4. 완료 처리
        document.getElementById("deliveryInfoModal").style.display = "none"; 
        document.getElementById("checkoutModal").style.display = "flex";
        document.getElementById("orderName").value = manager; 
        document.getElementById("orderPhone").value = phone; 
        document.getElementById("orderAddr").value = address; 
        document.getElementById("orderMemo").value = request;
        
    } catch (e) { 
        console.error(e); 
        alert("주문 처리 중 오류 발생: " + e.message); 
    } finally { 
        btn.innerText = "주문서 생성 및 결제"; 
        btn.disabled = false; 
        document.getElementById("loading").style.display = "none"; 
    }
}

// ============================================================
// 결제 처리
// ============================================================
function processPayment() {
    if (!window.currentDbId) return alert("주문 정보가 없습니다.");
    
    let totalAmount = 0; 
    cartData.forEach(item => { 
        let price = item.product.price;
        if(item.selectedAddons) { 
            Object.values(item.selectedAddons).forEach(code => { 
                if(ADDON_DB[code]) { 
                    const aq = (item.addonQuantities && item.addonQuantities[code]) || 1; 
                    price += ADDON_DB[code].price * aq; 
                } 
            }); 
        } 
        totalAmount += price * (item.qty || 1); 
    });

    if (totalAmount === 0) return alert("결제 금액이 0원입니다.");

    const country = SITE_CONFIG.COUNTRY;
    const pgConfig = SITE_CONFIG.PG_CONFIG[country];
    const orderName = `Chameleon Order (${cartData.length})`;
    const customerName = document.getElementById("orderName").value;

    if (pgConfig.provider === 'toss') {
        if (typeof TossPayments === 'undefined') return alert("결제 모듈 로드 실패");
        const tossPayments = TossPayments(pgConfig.clientKey);
        const orderId = "ORD-" + new Date().getTime(); 
        
        tossPayments.requestPayment("카드", { 
            amount: totalAmount, 
            orderId: orderId, 
            orderName: orderName, 
            customerName: customerName, 
            successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}`, 
            failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, 
        }).catch(error => {
            if (error.code === "USER_CANCEL") alert("결제가 취소되었습니다.");
            else alert("결제 오류: " + error.message);
        });

    } else if (pgConfig.provider === 'stripe') {
        initiateStripeCheckout(pgConfig.publishableKey, totalAmount, country, window.currentDbId);
    }
}

async function initiateStripeCheckout(pubKey, amount, currencyCountry, orderDbId) {
    if (typeof Stripe === 'undefined') return alert("Stripe 모듈 로드 실패");
    const stripe = Stripe(pubKey);
    const btn = document.getElementById("btnRealPayment");
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
                cancel_url: window.location.href
            }
        });

        if (error) throw error;

        const result = await stripe.redirectToCheckout({
            sessionId: data.sessionId
        });

        if (result.error) alert(result.error.message);
        
    } catch (e) {
        console.error("Stripe Error:", e);
        alert("결제 초기화 실패: " + e.message + "\n(백엔드 설정이 필요합니다)");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ============================================================
// Window 객체 연결 (HTML 이벤트용)
// ============================================================
window.toggleCartAccordion = function(idx) {
    if (cartData[idx]) {
        cartData[idx].isOpen = !cartData[idx].isOpen;
        renderCart();
    }
};

window.removeCartItem = function(idx) {
    if (confirm("정말 삭제하시겠습니까?")) {
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
            if (!cartData[idx].addonQuantities[code]) {
                cartData[idx].addonQuantities[code] = 1;
            }
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