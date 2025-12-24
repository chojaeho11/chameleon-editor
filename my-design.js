import { sb, currentUser, cartData, PRODUCT_DB } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";

// main.js에서 호출하는 이름에 맞춰 'initMyDesign'으로 export 합니다.
export function initMyDesign() {
    // 1. 상단 보관함 열기 버튼
    // 1. [수정됨] 상단 보관함 버튼 -> 마이페이지 이동
const btnLib = document.getElementById("btnMyLibrary");
if(btnLib) {
    btnLib.innerHTML = `<span data-i18n="btn_my_library">📂 My Studio</span>`;

    btnLib.onclick = () => {
        if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
        // 모달 대신 별도 페이지(mypage.html)로 이동
        location.href = 'mypage.html'; 
    };
}

    // 2. [수정됨] 사이드바 '저장 버튼' -> 모달 창 열기
    const btnOpenSave = document.getElementById("btnOpenSaveModal");
    if (btnOpenSave) {
        btnOpenSave.onclick = () => {
            if (!currentUser) return alert("로그인 후에 저장할 수 있습니다.");
            document.getElementById("saveDesignModal").style.display = "flex";
        };
    }

    // 3. [수정됨] 모달 내부 '저장하기' 버튼 -> 실제 저장 함수 실행
    const btnConfirmSave = document.getElementById("btnConfirmSave");
    if(btnConfirmSave) {
        btnConfirmSave.onclick = saveCurrentDesign;
    }
}

// 디자인 저장하기
async function saveCurrentDesign() {
    const titleInput = document.getElementById("saveDesignTitle");
    const title = titleInput ? titleInput.value : "";
    
    if(!currentUser) {
        alert("로그인이 풀렸습니다. 다시 로그인해주세요.");
        return;
    }
    if(!title.trim()) return alert("제목을 입력해주세요.");

    // 버튼 ID가 btnConfirmSave로 변경됨
    const btn = document.getElementById("btnConfirmSave");
    const originalText = btn.innerText;
    btn.innerText = "저장 중...";

    try {
        // ★ [추가된 로직] 저장 개수 제한 확인 (최대 6개)
        // head: true 옵션은 실제 데이터를 가져오지 않고 개수(count)만 빠르게 조회합니다.
        const { count, error: countError } = await sb
            .from('user_designs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (countError) throw countError;

        if (count >= 6) {
            alert("보관함에는 최대 6개까지만 저장할 수 있습니다.\n기존 디자인을 삭제한 후 다시 시도해주세요.");
            btn.innerText = originalText;
            return; // 저장 중단
        }

        // 캔버스 데이터 추출
        const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth']);
        // 썸네일 품질 약간 향상
        const thumb = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
        const board = canvas.getObjects().find(o => o.isBoard);
        
        // 'user_designs' 테이블에 저장 (테이블이 없다면 Supabase에서 생성 필요)
        const { error } = await sb.from('user_designs').insert([{
            user_id: currentUser.id,
            title: title,
            product_key: canvas.currentProductKey || 'custom', // canvas-core 등에 저장된 키가 없다면 custom 처리
            json_data: json,
            thumb_url: thumb,
            width: board ? board.width : canvas.width,
            height: board ? board.height : canvas.height
        }]);

        if(error) throw error;

        alert("✅ 디자인이 저장되었습니다!");
        document.getElementById("saveDesignModal").style.display = "none";
        if(titleInput) titleInput.value = ""; 

    } catch(e) {
        console.error("저장 실패:", e);
        alert("오류: " + e.message);
    } finally {
        btn.innerText = originalText;
    }
}

// 목록 불러오기
async function loadMyDesigns() {
    const grid = document.getElementById("myDesignGrid");
    if(!grid) return;

    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">로딩 중...</div>';

    if(!sb || !currentUser) return;

    const { data, error } = await sb
        .from('user_designs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if(error || !data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#888;">저장된 디자인이 없습니다.</div>';
        return;
    }

    // [추가] 6개 제한 안내 문구 (선택 사항)
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:right; font-size:12px; color:#666; padding:0 10px;">현재 저장됨: ${data.length} / 6 (최대)</div>`;

    data.forEach(item => {
        const card = document.createElement("div");
        card.style.cssText = "background:white; border-radius:12px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.05); display:flex; flex-direction:column; border:1px solid #eee;";
        
        // [수정] 다시 편집하기 버튼 추가 및 레이아웃 조정
        card.innerHTML = `
            <div style="height:350px; background:#f9f9f9; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer;" onclick="window.loadDesignToCanvas(${item.id})">
                <img src="${item.thumb_url}" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="padding:15px;">
                <div style="font-weight:bold; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                <div style="font-size:12px; color:#888; margin-bottom:10px;">${new Date(item.created_at).toLocaleDateString()}</div>
                
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <button onclick="window.addDesignToCart(${item.id})" class="btn-round primary" style="flex:1; height:32px; justify-content:center; font-size:12px;">장바구니 담기</button>
                    <button onclick="window.deleteDesign(${item.id})" class="btn-round" style="width:32px; height:32px; padding:0; justify-content:center; color:red;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <button onclick="window.loadDesignToCanvas(${item.id})" class="btn-round" style="width:100%; height:32px; justify-content:center; font-size:12px; background:#f8fafc; color:#475569; border-color:#e2e8f0;">✏️ 다시 편집하기</button>
            </div>
        `;
        grid.appendChild(card);
    });
    window.designDataCache = data; 
}

// 캔버스로 불러오기 (대지 잠금 기능 포함)
window.loadDesignToCanvas = (id) => {
    if(!window.designDataCache) return;
    const item = window.designDataCache.find(d => d.id === id);
    if(!item) return;

    if(confirm("현재 캔버스 내용이 사라지고 선택한 디자인을 불러옵니다. 진행할까요?")) {
        document.getElementById("libraryModal").style.display = "none";
        
        // 1. 사이즈 적용 (기존 대지 삭제 및 캔버스 리셋)
        applySize(item.width, item.height, item.product_key || 'Custom', 'standard', 'replace');
        
        // 2. 캔버스 데이터 로드
        // (json_data가 객체인지 문자열인지 확인)
        const jsonData = typeof item.json_data === 'string' ? JSON.parse(item.json_data) : item.json_data;

        canvas.loadFromJSON(jsonData, () => {
            // ★ 핵심: 불러온 객체 중 '대지'를 찾아서 강제로 잠금 처리
            const objects = canvas.getObjects();
            const board = objects.find(o => o.isBoard);
            
            if (board) {
                board.set({
                    selectable: false,   // 선택 불가
                    evented: false,      // 클릭 이벤트 무시
                    hasControls: false,  // 크기 조절 핸들 숨김
                    hasBorders: false,   // 테두리 숨김
                    lockMovementX: true, // 이동 잠금
                    lockMovementY: true,
                    hoverCursor: 'default' // 마우스 커서 기본
                });
                canvas.sendToBack(board); // 맨 뒤로 보내기
            }

            canvas.requestRenderAll();

            // 3. 뷰포트 중앙 정렬
            if(board) {
                const vpt = canvas.viewportTransform;
                const zoom = canvas.getZoom(); // applySize에서 이미 줌이 계산되었을 수 있음
                // applySize의 resizeCanvasToFit 로직을 신뢰하거나, 여기서 다시 계산
                
                // 만약 로드 후 화면이 안 맞으면 아래 로직 활성화
                /*
                const stage = document.querySelector('.stage');
                if (stage) {
                    const padding = 50;
                    const availW = stage.clientWidth - padding;
                    const availH = stage.clientHeight - padding;
                    const newZoom = Math.min(availW / board.width, availH / board.height);
                    const panX = (stage.clientWidth - board.width * newZoom) / 2;
                    const panY = (stage.clientHeight - board.height * newZoom) / 2;
                    canvas.setViewportTransform([newZoom, 0, 0, newZoom, panX, panY]);
                }
                */
               canvas.requestRenderAll();
            }
        });
    }
};

// 장바구니 담기
window.addDesignToCart = (id) => {
    if(!window.designDataCache) return;
    const item = window.designDataCache.find(d => d.id === id);
    if(!item) return;

    // PRODUCT_DB에서 상품 정보 찾기 (없으면 기본값 A4)
    const productKey = item.product_key || 'A4';
    const productInfo = PRODUCT_DB[productKey] || PRODUCT_DB['A4'];

    cartData.push({
        uid: Date.now(),
        product: productInfo,
        type: 'design',
        thumb: item.thumb_url,
        json: item.json_data,
        width: item.width,
        height: item.height,
        addons: {},
        isOpen: true
    });

    localStorage.setItem('chameleon_cart', JSON.stringify(cartData));
    
    if(confirm("장바구니에 담겼습니다. 장바구니로 이동할까요?")) {
        document.getElementById("libraryModal").style.display = "none";
        const cartPage = document.getElementById("cartPage");
        if(cartPage) cartPage.style.display = "block";
        
        // 장바구니 UI 갱신 (order.js의 renderCart 호출이 필요할 수 있음)
        // 여기서는 페이지 새로고침으로 처리
        location.reload();
    }
};

// 삭제하기
window.deleteDesign = async (id) => {
    if(!confirm("정말 삭제하시겠습니까? (복구 불가)")) return;
    
    const { error } = await sb.from('user_designs').delete().eq('id', id);
    if(error) alert("삭제 실패: " + error.message);
    else {
        alert("삭제되었습니다.");
        loadMyDesigns(); // 목록 새로고침
    }
};