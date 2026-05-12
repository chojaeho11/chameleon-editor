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

    var HOST = (location.hostname || '').toLowerCase();
    var IS_COTTON = HOST.indexOf('cotton-print') >= 0;
    var LOCAL_KEY = IS_COTTON ? 'cp_cart_v1' : 'chameleon_cart_current';
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

    // ── Unified cache (all sources) ──────────────────────
    // Mirror of server state + any local items not yet pushed.
    var _unified = [];

    function rebuildLocalFromUnified() {
        // Domain stores only its own __source items in its native localStorage key.
        var mine = _unified.filter(function (it) {
            return it && (it.__source === SOURCE || !it.__source && SOURCE === 'main');
        });
        writeLocalRaw(mine);
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
    function pull() {
        var c = sb();
        if (!c) return Promise.resolve(null);
        return c.from('carts').select('items').eq('session_id', SID).maybeSingle()
            .then(function (res) {
                if (res.error) {
                    if (res.error.code !== 'PGRST116') console.warn('[cart_sync] pull', res.error);
                    return null;
                }
                return res.data ? (res.data.items || []) : null;
            })
            .catch(function (e) { console.warn('[cart_sync] pull exc', e); return null; });
    }

    function push(items) {
        var c = sb();
        if (!c) return Promise.resolve();
        return c.from('carts').upsert(
            { session_id: SID, items: items, updated_at: new Date().toISOString() },
            { onConflict: 'session_id' }
        ).then(function (res) {
            if (res.error) console.warn('[cart_sync] push', res.error);
        }).catch(function (e) { console.warn('[cart_sync] push exc', e); });
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
    // Captures writes to the native cart key, replaces "my" items in unified,
    // keeps other-source items untouched, then pushes.
    var __origLocalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
        if (key !== LOCAL_KEY) return __origLocalSet(key, value);
        // Persist raw
        __origLocalSet(key, value);
        // Update unified
        var mine = [];
        try { mine = JSON.parse(value || '[]') || []; } catch (e) {}
        mine.forEach(tagItem);
        var others = _unified.filter(function (it) {
            return it && it.__source && it.__source !== SOURCE;
        });
        _unified = others.concat(mine);
        schedulePush();
        // Update cross-domain banner without recursing
        try { renderCrossDomainBanner(); } catch (e) {}
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

    // ── Cross-domain summary banner (rendered into #cartCrossBanner if present) ──
    function renderCrossDomainBanner() {
        var host = document.getElementById('cartCrossBanner');
        if (!host) return;
        var others = _unified.filter(function (it) {
            return it && it.__source && it.__source !== SOURCE;
        });
        if (!others.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
        // Group by source
        var groups = {};
        others.forEach(function (it) {
            var src = it.__source || 'unknown';
            groups[src] = (groups[src] || 0) + 1;
        });
        var labels = {
            'cotton-print': IS_COTTON ? '패브릭' : 'cotton-print.com',
            'main': '일반상품 (종이매대·명함·허니콤보드 등)'
        };
        var siblingUrl = '';
        if (IS_COTTON) siblingUrl = 'https://cafe2626.com/?sid=' + SID + '#cart';
        else siblingUrl = 'https://cotton-print.com/cotton_designer.html?sid=' + SID;
        var parts = Object.keys(groups).map(function (k) {
            return (labels[k] || k) + ' ' + groups[k] + '개';
        }).join(', ');
        host.style.display = 'block';
        host.innerHTML =
            '<div style="padding:10px 12px; background:#fff7e6; border:1px solid #ffd18f; ' +
            'border-radius:8px; font-size:12px; color:#7a4a00; margin:8px; display:flex; ' +
            'align-items:center; gap:8px; justify-content:space-between;">' +
                '<div>' +
                    '<i class="fa-solid fa-link" style="margin-right:6px;"></i>' +
                    '다른 사이트 장바구니: <b>' + parts + '</b>' +
                '</div>' +
                '<a href="' + siblingUrl + '" style="color:#b35900; font-weight:700; text-decoration:underline;">' +
                    '보러가기 →' +
                '</a>' +
            '</div>';
    }

    // ── Init ─────────────────────────────────────────────
    var _initialized = false;
    function init() {
        if (_initialized) return;
        _initialized = true;
        // 1) Load server state
        pull().then(function (serverItems) {
            var local = readLocal();
            local.forEach(tagItem);
            _unified = mergeServerLocal(serverItems, local);
            // 2) Write back domain-filtered view to native key
            rebuildLocalFromUnified();
            // 3) If we had local items not yet on server, push them
            if (!serverItems || serverItems.length !== _unified.length) schedulePush();
            // 4) Patch outbound sibling links
            patchLinksOnce();
            var obs = new MutationObserver(patchLinksOnce);
            try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
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
