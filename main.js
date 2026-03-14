// main.js - Complete Integrated Version

import { initConfig, sb, currentUser, PRODUCT_DB } from "./config.js?v=186";
import { initCanvas, canvas } from "./canvas-core.js?v=186";
import { initSizeControls, applySize } from "./canvas-size.js?v=186";
import { initGuides } from "./canvas-guides.js?v=186";
import { initZoomPan } from "./canvas-zoom-pan.js?v=186";
import { initObjectTools } from "./canvas-objects.js?v=186";
import { initPageTools } from "./canvas-pages.js?v=186"; // [추가] 페이지 도구
import { initImageTools } from "./canvas-image.js?v=186";
import { initTemplateTools, loadProductFixedTemplate } from "./canvas-template.js?v=186";
import { initAiTools } from "./canvas-ai.js?v=186";
import { initExport } from "./export.js?v=186";
import { initOrderSystem } from "./order.js?v=186";
import { initAuth } from "./login.js?v=186";
import { initMyDesign } from "./my-design.js?v=186";
import { initCanvasUtils } from "./canvas-utils.js?v=186";
import { initShortcuts } from "./shortcuts.js?v=186";
import { initContextMenu } from "./context-menu.js?v=186";
import { createVectorOutline } from "./outlineMaker.js?v=186";
import { initVideoMaker } from "./video-maker.js?v=186";
import { initPptMode } from "./ppt-mode.js?v=186";
import { initGreetingCardMode } from "./greeting-card-mode.js?v=186";
import { initIconTools } from "./canvas-icons.js?v=186";
import { initRetouchTools } from "./canvas-retouch.js?v=186";

window.currentUploadedPdfUrl = null;

// KRW → 현지 통화 표시 헬퍼
function fmtMoney(krw) {
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const rate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[country]) || 1;
    const converted = (krw || 0) * rate;
    if (country === 'JP') return '¥' + Math.floor(converted).toLocaleString();
    if (country === 'US') return '$' + (converted < 1 ? converted.toFixed(2) : Math.round(converted).toLocaleString());
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

        // 1. 필수 설정 (Supabase, 인증, 상품 데이터)
        window.loadProductFixedTemplate = loadProductFixedTemplate;
        await initConfig(); // DB 연결 및 PRODUCT_DB 로드 대기
        if (sb) window.sb = sb; // ★ 전역 참조 갱신

        // 1-1. Fabric.js 없이 동작하는 필수 초기화
        try { initAuth(); } catch(e) { console.warn('⚠️ Auth init failed:', e); }
        try { initOrderSystem(); } catch(e) { console.warn('⚠️ OrderSystem init failed:', e); }

        // 1-2. 마이페이지 버튼 연결
        const btnMyPage = document.getElementById("btnMyLibrary");
        if (btnMyPage) {
            btnMyPage.onclick = () => {
                if (!currentUser) { showToast(window.t('msg_login_required', "Login is required."), "warn"); return; }
                location.href = 'mypage.html';
            };
        }

        // 1-3. 파트너스 초기화 (로그인 상태일 때만)
        if (currentUser) {
            await checkPartnerStatus().catch(e => console.warn('⚠️ Partner check failed:', e));
        }

        // 2. ★ 에디터 초기화 (Fabric.js 필요) — 라이브러리 로드 후 실행
        function runEditorInits() {
            initCanvas();
            const editorInits = [
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
                ['RetouchTools', initRetouchTools],
                ['IconTools', initIconTools],
                ['Export', initExport],
                ['MyDesign', initMyDesign],
                ['MobileTextEditor', initMobileTextEditor],
                ['PcTextQuickBar', initPcTextQuickBar],
                ['OutlineTool', initOutlineTool],
                ['FileUpload', initFileUploadListeners],
                ['PptMode', initPptMode],
                ['GreetingCardMode', initGreetingCardMode],
            ];
            for (const [name, fn] of editorInits) {
                try { fn(); } catch(e) { console.warn(`⚠️ ${name} init failed:`, e); }
            }
            initVideoMaker();
            // 폰트 로드
            if(window.preloadLanguageFont) window.preloadLanguageFont();
            console.log("🚀 에디터 모듈 초기화 완료");
        }

        if (typeof fabric !== 'undefined') {
            // Fabric.js가 이미 로드됨 (캐시/빠른 네트워크)
            runEditorInits();
        } else {
            // Fabric.js 미로드 → startEditorDirect()에서 로드 후 실행
            window._pendingEditorInits = runEditorInits;
            console.log("⏳ 에디터 라이브러리 대기 (에디터 진입 시 로드)");
        }

        // =========================================================
        // ★ 마이페이지 연동 로직 (편집/재주문 복구)
        // =========================================================
        let loadId = null; try { loadId = localStorage.getItem('load_design_id'); } catch(e) {}
        let cartFlag = null; try { cartFlag = localStorage.getItem('open_cart_on_load'); } catch(e) {}

        // [CASE A] 디자인 편집으로 들어온 경우
        if (loadId) {
            try { localStorage.removeItem('load_design_id'); } catch(e) {}

            // ★ 에디터 라이브러리 동적 로드 (마이페이지→편집 복구)
            if (!window._editorLibsLoaded && window.loadEditorLibraries) {
                await window.loadEditorLibraries();
                if (window._pendingEditorInits) { window._pendingEditorInits(); delete window._pendingEditorInits; }
            }

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
                        if(limitLabel) {
                            const _wMm = p.w_mm || 210, _hMm = p.h_mm || 297;
                            if (window._isUSsite && window._isUSsite()) {
                                limitLabel.innerText = `Max: ${(_wMm/25.4).toFixed(2)} x ${(_hMm/25.4).toFixed(2)} in`;
                            } else {
                                limitLabel.innerText = `Max: ${_wMm} x ${_hMm} mm`;
                            }
                        }
                        const inpW = document.getElementById("inputUserW");
                        const inpH = document.getElementById("inputUserH");
                        if(inpW) inpW.value = (window._isUSsite && window._isUSsite()) ? ((p.w_mm || 210)/25.4).toFixed(2) : (p.w_mm || 210);
                        if(inpH) inpH.value = (window._isUSsite && window._isUSsite()) ? ((p.h_mm || 297)/25.4).toFixed(2) : (p.h_mm || 297);
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
        } else if (window._pendingEditorRestore) {
            // ★ 소셜 로그인 리다이렉트 후 에디터 자동 진입
            const _act = window._pendingEditorRestore;
            window._pendingEditorRestore = null;
            if(loading) loading.style.display = 'none';
            setTimeout(() => {
                if (window.startEditorDirect) {
                    window.startEditorDirect(_act.key, _act.customW, _act.customH, _act.customPrice);
                }
            }, 500);
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

    // ── 정렬 버튼 ──
    function updateAlignUI(align) {
        document.querySelectorAll('.m-align-btn').forEach(b => b.classList.remove('m-align-active'));
        const map = { left: 'btnAlignL', center: 'btnAlignC', right: 'btnAlignR' };
        const el = document.getElementById(map[align]);
        if (el) el.classList.add('m-align-active');
    }
    window.alignMobileText = function(align) {
        if (activeTextObj) {
            activeTextObj.set('textAlign', align);
            window.canvas.requestRenderAll();
        }
        updateAlignUI(align);
    };

    // ── 색상 동그라미 ──
    function updateColorUI(color) {
        document.querySelectorAll('.m-color-dot').forEach(d => {
            d.classList.toggle('m-color-active', d.dataset.color === color);
        });
    }
    window.setMobileTextColor = function(color) {
        if (activeTextObj) {
            activeTextObj.set('fill', color);
            window.canvas.requestRenderAll();
        }
        updateColorUI(color);
    };

    // 선택 시 현재 정렬/색상 상태 반영
    function syncEditorUI(obj) {
        updateAlignUI(obj.textAlign || 'left');
        const fill = obj.fill || '#000000';
        updateColorUI(fill.toUpperCase());
    }

    // handleSelection 확장 — 기존 로직 후 UI 동기화
    const origHandleSelection = handleSelection;
    handleSelection = function(e) {
        origHandleSelection(e);
        if (activeTextObj) syncEditorUI(activeTextObj);
    };
    window.canvas.off('selection:created', origHandleSelection);
    window.canvas.off('selection:updated', origHandleSelection);
    window.canvas.on('selection:created', handleSelection);
    window.canvas.on('selection:updated', handleSelection);
}

// ============================================================
// [PC 텍스트 퀵 툴바] — 텍스트 선택 시 캔버스 위에 플로팅 표시
// ============================================================
function initPcTextQuickBar() {
    const bar = document.getElementById('pcTextQuickBar');
    if (!bar || !window.canvas) return;
    let activeObj = null;

    function showBar(obj) {
        if (window.innerWidth <= 768) return; // 모바일은 기존 에디터 사용
        activeObj = obj;
        bar.style.display = 'flex';
        positionBar(obj);
        syncBarUI(obj);
    }

    function hideBar() {
        bar.style.display = 'none';
        activeObj = null;
    }

    function positionBar(obj) {
        const canvasEl = document.querySelector('.canvas-container') || document.getElementById('designCanvas');
        if (!canvasEl) return;
        const canvasRect = canvasEl.getBoundingClientRect();
        const zoom = window.canvas.getZoom();
        const vp = window.canvas.viewportTransform;
        // 오브젝트의 화면 좌표 계산
        const objLeft = obj.left * zoom + vp[4];
        const objTop = obj.top * zoom + vp[5];
        const objWidth = (obj.width * (obj.scaleX || 1)) * zoom;
        // 바를 오브젝트 위에 배치
        const barX = canvasRect.left + objLeft + objWidth / 2;
        const barY = canvasRect.top + objTop - 50;
        bar.style.left = Math.max(10, barX - bar.offsetWidth / 2) + 'px';
        bar.style.top = Math.max(10, barY) + 'px';
    }

    function syncBarUI(obj) {
        // 정렬 상태
        document.querySelectorAll('.pc-tq-align').forEach(b => {
            b.style.background = b.dataset.align === (obj.textAlign || 'left') ? '#6366f1' : '#f1f5f9';
            b.style.color = b.dataset.align === (obj.textAlign || 'left') ? '#fff' : '#334155';
        });
        // 색상 상태
        const fill = (obj.fill || '#000000').toUpperCase();
        document.querySelectorAll('.pc-tq-color').forEach(d => {
            d.style.outline = d.dataset.color === fill ? '2px solid #6366f1' : 'none';
            d.style.outlineOffset = '2px';
        });
    }

    function handleSel(e) {
        const obj = e.selected ? e.selected[0] : window.canvas.getActiveObject();
        if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text')) {
            showBar(obj);
        } else {
            hideBar();
        }
    }

    window.canvas.on('selection:created', handleSel);
    window.canvas.on('selection:updated', handleSel);
    window.canvas.on('selection:cleared', hideBar);
    window.canvas.on('object:moving', function() { if (activeObj) positionBar(activeObj); });
    window.canvas.on('object:modified', function() { if (activeObj) positionBar(activeObj); });

    window.pcTextAlign = function(align) {
        if (!activeObj) return;
        activeObj.set('textAlign', align);
        window.canvas.requestRenderAll();
        syncBarUI(activeObj);
    };

    window.pcTextColor = function(color) {
        if (!activeObj) return;
        activeObj.set('fill', color);
        window.canvas.requestRenderAll();
        syncBarUI(activeObj);
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
        if (btnApply) btnApply.style.display = 'none';
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
            // [권한 없음] 입장 버튼 숨기기
            if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
            if (btnApply) btnApply.style.display = 'none';
        }
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
// [작품 마켓플레이스] 고객 작품 판매 시스템
// ============================================================

const ART_REVENUE_RATE = 0.10;

function _artFmtPrice(krw) {
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const rate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[country]) || 1;
    const v = krw * rate;
    if (country === 'JP') return '¥' + Math.floor(v).toLocaleString();
    if (country === 'US') return '$' + (v < 1 ? v.toFixed(2) : v.toFixed(0));
    if (country === 'CN') return '¥' + Math.round(v).toLocaleString();
    if (country === 'ES' || country === 'DE' || country === 'FR') return '€' + v.toFixed(2);
    return v.toLocaleString() + '원';
}

window.openArtworkUpload = function() {
    if (!window.currentUser) {
        showToast(window.t?.('msg_login_required', '로그인이 필요합니다') || '로그인이 필요합니다', 'warn');
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }
    document.getElementById('artworkFileInput').value = '';
    document.getElementById('artworkTitle').value = '';
    document.getElementById('artworkGenre').value = '';
    document.getElementById('artworkPreviewArea').style.display = 'none';

    // 장르 버튼 동적 생성 (다국어 지원)
    const lang = window.CURRENT_LANG || 'kr';
    const btnBox = document.getElementById('artworkGenreButtons');
    if (btnBox && UA_GENRE_CATS) {
        btnBox.innerHTML = '';
        UA_GENRE_CATS.forEach(g => {
            const gName = lang==='ja' ? g.name_jp : lang==='en' ? g.name_us : lang==='zh' ? g.name_cn : lang==='es' ? g.name_es : lang==='de' ? g.name_de : lang==='fr' ? g.name_fr : g.name;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'artwork-genre-btn';
            btn.dataset.genre = g.code;
            btn.style.cssText = 'padding:8px 16px; border:2px solid #e2e8f0; border-radius:10px; background:#fff; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.15s;';
            btn.textContent = g.icon + ' ' + gName;
            btn.onclick = function() { window._selectArtworkGenre(this); };
            btnBox.appendChild(btn);
        });
    }

    document.getElementById('artworkUploadModal').style.display = 'flex';
};

window._selectArtworkGenre = function(btn) {
    document.querySelectorAll('.artwork-genre-btn').forEach(b => { b.style.borderColor = '#e2e8f0'; b.style.background = '#fff'; b.style.color = '#333'; });
    btn.style.borderColor = '#6366f1';
    btn.style.background = '#eef2ff';
    btn.style.color = '#4f46e5';
    document.getElementById('artworkGenre').value = btn.dataset.genre;
};

window._artworkPreview = function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            document.getElementById('artworkPreviewImg').src = e.target.result;
            document.getElementById('artworkPreviewArea').style.display = 'block';
            document.getElementById('artworkDimInfo').textContent = `${img.width} × ${img.height} px`;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.submitArtworkUpload = async function() {
    if (!window.currentUser) { showToast(window.t?.('msg_login_required') || '로그인 필요', 'warn'); return; }

    const file = document.getElementById('artworkFileInput').files[0];
    const title = document.getElementById('artworkTitle').value.trim();
    const genre = document.getElementById('artworkGenre').value;
    if (!file) { showToast(window.t?.('artwork_no_file', '이미지를 선택하세요') || '이미지를 선택하세요', 'warn'); return; }
    if (!genre) { showToast('카테고리를 선택해주세요', 'warn'); return; }
    if (!title) { showToast(window.t?.('artwork_no_title', '작품명을 입력하세요') || '작품명을 입력하세요', 'warn'); return; }

    const loading = document.getElementById('loading');
    if (loading) { loading.style.display = 'flex'; const p = loading.querySelector('p'); if (p) p.innerText = '작품 등록 중...'; }

    try {
        let tags = title;
        let titleEN = title, titleJP = title, titleCN = title, titleAR = title, titleES = title, titleDE = title, titleFR = title;
        try {
            const [koT, enT, jaT, zhT, arT, esT, deT, frT] = await Promise.all([
                googleTranslate(title, 'ko'), googleTranslate(title, 'en'), googleTranslate(title, 'ja'),
                googleTranslate(title, 'zh'), googleTranslate(title, 'ar'), googleTranslate(title, 'es'),
                googleTranslate(title, 'de'), googleTranslate(title, 'fr')
            ]);
            titleEN = enT || title;
            titleJP = jaT || title;
            titleCN = zhT || title;
            titleAR = arT || title;
            titleES = esT || title;
            titleDE = deT || title;
            titleFR = frT || title;
            const combined = new Set([
                ...title.split(',').map(s=>s.trim()),
                ...(koT||'').split(',').map(s=>s.trim()),
                ...(enT||'').split(',').map(s=>s.trim()),
                ...(jaT||'').split(',').map(s=>s.trim()),
                ...(zhT||'').split(',').map(s=>s.trim()),
                ...(esT||'').split(',').map(s=>s.trim())
            ]);
            tags = Array.from(combined).filter(Boolean).join(', ');
        } catch(e) { console.warn('번역 실패, 원본만 사용', e); }

        const ts = Date.now();
        const ext = file.name.split('.').pop();
        const safeName = `${ts}_${Math.random().toString(36).substring(2,10)}.${ext}`;
        const path = `user_artwork/${window.currentUser.id}_${safeName}`;
        const { error: upErr } = await sb.storage.from('design').upload(path, file);
        if (upErr) throw upErr;
        const { data: pubData } = sb.storage.from('design').getPublicUrl(path);
        const imgUrl = pubData.publicUrl;

        // 패브릭 옵션 (제품 타입에 패브릭이 포함되므로 항상 가져옴)
        let fabricAddons = '';
        try {
            const { data: addonRows } = await sb.from('admin_addons').select('code').in('category_code', ['2342434', '23442423']);
            if (addonRows && addonRows.length > 0) {
                fabricAddons = addonRows.map(r => r.code).join(',');
            }
        } catch(e) { console.warn('패브릭 옵션 조회 실패', e); }

        // ★ 1개의 상품만 생성 (장르 카테고리, 기본 단가 = 패브릭 15000 KRW/m²)
        const productCode = `ua_${window.currentUser.id.substring(0,8)}_${ts}`;
        const basePrice = 15000; // 기본 단가 (패브릭 기준, 제품타입별 가격은 주문 시 선택)
        const { error: insErr } = await sb.from('admin_products').insert({
            code: productCode,
            name: title,
            name_us: titleEN,
            name_jp: titleJP,
            name_cn: titleCN,
            name_ar: titleAR,
            name_es: titleES,
            name_de: titleDE,
            name_fr: titleFR,
            category: genre,
            price: basePrice,
            price_us: Math.round(basePrice * 0.001),
            img_url: imgUrl,
            addons: fabricAddons,
            description: tags,
            partner_id: window.currentUser.id,
            partner_status: 'approved',
            is_custom_size: true,
            sort_order: 999
        });
        if (insErr) throw insErr;

        showToast(window.t?.('artwork_success', '작품이 마켓플레이스에 등록되었습니다!') || '작품이 마켓플레이스에 등록되었습니다!', 'success');
        document.getElementById('artworkUploadModal').style.display = 'none';

        // ★ 등록 후 장르 그리드 즉시 새로고침
        if (typeof window._loadArtworkGenreGrid === 'function') window._loadArtworkGenreGrid();

    } catch(e) {
        console.error('작품 등록 실패:', e);
        showToast((window.t?.('artwork_fail', '등록 실패: ') || '등록 실패: ') + e.message, 'error');
    } finally {
        if (loading) loading.style.display = 'none';
    }
};

// ★ 작품 마켓플레이스 장르 카테고리 (제품타입 → 장르 기반으로 변경)
const UA_GENRE_CATS = [
    { code: 'ua_game', name: '게임', name_us: 'Game', name_jp: 'ゲーム', name_cn: '游戏', name_ar: 'ألعاب', name_es: 'Juegos', name_de: 'Spiele', name_fr: 'Jeux', top_category_code: 'user_artwork', icon: '🎮', sort_order: 1 },
    { code: 'ua_anime', name: '애니메이션', name_us: 'Animation', name_jp: 'アニメ', name_cn: '动漫', name_ar: 'أنمي', name_es: 'Animación', name_de: 'Animation', name_fr: 'Animation', top_category_code: 'user_artwork', icon: '🎬', sort_order: 2 },
    { code: 'ua_landscape', name: '풍경', name_us: 'Landscape', name_jp: '風景', name_cn: '风景', name_ar: 'مناظر طبيعية', name_es: 'Paisaje', name_de: 'Landschaft', name_fr: 'Paysage', top_category_code: 'user_artwork', icon: '🏞️', sort_order: 3 },
    { code: 'ua_interior', name: '인테리어', name_us: 'Interior', name_jp: 'インテリア', name_cn: '室内', name_ar: 'ديكور', name_es: 'Interior', name_de: 'Interieur', name_fr: 'Intérieur', top_category_code: 'user_artwork', icon: '🏠', sort_order: 4 },
    { code: 'ua_fengshui', name: '풍수그림', name_us: 'Feng Shui Art', name_jp: '風水画', name_cn: '风水画', name_ar: 'فنغ شوي', name_es: 'Feng Shui', name_de: 'Feng Shui', name_fr: 'Feng Shui', top_category_code: 'user_artwork', icon: '🐉', sort_order: 5 },
    { code: 'ua_personal', name: '개인작품', name_us: 'Personal Art', name_jp: '個人作品', name_cn: '个人作品', name_ar: 'أعمال شخصية', name_es: 'Arte Personal', name_de: 'Persönliche Kunst', name_fr: 'Art Personnel', top_category_code: 'user_artwork', icon: '✨', sort_order: 6 }
];

// ★ 작품 제품 타입별 단가
// area-based: KRW per m² (패브릭/캔버스/종이/아크릴/블라인드)
// fixed: 고정가 (머그컵/티셔츠/스티커)
const UA_PRODUCT_TYPES = {
    fabric:  { name: '패브릭인쇄', name_us: 'Fabric Print', name_jp: 'ファブリック印刷', icon: '🎨', price_krw: 15000 },
    canvas:  { name: '캔버스액자', name_us: 'Canvas Frame', name_jp: 'キャンバスフレーム', icon: '🖼️', price_krw: 100000 },
    paper:   { name: '종이포스터', name_us: 'Paper Poster', name_jp: '紙ポスター', icon: '📄', price_krw: 10000, maxW: 297, maxH: 420 },
    acrylic: { name: '아크릴액자', name_us: 'Acrylic Frame', name_jp: 'アクリルフレーム', icon: '💎', price_krw: 400000 },
    blind:   { name: '롤블라인드', name_us: 'Roll Blind', name_jp: 'ロールブラインド', icon: '🪟', price_krw: 40000, hasBlindOption: true },
    mug:     { name: '머그컵', name_us: 'Mug Cup', name_jp: 'マグカップ', icon: '☕', price_krw: 5000, fixed: true },
    tshirt:  { name: '티셔츠인쇄', name_us: 'T-shirt Print', name_jp: 'Tシャツ印刷', icon: '👕', price_krw: 10000, fixed: true },
    sticker: { name: '스티커', name_us: 'Stickers', name_jp: 'ステッカー', icon: '🏷️', price_krw: 50000, fixed: true, desc: '7~10cm 1,000매', desc_us: '7-10cm ×1,000', desc_jp: '7-10cm 1,000枚' }
};
window.UA_PRODUCT_TYPES = UA_PRODUCT_TYPES;
window.UA_GENRE_CATS = UA_GENRE_CATS;

window._setupArtworkCategories = async function() {
    if (!sb) return;
    const { data: existing } = await sb.from('admin_top_categories').select('code').eq('code', 'user_artwork');
    if (!existing || existing.length === 0) {
        await sb.from('admin_top_categories').insert({
            code: 'user_artwork', name: '고객작품판매', name_us: 'Artwork Shop', name_jp: '作品販売',
            name_cn: '作品商店', name_ar: 'متجر الأعمال', name_es: 'Tienda de Arte', name_de: 'Kunstshop', name_fr: 'Boutique Art',
            icon: 'fa-solid fa-paintbrush', sort_order: 50
        });
    }
    // 장르 카테고리 생성
    for (const s of UA_GENRE_CATS) {
        const { data: ex } = await sb.from('admin_categories').select('code').eq('code', s.code);
        if (!ex || ex.length === 0) await sb.from('admin_categories').insert(s);
    }
    console.log('작품 마켓플레이스 장르 카테고리 설정 완료');
};

// ★ 메인 페이지: 카테고리별 최신 1개씩 세로 카드
window._loadArtworkGenreGrid = async function() {
    if (!sb) return;
    const tabBox = document.getElementById('artworkGenreTabs');
    const grid = document.getElementById('artworkGenreGrid');
    if (!tabBox || !grid) return;
    tabBox.style.display = 'none'; // 탭 숨김 (카테고리 카드로 대체)

    const lang = window.CURRENT_LANG || 'kr';
    const genres = UA_GENRE_CATS;

    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    try {
        // 각 장르별 최신 1개씩 가져오기
        const promises = genres.map(g =>
            sb.from('admin_products')
                .select('code, name, name_jp, name_us, img_url')
                .eq('category', g.code)
                .eq('partner_status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1)
        );
        const results = await Promise.all(promises);

        grid.innerHTML = '';
        genres.forEach((g, i) => {
            const items = results[i].data;
            const gName = lang==='ja' ? g.name_jp : lang==='en' ? g.name_us : lang==='zh' ? g.name_cn : lang==='es' ? g.name_es : lang==='de' ? g.name_de : lang==='fr' ? g.name_fr : g.name;
            const p = items && items[0];
            const thumbUrl = p ? (window.getTinyThumb ? window.getTinyThumb(p.img_url, 240) : p.img_url) : '';

            const div = document.createElement('div');
            div.style.cssText = 'cursor:pointer; border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); transition:transform 0.2s;';
            div.onmouseenter = () => { div.style.transform = 'scale(1.03)'; };
            div.onmouseleave = () => { div.style.transform = 'scale(1)'; };
            div.innerHTML = `
                <div style="width:100%; aspect-ratio:2/3; background:#1e1b4b; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    ${thumbUrl
                        ? `<img src="${thumbUrl}" alt="${gName}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=font-size:48px>${g.icon}</div>'">`
                        : `<div style="font-size:48px;">${g.icon}</div>`}
                </div>
                <div style="padding:8px 8px 10px; text-align:center;">
                    <div style="font-size:12px; font-weight:800; color:#e2e8f0;">${g.icon} ${gName}</div>
                    <div style="font-size:10px; color:#94a3b8; margin-top:2px;">${p ? (lang==='ja'?'作品あり':lang==='en'?'Browse':'작품 보기') : (lang==='ja'?'近日公開':lang==='en'?'Coming soon':'준비중')}</div>
                </div>
            `;
            div.onclick = () => { window._openArtworkGallery(g.code, gName); };
            grid.appendChild(div);
        });
    } catch(e) {
        console.warn('장르 작품 로딩 실패:', e);
        grid.innerHTML = '';
    }
};

// ★ 장르별 전체 작품 갤러리 (검색 + 페이징)
window._openArtworkGallery = async function(genreCode, genreName) {
    const lang = window.CURRENT_LANG || 'kr';
    const _searchPh = lang==='ja'?'作品を検索...':lang==='en'?'Search artworks...':'작품 검색...';
    const _noResult = lang==='ja'?'作品がありません':lang==='en'?'No artworks found':'작품이 없습니다';
    const _loadMore = lang==='ja'?'もっと見る':lang==='en'?'Load More':'더 보기';
    const _backLabel = lang==='ja'?'戻る':lang==='en'?'Back':'뒤로';

    // 모달 생성
    let modal = document.getElementById('artworkGalleryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'artworkGalleryModal';
        modal.className = 'modal-bg';
        modal.style.cssText = 'z-index:18000; display:none; align-items:center; justify-content:center;';
        modal.innerHTML = '<div class="modal-box" style="width:900px; max-width:95%; max-height:90vh; overflow-y:auto; padding:0;"></div>';
        document.body.appendChild(modal);
    }
    const box = modal.querySelector('.modal-box');
    modal.style.display = 'flex';

    let page = 0;
    const PAGE_SIZE = 20;
    let allItems = [];
    let searchTerm = '';

    box.innerHTML = `
        <div style="position:sticky; top:0; z-index:2; background:#fff; padding:16px 20px; border-bottom:1px solid #e2e8f0;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <button onclick="document.getElementById('artworkGalleryModal').style.display='none'" style="background:none; border:none; cursor:pointer; font-size:18px; color:#64748b;"><i class="fa-solid fa-arrow-left"></i></button>
                <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; flex:1;">${genreName}</h3>
                <button onclick="document.getElementById('artworkGalleryModal').style.display='none'" style="background:none; border:none; cursor:pointer; font-size:22px; color:#94a3b8;">&times;</button>
            </div>
            <input type="text" id="artworkGallerySearch" placeholder="${_searchPh}" style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; box-sizing:border-box;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <div id="artworkGalleryGrid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:16px 20px;"></div>
        <div id="artworkGalleryMore" style="text-align:center; padding:16px;"></div>
    `;

    const gridEl = document.getElementById('artworkGalleryGrid');
    const moreEl = document.getElementById('artworkGalleryMore');
    const searchInput = document.getElementById('artworkGallerySearch');

    // 검색 디바운스
    let _searchTimer;
    searchInput.oninput = () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            searchTerm = searchInput.value.trim().toLowerCase();
            page = 0;
            allItems = [];
            _loadPage();
        }, 300);
    };

    async function _loadPage() {
        if (page === 0) gridEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

        try {
            let query = sb.from('admin_products')
                .select('code, name, name_jp, name_us, name_cn, name_ar, name_es, name_de, name_fr, img_url, description');

            if (genreCode === 'ua_all') {
                query = query.like('category', 'ua_%');
            } else {
                query = query.eq('category', genreCode);
            }
            query = query.eq('partner_status', 'approved');

            // 검색어가 있으면 이름/설명에서 필터
            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%,name_jp.ilike.%${searchTerm}%,name_us.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
            }

            const { data: items } = await query
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (page === 0) gridEl.innerHTML = '';

            if (!items || items.length === 0) {
                if (page === 0) gridEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:#94a3b8; font-size:14px;">${_noResult}</div>`;
                moreEl.innerHTML = '';
                return;
            }

            items.forEach(p => {
                const pName = lang==='ja' ? (p.name_jp||p.name_us||p.name) : lang==='en' ? (p.name_us||p.name) : p.name;
                const thumbUrl = window.getTinyThumb ? window.getTinyThumb(p.img_url, 220) : p.img_url;
                const div = document.createElement('div');
                div.style.cssText = 'cursor:pointer; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0; transition:transform 0.2s; background:#fff;';
                div.onmouseenter = () => { div.style.transform = 'scale(1.03)'; div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; };
                div.onmouseleave = () => { div.style.transform = 'scale(1)'; div.style.boxShadow = 'none'; };
                div.innerHTML = `
                    <img src="${thumbUrl}" alt="${pName}" loading="lazy" style="width:100%; aspect-ratio:2/3; object-fit:cover;" onerror="this.src='https://placehold.co/220x330?text=No+Img'">
                    <div style="padding:8px; font-size:12px; font-weight:600; color:#1e1b4b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pName}</div>
                `;
                div.onclick = () => {
                    modal.style.display = 'none';
                    if (window.loadProductDetailAndOpen) window.loadProductDetailAndOpen(p.code);
                };
                gridEl.appendChild(div);
            });

            // 더보기 버튼
            if (items.length >= PAGE_SIZE) {
                moreEl.innerHTML = `<button onclick="window._artworkGalleryNextPage()" style="padding:10px 30px; border:2px solid #6366f1; border-radius:10px; background:#fff; color:#6366f1; font-weight:700; cursor:pointer; font-size:14px;">${_loadMore}</button>`;
            } else {
                moreEl.innerHTML = '';
            }
            page++;
        } catch(e) {
            console.warn('갤러리 로딩 실패:', e);
        }
    }

    window._artworkGalleryNextPage = _loadPage;
    _loadPage();

    // 모바일 반응형
    if (window.innerWidth <= 768) {
        gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
        gridEl.style.gap = '8px';
        gridEl.style.padding = '12px';
    }
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

// [신규] 파일의 고유 해시값(SHA-256) 계산 함수
async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// ============================================================
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