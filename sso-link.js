/* sso-link.js — 크로스도메인 로그인 공유 (링크 이동 기반 SSO)  2026-08-15
 *
 * 문제: cafe2626.com / cotton-print(er).com / hexa-board.com 은 서로 다른 도메인 →
 *       Supabase 세션(localStorage)이 도메인마다 분리 → 한 곳에서 로그인해도 다른 곳은 로그아웃.
 * 해법(링크 기반): 우리 사이트끼리 이동하는 링크에 현재 세션 토큰을 #sso= 해시로 붙이고,
 *       도착한 페이지가 그 토큰으로 setSession → 자동 로그인. (해시는 서버로 전송되지 않고 즉시 제거)
 *
 * - 우리 도메인 화이트리스트로만 토큰을 붙임 (외부로 절대 유출 안 함).
 * - 해시 조각 사용(쿼리 아님) + 도착 즉시 URL 정리 → 노출 최소화.
 * - anchor 클릭 자동 데코 + window.ssoDecorate(url) 로 programmatic 이동도 지원.
 */
(function () {
    'use strict';
    if (location.protocol !== 'https:') return;   // 로컬/비https 스킵

    var SB_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
    var STORAGE_KEY = 'sb-qinvtnhiidtmrzosyvys-auth-token';

    // 우리 소유 도메인만 (서브도메인 포함). 여기 없는 곳으로는 토큰을 절대 안 붙임.
    var OWN = /(^|\.)(cafe2626\.com|cafe0101\.com|cafe3355\.com|chameleon\.design|cotton-print\.com|cotton-printer\.com|hexa-board\.com)$/i;
    function isOwnHost(h) { return !!h && OWN.test(String(h).toLowerCase()); }

    function b64e(str) {
        return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function b64d(str) {
        str = String(str).replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        return decodeURIComponent(escape(atob(str)));
    }

    // ---- Supabase 클라이언트 확보 (앱이 만든 window.sb 우선, 없으면 동일 키로 생성) ----
    function getSb() {
        if (window.sb && window.sb.auth) return window.sb;
        if (window.supabase && window.supabase.createClient) {
            try {
                // detectSessionInUrl:true — 앱 클라이언트와 동일하게 (단독 도메인에서 우리가 먼저 만들어도 OAuth 복귀 정상 처리)
                window.sb = window.supabase.createClient(SB_URL, SB_KEY, {
                    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: localStorage, storageKey: STORAGE_KEY }
                });
                return window.sb;
            } catch (e) { return null; }
        }
        return null;
    }
    function waitForSb() {
        return new Promise(function (resolve) {
            var n = 0;
            (function chk() {
                var sb = getSb();
                if (sb) return resolve(sb);
                if (n++ > 120) return resolve(null);   // 최대 ~6초 대기
                setTimeout(chk, 50);
            })();
        });
    }

    // ---- 현재 세션 캐시 (클릭 시 동기 접근용) ----
    var _sess = null;   // { at, rt }
    function cacheSession(s) { _sess = (s && s.access_token && s.refresh_token) ? { at: s.access_token, rt: s.refresh_token } : null; }

    async function initSessionCache() {
        var sb = await waitForSb(); if (!sb) return;
        try { var r = await sb.auth.getSession(); cacheSession(r && r.data && r.data.session); } catch (e) {}
        try { sb.auth.onAuthStateChange(function (_evt, s) { cacheSession(s); }); } catch (e) {}
    }

    // ---- URL 데코레이션 (우리 도메인 & 로그인 상태일 때만 #sso= 부착) ----
    function decorate(url) {
        try {
            if (!_sess || !_sess.at || !_sess.rt) return url;
            var u = new URL(url, location.href);
            if (u.protocol !== 'https:') return url;
            if (!isOwnHost(u.hostname)) return url;                 // 외부 도메인 → 절대 안 붙임
            if (u.hostname.toLowerCase() === location.hostname.toLowerCase()) return url; // 같은 도메인 불필요
            if (/[#&]sso=/.test(u.hash)) return url;                // 이미 있음
            var tok = b64e(JSON.stringify({ at: _sess.at, rt: _sess.rt }));
            u.hash = (u.hash && u.hash !== '#') ? (u.hash + '&sso=' + tok) : ('#sso=' + tok);
            return u.toString();
        } catch (e) { return url; }
    }
    // programmatic 이동용 공개 헬퍼: location.href = window.ssoDecorate('https://www.hexa-board.com/...')
    window.ssoDecorate = decorate;

    // anchor 클릭 시 실제 이동 직전 href 갱신 (capture 단계)
    document.addEventListener('click', function (ev) {
        try {
            var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
            if (!a) return;
            var href = a.getAttribute('href');
            if (!href || href.charAt(0) === '#' || /^(javascript|mailto|tel|data):/i.test(href)) return;
            var u = new URL(href, location.href);
            if (u.hostname.toLowerCase() === location.hostname.toLowerCase() || !isOwnHost(u.hostname)) return;
            var dec = decorate(u.toString());
            if (dec !== u.toString()) a.href = dec;
        } catch (e) {}
    }, true);

    // ---- 도착: #sso= (로그인) / #sso_none=1 (세션없음 응답) 소비 ----
    //   반환: 'logged-in' | 'none' | 'nothing'
    async function consumeIncoming() {
        try {
            var hasNone = /[#&]sso_none=/.test(location.hash);
            var m = location.hash.match(/[#&]sso=([^&]+)/);
            if (!m && !hasNone) return 'nothing';
            // 재소비 방지: 해시에서 sso 관련 토큰 먼저 제거
            var cleanHash = location.hash
                .replace(/([#&])sso=[^&]*/, '$1')
                .replace(/([#&])sso_none=[^&]*/, '$1')
                .replace(/^#&/, '#').replace(/&&/g, '&').replace(/[#&]$/, '');
            if (cleanHash === '#') cleanHash = '';
            try { history.replaceState(null, '', location.pathname + location.search + cleanHash); } catch (e) {}
            if (hasNone && !m) return 'none';
            var obj = null;
            try { obj = JSON.parse(b64d(m[1])); } catch (e) { obj = null; }
            if (!obj || !obj.at || !obj.rt) return 'nothing';
            var sb = await waitForSb(); if (!sb) return 'nothing';
            // 이미 로그인돼 있으면 스킵 (덮어쓰기 방지)
            try { var cur = await sb.auth.getSession(); if (cur && cur.data && cur.data.session) { cacheSession(cur.data.session); return 'logged-in'; } } catch (e) {}
            var r = await sb.auth.setSession({ access_token: obj.at, refresh_token: obj.rt });
            if (r && r.data && r.data.session) {
                cacheSession(r.data.session);
                location.reload();   // 로그아웃 상태로 렌더됐으므로 새로고침해 로그인 UI 반영 (URL 은 이미 정리됨)
                return 'logged-in';
            }
            return 'nothing';
        } catch (e) { return 'nothing'; }
    }

    // ---- 직접 접속(우리 링크 경유 아님) 대비: cafe2626 허브로 세션당 1회 조용히 확인 ----
    var SILENT_HOSTS = /(^|\.)(cotton-print\.com|cotton-printer\.com|hexa-board\.com)$/i;
    var HUB_URL = 'https://www.cafe2626.com/sso-hub.html';
    function isBot() {
        try { return /bot|crawl|spider|slurp|bing|google|baidu|yandex|duckduck|facebookexternal|embed|preview|lighthouse|headless/i.test(navigator.userAgent || ''); }
        catch (e) { return false; }
    }
    function ssChecked() { try { return sessionStorage.getItem('_ssoChecked') === '1'; } catch (e) { return true; } } // 스토리지 불가 시 확인 스킵(루프 방지)
    function ssMark() { try { sessionStorage.setItem('_ssoChecked', '1'); } catch (e) {} }
    async function maybeSilentCheck() {
        try {
            if (!SILENT_HOSTS.test(location.hostname)) return;   // 단독 도메인만 (cafe2626 은 허브 자신이라 제외)
            if (isBot()) return;                                 // 봇/프리렌더는 리다이렉트 안 함(SEO 보호)
            if (ssChecked()) return;                             // 세션당 1회
            var sb = await waitForSb();
            if (!sb) return;
            var cur = await sb.auth.getSession();
            if (cur && cur.data && cur.data.session) { ssMark(); return; }   // 이미 로그인 → 확인 불필요
            ssMark();                                            // 리다이렉트 전에 표시 (왕복 후 재확인 방지)
            location.replace(HUB_URL + '?return=' + encodeURIComponent(location.href));
        } catch (e) {}
    }

    (async function main() {
        var st = await consumeIncoming();
        if (st === 'logged-in') return;              // 완료(또는 리로드 중)
        if (st === 'none') { ssMark(); return; }     // 방금 허브 확인 결과 세션 없음 → 재확인 안 함
        await maybeSilentCheck();
    })();
    initSessionCache();
})();
