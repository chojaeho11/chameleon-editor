/* canvas-template.js - 버튼 페이징 버전 */

import { sb, currentUser } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";

// 선택된 템플릿 정보를 저장하는 변수
let selectedTpl = null;
let currentCategory = 'all';

// =========================================================
// [페이징 상태 변수]
// =========================================================
let tplCurrentPage = 0; // 현재 페이지 (0부터 시작)
let tplIsLoading = false;
let tplLastCategory = 'all';
let tplLastKeyword = '';
const TPL_PER_PAGE = 30; // 한 페이지당 30개

// =========================================================
// [0] 스마트 검색어 확장 DB
// =========================================================
const SYNONYM_DB = {
    '빵': ['베이커리', '케이크', '디저트', '제과', '식빵', '도넛', 'bakery', 'bread'],
    '커피': ['카페', '아메리카노', '라떼', '음료', '티', 'cafe', 'coffee'],
    '음식': ['푸드', '식당', '요리', '맛집', '한식', '메뉴', 'food'],
    '고기': ['정육', '삼겹살', '한우', '갈비', '식육', 'meat'],
    '술': ['주점', '맥주', '소주', '와인', '이자카야', '포차', 'beer'],
    '운동': ['헬스', '피트니스', '요가', '필라테스', '체육', 'gym', 'health', 'yoga', 'sports'],
    '뷰티': ['미용', '헤어', '네일', '에스테틱', '속눈썹', '메이크업', 'beauty', 'hair'],
    '병원': ['의료', '진료', '치과', '약국', '건강', 'care', 'medical'],
    '학원': ['교육', '수학', '영어', '입시', '공부', '과외', 'school', 'academy', 'study'],
    '부동산': ['공인중개사', '매매', '전세', '월세', '분양', '임대', 'real estate'],
    '세일': ['할인', '특가', '이벤트', '오픈', '프로모션', 'sale', 'event', 'open'],
    '비즈니스': ['회사', '업무', '성공', '금융', '마케팅', 'business'],
    '여름': ['바다', '해변', '수영', '휴가', '물놀이', 'summer', 'beach'],
    '겨울': ['눈', '크리스마스', '성탄절', '새해', 'winter', 'snow'],
    '명절': ['추석', '설날', '한가위', '선물세트', 'holiday'],
    '여행': ['투어', '캠핑', '호텔', '휴식', 'travel', 'trip'],
    '꽃': ['플라워', '봄', '식물', '화분', 'flower', 'plant'],
    '동물': ['강아지', '고양이', '반려견', '펫', 'dog', 'cat', 'pet'],
    '사람': ['가족', '아이', '학생', '직장인', '커플', 'people']
};

function expandSearchKeywords(inputText) {
    if (!inputText) return [];
    let words = inputText.toLowerCase().split(/\s+/).filter(w => w.trim().length > 0);
    let expanded = new Set(words);
    words.forEach(word => {
        Object.keys(SYNONYM_DB).forEach(key => {
            if (word.includes(key) || key === word) {
                SYNONYM_DB[key].forEach(syn => expanded.add(syn));
            } else if (SYNONYM_DB[key].includes(word)) {
                expanded.add(key);
                SYNONYM_DB[key].forEach(syn => expanded.add(syn));
            }
        });
    });
    return Array.from(expanded);
}

// =========================================================
// [1] 초기화 및 이벤트 리스너 설정
// =========================================================
export function initTemplateTools() {
    window.filterTpl = (type, btnElement) => {
        if (btnElement) {
            document.querySelectorAll(".tpl-cate-btn").forEach(b => b.classList.remove("active"));
            btnElement.classList.add("active");
        }
        currentCategory = type;
        const keyword = document.getElementById("tplSearchInput")?.value || "";
        // 검색 실행 (페이지 0부터)
        searchTemplates(type, keyword);
    };

    const searchInput = document.getElementById("tplSearchInput");
    if (searchInput) {
        searchInput.onkeyup = (e) => {
            if (e.key === 'Enter') searchTemplates(currentCategory, e.target.value);
        };
    }

    document.querySelectorAll(".tpl-tab").forEach((b) => {
        if (!b.getAttribute('onclick')) {
            b.onclick = () => openTemplateOverlay(b.dataset.tpl);
        }
    });

    const setupBtn = (id, handler) => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = handler;
    };

    setupBtn("btnActionReplace", () => { document.getElementById("templateActionModal").style.display = "none"; processLoad('replace'); });
    setupBtn("btnActionAdd", () => { document.getElementById("templateActionModal").style.display = "none"; processLoad('add'); });
    setupBtn("btnUseTpl", useSelectedTemplate);
    setupBtn("btnSellConfirm", registerOfficialTemplate);

    const btnReg = document.getElementById("btnRegisterTemplate");
    if (btnReg) {
        if (currentUser) btnReg.style.display = "flex";
        btnReg.onclick = () => {
            if (!currentUser) return alert("관리자 로그인이 필요합니다.");
            document.getElementById("sellModal").style.display = "flex";
        };
    }
}

// =========================================================
// [2] 오버레이 및 페이징 로직
// =========================================================

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

// ★ 검색 초기화 함수 (0페이지부터 시작)
async function searchTemplates(category, keyword) {
    tplLastCategory = category;
    tplLastKeyword = keyword;
    tplCurrentPage = 0; // 페이지 리셋
    
    await loadTemplatePage(0);
}

// ★ 페이지 이동 함수 (버튼 클릭 시 실행)
window.changeTemplatePage = async function(direction) {
    const newPage = tplCurrentPage + direction;
    if (newPage < 0) return; // 0페이지 미만 방지
    await loadTemplatePage(newPage);
}

// ★ 실제 데이터를 불러와서 그리는 함수
async function loadTemplatePage(pageIndex) {
    if (tplIsLoading) return;
    tplIsLoading = true;
    tplCurrentPage = pageIndex;

    const grid = document.getElementById("tplGrid");
    if (!grid) return;

    // 1. 로딩 표시 (기존 그리드 지우고 로딩바)
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#666;">데이터를 불러오는 중입니다...</div>';

    // 2. 하단 페이징 컨트롤 영역 생성 (그리드 밖 부모 요소에 추가)
    renderPaginationControls(false); // 로딩 중에는 버튼 비활성화

    if (!sb) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red;">DB 미연결</div>';
        tplIsLoading = false;
        return;
    }

    try {
        const currentKey = window.currentProductKey || (canvas ? canvas.currentProductKey : 'custom') || 'custom';
        
        // 3. 쿼리 작성 (Range 사용: 30개씩)
        let query = sb.from('library')
            .select('id, thumb_url, tags, category, product_key, created_at')
            .order('created_at', { ascending: false })
            .range(pageIndex * TPL_PER_PAGE, (pageIndex + 1) * TPL_PER_PAGE - 1);

        // 카테고리 필터
        if (tplLastCategory && tplLastCategory !== 'all') {
            query = query.eq('category', tplLastCategory); 
        }
        
        // 키워드 검색
        if (tplLastKeyword && tplLastKeyword.trim() !== '') {
            const expandedWords = expandSearchKeywords(tplLastKeyword);
            const orSearchCondition = expandedWords.map(w => `tags.ilike.%${w}%`).join(',');
            if (orSearchCondition) query = query.or(orSearchCondition);
        }

        // 제품 필터
        const filterCondition = `product_key.eq.${currentKey},product_key.eq.custom,product_key.is.null`;
        query = query.or(filterCondition);

        // 4. 실행
        const { data, error } = await query;
        
        if (error) throw error;

        // 5. 그리드 비우기 (데이터 렌더링 준비)
        grid.innerHTML = "";

        // 데이터가 없을 때
        if (!data || data.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">
                표시할 데이터가 없습니다.<br>
                ${pageIndex > 0 ? '<button class="btn-round" onclick="changeTemplatePage(-1)" style="margin-top:10px;">이전 페이지로 돌아가기</button>' : ''}
            </div>`;
            renderPaginationControls(true, 0); // 버튼 업데이트
            tplIsLoading = false;
            return;
        }

        // 6. 카드 렌더링
        data.forEach((item) => {
            const card = document.createElement("div");
            card.className = "tpl-item";
            const imgUrl = item.thumb_url || 'https://via.placeholder.com/300?text=No+Image';
            const displayTitle = item.tags ? item.tags.split(',')[0] : '무제';
            
            const isExclusive = item.product_key && item.product_key !== 'custom';
            const badgeHtml = isExclusive 
                ? `<span style="position:absolute; top:8px; left:8px; background:#6366f1; color:white; font-size:10px; padding:3px 6px; border-radius:4px; z-index:2;">전용</span>` 
                : '';

            card.innerHTML = `
                ${badgeHtml}
                <img src="${imgUrl}" class="tpl-item-img" loading="lazy">
                <div class="tpl-overlay-info">
                    <span class="tpl-name">${displayTitle}</span>
                    <button class="btn-use-mini" type="button">바로 적용</button>
                </div>
            `;
            
            card.onclick = (e) => {
                document.querySelectorAll(".tpl-item").forEach((i) => i.classList.remove("selected"));
                card.classList.add("selected");
                
                selectedTpl = { 
                    id: item.id, 
                    category: item.category, 
                    product_key: item.product_key || 'custom'
                };
                
                if (e.target.classList.contains('btn-use-mini')) useSelectedTemplate();
            };
            grid.appendChild(card);
        });

        // 7. 페이지네이션 버튼 업데이트 (데이터 개수 확인)
        renderPaginationControls(true, data.length);

    } catch (e) {
        console.error("로딩 에러:", e);
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:red;">
            데이터를 불러오지 못했습니다.<br>
            <button class="btn-round" onclick="loadTemplatePage(${tplCurrentPage})" style="margin-top:10px;">다시 시도</button>
        </div>`;
    } finally {
        tplIsLoading = false;
    }
}

// ★ 하단 페이지네이션 버튼 그리기 함수
// ★ 하단 페이지네이션 버튼 그리기 함수 (디자인 수정됨)
function renderPaginationControls(isEnabled, dataCount = 0) {
    const grid = document.getElementById("tplGrid");
    if(!grid) return;

    // 기존 컨트롤 제거
    let controls = document.getElementById("tpl-pagination-controls");
    if(controls) controls.remove();

    controls = document.createElement("div");
    controls.id = "tpl-pagination-controls";
    // [수정] flex 정렬 개선 및 높이 중앙 정렬
    controls.style.cssText = "grid-column: 1/-1; display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding-bottom: 30px;";

    // 공통 버튼 스타일 (작고 슬림하게)
    const btnStyle = "padding: 0 15px; height: 36px; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 20px; transition: all 0.2s;";

    // 1. 이전 버튼
    const prevBtn = document.createElement("button");
    prevBtn.className = "btn-round"; // 기존 클래스 유지하되 스타일 덮어쓰기
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left" style="font-size:11px;"></i> 이전`;
    prevBtn.style.cssText = btnStyle;
    
    if (!isEnabled || tplCurrentPage === 0) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = "0.4";
        prevBtn.style.cursor = "not-allowed";
        prevBtn.style.background = "#e2e8f0"; // 비활성 회색 배경
        prevBtn.style.color = "#94a3b8";
    } else {
        prevBtn.style.background = "#fff";
        prevBtn.style.border = "1px solid #cbd5e1";
        prevBtn.style.color = "#334155";
        prevBtn.onclick = () => changeTemplatePage(-1);
    }

    // 2. 페이지 표시 텍스트 (밀림 방지)
    const pageIndicator = document.createElement("span");
    pageIndicator.innerText = `${tplCurrentPage + 1} 페이지`;
    // [수정] white-space: nowrap으로 줄바꿈 방지, min-width로 공간 확보
    pageIndicator.style.cssText = "font-size: 14px; font-weight: 600; color: #475569; margin: 0 8px; white-space: nowrap; text-align: center; min-width: 60px;";

    // 3. 다음 버튼
    const nextBtn = document.createElement("button");
    nextBtn.className = "btn-round";
    nextBtn.innerHTML = `다음 <i class="fa-solid fa-chevron-right" style="font-size:11px;"></i>`;
    nextBtn.style.cssText = btnStyle;

    if (!isEnabled || dataCount < TPL_PER_PAGE) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = "0.4";
        nextBtn.style.cursor = "not-allowed";
        nextBtn.style.background = "#e2e8f0";
        nextBtn.style.color = "#94a3b8";
    } else {
        // 활성 상태일 때 강조 색상 (파란색 계열)
        nextBtn.style.background = "#fff"; 
        nextBtn.style.border = "1px solid #6366f1";
        nextBtn.style.color = "#6366f1";
        nextBtn.onclick = () => changeTemplatePage(1);
    }

    // 마우스 오버 효과 (선택 사항)
    const addHover = (btn, isPrimary) => {
        if(btn.disabled) return;
        btn.onmouseover = () => { 
            btn.style.transform = "translateY(-1px)"; 
            btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
            if(isPrimary) { btn.style.background = "#6366f1"; btn.style.color = "#fff"; }
        };
        btn.onmouseout = () => { 
            btn.style.transform = "none"; 
            btn.style.boxShadow = "none";
            if(isPrimary) { btn.style.background = "#fff"; btn.style.color = "#6366f1"; }
        };
    };

    addHover(prevBtn, false);
    addHover(nextBtn, true);

    controls.appendChild(prevBtn);
    controls.appendChild(pageIndicator);
    controls.appendChild(nextBtn);

    // 그리드 바로 뒤에 삽입
    grid.parentNode.appendChild(controls);
}


// =========================================================
// [3] 선택 및 로드 프로세스 (변경 없음)
// =========================================================

async function useSelectedTemplate() {
    if (!selectedTpl) return alert("템플릿을 선택해주세요.");
    
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    
    if (objects.length > 0) {
        document.getElementById("templateActionModal").style.display = "flex";
    } else {
        processLoad('replace');
    }
}

async function processLoad(mode) {
    document.getElementById("templateActionModal").style.display = "none"; 
    document.getElementById("templateOverlay").style.display = "none";
    document.getElementById("loading").style.display = "flex";

    try {
        const { data, error } = await sb
            .from('library')
            .select('data_url, width, height, category') 
            .eq('id', selectedTpl.id)
            .single();

        if (error || !data) throw new Error("데이터 로드 실패");
        
        selectedTpl.width = data.width || 1000;
        selectedTpl.height = data.height || 1000;
        selectedTpl.category = data.category;

        let rawData = data.data_url;
        let finalJson = null;
        let isImage = false;
        let imageUrl = "";

        try {
            if (typeof rawData === 'object') {
                finalJson = rawData; 
            } else {
                finalJson = JSON.parse(rawData);
            }
            if (typeof finalJson === 'string') {
                isImage = true; imageUrl = finalJson;
            } else {
                isImage = false;
            }
        } catch (e) {
            isImage = true; imageUrl = rawData;
        }

        if (mode === 'replace') {
            const objects = canvas.getObjects().filter(o => !o.isBoard);
            objects.forEach(o => canvas.remove(o));
        }

        const getSmartScale = (objWidth, objHeight) => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const bW = board ? (board.width * board.scaleX) : canvas.width;
            const bH = board ? (board.height * board.scaleY) : canvas.height;
            const category = selectedTpl.category || 'logo';
            
            if (['photo-bg', 'vector', 'transparent-graphic', 'pattern'].includes(category)) {
                return Math.max(bW / objWidth, bH / objHeight) * 1.1; 
            } else {
                return (bW / 3) / objWidth;
            }
        };

        const getCenterPos = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const bW = board ? (board.width * board.scaleX) : canvas.width;
            const bH = board ? (board.height * board.scaleY) : canvas.height;
            return { x: board.left + bW/2, y: board.top + bH/2 };
        };

        if (isImage) {
            const cleanUrl = String(imageUrl).trim().replace(/^"|"$/g, '');
            fabric.Image.fromURL(cleanUrl, (img) => {
                if (!img || !img.width) {
                    if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
                    return alert("이미지 로드 실패");
                }
                const finalScale = getSmartScale(img.width, img.height);
                const center = getCenterPos();
                img.set({
                    left: center.x, top: center.y, originX: 'center', originY: 'center',
                    scaleX: finalScale, scaleY: finalScale
                });
                canvas.add(img);
                img.setCoords(); 
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
            }, { crossOrigin: 'anonymous' }); 

        } else {
            let jsonData = finalJson;
            if(jsonData.objects) jsonData.objects = jsonData.objects.filter(o => !o.isBoard);

            fabric.util.enlivenObjects(jsonData.objects, (objs) => {
                if (objs.length === 0) { 
                    if(document.getElementById("loading")) document.getElementById("loading").style.display = "none"; 
                    if(mode === 'replace') resetViewToCenter(); 
                    return; 
                }
                objs.forEach(obj => {
                    obj.set({
                        selectable: true, evented: true,
                        lockMovementX: false, lockMovementY: false, lockScalingX: false, lockScalingY: false,
                        hasControls: true, hasBorders: true
                    });
                });
                const group = new fabric.Group(objs, { originX: 'center', originY: 'center' });
                const finalScale = getSmartScale(group.width, group.height);
                const center = getCenterPos();
                group.set({ left: center.x, top: center.y, scaleX: finalScale, scaleY: finalScale });
                canvas.add(group);
                if (group.type === 'group') group.toActiveSelection();
                canvas.discardActiveObject(); 
                canvas.requestRenderAll();
                if (mode === 'replace') setTimeout(() => resetViewToCenter(), 100);
                if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
            });
        }
    } catch (e) {
        console.error(e);
        if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
        alert("오류: " + e.message);
    }
}

// =========================================================
// [4] 유틸리티 및 기타
// =========================================================

function resetViewToCenter() {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const containerW = canvas.getWidth(); 
    const containerH = canvas.getHeight();
    const boardW = board.getScaledWidth();
    const boardH = board.getScaledHeight();
    const isMobile = window.innerWidth < 768;
    const paddingX = isMobile ? 20 : 320; 
    const paddingY = isMobile ? 120 : 100; 
    const safeWidth = Math.max(containerW - paddingX, 50);
    const safeHeight = Math.max(containerH - paddingY, 50);
    const zoom = Math.min(safeWidth / boardW, safeHeight / boardH) * 0.98;
    const safeZoom = Math.min(Math.max(zoom, 0.05), 5); 
    canvas.setZoom(safeZoom);
    const vpt = canvas.viewportTransform;
    vpt[4] = (containerW - boardW * safeZoom) / 2;
    vpt[5] = (containerH - boardH * safeZoom) / 2;
    if(isMobile) vpt[5] += 10;
    canvas.requestRenderAll();
}

async function registerOfficialTemplate() {
    const kwInput = document.getElementById("sellKw");
    const keyword = kwInput ? kwInput.value : "";
    let cat = prompt("카테고리를 입력하세요\n(옵션: vector, graphic, photo-bg, logo)", "text");
    if(!cat) return;
    cat = cat.toLowerCase();

    if (!sb) return alert("DB 미연결");
    if (!currentUser) return alert("관리자 로그인이 필요합니다.");

    const btn = document.getElementById("btnSellConfirm");
    const originalText = btn.innerText;
    btn.innerText = "업로드 중...";
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth']);
    const board = canvas.getObjects().find(o => o.isBoard);
    const originalVpt = canvas.viewportTransform; 
    let thumbUrl = "";

    try {
        if (board) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            thumbUrl = canvas.toDataURL({ 
                format: 'png', multiplier: 0.5, quality: 0.8,
                left: board.left, top: board.top,
                width: board.getScaledWidth(), height: board.getScaledHeight()
            });
        } else {
            thumbUrl = canvas.toDataURL({ format: 'png', multiplier: 0.5, quality: 0.8 });
        }

        const payload = {
            category: cat, tags: keyword || "제목 없음",
            thumb_url: thumbUrl, data_url: json,
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

// 로고 및 파일 유틸
window.handleFileSelect = function(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    const preview = document.getElementById('previewImage');
    const removeBtn = document.getElementById('removeFileBtn');
    const dropText = document.querySelector('.upload-drop-zone .upload-text');
    const subText = document.querySelector('.upload-drop-zone .upload-sub');
    const keywordInput = document.getElementById('logoKeywordInput');

    if (files.length === 1) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            if(preview) { preview.src = e.target.result; preview.style.display = 'block'; }
            if(removeBtn) removeBtn.style.display = 'flex';
        }
        reader.readAsDataURL(file);
        const autoTag = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        if(keywordInput) keywordInput.value = autoTag;
    } else {
        if(preview) preview.style.display = 'none';
        if(removeBtn) removeBtn.style.display = 'flex';
        dropText.innerHTML = `<span style="color:#6366f1; font-weight:800;">${files.length}개</span>의 파일이 선택되었습니다.`;
        subText.innerText = "업로드 버튼을 누르면 일괄 등록됩니다.";
        if(keywordInput) { keywordInput.value = ""; keywordInput.placeholder = "공통 태그 입력"; }
    }
};

window.resetUpload = function(e) {
    if(e) e.stopPropagation(); 
    const fileInput = document.getElementById('logoFileInput');
    const preview = document.getElementById('previewImage');
    const removeBtn = document.getElementById('removeFileBtn');
    const dropText = document.querySelector('.upload-drop-zone .upload-text');
    const subText = document.querySelector('.upload-drop-zone .upload-sub');
    const keywordInput = document.getElementById('logoKeywordInput');
    if(fileInput) fileInput.value = "";
    if(preview) { preview.style.display = 'none'; preview.src = ""; }
    if(removeBtn) removeBtn.style.display = 'none';
    if(dropText) dropText.innerText = "클릭하여 파일 선택";
    if(subText) subText.innerText = "또는 파일을 여기로 드래그하세요";
    if(keywordInput) { keywordInput.value = ""; keywordInput.placeholder = "예: 삼성, 로고, 심플 (쉼표로 구분)"; }
};

window.uploadUserLogo = async function() {
    const fileInput = document.getElementById("logoFileInput");
    const keywordInput = document.getElementById("logoKeywordInput");
    const files = fileInput.files;
    const commonTag = keywordInput.value.trim();
    if (files.length === 0) return alert("이미지를 선택해주세요!");
    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true;
    let successCount = 0, failCount = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            btn.innerText = `업로드 중... (${i + 1}/${files.length})`;
            let autoTags = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            if(commonTag) autoTags = `${autoTags}, ${commonTag}`;
            const fileExt = file.name.split('.').pop();
            const timestamp = Date.now();
            const fileName = `logo_${timestamp}_${Math.floor(Math.random()*1000)}.${fileExt}`;
            const { error: uploadError } = await sb.storage.from('logos').upload(fileName, file);
            if (uploadError) { failCount++; continue; }
            const { data: publicData } = sb.storage.from('logos').getPublicUrl(fileName);
            const payload = {
                category: 'logo', tags: autoTags,
                thumb_url: publicData.publicUrl, data_url: publicData.publicUrl,
                created_at: new Date(),
                width: 500, height: 500, product_key: 'custom'
            };
            const { error: dbError } = await sb.from('library').insert([payload]);
            if (dbError) failCount++; else successCount++;
        }
        alert(`완료! 성공: ${successCount}개, 실패: ${failCount}개`);
        window.resetUpload(null);
        document.getElementById("logoUploadModal").style.display = "none";
        if (currentCategory === 'logo') searchTemplates('logo', '');
    } catch (e) {
        alert("시스템 오류: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

export function loadProductFixedTemplate(url) {
    if (!canvas || !url) return;
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "flex";
    fabric.Image.fromURL(url, (img) => {
        if(!img) { if(loading) loading.style.display = "none"; return; }
        const board = canvas.getObjects().find(o => o.isBoard);
        let tLeft = 0, tTop = 0, tW = canvas.width, tH = canvas.height;
        if (board) {
            tW = board.width * board.scaleX; tH = board.height * board.scaleY;
            tLeft = board.left; tTop = board.top;
        }
        const scaleX = tW / img.width; const scaleY = tH / img.height;
        img.set({
            scaleX: scaleX, scaleY: scaleY,
            left: tLeft + tW / 2, top: tTop + tH / 2, originX: 'center', originY: 'center',
            id: 'product_fixed_overlay', selectable: false, evented: false, excludeFromExport: false     
        });
        const old = canvas.getObjects().find(o=>o.id==='product_fixed_overlay');
        if(old) canvas.remove(old);
        canvas.add(img); canvas.bringToFront(img); canvas.requestRenderAll();
        if (loading) loading.style.display = "none";
    }, { crossOrigin: 'anonymous' });
}