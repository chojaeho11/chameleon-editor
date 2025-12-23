// order.js (최종 수정본 - 전체 덮어쓰기)

import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js";
import { SITE_CONFIG } from "./site-config.js"; 
import { applySize } from "./canvas-size.js";
import { generateOrderSheetPDF, generateQuotationPDF, generateProductVectorPDF, generateRasterPDF } from "./export.js"; 

let currentTargetProduct = null;
let selectedDeliveryDate = null;

// [헬퍼] 통화 포맷터
function formatCurrency(amount) {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');
    const num = parseInt(amount) || 0;
    if (lang === 'jp') return '¥' + num.toLocaleString();
    else if (lang === 'us') return '$' + num.toLocaleString();
    else return num.toLocaleString() + '원';
}

// [헬퍼] Blob 파일 다운로드
function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// [헬퍼] PDF 라이브러리 로드 확인
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

// [헬퍼] PDF -> 이미지 Blob 변환
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
        const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
        canvas.height = scaledViewport.height; canvas.width = scaledViewport.width;
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    } catch (e) {
        console.warn("PDF 썸네일 생성 실패:", e);
        return null; 
    }
}

const resizeImageToBlob = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const maxDim = 1000;
                let w = img.width; let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                    else { w = Math.round(w * maxDim / h); h = maxDim; }
                }
                const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(resolve, 'image/jpeg', 0.8);
            };
        };
    });
};

async function uploadFileToSupabase(file, folder) {
    if (!sb) return null;
    const timestamp = Date.now();
    const ext = file.name ? file.name.split('.').pop() : 'jpg'; 
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeName = `${timestamp}_${randomStr}.${ext}`;
    const filePath = `${folder}/${safeName}`;
    const { data, error } = await sb.storage.from('orders').upload(filePath, file);
    if (error) { console.error("업로드 에러:", error); return null; }
    const { data: publicData } = sb.storage.from('orders').getPublicUrl(filePath);
    return publicData.publicUrl;
}

// ============================================================
// [1] 주문 시스템 초기화
// ============================================================
export function initOrderSystem() {
    const country = SITE_CONFIG.COUNTRY;
    const krForm = document.getElementById("addrFormKR");
    const globalForm = document.getElementById("addrFormGlobal");
    const bankArea = document.getElementById("bankTransferInfoArea");

    if (country === 'KR') {
        if(krForm) krForm.style.display = 'block';
        if(globalForm) globalForm.style.display = 'none';
        if(bankArea) bankArea.style.display = 'block'; 
    } else {
        if(krForm) krForm.style.display = 'none';
        if(globalForm) globalForm.style.display = 'flex';
        if(bankArea) bankArea.style.display = 'none'; 
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

    // 장바구니에서 견적서 출력 버튼
    const btnPrintQuote = document.getElementById("btnPrintQuote");
    if(btnPrintQuote) {
        btnPrintQuote.onclick = async () => {
            if(cartData.length === 0) return alert("상품이 없습니다.");
            const btn = btnPrintQuote;
            btn.innerText = "생성 중..."; btn.disabled = true;
            try {
                // 임시 정보로 출력
                const info = { manager: '고객', phone: '-', address: '-', note: '', date: new Date().toLocaleDateString() };
                const blob = await generateQuotationPDF(info, cartData);
                if(blob) downloadBlob(blob, "견적서.pdf");
                else alert("견적서 생성 실패 (내용 없음)");
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

    // ★ 결제 완료/확인창 다운로드 버튼들
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

export async function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    document.getElementById("productDetailModal").style.display = "none"; 
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
        const { data } = await sb.from('library').select('data_url').eq('product_key', currentTargetProduct.key).order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) {
            setTimeout(() => { if (window.loadProductFixedTemplate) window.loadProductFixedTemplate(data[0].data_url); }, 500);
        }
    } catch (e) { console.error("템플릿 로드 오류:", e); }
}

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
            const dataUrl = canvas.toDataURL({ format: 'png', left: board.left, top: board.top, width: board.width * board.scaleX, height: board.height * board.scaleY, multiplier: 0.5, quality: 0.8 });
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
        console.warn("썸네일 생성 실패", e); canvas.setViewportTransform(originalVpt);
    } finally {
        const loading = document.getElementById("loading");
        if(loading) loading.style.display = "none";
    }
    
    const key = window.currentProductKey || canvas.currentProductKey || 'A4'; 
    const product = PRODUCT_DB[key] || PRODUCT_DB['A4'];
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst']);
    const finalW = board ? board.width : (product.w || canvas.width); 
    const finalH = board ? board.height : (product.h || canvas.height);

    let originalFileUrl = null; let fileName = "나만의 디자인";
    if (window.currentUploadedPdfUrl) {
        originalFileUrl = window.currentUploadedPdfUrl;
        fileName = "업로드된_PDF_원본.pdf"; 
        window.currentUploadedPdfUrl = null; 
    }

    cartData.push({ 
        uid: Date.now(), product: product, type: 'design', thumb: thumbUrl, json: json, 
        originalUrl: originalFileUrl, fileName: fileName, width: finalW, height: finalH, 
        isOpen: true, qty: 1, selectedAddons: {}, addonQuantities: {} 
    });
    
    saveCart(); renderCart(); 
    const t = window.translations || {}; alert(`[${product.name}] ` + (t['msg_cart_added'] || "상품이 장바구니에 담겼습니다."));
}

async function addFileToCart(e) {
    const file = e.target.files[0]; 
    if(!file || !currentTargetProduct) return;
    const loading = document.getElementById("loading");
    if(loading) { loading.style.display = "flex"; loading.querySelector('p').innerText = "파일 분석 중..."; }
    
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
            uid: Date.now(), product: currentTargetProduct.info, type: 'file', fileName: file.name, mimeType: file.type, 
            fileData: null, originalUrl: originalUrl, thumb: thumbUrl, isOpen: true, qty: 1, selectedAddons: {}, addonQuantities: {} 
        });
        
        saveCart(); 
        document.getElementById("productDetailModal").style.display = "none"; 
        renderCart(); 
        alert("업로드 완료");
    } catch(err) { console.error(err); alert("실패: " + err.message); } finally {
        if(loading) { loading.style.display = "none"; } e.target.value = ''; 
    }
}

function renderCart() {
    const listArea = document.getElementById("cartListArea"); if(!listArea) return;
    listArea.innerHTML = ""; 
    
    let grandTotal = 0; let grandProductTotal = 0; let grandAddonTotal = 0;
    const t = window.translations || {};
    
    if(cartData.length === 0) { 
        listArea.innerHTML = `<div style="text-align:center; padding:60px 0; color:#94a3b8;">${t['msg_cart_empty']||"장바구니가 비어있습니다."}</div>`; 
        updateSummary(0, 0, 0); return; 
    }
    
    cartData.forEach((item, idx) => {
        if (!item.qty) item.qty = 1; if (item.isOpen === undefined) item.isOpen = true; if (!item.selectedAddons) item.selectedAddons = {};
        
        let matOpts = []; let finOpts = []; let addOpts = [];
        if (item.product.addons) {
             const arr = Array.isArray(item.product.addons) ? item.product.addons : item.product.addons.split(',');
             arr.forEach(c => {
                 const code = c.trim(); const info = ADDON_DB[code];
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
        grandProductTotal += baseProductTotal; grandAddonTotal += optionTotal; grandTotal += totalItemPrice;
        
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
    const elTotal = document.getElementById("summaryTotal"); if(elTotal) elTotal.innerText = formatCurrency(total); 
    const cartCount = document.getElementById("cartCount"); if(cartCount) cartCount.innerText = `(${cartData.length})`; 
    const btnCart = document.getElementById("btnViewCart"); if (btnCart) btnCart.style.display = (cartData.length > 0 || currentUser) ? "inline-flex" : "none"; 
}

// 주문 제출 (PDF 생성 에러나도 계속 진행)
// ▼▼▼▼▼ 붙여넣기 ▼▼▼▼▼
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
        
        // 2. 파일 업로드 준비
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
        if (uploadedFiles.length > 0) {
            await sb.from('orders').update({ files: uploadedFiles }).eq('id', newOrderId);
        }

        // 3. 문서 생성 (견적서, 지시서)
        btn.innerText = "문서 생성 중...";
        const orderInfoForPDF = { manager, phone, address, note: request, date: selectedDeliveryDate };
        
        try {
            const orderSheetBlob = await generateOrderSheetPDF(orderInfoForPDF, cartData); 
            if(orderSheetBlob) { 
                const url = await uploadFileToSupabase(orderSheetBlob, `orders/${newOrderId}/order_sheet.pdf`); 
                if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
            }
        } catch(pdfErr) { console.warn("지시서 오류:", pdfErr); }

        try {
            const quoteBlob = await generateQuotationPDF(orderInfoForPDF, cartData); 
            if(quoteBlob) { 
                const url = await uploadFileToSupabase(quoteBlob, `orders/${newOrderId}/quotation.pdf`); 
                if(url) uploadedFiles.push({ name: `견적서.pdf`, url: url, type: 'quotation' }); 
            } 
        } catch(quoteErr) { console.warn("견적서 오류:", quoteErr); }
            
        // 4. 디자인 파일 변환
        for (let i = 0; i < cartData.length; i++) {
            const item = cartData[i]; 
            const idx = String(i + 1).padStart(2, '0');
            if (!item.originalUrl && item.type === 'design' && item.json) {
                btn.innerText = `디자인 저장 중 (${i+1})...`;
                try { 
                    let fileBlob = await generateProductVectorPDF(item.json, item.width, item.height); 
                    if (!fileBlob) fileBlob = await generateRasterPDF(item.json, item.width, item.height); 
                    if(fileBlob) {
                        const url = await uploadFileToSupabase(fileBlob, `orders/${newOrderId}/design_${idx}.pdf`); 
                        if(url) uploadedFiles.push({ name: `제작물_${idx}_${item.product.name}.pdf`, url: url, type: 'product' }); 
                    }
                } catch(err) { console.warn("디자인 변환 실패:", err); }
            }
        }

        // 5. 최종 완료 업데이트
        await sb.from('orders').update({ files: uploadedFiles, status: '접수됨' }).eq('id', newOrderId);

        // ★ [핵심] 화면 유지 및 완료 처리
        document.getElementById("deliveryInfoModal").style.display = "none"; 
        
        // 결제/확인 모달을 띄워서 고객이 계좌정보를 볼 수 있게 함
        document.getElementById("checkoutModal").style.display = "flex";
        
        // 인풋에 값 채우기 (확인용)
        if(document.getElementById("orderName")) document.getElementById("orderName").value = manager; 
        if(document.getElementById("orderPhone")) document.getElementById("orderPhone").value = phone; 
        if(document.getElementById("orderAddr")) document.getElementById("orderAddr").value = address; 
        if(document.getElementById("orderMemo")) document.getElementById("orderMemo").value = request;

        alert("주문이 정상적으로 접수되었습니다.\n(견적서와 작업지시서가 생성되었습니다)");
        
        // 버튼 텍스트 변경 (완료 표시)
        btn.innerText = "접수 완료";

    } catch (e) { 
        console.error(e); 
        alert("주문 처리 중 오류 발생: " + e.message); 
        btn.innerText = "주문서 생성 및 결제"; 
        btn.disabled = false; 
    } finally { 
        document.getElementById("loading").style.display = "none"; 
    }
}
// ▲▲▲▲▲ 붙여넣기 끝 ▲▲▲▲▲

function processPayment() {
    if (!window.currentDbId) return alert("주문 정보가 없습니다.");
    let totalAmount = 0; 
    cartData.forEach(item => { 
        let lineTotal = (item.product.price || 0) * (item.qty || 1);
        if(item.selectedAddons) { 
            Object.values(item.selectedAddons).forEach(code => { 
                if(ADDON_DB[code]) { 
                    const aq = (item.addonQuantities && item.addonQuantities[code]) || 1; 
                    lineTotal += ADDON_DB[code].price * aq; 
                } 
            }); 
        } 
        totalAmount += lineTotal; 
    });

    if (totalAmount === 0) return alert("결제 금액이 0원입니다.");

    const country = SITE_CONFIG.COUNTRY;
    const pgConfig = SITE_CONFIG.PG_CONFIG[country];
    const orderName = `Chameleon Order (${cartData.length})`;
    const customerName = document.getElementById("orderName").value;

    if (pgConfig.provider === 'toss') {
        const tossPayments = TossPayments(pgConfig.clientKey);
        tossPayments.requestPayment("카드", { 
            amount: totalAmount, orderId: "ORD-" + new Date().getTime(), orderName: orderName, customerName: customerName, 
            successUrl: window.location.origin + `/success.html?db_id=${window.currentDbId}`, 
            failUrl: window.location.origin + `/fail.html?db_id=${window.currentDbId}`, 
        }).catch(error => { if (error.code !== "USER_CANCEL") alert("결제 오류: " + error.message); });
    } else if (pgConfig.provider === 'stripe') {
        initiateStripeCheckout(pgConfig.publishableKey, totalAmount, country, window.currentDbId);
    }
}

// ★ 이 함수가 빠져있어서 추가했습니다.
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

// Window 객체 연결
window.toggleCartAccordion = function(idx) { if (cartData[idx]) { cartData[idx].isOpen = !cartData[idx].isOpen; renderCart(); } };
window.removeCartItem = function(idx) { if (confirm("삭제하시겠습니까?")) { cartData.splice(idx, 1); saveCart(); renderCart(); } };
window.updateCartOption = function(idx, key, value) { if (cartData[idx]) { cartData[idx].selectedAddons[key] = value; saveCart(); renderCart(); } };
window.toggleCartAddon = function(idx, code, isChecked) {
    if (cartData[idx]) {
        const key = `addon_${code}`;
        if (isChecked) { cartData[idx].selectedAddons[key] = code; if (!cartData[idx].addonQuantities[code]) cartData[idx].addonQuantities[code] = 1; } 
        else { delete cartData[idx].selectedAddons[key]; }
        saveCart(); renderCart();
    }
};
window.updateCartAddonQty = function(idx, code, qty) {
    const quantity = parseInt(qty); if (quantity < 1) return;
    if (cartData[idx]) { cartData[idx].addonQuantities[code] = quantity; saveCart(); renderCart(); }
};
window.updateCartQty = function(idx, delta) {
    if (cartData[idx]) { let newQty = (cartData[idx].qty || 1) + delta; if (newQty < 1) newQty = 1; cartData[idx].qty = newQty; saveCart(); renderCart(); }
};
window.updateCartQtyInput = function(idx, val) {
    let newQty = parseInt(val); if (!newQty || newQty < 1) newQty = 1; if (cartData[idx]) { cartData[idx].qty = newQty; saveCart(); renderCart(); }
};