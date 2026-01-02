// main.js

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

        await checkPartnerStatus();

        // 폰트 미리 로드
        if(window.preloadLanguageFont) await window.preloadLanguageFont();

        // 3. 마이페이지 버튼 연결
        const btnMyPage = document.getElementById("btnMyLibrary");
        if (btnMyPage) {
            btnMyPage.onclick = () => {
                if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
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
        console.error("🚨 초기화 오류:", error);
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
// [최종] 파트너스 시스템 (음성안내 + 10% 수수료 + 파일명)
// ============================================================
// ============================================================
// ★ [추가] 파트너스 관리자 접속 버튼 기능
// ============================================================
window.openPartnerConsole = function() {
    const modal = document.getElementById('partnerConsoleModal');
    if (modal) {
        modal.style.display = 'flex';
        // 모달을 열 때 '실시간 주문접수' 탭 데이터를 자동으로 불러옵니다.
        if (window.switchPartnerTab) window.switchPartnerTab('pool');
    }
};
let lastOrderCount = -1;

// 1. 파트너 권한 확인 및 버튼 표시 (수정됨: 권한별 버튼 분기 처리)
async function checkPartnerStatus() {
    const btnConsole = document.getElementById('btnPartnerConsole');
    const btnApply = document.getElementById('btnPartnerApply');

    // 1. 비로그인 상태 체크
    const { data: { user } } = await sb.auth.getUser();
    
    if (!user) {
        // 비로그인이면 콘솔 버튼 숨기고, 신청 버튼만 보여줌 (로그인 유도용)
        if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
        if (btnApply) {
            btnApply.style.display = 'inline-flex';
            btnApply.onclick = () => alert("로그인이 필요한 서비스입니다.");
        }
        return;
    }

    // 2. 로그인 상태면 DB에서 등급 조회
    const { data } = await sb.from('profiles').select('role, region').eq('id', user.id).single();
    
    if (data && (data.role === 'franchise' || data.role === 'admin')) {
        // [가맹점/관리자] -> 콘솔 버튼 보임, 신청 버튼 숨김
        console.log("✅ 가맹점/관리자 접속 확인");
        if (btnConsole) btnConsole.style.setProperty('display', 'inline-flex', 'important');
        if (btnApply) btnApply.style.display = 'none';
        
        // 지역 설정 및 알림 시작
        const badge = document.getElementById('partnerRegionBadge');
        if(badge) badge.innerText = data.region ? `📍 ${data.region} 지역` : '📍 지역 전체';
        window.currentPartnerRegion = data.region;

        setInterval(() => loadPartnerOrders('pool', true), 30000);
    } 
    else {
        // [일반 회원] -> 콘솔 버튼 숨김, 신청 버튼 보임
        console.log("ℹ️ 일반 회원 접속");
        if (btnConsole) btnConsole.style.setProperty('display', 'none', 'important');
        if (btnApply) {
            btnApply.style.display = 'inline-flex';
            btnApply.onclick = applyForPartner; // 신청 함수 연결
        }
    }
}

// [신규] 가맹점 신청 함수
// [수정됨] 가맹점 신청 함수 (DB에 진짜로 저장하는 코드)
async function applyForPartner() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return alert("로그인이 필요합니다.");

    const name = prompt("가맹점(업체) 상호명을 입력해주세요.");
    if(!name) return;
    const phone = prompt("담당자 연락처를 입력해주세요.");
    if(!phone) return;
    const region = prompt("희망 지역을 입력해주세요 (예: 서울 강남구)");
    if(!region) return;

    if(!confirm(`[신청 정보 확인]\n상호명: ${name}\n연락처: ${phone}\n지역: ${region}\n\n제출하시겠습니까?`)) return;

    // ★ [핵심] 실제 DB에 저장하는 코드
    try {
        const { error } = await sb.from('partner_applications').insert({
            user_id: user.id,
            company_name: name,
            contact_phone: phone,
            region: region,
            status: 'pending' // '대기중' 상태로 저장
        });

        if (error) throw error;

        alert("🎉 가맹점 신청이 정상적으로 접수되었습니다!\n관리자 승인 후 파트너스 기능을 이용하실 수 있습니다.");
    } catch (e) {
        console.error(e);
        alert("신청 실패: " + e.message);
    }
}

// 3. 탭 전환
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

// 4. 주문 목록 불러오기 (음성 알림 & 파일명 표시)
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
        // [수정] .is('franchise_id', null) 제거 -> 이미 접수된 건도 불러와서 UI에서 잠금 처리
        query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
        
        if (window.currentPartnerRegion && window.currentPartnerRegion !== '전체') {
            query = query.ilike('address', `%${window.currentPartnerRegion}%`);
        }
    } else {
        query = query.eq('franchise_id', user.id);
    }

    const { data: orders, error } = await query;
    if (error) return;

    // ★ [음성 알림] 주문이 늘어났으면 목소리로 안내
    const currentCount = orders ? orders.length : 0;

    if (mode === 'pool') {
        // ★ 핵심: lastOrderCount가 -1(첫 로딩)이 아닐 때만 소리 재생
        if (lastOrderCount !== -1 && currentCount > lastOrderCount) {
            if ('speechSynthesis' in window) {
                const msg = new SpeechSynthesisUtterance("카멜레온 프린팅, 새로운 주문이 들어왔습니다.");
                msg.lang = 'ko-KR'; 
                msg.rate = 1.0; 
                window.speechSynthesis.speak(msg);
            } else {
                try { document.getElementById('orderAlertSound')?.play(); } catch(e){}
            }
        }
        // 개수 업데이트
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

        // 파일명 표시
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
            
            // ★ [핵심] 이미 접수된 주문인지 확인 (본사 또는 타 파트너)
            const isTaken = (o.franchise_id !== null);
            
            // 스타일 및 버튼 설정 분기
            let cardStyle = "background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:15px;";
            let btnHtml = `<button onclick="window.dibsOrder('${o.id}')" style="width:100%; margin-top:10px; padding:10px; background:#6366f1; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⚡ 접수하기</button>`;
            let badgeHtml = `<span style="background:#ef4444; color:white; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:4px;">NEW ${timeDiff}분전</span>`;

            // 이미 접수된 건이면 (본사 제작 포함)
            if (isTaken) {
                // 내 주문이 아닌 경우 -> 회색 비활성화 (Lock)
                if (o.franchise_id !== user.id) {
                    cardStyle = "background:#f1f5f9; border:1px solid #cbd5e1; border-radius:12px; padding:20px; margin-bottom:15px; opacity:0.7;";
                    btnHtml = `<button disabled style="width:100%; margin-top:10px; padding:10px; background:#94a3b8; color:white; border:none; border-radius:8px; font-weight:bold; cursor:not-allowed;">🚫 본사/타점 제작중</button>`;
                    badgeHtml = `<span style="background:#64748b; color:white; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:4px;">🔒 접수완료</span>`;
                } else {
                    // 내가 접수한 건이 풀 목록에 보일 경우
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

// 5. 찜하기
window.dibsOrder = async function(orderId) {
    if(!confirm("주문을 접수하시겠습니까?")) return;
    const { data: { user } } = await sb.auth.getUser();
    
    const { data: check } = await sb.from('orders').select('franchise_id').eq('id', orderId).single();
    if(check.franchise_id) return alert("이미 다른 파트너가 접수한 주문입니다.");

    await sb.from('orders').update({ franchise_id: user.id, status: '제작준비' }).eq('id', orderId);
    alert("접수되었습니다! [나의 진행 주문] 탭에서 확인하세요.");
    window.switchPartnerTab('my');
};

// 6. 상태 변경
window.updateOrderStatus = async function(orderId, status) {
    if(!confirm(`상태를 '${status}'로 변경하시겠습니까?`)) return;
    await sb.from('orders').update({ status: status }).eq('id', orderId);
    window.loadPartnerOrders('my');
};

// 7. 정산 정보 로드 (★ 90% 지급 로직)
// 7. 정산 정보 로드 (입금완료 건 제외 로직 추가)
window.loadSettlementInfo = async function() {
    const tbody = document.getElementById('settlementListBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">로딩 중...</td></tr>';

    const { data: { user } } = await sb.auth.getUser();
    if(!user) return;

    // [1] 출금 가능 금액 (구매확정, 아직 신청 안 함)
    const { data: orders } = await sb.from('orders')
        .select('*')
        .eq('franchise_id', user.id)
        .eq('status', '구매확정')
        .neq('settlement_status', 'withdrawn'); // 이미 신청한 건 제외

    // [2] 출금 대기중 금액 (신청함, 아직 관리자 승인 안 함)
    const { data: pendings } = await sb.from('withdrawal_requests')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending'); // ★ 'approved'(완료) 상태는 제외됨!

    let availableTotal = 0;
    let pendingTotal = 0;
    let html = '';

    // 대기 금액 합산
    if (pendings) {
        pendings.forEach(p => pendingTotal += (p.amount || 0));
    }

    if(!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#999;">정산 가능한 내역이 없습니다.</td></tr>';
    } else {
        orders.forEach(o => {
            const amount = o.total_amount || 0;
            // 10% 수수료 공제 (90% 지급)
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

    // 화면 업데이트
    document.getElementById('partnerAvailableBalance').innerText = availableTotal.toLocaleString() + '원';
    
    const pendingEl = document.getElementById('partnerPendingBalance');
    if(pendingEl) pendingEl.innerText = pendingTotal.toLocaleString() + '원';
    
    window.currentWithdrawableAmount = availableTotal;
};

// 8. 출금 모달 열기
window.requestPartnerWithdrawal = function() {
    const amt = window.currentWithdrawableAmount || 0;
    if (amt < 10000) return alert("최소 10,000원 이상부터 출금 가능합니다.");
    document.getElementById('wdAmount').value = amt.toLocaleString() + '원';
    document.getElementById('withdrawModal').style.display = 'flex';
};

// 9. 출금 신청 제출 (에러 해결됨)
window.submitWithdrawal = async function() {
    const amount = window.currentWithdrawableAmount;
    const bankInfo = document.getElementById('wdBankInfo').value;
    const fileInput = document.getElementById('wdTaxFile');

    if (!bankInfo) return alert("계좌 정보를 입력해주세요.");
    if (fileInput.files.length === 0) return alert("세금계산서를 첨부해주세요.");

    if (!confirm("신청하시겠습니까?")) return;

    const btn = document.querySelector('#withdrawModal .btn-round.primary');
    btn.innerText = "전송 중..."; btn.disabled = true;

    try {
        const { data: { user } } = await sb.auth.getUser();
        
        // 파일 업로드
        const file = fileInput.files[0];
        const ext = file.name.split('.').pop();
        const path = `tax_invoices/${user.id}_${Date.now()}.${ext}`;
        
        const { error: upErr } = await sb.storage.from('orders').upload(path, file);
        if (upErr) throw upErr;
        
        const { data: { publicUrl } } = sb.storage.from('orders').getPublicUrl(path);

        // ★ [수정] bank_name에 계좌정보 통합 저장
        const { error: dbErr } = await sb.from('withdrawal_requests').insert({
            user_id: user.id,
            amount: amount,
            bank_name: bankInfo, // 여기에 계좌/은행/예금주 다 넣음
            status: 'pending',
            tax_invoice_url: publicUrl
        });
        if (dbErr) throw dbErr;

        await sb.from('orders')
            .update({ settlement_status: 'withdrawn' })
            .eq('franchise_id', user.id)
            .eq('status', '구매확정')
            .neq('settlement_status', 'withdrawn');

        alert("출금 신청 완료! (D+5일 내 입금)");
        document.getElementById('withdrawModal').style.display = 'none';
        window.loadSettlementInfo();

    } catch(e) {
        alert("오류: " + e.message);
    } finally {
        btn.innerText = "신청하기"; btn.disabled = false;
    }
};
// ============================================================
// [고객용] 주문 조회 & 리뷰 시스템 (별점 포함)
// ============================================================

// 1. 내 주문 목록 열기
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

        // 버튼 상태 로직
        let statusBadge = `<span class="badge" style="background:#f1f5f9; color:#64748b;">${o.status}</span>`;
        let actionBtn = '';

        // 고객이 '배송중' 또는 '제작준비(테스트용)' 일 때 수령확인 가능
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

// 2. 리뷰 모달 열기
window.openReviewModal = function(orderId) {
    document.getElementById('targetReviewOrderId').value = orderId;
    document.getElementById('reviewCommentInput').value = '';
    setReviewRating(5);
    document.getElementById('reviewWriteModal').style.display = 'flex';
};

// 3. 별점 UI
window.setReviewRating = function(score) {
    document.getElementById('targetReviewScore').value = score;
    document.getElementById('ratingText').innerText = score + "점";
    for(let i=1; i<=5; i++) {
        const star = document.getElementById(`star${i}`);
        if(i <= score) star.style.color = '#f59e0b';
        else star.style.color = '#e2e8f0';
    }
};

// 4. 리뷰 제출 (구매확정)
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
        
        // 가맹점 화면 갱신용 (선택)
        if(typeof loadSettlementInfo === 'function') loadSettlementInfo();
    }
};