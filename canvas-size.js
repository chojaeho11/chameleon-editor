// canvas-size.js
import { canvas, setBaseSize, setGlobalMode, setGlobalSizeName, setGuideOn, maxLimitMM } from "./canvas-core.js";
import { drawGuides } from "./canvas-guides.js";
import { openProductDetail } from "./order.js";

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
        { name: '1칸 가벽', w: 1200, h: 2200, mode: 'wall', key: 'Wall_1' },
        { name: '2칸 가벽', w: 2200, h: 2200, mode: 'wall', key: 'Wall_2' },
        { name: '3칸 가벽', w: 3200, h: 2200, mode: 'wall', key: 'Wall_3' },
        { name: '4칸 가벽', w: 4200, h: 2200, mode: 'wall', key: 'Wall_4' },
        { name: '5칸 가벽', w: 5200, h: 2200, mode: 'wall', key: 'Wall_5' },
    ];

    const sizesGoods = [
        { name: 'X배너', w: 600, h: 1800, key: 'Banner_X' },
        { name: '시상보드', w: 800, h: 570, key: 'Award_Board' },
        { name: '글씨포토존', w: 2400, h: 1200, key: 'PhotoZone_Text' },
        { name: '대폭원단', w: 1350, h: 900, key: 'Fabric_Wide' },
        { name: '종이진열대', w: 585, h: 1130, key: 'Paper_Disp_4' }
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
                return alert("유효한 숫자를 입력해주세요.");
            }

            // 최대 크기(현재 대지 크기) 체크
            const limitW = maxLimitMM.w || 99999;
            const limitH = maxLimitMM.h || 99999;

            const isFitNormal = (reqW <= limitW && reqH <= limitH);
            const isFitRotated = (reqW <= limitH && reqH <= limitW);

            if (!isFitNormal && !isFitRotated) {
                return alert(
                    `설정된 최대 크기(${limitW}x${limitH}mm)를 초과할 수 없습니다.\n` +
                    `현재 대지 크기 안에서만 설정 가능합니다.`
                );
            }

            // 회전 자동 적용
            if (!isFitNormal && isFitRotated) {
                const temp = reqW;
                reqW = reqH;
                reqH = temp;
                alert("입력하신 크기가 대지에 맞지 않아 가로/세로를 회전하여 적용합니다.");
            }

            // ★ 커팅라인 추가 (기존 선 삭제 안함, 계속 추가됨)
            drawUserCutLine(reqW, reqH);
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
    const btnRotate = document.getElementById("btnRotateCanvas");
    if (btnRotate) {
        btnRotate.onclick = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            if (!board) return;
            applySize(board.height, board.width, "Rotated", 'standard', 'resize');
            
            if(inputW && inputH) {
                const temp = inputW.value;
                inputW.value = inputH.value;
                inputH.value = temp;
            }
        };
    }
}

// =================================================================
// ★ [수정됨] 사용자 정의 재단선 그리기 (요청 문구 적용)
// =================================================================
function drawUserCutLine(w_mm, h_mm) {
    if (!canvas) return;

    // 1. 현재 대지(Board) 정보 가져오기
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return alert("대지(Board)를 찾을 수 없습니다.");

    // 2. 비율 계산 (DPI 보정)
    const realBoardW_mm = maxLimitMM.w || w_mm; 
    const currentBoardPixelW = board.getScaledWidth();
    const pxPerMM = currentBoardPixelW / realBoardW_mm;

    // 3. 픽셀 변환
    const reqW_px = w_mm * pxPerMM;
    const reqH_px = h_mm * pxPerMM;
    
    // 4. 빨간색 재단선 사각형 생성
    const cutRect = new fabric.Rect({
        left: board.left, // 여백 없이 (0,0)
        top: board.top,
        width: reqW_px,
        height: reqH_px,
        fill: 'transparent',
        stroke: 'red',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: true, // 이동 가능
        evented: true,    
        hasControls: true, 
        isUserCutLine: true
    });

    // 5. ★ [수정] 요청하신 텍스트 내용 적용
    const textContent = `${w_mm}x${h_mm}mm_ 남는 공간에는 다른 제품을 추가로 제작하실 수 있습니다.\n모양재단 재봉 같은 마감이 있다면 장바구니에서 마감 비용만 추가해 주세요.\n사각재단은 여러개 해도 무료이니 비용을 아껴보아요.\n좌측상단 사이즈변경을 또 누르시면 칼선이 나옵니다. 이 메모는 지워도 됩니다.`;

    const infoText = new fabric.Text(textContent, {
        left: board.left,
        top: board.top + reqH_px + 5, // 사각형 바로 아래
        fontSize: 12, // 문구가 길어서 폰트 사이즈 살짝 조정
        fontFamily: 'Nanum Gothic',
        fill: '#ef4444', // 빨간색
        lineHeight: 1.2,
        selectable: true, // 텍스트도 이동 가능
        evented: true,
        isUserCutText: true
    });

    // 6. 캔버스 추가
    canvas.add(cutRect);
    canvas.add(infoText);
    
    // 추가된 객체 활성화 (바로 이동 가능하도록)
    canvas.setActiveObject(cutRect);

    canvas.bringToFront(cutRect);
    canvas.bringToFront(infoText);
    
    canvas.requestRenderAll();
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
// ★ [수정됨] 대지 생성 (기본 커팅라인 자동 생성 로직 삭제)
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

    const board = new fabric.Rect({
        width: w, height: h, fill: 'white', left: 0, top: 0,
        selectable: false, evented: false, isBoard: true, 
        shadow: { color: 'rgba(0,0,0,0.05)', blur: 20, offsetX: 0, offsetY: 10 }
    });
    canvas.add(board);
    canvas.sendToBack(board);
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
    
    // ★ [삭제됨] 아래 로직 삭제: 대지 생성 시 자동으로 커팅라인을 만들지 않음
    // if (!maxLimitMM.w) { maxLimitMM.w = w; maxLimitMM.h = h; }
    // setTimeout(() => { ... drawUserCutLine ... }, 100);

    // 대신 maxLimitMM 값만 세팅 (비율 계산용)
    if (!maxLimitMM.w) {
        maxLimitMM.w = w;
        maxLimitMM.h = h;
    }

    setTimeout(() => {
        resizeCanvasToFit();
    }, 50);
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