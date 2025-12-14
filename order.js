import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js"; 
import { applySize } from "./canvas-size.js";
import { generateOrderSheetPDF, generateQuotationPDF, generateProductVectorPDF, generateRasterPDF } from "./export.js"; 

let currentTargetProduct = null;
let selectedDeliveryDate = null;

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

// [헬퍼] PDF 라이브러리 로드 확인
async function loadPdfLib() {
    if (window.pdfjsLib) return;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
        };
        document.head.appendChild(script);
    });
}

// [핵심] PDF -> 이미지 Blob 변환 (캡쳐)
async function createPdfThumbnailBlob(file) {
    // 20MB 이상 대용량은 브라우저 다운 방지를 위해 캡쳐 생략
    if (file.size > 20 * 1024 * 1024) return null;

    await loadPdfLib();
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1); // 1페이지 캡쳐
        
        const viewport = page.getViewport({ scale: 1 }); // 원본 비율
        // 썸네일용 리사이징 (너비 1000px 기준)
        const scale = 1000 / viewport.width;
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
    const ext = file.name ? file.name.split('.').pop() : 'jpg'; 
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2,7)}.${ext}`;
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
    const btnOrderTop = document.getElementById("btnOrderTop");
    if(btnOrderTop) { 
        btnOrderTop.innerText = "➕ 장바구니 담기"; 
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
    document.getElementById("pdpTitle").innerText = product.name; document.getElementById("pdpPrice").innerText = product.price.toLocaleString() + "원";
    const imgElem = document.getElementById("pdpImage"); if(imgElem) imgElem.src = product.img || 'https://placehold.co/400';
    document.getElementById("productDetailModal").style.display = "flex";
}
export function startDesignFromProduct() { if(!currentTargetProduct) return; document.getElementById("productDetailModal").style.display = "none"; if(window.applySize) window.applySize(currentTargetProduct.w, currentTargetProduct.h, currentTargetProduct.key, currentTargetProduct.mode, 'replace'); switchToEditor(); canvas.currentProductKey = currentTargetProduct.key; window.currentProductKey = currentTargetProduct.key; }
function switchToEditor() { document.getElementById("startScreen").style.display = "none"; document.getElementById("mainEditor").style.display = "flex"; window.dispatchEvent(new Event('resize')); }

// 캔버스 추가 (디자인)
async function addCanvasToCart() {
    if (!canvas) return;
    const originalVpt = canvas.viewportTransform; canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    let thumbUrl = "https://placehold.co/100?text=Design";
    
    try {
        const blob = await new Promise(resolve => canvas.getElement().toBlob(resolve, 'image/jpeg', 0.5));
        if(blob) {
            const uploadedThumb = await uploadFileToSupabase(blob, 'thumbs');
            if(uploadedThumb) thumbUrl = uploadedThumb;
        }
    } catch(e) { console.warn("썸네일 생성 실패", e); }

    canvas.setViewportTransform(originalVpt);
    
    const key = window.currentProductKey || canvas.currentProductKey || 'A4'; 
    const product = PRODUCT_DB[key] || PRODUCT_DB['A4'];
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst']);
    const board = canvas.getObjects().find(o => o.isBoard);
    const finalW = board ? board.width : (product.w || canvas.width); 
    const finalH = board ? board.height : (product.h || canvas.height);

    cartData.push({ 
        uid: Date.now(), product: product, type: 'design', thumb: thumbUrl, json: json, 
        width: finalW, height: finalH, isOpen: true, qty: 1, selectedAddons: {}, addonQuantities: {} 
    });
    
    saveCart(); renderCart(); 
    alert(`[${product.name}] 상품이 장바구니에 담겼습니다.`);
}

// ★ [파일 업로드] - PDF 캡쳐 및 업로드 로직 포함
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
        let thumbUrl = 'https://cdn-icons-png.flaticon.com/512/337/337946.png'; // 기본 아이콘

        // 1. 원본 파일 업로드
        originalUrl = await uploadFileToSupabase(file, 'customer_uploads');
        
        // 2. 썸네일 생성 시도 (PDF -> Image 캡쳐)
        let thumbBlob = null;
        if (file.type === 'application/pdf') {
            thumbBlob = await createPdfThumbnailBlob(file);
        } else if (file.type.startsWith('image/')) {
            thumbBlob = await resizeImageToBlob(file);
        }

        // 3. 썸네일 서버 업로드 (URL 획득)
        if (thumbBlob) {
            const uploadedThumbUrl = await uploadFileToSupabase(thumbBlob, 'thumbs');
            if (uploadedThumbUrl) thumbUrl = uploadedThumbUrl;
        }

        // 4. 장바구니 추가
        cartData.push({ 
            uid: Date.now(), 
            product: currentTargetProduct.info, 
            type: 'file', 
            fileName: file.name, 
            mimeType: file.type, 
            fileData: null, 
            originalUrl: originalUrl, 
            thumb: thumbUrl, // PDF 캡쳐 이미지 URL
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

// [장바구니 렌더링]
function renderCart() {
    const listArea = document.getElementById("cartListArea"); 
    if(!listArea) return;
    listArea.innerHTML = ""; let grandTotal = 0;
    
    if(cartData.length === 0) { listArea.innerHTML = `<div style="text-align:center; padding:60px 0; color:#94a3b8;">장바구니가 비어있습니다.</div>`; updateSummary(0); return; }
    
    cartData.forEach((item, idx) => {
        if (!item.qty) item.qty = 1; if (item.isOpen === undefined) item.isOpen = true; if (!item.selectedAddons) item.selectedAddons = {}; if (!item.addonQuantities) item.addonQuantities = {};
        let matOpts = []; let finOpts = []; let addOpts = []; 
        if (item.product && item.product.addons) {
            item.product.addons.forEach(code => {
                const info = ADDON_DB[code]; if (info) { const cat = (info.category || '').toLowerCase(); if (cat === 'material') matOpts.push({code, ...info}); else if (cat === 'finish') finOpts.push({code, ...info}); else addOpts.push({code, ...info}); }
            });
        }
        let basePrice = item.product.price || 0; let addonPrice = 0;
        Object.values(item.selectedAddons).forEach(code => {
            const addon = ADDON_DB[code];
            if (addon) {
                const isAdditional = addOpts.some(a => a.code === code);
                const aq = isAdditional ? (item.addonQuantities[code] || 1) : 1;
                addonPrice += addon.price * aq;
            }
        });
        let totalItemPrice = (basePrice + addonPrice) * item.qty;
        grandTotal += totalItemPrice;
        
        const div = document.createElement("div"); div.className = "cart-item"; 
        div.innerHTML = `
            <div class="cart-top-row" onclick="window.toggleCartAccordion(${idx})" style="display:flex; gap:15px; align-items:center; cursor:pointer;">
                <div style="width:80px; height:80px; background:#f8fafc; border:1px solid #eee; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                    <img src="${item.thumb}" style="max-width:100%; max-height:100%; object-fit:contain;">
                </div>
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:16px;">${item.product.name}</h4>
                    <div style="font-size:13px; color:#666; margin-top:4px;">${item.fileName || '사용자 디자인'}</div>
                    <div style="font-weight:bold; color:#6366f1; margin-top:5px;">${totalItemPrice.toLocaleString()}원</div>
                </div>
                <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        
        if(item.isOpen) {
            const optionContainer = document.createElement("div"); optionContainer.style.marginTop = "15px";
            
            // 재질
            if (matOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">① 재질/두께 <span class="badge-req">필수</span></div>`;
                const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_mat', e.target.value);
                let optsHTML = `<option value="">선택해주세요</option>`;
                matOpts.forEach(opt => { const selected = item.selectedAddons['opt_mat'] === opt.code ? 'selected' : ''; const priceStr = opt.price > 0 ? ` (+${opt.price.toLocaleString()}원)` : ''; optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }
            // 마감
            if (finOpts.length > 0) {
                const box = document.createElement("div"); box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">② 마감 방식 <span class="badge-req">필수</span></div>`;
                const sel = document.createElement("select"); sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_fin', e.target.value);
                let optsHTML = `<option value="">선택해주세요</option>`;
                finOpts.forEach(opt => { const selected = item.selectedAddons['opt_fin'] === opt.code ? 'selected' : ''; const priceStr = opt.price > 0 ? ` (+${opt.price.toLocaleString()}원)` : ''; optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`; });
                sel.innerHTML = optsHTML; box.appendChild(sel); optionContainer.appendChild(box);
            }
            // 추가상품
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
                            <span style="font-size:13px;">${opt.name} <span style="color:#6366f1; font-weight:bold;">(+${opt.price.toLocaleString()})</span></span>
                        </label>
                        ${isChecked ? `<div style="display:flex; align-items:center; gap:5px; margin-left:10px;"><span style="font-size:11px; color:#888;">수량</span><input type="number" min="1" value="${currentQty}" onchange="window.updateCartAddonQty(${idx}, '${opt.code}', this.value)" onclick="event.stopPropagation()" style="width:40px; text-align:center; border:1px solid #ddd; border-radius:4px; font-size:12px; padding:2px;"></div>` : ''}`;
                    grid.appendChild(row);
                });
                box.appendChild(grid); optionContainer.appendChild(box);
            }
            // 본품 수량
            const qtyBox = document.createElement("div"); qtyBox.style.cssText = "display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:15px;";
            qtyBox.innerHTML = `<span style="font-size:13px; font-weight:bold;">본품 수량</span><div class="qty-wrapper" style="border:1px solid #ddd; border-radius:5px; display:flex;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button><input type="number" value="${item.qty}" onchange="window.updateCartQtyInput(${idx}, this.value)" style="width:50px; text-align:center; border:none; border-left:1px solid #eee; border-right:1px solid #eee; height:30px; font-weight:bold; outline:none;"><button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button></div>`;
            optionContainer.appendChild(qtyBox); div.appendChild(optionContainer);
        }
        listArea.appendChild(div);
    });
    updateSummary(grandTotal);
}
function updateSummary(total) { const elTotal = document.getElementById("summaryTotal"); const elItem = document.getElementById("summaryItemPrice"); const formatted = total.toLocaleString() + "원"; if(elTotal) elTotal.innerText = formatted; if(elItem) elItem.innerText = formatted; const cartCount = document.getElementById("cartCount"); if(cartCount) cartCount.innerText = `(${cartData.length})`; const btnCart = document.getElementById("btnViewCart"); if (btnCart) { btnCart.style.display = (cartData.length > 0 || currentUser) ? "inline-flex" : "none"; } }

// [주문 제출]
async function processOrderSubmission() {
    const manager = document.getElementById("inputManagerName").value;
    const phone = document.getElementById("inputManagerPhone").value;
    const address = document.getElementById("inputAddress").value;
    const request = document.getElementById("inputRequest").value;
    
    if(!manager) return alert("담당자 입력 필수");
    
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

        // ▼ [수정됨] DB 저장 시 'delivery_target_date' 에도 날짜 저장
        const { data: orderData, error: orderError } = await sb.from('orders').insert([{ 
            order_date: selectedDeliveryDate,           // 기존 주문일 (표기용)
            delivery_target_date: selectedDeliveryDate, // ★ [핵심] 관리자 배송관리용 날짜 자동 입력
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
        const uploadedFiles = [];
        
        btn.innerText = "문서 생성 중...";
        
        // PDF 생성
        const orderInfoForPDF = { manager, phone, address, note: request, date: selectedDeliveryDate };
        try { 
            const orderSheetBlob = await generateOrderSheetPDF(orderInfoForPDF, cartData); 
            if(orderSheetBlob) { 
                const url = await uploadFileToSupabase(orderSheetBlob, `orders/${newOrderId}/order_sheet.pdf`); 
                if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
            } 
            const quoteBlob = await generateQuotationPDF(orderInfoForPDF, cartData); 
            if(quoteBlob) { 
                const url = await uploadFileToSupabase(quoteBlob, `orders/${newOrderId}/quotation.pdf`); 
                if(url) uploadedFiles.push({ name: `견적서.pdf`, url: url, type: 'quotation' }); 
            } 
        } catch(e) { console.warn("문서 생성 실패", e); }
        
        // 파일 정보 연결
        for (let i = 0; i < cartData.length; i++) {
            const item = cartData[i]; const idx = String(i + 1).padStart(2, '0');
            
            if (item.originalUrl) {
                uploadedFiles.push({ 
                    name: `고객파일_${idx}_${item.fileName || 'file'}`, 
                    url: item.originalUrl, 
                    type: 'customer_file' 
                });
            } 
            // 디자인 파일인 경우만 생성
            else if (item.type === 'design' && item.json) {
                btn.innerText = `디자인 변환 중...`;
                try { 
                    let fileBlob = await generateProductVectorPDF(item.json, item.width, item.height); 
                    if (!fileBlob) fileBlob = await generateRasterPDF(item.json, item.width, item.height); 
                    if(fileBlob) {
                        const url = await uploadFileToSupabase(fileBlob, `orders/${newOrderId}/design_${idx}.pdf`); 
                        if(url) uploadedFiles.push({ name: `제작물_${idx}_${item.product.name}.pdf`, url: url, type: 'product' }); 
                    }
                } catch(e) {}
            }
        }
        
        btn.innerText = "완료 처리 중...";
        await sb.from('orders').update({ files: uploadedFiles, status: '접수됨' }).eq('id', newOrderId);
        
        document.getElementById("deliveryInfoModal").style.display = "none"; 
        document.getElementById("checkoutModal").style.display = "flex";
        document.getElementById("orderName").value = manager; 
        document.getElementById("orderPhone").value = phone; 
        document.getElementById("orderAddr").value = address; 
        document.getElementById("orderMemo").value = request;
        
    } catch (e) { console.error(e); alert("오류: " + e.message); } 
    finally { btn.innerText = "주문서 생성 및 결제"; btn.disabled = false; document.getElementById("loading").style.display = "none"; }
}

function processPayment() { /* 결제 로직 동일 */ const clientKey = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq"; if (typeof TossPayments === 'undefined') return alert("결제 모듈 로드 실패"); let totalAmount = 0; cartData.forEach(item => { let price = item.product.price; if(item.selectedAddons) { Object.values(item.selectedAddons).forEach(code => { if(ADDON_DB[code]) { const aq = (item.addonQuantities && item.addonQuantities[code]) || 1; price += ADDON_DB[code].price * aq; } }); } totalAmount += price * (item.qty || 1); }); if (totalAmount === 0) return alert("결제 금액 0원"); if (!window.currentDbId) return alert("주문 정보가 없습니다."); const tossPayments = TossPayments(clientKey); const orderId = "ORD-" + new Date().getTime(); tossPayments.requestPayment("카드", { amount: totalAmount, orderId: orderId, orderName: `카멜레온 디자인 주문 (${cartData.length}건)`, customerName: document.getElementById("orderName").value, successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}`, failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, }).catch(async function (error) { if (error.code === "USER_CANCEL") { await updatePaymentStatus(window.currentDbId, '결제중단'); alert("결제가 중단되었습니다."); } else { alert("결제 에러: " + error.message); } }); }
window.renderCart = renderCart; window.toggleCartAccordion = (idx) => { cartData[idx].isOpen = !cartData[idx].isOpen; renderCart(); }; window.updateCartQty = (idx, change) => { if(cartData[idx]) { cartData[idx].qty = Math.max(1, (cartData[idx].qty||1) + change); saveCart(); renderCart(); } }; window.updateCartOption = (idx, key, code) => { if (cartData[idx]) { if (!cartData[idx].selectedAddons) cartData[idx].selectedAddons = {}; if (code === "") delete cartData[idx].selectedAddons[key]; else cartData[idx].selectedAddons[key] = code; saveCart(); renderCart(); } }; window.toggleCartAddon = (idx, code, isChecked) => { if (cartData[idx]) { if (!cartData[idx].selectedAddons) cartData[idx].selectedAddons = {}; const storageKey = `addon_${code}`; if (isChecked) { cartData[idx].selectedAddons[storageKey] = code; if(!cartData[idx].addonQuantities) cartData[idx].addonQuantities = {}; cartData[idx].addonQuantities[code] = 1; } else { delete cartData[idx].selectedAddons[storageKey]; if(cartData[idx].addonQuantities) delete cartData[idx].addonQuantities[code]; } saveCart(); renderCart(); } }; window.updateCartAddonQty = (idx, code, val) => { let qty = parseInt(val); if(isNaN(qty) || qty < 1) qty = 1; if(cartData[idx]) { if(!cartData[idx].addonQuantities) cartData[idx].addonQuantities = {}; cartData[idx].addonQuantities[code] = qty; saveCart(); renderCart(); } }; window.removeCartItem = (idx) => { if(confirm("삭제하시겠습니까?")) { cartData.splice(idx, 1); saveCart(); renderCart(); } }; window.processOrderSubmission = processOrderSubmission; window.updateCartQtyInput = (idx, val) => { let newQty = parseInt(val); if(isNaN(newQty) || newQty < 1) newQty = 1; if(cartData[idx]) { cartData[idx].qty = newQty; saveCart(); renderCart(); } };
async function updatePaymentStatus(dbId, status) { if(!sb || !dbId) return; try { await sb.from('orders').update({ payment_status: status }).eq('id', dbId); } catch(e) { console.error("상태 업데이트 실패", e); } }
window.handleBankTransfer = async () => { if (!window.currentDbId) return alert("주문 정보가 없습니다."); if (!confirm("무통장 입금으로 진행하시겠습니까?")) return; const { error } = await sb.from('orders').update({ payment_method: '계좌이체', payment_status: '입금대기', status: '접수됨' }).eq('id', window.currentDbId); if(error) { alert("오류: " + error.message); } else { alert("입금 요청이 완료되었습니다.\n[닫기]를 누르면 초기화됩니다."); const btn = document.querySelector('.btn-bank-confirm'); if(btn) btn.style.display = 'none'; window.isOrderCompleted = true; } };
document.addEventListener('DOMContentLoaded', () => { const bankBtn = document.querySelector('.btn-bank-confirm'); if(bankBtn) { bankBtn.onclick = window.handleBankTransfer; } });