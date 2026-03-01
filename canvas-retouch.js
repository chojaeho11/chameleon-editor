// canvas-retouch.js — 인물 보정 패널 (Fabric.js 필터 + AILab Tools API)
import { canvas } from "./canvas-core.js?v=123";
import { sb } from "./config.js?v=123";

// ==========================================================
// [유틸] DB secrets 테이블에서 API 키
// ==========================================================
let _ailabKey = null;
async function getAilabKey() {
    if (_ailabKey) return _ailabKey;
    if (!sb) return null;
    const { data, error } = await sb
        .from('secrets').select('value').eq('name', 'AILAB_API_KEY').single();
    if (error || !data) { console.error('AILAB_API_KEY load failed:', error); return null; }
    _ailabKey = data.value;
    return _ailabKey;
}

// ==========================================================
// 슬라이더 정의
// ==========================================================
const SLIDERS = [
    { key: 'brightness',  i18n: 'retouch_brightness',  label: '밝기',   min: -100, max: 100, def: 0 },
    { key: 'contrast',    i18n: 'retouch_contrast',    label: '대비',   min: -100, max: 100, def: 0 },
    { key: 'saturation',  i18n: 'retouch_saturation',  label: '채도',   min: -100, max: 100, def: 0 },
    { key: 'warmth',      i18n: 'retouch_warmth',      label: '색온도', min: -100, max: 100, def: 0 },
    { key: 'sharpness',   i18n: 'retouch_sharpness',   label: '선명도', min: 0,    max: 100, def: 0 },
    { key: 'blur',        i18n: 'retouch_blur',        label: '흐림',   min: 0,    max: 100, def: 0 },
];

// ==========================================================
// 퀵 프리셋 정의
// ==========================================================
const PRESETS = {
    portrait: { brightness: 10, contrast: 5, saturation: 10, warmth: 5, sharpness: 20, blur: 0 },
    vivid:    { brightness: 0,  contrast: 30, saturation: 40, warmth: 0, sharpness: 40, blur: 0 },
    warm:     { brightness: 5,  contrast: 0,  saturation: 10, warmth: 30, sharpness: 0,  blur: 0 },
    cool:     { brightness: 5,  contrast: 0,  saturation: -10, warmth: -30, sharpness: 0, blur: 0 },
    bw:       { brightness: 0,  contrast: 15, saturation: -100, warmth: 0, sharpness: 0, blur: 0 },
    soft:     { brightness: 10, contrast: -10, saturation: 0, warmth: 0, sharpness: 0, blur: 15 },
};

// 현재 슬라이더 값
let _vals = {};
let _debounceTimer = null;

// ==========================================================
// 초기화
// ==========================================================
export function initRetouchTools() {
    const container = document.getElementById('retouchSliders');
    if (!container) return;

    // 슬라이더 DOM 생성
    for (const s of SLIDERS) {
        _vals[s.key] = s.def;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:6px;';
        row.innerHTML = `
            <span style="font-size:11px; color:#64748b; width:48px; flex-shrink:0;" data-i18n="${s.i18n}">${s.label}</span>
            <input type="range" data-slider="${s.key}" min="${s.min}" max="${s.max}" value="${s.def}"
                   style="flex:1; height:4px; accent-color:#6366f1; cursor:pointer;">
            <span data-val="${s.key}" style="font-size:10px; color:#94a3b8; width:28px; text-align:right;">${s.def}</span>
        `;
        container.appendChild(row);
    }

    // 슬라이더 이벤트
    container.addEventListener('input', (e) => {
        const slider = e.target;
        if (!slider.dataset.slider) return;
        const key = slider.dataset.slider;
        _vals[key] = parseInt(slider.value, 10);
        const valSpan = container.querySelector(`[data-val="${key}"]`);
        if (valSpan) valSpan.textContent = _vals[key];
        // debounce 실시간 미리보기
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => applyFiltersToSelected(), 150);
    });

    // 캔버스 selection 이벤트
    canvas.on('selection:created', onSelectionChange);
    canvas.on('selection:updated', onSelectionChange);
    canvas.on('selection:cleared', onSelectionClear);

    // 적용 버튼
    const btnApply = document.getElementById('btnRetouchApply');
    if (btnApply) btnApply.addEventListener('click', () => applyFiltersToSelected());

    // 초기화 버튼
    const btnReset = document.getElementById('btnRetouchReset');
    if (btnReset) btnReset.addEventListener('click', resetFilters);

    // AI 보정 버튼들
    document.querySelectorAll('[data-retouch]').forEach(btn => {
        btn.addEventListener('click', () => handleAiRetouch(btn.dataset.retouch));
    });

    // 퀵 프리셋 버튼들
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
}

// ==========================================================
// Selection 핸들러
// ==========================================================
function onSelectionChange() {
    const obj = canvas.getActiveObject();
    const noSel = document.getElementById('retouchNoSel');
    const controls = document.getElementById('retouchControls');
    if (obj && obj.type === 'image') {
        if (noSel) noSel.style.display = 'none';
        if (controls) controls.style.display = 'block';
        // 현재 이미지의 필터 상태를 슬라이더에 반영
        syncSlidersFromImage(obj);
    } else {
        if (noSel) noSel.style.display = 'block';
        if (controls) controls.style.display = 'none';
    }
}

function onSelectionClear() {
    const noSel = document.getElementById('retouchNoSel');
    const controls = document.getElementById('retouchControls');
    if (noSel) noSel.style.display = 'block';
    if (controls) controls.style.display = 'none';
}

// ==========================================================
// 슬라이더 → 이미지 필터 동기화
// ==========================================================
function syncSlidersFromImage(img) {
    // 기존 필터에서 현재 값 읽기
    const filters = img.filters || [];
    const vals = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpness: 0, blur: 0 };

    for (const f of filters) {
        if (!f) continue;
        if (f.type === 'Brightness') vals.brightness = Math.round(f.brightness * 100);
        else if (f.type === 'Contrast') vals.contrast = Math.round(f.contrast * 100);
        else if (f.type === 'Saturation') vals.saturation = Math.round(f.saturation * 100);
        else if (f.type === 'HueRotation') vals.warmth = Math.round(f.rotation * 200);
        else if (f.type === 'Blur') vals.blur = Math.round(f.blur * 100);
        else if (f.type === 'Convolute' && f._retouchSharpness) vals.sharpness = f._retouchSharpness;
    }

    // 슬라이더 UI 업데이트
    const container = document.getElementById('retouchSliders');
    if (!container) return;
    for (const s of SLIDERS) {
        const v = vals[s.key] !== undefined ? vals[s.key] : s.def;
        _vals[s.key] = v;
        const input = container.querySelector(`[data-slider="${s.key}"]`);
        const span = container.querySelector(`[data-val="${s.key}"]`);
        if (input) input.value = v;
        if (span) span.textContent = v;
    }
}

// ==========================================================
// 필터 적용 (Fabric.js 내장 필터)
// ==========================================================
function applyFiltersToSelected() {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;

    const filters = [];

    // Brightness
    if (_vals.brightness !== 0) {
        filters.push(new fabric.Image.filters.Brightness({ brightness: _vals.brightness / 100 }));
    }
    // Contrast
    if (_vals.contrast !== 0) {
        filters.push(new fabric.Image.filters.Contrast({ contrast: _vals.contrast / 100 }));
    }
    // Saturation — Grayscale for -100, otherwise Saturation filter
    if (_vals.saturation === -100) {
        filters.push(new fabric.Image.filters.Grayscale());
    } else if (_vals.saturation !== 0) {
        filters.push(new fabric.Image.filters.Saturation({ saturation: _vals.saturation / 100 }));
    }
    // Warmth (HueRotation)
    if (_vals.warmth !== 0) {
        filters.push(new fabric.Image.filters.HueRotation({ rotation: _vals.warmth / 200 }));
    }
    // Sharpness (Convolute)
    if (_vals.sharpness > 0) {
        const s = _vals.sharpness / 100;
        const center = 1 + 4 * s;
        const edge = -s;
        const conv = new fabric.Image.filters.Convolute({
            matrix: [0, edge, 0, edge, center, edge, 0, edge, 0]
        });
        conv._retouchSharpness = _vals.sharpness; // 내부 태그
        filters.push(conv);
    }
    // Blur
    if (_vals.blur > 0) {
        filters.push(new fabric.Image.filters.Blur({ blur: _vals.blur / 100 }));
    }

    obj.filters = filters;
    obj.applyFilters();
    canvas.requestRenderAll();
}

// ==========================================================
// 프리셋 적용
// ==========================================================
function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;

    const container = document.getElementById('retouchSliders');
    if (!container) return;

    for (const s of SLIDERS) {
        const v = p[s.key] !== undefined ? p[s.key] : s.def;
        _vals[s.key] = v;
        const input = container.querySelector(`[data-slider="${s.key}"]`);
        const span = container.querySelector(`[data-val="${s.key}"]`);
        if (input) input.value = v;
        if (span) span.textContent = v;
    }

    applyFiltersToSelected();
}

// ==========================================================
// 초기화
// ==========================================================
function resetFilters() {
    const container = document.getElementById('retouchSliders');
    if (!container) return;

    for (const s of SLIDERS) {
        _vals[s.key] = s.def;
        const input = container.querySelector(`[data-slider="${s.key}"]`);
        const span = container.querySelector(`[data-val="${s.key}"]`);
        if (input) input.value = s.def;
        if (span) span.textContent = s.def;
    }

    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'image') {
        obj.filters = [];
        obj.applyFilters();
        canvas.requestRenderAll();
    }
}

// ==========================================================
// AI 보정 (AILab Tools API)
// ==========================================================
async function handleAiRetouch(action) {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') {
        window.showToast && window.showToast(window.t('retouch_select_image', '캔버스에서 이미지를 선택하세요'), 'warning');
        return;
    }

    // 버튼 로딩 상태
    const btn = document.querySelector(`[data-retouch="${action}"]`);
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${window.t('retouch_processing', 'AI 보정 중...')}</span>`;
    }

    try {
        // 이미지를 base64로 추출
        const dataUrl = obj.toDataURL({ format: 'png', multiplier: 1 });
        const base64 = dataUrl.split(',')[1];

        // Edge Function 호출
        const { data, error } = await sb.functions.invoke('portrait-retouch', {
            body: { action, image_base64: base64 }
        });

        if (error) throw new Error(error.message || 'Edge Function error');
        if (!data || (!data.image_url && !data.image_base64)) throw new Error(data?.error || 'No result');

        // 결과 이미지로 교체 — 위치/크기 유지
        const imgSrc = data.image_base64
            ? `data:image/png;base64,${data.image_base64}`
            : data.image_url;

        await new Promise((resolve, reject) => {
            fabric.Image.fromURL(imgSrc, (newImg) => {
                if (!newImg) return reject(new Error('Failed to load result image'));

                // 기존 속성 유지
                const props = {
                    left: obj.left,
                    top: obj.top,
                    scaleX: obj.scaleX * (obj.width / newImg.width),
                    scaleY: obj.scaleY * (obj.height / newImg.height),
                    angle: obj.angle,
                    flipX: obj.flipX,
                    flipY: obj.flipY,
                    opacity: obj.opacity,
                    clipPath: obj.clipPath,
                    selectable: obj.selectable,
                    evented: obj.evented,
                };

                // 기존 객체의 인덱스
                const idx = canvas.getObjects().indexOf(obj);

                // 속성 적용
                newImg.set(props);

                // 웨딩 커스텀 속성 복사
                if (obj.isWedPlaceholder) newImg.isWedPlaceholder = obj.isWedPlaceholder;
                if (obj.isWedPlaceholderText) newImg.isWedPlaceholderText = obj.isWedPlaceholderText;
                if (obj.wedPlaceholderId) newImg.wedPlaceholderId = obj.wedPlaceholderId;

                // 교체
                canvas.remove(obj);
                canvas.insertAt(newImg, idx);
                canvas.setActiveObject(newImg);
                canvas.requestRenderAll();

                resolve();
            }, { crossOrigin: 'anonymous' });
        });

        window.showToast && window.showToast(window.t('retouch_done', '보정 완료!'), 'success');
    } catch (e) {
        console.error('AI Retouch error:', e);
        window.showToast && window.showToast(window.t('retouch_error', '보정 실패') + ': ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
}
