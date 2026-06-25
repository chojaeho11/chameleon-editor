/* ════════════════════════════════════════════════════════════════════════
   product-tutorial.js — 게임형 제품 주문 튜토리얼 엔진 (재사용)
   ────────────────────────────────────────────────────────────────────────
   2026-06-25: 명함(pp_bc_*) 1차. 주문 모달이 열리면 모드 선택 창(튜토리얼/일반).
     튜토리얼 모드 = 귀여운 안내요정이 옵션을 스포트라이트하며 단계별 안내 + 칭찬.
   설계: 순수 추가형 오버레이. 기존 가격/state 로직은 절대 건드리지 않고,
     기존 버튼/섹션을 하이라이트하고 클릭을 위임만 한다 (가격 회귀 0).
   확장: 신규 제품 = SCENARIOS 배열에 {id, match, steps} 1개 추가하면 끝.
   진입점: window._tutMaybeStart(product)  ← simple_order.js openSimpleOrderModal 끝에서 호출.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._tutMaybeStart) return; // 중복 로드 방지

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
  function T(o) { // {kr,ja,en} 또는 문자열 → 현재 언어 문자열
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return tr(o.kr, o.ja, o.en);
  }

  // ── 엔진 상태 ──────────────────────────────────────────────────────────
  var _active = false;          // 단계 진행 중
  var _steps = null, _idx = -1;
  var _targets = [];            // 현재 단계 타깃 요소들
  var _stepCleanup = [];        // 단계 이탈 시 호출
  var _looping = false;
  var _scn = null;

  // ── DOM refs (한 번 생성) ─────────────────────────────────────────────
  var _root, _blocker, _hole, _pop;

  function ensureStyles() {
    if (document.getElementById('tut-styles')) { ensureDom(); return; }
    var css = ''
      + '#tut-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;'
      + "font-family:'Pretendard',-apple-system,system-ui,'Apple SD Gothic Neo',sans-serif;}"
      + '#tut-blocker{position:fixed;inset:0;background:rgba(15,23,42,0.62);pointer-events:auto;display:none;}'
      + '#tut-hole{position:fixed;display:none;border-radius:14px;pointer-events:none;'
      + 'box-shadow:0 0 0 4px rgba(129,140,248,0.95),0 0 0 9999px rgba(15,23,42,0.62);'
      + 'transition:left .28s cubic-bezier(.4,0,.2,1),top .28s cubic-bezier(.4,0,.2,1),width .28s cubic-bezier(.4,0,.2,1),height .28s cubic-bezier(.4,0,.2,1);}'
      + '#tut-hole::after{content:"";position:absolute;inset:-4px;border-radius:16px;'
      + 'box-shadow:0 0 0 3px rgba(129,140,248,0.55);animation:tutPulse 1.4s ease-in-out infinite;}'
      + '@keyframes tutPulse{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.8;transform:scale(1.015)}}'
      + '.tut-pop{position:fixed;pointer-events:auto;width:min(320px,calc(100vw - 28px));'
      + 'background:#fff;border-radius:18px;padding:16px 16px 14px;'
      + 'box-shadow:0 18px 50px -12px rgba(30,27,75,0.55),0 0 0 1px rgba(99,102,241,0.12);'
      + 'transition:left .28s cubic-bezier(.4,0,.2,1),top .28s cubic-bezier(.4,0,.2,1);animation:tutPopIn .3s cubic-bezier(.2,.8,.3,1);}'
      + '@keyframes tutPopIn{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1}}'
      + '.tut-pop.center{left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;}'
      + '.tut-fairy{width:46px;height:46px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;'
      + 'font-size:26px;background:linear-gradient(135deg,#a78bfa,#ec4899);box-shadow:0 6px 16px -4px rgba(167,139,250,0.6);animation:tutBob 2.2s ease-in-out infinite;}'
      + '@keyframes tutBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}'
      + '.tut-name{font-size:11px;font-weight:800;color:#7c3aed;letter-spacing:.02em;}'
      + '.tut-step{font-size:10.5px;font-weight:700;color:#94a3b8;}'
      + '.tut-msg{font-size:13.5px;line-height:1.62;color:#1e293b;font-weight:500;margin:10px 2px 12px;}'
      + '.tut-msg b{color:#6d28d9;font-weight:800;}'
      + '.tut-x{position:absolute;top:9px;right:11px;border:none;background:transparent;color:#cbd5e1;font-size:17px;cursor:pointer;line-height:1;padding:2px;font-family:inherit;}'
      + '.tut-x:hover{color:#64748b;}'
      + '.tut-actions{display:flex;align-items:center;gap:8px;}'
      + '.tut-btn{flex:1;border:none;border-radius:11px;padding:11px 12px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;transition:transform .08s,box-shadow .15s;}'
      + '.tut-btn:active{transform:scale(.97);}'
      + '.tut-btn-go{background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;box-shadow:0 8px 18px -6px rgba(124,58,237,0.6);}'
      + '.tut-btn-ghost{background:#f1f5f9;color:#475569;flex:none;padding:11px 14px;}'
      + '.tut-hint{display:inline-flex;align-items:center;gap:7px;background:#faf5ff;color:#7c3aed;'
      + 'border:1.5px dashed #d8b4fe;border-radius:11px;padding:9px 12px;font-size:12.5px;font-weight:800;width:100%;box-sizing:border-box;justify-content:center;}'
      + '.tut-hand{animation:tutPoint 1s ease-in-out infinite;}'
      + '@keyframes tutPoint{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}'
      + '.tut-skip{margin-top:9px;text-align:center;}'
      + '.tut-skip button{border:none;background:transparent;color:#94a3b8;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:underline;}'
      // 모드 선택 창
      + '.tut-choice{position:fixed;pointer-events:auto;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'width:min(360px,calc(100vw - 28px));background:#fff;border-radius:22px;padding:24px 22px 20px;text-align:center;'
      + 'box-shadow:0 24px 60px -12px rgba(30,27,75,0.6);animation:tutPopIn .32s cubic-bezier(.2,.8,.3,1);}'
      + '.tut-choice .tut-fairy{margin:0 auto 12px;width:64px;height:64px;font-size:36px;}'
      + '.tut-choice h3{margin:0 0 6px;font-size:19px;font-weight:900;color:#1e1b4b;}'
      + '.tut-choice p{margin:0 0 18px;font-size:13px;line-height:1.6;color:#64748b;}'
      + '.tut-choice .tut-cbtn{display:block;width:100%;border:none;border-radius:14px;padding:14px;margin-bottom:10px;'
      + 'cursor:pointer;font-family:inherit;text-align:center;transition:transform .08s,box-shadow .15s;}'
      + '.tut-choice .tut-cbtn:active{transform:scale(.98);}'
      + '.tut-cbtn-tut{background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;box-shadow:0 10px 22px -8px rgba(124,58,237,0.65);}'
      + '.tut-cbtn-tut .t1{font-size:16px;font-weight:900;}'
      + '.tut-cbtn-tut .t2{font-size:11.5px;font-weight:600;opacity:.92;margin-top:2px;}'
      + '.tut-cbtn-norm{background:#f1f5f9;color:#334155;}'
      + '.tut-cbtn-norm .t1{font-size:15px;font-weight:900;}'
      + '.tut-cbtn-norm .t2{font-size:11.5px;font-weight:600;opacity:.8;margin-top:2px;}'
      + '.tut-choice .tut-cb{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:4px;font-size:12px;color:#94a3b8;cursor:pointer;}'
      + '.tut-choice .tut-cb input{width:15px;height:15px;accent-color:#7c3aed;cursor:pointer;}'
      // 칭찬 토스트 + 색종이
      + '.tut-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);pointer-events:none;'
      + 'background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-size:17px;font-weight:900;'
      + 'padding:13px 26px;border-radius:999px;box-shadow:0 16px 40px -10px rgba(124,58,237,0.7);z-index:2147483600;'
      + 'animation:tutToast 1.15s cubic-bezier(.2,.8,.3,1) forwards;}'
      + '@keyframes tutToast{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}30%{transform:translate(-50%,-50%) scale(1)}78%{opacity:1}100%{opacity:0;transform:translate(-50%,-58%) scale(1)}}'
      + '.tut-confetti{position:fixed;top:0;left:0;pointer-events:none;z-index:2147483500;border-radius:2px;}'
      // 다시보기 버튼
      + '#tut-replay{position:fixed;left:14px;bottom:16px;z-index:50050;pointer-events:auto;'
      + 'border:none;border-radius:999px;padding:10px 15px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;'
      + 'background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;box-shadow:0 8px 20px -6px rgba(124,58,237,0.6);'
      + 'display:flex;align-items:center;gap:7px;}'
      + '@media(max-width:640px){#tut-replay{left:12px;bottom:84px;}}';
    var st = document.createElement('style');
    st.id = 'tut-styles';
    st.textContent = css;
    document.head.appendChild(st);
    ensureDom();
  }

  function ensureDom() {
    if (_root && document.body.contains(_root)) return;
    _root = document.createElement('div');
    _root.id = 'tut-root';
    _blocker = document.createElement('div');
    _blocker.id = 'tut-blocker';
    _hole = document.createElement('div');
    _hole.id = 'tut-hole';
    _pop = document.createElement('div');
    _pop.className = 'tut-pop';
    _pop.style.display = 'none';
    _root.appendChild(_blocker);
    _root.appendChild(_hole);
    _root.appendChild(_pop);
    document.body.appendChild(_root);
  }

  // ── 모달 상태 ──────────────────────────────────────────────────────────
  function modalOpen() {
    var m = document.getElementById('simpleOrderModal');
    return !!(m && m.classList.contains('open'));
  }

  // ── 타깃 해석 + 위치 계산 ─────────────────────────────────────────────
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
      l = Math.min(l, c.left); t = Math.min(t, c.top);
      r = Math.max(r, c.right); b = Math.max(b, c.bottom);
    });
    if (l === Infinity) return null;
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }

  function place() {
    if (!_active) return;
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
      var vw = window.innerWidth, vh = window.innerHeight;
      var top;
      if (vh - rect.bottom > popH + 22) top = rect.bottom + 16;
      else if (rect.top > popH + 22) top = rect.top - popH - 16;
      else top = Math.max(12, vh - popH - 12);
      var left = rect.left + rect.width / 2 - popW / 2;
      left = Math.max(12, Math.min(left, vw - popW - 12));
      _pop.style.left = left + 'px';
      _pop.style.top = top + 'px';
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
    d.textContent = T(txt);
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1200);
  }
  function confetti(big) {
    var colors = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#c084fc'];
    var n = big ? 90 : 38;
    var ox = window.innerWidth / 2, oy = window.innerHeight * (big ? 0.42 : 0.34);
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'tut-confetti';
      var sz = 6 + Math.floor(Math.random() * 9);
      d.style.width = sz + 'px';
      d.style.height = (sz * (0.5 + Math.random())) + 'px';
      d.style.background = colors[i % colors.length];
      d.style.left = ox + 'px';
      d.style.top = oy + 'px';
      document.body.appendChild(d);
      var ang = Math.random() * Math.PI * 2;
      var dist = (big ? 160 : 110) + Math.random() * (big ? 220 : 150);
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist + 120 + Math.random() * 160;
      var rot = (Math.random() * 720 - 360);
      (function (el) {
        try {
          el.animate(
            [
              { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
              { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0 }
            ],
            { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.15,.6,.3,1)' }
          ).onfinish = function () { el.remove(); };
        } catch (_) { setTimeout(function () { el.remove(); }, 1400); }
      })(d);
    }
  }
  function celebrate(cheer) {
    confetti(false);
    if (cheer) toast(cheer);
  }

  // ── 단계 렌더 ──────────────────────────────────────────────────────────
  function clearStep() {
    _stepCleanup.forEach(function (fn) { try { fn(); } catch (_) {} });
    _stepCleanup = [];
  }

  function renderPop(step) {
    var isWait = step.mode === 'wait';
    var total = _steps.length;
    var counter = (_idx + 1) + ' / ' + total;
    var btns;
    if (step.finale) {
      btns = '<div class="tut-actions"><button class="tut-btn tut-btn-go" data-act="quit">'
        + T({ kr: '닫기 🎉', ja: '閉じる 🎉', en: 'Close 🎉' }) + '</button></div>';
    } else if (isWait) {
      btns = '<div class="tut-hint"><span class="tut-hand">👆</span>'
        + T({ kr: '위에서 반짝이는 곳을 눌러주세요', ja: '上で光っている所をタップ', en: 'Tap the highlighted spot above' })
        + '</div><div class="tut-skip"><button data-act="next">'
        + T({ kr: '건너뛰기', ja: 'スキップ', en: 'Skip' }) + '</button></div>';
    } else {
      btns = '<div class="tut-actions"><button class="tut-btn tut-btn-go" data-act="next">'
        + T({ kr: '다음 ▶', ja: '次へ ▶', en: 'Next ▶' }) + '</button>'
        + '<button class="tut-btn tut-btn-ghost" data-act="quit">'
        + T({ kr: '그만', ja: '終了', en: 'Exit' }) + '</button></div>';
    }
    _pop.innerHTML =
      '<button class="tut-x" data-act="quit" aria-label="close">✕</button>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<div class="tut-fairy">🧚</div>'
      + '<div><div class="tut-name">' + T({ kr: '안내요정', ja: 'ご案内の妖精', en: 'Guide fairy' }) + '</div>'
      + '<div class="tut-step">' + counter + '</div></div></div>'
      + '<div class="tut-msg">' + T(step.msg) + '</div>'
      + btns;
    _pop.style.display = 'block';
    _pop.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (a === 'quit') quit();
        else if (a === 'next') showStep(_idx + 1);
      });
    });
  }

  function showStep(i) {
    clearStep();
    _idx = i;
    if (!_steps || i >= _steps.length) { finale(); return; }
    var step = _steps[i];
    if (step.onEnter) {
      var ok = true;
      try { ok = step.onEnter() !== false; } catch (_) { ok = true; }
      if (!ok) { showStep(i + 1); return; }
    }
    _targets = resolveTargets(step.target);
    // wait 인데 타깃이 없으면 진행 불가 → 스킵
    if (step.mode === 'wait' && !_targets.length) { showStep(i + 1); return; }

    if (_targets[0]) { try { _targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {} }

    _blocker.style.display = _targets.length ? 'none' : 'block';
    renderPop(step);

    if (step.mode === 'wait') {
      var onClick = function () { showStep(_idx + 1); celebrate(step.cheer); };
      _targets.forEach(function (t) {
        t.addEventListener('click', onClick, { once: true });
        _stepCleanup.push(function () { t.removeEventListener('click', onClick); });
      });
    }
    if (typeof step.hook === 'function') {
      try {
        var cl = step.hook(function (cheer) { showStep(_idx + 1); if (cheer) celebrate(cheer); });
        if (typeof cl === 'function') _stepCleanup.push(cl);
      } catch (_) {}
    }
    loop();
  }

  function finale() {
    clearStep();
    _targets = [];
    _blocker.style.display = 'block';
    _hole.style.display = 'none';
    var fstep = {
      finale: true,
      msg: { kr: '멋지게 잘했어요! ✨ 제 안내는 여기까지예요.<br>다음은 <b>장바구니 요정</b>이 안내해 드릴 거예요 🧚',
        ja: '見事にできました! ✨ 私のご案内はここまで。<br>次は<b>カートの妖精</b>がご案内します 🧚',
        en: 'Beautifully done! ✨ My part ends here.<br>The <b>cart fairy</b> guides you next 🧚' }
    };
    // finale 는 _steps 카운터가 필요 없도록 별도 렌더
    _pop.innerHTML =
      '<button class="tut-x" data-act="quit" aria-label="close">✕</button>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<div class="tut-fairy">🧚</div>'
      + '<div><div class="tut-name">' + T({ kr: '안내요정', ja: 'ご案内の妖精', en: 'Guide fairy' }) + '</div>'
      + '<div class="tut-step">' + T({ kr: '완료!', ja: '完了!', en: 'Done!' }) + '</div></div></div>'
      + '<div class="tut-msg">' + T(fstep.msg) + '</div>'
      + '<div class="tut-actions"><button class="tut-btn tut-btn-go" data-act="quit">'
      + T({ kr: '닫기 🎉', ja: '閉じる 🎉', en: 'Close 🎉' }) + '</button></div>';
    _pop.style.display = 'block';
    _pop.classList.add('center');
    _pop.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', quit);
    });
    confetti(true);
  }

  function quit() {
    clearStep();
    _active = false;
    _looping = false;
    _targets = [];
    if (_pop) { _pop.style.display = 'none'; _pop.classList.remove('center'); }
    if (_hole) _hole.style.display = 'none';
    if (_blocker) _blocker.style.display = 'none';
  }

  function run(steps) {
    closeChooser();
    ensureStyles();
    _steps = steps;
    _active = true;
    showStep(0);
  }

  // ── 모드 선택 창 ──────────────────────────────────────────────────────
  var _choice = null;
  function closeChooser() {
    if (_choice) { _choice.remove(); _choice = null; }
    if (!_active && _blocker) _blocker.style.display = 'none';
  }
  function showChooser(scn) {
    ensureStyles();
    closeChooser();
    _blocker.style.display = 'block';
    _choice = document.createElement('div');
    _choice.className = 'tut-choice';
    _choice.innerHTML =
      '<div class="tut-fairy">🧚</div>'
      + '<h3>' + T({ kr: '주문이 처음이신가요?', ja: '初めてのご注文ですか?', en: 'First time ordering?' }) + '</h3>'
      + '<p>' + T({ kr: '처음이라면 제가 옆에서 안내할게요.<br>안내대로 클릭만 하면 끝! 이리오세요 🙌',
        ja: '初めてなら私がご案内します。<br>クリックするだけで完了!こちらへどうぞ 🙌',
        en: "First time? I'll guide you step by step.<br>Just click along — that's it! Come this way 🙌" }) + '</p>'
      + '<button class="tut-cbtn tut-cbtn-tut" data-act="tut"><div class="t1">'
      + T({ kr: '🎮 튜토리얼 모드', ja: '🎮 チュートリアル', en: '🎮 Tutorial mode' }) + '</div><div class="t2">'
      + T({ kr: '안내대로 클릭만 하면 끝', ja: '案内通りクリックするだけ', en: 'Just follow the clicks' }) + '</div></button>'
      + '<button class="tut-cbtn tut-cbtn-norm" data-act="norm"><div class="t1">'
      + T({ kr: '⚡ 바로 주문 (일반)', ja: '⚡ そのまま注文', en: '⚡ Order directly' }) + '</div><div class="t2">'
      + T({ kr: '주문에 익숙해요', ja: '注文に慣れています', en: "I'm familiar with ordering" }) + '</div></button>'
      + '<label class="tut-cb"><input type="checkbox" id="tut-skip-cb">'
      + T({ kr: '다음부터 바로 주문', ja: '次回からそのまま注文', en: 'Skip this next time' }) + '</label>';
    _root.appendChild(_choice);
    _choice.querySelector('[data-act="tut"]').addEventListener('click', function () {
      run(scn.steps);
    });
    _choice.querySelector('[data-act="norm"]').addEventListener('click', function () {
      var cb = document.getElementById('tut-skip-cb');
      if (cb && cb.checked) setSkip(scn.id);
      closeChooser();
    });
  }

  // ── 스킵 기억 + 다시보기 버튼 ─────────────────────────────────────────
  function setSkip(id) { try { localStorage.setItem('tut_skip_' + id, '1'); } catch (_) {} }
  function isSkipped(id) { try { return localStorage.getItem('tut_skip_' + id) === '1'; } catch (_) { return false; } }

  var _replayMon = null;
  function removeReplay() {
    var b = document.getElementById('tut-replay');
    if (b) b.remove();
    if (_replayMon) { clearInterval(_replayMon); _replayMon = null; }
  }
  function mountReplay(scn) {
    if (document.getElementById('tut-replay')) return;
    var b = document.createElement('button');
    b.id = 'tut-replay';
    b.innerHTML = '<span>🎓</span><span>' + T({ kr: '튜토리얼', ja: 'チュートリアル', en: 'Tutorial' }) + '</span>';
    b.addEventListener('click', function () { showChooser(scn); });
    document.body.appendChild(b);
    // 모달이 닫히면 버튼 제거
    _replayMon = setInterval(function () {
      if (!modalOpen()) { removeReplay(); if (_active) quit(); }
    }, 600);
  }

  // ── ESC 로 종료 ───────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (_active) quit(); else closeChooser(); }
  });

  // ════════════════════════════════════════════════════════════════════
  //  시나리오 정의 — 제품별. 신규 제품은 여기에 객체 1개 추가하면 끝.
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
    { // 2) 파일 올리기
      target: '#soBizUploadBtn', mode: 'next',
      msg: { kr: '이제 <b>파일 올리기</b>를 눌러 파일을 올려요.<br>작업은 <b>92 × 52mm</b>, 재단은 <b>90 × 50mm</b> 로 작업하면 돼요 📎',
        ja: '次に <b>ファイルアップロード</b> を押してください。<br>作業サイズ <b>92 × 52mm</b>、仕上がり <b>90 × 50mm</b> です 📎',
        en: 'Now tap <b>Upload file</b>.<br>Work size <b>92 × 52mm</b>, trim <b>90 × 50mm</b> 📎' },
      hook: function (advance) {
        var f = document.getElementById('soFile');
        if (!f) return null;
        var on = function () { advance({ kr: '와우! 잘했어요 🎉', ja: 'ワオ!上手にできました 🎉', en: 'Wow! Nicely done 🎉' }); };
        f.addEventListener('change', on, { once: true });
        return function () { f.removeEventListener('change', on); };
      }
    },
    { // 3) 용지
      target: '#soBizPaperGrid', mode: 'wait',
      msg: { kr: '와우, 잘했어요! 🎉 다음은 <b>용지</b>예요.<br>제일 무난한 건 <b>누브지</b>나 <b>랑데뷰 네추럴</b>. 펄 느낌 <b>컨셉</b>이나 <b>팝셋</b>도 멋져요 ✨',
        ja: 'ワオ、上手! 🎉 次は <b>用紙</b>。<br>無難なのは <b>ヌーブ紙</b> や <b>ランデブーナチュラル</b>。パール感の <b>コンセプト</b> や <b>ポップセット</b> も素敵 ✨',
        en: 'Wow, great! 🎉 Next, the <b>paper</b>.<br>Safest picks: <b>Nuvegi</b> or <b>Rendezvous Natural</b>. Pearly <b>Concept</b> or <b>Popset</b> are lovely too ✨' },
      cheer: { kr: '탁월한 선택! 😍', ja: '素晴らしい選択! 😍', en: 'Excellent choice! 😍' }
    },
    { // 4) 박 / 후가공 안내 (선택)
      target: ['#soBizFoilToggle', '#soBizFinishToggle'], mode: 'next',
      msg: { kr: '잘했어요! 이제 얼마 안 남았어요, 힘내요! 💪<br><b>박</b>·<b>후가공</b>은 꼭 해야 하는 게 아니에요. 더 멋진 작품을 위한 <b>선택 옵션</b>! 단순한 명함이면 패스~ 😉',
        ja: 'いい調子!あと少し、ファイト! 💪<br><b>箔押し</b>・<b>後加工</b>は必須ではありません。より素敵に仕上げる <b>オプション</b> です。シンプルな名刺ならパスでOK 😉',
        en: 'Great! Almost there, hang in! 💪<br><b>Foil</b> & <b>finishing</b> are optional — for an extra-special card. Simple card? Skip it 😉' }
    },
    { // 5) 수량 안내
      target: ['#soBizQtyPresets', '#soQtySection'], mode: 'next',
      msg: { kr: '<b>수량</b> 안내! 기본 100매(1각) <b>이상부터 50% 할인</b> 돼요.<br>많이 필요할지 모르면 미리 넉넉히 만들어 두세요. 금박 같은 후가공도 똑같이 할인되니 지금 추가해도 이득! 💰',
        ja: '<b>数量</b> のご案内!基本100枚(1ロット) <b>以上で50%割引</b>。<br>多めに必要かもなら今のうちに。箔押しなど後加工も同じく割引なので今追加がお得! 💰',
        en: '<b>Quantity</b> tip! From 100 pcs (1 set) up, <b>50% off</b>.<br>If you might need more, make extra now. Foil & finishing get the same discount — adding now pays off! 💰' }
    },
    { // 6) 별색 안내 (박/후가공 선택 시에만)
      target: ['#soBizFoilToggle', '#soBizFinishToggle'], mode: 'next',
      onEnter: bizHasSpecial,
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
    // → finale 자동
  ];

  var SCENARIOS = [
    { id: 'bizcard', match: /^pp_bc/i, steps: BIZCARD_STEPS }
  ];
  function pickScenario(code) {
    if (!code) return null;
    for (var i = 0; i < SCENARIOS.length; i++) {
      try { if (SCENARIOS[i].match.test(code)) return SCENARIOS[i]; } catch (_) {}
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════
  //  진입점 — simple_order.js 가 모달을 연 직후 호출.
  // ════════════════════════════════════════════════════════════════════
  window._tutMaybeStart = function (product) {
    try {
      var code = (product && product.code) || '';
      var scn = pickScenario(code);
      if (!scn) { removeReplay(); if (_active) quit(); return; }
      _lang = detectLang();
      ensureStyles();
      mountReplay(scn);
      if (isSkipped(scn.id)) return;       // 다시 묻지 않기 → 다시보기 버튼만 노출
      showChooser(scn);
    } catch (e) { console.warn('[tut] _tutMaybeStart', e); }
  };
})();
