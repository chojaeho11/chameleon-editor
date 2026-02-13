import { canvas } from "./canvas-core.js?v=122";
import { addToCenter } from "./canvas-objects.js?v=122";

export function initImageTools() {
    // 1. 이미지 업로드 (파일 input 트리거)
    const fileInput = document.getElementById("imgUpload");
    if (fileInput) {
        fileInput.onchange = (e) => handleImageUpload(e.target.files[0]);
    }

    // 2. 배경 제거 (외부 API 필요 - 예시 로직)
    const btnCutout = document.getElementById("btnCutout");
    if (btnCutout) {
        btnCutout.onclick = () => {
            alert("Background removal requires server connection.");
        };
    }

    // 3. ★ 밝게 보정 (10%씩 누적 증가)
    const btnEnhance = document.getElementById("btnEnhance");
    if (btnEnhance) {
        btnEnhance.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active || active.type !== 'image') return alert("Please select an image.");
            
            // 기존 필터 찾기
            // Fabric.js 5.x 이상에서는 filters 배열 사용
            if (!active.filters) active.filters = [];
            
            // Brightness 필터가 이미 있는지 확인
            let brightFilter = active.filters.find(f => f.type === 'Brightness');
            
            if (brightFilter) {
                // 이미 있으면 0.1 증가 (최대 1.0)
                brightFilter.brightness = Math.min(brightFilter.brightness + 0.1, 1);
            } else {
                // 없으면 새로 생성 (0.1)
                brightFilter = new fabric.Image.filters.Brightness({ brightness: 0.1 });
                active.filters.push(brightFilter);
            }

            active.applyFilters();
            canvas.requestRenderAll();
        };
    }
}

function handleImageUpload(file) {
    if (!file) return;

    // PDF 파일 처리
    if (file.type === 'application/pdf') {
        // [수정] 다국어 적용
        alert(window.t('msg_pdf_error', "Please upload PDF in the 'Order' step. Only images are supported in the editor."));
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const imgObj = new Image();
        imgObj.src = e.target.result;
        imgObj.onload = () => {
            const fabricImg = new fabric.Image(imgObj);
            
            // ★ [수정] 이미지를 캔버스 대지 크기의 60%에 맞춰 리사이징
            const board = canvas.getObjects().find(o => o.isBoard);
            const maxW = board ? board.width * 0.6 : 300;
            const maxH = board ? board.height * 0.6 : 300;
            
            if (fabricImg.width > maxW || fabricImg.height > maxH) {
                const scale = Math.min(maxW / fabricImg.width, maxH / fabricImg.height);
                fabricImg.set({ scaleX: scale, scaleY: scale });
            }
            
            // 중앙에 추가
            addToCenter(fabricImg);

            // ★ [안전장치] 추가된 이미지를 다시 한번 맨 위로 강력하게 올림
            canvas.bringToFront(fabricImg);
            canvas.requestRenderAll();
        };
    };
    reader.readAsDataURL(file);
}