// canvas-template.js
import { sb, currentUser } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";

let selectedTpl = null;
let currentCategory = 'all';

export function initTemplateTools() {
    // 1. 카테고리 필터
    window.filterTpl = (type, btnElement) => {
        if (btnElement) {
            document.querySelectorAll(".tpl-cate-btn").forEach(b => b.classList.remove("active"));
            btnElement.classList.add("active");
        }
        currentCategory = type;
        const keyword = document.getElementById("tplSearchInput")?.value || "";
        searchTemplates(type, keyword);
    };

    // 2. 검색창
    const searchInput = document.getElementById("tplSearchInput");
    if (searchInput) {
        searchInput.onkeyup = (e) => {
            if (e.key === 'Enter') searchTemplates(currentCategory, e.target.value);
        };
    }

    // 3. 템플릿 탭 (오버레이 열기)
    document.querySelectorAll(".tpl-tab").forEach((b) => {
        b.onclick = () => openTemplateOverlay(b.dataset.tpl);
    });

    // 4. 로드 모달 버튼
    const btnReplace = document.getElementById("btnLoadReplace");
    if (btnReplace) btnReplace.onclick = () => processLoad('replace');
    const btnAdd = document.getElementById("btnLoadAdd");
    if (btnAdd) btnAdd.onclick = () => processLoad('add');

    const btnUse = document.getElementById("btnUseTpl");
    if(btnUse) btnUse.onclick = useSelectedTemplate;

    // 5. 관리자 등록 버튼
    const btnReg = document.getElementById("btnRegisterTemplate");
    if (btnReg) {
        if (currentUser) btnReg.style.display = "flex";
        btnReg.onclick = () => {
            if (!currentUser) return alert("관리자 로그인이 필요합니다.");
            document.getElementById("sellModal").style.display = "flex";
        };
    }

    // 6. 등록 확인 버튼
    const btnSellConfirm = document.getElementById("btnSellConfirm");
    if (btnSellConfirm) btnSellConfirm.onclick = registerOfficialTemplate;
}

// 오버레이 열기
async function openTemplateOverlay(type) {
    const overlay = document.getElementById("templateOverlay");
    overlay.style.display = "flex";
    currentCategory = type;
    
    document.querySelectorAll(".tpl-cate-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${type}'`)) {
            btn.classList.add("active");
        }
    });
    
    await searchTemplates(type, "");
}

// 템플릿 검색 (최적화 적용: data_url 제외)
async function searchTemplates(category, keyword) {
    const grid = document.getElementById("tplGrid");
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">로딩중...</div>';
    selectedTpl = null;

    if (!sb) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red;">DB 미연결</div>';
        return;
    }

    try {
        // ★ [핵심 최적화] data_url(무거운 JSON)은 빼고 가져옴
        let query = sb.from('library')
            .select('id, thumb_url, tags, category, width, height, product_key, created_at')
            .order('created_at', { ascending: false })
            .limit(50); // 개수 제한

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }
        if (keyword) {
            query = query.ilike('tags', `%${keyword}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">등록된 템플릿이 없습니다.</div>';
            return;
        }

        grid.innerHTML = "";
        data.forEach((item) => {
            const card = document.createElement("div");
            card.className = "tpl-item";
            const imgUrl = item.thumb_url || 'https://via.placeholder.com/300?text=No+Image';
            const displayTitle = item.tags ? item.tags.split(',')[0] : '무제';

            card.innerHTML = `
                <img src="${imgUrl}" class="tpl-item-img" loading="lazy" style="width:100%; height:auto; object-fit:contain; display:block;">
                <div class="tpl-overlay-info">
                    <span class="tpl-name">${displayTitle}</span>
                    <button class="btn-use-mini" type="button">바로 적용</button>
                </div>
            `;
            
            card.onclick = (e) => {
                document.querySelectorAll(".tpl-item").forEach((i) => i.classList.remove("selected"));
                card.classList.add("selected");
                
                // 선택 시 id만 저장 (JSON은 적용 버튼 누를 때 로딩)
                selectedTpl = { 
                    id: item.id, // ID 저장
                    category: item.category,
                    width: item.width || 1000, 
                    height: item.height || 1000, 
                    product_key: item.product_key || 'custom'
                };
                
                if (e.target.classList.contains('btn-use-mini')) useSelectedTemplate();
            };
            grid.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div style="text-align:center; color:red;">에러: ${e.message}</div>`;
    }
}

async function useSelectedTemplate() {
    if (!selectedTpl) return alert("템플릿을 선택해주세요.");
    
    // 현재 캔버스에 객체가 있는지 확인
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    if (objects.length > 0) {
        document.getElementById("loadModeModal").style.display = "flex";
    } else {
        processLoad('replace');
    }
}

// 템플릿 로드 프로세스 (DB에서 JSON을 그때 가져옴)
async function processLoad(mode) {
    document.getElementById("loadModeModal").style.display = "none";
    document.getElementById("templateOverlay").style.display = "none";
    document.getElementById("loading").style.display = "flex";

    try {
        // ★ [Lazy Loading] 여기서 진짜 데이터(JSON)를 가져옴
        const { data, error } = await sb
            .from('library')
            .select('data_url')
            .eq('id', selectedTpl.id)
            .single();

        if (error || !data) throw new Error("템플릿 데이터를 불러오지 못했습니다.");

        let jsonData = data.data_url;

        // 문자열이면 파싱
        if (typeof jsonData === 'string') {
            if(jsonData.startsWith('http')) { 
                const res = await fetch(jsonData); 
                jsonData = await res.json(); 
            } else { 
                jsonData = JSON.parse(jsonData); 
            }
        }

        // [교체 모드] 대지 크기 변경
        if (mode === 'replace') {
            const newW = selectedTpl.width || 1000;
            const newH = selectedTpl.height || 1000;
            const newKey = selectedTpl.product_key || 'Custom';
            
            applySize(newW, newH, newKey, 'standard', 'replace');
        }

        // JSON에서 대지 객체 제외
        if(jsonData.objects) jsonData.objects = jsonData.objects.filter(o => !o.isBoard);

        fabric.util.enlivenObjects(jsonData.objects, (objs) => {
            if (objs.length === 0) { 
                document.getElementById("loading").style.display = "none"; 
                resetViewToCenter(); 
                return; 
            }

            // 잠금 해제
            objs.forEach(obj => {
                obj.set({
                    selectable: true,
                    evented: true,
                    lockMovementX: false, lockMovementY: false,
                    lockScalingX: false, lockScalingY: false,
                    hasControls: true, hasBorders: true
                });
            });

            const group = new fabric.Group(objs, { originX: 'center', originY: 'center' });
            
            const board = canvas.getObjects().find(o => o.isBoard);
            const boardW = board ? (board.width * board.scaleX) : 1000;
            const boardH = board ? (board.height * board.scaleY) : 1000;
            const centerX = board ? (board.left + boardW / 2) : canvas.width / 2;
            const centerY = board ? (board.top + boardH / 2) : canvas.height / 2;

            if (mode === 'add') {
                const limitW = boardW * 0.7;
                const limitH = boardH * 0.7;
                const scale = Math.min(limitW / group.width, limitH / group.height);
                group.scale(scale);
                group.set({ left: centerX, top: centerY });
                canvas.add(group);
                group.setCoords();
                canvas.setActiveObject(group);
            } else {
                group.set({ left: centerX, top: centerY });
                canvas.add(group);
                group.toActiveSelection();
                canvas.discardActiveObject();
            }

            canvas.requestRenderAll();
            setTimeout(() => resetViewToCenter(), 100);
            document.getElementById("loading").style.display = "none";
        });

    } catch (e) {
        console.error(e);
        alert("템플릿 불러오기 실패: " + e.message);
        document.getElementById("loading").style.display = "none";
    }
}

// 관리자용 템플릿 등록
async function registerOfficialTemplate() {
    const kwInput = document.getElementById("sellKw");
    const keyword = kwInput ? kwInput.value : "";
    
    let cat = prompt("카테고리를 입력하세요\n(옵션: vector, text, graphic, photo-bg)", "text");
    if(!cat) return;
    cat = cat.toLowerCase();

    if (!sb) return alert("DB 미연결");
    if (!currentUser) return alert("관리자 로그인이 필요합니다.");

    const btn = document.getElementById("btnSellConfirm");
    const originalText = btn.innerText;
    btn.innerText = "업로드 중...";

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // 데이터 추출
    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth']);
    const board = canvas.getObjects().find(o => o.isBoard);
    const originalVpt = canvas.viewportTransform; 
    
    let thumbUrl = "";

    try {
        if (board) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            thumbUrl = canvas.toDataURL({ 
                format: 'png', 
                multiplier: 3, 
                quality: 1,
                left: board.left,
                top: board.top,
                width: board.getScaledWidth(),
                height: board.getScaledHeight()
            });
        } else {
            thumbUrl = canvas.toDataURL({ format: 'png', multiplier: 3, quality: 1 });
        }

        const payload = {
            category: cat,
            tags: keyword || "제목 없음",
            thumb_url: thumbUrl,
            data_url: json,
            created_at: new Date(),
            width: board ? board.width : canvas.width,
            height: board ? board.height : canvas.height,
            product_key: canvas.currentProductKey || 'custom'
        };

        const { error } = await sb.from('library').insert([payload]);

        if (error) throw error;

        alert("👑 공식 템플릿으로 등록되었습니다!");
        document.getElementById("sellModal").style.display = "none";
        if(kwInput) kwInput.value = "";

    } catch (e) {
        console.error("등록 실패:", e);
        alert("등록 실패: " + e.message);
    } finally {
        canvas.setViewportTransform(originalVpt);
        canvas.requestRenderAll();
        btn.innerText = originalText;
    }
}

function resetViewToCenter() {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const containerW = canvas.getWidth(); 
    const containerH = canvas.getHeight();
    const safeWidth = Math.max(containerW - 300, 100); 
    const boardW = board.getScaledWidth();
    const boardH = board.getScaledHeight();

    if (boardW === 0 || boardH === 0) return;

    const zoom = Math.min(safeWidth / boardW, containerH / boardH) * 0.85;
    const safeZoom = Math.min(Math.max(zoom, 0.05), 5); 

    canvas.setZoom(safeZoom);
    const vpt = canvas.viewportTransform;
    vpt[4] = (containerW - boardW * safeZoom) / 2;
    vpt[5] = (containerH - boardH * safeZoom) / 2;
    canvas.requestRenderAll();
}