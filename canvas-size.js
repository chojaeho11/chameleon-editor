// canvas-size.js
// [수정] currentMode 추가 import (현재 작업 모드 'standard'/'wall' 유지를 위해)
import { canvas, setBaseSize, setGlobalMode, setGlobalSizeName, setGuideOn, maxLimitMM, currentMode } from "./canvas-core.js?v=123";
import { drawGuides } from "./canvas-guides.js?v=123";
import { openProductDetail } from "./order.js?v=123";

export function initSizeControls() {
    // 1. 제품 데이터 정의
    const sizesStandard = [
        { name: 'A4', w: 595, h: 842, key: 'A4' },
        { name: 'A3', w: 842, h: 1191, key: 'A3' },
        { name: 'A2', w: 1191, h: 1684, key: 'A2' },
        { name: 'A1', w: 1684, h: 2384, key: 'A1' },
        { name: '1200x600', w: 3401, h: 1700, key: 'Std_1200_600' }, 
        { name: '2400x1200', w: 6803, h: 3401, key: 'Std_2400_1200' }
    ];

    const sizesWall = [
        { name: '1-Section Wall', w: 1200, h: 2200, mode: 'wall', key: 'Wall_1' },
        { name: '2-Section Wall', w: 2200, h: 2200, mode: 'wall', key: 'Wall_2' },
        { name: '3-Section Wall', w: 3200, h: 2200, mode: 'wall', key: 'Wall_3' },
        { name: '4-Section Wall', w: 4200, h: 2200, mode: 'wall', key: 'Wall_4' },
        { name: '5-Section Wall', w: 5200, h: 2200, mode: 'wall', key: 'Wall_5' },
    ];

    const sizesGoods = [
        { name: 'X-Banner', w: 600, h: 1800, key: 'Banner_X' },
        { name: 'Award Board', w: 800, h: 570, key: 'Award_Board' },
        { name: 'Text Photo Zone', w: 2400, h: 1200, key: 'PhotoZone_Text' },
        { name: 'Wide Fabric', w: 1350, h: 900, key: 'Fabric_Wide' },
        { name: 'Paper Stand', w: 585, h: 1130, key: 'Paper_Disp_4' }
    ];

    // [사용자 지정 사이즈 적용 버튼 이벤트]
    const btnApplyUser = document.getElementById("btnApplyUserSize");
    const inputW = document.getElementById("inputUserW");
    const inputH = document.getElementById("inputUserH");

    if (btnApplyUser && inputW && inputH) {
        btnApplyUser.onclick = () => {
            let reqW = parseInt(inputW.value); // mm 단위
            let reqH = parseInt(inputH.value); // mm 단위

            if (!reqW || !reqH || reqW <= 0 || reqH <= 0) {
                return alert(window.t('msg_invalid_number', "Please enter a valid number."));
            }

            // 최대 크기(현재 대지 크기) 체크
            const limitW = maxLimitMM.w || 99999;
            const limitH = maxLimitMM.h || 99999;

            const isFitNormal = (reqW <= limitW && reqH <= limitH);
            const isFitRotated = (reqW <= limitH && reqH <= limitW);

            if (!isFitNormal && !isFitRotated) {
                // [수정] 다국어 적용 (치환 포함)
                const msg = window.t('msg_max_size_exceeded', "Cannot exceed maximum size.")
                    .replace('{w}', limitW).replace('{h}', limitH);
                return alert(msg);
            }

            // 회전 자동 적용 (가로/세로 교차 허용)
            if (!isFitNormal && isFitRotated) {
                const temp = reqW;
                reqW = reqH;
                reqH = temp;
                alert(window.t('msg_size_rotated', "The dimensions were rotated to fit the canvas."));
                
                // 입력창 값도 스왑해서 보여줌
                inputW.value = reqW;
                inputH.value = reqH;
            }

            // ★ [수정됨] 기존 방식: drawUserCutLine(reqW, reqH) -> 가이드라인만 그리기
            // ★ [변경 방식]: applySize() 호출 -> 대지 자체를 해당 크기로 변경 (여백 삭제 효과)
            
            // 기존 작업물 유지를 위해 'resize' 옵션 사용
            // currentMode는 import된 canvas-core의 상태를 따름 (wall인지 standard인지)
            applySize(reqW, reqH, "User Custom", currentMode || 'standard', 'resize');
            
            console.log(`📏 사용자 지정 사이즈 적용됨: ${reqW}x${reqH}mm (나머지 영역 삭제)`);
        };
    }

    renderSizeButtons('row1', sizesStandard);
    renderSizeButtons('row2', sizesWall);
    renderSizeButtons('row3', sizesGoods);

    // 에디터 내부 패널 로직
    const btnChange = document.getElementById("btnChangeSize");
    const panel = document.getElementById("sizeTogglePanel");
    
    if (btnChange && panel) {
        btnChange.onclick = () => {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'grid' : 'none';
            if(isHidden && panel.innerHTML === '') {
                [...sizesStandard, ...sizesWall, ...sizesGoods].forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-round';
                    btn.style.padding = "10px";
                    btn.style.fontSize = "14px"; 
                    btn.style.justifyContent = "center";
                    btn.innerHTML = `<b>${s.name}</b>`;
                    btn.onclick = () => requestChangeSize(s.w, s.h, s.name, s.mode || 'standard');
                    panel.appendChild(btn);
                });
            }
        };
    }

    // 캔버스 회전 로직
    // 캔버스 회전 로직
    let btnRotate = document.getElementById("btnRotateCanvas");
    if (btnRotate) {
        // ★ [핵심 수정] 버튼을 복제하여 교체 (기존에 잘못 연결된 객체 회전 이벤트를 제거함)
        const newBtn = btnRotate.cloneNode(true);
        btnRotate.parentNode.replaceChild(newBtn, btnRotate);
        btnRotate = newBtn; // 새 버튼으로 변수 갱신

        btnRotate.onclick = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            if (!board) return;
            
            // 현재 너비와 높이를 서로 바꿔서(Swap) 적용 -> 90도 회전 효과
            applySize(board.height, board.width, "Rotated", 'standard', 'resize');
            
            // 사이즈 입력창 숫자도 반대로 변경
            const inputW = document.getElementById("inputUserW");
            const inputH = document.getElementById("inputUserH");
            if(inputW && inputH) {
                const temp = inputW.value;
                inputW.value = inputH.value;
                inputH.value = temp;
            }
        };
    }
}

// -----------------------------------------------------------------
// 기존 함수들
// -----------------------------------------------------------------

function requestChangeSize(w, h, name, mode) {
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    if (objects.length === 0) {
        applySize(w, h, name, mode, 'replace');
    } else {
        const modal = document.getElementById("loadModeModal");
        if(modal) {
            modal.style.display = "flex";
            document.getElementById("btnLoadReplace").onclick = () => {
                applySize(pendingSize.w, pendingSize.h, pendingSize.name, pendingSize.mode, 'replace');
                modal.style.display = 'none';
            };
            document.getElementById("btnLoadAdd").onclick = () => {
                applySize(pendingSize.w, pendingSize.h, pendingSize.name, pendingSize.mode, 'resize');
                modal.style.display = 'none';
            };
        } else {
            applySize(w, h, name, mode, 'resize');
        }
    }
}

function renderSizeButtons(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'size-card';
        div.innerHTML = `
            <div style="font-size:24px; margin-bottom:10px; color:#6366f1;"><i class="fa-regular fa-file"></i></div>
            <div style="font-weight:bold; font-size:14px;">${item.name}</div>
            <div style="font-size:11px; color:#888; margin-top:5px;">${item.w} x ${item.h}</div>
        `;
        div.onclick = () => openProductDetail(item.key, item.w, item.h, item.mode || 'standard');
        container.appendChild(div);
    });
}

// =================================================================
// ★ [핵심] 대지 생성 함수 (기존 로직 유지)
// =================================================================
export function applySize(w, h, name, mode, action) {
    setBaseSize(w, h);
    setGlobalMode(mode);
    setGlobalSizeName(name);

    let objectsToKeep = [];
    if (action === 'resize') {
        objectsToKeep = canvas.getObjects().filter(o => !o.isBoard);
        objectsToKeep.forEach(o => canvas.remove(o));
    } 

    canvas.clear(); 
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // 여기서 생성되는 Rect가 실제 대지(Board) 크기입니다.
    // 사용자가 입력한 w, h가 그대로 width, height로 적용되므로,
    // 관리자 페이지 계산 방식과 동일한 단위(mm 등)를 사용한다면 정확히 반영됩니다.
    const board = new fabric.Rect({
        width: w, height: h, fill: 'white', left: 0, top: 0,
        selectable: false, evented: false, isBoard: true, 
        shadow: { color: 'rgba(0,0,0,0.05)', blur: 20, offsetX: 0, offsetY: 10 }
    });
    canvas.add(board);
    canvas.sendToBack(board);
    
    // 클립 경로 설정 (대지 밖으로 나가는 요소 안 보이게 처리)
    canvas.clipPath = new fabric.Rect({ left: 0, top: 0, width: w, height: h, absolutePositioned: true });

    if (action === 'resize' && objectsToKeep.length > 0) {
        objectsToKeep.forEach(obj => {
            canvas.add(obj); 
            obj.setCoords(); 
        });
        canvas.discardActiveObject();
    }

    const wallControls = document.getElementById("wallHeightControls");
    if (mode === 'wall') {
        if(wallControls) wallControls.style.display = 'flex';
        setGuideOn(true);
        drawGuides();
    } else {
        if(wallControls) wallControls.style.display = 'none';
        setGuideOn(false);
    }
    
    // maxLimitMM 값은 초기 제품 선택 시 설정된 최대값 유지 (비율 계산 등을 위해 필요한 경우)
    if (!maxLimitMM.w) {
        maxLimitMM.w = w;
        maxLimitMM.h = h;
    }

    setTimeout(() => {
        resizeCanvasToFit();
    }, 50);

    // 3D 미리보기 자동 갱신
    window.dispatchEvent(new CustomEvent('wallSizeChanged', { detail: { w, h, mode } }));
}

export function resizeCanvasToFit() {
    const stage = document.querySelector('.stage');
    if (!stage) return;

    canvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
    
    const board = canvas.getObjects().find(o => o.isBoard);
    if(!board) return;

    const padding = 60; 
    const availW = stage.clientWidth - padding;
    const availH = stage.clientHeight - padding;

    const zoom = Math.min(availW / board.width, availH / board.height);
    
    const panX = (stage.clientWidth - board.width * zoom) / 2;
    const panY = (stage.clientHeight - board.height * zoom) / 2;

    canvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
    canvas.requestRenderAll();
}

window.setWallHeight = (h, btn) => {
    const board = canvas.getObjects().find(o => o.isBoard);
    if(board) applySize(board.width, h, "Custom Wall", 'wall', 'resize'); 
    document.querySelectorAll('.height-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};