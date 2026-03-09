/* ═══ Greeting Card Mode v1 ═══ */
import { pageDataList, currentPageIndex, goToPage, addNewPage, deleteCurrentPage } from "./canvas-pages.js?v=123";
import { canvas } from "./canvas-core.js?v=123";

const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

/* ─── Constants ─── */
const CUSTOM_PROPS = ['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst','isGcPlaceholder','isGcPlaceholderText','gcPlaceholderId'];

/* ─── Category Color Palettes ─── */
const PALETTES = {
    christmas: { bg:'#1a472a', accent:'#c41e3a', text:'#fff', sub:'#ffd700', light:'#2d5a3f' },
    newyear:   { bg:'#0f172a', accent:'#f59e0b', text:'#fff', sub:'#a78bfa', light:'#1e293b' },
    birthday:  { bg:'#fef3c7', accent:'#f472b6', text:'#1e293b', sub:'#a78bfa', light:'#fff7ed' },
    thankyou:  { bg:'#f0fdf4', accent:'#16a34a', text:'#1e293b', sub:'#86efac', light:'#dcfce7' },
    congrats:  { bg:'#fef9c3', accent:'#f97316', text:'#1e293b', sub:'#fb923c', light:'#fffbeb' },
    valentines:{ bg:'#fdf2f8', accent:'#ec4899', text:'#1e293b', sub:'#f9a8d4', light:'#fce7f3' }
};

const CATEGORY_EMOJIS = {
    christmas:'🎄', newyear:'🎆', birthday:'🎂', thankyou:'🙏', congrats:'🎉', valentines:'💕'
};

const CATEGORY_GREETINGS = {
    christmas: { title:'Merry Christmas', sub:'따뜻한 크리스마스 보내세요' },
    newyear:   { title:'Happy New Year', sub:'새해 복 많이 받으세요' },
    birthday:  { title:'Happy Birthday', sub:'생일 축하합니다' },
    thankyou:  { title:'Thank You', sub:'감사합니다' },
    congrats:  { title:'Congratulations', sub:'축하합니다' },
    valentines:{ title:'Happy Valentine\'s Day', sub:'사랑합니다' }
};

/* ─── Card Templates ─── */
const CARD_TEMPLATES = {
    cover: {
        name: _t('gc_tpl_cover','표지'), icon: 'fa-image',
        build(w, h, cat='christmas') {
            const p = PALETTES[cat] || PALETTES.christmas;
            const g = CATEGORY_GREETINGS[cat] || CATEGORY_GREETINGS.christmas;
            const emoji = CATEGORY_EMOJIS[cat] || '✨';
            return [
                { type:'textbox', text:emoji, left:w*0.35, top:h*0.08, width:w*0.3,
                  fontSize:Math.round(h*0.06), fontFamily:'Georgia, serif',
                  fill:p.accent, textAlign:'center' },
                { type:'textbox', text:g.title, left:w*0.05, top:h*0.18, width:w*0.9,
                  fontSize:Math.round(h*0.045), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:p.text, textAlign:'center' },
                { type:'rect', left:w*0.1, top:h*0.28, width:w*0.8, height:h*0.38,
                  fill:p.light, rx:16, ry:16, stroke:p.accent, strokeWidth:2,
                  isGcPlaceholder:true, gcPlaceholderId:'cover_main' },
                { type:'textbox', text:_t('gc_photo_here','사진을 넣어주세요'), left:w*0.2, top:h*0.44, width:w*0.6,
                  fontSize:Math.round(h*0.022), fontFamily:'Georgia, serif',
                  fill:p.sub, textAlign:'center', editable:false,
                  isGcPlaceholderText:true, gcPlaceholderId:'cover_main' },
                { type:'textbox', text:g.sub, left:w*0.1, top:h*0.72, width:w*0.8,
                  fontSize:Math.round(h*0.028), fontFamily:'Georgia, serif',
                  fill:p.text, textAlign:'center' },
                { type:'rect', left:w*0.3, top:h*0.82, width:w*0.4, height:2,
                  fill:p.accent },
                { type:'textbox', text:'From. ___', left:w*0.15, top:h*0.87, width:w*0.7,
                  fontSize:Math.round(h*0.022), fontFamily:'Georgia, serif',
                  fill:p.sub, textAlign:'center' }
            ];
        }
    },
    message: {
        name: _t('gc_tpl_message','메시지'), icon: 'fa-comment-dots',
        build(w, h, cat='christmas') {
            const p = PALETTES[cat] || PALETTES.christmas;
            const emoji = CATEGORY_EMOJIS[cat] || '✨';
            return [
                { type:'textbox', text:emoji, left:w*0.42, top:h*0.06, width:w*0.16,
                  fontSize:Math.round(h*0.035), fontFamily:'Georgia, serif',
                  fill:p.accent, textAlign:'center' },
                { type:'rect', left:w*0.25, top:h*0.14, width:w*0.5, height:2, fill:p.accent },
                { type:'textbox',
                  text:_t('gc_your_message','여기에 마음을 담은\n메시지를 적어주세요\n\n따뜻한 마음이\n전해지기를 바랍니다'),
                  left:w*0.08, top:h*0.2, width:w*0.84,
                  fontSize:Math.round(h*0.026), fontFamily:'Georgia, serif',
                  fill:p.text, textAlign:'center', lineHeight:1.8 },
                { type:'rect', left:w*0.25, top:h*0.7, width:w*0.5, height:2, fill:p.accent },
                { type:'textbox', text:emoji + ' ' + emoji + ' ' + emoji,
                  left:w*0.2, top:h*0.76, width:w*0.6,
                  fontSize:Math.round(h*0.025), fontFamily:'Georgia, serif',
                  fill:p.sub, textAlign:'center' }
            ];
        }
    },
    gallery: {
        name: _t('gc_tpl_gallery','갤러리'), icon: 'fa-images',
        build(w, h, cat='christmas') {
            const p = PALETTES[cat] || PALETTES.christmas;
            return [
                { type:'textbox', text:_t('gc_gallery_title','Our Moments'), left:w*0.1, top:h*0.06, width:w*0.8,
                  fontSize:Math.round(h*0.03), fontFamily:'Georgia, serif', fontWeight:'300',
                  fill:p.text, textAlign:'center' },
                { type:'rect', left:w*0.35, top:h*0.13, width:w*0.3, height:2, fill:p.accent },
                { type:'rect', left:w*0.08, top:h*0.18, width:w*0.84, height:h*0.4,
                  fill:p.light, rx:12, ry:12, stroke:p.accent, strokeWidth:1,
                  isGcPlaceholder:true, gcPlaceholderId:'gallery_main' },
                { type:'textbox', text:_t('gc_drag_photo','사진을 넣어주세요'), left:w*0.25, top:h*0.36, width:w*0.5,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:p.sub, textAlign:'center', editable:false,
                  isGcPlaceholderText:true, gcPlaceholderId:'gallery_main' },
                { type:'rect', left:w*0.08, top:h*0.62, width:w*0.4, height:h*0.25,
                  fill:p.light, rx:10, ry:10, stroke:p.accent, strokeWidth:1,
                  isGcPlaceholder:true, gcPlaceholderId:'gallery_sub1' },
                { type:'rect', left:w*0.52, top:h*0.62, width:w*0.4, height:h*0.25,
                  fill:p.light, rx:10, ry:10, stroke:p.accent, strokeWidth:1,
                  isGcPlaceholder:true, gcPlaceholderId:'gallery_sub2' }
            ];
        }
    },
    blank: {
        name: _t('gc_tpl_blank','빈 페이지'), icon: 'fa-square',
        build() { return []; }
    }
};

/* ─── State ─── */
let _gcThumbCache = [];
let _gcCategory = 'christmas';
let _gcAnimation = 'snow';
let _gcPhotos = [];

/* ═══════════════════════════════════════════
   1. INITIALIZATION
   ═══════════════════════════════════════════ */
export function initGreetingCardMode() {
    document.body.classList.add('greeting-card-mode');

    const pc = document.getElementById('pageCounter');
    if (pc) {
        const obs = new MutationObserver(() => {
            if (window.__GREETING_CARD_MODE) {
                clearTimeout(window.__gcThumbTimer);
                window.__gcThumbTimer = setTimeout(() => _renderThumbsFromCache(), 200);
            }
        });
        obs.observe(pc, { childList:true, characterData:true, subtree:true });
    }

    // Expose to window
    window.gcActivatePanel = activateSlidePanel;
    window.gcInitPages = initDefaultPages;
    window.gcDuplicateSlide = duplicateSlide;
    window.gcDeleteSlide = gcDeleteSlide;
    window.gcPreview = openGcPreview;
    window.gcClosePreview = closeGcPreview;
    window.gcApplyTemplate = applyTemplate;
    window.gcGoToSlide = gcGoToSlide;
    window.gcShowTemplates = showTemplateModal;
    window.gcHideTemplates = hideTemplateModal;
    window.renderGcThumbs = renderSlideThumbs;
    window.openGreetingCardWizard = openGcWizard;
    window.handleGcPhotos = handleGcPhotos;
    window.runGcGeneration = runGcGeneration;
    window._gcRemovePhoto = _gcRemovePhoto;
    window.gcShareCard = shareGreetingCard;
    window._gcCloseShare = _gcCloseShare;
    window._gcCopyShareUrl = _gcCopyShareUrl;
    window._gcSelectCat = _gcSelectCat;

    setupPlaceholderUpload();

    if (window.innerWidth <= 768) {
        _createMobileGcNav();
    }

    console.log('✅ Greeting Card Mode initialized');
}

/* ═══ Category selector ═══ */
function _gcSelectCat(btn) {
    document.querySelectorAll('.gc-cat-btn').forEach(b => b.classList.remove('gc-cat-active'));
    btn.classList.add('gc-cat-active');
    _gcCategory = btn.dataset.cat || 'christmas';
}

/* ═══ Mobile Navigation ═══ */
function _createMobileGcNav() {
    if (document.getElementById('gcMobileNav')) return;
    const nav = document.createElement('div');
    nav.id = 'gcMobileNav';
    nav.style.cssText = 'position:fixed; bottom:0; left:0; right:0; z-index:9500; background:#fff; border-top:2px solid #5eead4; display:flex; flex-direction:column; box-shadow:0 -4px 20px rgba(0,0,0,0.12); padding-bottom:env(safe-area-inset-bottom, 0);';
    nav.innerHTML = `
        <div style="display:flex; align-items:center; padding:6px 8px; gap:4px;">
            <button onclick="window.gcGoToSlide(Math.max(0, (window._getPageIndex?window._getPageIndex():0)-1))" style="width:40px;height:40px;border:1px solid #5eead4;border-radius:10px;background:#fff;color:#14b8a6;font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-chevron-left"></i></button>
            <div id="gcMobileSlideStrip" style="flex:1;display:flex;gap:6px;overflow-x:auto;padding:2px 0;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;"></div>
            <button onclick="window.gcGoToSlide(Math.min((window.__pageDataList||[]).length-1, (window._getPageIndex?window._getPageIndex():0)+1))" style="width:40px;height:40px;border:1px solid #5eead4;border-radius:10px;background:#fff;color:#14b8a6;font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-around; padding:4px 8px 6px; border-top:1px solid #d1fae5;">
            <button onclick="window.addPage()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#14b8a6;font-size:16px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-plus"></i><span style="font-size:9px;font-weight:700;">추가</span>
            </button>
            <button onclick="window.gcDuplicateSlide()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#14b8a6;font-size:16px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-copy"></i><span style="font-size:9px;font-weight:700;">복제</span>
            </button>
            <button onclick="window.gcShowTemplates()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#0d9488;font-size:16px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-table-cells-large"></i><span style="font-size:9px;font-weight:700;">섹션</span>
            </button>
            <button onclick="window.gcPreview()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#16a34a;font-size:16px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-eye"></i><span style="font-size:9px;font-weight:700;">미리보기</span>
            </button>
            <button onclick="window.gcShareCard()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#7c3aed;font-size:16px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-share-nodes"></i><span style="font-size:9px;font-weight:700;">공유</span>
            </button>
        </div>
    `;
    document.body.appendChild(nav);
    _updateMobileSlideStrip();
}

function _updateMobileSlideStrip() {
    const strip = document.getElementById('gcMobileSlideStrip');
    if (!strip) return;
    const pages = window.__pageDataList || pageDataList;
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;
    strip.innerHTML = '';
    for (let i = 0; i < pages.length; i++) {
        const thumb = _gcThumbCache[i] || null;
        const isActive = i === curIdx;
        const el = document.createElement('div');
        el.style.cssText = `flex-shrink:0; width:40px; height:70px; border-radius:6px; overflow:hidden; cursor:pointer; border:2px solid ${isActive?'#14b8a6':'#e2e8f0'}; background:${isActive?'#f0fdfa':'#f8fafc'}; scroll-snap-align:center;`;
        el.innerHTML = thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8;font-weight:bold;">${i+1}</div>`;
        el.onclick = () => window.gcGoToSlide(i);
        strip.appendChild(el);
    }
    const activeEl = strip.children[curIdx];
    if (activeEl) setTimeout(() => activeEl.scrollIntoView({ inline:'center', behavior:'smooth' }), 50);
}

/* ═══════════════════════════════════════════
   1-B. PLACEHOLDER CLICK-TO-UPLOAD
   ═══════════════════════════════════════════ */
let _gcUploadTarget = null;

function setupPlaceholderUpload() {
    let inp = document.getElementById('gcPlaceholderUpload');
    if (!inp) {
        inp = document.createElement('input');
        inp.id = 'gcPlaceholderUpload';
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        document.body.appendChild(inp);
    }

    inp.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file || !_gcUploadTarget) { _gcUploadTarget = null; return; }
        replacePlaceholderWithImage(file, _gcUploadTarget);
        _gcUploadTarget = null;
        inp.value = '';
    });

    const checkCanvas = setInterval(() => {
        if (!canvas) return;
        clearInterval(checkCanvas);

        canvas.on('mouse:down', function (opt) {
            if (!window.__GREETING_CARD_MODE) return;
            const target = opt.target;
            if (!target) return;
            if (target.isGcPlaceholder) {
                _gcUploadTarget = target;
                setTimeout(() => {
                    canvas.discardActiveObject();
                    canvas.requestRenderAll();
                    document.getElementById('gcPlaceholderUpload').click();
                }, 50);
                return;
            }
            if (target.isGcPlaceholderText) {
                const rect = canvas.getObjects().find(o => o.isGcPlaceholder && o.gcPlaceholderId === target.gcPlaceholderId);
                if (rect) {
                    _gcUploadTarget = rect;
                    setTimeout(() => {
                        canvas.discardActiveObject();
                        canvas.requestRenderAll();
                        document.getElementById('gcPlaceholderUpload').click();
                    }, 50);
                }
            }
        });
    }, 300);
}

function replacePlaceholderWithImage(file, placeholderRect) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const imgObj = new Image();
        imgObj.src = e.target.result;
        imgObj.onload = function () {
            const fabricImg = new fabric.Image(imgObj);
            placeholderRect.setCoords();
            const center = placeholderRect.getCenterPoint();
            const pW = placeholderRect.width * (placeholderRect.scaleX || 1);
            const pH = placeholderRect.height * (placeholderRect.scaleY || 1);
            const pRx = placeholderRect.rx || 0;
            const pRy = placeholderRect.ry || 0;
            const scale = Math.max(pW / fabricImg.width, pH / fabricImg.height);
            fabricImg.set({ scaleX:scale, scaleY:scale, left:center.x, top:center.y, originX:'center', originY:'center' });
            fabricImg.clipPath = new fabric.Rect({ width:pW, height:pH, rx:pRx, ry:pRy, left:center.x, top:center.y, originX:'center', originY:'center', absolutePositioned:true });
            const phId = placeholderRect.gcPlaceholderId;
            const textLabel = canvas.getObjects().find(o => o.isGcPlaceholderText && o.gcPlaceholderId === phId);
            canvas.remove(placeholderRect);
            if (textLabel) canvas.remove(textLabel);
            canvas.add(fabricImg);
            canvas.bringToFront(fabricImg);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
        };
    };
    reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════════
   2. DEFAULT PAGES
   ═══════════════════════════════════════════ */
let _gcInitCancelled = false;

function initDefaultPages() {
    if (!window.__GREETING_CARD_MODE || !canvas) return;
    if (_gcInitCancelled) return;
    if (pageDataList.length > 1) return;

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const p = PALETTES[_gcCategory] || PALETTES.christmas;
    board.set({ fill: p.bg });
    canvas.requestRenderAll();

    applyTemplateToCanvas('cover');

    if (window.addPage) window.addPage();
    setTimeout(() => {
        if (_gcInitCancelled) return;
        const b2 = canvas.getObjects().find(o => o.isBoard);
        if (b2) b2.set({ fill: p.bg });
        applyTemplateToCanvas('message');

        setTimeout(() => {
            if (_gcInitCancelled) return;
            goToPage(0);
            setTimeout(() => {
                renderSlideThumbs();
                _mobileFitScreen();
            }, 400);
        }, 200);
    }, 300);
}

/* ═══ Mobile fit screen ═══ */
function _mobileFitScreen() {
    if (window.innerWidth > 768 || !canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const cW = canvas.width, cH = canvas.height;
    const padTop = 20, padBot = 130, padSide = 20;
    const availW = cW - padSide * 2;
    const availH = cH - padTop - padBot;
    const bW = board.width * (board.scaleX || 1);
    const bH = board.height * (board.scaleY || 1);
    const zoom = Math.min(availW / bW, availH / bH, 1.5);
    canvas.setZoom(zoom);
    const vpt = canvas.viewportTransform;
    vpt[4] = (cW - bW * zoom) / 2;
    vpt[5] = (padTop + (availH - bH * zoom) / 2);
    canvas.requestRenderAll();
}

/* ═══════════════════════════════════════════
   3. SLIDE PANEL
   ═══════════════════════════════════════════ */
function activateSlidePanel() {
    const pageBtn = document.querySelector('#iconBar .icon-item[data-panel="sub-page"]');
    if (pageBtn) pageBtn.click();

    setTimeout(() => {
        const subPage = document.getElementById('sub-page');
        if (!subPage) return;
        subPage.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:0 2px 10px; border-bottom:1px solid #5eead4; margin-bottom:10px;">
                <span style="font-weight:800; font-size:14px; color:#1e293b;"><i class="fa-solid fa-envelope-open-text" style="color:#14b8a6; margin-right:4px;"></i>${_t('gc_pages','페이지')}</span>
                <div style="display:flex; gap:4px;">
                    <button onclick="window.addPage()" title="${_t('gc_add_page','페이지 추가')}" style="width:30px; height:30px; border:1px solid #5eead4; border-radius:6px; background:#fff; cursor:pointer; font-size:13px; color:#14b8a6;"><i class="fa-solid fa-plus"></i></button>
                    <button onclick="window.gcDuplicateSlide()" title="${_t('gc_duplicate','복제')}" style="width:30px; height:30px; border:1px solid #5eead4; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#14b8a6;"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="window.gcShowTemplates()" title="${_t('gc_templates','섹션 템플릿')}" style="width:30px; height:30px; border:1px solid #5eead4; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#0d9488;"><i class="fa-solid fa-table-cells-large"></i></button>
                    <button onclick="window.gcPreview()" title="${_t('gc_preview','미리보기')}" style="width:30px; height:30px; border:1px solid #5eead4; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#14b8a6;"><i class="fa-solid fa-eye"></i></button>
                </div>
            </div>
            <div id="gcSlideList" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; max-height:calc(100vh - 320px);"></div>
        `;
        renderSlideThumbs();
    }, 100);
}

/* ═══════════════════════════════════════════
   4. THUMBNAILS
   ═══════════════════════════════════════════ */
function _withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);
}

async function _captureAllPages(scale) {
    const c = canvas || window.canvas;
    if (!c) return [];
    if (window.savePageState) window.savePageState();
    const origVpt = c.viewportTransform.slice();
    const origW = c.getWidth(), origH = c.getHeight();
    const results = [];
    for (let i = 0; i < pageDataList.length; i++) {
        try {
            goToPage(i);
            await new Promise(r => setTimeout(r, 150));
            const board = c.getObjects().find(o => o.isBoard);
            if (!board) { results.push(null); continue; }
            c.setViewportTransform([1, 0, 0, 1, -board.left, -board.top]);
            c.setDimensions({ width: board.width * (board.scaleX||1), height: board.height * (board.scaleY||1) });
            c.requestRenderAll();
            await new Promise(r => setTimeout(r, 100));
            const url = c.toDataURL({ format:'jpeg', quality:0.7, multiplier:scale, enableRetinaScaling:false });
            results.push(url);
        } catch(e) { results.push(null); }
    }
    goToPage(window._getPageIndex ? window._getPageIndex() : 0);
    c.setViewportTransform(origVpt);
    c.setDimensions({ width:origW, height:origH });
    c.requestRenderAll();
    return results;
}

async function renderSlideThumbs() {
    if (!window.__GREETING_CARD_MODE) return;
    if (window.savePageState) window.savePageState();
    const thumbs = await _captureAllPages(0.2);
    _gcThumbCache = thumbs;
    _renderThumbsFromCache();
}

function _renderThumbsFromCache() {
    const container = document.getElementById('gcSlideList');
    if (!container) return;
    const pages = window.__pageDataList || pageDataList;
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;

    container.innerHTML = '';
    for (let i = 0; i < pages.length; i++) {
        const thumbUrl = _gcThumbCache[i] || null;
        const isActive = i === curIdx;

        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding:6px; border-radius:8px; cursor:pointer; border:2px solid ' + (isActive ? '#14b8a6' : 'transparent') + '; background:' + (isActive ? '#f0fdfa' : 'transparent') + '; transition:all 0.15s; position:relative;';
        div.onclick = () => gcGoToSlide(i);
        div.onmouseenter = () => { const a = div.querySelector('.gc-sl-act'); if(a) a.style.display='flex'; };
        div.onmouseleave = () => { const a = div.querySelector('.gc-sl-act'); if(a) a.style.display='none'; };

        div.innerHTML = `
            <span style="font-size:11px; font-weight:700; color:${isActive?'#14b8a6':'#94a3b8'}; min-width:18px; text-align:center; padding-top:4px;">${i+1}</span>
            <div style="flex:1; border-radius:4px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); aspect-ratio:9/16; background:#f0fdfa;">
                ${thumbUrl ? '<img src="'+thumbUrl+'" style="width:100%; height:100%; object-fit:cover; display:block;" draggable="false">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#14b8a6;font-size:11px;">'+(i+1)+'</div>'}
            </div>
            <div class="gc-sl-act" style="display:none; position:absolute; top:4px; right:4px; gap:2px;">
                <button onclick="event.stopPropagation(); window.gcDuplicateSlide(${i})" title="${_t('gc_duplicate','복제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-copy"></i></button>
                <button onclick="event.stopPropagation(); window.gcDeleteSlide(${i})" title="${_t('gc_delete','삭제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(239,68,68,0.8); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;" ${pages.length<=1?'disabled':''}><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    }

    const activeEl = container.querySelector('[style*="border:2px solid #14b8a6"]');
    if (activeEl) activeEl.scrollIntoView({ block:'nearest', behavior:'smooth' });
    _updateMobileSlideStrip();
}

/* ═══════════════════════════════════════════
   5. NAVIGATION
   ═══════════════════════════════════════════ */
function gcGoToSlide(index) {
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;
    if (index === curIdx) return;
    if (window.savePageState) window.savePageState();
    goToPage(index);
    setTimeout(() => {
        _renderThumbsFromCache();
        _mobileFitScreen();
    }, 400);
}

/* ═══════════════════════════════════════════
   6. DUPLICATE / DELETE
   ═══════════════════════════════════════════ */
function duplicateSlide(index) {
    if (window.savePageState) window.savePageState();
    const srcIdx = (typeof index === 'number') ? index : currentPageIndex;
    if (!pageDataList[srcIdx]) return;
    const cloned = JSON.parse(JSON.stringify(pageDataList[srcIdx]));
    pageDataList.splice(srcIdx + 1, 0, cloned);
    goToPage(srcIdx + 1);
    setTimeout(() => renderSlideThumbs(), 300);
}

function gcDeleteSlide(index) {
    if (pageDataList.length <= 1) return;
    if (!confirm(_t('gc_delete_confirm','이 페이지를 삭제하시겠습니까?'))) return;
    pageDataList.splice(index, 1);
    const newIdx = Math.min(index, pageDataList.length - 1);
    goToPage(newIdx);
    setTimeout(() => renderSlideThumbs(), 300);
}

/* ═══════════════════════════════════════════
   7. SECTION TEMPLATES
   ═══════════════════════════════════════════ */
function showTemplateModal() {
    const modal = document.getElementById('gcTemplateModal');
    if (!modal) return;

    const grid = document.getElementById('gcTemplateGrid');
    if (grid) {
        grid.innerHTML = '';
        Object.entries(CARD_TEMPLATES).forEach(([key, tpl]) => {
            const card = document.createElement('div');
            card.style.cssText = 'border:2px solid #e2e8f0; border-radius:12px; padding:16px 8px; text-align:center; cursor:pointer; transition:all 0.15s; background:#fff;';
            card.onmouseenter = () => { card.style.borderColor='#14b8a6'; card.style.background='#f0fdfa'; };
            card.onmouseleave = () => { card.style.borderColor='#e2e8f0'; card.style.background='#fff'; };
            card.innerHTML = `<i class="fa-solid ${tpl.icon}" style="font-size:24px; color:#14b8a6; margin-bottom:6px; display:block;"></i><div style="font-size:12px; font-weight:700; color:#334155;">${tpl.name}</div>`;
            card.onclick = () => { applyTemplate(key); hideTemplateModal(); };
            grid.appendChild(card);
        });
    }
    modal.style.display = 'flex';
}

function hideTemplateModal() {
    const modal = document.getElementById('gcTemplateModal');
    if (modal) modal.style.display = 'none';
}

function applyTemplate(templateKey) {
    applyTemplateToCanvas(templateKey);
    setTimeout(() => renderSlideThumbs(), 300);
}

function applyTemplateToCanvas(templateKey) {
    const tpl = CARD_TEMPLATES[templateKey];
    if (!tpl) return;

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const bw = board.width * (board.scaleX || 1);
    const bh = board.height * (board.scaleY || 1);
    const bx = board.left || 0;
    const by = board.top || 0;

    // Remove non-board objects
    canvas.getObjects().filter(o => !o.isBoard && !o.isMockup && !o.isGuide).forEach(o => canvas.remove(o));

    const items = tpl.build(bw, bh, _gcCategory);
    items.forEach(cfg => {
        cfg.left = (cfg.left || 0) + bx;
        cfg.top = (cfg.top || 0) + by;
        let obj;
        if (cfg.type === 'textbox') {
            obj = new fabric.Textbox(cfg.text || '', cfg);
        } else if (cfg.type === 'rect') {
            obj = new fabric.Rect(cfg);
        } else if (cfg.type === 'line') {
            obj = new fabric.Line([cfg.x1||0, cfg.y1||0, cfg.x2||0, cfg.y2||0], cfg);
        }
        if (obj) {
            CUSTOM_PROPS.forEach(p => { if (cfg[p] !== undefined) obj.set(p, cfg[p]); });
            canvas.add(obj);
        }
    });
    canvas.requestRenderAll();
}

/* ═══════════════════════════════════════════
   8. PREVIEW
   ═══════════════════════════════════════════ */
async function openGcPreview() {
    const overlay = document.getElementById('gcPreviewOverlay');
    if (!overlay) return;

    const p = PALETTES[_gcCategory] || PALETTES.christmas;
    overlay.style.background = `linear-gradient(135deg, ${p.bg}, ${p.light})`;
    overlay.style.display = 'flex';

    const scroll = document.getElementById('gcPreviewScroll');
    scroll.innerHTML = '<div style="text-align:center; padding:40px; color:#fff; font-size:14px;"><i class="fa-solid fa-spinner fa-spin"></i> 미리보기 생성 중...</div>';

    if (window.savePageState) window.savePageState();
    const thumbs = await _captureAllPages(0.8);

    scroll.innerHTML = '';
    thumbs.forEach((url, i) => {
        if (!url) return;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'text-align:center; margin-bottom:16px; position:relative;';
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'max-width:380px; width:90%; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.2);';
        wrap.appendChild(img);
        scroll.appendChild(wrap);
    });

    const counter = document.getElementById('gcPreviewCounter');
    if (counter) counter.textContent = `${thumbs.filter(Boolean).length} pages`;
}

function closeGcPreview() {
    const overlay = document.getElementById('gcPreviewOverlay');
    if (overlay) overlay.style.display = 'none';
}

/* ═══════════════════════════════════════════
   9. WIZARD
   ═══════════════════════════════════════════ */
function openGcWizard() {
    // If already in editor, show wizard modal
    if (window.__GREETING_CARD_MODE) {
        const modal = document.getElementById('gcWizardModal');
        if (modal) modal.style.display = 'flex';
        return;
    }
    // Otherwise open editor first, then wizard
    const modal = document.getElementById('gcWizardModal');
    if (modal) modal.style.display = 'flex';
}

function handleGcPhotos(files) {
    if (!files || !files.length) return;
    const grid = document.getElementById('gcPhotoGrid');
    if (!grid) return;
    for (let i = 0; i < files.length && _gcPhotos.length < 5; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = (e) => {
            _gcPhotos.push(e.target.result);
            _renderPhotoGrid();
        };
        reader.readAsDataURL(file);
    }
}

function _gcRemovePhoto(idx) {
    _gcPhotos.splice(idx, 1);
    _renderPhotoGrid();
}

function _renderPhotoGrid() {
    const grid = document.getElementById('gcPhotoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    _gcPhotos.forEach((src, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'position:relative; border-radius:8px; overflow:hidden; aspect-ratio:1;';
        div.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;"><button onclick="window._gcRemovePhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark"></i></button>`;
        grid.appendChild(div);
    });
}

async function runGcGeneration() {
    const progress = document.getElementById('gcWizardProgress');
    const btn = document.getElementById('btnGcGenerate');
    if (progress) progress.style.display = 'block';
    if (btn) btn.style.display = 'none';

    const catBtn = document.querySelector('.gc-cat-btn.gc-cat-active');
    _gcCategory = catBtn ? catBtn.dataset.cat : 'christmas';

    const animBtn = document.querySelector('.gc-anim-btn.gc-anim-active');
    _gcAnimation = animBtn ? animBtn.dataset.anim : 'snow';

    const fromName = document.getElementById('gcFromName')?.value || '';
    const toName = document.getElementById('gcToName')?.value || '';
    const message = document.getElementById('gcMessage')?.value || '';

    // Close wizard
    const modal = document.getElementById('gcWizardModal');

    // If not in editor yet, open editor first
    if (!window.__GREETING_CARD_MODE) {
        if (modal) modal.style.display = 'none';
        if (window.dsmOpenEditor) {
            await window.dsmOpenEditor(286, 508, '인사말카드');
        }
        // Wait for editor to be ready
        await new Promise(r => setTimeout(r, 1500));
    }

    // Now apply templates with user data
    const p = PALETTES[_gcCategory] || PALETTES.christmas;
    const g = CATEGORY_GREETINGS[_gcCategory] || CATEGORY_GREETINGS.christmas;
    const emoji = CATEGORY_EMOJIS[_gcCategory] || '✨';

    // Store selection for sharing
    window.__gcSelection = { category: _gcCategory, animation: _gcAnimation, fromName, toName, message };

    // Set board background
    const board = canvas.getObjects().find(o => o.isBoard);
    if (board) board.set({ fill: p.bg });

    // Clear and build cover page
    canvas.getObjects().filter(o => !o.isBoard && !o.isMockup && !o.isGuide).forEach(o => canvas.remove(o));
    const bw = board.width * (board.scaleX || 1);
    const bh = board.height * (board.scaleY || 1);
    const bx = board.left || 0;
    const by = board.top || 0;

    // Custom cover with user data
    const coverItems = [
        { type:'textbox', text:emoji, left:bw*0.35+bx, top:bh*0.06+by, width:bw*0.3,
          fontSize:Math.round(bh*0.07), fontFamily:'Georgia, serif', fill:p.accent, textAlign:'center' },
        { type:'textbox', text:g.title, left:bw*0.05+bx, top:bh*0.17+by, width:bw*0.9,
          fontSize:Math.round(bh*0.05), fontFamily:'Georgia, serif', fontWeight:'bold', fill:p.text, textAlign:'center' }
    ];

    if (_gcPhotos.length > 0) {
        // Will add photo after loading
    } else {
        coverItems.push(
            { type:'rect', left:bw*0.1+bx, top:bh*0.28+by, width:bw*0.8, height:bh*0.35,
              fill:p.light, rx:16, ry:16, stroke:p.accent, strokeWidth:2,
              isGcPlaceholder:true, gcPlaceholderId:'cover_main' },
            { type:'textbox', text:_t('gc_photo_here','사진을 넣어주세요'), left:bw*0.2+bx, top:bh*0.43+by, width:bw*0.6,
              fontSize:Math.round(bh*0.022), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center', editable:false,
              isGcPlaceholderText:true, gcPlaceholderId:'cover_main' }
        );
    }

    coverItems.push(
        { type:'textbox', text: toName ? `To. ${toName}` : g.sub, left:bw*0.1+bx, top:bh*0.7+by, width:bw*0.8,
          fontSize:Math.round(bh*0.03), fontFamily:'Georgia, serif', fill:p.text, textAlign:'center' },
        { type:'rect', left:bw*0.3+bx, top:bh*0.8+by, width:bw*0.4, height:2, fill:p.accent },
        { type:'textbox', text: fromName ? `From. ${fromName}` : 'From. ___', left:bw*0.15+bx, top:bh*0.85+by, width:bw*0.7,
          fontSize:Math.round(bh*0.024), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center' }
    );

    coverItems.forEach(cfg => {
        let obj;
        if (cfg.type === 'textbox') obj = new fabric.Textbox(cfg.text || '', cfg);
        else if (cfg.type === 'rect') obj = new fabric.Rect(cfg);
        if (obj) {
            CUSTOM_PROPS.forEach(pr => { if (cfg[pr] !== undefined) obj.set(pr, cfg[pr]); });
            canvas.add(obj);
        }
    });

    // Add photo to cover if available
    if (_gcPhotos.length > 0) {
        await _addPhotoToCanvas(_gcPhotos[0], bw*0.1+bx, bh*0.28+by, bw*0.8, bh*0.35, 16);
    }

    canvas.requestRenderAll();

    // Add message page
    if (window.addPage) window.addPage();
    await new Promise(r => setTimeout(r, 400));
    const b2 = canvas.getObjects().find(o => o.isBoard);
    if (b2) b2.set({ fill: p.bg });
    canvas.getObjects().filter(o => !o.isBoard && !o.isMockup && !o.isGuide).forEach(o => canvas.remove(o));

    const msgText = message || _t('gc_default_message','따뜻한 마음을 전합니다\n\n행복한 시간 되세요');
    const msgItems = [
        { type:'textbox', text:emoji, left:bw*0.42+bx, top:bh*0.06+by, width:bw*0.16,
          fontSize:Math.round(bh*0.04), fontFamily:'Georgia, serif', fill:p.accent, textAlign:'center' },
        { type:'rect', left:bw*0.25+bx, top:bh*0.14+by, width:bw*0.5, height:2, fill:p.accent },
        { type:'textbox', text:msgText, left:bw*0.08+bx, top:bh*0.2+by, width:bw*0.84,
          fontSize:Math.round(bh*0.028), fontFamily:'Georgia, serif', fill:p.text, textAlign:'center', lineHeight:1.8 },
        { type:'rect', left:bw*0.25+bx, top:bh*0.75+by, width:bw*0.5, height:2, fill:p.accent },
        { type:'textbox', text:`${emoji} ${emoji} ${emoji}`, left:bw*0.2+bx, top:bh*0.8+by, width:bw*0.6,
          fontSize:Math.round(bh*0.03), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center' }
    ];
    msgItems.forEach(cfg => {
        let obj;
        if (cfg.type === 'textbox') obj = new fabric.Textbox(cfg.text || '', cfg);
        else if (cfg.type === 'rect') obj = new fabric.Rect(cfg);
        if (obj) canvas.add(obj);
    });
    canvas.requestRenderAll();

    // Add gallery page if we have multiple photos
    if (_gcPhotos.length > 1) {
        if (window.addPage) window.addPage();
        await new Promise(r => setTimeout(r, 400));
        const b3 = canvas.getObjects().find(o => o.isBoard);
        if (b3) b3.set({ fill: p.bg });
        applyTemplateToCanvas('gallery');
    }

    // Go back to page 0
    goToPage(0);
    setTimeout(() => renderSlideThumbs(), 500);

    if (modal) modal.style.display = 'none';
    if (progress) progress.style.display = 'none';
    if (btn) btn.style.display = 'block';
}

function _addPhotoToCanvas(dataUrl, x, y, w, h, r) {
    return new Promise(resolve => {
        const imgObj = new Image();
        imgObj.src = dataUrl;
        imgObj.onload = () => {
            const fabricImg = new fabric.Image(imgObj);
            const scale = Math.max(w / fabricImg.width, h / fabricImg.height);
            fabricImg.set({ scaleX:scale, scaleY:scale, left:x+w/2, top:y+h/2, originX:'center', originY:'center' });
            fabricImg.clipPath = new fabric.Rect({ width:w, height:h, rx:r, ry:r, left:x+w/2, top:y+h/2, originX:'center', originY:'center', absolutePositioned:true });
            canvas.add(fabricImg);
            canvas.requestRenderAll();
            resolve();
        };
        imgObj.onerror = () => resolve();
    });
}

/* ═══════════════════════════════════════════
   10. SHARE
   ═══════════════════════════════════════════ */
async function shareGreetingCard() {
    const dialog = document.getElementById('gcShareDialog');
    if (!dialog) return;
    dialog.style.display = 'flex';

    const progress = document.getElementById('gcShareProgress');
    const result = document.getElementById('gcShareResult');
    if (progress) progress.style.display = 'block';
    if (result) result.style.display = 'none';

    try {
        if (window.savePageState) window.savePageState();
        const images = await _captureAllPages(1.0);
        const slug = 'gc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

        const sb = window.sb || (await import('./config.js?v=123')).sb;
        if (!sb) throw new Error('Supabase not available');

        // Upload each page image
        const imageUrls = [];
        for (let i = 0; i < images.length; i++) {
            if (!images[i]) continue;
            const blob = await (await fetch(images[i])).blob();
            const path = `greeting-card/${slug}/page_${i}.jpg`;
            const { error } = await sb.storage.from('public-assets').upload(path, blob, { contentType:'image/jpeg', upsert:true });
            if (!error) {
                const { data } = sb.storage.from('public-assets').getPublicUrl(path);
                imageUrls.push(data.publicUrl);
            }
        }

        // Upload meta
        const meta = {
            slug,
            category: _gcCategory,
            animation: _gcAnimation,
            fromName: window.__gcSelection?.fromName || '',
            toName: window.__gcSelection?.toName || '',
            message: window.__gcSelection?.message || '',
            pages: imageUrls,
            createdAt: new Date().toISOString()
        };
        const metaBlob = new Blob([JSON.stringify(meta)], { type:'application/json' });
        await sb.storage.from('public-assets').upload(`greeting-card/${slug}/meta.json`, metaBlob, { contentType:'application/json', upsert:true });

        const shareUrl = `${window.location.origin}/gc.html?id=${slug}`;
        const urlInput = document.getElementById('gcShareUrl');
        if (urlInput) urlInput.value = shareUrl;
        if (progress) progress.style.display = 'none';
        if (result) result.style.display = 'block';
    } catch(e) {
        console.error('Share error:', e);
        if (progress) progress.innerHTML = `<p style="color:#ef4444; font-size:14px;">공유 중 오류가 발생했습니다: ${e.message}</p>`;
    }
}

function _gcCloseShare() {
    const dialog = document.getElementById('gcShareDialog');
    if (dialog) dialog.style.display = 'none';
}

function _gcCopyShareUrl() {
    const input = document.getElementById('gcShareUrl');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        const msg = document.getElementById('gcShareCopiedMsg');
        if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 2000); }
    });
}
