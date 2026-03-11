/* ═══ Greeting Card Mode v2 — Single Page + Animated Stickers ═══ */
import { canvas } from "./canvas-core.js?v=147";

const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

/* ─── Custom properties for fabric serialization ─── */
const CUSTOM_PROPS = ['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst','isGcPlaceholder','isGcPlaceholderText','gcPlaceholderId','isAnimSticker','animStickerType'];

/* ─── Category Palettes ─── */
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

/* ─── Animated Sticker Definitions ─── */
const ANIM_STICKERS = [
    { id:'fireworks',  emoji:'🎆', name:'폭죽',       nameKey:'gc_stk_fireworks' },
    { id:'hearts',     emoji:'💕', name:'하트뿜뿜',   nameKey:'gc_stk_hearts' },
    { id:'snow',       emoji:'❄️', name:'눈내림',     nameKey:'gc_stk_snow' },
    { id:'confetti',   emoji:'🎊', name:'색종이',     nameKey:'gc_stk_confetti' },
    { id:'sparkle',    emoji:'✨', name:'반짝이',     nameKey:'gc_stk_sparkle' },
    { id:'bow',        emoji:'🙇', name:'세배',       nameKey:'gc_stk_bow' },
    { id:'balloon',    emoji:'🎈', name:'풍선',       nameKey:'gc_stk_balloon' },
    { id:'flower',     emoji:'🌸', name:'꽃날림',     nameKey:'gc_stk_flower' },
    { id:'star',       emoji:'⭐', name:'별빛',       nameKey:'gc_stk_star' },
    { id:'fire',       emoji:'🔥', name:'불꽃',       nameKey:'gc_stk_fire' },
    { id:'rainbow',    emoji:'🌈', name:'무지개',     nameKey:'gc_stk_rainbow' },
    { id:'lightning',  emoji:'⚡', name:'번개',       nameKey:'gc_stk_lightning' },
    { id:'bubbles',    emoji:'🫧', name:'버블',       nameKey:'gc_stk_bubbles' },
    { id:'shooting_star', emoji:'🌠', name:'별똥별',  nameKey:'gc_stk_shooting_star' },
    { id:'party',      emoji:'🥳', name:'파티',       nameKey:'gc_stk_party' },
    { id:'clap',       emoji:'👏', name:'박수',       nameKey:'gc_stk_clap' },
    { id:'money',      emoji:'💰', name:'돈뿌리기',   nameKey:'gc_stk_money' },
    { id:'butterfly',  emoji:'🦋', name:'나비',       nameKey:'gc_stk_butterfly' },
    { id:'rocket',     emoji:'🚀', name:'로켓',       nameKey:'gc_stk_rocket' },
    { id:'love_letter',emoji:'💌', name:'러브레터',   nameKey:'gc_stk_love_letter' },
    { id:'cherry_blossom', emoji:'🌸', name:'벚꽃비', nameKey:'gc_stk_cherry_blossom' },
    { id:'galaxy',     emoji:'🌌', name:'은하수',     nameKey:'gc_stk_galaxy' },
    { id:'aurora',     emoji:'🏔️', name:'오로라',    nameKey:'gc_stk_aurora' },
    { id:'wave',       emoji:'🌊', name:'파도',       nameKey:'gc_stk_wave' },
    { id:'leaves',     emoji:'🍂', name:'낙엽',       nameKey:'gc_stk_leaves' },
    { id:'spotlight',  emoji:'🔦', name:'스포트라이트', nameKey:'gc_stk_spotlight' },
    { id:'neon',       emoji:'💡', name:'네온사인',   nameKey:'gc_stk_neon' },
    { id:'rose_petals',emoji:'🌹', name:'장미꽃잎',   nameKey:'gc_stk_rose_petals' },
    { id:'music_notes',emoji:'🎵', name:'음표',       nameKey:'gc_stk_music_notes' },
    { id:'glitter',    emoji:'💎', name:'글리터',     nameKey:'gc_stk_glitter' },
    { id:'fairy_dust', emoji:'🧚', name:'요정먼지',   nameKey:'gc_stk_fairy_dust' },
    { id:'firefly',    emoji:'✨', name:'반딧불',     nameKey:'gc_stk_firefly' },
    { id:'ribbon',     emoji:'🎀', name:'리본',       nameKey:'gc_stk_ribbon' },
    { id:'champagne',  emoji:'🍾', name:'샴페인',     nameKey:'gc_stk_champagne' },
    { id:'snowman',    emoji:'⛄', name:'눈사람',     nameKey:'gc_stk_snowman' },
    { id:'gift',       emoji:'🎁', name:'선물',       nameKey:'gc_stk_gift' },
    { id:'dove',       emoji:'🕊️', name:'비둘기',    nameKey:'gc_stk_dove' },
    { id:'rain',       emoji:'🌧️', name:'비',        nameKey:'gc_stk_rain' },
    { id:'tornado',    emoji:'🌪️', name:'회오리',    nameKey:'gc_stk_tornado' },
    { id:'crown',      emoji:'👑', name:'왕관',       nameKey:'gc_stk_crown' },
];

/* ─── State ─── */
let _gcCategory = 'christmas';
let _gcPhotos = [];

/* ═══════════════════════════════════════════
   1. INITIALIZATION
   ═══════════════════════════════════════════ */
export function initGreetingCardMode() {
    document.body.classList.add('greeting-card-mode');

    // Expose to window
    window.gcInitPages = initSinglePage;
    window.gcPreview = openGcPreview;
    window.gcClosePreview = closeGcPreview;
    window.gcShareCard = shareGreetingCard;
    window._gcCloseShare = _gcCloseShare;
    window._gcCopyShareUrl = _gcCopyShareUrl;
    window._gcSelectCat = _gcSelectCat;
    window.openGreetingCardWizard = openGcWizard;
    window.handleGcPhotos = handleGcPhotos;
    window.runGcGeneration = runGcGeneration;
    window._gcRemovePhoto = _gcRemovePhoto;
    window.gcAddSticker = addAnimSticker;
    window.gcShowStickerPanel = showStickerPanel;
    window.gcActivatePanel = activateStickerPanel;
    window.gcDownloadGif = downloadCardAsGif;

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
        <div style="display:flex; align-items:center; justify-content:space-around; padding:8px 8px 10px; border-top:1px solid #d1fae5;">
            <button onclick="window.gcShowStickerPanel()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#14b8a6;font-size:18px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-wand-magic-sparkles"></i><span style="font-size:9px;font-weight:700;">효과</span>
            </button>
            <button onclick="window.gcPreview()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#16a34a;font-size:18px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-eye"></i><span style="font-size:9px;font-weight:700;">미리보기</span>
            </button>
            <button onclick="window.gcShareCard()" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#7c3aed;font-size:18px;cursor:pointer;padding:4px 10px;">
                <i class="fa-solid fa-share-nodes"></i><span style="font-size:9px;font-weight:700;">공유</span>
            </button>
        </div>
    `;
    document.body.appendChild(nav);
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
   2. SINGLE PAGE INIT (blank canvas)
   ═══════════════════════════════════════════ */
function initSinglePage() {
    // No default template — start with blank canvas
    if (!window.__GREETING_CARD_MODE || !canvas) return;
    setTimeout(() => _mobileFitScreen(), 400);
}

function _applyDefaultCover() {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const p = PALETTES[_gcCategory] || PALETTES.christmas;
    const g = CATEGORY_GREETINGS[_gcCategory] || CATEGORY_GREETINGS.christmas;
    const emoji = CATEGORY_EMOJIS[_gcCategory] || '✨';
    const bw = board.width * (board.scaleX || 1);
    const bh = board.height * (board.scaleY || 1);
    const bx = board.left || 0;
    const by = board.top || 0;

    // Remove non-board objects
    canvas.getObjects().filter(o => !o.isBoard && !o.isMockup && !o.isGuide).forEach(o => canvas.remove(o));

    const items = [
        { type:'textbox', text:emoji, left:bw*0.35, top:bh*0.06, width:bw*0.3,
          fontSize:Math.round(bh*0.07), fontFamily:'Georgia, serif', fill:p.accent, textAlign:'center' },
        { type:'textbox', text:g.title, left:bw*0.05, top:bh*0.17, width:bw*0.9,
          fontSize:Math.round(bh*0.05), fontFamily:'Georgia, serif', fontWeight:'bold', fill:p.text, textAlign:'center' },
        { type:'rect', left:bw*0.1, top:bh*0.28, width:bw*0.8, height:bh*0.35,
          fill:p.light, rx:16, ry:16, stroke:p.accent, strokeWidth:2,
          isGcPlaceholder:true, gcPlaceholderId:'cover_main' },
        { type:'textbox', text:_t('gc_photo_here','사진을 넣어주세요'), left:bw*0.2, top:bh*0.43, width:bw*0.6,
          fontSize:Math.round(bh*0.022), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center', editable:false,
          isGcPlaceholderText:true, gcPlaceholderId:'cover_main' },
        { type:'textbox', text:g.sub, left:bw*0.1, top:bh*0.7, width:bw*0.8,
          fontSize:Math.round(bh*0.03), fontFamily:'Georgia, serif', fill:p.text, textAlign:'center' },
        { type:'rect', left:bw*0.3, top:bh*0.8, width:bw*0.4, height:2, fill:p.accent },
        { type:'textbox', text:'From. ___', left:bw*0.15, top:bh*0.85, width:bw*0.7,
          fontSize:Math.round(bh*0.024), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center' }
    ];

    items.forEach(cfg => {
        cfg.left = (cfg.left || 0) + bx;
        cfg.top = (cfg.top || 0) + by;
        let obj;
        if (cfg.type === 'textbox') obj = new fabric.Textbox(cfg.text || '', cfg);
        else if (cfg.type === 'rect') obj = new fabric.Rect(cfg);
        if (obj) {
            CUSTOM_PROPS.forEach(pr => { if (cfg[pr] !== undefined) obj.set(pr, cfg[pr]); });
            canvas.add(obj);
        }
    });
}

/* ═══ Mobile fit screen ═══ */
function _mobileFitScreen() {
    if (window.innerWidth > 768 || !canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const cW = canvas.width, cH = canvas.height;
    const padTop = 20, padBot = 80, padSide = 20;
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
   3. ANIMATED STICKER PANEL
   ═══════════════════════════════════════════ */
function activateStickerPanel() {
    // Populate the gcEffectGrid in the sub-gceffect panel
    const grid = document.getElementById('gcEffectGrid');
    if (!grid) return;
    grid.innerHTML = ''; // always rebuild
    ANIM_STICKERS.forEach(stk => {
        const card = document.createElement('div');
        card.style.cssText = 'border:2px solid #e2e8f0; border-radius:10px; padding:8px 4px; text-align:center; cursor:pointer; transition:all 0.15s; background:#fff;';
        card.onmouseenter = () => { card.style.borderColor='#14b8a6'; card.style.background='#f0fdfa'; };
        card.onmouseleave = () => { card.style.borderColor='#e2e8f0'; card.style.background='#fff'; };
        card.innerHTML = `<div style="font-size:22px; margin-bottom:2px;">${stk.emoji}</div><div style="font-size:9px; font-weight:700; color:#334155;">${_t(stk.nameKey, stk.name)}</div>`;
        card.onclick = () => addAnimSticker(stk.id);
        grid.appendChild(card);
    });

    // Auto-open the effect panel
    setTimeout(() => {
        const effBtn = document.querySelector('.icon-item[data-panel="sub-gceffect"]');
        if (effBtn) effBtn.click();
    }, 100);
}

function showStickerPanel() {
    // Open the effect panel tab
    const effBtn = document.querySelector('.icon-item[data-panel="sub-gceffect"]');
    if (effBtn) {
        effBtn.click();
        return;
    }
    // Fallback for mobile: open as bottom sheet
    let panel = document.getElementById('gcStickerSheet');
    if (panel) { panel.style.display = 'flex'; return; }
    panel = document.createElement('div');
    panel.id = 'gcStickerSheet';
    panel.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.4); display:flex; align-items:flex-end; justify-content:center;';
    panel.onclick = (e) => { if (e.target === panel) panel.style.display = 'none'; };
    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:#fff; border-radius:20px 20px 0 0; width:100%; max-width:500px; max-height:60vh; overflow-y:auto; padding:20px; padding-bottom:calc(20px + env(safe-area-inset-bottom, 0));';
    sheet.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;"><span style="font-size:16px;font-weight:800;color:#0f766e;"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px;color:#14b8a6;"></i>${_t('gc_sticker_title','애니메이션 효과')}</span><button onclick="document.getElementById('gcStickerSheet').style.display='none'" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button></div>`;
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(5, 1fr); gap:10px;';
    ANIM_STICKERS.forEach(stk => {
        const btn = document.createElement('button');
        btn.style.cssText = 'border:2px solid #e2e8f0;border-radius:14px;padding:12px 4px;text-align:center;cursor:pointer;background:#fff;transition:all 0.15s;';
        btn.innerHTML = `<div style="font-size:28px;margin-bottom:4px;">${stk.emoji}</div><div style="font-size:10px;font-weight:700;color:#334155;">${_t(stk.nameKey, stk.name)}</div>`;
        btn.onclick = () => { addAnimSticker(stk.id); panel.style.display = 'none'; };
        grid.appendChild(btn);
    });
    sheet.appendChild(grid);
    panel.appendChild(sheet);
    document.body.appendChild(panel);
}

/* ═══════════════════════════════════════════
   4. ADD ANIMATED STICKER TO CANVAS
   ═══════════════════════════════════════════ */
function addAnimSticker(stickerType) {
    if (!canvas) return;
    const stkDef = ANIM_STICKERS.find(s => s.id === stickerType);
    if (!stkDef) return;

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const bw = board.width * (board.scaleX || 1);
    const bh = board.height * (board.scaleY || 1);
    const bx = board.left || 0;
    const by = board.top || 0;

    const size = Math.min(bw, bh) * 0.18;

    // Create the sticker as a group: emoji + animated badge
    const emojiText = new fabric.Text(stkDef.emoji, {
        fontSize: size * 0.7,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: -4,
    });

    const badge = new fabric.Rect({
        width: size * 0.5,
        height: size * 0.18,
        rx: size * 0.09,
        ry: size * 0.09,
        fill: '#14b8a6',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: size * 0.35,
    });

    const badgeText = new fabric.Text('ANIM', {
        fontSize: size * 0.1,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        fill: '#fff',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: size * 0.35,
    });

    const border = new fabric.Rect({
        width: size,
        height: size,
        rx: size * 0.15,
        ry: size * 0.15,
        fill: 'transparent',
        stroke: '#14b8a6',
        strokeWidth: 2,
        strokeDashArray: [6, 4],
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
    });

    const group = new fabric.Group([border, emojiText, badge, badgeText], {
        left: bx + bw * 0.3 + Math.random() * bw * 0.4,
        top: by + bh * 0.3 + Math.random() * bh * 0.4,
        originX: 'center',
        originY: 'center',
        // Custom properties
        isAnimSticker: true,
        animStickerType: stickerType,
        excludeFromExport: true,
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
}

/* ═══════════════════════════════════════════
   5. CAPTURE CANVAS + STICKER POSITIONS
   ═══════════════════════════════════════════ */
function _captureCardData() {
    const c = canvas;
    if (!c) return null;

    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return null;

    const bw = board.width * (board.scaleX || 1);
    const bh = board.height * (board.scaleY || 1);
    const bx = board.left || 0;
    const by = board.top || 0;

    // Collect sticker positions (relative to board, as %)
    const stickers = [];
    c.getObjects().forEach(obj => {
        if (!obj.isAnimSticker) return;
        const center = obj.getCenterPoint();
        const relX = ((center.x - bx) / bw) * 100;
        const relY = ((center.y - by) / bh) * 100;
        const objW = (obj.width * (obj.scaleX || 1));
        const relSize = (objW / bw) * 100;
        stickers.push({
            type: obj.animStickerType,
            x: Math.round(relX * 10) / 10,
            y: Math.round(relY * 10) / 10,
            size: Math.round(relSize * 10) / 10,
        });
    });

    // Temporarily hide stickers and capture the image
    const stickerObjs = c.getObjects().filter(o => o.isAnimSticker);
    stickerObjs.forEach(o => o.set('visible', false));
    c.requestRenderAll();

    // Capture
    const origVpt = c.viewportTransform.slice();
    const origW = c.getWidth(), origH = c.getHeight();
    c.setViewportTransform([1, 0, 0, 1, -bx, -by]);
    c.setDimensions({ width: bw, height: bh });
    c.requestRenderAll();
    const imageUrl = c.toDataURL({ format: 'jpeg', quality: 0.85, multiplier: 2, enableRetinaScaling: false });

    // Restore
    c.setViewportTransform(origVpt);
    c.setDimensions({ width: origW, height: origH });
    stickerObjs.forEach(o => o.set('visible', true));
    c.requestRenderAll();

    return { imageUrl, stickers, category: _gcCategory };
}

/* ═══════════════════════════════════════════
   6. PREVIEW
   ═══════════════════════════════════════════ */
async function openGcPreview() {
    const overlay = document.getElementById('gcPreviewOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    const scroll = document.getElementById('gcPreviewScroll');
    scroll.innerHTML = '<div style="text-align:center; padding:40px; color:#0f766e; font-size:14px;"><i class="fa-solid fa-spinner fa-spin"></i> 미리보기 생성 중...</div>';

    await new Promise(r => setTimeout(r, 100));
    const data = _captureCardData();
    if (!data || !data.imageUrl) {
        scroll.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">캡처 실패</div>';
        return;
    }

    const p = PALETTES[_gcCategory] || PALETTES.christmas;
    overlay.style.background = `linear-gradient(135deg, ${p.bg}, ${p.light})`;

    // Build preview with iframe showing animated version
    scroll.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; align-items:center; justify-content:center; padding:20px; height:100%;';

    const frame = document.createElement('div');
    frame.style.cssText = 'position:relative; max-width:380px; width:90%; border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.3); aspect-ratio:9/16;';

    const img = document.createElement('img');
    img.src = data.imageUrl;
    img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
    frame.appendChild(img);

    // Add animated sticker overlays
    const animLayer = document.createElement('div');
    animLayer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden;';
    _renderPreviewAnimations(animLayer, data.stickers, data.category);
    frame.appendChild(animLayer);

    wrap.appendChild(frame);
    scroll.appendChild(wrap);

    const counter = document.getElementById('gcPreviewCounter');
    if (counter) counter.textContent = `${data.stickers.length} effects`;
}

function _renderPreviewAnimations(container, stickers, category) {
    const colors = _getCategoryColors(category);
    stickers.forEach(stk => {
        _createStickerAnimation(container, stk, colors);
    });
}

function _getCategoryColors(category) {
    const C = {
        christmas: ['#fff','#ffd700','#c41e3a','#ffa500'],
        newyear:   ['#ffd700','#a78bfa','#fff','#f59e0b'],
        birthday:  ['#f472b6','#a78bfa','#fbbf24','#34d399','#60a5fa'],
        thankyou:  ['#86efac','#16a34a','#fbbf24','#fff'],
        congrats:  ['#f97316','#fbbf24','#ef4444','#a78bfa','#34d399'],
        valentines:['#ec4899','#f9a8d4','#fff','#f472b6']
    };
    return C[category] || C.christmas;
}

function _createStickerAnimation(container, stk, colors) {
    const { type, x, y, size } = stk;
    const area = document.createElement('div');
    area.style.cssText = `position:absolute; left:${x - size/2}%; top:${y - size/2}%; width:${size}%; height:${size}%; pointer-events:none;`;

    const animMap = {
        fireworks: () => _animFireworks(area, colors),
        hearts: () => _animHearts(area, colors),
        snow: () => _animSnow(area),
        confetti: () => _animConfetti(area, colors),
        sparkle: () => _animSparkle(area, colors),
        bow: () => _animBow(area),
        balloon: () => _animBalloon(area, colors),
        flower: () => _animFlower(area),
        star: () => _animStar(area, colors),
        fire: () => _animFire(area),
        rainbow: () => _animRainbow(area),
        lightning: () => _animLightning(area, colors),
        bubbles: () => _animBubbles(area, colors),
        shooting_star: () => _animShootingStar(area, colors),
        party: () => _animParty(area, colors),
        clap: () => _animClap(area),
        money: () => _animMoney(area),
        butterfly: () => _animButterfly(area, colors),
        rocket: () => _animRocket(area),
        love_letter: () => _animLoveLetter(area, colors),
        cherry_blossom: () => _animCherryBlossom(area),
        galaxy: () => _animGalaxy(area, colors),
        aurora: () => _animAurora(area),
        wave: () => _animWave(area, colors),
        leaves: () => _animLeaves(area),
        spotlight: () => _animSpotlight(area, colors),
        neon: () => _animNeon(area, colors),
        rose_petals: () => _animRosePetals(area),
        music_notes: () => _animMusicNotes(area, colors),
        glitter: () => _animGlitter(area, colors),
        fairy_dust: () => _animFairyDust(area, colors),
        firefly: () => _animFirefly(area),
        ribbon: () => _animRibbon(area, colors),
        champagne: () => _animChampagne(area, colors),
        snowman: () => _animSnowman(area),
        gift: () => _animGift(area, colors),
        dove: () => _animDove(area),
        rain: () => _animRain(area),
        tornado: () => _animTornado(area, colors),
        crown: () => _animCrown(area, colors),
    };
    if (animMap[type]) animMap[type]();

    container.appendChild(area);
}

/* ─── Individual animation generators (for preview + gc.html) ─── */
function _animFireworks(el, colors) {
    setInterval(() => {
        const cx = 30 + Math.random() * 40, cy = 20 + Math.random() * 40;
        const c = colors[Math.floor(Math.random() * colors.length)];
        for (let j = 0; j < 12; j++) {
            const dot = document.createElement('div');
            const angle = (j / 12) * Math.PI * 2;
            const dist = 25 + Math.random() * 25;
            const tx = Math.cos(angle) * dist, ty = Math.sin(angle) * dist;
            dot.style.cssText = `position:absolute; left:${cx}%; top:${cy}%; width:4px; height:4px; border-radius:50%; background:${c}; transition:all 1s ease-out; transform:scale(1); opacity:1;`;
            el.appendChild(dot);
            requestAnimationFrame(() => {
                dot.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
                dot.style.opacity = '0';
            });
            setTimeout(() => dot.remove(), 1200);
        }
    }, 1800);
}

function _animHearts(el, colors) {
    const heartChars = ['♥','💕','💗','💖'];
    setInterval(() => {
        const h = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const ch = heartChars[Math.floor(Math.random() * heartChars.length)];
        const sz = 12 + Math.random() * 16;
        h.textContent = ch;
        h.style.cssText = `position:absolute; left:${20+Math.random()*60}%; bottom:0; font-size:${sz}px; color:${c}; opacity:1; transition:all 2.5s ease-out; pointer-events:none;`;
        el.appendChild(h);
        requestAnimationFrame(() => {
            h.style.bottom = '100%';
            h.style.opacity = '0';
            h.style.transform = `translateX(${-20+Math.random()*40}px) scale(1.3)`;
        });
        setTimeout(() => h.remove(), 2800);
    }, 400);
}

function _animSnow(el) {
    for (let i = 0; i < 8; i++) {
        const flake = document.createElement('div');
        const sz = 6 + Math.random() * 12;
        const dur = 3 + Math.random() * 4;
        const delay = Math.random() * 3;
        flake.textContent = Math.random() > 0.5 ? '❄' : '•';
        flake.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${sz}px; color:#fff; opacity:0.8; animation:gcSnowFall ${dur}s ${delay}s linear infinite;`;
        el.appendChild(flake);
    }
    _ensureKeyframe('gcSnowFall', '0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(200%) rotate(360deg);opacity:0.2}');
}

function _animConfetti(el, colors) {
    for (let i = 0; i < 15; i++) {
        const c = colors[Math.floor(Math.random() * colors.length)];
        const w = 5 + Math.random() * 6, h = 3 + Math.random() * 5;
        const dur = 2 + Math.random() * 3;
        const delay = Math.random() * 2;
        const piece = document.createElement('div');
        piece.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-5%; width:${w}px; height:${h}px; background:${c}; border-radius:${Math.random()>0.5?'50%':'1px'}; animation:gcConfettiFall ${dur}s ${delay}s linear infinite;`;
        el.appendChild(piece);
    }
    _ensureKeyframe('gcConfettiFall', '0%{transform:translateY(0) rotate(0) scale(1);opacity:1} 100%{transform:translateY(300%) rotate(720deg) scale(0.5);opacity:0}');
}

function _animSparkle(el, colors) {
    setInterval(() => {
        const s = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const sz = 10 + Math.random() * 18;
        s.textContent = '✨';
        s.style.cssText = `position:absolute; left:${Math.random()*80+10}%; top:${Math.random()*80+10}%; font-size:${sz}px; color:${c}; animation:gcSparklePulse 1s ease-in-out forwards;`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 1200);
    }, 500);
    _ensureKeyframe('gcSparklePulse', '0%{transform:scale(0) rotate(0);opacity:0} 50%{transform:scale(1.2) rotate(180deg);opacity:1} 100%{transform:scale(0) rotate(360deg);opacity:0}');
}

function _animBow(el) {
    const person = document.createElement('div');
    person.textContent = '🙇';
    person.style.cssText = 'position:absolute; left:50%; top:50%; font-size:36px; transform:translate(-50%,-50%); animation:gcBow 2.5s ease-in-out infinite;';
    el.appendChild(person);
    _ensureKeyframe('gcBow', '0%,100%{transform:translate(-50%,-50%) rotate(0)} 30%{transform:translate(-50%,-30%) rotate(-45deg)} 60%{transform:translate(-50%,-30%) rotate(-45deg)} 80%{transform:translate(-50%,-50%) rotate(0)}');
}

function _animBalloon(el, colors) {
    const balloonEmojis = ['🎈','🎈','🎈'];
    for (let i = 0; i < 4; i++) {
        const b = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const dur = 4 + Math.random() * 3;
        const delay = Math.random() * 3;
        b.textContent = balloonEmojis[i % balloonEmojis.length];
        b.style.cssText = `position:absolute; left:${15+Math.random()*70}%; bottom:-20%; font-size:${20+Math.random()*12}px; animation:gcBalloonFloat ${dur}s ${delay}s ease-out infinite;`;
        el.appendChild(b);
    }
    _ensureKeyframe('gcBalloonFloat', '0%{transform:translateY(0) scale(0.8);opacity:0} 10%{opacity:1} 100%{transform:translateY(-300%) scale(1.1);opacity:0}');
}

function _animFlower(el) {
    const flowers = ['🌸','🌺','🌼','💮'];
    for (let i = 0; i < 8; i++) {
        const f = document.createElement('div');
        const sz = 10 + Math.random() * 14;
        const dur = 3 + Math.random() * 4;
        const delay = Math.random() * 3;
        f.textContent = flowers[Math.floor(Math.random() * flowers.length)];
        f.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${sz}px; animation:gcFlowerFall ${dur}s ${delay}s linear infinite;`;
        el.appendChild(f);
    }
    _ensureKeyframe('gcFlowerFall', '0%{transform:translateY(0) rotate(0) translateX(0);opacity:1} 50%{transform:translateY(150%) rotate(180deg) translateX(20px);opacity:0.8} 100%{transform:translateY(300%) rotate(360deg) translateX(-10px);opacity:0}');
}

function _animStar(el, colors) {
    setInterval(() => {
        const s = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const sz = 8 + Math.random() * 14;
        s.textContent = Math.random() > 0.5 ? '⭐' : '🌟';
        s.style.cssText = `position:absolute; left:${Math.random()*80+10}%; top:${Math.random()*80+10}%; font-size:${sz}px; color:${c}; animation:gcStarTwinkle 1.5s ease-in-out forwards;`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 1700);
    }, 600);
    _ensureKeyframe('gcStarTwinkle', '0%{transform:scale(0) rotate(0);opacity:0} 40%{transform:scale(1.3) rotate(90deg);opacity:1} 100%{transform:scale(0) rotate(180deg);opacity:0}');
}

function _animFire(el) {
    const fires = ['🔥','🔥','💥'];
    setInterval(() => {
        const f = document.createElement('div');
        const sz = 14 + Math.random() * 16;
        f.textContent = fires[Math.floor(Math.random() * fires.length)];
        f.style.cssText = `position:absolute; left:${20+Math.random()*60}%; bottom:10%; font-size:${sz}px; animation:gcFireRise 1.2s ease-out forwards;`;
        el.appendChild(f);
        setTimeout(() => f.remove(), 1400);
    }, 350);
    _ensureKeyframe('gcFireRise', '0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-60px) scale(0.3);opacity:0}');
}

/* ─── NEW EFFECTS ─── */
function _animRainbow(el) {
    const arc = document.createElement('div');
    arc.style.cssText = 'position:absolute; left:10%; top:20%; width:80%; height:60%; border-radius:50% 50% 0 0; background:conic-gradient(from 180deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000); opacity:0; animation:gcRainbowAppear 4s ease-in-out infinite;';
    el.appendChild(arc);
    const inner = document.createElement('div');
    inner.style.cssText = 'position:absolute; left:15%; top:25%; width:70%; height:55%; border-radius:50% 50% 0 0; background:inherit; mix-blend-mode:destination-out;';
    // Use mask approach instead
    arc.style.webkitMaskImage = 'radial-gradient(ellipse 60% 70% at 50% 100%, transparent 50%, black 51%)';
    arc.style.maskImage = 'radial-gradient(ellipse 60% 70% at 50% 100%, transparent 50%, black 51%)';
    _ensureKeyframe('gcRainbowAppear', '0%{opacity:0;transform:scale(0.5) translateY(20%)} 30%{opacity:0.7;transform:scale(1) translateY(0)} 70%{opacity:0.7;transform:scale(1) translateY(0)} 100%{opacity:0;transform:scale(1.1) translateY(-10%)}');
}

function _animLightning(el, colors) {
    setInterval(() => {
        const bolt = document.createElement('div');
        bolt.textContent = '⚡';
        const sz = 20 + Math.random() * 24;
        const lx = 10 + Math.random() * 80;
        bolt.style.cssText = `position:absolute; left:${lx}%; top:5%; font-size:${sz}px; animation:gcLightningFlash 0.6s ease-out forwards; filter:drop-shadow(0 0 8px #ffd700);`;
        el.appendChild(bolt);
        // Flash overlay
        const flash = document.createElement('div');
        flash.style.cssText = 'position:absolute; inset:0; background:rgba(255,255,200,0.3); animation:gcFlashOverlay 0.3s ease-out forwards;';
        el.appendChild(flash);
        setTimeout(() => { bolt.remove(); flash.remove(); }, 800);
    }, 2500);
    _ensureKeyframe('gcLightningFlash', '0%{transform:translateY(0) scale(1.5);opacity:1} 20%{opacity:1} 100%{transform:translateY(80%) scale(0.8);opacity:0}');
    _ensureKeyframe('gcFlashOverlay', '0%{opacity:0.4} 100%{opacity:0}');
}

function _animBubbles(el, colors) {
    for (let i = 0; i < 10; i++) {
        const b = document.createElement('div');
        const sz = 8 + Math.random() * 18;
        const dur = 3 + Math.random() * 4;
        const delay = Math.random() * 3;
        const c = colors[Math.floor(Math.random() * colors.length)];
        b.style.cssText = `position:absolute; left:${Math.random()*90+5}%; bottom:-10%; width:${sz}px; height:${sz}px; border-radius:50%; border:2px solid ${c}; background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), transparent); animation:gcBubbleRise ${dur}s ${delay}s ease-in infinite;`;
        el.appendChild(b);
    }
    _ensureKeyframe('gcBubbleRise', '0%{transform:translateY(0) translateX(0) scale(0.5);opacity:0} 10%{opacity:0.8} 50%{transform:translateY(-150%) translateX(10px) scale(1)} 100%{transform:translateY(-300%) translateX(-5px) scale(1.2);opacity:0}');
}

function _animShootingStar(el, colors) {
    setInterval(() => {
        const s = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        s.style.cssText = `position:absolute; right:-5%; top:${Math.random()*40}%; width:3px; height:3px; background:${c}; border-radius:50%; box-shadow:0 0 6px ${c}, -8px 0 12px ${c}, -16px 0 8px ${c}; animation:gcShootingStar 1s ease-in forwards;`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 1200);
    }, 1200);
    _ensureKeyframe('gcShootingStar', '0%{transform:translateX(0) translateY(0);opacity:1} 100%{transform:translateX(-200px) translateY(100px);opacity:0}');
}

function _animParty(el, colors) {
    const items = ['🎉','🎈','🎊','🥳','🎵','🎶','🍾'];
    setInterval(() => {
        const p = document.createElement('div');
        const sz = 14 + Math.random() * 18;
        p.textContent = items[Math.floor(Math.random() * items.length)];
        p.style.cssText = `position:absolute; left:${Math.random()*80+10}%; bottom:0; font-size:${sz}px; animation:gcPartyPop 2s ease-out forwards;`;
        el.appendChild(p);
        setTimeout(() => p.remove(), 2200);
    }, 350);
    _ensureKeyframe('gcPartyPop', '0%{transform:translateY(0) scale(0.3) rotate(0);opacity:0} 20%{opacity:1;transform:translateY(-30px) scale(1.2) rotate(-10deg)} 60%{transform:translateY(-80px) scale(1) rotate(15deg)} 100%{transform:translateY(-120px) scale(0.5) rotate(30deg);opacity:0}');
}

function _animClap(el) {
    const clap = document.createElement('div');
    clap.textContent = '👏';
    clap.style.cssText = 'position:absolute; left:50%; top:50%; font-size:32px; transform:translate(-50%,-50%); animation:gcClap 1.2s ease-in-out infinite;';
    el.appendChild(clap);
    // Sparkle on clap
    setInterval(() => {
        for (let i = 0; i < 4; i++) {
            const sp = document.createElement('div');
            sp.textContent = '✨';
            sp.style.cssText = `position:absolute; left:${40+Math.random()*20}%; top:${40+Math.random()*20}%; font-size:${8+Math.random()*10}px; animation:gcSparklePulse 0.8s ease-out forwards;`;
            el.appendChild(sp);
            setTimeout(() => sp.remove(), 900);
        }
    }, 1200);
    _ensureKeyframe('gcClap', '0%,100%{transform:translate(-50%,-50%) scale(1)} 15%{transform:translate(-50%,-50%) scale(1.3)} 30%{transform:translate(-50%,-50%) scale(1)} 45%{transform:translate(-50%,-50%) scale(1.3)} 60%{transform:translate(-50%,-50%) scale(1)}');
    _ensureKeyframe('gcSparklePulse', '0%{transform:scale(0) rotate(0);opacity:0} 50%{transform:scale(1.2) rotate(180deg);opacity:1} 100%{transform:scale(0) rotate(360deg);opacity:0}');
}

function _animMoney(el) {
    const bills = ['💵','💴','💶','💷','💰','🪙'];
    for (let i = 0; i < 10; i++) {
        const m = document.createElement('div');
        const sz = 12 + Math.random() * 16;
        const dur = 2.5 + Math.random() * 3;
        const delay = Math.random() * 2;
        m.textContent = bills[Math.floor(Math.random() * bills.length)];
        m.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${sz}px; animation:gcMoneyRain ${dur}s ${delay}s linear infinite;`;
        el.appendChild(m);
    }
    _ensureKeyframe('gcMoneyRain', '0%{transform:translateY(0) rotate(0) translateX(0);opacity:1} 25%{transform:translateY(75%) rotate(90deg) translateX(15px)} 50%{transform:translateY(150%) rotate(180deg) translateX(-10px)} 75%{transform:translateY(225%) rotate(270deg) translateX(8px)} 100%{transform:translateY(300%) rotate(360deg) translateX(0);opacity:0}');
}

function _animButterfly(el, colors) {
    const butterflies = ['🦋','🦋','🦋'];
    for (let i = 0; i < 4; i++) {
        const b = document.createElement('div');
        const sz = 16 + Math.random() * 14;
        const dur = 5 + Math.random() * 4;
        const delay = Math.random() * 3;
        const startX = Math.random() * 80 + 10;
        const startY = Math.random() * 80 + 10;
        b.textContent = butterflies[i % butterflies.length];
        b.style.cssText = `position:absolute; left:${startX}%; top:${startY}%; font-size:${sz}px; animation:gcButterfly${i%3} ${dur}s ${delay}s ease-in-out infinite;`;
        el.appendChild(b);
    }
    _ensureKeyframe('gcButterfly0', '0%{transform:translate(0,0) scaleX(1)} 25%{transform:translate(30px,-20px) scaleX(-1)} 50%{transform:translate(10px,-40px) scaleX(1)} 75%{transform:translate(-20px,-15px) scaleX(-1)} 100%{transform:translate(0,0) scaleX(1)}');
    _ensureKeyframe('gcButterfly1', '0%{transform:translate(0,0) scaleX(-1)} 25%{transform:translate(-25px,-30px) scaleX(1)} 50%{transform:translate(-5px,10px) scaleX(-1)} 75%{transform:translate(20px,-20px) scaleX(1)} 100%{transform:translate(0,0) scaleX(-1)}');
    _ensureKeyframe('gcButterfly2', '0%{transform:translate(0,0) scaleX(1)} 33%{transform:translate(20px,15px) scaleX(-1)} 66%{transform:translate(-15px,-25px) scaleX(1)} 100%{transform:translate(0,0) scaleX(1)}');
}

function _animRocket(el) {
    const rocket = document.createElement('div');
    rocket.textContent = '🚀';
    rocket.style.cssText = 'position:absolute; left:50%; bottom:0; font-size:28px; animation:gcRocketLaunch 3s ease-in infinite;';
    el.appendChild(rocket);
    // Exhaust trail
    setInterval(() => {
        const trail = document.createElement('div');
        trail.textContent = Math.random() > 0.5 ? '💨' : '🔥';
        trail.style.cssText = `position:absolute; left:${45+Math.random()*10}%; bottom:${Math.random()*20}%; font-size:${10+Math.random()*8}px; animation:gcExhaust 0.8s ease-out forwards; opacity:0.7;`;
        el.appendChild(trail);
        setTimeout(() => trail.remove(), 900);
    }, 200);
    _ensureKeyframe('gcRocketLaunch', '0%{transform:translateY(0) rotate(-45deg);opacity:1} 70%{transform:translateY(-200%) rotate(-45deg);opacity:1} 100%{transform:translateY(-300%) rotate(-45deg);opacity:0}');
    _ensureKeyframe('gcExhaust', '0%{transform:scale(1);opacity:0.7} 100%{transform:scale(0.3) translateY(20px);opacity:0}');
}

function _animLoveLetter(el, colors) {
    const items = ['💌','💝','💘','💞'];
    setInterval(() => {
        const l = document.createElement('div');
        const sz = 14 + Math.random() * 14;
        l.textContent = items[Math.floor(Math.random() * items.length)];
        l.style.cssText = `position:absolute; left:${20+Math.random()*60}%; bottom:0; font-size:${sz}px; animation:gcLoveFloat 3s ease-out forwards;`;
        el.appendChild(l);
        setTimeout(() => l.remove(), 3200);
    }, 800);
    _ensureKeyframe('gcLoveFloat', '0%{transform:translateY(0) scale(0) rotate(-20deg);opacity:0} 20%{transform:translateY(-20px) scale(1.2) rotate(10deg);opacity:1} 50%{transform:translateY(-60px) scale(1) rotate(-5deg);opacity:0.9} 100%{transform:translateY(-120px) scale(0.7) rotate(15deg);opacity:0}');
}

/* ─── NEW 20 EFFECTS ─── */
function _animCherryBlossom(el) {
    const petals = ['🌸','💮','🏵️'];
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        const sz = 10 + Math.random() * 14;
        const dur = 4 + Math.random() * 5;
        const delay = Math.random() * 4;
        p.textContent = petals[Math.floor(Math.random() * petals.length)];
        p.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${sz}px; animation:gcCherryFall ${dur}s ${delay}s linear infinite;`;
        el.appendChild(p);
    }
    _ensureKeyframe('gcCherryFall', '0%{transform:translateY(0) rotate(0) translateX(0);opacity:0.9} 25%{transform:translateY(75%) rotate(90deg) translateX(25px)} 50%{transform:translateY(150%) rotate(180deg) translateX(-15px);opacity:0.7} 75%{transform:translateY(225%) rotate(270deg) translateX(20px)} 100%{transform:translateY(320%) rotate(360deg) translateX(-5px);opacity:0}');
}

function _animGalaxy(el, colors) {
    for (let i = 0; i < 25; i++) {
        const s = document.createElement('div');
        const sz = 2 + Math.random() * 4;
        const dur = 2 + Math.random() * 3;
        const delay = Math.random() * 3;
        const c = colors[Math.floor(Math.random() * colors.length)];
        const cx = 50, cy = 50;
        const r = 15 + Math.random() * 35;
        const angle = Math.random() * 360;
        s.style.cssText = `position:absolute; left:${cx}%; top:${cy}%; width:${sz}px; height:${sz}px; border-radius:50%; background:${c}; box-shadow:0 0 ${sz*2}px ${c}; animation:gcGalaxySpin${i%3} ${dur}s ${delay}s linear infinite; transform-origin:${r}px 0;`;
        el.appendChild(s);
    }
    _ensureKeyframe('gcGalaxySpin0', '0%{transform:rotate(0) translateX(30px);opacity:0.8} 50%{opacity:1} 100%{transform:rotate(360deg) translateX(30px);opacity:0.8}');
    _ensureKeyframe('gcGalaxySpin1', '0%{transform:rotate(120deg) translateX(20px);opacity:0.6} 50%{opacity:1} 100%{transform:rotate(480deg) translateX(20px);opacity:0.6}');
    _ensureKeyframe('gcGalaxySpin2', '0%{transform:rotate(240deg) translateX(40px);opacity:0.7} 50%{opacity:1} 100%{transform:rotate(600deg) translateX(40px);opacity:0.7}');
}

function _animAurora(el) {
    for (let i = 0; i < 3; i++) {
        const band = document.createElement('div');
        const hue = 120 + i * 60;
        const dur = 5 + i * 2;
        band.style.cssText = `position:absolute; left:-20%; top:${10+i*20}%; width:140%; height:30%; background:linear-gradient(90deg, transparent, hsla(${hue},80%,60%,0.3), hsla(${hue+30},80%,60%,0.2), transparent); filter:blur(10px); animation:gcAurora${i} ${dur}s ease-in-out infinite;`;
        el.appendChild(band);
    }
    _ensureKeyframe('gcAurora0', '0%{transform:translateX(-10%) skewX(-5deg);opacity:0.4} 50%{transform:translateX(10%) skewX(5deg);opacity:0.7} 100%{transform:translateX(-10%) skewX(-5deg);opacity:0.4}');
    _ensureKeyframe('gcAurora1', '0%{transform:translateX(5%) skewX(3deg);opacity:0.3} 50%{transform:translateX(-5%) skewX(-3deg);opacity:0.6} 100%{transform:translateX(5%) skewX(3deg);opacity:0.3}');
    _ensureKeyframe('gcAurora2', '0%{transform:translateX(-8%) skewX(-4deg);opacity:0.35} 50%{transform:translateX(8%) skewX(4deg);opacity:0.55} 100%{transform:translateX(-8%) skewX(-4deg);opacity:0.35}');
}

function _animWave(el, colors) {
    for (let i = 0; i < 3; i++) {
        const w = document.createElement('div');
        const c = colors[i % colors.length];
        const dur = 3 + i;
        w.style.cssText = `position:absolute; left:-10%; bottom:${i*8}%; width:120%; height:25%; background:${c}; border-radius:50% 50% 0 0; opacity:0.3; animation:gcWave ${dur}s ${i*0.5}s ease-in-out infinite;`;
        el.appendChild(w);
    }
    _ensureKeyframe('gcWave', '0%{transform:translateX(-5%) scaleY(1)} 50%{transform:translateX(5%) scaleY(1.3)} 100%{transform:translateX(-5%) scaleY(1)}');
}

function _animLeaves(el) {
    const leaves = ['🍂','🍁','🍃','🌿'];
    for (let i = 0; i < 10; i++) {
        const l = document.createElement('div');
        const sz = 12 + Math.random() * 14;
        const dur = 4 + Math.random() * 5;
        const delay = Math.random() * 4;
        l.textContent = leaves[Math.floor(Math.random() * leaves.length)];
        l.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${sz}px; animation:gcLeafFall ${dur}s ${delay}s linear infinite;`;
        el.appendChild(l);
    }
    _ensureKeyframe('gcLeafFall', '0%{transform:translateY(0) rotate(0) translateX(0);opacity:1} 30%{transform:translateY(90%) rotate(120deg) translateX(30px)} 60%{transform:translateY(180%) rotate(240deg) translateX(-20px);opacity:0.7} 100%{transform:translateY(320%) rotate(400deg) translateX(10px);opacity:0}');
}

function _animSpotlight(el, colors) {
    const sp = document.createElement('div');
    sp.style.cssText = 'position:absolute; left:50%; top:50%; width:80%; height:80%; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 60%); animation:gcSpotlight 3s ease-in-out infinite;';
    el.appendChild(sp);
    _ensureKeyframe('gcSpotlight', '0%{transform:translate(-50%,-50%) scale(0.8);opacity:0.3} 50%{transform:translate(-50%,-50%) scale(1.2);opacity:0.7} 100%{transform:translate(-50%,-50%) scale(0.8);opacity:0.3}');
}

function _animNeon(el, colors) {
    const c = colors[0] || '#ff00ff';
    const box = document.createElement('div');
    box.style.cssText = `position:absolute; left:10%; top:10%; width:80%; height:80%; border:3px solid ${c}; border-radius:12px; box-shadow:0 0 10px ${c}, inset 0 0 10px ${c}; animation:gcNeonPulse 2s ease-in-out infinite;`;
    el.appendChild(box);
    _ensureKeyframe('gcNeonPulse', `0%{box-shadow:0 0 5px ${c},inset 0 0 5px ${c};opacity:0.6} 50%{box-shadow:0 0 20px ${c},0 0 40px ${c},inset 0 0 20px ${c};opacity:1} 100%{box-shadow:0 0 5px ${c},inset 0 0 5px ${c};opacity:0.6}`);
}

function _animRosePetals(el) {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        const sz = 8 + Math.random() * 10;
        const dur = 3 + Math.random() * 4;
        const delay = Math.random() * 3;
        const hue = 340 + Math.random() * 30;
        p.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-5%; width:${sz}px; height:${sz*0.7}px; background:hsl(${hue},80%,60%); border-radius:50% 50% 50% 0; animation:gcPetalDrift ${dur}s ${delay}s linear infinite;`;
        el.appendChild(p);
    }
    _ensureKeyframe('gcPetalDrift', '0%{transform:translateY(0) rotate(0) translateX(0);opacity:0.9} 33%{transform:translateY(100%) rotate(120deg) translateX(20px)} 66%{transform:translateY(200%) rotate(240deg) translateX(-15px);opacity:0.6} 100%{transform:translateY(320%) rotate(380deg) translateX(5px);opacity:0}');
}

function _animMusicNotes(el, colors) {
    const notes = ['🎵','🎶','♪','♫','🎼'];
    setInterval(() => {
        const n = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const sz = 14 + Math.random() * 16;
        n.textContent = notes[Math.floor(Math.random() * notes.length)];
        n.style.cssText = `position:absolute; left:${10+Math.random()*80}%; bottom:0; font-size:${sz}px; color:${c}; animation:gcNoteDance 2.5s ease-out forwards;`;
        el.appendChild(n);
        setTimeout(() => n.remove(), 2700);
    }, 500);
    _ensureKeyframe('gcNoteDance', '0%{transform:translateY(0) rotate(0) scale(0.5);opacity:0} 20%{opacity:1;transform:translateY(-20px) rotate(-15deg) scale(1.1)} 60%{transform:translateY(-70px) rotate(15deg) scale(1)} 100%{transform:translateY(-120px) rotate(-10deg) scale(0.7);opacity:0}');
}

function _animGlitter(el, colors) {
    setInterval(() => {
        for (let i = 0; i < 3; i++) {
            const g = document.createElement('div');
            const c = colors[Math.floor(Math.random() * colors.length)];
            const sz = 3 + Math.random() * 5;
            g.style.cssText = `position:absolute; left:${Math.random()*100}%; top:${Math.random()*100}%; width:${sz}px; height:${sz}px; background:${c}; border-radius:50%; box-shadow:0 0 ${sz}px ${c}; animation:gcGlitterPop 0.8s ease-out forwards;`;
            el.appendChild(g);
            setTimeout(() => g.remove(), 900);
        }
    }, 300);
    _ensureKeyframe('gcGlitterPop', '0%{transform:scale(0);opacity:0} 40%{transform:scale(1.5);opacity:1} 100%{transform:scale(0);opacity:0}');
}

function _animFairyDust(el, colors) {
    setInterval(() => {
        const d = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const sz = 4 + Math.random() * 6;
        const startX = Math.random() * 100;
        d.style.cssText = `position:absolute; left:${startX}%; top:${20+Math.random()*60}%; width:${sz}px; height:${sz}px; background:${c}; border-radius:50%; box-shadow:0 0 ${sz*3}px ${c}; animation:gcFairyTrail 1.5s ease-out forwards;`;
        el.appendChild(d);
        setTimeout(() => d.remove(), 1600);
    }, 150);
    _ensureKeyframe('gcFairyTrail', '0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(${-20+Math.random()*40}px, ${-30+Math.random()*60}px) scale(0);opacity:0}');
}

function _animFirefly(el) {
    for (let i = 0; i < 8; i++) {
        const f = document.createElement('div');
        const sz = 4 + Math.random() * 4;
        const dur = 3 + Math.random() * 4;
        const delay = Math.random() * 3;
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        f.style.cssText = `position:absolute; left:${x}%; top:${y}%; width:${sz}px; height:${sz}px; background:#ffd700; border-radius:50%; box-shadow:0 0 ${sz*3}px #ffd700, 0 0 ${sz*6}px rgba(255,215,0,0.3); animation:gcFirefly${i%3} ${dur}s ${delay}s ease-in-out infinite;`;
        el.appendChild(f);
    }
    _ensureKeyframe('gcFirefly0', '0%{transform:translate(0,0);opacity:0.3} 25%{transform:translate(15px,-10px);opacity:1} 50%{transform:translate(-5px,-20px);opacity:0.5} 75%{transform:translate(-15px,5px);opacity:1} 100%{transform:translate(0,0);opacity:0.3}');
    _ensureKeyframe('gcFirefly1', '0%{transform:translate(0,0);opacity:0.5} 30%{transform:translate(-20px,10px);opacity:1} 60%{transform:translate(10px,15px);opacity:0.4} 100%{transform:translate(0,0);opacity:0.5}');
    _ensureKeyframe('gcFirefly2', '0%{transform:translate(0,0);opacity:0.4} 40%{transform:translate(10px,20px);opacity:1} 80%{transform:translate(-10px,-5px);opacity:0.6} 100%{transform:translate(0,0);opacity:0.4}');
}

function _animRibbon(el, colors) {
    const ribbons = ['🎀','🎀','🎗️'];
    for (let i = 0; i < 5; i++) {
        const r = document.createElement('div');
        const c = colors[i % colors.length];
        const dur = 4 + Math.random() * 3;
        const delay = Math.random() * 3;
        r.textContent = ribbons[i % ribbons.length];
        r.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${16+Math.random()*12}px; color:${c}; animation:gcRibbonTwirl ${dur}s ${delay}s linear infinite;`;
        el.appendChild(r);
    }
    _ensureKeyframe('gcRibbonTwirl', '0%{transform:translateY(0) rotate(0) scaleX(1);opacity:1} 25%{transform:translateY(80%) rotate(90deg) scaleX(-1)} 50%{transform:translateY(160%) rotate(180deg) scaleX(1);opacity:0.7} 75%{transform:translateY(240%) rotate(270deg) scaleX(-1)} 100%{transform:translateY(320%) rotate(360deg) scaleX(1);opacity:0}');
}

function _animChampagne(el, colors) {
    const bottle = document.createElement('div');
    bottle.textContent = '🍾';
    bottle.style.cssText = 'position:absolute; left:50%; bottom:10%; font-size:28px; transform:translateX(-50%); animation:gcChampagnePop 3s ease-in-out infinite;';
    el.appendChild(bottle);
    setInterval(() => {
        for (let i = 0; i < 6; i++) {
            const b = document.createElement('div');
            const c = colors[Math.floor(Math.random() * colors.length)];
            b.style.cssText = `position:absolute; left:${40+Math.random()*20}%; bottom:40%; width:${3+Math.random()*4}px; height:${3+Math.random()*4}px; background:${c}; border-radius:50%; animation:gcBubblePop 1.5s ease-out forwards;`;
            el.appendChild(b);
            setTimeout(() => b.remove(), 1600);
        }
    }, 700);
    _ensureKeyframe('gcChampagnePop', '0%{transform:translateX(-50%) rotate(0)} 10%{transform:translateX(-50%) rotate(-15deg)} 20%{transform:translateX(-50%) rotate(0)} 100%{transform:translateX(-50%) rotate(0)}');
    _ensureKeyframe('gcBubblePop', '0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-80px) scale(0.5);opacity:0}');
}

function _animSnowman(el) {
    const sm = document.createElement('div');
    sm.textContent = '⛄';
    sm.style.cssText = 'position:absolute; left:50%; top:50%; font-size:36px; transform:translate(-50%,-50%); animation:gcSnowmanWobble 2s ease-in-out infinite;';
    el.appendChild(sm);
    // Snow around snowman
    for (let i = 0; i < 6; i++) {
        const s = document.createElement('div');
        s.textContent = '❄';
        const sz = 8 + Math.random() * 8;
        const dur = 3 + Math.random() * 3;
        const delay = Math.random() * 3;
        s.style.cssText = `position:absolute; left:${Math.random()*100}%; top:-10%; font-size:${sz}px; color:#b0d4f1; animation:gcSnowFall ${dur}s ${delay}s linear infinite;`;
        el.appendChild(s);
    }
    _ensureKeyframe('gcSnowmanWobble', '0%,100%{transform:translate(-50%,-50%) rotate(0)} 25%{transform:translate(-50%,-50%) rotate(5deg)} 75%{transform:translate(-50%,-50%) rotate(-5deg)}');
    _ensureKeyframe('gcSnowFall', '0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(200%) rotate(360deg);opacity:0.2}');
}

function _animGift(el, colors) {
    const gift = document.createElement('div');
    gift.textContent = '🎁';
    gift.style.cssText = 'position:absolute; left:50%; top:50%; font-size:32px; transform:translate(-50%,-50%); animation:gcGiftShake 1.5s ease-in-out infinite;';
    el.appendChild(gift);
    setInterval(() => {
        for (let i = 0; i < 5; i++) {
            const sp = document.createElement('div');
            sp.textContent = '✨';
            const c = colors[Math.floor(Math.random() * colors.length)];
            sp.style.cssText = `position:absolute; left:${35+Math.random()*30}%; top:${35+Math.random()*30}%; font-size:${8+Math.random()*12}px; color:${c}; animation:gcSparklePulse 0.8s ease-out forwards;`;
            el.appendChild(sp);
            setTimeout(() => sp.remove(), 900);
        }
    }, 1500);
    _ensureKeyframe('gcGiftShake', '0%,100%{transform:translate(-50%,-50%) rotate(0) scale(1)} 10%{transform:translate(-50%,-50%) rotate(-8deg) scale(1.05)} 20%{transform:translate(-50%,-50%) rotate(8deg) scale(1.05)} 30%{transform:translate(-50%,-50%) rotate(-5deg)} 40%{transform:translate(-50%,-50%) rotate(5deg)} 50%{transform:translate(-50%,-50%) rotate(0) scale(1)}');
}

function _animDove(el) {
    for (let i = 0; i < 3; i++) {
        const d = document.createElement('div');
        d.textContent = '🕊️';
        const sz = 18 + Math.random() * 14;
        const dur = 5 + Math.random() * 4;
        const delay = Math.random() * 3;
        const startY = 20 + Math.random() * 40;
        d.style.cssText = `position:absolute; right:-15%; top:${startY}%; font-size:${sz}px; animation:gcDoveFly${i%2} ${dur}s ${delay}s ease-in-out infinite;`;
        el.appendChild(d);
    }
    _ensureKeyframe('gcDoveFly0', '0%{transform:translateX(0) translateY(0) scaleX(-1);opacity:0} 10%{opacity:1} 50%{transform:translateX(-120px) translateY(-30px) scaleX(-1)} 90%{opacity:1} 100%{transform:translateX(-250px) translateY(-10px) scaleX(-1);opacity:0}');
    _ensureKeyframe('gcDoveFly1', '0%{transform:translateX(0) translateY(0) scaleX(-1);opacity:0} 10%{opacity:1} 50%{transform:translateX(-100px) translateY(20px) scaleX(-1)} 90%{opacity:1} 100%{transform:translateX(-230px) translateY(-20px) scaleX(-1);opacity:0}');
}

function _animRain(el) {
    for (let i = 0; i < 15; i++) {
        const r = document.createElement('div');
        const dur = 0.8 + Math.random() * 0.7;
        const delay = Math.random() * 1.5;
        const x = Math.random() * 100;
        r.style.cssText = `position:absolute; left:${x}%; top:-5%; width:2px; height:${10+Math.random()*12}px; background:linear-gradient(transparent, rgba(120,180,255,0.6)); border-radius:1px; animation:gcRainDrop ${dur}s ${delay}s linear infinite;`;
        el.appendChild(r);
    }
    _ensureKeyframe('gcRainDrop', '0%{transform:translateY(0);opacity:0.8} 100%{transform:translateY(300%);opacity:0.2}');
}

function _animTornado(el, colors) {
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        const c = colors[Math.floor(Math.random() * colors.length)];
        const sz = 3 + Math.random() * 5;
        const dur = 1.5 + Math.random() * 1.5;
        const delay = Math.random() * 2;
        const radius = 10 + (i/15) * 30;
        p.style.cssText = `position:absolute; left:50%; top:${80 - (i/15)*70}%; width:${sz}px; height:${sz}px; background:${c}; border-radius:50%; animation:gcTornadoSpin ${dur}s ${delay}s linear infinite; transform-origin:${radius}px 0;`;
        el.appendChild(p);
    }
    _ensureKeyframe('gcTornadoSpin', '0%{transform:rotate(0)} 100%{transform:rotate(360deg)}');
}

function _animCrown(el, colors) {
    const crown = document.createElement('div');
    crown.textContent = '👑';
    crown.style.cssText = 'position:absolute; left:50%; top:30%; font-size:32px; transform:translate(-50%,-50%); animation:gcCrownFloat 3s ease-in-out infinite;';
    el.appendChild(crown);
    setInterval(() => {
        for (let i = 0; i < 3; i++) {
            const sp = document.createElement('div');
            const c = colors[Math.floor(Math.random() * colors.length)];
            sp.textContent = '✨';
            sp.style.cssText = `position:absolute; left:${30+Math.random()*40}%; top:${20+Math.random()*30}%; font-size:${6+Math.random()*10}px; color:${c}; animation:gcSparklePulse 0.8s ease-out forwards;`;
            el.appendChild(sp);
            setTimeout(() => sp.remove(), 900);
        }
    }, 1000);
    _ensureKeyframe('gcCrownFloat', '0%{transform:translate(-50%,-50%) translateY(0) rotate(-3deg)} 50%{transform:translate(-50%,-50%) translateY(-10px) rotate(3deg)} 100%{transform:translate(-50%,-50%) translateY(0) rotate(-3deg)}');
}

/* ─── CSS Keyframe injection helper ─── */
const _injectedKeyframes = new Set();
function _ensureKeyframe(name, body) {
    if (_injectedKeyframes.has(name)) return;
    _injectedKeyframes.add(name);
    const style = document.createElement('style');
    style.textContent = `@keyframes ${name} { ${body} }`;
    document.head.appendChild(style);
}

function closeGcPreview() {
    const overlay = document.getElementById('gcPreviewOverlay');
    if (overlay) overlay.style.display = 'none';
}

/* ═══════════════════════════════════════════
   7. WIZARD
   ═══════════════════════════════════════════ */
function openGcWizard() {
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

    const fromName = document.getElementById('gcFromName')?.value || '';
    const toName = document.getElementById('gcToName')?.value || '';
    const message = document.getElementById('gcMessage')?.value || '';

    const modal = document.getElementById('gcWizardModal');

    // If not in editor yet, open editor first
    if (!window.__GREETING_CARD_MODE) {
        if (modal) modal.style.display = 'none';
        if (window.dsmOpenEditor) {
            await window.dsmOpenEditor(286, 508, '인사말카드');
        }
        await new Promise(r => setTimeout(r, 1500));
    }

    const p = PALETTES[_gcCategory] || PALETTES.christmas;
    const g = CATEGORY_GREETINGS[_gcCategory] || CATEGORY_GREETINGS.christmas;
    const emoji = CATEGORY_EMOJIS[_gcCategory] || '✨';

    window.__gcSelection = { category: _gcCategory, fromName, toName, message };

    const board = canvas.getObjects().find(o => o.isBoard);
    if (board) board.set({ fill: p.bg });

    // Clear canvas
    canvas.getObjects().filter(o => !o.isBoard && !o.isMockup && !o.isGuide).forEach(o => canvas.remove(o));
    const bw = board.width * (board.scaleX || 1);
    const bh = board.height * (board.scaleY || 1);
    const bx = board.left || 0;
    const by = board.top || 0;

    // Build single-page card
    const items = [
        { type:'textbox', text:emoji, left:bw*0.35+bx, top:bh*0.04+by, width:bw*0.3,
          fontSize:Math.round(bh*0.07), fontFamily:'Georgia, serif', fill:p.accent, textAlign:'center' },
        { type:'textbox', text:g.title, left:bw*0.05+bx, top:bh*0.14+by, width:bw*0.9,
          fontSize:Math.round(bh*0.045), fontFamily:'Georgia, serif', fontWeight:'bold', fill:p.text, textAlign:'center' },
    ];

    if (_gcPhotos.length > 0) {
        // photo will be added separately
    } else {
        items.push(
            { type:'rect', left:bw*0.1+bx, top:bh*0.24+by, width:bw*0.8, height:bh*0.3,
              fill:p.light, rx:16, ry:16, stroke:p.accent, strokeWidth:2,
              isGcPlaceholder:true, gcPlaceholderId:'main_photo' },
            { type:'textbox', text:_t('gc_photo_here','사진을 넣어주세요'), left:bw*0.2+bx, top:bh*0.37+by, width:bw*0.6,
              fontSize:Math.round(bh*0.02), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center', editable:false,
              isGcPlaceholderText:true, gcPlaceholderId:'main_photo' }
        );
    }

    // Message
    const msgText = message || g.sub;
    items.push(
        { type:'textbox', text: toName ? `Dear ${toName},` : '', left:bw*0.1+bx, top:bh*0.58+by, width:bw*0.8,
          fontSize:Math.round(bh*0.022), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center' },
        { type:'textbox', text:msgText, left:bw*0.08+bx, top:bh*0.64+by, width:bw*0.84,
          fontSize:Math.round(bh*0.026), fontFamily:'Georgia, serif', fill:p.text, textAlign:'center', lineHeight:1.6 },
        { type:'rect', left:bw*0.3+bx, top:bh*0.82+by, width:bw*0.4, height:2, fill:p.accent },
        { type:'textbox', text: fromName ? `From. ${fromName}` : 'From. ___', left:bw*0.15+bx, top:bh*0.86+by, width:bw*0.7,
          fontSize:Math.round(bh*0.022), fontFamily:'Georgia, serif', fill:p.sub, textAlign:'center' }
    );

    items.forEach(cfg => {
        let obj;
        if (cfg.type === 'textbox') obj = new fabric.Textbox(cfg.text || '', cfg);
        else if (cfg.type === 'rect') obj = new fabric.Rect(cfg);
        if (obj) {
            CUSTOM_PROPS.forEach(pr => { if (cfg[pr] !== undefined) obj.set(pr, cfg[pr]); });
            canvas.add(obj);
        }
    });

    // Add photo if available
    if (_gcPhotos.length > 0) {
        await _addPhotoToCanvas(_gcPhotos[0], bw*0.1+bx, bh*0.24+by, bw*0.8, bh*0.3, 16);
    }

    canvas.requestRenderAll();

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
   8. SHARE (Upload + generate animated link)
   ═══════════════════════════════════════════ */
async function shareGreetingCard() {
    const dialog = document.getElementById('gcShareDialog');
    if (!dialog) return;
    dialog.style.display = 'flex';

    const progressEl = document.getElementById('gcShareProgress');
    const result = document.getElementById('gcShareResult');
    if (progressEl) progressEl.style.display = 'block';
    if (result) result.style.display = 'none';

    try {
        await new Promise(r => setTimeout(r, 100));
        const data = _captureCardData();
        if (!data || !data.imageUrl) throw new Error('Card capture failed');

        const slug = 'gc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

        const sb = window.sb || (await import('./config.js?v=147')).sb;
        if (!sb) throw new Error('Supabase not available');

        // Upload card image
        const blob = await (await fetch(data.imageUrl)).blob();
        const imgPath = `greeting-card/${slug}/card.jpg`;
        const { error: imgErr } = await sb.storage.from('orders').upload(imgPath, blob, { contentType:'image/jpeg', upsert:true });
        if (imgErr) throw imgErr;

        const { data: imgData } = sb.storage.from('orders').getPublicUrl(imgPath);

        // Upload meta.json with sticker data
        const meta = {
            slug,
            category: data.category,
            image: imgData.publicUrl,
            stickers: data.stickers,
            fromName: window.__gcSelection?.fromName || '',
            toName: window.__gcSelection?.toName || '',
            createdAt: new Date().toISOString()
        };
        const metaBlob = new Blob([JSON.stringify(meta)], { type:'application/json' });
        await sb.storage.from('orders').upload(`greeting-card/${slug}/meta.json`, metaBlob, { contentType:'application/json', upsert:true });

        const shareUrl = `${window.location.origin}/gc.html?id=${slug}`;
        const urlInput = document.getElementById('gcShareUrl');
        if (urlInput) urlInput.value = shareUrl;
        if (progressEl) progressEl.style.display = 'none';
        if (result) result.style.display = 'block';
    } catch(e) {
        console.error('Share error:', e);
        if (progressEl) progressEl.innerHTML = `<p style="color:#ef4444; font-size:14px;">공유 중 오류가 발생했습니다: ${e.message}</p>`;
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

/* ═══════════════════════════════════════════
   9. DOWNLOAD AS ANIMATED GIF
   ═══════════════════════════════════════════ */
function _loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function downloadCardAsGif() {
    // Show progress overlay
    let overlay = document.getElementById('gcGifOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gcGifOverlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:50000; background:rgba(0,0,0,0.7); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif;';
        overlay.innerHTML = `
            <div style="background:#1e293b; border-radius:20px; padding:30px 40px; text-align:center; max-width:320px;">
                <div id="gcGifSpinner" style="font-size:36px; margin-bottom:16px;">🎬</div>
                <div id="gcGifStatus" style="font-size:15px; font-weight:700; margin-bottom:8px;">GIF 생성 중...</div>
                <div id="gcGifProgress" style="font-size:12px; color:#94a3b8;">라이브러리 로딩 중...</div>
                <div style="margin-top:16px; width:100%; height:6px; background:#334155; border-radius:3px; overflow:hidden;">
                    <div id="gcGifBar" style="height:100%; background:linear-gradient(90deg,#14b8a6,#06b6d4); width:0%; transition:width 0.3s;"></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    const statusEl = document.getElementById('gcGifStatus');
    const progressEl = document.getElementById('gcGifProgress');
    const barEl = document.getElementById('gcGifBar');
    const setProgress = (pct, msg) => { if (barEl) barEl.style.width = pct + '%'; if (progressEl) progressEl.textContent = msg; };

    try {
        // 1. Load libraries
        setProgress(5, '라이브러리 로딩 중...');
        await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js');

        // 2. Capture card data
        setProgress(10, '카드 캡처 중...');
        const data = _captureCardData();
        if (!data || !data.imageUrl) throw new Error('카드 캡처 실패');

        // 3. Create hidden render container
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed; left:-9999px; top:0; z-index:-1;';
        const frame = document.createElement('div');
        frame.style.cssText = 'position:relative; width:360px; height:640px; overflow:hidden; background:#000;';
        const imgEl = document.createElement('img');
        imgEl.src = data.imageUrl;
        imgEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        frame.appendChild(imgEl);

        // Add animation overlays
        const animLayer = document.createElement('div');
        animLayer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden;';
        _renderPreviewAnimations(animLayer, data.stickers, data.category);
        frame.appendChild(animLayer);
        container.appendChild(frame);
        document.body.appendChild(container);

        // Wait for image + animations to initialize
        await new Promise(r => { imgEl.onload = r; setTimeout(r, 500); });
        await new Promise(r => setTimeout(r, 800));

        setProgress(15, '프레임 캡처 시작...');
        if (statusEl) statusEl.textContent = '프레임 캡처 중...';

        // 4. Create GIF encoder
        const gif = new GIF({
            workers: 2,
            quality: 8,
            width: 360,
            height: 640,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
        });

        // 5. Capture frames (25 frames, ~2.5 seconds of animation)
        const TOTAL_FRAMES = 25;
        const FRAME_DELAY = 100; // ms between frames
        for (let i = 0; i < TOTAL_FRAMES; i++) {
            const pct = 15 + Math.round((i / TOTAL_FRAMES) * 65);
            setProgress(pct, `프레임 ${i + 1}/${TOTAL_FRAMES} 캡처 중...`);
            const cvs = await html2canvas(frame, {
                width: 360,
                height: 640,
                scale: 1,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });
            gif.addFrame(cvs, { delay: FRAME_DELAY, copy: true });
            await new Promise(r => setTimeout(r, FRAME_DELAY));
        }

        // 6. Render GIF
        setProgress(80, 'GIF 인코딩 중...');
        if (statusEl) statusEl.textContent = 'GIF 생성 중...';

        const blob = await new Promise((resolve, reject) => {
            gif.on('finished', resolve);
            gif.on('error', reject);
            gif.render();
        });

        // 7. Download
        setProgress(100, '다운로드 중...');
        if (statusEl) statusEl.textContent = '완료!';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `greeting-card-${Date.now()}.gif`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);

        // Cleanup
        container.remove();
        setTimeout(() => { overlay.style.display = 'none'; }, 1500);

    } catch (e) {
        console.error('GIF generation error:', e);
        if (statusEl) statusEl.textContent = '오류 발생';
        if (progressEl) progressEl.textContent = e.message;
        setTimeout(() => { overlay.style.display = 'none'; }, 3000);
    }
}

/* ═══ Export animation generators for gc.html (also used in preview) ═══ */
export {
    ANIM_STICKERS,
    _getCategoryColors,
    _createStickerAnimation,
    _ensureKeyframe,
    _animFireworks, _animHearts, _animSnow, _animConfetti, _animSparkle,
    _animBow, _animBalloon, _animFlower, _animStar, _animFire,
};
