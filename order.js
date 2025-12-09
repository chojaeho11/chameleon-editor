import { canvas } from "./canvas-core.js";
import { PRODUCT_DB, ADDON_DB, cartData, currentUser, sb } from "./config.js"; 
import { applySize } from "./canvas-size.js";
import { generateOrderSheetPDF, generateQuotationPDF, generateProductVectorPDF, generateRasterPDF } from "./export.js"; 

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
            const mockInfo = {
                manager: currentUser?.email?.split('@')[0] || "고객",
                phone: "",
                date: new Date().toLocaleDateString()
            };
            try {
                const blob = await generateQuotationPDF(mockInfo, cartData);
                if (blob) downloadBlob(blob, `견적서_${new Date().toISOString().slice(0,10)}.pdf`);
            } catch(e) {
                console.error("견적서 오류:", e);
                alert("견적서 생성 중 오류가 발생했습니다.");
            }
        };
    }

    // [초기화] 페이지 로드 시 장바구니 UI 렌더링
    renderCart();
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

export function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    const { w, h, key, mode } = currentTargetProduct; 
    
    document.getElementById("productDetailModal").style.display = "none"; 
    
    if(window.applySize) window.applySize(w, h, key, mode, 'replace');
    
    switchToEditor(); 
    
    canvas.currentProductKey = key; 
    window.currentProductKey = key; 
}

function switchToEditor() { 
    document.getElementById("startScreen").style.display = "none"; 
    document.getElementById("mainEditor").style.display = "flex"; 
    window.dispatchEvent(new Event('resize')); 
}

async function addCanvasToCart() {
    const key = window.currentProductKey || canvas.currentProductKey || 'A4'; 
    const product = PRODUCT_DB[key] || PRODUCT_DB['A4'];
    
    const thumb = canvas.toDataURL({ format: 'png', multiplier: 0.5, quality: 0.8 });
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst']);
    const board = canvas.getObjects().find(o => o.isBoard);
    
    const finalW = board ? board.width : (product.w || canvas.width);
    const finalH = board ? board.height : (product.h || canvas.height);

    cartData.push({ 
        uid: Date.now(), 
        product: product, 
        type: 'design', 
        thumb: thumb, 
        json: json,
        width: finalW, 
        height: finalH,
        isOpen: true, 
        qty: 1,
        selectedAddons: {} // ★ 옵션 코드를 저장할 객체
    });
    
    saveCart(); 
    renderCart(); 
    alert(`[${product.name}] 상품이 장바구니에 담겼습니다.`);
}

function addFileToCart(e) {
    const file = e.target.files[0]; 
    if(!file || !currentTargetProduct) return;
    
    const reader = new FileReader();
    reader.onload = async function(evt) {
        const fileDataURI = evt.target.result; 
        let thumbUrl = 'https://placehold.co/100?text=FILE';
        
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
            isOpen: true, 
            qty: 1,
            selectedAddons: {} // ★ 옵션 초기화
        });
        
        saveCart(); 
        document.getElementById("productDetailModal").style.display = "none"; 
        renderCart(); 
        alert("파일이 장바구니에 담겼습니다.");
    };
    reader.readAsDataURL(file);
}

// ★★★ [장바구니 렌더링] - 재질/추가상품 2단 분리 및 코드 저장 방식 ★★★
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
        if (item.isOpen === undefined) item.isOpen = true;
        if (!item.selectedAddons) item.selectedAddons = {};
        
        // 1. 옵션 분류 (재질 / 추가상품)
        let matOpts = [], addOpts = [];
        if (item.product && item.product.addons) {
            item.product.addons.forEach(code => {
                const info = ADDON_DB[code]; // config.js의 ADDON_DB에서 정보 조회
                if (info) {
                    // category가 'material'이면 재질, 나머지는 추가상품
                    if (info.category === 'material') matOpts.push({code, ...info});
                    else addOpts.push({code, ...info});
                }
            });
        }

        // 2. 가격 계산 (옵션 코드로 가격 찾기)
        let basePrice = item.product.price;
        let addonPrice = 0;
        
        // selectedAddons에 저장된 코드들을 순회하며 가격 합산
        Object.values(item.selectedAddons).forEach(code => {
            const addon = ADDON_DB[code];
            if (addon) addonPrice += addon.price;
        });
        
        let totalItemPrice = (basePrice + addonPrice) * item.qty;
        grandTotal += totalItemPrice;
        
        const div = document.createElement("div"); 
        div.className = "cart-item"; 
        div.style.cssText = "display:flex; flexDirection:column; cursor:pointer; transition:all 0.2s; border:1px solid #e2e8f0; background:white; border-radius:12px; padding:20px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.03);";
        if (item.isOpen) div.style.borderColor = "var(--primary)";
        
        div.onclick = (e) => { 
            if(e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return; 
            window.toggleCartAccordion(idx); 
        };
        
        // ★ [수정됨] 상단 정보 (Grid/Flex 대응을 위한 클래스 추가, 파일명 표시)
        const mainRow = document.createElement("div"); 
        mainRow.className = "cart-top-row"; // CSS 클래스 적용
        
        let typeInfo = item.type === 'design' 
            ? '<span style="font-size:12px; color:#4338ca; background:#e0e7ff; padding:2px 6px; border-radius:4px; margin-right:5px;">🎨 직접 디자인</span>' 
            : `<span style="font-size:12px; color:#475569; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin-right:5px;">📁 파일 업로드</span> <span style="font-size:12px; color:#64748b;">${item.fileName || '파일명 없음'}</span>`;

        mainRow.innerHTML = `
            <img src="${item.thumb}" class="cart-thumb">
            
            <div class="cart-info">
                <div style="margin-bottom:6px; display:flex; align-items:center;">${typeInfo} ${item.isOpen ? '' : '<span style="font-size:11px; color:#999; margin-left:5px;">(펼치기)</span>'}</div>
                <h4 style="margin:0; font-size:16px; color:#1e293b; line-height:1.4;">${item.product.name}</h4>
                <div style="font-weight:800; font-size:15px; color:#6366f1; margin-top:6px;">${totalItemPrice.toLocaleString()}원</div>
            </div>
            
            <div class="cart-qty qty-control" style="display:flex; align-items:center; gap:0; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc;">
                <button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)" style="width:32px; height:32px; border:none; background:transparent; cursor:pointer;"><i class="fa-solid fa-minus" style="font-size:11px; color:#64748b;"></i></button>
                <div class="qty-val" style="width:36px; text-align:center; font-size:14px; font-weight:bold; color:#1e293b;">${item.qty}</div>
                <button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)" style="width:32px; height:32px; border:none; background:transparent; cursor:pointer;"><i class="fa-solid fa-plus" style="font-size:11px; color:#64748b;"></i></button>
            </div>
            
            <button onclick="window.removeCartItem(${idx})" class="cart-del qty-btn" style="width:36px; height:36px; border-radius:50%; background:#fee2e2; color:#ef4444; border:none; display:flex; align-items:center; justify-content:center;">
                <i class="fa-solid fa-trash" style="font-size:14px;"></i>
            </button>
        `;
        div.appendChild(mainRow);
        
        // ★ [수정됨] 하단 옵션 선택 영역 (넓게 보기 위한 클래스 추가)
        if(item.isOpen) {
            const optionArea = document.createElement("div");
            optionArea.className = "cart-option-area"; // CSS 클래스 적용
            optionArea.style.cssText = "background:#f8fafc; padding:15px; border-radius:8px; margin-top:20px; border:1px solid #eee;";
            
            let innerHTML = "";
            
            // 1. 재질 선택
            if (matOpts.length > 0) {
                innerHTML += `<div style="margin-bottom:20px;">
                    <label style="font-size:13px; color:#475569; font-weight:800; display:block; margin-bottom:8px;">✨ 재질 선택 (필수)</label>
                    <select onchange="window.updateCartOption(${idx}, 'opt_mat', this.value)" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; font-size:14px; cursor:pointer;">
                        <option value="">선택 안함 (기본)</option>`;
                matOpts.forEach(opt => {
                    const isSelected = item.selectedAddons['opt_mat'] === opt.code; 
                    innerHTML += `<option value="${opt.code}" ${isSelected?'selected':''}>${opt.name} (+${opt.price.toLocaleString()}원)</option>`;
                });
                innerHTML += `</select></div>`;
            }

            // 2. 추가 상품 (2열 배치용 클래스 적용)
            if (addOpts.length > 0) {
                if (matOpts.length > 0) innerHTML += `<hr style="border:0; border-top:1px dashed #cbd5e1; margin:15px 0;">`;
                
                innerHTML += `<div>
                    <label style="font-size:13px; color:#475569; font-weight:800; display:block; margin-bottom:10px;">➕ 추가 상품 (중복 선택 가능)</label>
                    <div class="cart-option-list" style="display:flex; flex-direction:column; gap:8px;">`; // PC에서는 Grid로 자동 변환됨

                addOpts.forEach(opt => {
                    const storageKey = `addon_${opt.code}`;
                    const isChecked = item.selectedAddons[storageKey] === opt.code;
                    
                    innerHTML += `
                        <label style="display:flex; align-items:center; cursor:pointer; font-size:14px; background:white; padding:12px; border:1px solid ${isChecked ? '#6366f1' : '#e2e8f0'}; border-radius:8px; transition:0.2s;">
                            <input type="checkbox" 
                                onchange="window.toggleCartAddon(${idx}, '${opt.code}', this.checked)"
                                ${isChecked ? 'checked' : ''}
                                style="accent-color:#6366f1; margin-right:10px; width:18px; height:18px;">
                            <span style="flex:1; font-weight:500;">${opt.name}</span>
                            <span style="font-weight:800; color:#6366f1;">+${opt.price.toLocaleString()}원</span>
                        </label>
                    `;
                });
                innerHTML += `</div></div>`;
            }

            if (matOpts.length === 0 && addOpts.length === 0) {
                innerHTML += `<div style="font-size:13px; color:#999;">선택 가능한 옵션이 없습니다.</div>`;
            }

            optionArea.innerHTML = innerHTML;
            div.appendChild(optionArea);
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

// [4] 주문 제출
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
            order_date: selectedDeliveryDate, manager_name: manager, phone, address, request_note: request, status: '파일처리중', files: [] 
        }]).select();
        
        if (orderError) throw orderError; 
        if (!orderData || orderData.length === 0) throw new Error("주문 ID 생성 실패");
        
        newOrderId = orderData[0].id;
        window.currentDbId = newOrderId;
        const uploadedFiles = [];
        
        btn.innerText = "문서 생성 중...";
        try { 
            const orderSheetBlob = await generateOrderSheetPDF(orderInfo, cartData); 
            if(orderSheetBlob) { 
                const url = await uploadToSupabase(orderSheetBlob, `${newOrderId}/order_sheet.pdf`); 
                if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
            } 
            const quoteBlob = await generateQuotationPDF(orderInfo, cartData); 
            if(quoteBlob) { 
                const url = await uploadToSupabase(quoteBlob, `${newOrderId}/quotation.pdf`); 
                if(url) uploadedFiles.push({ name: `견적서.pdf`, url: url, type: 'quotation' }); 
            } 
        } catch(e) { console.warn("문서 생성 실패", e); }
        
        for (let i = 0; i < cartData.length; i++) {
            const item = cartData[i]; 
            const idx = String(i + 1).padStart(2, '0');
            btn.innerText = `파일 처리 중 (${i + 1} / ${cartData.length})...`; 
            await new Promise(r => setTimeout(r, 10)); 
            
            let fileBlob = null; 
            let fileExt = "pdf"; 
            let displayName = "";
            
            if (item.type === 'design' && item.json) {
                try { 
                    fileBlob = await generateProductVectorPDF(item.json, item.width, item.height); 
                    if (!fileBlob) fileBlob = await generateRasterPDF(item.json, item.width, item.height); 
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
                const url = await uploadToSupabase(fileBlob, `${newOrderId}/file_${idx}_${Date.now()}.${fileExt}`); 
                if(url) uploadedFiles.push({ name: displayName, url: url, type: 'product' }); 
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

// [5] 결제 (가격 계산 시 옵션 코드 사용)
function processPayment() {
    const clientKey = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq"; 
    
    if (typeof TossPayments === 'undefined') return alert("결제 모듈 로드 실패");
    
    let totalAmount = 0;
    cartData.forEach(item => {
        let price = item.product.price;
        // 옵션 코드 lookup
        Object.values(item.selectedAddons).forEach(code => {
            if(ADDON_DB[code]) price += ADDON_DB[code].price;
        });
        totalAmount += price * (item.qty || 1);
    });

    if (totalAmount === 0) return alert("결제 금액 0원");

    const tossPayments = TossPayments(clientKey);
    const orderId = "order_" + new Date().getTime(); 
    const dbIdParam = window.currentDbId ? `?db_id=${window.currentDbId}` : "";

    tossPayments.requestPayment("카드", {
        amount: totalAmount,
        orderId: orderId,
        orderName: `카멜레온 디자인 주문 (${cartData.length}건)`,
        customerName: document.getElementById("orderName").value,
        successUrl: window.location.origin + "/success.html" + dbIdParam, 
        failUrl: window.location.origin + "/fail.html",
    })
    .catch(function (error) {
        if (error.code !== "USER_CANCEL") alert("결제 에러: " + error.message);
    });
}

function base64ToBlob(base64, mimeType) { 
    const byteCharacters = atob(base64); 
    const byteArrays = []; 
    for (let offset = 0; offset < byteCharacters.length; offset += 512) { 
        const slice = byteCharacters.slice(offset, offset + 512); 
        const byteNumbers = new Array(slice.length); 
        for (let i = 0; i < slice.length; i++) { byteNumbers[i] = slice.charCodeAt(i); } 
        const byteArray = new Uint8Array(byteNumbers); 
        byteArrays.push(byteArray); 
    } 
    return new Blob(byteArrays, { type: mimeType }); 
}

// 전역 함수들 (window 객체에 바인딩)
// ★ [핵심 추가] renderCart 함수를 전역으로 노출하여 다른 파일에서 호출 가능하게 함
window.renderCart = renderCart; 

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

// [단일 선택] 재질 등 Select Box 변경 시
window.updateCartOption = (idx, key, code) => {
    if (cartData[idx]) {
        if (!cartData[idx].selectedAddons) cartData[idx].selectedAddons = {};
        
        if (code === "") delete cartData[idx].selectedAddons[key];
        else cartData[idx].selectedAddons[key] = code; 
        
        saveCart(); 
        renderCart(); 
    }
};

// [다중 선택] 추가상품 Checkbox 변경 시
window.toggleCartAddon = (idx, code, isChecked) => {
    if (cartData[idx]) {
        if (!cartData[idx].selectedAddons) cartData[idx].selectedAddons = {};
        
        // 각 추가상품마다 고유 키를 사용하여 중복 저장을 허용
        const storageKey = `addon_${code}`;
        
        if (isChecked) {
            cartData[idx].selectedAddons[storageKey] = code;
        } else {
            delete cartData[idx].selectedAddons[storageKey];
        }
        
        saveCart(); 
        renderCart(); 
    }
};

window.removeCartItem = (idx) => { 
    if(confirm("삭제하시겠습니까?")) { 
        cartData.splice(idx, 1); 
        saveCart(); 
        renderCart(); 
    } 
};