/*
 * 2026-05-14: 통합 방문자 추적 모듈 — 도메인별 분리, 모듈 import 의존성 제거.
 *
 * 설계 원칙:
 *   1. self-contained — supabase-js 모듈 import 없이 fetch 로 REST API 직접 호출.
 *      이전 module 방식은 config.js 가 늦거나 실패하면 trackVisit 자체가 등록 안 됨.
 *   2. fire-and-forget — 추적 실패해도 페이지 동작에 영향 X.
 *   3. 도메인 자동 감지 — site_domain 컬럼에 host 저장 (cafe2626 / cotton-print / etc.).
 *   4. 봇 감지 강화 — UA, navigator.webdriver, headless.
 *   5. 빠른 발화 — DOMContentLoaded 또는 즉시 (load 이벤트 못 기다리는 경우 대비).
 *
 * page_views 컬럼 (필요):
 *   id (auto), created_at (auto), referrer (text), duration (int),
 *   site (text, 국가), site_domain (text, 새 컬럼 — host 명).
 *
 * 사용:
 *   <script src="/tracker.js?v=1" defer></script>
 *   (HTML 어디든 한 줄. 모든 페이지에 동일.)
 */
(function () {
    'use strict';

    // ── Supabase REST endpoint (anon key 는 클라이언트 노출 OK — RLS 가 보호) ──
    var SUPA_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    var SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

    // ── 도메인 → site_domain 매핑 ──
    function detectSiteDomain() {
        var h = (location.hostname || '').toLowerCase();
        // 2026-05-15: cotton-printer.com (일본 패브릭) 먼저 매칭 — cotton-print.com 보다 앞에 둬야
        //   substring 오인은 없지만 명시적 분리 위해 우선 처리.
        if (h.indexOf('cotton-printer.com') >= 0) return 'cotton-printer.com';
        if (h.indexOf('cotton-print.com') >= 0)  return 'cotton-print.com';
        if (h.indexOf('cafe2626.com') >= 0)       return 'cafe2626.com';
        if (h.indexOf('cafe0101.com') >= 0)       return 'cafe0101.com';
        if (h.indexOf('cafe3355.com') >= 0)       return 'cafe3355.com';
        if (h.indexOf('chameleon.design') >= 0)   return 'chameleon.design';
        if (h.indexOf('localhost') >= 0 || h.indexOf('127.0.0.1') >= 0) return 'localhost';
        return h || 'unknown';
    }

    // ── 봇 감지 (UA 기반) ──
    function detectBot() {
        var ua = (navigator.userAgent || '').toLowerCase();
        if (!ua || ua.length < 20) return 'Bot (봇)|EmptyUA';
        if (navigator.webdriver === true) return 'Bot (봇)|Webdriver';
        var patterns = [
            ['googlebot', 'Googlebot'], ['bingbot', 'Bingbot'], ['yandexbot', 'YandexBot'],
            ['baiduspider', 'Baidu'], ['duckduckbot', 'DuckDuckBot'], ['slurp', 'Yahoo'],
            ['applebot', 'Applebot'], ['amazonbot', 'Amazonbot'],
            ['bytespider', 'ByteSpider'], ['petalbot', 'PetalBot'], ['sogou', 'Sogou'],
            ['semrush', 'SemrushBot'], ['ahrefs', 'AhrefsBot'], ['mj12bot', 'MJ12Bot'],
            ['dotbot', 'DotBot'], ['rogerbot', 'RogerBot'], ['screaming', 'ScreamingFrog'],
            ['facebookexternalhit', 'Facebook'], ['twitterbot', 'TwitterBot'],
            ['linkedinbot', 'LinkedInBot'], ['pinterestbot', 'PinterestBot'],
            ['chatgpt', 'ChatGPT'], ['gptbot', 'GPTBot'], ['claudebot', 'ClaudeBot'],
            ['anthropic', 'Anthropic'], ['ccbot', 'CCBot'], ['perplexity', 'Perplexity'],
            ['mediapartners', 'GoogleAdsBot'], ['adsbot', 'GoogleAdsBot'],
            ['headlesschrome', 'HeadlessChrome'], ['phantomjs', 'PhantomJS'],
            ['prerender', 'Prerender'], ['lighthouse', 'Lighthouse'],
            ['pagespeed', 'PageSpeed'], ['gtmetrix', 'GTmetrix'],
            ['pingdom', 'Pingdom'], ['uptimerobot', 'UptimeRobot'],
            ['curl/', 'curl'], ['wget/', 'wget'], ['python-requests', 'Python'],
            ['python-urllib', 'Python'], ['java/', 'Java'], ['go-http-client', 'Go'],
            ['node-fetch', 'Node'], ['axios/', 'Axios'], ['httpx', 'HTTPX'],
            ['scrapy', 'Scrapy'], ['nutch', 'Nutch'], ['ia_archiver', 'InternetArchive'],
            // 위 specific 매칭이 없을 때 폴백 (가장 마지막)
            ['crawler', 'Crawler'], ['spider', 'Spider'], ['bot/', 'Bot']
        ];
        for (var i = 0; i < patterns.length; i++) {
            if (ua.indexOf(patterns[i][0]) >= 0) return 'Bot (봇)|' + patterns[i][1];
        }
        return null;
    }

    // ── 유입 경로 분류 ──
    function detectTrafficSource() {
        var bot = detectBot();
        if (bot) return bot;

        var params = new URLSearchParams(location.search);
        var ref = document.referrer || '';
        var refHost = '';
        try { refHost = ref ? new URL(ref).hostname.toLowerCase() : ''; } catch (_) {}

        // 같은 도메인 → 내부 이동 (추적 skip)
        if (refHost && refHost === location.hostname.toLowerCase()) return '__INTERNAL__';
        // 형제 도메인 (cafe2626/0101/3355/cotton-print/cotton-printer) 도 내부 이동 취급
        // 2026-05-15: cotton-printer.com 누락 → cotton-printer 내부 이동이 외부유입으로
        //   잘못 집계되던 버그 fix (cotton-print.com 은 substring 으로 안 잡힘).
        var siblingDomains = ['cafe2626.com', 'cafe0101.com', 'cafe3355.com', 'cotton-print.com', 'cotton-printer.com', 'chameleon.design'];
        for (var i = 0; i < siblingDomains.length; i++) {
            if (refHost.indexOf(siblingDomains[i]) >= 0) return '__INTERNAL__';
        }

        // 광고 파라미터 우선
        var hasGclid = params.has('gclid');
        var hasNaverAd = params.has('na_click_id') || params.has('n_campaign_type') || params.has('nclid');
        var utmMedium = (params.get('utm_medium') || '').toLowerCase();
        var utmSource = (params.get('utm_source') || '').toLowerCase();
        var isCpc = utmMedium === 'cpc';

        if (hasGclid || (utmSource === 'google' && isCpc)) {
            var c1 = params.get('utm_campaign') || '';
            var k1 = params.get('utm_term') || '';
            return 'Google Ads (광고)' + (c1 ? '|캠페인:' + c1 : '') + (k1 ? '|키워드:' + k1 : '');
        }
        if (hasNaverAd || (utmSource === 'naver' && isCpc)) {
            var c2 = params.get('n_campaign_type') || params.get('utm_campaign') || '';
            var k2 = params.get('utm_term') || params.get('query') || '';
            return 'Naver Ads (광고)' + (c2 ? '|캠페인:' + c2 : '') + (k2 ? '|키워드:' + k2 : '');
        }
        if (utmSource === 'yahoo' && isCpc) return 'Yahoo Ads (광고)';
        if (utmMedium === 'cpc') return (utmSource || 'other') + ' Ads (광고)';

        // QR 코드 (QR scanner 가 utm_source=qr 으로 보내는 관례)
        if (utmSource === 'qr' || params.get('source') === 'qr') return 'QR코드';

        // 자연 검색 (referrer 도메인 기반)
        if (refHost) {
            if (refHost.indexOf('google.') >= 0) return 'Google Search (자연검색)';
            if (refHost.indexOf('naver.') >= 0) return 'Naver Search (자연검색)';
            if (refHost.indexOf('daum.') >= 0 || refHost.indexOf('kakao') >= 0) return 'Daum/Kakao';
            if (refHost.indexOf('bing.') >= 0) return 'Bing Search (자연검색)';
            if (refHost.indexOf('yahoo.') >= 0) return 'Yahoo Search (자연검색)';
            if (refHost.indexOf('duckduckgo') >= 0) return 'DuckDuckGo Search (자연검색)';
            // SNS
            // 2026-05-15: Threads 를 instagram. 보다 먼저 — 안드로이드 Threads 앱은 referrer 를
            //   android-app://com.instagram.barcelona 로 보내 'instagram.' 에 먼저 잡혀 인스타로 오분류됨.
            if (refHost.indexOf('threads.') >= 0 || refHost.indexOf('barcelona') >= 0) return 'Threads (SNS)';
            if (refHost.indexOf('instagram.') >= 0) return 'Instagram (SNS)';
            if (refHost.indexOf('facebook.') >= 0 || refHost.indexOf('fb.') >= 0) return 'Facebook (SNS)';
            if (refHost.indexOf('youtube.') >= 0 || refHost.indexOf('youtu.be') >= 0) return 'YouTube (SNS)';
            if (refHost.indexOf('tiktok.') >= 0) return 'TikTok (SNS)';
            if (refHost.indexOf('twitter.') >= 0 || refHost.indexOf('x.com') >= 0 || refHost.indexOf('t.co') >= 0) return 'Twitter/X (SNS)';
            if (refHost.indexOf('pinterest.') >= 0) return 'Pinterest (SNS)';
            if (refHost.indexOf('line.me') >= 0) return 'LINE (메신저)';
            // 블로그 플랫폼
            if (refHost.indexOf('tistory.') >= 0) return '[Blog] tistory|' + refHost;
            if (refHost.indexOf('blog.naver.') >= 0) return '[Blog] naver|' + refHost;
            if (refHost.indexOf('brunch.') >= 0) return '[Blog] brunch|' + refHost;
            if (refHost.indexOf('medium.') >= 0) return '[Blog] medium|' + refHost;
            if (refHost.indexOf('blogspot.') >= 0 || refHost.indexOf('blogger.') >= 0) return '[Blog] blogspot|' + refHost;
            if (refHost.indexOf('wordpress.') >= 0) return '[Blog] wordpress|' + refHost;
            return refHost;
        }

        return 'Direct (즐겨찾기/주소입력)';
    }

    // ── 국가 감지 (Cloudflare cdn-cgi/trace 우선, 실패 시 timezone) ──
    function detectCountryFromTz() {
        try {
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            if (tz.indexOf('Seoul') >= 0 || tz.indexOf('Korea') >= 0) return 'KR';
            if (tz.indexOf('Tokyo') >= 0 || tz.indexOf('Japan') >= 0) return 'JP';
            if (tz.indexOf('Shanghai') >= 0 || tz.indexOf('Chongqing') >= 0) return 'CN';
            if (tz.indexOf('Hong_Kong') >= 0) return 'HK';
            if (tz.indexOf('Taipei') >= 0) return 'TW';
            if (tz.indexOf('Bangkok') >= 0) return 'TH';
            if (tz.indexOf('Singapore') >= 0) return 'SG';
            if (tz.indexOf('America') >= 0 || tz.indexOf('US/') >= 0) return 'US';
            if (tz.indexOf('Europe') >= 0) return 'EU';
            return 'OTHER';
        } catch (_) { return 'KR'; }
    }

    function detectCountry(cb) {
        // 5 초 안에 응답 없으면 timezone 폴백
        var done = false;
        var timer = setTimeout(function () {
            if (done) return; done = true;
            cb(detectCountryFromTz());
        }, 5000);
        try {
            fetch('/cdn-cgi/trace').then(function (r) { return r.text(); }).then(function (t) {
                if (done) return; done = true; clearTimeout(timer);
                var m = t.match(/loc=([A-Z]{2})/);
                cb(m ? m[1] : detectCountryFromTz());
            }).catch(function () {
                if (done) return; done = true; clearTimeout(timer);
                cb(detectCountryFromTz());
            });
        } catch (_) {
            if (done) return; done = true; clearTimeout(timer);
            cb(detectCountryFromTz());
        }
    }

    // ── REST POST page_views 삽입 ──
    function insertVisit(payload, cb) {
        try {
            fetch(SUPA_URL + '/rest/v1/page_views', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPA_ANON,
                    'Authorization': 'Bearer ' + SUPA_ANON,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify([payload])
            }).then(function (r) {
                if (!r.ok) { console.warn('[tracker] insert failed', r.status); cb(null); return; }
                r.json().then(function (rows) { cb(rows && rows[0] && rows[0].id); }).catch(function () { cb(null); });
            }).catch(function (e) {
                console.warn('[tracker] insert error', e && e.message);
                cb(null);
            });
        } catch (e) {
            console.warn('[tracker] insert throw', e && e.message);
            cb(null);
        }
    }

    // ── 체류 시간 업데이트 (PATCH) ──
    function patchDuration(visitId, sec, keepalive) {
        if (!visitId) return;
        try {
            fetch(SUPA_URL + '/rest/v1/page_views?id=eq.' + visitId, {
                method: 'PATCH',
                keepalive: !!keepalive,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPA_ANON,
                    'Authorization': 'Bearer ' + SUPA_ANON,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ duration: sec })
            }).catch(function () {});
        } catch (_) {}
    }

    // ── 메인 ──
    function track() {
        // 동일 페이지 로드에서 중복 호출 방지
        if (window.__tracker_fired) return;
        window.__tracker_fired = true;

        var source = detectTrafficSource();
        if (source === '__INTERNAL__') {
            // 내부 이동은 페이지뷰 기록 X
            return;
        }
        var siteDomain = detectSiteDomain();

        detectCountry(function (country) {
            var payload = {
                referrer: source,
                duration: 0,
                site: country,
                site_domain: siteDomain
            };
            insertVisit(payload, function (visitId) {
                if (!visitId) return;
                var start = Date.now();
                var MAX_MS = 30 * 60 * 1000;
                // 5분마다 체류시간 업데이트, 30분 후 종료
                var timer = setInterval(function () {
                    var elapsed = Date.now() - start;
                    if (elapsed > MAX_MS) { clearInterval(timer); return; }
                    if (document.hidden) return;
                    patchDuration(visitId, Math.floor(elapsed / 1000), false);
                }, 5 * 60 * 1000);
                // 페이지 이탈 시 최종 업데이트 (sendBeacon 호환 — keepalive)
                window.addEventListener('beforeunload', function () {
                    var sec = Math.floor((Date.now() - start) / 1000);
                    patchDuration(visitId, sec, true);
                });
                // pagehide (iOS Safari 호환)
                window.addEventListener('pagehide', function () {
                    var sec = Math.floor((Date.now() - start) / 1000);
                    patchDuration(visitId, sec, true);
                });
            });
        });
    }

    // ── 발화 타이밍: DOMContentLoaded 또는 즉시 (load 이벤트 못 기다림 — 일부 페이지에서 load 가 늦거나 안 옴) ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', track);
    } else {
        track();
    }

    // 디버깅용 전역 노출
    window.__tracker = {
        track: track,
        detectSiteDomain: detectSiteDomain,
        detectTrafficSource: detectTrafficSource
    };
})();
