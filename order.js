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

// ============================================================
// [1] 주문 시스템 초기화 및 이벤트 연결
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
            
            // 필수 옵션 체크
            for (let i = 0; i < cartData.length; i++) {
                const item = cartData[i];
                let hasMaterial = false;
                let hasFinish = false;

                if (item.product && item.product.addons) {
                    item.product.addons.forEach(code => {
                        const info = ADDON_DB[code];
                        if(info) {
                            if(info.category === 'material') hasMaterial = true;
                            if(info.category === 'finish') hasFinish = true;
                        }
                    });
                }

                if (hasMaterial && !item.selectedAddons['opt_mat']) {
                    alert(`[${item.product.name}] 상품의 '재질/두께'를 선택해주세요.`);
                    return;
                }
                if (hasFinish && !item.selectedAddons['opt_fin']) {
                    alert(`[${item.product.name}] 상품의 '마감 방식'을 선택해주세요.`);
                    return;
                }
            }
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
            } catch(e) { console.error(e); }
        };
    }

    renderCart();
}

// ============================================================
// [2] 캘린더 로직
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
    
    ['일','월','화','수','목','금','토'].forEach(d => grid.innerHTML += `<div class="cal-day-header">${d}</div>`);
    
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
        const checkDate = new Date(dateObj); checkDate.setHours(0,0,0,0);
        const limitDate = new Date(minDate); limitDate.setHours(0,0,0,0);

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

// ============================================================
// [3] 장바구니 데이터 관리
// ============================================================
function saveCart() { 
    try { 
        const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
        localStorage.setItem(storageKey, JSON.stringify(cartData)); 
    } catch(e) { console.error("장바구니 저장 실패", e); } 
}

export function openProductDetail(key, w, h, mode) {
    let product = PRODUCT_DB[key];
    if (!product) { product = { name: key, price: 0, img: '', addons: [] }; }
    currentTargetProduct = { key, w, h, mode, info: product };
    document.getElementById("pdpTitle").innerText = product.name;
    document.getElementById("pdpPrice").innerText = product.price.toLocaleString() + "원";
    const imgElem = document.getElementById("pdpImage");
    if(imgElem) imgElem.src = product.img || 'https://placehold.co/400';
    document.getElementById("productDetailModal").style.display = "flex";
}

export function startDesignFromProduct() { 
    if(!currentTargetProduct) return; 
    document.getElementById("productDetailModal").style.display = "none"; 
    if(window.applySize) window.applySize(currentTargetProduct.w, currentTargetProduct.h, currentTargetProduct.key, currentTargetProduct.mode, 'replace');
    switchToEditor(); 
    canvas.currentProductKey = currentTargetProduct.key; 
    window.currentProductKey = currentTargetProduct.key; 
}

function switchToEditor() { 
    document.getElementById("startScreen").style.display = "none"; 
    document.getElementById("mainEditor").style.display = "flex"; 
    window.dispatchEvent(new Event('resize')); 
}

// ★★★ [수정됨] 캔버스 이미지 크롭 저장 (검은 배경 제거) ★★★
async function addCanvasToCart() {
    if (!canvas) return;

    // 1. 현재 화면 상태 저장
    const originalVpt = canvas.viewportTransform;
    
    // 2. 뷰포트 초기화
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // 3. 'Board' (흰색 작업영역) 찾기
    const board = canvas.getObjects().find(o => o.isBoard);
    let thumbUrl = "";

    // 4. Board 영역만 잘라서 이미지 생성
    if (board) {
        thumbUrl = canvas.toDataURL({
            format: 'jpeg',
            quality: 0.7,
            multiplier: 0.3, 
            left: board.left,
            top: board.top,
            width: board.width * board.scaleX,
            height: board.height * board.scaleY
        });
    } else {
        thumbUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.3 });
    }

    // 5. 원래 화면 상태로 복구
    canvas.setViewportTransform(originalVpt);

    const key = window.currentProductKey || canvas.currentProductKey || 'A4'; 
    const product = PRODUCT_DB[key] || PRODUCT_DB['A4'];
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'paintFirst']);
    
    const finalW = board ? board.width : (product.w || canvas.width);
    const finalH = board ? board.height : (product.h || canvas.height);

    cartData.push({ 
        uid: Date.now(), product: product, type: 'design', thumb: thumbUrl, json: json,
        width: finalW, height: finalH, isOpen: true, qty: 1, selectedAddons: {} 
    });
    
    try {
        saveCart(); 
        renderCart(); 
        alert(`[${product.name}] 상품이 장바구니에 담겼습니다.`);
    } catch(e) {
        console.error(e);
        alert("장바구니 용량이 가득 찼습니다.");
    }
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
            } catch(e) {}
        } else if (file.type.startsWith('image/')) { 
            thumbUrl = fileDataURI; 
        }

        cartData.push({ 
            uid: Date.now(), product: currentTargetProduct.info, type: 'file', 
            fileName: file.name, mimeType: file.type, fileData: fileDataURI,
            thumb: thumbUrl, isOpen: true, qty: 1, selectedAddons: {} 
        });
        
        saveCart(); 
        document.getElementById("productDetailModal").style.display = "none"; 
        renderCart(); 
        alert("파일이 장바구니에 담겼습니다.");
    };
    reader.readAsDataURL(file);
}

// ============================================================
// [4] 장바구니 렌더링 (★ 3단 박스 분리 로직 ★)
// ============================================================
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
        
        // 1. 옵션 분류
        let matOpts = []; // 재질
        let finOpts = []; // 마감
        let addOpts = []; // 추가상품

        // ★ [중요] 옵션 정보 가져오기 (DB에서)
        if (item.product && item.product.addons) {
            item.product.addons.forEach(code => {
                const info = ADDON_DB[code]; // config.js에서 로드된 전역 변수
                if (info) {
                    const cat = (info.category || '').toLowerCase();
                    if (cat === 'material') matOpts.push({code, ...info});
                    else if (cat === 'finish') finOpts.push({code, ...info});
                    else addOpts.push({code, ...info});
                }
            });
        }

        // 2. 가격 계산
        if (!item.product) {
            console.warn("상품 정보가 유실된 항목이 있습니다.", item);
            item.product = { price: 0, name: "알 수 없는 상품" }; // 임시 방편
        }

        let basePrice = item.product.price;
        let addonPrice = 0;
        Object.values(item.selectedAddons).forEach(code => {
            const addon = ADDON_DB[code];
            if (addon) addonPrice += addon.price;
        });
        let totalItemPrice = (basePrice + addonPrice) * item.qty;
        grandTotal += totalItemPrice;
        
        // 3. HTML 생성 (카드)
        const div = document.createElement("div"); 
        div.className = "cart-item"; 
        
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
                <button onclick="event.stopPropagation(); window.removeCartItem(${idx})" style="border:none; background:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        // 4. 옵션 박스 렌더링
        if(item.isOpen) {
            const optionContainer = document.createElement("div");
            optionContainer.style.marginTop = "15px";
            
            // [박스 1] 재질 (필수)
            if (matOpts.length > 0) {
                const box = document.createElement("div");
                box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">① 재질/두께 <span class="badge-req">필수</span></div>`;
                const sel = document.createElement("select");
                sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_mat', e.target.value);
                
                let optsHTML = `<option value="">선택해주세요</option>`;
                matOpts.forEach(opt => {
                    const selected = item.selectedAddons['opt_mat'] === opt.code ? 'selected' : '';
                    const priceStr = opt.price > 0 ? ` (+${opt.price.toLocaleString()}원)` : '';
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`;
                });
                sel.innerHTML = optsHTML;
                box.appendChild(sel);
                optionContainer.appendChild(box);
            }

            // [박스 2] 마감 (필수)
            if (finOpts.length > 0) {
                const box = document.createElement("div");
                box.className = "cart-opt-group required-group";
                box.innerHTML = `<div class="opt-group-header">② 마감 방식 <span class="badge-req">필수</span></div>`;
                const sel = document.createElement("select");
                sel.className = "opt-select-box";
                sel.onchange = (e) => window.updateCartOption(idx, 'opt_fin', e.target.value);
                
                let optsHTML = `<option value="">선택해주세요</option>`;
                finOpts.forEach(opt => {
                    const selected = item.selectedAddons['opt_fin'] === opt.code ? 'selected' : '';
                    const priceStr = opt.price > 0 ? ` (+${opt.price.toLocaleString()}원)` : '';
                    optsHTML += `<option value="${opt.code}" ${selected}>${opt.name}${priceStr}</option>`;
                });
                sel.innerHTML = optsHTML;
                box.appendChild(sel);
                optionContainer.appendChild(box);
            }

            // [박스 3] 추가 상품 (선택)
            if (addOpts.length > 0) {
                const box = document.createElement("div");
                box.className = "cart-opt-group optional-group";
                box.innerHTML = `<div class="opt-group-header">③ 추가 상품 <span class="badge-sel">선택</span></div>`;
                const grid = document.createElement("div");
                grid.className = "opt-checkbox-grid";
                addOpts.forEach(opt => {
                    const key = `addon_${opt.code}`;
                    const checked = item.selectedAddons[key] === opt.code ? 'checked' : '';
                    const label = document.createElement("label");
                    label.className = "opt-checkbox-label";
                    label.innerHTML = `
                        <input type="checkbox" onchange="window.toggleCartAddon(${idx}, '${opt.code}', this.checked)" ${checked} style="margin-right:5px; accent-color:#6366f1;">
                        <span>${opt.name} <span style="color:#6366f1; font-weight:bold;">(+${opt.price.toLocaleString()})</span></span>
                    `;
                    grid.appendChild(label);
                });
                box.appendChild(grid);
                optionContainer.appendChild(box);
            }

            // 수량 조절
            const qtyBox = document.createElement("div");
            qtyBox.style.cssText = "display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:15px;";
            qtyBox.innerHTML = `
                <span style="font-size:13px; font-weight:bold;">수량</span>
                <div class="qty-wrapper" style="border:1px solid #ddd; border-radius:5px; display:flex;">
                    <button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button>
                    <div class="qty-val" style="width:40px; text-align:center; line-height:30px;">${item.qty}</div>
                    <button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button>
                </div>
            `;
            optionContainer.appendChild(qtyBox);

            div.appendChild(optionContainer);
        }
        
        listArea.appendChild(div);
    });
    updateSummary(grandTotal);
}

function updateSummary(total) {
    const elTotal = document.getElementById("summaryTotal");
    const elItem = document.getElementById("summaryItemPrice");
    const formatted = total.toLocaleString() + "원";
    if(elTotal) elTotal.innerText = formatted;
    if(elItem) elItem.innerText = formatted;
    
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

// [5] 주문 제출 및 결제 실행
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
            const orderSheetBlob = await generateOrderSheetPDF({ date: selectedDeliveryDate, manager, phone, address, note: request }, cartData); 
            if(orderSheetBlob) { 
                const url = await uploadToSupabase(orderSheetBlob, `${newOrderId}/order_sheet.pdf`); 
                if(url) uploadedFiles.push({ name: `작업지시서.pdf`, url: url, type: 'order_sheet' }); 
            } 
            const quoteBlob = await generateQuotationPDF({ date: selectedDeliveryDate, manager, phone, address, note: request }, cartData); 
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

// [6] 결제
function processPayment() {
    const clientKey = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq"; 
    
    if (typeof TossPayments === 'undefined') return alert("결제 모듈 로드 실패");
    
    let totalAmount = 0;
    cartData.forEach(item => {
        let price = item.product.price;
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

// ============================================================
// [7] 전역 함수 등록
// ============================================================
window.renderCart = renderCart; 
window.toggleCartAccordion = (idx) => { 
    cartData[idx].isOpen = !cartData[idx].isOpen; 
    renderCart(); 
};
window.updateCartQty = (idx, change) => { 
    if(cartData[idx]) { 
        cartData[idx].qty = Math.max(1, (cartData[idx].qty||1) + change); 
        saveCart(); renderCart(); 
    } 
};
window.updateCartOption = (idx, key, code) => {
    if (cartData[idx]) {
        if (!cartData[idx].selectedAddons) cartData[idx].selectedAddons = {};
        if (code === "") delete cartData[idx].selectedAddons[key];
        else cartData[idx].selectedAddons[key] = code; 
        saveCart(); renderCart(); 
    }
};
window.toggleCartAddon = (idx, code, isChecked) => {
    if (cartData[idx]) {
        if (!cartData[idx].selectedAddons) cartData[idx].selectedAddons = {};
        const storageKey = `addon_${code}`;
        if (isChecked) cartData[idx].selectedAddons[storageKey] = code;
        else delete cartData[idx].selectedAddons[storageKey];
        saveCart(); renderCart(); 
    }
};
window.removeCartItem = (idx) => { 
    if(confirm("삭제하시겠습니까?")) { 
        cartData.splice(idx, 1); 
        saveCart(); 
        renderCart(); 
    } 
};
window.processOrderSubmission = processOrderSubmission;