// canvas-retouch.js — AI 보정 패널 (고품질 필터 + AILab Tools 전체 API)
import { canvas } from "./canvas-core.js?v=123";
import { sb } from "./config.js?v=123";

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
const AI_OPTIONS = {
    cartoon: {
        title: '만화 스타일 선택',
        options: [
            { value: '3d_cartoon', label: '3D 카툰' },
            { value: 'pixar', label: 'Pixar' },
            { value: 'pixar_plus', label: 'Pixar+' },
            { value: 'anime', label: '애니메' },
            { value: 'jpcartoon', label: '일본 카툰' },
            { value: 'comic', label: '코믹' },
            { value: 'sketch', label: '스케치' },
            { value: 'handdrawn', label: '손그림' },
            { value: '3d', label: '3D 인형' },
            { value: '3d_game', label: '3D 게임' },
            { value: 'angel', label: '천사' },
            { value: 'demon', label: '악마' },
            { value: 'artstyle', label: '아트' },
            { value: 'animation3d', label: '3D 애니' },
            { value: 'classic_cartoon', label: '클래식 카툰' },
            { value: 'hongkong', label: '홍콩 스타일' },
        ],
        paramKey: 'type',
    },
    emotion: {
        title: '표정 선택',
        options: [
            { value: '10', label: '보조개 미소' },
            { value: '11', label: '배 보조개' },
            { value: '12', label: '활짝 웃기' },
            { value: '13', label: '함박 웃음' },
            { value: '14', label: '쿨한 포즈' },
            { value: '15', label: '슬픔' },
            { value: '16', label: '억지 웃음' },
            { value: '100', label: '눈뜨기' },
        ],
        paramKey: 'service_choice',
    },
    age_gender: {
        title: '변환 유형 선택',
        options: [
            { value: 'TO_KID', label: '어린이로' },
            { value: 'TO_OLD', label: '노인으로' },
            { value: 'TO_FEMALE', label: '여성으로' },
            { value: 'TO_MALE', label: '남성으로' },
        ],
        paramKey: 'action_type',
    },
    face_filter: {
        title: '얼굴 필터 선택',
        options: [
            { value: '10001', label: '내추럴' },
            { value: '10002', label: '화이트닝' },
            { value: '10003', label: '핑크' },
            { value: '10010', label: '우아한' },
            { value: '10011', label: '청춘' },
            { value: '10015', label: '레트로' },
            { value: '10020', label: '시네마' },
            { value: '10025', label: '빈티지' },
            { value: '10030', label: '따뜻한 톤' },
            { value: '10035', label: '차가운 톤' },
            { value: '10040', label: '드라마틱' },
            { value: '10050', label: '모노크롬' },
            { value: '10060', label: '네온' },
            { value: '10070', label: '선셋' },
        ],
        paramKey: 'resource_type',
    },
    hairstyle: {
        title: '헤어스타일 선택',
        options: [
            { value: 'FemaleShortCurlyBob', label: '여성 숏컬 밥' },
            { value: 'FemaleLongStraight', label: '여성 롱 스트레이트' },
            { value: 'FemaleMediumWavy', label: '여성 미디엄 웨이브' },
            { value: 'FemalePixieCut', label: '여성 픽시컷' },
            { value: 'FemaleBraids', label: '여성 브레이드' },
            { value: 'FemalePonytail', label: '여성 포니테일' },
            { value: 'FemaleBun', label: '여성 번' },
            { value: 'MaleShortCrew', label: '남성 크루컷' },
            { value: 'MaleSlickBack', label: '남성 슬릭백' },
            { value: 'MaleCurly', label: '남성 컬리' },
            { value: 'MalePompadour', label: '남성 퐁파두르' },
            { value: 'MaleBuzzCut', label: '남성 버즈컷' },
        ],
        paramKey: 'hair_style',
    },
    lips_color: {
        title: '립 컬러 선택',
        options: [
            { value: JSON.stringify({r:200,g:50,b:50,a:60}), label: '레드' },
            { value: JSON.stringify({r:180,g:60,b:80,a:55}), label: '로즈' },
            { value: JSON.stringify({r:200,g:100,b:80,a:50}), label: '코랄' },
            { value: JSON.stringify({r:180,g:80,b:120,a:55}), label: '베리' },
            { value: JSON.stringify({r:160,g:50,b:60,a:60}), label: '와인' },
            { value: JSON.stringify({r:220,g:120,b:100,a:45}), label: '누드 핑크' },
            { value: JSON.stringify({r:150,g:30,b:50,a:65}), label: '딥 레드' },
            { value: JSON.stringify({r:200,g:80,b:100,a:50}), label: '핫 핑크' },
        ],
        paramKey: 'lip_color_infos',
    },
};

// 상태
let _vals = {};
let _debounceTimer = null;
let _originalSrcMap = new WeakMap();

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
        _vals[slider.dataset.slider] = parseInt(slider.value, 10);
        const valSpan = container.querySelector(`[data-val="${slider.dataset.slider}"]`);
        if (valSpan) valSpan.textContent = slider.value;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => applyFiltersHighQuality(), 200);
    });

    // 캔버스 selection 이벤트
    canvas.on('selection:created', onSelectionChange);
    canvas.on('selection:updated', onSelectionChange);
    canvas.on('selection:cleared', onSelectionClear);

    // 버튼 이벤트
    document.getElementById('btnRetouchApply')?.addEventListener('click', () => applyFiltersHighQuality());
    document.getElementById('btnRetouchReset')?.addEventListener('click', resetFilters);

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
        _originalSrcMap.set(imgObj, { dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height });
    } catch (e) { console.warn('Save original failed:', e); }
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
        // 기존 모달 제거
        document.getElementById('retouchOptionModal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'retouchOptionModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1e293b;">${config.title}</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;" id="retouchOptions"></div>
                <button id="retouchOptionClose" style="margin-top:16px;width:100%;height:38px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#64748b;font-size:13px;cursor:pointer;font-weight:600;">취소</button>
            </div>
        `;
        document.body.appendChild(modal);

        const optContainer = modal.querySelector('#retouchOptions');
        for (const opt of config.options) {
            const btn = document.createElement('button');
            btn.style.cssText = 'padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:12px;cursor:pointer;transition:all 0.2s;font-weight:600;color:#334155;';
            btn.textContent = opt.label;
            btn.onmouseover = () => { btn.style.borderColor = '#6366f1'; btn.style.background = '#f5f3ff'; };
            btn.onmouseout = () => { btn.style.borderColor = '#e2e8f0'; btn.style.background = '#fff'; };
            btn.onclick = () => { modal.remove(); resolve(opt.value); };
            optContainer.appendChild(btn);
        }

        modal.querySelector('#retouchOptionClose').onclick = () => { modal.remove(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
    });
}

// ==========================================================
// 이미지 → base64 추출 유틸
// ==========================================================
function _getImageBase64(obj) {
    const original = _originalSrcMap.get(obj);
    if (original) return original.dataUrl.split(',')[1];
    const el = obj._originalElement || obj._element;
    const c = document.createElement('canvas');
    c.width = el.naturalWidth || el.width;
    c.height = el.naturalHeight || el.height;
    c.getContext('2d').drawImage(el, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
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
async function handleAiRetouch(action) {
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

    // 얼굴 합성은 두 번째 이미지 필요
    if (action === 'face_fusion') {
        window.showToast?.('얼굴 합성: 캔버스에서 두 번째 이미지를 선택하세요 (현재 버전에서는 첫 번째 이미지에 적용됩니다)', 'info');
        // 간단 버전: 같은 이미지로 셀프 합성
    }

    // 버튼 로딩 상태
    const btn = document.querySelector(`[data-retouch="${action}"]`);
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const base64 = _getImageBase64(obj);

        const requestBody = { action, image_base64: base64 };
        if (Object.keys(params).length > 0) requestBody.params = params;

        const { data, error } = await sb.functions.invoke('portrait-retouch', {
            body: requestBody
        });

        if (error) throw new Error(error.message || 'Edge Function error');

        // 피부 분석은 이미지가 아닌 JSON 결과
        if (action === 'skin_analysis') {
            _showSkinAnalysis(data.analysis);
            return;
        }

        if (!data || (!data.image_url && !data.image_base64)) {
            throw new Error(data?.error || 'No result');
        }

        const imgSrc = data.image_base64
            ? `data:image/png;base64,${data.image_base64}`
            : data.image_url;

        await _replaceImage(obj, imgSrc);
        window.showToast?.('보정 완료!', 'success');

    } catch (e) {
        console.error('AI Retouch error:', e);
        window.showToast?.('보정 실패: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
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
