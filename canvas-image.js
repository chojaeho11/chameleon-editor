import { canvas } from "./canvas-core.js";
import { addToCenter } from "./canvas-objects.js";

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
            alert("배경 제거 기능은 서버 연동이 필요합니다.");
        };
    }

    // 3. ★ 밝게 보정 (10%씩 누적 증가)
    const btnEnhance = document.getElementById("btnEnhance");
    if (btnEnhance) {
        btnEnhance.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active || active.type !== 'image') return alert("이미지를 선택해주세요.");
            
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
        alert("PDF는 '주문하기' 단계에서 업로드해주세요. 에디터에서는 이미지만 지원합니다.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const imgObj = new Image();
        imgObj.src = e.target.result;
        imgObj.onload = () => {
            const fabricImg = new fabric.Image(imgObj);
            
            // 이미지 크기가 너무 크면 리사이징
            if (fabricImg.width > 500) {
                const scale = 500 / fabricImg.width;
                fabricImg.set({ scaleX: scale, scaleY: scale });
            }
            
            addToCenter(fabricImg);
        };
    };
    reader.readAsDataURL(file);
}