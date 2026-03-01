// main.js - Complete Integrated Version

import { initConfig, sb, currentUser, PRODUCT_DB } from "./config.js?v=123";
import { initCanvas, canvas } from "./canvas-core.js?v=123";
import { initSizeControls, applySize } from "./canvas-size.js?v=123";
import { initGuides } from "./canvas-guides.js?v=123";
import { initZoomPan } from "./canvas-zoom-pan.js?v=123";
import { initObjectTools } from "./canvas-objects.js?v=123";
import { initPageTools } from "./canvas-pages.js?v=123"; // [추가] 페이지 도구
import { initImageTools } from "./canvas-image.js?v=123";
import { initTemplateTools, loadProductFixedTemplate } from "./canvas-template.js?v=123";
import { initAiTools } from "./canvas-ai.js?v=123";
import { initExport } from "./export.js?v=123";
import { initOrderSystem } from "./order.js?v=123";
import { initAuth } from "./login.js?v=123";
import { initMyDesign } from "./my-design.js?v=123";
import { initCanvasUtils } from "./canvas-utils.js?v=123";
import { initShortcuts } from "./shortcuts.js?v=123";
import { initContextMenu } from "./context-menu.js?v=123";
import { createVectorOutline } from "./outlineMaker.js?v=123";
import { initVideoMaker } from "./video-maker.js?v=123";
import { initPptMode } from "./ppt-mode.js?v=123";
import { initWeddingMode } from "./wedding-mode.js?v=123";
import { initIconTools } from "./canvas-icons.js?v=123";

window.currentUploadedPdfUrl = null;

// KRW → 현지 통화 표시 헬퍼
function fmtMoney(krw) {
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const rate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[country]) || 1;
    const converted = (krw || 0) * rate;
    if (country === 'JP') return '¥' + Math.floor(converted).toLocaleString();
    if (country === 'US') return '$' + Math.round(converted).toLocaleString();
    if (country === 'CN') return '¥' + Math.round(converted).toLocaleString();
    if (country === 'AR') return Math.round(converted).toLocaleString() + ' ﷼';
    if (country === 'ES') return '€' + converted.toFixed(2);
    return converted.toLocaleString() + '원';
}

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
        
        // 2. 각종 도구 초기화 (개별 try/catch로 하나가 실패해도 나머지 계속 실행)
        const inits = [
            ['CanvasUtils', initCanvasUtils],
            ['Shortcuts', initShortcuts],
            ['ContextMenu', initContextMenu],
            ['SizeControls', initSizeControls],
            ['Guides', initGuides],
            ['ZoomPan', initZoomPan],
            ['ObjectTools', initObjectTools],
            ['ImageTools', initImageTools],
            ['PageTools', initPageTools],
            ['TemplateTools', initTemplateTools],
            ['AiTools', initAiTools],
            ['IconTools', initIconTools],
            ['Export', initExport],
            ['OrderSystem', initOrderSystem],
            ['Auth', initAuth],
            ['MyDesign', initMyDesign],
            ['MobileTextEditor', initMobileTextEditor],
            ['OutlineTool', initOutlineTool],
            ['FileUpload', initFileUploadListeners],
            ['PptMode', initPptMode],
            ['WeddingMode', initWeddingMode],
        ];
        for (const [name, fn] of inits) {
            try { fn(); } catch(e) { console.warn(`⚠️ ${name} init failed:`, e); }
        }

        // 3. 기여자 시스템 및 파트너스 초기화 (로그인 상태일 때만)
        if (currentUser) {
            await checkPartnerStatus();
            await initContributorSystem(); 
            // [추가] 유저 등급(파트너스) 및 수익금(예치금) UI 강제 갱신
            if(window.updateMainPageUserInfo) await window.updateMainPageUserInfo();
        }

        // 폰트 미리 로드
        if(window.preloadLanguageFont) await window.preloadLanguageFont();

        // 3. 마이페이지 버튼 연결
        const btnMyPage = document.getElementById("btnMyLibrary");
        if (btnMyPage) {
            btnMyPage.onclick = () => {
                // [수정] 다국어 적용
                if (!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }
                location.href = 'mypage.html';
            };
        }

        initVideoMaker();
        console.log("🚀 에디터 모듈 초기화 완료");

        // =========================================================
        // ★ 마이페이지 연동 로직 (편집/재주문 복구)
        // =========================================================
        let loadId = null; try { loadId = localStorage.getItem('load_design_id'); } catch(e) {}
        let cartFlag = null; try { cartFlag = localStorage.getItem('open_cart_on_load'); } catch(e) {}

        // [CASE A] 디자인 편집으로 들어온 경우
        if (loadId) {
            try { localStorage.removeItem('load_design_id'); } catch(e) {}

            // 화면 강제 전환
            if(startScreen) startScreen.style.display = 'none';
            if(mainEditor) mainEditor.style.display = 'flex';
            document.body.classList.add('editor-active');
            
            // DB 조회
            if (!sb) throw new Error("DB 연결이 아직 초기화되지 않았습니다.");
            const { data, error } = await sb.from('user_designs').select('*').eq('id', loadId).single();

            if (data && !error) {
                setTimeout(() => {
                    let savedKey = data.product_key;

                    if (!savedKey || savedKey === 'A4' || savedKey === 'custom' || !PRODUCT_DB[savedKey]) {
                        if(window.restoreDesignFromData) window.restoreDesignFromData(data);
                        showToast(window.t('msg_product_info_missing'), "warn");
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
                showToast(window.t('msg_no_data', "Design data not found."), "warn");
                if(loading) loading.style.display = 'none';
            }
        
        // [CASE B] 장바구니 재주문
        } else if (cartFlag) {
            try { localStorage.removeItem('open_cart_on_load'); } catch(e) {}
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
            showToast(window.t('msg_unsupported_file'), "warn");
        }
    } catch (err) {
        console.error(err);
        showToast(window.t('err_prefix') + err.message, "error");
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
        showToast(window.t('msg_pdf_loaded'), "success");
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
    // 보드의 30%에 맞춰 작게 중앙 배치 (Math.min으로 비율 유지)
    const maxW = targetW * 0.3;
    const maxH = targetH * 0.3;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    img.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center', left: targetCenterX, top: targetCenterY });
    canvas.add(img);
    canvas.bringToFront(img);
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
            showToast(window.t('msg_select_image_for_outline'), "warn");
            return;
        }
        const originalText = btn.innerHTML;
        btn.innerText = window.t('msg_generating');
        btn.disabled = true;
        try {
            var src = activeObj.getSrc();
            var result = await createVectorOutline(src, {
                offset: 20, type: type
            });

            var pathObj = new fabric.Path(result.pathData, {
                fill: 'rgba(200,200,200,0.25)',
                stroke: result.color,
                strokeWidth: result.strokeWidth,
                strokeLineJoin: 'round',
                strokeLineCap: 'round',
                objectCaching: false,
                selectable: true,
                evented: true,
                originX: 'center',
                originY: 'center'
            });

            var ob = result.outlineBounds;
            var s = activeObj.scaleX;
            var sY = activeObj.scaleY;

            var imgLeft, imgTop;
            if (activeObj.originX === 'center') {
                imgLeft = activeObj.left - (activeObj.width * s / 2);
            } else {
                imgLeft = activeObj.left;
            }
            if (activeObj.originY === 'center') {
                imgTop = activeObj.top - (activeObj.height * sY / 2);
            } else {
                imgTop = activeObj.top;
            }

            var imgCenterX = imgLeft + (activeObj.width * s / 2);
            var imgCenterY = imgTop + (activeObj.height * sY / 2);

            var outlineCenterX = (ob.left + ob.width / 2);
            var outlineCenterY = (ob.top + ob.height / 2);
            var imgOriginX = result.imgWidth / 2;
            var imgOriginY = result.imgHeight / 2;

            pathObj.set({
                left: imgCenterX + (outlineCenterX - imgOriginX) * s,
                top: imgCenterY + (outlineCenterY - imgOriginY) * sY,
                scaleX: s,
                scaleY: sY,
                angle: activeObj.angle
            });

            currentCanvas.add(pathObj);

            if (type === 'keyring') {
                var outerR = 29.5 * s;
                var innerR = 17.7 * s;
                var outlineTopCenterX = imgCenterX + (outlineCenterX - imgOriginX) * s;
                var outlineTopY = imgCenterY + (ob.top - imgOriginY) * sY;
                var holeCx = outlineTopCenterX;
                var holeCy = outlineTopY - outerR * 0.5;

                var outerCircle = new fabric.Circle({
                    radius: outerR,
                    left: 0, top: 0,
                    fill: 'rgba(200,200,200,0.3)',
                    stroke: result.color,
                    strokeWidth: result.strokeWidth * s,
                    originX: 'center', originY: 'center'
                });
                var innerCircle = new fabric.Circle({
                    radius: innerR,
                    left: 0, top: 0,
                    fill: 'white',
                    stroke: result.color,
                    strokeWidth: result.strokeWidth * s,
                    originX: 'center', originY: 'center'
                });

                // 고리 그룹 (안쪽/바깥쪽 함께 이동)
                var holeGroup = new fabric.Group([outerCircle, innerCircle], {
                    left: holeCx,
                    top: holeCy,
                    originX: 'center', originY: 'center',
                    selectable: true, evented: true,
                    hasControls: false, hasBorders: true,
                    lockScalingX: true, lockScalingY: true,
                    lockRotation: true,
                    hoverCursor: 'move'
                });
                currentCanvas.add(holeGroup);
                currentCanvas.bringToFront(holeGroup);
            }

            // standee base
            if (type === 'standee') {
                var baseH3 = Math.max(pathObj.height * s * 0.10, 15);
                var baseW3 = pathObj.width * s * 0.6;
                var outlineBotX = imgCenterX + (outlineCenterX - imgOriginX) * s;
                var outlineBotY = imgCenterY + (ob.top + ob.height - imgOriginY) * sY;

                var baseRect = new fabric.Rect({
                    width: baseW3,
                    height: baseH3,
                    left: outlineBotX,
                    top: outlineBotY - baseH3 * 0.5,
                    fill: 'rgba(200,200,200,0.3)',
                    stroke: result.color,
                    strokeWidth: result.strokeWidth * s,
                    rx: 3 * s,
                    ry: 3 * s,
                    originX: 'center',
                    originY: 'top',
                    selectable: true,
                    evented: true,
                    hasControls: false,
                    hasBorders: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    lockRotation: true,
                    hoverCursor: 'move'
                });
                currentCanvas.add(baseRect);
                currentCanvas.bringToFront(baseRect);
            }

            currentCanvas.bringToFront(pathObj);
            pathObj.setCoords();
            currentCanvas.requestRenderAll();
        } catch (error) {
            console.error("벡터 생성 실패:", error);
            showToast(window.t('msg_gen_fail') + ": " + error.message, "error");
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
    // [변경] 모달 대신 별도 페이지로 이동
    location.href = 'partner.html';
};
async function checkPartnerStatus() {
    if (!sb) { console.warn("[checkPartnerStatus] sb가 아직 초기화되지 않음"); return; }
    const btnConsole = document.getElementById('btnPartnerConsole');
    const btnApply = document.getElementById('btnPartnerApply');

    const { data: { user } } = await sb.auth.getUser();
    
    // 1. 비로그인 상태
    if (!user) {
        if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
        if (btnApply) {
            btnApply.style.display = 'inline-flex';
            btnApply.onclick = () => {
                const modal = document.getElementById('partnerApplyModal');
                if(modal) modal.style.display = 'flex';
            };
        }
        return;
    }

    // 2. 로그인 상태 (등급 확인)
    const { data } = await sb.from('profiles').select('role, region').eq('id', user.id).single();
    
    if (data) {
        let role = (data.role || 'user').toLowerCase().trim();
        
        // s가 붙은 경우만 단수로 통일
        if (role === 'partners') role = 'partner';

        // ★ 입장 허용 등급 (platinum 명시적 추가)
        const allowed = ['admin', 'franchise', 'partner', 'platinum'];

        if (allowed.includes(role)) {
            // [권한 있음] 입장 버튼 보이기 / 신청 버튼 숨기기
            if (btnConsole) btnConsole.style.setProperty('display', 'inline-flex', 'important');
            if (btnApply) btnApply.style.display = 'none';
            
            const badge = document.getElementById('partnerRegionBadge');
            if(badge) badge.innerText = data.region ? `📍 ${data.region}` : '📍 전체 지역';
            window.currentPartnerRegion = data.region;
        } 
        else {
            // [권한 없음] 입장 버튼 숨기기 / 신청 버튼 보이기
            if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
            if (btnApply) {
                btnApply.style.display = 'inline-flex';
                btnApply.onclick = applyForPartner;
            }
        }
    }
}

async function applyForPartner() {
    const { data: { user } } = await sb.auth.getUser();
    
    if (!user) {
        showToast(window.t('msg_login_required') || "로그인이 필요합니다.", "warn");
        const loginModal = document.getElementById('loginModal');
        if(loginModal) loginModal.style.display = 'flex';
        return;
    }

    // 구린 입력창(prompt) 대신 index.html에 있는 예쁜 모달 띄우기
    const modal = document.getElementById('partnerApplyModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error("partnerApplyModal 요소를 찾을 수 없습니다.");
        showToast(window.t('msg_cannot_load_form'), "error");
    }
}

// [파트너 마켓플레이스] 기존 시공주문 접수/입찰 시스템 제거됨 — partner.html로 이전
// ============================================================
// [고객용] 주문 조회 & 리뷰
// ============================================================
window.openMyOrderList = async function() {
    if (!sb) { console.warn("[openMyOrderList] sb가 아직 초기화되지 않음"); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { showToast(window.t('msg_login_required'), "warn"); return; }

    document.getElementById('myOrderModal').style.display = 'flex';
    const container = document.getElementById('myOrderListUser');
    container.innerHTML = `<div style="text-align:center; padding:30px;">${window.t('msg_loading','로딩 중...')}</div>`;

    const { data: orders, error } = await sb.from('orders')
        .select('id, status, total_amount, items, created_at, payment_status, manager_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !orders || orders.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px; color:#999;">${window.t('msg_no_orders','주문 내역이 없습니다.')}</div>`;
        return;
    }

    container.innerHTML = '';

    orders.forEach(o => {
        let itemSummary = window.t('pt_no_product_info','상품 정보 없음');
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
                <div style="font-size:14px; color:#64748b;">결제금액: <b>${fmtMoney(o.total_amount)}</b></div>
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

    if(!confirm(window.t('confirm_purchase_final'))) return;

    const { error } = await sb.from('orders').update({
        status: '구매확정',
        received_at: new Date().toISOString(),
        rating: score,
        customer_review: comment
    }).eq('id', orderId);

    if (error) {
        showToast(window.t('err_prefix') + error.message, "error");
    } else {
        showToast(window.t('msg_purchase_confirmed'), "success");
        document.getElementById('reviewWriteModal').style.display = 'none';
        window.openMyOrderList();

        // [파트너 마켓플레이스] 구매확정 시 partner_settlements 상태 업데이트
        try {
            const now = new Date().toISOString();
            const eligible = new Date(Date.now() + 15*24*60*60*1000).toISOString();
            await sb.from('partner_settlements')
                .update({
                    customer_confirmed_at: now,
                    withdrawal_eligible_at: eligible,
                    settlement_status: 'waiting'
                })
                .eq('order_id', orderId)
                .eq('settlement_status', 'pending');
        } catch(e) { console.warn('partner_settlements update:', e); }
    }
};

// ============================================================
// [기여자 시스템] 통합 관리 스크립트 (Contributor System)
// ============================================================

// 전역 변수
let currentUploadType = 'png'; 

const REWARD_RATES = {
    'png': 150,
    'svg': 150,
    'logo': 150,
    'template': 150,
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
    // 비로그인 상태에서도 보상금 표시는 환산
    updateContributorRewardDisplay();

    if (!window.currentUser) return;
    if (!sb) { console.warn("[initContributorSystem] sb가 아직 초기화되지 않음"); return; }

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

    const _cl = window.CURRENT_LANG || 'ko';
    const _tn = {
        ko: { regular: '일반 기여자', excellent: '🏆 우수 기여자 (x2)', hero: '👑 영웅 기여자 (x4)' },
        ja: { regular: '一般貢献者', excellent: '🏆 優秀貢献者 (x2)', hero: '👑 英雄貢献者 (x4)' },
        en: { regular: 'Contributor', excellent: '🏆 Top Contributor (x2)', hero: '👑 Hero Contributor (x4)' },
        zh: { regular: '普通贡献者', excellent: '🏆 优秀贡献者 (x2)', hero: '👑 英雄贡献者 (x4)' },
        ar: { regular: 'مساهم', excellent: '🏆 مساهم ممتاز (x2)', hero: '👑 مساهم بطل (x4)' },
        es: { regular: 'Contribuidor', excellent: '🏆 Top Contribuidor (x2)', hero: '👑 Héroe Contribuidor (x4)' },
        de: { regular: 'Mitwirkender', excellent: '🏆 Top-Mitwirkender (x2)', hero: '👑 Held-Mitwirkender (x4)' },
        fr: { regular: 'Contributeur', excellent: '🏆 Top Contributeur (x2)', hero: '👑 Héros Contributeur (x4)' },
    };
    const _tl = _tn[_cl] || _tn.ko;
    let tierName = _tl.regular;
    let badgeClass = 'contributor-badge';

    if (currentUserTier === 'excellent') {
        tierName = _tl.excellent;
        badgeClass += ' badge-excellent';
    } else if (currentUserTier === 'hero') {
        tierName = _tl.hero;
        badgeClass += ' badge-hero';
    }

    if(badge) {
        badge.className = badgeClass;
        badge.innerText = tierName;
    }

    if(balEl) balEl.innerText = fmtMoney(balance);

    if (currentMultiplier > 1) {
        bonusEls.forEach(el => el.innerText = ` (x${currentMultiplier})`);
    }

    // 로그인 상태에서도 보상금 표시 갱신
    updateContributorRewardDisplay();
}

// 기여자 보상금 표시 환산 (150 KRW → 현지 통화) - 로그인 불필요
function updateContributorRewardDisplay() {
    const cfg = window.SITE_CONFIG || {};
    const cRate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[cfg.COUNTRY]) || 1;
    const baseReward = 150 * cRate;
    const rewardDisplay = cfg.COUNTRY === 'JP' ? Math.floor(baseReward) : cfg.COUNTRY === 'US' ? Math.round(baseReward) : baseReward;
    document.querySelectorAll('.c-reward').forEach(el => {
        const bonusSpan = el.querySelector('.tier-bonus');
        el.textContent = rewardDisplay + ' ';
        if(bonusSpan) el.appendChild(bonusSpan);
    });

    // 로고 업로드 placeholder 보상금 환산
    const logoInput = document.getElementById('logoKeywordInput');
    if(logoInput) {
        const unit = cfg.COUNTRY === 'JP' ? '¥' : cfg.COUNTRY === 'US' ? '$' : '';
        const suffix = cfg.COUNTRY === 'KR' ? '원' : '';
        logoInput.placeholder = `PNG로고 등록시 ${unit}${rewardDisplay}${suffix} 즉시 지급 MY page에서 확인`;
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
        showToast(window.t('msg_login_required'), "warn");
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
        title.innerText = '📤 ' + window.t('contrib_upload_svg', 'SVG Vector Upload');
        svgArea.style.display = 'flex';
        simpleArea.style.display = 'none';
    } else if (type === 'logo') {
        title.innerText = '📤 ' + window.t('contrib_upload_logo', 'Logo Upload');
        svgArea.style.display = 'none';
        simpleArea.style.display = 'block';
    } else {
        title.innerText = '📤 ' + window.t('contrib_upload_png', 'PNG Object Upload');
        svgArea.style.display = 'none';
        simpleArea.style.display = 'block';
    }

    modal.style.display = 'flex';
};

// 4. 업로드 실행
window.submitContributorUpload = async function() {
    // 1. 입력값 가져오기
    let tagsInput = document.getElementById('cUploadTags').value.trim();
    const loading = document.getElementById('loading');
    
    if (!tagsInput) { showToast(window.t('msg_input_search_keyword'), "warn"); return; }
    
    if(loading) loading.style.display = 'flex';

    // ★ [추가됨] 자동 번역 로직 (한글 -> 영어, 일본어)
    try {
        if(loading.querySelector('p')) loading.querySelector('p').innerText = "키워드 번역 중...";

        // ★ [수정] 한/영/일 3개 국어 모두 번역 요청 (입력 언어가 무엇이든 상관없음)
        const [koText, enText, jpText] = await Promise.all([
            googleTranslate(tagsInput, 'ko'), // 한국어 변환 추가
            googleTranslate(tagsInput, 'en'),
            googleTranslate(tagsInput, 'ja')
        ]);

        // 콤마(,)로 분리하여 배열로 만듦
        const originalTags = tagsInput.split(',').map(t => t.trim());
        const koTags = koText ? koText.split(',').map(t => t.trim()) : [];
        const enTags = enText ? enText.split(',').map(t => t.trim()) : [];
        const jpTags = jpText ? jpText.split(',').map(t => t.trim()) : [];

        // 원본 + 한/영/일 합치기 (Set이 알아서 중복 제거함)
        const combinedSet = new Set([
            ...originalTags, 
            ...koTags, 
            ...enTags, 
            ...jpTags
        ]);
        
        // 최종 태그 문자열 (예: "사과, Apple, Ringo")
        // tags 변수는 const가 아닌 let으로 선언하거나, 아래 로직에서 바로 사용
        tagsInput = Array.from(combinedSet).join(', ');
        
        console.log("최종 저장 태그:", tagsInput);

    } catch (e) {
        console.warn("번역 실패, 원본만 저장합니다.", e);
    }
    
    // 변수명 통일 (기존 로직과 연결)
    const tags = tagsInput; 

    try {
        let uploadCount = 0;
        let totalReward = 0;
        // ... (이하 기존 코드 그대로 유지)

        if (currentUploadType === 'svg') {
            const thumbFile = document.getElementById('cFileThumb').files[0];
            const svgFile = document.getElementById('cFileSvg').files[0];

            if (!thumbFile || !svgFile) {
                if(loading) loading.style.display = 'none';
                showToast(window.t('msg_select_thumb_svg'), "warn"); return;
            }

            await processSingleUpload(thumbFile, svgFile, tags, 'vector'); 
            uploadCount = 1;

        } else {
            const files = document.getElementById('cFileSimple').files;
            if (files.length === 0) {
                if(loading) loading.style.display = 'none';
                showToast(window.t('msg_select_file'), "warn"); return;
            }

            const category = currentUploadType === 'logo' ? 'logo' : 'graphic';

            for (const file of files) {
                // 1. 파일 해시 계산
                const fileHash = await calculateFileHash(file);

                // 2. DB 중복 체크 (내 보관함에 같은 파일이 있는지)
                const { data: duplicate } = await sb.from('library')
                    .select('id')
                    .eq('file_hash', fileHash)
                    .eq('user_id', window.currentUser.id) // 내 파일 중에서만 체크 (전체에서 체크하려면 이 줄 삭제)
                    .maybeSingle();

                if (duplicate) {
                    showToast(window.t('msg_file_already_uploaded').replace('{name}', file.name), "warn");
                    continue; // 업로드 건너뛰기
                }

                // 3. 중복이 아니면 업로드 진행 (해시값 전달)
                await processSingleUpload(file, null, tags, category, fileHash);
                uploadCount++;
            }
        }

        // [수정] 보상금 계산 로직 (패널티 적용)
        let baseAmount = REWARD_RATES[currentUploadType] || 100;
        
        // ★ 패널티 등급 확인 (currentUserTier 변수 사용)
        if (currentUserTier === 'penalty') {
            baseAmount = 50;       // 기본금을 50원으로 강제 변경
            currentMultiplier = 1; // 배율도 1배로 고정 (혹시 모를 보너스 방지)
        }

        const finalAmount = (baseAmount * currentMultiplier) * uploadCount;
        
        await addReward(finalAmount, `${currentUploadType.toUpperCase()} 업로드 보상 (${uploadCount}개)`);

        showToast(window.t('msg_upload_complete_points').replace('{amount}', fmtMoney(finalAmount)), "success");
        document.getElementById('contributorUploadModal').style.display = 'none';
        
        window.initContributorSystem();
        if(window.searchTemplates) window.searchTemplates('');

    } catch (e) {
        console.error(e);
        showToast(window.t('msg_upload_failed') + e.message, "error");
    } finally {
        if(loading) loading.style.display = 'none';
    }
};

// 5. 단일 파일 업로드 (리사이징 제거 & 1MB 용량 제한 적용)
async function processSingleUpload(file1, file2, userTags, category, fileHash = null) {
    // [1] 용량 체크 (1MB = 1024 * 1024 bytes)
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file1.size > MAX_SIZE) {
        showToast(window.t('msg_image_too_large').replace('{size}', (file1.size/1024/1024).toFixed(1)), "warn");
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
        contributor_type: currentUploadType,
        file_hash: fileHash // [추가] 해시값 저장
    });

    if (dbErr) throw dbErr;
}

window.openTemplateCreator = function() {
    if (!window.currentUser) { showToast(window.t('msg_login_required'), "warn"); return; }
    if(confirm(window.t('confirm_go_editor'))) window.startEditorDirect('custom');
};

// [수정] 디자인 판매 등록 (관리자 전용)
window.openSellModal = async function() {
    // 1. 로그인 체크
    if (!window.currentUser) {
        showToast(window.t('msg_login_required'), "warn");
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }

    try {
        // 2. 관리자 권한 체크 (DB 조회)
        const { data: profile, error } = await sb.from('profiles')
            .select('role')
            .eq('id', window.currentUser.id)
            .single();

        if (error) throw error;

        // role이 admin이 아니면 차단
        if (!profile || profile.role !== 'admin') {
            showToast(window.t('msg_admin_only_sell'), "warn");
            return;
        }

        // 3. 관리자라면 모달 열기
        document.getElementById('sellModal').style.display = 'flex';
        
    } catch (e) {
        console.error("권한 확인 오류:", e);
        showToast(window.t('msg_no_permission'), "error");
    }
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

    if(!name || !phone) { showToast(window.t('alert_vip_info_needed'), "warn"); return; }
    if(fileInput.files.length === 0) { showToast(window.t('alert_vip_file_needed'), "warn"); return; }

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

        showToast(window.t('msg_vip_order_success').replace('{manager}', managerName), "success");
        document.getElementById('vipOrderModal').style.display = 'none';
        
        // 입력창 초기화
        document.getElementById('vipName').value = '';
        document.getElementById('vipPhone').value = '';
        document.getElementById('vipMemo').value = '';
        document.getElementById('vipFileInput').value = '';
        document.getElementById('vipFileList').innerHTML = '';

    } catch (e) {
        console.error(e);
        showToast(window.t('msg_submit_error') + e.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// [신규] 메인 페이지 유저 정보(등급/수익금) UI 갱신 함수
window.updateMainPageUserInfo = async function() {
    if (!sb) { console.warn("[updateMainPageUserInfo] sb가 아직 초기화되지 않음"); return; }
    // 1. 로그인 정보 확인
    const { data: { user } } = await sb.auth.getUser();
    if(!user) return;

    // 2. 프로필 정보 가져오기 (role, deposit 확인)
    const { data: profile } = await sb.from('profiles')
        .select('role, deposit, contributor_tier')
        .eq('id', user.id)
        .single();

    if (profile) {
        // (1) 등급 뱃지 표시 ('platinum' -> 'PARTNERS')
        const badgeEl = document.getElementById('myTierBadge');
        if (badgeEl) {
            let role = profile.role || 'customer';
            
            if (role === 'platinum') {
                badgeEl.innerText = 'PARTNERS'; // 파트너스 표시
                badgeEl.style.backgroundColor = '#e0e7ff';
                badgeEl.style.color = '#4338ca';
                badgeEl.style.fontWeight = '800';
            } else if (role === 'franchise') {
                badgeEl.innerText = 'PARTNER (가맹)';
                badgeEl.style.backgroundColor = '#f3e8ff';
                badgeEl.style.color = '#7e22ce';
            } else if (role === 'gold') {
                badgeEl.innerText = 'GOLD';
                badgeEl.style.backgroundColor = '#fef9c3';
                badgeEl.style.color = '#ca8a04';
            } else {
                // 그 외(일반)는 기여자 등급(Hero/Excellent) 등을 보여주거나 기본값
                // initContributorSystem에서 처리한 내용을 유지하거나 여기서 덮어씌움
                if(badgeEl.innerText === 'Loading...') badgeEl.innerText = 'USER';
            }
        }

        // (2) 수익금(예치금 deposit) 표시
        const balanceEl = document.getElementById('contributorBalance');
        if (balanceEl) {
            balanceEl.innerText = fmtMoney(profile.deposit || 0);
        }
    }
};
// [신규] 파일의 고유 해시값(SHA-256) 계산 함수
async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// ============================================================
// [신규] 파트너(가맹점) 신청 제출 함수
// ============================================================
window.submitRealPartnerApp = async function() {
    // 1. 로그인 체크
    if (!currentUser) {
        showToast(window.t('msg_login_required'), "warn");
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }

    // 2. 입력값 가져오기
    const comp = document.getElementById('applyCompName').value;
    const phone = document.getElementById('applyPhone').value;
    const region = document.getElementById('applyRegion').value;
    const items = document.getElementById('applyMainItems').value;

    // 3. 유효성 검사
    if(!comp || !phone || !region) { showToast(window.t('msg_partner_fields_required'), "warn"); return; }

    // 4. DB 전송
    try {
        const { error } = await sb.from('partner_applications').insert({
            user_id: currentUser.id,
            email: currentUser.email, // 유저 이메일 저장
            company_name: comp,
            contact_phone: phone,
            region: region,
            main_items: items,
            status: 'pending' // 대기 상태로 저장
        });

        if (error) throw error;

        showToast(window.t('msg_partner_applied'), "success");
        document.getElementById('partnerApplyModal').style.display = 'none';
        
        // 입력창 초기화
        document.getElementById('applyCompName').value = '';
        document.getElementById('applyPhone').value = '';
        document.getElementById('applyRegion').value = '';
        document.getElementById('applyMainItems').value = '';

    } catch (e) {
        console.error(e);
        showToast(window.t('msg_apply_error') + e.message, "error");
    }
};

// 신청 철회(취소) 함수
window.cancelPartnerApp = function() {
    if(confirm(window.t('confirm_cancel_form'))) {
        document.getElementById('partnerApplyModal').style.display = 'none';
    }
};
// [공통] 구글 무료 번역 함수 (global_products.js에서 가져옴)
async function googleTranslate(text, targetLang) {
    if (!text) return "";
    try {
        // client=gtx 방식을 사용하여 무료로 번역
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURI(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        // 번역된 문장들을 합쳐서 반환
        return data[0].map(x => x[0]).join('');
    } catch (e) {
        console.error("번역 API 오류:", e);
        return ""; // 오류 시 빈 문자열 반환
    }
}

// ========== Quote Request (no login required) ==========
window.submitQuoteRequest = async function() {
    const name = document.getElementById('quoteName').value.trim();
    const email = document.getElementById('quoteEmail').value.trim();
    const phone = document.getElementById('quotePhone').value.trim();
    const detail = document.getElementById('quoteDetail').value.trim();
    const fileInput = document.getElementById('quoteFileInput');

    if (!email || !detail) {
        showToast(window.t('quote_alert_required') || 'Please fill in email and details.', 'warn');
        return;
    }

    const btn = document.querySelector('#quoteModal .btn-round.primary');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    btn.disabled = true;

    try {
        const uploadedFiles = [];
        if (fileInput && fileInput.files.length > 0) {
            const ts = Date.now();
            const rnd = Math.random().toString(36).substring(2, 8);
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const ext = file.name.split('.').pop();
                const safeName = `QUOTE_${ts}_${rnd}_${i}.${ext}`;
                const path = `vip_uploads/${safeName}`;
                const { error: upErr } = await sb.storage.from('orders').upload(path, file);
                if (!upErr) {
                    const { data: pub } = sb.storage.from('orders').getPublicUrl(path);
                    uploadedFiles.push({ name: file.name, url: pub.publicUrl });
                }
            }
        }

        const country = window.SITE_CONFIG?.COUNTRY || 'KR';
        const domain = location.hostname;
        await sb.from('vip_orders').insert({
            customer_name: name || 'Quote Request',
            customer_phone: phone || email,
            preferred_manager: 'Quote-' + country,
            memo: `[QUOTE REQUEST from ${domain}]\nEmail: ${email}\nPhone: ${phone}\n\n${detail}`,
            files: uploadedFiles.length > 0 ? uploadedFiles : null,
            status: 'quote'
        });

        showToast(window.t('quote_success') || 'Quote request sent! We will reply within 24 hours.', 'success');
        document.getElementById('quoteModal').style.display = 'none';
        document.getElementById('quoteName').value = '';
        document.getElementById('quoteEmail').value = '';
        document.getElementById('quotePhone').value = '';
        document.getElementById('quoteDetail').value = '';
        document.getElementById('quoteFileList').innerHTML = '';
        if (fileInput) fileInput.value = '';
    } catch (e) {
        console.error('Quote submit error:', e);
        showToast(window.t('quote_error') || 'Failed to send. Please contact us via live chat.', 'warn');
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};