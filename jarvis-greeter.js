/* jarvis-greeter.js — 홈 "자비스 응대" 프로토타입 (2026-09-21 사장님)
   비전: 챗봇 버블이 아니라, 홈에 들어오면 사이트가 먼저 말 걸고 대화로 안내(자비스).
   두뇌 = product-advisor edge function 재사용. 손(제품 안내) = 추천 카드 → 사이트 이동.
   프로토타입 범위: 홈에서만, 세션 1회 인사, 입력→카푸 응답→추천제품 카드로 이동.
*/
(function () {
  if (window.__jarvisGreeterLoaded) return;
  window.__jarvisGreeterLoaded = true;

  var SUPA_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
  var API = SUPA_URL + '/functions/v1/product-advisor';

  // ── 노출 조건: 홈에서만, 세션 1회, 상세/가맹/에디터/카트 진입은 제외 ──
  function _shouldShow() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('product') || q.get('fr') || q.get('cart') || q.get('editor') || q.get('search') || q.get('signup_event')) return false;
      if (document.body && document.body.classList.contains('editor-designonly')) return false;
      // 단독 랜딩 도메인(종이매대/원판 등)은 제외 — 메인 카페 도메인에서만
      var h = location.hostname;
      if (h.indexOf('hexa-board') >= 0 || h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) return false;
      if (sessionStorage.getItem('jarvisGreeted') === '1') return false;
    } catch (e) {}
    return true;
  }

  var _lang = (function () {
    var c = (window.__SITE_CODE || 'KR').toString().toUpperCase();
    if (c === 'JP') return 'ja'; if (c === 'US') return 'us';
    return 'kr';
  })();
  function tr(kr, ja, en) { return _lang === 'ja' ? ja : (_lang === 'kr' ? kr : en); }

  var _room = null, _hist = [], _busy = false, _root = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function ensureStyles() {
    if (document.getElementById('jvgStyle')) return;
    var st = document.createElement('style'); st.id = 'jvgStyle';
    st.textContent =
      '#jvgCard{position:fixed;left:50%;bottom:20px;transform:translateX(-50%) translateY(140%);width:min(440px,calc(100vw - 24px));background:#fff;border:1px solid #e5e7eb;border-radius:18px;z-index:2147483000;font-family:inherit;overflow:hidden;transition:transform .45s cubic-bezier(.2,.8,.2,1);}' +
      '#jvgCard.jvg-in{transform:translateX(-50%) translateY(0);}' +
      '#jvgCard .jvg-head{display:flex;align-items:center;gap:10px;padding:13px 15px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;}' +
      '#jvgCard .jvg-ava{width:34px;height:34px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;}' +
      '#jvgCard .jvg-name{font-weight:800;font-size:15px;line-height:1.2;}' +
      '#jvgCard .jvg-sub{font-size:11px;opacity:.85;}' +
      '#jvgCard .jvg-x{margin-left:auto;background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;opacity:.9;padding:2px 4px;}' +
      '#jvgCard .jvg-body{max-height:min(46vh,340px);overflow-y:auto;padding:14px 15px;background:#fafafa;}' +
      '#jvgCard .jvg-msg{font-size:14px;line-height:1.55;color:#1e293b;white-space:pre-wrap;margin-bottom:10px;}' +
      '#jvgCard .jvg-msg.me{text-align:right;color:#4338ca;font-weight:600;}' +
      '#jvgCard .jvg-recs{display:flex;flex-direction:column;gap:8px;margin:6px 0 4px;}' +
      '#jvgCard .jvg-rec{display:flex;align-items:center;gap:10px;text-decoration:none;background:#fff;border:1px solid #e0e7ff;border-radius:12px;padding:9px 11px;color:#1e293b;transition:border-color .15s;}' +
      '#jvgCard .jvg-rec:hover{border-color:#6366f1;background:#f8faff;}' +
      '#jvgCard .jvg-rec img{width:42px;height:42px;border-radius:9px;object-fit:cover;background:#f1f5f9;flex-shrink:0;}' +
      '#jvgCard .jvg-rec .jvg-rn{font-size:13px;font-weight:700;line-height:1.25;}' +
      '#jvgCard .jvg-rec .jvg-go{margin-left:auto;font-size:12px;font-weight:800;color:#6366f1;white-space:nowrap;}' +
      '#jvgCard .jvg-quick{display:flex;flex-wrap:wrap;gap:7px;margin:2px 0 6px;}' +
      '#jvgCard .jvg-q{background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:999px;padding:8px 13px;font-size:13px;font-weight:700;cursor:pointer;}' +
      '#jvgCard .jvg-q:hover{background:#e0e7ff;}' +
      '#jvgCard .jvg-img{background:#fff;border:2px solid #a5b4fc;color:#6366f1;border-radius:12px;padding:0 12px;font-size:18px;cursor:pointer;flex-shrink:0;animation:jvgSpark 1.5s ease-in-out infinite;}' +
      '#jvgCard .jvg-img:hover{background:#eef2ff;}' +
      '@keyframes jvgSpark{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.55);border-color:#818cf8;}50%{box-shadow:0 0 0 7px rgba(99,102,241,0);border-color:#6366f1;}}' +
      '#jvgCard .jvg-msg.me img{max-width:150px;border-radius:10px;display:inline-block;}' +
      '#jvgCard .jvg-foot{display:flex;gap:8px;padding:11px 12px;border-top:1px solid #eef2f7;background:#fff;}' +
      '#jvgCard .jvg-in-txt{flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:11px 13px;font-size:14px;font-family:inherit;outline:none;}' +
      '#jvgCard .jvg-in-txt:focus{border-color:#6366f1;}' +
      '#jvgCard .jvg-send{background:#6366f1;border:none;color:#fff;border-radius:12px;padding:0 16px;font-weight:800;font-size:14px;cursor:pointer;}' +
      '#jvgCard .jvg-send:disabled{opacity:.5;cursor:default;}' +
      '#jvgCard .jvg-typing{font-size:13px;color:#94a3b8;}';
    document.head.appendChild(st);
  }

  function addMsg(text, who) {
    var b = _root.querySelector('.jvg-body');
    var d = document.createElement('div');
    d.className = 'jvg-msg' + (who === 'me' ? ' me' : '');
    d.textContent = text;
    b.appendChild(d); b.scrollTop = b.scrollHeight;
    return d;
  }

  function addRecs(products) {
    if (!products || !products.length) return;
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-recs';
    products.slice(0, 4).forEach(function (p) {
      if (!p || !p.code) return;
      var a = document.createElement('a');
      a.className = 'jvg-rec';
      a.href = '/?product=' + encodeURIComponent(p.code);
      var img = p.img_url ? '<img src="' + esc(p.img_url) + '" loading="lazy" alt="" onerror="this.style.display=\'none\'">' : '';
      a.innerHTML = img + '<span class="jvg-rn">' + esc(p.name || p.code) + '</span><span class="jvg-go">' + tr('보러가기 ›', '見る ›', 'View ›') + '</span>';
      wrap.appendChild(a);
    });
    b.appendChild(wrap); b.scrollTop = b.scrollHeight;
  }

  function openRewards() {
    try { if (window.openRewardHub) window.openRewardHub(); else if (window._tbRetry) window._tbRetry('openRewardHub'); } catch (e) {}
    close();
  }
  function addQuickActions() {
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-quick';
    var acts = [{ label: tr('🛒 바로 주문·상담', '🛒 注文・相談', '🛒 Order / Ask'), fn: function () { var i = _root.querySelector('.jvg-in-txt'); if (i) i.focus(); } }];
    if (_lang === 'kr') {  // 리워드 허브(출석·끝말잇기)는 한국 전용
      acts.unshift({ label: '🎮 끝말잇기', fn: openRewards });
      acts.unshift({ label: '🎯 오늘의 출석', fn: openRewards });
    }
    acts.forEach(function (a) {
      var btn = document.createElement('button'); btn.className = 'jvg-q'; btn.textContent = a.label;
      btn.addEventListener('click', a.fn); wrap.appendChild(btn);
    });
    b.appendChild(wrap); b.scrollTop = b.scrollHeight;
  }

  function readImage(file, cb) {
    try { var r = new FileReader(); r.onload = function () { var du = String(r.result); cb((du.split(',')[1] || ''), file.type || 'image/jpeg', du); }; r.readAsDataURL(file); } catch (e) {}
  }
  function addImageMsg(dataUrl) {
    var b = _root.querySelector('.jvg-body'); var d = document.createElement('div'); d.className = 'jvg-msg me';
    d.innerHTML = '<img src="' + dataUrl + '" alt="">'; b.appendChild(d); b.scrollTop = b.scrollHeight;
  }
  async function send(text, image) {
    if (_busy || (!text && !image)) return;
    _busy = true;
    var sendBtn = _root.querySelector('.jvg-send'); if (sendBtn) sendBtn.disabled = true;
    if (image && image.dataUrl) addImageMsg(image.dataUrl);
    if (text) addMsg(text, 'me');
    var typing = addMsg(tr('카푸가 입력 중…', 'カプが入力中…', 'Kapu is typing…'), 'ai');
    typing.classList.add('jvg-typing');
    try {
      var payload = { message: text || (image ? tr('이 사진 보고 안내해줘', 'この写真を見て案内して', 'Guide me based on this photo') : ''), lang: _lang, conversation_history: _hist.slice(-30) };
      if (_room) payload.room_id = _room;
      if (image && image.base64) { payload.image = image.base64; payload.image_type = image.type; }
      var res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY, 'apikey': SUPA_KEY }, body: JSON.stringify(payload) });
      var data = await res.json();
      if (data.room_id) _room = data.room_id;
      var msg = data.chat_message || data.summary || tr('무엇을 도와드릴까요?', '何かお手伝いできますか？', 'How can I help?');
      typing.classList.remove('jvg-typing'); typing.textContent = msg;
      _hist.push({ role: 'user', content: text || '[사진 업로드]' });
      _hist.push({ role: 'assistant', content: msg });
      addRecs(data.products);
    } catch (e) {
      typing.classList.remove('jvg-typing');
      typing.textContent = tr('죄송해요, 잠시 후 다시 시도해 주세요.', '申し訳ありません、後ほどお試しください。', 'Sorry, please try again shortly.');
    } finally {
      _busy = false; if (sendBtn) sendBtn.disabled = false;
    }
  }

  function open() {
    ensureStyles();
    _root = document.createElement('div'); _root.id = 'jvgCard';
    _root.innerHTML =
      '<div class="jvg-head"><span class="jvg-ava">🦎</span><div><div class="jvg-name">' + tr('카멜레온 카푸', 'カメレオン カプ', 'Chameleon Kapu') + '</div><div class="jvg-sub">' + tr('무엇이든 편하게 말씀하세요', 'お気軽にどうぞ', 'Ask me anything') + '</div></div><button class="jvg-x" aria-label="close">×</button></div>' +
      '<div class="jvg-body"></div>' +
      '<div class="jvg-foot"><button class="jvg-img" title="' + tr('사진 올리기', '写真', 'Photo') + '">📷</button><input class="jvg-file" type="file" accept="image/*" style="display:none"><input class="jvg-in-txt" type="text" placeholder="' + tr('사진 올리거나 · 예: 가벽 3미터 · 배너 · 글씨스카시…', '写真、または例: パーティション3m…', 'Upload a photo, or e.g. 3m wall…') + '"><button class="jvg-send">' + tr('보내기', '送信', 'Send') + '</button></div>';
    document.body.appendChild(_root);
    // 첫 인사 (반말·친근 — 사진부터 물어봄. 고객 90%가 허니콤보드)
    addMsg(tr('안녕~ 방가워! 😊 우리 고객 대부분이 허니콤보드를 만들어. 혹시 만들고 싶은 제품 사진 있어? 없으면 인터넷에서 비슷한 걸 찾아서 아래 📷로 올려줘 — 사진 보고 딱 맞게 안내해줄게! (아니면 \'배너\', \'글씨스카시\'처럼 말해줘도 돼)',
              'こんにちは！😊 お客様の多くはハニカムボードを作られます。作りたい製品の写真はありますか？なければネットで似たものを探して下の📷でアップしてください〜写真を見てご案内します！',
              'Hey! 😊 Most of our customers make honeycomb boards. Do you have a photo of what you want? If not, find a similar one online and upload it with 📷 below — I\'ll guide you from the photo!'), 'ai');
    addQuickActions();
    requestAnimationFrame(function () { _root.classList.add('jvg-in'); });
    try { sessionStorage.setItem('jarvisGreeted', '1'); } catch (e) {}

    var inp = _root.querySelector('.jvg-in-txt'), btn = _root.querySelector('.jvg-send');
    function doSend() { var v = (inp.value || '').trim(); if (!v) return; inp.value = ''; send(v); }
    btn.addEventListener('click', doSend);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });
    var imgBtn = _root.querySelector('.jvg-img'), fileInp = _root.querySelector('.jvg-file');
    imgBtn.addEventListener('click', function () { fileInp.click(); });
    fileInp.addEventListener('change', function () { var f = fileInp.files && fileInp.files[0]; if (f) readImage(f, function (b64, type, du) { send('', { base64: b64, type: type, dataUrl: du }); }); fileInp.value = ''; });
    _root.querySelector('.jvg-x').addEventListener('click', close);
  }

  function close() { if (_root) { _root.classList.remove('jvg-in'); setTimeout(function () { try { _root.remove(); } catch (e) {} }, 400); } }

  window.openJarvisGreeter = open;   // 수동 오픈용 (버튼 등에서 호출 가능)

  function boot() {
    if (!_shouldShow()) return;
    setTimeout(function () {
      // 이미 챗봇을 열었거나 다른 모달이 떠 있으면 인사 보류
      if (document.querySelector('#advPanel.open, .adv-panel.open')) return;
      open();
    }, 2200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
