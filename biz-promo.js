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
            /* 우측 도킹 패널(웹앱 스타일) — 데스크톱은 우측 460px, 모바일은 전체 */
            + '#bizFeedOv{position:fixed;top:0;right:0;bottom:0;width:460px;max-width:100%;z-index:100060;background:#0b0f1c;display:none;flex-direction:column;box-shadow:-14px 0 44px rgba(0,0,0,0.45);border-left:1px solid rgba(148,163,184,0.18);}'
            + '#bizFeedOv.open{display:flex;}'
            + '@media(max-width:640px){#bizFeedOv{width:100%;}}'
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
            + '.bz-photos{display:flex;gap:8px;overflow-x:auto;margin:2px 0 10px;scrollbar-width:none;}'
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
            + '<div class="bz-head">'
            +   '<h3>🏢 업체 홍보</h3>'
            +   '<input class="bz-search" id="bzSearch" placeholder="내가 필요한 업체 찾기 (업체명·키워드)">'
            +   '<button class="bz-reg" id="bzRegBtn">+ 등록</button>'
            +   '<button class="bz-x" id="bzCloseBtn">×</button>'
            + '</div>'
            + '<div class="bz-feed" id="bzFeed"></div>';
        document.body.appendChild(ov);
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
            var qb = s.from('biz_promos').select('id,user_id,name,phone,keywords,intro,photos,like_count,comment_count,created_at').order('created_at', { ascending: false }).range(_offset, _offset + PAGE - 1);
            if (_q) qb = qb.or('name.ilike.%' + _q + '%,keywords.ilike.%' + _q + '%,intro.ilike.%' + _q + '%');
            var r = await qb;
            if (r.error) throw r.error;
            var rows = r.data || [];
            if (reset) feed.innerHTML = '';
            if (!rows.length && _offset === 0) {
                feed.innerHTML = '<div class="bz-empty">아직 등록된 업체가 없어요.<br>맨 위 <b>+ 내 업체 등록</b> 으로 첫 홍보를 올려보세요! (1만원 지급)</div>';
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
        box.innerHTML = '<div style="color:#64748b;font-size:12px;">불러오는 중…</div>';
        try {
            var r = await sb().from('biz_promo_comments').select('author_name,comment,created_at').eq('promo_id', id).order('created_at', { ascending: true }).limit(100);
            var rows = (r.data) || [];
            var list = rows.map(function (c) { return '<div class="bz-cmt"><b>' + esc(c.author_name || '고객') + '</b>' + esc(c.comment) + '</div>'; }).join('') || '<div style="color:#64748b;font-size:12px;margin-bottom:6px;">첫 댓글을 남겨보세요.</div>';
            box.innerHTML = list
                + '<div class="bz-cmt-in"><input id="bzci-' + id + '" placeholder="댓글 달기…" maxlength="300"><button data-id="' + id + '">등록</button></div>';
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
            +   '<h3>🏢 내 업체 홍보 등록</h3>'
            +   '<div class="bz-reg-sub">등록하면 1만원 포인트를 드려요 (최초 1회)</div>'
            +   '<label>업체명 *</label><input type="text" id="bzrName" maxlength="60" placeholder="예: 카멜레온 프린팅">'
            +   '<label>전화번호</label><input type="tel" id="bzrPhone" placeholder="010-0000-0000">'
            +   '<label>검색어 (쉼표로 구분)</label><input type="text" id="bzrKw" maxlength="120" placeholder="예: 인쇄, 현수막, 굿즈, 부천">'
            +   '<label>업체 소개</label><textarea id="bzrIntro" maxlength="1000" placeholder="어떤 업체인지, 무엇을 잘하는지 자유롭게 적어주세요."></textarea>'
            +   '<label>사진 올리기 (여러 장 가능)</label>'
            +   '<input type="file" id="bzrFiles" accept="image/*" multiple style="font-size:13px;">'
            +   '<div class="bz-reg-photos" id="bzrThumbs"></div>'
            +   '<button class="bz-reg-submit" id="bzrSubmit">등록하고 1만원 받기</button>'
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
        if (!name) { document.getElementById('bzrName').focus(); toast('업체명을 입력해주세요.'); return; }
        var btn = document.getElementById('bzrSubmit'); btn.disabled = true; btn.textContent = '등록 중…';
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
                if (d.granted) { try { if (window.showRewardPopup) window.showRewardPopup({ kind: 'mileage', mileage: 10000 }); else toast('✅ 업체 등록 완료! 1만원 지급'); } catch (e) { toast('✅ 업체 등록 완료! 1만원 지급'); } }
                else toast('✅ 업체 홍보가 등록되었습니다.');
                _q = ''; var si = document.getElementById('bzSearch'); if (si) si.value = '';
                loadFeed(true);
            } else if (d && d.reason === 'auth') { needLogin(); }
            else { toast('등록 실패: ' + ((d && d.reason) || '오류')); }
        } catch (e) { console.warn('[bizPromo] create', e); toast('등록 실패: ' + (e.message || e)); }
        finally { btn.disabled = false; btn.textContent = '등록하고 1만원 받기'; }
    }
})();
