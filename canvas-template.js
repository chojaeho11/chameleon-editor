/* canvas-template.js - 버튼 페이징 버전 */

import { sb, currentUser } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";
// [추가] 마일리지 적립 헬퍼 함수
async function addRewardPoints(userId, amount, desc) {
    try {
        const { data: pf } = await sb.from('profiles').select('mileage').eq('id', userId).single();
        const current = pf?.mileage || 0;
        await sb.from('profiles').update({ mileage: current + amount }).eq('id', userId);
        await sb.from('wallet_logs').insert({ user_id: userId, type: 'reward', amount: amount, description: desc });
    } catch(e) { console.error("적립 오류", e); }
}

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
// [1] 초기화 및 이벤트 리스너 설정 (수정됨)
export function initTemplateTools() {
    window.filterTpl = (type, btnElement) => {
        if (btnElement) {
            document.querySelectorAll(".tpl-cate-btn").forEach(b => b.classList.remove("active"));
            btnElement.classList.add("active");
        }
        currentCategory = type;
        const keyword = document.getElementById("tplSearchInput")?.value || "";
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

    // ▼▼▼ [여기부터 수정된 부분입니다] ▼▼▼
    
    // 1. "디자인 판매 등록" 버튼 클릭 시 모달 열기 (기존 btnRegisterTemplate 로직 대체)
    const btnOpenSell = document.getElementById("btnOpenSellModal");
    if(btnOpenSell) {
        btnOpenSell.onclick = () => {
            if (!currentUser) {
                alert("로그인이 필요한 서비스입니다.");
                document.getElementById('loginModal').style.display = 'flex';
                return;
            }
            // 모달 초기화
            const elTitle = document.getElementById("sellTitle");
            const elKw = document.getElementById("sellKw");
            const elCat = document.getElementById("sellCategory");
            
            if(elTitle) elTitle.value = "";
            if(elKw) elKw.value = "";
            if(elCat) elCat.value = "text";
            
            document.getElementById("sellModal").style.display = "flex";
        };
    }

    // 2. 모달 내 "등록하기" 버튼 연결 -> registerUserTemplate 함수 실행
    const btnConfirm = document.getElementById("btnSellConfirm");
    if(btnConfirm) btnConfirm.onclick = registerUserTemplate;
    
    // ▲▲▲ [수정 끝] ▲▲▲
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
window.changeModalTemplatePage = async function(direction) {
    const newPage = tplCurrentPage + direction;
    if (newPage < 0) return; 
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

        // [수정] 카테고리 필터 (예전 데이터 호환성 처리)
        if (tplLastCategory && tplLastCategory !== 'all') {
            // 'user_image' 탭 선택 시 -> 'user_image' + 예전 데이터('text') 모두 가져오기
            if (tplLastCategory === 'user_image') {
                query = query.in('category', ['user_image', 'text']);
            } 
            // 그 외(user_vector 등)는 해당 카테고리만 정확히 가져오기
            else {
                query = query.eq('category', tplLastCategory); 
            }
        }
        
        // 키워드 검색
        if (tplLastKeyword && tplLastKeyword.trim() !== '') {
            const expandedWords = expandSearchKeywords(tplLastKeyword);
            const orSearchCondition = expandedWords.map(w => `tags.ilike.%${w}%`).join(',');
            if (orSearchCondition) query = query.or(orSearchCondition);
        }

        // 제품 필터
        // const filterCondition = `product_key.eq.${currentKey},product_key.eq.custom,product_key.is.null`;
        // query = query.or(filterCondition);

        // 4. 실행
        const { data, error } = await query;
        
        if (error) throw error;

        // 5. 그리드 비우기 (데이터 렌더링 준비)
        grid.innerHTML = "";

        // 데이터가 없을 때
        if (!data || data.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">
        표시할 데이터가 없습니다.<br>
        ${pageIndex > 0 ? '<button class="btn-round" onclick="changeModalTemplatePage(-1)" style="margin-top:10px;">이전 페이지로 돌아가기</button>' : ''}
    </div>`;
    renderPaginationControls(true, 0); 
    tplIsLoading = false;
    return;
}

        // 6. 카드 렌더링
        data.forEach((item) => {
            const card = document.createElement("div");
            card.className = "tpl-item";
            const imgUrl = item.thumb_url || 'https://via.placeholder.com/300?text=No+Image';
            const displayTitle = item.tags ? item.tags.split(',')[0] : '무제';
            
            // [수정] 카테고리별 영문 뱃지 설정
            let badgeText = '';
            let badgeColor = '#64748b'; // 기본 회색

            switch(item.category) {
                case 'vector': badgeText = 'Vector'; badgeColor = '#7c3aed'; break; // 보라색
                // ▼▼▼ [추가할 부분] ▼▼▼
    case 'user_vector': badgeText = 'User Vector'; badgeColor = '#7c3aed'; break; // 보라색
    case 'user_image': badgeText = 'User Image'; badgeColor = '#059669'; break;   // 초록색
    // ▲▲▲ [추가 끝] ▲▲▲
                case 'photo-bg': badgeText = 'Image'; badgeColor = '#059669'; break; // 초록색
                case 'graphic': badgeText = 'PNG'; badgeColor = '#2563eb'; break; // 파란색
                case 'pattern': 
                case 'transparent-graphic': badgeText = 'Pattern'; badgeColor = '#db2777'; break; // 핑크색
                case 'logo': badgeText = 'Logo'; badgeColor = '#d97706'; break; // 주황색
                case 'text': badgeText = 'Text'; badgeColor = '#475569'; break; // 진한 회색
            }

            const isExclusive = item.product_key && item.product_key !== 'custom';
            let finalBadgeHtml = '';
            
            if (isExclusive) {
                // 전용 상품 (Exclusive)
                finalBadgeHtml = `<span style="position:absolute; top:8px; left:8px; background:#ef4444; color:white; font-size:10px; font-weight:bold; padding:3px 6px; border-radius:4px; z-index:2;">Exclusive</span>`;
            } else if (badgeText) {
                // 일반 카테고리 뱃지
                finalBadgeHtml = `<span style="position:absolute; top:8px; left:8px; background:${badgeColor}; color:white; font-size:10px; font-weight:bold; padding:3px 6px; border-radius:4px; z-index:2; text-transform:uppercase;">${badgeText}</span>`;
            }

            card.innerHTML = `
                ${finalBadgeHtml}
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
// ★ 하단 페이지네이션 버튼 그리기 함수 (가로폭 강제 축소)
// [수정 전 코드의 문제점]
// 1. 이전 버튼: changeTemplatePage(-1) -> 함수 이름 틀림 (changeModalTemplatePage여야 함)
// 2. 다음 버튼: prevBtn.onclick = ... -> 변수 이름 틀림 (nextBtn이어야 함)

// ▼▼▼ [수정된 코드] 복사해서 덮어씌우세요 ▼▼▼

function renderPaginationControls(isEnabled, dataCount = 0) {
    const grid = document.getElementById("tplGrid");
    if(!grid) return;

    // 기존 컨트롤 제거
    let controls = document.getElementById("tpl-pagination-controls");
    if(controls) controls.remove();

    controls = document.createElement("div");
    controls.id = "tpl-pagination-controls";
    controls.style.cssText = "grid-column: 1/-1; display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding-bottom: 30px;";

    const btnStyle = "width: auto !important; flex: none !important; padding: 0 15px; height: 34px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 17px; transition: all 0.2s; white-space: nowrap;";

    // 1. 이전 버튼
    const prevBtn = document.createElement("button");
    prevBtn.className = "btn-round"; 
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left" style="font-size:11px;"></i> 이전`;
    prevBtn.style.cssText = btnStyle;
    
    if (!isEnabled || tplCurrentPage === 0) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = "0.5";
        prevBtn.style.cursor = "not-allowed";
        prevBtn.style.background = "#f1f5f9"; 
        prevBtn.style.color = "#94a3b8";
        prevBtn.style.border = "1px solid #e2e8f0";
    } else {
        prevBtn.style.background = "#fff";
        prevBtn.style.border = "1px solid #cbd5e1";
        prevBtn.style.color = "#334155";
        // [수정 1] 함수 이름 변경: changeTemplatePage -> changeModalTemplatePage
        prevBtn.onclick = () => changeModalTemplatePage(-1);
    }

    // 2. 페이지 표시 텍스트
    const pageIndicator = document.createElement("span");
    pageIndicator.innerText = `${tplCurrentPage + 1} 페이지`;
    pageIndicator.style.cssText = "font-size: 13px; font-weight: 600; color: #64748b; margin: 0 10px; white-space: nowrap;";

    // 3. 다음 버튼
    const nextBtn = document.createElement("button");
    nextBtn.className = "btn-round";
    nextBtn.innerHTML = `다음 <i class="fa-solid fa-chevron-right" style="font-size:11px;"></i>`;
    nextBtn.style.cssText = btnStyle;

    if (!isEnabled || dataCount < TPL_PER_PAGE) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = "0.5";
        nextBtn.style.cursor = "not-allowed";
        nextBtn.style.background = "#f1f5f9";
        nextBtn.style.color = "#94a3b8";
        nextBtn.style.border = "1px solid #e2e8f0";
    } else {
        nextBtn.style.background = "#fff"; 
        nextBtn.style.border = "1px solid #6366f1";
        nextBtn.style.color = "#6366f1";
        // [수정 2] 변수 이름 변경: prevBtn -> nextBtn (여기가 원인이었습니다!)
        nextBtn.onclick = () => changeModalTemplatePage(1);
    }

    // ... (이후 마우스 오버 효과 코드는 그대로 유지)
    const addHover = (btn, isPrimary) => {
        if(btn.disabled) return;
        btn.onmouseover = () => { 
            btn.style.transform = "translateY(-1px)"; 
            if(isPrimary) { btn.style.background = "#6366f1"; btn.style.color = "#fff"; }
            else { btn.style.borderColor = "#94a3b8"; }
        };
        btn.onmouseout = () => { 
            btn.style.transform = "none"; 
            if(isPrimary) { btn.style.background = "#fff"; btn.style.color = "#6366f1"; }
            else { btn.style.borderColor = "#cbd5e1"; }
        };
    };

    addHover(prevBtn, false);
    addHover(nextBtn, true);

    controls.appendChild(prevBtn);
    controls.appendChild(pageIndicator);
    controls.appendChild(nextBtn);

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

        // ... (위쪽 코드 생략)

        const getSmartScale = (objWidth, objHeight) => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const bW = board ? (board.width * board.scaleX) : canvas.width;
            const bH = board ? (board.height * board.scaleY) : canvas.height;
            const category = selectedTpl.category || 'logo';
            
            // ▼▼▼ [수정된 부분] 배열에 'text'를 추가했습니다. ▼▼▼
            if (['photo-bg', 'vector', 'transparent-graphic', 'pattern', 'text'].includes(category)) {
                // 이 조건에 걸리면 화면을 꽉 채우게 됨 (Cover Fit)
                return Math.max(bW / objWidth, bH / objHeight) * 1.1; 
            } else {
                // 그 외(로고 등)는 화면의 1/3 크기로 작게 들어감
                return (bW / 3) / objWidth;
            }
        };

        // ... (아래쪽 코드 생략)

        const getCenterPos = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const bW = board ? (board.width * board.scaleX) : canvas.width;
            const bH = board ? (board.height * board.scaleY) : canvas.height;
            return { x: board.left + bW/2, y: board.top + bH/2 };
        };

        // [수정] 좌표 보정 및 개별 객체 로딩 (그룹화 방지)
        // [수정] 좌표 보정 및 개별 객체 로딩 (그룹화 방지)
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
            // JSON 벡터 데이터 처리
            let jsonData = finalJson;
            
            // 1. 저장된 데이터에서 '대지(Board)' 정보 찾기 (좌표 기준점용)
            const savedBoard = jsonData.objects.find(o => o.isBoard);
            
            // 2. 렌더링할 객체만 필터링 (대지 제외)
            const objectsToRender = jsonData.objects.filter(o => !o.isBoard);

            fabric.util.enlivenObjects(objectsToRender, (objs) => {
                if (objs.length === 0) { 
                    if(document.getElementById("loading")) document.getElementById("loading").style.display = "none"; 
                    return; 
                }

                // 3. 현재 캔버스의 대지 정보 가져오기
                const currentBoard = canvas.getObjects().find(o => o.isBoard);
                
                // 4. 좌표 및 스케일 계산
                let scale = 1;
                let moveX = 0;
                let moveY = 0;
                let useRelativePos = false;

                // 대지 정보가 둘 다 있다면 '상대 좌표' 계산 (가장 정확함)
                if (savedBoard && currentBoard) {
                    useRelativePos = true;
                    // 저장된 대지 너비 vs 현재 대지 너비 비율 계산
                    const savedW = savedBoard.width * savedBoard.scaleX;
                    const curW = currentBoard.width * currentBoard.scaleX;
                    
                    // 카테고리에 따라 꽉 채울지(Cover), 맞출지(Contain) 결정
                    const fullSizeCats = ['card', 'flyer', 'poster', 'banner-h', 'banner-v', 'menu', 'photo-bg', 'text'];
                    if(fullSizeCats.includes(selectedTpl.category)) {
                        scale = curW / savedW; // 가로폭에 맞춰 꽉 채움
                    } else {
                        scale = (curW / 3) / savedW; // 로고 등은 1/3 크기
                    }
                } 
                else {
                    // 대지 정보가 없는 구버전 데이터는 중앙 정렬 계산을 위해 임시 그룹 사용
                    const group = new fabric.Group(objs);
                    const center = getCenterPos();
                    scale = getSmartScale(group.width, group.height);
                    moveX = center.x - (group.left + group.width/2);
                    moveY = center.y - (group.top + group.height/2);
                    group.destroy(); // 계산만 하고 그룹 파괴
                }

                // 5. 객체 하나씩 좌표 보정하여 추가
                objs.forEach(obj => {
                    if (useRelativePos) {
                        // 저장된 보드 중심점 계산
                        const savedW = savedBoard.width * savedBoard.scaleX;
                        const savedCenterX = savedBoard.left + (savedW / 2);
                        const savedCenterY = savedBoard.top + (savedBoard.height * savedBoard.scaleY / 2);
                        
                        // 현재 보드 중심점 계산
                        const curW = currentBoard.width * currentBoard.scaleX;
                        const curCenterX = currentBoard.left + (curW / 2);
                        const curCenterY = currentBoard.top + (currentBoard.height * currentBoard.scaleY / 2);

                        // 중심점 기준 거리 차이 * 스케일
                        const distFromCenterTheX = (obj.left - savedCenterX) * scale;
                        const distFromCenterTheY = (obj.top - savedCenterY) * scale;

                        obj.set({
                            left: curCenterX + distFromCenterTheX,
                            top: curCenterY + distFromCenterTheY,
                            scaleX: obj.scaleX * scale,
                            scaleY: obj.scaleY * scale,
                            selectable: true,
                            evented: true,
                            hasControls: true,
                            hasBorders: true
                        });
                    } else {
                        // 구버전 데이터 (단순 중앙 이동)
                        obj.set({
                            left: obj.left + moveX,
                            top: obj.top + moveY,
                            scaleX: obj.scaleX * scale,
                            scaleY: obj.scaleY * scale,
                            selectable: true,
                            evented: true,
                            hasControls: true,
                            hasBorders: true
                        });
                    }
                    
                    obj.setCoords();
                    canvas.add(obj);
                });

                // 6. 편의를 위해 불러온 객체들을 '다중 선택' 상태로 만듦 (그룹핑 아님)
                if (objs.length > 0) {
                    const sel = new fabric.ActiveSelection(objs, { canvas: canvas });
                    canvas.setActiveObject(sel);
                }
                
                canvas.requestRenderAll();
                if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
                
                if (mode === 'replace') setTimeout(() => resetViewToCenter(), 100);
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

// [유틸] Base64 이미지를 Blob 파일로 변환 (파일 업로드용)
function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

// [핵심] 유저 디자인 등록 함수 (스토리지 업로드 + DB 저장)
async function registerUserTemplate() {
    if (!sb) return alert("데이터베이스 연결 실패");
    if (!currentUser) return alert("로그인이 필요합니다.");

    // 입력값 가져오기
    const titleEl = document.getElementById("sellTitle");
    const tagEl = document.getElementById("sellKw");
    
    // [수정] 무조건 'text' (유저 템플릿) 카테고리로 고정
    const selectedRadio = document.querySelector('input[name="sellType"]:checked');
const type = selectedRadio ? selectedRadio.value : "vector"; // 라디오 버튼 값 ('vector' 또는 'image')

// ★ 핵심: 시스템 템플릿과 섞이지 않게 'user_' 접두어를 붙여서 저장합니다.
const category = 'user_' + type; // 결과: 'user_vector' 또는 'user_image'

    const title = titleEl ? titleEl.value.trim() : "제목 없음";
    const tags = tagEl ? tagEl.value.trim() : "";

    if (!title) return alert("제목을 입력해주세요.");

    const btn = document.getElementById("btnSellConfirm");
    const originalText = btn.innerText;
    btn.innerText = "업로드 중...";
    btn.disabled = true;

    try {
        // 1. 캔버스 선택 해제 (깔끔한 썸네일 위해)
        canvas.discardActiveObject();
        canvas.requestRenderAll();

        // 2. 캔버스 데이터(JSON) 추출 (용량 최적화)
        const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth', 'selectable', 'evented']);

        // 3. 썸네일 이미지 생성
        const board = canvas.getObjects().find(o => o.isBoard);
        let dataUrl = "";
        
        // 뷰포트 잠시 초기화하여 정확한 이미지 추출
        const originalVpt = canvas.viewportTransform;
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

        // [수정] 썸네일 고화질 추출 (명함 등 작은 사이즈 대응)
        if (board) {
            const currentW = board.getScaledWidth();
            // 목표: 최소 1000px 너비 확보 (작은 명함도 선명하게)
            const minTargetW = 1000; 
            let multiplier = 1;
            
            if (currentW < minTargetW) {
                multiplier = minTargetW / currentW; 
            }

            dataUrl = canvas.toDataURL({
                format: 'jpeg', 
                quality: 0.9,
                left: board.left, 
                top: board.top,
                width: currentW, 
                height: board.getScaledHeight(),
                multiplier: multiplier // ★ 핵심: 강제 확대
            });
        } else {
            dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.9, multiplier: 2 });
        }
        canvas.setViewportTransform(originalVpt); // 복구

        // 4. Supabase Storage에 썸네일 업로드
        const blob = dataURLtoBlob(dataUrl);
        // 파일명: 유저ID/시간.jpg
        const fileName = `${currentUser.id}/${Date.now()}.jpg`;

        // 'templates' 버킷에 업로드
        const { error: uploadError } = await sb.storage
            .from('templates') 
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) throw uploadError;

        // 업로드된 이미지의 공개 주소 가져오기
        const { data: publicUrlData } = sb.storage
            .from('templates')
            .getPublicUrl(fileName);
        
        const finalThumbUrl = publicUrlData.publicUrl;

        // 5. Library 테이블에 데이터 저장
        const payload = {
            title: title,
            category: category,
            tags: tags,
            thumb_url: finalThumbUrl,
            data_url: json,
            created_at: new Date(),
            user_id: currentUser.id,
            user_email: currentUser.email,
            status: 'approved',
            is_official: false,
            product_key: canvas.currentProductKey || 'custom'
        };

        const { error: dbError } = await sb.from('library').insert([payload]);
        if (dbError) throw dbError;

        // 성공 처리
        await addRewardPoints(currentUser.id, 100, `템플릿 등록 보상 (${title})`);
        alert("🎉 디자인이 등록되었습니다! (+100P 적립)\n[템플릿] 탭에서 확인하세요.");
        document.getElementById("sellModal").style.display = "none";
        
        // 입력창 초기화
        if(titleEl) titleEl.value = "";
        if(tagEl) tagEl.value = "";
        
        // 템플릿 목록 새로고침 (현재 보고있는 카테고리가 같다면)
        if(window.filterTpl) window.filterTpl(category);

    } catch (e) {
        console.error("업로드 실패:", e);
        alert("업로드 실패: " + (e.message || e));
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        canvas.requestRenderAll();
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
            if (dbError) {
                failCount++;
            } else {
                successCount++;
                // 로고 1개당 150P 적립
                await addRewardPoints(currentUser.id, 150, `로고 공유 보상 (${files[i].name})`);
            }
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

// [추가] 시작 화면에서 선택한 템플릿을 에디터 로딩 후 적용하는 함수
window.applyStartTemplate = async function(tpl) {
    if (!tpl) return;
    console.log("Applying Start Template:", tpl);
    
    // 모듈 내부 변수(selectedTpl)에 할당
    selectedTpl = tpl; 
    
    // 기존 로딩 함수(processLoad)를 'replace' 모드로 실행
    await processLoad('replace');
};