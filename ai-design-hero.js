import { sb } from './config.js?v=292';

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const FN_URL = SUPABASE_URL + '/functions/v1/ai-design-gen';

// ── 사이즈 프리셋 (GPT가 제공하는 이미지 aspect ratio) ──
// w / h 는 에디터 캔버스용 mm 단위 (AI 이미지 aspect에 맞춰 정한 값)
const SIZE_PRESETS = [
    { key:'auto',    label:'자동',       dim:'AI 선택',   w:1000, h:1000, model:'auto',      en:'auto aspect ratio, model picks best' },
    { key:'square',  label:'정사각형',   dim:'1:1',       w:1000, h:1000, model:'1024x1024', en:'square 1:1 composition' },
    { key:'portrait',label:'세로',       dim:'3:4',       w:1050, h:1400, model:'1024x1536', en:'portrait 3:4 composition' },
    { key:'story',   label:'스토리',     dim:'9:16',      w:900,  h:1600, model:'1024x1536', en:'vertical story 9:16 composition' },
    { key:'land',    label:'가로',       dim:'4:3',       w:1400, h:1050, model:'1536x1024', en:'landscape 4:3 composition' },
    { key:'wide',    label:'와이드',     dim:'16:9',      w:1600, h:900,  model:'1536x1024', en:'widescreen 16:9 composition' },
];

// ── 배경 색상 팔레트 ──
const COLOR_PRESETS = [
    { key:'white',   hex:'#ffffff', en:'clean white' },
    { key:'ivory',   hex:'#faf7f2', en:'soft ivory' },
    { key:'navy',    hex:'#1e3a8a', en:'deep navy blue' },
    { key:'blue',    hex:'#2563eb', en:'vibrant blue' },
    { key:'sky',     hex:'#38bdf8', en:'sky blue' },
    { key:'green',   hex:'#16a34a', en:'fresh green' },
    { key:'mint',    hex:'#6ee7b7', en:'mint pastel' },
    { key:'yellow',  hex:'#facc15', en:'sunny yellow' },
    { key:'orange',  hex:'#f97316', en:'warm orange' },
    { key:'red',     hex:'#dc2626', en:'bold red' },
    { key:'pink',    hex:'#ec4899', en:'vivid pink' },
    { key:'purple',  hex:'#8b5cf6', en:'rich purple' },
    { key:'lavender',hex:'#e0d9ff', en:'soft lavender' },
    { key:'gray',    hex:'#64748b', en:'slate gray' },
    { key:'black',   hex:'#111827', en:'deep black' },
    { key:'beige',   hex:'#d6cfc0', en:'warm beige' },
    { key:'peach',   hex:'#fed7aa', en:'peach pastel' },
    { key:'teal',    hex:'#0d9488', en:'modern teal' },
    { key:'gold',    hex:'#ca8a04', en:'luxury gold' },
    { key:'gradient',hex:'linear-gradient(135deg,#8b5cf6,#ec4899)', en:'gradient purple-to-pink' },
];

let selectedSize = SIZE_PRESETS[0]; // 기본: 자동
let selectedColor = COLOR_PRESETS[0]; // 기본: 흰색
const attachedImages = [];

function renderSizeGrid() {
    const grid = document.getElementById('aiSizeGrid');
    if (!grid) return;
    grid.innerHTML = SIZE_PRESETS.map(s => {
        const sel = selectedSize.key === s.key ? 'selected' : '';
        return `<div class="aid-size-card ${sel}" data-key="${s.key}" onclick="window.selectAiSize('${s.key}')">
            <span class="name">${s.label}</span>
            <span class="dim">${s.dim}</span>
        </div>`;
    }).join('');
}

function renderColorGrid() {
    const grid = document.getElementById('aiColorGrid');
    if (!grid) return;
    let html = COLOR_PRESETS.map(c => {
        const sel = selectedColor.key === c.key ? 'selected' : '';
        const bg = c.hex.startsWith('linear') ? `background:${c.hex};` : `background:${c.hex};`;
        return `<div class="aid-color-swatch ${sel}" title="${c.key}" style="${bg}" onclick="window.selectAiColor('${c.key}')"></div>`;
    }).join('');
    // 수동 색상 선택기 — 마지막 칸
    const customSel = selectedColor.key === 'custom' ? 'selected' : '';
    const customBg = selectedColor.key === 'custom' ? selectedColor.hex : '#ffffff';
    html += `<div class="aid-color-swatch aid-color-custom ${customSel}" title="직접 선택"
        style="background:conic-gradient(from 180deg, red, yellow, lime, cyan, blue, magenta, red); position:relative;"
        onclick="document.getElementById('aiColorPicker').click()">
        <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; font-weight:900; text-shadow:0 0 4px rgba(0,0,0,0.6);">+</span>
        ${customSel ? `<span style="position:absolute; inset:0; background:${customBg}; border-radius:inherit;"></span><span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; text-shadow:0 1px 3px rgba(0,0,0,0.5);">✓</span>` : ''}
        <input id="aiColorPicker" type="color" value="${customSel ? customBg : '#8b5cf6'}" style="position:absolute; inset:0; opacity:0; cursor:pointer;" onchange="window.selectCustomAiColor(this.value)">
    </div>`;
    grid.innerHTML = html;
}

window.selectAiSize = function(key) {
    const found = SIZE_PRESETS.find(s => s.key === key);
    if (found) { selectedSize = found; renderSizeGrid(); }
};
window.selectAiColor = function(key) {
    const found = COLOR_PRESETS.find(c => c.key === key);
    if (found) { selectedColor = found; renderColorGrid(); }
};
// 수동 색상 선택
window.selectCustomAiColor = function(hex) {
    if (!hex) return;
    // 간단한 hex → 영어 묘사 (Lightness 기반)
    const rgb = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    let desc = 'custom color ' + hex;
    if (rgb) {
        const r = parseInt(rgb[1],16), g = parseInt(rgb[2],16), b = parseInt(rgb[3],16);
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        const l = (max+min) / 510;
        desc = `${l>0.85?'very light ':l<0.2?'deep dark ':l<0.45?'rich ':''}${hex} color`;
    }
    selectedColor = { key:'custom', hex, en: desc };
    renderColorGrid();
};

function relocateAiPanel() {
    const panel = document.getElementById('aiDesignHero');
    const hero = document.querySelector('#startScreen .hero-section') || document.querySelector('.hero-section');
    if (panel && hero && hero.parentNode && panel.previousElementSibling !== hero) {
        hero.parentNode.insertBefore(panel, hero.nextSibling);
    }
}
function initAi() {
    relocateAiPanel();
    renderSizeGrid();
    renderColorGrid();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAi);
} else {
    initAi();
}
setTimeout(initAi, 300);
setTimeout(initAi, 1500);

function renderThumbs() {
    const wrap = document.getElementById('aiDesignThumbs');
    if (!wrap) return;
    wrap.innerHTML = '';
    attachedImages.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'aid-thumb';
        div.innerHTML = `<img src="${img.dataUrl}" alt="첨부"><button type="button" title="제거" onclick="window.removeAiDesignImage(${idx})">×</button>`;
        wrap.appendChild(div);
    });
}

window.addAiDesignImages = function(files) {
    if (!files || files.length === 0) return;
    const remaining = 4 - attachedImages.length;
    if (remaining <= 0) { alert('최대 4장까지 첨부 가능합니다.'); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    toAdd.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 8 * 1024 * 1024) { alert(`"${file.name}"은 8MB를 초과합니다.`); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImages.push({ file, dataUrl: e.target.result });
            renderThumbs();
        };
        reader.readAsDataURL(file);
    });
};
window.removeAiDesignImage = function(idx) { attachedImages.splice(idx, 1); renderThumbs(); };

// ── 한/영 혼용 → 영어 프롬프트 빌더 ──
function buildEnglishPrompt() {
    const title = (document.getElementById('aiDesignTitle')?.value || '').trim();
    const extra = (document.getElementById('aiDesignPrompt')?.value || '').trim();

    const parts = [];
    parts.push(`Full-bleed professional design. Aspect: ${selectedSize.en}.`);
    parts.push('The design must FILL the ENTIRE frame edge-to-edge — NO white border, NO padding, NO margin, NO outer frame. Composition extends completely to all four edges.');
    parts.push(`Background: ${selectedColor.en}.`);
    if (title) {
        parts.push(`Large prominent title text (ENGLISH LATIN CHARACTERS only): "${title}".`);
    }
    parts.push('Modern, clean, commercial print-ready layout. Balanced composition. Clear visual hierarchy.');
    parts.push('All text in the image MUST be English only — no Korean or other scripts. No gibberish or mistranslated characters.');
    if (extra) {
        parts.push(`Additional style/elements (interpret visually): ${extra}`);
    }
    parts.push('High quality, editorial, sharp typography.');
    return parts.join(' ');
}

window.generateAiDesign = async function() {
    const btnEl = document.getElementById('aiDesignBtn');
    const resultEl = document.getElementById('aiDesignResult');
    const quotaEl = document.getElementById('aiDesignQuota');

    const prompt = buildEnglishPrompt();

    btnEl.disabled = true;
    const originalBtnHtml = btnEl.innerHTML;
    btnEl.innerHTML = '⏳ 생성중...';
    btnEl.style.cursor = 'not-allowed';
    btnEl.style.opacity = '0.7';

    resultEl.innerHTML = `<div class="aid-preview-loading">
        <div class="spinner"></div>
        <div style="font-size:15px; color:#6d28d9; font-weight:800; margin-bottom:6px;">AI가 디자인을 생성중입니다</div>
        <div style="font-size:12px; color:#64748b;">약 2~3분 정도 소요됩니다. 잠시만 기다려 주세요.</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:8px;">${selectedSize.label} · ${selectedSize.dim}</div>
    </div>`;

    try {
        let authToken = '';
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.access_token) authToken = session.access_token;
        } catch(e) {}

        const headers = {
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + (authToken || SUPABASE_ANON),
        };

        let fetchBody;
        if (attachedImages.length > 0) {
            const fd = new FormData();
            fd.append('prompt', prompt);
            fd.append('size', selectedSize.model);
            if (authToken) fd.append('authToken', authToken);
            attachedImages.forEach((img, i) => {
                fd.append('image', img.file, img.file.name || `upload-${i}.png`);
            });
            fetchBody = fd;
        } else {
            headers['Content-Type'] = 'application/json';
            fetchBody = JSON.stringify({ prompt, size: selectedSize.model, authToken });
        }

        const res = await fetch(FN_URL, { method: 'POST', headers, body: fetchBody });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const msg = data?.error || `오류 (${res.status})`;
            const detail = data?.detail ? `<div style="margin-top:6px; font-size:11px; color:#7f1d1d; opacity:0.8;">${escapeHtml(data.detail)}</div>` : '';
            resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
                <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
                <div style="font-size:14px; font-weight:700;">${escapeHtml(msg)}</div>${detail}
            </div>`;
            return;
        }

        const { imageUrl } = data;

        if (quotaEl) {
            quotaEl.textContent = '✓ 생성 완료';
            quotaEl.style.background = '#ecfdf5';
            quotaEl.style.color = '#065f46';
            quotaEl.style.borderColor = '#a7f3d0';
        }

        resultEl.innerHTML = `
            <div class="aid-preview-img-wrap">
                <img src="${imageUrl}" alt="AI 생성 이미지">
            </div>
            <div class="aid-preview-actions">
                <button type="button" class="aid-act-primary" onclick="window.sendAiDesignToEditor && window.sendAiDesignToEditor('${imageUrl}', '${selectedSize.key}', ${selectedSize.w}, ${selectedSize.h})">
                    ✏️ 에디터로 추가편집
                </button>
                <a href="${imageUrl}" download="ai-design-${selectedSize.key}-${Date.now()}.png" target="_blank" class="aid-act-secondary">
                    💾 고화질 다운로드
                </a>
            </div>
        `;
    } catch (e) {
        console.error('AI design error:', e);
        resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
            <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
            <div style="font-size:14px; font-weight:700;">네트워크 오류</div>
            <div style="margin-top:6px; font-size:12px;">${escapeHtml(String(e.message || e))}</div>
        </div>`;
    } finally {
        btnEl.disabled = false;
        btnEl.innerHTML = originalBtnHtml;
        btnEl.style.cursor = 'pointer';
        btnEl.style.opacity = '1';
    }
};

window.sendAiDesignToEditor = function(imageUrl, sizeKey, widthMm, heightMm) {
    // 'auto' 사이즈는 실제 이미지 비율에 맞춰 캔버스 크기 결정
    if (sizeKey === 'auto') {
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onload = () => {
            const maxSide = 1200;
            let w, h;
            if (probe.naturalWidth >= probe.naturalHeight) {
                w = maxSide;
                h = Math.max(200, Math.round(maxSide * probe.naturalHeight / probe.naturalWidth));
            } else {
                h = maxSide;
                w = Math.max(200, Math.round(maxSide * probe.naturalWidth / probe.naturalHeight));
            }
            openEditorWithAiImage(imageUrl, sizeKey, w, h);
        };
        probe.onerror = () => openEditorWithAiImage(imageUrl, sizeKey, 1000, 1000);
        probe.src = imageUrl;
        return;
    }
    openEditorWithAiImage(imageUrl, sizeKey, widthMm, heightMm);
};

function openEditorWithAiImage(imageUrl, sizeKey, widthMm, heightMm) {
    try {
        sessionStorage.setItem('ai_design_bg_image', imageUrl);
        sessionStorage.setItem('ai_design_canvas_size', JSON.stringify({
            sizeKey: sizeKey || '',
            widthMm: widthMm || 0,
            heightMm: heightMm || 0,
        }));
    } catch(e) {}

    if (typeof window.startEditorDirect === 'function' && widthMm && heightMm) {
        Promise.resolve(window.startEditorDirect('custom', widthMm, heightMm)).then(() => {
            injectAiImageToCanvas();
        }).catch(e => { console.warn('editor open failed:', e); });
        return;
    }
    const selfDesignBtn = document.querySelector('[data-i18n="self_design"], .adv-ext-btn');
    if (selfDesignBtn) { selfDesignBtn.click(); setTimeout(injectAiImageToCanvas, 800); return; }
    alert('에디터를 열 수 없습니다.');
}

// 에디터 캔버스가 준비되면 AI 생성 이미지를 추가
function injectAiImageToCanvas() {
    let retries = 0;
    const attempt = () => {
        const canvas = window.canvas;
        if (canvas && typeof fabric !== 'undefined' && fabric.Image) {
            const imgUrl = sessionStorage.getItem('ai_design_bg_image');
            if (!imgUrl) return;
            fabric.Image.fromURL(imgUrl, (img) => {
                if (!img) { console.warn('AI image load failed'); return; }
                const cw = canvas.width || 1000, ch = canvas.height || 1000;
                const iw = img.width || 1024, ih = img.height || 1024;
                const scale = Math.min(cw / iw, ch / ih);
                img.set({
                    left: (cw - iw * scale) / 2,
                    top: (ch - ih * scale) / 2,
                    scaleX: scale, scaleY: scale,
                    selectable: true, hasControls: true,
                });
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                try { sessionStorage.removeItem('ai_design_bg_image'); } catch(e) {}
            }, { crossOrigin: 'anonymous' });
        } else if (retries++ < 40) {
            setTimeout(attempt, 250);
        }
    };
    setTimeout(attempt, 600);
}
window._injectAiImageToCanvas = injectAiImageToCanvas;

// 로그인 리디렉션 등으로 페이지가 재로딩된 뒤에도 AI 이미지가 보존돼 있으면 자동 주입
(function watchPendingAiImage(){
    try {
        if (!sessionStorage.getItem('ai_design_bg_image')) return;
    } catch(e) { return; }
    const editorOpen = () => {
        const me = document.getElementById('mainEditor');
        if (me && me.style.display === 'flex') return true;
        if (document.body && document.body.classList.contains('editor-active')) return true;
        return false;
    };
    const iv = setInterval(() => {
        if (editorOpen() && window.canvas) { clearInterval(iv); injectAiImageToCanvas(); }
    }, 400);
    setTimeout(() => clearInterval(iv), 45000);
})();

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.getElementById('aiDesignTitle');
    if (titleEl) {
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); window.generateAiDesign(); }
        });
    }
});
