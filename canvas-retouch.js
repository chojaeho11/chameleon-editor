// canvas-retouch.js — AI 보정 패널 (고품질 필터 + AILab Tools 전체 API)
import { canvas } from "./canvas-core.js?v=134";
import { sb } from "./config.js?v=134";

// ==========================================================
// 슬라이더 & 프리셋 정의
// ==========================================================
const SLIDERS = [
    { key: 'brightness',  i18n: 'retouch_brightness',  label: '밝기',   min: -100, max: 100, def: 0 },
    { key: 'contrast',    i18n: 'retouch_contrast',    label: '대비',   min: -100, max: 100, def: 0 },
    { key: 'saturation',  i18n: 'retouch_saturation',  label: '채도',   min: -100, max: 100, def: 0 },
    { key: 'warmth',      i18n: 'retouch_warmth',      label: '색온도', min: -100, max: 100, def: 0 },
    { key: 'sharpness',   i18n: 'retouch_sharpness',   label: '선명도', min: 0,    max: 100, def: 0 },
    { key: 'blur',        i18n: 'retouch_blur',        label: '흐림',   min: 0,    max: 100, def: 0 },
];
const PRESETS = {
    portrait: { brightness: 8, contrast: 5, saturation: 12, warmth: 5, sharpness: 15, blur: 0 },
    vivid:    { brightness: 0, contrast: 25, saturation: 35, warmth: 0, sharpness: 30, blur: 0 },
    warm:     { brightness: 5, contrast: 0, saturation: 10, warmth: 25, sharpness: 0, blur: 0 },
    cool:     { brightness: 5, contrast: 0, saturation: -10, warmth: -25, sharpness: 0, blur: 0 },
    bw:       { brightness: 0, contrast: 15, saturation: -100, warmth: 0, sharpness: 0, blur: 0 },
    soft:     { brightness: 8, contrast: -8, saturation: 0, warmth: 0, sharpness: 0, blur: 8 },
};

// ==========================================================
// 옵션 선택이 필요한 AI 기능 정의
// ==========================================================
// t() 헬퍼 — window.t 가 없으면 fallback 반환
const _t = (key, fb) => (typeof window.t === 'function' ? window.t(key, fb) : fb);

const AI_OPTIONS = {
    cartoon: {
        titleKey: 'opt_title_cartoon', title: '만화 스타일 선택',
        options: [
            { value: '3d_cartoon', key: 'opt_3d_cartoon', label: '3D 카툰' },
            { value: 'pixar', key: 'opt_pixar', label: 'Pixar' },
            { value: 'pixar_plus', key: 'opt_pixar_plus', label: 'Pixar+' },
            { value: 'anime', key: 'opt_anime', label: '애니메' },
            { value: 'jpcartoon', key: 'opt_jpcartoon', label: '일본 카툰' },
            { value: 'comic', key: 'opt_comic', label: '코믹' },
            { value: 'sketch', key: 'opt_sketch', label: '스케치' },
            { value: 'handdrawn', key: 'opt_handdrawn', label: '손그림' },
            { value: '3d', key: 'opt_3d_doll', label: '3D 인형' },
            { value: '3d_game', key: 'opt_3d_game', label: '3D 게임' },
            { value: 'angel', key: 'opt_angel', label: '천사' },
            { value: 'demon', key: 'opt_demon', label: '악마' },
            { value: 'artstyle', key: 'opt_artstyle', label: '아트' },
            { value: 'animation3d', key: 'opt_animation3d', label: '3D 애니' },
            { value: 'classic_cartoon', key: 'opt_classic_cartoon', label: '클래식 카툰' },
            { value: 'hongkong', key: 'opt_hongkong', label: '홍콩 스타일' },
        ],
        paramKey: 'type',
    },
    emotion: {
        titleKey: 'opt_title_emotion', title: '표정 선택',
        options: [
            { value: '10', key: 'opt_dimple_smile', label: '보조개 미소' },
            { value: '11', key: 'opt_belly_dimple', label: '배 보조개' },
            { value: '12', key: 'opt_big_smile', label: '활짝 웃기' },
            { value: '13', key: 'opt_hearty_laugh', label: '함박 웃음' },
            { value: '14', key: 'opt_cool_pose', label: '쿨한 포즈' },
            { value: '15', key: 'opt_sad', label: '슬픔' },
            { value: '16', key: 'opt_forced_smile', label: '억지 웃음' },
            { value: '100', key: 'opt_open_eyes', label: '눈뜨기' },
        ],
        paramKey: 'service_choice',
    },
    age_gender: {
        titleKey: 'opt_title_age', title: '변환 유형 선택',
        options: [
            { value: 'TO_KID', key: 'opt_to_kid', label: '어린이로' },
            { value: 'TO_OLD', key: 'opt_to_old', label: '노인으로' },
            { value: 'TO_FEMALE', key: 'opt_to_female', label: '여성으로' },
            { value: 'TO_MALE', key: 'opt_to_male', label: '남성으로' },
        ],
        paramKey: 'action_type',
    },
    face_filter: {
        titleKey: 'opt_title_filter', title: '얼굴 필터 선택',
        options: [
            { value: '10001', key: 'opt_natural', label: '내추럴' },
            { value: '10002', key: 'opt_whitening', label: '화이트닝' },
            { value: '10003', key: 'opt_pink', label: '핑크' },
            { value: '10010', key: 'opt_elegant', label: '우아한' },
            { value: '10011', key: 'opt_youth', label: '청춘' },
            { value: '10015', key: 'opt_retro', label: '레트로' },
            { value: '10020', key: 'opt_cinema', label: '시네마' },
            { value: '10025', key: 'opt_vintage', label: '빈티지' },
            { value: '10030', key: 'opt_warm_tone', label: '따뜻한 톤' },
            { value: '10035', key: 'opt_cool_tone', label: '차가운 톤' },
            { value: '10040', key: 'opt_dramatic', label: '드라마틱' },
            { value: '10050', key: 'opt_monochrome', label: '모노크롬' },
            { value: '10060', key: 'opt_neon', label: '네온' },
            { value: '10070', key: 'opt_sunset', label: '선셋' },
        ],
        paramKey: 'resource_type',
    },
    hairstyle: {
        titleKey: 'opt_title_hair', title: '헤어스타일 선택',
        options: [
            { value: 'BobCut', key: 'opt_bobcut', label: '밥컷' },
            { value: 'LongStraight', key: 'opt_long_straight', label: '롱 스트레이트' },
            { value: 'LongWavy', key: 'opt_long_wavy', label: '롱 웨이브' },
            { value: 'LongCurly', key: 'opt_long_curly', label: '롱 컬리' },
            { value: 'PixieCut', key: 'opt_pixie', label: '픽시컷' },
            { value: 'CurlyBob', key: 'opt_curly_bob', label: '컬리 밥' },
            { value: 'Ponytail', key: 'opt_ponytail', label: '포니테일' },
            { value: 'Updo', key: 'opt_updo', label: '업도' },
            { value: 'Chignon', key: 'opt_chignon', label: '시뇽' },
            { value: 'FishtailBraid', key: 'opt_fishtail', label: '피쉬테일' },
            { value: 'TwinBraids', key: 'opt_twin_braids', label: '트윈 브레이드' },
            { value: 'ShortPixieWithShavedSides', key: 'opt_shaved_sides', label: '사이드 쉐이브' },
            { value: 'DoubleBun', key: 'opt_double_bun', label: '더블 번' },
            { value: 'Dreadlocks', key: 'opt_dreadlocks', label: '드레드락' },
            { value: 'ShoulderLengthHair', key: 'opt_shoulder', label: '어깨 길이' },
            { value: 'BoxBraids', key: 'opt_box_braids', label: '박스 브레이드' },
            { value: 'BuzzCut', key: 'opt_buzzcut', label: '버즈컷' },
            { value: 'UnderCut', key: 'opt_undercut', label: '언더컷' },
            { value: 'Pompadour', key: 'opt_pompadour', label: '퐁파두르' },
            { value: 'SlickBack', key: 'opt_slickback', label: '슬릭백' },
            { value: 'CurlyShag', key: 'opt_curly_shag', label: '컬리 쉐그' },
            { value: 'WavyShag', key: 'opt_wavy_shag', label: '웨이비 쉐그' },
            { value: 'FauxHawk', key: 'opt_fauxhawk', label: '포호크' },
            { value: 'TwoBlockHaircut', key: 'opt_twoblock', label: '투블럭' },
            { value: 'ManBun', key: 'opt_manbun', label: '맨번' },
            { value: 'CombOver', key: 'opt_combover', label: '콤오버' },
            { value: 'Afro', key: 'opt_afro', label: '아프로' },
            { value: 'CornrowBraids', key: 'opt_cornrow', label: '콘로우' },
        ],
        paramKey: 'hair_style',
    },
    lips_color: {
        titleKey: 'opt_title_lips', title: '립 컬러 선택',
        options: [
            { value: JSON.stringify({r:200,g:50,b:50,a:60}), key: 'opt_red', label: '레드' },
            { value: JSON.stringify({r:180,g:60,b:80,a:55}), key: 'opt_rose', label: '로즈' },
            { value: JSON.stringify({r:200,g:100,b:80,a:50}), key: 'opt_coral', label: '코랄' },
            { value: JSON.stringify({r:180,g:80,b:120,a:55}), key: 'opt_berry', label: '베리' },
            { value: JSON.stringify({r:160,g:50,b:60,a:60}), key: 'opt_wine', label: '와인' },
            { value: JSON.stringify({r:220,g:120,b:100,a:45}), key: 'opt_nude_pink', label: '누드 핑크' },
            { value: JSON.stringify({r:150,g:30,b:50,a:65}), key: 'opt_deep_red', label: '딥 레드' },
            { value: JSON.stringify({r:200,g:80,b:100,a:50}), key: 'opt_hot_pink', label: '핫 핑크' },
        ],
        paramKey: 'lip_color_infos',
    },
};

// 상태
let _vals = {};
let _debounceTimer = null;
let _originalSrcMap = new WeakMap();    // 슬라이더 기준점 (AI 보정 후 갱신됨)
let _trueOriginalMap = new WeakMap();   // 진짜 원본 (절대 덮어쓰지 않음)
let _historyMap = new WeakMap();        // 되돌리기 히스토리 (AI 보정용)

// ==========================================================
// 초기화
// ==========================================================
export function initRetouchTools() {
    const container = document.getElementById('retouchSliders');
    if (!container) return;

    // Canvas2D 백엔드 사용
    try {
        if (typeof fabric !== 'undefined' && fabric.Canvas2dFilterBackend) {
            fabric.filterBackend = new fabric.Canvas2dFilterBackend();
        }
    } catch (e) { }

    // 슬라이더 DOM 생성
    for (const s of SLIDERS) {
        _vals[s.key] = s.def;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:6px;';
        row.innerHTML = `
            <span style="font-size:11px; color:#64748b; width:48px; flex-shrink:0;" data-i18n="${s.i18n}">${_t(s.i18n, s.label)}</span>
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
        _vals[slider.dataset.slider] = parseInt(slider.value, 10);
        const valSpan = container.querySelector(`[data-val="${slider.dataset.slider}"]`);
        if (valSpan) valSpan.textContent = slider.value;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => applyFiltersHighQuality(), 200);
    });

    // 캔버스 selection 이벤트
    const _cv = window.canvas;
    if (_cv) {
        _cv.on('selection:created', onSelectionChange);
        _cv.on('selection:updated', onSelectionChange);
        _cv.on('selection:cleared', onSelectionClear);
    }

    // 버튼 이벤트
    document.getElementById('btnRetouchApply')?.addEventListener('click', () => applyFiltersHighQuality());
    document.getElementById('btnRetouchReset')?.addEventListener('click', resetFilters);
    document.getElementById('btnRetouchUndo')?.addEventListener('click', undoRetouch);
    document.getElementById('btnRetouchOriginal')?.addEventListener('click', restoreToOriginal);

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
        _saveOriginal(obj);
        _resetSliderUI();
        _updateUndoBtn();
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
// 원본 이미지 보존 & 복원
// ==========================================================
function _saveOriginal(imgObj) {
    if (_originalSrcMap.has(imgObj)) return;
    try {
        const el = imgObj._originalElement || imgObj._element;
        if (!el) return;
        const c = document.createElement('canvas');
        c.width = el.naturalWidth || el.width;
        c.height = el.naturalHeight || el.height;
        c.getContext('2d').drawImage(el, 0, 0);
        const entry = { dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height };
        _originalSrcMap.set(imgObj, entry);
        // 진짜 원본은 한 번만 저장 (절대 덮어쓰지 않음)
        if (!_trueOriginalMap.has(imgObj)) {
            _trueOriginalMap.set(imgObj, { ...entry });
        }
    } catch (e) {
        console.warn('Save original failed:', e);
        // CORS 실패 시 element src로 폴백 저장
        if (!_trueOriginalMap.has(imgObj)) {
            const el = imgObj._originalElement || imgObj._element;
            if (el && el.src) {
                _trueOriginalMap.set(imgObj, { dataUrl: el.src, width: el.naturalWidth || el.width, height: el.naturalHeight || el.height });
            }
        }
    }
}

function _restoreOriginal(obj) {
    const original = _originalSrcMap.get(obj);
    if (!original) return;
    const prevW = obj.width, prevH = obj.height, prevSX = obj.scaleX, prevSY = obj.scaleY;
    obj.setSrc(original.dataUrl, () => {
        if (obj.width !== prevW || obj.height !== prevH) {
            obj.scaleX = prevSX * (prevW / obj.width);
            obj.scaleY = prevSY * (prevH / obj.height);
        }
        obj.filters = [];
        obj.applyFilters();
        canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
}

// ==========================================================
// 되돌리기 히스토리
// ==========================================================
function _pushHistory(obj) {
    const el = obj._originalElement || obj._element;
    if (!el) return;
    try {
        const c = document.createElement('canvas');
        c.width = el.naturalWidth || el.width;
        c.height = el.naturalHeight || el.height;
        c.getContext('2d').drawImage(el, 0, 0);
        const dataUrl = c.toDataURL('image/png');
        let stack = _historyMap.get(obj);
        if (!stack) { stack = []; _historyMap.set(obj, stack); }
        if (stack.length >= 20) stack.shift(); // 최대 20단계
        stack.push({ dataUrl, width: c.width, height: c.height });
        _updateUndoBtn();
    } catch (e) { console.warn('History push failed:', e); }
}

function _updateUndoBtn() {
    const btn = document.getElementById('btnRetouchUndo');
    if (!btn) return;
    const obj = canvas.getActiveObject();
    const stack = obj ? _historyMap.get(obj) : null;
    const hasHistory = stack && stack.length > 0;
    btn.disabled = !hasHistory;
    btn.style.opacity = hasHistory ? '1' : '0.4';
    btn.style.pointerEvents = hasHistory ? 'auto' : 'none';
}

function undoRetouch() {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    const stack = _historyMap.get(obj);
    if (!stack || stack.length === 0) return;

    const prev = stack.pop();
    const prevW = obj.width, prevH = obj.height, prevSX = obj.scaleX, prevSY = obj.scaleY;
    obj.setSrc(prev.dataUrl, () => {
        if (obj.width !== prevW || obj.height !== prevH) {
            obj.scaleX = prevSX * (prevW / obj.width);
            obj.scaleY = prevSY * (prevH / obj.height);
        }
        _originalSrcMap.set(obj, { dataUrl: prev.dataUrl, width: prev.width, height: prev.height });
        _resetSliderUI();
        canvas.requestRenderAll();
        _updateUndoBtn();
    }, { crossOrigin: 'anonymous' });
    window.showToast?.('되돌리기 완료', 'success');
}

function restoreToOriginal() {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;

    // 진짜 원본에서 복원
    const trueOriginal = _trueOriginalMap.get(obj);
    if (!trueOriginal) {
        window.showToast?.('원본 데이터가 없습니다', 'warning');
        return;
    }

    // 히스토리 비우기
    const stack = _historyMap.get(obj);
    if (stack) stack.length = 0;

    const prevW = obj.width, prevH = obj.height, prevSX = obj.scaleX, prevSY = obj.scaleY;
    obj.setSrc(trueOriginal.dataUrl, () => {
        if (obj.width !== prevW || obj.height !== prevH) {
            obj.scaleX = prevSX * (prevW / obj.width);
            obj.scaleY = prevSY * (prevH / obj.height);
        }
        obj.filters = [];
        obj.applyFilters();
        // 슬라이더 기준점도 원본으로 리셋
        _originalSrcMap.set(obj, { ...trueOriginal });
        _resetSliderUI();
        canvas.requestRenderAll();
        _updateUndoBtn();
    }, { crossOrigin: 'anonymous' });
    window.showToast?.('원본으로 복원 완료', 'success');
}

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
// 고품질 필터 (오프스크린 캔버스 + CSS filter)
// ==========================================================
function applyFiltersHighQuality() {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    const allDefault = SLIDERS.every(s => _vals[s.key] === s.def);
    if (allDefault) { _restoreOriginal(obj); return; }
    const original = _originalSrcMap.get(obj);
    if (!original) { _saveOriginal(obj); }
    const src = _originalSrcMap.get(obj);
    if (!src) return;

    const img = new Image();
    img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w; offCanvas.height = h;
        const ctx = offCanvas.getContext('2d');

        let f = `brightness(${1 + _vals.brightness/100}) contrast(${1 + _vals.contrast/100}) `;
        f += `saturate(${_vals.saturation === -100 ? 0 : 1 + _vals.saturation/100}) `;
        if (_vals.warmth !== 0) f += `hue-rotate(${_vals.warmth * 0.3}deg) `;
        if (_vals.blur > 0) f += `blur(${(_vals.blur/100) * Math.max(w,h) * 0.005}px) `;

        ctx.filter = f.trim();
        ctx.drawImage(img, 0, 0, w, h);
        if (_vals.sharpness > 0) { ctx.filter = 'none'; _applyUnsharpMask(ctx, w, h, _vals.sharpness/100); }

        const prevW = obj.width, prevH = obj.height, prevSX = obj.scaleX, prevSY = obj.scaleY;
        obj.setSrc(offCanvas.toDataURL('image/png'), () => {
            if (obj.width !== prevW || obj.height !== prevH) {
                obj.scaleX = prevSX * (prevW / obj.width);
                obj.scaleY = prevSY * (prevH / obj.height);
            }
            canvas.requestRenderAll();
        }, { crossOrigin: 'anonymous' });
    };
    img.src = src.dataUrl;
}

function _applyUnsharpMask(ctx, w, h, amount) {
    try {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const tc = document.createElement('canvas'); tc.width = w; tc.height = h;
        const tCtx = tc.getContext('2d');
        tCtx.putImageData(imageData, 0, 0);
        tCtx.filter = `blur(${Math.max(1, amount * 2)}px)`;
        tCtx.drawImage(tc, 0, 0);
        const blurData = tCtx.getImageData(0, 0, w, h).data;
        const s = amount * 1.5;
        for (let i = 0; i < data.length; i += 4) {
            data[i]     = Math.min(255, Math.max(0, data[i]     + s * (data[i]     - blurData[i])));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + s * (data[i + 1] - blurData[i + 1])));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + s * (data[i + 2] - blurData[i + 2])));
        }
        ctx.putImageData(imageData, 0, 0);
    } catch (e) { console.warn('Unsharp mask failed:', e); }
}

function applyPreset(name) {
    const p = PRESETS[name]; if (!p) return;
    const container = document.getElementById('retouchSliders'); if (!container) return;
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

function resetFilters() {
    _resetSliderUI();
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'image') _restoreOriginal(obj);
}

// ==========================================================
// 옵션 선택 모달
// ==========================================================
function _showOptionModal(config) {
    return new Promise((resolve) => {
        document.getElementById('retouchOptionModal')?.remove();

        const modalTitle = _t(config.titleKey, config.title);
        const cancelText = _t('retouch_cancel', '취소');

        const modal = document.createElement('div');
        modal.id = 'retouchOptionModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1e293b;">${modalTitle}</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;" id="retouchOptions"></div>
                <button id="retouchOptionClose" style="margin-top:16px;width:100%;height:38px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#64748b;font-size:13px;cursor:pointer;font-weight:600;">${cancelText}</button>
            </div>
        `;
        document.body.appendChild(modal);

        const optContainer = modal.querySelector('#retouchOptions');
        for (const opt of config.options) {
            const btn = document.createElement('button');
            btn.style.cssText = 'padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:12px;cursor:pointer;transition:all 0.2s;font-weight:600;color:#334155;';
            btn.textContent = opt.key ? _t(opt.key, opt.label) : opt.label;
            btn.onmouseover = () => { btn.style.borderColor = '#6366f1'; btn.style.background = '#f5f3ff'; };
            btn.onmouseout = () => { btn.style.borderColor = '#e2e8f0'; btn.style.background = '#fff'; };
            btn.onclick = () => { modal.remove(); resolve(opt.value); };
            optContainer.appendChild(btn);
        }

        modal.querySelector('#retouchOptionClose').onclick = () => { modal.remove(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
    });
}

// 두 번째 이미지 선택 모달 (얼굴 합성용)
function _pickSecondImage(imageList) {
    return new Promise((resolve) => {
        document.getElementById('retouchOptionModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'retouchOptionModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1e293b;">${_t('opt_title_fusion', '합성할 얼굴 이미지 선택')}</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;" id="retouchImgPick"></div>
                <button id="retouchOptionClose" style="margin-top:16px;width:100%;height:38px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#64748b;font-size:13px;cursor:pointer;font-weight:600;">취소</button>
            </div>
        `;
        document.body.appendChild(modal);

        const container = modal.querySelector('#retouchImgPick');
        for (const imgObj of imageList) {
            const el = imgObj._originalElement || imgObj._element;
            if (!el) continue;
            const thumb = document.createElement('div');
            thumb.style.cssText = 'cursor:pointer;border:2px solid #e2e8f0;border-radius:10px;overflow:hidden;aspect-ratio:1;transition:all .2s;';
            thumb.innerHTML = `<img src="${el.src}" style="width:100%;height:100%;object-fit:cover;">`;
            thumb.onmouseover = () => { thumb.style.borderColor = '#6366f1'; };
            thumb.onmouseout = () => { thumb.style.borderColor = '#e2e8f0'; };
            thumb.onclick = () => { modal.remove(); resolve(imgObj); };
            container.appendChild(thumb);
        }

        modal.querySelector('#retouchOptionClose').onclick = () => { modal.remove(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
    });
}

// ==========================================================
// 이미지 → base64 추출 유틸 (리사이즈 + JPEG 압축)
// AILab API 제한: 대부분 2048px 이하, 파일 2MB 이하 권장
// Supabase Edge Function body 제한: ~2MB
// ==========================================================
const MAX_AI_DIM = 1500;   // 최대 한 변 길이 (2048은 AILab 413 에러 발생)
const AI_JPEG_QUALITY = 0.85;

function _loadImageAsync(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}

async function _getImageBase64(obj) {
    // 이미 로드된 Fabric.js 엘리먼트 사용 (가장 안정적)
    let el = obj._originalElement || obj._element;

    // Fabric element가 없으면 _originalSrcMap에서 비동기 로드
    if (!el) {
        const original = _originalSrcMap.get(obj);
        if (original) {
            el = await _loadImageAsync(original.dataUrl);
        }
    }
    if (!el) throw new Error('이미지 엘리먼트를 찾을 수 없습니다');

    const srcW = el.naturalWidth || el.width;
    const srcH = el.naturalHeight || el.height;
    if (!srcW || !srcH) throw new Error('이미지가 로드되지 않았습니다');

    // 리사이즈 계산
    let dstW = srcW, dstH = srcH;
    if (srcW > MAX_AI_DIM || srcH > MAX_AI_DIM) {
        const ratio = Math.min(MAX_AI_DIM / srcW, MAX_AI_DIM / srcH);
        dstW = Math.round(srcW * ratio);
        dstH = Math.round(srcH * ratio);
    }

    const c = document.createElement('canvas');
    c.width = dstW;
    c.height = dstH;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(el, 0, 0, dstW, dstH);

    const result = c.toDataURL('image/jpeg', AI_JPEG_QUALITY).split(',')[1];
    if (!result) throw new Error('이미지 base64 추출 실패');
    console.log(`[retouch] base64 size: ${(result.length * 0.75 / 1024).toFixed(0)}KB, dim: ${dstW}x${dstH}`);
    return result;
}

// ==========================================================
// 결과 이미지 교체 유틸
// ==========================================================
function _replaceImage(obj, imgSrc) {
    return new Promise((resolve, reject) => {
        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';
        newImg.onload = () => {
            const prevW = obj.width, prevH = obj.height, prevSX = obj.scaleX, prevSY = obj.scaleY;
            obj.setSrc(imgSrc, () => {
                if (obj.width !== prevW || obj.height !== prevH) {
                    obj.scaleX = prevSX * (prevW / obj.width);
                    obj.scaleY = prevSY * (prevH / obj.height);
                }
                _originalSrcMap.set(obj, { dataUrl: imgSrc, width: newImg.naturalWidth, height: newImg.naturalHeight });
                _resetSliderUI();
                canvas.requestRenderAll();
                resolve();
            }, { crossOrigin: 'anonymous' });
        };
        newImg.onerror = () => reject(new Error('Failed to load result image'));
        newImg.src = imgSrc;
    });
}

// ==========================================================
// AI 보정 메인 핸들러
// ==========================================================
let _aiProcessing = false;
async function handleAiRetouch(action) {
    if (_aiProcessing) { window.showToast?.('처리 중입니다. 잠시만 기다려주세요.', 'info'); return; }
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') {
        window.showToast?.('캔버스에서 이미지를 선택하세요', 'warning');
        return;
    }

    // 옵션 선택이 필요한 기능
    let params = {};
    const optConfig = AI_OPTIONS[action];
    if (optConfig) {
        const selected = await _showOptionModal(optConfig);
        if (selected === null) return; // 취소
        if (action === 'lips_color') {
            params.lip_color_infos = [{ rgba: JSON.parse(selected) }];
        } else {
            params[optConfig.paramKey] = selected;
        }
    }

    // 얼굴 합성은 두 번째 이미지 필요 — 캔버스에서 다른 이미지 자동 검색
    let secondImageBase64 = null;
    if (action === 'face_fusion') {
        const allImages = canvas.getObjects().filter(o => o.type === 'image' && o !== obj);
        if (allImages.length === 0) {
            window.showToast?.('얼굴 합성은 캔버스에 2개 이상의 이미지가 필요합니다', 'warning');
            return;
        }
        // 두 번째 이미지 선택 모달
        const secondImg = await _pickSecondImage(allImages);
        if (!secondImg) return; // 취소
        secondImageBase64 = await _getImageBase64(secondImg);
    }

    // 버튼 로딩 상태 (카드형 버튼 지원)
    const btn = document.querySelector(`[data-retouch="${action}"]`);
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.classList.add('loading');
        const thumb = btn.querySelector('.rt-thumb');
        if (thumb) thumb.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:20px;"></i>';
    }

    _aiProcessing = true;
    try {
        // 히스토리에 현재 상태 저장 (되돌리기용)
        _pushHistory(obj);

        const base64 = await _getImageBase64(obj);

        const requestBody = { action, image_base64: base64 };
        if (secondImageBase64) requestBody.image_base64_2 = secondImageBase64;
        if (Object.keys(params).length > 0) requestBody.params = params;

        const { data, error } = await sb.functions.invoke('portrait-retouch', {
            body: requestBody
        });

        if (error) throw new Error(error.message || 'Edge Function error');

        // Edge Function이 200으로 반환하되 error 필드가 있을 수 있음
        if (data?.error) throw new Error(data.error);

        // 피부 분석은 이미지가 아닌 JSON 결과
        if (action === 'skin_analysis') {
            _showSkinAnalysis(data.analysis);
            return;
        }

        if (!data || (!data.image_url && !data.image_base64)) {
            throw new Error('결과 이미지가 없습니다');
        }

        const imgSrc = data.image_base64
            ? `data:image/png;base64,${data.image_base64}`
            : data.image_url;

        await _replaceImage(obj, imgSrc);
        _updateUndoBtn();
        window.showToast?.('보정 완료!', 'success');

    } catch (e) {
        console.error('AI Retouch error:', e);
        window.showToast?.('보정 실패: ' + e.message, 'error');
    } finally {
        _aiProcessing = false;
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.innerHTML = originalHTML;
        }
    }
}

// ==========================================================
// 피부 분석 결과 모달
// ==========================================================
function _showSkinAnalysis(analysis) {
    document.getElementById('retouchOptionModal')?.remove();
    if (!analysis) { window.showToast?.('분석 결과가 없습니다', 'warning'); return; }

    const r = analysis.result || analysis;
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

    const items = [
        { label: '피부 타입', value: ['건성', '중성', '지성', '복합성'][r?.skin_type?.skin_type ?? 1] },
        { label: '다크서클', value: r?.dark_circles?.value === 1 ? '있음' : '없음' },
        { label: '눈밑 처짐', value: r?.eye_pouches?.value === 1 ? '있음' : '없음' },
        { label: '모공', value: ['좋음', '보통', '넓음'][r?.pores?.forehead_value ?? 0] },
        { label: '여드름', value: r?.blemishes?.acne?.value === 1 ? '있음' : '없음' },
        { label: '잡티', value: r?.blemishes?.spots?.value === 1 ? '있음' : '없음' },
        { label: '주름', value: r?.wrinkles?.forehead?.value === 1 ? '있음' : '없음' },
    ];

    for (const item of items) {
        html += `<div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#94a3b8;">${item.label}</div>
            <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:2px;">${item.value || '-'}</div>
        </div>`;
    }
    html += '</div>';

    const modal = document.createElement('div');
    modal.id = 'retouchOptionModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1e293b;">🔬 AI 피부 분석 결과</div>
            ${html}
            <button onclick="this.closest('#retouchOptionModal').remove()" style="margin-top:16px;width:100%;height:38px;border:none;border-radius:10px;background:#6366f1;color:#fff;font-size:13px;cursor:pointer;font-weight:600;">확인</button>
        </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}
