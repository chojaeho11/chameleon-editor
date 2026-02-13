/* canvas-pages.js */
import { canvas } from "./canvas-core.js?v=122";
import { applySize, resizeCanvasToFit } from "./canvas-size.js?v=122"; // [수정] 화면맞춤 함수 추가

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

// [2] 배경색 변경 로직
export function setBoardColor(color) {
    if (!canvas) return;
    
    // 1. 대지(Board) 객체 찾기
    const board = canvas.getObjects().find(o => o.isBoard);
    
    if (board) {
        board.set('fill', color);
        canvas.requestRenderAll();
        saveCurrentPageState(); // 변경 사항 저장
    } else {
        // 대지가 없으면 캔버스 배경색 변경
        canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    }
}

function renderColorPalette() {
    const paletteContainer = document.getElementById('colorPaletteGrid');
    if(!paletteContainer) return;

    // 미리캔버스 스타일 기본 팔레트
    const colors = [
        '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#212529', '#000000',
        '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fffffc',
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50'
    ];

    paletteContainer.innerHTML = '';
    
    // 컬러피커 (사용자 지정)
    const pickerLabel = document.createElement('label');
    pickerLabel.className = 'color-swatch picker';
    pickerLabel.innerHTML = '<i class="fa-solid fa-plus"></i><input type="color" id="customBgPicker" style="opacity:0; width:0; height:0;">';
    pickerLabel.onchange = (e) => setBoardColor(e.target.value);
    paletteContainer.appendChild(pickerLabel);

    // 프리셋 컬러
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.onclick = () => setBoardColor(color);
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
    const newJson = canvas.toJSON(['id', 'isBoard', 'selectable', 'evented']);
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

export function deleteCurrentPage() {
    // [수정] 다국어 적용
    if (pageDataList.length <= 1) return alert(window.t('msg_min_page_limit', "At least one page is required."));
    
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
    const json = canvas.toJSON(['id', 'isBoard', 'selectable', 'evented', 'locked', 'isGuide']);
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
}