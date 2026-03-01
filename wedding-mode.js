/* ═══ Wedding Invitation Mode v1 ═══ */
import { pageDataList, currentPageIndex, goToPage, addNewPage, deleteCurrentPage } from "./canvas-pages.js?v=123";
import { canvas } from "./canvas-core.js?v=123";

const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

/* ─── Constants ─── */
const CUSTOM_PROPS = ['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst'];

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
                  fill:'#f5e6d3', rx:16, ry:16, stroke:'#d4a373', strokeWidth:2, selectable:true, evented:true },
                { type:'textbox', text:_t('wed_photo_here','사진을 넣어주세요'), left:w*0.2, top:h*0.4, width:w*0.6,
                  fontSize:Math.round(h*0.022), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center' },
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
                  fill:'#f5e6d3', rx:12, ry:12, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true },
                { type:'textbox', text:_t('wed_drag_photo','사진을 넣어주세요'), left:w*0.25, top:h*0.36, width:w*0.5,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center' },
                // 서브 이미지 2개
                { type:'rect', left:w*0.08, top:h*0.62, width:w*0.4, height:h*0.25,
                  fill:'#f5e6d3', rx:10, ry:10, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true },
                { type:'rect', left:w*0.52, top:h*0.62, width:w*0.4, height:h*0.25,
                  fill:'#f5e6d3', rx:10, ry:10, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true },
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
                  fill:'#fdf2f8', rx:12, ry:12, stroke:'#f9a8d4', strokeWidth:1, selectable:true, evented:true },
                { type:'textbox', text:_t('wed_calendar_note','달력을 이미지로\n추가해주세요'), left:w*0.25, top:h*0.73, width:w*0.5,
                  fontSize:Math.round(h*0.018), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center' }
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
                  fill:'#f0ebe3', rx:12, ry:12, stroke:'#d4a373', strokeWidth:1, selectable:true, evented:true },
                { type:'textbox', text:_t('wed_map_placeholder','지도 이미지를\n넣어주세요'), left:w*0.25, top:h*0.5, width:w*0.5,
                  fontSize:Math.round(h*0.02), fontFamily:'Georgia, serif',
                  fill:'#c4a07a', textAlign:'center' },
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

    console.log('✅ Wedding Mode initialized');
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

    return new Promise(resolve => {
        tmpCanvas.loadFromJSON(pageJson, () => {
            tmpCanvas.setViewportTransform([thumbScale, 0, 0, thumbScale, -bx * thumbScale, -by * thumbScale]);
            tmpCanvas.getObjects().forEach(obj => {
                if (obj.isMockup || obj.excludeFromExport || obj.isGuide) tmpCanvas.remove(obj);
            });
            tmpCanvas.renderAll();
            setTimeout(() => {
                const dataUrl = tmpCanvas.toDataURL({ format:'jpeg', quality:0.7 });
                tmpCanvas.dispose();
                resolve(dataUrl);
            }, 100);
        });
    });
}

async function renderSlideThumbs() {
    if (!window.__WEDDING_MODE) return;
    if (window.savePageState) window.savePageState();

    const container = document.getElementById('weddingSlideList');
    if (!container) return;

    const curIdx = currentPageIndex;
    container.innerHTML = '';

    for (let i = 0; i < pageDataList.length; i++) {
        const thumbUrl = await generateThumbnail(i);
        const isActive = i === curIdx;

        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding:6px; border-radius:8px; cursor:pointer; border:2px solid ' + (isActive ? '#ec4899' : 'transparent') + '; background:' + (isActive ? '#fdf2f8' : 'transparent') + '; transition:all 0.15s; position:relative;';
        div.onclick = () => weddingGoToSlide(i);
        div.onmouseenter = () => { const a = div.querySelector('.wed-sl-act'); if(a) a.style.display='flex'; };
        div.onmouseleave = () => { const a = div.querySelector('.wed-sl-act'); if(a) a.style.display='none'; };

        div.innerHTML = `
            <span style="font-size:11px; font-weight:700; color:${isActive?'#ec4899':'#94a3b8'}; min-width:18px; text-align:center; padding-top:4px;">${i+1}</span>
            <div style="flex:1; border-radius:4px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); aspect-ratio:9/16; background:#fdf2f8;">
                ${thumbUrl ? '<img src="'+thumbUrl+'" style="width:100%; height:100%; object-fit:cover; display:block;" draggable="false">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#d4a373;font-size:11px;">...</div>'}
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

    return new Promise(resolve => {
        tmpCanvas.loadFromJSON(pageJson, () => {
            tmpCanvas.setViewportTransform([scale, 0, 0, scale, -bx * scale, -by * scale]);
            tmpCanvas.getObjects().forEach(obj => {
                if (obj.isMockup || obj.excludeFromExport || obj.isGuide) tmpCanvas.remove(obj);
            });
            tmpCanvas.renderAll();
            setTimeout(() => {
                const dataUrl = tmpCanvas.toDataURL({ format:'png', quality:1.0 });
                tmpCanvas.dispose();
                resolve(dataUrl);
            }, 200);
        });
    });
}

async function openWeddingPreview() {
    if (!window.__WEDDING_MODE) return;
    if (window.savePageState) window.savePageState();

    const overlay = document.getElementById('weddingPreviewOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    const container = document.getElementById('weddingPreviewScroll');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:60px 0; color:#d4a373;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>${_t('wed_loading','로딩 중...')}</div>`;

    // 모든 페이지를 이미지로 렌더링
    const images = [];
    for (let i = 0; i < pageDataList.length; i++) {
        const dataUrl = await renderPageToImage(i);
        if (dataUrl) images.push(dataUrl);
    }

    // 세로 스택으로 표시
    container.innerHTML = '';
    images.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'width:100%; max-width:420px; display:block; margin:0 auto;';
        img.alt = `Page ${i + 1}`;
        container.appendChild(img);
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
