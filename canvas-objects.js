import { canvas } from "./canvas-core.js";
import { updateLockUI } from "./canvas-utils.js";
import { FONT_URLS } from "./fonts.js";

// ============================================================
//             ★ KOREAN_FONTS
// ============================================================
export const KOREAN_FONTS = Object.keys(FONT_URLS).map(key => ({
    name: key, label: key, url: FONT_URLS[key]
}));

console.log("📌 로딩된 한국어 폰트 목록:", KOREAN_FONTS);

export function initObjectTools() {
    loadGoogleWebFontsCSS();
    loadSupabaseFonts();

    initTextHandlers();
    initShapeHandlers();
    initEditHandlers(); 
    initSelectionEffects();
    initColorHandlers();
    initLayerHandlers();
    initAlignHandlers(); 
    initRotationHandlers();
    
    // [추가] 텍스트 동기화 이벤트 (그룹 내 텍스트 수정 시 테두리도 같이 수정)
    if (canvas) {
        canvas.on('text:changed', (e) => {
            const obj = e.target;
            // 아웃라인 그룹 내부의 텍스트가 변경되었을 때
            if (obj.group && obj.group.isOutlineGroup) {
                const group = obj.group;
                const clone = group.getObjects().find(o => o.isOutlineClone);
                const original = group.getObjects().find(o => !o.isOutlineClone);
                
                if (clone && original) {
                    // 내용 및 폰트 속성 동기화
                    clone.set({
                        text: original.text,
                        fontFamily: original.fontFamily,
                        fontStyle: original.fontStyle,
                        fontWeight: original.fontWeight
                    });
                    // 그룹 형태 재계산 (중요)
                    group.addWithUpdate(); 
                }
            }
        });
    }

    console.log("✨ canvas-objects.js initialized");
}

function loadSupabaseFonts() {
    KOREAN_FONTS.forEach(font => {
        const fontFace = new FontFace(font.name, `url(${font.url})`);
        fontFace.load().then(loaded => document.fonts.add(loaded));
    });
}

function loadGoogleWebFontsCSS() {
    if (document.getElementById("google-fonts-link")) return;
    const link = document.createElement("link");
    link.id = "google-fonts-link";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Nanum+Gothic&family=Nanum+Myeongjo&family=Noto+Sans+KR&display=swap";
    document.head.appendChild(link);
}

function renderKoreanFontList() {
    const list = document.getElementById("fontList");
    if (!list) return;
    list.innerHTML = "";
    KOREAN_FONTS.forEach(font => {
        const div = document.createElement("div");
        div.className = "font-item";
        div.innerText = font.label;
        div.style.padding = "10px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";
        div.style.fontFamily = font.name;
        div.style.fontSize = "16px";
        div.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active) return alert("텍스트를 먼저 선택하세요.");
            await document.fonts.load(`20px "${font.name}"`);
            
            // 폰트 변경 적용 (그룹이면 재귀적으로)
            const fontName = font.name;
            
            if(active.isOutlineGroup) {
                active.getObjects().forEach(o => o.set("fontFamily", fontName));
                active.addWithUpdate();
            } else {
                active.set("fontFamily", fontName);
            }
            
            canvas.requestRenderAll();
            document.getElementById("fontModal").style.display = "none";
        };
        list.appendChild(div);
    });
}

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

// [선택 관리]
function initSelectionEffects() {
    canvas.on("selection:created", handleSelectionChange);
    canvas.on("selection:updated", handleSelectionChange);
    canvas.on("selection:cleared", () => {
        updateLockUI();
        const strokeInput = document.getElementById("globalStroke");
        if(strokeInput) strokeInput.value = 0;
    });
}

function handleSelectionChange(e) {
    const active = canvas.getActiveObject();
    if (active && active.type === 'activeSelection') {
        const objects = active.getObjects();
        const lockedObjects = objects.filter(o => o.lockMovementX);
        if (lockedObjects.length > 0) {
            lockedObjects.forEach(obj => active.removeWithUpdate(obj));
            if (active.getObjects().length === 0) canvas.discardActiveObject();
            else if (active.getObjects().length === 1) {
                const singleObj = active.getObjects()[0];
                canvas.discardActiveObject();
                canvas.setActiveObject(singleObj);
            }
            canvas.requestRenderAll();
        }
    }
    syncSelectionUI();
}

function syncSelectionUI() {
    updateLockUI();
    const active = canvas.getActiveObject();
    if (!active) return;
    
    // 그룹일 경우 첫 번째 자식(혹은 클론)의 속성을 UI에 반영
    let target = active;
    if (active.isOutlineGroup) {
        // 아웃라인 그룹이면 테두리 두께는 클론에서 가져와야 함
        target = active.getObjects().find(o => o.isOutlineClone) || active;
    } else if (active.type === 'group' || active.type === 'activeSelection') {
        const children = active.getObjects();
        if (children.length > 0) target = children[0];
    }
    
    const strokeInput = document.getElementById("globalStroke");
    if(strokeInput) strokeInput.value = target.strokeWidth || 0;
}

// [색상/선 설정]
function initColorHandlers() {
    const fillColor = document.getElementById("fillColor");
    const strokeColor = document.getElementById("strokeColor");
    const strokeWidth = document.getElementById("globalStroke");

    if (fillColor) fillColor.oninput = () => applyToSelection("fill", fillColor.value);
    
    if (strokeColor) {
        strokeColor.oninput = () => {
            applyToSelection("stroke", strokeColor.value);
        };
    }
    
    if (strokeWidth) {
        strokeWidth.oninput = () => {
            applyToSelection("strokeWidth", parseInt(strokeWidth.value, 10));
        };
    }
    
    // ... (Miter/Round 버튼 생략 - 필요시 추가)
}

// [핵심] 속성 적용 함수 (그룹/아웃라인 지원)
function applyToSelection(prop, val) {
    const active = canvas.getActiveObject();
    if (!active) return;

    // 아웃라인 그룹일 때 특별 처리
    if (active.isOutlineGroup) {
        const clone = active.getObjects().find(o => o.isOutlineClone);
        const original = active.getObjects().find(o => !o.isOutlineClone);
        
        if (prop === 'fill') {
            // 면 색상은 원본 글씨에만 적용
            if(original) original.set('fill', val);
        } else if (prop === 'stroke' || prop === 'strokeWidth') {
            // 테두리 속성은 클론(뒤쪽)에만 적용
            if(clone) clone.set(prop, val);
        } else {
            // 그 외(폰트 등)는 둘 다 적용
            active.getObjects().forEach(o => o.set(prop, val));
        }
        active.addWithUpdate(); // 그룹 갱신
    } 
    // 일반 그룹/다중 선택
    else if (active.type === "activeSelection" || active.type === "group") {
        active.getObjects().forEach(obj => obj.set(prop, val));
    } 
    // 단일 객체
    else {
        active.set(prop, val);
    }
    canvas.requestRenderAll();
}

// 레이어 순서
function initLayerHandlers() {
    const actions = {
        'btnFront': 'bringToFront', 'btnBack': 'sendToBack',
        'btnForward': 'bringForward', 'btnBackward': 'sendBackwards'
    };
    Object.keys(actions).forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.onclick = () => {
                const o = canvas.getActiveObject();
                if(!o) return;
                canvas[actions[id]](o);
                if(actions[id] === 'sendToBack') {
                     const board = canvas.getObjects().find(o => o.isBoard);
                     if(board) canvas.sendToBack(board);
                }
                canvas.requestRenderAll();
            };
        }
    });
}

// [텍스트 조작]
function initTextHandlers() {
    const btnAddText = document.getElementById("btnAddText");
    if (btnAddText) {
        btnAddText.onclick = () => {
            const t = new fabric.IText("텍스트", { 
                fontFamily: "NanumMyeongjo", fontSize: 60,
                fill: "#000000"
            });
            addToCenter(t);
        };
    }
    const btnFontSelect = document.getElementById("btnFontSelect");
    if (btnFontSelect) {
        btnFontSelect.onclick = () => {
            if (!canvas.getActiveObject()) return alert("텍스트를 선택하세요.");
            document.getElementById("fontModal").style.display = "flex";
            renderKoreanFontList();
        };
    }
    
    const alignLeft = document.getElementById("btnAlignLeftText");
    const alignCenter = document.getElementById("btnAlignCenterText");
    const alignRight = document.getElementById("btnAlignRightText");
    if(alignLeft) alignLeft.onclick = () => applyToSelection("textAlign", "left");
    if(alignCenter) alignCenter.onclick = () => applyToSelection("textAlign", "center");
    if(alignRight) alignRight.onclick = () => applyToSelection("textAlign", "right");

    // [★ 글자 테두리 버튼 - "복제 & 그룹" 방식 적용]
    const btnOutline = document.getElementById("btnOutline");
    if (btnOutline) {
        btnOutline.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return;

            // 1. 이미 아웃라인 그룹이면 -> 해제 (테두리 삭제)
            if (active.type === 'group' && active.isOutlineGroup) {
                const items = active.toActiveSelection(); // 그룹 풀기
                const objects = items.getObjects();
                
                const clone = objects.find(o => o.isOutlineClone);
                const original = objects.find(o => !o.isOutlineClone);
                
                // 클론(테두리) 삭제
                if (clone) canvas.remove(clone);
                
                // 원본만 남김
                if (original) {
                    canvas.discardActiveObject();
                    canvas.setActiveObject(original);
                }
                document.getElementById("globalStroke").value = 0;
                canvas.requestRenderAll();
                return;
            }

            // 2. 일반 텍스트면 -> 아웃라인 그룹 생성
            if (active.type === 'i-text' || active.type === 'text') {
                active.clone((cloned) => {
                    // 클론 (뒤쪽, 테두리용)
                    cloned.set({
                        fill: 'transparent', // 면 없음
                        stroke: '#ffffff',   // 흰색 테두리
                        strokeWidth: 6,      // 두껍게 (뒤에 있으므로 절반만 보임)
                        strokeLineJoin: 'round',
                        strokeLineCap: 'round',
                        isOutlineClone: true,
                        selectable: false,
                        evented: false
                    });

                    // 원본 (앞쪽, 글씨용)
                    active.set({
                        stroke: null,
                        strokeWidth: 0,
                        isOutlineClone: false
                    });
                    
                    // 그룹핑
                    const group = new fabric.Group([cloned, active], {
                        isOutlineGroup: true,
                        originX: 'center', 
                        originY: 'center',
                        left: active.left,
                        top: active.top
                    });

                    canvas.remove(active);
                    canvas.add(group);
                    canvas.setActiveObject(group);
                    
                    document.getElementById("globalStroke").value = 6;
                    // UI 싱크
                    const strokeColorPicker = document.getElementById("strokeColor");
                    if(strokeColorPicker) strokeColorPicker.value = "#ffffff";
                    
                    canvas.requestRenderAll();
                });
            }
        };
    }

    const textSize = document.getElementById("textSize");
    const charSpacing = document.getElementById("textCharSpacing");
    const lineHeight = document.getElementById("textLineHeight");
    if (textSize) textSize.oninput = () => applyToSelection("fontSize", parseInt(textSize.value));
    if (charSpacing) charSpacing.oninput = () => applyToSelection("charSpacing", parseInt(charSpacing.value));
    if (lineHeight) lineHeight.oninput = () => applyToSelection("lineHeight", parseFloat(lineHeight.value));
}

// 도형 추가
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

// 편집 도구
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

    const btnFitBoard = document.getElementById("btnFitBoard");
    if(btnFitBoard) {
        btnFitBoard.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return alert("객체를 선택하세요.");
            const board = canvas.getObjects().find(o => o.isBoard);
            if (!board) return alert("대지가 없습니다.");
            
            const scale = Math.min(board.getScaledWidth() / active.width, board.getScaledHeight() / active.height);
            active.set({
                scaleX: scale, scaleY: scale,
                left: board.left + board.getScaledWidth()/2,
                top: board.top + board.getScaledHeight()/2,
                originX: 'center', originY: 'center'
            });
            active.setCoords();
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

// 회전 핸들러
function initRotationHandlers() {
    const btnLeft = document.getElementById("btnRotateLeft15");
    const btnRight = document.getElementById("btnRotateRight15");

    if (btnLeft) {
        btnLeft.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return;
            active.rotate((active.angle || 0) - 15);
            active.setCoords();
            canvas.requestRenderAll();
        };
    }
    if (btnRight) {
        btnRight.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return;
            active.rotate((active.angle || 0) + 15);
            active.setCoords();
            canvas.requestRenderAll();
        };
    }
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