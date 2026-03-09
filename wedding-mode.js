/* ═══ Wedding Invitation Mode v1 ═══ */
import { pageDataList, currentPageIndex, goToPage, addNewPage, deleteCurrentPage } from "./canvas-pages.js?v=123";
import { canvas } from "./canvas-core.js?v=123";

const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

/* ─── Constants ─── */
const CUSTOM_PROPS = ['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst','isWedPlaceholder','isWedPlaceholderText','wedPlaceholderId'];

/* ─── Wedding Section Templates ─── */
const WEDDING_TEMPLATES = {
    cover: {
        name: _t('wed_tpl_cover','표지'), icon: 'fa-heart',
        build(w, h) {
            return [
                // 상단 장식
                { type:'textbox', text:'♥', left:w*0.42, top:h*0.08, width:w*0.16,
                  fontSize:Math.round(h*0.04), fontFamily:'Georgia, serif',
                  fill:'#d4a373', textAlign:'center' },
                // 타이틀
                { type:'textbox', text:_t('wed_we_marry','저희 결혼합니다'), left:w*0.1, top:h*0.15, width:w*0.8,
                  fontSize:Math.round(h*0.035), fontFamily:'Georgia, serif', fontWeight:'300',
                  fill:'#8b5e3c', textAlign:'center' },
                // 이미지 영역
                { type:'rect', left:w*0.1, top:h*0.25, width:w*0.8, height:h*0.35,
                  fill:'#f5e6d3', rx:16, ry:16, stroke:'#d4a373', strokeWidth:2, selectable:true, evented:true,
                  isWedPlaceholder:true, wedPlaceholderId:'cover_main' },
                { type:'textbox', text:_t('wed_photo_here','사진을 넣어주세요'), left:w*0.2, top:h*0.4, width:w*0.6,
                  fontSize:Math.round(h*0.022), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center', editable:false,
                  isWedPlaceholderText:true, wedPlaceholderId:'cover_main' },
                // 신랑 ♥ 신부
                { type:'textbox', text:_t('wed_groom','신랑'), left:w*0.1, top:h*0.67, width:w*0.3,
                  fontSize:Math.round(h*0.032), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#5c4033', textAlign:'center' },
                { type:'textbox', text:'♥', left:w*0.38, top:h*0.67, width:w*0.24,
                  fontSize:Math.round(h*0.04), fontFamily:'Georgia, serif',
                  fill:'#ec4899', textAlign:'center' },
                { type:'textbox', text:_t('wed_bride','신부'), left:w*0.6, top:h*0.67, width:w*0.3,
                  fontSize:Math.round(h*0.032), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#5c4033', textAlign:'center' },
                // 날짜
                { type:'textbox', text:'2026. 00. 00', left:w*0.15, top:h*0.78, width:w*0.7,
                  fontSize:Math.round(h*0.024), fontFamily:'Georgia, serif',
                  fill:'#8b5e3c', textAlign:'center', letterSpacing:200 },
                // 장소
                { type:'textbox', text:_t('wed_venue_name','예식장소'), left:w*0.15, top:h*0.85, width:w*0.7,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#a07855', textAlign:'center' },
                // 하단 장식
                { type:'textbox', text:'~ ♥ ~', left:w*0.35, top:h*0.92, width:w*0.3,
                  fontSize:Math.round(h*0.018), fontFamily:'Georgia, serif',
                  fill:'#d4a373', textAlign:'center' }
            ];
        }
    },
    gallery: {
        name: _t('wed_tpl_gallery','갤러리'), icon: 'fa-images',
        build(w, h) {
            return [
                // 제목
                { type:'textbox', text:_t('wed_gallery_title','Our Moments'), left:w*0.1, top:h*0.06, width:w*0.8,
                  fontSize:Math.round(h*0.03), fontFamily:'Georgia, serif', fontWeight:'300',
                  fill:'#8b5e3c', textAlign:'center' },
                // 장식 라인
                { type:'rect', left:w*0.35, top:h*0.13, width:w*0.3, height:2,
                  fill:'#d4a373', selectable:true, evented:true },
                // 메인 이미지 영역
                { type:'rect', left:w*0.08, top:h*0.18, width:w*0.84, height:h*0.4,
                  fill:'#f5e6d3', rx:12, ry:12, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true,
                  isWedPlaceholder:true, wedPlaceholderId:'gallery_main' },
                { type:'textbox', text:_t('wed_drag_photo','사진을 넣어주세요'), left:w*0.25, top:h*0.36, width:w*0.5,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center', editable:false,
                  isWedPlaceholderText:true, wedPlaceholderId:'gallery_main' },
                // 서브 이미지 2개
                { type:'rect', left:w*0.08, top:h*0.62, width:w*0.4, height:h*0.25,
                  fill:'#f5e6d3', rx:10, ry:10, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true,
                  isWedPlaceholder:true, wedPlaceholderId:'gallery_sub1' },
                { type:'rect', left:w*0.52, top:h*0.62, width:w*0.4, height:h*0.25,
                  fill:'#f5e6d3', rx:10, ry:10, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true,
                  isWedPlaceholder:true, wedPlaceholderId:'gallery_sub2' },
                // 캡션
                { type:'textbox', text:_t('wed_caption','우리의 아름다운 순간들'), left:w*0.15, top:h*0.9, width:w*0.7,
                  fontSize:Math.round(h*0.016), fontFamily:'Georgia, serif', fontWeight:'300',
                  fill:'#a07855', textAlign:'center' }
            ];
        }
    },
    calendar: {
        name: _t('wed_tpl_calendar','캘린더'), icon: 'fa-calendar-days',
        build(w, h) {
            return [
                // 장식
                { type:'textbox', text:'♥', left:w*0.44, top:h*0.06, width:w*0.12,
                  fontSize:Math.round(h*0.025), fontFamily:'Georgia, serif',
                  fill:'#ec4899', textAlign:'center' },
                // 제목
                { type:'textbox', text:_t('wed_date_title','예식 일시'), left:w*0.1, top:h*0.12, width:w*0.8,
                  fontSize:Math.round(h*0.03), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#5c4033', textAlign:'center' },
                // 날짜 크게
                { type:'textbox', text:'2026', left:w*0.2, top:h*0.22, width:w*0.6,
                  fontSize:Math.round(h*0.055), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#d4a373', textAlign:'center' },
                { type:'textbox', text:'00월 00일 토요일', left:w*0.15, top:h*0.32, width:w*0.7,
                  fontSize:Math.round(h*0.028), fontFamily:'Georgia, serif',
                  fill:'#8b5e3c', textAlign:'center' },
                // 시간
                { type:'textbox', text:_t('wed_time','오후 0시 0분'), left:w*0.2, top:h*0.39, width:w*0.6,
                  fontSize:Math.round(h*0.024), fontFamily:'Georgia, serif',
                  fill:'#a07855', textAlign:'center' },
                // 구분선
                { type:'rect', left:w*0.25, top:h*0.47, width:w*0.5, height:2,
                  fill:'#d4a373', selectable:true, evented:true },
                // D-day 카운트
                { type:'textbox', text:'D - DAY', left:w*0.2, top:h*0.52, width:w*0.6,
                  fontSize:Math.round(h*0.04), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#ec4899', textAlign:'center' },
                // 달력 플레이스홀더
                { type:'rect', left:w*0.1, top:h*0.62, width:w*0.8, height:h*0.28,
                  fill:'#fdf2f8', rx:12, ry:12, stroke:'#f9a8d4', strokeWidth:1, selectable:true, evented:true,
                  isWedPlaceholder:true, wedPlaceholderId:'calendar_img' },
                { type:'textbox', text:_t('wed_calendar_note','달력을 이미지로\n추가해주세요'), left:w*0.25, top:h*0.73, width:w*0.5,
                  fontSize:Math.round(h*0.018), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center', editable:false,
                  isWedPlaceholderText:true, wedPlaceholderId:'calendar_img' }
            ];
        }
    },
    venue: {
        name: _t('wed_tpl_venue','오시는 길'), icon: 'fa-location-dot',
        build(w, h) {
            return [
                // 제목
                { type:'textbox', text:_t('wed_location_title','오시는 길'), left:w*0.1, top:h*0.06, width:w*0.8,
                  fontSize:Math.round(h*0.03), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#5c4033', textAlign:'center' },
                // 장식 라인
                { type:'rect', left:w*0.3, top:h*0.13, width:w*0.4, height:2,
                  fill:'#d4a373', selectable:true, evented:true },
                // 장소명
                { type:'textbox', text:_t('wed_hall_name','○○○ 웨딩홀'), left:w*0.1, top:h*0.18, width:w*0.8,
                  fontSize:Math.round(h*0.026), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#8b5e3c', textAlign:'center' },
                // 주소
                { type:'textbox', text:_t('wed_address','서울특별시 ○○구 ○○로 000'), left:w*0.08, top:h*0.24, width:w*0.84,
                  fontSize:Math.round(h*0.018), fontFamily:'Georgia, serif',
                  fill:'#a07855', textAlign:'center' },
                // 연락처
                { type:'textbox', text:_t('wed_tel','TEL. 02-000-0000'), left:w*0.2, top:h*0.29, width:w*0.6,
                  fontSize:Math.round(h*0.016), fontFamily:'Georgia, serif',
                  fill:'#b08968', textAlign:'center' },
                // 지도 영역
                { type:'rect', left:w*0.08, top:h*0.36, width:w*0.84, height:h*0.35,
                  fill:'#f0ebe3', rx:12, ry:12, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true,
                  isWedPlaceholder:true, wedPlaceholderId:'venue_map' },
                { type:'textbox', text:_t('wed_map_placeholder','지도 이미지를\n넣어주세요'), left:w*0.25, top:h*0.5, width:w*0.5,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center', editable:false,
                  isWedPlaceholderText:true, wedPlaceholderId:'venue_map' },
                // 교통편
                { type:'textbox',
                  text:_t('wed_transport','지하철\n○호선 ○○역 0번출구 도보 0분\n\n버스\n○○번, ○○번 ○○○ 정류장 하차\n\n주차\n건물 내 지하주차장 이용 가능'),
                  left:w*0.08, top:h*0.76, width:w*0.84,
                  fontSize:Math.round(h*0.015), fontFamily:'Georgia, serif',
                  fill:'#8b7355', textAlign:'center', lineHeight:1.6 }
            ];
        }
    },
    blank: {
        name: _t('wed_tpl_blank','빈 페이지'), icon: 'fa-square',
        build() { return []; }
    }
};

/* ─── Photo Layout Templates (2/3/4 photo arrangements) ─── */
const PHOTO_LAYOUTS = {
    p2_vert: {
        name: '2장 세로', icon: 'fa-grip-lines',
        preview: '▯\n▯',
        build(w, h) {
            const m = w * 0.05, g = h * 0.02;
            const pw = w - m * 2, ph = (h - m * 2 - g) / 2;
            return [
                { left: m, top: m, width: pw, height: ph, rx: 12, ry: 12 },
                { left: m, top: m + ph + g, width: pw, height: ph, rx: 12, ry: 12 }
            ];
        }
    },
    p2_horiz: {
        name: '2장 가로', icon: 'fa-grip-lines-vertical',
        preview: '▯ ▯',
        build(w, h) {
            const m = w * 0.05, g = w * 0.03;
            const pw = (w - m * 2 - g) / 2, ph = h - m * 2;
            return [
                { left: m, top: m, width: pw, height: ph, rx: 12, ry: 12 },
                { left: m + pw + g, top: m, width: pw, height: ph, rx: 12, ry: 12 }
            ];
        }
    },
    p2_big_small: {
        name: '2장 크게+작게', icon: 'fa-table-cells',
        preview: '▯▯\n▯▯\n  ▯',
        build(w, h) {
            const m = w * 0.05, g = h * 0.02;
            return [
                { left: m, top: m, width: w - m * 2, height: h * 0.62, rx: 12, ry: 12 },
                { left: w * 0.2, top: m + h * 0.62 + g, width: w * 0.6, height: h * 0.3, rx: 12, ry: 12 }
            ];
        }
    },
    p3_top1_bot2: {
        name: '3장 1+2', icon: 'fa-th-large',
        preview: '▯▯▯\n▯ ▯',
        build(w, h) {
            const m = w * 0.05, g = w * 0.03;
            const topH = h * 0.48, botH = h * 0.44;
            const botW = (w - m * 2 - g) / 2;
            return [
                { left: m, top: m, width: w - m * 2, height: topH, rx: 12, ry: 12 },
                { left: m, top: m + topH + g, width: botW, height: botH, rx: 10, ry: 10 },
                { left: m + botW + g, top: m + topH + g, width: botW, height: botH, rx: 10, ry: 10 }
            ];
        }
    },
    p3_vert: {
        name: '3장 세로', icon: 'fa-bars',
        preview: '▯\n▯\n▯',
        build(w, h) {
            const m = w * 0.05, g = h * 0.02;
            const ph = (h - m * 2 - g * 2) / 3;
            return [
                { left: m, top: m, width: w - m * 2, height: ph, rx: 10, ry: 10 },
                { left: m, top: m + ph + g, width: w - m * 2, height: ph, rx: 10, ry: 10 },
                { left: m, top: m + (ph + g) * 2, width: w - m * 2, height: ph, rx: 10, ry: 10 }
            ];
        }
    },
    p3_left1_right2: {
        name: '3장 좌1우2', icon: 'fa-columns',
        preview: '▯ ▯\n▯ ▯',
        build(w, h) {
            const m = w * 0.05, g = w * 0.03, gv = h * 0.02;
            const leftW = (w - m * 2 - g) * 0.55, rightW = (w - m * 2 - g) * 0.45;
            const rh = (h - m * 2 - gv) / 2;
            return [
                { left: m, top: m, width: leftW, height: h - m * 2, rx: 12, ry: 12 },
                { left: m + leftW + g, top: m, width: rightW, height: rh, rx: 10, ry: 10 },
                { left: m + leftW + g, top: m + rh + gv, width: rightW, height: rh, rx: 10, ry: 10 }
            ];
        }
    },
    p4_grid: {
        name: '4장 격자', icon: 'fa-border-all',
        preview: '▯ ▯\n▯ ▯',
        build(w, h) {
            const m = w * 0.05, gx = w * 0.03, gy = h * 0.02;
            const cw = (w - m * 2 - gx) / 2, ch = (h - m * 2 - gy) / 2;
            return [
                { left: m, top: m, width: cw, height: ch, rx: 10, ry: 10 },
                { left: m + cw + gx, top: m, width: cw, height: ch, rx: 10, ry: 10 },
                { left: m, top: m + ch + gy, width: cw, height: ch, rx: 10, ry: 10 },
                { left: m + cw + gx, top: m + ch + gy, width: cw, height: ch, rx: 10, ry: 10 }
            ];
        }
    },
    p4_top1_bot3: {
        name: '4장 1+3', icon: 'fa-table-cells-large',
        preview: '▯▯▯\n▯ ▯ ▯',
        build(w, h) {
            const m = w * 0.05, gx = w * 0.025, gy = h * 0.02;
            const topH = h * 0.48, botH = h * 0.44;
            const botW = (w - m * 2 - gx * 2) / 3;
            return [
                { left: m, top: m, width: w - m * 2, height: topH, rx: 12, ry: 12 },
                { left: m, top: m + topH + gy, width: botW, height: botH, rx: 8, ry: 8 },
                { left: m + botW + gx, top: m + topH + gy, width: botW, height: botH, rx: 8, ry: 8 },
                { left: m + (botW + gx) * 2, top: m + topH + gy, width: botW, height: botH, rx: 8, ry: 8 }
            ];
        }
    }
};

/* ─── State ─── */
let thumbCache = {};
let _wedThumbCache = []; // cached thumbnail data URLs
let previewState = { pages:[], scrollContainer:null };

/* ═══════════════════════════════════════════
   1. INITIALIZATION
   ═══════════════════════════════════════════ */
export function initWeddingMode() {
    document.body.classList.add('wedding-mode');
    // Watch page counter changes to re-render slide panel from cache (lightweight)
    const pc = document.getElementById('pageCounter');
    if (pc) {
        const obs = new MutationObserver(() => {
            if (window.__WEDDING_MODE) {
                clearTimeout(window.__wedThumbTimer);
                window.__wedThumbTimer = setTimeout(() => _renderThumbsFromCache(), 200);
            }
        });
        obs.observe(pc, { childList:true, characterData:true, subtree:true });
    }

    // expose to window
    window.weddingActivatePanel = activateSlidePanel;
    window.weddingInitPages = initDefaultPages;
    window.weddingDuplicateSlide = duplicateSlide;
    window.weddingDeleteSlide = weddingDeleteSlide;
    window.weddingPreview = openWeddingPreview;
    window.weddingClosePreview = closeWeddingPreview;
    window.weddingApplyTemplate = applyTemplate;
    window.weddingGoToSlide = weddingGoToSlide;
    window.weddingShowTemplates = showTemplateModal;
    window.weddingHideTemplates = hideTemplateModal;
    window.renderWeddingThumbs = renderSlideThumbs;
    window.openWeddingWizard = openWeddingWizard;
    window.handleWeddingPhotos = handleWeddingPhotos;
    window.runWeddingGeneration = runWeddingGeneration;
    window._wedRemovePhoto = _wedRemovePhoto;
    window.shareWeddingInvitation = shareWeddingInvitation;

    /* ─── Placeholder click-to-upload handler ─── */
    setupPlaceholderUpload();

    /* ─── Mobile: 하단 페이지 네비게이터 ─── */
    if (window.innerWidth <= 768) {
        _createMobileWedNav();
    }

    console.log('✅ Wedding Mode initialized');
}

/* ═══ Mobile Wedding Page Navigator ═══ */
function _createMobileWedNav() {
    if (document.getElementById('wedMobileNav')) return;
    const nav = document.createElement('div');
    nav.id = 'wedMobileNav';
    nav.style.cssText = 'position:fixed; bottom:0; left:0; right:0; z-index:9500; background:#fff; border-top:2px solid #f9a8d4; padding:6px 10px; display:flex; align-items:center; justify-content:space-between; gap:6px; box-shadow:0 -2px 10px rgba(0,0,0,0.1);';
    nav.innerHTML = `
        <button onclick="window.weddingGoToSlide(Math.max(0, (window._getPageIndex?window._getPageIndex():0)-1))" style="width:36px;height:36px;border:1px solid #f9a8d4;border-radius:8px;background:#fff;color:#ec4899;font-size:16px;cursor:pointer;flex-shrink:0;"><i class="fa-solid fa-chevron-left"></i></button>
        <div id="wedMobileSlideStrip" style="flex:1;display:flex;gap:6px;overflow-x:auto;padding:2px 0;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;"></div>
        <button onclick="window.weddingGoToSlide(Math.min((window.__pageDataList||[]).length-1, (window._getPageIndex?window._getPageIndex():0)+1))" style="width:36px;height:36px;border:1px solid #f9a8d4;border-radius:8px;background:#fff;color:#ec4899;font-size:16px;cursor:pointer;flex-shrink:0;"><i class="fa-solid fa-chevron-right"></i></button>
        <div style="display:flex;gap:4px;flex-shrink:0;">
            <button onclick="window.addPage()" style="width:36px;height:36px;border:1px solid #f9a8d4;border-radius:8px;background:#fdf2f8;color:#ec4899;font-size:14px;cursor:pointer;" title="추가"><i class="fa-solid fa-plus"></i></button>
            <button onclick="window.weddingShowTemplates()" style="width:36px;height:36px;border:1px solid #d4a373;border-radius:8px;background:#fffbeb;color:#d4a373;font-size:14px;cursor:pointer;" title="템플릿"><i class="fa-solid fa-table-cells-large"></i></button>
            <button onclick="window.weddingPreview()" style="width:36px;height:36px;border:1px solid #f9a8d4;border-radius:8px;background:#fdf2f8;color:#ec4899;font-size:14px;cursor:pointer;" title="미리보기"><i class="fa-solid fa-eye"></i></button>
        </div>
    `;
    document.body.appendChild(nav);
    _updateMobileSlideStrip();
}

function _updateMobileSlideStrip() {
    const strip = document.getElementById('wedMobileSlideStrip');
    if (!strip) return;
    const pages = window.__pageDataList || pageDataList;
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;
    strip.innerHTML = '';
    for (let i = 0; i < pages.length; i++) {
        const thumb = _wedThumbCache[i] || null;
        const isActive = i === curIdx;
        const el = document.createElement('div');
        el.style.cssText = `flex-shrink:0; width:36px; height:64px; border-radius:4px; overflow:hidden; cursor:pointer; border:2px solid ${isActive?'#ec4899':'#e2e8f0'}; background:${isActive?'#fdf2f8':'#f8fafc'}; scroll-snap-align:center;`;
        el.innerHTML = thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8;font-weight:bold;">${i+1}</div>`;
        el.onclick = () => window.weddingGoToSlide(i);
        strip.appendChild(el);
    }
    // active 슬라이드를 중앙에 스크롤
    const activeEl = strip.children[curIdx];
    if (activeEl) setTimeout(() => activeEl.scrollIntoView({ inline:'center', behavior:'smooth' }), 50);
}

/* ═══════════════════════════════════════════
   1-B. PLACEHOLDER CLICK-TO-UPLOAD
   ═══════════════════════════════════════════ */
let _wedUploadTarget = null; // placeholder rect being replaced

function setupPlaceholderUpload() {
    // create a hidden file input dedicated to wedding placeholders
    let inp = document.getElementById('wedPlaceholderUpload');
    if (!inp) {
        inp = document.createElement('input');
        inp.id = 'wedPlaceholderUpload';
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        document.body.appendChild(inp);
    }

    inp.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file || !_wedUploadTarget) { _wedUploadTarget = null; return; }
        replacePlaceholderWithImage(file, _wedUploadTarget);
        _wedUploadTarget = null;
        inp.value = '';
    });

    // listen for click on canvas placeholders
    const checkCanvas = setInterval(() => {
        if (!canvas) return;
        clearInterval(checkCanvas);

        canvas.on('mouse:down', function (opt) {
            if (!window.__WEDDING_MODE) return;
            const target = opt.target;
            if (!target) return;

            // clicked a placeholder rect?
            if (target.isWedPlaceholder) {
                _wedUploadTarget = target;
                setTimeout(() => {
                    canvas.discardActiveObject();
                    canvas.requestRenderAll();
                    document.getElementById('wedPlaceholderUpload').click();
                }, 50);
                return;
            }
            // clicked the placeholder text?
            if (target.isWedPlaceholderText) {
                const rect = canvas.getObjects().find(o => o.isWedPlaceholder && o.wedPlaceholderId === target.wedPlaceholderId);
                if (rect) {
                    _wedUploadTarget = rect;
                    setTimeout(() => {
                        canvas.discardActiveObject();
                        canvas.requestRenderAll();
                        document.getElementById('wedPlaceholderUpload').click();
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

            // ensure coords are fresh
            placeholderRect.setCoords();
            const center = placeholderRect.getCenterPoint();
            const pW = placeholderRect.width * (placeholderRect.scaleX || 1);
            const pH = placeholderRect.height * (placeholderRect.scaleY || 1);
            const pRx = placeholderRect.rx || 0;
            const pRy = placeholderRect.ry || 0;

            // scale to cover (fill) the placeholder area
            const scale = Math.max(pW / fabricImg.width, pH / fabricImg.height);
            fabricImg.set({
                scaleX: scale,
                scaleY: scale,
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center'
            });

            // clip to placeholder shape (absolutePositioned: true for canvas-space clipping)
            fabricImg.clipPath = new fabric.Rect({
                width: pW,
                height: pH,
                rx: pRx,
                ry: pRy,
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center',
                absolutePositioned: true
            });

            // remove placeholder rect + its text label
            const phId = placeholderRect.wedPlaceholderId;
            const textLabel = canvas.getObjects().find(o => o.isWedPlaceholderText && o.wedPlaceholderId === phId);
            canvas.remove(placeholderRect);
            if (textLabel) canvas.remove(textLabel);

            // add image
            canvas.add(fabricImg);
            canvas.bringToFront(fabricImg);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
        };
    };
    reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════════
   2. DEFAULT PAGES (첫 진입 시 3페이지)
   ═══════════════════════════════════════════ */
let _wedInitCancelled = false;

function initDefaultPages() {
    if (!window.__WEDDING_MODE || !canvas) return;
    if (_wedInitCancelled) return;
    // 이미 페이지가 1개 이상 있고, 첫 진입 여부 확인
    if (pageDataList.length > 1) return;

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    // 보드 배경을 아이보리로
    board.set({ fill: '#fdf2f8' });
    canvas.requestRenderAll();

    // 첫 페이지(cover) 적용
    applyTemplateToCanvas('cover');

    // 2페이지: greeting
    if (window.addPage) window.addPage();
    setTimeout(() => {
        if (_wedInitCancelled) return;
        const b2 = canvas.getObjects().find(o => o.isBoard);
        if (b2) b2.set({ fill: '#fdf2f8' });
        applyTemplateToCanvas('greeting');

        // 3페이지: gallery
        if (window.addPage) window.addPage();
        setTimeout(() => {
            if (_wedInitCancelled) return;
            const b3 = canvas.getObjects().find(o => o.isBoard);
            if (b3) b3.set({ fill: '#fdf2f8' });
            applyTemplateToCanvas('gallery');

            // 1페이지로 돌아가기
            setTimeout(() => {
                if (_wedInitCancelled) return;
                goToPage(0);
                setTimeout(() => renderSlideThumbs(), 400);
            }, 200);
        }, 300);
    }, 300);
}

/* ═══════════════════════════════════════════
   3. SLIDE PANEL (좌측 사이드바)
   ═══════════════════════════════════════════ */
function activateSlidePanel() {
    const pageBtn = document.querySelector('#iconBar .icon-item[data-panel="sub-page"]');
    if (pageBtn) pageBtn.click();

    setTimeout(() => {
        const subPage = document.getElementById('sub-page');
        if (!subPage) return;

        subPage.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:0 2px 10px; border-bottom:1px solid #f9a8d4; margin-bottom:10px;">
                <span style="font-weight:800; font-size:14px; color:#1e293b;"><i class="fa-solid fa-heart" style="color:#ec4899; margin-right:4px;"></i>${_t('wed_pages','페이지')}</span>
                <div style="display:flex; gap:4px;">
                    <button onclick="window.addPage()" title="${_t('wed_add_page','페이지 추가')}" style="width:30px; height:30px; border:1px solid #f9a8d4; border-radius:6px; background:#fff; cursor:pointer; font-size:13px; color:#ec4899;"><i class="fa-solid fa-plus"></i></button>
                    <button onclick="window.weddingDuplicateSlide()" title="${_t('wed_duplicate','복제')}" style="width:30px; height:30px; border:1px solid #f9a8d4; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#ec4899;"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="window.weddingShowTemplates()" title="${_t('wed_templates','섹션 템플릿')}" style="width:30px; height:30px; border:1px solid #f9a8d4; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#d4a373;"><i class="fa-solid fa-table-cells-large"></i></button>
                    <button onclick="window.weddingPreview()" title="${_t('wed_preview','미리보기')}" style="width:30px; height:30px; border:1px solid #f9a8d4; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#ec4899;"><i class="fa-solid fa-eye"></i></button>
                </div>
            </div>
            <div id="weddingSlideList" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; max-height:calc(100vh - 320px);"></div>
        `;

        renderSlideThumbs();
    }, 100);
}

/* ═══════════════════════════════════════════
   4. THUMBNAILS
   ═══════════════════════════════════════════ */
/* Promise timeout helper — prevents loadFromJSON from hanging forever */
function _withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);
}

async function generateThumbnail(pageIndex) {
    const pageJson = pageDataList[pageIndex];
    if (!pageJson) return null;

    const board = (pageJson.objects || []).find(o => o.isBoard);
    const bw = board ? (board.width * (board.scaleX || 1)) : 1080;
    const bh = board ? (board.height * (board.scaleY || 1)) : 1920;
    const bx = board ? (board.left || 0) : 0;
    const by = board ? (board.top || 0) : 0;

    const thumbW = 120;
    const thumbScale = thumbW / bw;
    const thumbH = Math.round(bh * thumbScale);

    const tmpEl = document.createElement('canvas');
    tmpEl.width = thumbW; tmpEl.height = thumbH;
    const tmpCanvas = new fabric.StaticCanvas(tmpEl);
    tmpCanvas.setWidth(thumbW); tmpCanvas.setHeight(thumbH);
    tmpCanvas.setBackgroundColor('#fdf2f8');

    const inner = new Promise(resolve => {
        try {
            tmpCanvas.loadFromJSON(pageJson, () => {
                tmpCanvas.setViewportTransform([thumbScale, 0, 0, thumbScale, -bx * thumbScale, -by * thumbScale]);
                tmpCanvas.getObjects().forEach(obj => {
                    if (obj.isMockup || obj.excludeFromExport || obj.isGuide) tmpCanvas.remove(obj);
                });
                tmpCanvas.renderAll();
                setTimeout(() => {
                    try {
                        const dataUrl = tmpCanvas.toDataURL({ format:'jpeg', quality:0.7 });
                        tmpCanvas.dispose();
                        resolve(dataUrl);
                    } catch(e) { tmpCanvas.dispose(); resolve(null); }
                }, 150);
            });
        } catch(e) { try { tmpCanvas.dispose(); } catch(_){} resolve(null); }
    });
    return _withTimeout(inner, 6000);
}

async function renderSlideThumbs() {
    if (!window.__WEDDING_MODE) return;
    if (window.savePageState) window.savePageState();

    // Full capture of all pages (called after generation, page add/delete)
    const thumbs = await _captureAllPages(0.2);
    _wedThumbCache = thumbs;
    _renderThumbsFromCache();
}

/* Lightweight: re-render slide panel from cached thumbnails */
function _renderThumbsFromCache() {
    const container = document.getElementById('weddingSlideList');
    if (!container) return;
    const pages = window.__pageDataList || pageDataList;
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;

    container.innerHTML = '';
    for (let i = 0; i < pages.length; i++) {
        const thumbUrl = _wedThumbCache[i] || null;
        const isActive = i === curIdx;

        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding:6px; border-radius:8px; cursor:pointer; border:2px solid ' + (isActive ? '#ec4899' : 'transparent') + '; background:' + (isActive ? '#fdf2f8' : 'transparent') + '; transition:all 0.15s; position:relative;';
        div.onclick = () => weddingGoToSlide(i);
        div.onmouseenter = () => { const a = div.querySelector('.wed-sl-act'); if(a) a.style.display='flex'; };
        div.onmouseleave = () => { const a = div.querySelector('.wed-sl-act'); if(a) a.style.display='none'; };

        div.innerHTML = `
            <span style="font-size:11px; font-weight:700; color:${isActive?'#ec4899':'#94a3b8'}; min-width:18px; text-align:center; padding-top:4px;">${i+1}</span>
            <div style="flex:1; border-radius:4px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); aspect-ratio:9/16; background:#fdf2f8;">
                ${thumbUrl ? '<img src="'+thumbUrl+'" style="width:100%; height:100%; object-fit:cover; display:block;" draggable="false">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#d4a373;font-size:11px;">'+(i+1)+'</div>'}
            </div>
            <div class="wed-sl-act" style="display:none; position:absolute; top:4px; right:4px; gap:2px;">
                <button onclick="event.stopPropagation(); window.weddingDuplicateSlide(${i})" title="${_t('wed_duplicate','복제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-copy"></i></button>
                <button onclick="event.stopPropagation(); window.weddingDeleteSlide(${i})" title="${_t('wed_delete','삭제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(239,68,68,0.8); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;" ${pages.length<=1?'disabled':''}><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    }

    const activeEl = container.querySelector('[style*="border:2px solid #ec4899"]');
    if (activeEl) activeEl.scrollIntoView({ block:'nearest', behavior:'smooth' });

    // 모바일 하단 슬라이드 스트립도 업데이트
    _updateMobileSlideStrip();
}

/* ═══════════════════════════════════════════
   5. NAVIGATION
   ═══════════════════════════════════════════ */
function weddingGoToSlide(index) {
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;
    if (index === curIdx) return;
    // Save current page + update its thumbnail before switching
    if (window.savePageState) window.savePageState();
    _updateCurrentThumbSync();
    goToPage(index);
    // Ensure slide panel updates active state after page loads
    setTimeout(() => _renderThumbsFromCache(), 400);
}

/* Synchronous quick thumbnail for the CURRENT page (before navigating away) */
function _updateCurrentThumbSync() {
    const c = canvas || window.canvas;
    if (!c || !_wedThumbCache.length) return;
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    try {
        const origVpt = c.viewportTransform.slice();
        const origW = c.getWidth(), origH = c.getHeight();
        c.setViewportTransform([1, 0, 0, 1, -board.left, -board.top]);
        c.setDimensions({ width: board.width, height: board.height });
        c.requestRenderAll();
        const url = c.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.35, enableRetinaScaling: false });
        while (_wedThumbCache.length <= curIdx) _wedThumbCache.push(null);
        _wedThumbCache[curIdx] = url;
        c.setViewportTransform(origVpt);
        c.setDimensions({ width: origW, height: origH });
    } catch(e) { /* ignore */ }
}

/* Update only the current page thumbnail without capturing all pages */
function _updateCurrentThumb() {
    const c = canvas || window.canvas;
    if (!c) return;
    const curIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;

    // Quick snapshot of the current canvas
    const origVpt = c.viewportTransform.slice();
    const origW = c.getWidth(), origH = c.getHeight();
    c.setViewportTransform([1, 0, 0, 1, -board.left, -board.top]);
    c.setDimensions({ width: board.width, height: board.height });
    c.requestRenderAll();

    setTimeout(() => {
        try {
            c.requestRenderAll();
            const url = c.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.35, enableRetinaScaling: false });
            // Update cache
            while (_wedThumbCache.length <= curIdx) _wedThumbCache.push(null);
            _wedThumbCache[curIdx] = url;
        } catch(e) { /* ignore */ }
        // Restore
        c.setViewportTransform(origVpt);
        c.setDimensions({ width: origW, height: origH });
        c.requestRenderAll();
        _renderThumbsFromCache();
    }, 150);
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

function weddingDeleteSlide(index) {
    if (pageDataList.length <= 1) return;
    if (!confirm(_t('wed_delete_confirm','이 페이지를 삭제하시겠습니까?'))) return;

    pageDataList.splice(index, 1);
    const newIdx = Math.min(index, pageDataList.length - 1);
    goToPage(newIdx);
    setTimeout(() => renderSlideThumbs(), 300);
}

/* ═══════════════════════════════════════════
   7. SECTION TEMPLATES
   ═══════════════════════════════════════════ */
function _generateLayoutPreview(layoutId) {
    const layout = PHOTO_LAYOUTS[layoutId];
    if (!layout) return '';
    const pw = 80, ph = 120; // preview size (9:16 ratio-ish)
    const cvs = document.createElement('canvas');
    cvs.width = pw; cvs.height = ph;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#fdf2f8';
    ctx.fillRect(0, 0, pw, ph);

    const slots = layout.build(pw, ph);
    slots.forEach(slot => {
        const r = Math.min(slot.rx || 0, 4);
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        const x = slot.left, y = slot.top, w = slot.width, h = slot.height;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        ctx.fill();
        // camera icon hint
        ctx.fillStyle = '#ec4899';
        const cx = x + w / 2, cy = y + h / 2;
        const sz = Math.min(w, h) * 0.2;
        ctx.font = `${sz}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', cx, cy);
    });
    return cvs.toDataURL('image/png');
}

function showTemplateModal() {
    const modal = document.getElementById('weddingTemplateModal');
    if (!modal) return;

    const grid = document.getElementById('weddingTemplateGrid');
    if (grid) {
        let html = '';

        // Section templates (compact row)
        html += '<div style="grid-column:1/-1; font-size:13px; font-weight:800; color:#5c4033; margin-bottom:2px;"><i class="fa-solid fa-bookmark" style="color:#ec4899; margin-right:4px;"></i>섹션</div>';
        Object.entries(WEDDING_TEMPLATES).forEach(([id, tpl]) => {
            html += `
                <div onclick="window.weddingApplyTemplate('${id}')" style="padding:12px 8px; border:2px solid #f9a8d4; border-radius:12px; cursor:pointer; text-align:center; transition:all 0.15s; background:#fff;"
                     onmouseenter="this.style.borderColor='#ec4899'; this.style.background='#fdf2f8';"
                     onmouseleave="this.style.borderColor='#f9a8d4'; this.style.background='#fff';">
                    <i class="fa-solid ${tpl.icon}" style="font-size:22px; color:#ec4899; margin-bottom:6px; display:block;"></i>
                    <div style="font-size:11px; font-weight:700; color:#5c4033;">${tpl.name}</div>
                </div>
            `;
        });

        // Photo layout templates with visual previews
        html += '<div style="grid-column:1/-1; font-size:13px; font-weight:800; color:#5c4033; margin:12px 0 2px; border-top:1px solid #f3e8f4; padding-top:12px;"><i class="fa-solid fa-images" style="color:#7c3aed; margin-right:4px;"></i>사진 배치</div>';
        Object.entries(PHOTO_LAYOUTS).forEach(([id, layout]) => {
            const previewImg = _generateLayoutPreview(id);
            html += `
                <div onclick="window.weddingApplyPhotoLayout('${id}')" style="padding:8px 6px; border:2px solid #e9d5ff; border-radius:12px; cursor:pointer; text-align:center; transition:all 0.15s; background:#fff;"
                     onmouseenter="this.style.borderColor='#7c3aed'; this.style.background='#f5f3ff';"
                     onmouseleave="this.style.borderColor='#e9d5ff'; this.style.background='#fff';">
                    <img src="${previewImg}" style="width:60px; height:90px; border-radius:6px; margin-bottom:4px; display:block; margin-left:auto; margin-right:auto; box-shadow:0 1px 3px rgba(0,0,0,0.1);" draggable="false">
                    <div style="font-size:10px; font-weight:700; color:#5c4033;">${layout.name}</div>
                </div>
            `;
        });

        grid.innerHTML = html;
    }

    modal.style.display = 'flex';
}

function hideTemplateModal() {
    const modal = document.getElementById('weddingTemplateModal');
    if (modal) modal.style.display = 'none';
}

async function applyTemplate(templateId) {
    hideTemplateModal();
    applyTemplateToCanvas(templateId);

    // For cover template, auto-generate a default decorative photo
    if (templateId === 'cover') {
        const board = canvas.getObjects().find(o => o.isBoard);
        if (board) {
            const w = board.width, h = board.height;
            const s = WED_STYLES.classic;
            const defPhoto = _generateDefaultCoverPhoto(w, Math.round(h * 0.35), s);
            const ph = canvas.getObjects().find(o => o.isWedPlaceholder && o.wedPlaceholderId === 'cover_main');
            if (ph) {
                const phText = canvas.getObjects().find(o => o.isWedPlaceholderText && o.wedPlaceholderId === 'cover_main');
                await _placePhotoOnCanvas(canvas, defPhoto, ph.left, ph.top, ph.width * (ph.scaleX||1), ph.height * (ph.scaleY||1), ph.rx || 0, ph.ry || 0);
                canvas.remove(ph);
                if (phText) canvas.remove(phText);
            }
        }
    }

    if (window.savePageState) window.savePageState();
    // Only update the current page thumbnail (not all pages)
    _updateCurrentThumb();
}

function applyTemplateToCanvas(templateId) {
    const tpl = WEDDING_TEMPLATES[templateId];
    if (!tpl || !canvas) return;

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width;
    const h = board.height;

    // 보드 배경 아이보리
    board.set({ fill: '#fdf2f8' });

    // 보드 제외 모든 객체 제거
    const toRemove = canvas.getObjects().filter(o => !o.isBoard);
    toRemove.forEach(o => canvas.remove(o));

    // 템플릿 객체 생성
    const objects = tpl.build(w, h);
    objects.forEach(def => {
        let obj;
        if (def.type === 'textbox') {
            const { type, text, ...props } = def;
            obj = new fabric.Textbox(text, props);
        } else if (def.type === 'rect') {
            const { type, ...props } = def;
            obj = new fabric.Rect(props);
        }
        if (obj) {
            // make placeholders look clickable
            if (def.isWedPlaceholder || def.isWedPlaceholderText) {
                obj.hoverCursor = 'pointer';
            }
            canvas.add(obj);
            canvas.bringToFront(obj);
        }
    });

    canvas.requestRenderAll();
}

/* ─── Photo Layout Application ─── */
function applyPhotoLayout(layoutId) {
    hideTemplateModal();
    const layout = PHOTO_LAYOUTS[layoutId];
    if (!layout || !canvas) return;

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height;
    const bL = board.left, bT = board.top;

    // Set board background
    board.set({ fill: '#fdf2f8' });

    // Remove all non-board objects
    canvas.getObjects().filter(o => !o.isBoard).forEach(o => canvas.remove(o));

    // Build placeholder rects for each photo slot
    const slots = layout.build(w, h);
    slots.forEach((slot, i) => {
        // Photo placeholder rect
        canvas.add(new fabric.Rect({
            left: bL + slot.left, top: bT + slot.top,
            width: slot.width, height: slot.height,
            fill: '#f5e6d3', rx: slot.rx || 0, ry: slot.ry || 0,
            stroke: '#d4a373', strokeWidth: 2,
            selectable: true, evented: true,
            isWedPlaceholder: true, wedPlaceholderId: `layout_${layoutId}_${i}`,
            hoverCursor: 'pointer'
        }));
        // Placeholder text
        canvas.add(new fabric.Textbox(_t('wed_photo_here','사진을 넣어주세요'), {
            left: bL + slot.left + slot.width * 0.1, top: bT + slot.top + slot.height / 2 - 10,
            width: slot.width * 0.8,
            fontSize: Math.round(Math.min(slot.width, slot.height) * 0.06),
            fontFamily: 'Georgia, serif', fill: '#c4a07a',
            textAlign: 'center', editable: false,
            isWedPlaceholderText: true, wedPlaceholderId: `layout_${layoutId}_${i}`,
            hoverCursor: 'pointer'
        }));
    });

    canvas.requestRenderAll();
    if (window.savePageState) window.savePageState();
    // Only update the current page thumbnail (not all pages)
    _updateCurrentThumb();
}
window.weddingApplyPhotoLayout = applyPhotoLayout;

/* ═══════════════════════════════════════════
   8. VERTICAL SCROLL PREVIEW
   ═══════════════════════════════════════════ */
async function renderPageToImage(index) {
    const pageJson = pageDataList[index];
    if (!pageJson) return null;

    const board = (pageJson.objects || []).find(o => o.isBoard);
    const bw = board ? board.width * (board.scaleX || 1) : 1080;
    const bh = board ? board.height * (board.scaleY || 1) : 1920;
    const bx = board ? (board.left || 0) : 0;
    const by = board ? (board.top || 0) : 0;

    const scale = 2;
    const tmpEl = document.createElement('canvas');
    tmpEl.width = bw * scale; tmpEl.height = bh * scale;
    const tmpCanvas = new fabric.StaticCanvas(tmpEl);
    tmpCanvas.setWidth(bw * scale); tmpCanvas.setHeight(bh * scale);
    tmpCanvas.setBackgroundColor('#fdf2f8');

    const inner = new Promise(resolve => {
        try {
            tmpCanvas.loadFromJSON(pageJson, () => {
                tmpCanvas.setViewportTransform([scale, 0, 0, scale, -bx * scale, -by * scale]);
                tmpCanvas.getObjects().forEach(obj => {
                    if (obj.isMockup || obj.excludeFromExport || obj.isGuide) tmpCanvas.remove(obj);
                });
                tmpCanvas.renderAll();
                setTimeout(() => {
                    try {
                        const dataUrl = tmpCanvas.toDataURL({ format:'png', quality:1.0 });
                        tmpCanvas.dispose();
                        resolve(dataUrl);
                    } catch(e) { tmpCanvas.dispose(); resolve(null); }
                }, 200);
            });
        } catch(e) { try { tmpCanvas.dispose(); } catch(_){} resolve(null); }
    });
    return _withTimeout(inner, 10000);
}

async function openWeddingPreview() {
    if (!window.__WEDDING_MODE) return;

    // Capture all pages using the main canvas (reliable)
    const images = await _captureAllPages(3);
    const validImages = images.filter(Boolean);
    if (validImages.length === 0) {
        if (window.showToast) window.showToast('No pages to preview', 'warn');
        return;
    }

    // Open in new window
    const previewWin = window.open('', '_blank', 'width=480,height=800,scrollbars=yes');
    if (!previewWin) {
        if (window.showToast) window.showToast('Popup blocked — please allow popups', 'warn');
        return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"><title>${_t('wed_preview','미리보기')}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:linear-gradient(135deg,#fdf2f8,#fce7f3);min-height:100vh;font-family:-apple-system,sans-serif}.container{max-width:420px;margin:0 auto;padding:0}img{width:100%;display:block}.footer{text-align:center;padding:24px;color:#9ca3af;font-size:13px}</style></head><body><div class="container">${images.map((src, i) => src ? `<img src="${src}" alt="Page ${i+1}">` : '').join('')}</div><div class="footer">${validImages.length} pages</div></body></html>`;
    previewWin.document.write(html);
    previewWin.document.close();
}

function closeWeddingPreview() {
    // Preview now opens in new window, this is kept for backward compatibility
    const overlay = document.getElementById('weddingPreviewOverlay');
    if (overlay) overlay.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════
   9. WEDDING WIZARD — AI 자동 생성 시스템
   ═══════════════════════════════════════════════════════ */

/* ─── Style definitions ─── */
const WED_STYLES = {
    classic:  { bg:'#faf3eb', text:'#3e2723', accent:'#b8860b', highlight:'#d4a017', font:'Georgia, serif' },
    insta:    { bg:'#ffffff', text:'#262626', accent:'#c13584', highlight:'#e1306c', font:'"Segoe UI", Arial, sans-serif' },
    romantic: { bg:'#ffe0ec', text:'#880e4f', accent:'#e91e63', highlight:'#f06292', font:'Georgia, serif' },
    modern:   { bg:'#1a1a1a', text:'#f5f5f5', accent:'#888888', highlight:'#ffffff', font:'Helvetica, Arial, sans-serif' }
};

/* ─── Photo storage ─── */
let _wedPhotos = []; // base64 data URLs

/* ─── Open wizard modal ─── */
function openWeddingWizard() {
    const modal = document.getElementById('weddingWizardModal');
    if (!modal) return;
    // reset form
    ['wedGroomName','wedBrideName','wedGroomFather','wedGroomMother','wedBrideFather','wedBrideMother','wedVenueName','wedVenueAddr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const dateEl = document.getElementById('wedDate');
    if (dateEl) dateEl.value = '';
    const timeEl = document.getElementById('wedTime');
    if (timeEl) timeEl.value = '12:00';
    // reset style
    document.querySelectorAll('.wed-style-btn').forEach((b, i) => {
        b.classList.toggle('wed-style-active', i === 0);
    });
    // reset photos
    _wedPhotos = [];
    const grid = document.getElementById('wedPhotoGrid');
    if (grid) grid.innerHTML = '';
    const inp = document.getElementById('wedPhotoInput');
    if (inp) inp.value = '';
    // reset progress
    const prog = document.getElementById('wedWizardProgress');
    if (prog) prog.style.display = 'none';
    const btn = document.getElementById('btnWedGenerate');
    if (btn) btn.style.display = 'block';

    modal.style.display = 'flex';
}

/* ─── Photo handling ─── */
function handleWeddingPhotos(fileListOrFiles) {
    const files = Array.from(fileListOrFiles);
    const remaining = 10 - _wedPhotos.length;
    const toAdd = files.slice(0, remaining).filter(f => f.type.startsWith('image/'));

    toAdd.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            _wedPhotos.push(e.target.result);
            renderPhotoGrid();
        };
        reader.readAsDataURL(file);
    });
}

function renderPhotoGrid() {
    const grid = document.getElementById('wedPhotoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    _wedPhotos.forEach((src, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:2px solid ' + (i === 0 ? '#ec4899' : '#e2e8f0') + ';';
        div.innerHTML = `
            <img src="${src}" style="width:100%; height:100%; object-fit:cover; display:block;">
            ${i === 0 ? '<div style="position:absolute; top:2px; left:2px; background:#ec4899; color:#fff; font-size:9px; padding:1px 5px; border-radius:4px; font-weight:700;">MAIN</div>' : ''}
            <button onclick="event.stopPropagation(); window._wedRemovePhoto(${i})" style="position:absolute; top:2px; right:2px; width:18px; height:18px; border:none; border-radius:50%; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;"><i class="fa-solid fa-xmark"></i></button>
        `;
        grid.appendChild(div);
    });
}

function _wedRemovePhoto(index) {
    _wedPhotos.splice(index, 1);
    renderPhotoGrid();
}

/* ─── Run generation ─── */
async function runWeddingGeneration() {
    // collect form data
    const groom = document.getElementById('wedGroomName')?.value.trim() || _t('wed_groom','신랑');
    const bride = document.getElementById('wedBrideName')?.value.trim() || _t('wed_bride','신부');
    const groomFather = document.getElementById('wedGroomFather')?.value.trim() || '○○○';
    const groomMother = document.getElementById('wedGroomMother')?.value.trim() || '○○○';
    const brideFather = document.getElementById('wedBrideFather')?.value.trim() || '○○○';
    const brideMother = document.getElementById('wedBrideMother')?.value.trim() || '○○○';
    const dateStr = document.getElementById('wedDate')?.value || '';
    const timeStr = document.getElementById('wedTime')?.value || '12:00';
    const venueName = document.getElementById('wedVenueName')?.value.trim() || _t('wed_venue_name','예식장소');
    const venueAddr = document.getElementById('wedVenueAddr')?.value.trim() || '';
    const styleBtn = document.querySelector('.wed-style-btn.wed-style-active');
    const styleId = styleBtn ? styleBtn.dataset.style : 'classic';
    const style = WED_STYLES[styleId] || WED_STYLES.classic;

    // parse date
    let dateDisplay = '2026. 00. 00';
    let dayOfWeek = '';
    let timeDisplay = _t('wed_time','오후 0시 0분');
    if (dateStr) {
        const d = new Date(dateStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateDisplay = `${y}. ${m}. ${dd}`;
        const days = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
        dayOfWeek = days[d.getDay()];
    }
    if (timeStr) {
        const [hh, mm] = timeStr.split(':').map(Number);
        const ampm = hh < 12 ? '오전' : '오후';
        const h12 = hh === 0 ? 12 : (hh > 12 ? hh - 12 : hh);
        timeDisplay = `${ampm} ${h12}시 ${mm > 0 ? mm + '분' : ''}`.trim();
    }

    const formData = { groom, bride, groomFather, groomMother, brideFather, brideMother,
                       dateStr, dateDisplay, dayOfWeek, timeDisplay, venueName, venueAddr,
                       style, photos: _wedPhotos };

    // show progress
    const prog = document.getElementById('wedWizardProgress');
    const stepEl = document.getElementById('wedWizardStep');
    const genBtn = document.getElementById('btnWedGenerate');
    if (prog) prog.style.display = 'block';
    if (genBtn) genBtn.style.display = 'none';

    function setStep(text) { if (stepEl) stepEl.textContent = text; }

    // close wizard modal
    const modal = document.getElementById('weddingWizardModal');
    if (modal) modal.style.display = 'none';

    // open editor
    setStep(_t('wed_step_cover','표지 만드는 중...'));
    window.dsmOpenEditor(286, 508, '청첩장');

    // wait for editor + canvas ready
    await _waitForCanvas(3000);

    // generate pages
    try {
        await generateAllPages(formData, setStep);
    } catch (err) {
        console.error('Wedding generation error:', err);
    }

    // reset progress
    if (prog) prog.style.display = 'none';
    if (genBtn) genBtn.style.display = 'block';
}

function _waitForCanvas(timeout) {
    return new Promise(resolve => {
        const start = Date.now();
        const check = setInterval(() => {
            const c = canvas || window.canvas;
            if (c && c.getObjects().find(o => o.isBoard)) {
                clearInterval(check);
                resolve();
            } else if (Date.now() - start > timeout) {
                clearInterval(check);
                resolve();
            }
        }, 200);
    });
}

/* ─── Generate all pages ─── */
async function generateAllPages(fd, setStep) {
    const c = canvas || window.canvas;
    if (!c) return;

    // === Cancel any pending initDefaultPages setTimeout callbacks ===
    _wedInitCancelled = true;
    await _sleep(1000); // wait for all initDefaultPages timeouts to fire and be cancelled

    // === Navigate to page 0 first (before removing extra pages) ===
    if (currentPageIndex !== 0 && pageDataList.length > 0) {
        goToPage(0);
        await _sleep(300);
    }

    // === Clean up: remove ALL old pages, keep only the first ===
    while (pageDataList.length > 1) pageDataList.pop();

    // === Smart photo distribution ===
    // 1장: 표지(사진1) + 인사말 + 캘린더 = 3p
    // 2장: 표지(사진1) + 인사말 + 캘린더 + 마무리(사진2) = 4p
    // 3장: 표지(사진1) + 인사말 + 캘린더 + 갤러리(사진2) + 마무리(사진3) = 5p
    // 4+장: 표지(사진1) + 인사말 + 캘린더 + 갤러리들(사진2~N-1) + 마무리(사진N)
    const allPhotos = fd.photos || [];
    const n = allPhotos.length;

    // Split photos
    const coverPhoto = n >= 1 ? allPhotos[0] : null;
    const closingPhoto = n >= 2 ? allPhotos[n - 1] : null;
    const middlePhotos = n >= 3 ? allPhotos.slice(1, n - 1) : [];
    const galleryPages = _distributePhotos(middlePhotos);

    console.log(`[Wedding] ${n} photos → cover:${coverPhoto?1:0} gallery:${middlePhotos.length}(${galleryPages.length}pg) closing:${closingPhoto?1:0}`);

    // Page 1: Cover
    setStep(_t('wed_step_cover','표지 만드는 중...'));
    await buildCoverPage(c, fd);
    if (window.savePageState) window.savePageState();

    // Page 2: Greeting
    setStep(_t('wed_step_greeting','인사말 작성 중...'));
    await _addPageAndWait(c);
    await buildGreetingPage(c, fd);
    if (window.savePageState) window.savePageState();

    // Page 3: Calendar
    setStep(_t('wed_step_calendar','캘린더 만드는 중...'));
    await _addPageAndWait(c);
    await buildCalendarPage(c, fd);
    if (window.savePageState) window.savePageState();

    // Gallery pages (middle photos, 1~3 per page)
    for (let i = 0; i < galleryPages.length; i++) {
        setStep(_t('wed_step_gallery','갤러리 배치 중...') + ` (${i + 1}/${galleryPages.length})`);
        await _addPageAndWait(c);
        await buildPhotoGalleryPage(c, fd, galleryPages[i]);
        if (window.savePageState) window.savePageState();
    }

    // Last page: Closing (last photo + farewell)
    if (closingPhoto) {
        setStep('마무리 페이지 만드는 중...');
        await _addPageAndWait(c);
        await buildClosingPage(c, fd, closingPhoto);
        if (window.savePageState) window.savePageState();
    }

    // Navigate to page 1 + fit canvas
    await _sleep(300);
    goToPage(0);
    await _sleep(300);
    if (window.resizeCanvasToFit) window.resizeCanvasToFit();
    await _sleep(300);
    if (window.weddingActivatePanel) window.weddingActivatePanel();
    setTimeout(() => renderSlideThumbs(), 500);
}

/* Distribute N photos into pages of 1~3 photos optimally */
function _distributePhotos(photos) {
    const n = photos.length;
    if (n === 0) return [];
    if (n <= 3) return [photos.slice()];
    if (n === 4) return [photos.slice(0, 2), photos.slice(2, 4)];
    if (n === 5) return [photos.slice(0, 3), photos.slice(3, 5)];

    const pages = [];
    let i = 0;
    const remainder = n % 3;
    while (i < n) {
        if (remainder === 1 && n - i === 4) {
            pages.push(photos.slice(i, i + 2));
            pages.push(photos.slice(i + 2, i + 4));
            break;
        }
        const take = (n - i >= 3) ? 3 : (n - i);
        pages.push(photos.slice(i, i + take));
        i += take;
    }
    return pages;
}

/* Wait for addPage to fully complete including resizeCanvasToFit */
async function _addPageAndWait(c) {
    if (window.addPage) window.addPage();
    await new Promise(resolve => {
        let ticks = 0;
        const iv = setInterval(() => {
            ticks++;
            const board = c.getObjects().find(o => o.isBoard);
            if (board && ticks >= 4) { clearInterval(iv); resolve(); }
            else if (ticks > 30) { clearInterval(iv); resolve(); }
        }, 100);
    });
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── Page builders ─── */
async function buildCoverPage(c, fd) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });

    // clear non-board objects
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    // Photo fills top 68% — NO overlay
    if (fd.photos.length > 0) {
        await _placePhotoOnCanvas(c, fd.photos[0], board.left, board.top, w, h * 0.68, 0, 0);
    } else {
        // Generate default decorative cover image
        const defPhoto = _generateDefaultCoverPhoto(w, Math.round(h * 0.68), s);
        await _placePhotoOnCanvas(c, defPhoto, board.left, board.top, w, h * 0.68, 0, 0);
    }

    // "저희 결혼합니다" title — below photo
    c.add(new fabric.Textbox(_t('wed_we_marry','저희 결혼합니다'), {
        left: board.left + w * 0.1, top: board.top + h * 0.70, width: w * 0.8,
        fontSize: Math.round(h * 0.028), fontFamily: s.font, fontWeight: '300',
        fill: s.text, textAlign: 'center'
    }));

    // groom ♥ bride
    c.add(new fabric.Textbox(fd.groom, {
        left: board.left + w * 0.05, top: board.top + h * 0.77, width: w * 0.35,
        fontSize: Math.round(h * 0.032), fontFamily: s.font, fontWeight: 'bold',
        fill: s.text, textAlign: 'center'
    }));
    c.add(new fabric.Textbox('♥', {
        left: board.left + w * 0.38, top: board.top + h * 0.77, width: w * 0.24,
        fontSize: Math.round(h * 0.035), fontFamily: s.font,
        fill: s.highlight, textAlign: 'center'
    }));
    c.add(new fabric.Textbox(fd.bride, {
        left: board.left + w * 0.6, top: board.top + h * 0.77, width: w * 0.35,
        fontSize: Math.round(h * 0.032), fontFamily: s.font, fontWeight: 'bold',
        fill: s.text, textAlign: 'center'
    }));

    // date
    c.add(new fabric.Textbox(fd.dateDisplay, {
        left: board.left + w * 0.1, top: board.top + h * 0.85, width: w * 0.8,
        fontSize: Math.round(h * 0.02), fontFamily: s.font,
        fill: s.accent, textAlign: 'center', letterSpacing: 200
    }));

    // venue
    c.add(new fabric.Textbox(fd.venueName, {
        left: board.left + w * 0.1, top: board.top + h * 0.91, width: w * 0.8,
        fontSize: Math.round(h * 0.018), fontFamily: s.font,
        fill: s.accent, textAlign: 'center'
    }));

    c.requestRenderAll();
}

async function buildGreetingPage(c, fd) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    // top decoration
    c.add(new fabric.Textbox('♥', {
        left: board.left + w * 0.44, top: board.top + h * 0.08, width: w * 0.12,
        fontSize: Math.round(h * 0.03), fontFamily: s.font, fill: s.highlight, textAlign: 'center'
    }));

    // top line
    c.add(new fabric.Rect({ left: board.left + w * 0.25, top: board.top + h * 0.14, width: w * 0.5, height: 2, fill: s.accent, selectable: true, evented: true }));

    // title
    c.add(new fabric.Textbox(_t('wed_invite_title','초대합니다'), {
        left: board.left + w * 0.1, top: board.top + h * 0.17, width: w * 0.8,
        fontSize: Math.round(h * 0.035), fontFamily: s.font, fontWeight: '300',
        fill: s.text, textAlign: 'center'
    }));

    // line
    c.add(new fabric.Rect({ left: board.left + w * 0.25, top: board.top + h * 0.24, width: w * 0.5, height: 2, fill: s.accent, selectable: true, evented: true }));

    // Greeting message
    const greetingText = `${fd.groom}과 ${fd.bride}가\n결혼합니다.\n\n서로를 향한 마음을 모아\n하나의 가정을 이루려 합니다.\n\n귀한 걸음 하시어\n축하해 주시면 감사하겠습니다.`;

    c.add(new fabric.Textbox(greetingText, {
        left: board.left + w * 0.08, top: board.top + h * 0.30, width: w * 0.84,
        fontSize: Math.round(h * 0.021), fontFamily: s.font, fontWeight: '300',
        fill: s.text, textAlign: 'center', lineHeight: 2.0
    }));

    // parents
    const parentsText = `${fd.groomFather} · ${fd.groomMother}  의 아들  ${fd.groom}\n${fd.brideFather} · ${fd.brideMother}  의 딸  ${fd.bride}`;
    c.add(new fabric.Textbox(parentsText, {
        left: board.left + w * 0.06, top: board.top + h * 0.72, width: w * 0.88,
        fontSize: Math.round(h * 0.019), fontFamily: s.font, fontWeight: '300',
        fill: s.text, textAlign: 'center', lineHeight: 2.2
    }));

    // bottom decoration
    c.add(new fabric.Textbox('✿  ✿  ✿', {
        left: board.left + w * 0.3, top: board.top + h * 0.90, width: w * 0.4,
        fontSize: Math.round(h * 0.02), fontFamily: s.font,
        fill: s.highlight, textAlign: 'center'
    }));

    c.requestRenderAll();
}

/* buildGalleryPage removed — replaced by buildGreetingPage with invitation text */

/* ─── Closing page (last photo + farewell message) ─── */
async function buildClosingPage(c, fd, photo) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    // Photo fills top 65%
    if (photo) {
        await _placePhotoOnCanvas(c, photo, board.left + w * 0.06, board.top + h * 0.04, w * 0.88, h * 0.58, 16, 16);
    }

    // Heart decoration
    c.add(new fabric.Textbox('♥', {
        left: board.left + w * 0.44, top: board.top + h * 0.66, width: w * 0.12,
        fontSize: Math.round(h * 0.025), fontFamily: s.font, fill: s.highlight, textAlign: 'center'
    }));

    // Closing message
    c.add(new fabric.Textbox('참석하셔서\n자리를 빛내주세요.', {
        left: board.left + w * 0.1, top: board.top + h * 0.72, width: w * 0.8,
        fontSize: Math.round(h * 0.026), fontFamily: s.font, fontWeight: '300',
        fill: s.text, textAlign: 'center', lineHeight: 2.0
    }));

    // Bottom decoration
    c.add(new fabric.Textbox('─  ♥  ─', {
        left: board.left + w * 0.3, top: board.top + h * 0.90, width: w * 0.4,
        fontSize: Math.round(h * 0.018), fontFamily: s.font, fill: s.accent, textAlign: 'center'
    }));

    c.requestRenderAll();
}

/* ─── Photo gallery page (1~3 photos per page) ─── */
async function buildPhotoGalleryPage(c, fd, photos) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    const bL = board.left, bT = board.top;
    const m = w * 0.05; // margin
    const g = w * 0.03; // gap

    if (photos.length >= 3) {
        // 1 large top + 2 small bottom
        const topH = h * 0.48, botH = h * 0.44;
        await _placePhotoOnCanvas(c, photos[0], bL + m, bT + m, w - m * 2, topH, 12, 12);
        const botW = (w - m * 2 - g) / 2;
        await _placePhotoOnCanvas(c, photos[1], bL + m, bT + m + topH + g, botW, botH, 10, 10);
        await _placePhotoOnCanvas(c, photos[2], bL + m + botW + g, bT + m + topH + g, botW, botH, 10, 10);
    } else if (photos.length === 2) {
        // 2 equal photos stacked vertically
        const ph = (h - m * 2 - g) / 2;
        await _placePhotoOnCanvas(c, photos[0], bL + m, bT + m, w - m * 2, ph, 12, 12);
        await _placePhotoOnCanvas(c, photos[1], bL + m, bT + m + ph + g, w - m * 2, ph, 12, 12);
    } else if (photos.length === 1) {
        // Single photo centered with margin
        await _placePhotoOnCanvas(c, photos[0], bL + m, bT + m, w - m * 2, h - m * 2, 12, 12);
    }

    c.requestRenderAll();
}

async function buildCalendarPage(c, fd) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    // header
    c.add(new fabric.Textbox('♥', {
        left: board.left + w * 0.44, top: board.top + h * 0.04, width: w * 0.12,
        fontSize: Math.round(h * 0.025), fontFamily: s.font, fill: s.highlight, textAlign: 'center'
    }));
    c.add(new fabric.Textbox(_t('wed_date_title','예식 일시'), {
        left: board.left + w * 0.1, top: board.top + h * 0.09, width: w * 0.8,
        fontSize: Math.round(h * 0.028), fontFamily: s.font, fontWeight: 'bold', fill: s.text, textAlign: 'center'
    }));
    c.add(new fabric.Rect({ left: board.left + w * 0.3, top: board.top + h * 0.15, width: w * 0.4, height: 2, fill: s.accent, selectable: true, evented: true }));

    // date/time display
    const dateInfo = fd.dateDisplay + (fd.dayOfWeek ? '  ' + fd.dayOfWeek : '');
    c.add(new fabric.Textbox(dateInfo, {
        left: board.left + w * 0.05, top: board.top + h * 0.18, width: w * 0.9,
        fontSize: Math.round(h * 0.022), fontFamily: s.font, fill: s.text, textAlign: 'center'
    }));
    c.add(new fabric.Textbox(fd.timeDisplay, {
        left: board.left + w * 0.2, top: board.top + h * 0.23, width: w * 0.6,
        fontSize: Math.round(h * 0.02), fontFamily: s.font, fill: s.accent, textAlign: 'center'
    }));

    // Auto-generated calendar image
    if (fd.dateStr) {
        const calDataUrl = _generateCalendarImage(fd.dateStr, s, w);
        await _placeGeneratedImage(c, calDataUrl, board.left + w * 0.06, board.top + h * 0.28, w * 0.88, h * 0.46);
    }

    // D-day
    let dday = 'D - DAY';
    if (fd.dateStr) {
        const diff = Math.ceil((new Date(fd.dateStr) - new Date()) / (1000 * 60 * 60 * 24));
        dday = diff > 0 ? `D - ${diff}` : (diff === 0 ? 'D - DAY' : `D + ${Math.abs(diff)}`);
    }
    c.add(new fabric.Textbox(dday, {
        left: board.left + w * 0.15, top: board.top + h * 0.78, width: w * 0.7,
        fontSize: Math.round(h * 0.035), fontFamily: s.font, fontWeight: 'bold', fill: s.highlight, textAlign: 'center'
    }));

    // venue hint below D-day
    if (fd.venueName && fd.venueName !== _t('wed_venue_name','예식장소')) {
        c.add(new fabric.Textbox(fd.venueName, {
            left: board.left + w * 0.15, top: board.top + h * 0.86, width: w * 0.7,
            fontSize: Math.round(h * 0.016), fontFamily: s.font, fill: s.accent, textAlign: 'center'
        }));
    }

    c.requestRenderAll();
}

/* ─── Calendar image generator (offscreen canvas) ─── */
function _generateCalendarImage(dateStr, style, boardW) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth();
    const weddingDay = date.getDate();

    const cw = Math.round(boardW * 4); // high-res
    const ch = Math.round(cw * 0.85);
    const cvs = document.createElement('canvas');
    cvs.width = cw; cvs.height = ch;
    const ctx = cvs.getContext('2d');

    ctx.clearRect(0, 0, cw, ch);

    // Month header
    const monthKR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    ctx.fillStyle = style.text;
    ctx.font = `bold ${Math.round(ch * 0.07)}px ${style.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${year}년 ${monthKR[month]}`, cw / 2, ch * 0.08);

    // Line under header
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cw * 0.05, ch * 0.12); ctx.lineTo(cw * 0.95, ch * 0.12); ctx.stroke();

    // Day headers: 일 월 화 수 목 금 토
    const dayHeaders = ['일','월','화','수','목','금','토'];
    const cellW = cw * 0.88 / 7;
    const startX = cw * 0.06;
    const headerY = ch * 0.20;
    ctx.font = `bold ${Math.round(ch * 0.045)}px ${style.font}`;
    for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i === 0 ? '#ef4444' : (i === 6 ? '#3b82f6' : style.accent);
        ctx.fillText(dayHeaders[i], startX + cellW * i + cellW / 2, headerY);
    }

    // Calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let row = 0;
    const gridStartY = ch * 0.28;
    const rowH = ch * 0.12;

    for (let day = 1; day <= daysInMonth; day++) {
        const col = (firstDay + day - 1) % 7;
        if (day > 1 && col === 0) row++;

        const cx = startX + cellW * col + cellW / 2;
        const cy = gridStartY + row * rowH;

        if (day === weddingDay) {
            // Highlight circle
            const r = Math.min(cellW, rowH) * 0.36;
            ctx.fillStyle = style.highlight || style.accent;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(ch * 0.055)}px ${style.font}`;
            ctx.fillText(day.toString(), cx, cy + ch * 0.02);
            ctx.font = `${Math.round(ch * 0.05)}px ${style.font}`;
        } else {
            ctx.fillStyle = col === 0 ? '#ef4444' : (col === 6 ? '#3b82f6' : style.text);
            ctx.font = `${Math.round(ch * 0.05)}px ${style.font}`;
            ctx.fillText(day.toString(), cx, cy + ch * 0.02);
        }
    }

    return cvs.toDataURL('image/png');
}

async function buildVenuePage(c, fd) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    // Title
    c.add(new fabric.Textbox(_t('wed_location_title','오시는 길'), {
        left: board.left + w * 0.1, top: board.top + h * 0.06, width: w * 0.8,
        fontSize: Math.round(h * 0.03), fontFamily: s.font, fontWeight: 'bold', fill: s.text, textAlign: 'center'
    }));
    c.add(new fabric.Rect({ left: board.left + w * 0.3, top: board.top + h * 0.13, width: w * 0.4, height: 2, fill: s.accent, selectable: true, evented: true }));

    // Venue name
    c.add(new fabric.Textbox(fd.venueName, {
        left: board.left + w * 0.08, top: board.top + h * 0.17, width: w * 0.84,
        fontSize: Math.round(h * 0.026), fontFamily: s.font, fontWeight: 'bold', fill: s.text, textAlign: 'center'
    }));

    // Generated venue/location card image
    const venueDataUrl = _generateVenueImage(fd.venueName, fd.venueAddr, s, w);
    await _placeGeneratedImage(c, venueDataUrl, board.left + w * 0.06, board.top + h * 0.24, w * 0.88, h * 0.45);

    // Address below map
    if (fd.venueAddr) {
        c.add(new fabric.Textbox(fd.venueAddr, {
            left: board.left + w * 0.06, top: board.top + h * 0.72, width: w * 0.88,
            fontSize: Math.round(h * 0.018), fontFamily: s.font, fill: s.text, textAlign: 'center', lineHeight: 1.6
        }));
    }

    // Transport info
    c.add(new fabric.Textbox(_t('wed_transport','교통편 정보를 입력해주세요'), {
        left: board.left + w * 0.08, top: board.top + h * 0.82, width: w * 0.84,
        fontSize: Math.round(h * 0.015), fontFamily: s.font,
        fill: s.accent, textAlign: 'center', lineHeight: 1.6
    }));

    c.requestRenderAll();
}

/* ─── Venue location card image generator ─── */
function _generateVenueImage(venueName, venueAddr, style, boardW) {
    const cw = Math.round(boardW * 4);
    const ch = Math.round(cw * 0.8);
    const cvs = document.createElement('canvas');
    cvs.width = cw; cvs.height = ch;
    const ctx = cvs.getContext('2d');

    // Background with rounded corners
    const bgColor = style.bg === '#ffffff' ? '#f0f4f8' : '#fdf6f9';
    const r = 40;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(cw - r, 0); ctx.arcTo(cw, 0, cw, r, r);
    ctx.lineTo(cw, ch - r); ctx.arcTo(cw, ch, cw - r, ch, r);
    ctx.lineTo(r, ch); ctx.arcTo(0, ch, 0, ch - r, r);
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Decorative grid lines (map-like)
    ctx.strokeStyle = style.bg === '#ffffff' ? '#e2e8f0' : '#f3e8ef';
    ctx.lineWidth = 1;
    for (let x = cw * 0.1; x < cw * 0.9; x += cw * 0.12) {
        ctx.beginPath(); ctx.moveTo(x, ch * 0.05); ctx.lineTo(x, ch * 0.55); ctx.stroke();
    }
    for (let y = ch * 0.08; y < ch * 0.55; y += ch * 0.1) {
        ctx.beginPath(); ctx.moveTo(cw * 0.05, y); ctx.lineTo(cw * 0.95, y); ctx.stroke();
    }

    // Location pin icon
    const pinCx = cw / 2, pinCy = ch * 0.28;
    const pinR = Math.min(cw, ch) * 0.08;

    // Pin shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(pinCx + 3, pinCy + pinR * 1.5, pinR * 0.7, pinR * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pin body
    ctx.fillStyle = style.highlight || '#ec4899';
    ctx.beginPath();
    ctx.arc(pinCx, pinCy - pinR * 0.2, pinR, 0, Math.PI * 2);
    ctx.fill();
    // Pin point
    ctx.beginPath();
    ctx.moveTo(pinCx - pinR * 0.55, pinCy + pinR * 0.55);
    ctx.lineTo(pinCx, pinCy + pinR * 1.5);
    ctx.lineTo(pinCx + pinR * 0.55, pinCy + pinR * 0.55);
    ctx.fill();
    // White inner circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pinCx, pinCy - pinR * 0.2, pinR * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Venue name
    ctx.fillStyle = style.text;
    ctx.font = `bold ${Math.round(ch * 0.065)}px ${style.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(venueName, cw / 2, ch * 0.68);

    // Divider
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cw * 0.2, ch * 0.74); ctx.lineTo(cw * 0.8, ch * 0.74); ctx.stroke();

    // Address with word wrap
    if (venueAddr) {
        ctx.fillStyle = style.accent;
        ctx.font = `${Math.round(ch * 0.04)}px ${style.font}`;
        const maxW = cw * 0.8;
        const words = venueAddr.split('');
        let line = '', lineY = ch * 0.82;
        for (const char of words) {
            const test = line + char;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, cw / 2, lineY);
                line = char;
                lineY += ch * 0.06;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, cw / 2, lineY);
    }

    return cvs.toDataURL('image/png');
}

/* ─── Place generated image (contain mode) ─── */
function _placeGeneratedImage(c, dataUrl, left, top, width, height) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const fImg = new fabric.Image(img);
            const scale = Math.min(width / fImg.width, height / fImg.height);
            fImg.set({
                scaleX: scale, scaleY: scale,
                left: left + width / 2,
                top: top + height / 2,
                originX: 'center', originY: 'center'
            });
            c.add(fImg);
            c.requestRenderAll();
            resolve(fImg);
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

/* ═══════════════════════════════════════════════════════
   10. SHARE — Supabase Storage 저장 + 공유 링크
   ═══════════════════════════════════════════════════════ */
async function shareWeddingInvitation() {
    // Login check
    if (!window.currentUser) {
        if (window.showToast) window.showToast(_t('wed_share_login','공유하려면 로그인이 필요합니다'), 'warn');
        return;
    }
    if (!window.sb) {
        if (window.showToast) window.showToast('Supabase not available', 'error');
        return;
    }

    // Show progress dialog
    const dlg = document.getElementById('weddingShareDialog');
    const prog = document.getElementById('wedShareProgress');
    const result = document.getElementById('wedShareResult');
    if (dlg) { dlg.style.display = 'flex'; }
    if (prog) { prog.style.display = 'block'; prog.innerHTML = '<div style="font-size:32px; margin-bottom:12px;"><i class="fa-solid fa-spinner fa-spin" style="color:#7c3aed;"></i></div><p style="color:#6b7280; font-size:14px;">' + _t('wed_share_saving','저장 중...') + '</p>'; }
    if (result) result.style.display = 'none';

    try {
        // Capture all pages using reliable main canvas method
        const images = await _captureAllPages(3);

        const slug = 'wed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const basePath = `wedding/${slug}`;

        // Upload each page
        const pageUrls = [];
        for (let i = 0; i < images.length; i++) {
            if (!images[i]) continue;
            if (prog) prog.querySelector('p').textContent = _t('wed_share_saving','저장 중...') + ` (${i + 1}/${images.length})`;

            const resp = await fetch(images[i]);
            const blob = await resp.blob();
            const filePath = `${basePath}/page_${i}.png`;

            const { error } = await window.sb.storage.from('design').upload(filePath, blob, {
                contentType: 'image/png', upsert: true
            });
            if (error) { console.error('Upload error page', i, error); continue; }

            const { data: urlData } = window.sb.storage.from('design').getPublicUrl(filePath);
            if (urlData) pageUrls.push(urlData.publicUrl);
        }

        if (pageUrls.length === 0) {
            if (window.showToast) window.showToast('Upload failed', 'error');
            if (dlg) dlg.style.display = 'none';
            return;
        }

        // Upload meta.json
        const meta = {
            pageCount: pageUrls.length,
            pages: pageUrls,
            createdAt: new Date().toISOString(),
            userId: window.currentUser.id
        };
        const metaBlob = new Blob([JSON.stringify(meta)], { type: 'application/json' });
        await window.sb.storage.from('design').upload(`${basePath}/meta.json`, metaBlob, {
            contentType: 'application/json', upsert: true
        });

        // Generate share URL
        const siteHost = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
        const shareUrl = `${siteHost}/w.html?id=${slug}`;

        // Show result
        if (prog) prog.style.display = 'none';
        if (result) {
            result.style.display = 'block';
            const urlInput = document.getElementById('wedShareUrl');
            if (urlInput) urlInput.value = shareUrl;
        }
    } catch (err) {
        console.error('Share error:', err);
        if (window.showToast) window.showToast('Share failed: ' + err.message, 'error');
        if (dlg) dlg.style.display = 'none';
    }
}

function _copyShareUrl() {
    const inp = document.getElementById('wedShareUrl');
    if (!inp) return;
    const url = inp.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            if (window.showToast) window.showToast(_t('wed_share_copied','복사되었습니다!'), 'success');
            const msg = document.getElementById('wedShareCopiedMsg');
            if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 2000); }
        });
    } else {
        inp.select();
        document.execCommand('copy');
        if (window.showToast) window.showToast(_t('wed_share_copied','복사되었습니다!'), 'success');
    }
}
window._copyShareUrl = _copyShareUrl;
window._closeShareDialog = () => {
    const dlg = document.getElementById('weddingShareDialog');
    if (dlg) dlg.style.display = 'none';
};

/* ─── Default cover photo generator ─── */
function _generateDefaultCoverPhoto(w, h, style) {
    const oc = document.createElement('canvas');
    oc.width = w; oc.height = h;
    const ctx = oc.getContext('2d');

    // Theme-adaptive gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (style.bg === '#1a1a1a') {
        // Modern (dark)
        grad.addColorStop(0, '#2d2d2d'); grad.addColorStop(0.5, '#1a1a1a'); grad.addColorStop(1, '#0d0d0d');
    } else if (style.bg === '#ffe0ec') {
        // Romantic (pink gradient)
        grad.addColorStop(0, '#fce4ec'); grad.addColorStop(0.4, '#f8bbd0'); grad.addColorStop(0.7, '#f48fb1'); grad.addColorStop(1, '#e91e63');
    } else if (style.bg === '#ffffff') {
        // Insta (warm white)
        grad.addColorStop(0, '#fafafa'); grad.addColorStop(0.5, '#f5f5f5'); grad.addColorStop(1, '#eeeeee');
    } else {
        // Classic (warm beige/gold)
        grad.addColorStop(0, '#f5e6d3'); grad.addColorStop(0.5, '#e8d5b7'); grad.addColorStop(1, '#d4a373');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft bokeh circles
    const circles = [
        { x: w * 0.2, y: h * 0.3, r: w * 0.12, a: 0.1 },
        { x: w * 0.7, y: h * 0.2, r: w * 0.15, a: 0.08 },
        { x: w * 0.5, y: h * 0.6, r: w * 0.2, a: 0.06 },
        { x: w * 0.85, y: h * 0.7, r: w * 0.1, a: 0.12 },
        { x: w * 0.15, y: h * 0.75, r: w * 0.08, a: 0.1 },
    ];
    circles.forEach(({ x, y, r, a }) => {
        const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
        cg.addColorStop(0, `rgba(255,255,255,${a})`);
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Heart in center
    const cx = w / 2, cy = h * 0.45, sz = w * 0.08;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(cx, cy + sz * 0.3);
    ctx.bezierCurveTo(cx - sz, cy - sz * 0.5, cx - sz * 1.5, cy + sz * 0.3, cx, cy + sz);
    ctx.bezierCurveTo(cx + sz * 1.5, cy + sz * 0.3, cx + sz, cy - sz * 0.5, cx, cy + sz * 0.3);
    ctx.fill();
    ctx.restore();

    return oc.toDataURL('image/jpeg', 0.9);
}

/* ─── Main canvas page capture (reliable, no offscreen loadFromJSON) ─── */
async function _captureAllPages(multiplier = 3) {
    const c = canvas || window.canvas;
    if (!c) return [];
    if (window.savePageState) window.savePageState();
    const pages = window.__pageDataList || pageDataList;
    const origIdx = window._getPageIndex ? window._getPageIndex() : currentPageIndex;

    // Show loading overlay to hide canvas changes
    let overlay = document.getElementById('wedCaptureOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'wedCaptureOverlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:99998; background:rgba(255,255,255,0.95); display:flex; align-items:center; justify-content:center; flex-direction:column;';
        overlay.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:#ec4899; margin-bottom:12px;"></i><p style="color:#6b7280; font-size:14px;">Rendering pages...</p>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    const results = [];
    const CUSTOM = ['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst','isWedPlaceholder','isWedPlaceholderText','wedPlaceholderId'];
    // Use jpeg for thumbnails (faster, smaller), png for export
    const isThumb = multiplier < 1;
    const fmt = isThumb ? 'jpeg' : 'png';
    const quality = isThumb ? 0.7 : undefined;

    for (let i = 0; i < pages.length; i++) {
        const json = pages[i];
        if (!json) { results.push(null); continue; }

        try {
            const dataUrl = await new Promise((resolve) => {
                const timer = setTimeout(() => resolve(null), 12000); // 12s timeout
                c.loadFromJSON(json, () => {
                    clearTimeout(timer);
                    const board = c.getObjects().find(o => o.isBoard);
                    if (!board) { resolve(null); return; }
                    c.sendToBack(board);
                    c.getObjects().forEach(obj => {
                        if (obj.isMockup || obj.excludeFromExport || obj.isGuide) c.remove(obj);
                    });
                    // Set viewport to show only the board
                    const origVpt = c.viewportTransform.slice();
                    const origW = c.getWidth(), origH = c.getHeight();
                    c.setViewportTransform([1, 0, 0, 1, -board.left, -board.top]);
                    c.setDimensions({ width: board.width, height: board.height });
                    c.requestRenderAll();

                    // Wait for images to fully render (base64 decode takes time)
                    const waitMs = isThumb ? 500 : 400;
                    setTimeout(() => {
                        try {
                            c.requestRenderAll();
                            const opts = { format: fmt, multiplier: isThumb ? 0.35 : multiplier, enableRetinaScaling: false };
                            if (quality) opts.quality = quality;
                            const url = c.toDataURL(opts);
                            // Restore viewport
                            c.setViewportTransform(origVpt);
                            c.setDimensions({ width: origW, height: origH });
                            resolve(url);
                        } catch(e) {
                            c.setViewportTransform(origVpt);
                            c.setDimensions({ width: origW, height: origH });
                            resolve(null);
                        }
                    }, waitMs);
                }, (o, obj) => {
                    // reviver — preserve custom props
                    CUSTOM.forEach(p => { if (o[p] !== undefined) obj[p] = o[p]; });
                });
            });
            results.push(dataUrl);
        } catch(e) {
            console.warn('Capture page error', i, e);
            results.push(null);
        }
    }

    // Restore original page
    const origJson = pages[origIdx];
    if (origJson) {
        await new Promise(resolve => {
            c.loadFromJSON(origJson, () => {
                const board = c.getObjects().find(o => o.isBoard);
                if (board) c.sendToBack(board);
                if (window.resizeCanvasToFit) window.resizeCanvasToFit();
                c.requestRenderAll();
                resolve();
            }, (o, obj) => { CUSTOM.forEach(p => { if (o[p] !== undefined) obj[p] = o[p]; }); });
        });
    }

    overlay.style.display = 'none';
    return results;
}

/* ─── Photo replacement helper ─── */
function replaceSelectedImage() {
    const c = canvas || window.canvas;
    if (!c) return;
    const active = c.getActiveObject();
    if (!active || active.type !== 'image') {
        if (window.showToast) window.showToast(_t('msg_select_image','이미지를 선택하세요'), 'warn');
        return;
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const imgObj = new Image();
            imgObj.onload = () => {
                // 교체 전 기존 이미지의 실제 표시 크기 저장
                const oldVisualW = active.getScaledWidth();
                const oldVisualH = active.getScaledHeight();
                active.setElement(imgObj);
                // Re-scale to fit existing clip area
                if (active.clipPath) {
                    const cpW = active.clipPath.width * (active.clipPath.scaleX || 1);
                    const cpH = active.clipPath.height * (active.clipPath.scaleY || 1);
                    const scale = Math.max(cpW / imgObj.width, cpH / imgObj.height);
                    active.set({ scaleX: scale, scaleY: scale });
                } else {
                    // clipPath 없으면 기존 표시 크기에 맞춤
                    const scale = Math.min(oldVisualW / imgObj.width, oldVisualH / imgObj.height);
                    active.set({ scaleX: scale, scaleY: scale });
                }
                c.requestRenderAll();
                if (window.savePageState) window.savePageState();
            };
            imgObj.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
    inp.click();
}
window.replaceSelectedImage = replaceSelectedImage;

/* ─── Photo placement helper (cover mode) ─── */
function _placePhotoOnCanvas(c, dataUrl, left, top, width, height, rx, ry) {
    return new Promise(resolve => {
        const imgObj = new Image();
        imgObj.onload = () => {
            const fabricImg = new fabric.Image(imgObj);
            const scale = Math.max(width / fabricImg.width, height / fabricImg.height);
            fabricImg.set({
                scaleX: scale, scaleY: scale,
                left: left + width / 2, top: top + height / 2,
                originX: 'center', originY: 'center'
            });
            fabricImg.clipPath = new fabric.Rect({
                width, height, rx: rx || 0, ry: ry || 0,
                left: left + width / 2, top: top + height / 2,
                originX: 'center', originY: 'center',
                absolutePositioned: true
            });
            c.add(fabricImg);
            c.bringToFront(fabricImg);
            c.requestRenderAll();
            resolve(fabricImg);
        };
        imgObj.onerror = () => resolve(null);
        imgObj.src = dataUrl;
    });
}
