// canvas-size.js
// [수정] currentMode 추가 import (현재 작업 모드 'standard'/'wall' 유지를 위해)
import { canvas, setBaseSize, setGlobalMode, setGlobalSizeName, setGuideOn, maxLimitMM, currentMode } from "./canvas-core.js?v=279";
import { drawGuides } from "./canvas-guides.js?v=279";
import { openProductDetail } from "./order.js?v=279";

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
            if (window.__fixedSizeProduct) {
                showToast(window.t('msg_fixed_size', "This product has a fixed canvas size."), "warn"); return;
            }
            let reqW = parseInt(inputW.value); // mm 단위
            let reqH = parseInt(inputH.value); // mm 단위

            if (!reqW || !reqH || reqW <= 0 || reqH <= 0) {
                showToast(window.t('msg_invalid_number', "Please enter a valid number."), "warn"); return;
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
                showToast(msg, "warn"); return;
            }

            // 회전 자동 적용 (가로/세로 교차 허용)
            if (!isFitNormal && isFitRotated) {
                const temp = reqW;
                reqW = reqH;
                reqH = temp;
                showToast(window.t('msg_size_rotated', "The dimensions were rotated to fit the canvas."), "info");
                
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
            if (window.__fixedSizeProduct) {
                showToast(window.t('msg_fixed_size', "This product has a fixed canvas size."), "warn"); return;
            }
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
    if (window.__fixedSizeProduct) {
        showToast(window.t('msg_fixed_size', "This product has a fixed canvas size."), "warn"); return;
    }
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
    const canvas = window.canvas; if (!canvas) { console.error('applySize: canvas not ready'); return; }
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

    if (mode === 'wall') {
        setGuideOn(true);
        drawGuides();
    } else {
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
    const c = canvas || window.canvas;
    if (!c || !c.setDimensions) return;

    c.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });

    const board = c.getObjects().find(o => o.isBoard);
    if(!board) return;

    const padding = 160;
    const availW = stage.clientWidth - padding;
    const availH = stage.clientHeight - padding;

    const zoom = Math.min(availW / board.width, availH / board.height);

    const panX = (stage.clientWidth - board.width * zoom) / 2;
    const panY = (stage.clientHeight - board.height * zoom) / 2;

    c.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
    c.requestRenderAll();
}

// =================================================================
// ★ 가벽 구성 시스템 v2 — 벽별 개별 크기
// =================================================================

window.__wallConfig = {
    doubleSided: false,
    walls: [{ widthMM: 2000, heightMM: 2200 }],
    activeIndex: 0,
    pricePerSqm: 0,
    totalPrice: 0
};

const WALL_WIDTHS = [1000, 2000, 3000, 4000, 5000];
const WALL_HEIGHTS = [2000, 2200, 2400, 3000];

// m² 단가 도출
function deriveWallPricePerSqm() {
    const db = window.PRODUCT_DB;
    if (!db) return 60000;
    const key = window.currentProductKey;
    if (key && db[key]) {
        const p = db[key];
        if (p._base_sqm_price && p._base_sqm_price > 0) return p._base_sqm_price;
    }
    const wall1 = db['Wall_1'];
    if (wall1) {
        const origPrice = wall1._base_sqm_price || Number(wall1.price) || 0;
        if (origPrice > 0) return origPrice;
    }
    return 60000;
}

// 전체 가격 재계산
function calcWallTotalPrice() {
    const cfg = window.__wallConfig;
    if (!cfg.pricePerSqm) cfg.pricePerSqm = deriveWallPricePerSqm();
    const sides = cfg.doubleSided ? 2 : 1;
    let total = 0;
    cfg.walls.forEach(w => {
        const area = (w.widthMM / 1000) * (w.heightMM / 1000);
        total += area * cfg.pricePerSqm * sides;
    });
    cfg.totalPrice = Math.round(total / 10) * 10;
    window.__wallCalculatedPrice = cfg.totalPrice;
    return cfg.totalPrice;
}

const MM_TO_PX = 3.7795;

// 활성 벽 캔버스 적용 (크기만, 페이지 재생성 안함)
function applyActiveWallToCanvas() {
    const cfg = window.__wallConfig;
    const wall = cfg.walls[cfg.activeIndex];
    if (!wall) return;
    applySize(Math.round(wall.widthMM * MM_TO_PX), Math.round(wall.heightMM * MM_TO_PX), 'WallCustom', 'wall', 'resize');
}

// 전체 페이지 재생성 (벽별 다른 크기)
function rebuildAllWallPages() {
    const cfg = window.__wallConfig;
    // window에 직접 노출된 함수 사용 (동적 import 모듈 인스턴스 불일치 방지)
    if (window.initWallPagesMulti) {
        window.initWallPagesMulti(cfg.walls, cfg.doubleSided, cfg.activeIndex);
    }
}

// --- UI 렌더링 ---
function renderWallConfigUI() {
    const cfg = window.__wallConfig;
    const container = document.getElementById('wallListContainer');
    if (!container) return;

    // ★ 먼저 pricePerSqm 확정 (row 가격 계산 전에 호출해야 $0 방지)
    calcWallTotalPrice();

    container.innerHTML = '';
    const fmt = window.formatCurrency || (v => v.toLocaleString() + '원');
    const sides = cfg.doubleSided ? 2 : 1;
    // US 여부: SITE_CONFIG.COUNTRY 직접 확인 (window._isUSsite 타이밍 이슈 방지)
    const _isUS = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY === 'US') ||
                  window.location.hostname.includes('cafe3355');

    cfg.walls.forEach((wall, i) => {
        const isActive = i === cfg.activeIndex;
        const area = (wall.widthMM / 1000) * (wall.heightMM / 1000);
        const price = Math.round(area * cfg.pricePerSqm * sides / 10) * 10;

        const row = document.createElement('div');
        row.className = 'wl-row' + (isActive ? ' active' : '');
        row.onclick = (e) => { if (!e.target.closest('select') && !e.target.closest('.wl-del')) window.selectWall(i); };

        // 번호
        const num = document.createElement('span');
        num.className = 'wl-num';
        num.textContent = (i + 1);
        row.appendChild(num);

        // 너비 select
        const wSel = document.createElement('select');
        wSel.className = 'wl-sel';
        WALL_WIDTHS.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w; opt.textContent = _isUS ? (w/304.8).toFixed(1)+' ft' : (w / 1000) + 'm';
            if (w === wall.widthMM) opt.selected = true;
            wSel.appendChild(opt);
        });
        wSel.onchange = () => { window.setWallDim(i, 'w', parseInt(wSel.value)); };
        row.appendChild(wSel);

        const x = document.createElement('span');
        x.className = 'wl-x'; x.textContent = '×';
        row.appendChild(x);

        // 높이 select
        const hSel = document.createElement('select');
        hSel.className = 'wl-sel';
        WALL_HEIGHTS.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; opt.textContent = _isUS ? (h/304.8).toFixed(1)+' ft' : (h / 10) + 'cm';
            if (h === wall.heightMM) opt.selected = true;
            hSel.appendChild(opt);
        });
        hSel.onchange = () => { window.setWallDim(i, 'h', parseInt(hSel.value)); };
        row.appendChild(hSel);

        // 가격
        const priceSpan = document.createElement('span');
        priceSpan.className = 'wl-price';
        priceSpan.textContent = fmt(price);
        row.appendChild(priceSpan);

        // 삭제
        if (cfg.walls.length > 1) {
            const del = document.createElement('button');
            del.className = 'wl-del';
            del.innerHTML = '×';
            del.onclick = (e) => { e.stopPropagation(); window.removeWall(i); };
            row.appendChild(del);
        }

        container.appendChild(row);
    });

    // 합계 (이미 함수 시작 시 calcWallTotalPrice() 호출됨)
    const totalEl = document.getElementById('wallTotalPrice');
    if (totalEl) totalEl.textContent = fmt(cfg.totalPrice);

    // 단면/양면 active
    const btnS = document.getElementById('btnWallSingle');
    const btnD = document.getElementById('btnWallDouble');
    if (btnS) btnS.classList.toggle('active', !cfg.doubleSided);
    if (btnD) btnD.classList.toggle('active', cfg.doubleSided);

    // wallFaceTabs: 양면이거나 벽이 2개 이상이면 표시
    const wallFaceTabs = document.getElementById('wallFaceTabs');
    if (wallFaceTabs) {
        const showTabs = cfg.doubleSided || cfg.walls.length > 1;
        wallFaceTabs.style.display = showTabs ? 'flex' : 'none';
    }
}

// --- 벽 선택 ---
window.selectWall = (index) => {
    const cfg = window.__wallConfig;
    if (index < 0 || index >= cfg.walls.length) return;
    // 현재 페이지 저장
    if (window.savePageState) window.savePageState();
    cfg.activeIndex = index;
    // 캔버스를 이 벽 크기로 변경 (mm → px 변환)
    const wall = cfg.walls[index];
    applySize(Math.round(wall.widthMM * MM_TO_PX), Math.round(wall.heightMM * MM_TO_PX), 'WallCustom', 'wall', 'resize');
    // 해당 벽의 페이지로 이동
    const pagesPerWall = cfg.doubleSided ? 2 : 1;
    const pageIndex = index * pagesPerWall;
    if (window.switchWallFace) window.switchWallFace(index, 0);
    renderWallConfigUI();
};

// --- 벽 크기 변경 ---
window.setWallDim = (index, dim, value) => {
    const cfg = window.__wallConfig;
    const wall = cfg.walls[index];
    if (!wall) return;
    if (dim === 'w') wall.widthMM = value;
    else wall.heightMM = value;
    // 전체 페이지 재생성 (크기가 바뀌었으므로)
    rebuildAllWallPages();
    renderWallConfigUI();
};

// --- 벽 추가 ---
window.addWall = () => {
    const cfg = window.__wallConfig;
    if (cfg.walls.length >= 10) return;
    cfg.walls.push({ widthMM: 2000, heightMM: 2200 });
    rebuildAllWallPages();
    renderWallConfigUI();
};

// --- 벽 삭제 ---
window.removeWall = (index) => {
    const cfg = window.__wallConfig;
    if (cfg.walls.length <= 1) return;
    cfg.walls.splice(index, 1);
    if (cfg.activeIndex >= cfg.walls.length) cfg.activeIndex = cfg.walls.length - 1;
    rebuildAllWallPages();
    renderWallConfigUI();
};

// --- 단면/양면 ---
window.setWallSided = (doubleSided) => {
    window.__wallConfig.doubleSided = doubleSided;
    rebuildAllWallPages();
    renderWallConfigUI();
};

// --- 초기화 ---
window.initWallConfig = () => {
    const cfg = window.__wallConfig;
    cfg.pricePerSqm = deriveWallPricePerSqm();
    rebuildAllWallPages();
    renderWallConfigUI();
};

// --- 모달 열기/닫기 ---
window.openWallConfig = () => {
    renderWallConfigUI();
    const overlay = document.getElementById('wallConfigOverlay');
    if (overlay) overlay.style.display = 'flex';
};
window.closeWallConfig = () => {
    const overlay = document.getElementById('wallConfigOverlay');
    if (overlay) overlay.style.display = 'none';
    // ★ 첫 진입 시 가벽 설정 후 디자인 마법사 자동 오픈
    if (window.__wallConfigFirstOpen && window.openDesignWizard) {
        window.__wallConfigFirstOpen = false;
        setTimeout(() => window.openDesignWizard(), 500);
    }
};

// 하위 호환 (높이 단독 변경 - 사용 안 하지만 안전)
window.setWallHeight = (h) => {};
window.setWallSections = () => {};
window.setWallCount = () => {};