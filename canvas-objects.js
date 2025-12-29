import { canvas } from "./canvas-core.js";
import { updateLockUI } from "./canvas-utils.js";
import { sb, currentUser } from "./config.js";

// ============================================================
// [설정] 현재 사이트 언어 및 폰트 변수
// ============================================================
const urlParams = new URLSearchParams(window.location.search);
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
        
        // 현재 국가코드와 일치하는 폰트만 조회 (오래된 순 = 등록순)
        const { data, error } = await sb.from('site_fonts')
            .select('*')
            .eq('site_code', CURRENT_LANG)
            .order('created_at', { ascending: true });

        if (error) throw error;

        DYNAMIC_FONTS = data || [];

        // FontFace API를 사용하여 폰트 파일 비동기 로드
        const fontPromises = DYNAMIC_FONTS.map(font => {
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
        div.innerText = font.font_name; // 화면에 보여줄 이름
        
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

// ============================================================
// [3] 텍스트 핸들러 (Text Tools)
// ============================================================
function initTextHandlers() {
    const btnBasic = document.getElementById("btnAddBasicText");
    
    if (btnBasic) {
        btnBasic.onclick = () => {
            // 1. 폰트 설정 (1번째 등록된 폰트 우선 사용)
            const targetFontObj = DYNAMIC_FONTS[0] || { font_family: 'sans-serif' };
            const family = targetFontObj.font_family;
            
            // 2. 대지(Board) 너비 계산
            // 보드가 없으면 캔버스 전체 너비를 기준으로 함
            const board = canvas.getObjects().find(o => o.isBoard);
            const baseW = board ? (board.width * board.scaleX) : canvas.width;

            // 3. 텍스트 객체 생성 (일단 임의의 크기로 생성)
            const textString = "“The Story”";
            const t = new fabric.IText(textString, {
                fontFamily: family,
                fontSize: 30, // 초기값 (계산 후 변경됨)
                fill: "#1f1f1fff", 
                left: 0, top: 0,
                originX: 'center', originY: 'center'
            });

            // 4. ★ 핵심: 대지 너비의 2/3(66%)에 맞게 폰트 크기 자동 조절
            if (t.width > 0) {
                const targetWidth = baseW * 0.66; // 목표 너비 (2/3)
                const scaleFactor = targetWidth / t.width; // 비율 계산
                
                // 폰트 사이즈에 비율을 곱해서 적용
                t.set('fontSize', t.fontSize * scaleFactor);
                // (선택사항) 만약 너무 커지는게 싫다면 최대값 제한 가능: Math.min(t.fontSize * scaleFactor, 200)
            }

            addToCenter(t);
        };
    }

    // 폰트 전체보기 버튼 이벤트 연결
    const btnFontSelect = document.getElementById("btnFontSelect");
    if (btnFontSelect) {
        btnFontSelect.onclick = () => {
            if (!canvas.getActiveObject()) return alert("폰트를 변경할 텍스트를 선택하세요.");
            
            const modal = document.getElementById("fontModal");
            if (modal) {
                modal.style.display = "flex";
                renderFontList(); 
            }
        };
    }
    
    setupStyleHandlers();
}

// ============================================================
// ★★★ [리뉴얼 V2] 텍스트 마법사 (여백 확보 및 사이즈 최적화) ★★★
// ============================================================
window.applyTextWizard = function(type) {
    if (!canvas) return;

    // 1. 폰트 매핑
    const titleFont = (DYNAMIC_FONTS[0] || { font_family: 'sans-serif' }).font_family;
    const bodyFont = ((DYNAMIC_FONTS.length > 5) ? DYNAMIC_FONTS[5] : (DYNAMIC_FONTS[0] || { font_family: 'sans-serif' })).font_family;

    // 2. 작업 영역(Board) 계산
    const board = canvas.getObjects().find(o => o.isBoard);
    const baseX = board ? board.left : 0;
    const baseY = board ? board.top : 0;
    const baseW = board ? (board.width * board.scaleX) : canvas.width;
    const baseH = board ? (board.height * board.scaleY) : canvas.height;
    
    // 중앙점
    const centerX = baseX + baseW / 2;
    const centerY = baseY + baseH / 2;

    const objects = [];

    // 텍스트 생성 헬퍼
    const addText = (text, font, sizeRatio, weight, left, top, align, color='#111', spacing=0) => {
        return new fabric.IText(text, {
            fontFamily: font,
            fontSize: baseH * sizeRatio, // 높이 비례 사이즈
            fontWeight: weight,
            fill: color,
            left: left,
            top: top,
            originX: align, 
            originY: 'top',
            textAlign: align,
            charSpacing: spacing
        });
    };

    // ----------------------------------------------------------------
// [A] Business Card - Reduce element sizes and keep comfortable spacing
// ----------------------------------------------------------------
if (type === 'card') {
    // Layout zones (keep ~4:6 ratio but add padding)
    const leftZoneCenter = baseX + (baseW * 0.22); // logo center
    const dividerX = baseX + (baseW * 0.45);       // divider position (slightly more to the right)
    const infoStartX = baseX + (baseW * 0.50);     // info start (keep gap from divider)

    // 1. Logo area (scale down 0.18 -> 0.15)
    const icon = addText("✂", 'sans-serif', 0.15, 'normal', leftZoneCenter, baseY + baseH * 0.28, 'center', '#222');
    icon.set({ angle: -90 });

    // Brand name (scale down 0.07 -> 0.06)
    const logoMain = addText("SOON HAIR", titleFont, 0.06, 'bold', leftZoneCenter, baseY + baseH * 0.50, 'center', '#111', 20);
    const logoSub  = addText("SOON HAIR", bodyFont, 0.03, 'normal', leftZoneCenter, baseY + baseH * 0.60, 'center', '#555', 50);

    // 2. Divider line
    const line = new fabric.Rect({
        left: dividerX, top: baseY + (baseH * 0.2),
        width: Math.max(1, baseW * 0.002), height: baseH * 0.6,
        fill: '#ccc', originX: 'center', originY: 'top'
    });

    // 3. Right-side info (smaller font to prevent overlap)
    // Name + Title
    const name = addText("Jihyun Soon", titleFont, 0.07, 'bold', infoStartX, baseY + baseH * 0.22, 'left', '#111', 10);
    const job  = addText("Owner | Hair Designer", bodyFont, 0.028, 'normal', infoStartX, baseY + baseH * 0.32, 'left', '#666');

    // Contact (scale down 0.08 -> 0.065)
    const phoneLabel = addText("Reservation", bodyFont, 0.022, 'normal', infoStartX, baseY + baseH * 0.46, 'left', '#888');
    const phone      = addText("+82 2-1234-5678", titleFont, 0.065, 'bold', infoStartX, baseY + baseH * 0.50, 'left', '#111');

    // Address (scale down 0.032 -> 0.025)
    const addr = addText("5F, Soon Bldg, 5 Myeongdong 3-gil, Jung-gu, Seoul", bodyFont, 0.025, 'normal', infoStartX, baseY + baseH * 0.68, 'left', '#444');
    const sns  = addText("Kakao: soonhair   Insta: soon_official", bodyFont, 0.025, 'normal', infoStartX, baseY + baseH * 0.73, 'left', '#444');

    objects.push(icon, logoMain, logoSub, line, name, job, phoneLabel, phone, addr, sns);
}

// ----------------------------------------------------------------
// [B] Menu - Keep side padding and auto-adjust dotted line width
// ----------------------------------------------------------------
else if (type === 'menu') {
    // Top title (scale down 0.08 -> 0.06)
    const mainTitle = addText("PREMIUM COFFEE", titleFont, 0.06, 'bold', centerX, baseY + baseH * 0.10, 'center', '#2C3E50', 50);
    const subTitle  = addText("Fresh Roasted Beans", bodyFont, 0.025, 'normal', centerX, baseY + baseH * 0.17, 'center', '#7F8C8D', 100);

    // Divider line
    const topDescLine = new fabric.Rect({
        left: centerX, top: baseY + baseH * 0.21,
        width: baseW * 0.1, height: 2, fill: '#D35400', originX: 'center'
    });
    objects.push(mainTitle, subTitle, topDescLine);

    // Menu list (8 items)
    const items = [
        { n: "Espresso",          p: "4.0" },
        { n: "Americano",         p: "4.5" },
        { n: "Café Latte",        p: "5.0" },
        { n: "Vanilla Bean Latte",p: "5.5" },
        { n: "Caramel Macchiato", p: "5.5" },
        { n: "Cold Brew",         p: "5.0" },
        { n: "Jeju Matcha Latte", p: "6.0" },
        { n: "Real Chocolate Latte", p: "5.5" }
    ];

    const startY = baseY + baseH * 0.30;
    const gapY = baseH * 0.075;          // vertical spacing
    const paddingSide = baseW * 0.15;    // 15% padding each side (30% total)
    const menuLeftX = baseX + paddingSide;
    const menuRightX = baseX + baseW - paddingSide;

    // Dotted-line width calculation (total width - side padding - estimated text area)
    const dotLineWidth = (baseW - (paddingSide * 2)) * 0.4;

    items.forEach((item, i) => {
        const yPos = startY + (i * gapY);

        // Item name (scale down 0.04 -> 0.032)
        const mName = addText(item.n, bodyFont, 0.032, 'bold', menuLeftX, yPos, 'left', '#333');

        // Dotted line (position adjusted)
        const dotLine = new fabric.Rect({
            left: menuLeftX + (baseW * 0.30), // start after item name
            top: yPos + (baseH * 0.025),      // mid-height of text
            width: dotLineWidth,
            height: 1,
            fill: '#ddd',
            originX: 'left'
        });

        // Price
        const mPrice = addText(item.p, titleFont, 0.032, 'bold', menuRightX, yPos, 'right', '#D35400');

        objects.push(mName, dotLine, mPrice);
    });
}

// ----------------------------------------------------------------
// [C] Poster (Flyer) - Reduce huge title size + change title color to BLUE
// ----------------------------------------------------------------
else if (type === 'flyer') {
    // Huge title (scale down 0.18 -> 0.15, add left padding)
    const bigTitle = addText("GRAND\nOPENING", titleFont, 0.15, 'bold', baseX + baseW * 0.08, baseY + baseH * 0.08, 'left', '#141f42ff');
    bigTitle.set({ lineHeight: 0.9, charSpacing: -10 });

    // Date box (narrower width)
    const dateBox = new fabric.Rect({
        left: baseX + baseW * 0.08, top: baseY + baseH * 0.45,
        width: baseW * 0.35, height: baseH * 0.07, fill: '#110c4bff', originX: 'left'
    });

    // Date text
    const dateText = addText("Dec 25, 2025", bodyFont, 0.04, 'bold', baseX + baseW * 0.255, baseY + baseH * 0.465, 'center', '#fff');

    // Bottom details (secure right margin 0.95 -> 0.92, scaled down)
    const detailText = addText(
        "Venue: COEX Hall A, Seoul\nTime: 10:00 AM - 06:00 PM\nHost: Chameleon Design",
        bodyFont, 0.03, 'normal',
        baseX + baseW * 0.92, baseY + baseH * 0.78, 'right', '#1d1d1dff'
    );
    detailText.set({ lineHeight: 1.6 });

    objects.push(bigTitle, dateBox, dateText, detailText);
}

// ----------------------------------------------------------------
// [D] Basic - Change title color to SKY BLUE
// ----------------------------------------------------------------
else {
    const title = addText("2025 EXHIBITION", titleFont, 0.07, 'bold', centerX, baseY + baseH * 0.35, 'center', '#da0959ff');
    const sub   = addText("Future of Design & Art", bodyFont, 0.035, 'normal', centerX, baseY + baseH * 0.50, 'center', '#da0959ff');
    const info  = addText("Date: Aug 15, 2025 | Venue: DDP Art Hall", bodyFont, 0.022, 'normal', centerX, baseY + baseH * 0.85, 'center', '#181818ff');
    objects.push(title, sub, info);
}

// Add to canvas
if (objects.length > 0) {
    canvas.discardActiveObject();
    const addedObjs = [];
    objects.forEach(obj => {
        canvas.add(obj);
        addedObjs.push(obj);
    });
    const sel = new fabric.ActiveSelection(addedObjs, { canvas: canvas });
    canvas.setActiveObject(sel);
    canvas.requestRenderAll();
}
};



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

    const btnOutline = document.getElementById("btnOutline");
    if (btnOutline) {
        btnOutline.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return alert("외곽선을 적용할 객체를 선택해주세요.");

            const defaultColor = "#ff6060ff"; // 갈색 (SaddleBrown)
            const defaultWidth = 5;         // 중간 두께

            // 1. 객체에 속성 적용 (함수 재사용)
            applyToSelection("stroke", defaultColor);
            applyToSelection("strokeWidth", defaultWidth);
            
            // 텍스트의 경우 외곽선이 글자를 덮지 않도록 설정 (선택사항)
            applyToSelection("paintFirst", "stroke"); 

            // 2. UI(입력창) 상태 동기화
            if (strokeColor) strokeColor.value = defaultColor;
            if (strokeWidth) strokeWidth.value = defaultWidth;

            canvas.requestRenderAll();
        };
    }

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
    // 상단 import { currentUser } 사용
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