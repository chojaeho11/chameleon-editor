/* canvas-template.js - 버튼 페이징 버전 */

import { sb, currentUser } from "./config.js?v=123";
import { canvas } from "./canvas-core.js?v=123";
import { applySize } from "./canvas-size.js?v=123";
// [수정] 판매 수익금(예치금) 적립 함수 (mileage가 아닌 deposit을 업데이트)
async function addRewardPoints(userId, amount, desc) {
    if (!userId) return;

    console.log(`[수익금 적립] 대상: ${userId}, 금액: ${amount}`);

    try {
        // 1. 현재 '예치금(deposit)' 조회 (mileage 아님!)
        const { data: pf, error: fetchErr } = await sb.from('profiles')
            .select('deposit')  // ★ 여기가 핵심: deposit 조회
            .eq('id', userId)
            .single();
        
        if (fetchErr) {
            console.error("예치금 조회 실패:", fetchErr);
        }

        // 숫자로 변환하여 계산 (문자열 합침 방지)
        const currentDeposit = parseInt(pf?.deposit || 0); 
        const addAmount = parseInt(amount);
        const newDeposit = currentDeposit + addAmount;

        // 2. 프로필 테이블의 'deposit' 컬럼 업데이트
        const { error: updateErr } = await sb.from('profiles')
            .update({ deposit: newDeposit }) // ★ 여기가 핵심: deposit 업데이트
            .eq('id', userId);
        
        if (updateErr) {
            console.error("수익금 업데이트 실패:", updateErr);
            alert(window.t('err_prefix', "Error: ") + updateErr.message);
            return;
        }

        // 3. 로그 기록 (type을 'deposit'이나 'revenue'로 구분하면 더 좋습니다)
        await sb.from('wallet_logs').insert({ 
            user_id: userId, 
            type: 'deposit', // ★ 타입 변경: reward -> deposit
            amount: addAmount, 
            description: desc 
        });

        console.log(`✅ 수익금 적립 완료: ${newDeposit}KRW`);

    } catch(e) { 
        console.error("시스템 오류:", e);
    }
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
const TPL_PER_PAGE = 12; // 한 페이지당 30개

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

    // [수정] 검색창 엔터키 및 입력 이벤트 연결
    const searchInput = document.getElementById("tplSearchInput");
    if (searchInput) {
        // 엔터키 누르면 검색 실행
        searchInput.onkeyup = (e) => {
            if (e.key === 'Enter') {
                searchTemplates(currentCategory, e.target.value);
            }
        };
        
        // (선택사항) '검색' 버튼이 있다면 연결 (없으면 무시됨)
        const searchBtn = document.getElementById("btnTplSearch");
        if(searchBtn) {
            searchBtn.onclick = () => {
                searchTemplates(currentCategory, searchInput.value);
            }
        }
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
                // [수정] 다국어 적용
                alert(window.t('msg_login_required', "Login required."));
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

// ★ 실제 데이터를 불러와서 그리는 함수 (그룹핑 로직 적용 수정판)
async function loadTemplatePage(pageIndex) {
    if (tplIsLoading) return;
    tplIsLoading = true;
    tplCurrentPage = pageIndex;

    const grid = document.getElementById("tplGrid");
    if (!grid) return;

    // 1. 로딩 표시
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</div>';

    // 2. 페이징 컨트롤 비활성화
    renderPaginationControls(false); 

    if (!sb) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red;">DB Not Connected</div>';
        tplIsLoading = false;
        return;
    }

    try {
        // 화면 크기에 따른 개수 설정
        const currentIsMobile = window.innerWidth < 768;
        const dynamicPerPage = currentIsMobile ? 8 : 12;

        let query = sb.from('library')
            .select('id, thumb_url, tags, category, product_key, created_at')
            .order('created_at', { ascending: false })
            .range(pageIndex * dynamicPerPage, (pageIndex + 1) * dynamicPerPage - 1);

        // ★ [수정 1] 쿼리 제약 해제: 카테고리 제한을 없애고 제품키(custom/null)만 필터링
        // (기존 코드에 있던 category.eq.user_vector 등은 삭제하여 모든 카테고리가 나올 수 있게 함)
        query = query.or('product_key.eq.custom,product_key.is.null,product_key.eq.""');
        
        // ★ [수정] 벡터를 객체 그룹으로 이동
        const groups = {
            'group_template': ['user_image', 'photo-bg', 'text'],
            'group_asset': ['vector', 'user_vector', 'graphic', 'transparent-graphic', 'pattern', 'logo']
        };

        if (tplLastCategory && tplLastCategory !== 'all') {
            if (groups[tplLastCategory]) {
                // 그룹 이름이 넘어오면 -> 배열에 포함된 모든 카테고리 검색 (.in)
                query = query.in('category', groups[tplLastCategory]);
            } else {
                // 단일 카테고리가 넘어오면 -> 해당 카테고리만 검색 (.eq)
                query = query.eq('category', tplLastCategory); 
            }
        }
        
        // 키워드 검색 로직
        if (tplLastKeyword && tplLastKeyword.trim() !== '') {
            const term = tplLastKeyword.trim();
            if (!isNaN(term)) {
                query = query.eq('id', term);
            } else {
                query = query.or(`tags.ilike.%${term}%,title.ilike.%${term}%`);
            }
        }

        // 4. 쿼리 실행
        const { data, error } = await query;
        if (error) throw error;

        // 5. 그리드 비우기
        grid.innerHTML = "";

        // 데이터 없음 처리
        if (!data || data.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">
                No data to display.<br>
                ${pageIndex > 0 ? '<button class="btn-round" onclick="changeModalTemplatePage(-1)" style="margin-top:10px;">Go back</button>' : ''}
            </div>`;
            renderPaginationControls(true, 0); 
            tplIsLoading = false;
            return;
        }

        // 6. 카드 렌더링
        data.forEach((item) => {
            const card = document.createElement("div");
            card.className = "tpl-item";
            
            const rawUrl = item.thumb_url || 'https://via.placeholder.com/200?text=No+Image';
            const imgUrl = window.getTinyThumb ? window.getTinyThumb(rawUrl, 200) : rawUrl;
            const displayTitle = item.tags ? item.tags.split(',')[0] : window.t('msg_untitled', 'Untitled');
            
            // 뱃지 설정
            let badgeText = '';
            let badgeColor = '#64748b';

            switch(item.category) {
                case 'vector': badgeText = 'VECTOR'; badgeColor = '#7c3aed'; break;
                case 'graphic': badgeText = 'PNG Object'; badgeColor = '#2563eb'; break;
                case 'logo': badgeText = 'LOGO'; badgeColor = '#d97706'; break;
                case 'user_vector': badgeText = 'USER VEC'; badgeColor = '#9333ea'; break;
                case 'user_image': badgeText = 'USER IMG'; badgeColor = '#059669'; break;
                case 'photo-bg': badgeText = 'IMAGE'; badgeColor = '#059669'; break;
                case 'transparent-graphic': badgeText = 'PATTERN'; badgeColor = '#db2777'; break;
            }

            const isExclusive = item.product_key && item.product_key !== 'custom';
            let finalBadgeHtml = '';
            
            if (isExclusive) {
                finalBadgeHtml = `<span style="position:absolute; top:8px; left:8px; background:#ef4444; color:white; font-size:10px; font-weight:bold; padding:3px 6px; border-radius:4px; z-index:2;">Exclusive</span>`;
            } else if (badgeText) {
                finalBadgeHtml = `<span style="position:absolute; top:8px; left:8px; background:${badgeColor}; color:white; font-size:10px; font-weight:bold; padding:3px 6px; border-radius:4px; z-index:2; text-transform:uppercase;">${badgeText}</span>`;
            }

            card.innerHTML = `
                ${finalBadgeHtml}
                <img src="${imgUrl}" class="tpl-item-img" loading="lazy">
                <div class="tpl-overlay-info">
                    <span class="tpl-name">${displayTitle}</span>
                    <button class="btn-use-mini" type="button">Apply Now</button>
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

        // 7. 페이지네이션 업데이트
        renderPaginationControls(true, data.length, dynamicPerPage);

    } catch (e) {
        console.error("로딩 에러:", e);
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:red;">
            Failed to load data.<br>
            <button class="btn-round" onclick="loadTemplatePage(${tplCurrentPage})" style="margin-top:10px;">Retry</button>
        </div>`;
    } finally {
        tplIsLoading = false;
    }
}

// [수정] limit(페이지당 개수)를 인자로 받아서 다음 버튼 활성화 여부를 판단
function renderPaginationControls(isEnabled, dataCount = 0, limit = 12) {
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
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left" style="font-size:11px;"></i> Prev`;
    prevBtn.style.cssText = btnStyle;
    
    // 0페이지면 이전 버튼 비활성화
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
        prevBtn.onclick = () => changeModalTemplatePage(-1);
    }

    // 2. 페이지 표시 텍스트
    const pageIndicator = document.createElement("span");
    pageIndicator.innerText = `Page ${tplCurrentPage + 1}`;
    pageIndicator.style.cssText = "font-size: 13px; font-weight: 600; color: #64748b; margin: 0 10px; white-space: nowrap;";

    // 3. 다음 버튼
    const nextBtn = document.createElement("button");
    nextBtn.className = "btn-round";
    nextBtn.innerHTML = `Next <i class="fa-solid fa-chevron-right" style="font-size:11px;"></i>`;
    nextBtn.style.cssText = btnStyle;

    // ★ 핵심 수정: 가져온 데이터(dataCount)가 설정된 개수(limit, 모바일은 8)보다 적을 때만 비활성화
    if (!isEnabled || dataCount < limit) {
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
        nextBtn.onclick = () => changeModalTemplatePage(1);
    }

    // 호버 효과
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
    if (!selectedTpl) return alert("Please select a template.");
    
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    
    if (objects.length > 0) {
        document.getElementById("templateActionModal").style.display = "flex";
    } else {
        processLoad('replace');
    }
}

// [최종 수정] 템플릿 로드 함수 (구형 데이터 잠금 해제 패치)
async function processLoad(mode) {
    if (!selectedTpl && window.selectedTpl) selectedTpl = window.selectedTpl;
    if (!selectedTpl) return alert(window.t('msg_no_template_selected', "No template selected."));

    document.getElementById("templateActionModal").style.display = "none"; 
    document.getElementById("templateOverlay").style.display = "none";
    document.getElementById("loading").style.display = "flex";

    try {
        // 1. 데이터 가져오기
        const { data, error } = await sb
            .from('library')
            .select('data_url, width, height, category') 
            .eq('id', selectedTpl.id)
            .single();

        if (error || !data) throw new Error(window.t('msg_data_load_failed', "Data load failed"));

        selectedTpl.width = data.width || 1000;
        selectedTpl.height = data.height || 1000;
        selectedTpl.category = data.category;

        // 배경으로 취급할 카테고리 정의
        const bgCategories = ['user_vector', 'user_image', 'photo-bg', 'vector', 'transparent-graphic', 'pattern'];
        const isBgMode = bgCategories.includes(selectedTpl.category);

        let rawData = data.data_url;
        let finalJson = null;
        let isImage = false;
        let imageUrl = "";

        try {
            if (typeof rawData === 'object') finalJson = rawData; 
            else finalJson = JSON.parse(rawData);
            
            if (typeof finalJson === 'string') { isImage = true; imageUrl = finalJson; }
            else isImage = false;
        } catch (e) {
            isImage = true; imageUrl = rawData;
        }

        // 기존 디자인 삭제 (대지, 가이드 제외)
        if (mode === 'replace') {
            const objects = canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay');
            objects.forEach(o => canvas.remove(o));
        }

        // 설정 적용 헬퍼 함수
        function applyTemplateSettings(obj) {
            const board = canvas.getObjects().find(o => o.isBoard);
            let bW = canvas.width, bH = canvas.height;
            let centerX = canvas.width/2, centerY = canvas.height/2;

            if (board) {
                bW = board.getScaledWidth();
                bH = board.getScaledHeight();
                centerX = board.left + bW/2;
                centerY = board.top + bH/2;
            }

            let finalScale = 1;

            if (isBgMode) {
                // 배경 모드: 꽉 채우기 (110% 여백 방지)
                finalScale = Math.max(bW / obj.width, bH / obj.height) * 1.1;
            } else {
                // 객체 모드: 적당히 줄이기 (30%)
                finalScale = (bW * 0.3) / obj.width; 
                if(finalScale > 1) finalScale = 1; 
            }
            
            obj.set({
                originX: 'center', originY: 'center',
                left: centerX, top: centerY,
                scaleX: finalScale, scaleY: finalScale
            });
            
            obj.setCoords();
        }

        // 레이어 정리 함수
        const arrangeLayers = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const guide = canvas.getObjects().find(o => o.id === 'product_fixed_overlay');
            const bgObjects = canvas.getObjects().filter(o => o.isTemplateBackground);
            
            if (board) canvas.sendToBack(board);
            bgObjects.forEach(bg => {
                canvas.sendToBack(bg);
                if(board) canvas.bringForward(bg);
            });
            if (guide) canvas.bringToFront(guide);
            canvas.requestRenderAll();
        };

        // 3. 로딩 실행
        if (isImage) {
            // [단일 이미지]
            const cleanUrl = String(imageUrl).trim().replace(/^"|"$/g, '');
            const isSvg = cleanUrl.toLowerCase().includes('.svg') || cleanUrl.startsWith('data:image/svg+xml');

            const callback = (obj) => {
                if(!obj) return;
                applyTemplateSettings(obj);
                
                // 단일 이미지는 배경 모드면 잠금, 아니면 해제
                if(isBgMode) {
                    obj.set({ selectable: false, evented: false, isTemplateBackground: true });
                } else {
                    obj.set({ selectable: true, evented: true, isTemplateBackground: false });
                }

                canvas.add(obj);
                arrangeLayers();
                canvas.discardActiveObject();
                canvas.requestRenderAll();

                // [강력 수정] 모바일 자동 맞춤 (버튼 클릭 + 스마트 함수)
                if (window.innerWidth < 768) {
                    // 1. 기존 '화면 맞춤' 버튼 강제 클릭 (가장 확실함)
                    const btnFit = document.getElementById('btnFitScreen');
                    if(btnFit) btnFit.click();

                    // 2. 0.2초 뒤 한번 더 정렬 (렌더링 딜레이 보정)
                    if (window.smartMobileFit) {
                        setTimeout(() => { window.smartMobileFit(); }, 200);
                    }
                }
                if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
            };

            if (isSvg) {
                fabric.loadSVGFromURL(cleanUrl, (objects, options) => {
                    if (!objects || objects.length === 0) return;
                    const group = fabric.util.groupSVGElements(objects, options);
                    callback(group);
                });
            } else {
                fabric.Image.fromURL(cleanUrl, (img) => {
                    if (!img || !img.width) return alert(window.t('msg_image_load_failed', "Image load failed"));
                    callback(img);
                }, { crossOrigin: 'anonymous' }); 
            }
        } else {
            // [JSON 데이터]
            let jsonData = finalJson;
            const objectsToRender = jsonData.objects.filter(o => !o.isBoard);

            fabric.util.enlivenObjects(objectsToRender, (objs) => {
                if (objs.length === 0) {
                    if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
                    return;
                }
                
                // 1. 그룹화하여 위치/크기 잡기
                const group = new fabric.Group(objs);
                applyTemplateSettings(group); 
                canvas.add(group);
                
                // 2. 그룹 해제
                canvas.setActiveObject(group);
                const items = group.toActiveSelection();
                canvas.discardActiveObject(); 

                // ★ [핵심 패치] 불러온 모든 객체의 잠금을 일단 강제로 다 풉니다.
                // (예전 데이터에 locked=true가 저장되어 있어도 여기서 무시됨)
                objs.forEach(o => {
                    o.set({ 
                        selectable: true, 
                        evented: true, 
                        lockMovementX: false, lockMovementY: false, 
                        lockRotation: false, lockScalingX: false, lockScalingY: false,
                        hasControls: true, 
                        isTemplateBackground: false 
                    });
                });

                // 3. 배경 모드일 때만 다시 잠금 (가장 큰 객체 찾기)
                if (isBgMode) {
                    let largestObj = null;
                    let maxArea = 0;

                    objs.forEach(o => {
                        if (o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') return;
                        const area = (o.width * o.scaleX) * (o.height * o.scaleY);
                        if (area > maxArea) {
                            maxArea = area;
                            largestObj = o;
                        }
                    });

                    // 가장 큰 객체를 배경으로 지정하고 잠금
                    if (largestObj) {
                        largestObj.set({
                            selectable: false, evented: false,
                            lockMovementX: true, lockMovementY: true,
                            hasControls: false,
                            isTemplateBackground: true
                        });
                        canvas.sendToBack(largestObj);
                    }
                }

                arrangeLayers();
                canvas.requestRenderAll();

                if (window.innerWidth < 768 && window.smartMobileFit) setTimeout(() => window.smartMobileFit(), 100);
                if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
            });
        }

    } catch (e) {
        console.error(e);
        if(document.getElementById("loading")) document.getElementById("loading").style.display = "none";
        alert(window.t('err_prefix', "Error: ") + e.message);
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

// [수정] 템플릿 등록 및 보상 지급 함수
// [수정] 템플릿 등록 함수
async function registerUserTemplate() {
    if (!sb) return alert(window.t('msg_db_connection_failed', "Database connection failed"));

    // 최신 유저 정보 확인
    const { data: { user: freshUser }, error: authError } = await sb.auth.getUser();

    if (authError || !freshUser) {
        alert(window.t('msg_session_expired', "Login session has expired. Please refresh."));
        return;
    }

    // 입력값 처리
    const titleEl = document.getElementById("sellTitle");
    const tagEl = document.getElementById("sellKw");
    const selectedRadio = document.querySelector('input[name="sellType"]:checked');
    const type = selectedRadio ? selectedRadio.value : "vector"; 
    const category = 'user_' + type; 
    const title = titleEl ? titleEl.value.trim() : "Untitled";
    const tags = tagEl ? tagEl.value.trim() : "";

    if (!title) return alert(window.t('msg_enter_title', "Please enter a title."));

    // AI 생성 이미지 포함 여부 체크
    const hasAiImage = canvas.getObjects().some(o => o.isAiGenerated === true);
    if (hasAiImage) {
        alert(window.t('msg_ai_image_not_allowed', "AI generated images cannot be registered as templates.\nPlease remove the AI image first."));
        return;
    }

    const btn = document.getElementById("btnSellConfirm");
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_saving', "Saving...");
    btn.disabled = true;

    try {
        // 1. 썸네일 생성 (대지 영역만 정확히 크롭)
        canvas.discardActiveObject();
        const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'fill', 'stroke', 'selectable', 'evented', 'isMockup', 'excludeFromExport', 'isEffectGroup', 'isMainText', 'isClone', 'paintFirst']);
        
        // 대지(Board) 객체 찾기
        const board = canvas.getObjects().find(o => o.isBoard === true);
        let dataUrl = "";

        // 현재 뷰포트 저장 후 초기화 (정확한 좌표 계산용)
        const originalVpt = canvas.viewportTransform.slice();
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

        if (board) {
            // 대지 크기와 위치 계산
            const boardWidth = board.getScaledWidth();
            const boardHeight = board.getScaledHeight();
            
            // 썸네일 너비를 약 800px로 맞추기 위한 배율 계산
            let multiplier = 1;
            if (boardWidth < 800) multiplier = 800 / boardWidth;

            // ★ 핵심: 대지 영역만 잘라서(Crop) 저장
            dataUrl = canvas.toDataURL({
                format: 'jpeg',
                quality: 0.9,
                left: board.left,   // 자르기 시작 X
                top: board.top,     // 자르기 시작 Y
                width: boardWidth,  // 자를 너비
                height: boardHeight, // 자를 높이
                multiplier: multiplier
            });
        } else {
            // 대지가 없으면 전체 저장 (안전장치)
            dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.8 });
        }

        // 뷰포트 복구
        canvas.setViewportTransform(originalVpt);

        const blob = dataURLtoBlob(dataUrl);
        const fileName = `${freshUser.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await sb.storage.from('templates').upload(fileName, blob);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = sb.storage.from('templates').getPublicUrl(fileName);

        // DB 저장
        const payload = {
            title: title,
            category: category,
            tags: tags,
            thumb_url: publicUrlData.publicUrl,
            data_url: json,
            created_at: new Date(),
            user_id: freshUser.id,
            user_email: freshUser.email,
            status: 'approved',
            is_official: false,
            // ★ [수정] 현재 편집 중인 상품 코드를 저장 (없으면 custom)
            product_key: window.currentProductKey || 'custom'
        };

        const { error: dbError } = await sb.from('library').insert([payload]);
        if (dbError) throw dbError;

        // ★ [핵심] 이제 'deposit(예치금)' 컬럼에 500원이 더해집니다.
        await addRewardPoints(freshUser.id, 500, `템플릿 판매등록 수익 (${title})`);

        // 환산된 보상 금액 표시
        const cfg = window.SITE_CONFIG || {};
        const tplRate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[cfg.COUNTRY]) || 1;
        const reward500 = 500 * tplRate;
        const rewardDisplay = cfg.COUNTRY === 'JP' ? '¥' + Math.floor(reward500) : cfg.COUNTRY === 'US' ? '$' + Math.round(reward500) : reward500.toLocaleString() + '원';

        alert(window.t('msg_design_registered', "Design Registered!"));
        document.getElementById("sellModal").style.display = "none";

        // 상단 금액 표시 갱신
        const balanceEl = document.getElementById('contributorBalance');
        if(balanceEl) {
            let current = parseFloat(balanceEl.innerText.replace(/[^0-9.]/g, '')) || 0;
            const newVal = current + reward500;
            balanceEl.innerText = cfg.COUNTRY === 'JP' ? '¥' + Math.floor(newVal).toLocaleString() : cfg.COUNTRY === 'US' ? '$' + Math.round(newVal).toLocaleString() : newVal.toLocaleString() + '원';
        }

        if(titleEl) titleEl.value = "";
        if(window.filterTpl) window.filterTpl(category);

    } catch (e) {
        console.error("등록 실패:", e);
        alert(window.t('err_prefix', "Error: ") + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
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
        dropText.innerHTML = `<span style="color:#6366f1; font-weight:800;">${files.length}</span> files selected.`;
        subText.innerText = "Click upload to register all.";
        if(keywordInput) { keywordInput.value = ""; keywordInput.placeholder = "Enter common tags"; }
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
    if(dropText) dropText.innerText = "Click to select files";
    if(subText) subText.innerText = "Or drag and drop files here";
    if(keywordInput) { keywordInput.value = ""; keywordInput.placeholder = "Ex: Samsung, Logo, Simple"; }
};

window.uploadUserLogo = async function() {
    const fileInput = document.getElementById("logoFileInput");
    const keywordInput = document.getElementById("logoKeywordInput");
    const files = fileInput.files;
    const commonTag = keywordInput.value.trim();
    if (files.length === 0) return alert(window.t('msg_select_image', "Please select an image!"));
    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true;
    let successCount = 0, failCount = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            btn.innerText = `${window.t('msg_uploading', "Uploading...")} (${i + 1}/${files.length})`;
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
                // 로고 1개당 150P(KRW) 적립
                await addRewardPoints(currentUser.id, 150, `로고 공유 보상 (${files[i].name})`);
            }
        }
        alert(window.t('msg_upload_complete', "Complete!") + ` ${window.t('msg_success', "Success")}: ${successCount}, ${window.t('msg_fail', "Fail")}: ${failCount}`);
        window.resetUpload(null);
        document.getElementById("logoUploadModal").style.display = "none";
        if (currentCategory === 'logo') searchTemplates('logo', '');
    } catch (e) {
        alert(window.t('msg_system_error', "System Error: ") + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// [수정] 제품 고정 가이드 로드 함수 (SVG/이미지 분기 처리 + 완전 잠금 + 변수명 오류 수정)
export function loadProductFixedTemplate(url) {
    if (!canvas || !url) return;
    
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "flex";

    // 1. SVG 파일 여부 확인
    const isSvg = url.toLowerCase().includes('.svg') || url.startsWith('data:image/svg+xml');

    // 2. 공통 적용할 설정 함수
    const applyFixedSettings = (obj) => {
        const board = canvas.getObjects().find(o => o.isBoard);
        
        let targetW = canvas.width;
        let targetH = canvas.height;
        let centerX = canvas.width / 2;
        let centerY = canvas.height / 2;

        if (board) {
            targetW = board.getScaledWidth();
            targetH = board.getScaledHeight();
            centerX = board.left + (targetW / 2);
            centerY = board.top + (targetH / 2);
        }

        // 스케일 계산 (대지 크기에 꽉 차게)
        // ★ [수정] 여기서 'img'가 아니라 'obj'를 사용해야 합니다.
        const scaleX = targetW / obj.width;
        const scaleY = targetH / obj.height;

        obj.set({
            scaleX: scaleX, 
            scaleY: scaleY,
            left: centerX, 
            top: centerY, 
            originX: 'center', 
            originY: 'center',
            id: 'product_fixed_overlay', // 고유 ID
            
            // ▼ 완전 잠금 (가이드 역할: 선택불가, 클릭통과)
            selectable: false,
            evented: false,         
            lockMovementX: true,
            lockMovementY: true,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
            hasControls: false,
            hasBorders: false,
            hoverCursor: 'default',
            
            excludeFromExport: false 
        });

        const old = canvas.getObjects().find(o => o.id === 'product_fixed_overlay');
        if(old) canvas.remove(old);

        canvas.add(obj);
        
        // ★ [수정] 가이드(T셔츠 등)는 로고보다 뒤에 있어야 하므로 '바닥'으로 보냄
        canvas.sendToBack(obj); 
        
        // 단, 흰색 대지(Board)보다는 위에 있어야 보임
        const boardObj = canvas.getObjects().find(o => o.isBoard);
        if (boardObj) {
            canvas.sendToBack(boardObj); // 대지를 맨 꼴찌로
            canvas.bringForward(obj);    // 가이드를 대지 바로 위로 (Layer 1)
        }
        
        canvas.requestRenderAll();
        
        if (loading) loading.style.display = "none";
    };

    // 3. 로딩 실행 (SVG vs 이미지)
    if (isSvg) {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects || objects.length === 0) {
                if (loading) loading.style.display = "none";
                return;
            }
            const group = fabric.util.groupSVGElements(objects, options);
            applyFixedSettings(group);
        });
    } else {
        fabric.Image.fromURL(url, (img) => {
            if (!img) {
                if (loading) loading.style.display = "none";
                return;
            }
            applyFixedSettings(img);
        }, { crossOrigin: 'anonymous' });
    }
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
// =========================================================
// ★ [최종 수정] 사이드바 로직 (닫힘 방지 + 배경 고정 강화)
// =========================================================

let sideCurrentPage = 0;
const SIDE_ITEMS_PER_PAGE = 10;
let sideCurrentGroup = 'group_template';
window._sideCurrentGroup = 'group_template';

// [1] 탭 전환 함수
window.switchSideGroup = function(group) {
    sideCurrentGroup = group;
    window._sideCurrentGroup = group;
    sideCurrentPage = 0;
    
    const btnTpl = document.getElementById('btnSideTabTpl');
    const btnObj = document.getElementById('btnSideTabObj');
    
    if (btnTpl && btnObj) {
        if (group === 'group_template') {
            btnTpl.style.background = '#6366f1'; btnTpl.style.color = '#fff'; btnTpl.style.border = 'none';
            btnObj.style.background = '#fff'; btnObj.style.color = '#64748b'; btnObj.style.border = '1px solid #e2e8f0';
        } else {
            btnObj.style.background = '#059669'; btnObj.style.color = '#fff'; btnObj.style.border = 'none';
            btnTpl.style.background = '#fff'; btnTpl.style.color = '#64748b'; btnTpl.style.border = '1px solid #e2e8f0';
        }
    }

    const searchInput = document.getElementById('sideTemplateSearch');
    if (searchInput) searchInput.value = '';

    if (group === 'group_text_tpl') {
        window.loadTextTemplates();
    } else {
        const pKey = window.currentProductKey || 'custom';
        window.loadSideBarTemplates(pKey, '', 0);
    }
};

// [2] 사이드바 로드 함수
window.loadSideBarTemplates = async function(targetProductKey, keyword = "", page = 0) {
    const drawer = document.getElementById("sub-template");
    const list = document.getElementById("sideTemplateList");
    if (!drawer || !list) return;

    // 서브패널이 아직 안 열려있으면 직접 열기 (toggleSubPanel 호출 X → 재귀 방지)
    if (drawer.style.display === 'none' || drawer.style.display === '') {
        drawer.style.display = 'flex';
        const sp = document.getElementById('subPanel');
        if (sp) sp.style.display = 'block';
        // 아이콘 active 처리
        document.querySelectorAll('.icon-item').forEach(i => i.classList.remove('active'));
        const icon = document.querySelector('.icon-item[data-panel="sub-template"]');
        if (icon) icon.classList.add('active');
    }
    
    sideCurrentPage = page;
    // [수정] 다국어 적용
    const loadingText = window.t('msg_loading', "Loading...");
    const msg = keyword ? `"${keyword}"...` : loadingText;
    list.innerHTML = `<div style="padding:40px 20px; text-align:center; color:#64748b; font-size:13px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:#6366f1; margin-bottom:10px;"></i><br>${msg}</div>`;

    try {
        const groups = {
            'group_template': ['user_vector', 'user_image', 'photo-bg'],
            'group_text_tpl': ['text'],
            'group_asset': ['vector', 'graphic', 'transparent-graphic', 'pattern', 'logo']
        };

        // 글씨 템플릿은 오래된 순 (ascending), 나머지는 최신순 (descending)
        const isAsc = (sideCurrentGroup === 'group_text_tpl');

        let query = sb.from('library')
            .select('id, thumb_url, title, category, product_key, tags')
            .eq('status', 'approved')
            .order('created_at', { ascending: isAsc })
            .range(sideCurrentPage * SIDE_ITEMS_PER_PAGE, (sideCurrentPage + 1) * SIDE_ITEMS_PER_PAGE - 1);

        const targetCats = groups[sideCurrentGroup];
        if(targetCats) query = query.in('category', targetCats);

        const pKey = targetProductKey || window.currentProductKey || 'custom';
        
        if (sideCurrentGroup === 'group_template' && pKey && pKey !== 'custom') {
             query = query.or(`product_key.eq.${pKey},product_key.eq.custom,product_key.is.null,product_key.eq.""`);
        } else {
             query = query.or(`product_key.eq.custom,product_key.is.null,product_key.eq.""`);
        }

        if (keyword && keyword.trim() !== "") {
            const term = keyword.trim();
            query = query.or(`title.ilike.%${term}%,tags.ilike.%${term}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        list.innerHTML = "";
        
        if (!data || data.length === 0) {
            // [수정] 다국어 적용
            const noDataMsg = window.t('msg_no_data', "No data.");
            const retryBtn = window.t('btn_retry', "Retry"); 
            list.innerHTML = `
                <div style="padding:60px 20px; text-align:center; color:#94a3b8; font-size:13px;">
                    <i class="fa-solid fa-folder-open" style="font-size:30px; margin-bottom:10px; opacity:0.5;"></i><br>
                    ${noDataMsg}<br>
                    ${page > 0 ? `<button class="btn-round" style="margin-top:15px; width:auto; padding:8px 15px;" onclick="window.loadSideBarTemplates('${pKey}', '${keyword}', 0)">First Page</button>` : ''}
                </div>`;
            return;
        }

        data.forEach((tpl) => {
            const div = document.createElement("div");
            div.className = "side-tpl-card";
            const imgUrl = window.getTinyThumb ? window.getTinyThumb(tpl.thumb_url, 200) : tpl.thumb_url;

            let badgeHtml = "";
            if (sideCurrentGroup === 'group_asset' && tpl.category === 'vector') {
                badgeHtml = `<div style="position:absolute; top:8px; left:8px; background:#7c3aed; color:white; font-size:10px; padding:3px 6px; border-radius:4px; font-weight:bold;">Vector</div>`;
            }

            div.innerHTML = `
                ${badgeHtml}
                <img src="${imgUrl}" class="side-tpl-img" loading="lazy">
                <div class="side-tpl-info">
                    ${tpl.title || tpl.tags || window.t('msg_untitled', 'Untitled')}
                </div>
            `;

            div.onclick = async () => {
                // ★ [수정 1] 클릭해도 사이드바 닫지 않음 (모바일 코드 제거)
                
                window.selectedTpl = tpl;

                if (sideCurrentGroup === 'group_template') {
                    if(confirm(window.t('confirm_apply_bg', "Apply this background design?\n(Current background will be replaced)"))) {
                        window.processLoad('replace');
                    }
                } else {
                    window.processLoad('add'); 
                }
            };
            list.appendChild(div);
        });

        // 페이징 버튼
        const paginationDiv = document.createElement("div");
        paginationDiv.className = "sidebar-pagination";
        paginationDiv.style.cssText = "display:flex; justify-content:center; gap:10px; padding:15px 0; margin-top:auto;";

        const prevBtn = document.createElement("button");
        prevBtn.className = "side-page-btn";
        prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
        prevBtn.disabled = (sideCurrentPage === 0);
        prevBtn.onclick = () => window.loadSideBarTemplates(pKey, keyword, sideCurrentPage - 1);

        const pageLabel = document.createElement("span");
        pageLabel.innerText = `${sideCurrentPage + 1}`;
        pageLabel.style.cssText = "font-weight:bold; color:#64748b; font-size:14px; line-height:32px;";

        const nextBtn = document.createElement("button");
        nextBtn.className = "side-page-btn";
        nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
        nextBtn.disabled = (data.length < SIDE_ITEMS_PER_PAGE); 
        nextBtn.onclick = () => window.loadSideBarTemplates(pKey, keyword, sideCurrentPage + 1);

        paginationDiv.appendChild(prevBtn);
        paginationDiv.appendChild(pageLabel);
        paginationDiv.appendChild(nextBtn);

        list.appendChild(paginationDiv);

    } catch (e) {
        console.error("사이드바 로드 실패:", e);
        list.innerHTML = `<div style="padding:20px; text-align:center; color:red; font-size:12px;">${window.t('msg_error_occurred', 'An error occurred.')}</div>`;
    }
};

// [2-B] 글씨 템플릿 프리셋 로드 (텍스트 효과 포함)
const TEXT_TPL_PRESETS = [
    {
        bg: 'linear-gradient(135deg, #667eea, #764ba2)',
        titleStyle: { fontSize: 40, fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Arial',
            stroke: '#1e1b4b', strokeWidth: 2, shadow: '3px 3px 6px rgba(0,0,0,0.6)' },
        subStyle: { fontSize: 18, fill: '#ddd6fe', fontFamily: 'Arial', shadow: '2px 2px 4px rgba(0,0,0,0.4)' },
        previewCss: 'text-shadow:2px 2px 4px rgba(0,0,0,0.6); -webkit-text-stroke:1px #1e1b4b;',
        texts: {
            KR: { title: 'GRAND OPENING', sub: '최고의 서비스를 만나보세요' },
            JP: { title: 'GRAND OPENING', sub: '最高のサービスをお届けします' },
            EN: { title: 'GRAND OPENING', sub: 'Best Quality Service' },
            CN: { title: 'GRAND OPENING', sub: '体验最优质的服务' },
            AR: { title: 'GRAND OPENING', sub: 'أفضل خدمة جودة' },
            ES: { title: 'GRAND OPENING', sub: 'Servicio de la Mejor Calidad' },
            DE: { title: 'GRAND OPENING', sub: 'Bester Qualitätsservice' },
            FR: { title: 'GRAND OPENING', sub: 'Service de Qualité Supérieure' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #f093fb, #f5576c)',
        titleStyle: { fontSize: 44, fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Impact',
            stroke: '#000000', strokeWidth: 3, shadow: '4px 4px 0px #000000' },
        subStyle: { fontSize: 16, fill: '#fce7f3', fontFamily: 'Arial', shadow: '2px 2px 0px rgba(0,0,0,0.5)' },
        previewCss: 'text-shadow:3px 3px 0px #000; -webkit-text-stroke:1px #000;',
        texts: {
            KR: { title: 'SPECIAL SALE', sub: '최대 50% 할인' },
            JP: { title: 'SPECIAL SALE', sub: '最大50%OFF' },
            EN: { title: 'SPECIAL SALE', sub: 'Up to 50% OFF' },
            CN: { title: 'SPECIAL SALE', sub: '最高五折优惠' },
            AR: { title: 'SPECIAL SALE', sub: 'خصم يصل إلى 50%' },
            ES: { title: 'SPECIAL SALE', sub: 'Hasta 50% de Descuento' },
            DE: { title: 'SPECIAL SALE', sub: 'Bis zu 50% Rabatt' },
            FR: { title: 'SPECIAL SALE', sub: "Jusqu'à 50% de Réduction" }
        }
    },
    {
        bg: 'linear-gradient(135deg, #43e97b, #38f9d7)',
        titleStyle: { fontSize: 38, fontWeight: 'bold', fill: '#065f46', fontFamily: 'Georgia',
            shadow: '2px 2px 8px rgba(6,95,70,0.3)' },
        subStyle: { fontSize: 16, fill: '#064e3b', fontFamily: 'Georgia', shadow: '1px 1px 4px rgba(0,0,0,0.15)' },
        previewCss: 'text-shadow:2px 2px 6px rgba(6,95,70,0.4);',
        texts: {
            KR: { title: 'FRESH & NATURAL', sub: '신선한 자연의 맛' },
            JP: { title: 'FRESH & NATURAL', sub: '新鮮な自然の味わい' },
            EN: { title: 'FRESH & NATURAL', sub: 'Organic Products' },
            CN: { title: 'FRESH & NATURAL', sub: '新鲜天然有机产品' },
            AR: { title: 'FRESH & NATURAL', sub: 'منتجات عضوية طبيعية' },
            ES: { title: 'FRESH & NATURAL', sub: 'Productos Orgánicos' },
            DE: { title: 'FRESH & NATURAL', sub: 'Bio-Produkte' },
            FR: { title: 'FRESH & NATURAL', sub: 'Produits Biologiques' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #fa709a, #fee140)',
        titleStyle: { fontSize: 42, fontWeight: 'bold', fill: '#7c2d12', fontFamily: 'Arial',
            stroke: '#ffffff', strokeWidth: 2, shadow: '3px 3px 6px rgba(0,0,0,0.3)' },
        subStyle: { fontSize: 16, fill: '#9a3412', fontFamily: 'Arial', shadow: '1px 1px 3px rgba(0,0,0,0.2)' },
        previewCss: 'text-shadow:2px 2px 4px rgba(0,0,0,0.3); -webkit-text-stroke:0.5px #fff;',
        texts: {
            KR: { title: 'WELCOME', sub: '방문해 주셔서 감사합니다' },
            JP: { title: 'WELCOME', sub: 'ご来店ありがとうございます' },
            EN: { title: 'WELCOME', sub: "We're Happy To See You" },
            CN: { title: 'WELCOME', sub: '欢迎光临' },
            AR: { title: 'WELCOME', sub: 'سعداء برؤيتكم' },
            ES: { title: 'WELCOME', sub: 'Encantados de Verte' },
            DE: { title: 'WELCOME', sub: 'Wir Freuen Uns auf Sie' },
            FR: { title: 'WELCOME', sub: 'Heureux de Vous Voir' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        titleStyle: { fontSize: 40, fontWeight: 'bold', fill: '#a78bfa', fontFamily: 'Arial',
            shadow: '0 0 10px #7c3aed, 0 0 20px #7c3aed, 0 0 40px #6d28d9' },
        subStyle: { fontSize: 16, fill: '#c4b5fd', fontFamily: 'Arial', shadow: '0 0 8px #7c3aed' },
        previewCss: 'text-shadow:0 0 8px #7c3aed, 0 0 15px #6d28d9; color:#a78bfa;',
        texts: {
            KR: { title: 'NEW ARRIVAL', sub: '신상품을 확인하세요' },
            JP: { title: 'NEW ARRIVAL', sub: '新商品をチェック' },
            EN: { title: 'NEW ARRIVAL', sub: 'Check Out Our Latest' },
            CN: { title: 'NEW ARRIVAL', sub: '查看最新商品' },
            AR: { title: 'NEW ARRIVAL', sub: 'تحقق من أحدث المنتجات' },
            ES: { title: 'NEW ARRIVAL', sub: 'Descubre lo Nuevo' },
            DE: { title: 'NEW ARRIVAL', sub: 'Entdecke das Neueste' },
            FR: { title: 'NEW ARRIVAL', sub: 'Découvrez les Nouveautés' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #ff9a9e, #fecfef)',
        titleStyle: { fontSize: 36, fontWeight: 'bold', fill: '#be123c', fontFamily: 'Georgia',
            shadow: '0 4px 8px rgba(190,18,60,0.25)' },
        subStyle: { fontSize: 16, fill: '#9f1239', fontFamily: 'Georgia', shadow: '0 2px 4px rgba(0,0,0,0.1)' },
        previewCss: 'text-shadow:0 3px 6px rgba(190,18,60,0.3);',
        texts: {
            KR: { title: 'THANK YOU', sub: '항상 감사드립니다' },
            JP: { title: 'THANK YOU', sub: 'いつもありがとうございます' },
            EN: { title: 'THANK YOU', sub: 'For Your Support' },
            CN: { title: 'THANK YOU', sub: '感谢您的支持' },
            AR: { title: 'THANK YOU', sub: 'شكراً لدعمكم' },
            ES: { title: 'THANK YOU', sub: 'Por Tu Apoyo' },
            DE: { title: 'THANK YOU', sub: 'Für Ihre Unterstützung' },
            FR: { title: 'THANK YOU', sub: 'Pour Votre Soutien' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #f6d365, #fda085)',
        titleStyle: { fontSize: 44, fontWeight: 'bold', fill: '#fbbf24', fontFamily: 'Impact',
            stroke: '#78350f', strokeWidth: 3, shadow: '3px 3px 0px #451a03' },
        subStyle: { fontSize: 16, fill: '#78350f', fontFamily: 'Arial', stroke: '#fde68a', strokeWidth: 1 },
        previewCss: 'text-shadow:2px 2px 0px #451a03; -webkit-text-stroke:1px #78350f; color:#fbbf24;',
        texts: {
            KR: { title: 'HOT DEAL', sub: '한정 특가 이벤트' },
            JP: { title: 'HOT DEAL', sub: '期間限定セール' },
            EN: { title: 'HOT DEAL', sub: 'Limited Time Offer' },
            CN: { title: 'HOT DEAL', sub: '限时特惠' },
            AR: { title: 'HOT DEAL', sub: 'عرض لفترة محدودة' },
            ES: { title: 'HOT DEAL', sub: 'Oferta por Tiempo Limitado' },
            DE: { title: 'HOT DEAL', sub: 'Zeitlich Begrenztes Angebot' },
            FR: { title: 'HOT DEAL', sub: 'Offre à Durée Limitée' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #0c3483, #a2b6df)',
        titleStyle: { fontSize: 38, fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Georgia',
            stroke: '#bfdbfe', strokeWidth: 1, shadow: '0 0 15px rgba(99,102,241,0.5), 0 0 30px rgba(99,102,241,0.3)' },
        subStyle: { fontSize: 16, fill: '#bfdbfe', fontFamily: 'Georgia', shadow: '0 0 8px rgba(99,102,241,0.3)' },
        previewCss: 'text-shadow:0 0 10px rgba(99,102,241,0.6), 0 0 20px rgba(99,102,241,0.3);',
        texts: {
            KR: { title: 'PREMIUM', sub: '프리미엄 럭셔리 컬렉션' },
            JP: { title: 'PREMIUM', sub: 'ラグジュアリーコレクション' },
            EN: { title: 'PREMIUM', sub: 'Luxury Collection' },
            CN: { title: 'PREMIUM', sub: '奢华精品系列' },
            AR: { title: 'PREMIUM', sub: 'مجموعة فاخرة' },
            ES: { title: 'PREMIUM', sub: 'Colección de Lujo' },
            DE: { title: 'PREMIUM', sub: 'Luxus-Kollektion' },
            FR: { title: 'PREMIUM', sub: 'Collection de Luxe' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #ff0844, #ffb199)',
        titleStyle: { fontSize: 40, fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Arial',
            stroke: '#be123c', strokeWidth: 2, shadow: '3px 3px 0px #7f1d1d' },
        subStyle: { fontSize: 16, fill: '#ffe4e6', fontFamily: 'Arial', shadow: '2px 2px 3px rgba(0,0,0,0.3)' },
        previewCss: 'text-shadow:2px 2px 0px #7f1d1d; -webkit-text-stroke:1px #be123c;',
        texts: {
            KR: { title: 'BEST PRICE', sub: '최저가 보장' },
            JP: { title: 'BEST PRICE', sub: '最安値保証' },
            EN: { title: 'BEST PRICE', sub: 'Guaranteed Lowest' },
            CN: { title: 'BEST PRICE', sub: '保证最低价' },
            AR: { title: 'BEST PRICE', sub: 'أقل سعر مضمون' },
            ES: { title: 'BEST PRICE', sub: 'Precio Más Bajo Garantizado' },
            DE: { title: 'BEST PRICE', sub: 'Garantiert Günstigster Preis' },
            FR: { title: 'BEST PRICE', sub: 'Prix le Plus Bas Garanti' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #96fbc4, #f9f586)',
        titleStyle: { fontSize: 36, fontWeight: 'bold', fill: '#065f46', fontFamily: 'Arial',
            stroke: '#ffffff', strokeWidth: 2, shadow: '2px 2px 4px rgba(0,0,0,0.2)' },
        subStyle: { fontSize: 16, fill: '#047857', fontFamily: 'Arial', stroke: '#ffffff', strokeWidth: 1 },
        previewCss: '-webkit-text-stroke:0.5px #fff; text-shadow:1px 1px 3px rgba(0,0,0,0.2);',
        texts: {
            KR: { title: 'FREE DELIVERY', sub: '무료 배송 서비스' },
            JP: { title: 'FREE DELIVERY', sub: '送料無料サービス' },
            EN: { title: 'FREE DELIVERY', sub: 'Order Now' },
            CN: { title: 'FREE DELIVERY', sub: '免费配送服务' },
            AR: { title: 'FREE DELIVERY', sub: 'اطلب الآن' },
            ES: { title: 'FREE DELIVERY', sub: 'Ordena Ahora' },
            DE: { title: 'FREE DELIVERY', sub: 'Jetzt Bestellen' },
            FR: { title: 'FREE DELIVERY', sub: 'Commandez Maintenant' }
        }
    },
    {
        bg: 'linear-gradient(135deg, #0f0c29, #302b63)',
        titleStyle: { fontSize: 42, fontWeight: 'bold', fill: '#ff00aa', fontFamily: 'Impact',
            shadow: '0 0 10px #ff00aa, 0 0 25px #ff66cc, 0 0 50px #ff00aa' },
        subStyle: { fontSize: 16, fill: '#ff66cc', fontFamily: 'Arial', shadow: '0 0 8px #ff00aa' },
        previewCss: 'text-shadow:0 0 8px #ff00aa, 0 0 15px #ff66cc; color:#ff00aa;',
        texts: {
            KR: { title: 'OPEN NOW', sub: '지금 오픈했습니다' },
            JP: { title: 'OPEN NOW', sub: 'ただいまオープン中' },
            EN: { title: 'OPEN NOW', sub: 'Visit Us Today' },
            CN: { title: 'OPEN NOW', sub: '现在开业中' },
            AR: { title: 'OPEN NOW', sub: 'زورونا اليوم' },
            ES: { title: 'OPEN NOW', sub: 'Visítenos Hoy' },
            DE: { title: 'OPEN NOW', sub: 'Besuchen Sie Uns Heute' },
            FR: { title: 'OPEN NOW', sub: "Visitez-Nous Aujourd'hui" }
        }
    },
    {
        bg: 'linear-gradient(135deg, #1e3c72, #2a5298)',
        titleStyle: { fontSize: 38, fontWeight: 'bold', fill: '#fbbf24', fontFamily: 'Georgia',
            stroke: '#78350f', strokeWidth: 1, shadow: '2px 2px 6px rgba(0,0,0,0.5)' },
        subStyle: { fontSize: 16, fill: '#fde68a', fontFamily: 'Georgia', shadow: '1px 1px 4px rgba(0,0,0,0.4)' },
        previewCss: 'text-shadow:2px 2px 4px rgba(0,0,0,0.5); -webkit-text-stroke:0.5px #78350f;',
        texts: {
            KR: { title: 'HAPPY HOLIDAY', sub: '즐거운 시즌을 보내세요' },
            JP: { title: 'HAPPY HOLIDAY', sub: '素敵なシーズンをお過ごしください' },
            EN: { title: 'HAPPY HOLIDAY', sub: 'Enjoy the Season' },
            CN: { title: 'HAPPY HOLIDAY', sub: '享受美好时光' },
            AR: { title: 'HAPPY HOLIDAY', sub: 'استمتع بالموسم' },
            ES: { title: 'HAPPY HOLIDAY', sub: 'Disfruta la Temporada' },
            DE: { title: 'HAPPY HOLIDAY', sub: 'Genießen Sie die Saison' },
            FR: { title: 'HAPPY HOLIDAY', sub: 'Profitez de la Saison' }
        }
    }
];

// 마법사 버튼 데이터
const WIZARD_BTNS = [
    { key: 'basic',  icon: 'fa-store',       color: '#6366f1', i18n: 'wiz_flyer',       label: '전단지' },
    { key: 'flyer',  icon: 'fa-bullhorn',     color: '#ef4444', i18n: 'wiz_poster',      label: '포스터' },
    { key: 'card',   icon: 'fa-address-card', color: '#22c55e', i18n: 'wiz_card',        label: '명함' },
    { key: 'menu',   icon: 'fa-utensils',     color: '#f97316', i18n: 'wiz_menu',        label: '메뉴판' },
    { key: 'banner-h', icon: 'fa-scroll',     color: '#3b82f6', i18n: 'wiz_banner_h',    label: '가로현수막' },
    { key: 'banner-v', icon: 'fa-flag',       color: '#8b5cf6', i18n: 'wiz_banner_v',    label: '세로배너' },
    { key: 'fabric', icon: 'fa-shirt',        color: '#ec4899', i18n: '',                 label: 'SALE' },
    { key: 'vertical-text', icon: 'fa-text-height', color: '#14b8a6', i18n: 'wiz_insta_panel', label: '인스타판넬' }
];

window.loadTextTemplates = function(keyword) {
    const list = document.getElementById('sideTemplateList');
    if (!list) return;
    list.innerHTML = '';

    const country = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
    var kw = (keyword || '').trim().toLowerCase();

    // --- 마법사 버튼 섹션 ---
    if (!kw) {
        var wizSection = document.createElement('div');
        wizSection.innerHTML = '<div style="font-size:11px; font-weight:bold; color:#64748b; margin-bottom:6px;" data-i18n="editor_design_wizard">🧙 디자인 마법사</div>';
        var wizGrid = document.createElement('div');
        wizGrid.style.cssText = 'display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:15px;';
        WIZARD_BTNS.forEach(function(wb) {
            var btn = document.createElement('button');
            btn.style.cssText = 'background:none; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 2px; border-radius:8px; transition:background 0.15s;';
            btn.onmouseenter = function() { btn.style.background = '#f1f5f9'; };
            btn.onmouseleave = function() { btn.style.background = 'none'; };
            btn.innerHTML =
                '<div style="width:32px; height:32px; border-radius:8px; background:' + wb.color + '; display:flex; align-items:center; justify-content:center;">' +
                '<i class="fa-solid ' + wb.icon + '" style="color:#fff; font-size:13px;"></i></div>' +
                '<span style="font-size:9px; font-weight:600; color:#64748b; white-space:nowrap;"' +
                (wb.i18n ? ' data-i18n="' + wb.i18n + '"' : '') + '>' + wb.label + '</span>';
            btn.onclick = function() { window.applyNewWizard && window.applyNewWizard(wb.key); };
            wizGrid.appendChild(btn);
        });
        wizSection.appendChild(wizGrid);
        list.appendChild(wizSection);

        // 구분선
        var divider = document.createElement('div');
        divider.style.cssText = 'height:1px; background:#e2e8f0; margin-bottom:12px;';
        list.appendChild(divider);

        // 제목
        var title = document.createElement('div');
        title.style.cssText = 'font-size:11px; font-weight:bold; color:#64748b; margin-bottom:8px;';
        title.setAttribute('data-i18n', 'editor_tab_text_tpl');
        title.textContent = window.t ? window.t('editor_tab_text_tpl', '글씨 템플릿') : '글씨 템플릿';
        list.appendChild(title);
    }

    // --- 글씨 템플릿 프리셋 ---
    var filtered = TEXT_TPL_PRESETS.filter(function(preset) {
        if (!kw) return true;
        var t = preset.texts[country] || preset.texts['EN'];
        return (t.title.toLowerCase().indexOf(kw) >= 0 || t.sub.toLowerCase().indexOf(kw) >= 0);
    });

    if (filtered.length === 0 && kw) {
        list.innerHTML += '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:30px;">' + window.t('msg_no_search_result', 'No results') + '</div>';
        return;
    }

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;';

    filtered.forEach(function(preset, idx) {
        var t = preset.texts[country] || preset.texts['EN'];
        var card = document.createElement('div');
        card.style.cssText = 'cursor:pointer; border-radius:10px; overflow:hidden; aspect-ratio:1; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; text-align:center; background:' + preset.bg + '; transition:transform 0.15s;';
        card.onmouseenter = function() { card.style.transform = 'scale(1.03)'; };
        card.onmouseleave = function() { card.style.transform = 'scale(1)'; };

        var titleSize = Math.round(preset.titleStyle.fontSize * 0.35);
        var subSize = Math.round(preset.subStyle.fontSize * 0.6);
        var css = preset.previewCss || '';

        card.innerHTML =
            '<div style="font-size:' + titleSize + 'px; font-weight:bold; color:' + preset.titleStyle.fill + '; font-family:' + preset.titleStyle.fontFamily + '; line-height:1.2; margin-bottom:4px; word-break:break-word; ' + css + '">' + t.title + '</div>' +
            '<div style="font-size:' + subSize + 'px; color:' + preset.subStyle.fill + '; font-family:' + preset.subStyle.fontFamily + '; line-height:1.3; word-break:break-word;">' + t.sub + '</div>';

        card.onclick = function() {
            window.applyTextTemplate(preset, idx);
        };
        grid.appendChild(card);
    });

    list.appendChild(grid);
};

window.applyTextTemplate = function(preset, idx) {
    if (!canvas) return;
    var country = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
    var t = preset.texts[country] || preset.texts['EN'];

    // 대지 크기 기준으로 폰트 크기 조정
    var board = canvas.getObjects().find(function(o) { return o.isBoard; });
    var baseW = board ? board.width * board.scaleX : 800;
    var sc = baseW / 800;
    var titleFontSize = Math.round(preset.titleStyle.fontSize * sc);
    var subFontSize = Math.round(preset.subStyle.fontSize * sc);

    // 타이틀 효과 속성 구성
    var titleProps = {
        fontSize: titleFontSize,
        fontWeight: preset.titleStyle.fontWeight || 'bold',
        fill: preset.titleStyle.fill,
        fontFamily: preset.titleStyle.fontFamily || 'Arial',
        originX: 'center', originY: 'center',
        textAlign: 'center', editable: true, paintFirst: 'stroke'
    };
    if (preset.titleStyle.stroke) { titleProps.stroke = preset.titleStyle.stroke; titleProps.strokeWidth = (preset.titleStyle.strokeWidth || 1) * sc; }
    if (preset.titleStyle.shadow) titleProps.shadow = new fabric.Shadow(preset.titleStyle.shadow);

    // 서브 효과 속성 구성
    var subProps = {
        fontSize: subFontSize,
        fill: preset.subStyle.fill,
        fontFamily: preset.subStyle.fontFamily || 'Arial',
        originX: 'center', originY: 'center',
        textAlign: 'center', editable: true, paintFirst: 'stroke'
    };
    if (preset.subStyle.stroke) { subProps.stroke = preset.subStyle.stroke; subProps.strokeWidth = (preset.subStyle.strokeWidth || 1) * sc; }
    if (preset.subStyle.shadow) subProps.shadow = new fabric.Shadow(preset.subStyle.shadow);

    var titleObj = new fabric.IText(t.title, titleProps);
    var subObj = new fabric.IText(t.sub, subProps);

    // addToCenter로 대지 중앙에 배치
    if (window.addToCenter) {
        window.addToCenter(titleObj);
        window.addToCenter(subObj);
    } else {
        canvas.add(titleObj);
        canvas.add(subObj);
    }

    // 타이틀 위, 서브 아래 오프셋
    var gap = titleFontSize * 0.6;
    titleObj.set('top', titleObj.top - gap);
    subObj.set('top', subObj.top + gap);
    titleObj.setCoords();
    subObj.setCoords();

    canvas.setActiveObject(titleObj);
    canvas.requestRenderAll();
};

// [3] 요소 패널 클립아트 로드
let sideAssetPage = 0;
let sideAssetKeyword = '';
let sideAssetSearchTimer = null;
const SIDE_ASSET_PER_PAGE = 8;

window.handleAssetSearch = function(val) {
    clearTimeout(sideAssetSearchTimer);
    sideAssetSearchTimer = setTimeout(function() {
        sideAssetKeyword = (val || '').trim();
        window.loadSideAssets(0);
    }, 300);
};

window.loadSideAssets = async function(page) {
    if (typeof page === 'number') sideAssetPage = page;
    else sideAssetPage = 0;
    const list = document.getElementById('sideAssetList');
    if (!list || !sb) return;
    list.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin" style="color:#6366f1;"></i></div>';
    try {
        const cats = ['vector', 'graphic', 'transparent-graphic', 'pattern', 'logo'];
        let query = sb.from('library')
            .select('id, thumb_url, title, category, tags')
            .eq('status', 'approved')
            .in('category', cats)
            .or('product_key.eq.custom,product_key.is.null,product_key.eq.""')
            .order('created_at', { ascending: false })
            .range(sideAssetPage * SIDE_ASSET_PER_PAGE, (sideAssetPage + 1) * SIDE_ASSET_PER_PAGE - 1);
        if (sideAssetKeyword) {
            query = query.or('title.ilike.%' + sideAssetKeyword + '%,tags.ilike.%' + sideAssetKeyword + '%');
        }
        const { data, error } = await query;
        if (error) throw error;
        list.innerHTML = '';
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:11px; padding:15px;">' + (sideAssetKeyword ? window.t('msg_no_search_result', 'No results') : 'No data') + '</div>';
            return;
        }
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns:repeat(2, 1fr); gap:6px;';
        data.forEach(tpl => {
            const div = document.createElement('div');
            div.style.cssText = 'cursor:pointer; border-radius:8px; overflow:hidden; aspect-ratio:1; background:#f8fafc; border:1px solid #e2e8f0; position:relative;';
            const imgUrl = window.getTinyThumb ? window.getTinyThumb(tpl.thumb_url, 150) : tpl.thumb_url;
            let badge = '';
            if (tpl.category === 'vector') badge = '<span style="position:absolute;top:3px;left:3px;background:#7c3aed;color:#fff;font-size:8px;padding:1px 4px;border-radius:3px;font-weight:bold;">V</span>';
            div.innerHTML = badge + '<img src="' + imgUrl + '" loading="lazy" style="width:100%;height:100%;object-fit:contain;">';
            div.onclick = function() {
                window.selectedTpl = tpl;
                window.processLoad('add');
            };
            grid.appendChild(div);
        });
        list.appendChild(grid);
        // 페이징
        const pgDiv = document.createElement('div');
        pgDiv.style.cssText = 'display:flex; justify-content:center; gap:10px; padding:10px 0;';
        const prevB = document.createElement('button');
        prevB.className = 'side-page-btn';
        prevB.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevB.disabled = sideAssetPage === 0;
        prevB.onclick = function() { window.loadSideAssets(sideAssetPage - 1); };
        const pageL = document.createElement('span');
        pageL.style.cssText = 'font-weight:bold; color:#64748b; font-size:13px; line-height:32px;';
        pageL.textContent = (sideAssetPage + 1) + '';
        const nextB = document.createElement('button');
        nextB.className = 'side-page-btn';
        nextB.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextB.disabled = data.length < SIDE_ASSET_PER_PAGE;
        nextB.onclick = function() { window.loadSideAssets(sideAssetPage + 1); };
        pgDiv.appendChild(prevB); pgDiv.appendChild(pageL); pgDiv.appendChild(nextB);
        list.appendChild(pgDiv);
    } catch(e) {
        console.error('Asset load error:', e);
        list.innerHTML = '<div style="text-align:center; color:red; font-size:11px; padding:10px;">Error</div>';
    }
};

// =========================================================
// [1] 배경 잠금/해제 토글 함수 (누락된 기능 복구)
// =========================================================
window.toggleBackgroundLock = function() {
    if (!canvas) return;

    // 1. 배경으로 지정된 객체 찾기
    const bgObj = canvas.getObjects().find(o => o.isTemplateBackground);

    if (!bgObj) {
        alert(window.t('msg_no_locked_bg', "No locked background found."));
        return;
    }

    // 2. 현재 상태 확인 (선택 불가능하면 잠긴 상태)
    const isCurrentlyLocked = !bgObj.selectable;

    // 3. 상태 반전 (잠김 <-> 풀림)
    if (isCurrentlyLocked) {
        // [해제 모드]
        bgObj.set({
            selectable: true,
            evented: true,
            lockMovementX: false,
            lockMovementY: false,
            lockRotation: false,
            lockScalingX: false,
            lockScalingY: false,
            hasControls: true,
            hasBorders: true,
            hoverCursor: 'move'
        });
        alert("🔓 " + window.t('msg_bg_unlocked', "Background unlocked."));
    } else {
        // [잠금 모드]
        bgObj.set({
            selectable: false,
            evented: false,
            lockMovementX: true,
            lockMovementY: true,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
            hasControls: false,
            hasBorders: false,
            hoverCursor: 'default'
        });
        alert("🔒 " + window.t('msg_bg_locked', "Background locked."));
    }

    canvas.requestRenderAll();
};
// =========================================================
// [중요] 템플릿/객체 불러오기 (다중 페이지 호환성 강화)
// =========================================================
window.processLoad = async function(mode) {
    // ★ 안전장치: 현재 활성화된 캔버스를 확실하게 가져옴
    const currentCanvas = window.canvas; 
    if (!currentCanvas) return alert(window.t('msg_canvas_not_init', "Canvas is not initialized."));

    if (!window.selectedTpl) return alert(window.t('msg_select_design', "No design selected."));
    
    const loading = document.getElementById("loading");
    if(loading) loading.style.display = "flex";

    try {
        // 1. DB 데이터 조회
        const { data, error } = await sb
            .from('library')
            .select('data_url, width, height, category') 
            .eq('id', window.selectedTpl.id)
            .single();

        if (error || !data) throw new Error(window.t('msg_data_load_failed', "Data load failed"));

        // 배경 모드 여부 확인
        let isBgMode = (window.sideCurrentGroup === 'group_template');
        if (mode === 'replace') isBgMode = true;

        // 2. 데이터 파싱
        let jsonData = null;
        let imageUrl = null;
        let isImage = false;

        try {
            if (typeof data.data_url === 'object') jsonData = data.data_url;
            else jsonData = JSON.parse(data.data_url);
            
            if (typeof jsonData === 'string') { isImage = true; imageUrl = jsonData; }
        } catch (e) {
            isImage = true; imageUrl = data.data_url;
        }

        // 3. [배경 교체] 기존 배경 삭제
        if (mode === 'replace') {
            // 현재 캔버스에서 배경 태그가 있는 객체를 모두 찾음
            const oldBgs = currentCanvas.getObjects().filter(o => o.isTemplateBackground);
            oldBgs.forEach(o => currentCanvas.remove(o));
        }

        // 4. [설정 적용 함수]
        const applyForcedSettings = (obj) => {
            const board = currentCanvas.getObjects().find(o => o.isBoard);
            let centerX = currentCanvas.width / 2;
            let centerY = currentCanvas.height / 2;
            let bW = currentCanvas.width;
            let bH = currentCanvas.height;

            if (board) {
                bW = board.getScaledWidth();
                bH = board.getScaledHeight();
                centerX = board.left + bW / 2;
                centerY = board.top + bH / 2;
            }

            let finalScale = 1;

            if (isBgMode) {
                // 배경: 꽉 채우기
                const scaleX = bW / obj.width;
                const scaleY = bH / obj.height;
                finalScale = Math.max(scaleX, scaleY) * 1.1; // 110% 여백 방지
            } else {
                // 요소: 적당히 맞추기
                const targetSize = Math.min(bW, bH) * 0.4; 
                const objSize = Math.max(obj.width, obj.height);
                finalScale = targetSize / objSize;
                if(finalScale > 1) finalScale = 1; 
            }

            obj.set({
                originX: 'center', originY: 'center',
                left: centerX, top: centerY,
                scaleX: finalScale, scaleY: finalScale
            });
            
            obj.setCoords();
        };

        // 레이어 정리
        const arrangeLayers = () => {
            const board = currentCanvas.getObjects().find(o => o.isBoard);
            const guide = currentCanvas.getObjects().find(o => o.id === 'product_fixed_overlay');
            const bgObjects = currentCanvas.getObjects().filter(o => o.isTemplateBackground);
            
            if (board) currentCanvas.sendToBack(board);
            
            bgObjects.forEach(bg => {
                currentCanvas.sendToBack(bg);
                if(board) currentCanvas.bringForward(bg);
            });

            if (guide) currentCanvas.bringToFront(guide);
            currentCanvas.requestRenderAll();
        };

        // 5. 로딩 실행 (이미지 vs 벡터)
        const onObjectLoaded = (obj) => {
            applyForcedSettings(obj);
            
            if (isBgMode) {
                obj.set({
                    selectable: false, evented: false,
                    lockMovementX: true, lockMovementY: true,
                    hasControls: false, isTemplateBackground: true
                });
            } else {
                obj.set({
                    selectable: true, evented: true,
                    isTemplateBackground: false
                });
            }
            
            currentCanvas.add(obj);
            arrangeLayers();
            if(!isBgMode) currentCanvas.setActiveObject(obj);
            
            if(loading) loading.style.display = "none";
        };

        if (isImage) {
            const cleanUrl = imageUrl.replace(/"/g, '');
            if (cleanUrl.includes('.svg')) {
                fabric.loadSVGFromURL(cleanUrl, (objects, options) => {
                    if (!objects || objects.length === 0) { if(loading) loading.style.display="none"; return; }
                    const group = fabric.util.groupSVGElements(objects, options);
                    onObjectLoaded(group);
                });
            } else {
                fabric.Image.fromURL(cleanUrl, (img) => {
                    if(!img) { if(loading) loading.style.display="none"; return; }
                    onObjectLoaded(img);
                }, { crossOrigin: 'anonymous' });
            }
        } else {
            // JSON 벡터 처리
            const objectsToLoad = jsonData.objects.filter(o => !o.isBoard);
            fabric.util.enlivenObjects(objectsToLoad, (objs) => {
                if (!objs || objs.length === 0) { if(loading) loading.style.display="none"; return; }

                const group = new fabric.Group(objs);
                applyForcedSettings(group);
                currentCanvas.add(group);
                
                // 그룹 해제
                currentCanvas.setActiveObject(group);
                const items = group.toActiveSelection(); 
                currentCanvas.discardActiveObject(); 
                
                let largestObj = null;
                let maxArea = 0;

                objs.forEach(o => {
                    o.setCoords();
                    // 기본 잠금 해제
                    o.set({
                        selectable: true, evented: true,
                        lockMovementX: false, lockMovementY: false,
                        hasControls: true, isTemplateBackground: false
                    });

                    if (isBgMode && !o.type.includes('text')) {
                        const area = o.getScaledWidth() * o.getScaledHeight();
                        if (area > maxArea) { maxArea = area; largestObj = o; }
                    }
                });

                if (isBgMode && largestObj) {
                    largestObj.set({
                        selectable: false, evented: false,
                        lockMovementX: true, lockMovementY: true,
                        hasControls: false, isTemplateBackground: true
                    });
                    currentCanvas.sendToBack(largestObj);
                } else if (!isBgMode) {
                    const sel = new fabric.ActiveSelection(objs, { canvas: currentCanvas });
                    currentCanvas.setActiveObject(sel);
                }

                arrangeLayers();
                if(loading) loading.style.display = "none";
            });
        }

    } catch (e) {
        console.error(e);
        alert(window.t('err_prefix', "Error: ") + e.message);
        if(loading) loading.style.display = "none";
    }
};
// =========================================================
// [중요] 템플릿/객체 불러오기 (배경 교체 시 글씨 유지 로직 적용)
// =========================================================
window.processLoad = async function(mode) {
    if (!window.selectedTpl) return alert(window.t('msg_select_design', "No design selected."));
    
    const loading = document.getElementById("loading");
    if(loading) loading.style.display = "flex";

    try {
        // 1. DB 데이터 조회
        const { data, error } = await sb
            .from('library')
            .select('data_url, width, height, category') 
            .eq('id', window.selectedTpl.id)
            .single();

        if (error || !data) throw new Error(window.t('msg_data_load_failed', "Data load failed"));

        // ★ 배경 모드 여부 결정
        let isBgMode = (window.sideCurrentGroup === 'group_template');
        if (mode === 'replace') isBgMode = true;

        // 2. 데이터 파싱
        let jsonData = null;
        let imageUrl = null;
        let isImage = false;

        try {
            if (typeof data.data_url === 'object') jsonData = data.data_url;
            else jsonData = JSON.parse(data.data_url);
            
            if (typeof jsonData === 'string') { isImage = true; imageUrl = jsonData; }
        } catch (e) {
            isImage = true; imageUrl = data.data_url;
        }

        // 3. ★ [핵심 수정] 기존 배경만 지우기 (글씨/요소 유지)
        if (mode === 'replace') {
            // 캔버스 전체를 비우지 않고, '배경으로 지정된 객체'만 찾아서 제거합니다.
            const oldBgs = canvas.getObjects().filter(o => o.isTemplateBackground);
            oldBgs.forEach(o => canvas.remove(o));
        }

        // 4. [설정 적용 함수]
        const applyForcedSettings = (obj) => {
            const board = canvas.getObjects().find(o => o.isBoard);
            let centerX = canvas.width / 2;
            let centerY = canvas.height / 2;
            let bW = canvas.width;
            let bH = canvas.height;

            if (board) {
                bW = board.getScaledWidth();
                bH = board.getScaledHeight();
                centerX = board.left + bW / 2;
                centerY = board.top + bH / 2;
            }

            let finalScale = 1;

            if (isBgMode) {
                // [배경 모드] 꽉 채우기 (Cover)
                const scaleX = bW / obj.width;
                const scaleY = bH / obj.height;
                finalScale = Math.max(scaleX, scaleY) * 1.1; // 110% 여백 방지
            } else {
                // [객체 모드] 적당히 줄이기 (Fit)
                const targetSize = Math.min(bW, bH) * 0.4; 
                const objSize = Math.max(obj.width, obj.height);
                finalScale = targetSize / objSize;
                if(finalScale > 1) finalScale = 1; 
            }

            obj.set({
                originX: 'center', originY: 'center',
                left: centerX, top: centerY,
                scaleX: finalScale, scaleY: finalScale
            });
            
            obj.setCoords();
        };

        // 레이어 정리 함수
        const arrangeLayers = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const guide = canvas.getObjects().find(o => o.id === 'product_fixed_overlay');
            const bgObjects = canvas.getObjects().filter(o => o.isTemplateBackground);
            
            // 1. 대지를 맨 뒤로
            if (board) canvas.sendToBack(board);
            
            // 2. 배경 객체들을 그 위로 (일반 요소보다 뒤)
            bgObjects.forEach(bg => {
                canvas.sendToBack(bg);
                if(board) canvas.bringForward(bg);
            });

            // 3. 가이드는 맨 앞으로
            if (guide) canvas.bringToFront(guide);
            canvas.requestRenderAll();
        };

        // 5. 실제 로딩 실행
        if (isImage) {
            // [이미지/SVG 로드]
            const cleanUrl = imageUrl.replace(/"/g, '');
            const isSvg = cleanUrl.includes('.svg');

            const handleLoadedObj = (obj) => {
                applyForcedSettings(obj);
                
                if (isBgMode) {
                    // 배경 모드면 잠금
                    obj.set({
                        selectable: false, evented: false,
                        lockMovementX: true, lockMovementY: true,
                        hasControls: false, isTemplateBackground: true
                    });
                } else {
                    // 객체 모드면 해제
                    obj.set({
                        selectable: true, evented: true,
                        isTemplateBackground: false
                    });
                }
                
                canvas.add(obj);
                arrangeLayers(); // 레이어 순서 정리 (배경은 뒤로)
                if(!isBgMode) canvas.setActiveObject(obj);
                
                if(loading) loading.style.display = "none";
            };

            if (isSvg) {
                fabric.loadSVGFromURL(cleanUrl, (objects, options) => {
                    if (!objects || objects.length === 0) {
                        if(loading) loading.style.display = "none";
                        return;
                    }
                    const group = fabric.util.groupSVGElements(objects, options);
                    handleLoadedObj(group);
                });
            } else {
                fabric.Image.fromURL(cleanUrl, (img) => {
                    if(!img) {
                        if(loading) loading.style.display = "none";
                        return;
                    }
                    handleLoadedObj(img);
                }, { crossOrigin: 'anonymous' });
            }
        } else {
            // [JSON 벡터 로드]
            const objectsToLoad = jsonData.objects.filter(o => !o.isBoard);
            
            fabric.util.enlivenObjects(objectsToLoad, (objs) => {
                if (!objs || objs.length === 0) {
                    if(loading) loading.style.display = "none";
                    return;
                }

                const group = new fabric.Group(objs);
                applyForcedSettings(group);
                canvas.add(group);
                
                // 그룹 해제 (낱개로 풀기 - 글씨 편집 가능하도록)
                canvas.setActiveObject(group);
                const items = group.toActiveSelection(); 
                canvas.discardActiveObject(); 
                
                let largestObj = null;
                let maxArea = 0;

                objs.forEach(o => {
                    o.setCoords();

                    // 일단 모두 잠금 해제
                    o.set({
                        selectable: true, evented: true,
                        lockMovementX: false, lockMovementY: false,
                        lockRotation: false, lockScalingX: false, lockScalingY: false,
                        hasControls: true, isTemplateBackground: false
                    });

                    // 배경 모드라면 가장 큰 도형 찾기 (텍스트 제외)
                    if (isBgMode) {
                        if (!o.type.includes('text')) {
                            const area = o.getScaledWidth() * o.getScaledHeight();
                            if (area > maxArea) {
                                maxArea = area;
                                largestObj = o;
                            }
                        }
                    }
                });

                // 배경 모드: 가장 큰 것만 잠그고 배경 태그 달기
                if (isBgMode && largestObj) {
                    largestObj.set({
                        selectable: false, evented: false,
                        lockMovementX: true, lockMovementY: true,
                        hasControls: false,
                        isTemplateBackground: true
                    });
                    canvas.sendToBack(largestObj);
                    arrangeLayers(); // 레이어 재정렬
                } 
                // 객체 모드: 전체 선택
                else if (!isBgMode) {
                    const sel = new fabric.ActiveSelection(objs, { canvas: canvas });
                    canvas.setActiveObject(sel);
                    
                    if(loading) loading.style.display = "none";
                    return; 
                }

                arrangeLayers();
                canvas.requestRenderAll();
                
                if(loading) loading.style.display = "none";
            });
        }

    } catch (e) {
        console.error(e);
        alert(window.t('err_prefix', "Error: ") + e.message);
        if(loading) loading.style.display = "none";
    }
};