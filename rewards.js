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

        var lines = [];
        if (opt.aiCredit) lines.push(tr('AI 이미지 생성권 ', 'AI画像生成チケット ', 'AI image credits ') + '+' + opt.aiCredit + tr('장', '枚', ''));
        if (opt.mileage) lines.push(tr('마일리지 ', 'マイル ', 'Mileage ') + '+' + Number(opt.mileage).toLocaleString() + tr('원', '円相当', ' KRW'));
        var detail = lines.join(' · ');
        var given = tr('지급되었습니다', '付与されました', 'granted');

        var ov = document.createElement('div');
        ov.setAttribute('role', 'dialog');
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;'
            + 'background:rgba(15,23,42,0.5);opacity:0;transition:opacity .2s;';
        var card = document.createElement('div');
        card.style.cssText = 'background:#fff;border-radius:20px;padding:26px 30px;max-width:340px;width:calc(100% - 48px);'
            + 'text-align:center;transform:scale(.85);transition:transform .28s cubic-bezier(.2,1.2,.4,1);border:1px solid #eef0f5;';
        card.innerHTML =
            '<div style="font-size:40px;line-height:1;margin-bottom:12px;">🎁</div>'
            + '<div style="font-size:16px;color:#0f172a;margin-bottom:6px;">' + title + '</div>'
            + (detail ? '<div style="font-size:20px;color:#4f46e5;letter-spacing:-0.3px;margin:8px 0 4px;">' + detail + '</div>' : '')
            + '<div style="font-size:13px;color:#94a3b8;margin-top:6px;">' + given + '</div>';
        ov.appendChild(card);
        document.body.appendChild(ov);

        requestAnimationFrame(function () { ov.style.opacity = '1'; card.style.transform = 'scale(1)'; });
        setTimeout(confetti, 120);

        var closed = false;
        function close() {
            if (closed) return; closed = true;
            ov.style.opacity = '0'; card.style.transform = 'scale(.9)';
            setTimeout(function () { try { ov.remove(); } catch (e) {} _popupBusy = false; }, 220);
        }
        ov.addEventListener('click', close);
        var autoT = setTimeout(close, 2800);
        ov.addEventListener('click', function () { clearTimeout(autoT); });
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

    window.rewardAttendance = async function () {
        var sb = await sbReady(); if (!sb) return;
        var uid = await loggedInUid(sb); if (!uid) return;
        try {
            var r = await sb.rpc('attendance_claim'); var d = r && r.data;
            if (d && d.ok) window.showRewardPopup({ kind: 'attendance', mileage: d.mileage_added, aiCredit: d.credit_added });
        } catch (e) {}
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
})();
