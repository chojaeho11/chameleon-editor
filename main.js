// main.js - Complete Integrated Version

import { initConfig, sb, currentUser, PRODUCT_DB } from "./config.js"; 
import { initCanvas, canvas } from "./canvas-core.js";
import { initSizeControls, applySize } from "./canvas-size.js"; 
import { initGuides } from "./canvas-guides.js";
import { initZoomPan } from "./canvas-zoom-pan.js";
import { initObjectTools } from "./canvas-objects.js";
import { initImageTools } from "./canvas-image.js";
import { initTemplateTools, loadProductFixedTemplate } from "./canvas-template.js";
import { initAiTools } from "./canvas-ai.js";
import { initExport } from "./export.js";
import { initOrderSystem } from "./order.js"; 
import { initAuth } from "./login.js";
import { initMyDesign } from "./my-design.js";
import { initCanvasUtils } from "./canvas-utils.js";
import { initShortcuts } from "./shortcuts.js";
import { initContextMenu } from "./context-menu.js";
import { createVectorOutline } from "./outlineMaker.js";

window.currentUploadedPdfUrl = null; 

// ==========================================================
// 1. 메인 초기화 및 통합 로직
// ==========================================================
window.addEventListener("DOMContentLoaded", async () => {
    const loading = document.getElementById("loading");
    const startScreen = document.getElementById("startScreen");
    const mainEditor = document.getElementById("mainEditor");

    try {
        if(loading) loading.style.display = 'flex';

        // 1. 필수 설정 및 캔버스 초기화
        window.loadProductFixedTemplate = loadProductFixedTemplate;
        await initConfig(); // DB 연결 및 PRODUCT_DB 로드 대기
        initCanvas();       
        
        // 2. 각종 도구 초기화
        initCanvasUtils();
        initShortcuts();
        initContextMenu();
        initSizeControls();
        initGuides();
        initZoomPan();
        initObjectTools();
        initImageTools();
        initTemplateTools();
        initAiTools();
        initExport();
        initOrderSystem(); // 주문 시스템
        initAuth();
        initMyDesign();
        initMobileTextEditor();
        initOutlineTool();
        initFileUploadListeners();

        // 3. 기여자 시스템 및 파트너스 초기화 (로그인 상태일 때만)
        if (currentUser) {
            await checkPartnerStatus();
            await initContributorSystem(); // [신규] 기여자 시스템 초기화
        }

        // 폰트 미리 로드
        if(window.preloadLanguageFont) await window.preloadLanguageFont();

        // 3. 마이페이지 버튼 연결
        const btnMyPage = document.getElementById("btnMyLibrary");
        if (btnMyPage) {
            btnMyPage.onclick = () => {
                if (!currentUser) return alert(window.t('msg_login_required'));
                location.href = 'mypage.html';
            };
        }

        console.log("🚀 에디터 모듈 초기화 완료");

        // =========================================================
        // ★ 마이페이지 연동 로직 (편집/재주문 복구)
        // =========================================================
        const loadId = localStorage.getItem('load_design_id');
        const cartFlag = localStorage.getItem('open_cart_on_load');

        // [CASE A] 디자인 편집으로 들어온 경우
        if (loadId) {
            console.log("📂 마이페이지 편집 요청 ID:", loadId);
            localStorage.removeItem('load_design_id'); 

            // 화면 강제 전환
            if(startScreen) startScreen.style.display = 'none';
            if(mainEditor) mainEditor.style.display = 'flex';
            document.body.classList.add('editor-active');
            
            // DB 조회
            const { data, error } = await sb.from('user_designs').select('*').eq('id', loadId).single();

            if (data && !error) {
                setTimeout(() => {
                    let savedKey = data.product_key;

                    if (!savedKey || savedKey === 'A4' || savedKey === 'custom' || !PRODUCT_DB[savedKey]) {
                        if(window.restoreDesignFromData) window.restoreDesignFromData(data);
                        alert("⚠️ 이 디자인의 상품 정보가 확인되지 않습니다.\n제작하실 상품 규격을 다시 선택해주세요.");
                        if (window.showCategorySelectionModal) {
                            window.showCategorySelectionModal();
                        } else {
                            const firstTab = document.querySelector('.cat-tab');
                            if(firstTab) firstTab.click();
                        }
                        return; 
                    }

                    window.currentProductKey = savedKey;
                    if(canvas) canvas.currentProductKey = savedKey;

                    if (PRODUCT_DB && PRODUCT_DB[savedKey]) {
                        window.selectedProductForChoice = PRODUCT_DB[savedKey];
                        const p = PRODUCT_DB[savedKey];
                        const limitLabel = document.getElementById("limitLabel");
                        if(limitLabel) limitLabel.innerText = `Max: ${p.w_mm || 210}x${p.h_mm || 297}`;
                        const inpW = document.getElementById("inputUserW");
                        const inpH = document.getElementById("inputUserH");
                        if(inpW) inpW.value = p.w_mm || 210;
                        if(inpH) inpH.value = p.h_mm || 297;
                    }

                    if(window.applySize) {
                        window.applySize(data.width, data.height, savedKey, 'standard', 'replace');
                    }
                    window.dispatchEvent(new Event('resize')); 

                    let jsonData = data.json_data;
                    if (typeof jsonData === 'string') {
                        try { jsonData = JSON.parse(jsonData); } catch(e) {}
                    }

                    if (window.canvas) {
                        window.canvas.loadFromJSON(jsonData, () => {
                            const objects = window.canvas.getObjects();
                            const board = objects.find(o => o.isBoard);
                            if (board) {
                                board.set({
                                    selectable: false, evented: false, hasControls: false, hasBorders: false,
                                    lockMovementX: true, lockMovementY: true, hoverCursor: 'default'
                                });
                                window.canvas.sendToBack(board);
                            }
                            window.canvas.requestRenderAll();
                            if(loading) loading.style.display = 'none';
                        });
                    }
                }, 500);
            } else {
                alert("디자인 데이터를 찾을 수 없습니다.");
                if(loading) loading.style.display = 'none';
            }
        
        // [CASE B] 장바구니 재주문
        } else if (cartFlag) {
            localStorage.removeItem('open_cart_on_load');
            if(startScreen) startScreen.style.display = 'none';
            if(mainEditor) mainEditor.style.display = 'flex';
            if(loading) loading.style.display = 'none';
            
            setTimeout(() => {
                const cartPage = document.getElementById('cartPage');
                if(cartPage) cartPage.style.display = 'block';
                if(window.renderCart) window.renderCart();
            }, 300);
        } else {
            if(loading) loading.style.display = 'none';
        }

    } catch (error) {
        console.error("🚨 Init Error:", error);
        if(loading) loading.style.display = 'none';
    }
});

function initFileUploadListeners() {
    const editorUpload = document.getElementById('imgUpload');
    if (editorUpload) {
        editorUpload.onchange = (e) => handleUniversalUpload(e.target.files[0], false);
    }
    const directUpload = document.getElementById('directUploadInput');
    if (directUpload) {
        directUpload.onchange = (e) => handleUniversalUpload(e.target.files[0], true);
    }
}

async function handleUniversalUpload(file, isFromStartScreen) {
    if (!file) return;
    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.querySelector('p').innerText = window.t('msg_processing_file');
    }
    try {
        if (isFromStartScreen) {
            const choiceModal = document.getElementById('choiceModal');
            if(choiceModal) choiceModal.style.display = 'none';
            const startScreen = document.getElementById("startScreen");
            const mainEditor = document.getElementById("mainEditor");
            if(startScreen) startScreen.style.display = "none";
            if(mainEditor) mainEditor.style.display = "flex";
            window.dispatchEvent(new Event('resize'));
            if (window.applySize && window.currentProductKey) {
                const product = window.PRODUCT_DB ? window.PRODUCT_DB[window.currentProductKey] : null;
                if (product) window.applySize(product.w || 210, product.h || 297, window.currentProductKey);
            }
        }

        if (file.type === 'application/pdf') {
            const timestamp = Date.now();
            const safeName = `${timestamp}_${Math.random().toString(36).substring(2, 8)}.pdf`;
            const filePath = `customer_uploads/${safeName}`;
            const { error: uploadErr } = await sb.storage.from('orders').upload(filePath, file);
            if (uploadErr) throw uploadErr;
            const { data: publicData } = sb.storage.from('orders').getPublicUrl(filePath);
            window.currentUploadedPdfUrl = publicData.publicUrl;
            await addPdfToCanvasAsImage(file);
        } else if (file.type.startsWith('image/')) {
            window.currentUploadedPdfUrl = null; 
            const reader = new FileReader();
            reader.onload = function (f) {
                fabric.Image.fromURL(f.target.result, function (img) {
                    fitImageToCanvas(img);
                });
            };
            reader.readAsDataURL(file);
        } else {
            alert(window.t('msg_unsupported_file'));
        }
    } catch (err) {
        console.error(err);
        alert("오류: " + err.message);
    } finally {
        if(loading) loading.style.display = "none";
        const dInput = document.getElementById('directUploadInput');
        const eInput = document.getElementById('imgUpload');
        if(dInput) dInput.value = '';
        if(eInput) eInput.value = '';
    }
}

async function addPdfToCanvasAsImage(file) {
    if (!window.pdfjsLib) {
        await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const hiddenCanvas = document.createElement('canvas');
    const ctx = hiddenCanvas.getContext('2d');
    hiddenCanvas.width = viewport.width;
    hiddenCanvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    const imgData = hiddenCanvas.toDataURL('image/jpeg', 0.8);
    fabric.Image.fromURL(imgData, function(img) {
        fitImageToCanvas(img);
        alert(window.t('msg_pdf_loaded'));
    });
}

function fitImageToCanvas(img) {
    if (!canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    let targetW, targetH, targetCenterX, targetCenterY;
    if (board) {
        targetW = board.width * board.scaleX;
        targetH = board.height * board.scaleY;
        targetCenterX = board.left + (targetW / 2);
        targetCenterY = board.top + (targetH / 2);
    } else {
        targetW = canvas.width;
        targetH = canvas.height;
        targetCenterX = targetW / 2;
        targetCenterY = targetH / 2;
    }
    const scale = Math.max(targetW / img.width, targetH / img.height);
    img.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center', left: targetCenterX, top: targetCenterY });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
}

function initOutlineTool() {
    const runOutlineMaker = async (btnId, type) => {
        const btn = document.getElementById(btnId);
        if (!btn) return; 
        const currentCanvas = window.canvas || canvas;
        const activeObj = currentCanvas.getActiveObject();
        if (!activeObj || activeObj.type !== 'image') {
            alert(window.t('msg_select_image_for_outline'));
            return;
        }
        const originalText = btn.innerHTML;
        btn.innerText = window.t('msg_generating');
        btn.disabled = true;
        try {
            const src = activeObj.getSrc();
            const result = await createVectorOutline(src, {
                dilation: 15, color: '#FF00FF', strokeWidth: 2, type: type 
            });
            const pathObj = new fabric.Path(result.pathData, {
                fill: '', stroke: result.color, strokeWidth: result.strokeWidth,
                strokeLineJoin: 'round', strokeLineCap: 'round', objectCaching: false,
                selectable: true, evented: true, originX: 'center', originY: 'center'
            });
            const imgCenter = activeObj.getCenterPoint();
            pathObj.set({
                left: imgCenter.x, top: imgCenter.y,
                scaleX: activeObj.scaleX, scaleY: activeObj.scaleY, angle: activeObj.angle
            });
            currentCanvas.add(pathObj);
            currentCanvas.bringToFront(pathObj);
            pathObj.setCoords();
            currentCanvas.requestRenderAll();
        } catch (error) {
            console.error("벡터 생성 실패:", error);
            alert("생성 실패: " + error.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    const btnNormal = document.getElementById("btn-create-outline");
    if (btnNormal) btnNormal.onclick = () => runOutlineMaker("btn-create-outline", "normal");
    const btnStandee = document.getElementById("btn-make-standee");
    if (btnStandee) btnStandee.onclick = () => runOutlineMaker("btn-make-standee", "standee");
    const btnKeyring = document.getElementById("btn-make-keyring");
    if (btnKeyring) btnKeyring.onclick = () => runOutlineMaker("btn-make-keyring", "keyring");
}

function initMobileTextEditor() {
    const mobileEditor = document.getElementById('mobileTextEditor');
    const mobileInput = document.getElementById('mobileTextInput');
    let activeTextObj = null;
    if (!window.canvas) return;
    window.canvas.on('selection:created', handleSelection);
    window.canvas.on('selection:updated', handleSelection);
    window.canvas.on('selection:cleared', closeMobileEditor);
    function handleSelection(e) {
        if (window.innerWidth > 768) return;
        const obj = e.selected ? e.selected[0] : window.canvas.getActiveObject();
        if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text')) {
            activeTextObj = obj;
            if(mobileInput) mobileInput.value = obj.text;
            if(mobileEditor) mobileEditor.style.display = 'flex';
            obj.enterEditing = function() {}; 
        } else {
            closeMobileEditor();
        }
    }
    if(mobileInput) {
        mobileInput.addEventListener('input', function() {
            if (activeTextObj) {
                activeTextObj.set('text', this.value);
                window.canvas.requestRenderAll();
            }
        });
    }
    window.closeMobileTextEditor = closeMobileEditor;
    function closeMobileEditor() {
        if(mobileEditor) mobileEditor.style.display = 'none';
        activeTextObj = null;
    }
    window.deleteMobileObject = function() {
        const active = window.canvas.getActiveObject();
        if(active) {
            window.canvas.remove(active);
            window.canvas.requestRenderAll();
        }
        closeMobileEditor();
    };
}

// ============================================================
// [파트너스 시스템] (기존 코드 유지)
// ============================================================
window.openPartnerConsole = function() {
    const modal = document.getElementById('partnerConsoleModal');
    if (modal) {
        modal.style.display = 'flex';
        if (window.switchPartnerTab) window.switchPartnerTab('pool');
    }
};
let lastOrderCount = -1;

async function checkPartnerStatus() {
    const btnConsole = document.getElementById('btnPartnerConsole');
    const btnApply = document.getElementById('btnPartnerApply');

    const { data: { user } } = await sb.auth.getUser();
    
    if (!user) {
        if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
        if (btnApply) {
            btnApply.style.display = 'inline-flex';
            btnApply.onclick = () => alert("로그인이 필요한 서비스입니다.");
        }
        return;
    }

    const { data } = await sb.from('profiles').select('role, region').eq('id', user.id).single();
    
    if (data && (data.role === 'franchise' || data.role === 'admin')) {
        if (btnConsole) btnConsole.style.setProperty('display', 'inline-flex', 'important');
        if (btnApply) btnApply.style.display = 'none';
        
        const badge = document.getElementById('partnerRegionBadge');
        if(badge) badge.innerText = data.region ? `📍 ${data.region} 지역` : '📍 지역 전체';
        window.currentPartnerRegion = data.region;

        setInterval(() => loadPartnerOrders('pool', true), 30000);
    } 
    else {
        if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
        if (btnApply) {
            btnApply.style.display = 'inline-flex';
            btnApply.onclick = applyForPartner; 
        }
    }
}

async function applyForPartner() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return alert("로그인이 필요합니다.");

    const name = prompt(window.t('prompt_partner_name'));
    if(!name) return;
    const phone = prompt(window.t('prompt_partner_phone'));
    if(!phone) return;
    const region = prompt(window.t('prompt_partner_region'));
    if(!region) return;

    if(!confirm(window.t('confirm_partner_apply')
        .replace('{name}', name)
        .replace('{phone}', phone)
        .replace('{region}', region))) return;

    try {
        const { error } = await sb.from('partner_applications').insert({
            user_id: user.id,
            company_name: name,
            contact_phone: phone,
            region: region,
            status: 'pending'
        });

        if (error) throw error;

        alert(window.t('msg_partner_apply_success'));
    } catch (e) {
        console.error(e);
        alert("신청 실패: " + e.message);
    }
}

window.switchPartnerTab = function(tabName) {
    document.querySelectorAll('.partner-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-menu .nav-item').forEach(el => {
        el.style.background = 'transparent'; el.style.color = '#64748b';
    });
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    if(tabName === 'pool') loadPartnerOrders('pool');
    if(tabName === 'my') loadPartnerOrders('my');
    if(tabName === 'settlement') loadSettlementInfo();
};

window.loadPartnerOrders = async function(mode, isAutoCheck = false) {
    const listId = mode === 'pool' ? 'orderPoolList' : 'myOrderList';
    const container = document.getElementById(listId);
    
    if (!isAutoCheck && container) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</div>';
    }

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    let query = sb.from('orders').select('*').order('created_at', {ascending: false});

    if (mode === 'pool') {
        query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
        
        if (window.currentPartnerRegion && window.currentPartnerRegion !== '전체') {
            query = query.ilike('address', `%${window.currentPartnerRegion}%`);
        }
    } else {
        query = query.eq('franchise_id', user.id);
    }

    const { data: orders, error } = await query;
    if (error) return;

    const currentCount = orders ? orders.length : 0;

    if (mode === 'pool') {
        if (lastOrderCount !== -1 && currentCount > lastOrderCount) {
            if ('speechSynthesis' in window) {
                const text = window.t('msg_voice_new_order') || "New order received.";
                const lang = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY === 'US') ? 'en-US' : 'ko-KR';
                const msg = new SpeechSynthesisUtterance(text);
                msg.lang = lang; 
                msg.rate = 1.0; 
                window.speechSynthesis.speak(msg);
            } else {
                try { document.getElementById('orderAlertSound')?.play(); } catch(e){}
            }
        }
        lastOrderCount = currentCount;
    }

    if (isAutoCheck && document.getElementById('partnerConsoleModal').style.display === 'none') return;
    if (!container) return;
    container.innerHTML = '';

    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">
            ${mode==='pool' ? '현재 접수 가능한 주문이 없습니다.' : '진행 중인 주문이 없습니다.'}
        </div>`;
        return;
    }

    orders.forEach(o => {
        let itemSummary = '상품 정보 없음';
        try {
            const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            if(items && items.length > 0) itemSummary = items.map(i => `${i.productName || i.product?.name} (${i.qty}개)`).join(', ');
        } catch(e){}

        let fileBtns = '';
        if(o.files && o.files.length > 0) {
            o.files.forEach((f) => {
                let displayName = f.name;
                if (!displayName) {
                    const decoded = decodeURIComponent(f.url.split('/').pop());
                    displayName = decoded.split('_').pop(); 
                }
                let icon = '📄';
                if(displayName.includes('견적서')) icon = '📑';
                if(displayName.includes('지시서')) icon = '📋';
                fileBtns += `<a href="${f.url}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-size:12px; padding:6px 10px; background:#f1f5f9; color:#334155; margin-right:5px; margin-bottom:5px; text-decoration:none; border-radius:4px; border:1px solid #e2e8f0; font-weight:500;">${icon} ${displayName}</a>`;
            });
        } else {
            fileBtns = '<span style="font-size:12px; color:#ef4444;">첨부파일 없음</span>';
        }

        const card = document.createElement('div');
        
        if (mode === 'pool') {
            const timeDiff = Math.floor((new Date() - new Date(o.created_at)) / (1000 * 60));
            const isTaken = (o.franchise_id !== null);
            
            let cardStyle = "background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:15px;";
            let btnHtml = `<button onclick="window.dibsOrder('${o.id}')" style="width:100%; margin-top:10px; padding:10px; background:#6366f1; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⚡ 접수하기</button>`;
            let badgeHtml = `<span style="background:#ef4444; color:white; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:4px;">NEW ${timeDiff}분전</span>`;

            if (isTaken) {
                if (o.franchise_id !== user.id) {
                    cardStyle = "background:#f1f5f9; border:1px solid #cbd5e1; border-radius:12px; padding:20px; margin-bottom:15px; opacity:0.7;";
                    btnHtml = `<button disabled style="width:100%; margin-top:10px; padding:10px; background:#94a3b8; color:white; border:none; border-radius:8px; font-weight:bold; cursor:not-allowed;">🚫 본사/타점 제작중</button>`;
                    badgeHtml = `<span style="background:#64748b; color:white; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:4px;">🔒 접수완료</span>`;
                } else {
                    btnHtml = `<button disabled style="width:100%; margin-top:10px; padding:10px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold;">✅ 내가 접수함</button>`;
                }
            }

            card.className = 'partner-order-card';
            card.style.cssText = cardStyle;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    ${badgeHtml}
                    <span style="font-size:12px; color:#888;">${o.manager_name}님</span>
                </div>
                <div style="font-weight:bold; font-size:15px; margin-bottom:5px;">📍 ${o.address}</div>
                <div style="font-size:13px; color:#666; margin-bottom:10px;">${itemSummary}</div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; font-size:16px;">${o.total_amount.toLocaleString()}원</div>
                    <div style="font-size:11px; color:#6366f1;">예상 정산금(90%): ${Math.floor(o.total_amount * 0.9).toLocaleString()}원</div>
                </div>
                ${btnHtml}
            `;
        } else {
            let statusHtml = '';
            if (o.status === '구매확정') statusHtml = `<span style="color:#16a34a; font-weight:bold; font-size:13px;">✅ 구매확정 (정산대기)</span>`;
            else if (o.status === '배송중') statusHtml = `<span style="color:#2563eb; font-weight:bold; font-size:13px;">🚚 배송중 (수령대기)</span>`;
            else statusHtml = `<button onclick="window.updateOrderStatus('${o.id}', '배송중')" style="padding:6px 12px; background:#334155; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">🚚 배송 출발</button>`;

            card.style.cssText = "background:#fff; border:1px solid #e2e8f0; padding:20px; border-radius:12px; margin-bottom:15px;";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:16px; margin-bottom:5px;">${o.manager_name}님 주문</div>
                        <div style="font-size:13px; color:#666; margin-bottom:8px;">${o.address}</div>
                        <div style="font-size:13px; color:#333; font-weight:bold; margin-bottom:10px;">${itemSummary}</div>
                        <div style="display:flex; flex-wrap:wrap;">${fileBtns}</div>
                    </div>
                    <div style="text-align:right; min-width:100px;">
                        ${statusHtml}
                        <div style="margin-top:5px; font-size:12px; color:#888;">${new Date(o.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            `;
        }
        container.appendChild(card);
    });
};

window.dibsOrder = async function(orderId) {
    if(!confirm(window.t('confirm_order_accept'))) return;
    const { data: { user } } = await sb.auth.getUser();
    
    const { data: check } = await sb.from('orders').select('franchise_id').eq('id', orderId).single();
    if(check.franchise_id) return alert(window.t('msg_order_already_taken'));

    await sb.from('orders').update({ franchise_id: user.id, status: '제작준비' }).eq('id', orderId);
    alert(window.t('msg_order_accept_success'));
    window.switchPartnerTab('my');
};

window.updateOrderStatus = async function(orderId, status) {
    if(!confirm(`상태를 '${status}'로 변경하시겠습니까?`)) return;
    await sb.from('orders').update({ status: status }).eq('id', orderId);
    window.loadPartnerOrders('my');
};

window.loadSettlementInfo = async function() {
    const tbody = document.getElementById('settlementListBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">로딩 중...</td></tr>';

    const { data: { user } } = await sb.auth.getUser();
    if(!user) return;

    const { data: orders } = await sb.from('orders')
        .select('*')
        .eq('franchise_id', user.id)
        .eq('status', '구매확정')
        .neq('settlement_status', 'withdrawn');

    const { data: pendings } = await sb.from('withdrawal_requests')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending');

    let availableTotal = 0;
    let pendingTotal = 0;
    let html = '';

    if (pendings) {
        pendings.forEach(p => pendingTotal += (p.amount || 0));
    }

    if(!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#999;">정산 가능한 내역이 없습니다.</td></tr>';
    } else {
        orders.forEach(o => {
            const amount = o.total_amount || 0;
            const profit = Math.floor(amount * 0.9); 
            availableTotal += profit;

            html += `
                <tr>
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9;">${new Date(o.created_at).toLocaleDateString()}</td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #f1f5f9; color:#64748b;">${amount.toLocaleString()}원</td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #f1f5f9; font-weight:bold; color:#16a34a;">${profit.toLocaleString()}원</td>
                    <td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;"><span class="badge" style="background:#dcfce7; color:#166534; padding:3px 8px; border-radius:4px; font-size:12px;">출금가능</span></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    document.getElementById('partnerAvailableBalance').innerText = availableTotal.toLocaleString() + '원';
    
    const pendingEl = document.getElementById('partnerPendingBalance');
    if(pendingEl) pendingEl.innerText = pendingTotal.toLocaleString() + '원';
    
    window.currentWithdrawableAmount = availableTotal;
};

window.requestPartnerWithdrawal = function() {
    const amt = window.currentWithdrawableAmount || 0;
    if (amt < 10000) return alert("최소 10,000원 이상부터 출금 가능합니다.");
    document.getElementById('wdAmount').value = amt.toLocaleString() + '원';
    document.getElementById('withdrawModal').style.display = 'flex';
};

window.submitWithdrawal = async function() {
    const amount = window.currentWithdrawableAmount;
    
    // [수정] 새로 추가된 입력 필드 값 가져오기
    const realName = document.getElementById('wdRealName').value.trim();
    const phone = document.getElementById('wdPhone').value.trim();
    const rrn = document.getElementById('wdRRN').value.trim();
    const bankInfo = document.getElementById('wdBankInfo').value.trim();
    const fileInput = document.getElementById('wdTaxFile');

    // [수정] 필수값 체크 강화
    if (!realName) return alert("예금주(실명)을 입력해주세요.");
    if (!phone) return alert("연락처를 입력해주세요.");
    if (!rrn || rrn.length < 13) return alert("주민등록번호를 정확히 입력해주세요.");
    if (!bankInfo) return alert("계좌 정보를 입력해주세요.");
    // 파일은 선택사항으로 변경 (원하시면 아래 주석 해제하여 필수로 만드세요)
    // if (fileInput.files.length === 0) return alert("신분증 또는 통장사본을 첨부해주세요.");

    if (!confirm(window.t('confirm_withdraw_request') || "Submit withdrawal request?\n(Incorrect info may delay deposit.)")) return;

    const btn = document.querySelector('#withdrawModal .btn-round.primary');
    btn.innerText = window.t('msg_sending') || "Sending..."; btn.disabled = true;

    try {
        const { data: { user } } = await sb.auth.getUser();
        
        let publicUrl = null;

        // 파일이 있는 경우에만 업로드 진행
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop();
            const path = `tax_invoices/${user.id}_${Date.now()}.${ext}`;
            
            const { error: upErr } = await sb.storage.from('orders').upload(path, file);
            if (upErr) throw upErr;
            
            const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
            publicUrl = urlData.publicUrl;
        }

        // [수정] DB Insert 시 새로 추가된 컬럼(account_holder, rrn, contact_phone) 포함
        const { error: dbErr } = await sb.from('withdrawal_requests').insert({
            user_id: user.id,
            amount: amount,
            bank_name: bankInfo,
            account_holder: realName, // 예금주
            contact_phone: phone,     // 연락처
            rrn: rrn,                 // 주민번호
            status: 'pending',
            tax_invoice_url: publicUrl
        });

        if (dbErr) throw dbErr;

        await sb.from('orders')
            .update({ settlement_status: 'withdrawn' })
            .eq('franchise_id', user.id)
            .eq('status', '구매확정')
            .neq('settlement_status', 'withdrawn');

        alert(window.t('msg_withdraw_success') || "Withdrawal request submitted.\nDeposit within 5 days after admin check.");
        document.getElementById('withdrawModal').style.display = 'none';
        
        // 입력창 초기화
        document.getElementById('wdRealName').value = '';
        document.getElementById('wdPhone').value = '';
        document.getElementById('wdRRN').value = '';
        document.getElementById('wdBankInfo').value = '';
        document.getElementById('wdTaxFile').value = '';

        if(window.loadSettlementInfo) window.loadSettlementInfo();

    } catch(e) {
        console.error(e);
        alert("오류: " + e.message);
    } finally {
        btn.innerText = "신청하기"; btn.disabled = false;
    }
};
// ============================================================
// [고객용] 주문 조회 & 리뷰
// ============================================================
window.openMyOrderList = async function() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return alert("로그인이 필요한 서비스입니다.");

    document.getElementById('myOrderModal').style.display = 'flex';
    const container = document.getElementById('myOrderListUser');
    container.innerHTML = '<div style="text-align:center; padding:30px;">로딩 중...</div>';

    const { data: orders, error } = await sb.from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error || !orders || orders.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#999;">주문 내역이 없습니다.</div>';
        return;
    }

    container.innerHTML = '';

    orders.forEach(o => {
        let itemSummary = '상품 정보 없음';
        try {
            const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            if(items && items.length > 0) {
                itemSummary = items.map(i => `${i.productName || i.product?.name} (${i.qty}개)`).join(', ');
            }
        } catch(e){}

        let statusBadge = `<span class="badge" style="background:#f1f5f9; color:#64748b;">${o.status}</span>`;
        let actionBtn = '';

        if (o.status === '배송중' || o.status === '제작준비') { 
            statusBadge = `<span class="badge" style="background:#e0e7ff; color:#4338ca;">🚚 ${o.status}</span>`;
            actionBtn = `
                <button onclick="openReviewModal('${o.id}')" class="btn-round primary" style="width:auto; padding:8px 15px; font-size:13px; box-shadow:0 4px 10px rgba(99,102,241,0.3);">
                    🎁 수령확인 & 구매확정
                </button>
            `;
        } else if (o.status === '구매확정' || o.status === '배송완료') {
            statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534;">✅ 구매확정</span>`;
            if(o.rating) {
                const stars = '⭐'.repeat(o.rating);
                actionBtn = `<div style="font-size:12px; color:#f59e0b;">별점: ${stars}</div>`;
            } else {
                actionBtn = `<span style="font-size:12px; color:#94a3b8;">후기 작성 완료</span>`;
            }
        }

        const div = document.createElement('div');
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; padding:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;";
        
        div.innerHTML = `
            <div>
                <div style="font-size:12px; color:#94a3b8; margin-bottom:5px;">${new Date(o.created_at).toLocaleDateString()} 주문</div>
                <div style="font-size:16px; font-weight:bold; color:#333; margin-bottom:5px;">${itemSummary}</div>
                <div style="font-size:14px; color:#64748b;">결제금액: <b>${o.total_amount.toLocaleString()}원</b></div>
                <div style="margin-top:8px;">${statusBadge}</div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                ${actionBtn}
            </div>
        `;
        container.appendChild(div);
    });
};

window.openReviewModal = function(orderId) {
    document.getElementById('targetReviewOrderId').value = orderId;
    document.getElementById('reviewCommentInput').value = '';
    setReviewRating(5);
    document.getElementById('reviewWriteModal').style.display = 'flex';
};

window.setReviewRating = function(score) {
    document.getElementById('targetReviewScore').value = score;
    document.getElementById('ratingText').innerText = score + "점";
    for(let i=1; i<=5; i++) {
        const star = document.getElementById(`star${i}`);
        if(i <= score) star.style.color = '#f59e0b';
        else star.style.color = '#e2e8f0';
    }
};

window.submitOrderReview = async function() {
    const orderId = document.getElementById('targetReviewOrderId').value;
    const score = parseInt(document.getElementById('targetReviewScore').value);
    const comment = document.getElementById('reviewCommentInput').value;

    if(!confirm("구매를 확정하시겠습니까? (반품 불가)")) return;

    const { error } = await sb.from('orders').update({
        status: '구매확정',
        received_at: new Date().toISOString(),
        rating: score,
        customer_review: comment
    }).eq('id', orderId);

    if (error) {
        alert("오류: " + error.message);
    } else {
        alert("구매확정 되었습니다. 감사합니다!");
        document.getElementById('reviewWriteModal').style.display = 'none';
        window.openMyOrderList();
        
        if(typeof loadSettlementInfo === 'function') loadSettlementInfo();
    }
};

// ============================================================
// [기여자 시스템] 통합 관리 스크립트 (Contributor System)
// ============================================================

// 전역 변수
let currentUploadType = 'png'; 

const REWARD_RATES = {
    'png': 100,
    'svg': 200,
    'logo': 150,
    'template': 100,
    'usage_share': 0.1 
};

const TIER_MULTIPLIERS = {
    'regular': 1,
    'excellent': 2,
    'hero': 4
};

let currentUserTier = 'regular';
let currentMultiplier = 1;

// 1. 초기화
window.initContributorSystem = async function() {
    if (!window.currentUser) return; 

    const { data: profile } = await sb.from('profiles')
        .select('contributor_tier, mileage, deposit') 
        .eq('id', window.currentUser.id)
        .single();

    if (profile) {
        currentUserTier = profile.contributor_tier || 'regular';
        currentMultiplier = TIER_MULTIPLIERS[currentUserTier] || 1;
        updateContributorUI(profile.deposit || 0);
    }
};

function updateContributorUI(balance) {
    const badge = document.getElementById('myTierBadge');
    const balEl = document.getElementById('contributorBalance');
    const bonusEls = document.querySelectorAll('.tier-bonus');

    let tierName = '일반 기여자';
    let badgeClass = 'contributor-badge';
    
    if (currentUserTier === 'excellent') {
        tierName = '🏆 우수 기여자 (x2)';
        badgeClass += ' badge-excellent';
    } else if (currentUserTier === 'hero') {
        tierName = '👑 영웅 기여자 (x4)';
        badgeClass += ' badge-hero';
    }
    
    if(badge) {
        badge.className = badgeClass;
        badge.innerText = tierName;
    }

    if(balEl) balEl.innerText = balance.toLocaleString() + '원';

    if (currentMultiplier > 1) {
        bonusEls.forEach(el => el.innerText = ` (x${currentMultiplier})`);
    }
}

// 2. 태그 자동 완성 (파일명 기반)
window.autoFillTags = function(input) {
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const tagInput = document.getElementById('cUploadTags');
        if(tagInput && !tagInput.value) { 
            tagInput.value = name;
        }
    }
};

// 3. 업로드 모달 열기
window.handleContributorUpload = function(type) {
    if (!window.currentUser) {
        alert("로그인이 필요한 서비스입니다.");
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }

    currentUploadType = type; 
    const modal = document.getElementById('contributorUploadModal');
    const title = document.getElementById('cUploadTitle');
    const svgArea = document.getElementById('cUploadSvgArea');
    const simpleArea = document.getElementById('cUploadSimpleArea');
    
    document.getElementById('cUploadTags').value = '';
    document.getElementById('cFileThumb').value = '';
    document.getElementById('cFileSvg').value = '';
    document.getElementById('cFileSimple').value = '';

    if (type === 'svg') {
        title.innerText = '📤 SVG 벡터 업로드';
        svgArea.style.display = 'flex';
        simpleArea.style.display = 'none';
    } else {
        const name = type === 'logo' ? '로고' : 'PNG 객체';
        title.innerText = `📤 ${name} 업로드`;
        svgArea.style.display = 'none';
        simpleArea.style.display = 'block';
    }

    modal.style.display = 'flex';
};

// 4. 업로드 실행
window.submitContributorUpload = async function() {
    const tags = document.getElementById('cUploadTags').value.trim();
    const loading = document.getElementById('loading');
    
    if (!tags) return alert("검색 키워드를 입력해주세요.");
    
    if(loading) loading.style.display = 'flex';

    try {
        let uploadCount = 0;
        let totalReward = 0;

        if (currentUploadType === 'svg') {
            const thumbFile = document.getElementById('cFileThumb').files[0];
            const svgFile = document.getElementById('cFileSvg').files[0];

            if (!thumbFile || !svgFile) {
                if(loading) loading.style.display = 'none';
                return alert("썸네일 이미지와 SVG 파일을 모두 선택해주세요.");
            }

            await processSingleUpload(thumbFile, svgFile, tags, 'vector'); 
            uploadCount = 1;

        } else {
            const files = document.getElementById('cFileSimple').files;
            if (files.length === 0) {
                if(loading) loading.style.display = 'none';
                return alert("파일을 선택해주세요.");
            }

            const category = currentUploadType === 'logo' ? 'logo' : 'graphic';

            for (const file of files) {
                await processSingleUpload(file, null, tags, category);
                uploadCount++;
            }
        }

        const baseAmount = REWARD_RATES[currentUploadType] || 100;
        const finalAmount = (baseAmount * currentMultiplier) * uploadCount;
        
        await addReward(finalAmount, `${currentUploadType.toUpperCase()} 업로드 보상 (${uploadCount}개)`);

        alert(`🎉 업로드 완료! 총 ${finalAmount.toLocaleString()}원이 적립되었습니다.`);
        document.getElementById('contributorUploadModal').style.display = 'none';
        
        window.initContributorSystem();
        if(window.searchTemplates) window.searchTemplates('');

    } catch (e) {
        console.error(e);
        alert("업로드 실패: " + e.message);
    } finally {
        if(loading) loading.style.display = 'none';
    }
};

// 5. 단일 파일 업로드 (리사이징 제거 & 1MB 용량 제한 적용)
async function processSingleUpload(file1, file2, userTags, category) {
    // [1] 용량 체크 (1MB = 1024 * 1024 bytes)
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file1.size > MAX_SIZE) {
        alert(`이미지 용량이 너무 큽니다. (현재: ${(file1.size/1024/1024).toFixed(1)}MB)\n1MB 이하의 파일만 업로드 가능합니다.`);
        throw new Error("File size limit exceeded"); // 실행 중단
    }

    const timestamp = Date.now();
    let thumbUrl = '';
    let dataUrl = '';

    // [2] 이미지 파일 업로드 (원본 그대로)
    const ext1 = file1.name.split('.').pop();
    // 한글 파일명 오류 방지를 위해 영문 랜덤명 생성
    const safeName1 = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${ext1}`;
    
    const path1 = `user_assets/${currentUploadType}/${window.currentUser.id}_${safeName1}`;
    const { error: err1 } = await sb.storage.from('design').upload(path1, file1);
    
    if (err1) throw err1;
    
    const { data: public1 } = sb.storage.from('design').getPublicUrl(path1);
    thumbUrl = public1.publicUrl;

    // [3] SVG 파일이 있으면 추가 업로드 (SVG 모드인 경우)
    if (file2 && currentUploadType === 'svg') {
        const ext2 = file2.name.split('.').pop();
        const safeName2 = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${ext2}`;
        const path2 = `user_assets/svg/${window.currentUser.id}_${safeName2}`;
        
        const { error: err2 } = await sb.storage.from('design').upload(path2, file2);
        if (err2) throw err2;
        
        const { data: public2 } = sb.storage.from('design').getPublicUrl(path2);
        dataUrl = public2.publicUrl;
    } else {
        // PNG/로고 모드면 썸네일 주소 = 원본 주소
        dataUrl = thumbUrl;
    }

    // [4] DB 저장
    const { error: dbErr } = await sb.from('library').insert({
        category: category,
        tags: userTags, 
        thumb_url: thumbUrl,
        data_url: dataUrl,
        user_id: window.currentUser.id,
        created_at: new Date(),
        status: 'approved',
        contributor_type: currentUploadType
    });

    if (dbErr) throw dbErr;
}

window.openTemplateCreator = function() {
    if (!window.currentUser) return alert("로그인 필요");
    if(confirm("디자인 에디터로 이동하시겠습니까?")) window.startEditorDirect('custom'); 
};

async function addReward(amount, description) {
    try {
        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', window.currentUser.id).single();
        const currentDeposit = pf?.deposit || 0;
        
        await sb.from('profiles').update({ 
            deposit: currentDeposit + amount 
        }).eq('id', window.currentUser.id);

        await sb.from('wallet_logs').insert({
            user_id: window.currentUser.id,
            type: 'contributor_reward',
            amount: amount,
            description: description
        });
    } catch (e) { console.error("보상 지급 실패:", e); }
}

window.triggerUsageReward = async function(templateOwnerId, type) {
    if (!window.currentUser || window.currentUser.id === templateOwnerId) return;

    try {
        const { data: owner } = await sb.from('profiles').select('contributor_tier, deposit').eq('id', templateOwnerId).single();
        if (!owner) return;

        const tier = owner.contributor_tier || 'regular';
        const multiplier = TIER_MULTIPLIERS[tier] || 1;
        const base = REWARD_RATES[type] || 100;
        const reward = (base * REWARD_RATES.usage_share) * multiplier;

        if (reward > 0) {
            await sb.from('profiles').update({ deposit: (owner.deposit || 0) + reward }).eq('id', templateOwnerId);
            await sb.from('wallet_logs').insert({ user_id: templateOwnerId, type: 'usage_royalty', amount: reward, description: `내 디자인(${type}) 사용됨` });
        }
    } catch (e) { console.error("사용료 지급 오류:", e); }
};
// ============================================================
// [VIP 주문] 전용 접수 로직 (다중 파일 + 매니저 + 메모)
// ============================================================
window.submitVipOrder = async function() {
    const name = document.getElementById('vipName').value;
    const phone = document.getElementById('vipPhone').value;
    const memo = document.getElementById('vipMemo').value;
    const fileInput = document.getElementById('vipFileInput');
    
    // 선택된 라디오 버튼 값 가져오기
    const managerRadio = document.querySelector('input[name="vipManager"]:checked');
    const managerName = managerRadio ? managerRadio.value : '본사';

    if(!name || !phone) return alert(window.t('alert_vip_info_needed'));
    if(fileInput.files.length === 0) return alert(window.t('alert_vip_file_needed'));

    const btn = document.querySelector('#vipOrderModal .btn-round.primary');
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_uploading_files');
    btn.disabled = true;

    try {
        const uploadedFiles = [];
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);

        // 1. 다중 파일 업로드 반복 처리
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            const ext = file.name.split('.').pop();
            // 파일명 안전하게 변환
            const safeName = `VIP_${timestamp}_${randomStr}_${i}.${ext}`;
            const path = `vip_uploads/${safeName}`;

            const { error: uploadErr } = await sb.storage.from('orders').upload(path, file);
            if (uploadErr) throw uploadErr;

            const { data: publicData } = sb.storage.from('orders').getPublicUrl(path);
            
            uploadedFiles.push({
                name: file.name,
                url: publicData.publicUrl
            });
        }

        // 2. DB 저장 (파일 목록은 JSON으로 저장)
        const { error: dbErr } = await sb.from('vip_orders').insert({
            customer_name: name,
            customer_phone: phone,
            preferred_manager: managerName,
            memo: memo,
            files: uploadedFiles, // JSONB 타입
            status: '대기중'
        });

        if(dbErr) throw dbErr;

        alert(window.t('msg_vip_order_success').replace('{manager}', managerName));
        document.getElementById('vipOrderModal').style.display = 'none';
        
        // 입력창 초기화
        document.getElementById('vipName').value = '';
        document.getElementById('vipPhone').value = '';
        document.getElementById('vipMemo').value = '';
        document.getElementById('vipFileInput').value = '';
        document.getElementById('vipFileList').innerHTML = '';

    } catch (e) {
        console.error(e);
        alert("접수 중 오류가 발생했습니다: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};