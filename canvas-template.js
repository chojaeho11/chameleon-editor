import { sb, currentUser } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";

let selectedTpl = null;
let currentCategory = 'all';

// =========================================================
// [1] 초기화 및 이벤트 리스너 설정
// =========================================================
export function initTemplateTools() {
    // 1. 카테고리 필터 버튼
    window.filterTpl = (type, btnElement) => {
        if (btnElement) {
            document.querySelectorAll(".tpl-cate-btn").forEach(b => b.classList.remove("active"));
            btnElement.classList.add("active");
        }
        currentCategory = type;
        const keyword = document.getElementById("tplSearchInput")?.value || "";
        searchTemplates(type, keyword);
    };

    // 2. 검색창 엔터 이벤트
    const searchInput = document.getElementById("tplSearchInput");
    if (searchInput) {
        searchInput.onkeyup = (e) => {
            if (e.key === 'Enter') searchTemplates(currentCategory, e.target.value);
        };
    }

    // 3. 템플릿 탭 (오버레이 열기)
    document.querySelectorAll(".tpl-tab").forEach((b) => {
        if (!b.getAttribute('onclick')) {
            b.onclick = () => openTemplateOverlay(b.dataset.tpl);
        }
    });

    // 4. 모달 내부 버튼 이벤트 연결 (추가/교체 선택)
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

    // 적용 버튼
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

// ★★★ [핵심 수정] 섞임 방지: 카테고리를 엄격하게 분리 ★★★
async function searchTemplates(category, keyword) {
    const grid = document.getElementById("tplGrid");
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">로딩중...</div>';
    selectedTpl = null;

    if (!sb) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red;">DB 미연결</div>';
        return;
    }

    try {
        let query = sb.from('library')
            .select('id, thumb_url, tags, category, width, height, product_key, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

        // [수정된 부분] 이전의 '합치기 로직(OR)'을 제거하고, 정확히 일치하는 것만 가져옵니다.
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
                
                selectedTpl = { 
                    id: item.id, 
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

// =========================================================
// [3] 선택 및 로드 프로세스
// =========================================================

async function useSelectedTemplate() {
    if (!selectedTpl) return alert("템플릿을 선택해주세요.");
    
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    
    if (objects.length > 0) {
        // 모달창 띄우기 (confirm 대신)
        document.getElementById("templateActionModal").style.display = "flex";
    } else {
        processLoad('replace');
    }
}

// ★★★ [수정됨] 데이터 형식(템플릿 vs 이미지) 자동 판별 로드 함수 ★★★
async function processLoad(mode) {
    // UI 정리
    const loadModal = document.getElementById("loadModeModal");
    if(loadModal) loadModal.style.display = "none";
    document.getElementById("templateActionModal").style.display = "none"; // 모달 닫기 추가
    document.getElementById("templateOverlay").style.display = "none";
    document.getElementById("loading").style.display = "flex";

    try {
        // 1. DB에서 데이터 가져오기
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

        // 2. 데이터 타입 판별 (가장 중요한 부분)
        try {
            // 일단 JSON 파싱을 시도해봅니다.
            if (typeof rawData === 'object') {
                finalJson = rawData; 
            } else {
                finalJson = JSON.parse(rawData);
            }

            // 파싱엔 성공했는데, 결과가 문자열(URL)이라면? -> 이미지입니다.
            if (typeof finalJson === 'string') {
                isImage = true;
                imageUrl = finalJson;
            } else {
                // 객체라면 템플릿입니다.
                isImage = false;
            }
        } catch (e) {
            // ★ 에러 발생! (Unexpected token 등) -> 100% 이미지 URL입니다.
            console.log("JSON 형식이 아님 -> 이미지로 처리합니다.");
            isImage = true;
            imageUrl = rawData;
        }

        // 3. 교체 모드일 경우 기존 요소 삭제
        if (mode === 'replace') {
            const objects = canvas.getObjects().filter(o => !o.isBoard);
            objects.forEach(o => canvas.remove(o));
        }

        // 4. 타입에 따른 처리 실행
        if (isImage) {
            // [CASE A] 로고/이미지 파일일 때
            
            // 혹시 모를 따옴표나 공백 제거
            const cleanUrl = String(imageUrl).trim().replace(/^"|"$/g, '');

            fabric.Image.fromURL(cleanUrl, (img) => {
                if (!img || !img.width) {
                    document.getElementById("loading").style.display = "none";
                    return alert("이미지 파일을 불러올 수 없습니다.");
                }

                // 중앙 배치 계산
                const board = canvas.getObjects().find(o => o.isBoard);
                const center = board ? board.getCenterPoint() : canvas.getCenter();
                
                img.set({
                    left: center.x,
                    top: center.y,
                    originX: 'center',
                    originY: 'center'
                });

                // 너무 크면 줄이기 (보드의 50% 크기)
                if (board) {
                    const maxW = board.getScaledWidth() * 0.5;
                    if (img.width > maxW) {
                        img.scaleToWidth(maxW);
                    }
                }

                canvas.add(img);
                img.setCoords(); 
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                document.getElementById("loading").style.display = "none";
            }, { crossOrigin: 'anonymous' }); // CORS 에러 방지

        } else {
            // [CASE B] 캔버스 템플릿(JSON)일 때
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
                
                const board = canvas.getObjects().find(o => o.isBoard);
                const boardW = board ? (board.width * board.scaleX) : 1000;
                const boardH = board ? (board.height * board.scaleY) : 1000;
                const centerX = board ? (board.left + boardW / 2) : canvas.width / 2;
                const centerY = board ? (board.top + boardH / 2) : canvas.height / 2;

                let scale = 1;
                
                if (mode === 'replace') {
                    const scaleX = boardW / group.width;
                    const scaleY = boardH / group.height;
                    scale = Math.max(scaleX, scaleY); 
                } else {
                    if (group.width > boardW * 0.6) {
                        scale = (boardW * 0.6) / group.width;
                    }
                }

                group.set({ 
                    left: centerX, 
                    top: centerY,
                    scaleX: scale,
                    scaleY: scale
                });

                canvas.add(group);

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
        // 에러가 나도 로딩창은 끄기
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

// =========================================================
// [5] 로고 대량 업로드 (다중 파일 + 자동 키워드)
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