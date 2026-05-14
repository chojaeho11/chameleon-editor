/**
 * cart_sync.js — Cross-domain unified cart sync
 *
 * Bridges localStorage carts across:
 *   - cotton-print.com  (cp_cart_v1)         — fabric items
 *   - cafe2626.com      (chameleon_cart_current) — general products (KR)
 *   - cafe0101.com      (chameleon_cart_current) — general products (JP)
 *   - cafe3355.com      (chameleon_cart_current) — general products (US)
 *
 * Storage backend:  Supabase `carts` table  (see sql/unified_cart.sql)
 * Session keying:   URL `?sid=` > localStorage `unified_cart_sid` > new uuid
 *
 * What each domain sees in its OWN cart drawer:
 *   - Items matching its native `__source` (existing renderers, untouched)
 * What each domain sees ABOVE its native list (cross-domain summary):
 *   - Counts of items from sibling domains, with a "view there" link
 *
 * Public API (window.cartSync):
 *   sid()              → string
 *   getAllItems()      → array (unified)
 *   getMyItems()       → array (filtered to current domain's source)
 *   getOtherItems()    → array (other sources)
 *   forceSync()        → Promise; push current local cart
 *   linkToSibling(host) → URL with ?sid= attached
 *
 * Version: v1 (2026-05-12)
 */
(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────
    var SUPABASE_URL  = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

    // 2026-05-12: 도메인 통합 — cafe 도메인의 /fabric, /cotton-designer 경로도 IS_COTTON 처리
    // 이렇게 하면 같은 origin 안에서 패브릭 카트와 일반 카트가 chameleon_cart_current 라는 단일 키를
    // 공유하면서도 __source 태그로 구분되어 각 렌더러가 자기 항목만 렌더 가능.
    var HOST = (location.hostname || '').toLowerCase();
    var PATH = (location.pathname || '').toLowerCase();
    var IS_COTTON_HOST = HOST.indexOf('cotton-print') >= 0;
    var IS_COTTON_PATH = PATH.indexOf('/fabric') === 0 || PATH.indexOf('/cotton-designer') === 0 ||
                          PATH.indexOf('cotton_designer') >= 0;
    var IS_COTTON = IS_COTTON_HOST || IS_COTTON_PATH;
    // cotton-print.com 레거시 도메인은 cp_cart_v1 유지, cafe 도메인의 /fabric 은 chameleon_cart_current 공유
    var LOCAL_KEY = IS_COTTON_HOST ? 'cp_cart_v1' : 'chameleon_cart_current';
    var SOURCE    = IS_COTTON ? 'cotton-print' : 'main';
    var SID_KEY   = 'unified_cart_sid';

    var SIBLINGS = [
        'cotton-print.com',
        'cafe2626.com',
        'cafe0101.com',
        'cafe3355.com'
    ];

    function isSiblingHost(h) {
        h = (h || '').toLowerCase();
        for (var i = 0; i < SIBLINGS.length; i++) {
            if (h === SIBLINGS[i] || h.endsWith('.' + SIBLINGS[i])) return true;
        }
        return false;
    }

    // ── UUID ─────────────────────────────────────────────
    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx').replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    // ── Session ID ───────────────────────────────────────
    function readSid() {
        try {
            var p = new URLSearchParams(location.search);
            var fromUrl = p.get('sid');
            if (fromUrl && /^[a-f0-9-]{30,40}$/i.test(fromUrl)) {
                try { localStorage.setItem(SID_KEY, fromUrl); } catch (e) {}
                // 2026-05-14: 읽고 나면 URL 에서 sid 파라미터 제거 (주소창 깔끔하게)
                try {
                    p.delete('sid');
                    var qs = p.toString();
                    var newUrl = location.pathname + (qs ? '?' + qs : '') + location.hash;
                    history.replaceState(null, '', newUrl);
                } catch (e) {}
                return fromUrl;
            }
        } catch (e) {}
        try {
            var stored = localStorage.getItem(SID_KEY);
            if (stored) return stored;
        } catch (e) {}
        var fresh = uuid();
        try { localStorage.setItem(SID_KEY, fresh); } catch (e) {}
        return fresh;
    }
    var SID = readSid();

    // ── Supabase client (lazy, reuse existing) ───────────
    // Reuse window.sb if present (avoids "Multiple GoTrueClient instances" warning).
    function sb() {
        // 1) Page may already have an authenticated client (window.sb)
        if (window.sb && typeof window.sb.from === 'function') return window.sb;
        // 2) Cached our own
        if (window.__unified_sb) return window.__unified_sb;
        // 3) Build a fresh one only as last resort
        if (!window.supabase || !window.supabase.createClient) return null;
        try {
            window.__unified_sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
            return window.__unified_sb;
        } catch (e) { return null; }
    }

    // ── Local helpers ────────────────────────────────────
    function readLocal() {
        try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') || []; }
        catch (e) { return []; }
    }
    // We bypass setItem interceptor when writing back merged state
    function writeLocalRaw(items) {
        try {
            var json = JSON.stringify(items);
            if (typeof __origLocalSet === 'function') __origLocalSet(LOCAL_KEY, json);
            else localStorage.setItem(LOCAL_KEY, json);
        } catch (e) {}
    }

    function tagItem(it) {
        if (!it || typeof it !== 'object') return it;
        if (!it.__source) it.__source = SOURCE;
        if (!it.__cart_id) it.__cart_id = uuid();
        return it;
    }

    // 2026-05-12: 빈/손상된 카트 항목 식별 — 표시 가능한 최소 필드 검증
    // 패브릭: title/fabricName/fabricCode/orderWcm 중 하나는 있어야 함
    // 일반: product (object) 또는 productCode/productName 중 하나
    function isValidCartItem(it) {
        if (!it || typeof it !== 'object') return false;
        if (it.fabricCode || it.fabricName || it.title || it.orderWcm != null) return true;
        if (it.product && typeof it.product === 'object' && (it.product.code || it.product.name)) return true;
        if (it.productCode || it.productName) return true;
        // 2026-05-14: 매니저견적 주문에서 복원한 fabric/일반 항목 (snake_case 또는 source 태그) 호환
        if (it.product_name || it.product_code) return true;
        if (it.source === 'cotton-print' && (it.fabric || it.artwork_url)) return true;
        return false;
    }

    // ── Unified cache (all sources) ──────────────────────
    // Mirror of server state + any local items not yet pushed.
    var _unified = [];

    function rebuildLocalFromUnified() {
        // 2026-05-12: 도메인 통합 — 같은 origin 안에서는 모든 항목을 통째로 보존.
        // 각 페이지의 렌더러가 알아서 필터링 (패브릭/일반)하므로 cart_sync 는 분리 안 함.
        writeLocalRaw(_unified.slice());
        notifyRender();
    }

    function notifyRender() {
        try { if (typeof window._cpUpdateCartUI === 'function') window._cpUpdateCartUI(); } catch (e) {}
        try { if (typeof window.renderCart === 'function') window.renderCart(); } catch (e) {}
        try { if (typeof window._soUpdateCartCount === 'function') window._soUpdateCartCount(); } catch (e) {}
        // Cross-domain summary panel
        renderCrossDomainBanner();
    }

    // ── Server ops ───────────────────────────────────────
    // Key by user_id if logged in (cross-domain auto-sync), else by session_id.
    var _userId = null;
    function getUserId() {
        var c = sb();
        if (!c || !c.auth || typeof c.auth.getSession !== 'function') return Promise.resolve(null);
        return c.auth.getSession()
            .then(function (r) {
                return r && r.data && r.data.session && r.data.session.user
                    ? r.data.session.user.id : null;
            })
            .catch(function () { return null; });
    }

    function pull() {
        var c = sb();
        if (!c) return Promise.resolve(null);
        // Prefer user_id (cross-domain shared) over session_id (per-device).
        var q;
        if (_userId) {
            q = c.from('carts').select('items').eq('user_id', _userId).maybeSingle();
        } else {
            q = c.from('carts').select('items').eq('session_id', SID).maybeSingle();
        }
        return q.then(function (res) {
            if (res.error) {
                if (res.error.code !== 'PGRST116') console.warn('[cart_sync] pull', res.error);
                return null;
            }
            return res.data ? (res.data.items || []) : null;
        }).catch(function (e) { console.warn('[cart_sync] pull exc', e); return null; });
    }

    function push(items) {
        var c = sb();
        if (!c) return Promise.resolve();
        var row, conflict;
        if (_userId) {
            // 로그인 상태: user_id 만으로 키잉. session_id 는 row 에서 제외하여
            // 익명 세션 행(session_id=SID, user_id=NULL)과의 unique 충돌 회피 (23505).
            row = { user_id: _userId, items: items, updated_at: new Date().toISOString() };
            conflict = 'user_id';
        } else {
            row = { session_id: SID, items: items, updated_at: new Date().toISOString() };
            conflict = 'session_id';
        }
        return c.from('carts').upsert(row, { onConflict: conflict })
            .then(function (res) {
                if (res.error) console.warn('[cart_sync] push', res.error);
            })
            .catch(function (e) { console.warn('[cart_sync] push exc', e); });
    }

    // 로그인 직후: 익명 세션 행(session_id=SID, user_id=NULL)을 삭제하여 orphan 정리
    function cleanupAnonRow() {
        var c = sb();
        if (!c || !_userId || !SID) return Promise.resolve();
        return c.from('carts').delete().eq('session_id', SID).is('user_id', null)
            .then(function (res) {
                if (res.error && res.error.code !== 'PGRST116') {
                    console.warn('[cart_sync] cleanupAnonRow', res.error);
                }
            })
            .catch(function (e) { console.warn('[cart_sync] cleanupAnonRow exc', e); });
    }

    var pushTimer = null;
    function schedulePush() {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () {
            pushTimer = null;
            push(_unified.slice());
        }, 350);
    }

    // ── Merge logic ──────────────────────────────────────
    function mergeServerLocal(serverItems, localItems) {
        var byId = new Map();
        (serverItems || []).forEach(function (it) {
            if (!it) return;
            tagItem(it);
            byId.set(it.__cart_id, it);
        });
        (localItems || []).forEach(function (it) {
            if (!it) return;
            tagItem(it);
            // local wins (most recent intent on this device)
            byId.set(it.__cart_id, it);
        });
        return Array.from(byId.values());
    }

    // ── localStorage interceptor ─────────────────────────
    // 2026-05-12: 도메인 통합 — localStorage 가 곧 unified cart. setItem 발생 시
    // 통째로 _unified 갱신 후 서버 push. invalid 항목은 자동 제거.
    var __origLocalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
        if (key !== LOCAL_KEY) return __origLocalSet(key, value);
        var mine = [];
        try { mine = JSON.parse(value || '[]') || []; } catch (e) {}
        // invalid 항목 (빈 객체, undefined, null) 제거
        var before = mine.length;
        mine = mine.filter(isValidCartItem);
        if (mine.length !== before) {
            console.warn('[cart_sync] invalid 카트 항목 ' + (before - mine.length) + '개 자동 정리');
        }
        mine.forEach(tagItem); // __cart_id 부여 (server merge 용), 기존 __source 는 보존
        // cleanup 결과를 다시 localStorage 에 (loop 방지: __origLocalSet 직접 호출)
        __origLocalSet(key, JSON.stringify(mine));
        _unified = mine;
        schedulePush();
    };

    // ── Cross-domain link rewriting ──────────────────────
    function attachSid(url) {
        try {
            var u = new URL(url, location.href);
            if (u.host === location.host) return u.toString();
            if (!isSiblingHost(u.host)) return u.toString();
            if (!u.searchParams.has('sid')) u.searchParams.set('sid', SID);
            return u.toString();
        } catch (e) { return url; }
    }

    function patchLinksOnce() {
        var anchors = document.querySelectorAll('a[href]');
        for (var i = 0; i < anchors.length; i++) {
            var a = anchors[i];
            if (a.__sidPatched) continue;
            try {
                var orig = a.getAttribute('href') || '';
                if (orig.indexOf('mailto:') === 0 || orig.indexOf('tel:') === 0 || orig.charAt(0) === '#') continue;
                var u = new URL(a.href, location.href);
                if (u.host === location.host) continue;
                if (!isSiblingHost(u.host)) continue;
                if (!u.searchParams.has('sid')) u.searchParams.set('sid', SID);
                a.href = u.toString();
                a.__sidPatched = true;
            } catch (e) {}
        }
    }

    // 2026-05-12: 도메인 통합 — cross-domain banner 제거 (같은 origin이라 불필요).
    // 이제 모든 항목이 한 카트에 통합 렌더되므로 "다른 사이트" 라는 개념 자체가 사라짐.
    function renderCrossDomainBanner() {
        var host = document.getElementById('cartCrossBanner');
        if (host) { host.innerHTML = ''; host.style.display = 'none'; }
    }

    // ── Init ─────────────────────────────────────────────
    var _initialized = false;
    function init() {
        if (_initialized) return;
        _initialized = true;
        // 1) Resolve logged-in user_id (cross-domain shared key)
        getUserId().then(function (uid) {
            _userId = uid;
            if (uid) console.log('[cart_sync] using user_id key:', uid);
            else      console.log('[cart_sync] anonymous session key:', SID);
            // 2) Load server state
            return pull();
        }).then(function (serverItems) {
            var local = readLocal();
            // 2026-05-12: invalid 항목 자동 정리 (서버/로컬 양쪽)
            if (Array.isArray(serverItems)) {
                var sb1 = serverItems.length;
                serverItems = serverItems.filter(isValidCartItem);
                if (serverItems.length !== sb1) console.warn('[cart_sync] server invalid 항목 ' + (sb1 - serverItems.length) + '개 정리');
            }
            var lb1 = local.length;
            local = local.filter(isValidCartItem);
            if (local.length !== lb1) console.warn('[cart_sync] local invalid 항목 ' + (lb1 - local.length) + '개 정리');
            local.forEach(tagItem);
            _unified = mergeServerLocal(serverItems, local);
            // 3) Write back domain-filtered view to native key
            rebuildLocalFromUnified();
            // 4) If we had local items not yet on server, push them
            //    + 로그인 상태면 익명 orphan 행 정리 (23505 에러 예방)
            if (_userId) {
                cleanupAnonRow().then(function () { schedulePush(); });
            } else if (!serverItems || serverItems.length !== _unified.length) {
                schedulePush();
            }
            // 5) Patch outbound sibling links
            patchLinksOnce();
            var obs = new MutationObserver(patchLinksOnce);
            try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
            // 6) Re-sync when auth state changes (login/logout)
            try {
                var c = sb();
                if (c && c.auth && typeof c.auth.onAuthStateChange === 'function') {
                    c.auth.onAuthStateChange(function (_event, session) {
                        var newUid = session && session.user ? session.user.id : null;
                        if (newUid !== _userId) {
                            _userId = newUid;
                            // Re-pull with new key + cleanup anon orphan on login
                            (newUid ? cleanupAnonRow() : Promise.resolve())
                                .then(function () { return pull(); })
                                .then(function (items) {
                                    if (items) {
                                        _unified = mergeServerLocal(items, _unified);
                                        rebuildLocalFromUnified();
                                    }
                                });
                        }
                    });
                }
            } catch (e) {}
        });
    }

    function waitFor(fn, ready, max) {
        max = max || 50;
        if (ready()) return fn();
        var n = 0;
        var t = setInterval(function () {
            if (ready() || ++n > max) { clearInterval(t); if (ready()) fn(); }
        }, 100);
    }

    function start() {
        // Prefer reusing window.sb (created by config.js). Wait up to ~3s for it.
        // Fall back to building our own from window.supabase if not available.
        var tries = 0;
        var t = setInterval(function () {
            var haveSb = window.sb && typeof window.sb.from === 'function';
            var haveUmd = window.supabase && window.supabase.createClient;
            if (document.body && (haveSb || (tries > 30 && haveUmd))) {
                clearInterval(t);
                init();
            }
            tries++;
            if (tries > 60) { clearInterval(t); init(); /* try anyway */ }
        }, 100);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else { start(); }

    // ── Public API ───────────────────────────────────────
    window.cartSync = {
        sid: function () { return SID; },
        getAllItems: function () { return _unified.slice(); },
        getMyItems: function () {
            return _unified.filter(function (it) {
                return it && (it.__source === SOURCE || (!it.__source && SOURCE === 'main'));
            });
        },
        getOtherItems: function () {
            return _unified.filter(function (it) {
                return it && it.__source && it.__source !== SOURCE;
            });
        },
        forceSync: function () {
            var local = readLocal();
            local.forEach(tagItem);
            var others = _unified.filter(function (it) {
                return it && it.__source && it.__source !== SOURCE;
            });
            _unified = others.concat(local);
            return push(_unified.slice());
        },
        linkToSibling: function (url) { return attachSid(url); },
        renderBanner: renderCrossDomainBanner,
        _debug: function () { return { sid: SID, unified: _unified, source: SOURCE, key: LOCAL_KEY }; }
    };

})();
