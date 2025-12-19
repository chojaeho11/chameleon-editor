import { canvas } from "./canvas-core.js";
import { updateLockUI } from "./canvas-utils.js";
import { FONT_URLS } from "./fonts.js";

// ============================================================
//             ★ KOREAN_FONTS 설정 (Supabase 연동)
// ============================================================
export const KOREAN_FONTS = Object.keys(FONT_URLS).map(key => ({
    name: key, label: key, url: FONT_URLS[key]
}));

export function initObjectTools() {
    // 1. Supabase 폰트 로드 (브라우저 등록)
    loadSupabaseFonts();

    // 2. 각종 핸들러 초기화
    initTextHandlers();
    initShapeHandlers();
    initEditHandlers(); 
    initSelectionEffects();
    initColorHandlers();
    initLayerHandlers();
    initAlignHandlers(); 
    initRotationHandlers();
    
    // 3. 캔바 스타일 실시간 편집 기능 활성화
    initAdvancedEditing();

    console.log("✨ canvas-objects.js initialized (Final Version)");
}

// [핵심] Supabase 폰트 파일을 다운로드하여 브라우저에 등록하는 함수
function loadSupabaseFonts() {
    KOREAN_FONTS.forEach(font => {
        const fontFace = new FontFace(font.name, `url(${font.url})`);
        fontFace.load().then(loadedFace => {
            document.fonts.add(loadedFace);
            console.log(`✅ 폰트 로드 성공: ${font.name}`);
        }).catch(err => {
            console.error(`❌ 폰트 로드 실패 (${font.name}):`, err);
        });
    });
}

// [추가] 구글 폰트 CSS (시스템 기본 폰트용)
function loadGoogleWebFontsCSS() {
    if (document.getElementById("google-fonts-link")) return;
    const link = document.createElement("link");
    link.id = "google-fonts-link";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Nanum+Gothic&family=Nanum+Myeongjo&family=Noto+Sans+KR&display=swap";
    document.head.appendChild(link);
}

// ============================================================
//  ★ [수정됨] 폰트 목록 렌더링 함수 (모달창 내부용)
// ============================================================
function renderFontList() {
    const listContainer = document.getElementById("fontList");
    if (!listContainer) return;
    
    listContainer.innerHTML = ""; // 초기화

    KOREAN_FONTS.forEach(font => {
        const div = document.createElement("div");
        div.className = "font-item";
        div.innerText = font.label || font.name; // 폰트 이름 표시
        
        // 스타일
        div.style.padding = "12px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";
        div.style.fontFamily = font.name; // ★ 해당 폰트로 미리보기
        div.style.fontSize = "18px";
        div.style.transition = "background 0.2s";

        // 마우스 오버 효과
        div.onmouseover = () => div.style.background = "#f8fafc";
        div.onmouseout = () => div.style.background = "white";

        // 클릭 시 폰트 적용
        div.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active) return alert("텍스트를 선택해주세요.");

            await document.fonts.load(`20px "${font.name}"`); // 로딩 대기
            
            // 적용 (그룹 내부까지 고려)
            const applyFont = (obj) => { 
                if (obj.type.includes('text')) obj.set("fontFamily", font.name); 
            };

            if (active.isEffectGroup || active.isOutlineGroup) {
                active.getObjects().forEach(o => applyFont(o));
                active.addWithUpdate();
            } else if (active.type === 'activeSelection') {
                active.getObjects().forEach(o => applyFont(o));
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
//  ★ [수정됨] 텍스트 핸들러 (제목/부제목/본문 버튼 연결)
// ============================================================
function initTextHandlers() {
    // 텍스트 추가 공통 함수
    const addTextToCanvas = (text, fontFamily, fontSize, fontWeight = 'normal') => {
        if (!window.canvas) return alert("캔버스가 로드되지 않았습니다.");

        // 폰트가 로드되었는지 확인 (선택 사항: 로딩 대기 후 추가)
        document.fonts.load(`${fontSize}px "${fontFamily}"`).then(() => {
            const t = new fabric.IText(text, {
                fontFamily: fontFamily, // fonts.js의 키값과 동일해야 함
                fontSize: fontSize,
                fontWeight: fontWeight,
                fill: "#000000",
                textAlign: 'center',
                left: 0, 
                top: 0
            });
            
            // 중앙 배치
            if (typeof addToCenter === 'function') {
                addToCenter(t);
            } else {
                window.canvas.add(t);
                window.canvas.centerObject(t);
                window.canvas.setActiveObject(t);
            }
            window.canvas.requestRenderAll();
            console.log(`📝 텍스트 추가됨: ${text} (${fontFamily})`);
        }).catch(() => {
            // 로드 실패 시 기본 폰트로 추가
            const t = new fabric.IText(text, { fontFamily: 'sans-serif', fontSize: fontSize, fill: "#000000" });
            window.canvas.add(t);
            window.canvas.centerObject(t);
            window.canvas.setActiveObject(t);
            window.canvas.requestRenderAll();
        });
    };

    // 버튼 클릭 이벤트 연결
    const connectButtons = () => {
        const btnTitle = document.getElementById("btnAddTitle");
        const btnSubtitle = document.getElementById("btnAddSubtitle");
        const btnBody = document.getElementById("btnAddBody");

        // 1. 제목 (Jalnan)
        if (btnTitle) {
            btnTitle.onclick = () => addTextToCanvas("제목을 입력하세요", "Jalnan", 80, "normal");
        } else console.warn("⚠️ 제목 버튼(btnAddTitle) 없음");

        // 2. 부제목 (HyundaiSansBold)
        if (btnSubtitle) {
            btnSubtitle.onclick = () => addTextToCanvas("부제목 내용을 입력하세요", "HyundaiSansBold", 50, "normal");
        }

        // 3. 본문 (HyundaiSansMedium)
        if (btnBody) {
            btnBody.onclick = () => addTextToCanvas("여기에 본문 내용을 입력하세요.\n여러 줄 입력이 가능합니다.", "HyundaiSansMedium", 30, "normal");
        }
    };

    connectButtons();
    setTimeout(connectButtons, 500); // HTML 로딩 딜레이 대비

    // 폰트 전체보기 모달 버튼
    const btnFontSelect = document.getElementById("btnFontSelect");
    if (btnFontSelect) {
        btnFontSelect.onclick = () => {
            if (!canvas.getActiveObject()) return alert("폰트를 변경할 텍스트를 선택하세요.");
            
            const modal = document.getElementById("fontModal");
            if (modal) {
                modal.style.display = "flex";
                // ★ 여기서 폰트 목록 렌더링 함수 호출!
                renderFontList();
            }
        };
    }
    
    // 정렬 및 스타일 핸들러
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

// ============================================================
//  🔥 파워 텍스트 효과 (메인 함수)
// ============================================================
window.applyTextEffect = function(type) {
    const active = canvas.getActiveObject();
    if (!active) return alert("텍스트를 선택해주세요.");

    // [초기화] 기존 효과 그룹 해제 후 원본 추출
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
            // 재귀 호출로 새 효과 적용
            window.applyTextEffect(type);
        });
        return;
    }

    if (!originalText.type.includes('text')) return alert("텍스트만 가능합니다.");

    // 비율 계산
    const fontSize = originalText.fontSize * originalText.scaleY; 
    const strokeW = Math.max(2, fontSize * 0.05);
    const depth3D = Math.max(5, fontSize * 0.15);
    const originalColor = originalText.fill || '#000000';

    switch (type) {
        case 'block-3d': 
            create3DEffect(originalText, '#4fffa5', '#000000', depth3D); 
            break;

        case 'neon-strong': 
            createNeonEffect(originalText, strokeW);
            break;

        case 'glitch-strong': 
            createGlitchEffect(originalText);
            break;

        case 'long-shadow': 
            // [수정] 원래 색상 유지 + 검정 그림자 + 선명함
            createLongShadow(originalText, originalColor, '#000000', 500); 
            break;

        case 'retro-candy':
            createCandyEffect(originalText, '#ef4444', '#15803d'); 
            break;

        case 'blue-candy':
            createCandyEffect(originalText, '#38bdf8', '#1e3a8a');
            break;

        case 'reset':
            originalText.set({ fill: '#000000', stroke: null, strokeWidth: 0, shadow: null });
            canvas.requestRenderAll();
            break;
    }
};

// ==========================================
// 🔥 효과 구현 상세 함수들
// ==========================================

// [1] 3D 블록
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

// [2] 강한 네온
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

            original.set({
                stroke: '#ffffff', strokeWidth: Math.max(1, strokeW * 0.1), fill: 'transparent', isMainText: true
            });
            layers.push(original);
            
            groupAndRender(layers);
        });
    });
}

// [3] 글리치
function createGlitchEffect(original) {
    const layers = [];
    const offset = Math.max(3, original.fontSize * 0.03); 

    original.clone((red) => {
        red.set({
            left: original.left - offset, top: original.top - offset,
            fill: 'red', opacity: 0.8, 
            stroke: null, strokeWidth: 0,
            selectable: false, isClone: true
        });
        layers.push(red);
        
        original.clone((cyan) => {
            cyan.set({
                left: original.left + offset, top: original.top + offset,
                fill: 'cyan', opacity: 0.8, 
                stroke: null, strokeWidth: 0,
                selectable: false, isClone: true
            });
            layers.push(cyan);
            
            original.set({ fill: '#ffffff', stroke: null, strokeWidth: 0, isMainText: true });
            layers.push(original);
            
            groupAndRender(layers);
        });
    });
}

// [4] 긴 그림자 (원래 색상 유지)
function createLongShadow(original, textColor, shadowColor, length) {
    const layers = [];
    const step = 2; 
    const count = Math.floor(length / step); 

    for(let i=1; i<=count; i++) {
        original.clone((s) => {
            s.set({
                left: original.left + (i * step), 
                top: original.top + (i * step),
                fill: shadowColor,
                stroke: null, strokeWidth: 0,
                shadow: null, 
                selectable: false, evented: false, isClone: true
            });
            layers.push(s);
            
            if(i === count) {
                original.set({ fill: textColor, isMainText: true });
                layers.push(original);
                groupAndRender(layers);
            }
        });
    }
}

// [5] 캔디 효과 (고해상도 벡터)
function createCandyEffect(original, color1, color2) {
    const candyPattern = generateHighResPattern(color1, color2);

    original.set({
        fill: candyPattern,
        stroke: '#ffffff', 
        strokeWidth: Math.max(3, original.fontSize * 0.04),
        paintFirst: 'stroke',
        isMainText: true
    });

    original.clone((shadow) => {
        shadow.set({
            fill: '#000000', stroke: null, strokeWidth: 0,
            left: original.left + 5, top: original.top + 5,
            opacity: 0.25, isClone: true, selectable: false
        });
        groupAndRender([shadow, original]);
    });
}

// [60px 벡터 패턴]
function generateHighResPattern(bgCol, lineCol) {
    const size = 60; 
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size;
    patternCanvas.height = size;
    const ctx = patternCanvas.getContext('2d');

    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, size, size);

    ctx.beginPath();
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = size / 2.2; 
    ctx.lineCap = 'butt';

    ctx.moveTo(0, size);
    ctx.lineTo(size, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-size/2, size/2);
    ctx.lineTo(size/2, -size/2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size/2, size + size/2);
    ctx.lineTo(size + size/2, size/2);
    ctx.stroke();

    return new fabric.Pattern({
        source: patternCanvas,
        repeat: 'repeat'
    });
}

function groupAndRender(items) {
    items.forEach(obj => canvas.remove(obj));
    // 스케일 중복 방지를 위해 그룹의 scale은 기본 1로 생성
    const group = new fabric.Group(items, {
        canvas: canvas,
        isEffectGroup: true,
    });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
}

// ============================================================
//  🔥 캔바 스타일: 더블 클릭 실시간 편집 (Advanced Editing)
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

    clones.forEach(clone => {
        clone.set({ selectable: false, evented: false, opacity: clone.opacity * 0.5 });
    });

    canvas.discardActiveObject(); 
    canvas.setActiveObject(mainText); 
    mainText.enterEditing(); 
    mainText.selectAll(); 

    const syncHandler = () => {
        const content = mainText.text;
        clones.forEach(clone => clone.set('text', content));
        canvas.requestRenderAll();
    };
    mainText.on('changed', syncHandler);

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
//             기타 필수 핸들러
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

    if (fillColor) fillColor.oninput = () => applyToSelection("fill", fillColor.value);
    if (strokeColor) strokeColor.oninput = () => applyToSelection("stroke", strokeColor.value);
    if (strokeWidth) strokeWidth.oninput = () => applyToSelection("strokeWidth", parseInt(strokeWidth.value, 10));
}

function applyToSelection(prop, val) {
    const active = canvas.getActiveObject();
    if (!active) return;

    if (active.isEffectGroup) {
        const mainText = active.getObjects().find(o => o.isMainText);
        if (prop === 'fill' && mainText) mainText.set('fill', val);
        else if ((prop === 'stroke' || prop === 'strokeWidth') && mainText) {
            mainText.set(prop, val);
        } else {
            active.getObjects().forEach(o => o.set(prop, val));
        }
        active.addWithUpdate();
    } else if (active.isOutlineGroup) {
        const clone = active.getObjects().find(o => o.isOutlineClone);
        const original = active.getObjects().find(o => !o.isOutlineClone);
        if (prop === 'fill' && original) original.set('fill', val);
        else if ((prop === 'stroke' || prop === 'strokeWidth') && clone) clone.set(prop, val);
        else active.getObjects().forEach(o => o.set(prop, val));
        active.addWithUpdate();
    } else if (active.type === "activeSelection" || active.type === "group") {
        active.getObjects().forEach(obj => obj.set(prop, val));
    } else {
        active.set(prop, val);
    }
    canvas.requestRenderAll();
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
            const opt = { fill: color, strokeWidth: 0 };
            
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
                active.set({ originX: 'center', left: boardCenterX });
                active.setCoords();
            } else {
                canvas.centerObjectH(active);
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
    if (btnLeft) btnLeft.onclick = () => rotateActive(-15);
    if (btnRight) btnRight.onclick = () => rotateActive(15);
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