/* ═══ PPT Presentation Mode v1 ═══ */
import { pageDataList, currentPageIndex, goToPage, addNewPage, deleteCurrentPage } from "./canvas-pages.js?v=123";
import { canvas } from "./canvas-core.js?v=123";

const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

/* ─── Constants ─── */
const CUSTOM_PROPS = ['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst'];

/* ─── Slide Templates ─── */
const PPT_TEMPLATES = {
    title: {
        name: _t('ppt_tpl_title','타이틀'), icon: 'fa-heading',
        build(w, h) {
            return [
                { type:'textbox', text:_t('ppt_presentation_title','프레젠테이션 제목'), left:w*0.1, top:h*0.3, width:w*0.8,
                  fontSize:Math.round(h*0.1), fontWeight:'bold', fontFamily:'Arial',
                  fill:'#1e293b', textAlign:'center' },
                { type:'textbox', text:_t('ppt_enter_subtitle','부제목을 입력하세요'), left:w*0.2, top:h*0.55, width:w*0.6,
                  fontSize:Math.round(h*0.045), fontFamily:'Arial',
                  fill:'#64748b', textAlign:'center' }
            ];
        }
    },
    titleBody: {
        name: _t('ppt_tpl_title_body','제목+본문'), icon: 'fa-align-left',
        build(w, h) {
            return [
                { type:'textbox', text:_t('ppt_slide_title','슬라이드 제목'), left:w*0.08, top:h*0.08, width:w*0.84,
                  fontSize:Math.round(h*0.08), fontWeight:'bold', fontFamily:'Arial', fill:'#1e293b' },
                { type:'rect', left:w*0.08, top:h*0.21, width:w*0.15, height:4,
                  fill:'#f97316', selectable:true, evented:true },
                { type:'textbox', text:_t('ppt_body_placeholder','본문 내용을 입력하세요.\n핵심 포인트와 상세 설명을 적어보세요.'),
                  left:w*0.08, top:h*0.28, width:w*0.84,
                  fontSize:Math.round(h*0.04), fontFamily:'Arial', fill:'#475569', lineHeight:1.6 }
            ];
        }
    },
    twoColumn: {
        name: _t('ppt_tpl_two_col','2열'), icon: 'fa-columns',
        build(w, h) {
            return [
                { type:'textbox', text:_t('ppt_slide_title','슬라이드 제목'), left:w*0.08, top:h*0.08, width:w*0.84,
                  fontSize:Math.round(h*0.07), fontWeight:'bold', fontFamily:'Arial', fill:'#1e293b' },
                { type:'textbox', text:_t('ppt_left_col','왼쪽 열 내용을 입력하세요.'),
                  left:w*0.08, top:h*0.28, width:w*0.38,
                  fontSize:Math.round(h*0.035), fontFamily:'Arial', fill:'#475569', lineHeight:1.5 },
                { type:'textbox', text:_t('ppt_right_col','오른쪽 열 내용을 입력하세요.'),
                  left:w*0.54, top:h*0.28, width:w*0.38,
                  fontSize:Math.round(h*0.035), fontFamily:'Arial', fill:'#475569', lineHeight:1.5 }
            ];
        }
    },
    imageText: {
        name: _t('ppt_tpl_img_text','이미지+텍스트'), icon: 'fa-image',
        build(w, h) {
            return [
                { type:'rect', left:w*0.04, top:h*0.08, width:w*0.44, height:h*0.84,
                  fill:'#f1f5f9', rx:12, ry:12, stroke:'#e2e8f0', strokeWidth:1, selectable:true, evented:true },
                { type:'textbox', text:_t('ppt_drag_image','여기에 이미지를\n드래그하세요'),
                  left:w*0.12, top:h*0.4, width:w*0.28,
                  fontSize:Math.round(h*0.035), fontFamily:'Arial', fill:'#94a3b8', textAlign:'center' },
                { type:'textbox', text:_t('ppt_content_title','콘텐츠 제목'), left:w*0.54, top:h*0.12, width:w*0.4,
                  fontSize:Math.round(h*0.06), fontWeight:'bold', fontFamily:'Arial', fill:'#1e293b' },
                { type:'textbox', text:_t('ppt_desc_placeholder','설명 텍스트를 입력하세요. 이미지와 함께 표시됩니다.'),
                  left:w*0.54, top:h*0.3, width:w*0.4,
                  fontSize:Math.round(h*0.035), fontFamily:'Arial', fill:'#64748b', lineHeight:1.5 }
            ];
        }
    },
    quote: {
        name: _t('ppt_tpl_quote','인용구'), icon: 'fa-quote-left',
        build(w, h) {
            return [
                { type:'textbox', text:'\u201C', left:w*0.08, top:h*0.12, width:w*0.12,
                  fontSize:Math.round(h*0.25), fontFamily:'Georgia', fill:'#f97316' },
                { type:'textbox', text:_t('ppt_quote_placeholder','여기에 인상적인 인용문을 입력하세요.'),
                  left:w*0.15, top:h*0.3, width:w*0.7,
                  fontSize:Math.round(h*0.055), fontFamily:'Georgia', fontStyle:'italic',
                  fill:'#334155', textAlign:'center', lineHeight:1.5 },
                { type:'textbox', text:_t('ppt_speaker_name','- 발표자 이름'), left:w*0.3, top:h*0.7, width:w*0.4,
                  fontSize:Math.round(h*0.035), fontFamily:'Arial', fill:'#94a3b8', textAlign:'center' }
            ];
        }
    },
    blank: {
        name: _t('ppt_tpl_blank','빈 슬라이드'), icon: 'fa-square',
        build() { return []; }
    }
};

/* ─── State ─── */
let thumbCache = {};  // pageIndex → dataUrl
let previewState = { slides:[], current:0, transitioning:false, canvas:null, ctx:null };

/* ═══════════════════════════════════════════
   1. INITIALIZATION
   ═══════════════════════════════════════════ */
export function initPptMode() {
    // MutationObserver: 페이지 카운터 변경 시 썸네일 갱신
    const pc = document.getElementById('pageCounter');
    if (pc) {
        const obs = new MutationObserver(() => {
            if (window.__PPT_MODE) {
                clearTimeout(window.__pptThumbTimer);
                window.__pptThumbTimer = setTimeout(() => renderSlideThumbnails(), 400);
            }
        });
        obs.observe(pc, { childList:true, characterData:true, subtree:true });
    }

    // expose to window
    window.pptDuplicateSlide = duplicateCurrentSlide;
    window.pptDeleteSlide = pptDeleteSlide;
    window.pptPreview = openPresentationPreview;
    window.pptClosePreview = closePresentationPreview;
    window.pptPreviewNext = previewNext;
    window.pptPreviewPrev = previewPrev;
    window.pptApplyTemplate = applySlideTemplate;
    window.pptGoToSlide = pptGoToSlide;
    window.pptUpdateNotes = updateNotes;
    window.pptShowTemplates = showTemplateModal;
    window.pptHideTemplates = hideTemplateModal;
    window.renderSlideThumbnails = renderSlideThumbnails;
    window.pptActivateSlidePanel = activateSlidePanel;

    console.log('✅ PPT Mode initialized');
}

/* ═══════════════════════════════════════════
   2. SLIDE THUMBNAIL PANEL
   ═══════════════════════════════════════════ */
function activateSlidePanel() {
    // 좌측 사이드바에서 '페이지' 탭 자동 열기
    const pageBtn = document.querySelector('#iconBar .icon-item[data-panel="sub-page"]');
    if (pageBtn) pageBtn.click();

    // sub-page 패널 내용을 PPT 슬라이드 패널로 교체
    setTimeout(() => {
        const subPage = document.getElementById('sub-page');
        if (!subPage) return;

        subPage.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:0 2px 10px; border-bottom:1px solid #e2e8f0; margin-bottom:10px;">
                <span style="font-weight:800; font-size:14px; color:#1e293b;"><i class="fa-solid fa-file-powerpoint" style="color:#f97316; margin-right:4px;"></i>Slides</span>
                <div style="display:flex; gap:4px;">
                    <button onclick="window.addPage()" title="${_t('ppt_add_slide','슬라이드 추가')}" style="width:30px; height:30px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:13px; color:#f97316;"><i class="fa-solid fa-plus"></i></button>
                    <button onclick="window.pptDuplicateSlide()" title="${_t('ppt_duplicate_slide','슬라이드 복제')}" style="width:30px; height:30px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#6366f1;"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="window.pptShowTemplates()" title="${_t('ppt_templates','템플릿')}" style="width:30px; height:30px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#10b981;"><i class="fa-solid fa-table-cells-large"></i></button>
                    <button onclick="window.pptPreview()" title="${_t('ppt_preview','미리보기')}" style="width:30px; height:30px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; color:#ec4899;"><i class="fa-solid fa-play"></i></button>
                </div>
            </div>
            <div id="pptSlideList" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; max-height:calc(100vh - 360px);"></div>
            <div style="border-top:1px solid #e2e8f0; padding-top:10px; margin-top:10px;">
                <div style="font-size:11px; font-weight:700; color:#94a3b8; margin-bottom:4px;"><i class="fa-solid fa-sticky-note" style="margin-right:3px;"></i>${_t('ppt_speaker_notes','발표자 노트')}</div>
                <textarea id="pptNotesInput" placeholder="${_t('ppt_notes_placeholder','이 슬라이드에 대한 노트를 입력하세요...')}"
                    oninput="window.pptUpdateNotes(this.value)"
                    style="width:100%; min-height:60px; max-height:100px; resize:vertical; border:1px solid #e2e8f0; border-radius:8px; padding:8px; font-size:12px; line-height:1.4; box-sizing:border-box; outline:none; font-family:inherit;"
                    onfocus="this.style.borderColor='#f97316'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
            </div>
        `;

        renderSlideThumbnails();
    }, 100);
}

async function generateThumbnail(pageIndex) {
    const pageJson = pageDataList[pageIndex];
    if (!pageJson) return null;

    const board = (pageJson.objects || []).find(o => o.isBoard);
    const bw = board ? (board.width * (board.scaleX || 1)) : 1280;
    const bh = board ? (board.height * (board.scaleY || 1)) : 720;
    const bx = board ? (board.left || 0) : 0;
    const by = board ? (board.top || 0) : 0;

    const thumbW = 200;
    const thumbScale = thumbW / bw;
    const thumbH = Math.round(bh * thumbScale);

    const tmpEl = document.createElement('canvas');
    tmpEl.width = thumbW; tmpEl.height = thumbH;
    const tmpCanvas = new fabric.StaticCanvas(tmpEl);
    tmpCanvas.setWidth(thumbW); tmpCanvas.setHeight(thumbH);
    tmpCanvas.setBackgroundColor('#ffffff');

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

async function renderSlideThumbnails() {
    if (!window.__PPT_MODE) return;

    // 현재 상태 저장
    if (window.savePageState) window.savePageState();

    const container = document.getElementById('pptSlideList');
    if (!container) return;

    const curIdx = currentPageIndex;
    container.innerHTML = '';

    for (let i = 0; i < pageDataList.length; i++) {
        const thumbUrl = await generateThumbnail(i);
        const isActive = i === curIdx;

        const div = document.createElement('div');
        div.className = 'ppt-slide-thumb' + (isActive ? ' active' : '');
        div.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding:6px; border-radius:8px; cursor:pointer; border:2px solid ' + (isActive ? '#f97316' : 'transparent') + '; background:' + (isActive ? '#fff7ed' : 'transparent') + '; transition:all 0.15s; position:relative;';
        div.onclick = () => pptGoToSlide(i);
        div.onmouseenter = () => { const a = div.querySelector('.ppt-sl-act'); if(a) a.style.display='flex'; };
        div.onmouseleave = () => { const a = div.querySelector('.ppt-sl-act'); if(a) a.style.display='none'; };

        div.innerHTML = `
            <span style="font-size:11px; font-weight:700; color:${isActive?'#f97316':'#94a3b8'}; min-width:18px; text-align:center; padding-top:4px;">${i+1}</span>
            <div style="flex:1; border-radius:4px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); aspect-ratio:16/9; background:#f1f5f9;">
                ${thumbUrl ? '<img src="'+thumbUrl+'" style="width:100%; height:100%; object-fit:cover; display:block;" draggable="false">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">Loading...</div>'}
            </div>
            <div class="ppt-sl-act" style="display:none; position:absolute; top:4px; right:4px; gap:2px;">
                <button onclick="event.stopPropagation(); window.pptDuplicateSlide(${i})" title="${_t('ppt_duplicate','복제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-copy"></i></button>
                <button onclick="event.stopPropagation(); window.pptDeleteSlide(${i})" title="${_t('ppt_delete','삭제')}" style="width:22px; height:22px; border:none; border-radius:4px; background:rgba(239,68,68,0.8); color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;" ${pageDataList.length<=1?'disabled':''}><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    }

    // 노트 업데이트
    const notesInput = document.getElementById('pptNotesInput');
    if (notesInput) {
        window.__pptNotes = window.__pptNotes || {};
        notesInput.value = window.__pptNotes[curIdx] || '';
    }

    // 현재 슬라이드가 보이도록 스크롤
    const activeEl = container.querySelector('.active');
    if (activeEl) activeEl.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

function pptGoToSlide(index) {
    // 노트 저장
    const notesInput = document.getElementById('pptNotesInput');
    if (notesInput) {
        window.__pptNotes = window.__pptNotes || {};
        window.__pptNotes[currentPageIndex] = notesInput.value;
    }
    goToPage(index);
    setTimeout(() => renderSlideThumbnails(), 300);
}

function updateNotes(val) {
    window.__pptNotes = window.__pptNotes || {};
    window.__pptNotes[currentPageIndex] = val;
}

/* ═══════════════════════════════════════════
   3. SLIDE DUPLICATE
   ═══════════════════════════════════════════ */
function duplicateCurrentSlide(index) {
    if (window.savePageState) window.savePageState();

    const srcIdx = (typeof index === 'number') ? index : currentPageIndex;
    if (!pageDataList[srcIdx]) return;

    const cloned = JSON.parse(JSON.stringify(pageDataList[srcIdx]));
    pageDataList.splice(srcIdx + 1, 0, cloned);

    // 전환 효과 shift
    const trans = window.__pptTransitions || {};
    const newTrans = {};
    Object.keys(trans).forEach(k => {
        const ki = parseInt(k);
        if (ki > srcIdx) newTrans[ki + 1] = trans[ki];
        else newTrans[ki] = trans[ki];
    });
    newTrans[srcIdx + 1] = trans[srcIdx] || 'none';
    window.__pptTransitions = newTrans;

    // 노트 shift
    const notes = window.__pptNotes || {};
    const newNotes = {};
    Object.keys(notes).forEach(k => {
        const ki = parseInt(k);
        if (ki > srcIdx) newNotes[ki + 1] = notes[ki];
        else newNotes[ki] = notes[ki];
    });
    newNotes[srcIdx + 1] = notes[srcIdx] || '';
    window.__pptNotes = newNotes;

    goToPage(srcIdx + 1);
    setTimeout(() => renderSlideThumbnails(), 300);
}

function pptDeleteSlide(index) {
    if (pageDataList.length <= 1) return;
    if (!confirm(_t('ppt_delete_confirm','이 슬라이드를 삭제하시겠습니까?'))) return;

    pageDataList.splice(index, 1);

    // 전환/노트 shift down
    const trans = window.__pptTransitions || {};
    const newTrans = {};
    Object.keys(trans).forEach(k => {
        const ki = parseInt(k);
        if (ki < index) newTrans[ki] = trans[ki];
        else if (ki > index) newTrans[ki - 1] = trans[ki];
    });
    window.__pptTransitions = newTrans;

    const notes = window.__pptNotes || {};
    const newNotes = {};
    Object.keys(notes).forEach(k => {
        const ki = parseInt(k);
        if (ki < index) newNotes[ki] = notes[ki];
        else if (ki > index) newNotes[ki - 1] = notes[ki];
    });
    window.__pptNotes = newNotes;

    const newIdx = Math.min(index, pageDataList.length - 1);
    goToPage(newIdx);
    setTimeout(() => renderSlideThumbnails(), 300);
}

/* ═══════════════════════════════════════════
   4. SLIDE TEMPLATES
   ═══════════════════════════════════════════ */
function showTemplateModal() {
    const modal = document.getElementById('pptTemplateModal');
    if (!modal) return;

    // 템플릿 그리드 생성
    const grid = document.getElementById('pptTemplateGrid');
    if (grid) {
        let html = '';
        Object.entries(PPT_TEMPLATES).forEach(([id, tpl]) => {
            html += `
                <div onclick="window.pptApplyTemplate('${id}')" style="padding:16px 12px; border:2px solid #e2e8f0; border-radius:12px; cursor:pointer; text-align:center; transition:all 0.15s; background:#fff;"
                     onmouseenter="this.style.borderColor='#f97316'; this.style.background='#fff7ed';"
                     onmouseleave="this.style.borderColor='#e2e8f0'; this.style.background='#fff';">
                    <i class="fa-solid ${tpl.icon}" style="font-size:28px; color:#f97316; margin-bottom:8px; display:block;"></i>
                    <div style="font-size:13px; font-weight:700; color:#1e293b;">${tpl.name}</div>
                </div>
            `;
        });
        grid.innerHTML = html;
    }

    modal.style.display = 'flex';
}

function hideTemplateModal() {
    const modal = document.getElementById('pptTemplateModal');
    if (modal) modal.style.display = 'none';
}

function applySlideTemplate(templateId) {
    const tpl = PPT_TEMPLATES[templateId];
    if (!tpl || !canvas) return;

    hideTemplateModal();

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const w = board.width;
    const h = board.height;

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
    if (window.savePageState) window.savePageState();
    setTimeout(() => renderSlideThumbnails(), 300);
}

/* ═══════════════════════════════════════════
   5. PRESENTATION PREVIEW (FULLSCREEN SLIDESHOW)
   ═══════════════════════════════════════════ */
async function renderPageToImage(index) {
    const pageJson = pageDataList[index];
    if (!pageJson) return null;

    const board = (pageJson.objects || []).find(o => o.isBoard);
    const bw = board ? board.width * (board.scaleX || 1) : 1280;
    const bh = board ? board.height * (board.scaleY || 1) : 720;
    const bx = board ? (board.left || 0) : 0;
    const by = board ? (board.top || 0) : 0;

    const scale = 2;
    const tmpEl = document.createElement('canvas');
    tmpEl.width = bw * scale; tmpEl.height = bh * scale;
    const tmpCanvas = new fabric.StaticCanvas(tmpEl);
    tmpCanvas.setWidth(bw * scale); tmpCanvas.setHeight(bh * scale);
    tmpCanvas.setBackgroundColor('#ffffff');

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

async function openPresentationPreview() {
    if (!window.__PPT_MODE) return;
    if (window.savePageState) window.savePageState();

    const overlay = document.getElementById('pptPreviewOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    const cvs = document.getElementById('pptPreviewCanvas');
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    previewState.canvas = cvs;
    previewState.ctx = cvs.getContext('2d');
    previewState.current = 0;
    previewState.slides = [];
    previewState.transitioning = false;

    // 로딩 표시
    const ctx = previewState.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(_t('ppt_loading_slides','슬라이드 로딩 중...'), cvs.width / 2, cvs.height / 2);

    // 모든 슬라이드 렌더링
    for (let i = 0; i < pageDataList.length; i++) {
        const dataUrl = await renderPageToImage(i);
        const img = new Image();
        img.src = dataUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        previewState.slides.push({
            img,
            transition: (window.__pptTransitions || {})[i] || 'none',
            notes: (window.__pptNotes || {})[i] || ''
        });
    }

    drawPreviewSlide(0);
    updatePreviewCounter();
    document.addEventListener('keydown', previewKeyHandler);

    try { overlay.requestFullscreen(); } catch(e) {}
}

function closePresentationPreview() {
    const overlay = document.getElementById('pptPreviewOverlay');
    if (overlay) overlay.style.display = 'none';
    document.removeEventListener('keydown', previewKeyHandler);
    if (document.fullscreenElement) {
        try { document.exitFullscreen(); } catch(e) {}
    }
    previewState.slides = [];
}

function drawSlideOnCtx(ctx, img, ox, oy, cw, ch) {
    if (!img || !img.naturalWidth) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const screenRatio = cw / ch;
    let dw, dh, dx, dy;
    if (imgRatio > screenRatio) {
        dw = cw; dh = cw / imgRatio; dx = ox; dy = oy + (ch - dh) / 2;
    } else {
        dh = ch; dw = ch * imgRatio; dx = ox + (cw - dw) / 2; dy = oy;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPreviewSlide(index) {
    const s = previewState.slides[index];
    if (!s) return;
    const ctx = previewState.ctx;
    const cw = previewState.canvas.width;
    const ch = previewState.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    drawSlideOnCtx(ctx, s.img, 0, 0, cw, ch);
}

function transitionToSlide(fromIndex, toIndex) {
    if (previewState.transitioning) return;
    if (toIndex < 0 || toIndex >= previewState.slides.length) return;
    previewState.transitioning = true;

    const fromSlide = previewState.slides[fromIndex];
    const toSlide = previewState.slides[toIndex];
    const transType = toSlide.transition;

    if (transType === 'none') {
        drawPreviewSlide(toIndex);
        previewState.current = toIndex;
        previewState.transitioning = false;
        updatePreviewCounter();
        updatePreviewNotes();
        return;
    }

    const ctx = previewState.ctx;
    const cw = previewState.canvas.width;
    const ch = previewState.canvas.height;
    const duration = 600;
    const start = performance.now();

    function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cw, ch);

        switch(transType) {
            case 'fade':
                ctx.globalAlpha = 1 - ease;
                drawSlideOnCtx(ctx, fromSlide.img, 0, 0, cw, ch);
                ctx.globalAlpha = ease;
                drawSlideOnCtx(ctx, toSlide.img, 0, 0, cw, ch);
                ctx.globalAlpha = 1;
                break;
            case 'slide':
                drawSlideOnCtx(ctx, fromSlide.img, -cw * ease, 0, cw, ch);
                drawSlideOnCtx(ctx, toSlide.img, cw * (1 - ease), 0, cw, ch);
                break;
            case 'zoom':
                ctx.save();
                ctx.globalAlpha = 1 - ease;
                const sc = 1 + ease * 0.3;
                ctx.translate(cw/2, ch/2);
                ctx.scale(sc, sc);
                ctx.translate(-cw/2, -ch/2);
                drawSlideOnCtx(ctx, fromSlide.img, 0, 0, cw, ch);
                ctx.restore();
                ctx.globalAlpha = ease;
                drawSlideOnCtx(ctx, toSlide.img, 0, 0, cw, ch);
                ctx.globalAlpha = 1;
                break;
            case 'wipe':
                drawSlideOnCtx(ctx, fromSlide.img, 0, 0, cw, ch);
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, cw * ease, ch);
                ctx.clip();
                drawSlideOnCtx(ctx, toSlide.img, 0, 0, cw, ch);
                ctx.restore();
                break;
            case 'push':
                drawSlideOnCtx(ctx, fromSlide.img, -cw * ease, 0, cw, ch);
                drawSlideOnCtx(ctx, toSlide.img, cw - cw * ease, 0, cw, ch);
                break;
            default:
                drawSlideOnCtx(ctx, toSlide.img, 0, 0, cw, ch);
        }

        if (t < 1) {
            requestAnimationFrame(frame);
        } else {
            previewState.current = toIndex;
            previewState.transitioning = false;
            updatePreviewCounter();
            updatePreviewNotes();
        }
    }
    requestAnimationFrame(frame);
}

function previewNext() {
    if (previewState.current < previewState.slides.length - 1) {
        transitionToSlide(previewState.current, previewState.current + 1);
    }
}
function previewPrev() {
    if (previewState.current > 0) {
        transitionToSlide(previewState.current, previewState.current - 1);
    }
}

function previewKeyHandler(e) {
    if (e.key === 'Escape') { closePresentationPreview(); return; }
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); previewNext(); }
    if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); previewPrev(); }
    if (e.key === 'n' || e.key === 'N') {
        const n = document.getElementById('pptPreviewNotes');
        if (n) n.style.display = n.style.display === 'none' ? 'block' : 'none';
    }
}

function updatePreviewCounter() {
    const el = document.getElementById('pptPreviewCounter');
    if (el) el.textContent = (previewState.current + 1) + ' / ' + previewState.slides.length;
}

function updatePreviewNotes() {
    const el = document.getElementById('pptPreviewNotesText');
    if (!el) return;
    const s = previewState.slides[previewState.current];
    el.textContent = s && s.notes ? s.notes : _t('ppt_no_notes','이 슬라이드에 대한 노트가 없습니다.');
}
