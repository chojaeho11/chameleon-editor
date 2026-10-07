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
  // 2026-10-07(사장님): 채팅에서 고객 성함 1회 물어보기 → chat_rooms.customer_name 반영(관리자 콘솔에 실명 표기)
  var _custName = (function () { try { return localStorage.getItem('kapu_cust_name') || ''; } catch (e) { return ''; } })();
  var _custPhone = (function () { try { return localStorage.getItem('kapu_cust_phone') || ''; } catch (e) { return ''; } })();
  var _awaitingName = false, _pendingMsg = '';
  // 2026-10-07(사장님): 담당매니저 답변 실시간 수신 — chat_messages 구독
  var _msgSub = null, _seenMsgIds = {}, _humanNoticeShown = false;
  // 2026-10-07(사장님): 담당자 자리비움 시 30초 후 AI 전환 제안
  var _humanWaitTimer = null, _lastAskedText = '', _forceAiNext = false;

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
  // 2026-10-07(사장님): 메시지 속 링크(제품/URL)를 클릭 가능한 앵커로 — 나머지는 이스케이프
  function _linkify(raw) {
    raw = String(raw == null ? '' : raw).replace(/\*\*/g, '');
    var re = /(https?:\/\/[^\s<]+)|(\/\?product=[A-Za-z0-9_%\-]+)/g;
    var out = '', last = 0, m;
    while ((m = re.exec(raw))) {
      out += esc(raw.slice(last, m.index));
      var url = m[1] || (location.origin + m[2]);
      var isProd = /[?&]product=/.test(url);
      var label = isProd ? '🔗 제품 보기' : (url.length > 46 ? url.slice(0, 43) + '…' : url);
      out += '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
      last = re.lastIndex;
    }
    out += esc(raw.slice(last));
    return out;
  }

  function ensureStyles() {
    if (document.getElementById('jvgStyle')) return;
    var st = document.createElement('style'); st.id = 'jvgStyle';
    st.textContent =
      '#jvgBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147482999;opacity:0;transition:opacity .35s;}' +
      '#jvgBackdrop.jvg-in{opacity:1;}' +
      '#jvgCard{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);opacity:0;width:min(540px,96vw);height:min(92vh,980px);max-height:calc(100vh - 20px);display:flex;flex-direction:column;background:#fff;border-radius:22px;z-index:2147483000;font-family:inherit;overflow:hidden;transition:transform .4s cubic-bezier(.2,.8,.2,1),opacity .3s;box-shadow:0 12px 44px rgba(15,23,42,.3);}' +
      '#jvgCard.jvg-in{transform:translate(-50%,-50%) scale(1);opacity:1;}' +
      '#jvgCard .jvg-head{display:flex;align-items:center;gap:12px;padding:16px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;flex-shrink:0;}' +
      '#jvgCard .jvg-ava{width:52px;height:52px;border-radius:50%;background:#fff;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.7);}' +
      '#jvgCard .jvg-name{font-weight:800;font-size:17px;line-height:1.2;}' +
      '#jvgCard .jvg-sub{font-size:12px;opacity:.9;}' +
      '#jvgFab{position:fixed;right:16px;bottom:18px;width:60px;height:60px;border-radius:50%;background:#fff;border:none;box-shadow:0 6px 20px rgba(15,23,42,.22);cursor:pointer;z-index:2147482998;overflow:hidden;padding:0;}' +
      '#jvgFab img{width:100%;height:100%;object-fit:cover;}' +
      '#advFloatingFab,#kapuFab,#btnAiAdvisor,#floatingChatBtn{display:none!important;}' +
      '#jvgCard .jvg-reset{margin-left:auto;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:12px;font-weight:700;cursor:pointer;line-height:1;padding:7px 12px;border-radius:999px;font-family:inherit;white-space:nowrap;}' +
      '#jvgCard .jvg-reset:hover{background:rgba(255,255,255,.3);}' +
      '#jvgCard .jvg-x{margin-left:8px;background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;opacity:.9;padding:2px 4px;}' +
      '#jvgCard .jvg-body{flex:1;overflow-y:auto;padding:14px 12px;background:#b2c7d9;}' +
      '#jvgCard .jvg-row{display:flex;align-items:flex-start;gap:7px;margin-bottom:12px;}' +
      '#jvgCard .jvg-row.me{flex-direction:row-reverse;}' +
      '#jvgCard .jvg-row-ava{width:38px;height:38px;border-radius:14px;object-fit:cover;flex-shrink:0;background:#fff;}' +
      '#jvgCard .jvg-rowmain{display:flex;flex-direction:column;min-width:0;max-width:76%;}' +
      '#jvgCard .jvg-row.me .jvg-rowmain{align-items:flex-end;}' +
      '#jvgCard .jvg-who{font-size:12px;color:#36414d;margin:0 0 4px 3px;font-weight:600;}' +
      '#jvgCard .jvg-bubwrap{display:flex;align-items:flex-end;gap:5px;max-width:100%;}' +
      '#jvgCard .jvg-row.me .jvg-bubwrap{flex-direction:row-reverse;}' +
      '#jvgCard .jvg-time{font-size:10px;color:#48596a;white-space:nowrap;margin-bottom:1px;flex-shrink:0;}' +
      '#jvgCard .jvg-msg{font-size:14px;line-height:1.5;color:#1e293b;white-space:pre-wrap;word-break:break-word;min-width:0;padding:9px 12px;border-radius:4px 16px 16px 16px;background:#fff;box-sizing:border-box;}' +
      '#jvgCard .jvg-row.me .jvg-msg{background:#fee500;color:#1a1a1a;border-radius:16px 4px 16px 16px;}' +
      '#jvgCard .jvg-msg a{color:#1a56db;text-decoration:underline;word-break:break-all;}' +
      '#jvgCard .jvg-row.me .jvg-msg a{color:#1a56db;}' +
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
      '#jvgCard .jvg-msg img{max-width:200px;border-radius:10px;display:block;}' +
      '#jvgCard .jvg-quick,#jvgCard .jvg-recs,#jvgCard .jvg-intake{clear:both;}' +
      '#jvgCard .jvg-foot{display:flex;gap:8px;padding:11px 12px;border-top:1px solid #eef2f7;background:#fff;}' +
      '#jvgCard .jvg-in-txt{flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:11px 13px;font-size:14px;font-family:inherit;outline:none;}' +
      '#jvgCard .jvg-in-txt:focus{border-color:#6366f1;}' +
      '#jvgCard .jvg-send{background:#6366f1;border:none;color:#fff;border-radius:12px;padding:0 16px;font-weight:800;font-size:14px;cursor:pointer;}' +
      '#jvgCard .jvg-intake{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #e0e7ff;border-radius:14px;padding:14px;margin:6px 0 4px;}' +
      '#jvgCard .jvg-intake label{font-size:12px;font-weight:700;color:#475569;}' +
      '#jvgCard .jvg-intake input,#jvgCard .jvg-intake select{width:100%;border:1.5px solid #e2e8f0;border-radius:11px;padding:11px 12px;font-size:14px;font-family:inherit;outline:none;color:#1e293b;background:#fff;box-sizing:border-box;}' +
      '#jvgCard .jvg-intake input:focus,#jvgCard .jvg-intake select:focus{border-color:#6366f1;}' +
      '#jvgCard .jvg-intake .jvg-ik-start{background:#4f46e5;border:none;color:#fff;border-radius:12px;padding:12px;font-weight:800;font-size:14px;cursor:pointer;margin-top:2px;}' +
      '#jvgCard .jvg-intake .jvg-ik-start:hover{background:#4338ca;}' +
      '#jvgCard .jvg-custinfo{clear:both;align-self:center;display:inline-flex;align-items:center;gap:11px;justify-content:center;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;border-radius:999px;padding:10px 20px;margin:2px auto 10px;width:fit-content;max-width:92%;}' +
      '#jvgCard .jvg-custinfo .ci-name{font-size:14px;font-weight:800;letter-spacing:.2px;}' +
      '#jvgCard .jvg-custinfo .ci-phone{font-size:13.5px;font-weight:600;opacity:.96;letter-spacing:.3px;}' +
      '#jvgCard .jvg-custinfo .ci-sep{width:1px;height:13px;background:rgba(255,255,255,.45);}' +
      '#jvgCard .jvg-send:disabled{opacity:.5;cursor:default;}' +
      '#jvgCard .jvg-typing{font-size:13px;color:#94a3b8;}';
    document.head.appendChild(st);
  }

  function _nowHM() {
    var d = new Date(); var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? '오전' : '오후'; var h12 = h % 12; if (h12 === 0) h12 = 12;
    return (_lang === 'kr' ? (ap + ' ') : '') + h12 + ':' + (m < 10 ? '0' + m : m);
  }
  function _avaImg() { return '<img class="jvg-row-ava" src="/jarvis-character.jpg?v=1" alt="" onerror="this.src=\'/mascot-character.webp\'">'; }
  // 항상 맨 아래로 스크롤 (rAF — 새 내용 높이 반영 후). 이미지 로드 후에도 다시 호출.
  function _scrollBottom() {
    var b = _root && _root.querySelector('.jvg-body'); if (!b) return;
    requestAnimationFrame(function () { b.scrollTop = b.scrollHeight; });
  }
  // 카톡식 메시지 행 (아바타+이름+말풍선+시간). 반환=말풍선 엘리먼트(타이핑 교체용)
  function _addRow(bubbleHtml, who, senderName) {
    var b = _root.querySelector('.jvg-body');
    var row = document.createElement('div');
    row.className = 'jvg-row ' + (who === 'me' ? 'me' : 'ai');
    var ava = (who === 'me') ? '' : _avaImg();
    var who2 = (who === 'me') ? '' : '<div class="jvg-who">' + esc(senderName || tr('카푸', 'カプ', 'Kapu')) + '</div>';
    row.innerHTML = ava + '<div class="jvg-rowmain">' + who2 +
      '<div class="jvg-bubwrap"><div class="jvg-msg">' + bubbleHtml + '</div><span class="jvg-time">' + _nowHM() + '</span></div></div>';
    b.appendChild(row);
    var _im = row.querySelector('.jvg-msg img'); if (_im) _im.addEventListener('load', _scrollBottom);
    _scrollBottom();
    return row.querySelector('.jvg-msg');
  }
  function addMsg(text, who, senderName) { return _addRow(_linkify(text), who, senderName); }
  function _mgrLabel(senderName) {
    var s = String(senderName || '');
    if (s.indexOf('관리자') >= 0) return (s.replace('관리자', '담당매니저').trim() || '담당매니저');
    return tr('카푸', 'カプ', 'Kapu');
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

  // 2026-09-30(사장님): 버튼 응답을 화면표시 + DB 저장(관리자 콘솔에서도 보이도록). room 있을 때만 저장.
  async function _jvgReply(intentLabel, text) {
    addMsg(text, 'ai');
    try {
      var sb = window.sb;
      if (sb && sb.from && _room) {
        await sb.from('chat_messages').insert({ room_id: _room, sender_type: 'customer', sender_name: '고객', message: '[' + intentLabel + ' 요청]', created_at: new Date().toISOString() });
        await sb.from('chat_messages').insert({ room_id: _room, sender_type: 'chatbot', sender_name: 'AI 카푸', message: text, created_at: new Date().toISOString() });
      }
    } catch (e) {}
  }
  // 2026-09-30(사장님): 지금 상담 가능한 매니저 전화 안내 (chatbot_knowledge _managers). KR 위주, 없으면 본사 전화.
  async function _jvgShowManagers() {
    var hq = (_lang === 'ja') ? '047-712-1148' : '031-366-1984';
    var fallback = tr('상담 전화: ' + hq + ' (평일 09:00-18:00)', 'お電話: ' + hq, 'Call: ' + hq);
    var text = fallback;
    try {
      var sb = window.sb;
      if (sb && sb.from) {
        var r = await sb.from('chatbot_knowledge').select('question,answer,is_active').eq('category', '_managers');
        var NAMES = ['혜림'];
        var rows = (r.data || []).filter(function (x) { return NAMES.some(function (n) { return (x.question || '').indexOf(n) >= 0; }); });
        var lines = [];
        rows.forEach(function (x) {
          var phone = ''; try { phone = (JSON.parse(x.answer || '{}').phone) || ''; } catch (e) {}
          if (!phone) return;
          var fmt = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
          var nm = NAMES.filter(function (n) { return (x.question || '').indexOf(n) >= 0; })[0] || '매니저';
          lines.push('· ' + nm + ' 매니저 — ' + fmt + (x.is_active === false ? ' (지금 부재중)' : ''));
        });
        if (lines.length) text = tr('지금 상담 가능한 매니저야. 편하게 전화해줘:\n', '担当マネージャーです:\n', 'Available managers:\n') + lines.join('\n');
      }
    } catch (e) {}
    _jvgReply(tr('매니저 안내', '担当マネージャー', 'Manager'), text);
  }
  // 인사 아래 안내 버튼: 매니저 / 이메일 / 사진올리기 / 출고문의(본사)
  function addGreetActions() {
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-quick';
    var hq = (_lang === 'ja') ? '047-712-1148' : '031-366-1984';
    var acts = [
      { label: tr('매니저 안내', '担当マネージャー', 'Manager'), fn: _jvgShowManagers },
      { label: tr('이메일 안내', 'メール', 'Email'), fn: function () { _jvgReply(tr('이메일 안내', 'メール', 'Email'), tr('이메일로 문의할래? 여기로 보내줘:\ndesign@chameleon.design', 'メールはこちら:\ndesign@chameleon.design', 'Email us:\ndesign@chameleon.design')); } },
      { label: tr('사진 올리기', '写真を送る', 'Upload photo'), fn: function () { var f = _root.querySelector('.jvg-file'); if (f) f.click(); } },
      { label: tr('출고 문의', '出荷の問い合わせ', 'Shipping'), fn: function () { _jvgReply(tr('출고 문의', '出荷の問い合わせ', 'Shipping'), tr('출고·배송 문의는 본사로 연락해줘:\n' + hq + ' (평일 09:00-18:00)', '出荷・配送は本社へ:\n' + hq, 'For shipping, call HQ:\n' + hq)); } }
    ];
    acts.forEach(function (a) { var btn = document.createElement('button'); btn.className = 'jvg-q'; btn.textContent = a.label; btn.addEventListener('click', a.fn); wrap.appendChild(btn); });
    b.appendChild(wrap); b.scrollTop = b.scrollHeight;
  }

  function readImage(file, cb) {
    try { var r = new FileReader(); r.onload = function () { var du = String(r.result); cb((du.split(',')[1] || ''), file.type || 'image/jpeg', du); }; r.readAsDataURL(file); } catch (e) {}
  }
  function addImageMsg(dataUrl) { return _addRow('<img src="' + dataUrl + '" alt="">', 'me'); }
  // 담당매니저/시스템 메시지(관리자 답변)를 고객 화면에 표시 (AI·본인 메시지는 이미 표시되므로 제외)
  function _renderIncoming(m) {
    if (!m || !_root) return;
    var who = _mgrLabel(m.sender_name);
    if (m.message) _addRow(_linkify(m.message), 'ai', who);
    if (m.file_url) {
      var ft = String(m.file_type || '').toLowerCase();
      var isImg = ft.indexOf('image') === 0 || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(m.file_url);
      var html = isImg
        ? '<img src="' + esc(m.file_url) + '" alt="" style="cursor:pointer;" onclick="window.open(\'' + esc(m.file_url) + '\',\'_blank\')">'
        : '<a href="' + esc(m.file_url) + '" target="_blank" rel="noopener">' + esc(m.file_name || '첨부파일') + '</a>';
      _addRow(html, 'ai', who);
    }
  }
  function _onIncoming(m) {
    if (!m || !m.id) return;
    if (_seenMsgIds[m.id]) return;
    _seenMsgIds[m.id] = 1;
    var isMgr = m.sender_type !== 'customer' && String(m.sender_name || '').indexOf('관리자') >= 0;
    var isSystem = m.sender_type === 'system';
    if (isMgr || isSystem) {
      // 매니저가 답했으니 자리비움 타이머/제안 취소
      if (_humanWaitTimer) { clearTimeout(_humanWaitTimer); _humanWaitTimer = null; }
      _hideAiTakeoverPrompt();
      _renderIncoming(m);   // AI(카푸)·고객 본인 메시지는 이미 표시됨 → 제외
    }
  }
  // 담당자 자리비움 — 30초 내 답 없으면 "AI 전환?" 제안 + 버튼
  function _startHumanWaitTimer() {
    if (_humanWaitTimer) clearTimeout(_humanWaitTimer);
    _humanWaitTimer = setTimeout(function () { _humanWaitTimer = null; _showAiTakeoverPrompt(); }, 30000);
  }
  function _hideAiTakeoverPrompt() {
    if (!_root) return;
    var el = _root.querySelector('.jvg-takeover'); if (el) { try { el.remove(); } catch (e) {} }
  }
  function _showAiTakeoverPrompt() {
    if (!_root) return;
    _hideAiTakeoverPrompt();
    addMsg(tr(
      '담당자가 잠시 자리를 비웠어요. 1분 후에도 답변이 없으면 인공지능인 제가 대신 답해 드려도 될까요?',
      '担当者が少し席を外しています。1分後も返信がなければ、AIの私が代わりにお答えしてもよろしいですか？',
      'The manager has stepped away. If there\'s no reply within a minute, may I (the AI) answer instead?'
    ), 'ai');
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-quick jvg-takeover';
    var b1 = document.createElement('button'); b1.className = 'jvg-q jvg-q-primary';
    b1.textContent = tr('인공지능으로 전환', 'AIに切り替える', 'Switch to AI');
    b1.addEventListener('click', function () { _hideAiTakeoverPrompt(); _takeoverAI(); });
    var b2 = document.createElement('button'); b2.className = 'jvg-q';
    b2.textContent = tr('상담사 기다리기', '相談員を待つ', 'Keep waiting');
    b2.addEventListener('click', function () { _hideAiTakeoverPrompt(); _startHumanWaitTimer(); });
    wrap.appendChild(b1); wrap.appendChild(b2);
    b.appendChild(wrap); _scrollBottom();
  }
  function _takeoverAI() {
    _humanNoticeShown = false;
    _forceAiNext = true;
    send(_lastAskedText || tr('안내해 주세요', '案内してください', 'Please help me'), null, true);
  }
  function _subscribeRoom() {
    if (!_room) return;
    var sb = window.sb; if (!sb || !sb.channel) return;
    if (_msgSub) { try { _msgSub.unsubscribe(); } catch (e) {} _msgSub = null; }
    try {
      _msgSub = sb.channel('kapu-room-' + _room)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'room_id=eq.' + _room }, function (p) { _onIncoming(p.new); })
        .subscribe();
    } catch (e) {}
  }
  function _unsubscribeRoom() { if (_msgSub) { try { _msgSub.unsubscribe(); } catch (e) {} _msgSub = null; } }
  // 열 때 그동안 놓친 담당매니저 답변을 불러와 표시
  async function _loadMissed() {
    if (!_room) return;
    try {
      var sb = window.sb; if (!sb || !sb.from) return;
      var r = await sb.from('chat_messages').select('id, sender_type, sender_name, message, file_url, file_name, file_type, created_at').eq('room_id', _room).order('created_at', { ascending: true }).limit(100);
      var rows = (r && r.data) || [];
      rows.forEach(function (m) {
        if (_seenMsgIds[m.id]) return;
        _seenMsgIds[m.id] = 1;
        var isMgr = m.sender_type !== 'customer' && String(m.sender_name || '').indexOf('관리자') >= 0;
        var isSystem = m.sender_type === 'system';
        if (isMgr || isSystem) _renderIncoming(m);
      });
    } catch (e) {}
  }
  // 입력을 성함으로 캡처 → 저장 + 기존 방 이름 반영 + 보류 메시지 이어서 전송
  async function _captureName(raw) {
    addMsg(raw, 'me');
    var name = String(raw || '').trim().split('\n')[0].replace(/[\t<>]/g, '').slice(0, 20).trim();
    if (!name) { addMsg(tr('성함을 다시 한 번 알려주시겠어요? 😊', 'もう一度お名前を教えていただけますか😊', 'Could you tell me your name again? 😊'), 'ai'); return; }
    _custName = name; _awaitingName = false;
    try { localStorage.setItem('kapu_cust_name', _custName); } catch (e) {}
    _syncCustToRoom();
    addMsg(tr('반가워요 ' + _custName + '님! 그럼 안내해 드릴게요 😊', _custName + '様、よろしくお願いします！ご案内します😊', 'Nice to meet you, ' + _custName + '! Let me help 😊'), 'ai');
    var pend = _pendingMsg; _pendingMsg = '';
    if (pend) send(pend, null, true);
  }
  async function send(text, image, _noEcho) {
    if (_busy || (!text && !image)) return;
    text = text || '';
    // (1) 이름 대기중이면 이번 입력을 성함으로 처리
    if (_awaitingName && text) { _captureName(text); return; }
    // (2) 성함 미수집 + 텍스트 첫 메시지면 먼저 성함을 물어봄 (이미지 전송은 제외)
    if (!_custName && text && !image) {
      addMsg(text, 'me');
      _pendingMsg = text; _awaitingName = true;
      addMsg(tr('반갑습니다! 먼저 성함을 알려주시겠어요? 😊 (바로 이어서 안내해 드릴게요)', 'はじめまして！まずお名前を教えていただけますか😊（すぐにご案内します）', 'Nice to meet you! May I have your name first? 😊 (I\'ll help right after)'), 'ai');
      return;
    }
    _busy = true;
    var sendBtn = _root.querySelector('.jvg-send'); if (sendBtn) sendBtn.disabled = true;
    if (image && image.dataUrl) addImageMsg(image.dataUrl);
    if (text && !_noEcho) addMsg(text, 'me');
    var typing = addMsg(image ? tr('잠깐만, 이미지 확인할게…', 'ちょっと写真を確認するね…', 'Let me check the image…') : tr('카푸가 입력 중…', 'カプが入力中…', 'Kapu is typing…'), 'ai');
    typing.classList.add('jvg-typing');
    try {
      var payload = { message: text || (image ? tr('이 사진 보고 안내해줘', 'この写真を見て案内して', 'Guide me based on this photo') : ''), lang: _lang, conversation_history: _hist.slice(-30) };
      if (_room) payload.room_id = _room;
      if (_custName) payload.customer_name = _custName;
      if (_custPhone) payload.customer_phone = _custPhone;   // 2026-10-07: 전화번호도 서버 저장(window.sb 미의존)
      if (_forceAiNext) { payload.force_ai = true; _forceAiNext = false; }   // 담당자 자리비움 → AI 전환
      if (image && image.base64) { payload.image = image.base64; payload.image_type = image.type; }
      var res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY, 'apikey': SUPA_KEY }, body: JSON.stringify(payload) });
      var data = await res.json();
      if (data.room_id) { var _wasNew = (_room !== data.room_id); _room = data.room_id; try { localStorage.setItem('kapu_room_id', _room); } catch (e) {} if (_wasNew) { _subscribeRoom(); _syncCustToRoom(); } }
      if (data.human_active) {
        // 담당 매니저가 직접 응대 중 — AI 폴백 대신 조용히 처리. 매니저 답변은 실시간 구독으로 도착.
        try { typing.remove(); } catch (e) {}
        _hist.push({ role: 'user', content: text || '[사진 업로드]' });
        if (!_humanNoticeShown) { _humanNoticeShown = true; addMsg(tr('담당 매니저가 직접 확인하고 있어요. 잠시만 기다려 주세요 🙋', '担当マネージャーが確認中です。少々お待ちください🙋', 'A manager is handling this now. One moment 🙋'), 'ai'); }
        _subscribeRoom();
        _lastAskedText = text || _lastAskedText;   // 자리비움 시 AI 전환으로 다시 물어볼 질문
        _startHumanWaitTimer();                     // 30초 내 매니저 답 없으면 AI 전환 제안
        _scrollBottom();
      } else {
        if (_humanWaitTimer) { clearTimeout(_humanWaitTimer); _humanWaitTimer = null; }
        var msg = stripMd(data.chat_message || data.summary || tr('무엇을 도와드릴까요?', '何かお手伝いできますか？', 'How can I help?'));
        typing.classList.remove('jvg-typing'); typing.innerHTML = _linkify(msg);
        _hist.push({ role: 'user', content: text || '[사진 업로드]' });
        _hist.push({ role: 'assistant', content: msg });
        addRecs(data.products);
        _scrollBottom();
      }
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
      '와, 아주 잘하셨어요!\n제품과 옵션을 잘 고르셨다면 이제 주문하실 수 있어요.\n혹시 다른 상품이 더 필요하시면 사진이나 제품명을 말씀해 주세요. 링크를 드릴게요.',
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

  // 2026-10-07(사장님): 첫 진입 인테이크 폼 — 성함 + 제품종류 선택
  function _addLinkAction(label, href) {
    var b = _root.querySelector('.jvg-body');
    var wrap = document.createElement('div'); wrap.className = 'jvg-quick';
    var btn = document.createElement('button'); btn.className = 'jvg-q jvg-q-primary'; btn.textContent = label;
    btn.addEventListener('click', function () { close(); location.href = href; });
    wrap.appendChild(btn); b.appendChild(wrap); b.scrollTop = b.scrollHeight;
  }
  // 성함/전화 → 현재 방에 반영 (customer_name 은 깨끗한 이름만, 전화는 별도 컬럼)
  function _syncCustToRoom() {
    try { var sb = window.sb; if (sb && sb.from && _room) { var u = {}; if (_custName) u.customer_name = _custName; if (_custPhone) u.customer_phone = _custPhone; if (Object.keys(u).length) sb.from('chat_rooms').update(u).eq('id', _room); } } catch (e) {}
  }
  function _fmtPhone(p) {
    p = String(p == null ? '' : p).replace(/[^0-9]/g, '');
    if (p.length === 11) return p.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    if (p.length === 10) return p.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    return String(_custPhone || '');
  }
  // 기존 고객 정보 줄 (매니저 안내 위) — 보라 그라데이션 박스, 흰 글씨, 픽토그램 없음
  function _custInfoLine() {
    if (!_custName && !_custPhone) return;
    var b = _root.querySelector('.jvg-body');
    var d = document.createElement('div'); d.className = 'jvg-custinfo';
    d.innerHTML = '<span class="ci-name">' + esc(_custName || tr('고객', 'お客様', 'Customer')) + '</span>' +
      (_custPhone ? ('<span class="ci-sep"></span><span class="ci-phone">' + esc(_fmtPhone(_custPhone)) + '</span>') : '');
    b.appendChild(d); b.scrollTop = b.scrollHeight;
  }
  function _addIntakeForm() {
    var b = _root.querySelector('.jvg-body');
    var TYPES = ['허니콤보드', '종이매대', '패브릭', '기타', '가맹문의'];
    var JA = { '허니콤보드': 'ハニカムボード', '종이매대': '紙什器', '패브릭': 'ファブリック', '기타': 'その他', '가맹문의': '加盟のお問い合わせ' };
    var EN = { '허니콤보드': 'Honeycomb Board', '종이매대': 'Paper Display', '패브릭': 'Fabric', '기타': 'Other', '가맹문의': 'Franchise' };
    function optLabel(v) { return _lang === 'ja' ? JA[v] : (_lang === 'kr' ? v : EN[v]); }
    var opts = TYPES.map(function (v) { return '<option value="' + v + '">' + esc(optLabel(v)) + '</option>'; }).join('');
    var wrap = document.createElement('div'); wrap.className = 'jvg-intake';
    wrap.innerHTML =
      '<label>' + tr('성함', 'お名前', 'Name') + '</label>' +
      '<input class="jvg-ik-name" type="text" value="' + esc(_custName) + '" placeholder="' + tr('성함을 입력해줘', 'お名前を入力', 'Your name') + '">' +
      '<label>' + tr('전화번호', '電話番号', 'Phone') + '</label>' +
      '<input class="jvg-ik-phone" type="tel" value="' + esc(_custPhone) + '" placeholder="' + tr('예: 010-1234-5678', '例: 090-1234-5678', 'e.g. 010-1234-5678') + '">' +
      '<label>' + tr('제품 종류', '製品の種類', 'Product type') + '</label>' +
      '<select class="jvg-ik-type"><option value="">' + tr('선택해줘', '選択してね', 'Select') + '</option>' + opts + '</select>' +
      '<button class="jvg-ik-start">' + tr('상담 시작', '相談を始める', 'Start') + '</button>';
    b.appendChild(wrap); b.scrollTop = b.scrollHeight;
    var nameInp = wrap.querySelector('.jvg-ik-name'), phoneInp = wrap.querySelector('.jvg-ik-phone'), typeSel = wrap.querySelector('.jvg-ik-type'), startBtn = wrap.querySelector('.jvg-ik-start');
    nameInp.addEventListener('input', function () { nameInp.style.borderColor = ''; });
    phoneInp.addEventListener('input', function () { phoneInp.style.borderColor = ''; });
    startBtn.addEventListener('click', function () {
      var nm = (nameInp.value || '').trim().replace(/[\t<>]/g, '').slice(0, 20);
      var ph = (phoneInp.value || '').trim().replace(/[^0-9+\-\s]/g, '').slice(0, 20);
      var ty = typeSel.value;
      if (!nm) { nameInp.focus(); nameInp.style.borderColor = '#ef4444'; return; }
      if (ph.replace(/[^0-9]/g, '').length < 8) { phoneInp.focus(); phoneInp.style.borderColor = '#ef4444'; return; }
      _custName = nm; _custPhone = ph; _awaitingName = false;
      try { localStorage.setItem('kapu_cust_name', _custName); localStorage.setItem('kapu_cust_phone', _custPhone); } catch (e) {}
      _syncCustToRoom();
      try { wrap.remove(); } catch (e) {}
      addMsg(tr('반가워요 ' + _custName + '님! 😊', _custName + '様、よろしくお願いします！😊', 'Nice to meet you, ' + _custName + '!'), 'ai');
      if (ty === '가맹문의') {
        addMsg(tr('가맹·리셀러 안내 페이지로 안내해 드릴게요!', '加盟・リセラーのご案内ページへご案内します！', 'Let me take you to our franchise page!'), 'ai');
        _addLinkAction(tr('가맹 안내 보러가기 →', '加盟案内を見る →', 'View franchise →'), '/franchise');
      } else if (ty) {
        var label = optLabel(ty);
        send(tr(label + ' 제작하려고 해요', label + 'を作りたいです', 'I want to make ' + label));
      } else {
        addMsg(tr('어떤 제품이 필요하신지 알려주시면 도와드릴게요! (사진·제품명 환영)', 'どんな製品が必要かお知らせください！（写真・製品名OK）', 'Tell me what product you need! (photo or name)'), 'ai');
        addGreetActions();
      }
    });
    nameInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); phoneInp.focus(); } });
    phoneInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); typeSel.focus(); } });
  }
  // 인사 렌더 (첫진입=성함/전화 폼, 재방문=안내+버튼). open() 과 리셋에서 공용.
  function _renderGreeting() {
    if (!_custName || !_custPhone) {
      addMsg(tr(
        '안녕하세요! 카멜레온 카푸예요 😊\n성함과 연락처를 남겨주시면 담당자가 더 정확히 도와드릴 수 있어요!',
        'こんにちは！カメレオンのカプです😊\nお名前とご連絡先を教えていただけますか？',
        'Hi! I\'m Kapu 😊\nPlease leave your name and phone so we can help you better!'
      ), 'ai');
      _addIntakeForm();
    } else {
      addMsg(tr(
        '안녕하세요! 행사 준비 중이신가요? 제가 안내해 드릴게요.\n\n주문하는 방법은 2가지가 있어요.\n\n' +
        '1. 채팅창에 만들고 싶은 제품 이미지를 끌어다 놓으시거나, "가벽"·"배너"처럼 제품명을 말씀해 주세요. 딱 맞는 링크를 드릴게요. 링크에 들어가시면 튜토리얼로 차근차근 안내해 드려요.\n\n' +
        '2. 직접 하기 어려우시면 담당 매니저를 통해 주문하실 수도 있어요. 아래 "매니저 안내"를 누르시면 지금 상담 가능한 매니저를 안내해 드릴게요.',
        'こんにちは！イベントの準備かな？案内するよ。\n\nご注文の方法は2つあるよ。\n\n' +
        '1. チャットに作りたい製品の画像をドラッグするか、「パーティション」「バナー」のように製品名を教えてね。ぴったりのリンクを送るよ。リンクに入るとチュートリアルで案内するよ。\n\n' +
        '2. 難しければ担当マネージャー経由でも注文できるよ。下の「担当マネージャー」を押すと、今対応できるマネージャーの電話番号を送るよ。',
        'Hi! Planning an event? Let me guide you.\n\nThere are 2 ways to order.\n\n' +
        '1. Drag a product image into the chat, or just tell me the product (e.g. "wall", "banner"). I\'ll send the right link — it has a step-by-step tutorial.\n\n' +
        '2. Prefer a person? You can order through your manager. Tap "Manager" below and I\'ll share an available manager\'s number.'
      ), 'ai');
      _custInfoLine();
      addGreetActions();
    }
  }
  // 2026-10-07(사장님): 채팅 리셋 — 지금까지 대화 삭제 + 새 채팅 시작(새 room). 성함/전화는 유지.
  function _resetChat() {
    if (!confirm(tr(
      '지금까지의 대화 내용이 삭제되고 새로운 채팅이 시작됩니다. 계속하시겠어요?',
      'これまでの会話が削除され、新しい会話が始まります。よろしいですか？',
      'Your current conversation will be cleared and a new chat will start. Continue?'
    ))) return;
    try { _unsubscribeRoom(); } catch (e) {}
    if (_humanWaitTimer) { clearTimeout(_humanWaitTimer); _humanWaitTimer = null; }
    _room = null; _hist = []; _seenMsgIds = {}; _humanNoticeShown = false; _awaitingName = false; _pendingMsg = ''; _lastAskedText = ''; _forceAiNext = false;
    try { localStorage.removeItem('kapu_room_id'); } catch (e) {}
    var b = _root && _root.querySelector('.jvg-body'); if (b) b.innerHTML = '';
    _renderGreeting();
    _scrollBottom();
  }
  function open(mode) {
    if (_root) return;   // 이미 열려 있으면 무시
    ensureStyles();
    _backdrop = document.createElement('div'); _backdrop.id = 'jvgBackdrop';
    _backdrop.addEventListener('click', close);
    document.body.appendChild(_backdrop);
    _root = document.createElement('div'); _root.id = 'jvgCard';
    _root.innerHTML =
      '<div class="jvg-head"><img class="jvg-ava" src="/jarvis-character.jpg?v=1" alt="카푸" onerror="this.src=\'/mascot-character.webp\'"><div><div class="jvg-name">' + tr('카멜레온 카푸', 'カメレオン カプ', 'Chameleon Kapu') + '</div><div class="jvg-sub">' + tr('편하게 말씀해 주세요~', 'お気軽にどうぞ', 'Talk to me anytime') + '</div></div><button class="jvg-reset" type="button">' + tr('새 채팅', '新しい会話', 'New chat') + '</button><button class="jvg-x" aria-label="close">×</button></div>' +
      '<div class="jvg-body"></div>' +
      '<div class="jvg-foot"><button class="jvg-img" title="' + tr('사진 올리기', '写真', 'Photo') + '">📷</button><input class="jvg-file" type="file" accept="image/*" style="display:none"><input class="jvg-in-txt" type="text" placeholder="' + tr('사진 올리거나 · 예: 가벽 3미터 · 배너 · 글씨스카시…', '写真、または例: パーティション3m…', 'Upload a photo, or e.g. 3m wall…') + '"><button class="jvg-send">' + tr('보내기', '送信', 'Send') + '</button></div>';
    document.body.appendChild(_root);
    if (mode === 'aftercart') {
      addMsg(_afterCartMsg(), 'ai');
      _addCartActions();
    } else {
      _renderGreeting();
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
    var _rst = _root.querySelector('.jvg-reset'); if (_rst) _rst.addEventListener('click', _resetChat);
    // 담당매니저 답변 실시간 수신 (기존 방이 있으면 놓친 답변도 불러와 표시)
    if (_room) { _loadMissed(); _subscribeRoom(); }
  }

  function close() {
    _unsubscribeRoom();
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
