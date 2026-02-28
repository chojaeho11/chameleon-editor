/* canvas-pages.js */
import { canvas } from "./canvas-core.js?v=123";
import { applySize, resizeCanvasToFit } from "./canvas-size.js?v=123";
import { calculateBoxPrice } from "./box-nesting.js?v=123";

// 페이지 데이터를 저장할 배열
export let pageDataList = [];
export let currentPageIndex = 0;

// [1] 초기화
export function initPageTools() {
    // 초기 페이지 데이터 저장 (현재 빈 캔버스 상태)
    saveCurrentPageState();
    updatePageCounter();

    // 배경색 버튼 이벤트 연결
    const btnBgColor = document.getElementById('btnBgColor');
    if(btnBgColor) {
        btnBgColor.onclick = () => {
            const panel = document.getElementById('bgColorPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    // 배경색 팔레트 생성
    renderColorPalette();
}

// 위저드 배경 레이어 제거 (보드 위의 그라데이션 Rect)
function _removeWizardBg() {
    if (!canvas) return;
    const wzBgs = canvas.getObjects().filter(o => o.isTemplateBackground);
    wzBgs.forEach(o => canvas.remove(o));
}

// [2] 배경색 변경 로직 (단색 + 그라데이션 지원)
export function setBoardColor(color) {
    if (!canvas) return;
    _removeWizardBg();

    const board = canvas.getObjects().find(o => o.isBoard);
    if (board) {
        board.set('fill', color);
        canvas.requestRenderAll();
        saveCurrentPageState();
    } else {
        canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    }
}

// 그라데이션 배경 설정
export function setBoardGradient(color1, color2) {
    if (!canvas) return;
    _removeWizardBg();

    const board = canvas.getObjects().find(o => o.isBoard);
    if (board) {
        const grad = new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: board.width, y2: board.height },
            colorStops: [
                { offset: 0, color: color1 },
                { offset: 1, color: color2 }
            ]
        });
        board.set('fill', grad);
        canvas.requestRenderAll();
        saveCurrentPageState();
    }
}

function renderColorPalette() {
    const paletteContainer = document.getElementById('colorPaletteGrid');
    if(!paletteContainer) return;

    // 기본 단색 팔레트
    const colors = [
        '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#212529', '#000000',
        '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fffffc',
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50'
    ];

    // 그라데이션 팔레트 (테마 색상)
    const gradients = [
        ['#667eea','#764ba2'], ['#f6d365','#fda085'], ['#ff9a9e','#fad0c4'], ['#0f0c29','#302b63'],
        ['#11998e','#38ef7d'], ['#a18cd1','#fbc2eb'], ['#ff6b6b','#feca57'], ['#e0eafc','#cfdef3'],
        ['#4a00e0','#8e2de2'], ['#f12711','#f5af19'], ['#0f2027','#203a43'], ['#0f0f0f','#2c2c2c']
    ];

    paletteContainer.innerHTML = '';

    // ★ 팔레트 클릭 시 Fabric이 먼저 deselect하므로 마지막 선택 객체 캐시
    let _lastActiveObj = null;
    let _clearTimer = null;
    if (canvas) {
        canvas.on('selection:created', (e) => {
            clearTimeout(_clearTimer);
            _lastActiveObj = e.selected?.[0] || canvas.getActiveObject();
        });
        canvas.on('selection:updated', (e) => {
            clearTimeout(_clearTimer);
            _lastActiveObj = e.selected?.[0] || canvas.getActiveObject();
        });
        canvas.on('selection:cleared', () => {
            // 300ms 후 캐시 리셋 (팔레트 클릭은 그 사이에 발생)
            _clearTimer = setTimeout(() => { _lastActiveObj = null; }, 300);
        });
    }

    // 팔레트 색상 적용: 선택된 객체가 있으면 fill, 없으면 배경
    function _getActiveObj() {
        const cur = canvas && canvas.getActiveObject();
        if (cur && !cur.isBoard && !cur.isTemplateBackground) return cur;
        if (_lastActiveObj && !_lastActiveObj.isBoard && !_lastActiveObj.isTemplateBackground) return _lastActiveObj;
        return null;
    }
    function _applyColor(color) {
        const obj = _getActiveObj();
        if (obj) {
            if (obj.type === 'activeSelection') obj.forEachObject(o => o.set('fill', color));
            else obj.set('fill', color);
            canvas.requestRenderAll();
            try { canvas.setActiveObject(obj); } catch(e) {}
        } else {
            setBoardColor(color);
        }
    }
    function _applyGrad(c1, c2) {
        const obj = _getActiveObj();
        if (obj) {
            const grad = new fabric.Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: obj.width || 100, y2: obj.height || 100 },
                colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]
            });
            if (obj.type === 'activeSelection') obj.forEachObject(o => o.set('fill', grad));
            else obj.set('fill', grad);
            canvas.requestRenderAll();
            try { canvas.setActiveObject(obj); } catch(e) {}
        } else {
            setBoardGradient(c1, c2);
        }
    }

    // 컬러피커 (사용자 지정)
    const pickerLabel = document.createElement('label');
    pickerLabel.className = 'color-swatch picker';
    pickerLabel.innerHTML = '<i class="fa-solid fa-plus"></i><input type="color" id="customBgPicker" style="opacity:0; width:0; height:0;">';
    pickerLabel.onchange = (e) => _applyColor(e.target.value);
    paletteContainer.appendChild(pickerLabel);

    // 프리셋 단색
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.onclick = () => _applyColor(color);
        paletteContainer.appendChild(swatch);
    });

    // 그라데이션 라벨
    const gradLabel = document.createElement('div');
    gradLabel.style.cssText = 'grid-column:1/-1;font-size:11px;font-weight:bold;color:#666;margin-top:8px;text-align:left;';
    gradLabel.setAttribute('data-i18n', 'editor_gradient_palette');
    gradLabel.textContent = '그라데이션';
    paletteContainer.appendChild(gradLabel);

    // 프리셋 그라데이션
    gradients.forEach(([c1, c2]) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
        swatch.onclick = () => _applyGrad(c1, c2);
        paletteContainer.appendChild(swatch);
    });
}

export function addNewPage() {
    // 1. 현재 상태 저장
    saveCurrentPageState();

    // 2. 새 페이지 생성 (기존 대지 크기 유지)
    const board = canvas.getObjects().find(o => o.isBoard);
    const w = board ? board.width : 1000;
    const h = board ? board.height : 1000;

    // 3. 캔버스 초기화 (새 페이지 준비)
    canvas.clear();
    
    // 4. 대지 재생성
    const newBoard = new fabric.Rect({
        width: w, height: h, fill: 'white', left: 0, top: 0,
        selectable: false, evented: false, isBoard: true
    });
    canvas.add(newBoard);
    canvas.sendToBack(newBoard);
    
    // ★ [수정됨] 화면 맞춤 실행 (기존: 100% 초기화 -> 변경: 화면에 딱 맞게)
    // 렌더링 타이밍 문제 방지를 위해 약간의 딜레이 후 실행
    setTimeout(() => {
        resizeCanvasToFit(); 
    }, 50);

    // 5. 배열에 추가 및 인덱스 이동
    const newJson = canvas.toJSON(['id', 'isBoard', 'selectable', 'evented', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone', 'paintFirst']);
    pageDataList.push(newJson);
    currentPageIndex = pageDataList.length - 1;

    updatePageCounter();
    canvas.requestRenderAll();
}
export function switchPage(direction) {
    const newIndex = currentPageIndex + direction;
    if (newIndex < 0 || newIndex >= pageDataList.length) return;

    // 현재 페이지 저장
    saveCurrentPageState();

    // 페이지 전환
    currentPageIndex = newIndex;
    loadPage(currentPageIndex);
}

// 직접 특정 페이지로 이동 (PPT 썸네일 클릭용)
export function goToPage(index) {
    if (index < 0 || index >= pageDataList.length || index === currentPageIndex) return;
    saveCurrentPageState();
    currentPageIndex = index;
    loadPage(currentPageIndex);
}

export function deleteCurrentPage() {
    // [수정] 다국어 적용
    if (pageDataList.length <= 1) { showToast(window.t('msg_min_page_limit', "At least one page is required."), "warn"); return; }
    
    if(confirm(window.t('confirm_delete', "Are you sure you want to delete?"))) {
        pageDataList.splice(currentPageIndex, 1);
        
        // 인덱스 조정
        if (currentPageIndex >= pageDataList.length) {
            currentPageIndex = pageDataList.length - 1;
        }
        
        loadPage(currentPageIndex);
    }
}

function saveCurrentPageState() {
    if (!canvas) return;
    // 사용자 정의 속성 포함하여 저장
    const json = canvas.toJSON(['id', 'isBoard', 'selectable', 'evented', 'locked', 'isGuide', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone', 'paintFirst']);
    pageDataList[currentPageIndex] = json;
}

function loadPage(index) {
    const json = pageDataList[index];
    if (!json) return;

    canvas.loadFromJSON(json, () => {
        // 로드 후 후처리 (대지 맨 뒤로 등)
        const board = canvas.getObjects().find(o => o.isBoard);
        if(board) canvas.sendToBack(board);
        
        updatePageCounter();
        canvas.requestRenderAll();
    });
}

function updatePageCounter() {
    const counter = document.getElementById('pageCounter');
    if(counter) {
        counter.innerText = `${currentPageIndex + 1} / ${pageDataList.length}`;
    }

    // 버튼 상태 업데이트
    const btnPrev = document.getElementById('btnPagePrev');
    const btnNext = document.getElementById('btnPageNext');
    if(btnPrev) btnPrev.disabled = currentPageIndex === 0;
    if(btnNext) btnNext.disabled = currentPageIndex === pageDataList.length - 1;

    // PPT 사이드바 카운터도 업데이트
    const sideC = document.getElementById('pageCounterSide');
    if(sideC) sideC.textContent = `${currentPageIndex + 1} / ${pageDataList.length}`;
    const sidePrev = document.getElementById('btnPagePrevSide');
    const sideNext = document.getElementById('btnPageNextSide');
    if(sidePrev) sidePrev.disabled = currentPageIndex === 0;
    if(sideNext) sideNext.disabled = currentPageIndex === pageDataList.length - 1;

    // window에 pageDataList 노출 (PPT export용)
    window.__pageDataList = pageDataList;
    window._getPageIndex = () => currentPageIndex;
    window.savePageState = () => saveCurrentPageState();
}

// ─── 박스 모드: 6면 페이지 ───

const CUSTOM_PROPS = ['id', 'isBoard', 'selectable', 'evented', 'locked', 'isGuide', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone', 'paintFirst'];

const BOX_FACE_NAMES = ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'];

export function initBoxPages(wMM, hMM, dMM) {
    const PX = 3.7795; // mm → px
    const faces = [
        { name: 'Front',  w: wMM * PX, h: hMM * PX },
        { name: 'Back',   w: wMM * PX, h: hMM * PX },
        { name: 'Left',   w: dMM * PX, h: hMM * PX },
        { name: 'Right',  w: dMM * PX, h: hMM * PX },
        { name: 'Top',    w: wMM * PX, h: dMM * PX },
        { name: 'Bottom', w: wMM * PX, h: dMM * PX },
    ];

    // 기존 페이지 제거 후 6페이지 생성
    pageDataList = [];
    currentPageIndex = 0;

    faces.forEach((face) => {
        canvas.clear();
        const board = new fabric.Rect({
            width: face.w, height: face.h, fill: 'white',
            left: 0, top: 0, selectable: false, evented: false, isBoard: true
        });
        canvas.add(board);
        canvas.sendToBack(board);
        const json = canvas.toJSON(CUSTOM_PROPS);
        pageDataList.push(json);
    });

    // 첫 페이지(앞면) 로드
    currentPageIndex = 0;
    loadPage(0);
    setTimeout(() => resizeCanvasToFit(), 50);
    updatePageCounter();

    // 탭 active 상태 초기화
    document.querySelectorAll('.box-face-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === 0);
    });
}

// 박스 면 전환
window.switchBoxFace = function(index) {
    if (index < 0 || index >= pageDataList.length) return;
    if (index === currentPageIndex) return;

    saveCurrentPageState();
    currentPageIndex = index;

    // loadFromJSON이 비동기(이미지 포함 시)이므로 콜백 내에서 resizeCanvasToFit 호출
    const json = pageDataList[index];
    if (!json) return;

    canvas.loadFromJSON(json, () => {
        const board = canvas.getObjects().find(o => o.isBoard);
        if (board) canvas.sendToBack(board);
        updatePageCounter();
        canvas.requestRenderAll();
        // 면별 다른 크기 → 로드 완료 후 화면 맞춤
        resizeCanvasToFit();
    });

    // 탭 active 업데이트
    document.querySelectorAll('.box-face-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
};

// ─── 가벽 모드: 양면(앞/뒤) 페이지 ───

const WALL_FACE_NAMES = ['Front', 'Back'];

export function initWallPages(wallCount, widthMM, heightMM) {
    const PX = 3.7795;
    const w = widthMM * PX;
    const h = heightMM * PX;
    const doubleSided = window.__wallConfig?.doubleSided || false;
    const pagesPerWall = doubleSided ? 2 : 1;

    pageDataList = [];
    currentPageIndex = 0;

    for (let wi = 0; wi < wallCount; wi++) {
        // Front face (항상)
        canvas.clear();
        const frontBoard = new fabric.Rect({
            width: w, height: h, fill: 'white',
            left: 0, top: 0, selectable: false, evented: false, isBoard: true
        });
        canvas.add(frontBoard);
        canvas.sendToBack(frontBoard);
        pageDataList.push(canvas.toJSON(CUSTOM_PROPS));

        // Back face (양면만)
        if (doubleSided) {
            canvas.clear();
            const backBoard = new fabric.Rect({
                width: w, height: h, fill: 'white',
                left: 0, top: 0, selectable: false, evented: false, isBoard: true
            });
            canvas.add(backBoard);
            canvas.sendToBack(backBoard);
            pageDataList.push(canvas.toJSON(CUSTOM_PROPS));
        }
    }

    // Load first page (wall 1 front)
    currentPageIndex = 0;
    loadPage(0);
    setTimeout(() => resizeCanvasToFit(), 50);
    updatePageCounter();

    // wallFaceTabs 동적 생성
    buildWallFaceTabsUI(wallCount, doubleSided);

    // Tab active state
    updateWallFaceTabs(0, 0);

    // window 노출
    window.__wallMode = true;
    window.__wallCount = wallCount;
    window.__wallPagesPerWall = pagesPerWall;
}

// wallIndex = 가벽 번호(0-based), faceIndex = 0(앞면) / 1(뒷면)
window.switchWallFace = function (wallIndex, faceIndex) {
    console.log('[WallFace] switch wall=' + wallIndex + ' face=' + faceIndex);
    // window.__pageDataList 우선 사용 (동적 import 모듈 인스턴스 불일치 대비)
    const pages = window.__pageDataList || pageDataList;
    const pagesPerWall = window.__wallPagesPerWall || (window.__wallConfig?.doubleSided ? 2 : 1);
    const pageIndex = wallIndex * pagesPerWall + faceIndex;

    if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn('[WallFace] pageIndex out of range:', pageIndex, '/', pages.length);
        return;
    }

    // __wallConfig 활성 벽 동기화
    if (window.__wallConfig) {
        window.__wallConfig.activeIndex = wallIndex;
    }

    // 같은 페이지면 탭만 갱신
    if (pageIndex === currentPageIndex) {
        updateWallFaceTabs(wallIndex, faceIndex);
        return;
    }

    saveCurrentPageState();
    currentPageIndex = pageIndex;

    const json = pages[pageIndex];
    if (!json) {
        console.warn('[WallFace] no page data at index', pageIndex);
        return;
    }

    // 모듈-레벨 pageDataList도 동기화
    if (pages !== pageDataList) {
        pageDataList = pages;
    }

    canvas.loadFromJSON(json, () => {
        const board = canvas.getObjects().find(o => o.isBoard);
        if (board) {
            canvas.sendToBack(board);
            canvas.clipPath = new fabric.Rect({
                left: 0, top: 0,
                width: board.width, height: board.height,
                absolutePositioned: true
            });
        }
        updatePageCounter();
        canvas.requestRenderAll();
        resizeCanvasToFit();
        console.log('[WallFace] loaded page', pageIndex);
    });

    updateWallFaceTabs(wallIndex, faceIndex);
};

function buildWallFaceTabsUI(wallCount, doubleSided) {
    const container = document.getElementById('wallFaceTabs');
    if (!container) return;

    // 단면 1개 → 탭 불필요
    if (!doubleSided && wallCount <= 1) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    const frontLabel = window.t ? window.t('wall_face_front', '앞면') : '앞면';
    const backLabel = window.t ? window.t('wall_face_back', '뒷면') : '뒷면';

    for (let wi = 0; wi < wallCount; wi++) {
        const prefix = wallCount > 1 ? `${wi + 1}-` : '';
        const wallIdx = wi; // 클로저 안전성
        // Front tab (항상)
        const frontBtn = document.createElement('button');
        frontBtn.className = 'wall-face-tab';
        frontBtn.dataset.wall = wallIdx;
        frontBtn.dataset.face = 0;
        frontBtn.textContent = prefix + frontLabel;
        frontBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('[FaceTab] clicked wall=' + wallIdx + ' face=0');
            window.switchWallFace(wallIdx, 0);
        });
        container.appendChild(frontBtn);

        // Back tab (양면만)
        if (doubleSided) {
            const backBtn = document.createElement('button');
            backBtn.className = 'wall-face-tab';
            backBtn.dataset.wall = wallIdx;
            backBtn.dataset.face = 1;
            backBtn.textContent = prefix + backLabel;
            backBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[FaceTab] clicked wall=' + wallIdx + ' face=1');
                window.switchWallFace(wallIdx, 1);
            });
            container.appendChild(backBtn);
        }
    }
}

function updateWallFaceTabs(activeWall, activeFace) {
    document.querySelectorAll('.wall-face-tab').forEach(tab => {
        const wi = parseInt(tab.dataset.wall || '0');
        const fi = parseInt(tab.dataset.face || '0');
        tab.classList.toggle('active', wi === activeWall && fi === activeFace);
    });
}

// 박스 치수 적용
window.applyBoxDimensions = function() {
    const w = parseInt(document.getElementById('boxW').value);
    const h = parseInt(document.getElementById('boxH').value);
    const d = parseInt(document.getElementById('boxD').value);
    if (!w || !h || !d) { showToast('W, H, D 값을 모두 입력하세요', "warn"); return; }

    // 전역 저장 (3D에서 사용)
    window.__boxDims = { w, h, d };
    initBoxPages(w, h, d);
    updateBoxPrice(w, h, d);
};

// 박스 가격 계산 (시트수 × 장당가격)
function updateBoxPrice(w, h, d) {
    const product = window.PRODUCT_DB && window.PRODUCT_DB[window.currentProductKey];
    if (!product) return;

    const pricePerSheet = product._original_price || product.price || 0;
    const result = calculateBoxPrice(w, h, d, pricePerSheet);

    if (result.error) {
        showToast(window.t('box_too_large', '면이 시트(2400×1200)보다 큽니다'), "warn");
        return;
    }

    // 전역 저장
    window.__boxNesting = result;
    window.__boxCalculatedPrice = result.totalPrice;
    window.__boxSheetCount = result.sheetCount;

    // UI 업데이트
    const sheetEl = document.getElementById('boxSheetCount');
    const priceEl = document.getElementById('boxTotalPrice');
    const displayEl = document.getElementById('boxPriceDisplay');
    const layoutBtn = document.getElementById('btnBoxLayoutPDF');

    if (sheetEl) {
        if (result.setsPerSheet > 1) {
            // 작은 박스: N세트가 시트에 들어감 → "1/3" 등
            sheetEl.textContent = result.sheetCount + '/' + result.setsPerSheet;
        } else {
            sheetEl.textContent = result.sheetCount;
        }
    }
    if (priceEl) {
        priceEl.textContent = window.formatCurrency
            ? window.formatCurrency(result.totalPrice)
            : result.totalPrice.toLocaleString() + '원';
    }
    if (displayEl) displayEl.style.display = 'inline-flex';
    if (layoutBtn) layoutBtn.style.display = 'inline-block';

    // 제품 가격 오버라이드 (장바구니용)
    if (!product._original_price) product._original_price = product.price;
    product.price = result.totalPrice;
    product._calculated_price = true;
    product.is_custom_size = true;
}

// ─── 가벽 멀티월 모드: 벽별 다른 크기 ───

export function initWallPagesMulti(walls, doubleSided, activeIndex) {
    const PX = 3.7795;
    const pagesPerWall = doubleSided ? 2 : 1;

    // 기존 데이터가 있으면 저장해두기 (현재 페이지 상태 보존)
    if (pageDataList.length > 0 && canvas) {
        try { saveCurrentPageState(); } catch(e) {}
    }

    // 기존 페이지 데이터 백업 (크기가 같은 페이지는 유지)
    const oldPages = [...pageDataList];

    pageDataList = [];
    currentPageIndex = 0;

    for (let wi = 0; wi < walls.length; wi++) {
        const wall = walls[wi];
        const w = wall.widthMM * PX;
        const h = wall.heightMM * PX;

        // Front face (항상)
        const oldFrontIdx = wi * pagesPerWall;
        if (oldPages[oldFrontIdx]) {
            // 기존 페이지 있으면 보드 크기만 업데이트
            const json = JSON.parse(JSON.stringify(oldPages[oldFrontIdx]));
            updateBoardInJson(json, w, h);
            pageDataList.push(json);
        } else {
            canvas.clear();
            const board = new fabric.Rect({
                width: w, height: h, fill: 'white',
                left: 0, top: 0, selectable: false, evented: false, isBoard: true
            });
            canvas.add(board);
            canvas.sendToBack(board);
            pageDataList.push(canvas.toJSON(CUSTOM_PROPS));
        }

        // Back face (양면만)
        if (doubleSided) {
            const oldBackIdx = wi * 2 + 1;
            if (oldPages[oldBackIdx]) {
                const json = JSON.parse(JSON.stringify(oldPages[oldBackIdx]));
                updateBoardInJson(json, w, h);
                pageDataList.push(json);
            } else {
                canvas.clear();
                const board = new fabric.Rect({
                    width: w, height: h, fill: 'white',
                    left: 0, top: 0, selectable: false, evented: false, isBoard: true
                });
                canvas.add(board);
                canvas.sendToBack(board);
                pageDataList.push(canvas.toJSON(CUSTOM_PROPS));
            }
        }
    }

    // 활성 벽의 첫 페이지 로드
    const targetPage = Math.min(activeIndex * pagesPerWall, pageDataList.length - 1);
    currentPageIndex = targetPage;
    loadPage(targetPage);
    setTimeout(() => resizeCanvasToFit(), 50);
    updatePageCounter();

    // wallFaceTabs 동적 생성
    buildWallFaceTabsUI(walls.length, doubleSided);
    updateWallFaceTabs(activeIndex, 0);

    // window 노출
    window.__wallMode = true;
    window.__wallCount = walls.length;
    window.__wallPagesPerWall = pagesPerWall;
    window.__pageDataList = pageDataList;
}

// window에 노출 (동적 import 모듈 인스턴스 불일치 방지)
window.initWallPagesMulti = function(walls, doubleSided, activeIndex) {
    return initWallPagesMulti(walls, doubleSided, activeIndex);
};

// JSON 내 board 객체의 크기를 업데이트
function updateBoardInJson(json, w, h) {
    if (!json || !json.objects) return;
    for (const obj of json.objects) {
        if (obj.isBoard) {
            obj.width = w;
            obj.height = h;
            break;
        }
    }
}

// 배치도 PDF 다운로드
window.downloadBoxLayoutPDF = async function() {
    if (!window.__boxNesting || !window.__boxDims) {
        showToast(window.t('box_apply_first', '박스 치수를 먼저 적용하세요'), "warn"); return;
    }

    saveCurrentPageState();

    const btn = document.getElementById('btnBoxLayoutPDF');
    const orig = btn ? btn.innerText : '';
    if (btn) { btn.innerText = '...'; btn.disabled = true; }

    try {
        const { generateBoxLayoutPDF } = await import('./export.js?v=123');
        const blob = await generateBoxLayoutPDF(
            window.__boxNesting.sheets,
            window.__boxDims,
            pageDataList
        );
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `box_layout_${window.__boxDims.w}x${window.__boxDims.h}x${window.__boxDims.d}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.error('Layout PDF error:', e);
        showToast('PDF 생성 실패', "error");
    } finally {
        if (btn) { btn.innerText = orig; btn.disabled = false; }
    }
};

// ─── 종이매대 모드: 3면 페이지 (상단광고, 옆면, 선반) ───

const PD_FACE_NAMES = ['Top Ad', 'Side Panel', 'Shelf', 'Bottom Panel'];

export function initPaperDisplayPages(widthMM, heightMM, adHeightMM, shelfHeightMM, depthMM, bgColor, shelfCount) {
    const PX = 3.7795; // mm → px
    const lipHeightMM = 70; // 선반 앞면 립 높이 7cm
    const bodyHeightMM = heightMM - adHeightMM;
    const sc = shelfCount || Math.floor(bodyHeightMM / shelfHeightMM);
    const bottomRemainderMM = bodyHeightMM - sc * shelfHeightMM;
    const bottomPageH = Math.max(bottomRemainderMM, 50); // 최소 50mm
    const faces = [
        { name: 'Top Ad',       w: widthMM * PX,  h: adHeightMM * PX },
        { name: 'Side Panel',   w: depthMM * PX,  h: heightMM * PX },
        { name: 'Shelf',        w: widthMM * PX,  h: lipHeightMM * PX },
        { name: 'Bottom Panel', w: widthMM * PX,  h: bottomPageH * PX },
    ];

    pageDataList = [];
    currentPageIndex = 0;

    faces.forEach((face) => {
        canvas.clear();
        const board = new fabric.Rect({
            width: face.w, height: face.h,
            fill: bgColor || '#ffffff',
            left: 0, top: 0, selectable: false, evented: false, isBoard: true
        });
        canvas.add(board);
        canvas.sendToBack(board);
        pageDataList.push(canvas.toJSON(CUSTOM_PROPS));
    });

    // 첫 페이지(상단 광고) 로드
    currentPageIndex = 0;
    loadPage(0);
    setTimeout(() => resizeCanvasToFit(), 50);
    updatePageCounter();

    // 종이매대 탭 UI 생성
    buildPdFaceTabsUI();

    // 전역 노출
    window.__pdMode = true;
}

function buildPdFaceTabsUI() {
    const container = document.getElementById('pdFaceTabs');
    if (!container) return;
    container.style.display = 'flex';
    container.innerHTML = '';

    const t = window.t || ((k, d) => d);
    const names = [
        t('pd_tab_ad', '상단 광고'),
        t('pd_tab_side', '옆면'),
        t('pd_tab_shelf', '선반'),
        t('pd_tab_bottom', '하단'),
    ];

    names.forEach((name, i) => {
        const btn = document.createElement('button');
        btn.className = 'pd-face-tab' + (i === 0 ? ' active' : '');
        btn.textContent = name;
        btn.dataset.index = i;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.switchPdFace(i);
        });
        container.appendChild(btn);
    });
}

window.switchPdFace = function(index) {
    const pages = window.__pageDataList || pageDataList;
    if (index < 0 || index >= pages.length) return;
    if (index === currentPageIndex) return;

    saveCurrentPageState();
    currentPageIndex = index;

    // 모듈-레벨 동기화
    if (pages !== pageDataList) pageDataList = pages;

    const json = pages[index];
    if (!json) return;

    canvas.loadFromJSON(json, () => {
        const board = canvas.getObjects().find(o => o.isBoard);
        if (board) {
            canvas.sendToBack(board);
            canvas.clipPath = new fabric.Rect({
                left: 0, top: 0,
                width: board.width, height: board.height,
                absolutePositioned: true
            });
        }
        updatePageCounter();
        canvas.requestRenderAll();
        resizeCanvasToFit();
    });

    // 탭 active 업데이트
    document.querySelectorAll('.pd-face-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
};