// 2026-06-13: 미니 에디터 + 누끼따기 — 두 도구 통합 패널
(function AiNbTools(){
    'use strict';
    const SB_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

    function $(id){ return document.getElementById(id); }
    function showSpinner(id, on) {
        const sp = $(id);
        if (sp) sp.classList.toggle('show', !!on);
    }
    function showImgInPreview(previewId, src) {
        const pv = $(previewId);
        if (!pv) return;
        Array.from(pv.children).forEach(c => {
            if (c.tagName === 'IMG' || (c.classList && c.classList.contains('aiNb-empty'))) pv.removeChild(c);
        });
        const im = document.createElement('img');
        im.src = src;
        pv.appendChild(im);
    }
    function setError(id, msg) {
        const el = $(id);
        if (!el) return;
        if (!msg) { el.style.display = 'none'; el.textContent = ''; }
        else { el.style.display = 'block'; el.textContent = msg; }
    }

    // ─────────────────────── 미니 에디터 ───────────────────────
    var me = {
        stage: null,
        wScale: 1,                   // 화면 표시 배율 (자연 w → 표시 w) = baseScale × zoom
        baseScale: 1,                // fit 배율 (zoom 1 기준)
        zoom: 1, panX: 0, panY: 0,   // 2026-06-27: 확대/축소/이동
        natW: 595, natH: 842,        // 자연 (다운로드) 사이즈
        bg: '#ffffff',
        items: [],                   // {el, type, x, y, w, h, src?, text?, fill?, fontSize?}
        history: [],                 // 2026-06-14: undo 스택 (max 50)
        selected: null,
        zCounter: 10
    };
    // 2026-06-14: simple_order 의 명함 자동 디자인에서 접근하기 위해 노출
    window.me = me;

    function _meFitStage() {
        var stage = $('meStage');
        if (!stage) return;
        // 2026-06-27: 줄자(ruler) 제거 — 그만큼 캔버스를 더 크게. 크기는 #meSizeLabel(mm)로 표시.
        var landscape = (me.natW >= me.natH);
        var rulerV = $('meRulerV'), rulerH = $('meRulerH');
        if (rulerV) rulerV.style.display = 'none';
        if (rulerH) rulerH.style.display = 'none';
        var wrap = document.querySelector('.me-stage-wrap');
        var wrapW = (wrap ? wrap.clientWidth : 600);
        // 2026-07-11: 칼선 조절 창(#meCutlineFloat)이 대지 옆에 떠 있을 땐 그 폭만큼 대지 가용폭에서 뺌 (겹침 방지).
        var _sideP = document.getElementById('meCutlineFloat');
        if (_sideP && _sideP.style.display !== 'none') { var _spr = _sideP.getBoundingClientRect(); if (_spr.width) wrapW -= (_spr.width + 16); }
        var pad = 20;                         // me-stage-wrap 좌우 padding 합 (10*2)
        var maxH = window._meStageMaxH || 540;
        // 2026-07-18: 대지 주변에 회색 여백을 두어 대지 밖으로 나간 이미지가 보이도록 (고객이 크기 맞추기 쉽게).
        //   대지를 가용영역의 85%만 차지시켜 15% 여백 확보. drag/resize/export 는 me.wScale 기준이라 자동 정합.
        var _MARGIN = 0.85;
        var sw, sh;
        if (landscape) {
            var availWL = Math.max(200, wrapW - pad) * _MARGIN;
            sw = availWL; sh = sw * (me.natH / me.natW);
            if (sh > maxH * _MARGIN) { sh = maxH * _MARGIN; sw = sh * (me.natW / me.natH); }
        } else {
            var availWP = Math.max(160, wrapW - pad) * _MARGIN;
            sh = maxH * _MARGIN; sw = sh * (me.natW / me.natH);
            if (sw > availWP) { sw = availWP; sh = sw * (me.natH / me.natW); }
        }
        // 2026-06-27: zoom — base fit 스케일에 zoom 곱. 드래그/리사이즈/export 는 모두 me.wScale 기준이라 자동 정합.
        me.baseScale = sw / me.natW;
        var _z = me.zoom || 1;
        me.wScale = me.baseScale * _z;
        stage.style.maxWidth = 'none'; stage.style.maxHeight = 'none';
        stage.style.width = Math.round(sw * _z) + 'px';
        stage.style.height = Math.round(sh * _z) + 'px';
        // 뷰포트 고정 — zoom 해도 에디터 영역 높이는 fit 기준 유지 (넘침은 wrap overflow:hidden 클립 + pan 으로 이동).
        //   2026-07-18: 대지(85%) 위아래 여백만큼 wrap 을 더 크게 → 대지 밖 이미지가 위아래로도 보임.
        if (wrap) wrap.style.height = (Math.round(sh / _MARGIN) + 20) + 'px';
        me.items.forEach(_meSyncItemDisplay);
        _meEnsureArtboardMask();
        _meUpdateSizeLabel();
        _meApplyPan();
        _meUpdateZoomUI();
    }
    // 2026-07-18: 대지 마스크 — 대지 밖을 어둡게(box-shadow veil) + 경계 점선. 항상 최상단.
    //   me.items 가 아니라 순수 오버레이라 export/썸네일엔 안 잡힘.
    function _meEnsureArtboardMask() {
        var stage = $('meStage'); if (!stage) return;
        var m = stage.querySelector(':scope > .me-artboard-mask');
        if (!m) { m = document.createElement('div'); m.className = 'me-artboard-mask'; }
        // 항상 마지막 자식으로(=DOM 상 최상단; z-index 로도 최상단이라 이중 안전)
        stage.appendChild(m);
    }
    window._meEnsureArtboardMask = _meEnsureArtboardMask;
    // 2026-06-27: 줄자 대신 캔버스 크기(mm)를 #meSizeLabel 에 표시.
    function _meUpdateSizeLabel() {
        // 2026-06-28: 에디터↔PDF 차이 안내 (다운로드로 PDF 확인 후 주문)
        try {
            var _nt = document.getElementById('meDiffNotice');
            if (_nt && !_nt.textContent) {
                var _h = (location.hostname || '').toLowerCase();
                var _lng = (_h.indexOf('cafe0101') >= 0 || _h.indexOf('cotton-printer') >= 0) ? 'ja'
                         : (_h.indexOf('cafe3355') >= 0 || _h.indexOf('hexa-board') >= 0 || _h.indexOf('chameleon.design') >= 0) ? 'en' : 'kr';
                _nt.textContent = (_lng === 'ja')
                    ? '⚠ エディターとPDFは多少異なる場合があります。必ず「ダウンロード」でPDFを確認してからご注文ください。'
                    : (_lng === 'en')
                    ? '⚠ The editor and the PDF may differ slightly. Please click Download and check the PDF before ordering.'
                    : '⚠ 에디터와 PDF는 약간 다를 수 있어요. 꼭 다운로드 버튼을 눌러 PDF를 확인 후 주문해 주세요.';
            }
        } catch (_ne) {}
        var el = document.getElementById('meSizeLabel');
        if (!el) return;
        // 실제 mm 가 지정된 상품만 표시 (데모 프리셋은 point 기반이라 mm 변환이 부정확 → 숨김)
        if (me.natWMm && me.natHMm) {
            el.textContent = Math.round(me.natWMm) + ' × ' + Math.round(me.natHMm) + ' mm';
        } else {
            el.textContent = '';
        }
    }
    window._meUpdateSizeLabel = _meUpdateSizeLabel;
    window._meFitStage = _meFitStage;
    // 2026-06-16 v9: 세로 mm 줄자 렌더 — stage 높이에 맞춰 10mm tick (5mm 짧은 sub-tick) + 라벨.
    //   v13: me.natHMm 이 있으면 그걸 우선 사용 (가벽 등 capped pixel canvas 에서 mm 정확).
    function _meRulerSteps(lenMm) {
        if (lenMm <= 200)       return { major: 10,  minor: 5 };
        if (lenMm <= 500)       return { major: 25,  minor: 5 };
        if (lenMm <= 1500)      return { major: 100, minor: 50 };
        if (lenMm <= 5000)      return { major: 250, minor: 100 };
        return { major: 500, minor: 250 };
    }
    function _meDrawRuler() {
        var stage = $('meStage');
        if (!stage) return;
        var landscape = (me.natW >= me.natH);
        var rV = $('meRulerV'), rH = $('meRulerH');
        if (landscape) {
            // 가로 줄자 (상단) — 폭(natW) 기준
            if (rV) rV.innerHTML = '';
            if (!rH) return;
            var widthPx = parseFloat(stage.style.width) || stage.clientWidth || 0;
            if (!widthPx) { rH.innerHTML = ''; return; }
            rH.style.width = widthPx + 'px';
            var widthMm = me.natWMm || (me.natW / 3.7795);
            var pxW = widthPx / widthMm, sW = _meRulerSteps(widthMm), hh = '';
            for (var x = 0; x <= Math.floor(widthMm); x += sW.major) {
                var lf = x * pxW;
                hh += '<div style="position:absolute; bottom:0; left:' + lf.toFixed(1) + 'px; width:1px; height:10px; background:rgba(255,255,255,0.55);"></div>'
                    + '<div style="position:absolute; bottom:11px; left:' + (lf + 2).toFixed(1) + 'px; font-size:9px; font-weight:700; color:rgba(255,255,255,0.7); letter-spacing:-0.3px;">' + x + '</div>';
            }
            for (var x2 = sW.minor; x2 <= widthMm; x2 += sW.minor) {
                if (x2 % sW.major === 0) continue;
                hh += '<div style="position:absolute; bottom:0; left:' + (x2 * pxW).toFixed(1) + 'px; width:1px; height:5px; background:rgba(255,255,255,0.32);"></div>';
            }
            hh += '<div style="position:absolute; bottom:0; left:0; right:0; height:1px; background:rgba(255,255,255,0.4);"></div>';
            hh += '<div style="position:absolute; bottom:11px; right:0; font-size:8px; font-weight:600; color:rgba(255,255,255,0.5);">mm</div>';
            rH.innerHTML = hh;
        } else {
            // 세로 줄자 (좌측) — 높이(natH) 기준
            if (rH) rH.innerHTML = '';
            if (!rV) return;
            var heightPx = parseFloat(stage.style.height) || stage.clientHeight || 0;
            if (!heightPx) { rV.innerHTML = ''; return; }
            rV.style.height = heightPx + 'px';
            var heightMm = me.natHMm || (me.natH / 3.7795);
            var pxH = heightPx / heightMm, sH = _meRulerSteps(heightMm), tv = '';
            for (var mm = 0; mm <= Math.floor(heightMm); mm += sH.major) {
                var top = mm * pxH;
                tv += '<div style="position:absolute; right:0; top:' + top.toFixed(1) + 'px; width:10px; height:1px; background:rgba(255,255,255,0.55);"></div>'
                    + '<div style="position:absolute; right:12px; top:' + (top - 6).toFixed(1) + 'px; font-size:9px; font-weight:700; color:rgba(255,255,255,0.7); letter-spacing:-0.3px;">' + mm + '</div>';
            }
            for (var mm2 = sH.minor; mm2 <= heightMm; mm2 += sH.minor) {
                if (mm2 % sH.major === 0) continue;
                tv += '<div style="position:absolute; right:0; top:' + (mm2 * pxH).toFixed(1) + 'px; width:5px; height:1px; background:rgba(255,255,255,0.32);"></div>';
            }
            tv += '<div style="position:absolute; right:0; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.4);"></div>';
            tv += '<div style="position:absolute; right:12px; bottom:-2px; font-size:8px; font-weight:600; color:rgba(255,255,255,0.5); letter-spacing:0.5px;">mm</div>';
            rV.innerHTML = tv;
        }
    }
    window._meDrawRuler = _meDrawRuler;

    // ─────────── 2026-06-27: 미니에디터 확대/축소/이동 (zoom & pan) ───────────
    //   zoom 은 me.wScale 에 곱해 표시 (드래그/리사이즈/룰러/export 모두 me.wScale 기준 → 자동 정합).
    //   pan 은 .me-stage-row(룰러+대지 묶음) translate → 룰러도 함께 이동해 정렬 유지.
    function _meApplyPan() {
        var row = document.querySelector('.me-stage-row');
        if (row) row.style.transform = 'translate(' + Math.round(me.panX || 0) + 'px,' + Math.round(me.panY || 0) + 'px)';
    }
    function _meUpdateZoomUI() {
        var pct = document.getElementById('meZoomPct');
        if (pct) pct.textContent = Math.round((me.zoom || 1) * 100) + '%';
    }
    // 2026-07-15: 미니에디터 UI 라벨 다국어 — 호스트 언어(cotton-printer/cafe0101=ja, cafe3355/chameleon=en) 인식.
    //   기존엔 window.t 없으면 한국어 fallback 만 나와 JP 패브릭에서 서체/테두리/우클릭메뉴 등이 한국어로 남던 문제.
    var _ME_UI_LANG = (function () {
        try {
            var h = (location.hostname || '').toLowerCase();
            if (h.indexOf('cafe0101') >= 0 || h.indexOf('cotton-printer') >= 0) return 'ja';
            if (h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) return 'en';
        } catch (e) {}
        return 'ko';
    })();
    var _ME_UI_JA = {
        me_prop_font:'書体', me_script_fonts:'かっこいい英字', me_prop_fsize:'文字サイズ (T)', me_prop_lheight:'行間 (倍数)',
        me_prop_lspace:'字間', me_prop_stroke:'縁取り', me_prop_strokejoin:'縁の角を丸く/角ばる', me_prop_strokew:'太さ',
        me_prop_textstroke:'縁取り', me_prop_textstrokew:'縁取りの太さ', me_qr_edit:'QR編集', me_text_placeholder:'クリックして文字入力',
        me_cancel:'キャンセル', me_center_h:'水平中央揃え', me_center_v:'垂直中央揃え', me_change_img:'画像を変更',
        me_change_img_desc:'選択した画像をどう変更しますか?', me_change_pick:'要素・クリップアートから選ぶ', me_change_upload:'自分の写真をアップして背景除去',
        me_clear_confirm:'キャンバスの全要素を削除しますか?', me_ctx_back:'背面へ', me_ctx_bottom:'最背面へ', me_ctx_del:'削除',
        me_ctx_dup:'複製', me_ctx_front:'最前面へ', me_ctx_fwd:'前面へ', me_dup:'複製 (Ctrl+D)', me_fancy_max:'最大8個までアップできます。',
        me_fill:'画面いっぱいに', me_layer_down:'背面へ', me_layer_up:'前面へ', me_alert_cutout:'先に切り抜きたい画像を選択してください'
    };
    var _ME_UI_EN = {
        me_prop_font:'Font', me_script_fonts:'Stylish English', me_prop_fsize:'Font size (T)', me_prop_lheight:'Line height (×)',
        me_prop_lspace:'Spacing', me_prop_stroke:'Border', me_prop_strokejoin:'Round/sharp corners', me_prop_strokew:'Width',
        me_prop_textstroke:'Outline', me_prop_textstrokew:'Outline width', me_qr_edit:'Edit QR', me_text_placeholder:'Click to type',
        me_cancel:'Cancel', me_center_h:'Center horizontally', me_center_v:'Center vertically', me_change_img:'Change image',
        me_change_img_desc:'How do you want to change the image?', me_change_pick:'Pick from elements/clipart', me_change_upload:'Upload my photo & remove background',
        me_clear_confirm:'Delete all elements on the canvas?', me_ctx_back:'Backward', me_ctx_bottom:'To back', me_ctx_del:'Delete',
        me_ctx_dup:'Duplicate', me_ctx_front:'To front', me_ctx_fwd:'Forward', me_dup:'Duplicate (Ctrl+D)', me_fancy_max:'Up to 8 images.',
        me_fill:'Fill screen', me_layer_down:'Backward', me_layer_up:'Forward', me_alert_cutout:'Please select an image to cut out first'
    };
    function _meUiT(k, fb) {
        if (_ME_UI_LANG === 'ja' && _ME_UI_JA[k]) return _ME_UI_JA[k];
        if (_ME_UI_LANG === 'en' && _ME_UI_EN[k]) return _ME_UI_EN[k];
        if (typeof window.t === 'function') { try { var r = window.t(k, fb); if (r && r !== k) return r; } catch (e) {} }
        return fb || k;
    }
    function _meTypingInField() {
        var a = document.activeElement;
        if (!a) return false;
        return a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable;
    }
    window._meZoom = function (dir) {
        var f = 1.2;
        var z = (me.zoom || 1) * (dir > 0 ? f : 1 / f);
        z = Math.max(0.3, Math.min(6, z));
        if (Math.abs(z - 1) < 0.02) { z = 1; me.panX = 0; me.panY = 0; }
        me.zoom = z;
        _meFitStage();
    };
    window._meZoomFit = function () { me.zoom = 1; me.panX = 0; me.panY = 0; _meFitStage(); };

    // 2026-07-18: 「대지에 맞추기」 — 선택 이미지(없으면 이미지 중 최상단)를 대지에 cover(꽉차게) + 중앙.
    //   고객이 이미지를 대지에 정확히 맞추기 어려워해서 원터치 버튼 제공.
    window._meFitSelectedToCanvas = function () {
        var items = me.items || [];
        // 대상: 선택 이미지 → 없으면 이미지 타입 중 마지막(제일 위)
        var it = (me.selected && me.selected.type === 'image') ? me.selected : null;
        if (!it) { for (var i = items.length - 1; i >= 0; i--) { if (items[i] && items[i].type === 'image') { it = items[i]; break; } } }
        if (!it) {
            try { alert(_meT('me_alert_fit_noimg', '대지에 맞출 이미지가 없어요. 먼저 이미지를 올려주세요.')); } catch (_) {}
            return;
        }
        // 원본 비율 — <img> naturalW/H, 없으면 현재 박스 비율
        var iw = it.w, ih = it.h;
        try { var im = it.el && it.el.querySelector('img'); if (im && im.naturalWidth && im.naturalHeight) { iw = im.naturalWidth; ih = im.naturalHeight; } } catch (_) {}
        if (!iw || !ih) return;
        var cover = Math.max(me.natW / iw, me.natH / ih);   // 대지 꽉차게(넘침은 export 시 클립)
        var w = iw * cover, h = ih * cover;
        _meSnapshot();
        it.w = w; it.h = h;
        it.x = (me.natW - w) / 2;   // 중앙 정렬 (it.rotation 등 나머지 속성은 그대로 유지)
        it.y = (me.natH - h) / 2;
        _meSyncItemDisplay(it);
        try { if (window._meSelect) window._meSelect(it); } catch (_) {}
    };
    window._meTogglePan = function () {
        me._panLock = !me._panLock;
        var b = document.getElementById('mePanBtn');
        if (b) b.classList.toggle('on', me._panLock);
        var s = $('meStage');
        if (s) s.style.cursor = me._panLock ? 'grab' : '';
    };
    (function _meSetupZoomPan() {
        var wrap = document.querySelector('.me-stage-wrap');
        if (!wrap) return;
        var over = false;
        wrap.addEventListener('mouseenter', function () { over = true; });
        wrap.addEventListener('mouseleave', function () { over = false; });
        // 대지 위에서 마우스 휠 → 확대/축소 (페이지 스크롤 막음)
        wrap.addEventListener('wheel', function (e) {
            if (!over) return;
            e.preventDefault();
            window._meZoom(e.deltaY < 0 ? 1 : -1);
        }, { passive: false });
        // 스페이스바 누른 채로 → 화면 이동 모드
        document.addEventListener('keydown', function (e) {
            if (e.code === 'Space' && over && !_meTypingInField()) {
                me._spaceDown = true; e.preventDefault();
                var s = $('meStage'); if (s) s.style.cursor = 'grab';
            }
        });
        document.addEventListener('keyup', function (e) {
            if (e.code === 'Space') {
                me._spaceDown = false;
                var s = $('meStage'); if (s && !me._panLock) s.style.cursor = '';
            }
        });
        var panning = false, psx = 0, psy = 0, ppx = 0, ppy = 0;
        // capture 단계에서 가로채 도형 드래그보다 우선 (이동 모드일 때만)
        wrap.addEventListener('pointerdown', function (e) {
            if (!(me._spaceDown || me._panLock)) return;
            panning = true; psx = e.clientX; psy = e.clientY; ppx = me.panX || 0; ppy = me.panY || 0;
            var s = $('meStage'); if (s) s.style.cursor = 'grabbing';
            e.preventDefault(); e.stopPropagation();
            try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
        }, true);
        wrap.addEventListener('pointermove', function (e) {
            if (!panning) return;
            me.panX = ppx + (e.clientX - psx);
            me.panY = ppy + (e.clientY - psy);
            _meApplyPan();
            e.preventDefault(); e.stopPropagation();
        }, true);
        function _endPan(e) {
            if (!panning) return;
            panning = false;
            var s = $('meStage'); if (s) s.style.cursor = (me._spaceDown || me._panLock) ? 'grab' : '';
            try { wrap.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        wrap.addEventListener('pointerup', _endPan, true);
        wrap.addEventListener('pointercancel', _endPan, true);
    })();

    // 사이트 언어 → 폰트 카테고리 매핑 (canvas-objects.js 와 동일)
    function _meFontLang() {
        var cfg = window.SITE_CONFIG || {};
        var c = (cfg.COUNTRY || 'KR').toUpperCase();
        var map = { 'JP':'JA', 'US':'EN', 'CN':'ZH' };
        return map[c] || c;
    }

    // DB와 동일한 Google Fonts 큐레이션 (canvas-objects.js GOOGLE_FONTS 미러)
    var ME_GOOGLE_FONTS = {
        'KR': [
            { font_name:'기본 (Sans)', font_family:'sans-serif', weights:null },
            { font_name:'노토 산스', font_family:'Noto Sans KR', weights:'400;700;900' },
            { font_name:'나눔고딕', font_family:'Nanum Gothic', weights:'400;700;800' },
            { font_name:'나눔명조', font_family:'Nanum Myeongjo', weights:'400;700' },
            { font_name:'검은고딕', font_family:'Black Han Sans', weights:'400' },
            { font_name:'나눔펜스크립트', font_family:'Nanum Pen Script', weights:'400' },
            { font_name:'도현', font_family:'Do Hyeon', weights:'400' },
            { font_name:'주아', font_family:'Jua', weights:'400' },
            { font_name:'싱글데이', font_family:'Single Day', weights:'400' },
            { font_name:'고틱 A1', font_family:'Gothic A1', weights:'400;700;900' },
            { font_name:'하이멜로디', font_family:'Hi Melody', weights:'400' },
            { font_name:'감자꽃', font_family:'Gamja Flower', weights:'400' },
            { font_name:'귀여운글씨', font_family:'Cute Font', weights:'400' },
            { font_name:'동해독도', font_family:'East Sea Dokdo', weights:'400' },
            { font_name:'개구쟁이', font_family:'Gaegu', weights:'400;700' },
            { font_name:'블랙앤화이트', font_family:'Black And White Picture', weights:'400' },
            { font_name:'송명체', font_family:'Song Myung', weights:'400' },
            { font_name:'스타일리쉬', font_family:'Stylish', weights:'400' },
            { font_name:'시적인', font_family:'Poor Story', weights:'400' },
            { font_name:'연성', font_family:'Yeon Sung', weights:'400' },
            { font_name:'고운돋움', font_family:'Gowun Dodum', weights:'400' },
            { font_name:'고운바탕', font_family:'Gowun Batang', weights:'400;700' },
            { font_name:'나눔브러쉬', font_family:'Nanum Brush Script', weights:'400' },
            { font_name:'IBM 플렉스 산스', font_family:'IBM Plex Sans KR', weights:'400;700' },
            { font_name:'노토 세리프', font_family:'Noto Serif KR', weights:'400;700;900' },
            { font_name:'해바라기', font_family:'Sunflower', weights:'500;700' },
            { font_name:'동글', font_family:'Dongle', weights:'400;700' },
            { font_name:'함렛', font_family:'Hahmlet', weights:'400;700;900' },
            { font_name:'구기', font_family:'Gugi', weights:'400' },
            { font_name:'독도', font_family:'Dokdo', weights:'400' },
            { font_name:'기랑해랑', font_family:'Kirang Haerang', weights:'400' },
            { font_name:'거석체', font_family:'Gasoek One', weights:'400' },
            { font_name:'베이글팻원', font_family:'Bagel Fat One', weights:'400' },
            { font_name:'오르빗', font_family:'Orbit', weights:'400' },
            { font_name:'제주명조', font_family:'Jeju Myeongjo', weights:'400' },
            { font_name:'제주고딕', font_family:'Jeju Gothic', weights:'400' },
            { font_name:'제주한라산', font_family:'Jeju Hallasan', weights:'400' }
        ],
        'JA': [
            { font_name:'デフォルト (Sans)', font_family:'sans-serif', weights:null },
            { font_name:'Noto Sans JP', font_family:'Noto Sans JP', weights:'400;500;700;900' },
            { font_name:'Noto Serif JP', font_family:'Noto Serif JP', weights:'400;700' },
            { font_name:'M PLUS Rounded 1c', font_family:'M PLUS Rounded 1c', weights:'400;700;900' },
            { font_name:'Zen Maru Gothic', font_family:'Zen Maru Gothic', weights:'400;500;700' },
            { font_name:'Sawarabi Mincho', font_family:'Sawarabi Mincho', weights:'400' },
            { font_name:'Sawarabi Gothic', font_family:'Sawarabi Gothic', weights:'400' },
            { font_name:'Kosugi Maru', font_family:'Kosugi Maru', weights:'400' },
            { font_name:'Shippori Mincho', font_family:'Shippori Mincho', weights:'400;700' },
            { font_name:'Klee One', font_family:'Klee One', weights:'400;600' },
            { font_name:'Zen Kaku Gothic New', font_family:'Zen Kaku Gothic New', weights:'400;500;700' },
            { font_name:'Hachi Maru Pop', font_family:'Hachi Maru Pop', weights:'400' },
            { font_name:'Kaisei Opti', font_family:'Kaisei Opti', weights:'400;700' },
            { font_name:'Kaisei Decol', font_family:'Kaisei Decol', weights:'400;700' },
            { font_name:'Zen Antique', font_family:'Zen Antique', weights:'400' },
            { font_name:'Reggae One', font_family:'Reggae One', weights:'400' },
            { font_name:'RocknRoll One', font_family:'RocknRoll One', weights:'400' },
            { font_name:'Stick', font_family:'Stick', weights:'400' },
            { font_name:'Yomogi', font_family:'Yomogi', weights:'400' },
            { font_name:'Yusei Magic', font_family:'Yusei Magic', weights:'400' },
            { font_name:'DotGothic16', font_family:'DotGothic16', weights:'400' },
            { font_name:'Dela Gothic One', font_family:'Dela Gothic One', weights:'400' },
            { font_name:'Train One', font_family:'Train One', weights:'400' },
            { font_name:'M PLUS 1p', font_family:'M PLUS 1p', weights:'400;700;900' },
            { font_name:'Zen Old Mincho', font_family:'Zen Old Mincho', weights:'400;700;900' },
            { font_name:'Rampart One', font_family:'Rampart One', weights:'400' },
            { font_name:'Potta One', font_family:'Potta One', weights:'400' },
            { font_name:'Kosugi', font_family:'Kosugi', weights:'400' },
            { font_name:'New Tegomin', font_family:'New Tegomin', weights:'400' },
            { font_name:'Hina Mincho', font_family:'Hina Mincho', weights:'400' },
            { font_name:'Kiwi Maru', font_family:'Kiwi Maru', weights:'400;500' },
            { font_name:'BIZ UDPGothic', font_family:'BIZ UDPGothic', weights:'400;700' },
            { font_name:'BIZ UDPMincho', font_family:'BIZ UDPMincho', weights:'400' },
            { font_name:'Mochiy Pop One', font_family:'Mochiy Pop One', weights:'400' }
        ],
        'EN': [
            { font_name:'Default (Sans)', font_family:'sans-serif', weights:null },
            { font_name:'Inter', font_family:'Inter', weights:'400;500;700;900' },
            { font_name:'Poppins', font_family:'Poppins', weights:'400;500;700;900' },
            { font_name:'Roboto', font_family:'Roboto', weights:'400;500;700;900' },
            { font_name:'Montserrat', font_family:'Montserrat', weights:'400;600;700;900' },
            { font_name:'Open Sans', font_family:'Open Sans', weights:'400;600;700' },
            { font_name:'Lato', font_family:'Lato', weights:'400;700;900' },
            { font_name:'Oswald', font_family:'Oswald', weights:'400;600;700' },
            { font_name:'Raleway', font_family:'Raleway', weights:'400;600;700;900' },
            { font_name:'Playfair Display', font_family:'Playfair Display', weights:'400;700;900' },
            { font_name:'Merriweather', font_family:'Merriweather', weights:'400;700;900' },
            { font_name:'Nunito', font_family:'Nunito', weights:'400;600;700;900' },
            { font_name:'Quicksand', font_family:'Quicksand', weights:'400;500;700' },
            { font_name:'DM Sans', font_family:'DM Sans', weights:'400;500;700' },
            { font_name:'Bebas Neue', font_family:'Bebas Neue', weights:'400' },
            { font_name:'Lobster', font_family:'Lobster', weights:'400' },
            { font_name:'Pacifico', font_family:'Pacifico', weights:'400' },
            { font_name:'Dancing Script', font_family:'Dancing Script', weights:'400;700' },
            { font_name:'Caveat', font_family:'Caveat', weights:'400;700' },
            { font_name:'Great Vibes', font_family:'Great Vibes', weights:'400' },
            { font_name:'Satisfy', font_family:'Satisfy', weights:'400' },
            { font_name:'Abril Fatface', font_family:'Abril Fatface', weights:'400' },
            { font_name:'Permanent Marker', font_family:'Permanent Marker', weights:'400' },
            { font_name:'Josefin Sans', font_family:'Josefin Sans', weights:'400;700' },
            { font_name:'Archivo Black', font_family:'Archivo Black', weights:'400' },
            { font_name:'Righteous', font_family:'Righteous', weights:'400' },
            { font_name:'Russo One', font_family:'Russo One', weights:'400' },
            { font_name:'Cinzel', font_family:'Cinzel', weights:'400;700;900' },
            { font_name:'Fredoka', font_family:'Fredoka', weights:'400;600;700' },
            { font_name:'Comfortaa', font_family:'Comfortaa', weights:'400;700' },
            { font_name:'Bitter', font_family:'Bitter', weights:'400;700;900' },
            { font_name:'Space Grotesk', font_family:'Space Grotesk', weights:'400;500;700' },
            { font_name:'Sora', font_family:'Sora', weights:'400;500;700' },
            { font_name:'Outfit', font_family:'Outfit', weights:'400;500;700' },
            { font_name:'Plus Jakarta Sans', font_family:'Plus Jakarta Sans', weights:'400;500;700' },
            { font_name:'Work Sans', font_family:'Work Sans', weights:'400;500;700' },
            { font_name:'Manrope', font_family:'Manrope', weights:'400;500;700' },
            { font_name:'Red Hat Display', font_family:'Red Hat Display', weights:'400;500;700;900' }
        ],
        'ZH': [
            { font_name:'默认 (Sans)', font_family:'sans-serif', weights:null },
            { font_name:'思源黑体', font_family:'Noto Sans SC', weights:'400;500;700;900' },
            { font_name:'思源宋体', font_family:'Noto Serif SC', weights:'400;700;900' },
            { font_name:'ZCOOL 小薇', font_family:'ZCOOL XiaoWei', weights:'400' },
            { font_name:'ZCOOL 庆科黄油', font_family:'ZCOOL QingKe HuangYou', weights:'400' },
            { font_name:'ZCOOL 快乐体', font_family:'ZCOOL KuaiLe', weights:'400' },
            { font_name:'马善政楷', font_family:'Ma Shan Zheng', weights:'400' },
            { font_name:'龙藏体', font_family:'Long Cang', weights:'400' },
            { font_name:'刘建毛草', font_family:'Liu Jian Mao Cao', weights:'400' },
            { font_name:'志莽行书', font_family:'Zhi Mang Xing', weights:'400' }
        ],
        'AR': [
            { font_name:'افتراضي (Sans)', font_family:'sans-serif', weights:null },
            { font_name:'Noto Sans Arabic', font_family:'Noto Sans Arabic', weights:'400;500;700;900' },
            { font_name:'Noto Kufi Arabic', font_family:'Noto Kufi Arabic', weights:'400;700' },
            { font_name:'Noto Naskh Arabic', font_family:'Noto Naskh Arabic', weights:'400;700' },
            { font_name:'Amiri', font_family:'Amiri', weights:'400;700' },
            { font_name:'Cairo', font_family:'Cairo', weights:'400;700;900' },
            { font_name:'Tajawal', font_family:'Tajawal', weights:'400;500;700;900' },
            { font_name:'El Messiri', font_family:'El Messiri', weights:'400;600;700' },
            { font_name:'Lemonada', font_family:'Lemonada', weights:'400;700' },
            { font_name:'Scheherazade New', font_family:'Scheherazade New', weights:'400;700' },
            { font_name:'Readex Pro', font_family:'Readex Pro', weights:'400;600;700' },
            { font_name:'IBM Plex Sans Arabic', font_family:'IBM Plex Sans Arabic', weights:'400;500;700' },
            { font_name:'Almarai', font_family:'Almarai', weights:'400;700;800' },
            { font_name:'Changa', font_family:'Changa', weights:'400;600;700' },
            { font_name:'Reem Kufi', font_family:'Reem Kufi', weights:'400;600;700' },
            { font_name:'Mada', font_family:'Mada', weights:'400;500;700;900' },
            { font_name:'Aref Ruqaa', font_family:'Aref Ruqaa', weights:'400;700' }
        ]
    };
    // ES/DE/FR 은 EN 과 동일한 라틴 폰트 사용
    ME_GOOGLE_FONTS['ES'] = ME_GOOGLE_FONTS['EN'];
    ME_GOOGLE_FONTS['DE'] = ME_GOOGLE_FONTS['EN'];
    ME_GOOGLE_FONTS['FR'] = ME_GOOGLE_FONTS['EN'];
    // 2026-06-16: 멋진 영문 (script/calligraphy) — 언어 무관 공통 노출.
    //   드롭다운 하단에 별도 optgroup 으로 추가. cotton_print 의 FP_SCRIPTS 와 동일 목록.
    var ME_SCRIPT_FONTS = [
        { font_name:'Great Vibes',        font_family:'Great Vibes',        weights:'400' },
        { font_name:'Allura',             font_family:'Allura',             weights:'400' },
        { font_name:'Italianno',          font_family:'Italianno',          weights:'400' },
        { font_name:'Pinyon Script',      font_family:'Pinyon Script',      weights:'400' },
        { font_name:'Petit Formal Script',font_family:'Petit Formal Script',weights:'400' },
        { font_name:'Alex Brush',         font_family:'Alex Brush',         weights:'400' },
        { font_name:'Parisienne',         font_family:'Parisienne',         weights:'400' },
        { font_name:'Sacramento',         font_family:'Sacramento',         weights:'400' },
        { font_name:'Yellowtail',         font_family:'Yellowtail',         weights:'400' },
        { font_name:'Tangerine',          font_family:'Tangerine',          weights:'400;700' },
        { font_name:'Mrs Saint Delafield',font_family:'Mrs Saint Delafield',weights:'400' },
        { font_name:'Style Script',       font_family:'Style Script',       weights:'400' },
        { font_name:'Niconne',            font_family:'Niconne',            weights:'400' },
        { font_name:'Cookie',             font_family:'Cookie',             weights:'400' },
        { font_name:'Pacifico',           font_family:'Pacifico',           weights:'400' },
        { font_name:'Dancing Script',     font_family:'Dancing Script',     weights:'400;700' }
    ];

    function _meCurrentFonts() {
        return ME_GOOGLE_FONTS[_meFontLang()] || ME_GOOGLE_FONTS['KR'];
    }

    // 폰트 lazy 로드 — 처음 선택될 때 Google Fonts <link> 주입
    var _meLoadedFonts = {};
    function _meLoadFont(fam, weights) {
        if (!fam || fam === 'sans-serif' || fam === 'serif' || fam === 'monospace' || fam === 'cursive') return;
        if (_meLoadedFonts[fam]) return;
        _meLoadedFonts[fam] = true;
        var famUrl = fam.replace(/ /g, '+');
        var url = 'https://fonts.googleapis.com/css2?family=' + famUrl;
        if (weights) url += ':wght@' + weights;
        url += '&display=swap';
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
    }

    // 2026-06-14: 폰트가 지원하는 weight 중 가장 가까운 값 반환 — canvas faux-bold 합성 방지
    function _meResolveWeight(family, wanted) {
        var clean = String(family || '').replace(/["']/g, '').trim();
        // 모든 언어의 폰트 리스트 + script 공통 리스트에서 찾기
        var allFonts = [];
        Object.keys(ME_GOOGLE_FONTS).forEach(function(k){
            (ME_GOOGLE_FONTS[k] || []).forEach(function(f){ allFonts.push(f); });
        });
        ME_SCRIPT_FONTS.forEach(function(f){ allFonts.push(f); });
        var match = allFonts.find(function(f){ return f.font_family === clean; });
        if (!match || !match.weights) return wanted;  // 정보 없으면 그대로
        var available = String(match.weights).split(';').map(function(w){ return parseInt(w, 10); }).filter(function(w){ return !isNaN(w); });
        if (available.length === 0) return wanted;
        if (available.indexOf(wanted) >= 0) return wanted;
        // 가까운 weight 반환
        return available.reduce(function(prev, curr){
            return Math.abs(curr - wanted) < Math.abs(prev - wanted) ? curr : prev;
        });
    }
    window._meResolveWeight = _meResolveWeight;

    function _meSyncItemDisplay(it) {
        it.el.style.left = (it.x * me.wScale) + 'px';
        it.el.style.top = (it.y * me.wScale) + 'px';
        it.el.style.width = (it.w * me.wScale) + 'px';
        // 2026-06-14: 회전 + 반전 결합 (CSS transform). 회전축 = 중앙.
        var rot = it.rotation || 0;
        var sx = it.flipX ? -1 : 1;
        var sy = it.flipY ? -1 : 1;
        var trans = '';
        if (rot) trans += 'rotate(' + rot + 'deg)';
        if (sx !== 1 || sy !== 1) trans += ' scale(' + sx + ',' + sy + ')';
        it.el.style.transform = trans;
        it.el.style.transformOrigin = 'center center';
        if (it.type === 'image') {
            it.el.style.height = (it.h * me.wScale) + 'px';
            var im = it.el.querySelector('img');
            // 2026-06-28: object-fit fill — 변(edge) 핸들로 늘리면 이미지도 같이 늘어남(일러스트식 자유변형). 모서리는 정비율(박스 비율 유지)이라 왜곡 없음.
            if (im) { im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'fill'; }
        } else if (it.type === 'text') {
            it.el.style.fontSize = (it.fontSize * me.wScale) + 'px';
            it.el.style.color = it.fill || '#1d1d1f';
            it.el.style.fontFamily = it.fontFamily || 'sans-serif';
            // 2026-06-26: 자간도 wScale 로 스케일 — 고정 px 면 모바일(작은 폰트)에서 자간이 상대적으로 커져
            //   같은 템플릿인데 PC=1줄 / 모바일=2줄 줄바꿈되던 문제 해결.
            it.el.style.letterSpacing = ((it.letterSpacing || 0) * me.wScale) + 'px';
            it.el.style.lineHeight = (it.lineHeight || 1.2);
            it.el.style.textAlign = it.textAlign || 'left';
            // 2026-06-14: fontWeight 를 폰트가 지원하는 값으로 보정 — faux-bold 자글거림 방지
            var fwReq = it.fontWeight || 400;
            var fwResolved = (typeof _meResolveWeight === 'function') ? _meResolveWeight(it.fontFamily, fwReq) : fwReq;
            it.el.style.fontWeight = String(fwResolved);
            // 2026-06-28: 글씨 테두리(stroke) — paint-order:stroke fill 로 글자 모양 보존(서체 안 깨짐).
            //   두께는 2×(centered) → 보이는 외곽 테두리 = textStrokeW. 표시 px 는 wScale 반영.
            var _tsw = (it.textStrokeW || 0);
            if (_tsw > 0) {
                // 2026-06-28: 에디터 미리보기 — 매끄러운 -webkit-text-stroke 사용(다방향 text-shadow 는 찌글거림).
                //   PDF 는 stroke-linejoin=round 로 정확히 둥글게 출력. (둥근/각 미세 차이는 안내 문구로 안내)
                it.el.style.webkitTextStrokeWidth = (2 * _tsw * me.wScale) + 'px';
                it.el.style.webkitTextStrokeColor = it.textStroke || '#000000';
                it.el.style.paintOrder = 'stroke fill';
                it.el.style.textShadow = '';
            } else {
                it.el.style.webkitTextStrokeWidth = '0';
                it.el.style.paintOrder = '';
                it.el.style.textShadow = '';
            }
            // 2026-06-15: 텍스트 박스는 글자에 맞춰 줄어들도록 width:max-content, 최대폭은 it.w 로 캡.
            //   결과: 선택 핸들이 글자 끝에 붙음 (우측으로 빈 공간 없음). 글자가 길어지면 it.w 까지 늘다가 그 이후엔 wrap.
            // 2026-06-16: 사용자가 edge 핸들(n/s/e/w)로 명시적 리사이즈 한 경우 — 고정 width/height 사용.
            //   (auto-shrink 가 다시 끼어들어 사용자가 늘린 폭을 무시하던 버그 차단.)
            if (it._edgeResized) {
                it.el.style.width = (it.w * me.wScale) + 'px';
                it.el.style.maxWidth = 'none';
                it.el.style.height = (it.h * me.wScale) + 'px';
                it.el.style.minHeight = '';
            } else {
                it.el.style.height = 'auto';
                it.el.style.width = 'max-content';
                // 소수점 반올림 + 1px 버퍼 — 스케일별 sub-pixel 차이로 인한 의도치 않은 줄바꿈 방지.
                it.el.style.maxWidth = (Math.ceil(it.w * me.wScale) + 1) + 'px';
                it.el.style.minHeight = '';
            }
        } else if (it.type === 'shape') {
            it.el.style.height = (it.h * me.wScale) + 'px';
            it.el.style.background = it.fill || '#7c3aed';
            it.el.style.border = (it.strokeWidth || 0) > 0 ? (it.strokeWidth + 'px solid ' + (it.stroke || '#000')) : 'none';
            // 2026-06-17 v538: 별(star) shape — clip-path 로 5각 별 모양.
            if (it.shape === 'star') {
                it.el.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
                it.el.style.borderRadius = '';
            } else {
                it.el.style.clipPath = '';
            }
        } else if (it.type === 'shelf') {
            // 2026-06-17: 선반 — 흰색 배경 + 빨강 테두리. 얇은 가로 막대 (실제 3cm = 30mm 두께).
            it.el.style.height = (it.h * me.wScale) + 'px';
            it.el.style.background = '#ffffff';
            it.el.style.border = '2px solid #dc2626';
            it.el.style.boxSizing = 'border-box';
        }
        // 2026-06-16 v3: 이 item 에 칼선이 있으면 같이 따라 움직임/크기조절 — 전체 재그리기.
        if (it && it._cutlineRelPts) {
            try { _meCutlineRenderAll(); } catch(_ce) {}
        }
        // 2026-07-11: 객체크기 모드 — 객체(칼선 조각 또는 네모 이미지) 크기 변화를 주문(가격/사이즈칸)에 디바운스 동기화.
        if (window._meObjSizeMode && it && (it._cutlineRelPts || it.type === 'image')) {
            try {
                clearTimeout(me._objSizeSyncT);
                me._objSizeSyncT = setTimeout(function(){
                    try {
                        var s = window._meGetStandeeSizeMm();
                        if (!s) return;
                        _meUpdateObjSizeInputs(s.wMm, s.hMm);
                        if (typeof window._soOnStandeeObjSize === 'function') window._soOnStandeeObjSize(s.wMm, s.hMm);
                    } catch(_) {}
                }, 60);
            } catch(_) {}
        }
    }
    // 떠있는 창의 크기 입력값을 현재 객체 크기로 갱신 (드래그 중 라이브)
    function _meUpdateObjSizeInputs(wMm, hMm) {
        var wi = document.getElementById('meObjSizeW');
        var hi = document.getElementById('meObjSizeH');
        if (wi && document.activeElement !== wi) wi.value = Math.round(wMm);
        if (hi && document.activeElement !== hi) hi.value = Math.round(hMm);
    }

    function _meSetSize(w, h, label) {
        me.natW = w; me.natH = h;
        $('meStage').style.background = me.bg;
        _meFitStage();
        // 재단 가이드가 있으면 새 대지 크기에 맞춰 재계산
        try { if (me._trimGuideMm && typeof _meRenderTrimGuide === 'function') _meRenderTrimGuide(); } catch(_) {}
        // 2026-06-28: 사이즈 변경 후 디자인을 캔버스 중앙으로 (위로 붙던 문제). 연속 입력(타이핑) 시 튀지 않게 debounce.
        try { clearTimeout(me._centerT); me._centerT = setTimeout(function(){ try { if (window._meCenterDesign) window._meCenterDesign(); } catch(_) {} }, 220); } catch(_) {}
    }
    // 2026-06-14: simple_order 모달에서 호출하기 위해 window 노출
    window._meSetSize = _meSetSize;
    // 2026-06-16 v13: 실제 mm 사이즈 별도 저장 — natW/H 는 _mmPairToPx 가 1200 으로 capped 한 픽셀이라
    //   가벽/큰 상품에선 mm 변환 시 잘못된 값 (예: 2400mm wall → natH=960 → ruler 254mm 표시).
    //   _meSetMmSize(wMm, hMm) 로 mm 직접 저장 → 줄자/칼선 PDF 가 이 값을 우선 사용.
    window._meSetMmSize = function(wMm, hMm) {
        me.natWMm = wMm; me.natHMm = hMm;
        try { _meUpdateSizeLabel(); } catch(_) {}   // 2026-06-27: 줄자 대신 크기 라벨 갱신
        try { _meUpdateWingOverlay(); } catch(_) {}
    };

    // ─────────────────────────────────────────────────────────────────────
    // 2026-07-11: 등신대/자유인쇄커팅 — "객체(칼선 바깥 윤곽=그림+받침) 크기" 모드.
    //   가로·세로·가격이 대지가 아니라 실제 잘려나갈 조각(칼선 bbox) 기준이 되도록.
    //   simple_order 가 _meSetObjSizeMode(true) 로 켬. 대지는 시각적으로 숨김.
    // ─────────────────────────────────────────────────────────────────────
    window._meObjSizeMode = false;
    // 보드(받침/외곽) 색 — 재질에 따라 (화이트/크라프트 등). export 배경(me.bg)에도 반영.
    window._meBoardColor = '#ffffff';
    window._meSetBoardColor = function(color) {
        window._meBoardColor = color || '#ffffff';
        try {
            me.bg = window._meBoardColor;
            var st = $('meStage'); if (st) st.style.background = me.bg;   // (nofill 클래스가 화면상은 투명 유지)
            if (typeof _meCutlineRenderAll === 'function') _meCutlineRenderAll();
        } catch(_) {}
    };
    window._meSetObjSizeMode = function(on) {
        window._meObjSizeMode = !!on;
        try {
            var st = $('meStage'); if (st) st.classList.toggle('me-stage--nofill', !!on);
            var lbl = document.getElementById('meSizeLabel'); if (lbl) lbl.style.display = on ? 'none' : '';
            // 흰색 바닥 fill 갱신/제거 (칼선이 이미 있으면 반영)
            if (typeof _meCutlineRenderAll === 'function') _meCutlineRenderAll();
        } catch(_) {}
    };
    // 칼선 가진 메인 객체(없으면 선택/첫 이미지) 찾기
    function _meFindStandeeItem() {
        var items = me.items || [];
        for (var i = items.length - 1; i >= 0; i--) {
            if (items[i] && items[i]._cutlineRelPts && items[i]._cutlineRelPts.length >= 3) return items[i];
        }
        if (me.selected && me.selected.type === 'image') return me.selected;
        for (var j = 0; j < items.length; j++) { if (items[j] && items[j].type === 'image') return items[j]; }
        return me.selected || items[0] || null;
    }
    // 칼선 rel-pts bbox(px, 받침 포함) — 없으면 it 박스
    function _meStandeeBBoxPx(it) {
        if (it && it._cutlineRelPts && it._cutlineRelPts.length >= 3) {
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            it._cutlineRelPts.forEach(function(p){
                var ax = it.x + p[0]*it.w, ay = it.y + p[1]*it.h;
                if (ax < minX) minX = ax; if (ax > maxX) maxX = ax;
                if (ay < minY) minY = ay; if (ay > maxY) maxY = ay;
            });
            return { x:minX, y:minY, w:maxX-minX, h:maxY-minY };
        }
        if (it) return { x:it.x, y:it.y, w:it.w, h:it.h };
        return null;
    }
    window._meGetStandeeSizeMm = function() {
        var it = _meFindStandeeItem();
        var bb = _meStandeeBBoxPx(it);
        if (!bb || !(bb.w > 0) || !(bb.h > 0)) return null;
        var mmPerPxW = (me.natWMm && me.natW) ? (me.natWMm / me.natW) : (1 / 3.7795);
        var mmPerPxH = (me.natHMm && me.natH) ? (me.natHMm / me.natH) : (1 / 3.7795);
        return { wMm: bb.w * mmPerPxW, hMm: bb.h * mmPerPxH, it: it, bb: bb };
    };
    // 객체를 targetWMm 가로가 되도록 균등 스케일(비율 고정). 중심 유지.
    window._meSetStandeeSizeMm = function(targetWMm) {
        var cur = window._meGetStandeeSizeMm();
        if (!cur || !(cur.wMm > 0) || !(targetWMm > 0)) return;
        var it = cur.it; if (!it) return;
        var scale = targetWMm / cur.wMm;
        if (!isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.0005) return;
        var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
        it.w = it.w * scale; it.h = it.h * scale;
        it.x = cx - it.w / 2; it.y = cy - it.h / 2;
        _meSyncItemDisplay(it);
        try { _meFitStandeeCanvas(); } catch(_) {}
    };
    // 객체가 너무 크거나(잘림) 작을 때만 캔버스 px/mm 를 비례 조정(물리 mm 불변) + 중앙 재배치.
    //   natW/natH 와 natWMm/natHMm 를 같은 배율 k 로 바꾸므로 객체 mm = it.w×natWMm/natW 는 불변.
    function _meFitStandeeCanvas() {
        if (!window._meObjSizeMode) return;
        var cur = window._meGetStandeeSizeMm(); if (!cur) return;
        var bb = cur.bb, it = cur.it; if (!it) return;
        var frac = Math.max(bb.w / me.natW, bb.h / me.natH);
        if (!(frac > 0)) return;
        if (frac > 0.9 || frac < 0.4) {
            var k = frac / 0.7;                        // 목표: bbox 가 캔버스의 ~70%
            me.natW = Math.max(60, Math.round(me.natW * k));
            me.natH = Math.max(60, Math.round(me.natH * k));
            if (me.natWMm) me.natWMm *= k;
            if (me.natHMm) me.natHMm *= k;
            // bbox 중심을 캔버스 중심으로 (it.x/y 만 이동, 크기·mm 불변)
            var bbCx = bb.x + bb.w / 2, bbCy = bb.y + bb.h / 2;
            it.x += (me.natW / 2 - bbCx);
            it.y += (me.natH / 2 - bbCy);
            try { _meFitStage(); } catch(_) {}
            _meSyncItemDisplay(it);
        }
    }
    // 2026-06-17: 가벽 가이드 — 양쪽 옆면(접히는 날개) 빗금 + 1미터 단위 절단선 (가벽이 1m 패널 여러 개로 구성됨).
    //   pointer-events:none, me.items 와 무관 → export/print/PDF 에 절대 포함 안 됨. 토글 가능 (눈 버튼).
    me._wingMm = 0;
    me._guidesVisible = true;   // 기본 ON
    window._meSetWingMm = function(mm) {
        me._wingMm = mm || 0;
        try { _meUpdateGuides(); } catch(_) {}
    };
    window._meGuidesToggle = function() {
        me._guidesVisible = !me._guidesVisible;
        try { _meUpdateGuides(); } catch(_) {}
        var icon = document.getElementById('meGuidesIcon');
        if (icon) icon.className = me._guidesVisible ? 'fa-solid fa-eye me-tb-ic' : 'fa-solid fa-eye-slash me-tb-ic';
        var btn = document.getElementById('meGuidesToggle');
        if (btn) {
            btn.style.background = me._guidesVisible ? '#fff' : '#fef2f2';
            btn.style.color = me._guidesVisible ? '#dc2626' : '#94a3b8';
        }
    };
    // legacy 호환 (이전 이름)
    function _meUpdateWingOverlay() { _meUpdateGuides(); }
    function _meUpdateGuides() {
        if (!me.stage) return;
        var visible = (me._guidesVisible !== false);
        var leftEl = document.getElementById('meWingLeft');
        var rightEl = document.getElementById('meWingRight');
        var mm = me._wingMm || 0;
        var natWMm = me.natWMm || 0;
        var hasWing = !!(mm && natWMm && mm * 2 < natWMm);
        // 1) 옆면 (날개) 빗금 overlay
        if (!hasWing) {
            if (leftEl) leftEl.style.display = 'none';
            if (rightEl) rightEl.style.display = 'none';
        } else {
            var pct = (mm / natWMm) * 100;
            var commonBg = 'repeating-linear-gradient(45deg, rgba(220,38,38,0.18) 0px, rgba(220,38,38,0.18) 10px, rgba(220,38,38,0.06) 10px, rgba(220,38,38,0.06) 20px)';
            // 2026-06-17: 옆면 라벨 다국어 — KR/JA/EN/기타 한 글자 라벨로.
            var _wLang = (window.CURRENT_LANG || 'kr').toLowerCase();
            var _wLbl = (_wLang === 'ja' || _wLang === 'jp') ? '側面'
                      : (_wLang === 'kr' || _wLang === 'ko') ? '옆면'
                      : (_wLang === 'zh' || _wLang === 'cn') ? '侧面'
                      : 'SIDE';
            var labelHtml = '<div class="me-wing-label">' + _wLbl + '<br><span class="me-wing-mm">' + mm + 'mm</span></div>';
            if (!leftEl) {
                leftEl = document.createElement('div');
                leftEl.id = 'meWingLeft';
                leftEl.className = 'me-wing-overlay';
                leftEl.innerHTML = labelHtml;
                me.stage.appendChild(leftEl);
            } else { leftEl.innerHTML = labelHtml; }
            if (!rightEl) {
                rightEl = document.createElement('div');
                rightEl.id = 'meWingRight';
                rightEl.className = 'me-wing-overlay';
                rightEl.innerHTML = labelHtml;
                me.stage.appendChild(rightEl);
            } else { rightEl.innerHTML = labelHtml; }
            // 2026-06-17: 옆면 보더 얇게 — 2px → 0.75px, 불투명도 살짝 낮춤.
            leftEl.style.cssText  = 'position:absolute; left:0; top:0; bottom:0; width:' + pct.toFixed(3) + '%; pointer-events:none; z-index:998; background:' + commonBg + '; border-right:0.75px dashed rgba(220,38,38,0.5); display:flex; align-items:center; justify-content:center; box-sizing:border-box;';
            rightEl.style.cssText = 'position:absolute; right:0; top:0; bottom:0; width:' + pct.toFixed(3) + '%; pointer-events:none; z-index:998; background:' + commonBg + '; border-left:0.75px dashed rgba(220,38,38,0.5); display:flex; align-items:center; justify-content:center; box-sizing:border-box;';
            leftEl.style.display = visible ? '' : 'none';
            rightEl.style.display = visible ? '' : 'none';
        }
        // 2) 1m 단위 패널 절단선 (내부 fold 라인) — 점선만, 라벨 X (사용자 요청).
        var cuts = me.stage.querySelectorAll('.me-panel-cut, .me-panel-cut-label');
        cuts.forEach(function(el){ el.remove(); });
        if (visible && hasWing) {
            var panelMm = 1000;
            var innerWMm = natWMm - 2 * mm;
            var panelCount = Math.round(innerWMm / panelMm);
            for (var i = 1; i < panelCount; i++) {
                var posMm = mm + i * panelMm;
                var posPct = (posMm / natWMm) * 100;
                var cut = document.createElement('div');
                cut.className = 'me-panel-cut';
                // 2026-06-17: 절단선 얇게 — 1.5px → 0.75px, 불투명도 살짝 낮춤.
                cut.style.cssText = 'position:absolute; left:' + posPct.toFixed(3) + '%; top:0; bottom:0; width:0; border-left:0.75px dashed rgba(220,38,38,0.45); pointer-events:none; z-index:997;';
                me.stage.appendChild(cut);
            }
        }
    }
    (function _injectWingCss(){
        if (document.getElementById('meWingCss')) return;
        var s = document.createElement('style'); s.id = 'meWingCss';
        // 2026-06-17: 옆면 라벨 작고 얇게 — 사용자 요청. font-size 14→9, weight 900→500, letter-spacing 3→1.
        s.textContent = '.me-wing-overlay .me-wing-label{ font-family:inherit; font-weight:500; color:rgba(185,28,28,0.7); font-size:9px; text-align:center; line-height:1.3; writing-mode:vertical-rl; transform:rotate(180deg); letter-spacing:1px; text-shadow:0 1px 1px rgba(255,255,255,0.5); } .me-wing-overlay .me-wing-mm{ font-size:8px; font-weight:400; letter-spacing:0.3px; opacity:0.85; }';
        document.head.appendChild(s);
    })();
    window._meSyncItemDisplay = _meSyncItemDisplay;

    // ─────────────────────── Undo 스택 ───────────────────────
    // 2026-06-14: Ctrl+Z 되돌리기 — 각 mutation 직전 snapshot 저장 → pop 시 restore.
    var MAX_HISTORY = 50;
    function _meSnapshot() {
        if (!me) return;
        var snap = {
            natW: me.natW, natH: me.natH, bg: me.bg,
            items: me.items.map(function(it){
                var clone = {};
                ['type','x','y','w','h','rotation','src','text','fill','fontSize','fontFamily','fontWeight','letterSpacing','lineHeight','textAlign','shape','stroke','strokeWidth','_edgeResized','_isQr','_qrUrl'].forEach(function(k){
                    if (it[k] !== undefined) clone[k] = it[k];
                });
                return clone;
            })
        };
        me.history.push(snap);
        if (me.history.length > MAX_HISTORY) me.history.shift();
        _meUpdateUndoBtn();
    }
    function _meUpdateUndoBtn() {
        var b = document.getElementById('meUndoBtn');
        if (b) {
            b.disabled = !me.history || me.history.length === 0;
            b.style.opacity = b.disabled ? '0.35' : '';
        }
    }
    function _meRestore(snap) {
        if (!snap) return;
        // 기존 item DOM 제거
        me.items.forEach(function(o){ try { o.el.remove(); } catch(_e){} });
        me.items = [];
        _meSelect(null);
        // 캔버스 사이즈/배경 복원
        me.natW = snap.natW; me.natH = snap.natH; me.bg = snap.bg;
        me.stage.style.background = me.bg;
        var meBgPick = document.getElementById('meBgColor');
        if (meBgPick) meBgPick.value = me.bg;
        // item 재생성
        (snap.items || []).forEach(function(s){
            var el = document.createElement('div');
            var cls = 'me-item';
            if (s.type === 'text') cls += ' text';
            if (s.type === 'shape') cls += ' shape' + (s.shape === 'circle' ? ' circle' : '');
            el.className = cls;
            el.style.zIndex = (++me.zCounter);
            if (s.type === 'image') {
                var img = document.createElement('img'); img.src = s.src; el.appendChild(img);
            } else if (s.type === 'text') {
                el.textContent = s.text || '';
            }
            me.stage.appendChild(el);
            var it = Object.assign({ el: el }, s);
            me.items.push(it);
            _meSyncItemDisplay(it);
            _meBindDrag(it);
        });
        _meFitStage();
    }
    window._meUndo = function() {
        if (!me.history || me.history.length === 0) return;
        var snap = me.history.pop();
        _meRestore(snap);
        _meUpdateUndoBtn();
    };
    window._meSnapshot = _meSnapshot;

    // 2026-06-25: 앞/뒤면(양면 명함 등) — 단일면 me 모델 위에 두 면 스냅샷을 저장/교체.
    //   _meRestore 가 비노출이라 여기(IIFE 내부)에 구현하고 깔끔한 API만 window 에 노출.
    var _meSideCur = 'front';
    var _meSideEnabled = false;
    var _meSideSnap = { front: null, back: null };
    function _meSerializeState() {
        if (!me) return null;
        return {
            natW: me.natW, natH: me.natH, bg: me.bg,
            items: me.items.map(function(it){
                var clone = {};
                ['type','x','y','w','h','rotation','src','text','fill','fontSize','fontFamily','fontWeight','letterSpacing','lineHeight','textAlign','shape','stroke','strokeWidth','_edgeResized','_isQr','_qrUrl'].forEach(function(k){
                    if (it[k] !== undefined) clone[k] = it[k];
                });
                return clone;
            })
        };
    }
    function _meEmptyState() {
        return { natW: me.natW, natH: me.natH, bg: me.bg, items: [] };
    }
    function _meUpdateSideTabsUI() {
        var box = document.getElementById('meSideTabs');
        if (!box) return;
        box.style.display = _meSideEnabled ? 'flex' : 'none';
        box.querySelectorAll('.me-side-tab').forEach(function(t){
            t.classList.toggle('active', t.getAttribute('data-side') === _meSideCur);
        });
    }
    window._meSidesEnabled = function() { return _meSideEnabled; };
    window._meSidesInit = function(on) {
        _meSideEnabled = !!on;
        _meSideCur = 'front';
        _meSideSnap = { front: null, back: null };
        _meUpdateSideTabsUI();
    };
    window._meSwitchSide = function(side) {
        if (!_meSideEnabled || (side !== 'front' && side !== 'back')) return;
        if (side === _meSideCur) return;
        // 현재 면 저장
        _meSideSnap[_meSideCur] = _meSerializeState();
        _meSideCur = side;
        var snap = _meSideSnap[side];
        _meRestore(snap || _meEmptyState());  // 미방문 면 = 빈 캔버스 (confirm 없음)
        _meSelect(null);
        _meUpdateSideTabsUI();
    };
    // 앞·뒤 둘 다 PNG export (내용 있는 면만). { front, back } dataURL 반환. 끝에 보던 면 복원.
    // 2026-06-25: 면별로 인쇄용 PDF(벡터/고해상도) + 썸네일 PNG 둘 다 반환.
    //   { front: { pdf:Blob|null, png:dataUrl|null }, back: {...} }
    window._meExportBothSides = async function() {
        if (!me) return { front: null, back: null };
        _meSideSnap[_meSideCur] = _meSerializeState();  // 현재 면 캡처
        var out = { front: null, back: null };
        var sides = ['front', 'back'];
        for (var i = 0; i < sides.length; i++) {
            var s = sides[i];
            var snap = _meSideSnap[s];
            if (!snap || !snap.items || snap.items.length === 0) continue;
            _meRestore(snap);
            var _png = null, _pdf = null;
            try { _png = await window._meExportPNG(); } catch (e) { console.warn('[me sides png]', s, e); }
            try { if (typeof window._meExportPDF === 'function') _pdf = await window._meExportPDF({ pngDataUrl: _png }); } catch (e2) { console.warn('[me sides pdf]', s, e2); }
            out[s] = { pdf: _pdf, png: _png };
        }
        _meRestore(_meSideSnap[_meSideCur] || _meEmptyState());  // 보던 면 복원
        return out;
    };

    // 2026-06-14: Smart guide — 드래그 중 캔버스 중앙(가로·세로)에 6px 이내면 snap.
    var _snapTol = 6;
    function _meDragSnap(it) {
        // 2026-06-18 v566: 텍스트의 경우 width:max-content 로 실제 폭이 it.w 보다 작음 → 실제 DOM 폭 사용.
        var realW = it.w, realH = it.h;
        try {
            var _r = it.el && it.el.getBoundingClientRect();
            if (_r && me.wScale) {
                if (_r.width > 0)  realW = _r.width  / me.wScale;
                if (_r.height > 0) realH = _r.height / me.wScale;
            }
        } catch(_){}
        var cx = it.x + realW / 2;
        var cy = it.y + realH / 2;
        var canvasCx = me.natW / 2;
        var canvasCy = me.natH / 2;
        var tol = _snapTol / (me.wScale || 1);
        var showV = false, showH = false;
        if (Math.abs(cx - canvasCx) < tol) {
            it.x = canvasCx - realW / 2;
            showV = true;
        }
        if (Math.abs(cy - canvasCy) < tol) {
            it.y = canvasCy - realH / 2;
            showH = true;
        }
        _meShowGuides(showV, showH);
    }
    function _meShowGuides(v, h) {
        if (!me.stage) return;
        var vg = me.stage.querySelector('.me-guide-v');
        var hg = me.stage.querySelector('.me-guide-h');
        if (v) {
            if (!vg) {
                vg = document.createElement('div');
                vg.className = 'me-guide me-guide-v';
                me.stage.appendChild(vg);
            }
            vg.style.left = (me.natW / 2 * me.wScale) + 'px';
            vg.style.display = '';
        } else if (vg) vg.style.display = 'none';
        if (h) {
            if (!hg) {
                hg = document.createElement('div');
                hg.className = 'me-guide me-guide-h';
                me.stage.appendChild(hg);
            }
            hg.style.top = (me.natH / 2 * me.wScale) + 'px';
            hg.style.display = '';
        } else if (hg) hg.style.display = 'none';
    }
    function _meHideGuides() {
        if (!me.stage) return;
        me.stage.querySelectorAll('.me-guide').forEach(function(g){ g.style.display = 'none'; });
    }

    // 2026-06-14: 선택된 item 복제 (Ctrl+D / 컨텍스트 메뉴)
    window._meDuplicate = function(target) {
        var it = target || me.selected;
        if (!it) return;
        _meSnapshot();
        var clone = {};
        Object.keys(it).forEach(function(k){ if (k !== 'el') clone[k] = it[k]; });
        // 약간 오프셋
        clone.x = it.x + 20 / (me.wScale || 1);
        clone.y = it.y + 20 / (me.wScale || 1);
        var el = document.createElement('div');
        var cls = 'me-item';
        if (clone.type === 'text') cls += ' text';
        if (clone.type === 'shape') cls += ' shape' + (clone.shape === 'circle' ? ' circle' : '');
        el.className = cls;
        el.style.zIndex = (++me.zCounter);
        if (clone.type === 'image') {
            var img = document.createElement('img'); img.src = clone.src; el.appendChild(img);
        } else if (clone.type === 'text') {
            el.textContent = clone.text || '';
        }
        me.stage.appendChild(el);
        var newIt = Object.assign({ el: el }, clone);
        me.items.push(newIt);
        _meSyncItemDisplay(newIt);
        _meBindDrag(newIt);
        _meSelect(newIt);
    };

    // 2026-06-19 v619: Ctrl+C / Ctrl+V 복사·붙여넣기 — 클립보드는 in-memory (한 번 복사 → 여러 번 붙여넣기 가능)
    var _meClipboard = null;
    window._meCopy = function(target) {
        var it = target || me.selected;
        if (!it) return false;
        var snap = {};
        Object.keys(it).forEach(function(k){ if (k !== 'el') snap[k] = it[k]; });
        _meClipboard = snap;
        return true;
    };
    window._mePaste = function() {
        if (!_meClipboard) return;
        _meSnapshot();
        var clone = JSON.parse(JSON.stringify(_meClipboard));
        var offset = 20 / (me.wScale || 1);
        clone.x = (clone.x || 0) + offset;
        clone.y = (clone.y || 0) + offset;
        // 연속 paste 시 누적 오프셋 — 같은 위치 겹쳐 보이지 않게
        _meClipboard.x = clone.x;
        _meClipboard.y = clone.y;
        var el = document.createElement('div');
        var cls = 'me-item';
        if (clone.type === 'text') cls += ' text';
        if (clone.type === 'shape') cls += ' shape' + (clone.shape === 'circle' ? ' circle' : '');
        el.className = cls;
        el.style.zIndex = (++me.zCounter);
        if (clone.type === 'image') {
            var img = document.createElement('img'); img.src = clone.src; el.appendChild(img);
        } else if (clone.type === 'text') {
            el.textContent = clone.text || '';
        }
        me.stage.appendChild(el);
        var newIt = Object.assign({ el: el }, clone);
        // _isBackground 플래그는 paste 본에는 적용 안 함 — 잠금 풀린 자유 편집 사본
        delete newIt._isBackground;
        if (newIt.el) newIt.el.classList.remove('me-bg-locked');
        me.items.push(newIt);
        _meSyncItemDisplay(newIt);
        _meBindDrag(newIt);
        _meSelect(newIt);
    };

    // 2026-06-14: 좌우/상하 반전 (flipX/flipY 토글)
    window._meFlip = function(target, axis) {
        var it = target || me.selected;
        if (!it) return;
        _meSnapshot();
        if (axis === 'x') it.flipX = !it.flipX;
        else if (axis === 'y') it.flipY = !it.flipY;
        _meSyncItemDisplay(it);
    };

    // 2026-06-14: 레이어 순서 — items 배열 + z-index 동시 조정
    window._meBringForward = function(target) {
        var it = target || me.selected;
        if (!it) return;
        var idx = me.items.indexOf(it);
        if (idx < 0 || idx >= me.items.length - 1) return;
        _meSnapshot();
        var nxt = me.items[idx + 1];
        me.items[idx + 1] = it;
        me.items[idx] = nxt;
        // z-index 스왑
        var z = it.el.style.zIndex, nz = nxt.el.style.zIndex;
        it.el.style.zIndex = nz; nxt.el.style.zIndex = z;
    };
    window._meSendBackward = function(target) {
        var it = target || me.selected;
        if (!it) return;
        var idx = me.items.indexOf(it);
        if (idx <= 0) return;
        _meSnapshot();
        var prv = me.items[idx - 1];
        me.items[idx - 1] = it;
        me.items[idx] = prv;
        var z = it.el.style.zIndex, pz = prv.el.style.zIndex;
        it.el.style.zIndex = pz; prv.el.style.zIndex = z;
    };
    // 2026-06-14: 미니 에디터의 me.stage 를 PNG dataURL 로 변환 — simple_order "디자인 완료 · 적용" 에서 사용
    window._meExportPNG = async function() {
        try {
            if (!me || !me.stage || !me.natW || !me.natH) return null;
            // 선택 핸들/del 버튼 임시 제거 (export 에 포함되지 않도록)
            _meSelect(null);
            // 2026-06-25: 그리기 순서를 화면 z-index 순으로 정렬 — '뒤로/앞으로'는 zIndex 만 바꾸고 배열은 안 바꿔서,
            //   배경을 뒤로 보내도 export(썸네일)·저장(slots)·적용 시 배경이 글씨를 덮던 문제 해결.
            try { if (me.items && me.items.length > 1) me.items.sort(function(a, b){ return _meZ(a) - _meZ(b); }); } catch(_zsort){}
            // 2026-06-14: 텍스트 동기화 — 사용자가 typing 중(blur 안 함)이면 it.text 미반영. textContent 로 강제 sync.
            //   또한 활성 contenteditable 강제 blur (caret 숨김 + sync 트리거).
            try {
                if (document.activeElement && document.activeElement.blur) {
                    document.activeElement.blur();
                }
                me.items.forEach(function(it){
                    if (it && it.type === 'text' && it.el) {
                        // 2026-06-15: width:max-content 로 글씨 박스가 줄어든 경우 — 실제 렌더된 폭을 it.w 에 반영.
                        try {
                            var _rect = it.el.getBoundingClientRect();
                            var _scale = me.wScale || 1;
                            if (_rect && _rect.width > 0 && _scale > 0) {
                                it.w = _rect.width / _scale;
                            }
                        } catch(_we) {}
                        // 2026-06-19 v630: _meGetCleanText 통합 — .me-del(×)/.me-handle 자식 자동 제외.
                        // 2026-06-25: 빈값이면 기존 it.text 보존 (텍스트 사라짐 방지)
                        var _ct2 = _meGetCleanText(it.el);
                        if (_ct2) it.text = _ct2;
                    }
                });
            } catch(_se){}
            // 2026-06-14: 폰트가 아직 로드 중이면 대기 (Korean fonts 보장)
            try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(_fe){}
            // 2026-06-18 v563: 사용 중인 텍스트의 정확한 폰트 spec 을 명시적으로 preload
            //   document.fonts.ready 만으로는 일부 폰트가 로드 완료 전 export 됨 → 폴백 폰트로 렌더 → 다른 폭/굵기로 보임.
            try {
                if (document.fonts && document.fonts.load) {
                    var _fontSpecs = new Set();
                    me.items.forEach(function(it){
                        if (it && it.type === 'text' && it.fontFamily) {
                            var ff = String(it.fontFamily).replace(/["']/g, '');
                            if (ff && ff !== 'sans-serif' && ff !== 'serif') {
                                var fs = it.fontSize || 24;
                                var fw = (typeof _meResolveWeight === 'function') ? _meResolveWeight(ff, it.fontWeight || 400) : (it.fontWeight || 400);
                                _fontSpecs.add(fw + ' ' + fs + 'px "' + ff + '"');
                            }
                        }
                    });
                    await Promise.all(Array.from(_fontSpecs).map(function(spec){
                        return document.fonts.load(spec).catch(function(){ return null; });
                    }));
                }
            } catch(_fle){}
            // 2026-06-14: 텍스트 품질 위해 2배 해상도로 그리고 ctx.scale(2) — 자글거림 감소.
            var EXPORT_DPR = 2;
            var c = document.createElement('canvas');
            c.width = me.natW * EXPORT_DPR;
            c.height = me.natH * EXPORT_DPR;
            var ctx = c.getContext('2d');
            ctx.scale(EXPORT_DPR, EXPORT_DPR);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            try { ctx.textRendering = 'geometricPrecision'; } catch(_tr){}
            // 배경
            ctx.fillStyle = me.bg || '#ffffff';
            ctx.fillRect(0, 0, me.natW, me.natH);
            // items 순서대로 (zCounter 무관, items 배열 순서) 그리기
            for (var i = 0; i < me.items.length; i++) {
                var it = me.items[i];
                if (it.type === 'shape') {
                    ctx.fillStyle = it.fill || '#7c3aed';
                    // 2026-06-17 v538: 별(star) shape — clip-path 와 동일한 5각 별 polygon (normalized).
                    function _drawStarPath(x, y, w, h) {
                        var pts = [[0.50,0.00],[0.61,0.35],[0.98,0.35],[0.68,0.57],[0.79,0.91],[0.50,0.70],[0.21,0.91],[0.32,0.57],[0.02,0.35],[0.39,0.35]];
                        ctx.beginPath();
                        for (var pi = 0; pi < pts.length; pi++) {
                            var px = x + pts[pi][0] * w;
                            var py = y + pts[pi][1] * h;
                            if (pi === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                    }
                    if (it.shape === 'circle') {
                        ctx.beginPath();
                        ctx.ellipse(it.x + it.w/2, it.y + it.h/2, it.w/2, it.h/2, 0, 0, Math.PI*2);
                        ctx.fill();
                    } else if (it.shape === 'star') {
                        _drawStarPath(it.x, it.y, it.w, it.h);
                        ctx.fill();
                    } else {
                        ctx.fillRect(it.x, it.y, it.w, it.h);
                    }
                    if (it.strokeWidth > 0) {
                        ctx.strokeStyle = it.stroke || '#000';
                        ctx.lineWidth = it.strokeWidth;
                        if (it.shape === 'circle') {
                            ctx.beginPath();
                            ctx.ellipse(it.x + it.w/2, it.y + it.h/2, it.w/2, it.h/2, 0, 0, Math.PI*2);
                            ctx.stroke();
                        } else if (it.shape === 'star') {
                            _drawStarPath(it.x, it.y, it.w, it.h);
                            ctx.stroke();
                        } else {
                            ctx.strokeRect(it.x, it.y, it.w, it.h);
                        }
                    }
                } else if (it.type === 'shelf') {
                    // 2026-06-17: 선반 — 흰색 fill + 빨강 테두리 (시각용 가벽 부착 선반).
                    ctx.fillStyle = it.fill || '#ffffff';
                    ctx.fillRect(it.x, it.y, it.w, it.h);
                    ctx.strokeStyle = it.stroke || '#dc2626';
                    ctx.lineWidth = it.strokeWidth || 2;
                    ctx.strokeRect(it.x, it.y, it.w, it.h);
                } else if (it.type === 'text') {
                    ctx.save();
                    var rotT = it.rotation || 0;
                    var fxT = it.flipX ? -1 : 1, fyT = it.flipY ? -1 : 1;
                    if (rotT || fxT !== 1 || fyT !== 1) {
                        var ccx = it.x + it.w/2;
                        var ccy = it.y + it.h/2;
                        ctx.translate(ccx, ccy);
                        if (rotT) ctx.rotate(rotT * Math.PI / 180);
                        if (fxT !== 1 || fyT !== 1) ctx.scale(fxT, fyT);
                        ctx.translate(-ccx, -ccy);
                    }
                    ctx.fillStyle = it.fill || '#1d1d1f';
                    var fs = it.fontSize || 24;
                    var ffRaw = it.fontFamily || 'sans-serif';
                    var ff = ffRaw;
                    if (!/["']/.test(ff) && /\s/.test(ff)) ff = '"' + ff + '"';
                    // 2026-06-14: 폰트 weight 를 실제 폰트가 지원하는 값으로 보정 (faux-bold 합성 방지)
                    //   _meResolveWeight 가 가까운 지원 weight 반환
                    var fwRaw = it.fontWeight || 400;
                    var fw = (typeof _meResolveWeight === 'function') ? _meResolveWeight(ffRaw, fwRaw) : fwRaw;
                    ctx.font = fw + ' ' + fs + 'px ' + ff;
                    // letterSpacing — 브라우저 지원 시 적용 (Canvas 2D, Chrome 99+)
                    try {
                        var ls = (it.letterSpacing || 0) + 'px';
                        ctx.letterSpacing = ls;
                    } catch(_le){}
                    ctx.textBaseline = 'top';
                    ctx.textAlign = it.textAlign || 'left';
                    // DOM padding 4px 6px 보정 (display px → natural px 역변환)
                    var padX = 6 / (me.wScale || 1);
                    var padY = 4 / (me.wScale || 1);
                    var tx = it.x + padX;
                    if (ctx.textAlign === 'center') tx = it.x + it.w/2;
                    else if (ctx.textAlign === 'right') tx = it.x + it.w - padX;
                    var ty = it.y + padY;
                    // 2026-06-17: 박스 폭 초과 시 자동 줄바꿈 (DOM 의 word-wrap 미러링).
                    //   canvas measureText 는 DOM 보다 보수적이라 같은 텍스트도 살짝 더 넓게 측정 → DOM 에 fit 됐는데
                    //   canvas 에선 wrap → 마지막 1글자 떨어짐. 15% 버퍼로 차이 흡수.
                    var lh = fs * (it.lineHeight || 1.2);
                    // 2026-06-18 v563: DOM 의 line-height 는 글자를 EM box 중앙 정렬 → 상단에 (lh-fs)/2 만큼 여백.
                    //   canvas textBaseline:'top' 은 EM box 의 top 부터 그림 → DOM 대비 위로 (lh-fs)/2 만큼 올라감.
                    //   보정: ty 에 (lh-fs)/2 더해서 DOM 과 같은 baseline 위치.
                    var leadingOffset = (lh - fs) / 2;
                    ty += leadingOffset;
                    // 2026-06-18 v570: DOM 의 실제 렌더된 줄을 그대로 사용 (canvas wrap 안 함).
                    //   Range 로 글자 단위 rect 추출 → top 좌표로 줄 그룹핑 → 100% DOM 일치.
                    var allLines = [];
                    try {
                        // 2026-06-25: 모든 텍스트 노드 수집 — 멀티라인(<br>로 분리)은 텍스트 노드가 여러 개이므로
                        //   기존처럼 '첫 번째 노드'만 읽으면 둘째 줄부터 export 에서 누락됨 (영문 주소 등 여러 줄 텍스트 사라짐).
                        var _textNodes = [];
                        (function _collectTextNodes(el){
                            for (var ci = 0; ci < el.childNodes.length; ci++) {
                                var cn = el.childNodes[ci];
                                if (cn.nodeType === 3 && cn.textContent.length > 0) _textNodes.push(cn);
                                else if (cn.nodeType === 1 && !(cn.classList && (cn.classList.contains('me-handle') || cn.classList.contains('me-del')))) _collectTextNodes(cn);
                            }
                        })(it.el);
                        // 2026-06-25: 줄 간격(top 점프)으로 빈 줄도 복원 — 주소/전화 사이 빈 줄(엔터 한 번 더)이
                        //   export 에서 사라지던 문제. dy/줄높이 ≈ 2 면 빈 줄 1개 삽입.
                        var _lineGapPx = Math.max(1, (it.fontSize || 24) * (it.lineHeight || 1.2) * (me.wScale || 1));
                        var _lastTop = -9999, _curLine = '', _started = false;
                        _textNodes.forEach(function(_tn){
                            var _full = _tn.textContent;
                            for (var _ci = 0; _ci < _full.length; _ci++) {
                                var _cr = document.createRange();
                                _cr.setStart(_tn, _ci); _cr.setEnd(_tn, _ci + 1);
                                var _crect = _cr.getBoundingClientRect();
                                if (!_started) { _lastTop = _crect.top; _curLine = _full[_ci]; _started = true; continue; }
                                var _dy = _crect.top - _lastTop;
                                if (_dy > _lineGapPx * 0.6) {
                                    allLines.push(_curLine);
                                    var _steps = Math.max(1, Math.round(_dy / _lineGapPx));
                                    for (var _k = 1; _k < _steps; _k++) allLines.push('');  // 빈 줄 채우기
                                    _curLine = _full[_ci];
                                    _lastTop = _crect.top;
                                } else {
                                    _curLine += _full[_ci];
                                }
                            }
                        });
                        if (_started) allLines.push(_curLine);
                    } catch(_mle) {
                        console.warn('[_meExportPNG] DOM line detection failed', _mle);
                    }
                    // 폴백: DOM 추출 실패 시 canvas wrap 사용
                    if (!allLines.length) {
                        var maxW = Math.max(1, it.w - 2 * padX) * 1.30;
                        var rawLines = (it.text || '').split(/\n/);
                        rawLines.forEach(function(rl){
                            var wrapped = _meWrapText(ctx, rl, maxW);
                            wrapped.forEach(function(w){ allLines.push(w); });
                        });
                    }
                    // 2026-06-28: 줄별 스티커 — 각 줄을 [흰 테두리 2W → fill → fill색 0.7W] 순으로, 위 줄부터 아래 줄로 그림.
                    //   아래 줄이 위 줄의 아래 테두리를 덮어 줄 사이 이중 테두리 제거.
                    var _ctsw = (it.textStrokeW || 0);
                    var _joinP = (it.textStrokeJoin === 'miter') ? 'miter' : 'round';
                    allLines.forEach(function(ln, idx) {
                        var _yy = ty + idx * lh;
                        if (_ctsw > 0) {
                            ctx.save();
                            ctx.lineWidth = 2 * _ctsw;
                            ctx.strokeStyle = it.textStroke || '#000000';
                            ctx.lineJoin = _joinP; ctx.miterLimit = (_joinP === 'miter') ? 6 : 2;
                            ctx.strokeText(ln, tx, _yy);
                            ctx.restore();
                        }
                        ctx.fillText(ln, tx, _yy);
                    });
                    ctx.restore();
                } else if (it.type === 'image' && it.src) {
                    var rotI = it.rotation || 0;
                    var fxI = it.flipX ? -1 : 1;
                    var fyI = it.flipY ? -1 : 1;
                    var ixx = it.x, iyy = it.y, iww = it.w, ihh = it.h;
                    // 2026-07-04: 원격 이미지 export 실패(빈 썸네일) 수정.
                    //   기존엔 crossOrigin='anonymous' 로만 로드 → Supabase/외부가 CORS 응답 안 하면 onerror → 이미지 누락(흰 배경만).
                    //   display 는 crossOrigin 없이 로드하므로 화면엔 보이는데 썸네일만 빈 현상. (김경희 매니저 사례)
                    //   해결: fetch→blob(object URL) 로 먼저 로드 → CORS 허용 시 untainted clean draw. 실패 시 crossOrigin→plain 폴백.
                    var _meDrawExportImg = function(im){
                        try {
                            var drawW = iww, drawH = ihh, drawX = ixx, drawY = iyy;
                            var needTransform = rotI || fxI !== 1 || fyI !== 1;
                            if (needTransform) {
                                ctx.save();
                                var iccx = ixx + iww/2, iccy = iyy + ihh/2;
                                ctx.translate(iccx, iccy);
                                if (rotI) ctx.rotate(rotI * Math.PI / 180);
                                if (fxI !== 1 || fyI !== 1) ctx.scale(fxI, fyI);
                                ctx.drawImage(im, drawX - iccx, drawY - iccy, drawW, drawH);
                                ctx.restore();
                            } else {
                                ctx.drawImage(im, drawX, drawY, drawW, drawH);
                            }
                        } catch(_de){ console.warn('[_meExportPNG] drawImage failed', _de); }
                    };
                    var _meLoadImg = function(src, useCO){
                        return new Promise(function(res){
                            var im = new Image();
                            if (useCO) im.crossOrigin = 'anonymous';
                            im.onload = function(){ res(im); };
                            im.onerror = function(){ res(null); };
                            im.src = src;
                        });
                    };
                    await (async function(){
                        var src = it.src;
                        // data:/blob: 는 same-origin — 바로 로드 (taint 없음)
                        if (/^(data:|blob:)/i.test(src)) {
                            var im0 = await _meLoadImg(src, false);
                            if (im0) _meDrawExportImg(im0);
                            else console.warn('[_meExportPNG] data/blob image load failed');
                            return;
                        }
                        // 원격: fetch→objectURL (CORS 허용 소스는 이걸로 untainted 하게 그려짐)
                        try {
                            var resp = await fetch(src, { mode: 'cors', credentials: 'omit' });
                            if (resp && resp.ok) {
                                var blob = await resp.blob();
                                var objUrl = URL.createObjectURL(blob);
                                var imF = await _meLoadImg(objUrl, false);
                                URL.revokeObjectURL(objUrl);
                                if (imF) { _meDrawExportImg(imF); return; }
                            }
                        } catch(_fe){ /* CORS/네트워크 실패 → 폴백 */ }
                        // 폴백1: crossOrigin Image (CORS 헤더 주는 소스)
                        var imC = await _meLoadImg(src, true);
                        if (imC) { _meDrawExportImg(imC); return; }
                        // 폴백2: crossOrigin 없이 (display 파리티 — 그려지되 canvas taint 가능 → toDataURL 에서 감지)
                        var imP = await _meLoadImg(src, false);
                        if (imP) _meDrawExportImg(imP);
                        else console.warn('[_meExportPNG] image load failed (will be missing from export)');
                    })();
                }
            }
            try {
                return c.toDataURL('image/png');
            } catch(_te) {
                console.warn('[_meExportPNG] canvas tainted, cannot export PNG', _te);
                return null;
            }
        } catch(e) {
            console.warn('[_meExportPNG]', e);
            return null;
        }
    };

    // 2026-06-19 v624: 텍스트 아웃라인 변환용 opentype.js + 폰트 캐시
    //   Google Font name → fontsource slug 매핑. fontsource (jsdelivr CDN) 가 WOFF 형식으로 미러링.
    //   opentype.js 가 WOFF 지원하므로 직접 파싱 가능 (WOFF2 디코더 불필요).
    var _meOpentypeLib = null;
    var _meFontCache = {};       // key = family+weight → opentype.Font
    var _meOutlineFailedFonts = {};  // key = family+weight → true (한 번 실패하면 재시도 X)
    var _meFontSourceSlug = {
        'Noto Sans KR': { slug: 'noto-sans-kr', subsets: ['korean','latin'] },
        'Nanum Gothic': { slug: 'nanum-gothic', subsets: ['korean','latin'] },
        'Nanum Myeongjo': { slug: 'nanum-myeongjo', subsets: ['korean','latin'] },
        'Black Han Sans': { slug: 'black-han-sans', subsets: ['korean','latin'] },
        'Nanum Pen Script': { slug: 'nanum-pen-script', subsets: ['korean','latin'] },
        'Do Hyeon': { slug: 'do-hyeon', subsets: ['korean','latin'] },
        'Jua': { slug: 'jua', subsets: ['korean','latin'] },
        'Single Day': { slug: 'single-day', subsets: ['korean','latin'] },
        'Gothic A1': { slug: 'gothic-a1', subsets: ['korean','latin'] },
        'Hi Melody': { slug: 'hi-melody', subsets: ['korean','latin'] },
        'Gamja Flower': { slug: 'gamja-flower', subsets: ['korean','latin'] },
        'Cute Font': { slug: 'cute-font', subsets: ['korean','latin'] },
        'East Sea Dokdo': { slug: 'east-sea-dokdo', subsets: ['korean','latin'] },
        'Gaegu': { slug: 'gaegu', subsets: ['korean','latin'] },
        'Black And White Picture': { slug: 'black-and-white-picture', subsets: ['korean','latin'] },
        'Song Myung': { slug: 'song-myung', subsets: ['korean','latin'] },
        'Stylish': { slug: 'stylish', subsets: ['korean','latin'] },
        'Poor Story': { slug: 'poor-story', subsets: ['korean','latin'] },
        'Yeon Sung': { slug: 'yeon-sung', subsets: ['korean','latin'] },
        'Gowun Dodum': { slug: 'gowun-dodum', subsets: ['korean','latin'] },
        'Gowun Batang': { slug: 'gowun-batang', subsets: ['korean','latin'] },
        'Nanum Brush Script': { slug: 'nanum-brush-script', subsets: ['korean','latin'] },
        'IBM Plex Sans KR': { slug: 'ibm-plex-sans-kr', subsets: ['korean','latin'] },
        'Noto Serif KR': { slug: 'noto-serif-kr', subsets: ['korean','latin'] },
        'Sunflower': { slug: 'sunflower', subsets: ['korean','latin'] },
        'Dongle': { slug: 'dongle', subsets: ['korean','latin'] },
        'Hahmlet': { slug: 'hahmlet', subsets: ['korean','latin'] },
        'Gugi': { slug: 'gugi', subsets: ['korean','latin'] },
        'Dokdo': { slug: 'dokdo', subsets: ['korean','latin'] },
        'Kirang Haerang': { slug: 'kirang-haerang', subsets: ['korean','latin'] },
        'Gasoek One': { slug: 'gasoek-one', subsets: ['korean','latin'] },
        'Bagel Fat One': { slug: 'bagel-fat-one', subsets: ['korean','latin'] },
        'Orbit': { slug: 'orbit', subsets: ['korean','latin'] },
        'Jeju Myeongjo': { slug: 'jeju-myeongjo', subsets: ['korean','latin'] },
        'Jeju Gothic': { slug: 'jeju-gothic', subsets: ['korean','latin'] },
        'Jeju Hallasan': { slug: 'jeju-hallasan', subsets: ['korean','latin'] }
    };
    async function _meLoadOpentype() {
        if (_meOpentypeLib) return _meOpentypeLib;
        if (window.opentype) { _meOpentypeLib = window.opentype; return _meOpentypeLib; }
        await new Promise(function(res, rej){
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js';
            s.onload = res;
            s.onerror = function(){ rej(new Error('opentype.js load failed')); };
            document.head.appendChild(s);
        });
        _meOpentypeLib = window.opentype;
        return _meOpentypeLib;
    }
    async function _meLoadFontForOutline(family, weight) {
        var clean = String(family || '').replace(/["']/g, '').trim();
        // 시스템 폰트(generic)는 아웃라인 대상 아님
        if (!clean || clean === 'sans-serif' || clean === 'serif' || clean === 'monospace' || clean === 'cursive') return null;
        var w = String(weight || 400);
        var key = clean + '|' + w;
        if (_meFontCache[key]) return _meFontCache[key];
        if (_meOutlineFailedFonts[key]) return null;
        var info = _meFontSourceSlug[clean];
        var slug, subsets, weights;
        if (info) {
            slug = info.slug; subsets = info.subsets; weights = info.weights || [400, 700, 900];
        } else {
            // 2026-06-25: 맵에 없는 폰트(영문 스크립트/세리프 등)도 이름→fontsource 슬러그 추정으로 아웃라인 시도.
            //   (이전엔 맵에 없으면 즉시 실패 → 라이브 텍스트로 들어가 인쇄 시 폰트 치환 위험)
            slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            subsets = ['latin'];
            weights = [400, 700, 900];
            if (!slug) { _meOutlineFailedFonts[key] = true; return null; }
        }
        try { await _meLoadOpentype(); } catch(_loe){ _meOutlineFailedFonts[key] = true; return null; }
        var aw = parseInt(w, 10) || 400;
        var bestW = weights.reduce(function(a, b){ return Math.abs(b - aw) < Math.abs(a - aw) ? b : a; }, weights[0]);
        // 요청 weight 우선, 없으면 흔한 weight 들로 폴백 (fontsource 파일이 weight 별로 존재)
        var weightsToTry = [bestW];
        [400, 700, 500, 600, 900, 300, 800].forEach(function(x){ if (weightsToTry.indexOf(x) < 0) weightsToTry.push(x); });
        for (var si = 0; si < subsets.length; si++) {
            for (var wi = 0; wi < weightsToTry.length; wi++) {
                var url = 'https://cdn.jsdelivr.net/fontsource/fonts/' + slug + '@latest/' + subsets[si] + '-' + weightsToTry[wi] + '-normal.woff';
                try {
                    var resp = await fetch(url, { cache: 'force-cache' });
                    if (!resp.ok) continue;
                    var buf = await resp.arrayBuffer();
                    var font = _meOpentypeLib.parse(buf);
                    _meFontCache[key] = font;
                    console.log('[outline] loaded font', clean, weightsToTry[wi], 'subset:', subsets[si], 'glyphs:', font.numGlyphs);
                    return font;
                } catch(_fe){ continue; }
            }
        }
        _meOutlineFailedFonts[key] = true;
        return null;
    }

    // 2026-06-28: 아웃라인 불가 폰트(스크립트체 등) — 그 텍스트 한 객체만 캔버스(브라우저 웹폰트)로 PNG 래스터화.
    //   svg2pdf 의 <text> 폴백은 웹폰트 없이 + paint-order 무시로 앞글씨가 사라지고 테두리만 남으므로 대체.
    //   메인 PNG export 와 동일한 baseline(top + (lh-fs)/2) 으로 화면과 일치. 줄별로 [테두리→fill] 그려 아래 줄이 위 줄 덮음.
    function _meTextItemToPng(it, lines) {
        try {
            if (!it || it.type !== 'text') return null;
            var fs = it.fontSize || 24;
            var ffRaw = it.fontFamily || 'sans-serif';
            var ff = ffRaw; if (!/["']/.test(ff) && /\s/.test(ff)) ff = '"' + ff + '"';
            var fwRaw = it.fontWeight || 400;
            var fw = (typeof _meResolveWeight === 'function') ? _meResolveWeight(ffRaw, fwRaw) : fwRaw;
            var lh = fs * (it.lineHeight || 1.2);
            if (!lines || !lines.length) lines = String(it.text || (it.el && it.el.textContent) || '').split(/\r?\n/);
            var _ctsw = it.textStrokeW || 0;
            var joinP = (it.textStrokeJoin === 'miter') ? 'miter' : 'round';
            // 스크립트체는 글자가 박스(it.w)를 크게 넘침 → 캔버스 좌표(natural)에 그대로 그린 뒤 실제 잉크 영역(알파 bbox)을
            //   측정해 그만큼만 크롭. 위치/넘침/회전(바깥 <g>가 처리) 모두 정확.
            var MARG = Math.ceil(fs * 2 + _ctsw * 4);   // 캔버스 밖으로 넘치는 swash 여유
            var S = 3;
            var fullW = (me.natW || 1000) + 2 * MARG, fullH = (me.natH || 1000) + 2 * MARG;
            if (Math.max(fullW, fullH) * S > 6000) S = 6000 / Math.max(fullW, fullH);
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(fullW * S)); cv.height = Math.max(1, Math.round(fullH * S));
            var c = cv.getContext('2d');
            c.scale(S, S); c.translate(MARG, MARG);   // natural (0,0) → 캔버스 (MARG,MARG)
            c.font = fw + ' ' + fs + 'px ' + ff;
            try { c.letterSpacing = (it.letterSpacing || 0) + 'px'; } catch(_le){}
            c.textBaseline = 'top';
            c.textAlign = (it.textAlign === 'center') ? 'center' : (it.textAlign === 'right') ? 'right' : 'left';
            var padX = 6 / (me.wScale || 1), padY = 4 / (me.wScale || 1);
            // 콘텐츠(가장 넓은 줄 advance) 기준 정렬 — it.w 가 폰트 변경 등으로 실제 글씨폭과 달라도 화면(DOM max-content)과 일치.
            //   (이탤릭/스크립트체에서 it.w 가 옛 폰트 기준이라 중앙이 우측으로 밀리던 문제 보정.)
            var _widestW = 0;
            lines.forEach(function(ln){ var _dl = String(ln).replace(/\s+$/, ''); if (!_dl) return; var _mw = c.measureText(_dl).width; if (_mw > _widestW) _widestW = _mw; });
            var tx;
            if (c.textAlign === 'center') tx = it.x + padX + _widestW / 2;
            else if (c.textAlign === 'right') tx = it.x + padX + _widestW;
            else tx = it.x + padX;
            var ty = it.y + padY + (lh - fs) / 2;   // 메인 PNG export 와 동일 baseline → 화면과 일치
            lines.forEach(function(ln, idx){
                var yy = ty + idx * lh;
                var dln = String(ln).replace(/\s+$/, '');
                if (!dln) return;
                if (_ctsw > 0) {
                    c.save();
                    c.lineWidth = 2 * _ctsw; c.strokeStyle = it.textStroke || '#000000';
                    c.lineJoin = joinP; c.miterLimit = (joinP === 'miter') ? 6 : 2;
                    c.strokeText(dln, tx, yy);
                    c.restore();
                }
                c.fillStyle = it.fill || '#1d1d1f';
                c.fillText(dln, tx, yy);
            });
            // 실제 잉크 영역(알파>8) bbox 측정
            var data = c.getImageData(0, 0, cv.width, cv.height).data;
            var W = cv.width, H = cv.height;
            var minX = W, minY = H, maxX = -1, maxY = -1;
            for (var y = 0; y < H; y++) {
                var row = y * W;
                for (var x = 0; x < W; x++) {
                    if (data[(row + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
                }
            }
            if (maxX < 0) return null;
            var cwid = maxX - minX + 1, chei = maxY - minY + 1;
            var crop = document.createElement('canvas');
            crop.width = cwid; crop.height = chei;
            crop.getContext('2d').drawImage(cv, minX, minY, cwid, chei, 0, 0, cwid, chei);
            // 크롭 픽셀(minX,minY) → natural 좌표
            return { dataUrl: crop.toDataURL('image/png'), x: minX / S - MARG, y: minY / S - MARG, w: cwid / S, h: chei / S };
        } catch(e) { console.warn('[_meTextItemToPng]', e); return null; }
    }

    // 2026-06-26: 텍스트 박스 폭으로 줄바꿈된(엔터 없이 wrap 된) 실제 렌더 줄을 DOM 에서 추출.
    //   PNG export(_meExportPNG) 와 동일한 Range top 점프 감지 → SVG/PDF 도 화면과 동일하게 줄바꿈.
    //   (이전엔 SVG export 가 하드 엔터(\n)만 split 해서, 박스폭 wrap 된 글씨가 PDF 에서 한 줄로 죽 나열됨.)
    function _meGetVisualLines(it) {
        var lines = [];
        try {
            if (!it || !it.el) return lines;
            var textNodes = [];
            (function collect(el){
                for (var ci = 0; ci < el.childNodes.length; ci++) {
                    var cn = el.childNodes[ci];
                    if (cn.nodeType === 3 && cn.textContent.length > 0) textNodes.push(cn);
                    else if (cn.nodeType === 1 && !(cn.classList && (cn.classList.contains('me-handle') || cn.classList.contains('me-del')))) collect(cn);
                }
            })(it.el);
            var lineGapPx = Math.max(1, (it.fontSize || 24) * (it.lineHeight || 1.2) * (me.wScale || 1));
            var lastTop = -9999, curLine = '', started = false;
            textNodes.forEach(function(tn){
                var full = tn.textContent;
                for (var ci = 0; ci < full.length; ci++) {
                    var cr = document.createRange();
                    cr.setStart(tn, ci); cr.setEnd(tn, ci + 1);
                    var crect = cr.getBoundingClientRect();
                    if (!started) { lastTop = crect.top; curLine = full[ci]; started = true; continue; }
                    var dy = crect.top - lastTop;
                    if (dy > lineGapPx * 0.6) {
                        lines.push(curLine);
                        var steps = Math.max(1, Math.round(dy / lineGapPx));
                        for (var k = 1; k < steps; k++) lines.push('');
                        curLine = full[ci];
                        lastTop = crect.top;
                    } else {
                        curLine += full[ci];
                    }
                }
            });
            if (started) lines.push(curLine);
        } catch(e) { console.warn('[_meGetVisualLines]', e); return []; }
        return lines;
    }

    // 2026-06-19 v623: 미니에디터를 SVG 텍스트로 직렬화 (벡터 보존 — 템플릿 주문 시 관리자 페이지 첨부용)
    //   문자열 반환. text/image/shape 모두 처리. zIndex 순으로 정렬해서 같은 stacking 유지.
    // 2026-06-19 v624: outline:true 옵션 — 모든 텍스트를 opentype.js 로 벡터 path 변환 (폰트 무관 동일 표시).
    window._meExportSVG = async function(opts) {
        var outline = !!(opts && opts.outline);
        // 2026-06-27: PDF(svg2pdf) 는 <image> 안의 SVG 를 못 그림 → 이미지를 PNG 로 래스터화해 넣어야 프레임이 PDF 에 보임.
        var rasterize = !!(opts && opts.rasterizeImages);
        // 2026-07-06: SVG 자산을 벡터 인라인하지 않고 강제 래스터 (단계적 폴백 2단계용).
        //   특정 디자이너 SVG 가 svg2pdf 를 throw 시켜 전체 디자인이 PNG 로 떨어지는 것을 막고,
        //   그 SVG 만 래스터·나머지(텍스트/도형/배경)는 벡터로 유지하기 위함.
        var forceRasterSvg = !!(opts && opts.forceRasterSvg);
        try {
            if (!me || !me.natW || !me.natH) return null;
            // contenteditable 강제 sync + v630: _meGetCleanText 사용 (× 제외)
            try {
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                me.items.forEach(function(it){
                    if (it && it.type === 'text' && it.el) {
                        // 2026-06-25: 빈값이면 기존 it.text 보존 (DOM 재읽기 실패로 텍스트 사라지는 것 방지)
                        var _ct = _meGetCleanText(it.el);
                        if (_ct) it.text = _ct;
                    }
                });
            } catch(_){}

            function _esc(s) {
                return String(s == null ? '' : s)
                    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
            }
            function _fmt(n) {
                if (!isFinite(n)) return '0';
                return (Math.round(n * 100) / 100).toString();
            }
            // base64 → data URL (외부 이미지 embedding) — image src 가 cross-origin 일 수도 있어 fetch + blob → dataURL
            async function _imgToDataUrl(src) {
                if (!src) return null;
                if (/^data:/i.test(src)) return src;
                try {
                    var resp = await fetch(src, { mode: 'cors' });
                    if (!resp.ok) return src; // fallback 원 URL
                    var blob = await resp.blob();
                    return await new Promise(function(res, rej){
                        var fr = new FileReader();
                        fr.onload = function(){ res(fr.result); };
                        fr.onerror = function(){ res(src); };
                        fr.readAsDataURL(blob);
                    });
                } catch(_){ return src; }
            }
            // 2026-06-27: 이미지(특히 SVG) 를 PNG dataURL 로 래스터화 — svg2pdf 가 SVG-in-image 를 못 그리는 문제 해결.
            //   dataURL 을 Image 로 로드 후 canvas 에 그려 PNG 추출 (dataURL 이라 canvas taint 없음).
            function _imgToPng(srcDataUrl, boxW, boxH) {
                return new Promise(function(resolve){
                    try {
                        var img = new Image();
                        img.onload = function(){
                            try {
                                var scale = 3;
                                var bw = boxW || img.naturalWidth || 300;
                                var bh = boxH || img.naturalHeight || 300;
                                var cw = Math.max(1, Math.round(bw * scale));
                                var ch = Math.max(1, Math.round(bh * scale));
                                var MAXPX = 4000;
                                if (cw > MAXPX || ch > MAXPX) { var r = MAXPX / Math.max(cw, ch); cw = Math.max(1, Math.round(cw * r)); ch = Math.max(1, Math.round(ch * r)); }
                                var c = document.createElement('canvas'); c.width = cw; c.height = ch;
                                var cx = c.getContext('2d');
                                cx.drawImage(img, 0, 0, cw, ch);
                                resolve(c.toDataURL('image/png'));
                            } catch(e){ console.warn('[_imgToPng draw]', e); resolve(null); }
                        };
                        img.onerror = function(){ resolve(null); };
                        img.src = srcDataUrl;
                    } catch(e){ resolve(null); }
                });
            }
            // 2026-06-27: 이미지가 SVG 면 원본 SVG 텍스트를 얻음 (dataURL base64 디코드 또는 URL fetch).
            async function _resolveSvgText(origSrc, dataUrl) {
                try {
                    var s = dataUrl || '';
                    if (/^data:image\/svg\+xml;base64,/i.test(s)) {
                        return decodeURIComponent(escape(atob(s.split(',')[1])));
                    }
                    if (/^data:image\/svg\+xml/i.test(s)) {
                        return decodeURIComponent(s.substring(s.indexOf(',') + 1));
                    }
                    if (/\.svg(\?|$)/i.test(String(origSrc || ''))) {
                        var r = await fetch(origSrc, { mode: 'cors' });
                        if (r.ok) return await r.text();
                    }
                } catch(e) { console.warn('[_resolveSvgText]', e); }
                return null;
            }
            // 2026-06-27: SVG 텍스트를 export SVG 안에 nested <svg>(벡터)로 넣기 — svg2pdf 가 벡터로 출력.
            function _buildNestedSvg(svgText, x, y, w, h) {
                try {
                    var pr = new DOMParser();
                    var d = pr.parseFromString(svgText, 'image/svg+xml');
                    if (d.getElementsByTagName('parsererror').length) return null;
                    var sv = d.documentElement;
                    if (!sv || sv.nodeName.toLowerCase() !== 'svg') return null;
                    var vb = sv.getAttribute('viewBox');
                    if (!vb) {
                        var vw = parseFloat(sv.getAttribute('width')) || 0, vh = parseFloat(sv.getAttribute('height')) || 0;
                        if (vw && vh) vb = '0 0 ' + vw + ' ' + vh;
                    }
                    var inner = sv.innerHTML;
                    if (!inner || !inner.trim()) return null;
                    return '<svg x="' + _fmt(x) + '" y="' + _fmt(y) + '" width="' + _fmt(w) + '" height="' + _fmt(h) + '"'
                        + (vb ? ' viewBox="' + _esc(vb) + '"' : '')
                        + ' preserveAspectRatio="none" overflow="visible">' + inner + '</svg>';
                } catch(e) { console.warn('[_buildNestedSvg]', e); return null; }
            }
            // 2026-06-28: SVG 를 export 안에 <g transform>(평탄화 벡터)로 인라인 — 대형 출력 픽셀화 방지.
            //   nested <svg> 는 svg2pdf 가 위치/스케일을 틀리게 그리고, 분리된 조각마다 같은 defs/gradient/clip ID 가
            //   충돌해 색이 빠짐 → ID 를 조각별 고유 접두어로 네임스페이스하고 viewBox→박스 transform 으로 평탄화.
            function _buildInlineSvgGroup(svgText, x, y, w, h, uid) {
                var holder = null;
                try {
                    // 2026-07-06: clipPath 는 벡터 인라인 허용 (svg2pdf 2.2.4 지원, ID 네임스페이싱으로 충돌 방지).
                    //   대형 출력(허니콤보드 등)에서 라이브러리/업로드 SVG 가 래스터(저 PPI)로 나오던 문제 해결 — 벡터 유지.
                    //   mask/filter/pattern 은 svg2pdf 가 여전히 못 그려 깨지므로 래스터 폴백(null 반환) 유지.
                    if (/<\s*mask\b|[^-]mask\s*[:=]|<\s*filter\b|[^-]filter\s*[:=]|<\s*pattern\b/i.test(svgText || '')) return null;
                    var pr = new DOMParser();
                    var d = pr.parseFromString(svgText, 'image/svg+xml');
                    if (d.getElementsByTagName('parsererror').length) return null;
                    var sv = d.documentElement;
                    if (!sv || sv.nodeName.toLowerCase() !== 'svg') return null;
                    var vx = 0, vy = 0, vw = 0, vh = 0;
                    var vb = sv.getAttribute('viewBox');
                    if (vb) { var p = vb.trim().split(/[\s,]+/).map(parseFloat); vx = p[0] || 0; vy = p[1] || 0; vw = p[2] || 0; vh = p[3] || 0; }
                    if (!vw) vw = parseFloat(sv.getAttribute('width')) || 0;
                    if (!vh) vh = parseFloat(sv.getAttribute('height')) || 0;
                    if (!vw || !vh) return null;
                    // 1) computed style 을 attribute 로 구움 — svg2pdf 는 <style>/class 기반 fill 을 못 읽어 색이 빠짐.
                    //    라이브 DOM 에 붙여서 브라우저가 해석한 실제 색을 inline 으로 박는다.
                    holder = document.createElement('div');
                    holder.setAttribute('style', 'position:absolute; left:-99999px; top:0; width:0; height:0; overflow:hidden; opacity:0; pointer-events:none;');
                    var liveSvg = document.importNode(sv, true);
                    holder.appendChild(liveSvg);
                    document.body.appendChild(holder);
                    // 2026-07-06: svg2pdf 안전 — 비렌더/사유 네임스페이스 요소 제거 (Illustrator <i:pgf>, Inkscape sodipodi/inkscape,
                    //   metadata/script/foreignObject/title/desc). 스톡 SVG 에 흔하며 svg2pdf 를 throw 시켜 전체 디자인이 PNG 로 떨어지게 함.
                    try {
                        var _junk = [];
                        var _allEl = liveSvg.getElementsByTagName('*');
                        for (var _ji = 0; _ji < _allEl.length; _ji++) {
                            var _jtn = (_allEl[_ji].tagName || '').toLowerCase();
                            var _jlocal = _jtn.indexOf(':') >= 0 ? _jtn.split(':').pop() : _jtn;
                            if (_jtn.indexOf(':') >= 0 || _jlocal === 'metadata' || _jlocal === 'script' || _jlocal === 'foreignobject' || _jlocal === 'title' || _jlocal === 'desc') {
                                _junk.push(_allEl[_ji]);
                            }
                        }
                        _junk.forEach(function(n){ try { n.parentNode && n.parentNode.removeChild(n); } catch(_){} });
                    } catch(_jke){}
                    var SP = ['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity'];
                    var nodes = liveSvg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line,text,tspan,g,use');
                    for (var ni = 0; ni < nodes.length; ni++) {
                        var el = nodes[ni];
                        var cs = window.getComputedStyle(el);
                        for (var si = 0; si < SP.length; si++) {
                            var v = cs.getPropertyValue(SP[si]);
                            if (v && v !== '' && v !== 'normal') el.setAttribute(SP[si], v.trim());
                        }
                        el.removeAttribute('style');
                        el.removeAttribute('class');
                    }
                    var styEls = liveSvg.querySelectorAll('style');
                    for (var sti = 0; sti < styEls.length; sti++) styEls[sti].parentNode && styEls[sti].parentNode.removeChild(styEls[sti]);
                    var inner = liveSvg.innerHTML;
                    document.body.removeChild(holder); holder = null;
                    if (!inner || !inner.trim()) return null;
                    // 2) ID 네임스페이스 — 조각 간 defs/gradient/clip ID 충돌 방지 (id="x" / url(#x) / url("#x") / href="#x")
                    var prefix = 'sv' + uid + '_';
                    var ids = [];
                    inner.replace(/\bid\s*=\s*"([^"]+)"/g, function(m, id){ if (ids.indexOf(id) < 0) ids.push(id); return m; });
                    ids.forEach(function(id){
                        var safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        inner = inner.replace(new RegExp('id\\s*=\\s*"' + safe + '"', 'g'), 'id="' + prefix + id + '"');
                        inner = inner.replace(new RegExp('url\\(\\s*["\\\']?#' + safe + '["\\\']?\\s*\\)', 'g'), 'url(#' + prefix + id + ')');
                        inner = inner.replace(new RegExp('(xlink:href|href)\\s*=\\s*"#' + safe + '"', 'g'), '$1="#' + prefix + id + '"');
                    });
                    var scX = w / vw, scY = h / vh;
                    var tr = 'translate(' + _fmt(x) + ' ' + _fmt(y) + ') scale(' + _fmt(scX) + ' ' + _fmt(scY) + ')';
                    if (vx || vy) tr += ' translate(' + _fmt(-vx) + ' ' + _fmt(-vy) + ')';
                    return '<g transform="' + tr + '">' + inner + '</g>';
                } catch(e) {
                    console.warn('[_buildInlineSvgGroup]', e);
                    try { if (holder && holder.parentNode) holder.parentNode.removeChild(holder); } catch(_h){}
                    return null;
                }
            }

            // zIndex 정렬
            var items = (me.items || []).slice().sort(function(a, b){
                var az = parseInt((a.el && a.el.style.zIndex) || 0, 10);
                var bz = parseInt((b.el && b.el.style.zIndex) || 0, 10);
                return az - bz;
            });

            var parts = [];
            parts.push('<?xml version="1.0" encoding="UTF-8"?>');
            parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                + 'viewBox="0 0 ' + _fmt(me.natW) + ' ' + _fmt(me.natH) + '" '
                + 'width="' + _fmt(me.natW) + '" height="' + _fmt(me.natH) + '">');
            // 배경
            var bg = (me.bg || '#ffffff');
            parts.push('<rect x="0" y="0" width="' + _fmt(me.natW) + '" height="' + _fmt(me.natH) + '" fill="' + _esc(bg) + '"/>');

            for (var ii = 0; ii < items.length; ii++) {
                var it = items[ii];
                if (!it || !it.type) continue;
                var rot = it.rotation || 0;
                var sx = it.flipX ? -1 : 1, sy = it.flipY ? -1 : 1;
                var cx = (it.x || 0) + (it.w || 0) / 2;
                var cy = (it.y || 0) + (it.h || 0) / 2;
                var gTrans = '';
                if (rot) gTrans += 'rotate(' + _fmt(rot) + ' ' + _fmt(cx) + ' ' + _fmt(cy) + ') ';
                if (sx !== 1 || sy !== 1) gTrans += 'translate(' + _fmt(cx) + ' ' + _fmt(cy) + ') scale(' + sx + ' ' + sy + ') translate(' + _fmt(-cx) + ' ' + _fmt(-cy) + ')';
                if (gTrans) parts.push('<g transform="' + gTrans.trim() + '">');

                if (it.type === 'image' && it.src) {
                    var dataUrl = await _imgToDataUrl(it.src);
                    var _isSvgImg = /^data:image\/svg\+xml/i.test(dataUrl || '') || /\.svg(\?|$)/i.test(String(it.src));
                    var _imgEmitted = false;
                    // 2026-06-28: PDF(svg2pdf)는 <image> 속 SVG 를 못 그림. 대형 출력은 벡터여야 하므로
                    //   SVG 를 <g transform>(ID 네임스페이스 평탄화)로 벡터 인라인 시도 → 실패 시에만 PNG 래스터화 폴백.
                    if (rasterize && _isSvgImg) {
                        if (!forceRasterSvg) {
                            try {
                                var _svgTxt2 = await _resolveSvgText(it.src, dataUrl);
                                var _grp = _svgTxt2 ? _buildInlineSvgGroup(_svgTxt2, it.x, it.y, it.w, it.h, ii) : null;
                                if (_grp) { parts.push(_grp); _imgEmitted = true; }
                            } catch(_se) { console.warn('[svg vector inline]', _se); }
                        }
                        if (!_imgEmitted && dataUrl) {
                            var _png = await _imgToPng(dataUrl, it.w, it.h);
                            if (_png) dataUrl = _png;
                        }
                    }
                    if (!_imgEmitted) {
                        parts.push('<image href="' + _esc(dataUrl || it.src) + '" '
                            + 'x="' + _fmt(it.x) + '" y="' + _fmt(it.y) + '" '
                            + 'width="' + _fmt(it.w) + '" height="' + _fmt(it.h) + '" '
                            + 'preserveAspectRatio="none"/>');
                    }
                } else if (it.type === 'shape') {
                    var fill = _esc(it.fill || '#000000');
                    var stroke = it.stroke ? ' stroke="' + _esc(it.stroke) + '" stroke-width="' + _fmt(it.strokeWidth || 1) + '"' : '';
                    if (it.shape === 'circle') {
                        parts.push('<ellipse cx="' + _fmt(it.x + it.w/2) + '" cy="' + _fmt(it.y + it.h/2) + '" '
                            + 'rx="' + _fmt(it.w/2) + '" ry="' + _fmt(it.h/2) + '" fill="' + fill + '"' + stroke + '/>');
                    } else {
                        parts.push('<rect x="' + _fmt(it.x) + '" y="' + _fmt(it.y) + '" '
                            + 'width="' + _fmt(it.w) + '" height="' + _fmt(it.h) + '" fill="' + fill + '"' + stroke + '/>');
                    }
                } else if (it.type === 'text') {
                    var text = it.text || (it.el && it.el.textContent) || '';
                    // 박스폭 wrap 포함 실제 렌더 줄 사용 (화면과 동일). 실패 시 하드 엔터만 split.
                    var lines = _meGetVisualLines(it);
                    if (!lines.length) lines = String(text).split(/\r?\n/);
                    var fs = it.fontSize || 24;
                    var fam = _esc(String(it.fontFamily || 'sans-serif').replace(/["']/g, ''));
                    var famClean = String(it.fontFamily || 'sans-serif').replace(/["']/g, '');
                    var fw = it.fontWeight || 400;
                    var ls = (it.letterSpacing || 0);
                    var lh = fs * (it.lineHeight || 1.2);
                    var align = it.textAlign || 'left';
                    var anchor = (align === 'center') ? 'middle' : (align === 'right') ? 'end' : 'start';
                    // 텍스트 좌표 — anchor 기준
                    var tx = it.x;
                    if (anchor === 'middle') tx = it.x + (it.w || 0) / 2;
                    else if (anchor === 'end') tx = it.x + (it.w || 0);
                    var ty0 = it.y + fs;  // 첫 줄 baseline (대략 fontSize 만큼 내려)
                    // v624: outline 모드 — opentype.js 로 글자 → SVG path data 변환
                    var outlinedOk = false;
                    // 2026-06-28: 테두리 있는 글씨는 PDF 에서 캔버스 래스터(round join 정상)로 — svg2pdf 가 stroke-linejoin=round 를
                    //   무시하고 miter 로 그려 뾰족한 서체(블랙앤화이트 등)가 삐쭉해지는 문제. (테두리 없는 글씨는 벡터 유지)
                    if (rasterize && (it.textStrokeW || 0) > 0) {
                        try {
                            var _stPng = _meTextItemToPng(it, lines);
                            if (_stPng && _stPng.dataUrl) {
                                parts.push('<image href="' + _esc(_stPng.dataUrl) + '" x="' + _fmt(_stPng.x) + '" y="' + _fmt(_stPng.y) + '" width="' + _fmt(_stPng.w) + '" height="' + _fmt(_stPng.h) + '" preserveAspectRatio="none"/>');
                                outlinedOk = true;
                            }
                        } catch (_ste) { console.warn('[stroked text raster]', _ste); }
                    }
                    if (!outlinedOk && outline) {
                        try {
                            var fontObj = await _meLoadFontForOutline(famClean, fw);
                            if (fontObj) {
                                // 2026-06-28: 폰트 메트릭 기반 첫 줄 baseline — 줄간격(lineHeight) 반영.
                                //   기존 it.y+fs 고정은 좁은 줄간격(0.8 등)에서 글자가 아래로 내려가 아래 글씨에 붙던 문제.
                                //   CSS first-baseline = top + (lineHeight*fs - (asc+desc)*fs)/2 + asc*fs.
                                var _upm = fontObj.unitsPerEm || 1000;
                                var _ascR = (fontObj.ascender != null ? fontObj.ascender : _upm) / _upm;
                                var _descR = Math.abs(fontObj.descender || 0) / _upm;
                                var _lhMul = (it.lineHeight || 1.2);
                                var ty0m = it.y + (_lhMul * fs - (_ascR + _descR) * fs) / 2 + _ascR * fs;
                                // 2026-06-28: 중앙/우측 정렬 — it.w(박스폭) 대신 실제 콘텐츠 폭(가장 넓은 줄) 기준.
                                //   흘림/이텔릭체는 글씨폭이 박스보다 좁아 it.w/2 로 잡으면 우측으로 밀림(화면=콘텐츠 기준).
                                // 2026-07-02: 서체별 가로 어긋남 근본 해결 — opentype advance 대신 브라우저(canvas measureText)
                                //   좌표로 글자/단어를 배치. 화면(브라우저 렌더)과 동일 위치에 opentype 글리프 shape 만 그림 →
                                //   이탤릭/스크립트(예: Yellowtail — opentype advance 가 브라우저보다 커서 좌측 치우치던 것)도 화면과 일치.
                                var _mctx = (window.__meMeasureCtx || (window.__meMeasureCtx = document.createElement('canvas').getContext('2d')));
                                var _ffm = famClean; if (/\s/.test(_ffm) && !/["']/.test(_ffm)) _ffm = '"' + _ffm + '"';
                                _mctx.font = fw + ' ' + fs + 'px ' + _ffm;
                                _mctx.textAlign = 'left'; _mctx.textBaseline = 'alphabetic';
                                try { _mctx.letterSpacing = (ls || 0) + 'px'; } catch(_lse){}
                                // 콘텐츠(가장 넓은 줄) 폭 — 브라우저 기준 (화면=콘텐츠 기준 정렬과 동일)
                                var _widestW = 0;
                                for (var _wi = 0; _wi < lines.length; _wi++) {
                                    var _dlw = String(lines[_wi]).replace(/\s+$/, '');
                                    if (!_dlw) continue;
                                    var _lww = _mctx.measureText(_dlw).width;
                                    if (_lww > _widestW) _widestW = _lww;
                                }
                                var _padXo = 6 / (me.wScale || 1);
                                var _baseLeft = it.x + _padXo;
                                // 2026-07-02: 화면 텍스트 요소의 실제 content-box(좌/우)를 DOM 에서 직접 측정 →
                                //   박스폭 고정(리사이즈) / max-content / 패딩 무관하게 화면 정렬과 정확히 일치.
                                //   (콘텐츠 중앙만 쓰면 넓은 박스에서 좌측 치우침 발생 → 실측으로 해결)
                                var _contentLeft, _contentRight, _measuredBox = false;
                                try {
                                    if (it.el && it.el.offsetWidth > 0) {
                                        var _wS = me.wScale || 1;
                                        var _cs = window.getComputedStyle(it.el);
                                        var _plN = (parseFloat(_cs.paddingLeft) || 0) / _wS;
                                        var _prN = (parseFloat(_cs.paddingRight) || 0) / _wS;
                                        var _blN = (parseFloat(_cs.borderLeftWidth) || 0) / _wS;
                                        var _brN = (parseFloat(_cs.borderRightWidth) || 0) / _wS;
                                        // it.x = 요소 border-box 좌측(natural). offsetWidth = border-box 폭(display).
                                        _contentLeft = it.x + _blN + _plN;
                                        _contentRight = it.x + it.el.offsetWidth / _wS - _brN - _prN;
                                        _measuredBox = true;
                                    }
                                } catch (_be) {}
                                if (!_measuredBox) {
                                    _contentLeft = _baseLeft;
                                    _contentRight = it._edgeResized ? (it.x + (it.w || 0) - _padXo) : (_baseLeft + _widestW);
                                }
                                var _centerX = (_contentLeft + _contentRight) / 2;
                                var pathD = '';
                                var linePaths = [];   // 줄별 [글자 path...] — 줄을 각각 스티커로 그려 아래 줄이 위 줄 위에 겹치게.
                                for (var li = 0; li < lines.length; li++) {
                                    // 2026-06-28: 줄 끝 공백 제거 — 브라우저는 줄 끝 공백을 hang 시켜 폭에서 제외.
                                    var dline = String(lines[li]).replace(/\s+$/, '');
                                    if (!dline) continue;
                                    var _lineGlyphs = [];
                                    // 줄 폭(브라우저) → anchor 별 시작 x. opentype advance 는 정렬에 안 씀 (서체 어긋남 원인).
                                    var _browserLineW = _mctx.measureText(dline).width;
                                    var lineStartX = (anchor === 'middle') ? (_centerX - _browserLineW / 2)
                                                   : (anchor === 'end')  ? (_contentRight - _browserLineW)
                                                   : _contentLeft;
                                    var lineY = ty0m + li * lh;
                                    // 단어(run) 단위로 그림 — 단어 내부는 opentype 커닝/연결 유지, 단어 시작 위치는 브라우저 누적 좌표.
                                    //   공백은 그리지 않고 브라우저 폭만큼 건너뜀(.notdef 방지). 자간(ls) 있으면 글자별 배치.
                                    var _runs = dline.split(/(\s+)/);
                                    var _prefix = '';
                                    for (var ri = 0; ri < _runs.length; ri++) {
                                        var run = _runs[ri];
                                        if (!run) continue;
                                        if (/^\s+$/.test(run)) { _prefix += run; continue; }
                                        if (ls) {
                                            for (var ci = 0; ci < run.length; ci++) {
                                                var _chX = lineStartX + _mctx.measureText(_prefix + run.slice(0, ci)).width;
                                                var _pc = fontObj.getPath(run.charAt(ci), _chX, lineY, fs).toPathData(2);
                                                if (_pc && _pc.trim()) { pathD += _pc + ' '; _lineGlyphs.push(_pc); }
                                            }
                                        } else {
                                            var _runX = lineStartX + _mctx.measureText(_prefix).width;
                                            var _pr = fontObj.getPath(run, _runX, lineY, fs).toPathData(2);
                                            if (_pr && _pr.trim()) { pathD += _pr + ' '; _lineGlyphs.push(_pr); }
                                        }
                                        _prefix += run;
                                    }
                                    if (_lineGlyphs.length) linePaths.push(_lineGlyphs);
                                }
                                if (pathD.trim()) {
                                    var _fillC = _esc(it.fill || '#000');
                                    var _stswO = (it.textStrokeW || 0);
                                    if (!linePaths.length) linePaths = [[pathD.trim()]];
                                    // 2026-06-28: 줄을 각각 "스티커"(테두리+글자)로, 위 줄부터 아래 줄 순서로 그림 →
                                    //   아래 줄 스티커가 위 줄의 아래쪽 테두리를 덮음 = 줄 사이 이중 테두리 제거(아래 줄 테두리만 남음).
                                    //   각 줄 안에서는 테두리=합친 path 한 번(이중 방지), fill=글자별(검정네모 방지)+살짝 부풀려(0.7W) 글자 사이 메움.
                                    var _joinO = (it.textStrokeJoin === 'miter') ? 'miter' : 'round';
                                    var _mlim = (_joinO === 'miter' ? ' stroke-miterlimit="6"' : '');
                                    // 앞 글자(fill) 레이어는 테두리(두께) 없이 순수 fill 만 — 안에 작은 틈이 남아도 OK(사용자 요청).
                                    var _fillTail = '" fill="' + _fillC + '"/>';
                                    linePaths.forEach(function(lineGlyphs){
                                        if (!lineGlyphs || !lineGlyphs.length) return;
                                        if (_stswO > 0) {
                                            var _lineD = lineGlyphs.join(' ');
                                            parts.push('<path d="' + _lineD + '" fill="none" stroke="' + _esc(it.textStroke || '#000000') + '" stroke-width="' + _fmt(2 * _stswO) + '" stroke-linejoin="' + _joinO + '" stroke-linecap="' + _joinO + '"' + _mlim + '/>');
                                            lineGlyphs.forEach(function(gp){ if (gp && gp.trim()) parts.push('<path d="' + gp.trim() + _fillTail); });
                                        } else {
                                            lineGlyphs.forEach(function(gp){ if (gp && gp.trim()) parts.push('<path d="' + gp.trim() + '" fill="' + _fillC + '"/>'); });
                                        }
                                    });
                                    outlinedOk = true;
                                }
                            } else {
                                console.warn('[outline] font not available, fallback to <text>:', famClean, fw);
                            }
                        } catch(_oe){ console.warn('[outline] failed for text:', famClean, _oe); }
                    }
                    // 2026-06-28: PDF(rasterize) 인데 아웃라인 실패 — 그 텍스트만 웹폰트로 PNG 래스터화해 임베드.
                    //   (svg2pdf <text> 폴백은 웹폰트 없이 + paint-order 무시로 앞글씨 사라지고 테두리만 남음)
                    if (!outlinedOk && rasterize) {
                        var _txtPng = _meTextItemToPng(it, lines);
                        if (_txtPng && _txtPng.dataUrl) {
                            parts.push('<image href="' + _esc(_txtPng.dataUrl) + '" x="' + _fmt(_txtPng.x) + '" y="' + _fmt(_txtPng.y) + '" width="' + _fmt(_txtPng.w) + '" height="' + _fmt(_txtPng.h) + '" preserveAspectRatio="none"/>');
                            outlinedOk = true;
                        }
                    }
                    // 폴백: 일반 <text> 요소
                    if (!outlinedOk) {
                        var tspans = lines.map(function(line, li){
                            return '<tspan x="' + _fmt(tx) + '" '
                                + (li === 0 ? 'y="' + _fmt(ty0) + '"' : 'dy="' + _fmt(lh) + '"')
                                + '>' + _esc(line.replace(/\s+$/, '')) + '</tspan>';   // 줄 끝 공백 제거 (중앙정렬 밀림 방지)
                        }).join('');
                        var _stswF = (it.textStrokeW || 0);
                        var _joinF = (it.textStrokeJoin === 'miter') ? 'miter' : 'round';
                        var _strokeAttr = (_stswF > 0) ? ('stroke="' + _esc(it.textStroke || '#000000') + '" stroke-width="' + _fmt(2 * _stswF) + '" paint-order="stroke" stroke-linejoin="' + _joinF + '" ') : '';
                        parts.push('<text font-family="' + fam + '" font-size="' + _fmt(fs) + '" '
                            + 'font-weight="' + fw + '" '
                            + (ls ? 'letter-spacing="' + _fmt(ls) + '" ' : '')
                            + _strokeAttr
                            + 'fill="' + _esc(it.fill || '#000') + '" text-anchor="' + anchor + '">'
                            + tspans + '</text>');
                    }
                }
                if (gTrans) parts.push('</g>');
            }
            parts.push('</svg>');
            return parts.join('\n');
        } catch(e) {
            console.warn('[_meExportSVG]', e);
            return null;
        }
    };

    // 2026-06-19 v682/v683: 미니에디터 디자인 → 벡터 PDF 변환 (인쇄소 표준).
    //   v682: PNG raster 임베드 → 일러스트레이터에서 raster 로 표시되던 문제
    //   v683: _meExportSVG({outline:true}) → svg2pdf.js → 벡터 PDF (텍스트도 path).
    //         이미지 객체는 SVG 내 base64 raster 로 자연스럽게 임베드. 텍스트/도형/배경은 벡터.
    //         svg2pdf 실패 시 PNG raster 임베드로 폴백.
    async function _loadJsPDFIfNeeded() {
        if (window.jspdf) return true;
        try { if (typeof window.loadEditorLibraries === 'function') await window.loadEditorLibraries(); } catch(_){}
        if (window.jspdf) return true;
        try {
            await new Promise(function(res, rej){
                var s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                s.onload = res; s.onerror = function(){ rej(new Error('jsPDF load fail')); };
                document.head.appendChild(s);
            });
        } catch(e) { console.warn('[me pdf] jsPDF load failed', e); return false; }
        return !!window.jspdf;
    }
    async function _loadSvg2PdfIfNeeded() {
        if (window.svg2pdf || (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.svg)) return true;
        try {
            await new Promise(function(res, rej){
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.4/dist/svg2pdf.umd.js';
                s.onload = res; s.onerror = function(){ rej(new Error('svg2pdf load fail')); };
                document.head.appendChild(s);
            });
        } catch(e) { console.warn('[me pdf] svg2pdf load failed', e); return false; }
        return !!(window.svg2pdf || (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.svg));
    }

    window._meExportPDF = async function(opts) {
        opts = opts || {};
        if (!(await _loadJsPDFIfNeeded())) return null;
        var jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF || !me || !me.natW || !me.natH) return null;
        var PX_PER_MM = 3.7795;
        var widthMm  = Math.max(10, me.natWMm || (me.natW / PX_PER_MM));
        var heightMm = Math.max(10, me.natHMm || (me.natH / PX_PER_MM));

        // 2026-07-06: 단계적 폴백 — 디자이너 SVG 하나가 svg2pdf 를 throw 시켜도 전체가 PNG 로 안 떨어지게.
        //   Tier1 전체 벡터(SVG 자산 인라인) → 실패 시 Tier2 (SVG 자산만 래스터, 텍스트/도형/배경 벡터 유지) → 실패 시 Tier3 전체 PNG.
        async function _svgTextToPdfBlob(svgText) {
            if (!svgText || svgText.length <= 100) return null;
            var parser = new DOMParser();
            var svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            var svgEl = svgDoc.documentElement;
            if (!svgEl || svgEl.nodeName.toLowerCase() !== 'svg') return null;
            if (svgDoc.getElementsByTagName('parsererror').length) { console.warn('[me pdf] export SVG parse error'); return null; }
            // svg2pdf 가 DOM 에 붙어있길 요구할 수 있어 임시 컨테이너에 mount
            var holder = document.createElement('div');
            holder.style.cssText = 'position:absolute; left:-99999px; top:0; visibility:hidden;';
            document.body.appendChild(holder);
            holder.appendChild(svgEl);
            var doc = new jsPDF({ orientation: widthMm > heightMm ? 'l' : 'p', unit: 'mm', format: [widthMm, heightMm], compress: true });
            try {
                await doc.svg(svgEl, { x: 0, y: 0, width: widthMm, height: heightMm });
                try { holder.remove(); } catch(_){}
                return doc.output('blob');
            } catch (svgErr) {
                console.warn('[me pdf] svg2pdf render failed:', svgErr);
                try { holder.remove(); } catch(_){}
                return null;
            }
        }
        try {
            if (typeof window._meExportSVG === 'function' && (await _loadSvg2PdfIfNeeded())) {
                // Tier1: 전체 벡터
                var _b1 = await _svgTextToPdfBlob(await window._meExportSVG({ outline: true, rasterizeImages: true }));
                if (_b1) return _b1;
                // Tier2: SVG 자산만 래스터 (텍스트/도형/배경 벡터 유지) — svg2pdf 를 깨뜨리는 SVG 가 있어도 나머지는 벡터로.
                console.warn('[me pdf] tier1(full vector) failed → tier2 (rasterize SVG assets, keep text/shapes vector)');
                var _b2 = await _svgTextToPdfBlob(await window._meExportSVG({ outline: true, rasterizeImages: true, forceRasterSvg: true }));
                if (_b2) return _b2;
                console.warn('[me pdf] tier2 failed → tier3 (full PNG)');
            }
        } catch(e) { console.warn('[me pdf] SVG path errored, fallback to PNG:', e); }

        // 2) 폴백: PNG raster 임베드
        var pngDataUrl = opts.pngDataUrl;
        if (!pngDataUrl && typeof window._meExportPNG === 'function') {
            try { pngDataUrl = await window._meExportPNG(); } catch(e) { console.warn('[me pdf] _meExportPNG fail', e); }
        }
        if (!pngDataUrl) return null;
        try {
            var doc2 = new jsPDF({
                orientation: widthMm > heightMm ? 'l' : 'p',
                unit: 'mm',
                format: [widthMm, heightMm],
                compress: true
            });
            var fmt = /^data:image\/jpe?g/.test(pngDataUrl) ? 'JPEG' : 'PNG';
            doc2.addImage(pngDataUrl, fmt, 0, 0, widthMm, heightMm);
            return doc2.output('blob');
        } catch(e) {
            console.warn('[me pdf] PNG fallback failed', e);
            return null;
        }
    };

    // 2026-06-19 v630: 텍스트 추출 시 .me-handle/.me-del 자식 제외 — × 가 텍스트로 빨려들어가던 버그 fix.
    //   innerText/textContent 는 absolute 자식의 텍스트(×)까지 포함하므로 항상 이 헬퍼 경유.
    function _meGetCleanText(el) {
        if (!el) return '';
        try {
            var clone = el.cloneNode(true);
            clone.querySelectorAll('.me-handle, .me-del').forEach(function(n){ n.remove(); });
            clone.querySelectorAll('br').forEach(function(b){ b.replaceWith('\n'); });
            clone.querySelectorAll('div, p').forEach(function(d){ d.append('\n'); });
            return (clone.textContent || '').replace(/\n+$/g, '');
        } catch(_){ return (el.textContent || ''); }
    }
    window._meGetCleanText = _meGetCleanText;

    // 2026-06-19 v629: 텍스트 편집 모달 — contenteditable 대신 textarea 입력.
    //   모바일 키보드 친화 + 번역기 복붙 흰배경/스타일 잔재 영구 차단 (textarea 는 plain text only).
    //   Enter = 줄바꿈, Ctrl/Cmd+Enter = 적용, Esc = 취소.
    function _meOpenTextEditModal(it) {
        if (!it || it.type !== 'text' || it._isBackground) return;
        // 기존 모달 있으면 제거
        var ex = document.getElementById('meTextEditOverlay');
        if (ex) ex.remove();
        var overlay = document.createElement('div');
        overlay.id = 'meTextEditOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
        var modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:16px;padding:18px 18px 14px;max-width:520px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:12px;font-family:inherit;';
        // v630: _meGetCleanText 로 .me-del(×)/.me-handle 자식 제외하고 순수 텍스트만 추출
        var cur = _meGetCleanText(it.el) || it.text || '';
        // 기존에 × 가 it.text 에 들어간 케이스 — 우상단 단독 × 제거 (한 글자/공백 포함)
        cur = String(cur).replace(/\r\n?/g, '\n').replace(/[\s×]+$/g, '');
        // v679: 사이트별 다국어
        var _meLh = (location.hostname || '').toLowerCase();
        var _meLang = (_meLh.indexOf('cafe0101')>=0 || _meLh.indexOf('cotton-printer')>=0) ? 'ja'
                    : (_meLh.indexOf('cafe3355')>=0 || _meLh.indexOf('hexa-board')>=0 || _meLh.indexOf('chameleon.design')>=0) ? 'en'
                    : 'ko';
        var _meL = _meLang === 'ja' ? {title:'テキスト編集', ph:'ここにテキストを入力', hint:'Enter = 改行 · Ctrl+Enter = 適用 · Esc = キャンセル', cancel:'キャンセル', apply:'適用'}
                 : _meLang === 'en' ? {title:'Edit Text', ph:'Type text here', hint:'Enter = newline · Ctrl+Enter = apply · Esc = cancel', cancel:'Cancel', apply:'Apply'}
                 : {title:'텍스트 편집', ph:'여기에 텍스트를 입력하세요', hint:'Enter = 줄바꿈 · Ctrl+Enter = 적용 · Esc = 취소', cancel:'취소', apply:'적용'};
        modal.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#0f172a;">'
              + '<i class="fa-solid fa-pen"></i> ' + _meL.title
            + '</div>'
            + '<textarea id="meTextEditArea" rows="5" '
              + 'style="width:100%;padding:14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;font-family:inherit;resize:vertical;box-sizing:border-box;line-height:1.5;outline:none;" '
              + 'placeholder="' + _meL.ph + '"></textarea>'
            + '<div style="font-size:11px;color:#64748b;line-height:1.5;">'
              + _meL.hint
            + '</div>'
            + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
              + '<button type="button" id="meTextEditCancel" style="padding:11px 18px;border:none;border-radius:9px;background:#e2e8f0;color:#334155;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + _meL.cancel + '</button>'
              + '<button type="button" id="meTextEditApply" style="padding:11px 22px;border:none;border-radius:9px;background:#7c3aed;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + _meL.apply + '</button>'
            + '</div>';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        var ta = modal.querySelector('#meTextEditArea');
        ta.value = cur;
        // 약간 지연 후 포커스 (모바일 키보드 안정성)
        setTimeout(function(){ ta.focus(); ta.select(); }, 50);

        function close() {
            try { overlay.remove(); } catch(_){}
        }
        function apply() {
            var newText = ta.value;
            _meSnapshot();
            it.text = newText;
            // DOM 갱신 — innerHTML 정리 후 텍스트 노드 + <br> 삽입 (모든 인라인 스타일 박멸)
            //   주의: 자식 .me-handle/.me-del 은 _meSelect 가 다시 그려주므로 여기서 모두 제거됨.
            it.el.textContent = '';
            var lines = newText.split('\n');
            lines.forEach(function(line, i){
                if (i > 0) it.el.appendChild(document.createElement('br'));
                it.el.appendChild(document.createTextNode(line));
            });
            // 글자 수가 줄어서 박스가 텍스트보다 크면 자동 refit
            if (it._edgeResized) {
                it._edgeResized = false;
                it.el.style.width = '';
                it.el.style.maxWidth = '';
                it.el.style.height = '';
            }
            _meSyncItemDisplay(it);
            _meSelect(it);  // 핸들/X 재배치
            close();
        }
        // pointerdown: 글씨를 드래그 선택하다 배경에서 놓아도 닫히지 않게 (click 은 드래그 종료도 잡음)
        overlay.addEventListener('pointerdown', function(e){
            if (e.target === overlay) close();
        });
        modal.querySelector('#meTextEditCancel').addEventListener('click', close);
        modal.querySelector('#meTextEditApply').addEventListener('click', apply);
        ta.addEventListener('keydown', function(e){
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                apply();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
    }
    window._meOpenTextEditModal = _meOpenTextEditModal;

    // 2026-06-27: 이미지 객체 선택 시 객체 위에 떠 있는 '그림 변경' 칩 (상단 옵션줄이 스크롤로 안 보여도 항상 보이게).
    function _meAddImgChangeChip(it) {
        if (!it || it.type !== 'image' || !it.el) return;
        if (it._isBackground) return;
        if (it._cutlineRays && it._cutlineRays.length > 10) return;
        if (it.el.querySelector('.me-imgchip')) return;
        var c = document.createElement('div');
        c.className = 'me-imgchip';
        c.textContent = _meT('me_change_img', '그림 변경');
        c.style.cssText = 'position:absolute; bottom:-26px; left:50%; transform:translateX(-50%); background:#4338ca; color:#fff; font-size:11px; font-weight:700; line-height:1; padding:5px 11px; border-radius:13px; cursor:pointer; white-space:nowrap; z-index:40; font-family:inherit; user-select:none;';
        c.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); ev.preventDefault(); if (window._meChangeImage) window._meChangeImage(it); });
        it.el.appendChild(c);
    }
    function _meSelect(it) {
        me.items.forEach(function(o){ o.el.classList.remove('selected'); });
        var existing = me.stage.querySelectorAll('.me-handle, .me-del, .me-imgchip');
        existing.forEach(function(n){ n.remove(); });
        me.selected = it;
        // 2026-06-15: 선택이 이미지면 누끼따기 버튼 활성화.
        try {
            var _bgBtn = $('meBgRemoveBtn');
            if (_bgBtn) {
                var _on = !!(it && it.type === 'image');
                _bgBtn.disabled = !_on;
                _bgBtn.style.opacity = _on ? '1' : '0.45';
                _bgBtn.style.cursor = _on ? 'pointer' : 'not-allowed';
            }
        } catch (e) {}
        if (!it) { _meRenderProps(null); return; }
        it.el.classList.add('selected');
        // 2026-06-17 v539: 템플릿 슬롯은 위치·크기 잠금 — 리사이즈/회전/삭제 핸들 숨김 (텍스트 더블클릭 편집은 가능).
        if (it._isTemplateSlot) {
            _meRenderProps(it);
            _meAddImgChangeChip(it);   // 슬롯도 그림 교체 가능
            return;
        }
        // 2026-06-14: 4 모서리 핸들 (정비율 리사이즈) + 회전 핸들
        // 2026-06-16: + 4 변 핸들 (n/s/e/w) — 가로/세로 단독 리사이즈 (text 박스 너비/높이 독립 조절).
        ['nw','ne','sw','se','n','s','e','w'].forEach(function(corner){
            var h = document.createElement('div');
            h.className = 'me-handle me-handle-' + corner;
            it.el.appendChild(h);
            _meBindResize(h, it, corner);
        });
        // 회전 핸들 (상단 위, 녹색)
        var rh = document.createElement('div');
        rh.className = 'me-handle me-handle-rot';
        it.el.appendChild(rh);
        _meBindRotate(rh, it);
        // 삭제 버튼 (우상단, 회전 핸들과 겹치지 않게 right:-6px;top:-22px 으로)
        var d = document.createElement('div'); d.className = 'me-del'; d.textContent = '×';
        it.el.appendChild(d);
        d.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); ev.preventDefault(); _meRemove(it); });
        _meAddImgChangeChip(it);   // 2026-06-27: 이미지면 '그림 변경' 칩 표시
        // 2026-06-19 v625/v627: 텍스트의 경우 — X 버튼을 실제 렌더된 텍스트 우상단에 동적 배치.
        //   v625 의 selectNodeContents 는 자식 .me-del/.me-handle 까지 측정 범위에 포함시켜 잘못된 rect 가 나옴.
        //   v627: TreeWalker 로 텍스트 노드만 골라서 정확한 텍스트 bbox 측정.
        if (it.type === 'text') {
            try {
                var firstText = null, lastText = null;
                var walker = document.createTreeWalker(it.el, NodeFilter.SHOW_TEXT, null, false);
                var tn;
                while ((tn = walker.nextNode())) {
                    if (!firstText) firstText = tn;
                    lastText = tn;
                }
                if (firstText && lastText) {
                    var range = document.createRange();
                    range.setStart(firstText, 0);
                    range.setEnd(lastText, (lastText.textContent || '').length);
                    var rect = range.getBoundingClientRect();
                    var boxRect = it.el.getBoundingClientRect();
                    if (rect && boxRect && rect.width > 0 && boxRect.width > rect.width + 8) {
                        var offsetRight = boxRect.right - rect.right;
                        d.style.right = (offsetRight - 6) + 'px';
                    }
                }
            } catch(_de){}
        }
        _meRenderProps(it);
    }

    function _meRemove(it) {
        _meSnapshot();
        // 2026-06-16 v3: item 삭제 시 그 item 에 연결된 칼선만 사라지고 (per-item 저장) 나머지는 유지.
        //   per-item _cutlineRelPts 는 item 객체와 함께 GC, _meCutlineRenderAll 에서 자동 제외됨.
        me.items = me.items.filter(function(o){ return o !== it; });
        it.el.remove();
        if (me.selected === it) { me.selected = null; _meRenderProps(null); }
        // 2026-06-16 v3: 칼선 overlay 도 다시 그림 (삭제된 item 의 path 제거).
        try { if (typeof _meCutlineRenderAll === 'function') _meCutlineRenderAll(); } catch(_re) {}
    }

    // 속성 패널 렌더
    function _meRenderProps(it) {
        var panel = $('meProps');
        if (!panel) return;
        // 2026-06-15: 선택 없거나 이미지 선택 시도 props bar 항상 표시 — 텍스트 모드 stub 렌더.
        //   stub 상태에선 opacity 낮춰 비활성 표시 (.me-props-stub), 컨트롤은 보이지만 입력은 no-op.
        panel.classList.add('show');
        // 2026-06-16 v11: 칼선이 있는 이미지도 stub 해제 — 슬라이더 interactive 하도록.
        //   이전엔 image type 이면 무조건 stub 처리되어 .me-props-stub의 pointer-events:none 때문에 슬라이더 비활성.
        var _hasCutlineActive = !!(it && it._cutlineRays && it._cutlineRays.length > 10);
        // 2026-06-25: 선택된 객체(이미지/도형 포함)가 있으면 stub 해제 — 회전/꽉채우기/정렬 등 공용 액션이 클릭되도록.
        //   (이전엔 텍스트 외 타입은 stub → pointer-events:none 으로 버튼 비활성)
        panel.classList.toggle('me-props-stub', !it);
        var html = '';
        var T = _meUiT;
        // 2026-06-15: 선택이 없으면 stub 용 가짜 item 만들어서 text 분기로 흘려보냄 → 동일 UI 항상 노출.
        if (!it) {
            it = { type:'text', fill:'#1e293b', fontFamily:'sans-serif', fontWeight:400, fontSize:24, letterSpacing:0, lineHeight:1.2, textAlign:'left' };
        }
        if (it.type === 'text') {
            var fonts = _meCurrentFonts();
            function _meFontOptionHtml(f) {
                var fam = (f.font_family === 'sans-serif' || f.font_family === 'serif' || f.font_family === 'monospace' || f.font_family === 'cursive')
                    ? f.font_family : ('"' + f.font_family + '"');
                var sel = (it.fontFamily === fam) ? ' selected' : '';
                var preview = (f.font_family === 'sans-serif') ? '' : ' style="font-family:' + fam.replace(/"/g, '&quot;') + ';"';
                return '<option value="' + fam.replace(/"/g, '&quot;') + '" data-fam="' + f.font_family.replace(/"/g, '&quot;') + '" data-w="' + (f.weights || '') + '"' + sel + preview + '>' + f.font_name + '</option>';
            }
            var fontOpts = fonts.map(_meFontOptionHtml).join('');
            // 2026-06-16: 멋진 영문 — 모든 언어 사이트 공통으로 노출 (optgroup 으로 분리).
            var scriptOpts = ME_SCRIPT_FONTS.map(_meFontOptionHtml).join('');
            fontOpts += '<optgroup label="✨ ' + T('me_script_fonts','멋진 영문') + '">' + scriptOpts + '</optgroup>';
            // 2026-06-15: 색상은 상단 툴바 chip 으로 통합 — props 패널에선 제거. 자간/행간도 제거.
            html += '<span class="me-prop-group"><label>' + T('me_prop_font','서체') + '</label><select data-mp="fontFamily" data-font-select>' + fontOpts + '</select></span>';
            // 2026-06-15: 두께 셀렉터 → S/M/B 토글 3개. 현재 폰트의 지원 weight 중에 300/400/700 에 가장 가까운 값으로 매핑.
            (function(){
                var clean = String(it.fontFamily || '').replace(/["']/g, '').trim();
                var allFonts = []; Object.keys(ME_GOOGLE_FONTS).forEach(function(k){ (ME_GOOGLE_FONTS[k]||[]).forEach(function(f){ allFonts.push(f); }); });
                var matchF = allFonts.find(function(f){ return f.font_family === clean; });
                var supported = (matchF && matchF.weights) ? String(matchF.weights).split(';').map(function(w){ return parseInt(w,10); }).filter(function(w){ return !isNaN(w); }) : [400, 700];
                if (supported.length < 2) return;  // 한 가지 weight 만 있으면 토글 숨김 (검은고딕 등)
                function _closest(target){
                    var best = supported[0], bd = Math.abs(supported[0]-target);
                    supported.forEach(function(w){ var d = Math.abs(w-target); if (d<bd){bd=d;best=w;}});
                    return best;
                }
                // 2026-06-15: S=일반(400) / B=굵게(700) / EB=두껍게(900) — 한글 폰트는 light(300)와 regular(400)이
                //   동일하게 보여 의미 없으므로 light 토글 폐기, 3단계만 유지.
                // 2026-06-16: 더 두꺼운 EB(extra-bold) 추가. 폰트가 900 을 지원 안 하면 (closest 가 B 와 동일) 버튼 숨김.
                var sW = _closest(400), bW = _closest(700), eW = _closest(900);
                var cur = parseInt(it.fontWeight || 400, 10);
                var stages = [['S',sW,'일반'],['B',bW,'굵게']];
                if (eW !== bW) stages.push(['EB', eW, '두껍게']);
                var smbHtml = '<span class="me-prop-group" style="gap:3px;">';
                stages.forEach(function(p){
                    var on = (cur === p[1]);
                    smbHtml += '<button type="button" class="me-prop-btn smb' + (on?' active':'') + '" data-weight="' + p[1] + '" title="' + p[2] + '">' + p[0] + '</button>';
                });
                smbHtml += '</span>';
                html += smbHtml;
            })();
            // 2026-06-15: 크기 입력 제거 — 핸들 드래그로 크기 조절 (사용자 요청).
            var alignSvg = function(d){ return '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="' + d + '"/></svg>'; };
            var svgL = alignSvg('M1 3h14v1.5H1zm0 3.25h10v1.5H1zm0 3.25h14V11H1zm0 3.25h10V14H1z');
            var svgC = alignSvg('M1 3h14v1.5H1zm2 3.25h10v1.5H3zm-2 3.25h14V11H1zm2 3.25h10V14H3z');
            var svgR = alignSvg('M1 3h14v1.5H1zm4 3.25h10v1.5H5zm-4 3.25h14V11H1zm4 3.25h10V14H5z');
            // 2026-06-15: 정렬 — props 첫 줄로 이동 (사용자 요청 — 자간/행간 제거 후 한 줄에 다 들어감).
            html += '<span class="me-prop-group" style="gap:2px;">'
                + '<button type="button" class="me-prop-btn' + (it.textAlign === 'left' ? ' active' : '') + '" data-align="left">' + svgL + '</button>'
                + '<button type="button" class="me-prop-btn' + (it.textAlign === 'center' ? ' active' : '') + '" data-align="center">' + svgC + '</button>'
                + '<button type="button" class="me-prop-btn' + (it.textAlign === 'right' ? ' active' : '') + '" data-align="right">' + svgR + '</button>'
            + '</span>';
            // 2026-06-19 v622: 글자 크기 / 자간 / 행간 — 아이콘 + 값 + 화살표 버튼 (간단 조정)
            //   글자 크기: T + 숫자 + ▼▲
            //   자간:      ↔ + 숫자 + ◀▶
            //   행간:      ☰ + 숫자 + ▼▲
            var _fsCur = Math.round(it.fontSize || 24);
            var _lsCur = Math.round((it.letterSpacing || 0) * 10) / 10;
            var _lhCur = Math.round((it.lineHeight || 1.2) * 100) / 100;
            // T 글자 + 숫자 + 위/아래 화살표
            html += '<span class="me-prop-group" style="gap:3px;" title="' + T('me_prop_fsize','글자 크기 (T)') + '">'
                + '<span style="font-weight:900; font-size:13px; color:#64748b; font-family:serif;">T</span>'
                + '<span data-step-val="fontSize" style="min-width:24px; text-align:center; font-size:12px; font-weight:700;">' + _fsCur + '</span>'
                + '<button type="button" class="me-prop-btn" data-step="fontSize" data-delta="-1" title="−1"><i class="fa-solid fa-caret-down"></i></button>'
                + '<button type="button" class="me-prop-btn" data-step="fontSize" data-delta="1" title="+1"><i class="fa-solid fa-caret-up"></i></button>'
            + '</span>';
            // 자간 — 좌우 화살표
            html += '<span class="me-prop-group" style="gap:3px;" title="' + T('me_prop_lspace','자간') + '">'
                + '<i class="fa-solid fa-arrows-left-right" style="color:#64748b; font-size:11px;"></i>'
                + '<span data-step-val="letterSpacing" style="min-width:28px; text-align:center; font-size:12px; font-weight:700;">' + _lsCur + '</span>'
                + '<button type="button" class="me-prop-btn" data-step="letterSpacing" data-delta="-0.5" title="−0.5"><i class="fa-solid fa-caret-left"></i></button>'
                + '<button type="button" class="me-prop-btn" data-step="letterSpacing" data-delta="0.5" title="+0.5"><i class="fa-solid fa-caret-right"></i></button>'
            + '</span>';
            // 행간 — 위아래 화살표
            html += '<span class="me-prop-group" style="gap:3px;" title="' + T('me_prop_lheight','행간 (배수)') + '">'
                + '<i class="fa-solid fa-grip-lines" style="color:#64748b; font-size:11px;"></i>'
                + '<span data-step-val="lineHeight" style="min-width:30px; text-align:center; font-size:12px; font-weight:700;">' + _lhCur.toFixed(2) + '</span>'
                + '<button type="button" class="me-prop-btn" data-step="lineHeight" data-delta="-0.1" title="−0.1"><i class="fa-solid fa-caret-down"></i></button>'
                + '<button type="button" class="me-prop-btn" data-step="lineHeight" data-delta="0.1" title="+0.1"><i class="fa-solid fa-caret-up"></i></button>'
            + '</span>';
            // 2026-06-28: 글씨 테두리 (색 + 두께 + 작은 ▲▼ 스텝). 두께 0 = 없음.
            html += '<span class="me-prop-group" style="gap:3px;" title="' + T('me_prop_textstroke','글씨 테두리') + '">'
                + '<label>' + T('me_prop_textstroke','테두리') + '</label>'
                + '<input type="color" value="' + (it.textStroke || '#000000') + '" data-mp="textStroke">'
                + '<input type="number" min="0" max="40" step="0.5" value="' + (it.textStrokeW || 0) + '" data-mp="textStrokeW" style="width:42px;" title="' + T('me_prop_textstrokew','테두리 두께') + '">'
                + '<button type="button" class="me-prop-btn" data-step="textStrokeW" data-delta="-0.5" title="−0.5"><i class="fa-solid fa-caret-down"></i></button>'
                + '<button type="button" class="me-prop-btn" data-step="textStrokeW" data-delta="0.5" title="+0.5"><i class="fa-solid fa-caret-up"></i></button>'
                + '<button type="button" class="me-prop-btn" data-action="strokeJoin" style="padding:0 6px;" title="' + T('me_prop_strokejoin','테두리 모서리 둥글게/각지게') + '">'
                    + ((it.textStrokeJoin === 'miter')
                        ? '<svg width="16" height="16" viewBox="0 0 16 16" style="display:block;"><path d="M3 13 L3 3 L13 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="miter"/></svg>'
                        : '<svg width="16" height="16" viewBox="0 0 16 16" style="display:block;"><path d="M3 13 L3 7 Q3 3 7 3 L13 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>')
                + '</button>'
            + '</span>';
        } else if (it.type === 'shape') {
            // 2026-06-15: 색상은 상단 chip 으로 통합 — props 의 채움 색은 제거. 테두리/두께만 유지.
            html += '<span class="me-prop-group"><label>' + T('me_prop_stroke','테두리') + '</label><input type="color" value="' + (it.stroke || '#000000') + '" data-mp="stroke"></span>';
            html += '<span class="me-prop-group"><label>' + T('me_prop_strokew','두께') + '</label><input type="number" min="0" max="40" value="' + (it.strokeWidth || 0) + '" data-mp="strokeWidth"></span>';
        } else if (it.type === 'image') {
            // 2026-06-25: QR 이미지면 'QR 수정' 버튼 (주소 변경) 노출
            if (it._isQr) {
                html += '<button type="button" class="me-prop-btn" data-action="qredit" style="background:#ede9fe; color:#6d28d9; font-weight:800; padding:0 12px; gap:5px;"><i class="fa-solid fa-qrcode"></i> ' + T('me_qr_edit','QR 수정') + '</button>';
            } else if (!(it._cutlineRays && it._cutlineRays.length > 10) && !it._isBackground) {
                // 2026-06-27: 그림 변경 — 요소·클립아트에서 고르기 / 내사진 올려 배경제거.
                //   템플릿에서 불러온 객체(_isTemplateSlot)도 교체 가능해야 하므로 슬롯은 제외하지 않음. (배경/칼선만 제외)
                html += '<button type="button" class="me-prop-btn" data-action="changeImage" style="background:#eef2ff; color:#4338ca; font-weight:700; padding:0 14px;">' + T('me_change_img','그림 변경') + '</button>';
            }
            // 2026-06-16 v8: 칼선이 있는 이미지 → 마진 % 슬라이더 (0.5%~12% 가변).
            //   모드 (outer/inner) 는 trace 시 결정된 it._cutlineMode 그대로 사용 — 슬라이더는 절대값만 조절.
            //   horn/뾰족한 곳 칼선이 좁아 보일 때 사용자가 직접 늘릴 수 있도록.
            if (it._cutlineRays && it._cutlineRays.length > 10) {
                var _curPct = (it._cutlineMarginPct != null) ? it._cutlineMarginPct : (it._cutlineMode === 'inner' ? 0.02 : 0.03);
                var _curPctDisp = (_curPct * 100).toFixed(1);
                var _modeLbl = (it._cutlineMode === 'inner') ? 'inner −' : 'outer +';
                html += '<span class="me-prop-group me-cf-group" style="gap:6px; min-width:200px;">'
                     +   '<label style="color:#b91c1c;">외곽선 두께</label>'
                     +   '<span class="me-cf-row">'
                     +     '<input type="range" min="5" max="120" step="1" value="' + Math.round(_curPct * 1000) + '" data-cutline-margin style="flex:1; min-width:90px; accent-color:#ef4444;">'
                     +     '<span data-cutline-margin-val style="font-size:11px; font-weight:700; color:#b91c1c; min-width:48px; text-align:right;">' + _modeLbl + _curPctDisp + '%</span>'
                     +   '</span>'
                     + '</span>';
                // 2026-06-17: 등신대 모드 — 받침대 높이 + 넓이 슬라이더 (1 그룹에 좌우 나란히, 라벨은 작은 아이콘만)
                // 2026-06-18 v577: 두 슬라이더를 한 칸에 합침 (모바일 가로 1칸 안에 둘 다 들어가도록)
                if (window._meStandeeBase && it._cutlineMode === 'outer') {
                    // 2026-07-11: 받침 사각형 — 위로 늘리기 / 아래로 늘리기 2슬라이더로 높이·위치 조절.
                    var _upP = (it._cutlineBaseUpPct != null) ? it._cutlineBaseUpPct : 0.12;
                    var _dnP = (it._cutlineBaseDownPct != null) ? it._cutlineBaseDownPct : 0.10;
                    html += '<span class="me-prop-group me-cf-group" style="gap:4px; min-width:0; flex:1 1 100%;">'
                         +   '<label style="color:#0369a1;">받침 위치</label>'
                         +   '<span class="me-cf-row">'
                         +     '<input type="range" min="0" max="400" step="1" value="' + Math.round(_upP * 1000) + '" data-cutline-baseup style="flex:1; min-width:60px; accent-color:#0ea5e9;">'
                         +     '<span data-cutline-baseup-val style="font-size:10.5px; font-weight:700; color:#0369a1; min-width:34px; text-align:right;">' + (_upP * 100).toFixed(0) + '%</span>'
                         +   '</span>'
                         +   '<span class="me-cf-row">'
                         +     '<input type="range" min="0" max="400" step="1" value="' + Math.round(_dnP * 1000) + '" data-cutline-basedown style="flex:1; min-width:60px; accent-color:#0ea5e9;">'
                         +     '<span data-cutline-basedown-val style="font-size:10.5px; font-weight:700; color:#0369a1; min-width:34px; text-align:right;">' + (_dnP * 100).toFixed(0) + '%</span>'
                         +   '</span>'
                         + '</span>';
                }
                // 2026-07-11: 객체크기 모드 — 이 조각(칼선 바깥 윤곽)의 실제 mm 크기 입력(비율 고정).
                if (window._meObjSizeMode) {
                    var _osz = (typeof window._meGetStandeeSizeMm === 'function') ? window._meGetStandeeSizeMm() : null;
                    var _oW = _osz ? Math.round(_osz.wMm) : 0;
                    var _oH = _osz ? Math.round(_osz.hMm) : 0;
                    html += '<span class="me-prop-group me-cf-group me-cf-size" style="min-width:0; flex:1 1 100%;">'
                         +   '<label style="color:#334155;">크기 (mm · 비율고정)</label>'
                         +   '<span class="me-cf-row"><span class="me-cf-dim">가로</span><input type="number" min="10" max="3000" step="1" value="' + _oW + '" data-obj-size-w id="meObjSizeW"><span class="me-cf-unit">mm</span></span>'
                         +   '<span class="me-cf-row"><span class="me-cf-dim">세로</span><input type="number" min="10" max="3000" step="1" value="' + _oH + '" data-obj-size-h id="meObjSizeH"><span class="me-cf-unit">mm</span></span>'
                         + '</span>';
                }
            }
        }
        // 2026-06-14: 공통 액션 — 복제 / 반전 / 레이어 순서 (모든 type 공용)
        html += '<span class="me-prop-group" style="gap:4px;">';
        // 2026-06-25: 90° 회전 + 화면 꽉 채우기 (사진/객체 공용)
        html += '<button type="button" class="me-prop-btn" title="' + T('me_rotate90','90° 회전') + '" data-action="rot90"><i class="fa-solid fa-rotate-right"></i></button>';
        html += '<button type="button" class="me-prop-btn" title="' + T('me_fill','화면 꽉 채우기') + '" data-action="fill"><i class="fa-solid fa-expand"></i></button>';
        html += '<button type="button" class="me-prop-btn" title="' + T('me_dup','복제 (Ctrl+D)') + '" data-action="dup"><i class="fa-solid fa-clone"></i></button>';
        // 2026-06-18 v566: 좌우/상하 반전 → 캔버스 가로/세로 중앙정렬 로 변경
        html += '<button type="button" class="me-prop-btn" title="' + T('me_center_h','가로 중앙정렬') + '" data-action="centerh"><i class="fa-solid fa-arrows-left-right-to-line"></i></button>';
        html += '<button type="button" class="me-prop-btn" title="' + T('me_center_v','세로 중앙정렬') + '" data-action="centerv"><i class="fa-solid fa-arrows-up-to-line" style="transform:rotate(0deg);"></i></button>';
        html += '<button type="button" class="me-prop-btn" title="' + T('me_layer_up','앞으로') + '" data-action="up"><i class="fa-solid fa-arrow-up"></i></button>';
        html += '<button type="button" class="me-prop-btn" title="' + T('me_layer_down','뒤로') + '" data-action="down"><i class="fa-solid fa-arrow-down"></i></button>';
        html += '</span>';
        panel.innerHTML = html;
        // 2026-06-16: 드롭다운 모든 옵션의 폰트를 미리 로드 — 펼치기 전엔 preview 가 안 나오던 문제 해결.
        //   Google Fonts CSS 는 가벼우므로 35+개 link 주입해도 부담 적음. 실제 글자 파일은 사용 시에만 다운로드.
        var sel = panel.querySelector('select[data-font-select]');
        if (sel) {
            sel.querySelectorAll('option').forEach(function(o){
                if (o.dataset && o.dataset.fam) _meLoadFont(o.dataset.fam, o.dataset.w);
            });
        }
        panel.querySelectorAll('[data-mp]').forEach(function(inp){
            // change for SELECT (input on every keystroke makes typing weird), input for the rest
            var evName = (inp.tagName === 'SELECT') ? 'change' : 'input';
            inp.addEventListener(evName, function(){
                var key = inp.dataset.mp;
                var isNum = (inp.type === 'number') || (inp.dataset.mpNum === '1');
                var val = isNum ? parseFloat(inp.value) : inp.value;
                if (key === 'fontSize') it.fontSize = val;
                else if (key === 'fontWeight') it.fontWeight = parseInt(val, 10);
                else it[key] = val;
                // 폰트 선택 시 lazy load + 두께 셀렉터 재구성 (지원 weight 변경됨)
                if (key === 'fontFamily' && inp.tagName === 'SELECT') {
                    var opt = inp.options[inp.selectedIndex];
                    if (opt) _meLoadFont(opt.dataset.fam, opt.dataset.w);
                    _meSyncItemDisplay(it);
                    // 두께 옵션 재구성
                    _meRenderProps(it);
                    return;
                }
                _meSyncItemDisplay(it);
            });
        });
        panel.querySelectorAll('[data-align]').forEach(function(btn){
            btn.addEventListener('click', function(){
                it.textAlign = btn.dataset.align;
                panel.querySelectorAll('[data-align]').forEach(function(b){ b.classList.remove('active'); });
                btn.classList.add('active');
                _meSyncItemDisplay(it);
            });
        });
        // 2026-06-19 v622: 글자크기/자간/행간 — 화살표 버튼 step 조정
        panel.querySelectorAll('[data-step]').forEach(function(btn){
            btn.addEventListener('click', function(){
                var key = btn.dataset.step;
                var delta = parseFloat(btn.dataset.delta);
                if (!isFinite(delta)) return;
                var cur;
                if (key === 'fontSize') cur = it.fontSize || 24;
                else if (key === 'letterSpacing') cur = it.letterSpacing || 0;
                else if (key === 'lineHeight') cur = it.lineHeight || 1.2;
                else if (key === 'textStrokeW') cur = it.textStrokeW || 0;
                else return;
                var next = cur + delta;
                // 범위 clamp
                if (key === 'fontSize') next = Math.max(6, Math.min(400, next));
                if (key === 'letterSpacing') next = Math.max(-20, Math.min(60, next));
                if (key === 'lineHeight') next = Math.max(0.6, Math.min(3, next));
                if (key === 'textStrokeW') next = Math.max(0, Math.min(40, next));
                // 소수점 정리 (부동소수 누적 방지)
                next = Math.round(next * 100) / 100;
                it[key] = next;
                // 화면 즉시 갱신
                _meSyncItemDisplay(it);
                // 값 표시 라벨 업데이트
                var lbl = panel.querySelector('[data-step-val="' + key + '"]');
                if (lbl) {
                    if (key === 'fontSize') lbl.textContent = Math.round(next);
                    else if (key === 'lineHeight') lbl.textContent = next.toFixed(2);
                    else lbl.textContent = (Math.round(next * 10) / 10);
                }
                // textStrokeW 는 number input 도 동기화
                if (key === 'textStrokeW') { var _ni = panel.querySelector('input[data-mp="textStrokeW"]'); if (_ni) _ni.value = next; }
            });
        });
        // 2026-06-15: SMB 두께 토글
        panel.querySelectorAll('[data-weight]').forEach(function(btn){
            btn.addEventListener('click', function(){
                var w = parseInt(btn.getAttribute('data-weight'), 10);
                if (isNaN(w)) return;
                it.fontWeight = w;
                panel.querySelectorAll('[data-weight]').forEach(function(b){ b.classList.remove('active'); });
                btn.classList.add('active');
                _meSyncItemDisplay(it);
            });
        });
        // 2026-06-16 v8: 칼선 간격 슬라이더 — drag 시 즉시 offset 재계산 + 재렌더.
        panel.querySelectorAll('[data-cutline-margin]').forEach(function(sl){
            sl.addEventListener('input', function(){
                var pct = parseInt(sl.value, 10) / 1000;   // value 5~120 → 0.005~0.12 (0.5%~12%)
                if (!isFinite(pct) || pct <= 0) pct = 0.01;
                if (typeof window._meCutlineSetMargin === 'function') window._meCutlineSetMargin(it, pct);
                var disp = panel.querySelector('[data-cutline-margin-val]');
                if (disp) {
                    var modeLbl = (it._cutlineMode === 'inner') ? 'inner −' : 'outer +';
                    disp.textContent = modeLbl + (pct * 100).toFixed(1) + '%';
                }
            });
        });
        // 2026-07-11: 받침 사각형 '위로 늘리기' 슬라이더 — topY 를 객체 안쪽으로 (틈 없이 붙게).
        panel.querySelectorAll('[data-cutline-baseup]').forEach(function(sl){
            sl.addEventListener('input', function(){
                var pct = parseInt(sl.value, 10) / 1000;   // 0~400 → 0.0~0.4
                if (!isFinite(pct) || pct < 0) pct = 0;
                it._cutlineBaseUpPct = pct;
                var curMargin = (it._cutlineMarginPct != null) ? it._cutlineMarginPct : (it._cutlineMode === 'inner' ? 0.02 : 0.03);
                if (typeof window._meCutlineSetMargin === 'function') window._meCutlineSetMargin(it, curMargin);
                var disp = panel.querySelector('[data-cutline-baseup-val]');
                if (disp) disp.textContent = (pct * 100).toFixed(0) + '%';
            });
        });
        // 2026-07-11: 받침 사각형 '아래로 늘리기' 슬라이더 — botY 를 객체 바닥 아래로.
        panel.querySelectorAll('[data-cutline-basedown]').forEach(function(sl){
            sl.addEventListener('input', function(){
                var pct = parseInt(sl.value, 10) / 1000;   // 0~400 → 0.0~0.4
                if (!isFinite(pct) || pct < 0) pct = 0;
                it._cutlineBaseDownPct = pct;
                var curMargin = (it._cutlineMarginPct != null) ? it._cutlineMarginPct : (it._cutlineMode === 'inner' ? 0.02 : 0.03);
                if (typeof window._meCutlineSetMargin === 'function') window._meCutlineSetMargin(it, curMargin);
                var disp = panel.querySelector('[data-cutline-basedown-val]');
                if (disp) disp.textContent = (pct * 100).toFixed(0) + '%';
            });
        });
        // 2026-07-11: 객체 크기 입력 (mm, 비율 고정) — change(blur/enter) 시에만 반영해 튐 방지.
        panel.querySelectorAll('[data-obj-size-w]').forEach(function(inp){
            inp.addEventListener('change', function(){
                var wMm = parseFloat(inp.value);
                if (!(wMm > 0)) return;
                if (typeof window._meSetStandeeSizeMm === 'function') window._meSetStandeeSizeMm(wMm);
            });
        });
        panel.querySelectorAll('[data-obj-size-h]').forEach(function(inp){
            inp.addEventListener('change', function(){
                var hMm = parseFloat(inp.value);
                if (!(hMm > 0)) return;
                var s = (typeof window._meGetStandeeSizeMm === 'function') ? window._meGetStandeeSizeMm() : null;
                if (s && s.hMm > 0 && typeof window._meSetStandeeSizeMm === 'function') {
                    window._meSetStandeeSizeMm(hMm * (s.wMm / s.hMm));
                }
            });
        });
        // 2026-06-14: 공통 액션 핸들러
        panel.querySelectorAll('[data-action]').forEach(function(btn){
            btn.addEventListener('click', function(){
                var act = btn.dataset.action;
                if (act === 'dup' && window._meDuplicate) window._meDuplicate(it);
                // 2026-06-25: QR 수정 — 주소 입력 모달을 편집 모드로
                else if (act === 'qredit' && window._meAddQR) window._meAddQR(it);
                // 2026-06-27: 그림 변경 — 요소 고르기 / 내사진 누끼 교체
                else if (act === 'changeImage' && window._meChangeImage) window._meChangeImage(it);
                // 2026-06-28: 글씨 테두리 모서리 — 둥글게(round) ↔ 각지게(miter) 토글
                else if (act === 'strokeJoin') {
                    it.textStrokeJoin = (it.textStrokeJoin === 'miter') ? 'round' : 'miter';
                    _meSyncItemDisplay(it);
                    _meRenderProps(it);
                }
                // 2026-06-25: 90° 회전 — 선택 객체를 시계방향 90도씩
                else if (act === 'rot90') {
                    _meSnapshot();
                    it.rotation = ((((it.rotation || 0) + 90) % 360) + 360) % 360;
                    _meSyncItemDisplay(it);
                }
                // 2026-06-25: 화면 꽉 채우기 — 박스를 캔버스 전체로 (이미지=배경처럼). 회전 리셋.
                else if (act === 'fill') {
                    _meSnapshot();
                    it.rotation = 0;
                    it.x = 0; it.y = 0; it.w = me.natW; it.h = me.natH;
                    _meSyncItemDisplay(it);
                }
                // 2026-06-18 v566: 가로/세로 중앙정렬 — 선택한 item 의 박스를 캔버스 중앙으로 이동.
                else if (act === 'centerh') {
                    _meSnapshot();
                    // 텍스트의 경우 max-content 로 실제 폭이 it.w 보다 작을 수 있음 — DOM 폭 우선 사용
                    var _wReal = it.w;
                    try {
                        var _rh = it.el.getBoundingClientRect();
                        if (_rh && _rh.width > 0 && me.wScale) _wReal = _rh.width / me.wScale;
                    } catch(_){}
                    it.x = (me.natW - _wReal) / 2;
                    _meSyncItemDisplay(it);
                }
                else if (act === 'centerv') {
                    _meSnapshot();
                    var _hReal = it.h;
                    try {
                        var _rv = it.el.getBoundingClientRect();
                        if (_rv && _rv.height > 0 && me.wScale) _hReal = _rv.height / me.wScale;
                    } catch(_){}
                    it.y = (me.natH - _hReal) / 2;
                    _meSyncItemDisplay(it);
                }
                else if (act === 'up' && window._meBringForward) window._meBringForward(it);
                else if (act === 'down' && window._meSendBackward) window._meSendBackward(it);
            });
        });
        // 2026-07-11: 칼선(외곽선/받침) 조절 컨트롤만 대지 옆 별도의 떠있는 창으로 분리.
        //   회전·정렬·레이어 등 공용 버튼은 원래 자리(대지 위 props 바)에 그대로 둠.
        //   떠있는 창(#meCutlineFloat)은 .me-stage-wrap 직계 자식(줌/팬 대상인 .me-stage-row 밖)이라 마우스휠 확대/이동에 영향 없음(고정).
        //   리스너는 위에서 노드에 이미 붙어 있으므로, 노드를 창으로 옮겨도 동작 유지.
        try {
            var _wrap = document.querySelector('.me-stage-wrap');
            var _float = document.getElementById('meCutlineFloat');
            var _wantSide = !!(_hasCutlineActive && _wrap && window.innerWidth >= 820);
            if (_wantSide && _wrap) {
                if (!_float) {
                    _float = document.createElement('div');
                    _float.id = 'meCutlineFloat';
                    _float.className = 'me-cutline-float';
                    _wrap.appendChild(_float);
                }
                _float.innerHTML = '';
                panel.querySelectorAll('.me-cf-group').forEach(function(g){ _float.appendChild(g); });
                _float.style.display = _float.children.length ? 'flex' : 'none';
                _wrap.classList.add('me-has-side');
            } else {
                if (_float) { _float.innerHTML = ''; _float.style.display = 'none'; }
                if (_wrap) _wrap.classList.remove('me-has-side');
            }
            if (_wantSide !== !!panel._meSideOn) {
                panel._meSideOn = _wantSide;
                if (typeof _meFitStage === 'function') { try { _meFitStage(); } catch(_fe){} }
            }
        } catch(_sp){}
        // 2026-06-15: 상단 chip 의 value/tooltip 을 현재 선택에 동기화.
        try { if (typeof window._meSyncBgChip === 'function') window._meSyncBgChip(); } catch(_) {}
    }

    function _meBindDrag(it) {
        var dragging = false, sx = 0, sy = 0, sLeft = 0, sTop = 0;
        it.el.addEventListener('contextmenu', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            _meSelect(it);
            _meShowCtxMenu(ev.clientX, ev.clientY, it);
        });
        // 2026-06-14: 편집 모드 중에도 드래그 가능 — 손가락 10px 이상 움직이면 편집 종료 + 드래그 전환
        var _pendingDrag = false;  // 편집 중 pointerdown — drag 후보 상태
        it.el.addEventListener('pointerdown', function(ev){
            if (ev.target.classList && (ev.target.classList.contains('me-handle') || ev.target.classList.contains('me-del'))) return;
            if (ev.button === 2) return;
            // 2026-06-17 v539: 템플릿 슬롯 — 위치/크기 잠금. 드래그 차단.
            if (it._isTemplateSlot) return;
            // 2026-06-18 v610: SVG import 배경 — 잠긴 상태에선 선택/드래그 모두 차단.
            if (it._isBackground) { ev.preventDefault(); return; }
            var isEditing = it.el.getAttribute('contenteditable') === 'true';
            sx = ev.clientX; sy = ev.clientY;
            sLeft = it.x; sTop = it.y;
            if (isEditing) {
                // 2026-06-19 v621: 편집 모드 중엔 박스 드래그 전면 차단 — 텍스트 드래그-선택(Illustrator 식) 가능하게.
                //   박스 이동은 편집 종료(외부 클릭/Esc) 후에만. 이전 _pendingDrag 임계값 방식은 부분 드래그 선택 막음.
                return;
            }
            _meSnapshot();
            dragging = true;
            it.el.setPointerCapture(ev.pointerId);
            _meSelect(it);
            ev.preventDefault();
        });
        it.el.addEventListener('pointermove', function(ev){
            // v621: 편집 중 박스 드래그 전환 제거 — 텍스트 드래그-선택을 위해 편집 종료까지 드래그 비활성.
            if (!dragging) return;
            var dx = (ev.clientX - sx) / me.wScale;
            var dy = (ev.clientY - sy) / me.wScale;
            it.x = sLeft + dx;
            it.y = sTop + dy;
            _meDragSnap(it);
            _meSyncItemDisplay(it);
        });
        it.el.addEventListener('pointerup', function(ev){
            _pendingDrag = false;
            dragging = false;
            _meHideGuides();
            try { it.el.releasePointerCapture(ev.pointerId); } catch(e){}
        });
        it.el.addEventListener('pointercancel', function(){
            _pendingDrag = false; dragging = false; _meHideGuides();
        });
        if (it.type === 'text') {
            // 2026-06-19 v629: 인라인 contenteditable → 모달 입력. 모바일/번역기 복붙 호환성 + 흰배경 문제 영구 해결.
            //   탭/클릭 패턴은 그대로 (첫 탭: 선택, 두 번째 탭/dblclick: 모달 오픈).
            var _lastClickTime = 0;
            var _tapStart = null;
            var _wasSelectedBefore = false;
            it.el.addEventListener('pointerdown', function(ev){
                _wasSelectedBefore = (me.selected === it);
                _tapStart = { x: ev.clientX, y: ev.clientY, t: Date.now() };
            }, true);
            it.el.addEventListener('pointerup', function(ev){
                if (!_tapStart) return;
                var dx = ev.clientX - _tapStart.x, dy = ev.clientY - _tapStart.y;
                var dist = Math.sqrt(dx*dx + dy*dy);
                var dt = Date.now() - _tapStart.t;
                _tapStart = null;
                if (dist > 8 || dt > 500) return;
                if (_wasSelectedBefore) {
                    var now = Date.now();
                    _lastClickTime = now;
                    setTimeout(function(){
                        if (_lastClickTime === now) {
                            if (it._isQr && window._meAddQR) window._meAddQR(it);  // 2026-06-25: QR 두 번째 탭 → 주소 수정
                            else _meOpenTextEditModal(it);
                        }
                    }, 0);
                }
            }, true);
            it.el.addEventListener('dblclick', function(){
                if (it._isBackground) return;
                if (it._isQr && window._meAddQR) { window._meAddQR(it); return; }  // 2026-06-25: QR 더블클릭 → 주소 수정
                _meOpenTextEditModal(it);
            });
            it.el.addEventListener('blur', function(){
                it.el.removeAttribute('contenteditable');
                it.el.removeAttribute('inputmode');
                it.text = (it.el.innerText !== undefined) ? it.el.innerText : (it.el.textContent || '');
            });
            // 편집 중 Escape 로 편집 종료
            it.el.addEventListener('keydown', function(ev){
                if (it.el.getAttribute('contenteditable') !== 'true') return;
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    it.el.blur();
                }
            });
            // 2026-06-19 v628: 외부 사이트(번역기 등) 에서 복사한 텍스트의 인라인 스타일(흰 배경/다른 폰트/색) 제거.
            //   paste 시점에 clipboard.getData('text/plain') 으로 순수 텍스트만 가로채서 삽입 → 텍스트 항목의 기존 스타일 유지.
            it.el.addEventListener('paste', function(ev){
                if (it.el.getAttribute('contenteditable') !== 'true') return;
                ev.preventDefault();
                var txt = '';
                try { txt = (ev.clipboardData || window.clipboardData).getData('text/plain') || ''; } catch(_pe){ txt = ''; }
                if (!txt) return;
                // 줄바꿈 정규화 (CRLF → LF)
                txt = txt.replace(/\r\n?/g, '\n');
                // 현재 selection 위치에 삽입 (다중 줄은 <br> 로 변환)
                try {
                    var sel = window.getSelection();
                    if (!sel || sel.rangeCount === 0) {
                        it.el.appendChild(document.createTextNode(txt));
                        return;
                    }
                    sel.deleteFromDocument();
                    var range = sel.getRangeAt(0);
                    var parts = txt.split('\n');
                    var frag = document.createDocumentFragment();
                    parts.forEach(function(p, i){
                        if (i > 0) frag.appendChild(document.createElement('br'));
                        frag.appendChild(document.createTextNode(p));
                    });
                    range.insertNode(frag);
                    // 캐럿을 삽입 끝으로 이동
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch(_pe2) {
                    // 폴백 — execCommand 사용 (구버전 브라우저)
                    try { document.execCommand('insertText', false, txt); } catch(_){}
                }
            });
            // 2026-06-19 v625: 편집 중 글자 수 변동 시 box 자동 fit (X 버튼이 텍스트 옆 빈 공간에 떠있는 문제 해결).
            //   edge-resized 폭이 새 글자보다 넓을 때 _edgeResized 해제 → width:max-content 가 재활성화돼 박스가 텍스트에 fit.
            it.el.addEventListener('input', function(){
                if (it.el.getAttribute('contenteditable') !== 'true') return;
                if (it._edgeResized) {
                    it._edgeResized = false;
                    it.el.style.width = '';
                    it.el.style.maxWidth = '';
                    it.el.style.height = '';
                    _meSyncItemDisplay(it);
                }
            });
        }
    }

    // 2026-06-14: 4 모서리 정비율 리사이즈. corner = 'nw'|'ne'|'sw'|'se'
    function _meBindResize(handle, it, corner) {
        corner = corner || 'se';
        var resizing = false, sx = 0, sy = 0, sw = 0, sh = 0, sX = 0, sY = 0, sFont = 0, sRatio = 1;
        handle.addEventListener('pointerdown', function(ev){
            ev.stopPropagation(); ev.preventDefault();
            _meSnapshot();
            resizing = true;
            handle.setPointerCapture(ev.pointerId);
            sx = ev.clientX; sy = ev.clientY;
            sw = it.w; sh = it.h; sX = it.x; sY = it.y; sFont = it.fontSize || 0;
            sRatio = (sh > 0) ? (sh / sw) : 1;
        });
        handle.addEventListener('pointermove', function(ev){
            if (!resizing) return;
            var dx = (ev.clientX - sx) / me.wScale;
            var dy = (ev.clientY - sy) / me.wScale;
            // 2026-06-16: 변(edge) 핸들 — 단일 축 자유 리사이즈 (정비율 X, fontSize 유지)
            //   e: dx 만 적용 (우측 늘리기).  w: dx 반전 + x 앵커 이동.
            //   n: dy 반전 + y 앵커 이동.    s: dy 만 적용.
            // 2026-07-11: 객체크기 모드(칼선 객체)에선 변(edge) 핸들도 정비율 — 실물 비율 고정.
            var isEdge = (corner === 'n' || corner === 's' || corner === 'e' || corner === 'w')
                && !(window._meObjSizeMode && it && it._cutlineRelPts);
            if (isEdge) {
                // v621: 최소 20px → 6px — 텍스트 박스 더 좁게 줄일 수 있도록
                var newW2 = sw, newH2 = sh;
                if (corner === 'e') newW2 = Math.max(6, sw + dx);
                if (corner === 'w') { newW2 = Math.max(6, sw - dx); it.x = sX + (sw - newW2); }
                if (corner === 's') newH2 = Math.max(6, sh + dy);
                if (corner === 'n') { newH2 = Math.max(6, sh - dy); it.y = sY + (sh - newH2); }
                it.w = newW2; it.h = newH2;
                // 2026-06-16: edge 리사이즈 후엔 width:max-content auto-shrink 끄고 고정 폭 유지.
                if (it.type === 'text') it._edgeResized = true;
                _meSyncItemDisplay(it);
                return;
            }
            // 정비율 — 모서리 별 delta 부호 결정
            //   nw: 좌상단 — dx,dy 감소시 커짐. 신규 w = sw - dx, h = sh - dy → ratio 맞추기.
            //   se: 우하단 — dx,dy 증가시 커짐. 신규 w = sw + dx.
            //   ne: 우상단. sw: 좌하단.
            // 큰 변의 변화량으로 정비율 결정
            var signX = (corner === 'nw' || corner === 'sw') ? -1 : 1;
            var signY = (corner === 'nw' || corner === 'ne') ? -1 : 1;
            var newW = Math.max(6, sw + dx * signX);
            var newH = Math.max(6, newW * sRatio);  // 정비율
            // 앵커(반대 모서리) 고정
            if (signX < 0) it.x = sX + (sw - newW);
            if (signY < 0) it.y = sY + (sh - newH);
            it.w = newW; it.h = newH;
            // 텍스트는 fontSize 도 비례
            if (it.type === 'text' && sw > 0) {
                it.fontSize = Math.max(6, sFont * (newW / sw));
                var fInp = document.querySelector('#meProps [data-mp="fontSize"]');
                if (fInp) fInp.value = Math.round(it.fontSize);
            }
            _meSyncItemDisplay(it);
        });
        handle.addEventListener('pointerup', function(ev){
            resizing = false;
            try { handle.releasePointerCapture(ev.pointerId); } catch(e){}
            // 2026-07-11: 리사이즈 종료 시 캔버스를 객체 크기에 맞게 자동조정(잘림 방지·정밀도)
            if (window._meObjSizeMode && it && it._cutlineRelPts) { try { _meFitStandeeCanvas(); } catch(_){} }
        });
    }

    // 2026-06-14: 회전 핸들 — item 중앙 기준 mouse angle 계산
    function _meBindRotate(handle, it) {
        var rotating = false, cx = 0, cy = 0, startAngle = 0, startRot = 0;
        handle.addEventListener('pointerdown', function(ev){
            ev.stopPropagation(); ev.preventDefault();
            _meSnapshot();
            rotating = true;
            handle.setPointerCapture(ev.pointerId);
            // 화면상 item 중심 좌표
            var rect = it.el.getBoundingClientRect();
            cx = rect.left + rect.width / 2;
            cy = rect.top + rect.height / 2;
            startAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
            startRot = it.rotation || 0;
            handle.style.cursor = 'grabbing';
        });
        handle.addEventListener('pointermove', function(ev){
            if (!rotating) return;
            var ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
            var delta = ang - startAngle;
            var newRot = startRot + delta;
            // Shift 시 15° 스냅
            if (ev.shiftKey) newRot = Math.round(newRot / 15) * 15;
            // -180 ~ 180 정규화
            while (newRot > 180) newRot -= 360;
            while (newRot < -180) newRot += 360;
            it.rotation = newRot;
            _meSyncItemDisplay(it);
        });
        handle.addEventListener('pointerup', function(ev){
            rotating = false;
            handle.style.cursor = 'grab';
            try { handle.releasePointerCapture(ev.pointerId); } catch(e){}
        });
    }

    window._meAddShape = function(shape) {
        _meSnapshot();
        var el = document.createElement('div');
        el.className = 'me-item shape' + (shape === 'circle' ? ' circle' : '');
        el.style.zIndex = (++me.zCounter);
        me.stage.appendChild(el);
        // 2026-06-17 v538: star 도 정사각형(w=h) 기본 — circle 과 동일 비율.
        var isSquareDefault = (shape === 'circle' || shape === 'star');
        var w = me.natW * 0.3, h = (isSquareDefault ? w : me.natH * 0.15);
        var defaultFill = (shape === 'circle') ? '#7c3aed' : (shape === 'star') ? '#f59e0b' : '#fbbf24';
        var it = {
            el: el, type: 'shape', shape: shape,
            x: (me.natW - w) / 2, y: (me.natH - h) / 2,
            w: w, h: h,
            fill: defaultFill,
            stroke: '#000000', strokeWidth: 0
        };
        me.items.push(it);
        _meSyncItemDisplay(it);
        _meBindDrag(it);
        _meSelect(it);
    };
    // 2026-06-15: 도형 단일 버튼 — 클릭마다 rect / circle 토글.
    // 2026-06-17 v538: 분리된 3버튼 (네모/동그라미/별) 으로 변경 — Cycle 함수는 호환성 위해 유지하되 미사용.
    var _meShapeCycle = 'rect';
    window._meAddShapeCycle = function() {
        window._meAddShape(_meShapeCycle);
        _meShapeCycle = (_meShapeCycle === 'rect') ? 'circle' : 'rect';
    };
    // 2026-06-17: 오려내기 (가벽 구멍) — 검정 사각형 (대지 외부와 같은 색). 추가옵션 "오려내기" 체크 시 호출.
    //   shape='rect' 와 동일하지만 isCutout 태그 + 검정 fill. 일반 도형 cycle 에 영향 없음.
    //   여러 번 추가 가능 (가벽에 구멍 여러 개 가능).
    window._meAddCutout = function() {
        _meSnapshot();
        var el = document.createElement('div');
        el.className = 'me-item shape';
        el.style.zIndex = (++me.zCounter);
        me.stage.appendChild(el);
        var w = me.natW * 0.2, h = me.natH * 0.2;
        var it = {
            el: el, type: 'shape', shape: 'rect',
            x: (me.natW - w) / 2, y: (me.natH - h) / 2,
            w: w, h: h,
            fill: '#000000', stroke: '#000000', strokeWidth: 0,
            isCutout: true   // export / 작업지시서에서 구분
        };
        me.items.push(it);
        _meSyncItemDisplay(it);
        _meBindDrag(it);
        _meSelect(it);
        return it;
    };
    // 2026-06-17: 모든 오려내기 사각형 제거 (체크박스 해제 시).
    window._meRemoveCutouts = function() {
        if (!me || !me.items) return;
        var remaining = [];
        me.items.forEach(function(it){
            if (it && it.isCutout) { try { it.el.remove(); } catch(_){} return; }
            remaining.push(it);
        });
        me.items = remaining;
    };
    // 2026-06-17: 선반 — 흰색 + 빨강 테두리. count = 선반 갯수 (단). 각 선반은 독립 드래그 가능.
    //   실제 mm 입력 → me.natWMm (실제 가벽 mm 폭) 으로 natW(capped 1200px) 단위로 변환.
    //   예: 가벽 3300mm, natW=1200 → ratio 0.364. 입력 100cm(1000mm) → 364 natW 단위 (= 가벽의 30%).
    //   가벽이 아니거나 natWMm 미설정이면 비율 1 (변환 없음).
    window._meAddShelf = function(widthCm, count) {
        _meSnapshot();
        widthCm = Math.max(10, parseInt(widthCm, 10) || 100);
        count = Math.max(1, parseInt(count, 10) || 1);
        // 기존 선반 모두 제거 후 새로 그림 (popup 재호출 시 깔끔하게 갱신)
        try { window._meRemoveShelves(); } catch(_e){}
        var ratioW = (me.natWMm && me.natWMm > 0) ? (me.natW / me.natWMm) : 1;
        var ratioH = (me.natHMm && me.natHMm > 0) ? (me.natH / me.natHMm) : 1;
        var realMmW = widthCm * 10;            // 사용자 입력 폭 (실제 mm)
        var realMmH = 30;                       // 실제 3cm = 30mm 두께
        var w = realMmW * ratioW;               // natW 단위로 변환
        var h = realMmH * ratioH;               // natW 단위로 변환 (작아질 수 있음)
        if (w > me.natW * 0.95) w = me.natW * 0.95;
        if (h < 4) h = 4;                       // 픽셀상 최소 4px (드래그 가능 보장)
        var topMargin = me.natH * 0.2;
        var bottomMargin = me.natH * 0.1;
        var range = me.natH - topMargin - bottomMargin - h;
        var step = count > 1 ? range / (count - 1) : 0;
        var added = [];
        for (var i = 0; i < count; i++) {
            var el = document.createElement('div');
            el.className = 'me-item shape';
            el.style.zIndex = (++me.zCounter);
            me.stage.appendChild(el);
            var it = {
                el: el, type: 'shelf', shape: 'shelf',
                shelfCm: widthCm, shelfIdx: i,
                x: (me.natW - w) / 2,
                y: topMargin + step * i,
                w: w, h: h,
                fill: '#ffffff', stroke: '#dc2626', strokeWidth: 2,
                isShelf: true
            };
            me.items.push(it);
            _meSyncItemDisplay(it);
            _meBindDrag(it);
            added.push(it);
        }
        if (added.length) _meSelect(added[added.length - 1]);
        return added;
    };
    window._meRemoveShelves = function() {
        if (!me || !me.items) return;
        var remaining = [];
        me.items.forEach(function(it){
            if (it && it.isShelf) { try { it.el.remove(); } catch(_){} return; }
            remaining.push(it);
        });
        me.items = remaining;
    };
    // 2026-06-16: 외부 (simple_order 의 배경 프리셋) 에서 분할 배경 추가.
    //   opts: { kind:'tb'|'lr'|'3', colors:['#a','#b'] or ['#a','#b','#c'] }
    //   tb: 위 2/3 light + 아래 1/3 dark.   lr: 좌 2/3 + 우 1/3.   3: 좌·중·우 3등분.
    //   각 사각형은 개별 드래그/리사이즈 가능.
    window._meAddSplitBg = function(opts) {
        opts = opts || {};
        var kind = opts.kind || 'tb';
        var colors = opts.colors || ['#fef3c7', '#92400e'];
        _meSnapshot();
        function _mk(fill, x, y, w, h) {
            var el = document.createElement('div');
            el.className = 'me-item shape';
            el.style.zIndex = (++me.zCounter);
            me.stage.appendChild(el);
            var it = { el: el, type: 'shape', shape: 'rect',
                x: x, y: y, w: w, h: h,
                fill: fill, stroke: '#000000', strokeWidth: 0 };
            me.items.push(it);
            _meSyncItemDisplay(it);
            _meBindDrag(it);
            return it;
        }
        var lastIt = null;
        if (kind === 'tb') {
            _mk(colors[0], 0, 0, me.natW, me.natH);
            lastIt = _mk(colors[1], 0, Math.round(me.natH * 2/3), me.natW, Math.round(me.natH / 3));
        } else if (kind === 'lr') {
            _mk(colors[0], 0, 0, me.natW, me.natH);
            lastIt = _mk(colors[1], Math.round(me.natW * 2/3), 0, Math.round(me.natW / 3), me.natH);
        } else if (kind === '3') {
            var w3 = Math.round(me.natW / 3);
            _mk(colors[0], 0,       0, w3, me.natH);
            _mk(colors[1], w3,      0, w3, me.natH);
            lastIt = _mk(colors[2], w3 * 2, 0, me.natW - w3 * 2, me.natH);
        }
        if (lastIt && typeof _meSelect === 'function') _meSelect(lastIt);
    };

    // ─────────────────────── 2026-06-16: 칼선 (die-cut line) ───────────────────────
    //   스티커 전용. 모양 선택 popup → SVG path 생성 → stage 위에 빨강 점선 overlay 로 표시.
    //   간단모양: circle / pill / roundedRect / roundedCorner — 캔버스 꽉 채움.
    //   복잡/팬시: 선택된 이미지의 alpha 윤곽선 추적 (marching-squares) + margin offset → 실제 vector path.
    //   결과는 window._meCutlineSvg = '<svg>…</svg>' 로 저장 → simple_order 가 cart item 에 포함.
    function _meCutlineSvgEl() {
        var s = document.getElementById('meCutlineOverlay');
        if (!s) {
            s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            s.id = 'meCutlineOverlay';
            s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            s.style.cssText = 'position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; z-index:1000;';
            if (me.stage) me.stage.appendChild(s);
        }
        return s;
    }
    // 2026-06-16 v3: 다중 칼선 지원 — 각 item 마다 it._cutlineRelPts 저장.
    //   추가로 me._canvasCutlinePathD = 캔버스 fill simple shape (item 무관).
    //   _meCutlineRenderAll() 이 모든 source 합쳐 하나의 SVG overlay 에 그림.
    function _meCutlineBuildItemPathD(it) {
        if (!it || !it._cutlineRelPts || it._cutlineRelPts.length < 3) return '';
        // 2026-06-17: sharp flag (3rd element) 전달 — _meSmoothClosedPath 가 sharp 점에서 L(line) 사용
        var pts = it._cutlineRelPts.map(function(p){
            return p.length >= 3 ? [it.x + p[0]*it.w, it.y + p[1]*it.h, p[2]] : [it.x + p[0]*it.w, it.y + p[1]*it.h];
        });
        return _meSmoothClosedPath(pts);
    }
    // 2026-07-11: 칼선 안쪽(받침+외곽 여백)을 흰색으로 채우는 바닥 레이어 — 대지 숨김(객체크기 모드)일 때
    //   투명 대지 대신 실제 인쇄물(흰 보드) 색으로 보이게. items 뒤(z-index:0)에 깔림.
    function _meCutlineFillEl() {
        var s = document.getElementById('meCutlineFill');
        if (!s) {
            s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            s.id = 'meCutlineFill';
            s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            s.style.cssText = 'position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; z-index:0;';
            if (me.stage) me.stage.insertBefore(s, me.stage.firstChild);
        }
        return s;
    }
    // 2026-07-14: 재단 가이드 — 작업사이즈(대지) 안의 재단선을 빨강 점선으로 표시(시각용, export/PDF 제외).
    //   팬시 시트(작업 140×210 / 재단 138×208) 등. cutWmm=0 이면 제거.
    window._meSetTrimGuideMm = function(cutWmm, cutHmm) {
        var s = document.getElementById('meTrimGuide');
        if (!cutWmm || !cutHmm) { me._trimGuideMm = null; if (s) s.remove(); return; }
        if (!s) {
            s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            s.id = 'meTrimGuide';
            s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            s.style.cssText = 'position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; z-index:999;';
            if (me.stage) me.stage.appendChild(s);
        }
        me._trimGuideMm = { w: cutWmm, h: cutHmm };
        _meRenderTrimGuide();
        return s;
    };
    function _meRenderTrimGuide() {
        var s = document.getElementById('meTrimGuide');
        if (!s || !me._trimGuideMm) return;
        var workWmm = me.natWMm || (me.natW / 3.7795);
        var workHmm = me.natHMm || (me.natH / 3.7795);
        var cw = me._trimGuideMm.w, ch = me._trimGuideMm.h;
        // 재단 rect 를 작업(대지) 중앙에 — 자연좌표(px) 변환.
        var insetXmm = Math.max(0, (workWmm - cw) / 2), insetYmm = Math.max(0, (workHmm - ch) / 2);
        var x = (insetXmm / workWmm) * me.natW, y = (insetYmm / workHmm) * me.natH;
        var w = (cw / workWmm) * me.natW, h = (ch / workHmm) * me.natH;
        var sw = Math.max(1, me.natW / 500);
        s.setAttribute('viewBox', '0 0 ' + me.natW + ' ' + me.natH);
        s.innerHTML = '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="none" stroke="#ef4444" stroke-width="' + sw.toFixed(2) + '" stroke-dasharray="' + (sw*3).toFixed(1) + ' ' + (sw*2).toFixed(1) + '" stroke-opacity="0.55"/>';
    }
    // 대지 크기 변경 시 재단 가이드도 재계산 (있을 때만).
    window._meRenderTrimGuide = _meRenderTrimGuide;
    function _meCutlineRenderAll() {
        var svg = _meCutlineSvgEl();
        svg.setAttribute('viewBox', '0 0 ' + me.natW + ' ' + me.natH);
        var paths = [];          // path d 문자열 (마스크·export 용)
        var shapeCutPaths = [];  // 조정 가능한 도형 칼선 { d, it } — 점선 클릭으로 선택/드래그
        // 각 item 의 칼선
        (me.items || []).forEach(function(it){
            var d = _meCutlineBuildItemPathD(it);
            if (d) {
                paths.push(d);
                if (it._isShapeCutline) shapeCutPaths.push({ d: d, it: it });
            }
        });
        // 캔버스-fill simple shape
        if (me._canvasCutlinePathD) paths.push(me._canvasCutlinePathD);
        // 흰색(=보드색) 바닥 fill (객체크기 모드 = 대지 숨김일 때만) — 받침+외곽 여백이 실제 보드색으로 보이게
        var fillEl = _meCutlineFillEl();
        if (window._meObjSizeMode && paths.length) {
            var _board = window._meBoardColor || '#ffffff';
            fillEl.setAttribute('viewBox', '0 0 ' + me.natW + ' ' + me.natH);
            fillEl.innerHTML = paths.map(function(d){ return '<path d="' + d + '" fill="' + _board + '"/>'; }).join('');
            fillEl.style.display = '';
        } else {
            fillEl.innerHTML = ''; fillEl.style.display = 'none';
        }
        if (!paths.length) { svg.innerHTML = ''; window._meCutlineSvg = null; return; }
        // 2026-07-14: 화면 칼선 = 빨강 점선 (재단선임을 명확히). dash·두께는 캔버스 크기 비례.
        var _sw = Math.max(1.4, me.natW / 460);
        var _dash = (_sw * 3.2).toFixed(1) + ' ' + (_sw * 2.2).toFixed(1);
        var _dashAttr = 'fill="none" stroke="#ef4444" stroke-width="' + _sw.toFixed(2) + '" stroke-dasharray="' + _dash + '" stroke-opacity="0.95" stroke-linejoin="round"';
        if (window._meObjSizeMode) {
            // 2026-07-11: 대지/회색 마스크 없이 — 흰 보드 조각(_meCutlineFill) + 빨간 재단 점선만 표시.
            svg.innerHTML = paths.map(function(d){ return '<path d="' + d + '" ' + _dashAttr + '/>'; }).join('');
        } else {
            // 2026-06-16 v5: 칼선 안쪽 = 디자인 노출(투명), 바깥쪽 = 회색 마스크.
            //   + 2026-07-14: 재단 경계를 빨강 점선으로 오버레이 (모양이 명확히 보이도록).
            var maskPaths = paths.map(function(d){ return '<path d="' + d + '" fill="black"/>'; }).join('');
            var dashLines = paths.map(function(d){ return '<path d="' + d + '" ' + _dashAttr + '/>'; }).join('');
            svg.innerHTML =
                '<defs><mask id="meCutMask">'
              +   '<rect x="0" y="0" width="' + me.natW + '" height="' + me.natH + '" fill="white"/>'
              +   maskPaths
              + '</mask></defs>'
              + '<rect x="0" y="0" width="' + me.natW + '" height="' + me.natH + '" fill="#9ca3af" fill-opacity="0.78" mask="url(#meCutMask)"/>'
              + dashLines;
        }
        // 2026-07-14: 도형 칼선(간단도형)은 점선을 클릭·드래그로 선택/이동 가능 — 투명 넓은 hit path 추가.
        //   (이미지는 별도 선택 → 이미지 위치/크기 조정, 점선은 별도 선택 → 칼선 위치/크기 조정)
        if (shapeCutPaths.length) {
            var _hitW = Math.max(9, me.natW / 55);
            var _svgNS = 'http://www.w3.org/2000/svg';
            shapeCutPaths.forEach(function(sp){
                var hit = document.createElementNS(_svgNS, 'path');
                hit.setAttribute('d', sp.d);
                hit.setAttribute('fill', 'none');
                hit.setAttribute('stroke', 'rgba(0,0,0,0.001)');
                hit.setAttribute('stroke-width', String(_hitW));
                hit.style.pointerEvents = 'stroke';   // 부모 svg 가 pointer-events:none 여도 이 path 는 hit
                hit.style.cursor = 'move';
                svg.appendChild(hit);
                _meBindShapeCutlinePointer(hit, sp.it);
            });
        }
        // export 용 — 제작 단계에서 칼선은 빨강 0.3 실선으로 저장.
        window._meCutlineSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + me.natW + ' ' + me.natH + '">'
            + paths.map(function(d){ return '<path d="' + d + '" fill="none" stroke="#FF0000" stroke-width="0.3"/>'; }).join('')
            + '</svg>';
    }
    // 2026-07-14: 도형 칼선 점선(hit path) 을 눌러 해당 칼선 item 선택 + 드래그 이동.
    //   드래그 중 _meSyncItemDisplay 가 _meCutlineRenderAll 을 재호출해 hit path 를 재생성하지만,
    //   pointermove/up 은 window 에 걸려 있어 끊기지 않음.
    function _meBindShapeCutlinePointer(pathEl, it) {
        pathEl.addEventListener('pointerdown', function(ev){
            if (ev.button === 2) return;
            ev.preventDefault(); ev.stopPropagation();
            _meSnapshot();
            _meSelect(it);
            var sx = ev.clientX, sy = ev.clientY, sLeft = it.x, sTop = it.y;
            function mv(e){
                var dx = (e.clientX - sx) / me.wScale;
                var dy = (e.clientY - sy) / me.wScale;
                it.x = sLeft + dx; it.y = sTop + dy;
                try { _meDragSnap(it); } catch(_){}
                _meSyncItemDisplay(it);
            }
            function up(){
                window.removeEventListener('pointermove', mv);
                window.removeEventListener('pointerup', up);
                try { _meHideGuides(); } catch(_){}
            }
            window.addEventListener('pointermove', mv);
            window.addEventListener('pointerup', up);
        });
    }
    // legacy shim — 기존 호출자 (simple shape 등) 는 d 를 _canvasCutlinePathD 로 저장 후 render all
    function _meCutlineRender(pathD) {
        me._canvasCutlinePathD = pathD;
        me._cutlinePathD = pathD;
        _meCutlineRenderAll();
    }
    // 2026-06-16 v5: Chaikin corner-cutting — 닫힌 polygon 의 각 segment 를 1/4·3/4 점으로 치환.
    //   1회 적용 시 N → 2N 점, 코너 둥글어짐. trace 의 raw silhouette 노이즈와 offset 후 kink 제거에 유용.
    function _meChaikin(pts, iterations) {
        iterations = iterations || 1;
        var cur = pts;
        for (var it = 0; it < iterations; it++) {
            var n = cur.length;
            var sm = [];
            for (var i = 0; i < n; i++) {
                var p = cur[i], q = cur[(i + 1) % n];
                sm.push([p[0] + 0.25*(q[0]-p[0]), p[1] + 0.25*(q[1]-p[1])]);
                sm.push([p[0] + 0.75*(q[0]-p[0]), p[1] + 0.75*(q[1]-p[1])]);
            }
            cur = sm;
        }
        return cur;
    }
    // 2026-06-16 v6: Box (moving-average) low-pass — radius=k 이면 2k+1 점 평균.
    //   silhouette 픽셀 노이즈 (찌글거림) 를 평균화로 거의 완전히 제거. Chaikin 만으로 부족할 때 보강.
    function _meBoxSmooth(pts, radius) {
        radius = radius || 3;
        var n = pts.length;
        var out = [];
        for (var i = 0; i < n; i++) {
            var sx = 0, sy = 0, c = 0;
            for (var k = -radius; k <= radius; k++) {
                var idx = ((i + k) % n + n) % n;
                sx += pts[idx][0]; sy += pts[idx][1]; c++;
            }
            out.push([sx/c, sy/c]);
        }
        return out;
    }
    // 2026-06-16: 부드러운 path — quadratic Bézier midpoint smoothing.
    //   각 sample 정점을 control point 로, 두 정점의 중점을 곡선 통과 anchor 로 사용 → 코너가 곡선화.
    // 2026-06-17: 점의 3번째 element 가 truthy 이면 sharp → L(line) 사용해 직선 모서리 유지 (등신대 받침대 등).
    function _meSmoothClosedPath(pts) {
        if (!pts || pts.length < 3) {
            if (!pts || !pts.length) return '';
            var d0 = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
            for (var i0 = 1; i0 < pts.length; i0++) d0 += ' L ' + pts[i0][0].toFixed(1) + ' ' + pts[i0][1].toFixed(1);
            return d0 + ' Z';
        }
        function isSharp(p) { return p && p.length >= 3 && p[2]; }
        var n = pts.length;
        // 모두 smooth 라면 기존 경로 빠른 처리
        var anySharp = false;
        for (var k = 0; k < n; k++) if (isSharp(pts[k])) { anySharp = true; break; }
        if (!anySharp) {
            var mx0 = (pts[0][0] + pts[1][0]) / 2;
            var my0 = (pts[0][1] + pts[1][1]) / 2;
            var d = 'M ' + mx0.toFixed(1) + ' ' + my0.toFixed(1);
            for (var i = 1; i < n; i++) {
                var ni = (i + 1) % n;
                var mx = (pts[i][0] + pts[ni][0]) / 2;
                var my = (pts[i][1] + pts[ni][1]) / 2;
                d += ' Q ' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
            }
            return d + ' Z';
        }
        // sharp + smooth 혼합 — sharp 점은 L(직선), smooth 점은 Q(곡선)
        // 시작점: pts[0] 이 sharp 면 그 점에서, 아니면 pts[0]·pts[1] 중점에서
        var d2;
        if (isSharp(pts[0])) {
            d2 = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
        } else {
            var sm0x = (pts[0][0] + pts[1][0]) / 2;
            var sm0y = (pts[0][1] + pts[1][1]) / 2;
            d2 = 'M ' + sm0x.toFixed(1) + ' ' + sm0y.toFixed(1);
        }
        for (var j = 1; j <= n; j++) {
            var cur = pts[j % n];
            var nxt = pts[(j + 1) % n];
            if (isSharp(cur)) {
                d2 += ' L ' + cur[0].toFixed(1) + ' ' + cur[1].toFixed(1);
            } else {
                var mx2 = (cur[0] + nxt[0]) / 2;
                var my2 = (cur[1] + nxt[1]) / 2;
                d2 += ' Q ' + cur[0].toFixed(1) + ' ' + cur[1].toFixed(1) + ' ' + mx2.toFixed(1) + ' ' + my2.toFixed(1);
            }
        }
        d2 += ' Z';
        return d2;
    }
    window._meCutlineClear = function() {
        // 전체 클리어 — 모든 item 의 칼선 + 캔버스 fill
        (me.items || []).forEach(function(it){ it._cutlineRelPts = null; it._cutlineMode = null; });
        me._canvasCutlinePathD = null;
        me._cutlinePathD = null;
        var s = document.getElementById('meCutlineOverlay');
        if (s) s.remove();
        window._meCutlineSvg = null;
    };
    // 2026-06-16 v7: SVG path 의 anchor 점들 추출 (M·Q·L 끝점만, control point 는 skip).
    // 2026-06-17: 3번째 element 로 sharp flag — L 명령으로 들어온 점은 sharp(1), Q 명령은 smooth(0).
    //   PDF 생성 시 sharp 점에선 직선, smooth 점에선 곡선 으로 분기 그릴 수 있도록 정보 보존.
    function _meExtractPathAnchors(d) {
        var tokens = (d || '').match(/[MLQZmlqz]|-?\d*\.?\d+/g) || [];
        var pts = [];
        var i = 0;
        while (i < tokens.length) {
            var c = tokens[i];
            if (c === 'L' || c === 'l') {
                pts.push([parseFloat(tokens[i+1]), parseFloat(tokens[i+2]), 1]);
                i += 3;
            } else if (c === 'M' || c === 'm') {
                pts.push([parseFloat(tokens[i+1]), parseFloat(tokens[i+2]), 0]);
                i += 3;
            } else if (c === 'Q' || c === 'q') {
                pts.push([parseFloat(tokens[i+3]), parseFloat(tokens[i+4]), 0]);
                i += 5;
            } else { i++; }
        }
        return pts;
    }
    // Douglas-Peucker — 곡선 따라 anchor 점 수를 epsilon 거리 내로 단순화.
    //   결과: 1900+ 점 → 50~150 점. 일러스트레이터 anchor 가 깔끔 + 커팅머신이 부드럽게 따라감.
    function _meRdp(pts, eps) {
        if (pts.length < 3) return pts.slice();
        function pd(p, a, b) {
            var dx = b[0]-a[0], dy = b[1]-a[1];
            var L = Math.hypot(dx, dy);
            if (L < 0.0001) return Math.hypot(p[0]-a[0], p[1]-a[1]);
            return Math.abs((dy*p[0] - dx*p[1] + b[0]*a[1] - b[1]*a[0]) / L);
        }
        // 2026-06-17: sharp 점은 항상 보존 — 직각 모서리 (등신대 받침대 등) 가 RDP 단순화로 사라지지 않게.
        function isSharp(p) { return p && p.length >= 3 && p[2]; }
        function rec(s, e) {
            if (e <= s + 1) return [pts[s], pts[e]];
            var maxD = 0, idx = s + 1;
            // sharp 점이 구간 내 있으면 무조건 그 점을 분할점으로 (거리와 무관하게)
            for (var i = s+1; i < e; i++) {
                if (isSharp(pts[i])) { maxD = Infinity; idx = i; break; }
            }
            if (maxD < Infinity) {
                for (var i = s+1; i < e; i++) {
                    var d = pd(pts[i], pts[s], pts[e]);
                    if (d > maxD) { maxD = d; idx = i; }
                }
            }
            if (maxD > eps) {
                var L = rec(s, idx), R = rec(idx, e);
                return L.slice(0, -1).concat(R);
            }
            return [pts[s], pts[e]];
        }
        return rec(0, pts.length - 1);
    }
    // 2026-06-16 v7: 칼선 PDF — 이미지 + vector cutline 모두 단일 파일에 embed.
    //   opts: { widthMm, heightMm, imageDataUrl }
    //   widthMm/heightMm 안 주면 me.natW/H 를 96dpi 환산 (legacy 동작).
    //   imageDataUrl 주면 페이지 전체에 raster 로 배경 깔고 그 위에 칼선 vector.
    window._meCutlineAsPdfBlob = async function(opts) {
        opts = opts || {};
        if (!window._meCutlineSvg) return null;
        // jsPDF 로드 보장
        if (!window.jspdf) {
            try {
                if (typeof window.loadEditorLibraries === 'function') await window.loadEditorLibraries();
            } catch (e) {}
        }
        if (!window.jspdf) {
            try {
                await new Promise(function(res, rej){
                    var s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    s.onload = res; s.onerror = function(){ rej(new Error('jsPDF load fail')); };
                    document.head.appendChild(s);
                });
            } catch (e) { console.warn('[cutline pdf] jsPDF load failed', e); return null; }
        }
        var jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF) return null;
        var PX_PER_MM = 3.7795;
        // 2026-06-16 v13: me.natWMm/HMm 가 있으면 우선 — 가벽 등 capped pixel canvas 에서 정확한 mm.
        var widthMm  = Math.max(10, opts.widthMm  || me.natWMm || (me.natW / PX_PER_MM));
        var heightMm = Math.max(10, opts.heightMm || me.natHMm || (me.natH / PX_PER_MM));
        var doc = new jsPDF({
            orientation: widthMm > heightMm ? 'l' : 'p',
            unit: 'mm',
            format: [widthMm, heightMm],
            compress: true
        });
        // 배경 이미지 (디자인 PNG) — 페이지 전체에 깔기
        if (opts.imageDataUrl && typeof opts.imageDataUrl === 'string' && opts.imageDataUrl.indexOf('data:image') === 0) {
            try {
                var fmt = /^data:image\/jpe?g/.test(opts.imageDataUrl) ? 'JPEG' : 'PNG';
                doc.addImage(opts.imageDataUrl, fmt, 0, 0, widthMm, heightMm);
            } catch (e) { console.warn('[cutline pdf] addImage', e); }
        }
        doc.setDrawColor(255, 0, 0);
        doc.setLineWidth(0.15);
        // 캔버스 자연좌표 → mm scale
        var SX = widthMm / me.natW;
        var SY = heightMm / me.natH;
        // 단순화된 anchor → smooth cubic Bézier (jsPDF lines) — 중점 anchor 통과, 정점은 control point 로 사용.
        // 2026-06-17: sharp 점 (받침대 corner 등) 은 직선 segment 로 렌더 — 곡선화 방지.
        function _drawSimplifiedSmoothPdf(pts) {
            if (!pts || pts.length < 3) return;
            var n = pts.length;
            function isSharp(p) { return p && p.length >= 3 && p[2]; }
            // 시작점: pts[0] 이 sharp 면 그 점, 아니면 pts[0]·pts[1] 중점
            var startX, startY;
            if (isSharp(pts[0])) {
                startX = pts[0][0] * SX; startY = pts[0][1] * SY;
            } else {
                var mx0 = (pts[0][0] + pts[1][0]) / 2;
                var my0 = (pts[0][1] + pts[1][1]) / 2;
                startX = mx0 * SX; startY = my0 * SY;
            }
            var curX = startX, curY = startY;
            var lines = [];
            for (var i = 1; i <= n; i++) {
                var cur = pts[i % n];
                var nxt = pts[(i + 1) % n];
                if (isSharp(cur)) {
                    // 직선 segment — current 점까지 line
                    var lx = cur[0] * SX, ly = cur[1] * SY;
                    lines.push([lx - curX, ly - curY]);
                    curX = lx; curY = ly;
                } else {
                    // 부드러운 Bezier — Quadratic Q (cur) → (mid) → cubic 변환
                    var mx = (cur[0] + nxt[0]) / 2;
                    var my = (cur[1] + nxt[1]) / 2;
                    var vx = cur[0], vy = cur[1];
                    var endX = mx * SX, endY = my * SY;
                    var c1x = curX + (2/3) * (vx*SX - curX);
                    var c1y = curY + (2/3) * (vy*SY - curY);
                    var c2x = endX + (2/3) * (vx*SX - endX);
                    var c2y = endY + (2/3) * (vy*SY - endY);
                    lines.push([c1x - curX, c1y - curY, c2x - curX, c2y - curY, endX - curX, endY - curY]);
                    curX = endX; curY = endY;
                }
            }
            try { doc.lines(lines, startX, startY, [1, 1], 'S', false); } catch (e) { console.warn('[cutline pdf] lines', e); }
        }
        function _drawPathInPdf(d) {
            var anchors = _meExtractPathAnchors(d);
            if (anchors.length < 3) return;
            // RDP epsilon = 0.5px in source coords ≈ 0.13mm — 부드러우면서 충분히 단순화.
            var simplified = _meRdp(anchors, 0.5);
            console.log('[cutline pdf] anchors:', anchors.length, '→', simplified.length);
            _drawSimplifiedSmoothPdf(simplified);
        }
        // SVG 안의 모든 <path> 에 대해 draw
        try {
            var parser = new DOMParser();
            var svgDoc = parser.parseFromString(window._meCutlineSvg, 'image/svg+xml');
            var paths = svgDoc.querySelectorAll('path');
            paths.forEach(function(pEl){
                var d = pEl.getAttribute('d');
                if (d) _drawPathInPdf(d);
            });
        } catch (e) { console.warn('[cutline pdf] path parse', e); }
        return doc.output('blob');
    };
    // 2026-06-16 v3: 어느 item 이 변하든 전체 다시 그리면 됨 (각 path 가 item 기준 정규좌표라서).
    function _meCutlineResync() { _meCutlineRenderAll(); }
    window._meCutlineResync = _meCutlineResync;
    function _meCutlineSimple(shape) {
        var w = me.natW, h = me.natH;
        var inset = Math.min(w, h) * 0.04;     // 4% 안쪽 — 재단 안전여백
        var x = inset, y = inset, ww = w - inset*2, hh = h - inset*2;
        var d = '';
        if (shape === 'circle') {
            var cx = w/2, cy = h/2, r = Math.min(ww, hh)/2;
            d = 'M ' + (cx-r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx+r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx-r) + ' ' + cy + ' Z';
        } else if (shape === 'pill') {
            var r2 = hh / 2;
            d = 'M ' + (x+r2) + ' ' + y
              + ' L ' + (x+ww-r2) + ' ' + y
              + ' A ' + r2 + ' ' + r2 + ' 0 0 1 ' + (x+ww-r2) + ' ' + (y+hh)
              + ' L ' + (x+r2) + ' ' + (y+hh)
              + ' A ' + r2 + ' ' + r2 + ' 0 0 1 ' + (x+r2) + ' ' + y + ' Z';
        } else if (shape === 'roundedRect') {
            var r3 = Math.min(ww, hh) * 0.12;
            d = 'M ' + (x+r3) + ' ' + y
              + ' L ' + (x+ww-r3) + ' ' + y
              + ' A ' + r3 + ' ' + r3 + ' 0 0 1 ' + (x+ww) + ' ' + (y+r3)
              + ' L ' + (x+ww) + ' ' + (y+hh-r3)
              + ' A ' + r3 + ' ' + r3 + ' 0 0 1 ' + (x+ww-r3) + ' ' + (y+hh)
              + ' L ' + (x+r3) + ' ' + (y+hh)
              + ' A ' + r3 + ' ' + r3 + ' 0 0 1 ' + x + ' ' + (y+hh-r3)
              + ' L ' + x + ' ' + (y+r3)
              + ' A ' + r3 + ' ' + r3 + ' 0 0 1 ' + (x+r3) + ' ' + y + ' Z';
        } else {  // roundedCorner — 모서리 한 곳만 크게 라운드
            var r4 = Math.min(ww, hh) * 0.35;
            d = 'M ' + x + ' ' + y
              + ' L ' + (x+ww) + ' ' + y
              + ' L ' + (x+ww) + ' ' + (y+hh-r4)
              + ' A ' + r4 + ' ' + r4 + ' 0 0 1 ' + (x+ww-r4) + ' ' + (y+hh)
              + ' L ' + x + ' ' + (y+hh)
              + ' Z';
        }
        _meCutlineRender(d);
    }
    // 2026-06-16 v3: 복잡/팬시 — bounding-box 중심 기준 360° ray-cast.
    //   centroid (alpha 평균) 대신 bounding-box 중심 사용 → 위치 정확도 향상 (가벼운 sparkle 등이 무게중심을 끌어당기던 문제 fix).
    //   기존 me._cutlineSource 단일 참조 → 각 item 의 it._cutlineRelPts 로 분산 저장 → 여러 칼선 동시 보존.
    // 2026-06-17: 등신대 베이스 — 발 바닥쪽 컨투어를 잘라내고 평평한 받침대로 교체.
    //   세워둘 때 안정적인 받침이 되도록 양 발 폭보다 약간 넓은 사다리꼴/직사각 base 를 추가.
    //   contour 가 Moore 트레이스 결과로 시계방향 정렬돼 있다는 전제.
    //   baseHeightPct: 받침대 깊이 비율 (hRange 의 몇 % 만큼 maxY 아래로 내려갈지). 기본 0.1 (10%).
    //   baseWidthPct: 받침대 좌우 확장 비율 (footW 의 몇 % 만큼 좌우로 넓어질지). 기본 0.1 (10%).
    // 2026-07-11: 받침 = 객체 중앙에 정렬된 '직사각형(네모)'. 위/아래 슬라이더로 높이·위치 조절.
    //   upPct: 사각형 상단을 객체 안쪽으로 얼마나 올릴지 (hRange 대비). 클수록 받침이 위로 파고들어 틈 없이 붙음.
    //   downPct: 사각형 하단을 객체 바닥 아래로 얼마나 내릴지.
    function _meAddStandeeBase(contour, W, H, upPct, downPct) {
        if (!contour || contour.length < 20) return contour;
        var maxY = 0, minY = H;
        for (var i = 0; i < contour.length; i++) {
            if (contour[i][1] > maxY) maxY = contour[i][1];
            if (contour[i][1] < minY) minY = contour[i][1];
        }
        var hRange = maxY - minY;
        if (hRange < 10) return contour;
        var _up = (upPct != null && isFinite(upPct) && upPct >= 0) ? upPct : 0.12;
        var _down = (downPct != null && isFinite(downPct) && downPct >= 0) ? downPct : 0.10;
        var topY = maxY - hRange * _up;    // 받침 사각형 상단 (객체 실루엣 안쪽)
        var botY = maxY + hRange * _down;  // 받침 사각형 하단
        // 객체 전체 가로 중심·폭 → 받침은 중앙 정렬, 가로 2/3 고정
        var allMinX = W, allMaxX = 0;
        for (var i = 0; i < contour.length; i++) {
            if (contour[i][0] < allMinX) allMinX = contour[i][0];
            if (contour[i][0] > allMaxX) allMaxX = contour[i][0];
        }
        var objCx = (allMinX + allMaxX) / 2;
        var objW = allMaxX - allMinX;
        var _baseHalf = (objW * (2 / 3)) / 2;
        var baseLeftX = Math.max(0, objCx - _baseHalf);
        var baseRightX = Math.min(W, objCx + _baseHalf);
        // topY 아래 구간(bottom-cap)을 순회 — [baseLeftX..baseRightX] '바깥'의 객체 부분은 그대로 유지(위 도형을 파먹지 않음),
        //   가운데 [baseLeftX..baseRightX] 부분만 직사각형 받침(수직 옆선 → botY)으로 채워 union.
        var enterIdx = -1, exitIdx = -1;
        for (var i = 0; i < contour.length; i++) { if (contour[i][1] >= topY) { enterIdx = i; break; } }
        if (enterIdx < 0) return contour;
        for (var i = contour.length - 1; i >= enterIdx; i--) { if (contour[i][1] >= topY) { exitIdx = i; break; } }
        if (exitIdx <= enterIdx) return contour;
        // cap 은 시계방향(오른쪽→왼쪽). 오른쪽에서 x<=baseRightX 로 처음 들어오는 지점(kEnter) / 왼쪽에서 x>=baseLeftX 인 마지막 지점(kExit).
        var kEnter = -1, kExit = -1;
        for (var k = enterIdx; k <= exitIdx; k++) { if (contour[k][0] <= baseRightX) { kEnter = k; break; } }
        for (var k = exitIdx; k >= enterIdx; k--) { if (contour[k][0] >= baseLeftX) { kExit = k; break; } }
        if (kEnter < 0 || kExit < 0 || kExit < kEnter) return contour; // 받침 범위가 객체 밖 → 원본 유지
        var yEnter = contour[kEnter][1];
        var yExit = contour[kExit][1];
        var result = [];
        for (var i = 0; i < kEnter; i++) result.push(contour[i]);      // 위쪽 + 오른쪽(받침보다 넓은 부분) 유지
        result.push([baseRightX, yEnter, 1]);
        result.push([baseRightX, botY, 1]);
        result.push([baseLeftX, botY, 1]);
        result.push([baseLeftX, yExit, 1]);
        for (var i = kExit + 1; i < contour.length; i++) result.push(contour[i]); // 왼쪽(넓은 부분) + 위쪽 유지
        return result;
    }

    // 2026-06-17: Moore neighborhood contour tracing — 실루엣의 오목한 부분 (팔, 다리, 모자 등) 도 정확히 추적.
    //   기존 centroid ray-cast 는 무게중심에서 사방으로 ray 를 쏴 가장 먼 alpha 픽셀을 찾는 방식이라
    //   캐릭터(루피 등)의 팔다리 사이 오목한 곳을 따라가지 못하고 큰 타원으로 끝남.
    //   Moore: 좌상단 boundary 픽셀에서 시작해 8방향 이웃을 시계방향으로 살펴 가며 외곽선을 따라 한 바퀴 돔.
    // 2026-06-17 v526: BFS 로 가장 큰 connected component 의 좌상단에서 시작.
    //   이전엔 단순히 첫 inside 픽셀 — 데코 star/dot 같은 작은 element 가 위에 있으면 그것만 12점 정도 그려져서 실패.
    function _meFindLargestBlobStart(data, W, H, thr) {
        var size = W * H;
        var visited = new Uint8Array(size);
        var queue = new Int32Array(size);
        var largestSize = 0;
        var largestStart = null;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                var idx = y * W + x;
                if (visited[idx]) continue;
                if (data[idx * 4 + 3] <= thr) continue;
                // BFS — 4-connected (상하좌우)
                var head = 0, tail = 0;
                queue[tail++] = idx;
                visited[idx] = 1;
                var compSize = 0;
                var topY = y, topX = x;
                while (head < tail) {
                    var pidx = queue[head++];
                    var py = (pidx / W) | 0, px = pidx - py * W;
                    compSize++;
                    if (py < topY || (py === topY && px < topX)) { topY = py; topX = px; }
                    if (py > 0 && !visited[pidx - W] && data[(pidx - W) * 4 + 3] > thr) { visited[pidx - W] = 1; queue[tail++] = pidx - W; }
                    if (py < H - 1 && !visited[pidx + W] && data[(pidx + W) * 4 + 3] > thr) { visited[pidx + W] = 1; queue[tail++] = pidx + W; }
                    if (px > 0 && !visited[pidx - 1] && data[(pidx - 1) * 4 + 3] > thr) { visited[pidx - 1] = 1; queue[tail++] = pidx - 1; }
                    if (px < W - 1 && !visited[pidx + 1] && data[(pidx + 1) * 4 + 3] > thr) { visited[pidx + 1] = 1; queue[tail++] = pidx + 1; }
                }
                if (compSize > largestSize) {
                    largestSize = compSize;
                    largestStart = [topX, topY, compSize];
                }
            }
        }
        return largestStart;
    }
    function _meTraceContourMoore(data, W, H, thr) {
        // 8방향 (N, NE, E, SE, S, SW, W, NW) — 시계방향
        var DX = [0, 1, 1, 1, 0, -1, -1, -1];
        var DY = [-1, -1, 0, 1, 1, 1, 0, -1];
        function isInside(x, y) {
            if (x < 0 || y < 0 || x >= W || y >= H) return false;
            return data[(y * W + x) * 4 + 3] > thr;
        }
        // 시작점: BFS 로 찾은 가장 큰 connected component 의 topmost-leftmost.
        var start = _meFindLargestBlobStart(data, W, H, thr);
        if (!start) return null;
        var sx = start[0], sy = start[1];
        try { console.log('[cutline trace] start=(' + sx + ',' + sy + ') largestBlob=' + start[2] + 'px'); } catch(_le){}
        // 3) Moore tracing — 정확한 8-neighborhood boundary 추적.
        //   2026-06-17 v527 bug fix:
        //   (a) 초기 prevDir = 0 (N) — topmost 픽셀이라 위에서 진입함 (이전 4=S 는 틀린 가정)
        //   (b) 이동 후 prevDir = (d + 6) % 8 (이전 d+5 는 off-by-one — 작은 blob 에서 oscillate 해 12점 만에 종료)
        //   prevDir 은 "외부 픽셀 C 의 방향" (이전 step 직전 마지막으로 탐색한 outside 픽셀).
        //   d 방향으로 inside 픽셀 B' 발견 시, B' 에서 C 의 방향은 (d-1) 의 회전 보정 = (d+6)%8.
        var contour = [];
        var x = sx, y = sy;
        var prevDir = 0; // 시작 픽셀 위쪽 = outside → "from N"
        var maxSteps = (W + H) * 10;
        var steps = 0;
        // 첫 step 의 이동 방향을 기억 → 같은 위치 + 같은 방향 = 한 바퀴 완료
        var firstDir = -1;
        while (steps++ < maxSteps) {
            contour.push([x, y]);
            var startDir = (prevDir + 1) % 8;
            var found = false;
            for (var k = 0; k < 8; k++) {
                var d = (startDir + k) % 8;
                var nx = x + DX[d], ny = y + DY[d];
                if (isInside(nx, ny)) {
                    if (firstDir < 0) firstDir = d;  // 첫 이동 방향 기록
                    prevDir = (d + 6) % 8;   // C 의 방향 = (d - 1) mod 8 = (d + 6) % 8 (이전 outside 픽셀)
                    x = nx; y = ny;
                    found = true;
                    break;
                }
            }
            if (!found) break;
            // 종료: 시작점 + 시작 방향이 같으면 한 바퀴 완료 (Jacob's stopping criterion)
            if (x === sx && y === sy && contour.length > 4) {
                // 다음 step 의 시작 방향이 firstDir 과 같은지 확인
                var nextStartDir = (prevDir + 1) % 8;
                // 단순 종료: 위치 일치 + 충분히 큰 contour
                if (contour.length > 8) break;
            }
        }
        return contour.length >= 8 ? contour : null;
    }

    async function _meCutlineTrace(mode) {
        mode = mode || 'outer';
        var sel = me.selected;
        if (!sel || sel.type !== 'image') {
            alert('이미지 요소를 먼저 선택해주세요. (복잡모양/팬시 스티커는 업로드한 이미지의 윤곽선을 따라 칼선이 생성됩니다.)');
            return;
        }
        var img = sel.el.querySelector('img');
        if (!img) return;
        // 2026-06-17: 해상도 캡 600→1000 으로 상향 — 미세 디테일(손가락, 모자 챙 등) 추적 정확도 향상.
        var W = Math.max(256, Math.min(1000, Math.round(sel.w)));
        var H = Math.max(256, Math.min(1000, Math.round(sel.h)));
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var ctx = cv.getContext('2d');
        try {
            await new Promise(function(res){ if (img.complete) res(); else img.onload = res; });
            ctx.drawImage(img, 0, 0, W, H);
        } catch(e){ console.warn('[cutline trace draw]', e); }
        var data;
        try { data = ctx.getImageData(0, 0, W, H).data; }
        catch(e){ alert('이미지 윤곽선 추적 실패 — CORS 보호된 이미지입니다.'); return; }
        var THR = 20;   // 2026-06-17: 30→20 으로 복원 — 반투명 alpha 가 있는 이미지 (스티커/이모지 등) trace 실패 해결

        // 2026-06-17: Moore neighborhood 로 윤곽선 추적 — 팔다리 오목한 부분까지 정확히 따라감
        //   참고: 등신대 받침대는 smoothing 이후 _meCutlineApplyOffsetFromCache 에서 추가 (sharp corner 보존).
        var rays = _meTraceContourMoore(data, W, H, THR);
        if (!rays || rays.length < 10) {
            // 폴백: centroid ray-cast (배경이 알파없이 흰색인 PNG 등에서)
            var minX = W, minY = H, maxX = -1, maxY = -1;
            for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
                if (data[(y*W+x)*4 + 3] > THR) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
            if (maxX < 0) { alert('이미지에서 유효한 윤곽선을 찾을 수 없습니다.'); return; }
            var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            var N = 360, fbRays = [], maxR = Math.hypot(W, H);
            for (var k = 0; k < N; k++) {
                var ang = (k / N) * Math.PI * 2;
                var dxr = Math.cos(ang), dyr = Math.sin(ang);
                var lastR = -1;
                for (var r = 0; r < maxR; r += 1) {
                    var px = Math.round(cx + dxr * r);
                    var py = Math.round(cy + dyr * r);
                    if (px < 0 || py < 0 || px >= W || py >= H) break;
                    if (data[(py*W + px)*4 + 3] > THR) lastR = r;
                }
                if (lastR > 0) fbRays.push([cx + dxr * lastR, cy + dyr * lastR]);
            }
            rays = fbRays;
        }
        if (rays.length < 10) { alert('윤곽선을 충분히 추출하지 못했습니다.'); return; }
        // 2026-06-17: 디버그 로그 — 어떤 알고리즘이 몇 점 잡았는지 확인용
        try { console.log('[cutline trace] W=' + W + ' H=' + H + ' THR=' + THR + ' points=' + rays.length + ' mode=' + mode); } catch(_le){}
        // 2026-06-16 v8: 결과를 item 에 캐시 — 슬라이더로 마진 재계산 시 다시 trace 안 함 (즉시 반응).
        sel._cutlineRays = rays;
        sel._cutlineRayW = W;
        sel._cutlineRayH = H;
        sel._cutlineMode = mode;
        // 기본 마진: outer 3% / inner 2%
        var defaultPct = (mode === 'inner') ? 0.02 : 0.03;
        _meCutlineApplyOffsetFromCache(sel, defaultPct);
        // 2026-06-17: trace 직후 props 패널 다시 렌더 → 칼선 간격 슬라이더 즉시 노출
        try { if (typeof _meRenderProps === 'function') _meRenderProps(sel); } catch(_pe){}
    }
    // 2026-06-16 v8: 캐시된 ray-cast 결과 + 마진 % 로 offset 다시 계산 → 슬라이더 실시간 반응.
    //   marginPct: outer 모드에선 양수 (+3% 등), inner 는 음수 (-2% 등). UI 에선 모드는 it._cutlineMode 로 결정.
    function _meCutlineApplyOffsetFromCache(it, marginPct) {
        var rays = it && it._cutlineRays;
        if (!rays || rays.length < 10) return;
        var W = it._cutlineRayW, H = it._cutlineRayH;
        // 부호: inner 면 음수, outer 면 양수. marginPct 자체는 양수 input — 모드별로 sign 결정.
        var sign = (it._cutlineMode === 'inner') ? -1 : 1;
        var marginPx = W * marginPct * sign;
        // smoothing pipeline 동일 (변경 X)
        var smoothRays = _meBoxSmooth(rays, 5);
        smoothRays = _meChaikin(smoothRays, 1);
        var n = smoothRays.length;
        var offsetPts = [];
        for (var i = 0; i < n; i++) {
            var p1 = smoothRays[(i + n - 3) % n], p2 = smoothRays[(i + n + 3) % n];
            var tx = p2[0] - p1[0], ty = p2[1] - p1[1];
            var tLen = Math.hypot(tx, ty);
            var nx, ny;
            if (tLen < 0.001) { nx = smoothRays[i][0]; ny = smoothRays[i][1]; }
            else {
                var ox = ty / tLen, oy = -tx / tLen;
                nx = smoothRays[i][0] + ox * marginPx;
                ny = smoothRays[i][1] + oy * marginPx;
            }
            offsetPts.push([nx, ny]);
        }
        var finalPts = _meBoxSmooth(offsetPts, 3);
        finalPts = _meChaikin(finalPts, 2);
        // 2026-06-17: 등신대 받침대를 smoothing 이후에 추가 — 사각 corner 가 보존되어 바닥이 평평해짐.
        //   이전 (v521-523) 에는 trace 직후 추가 → Chaikin/BoxSmooth 가 받침 corner 를 둥글게 깎아 곡선 바닥.
        //   it._cutlineBaseHeightPct 가 있으면 사용 (슬라이더로 조절), 없으면 기본 10%.
        if (it._cutlineMode === 'outer' && window._meStandeeBase) {
            try { finalPts = _meAddStandeeBase(finalPts, W, H, it._cutlineBaseUpPct, it._cutlineBaseDownPct); } catch(_be){ console.warn('[standee base]', _be); }
        }
        // 2026-06-17: sharp flag(3rd element) 보존 — 등신대 받침대 corner 가 곡선이 아닌 직선으로 렌더되어야 함
        it._cutlineRelPts = finalPts.map(function(p){
            return p.length >= 3 ? [p[0]/W, p[1]/H, p[2]] : [p[0]/W, p[1]/H];
        });
        it._cutlineMarginPct = marginPct;
        _meCutlineRenderAll();
    }
    // 전역 노출 — props 패널 슬라이더에서 호출.
    window._meCutlineSetMargin = function(it, marginPct) {
        _meCutlineApplyOffsetFromCache(it, marginPct);
    };
    // 2026-07-14: 간단도형 스티커 — 선택한 도형(원/타원/귀돌이/다각형/별 등)으로 조정 가능한 칼선 생성.
    //   item-attached 칼선(_cutlineRelPts) 재사용 → 대지에서 드래그·핸들 리사이즈로 위치/크기 조정.
    //   점 생성은 simple_order 의 window._stickerShapePts(kind) 와 공유(미리보기 SVG 와 동일 도형).
    window._meCutlineShapeItem = function(kind) {
        if (!kind || typeof window._stickerShapePts !== 'function') return;
        try { _meSnapshot(); } catch(_) {}
        // 기존 도형 칼선 item 제거 (도형 교체 = 스택 방지)
        (me.items || []).slice().forEach(function(it){
            if (it && it._isShapeCutline) {
                try { if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el); } catch(_) {}
                var ix = me.items.indexOf(it); if (ix >= 0) me.items.splice(ix, 1);
            }
        });
        var el = document.createElement('div');
        el.className = 'me-item shape';
        // 2026-07-14: 칼선 박스는 클릭 통과(pointer-events:none) — 아래 이미지가 직접 선택되도록.
        //   칼선 자체는 점선(hit path)으로 선택/드래그, 크기조절은 핸들(pointer-events:auto)로.
        //   zIndex 는 칼선 오버레이(1000)보다 위 → 핸들이 오버레이보다 위에서 잡힘. 박스는 투명·통과라 무해.
        el.style.pointerEvents = 'none';
        el.style.zIndex = '1001';
        me.stage.appendChild(el);
        ++me.zCounter;
        // 캔버스의 ~65% 정사각형, 중앙. (도형 aspect 는 relPts 가 인코딩 — 타원 등)
        var side = Math.min(me.natW, me.natH) * 0.65;
        var it = {
            el: el, type: 'shape', shape: 'rect',
            x: (me.natW - side) / 2, y: (me.natH - side) / 2,
            w: side, h: side,
            fill: 'transparent', stroke: '#000000', strokeWidth: 0,
            _isShapeCutline: true, _shapeCutlineKind: kind
        };
        // 도형 정규화 점 → 칼선. 원/타원은 부드러운 곡선(Q), 나머지는 sharp(직선 L)로 정확한 모서리 유지.
        var pts = window._stickerShapePts(kind) || [];
        var smooth = (kind === 'circle' || kind === 'ellipse');
        it._cutlineRelPts = pts.map(function(p){ return smooth ? [p.x, p.y] : [p.x, p.y, 1]; });
        it._cutlineMode = 'outer';
        me.items.push(it);
        _meSyncItemDisplay(it);
        _meBindDrag(it);
        _meSelect(it);
        try { _meCutlineRenderAll(); } catch(_) {}
        return it;
    };
    // simple_order 호환 별칭 (window.me.addShapeCutline)
    try { me.addShapeCutline = window._meCutlineShapeItem; } catch(_) {}
    // 도형 칼선 제거 — 사각/복잡모양으로 전환 시 남아있는 간단도형 칼선 정리.
    window._meRemoveShapeCutline = function() {
        var removed = false;
        (me.items || []).slice().forEach(function(it){
            if (it && it._isShapeCutline) {
                try { if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el); } catch(_) {}
                var ix = me.items.indexOf(it); if (ix >= 0) me.items.splice(ix, 1);
                if (me.selected === it) { try { _meSelect(null); } catch(_) { me.selected = null; } }
                removed = true;
            }
        });
        if (removed) { try { _meCutlineRenderAll(); } catch(_) {} }
        return removed;
    };
    try { me.removeShapeCutline = window._meRemoveShapeCutline; } catch(_) {}
    // 2026-06-16 v3: 지우개 모드 — 활성화 시 stage 위에 capture overlay 추가,
    //   click/drag 한 좌표 근처 (반경 R) 의 모든 it._cutlineRelPts 점 제거 → 부드럽게 재렌더.
    me._cutlineEraserMode = false;
    window._meCutlineEraserToggle = function() {
        me._cutlineEraserMode = !me._cutlineEraserMode;
        var ex = document.getElementById('meCutlineEraserOverlay');
        if (ex) ex.remove();
        if (!me._cutlineEraserMode) return;
        if (!me.stage) return;
        var ov = document.createElement('div');
        ov.id = 'meCutlineEraserOverlay';
        ov.style.cssText = 'position:absolute; inset:0; z-index:1500; cursor:crosshair; background:rgba(254,202,202,0.08);';
        me.stage.appendChild(ov);
        // 안내 tip
        var tip = document.createElement('div');
        tip.style.cssText = 'position:absolute; left:50%; top:8px; transform:translateX(-50%); background:#dc2626; color:#fff; padding:6px 12px; border-radius:14px; font-size:11px; font-weight:800; box-shadow:0 4px 12px rgba(220,38,38,0.35); pointer-events:none; font-family:inherit;';
        tip.textContent = '🧽 칼선 지우개 모드 — 드래그해서 지우기. ESC 또는 다시 클릭하면 종료.';
        ov.appendChild(tip);
        var dragging = false;
        var ERASE_R = 18;   // 자연 좌표 기준 반경 (px)
        function eraseAt(clientX, clientY) {
            var rect = me.stage.getBoundingClientRect();
            var sx = (clientX - rect.left) / me.wScale;
            var sy = (clientY - rect.top) / me.wScale;
            var changed = false;
            (me.items || []).forEach(function(it){
                if (!it._cutlineRelPts) return;
                var kept = it._cutlineRelPts.filter(function(p){
                    var ax = it.x + p[0]*it.w, ay = it.y + p[1]*it.h;
                    return Math.hypot(ax-sx, ay-sy) > ERASE_R;
                });
                if (kept.length !== it._cutlineRelPts.length) {
                    it._cutlineRelPts = kept.length >= 3 ? kept : null;
                    if (!kept.length) it._cutlineMode = null;
                    changed = true;
                }
            });
            if (changed) _meCutlineRenderAll();
        }
        ov.addEventListener('pointerdown', function(ev){
            ev.preventDefault();
            dragging = true;
            ov.setPointerCapture(ev.pointerId);
            eraseAt(ev.clientX, ev.clientY);
        });
        ov.addEventListener('pointermove', function(ev){ if (dragging) eraseAt(ev.clientX, ev.clientY); });
        ov.addEventListener('pointerup', function(ev){ dragging = false; try { ov.releasePointerCapture(ev.pointerId); } catch(_e){} });
        // ESC 로 종료
        function escHandler(ev){
            if (ev.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                me._cutlineEraserMode = false;
                var o2 = document.getElementById('meCutlineEraserOverlay');
                if (o2) o2.remove();
            }
        }
        document.addEventListener('keydown', escHandler);
    };
    window._meCutlineOpen = function() {
        // 2026-07-11: 객체크기 모드(등신대/자유인쇄커팅) — 모양 선택 모달 없이 바로 TYPE A(outer) 칼선.
        if (window._meObjSizeMode) {
            var s = me && me.selected;
            if (!s || s.type !== 'image') _meAutoSelectImage();
            try { _meCutlineTrace('outer'); } catch(_){}
            return;
        }
        // 기존 popup 제거
        var ex = document.getElementById('meCutlinePopup');
        if (ex) ex.remove();
        var pop = document.createElement('div');
        pop.id = 'meCutlinePopup';
        pop.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:99999; background:#fff; border:2px solid #ef4444; border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,0.25); padding:18px 18px 16px; width:380px; font-family:inherit; max-height:90vh; overflow-y:auto;';
        // 2026-06-17 v534: TYPE A/B 버튼을 그림 바로 아래로 이동 — 가장 자주 쓰는 동작이라 상단에 배치.
        //   순서: cut_st.jpg → [TYPE A | TYPE B] → 간단모양 4종 → 칼선 지우개 / 전체 삭제
        pop.innerHTML =
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">'
          +   '<div style="font-weight:900; font-size:15px; color:#b91c1c;">✂️ 칼선 모양 선택</div>'
          +   '<button type="button" id="meCutlineClose" style="border:0; background:transparent; font-size:20px; cursor:pointer; color:#94a3b8;">×</button>'
          + '</div>'
          + '<img src="/cut_st.jpg" alt="칼선 종류 예시" style="display:block; width:100%; height:auto; border-radius:8px; margin-bottom:10px; border:1px solid #fecaca;" loading="lazy">'
          //  TYPE A/B (이미지 윤곽선 따기) — 그림 바로 아래 2-column 배치
          + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">'
          +   '<button type="button" data-shape="trace-outer" style="padding:12px 10px; border:0; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border-radius:10px; cursor:pointer; font-weight:900; font-family:inherit; text-align:center;"><div style="font-size:14px;">TYPE A</div><div style="font-size:10.5px; font-weight:700; opacity:0.95; margin-top:3px; line-height:1.35;">Margins +2mm<br>Die-Cut<br>(반칼·완칼)</div></button>'
          +   '<button type="button" data-shape="trace-inner" style="padding:12px 10px; border:0; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border-radius:10px; cursor:pointer; font-weight:900; font-family:inherit; text-align:center;"><div style="font-size:14px;">TYPE B</div><div style="font-size:10.5px; font-weight:700; opacity:0.95; margin-top:3px; line-height:1.35;">Border -2mm<br>Wancut<br>(무테)</div></button>'
          + '</div>';
        document.body.appendChild(pop);
        function close(){ pop.remove(); }
        pop.querySelector('#meCutlineClose').onclick = close;
        pop.querySelectorAll('[data-shape]').forEach(function(b){
            b.onclick = function(){
                var s = b.getAttribute('data-shape');
                if (s === 'trace-outer') { _meCutlineTrace('outer'); close(); }
                else if (s === 'trace-inner') { _meCutlineTrace('inner'); close(); }
                else if (s === 'clear') { window._meCutlineClear(); close(); }
                else if (s === 'eraser') { window._meCutlineEraserToggle(); close(); }
                else { _meCutlineSimple(s); close(); }
            };
        });
    };

    // ─────────────────────── 2026-06-17 v539: 디자인 템플릿 ───────────────────────
    //   admin_templates 테이블에서 현재 카테고리 매칭 템플릿 로드 → 모달 grid → 선택 시 캔버스에 배치.
    //   배경 이미지 + text/image 슬롯 (위치·크기 고정, 텍스트 수정만 가능).
    //   고객 카테고리는 window._meCurrentCategory 로 전달 (simple_order.js 가 product 로드 시 세팅).
    var _meTplSbClient = null;
    function _meGetSb() {
        if (_meTplSbClient) return _meTplSbClient;
        if (typeof window.supabase === 'undefined') return null;
        try {
            _meTplSbClient = window.supabase.createClient(
                'https://qinvtnhiidtmrzosyvys.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y',
                { auth: { persistSession:true, storage:localStorage, storageKey:'sb-qinvtnhiidtmrzosyvys-auth-token' } }
            );
        } catch(e) { console.warn('[me template] sb client', e); }
        return _meTplSbClient;
    }

    window._meOpenTemplatePicker = async function() {
        var ex = document.getElementById('meTemplatePopup');
        if (ex) ex.remove();
        // 2026-06-18 v561: 모달 내부 다국어
        var _mtL = (function(){
            var h = (location.hostname || '').toLowerCase();
            var site = (h.indexOf('cafe0101') >= 0 || h.indexOf('cotton-printer') >= 0) ? 'JP' : (h.indexOf('cafe3355') >= 0 || h.indexOf('hexa-board') >= 0 || h.indexOf('chameleon.design') >= 0 ? 'US' : 'KR');
            return ({
                KR: { title:'디자인 템플릿 선택', sub:'템플릿을 클릭하면 배경 디자인이 캔버스에 자동 적용됩니다. 노란 표시 영역의 글씨를 클릭하여 직접 수정할 수 있습니다.', loading:'로딩 중...', empty:'이 상품에 등록된 템플릿이 아직 없습니다.', noCat:'상품 카테고리를 확인할 수 없어 템플릿을 표시할 수 없습니다.', loadFail:'템플릿 로드 실패: ', slots:'슬롯', cnt:'개' },
                JP: { title:'デザインテンプレートを選択', sub:'テンプレートをクリックすると背景デザインがキャンバスに自動適用されます。黄色いエリアの文字をクリックして直接修正できます。', loading:'読み込み中...', empty:'この商品に登録されたテンプレートはまだありません。', noCat:'商品カテゴリを確認できないためテンプレートを表示できません。', loadFail:'テンプレート読み込み失敗: ', slots:'スロット', cnt:'個' },
                US: { title:'Pick a Design Template', sub:'Clicking a template auto-applies the background design to the canvas. Click on the yellow text areas to edit directly.', loading:'Loading...', empty:'No templates registered for this product yet.', noCat:'Cannot determine product category — templates unavailable.', loadFail:'Failed to load templates: ', slots:'slots', cnt:'' }
            })[site];
        })();
        var pop = document.createElement('div');
        pop.id = 'meTemplatePopup';
        pop.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.8); display:flex; align-items:center; justify-content:center; padding:20px;';
        pop.innerHTML =
            '<div style="background:#fff; max-width:760px; width:100%; max-height:88vh; border-radius:16px; box-shadow:0 25px 60px rgba(0,0,0,0.4); overflow:hidden; display:flex; flex-direction:column; font-family:inherit;">'
          +   '<div style="display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1px solid #e2e8f0; background:linear-gradient(135deg,#f5f3ff,#ede9fe);">'
          +     '<div style="font-weight:900; font-size:16px; color:#5b21b6;"><i class="fa-solid fa-layer-group" style="margin-right:6px;"></i> ' + _mtL.title + '</div>'
          +     '<button type="button" id="meTplClose" style="border:0; background:transparent; font-size:24px; cursor:pointer; color:#94a3b8;">×</button>'
          +   '</div>'
          +   '<div style="padding:14px 22px; border-bottom:1px solid #f1f5f9; font-size:12.5px; color:#64748b; line-height:1.55;">'
          +     _mtL.sub
          +   '</div>'
          +   '<div id="meTplGrid" style="flex:1; overflow-y:auto; padding:20px; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:14px;">'
          +     '<div style="grid-column:1/-1; text-align:center; padding:40px 20px; color:#94a3b8; font-size:13px;">로딩 중...</div>'
          +   '</div>'
          + '</div>';
        document.body.appendChild(pop);
        document.getElementById('meTplClose').onclick = function() { pop.remove(); };
        pop.addEventListener('pointerdown', function(e){ if (e.target === pop) pop.remove(); });

        var grid = document.getElementById('meTplGrid');
        var cat = window._meCurrentCategory || '';
        var code = window._meCurrentProductCode || '';
        try { console.log('[me template] picker cat=' + cat + ' code=' + code); } catch(_){}
        if (!cat) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px 20px; color:#94a3b8; font-size:13px;">' + _mtL.noCat + '<br><span style="font-size:11px;">' + (code || '?') + '</span></div>';
            return;
        }
        try {
            var sb = _meGetSb();
            if (!sb) throw new Error('Supabase 클라이언트 초기화 실패');
            // 1) product_code 일치 우선, 2) product_code = NULL (카테고리 전체) — 둘 다 합쳐서 표시.
            var orFilter = 'product_code.eq.' + code + ',product_code.is.null';
            var q = sb.from('admin_templates')
                .select('id,name,thumbnail_url,background_url,width_mm,height_mm,slots,sort_order')
                .eq('product_category', cat)
                .eq('is_active', true)
                .eq('status', 'approved')   /* 2026-06-18 v554: 승인된 것만 고객에게 노출 */
                /* 2026-07-02: 사이트 공통 노출 — site_code 필터 제거. 승인 템플릿은 KR/JP/US 어느 사이트에서나 표시 (사장님 요청). */
                .order('sort_order', { ascending: true })
                .order('id', { ascending: false });
            if (code) q = q.or(orFilter);
            var resp = await q;
            if (resp.error) throw resp.error;
            var rows = resp.data || [];
            if (!rows.length) {
                grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px 20px; color:#94a3b8; font-size:13px;">' + _mtL.empty + '</div>';
                return;
            }
            grid.innerHTML = rows.map(function(t){
                var thumb = t.thumbnail_url || t.background_url;
                var slotCount = (t.slots || []).length;
                return '<div class="me-tpl-card" data-tid="' + t.id + '" style="background:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:8px; cursor:pointer; transition:border-color .15s, transform .15s;" onmouseover="this.style.borderColor=\'#7c3aed\'; this.style.transform=\'translateY(-2px)\';" onmouseout="this.style.borderColor=\'#e2e8f0\'; this.style.transform=\'\';">'
                  +   '<div style="aspect-ratio:1/1; background:#fff; border-radius:8px; overflow:hidden; margin-bottom:8px; display:flex; align-items:center; justify-content:center;">'
                  +     '<img src="' + thumb + '" alt="" style="max-width:100%; max-height:100%; object-fit:contain;" loading="lazy">'
                  +   '</div>'
                  +   '<div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + (t.name||'-') + '</div>'
                  +   '<div style="font-size:10.5px; color:#64748b;">' + (t.width_mm||'?') + '×' + (t.height_mm||'?') + 'mm · ' + _mtL.slots + ' ' + slotCount + _mtL.cnt + '</div>'
                  + '</div>';
            }).join('');
            grid.querySelectorAll('.me-tpl-card').forEach(function(card){
                card.onclick = function(){
                    var tid = Number(card.dataset.tid);
                    var tpl = rows.find(function(r){ return Number(r.id) === tid; });
                    if (tpl) { window._meLoadTemplate(tpl); pop.remove(); }
                };
            });
        } catch(e) {
            console.warn('[me template] load', e);
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px 20px; color:#dc2626; font-size:13px;">' + _mtL.loadFail + (e.message||e) + '</div>';
        }
    };

    // 템플릿 로드 — 두 가지 포맷 지원:
    //   (a) v542+ "items" 포맷: slots = [me.items 직렬화] — 미니에디터 전체 복원.
    //   (b) v539 "slot" 포맷: slots = [{type:'text'/'image', x, y, w, h, ...}] — 단순 슬롯.
    // 2026-06-28: 디자인(모든 item) 의 bounding box 를 캔버스 중앙으로 이동 — 템플릿 로드/사이즈 변경 시 위로 붙던 문제 해결.
    window._meCenterDesign = function() {
        if (!me.items || !me.items.length) return;
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
        me.items.forEach(function(it){
            if (!it || it._type === 'meta' || it.el == null) return;
            any = true;
            minX = Math.min(minX, it.x);
            minY = Math.min(minY, it.y);
            maxX = Math.max(maxX, it.x + (it.w || 0));
            maxY = Math.max(maxY, it.y + (it.h || 0));
        });
        if (!any || !isFinite(minX)) return;
        var bw = maxX - minX, bh = maxY - minY;
        var dx = (me.natW - bw) / 2 - minX;
        var dy = (me.natH - bh) / 2 - minY;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        me.items.forEach(function(it){
            if (!it || it._type === 'meta' || it.el == null) return;
            it.x += dx; it.y += dy;
            _meSyncItemDisplay(it);
        });
    };
    // 2026-06-28: 디자인을 캔버스에 가득 차게(cover) + 중앙. 템플릿 로드 시 사용.
    //   srcW/srcH(템플릿이 디자인된 캔버스 크기)가 주어지면 그 기준으로 스케일 → 대지 밖 요소(bleed)도 비율 보존.
    //   없으면(옛 템플릿) bbox 기준 폴백.
    window._meFitDesignToCanvas = function(srcW, srcH) {
        if (!me.items || !me.items.length) return;
        // 2026-06-28: 캔버스 크기를 아는 새 템플릿만 fit. 크기 정보 없는 기존 템플릿(명함 등)은
        //   그대로 로드(원래 동작) — bbox 재스케일이 명함 등 멀쩡하던 좌표를 틀어지게 했음.
        if (!(srcW > 0 && srcH > 0)) return;
        // 템플릿 캔버스 == 현재 캔버스(±1%)면 그대로 둠 (불필요한 재스케일·bleed 왜곡 방지)
        if (Math.abs(srcW - me.natW) <= me.natW * 0.01 && Math.abs(srcH - me.natH) <= me.natH * 0.01) return;
        var cx = srcW / 2, cy = srcH / 2, bw = srcW, bh = srcH;
        if (bw <= 0 || bh <= 0) return;
        var scale = Math.max(me.natW / bw, me.natH / bh);   // cover — 여백 없이 가득 (넘치는 부분은 잘림)
        if (!isFinite(scale) || scale <= 0) return;
        var ncx = me.natW / 2, ncy = me.natH / 2;             // 캔버스 중심
        me.items.forEach(function(it){
            if (!it || it._type === 'meta' || it.el == null) return;
            var iw = (it.w || 0) * scale, ih = (it.h || 0) * scale;
            var icx = it.x + (it.w || 0) / 2, icy = it.y + (it.h || 0) / 2;
            var nicx = ncx + (icx - cx) * scale, nicy = ncy + (icy - cy) * scale;
            it.x = nicx - iw / 2; it.y = nicy - ih / 2;
            it.w = iw; it.h = ih;
            if (it.type === 'text' && it.fontSize) it.fontSize = it.fontSize * scale;
            _meSyncItemDisplay(it);
        });
    };
    window._meLoadTemplate = function(tpl) {
        if (!tpl) return;
        // 2026-06-19 v623: 템플릿 사용 추적 — 주문 시 SVG 출력 + 메타 첨부에 사용.
        try {
            me._usedTemplate = { id: tpl.id, name: tpl.name || '', category: tpl.product_category || '', code: tpl.product_code || '' };
        } catch(_te){}
        // 2026-06-18 v561: 다국어 확인 메시지
        // 2026-06-19 v680: chameleon.design / cotton-printer 추가
        var _lcfm = (function(){
            var h = (location.hostname || '').toLowerCase();
            if (h.indexOf('cafe0101') >= 0 || h.indexOf('cotton-printer') >= 0) return 'テンプレートを読み込むと現在のデザインは消去されます。続行しますか？';
            if (h.indexOf('cafe3355') >= 0 || h.indexOf('hexa-board') >= 0 || h.indexOf('chameleon.design') >= 0) return 'Loading a template will clear the current design. Continue?';
            return '템플릿을 불러오면 현재 디자인은 지워집니다. 계속하시겠어요?';
        })();
        if (!confirm(_lcfm)) return;
        _meSnapshot();
        // 1) 기존 items 제거
        (me.items || []).forEach(function(it){ try { it.el.remove(); } catch(_e){} });
        me.items = [];
        me._cutlinePathD = null; me._canvasCutlinePathD = null;
        try { var ov = document.getElementById('meCutlineOverlay'); if (ov) ov.remove(); } catch(_){}
        // 포맷 자동 감지 — slots 안에 type='shape'/'shelf' 또는 _type='meta' 가 있으면 v542+ 포맷.
        var slots = tpl.slots || [];
        var isV542 = slots.length > 0 && slots.some(function(s){
            return s && (s._type === 'meta' || s.type === 'shape' || s.type === 'shelf' || s.shape || (s.type === 'image' && s.src));
        });
        if (isV542) {
            // v542: me.items 그대로 복원 (admin 의 에디터에서 만든 디자인 통째로)
            // 2026-06-18 v554: 메타 슬롯 처리 — bg color 복원
            var _hasMetaBg = false;
            var _tplSrcW = 0, _tplSrcH = 0;
            slots.forEach(function(saved){
                if (saved && saved._type === 'meta') {
                    if (saved.bg && typeof window._meSetBg === 'function') {
                        try { window._meSetBg(saved.bg); _hasMetaBg = true; } catch(_){}
                    }
                    if (saved.natW) _tplSrcW = saved.natW;
                    if (saved.natH) _tplSrcH = saved.natH;
                    return;
                }
                _meRestoreTemplateItem(saved);
            });
            // 2026-06-28: 로드한 디자인을 현재 캔버스에 가득 차게 (cover). 템플릿 캔버스 크기 기준이라 대지 밖 요소(bleed) 보존.
            try { window._meFitDesignToCanvas(_tplSrcW, _tplSrcH); } catch(_ce) {}
            // 2026-06-18 v558: 메타 슬롯이 없는 옛 템플릿 — 썸네일 PNG 모서리 픽셀 샘플링하여 bg 추정.
            if (!_hasMetaBg && (tpl.thumbnail_url || tpl.background_url)) {
                var _smpImg = new Image();
                _smpImg.crossOrigin = 'anonymous';
                _smpImg.onload = function() {
                    try {
                        var c = document.createElement('canvas');
                        c.width = _smpImg.naturalWidth;
                        c.height = _smpImg.naturalHeight;
                        var cx = c.getContext('2d');
                        cx.drawImage(_smpImg, 0, 0);
                        // 4 모서리 + 중앙 상단/하단 픽셀 샘플링 → 가장 흔한 색 (=배경) 추정
                        var pts = [[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1],[Math.floor(c.width/2),0],[Math.floor(c.width/2),c.height-1]];
                        var colorCounts = {};
                        pts.forEach(function(p){
                            try {
                                var d = cx.getImageData(p[0], p[1], 1, 1).data;
                                // 16단계로 양자화 (비슷한 색 묶음)
                                var r = (d[0] >> 4) << 4, g = (d[1] >> 4) << 4, b = (d[2] >> 4) << 4;
                                var key = r + ',' + g + ',' + b;
                                colorCounts[key] = (colorCounts[key] || 0) + 1;
                            } catch(_){}
                        });
                        // 가장 많이 나온 색
                        var best = null, bestCnt = 0;
                        Object.keys(colorCounts).forEach(function(k){
                            if (colorCounts[k] > bestCnt) { bestCnt = colorCounts[k]; best = k; }
                        });
                        if (best && bestCnt >= 3) {  // 최소 3개 모서리 일치
                            var rgb = best.split(',').map(Number);
                            var hex = '#' + rgb.map(function(v){ return ('0' + v.toString(16)).slice(-2); }).join('');
                            if (typeof window._meSetBg === 'function') {
                                window._meSetBg(hex);
                                console.log('[me template] bg sampled from thumbnail:', hex);
                            }
                        }
                    } catch(e) { console.warn('[me template] bg sample failed', e); }
                };
                _smpImg.onerror = function(){};
                _smpImg.src = tpl.thumbnail_url || tpl.background_url;
            }
            return;
        }
        // v539 폴백: 옛 slot 포맷 (배경 이미지 + 슬롯들)
        if (!tpl.background_url) return;
        var bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.onload = function() {
            // 자연 사이즈 → 캔버스에 fit
            var ratioImg = bgImg.naturalHeight / bgImg.naturalWidth;
            var ratioCanvas = me.natH / me.natW;
            var w, h;
            if (ratioImg > ratioCanvas) { h = me.natH; w = h / ratioImg; }
            else { w = me.natW; h = w * ratioImg; }
            var x = (me.natW - w) / 2;
            var y = (me.natH - h) / 2;
            // 직접 me.items 에 추가 (toBack)
            var el = document.createElement('div');
            el.className = 'me-item';
            el.style.zIndex = '0';
            var imgEl = document.createElement('img');
            imgEl.src = tpl.background_url;
            imgEl.style.width = '100%'; imgEl.style.height = '100%'; imgEl.style.objectFit = 'fill';
            el.appendChild(imgEl);
            me.stage.appendChild(el);
            // 2026-06-18 v562: 잠금 해제 — _isTemplateSlot 제거
            var bgIt = { el: el, type: 'image', x: x, y: y, w: w, h: h, src: tpl.background_url };
            me.items.unshift(bgIt);
            _meSyncItemDisplay(bgIt);
            _meBindDrag(bgIt);
            // 3) 슬롯들 추가 — 원본 좌표는 admin 페이지의 배경 픽셀 기준 (admin 의 자연 사이즈). 캔버스 비율에 맞춰 스케일.
            var sx = w / bgImg.naturalWidth;
            var sy = h / bgImg.naturalHeight;
            (tpl.slots || []).forEach(function(slot){
                _meAddTemplateSlot(slot, x, y, sx, sy);
            });
        };
        bgImg.onerror = function() { alert('템플릿 배경 이미지를 불러오지 못했습니다.'); };
        bgImg.src = tpl.background_url;
    };

    // 2026-06-18 v562: 템플릿 item 복원 — 잠금 해제 + 완전 편집 가능 상태로 로드.
    //   _isTemplateSlot 플래그 제거. 사용자가 등록 전 디자인 상태 그대로 가져와서 자유 편집.
    //   드래그·리사이즈·회전·삭제·텍스트 편집·우클릭 메뉴 모두 가능.
    function _meRestoreTemplateItem(saved) {
        if (!saved || !saved.type) return;
        var el = document.createElement('div');
        el.className = 'me-item' + (saved.type === 'text' ? ' text' : '') + (saved.type === 'shape' ? ' shape' : '') + (saved.shape === 'circle' ? ' circle' : '');
        el.style.zIndex = (++me.zCounter);
        me.stage.appendChild(el);
        // _isTemplateSlot 제거 — 일반 item 으로 복원
        var it = Object.assign({}, saved, { el: el });
        // 2026-06-28: 배경 잠금 제거 — 이전에 저장된 템플릿의 _isBackground 플래그도 해제 (자유 편집).
        it._isBackground = false; it._isTemplateSlot = false;
        if (el.classList) el.classList.remove('me-bg-locked');
        if (saved.type === 'text') {
            el.textContent = saved.text || '';
            try { if (typeof _meLoadFont === 'function') _meLoadFont(saved.fontFamily, null); } catch(_){}
        } else if (saved.type === 'image') {
            var imgEl = document.createElement('img');
            imgEl.src = saved.src || '';
            imgEl.style.width = '100%'; imgEl.style.height = '100%';
            imgEl.style.objectFit = 'fill';
            el.appendChild(imgEl);
        }
        // shape 는 _meSyncItemDisplay 가 background/border/clipPath 처리.
        me.items.push(it);
        _meSyncItemDisplay(it);
        _meBindDrag(it);  // 모든 type 에 일반 바인딩 — 드래그/리사이즈/회전/편집 모두 가능
    }
    // v562 부터 미사용 — 아래는 v557 잠금 모드 코드 (참조용으로 보존, 호출되지 않음)
    function _meRestoreTemplateItem_legacy_v557(saved) {
        if (!saved || !saved.type) return;
        var el = document.createElement('div');
        el.className = 'me-item' + (saved.type === 'text' ? ' text' : '') + (saved.type === 'shape' ? ' shape' : '') + (saved.shape === 'circle' ? ' circle' : '');
        el.style.zIndex = (++me.zCounter);
        me.stage.appendChild(el);
        var it = Object.assign({}, saved, { el: el, _isTemplateSlot: true });
        if (saved.type === 'text') {
            el.textContent = saved.text || '';
            el.setAttribute('contenteditable', 'true');
            el.style.userSelect = 'text';
            el.style.webkitUserSelect = 'text';
            el.style.touchAction = 'auto';
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'text';
            el.style.outline = 'none';
            var _everEditedR = false;
            var _origTextR = saved.text || '';
            // pointerdown 캡처 단계에서 즉시 focus — _meBindDrag 의 pointerdown 핸들러보다 먼저 실행
            el.addEventListener('pointerdown', function(ev){
                ev.stopPropagation();
                if (document.activeElement !== el) { try { el.focus(); } catch(_){} }
            }, true);
            el.addEventListener('focus', function(){
                el.style.background = 'rgba(253,224,71,0.20)';
                el.style.boxShadow = '0 0 0 2px #f59e0b';
                if (!_everEditedR && el.innerText === _origTextR) {
                    try { document.execCommand('selectAll', false, null); } catch(_){}
                }
            });
            el.addEventListener('blur', function(){
                el.style.background = ''; el.style.boxShadow = '';
                it.text = el.innerText || '';
                if (it.text !== _origTextR) _everEditedR = true;
            });
            el.addEventListener('input', function(){ it.text = el.innerText || ''; });
            try { if (typeof _meLoadFont === 'function') _meLoadFont(saved.fontFamily, null); } catch(_){}
        } else if (saved.type === 'image') {
            var imgEl = document.createElement('img');
            imgEl.src = saved.src || '';
            imgEl.style.width = '100%'; imgEl.style.height = '100%';
            imgEl.style.objectFit = 'fill';
            el.appendChild(imgEl);
        }
        // shape 는 _meSyncItemDisplay 가 background/border/clipPath 처리.
        me.items.push(it);
        _meSyncItemDisplay(it);
        // 2026-06-18 v560: 템플릿 TEXT 슬롯은 _meBindDrag 호출 안 함 (contenteditable 충돌 회피).
        //   드래그·리사이즈·우클릭 메뉴 모두 불필요. 일반 contenteditable element 로만 동작.
        if (saved.type !== 'text') {
            _meBindDrag(it);  // _isTemplateSlot 으로 인해 드래그 차단됨 (이미지/도형은 그대로)
        }
    }

    function _meAddTemplateSlot(slot, baseX, baseY, sx, sy) {
        var el = document.createElement('div');
        el.className = 'me-item' + (slot.type === 'text' ? ' text' : '');
        el.style.zIndex = (++me.zCounter);
        me.stage.appendChild(el);
        // 2026-06-18 v562: 잠금 해제 — _isTemplateSlot 제거
        var it = {
            el: el, type: slot.type,
            x: baseX + slot.x * sx,
            y: baseY + slot.y * sy,
            w: slot.w * sx,
            h: slot.h * sy,
            _slotId: slot.id || ''
        };
        if (slot.type === 'text') {
            it.text = slot.default_text || '';
            it.fontSize = (slot.fontSize || 24) * Math.min(sx, sy);
            it.fontFamily = slot.fontFamily || 'sans-serif';
            it.fontWeight = slot.fontWeight || 400;
            it.fill = slot.color || '#000000';
            it.textAlign = slot.textAlign || 'left';
            it.lineHeight = 1.2;
            // 2026-06-18 v562: 잠금 모드 제거 — 일반 텍스트 item 처럼 동작. _meBindDrag 가 click → edit 사이클 처리.
            el.textContent = it.text;
            try { if (typeof _meLoadFont === 'function') _meLoadFont(slot.fontFamily, null); } catch(_){}
        } else if (slot.type === 'image') {
            it.src = slot.placeholder_url || '';
            // 빈 placeholder 스타일
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.background = 'rgba(34,197,94,0.10)';
            el.style.border = '2px dashed #22c55e';
            el.style.color = '#15803d';
            el.style.fontWeight = '700';
            el.style.fontSize = '12px';
            el.style.cursor = 'pointer';
            if (slot.placeholder_url) {
                var imgEl = document.createElement('img');
                imgEl.src = slot.placeholder_url;
                imgEl.style.width = '100%'; imgEl.style.height = '100%'; imgEl.style.objectFit = 'contain';
                el.appendChild(imgEl);
            } else {
                el.innerHTML = '<div style="text-align:center;"><i class="fa-solid fa-cloud-arrow-up" style="display:block; font-size:20px; margin-bottom:4px;"></i>클릭하여 사진 업로드</div>';
            }
            el.addEventListener('click', function(){
                var input = document.createElement('input');
                input.type = 'file'; input.accept = 'image/*';
                input.onchange = function(){
                    var f = input.files && input.files[0]; if (!f) return;
                    var r = new FileReader();
                    r.onload = function(e){
                        it.src = e.target.result;
                        el.innerHTML = '';
                        el.style.background = ''; el.style.border = '';
                        el.style.display = ''; el.style.cursor = '';
                        var im = document.createElement('img');
                        im.src = e.target.result;
                        im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'contain';
                        el.appendChild(im);
                    };
                    r.readAsDataURL(f);
                };
                input.click();
            });
        }
        me.items.push(it);
        _meSyncItemDisplay(it);
        // 2026-06-18 v562: 잠금 해제 — _meBindDrag 호출 → 일반 item 처럼 자유 편집
        _meBindDrag(it);
    }

    window._meAddImageFromFile = function(input) {
        var f = input.files && input.files[0];
        if (!f) return;
        // 2026-06-18 v609: SVG 분기 — 그룹별 분리 import (디자이너 일러스트 작업물 호환)
        var isSvg = /\.svg$/i.test(f.name || '') || /svg\+xml/.test(f.type || '');
        if (isSvg && typeof window._meAddSvgFile === 'function') {
            var rs = new FileReader();
            rs.onload = function(e){ window._meAddSvgFile(e.target.result); };
            rs.readAsText(f);
            input.value = '';
            return;
        }
        // 2026-07-02: PDF 분기 — pdf.js 로 첫 페이지를 렌더해 이미지로 배치 (에디터에서 PDF 미리보기).
        var isPdf = /\.pdf$/i.test(f.name || '') || /pdf/.test(f.type || '');
        if (isPdf) {
            _meAddPdfFile(f);
            input.value = '';
            return;
        }
        var r = new FileReader();
        r.onload = function(e){ window._meAddImage(e.target.result); };
        r.readAsDataURL(f);
        input.value = '';
    };

    // 2026-07-02: PDF 첫 페이지 → 고해상도 PNG 로 렌더 후 캔버스에 배치.
    async function _meAddPdfFile(f) {
        try {
            if (typeof window.loadEditorLibraries === 'function') { try { await window.loadEditorLibraries(); } catch (_) {} }
            var pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
            if (!pdfjs || typeof pdfjs.getDocument !== 'function') {
                alert('PDF 미리보기 라이브러리를 불러오지 못했어요. 이미지(PNG/JPG)로 올려주세요.');
                return;
            }
            try { if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (_) {}
            var buf = await f.arrayBuffer();
            var pdf = await pdfjs.getDocument({ data: buf }).promise;
            var page = await pdf.getPage(1);
            var vp1 = page.getViewport({ scale: 1 });
            var target = 2200;   // 긴 변 목표 px (고해상도)
            var scale = Math.min(5, Math.max(1, target / Math.max(vp1.width, vp1.height)));
            var vp = page.getViewport({ scale: scale });
            var cv = document.createElement('canvas');
            cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            window._meAddImage(cv.toDataURL('image/png'), { fitCanvas: true });
            // 2026-07-02: 가벽 제품이면 PDF 실제 mm 사이즈로 사이즈 검증(우측 패널과 동일). scale1 viewport=points → mm = pt×25.4/72.
            try {
                if (typeof window._soValidateWallPdfDims === 'function') {
                    var _wMm = vp1.width * 25.4 / 72;
                    var _hMm = vp1.height * 25.4 / 72;
                    window._soValidateWallPdfDims(_wMm, _hMm);
                }
            } catch (_) {}
        } catch (e) {
            console.warn('[me pdf]', e);
            alert('PDF 미리보기를 불러오지 못했어요. 이미지(PNG/JPG)로 올려주세요.');
        }
    }

    // 2026-06-18 v609: SVG 그룹별 import — 일러스트레이터에서 export 한 SVG 를 받아
    //   최상위 <g>/<path>/<text>/<image> 등 각 요소를 별도 me-item 으로 분리해 배치.
    //   각 그룹 내부의 sub-요소는 함께 transform 되므로 캐릭터/로고 등 묶음 보존.
    //   bbox 계산을 위해 SVG 를 잠깐 DOM 에 렌더 → getBBox() 사용.
    window._meAddSvgFile = function(svgText) {
        try {
            var parser = new DOMParser();
            var doc = parser.parseFromString(svgText, 'image/svg+xml');
            var svg = doc.documentElement;
            if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
                console.warn('[svg upload] not a valid SVG, falling back to image load');
                var fb = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
                window._meAddImage(fb, { fitCanvas: true });
                return;
            }
            // viewBox 또는 width/height 로 SVG 좌표계 크기 산출
            var vb = svg.getAttribute('viewBox');
            var svgW = 0, svgH = 0, vbX = 0, vbY = 0;
            if (vb) {
                var p = vb.trim().split(/[\s,]+/).map(parseFloat);
                vbX = p[0] || 0; vbY = p[1] || 0; svgW = p[2] || 0; svgH = p[3] || 0;
            }
            if (!svgW) svgW = parseFloat(svg.getAttribute('width')) || 800;
            if (!svgH) svgH = parseFloat(svg.getAttribute('height')) || 600;

            // SVG 좌표계 → 캔버스 좌표계 fit 비율 계산
            var stageRatio = me.natH / me.natW;
            var svgRatio = svgH / svgW;
            var fitScale, offX, offY;
            if (svgRatio > stageRatio) {
                fitScale = me.natH / svgH;
                offX = (me.natW - svgW * fitScale) / 2;
                offY = 0;
            } else {
                fitScale = me.natW / svgW;
                offX = 0;
                offY = (me.natH - svgH * fitScale) / 2;
            }

            // 분리 대상 최상위 children — 무시할 메타 태그 (defs/title/desc/style) 제외
            var SKIP_TAGS = ['defs','title','desc','style','metadata','script'];
            function _gatherChildren(parent) {
                var out = [];
                for (var ii = 0; ii < parent.children.length; ii++) {
                    var c = parent.children[ii];
                    if (SKIP_TAGS.indexOf(c.nodeName.toLowerCase()) >= 0) continue;
                    out.push(c);
                }
                return out;
            }
            var topChildren = _gatherChildren(svg);

            // 2026-06-18 v611: Illustrator SVG 외곽 wrapper <g> 자동 unwrap.
            //   일러스트는 보통 모든 객체를 'Layer_1' 같은 하나의 <g> 로 감싸 export 함.
            //   wrapper 가 하나뿐이고 내부에 여러 자식이 있으면, 그 안쪽을 진짜 최상위 children 으로 사용.
            //   transform 이 wrapper 에 있으면 추후 bbox 가 그 변환을 반영하므로 좌표는 문제 없음.
            var unwrapCount = 0;
            while (topChildren.length === 1
                   && topChildren[0].nodeName.toLowerCase() === 'g'
                   && _gatherChildren(topChildren[0]).length >= 2) {
                topChildren = _gatherChildren(topChildren[0]);
                unwrapCount++;
                if (unwrapCount > 5) break; // 안전장치
            }
            console.log('[svg upload] unwrap depth:', unwrapCount, 'top items:', topChildren.length);

            if (topChildren.length === 0) {
                console.warn('[svg upload] no top-level elements found');
                var fb2 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
                window._meAddImage(fb2, { fitCanvas: true });
                return;
            }

            // <defs> + <style> 는 각 부분 SVG 에도 포함시킴 (그라데이션/필터/사용자 폰트 보존)
            var defsHtml = '';
            for (var d = 0; d < svg.children.length; d++) {
                var cd = svg.children[d];
                var tn = cd.nodeName.toLowerCase();
                if (tn === 'defs' || tn === 'style') defsHtml += cd.outerHTML;
            }

            // 2026-06-18 v612: 임시 렌더 — 명시적 width/height 강제 (SVG 가 0×0 으로 렌더돼서 getBBox 실패 방지)
            var tmp = document.createElement('div');
            tmp.style.cssText = 'position:absolute; left:-99999px; top:-99999px; pointer-events:none;';
            var tmpHtml = svg.outerHTML;
            // 외곽 <svg ...> 태그에 width/height 강제 삽입 (이미 있으면 덮어쓰지 않음)
            if (!/<svg[^>]*\swidth=/i.test(tmpHtml)) tmpHtml = tmpHtml.replace(/<svg\b/i, '<svg width="' + svgW + '" height="' + svgH + '"');
            tmp.innerHTML = tmpHtml;
            document.body.appendChild(tmp);
            var rendered = tmp.querySelector('svg');

            // 2026-06-18 v612: getBBox() 는 element 의 LOCAL 좌표 반환.
            //   부모 <g transform="translate(...)"> 가 있으면 그 변환이 반영 안 됨 → 위치 어긋남.
            //   getCTM() 으로 누적 transform 행렬을 얻어 bbox 4 꼭지점을 SVG 문서 좌표로 변환.
            function _docBBox(elem) {
                var bb;
                try { bb = elem.getBBox(); } catch(e) { return null; }
                if (!bb) return null;
                var ctm;
                try { ctm = elem.getCTM(); } catch(e) { ctm = null; }
                if (!ctm) return bb;
                // SVG root viewport CTM 의 역행렬로 screen→SVG document 변환할 필요 없음 —
                //   getCTM() 이 이미 element-local → svg-viewport 매트릭스를 줌.
                //   viewport coord 가 viewBox 와 1:1 이라 그대로 사용 가능 (preserveAspectRatio 가정).
                var pts = [
                    { x: bb.x,             y: bb.y              },
                    { x: bb.x + bb.width,  y: bb.y              },
                    { x: bb.x,             y: bb.y + bb.height  },
                    { x: bb.x + bb.width,  y: bb.y + bb.height  }
                ].map(function(p){
                    return { x: ctm.a * p.x + ctm.c * p.y + ctm.e, y: ctm.b * p.x + ctm.d * p.y + ctm.f };
                });
                var xs = pts.map(function(p){ return p.x; });
                var ys = pts.map(function(p){ return p.y; });
                var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
                var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
                return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }

            _meSnapshot();

            // 2026-06-18 v613: 그룹 내 모든 <text> 노드를 재귀 수집 (다중 텍스트 + 장식 혼합 그룹 처리)
            function _collectAllText(node) {
                var out = [];
                if (node.nodeName.toLowerCase() === 'text') { out.push(node); return out; }
                for (var ii = 0; ii < node.children.length; ii++) {
                    var c = node.children[ii];
                    if (SKIP_TAGS.indexOf(c.nodeName.toLowerCase()) >= 0) continue;
                    out = out.concat(_collectAllText(c));
                }
                return out;
            }

            // 2026-06-18 v613: 노드 트리에서 모든 <text> 노드를 제거한 복제본 반환 (시각적 잔여물 그리기용)
            function _cloneWithoutText(node) {
                var cl = node.cloneNode(true);
                var allTexts = cl.querySelectorAll('text');
                for (var ti = allTexts.length - 1; ti >= 0; ti--) {
                    allTexts[ti].parentNode.removeChild(allTexts[ti]);
                }
                return cl;
            }

            // 2026-06-18 v613: 자식들 중에 <text> 외 시각 요소가 하나라도 있는지
            function _hasNonTextVisual(node) {
                if (node.nodeName.toLowerCase() === 'text') return false;
                for (var ii = 0; ii < node.children.length; ii++) {
                    var c = node.children[ii];
                    var tn = c.nodeName.toLowerCase();
                    if (tn === 'text' || SKIP_TAGS.indexOf(tn) >= 0) continue;
                    // path/rect/circle/line/polygon/ellipse/image/use/g 등은 시각 요소
                    return true;
                }
                return false;
            }

            // 2026-06-18 v615: rgb(r,g,b) → #rrggbb 변환 (편집기의 color input 이 #hex 만 받음)
            function _rgbToHex(c) {
                if (!c) return '#000000';
                c = c.trim();
                if (c.charAt(0) === '#') return c;
                var m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
                if (!m) return c;
                function _h(n){ var h = (+n | 0).toString(16); return h.length < 2 ? '0' + h : h; }
                return '#' + _h(m[1]) + _h(m[2]) + _h(m[3]);
            }

            // 2026-06-18 v610/v613: 단일 SVG <text> 노드에서 편집 가능한 텍스트 메타 추출
            function _extractTextFromSvg(textEl, renderedText) {
                if (!textEl || !renderedText) return null;
                // 줄별 텍스트 (tspan 단위)
                var tspans = textEl.querySelectorAll('tspan');
                var text;
                if (tspans.length > 0) {
                    var lines = [];
                    tspans.forEach(function(ts){ lines.push(ts.textContent || ''); });
                    text = lines.join('\n');
                } else {
                    text = textEl.textContent || '';
                }
                text = text.replace(/\s+/g, ' ').trim();
                if (!text) return null;
                // computed style — 일러스트가 inline style 로 다 넣어주므로 정확
                var cs = (typeof window.getComputedStyle === 'function') ? window.getComputedStyle(renderedText) : null;
                var fam = (cs && cs.fontFamily) || textEl.getAttribute('font-family') || 'sans-serif';
                var size = parseFloat((cs && cs.fontSize) || textEl.getAttribute('font-size') || '16');
                var weight = (cs && cs.fontWeight) || textEl.getAttribute('font-weight') || 'normal';
                var fill = _rgbToHex((cs && cs.fill) || textEl.getAttribute('fill') || '#000');
                var anchor = (cs && cs.textAnchor) || textEl.getAttribute('text-anchor') || 'start';
                // SVG text-anchor → 우리 textAlign
                var align = (anchor === 'middle') ? 'center' : (anchor === 'end') ? 'right' : 'left';
                // fontFamily 정규화 (공백 있으면 따옴표)
                fam = fam.split(',')[0].trim().replace(/['"]/g, '');
                var famStr = /\s/.test(fam) ? '"' + fam + '"' : fam;
                return {
                    text: text,
                    fontSize: size * fitScale,
                    fontFamily: famStr,
                    fill: fill,
                    textAlign: align,
                    fontWeight: weight
                };
            }

            // 2026-06-18 v610: 추출된 텍스트 메타로 me.items 에 편집 가능한 text 항목 직접 생성
            function _addExtractedText(meta, pos) {
                var el = document.createElement('div');
                el.className = 'me-item text';
                el.style.zIndex = (++me.zCounter);
                el.textContent = meta.text;
                me.stage.appendChild(el);
                var it = {
                    el: el, type: 'text',
                    x: pos.x, y: pos.y, w: pos.w, h: pos.h,
                    text: meta.text,
                    fill: meta.fill,
                    fontSize: Math.max(10, meta.fontSize),
                    fontFamily: meta.fontFamily,
                    fontWeight: (meta.fontWeight === 'bold' || +meta.fontWeight >= 600) ? 'bold' : 'normal',
                    letterSpacing: 0,
                    lineHeight: 1.2,
                    textAlign: meta.textAlign
                };
                me.items.push(it);
                _meSyncItemDisplay(it);
                _meBindDrag(it);
                return it;
            }

            var added = 0;
            var firstItem = null;
            // 2026-06-18 v614: 비동기 _meAddImage 콜백 추적 — 모두 완료된 후 bg 잠금 적용
            var pendingImageLoads = 0;
            var pendingResolve = null;
            function _onAllLoaded(fn) {
                if (pendingImageLoads === 0) fn();
                else pendingResolve = fn;
            }
            function _decPending() {
                pendingImageLoads--;
                if (pendingImageLoads === 0 && pendingResolve) { var f = pendingResolve; pendingResolve = null; f(); }
            }
            // 첫 번째 child 의 시각 잔여물을 우선 firstItem 후보로 (배경 잠금용)
            var visualItemsByChildIdx = {};
            // outerHTML 캐싱 (반복 매칭 가속화)
            var allRendered = rendered.getElementsByTagName('*');

            // 2026-06-18 v614: 텍스트 노드는 textContent 기반 매칭이 더 강건 (한글 폰트명 등으로 outerHTML 불일치 문제 회피)
            //   일반 노드는 outerHTML 매칭, 폴백으로 nodeName + idx.
            //   같은 텍스트가 여러개면 같은 부모 그룹의 인덱스로 disambiguate.
            function _normText(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
            function _findRendered(srcNode, fallbackIdx) {
                var tn = srcNode.nodeName.toLowerCase();
                // 텍스트 노드: 내용 매칭 우선
                if (tn === 'text') {
                    var target = _normText(srcNode.textContent);
                    var renderedTexts = rendered.getElementsByTagName('text');
                    var sameContent = [];
                    for (var ti = 0; ti < renderedTexts.length; ti++) {
                        if (_normText(renderedTexts[ti].textContent) === target) sameContent.push(renderedTexts[ti]);
                    }
                    if (sameContent.length === 1) return sameContent[0];
                    if (sameContent.length > 1) {
                        // 다중 — 원본 순서로 disambiguate
                        var allSrcTexts = svg.getElementsByTagName('text');
                        var srcIdx = -1;
                        for (var si = 0; si < allSrcTexts.length; si++) {
                            if (allSrcTexts[si] === srcNode) { srcIdx = si; break; }
                        }
                        if (srcIdx >= 0 && srcIdx < sameContent.length) return sameContent[srcIdx];
                        return sameContent[0];
                    }
                    // 내용 매칭 실패 — outerHTML 시도
                }
                var srcHtml = srcNode.outerHTML;
                for (var ri = 0; ri < allRendered.length; ri++) {
                    if (allRendered[ri].outerHTML === srcHtml) return allRendered[ri];
                }
                if (fallbackIdx != null) {
                    var sameTags = rendered.getElementsByTagName(srcNode.nodeName);
                    if (sameTags.length > fallbackIdx) return sameTags[fallbackIdx];
                }
                return null;
            }

            try {
                // 2026-06-18 v613: 각 top-level child 에 대해
                //   1) 내부 모든 <text> 노드를 재귀 수집 → 각각 별도 편집 가능 text item
                //   2) <text> 를 모두 제거한 시각 잔여물(배경/장식/로고 등) 을 한 덩어리 이미지로
                topChildren.forEach(function(child, idx) {
                    // 2026-07-06: 대지(viewBox) 완전히 밖에 있는 객체는 불러오지 않음 (사용자 지적 — SVG 제작 시 대지 밖 잔여 객체가 같이 딸려오던 문제).
                    //   child 의 SVG 문서좌표 bbox 가 viewBox [vbX, vbX+svgW] × [vbY, vbY+svgH] 와 전혀 겹치지 않으면 skip.
                    //   (부분 겹침은 유지 — 대지에 걸친 객체는 살림.) 약간의 여유(margin)로 경계 오차 흡수.
                    try {
                        var _rc = _findRendered(child, idx);
                        var _cbb = _rc ? _docBBox(_rc) : null;
                        if (_cbb && _cbb.width > 0 && _cbb.height > 0) {
                            var _mgX = svgW * 0.02, _mgY = svgH * 0.02;  // 2% 여유
                            var _outside = (_cbb.x + _cbb.width < vbX - _mgX) || (_cbb.x > vbX + svgW + _mgX)
                                        || (_cbb.y + _cbb.height < vbY - _mgY) || (_cbb.y > vbY + svgH + _mgY);
                            if (_outside) { console.log('[svg upload] skip off-viewBox child', idx, _cbb); return; }
                        }
                    } catch(_ov) {}
                    var allTexts = _collectAllText(child);
                    var hasVisuals = _hasNonTextVisual(child) || child.nodeName.toLowerCase() !== 'g' && child.nodeName.toLowerCase() !== 'text';
                    // text-only 그룹은 visual 처리 X. text-only 가 아니면 잔여물 처리.
                    var addedVisual = false;
                    // v617 진단: 어떤 child 가 어떤 구조를 가졌는지 출력
                    console.log('[svg upload] child', idx, 'tag=' + child.nodeName,
                        'texts=' + allTexts.length,
                        'hasVisuals=' + hasVisuals,
                        'preview=' + (child.outerHTML || '').slice(0, 200).replace(/\s+/g, ' '));

                    // (A) 시각 잔여물 — <text> 빼고 렌더링되는 게 있는 경우만
                    if (hasVisuals && child.nodeName.toLowerCase() !== 'text') {
                        // rendered 트리에서 동일 노드 찾기 (transform/style 모두 반영된 상태)
                        var renderedChild = _findRendered(child, idx);
                        if (renderedChild && typeof renderedChild.getBBox === 'function') {
                            // 텍스트 제거한 복제본을 임시 마운트 → bbox 측정 → standalone SVG 로 변환
                            var visualCopy = _cloneWithoutText(child);
                            // text 제외하고도 시각 요소가 남았는지 확인
                            var hasVisualRemaining = false;
                            for (var vci = 0; vci < visualCopy.children.length; vci++) {
                                var vct = visualCopy.children[vci].nodeName.toLowerCase();
                                if (SKIP_TAGS.indexOf(vct) >= 0) continue;
                                hasVisualRemaining = true; break;
                            }
                            // <g> 가 아닌 단일 요소 (path/rect 등) 면 무조건 시각 요소
                            if (visualCopy.nodeName.toLowerCase() !== 'g') hasVisualRemaining = true;
                            if (hasVisualRemaining) {
                                // bbox 는 원본 그룹의 bbox 가 아니라 텍스트 제외한 잔여물 bbox 사용
                                //   → 텍스트 위치까지 흰 박스로 잡히지 않게.
                                //   visualCopy 를 임시 마운트해서 측정.
                                var visTmp = document.createElement('div');
                                visTmp.style.cssText = 'position:absolute; left:-99999px; top:-99999px; pointer-events:none;';
                                var visWrap = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                                            + 'viewBox="' + vbX + ' ' + vbY + ' ' + svgW + ' ' + svgH + '" '
                                            + 'width="' + svgW + '" height="' + svgH + '">'
                                            + defsHtml + visualCopy.outerHTML + '</svg>';
                                visTmp.innerHTML = visWrap;
                                document.body.appendChild(visTmp);
                                var visRenderedSvg = visTmp.querySelector('svg');
                                var visTarget = visRenderedSvg.children[visRenderedSvg.children.length - 1];
                                var vbb = _docBBox(visTarget);
                                visTmp.remove();
                                if (vbb && vbb.width > 0 && vbb.height > 0) {
                                    var vx = (vbb.x - vbX) * fitScale + offX;
                                    var vy = (vbb.y - vbY) * fitScale + offY;
                                    var vw = vbb.width * fitScale;
                                    var vh = vbb.height * fitScale;
                                    var partSvg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                                                + 'viewBox="' + vbb.x + ' ' + vbb.y + ' ' + vbb.width + ' ' + vbb.height + '" '
                                                + 'width="' + vbb.width + '" height="' + vbb.height + '">'
                                                + defsHtml + visualCopy.outerHTML + '</svg>';
                                    var dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(partSvg)));
                                    // 2026-06-18 v615: toBack:true → z-index=0, me.items 맨 앞 unshift.
                                    //   → 텍스트(z=zCounter++)가 항상 위에 위치 → 텍스트 클릭이 시각에 가려지지 않음.
                                    pendingImageLoads++;
                                    (function(capturedIdx){
                                        window._meAddImage(dataUrl, { explicitPos: { x: vx, y: vy, w: vw, h: vh }, toBack: true }, function(addedItem){
                                            if (addedItem) {
                                                visualItemsByChildIdx[capturedIdx] = addedItem;
                                                // 2026-06-28: 배경 잠금 제거 — 템플릿/SVG 의 배경도 자유롭게 선택·편집 가능하게.
                                                console.log('[svg upload] visual added child', capturedIdx, 'size', vw.toFixed(0)+'x'+vh.toFixed(0));
                                            }
                                            _decPending();
                                        });
                                    })(idx);
                                    added++;
                                    addedVisual = true;
                                }
                            }
                        }
                    }

                    // (B) 그룹 내부의 모든 <text> 를 각각 편집 가능한 text item 으로 추출
                    allTexts.forEach(function(textNode) {
                        var renderedText = _findRendered(textNode);
                        if (!renderedText) {
                            console.warn('[svg upload] text node render lookup failed:', textNode.textContent);
                            return;
                        }
                        var tbb = _docBBox(renderedText);
                        // v617: 작은 글씨/외곽선 케이스 진단
                        console.log('[svg upload] text candidate child=' + idx,
                            'content=' + (textNode.textContent || '').trim().slice(0, 40),
                            'bbox=' + (tbb ? (tbb.width.toFixed(1) + 'x' + tbb.height.toFixed(1)) : 'null'));
                        if (!tbb || tbb.width <= 0 || tbb.height <= 0) {
                            console.warn('[svg upload] text zero bbox:', textNode.textContent);
                            return;
                        }
                        var tmeta = _extractTextFromSvg(textNode, renderedText);
                        if (!tmeta) return;
                        // 2026-06-18 v615: 텍스트 bbox 좌우 패딩 — getBBox 는 글자 외곽선 딱 맞춤 → 폴백 폰트는 더 넓어 줄바꿈 발생.
                        //   30% 폭 + 20% 높이 여유로 wrap 방지. 정렬 보존 위해 anchor 따라 x 이동.
                        var padX = tbb.width * 0.15;
                        var padY = tbb.height * 0.10;
                        var tx = (tbb.x - vbX) * fitScale + offX - padX * fitScale;
                        var ty = (tbb.y - vbY) * fitScale + offY - padY * fitScale;
                        var tw = (tbb.width + padX * 2) * fitScale;
                        var th = (tbb.height + padY * 2) * fitScale;
                        var ti = _addExtractedText(tmeta, { x: tx, y: ty, w: tw, h: th });
                        if (!firstItem) firstItem = ti;
                        added++;
                    });
                });
            } finally {
                tmp.remove();
            }

            // 2026-06-28: 배경 잠금 제거 — 더 이상 배경을 잠그지 않음 (모든 요소 자유 편집).
            _onAllLoaded(function(){
                try { _meUpdateUnlockBgBtn(); } catch(_) {}
                console.log('[svg upload] split into', added, '/', topChildren.length, 'items (no bg lock); me.items:', me.items.length);
            });
            if (added === 0) {
                // 전부 실패 — 통째 import 로 폴백
                var fb3 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
                window._meAddImage(fb3, { fitCanvas: true });
            }
        } catch (e) {
            console.warn('[svg upload] parse failed', e);
            var fbErr = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
            window._meAddImage(fbErr, { fitCanvas: true });
        }
    };

    // 2026-06-18 v610: 배경 잠금 풀기 버튼 — 잠긴 배경이 있을 때만 활성/노출.
    function _meUpdateUnlockBgBtn() {
        var btn = document.getElementById('meUnlockBgBtn');
        if (!btn) return;
        var hasLocked = (me.items || []).some(function(it){ return it && it._isBackground; });
        btn.style.display = hasLocked ? '' : 'none';
    }
    window._meUpdateUnlockBgBtn = _meUpdateUnlockBgBtn;

    window._meUnlockBackground = function() {
        _meSnapshot();
        (me.items || []).forEach(function(it) {
            if (it && it._isBackground) {
                it._isBackground = false;
                if (it.el) {
                    it.el.style.cursor = '';
                    it.el.classList.remove('me-bg-locked');
                }
            }
        });
        _meUpdateUnlockBgBtn();
    };

    // 2026-06-25: QR코드 추가 — 인스타/홈페이지 URL 입력 → QR 생성 → 캔버스 중앙에 이미지로 배치.
    //   qrcode@1.5.1 (window.QRCode.toDataURL) 사용. 명함 뒷면 등에 활용.
    window._meAddQR = function(editItem) {
        var _isEdit = !!(editItem && editItem._isQr);
        var lang = (document.documentElement.lang || 'ko');
        var T = function(ko, ja, en){ return lang === 'ja' ? ja : (lang === 'en' ? en : ko); };
        var prev = document.getElementById('meQrModal'); if (prev) prev.remove();
        var ov = document.createElement('div');
        ov.id = 'meQrModal';
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483300;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;font-family:Pretendard,-apple-system,system-ui,sans-serif;';
        ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;width:min(360px,calc(100vw - 32px));box-sizing:border-box;">'
            + '<div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:6px;">📱 ' + (_isEdit ? T('QR코드 수정','QRコード編集','Edit QR code') : T('QR코드 추가','QRコード追加','Add QR code')) + '</div>'
            + '<div style="font-size:12.5px;color:#6b7280;margin-bottom:12px;line-height:1.5;">' + T('인스타 주소나 회사 홈페이지를 입력하면 중앙에 QR이 생성돼요.','インスタや会社サイトのURLを入力すると中央にQRが入ります。','Enter your Instagram or website URL — a QR appears in the center.') + '</div>'
            + '<input id="meQrInput" type="text" inputmode="url" placeholder="https://instagram.com/yourid" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;" />'
            + '<div style="display:flex;gap:8px;margin-top:14px;">'
            + '<button id="meQrCancel" style="flex:none;padding:11px 14px;border:none;border-radius:10px;background:#f3f4f6;color:#4b5563;font-weight:700;cursor:pointer;font-family:inherit;">' + T('취소','キャンセル','Cancel') + '</button>'
            + '<button id="meQrGo" style="flex:1;padding:11px;border:none;border-radius:10px;background:#6d28d9;color:#fff;font-weight:800;cursor:pointer;font-family:inherit;">' + (_isEdit ? T('수정 적용','変更を適用','Update') : T('QR 생성','QR作成','Create QR')) + '</button>'
            + '</div></div>';
        document.body.appendChild(ov);
        var inp = ov.querySelector('#meQrInput');
        if (_isEdit && editItem._qrUrl) inp.value = editItem._qrUrl;
        var close = function(){ ov.remove(); };
        setTimeout(function(){ try { inp.focus(); } catch(_){} }, 30);
        ov.querySelector('#meQrCancel').onclick = close;
        ov.addEventListener('pointerdown', function(e){ if (e.target === ov) close(); });
        var go = function(){
            var url = (inp.value || '').trim();
            if (!url) { try { inp.focus(); } catch(_){} return; }
            if (/^@/.test(url)) url = 'https://instagram.com/' + url.replace(/^@+/, '');
            else if (!/^https?:\/\//i.test(url) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
            var _goBtn = ov.querySelector('#meQrGo');
            if (_goBtn) { _goBtn.disabled = true; _goBtn.textContent = T('생성 중...','作成中...','Creating...'); }
            // QR 라이브러리가 아직(lazy) 안 떴으면 즉시 로드 후 생성
            _meEnsureQRLib().then(function(){
            return Promise.resolve(window.QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }))
                .then(function(dataUrl){
                    if (!dataUrl) throw new Error('empty');
                    if (_isEdit) {
                        // 기존 QR 교체 — 위치/크기 유지, src·URL 만 갱신
                        if (typeof _meSnapshot === 'function') _meSnapshot();
                        editItem.src = dataUrl;
                        editItem._qrUrl = url;
                        try { var _qimg = editItem.el.querySelector('img'); if (_qimg) _qimg.src = dataUrl; } catch(_){}
                        _meSyncItemDisplay(editItem);
                    } else {
                        var side = Math.round(Math.min(me.natW, me.natH) * 0.42);
                        var x = Math.round((me.natW - side) / 2);
                        var y = Math.round((me.natH - side) / 2);
                        window._meAddImage(dataUrl, { explicitPos: { x: x, y: y, w: side, h: side } }, function(added){
                            if (added) { added._isQr = true; added._qrUrl = url; }
                        });
                    }
                    close();
                })
                .catch(function(e){
                    console.warn('[me qr]', e);
                    if (_goBtn) { _goBtn.disabled = false; _goBtn.textContent = T('QR 생성','QR作成','Create QR'); }
                    alert(T('QR 생성 실패 — 주소를 확인해주세요.','QR作成失敗 — URLをご確認ください。','Failed to create QR — check the URL.'));
                });
            }).catch(function(le){
                console.warn('[me qr lib]', le);
                if (_goBtn) { _goBtn.disabled = false; _goBtn.textContent = T('QR 생성','QR作成','Create QR'); }
                alert(T('QR 라이브러리를 불러오지 못했어요. 잠시 후 다시 시도해주세요.','QRライブラリを読み込めませんでした。少し待って再試行。','Could not load QR library. Try again shortly.'));
            });
        };
        ov.querySelector('#meQrGo').onclick = go;
        inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); go(); } });
    };

    // 2026-06-25: QR 라이브러리(qrcode@1.5.1) 보장 로드 — lazy 로딩이 안 끝났거나 실패해도 즉시 주입.
    var _meQrLibPromise = null;
    function _meEnsureQRLib() {
        if (window.QRCode && typeof window.QRCode.toDataURL === 'function') return Promise.resolve();
        if (_meQrLibPromise) return _meQrLibPromise;
        _meQrLibPromise = new Promise(function(resolve, reject){
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js';
            s.async = true;
            s.onload = function(){ (window.QRCode && window.QRCode.toDataURL) ? resolve() : reject(new Error('QRCode global missing')); };
            s.onerror = function(){ _meQrLibPromise = null; reject(new Error('script load error')); };
            document.head.appendChild(s);
        });
        return _meQrLibPromise;
    }

    window._meAddImage = function(src, opts, onAdded) {
        opts = opts || {};
        if (!src) { console.warn('[_meAddImage] empty src'); return; }
        _meSnapshot();
        // src 가 거대한 dataURL 일 수 있어 로그는 짧게 (80자 + 길이)
        var _logSrc = (src.length > 200) ? src.slice(0, 80) + '... [' + src.length + ' chars]' : src;
        var im = new Image();
        // 2026-06-14: crossOrigin 제거 — Supabase 가 anonymous CORS 응답 없어서 silent fail.
        //   export 시 tainted canvas 가능성 있지만 display 우선.
        im.onerror = function() {
            console.warn('[_meAddImage] load failed:', _logSrc);
            if (typeof onAdded === 'function') onAdded(null);
        };
        // 2026-06-18 v614: onAdded 콜백 — 비동기 onload 후 추가된 item 을 알려주는 용도 (SVG import 의 firstItem 추적)
        im.onload = function() {
            var added = _placeImageOnStage(im, src, opts);
            if (typeof onAdded === 'function') onAdded(added);
        };
        im.src = src;

        function _placeImageOnStage(image, srcUrl, options) {
            if (!me || !me.stage) { console.warn('[_meAddImage] me.stage null'); return; }
            // 0 naturalWidth (예: SVG without explicit width) → fallback 800x600
            var natW = image.naturalWidth || 800;
            var natH = image.naturalHeight || 600;
            var ratio = natH / natW;
            var w, h, x, y;
            // 2026-06-18 v609: SVG 그룹별 import 시 정확한 좌표/크기 지정
            if (options.explicitPos && typeof options.explicitPos === 'object') {
                x = options.explicitPos.x;
                y = options.explicitPos.y;
                w = options.explicitPos.w;
                h = options.explicitPos.h;
            } else if (options.fitCanvas) {
                // 2026-06-17: 대지 비율 맞춰 fit (contain) — 이미지가 절대 잘리지 않게 안쪽에 완벽히 들어감.
                //   업로드한 완성파일(PDF/이미지) 처럼 이미지 자체가 디자인이라 cropping 절대 불가.
                var stageRatioF = me.natH / me.natW;
                if (ratio > stageRatioF) {
                    // 이미지가 캔버스보다 세로로 김 → 세로를 캔버스에 맞추면 가로 overflow → 가로 기준 fit
                    h = me.natH; w = h / ratio;
                } else {
                    // 이미지가 캔버스보다 가로로 김 → 가로 기준 fit
                    w = me.natW; h = w * ratio;
                }
                x = (me.natW - w) / 2;
                y = (me.natH - h) / 2;
            } else if (options.fillCanvas) {
                // 대지 꽉 채우기 (cover 처럼): 대지 비율에 맞춰 한 변을 100% 로 — 일부 잘릴 수 있음 (템플릿용).
                var stageRatio = me.natH / me.natW;
                if (ratio > stageRatio) {
                    w = me.natW; h = w * ratio;
                } else {
                    h = me.natH; w = h / ratio;
                }
                x = (me.natW - w) / 2;
                y = (me.natH - h) / 2;
            } else {
                // 2026-06-15: 요소(rail/popup) 추가 시 기본 크기 — 사용자 피드백 따라 더 작게.
                //   50% → 35% → 22% 로 축소. 사용자는 핸들로 키울 수 있으므로 작게 시작이 안전.
                w = Math.min(me.natW * 0.22, natW);
                if (w < 50) w = me.natW * 0.22;  // SVG fallback
                h = w * ratio;
                if (h > me.natH * 0.3) { h = me.natH * 0.3; w = h / ratio; }
                x = (me.natW - w) / 2;
                y = (me.natH - h) / 2;
            }
            var el = document.createElement('div');
            el.className = 'me-item';
            // 제일 뒤로 보내기 (z-index 0) — 템플릿용
            if (options.toBack) {
                el.style.zIndex = '0';
            } else {
                el.style.zIndex = (++me.zCounter);
            }
            var img = document.createElement('img');
            img.src = srcUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = options.fillCanvas ? 'cover' : 'contain';
            el.appendChild(img);
            me.stage.appendChild(el);
            var it = { el: el, type: 'image', x: x, y: y, w: w, h: h, src: srcUrl };
            // 제일 뒤로: items 배열의 맨 앞에 삽입 (export 시 먼저 그림 → 아래 쌓임)
            if (options.toBack) {
                me.items.unshift(it);
            } else {
                me.items.push(it);
            }
            _meSyncItemDisplay(it);
            _meBindDrag(it);
            // toBack 일 땐 자동 선택 X (선택 핸들이 백그라운드 위에 떠서 거슬림)
            if (!options.toBack) _meSelect(it);
            return it;
        }
    };

    window._meAddText = function() {
        _meSnapshot();
        var T = _meUiT;
        var placeholder = T('me_text_placeholder', '클릭하여 글씨 입력');
        // 사이트 언어의 주요 폰트 (Sans 제외 첫 번째) 를 디폴트로
        var fonts = _meCurrentFonts();
        var defaultFam = 'sans-serif';
        var defaultWeights = null;
        for (var i = 0; i < fonts.length; i++) {
            if (fonts[i].font_family !== 'sans-serif') {
                defaultFam = '"' + fonts[i].font_family + '"';
                defaultWeights = fonts[i].weights;
                _meLoadFont(fonts[i].font_family, fonts[i].weights);
                break;
            }
        }
        var el = document.createElement('div');
        el.className = 'me-item text';
        el.style.zIndex = (++me.zCounter);
        el.textContent = placeholder;
        me.stage.appendChild(el);
        var it = {
            el: el, type: 'text',
            x: me.natW * 0.2, y: me.natH * 0.4,
            w: me.natW * 0.6, h: 60,
            text: placeholder,
            fill: '#1d1d1f',
            fontSize: Math.max(20, me.natH * 0.06),
            fontFamily: defaultFam,
            letterSpacing: 0,
            lineHeight: 1.2,
            // 2026-06-15: 새 글씨 기본 정렬 가운데 (사용자 요청).
            textAlign: 'center'
        };
        me.items.push(it);
        _meSyncItemDisplay(it);
        _meBindDrag(it);
        _meSelect(it);
        // 2026-06-25: 새 텍스트도 textarea 모달로 편집 (인라인 contenteditable 폐지).
        //   모바일 일본어/한국어 IME(히라가나↔한자 변환 등)가 transform 된 contenteditable 에서 깨지던 문제 해결.
        setTimeout(function(){
            try { if (typeof _meOpenTextEditModal === 'function') _meOpenTextEditModal(it); } catch(_){}
        }, 30);
    };

    // 2026-06-15: 상단 색상 chip 통합 — 선택 상태에 따라 글씨/도형 색 vs 배경에 적용.
    //   - text 선택 → fill 변경 (글씨 색)
    //   - shape 선택 → fill 변경 (도형 채움)
    //   - 그 외 (이미지/none) → 캔버스 배경
    window._meSetBg = function(color) {
        _meSnapshot();
        var sel = me && me.selected;
        if (sel && sel.type === 'text') {
            sel.fill = color;
            _meSyncItemDisplay(sel);
        } else if (sel && sel.type === 'shape') {
            sel.fill = color;
            _meSyncItemDisplay(sel);
        } else {
            me.bg = color;
            $('meStage').style.background = color;
        }
    };
    // chip 의 value 를 현재 컨텍스트에 동기화 (선택 변경 시 호출 — _meRenderProps 끝/_meSelect 에서 호출).
    window._meSyncBgChip = function() {
        var input = document.getElementById('meBgColor');
        if (!input) return;
        var sel = me && me.selected;
        var tooltip;
        if (sel && (sel.type === 'text' || sel.type === 'shape')) {
            // 2026-07-14: 칼선 등 fill:'transparent' 이면 color input(#rrggbb 전용)에 넣으면 경고 → 기본색으로.
            input.value = /^#[0-9a-fA-F]{6}$/.test(sel.fill || '') ? sel.fill : '#1e293b';
            tooltip = (sel.type === 'text') ? '글씨 색상' : '도형 색상';
        } else {
            input.value = me.bg || '#ffffff';
            tooltip = '배경색';
        }
        var lbl = input.closest('.me-color-wrap');
        if (lbl) lbl.title = tooltip;
    };

    function _meT(k, fb) {
        return _meUiT(k, fb);
    }

    // 2026-06-15: 별도 패널 폐기 — 에디터에서 선택된 이미지에 직접 누끼따기 적용.
    //   기존 _meImportCutout 은 외부 panel 의 결과를 가져오는 방식이라 폐기.
    window._meBgRemoveSelected = async function() {
        var sel = me && me.selected;
        if (!sel || sel.type !== 'image' || !sel.src) {
            alert(_meT('me_alert_cutout','먼저 누끼를 따고 싶은 이미지를 선택해주세요'));
            return;
        }
        var btn = $('meBgRemoveBtn');
        var origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:11px; margin-right:4px;"></i>누끼 따는 중…';
        }
        try {
            // src 가 dataURL 이면 base64 추출, 외부 URL 이면 fetch 후 base64 변환.
            var base64;
            if (/^data:image\/[a-z]+;base64,/i.test(sel.src)) {
                base64 = sel.src.split(',')[1];
            } else {
                var res = await fetch(sel.src, { mode:'cors' });
                if (!res.ok) throw new Error('이미지 fetch 실패 (HTTP ' + res.status + ')');
                var blob = await res.blob();
                base64 = await new Promise(function(resolve, reject){
                    var r = new FileReader();
                    r.onload = function(){ resolve(String(r.result).split(',')[1]); };
                    r.onerror = function(){ reject(new Error('이미지 base64 변환 실패')); };
                    r.readAsDataURL(blob);
                });
            }
            var resp = await fetch(SB_URL + '/functions/v1/bg-remove', {
                method: 'POST',
                headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+SB_KEY, 'apikey':SB_KEY },
                body: JSON.stringify({ image_base64: base64 })
            });
            var data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || ('HTTP ' + resp.status));
            if (!data.image_base64) throw new Error('배경 제거 결과가 비어있습니다');
            var newSrc = 'data:image/png;base64,' + data.image_base64;
            // 선택된 이미지의 src 교체 — el 의 <img> 와 sel.src 동시 갱신.
            sel.src = newSrc;
            if (sel.el) {
                var imgChild = sel.el.querySelector('img');
                if (imgChild) imgChild.src = newSrc;
                else sel.el.style.backgroundImage = 'url("' + newSrc + '")';
            }
            // 2026-06-18 v577: 누끼 결과 box 를 피사체 bbox 기준으로 resize + 위치 보정.
            //   이전 v576: x 만 보정 → 미세함. 이제 box 자체를 subject bbox 로 줄이고 원본 중심점 유지.
            try {
                var _adjImg = new Image();
                _adjImg.onload = function() {
                    try {
                        var _pngW = _adjImg.naturalWidth, _pngH = _adjImg.naturalHeight;
                        var _c = document.createElement('canvas');
                        _c.width = _pngW; _c.height = _pngH;
                        var _cx = _c.getContext('2d');
                        _cx.drawImage(_adjImg, 0, 0);
                        var _img = _cx.getImageData(0, 0, _pngW, _pngH);
                        var _d = _img.data;
                        var _minX = _pngW, _maxX = 0, _minY = _pngH, _maxY = 0;
                        for (var py = 0; py < _pngH; py += 2) {
                            for (var px = 0; px < _pngW; px += 2) {
                                var _ai = (py * _pngW + px) * 4 + 3;
                                if (_d[_ai] > 30) {
                                    if (px < _minX) _minX = px;
                                    if (px > _maxX) _maxX = px;
                                    if (py < _minY) _minY = py;
                                    if (py > _maxY) _maxY = py;
                                }
                            }
                        }
                        if (_maxX > _minX && _maxY > _minY) {
                            // 원래 box 의 중심점 보존
                            var _oldCx = sel.x + sel.w / 2;
                            var _oldCy = sel.y + sel.h / 2;
                            var _subjHRatio = (_maxY - _minY) / _pngH;
                            var _bw = _maxX - _minX, _bh = _maxY - _minY;
                            // 2026-07-10 FIX: 박스만 줄이면 전체 PNG(투명 여백 포함)가 눌려 피사체가 찌그러짐.
                            //   → 피사체 영역만 실제로 잘라내고(crop), 박스를 잘라낸 이미지의 실제 비율로 맞춘다.
                            var _cropCv = document.createElement('canvas');
                            _cropCv.width = _bw; _cropCv.height = _bh;
                            _cropCv.getContext('2d').drawImage(_adjImg, _minX, _minY, _bw, _bh, 0, 0, _bw, _bh);
                            var _croppedSrc = _cropCv.toDataURL('image/png');
                            // 피사체의 기존 화면 '높이'는 유지하고, 폭은 잘라낸 이미지 비율로 결정 → 왜곡 0
                            var _newH = sel.h * _subjHRatio;
                            var _newW = _newH * (_bw / _bh);
                            sel.w = _newW;
                            sel.h = _newH;
                            sel.x = _oldCx - sel.w / 2;
                            sel.y = _oldCy - sel.h / 2;
                            // 잘라낸(투명 여백 제거) 이미지로 src 교체
                            sel.src = _croppedSrc;
                            if (sel.el) {
                                var _icrop = sel.el.querySelector('img');
                                if (_icrop) _icrop.src = _croppedSrc;
                                else sel.el.style.backgroundImage = 'url("' + _croppedSrc + '")';
                            }
                            _meSyncItemDisplay(sel);
                            console.log('[me cutout v578] cropped to subject — box w=' + Math.round(sel.w) + ' h=' + Math.round(sel.h) + ' cropAspect=' + (_bw/_bh).toFixed(2));
                        } else {
                            console.warn('[me cutout v577] no subject pixels found (alpha threshold)');
                        }
                        // 2026-07-11: 크롭(피사체 bbox 보정) 완료 알림 — 자동 칼선 플로우가 정확한 박스로 trace 하도록.
                        try { document.dispatchEvent(new CustomEvent('me-cutout-cropped')); } catch(_cev){}
                    } catch(_ce) { console.warn('[me cutout v577] center adjust failed', _ce); }
                };
                _adjImg.src = newSrc;
            } catch(_ae){}
            // history 갱신 (Ctrl+Z 로 원본 복귀)
            if (typeof _meSnapshot === 'function') { try { _meSnapshot(); } catch(e){} }
            // 2026-07-11: 배경제거(누끼) 완료 알림 — 튜토리얼 등이 실제 완료 후 다음 단계로 진행하도록.
            try { document.dispatchEvent(new CustomEvent('me-cutout-done')); } catch(_ev){}
        } catch (e) {
            console.error('[me bgRemove]', e);
            alert('⚠️ ' + (e.message || '배경 제거 실패. 잠시 후 다시 시도해주세요'));
        } finally {
            if (btn) {
                btn.innerHTML = origHtml;
                // 선택 상태에 맞춰 활성/비활성
                var stillSelected = (me && me.selected && me.selected.type === 'image');
                btn.disabled = !stillSelected;
                btn.style.opacity = stillSelected ? '1' : '0.45';
                btn.style.cursor = stillSelected ? 'pointer' : 'not-allowed';
            }
        }
    };
    // 레거시 호환 — 다른 곳에서 호출 시 위로 위임.
    window._meImportCutout = window._meBgRemoveSelected;

    // 2026-07-11: 등신대/자유인쇄커팅 자동 플로우 — 배경제거(누끼) → 크롭 완료 대기 → TYPE A(outer) 칼선 자동.
    //   튜토리얼 '자동 배경제거 및 칼선작업' 버튼용. 완료되면 me-standee-ready 이벤트로 다음 단계 진행.
    function _meAutoSelectImage() {
        var sel = me && me.selected;
        if (sel && sel.type === 'image') return sel;
        var img = (me.items || []).filter(function(i){ return i && i.type === 'image'; }).pop();
        if (img && typeof _meSelect === 'function') { _meSelect(img); return me.selected; }
        return null;
    }
    window._meAutoBgAndCutline = async function() {
        var sel = _meAutoSelectImage();
        if (!sel || sel.type !== 'image') {
            alert(_meT('me_alert_cutout','먼저 누끼를 따고 싶은 이미지를 선택해주세요'));
            return;
        }
        // 크롭(피사체 bbox 보정) 완료 신호 — bgRemove 호출 전에 리스너 등록해 이벤트를 놓치지 않게.
        var _cropRes; var croppedP = new Promise(function(res){ _cropRes = res; });
        var onCropped = function(){ document.removeEventListener('me-cutout-cropped', onCropped); _cropRes(); };
        document.addEventListener('me-cutout-cropped', onCropped);
        try { await window._meBgRemoveSelected(); } catch(_){}
        // 폴백 타이머는 bgRemove '완료 후' 시작 → API 지연(수 초)이 트레이스를 앞당기지 않게 (좁게 잡히던 원인).
        await Promise.race([ croppedP, new Promise(function(r){ setTimeout(r, 2500); }) ]);
        document.removeEventListener('me-cutout-cropped', onCropped);
        // 크롭된 이미지가 완전히 디코드된 뒤에만 trace (덜 로드된 상태면 알파가 비어 좁게 잡힘)
        try {
            var s2 = me && me.selected, im2 = s2 && s2.el && s2.el.querySelector('img');
            if (im2) {
                if (!im2.complete) await new Promise(function(r){ im2.onload = r; im2.onerror = r; setTimeout(r, 1500); });
                if (im2.decode) { try { await im2.decode(); } catch(_){} }
            }
        } catch(_){}
        try { await _meCutlineTrace('outer'); } catch(_){}
        try { document.dispatchEvent(new CustomEvent('me-standee-ready')); } catch(_){}
    };
    // 2026-07-14: 스티커 복잡모양 전용 — 누끼 후 크롭된 피사체를 대지에 크게 채운 뒤 칼선 트레이스.
    //   (기존엔 크롭된 피사체가 작아서 칼선이 작고 지저분하게 잡히고, 작아서 만지기 어려움 — 모바일/일본 문제.)
    //   피사체를 대지 92%로 키움 → 트레이스 고해상 + 이미지가 커서 드래그로 위치 조정 쉬움(PC/모바일 동일).
    window._meStickerAutoCutout = async function() {
        // 재실행 시 이전에 분리해둔 칼선 item 제거 (중복 방지)
        try { if (typeof window._meRemoveShapeCutline === 'function') window._meRemoveShapeCutline(); } catch(_){}
        var sel = _meAutoSelectImage();
        if (!sel || sel.type !== 'image') {
            alert(_meT('me_alert_cutout','먼저 누끼를 따고 싶은 이미지를 선택해주세요'));
            return;
        }
        var _cropRes; var croppedP = new Promise(function(res){ _cropRes = res; });
        var onCropped = function(){ document.removeEventListener('me-cutout-cropped', onCropped); _cropRes(); };
        document.addEventListener('me-cutout-cropped', onCropped);
        try { await window._meBgRemoveSelected(); } catch(_){}
        await Promise.race([ croppedP, new Promise(function(r){ setTimeout(r, 2500); }) ]);
        document.removeEventListener('me-cutout-cropped', onCropped);
        // 크롭된 피사체를 대지 92%로 확대(중앙) — 트레이스 전에 키워야 칼선이 크고 깔끔.
        try {
            var it = me && me.selected;
            var im0 = it && it.el && it.el.querySelector('img');
            if (im0 && !im0.complete) await new Promise(function(r){ im0.onload = r; im0.onerror = r; setTimeout(r, 1500); });
            if (it && it.w > 0 && it.h > 0) {
                var r0 = it.h / it.w;
                var maxW = me.natW * 0.92, maxH = me.natH * 0.92;
                var w = maxW, h = w * r0;
                if (h > maxH) { h = maxH; w = h / r0; }
                it.w = w; it.h = h;
                it.x = (me.natW - w) / 2; it.y = (me.natH - h) / 2;
                if (typeof _meSyncItemDisplay === 'function') _meSyncItemDisplay(it);
            }
        } catch(_){}
        // 확대된 이미지가 완전히 디코드된 뒤 trace (고해상)
        try {
            var s2 = me && me.selected, im2 = s2 && s2.el && s2.el.querySelector('img');
            if (im2) {
                if (!im2.complete) await new Promise(function(r){ im2.onload = r; im2.onerror = r; setTimeout(r, 1500); });
                if (im2.decode) { try { await im2.decode(); } catch(_){} }
            }
        } catch(_){}
        try { await _meCutlineTrace('outer'); } catch(_){}
        // 2026-07-14: 트레이스된 칼선을 이미지에서 '분리'해 독립 이동/조정 가능한 칼선 item 으로 전환.
        //   → 모바일에서 칼선이 살짝 안 맞아도 점선을 드래그·핸들로 밀어서 맞출 수 있음(이미지와 따로).
        try {
            var _srcIt = me && me.selected;
            if (_srcIt && _srcIt.type === 'image' && _srcIt._cutlineRelPts && _srcIt._cutlineRelPts.length >= 3) {
                var _relPts = _srcIt._cutlineRelPts.map(function(p){ return p.slice(); });
                var _bx = _srcIt.x, _by = _srcIt.y, _bw = _srcIt.w, _bh = _srcIt.h;
                // 이미지에서 칼선 제거
                _srcIt._cutlineRelPts = null; _srcIt._cutlineMode = null; _srcIt._cutlineRays = null;
                // 같은 위치·크기에 독립 칼선 item 생성 (드래그·핸들·점선클릭으로 조정)
                var _cel = document.createElement('div');
                _cel.className = 'me-item shape';
                _cel.style.pointerEvents = 'none';
                _cel.style.zIndex = '1001';
                me.stage.appendChild(_cel);
                var _cutIt = {
                    el: _cel, type: 'shape', shape: 'rect',
                    x: _bx, y: _by, w: _bw, h: _bh,
                    fill: 'transparent', stroke: '#000000', strokeWidth: 0,
                    _isShapeCutline: true, _shapeCutlineKind: 'traced'
                };
                _cutIt._cutlineRelPts = _relPts;
                _cutIt._cutlineMode = 'outer';
                me.items.push(_cutIt);
                _meSyncItemDisplay(_cutIt);
                _meBindDrag(_cutIt);
                _meCutlineRenderAll();
                _meSelect(_cutIt);
            } else if (_srcIt && typeof _meSelect === 'function') {
                _meSelect(_srcIt);
            }
        } catch(_){}
        try { document.dispatchEvent(new CustomEvent('me-standee-ready')); } catch(_){}
    };
    // 네모 이미지 그대로 — 칼선 없이 진행 (튜토리얼 진행 이벤트만)
    window._meStandeeSkipCutline = function() {
        try { document.dispatchEvent(new CustomEvent('me-standee-ready')); } catch(_){}
    };

    // ─────────── 2026-07-14: 팬시 스티커 — 여러 이미지 배치 + 자동 누끼(투명 스킵)+칼선 ───────────
    // 이미지 자연 크기 로드 (그리드 fit 용).
    function _meLoadImgDims(src) {
        return new Promise(function(res){
            var im = new Image();
            im.onload  = function(){ res({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); };
            im.onerror = function(){ res({ w: 1, h: 1 }); };
            im.src = src;
        });
    }
    // 누끼(배경제거) 필요 여부 — 이미지 '테두리'가 불투명하면 배경이 있는 것 → 누끼 필요.
    //   이미 오려진(cutout) 스티커는 테두리가 투명 → 스킵. (전체 투명도 대신 테두리로 판정: 더 정확)
    window._meImageMostlyOpaque = function(it) {
        try {
            var img = it && it.el && it.el.querySelector('img');
            if (!img) return true;
            var S = 48;
            var cv = document.createElement('canvas'); cv.width = S; cv.height = S;
            var ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0, S, S);
            var data = ctx.getImageData(0, 0, S, S).data;
            var border = 0, borderOpaque = 0;
            for (var y = 0; y < S; y++) {
                for (var x = 0; x < S; x++) {
                    if (y !== 0 && y !== S - 1 && x !== 0 && x !== S - 1) continue;  // 테두리 링만
                    border++;
                    if (data[(y * S + x) * 4 + 3] >= 250) borderOpaque++;
                }
            }
            if (!border) return true;
            return (borderOpaque / border) > 0.5;   // 테두리 50%+ 불투명 → 배경 있음 → 누끼 필요
        } catch(_) { return true; }   // tainted/에러면 안전하게 누끼 시도
    };
    // 2026-07-14: 한 장씩 추가 — 기존 이미지 유지하고 다음 그리드 슬롯에 1장 추가 + (불투명이면) 누끼 + 칼선.
    //   opts.onStage(stage): 'place'|'bg'|'cut'|'done'. 반환: 추가된 item (실패 null).
    window._meAddOneBgCutline = async function(src, opts) {
        opts = opts || {};
        if (!src) return null;
        var existImgs = (me.items || []).filter(function(it){ return it.type === 'image'; });
        var idx = existImgs.length;   // 0-based 다음 슬롯
        if (idx >= 8) { try { alert(_meT('me_fancy_max','최대 8개까지 올릴 수 있어요.')); } catch(_){}; return null; }
        // 그리드(2열×4행 = 8칸, 세로 시트) 다음 슬롯 배치.
        var cols = 2, rows = 4;
        var pad = me.natW * 0.03;
        var cellW = (me.natW - pad * 2) / cols, cellH = (me.natH - pad * 2) / rows;
        var col = idx % cols, row = Math.floor(idx / cols);
        var cellX = pad + col * cellW, cellY = pad + row * cellH;
        var dims = await _meLoadImgDims(src);
        var r = (dims.h || 1) / (dims.w || 1);
        var maxW = cellW * 0.85, maxH = cellH * 0.85;
        var w = maxW, h = w * r;
        if (h > maxH) { h = maxH; w = h / r; }
        var x = cellX + (cellW - w) / 2, y = cellY + (cellH - h) / 2;
        if (typeof opts.onStage === 'function') { try { opts.onStage('place'); } catch(_) {} }
        var added = await new Promise(function(res){
            try { window._meAddImage(src, { explicitPos: { x: x, y: y, w: w, h: h } }, res); }
            catch(_) { res(null); }
        });
        if (!added) return null;
        _meSelect(added);
        if (window._meImageMostlyOpaque(added)) {
            if (typeof opts.onStage === 'function') { try { opts.onStage('bg'); } catch(_) {} }
            try { await window._meBgRemoveSelected(); } catch(_) {}
        }
        var img = added.el && added.el.querySelector('img');
        if (img && !img.complete) { await new Promise(function(rr){ img.onload = rr; img.onerror = rr; setTimeout(rr, 1500); }); }
        if (img && img.decode) { try { await img.decode(); } catch(_) {} }
        if (typeof opts.onStage === 'function') { try { opts.onStage('cut'); } catch(_) {} }
        try { await _meCutlineTrace('outer'); } catch(_) {}
        try { _meCutlineRenderAll(); } catch(_) {}
        if (typeof opts.onStage === 'function') { try { opts.onStage('done'); } catch(_) {} }
        return added;
    };
    // 여러 이미지를 그리드로 배치 후, 순차로 (불투명만) 누끼 + 전부 칼선. (일괄 — 현재 미사용, 보존)
    //   srcList: dataURL 배열, opts.onProgress(done, total). 반환: 추가된 item 배열.
    window._meBatchAddBgCutline = async function(srcList, opts) {
        opts = opts || {};
        srcList = (srcList || []).slice(0, 8);
        var n = srcList.length;
        if (!n) return [];
        try { _meSnapshot(); } catch(_) {}
        // 기존 items + 칼선 클리어 (재업로드 대비)
        (me.items || []).slice().forEach(function(it){ try { it.el.remove(); } catch(_) {} });
        me.items = []; me.selected = null;
        try { if (typeof window._meCutlineClear === 'function') window._meCutlineClear(); } catch(_) {}
        // 그리드 계산
        var cols = n <= 4 ? 2 : (n <= 9 ? 3 : 4);
        var rows = Math.ceil(n / cols);
        var pad = me.natW * 0.03;
        var cellW = (me.natW - pad * 2) / cols;
        var cellH = (me.natH - pad * 2) / rows;
        var items = [];
        for (var i = 0; i < n; i++) {
            var src = srcList[i];
            var dims = await _meLoadImgDims(src);
            var r = (dims.h || 1) / (dims.w || 1);
            var col = i % cols, row = Math.floor(i / cols);
            var cellX = pad + col * cellW, cellY = pad + row * cellH;
            var maxW = cellW * 0.85, maxH = cellH * 0.85;
            var w = maxW, h = w * r;
            if (h > maxH) { h = maxH; w = h / r; }
            var x = cellX + (cellW - w) / 2, y = cellY + (cellH - h) / 2;
            /* eslint-disable no-loop-func */
            var added = await new Promise(function(res){
                try { window._meAddImage(src, { explicitPos: { x: x, y: y, w: w, h: h } }, res); }
                catch(_) { res(null); }
            });
            if (added) items.push(added);
        }
        // 순차 누끼(투명 스킵)+칼선
        for (var j = 0; j < items.length; j++) {
            var it2 = items[j];
            if (typeof opts.onProgress === 'function') { try { opts.onProgress(j, items.length); } catch(_) {} }
            try {
                _meSelect(it2);
                if (window._meImageMostlyOpaque(it2)) {
                    try { await window._meBgRemoveSelected(); } catch(_) {}
                }
                var img2 = it2.el && it2.el.querySelector('img');
                if (img2 && !img2.complete) { await new Promise(function(rr){ img2.onload = rr; img2.onerror = rr; setTimeout(rr, 1500); }); }
                if (img2 && img2.decode) { try { await img2.decode(); } catch(_) {} }
                try { await _meCutlineTrace('outer'); } catch(_) {}
            } catch(_) {}
        }
        if (typeof opts.onProgress === 'function') { try { opts.onProgress(items.length, items.length); } catch(_) {} }
        try { _meSelect(null); } catch(_) {}
        try { _meCutlineRenderAll(); } catch(_) {}
        return items;
    };

    // ─────────── 2026-06-27: 이미지 객체 '그림 변경' (요소 고르기 / 내사진 누끼 교체) ───────────
    //   선택 이미지의 src 만 교체 (위치는 중심 유지, 새 그림 비율로 박스 보정).
    function _meReplaceImageSrc(it, src) {
        if (!it || it.type !== 'image' || !src) return;
        if (typeof _meSnapshot === 'function') { try { _meSnapshot(); } catch(_) {} }
        it.src = src;
        if (it.el) {
            var img = it.el.querySelector('img');
            if (img) img.src = src;
            else it.el.style.backgroundImage = 'url("' + src + '")';
        }
        var probe = new Image();
        probe.onload = function () {
            try {
                var nw = probe.naturalWidth, nh = probe.naturalHeight;
                if (nw > 0 && nh > 0) {
                    var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
                    var newW = it.w, newH = newW * (nh / nw);   // 가로폭 유지, 비율 보정
                    it.w = newW; it.h = newH;
                    it.x = cx - newW / 2; it.y = cy - newH / 2;
                    _meSyncItemDisplay(it);
                }
            } catch (_) {}
        };
        probe.src = src;
    }
    window._meChangeImage = function (it) {
        if (!it || it.type !== 'image') return;
        var old = document.getElementById('meChangeImgModal'); if (old) old.remove();
        var ov = document.createElement('div');
        ov.id = 'meChangeImgModal';
        ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:20px;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff; border-radius:16px; padding:22px; width:min(420px,92vw); font-family:inherit;';
        box.innerHTML =
            '<div style="font-size:16px; color:#0f172a; margin-bottom:4px;">' + _meT('me_change_img', '그림 변경') + '</div>' +
            '<div style="font-size:12px; color:#64748b; margin-bottom:16px;">' + _meT('me_change_img_desc', '선택한 그림을 어떻게 바꿀까요?') + '</div>' +
            '<button type="button" id="meCiPick" style="width:100%; padding:14px; margin-bottom:10px; border:1px solid #c7d2fe; background:#eef2ff; color:#4338ca; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;">' + _meT('me_change_pick', '요소·클립아트에서 고르기') + '</button>' +
            '<button type="button" id="meCiUpload" style="width:100%; padding:14px; margin-bottom:10px; border:1px solid #bbf7d0; background:#f0fdf4; color:#15803d; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;">' + _meT('me_change_upload', '내 사진 올려서 배경 제거') + '</button>' +
            '<button type="button" id="meCiCancel" style="width:100%; padding:10px; border:none; background:transparent; color:#94a3b8; font-size:13px; cursor:pointer; font-family:inherit;">' + _meT('me_cancel', '취소') + '</button>';
        ov.appendChild(box); document.body.appendChild(ov);
        function close() { ov.remove(); }
        // 2026-06-27: 모바일 — 칩 pointerdown 으로 연 직후의 잔여 click 이 배경을 닫던 문제. pointerdown(배경 시작) 으로만 닫음.
        ov.addEventListener('pointerdown', function (e) { if (e.target === ov) close(); });
        box.querySelector('#meCiCancel').onclick = close;
        box.querySelector('#meCiPick').onclick = function () {
            close();
            if (window._soOpenObjPicker) window._soOpenObjPicker(function (url) { if (url) _meReplaceImageSrc(it, url); });
            else alert(_meT('me_change_noLib', '요소 라이브러리를 불러올 수 없습니다.'));
        };
        box.querySelector('#meCiUpload').onclick = function () {
            close();
            var inp = document.getElementById('meChangeImgInput');
            if (inp) { inp._targetIt = it; inp.value = ''; inp.click(); }
        };
    };
    window._meChangeImgUpload = function (input) {
        var f = input.files && input.files[0];
        var it = input._targetIt;
        input._targetIt = null;
        if (!f || !it) { input.value = ''; return; }
        var r = new FileReader();
        r.onload = function (e) {
            _meReplaceImageSrc(it, e.target.result);
            try { if (typeof _meSelect === 'function') _meSelect(it); } catch (_) {}
            // 업로드한 내 사진은 자동으로 배경 제거(누끼)
            setTimeout(function () { if (window._meBgRemoveSelected) window._meBgRemoveSelected(); }, 60);
        };
        r.readAsDataURL(f);
        input.value = '';
    };

    window._meClear = function() {
        if (!confirm(_meT('me_clear_confirm','캔버스의 모든 요소를 삭제할까요?'))) return;
        me.items.forEach(function(it){ it.el.remove(); });
        me.items = [];
        me.selected = null;
        _meRenderProps(null);
    };

    // ─── 레이어 순서 ───
    function _meZ(it){ return parseInt(it.el.style.zIndex || '0', 10); }
    function _meBringToFront(it) {
        me.zCounter += 1;
        it.el.style.zIndex = me.zCounter;
    }
    function _meSendToBack(it) {
        // 모든 z-index 1씩 올리고 대상은 1로
        var minZ = me.items.reduce(function(m, o){ return Math.min(m, _meZ(o)); }, Infinity);
        if (!isFinite(minZ)) minZ = 10;
        it.el.style.zIndex = (minZ - 1);
    }
    function _meBringForward(it) {
        var myZ = _meZ(it);
        var next = null;
        me.items.forEach(function(o){
            if (o === it) return;
            var z = _meZ(o);
            if (z > myZ && (!next || z < _meZ(next))) next = o;
        });
        if (!next) { _meBringToFront(it); return; }
        var nz = _meZ(next);
        next.el.style.zIndex = myZ;
        it.el.style.zIndex = nz;
    }
    function _meSendBackward(it) {
        var myZ = _meZ(it);
        var prev = null;
        me.items.forEach(function(o){
            if (o === it) return;
            var z = _meZ(o);
            if (z < myZ && (!prev || z > _meZ(prev))) prev = o;
        });
        if (!prev) { _meSendToBack(it); return; }
        var pz = _meZ(prev);
        prev.el.style.zIndex = myZ;
        it.el.style.zIndex = pz;
    }

    // ─── 컨텍스트 메뉴 ───
    var _meCtxEl = null;
    function _meHideCtxMenu() {
        if (_meCtxEl) { _meCtxEl.remove(); _meCtxEl = null; }
        document.removeEventListener('pointerdown', _meCtxOutside, true);
    }
    function _meCtxOutside(ev) {
        if (_meCtxEl && !_meCtxEl.contains(ev.target)) _meHideCtxMenu();
    }
    function _meShowCtxMenu(x, y, it) {
        _meHideCtxMenu();
        var menu = document.createElement('div');
        menu.className = 'me-ctx';
        menu.innerHTML =
            '<button data-act="front">' + _meT('me_ctx_front','맨 앞으로') + '</button>' +
            '<button data-act="forward">' + _meT('me_ctx_fwd','앞으로') + '</button>' +
            '<button data-act="backward">' + _meT('me_ctx_back','뒤로') + '</button>' +
            '<button data-act="back">' + _meT('me_ctx_bottom','맨 뒤로') + '</button>' +
            '<hr>' +
            '<button data-act="dup">' + _meT('me_ctx_dup','복제') + '</button>' +
            '<button class="danger" data-act="del">' + _meT('me_ctx_del','삭제') + '</button>';
        document.body.appendChild(menu);
        // 화면 밖 보정
        var vw = window.innerWidth, vh = window.innerHeight;
        var rect = menu.getBoundingClientRect();
        if (x + rect.width > vw - 8) x = vw - rect.width - 8;
        if (y + rect.height > vh - 8) y = vh - rect.height - 8;
        menu.style.left = Math.max(8, x) + 'px';
        menu.style.top = Math.max(8, y) + 'px';
        _meCtxEl = menu;
        setTimeout(function(){ document.addEventListener('pointerdown', _meCtxOutside, true); }, 0);
        menu.querySelectorAll('button').forEach(function(b){
            b.addEventListener('click', function(){
                var act = b.dataset.act;
                if (act === 'front') _meBringToFront(it);
                else if (act === 'forward') _meBringForward(it);
                else if (act === 'backward') _meSendBackward(it);
                else if (act === 'back') _meSendToBack(it);
                else if (act === 'dup') _meDuplicate(it);
                else if (act === 'del') _meRemove(it);
                _meHideCtxMenu();
            });
        });
    }

    function _meDuplicate(it) {
        var newZ = (++me.zCounter);
        if (it.type === 'image') {
            var clone = { el:null, type:'image', x: it.x + 20, y: it.y + 20, w: it.w, h: it.h, src: it.src };
            var el = document.createElement('div'); el.className = 'me-item';
            el.style.zIndex = newZ;
            var img = document.createElement('img'); img.src = it.src; el.appendChild(img);
            me.stage.appendChild(el); clone.el = el;
            me.items.push(clone); _meSyncItemDisplay(clone); _meBindDrag(clone); _meSelect(clone);
        } else if (it.type === 'text') {
            var el2 = document.createElement('div'); el2.className = 'me-item text';
            el2.style.zIndex = newZ;
            el2.textContent = it.el.textContent || it.text || '';
            me.stage.appendChild(el2);
            var c2 = Object.assign({}, it, { el: el2, x: it.x + 20, y: it.y + 20, text: el2.textContent });
            me.items.push(c2); _meSyncItemDisplay(c2); _meBindDrag(c2); _meSelect(c2);
        } else if (it.type === 'shape') {
            var el3 = document.createElement('div');
            el3.className = 'me-item shape' + (it.shape === 'circle' ? ' circle' : '');
            el3.style.zIndex = newZ;
            me.stage.appendChild(el3);
            var c3 = Object.assign({}, it, { el: el3, x: it.x + 20, y: it.y + 20 });
            me.items.push(c3); _meSyncItemDisplay(c3); _meBindDrag(c3); _meSelect(c3);
        }
    }

    // 2026-06-15: 캔버스 word-wrap — DOM 의 자동 wrap 을 PNG export 에서 재현.
    //   영문/숫자가 이어진 토큰은 단어 단위 wrap, 한글/CJK 는 글자 단위 wrap (DOM word-break: break-word 와 유사).
    function _meWrapText(ctx, text, maxW) {
        if (!text) return [''];
        var out = [];
        var cur = '';
        function widthOf(s) { return ctx.measureText(s).width; }
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            var test = cur + ch;
            if (widthOf(test) <= maxW || !cur) {
                cur = test;
                continue;
            }
            // 오버플로우 — 영문/숫자/하이픈 이어쓰기 중이면 마지막 공백에서 단어 단위로 끊기.
            var isLatin = /[A-Za-z0-9'\-]/.test(ch);
            var lastSpace = cur.lastIndexOf(' ');
            if (isLatin && lastSpace > 0 && /[A-Za-z0-9'\-]/.test(cur[lastSpace - 1] || '') === false) {
                // 별 의미 없음 — 그냥 공백 기준 자르기
            }
            if (isLatin && lastSpace > 0) {
                out.push(cur.slice(0, lastSpace));
                cur = cur.slice(lastSpace + 1) + ch;
            } else {
                out.push(cur);
                cur = ch;
            }
        }
        if (cur) out.push(cur);
        return out.length ? out : [''];
    }

    function _meDrawTextLineWithSpacing(ctx, line, x, y, letterSpacing) {
        if (!letterSpacing) { ctx.fillText(line, x, y); return; }
        var cur = x;
        for (var i = 0; i < line.length; i++) {
            var ch = line.charAt(i);
            ctx.fillText(ch, cur, y);
            cur += ctx.measureText(ch).width + letterSpacing;
        }
    }

    // 2026-06-15: 기존 _meDownload 는 이미지(async onload) 와 텍스트(sync) 가 섞일 때
    //   이미지 onload 가 텍스트 뒤에 fire 되면서 텍스트를 덮어쓰는 z-order 버그가 있었음.
    //   _meExportPNG 는 await new Promise() 로 이미지 로드까지 순서대로 처리하므로 안전 — 그것 재사용.
    // 2026-06-25: 다운로드 = 주문과 동일한 인쇄용 PDF(벡터/아웃라인). 명함 앞/뒤면이면 앞·뒤 둘 다.
    window._meDownload = async function(ev) {
        if (ev) ev.preventDefault();
        var _dlBlob = function(blob, name){
            var u = URL.createObjectURL(blob);
            var el = document.createElement('a');
            el.href = u; el.download = name;
            document.body.appendChild(el); el.click(); el.remove();
            setTimeout(function(){ try { URL.revokeObjectURL(u); } catch(_){} }, 5000);
        };
        try {
            // 양면(명함 앞/뒤) → 앞·뒤 PDF 둘 다 다운로드
            if (typeof window._meSidesEnabled === 'function' && window._meSidesEnabled() && typeof window._meExportBothSides === 'function') {
                var ex = await window._meExportBothSides();
                var did = false;
                if (ex && ex.front && ex.front.pdf) { _dlBlob(ex.front.pdf, 'my-design-front.pdf'); did = true; }
                if (ex && ex.back && ex.back.pdf) { setTimeout(function(){ _dlBlob(ex.back.pdf, 'my-design-back.pdf'); }, 500); did = true; }
                if (did) return false;
            }
            // 단면/일반 → 현재 캔버스를 PDF 로
            var pdf = (typeof window._meExportPDF === 'function') ? await window._meExportPDF() : null;
            if (pdf) { _dlBlob(pdf, 'my-design.pdf'); return false; }
            // 최후 폴백: PNG
            var url = await window._meExportPNG();
            if (!url) { alert('다운로드 실패 — 캔버스가 비어있거나 외부 이미지 CORS 차단'); return false; }
            var a = document.createElement('a');
            a.href = url; a.download = 'my-design.png';
            document.body.appendChild(a); a.click(); a.remove();
        } catch (e) {
            alert('다운로드 실패: ' + (e.message || e));
        }
        return false;
    };
    // 기존 동기 _meDownloadLegacy 는 시그니처 호환 위해 보존 (다른 곳 호출 없음, 안전 fallback).
    window._meDownloadLegacy = function(ev) {
        if (ev) ev.preventDefault();
        var c = document.createElement('canvas');
        c.width = me.natW; c.height = me.natH;
        var ctx = c.getContext('2d');
        ctx.fillStyle = me.bg; ctx.fillRect(0, 0, c.width, c.height);
        var sorted = me.items.slice().sort(function(a, b){
            var za = parseInt(a.el.style.zIndex || '0', 10);
            var zb = parseInt(b.el.style.zIndex || '0', 10);
            return za - zb;
        });
        var pending = sorted.length;
        function done() {
            try {
                var url = c.toDataURL('image/png');
                var a = document.createElement('a');
                a.href = url; a.download = 'my-design.png';
                document.body.appendChild(a); a.click(); a.remove();
            } catch (e) { alert('다운로드 실패: ' + (e.message || e)); }
        }
        if (pending === 0) { done(); return false; }
        sorted.forEach(function(it){
            if (it.type === 'image') {
                var im = new Image();
                im.crossOrigin = 'anonymous';
                im.onload = function(){
                    ctx.drawImage(im, it.x, it.y, it.w, it.h);
                    if (--pending === 0) done();
                };
                im.onerror = function(){
                    if (--pending === 0) done();
                };
                im.src = it.src;
            } else if (it.type === 'text') {
                ctx.fillStyle = it.fill || '#1d1d1f';
                ctx.font = '500 ' + Math.round(it.fontSize) + 'px ' + (it.fontFamily || 'sans-serif');
                ctx.textBaseline = 'top';
                var align = it.textAlign || 'left';
                var txt = it.el.textContent || it.text || '';
                var lines = txt.split(/\n/);
                var lineH = (it.fontSize || 20) * (it.lineHeight || 1.2);
                var ls = it.letterSpacing || 0;
                lines.forEach(function(line, i){
                    var measured = ctx.measureText(line).width + (line.length > 0 ? (line.length - 1) * ls : 0);
                    var drawX = it.x;
                    if (align === 'center') drawX = it.x + (it.w - measured) / 2;
                    else if (align === 'right') drawX = it.x + it.w - measured;
                    _meDrawTextLineWithSpacing(ctx, line, drawX, it.y + i * lineH, ls);
                });
                if (--pending === 0) done();
            } else if (it.type === 'shape') {
                ctx.fillStyle = it.fill || '#7c3aed';
                if (it.shape === 'circle') {
                    var rx = it.w / 2, ry = it.h / 2;
                    var cx = it.x + rx, cy = it.y + ry;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                    if ((it.strokeWidth || 0) > 0) {
                        ctx.lineWidth = it.strokeWidth;
                        ctx.strokeStyle = it.stroke || '#000';
                        ctx.stroke();
                    }
                } else {
                    ctx.fillRect(it.x, it.y, it.w, it.h);
                    if ((it.strokeWidth || 0) > 0) {
                        ctx.lineWidth = it.strokeWidth;
                        ctx.strokeStyle = it.stroke || '#000';
                        ctx.strokeRect(it.x, it.y, it.w, it.h);
                    }
                }
                if (--pending === 0) done();
            } else {
                if (--pending === 0) done();
            }
        });
        return false;
    };

    function _meInit() {
        me.stage = $('meStage');
        if (!me.stage) return;
        $('meStage').style.background = me.bg;
        // 2026-06-15: 초기 상태에도 props bar stub 표시 — 사용자가 컨트롤을 항상 볼 수 있게.
        try { _meRenderProps(null); } catch (e) {}
        // 사이즈 버튼
        var btns = document.querySelectorAll('#meSizes .me-size-btn');
        btns.forEach(function(b){
            b.addEventListener('click', function(){
                btns.forEach(function(o){ o.classList.remove('active'); });
                b.classList.add('active');
                _meSetSize(parseInt(b.dataset.w, 10), parseInt(b.dataset.h, 10), b.dataset.label);
            });
        });
        // 스테이지 빈 영역 클릭 → 편집 중인 텍스트 commit + 선택 해제
        me.stage.addEventListener('pointerdown', function(ev){
            if (ev.target === me.stage) {
                // 2026-06-14: 편집 중인 contenteditable 먼저 blur (텍스트 저장)
                var ce = me.stage.querySelector('[contenteditable="true"]');
                if (ce) ce.blur();
                _meSelect(null);
            }
        });
        // 2026-06-16: 빈 대지 클릭 → 이미지 업로드 창 자동 오픈. (요소가 이미 있으면 무시.)
        me.stage.addEventListener('click', function(ev){
            if (ev.target !== me.stage) return;
            if (me.items && me.items.length > 0) return;
            var inp = document.getElementById('meImgInput');
            if (inp) inp.click();
        });
        me.stage.addEventListener('contextmenu', function(ev){
            if (ev.target === me.stage) ev.preventDefault();
        });
        // Delete/Backspace 키 → 선택 항목 삭제 (텍스트 편집 중·input 포커스 중에는 무시)
        // 2026-06-14: 방향키 → 선택 항목 미세 이동 (1px / Shift 10px)
        // 2026-06-14: Ctrl/Cmd + Z → 되돌리기 (선택 없어도 동작)
        document.addEventListener('keydown', function(ev){
            // 입력 중에는 모든 단축키 무시 (Ctrl+Z 도 텍스트 편집 본연의 undo 가 우선)
            var ae = document.activeElement;
            if (ae) {
                var tag = (ae.tagName || '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
                if (ae.getAttribute && ae.getAttribute('contenteditable') === 'true') return;
            }
            // Ctrl+Z / Cmd+Z → undo (me.selected 없어도 동작)
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z') && !ev.shiftKey) {
                // 미니에디터가 켜져 있을 때만 (meStage 존재 + 화면에 표시 중)
                var stageVisible = me.stage && me.stage.offsetParent !== null;
                if (!stageVisible) return;
                ev.preventDefault();
                if (typeof window._meUndo === 'function') window._meUndo();
                return;
            }
            // 2026-06-14: Ctrl+D 복제
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) {
                if (!me.selected) return;
                var stageVis2 = me.stage && me.stage.offsetParent !== null;
                if (!stageVis2) return;
                ev.preventDefault();
                if (typeof window._meDuplicate === 'function') window._meDuplicate();
                return;
            }
            // 2026-06-19 v619: Ctrl+C 복사 / Ctrl+V 붙여넣기
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'c' || ev.key === 'C')) {
                if (!me.selected) return;
                var stageVisC = me.stage && me.stage.offsetParent !== null;
                if (!stageVisC) return;
                ev.preventDefault();
                if (typeof window._meCopy === 'function') window._meCopy();
                return;
            }
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'v' || ev.key === 'V')) {
                var stageVisV = me.stage && me.stage.offsetParent !== null;
                if (!stageVisV) return;
                ev.preventDefault();
                if (typeof window._mePaste === 'function') window._mePaste();
                return;
            }
            if (!me.selected) return;
            // 삭제
            if (ev.key === 'Delete' || ev.key === 'Backspace') {
                ev.preventDefault();
                _meRemove(me.selected);
                return;
            }
            // 방향키 — 미세 이동. Shift 시 10px. 자연 좌표계(natW/natH)에서 이동.
            var isArrow = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(ev.key) >= 0;
            if (!isArrow) return;
            ev.preventDefault();
            var step = ev.shiftKey ? 10 : 1;
            // me.wScale 가 display→natural 변환이므로 자연 단위는 step 그대로 적용 OK.
            //   step 은 display px 기준 — natural px 로 환산해 저장.
            var stepNat = step / (me.wScale || 1);
            var it = me.selected;
            switch (ev.key) {
                case 'ArrowUp':    it.y -= stepNat; break;
                case 'ArrowDown':  it.y += stepNat; break;
                case 'ArrowLeft':  it.x -= stepNat; break;
                case 'ArrowRight': it.x += stepNat; break;
            }
            // 캔버스 밖으로 나가지 않게 clamp (절반은 밖 허용 — 의도적 배치 가능)
            it.x = Math.max(-it.w * 0.5, Math.min(me.natW - it.w * 0.5, it.x));
            it.y = Math.max(-it.h * 0.5, Math.min(me.natH - it.h * 0.5, it.y));
            _meSyncItemDisplay(it);
        });
        _meFitStage();
        window.addEventListener('resize', _meFitStage);
        // 2026-07-18: 간편 진입 기본 — 편집 상세 UI(툴바·속성·qd-rail 등) 숨김. 작품 갤러리는 로드.
        //   meIntro 가 있을 때만(에디터 간편모드 사용처) 숨김 적용.
        try {
            if (document.getElementById('meIntro')) { _meEditUISet(false); }
            // window._meGalleryLoad 는 이 파일 뒤쪽(모듈 평가 후반)에서 할당됨 → setTimeout 안에서 확인/호출.
            //   window.sb 가 아직 준비 안 됐을 수 있어 준비될 때까지(최대 ~8s) 제한 재시도.
            if (document.getElementById('meGalTrackTop')) {
                var _galTries = 0;
                var _galTick = setInterval(function () {
                    _galTries++;
                    if (window.sb && window._meGalleryLoad) {
                        clearInterval(_galTick);
                        try { window._meGalleryLoad(''); } catch (_) {}
                    } else if (_galTries > 16) { clearInterval(_galTick); }
                }, 500);
            }
        } catch (_e0) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _meInit);
    else _meInit();

    // ─────────────────────── 누끼따기 ───────────────────────
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => {
                const dataUrl = e.target.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }

    window._aiNbBgFromFile = async function(input) {
        const f = input.files && input.files[0];
        if (!f) return;
        setError('aiNbBgErr', '');
        const emptyEl = $('aiNbBgPreview').querySelector('.aiNb-empty');
        if (emptyEl) emptyEl.style.display = 'none';
        // 기존 이미지 제거
        Array.from($('aiNbBgPreview').children).forEach(c => {
            if (c.tagName === 'IMG') c.remove();
        });
        showSpinner('aiNbBgSpinner', true);
        $('aiNbBgDl').classList.remove('show');
        try {
            const base64 = await fileToBase64(f);
            const resp = await fetch(SB_URL + '/functions/v1/bg-remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + SB_KEY,
                    'apikey': SB_KEY
                },
                body: JSON.stringify({ image_base64: base64 })
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || ('HTTP ' + resp.status));
            if (!data.image_base64) throw new Error('배경 제거 결과가 비어있습니다');
            const url = 'data:image/png;base64,' + data.image_base64;
            showSpinner('aiNbBgSpinner', false);
            showImgInPreview('aiNbBgPreview', url);
            const dl = $('aiNbBgDl');
            dl.href = url;
            dl.classList.add('show');
        } catch (e) {
            console.error('[aiNb] bgRemove', e);
            showSpinner('aiNbBgSpinner', false);
            if (emptyEl) emptyEl.style.display = 'block';
            setError('aiNbBgErr', '⚠️ ' + (e.message || '배경 제거 실패. 잠시 후 다시 시도해주세요'));
        } finally {
            input.value = '';
        }
    };

    // ══════════════════════════════════════════════════════════════════
    // 2026-07-10: 미니에디터 AI 이미지 생성 (모델 선택: 일반=Flux / 글자·포스터=Ideogram)
    //   툴바 [AI 이미지] 버튼 → window._meAiGenOpen(). 결과를 window._meAddImage 로 캔버스에 삽입.
    //   Ideogram: ai-image-gen(=dataURL) — 이미지 안 텍스트에 강함.  Flux: generate-image-flux(=storage URL) — 그림·배경.
    //   플랫 디자인(그림자·아이콘·볼드 도배 지양, CLAUDE.md §0).
    // ══════════════════════════════════════════════════════════════════
    function _meAiLang() {
        try { var s = (window.__SITE_CODE || '').toString().toUpperCase(); if (s === 'JP' || s === 'JA') return 'ja'; if (s === 'US' || s === 'EN') return 'en'; } catch (_) {}
        try { var l = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); if (l === 'ja' || l === 'jp') return 'ja'; if (l === 'en' || l === 'us') return 'en'; if (l === 'ko' || l === 'kr') return 'ko'; } catch (_) {}
        var h = (location.hostname || '').toLowerCase();
        // 2026-07-15: cotton-printer(패브릭 JP) / chameleon.design(글로벌 EN) 도 포함 — 빠져서 AI 생성 모달이 한국어로 남던 문제.
        if (h.indexOf('cafe0101') >= 0 || h.indexOf('cotton-printer') >= 0) return 'ja';
        if (h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) return 'en';
        return 'ko';
    }
    function _meAiTr(ko, ja, en) { var l = _meAiLang(); return l === 'ja' ? (ja || ko) : l === 'en' ? (en || ko) : ko; }

    var _meAiModel = 'ideogram';  // 2026-07-10: 글씨까지 넣는 GPT Image 2(ai-image-gen) 단일 사용. (flux/글씨없음 옵션 제거)
    var _meAiRatio = '16:9';      // 기본 가로 16:9
    var _meAiScarci = false;      // 2026-07-18: 글씨 스카시 = 입체 글씨 포토존 컨셉 모드
    var _meAiPaperDisplay = false;// 2026-07-18: 종이매대/허니콤테이블 = 제품 썸네일 구조 유지 목업 모드
    var _meAiPdIsTable = false;   // 2026-07-18: 위 모드 중 허니콤 테이블(hb_tb_*) 이면 true — 프롬프트만 다름
    var _meAiPendingUrl = null;
    var _meAiRefDataUrl = null;   // 2026-07-18: 참조 사진 (dataURL)
    var _meAiRefMode = 'blend';   // 'blend'=합성(내용 살림) | 'reference'=스타일만 참고(갤러리 픽) | 'structure'=형태 유지(종이매대 썸네일)

    function _meAiEnsureModal() {
        if (document.getElementById('meAiGenModal')) return;
        var wrap = document.createElement('div');
        wrap.id = 'meAiGenModal';
        wrap.style.cssText = 'position:fixed; inset:0; z-index:2147483200; background:rgba(15,23,42,0.5); display:none; align-items:center; justify-content:center; padding:16px; font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif;';
        wrap.innerHTML =
            '<div style="background:#fff; border-radius:16px; width:min(440px,100%); max-height:92vh; overflow-y:auto; padding:20px;">' +
              '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">' +
                '<div style="font-size:16px; color:#4338ca;">' + _meAiTr('AI 이미지 생성', 'AI画像生成', 'AI image') + '</div>' +
                '<button type="button" id="meAiClose" style="border:none; background:transparent; font-size:20px; color:#94a3b8; cursor:pointer; line-height:1;">✕</button>' +
              '</div>' +
              '<div id="meAiHint" style="font-size:13px; color:#64748b; margin-bottom:12px; line-height:1.6;">' +
                _meAiTr('타이틀을 입력해 주세요.', 'タイトルを入力してください。', 'Enter a title.') +
              '</div>' +
              // 2026-07-18: 입력 UI(프리셋·합성사진·프롬프트·생성버튼) 래퍼 — 스카시 자동모드에선 숨김
              '<div id="meAiInputArea">' +
              // 비율 선택 — 1행: 기본 비율 (2026-07-18: 16:9 등 비율표기 제거, 이름만)
              '<div style="display:flex; gap:6px; margin-bottom:8px;">' +
                '<button type="button" class="meAiRatioBtn" data-ratio="1:1" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid #4338ca; background:#eef2ff; color:#4338ca; font-size:12px; cursor:pointer; font-family:inherit;">' + _meAiTr('정사각', '正方形', 'Square') + '</button>' +
                '<button type="button" class="meAiRatioBtn" data-ratio="9:16" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit;">' + _meAiTr('세로포스터', '縦ポスター', 'Portrait') + '</button>' +
                '<button type="button" class="meAiRatioBtn" data-ratio="16:9" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit;">' + _meAiTr('가로포스터', '横ポスター', 'Landscape') + '</button>' +
              '</div>' +
              // 2행: 제품 전용 프리셋 — 가로현수막 / 세로배너 / 명함 (2026-07-18)
              //   가로현수막: 위아래 큰 여백 + 중앙 가로띠. 세로배너: 좌우 큰 여백 + 중앙 세로열. 명함: 사방 여백.
              '<div style="display:flex; gap:6px; margin-bottom:12px;">' +
                '<button type="button" class="meAiRatioBtn" data-ratio="banner-h" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit;">' + _meAiTr('가로현수막', '横断幕', 'Wide Banner') + '</button>' +
                '<button type="button" class="meAiRatioBtn" data-ratio="banner-v" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit;">' + _meAiTr('세로배너', '縦バナー', 'Tall Banner') + '</button>' +
                '<button type="button" class="meAiRatioBtn" data-ratio="namecard" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit;">' + _meAiTr('명함', '名刺', 'Card') + '</button>' +
              '</div>' +
              // 2026-07-18: 합성할 사진 넣기 — 넣으면 그 사진을 활용해 AI 가 디자인(gpt-image-2 edits)
              '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">' +
                '<button type="button" id="meAiRefBtn" style="display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border:1.5px dashed #a5b4fc; border-radius:10px; background:#eef2ff; color:#4338ca; font-size:12.5px; font-weight:700; cursor:pointer; font-family:inherit;"><i class="fa-solid fa-image"></i>' + _meAiTr('합성할 사진 넣기', '合成する写真を追加', 'Add a photo to blend') + '</button>' +
                '<div id="meAiRefThumb" style="display:none; align-items:center; gap:6px;">' +
                  '<img id="meAiRefImg" alt="" style="width:38px; height:38px; object-fit:cover; border-radius:7px; border:1px solid #e2e8f0;">' +
                  '<button type="button" id="meAiRefClear" title="' + _meAiTr('사진 빼기','削除','Remove') + '" style="border:none; background:transparent; color:#94a3b8; font-size:16px; cursor:pointer; line-height:1;">✕</button>' +
                '</div>' +
                '<input type="file" id="meAiRefInput" accept="image/*" style="display:none;">' +
              '</div>' +
              '<div id="meAiRefHint" style="display:none; font-size:11.5px; color:#64748b; margin:-4px 0 10px; line-height:1.5;">' +
                _meAiTr('넣은 사진을 활용해 디자인해 드려요. 어떻게 만들지 아래에 적어주세요.',
                        'お写真を活かしてデザインします。どう仕上げるか下に入力してください。',
                        'We\'ll design using your photo. Describe how below.') +
              '</div>' +
              '<textarea id="meAiPrompt" rows="3" placeholder="' + _meAiTr('예: 한강 라면 축제', '例: 夏祭り 花火大会', 'e.g. Summer Ramen Festival') + '" style="width:100%; box-sizing:border-box; border:1.5px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px; font-family:inherit; resize:vertical; outline:none;"></textarea>' +
              '<button type="button" id="meAiGoBtn" style="width:100%; margin-top:10px; padding:13px; border:none; border-radius:11px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; font-size:14px; cursor:pointer; font-family:inherit;">' + _meAiTr('이미지 생성', '画像を生成', 'Generate') + '</button>' +
              '</div>' +  // /#meAiInputArea
              '<div id="meAiResult" style="margin-top:14px; min-height:120px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; display:flex; align-items:center; justify-content:center; text-align:center; color:#cbd5e1; font-size:13px; padding:10px;">' + _meAiTr('여기에 이미지가 표시됩니다', 'ここに画像が表示されます', 'Image will appear here') + '</div>' +
              '<button type="button" id="meAiInsertBtn" style="display:none; width:100%; margin-top:10px; padding:13px; border:none; border-radius:11px; background:#4338ca; color:#fff; font-size:14px; cursor:pointer; font-family:inherit;">' + _meAiTr('캔버스에 넣기', 'キャンバスに追加', 'Add to canvas') + '</button>' +
              // 2026-07-18: 스카시 전용 결과 버튼 — 수정해서 다시만들기 / 이대로 제작
              '<div id="meAiScarciBtns" style="display:none; margin-top:10px; gap:8px;">' +
                '<button type="button" id="meAiScRemake" style="width:100%; padding:12px; border:1.5px solid #c7d2fe; border-radius:11px; background:#eef2ff; color:#4338ca; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; margin-bottom:8px;">' + _meAiTr('✏️ 수정해서 다시 만들기', '✏️ 修正して作り直す', '✏️ Edit & remake') + '</button>' +
                '<button type="button" id="meAiScAccept" style="width:100%; padding:13px; border:none; border-radius:11px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;">' + _meAiTr('이대로 제작', 'このまま製作', 'Make it like this') + '</button>' +
              '</div>' +
              // 2026-07-18: 삽입 후 꾸미기 안내 (이미지 생성 성공 시에만 노출)
              '<div id="meAiTip" style="display:none; margin-top:10px; font-size:12.5px; color:#475569; line-height:1.6; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">' +
                _meAiTr('이미지를 넣은 뒤 위치를 이동해 더 예쁜 구도로 맞춰보세요. 벡터나 요소를 이용해 더 예쁘게 꾸며보세요.',
                        '画像を追加したら、位置を動かしてより美しい構図に整えてみましょう。ベクターや素材を使って、さらに素敵に飾ってみてください。',
                        'After adding the image, move it to get a nicer composition. Use vectors or elements to decorate it even more beautifully.') +
              '</div>' +
              '<div id="meAiErr" style="display:none; margin-top:10px; font-size:12.5px; color:#dc2626; line-height:1.5;"></div>' +
            '</div>';
        document.body.appendChild(wrap);

        // pointerdown: 프롬프트 글씨를 드래그 선택하다 배경에서 놓아도 닫히지 않게 (click 은 드래그 종료도 잡아 닫힘)
        wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) _meAiGenClose(); });
        document.getElementById('meAiClose').addEventListener('click', _meAiGenClose);

        wrap.querySelectorAll('.meAiRatioBtn').forEach(function (b) {
            b.addEventListener('click', function () { _meAiRatio = b.getAttribute('data-ratio'); _meAiSyncBtns(); });
        });
        document.getElementById('meAiGoBtn').addEventListener('click', _meAiGenerate);
        document.getElementById('meAiInsertBtn').addEventListener('click', _meAiInsert);
        // 2026-07-18: 스카시 결과 버튼 — 수정해서 다시만들기 / 이대로 제작
        var _scRemakeBtn = document.getElementById('meAiScRemake');
        var _scAcceptBtn = document.getElementById('meAiScAccept');
        if (_scRemakeBtn) _scRemakeBtn.addEventListener('click', function () {
            _meAiGenClose();
            // 2026-07-18: 종이매대는 브랜드/제품/컨셉 입력칸으로, 스카시는 문구칸으로 돌아감
            try {
                if (_meAiPaperDisplay) { if (typeof window._soPdEditText === 'function') window._soPdEditText(); }
                else if (typeof window._soScarciEditText === 'function') window._soScarciEditText();
            } catch (_) {}
        });
        if (_scAcceptBtn) _scAcceptBtn.addEventListener('click', _meAiScarciAccept);

        // 2026-07-18: 합성할 사진 넣기/빼기
        var refBtn = document.getElementById('meAiRefBtn');
        var refInput = document.getElementById('meAiRefInput');
        var refClear = document.getElementById('meAiRefClear');
        if (refBtn && refInput) {
            refBtn.addEventListener('click', function () { refInput.click(); });
            refInput.addEventListener('change', function () {
                var f = refInput.files && refInput.files[0];
                if (!f) return;
                var fr = new FileReader();
                fr.onload = function () { _meAiSetRef(String(fr.result)); };
                fr.readAsDataURL(f);
                refInput.value = '';   // 같은 파일 다시 선택 가능하게
            });
        }
        if (refClear) refClear.addEventListener('click', function () { _meAiSetRef(null); });

        _meAiSyncBtns();
    }

    // 2026-07-18: 참조 이미지 정규화 — 캔버스에 다시 그려 깨끗한 PNG 로 만들고 긴 변을 maxPx 로 축소.
    //   [왜 필요한가] 허니콤 테이블 썸네일이 MPO(폰 카메라가 만드는 다중 이미지 JPEG)였는데,
    //   Content-Type 은 image/jpeg 라 통과하지만 OpenAI edits 가 디코딩을 거부해
    //   "Invalid image file or mode for image 1" (invalid_image_file) 로 생성이 실패했다.
    //   고객이 올리는 폰 사진도 같은 함정이 있어 참조 이미지 전체에 적용한다.
    //   덤으로 5712x4284(4.4MB) 같은 원본이 1536px 로 줄어 전송·생성이 빨라지고 8MB 상한도 안전해진다.
    function _meAiNormalizeRef(dataUrl, maxPx) {
        return new Promise(function (resolve) {
            try {
                if (!dataUrl) return resolve(null);
                var im = new Image();
                im.onload = function () {
                    try {
                        var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
                        if (!w || !h) return resolve(dataUrl);
                        var lim = maxPx || 1536;
                        var sc = Math.min(1, lim / Math.max(w, h));
                        var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
                        var cv = document.createElement('canvas');
                        cv.width = cw; cv.height = ch;
                        var cx = cv.getContext('2d');
                        // 투명 배경은 흰색으로 — edits 가 알파를 편집영역 마스크로 오인하는 걸 방지
                        cx.fillStyle = '#ffffff';
                        cx.fillRect(0, 0, cw, ch);
                        cx.drawImage(im, 0, 0, cw, ch);
                        resolve(cv.toDataURL('image/png'));
                    } catch (e) { console.warn('[meAi] normalize ref', e); resolve(dataUrl); }
                };
                im.onerror = function () { console.warn('[meAi] normalize ref: load failed'); resolve(dataUrl); };
                im.src = dataUrl;
            } catch (e) { resolve(dataUrl); }
        });
    }

    // 참조 사진 설정/해제 + 썸네일·안내 토글
    function _meAiSetRef(dataUrl, mode) {
        _meAiRefDataUrl = dataUrl || null;
        // 파일 업로드=blend, 갤러리 픽=reference, 종이매대 썸네일=structure(형태 유지)
        _meAiRefMode = (mode === 'reference' || mode === 'structure') ? mode : 'blend';
        var thumb = document.getElementById('meAiRefThumb');
        var img = document.getElementById('meAiRefImg');
        var btn = document.getElementById('meAiRefBtn');
        var hint = document.getElementById('meAiRefHint');
        var isRef = (_meAiRefMode === 'reference');
        var isStruct = (_meAiRefMode === 'structure');
        if (_meAiRefDataUrl) {
            if (img) img.src = _meAiRefDataUrl;
            if (thumb) thumb.style.display = 'inline-flex';
            if (hint) {
                hint.style.display = 'block';
                hint.textContent = isStruct
                    ? _meAiTr('이 매대 모양 그대로 두고, 겉면 디자인만 새로 입혀요.',
                              'この什器の形はそのままに、表面のデザインだけ新しく仕上げます。',
                              'We keep this display\'s exact shape and only redress its surfaces.')
                    : isRef
                    ? _meAiTr('이 작품을 참고해 비슷한 스타일로 새로 디자인해요. 어떻게 만들지 아래에 적어주세요.',
                              'この作品を参考に、似た雰囲気で新しくデザインします。下に内容を入力してください。',
                              'We\'ll design a NEW piece inspired by this one\'s style. Describe it below.')
                    : _meAiTr('넣은 사진을 활용해 디자인해 드려요. 어떻게 만들지 아래에 적어주세요.',
                              'お写真を活かしてデザインします。どう仕上げるか下に入力してください。',
                              'We\'ll design using your photo. Describe how below.');
            }
            if (btn) btn.innerHTML = '<i class="fa-solid fa-image"></i>' + (isStruct
                ? _meAiTr('매대 사진 바꾸기', '什器写真を変更', 'Change display photo')
                : isRef
                ? _meAiTr('참고 작품 바꾸기', '参考作品を変更', 'Change reference')
                : _meAiTr('사진 바꾸기', '写真を変更', 'Change photo'));
        } else {
            if (thumb) thumb.style.display = 'none';
            if (hint) hint.style.display = 'none';
            if (btn) btn.innerHTML = '<i class="fa-solid fa-image"></i>' + _meAiTr('합성할 사진 넣기', '合成する写真を追加', 'Add a photo to blend');
        }
    }

    function _meAiSyncBtns() {
        var m = document.getElementById('meAiGenModal'); if (!m) return;
        m.querySelectorAll('.meAiRatioBtn').forEach(function (b) {
            var on = b.getAttribute('data-ratio') === _meAiRatio;
            b.style.borderColor = on ? '#4338ca' : '#e2e8f0';
            b.style.background = on ? '#eef2ff' : '#fff';
            b.style.color = on ? '#4338ca' : '#334155';
        });
        _meAiSyncHint();
    }

    // 2026-07-18: 프리셋별로 입력 안내문 + placeholder 를 다르게 → 고객이 뭘 적어야 할지 알려준다.
    //   여기서 유도한 내용을 프롬프트에도 반영해 결과가 더 정확해진다.
    function _meAiPresetGuide() {
        switch (_meAiRatio) {
            case 'namecard':
                return {
                    hint: _meAiTr('상호·성함·전화번호·주소·이메일·SNS 등을 적어주세요.',
                                  '会社名・お名前・電話番号・住所・メール・SNSなどを入力してください。',
                                  'Enter your company, name, phone, address, email, SNS, etc.'),
                    ph:   _meAiTr('예: 카멜레온 디자인 · 홍길동 대표 · 010-1234-5678 · 서울 강남구 · hong@cha.com · @chameleon',
                                  '例: カメレオンデザイン · 山田太郎 · 090-1234-5678 · 東京都渋谷区 · info@cha.com',
                                  'e.g. Chameleon Design · John Kim · 010-1234-5678 · Seoul · john@cha.com · @chameleon') };
            case 'banner-h':
                return {
                    hint: _meAiTr('메인 타이틀과 서브 문구를 적어주세요.',
                                  'メインタイトルとサブ文言を入力してください。',
                                  'Enter the main title and a subtitle.'),
                    ph:   _meAiTr('예: 여름 라면 축제 / 7월 한강공원',
                                  '例: 夏ラーメン祭り / 7月 河川敷',
                                  'e.g. Summer Ramen Festival / July, Han River Park') };
            case 'banner-v':
                return {
                    hint: _meAiTr('타이틀 글씨와 서브 글씨를 적어주세요.',
                                  'タイトルとサブ文言を入力してください。',
                                  'Enter the title and a subtitle.'),
                    ph:   _meAiTr('예: 신메뉴 출시 / 아메리카노 1+1',
                                  '例: 新メニュー登場 / アメリカーノ 1+1',
                                  'e.g. New Menu / Americano 1+1') };
            case '9:16':
            case '16:9':
                return {
                    hint: _meAiTr('타이틀·주최·일시·장소 등 내용을 자세히 적어주세요.',
                                  'タイトル・主催・日時・場所など、詳しく入力してください。',
                                  'Enter details: title, host, date, place, etc.'),
                    ph:   _meAiTr('예: 카멜레온 창립 10주년 페스티벌 / 주최: 카멜레온 / 8월 15일 오후 6시 / 한강공원 잔디마당',
                                  '例: カメレオン10周年フェス / 主催: カメレオン / 8月15日 18時 / 河川敷広場',
                                  'e.g. Chameleon 10th Anniversary / Host: Chameleon / Aug 15, 6PM / Han River Park') };
            default: // 1:1
                return {
                    hint: _meAiTr('타이틀·내용을 적어주세요.', 'タイトル・内容を入力してください。', 'Enter a title and details.'),
                    ph:   _meAiTr('예: 한강 라면 축제', '例: 夏祭り 花火大会', 'e.g. Summer Ramen Festival') };
        }
    }
    function _meAiSyncHint() {
        var g = _meAiPresetGuide();
        var h = document.getElementById('meAiHint');
        var p = document.getElementById('meAiPrompt');
        if (h) h.textContent = g.hint;
        if (p) p.setAttribute('placeholder', g.ph);
    }

    // 2026-07-18: 간편 진입(원클릭 AI디자인 / 디자인 편집하기) ↔ 상세 툴바 전환.
    //   meIntro/meToolbar 는 index.html·cotton_print.html 에 있고 simple_order 는 이 DOM 을 portal 로 재사용.
    //   전역 함수라 세 군데 모두에서 동작.
    // 편집기 상세 UI — 툴바 + 속성패널 + 사이즈표시 + PDF경고 (간편모드에선 전부 숨김)
    //   2026-07-18: 템플릿/사진/벡터/요소/장식 탭(qd-rail)도 함께 숨김. 작품 갤러리(meGallery)는 항상 표시.
    var _ME_EDIT_IDS = ['meToolbar', 'meProps', 'meSizeLabel', 'meDiffNotice'];
    function _meEditUISet(show) {
        _ME_EDIT_IDS.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = show ? '' : 'none';   // '' → 각 요소 CSS/자체로직으로 복귀
        });
        // qd-rail 은 simple_order/editor-rail 이 나중에 만드는 DOM → 타이밍 안전하게 html 클래스+CSS 로 토글.
        //   기본(편집 아님)엔 CSS 가 .qd-rail 숨김. 편집 진입 시 html.me-editing 으로 노출.
        try { document.documentElement.classList.toggle('me-editing', !!show); } catch (_) {}
    }
    window._meShowToolbar = function () {
        var intro = document.getElementById('meIntro');
        if (intro) intro.style.display = 'none';
        _meEditUISet(true);
    };
    window._meHideToolbar = function () {
        _meEditUISet(false);
        var intro = document.getElementById('meIntro');
        if (intro) intro.style.display = '';
    };

    window._meAiGenOpen = function () {
        _meAiEnsureModal();
        _meAiPendingUrl = null;
        // 2026-07-18: 현재 제품 종류에 맞는 기본 프리셋 자동 선택 (명함/배너/현수막).
        //   simple_order._soAiPresetHint() = 'namecard' | 'banner' | null.
        //   배너/현수막은 대지 비율로 세로배너(banner-v)/가로현수막(banner-h) 결정.
        _meAiScarci = false;
        _meAiPaperDisplay = false;
        _meAiPdIsTable = false;
        var _scarciAuto = false, _scarciTitleTxt = '', _scarciSubTxt = '';
        var _pdAuto = false, _pdThumbUrl = '', _pdTxt = null;
        try {
            var _hint = (typeof window._soAiPresetHint === 'function') ? window._soAiPresetHint() : null;
            if (_hint === 'paper-display' || _hint === 'hb-table') {
                // 종이매대/허니콤테이블: 제품 썸네일(구조)을 참조로 두고 브랜드/제품/컨셉 문구로 바로 자동 생성.
                _meAiPaperDisplay = true;
                _meAiPdIsTable = (_hint === 'hb-table');
                // 2026-07-18: 대지가 가로(2500x1600 등)라 세로 생성물은 삽입 시 잘림 → 가로 16:9 고정.
                //   좌측 매대 목업 + 우측 메인 광고판 실사 2분할 구성이라 가로가 맞음.
                _meAiRatio = '16:9';
                _pdTxt = (typeof window._soPdAiText === 'function') ? (window._soPdAiText() || {}) : {};
                // 브랜드/타이틀이 없으면 열지 않고 입력칸으로 안내
                if (!(_pdTxt.brand || '').trim()) {
                    try { if (typeof window._soPdNeedBrand === 'function') window._soPdNeedBrand(); } catch (_nb) {}
                    return;
                }
                _pdThumbUrl = (typeof window._soPdThumbUrl === 'function') ? (window._soPdThumbUrl() || '') : '';
                _pdAuto = true;
            } else if (_hint === 'scarci') {
                // 글씨 스카시 = 입체 글씨 포토존. 타이틀/서브 문구로 바로 자동 생성(프롬프트 입력창 숨김).
                _meAiScarci = true;
                _meAiRatio = '16:9';
                var _st = (typeof window._soScarciAiText === 'function') ? (window._soScarciAiText() || {}) : {};
                _scarciTitleTxt = (_st.title || '').trim();
                _scarciSubTxt = (_st.sub || '').trim();
                // 타이틀 문구가 없으면 열지 않고 문구칸으로 안내
                if (!_scarciTitleTxt) {
                    try { if (typeof window._soScarciNeedTitle === 'function') window._soScarciNeedTitle(); } catch (_nt) {}
                    return;
                }
                _scarciAuto = true;
            } else if (_hint === 'namecard') {
                _meAiRatio = 'namecard';
            } else if (_hint === 'banner') {
                var w = (me && me.natW) || 0, h = (me && me.natH) || 0;
                if (h > w * 1.15) _meAiRatio = 'banner-v';        // 세로(허니콤배너·X배너 등)
                else if (w > h * 1.15) _meAiRatio = 'banner-h';   // 가로(현수막)
            }
            _meAiSyncBtns();
        } catch (_ph) {}
        var m = document.getElementById('meAiGenModal');
        var res = document.getElementById('meAiResult');
        var ins = document.getElementById('meAiInsertBtn');
        var err = document.getElementById('meAiErr');
        if (res) { res.innerHTML = _meAiTr('여기에 이미지가 표시됩니다', 'ここに画像が表示されます', 'Image will appear here'); res.style.color = '#cbd5e1'; }
        if (ins) ins.style.display = 'none';
        var _tip=document.getElementById('meAiTip'); if(_tip)_tip.style.display='none';
        if (err) err.style.display = 'none';
        try { _meAiSetRef(null); } catch (_) {}   // 2026-07-18: 참조 사진 초기화
        // 2026-07-18: 갤러리에서 고른 작품이 있으면 '참고' 모드로 복원 (위 초기화 직후여야 함).
        //   스카시/종이매대 자동 모드는 각자 참조를 쓰므로 제외.
        try { if (_meGalPendingRef && !_scarciAuto && !_pdAuto) _meAiSetRef(_meGalPendingRef, 'reference'); } catch (_) {}
        // 2026-07-18: 스카시 자동모드 — 입력 UI 숨기고 문구로 바로 생성 / 그 외엔 입력 UI 노출
        var _inputArea = document.getElementById('meAiInputArea');
        var _hintEl = document.getElementById('meAiHint');
        var _scBtns = document.getElementById('meAiScarciBtns');
        if (_scBtns) _scBtns.style.display = 'none';
        if (_scarciAuto || _pdAuto) {
            if (_inputArea) _inputArea.style.display = 'none';
            if (_hintEl) _hintEl.style.display = 'none';
            var _pEl2 = document.getElementById('meAiPrompt');
            if (_pEl2) _pEl2.value = _pdAuto
                ? [(_pdTxt.brand || ''), (_pdTxt.products || ''), (_pdTxt.concept || '')].filter(Boolean).join(' / ')
                : [_scarciTitleTxt, _scarciSubTxt].filter(Boolean).join(' ');
        } else {
            if (_inputArea) _inputArea.style.display = '';
            if (_hintEl) _hintEl.style.display = '';
        }
        m.style.display = 'flex';
        if (_pdAuto) {
            // 종이매대: 제품 썸네일을 dataURL 참조(structure)로 실은 뒤 생성 시작.
            //   썸네일을 못 가져와도(CORS/404) 문구만으로 생성은 진행.
            (async function () {
                try {
                    if (_pdThumbUrl) {
                        var _du = _pdThumbUrl;
                        if (_du.indexOf('data:') !== 0) {
                            var _r = await fetch(_pdThumbUrl, { mode: 'cors' });
                            var _b = await _r.blob();
                            _du = await new Promise(function (rs, rj) {
                                var fr = new FileReader();
                                fr.onload = function () { rs(String(fr.result)); };
                                fr.onerror = rj;
                                fr.readAsDataURL(_b);
                            });
                        }
                        _meAiSetRef(_du, 'structure');
                    }
                } catch (_pdRef) { console.warn('[meAi] paper-display thumb ref', _pdRef); }
                try { _meAiGenerate(); } catch (_g2) {}
            })();
        } else if (_scarciAuto) {
            // 바로 생성 시작
            setTimeout(function () { try { _meAiGenerate(); } catch (_g) {} }, 60);
        } else {
            setTimeout(function () { var p = document.getElementById('meAiPrompt'); if (p) p.focus(); }, 80);
        }
    };
    function _meAiGenClose() { var m = document.getElementById('meAiGenModal'); if (m) m.style.display = 'none'; }
    window._meAiGenClose = _meAiGenClose;

    // 2026-07-18: 작품 갤러리 — 미리캔버스식 2줄 마퀴(위:좌→우, 아래:우→좌). 높이 고정·가로폭 자동, 이미지 전체 표시.
    //   다른 고객이 만든(개인정보 없는) 디자인을 구경/검색하고, 고르면 그 스타일을 참고해 새로 생성.
    var _meGalQ = '', _meGalBusy = false, _meGalRows = [];
    async function _meGalleryLoad(q) {
        var topT = document.getElementById('meGalTrackTop');
        var botT = document.getElementById('meGalTrackBot');
        if (!topT || !botT) return;
        if (typeof q === 'string') _meGalQ = q.trim();
        var sb = window.sb;
        if (!sb) { topT.innerHTML = ''; botT.innerHTML = ''; return; }
        _meGalBusy = true;
        try {
            var query = sb.from('design_gallery').select('id,image_url,thumb_url,prompt').eq('status', 'public');
            if (_meGalQ) {
                var like = '%' + _meGalQ.replace(/[%,]/g, ' ') + '%';
                query = query.or('kw_ko.ilike.' + like + ',kw_en.ilike.' + like + ',kw_ja.ilike.' + like);
            }
            var res = await query.order('created_at', { ascending: false }).limit(24);
            var rows = res.data || [];
            _meGalRows = rows;
            if (!rows.length) {
                topT.innerHTML = '<div class="me-gal-empty">' + _meAiTr('아직 등록된 작품이 없어요.', 'まだ作品がありません。', 'No designs yet.') + '</div>';
                botT.innerHTML = '';
                return;
            }
            // 위/아래 두 줄로 분배 (항목이 적으면 아래줄도 위줄과 같은 걸로 채워 흐름 유지)
            var half = Math.ceil(rows.length / 2);
            var top = rows.slice(0, half);
            var bot = rows.slice(half);
            if (bot.length < 2) bot = rows.slice();
            _meGalFillTrack(topT, top);
            _meGalFillTrack(botT, bot);
        } catch (e) { console.warn('[meGallery] load', e); }
        finally { _meGalBusy = false; }
    }
    function _meGalItemHtml(r) {
        var u = r.thumb_url || r.image_url;
        return '<button type="button" class="me-gal-item" data-gal="' + r.id + '" title="' + _meAiEsc(r.prompt || '') + '"><img src="' + u + '" loading="lazy" alt=""></button>';
    }
    function _meGalFillTrack(track, items) {
        // 이음새 없는 무한 스크롤을 위해 항목을 2배 복제(-50% translate 로 딱 한 세트 이동)
        var html = items.map(_meGalItemHtml).join('');
        track.innerHTML = html + html;
        track.querySelectorAll('.me-gal-item').forEach(function (b) {
            b.addEventListener('click', function () {
                var id = b.getAttribute('data-gal');
                var row = _meGalRows.filter(function (x) { return String(x.id) === String(id); })[0];
                if (row) _meGalleryPick(row);
            });
        });
    }
    function _meAiEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    // 2026-07-18: 갤러리에서 고른 작품을 AI 실행 때 참고로 쓰기 위해 보관.
    //   모달을 열 때 _meAiSetRef(null) 로 초기화되므로, 여기 담아뒀다가 그 직후 다시 적용한다.
    var _meGalPendingRef = null;

    // 대지에 깔아둔 "배경 레이어"(갤러리 미리보기 / 직전 AI 결과) 제거.
    //   2026-07-18 [중요] toBack 레이어를 지우지 않고 쌓으면 화면과 저장본이 서로 다른 그림이 된다:
    //     · 화면 = DOM 순서(둘 다 z-index 0 → 나중에 append 된 새 이미지가 위)  → 최신 그림이 보임
    //     · 저장 = me.items 배열 순서(toBack 은 unshift 라 최신이 index 0 = 맨 아래) → 옛 그림이 위에 덮임
    //   실제로 3단테이블에서 만든 목업이 십자선반 테이블 주문서에 찍혀 나갔다(2026-07-18 사장님 제보).
    //   그래서 새 배경을 넣기 전에 항상 이전 배경을 먼저 없앤다 = 언제나 한 장만 존재.
    function _meGalRemovePreview() {
        try {
            (me && me.items ? me.items : []).slice().forEach(function (it) {
                if (it && (it._isGalPreview || it._isAiBg)) {
                    try { if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el); } catch (_) {}
                    var ix = me.items.indexOf(it); if (ix >= 0) me.items.splice(ix, 1);
                }
            });
        } catch (e) { console.warn('[meGallery] remove preview', e); }
    }

    // 갤러리 픽 → ① 대지에 바로 올려 크게 확인 ② AI 실행 시 이 작품을 참고로 사용
    //   2026-07-18: 예전엔 클릭 즉시 AI 모달을 열어 작품을 크게 볼 수 없었음(사장님 요청으로 변경).
    async function _meGalleryPick(row) {
        try {
            var url = row.image_url;
            // CORS 안전하게 dataURL 로 변환 (대지 삽입 + 참조 양쪽에 사용)
            var dataUrl = url;
            if (url.indexOf('data:') !== 0) {
                try { var r = await fetch(url, { mode: 'cors' }); var b = await r.blob(); dataUrl = await new Promise(function (rs, rj) { var fr = new FileReader(); fr.onload = function () { rs(String(fr.result)); }; fr.onerror = rj; fr.readAsDataURL(b); }); } catch (_) {}
            }
            // ① 대지에 올림 — 이전 미리보기는 교체
            _meGalRemovePreview();
            window._meAddImage(dataUrl, { fillCanvas: true, toBack: true }, function (it) {
                if (it) it._isGalPreview = true;
            });
            // ② AI 실행 시 참고 이미지로 예약 (생성 결과가 이 작품을 덮어씀)
            _meGalPendingRef = dataUrl;
        } catch (e) { console.warn('[meGallery] pick', e); }
    }
    window._meGalleryLoad = _meGalleryLoad;
    window._meGallerySearch = (function () { var t = null; return function (v) { clearTimeout(t); t = setTimeout(function () { _meGalleryLoad(v || ''); }, 300); }; })();

    // 생성 이미지를 대지에 cover(꽉 채움, 넘치는 부분만 잘림)로 삽입 + 뒤로 보내기(배경/풀블리드).
    //   명함 포함 전부 cover — 프롬프트가 사방/상하/좌우 여백을 확보하므로 잘려도 글자는 안전.
    //   (2026-07-18: 명함을 contain 으로 넣었더니 좌우가 남아서 다시 cover 로. 대지 90x50 ≈ 1.77:1,
    //    생성 이미지 1.5:1 이라 좌우는 꽉 차고 위아래만 조금 잘린다 → 여백 있는 명함이라 안전.)
    // 캔버스 삽입 + (스카시면)디자이너 첨부 — 모달은 닫지 않음(코어)
    function _meAiDoInsert() {
        if (!_meAiPendingUrl) return;
        var opts = { toBack: true };
        try {
            var imgEl = document.querySelector('#meAiResult img');
            var iw = imgEl && imgEl.naturalWidth, ih = imgEl && imgEl.naturalHeight;
            if (me && me.natW && me.natH && iw && ih) {
                var scale = Math.max(me.natW / iw, me.natH / ih);  // cover — 대지 꽉 채움
                var w = iw * scale, h = ih * scale;
                var x = (me.natW - w) / 2, y = (me.natH - h) / 2; // 중앙 정렬
                opts.explicitPos = { x: x, y: y, w: w, h: h };
            } else {
                opts.fitCanvas = true; // 자연크기 못 구하면 최소한 대지에 맞춤
            }
        } catch (err) { console.warn('[meAi] scale calc', err); opts = { fitCanvas: true, toBack: true }; }
        // 2026-07-18: 이전 배경 레이어(갤러리 미리보기 + 직전 AI 결과)를 먼저 제거 — 새 결과가 그 자리를 덮어쓴다.
        try { _meGalRemovePreview(); } catch (_gp) {}
        try {
            window._meAddImage(_meAiPendingUrl, opts, function (it) {
                // 다음 생성 때 이 레이어를 확실히 걷어내기 위한 표식
                if (it) it._isAiBg = true;
            });
        } catch (err2) { console.warn('[meAi] add', err2); }
        // 2026-07-18: 글씨 스카시 — 삽입한 포토존 시안을 디자이너 참고자료로 자동 첨부 (컨셉 미리보기 + 의뢰 자료).
        //   AI 프롬프트에 적은 문구도 함께 넘겨 디자이너에게 전달.
        if (_meAiScarci) {
            try {
                var _scPromptEl = document.getElementById('meAiPrompt');
                var _scPromptTxt = _scPromptEl ? (_scPromptEl.value || '').trim() : '';
                if (typeof window._soScarciAttachAiImage === 'function') window._soScarciAttachAiImage(_meAiPendingUrl, _scPromptTxt);
            } catch (_sc) {}
        }
        // 2026-07-18: 종이매대 — 만든 매대 목업을 디자이너 참고자료로 자동 첨부 (결제 시 design_requests.files 로 전달).
        if (_meAiPaperDisplay) {
            try {
                var _pdPromptEl = document.getElementById('meAiPrompt');
                var _pdPromptTxt = _pdPromptEl ? (_pdPromptEl.value || '').trim() : '';
                if (typeof window._soPdAttachAiImage === 'function') window._soPdAttachAiImage(_meAiPendingUrl, _pdPromptTxt);
            } catch (_pd) {}
        }
    }
    function _meAiInsert() { _meAiDoInsert(); _meAiGenClose(); }
    // 2026-07-18: 스카시 '이대로 제작' — 삽입+디자이너 첨부 + 작품 갤러리 등록 후 바로 닫고 배송으로 진행(확인 화면 없음)
    function _meAiScarciAccept() {
        _meAiDoInsert();   // 캔버스 삽입 + 디자이너 참고자료 첨부
        // 작품 갤러리에 등록 (스카시 포토존 시안도 작품에 포함)
        try {
            var _pEl = document.getElementById('meAiPrompt');
            _meAiTryRegisterGallery(_meAiPendingUrl, _pEl ? (_pEl.value || '').trim() : '', _meAiRatio);
        } catch (_reg) {}
        _meAiGenClose();   // 확인 과정 없이 바로 닫음
        // 튜토리얼 대기(waitEvent) 진행 — '이대로 제작' 완료 신호
        try { document.dispatchEvent(new CustomEvent('me-scarci-accepted')); } catch (_ev) {}
        try { if (_meAiPaperDisplay) document.dispatchEvent(new CustomEvent('me-pd-accepted')); } catch (_ev2) {}
        // 바로 배송 단계로 스크롤 (비튜토리얼 포함)
        try { var _sch = document.getElementById('soScheduleSection'); if (_sch) _sch.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_scl) {}
    }

    // 로딩 진행바 — 실제 진행률을 알 수 없어 90%까지 부드럽게 채운 뒤 완료 시 100%.
    var _meAiBarTimer = null;
    function _meAiBarStart() {
        _meAiBarStop();
        var pct = 6;
        var _msgSwitched = false;
        var bar = document.getElementById('meAiBar');
        if (bar) bar.style.width = pct + '%';
        _meAiBarTimer = setInterval(function () {
            pct += (90 - pct) * 0.10 + 0.6;      // 90% 로 점근
            if (pct > 92) pct = 92;
            var b = document.getElementById('meAiBar');
            if (b) b.style.width = pct.toFixed(1) + '%';
            // 2026-07-18: 바가 후반(≥78%)에 오면 문구를 "다듬는 중 · 거의 완료"로 교체.
            if (!_msgSwitched && pct >= 78) {
                _msgSwitched = true;
                var msg = document.getElementById('meAiBarMsg');
                if (msg) msg.textContent = _meAiTr('디자인을 다듬고 있어요 · 거의 다 됐어요', 'デザインを仕上げています · もうすぐ完成です', 'Refining the design · almost done');
            }
        }, 400);
    }
    function _meAiBarDone() {
        var b = document.getElementById('meAiBar');
        if (b) b.style.width = '100%';
        _meAiBarStop();
    }
    function _meAiBarStop() { if (_meAiBarTimer) { clearInterval(_meAiBarTimer); _meAiBarTimer = null; } }

    // 2026-07-18: 작품 갤러리 자동등록 ─────────────────────────────
    //   개인정보 보호: 명함(namecard) 제외 + 프롬프트에 전화/이메일/긴 숫자열 있으면 등록 안 함.
    //   그래도 프롬프트는 스크럽(마스킹) 후 저장하고, 스크럽본으로 키워드 번역.
    var _ME_PII_RE = [
        /\d{2,4}[-\s.]?\d{3,4}[-\s.]?\d{4}/,        // 전화번호류
        /[\w.+-]+@[\w-]+\.[\w.]+/,                   // 이메일
        /\b\d{6,}\b/                                 // 긴 숫자열(사업자번호 등)
    ];
    function _meHasPII(s) { s = String(s || ''); return _ME_PII_RE.some(function (re) { return re.test(s); }); }
    function _meScrubPII(s) {
        s = String(s || '');
        s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ');
        s = s.replace(/\d{2,4}[-\s.]?\d{3,4}[-\s.]?\d{4}/g, ' ');
        s = s.replace(/\b\d{5,}\b/g, ' ');
        return s.replace(/\s{2,}/g, ' ').trim();
    }
    async function _meAiTryRegisterGallery(imageUrl, rawPrompt, ratio) {
        try {
            // 개인정보 안전장치: 명함이거나 PII 감지되면 '즉시 공개'하지 않고 관리자 승인 대기(pending).
            //   pending 행은 RLS(dg_read = status='public')로 anon 이 못 읽음 → 관리자만 RPC 로 조회/승인.
            //   안전한 일반 디자인은 status='public' 로 바로 갤러리 노출.
            var needsReview = (ratio === 'namecard') || _meHasPII(rawPrompt);
            var status = needsReview ? 'pending' : 'public';
            var sb = window.sb; if (!sb || !imageUrl) return;
            var scrubbed = _meScrubPII(rawPrompt).slice(0, 300);
            if (scrubbed.length < 2) return;

            // 1) dataURL → Blob → storage 업로드 (design 버킷 gallery/ 경로)
            var blob;
            if (imageUrl.indexOf('data:') === 0) {
                var r = await fetch(imageUrl); blob = await r.blob();
            } else {
                var r2 = await fetch(imageUrl, { mode: 'cors' }); blob = await r2.blob();
            }
            var ts = (window.performance && performance.now ? Math.floor(performance.now()) : 0) + '_' + Math.floor(Math.random() * 1e6);
            var path = 'gallery/' + ts + '.png';
            var up = await sb.storage.from('design').upload(path, blob, { contentType: 'image/png', upsert: false });
            if (up.error) { console.warn('[meGallery] upload', up.error); return; }
            var pub = sb.storage.from('design').getPublicUrl(path).data.publicUrl;

            // 2) 키워드 번역 (ko/en/ja)
            var kw = { ko: scrubbed, en: scrubbed, ja: scrubbed };
            try {
                var tr = await fetch(SB_URL + '/functions/v1/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SB_KEY, 'apikey': SB_KEY },
                    body: JSON.stringify({ text: scrubbed, sourceLang: 'ko', targetLangs: ['ko', 'en', 'ja'] })
                });
                var td = await tr.json();
                if (td && td.translations) {
                    kw.ko = td.translations.ko || scrubbed;
                    kw.en = td.translations.en || scrubbed;
                    kw.ja = td.translations.ja || scrubbed;
                }
            } catch (_t) {}

            // 3) 사용자 id (있으면)
            var uid = null;
            try { var u = await sb.auth.getUser(); uid = u && u.data && u.data.user ? u.data.user.id : null; } catch (_u) {}

            // 4) insert (needsReview 면 status='pending' → 관리자 승인 후 공개)
            await sb.from('design_gallery').insert({
                image_url: pub, thumb_url: pub, prompt: scrubbed,
                kw_ko: kw.ko, kw_en: kw.en, kw_ja: kw.ja, ratio: ratio || null, user_id: uid,
                status: status
            });
        } catch (e) { console.warn('[meGallery] register failed', e); }
    }

    async function _meAiGenerate() {
        var promptEl = document.getElementById('meAiPrompt');
        var res = document.getElementById('meAiResult');
        var ins = document.getElementById('meAiInsertBtn');
        var err = document.getElementById('meAiErr');
        var go = document.getElementById('meAiGoBtn');
        var prompt = (promptEl && promptEl.value || '').trim();
        if (err) err.style.display = 'none';
        if (ins) ins.style.display = 'none';
        var _tip=document.getElementById('meAiTip'); if(_tip)_tip.style.display='none';
        _meAiPendingUrl = null;
        if (prompt.length < 3) {
            if (err) { err.textContent = _meAiTr('설명을 조금 더 자세히 적어주세요.', 'もう少し詳しく説明してください。', 'Please describe a bit more.'); err.style.display = 'block'; }
            return;
        }
        if (res) {
            res.style.color = '';
            res.innerHTML =
                '<div style="width:100%; padding:6px 8px;">' +
                  '<div id="meAiBarMsg" style="font-size:13px; color:#64748b; margin-bottom:9px;">' + ((_meAiScarci || _meAiPaperDisplay) ? _meAiTr('디자인을 만들고 있어요 · 1분만 기다려주세요', 'デザインを作成中 · 1分ほどお待ちください', 'Creating your design · about 1 min') : _meAiTr('AI가 만드는 중이에요… 잠시만요', 'AIが生成中です… 少々お待ちを', 'AI is creating… hang tight')) + '</div>' +
                  '<div style="height:9px; background:#e2e8f0; border-radius:99px; overflow:hidden;">' +
                    '<div id="meAiBar" style="height:100%; width:6%; background:linear-gradient(90deg,#6366f1,#4338ca); border-radius:99px; transition:width .45s ease;"></div>' +
                  '</div>' +
                '</div>';
        }
        _meAiBarStart();
        if (go) go.disabled = true;
        try {
            var url;
            if (_meAiModel === 'ideogram') {
                // 비율 → gpt-image 사이즈 문자열 (ai-image-gen 내부에서 aspect_ratio 로 매핑)
                //   banner-h(가로 현수막)도 gpt-image 최대 가로(1536x1024)로 생성 — 5:0.9 는 API 로 못 만들어서
                //   위아래 큰 여백 + 중앙 가로띠 구성으로 대응한다.
                var _isWideBanner = (_meAiRatio === 'banner-h');   // 가로현수막
                var _isVBanner    = (_meAiRatio === 'banner-v');   // 세로배너 (버튼)
                var _isNameCard   = (_meAiRatio === 'namecard');   // 명함
                // 2026-07-10: 아주 긴 세로 제품(대지 H/W ≥ 2)도 자동으로 세로배너 취급.
                //   세로배너 버튼(banner-v)을 누르면 대지와 무관하게 강제.
                var _isTallBanner = _isVBanner;
                try { if (!_isTallBanner && me && me.natW && me.natH && (me.natH / me.natW) >= 2.0) _isTallBanner = true; } catch (_) {}

                var size = _meAiRatio === '9:16' ? '1024x1536'
                         : (_meAiRatio === '16:9' || _isWideBanner) ? '1536x1024'
                         : _isNameCard ? '1536x1024'   // 명함은 가로형 (좌우가 긴 명함)
                         : '1024x1024';
                if (_isTallBanner) size = '1024x1536';   // 세로배너: gpt-image 최대 세로

                var _bannerHint = _isTallBanner
                    // 세로배너: 좌우 큰 여백 + 아주 좁은 중앙 세로열. 긴 글자는 3~4자씩 줄바꿈해 세로로 쌓음.
                    ? ' Compose as a TALL VERTICAL BANNER. Read the user text as a TITLE plus a shorter SUBTITLE: render the TITLE large and bold at the top-center, and the SUBTITLE smaller just below it. Place ALL text in a VERY NARROW vertical column down the CENTER — keep every line of text within the central ~35% of the width only, with large empty background areas on the LEFT and RIGHT. CRITICAL: never let a line of text run wide toward the sides. If any word or phrase is long, BREAK IT into SHORT STACKED LINES of at most 3-4 Korean characters each and stack them vertically — for example "한우불고기" must become two lines "한우" / "불고기", and "방어회오픈" becomes "방어회" / "오픈". Keep nothing important near the left/right edges — the sides get cropped on a very tall narrow banner, so wide text will be cut off.'
                    : '';
                // 2026-07-18: 가로 현수막 — 5m×0.9m 등 아주 긴 가로. 최종 대지는 위아래로 크게 잘리므로
                //   타이틀/서브를 화면 세로 중앙의 가로 띠(중앙 ~30% 높이)에 몰고, 위·아래로 큰 배경 여백을 둔다.
                if (_isWideBanner) {
                    _bannerHint = ' Compose as a WIDE HORIZONTAL BANNER (like a 5m x 0.9m long banner). Read the user text as a MAIN TITLE plus a shorter SUBTITLE: render the MAIN TITLE big and bold, with the SUBTITLE smaller on the line below. Center all of it both horizontally and vertically, kept inside a TIGHT central horizontal strip no taller than the middle 30% of the image height. The TOP third and BOTTOM third must be LARGE EMPTY background margin with nothing important in them. Highly legible lettering. Clean and simple — a title banner, not a busy poster. Full-bleed background, no border or frame.';
                }
                // 2026-07-18: 명함 — 고객이 적은 상호/이름/연락처를 모두 담되, 그 상호의 업종·컨셉에 어울리는 디자인.
                //   일정한 템플릿이 아니라 상호에 맞춰 색·분위기·모티프를 다르게. 사방 여백은 반드시 넉넉히.
                if (_isNameCard) {
                    _bannerHint = ' Design a CLEAN, MODERN, PROFESSIONAL BUSINESS CARD. Read the user text as business-card fields (company/brand name, person name and title, phone, address, email, social handles) and lay them out clearly with a natural visual hierarchy — the brand name most prominent. IMPORTANT: tailor the whole look (colors, mood, typography, any simple icon or motif) to suit the BRAND and its industry as implied by the company name — e.g. a cafe feels warm and cozy, a law firm feels formal and navy, a design studio feels artful and minimal. Do NOT use one fixed generic template. Use plenty of negative space and keep ALL text well inside with GENEROUS EMPTY MARGINS on ALL FOUR SIDES so nothing is cut off near an edge. Full-bleed background color or subtle texture, but no printed border or frame line.';
                }
                // 2026-07-18: 글씨 스카시 — 입체 글씨 포토존 컨셉 목업 (실제 입체 제작은 전문 디자이너).
                //   스타일 2종: 'letters'(글씨만) / 'box'(위 타이틀 + 큰 하단 박스).
                //   타이틀(=큰 입체글씨, 최대 3줄)과 서브(=날짜·장소, 박스 안)를 분리해 지시.
                if (_meAiScarci) {
                    var _sst = (typeof window._soScarciAiText === 'function') ? (window._soScarciAiText() || {}) : {};
                    var _sStyle = (typeof window._soScarciStyle === 'function') ? window._soScarciStyle() : 'box';
                    var _titleClause = _sst.title
                        ? ' The MAIN TITLE text is: "' + _sst.title + '".'
                        : ' From the input, treat the main event or brand NAME as the MAIN TITLE.';
                    // 2026-07-18: 실제 컷아웃 스카시 글씨처럼 각 글자에 두꺼운 대비 테두리 — 흰 글씨엔 색, 진한 글씨엔 흰색.
                    //   흰 테두리는 아주 두껍게(글자 사이 틈이 메워지도록) = 다이컷 스티커 외곽선 느낌.
                    var _edgeClause = ' CRITICAL: give the whole word a THICK die-cut STICKER-style CONTRASTING BORDER hugging the lettering. Make this border WIDE and bold (a fat keyline, NOT a thin hairline) — thick enough that it FILLS and BRIDGES the small gaps between adjacent letters and merges into ONE continuous connected outline around the entire word. If the letter faces are DARK or saturated COLOR, use a THICK solid WHITE border/backing that fills the spaces between the letters with white; if the letter faces are WHITE or light, use a THICK bold SATURATED COLOR border instead. The border must be clearly heavy and uniform so the lettering reads like a die-cut sticker.';
                    if (_sStyle === 'letters') {
                        _bannerHint = ' Render a realistic 3D CUT-OUT LETTERING PHOTO ZONE made ONLY of large freestanding 3D cut-out letters standing directly on the floor — NO base box, NO pedestal, NO bottom platform of any kind.' + _titleClause
                            + ' Render the TITLE as BIG, BOLD, DIMENSIONAL 3D letters (thick acrylic/foam cut-out letters) arranged in AT MOST 3 lines, as the clear hero. Any remaining detail text (dates, period, place) may appear as smaller 3D lettering below the title, but still with absolutely NO box or platform.' + _edgeClause + ' Present it as a clean standalone photo zone at an event entrance/lobby, well lit, NO people, simple uncluttered background. Design concept mockup for a 3D letter photo zone.';
                    } else {
                        var _subClause = _sst.sub
                            ? ' The bottom bar shows ONLY this short subtitle on ONE single line: "' + _sst.sub + '".'
                            : ' The bottom bar has NO extra text (or at most a tiny one-line label) — do NOT invent dates, schedules, organizers or event details to fill it.';
                        _bannerHint = ' Render a realistic 3D CUT-OUT LETTERING PHOTO ZONE with TWO parts. TOP (taking up most of the height): the MAIN TITLE as BIG, BOLD, DIMENSIONAL freestanding 3D cut-out letters (thick acrylic/foam letters) arranged in AT MOST 3 lines — the clear hero.' + _titleClause
                            + ' BOTTOM: a solid horizontal BASE BOX that the 3D title letters stand on. Its height should be MODERATE — about the height of TWO lines of text, roughly ONE-QUARTER (about 25%) of the total image height. It must NOT be a tall multi-row block, but also NOT a thin sliver — a clear, real base box of medium height. Show any subtitle on it in ONE or at most TWO short lines; do NOT stack many rows of details.' + _subClause
                            + ' Keep the event NAME only in the big top 3D letters.' + _edgeClause + ' Present it as a standalone photo-zone installation at an event entrance/lobby, well lit, NO people, simple uncluttered background. Design concept mockup for a 3D letter photo zone.';
                    }
                }
                // 2026-07-18: 종이매대 — 첨부한 제품 썸네일의 매대 "구조"는 그대로 두고 겉면 그래픽만 새로 입힌 목업.
                //   실제 인쇄 데이터/칼선은 결제 후 전문 디자이너가 제작 (이건 컨셉 참고용).
                if (_meAiPaperDisplay) {
                    var _pdt = (typeof window._soPdAiText === 'function') ? (window._soPdAiText() || {}) : {};
                    var _pdMainPanel = _meAiPdIsTable ? 'front panel of the table' : 'top header board of the display';
                    var _pdSubPanel = _meAiPdIsTable ? 'the front panel and side panels' : 'the header and the shelf front edges or side panels';
                    var _pdBrandClause = _pdt.brand
                        ? ' The BRAND NAME / HEADLINE text is: "' + _pdt.brand + '" — render it large and clearly legible on the ' + _pdMainPanel + '.'
                        : ' Render the brand name from the input large on the ' + _pdMainPanel + '.';
                    var _pdProdClause = _pdt.products
                        ? ' The supporting copy to print is: "' + _pdt.products + '". Render it as short readable printed text on ' + _pdSubPanel + '.'
                        : ' Keep any extra printed copy short.';
                    var _pdMoodClause = _pdt.concept
                        ? ' The color scheme and overall mood must be: "' + _pdt.concept + '". Apply this palette consistently across the header, shelf fronts and side panels.'
                        : ' Choose a clean color scheme that suits the brand and apply it consistently.';
                    // 2026-07-18: 좌=빈 목업 / 우=메인 인쇄면 실사 정면. 제품(상품)은 절대 넣지 않음.
                    if (_meAiPdIsTable) {
                        // 허니콤 테이블(hb_tb_*) — 부스/행사용 조립식 테이블(카운터). 인쇄면은 앞면 패널.
                        _bannerHint = ' Create a WIDE two-panel design presentation board, SPLIT LEFT AND RIGHT.'
                            + ' LEFT HALF: a photorealistic MOCKUP of the PROMOTIONAL EVENT TABLE / RECEPTION COUNTER shown in the attached reference image, shown in full.'
                            + ' CRITICAL: keep the EXACT physical STRUCTURE of the attached table — the same silhouette, the same number of tiers/shelves at the same heights, the same counter shape and depth, the same proportions and the same straight-on viewing angle. Do NOT invent a different piece of furniture, do NOT add or remove tiers, do NOT change its shape. ONLY replace the printed GRAPHICS on its surfaces.'
                            + ' CRITICAL: the table must be COMPLETELY EMPTY. Show absolutely NO merchandise, NO product packages, NO boxes, NO bottles, NO leaflets, NO cups and NO items of any kind on the counter, on any shelf or on the floor. This is a bare table showing only its printed graphics.'
                            + ' RIGHT HALF: a large FLAT, STRAIGHT-ON, FRONT-FACING photorealistic view of that table\'s MAIN FRONT PANEL (the wide printed face customers see) on its own, filling the right half — no perspective, no angle, no tabletop, shown flat like printed artwork so the design is clearly readable at full size.'
                            + ' The front-panel artwork on the left mockup and on the right flat view must be IDENTICAL.'
                            + _pdBrandClause + _pdProdClause + _pdMoodClause
                            + ' Keep all printed text crisp, upright and readable, and keep it well inside the panel away from its edges and fold lines, since panels get trimmed and creased.'
                            + ' Evenly lit studio product photography, plain uncluttered light neutral background behind both halves, NO people, NO other furniture in frame. This is a design concept mockup board for a printed event table.';
                    } else {
                        _bannerHint = ' Create a WIDE two-panel design presentation board, SPLIT LEFT AND RIGHT.'
                            + ' LEFT HALF: a photorealistic MOCKUP of the CARDBOARD RETAIL DISPLAY STAND shown in the attached reference image, shown in full.'
                            + ' CRITICAL: keep the EXACT physical STRUCTURE of the attached display — the same silhouette, the same number of shelves at the same heights, the same header/topper shape, the same side panels, the same proportions and the same straight-on viewing angle. Do NOT invent a different fixture, do NOT add or remove shelves, do NOT change its shape. ONLY replace the printed GRAPHICS on its surfaces.'
                            + ' CRITICAL: the shelves must be COMPLETELY EMPTY. Show absolutely NO merchandise, NO product packages, NO boxes, NO bottles, NO bags and NO items of any kind on any shelf or on the floor. This is an empty unstocked display stand showing only its printed graphics.'
                            + ' RIGHT HALF: a large FLAT, STRAIGHT-ON, FRONT-FACING photorealistic view of that display\'s MAIN HEADER ADVERTISING BOARD (the topper signage panel) on its own, filling the right half — no perspective, no angle, no shelves, shown flat like printed artwork so the header design is clearly readable at full size.'
                            + ' The header artwork on the left mockup and on the right flat view must be IDENTICAL.'
                            + _pdBrandClause + _pdProdClause + _pdMoodClause
                            + ' Keep all printed text crisp, upright and readable, and keep it well inside each panel away from the panel edges and fold lines, since panels get trimmed and creased.'
                            + ' Evenly lit studio product photography, plain uncluttered light neutral background behind both halves, NO people, NO other fixtures in frame. This is a design concept mockup board for a printed cardboard display stand.';
                    }
                }
                // 2026-07-18: 포스터(세로/가로) — 타이틀·주최·일시·장소 등 여러 정보를 계층적으로 배치. (스카시/종이매대는 제외)
                var _isPoster = (!_meAiScarci) && (!_meAiPaperDisplay) && (_meAiRatio === '9:16' || _meAiRatio === '16:9');
                if (_isPoster) {
                    _bannerHint += ' Design it as an EVENT POSTER. Read the user text as poster information (main title, host/organizer, date & time, place, and any extra details) and arrange it with a clear visual hierarchy: the MAIN TITLE largest and most eye-catching, with the host, date/time and location shown as clearly readable supporting text (often near the bottom). Make it attractive and well-composed, and keep all text within the central safe area away from the edges.';
                }
                // 기본 안전영역 지시 — 배경은 가장자리까지 꽉 채우되(풀블리드) 글자·핵심요소만 안쪽에.
                //   ※ "여백" 이라고 하면 실제 테두리를 그려버려서, 테두리 금지 + 배경 풀블리드를 명시.
                //   2026-07-18: 대지 비율이 생성 비율과 달라 삽입(cover) 시 가장자리가 잘리므로 사방 여백을 크게 강조.
                // 2026-07-18: 종이매대는 매대 전체가 프레임에 들어와야 하는 목업이라 '사방 여백' 지시를 빼고
                //   대신 매대가 잘리지 않게 프레임 안에 온전히 담으라고 지시. (그 외 제품은 기존 안전영역 유지)
                var genPrompt1 = _meAiPaperDisplay
                    ? prompt + ' Frame it so BOTH halves are fully visible inside the image — do not crop the top, base or sides of the object on the left, and do not crop the flat panel on the right. Leave a little clean background around each. Do NOT draw any border, frame or outline around the image itself.'
                        + _bannerHint
                    : prompt + ' The background and imagery must extend fully to all edges (full bleed). Do NOT draw any border, frame, outline, or colored margin around the image.'
                        + ' IMPORTANT SAFE MARGIN: keep ALL text and every important element inside the CENTER, staying at least 18-22% away from every edge (top, bottom, left AND right). Leave a LARGE empty background margin on all four sides — roughly one-fifth of the width/height on each side must be clear background. The final print may be cropped or a different aspect ratio, so nothing important — especially text — may sit near any edge, or it will be cut off.'
                        + _bannerHint;
                // 2026-07-18: 참조 이미지가 있으면 모드에 따라 다른 지시 + refImage 전달(edits API)
                //   blend = 사진을 살려 합성 / reference = 스타일·구도만 참고해 완전히 새로 (내용 복사 금지)
                if (_meAiRefDataUrl) {
                    if (_meAiRefMode === 'structure') {
                        // 종이매대: 첨부 썸네일의 형태·구조는 그대로, 겉면 그래픽만 교체
                        genPrompt1 = 'Use the attached image as a STRICT STRUCTURAL reference for the ' + (_meAiPdIsTable ? 'event table' : 'display stand') + ' rendered in the LEFT half of the output. Reproduce its exact shape, proportions, tier/shelf count and layout, and camera angle, but REPLACE all printed graphics, colors and text on its surfaces with a new design as described below, and leave it completely empty with nothing placed on it. Do NOT copy the reference\'s branding, text, artwork or any merchandise shown on it. ' + genPrompt1;
                    } else if (_meAiRefMode === 'reference') {
                        genPrompt1 = 'Use the attached image ONLY as a STYLE, LAYOUT and MOOD reference. Create a COMPLETELY NEW, original design in a similar visual style, color mood and composition — do NOT copy its text, logos, photos, or specific content. ' + genPrompt1;
                    } else {
                        genPrompt1 = 'Use the provided photo as the main subject/material. Keep its recognizable content, and design around it as requested. ' + genPrompt1;
                    }
                }
                var _reqBody = { prompt: genPrompt1, size: size };
                // 2026-07-18: 참조 이미지는 반드시 정규화해서 보낸다 (아래 _meAiNormalizeRef 주석 참고).
                if (_meAiRefDataUrl) {
                    var _refNorm = await _meAiNormalizeRef(_meAiRefDataUrl, 1536);
                    if (_refNorm) _reqBody.refImage = _refNorm;
                }
                var r1 = await fetch(SB_URL + '/functions/v1/ai-image-gen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SB_KEY, 'apikey': SB_KEY },
                    body: JSON.stringify(_reqBody)
                });
                var d1 = await r1.json();
                if (!r1.ok || d1.error) throw new Error(d1.detail || d1.error || ('HTTP ' + r1.status));
                url = d1.url;
            } else {
                var genPrompt2 = prompt + ' The background must extend fully to all edges (full bleed). Do NOT draw any border, frame, or colored margin. Keep ALL text and important elements in the CENTER, at least 18-22% away from every edge (top, bottom, left and right), with a large empty margin (about one-fifth of each side) on all four sides — the print may be cropped, so nothing important may sit near an edge.';
                var r2 = await fetch(SB_URL + '/functions/v1/generate-image-flux', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SB_KEY, 'apikey': SB_KEY },
                    body: JSON.stringify({ prompt: genPrompt2, ratio: _meAiRatio })
                });
                var d2 = await r2.json();
                if (!r2.ok || d2.error) throw new Error(d2.error || ('HTTP ' + r2.status));
                var raw = d2.imageUrl || d2;
                if (Array.isArray(raw)) raw = raw[0];
                if (raw && typeof raw === 'object' && raw.url) raw = raw.url;
                url = raw;
            }
            if (!url) throw new Error(_meAiTr('이미지를 받지 못했어요.', '画像を取得できませんでした。', 'No image returned.'));
            // 호스팅 URL(Flux)은 _meAddImage 가 crossOrigin 없이 로드 → 캔버스 오염(export 깨짐).
            //   삽입 전 dataURL 로 변환해 안전하게. (dataURL 이면 그대로)
            if (url.indexOf('data:') !== 0) {
                try {
                    var ir = await fetch(url, { mode: 'cors' });
                    if (ir.ok) {
                        var ib = await ir.blob();
                        url = await new Promise(function (resolve, reject) {
                            var fr = new FileReader();
                            fr.onload = function () { resolve(String(fr.result)); };
                            fr.onerror = function () { reject(new Error('dataURL 변환 실패')); };
                            fr.readAsDataURL(ib);
                        });
                    }
                } catch (_conv) { console.warn('[meAi] dataURL convert failed, using raw url', _conv); }
            }
            _meAiPendingUrl = url;
            if (res) { res.innerHTML = '<img src="' + url + '" style="max-width:100%; max-height:260px; border-radius:8px; object-fit:contain;">'; res.style.color = ''; }
            // 2026-07-18: 스카시/종이매대면 결과 버튼(수정해서 다시만들기/이대로 제작)으로 스와프, 아니면 기존 '캔버스에 넣기'
            if (_meAiScarci || _meAiPaperDisplay) {
                if (ins) ins.style.display = 'none';
                var _scB = document.getElementById('meAiScarciBtns'); if (_scB) _scB.style.display = 'block';
                var _tip2s=document.getElementById('meAiTip'); if(_tip2s)_tip2s.style.display='none';
            } else {
                if (ins) ins.style.display = 'block';
                var _tip2=document.getElementById('meAiTip'); if(_tip2)_tip2.style.display='block';
                // 작품 갤러리 자동등록 (개인정보 없는 새 디자인만) — 비동기 fire&forget
                try { _meAiTryRegisterGallery(url, prompt, _meAiRatio); } catch (_reg) {}
            }
        } catch (e) {
            console.error('[meAi] generate', e);
            if (res) { res.innerHTML = _meAiTr('생성 실패', '生成失敗', 'Failed'); res.style.color = '#dc2626'; }
            if (err) { err.textContent = '⚠️ ' + (e.message || 'error'); err.style.display = 'block'; }
        } finally {
            _meAiBarStop();
            if (go) go.disabled = false;
        }
    }
})();
