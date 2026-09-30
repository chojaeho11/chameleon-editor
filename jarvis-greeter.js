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
  function _fabAllowed() {   // 우측 카멜레온 버튼(재열기)은 편집기/카트/단독도메인만 제외하고 어디서나
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('editor') || q.get('cart')) return false;
      if (document.body && document.body.classList.contains('editor-designonly')) return false;
      var h = location.hostname;
      if (h.indexOf('hexa-board') >= 0 || h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) return false;
    } catch (e) {}
    return true;
  }
  function _isHomeView() {   // 자동 인사는 메인 홈에서만 (상세/가맹/검색 등 제외)
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('product') || q.get('fr') || q.get('search') || q.get('signup_event')) return false;
    } catch (e) {}
    return _fabAllowed();
  }

  var _lang = (function () {
    var c = (window.__SITE_CODE || 'KR').toString().toUpperCase();
    if (c === 'JP') return 'ja'; if (c === 'US') return 'us';
    return 'kr';
  })();
  function tr(kr, ja, en) { return _lang === 'ja' ? ja : (_lang === 'kr' ? kr : en); }

  // 2026-09-30(사장님): 공용 room_id — advisor-panel 과 공유(localStorage 'kapu_room_id'). 재방문·새로고침에도 같은 대화로 이어져 관리자에서 한 대화로 보임.
  var _room = (function () { try { return localStorage.getItem('kapu_room_id') || null; } catch (e) { return null; } })();
  var _hist = [], _busy = false, _root = null, _backdrop = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  // 2026-09-22(사장님): AI 응답의 마크다운 기호 제거 (**, *, ##, `, 목록기호) — 화면엔 평문만.
  function stripMd(s) {
    return String(s == null ? '' : s)
      .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
      .replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1$2')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/^\s*[-*]\s+/gm, '· ')
      .replace(/__([\s\S]*?)__/g, '$1')
      .trim();
  }

  function ensureStyles() {
    if (document.getElementById('jvgStyle')) return;
    var st = document.createElement('style'); st.id = 'jvgStyle';
    st.textContent =
      '#jvgBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147482999;opacity:0;transition:opacity .35s;}' +
      '#jvgBackdrop.jvg-in{opacity:1;}' +
      '#jvgCard{position:fixed;left:50%;bottom:12px;transform:translateX(-50%) translateY(115%);width:min(480px,96vw);height:min(84vh,860px);max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#fff;border-radius:22px;z-index:2147483000;font-family:inherit;overflow:hidden;transition:transform .45s cubic-bezier(.2,.8,.2,1);box-shadow:0 12px 44px rgba(15,23,42,.3);}' +
      '#jvgCard.jvg-in{transform:translateX(-50%) translateY(0);}' +
      '#jvgCard .jvg-head{display:flex;align-items:center;gap:12px;padding:16px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;flex-shrink:0;}' +
      '#jvgCard .jvg-ava{width:52px;height:52px;border-radius:50%;background:#fff;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.7);}' +
      '#jvgCard .jvg-name{font-weight:800;font-size:17px;line-height:1.2;}' +
      '#jvgCard .jvg-sub{font-size:12px;opacity:.9;}' +
      '#jvgFab{position:fixed;right:16px;bottom:18px;width:60px;height:60px;border-radius:50%;background:#fff;border:none;box-shadow:0 6px 20px rgba(15,23,42,.22);cursor:pointer;z-index:2147482998;overflow:hidden;padding:0;}' +
      '#jvgFab img{width:100%;height:100%;object-fit:cover;}' +
      '#advFloatingFab,#kapuFab,#btnAiAdvisor,#floatingChatBtn{display:none!important;}' +
      '#jvgCard .jvg-x{margin-left:auto;background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;opacity:.9;padding:2px 4px;}' +
      '#jvgCard .jvg-body{flex:1;overflow-y:auto;padding:16px;background:#fafafa;}' +
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
      '#jvgCard .jvg-q-primary{background:#4f46e5;border-color:#4f46e5;color:#fff;}' +
      '#jvgCard .jvg-q-primary:hover{background:#4338ca;}' +
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
    var acts = [];
    if (_lang === 'kr') acts.push({ label: '쿠폰받기', fn: openRewards });  // 리워드 허브(출석·게임 → 무료쿠폰), 한국 전용
    acts.push({ label: tr('아니, 바로 주문·상담', '注文・相談', 'Order / Ask'), fn: function () { var i = _root.querySelector('.jvg-in-txt'); if (i) i.focus(); } });
    acts.forEach(function (a) {
      var btn = document.createElement('button'); btn.className = 'jvg-q'; btn.textContent = a.label;
      btn.addEventListener('click', a.fn); wrap.appendChild(btn);
    });
    b.appendChild(wrap); b.scrollTop = b.scrollHeight;
  }

  // 2026-09-30(사장님): 지금 상담 가능한 매니저 전화 안내 (chatbot_knowledge _managers). KR 위주, 없으면 본사 전화.
  async function _jvgShowManagers() {
    var hq = (_lang === 'ja') ? '047-712-1148' : '031-366-1984';
    var sb = window.sb;
    if (!sb || !sb.from) { addMsg(tr('상담 전화: ' + hq + ' (평일 09:00-18:00)', 'お電話: ' + hq, 'Call: ' + hq), 'ai'); return; }
    try {
      var r = await sb.from('chatbot_knowledge').select('question,answer,is_active').eq('category', '_managers');
      var NAMES = ['성희', '지숙', '연두'];
      var rows = (r.data || []).filter(function (x) { return NAMES.some(function (n) { return (x.question || '').indexOf(n) >= 0; }); });
      var lines = [];
      rows.forEach(function (x) {
        var phone = ''; try { phone = (JSON.parse(x.answer || '{}').phone) || ''; } catch (e) {}
        if (!phone) return;
        var fmt = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
        var nm = NAMES.filter(function (n) { return (x.question || '').indexOf(n) >= 0; })[0] || '매니저';
        lines.push('· ' + nm + ' 매니저 — ' + fmt + (x.is_active === false ? ' (지금 부재중)' : ''));
      });
      if (lines.length) addMsg(tr('지금 상담 가능한 매니저야. 편하게 전화해줘:\n', '担当マネージャーです:\n', 'Available managers:\n') + lines.join('\n'), 'ai');
      else addMsg(tr('상담 전화: ' + hq + ' (평일 09:00-18:00)', 'お電話: ' + hq, 'Call: ' + hq), 'ai');
    } catch (e) { addMsg(tr('상담 전화: ' + hq + ' (평일 09:00-18:00)', 'お電話: ' + hq, 'Call: ' + hq), 'ai'); }
  }
  // 인사 아래 안내 버튼: 매니저 / 이메일 / 사진올리기 / 출고문의(본사)
  function addGreetActions() {
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-quick';
    var hq = (_lang === 'ja') ? '047-712-1148' : '031-366-1984';
    var acts = [
      { label: tr('매니저 안내', '担当マネージャー', 'Manager'), fn: _jvgShowManagers },
      { label: tr('이메일 안내', 'メール', 'Email'), fn: function () { addMsg(tr('이메일로 문의할래? 여기로 보내줘:\ndesign@chameleon.design', 'メールはこちら:\ndesign@chameleon.design', 'Email us:\ndesign@chameleon.design'), 'ai'); } },
      { label: tr('사진 올리기', '写真を送る', 'Upload photo'), fn: function () { var f = _root.querySelector('.jvg-file'); if (f) f.click(); } },
      { label: tr('출고 문의', '出荷の問い合わせ', 'Shipping'), fn: function () { addMsg(tr('출고·배송 문의는 본사로 연락해줘:\n' + hq + ' (평일 09:00-18:00)', '出荷・配送は本社へ:\n' + hq, 'For shipping, call HQ:\n' + hq), 'ai'); } }
    ];
    acts.forEach(function (a) { var btn = document.createElement('button'); btn.className = 'jvg-q'; btn.textContent = a.label; btn.addEventListener('click', a.fn); wrap.appendChild(btn); });
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
    var typing = addMsg(image ? tr('잠깐만, 이미지 확인할게…', 'ちょっと写真を確認するね…', 'Let me check the image…') : tr('카푸가 입력 중…', 'カプが入力中…', 'Kapu is typing…'), 'ai');
    typing.classList.add('jvg-typing');
    try {
      var payload = { message: text || (image ? tr('이 사진 보고 안내해줘', 'この写真を見て案内して', 'Guide me based on this photo') : ''), lang: _lang, conversation_history: _hist.slice(-30) };
      if (_room) payload.room_id = _room;
      if (image && image.base64) { payload.image = image.base64; payload.image_type = image.type; }
      var res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY, 'apikey': SUPA_KEY }, body: JSON.stringify(payload) });
      var data = await res.json();
      if (data.room_id) { _room = data.room_id; try { localStorage.setItem('kapu_room_id', _room); } catch (e) {} }
      var msg = stripMd(data.chat_message || data.summary || tr('무엇을 도와드릴까요?', '何かお手伝いできますか？', 'How can I help?'));
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

  function _cartCount() { try { return (JSON.parse(localStorage.getItem('chameleon_cart_current') || '[]') || []).length; } catch (e) { return 0; } }
  // 2026-09-29(사장님): 장바구니 담은 뒤 안내 문구
  function _afterCartMsg() {
    return tr(
      '와 대단한데 매우 잘했어!\n제품과 옵션을 잘 골랐다면 이제 주문할 수 있어.\n만약 다른 상품이 추가로 필요하다면 사진이나 제품명을 말해줘, 내가 링크를 줄게.',
      'わあ、すごい！よくできたね。\n製品とオプションをちゃんと選べたなら、このまま注文できるよ。\n他にも必要な商品があれば、写真か製品名を教えてね。リンクを送るよ。',
      'Wow, nicely done!\nIf you\'ve picked the product and options you want, you\'re ready to order.\nNeed anything else? Send a photo or the product name and I\'ll get you a link.'
    );
  }
  function _addCartActions() {
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-quick';
    var acts = [
      // 다른 제품 문의 — 입력창으로 유도 (사진 업로드/제품명 입력)
      { label: tr('다른 제품 문의', '他の製品を問い合わせ', 'Ask about another'), primary: false, fn: function () { var i = _root.querySelector('.jvg-in-txt'); if (i) { i.focus(); i.scrollIntoView({ block: 'nearest' }); } } },
      // 주문 바로가기 — 통합 결제창으로
      { label: tr('주문 바로가기 →', '注文ページへ →', 'Go to checkout →'), primary: true, fn: function () { close(); location.href = '/?cart=checkout'; } }
    ];
    acts.forEach(function (a) { var btn = document.createElement('button'); btn.className = 'jvg-q' + (a.primary ? ' jvg-q-primary' : ''); btn.textContent = a.label; btn.addEventListener('click', a.fn); wrap.appendChild(btn); });
    b.appendChild(wrap); b.scrollTop = b.scrollHeight;
  }
  window.openJarvisAfterCart = function () {   // 2026-09-22(사장님): 장바구니 담은 뒤 안내 + 다른제품/주문 버튼
    if (_root) { addMsg(_afterCartMsg(), 'ai'); _addCartActions(); }
    else { open('aftercart'); }
  };

  function open(mode) {
    if (_root) return;   // 이미 열려 있으면 무시
    ensureStyles();
    _backdrop = document.createElement('div'); _backdrop.id = 'jvgBackdrop';
    _backdrop.addEventListener('click', close);
    document.body.appendChild(_backdrop);
    _root = document.createElement('div'); _root.id = 'jvgCard';
    _root.innerHTML =
      '<div class="jvg-head"><img class="jvg-ava" src="/jarvis-character.jpg?v=1" alt="카푸" onerror="this.src=\'/mascot-character.webp\'"><div><div class="jvg-name">' + tr('카멜레온 카푸', 'カメレオン カプ', 'Chameleon Kapu') + '</div><div class="jvg-sub">' + tr('편하게 말 걸어~', 'お気軽にどうぞ', 'Talk to me anytime') + '</div></div><button class="jvg-x" aria-label="close">×</button></div>' +
      '<div class="jvg-body"></div>' +
      '<div class="jvg-foot"><button class="jvg-img" title="' + tr('사진 올리기', '写真', 'Photo') + '">📷</button><input class="jvg-file" type="file" accept="image/*" style="display:none"><input class="jvg-in-txt" type="text" placeholder="' + tr('사진 올리거나 · 예: 가벽 3미터 · 배너 · 글씨스카시…', '写真、または例: パーティション3m…', 'Upload a photo, or e.g. 3m wall…') + '"><button class="jvg-send">' + tr('보내기', '送信', 'Send') + '</button></div>';
    document.body.appendChild(_root);
    if (mode === 'aftercart') {
      addMsg(_afterCartMsg(), 'ai');
      _addCartActions();
    } else {
      // 첫 인사 (반말·친근). 주문 방법 3가지 안내 + 버튼.
      addMsg(tr(
        '안녕! 행사 준비해? 내가 안내할게.\n\n주문하는 방법은 2가지가 있어.\n\n' +
        '1. 채팅창에 만들고 싶은 제품 이미지를 끌어다 놓거나, "가벽"·"배너"처럼 제품명을 말해줘. 내가 딱 맞는 링크를 줄게. 링크에 들어가면 튜토리얼로 차근차근 안내해줄게.\n\n' +
        '2. 직접 하기 어렵다면 담당 매니저를 통해 주문할 수도 있어. 아래 "매니저 안내"를 누르면 지금 상담 가능한 매니저 전화번호를 알려줄게.',
        'こんにちは！イベントの準備かな？案内するよ。\n\nご注文の方法は2つあるよ。\n\n' +
        '1. チャットに作りたい製品の画像をドラッグするか、「パーティション」「バナー」のように製品名を教えてね。ぴったりのリンクを送るよ。リンクに入るとチュートリアルで案内するよ。\n\n' +
        '2. 難しければ担当マネージャー経由でも注文できるよ。下の「担当マネージャー」を押すと、今対応できるマネージャーの電話番号を送るよ。',
        'Hi! Planning an event? Let me guide you.\n\nThere are 2 ways to order.\n\n' +
        '1. Drag a product image into the chat, or just tell me the product (e.g. "wall", "banner"). I\'ll send the right link — it has a step-by-step tutorial.\n\n' +
        '2. Prefer a person? You can order through your manager. Tap "Manager" below and I\'ll share an available manager\'s number.'
      ), 'ai');
      addGreetActions();
    }
    requestAnimationFrame(function () { _root.classList.add('jvg-in'); if (_backdrop) _backdrop.classList.add('jvg-in'); });

    var inp = _root.querySelector('.jvg-in-txt'), btn = _root.querySelector('.jvg-send');
    function doSend() { var v = (inp.value || '').trim(); if (!v) return; inp.value = ''; send(v); }
    btn.addEventListener('click', doSend);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });
    var imgBtn = _root.querySelector('.jvg-img'), fileInp = _root.querySelector('.jvg-file');
    imgBtn.addEventListener('click', function () { fileInp.click(); });
    fileInp.addEventListener('change', function () { var f = fileInp.files && fileInp.files[0]; if (f) readImage(f, function (b64, type, du) { send('', { base64: b64, type: type, dataUrl: du }); }); fileInp.value = ''; });
    // 2026-09-24: 캡쳐 이미지 붙여넣기(Ctrl+V) 지원 — 클립보드 이미지 바로 전송
    function handlePaste(e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          var f = items[i].getAsFile();
          if (f) { e.preventDefault(); readImage(f, function (b64, type, du) { send('', { base64: b64, type: type, dataUrl: du }); }); }
          return;
        }
      }
    }
    inp.addEventListener('paste', handlePaste);
    _root.addEventListener('paste', handlePaste);
    _root.querySelector('.jvg-x').addEventListener('click', close);
  }

  function close() {
    if (_backdrop) { _backdrop.classList.remove('jvg-in'); var bd = _backdrop; _backdrop = null; setTimeout(function () { try { bd.remove(); } catch (e) {} }, 400); }
    if (_root) { _root.classList.remove('jvg-in'); var rt = _root; _root = null; setTimeout(function () { try { rt.remove(); } catch (e) {} }, 400); }
  }

  window.openJarvisGreeter = open;   // 수동 오픈용 (버튼 등에서 호출 가능)

  function makeFab() {
    if (document.getElementById('jvgFab')) return;
    ensureStyles();
    var fab = document.createElement('button'); fab.id = 'jvgFab'; fab.title = tr('카푸에게 물어보기', 'カプに聞く', 'Ask Kapu');
    fab.innerHTML = '<img src="/jarvis-character.jpg?v=1" alt="카푸" onerror="this.src=\'/mascot-character.webp\'">';
    fab.addEventListener('click', open);
    document.body.appendChild(fab);
  }
  function boot() {
    if (!_fabAllowed()) return;
    makeFab();                  // 우측 카멜레온 버튼 — 홈/상세 어디서나 (재열기, 기존 💬 대체)
    if (!_isHomeView()) return; // 자동 인사는 홈에서만
    // 2026-09-29(사장님): 자동 인사는 "최초 접속 1회만". 이후엔 우측 카푸 버튼으로 직접 열기.
    var _greeted = false;
    try { _greeted = (localStorage.getItem('jvg_greeted') === '1'); } catch (e) {}
    if (_greeted) return;
    setTimeout(function () {
      if (_root) return;
      if (document.querySelector('#advPanel.open, .adv-panel.open')) return;
      try { localStorage.setItem('jvg_greeted', '1'); } catch (e) {}
      open();
    }, 2200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
