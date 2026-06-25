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
      + 'transition:left .26s ease,top .26s ease,width .26s ease,height .26s ease;}'
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
      + '#tut-donebar .db-go{background:#6d28d9;color:#fff;border:none;border-radius:999px;padding:11px 18px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;}'
      + '#tut-donebar .db-go:hover{background:#5b21b6;}'
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
      var popH = _pop.offsetHeight || 190, popW = _pop.offsetWidth || 300;
      var vw = window.innerWidth, vh = window.innerHeight, top;
      if (vh - rect.bottom > popH + 22) top = rect.bottom + 16;
      else if (rect.top > popH + 22) top = rect.top - popH - 16;
      else top = Math.max(12, vh - popH - 12);
      var left = rect.left + rect.width / 2 - popW / 2;
      left = Math.max(12, Math.min(left, vw - popW - 12));
      _pop.style.left = left + 'px'; _pop.style.top = top + 'px';
    } else {
      _hole.style.display = 'none';
      _pop.classList.add('center');
    }
  }
  function loop() {
    if (_looping) return;
    _looping = true;
    (function frame() {
      if (!_active) { _looping = false; return; }
      if (!modalOpen()) { quit(); _looping = false; return; }
      place();
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

  // ── 공통 렌더 헬퍼 ──────────────────────────────────────────────────────
  function clearStep() {
    _stepCleanup.forEach(function (fn) { try { fn(); } catch (_) {} });
    _stepCleanup = [];
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

  // ── 일반 단계 ──────────────────────────────────────────────────────────
  function renderStep(i) {
    clearStep(); removeDoneBar(); _freeMode = false;
    var step = _steps[i];
    _targets = resolveTargets(step.target);
    if (step.mode === 'wait' && !_targets.length) { enterStep(i + 1); return; }
    if (_targets[0]) scrollToEl(_targets[0]);
    _blocker.style.display = _targets.length ? 'none' : 'block';

    var foot;
    if (step.mode === 'wait') {
      foot = '<div class="tut-hint">👆 ' + T({ kr: '반짝이는 곳을 눌러주세요', ja: '光っている所をタップ', en: 'Tap the highlighted spot' }) + '</div>'
        + '<div class="tut-foot">' + backLink()
        + '<button class="tut-link" data-act="next">' + T({ kr: '건너뛰기', ja: 'スキップ', en: 'Skip' }) + '</button></div>';
    } else {
      foot = '<div class="tut-actions">'
        + (_hist.length ? '<button class="tut-btn tut-btn-ghost" data-act="back">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>' : '')
        + '<button class="tut-btn tut-btn-go" data-act="next">' + T({ kr: '다음 ▶', ja: '次へ ▶', en: 'Next ▶' }) + '</button></div>';
    }
    _pop.innerHTML = '<button class="tut-x" data-act="quit">✕</button>' + headHtml(i)
      + '<div class="tut-msg">' + T(step.msg) + '</div>' + foot;
    _pop.style.display = 'block';
    bindCommon(function () { enterStep(i + 1); });

    if (step.mode === 'wait') {
      var onClick = function () { celebrate(step.cheer); enterStep(i + 1); };
      _targets.forEach(function (t) {
        t.addEventListener('click', onClick, { once: true });
        _stepCleanup.push(function () { t.removeEventListener('click', onClick); });
      });
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
    // 템플릿 픽커 띄우기
    setTimeout(function () {
      try {
        if (typeof window._meOpenTemplatePicker === 'function') window._meOpenTemplatePicker();
        else { var tb = document.getElementById('meTemplateBtn'); if (tb) tb.click(); }
      } catch (_) {}
    }, 350);
    toast(opt.msg);
    mountDoneBar(
      function () { _freeMode = false; removeDoneBar(); celebrate({ kr: '디자인 완성! 🎉', ja: 'デザイン完成! 🎉', en: 'Design done! 🎉' }); enterStep(i + 1); },
      function () { _freeMode = false; removeDoneBar(); renderBranch(i); }
    );
    loop();
  }

  function mountDoneBar(onGo, onBack) {
    removeDoneBar();
    var bar = document.createElement('div');
    bar.id = 'tut-donebar';
    bar.innerHTML = '<button class="db-back">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>'
      + '<button class="db-go">✏️ ' + T({ kr: '디자인 끝나고 다음 진행하기', ja: 'デザイン完了 → 次へ進む', en: 'Done designing → Continue' }) + '</button>';
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
    { // 1) 인쇄면
      target: ['#soBizSideSingle', '#soBizSideDouble'], mode: 'wait',
      msg: { kr: '먼저 <b>단면</b>으로 할지 <b>양면</b>으로 할지 골라주세요!',
        ja: 'まず <b>片面</b> か <b>両面</b> かを選んでください!',
        en: 'First, choose <b>single</b> or <b>double</b> sided!' },
      cheer: { kr: '좋아요! 👍', ja: 'いいね! 👍', en: 'Nice! 👍' }
    },
    { // 2) 디자인 방법 — 3갈래
      msg: { kr: '디자인은 <b>3가지 방법</b>이 있어요. 마음에 드는 걸 골라보세요!',
        ja: 'デザイン方法は <b>3つ</b>。お好きなものを選んでください!',
        en: 'There are <b>3 ways</b> to design. Pick the one you like!' },
      branch: [
        { key: 'upload', always: true, target: '#soBizUploadBtn',
          label: { kr: '📎 파일 올리기', ja: '📎 ファイルをアップロード', en: '📎 Upload a file' },
          sub: { kr: '완성된 파일이 있어요', ja: '完成ファイルがある', en: 'I have a finished file' },
          msg: { kr: '완성 파일이 있군요! <b>파일 올리기</b> 버튼을 눌러 올려주세요.<br>작업은 <b>92 × 52mm</b>, 재단은 <b>90 × 50mm</b> 로 작업하면 돼요 📎',
            ja: '完成ファイルがあるんですね! <b>ファイルアップロード</b> を押してください。<br>作業サイズ <b>92 × 52mm</b>、仕上がり <b>90 × 50mm</b> です 📎',
            en: 'You have a finished file! Tap <b>Upload file</b>.<br>Work size <b>92 × 52mm</b>, trim <b>90 × 50mm</b> 📎' },
          hook: function (advance) {
            var f = document.getElementById('soFile');
            if (!f) return null;
            var on = function () { advance({ kr: '와우! 잘했어요 🎉', ja: 'ワオ!上手にできました 🎉', en: 'Wow! Nicely done 🎉' }); };
            f.addEventListener('change', on, { once: true });
            return function () { f.removeEventListener('change', on); };
          }
        },
        { key: 'editor', mode: 'free', target: ['.qd-head-row', '#soQuickDesignSec'],
          label: { kr: '🎨 에디터로 직접 디자인', ja: '🎨 エディタで自分でデザイン', en: '🎨 Design it yourself' },
          sub: { kr: '템플릿에 글씨만 바꾸면 끝', ja: 'テンプレの文字を変えるだけ', en: 'Just edit text on a template' },
          msg: { kr: '🎨 템플릿을 띄웠어요! 마음에 드는 걸 고르고 <b>글씨만 바꾸면</b> 끝. 사진·요소도 자유롭게 넣으세요.<br>다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b> 버튼을 눌러주세요!',
            ja: '🎨 テンプレートを表示しました! お好きなものを選んで <b>文字を変えるだけ</b>。写真·要素も自由に。<br>完成したら下の <b>「デザイン完了 → 次へ進む」</b> を押してください!',
            en: '🎨 Templates are open! Pick one and <b>just change the text</b>. Add photos & elements freely.<br>When done, tap <b>"Done designing → Continue"</b> below!' }
        },
        { key: 'request', target: '#soDesignReqBanner',
          label: { kr: '✏️ 디자인 의뢰하기', ja: '✏️ デザインを依頼', en: '✏️ Request a design' },
          sub: { kr: '전문 디자이너에게 맡겨요', ja: 'プロのデザイナーに任せる', en: 'Leave it to a pro' },
          msg: { kr: '디자인이 어렵다면 전문가에게 맡기세요! 아래 <b>디자인 의뢰</b> 배너를 누르면 디자이너가 멋지게 만들어 드려요. 영업일 <b>2~3일</b>이면 완성! ✏️',
            ja: 'デザインが難しければプロに! 下の <b>デザイン依頼</b> バナーを押すとデザイナーが仕上げます。<b>営業日2~3日</b>で完成! ✏️',
            en: 'If designing is hard, leave it to a pro! Tap the <b>Request a design</b> banner below and a designer will craft it. Ready in <b>2–3 business days</b>! ✏️' }
        }
      ]
    },
    { // 3) 용지
      target: '#soBizPaperGrid', mode: 'wait',
      msg: { kr: '잘했어요! 🎉 다음은 <b>용지</b>예요.<br>제일 무난한 건 <b>누브지</b>나 <b>랑데뷰 네추럴</b>. 펄 느낌 <b>컨셉</b>이나 <b>팝셋</b>도 멋져요 ✨',
        ja: '上手! 🎉 次は <b>用紙</b>。<br>無難なのは <b>ヌーブ紙</b> や <b>ランデブーナチュラル</b>。パール感の <b>コンセプト</b> や <b>ポップセット</b> も素敵 ✨',
        en: 'Great! 🎉 Next, the <b>paper</b>.<br>Safest picks: <b>Nuvegi</b> or <b>Rendezvous Natural</b>. Pearly <b>Concept</b> or <b>Popset</b> are lovely too ✨' },
      cheer: { kr: '탁월한 선택! 😍', ja: '素晴らしい選択! 😍', en: 'Excellent choice! 😍' }
    },
    { // 4) 박 / 후가공 — 에디터 모드면 "로고 부분 처리" 안내
      target: ['#soBizFoilToggle', '#soBizFinishToggle'], mode: 'next',
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
      msg: { kr: '<b>수량</b> 안내! 기본 100매(1각) <b>이상부터 50% 할인</b> 돼요.<br>많이 필요할지 모르면 미리 넉넉히 만들어 두세요. 금박 같은 후가공도 똑같이 할인되니 지금 추가해도 이득! 💰',
        ja: '<b>数量</b> のご案内!基本100枚(1ロット) <b>以上で50%割引</b>。<br>多めに必要かもなら今のうちに。箔押しなど後加工も同じく割引なので今追加がお得! 💰',
        en: '<b>Quantity</b> tip! From 100 pcs (1 set) up, <b>50% off</b>.<br>If you might need more, make extra now. Foil & finishing get the same discount — adding now pays off! 💰' }
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
      msg: { kr: '자, 이제 <b>장바구니에 담아</b>볼까요? 🛒',
        ja: 'さあ、<b>カートに入れて</b>みましょう 🛒',
        en: "Now, let's <b>add it to the cart</b> 🛒" }
    }
  ];

  var SCENARIOS = [{ id: 'bizcard', match: /^pp_bc/i, steps: BIZCARD_STEPS }];
  function pickScenario(code) {
    if (!code) return null;
    for (var i = 0; i < SCENARIOS.length; i++) {
      try { if (SCENARIOS[i].match.test(code)) return SCENARIOS[i]; } catch (_) {}
    }
    return null;
  }

  window._tutMaybeStart = function (product) {
    try {
      var code = (product && product.code) || '';
      var scn = pickScenario(code);
      if (!scn) { removeReplay(); if (_active) quit(); return; }
      _lang = detectLang();
      ensureStyles();
      mountReplay(scn);
      showChooser(scn);
    } catch (e) { console.warn('[tut] _tutMaybeStart', e); }
  };
})();
