/* ════════════════════════════════════════════════════════════════════════
   product-tutorial.js — 게임형 제품 주문 튜토리얼 엔진 (재사용)
   ────────────────────────────────────────────────────────────────────────
   2026-06-25: 명함(pp_bc_*) 1차. 모달이 열리면 모드 선택(튜토리얼/일반).
   v2: 플랫 디자인(그림·볼드·그림자 제거), 다음부터바로주문 삭제, 파일 3갈래 분기.
   v3: ① 이전(뒤로) 버튼 ② 에디터 모드 = 템플릿 띄우고 자유 디자인 + "디자인 끝나고
       다음 진행하기" 바 → 용지로 ③ 에디터 모드는 박/후가공이 로고 부분에 처리됨을 안내.
   설계: 순수 추가형 오버레이. 기존 가격/state 로직은 절대 건드리지 않고,
     기존 버튼/섹션을 하이라이트하고 클릭을 위임만 한다.
   확장: 신규 제품 = SCENARIOS 배열에 {id, match, steps} 1개 추가하면 끝.
   진입점: window._tutMaybeStart(product)  ← simple_order.js openSimpleOrderModal 끝에서 호출.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._tutMaybeStart) return;

  // ── i18n ──────────────────────────────────────────────────────────────
  var _lang = 'kr';
  function detectLang() {
    try {
      var sc = (window.__SITE_CODE || '').toString().toUpperCase();
      if (sc === 'JP' || sc === 'JA') return 'ja';
      if (sc === 'US' || sc === 'EN') return 'en';
      if (sc === 'KR' || sc === 'KO') return 'kr';
    } catch (_) {}
    try {
      var lp = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
      if (lp === 'ja' || lp === 'jp') return 'ja';
      if (lp === 'en' || lp === 'us') return 'en';
      if (lp === 'ko' || lp === 'kr') return 'kr';
    } catch (_) {}
    var h = (location.hostname || '').toLowerCase();
    if (h.indexOf('cafe0101') >= 0) return 'ja';
    if (h.indexOf('cafe3355') >= 0) return 'en';
    return 'kr';
  }
  function tr(kr, ja, en) {
    return _lang === 'ja' ? (ja != null ? ja : kr) : _lang === 'en' ? (en != null ? en : kr) : kr;
  }
  function T(o) {
    if (o == null) return '';
    if (typeof o === 'function') { try { return T(o()); } catch (_) { return ''; } }
    if (typeof o === 'string') return o;
    return tr(o.kr, o.ja, o.en);
  }

  // ── 엔진 상태 ──────────────────────────────────────────────────────────
  var _active = false;
  var _steps = null;
  var _cur = null;          // 현재 렌더 레코드 {kind,i,...}
  var _hist = [];           // 이전 레코드들 (이전 버튼용)
  var _targets = [];
  var _stepCleanup = [];
  var _looping = false;
  var _freeMode = false;    // 에디터 자유 디자인 모드
  var _chosenBranch = 'upload'; // upload | editor | request
  var _awaitPick = null;    // {cat,i,cheer} — 실제 옵션 '선택' 시에만 다음 단계 진행 (미리보기 탭 무시)

  // ── DOM refs ────────────────────────────────────────────────────────────
  var _root, _blocker, _hole, _pop;

  function ensureStyles() {
    if (document.getElementById('tut-styles')) { ensureDom(); return; }
    var css = ''
      + '#tut-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;'
      + "font-family:'Pretendard',-apple-system,system-ui,'Apple SD Gothic Neo',sans-serif;}"
      + '#tut-blocker{position:fixed;inset:0;background:rgba(17,24,39,0.55);pointer-events:auto;display:none;}'
      + '#tut-hole{position:fixed;display:none;border-radius:12px;pointer-events:none;'
      + 'box-shadow:0 0 0 3px rgba(109,40,217,0.9),0 0 0 9999px rgba(17,24,39,0.55);'
      + 'transition:left .26s ease,top .26s ease,width .26s ease,height .26s ease;'
      + 'animation:tutHolePulse 1.15s ease-in-out infinite;}'
      + '@keyframes tutHolePulse{0%,100%{box-shadow:0 0 0 3px rgba(109,40,217,0.9),0 0 0 9999px rgba(17,24,39,0.55);}50%{box-shadow:0 0 0 7px rgba(109,40,217,0.55),0 0 0 9999px rgba(17,24,39,0.55);}}'
      + '@keyframes tutBlink{0%,100%{box-shadow:0 0 0 0 rgba(109,40,217,0);}50%{box-shadow:0 0 0 6px rgba(109,40,217,0.6);}}'
      + '.tut-blink{position:relative;z-index:2147483050;border-radius:12px;animation:tutBlink 1.05s ease-in-out infinite;}'
      + '.tut-pop{position:fixed;pointer-events:auto;width:min(320px,calc(100vw - 28px));'
      + 'background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;}'
      + '.tut-pop.center{left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;}'
      + '.tut-head{font-size:11.5px;font-weight:600;color:#9ca3af;margin-bottom:9px;}'
      + '.tut-msg{font-size:13.5px;line-height:1.62;color:#374151;font-weight:500;margin-bottom:13px;}'
      + '.tut-msg b{color:#6d28d9;font-weight:700;}'
      + '.tut-x{position:absolute;top:10px;right:12px;border:none;background:transparent;color:#cbd5e1;font-size:16px;cursor:pointer;line-height:1;padding:2px;font-family:inherit;}'
      + '.tut-x:hover{color:#6b7280;}'
      + '.tut-actions{display:flex;align-items:center;gap:8px;}'
      + '.tut-btn{flex:1;border:none;border-radius:10px;padding:11px 12px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;}'
      + '.tut-btn-go{background:#6d28d9;color:#fff;}'
      + '.tut-btn-go:hover{background:#5b21b6;}'
      + '.tut-btn-ghost{background:#f3f4f6;color:#4b5563;flex:none;padding:11px 14px;}'
      + '.tut-btn-ghost:hover{background:#e5e7eb;}'
      + '.tut-hint{display:flex;align-items:center;gap:7px;justify-content:center;background:#f5f3ff;color:#6d28d9;'
      + 'border:1px dashed #ddd6fe;border-radius:10px;padding:9px 12px;font-size:12.5px;font-weight:600;box-sizing:border-box;}'
      + '.tut-pick{display:flex;gap:8px;margin:4px 0 12px;}'
      + '.tut-pick-btn{flex:1;border:1.5px solid #ddd6fe;background:#f5f3ff;color:#6d28d9;border-radius:12px;padding:12px 8px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;line-height:1.3;}'
      + '.tut-pick-btn:hover{background:#ede9fe;border-color:#c4b5fd;}'
      + '.tut-sel{margin:0 0 12px;padding:9px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;color:#047857;font-size:12.5px;font-weight:700;line-height:1.45;}'
      + '.tut-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;}'
      + '.tut-link{border:none;background:transparent;color:#9ca3af;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}'
      + '.tut-link:hover{color:#6b7280;text-decoration:underline;}'
      + '.tut-opt{display:block;width:100%;border:1px solid #e5e7eb;background:#fff;border-radius:12px;'
      + 'padding:13px 14px;margin-top:9px;cursor:pointer;font-family:inherit;text-align:left;}'
      + '.tut-opt:hover{border-color:#6d28d9;background:#faf5ff;}'
      + '.tut-opt .o1{font-size:14px;font-weight:700;color:#1f2937;}'
      + '.tut-opt .o2{font-size:11.5px;font-weight:500;color:#6b7280;margin-top:2px;}'
      + '.tut-opt.accent{border-color:#6d28d9;background:#faf5ff;}'
      + '.tut-choice{position:fixed;pointer-events:auto;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:22px;}'
      + '.tut-choice h3{margin:0 0 6px;font-size:18px;font-weight:700;color:#111827;}'
      + '.tut-choice p{margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;}'
      + '.tut-toast{position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);pointer-events:none;max-width:300px;text-align:center;'
      + 'background:#6d28d9;color:#fff;font-size:14px;font-weight:600;padding:12px 22px;border-radius:16px;z-index:2147483600;'
      + 'animation:tutToast 2.4s ease forwards;}'
      + '@keyframes tutToast{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}8%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}14%{transform:translate(-50%,-50%) scale(1)}88%{opacity:1}100%{opacity:0}}'
      + '.tut-confetti{position:fixed;top:0;left:0;pointer-events:none;z-index:2147483500;border-radius:2px;}'
      + '#tut-donebar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483200;pointer-events:auto;'
      + 'display:flex;gap:6px;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:7px 8px;}'
      + '@keyframes tutDbPulse{0%,100%{transform:scale(1);background:#6d28d9;}50%{transform:scale(1.06);background:#7c3aed;}}'
      + '#tut-donebar .db-go{background:#6d28d9;color:#fff;border:none;border-radius:999px;padding:9px 20px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.28;animation:tutDbPulse 1.1s ease-in-out infinite;}'
      + '#tut-donebar .db-go:hover{background:#5b21b6;animation:none;transform:none;}'
      + '#tut-donebar .db-back{background:transparent;border:none;color:#6b7280;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;padding:8px 12px;}'
      + '#tut-replay{position:fixed;left:14px;bottom:16px;z-index:50050;pointer-events:auto;'
      + 'border:none;border-radius:999px;padding:9px 14px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;'
      + 'background:#6d28d9;color:#fff;display:flex;align-items:center;gap:6px;}'
      + '#tut-replay:hover{background:#5b21b6;}'
      + '@media(max-width:640px){#tut-replay{left:12px;bottom:140px;}#tut-donebar{bottom:84px;}}';
    var st = document.createElement('style');
    st.id = 'tut-styles';
    st.textContent = css;
    document.head.appendChild(st);
    ensureDom();
  }

  function ensureDom() {
    if (_root && document.body.contains(_root)) return;
    _root = document.createElement('div'); _root.id = 'tut-root';
    _blocker = document.createElement('div'); _blocker.id = 'tut-blocker';
    _hole = document.createElement('div'); _hole.id = 'tut-hole';
    _pop = document.createElement('div'); _pop.className = 'tut-pop'; _pop.style.display = 'none';
    _root.appendChild(_blocker); _root.appendChild(_hole); _root.appendChild(_pop);
    document.body.appendChild(_root);
  }

  // ── 유틸 ────────────────────────────────────────────────────────────────
  function modalOpen() {
    var m = document.getElementById('simpleOrderModal');
    return !!(m && m.classList.contains('open'));
  }
  function isVisible(el) {
    try {
      var r = el.getBoundingClientRect();
      var fixed = getComputedStyle(el).position === 'fixed';
      return (el.offsetParent !== null || fixed) && r.width > 0 && r.height > 0;
    } catch (_) { return false; }
  }
  // 2026-07-10: 선택자로 가리키는 섹션이 실제로 화면에 보이는지 (제품별 옵션 단계 조건 스킵용)
  function _secVisible(sel) { try { var el = document.querySelector(sel); return !!(el && isVisible(el)); } catch (_) { return false; } }
  function resolveTargets(t) {
    if (!t) return [];
    var sels = Array.isArray(t) ? t : [t];
    var out = [];
    sels.forEach(function (s) {
      var el = typeof s === 'string' ? document.querySelector(s) : s;
      if (el && isVisible(el)) out.push(el);
    });
    return out;
  }
  function unionRect(els) {
    if (!els || !els.length) return null;
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach(function (e) {
      if (!isVisible(e)) return;
      var c = e.getBoundingClientRect();
      l = Math.min(l, c.left); t = Math.min(t, c.top); r = Math.max(r, c.right); b = Math.max(b, c.bottom);
    });
    if (l === Infinity) return null;
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }
  function scrollToEl(el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {} }

  function place() {
    if (!_active || _freeMode) return;
    var rect = unionRect(_targets);
    if (rect) {
      var pad = 6;
      _hole.style.display = 'block';
      _hole.style.left = (rect.left - pad) + 'px';
      _hole.style.top = (rect.top - pad) + 'px';
      _hole.style.width = (rect.width + pad * 2) + 'px';
      _hole.style.height = (rect.height + pad * 2) + 'px';
      _pop.classList.remove('center');
      // 2026-06-25: 코치마크가 타깃(카드/옵션) 위를 덮지 않도록 우선순위 배치.
      //   ① 오른쪽 옆 공간 → ② 왼쪽 옆 공간 (데스크탑: 카드 옆 빈 영역) →
      //   ③ 타깃 아래 → ④ 타깃 위 → ⑤ (모바일 풀폭 타깃처럼 공간 없음) 화면 하단 고정.
      var vw = window.innerWidth, vh = window.innerHeight;
      var gap = 14;
      var roomLeft = rect.left, roomRight = vw - rect.right;
      var roomTop = rect.top, roomBottom = vh - rect.bottom;
      var w = Math.min(vw < 480 ? 290 : 300, vw - 24);
      _pop.style.width = w + 'px';
      var popH = _pop.offsetHeight || 200;
      var cl = function (v, lo, hi) { return Math.max(lo, Math.min(v, hi)); };
      var L, Tp;
      if (roomRight >= w + gap) {                 // ① 오른쪽 옆
        L = Math.min(vw - w - 10, rect.right + gap);
        Tp = cl(rect.top + rect.height / 2 - popH / 2, 12, vh - popH - 12);
      } else if (roomLeft >= w + gap) {           // ② 왼쪽 옆
        L = Math.max(10, rect.left - w - gap);
        Tp = cl(rect.top + rect.height / 2 - popH / 2, 12, vh - popH - 12);
      } else if (roomBottom >= popH + gap) {      // ③ 아래
        Tp = rect.bottom + gap;
        L = cl(rect.left + rect.width / 2 - w / 2, 12, vw - w - 12);
      } else if (roomTop >= popH + gap) {         // ④ 위
        Tp = rect.top - popH - gap;
        L = cl(rect.left + rect.width / 2 - w / 2, 12, vw - w - 12);
      } else {                                    // ⑤ 화면 하단 고정 (덮을 공간 없을 때)
        Tp = vh - popH - 12;
        L = cl(rect.left + rect.width / 2 - w / 2, 12, vw - w - 12);
      }
      _pop.style.left = L + 'px'; _pop.style.top = Tp + 'px';
    } else {
      _hole.style.display = 'none';
      _pop.classList.add('center');
      _pop.style.width = ''; _pop.style.left = ''; _pop.style.top = '';
    }
  }
  // 2026-06-25: 현재 선택된 박/후가공을 가이드에 실시간 표시 (picker 에서 고르면 즉시 반영).
  function _tutUpdateSel() {
    var el = _pop && _pop.querySelector('#tutSelLine');
    if (!el) return;
    var s = '';
    try { if (typeof window._soBizSelectedSummary === 'function') s = window._soBizSelectedSummary() || ''; } catch (_) {}
    if (s) {
      el.style.display = '';
      el.textContent = T({ kr: '✅ 선택됨: ', ja: '✅ 選択: ', en: '✅ Selected: ' }) + s;
    } else {
      el.style.display = 'none';
    }
  }
  function loop() {
    if (_looping) return;
    _looping = true;
    (function frame() {
      if (!_active) { _looping = false; return; }
      if (!modalOpen()) { quit(); _looping = false; return; }
      place();
      _tutUpdateSel();
      requestAnimationFrame(frame);
    })();
  }

  // ── 칭찬 연출 ──────────────────────────────────────────────────────────
  function toast(txt) {
    if (!txt) return;
    var d = document.createElement('div');
    d.className = 'tut-toast';
    d.innerHTML = T(txt);
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2400);
  }
  function confetti(big) {
    var colors = ['#a78bfa', '#7c3aed', '#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#c084fc'];
    var n = big ? 80 : 34;
    var ox = window.innerWidth / 2, oy = window.innerHeight * (big ? 0.42 : 0.34);
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'tut-confetti';
      var sz = 6 + Math.floor(Math.random() * 8);
      d.style.width = sz + 'px';
      d.style.height = (sz * (0.5 + Math.random())) + 'px';
      d.style.background = colors[i % colors.length];
      d.style.left = ox + 'px'; d.style.top = oy + 'px';
      document.body.appendChild(d);
      var ang = Math.random() * Math.PI * 2;
      var dist = (big ? 150 : 100) + Math.random() * (big ? 210 : 140);
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist + 110 + Math.random() * 150;
      var rot = (Math.random() * 720 - 360);
      (function (el) {
        try {
          el.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0 }],
            { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.15,.6,.3,1)' }).onfinish = function () { el.remove(); };
        } catch (_) { setTimeout(function () { el.remove(); }, 1400); }
      })(d);
    }
  }
  function celebrate(cheer) { confetti(false); if (cheer) toast(cheer); }

  // ── 버튼 반짝임 (자유 모드에서 눌러야 할 버튼 강조) ──────────────────────
  var _blinkEls = [];
  function _tutBlink(sels) {
    _tutBlinkClear();
    (sels || []).forEach(function (s) {
      try { var el = typeof s === 'string' ? document.querySelector(s) : s; if (el) { el.classList.add('tut-blink'); _blinkEls.push(el); } } catch (_) {}
    });
  }
  function _tutBlinkClear() {
    _blinkEls.forEach(function (el) { try { el.classList.remove('tut-blink'); } catch (_) {} });
    _blinkEls = [];
  }

  // ── 공통 렌더 헬퍼 ──────────────────────────────────────────────────────
  function clearStep() {
    _stepCleanup.forEach(function (fn) { try { fn(); } catch (_) {} });
    _stepCleanup = [];
    _tutBlinkClear();
  }
  function headHtml(i) {
    return '<div class="tut-head">' + T({ kr: '주문 안내', ja: 'ご案内', en: 'Order guide' })
      + ' · ' + (i + 1) + ' / ' + _steps.length + '</div>';
  }
  function backLink() {
    return _hist.length
      ? '<button class="tut-link" data-act="back">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>'
      : '<span></span>';
  }

  // ── 네비게이션 ──────────────────────────────────────────────────────────
  function navigate(rec) {
    if (_cur) _hist.push(_cur);
    _cur = rec;
    render(rec);
  }
  function back() {
    if (!_hist.length) return;
    clearStep(); removeDoneBar(); _freeMode = false;
    _cur = _hist.pop();
    render(_cur);
  }
  function enterStep(i) {
    if (!_steps || i >= _steps.length) { navigate({ kind: 'finale' }); return; }
    var s = _steps[i];
    if (s.onEnter) {
      var ok = true; try { ok = s.onEnter() !== false; } catch (_) { ok = true; }
      if (!ok) { enterStep(i + 1); return; }
    }
    navigate(s.branch ? { kind: 'branch', i: i } : { kind: 'step', i: i });
  }
  function render(rec) {
    if (rec.kind === 'step') renderStep(rec.i);
    else if (rec.kind === 'branch') renderBranch(rec.i);
    else if (rec.kind === 'finale') renderFinale();
  }

  // 2026-06-26: simple_order 가 옵션을 '선택'했을 때 호출 — 그 카테고리를 기다리는 wait 스텝이면 다음 진행.
  window._soTutOnPick = function (cat) {
    if (!_active || !_awaitPick || _awaitPick.cat !== cat) return;
    var rec = _awaitPick; _awaitPick = null;
    try { celebrate(rec.cheer); } catch (_) {}
    enterStep(rec.i + 1);
  };

  // ── 일반 단계 ──────────────────────────────────────────────────────────
  function renderStep(i) {
    clearStep(); removeDoneBar(); _freeMode = false;
    var step = _steps[i];
    _targets = resolveTargets(step.target);
    if (step.mode === 'wait' && !_targets.length) { enterStep(i + 1); return; }
    if (_targets[0]) scrollToEl(_targets[0]);
    _blocker.style.display = _targets.length ? 'none' : 'block';

    var foot;
    var _defHint = { kr: '반짝이는 곳을 눌러주세요', ja: '光っている所をタップ', en: 'Tap the highlighted spot' };
    if (step.mode === 'wait') {
      foot = '<div class="tut-hint">👆 ' + T(step.hint || _defHint) + '</div>'
        + '<div class="tut-foot">' + backLink()
        + '<button class="tut-link" data-act="next">' + T(step.skipLabel || { kr: '건너뛰기', ja: 'スキップ', en: 'Skip' }) + '</button></div>';
    } else {
      // 2026-06-25: next 모드도 step.hint 있으면 안내 라인 표시 (예: 후가공 — 설명 보고 골라주세요)
      foot = (step.hint ? '<div class="tut-hint" style="margin-bottom:9px;">👆 ' + T(step.hint) + '</div>' : '')
        + '<div class="tut-actions">'
        + (_hist.length ? '<button class="tut-btn tut-btn-ghost" data-act="back">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>' : '')
        + '<button class="tut-btn tut-btn-go" data-act="next">' + T(step.nextLabel || { kr: '다음 ▶', ja: '次へ ▶', en: 'Next ▶' }) + '</button></div>';
    }
    // 2026-06-25: 스텝에 picker 버튼 (예: 박 추가하기 / 후가공 추가하기) — 클릭 시 window[action](arg) 호출.
    var picksHtml = '';
    if (step.buttons && step.buttons.length) {
      picksHtml = '<div class="tut-pick">' + step.buttons.map(function (b) {
        return '<button class="tut-pick-btn" data-pick-action="' + b.action + '" data-pick-arg="' + (b.arg || '') + '">' + T(b.label) + '</button>';
      }).join('') + '</div>';
    }
    var selHtml = step.showSelection ? '<div class="tut-sel" id="tutSelLine" style="display:none;"></div>' : '';
    _pop.innerHTML = '<button class="tut-x" data-act="quit">✕</button>' + headHtml(i)
      + '<div class="tut-msg">' + T(step.msg) + '</div>' + picksHtml + selHtml + foot;
    _pop.style.display = 'block';
    if (step.showSelection) _tutUpdateSel();
    bindCommon(function () { enterStep(i + 1); });
    _pop.querySelectorAll('[data-pick-action]').forEach(function (b) {
      b.addEventListener('click', function () {
        var fn = window[b.getAttribute('data-pick-action')];
        if (typeof fn === 'function') { try { fn(b.getAttribute('data-pick-arg')); } catch (_) {} }
      });
    });

    _awaitPick = null;
    if (step.mode === 'wait') {
      if (step.waitEvent) {
        // 2026-07-11: 타깃을 눌러 작업을 시작하되(버튼 onclick), 실제 완료 이벤트가 올 때만 다음 단계로.
        //   예: 누끼(배경제거)는 3~4초 걸리므로 클릭 즉시가 아니라 'me-cutout-done' 이벤트를 기다림.
        var _ev = step.waitEvent;
        var onEv = function () { document.removeEventListener(_ev, onEv); celebrate(step.cheer); enterStep(i + 1); };
        document.addEventListener(_ev, onEv);
        _stepCleanup.push(function () { document.removeEventListener(_ev, onEv); });
      } else if (step.waitClose) {
        // 2026-07-10: 타깃(예: 칼선 버튼)을 눌러 모달을 열고, 그 모달이 닫혀야(작업 완료) 다음 단계로.
        //   버튼 클릭만으로는 진행 안 함 (칼선 모양 선택을 마쳐야 사이즈 단계로). 모달 열리면 안내창 숨김.
        var _wc = step.waitClose, _wcOpen = false, _wcTicks = 0;
        var _wcMon = setInterval(function () {
          if (!_active) { clearInterval(_wcMon); return; }
          _wcTicks++;
          var op = _secVisible(_wc);
          if (op) { _wcOpen = true; _freeMode = true; _pop.style.display = 'none'; _hole.style.display = 'none'; return; }
          if (_wcOpen) { clearInterval(_wcMon); _freeMode = false; celebrate(step.cheer); enterStep(i + 1); return; }
          if (_wcTicks > 240) { clearInterval(_wcMon); } // ~2분 안전 종료
        }, 500);
        _stepCleanup.push(function () { clearInterval(_wcMon); });
      } else if (step.awaitPick) {
        // 2026-06-26: 실제 옵션 '선택'(모달의 '이 옵션 선택') 시에만 진행 — 미리보기 탭/닫기로는 진행 안 함.
        _awaitPick = { cat: step.awaitPick, i: i, cheer: step.cheer };
      } else {
        var onClick = function () { celebrate(step.cheer); enterStep(i + 1); };
        _targets.forEach(function (t) {
          t.addEventListener('click', onClick, { once: true });
          _stepCleanup.push(function () { t.removeEventListener('click', onClick); });
        });
      }
    }
    loop();
  }

  function bindCommon(onNext) {
    _pop.querySelectorAll('[data-act]').forEach(function (b) {
      var a = b.getAttribute('data-act');
      b.addEventListener('click', function () {
        if (a === 'quit') quit();
        else if (a === 'back') back();
        else if (a === 'next') onNext();
      });
    });
  }

  // ── 분기 단계 ──────────────────────────────────────────────────────────
  function renderBranch(i) {
    clearStep(); removeDoneBar(); _freeMode = false;
    var step = _steps[i];
    _targets = [];
    _blocker.style.display = 'block'; _hole.style.display = 'none';
    var opts = step.branch.filter(function (o) { return o.always || resolveTargets(o.target).length > 0; });
    var html = '<button class="tut-x" data-act="quit">✕</button>' + headHtml(i)
      + '<div class="tut-msg">' + T(step.msg) + '</div>';
    opts.forEach(function (o, idx) {
      html += '<button class="tut-opt" data-opt="' + idx + '"><div class="o1">' + T(o.label)
        + '</div><div class="o2">' + T(o.sub) + '</div></button>';
    });
    html += '<div class="tut-foot">' + backLink() + '<span></span></div>';
    _pop.innerHTML = html;
    _pop.style.display = 'block'; _pop.classList.add('center');
    _pop.querySelector('[data-act="quit"]').addEventListener('click', quit);
    var bk = _pop.querySelector('[data-act="back"]'); if (bk) bk.addEventListener('click', back);
    _pop.querySelectorAll('[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = opts[parseInt(b.getAttribute('data-opt'), 10)];
        _chosenBranch = o.key || 'upload';
        if (o.mode === 'free') renderFree(i, o);
        else if (o.mode === 'request') renderRequest(i, o);
        else renderDetail(i, o);
      });
    });
    loop();
  }

  // 파일올리기 / 디자인의뢰 — 안내 팝업 (branch 의 sub-state, _cur 는 그대로 branch)
  function renderDetail(i, opt) {
    clearStep(); removeDoneBar(); _freeMode = false;
    _targets = resolveTargets(opt.target);
    if (_targets[0]) scrollToEl(_targets[0]);
    _blocker.style.display = _targets.length ? 'none' : 'block';
    _pop.innerHTML = '<button class="tut-x" data-act="quit">✕</button>' + headHtml(i)
      + '<div class="tut-msg">' + T(opt.msg) + '</div>'
      + '<div class="tut-actions">'
      + '<button class="tut-btn tut-btn-ghost" data-act="branchback">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>'
      + '<button class="tut-btn tut-btn-go" data-act="next">' + T({ kr: '다음 ▶', ja: '次へ ▶', en: 'Next ▶' }) + '</button></div>';
    _pop.style.display = 'block'; _pop.classList.remove('center');
    _pop.querySelector('[data-act="quit"]').addEventListener('click', quit);
    _pop.querySelector('[data-act="branchback"]').addEventListener('click', function () { renderBranch(i); });
    _pop.querySelector('[data-act="next"]').addEventListener('click', function () { enterStep(i + 1); });
    if (typeof opt.hook === 'function') {
      try {
        var cl = opt.hook(function (cheer) { celebrate(cheer); enterStep(i + 1); });
        if (typeof cl === 'function') _stepCleanup.push(cl);
      } catch (_) {}
    }
    loop();
  }

  // 에디터 모드 — 템플릿 띄우고 자유 디자인. 하단 "디자인 끝나고 다음 진행하기" 바.
  function renderFree(i, opt) {
    clearStep();
    _freeMode = true;
    _targets = [];
    _pop.style.display = 'none'; _hole.style.display = 'none'; _blocker.style.display = 'none';
    var sec = document.getElementById('soQuickDesignSec');
    if (sec) { try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} }
    if (opt.template === 'ai') {
      // 2026-07-10: AI 이미지 자유 디자인 — AI 버튼을 반짝이게 → 눌러서 생성 후 글씨·요소 추가하고 done bar 로 진행.
      _tutBlink(['#meAiGenBtn']);
      setTimeout(function () {
        try { var b = document.getElementById('meAiGenBtn'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      }, 300);
    } else if (opt.template === 'rail') {
      // 2026-07-10: 공통 템플릿 레일(editor-rail.js) 사용 — 명함/인스타판넬 같은 제품별 전용 모달 대신
      //   대부분 제품은 하단 레일의 공통 템플릿을 씀. 레일의 '템플릿' 탭을 켜고 그쪽으로 스크롤 + 반짝임.
      setTimeout(function () {
        try { if (typeof window._soQdRailSwitch === 'function') window._soQdRailSwitch('design_tpl'); } catch (_) {}
        try {
          var rail = document.getElementById('soQdRailThumbs') || document.querySelector('.qd-rail');
          if (rail) rail.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {}
        _tutBlink(['#soQdRailThumbs']);
      }, 350);
    } else {
      // 제품별 전용 템플릿 픽커 (명함 등 특수 제품)
      setTimeout(function () {
        try {
          if (typeof window._meOpenTemplatePicker === 'function') window._meOpenTemplatePicker();
          else { var tb = document.getElementById('meTemplateBtn'); if (tb) tb.click(); }
        } catch (_) {}
      }, 350);
    }
    toast(opt.msg);
    mountDoneBar(
      function () { _freeMode = false; removeDoneBar(); celebrate({ kr: '디자인 완성! 🎉', ja: 'デザイン完成! 🎉', en: 'Design done! 🎉' }); enterStep(i + 1); },
      function () { _freeMode = false; removeDoneBar(); renderBranch(i); }
    );
    loop();
  }

  // 디자인 의뢰 모드 — 튜토리얼을 잠시 숨기고 디자인 의뢰 팝업을 띄움.
  //   의뢰 팝업이 닫히면(등록/취소/닫기) 튜토리얼 재개 → 다음 단계(배너 종류 등)로.
  function renderRequest(i, opt) {
    clearStep(); removeDoneBar();
    _freeMode = true; // place() 가 숨긴 팝업을 다시 안 띄우도록
    _targets = [];
    _pop.style.display = 'none'; _hole.style.display = 'none'; _blocker.style.display = 'none';
    setTimeout(function () {
      try { if (typeof window._soOpenDesignRequest === 'function') window._soOpenDesignRequest(); } catch (_) {}
    }, 150);
    toast(opt.msg || { kr: '디자인 의뢰를 작성해 주세요. 다 하시면 이어서 안내할게요.', ja: 'デザイン依頼を作成してください。完了後、続けてご案内します。', en: 'Fill out the design request. I\'ll continue guiding you after.' });
    // 의뢰 팝업이 열렸다가 닫히면 재개
    var wasOpen = false, ticks = 0;
    var mon = setInterval(function () {
      if (!_active) { clearInterval(mon); return; }
      ticks++;
      var open = _secVisible('#designReqPopup');
      if (open) { wasOpen = true; return; }
      if (wasOpen) { clearInterval(mon); _freeMode = false; enterStep(i + 1); return; }
      if (ticks > 40 && !wasOpen) { clearInterval(mon); } // ~20s 내 안 열리면 감시 종료(리다이렉트 등)
    }, 500);
    _stepCleanup.push(function () { clearInterval(mon); });
    loop();
  }

  function mountDoneBar(onGo, onBack) {
    removeDoneBar();
    var bar = document.createElement('div');
    bar.id = 'tut-donebar';
    bar.innerHTML = '<button class="db-back" aria-label="back">←</button>'
      + '<button class="db-go">' + T({ kr: '디자인 끝났나요?<br>다음진행', ja: 'デザイン完了?<br>次へ', en: 'Done designing?<br>Continue' }) + '</button>';
    document.body.appendChild(bar);
    bar.querySelector('.db-go').addEventListener('click', onGo);
    bar.querySelector('.db-back').addEventListener('click', onBack);
  }
  function removeDoneBar() { var b = document.getElementById('tut-donebar'); if (b) b.remove(); }

  // ── 피날레 ──────────────────────────────────────────────────────────────
  function renderFinale() {
    clearStep(); removeDoneBar(); _freeMode = false;
    _targets = [];
    _blocker.style.display = 'block'; _hole.style.display = 'none';
    _pop.innerHTML = '<button class="tut-x" data-act="quit">✕</button>'
      + '<div class="tut-head">' + T({ kr: '완료!', ja: '完了!', en: 'Done!' }) + '</div>'
      + '<div class="tut-msg">' + T({
        kr: '멋지게 잘했어요! ✨ 제 안내는 여기까지예요.<br>다음은 <b>장바구니 요정</b>이 안내해 드릴 거예요.',
        ja: '見事にできました! ✨ 私のご案内はここまで。<br>次は<b>カートの妖精</b>がご案内します。',
        en: 'Beautifully done! ✨ My part ends here.<br>The <b>cart fairy</b> guides you next.'
      }) + '</div>'
      + '<div class="tut-actions">'
      + (_hist.length ? '<button class="tut-btn tut-btn-ghost" data-act="back">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>' : '')
      + '<button class="tut-btn tut-btn-go" data-act="quit">' + T({ kr: '닫기 🎉', ja: '閉じる 🎉', en: 'Close 🎉' }) + '</button></div>';
    _pop.style.display = 'block'; _pop.classList.add('center');
    _pop.querySelectorAll('[data-act]').forEach(function (b) {
      var a = b.getAttribute('data-act');
      b.addEventListener('click', function () { if (a === 'back') back(); else quit(); });
    });
    confetti(true);
  }

  function quit() {
    clearStep(); removeDoneBar();
    _active = false; _looping = false; _freeMode = false;
    _targets = []; _cur = null; _hist = [];
    if (_pop) { _pop.style.display = 'none'; _pop.classList.remove('center'); }
    if (_hole) _hole.style.display = 'none';
    if (_blocker) _blocker.style.display = 'none';
  }

  function run(steps) {
    closeChooser(); ensureStyles();
    _steps = steps; _active = true;
    _cur = null; _hist = []; _freeMode = false; _chosenBranch = 'upload';
    enterStep(0);
  }

  // ── 모드 선택 창 ──────────────────────────────────────────────────────
  var _choice = null;
  function closeChooser() {
    if (_choice) { _choice.remove(); _choice = null; }
    if (!_active && _blocker) _blocker.style.display = 'none';
  }
  function showChooser(scn) {
    ensureStyles(); closeChooser();
    _blocker.style.display = 'block';
    _choice = document.createElement('div');
    _choice.className = 'tut-choice';
    _choice.innerHTML =
      '<h3>' + T({ kr: '주문이 처음이신가요?', ja: '初めてのご注文ですか?', en: 'First time ordering?' }) + '</h3>'
      + '<p>' + T({ kr: '처음이라면 제가 옆에서 안내할게요.<br>안내대로 클릭만 하면 끝! 이리오세요.',
        ja: '初めてなら私がご案内します。<br>クリックするだけで完了!こちらへどうぞ。',
        en: "First time? I'll guide you step by step.<br>Just click along — that's it!" }) + '</p>'
      + '<button class="tut-opt accent" data-act="tut"><div class="o1">'
      + T({ kr: '🎮 튜토리얼 모드', ja: '🎮 チュートリアル', en: '🎮 Tutorial mode' }) + '</div><div class="o2">'
      + T({ kr: '안내대로 클릭만 하면 끝', ja: '案内通りクリックするだけ', en: 'Just follow the clicks' }) + '</div></button>'
      + '<button class="tut-opt" data-act="norm"><div class="o1">'
      + T({ kr: '⚡ 바로 주문 (일반)', ja: '⚡ そのまま注文', en: '⚡ Order directly' }) + '</div><div class="o2">'
      + T({ kr: '주문에 익숙해요', ja: '注文に慣れています', en: "I'm familiar with ordering" }) + '</div></button>';
    _root.appendChild(_choice);
    _choice.querySelector('[data-act="tut"]').addEventListener('click', function () { run(scn.steps); });
    _choice.querySelector('[data-act="norm"]').addEventListener('click', closeChooser);
  }

  // ── 다시보기 버튼 ─────────────────────────────────────────────────────
  var _replayMon = null;
  function removeReplay() {
    var b = document.getElementById('tut-replay'); if (b) b.remove();
    if (_replayMon) { clearInterval(_replayMon); _replayMon = null; }
  }
  function mountReplay(scn) {
    if (document.getElementById('tut-replay')) return;
    var b = document.createElement('button');
    b.id = 'tut-replay';
    b.innerHTML = '<span>🎓</span><span>' + T({ kr: '튜토리얼', ja: 'チュートリアル', en: 'Tutorial' }) + '</span>';
    b.addEventListener('click', function () { showChooser(scn); });
    document.body.appendChild(b);
    _replayMon = setInterval(function () {
      if (!modalOpen()) { removeReplay(); if (_active) quit(); }
    }, 600);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (_active) quit(); else closeChooser(); }
  });

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 명함
  // ════════════════════════════════════════════════════════════════════
  function bizHasSpecial() {
    var f = document.getElementById('soBizFoilTogglePreview');
    var x = document.getElementById('soBizFinishTogglePreview');
    var ft = ((f && f.textContent) || '').trim();
    var xt = ((x && x.textContent) || '').trim();
    return ft.indexOf('✓') === 0 || xt.indexOf('✓') === 0;
  }

  var BIZCARD_STEPS = [
    // 2026-06-25: 명함은 항상 양면 기본 — 단/양면 선택 단계 폐지.
    { // 1) 디자인 방법 — 3갈래 (양면: 앞/뒤 모두)
      msg: { kr: '디자인은 <b>3가지 방법</b>이 있어요. 마음에 드는 걸 골라보세요!',
        ja: 'デザイン方法は <b>3つ</b>。お好きなものを選んでください!',
        en: 'There are <b>3 ways</b> to design. Pick the one you like!' },
      branch: [
        { key: 'upload', always: true, target: ['#soBizUploadBtn', '#soBizUploadBtnBack'],
          label: { kr: '파일 올리기 (앞·뒤)', ja: 'ファイルをアップロード (表裏)', en: 'Upload files (front/back)' },
          sub: { kr: '완성된 앞/뒤 파일이 있어요', ja: '完成した表裏ファイルがある', en: 'I have front & back files' },
          msg: { kr: '명함은 <b>양면</b>이에요! <b>앞면</b>과 <b>뒷면</b> 파일을 각각 올려주세요.<br>작업은 <b>92 × 52mm</b>, 재단은 <b>90 × 50mm</b> 📎 (한 면만 있으면 한쪽만 올려도 돼요)',
            ja: '名刺は <b>両面</b> です! <b>表面</b>と<b>裏面</b>のファイルをそれぞれアップロードしてください。<br>作業 <b>92 × 52mm</b>、仕上がり <b>90 × 50mm</b> 📎 (片面だけでもOK)',
            en: 'Cards are <b>double-sided</b>! Upload the <b>front</b> and <b>back</b> files separately.<br>Work <b>92 × 52mm</b>, trim <b>90 × 50mm</b> 📎 (one side is fine too)' },
          hook: function (advance) {
            var f = document.getElementById('soFile');
            var b = document.getElementById('soBizUploadBtnBack');
            var bf = document.getElementById('soBackFile');
            var done = false;
            var on = function () { if (done) return; done = true; advance({ kr: '와우! 잘했어요 🎉', ja: 'ワオ!上手にできました 🎉', en: 'Wow! Nicely done 🎉' }); };
            if (f) f.addEventListener('change', on, { once: true });
            if (bf) bf.addEventListener('change', on, { once: true });
            return function () { if (f) f.removeEventListener('change', on); if (bf) bf.removeEventListener('change', on); };
          }
        },
        { key: 'editor', mode: 'free', target: ['.qd-head-row', '#soQuickDesignSec'],
          label: { kr: '에디터로 직접 디자인', ja: 'エディタで自分でデザイン', en: 'Design it yourself' },
          sub: { kr: '템플릿에 글씨만 바꾸면 끝', ja: 'テンプレの文字を変えるだけ', en: 'Just edit text on a template' },
          msg: { kr: '🎨 템플릿을 띄웠어요! 마음에 드는 걸 고르고 <b>글씨만 바꾸면</b> 끝. 사진·요소도 자유롭게 넣으세요.<br>다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b> 버튼을 눌러주세요!',
            ja: '🎨 テンプレートを表示しました! お好きなものを選んで <b>文字を変えるだけ</b>。写真·要素も自由に。<br>完成したら下の <b>「デザイン完了 → 次へ進む」</b> を押してください!',
            en: '🎨 Templates are open! Pick one and <b>just change the text</b>. Add photos & elements freely.<br>When done, tap <b>"Done designing → Continue"</b> below!' }
        },
        { key: 'request', target: '#soDesignReqBanner',
          label: { kr: '디자인 의뢰하기', ja: 'デザインを依頼', en: 'Request a design' },
          sub: { kr: '전문 디자이너에게 맡겨요', ja: 'プロのデザイナーに任せる', en: 'Leave it to a pro' },
          msg: { kr: '디자인이 어렵다면 전문가에게 맡기세요! 아래 <b>디자인 의뢰</b> 배너를 누르면 디자이너가 <b>앞·뒤 모두</b> 멋지게 만들어 드려요. 영업일 <b>2~3일</b>이면 완성! ✏️',
            ja: 'デザインが難しければプロに! 下の <b>デザイン依頼</b> バナーを押すとデザイナーが <b>表裏とも</b> 仕上げます。<b>営業日2~3日</b>で完成! ✏️',
            en: 'If designing is hard, leave it to a pro! Tap the <b>Request a design</b> banner below — a designer crafts <b>both sides</b>. Ready in <b>2–3 business days</b>! ✏️' }
        }
      ]
    },
    { // 3) 용지
      target: '#soBizPaperGrid', mode: 'wait', awaitPick: 'paper',
      hint: { kr: '설명을 보고 맘에 드는 용지를 골라주세요', ja: '説明を見てお好みの用紙をお選びください', en: 'Read the notes and pick the paper you like' },
      msg: { kr: '잘했어요! 🎉 다음은 <b>용지</b>예요.<br>제일 무난한 건 <b>누브지</b>나 <b>랑데뷰 네추럴</b>. 펄 느낌 <b>컨셉</b>이나 <b>팝셋</b>도 멋져요 ✨',
        ja: '上手! 🎉 次は <b>用紙</b>。<br>無難なのは <b>ヌーブ紙</b> や <b>ランデブーナチュラル</b>。パール感の <b>コンセプト</b> や <b>ポップセット</b> も素敵 ✨',
        en: 'Great! 🎉 Next, the <b>paper</b>.<br>Safest picks: <b>Nuvegi</b> or <b>Rendezvous Natural</b>. Pearly <b>Concept</b> or <b>Popset</b> are lovely too ✨' },
      cheer: { kr: '탁월한 선택! 😍', ja: '素晴らしい選択! 😍', en: 'Excellent choice! 😍' }
    },
    { // 4) 박 / 후가공 — 타깃 없이 가이드만 띄우고, 버튼으로 옵션 모달 열기 (페이지 그리드는 가림)
      target: null, mode: 'next',
      showSelection: true,
      onEnter: function () {
        // 2026-06-25: 박/후가공 그리드를 접어 가이드 뒤로 안 보이게 → 버튼으로 모달 표시.
        try {
          ['soBizFoilWrap', 'soBizFinishWrap'].forEach(function (id) { var w = document.getElementById(id); if (w) w.style.display = 'none'; });
          ['soBizFoilToggleArrow', 'soBizFinishToggleArrow'].forEach(function (id) { var a = document.getElementById(id); if (a) a.textContent = '▼'; });
        } catch (_) {}
      },
      buttons: [
        { label: { kr: '✨ 박 추가하기', ja: '✨ 箔押し追加', en: '✨ Add foil' }, action: '_soOpenOptionPicker', arg: 'foil' },
        { label: { kr: '🛠️ 후가공 추가하기', ja: '🛠️ 後加工追加', en: '🛠️ Finishing' }, action: '_soOpenOptionPicker', arg: 'finish' }
      ],
      msg: function () {
        if (_chosenBranch === 'editor') {
          return { kr: '에디터로 디자인 중이시죠? 박·후가공은 위치를 직접 잡기 어려워요.<br>그래서 <b>박 추가</b>나 <b>후가공</b>을 선택하면 <b>로고 부분</b>에 맞춰 처리해 드려요. 필요 없으면 패스~ 😉',
            ja: 'エディタでデザイン中ですね? 箔押し·後加工は位置指定が難しいので、<b>箔押し追加</b>や<b>後加工</b>を選ぶと <b>ロゴ部分</b> に合わせて処理します。不要ならパス~ 😉',
            en: "Designing in the editor? Foil & finishing are hard to position precisely.<br>So if you add <b>foil</b> or <b>finishing</b>, we'll apply it to the <b>logo area</b>. Don't need it? Skip 😉" };
        }
        return { kr: '잘했어요! 이제 얼마 안 남았어요, 힘내요! 💪<br><b>박</b>·<b>후가공</b>은 꼭 해야 하는 게 아니에요. 더 멋진 작품을 위한 <b>선택 옵션</b>! 단순한 명함이면 패스~ 😉',
          ja: 'いい調子!あと少し、ファイト! 💪<br><b>箔押し</b>・<b>後加工</b>は必須ではありません。より素敵に仕上げる <b>オプション</b> です。シンプルな名刺ならパスでOK 😉',
          en: 'Great! Almost there, hang in! 💪<br><b>Foil</b> & <b>finishing</b> are optional — for an extra-special card. Simple card? Skip it 😉' };
      }
    },
    { // 5) 수량
      target: ['#soBizQtyPresets', '#soQtySection'], mode: 'next',
      msg: { kr: '<b>수량</b>을 정해요! 명함은 <b>100장(1각) 단위</b>로 주문돼요.<br><b>500장</b>부터는 <b>50% 할인</b> (박·후가공까지!) 💰 많이 필요하면 미리 넉넉히 만들어 두면 이득이에요 😊',
        ja: '<b>数量</b>を決めましょう!名刺は <b>100枚(1ロット)単位</b>。<br><b>500枚</b>から <b>50%割引</b> (箔・後加工も!) 💰 多めに作るとお得です 😊',
        en: "Pick the <b>quantity</b>! Cards come in <b>sets of 100</b>.<br>From <b>500 pcs</b>, get <b>50% off</b> (incl. foil/finishing!) 💰 Make extra to save 😊" }
    },
    { // 6) 별색 C100 안내 — 직접 파일 업로드 + 박/후가공 선택 시에만 (에디터/의뢰는 자동/디자이너 처리)
      target: ['#soBizFoilToggle', '#soBizFinishToggle'], mode: 'next',
      onEnter: function () { return bizHasSpecial() && _chosenBranch === 'upload'; },
      msg: { kr: '박·미싱·오시·형압을 고르셨네요! 일러스트에서 <b>별도 레이어</b>에 <b>C100 (시안 100%) 별색</b>으로 작업하거나 <b>금박</b>으로 지정해 주시면 돼요 🎨',
        ja: '箔押し・ミシン目・スジ・型押しを選びましたね!イラストで <b>別レイヤー</b> に <b>C100 (シアン100%) 特色</b> または <b>金箔</b> 指定で作成してください 🎨',
        en: 'You picked foil/perforation/crease/emboss! In Illustrator, mark them on a <b>separate layer</b> using <b>C100 (cyan 100%) spot</b> or specify <b>gold foil</b> 🎨' }
    },
    { // 7) 장바구니
      target: '#soBtnCart', mode: 'wait',
      hint: { kr: '장바구니를 눌러주세요', ja: 'カートを押してください', en: 'Tap the cart button' },
      msg: { kr: '자, 이제 <b>장바구니에 담아</b>볼까요? 🛒',
        ja: 'さあ、<b>カートに入れて</b>みましょう 🛒',
        en: "Now, let's <b>add it to the cart</b> 🛒" }
    }
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 범용(모든 제품 catch-all)
  //  2026-07-10: 명함 외 전 제품에 튜토리얼 부착. 공통으로 존재하는 요소만
  //  사용 → 제품별 DOM 차이에 안전. 숨겨진 분기(에디터·의뢰 배너)는
  //  resolveTargets(isVisible) 로 자동 제외, 수량 없는 면적/사이즈 제품은
  //  mode:'wait'+타깃없음 → 자동 스킵. (명함처럼 세밀한 안내가 필요한 제품은
  //  전용 STEPS 를 SCENARIOS 앞쪽에 추가하면 그쪽이 우선 매치됨.)
  // ════════════════════════════════════════════════════════════════════
  var GENERIC_STEPS = [
    { // 1) 디자인 방법 — AI 생성 / 템플릿 / 파일 / 의뢰 (없는 분기는 자동 제외)
      msg: { kr: '주문을 도와드릴게요! 먼저 <b>디자인 방법</b>을 골라주세요.',
        ja: 'ご注文をお手伝いします!まず <b>デザイン方法</b> をお選びください。',
        en: "I'll help you order! First, choose <b>how to design</b>." },
      branch: [
        { key: 'ai', mode: 'free', template: 'ai', target: '#meAiGenBtn',
          label: { kr: 'AI 이미지로 생성', ja: 'AIで画像生成', en: 'Generate with AI' },
          sub: { kr: '설명만 쓰면 AI가 그려줘요', ja: '説明するだけでAIが描く', en: 'Describe it, AI draws it' },
          msg: { kr: '반짝이는 <b>AI 이미지</b> 버튼을 눌러 이미지를 만들고, <b>글씨·요소·이미지</b>도 더해 디자인을 마무리하세요. 다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b>를 눌러요! (AI 이미지는 큰 출력물에선 약간 뭉개질 수 있어요 — 선명한 대형은 템플릿 추천)',
            ja: '光る <b>AI画像</b> ボタンを押して画像を作り、<b>文字·要素·画像</b> も加えてデザインを仕上げてください。完成したら下の <b>「デザイン完了 → 次へ」</b> を!(AI画像は大判では少しにじむことがあります — 鮮明な大判はテンプレート推奨)',
            en: 'Tap the glowing <b>AI image</b> button to create an image, then add <b>text/elements/images</b> to finish your design. When done, tap <b>"Done → Continue"</b> below! (AI images can look slightly blurry at large sizes — use a template for crisp large output)' }
        },
        { key: 'editor', mode: 'free', template: 'rail', target: ['#soQdRailThumbs', '.qd-rail', '#soQuickDesignSec'],
          label: { kr: '템플릿으로 디자인', ja: 'テンプレートでデザイン', en: 'Design with a template' },
          sub: { kr: '벡터라 크게 뽑아도 선명해요', ja: 'ベクターで大判でも鮮明', en: 'Vector — crisp even large' },
          msg: { kr: '🎨 아래 <b>템플릿</b>들 중 마음에 드는 걸 고르고 <b>글씨·사진만 바꾸면</b> 끝!<br><b>템플릿은 벡터라 가벽·현수막처럼 크게 인쇄해도 깨끗하게</b> 나와요. 다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b> 버튼을 눌러주세요!',
            ja: '🎨 下の <b>テンプレート</b> からお好きなものを選んで <b>文字·写真を変えるだけ</b>!<br><b>テンプレートはベクターなので、間仕切りや横断幕のように大きく印刷しても鮮明</b>です。完成したら下の <b>「デザイン完了 → 次へ」</b> を押してください!',
            en: '🎨 Pick a <b>template</b> from below and <b>just change text & photos</b>!<br><b>Templates are vector, so they print cleanly even at large sizes</b> (walls, banners). When done, tap <b>"Done → Continue"</b> below!' }
        },
        { key: 'upload', always: true,
          // 업로드 후엔 원래 업로드 버튼이 숨고 '파일 변경' 버튼이 나옴 → 그것도 가리켜 재업로드 가능하게.
          target: ['#soUniversalUpload', '#soBannerUploadBtn', '#soAdInlineUploadBtn', '#soAdInlineChangeBtn'],
          label: { kr: '파일 업로드', ja: 'ファイルアップロード', en: 'Upload file' },
          sub: function () {
            // 등신대·자유인쇄커팅(칼선 버튼 보임) — 이미지=누끼·칼선 대행 / PDF=칼선 완료본
            return _secVisible('#meCutlineBtn')
              ? { kr: '이미지(JPG·PNG)면 배경제거·칼선을 우리가 따드려요. 칼선 완성 PDF면 그대로 올려요', ja: '画像(JPG·PNG)なら背景除去·カットライン代行。カットライン済PDFはそのまま', en: 'Image (JPG/PNG): we do bg-removal & cutline. Cutline-ready PDF: upload as-is' }
              : { kr: '완성된 인쇄용 파일이 있어요', ja: '完成した印刷用ファイルがある', en: 'I have a print-ready file' };
          },
          msg: { kr: '완성된 <b>인쇄용 파일</b>(PDF·PNG·JPG)이 있다면 <b>파일 업로드</b> 버튼으로 올려주세요. 올리면 다음으로 넘어가요.<br><span style="color:#94a3b8;">이미 올린 파일을 바꾸려면 반짝이는 <b>파일 변경</b> 버튼을 눌러 다시 올려주세요.</span>',
            ja: '完成した <b>印刷用ファイル</b>(PDF·PNG·JPG)があれば <b>ファイルアップロード</b> ボタンから。アップすると次へ進みます。<br><span style="color:#94a3b8;">既にアップ済のファイルを変えるには光る <b>ファイル変更</b> ボタンから。</span>',
            en: 'If you have a <b>print-ready file</b> (PDF·PNG·JPG), use the <b>Upload file</b> button. It advances once uploaded.<br><span style="color:#94a3b8;">To replace an already-uploaded file, tap the glowing <b>Change file</b> button.</span>' },
          // 2026-07-10: 파일 업로드 감지 시 자동으로 다음 단계로 (하드코딩된 "다음" 클릭 불필요 — 막힘 방지)
          hook: function (advance) {
            var f = document.getElementById('soFile');
            var m = document.getElementById('meImgInput');
            var done = false;
            var on = function () { if (done) return; done = true; advance({ kr: '업로드 완료! 🎉', ja: 'アップロード完了! 🎉', en: 'Uploaded! 🎉' }); };
            if (f) f.addEventListener('change', on);
            if (m) m.addEventListener('change', on);
            return function () { if (f) f.removeEventListener('change', on); if (m) m.removeEventListener('change', on); };
          }
        },
        { key: 'request', mode: 'request', target: '#soDesignReqBanner',
          label: { kr: '디자인 의뢰하기', ja: 'デザインを依頼', en: 'Request a design' },
          sub: { kr: '전문 디자이너에게 맡겨요', ja: 'プロのデザイナーに任せる', en: 'Leave it to a pro' },
          msg: { kr: '전문가에게 맡겨요! <b>디자인 의뢰</b>를 작성하고 등록하면, 이어서 다음 단계로 안내해 드릴게요 ✏️',
            ja: 'プロにお任せ! <b>デザイン依頼</b> を作成·登録すると、続けて次のステップをご案内します ✏️',
            en: 'Leave it to a pro! Fill out and submit the <b>design request</b>, and I\'ll continue to the next step ✏️' }
        }
      ]
    },
    { // 2) 수량 — 수량 섹션이 있는 제품만 (면적/사이즈 제품은 숨김 → 자동 스킵)
      target: '#soQtySection', mode: 'wait',
      hint: { kr: '수량을 골라주세요', ja: '数量をお選びください', en: 'Pick the quantity' },
      msg: { kr: '<b>수량</b>을 정해요! 많이 만들수록 낱장 단가가 내려가요 💰',
        ja: '<b>数量</b>を決めましょう!たくさん作るほど1枚あたりお得です 💰',
        en: 'Choose the <b>quantity</b>! The more you print, the lower the unit price 💰' },
      cheer: { kr: '좋아요! 👍', ja: 'いいですね! 👍', en: 'Nice! 👍' }
    },
    { // 3) 장바구니
      target: '#soBtnCart', mode: 'wait',
      hint: { kr: '장바구니를 눌러주세요', ja: 'カートを押してください', en: 'Tap the cart button' },
      msg: { kr: '자, 이제 <b>장바구니에 담아</b>볼까요? 🛒',
        ja: 'さあ、<b>カートに入れて</b>みましょう 🛒',
        en: "Now, let's <b>add it to the cart</b> 🛒" }
    }
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 허니콤 가벽 (hb_dw_*)  2026-07-10
  //  디자인 방법(공통) → 가벽 사이즈 → 단/양면 → 공간모양 → 추가옵션(설명) →
  //  시공/배송(설명) → 배송희망일(설명) → 장바구니. 각 단계 실제 섹션을 하이라이트.
  // ════════════════════════════════════════════════════════════════════
  var HONEYCOMB_WALL_STEPS = [
    GENERIC_STEPS[0], // 1) 디자인 방법 (AI 이미지 / 템플릿 / 파일 / 의뢰) — 공통 재사용
    { // 2) 가벽 사이즈
      target: '#soWallSizeSection', mode: 'next',
      msg: { kr: '📐 이제 <b>가벽 사이즈</b>를 골라요. 설치할 공간에 맞춰 <b>가로(m)</b>와 <b>세로(m)</b>를 선택하면 가격이 자동으로 계산돼요.',
        ja: '📐 次は <b>壁面サイズ</b>。設置スペースに合わせて <b>横(m)</b> と <b>縦(m)</b> を選ぶと価格が自動計算されます。',
        en: '📐 Now pick the <b>wall size</b>. Choose <b>width (m)</b> and <b>height (m)</b> to fit your space — the price updates automatically.' }
    },
    { // 3) 단면 / 양면
      target: ['#soWallSideRow', '#soWallSizeSection'], mode: 'next',
      msg: { kr: '<b>단면</b>은 앞면만, <b>양면</b>은 앞·뒤 모두 인쇄해요. 뒤쪽도 사람들에게 보이는 자리라면 <b>양면</b>을 추천해요.',
        ja: '<b>片面</b>は表のみ、<b>両面</b>は表裏とも印刷。裏側も見える場所なら <b>両面</b> がおすすめ。',
        en: '<b>Single</b> prints the front only; <b>double</b> prints both sides. If the back is also visible, we recommend <b>double</b>.' }
    },
    { // 4) 공간 모양 (일자/꺾임)
      target: '#soWallShapeSection', mode: 'next',
      msg: { kr: '위에서 봤을 때 <b>가벽 모양</b>을 골라요. <b>一자</b>(일자) · <b>ㄱ자</b>(한 번 꺾임) · <b>ㄷ자</b>(양쪽 꺾임) 중 공간에 맞는 걸 선택하세요.',
        ja: '上から見た <b>壁の形</b> を選びます。<b>一字</b>(まっすぐ) · <b>L字</b>(1回曲げ) · <b>コ字</b>(両側曲げ) から空間に合うものを。',
        en: 'Pick the <b>floor-plan shape</b> (seen from above): <b>Straight</b> · <b>L-shape</b> (one bend) · <b>U-shape</b> (both sides) — choose what fits your space.' }
    },
    { // 5) 추가 옵션 (설명 포함)
      target: '#soAddonSection', mode: 'next',
      msg: { kr: '필요한 <b>추가 옵션</b>만 체크하세요.<br>• 야외나 아이들이 많은 곳이라면 <b>보조받침대</b>를 선택해 주세요.<br>• 특별한 연출을 원한다면 <b>비싸지 않은 비용으로 조명</b>을 설치할 수 있어요. 조명은 <b>콘센트형</b>이라 끼우면 설치 끝!',
        ja: '必要な <b>追加オプション</b> だけチェックしてください。<br>• 屋外や子供が多い場所なら <b>補助スタンド</b> を選んでください。<br>• 特別な演出をご希望なら <b>手頃な価格で照明</b> を設置できます。照明は <b>コンセント式</b> なので差し込むだけで設置完了!',
        en: 'Check only the <b>add-ons</b> you need.<br>• For outdoor spots or places crowded with kids, pick the <b>support base</b>.<br>• Want a special touch? Add <b>affordable lighting</b> — it\'s <b>plug-in type</b>, just plug it in and it\'s done!' }
    },
    { // 6) 시공/배송 (설명)
      target: '#soScheduleSection', mode: 'next',
      msg: { kr: '<b>시공/배송</b>을 골라요. <b>수도권(서울·경기)</b>은 <b>무료 배송·무료 설치</b>! <b>지방</b>은 용차배송 또는 설치배송 중에 고르면 되고, 설치까지 원하면 <b>설치배송</b>을 선택하세요.',
        ja: '<b>施工/配送</b> を選びます。<b>首都圏</b>は <b>送料・設置 無料</b>!<b>地方</b>はトラック配送か設置配送から選び、設置も希望なら <b>設置配送</b> を。',
        en: 'Choose <b>install/delivery</b>. <b>Metro area</b> = <b>free delivery & install</b>! For <b>regional</b>, pick truck delivery or install delivery — choose <b>install delivery</b> if you want it set up.' }
    },
    { // 7) 배송 희망일 (설명)
      target: ['#soScheduleDateWrap', '#soScheduleSection'], mode: 'next',
      msg: { kr: '마지막으로 <b>배송 희망일</b>을 정해요 (영업일 기준 <b>최소 3일 이후</b>). <b>100만원 이상</b> 주문은 <b>시간까지</b> 지정할 수 있고, 그 이하는 <b>날짜만</b> 선택돼요.',
        ja: '最後に <b>配送希望日</b> を決めます(営業日基準で <b>最短3日後</b>)。<b>100万ウォン以上</b> の注文は <b>時間指定</b> も可能、それ以下は <b>日付のみ</b>。',
        en: 'Finally, set your <b>preferred delivery date</b> (from <b>3 business days</b>). Orders <b>over ₩1,000,000</b> can also pick a <b>time</b>; below that, <b>date only</b>.' }
    },
    GENERIC_STEPS[2] // 8) 장바구니 — 공통 재사용
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 허니콤 배너 (hb_bn_*)  2026-07-10
  //  디자인(공통) → 배너 종류 선택 → 단면/양면(허니콤배너·연결형만, 나머지는 자동 스킵)
  //  → 수량(있으면) → 장바구니. 제품별로 없는 옵션 단계는 onEnter 로 자동 스킵.
  // ════════════════════════════════════════════════════════════════════
  var HONEYCOMB_BANNER_STEPS = [
    GENERIC_STEPS[0], // 1) 디자인 방법 (AI / 템플릿 / 파일 / 의뢰)
    { // 2) 배너 종류 선택
      target: '#soBannerVariantsHostSec', mode: 'next',
      onEnter: function () { return _secVisible('#soBannerVariantsHostSec'); },
      msg: { kr: '이제 <b>배너 종류</b>를 골라요. <b>허니콤배너·연결형·선반형·거치대 세트</b> 등 카드를 눌러 원하는 종류로 바꿀 수 있어요.',
        ja: '次は <b>バナーの種類</b>。<b>ハニカムバナー·連結型·棚型·スタンドセット</b> などカードを押して選べます。',
        en: 'Now pick the <b>banner type</b>. Tap a card to switch between <b>honeycomb / linked / shelf / stand set</b>, etc.' }
    },
    { // 3) 단면/양면 — 허니콤배너·연결형만 (섹션 안 보이면 자동 스킵)
      target: '#soBannerSideSec', mode: 'next',
      onEnter: function () { return _secVisible('#soBannerSideSec'); },
      msg: { kr: '<b>인쇄면</b>을 골라요. <b>단면</b>은 앞면만, <b>양면</b>은 앞·뒤 모두 인쇄해요. (허니콤배너·연결형 배너에서만 선택할 수 있어요)',
        ja: '<b>印刷面</b>を選びます。<b>片面</b>は表のみ、<b>両面</b>は表裏とも。(ハニカムバナー·連結型のみ選択可)',
        en: 'Choose the <b>print side</b>. <b>Single</b> = front only, <b>double</b> = both sides. (Only for honeycomb / linked banners)' }
    },
    { // 4) 수량 — 있으면 (없으면 자동 스킵)
      target: '#soQtySection', mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요. 여러 장이면 한 파일에 담아 올리고 수량을 입력하면 돼요.',
        ja: '<b>数量</b>を決めます。複数枚は1ファイルにまとめて数量を入力してください。',
        en: 'Set the <b>quantity</b>. For multiple banners, put them in one file and enter the count.' }
    },
    GENERIC_STEPS[2] // 5) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 등신대 POP / 자유인쇄커팅 (hb_pt_*)  2026-07-10
  //  순서: 단면/양면 → 보드 종류 → 디자인(보통 파일 업로드) → 누끼+칼선(핵심) →
  //  사이즈 → 받침대 → 배송 → 장바구니. 없는 옵션 단계는 onEnter 로 자동 스킵.
  // ════════════════════════════════════════════════════════════════════
  var STANDEE_STEPS = [
    { // 1) 인쇄면 (단면/양면)
      target: '#soCutPrintSizeSection', mode: 'next',
      onEnter: function () { return _secVisible('#soCutPrintSizeSection'); },
      msg: { kr: '먼저 <b>인쇄면</b>을 골라요. <b>단면</b>은 앞면만, <b>양면</b>은 앞·뒤 모두 인쇄해요 (양면은 ×2).',
        ja: 'まず <b>印刷面</b>を選びます。<b>片面</b>は表のみ、<b>両面</b>は表裏とも (両面は×2)。',
        en: 'First choose the <b>print side</b>. <b>Single</b> = front only, <b>double</b> = both sides (double is ×2).' }
    },
    { // 2) 보드 종류 선택
      target: '#soCutBoardMaterialSection', mode: 'next',
      onEnter: function () { return _secVisible('#soCutBoardMaterialSection'); },
      msg: { kr: '<b>보드 종류</b>를 골라요. 허니콤보드·포맥스·폼보드 등 — 가격은 동일하니 원하는 재질로 선택하세요.',
        ja: '<b>ボードの種類</b>を選びます。ハニカム·フォーメックス·フォームボード等 — 価格は同じなのでお好みで。',
        en: 'Pick the <b>board type</b> — honeycomb, foamex, foamboard, etc. Same price, so choose the material you like.' }
    },
    GENERIC_STEPS[0], // 3) 디자인 방법 (보통 파일 업로드 — AI/템플릿/의뢰도 가능)
    { // 4) 누끼 (배경 제거) — 선택 사항. 원하면 누끼(완료까지 대기), 그대로 네모면 '다음'.
      target: '#meBgRemoveBtn', mode: 'wait', waitEvent: 'me-cutout-done',
      onEnter: function () { return _secVisible('#meBgRemoveBtn'); },
      hint: { kr: '이미지면 선택 후 누끼 / PDF·네모면 아래 다음', ja: '画像は選択して切り抜き / PDF·四角は下の次へ', en: 'Image: select + Cut-out / PDF·rectangle: Next' },
      msg: { kr: '업로드 잘 하셨어요! 🎉<br>• <b>배경 있는 이미지(JPG·PNG)</b> — <b>이미지를 클릭해 선택</b>하고 반짝이는 <b>누끼</b> 버튼을 눌러주세요. <b>배경 제거에 몇 초 걸려요</b> — 완료되면 자동으로 다음으로 넘어가요.<br>• <b>칼선까지 완성된 PDF</b> 또는 <b>네모 그대로</b> 쓰실 거면 아래 <b>다음</b>을 눌러주세요.<br><span style="color:#94a3b8;">※ PDF는 자동 배경제거·칼선이 안 돼요. PDF로 만들 땐 칼선을 <b>별도 레이어</b>로, 선은 <b>부드럽게</b>, <b>받침 부분은 평평하게</b> 준비해 주세요.</span>',
        ja: 'アップロードOK! 🎉<br>• <b>背景ありの画像(JPG·PNG)</b> — <b>画像を選択</b>して光る <b>切り抜き</b> ボタンを押してください。<b>背景除去に数秒かかります</b> — 完了すると自動で次へ進みます。<br>• <b>カットライン済PDF</b> や <b>四角のまま</b> なら下の <b>次へ</b>。<br><span style="color:#94a3b8;">※ PDFは自動の背景除去·カットライン不可。PDFで作る際はカットラインを <b>別レイヤー</b> で、線は <b>滑らかに</b>、<b>差し込み部分は平らに</b> ご準備ください。</span>',
        en: 'Nicely uploaded! 🎉<br>• <b>Image with background (JPG/PNG)</b> — <b>click to select</b> and tap the glowing <b>Cut-out</b> button. <b>Background removal takes a few seconds</b> — it advances automatically when done.<br>• <b>Cutline-ready PDF</b> or keeping it <b>rectangular</b> — tap <b>Next</b> below.<br><span style="color:#94a3b8;">※ PDFs can\'t be auto bg-removed/cut. For PDFs, make the cutline on a <b>separate layer</b>, keep lines <b>smooth</b>, and the <b>base tab flat</b>.</span>' },
      skipLabel: { kr: 'PDF·네모 그대로 다음 ▶', ja: 'PDF·四角のまま次へ ▶', en: 'PDF/rectangle · Next ▶' },
      cheer: { kr: '배경 제거 완료! 👍', ja: '背景除去完了! 👍', en: 'Background removed! 👍' }
    },
    { // 5) 칼선 만들기 — 칼선 버튼 → 모양 선택 모달이 닫혀야(작업 완료) 다음(사이즈)으로.
      target: '#meCutlineBtn', mode: 'wait', waitClose: '#meCutlinePopup',
      onEnter: function () { return _secVisible('#meCutlineBtn'); },
      hint: { kr: '칼선 버튼을 눌러 모양을 골라주세요', ja: 'カットラインボタンで形を選択', en: 'Tap Cutline and pick a shape' },
      skipLabel: { kr: '칼선 완료 PDF·칼선 없이 다음 ▶', ja: 'カットライン済PDF·なしで次へ ▶', en: 'Cutline-ready PDF · skip · Next ▶' },
      msg: { kr: '배경을 지운 <b>이미지</b>라면 이제 <b>칼선</b>을 눌러 <b>재단선 모양</b>을 골라요 (동그라미·알약·라운드 사각·한 모서리 등). 이 선을 따라 잘려 나와요 ✂️<br>모양을 고르면 다음 단계로 넘어가요.<br><span style="color:#94a3b8;">※ <b>칼선이 이미 있는 PDF</b>를 올리셨다면 아래 <b>다음</b>을 눌러 넘어가세요.</span>',
        ja: '背景を消した <b>画像</b> なら <b>カットライン</b> を押して <b>裁断線の形</b> を選びます(丸·カプセル·角丸など)。この線で切り抜かれます ✂️<br>形を選ぶと次へ。<br><span style="color:#94a3b8;">※ <b>カットライン済のPDF</b> をアップした場合は下の <b>次へ</b> を。</span>',
        en: 'For a <b>background-removed image</b>, tap <b>Cutline</b> and pick a <b>die-cut shape</b> (circle, pill, rounded square, one corner…). It cuts along this line ✂️<br>Pick a shape to continue.<br><span style="color:#94a3b8;">※ If you uploaded a <b>PDF that already has a cutline</b>, tap <b>Next</b> below.</span>' },
      cheer: { kr: '칼선 완성! ✂️', ja: 'カットライン完成! ✂️', en: 'Cutline done! ✂️' }
    },
    { // 5) 외곽선 두께 · 받침(꽂이) 위치 조절 — 이미지 옆 떠있는 창의 슬라이더
      target: ['[data-cutline-margin]', '#meCutlineFloat', '#meProps'], mode: 'next',
      hint: { kr: '이미지를 선택하면 옆에 조절창이 나와요', ja: '画像を選択すると横に調整パネルが出ます', en: 'Select the image to see the panel beside it' },
      msg: { kr: '이제 <b>외곽선 두께</b>와 <b>받침(꽂이) 위치</b>를 다듬어요. 이미지를 선택하면 <b>옆에 조절창</b>이 나와요.<br>• <b>외곽선 두께</b> — 재단선을 이미지에서 얼마나 띄울지 조절해요.<br>• <b>받침 위치</b> — 등신대 아래 <b>꽂이(받침)</b>를 위·아래로 늘려 스탠드에 안정적으로 꽂히게 해요.',
        ja: '<b>フチの太さ</b>と<b>差し込み(スタンド)位置</b>を調整します。画像を選択すると <b>横に調整パネル</b> が表示されます。<br>• <b>フチの太さ</b> — 裁断線を画像からどれだけ離すか。<br>• <b>差し込み位置</b> — 等身大の下の <b>差し込み</b> を上下に伸ばして安定して差し込めるように。',
        en: 'Fine-tune the <b>outline thickness</b> and <b>base tab position</b>. Select the image to reveal the <b>panel beside it</b>.<br>• <b>Outline thickness</b> — how far the die-cut line sits from the image.<br>• <b>Base position</b> — stretch the bottom <b>insert tab</b> up/down so it sits firmly in the stand.' }
    },
    { // 6) 크기 입력 — 등신대(조각)의 실제 크기(mm). 비율 고정 + 가격 자동.
      target: ['#meObjSizeW', '#meCutlineFloat', '#soCustomSizeSection'], mode: 'next',
      hint: { kr: '옆 조절창의 크기(mm) 칸에 입력', ja: '横パネルのサイズ(mm)欄に入力', en: 'Type in the Size (mm) fields in the panel' },
      msg: { kr: '잘하셨습니다! 🎉 이제 <b>등신대의 크기</b>를 정하면 <b>가격이 자동으로</b> 만들어집니다.<br>옆 조절창의 <b>크기(mm)</b> 칸에 <b>가로·세로</b>를 입력하세요 — <b>비율이 고정</b>돼 한쪽만 바꿔도 반대쪽이 같이 맞춰져요. (모서리를 드래그해 키워도 돼요.)',
        ja: 'お見事です! 🎉 あとは <b>等身大のサイズ</b> を決めると <b>価格が自動</b> で計算されます。<br>横パネルの <b>サイズ(mm)</b> 欄に <b>横·縦</b> を入力してください — <b>比率が固定</b> され、片方を変えるともう片方も合わせて変わります。(角をドラッグして拡大してもOK。)',
        en: 'Well done! 🎉 Now just set the <b>standee size</b> and the <b>price is calculated automatically</b>.<br>Type <b>width/height</b> in the <b>Size (mm)</b> fields in the side panel — the <b>ratio is locked</b>, so changing one adjusts the other. (You can also drag a corner to resize.)' },
      cheer: { kr: '크기·가격 완성! 💰', ja: 'サイズ·価格OK! 💰', en: 'Size & price set! 💰' }
    },
    { // 7) 받침대 선택
      target: '#soBaseStandSection', mode: 'next',
      onEnter: function () { return _secVisible('#soBaseStandSection'); },
      msg: { kr: '<b>받침대</b>를 골라요. 크기에 맞는 받침대를 선택해야 등신대가 안정적으로 서 있어요 (여러 종류·수량 선택 가능).',
        ja: '<b>スタンド</b>を選びます。サイズに合うスタンドを選ぶと安定して自立します (複数種類·数量可)。',
        en: 'Choose a <b>stand</b>. Pick one that fits the size so the standee stays upright (multiple types & quantities possible).' }
    },
    { // 7) 배송 옵션
      target: '#soScheduleSection', mode: 'next',
      onEnter: function () { return _secVisible('#soScheduleSection'); },
      msg: { kr: '<b>배송 방법</b>을 골라요. 등신대는 택배 배송이 가능하고, 지역·크기에 따라 옵션이 달라져요.',
        ja: '<b>配送方法</b>を選びます。等身大は宅配可能で、地域·サイズにより選択肢が変わります。',
        en: 'Choose the <b>delivery method</b>. Standees can ship by parcel; options vary by region and size.' }
    },
    GENERIC_STEPS[2] // 8) 장바구니
  ];

  var SCENARIOS = [
    { id: 'bizcard', match: /^pp_bc/i, steps: BIZCARD_STEPS },
    { id: 'honeycomb-wall', match: /^hb_dw/i, steps: HONEYCOMB_WALL_STEPS },
    { id: 'honeycomb-banner', match: /^hb_bn/i, steps: HONEYCOMB_BANNER_STEPS },
    { id: 'standee', match: /^hb_pt/i, steps: STANDEE_STEPS },
    // catch-all — 위 전용 시나리오에 안 걸리는 모든 제품. 반드시 마지막.
    { id: 'generic', match: /.*/, steps: GENERIC_STEPS }
  ];
  function pickScenario(code) {
    if (!code) return null;
    for (var i = 0; i < SCENARIOS.length; i++) {
      try { if (SCENARIOS[i].match.test(code)) return SCENARIOS[i]; } catch (_) {}
    }
    return null;
  }

  var _lastScn = null;
  window._tutMaybeStart = function (product) {
    try {
      // 2026-06-25: 디자이너/관리자 템플릿 제작 모드에서는 튜토리얼 끔 (작업 방해)
      try {
        var _q = location.search || '';
        if (/[?&](designer_template_mode|admin_template_mode)=/.test(_q)) { removeReplay(); if (_active) quit(); return; }
      } catch (_qe) {}
      var code = (product && product.code) || '';
      var scn = pickScenario(code);
      if (!scn) { removeReplay(); if (_active) quit(); _lastScn = null; return; }
      _lastScn = scn;
      _lang = detectLang();
      ensureStyles();
      mountReplay(scn);
      showChooser(scn);
    } catch (e) { console.warn('[tut] _tutMaybeStart', e); }
  };

  // 2026-07-10: "튜토리얼 보기" 버튼 등에서 수동으로 다시 열기 (현재 제품 시나리오 기준).
  window._tutOpenChooser = function () {
    try {
      if (!_lastScn) return;
      _lang = detectLang();
      ensureStyles();
      mountReplay(_lastScn);
      showChooser(_lastScn);
    } catch (e) { console.warn('[tut] _tutOpenChooser', e); }
  };
})();
