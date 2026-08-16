/* biz-promo.js — 업체 홍보 소셜 피드 (2026-08-16)
 * 등록(첫 등록 시 1만원 보상) + 무한스크롤 피드(스레드/틱톡풍) + 하트 + 댓글 + 검색.
 * DB: biz_promos / biz_promo_likes / biz_promo_comments + RPC(biz_promo_create/like_toggle/comment).
 * 진입: window.openBizPromo()  (리워드 허브의 '내 업체 홍보' 행에서 호출)
 */
(function () {
    'use strict';
    var SB_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
    var PAGE = 8;
    var _offset = 0, _loading = false, _done = false, _q = '', _uid = null, _likedSet = {};

    function sb() {
        if (window.sb && window.sb.auth) return window.sb;
        if (window.supabase && window.supabase.createClient) {
            window.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storage: localStorage, storageKey: 'sb-qinvtnhiidtmrzosyvys-auth-token' } });
            return window.sb;
        }
        return null;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function country() { return (window.__SITE_CODE || 'KR'); }
    function siteLang() { var c = country(); return c === 'JP' ? 'ja' : (c === 'US' ? 'en' : 'ko'); }
    function T(ko, ja, en) { var l = siteLang(); return l === 'ja' ? ja : (l === 'en' ? en : ko); }
    function toast(m) { try { if (window.showToast) return window.showToast(m); } catch (e) {} try { alert(m); } catch (e) {} }
    async function getUid() { try { var u = await sb().auth.getUser(); return (u && u.data && u.data.user && u.data.user.id) || null; } catch (e) { return null; } }
    function needLogin() {
        if (window.openAuthModal) { try { window.openAuthModal('login'); return; } catch (e) {} }
        toast('로그인이 필요합니다.');
    }
    function fmtAgo(iso) { try { var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return Math.floor(s / 86400) + '일 전'; } catch (e) { return ''; } }

    function injectStyles() {
        if (document.getElementById('bizPromoStyle')) return;
        var s = document.createElement('style'); s.id = 'bizPromoStyle';
        s.textContent = ''
            /* 라운딩 모달 + 배경 살짝 비침 (SUMMER EVENT 창처럼) */
            + '#bizFeedOv{position:fixed;inset:0;z-index:100060;background:rgba(2,6,23,0.55);display:none;align-items:center;justify-content:center;padding:20px;}'
            + '#bizFeedOv.open{display:flex;}'
            + '.bz-panel{position:relative;background:#0b0f1c;width:460px;max-width:100%;height:86vh;max-height:900px;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(148,163,184,0.18);box-shadow:0 24px 60px rgba(0,0,0,0.55);}'
            + '@media(max-width:640px){#bizFeedOv{padding:0;} .bz-panel{height:100%;border-radius:0;}}'
            + '.bz-desc{flex:0 0 auto;padding:11px 16px;font-size:11.5px;color:#94a3b8;line-height:1.65;border-bottom:1px solid rgba(148,163,184,0.12);background:#0f172a;}'
            + '.bz-desc b{color:#c7d2fe;font-weight:800;}'
            + '.bz-head{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,0.15);background:#0f172a;}'
            + '.bz-head h3{margin:0;font-size:16px;font-weight:900;color:#fff;white-space:nowrap;}'
            + '.bz-search{flex:1;min-width:0;padding:9px 13px;border-radius:999px;border:1px solid rgba(148,163,184,0.3);background:rgba(255,255,255,0.06);color:#f8fafc;font-size:14px;font-family:inherit;outline:none;}'
            + '.bz-search::placeholder{color:#64748b;}'
            + '.bz-reg{flex:0 0 auto;padding:9px 14px;border:none;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;}'
            + '.bz-x{flex:0 0 auto;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);color:#cbd5e1;border:none;font-size:18px;cursor:pointer;}'
            + '.bz-feed{flex:1;overflow-y:auto;padding:14px;width:100%;-webkit-overflow-scrolling:touch;}'
            /* 스레드풍 포스트 (아바타+업체명 상단 · 구분선 · 가로 사진 줄) */
            + '.bz-post{display:flex;gap:11px;padding:15px 4px 13px;border-bottom:1px solid rgba(255,255,255,0.08);}'
            + '.bz-av{flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;}'
            + '.bz-col{flex:1;min-width:0;}'
            + '.bz-phead{display:flex;align-items:center;gap:6px;margin-bottom:3px;}'
            + '.bz-uname{font-size:14.5px;font-weight:800;color:#f8fafc;}'
            + '.bz-time{font-size:12px;color:#71767b;}'
            + '.bz-text{font-size:14px;color:#e7e9ea;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin-bottom:9px;}'
            + '.bz-hash{color:#7da3ff;}'
            + '.bz-photos{display:flex;gap:8px;overflow-x:auto;margin:2px 0 10px;scrollbar-width:none;cursor:grab;user-select:none;-webkit-user-select:none;}'
            + '.bz-photos.dragging{cursor:grabbing;}'
            + '.bz-photos img{pointer-events:none;}'
            + '.bz-photos::-webkit-scrollbar{display:none;}'
            + '.bz-photos img{flex:0 0 auto;width:200px;height:250px;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,0.1);}'
            + '.bz-photos img.single{width:auto;max-width:100%;height:auto;max-height:64vh;}'
            + '.bz-phone{font-size:13px;color:#86efac;font-weight:700;margin-bottom:9px;}'
            + '.bz-phone a{color:#86efac;text-decoration:none;}'
            + '.bz-acts{display:flex;gap:22px;align-items:center;}'
            + '.bz-act{display:flex;align-items:center;gap:6px;background:none;border:none;color:#71767b;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;}'
            + '.bz-act.liked{color:#f91880;}'
            + '.bz-cmts{margin-top:12px;border-top:1px solid rgba(148,163,184,0.12);padding-top:10px;display:none;}'
            + '.bz-cmts.open{display:block;}'
            + '.bz-cmt{font-size:13px;color:#e2e8f0;margin-bottom:7px;line-height:1.5;}'
            + '.bz-cmt b{color:#93c5fd;font-weight:800;margin-right:6px;}'
            + '.bz-cmt-in{display:flex;gap:6px;margin-top:8px;}'
            + '.bz-cmt-in input{flex:1;min-width:0;padding:8px 11px;border-radius:9px;border:1px solid rgba(148,163,184,0.3);background:rgba(255,255,255,0.06);color:#f8fafc;font-size:13px;font-family:inherit;outline:none;}'
            + '.bz-cmt-in button{padding:8px 14px;border:none;border-radius:9px;background:#4f46e5;color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;}'
            + '.bz-empty{text-align:center;color:#94a3b8;padding:60px 20px;font-size:15px;line-height:1.6;}'
            + '.bz-more{text-align:center;color:#64748b;padding:16px;font-size:13px;}'
            /* 등록 모달 */
            + '#bizRegOv{position:fixed;inset:0;z-index:100070;background:rgba(2,6,23,0.8);display:none;align-items:center;justify-content:center;padding:14px;}'
            + '#bizRegOv.open{display:flex;}'
            + '.bz-reg-card{position:relative;background:#fff;border-radius:20px;padding:22px;width:460px;max-width:100%;max-height:92vh;overflow-y:auto;}'
            + '.bz-reg-card h3{margin:0 0 4px;font-size:18px;font-weight:900;color:#1e293b;}'
            + '.bz-reg-card .bz-reg-sub{font-size:12.5px;color:#7c3aed;font-weight:700;margin-bottom:14px;}'
            + '.bz-reg-card label{display:block;font-size:12px;font-weight:700;color:#334155;margin:10px 0 4px;}'
            + '.bz-reg-card input[type=text],.bz-reg-card input[type=tel],.bz-reg-card textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;font-family:inherit;color:#1e293b;}'
            + '.bz-reg-card textarea{resize:vertical;min-height:80px;}'
            + '.bz-reg-photos{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}'
            + '.bz-reg-photos .bz-thumb{width:70px;height:70px;border-radius:10px;object-fit:cover;border:1px solid #e2e8f0;}'
            + '.bz-reg-submit{width:100%;margin-top:16px;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}'
            + '.bz-reg-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;background:#1e293b;color:#fff;border:none;font-size:18px;cursor:pointer;}';
        document.head.appendChild(s);
    }

    function ensureFeedDom() {
        if (document.getElementById('bizFeedOv')) return;
        var ov = document.createElement('div'); ov.id = 'bizFeedOv';
        ov.innerHTML = ''
            + '<div class="bz-panel">'
            +   '<div class="bz-head">'
            +     '<h3>🏢 ' + T('커뮤니티', 'コミュニティ', 'Community') + '</h3>'
            +     '<input class="bz-search" id="bzSearch" placeholder="' + T('업체 검색', '業者を検索', 'Search businesses') + '">'
            +     '<button class="bz-reg" id="bzRegBtn">+ ' + T('홍보', 'PR', 'Post') + '</button>'
            +     '<button class="bz-x" id="bzCloseBtn">×</button>'
            +   '</div>'
            +   '<div class="bz-desc">' + T(
                    '내 업체를 홍보하고 다른 사장님들과 소통해요. <b>하트를 받을 때마다 마일리지 100원</b>이 쌓입니다. 내가 필요했던 업체를 검색할 수 있어요. 카멜레온과 함께하는 업체들은 열심히 하시는 분들이라 믿을 수 있어요 ❤',
                    '自分のお店をPRして、他のオーナーさんと交流しましょう。<b>ハートをもらうたびに100円分のマイル</b>が貯まります。必要な業者を検索できます。カメレオンと一緒に頑張るお店は信頼できます ❤',
                    'Promote your business and connect with other owners. <b>Earn ₩100 mileage for every heart</b> you receive. Search for the business you need. Businesses with Chameleon work hard — you can trust them ❤'
                  ) + '</div>'
            +   '<div class="bz-feed" id="bzFeed"></div>'
            + '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (window._bzSuppressClick) { window._bzSuppressClick = false; return; } if (e.target === ov) ov.classList.remove('open'); });   // 배경 클릭 시 닫기 (드래그 직후 클릭은 무시)
        document.getElementById('bzCloseBtn').onclick = function () { ov.classList.remove('open'); };
        document.getElementById('bzRegBtn').onclick = openRegister;
        var feed = document.getElementById('bzFeed');
        feed.addEventListener('scroll', function () { if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 200) loadFeed(false); });
        var si = document.getElementById('bzSearch'); var t = null;
        si.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { _q = si.value.trim(); loadFeed(true); }, 350); });
    }

    window.openBizPromo = async function () {
        injectStyles(); ensureFeedDom();
        document.getElementById('bizFeedOv').classList.add('open');
        _uid = await getUid();
        loadFeed(true);
    };

    async function loadFeed(reset) {
        var feed = document.getElementById('bzFeed'); if (!feed) return;
        if (reset) { _offset = 0; _done = false; feed.innerHTML = '<div class="bz-more">불러오는 중…</div>'; }
        if (_loading || _done) return;
        _loading = true;
        try {
            var s = sb(); if (!s) { feed.innerHTML = '<div class="bz-empty">잠시 후 다시 열어주세요.</div>'; return; }
            var qb = s.from('biz_promos').select('id,user_id,name,phone,keywords,intro,photos,like_count,comment_count,created_at').eq('country_code', country()).order('created_at', { ascending: false }).range(_offset, _offset + PAGE - 1);
            if (_q) qb = qb.or('name.ilike.%' + _q + '%,keywords.ilike.%' + _q + '%,intro.ilike.%' + _q + '%');
            var r = await qb;
            if (r.error) throw r.error;
            var rows = r.data || [];
            if (reset) feed.innerHTML = '';
            if (!rows.length && _offset === 0) {
                feed.innerHTML = '<div class="bz-empty">' + T('아직 등록된 업체가 없어요.<br>맨 위 <b>+ 홍보</b> 로 첫 홍보를 올려보세요!', 'まだ登録された業者がありません。<br>上の <b>+ PR</b> から最初の投稿をしてみましょう！', 'No businesses yet.<br>Tap <b>+ Post</b> above to add the first one!') + '</div>';
                _done = true; return;
            }
            // 내가 하트 누른 것 표시
            if (_uid && rows.length) {
                try {
                    var ids = rows.map(function (x) { return x.id; });
                    var lk = await s.from('biz_promo_likes').select('promo_id').eq('user_id', _uid).in('promo_id', ids);
                    (lk.data || []).forEach(function (x) { _likedSet[x.promo_id] = true; });
                } catch (e) {}
            }
            var frag = document.createDocumentFragment();
            rows.forEach(function (p) { var el = document.createElement('div'); el.innerHTML = renderCard(p); frag.appendChild(el.firstChild); });
            feed.appendChild(frag);
            _offset += rows.length;
            if (rows.length < PAGE) _done = true;
            bindCards();
        } catch (e) { console.warn('[bizPromo] feed', e); if (reset) feed.innerHTML = '<div class="bz-empty">불러오지 못했어요.</div>'; }
        finally { _loading = false; }
    }

    function renderCard(p) {
        var photos = [];
        try { photos = Array.isArray(p.photos) ? p.photos : (typeof p.photos === 'string' ? JSON.parse(p.photos) : []); } catch (e) { photos = []; }
        var single = photos.length === 1;
        var photoHtml = photos.length ? '<div class="bz-photos">' + photos.map(function (u) { return '<img class="' + (single ? 'single' : '') + '" src="' + esc(u) + '" loading="lazy" alt="">'; }).join('') + '</div>' : '';
        var kws = (p.keywords || '').split(/[,#\s]+/).filter(Boolean).slice(0, 10);
        var hashLine = kws.length ? '  ' + kws.map(function (k) { return '<span class="bz-hash">#' + esc(k) + '</span>'; }).join(' ') : '';
        var liked = !!_likedSet[p.id];
        var av = esc((p.name || '?').slice(0, 1).toUpperCase());
        var textHtml = (p.intro || hashLine) ? '<div class="bz-text">' + esc(p.intro || '') + hashLine + '</div>' : '';
        return '<div class="bz-post" data-id="' + p.id + '">'
            + '<div class="bz-av">' + av + '</div>'
            + '<div class="bz-col">'
            +   '<div class="bz-phead"><span class="bz-uname">' + esc(p.name) + '</span><span class="bz-time">· ' + fmtAgo(p.created_at) + '</span></div>'
            +   textHtml
            +   photoHtml
            +   (p.phone ? '<div class="bz-phone">📞 <a href="tel:' + esc((p.phone || '').replace(/[^0-9+]/g, '')) + '">' + esc(p.phone) + '</a></div>' : '')
            +   '<div class="bz-acts">'
            +     '<button class="bz-act bz-like' + (liked ? ' liked' : '') + '" data-id="' + p.id + '">' + (liked ? '❤' : '🤍') + ' <span class="bz-like-n">' + (p.like_count || 0) + '</span></button>'
            +     '<button class="bz-act bz-cmt-btn" data-id="' + p.id + '">💬 <span class="bz-cmt-n">' + (p.comment_count || 0) + '</span></button>'
            +   '</div>'
            +   '<div class="bz-cmts" id="bzc-' + p.id + '"></div>'
            + '</div>'
            + '</div>';
    }

    function bindCards() {
        document.querySelectorAll('#bzFeed .bz-like').forEach(function (b) { if (b._bound) return; b._bound = 1; b.onclick = function () { toggleLike(b.getAttribute('data-id'), b); }; });
        document.querySelectorAll('#bzFeed .bz-cmt-btn').forEach(function (b) { if (b._bound) return; b._bound = 1; b.onclick = function () { toggleComments(b.getAttribute('data-id')); }; });
        document.querySelectorAll('#bzFeed .bz-photos').forEach(bindDragScroll);
    }
    // 사진 줄 — 마우스로 잡고 끌어서 이동(스레드처럼). 터치는 네이티브 스크롤.
    function bindDragScroll(el) {
        if (el._dragBound) return; el._dragBound = 1;
        var down = false, startX = 0, startL = 0, moved = false;
        el.addEventListener('mousedown', function (e) { down = true; moved = false; startX = e.pageX; startL = el.scrollLeft; el.classList.add('dragging'); e.preventDefault(); });
        // 드래그가 요소 밖으로 확 벗어나도 끊기지 않도록 이동/종료는 window 에서 추적.
        // mouseleave 로 조기 종료하지 않는다(빠르게 밖으로 끌면 클릭억제 타이머가 미리 풀려 배경클릭→창닫힘 버그).
        window.addEventListener('mousemove', function (e) { if (!down) return; e.preventDefault(); var d = e.pageX - startX; if (Math.abs(d) > 3) { moved = true; window._bzSuppressClick = true; } el.scrollLeft = startL - d; });
        window.addEventListener('mouseup', function () {
            if (!down) return;
            down = false; el.classList.remove('dragging');
            if (moved) { window._bzSuppressClick = true; setTimeout(function () { window._bzSuppressClick = false; }, 400); }
        });
    }

    async function toggleLike(id, btn) {
        if (!_uid) { _uid = await getUid(); if (!_uid) return needLogin(); }
        try {
            var r = await sb().rpc('biz_promo_like_toggle', { _promo: id });
            var d = r && r.data;
            if (d && d.ok) {
                _likedSet[id] = d.liked;
                btn.classList.toggle('liked', d.liked);
                btn.innerHTML = (d.liked ? '❤' : '🤍') + ' <span class="bz-like-n">' + d.like_count + '</span>';
            } else if (d && d.reason === 'auth') { needLogin(); }
        } catch (e) { console.warn('[bizPromo] like', e); }
    }

    async function toggleComments(id) {
        var box = document.getElementById('bzc-' + id); if (!box) return;
        if (box.classList.contains('open')) { box.classList.remove('open'); return; }
        box.classList.add('open');
        box.innerHTML = '<div style="color:#64748b;font-size:12px;">' + T('불러오는 중…', '読み込み中…', 'Loading…') + '</div>';
        try {
            var r = await sb().from('biz_promo_comments').select('author_name,comment,created_at').eq('promo_id', id).order('created_at', { ascending: true }).limit(100);
            var rows = (r.data) || [];
            var list = rows.map(function (c) { return '<div class="bz-cmt"><b>' + esc(c.author_name || '고객') + '</b>' + esc(c.comment) + '</div>'; }).join('') || '<div style="color:#64748b;font-size:12px;margin-bottom:6px;">' + T('첫 댓글을 남겨보세요.', '最初のコメントを書いてみましょう。', 'Be the first to comment.') + '</div>';
            box.innerHTML = list
                + '<div class="bz-cmt-in"><input id="bzci-' + id + '" placeholder="' + T('댓글 달기…', 'コメントする…', 'Add a comment…') + '" maxlength="300"><button data-id="' + id + '">' + T('등록', '送信', 'Post') + '</button></div>';
            var inp = document.getElementById('bzci-' + id);
            var send = box.querySelector('.bz-cmt-in button');
            send.onclick = function () { addComment(id, inp); };
            inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addComment(id, inp); } };
        } catch (e) { box.innerHTML = '<div style="color:#fca5a5;font-size:12px;">댓글을 불러오지 못했어요.</div>'; }
    }

    async function addComment(id, inp) {
        var txt = (inp.value || '').trim(); if (!txt) return;
        if (!_uid) { _uid = await getUid(); if (!_uid) return needLogin(); }
        inp.disabled = true;
        try {
            var r = await sb().rpc('biz_promo_comment', { _promo: id, _text: txt });
            var d = r && r.data;
            if (d && d.ok) {
                var box = document.getElementById('bzc-' + id);
                var inWrap = box.querySelector('.bz-cmt-in');
                var el = document.createElement('div'); el.className = 'bz-cmt'; el.innerHTML = '<b>' + esc(d.author || '나') + '</b>' + esc(txt);
                box.insertBefore(el, inWrap);
                inp.value = '';
                var cn = document.querySelector('.bz-cmt-btn[data-id="' + id + '"] .bz-cmt-n'); if (cn) cn.textContent = d.comment_count;
            } else if (d && d.reason === 'auth') { needLogin(); }
        } catch (e) { console.warn('[bizPromo] comment', e); }
        finally { inp.disabled = false; inp.focus(); }
    }

    // ─── 등록 ───
    var _regPhotos = [];
    function ensureRegDom() {
        if (document.getElementById('bizRegOv')) return;
        var ov = document.createElement('div'); ov.id = 'bizRegOv';
        ov.innerHTML = ''
            + '<div class="bz-reg-card">'
            +   '<button class="bz-reg-x" id="bzRegX">×</button>'
            +   '<h3>🏢 ' + T('내 업체 홍보 등록', '自社PRを登録', 'Post my business') + '</h3>'
            +   '<div class="bz-reg-sub">' + T('홍보하고 하트를 모아보세요. 받은 하트당 100원!', 'PRしてハートを集めましょう。ハート1つ100円！', 'Promote & collect hearts. ₩100 each!') + '</div>'
            +   '<label>' + T('업체명', '店名・会社名', 'Business name') + ' *</label><input type="text" id="bzrName" maxlength="60" placeholder="' + T('예: 카멜레온 프린팅', '例：カメレオンプリンティング', 'e.g. Chameleon Printing') + '">'
            +   '<label>' + T('전화번호', '電話番号', 'Phone') + '</label><input type="tel" id="bzrPhone" placeholder="' + T('010-0000-0000', '090-0000-0000', '+1 000-000-0000') + '">'
            +   '<label>' + T('검색어 (쉼표로 구분)', 'キーワード（カンマ区切り）', 'Keywords (comma-separated)') + '</label><input type="text" id="bzrKw" maxlength="120" placeholder="' + T('예: 인쇄, 현수막, 굿즈, 부천', '例：印刷, 看板, グッズ, 東京', 'e.g. printing, signage, goods') + '">'
            +   '<label>' + T('업체 소개', '紹介', 'About') + '</label><textarea id="bzrIntro" maxlength="1000" placeholder="' + T('어떤 업체인지, 무엇을 잘하는지 자유롭게 적어주세요.', 'どんなお店か、得意なことを自由に書いてください。', 'Tell us about your business and what you do best.') + '"></textarea>'
            +   '<label>' + T('사진 올리기 (여러 장 가능)', '写真を追加（複数可）', 'Add photos (multiple)') + '</label>'
            +   '<input type="file" id="bzrFiles" accept="image/*" multiple style="font-size:13px;">'
            +   '<div class="bz-reg-photos" id="bzrThumbs"></div>'
            +   '<button class="bz-reg-submit" id="bzrSubmit">' + T('홍보 올리기', '投稿する', 'Post') + '</button>'
            + '</div>';
        document.body.appendChild(ov);
        ov.onclick = function (e) { if (e.target === ov) ov.classList.remove('open'); };
        document.getElementById('bzRegX').onclick = function () { ov.classList.remove('open'); };
        document.getElementById('bzrFiles').onchange = onFilesPicked;
        document.getElementById('bzrSubmit').onclick = submitRegister;
    }
    async function openRegister() {
        _uid = await getUid();
        if (!_uid) return needLogin();
        injectStyles(); ensureRegDom();
        _regPhotos = [];
        document.getElementById('bzrName').value = '';
        document.getElementById('bzrPhone').value = '';
        document.getElementById('bzrKw').value = '';
        document.getElementById('bzrIntro').value = '';
        document.getElementById('bzrThumbs').innerHTML = '';
        document.getElementById('bizRegOv').classList.add('open');
    }
    async function onFilesPicked(e) {
        var files = Array.from(e.target.files || []).slice(0, 8);
        var thumbs = document.getElementById('bzrThumbs');
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (!/^image\//.test(f.type)) continue;
            try {
                var s = sb();
                var ext = (f.name.split('.').pop() || 'png').toLowerCase();
                var path = 'bizpromo/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.' + ext;
                var up = await s.storage.from('design').upload(path, f, { contentType: f.type, upsert: false });
                if (up.error) { console.warn('[bizPromo] upload', up.error); continue; }
                var pub = s.storage.from('design').getPublicUrl(path).data.publicUrl;
                _regPhotos.push(pub);
                var img = document.createElement('img'); img.className = 'bz-thumb'; img.src = pub; thumbs.appendChild(img);
            } catch (err) { console.warn('[bizPromo] file', err); }
        }
        e.target.value = '';
    }
    async function submitRegister() {
        var name = (document.getElementById('bzrName').value || '').trim();
        if (!name) { document.getElementById('bzrName').focus(); toast(T('업체명을 입력해주세요.', '店名を入力してください。', 'Please enter a business name.')); return; }
        var btn = document.getElementById('bzrSubmit'); btn.disabled = true; btn.textContent = T('등록 중…', '登録中…', 'Posting…');
        try {
            var country = (window.__SITE_CODE || 'KR');
            var r = await sb().rpc('biz_promo_create', {
                _name: name,
                _phone: (document.getElementById('bzrPhone').value || '').trim(),
                _keywords: (document.getElementById('bzrKw').value || '').trim(),
                _intro: (document.getElementById('bzrIntro').value || '').trim(),
                _photos: _regPhotos,
                _country: country
            });
            var d = r && r.data;
            if (d && d.ok) {
                document.getElementById('bizRegOv').classList.remove('open');
                toast(T('✅ 커뮤니티에 등록되었어요!', '✅ コミュニティに投稿しました！', '✅ Posted to the community!'));
                _q = ''; var si = document.getElementById('bzSearch'); if (si) si.value = '';
                loadFeed(true);
            } else if (d && d.reason === 'auth') { needLogin(); }
            else { toast('등록 실패: ' + ((d && d.reason) || '오류')); }
        } catch (e) { console.warn('[bizPromo] create', e); toast('등록 실패: ' + (e.message || e)); }
        finally { btn.disabled = false; btn.textContent = T('홍보 올리기', '投稿する', 'Post'); }
    }
})();
