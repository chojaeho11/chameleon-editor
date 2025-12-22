// main.js

import { initConfig, sb, currentUser } from "./config.js"; 
import { initCanvas, canvas } from "./canvas-core.js";
import { initSizeControls } from "./canvas-size.js";
import { initGuides } from "./canvas-guides.js";
import { initZoomPan } from "./canvas-zoom-pan.js";
import { initObjectTools } from "./canvas-objects.js";
import { initImageTools } from "./canvas-image.js";
import { initTemplateTools } from "./canvas-template.js";
import { initAiTools } from "./canvas-ai.js";
import { initExport } from "./export.js";
import { initOrderSystem, startDesignFromProduct } from "./order.js"; 
import { initAuth } from "./login.js";
import { initMyDesign } from "./my-design.js";
import { initCanvasUtils } from "./canvas-utils.js";
import { initShortcuts } from "./shortcuts.js";
import { initContextMenu } from "./context-menu.js";
import { createVectorOutline } from "./outlineMaker.js";
import { loadProductFixedTemplate } from "./canvas-template.js";

// ★ [핵심] 원본 PDF 주소를 저장할 전역 변수
window.currentUploadedPdfUrl = null; 

// ==========================================================
// 1. 메인 초기화
// ==========================================================
window.addEventListener("DOMContentLoaded", async () => {
  const loading = document.getElementById("loading");
  const startScreen = document.getElementById("startScreen");
  const mainEditor = document.getElementById("mainEditor");

  try {
    window.loadProductFixedTemplate = loadProductFixedTemplate;

    await initConfig();
    initCanvas();
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

    console.log("🚀 모든 모듈 초기화 완료");
  } catch (error) {
    console.error("🚨 초기화 오류:", error);
    alert("시스템 초기화 중 오류가 발생했습니다.");
  } finally {
    // ✅ 에러가 나도 로딩은 반드시 끈다
    if (loading) loading.style.display = "none";

    // 메인 화면은 가능한 보여주기
    if (startScreen && startScreen.style.display !== "none") {
      // 시작화면 유지
    } else {
      if (mainEditor) mainEditor.style.display = "flex";
    }
  }
});


// ==========================================================
// ★ [핵심] 통합 파일 업로드 처리
// ==========================================================
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
        loading.querySelector('p').innerText = "파일을 분석하여 캔버스에 올리는 중...";
    }

    try {
        // [A] 시작 화면에서 올린 경우 -> 화면 강제 전환
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
                if (product) {
                    window.applySize(product.w || 210, product.h || 297, window.currentProductKey);
                }
            }
        }

        // [B] 파일 처리 (PDF vs 이미지)
        if (file.type === 'application/pdf') {
            const timestamp = Date.now();
            const safeName = `${timestamp}_${Math.random().toString(36).substring(2, 8)}.pdf`;
            const filePath = `customer_uploads/${safeName}`;
            
            const { error: uploadErr } = await sb.storage.from('orders').upload(filePath, file);
            if (uploadErr) throw uploadErr;
            
            const { data: publicData } = sb.storage.from('orders').getPublicUrl(filePath);
            
            window.currentUploadedPdfUrl = publicData.publicUrl;
            console.log("✅ 원본 PDF 저장됨:", window.currentUploadedPdfUrl);

            await addPdfToCanvasAsImage(file);

        } else if (file.type.startsWith('image/')) {
            window.currentUploadedPdfUrl = null; 
            const reader = new FileReader();
            reader.onload = function (f) {
                fabric.Image.fromURL(f.target.result, function (img) {
                    // ★ [변경] 꽉 채우기 함수 호출
                    fitImageToCanvas(img);
                });
            };
            reader.readAsDataURL(file);
        } else {
            alert("이미지(JPG, PNG) 또는 PDF 파일만 지원합니다.");
        }

    } catch (err) {
        console.error(err);
        alert("파일 처리 실패: " + err.message);
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
    
    // 고해상도로 변환
    const viewport = page.getViewport({ scale: 2 });
    const hiddenCanvas = document.createElement('canvas');
    const ctx = hiddenCanvas.getContext('2d');
    hiddenCanvas.width = viewport.width;
    hiddenCanvas.height = viewport.height;
    
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    const imgData = hiddenCanvas.toDataURL('image/jpeg', 0.8);

    fabric.Image.fromURL(imgData, function(img) {
        // ★ [변경] 꽉 채우기 함수 호출
        fitImageToCanvas(img);
        
        alert("✅ PDF 파일이 로드되었습니다.\n화면 이미지는 확인용이며, 실제로는 원본 PDF가 접수됩니다.");
    });
}

// ★★★ [수정됨] 이미지를 캔버스 정중앙에 꽉 채우는 함수 (Cover Logic) ★★★
// main.js 파일 맨 아래쪽 fitImageToCanvas 함수를 이걸로 교체하세요.

// ★★★ [수정됨] 이미지를 '작업 영역(Board)'에 맞춰 꽉 채우고 중앙 정렬하는 함수 ★★★
function fitImageToCanvas(img) {
    if (!canvas) return;

    // 1. 'Board' (흰색 작업 영역) 객체 찾기
    const board = canvas.getObjects().find(o => o.isBoard);

    let targetW, targetH, targetCenterX, targetCenterY;

    if (board) {
        // 보드가 있으면 -> 보드 크기와 위치를 기준으로 계산
        // (보드의 scale이 적용된 실제 크기)
        targetW = board.width * board.scaleX;
        targetH = board.height * board.scaleY;
        
        // 보드의 정중앙 좌표 계산
        targetCenterX = board.left + (targetW / 2);
        targetCenterY = board.top + (targetH / 2);
    } else {
        // 보드가 없으면 -> 캔버스 전체 기준 (비상용)
        targetW = canvas.width;
        targetH = canvas.height;
        targetCenterX = targetW / 2;
        targetCenterY = targetH / 2;
    }

    // 2. Cover 비율 계산 (빈틈 없이 꽉 채우기)
    // 가로 비율과 세로 비율 중 '더 큰 값'을 선택해야 보드를 완전히 덮습니다.
    const scaleX = targetW / img.width;
    const scaleY = targetH / img.height;
    const scale = Math.max(scaleX, scaleY);

    // 3. 이미지 설정 적용
    img.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',  // 이미지의 중심점을 기준으로
        originY: 'center',
        left: targetCenterX, // 보드의 정중앙 좌표에 배치
        top: targetCenterY,
        angle: 0
    });

    // 4. 캔버스에 추가
    canvas.add(img);
    canvas.setActiveObject(img);
    img.setCoords(); // 좌표 강제 업데이트
    
    // (선택 사항) 이미지가 보드 바로 위, 다른 요소들보다는 아래로 가게 하려면:
    // canvas.sendToBack(img); 
    // if(board) canvas.sendToBack(board); // 보드는 제일 뒤로

    canvas.requestRenderAll();
}

// ==========================================================
// 2. 기타 도구들 (기존 코드 유지)
// ==========================================================
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
            const svgImageCenterX = result.width / 2;
            const svgImageCenterY = result.height / 2;
            const diffX = pathObj.pathOffset.x - svgImageCenterX;
            const diffY = pathObj.pathOffset.y - svgImageCenterY;
            const imgCenter = activeObj.getCenterPoint();
            const angleRad = fabric.util.degreesToRadians(activeObj.angle);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const finalOffsetX = (diffX * activeObj.scaleX * cos) - (diffY * activeObj.scaleY * sin);
            const finalOffsetY = (diffX * activeObj.scaleX * sin) + (diffY * activeObj.scaleY * cos);
            pathObj.set({
                left: imgCenter.x + finalOffsetX, top: imgCenter.y + finalOffsetY,
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
    if(btnFinish) {
        btnFinish.addEventListener('click', function() {
            closeMobileEditor();
            if(mobileInput) mobileInput.blur();
            window.canvas.discardActiveObject();
            window.canvas.requestRenderAll();
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

window.toggleMobilePanel = function(side) {
    const leftPanel = document.getElementById('toolsPanel');
    const rightPanel = document.getElementById('rightStackPanel');
    if (side === 'left') {
        if (leftPanel) leftPanel.classList.toggle('open');
        if (rightPanel) rightPanel.classList.remove('open');
    } else if (side === 'right') {
        if (rightPanel) rightPanel.classList.toggle('open');
        if (leftPanel) leftPanel.classList.remove('open');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const stage = document.getElementById('stage');
    if(stage) {
        stage.addEventListener('click', (e) => {
            if (!e.target.closest('.mobile-fab') && !e.target.closest('.side') && !e.target.closest('.right-stack')) {
                const leftPanel = document.getElementById('toolsPanel');
                const rightPanel = document.getElementById('rightStackPanel');
                if(leftPanel) leftPanel.classList.remove('open');
                if(rightPanel) rightPanel.classList.remove('open');
            }
        });
    }
});

window.uploadUserLogo = async () => {
    if (!currentUser) return alert("로그인이 필요한 기능입니다.");
    const fileInput = document.getElementById('logoFileInput');
    const tagInput = document.getElementById('logoKeywordInput');
    const file = fileInput.files[0];
    const tags = tagInput.value;
    if (!file) return alert("파일을 선택해주세요.");
    const btn = document.querySelector('#logoUploadModal .btn-round.primary');
    const oldText = btn.innerText;
    btn.innerText = "업로드 중...";
    btn.disabled = true;
    try {
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop(); 
        const safeFileName = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const filePath = `user_uploads/${currentUser.id}/${safeFileName}`;
        const { error: uploadError } = await sb.storage.from('design').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = sb.storage.from('design').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;
        const payload = {
            category: 'logo', tags: tags || '유저업로드', thumb_url: publicUrl, data_url: publicUrl,
            width: 1000, height: 1000, user_id: currentUser.id 
        };
        const { error: dbError } = await sb.from('library').insert(payload);
        if (dbError) throw dbError;
        const { count } = await sb.from('library').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('category', 'logo');
        alert(`✅ 업로드 성공!\n\n현재 누적 공유 로고: ${count || 0}개`);
        window.resetUpload(); 
        document.getElementById('logoUploadModal').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert("업로드 실패: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

window.handleFileSelect = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileNameNoExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const tagInput = document.getElementById('logoKeywordInput');
        if (tagInput && !tagInput.value) {
            tagInput.value = fileNameNoExt + " 로고";
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('previewImage');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            const icon = document.querySelector('.upload-icon');
            const text = document.querySelector('.upload-text');
            const sub = document.querySelector('.upload-sub');
            const delBtn = document.getElementById('removeFileBtn');
            if(icon) icon.style.display = 'none';
            if(text) text.style.display = 'none';
            if(sub) sub.style.display = 'none';
            if(delBtn) delBtn.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
};

window.resetUpload = (e) => {
    if(e) e.stopPropagation();
    const input = document.getElementById('logoFileInput');
    if(input) input.value = '';
    const tagInput = document.getElementById('logoKeywordInput');
    if(tagInput) tagInput.value = '';
    const preview = document.getElementById('previewImage');
    if(preview) preview.style.display = 'none';
    const icon = document.querySelector('.upload-icon');
    const text = document.querySelector('.upload-text');
    const sub = document.querySelector('.upload-sub');
    const delBtn = document.getElementById('removeFileBtn');
    if(icon) icon.style.display = 'block';
    if(text) text.style.display = 'block';
    if(sub) sub.style.display = 'block';
    if(delBtn) delBtn.style.display = 'none';
};