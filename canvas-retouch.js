// canvas-retouch.js — 인물 보정 패널 (고품질 오프스크린 캔버스 + AILab Tools API)
import { canvas } from "./canvas-core.js?v=123";
import { sb } from "./config.js?v=123";

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
    portrait: { brightness: 8, contrast: 5, saturation: 12, warmth: 5, sharpness: 15, blur: 0 },
    vivid:    { brightness: 0,  contrast: 25, saturation: 35, warmth: 0, sharpness: 30, blur: 0 },
    warm:     { brightness: 5,  contrast: 0,  saturation: 10, warmth: 25, sharpness: 0,  blur: 0 },
    cool:     { brightness: 5,  contrast: 0,  saturation: -10, warmth: -25, sharpness: 0, blur: 0 },
    bw:       { brightness: 0,  contrast: 15, saturation: -100, warmth: 0, sharpness: 0, blur: 0 },
    soft:     { brightness: 8,  contrast: -8, saturation: 0, warmth: 0, sharpness: 0, blur: 8 },
};

// 상태
let _vals = {};
let _debounceTimer = null;
let _originalSrcMap = new WeakMap(); // 원본 이미지 보존 (객체별)

// ==========================================================
// 초기화
// ==========================================================
export function initRetouchTools() {
    const container = document.getElementById('retouchSliders');
    if (!container) return;

    // Fabric.js WebGL 대신 Canvas2D 백엔드 사용 (텍스처 크기 제한 없음)
    try {
        if (typeof fabric !== 'undefined' && fabric.Canvas2dFilterBackend) {
            fabric.filterBackend = new fabric.Canvas2dFilterBackend();
        }
    } catch (e) { /* ignore */ }

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

    // 슬라이더 이벤트 — 실시간 미리보기
    container.addEventListener('input', (e) => {
        const slider = e.target;
        if (!slider.dataset.slider) return;
        const key = slider.dataset.slider;
        _vals[key] = parseInt(slider.value, 10);
        const valSpan = container.querySelector(`[data-val="${key}"]`);
        if (valSpan) valSpan.textContent = _vals[key];
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => applyFiltersHighQuality(), 200);
    });

    // 캔버스 selection 이벤트
    canvas.on('selection:created', onSelectionChange);
    canvas.on('selection:updated', onSelectionChange);
    canvas.on('selection:cleared', onSelectionClear);

    // 적용 버튼
    const btnApply = document.getElementById('btnRetouchApply');
    if (btnApply) btnApply.addEventListener('click', () => applyFiltersHighQuality());

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
        // 원본 저장 (최초 1회)
        _saveOriginal(obj);
        // 슬라이더 초기값으로 리셋 (새 이미지 선택 시)
        _resetSliderUI();
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
// 원본 이미지 보존
// ==========================================================
function _saveOriginal(imgObj) {
    if (_originalSrcMap.has(imgObj)) return; // 이미 저장됨
    try {
        const el = imgObj._originalElement || imgObj._element;
        if (!el) return;
        // 원본 해상도로 캔버스에 그려서 보존
        const c = document.createElement('canvas');
        c.width = el.naturalWidth || el.width;
        c.height = el.naturalHeight || el.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(el, 0, 0);
        _originalSrcMap.set(imgObj, {
            dataUrl: c.toDataURL('image/png'),
            width: c.width,
            height: c.height,
        });
    } catch (e) {
        console.warn('Failed to save original:', e);
    }
}

// ==========================================================
// 슬라이더 UI 리셋
// ==========================================================
function _resetSliderUI() {
    const container = document.getElementById('retouchSliders');
    if (!container) return;
    for (const s of SLIDERS) {
        _vals[s.key] = s.def;
        const input = container.querySelector(`[data-slider="${s.key}"]`);
        const span = container.querySelector(`[data-val="${s.key}"]`);
        if (input) input.value = s.def;
        if (span) span.textContent = s.def;
    }
}

// ==========================================================
// 고품질 필터 적용 (오프스크린 캔버스 + CSS filter)
// ==========================================================
function applyFiltersHighQuality() {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;

    // 모든 값이 기본값이면 원본 복원
    const allDefault = SLIDERS.every(s => _vals[s.key] === s.def);
    if (allDefault) {
        _restoreOriginal(obj);
        return;
    }

    // 원본 이미지 로드
    const original = _originalSrcMap.get(obj);
    if (!original) {
        // 원본이 없으면 현재 이미지로 fallback
        _saveOriginal(obj);
        const saved = _originalSrcMap.get(obj);
        if (!saved) return;
        _applyToImage(obj, saved);
        return;
    }

    _applyToImage(obj, original);
}

function _applyToImage(obj, original) {
    const img = new Image();
    img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const ctx = offCanvas.getContext('2d');

        // CSS filter 문자열 구성 (원본 해상도에서 적용)
        let filterStr = '';
        const br = 1 + _vals.brightness / 100;   // 0~2
        const co = 1 + _vals.contrast / 100;      // 0~2
        let sa = 1 + _vals.saturation / 100;       // 0~2
        if (_vals.saturation === -100) sa = 0;      // grayscale

        filterStr += `brightness(${br}) `;
        filterStr += `contrast(${co}) `;
        filterStr += `saturate(${sa}) `;

        if (_vals.warmth !== 0) {
            filterStr += `hue-rotate(${_vals.warmth * 0.3}deg) `;
        }
        if (_vals.blur > 0) {
            // 이미지 크기에 비례하는 블러 (최대 이미지 폭의 0.5%)
            const blurPx = (_vals.blur / 100) * Math.max(w, h) * 0.005;
            filterStr += `blur(${blurPx.toFixed(1)}px) `;
        }

        ctx.filter = filterStr.trim();
        ctx.drawImage(img, 0, 0, w, h);

        // 선명도 (언샤프 마스크) — filter 적용 후 별도 처리
        if (_vals.sharpness > 0) {
            ctx.filter = 'none';
            _applyUnsharpMask(ctx, w, h, _vals.sharpness / 100);
        }

        // Fabric.js 이미지 소스 교체 (위치/크기/각도 유지)
        const prevW = obj.width;
        const prevH = obj.height;
        const prevScaleX = obj.scaleX;
        const prevScaleY = obj.scaleY;

        obj.setSrc(offCanvas.toDataURL('image/png'), () => {
            // setSrc 후 width/height가 변경될 수 있으므로 스케일 보정
            if (obj.width !== prevW || obj.height !== prevH) {
                obj.scaleX = prevScaleX * (prevW / obj.width);
                obj.scaleY = prevScaleY * (prevH / obj.height);
            }
            canvas.requestRenderAll();
        }, { crossOrigin: 'anonymous' });
    };
    img.src = original.dataUrl;
}

// ==========================================================
// 언샤프 마스크 (선명도 향상)
// ==========================================================
function _applyUnsharpMask(ctx, w, h, amount) {
    if (amount <= 0) return;
    // 소규모 이미지 영역만 처리 (성능)
    try {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // 블러 복사본 생성
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        tempCtx.filter = `blur(${Math.max(1, amount * 2)}px)`;
        tempCtx.drawImage(tempCanvas, 0, 0);
        const blurData = tempCtx.getImageData(0, 0, w, h).data;

        // 언샤프: original + amount * (original - blur)
        const strength = amount * 1.5; // 최대 1.5배 강도
        for (let i = 0; i < data.length; i += 4) {
            data[i]     = Math.min(255, Math.max(0, data[i]     + strength * (data[i]     - blurData[i])));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + strength * (data[i + 1] - blurData[i + 1])));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + strength * (data[i + 2] - blurData[i + 2])));
        }

        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.warn('Unsharp mask failed:', e);
    }
}

// ==========================================================
// 원본 복원
// ==========================================================
function _restoreOriginal(obj) {
    const original = _originalSrcMap.get(obj);
    if (!original) return;

    const prevW = obj.width;
    const prevH = obj.height;
    const prevScaleX = obj.scaleX;
    const prevScaleY = obj.scaleY;

    obj.setSrc(original.dataUrl, () => {
        if (obj.width !== prevW || obj.height !== prevH) {
            obj.scaleX = prevScaleX * (prevW / obj.width);
            obj.scaleY = prevScaleY * (prevH / obj.height);
        }
        obj.filters = [];
        obj.applyFilters();
        canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
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

    applyFiltersHighQuality();
}

// ==========================================================
// 초기화 (리셋)
// ==========================================================
function resetFilters() {
    _resetSliderUI();

    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'image') {
        _restoreOriginal(obj);
    }
}

// ==========================================================
// AI 보정 (AILab Tools API via Edge Function)
// ==========================================================
async function handleAiRetouch(action) {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') {
        window.showToast && window.showToast(window.t('retouch_select_image', '캔버스에서 이미지를 선택하세요'), 'warning');
        return;
    }

    const btn = document.querySelector(`[data-retouch="${action}"]`);
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${window.t('retouch_processing', 'AI 보정 중...')}</span>`;
    }

    try {
        // 원본 이미지에서 base64 추출 (필터 적용 전 원본)
        const original = _originalSrcMap.get(obj);
        let base64;
        if (original) {
            base64 = original.dataUrl.split(',')[1];
        } else {
            // 원본 없으면 현재 이미지에서
            const el = obj._originalElement || obj._element;
            const c = document.createElement('canvas');
            c.width = el.naturalWidth || el.width;
            c.height = el.naturalHeight || el.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(el, 0, 0);
            base64 = c.toDataURL('image/png').split(',')[1];
        }

        // Edge Function 호출
        const { data, error } = await sb.functions.invoke('portrait-retouch', {
            body: { action, image_base64: base64 }
        });

        if (error) throw new Error(error.message || 'Edge Function error');
        if (!data || (!data.image_url && !data.image_base64)) throw new Error(data?.error || 'No result');

        const imgSrc = data.image_base64
            ? `data:image/png;base64,${data.image_base64}`
            : data.image_url;

        // 결과 이미지로 교체 (위치/크기 유지)
        await new Promise((resolve, reject) => {
            const newImg = new Image();
            newImg.crossOrigin = 'anonymous';
            newImg.onload = () => {
                const prevW = obj.width;
                const prevH = obj.height;
                const prevScaleX = obj.scaleX;
                const prevScaleY = obj.scaleY;

                obj.setSrc(imgSrc, () => {
                    // 크기 보정
                    if (obj.width !== prevW || obj.height !== prevH) {
                        obj.scaleX = prevScaleX * (prevW / obj.width);
                        obj.scaleY = prevScaleY * (prevH / obj.height);
                    }
                    // AI 결과를 새 "원본"으로 저장
                    _originalSrcMap.set(obj, {
                        dataUrl: imgSrc,
                        width: newImg.naturalWidth,
                        height: newImg.naturalHeight,
                    });
                    _resetSliderUI(); // 슬라이더 리셋
                    canvas.requestRenderAll();
                    resolve();
                }, { crossOrigin: 'anonymous' });
            };
            newImg.onerror = () => reject(new Error('Failed to load result image'));
            newImg.src = imgSrc;
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
