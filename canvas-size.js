// canvas-size.js
import { canvas, setBaseSize, setGlobalMode, setGlobalSizeName, setGuideOn } from "./canvas-core.js";
import { drawGuides } from "./canvas-guides.js";
import { openProductDetail } from "./order.js";

let pendingSize = null;

export function initSizeControls() {
    // ==============================
    // 1. 제품 데이터 정의 (config.js와 키값 매칭)
    // ==============================
    
    // 기본 판형
    const sizesStandard = [
        { name: 'A4', w: 595, h: 842, key: 'A4' },
        { name: 'A3', w: 842, h: 1191, key: 'A3' },
        { name: 'A2', w: 1191, h: 1684, key: 'A2' },
        { name: 'A1', w: 1684, h: 2384, key: 'A1' },
        { name: '1200x600', w: 3401, h: 1700, key: 'Std_1200_600' }, 
        { name: '2400x1200', w: 6803, h: 3401, key: 'Std_2400_1200' }
    ];

    // 전시 가벽 (mm 단위 사용)
    const sizesWall = [
        { name: '1칸 가벽', w: 1200, h: 2200, mode: 'wall', key: 'Wall_1' },
        { name: '2칸 가벽', w: 2200, h: 2200, mode: 'wall', key: 'Wall_2' },
        { name: '3칸 가벽', w: 3200, h: 2200, mode: 'wall', key: 'Wall_3' },
        { name: '4칸 가벽', w: 4200, h: 2200, mode: 'wall', key: 'Wall_4' },
        { name: '5칸 가벽', w: 5200, h: 2200, mode: 'wall', key: 'Wall_5' },
    ];

    // 굿즈 & 디스플레이
    const sizesGoods = [
        { name: 'X배너', w: 600, h: 1800, key: 'Banner_X' },
        { name: '시상보드', w: 800, h: 570, key: 'Award_Board' },
        { name: '글씨포토존', w: 2400, h: 1200, key: 'PhotoZone_Text' },
        { name: '대폭원단', w: 1350, h: 900, key: 'Fabric_Wide' },
        { name: '종이진열대', w: 585, h: 1130, key: 'Paper_Disp_4' }
    ];

    // 2. 시작 화면에 버튼 렌더링
    renderSizeButtons('row1', sizesStandard);
    renderSizeButtons('row2', sizesWall);
    renderSizeButtons('row3', sizesGoods);

    // 3. 에디터 내부 "사이즈 변경" 패널 로직
    const btnChange = document.getElementById("btnChangeSize");
    const panel = document.getElementById("sizeTogglePanel");
    
    if (btnChange && panel) {
        // ★ HTML에서 grid-template-columns: 1fr로 설정했으므로, JS에서는 display 속성만 제어
        btnChange.onclick = () => {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'grid' : 'none';
            
            // 패널이 처음 열릴 때만 버튼 생성 (중복 방지)
            if(isHidden && panel.innerHTML === '') {
                
                // (1) 커스텀 사이즈 입력 영역
                const customRow = document.createElement("div");
                customRow.className = "custom-size-row";
                // 1칸 배치에서도 가득 차게 설정
                customRow.style.gridColumn = "1 / -1"; 
                
                customRow.innerHTML = `
                    <input id="customW" class="custom-size-input" type="number" placeholder="가로(mm)">
                    <input id="customH" class="custom-size-input" type="number" placeholder="세로(mm)">
                    <button id="btnApplyCustom" class="custom-size-btn">적용</button>
                `;
                panel.appendChild(customRow);

                // 커스텀 적용 이벤트
                setTimeout(() => {
                    const btnApply = document.getElementById("btnApplyCustom");
                    const inputW = document.getElementById("customW");
                    const inputH = document.getElementById("customH");
                    
                    if(btnApply) {
                        btnApply.onclick = () => {
                            const w_mm = parseInt(inputW.value);
                            const h_mm = parseInt(inputH.value);
                            
                            if(!w_mm || !h_mm || w_mm <= 0 || h_mm <= 0) {
                                return alert("유효한 사이즈를 입력해주세요.");
                            }

                            // mm -> px 변환 (72dpi 기준)
                            const scaleFactor = 2.8333;
                            const finalW = Math.round(w_mm * scaleFactor);
                            const finalH = Math.round(h_mm * scaleFactor);

                            requestChangeSize(finalW, finalH, `사용자 지정`, 'custom');
                        };
                    }
                }, 100);

                // (2) 프리셋 버튼 생성 (★ 수정된 부분: 텍스트 간소화)
                [...sizesStandard, ...sizesWall, ...sizesGoods].forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-round';
                    // 버튼 스타일 조정
                    btn.style.padding = "10px";
                    btn.style.fontSize = "14px"; 
                    btn.style.justifyContent = "center"; // 가운데 정렬
                    
                    // ★ 상세 사이즈 텍스트 제거하고 이름만 표시
                    btn.innerHTML = `<b>${s.name}</b>`;
                    
                    btn.onclick = () => requestChangeSize(s.w, s.h, s.name, s.mode || 'standard');
                    panel.appendChild(btn);
                });
            }
        };
    }

    // 4. 캔버스 회전 로직
    const btnRotate = document.getElementById("btnRotateCanvas");
    if (btnRotate) {
        btnRotate.onclick = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            if (!board) return;
            // 가로/세로 교환
            applySize(board.height, board.width, "Rotated", 'standard', 'resize');
        };
    }
}

// 사이즈 변경 요청 (기존 작업물이 있으면 모달 띄움)
function requestChangeSize(w, h, name, mode) {
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    if (objects.length === 0) {
        applySize(w, h, name, mode, 'replace');
    } else {
        pendingSize = { w, h, name, mode };
        document.getElementById("loadModeModal").style.display = "flex";
        
        document.getElementById("btnLoadReplace").onclick = () => {
            applySize(pendingSize.w, pendingSize.h, pendingSize.name, pendingSize.mode, 'replace');
            document.getElementById("loadModeModal").style.display = 'none';
        };
        document.getElementById("btnLoadAdd").onclick = () => {
            applySize(pendingSize.w, pendingSize.h, pendingSize.name, pendingSize.mode, 'resize');
            document.getElementById("loadModeModal").style.display = 'none';
        };
    }
    // 선택 후 패널 닫기
    const panel = document.getElementById("sizeTogglePanel");
    if(panel) panel.style.display = 'none';
}

// 시작 화면 버튼 렌더링 (★ 모든 모드에 대해 openProductDetail 호출)
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
        // ★ 질문 창(Product Detail Modal) 열기 - DB에 있는 정보 사용
        div.onclick = () => openProductDetail(item.key, item.w, item.h, item.mode || 'standard');
        container.appendChild(div);
    });
}

// 실제 캔버스 크기 적용 함수
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

    // 흰색 배경(보드) 생성
    const board = new fabric.Rect({
        width: w, height: h, fill: 'white', left: 0, top: 0,
        selectable: false, evented: false, isBoard: true, 
        shadow: { color: 'rgba(0,0,0,0.05)', blur: 20, offsetX: 0, offsetY: 10 }
    });
    canvas.add(board);
    canvas.sendToBack(board);

    // 클리핑 마스크
    canvas.clipPath = new fabric.Rect({ left: 0, top: 0, width: w, height: h, absolutePositioned: true });

    // 기존 오브젝트 복원
    if (action === 'resize' && objectsToKeep.length > 0) {
        const group = new fabric.Group(objectsToKeep);
        group.set({ left: w/2, top: h/2, originX: 'center', originY: 'center' });
        canvas.add(group);
        group.toActiveSelection();
        canvas.discardActiveObject();
    }

    // 가벽 모드일 때 컨트롤러 표시
    const wallControls = document.getElementById("wallHeightControls");
    if (mode === 'wall') {
        if(wallControls) wallControls.style.display = 'flex';
        setGuideOn(true);
        drawGuides();
    } else {
        if(wallControls) wallControls.style.display = 'none';
        setGuideOn(false);
    }
    
    // 화면에 딱 맞게 줌 조절
    setTimeout(() => {
        resizeCanvasToFit();
    }, 50);
}

// 캔버스 줌 자동 맞춤
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

// 가벽 높이 조절 함수 (window 전역 노출)
window.setWallHeight = (h, btn) => {
    const board = canvas.getObjects().find(o => o.isBoard);
    if(board) applySize(board.width, h, "Custom Wall", 'wall', 'resize'); 
    document.querySelectorAll('.height-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};