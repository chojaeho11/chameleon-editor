import { canvas } from "./canvas-core.js";
import { updateLockUI } from "./canvas-utils.js";
import { sb } from "./config.js"; // ★ Supabase 인스턴스 가져오기

// ============================================================
// [설정] 현재 사이트 언어 및 폰트 변수
// ============================================================
const urlParams = new URLSearchParams(window.location.search);
// URL에 lang 파라미터가 없으면 'KR'을 기본값으로 사용
const CURRENT_LANG = (urlParams.get('lang') || 'kr').toUpperCase(); 

// DB에서 불러온 폰트 목록을 저장할 전역 변수
let DYNAMIC_FONTS = [];

// ============================================================
// [1] 초기화 함수 (Main Init)
// ============================================================
export async function initObjectTools() {
    // 1. 구글 기본 폰트(시스템 폰트) CSS 로드
    loadGoogleWebFontsCSS();

    // 2. Supabase DB에서 국가별 폰트 로드 및 브라우저 등록
    await loadDynamicFonts();

    // 3. 각종 핸들러 초기화
    initTextHandlers();      // 텍스트 추가/수정
    initShapeHandlers();     // 도형 추가
    initEditHandlers();      // 편집(삭제, 중앙정렬 등)
    initSelectionEffects();  // 선택 시 UI 갱신
    initColorHandlers();     // 색상 변경
    initLayerHandlers();     // 레이어 순서
    initAlignHandlers();     // 정렬
    initRotationHandlers();  // 회전
    
    // 4. 캔바 스타일 실시간 편집(더블클릭) 활성화
    initAdvancedEditing();

    console.log(`✨ canvas-objects.js initialized (Site: ${CURRENT_LANG})`);
}

// ============================================================
// [2] 폰트 로딩 시스템 (Supabase 연동)
// ============================================================
function loadGoogleWebFontsCSS() {
    if (document.getElementById("google-fonts-link")) return;
    const link = document.createElement("link");
    link.id = "google-fonts-link";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Nanum+Gothic&family=Nanum+Myeongjo&family=Noto+Sans+KR&display=swap";
    document.head.appendChild(link);
}

// ★ 핵심: Supabase에서 폰트 목록을 가져와 브라우저에 등록
async function loadDynamicFonts() {
    try {
        console.log(`📥 [Font] ${CURRENT_LANG} 폰트 로딩 중...`);
        
        // 현재 국가코드와 일치하는 폰트만 조회 (최신순)
        const { data, error } = await sb.from('site_fonts')
            .select('*')
            .eq('site_code', CURRENT_LANG)
            .order('created_at', { ascending: false });

        if (error) throw error;

        DYNAMIC_FONTS = data || [];

        // FontFace API를 사용하여 폰트 파일 비동기 로드
        const fontPromises = DYNAMIC_FONTS.map(font => {
            // URL에 띄어쓰기가 있을 수 있으므로 encodeURI 처리 권장
            const fontFace = new FontFace(font.font_family, `url(${encodeURI(font.file_url)})`);
            return fontFace.load().then(loadedFace => {
                document.fonts.add(loadedFace);
                console.log(`✅ Font Loaded: ${font.font_name} (${font.font_family})`);
            }).catch(err => {
                console.warn(`❌ Font Load Failed (${font.font_name}):`, err);
            });
        });

        await Promise.all(fontPromises);

    } catch (e) {
        console.error("폰트 목록 DB 로딩 실패:", e);
    }
}

// 폰트 전체보기 모달에 목록 렌더링
function renderFontList() {
    const listContainer = document.getElementById("fontList");
    if (!listContainer) return;
    
    listContainer.innerHTML = ""; // 초기화

    if (DYNAMIC_FONTS.length === 0) {
        listContainer.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">등록된 폰트가 없습니다.<br>관리자 페이지에서 폰트를 등록해주세요.</div>`;
        return;
    }

    DYNAMIC_FONTS.forEach(font => {
        const div = document.createElement("div");
        div.className = "font-item";
        div.innerText = font.font_name; // 화면에 보여줄 이름 (예: 잘난체)
        
        // 스타일 설정
        div.style.padding = "12px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";
        div.style.fontFamily = font.font_family; // 실제 폰트로 미리보기 적용
        div.style.fontSize = "18px";
        div.style.transition = "background 0.2s";

        div.onmouseover = () => div.style.background = "#f8fafc";
        div.onmouseout = () => div.style.background = "white";

        // 클릭 시 텍스트에 폰트 적용
        div.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active) return alert("폰트를 변경할 텍스트를 선택해주세요.");

            const applyFont = (obj) => { 
                if (obj.type && (obj.type.includes('text') || obj.type === 'i-text' || obj.type === 'textbox')) {
                    obj.set("fontFamily", font.font_family);
                }
            };

            // 그룹이거나 다중 선택일 경우 처리
            if (active.type === 'activeSelection' || active.type === 'group') {
                active.getObjects().forEach(o => applyFont(o));
            } else if (active.isEffectGroup || active.isOutlineGroup) {
                // 특수 효과 그룹인 경우 내부 객체 적용
                active.getObjects().forEach(o => applyFont(o));
                active.addWithUpdate(); // 그룹 갱신
            } else {
                applyFont(active);
            }
            
            canvas.requestRenderAll();
            document.getElementById("fontModal").style.display = "none";
        };
        
        listContainer.appendChild(div);
    });
}

// ============================================================
// [3] 텍스트 핸들러 (Text Tools)
// ============================================================
// canvas-objects.js 파일 내부의 initTextHandlers 함수 수정

function initTextHandlers() {
    // 텍스트 추가 공통 함수
    const addTextToCanvas = (text, fontSize, fontWeight = 'normal') => { // 기본값을 normal로
        if (!window.canvas) return alert("캔버스가 로드되지 않았습니다.");

        let family = 'sans-serif';
        if (DYNAMIC_FONTS.length > 0) {
            family = DYNAMIC_FONTS[0].font_family; 
        }

        const t = new fabric.IText(text, {
            fontFamily: family,
            fontSize: fontSize,
            fontWeight: fontWeight, // 여기서 굵기 결정
            fill: "#000000",
            
            // ★ [추가] 외곽선이 생기지 않도록 확실하게 초기화
            stroke: null, 
            strokeWidth: 0,
            
            textAlign: 'center',
            left: 0, 
            top: 0,
            originX: 'center', originY: 'center'
        });
        
        if (typeof addToCenter === 'function') {
            addToCenter(t);
        } else {
            t.set({ left: canvas.width/2, top: canvas.height/2 });
            window.canvas.add(t);
            window.canvas.setActiveObject(t);
        }
        window.canvas.requestRenderAll();
    };

    const btnTitle = document.getElementById("btnAddTitle");
    const btnSubtitle = document.getElementById("btnAddSubtitle");
    const btnBody = document.getElementById("btnAddBody");

    // ▼▼▼ [수정 포인트] "bold"를 "normal"로 변경해주세요 ▼▼▼
    
    // 제목: 잘난체처럼 두꺼운 폰트는 normal로 해야 깨끗하게 나옵니다.
    if (btnTitle) btnTitle.onclick = () => addTextToCanvas("제목을 입력하세요", 80, "normal");
    
    // 부제목: 필요하다면 bold 유지, 너무 두꺼우면 normal로 변경
    if (btnSubtitle) btnSubtitle.onclick = () => addTextToCanvas("부제목 입력", 50, "normal");
    
    // 본문: 얇은 폰트는 normal
    if (btnBody) btnBody.onclick = () => addTextToCanvas("본문 내용을 입력하세요", 30, "normal");

    // ... (나머지 코드는 그대로) ...

    // 폰트 전체보기 모달 버튼
    const btnFontSelect = document.getElementById("btnFontSelect");
    if (btnFontSelect) {
        btnFontSelect.onclick = () => {
            if (!canvas.getActiveObject()) return alert("폰트를 변경할 텍스트를 선택하세요.");
            
            const modal = document.getElementById("fontModal");
            if (modal) {
                modal.style.display = "flex";
                renderFontList(); // 목록 렌더링 호출
            }
        };
    }
    
    // 스타일 핸들러 설정
    setupStyleHandlers();
}

function setupStyleHandlers() {
    const alignLeft = document.getElementById("btnAlignLeftText");
    const alignCenter = document.getElementById("btnAlignCenterText");
    const alignRight = document.getElementById("btnAlignRightText");
    if(alignLeft) alignLeft.onclick = () => applyToSelection("textAlign", "left");
    if(alignCenter) alignCenter.onclick = () => applyToSelection("textAlign", "center");
    if(alignRight) alignRight.onclick = () => applyToSelection("textAlign", "right");

    const textSize = document.getElementById("textSize");
    const charSpacing = document.getElementById("textCharSpacing");
    const lineHeight = document.getElementById("textLineHeight");

    if (textSize) textSize.oninput = () => applyToSelection("fontSize", parseInt(textSize.value));
    if (charSpacing) charSpacing.oninput = () => applyToSelection("charSpacing", parseInt(charSpacing.value));
    if (lineHeight) lineHeight.oninput = () => applyToSelection("lineHeight", parseFloat(lineHeight.value));
}

// 공통 속성 적용 함수
function applyToSelection(prop, val) {
    const active = canvas.getActiveObject();
    if (!active) return;

    if (active.isEffectGroup) {
        // 효과 그룹인 경우 메인 텍스트만 변경하거나 전체 변경
        const mainText = active.getObjects().find(o => o.isMainText);
        if (prop === 'fill' && mainText) mainText.set('fill', val);
        else if ((prop === 'stroke' || prop === 'strokeWidth') && mainText) {
            mainText.set(prop, val);
        } else {
            active.getObjects().forEach(o => o.set(prop, val));
        }
        active.addWithUpdate();
    } else if (active.type === "activeSelection" || active.type === "group") {
        active.getObjects().forEach(obj => obj.set(prop, val));
    } else {
        active.set(prop, val);
    }
    canvas.requestRenderAll();
}

// ============================================================
// [4] 파워 텍스트 효과 (Text Effects)
// ============================================================
window.applyTextEffect = function(type) {
    const active = canvas.getActiveObject();
    if (!active) return alert("텍스트를 선택해주세요.");

    // 기존 효과 그룹 해제 후 원본 추출
    let originalText = active;
    if (active.type === 'group' && active.isEffectGroup) {
        const items = active.getObjects();
        const found = items.find(o => o.isMainText) || items[items.length - 1];
        
        found.clone((cloned) => {
            cloned.set({
                left: active.left, top: active.top, angle: active.angle, scaleX: active.scaleX, scaleY: active.scaleY,
                shadow: null, stroke: null, strokeWidth: 0, fill: found.fill || '#000000',
                selectable: true, evented: true, isClone: false, isMainText: true
            });
            canvas.remove(active);
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            window.applyTextEffect(type); // 재귀 호출
        });
        return;
    }

    if (!originalText.type.includes('text')) return alert("텍스트만 가능합니다.");

    const fontSize = originalText.fontSize * originalText.scaleY; 
    const strokeW = Math.max(2, fontSize * 0.05);
    const depth3D = Math.max(5, fontSize * 0.15);
    const originalColor = originalText.fill || '#000000';

    switch (type) {
        case 'block-3d': create3DEffect(originalText, '#4fffa5', '#000000', depth3D); break;
        case 'neon-strong': createNeonEffect(originalText, strokeW); break;
        case 'glitch-strong': createGlitchEffect(originalText); break;
        case 'long-shadow': createLongShadow(originalText, originalColor, '#000000', 500); break;
        case 'retro-candy': createCandyEffect(originalText, '#ef4444', '#15803d'); break;
        case 'blue-candy': createCandyEffect(originalText, '#38bdf8', '#1e3a8a'); break;
        case 'reset':
            originalText.set({ fill: '#000000', stroke: null, strokeWidth: 0, shadow: null });
            canvas.requestRenderAll();
            break;
    }
};

// 효과 구현 함수들
function create3DEffect(original, topColor, sideColor, depth) {
    const layers = [];
    const step = 1; 
    for (let i = 0; i < depth; i+=step) {
        original.clone((cloned) => {
            cloned.set({
                left: original.left + i, top: original.top + i,
                fill: sideColor, selectable: false, evented: false, isClone: true,
                stroke: null, strokeWidth: 0
            });
            layers.push(cloned);
            if (i >= depth - step) {
                original.set({ fill: topColor, isMainText: true });
                layers.push(original);
                groupAndRender(layers);
            }
        });
    }
}

function createNeonEffect(original, strokeW) {
    const layers = [];
    original.clone((glow1) => {
        glow1.set({
            stroke: '#7800ff', strokeWidth: strokeW * 1.5, fill: 'transparent',
            shadow: new fabric.Shadow({ color: '#7800ff', blur: strokeW * 4, offsetX:0, offsetY:0 }),
            selectable: false, isClone: true
        });
        layers.push(glow1);
        original.clone((glow2) => {
            glow2.set({
                stroke: '#d300c5', strokeWidth: strokeW * 0.5, fill: 'transparent',
                shadow: new fabric.Shadow({ color: '#d300c5', blur: strokeW * 0.8, offsetX:0, offsetY:0 }),
                selectable: false, isClone: true
            });
            layers.push(glow2);
            original.set({ stroke: '#ffffff', strokeWidth: Math.max(1, strokeW * 0.1), fill: 'transparent', isMainText: true });
            layers.push(original);
            groupAndRender(layers);
        });
    });
}

function createGlitchEffect(original) {
    const layers = [];
    const offset = Math.max(3, original.fontSize * 0.03); 
    original.clone((red) => {
        red.set({ left: original.left - offset, top: original.top - offset, fill: 'red', opacity: 0.8, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
        layers.push(red);
        original.clone((cyan) => {
            cyan.set({ left: original.left + offset, top: original.top + offset, fill: 'cyan', opacity: 0.8, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
            layers.push(cyan);
            original.set({ fill: '#ffffff', stroke: null, strokeWidth: 0, isMainText: true });
            layers.push(original);
            groupAndRender(layers);
        });
    });
}

function createLongShadow(original, textColor, shadowColor, length) {
    const layers = [];
    const step = 2; 
    const count = Math.floor(length / step); 
    for(let i=1; i<=count; i++) {
        original.clone((s) => {
            s.set({ left: original.left + (i * step), top: original.top + (i * step), fill: shadowColor, stroke: null, strokeWidth: 0, shadow: null, selectable: false, evented: false, isClone: true });
            layers.push(s);
            if(i === count) {
                original.set({ fill: textColor, isMainText: true });
                layers.push(original);
                groupAndRender(layers);
            }
        });
    }
}

function createCandyEffect(original, color1, color2) {
    const size = 60; 
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size; patternCanvas.height = size;
    const ctx = patternCanvas.getContext('2d');
    ctx.fillStyle = color1; ctx.fillRect(0, 0, size, size);
    ctx.beginPath(); ctx.strokeStyle = color2; ctx.lineWidth = size / 2.2; ctx.lineCap = 'butt';
    ctx.moveTo(0, size); ctx.lineTo(size, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size/2, size/2); ctx.lineTo(size/2, -size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2, size + size/2); ctx.lineTo(size + size/2, size/2); ctx.stroke();
    
    const candyPattern = new fabric.Pattern({ source: patternCanvas, repeat: 'repeat' });
    original.set({ fill: candyPattern, stroke: '#ffffff', strokeWidth: Math.max(3, original.fontSize * 0.04), paintFirst: 'stroke', isMainText: true });
    original.clone((shadow) => {
        shadow.set({ fill: '#000000', stroke: null, strokeWidth: 0, left: original.left + 5, top: original.top + 5, opacity: 0.25, isClone: true, selectable: false });
        groupAndRender([shadow, original]);
    });
}

function groupAndRender(items) {
    items.forEach(obj => canvas.remove(obj));
    const group = new fabric.Group(items, { canvas: canvas, isEffectGroup: true });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
}

// ============================================================
// [5] 캔바 스타일: 실시간 편집 (Advanced Editing)
// ============================================================
function initAdvancedEditing() {
    if (!canvas) return;
    canvas.on('mouse:dblclick', (e) => {
        const target = e.target;
        if (target && target.type === 'group' && target.isEffectGroup) {
            enableEffectEditing(target);
        }
    });
}

function enableEffectEditing(group) {
    const items = group.toActiveSelection(); 
    const objects = items.getObjects();
    const mainText = objects.find(o => o.isMainText);
    const clones = objects.filter(o => o !== mainText);

    if (!mainText) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
    }

    // 클론들은 잠시 숨기거나 투명하게
    clones.forEach(clone => {
        clone.set({ selectable: false, evented: false, opacity: clone.opacity * 0.5 });
    });

    canvas.discardActiveObject(); 
    canvas.setActiveObject(mainText); 
    mainText.enterEditing(); 
    mainText.selectAll(); 

    // 입력 동기화
    const syncHandler = () => {
        const content = mainText.text;
        clones.forEach(clone => clone.set('text', content));
        canvas.requestRenderAll();
    };
    mainText.on('changed', syncHandler);

    // 편집 종료 시 그룹 재구성
    mainText.on('editing:exited', () => {
        mainText.off('changed', syncHandler);
        clones.forEach(clone => clone.set({ opacity: clone.opacity / 0.5 })); 
        const allItems = [...clones, mainText];
        const newGroup = new fabric.Group(allItems, {
            isEffectGroup: true,
            selectionBackgroundColor: 'rgba(255,255,255,0)',
            originX: 'center', originY: 'center'
        });
        canvas.remove(mainText);
        clones.forEach(c => canvas.remove(c));
        canvas.add(newGroup);
        canvas.setActiveObject(newGroup);
        canvas.requestRenderAll();
    });
}

// ============================================================
// [6] 기타 객체 핸들러 (Shapes, Utils)
// ============================================================
export function addToCenter(obj) {
    if (!canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    
    if (board) {
        obj.set({
            left: board.left + (board.width * board.scaleX) / 2,
            top: board.top + (board.height * board.scaleY) / 2,
            originX: "center", originY: "center",
        });
    } else {
        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        obj.set({
            left: (canvas.width / zoom) / 2 - (vpt[4] / zoom),
            top: (canvas.height / zoom) / 2 - (vpt[5] / zoom),
            originX: "center", originY: "center"
        });
    }
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
}

function initSelectionEffects() {
    canvas.on("selection:created", syncSelectionUI);
    canvas.on("selection:updated", syncSelectionUI);
    canvas.on("selection:cleared", () => {
        updateLockUI();
        const strokeInput = document.getElementById("globalStroke");
        if(strokeInput) strokeInput.value = 0;
    });
}

function syncSelectionUI() {
    updateLockUI();
    const active = canvas.getActiveObject();
    if (!active) return;
    
    let target = active;
    if (active.isOutlineGroup || active.isEffectGroup) {
        target = active.getObjects().find(o => o.isMainText) || active.getObjects()[0] || active;
    }
    
    const strokeInput = document.getElementById("globalStroke");
    if(strokeInput) strokeInput.value = target.strokeWidth || 0;
}

function initColorHandlers() {
    const fillColor = document.getElementById("fillColor");
    const strokeColor = document.getElementById("strokeColor");
    const strokeWidth = document.getElementById("globalStroke");
    const strokeMiter = document.getElementById("btnStrokeMiter");
    const strokeRound = document.getElementById("btnStrokeRound");

    if (fillColor) fillColor.oninput = () => applyToSelection("fill", fillColor.value);
    if (strokeColor) strokeColor.oninput = () => applyToSelection("stroke", strokeColor.value);
    if (strokeWidth) strokeWidth.oninput = () => applyToSelection("strokeWidth", parseInt(strokeWidth.value, 10));
    
    if(strokeMiter) strokeMiter.onclick = () => applyToSelection("strokeLineJoin", "miter");
    if(strokeRound) strokeRound.onclick = () => applyToSelection("strokeLineJoin", "round");
}

function initLayerHandlers() {
    const actions = {
        'btnFront': 'bringToFront', 'btnBack': 'sendToBack',
        'btnForward': 'bringForward', 'btnBackward': 'sendBackwards'
    };
    Object.keys(actions).forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.onclick = () => {
            const o = canvas.getActiveObject();
            if(!o) return;
            canvas[actions[id]](o);
            if(actions[id] === 'sendToBack') {
                 const board = canvas.getObjects().find(o => o.isBoard);
                 if(board) canvas.sendToBack(board);
            }
            canvas.requestRenderAll();
        };
    });
}

function initShapeHandlers() {
    document.querySelectorAll(".shape-btn").forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.shape;
            const color = document.getElementById("fillColor")?.value || "#000000";
            let obj;
            const opt = { fill: color, strokeWidth: 0, originX: 'center', originY: 'center' };
            
            if(type === 'rect') obj = new fabric.Rect({...opt, width:100, height:100});
            else if(type === 'circle') obj = new fabric.Circle({...opt, radius:50});
            else if(type === 'triangle') obj = new fabric.Triangle({...opt, width:100, height:100});
            else if(type === 'star') obj = new fabric.Path('M 100 0 L 125 75 L 200 75 L 140 125 L 160 200 L 100 150 L 40 200 L 60 125 L 0 75 L 75 75 z', {...opt, scaleX:1, scaleY:1});
            else if(type === 'heart') obj = new fabric.Path('M 272 64 c -100 -100 -200 -50 -200 50 c 0 100 200 300 200 300 s 200 -200 200 -300 c 0 -100 -100 -150 -200 -50 z', {...opt, scaleX:0.3, scaleY:0.3});
            else if(type === 'arrow') obj = new fabric.Path('M 0 50 L 50 0 L 100 50 L 70 50 L 70 100 L 30 100 L 30 50 Z', {...opt, angle:90});
            else if(type === 'round') obj = new fabric.Rect({...opt, width:100, height:100, rx:20, ry:20});
            else if(type === 'line') obj = new fabric.Rect({...opt, width:200, height:5});
            
            if(obj) addToCenter(obj);
        };
    });
}

function initEditHandlers() {
    const btnCenterObject = document.getElementById("btnCenterObject");
    if (btnCenterObject) {
        btnCenterObject.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return;
            const board = canvas.getObjects().find(o => o.isBoard);
            if (board) {
                const boardCenterX = board.left + (board.getScaledWidth() / 2);
                const boardCenterY = board.top + (board.getScaledHeight() / 2);
                active.set({ originX: 'center', originY: 'center', left: boardCenterX, top: boardCenterY });
                active.setCoords();
            } else {
                canvas.centerObject(active);
            }
            canvas.requestRenderAll();
        };
    }

    const opacityInput = document.getElementById("opacitySlider");
    if (opacityInput) {
        opacityInput.oninput = () => applyToSelection("opacity", parseInt(opacityInput.value, 10) / 100);
    }

    const btnDel = document.getElementById("btnDel");
    if (btnDel) {
        btnDel.onclick = () => {
            const o = canvas.getActiveObject();
            if (!o) return;
            if (o.type === "activeSelection") {
                o.getObjects().forEach(obj => canvas.remove(obj));
                canvas.discardActiveObject();
            } else {
                canvas.remove(o);
            }
            canvas.requestRenderAll();
        };
    }
}

function initRotationHandlers() {
    const btnLeft = document.getElementById("btnRotateLeft15");
    const btnRight = document.getElementById("btnRotateRight15");
    const btnRotate = document.getElementById("btnRotateCanvas"); 

    if (btnLeft) btnLeft.onclick = () => rotateActive(-15);
    if (btnRight) btnRight.onclick = () => rotateActive(15);
    if (btnRotate) btnRotate.onclick = () => rotateActive(90);
}

function rotateActive(angle) {
    const active = canvas.getActiveObject();
    if (!active) return;
    active.rotate((active.angle || 0) + angle);
    active.setCoords();
    canvas.requestRenderAll();
}

function initAlignHandlers() {
    const actions = {
        'btnAlignLeft': 'left', 'btnAlignCenterH': 'centerH', 'btnAlignRight': 'right',
        'btnAlignTop': 'top', 'btnAlignMiddle': 'centerV', 'btnAlignBottom': 'bottom'
    };
    Object.keys(actions).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.onclick = () => alignObjects(actions[btnId]);
    });
}

function alignObjects(direction) {
    const active = canvas.getActiveObject();
    if (!active) return alert("정렬할 객체를 선택해주세요.");

    const processObj = (obj, bound) => {
        const w = obj.getScaledWidth();
        const h = obj.getScaledHeight();
        const halfW = w / 2;
        const halfH = h / 2;

        switch (direction) {
            case 'left': obj.set('left', obj.originX === 'center' ? bound.left + halfW : bound.left); break;
            case 'centerH': obj.set('left', obj.originX === 'center' ? bound.left + bound.width/2 : bound.left + bound.width/2 - halfW); break;
            case 'right': obj.set('left', obj.originX === 'center' ? bound.left + bound.width - halfW : bound.left + bound.width - w); break;
            case 'top': obj.set('top', obj.originY === 'center' ? bound.top + halfH : bound.top); break;
            case 'centerV': obj.set('top', obj.originY === 'center' ? bound.top + bound.height/2 : bound.top + bound.height/2 - halfH); break;
            case 'bottom': obj.set('top', obj.originY === 'center' ? bound.top + bound.height - halfH : bound.top + bound.height - h); break;
        }
        obj.setCoords();
    };

    if (active.type === 'activeSelection') {
        const bound = active.getBoundingRect();
        canvas.discardActiveObject();
        active.getObjects().forEach(o => processObj(o, bound));
        const sel = new fabric.ActiveSelection(active.getObjects(), { canvas: canvas });
        canvas.setActiveObject(sel);
    } else {
        const board = canvas.getObjects().find(o => o.isBoard);
        const bound = board ? board.getBoundingRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
        processObj(active, bound);
    }
    canvas.requestRenderAll();
}

// 모바일용 텍스트 에디터 관련 (유틸)
window.deleteMobileObject = function() {
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
        canvas.remove(activeObj);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        window.closeMobileTextEditor();
    }
};

window.toggleMobilePanel = function(side) {
    const leftPanel = document.getElementById('toolsPanel');
    const rightPanel = document.getElementById('rightStackPanel');
    if (side === 'left') {
        if (leftPanel) leftPanel.classList.toggle('open');
        if (rightPanel) rightPanel.classList.remove('open');
    } else if (side === 'right') {
        if (rightPanel) rightPanel.classList.toggle('open');
        if (leftPanel) leftPanel.classList.remove('open');
    }
};

// ============================================================
// [7] 로고 업로드 및 파일 핸들러
// ============================================================
window.uploadUserLogo = async () => {
    // config.js에서 currentUser 가져오기
    // (이 파일 상단에 import { currentUser } from "./config.js"; 추가 필요)
    // 여기서는 window.currentUser가 있다고 가정하거나 config에서 가져와야 함.
    // 안전을 위해 import 문에 currentUser 추가를 권장합니다.
    const { currentUser } = await import("./config.js");

    if (!currentUser) return alert("로그인이 필요한 기능입니다.");
    
    const fileInput = document.getElementById('logoFileInput');
    const tagInput = document.getElementById('logoKeywordInput');
    const file = fileInput.files[0];
    const tags = tagInput.value;
    
    if (!file) return alert("파일을 선택해주세요.");
    
    const btn = document.querySelector('#logoUploadModal .btn-round.primary');
    const oldText = btn.innerText;
    btn.innerText = "업로드 중...";
    btn.disabled = true;
    
    try {
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop(); 
        const safeFileName = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const filePath = `user_uploads/${currentUser.id}/${safeFileName}`;
        
        const { error: uploadError } = await sb.storage.from('design').upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: urlData } = sb.storage.from('design').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;
        
        const payload = {
            category: 'logo', tags: tags || '유저업로드', thumb_url: publicUrl, data_url: publicUrl,
            width: 1000, height: 1000, user_id: currentUser.id 
        };
        
        const { error: dbError } = await sb.from('library').insert(payload);
        if (dbError) throw dbError;
        
        alert(`✅ 업로드 성공!`);
        window.resetUpload(); 
        document.getElementById('logoUploadModal').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert("업로드 실패: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

window.handleFileSelect = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileNameNoExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const tagInput = document.getElementById('logoKeywordInput');
        if (tagInput && !tagInput.value) {
            tagInput.value = fileNameNoExt + " 로고";
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('previewImage');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            const icon = document.querySelector('.upload-icon');
            const text = document.querySelector('.upload-text');
            const sub = document.querySelector('.upload-sub');
            const delBtn = document.getElementById('removeFileBtn');
            if(icon) icon.style.display = 'none';
            if(text) text.style.display = 'none';
            if(sub) sub.style.display = 'none';
            if(delBtn) delBtn.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
};

window.resetUpload = (e) => {
    if(e) e.stopPropagation();
    const input = document.getElementById('logoFileInput');
    if(input) input.value = '';
    const tagInput = document.getElementById('logoKeywordInput');
    if(tagInput) tagInput.value = '';
    const preview = document.getElementById('previewImage');
    if(preview) preview.style.display = 'none';
    const icon = document.querySelector('.upload-icon');
    const text = document.querySelector('.upload-text');
    const sub = document.querySelector('.upload-sub');
    const delBtn = document.getElementById('removeFileBtn');
    if(icon) icon.style.display = 'block';
    if(text) text.style.display = 'block';
    if(sub) sub.style.display = 'block';
    if(delBtn) delBtn.style.display = 'none';
};