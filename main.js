// main.js

import { initConfig, sb, currentUser } from "./config.js"; 
import { initCanvas, canvas } from "./canvas-core.js";
import { initSizeControls } from "./canvas-size.js";
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

// ★ [수정] mypage.js는 별도 페이지이므로 여기서 import 하지 않습니다. (오류 해결)

// ★ [핵심] 원본 PDF 주소를 저장할 전역 변수
window.currentUploadedPdfUrl = null; 

// ==========================================================
// 1. 메인 초기화 및 통합 로직
// ==========================================================
window.addEventListener("DOMContentLoaded", async () => {
    const loading = document.getElementById("loading");
    const startScreen = document.getElementById("startScreen");
    const mainEditor = document.getElementById("mainEditor");

    try {
        // 1. 필수 설정 및 캔버스 초기화
        window.loadProductFixedTemplate = loadProductFixedTemplate;
        await initConfig(); // DB 연결 및 유저 세션 로드
        initCanvas();       // Fabric.js 캔버스 생성
        
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
        initOrderSystem();
        initAuth();
        initMyDesign();
        initMobileTextEditor();
        initOutlineTool();
        initFileUploadListeners();

        // 3. [수정] 마이페이지 버튼 연결 (My Studio)
        const btnMyPage = document.getElementById("btnMyLibrary");
        if (btnMyPage) {
            btnMyPage.onclick = () => {
                // 로그인 체크 후 이동
                if (!currentUser) {
                    alert("로그인이 필요한 서비스입니다.");
                    return;
                }
                location.href = 'mypage.html';
            };
        }

        console.log("🚀 에디터 모듈 초기화 완료");

        // =========================================================
        // ★ 마이페이지 연동 로직 (편집/재주문으로 들어왔을 때)
        // =========================================================
        const loadId = localStorage.getItem('load_design_id');
        const cartFlag = localStorage.getItem('open_cart_on_load');

        // A. 디자인 편집으로 들어온 경우
        if (loadId) {
            console.log("📂 마이페이지 편집 요청 ID:", loadId);
            localStorage.removeItem('load_design_id'); // 1회용 삭제

            // 화면 강제 전환 (시작화면 숨김 -> 에디터 표시)
            if(startScreen) startScreen.style.display = 'none';
            if(mainEditor) mainEditor.style.display = 'flex';
            
            // 로딩 표시
            if(loading) {
                loading.style.display = 'flex';
                loading.querySelector('p').innerText = "디자인을 불러오는 중...";
            }

            // DB에서 데이터 가져오기
            const { data, error } = await sb.from('user_designs').select('*').eq('id', loadId).single();

            if (data && !error) {
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize')); 
                    
                    // 1. 사이즈 적용
                    if(window.applySize) {
                        window.applySize(data.width, data.height, data.product_key || 'custom', 'standard', 'replace');
                    }

                    // 2. 데이터 파싱
                    let jsonData = data.json_data;
                    if (typeof jsonData === 'string') {
                        try { jsonData = JSON.parse(jsonData); } catch(e) {}
                    }

                    // 3. 캔버스 로드
                    if (window.canvas) {
                        window.canvas.loadFromJSON(jsonData, () => {
                            window.canvas.requestRenderAll();
                            if(loading) loading.style.display = 'none';
                            console.log("✅ 디자인 복원 완료");
                        });
                    }
                }, 800);
            } else {
                alert("디자인 데이터를 찾을 수 없습니다.");
                if(loading) loading.style.display = 'none';
            }
        
        // B. 장바구니 재주문으로 들어온 경우
        } else if (cartFlag) {
            localStorage.removeItem('open_cart_on_load');
            if(startScreen) startScreen.style.display = 'none';
            if(mainEditor) mainEditor.style.display = 'flex';
            
            setTimeout(() => {
                const cartPage = document.getElementById('cartPage');
                if(cartPage) cartPage.style.display = 'block';
                if(window.renderCart) window.renderCart();
            }, 500);
        }

    } catch (error) {
        console.error("🚨 초기화 오류:", error);
        if(loading) loading.style.display = 'none';
    } finally {
        // 일반 접속일 경우 로딩 끄기
        const loadId = localStorage.getItem('load_design_id');
        if (!loadId && loading) loading.style.display = "none";
    }
});

// ... (아래 파일 업로드 및 유틸 함수들은 기존 유지) ...
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
        loading.querySelector('p').innerText = "파일 처리 중...";
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
            alert("지원하지 않는 파일 형식입니다.");
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
        alert("✅ PDF 파일이 로드되었습니다. (원본은 서버에 저장됨)");
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
            alert("외곽선을 만들 이미지를 선택해주세요!");
            return;
        }
        const originalText = btn.innerHTML;
        btn.innerText = "생성 중...";
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
            // 위치 보정
            const diffX = (pathObj.width/2 - result.width/2); 
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
    const btnFinish = document.getElementById('btnFinishText');
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