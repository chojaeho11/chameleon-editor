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

    // 유료 API(누끼+AI생성) 일일 게이트 — 하루 3회 무료 → 소진 시 적립권(ai_credit) → 그다음 구독. 구독자 무제한.
    //   사전 확인(차감 X) — { ok, reason?('auth'|'limit'|'nosb'|'err'), daily_left?, ai_credit?, unlimited? }
    window.canGenerateAi = async function () {
        var sb = await sbReady(); if (!sb) return { ok: false, reason: 'nosb' };
        var uid = await loggedInUid(sb); if (!uid) return { ok: false, reason: 'auth' };
        try {
            var r = await sb.rpc('paid_api_status');
            var st = (r && r.data) ? r.data : null;
            if (!st || !st.ok) return { ok: false, reason: (st && st.reason) || 'err' };
            if (st.is_subscriber) return { ok: true, unlimited: true };
            if (st.can) return { ok: true, daily_left: st.daily_left, ai_credit: st.ai_credit };
            return { ok: false, reason: 'limit', daily_left: 0, ai_credit: st.ai_credit || 0 };
        } catch (e) { return { ok: false, reason: 'err' }; }
    };
    window.canUsePaidApi = window.canGenerateAi;

    // 성공 후 실제 차감(하루3 → 적립권 순, 구독자 no-op) — { ok, source?('daily'|'credit'|'subscriber'), daily_left?, ai_credit?, unlimited? }
    window.consumeAiCredit = async function (kind) {
        var sb = await sbReady(); if (!sb) return { ok: false, reason: 'nosb' };
        var uid = await loggedInUid(sb); if (!uid) return { ok: false, reason: 'auth' };
        try { var r = await sb.rpc('paid_api_consume', { p_kind: kind || 'paid' }); return (r && r.data) ? r.data : { ok: false, reason: 'err' }; }
        catch (e) { return { ok: false, reason: 'err' }; }
    };
    window.consumePaidApi = window.consumeAiCredit;

    // 하루 한도 초과 시 구독 유도 모달 (누끼/AI생성 공용). 구독 흐름 없는 페이지(패브릭 등)에선 구독버튼 숨김.
    window.showPaidApiUpsell = function () {
        var sc = (window.__SITE_CODE || 'KR');
        var jp = (sc === 'JP'), en = (sc !== 'KR' && sc !== 'JP');
        var T = function (ko, ja, eng) { return jp ? ja : (en ? eng : ko); };
        var old = document.getElementById('paidApiUpsell'); if (old) old.remove();
        var ov = document.createElement('div');
        ov.id = 'paidApiUpsell';
        ov.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:2147483040; display:flex; align-items:center; justify-content:center; padding:20px;';
        var hasSub = (typeof window.startSubscription === 'function');
        var subBtn = hasSub
            ? '<button id="_paidApiSubBtn" style="width:100%; padding:13px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:10px; font-size:15px; cursor:pointer; margin-bottom:10px;">' + T('구독하고 무제한 사용', '購読して無制限に使う', 'Subscribe for unlimited') + '</button>'
            : '';
        ov.innerHTML = '<div style="background:#fff; border-radius:16px; max-width:380px; width:100%; padding:26px 24px; color:#334155; text-align:center;">'
            + '<div style="font-size:16px; color:#111; margin-bottom:10px;">' + T('오늘 무료 3회를 모두 사용했어요', '本日の無料3回を使い切りました', 'You have used all 3 free uses today') + '</div>'
            + '<div style="font-size:13.5px; line-height:1.7; color:#475569; margin-bottom:18px;">' + T('배경 제거(누끼)·AI 이미지 생성은 하루 3회까지 무료예요. 구독하면 무제한으로 쓸 수 있고, 출석체크·게시판 글쓰기로 생성권을 더 모을 수도 있어요.', '背景除去（切り抜き）・AI画像生成は1日3回まで無料です。購読すれば無制限、出席チェックや掲示板投稿でチケットを追加で貯められます。', 'Background removal & AI image generation are free up to 3×/day. Subscribe for unlimited, or earn more credits via check-in and the community board.') + '</div>'
            + subBtn
            + '<button id="_paidApiCloseBtn" style="width:100%; padding:12px; background:#f1f5f9; color:#334155; border:none; border-radius:10px; font-size:14px; cursor:pointer;">' + T('닫기', '閉じる', 'Close') + '</button>'
            + '</div>';
        document.body.appendChild(ov);
        var close = function () { try { ov.remove(); } catch (e) {} };
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        var cb = document.getElementById('_paidApiCloseBtn'); if (cb) cb.onclick = close;
        var sb2 = document.getElementById('_paidApiSubBtn'); if (sb2) sb2.onclick = function () { close(); try { window.startSubscription('monthly'); } catch (e) {} };
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

    // 2026-08-14: 매월 첫 접속 무료 선물 3만원 (월 1회). 무료 이벤트 포인트라 매월 말일 소멸 대상.
    window.claimMonthlyGift = async function () {
        var sb = await sbReady(); if (!sb) return;
        var uid = await loggedInUid(sb); if (!uid) return;
        try {
            var r = await sb.rpc('monthly_gift_claim'); var d = r && r.data;
            if (d && d.ok && d.granted) {
                var sc = (window.__SITE_CODE || 'KR');
                var jp = (sc === 'JP'), us = (sc !== 'KR' && sc !== 'JP');
                var disp = jp ? 1000 : (us ? 10 : 10000);   // 주간 선물 1만원(=JP ¥1,000). showRewardPopup 는 통화접미사만 붙이므로 사이트별 환산액 전달
                window.showRewardPopup({ kind: 'mileage', title: jp ? '今週の無料プレゼント！' : (us ? 'Your weekly free gift!' : '이번 주 무료 선물!'), mileage: disp });
            }
        } catch (e) {}
    };

    // 2026-08-14: 리워드 허브 — 이벤트 팝업에서 5가지 보상을 그 자리에서. 상단 누적포인트 + 축하 빵빠레.
    window.openRewardHub = async function () {
        var sbc = await sbReady(); if (!sbc) return;
        var sc = (window.__SITE_CODE || 'KR');
        var jp = (sc === 'JP'), en = (sc !== 'KR' && sc !== 'JP');
        var T2 = function (ko, ja, eng) { return jp ? ja : (en ? (eng || ko) : ko); };
        var won = function (krw) { return jp ? ('¥' + Math.round(krw * 0.1).toLocaleString()) : (en ? ('$' + Math.round(krw / 1000)) : (Number(krw).toLocaleString() + '원')); };
        var dispAmt = function (krw) { return jp ? Math.round(krw * 0.1) : (en ? Math.round(krw / 1000) : krw); };
        var celebrate = function (krw, title) { try { if (window.showRewardPopup) window.showRewardPopup({ kind: 'mileage', title: title || T2('축하해요! 포인트가 도착했어요', 'おめでとう！ポイント到着', 'Reward granted!'), mileage: dispAmt(krw) }); } catch (e) {} };

        var old = document.getElementById('rewardHubModal'); if (old) old.remove();
        var ov = document.createElement('div');
        ov.id = 'rewardHubModal';
        ov.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:2147482990; display:flex; align-items:center; justify-content:center; padding:14px;';
        ov.innerHTML = '<div id="rhCard" style="background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#7c3aed,#a855f7) border-box; border:3px solid transparent; border-radius:18px; max-width:430px; width:100%; max-height:94vh; overflow-y:auto; padding:20px 18px; color:#334155;"><div style="text-align:center; color:#94a3b8; padding:40px;">' + T2('불러오는 중…', '読み込み中…', 'Loading…') + '</div></div>';
        document.body.appendChild(ov);
        var closeHub = function () { try { ov.remove(); } catch (e) {} };
        ov.addEventListener('click', function (e) { if (e.target === ov) closeHub(); });

        async function getState() {
            var st = { logged_in: false, mileage: 0, monthly_gift_done: false, attendance_done: false, first_cashback_done: false, sns: 'none', uid: null, email: '', name: '' };
            try { var u = await sbc.auth.getUser(); var user = u && u.data && u.data.user; if (user) { st.logged_in = true; st.uid = user.id; st.email = user.email || ''; } } catch (e) {}
            if (st.logged_in) {
                try { var r = await sbc.rpc('reward_hub_status'); var d = r && r.data; if (d && d.ok && d.logged_in) { st.mileage = d.mileage || 0; st.monthly_gift_done = !!d.monthly_gift_done; st.attendance_done = !!d.attendance_done; st.first_cashback_done = !!d.first_cashback_done; } } catch (e) {}
                try { var s = await sbc.rpc('blog_monitor_sync'); if (s && s.data) st.sns = s.data.status || 'none'; } catch (e) {}
                try { var pf = await sbc.from('profiles').select('username').eq('id', st.uid).maybeSingle(); st.name = (pf && pf.data && pf.data.username) || (st.email.split('@')[0]) || 'user'; } catch (e) { st.name = (st.email.split('@')[0]) || 'user'; }
            }
            return st;
        }
        var badge = function (n) { return '<div style="width:26px;height:26px;border-radius:50%;background:#fed7aa;color:#c2410c;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + n + '</div>'; };
        var doneTag = function (t) { return '<span style="font-size:12px;color:#16a34a;">✓ ' + t + '</span>'; };
        var lockTag = function () { return '<span style="font-size:11.5px;color:#cbd5e1;">' + T2('로그인 후', 'ログイン後', 'Login') + '</span>'; };
        var actBtn = function (id, t) { return '<button id="' + id + '" style="padding:8px 13px;background:#111827;color:#fff;border:none;border-radius:9px;font-size:12.5px;cursor:pointer;white-space:nowrap;">' + t + '</button>'; };
        var esc = function (s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); };
        var rowHtml = function (n, title, amt, right) {
            return '<div style="border:1px solid #e9d5ff;border-radius:12px;padding:11px 12px;">'
                + '<div style="display:flex;align-items:center;gap:10px;">' + badge(n)
                + '<div style="flex:1;min-width:0;"><div style="font-size:13.5px;color:#4c1d95;">' + title + '</div><div style="font-size:14px;font-weight:800;color:#7c3aed;">' + amt + '</div></div>'
                + '<div style="flex-shrink:0;">' + right + '</div></div>'
                + '<div id="rhExtra' + n + '"></div></div>';
        };
        // 오늘의 잡담 게시판 모달 — 여러 사람 글 보기 + 글 쓰면 출석 완료(닫힘). 끝말잇기처럼 별도 모달.
        async function openTodayTalk(st) {
            var bov = document.getElementById('rhTalkBoard'); if (bov) bov.remove();
            bov = document.createElement('div');
            bov.id = 'rhTalkBoard';
            bov.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:2147482996; display:flex; align-items:center; justify-content:center; padding:14px;';
            bov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:430px;width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">'
                + '<div style="padding:15px 18px 8px;display:flex;justify-content:space-between;align-items:center;"><div style="font-size:16px;font-weight:700;color:#4c1d95;">' + T2('오늘의 잡담', '今日のひとこと', 'Today chat') + '</div><button id="rhTbX" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1;">&times;</button></div>'
                + '<div style="padding:0 18px 8px;font-size:11.5px;color:#7c3aed;line-height:1.5;">' + T2('한마디 남기면 출석 완료! (하루 1회 · ' + won(2000) + ')<br>가벼운 인사나 농담, 내 회사 홍보도 좋아요 :)', 'ひとことで出席完了！ 挨拶や冗談、自社PRもOK :)', 'Post to check in! A hello, a joke, or your own promo — all welcome :)') + '</div>'
                + '<div id="rhTbList" style="flex:1;overflow-y:auto;padding:0 18px;min-height:120px;"><div style="text-align:center;color:#cbd5e1;padding:20px;font-size:12px;">' + T2('불러오는 중…', '読み込み中…', 'Loading…') + '</div></div>'
                + '<div style="padding:12px 16px 16px;border-top:1px solid #f1f5f9;"><textarea id="rhTbInput" rows="2" placeholder="' + T2('오늘 하고 싶은 한마디 :)', '今日のひとこと :)', 'Say hi :)') + '" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;resize:none;"></textarea>'
                + '<button id="rhTbGo" style="margin-top:6px;width:100%;padding:11px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">' + T2('글쓰고 출석하기', '投稿して出席', 'Post & check in') + '</button></div></div>';
            document.body.appendChild(bov);
            var closeBoard = function () { try { bov.remove(); } catch (e) {} };
            bov.addEventListener('click', function (e) { if (e.target === bov) closeBoard(); });
            document.getElementById('rhTbX').onclick = closeBoard;
            try {
                var pr = await sbc.from('blog_posts').select('author_name, title, content, created_at').eq('category', 'freetalk').eq('country_code', sc).order('created_at', { ascending: false }).limit(20);
                var list = document.getElementById('rhTbList');
                if (list) {
                    var posts = (pr && pr.data) || [];
                    var _html = posts.map(function (p) {
                        var plain = String(p.content || p.title || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&lt;|&gt;|&amp;/gi, ' ').replace(/\s+/g, ' ').trim();
                        if (!plain) return '';
                        return '<div style="padding:9px 0;border-bottom:1px solid #f1f5f9;"><div style="font-size:12.5px;color:#334155;line-height:1.5;word-break:break-word;">' + esc(plain) + '</div><div style="font-size:10.5px;color:#a78bfa;margin-top:2px;">' + esc(p.author_name || '') + '</div></div>';
                    }).join('');
                    list.innerHTML = _html || '<div style="text-align:center;color:#cbd5e1;padding:20px;font-size:12px;">' + T2('첫 글을 남겨보세요!', '最初のひとことを！', 'Be the first!') + '</div>';
                }
            } catch (e) {}
            document.getElementById('rhTbGo').onclick = async function () {
                var txt = (document.getElementById('rhTbInput').value || '').trim();
                if (txt.length < 1) { document.getElementById('rhTbInput').focus(); return; }
                this.disabled = true;
                try { await sbc.from('blog_posts').insert({ category: 'freetalk', country_code: sc, author_id: st.uid, author_name: st.name, author_email: st.email, title: txt.slice(0, 80), content: txt }); } catch (e) {}
                var got = false;
                try { var r = await sbc.rpc('attendance_claim'); var d = r && r.data; if (d && d.ok && d.mileage_added) got = true; } catch (e) {}
                closeBoard();
                if (got) celebrate(2000, T2('출석 완료! 포인트 지급', '出席完了！', 'Checked in!'));
                render();
            };
        }
        async function render() {
            var st = await getState();
            var card = document.getElementById('rhCard'); if (!card) return;
            var top = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">'
                + '<div style="font-size:16px;font-weight:800;letter-spacing:2.5px;color:#7c3aed;">SUMMER EVENT</div>'
                + '<button id="rhCloseX" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1;">&times;</button></div>'
                + '<div style="text-align:center;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:14px;padding:12px;margin:8px 0 14px;">'
                + '<div style="font-size:12px;color:#6d28d9;">' + T2('내 누적 포인트', 'マイポイント', 'My points') + '</div>'
                + '<div style="font-size:27px;font-weight:800;color:#7c3aed;">' + (st.logged_in ? won(st.mileage) : '—') + '</div>'
                + '<div style="font-size:10.5px;color:#a78bfa;margin-top:2px;">' + T2('구매 시 현금처럼 사용하세요', '購入時に現金のように使えます', 'Use like cash at checkout') + '</div></div>'
                + (st.logged_in ? '<div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#fff;">'
                    + '<div style="min-width:0;"><div style="font-size:13.5px;font-weight:700;">' + T2('첫 구매 20% 페이백 (최대 20만원)', '初回20%還元（最大2万円）', '20% first-purchase cashback (up to ~$200)') + '</div>'
                    + '<div style="font-size:11px;opacity:0.85;margin-top:2px;line-height:1.4;">' + T2('모든 이벤트 쿠폰(페이백 포함) 매월 말일 초기화됩니다', 'すべてのイベントクーポン（キャッシュバック含む）は毎月末にリセットされます', 'All event coupons (incl. cashback) reset at month-end') + '</div></div>'
                    + '<div style="font-size:12px;flex-shrink:0;opacity:0.95;">' + (st.first_cashback_done ? T2('✓ 받음', '✓ 受取', '✓ Done') : T2('구매 시 자동', '購入で自動', 'Auto')) + '</div></div>' : '');
            var rows = ''
                + rowHtml(1, T2('회원가입', '会員登録', 'Sign up'), won(10000), st.logged_in ? doneTag(T2('완료', '完了', 'Done')) : actBtn('rhAct1', T2('가입하고 받기', '登録して受取', 'Join')))
                + rowHtml(2, T2('이번주 접속', '今週のログイン', 'Weekly login'), won(10000), !st.logged_in ? lockTag() : (st.monthly_gift_done ? doneTag(T2('받음', '受取済み', 'Claimed')) : actBtn('rhAct2', T2('받기', '受取', 'Claim'))))
                + rowHtml(3, T2('SNS 체험단', 'SNS体験団', 'SNS monitor') + (st.sns !== 'none' ? ' ✓' : ''), won(50000) + T2('/월', '/月', '/mo'), !st.logged_in ? lockTag() : actBtn('rhAct3', T2('이벤트 보기', 'イベント', 'View')))
                + rowHtml(4, T2('출석체크', '出席チェック', 'Check-in') + (st.attendance_done ? ' ✓' : ''), won(2000) + T2('/일', '/日', '/day'), !st.logged_in ? lockTag() : actBtn('rhAct4', T2('오늘의 잡담', '今日のひとこと', 'Post')))
                + rowHtml(5, T2('끝말잇기', 'しりとり', 'Word chain'), won(1000) + T2('/일', '/日', '/day'), !st.logged_in ? lockTag() : actBtn('rhAct5', T2('게임', 'ゲーム', 'Play')))
                + rowHtml(6, T2('카멜SNS', 'カメレオンSNS', 'Chameleon SNS'), T2('내 업체 홍보하고 하트받기', '自分の店をPRしてハートをもらおう', 'Promote your shop & earn hearts'), !st.logged_in ? lockTag() : actBtn('rhAct6', T2('입장하기', '入場する', 'Enter')));
            var note = '<div style="text-align:center;font-size:11px;color:#94a3b8;margin:14px 0 4px;">' + T2('합쳐서 매달 최대 16만원 · 매월 말일 미사용분 소멸', '合計 毎月最大¥16,000 · 毎月末に未使用分は消滅', 'Up to ~$160/mo · resets monthly') + '</div>';
            card.innerHTML = top + '<div style="display:grid;gap:8px;">' + rows + '</div>' + note;
            var byId = function (id) { return document.getElementById(id); };
            if (byId('rhCloseX')) byId('rhCloseX').onclick = closeHub;
            if (byId('rhAct1')) byId('rhAct1').onclick = function () { if (window.openAuthModal) { window.openAuthModal('signup', function () { celebrate(10000, T2('가입 완료! 포인트 지급', '登録完了！', 'Welcome!')); render(); }); } };
            if (byId('rhAct2')) byId('rhAct2').onclick = async function () { this.disabled = true; try { var r = await sbc.rpc('monthly_gift_claim'); var d = r && r.data; if (d && d.ok && d.granted) celebrate(10000); } catch (e) {} render(); };
            if (byId('rhAct3')) byId('rhAct3').onclick = function () { if (window.openBlogRecruitInfo) window.openBlogRecruitInfo(); else if (window.openSnsRankingModal) window.openSnsRankingModal(); };
            if (byId('rhAct4')) byId('rhAct4').onclick = function () { openTodayTalk(st); };
            if (byId('rhAct5')) byId('rhAct5').onclick = function () { if (window.openWordChain) window.openWordChain(); };
            if (byId('rhAct6')) byId('rhAct6').onclick = function () { closeHub(); if (window.openBizPromo) window.openBizPromo(); };   // 이벤트 모달 닫고 우측 홍보 패널만 남김
        }
        render();
    };
    window.openSummerEvent = window.openRewardHub;

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

    // 2026-07-29: 바로가기(홈화면/앱/즐겨찾기) 추가 보상 — 1인 1회 3,000원. 피드백 포함(미로그인/이미받음).
    window.rewardBookmark = async function () {
        var sb = await sbReady(); if (!sb) { _rwInfo(tr('잠시 후 다시 시도해주세요', '少し後にお試しください', 'Please try again shortly.')); return false; }
        var uid = await loggedInUid(sb);
        if (!uid) { _rwInfo(tr('로그인하면 3,000P를 받을 수 있어요', 'ログインで3,000Pを獲得できます', 'Log in to get 3,000P.')); return false; }
        try {
            var r = await sb.rpc('reward_grant', { p_type: 'bookmark', p_ref: 'bookmark' }); var d = r && r.data;
            if (d && d.ok) { window.showRewardPopup({ kind: 'mileage', title: tr('바로가기 추가 완료!', 'ショートカット追加完了！', 'Shortcut added!'), mileage: d.mileage_added, aiCredit: d.credit_added }); return true; }
            if (d && (d.reason === 'cap' || d.reason === 'dup')) { _rwInfo(tr('이미 바로가기 보상을 받으셨어요 🎁', 'ショートカット特典は受取済みです 🎁', 'You already claimed the shortcut reward 🎁')); return true; }
            _rwInfo(tr('잠시 후 다시 시도해주세요', '少し後にお試しください', 'Please try again shortly.')); return false;
        } catch (e) { _rwInfo(tr('처리 중 오류가 났어요', 'エラーが発生しました', 'Something went wrong.')); return false; }
    };

    // ── 오늘의 선물(접속 보상) + 오늘의 미션 안내 팝업 ──
    function _dgStyle() {
        if (document.getElementById('dgStyle')) return;
        var s = document.createElement('style'); s.id = 'dgStyle';
        s.textContent =
            '.dg-ov{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.62);opacity:0;transition:opacity .2s;padding:20px}'
          + '.dg-card{position:relative;width:380px;max-width:calc(100% - 40px);max-height:92vh;overflow-y:auto;border-radius:24px;background:#fff;animation:rwPop .5s cubic-bezier(.2,1.1,.35,1) both}'
          + '.dg-top{background:linear-gradient(135deg,#7c3aed,#4f46e5 55%,#0ea5e9);color:#fff;padding:20px;text-align:center}'
          + '.dg-top h3{margin:0;font-size:19px}.dg-top p{margin:4px 0 0;font-size:12px;opacity:.9}'
          + '.dg-gifts{display:flex;gap:16px;justify-content:center;padding:18px 0 6px}'
          + '.dg-gift{display:flex;flex-direction:column;align-items:center;gap:6px}'
          + '.dg-badge{width:82px;height:82px;border-radius:50%;overflow:hidden;border:4px solid #fff;outline:3px solid var(--rg,#e2e8f0);animation:rwFloat 2.6s ease-in-out infinite}'
          + '.dg-badge img{width:100%;height:100%;object-fit:cover;display:block}'
          + '.dg-amt{font-size:18px;color:#4f46e5}.dg-lbl{font-size:11px;color:#64748b}'
          + '.dg-given{text-align:center;font-size:13px;color:#94a3b8;padding-bottom:8px}'
          + '.dg-miss{margin:6px 16px 4px;background:#f8fafc;border:1px solid #eef0f5;border-radius:14px;padding:14px 16px}'
          + '.dg-miss h4{margin:0 0 9px;font-size:13px;color:#0f172a}'
          + '.dg-miss ul{margin:0;padding:0;list-style:none}'
          + '.dg-miss li{font-size:12.5px;color:#334155;padding:5px 0;line-height:1.4}'
          + '.dg-miss li b{color:#4f46e5}'
          + '.dg-btns{display:flex;gap:8px;padding:14px 16px 18px}'
          + '.dg-btn{flex:1;padding:12px;border:none;border-radius:12px;font-size:14px;cursor:pointer}'
          + '.dg-btn.p{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}'
          + '.dg-btn.s{background:#eef2ff;color:#4338ca}'
          + '.dg-x{position:absolute;top:10px;right:12px;width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.28);color:#fff;font-size:20px;cursor:pointer;z-index:2}';
        document.head.appendChild(s);
    }

    // 로그인 후 그날 첫 방문 시 index.html 에서 호출. attendance_claim 이 하루 1회만 지급 → 지급될 때만 팝업.
    window.dailyGiftPopup = async function () {
        var sb = await sbReady(); if (!sb) return;
        var uid = await loggedInUid(sb); if (!uid) return;
        var d;
        try { var r = await sb.rpc('attendance_claim'); d = r && r.data; } catch (e) { return; }
        if (!d || !d.ok) return;   // 이미 오늘 받았으면 팝업 없음
        _dgStyle();
        var _l = lang();
        var gameName = (_l === 'ja') ? 'しりとり' : (_l === 'ko' || _l === 'kr') ? '끝말잇기' : 'Word Chain';
        var boardName = tr('홍보하기', '宣伝', 'Promotions');
        var missions = tr(
            '<li>🎮 <b>' + gameName + '</b> — 단어당 500원 + 생성권 1장 (하루 3회)</li>'
            + '<li>✍ <b>' + boardName + ' 글쓰기</b> — 1,000원 + 생성권 1장 (하루 2회)</li>'
            + '<li>💬 <b>댓글 달기</b> — 3,000원 (하루 3회)</li>',
            '<li>🎮 <b>' + gameName + '</b> — 1語500 + チケット1（1日3回）</li>'
            + '<li>✍ <b>' + boardName + '投稿</b> — 1,000 + チケット1（1日2回）</li>'
            + '<li>💬 <b>コメント</b> — 3,000（1日3回）</li>',
            '<li>🎮 <b>' + gameName + '</b> — +500 & 1 credit per word (3/day)</li>'
            + '<li>✍ <b>' + boardName + ' post</b> — +1,000 & 1 credit (2/day)</li>'
            + '<li>💬 <b>Comment</b> — +3,000 (3/day)</li>'
        );

        var ov = document.createElement('div'); ov.className = 'dg-ov';
        ov.innerHTML = '<div class="dg-card"><button class="dg-x">&times;</button>'
            + '<div class="dg-top"><h3>🎁 ' + tr('오늘의 선물 도착!', '本日のプレゼント到着！', 'Your daily gift!') + '</h3>'
            + '<p>' + tr('접속 보상이 지급되었어요', 'ログイン報酬を付与しました', 'Daily check-in reward granted') + '</p></div>'
            + '<div class="dg-gifts">'
            + '<div class="dg-gift"><div class="dg-badge" style="--rg:#22c55e"><img src="/reward-ai.jpg" alt=""></div><div class="dg-amt">+' + (d.credit_added || 3) + tr('장', '枚', '') + '</div><div class="dg-lbl">' + tr('생성권', 'チケット', 'credits') + '</div></div>'
            + '<div class="dg-gift"><div class="dg-badge" style="--rg:#f59e0b"><img src="/reward-mileage.jpg" alt=""></div><div class="dg-amt">+' + Number(d.mileage_added || 1000).toLocaleString() + tr('원', '', '') + '</div><div class="dg-lbl">' + tr('마일리지', 'マイル', 'mileage') + '</div></div>'
            + '</div>'
            + '<div class="dg-given">' + tr('지급되었습니다!', '付与されました！', 'Granted!') + '</div>'
            + '<div class="dg-miss"><h4>' + tr('오늘 더 받는 방법 (게임하고 글 남기면 선물 더!)', '今日もっと貰う方法（遊んで投稿でプレゼント！）', 'Earn more today — play & post for gifts!') + '</h4><ul>' + missions + '</ul></div>'
            + '<div class="dg-btns"><button class="dg-btn p" id="dgGame">' + gameName + '</button><button class="dg-btn s" id="dgBoard">' + boardName + '</button></div>'
            + '</div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.style.opacity = '1'; });
        setTimeout(confetti, 150);
        var closed = false;
        function close() { if (closed) return; closed = true; ov.style.opacity = '0'; setTimeout(function () { try { ov.remove(); } catch (e) {} }, 200); }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        ov.querySelector('.dg-x').addEventListener('click', close);
        ov.querySelector('#dgGame').addEventListener('click', function () { close(); if (window.openWordChain) window.openWordChain(); });
        ov.querySelector('#dgBoard').addEventListener('click', function () { location.href = '/board.html?cat=freetalk'; });
    };

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
          + '.wc-chain{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;max-height:150px;overflow-y:auto}'
          + '.wc-row{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#eef2ff;border-radius:8px;padding:6px 11px}'
          + '.wc-row.last{background:#4f46e5}'
          + '.wc-w{font-size:14px;color:#4338ca;font-weight:700;word-break:break-all}'
          + '.wc-row.last .wc-w{color:#fff}'
          + '.wc-u{font-size:11px;color:#94a3b8;flex-shrink:0}'
          + '.wc-row.last .wc-u{color:#e0e7ff}'
          + '.wc-need{text-align:center;font-size:14px;color:#0f172a;margin-bottom:12px}'
          + '.wc-need b{color:#4f46e5;font-size:19px}'
          + '.wc-inrow{display:flex;gap:8px}'
          + '.wc-in{flex:1;min-width:0;padding:12px 12px;border:1.5px solid #d7dce5;border-radius:12px;font-size:15px;font-family:inherit;outline:none}'
          + '.wc-go{flex:0 0 auto;padding:12px 16px;border:none;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;cursor:pointer;white-space:nowrap}'
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
            kr: { re: /[^가-힣]/, title: '끝말잇기 🎮', desc: '단어를 이으면 마일리지 1,000원 + 생성권 1장! (하루 1회)', place: '단어 입력', go: '잇기', next: '다음 시작 글자: ', any: '아무 단어나 시작하세요!', empty: '아직 단어가 없어요. 첫 단어를 시작!', invalid: '순수 한글 단어만 가능해요', dup: '이미 사용된 단어예요', short: '2글자 이상 입력하세요', endn: '', today: '오늘 보상 ', success: '끝말잇기 성공!', maxed: '이어졌어요! (오늘 보상은 다 받았어요)', login: '로그인 후 이용해주세요', retry: '다시 시도해주세요', chain: function (c) { return '「' + c + '」(으)로 시작해야 해요'; } },
            ja: { re: /[^ぁ-んァ-ヶー]/, title: 'しりとり 🎮', desc: '単語をつなぐと100円分 + チケット1枚！(1日1回)', place: 'ひらがな・カタカナ', go: 'つなぐ', next: '次の頭文字: ', any: '好きな単語で開始！', empty: 'まだ単語がありません。最初の単語を！', invalid: 'ひらがな・カタカナのみ', dup: '既に使われた単語です', short: '2文字以上入力してください', endn: '「ん」で終わる単語はダメ！', today: '本日 ', success: 'しりとり成功！', maxed: 'つながった！(本日の報酬は上限)', login: 'ログインしてください', retry: '再試行してください', chain: function (c) { return '「' + c + '」で始めてください'; } },
            en: { re: /[^a-zA-Z]/, title: 'Word Chain 🎮', desc: 'Chain a word: +$1 & 1 credit! (1/day)', place: 'Type an English word', go: 'Chain', next: 'Next starts with: ', any: 'Start with any word!', empty: 'No words yet — start it!', invalid: 'English letters only', dup: 'Already used', short: 'At least 2 letters', endn: '', today: 'Today ', success: 'Word chained!', maxed: 'Chained! (daily reward maxed)', login: 'Please log in first.', retry: 'Try again', chain: function (c) { return 'Must start with "' + c + '"'; } }
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
            var _e = function (s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); };
            ov.querySelector('#wcChain').innerHTML = recent.length ? recent.map(function (e, i) {
                var word = (e && typeof e === 'object' && e.word != null) ? e.word : e;
                var name = (e && typeof e === 'object' && e.name) ? e.name : '';
                return '<div class="wc-row' + (i === 0 ? ' last' : '') + '"><span class="wc-w">' + _e(word) + '</span><span class="wc-u">' + _e(name) + '</span></div>';
            }).join('') : ('<div style="color:#94a3b8;font-size:13px;text-align:center;padding:8px;">' + G.empty + '</div>');
            nextChar = st && st.next_char;
            ov.querySelector('#wcNeed').innerHTML = nextChar ? (G.next + '<b>' + nextChar + '</b>') : G.any;
            ov.querySelector('#wcFoot').textContent = G.today + Math.min((st && st.plays_today) || 0, 1) + ' / ' + 1;
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
