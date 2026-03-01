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
                  fontSize:Math.round(h*0.035), fontFamily:'Georgia, serif',
                  fill:'#8b5e3c', textAlign:'center', fontStyle:'italic' },
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
    greeting: {
        name: _t('wed_tpl_greeting','인사말'), icon: 'fa-envelope-open-text',
        build(w, h) {
            return [
                // 장식 라인
                { type:'rect', left:w*0.3, top:h*0.08, width:w*0.4, height:2,
                  fill:'#d4a373', selectable:true, evented:true },
                // 제목
                { type:'textbox', text:_t('wed_invite_title','초대합니다'), left:w*0.1, top:h*0.12, width:w*0.8,
                  fontSize:Math.round(h*0.035), fontFamily:'Georgia, serif', fontWeight:'bold',
                  fill:'#5c4033', textAlign:'center' },
                // 장식 라인
                { type:'rect', left:w*0.3, top:h*0.2, width:w*0.4, height:2,
                  fill:'#d4a373', selectable:true, evented:true },
                // 인사말 본문
                { type:'textbox',
                  text:_t('wed_greeting_text','서로가 마주보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어가고자 합니다.\n\n저희 두 사람이 사랑의 이름으로\n지켜나갈 수 있도록\n오셔서 축복해 주십시오.'),
                  left:w*0.1, top:h*0.28, width:w*0.8,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#6b5244', textAlign:'center', lineHeight:1.8 },
                // 양가 부모
                { type:'textbox',
                  text:_t('wed_parents','○○○ · ○○○ 의 장남  신랑\n○○○ · ○○○ 의 장녀  신부'),
                  left:w*0.1, top:h*0.7, width:w*0.8,
                  fontSize:Math.round(h*0.018), fontFamily:'Georgia, serif',
                  fill:'#8b7355', textAlign:'center', lineHeight:1.8 },
                // 하단 꽃 장식
                { type:'textbox', text:'✿  ✿  ✿', left:w*0.3, top:h*0.88, width:w*0.4,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#ec98a8', textAlign:'center' }
            ];
        }
    },
    gallery: {
        name: _t('wed_tpl_gallery','갤러리'), icon: 'fa-images',
        build(w, h) {
            return [
                // 제목
                { type:'textbox', text:_t('wed_gallery_title','Our Moments'), left:w*0.1, top:h*0.06, width:w*0.8,
                  fontSize:Math.round(h*0.03), fontFamily:'Georgia, serif', fontStyle:'italic',
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
                  fontSize:Math.round(h*0.016), fontFamily:'Georgia, serif', fontStyle:'italic',
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

/* ─── State ─── */
let thumbCache = {};
let previewState = { pages:[], scrollContainer:null };

/* ═══════════════════════════════════════════
   1. INITIALIZATION
   ═══════════════════════════════════════════ */
export function initWeddingMode() {
    const pc = document.getElementById('pageCounter');
    if (pc) {
        const obs = new MutationObserver(() => {
            if (window.__WEDDING_MODE) {
                clearTimeout(window.__wedThumbTimer);
                window.__wedThumbTimer = setTimeout(() => renderSlideThumbs(), 400);
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

    console.log('✅ Wedding Mode initialized');
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
function initDefaultPages() {
    if (!window.__WEDDING_MODE || !canvas) return;
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
        const b2 = canvas.getObjects().find(o => o.isBoard);
        if (b2) b2.set({ fill: '#fdf2f8' });
        applyTemplateToCanvas('greeting');

        // 3페이지: gallery
        if (window.addPage) window.addPage();
        setTimeout(() => {
            const b3 = canvas.getObjects().find(o => o.isBoard);
            if (b3) b3.set({ fill: '#fdf2f8' });
            applyTemplateToCanvas('gallery');

            // 1페이지로 돌아가기
            setTimeout(() => {
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

    const container = document.getElementById('weddingSlideList');
    if (!container) return;

    const curIdx = currentPageIndex;
    container.innerHTML = '';

    for (let i = 0; i < pageDataList.length; i++) {
        let thumbUrl = null;
        try { thumbUrl = await generateThumbnail(i); } catch(e) { console.warn('Thumb error page', i, e); }
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
                <button onclick="event.stopPropagation(); window.weddingDeleteSlide(${i})" title="${_t('wed_delete','삭제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(239,68,68,0.8); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;" ${pageDataList.length<=1?'disabled':''}><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    }

    const activeEl = container.querySelector('[style*="border:2px solid #ec4899"]');
    if (activeEl) activeEl.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

/* ═══════════════════════════════════════════
   5. NAVIGATION
   ═══════════════════════════════════════════ */
function weddingGoToSlide(index) {
    goToPage(index);
    setTimeout(() => renderSlideThumbs(), 300);
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
function showTemplateModal() {
    const modal = document.getElementById('weddingTemplateModal');
    if (!modal) return;

    const grid = document.getElementById('weddingTemplateGrid');
    if (grid) {
        let html = '';
        Object.entries(WEDDING_TEMPLATES).forEach(([id, tpl]) => {
            html += `
                <div onclick="window.weddingApplyTemplate('${id}')" style="padding:16px 12px; border:2px solid #f9a8d4; border-radius:12px; cursor:pointer; text-align:center; transition:all 0.15s; background:#fff;"
                     onmouseenter="this.style.borderColor='#ec4899'; this.style.background='#fdf2f8';"
                     onmouseleave="this.style.borderColor='#f9a8d4'; this.style.background='#fff';">
                    <i class="fa-solid ${tpl.icon}" style="font-size:28px; color:#ec4899; margin-bottom:8px; display:block;"></i>
                    <div style="font-size:13px; font-weight:700; color:#5c4033;">${tpl.name}</div>
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

function applyTemplate(templateId) {
    hideTemplateModal();
    applyTemplateToCanvas(templateId);
    if (window.savePageState) window.savePageState();
    setTimeout(() => renderSlideThumbs(), 300);
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
    if (window.savePageState) window.savePageState();

    const overlay = document.getElementById('weddingPreviewOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    const container = document.getElementById('weddingPreviewScroll');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:60px 0; color:#d4a373;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>${_t('wed_loading','로딩 중...')} (${pageDataList.length} pages)</div>`;

    // 모든 페이지를 이미지로 렌더링 (with try/catch per page)
    const images = [];
    for (let i = 0; i < pageDataList.length; i++) {
        try {
            const dataUrl = await renderPageToImage(i);
            images.push(dataUrl); // null is OK, we handle below
        } catch(e) {
            console.warn('Preview render error page', i, e);
            images.push(null);
        }
    }

    // 세로 스택으로 표시
    container.innerHTML = '';
    images.forEach((src, i) => {
        if (src) {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'width:100%; max-width:420px; display:block; margin:0 auto;';
            img.alt = `Page ${i + 1}`;
            container.appendChild(img);
        } else {
            const ph = document.createElement('div');
            ph.style.cssText = 'width:100%; max-width:420px; margin:0 auto; aspect-ratio:9/16; background:#fdf2f8; display:flex; align-items:center; justify-content:center; color:#d4a373; font-size:16px;';
            ph.textContent = `Page ${i + 1}`;
            container.appendChild(ph);
        }
    });

    // 페이지 카운터
    const counter = document.getElementById('weddingPreviewCounter');
    if (counter) counter.textContent = pageDataList.length + ' pages';

    // ESC 키 핸들러
    document.addEventListener('keydown', previewKeyHandler);
}

function closeWeddingPreview() {
    const overlay = document.getElementById('weddingPreviewOverlay');
    if (overlay) overlay.style.display = 'none';
    document.removeEventListener('keydown', previewKeyHandler);
}

function previewKeyHandler(e) {
    if (e.key === 'Escape') closeWeddingPreview();
}

/* ═══════════════════════════════════════════════════════
   9. WEDDING WIZARD — AI 자동 생성 시스템
   ═══════════════════════════════════════════════════════ */

/* ─── Style definitions ─── */
const WED_STYLES = {
    classic:  { bg:'#fdf2f8', text:'#5c4033', accent:'#d4a373', highlight:'#ec4899', font:'Georgia, serif' },
    modern:   { bg:'#ffffff', text:'#1e293b', accent:'#6366f1', highlight:'#818cf8', font:'Arial, sans-serif' },
    romantic: { bg:'#fff0f3', text:'#831843', accent:'#ec4899', highlight:'#f472b6', font:'Georgia, serif' },
    minimal:  { bg:'#fafafa', text:'#374151', accent:'#9ca3af', highlight:'#6b7280', font:'Helvetica, Arial, sans-serif' }
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

    // Page 1: Cover (already on current canvas from dsmOpenEditor)
    setStep(_t('wed_step_cover','표지 만드는 중...'));
    await buildCoverPage(c, fd);
    if (window.savePageState) window.savePageState();

    // Page 2: Greeting
    setStep(_t('wed_step_greeting','인사말 작성 중...'));
    await _addPageAndWait(c);
    await buildGreetingPage(c, fd);
    if (window.savePageState) window.savePageState();

    // Page 3: Gallery 1 (photos[1]~[3])
    const galleryPhotos = fd.photos.slice(1);
    if (galleryPhotos.length > 0) {
        setStep(_t('wed_step_gallery','갤러리 배치 중...'));
        await _addPageAndWait(c);
        await buildGalleryPage(c, fd, galleryPhotos.slice(0, 3));
        if (window.savePageState) window.savePageState();
    }

    // Page 4: Calendar
    setStep(_t('wed_step_calendar','캘린더 만드는 중...'));
    await _addPageAndWait(c);
    await buildCalendarPage(c, fd);
    if (window.savePageState) window.savePageState();

    // Page 5: Venue
    setStep(_t('wed_step_venue','오시는길 만드는 중...'));
    await _addPageAndWait(c);
    await buildVenuePage(c, fd);
    if (window.savePageState) window.savePageState();

    // Extra gallery pages for remaining photos
    const remaining = galleryPhotos.slice(3);
    for (let i = 0; i < remaining.length; i += 3) {
        setStep(_t('wed_step_gallery','갤러리 배치 중...'));
        await _addPageAndWait(c);
        await buildGalleryPage(c, fd, remaining.slice(i, i + 3));
        if (window.savePageState) window.savePageState();
    }

    // Navigate to page 1 after generation
    await _sleep(300);
    goToPage(0);
    await _sleep(500);
    if (window.weddingActivatePanel) window.weddingActivatePanel();
    setTimeout(() => renderSlideThumbs(), 500);
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
        // placeholder rect
        const ph = new fabric.Rect({
            left: board.left + w * 0.05, top: board.top + h * 0.05, width: w * 0.9, height: h * 0.58,
            fill: '#f5e6d3', rx: 16, ry: 16, stroke: s.accent, strokeWidth: 2,
            selectable: true, evented: true, isWedPlaceholder: true, wedPlaceholderId: 'cover_main', hoverCursor: 'pointer'
        });
        const phText = new fabric.Textbox(_t('wed_photo_here','사진을 넣어주세요'), {
            left: board.left + w * 0.15, top: board.top + h * 0.3, width: w * 0.7,
            fontSize: Math.round(h * 0.022), fontFamily: s.font,
            fill: '#c4a07a', textAlign: 'center', editable: false,
            isWedPlaceholderText: true, wedPlaceholderId: 'cover_main', hoverCursor: 'pointer'
        });
        c.add(ph); c.add(phText);
    }

    // "저희 결혼합니다" title — below photo
    c.add(new fabric.Textbox(_t('wed_we_marry','저희 결혼합니다'), {
        left: board.left + w * 0.1, top: board.top + h * 0.70, width: w * 0.8,
        fontSize: Math.round(h * 0.028), fontFamily: s.font,
        fill: s.text, textAlign: 'center', fontStyle: 'italic'
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

    // top line
    c.add(new fabric.Rect({ left: board.left + w * 0.3, top: board.top + h * 0.08, width: w * 0.4, height: 2, fill: s.accent, selectable: true, evented: true }));

    // title
    c.add(new fabric.Textbox(_t('wed_invite_title','초대합니다'), {
        left: board.left + w * 0.1, top: board.top + h * 0.12, width: w * 0.8,
        fontSize: Math.round(h * 0.035), fontFamily: s.font, fontWeight: 'bold',
        fill: s.text, textAlign: 'center'
    }));

    // line
    c.add(new fabric.Rect({ left: board.left + w * 0.3, top: board.top + h * 0.2, width: w * 0.4, height: 2, fill: s.accent, selectable: true, evented: true }));

    // AI greeting text
    let greetingText = _t('wed_greeting_text','서로가 마주보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어가고자 합니다.\n\n저희 두 사람이 사랑의 이름으로\n지켜나갈 수 있도록\n오셔서 축복해 주십시오.');

    try {
        if (window.sb) {
            const prompt = `${fd.groom}과 ${fd.bride}의 결혼식 초대 인사말을 200자 이내로 작성해주세요. 감성적이고 격식있게. 줄바꿈 포함. 제목이나 이름은 넣지 마세요. 인사말 본문만 작성하세요.`;
            const { data, error } = await window.sb.functions.invoke('generate-text', {
                body: { prompt, max_tokens: 300 }
            });
            if (data && !error) {
                const txt = typeof data === 'string' ? data : (data.text || data.result || '');
                if (txt.length > 20) greetingText = txt.trim();
            }
        }
    } catch (e) { console.warn('AI greeting fallback:', e); }

    c.add(new fabric.Textbox(greetingText, {
        left: board.left + w * 0.1, top: board.top + h * 0.26, width: w * 0.8,
        fontSize: Math.round(h * 0.02), fontFamily: s.font,
        fill: s.text, textAlign: 'center', lineHeight: 1.8
    }));

    // parents — uses actual form data
    const parentsText = `${fd.groomFather} · ${fd.groomMother}   의 아들  ${fd.groom}\n${fd.brideFather} · ${fd.brideMother}   의 딸  ${fd.bride}`;
    c.add(new fabric.Textbox(parentsText, {
        left: board.left + w * 0.08, top: board.top + h * 0.68, width: w * 0.84,
        fontSize: Math.round(h * 0.019), fontFamily: s.font,
        fill: s.text, textAlign: 'center', lineHeight: 2.0
    }));

    // bottom decoration
    c.add(new fabric.Textbox('✿  ✿  ✿', {
        left: board.left + w * 0.3, top: board.top + h * 0.88, width: w * 0.4,
        fontSize: Math.round(h * 0.02), fontFamily: s.font,
        fill: s.highlight, textAlign: 'center'
    }));

    c.requestRenderAll();
}

async function buildGalleryPage(c, fd, photos) {
    const board = c.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width, h = board.height, s = fd.style;
    board.set({ fill: s.bg });
    c.getObjects().filter(o => !o.isBoard).forEach(o => c.remove(o));

    // title
    c.add(new fabric.Textbox('Our Moments', {
        left: board.left + w * 0.1, top: board.top + h * 0.06, width: w * 0.8,
        fontSize: Math.round(h * 0.03), fontFamily: s.font, fontStyle: 'italic',
        fill: s.text, textAlign: 'center'
    }));
    c.add(new fabric.Rect({ left: board.left + w * 0.35, top: board.top + h * 0.13, width: w * 0.3, height: 2, fill: s.accent, selectable: true, evented: true }));

    // Text-only layout — AI love poem or default
    let poemText = '사랑이란,\n서로의 눈을 바라보는 것이 아니라\n함께 같은 방향을 바라보는 것입니다.\n\n두 사람이 하나가 되어\n서로를 아끼고 사랑하며\n아름다운 내일을 함께 그려가겠습니다.';

    try {
        if (window.sb) {
            const prompt = `${fd.groom}과 ${fd.bride}의 결혼을 축하하는 사랑에 대한 짧은 시 또는 명언을 150자 이내로 작성해주세요. 감성적이고 아름답게. 제목이나 이름은 넣지 마세요.`;
            const { data, error } = await window.sb.functions.invoke('generate-text', {
                body: { prompt, max_tokens: 200 }
            });
            if (data && !error) {
                const txt = typeof data === 'string' ? data : (data.text || data.result || '');
                if (txt.length > 20) poemText = txt.trim();
            }
        }
    } catch (e) { console.warn('AI poem fallback:', e); }

    // Decorative element
    c.add(new fabric.Textbox('♥', {
        left: board.left + w * 0.44, top: board.top + h * 0.2, width: w * 0.12,
        fontSize: Math.round(h * 0.04), fontFamily: s.font, fill: s.highlight, textAlign: 'center'
    }));

    // Poem text
    c.add(new fabric.Textbox(poemText, {
        left: board.left + w * 0.1, top: board.top + h * 0.3, width: w * 0.8,
        fontSize: Math.round(h * 0.022), fontFamily: s.font,
        fill: s.text, textAlign: 'center', lineHeight: 2.0
    }));

    // Bottom decoration
    c.add(new fabric.Textbox('─  ♥  ─', {
        left: board.left + w * 0.3, top: board.top + h * 0.75, width: w * 0.4,
        fontSize: Math.round(h * 0.02), fontFamily: s.font, fill: s.accent, textAlign: 'center'
    }));

    c.add(new fabric.Textbox(_t('wed_caption','우리의 아름다운 순간들'), {
        left: board.left + w * 0.15, top: board.top + h * 0.92, width: w * 0.7,
        fontSize: Math.round(h * 0.016), fontFamily: s.font, fontStyle: 'italic',
        fill: s.accent, textAlign: 'center'
    }));

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

    // venue hint
    c.add(new fabric.Textbox(fd.venueName, {
        left: board.left + w * 0.15, top: board.top + h * 0.86, width: w * 0.7,
        fontSize: Math.round(h * 0.016), fontFamily: s.font, fill: s.accent, textAlign: 'center'
    }));

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

    // Save current page state
    if (window.savePageState) window.savePageState();

    const totalPages = pageDataList.length;
    if (totalPages === 0) return;

    // Show progress dialog
    const dlg = document.getElementById('weddingShareDialog');
    const prog = document.getElementById('wedShareProgress');
    const result = document.getElementById('wedShareResult');
    if (dlg) { dlg.style.display = 'flex'; }
    if (prog) { prog.style.display = 'block'; prog.innerHTML = '<div style="font-size:32px; margin-bottom:12px;"><i class="fa-solid fa-spinner fa-spin" style="color:#7c3aed;"></i></div><p style="color:#6b7280; font-size:14px;">' + _t('wed_share_saving','저장 중...') + ' (0/' + totalPages + ')</p>'; }
    if (result) result.style.display = 'none';

    try {
        // Generate slug
        const slug = 'wed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const basePath = `wedding/${slug}`;

        // Render and upload each page
        const pageUrls = [];
        for (let i = 0; i < totalPages; i++) {
            if (prog) prog.innerHTML = '<div style="font-size:32px; margin-bottom:12px;"><i class="fa-solid fa-spinner fa-spin" style="color:#7c3aed;"></i></div><p style="color:#6b7280; font-size:14px;">' + _t('wed_share_saving','저장 중...') + ` (${i + 1}/${totalPages})</p>`;

            let dataUrl = null;
            try { dataUrl = await renderPageToImage(i); } catch(e) { console.warn('Share render err', i, e); }
            if (!dataUrl) continue;

            // Convert data URL to Blob
            const resp = await fetch(dataUrl);
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

        console.log('Wedding shared:', shareUrl, meta);
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
