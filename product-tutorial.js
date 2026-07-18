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
  var _curStepTargetSel = null;   // 2026-07-18: 현재 스텝 target 셀렉터 — 비동기 로드로 늦게 뜨는 타깃 재해석용
  var _aiModalHiding = false;     // 2026-07-18: AI 생성 모달이 열렸을 때 튜토리얼 팝업/하이라이트 숨김 상태
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
      + '.tut-choice .tut-x{position:absolute;top:12px;right:12px;width:28px;height:28px;border:none;background:#f3f4f6;color:#6b7280;border-radius:50%;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}'
      + '.tut-choice .tut-x:hover{background:#e5e7eb;color:#374151;}'
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
    // 2026-07-18: AI 생성 모달(#meAiGenModal)이 열려 있으면 튜토리얼 팝업/하이라이트를 숨김.
    //   모달이 반투명 배경이라 뒤에 튜토리얼 안내창이 비쳐 보이던 문제. 모달 닫히면 복구.
    var _aiM = document.getElementById('meAiGenModal');
    if (_aiM && _aiM.style.display === 'flex') {
      _pop.style.display = 'none'; _hole.style.display = 'none'; _blocker.style.display = 'none';
      _aiModalHiding = true;
      return;
    }
    if (_aiModalHiding) { _pop.style.display = ''; _aiModalHiding = false; }
    // 2026-07-18: 타깃이 비었는데 스텝에 target 셀렉터가 있으면 재해석 — 비동기 로드(예: 스카시 종류 카드)로
    //   renderStep 시점엔 아직 안 떠서 스포트라이트가 안 잡히던 문제. 매 프레임 재시도(뜨면 자동 하이라이트).
    if (!_targets.length && _curStepTargetSel) {
      var _re = resolveTargets(_curStepTargetSel);
      if (_re.length) {
        _targets = _re;
        try { _blocker.style.display = 'none'; } catch (_) {}
        try { scrollToEl(_targets[0]); } catch (_) {}
      }
    }
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
      _tutUpdateNextBlock();
      requestAnimationFrame(frame);
    })();
  }
  // 2026-07-14: 현재 스텝에 blockNext(조건함수)가 있으면, 조건이 참일 때 '다음' 버튼을 비활성화.
  //   예: 초저가 현수막 롤 폭 초과(가로·세로 둘 다 160cm 초과)면 사이즈를 고칠 때까지 다음 진행 차단.
  function _tutUpdateNextBlock() {
    try {
      if (!_pop) return;
      var nextBtn = _pop.querySelector('[data-act="next"].tut-btn-go');
      if (!nextBtn) return;
      var step = (_cur && _cur.kind === 'step' && _steps) ? _steps[_cur.i] : null;
      var blocked = !!(step && typeof step.blockNext === 'function' && step.blockNext());
      if (nextBtn._tutBlocked === blocked) return;   // 변화 없으면 skip
      nextBtn._tutBlocked = blocked;
      nextBtn.disabled = blocked;
      nextBtn.style.opacity = blocked ? '0.45' : '';
      nextBtn.style.cursor = blocked ? 'not-allowed' : '';
      nextBtn.style.pointerEvents = blocked ? 'none' : '';
    } catch (_) {}
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
    // 2026-07-14: 진행상태 저장 — 종류 선택으로 페이지가 리로드돼도 다음 챕터로 이어가기.
    try { sessionStorage.setItem('__tut_progress', JSON.stringify({ code: _curCode || '', i: i, resumeNext: !!s.resumeNext, ts: Date.now() })); } catch (_) {}
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
    _curStepTargetSel = step.target || null;   // 2026-07-18: 비동기 타깃 재해석용
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
        + ((_hist.length && !step.hideBack) ? '<button class="tut-btn tut-btn-ghost" data-act="back">' + T({ kr: '← 이전', ja: '← 戻る', en: '← Back' }) + '</button>' : '')
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
    // 2026-07-11: 버튼 아래 부가 설명 (step.note) — 예: PDF는 별도 레이어 칼선 안내
    var noteHtml = step.note ? '<div class="tut-note" style="margin-top:10px; font-size:11.5px; color:#94a3b8; line-height:1.55;">' + T(step.note) + '</div>' : '';
    _pop.innerHTML = '<button class="tut-x" data-act="quit">✕</button>' + headHtml(i)
      + '<div class="tut-msg">' + T(step.msg) + '</div>' + picksHtml + noteHtml + selHtml + foot;
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
        // 2026-07-14: 'jump' — 다른 스텝 흐름으로 전환 (예: 스티커 종류 선택 → 일반/팬시 각 튜토리얼).
        if (o.mode === 'jump' && typeof o.run === 'function') { try { o.run(); } catch (_) {} return; }
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
    } else if (opt.template === 'pd-input') {
      // 2026-07-19: 목업 뷰어(종이매대·테이블·박스) — '인공지능 무료디자인' 을 고르면
      //   무조건 내용 입력칸(브랜드/제품/컨셉)으로 데려가고, 거기만 강조한다.
      //   내용이 있어야 AI 가 만들 수 있으므로 버튼보다 입력칸이 먼저다.
      setTimeout(function () {
        try {
          var sec = document.getElementById('soPaperDisplayRequest');
          if (sec) {
            sec.style.display = '';
            sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          _tutBlink(['#soPaperDisplayRequest']);
          var brand = document.getElementById('soPdBrand');
          if (brand) setTimeout(function () { try { brand.focus(); } catch (_) {} }, 420);
        } catch (_) {}
      }, 120);
    } else if (opt.template === 'ai-intro') {
      // 2026-07-18: 목업 뷰어 제품군(종이매대·허니콤 테이블) — 간편 진입의 [AI디자인 실행] 버튼을 반짝이게.
      //   여긴 #meAiGenBtn(툴바 안쪽 버튼)이 아니라 인트로 큰 버튼을 눌러야 브랜드 문구로 자동 생성된다.
      _tutBlink(['.me-intro-ai']);
      setTimeout(function () {
        try { var ib = document.querySelector('.me-intro-ai'); if (ib) ib.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
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
    try { sessionStorage.removeItem('__tut_progress'); } catch (_) {}   // 2026-07-14: 종료 시 이어가기 마커 제거
    _active = false; _looping = false; _freeMode = false;
    _targets = []; _cur = null; _hist = [];
    if (_pop) { _pop.style.display = 'none'; _pop.classList.remove('center'); }
    if (_hole) _hole.style.display = 'none';
    if (_blocker) _blocker.style.display = 'none';
  }

  function run(steps, startIdx) {
    closeChooser(); ensureStyles();
    _steps = steps; _active = true;
    _cur = null; _hist = []; _freeMode = false; _chosenBranch = 'upload';
    enterStep(startIdx || 0);
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
      '<button class="tut-x" data-act="close" aria-label="' + T({ kr: '닫기', ja: '閉じる', en: 'Close' }) + '">✕</button>'
      + '<h3>' + T({ kr: '주문이 처음이신가요?', ja: '初めてのご注文ですか?', en: 'First time ordering?' }) + '</h3>'
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
    _choice.querySelector('[data-act="close"]').addEventListener('click', closeChooser);   // 2026-07-18: X 닫기
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

  // 2026-07-14: 장바구니 담기 직전 — 미니에디터 시안 최종 확인 + PDF 다운로드 점검 (모든 제품 공통).
  //   에디터가 없는 제품(원판/금액주문 등)은 onEnter 로 자동 스킵.
  var PROOF_STEP = {
    // 2026-07-14: 다운로드 버튼이 아니라 '에디터 디자인 화면'을 밝게 하이라이트 (버튼만 비추면 대지가 어둡게 보임).
    target: ['#embeddedEditorPreview', '#meStage'], mode: 'next',
    onEnter: function () { return _secVisible('#meStage') || _secVisible('#embeddedEditorPreview'); },
    hint: { kr: '여기서 디자인을 확인하고, 다운로드로 PDF도 확인!', ja: 'ここでデザイン確認、ダウンロードでPDFも!', en: 'Review here, then Download the PDF!' },
    msg: { kr: '담기 전에 <b>시안을 최종 확인</b>해요. 이 <b>에디터 화면</b>에서 디자인을 한 번 더 보고, 아래 <b>다운로드</b>로 <b>PDF 시안</b>도 꼭 확인해 주세요.<br><span style="color:#94a3b8;">에디터 화면과 실제 인쇄 PDF는 약간 다를 수 있어요.</span>',
      ja: 'カートに入れる前に <b>デザインを最終確認</b>。この <b>エディター画面</b> でもう一度見て、下の <b>ダウンロード</b> で <b>PDF</b> も必ずご確認ください。<br><span style="color:#94a3b8;">エディター画面と実際の印刷PDFは多少異なる場合があります。</span>',
      en: 'Do a <b>final check</b> before adding to cart. Review your design in this <b>editor</b>, then tap <b>Download</b> below to check the <b>PDF proof</b>.<br><span style="color:#94a3b8;">The editor may differ slightly from the printed PDF.</span>' },
    cheer: { kr: '확인 완료! 👀', ja: '確認OK! 👀', en: 'Checked! 👀' }
  };

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
        // 2026-07-19: 명함도 템플릿 대신 인공지능으로.
        { key: 'ai', mode: 'free', template: 'ai-intro', target: ['.me-intro-ai'],
          label: { kr: '인공지능으로 디자인', ja: 'AIでデザイン', en: 'Design with AI' },
          sub: { kr: '상호·이름·연락처만 적으면 끝', ja: '社名·氏名·連絡先を書くだけ', en: 'Just enter name & contact' },
          msg: { kr: '반짝이는 <b>[AI디자인 실행]</b>을 눌러주세요! 창이 열리면 <b>상호·이름·직함·연락처</b> 등 명함에 넣을 내용을 적고 만들기를 누르면, 업종에 어울리는 명함을 만들어드려요. 마음에 들 때까지 다시 만들 수 있어요. 다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b>를 눌러요!',
            ja: '光る <b>[AIデザイン実行]</b> を押してください!ウィンドウが開いたら <b>社名·氏名·肩書·連絡先</b> など名刺に入れる内容を書いて作成を押すと、業種に合う名刺を作ります。気に入るまで作り直せます。完成したら下の <b>「デザイン完了 → 次へ」</b> を!',
            en: 'Tap the glowing <b>[Run AI Design]</b>! Enter what goes on the card — <b>company, name, title, contact</b> — and hit create; we\'ll design one that suits your industry. Regenerate as often as you like. When done, tap <b>"Done → Continue"</b> below!' }
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
    PROOF_STEP, // 7) 시안 최종 확인 (다운로드 PDF 점검)
    { // 8) 장바구니
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
        // 2026-07-19: 템플릿 분기 폐지 — 이제 디자인은 인공지능으로 한다(사장님 방침).
        //   버튼도 툴바의 #meAiGenBtn 이 아니라 간편 진입의 [AI디자인 실행](.me-intro-ai) 를 가리킨다.
        //   (툴바 버튼은 '디자인 수정도구'로 들어가야 보이므로 첫 화면에선 안 보인다.)
        { key: 'ai', mode: 'free', template: 'ai-intro', target: ['.me-intro-ai'],
          label: { kr: '인공지능으로 디자인', ja: 'AIでデザイン', en: 'Design with AI' },
          sub: { kr: '내용만 적으면 AI가 만들어줘요', ja: '内容を書くだけでAIが作成', en: 'Just describe it — AI makes it' },
          msg: { kr: '반짝이는 <b>[AI디자인 실행]</b>을 눌러주세요! 창이 열리면 <b>어떤 디자인을 원하는지 내용을 적고</b> 만들기를 누르면 됩니다. 마음에 들 때까지 다시 만들 수 있고, <b>글씨·요소·사진</b>을 더해 꾸며도 좋아요. 다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b>를 눌러요!',
            ja: '光る <b>[AIデザイン実行]</b> を押してください!ウィンドウが開いたら <b>どんなデザインにしたいか内容を入力</b> して作成を押します。気に入るまで作り直せますし、<b>文字·要素·写真</b> を加えて飾ってもOK。完成したら下の <b>「デザイン完了 → 次へ」</b> を!',
            en: 'Tap the glowing <b>[Run AI Design]</b>! When the window opens, <b>describe the design you want</b> and hit create. Regenerate as often as you like, and add <b>text, elements and photos</b> too. When done, tap <b>"Done → Continue"</b> below!' }
        },
        { key: 'upload', always: true,
          // 업로드 후엔 원래 업로드 버튼이 숨고 '파일 변경' 버튼이 나옴 → 그것도 가리켜 재업로드 가능하게.
          // 2026-07-14: 스티커 전용 완성파일 업로드(#soStickerFinalFileWrap)도 포함 — 안 넣으면 스포트라이트가 안 잡혀 버튼 클릭 불가.
          target: ['#soUniversalUpload', '#soBannerUploadBtn', '#soAdInlineUploadBtn', '#soAdInlineChangeBtn', '#soStickerFinalFileWrap'],
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
            // 2026-07-14: 스티커 전용 완성파일 입력(#soStickerFinalFile)도 감지 — #soFile 과 별개 input 이라 안 넣으면 자동진행 안 됨.
            var inputs = ['soFile', 'meImgInput', 'soStickerFinalFile'].map(function (id) { return document.getElementById(id); });
            var done = false;
            var on = function () { if (done) return; done = true; advance({ kr: '업로드 완료! 🎉', ja: 'アップロード完了! 🎉', en: 'Uploaded! 🎉' }); };
            inputs.forEach(function (el) { if (el) el.addEventListener('change', on); });
            return function () { inputs.forEach(function (el) { if (el) el.removeEventListener('change', on); }); };
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
      //   2026-07-14: mode 'wait' → 'next'. wait 는 타깃 클릭 시 자동 진행이라 수량 입력칸을 눌러 타이핑하려 하면
      //   튜토리얼이 넘어가버려 입력 불가. next 는 자유롭게 입력 후 '다음'으로 진행.
      target: '#soQtySection', mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요! 많이 만들수록 낱장 단가가 내려가요 💰 <span style="color:#94a3b8;">(칸에 직접 입력하거나 버튼으로 선택 후 다음)</span>',
        ja: '<b>数量</b>を決めましょう!たくさん作るほど1枚あたりお得です 💰 <span style="color:#94a3b8;">(直接入力またはボタンで選択して次へ)</span>',
        en: 'Choose the <b>quantity</b>! The more you print, the lower the unit price 💰 <span style="color:#94a3b8;">(type it in or pick, then Next)</span>' },
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
  //  시나리오 — 사이즈 지정 제품 (스티커 / 실사출력 / 현수막 / 광고인쇄 등)  2026-07-14
  //  사용자 요청: 사이즈를 정해야 하는 제품은 먼저 우측의 사이즈·용지·별색·수량 옵션을
  //  순서대로 고른 뒤에 디자인 방법 선택 화면이 나오게. 없는 옵션 단계는 onEnter 로 자동 스킵.
  //  (generic catch-all 앞에 두되, 우측 사이즈 섹션이 보일 때만 매치 → 그 외엔 generic 유지)
  // ════════════════════════════════════════════════════════════════════
  function _tutIsSizeProduct() {
    try {
      return _secVisible('#soStickerSection') || _secVisible('#soStickerSizeWrap')
          || _secVisible('#soCustomSizeSection') || _secVisible('#soRealPrintSection');
    } catch (_) { return false; }
  }
  var SIZE_PRODUCT_STEPS = [
    { // 1) 사이즈
      target: ['#soStickerSizeWrap', '#soCustomSizeSection', '#soRealPrintSection'], mode: 'next',
      onEnter: function () { return _secVisible('#soStickerSizeWrap') || _secVisible('#soCustomSizeSection') || _secVisible('#soRealPrintSection'); },
      msg: { kr: '먼저 <b>사이즈</b>를 정해요. 가격은 <b>사이즈(면적)에 따라 자동 계산</b>돼요.',
        ja: 'まず <b>サイズ</b> を決めます。価格は <b>サイズ(面積)で自動計算</b> されます。',
        en: 'First set the <b>size</b> — the price is <b>calculated automatically</b> from it.' },
      cheer: { kr: '사이즈 확인! 📏', ja: 'サイズOK! 📏', en: 'Size set! 📏' }
    },
    { // 2) 종류(용지)
      target: '#soStickerTypeWrap', mode: 'next',
      onEnter: function () { return _secVisible('#soStickerTypeWrap'); },
      msg: { kr: '<b>종류</b>를 골라요. 아트지·무광·유광·강접은 기본가, 스파클링·홀로그램·투명 등 특수용지는 3배가예요.',
        ja: '<b>種類</b> を選びます。上質紙·マット·グロス·強粘着は標準価格、スパークリング·ホログラム·透明などの特殊用紙は3倍です。',
        en: 'Choose the <b>type</b>. Art/matte/gloss/strong-adhesive are base price; special papers (sparkle, holo, clear…) are ×3.' }
    },
    { // 4) 수량
      target: ['#soStickerQtyWrap', '#soQtySection'], mode: 'next',
      onEnter: function () { return _secVisible('#soStickerQtyWrap') || _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요! 많이 만들수록 낱장 단가가 내려가요 💰',
        ja: '<b>数量</b>を決めましょう!たくさん作るほど1枚あたりお得です 💰',
        en: 'Choose the <b>quantity</b> — more pieces, lower unit price 💰' }
    },
    GENERIC_STEPS[0], // 5) 디자인 방법 (AI / 템플릿 / 파일 / 의뢰)
    { // 6) 모양(재단) 선택 (스티커만) — 사각(기본)/간단도형(+10,000)/복잡모양(+30,000). 없는 제품은 자동 스킵.
      target: '#soStickerShapeWrap', mode: 'next',
      onEnter: function () { return _secVisible('#soStickerShapeWrap'); },
      msg: { kr: '스티커를 <b>어떤 모양</b>으로 재단할까요?<br>• <b>사각</b> — 사각형 그대로 <b>(기본)</b><br>• <b>모양스티커</b> — 그림 외곽 그대로 따기 <b>(+10,000원)</b>. 다음 단계에서 자동으로 누끼+칼선을 따드려요.',
        ja: 'ステッカーを <b>どの形</b> にカットしますか?<br>• <b>四角</b> — 四角形のまま <b>(標準)</b><br>• <b>型抜きステッカー</b> — 絵の輪郭通りにカット <b>(+¥1,000)</b>。次のステップで自動で切り抜き+カットライン。',
        en: 'What <b>cut shape</b> for your sticker?<br>• <b>Square</b> — plain rectangle <b>(default)</b><br>• <b>Die-cut</b> — cut to the artwork outline <b>(+₩10,000)</b>; auto cut-out + cutline next.' },
      cheer: { kr: '모양 결정! ✂️', ja: '形OK! ✂️', en: 'Shape set! ✂️' }
    },
    { // 6.5) 복잡모양 — 자동 누끼+칼선 실행 후, 이미지 크기·위치를 조정해 칼선에 맞춤 (복잡모양 아니면 자동 스킵).
      target: '#meStage', mode: 'next',
      onEnter: function () { return window._soStickerShapeCur === 'complex'; },
      buttons: [
        { action: '_meStickerAutoCutout', label: { kr: '✂️ 자동 배경제거 + 칼선 따기', ja: '✂️ 自動 背景除去＋カットライン', en: '✂️ Auto bg-removal + cutline' } }
      ],
      msg: { kr: '<b>모양스티커</b>예요! ① 아래 <b>[자동 배경제거+칼선]</b> 버튼을 눌러요. ② 그 다음 <b>이미지의 크기와 위치를 조정해서 빨강 점선(칼선)에 맞춰</b> 주세요. 이미지와 칼선은 <b>각각 드래그·모서리 핸들</b>로 따로 조정돼요.',
        ja: '<b>型抜きステッカー</b> です! ① 下の <b>[自動 背景除去+カットライン]</b> を押します。② 次に <b>画像のサイズと位置を調整して赤い点線(カットライン)に合わせて</b> ください。画像とカットラインは <b>それぞれドラッグ·角ハンドル</b> で別々に調整できます。',
        en: 'It\'s <b>Die-cut</b>! ① Tap <b>[Auto bg-removal + cutline]</b> below. ② Then <b>adjust the image size & position to match the red dashed cutline</b>. The image and cutline move <b>independently</b> — drag or use the corner handles.' },
      hint: { kr: '이미지·칼선을 각각 맞춘 뒤 다음을 눌러요', ja: '画像·カットラインを合わせてから次へ', en: 'Align image & cutline, then Next' },
      cheer: { kr: '칼선 정렬 완료! ✂️', ja: 'カットライン整列OK! ✂️', en: 'Aligned! ✂️' }
    },
    PROOF_STEP,       // 7) 시안 최종 확인
    GENERIC_STEPS[2]  // 8) 장바구니
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
    PROOF_STEP,      // 시안 최종 확인
    GENERIC_STEPS[2] // 장바구니 — 공통 재사용
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 허니콤 배너 (hb_bn_*)  2026-07-10
  //  디자인(공통) → 배너 종류 선택 → 단면/양면(허니콤배너·연결형만, 나머지는 자동 스킵)
  //  → 수량(있으면) → 장바구니. 제품별로 없는 옵션 단계는 onEnter 로 자동 스킵.
  // ════════════════════════════════════════════════════════════════════
  var HONEYCOMB_BANNER_STEPS = [
    { // 1) 배너 종류 선택 — 먼저 종류를 고른 뒤 디자인. (resumeNext: 카드로 다른 종류 선택 시 처음이 아니라 다음 챕터로 이어감)
      target: '#soBannerVariantsHostSec', mode: 'next', resumeNext: true,
      onEnter: function () { return _secVisible('#soBannerVariantsHostSec'); },
      msg: { kr: '먼저 <b>배너 종류</b>를 골라요. <b>허니콤배너·연결형·선반형·거치대 세트</b> 등 카드를 눌러 원하는 종류를 고르면 이어서 디자인해요.',
        ja: 'まず <b>バナーの種類</b> を選びます。<b>ハニカムバナー·連結型·棚型·スタンドセット</b> などカードを押して選ぶと、続けてデザインへ。',
        en: 'First pick the <b>banner type</b> — tap a card (<b>honeycomb / linked / shelf / stand set</b>). Then we\'ll continue to the design.' }
    },
    GENERIC_STEPS[0], // 2) 디자인 방법 (AI / 템플릿 / 파일 / 의뢰)
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
    PROOF_STEP,      // 시안 최종 확인
    GENERIC_STEPS[2] // 장바구니
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
    { // 4) 업로드 후 — 자동(배경제거+칼선) or 네모 그대로, 버튼으로 선택
      target: '#meBgRemoveBtn', mode: 'wait', waitEvent: 'me-standee-ready',
      onEnter: function () { return _secVisible('#meBgRemoveBtn'); },
      buttons: [
        { action: '_meAutoBgAndCutline', label: { kr: '① 자동 배경제거 및 칼선작업', ja: '① 自動 背景除去＋カットライン', en: '① Auto bg-removal & cutline' } },
        { action: '_meStandeeSkipCutline', label: { kr: '② 네모 이미지 그대로 제작', ja: '② 四角い画像のまま製作', en: '② Keep the rectangular image' } }
      ],
      msg: { kr: '업로드 잘 하셨어요! 🎉 어떻게 만들지 골라주세요.',
        ja: 'アップロードOK! 🎉 作り方を選んでください。',
        en: 'Nicely uploaded! 🎉 Choose how to make it.' },
      note: { kr: '※ 일러스트로 작업한 <b>PDF</b>는 <b>별도의 레이어에 칼선</b>을 작업해 주세요. <b>이미지</b>는 자동으로 칼선을 만듭니다.',
        ja: '※ イラストで作った <b>PDF</b> は <b>別レイヤーにカットライン</b> をご用意ください。<b>画像</b> は自動でカットラインを作成します。',
        en: '※ For an illustrator <b>PDF</b>, put the <b>cutline on a separate layer</b>. <b>Images</b> get an automatic cutline.' },
      hint: { kr: '자동은 몇 초 걸려요 — 끝나면 자동으로 넘어가요', ja: '自動は数秒かかります — 完了で次へ', en: 'Auto takes a few seconds — it advances when done' },
      skipLabel: { kr: '건너뛰기', ja: 'スキップ', en: 'Skip' },
      cheer: { kr: '칼선 완성! ✂️', ja: 'カットライン完成! ✂️', en: 'Cutline done! ✂️' }
    },
    { // 5) 외곽선 두께 · 받침(꽂이) 위치 조절 — 이미지 옆 떠있는 창의 슬라이더
      //  target 은 떠있는 창만 (여러 selector union 시 상단 빈 #meProps 까지 감싸 하이라이트가 위로 커짐)
      target: '#meCutlineFloat', mode: 'next',
      hint: { kr: '이미지를 선택하면 옆에 조절창이 나와요', ja: '画像を選択すると横に調整パネルが出ます', en: 'Select the image to see the panel beside it' },
      msg: { kr: '이제 <b>외곽선 두께</b>와 <b>받침(꽂이) 위치</b>를 다듬어요. 이미지를 선택하면 <b>옆에 조절창</b>이 나와요.<br>• <b>외곽선 두께</b> — 재단선을 이미지에서 얼마나 띄울지 조절해요.<br>• <b>받침 위치</b> — 등신대 아래 <b>꽂이(받침)</b>를 위·아래로 늘려 스탠드에 안정적으로 꽂히게 해요.',
        ja: '<b>フチの太さ</b>と<b>差し込み(スタンド)位置</b>を調整します。画像を選択すると <b>横に調整パネル</b> が表示されます。<br>• <b>フチの太さ</b> — 裁断線を画像からどれだけ離すか。<br>• <b>差し込み位置</b> — 等身大の下の <b>差し込み</b> を上下に伸ばして安定して差し込めるように。',
        en: 'Fine-tune the <b>outline thickness</b> and <b>base tab position</b>. Select the image to reveal the <b>panel beside it</b>.<br>• <b>Outline thickness</b> — how far the die-cut line sits from the image.<br>• <b>Base position</b> — stretch the bottom <b>insert tab</b> up/down so it sits firmly in the stand.' }
    },
    { // 6) 크기 입력 — 등신대(조각)의 실제 크기(mm). 비율 고정 + 가격 자동.
      target: '#meCutlineFloat', mode: 'next',
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
    PROOF_STEP,      // 시안 최종 확인
    GENERIC_STEPS[2] // 8) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 팬시 스티커 (시트형 · 여러 이미지 자동 누끼+칼선+배치)  2026-07-14
  // ════════════════════════════════════════════════════════════════════
  function _tutIsFancySticker() { try { return _secVisible('#soFancyMultiWrap'); } catch (_) { return false; } }
  var FANCY_STICKER_STEPS = [
    { // 1) 종류(용지)
      target: '#soStickerTypeWrap', mode: 'next',
      onEnter: function () { return _secVisible('#soStickerTypeWrap'); },
      msg: { kr: '먼저 <b>종류</b>를 골라요. 아트지·무광·유광·강접은 기본가, 스파클링·홀로그램·투명 등 특수용지는 3배가예요.',
        ja: 'まず <b>種類</b> を選びます。上質紙·マット·グロス·強粘着は標準価格、特殊用紙は3倍です。',
        en: 'First pick the <b>type</b>. Art/matte/gloss/strong = base price; special papers ×3.' },
      cheer: { kr: '종류 선택! 🏷️', ja: '種類OK! 🏷️', en: 'Type set! 🏷️' }
    },
    { // 2) 이미지 한 장씩 올리기 → 자동 누끼+칼선+배치
      target: '#soFancyMultiWrap', mode: 'next',
      onEnter: function () { return _secVisible('#soFancyMultiWrap'); },
      msg: { kr: '이제 <b>이미지를 한 장씩</b> 올려요! <span style="color:#94a3b8;">(최대 8개)</span><br>한 장 올리면 <b>자동으로 배경제거(누끼)와 칼선</b>을 따서 시트에 놓아드려요. 결과를 보고 <b>다음 장을 더 올리거나</b> 사진을 <b>교체</b>할 수 있어요. 🪄',
        ja: '<b>画像を1枚ずつ</b> アップロード! <span style="color:#94a3b8;">(最大8個)</span><br>1枚ごとに <b>自動で背景除去とカットライン</b> を作成して配置します。結果を見て <b>追加</b> や <b>差し替え</b> ができます。🪄',
        en: 'Add images <b>one at a time</b>! <span style="color:#94a3b8;">(up to 8)</span><br>Each is <b>auto background-removed & cut-lined</b> and placed. Then <b>add more</b> or <b>replace</b> a photo. 🪄' },
      hint: { kr: '한 장씩 올려서 결과를 확인하고 조정할 수 있어요', ja: '1枚ずつ確認しながら追加', en: 'Add one at a time, check, adjust' },
      cheer: { kr: '자동 배치 완료! 🎉', ja: '自動配置OK! 🎉', en: 'Auto-arranged! 🎉' }
    },
    { // 3) 배치·크기 조정 (+ 이미지 더 올리기)
      target: '#meStage', mode: 'next', hideBack: true,
      buttons: [
        { action: '_soFancyAddMore', label: { kr: '＋ 이미지 더 올리기', ja: '＋ 画像を追加', en: '＋ Add another image' } }
      ],
      msg: { kr: '시트에 배치된 스티커들의 <b>위치와 크기</b>를 조정해요. 각 이미지를 <b>드래그</b>하거나 <b>모서리 핸들</b>로 크기를 바꾸면 칼선도 같이 따라와요.<br>더 넣고 싶으면 아래 <b>＋ 이미지 더 올리기</b>!',
        ja: 'シート上のステッカーの <b>位置とサイズ</b> を調整。<b>ドラッグ</b> や <b>角ハンドル</b> でサイズ変更するとカットラインも追従。<br>追加したい場合は下の <b>＋ 画像を追加</b>！',
        en: 'Adjust each sticker’s <b>position & size</b> — <b>drag</b> or use the <b>corner handles</b> (the cut line follows).<br>Want more? Tap <b>＋ Add another image</b> below!' },
      cheer: { kr: '배치 완성! ✨', ja: '配置完了! ✨', en: 'Layout done! ✨' }
    },
    { // 4) 수량
      target: ['#soStickerQtyWrap', '#soQtySection'], mode: 'next',
      onEnter: function () { return _secVisible('#soStickerQtyWrap') || _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량(세트)</b>을 정해요. 팬시 스티커는 <b>4매 단위</b>로 주문돼요.',
        ja: '<b>数量(セット)</b>を決めます。ファンシーは <b>4枚単位</b> です。',
        en: 'Choose the <b>quantity (sets)</b>. Fancy stickers are ordered in <b>units of 4</b>.' }
    },
    PROOF_STEP,       // 시안 최종 확인
    GENERIC_STEPS[2]  // 장바구니
  ];

  // 2026-07-14: 스티커 진입 시 — 먼저 '일반 스티커 / 팬시 스티커' 중 선택 → 각 튜토리얼로 분기.
  function _tutIsStickerProduct() { try { return _secVisible('#soStickerSection'); } catch (_) { return false; } }
  var STICKER_CHOOSE_STEP = {
    branch: [
      { key: 'regular', mode: 'jump', always: true,
        label: { kr: '📄 일반 스티커 (이미지 1장)', ja: '📄 通常ステッカー (画像1枚)', en: '📄 Regular sticker (1 image)' },
        sub: { kr: '원하는 모양과 크기로 만드는 기본 스티커', ja: '好きな形とサイズで作る基本ステッカー', en: 'Basic sticker in any shape & size' },
        run: function () {
          try { if (window._soStickerSelectKind) window._soStickerSelectKind('regular'); } catch (_) {}
          setTimeout(function () { run(SIZE_PRODUCT_STEPS, 0); }, 90);
        } },
      { key: 'fancy', mode: 'jump', always: true,
        label: { kr: '✨ 팬시 스티커 (이미지 최대 8개)', ja: '✨ ファンシーステッカー (画像最大8個)', en: '✨ Fancy sticker (up to 8 images)' },
        sub: { kr: '여러 이미지를 스티커 한 장에 — 소량 주문 가능한 나만의 굿즈', ja: '複数の画像を1枚に — 小ロットOKのオリジナルグッズ', en: 'Multiple images on one sheet — small-batch custom goods' },
        run: function () {
          try { if (window._soStickerSelectKind) window._soStickerSelectKind('fancy'); } catch (_) {}
          setTimeout(function () { run(FANCY_STICKER_STEPS, 0); }, 140);
        } }
    ],
    msg: { kr: '어떤 <b>스티커</b>를 만들까요? 종류를 먼저 골라주세요.',
      ja: 'どの <b>ステッカー</b> にしますか? まず種類をお選びください。',
      en: 'Which <b>sticker</b> would you like? Pick a type to start.' }
  };

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 낱장 인쇄 (리플렛/전단, pp_lf)  2026-07-14
  //  규격/비규격 사이즈 → 인쇄면(단면/양면) → 수량 → 디자인 → 용지 → 박 → 후가공 → 시안 → 장바구니.
  // ════════════════════════════════════════════════════════════════════
  function _tutIsLeaflet() { try { return _secVisible('#soLeafletPresetSec'); } catch (_) { return false; } }
  var LEAFLET_STEPS = [
    { // 1) 사이즈 (규격 A4/A3/A2 · 비규격) — 규격 그리드 + 비규격 토글만 하이라이트 (섹션 전체 X)
      target: ['#soLeafletSizeGrid', '#soLfCustToggle'], mode: 'next',
      onEnter: function () { return _secVisible('#soLeafletPresetSec'); },
      msg: { kr: '먼저 <b>사이즈</b>를 골라요. A4·A3·A2 규격 중 선택하거나, 아래 <b>비규격 사이즈</b>를 눌러 원하는 크기(mm)를 직접 넣을 수 있어요. 가격은 사이즈·수량에 따라 자동 계산돼요.',
        ja: 'まず <b>サイズ</b> を選びます。A4·A3·A2 の規格、または下の <b>非規格サイズ</b> で好きな寸法(mm)を入力できます。価格はサイズ·数量で自動計算。',
        en: 'First pick the <b>size</b>. Choose A4/A3/A2, or tap <b>Custom size</b> to enter your own (mm). Price updates by size & quantity.' },
      cheer: { kr: '사이즈 확인! 📏', ja: 'サイズOK! 📏', en: 'Size set! 📏' }
    },
    { // 2) 인쇄면 (단면/양면)
      target: ['#soLfSideSingle', '#soLfSideDouble'], mode: 'next',
      onEnter: function () { return _secVisible('#soLfSideSingle'); },
      msg: { kr: '<b>인쇄면</b>을 정해요. <b>단면</b>은 앞면만, <b>양면</b>은 앞·뒤 모두 인쇄해요.',
        ja: '<b>印刷面</b>を選びます。<b>片面</b>は表のみ、<b>両面</b>は表裏とも印刷します。',
        en: 'Choose the <b>print side</b>. <b>Single</b> = front only, <b>Double</b> = both sides.' }
    },
    { // 3) 수량
      target: ['#soQtySection', '#soLfQtySlot'], mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection') || _secVisible('#soLfQtySlot'); },
      msg: { kr: '<b>수량</b>을 정해요! 많이 만들수록 낱장 단가가 내려가요 💰 <span style="color:#94a3b8;">(칸에 직접 입력 가능)</span>',
        ja: '<b>数量</b>を決めましょう!たくさん作るほど1枚あたりお得です 💰 <span style="color:#94a3b8;">(直接入力OK)</span>',
        en: 'Choose the <b>quantity</b>! More prints = lower unit price 💰 <span style="color:#94a3b8;">(type it in)</span>' }
    },
    { // 4) 용지 — 필수 옵션. 진입 시 용지 목록 자동 펼침 + 목록까지 하이라이트.
      target: ['#soLfPaperToggle', '#soLfPaperGrid'], mode: 'next',
      onEnter: function () {
        if (!_secVisible('#soLfPaperToggle')) return false;
        try { var w = document.getElementById('soLfPaperWrap'); if (w && w.style.display === 'none' && typeof window._soLeafletToggleSection === 'function') window._soLeafletToggleSection('paper'); } catch (_) {}
        return true;
      },
      msg: { kr: '<b>용지</b>를 골라요 <span style="color:#94a3b8;">(필수)</span>. 기본은 전단에 많이 쓰는 스노우지 180g이에요. 아래 목록에서 원하는 용지를 고르세요. <span style="color:#94a3b8;">(모든 용지 같은 가격 이벤트)</span>',
        ja: '<b>用紙</b>を選びます <span style="color:#94a3b8;">(必須)</span>。基本はチラシによく使うスノー紙180g。下の一覧からお好みの用紙をお選びください。<span style="color:#94a3b8;">(全用紙同価格イベント)</span>',
        en: 'Choose the <b>paper</b> <span style="color:#94a3b8;">(required)</span>. Default is Snow 180g (popular for flyers). Pick from the list below. <span style="color:#94a3b8;">(all papers same price event)</span>' }
    },
    { // 5) 박 추가 (선택)
      target: '#soLfFoilToggle', mode: 'next',
      onEnter: function () { return _secVisible('#soLfFoilToggle'); },
      msg: { kr: '금·은·홀로그램 등 <b>박</b> 마감이 필요하면 눌러서 추가해요 <span style="color:#94a3b8;">(선택 사항 — 필요 없으면 다음)</span>.',
        ja: '金·銀·ホログラムなどの <b>箔</b> が必要なら押して追加 <span style="color:#94a3b8;">(任意 — 不要なら次へ)</span>。',
        en: 'Add <b>foil</b> (gold/silver/holographic) if you like <span style="color:#94a3b8;">(optional — or Next)</span>.' }
    },
    { // 6) 후가공 추가 (선택)
      target: '#soLfFinishToggle', mode: 'next',
      onEnter: function () { return _secVisible('#soLfFinishToggle'); },
      msg: { kr: '형압·미싱·오시·타공·귀도리 등 <b>특수 후가공</b>이 필요하면 눌러서 추가해요 <span style="color:#94a3b8;">(선택 사항 — 없으면 다음)</span>.',
        ja: 'エンボス·ミシン·スジ·穴あけ·角丸などの <b>特殊加工</b> が必要なら押して追加 <span style="color:#94a3b8;">(任意 — 不要なら次へ)</span>。',
        en: 'Add <b>special finishing</b> (emboss, perforation, scoring, hole, round-corner) if needed <span style="color:#94a3b8;">(optional — or Next)</span>.' }
    },
    GENERIC_STEPS[0], // 7) 디자인 방법 (AI / 템플릿 / 파일 / 의뢰) — 옵션 다 고른 뒤 디자인
    PROOF_STEP,       // 8) 시안 최종 확인
    GENERIC_STEPS[2]  // 9) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 현수막 (placard, 44578 등)  2026-07-14
  //  종류 선택 → 사이즈 → 마감(고리·로프 등) → 디자인 → 시안확인 → 수량 → 장바구니.
  //  종류 카드는 클릭 시 제품 URL 이 바뀌어 리로드됨 → resumeNext 로 다음 챕터 이어감.
  // ════════════════════════════════════════════════════════════════════
  // 종류 카드(soPlacardVariantsSec)는 async 로 로드되므로 시나리오 선택 시점엔 아직 숨겨져 있음 →
  //   simple_order 가 세팅하는 동기 플래그(window._soCurrentIsPlacard)로 판정.
  function _tutIsPlacard() { try { return window._soCurrentIsPlacard === true || _secVisible('#soPlacardVariantsSec'); } catch (_) { return false; } }
  var PLACARD_STEPS = [
    { // 1) 현수막 종류 선택 (카드) — 클릭 시 리로드 → 다음 챕터로 이어감
      target: ['#soPlacardVariants', '#soPlacardVariantsSec'], mode: 'next', resumeNext: true,
      onEnter: function () { return window._soCurrentIsPlacard === true; },
      msg: { kr: '먼저 <b>현수막 종류</b>를 골라요. 초저가·UV대폭·친환경·라텍스·깃발·족자 등 카드를 눌러 종류를 바꿀 수 있어요. 종류마다 <b>㎡당 단가</b>가 달라요.',
        ja: 'まず <b>横断幕の種類</b> を選びます。激安·UV大幅·エコ·ラテックス·フラッグなど、カードをタップで切替。種類ごとに <b>㎡単価</b> が異なります。',
        en: 'First pick the <b>banner type</b>. Tap a card to switch (low-cost, UV wide, eco, latex, flag…). Each has its own <b>price per ㎡</b>.' },
      cheer: { kr: '종류 선택! 🎌', ja: '種類OK! 🎌', en: 'Type set! 🎌' }
    },
    { // 2) 사이즈 (가로×세로 cm, 10cm 단위) — 초저가 롤 폭 초과 시 '다음' 차단(끝까지 갔다 되돌아오는 번거로움 방지)
      target: '#soCustomSizeSection', mode: 'next',
      onEnter: function () { return _secVisible('#soCustomSizeSection'); },
      blockNext: function () { return window._soPlacardOversized === true; },
      msg: { kr: '<b>사이즈</b>를 정해요. 현수막은 <b>가로·세로 10cm 단위</b>로 주문해요 (예: 300×60). 가격은 면적(㎡)에 따라 자동 계산돼요.',
        ja: '<b>サイズ</b>を決めます。横断幕は <b>横·縦10cm単位</b>（例: 300×60）。価格は面積(㎡)で自動計算。',
        en: 'Set the <b>size</b>. Banners are ordered in <b>10 cm steps</b> (e.g. 300×60). Price is auto-calculated by area (㎡).' },
      cheer: { kr: '사이즈 확인! 📏', ja: 'サイズOK! 📏', en: 'Size set! 📏' }
    },
    { // 3) 마감 (고리·로프·코팅 등 추가옵션)
      target: '#soAddonSection', mode: 'next',
      onEnter: function () { return _secVisible('#soAddonSection'); },
      msg: { kr: '<b>마감</b>을 골라요. 고리(하도메)·로프·코팅 등 필요한 마감을 선택하면 조립·발송돼요 <span style="color:#94a3b8;">(필요 없으면 다음)</span>.',
        ja: '<b>仕上げ</b>を選びます。ハトメ·ロープ·コーティングなど、必要な仕上げを選ぶと組立·発送されます <span style="color:#94a3b8;">(不要なら次へ)</span>。',
        en: 'Choose <b>finishing</b> — eyelets, rope, coating, etc. Selected items are assembled & shipped <span style="color:#94a3b8;">(or Next)</span>.' }
    },
    GENERIC_STEPS[0], // 4) 디자인 방법 (파일 업로드 / 만들기 / 의뢰)
    PROOF_STEP,       // 5) 시안 최종 확인
    { // 6) 수량
      target: ['#soQtySection', '#soLfQtySlot'], mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요! 같은 현수막을 여러 장 주문할 수 있어요 <span style="color:#94a3b8;">(칸에 직접 입력 가능)</span>.',
        ja: '<b>数量</b>を決めます!同じ横断幕を複数枚注文できます <span style="color:#94a3b8;">(直接入力OK)</span>。',
        en: 'Choose the <b>quantity</b>! Order multiple copies of the same banner <span style="color:#94a3b8;">(type it in)</span>.' }
    },
    GENERIC_STEPS[2]  // 7) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 아크릴 키링/코롯토 (gds_acr_kr_*)  2026-07-14
  //  모양선택 → 단면/양면 → 사이즈 → 개별포장 → 고리선택 → 파일업로드 → 누끼/칼선.
  // ════════════════════════════════════════════════════════════════════
  function _tutIsKeyring() { try { return window._soCurrentIsKeyringLike === true; } catch (_) { return false; } }
  var KEYRING_STEPS = [
    { // 1) 모양 선택 (모양따기/사각배경/원형배경/모양배경/사각투명/원형투명)
      target: ['#soPresetCutGrid', '#soPresetCutSection'], mode: 'next',
      onEnter: function () { return _secVisible('#soPresetCutSection'); },
      msg: { kr: '먼저 <b>모양</b>을 골라요! <b>모양따기</b>(그림 외곽 그대로)·사각/원형 배경·투명 등 6가지 중 선택할 수 있어요.',
        ja: 'まず <b>形</b> を選びます!<b>型抜き</b>(絵の輪郭通り)・四角/円形の背景・透明など6種類から。',
        en: 'First pick the <b>shape</b>! Choose from 6: <b>die-cut</b> (to the artwork outline), square/round background, transparent, etc.' },
      cheer: { kr: '모양 선택! 🔑', ja: '形OK! 🔑', en: 'Shape set! 🔑' }
    },
    { // 2) 단면 / 양면
      target: '#soKeyringSideRow', mode: 'next',
      onEnter: function () { return _secVisible('#soKeyringSideRow'); },
      msg: { kr: '<b>인쇄 면</b>을 정해요. <b>단면</b>은 앞면만, <b>양면</b>은 앞·뒤 모두 인쇄해요 <span style="color:#94a3b8;">(양면 = 기본가 ×2)</span>.',
        ja: '<b>印刷面</b>を選びます。<b>片面</b>は表のみ、<b>両面</b>は表裏とも <span style="color:#94a3b8;">(両面=基本価格×2)</span>。',
        en: 'Choose the <b>print side</b>. <b>Single</b> = front only, <b>Double</b> = both sides <span style="color:#94a3b8;">(double = base ×2)</span>.' }
    },
    { // 3) 사이즈 선택
      target: ['#soPresetSizePills', '#soCustomSizeSection'], mode: 'next',
      onEnter: function () { return _secVisible('#soPresetSizePills') || _secVisible('#soCustomSizeSection'); },
      msg: { kr: '<b>사이즈</b>를 골라요 (4×4 ~ 10×10cm). 큰 사이즈일수록 단가가 올라가요.',
        ja: '<b>サイズ</b>を選びます (4×4〜10×10cm)。大きいほど単価UP。',
        en: 'Choose the <b>size</b> (4×4 to 10×10cm). Bigger = higher unit price.' },
      cheer: { kr: '사이즈 확인! 📏', ja: 'サイズOK! 📏', en: 'Size set! 📏' }
    },
    { // 4) 개별포장
      target: '#soPresetWrapWrap', mode: 'next',
      onEnter: function () { return _secVisible('#soPresetWrapWrap'); },
      msg: { kr: '<b>개별포장</b>을 골라요. 포장없음 / 내지인쇄 / 상단인쇄 중 선택할 수 있어요 <span style="color:#94a3b8;">(필요 없으면 다음)</span>.',
        ja: '<b>個別包装</b>を選びます。包装なし / 台紙印刷 / 上部印刷から <span style="color:#94a3b8;">(不要なら次へ)</span>。',
        en: 'Choose <b>individual packaging</b> — none / insert-print / header-print <span style="color:#94a3b8;">(or Next)</span>.' }
    },
    { // 5) 고리 선택 (addon)
      target: '#soAddonSection', mode: 'next',
      onEnter: function () { return _secVisible('#soAddonSection'); },
      msg: { kr: '<b>고리(체인)</b>를 골라요! 고리를 선택하면 <b>조립되어 배송</b>돼요. 원하는 고리 종류를 눌러주세요.',
        ja: '<b>リング(金具)</b>を選びます!選ぶと <b>組み立てて発送</b> されます。お好みのリングをタップ。',
        en: 'Choose the <b>ring/chain</b>! Selected rings are <b>assembled & shipped</b>. Tap the ring you want.' },
      cheer: { kr: '고리 선택! 🔗', ja: 'リングOK! 🔗', en: 'Ring set! 🔗' }
    },
    GENERIC_STEPS[0], // 6) 파일 업로드 / 디자인 방법
    { // 7) 누끼 + 칼선 (모양따기 등)
      target: '#meStage', mode: 'next',
      buttons: [
        { action: '_meAutoBgAndCutline', label: { kr: '✂️ 자동 배경제거 + 칼선 따기', ja: '✂️ 自動 背景除去＋カットライン', en: '✂️ Auto bg-removal + cutline' } }
      ],
      msg: { kr: '<b>모양따기</b>라면 아래 버튼으로 <b>배경을 지우고(누끼) 외곽 칼선</b>을 자동으로 따드려요. 그 다음 <b>드래그·핸들</b>로 위치·크기를 조정하세요. <span style="color:#94a3b8;">(사각/원형 배경은 건너뛰어도 돼요)</span>',
        ja: '<b>型抜き</b>なら下のボタンで <b>背景除去+輪郭カットライン</b> を自動作成。<b>ドラッグ·ハンドル</b> で調整。<span style="color:#94a3b8;">(四角/円形背景はスキップ可)</span>',
        en: 'For <b>die-cut</b>, tap below for <b>auto bg-removal + outline cutline</b>, then <b>drag/handles</b> to adjust. <span style="color:#94a3b8;">(skip for square/round background)</span>' },
      hint: { kr: '모양따기가 아니면 그냥 다음을 눌러요', ja: '型抜きでなければ次へ', en: 'Not die-cut? Just tap Next' },
      cheer: { kr: '칼선 완성! ✂️', ja: 'カットラインOK! ✂️', en: 'Cutline done! ✂️' }
    },
    { // 8) 수량
      target: '#soQtySection', mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요! 많이 만들수록 개당 단가가 내려가요 💰 <span style="color:#94a3b8;">(칸에 직접 입력 가능)</span>',
        ja: '<b>数量</b>を決めます!たくさん作るほど1個あたりお得 💰 <span style="color:#94a3b8;">(直接入力OK)</span>',
        en: 'Choose the <b>quantity</b>! More = lower unit price 💰 <span style="color:#94a3b8;">(type it in)</span>' },
      cheer: { kr: '수량 확인! 🔢', ja: '数量OK! 🔢', en: 'Quantity set! 🔢' }
    },
    PROOF_STEP,       // 9) 시안 확인
    GENERIC_STEPS[2]  // 10) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 글씨 스카시 (hb_ss_*)  2026-07-15
  //  종류선택 → 디자인 문구(타이틀·서브) → 참고사진·로고 업로드(여러 장) → 배송 → 장바구니.
  //  고객이 직접 디자인하기 어려운 상품 — 자료만 올리면 디자이너가 제작. simple_order 의
  //  동기 플래그(window._soCurrentIsScarci)로 판정.
  // ════════════════════════════════════════════════════════════════════
  function _tutIsScarci() { try { return window._soCurrentIsScarci === true; } catch (_) { return false; } }
  // 2026-07-18: 재설계 — 종류선택 → 디자인 문구 입력(오른쪽) → 원클릭 AI디자인(왼쪽·중앙 생성창) → 배송 → 장바구니.
  //   문구 입력 단계는 오른쪽 #soScarciRequest 를 하이라이트해 바로 입력 가능. AI 생성창은 화면 중앙 모달.
  var SCARCI_STEPS = [
    { // 1) 스카시 종류(스타일) 선택 (카드) — 클릭 시 variant 리로드 → 다음 챕터로 이어감
      target: ['#soScarciVariants', '#soScarciVariantsSec'], mode: 'next', resumeNext: true,
      onEnter: function () { return window._soCurrentIsScarci === true; },
      msg: { kr: '먼저 <b>스카시 종류</b>를 골라요. 1장짜리·하단박스·묵직한 스타일·아크릴 허니콤 글씨 등 카드를 눌러 종류(가격)를 바꿀 수 있어요.',
        ja: 'まず <b>スカシの種類</b> を選びます。1枚·下段ボックス·重厚スタイル·アクリルハニカム文字など、カードをタップで切替できます。',
        en: 'First pick the <b>scarci type</b>. Tap a card to switch (single, base-box, heavy style, acrylic honeycomb lettering…).' },
      cheer: { kr: '종류 선택! ✨', ja: '種類OK! ✨', en: 'Type set! ✨' }
    },
    { // 2) 디자인 문구 입력 (오른쪽) — 타이틀/서브 + 요청사항. 오른쪽을 하이라이트해 바로 입력 가능.
      target: '#soScarciRequest', mode: 'next',
      onEnter: function () { try { if (window._soScarciRevealRequest) window._soScarciRevealRequest(); } catch (_) {} return true; },
      msg: { kr: '먼저 오른쪽 <b>[디자인 문구]</b>에 포토존에 넣을 <b>타이틀 문구</b>와 <b>서브 문구</b>를 적어주세요. 원하시는 점(색·글씨체 등)이 있으면 <b>요청사항</b>에도 적을 수 있어요. 다 적었으면 <b>다음</b>!',
        ja: 'まず右の <b>[デザイン文字]</b> にフォトゾーンの <b>タイトル文</b> と <b>サブ文</b> をご記入ください。ご希望(色·書体など)があれば <b>ご要望</b> にも記入OK。記入したら <b>次へ</b>!',
        en: 'First, enter the <b>title</b> and <b>subtitle</b> for your photo zone in <b>[Design text]</b> on the right. You can also note wishes (colors, fonts…) in <b>Requests</b>. Then tap <b>Next</b>!' },
      cheer: { kr: '문구 입력! 📝', ja: '文言OK! 📝', en: 'Text set! 📝' }
    },
    { // 3) 원클릭 AI디자인 (왼쪽 버튼) — 눌러 생성. '이대로 제작' 완료(me-scarci-accepted) 시에만 다음으로.
      target: ['.me-intro-ai'], mode: 'wait', waitEvent: 'me-scarci-accepted',
      onEnter: function () { return _secVisible('#aiNbAi'); },
      msg: { kr: '이제 왼쪽 <b>[AI디자인 실행]</b>을 눌러주세요! 화면 <b>가운데에 생성 창</b>이 떠서, 적은 문구로 입체 글씨 포토존을 <b>바로 만들어드려요</b>. 결과에서 마음에 들면 <b>[이대로 제작]</b>을 누르면 다음으로 넘어가요. <span style="color:#94a3b8;">(고치고 싶으면 [수정해서 다시 만들기])</span>',
        ja: '左の <b>[AIデザイン実行]</b> を押してください!画面 <b>中央に生成ウィンドウ</b> が開き、入力した文言で立体文字フォトゾーンを <b>すぐに作成</b>。気に入ったら <b>[このまま製作]</b> を押すと次へ進みます。<span style="color:#94a3b8;">(直すなら [修正して作り直す])</span>',
        en: 'Tap <b>[Run AI Design]</b> on the left! A <b>window opens in the center</b> and <b>instantly builds</b> a 3D-letter photo zone from your text. If you like it, tap <b>[Make it like this]</b> to continue. <span style="color:#94a3b8;">(to change it, [Edit & remake])</span>' },
      hint: { kr: 'AI디자인 실행을 눌러 만들어주세요', ja: 'AIデザイン実行を押して作成', en: 'Tap Run AI Design to create' },
      cheer: { kr: '디자인 완성! 🎨', ja: 'デザイン完成! 🎨', en: 'Design done! 🎨' }
    },
    { // 4) 배송 (수도권 무료 / 지방)
      target: '#soScheduleSection', mode: 'next',
      onEnter: function () { return _secVisible('#soScheduleSection'); },
      msg: { kr: '<b>배송 방법</b>을 골라요. <b>수도권 무료배송</b> 또는 <b>지방배송</b> 중에서 선택할 수 있어요.',
        ja: '<b>配送方法</b>を選びます。<b>首都圏 送料無料</b> または <b>地方配送</b> から選べます。',
        en: 'Choose the <b>delivery method</b> — <b>free metro delivery</b> or <b>regional delivery</b>.' },
      cheer: { kr: '배송 선택! 🚚', ja: '配送OK! 🚚', en: 'Delivery set! 🚚' }
    },
    GENERIC_STEPS[2]  // 5) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 시트지 (vinyl 6종: 탈부착/안개/차량랩핑/글씨커팅/투명 점착·비점착)  2026-07-15
  //  종류선택 → 커팅 방식(모양커팅 +3,000 / 사각커팅 +1,000) → 사이즈(있으면) →
  //  디자인 → (모양커팅이면) 누끼+칼선 → 수량 → 시안 → 장바구니.
  //  simple_order 의 동기 플래그(window._soCurrentIsVinyl)로 판정.
  // ════════════════════════════════════════════════════════════════════
  function _tutIsVinyl() { try { return window._soCurrentIsVinyl === true; } catch (_) { return false; } }
  var VINYL_STEPS = [
    { // 1) 시트지 종류 선택 (카드) — 클릭 시 variant 리로드 → 다음 단계로 이어감
      target: ['#soVinylVariants', '#soVinylVariantsSec'], mode: 'next', resumeNext: true,
      onEnter: function () { return window._soCurrentIsVinyl === true; },
      msg: { kr: '먼저 <b>어떤 시트지</b>를 만들지 골라요. 떼었다 붙이는·안개·차량 랩핑·글씨 커팅·투명 시트 등 카드를 눌러 종류를 바꿀 수 있어요.',
        ja: 'まず <b>どのシート</b> を作るか選びます。貼って剥がせる·すりガラス·車両ラッピング·文字カット·透明シートなど、カードをタップで切替。',
        en: 'First choose <b>which sheet</b> to make. Tap a card to switch — repositionable, frosted, vehicle wrap, letter-cut, clear vinyl…' },
      cheer: { kr: '종류 선택! 🎞️', ja: '種類OK! 🎞️', en: 'Type set! 🎞️' }
    },
    { // 2) 커팅 방식 (추가옵션: 모양커팅 / 사각커팅)
      target: '#soAddonSection', mode: 'next',
      onEnter: function () { return _secVisible('#soAddonSection'); },
      msg: { kr: '<b>커팅 방식</b>을 골라요.<br>• <b>사각커팅</b> — 네모로 재단 <b>(+1,000원)</b><br>• <b>모양커팅</b> — 그림 외곽 그대로 따기 <b>(+3,000원)</b>. 모양커팅이면 뒤에서 자동으로 누끼+칼선을 따드려요.',
        ja: '<b>カット方式</b>を選びます。<br>• <b>四角カット</b> — 四角に裁断 <b>(+1,000ウォン)</b><br>• <b>型抜きカット</b> — 絵の輪郭通りにカット <b>(+3,000ウォン)</b>。型抜きなら後で自動で背景除去+カットライン。',
        en: 'Choose the <b>cut type</b>.<br>• <b>Square cut</b> — rectangular <b>(+₩1,000)</b><br>• <b>Shape cut</b> — to the artwork outline <b>(+₩3,000)</b>; auto bg-removal + cutline later.' },
      cheer: { kr: '커팅 방식 결정! ✂️', ja: 'カット方式OK! ✂️', en: 'Cut type set! ✂️' }
    },
    { // 3) 사이즈 (있는 제품만 — 없으면 자동 스킵)
      target: ['#soCustomSizeSection', '#soStickerSizeWrap'], mode: 'next',
      onEnter: function () { return _secVisible('#soCustomSizeSection') || _secVisible('#soStickerSizeWrap'); },
      msg: { kr: '<b>사이즈</b>를 정해요. 가격은 사이즈에 따라 자동 계산돼요.',
        ja: '<b>サイズ</b>を決めます。価格はサイズで自動計算されます。',
        en: 'Set the <b>size</b> — the price updates automatically.' },
      cheer: { kr: '사이즈 확인! 📏', ja: 'サイズOK! 📏', en: 'Size set! 📏' }
    },
    GENERIC_STEPS[0], // 4) 디자인 방법 (AI / 템플릿 / 파일 / 의뢰)
    { // 5) 누끼 + 칼선 (모양커팅 선택 시) — 사각커팅이면 그냥 다음
      target: '#meStage', mode: 'next',
      onEnter: function () { return _secVisible('#meStage'); },
      buttons: [
        { action: '_meAutoBgAndCutline', label: { kr: '✂️ 자동 배경제거 + 칼선 따기', ja: '✂️ 自動 背景除去＋カットライン', en: '✂️ Auto bg-removal + cutline' } }
      ],
      msg: { kr: '<b>모양커팅</b>을 고르셨다면 아래 <b>[자동 배경제거+칼선]</b> 버튼을 눌러요 — 그림 외곽을 따라 칼선을 자동으로 따드려요. 그 다음 <b>드래그·핸들</b>로 위치·크기를 조정하세요. <span style="color:#94a3b8;">(사각커팅이면 그냥 다음)</span>',
        ja: '<b>型抜きカット</b>を選んだ場合は下の <b>[自動 背景除去+カットライン]</b> を押します — 絵の輪郭に沿ってカットラインを自動作成。<b>ドラッグ·ハンドル</b> で位置·サイズを調整。<span style="color:#94a3b8;">(四角カットならそのまま次へ)</span>',
        en: 'If you chose <b>shape cut</b>, tap <b>[Auto bg-removal + cutline]</b> below — it traces the cutline along your artwork. Then <b>drag/handles</b> to adjust. <span style="color:#94a3b8;">(Square cut? Just tap Next)</span>' },
      hint: { kr: '사각커팅이면 그냥 다음을 눌러요', ja: '四角カットなら次へ', en: 'Square cut? Just tap Next' },
      cheer: { kr: '칼선 완성! ✂️', ja: 'カットラインOK! ✂️', en: 'Cutline done! ✂️' }
    },
    { // 6) 수량 (있으면)
      target: '#soQtySection', mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요! <span style="color:#94a3b8;">(칸에 직접 입력 가능)</span>',
        ja: '<b>数量</b>を決めます! <span style="color:#94a3b8;">(直接入力OK)</span>',
        en: 'Choose the <b>quantity</b>! <span style="color:#94a3b8;">(type it in)</span>' },
      cheer: { kr: '수량 확인! 🔢', ja: '数量OK! 🔢', en: 'Quantity set! 🔢' }
    },
    PROOF_STEP,       // 7) 시안 최종 확인
    GENERIC_STEPS[2]  // 8) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 아크릴 인쇄 family (acrl2*/acrl3*: 2T/3T/5T/8T/금경/은경 등)  2026-07-15
  //  종류선택 → 커팅·인쇄 방식(모양/사각 커팅, 전면/뒷면 인쇄) → 사이즈 → 디자인 →
  //  (모양커팅이면) 누끼+칼선 → 수량 → 시안 → 장바구니. window._soCurrentIsAcrylicPrint 로 판정.
  // ════════════════════════════════════════════════════════════════════
  function _tutIsAcrylicPrint() { try { return window._soCurrentIsAcrylicPrint === true; } catch (_) { return false; } }
  var ACRYLIC_STEPS = [
    { // 1) 아크릴 종류 선택 (카드) — 클릭 시 variant 리로드 → 다음 단계로 이어감
      target: ['#soAcrylicVariants', '#soAcrylicVariantsSec'], mode: 'next', resumeNext: true,
      onEnter: function () { return window._soCurrentIsAcrylicPrint === true; },
      msg: { kr: '먼저 <b>어떤 아크릴</b>을 만들지 골라요. 3T·5T·8T 두께, 금경·은경, 반투명 등 카드를 눌러 종류를 바꿀 수 있어요.',
        ja: 'まず <b>どのアクリル</b> を作るか選びます。3T·5T·8Tの厚み、金鏡·銀鏡、半透明など、カードをタップで切替。',
        en: 'First choose <b>which acrylic</b> to make. Tap a card to switch — 3T/5T/8T thickness, gold/silver mirror, translucent…' },
      cheer: { kr: '종류 선택! 🪟', ja: '種類OK! 🪟', en: 'Type set! 🪟' }
    },
    { // 2) 커팅·인쇄 방식 (추가옵션: 모양커팅/사각커팅, 전면/뒷면 인쇄)
      target: '#soAddonSection', mode: 'next',
      onEnter: function () { return _secVisible('#soAddonSection'); },
      msg: { kr: '<b>커팅·인쇄 방식</b>을 골라요.<br>• <b>사각커팅 / 모양커팅</b> — 네모로 재단할지, 그림 외곽 그대로 딸지<br>• <b>전면 인쇄 / 뒷면 인쇄</b> — 인쇄 면을 선택해요. 모양커팅이면 뒤에서 자동으로 누끼+칼선을 따드려요.',
        ja: '<b>カット·印刷方式</b>を選びます。<br>• <b>四角カット / 型抜きカット</b> — 四角に裁断か、絵の輪郭通りか<br>• <b>前面印刷 / 裏面印刷</b> — 印刷面を選択。型抜きなら後で自動で背景除去+カットライン。',
        en: 'Choose the <b>cut & print method</b>.<br>• <b>Square / shape cut</b> — rectangular vs. to the artwork outline<br>• <b>Front / back print</b> — pick the print side. Shape cut auto bg-removal + cutline later.' },
      cheer: { kr: '방식 결정! ✂️', ja: '方式OK! ✂️', en: 'Method set! ✂️' }
    },
    { // 3) 컬러칩 색상 선택 (반투명아크릴 등 — 있으면. 없으면 자동 스킵)
      target: ['#soAcrylicColorGrid', '#soAcrylicColorSection'], mode: 'next',
      onEnter: function () { return _secVisible('#soAcrylicColorSection'); },
      msg: { kr: '<b>컬러칩 색상</b>을 골라요. 원하시는 아크릴 색상을 눌러 선택해 주세요 (블랙·클리어·아이보리 등).',
        ja: '<b>カラーチップの色</b>を選びます。ご希望のアクリル色をタップしてください（ブラック·クリア·アイボリーなど）。',
        en: 'Choose the <b>color chip</b>. Tap the acrylic color you want (black, clear, ivory, etc.).' },
      cheer: { kr: '색상 선택! 🎨', ja: '色OK! 🎨', en: 'Color set! 🎨' }
    },
    { // 4) 사이즈 (객체 크기 — 있으면)
      target: ['#soCustomSizeSection', '#soStickerSizeWrap'], mode: 'next',
      onEnter: function () { return _secVisible('#soCustomSizeSection') || _secVisible('#soStickerSizeWrap'); },
      msg: { kr: '<b>사이즈</b>를 정해요. 가격은 사이즈(면적)에 따라 자동 계산돼요.',
        ja: '<b>サイズ</b>を決めます。価格はサイズ(面積)で自動計算されます。',
        en: 'Set the <b>size</b> — the price is calculated automatically from it.' },
      cheer: { kr: '사이즈 확인! 📏', ja: 'サイズOK! 📏', en: 'Size set! 📏' }
    },
    GENERIC_STEPS[0], // 5) 디자인 방법
    { // 5) 누끼 + 칼선 (모양커팅 선택 시) — 사각커팅이면 그냥 다음
      target: '#meStage', mode: 'next',
      onEnter: function () { return _secVisible('#meStage'); },
      buttons: [
        { action: '_meAutoBgAndCutline', label: { kr: '✂️ 자동 배경제거 + 칼선 따기', ja: '✂️ 自動 背景除去＋カットライン', en: '✂️ Auto bg-removal + cutline' } }
      ],
      msg: { kr: '<b>모양커팅</b>을 고르셨다면 아래 <b>[자동 배경제거+칼선]</b> 버튼을 눌러요 — 그림 외곽을 따라 칼선을 자동으로 따드려요. 그 다음 <b>드래그·핸들</b>로 위치·크기를 조정하세요. <span style="color:#94a3b8;">(사각커팅이면 그냥 다음)</span>',
        ja: '<b>型抜きカット</b>を選んだ場合は下の <b>[自動 背景除去+カットライン]</b> を押します — 絵の輪郭に沿ってカットラインを自動作成。<b>ドラッグ·ハンドル</b> で調整。<span style="color:#94a3b8;">(四角カットならそのまま次へ)</span>',
        en: 'If you chose <b>shape cut</b>, tap <b>[Auto bg-removal + cutline]</b> below — it traces the cutline along your artwork. Then <b>drag/handles</b> to adjust. <span style="color:#94a3b8;">(Square cut? Just tap Next)</span>' },
      hint: { kr: '사각커팅이면 그냥 다음을 눌러요', ja: '四角カットなら次へ', en: 'Square cut? Just tap Next' },
      cheer: { kr: '칼선 완성! ✂️', ja: 'カットラインOK! ✂️', en: 'Cutline done! ✂️' }
    },
    { // 6) 수량
      target: '#soQtySection', mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>수량</b>을 정해요! <span style="color:#94a3b8;">(칸에 직접 입력 가능)</span>',
        ja: '<b>数量</b>を決めます! <span style="color:#94a3b8;">(直接入力OK)</span>',
        en: 'Choose the <b>quantity</b>! <span style="color:#94a3b8;">(type it in)</span>' },
      cheer: { kr: '수량 확인! 🔢', ja: '数量OK! 🔢', en: 'Quantity set! 🔢' }
    },
    PROOF_STEP,       // 7) 시안 최종 확인
    GENERIC_STEPS[2]  // 8) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 허니콤 포토존/조형물 (나무조형물·동화책 포토존·큐브·룰렛)  2026-07-15
  //  종류선택 → 칼선 다운받기 → 디자인(업로드/의뢰) → 시공/배송 → 시안 → 장바구니.
  //  칼선 도안을 받아 그에 맞춰 작업 후 업로드하거나 의뢰하는 제품.
  //  예외) 나무조형물 소형/대형(45245252·345353)은 기성품 — 디자인·칼선·시안 단계 스킵,
  //        종류선택 후 바로 시공/배송 → 장바구니. window._soPzReadyMade 로 판정.
  // ════════════════════════════════════════════════════════════════════
  function _tutIsPhotozone() { try { return window._soCurrentIsPhotozone === true; } catch (_) { return false; } }
  function _pzNotReadyMade() { try { return window._soPzReadyMade !== true; } catch (_) { return true; } }
  var PHOTOZONE_STEPS = [
    { // 1) 종류 선택 (카드) — 클릭 시 variant 리로드 → 다음 단계로 이어감
      target: ['#soPhotozoneVariants', '#soPhotozoneVariantsSec'], mode: 'next', resumeNext: true,
      onEnter: function () { return window._soCurrentIsPhotozone === true; },
      msg: { kr: '먼저 <b>어떤 조형물/포토존</b>을 만들지 골라요. 나무조형물·동화책 포토존·회전 큐브·룰렛 등 카드를 눌러 종류를 바꿀 수 있어요.',
        ja: 'まず <b>どの造形物/フォトゾーン</b> を作るか選びます。ツリー造形·絵本フォトゾーン·回転キューブ·ルーレットなど、カードをタップで切替。',
        en: 'First choose <b>which sculpture/photo-zone</b> to make. Tap a card to switch — tree sculpture, storybook photo-zone, spinning cube, roulette…' },
      cheer: { kr: '종류 선택! 🌳', ja: '種類OK! 🌳', en: 'Type set! 🌳' }
    },
    { // 2) 칼선 다운받기 (기성품 나무조형물이면 스킵)
      target: ['#soCutlineDownloadBtn', '#soCutlineDownload'], mode: 'next',
      onEnter: function () { return _pzNotReadyMade() && _secVisible('#soCutlineDownload'); },
      msg: { kr: '먼저 <b>칼선 도안을 다운받아</b> 주세요. 이 도안(칼선 규격)에 <b>맞춰 디자인</b>한 뒤, 다음 단계에서 완성 파일을 올리거나 의뢰하면 돼요.',
        ja: 'まず <b>型抜きテンプレートをダウンロード</b> してください。この規格に <b>合わせてデザイン</b> し、次のステップで完成ファイルをアップまたは依頼します。',
        en: 'First <b>download the die-cut template</b>. Design <b>to fit this template</b>, then upload the finished file or request a design in the next step.' },
      cheer: { kr: '도안 받기! 📐', ja: 'テンプレOK! 📐', en: 'Got it! 📐' }
    },
    Object.assign({}, GENERIC_STEPS[0], { // 3) 디자인 방법 (업로드/의뢰 중심) — 기성품이면 스킵
      onEnter: function () { return _pzNotReadyMade(); },
      msg: { kr: '받은 <b>칼선 도안에 맞춰 디자인</b>한 뒤 <b>파일 업로드</b>로 올리거나, 직접 하기 어려우면 <b>디자인 의뢰</b>를 맡겨주세요.',
        ja: '<b>型抜きテンプレートに合わせてデザイン</b> し <b>ファイルアップロード</b>、または <b>デザイン依頼</b> をお任せください。',
        en: 'Design <b>to fit the die-cut template</b>, then <b>upload the file</b> — or <b>request a design</b> if it\'s tricky to do yourself.' }
    }),
    { // 4) 시공/배송 옵션 (배송 위치·날짜)
      target: '#soScheduleSection', mode: 'next',
      onEnter: function () { return _secVisible('#soScheduleSection'); },
      msg: { kr: '<b>배송·설치</b>를 골라요. 수도권 무료배송/설치 또는 지방배송 등 위치를 정하고, 아래에서 <b>배송 희망일</b>도 선택할 수 있어요.',
        ja: '<b>配送·設置</b>を選びます。首都圏 送料·設置無料 または 地方配送 など場所を決め、下で <b>配送希望日</b> も選べます。',
        en: 'Choose <b>delivery/installation</b> — metro free delivery/install or regional, and pick your <b>preferred date</b> below.' },
      cheer: { kr: '배송 선택! 🚚', ja: '配送OK! 🚚', en: 'Delivery set! 🚚' }
    },
    Object.assign({}, PROOF_STEP, { // 5) 시안 최종 확인 — 기성품이면 스킵
      onEnter: function () { return _pzNotReadyMade() && (_secVisible('#meStage') || _secVisible('#embeddedEditorPreview')); }
    }),
    GENERIC_STEPS[2]  // 6) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 — 종이매대 (pd_* : 원터치 종이매대·소형·칸막이 등)  2026-07-15
  //  칼선 다운받기 → 파일 업로드(칼선에 맞춰 작업) → 시공/배송 → 주문 수량 → 시안 → 장바구니.
  //  종류 카드가 없는 단일 제품군 — window._soCurrentIsPaperDisplay 로 판정.
  // ════════════════════════════════════════════════════════════════════
  // 2026-07-18: 목업 뷰어 제품군 — 종이매대 + 허니콤 테이블(hb_tb_*). 둘 다 같은 시나리오를 쓴다.
  function _tutIsPaperDisplay() {
    try { return window._soCurrentIsPaperDisplay === true || window._soCurrentIsHbTable === true; } catch (_) { return false; }
  }
  // 2026-07-18: 목업 뷰어 제품군(종이매대 + 허니콤 테이블) 디자인 방법 3분기.
  //   이 제품군은 대지에 그린 게 곧 인쇄물이 아니라 "컨셉 목업"이고, 실제 인쇄 디자인은
  //   디자이너가 목업을 참고해 따로 제작한다 → 분기를 AI 무료디자인 / 칼선 / 의뢰 셋으로 단순화.
  var MOCKUP_DESIGN_CHOOSE_STEP = {
    msg: { kr: '주문을 도와드릴게요! 먼저 <b>디자인 방법</b>을 골라주세요.',
      ja: 'ご注文をお手伝いします!まず <b>デザイン方法</b> をお選びください。',
      en: "I'll help you order! First, choose <b>how to design</b>." },
    branch: [
      { key: 'ai', mode: 'free', template: 'pd-input', target: ['#soPaperDisplayRequest', '.me-intro-ai'],
        label: { kr: '인공지능 무료디자인', ja: 'AI無料デザイン', en: 'Free AI design' },
        sub: { kr: '이벤트 기간 무료 · 브랜드만 적으면 끝', ja: 'イベント期間中は無料 · ブランドを書くだけ', en: 'Free during the event — just enter your brand' },
        msg: { kr: '먼저 <b>반짝이는 칸</b>에 내용을 적어주세요! <b>브랜드명·타이틀</b>은 필수, 제품·컨셉은 선택이에요. 다 적으셨으면 왼쪽 <b>[AI디자인 실행]</b>을 눌러주세요 — 이 제품 모양 그대로 <b>목업</b>을 만들어드려요. 마음에 들 때까지 다시 만들 수 있고, 글씨·요소를 더해 꾸며도 좋아요. 다 되면 아래 <b>「디자인 끝나고 다음 진행하기」</b>를 눌러주세요!',
          ja: 'まず <b>光っている入力欄</b> に内容をご記入ください!<b>ブランド名·タイトル</b> は必須、製品·コンセプトは任意です。書けたら左の <b>[AIデザイン実行]</b> を押してください — この製品の形のまま <b>モックアップ</b> を作成します。気に入るまで作り直せますし、文字·要素を足して飾ってもOK。完成したら下の <b>「デザイン完了 → 次へ」</b> を!',
          en: 'First fill in the <b>glowing box</b>! <b>Brand / title</b> is required; products and concept are optional. Then tap <b>[Run AI Design]</b> on the left — we\'ll build a <b>mockup</b> in this product\'s exact shape. Regenerate as often as you like, and add text or elements too. When done, tap <b>"Done → Continue"</b> below!' }
      },
      // mode 미지정 → renderDetail (안내 팝업 + 스포트라이트 + 다음). 칼선 버튼이 없는 제품이면
      // renderBranch 의 target 가시성 필터가 이 선택지를 자동으로 빼준다.
      { key: 'cutline', target: ['#soCutlineDownloadBtn', '#soCutlineDownload'],
        label: { kr: '칼선 다운로드', ja: 'カットラインDL', en: 'Download cutline' },
        sub: { kr: '직접 인쇄용 파일을 만들래요', ja: '自分で印刷用ファイルを作る', en: "I'll make the print file myself" },
        msg: { kr: '가장 많이 쓰는 <b>기본 규격 칼선</b>을 다운받아 그 규격에 맞춰 작업할 수 있어요. 만약 <b>별도 규격이나 선반 갯수</b>가 필요하다면 본사담당자 <b>031-366-1984</b>로 전화해 칼선을 요청하신 뒤 작업해 주세요. 완성한 파일은 <b>파일 업로드</b>로 올려주시면 됩니다.',
          ja: '最もよく使う <b>基本規格のカットライン</b> をダウンロードして、その規格に合わせて作業できます。<b>別途の規格や棚の数</b> が必要な場合は、担当のナナミ <b>090-5397-0420</b> へお電話でカットラインをご依頼のうえ作業してください。完成したファイルは <b>ファイルアップロード</b> から。',
          en: 'Download the <b>most-used standard-size cutline</b> and design to fit it. If you need a <b>custom size or a different number of shelves</b>, please call our HQ manager at <b>+82 31-366-1984</b> to request one first. Upload your finished file with <b>Upload file</b>.' },
        cheer: { kr: '도안 받기! 📐', ja: 'テンプレOK! 📐', en: 'Got it! 📐' }
      },
      { key: 'request', mode: 'request', target: '#soDesignReqBanner',
        label: { kr: '디자인 의뢰하기', ja: 'デザインを依頼', en: 'Request a design' },
        sub: { kr: '전문 디자이너에게 맡겨요', ja: 'プロのデザイナーに任せる', en: 'Leave it to a pro' },
        msg: { kr: '전문가에게 맡겨요! <b>디자인 의뢰</b>를 작성하고 등록하면, 이어서 다음 단계로 안내해 드릴게요 ✏️',
          ja: 'プロにお任せ! <b>デザイン依頼</b> を作成·登録すると、続けて次のステップをご案内します ✏️',
          en: 'Leave it to a pro! Fill out and submit the <b>design request</b>, and I\'ll continue to the next step ✏️' }
      }
    ]
  };

  // 2026-07-18: 장바구니 직전 안내 — 이 제품군은 목업이 최종 인쇄물이 아니라는 점을 분명히 알린다.
  var MOCKUP_HANDOFF_STEP = {
    target: '#soBtnCart', mode: 'next',
    msg: { kr: '잠깐만요! 이런 <b>목업 작업 후 디자인을 별개로 해야 하는 경우</b>, 디자이너가 <b>해당 이미지를 참고하여 새롭게 디자인</b>해서 고객님과 소통합니다. <b>결제 후 기다려 주시면 고객님께 연락</b>을 드립니다.<br>현재 <b style="color:#16a34a;">인공지능 컨셉의 리디자인은 이벤트 기간으로 무료</b>로 이용이 가능합니다 🎁',
      ja: 'ちょっとだけ! このように <b>モックアップの後にデザインを別途行う場合</b>、デザイナーが <b>その画像を参考に新しくデザイン</b> し、お客様とやり取りします。<b>お支払い後お待ちいただければ、こちらからご連絡</b> いたします。<br>現在 <b style="color:#16a34a;">AIコンセプトのリデザインはイベント期間につき無料</b> でご利用いただけます 🎁',
      en: 'One moment! When a <b>mockup like this needs a separate print design</b>, our designer <b>creates a new design referring to your image</b> and works with you directly. <b>After payment, just sit tight — we\'ll contact you.</b><br>Right now the <b style="color:#16a34a;">AI-concept redesign is free during our event period</b> 🎁' },
    cheer: { kr: '확인! 🤝', ja: '確認! 🤝', en: 'Got it! 🤝' }
  };

  // 2026-07-19: 허니콤 박스 — AI 가 목업을 "입력한 치수 비율" 로 그리므로 사이즈를 반드시 먼저 받는다.
  //   (디자인 방법 선택보다 앞에 와야 함 — 사이즈 없이 생성하면 엉뚱한 비율의 박스가 나온다.)
  var BOX_SIZE_STEP = {
    target: '#soBoxSizeSection', mode: 'next', resumeNext: true,
    onEnter: function () { return _secVisible('#soBoxSizeSection'); },
    msg: { kr: '먼저 <b>박스 사이즈</b>부터 정해요! <b>가로(W) · 높이(H) · 깊이(D)</b> 를 mm 로 입력해주세요. 이 치수로 단가가 계산되고, <b>인공지능도 이 비율 그대로</b> 목업을 그려줘요. 다 넣었으면 <b>다음</b>을 눌러주세요.',
      ja: 'まず <b>ボックスサイズ</b> から!<b>幅(W)·高さ(H)·奥行(D)</b> を mm で入力してください。この寸法で単価が決まり、<b>AIもこの比率のまま</b> モックアップを描きます。入力できたら <b>次へ</b> を押してください。',
      en: 'Start with the <b>box size</b>! Enter <b>width, height and depth</b> in mm. Pricing is based on these, and <b>the AI draws the mockup at exactly these proportions</b>. Then tap <b>Next</b>.' },
    cheer: { kr: '사이즈 확정! 📦', ja: 'サイズOK! 📦', en: 'Size set! 📦' }
  };

  var PAPER_DISPLAY_STEPS = [
    MOCKUP_DESIGN_CHOOSE_STEP,   // 1) 디자인 방법 (AI 무료디자인 / 칼선 다운로드 / 디자인 의뢰)
    { // 3) 시공/배송 옵션
      target: '#soScheduleSection', mode: 'next',
      onEnter: function () { return _secVisible('#soScheduleSection'); },
      msg: { kr: '<b>배송 방식</b>을 골라요. 1개씩/2개씩 택배포장 또는 <b>100개 이상 벌크포장 무료</b> 등에서 선택할 수 있어요.',
        ja: '<b>配送方式</b>を選びます。1個ずつ/2個ずつ宅配、または <b>100個以上バルク梱包 無料</b> などから。',
        en: 'Choose the <b>delivery method</b> — parcel (1 or 2 per box) or <b>free bulk packing over 100 pcs</b>.' },
      cheer: { kr: '배송 선택! 🚚', ja: '配送OK! 🚚', en: 'Delivery set! 🚚' }
    },
    { // 4) 주문 수량 (100개 최소수량 등)
      target: '#soQtySection', mode: 'next',
      onEnter: function () { return _secVisible('#soQtySection'); },
      msg: { kr: '<b>주문 수량</b>을 정해요. 샘플 1개, 100개(최소수량), 300·500·1,000개 또는 직접 입력(2~99)도 가능해요. 많이 만들수록 개당 단가가 내려가요 💰',
        ja: '<b>注文数量</b>を決めます。サンプル1個、100個(最小)、300·500·1,000個、または直接入力(2〜99)も可。たくさん作るほどお得 💰',
        en: 'Set the <b>quantity</b> — sample 1, 100 (min), 300/500/1,000, or type 2–99. More = lower unit price 💰' },
      cheer: { kr: '수량 확인! 🔢', ja: '数量OK! 🔢', en: 'Quantity set! 🔢' }
    },
    PROOF_STEP,           // 5) 시안 최종 확인
    MOCKUP_HANDOFF_STEP,  // 6) 목업 → 디자이너 리디자인 안내 (장바구니 직전)
    GENERIC_STEPS[2]      // 7) 장바구니
  ];

  // ════════════════════════════════════════════════════════════════════
  //  공통 '종류 먼저 고르기' 스텝 — 종류 카드 그리드가 있는 모든 제품(봉투/실사출력/
  //  탁상/인스타판넬/포토존/거치대 등)이 size-product·generic 시나리오로 빠질 때, 맨 앞에
  //  이 스텝을 붙여 '제품(종류) 먼저 → 위에서부터 순서대로' 흐름을 보장. 카드 없으면 자동 스킵.
  // ════════════════════════════════════════════════════════════════════
  var _ALL_VARIANT_SELS = [
    '#soAcrylicVariants', '#soVinylVariants', '#soScarciVariants', '#soEnvelopeVariants',
    '#soSheetVariants', '#soBannerVariants', '#soPlacardVariants', '#soRealVariants',
    '#soInstaVariants', '#soTableVariants', '#soPhotozoneVariants', '#soBannerStandVariants',
    '#soAcrylicVariantsSec', '#soVinylVariantsSec', '#soEnvelopeVariantsSec', '#soRealVariantsSec',
    '#soInstaVariantsSec', '#soTableVariantsSec', '#soPhotozoneVariantsSec', '#soBannerStandVariantsSec'
  ];
  function _tutAnyVariantVisible() { try { return _ALL_VARIANT_SELS.some(function (s) { return _secVisible(s); }); } catch (_) { return false; } }
  var CHOOSE_VARIANT_STEP = {
    target: _ALL_VARIANT_SELS, mode: 'next', resumeNext: true,
    onEnter: function () { return _tutAnyVariantVisible(); },
    msg: { kr: '먼저 <b>어떤 종류</b>를 만들지 골라요. 위 카드를 눌러 종류를 바꿀 수 있어요. 정했으면 <b>다음</b>을 눌러 위에서부터 하나씩 옵션을 골라봐요.',
      ja: 'まず <b>どの種類</b> を作るか選びます。上のカードをタップで切替。決まったら <b>次へ</b> を押して、上から順にオプションを選びましょう。',
      en: 'First choose <b>which type</b> to make — tap a card above to switch. Then tap <b>Next</b> and pick the options top to bottom.' },
    cheer: { kr: '종류 선택! ✨', ja: '種類OK! ✨', en: 'Type set! ✨' }
  };

  var SCENARIOS = [
    { id: 'bizcard', match: /^pp_bc/i, steps: BIZCARD_STEPS },
    // 2026-07-15: 글씨 스카시 — 종류·문구·참고자료·배송 전용 스텝. honeycomb/size-product 보다 앞.
    { id: 'scarci', match: { test: function () { return _tutIsScarci(); } }, steps: SCARCI_STEPS },
    // 2026-07-15: 아크릴 인쇄 — 종류·커팅/인쇄방식·사이즈·디자인·누끼칼선. size-product 보다 앞.
    { id: 'acrylic', match: { test: function () { return _tutIsAcrylicPrint(); } }, steps: ACRYLIC_STEPS },
    // 2026-07-15: 시트지(vinyl) — 종류·커팅방식·디자인·누끼칼선 전용 스텝. size-product 보다 앞.
    { id: 'vinyl', match: { test: function () { return _tutIsVinyl(); } }, steps: VINYL_STEPS },
    // 2026-07-15: 허니콤 포토존/조형물 — 종류·칼선다운·디자인·배송. 나무조형물 2종은 기성품(디자인 스킵). generic 보다 앞.
    { id: 'photozone', match: { test: function () { return _tutIsPhotozone(); } }, steps: PHOTOZONE_STEPS },
    // 2026-07-15: 종이매대 — 칼선다운→파일업로드→배송→수량. size-product/generic 보다 앞.
    // 2026-07-18: 맨 앞에 '종류 먼저 고르기' — 허니콤 테이블 4종 카드에서 종류부터 선택.
    //   종류 카드가 없는 종이매대는 CHOOSE_VARIANT_STEP 의 onEnter 가 false 라 자동 스킵된다.
    //   (CHOOSE_VARIANT_STEP 이 PAPER_DISPLAY_STEPS 보다 아래에 정의돼 있어 여기서 concat)
    { id: 'paper-display', match: { test: function () { return _tutIsPaperDisplay(); } }, steps: [CHOOSE_VARIANT_STEP].concat(PAPER_DISPLAY_STEPS) },
    // 2026-07-19: 허니콤 박스 — 매대/테이블과 같은 목업 흐름이되, 사이즈 입력을 맨 앞에.
    //   honeycomb 계열 시나리오보다 앞에 둬야 이쪽이 매치된다.
    { id: 'hb-box', match: /^hb_bx/i, steps: [BOX_SIZE_STEP].concat(PAPER_DISPLAY_STEPS) },
    // 2026-07-14: 아크릴 키링/코롯토 — 모양·면·사이즈·포장·고리·업로드·누끼칼선. generic 보다 앞.
    { id: 'keyring', match: { test: function () { return _tutIsKeyring(); } }, steps: KEYRING_STEPS },
    // 2026-07-14: 스티커(일반/팬시 공통) — 종류 선택 챕터 먼저. size-product/fancy 보다 앞.
    { id: 'sticker', match: { test: function () { return _tutIsStickerProduct(); } }, steps: [STICKER_CHOOSE_STEP] },
    // 2026-07-14: 낱장 인쇄(리플렛) — 사이즈·인쇄면·용지·박·후가공 전용 스텝. generic 보다 앞.
    { id: 'leaflet', match: { test: function () { return _tutIsLeaflet(); } }, steps: LEAFLET_STEPS },
    // 2026-07-14: 현수막(placard) — 종류·사이즈·마감·수량 전용 스텝. size-product 보다 앞.
    { id: 'placard', match: { test: function () { return _tutIsPlacard(); } }, steps: PLACARD_STEPS },
    { id: 'honeycomb-wall', match: /^hb_dw/i, steps: HONEYCOMB_WALL_STEPS },
    { id: 'honeycomb-banner', match: /^hb_bn/i, steps: HONEYCOMB_BANNER_STEPS },
    { id: 'standee', match: /^hb_pt/i, steps: STANDEE_STEPS },
    // 2026-07-14: 사이즈 지정 제품(스티커/실사출력/현수막/광고인쇄 등) — 우측 사이즈·옵션 먼저, 그다음 디자인 방법.
    //   match 는 코드 대신 우측 사이즈 섹션 노출 여부로 판정(그 외엔 generic). 반드시 generic 앞.
    //   2026-07-15: 맨 앞에 공통 '종류 먼저 고르기' 스텝 — 종류 카드 있는 제품(봉투/실사출력/탁상 등)은 제품부터, 없으면 자동 스킵.
    { id: 'size-product', match: { test: function () { return _tutIsSizeProduct(); } }, steps: [CHOOSE_VARIANT_STEP].concat(SIZE_PRODUCT_STEPS) },
    // catch-all — 위 전용 시나리오에 안 걸리는 모든 제품. 반드시 마지막.
    //   2026-07-14: 장바구니 직전 시안확인(PROOF_STEP) 삽입 (GENERIC_STEPS 배열은 그대로 두고 조합).
    //   2026-07-15: 맨 앞에 공통 '종류 먼저 고르기' 스텝 (종류 카드 없으면 자동 스킵).
    { id: 'generic', match: /.*/, steps: [CHOOSE_VARIANT_STEP, GENERIC_STEPS[0], GENERIC_STEPS[1], PROOF_STEP, GENERIC_STEPS[2]] }
  ];
  function pickScenario(code) {
    if (!code) return null;
    for (var i = 0; i < SCENARIOS.length; i++) {
      try { if (SCENARIOS[i].match.test(code)) return SCENARIOS[i]; } catch (_) {}
    }
    return null;
  }

  var _lastScn = null;
  var _curCode = '';   // 2026-07-14: 현재 튜토리얼 대상 제품 코드 (종류 선택 이어가기 판정용)
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
      _curCode = code;
      _lang = detectLang();
      ensureStyles();
      mountReplay(scn);
      // 2026-07-14: 종류 선택(resumeNext 단계)에서 다른 제품(카드)으로 넘어온 경우 —
      //   '주문이 처음이신가요?' 모드선택/처음부터 대신, 새 제품의 종류선택 단계 '다음'부터 이어감.
      try {
        var _rawP = sessionStorage.getItem('__tut_progress');
        if (_rawP) {
          var _st = JSON.parse(_rawP);
          var _fresh = _st && ((Date.now() - (_st.ts || 0)) < 30000);
          // 2026-07-14: variantReload(종류 카드 클릭)면 같은 코드로 리로드돼도 이어감 (초저가 '현재' 카드 재클릭 등).
          if (_fresh && _st.resumeNext && (_st.variantReload || (_st.code && _st.code !== code))) {
            sessionStorage.removeItem('__tut_progress');
            var _startIdx = 0;
            for (var _k = 0; _k < scn.steps.length; _k++) { if (scn.steps[_k] && scn.steps[_k].resumeNext) { _startIdx = _k + 1; break; } }
            run(scn.steps, _startIdx);
            return;
          }
        }
      } catch (_re) {}
      showChooser(scn);
    } catch (e) { console.warn('[tut] _tutMaybeStart', e); }
  };

  // 2026-07-14: 종류 카드 등 variant 선택으로 리로드되기 직전 호출 — 튜토리얼이 진행 중(또는 모드선택 창이 떠 있으면)이면
  //   resumeNext 진행상태를 저장해, 리로드 후 '주문이 처음이신가요?'로 재시작하지 않고 다음 챕터(사이즈)로 이어가게 함.
  window._tutBeforeVariantReload = function () {
    try {
      if (!_active && !_choice) return;   // 튜토리얼 미진행이면 무시 (일반 사용자는 그대로 리로드)
      if (!modalOpen()) return;           // 2026-07-15: 모달이 열려있는 재초기화(=종류 전환)일 때만. 신규 오픈 오판 방지.
      sessionStorage.setItem('__tut_progress', JSON.stringify({ code: _curCode || '', i: 0, resumeNext: true, variantReload: true, ts: Date.now() }));
    } catch (_) {}
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
