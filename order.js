// order.js
import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js"; 
import { applySize } from "./canvas-size.js";
import { generateOrderSheetPDF, generateProductVectorPDF, generateQuotationPDF, generateRasterPDF } from "./export.js"; 

let currentTargetProduct = null;
let selectedDeliveryDate = null;

// [헬퍼] Blob 파일 다운로드 함수
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

// [1] 주문 시스템 초기화
export function initOrderSystem() {
    // 상단 장바구니 담기 버튼
    const btnOrderTop = document.getElementById("btnOrderTop");
    if(btnOrderTop) { 
        btnOrderTop.innerText = "➕ 장바구니 담기"; 
        btnOrderTop.onclick = addCanvasToCart;
    }
    
    // 상품 상세 모달 내부 버튼들
    const btnActionDesign = document.getElementById("btnActionDesign");
    if(btnActionDesign) btnActionDesign.onclick = startDesignFromProduct;
    
    const pdpFileUpload = document.getElementById("pdpFileUpload");
    if(pdpFileUpload) pdpFileUpload.onchange = addFileToCart;
    
    // 장바구니 페이지 결제 버튼
    const btnGoCheckout = document.getElementById("btnGoCheckout");
    if(btnGoCheckout) { 
        btnGoCheckout.onclick = () => { 
            if(cartData.length === 0) return alert("장바구니가 비어있습니다."); 
            openCalendarModal(); 
        }; 
    }
    
    // 달력 월 변경 버튼
    const btnPrev = document.getElementById("btnPrevMonth");
    if(btnPrev) btnPrev.onclick = () => changeMonth(-1);
    
    const btnNext = document.getElementById("btnNextMonth");
    if(btnNext) btnNext.onclick = () => changeMonth(1);
    
    // 배송 정보 제출 버튼
    const btnSubmit = document.getElementById("btnSubmitOrderInfo");
    if(btnSubmit) btnSubmit.onclick = processOrderSubmission;
    
    // 최종 결제 버튼
    const btnPayment = document.getElementById("btnRealPayment");
    if(btnPayment) btnPayment.onclick = processPayment;

    // 장바구니 내 견적서 출력 버튼
    const btnPrintQuote = document.getElementById("btnPrintQuote");
    if (btnPrintQuote) {
        btnPrintQuote.onclick = async () => {
            if (cartData.length === 0) return alert("상품이 없습니다.");
            // 임시 고객 정보 생성
            const mockInfo = {
                manager: currentUser?.email?.split('@')[0] || "고객",
                phone: "",
                date: new Date().toLocaleDateString()
            };
            try {
                // export.js의 PDF 생성 함수 호출
                const blob = await generateQuotationPDF(mockInfo, cartData);
                if (blob) downloadBlob(blob, `견적서_${new Date().toISOString().slice(0,10)}.pdf`);
            } catch(e) {
                console.error("견적서 오류:", e);
                alert("견적서 생성 중 오류가 발생했습니다.");
            }
        };
    }
}

// [2] 캘린더 로직
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
    
    ['일','월','화','수','목','금','토'].forEach(d => grid.innerHTML += `<div class="cal-day-header" style="text-align:center; font-weight:bold; font-size:13px; padding:5px;">${d}</div>`);
    
    const firstDay = new Date(year, month, 1).getDay(); 
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
    
    let minDate = new Date(); 
    // 최소 3일 뒤부터 선택 가능 로직 (주말 제외 등 단순화)
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
        
        if(dateObj < minDate || dateObj.getDay() === 0 || dateObj.getDay() === 6) { 
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

// [3] 장바구니 로직
function saveCart() { 
    try { 
        const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
        localStorage.setItem(storageKey, JSON.stringify(cartData)); 
    } catch(e) { console.error("장바구니 저장 실패", e); } 
}

// [중요] 상품 상세 열기 (HTML onclick에서 호출되므로 export 필수)
export function openProductDetail(key, w, h, mode) {
    let product = PRODUCT_DB[key];
    if (!product) {
        product = { name: key, price: 0, img: 'https://placehold.co/400?text=No+Image', addons: [] };
    }
    currentTargetProduct = { key, w, h, mode, info: product };
    
    document.getElementById("pdpTitle").innerText = product.name;
    document.getElementById("pdpPrice").innerText = product.price.toLocaleString() + "원";
    
    const imgElem = document.getElementById("pdpImage");
    if(imgElem) imgElem.src = product.img || 'https://placehold.co/400?text=No+Image';
    
    document.getElementById("productDetailModal").style.display = "flex";
}

// [중요] 디자인 시작 함수 (HTML onclick에서 호출되므로 export 필수)
export function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    const { w, h, key, mode } = currentTargetProduct; 
    
    document.getElementById("productDetailModal").style.display = "none"; 
    
    // 캔버스 크기 변경
    applySize(w, h, key, mode, 'replace'); 
    
    switchToEditor(); 
    
    // [수정] 전역 변수에도 저장하여 장바구니 담을 때 참조 가능하게 함
    canvas.currentProductKey = key; 
    window.currentProductKey = key; 
}

function switchToEditor() { 
    document.getElementById("startScreen").style.display = "none"; 
    document.getElementById("mainEditor").style.display = "flex"; 
    window.dispatchEvent(new Event('resize')); 
}

// 현재 캔버스 상태를 장바구니에 추가
async function addCanvasToCart() {
    // [핵심 수정] 전역 변수(window.currentProductKey)를 최우선으로 확인
    const key = window.currentProductKey || canvas.currentProductKey || 'A4'; 
    const product = PRODUCT_DB[key] || PRODUCT_DB['A4'];
    
    // 썸네일 생성
    const thumb = canvas.toDataURL({ format: 'png', multiplier: 0.5, quality: 0.8 });
    // 캔버스 데이터 저장
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst']);
    const board = canvas.getObjects().find(o => o.isBoard);
    
    cartData.push({ 
        uid: Date.now(), 
        product: product, 
        type: 'design', 
        thumb: thumb, 
        json: json,
        width: board ? board.width : canvas.width, 
        height: board ? board.height : canvas.height,
        addons: {}, 
        isOpen: true, 
        qty: 1
    });
    
    saveCart(); 
    renderCart(); 
    alert(`[${product.name}] 상품이 장바구니에 담겼습니다.`);
}

// 파일 업로드로 장바구니 추가
function addFileToCart(e) {
    const file = e.target.files[0]; 
    if(!file || !currentTargetProduct) return;
    
    const reader = new FileReader();
    reader.onload = async function(evt) {
        const fileDataURI = evt.target.result; 
        let thumbUrl = 'https://placehold.co/100?text=FILE';
        
        // PDF 썸네일 생성 시도
        if (file.type === 'application/pdf' && window.pdfjsLib) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 0.5 });
                const canvasEl = document.createElement('canvas');
                const context = canvasEl.getContext('2d');
                canvasEl.height = viewport.height;
                canvasEl.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                thumbUrl = canvasEl.toDataURL('image/png');
            } catch(e) { console.warn("썸네일 생성 실패", e); }
        } else if (file.type.startsWith('image/')) { 
            thumbUrl = fileDataURI; 
        }

        cartData.push({ 
            uid: Date.now(), 
            product: currentTargetProduct.info, 
            type: 'file', 
            fileName: file.name, 
            mimeType: file.type, 
            fileData: fileDataURI,
            thumb: thumbUrl, 
            addons: {}, 
            isOpen: true, 
            qty: 1 
        });
        
        saveCart(); 
        document.getElementById("productDetailModal").style.display = "none"; 
        renderCart(); 
        alert("파일이 장바구니에 담겼습니다.");
    };
    reader.readAsDataURL(file);
}

// 장바구니 렌더링
function renderCart() {
    const listArea = document.getElementById("cartListArea"); 
    if(!listArea) return;
    
    listArea.innerHTML = ""; 
    let grandTotal = 0;
    
    if(cartData.length === 0) {
        listArea.innerHTML = `<div style="text-align:center; padding:60px 0; color:#94a3b8;"><i class="fa-solid fa-cart-shopping" style="font-size:40px; margin-bottom:15px; display:block;"></i>장바구니가 비어있습니다.</div>`;
        updateSummary(0); 
        return;
    }
    
    cartData.forEach((item, idx) => {
        if (!item.qty) item.qty = 1; 
        if (!item.addons) item.addons = {}; 
        if (item.isOpen === undefined) item.isOpen = true;
        
        let itemBasePrice = item.product.price * item.qty; 
        let addonPriceTotal = 0;
        
        Object.keys(item.addons).forEach(key => { 
            const count = item.addons[key]; 
            if(count > 0 && ADDON_DB[key]) { 
                addonPriceTotal += ADDON_DB[key].price * count; 
            } 
        });
        
        const totalItemPrice = itemBasePrice + addonPriceTotal; 
        grandTotal += totalItemPrice;
        
        const div = document.createElement("div"); 
        div.className = "cart-item"; 
        // 스타일 직접 주입하여 카드 형태 잡기
        div.style.cssText = "display:flex; flexDirection:column; cursor:pointer; transition:all 0.2s; border:1px solid #e2e8f0; background:white; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.03);";
        if (item.isOpen) div.style.borderColor = "var(--primary)";
        
        div.onclick = (e) => { 
            if(e.target.closest('button')) return; 
            window.toggleCartAccordion(idx); 
        };
        
        const mainRow = document.createElement("div"); 
        mainRow.style.display = "flex"; 
        mainRow.style.alignItems = "center"; 
        mainRow.style.width = "100%"; 
        mainRow.style.gap = "15px";
        
        let selectedAddonsText = ""; 
        const activeAddons = [];
        Object.keys(item.addons).forEach(k => { 
            if(item.addons[k] > 0 && ADDON_DB[k]) activeAddons.push(`${ADDON_DB[k].name}(${item.addons[k]}개)`); 
        });
        if(activeAddons.length > 0) selectedAddonsText = `<div style="font-size:12px; color:#6366f1; margin-top:6px; line-height:1.4;"><i class="fa-solid fa-check"></i> ${activeAddons.join(", ")}</div>`;
        
        // 수량 버튼 레이아웃 flex-shrink:0 적용
        mainRow.innerHTML = `
            <img src="${item.thumb}" style="width:70px; height:70px; object-fit:contain; border-radius:8px; border:1px solid #eee; background:#fff; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">${item.type==='design' ? '디자인' : '파일 업로드'} ${item.isOpen ? '' : '<span style="font-size:11px; color:#999;">(펼치기)</span>'}</div>
                <h4 style="margin:0; font-size:15px; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.product.name}</h4>
                <div style="font-weight:700; margin-top:4px;">${totalItemPrice.toLocaleString()}원</div>
                ${selectedAddonsText}
            </div>
            
            <div class="qty-control" style="display:flex; align-items:center; gap:0; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc; flex-shrink:0;">
                <button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; cursor:pointer;"><i class="fa-solid fa-minus" style="font-size:10px; color:#64748b;"></i></button>
                <div class="qty-val" style="width:30px; text-align:center; font-size:13px; font-weight:bold; color:#1e293b;">${item.qty}</div>
                <button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; cursor:pointer;"><i class="fa-solid fa-plus" style="font-size:10px; color:#64748b;"></i></button>
            </div>
            
            <button onclick="window.removeCartItem(${idx})" class="qty-btn" style="width:30px; height:30px; border-radius:50%; background:#fee2e2; color:#ef4444; border:none; flex-shrink:0; margin-left:5px; display:flex; align-items:center; justify-content:center;">
                <i class="fa-solid fa-trash" style="font-size:12px;"></i>
            </button>
        `;
        div.appendChild(mainRow);
        
        if(item.isOpen && item.product.addons && item.product.addons.length > 0) {
            const addonArea = document.createElement("div"); 
            addonArea.style.marginTop = "15px"; 
            addonArea.style.padding = "15px"; 
            addonArea.style.background = "#f8fafc"; 
            addonArea.style.borderRadius = "12px"; 
            addonArea.style.border = "1px solid #e2e8f0"; 
            addonArea.onclick = (e) => e.stopPropagation(); 
            
            let html = `<div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:12px; display:flex; justify-content:space-between;"><span>추가 옵션 선택</span><span style="font-weight:400; font-size:11px;">필요한 옵션을 추가하세요</span></div>`;
            
            item.product.addons.forEach(key => {
                const addonInfo = ADDON_DB[key];
                if(addonInfo) {
                    const currentCount = item.addons[key] || 0; 
                    const isActive = currentCount > 0;
                    html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #e2e8f0;">
                            <div>
                                <div style="font-size:13px; color:${isActive ? '#1e293b' : '#64748b'}; font-weight:${isActive ? 'bold' : 'normal'};">${addonInfo.name}</div>
                                <div style="font-size:11px; color:#94a3b8;">+${addonInfo.price.toLocaleString()}원</div>
                            </div>
                            <div style="display:flex; align-items:center; background:#fff; border:1px solid ${isActive ? '#6366f1' : '#e2e8f0'}; border-radius:6px; height:28px;">
                                <button onclick="window.updateAddon(${idx}, '${key}', -1)" style="border:none; background:transparent; width:24px; cursor:pointer; color:#64748b;">-</button>
                                <span style="font-size:12px; width:20px; text-align:center; font-weight:bold; color:${isActive ? '#6366f1' : '#333'};">${currentCount}</span>
                                <button onclick="window.updateAddon(${idx}, '${key}', 1)" style="border:none; background:transparent; width:24px; cursor:pointer; color:#64748b;">+</button>
                            </div>
                        </div>
                    `;
                }
            });
            addonArea.innerHTML = html; 
            div.appendChild(addonArea);
        }
        listArea.appendChild(div);
    });
    updateSummary(grandTotal);
}

function updateSummary(total) {
    const summaryTotal = document.getElementById("summaryTotal");
    const summaryItem = document.getElementById("summaryItemPrice");
    const formatted = total.toLocaleString() + "원";
    
    if(summaryTotal) summaryTotal.innerText = formatted;
    if(summaryItem) summaryItem.innerText = formatted;
    
    const cartCount = document.getElementById("cartCount");
    if(cartCount) cartCount.innerText = `(${cartData.length})`;
    
    const btnCart = document.getElementById("btnViewCart");
    if (btnCart) { 
        if (cartData.length > 0 || currentUser) { 
            btnCart.style.display = "inline-flex"; 
        } else { 
            btnCart.style.display = "none"; 
        } 
    }
}

// [4] 주문 제출 및 파일 업로드
async function processOrderSubmission() {
    const manager = document.getElementById("inputManagerName").value;
    const phone = document.getElementById("inputManagerPhone").value;
    const address = document.getElementById("inputAddress").value;
    const request = document.getElementById("inputRequest").value;
    
    if(!manager) return alert("담당자 입력 필수");
    if(!sb) return alert("DB 연결 오류");
    
    const btn = document.getElementById("btnSubmitOrderInfo"); 
    btn.disabled = true; 
    document.getElementById("loading").style.display = "flex";
    
    let newOrderId = null;
    
    try {
        const orderInfo = { date: selectedDeliveryDate, manager, phone, address, note: request };
        
        btn.innerText = "주문 정보 저장 중...";
        
        const { data: orderData, error: orderError } = await sb.from('orders').insert([{ 
            order_date: selectedDeliveryDate, 
            manager_name: manager, 
            phone: phone, 
            address: address, 
            request_note: request, 
            status: '파일처리중', 
            files: [] 
        }]).select();
        
        if (orderError) throw orderError; 
        if (!orderData || orderData.length === 0) throw new Error("주문 ID 생성 실패");
        
        newOrderId = orderData[0].id;
        const uploadedFiles = [];
        
        // 작업지시서 생성 및 업로드
        btn.innerText = "작업지시서 생성...";
        try { 
            const orderSheetBlob = await generateOrderSheetPDF(orderInfo, cartData); 
            if(orderSheetBlob) { 
                const fileUrl = await uploadToSupabase(orderSheetBlob, `${newOrderId}/order_sheet.pdf`); 
                if(fileUrl) uploadedFiles.push({ name: `작업지시서.pdf`, url: fileUrl, type: 'order_sheet' }); 
            } 
        } catch(e) { console.warn("작업지시서 업로드 실패", e); }
        
        // 견적서 생성 및 업로드
        btn.innerText = "견적서 생성...";
        try { 
            const quoteBlob = await generateQuotationPDF(orderInfo, cartData); 
            if(quoteBlob) { 
                const fileUrl = await uploadToSupabase(quoteBlob, `${newOrderId}/quotation.pdf`); 
                if(fileUrl) uploadedFiles.push({ name: `견적서.pdf`, url: fileUrl, type: 'quotation' }); 
            } 
        } catch(e) { console.warn("견적서 업로드 실패", e); }
        
        // 개별 파일/디자인 처리
        for (let i = 0; i < cartData.length; i++) {
            const item = cartData[i]; 
            const idx = String(i + 1).padStart(2, '0');
            btn.innerText = `파일 처리 중 (${i + 1} / ${cartData.length})...`; 
            await new Promise(r => setTimeout(r, 10)); // UI 갱신용 딜레이
            
            let fileBlob = null; 
            let fileExt = "pdf"; 
            let displayName = "";
            
            if (item.type === 'design' && item.json) {
                try { 
                    // 10MB 제한 제거: 무조건 벡터 PDF 생성 시도 후 실패 시에만 래스터 전환
                    fileBlob = await generateProductVectorPDF(item.json, item.width, item.height); 
                    
                    if (!fileBlob) { // 생성 실패 시에만 이미지로 전환
                        console.warn("벡터 PDF 생성 실패, 이미지로 전환합니다.");
                        fileBlob = await generateRasterPDF(item.json, item.width, item.height); 
                    } 
                    displayName = `제작물_${idx}_${item.product.name}.pdf`; 
                } catch(e) {}
            } else if (item.type === 'file' && item.fileData) {
                try { 
                    const base64Data = item.fileData.split(',')[1]; 
                    fileBlob = base64ToBlob(base64Data, item.mimeType); 
                    fileExt = item.fileName.split('.').pop(); 
                    displayName = `고객파일_${idx}_${item.product.name}.${fileExt}`; 
                } catch(e) {}
            }
            
            if (fileBlob) { 
                const fileUrl = await uploadToSupabase(fileBlob, `${newOrderId}/file_${idx}_${Date.now()}.${fileExt}`); 
                if(fileUrl) uploadedFiles.push({ name: displayName, url: fileUrl, type: 'product' }); 
            }
        }
        
        btn.innerText = "완료 처리 중...";
        
        // 파일 정보 DB 업데이트
        await sb.from('orders').update({ files: uploadedFiles, status: '접수됨' }).eq('id', newOrderId);
        
        document.getElementById("deliveryInfoModal").style.display = "none"; 
        document.getElementById("checkoutModal").style.display = "flex";
        
        document.getElementById("orderName").value = manager; 
        document.getElementById("orderPhone").value = phone; 
        document.getElementById("orderAddr").value = address; 
        document.getElementById("orderMemo").value = request;
        
    } catch (e) { 
        console.error(e); 
        alert("오류: " + e.message); 
    } finally { 
        btn.innerText = "주문서 생성 및 결제"; 
        btn.disabled = false; 
        document.getElementById("loading").style.display = "none"; 
    }
}

async function uploadToSupabase(blob, path) { 
    try { 
        const { error } = await sb.storage.from('orders').upload(path, blob, { cacheControl: '3600', upsert: true }); 
        if (error) return null; 
        const { data } = sb.storage.from('orders').getPublicUrl(path); 
        return data.publicUrl; 
    } catch (e) { return null; } 
}

// [5] 결제 및 최종 완료
function processPayment() {
    document.getElementById("checkoutModal").style.display = "none"; 
    document.getElementById("successModal").style.display = "flex";
    
    const savedInfo = { 
        date: selectedDeliveryDate, 
        manager: document.getElementById("orderName").value, 
        phone: document.getElementById("orderPhone").value, 
        address: document.getElementById("orderAddr").value, 
        note: "-" 
    };
    
    // 다운로드 버튼에 이벤트 연결
    const finalCartData = [...cartData];
    
    document.getElementById("btnDownOrderSheet").onclick = async () => { 
        try {
            const blob = await generateOrderSheetPDF(savedInfo, finalCartData); 
            if(blob) downloadBlob(blob, "작업지시서.pdf"); 
        } catch(e) { console.error(e); alert("다운로드 실패"); }
    };
    
    document.getElementById("btnDownQuotation").onclick = async () => { 
        try {
            const blob = await generateQuotationPDF(savedInfo, finalCartData); 
            if(blob) downloadBlob(blob, "견적서.pdf"); 
        } catch(e) { console.error(e); alert("다운로드 실패"); }
    };
    
    // 장바구니 비우기
    cartData.length = 0; 
    localStorage.removeItem(currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest'); 
    renderCart(); 
    updateSummary(0);
}

// Base64 -> Blob 변환 유틸
function base64ToBlob(base64, mimeType) { 
    const byteCharacters = atob(base64); 
    const byteArrays = []; 
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) { 
        const slice = byteCharacters.slice(offset, offset + 512); 
        const byteNumbers = new Array(slice.length); 
        for (let i = 0; i < slice.length; i++) { 
            byteNumbers[i] = slice.charCodeAt(i); 
        } 
        const byteArray = new Uint8Array(byteNumbers); 
        byteArrays.push(byteArray); 
    } 
    return new Blob(byteArrays, { type: mimeType }); 
}

// Window 객체에 헬퍼 함수 할당 (HTML에서 호출 가능하도록)
window.toggleCartAccordion = (idx) => { 
    cartData[idx].isOpen = !cartData[idx].isOpen; 
    renderCart(); 
};

window.updateCartQty = (idx, change) => { 
    const item = cartData[idx]; 
    if(item) { 
        let newQty = (item.qty || 1) + change; 
        if(newQty < 1) newQty = 1; 
        item.qty = newQty; 
        saveCart(); 
        renderCart(); 
    } 
};

window.updateAddon = (idx, key, delta) => { 
    const item = cartData[idx]; 
    if(!item.addons) item.addons = {}; 
    if(!item.addons[key]) item.addons[key] = 0; 
    item.addons[key] += delta; 
    if(item.addons[key] < 0) item.addons[key] = 0; 
    saveCart(); 
    renderCart(); 
};

window.removeCartItem = (idx) => { 
    if(confirm("삭제하시겠습니까?")) { 
        cartData.splice(idx, 1); 
        saveCart(); 
        renderCart(); 
    } 
};