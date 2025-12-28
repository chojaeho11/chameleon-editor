/* canvas-template.js */

import { sb, currentUser } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";

// 선택된 템플릿 정보를 저장하는 변수
let selectedTpl = null;
let currentCategory = 'all';

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

    const btnReplace = document.getElementById("btnActionReplace"); 
    if (btnReplace) {
        btnReplace.onclick = () => {
            document.getElementById("templateActionModal").style.display = "none";
            processLoad('replace');
        };
    }
    
    const btnAdd = document.getElementById("btnActionAdd"); 
    if (btnAdd) {
        btnAdd.onclick = () => {
            document.getElementById("templateActionModal").style.display = "none";
            processLoad('add');
        };
    }

    const btnUse = document.getElementById("btnUseTpl");
    if(btnUse) btnUse.onclick = useSelectedTemplate;

    const btnReg = document.getElementById("btnRegisterTemplate");
    if (btnReg) {
        if (currentUser) btnReg.style.display = "flex";
        btnReg.onclick = () => {
            if (!currentUser) return alert("관리자 로그인이 필요합니다.");
            document.getElementById("sellModal").style.display = "flex";
        };
    }

    const btnSellConfirm = document.getElementById("btnSellConfirm");
    if (btnSellConfirm) btnSellConfirm.onclick = registerOfficialTemplate;
}

// =========================================================
// [2] 오버레이 및 리스트 로직
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

async function searchTemplates(category, keyword) {
    const grid = document.getElementById("tplGrid");
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">로딩중...</div>';
    selectedTpl = null;

    if (!sb) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red;">DB 미연결</div>';
        return;
    }

    try {
        const currentKey = window.currentProductKey || (canvas ? canvas.currentProductKey : 'custom') || 'custom';
        
        let query = sb.from('library')
            .select('id, thumb_url, tags, category, width, height, product_key, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

        if (category && category !== 'all') {
            query = query.eq('category', category); 
        }
        
        if (keyword && keyword.trim() !== '') {
            const expandedWords = expandSearchKeywords(keyword);
            const orSearchCondition = expandedWords.map(w => `tags.ilike.%${w}%`).join(',');
            if (orSearchCondition) query = query.or(orSearchCondition);
        }

        const filterCondition = `product_key.eq.${currentKey},product_key.eq.custom,product_key.is.null`;
        query = query.or(filterCondition);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">검색 결과가 없습니다.<br><span style="font-size:11px;">(키워드: ${keyword || '없음'})</span></div>`;
            return;
        }

        grid.innerHTML = "";
        data.forEach((item) => {
            const card = document.createElement("div");
            card.className = "tpl-item";
            const imgUrl = item.thumb_url || 'https://via.placeholder.com/300?text=No+Image';
            const displayTitle = item.tags ? item.tags.split(',')[0] : '무제';
            
            const isExclusive = item.product_key && item.product_key !== 'custom';
            const badgeHtml = isExclusive 
                ? `<span style="position:absolute; top:8px; left:8px; background:#6366f1; color:white; font-size:10px; padding:3px 6px; border-radius:4px; z-index:2; box-shadow:0 2px 4px rgba(0,0,0,0.2);">전용</span>` 
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
                    category: item.category, // ★ 중요: 카테고리 정보 저장
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
        grid.innerHTML = `<div style="text-align:center; color:red;">시스템 에러: ${e.message}</div>`;
    }
}

// =========================================================
// [3] 선택 및 로드 프로세스 (여기가 핵심 수정 구간)
// =========================================================

async function useSelectedTemplate() {
    if (!selectedTpl) return alert("템플릿을 선택해주세요.");
    
    // 현재 캔버스에 내용물이 있는지 확인
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
            .select('data_url')
            .eq('id', selectedTpl.id)
            .single();

        if (error || !data) throw new Error("데이터를 불러오지 못했습니다.");

        let rawData = data.data_url;
        let finalJson = null;
        let isImage = false;
        let imageUrl = "";

        // 데이터 타입 판별 (JSON 문자열 vs 이미지 URL)
        try {
            if (typeof rawData === 'object') {
                finalJson = rawData; 
            } else {
                finalJson = JSON.parse(rawData);
            }

            // JSON 파싱은 성공했으나, 내용이 단순 문자열(이미지URL)인 경우 처리
            if (typeof finalJson === 'string') {
                isImage = true;
                imageUrl = finalJson;
            } else {
                isImage = false;
            }
        } catch (e) {
            // 파싱 실패 시 일반 이미지 URL로 간주
            isImage = true;
            imageUrl = rawData;
        }

        // '새 작업 시작' 모드일 때 기존 객체 삭제
        if (mode === 'replace') {
            const objects = canvas.getObjects().filter(o => !o.isBoard);
            objects.forEach(o => canvas.remove(o));
        }

        // =================================================================
        // ★★★ [스마트 리사이징 계산 로직] (이미지 & JSON 공통 사용) ★★★
        // =================================================================
        const getSmartScale = (objWidth, objHeight) => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const bW = board ? (board.width * board.scaleX) : canvas.width;
            const bH = board ? (board.height * board.scaleY) : canvas.height;

            // 카테고리 확인 (없으면 기본값 'logo'로 처리하여 작게 로드)
            const category = selectedTpl ? (selectedTpl.category || 'logo') : 'logo';
            
            console.log(`📏 스마트 리사이징 실행: ${category} 모드`);

            // 1. 배경형 (꽉 차게 + 10%)
            if (['photo-bg', 'vector', 'transparent-graphic', 'pattern'].includes(category)) {
                // 가로 비율과 세로 비율 중 더 큰 쪽을 선택 (Cover 효과)
                const scaleX = bW / objWidth;
                const scaleY = bH / objHeight;
                return Math.max(scaleX, scaleY) * 1.1; 
            } 
            // 2. 객체형 (화면의 1/3)
            else {
                const targetWidth = bW / 3;
                return targetWidth / objWidth;
            }
        };

        const getCenterPos = () => {
            const board = canvas.getObjects().find(o => o.isBoard);
            const bW = board ? (board.width * board.scaleX) : canvas.width;
            const bH = board ? (board.height * board.scaleY) : canvas.height;
            const cX = board ? (board.left + bW / 2) : canvas.width / 2;
            const cY = board ? (board.top + bH / 2) : canvas.height / 2;
            return { x: cX, y: cY };
        };

        // =================================================================
        // [CASE 1] 단순 이미지 로드
        // =================================================================
        if (isImage) {
            const cleanUrl = String(imageUrl).trim().replace(/^"|"$/g, '');

            fabric.Image.fromURL(cleanUrl, (img) => {
                if (!img || !img.width) {
                    document.getElementById("loading").style.display = "none";
                    return alert("이미지 파일을 불러올 수 없습니다.");
                }

                const finalScale = getSmartScale(img.width, img.height);
                const center = getCenterPos();

                img.set({
                    left: center.x,
                    top: center.y,
                    originX: 'center',
                    originY: 'center',
                    scaleX: finalScale,
                    scaleY: finalScale
                });

                canvas.add(img);
                img.setCoords(); 
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                document.getElementById("loading").style.display = "none";

            }, { crossOrigin: 'anonymous' }); 

        } 
        // =================================================================
        // [CASE 2] JSON 객체(그룹) 로드
        // =================================================================
        else {
            let jsonData = finalJson;
            if(jsonData.objects) jsonData.objects = jsonData.objects.filter(o => !o.isBoard);

            fabric.util.enlivenObjects(jsonData.objects, (objs) => {
                if (objs.length === 0) { 
                    document.getElementById("loading").style.display = "none"; 
                    if(mode === 'replace') resetViewToCenter(); 
                    return; 
                }

                objs.forEach(obj => {
                    obj.set({
                        selectable: true, evented: true,
                        lockMovementX: false, lockMovementY: false,
                        lockScalingX: false, lockScalingY: false,
                        hasControls: true, hasBorders: true
                    });
                });

                const group = new fabric.Group(objs, { originX: 'center', originY: 'center' });
                
                // ★ [수정됨] JSON 로드 시에도 스마트 리사이징 적용
                const finalScale = getSmartScale(group.width, group.height);
                const center = getCenterPos();

                group.set({ 
                    left: center.x, 
                    top: center.y,
                    scaleX: finalScale,
                    scaleY: finalScale
                });

                canvas.add(group);
                
                // 그룹 해제 후 개별 선택 상태로 전환
                if (group.type === 'group') {
                    group.toActiveSelection();
                }
                
                canvas.discardActiveObject(); 
                canvas.requestRenderAll();
                
                if (mode === 'replace') {
                    setTimeout(() => resetViewToCenter(), 100);
                }
                
                document.getElementById("loading").style.display = "none";
            });
        }

    } catch (e) {
        console.error(e);
        document.getElementById("loading").style.display = "none";
        alert("불러오기 실패: " + e.message);
    }
}

// =========================================================
// [4] 유틸리티
// =========================================================

function resetViewToCenter() {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const containerW = canvas.getWidth(); 
    const containerH = canvas.getHeight();
    const boardW = board.getScaledWidth();
    const boardH = board.getScaledHeight();

    if (boardW === 0 || boardH === 0) return;

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
                format: 'png', 
                multiplier: 0.5, 
                quality: 0.8,
                left: board.left,
                top: board.top,
                width: board.getScaledWidth(),
                height: board.getScaledHeight()
            });
        } else {
            thumbUrl = canvas.toDataURL({ format: 'png', multiplier: 0.5, quality: 0.8 });
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

// =========================================================
// [5] 로고 대량 업로드
// =========================================================

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
            if(preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if(removeBtn) removeBtn.style.display = 'flex';
        }
        reader.readAsDataURL(file);
        
        const autoTag = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        if(keywordInput) keywordInput.value = autoTag;
    } 
    else {
        if(preview) preview.style.display = 'none';
        if(removeBtn) removeBtn.style.display = 'flex';
        
        dropText.innerHTML = `<span style="color:#6366f1; font-weight:800;">${files.length}개</span>의 파일이 선택되었습니다.`;
        subText.innerText = "업로드 버튼을 누르면 일괄 등록됩니다.";
        
        if(keywordInput) keywordInput.value = ""; 
        if(keywordInput) keywordInput.placeholder = "공통 태그 입력 (비워두면 파일명이 태그가 됩니다)";
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
    if(preview) {
        preview.style.display = 'none';
        preview.src = "";
    }
    if(removeBtn) removeBtn.style.display = 'none';
    
    if(dropText) dropText.innerText = "클릭하여 파일 선택";
    if(subText) subText.innerText = "또는 파일을 여기로 드래그하세요";
    if(keywordInput) {
        keywordInput.value = "";
        keywordInput.placeholder = "예: 삼성, 로고, 심플 (쉼표로 구분)";
    }
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

    let successCount = 0;
    let failCount = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            btn.innerText = `업로드 중... (${i + 1}/${files.length})`;

            let autoTags = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            if(commonTag) autoTags = `${autoTags}, ${commonTag}`;

            const fileExt = file.name.split('.').pop();
            const timestamp = Date.now();
            const fileName = `logo_${timestamp}_${Math.floor(Math.random()*1000)}.${fileExt}`;

            const { error: uploadError } = await sb.storage
                .from('logos')
                .upload(fileName, file);

            if (uploadError) {
                console.error(`파일 업로드 실패 (${file.name}):`, uploadError);
                failCount++;
                continue; 
            }

            const { data: publicData } = sb.storage
                .from('logos')
                .getPublicUrl(fileName);

            const payload = {
                category: 'logo',
                tags: autoTags,
                thumb_url: publicData.publicUrl,
                data_url: publicData.publicUrl,
                created_at: new Date(),
                width: 500,
                height: 500,
                product_key: 'custom'
            };

            const { error: dbError } = await sb.from('library').insert([payload]);
            if (dbError) {
                console.error(`DB 등록 실패 (${file.name}):`, dbError);
                failCount++;
            } else {
                successCount++;
            }
        }

        if (failCount > 0) {
            alert(`완료! 성공: ${successCount}개, 실패: ${failCount}개`);
        } else {
            alert(`🎉 ${successCount}개의 로고가 모두 등록되었습니다!`);
        }

        window.resetUpload(null);
        document.getElementById("logoUploadModal").style.display = "none";

        if (currentCategory === 'logo') {
            searchTemplates('logo', '');
        }

    } catch (e) {
        console.error(e);
        alert("시스템 오류: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    if(dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if(files.length > 0) {
                const fileInput = document.getElementById('logoFileInput');
                if(fileInput) {
                    fileInput.files = files;
                    window.handleFileSelect(fileInput);
                }
            }
        });
    }
});

// ★ 제품 전용 고정 템플릿(칼선) 로드
let overlayObject = null;

export function loadProductFixedTemplate(url) {
    if (!canvas || !url) return;

    console.log("🔒 칼선 로드 중:", url);
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "flex";

    const setupSpecialOverlay = (obj) => {
        if (!obj) {
            if (loading) loading.style.display = "none";
            return;
        }

        const oldOverlay = canvas.getObjects().find(o => o.id === 'product_fixed_overlay');
        if (oldOverlay) canvas.remove(oldOverlay);

        const board = canvas.getObjects().find(o => o.isBoard);
        let tLeft = 0, tTop = 0, tW = canvas.width, tH = canvas.height;

        if (board) {
            tW = board.width * board.scaleX;
            tH = board.height * board.scaleY;
            tLeft = board.left;
            tTop = board.top;
        }

        const scaleX = tW / obj.width;
        const scaleY = tH / obj.height;

        obj.set({
            scaleX: scaleX,
            scaleY: scaleY,
            left: tLeft + tW / 2,
            top: tTop + tH / 2,
            originX: 'center',
            originY: 'center',
            id: 'product_fixed_overlay', 
            selectable: false,
            evented: false,              
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: 'default',
            excludeFromExport: false     
        });

        overlayObject = obj;
        canvas.add(obj);
        canvas.bringToFront(obj); 
        canvas.requestRenderAll();
        
        if (loading) loading.style.display = "none";
    };

    if (url.toLowerCase().endsWith('.svg') || url.includes('data:image/svg')) {
        fabric.loadSVGFromURL(url, (objects, options) => {
            const group = fabric.util.groupSVGElements(objects, options);
            setupSpecialOverlay(group);
        });
    } else {
        fabric.Image.fromURL(url, (img) => {
            setupSpecialOverlay(img);
        }, { crossOrigin: 'anonymous' });
    }
}