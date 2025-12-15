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
import { initOrderSystem } from "./order.js";
import { initAuth } from "./login.js";
import { initMyDesign } from "./my-design.js";
import { initCanvasUtils } from "./canvas-utils.js";
import { initShortcuts } from "./shortcuts.js";
import { initContextMenu } from "./context-menu.js";
// 벡터 생성 모듈
import { createVectorOutline } from "./outlineMaker.js";
// ★ 템플릿 자동 로드 함수 가져오기
import { loadProductFixedTemplate } from "./canvas-template.js";

window.addEventListener("DOMContentLoaded", async () => {
    try {
        // ★ [중요] 전역 함수로 등록 (order.js에서 호출할 수 있도록 연결)
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
        initOutlineTool(); // 칼선 도구 초기화

        if (window.canvas) {
            window.canvas.on('object:added', (e) => {
                const addedObj = e.target;
                
                // 방금 추가된 게 '특수 칼선'이 아니라면
                if (addedObj && addedObj.id !== 'product_fixed_overlay') {
                    
                    // 캔버스에 '특수 칼선'이 있는지 확인
                    const fixedOverlay = window.canvas.getObjects().find(o => o.id === 'product_fixed_overlay');
                    
                    // 있으면 다시 맨 위로 올림
                    if (fixedOverlay) {
                        window.canvas.bringToFront(fixedOverlay);
                    }
                }
            });
        }

        console.log("🚀 모든 모듈 초기화 완료");

        setTimeout(() => {
            const loading = document.getElementById("loading");
            const startScreen = document.getElementById("startScreen");
            const mainEditor = document.getElementById("mainEditor");

            if (loading) loading.style.display = "none";
            
            // 시작 화면이 닫혀있지 않다면(아직 선택 전이라면) 그대로 둠
            if (startScreen && startScreen.style.display !== 'none') {
                // pass
            } else {
                // 이미 에디터 모드라면 에디터 표시
                if (mainEditor) mainEditor.style.display = "flex";
            }
        }, 300);

    } catch (error) {
        console.error("🚨 초기화 오류:", error);
        alert("시스템 초기화 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
});

/**
 * ★ 벡터(Path) 칼선 만들기 도구 초기화
 * - 3개 버튼 (일반, 등신대, 키링) 통합 처리
 */
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
            
            // 벡터 생성 요청
            const result = await createVectorOutline(src, {
                dilation: 15,       
                color: '#FF00FF',   
                strokeWidth: 2,
                type: type 
            });

            // 패스 객체 생성
            const pathObj = new fabric.Path(result.pathData, {
                fill: '', 
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

            // 정밀 위치 보정
            const svgImageCenterX = result.width / 2;
            const svgImageCenterY = result.height / 2;
            const pathCenterX = pathObj.pathOffset.x;
            const pathCenterY = pathObj.pathOffset.y;
            const diffX = pathCenterX - svgImageCenterX;
            const diffY = pathCenterY - svgImageCenterY;

            const imgCenter = activeObj.getCenterPoint();
            const angleRad = fabric.util.degreesToRadians(activeObj.angle);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            const finalOffsetX = (diffX * activeObj.scaleX * cos) - (diffY * activeObj.scaleY * sin);
            const finalOffsetY = (diffX * activeObj.scaleX * sin) + (diffY * activeObj.scaleY * cos);

            pathObj.set({
                left: imgCenter.x + finalOffsetX,
                top: imgCenter.y + finalOffsetY,
                scaleX: activeObj.scaleX,
                scaleY: activeObj.scaleY,
                angle: activeObj.angle
            });

            currentCanvas.add(pathObj);
            currentCanvas.bringToFront(pathObj);
            pathObj.setCoords();
            currentCanvas.requestRenderAll();
            
            console.log(`✂️ ${type} 모드 칼선 생성 완료`);

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

/**
 * 모바일 전용 텍스트 에디터 로직
 */
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

// 패널 토글 함수 (모바일용)
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

// 캔버스 빈 곳 터치 시 패널 닫기
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

// ==========================================================
// ★ [수정됨] 유저 로고 업로드 (최종: user_id 저장 활성화)
// ==========================================================
window.uploadUserLogo = async () => {
    // 1. 로그인 체크
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
        // 2. [오류해결] 한글 파일명 깨짐 방지
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop(); 
        const safeFileName = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const filePath = `user_uploads/${currentUser.id}/${safeFileName}`;
        
        // 3. 스토리지에 파일 업로드
        const { error: uploadError } = await sb.storage
            .from('design') 
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 4. 공개 URL 가져오기
        const { data: urlData } = sb.storage
            .from('design')
            .getPublicUrl(filePath);
        
        const publicUrl = urlData.publicUrl;

        // 5. DB 데이터 등록
        // ★ user_id를 포함하여 저장합니다. (is_public은 DB에 없으므로 제외)
        const payload = {
            category: 'logo',
            tags: tags || '유저업로드',
            thumb_url: publicUrl,
            data_url: publicUrl,
            width: 1000,
            height: 1000,
            user_id: currentUser.id  // ✅ 카운트를 위해 필수
        };

        const { error: dbError } = await sb.from('library').insert(payload);

        if (dbError) throw dbError;

        // 6. 현재 개수 즉시 확인 (DB 기준)
        const { count } = await sb
            .from('library')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('category', 'logo');

        const currentCount = count || 0;

        alert(`✅ 업로드 성공!\n\n현재 누적 공유 로고: ${currentCount}개\n\n5개 달성 시: PNG 다운로드 잠금해제\n10개 달성 시: PDF 다운로드 잠금해제`);
        
        window.resetUpload(); 
        document.getElementById('logoUploadModal').style.display = 'none';

    } catch (e) {
        console.error(e);
        if (e.message.includes("Invalid key")) {
             alert("업로드 경로 오류: 관리자에게 문의하세요.");
        } else if (e.message.includes("column")) {
             alert("DB 컬럼 오류: " + e.message);
        } else {
             alert("업로드 실패: " + e.message);
        }
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// ==========================================================
// ★ [수정됨] 파일 선택 시: 미리보기 + 태그 자동완성
// ==========================================================
window.handleFileSelect = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // 1. 검색 태그 자동 완성 (파일명 활용)
        const fileNameNoExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const tagInput = document.getElementById('logoKeywordInput');
        
        // 태그 입력창이 비어있을 때만 자동 입력
        if (tagInput && !tagInput.value) {
            tagInput.value = fileNameNoExt + " 로고";
        }

        // 2. 이미지 미리보기
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('previewImage');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            // 업로드 UI 전환
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

// 업로드 폼 리셋 기능
window.resetUpload = (e) => {
    if(e) e.stopPropagation();
    const input = document.getElementById('logoFileInput');
    if(input) input.value = '';
    
    // 태그 입력창도 초기화
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