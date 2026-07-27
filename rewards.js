/* rewards.js — 참여형 리워드(마일리지 + AI 이미지 생성권) 공용 모듈
 * 2026-07-28
 *  - 서버 RPC(attendance_claim / reward_grant / ai_credit_consume / reward_status)를 호출하고,
 *    지급되면 게임처럼 폭죽 + "지급되었습니다" 팝업을 잠깐 띄운다.
 *  - 잔액변경/한도/중복은 전부 서버(RPC)가 판정 — 여기선 호출 + 표시만.
 *  - 로그인 회원만 대상. window.sb (config.js) 사용.
 *  CLAUDE.md 디자인 원칙 준수: 아이콘 남발/그림자/볼드 지양(플랫). 폭죽만 축하 연출.
 */
(function () {
    'use strict';
    if (window._rewardsLoaded) return;
    window._rewardsLoaded = true;

    // ── 언어 ──
    function lang() {
        var l = window.__PS_LANG
            || (window.__SITE_CODE === 'JP' ? 'ja' : window.__SITE_CODE === 'US' ? 'en' : null)
            || (document.documentElement.lang || 'ko');
        l = String(l).toLowerCase();
        if (l === 'kr') l = 'ko';
        return l;
    }
    // ko/ja 는 현지어, 그 외는 영어 폴백 (사이트 공통 패턴)
    function tr(ko, ja, en) {
        var l = lang();
        return l === 'ko' ? ko : l === 'ja' ? (ja || ko) : (en || ko);
    }

    // ── sb 준비 대기 ──
    function sbReady() {
        return new Promise(function (resolve) {
            if (window.sb && window.sb.rpc) return resolve(window.sb);
            var n = 0;
            var t = setInterval(function () {
                if (window.sb && window.sb.rpc) { clearInterval(t); resolve(window.sb); }
                else if (++n > 40) { clearInterval(t); resolve(null); }  // 최대 ~8초
            }, 200);
        });
    }
    async function loggedInUid(sb) {
        try { var u = await sb.auth.getUser(); return (u && u.data && u.data.user) ? u.data.user.id : null; }
        catch (e) { return null; }
    }

    // ── 폭죽 (무의존 DOM 파티클) ──
    function confetti() {
        try {
            var colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#0ea5e9', '#a855f7', '#ec4899'];
            var n = 46;
            for (var i = 0; i < n; i++) {
                (function (i) {
                    var p = document.createElement('div');
                    var sz = 7 + Math.round(Math.random() * 7);
                    p.style.cssText = 'position:fixed;top:38%;left:50%;width:' + sz + 'px;height:' + sz + 'px;'
                        + 'background:' + colors[i % colors.length] + ';border-radius:' + (Math.random() < 0.5 ? '50%' : '2px') + ';'
                        + 'z-index:2147483000;pointer-events:none;will-change:transform,opacity;';
                    document.body.appendChild(p);
                    var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5);
                    var dist = 120 + Math.random() * 220;
                    var dx = Math.cos(ang) * dist;
                    var dy = Math.sin(ang) * dist - 60;
                    var rot = (Math.random() - 0.5) * 720;
                    p.animate([
                        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
                        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + rot + 'deg)', opacity: 0 }
                    ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.15,.7,.3,1)' })
                        .onfinish = function () { try { p.remove(); } catch (e) {} };
                })(i);
            }
        } catch (e) {}
    }

    // ── 지급 팝업 ──
    var _popupBusy = false;
    window.showRewardPopup = function (opt) {
        opt = opt || {};
        // 여러 보상이 동시에 오면 겹치지 않게 살짝 큐잉
        if (_popupBusy) { setTimeout(function () { window.showRewardPopup(opt); }, 900); return; }
        _popupBusy = true;

        var titleMap = {
            attendance: tr('출석 완료! 선물이 도착했어요', '出席完了！プレゼント到着', 'Checked in! Here is your gift'),
            comment: tr('댓글 고마워요! 선물이 도착했어요', 'コメントありがとう！プレゼント', 'Thanks for the comment! A gift for you'),
            post: tr('글 고마워요! 선물이 도착했어요', '投稿ありがとう！プレゼント', 'Thanks for posting! A gift for you'),
            generic: tr('선물이 도착했어요', 'プレゼント到着', 'A gift for you')
        };
        var title = opt.title || titleMap[opt.kind] || titleMap.generic;

        // 선물 아이템 — AI 생성권=카멜레온, 마일리지=돈주머니 이미지
        var items = [];
        if (opt.aiCredit) items.push({ img: '/reward-ai.jpg', ring: '#22c55e',
            amt: '+' + opt.aiCredit + tr('장', '枚', ''), lbl: tr('AI 이미지 생성권', 'AI画像生成', 'AI credits') });
        if (opt.mileage) items.push({ img: '/reward-mileage.jpg', ring: '#f59e0b',
            amt: '+' + Number(opt.mileage).toLocaleString() + tr('원', '円', ''), lbl: tr('마일리지', 'マイル', 'Mileage') });
        var given = tr('지급되었습니다!', '付与されました！', 'Granted!');
        var closeLbl = tr('받기 완료', '受け取る', 'Got it');

        if (!document.getElementById('rwPopupStyle')) {
            var stEl = document.createElement('style');
            stEl.id = 'rwPopupStyle';
            stEl.textContent =
                '@keyframes rwPop{0%{transform:scale(.6) translateY(24px);opacity:0}60%{transform:scale(1.06) translateY(0);opacity:1}100%{transform:scale(1)}}'
              + '@keyframes rwFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
              + '.rw-ov{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.62);opacity:0;transition:opacity .2s;padding:20px}'
              + '.rw-card{position:relative;width:346px;max-width:calc(100% - 40px);border-radius:26px;overflow:hidden;background:#fff;animation:rwPop .5s cubic-bezier(.2,1.1,.35,1) both}'
              + '.rw-top{background:linear-gradient(135deg,#7c3aed,#4f46e5 55%,#0ea5e9);padding:22px 20px 16px;text-align:center;color:#fff}'
              + '.rw-top h3{margin:0;font-size:18px;letter-spacing:-.3px}'
              + '.rw-top p{margin:5px 0 0;font-size:12px;opacity:.9}'
              + '.rw-body{padding:22px 18px 16px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap}'
              + '.rw-gift{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:104px}'
              + '.rw-badge{width:92px;height:92px;border-radius:50%;overflow:hidden;border:4px solid #fff;outline:3px solid var(--rg,#e2e8f0);background:#f8fafc;animation:rwFloat 2.6s ease-in-out infinite}'
              + '.rw-badge img{width:100%;height:100%;object-fit:cover;display:block}'
              + '.rw-amt{font-size:21px;color:#4f46e5;letter-spacing:-.3px}'
              + '.rw-lbl{font-size:12px;color:#64748b}'
              + '.rw-foot{padding:2px 18px 20px}'
              + '.rw-btn{display:block;width:100%;padding:13px;border:none;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;cursor:pointer}'
              + '.rw-x{position:absolute;top:10px;right:12px;width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.28);color:#fff;font-size:20px;line-height:1;cursor:pointer;z-index:2}';
            document.head.appendChild(stEl);
        }

        var giftHtml = items.map(function (g) {
            return '<div class="rw-gift"><div class="rw-badge" style="--rg:' + g.ring + '"><img src="' + g.img + '" alt=""></div>'
                + '<div class="rw-amt">' + g.amt + '</div><div class="rw-lbl">' + g.lbl + '</div></div>';
        }).join('');

        var ov = document.createElement('div');
        ov.className = 'rw-ov';
        ov.setAttribute('role', 'dialog');
        ov.innerHTML = '<div class="rw-card">'
            + '<button class="rw-x" aria-label="close">&times;</button>'
            + '<div class="rw-top"><h3>' + title + '</h3><p>' + given + '</p></div>'
            + '<div class="rw-body">' + giftHtml + '</div>'
            + '<div class="rw-foot"><button class="rw-btn">' + closeLbl + '</button></div></div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.style.opacity = '1'; });
        setTimeout(confetti, 140);

        // 2026-07-28: 자동 닫힘 없음 — X / 받기완료 버튼 / 배경클릭 으로만 닫힌다(사장님 지시).
        var closed = false;
        function close() {
            if (closed) return; closed = true;
            ov.style.opacity = '0';
            setTimeout(function () { try { ov.remove(); } catch (e) {} _popupBusy = false; }, 200);
        }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        try { ov.querySelector('.rw-x').addEventListener('click', close); } catch (e) {}
        try { ov.querySelector('.rw-btn').addEventListener('click', close); } catch (e) {}
    };

    // ── RPC 래퍼 ──
    window.getRewardStatus = async function () {
        var sb = await sbReady(); if (!sb) return null;
        try { var r = await sb.rpc('reward_status'); return r && r.data ? r.data : null; }
        catch (e) { return null; }
    };

    // 생성 전 사전 확인(차감 X) — { ok, reason?, ai_credit?, unlimited? }
    window.canGenerateAi = async function () {
        var sb = await sbReady(); if (!sb) return { ok: false, reason: 'nosb' };
        var uid = await loggedInUid(sb); if (!uid) return { ok: false, reason: 'auth' };
        var st = await window.getRewardStatus();
        if (!st || !st.ok) return { ok: false, reason: 'err' };
        if (st.is_subscriber) return { ok: true, unlimited: true };
        if ((st.ai_credit || 0) > 0) return { ok: true, ai_credit: st.ai_credit };
        return { ok: false, reason: 'empty', ai_credit: 0 };
    };

    // 생성 성공 후 실제 차감(구독자 무제한 통과) — { ok, reason?, ai_credit?, unlimited? }
    window.consumeAiCredit = async function () {
        var sb = await sbReady(); if (!sb) return { ok: false, reason: 'nosb' };
        var uid = await loggedInUid(sb); if (!uid) return { ok: false, reason: 'auth' };
        try { var r = await sb.rpc('ai_credit_consume'); return (r && r.data) ? r.data : { ok: false, reason: 'err' }; }
        catch (e) { return { ok: false, reason: 'err' }; }
    };

    // 간단 안내 토스트 (출석 이미 완료 등 — 선물팝업 아님)
    function _rwInfo(msg) {
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:2147483002;'
            + 'background:#1e293b;color:#fff;padding:12px 20px;border-radius:999px;font-size:14px;max-width:88%;text-align:center;opacity:0;transition:opacity .2s;';
        t.textContent = msg; document.body.appendChild(t);
        requestAnimationFrame(function () { t.style.opacity = '1'; });
        setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { try { t.remove(); } catch (e) {} }, 220); }, 2400);
    }

    // 자동(페이지 로드) 출석 — 지급될 때만 선물팝업, 아니면 조용히.
    window.rewardAttendance = async function () {
        var sb = await sbReady(); if (!sb) return;
        var uid = await loggedInUid(sb); if (!uid) return;
        try {
            var r = await sb.rpc('attendance_claim'); var d = r && r.data;
            if (d && d.ok) window.showRewardPopup({ kind: 'attendance', mileage: d.mileage_added, aiCredit: d.credit_added });
        } catch (e) {}
    };

    // 수동(출석체크 버튼) — 지급/이미완료/미로그인 모두 피드백.
    window.attendanceCheck = async function () {
        var sb = await sbReady(); if (!sb) { _rwInfo(tr('잠시 후 다시 시도해주세요', '少し後にお試しください', 'Please try again shortly.')); return; }
        var uid = await loggedInUid(sb);
        if (!uid) { _rwInfo(tr('로그인 후 출석체크를 이용해주세요', 'ログイン後にご利用ください', 'Please log in to check in.')); return; }
        try {
            var r = await sb.rpc('attendance_claim'); var d = r && r.data;
            if (d && d.ok) window.showRewardPopup({ kind: 'attendance', mileage: d.mileage_added, aiCredit: d.credit_added });
            else if (d && d.already) _rwInfo(tr('오늘은 이미 출석했어요! 내일 또 만나요 🎁', '本日は出席済みです！また明日 🎁', 'Already checked in today — see you tomorrow! 🎁'));
            else _rwInfo(tr('출석 처리 중 오류가 났어요', '出席処理でエラーが発生しました', 'Check-in error, please try again.'));
        } catch (e) { _rwInfo(tr('출석 처리 중 오류가 났어요', '出席処理エラー', 'Check-in error.')); }
    };

    async function _grant(type, ref, kind) {
        var sb = await sbReady(); if (!sb) return;
        var uid = await loggedInUid(sb); if (!uid) return;
        try {
            var r = await sb.rpc('reward_grant', { p_type: type, p_ref: ref || null }); var d = r && r.data;
            if (d && d.ok) window.showRewardPopup({ kind: kind, mileage: d.mileage_added, aiCredit: d.credit_added });
        } catch (e) {}
    }
    window.rewardComment = function (ref) { return _grant('comment', ref, 'comment'); };
    window.rewardPost = function (ref) { return _grant('post', ref, 'post'); };

    // ── 끝말잇기 게임 (출석체크 대체) ──
    function _wcStyle() {
        if (document.getElementById('wcStyle')) return;
        var s = document.createElement('style'); s.id = 'wcStyle';
        s.textContent =
            '.wc-ov{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.62);opacity:0;transition:opacity .2s;padding:20px}'
          + '.wc-card{position:relative;width:380px;max-width:calc(100% - 40px);border-radius:22px;overflow:hidden;background:#fff;animation:rwPop .5s cubic-bezier(.2,1.1,.35,1) both}'
          + '.wc-top{background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;padding:18px 20px;text-align:center}'
          + '.wc-top h3{margin:0;font-size:18px}.wc-top p{margin:4px 0 0;font-size:12px;opacity:.9}'
          + '.wc-body{padding:18px 20px 20px}'
          + '.wc-chain{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px;min-height:26px}'
          + '.wc-word{background:#eef2ff;color:#4338ca;border-radius:999px;padding:4px 11px;font-size:13px}'
          + '.wc-word.last{background:#4f46e5;color:#fff}'
          + '.wc-need{text-align:center;font-size:14px;color:#0f172a;margin-bottom:12px}'
          + '.wc-need b{color:#4f46e5;font-size:19px}'
          + '.wc-inrow{display:flex;gap:8px}'
          + '.wc-in{flex:1;padding:12px 14px;border:1.5px solid #d7dce5;border-radius:12px;font-size:16px;font-family:inherit;outline:none}'
          + '.wc-go{padding:12px 18px;border:none;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;cursor:pointer;white-space:nowrap}'
          + '.wc-msg{min-height:18px;font-size:13px;margin-top:10px;text-align:center}'
          + '.wc-foot{margin-top:12px;font-size:12px;color:#94a3b8;text-align:center}'
          + '.wc-x{position:absolute;top:9px;right:12px;width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.28);color:#fff;font-size:20px;cursor:pointer}';
        document.head.appendChild(s);
    }

    window.openWordChain = async function () {
        var sb = await sbReady();
        _wcStyle();
        // 게임 언어: JP=しりとり(ja) / KR=끝말잇기(kr) / 그 외=영어 워드체인(en)
        var _l = lang();
        var gl = (_l === 'ja') ? 'ja' : (_l === 'ko' || _l === 'kr') ? 'kr' : 'en';
        var G = ({
            kr: { re: /[^가-힣]/, title: '끝말잇기 🎮', desc: '단어를 이으면 마일리지 500원 + 생성권 1장! (하루 3회)', place: '단어 입력', go: '잇기', next: '다음 시작 글자: ', any: '아무 단어나 시작하세요!', empty: '아직 단어가 없어요. 첫 단어를 시작!', invalid: '순수 한글 단어만 가능해요', dup: '이미 사용된 단어예요', short: '2글자 이상 입력하세요', endn: '', today: '오늘 보상 ', success: '끝말잇기 성공!', maxed: '이어졌어요! (오늘 보상은 다 받았어요)', login: '로그인 후 이용해주세요', retry: '다시 시도해주세요', chain: function (c) { return '「' + c + '」(으)로 시작해야 해요'; } },
            ja: { re: /[^ぁ-んァ-ヶー]/, title: 'しりとり 🎮', desc: '単語をつなぐと500 + チケット1枚！(1日3回)', place: 'ひらがな・カタカナ', go: 'つなぐ', next: '次の頭文字: ', any: '好きな単語で開始！', empty: 'まだ単語がありません。最初の単語を！', invalid: 'ひらがな・カタカナのみ', dup: '既に使われた単語です', short: '2文字以上入力してください', endn: '「ん」で終わる単語はダメ！', today: '本日 ', success: 'しりとり成功！', maxed: 'つながった！(本日の報酬は上限)', login: 'ログインしてください', retry: '再試行してください', chain: function (c) { return '「' + c + '」で始めてください'; } },
            en: { re: /[^a-zA-Z]/, title: 'Word Chain 🎮', desc: 'Chain a word: +500 mileage & 1 credit! (3/day)', place: 'Type an English word', go: 'Chain', next: 'Next starts with: ', any: 'Start with any word!', empty: 'No words yet — start it!', invalid: 'English letters only', dup: 'Already used', short: 'At least 2 letters', endn: '', today: 'Today ', success: 'Word chained!', maxed: 'Chained! (daily reward maxed)', login: 'Please log in first.', retry: 'Try again', chain: function (c) { return 'Must start with "' + c + '"'; } }
        })[gl];
        var norm = function (s) { return gl === 'en' ? s.toLowerCase() : s; };

        var ov = document.createElement('div'); ov.className = 'wc-ov';
        ov.innerHTML = '<div class="wc-card"><button class="wc-x">&times;</button>'
            + '<div class="wc-top"><h3>' + G.title + '</h3><p>' + G.desc + '</p></div>'
            + '<div class="wc-body"><div class="wc-chain" id="wcChain"></div><div class="wc-need" id="wcNeed"></div>'
            + '<div class="wc-inrow"><input class="wc-in" id="wcInput" maxlength="24" placeholder="' + G.place + '"><button class="wc-go" id="wcGo">' + G.go + '</button></div>'
            + '<div class="wc-msg" id="wcMsg"></div><div class="wc-foot" id="wcFoot"></div></div></div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.style.opacity = '1'; });
        var closed = false;
        function close() { if (closed) return; closed = true; ov.style.opacity = '0'; setTimeout(function () { try { ov.remove(); } catch (e) {} }, 200); }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        ov.querySelector('.wc-x').addEventListener('click', close);

        var input = ov.querySelector('#wcInput');
        var msgEl = ov.querySelector('#wcMsg');
        var nextChar = null;

        function render(st) {
            var recent = (st && st.recent) || [];
            ov.querySelector('#wcChain').innerHTML = recent.slice().reverse().map(function (w, i) {
                return '<span class="wc-word' + (i === recent.length - 1 ? ' last' : '') + '">' + String(w).replace(/</g, '&lt;') + '</span>';
            }).join('') || ('<span style="color:#94a3b8;font-size:13px">' + G.empty + '</span>');
            nextChar = st && st.next_char;
            ov.querySelector('#wcNeed').innerHTML = nextChar ? (G.next + '<b>' + nextChar + '</b>') : G.any;
            ov.querySelector('#wcFoot').textContent = G.today + ((st && st.plays_today) || 0) + ' / ' + ((st && st.cap) || 3);
        }

        if (!sb) { msgEl.style.color = '#dc2626'; msgEl.textContent = G.login; }
        else { try { var s0 = await sb.rpc('word_chain_status', { p_lang: gl }); render(s0 && s0.data); } catch (e) { render(null); } }

        async function submit() {
            var w = (input.value || '').trim();
            msgEl.style.color = '#dc2626';
            if (!sb) { msgEl.textContent = G.login; return; }
            var uid = await loggedInUid(sb);
            if (!uid) { msgEl.textContent = G.login; return; }
            if (w.length < 2) { msgEl.textContent = G.short; return; }
            if (G.re.test(w)) { msgEl.textContent = G.invalid; return; }
            if (gl === 'ja' && w.slice(-1) === 'ん') { msgEl.textContent = G.endn; return; }
            if (nextChar && norm(w[0]) !== nextChar) { msgEl.textContent = G.chain(nextChar); return; }
            try {
                var r = await sb.rpc('word_chain_play', { p_word: w, p_lang: gl }); var d = r && r.data;
                if (d && d.ok) {
                    input.value = '';
                    if (d.rewarded) window.showRewardPopup({ title: G.success, mileage: d.mileage_added, aiCredit: d.credit_added });
                    else { msgEl.style.color = '#16a34a'; msgEl.textContent = G.maxed; }
                    var s2 = await sb.rpc('word_chain_status', { p_lang: gl }); render(s2 && s2.data);
                } else {
                    var rs = d && d.reason;
                    msgEl.textContent = rs === 'chain' ? G.chain(d.need || '')
                        : rs === 'dup' ? G.dup
                        : rs === 'endn' ? G.endn
                        : rs === 'short' ? G.short
                        : rs === 'notvalid' ? G.invalid
                        : rs === 'auth' ? G.login
                        : G.retry;
                }
            } catch (e) { msgEl.textContent = G.retry; }
        }
        ov.querySelector('#wcGo').addEventListener('click', submit);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 300);
    };
})();
