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
        'cotton-printer.com',  // 2026-05-15: 일본 cotton-print 전용 도메인
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

    // 2026-07-10: __cart_id 기준 중복 제거.
    //   forceSync 가 통합 도메인에서 타 source(키링 등) 항목을 others.concat(local) 로 이중 등록하던 버그 방어.
    //   같은 __cart_id 를 가진 항목이 둘 이상이면 첫 번째만 유지. id 없는 항목은 그대로(안전).
    function dedupById(items) {
        var seen = {}, out = [];
        (items || []).forEach(function (it) {
            if (!it || typeof it !== 'object') return;
            var id = it.__cart_id;
            if (id == null) { out.push(it); return; }
            if (seen[id]) return;
            seen[id] = true; out.push(it);
        });
        return out;
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

    // 2026-05-14: 삭제 영구화를 위해 updated_at 도 함께 pull. 비교로 last-write-wins.
    function pull() {
        var c = sb();
        if (!c) return Promise.resolve(null);
        var q;
        if (_userId) {
            q = c.from('carts').select('items,updated_at').eq('user_id', _userId).maybeSingle();
        } else {
            q = c.from('carts').select('items,updated_at').eq('session_id', SID).maybeSingle();
        }
        return q.then(function (res) {
            if (res.error) {
                if (res.error.code !== 'PGRST116') console.warn('[cart_sync] pull', res.error);
                return null;
            }
            if (!res.data) return null;
            return { items: res.data.items || [], updatedAt: res.data.updated_at || null };
        }).catch(function (e) { console.warn('[cart_sync] pull exc', e); return null; });
    }

    function push(items) {
        var c = sb();
        if (!c) return Promise.resolve();
        items = dedupById(items); // 2026-07-10: 서버로 보내기 전 중복 __cart_id 제거 (forceSync 이중등록 방어)
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
        // 2026-07-19: 저장된 updated_at 을 돌려받아 로컬 시각을 서버 진실과 맞춘다.
        //   서버 트리거가 updated_at 을 서버 now() 로 덮어쓰기 때문에, 이걸 반영해두지 않으면
        //   (브라우저 시계가 빠른 경우) 로컬이 영원히 서버를 이겨 다른 기기의 정상적인 변경을 무시한다.
        //   단, push 응답을 기다리는 동안 사용자가 또 바꿨다면(pushTimer 대기중) 건드리지 않는다.
        return c.from('carts').upsert(row, { onConflict: conflict }).select('updated_at')
            .then(function (res) {
                if (res.error) {
                    // 조용히 넘기면 삭제가 서버에 반영 안 된 걸 아무도 모른다 → 반드시 눈에 띄게.
                    console.error('[cart_sync] push 실패 — 서버에 반영되지 않음:', res.error.message || res.error);
                    return;
                }
                try {
                    var srvIso = res.data && res.data[0] && res.data[0].updated_at;
                    if (srvIso && !pushTimer) {
                        var srvTs = Date.parse(srvIso);
                        if (srvTs && srvTs > readLocalTs()) writeLocalTs(new Date(srvTs).toISOString());
                    }
                } catch (_e) {}
            })
            .catch(function (e) { console.error('[cart_sync] push 예외 — 서버에 반영되지 않음:', e); });
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
    // 2026-05-15: debounce 350ms → 120ms — 페이지 네비게이션 race window 단축.
    //   고객 리포트: 빠르게 다음 상품으로 이동하면 1차 add 가 서버에 안 올라가던 케이스.
    function schedulePush() {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () {
            pushTimer = null;
            push(_unified.slice());
        }, 120);
    }

    // 2026-05-15: 페이지 떠날 때 sendBeacon 으로 강제 flush.
    //   debounce 안에 있던 push 를 fetch() 로 보내면 페이지 unload 와 함께 abort 됨.
    //   sendBeacon 은 brower 가 navigation 후에도 백그라운드로 완료 보장.
    function flushOnUnload() {
        try {
            // 2026-07-10 FIX: 이 탭에서 실제 변경(pending push)이 있었을 때만 flush.
            //   변경 없는 stale 탭이 탭전환(visibilitychange)·이탈 시 자기 메모리(_unified)를
            //   fresh timestamp 로 재푸시하면, 다른 탭/이전에 삭제한 항목이 서버에서 부활한다.
            //   pending push 가 없다는 건 이 탭이 서버에 반영할 변경이 없다는 뜻 → 아무것도 안 함.
            var hadPending = !!pushTimer;
            if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
            if (!hadPending) return;
            var c = sb();
            if (!c) return;
            var row;
            if (_userId) row = { user_id: _userId, items: _unified.slice(), updated_at: new Date().toISOString() };
            else        row = { session_id: SID, items: _unified.slice(), updated_at: new Date().toISOString() };
            // sendBeacon 으로 직접 PostgREST endpoint 에 POST (upsert via Prefer header).
            //   anonkey/auth 가 필요하므로 Blob 으로 직렬화하면 header 못 붙임 → 일반 fetch keepalive 로 시도.
            var body = JSON.stringify(row);
            var url = SUPABASE_URL + '/rest/v1/carts?on_conflict=' + (_userId ? 'user_id' : 'session_id');
            var hdrs = {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON,
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            };
            // 인증 토큰이 있으면 첨부 — 로그인 유저 카트는 RLS 의해 본인 user_id 만 통과
            try {
                var sess = c && c.auth && typeof c.auth.getSession === 'function' ? null : null;
                // 동기 컨텍스트라 토큰을 즉시 얻기 어려움 → localStorage 에서 직접 추출
                var tokenRaw = localStorage.getItem('sb-qinvtnhiidtmrzosyvys-auth-token');
                if (tokenRaw) {
                    var parsed = JSON.parse(tokenRaw);
                    var at = parsed && parsed.access_token;
                    if (at) hdrs['Authorization'] = 'Bearer ' + at;
                }
            } catch (e) {}
            if (typeof fetch === 'function') {
                fetch(url, { method: 'POST', headers: hdrs, body: body, keepalive: true })
                    .catch(function () {});
            }
        } catch (e) { /* swallow — best effort */ }
    }
    // pagehide 가 unload 보다 모바일 Safari 호환성 좋음. visibilitychange(hidden) 도 함께
    try {
        window.addEventListener('pagehide', flushOnUnload, { capture: true });
        window.addEventListener('beforeunload', flushOnUnload, { capture: true });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') flushOnUnload();
        }, { capture: true });
    } catch (e) {}

    // 2026-07-11: 크로스탭 동기화 — 다른 탭에서 카트가 바뀌면(삭제/추가/주문) 이 탭의 메모리·UI 를 즉시 맞춤.
    //   [중요] 이게 없으면 여러 탭 중 한 곳에서 삭제·주문해도, 옛 카트를 메모리(_unified)에 든 다른 탭이
    //   나중에 push/flush 로 옛 상태를 서버에 재푸시 → 삭제한 항목이 부활한다. (반복 신고된 버그)
    //   storage 이벤트는 '다른 탭'에서 localStorage(LOCAL_KEY) 가 바뀔 때만 발생 → self-loop 없음.
    try {
        window.addEventListener('storage', function (e) {
            if (!e || e.key !== LOCAL_KEY) return;
            var items = [];
            try { items = JSON.parse(e.newValue || '[]') || []; } catch (_) { return; }
            _unified = dedupById(items.filter(isValidCartItem));
            // 다른 탭이 방금 쓴 상태가 최신 → 이 탭의 대기중(오래된) push 취소 (stale 재푸시 방지)
            if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
            // 열려있는 카트 UI 실시간 갱신 (읽기전용 렌더 — 재푸시 유발 안 함)
            try { if (typeof window.renderCart === 'function') window.renderCart(); } catch (_) {}
            try { document.dispatchEvent(new CustomEvent('cart-sync-external-update')); } catch (_) {}
        }, { capture: true });
    } catch (e) {}

    // 2026-05-14: merge-by-id 제거. 삭제가 표현 안 돼서 옛 아이템이 부활하던 버그.
    //   대신 last-write-wins by timestamp — pickFreshState(server, local) 사용.
    var LOCAL_TS_KEY = 'chameleon_cart_updated_at';
    function readLocalTs() {
        var v = localStorage.getItem(LOCAL_TS_KEY) || '';
        return v ? Date.parse(v) : 0;
    }
    function writeLocalTs(iso) {
        try { __origLocalSet(LOCAL_TS_KEY, iso); } catch (e) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2026-07-19 [삭제 항목 부활 버그의 진짜 원인 — 시계가 서로 다름]
    //
    //   carts 테이블에는 BEFORE UPDATE 트리거가 있어서, UPDATE 시 클라이언트가 보낸
    //   updated_at 을 무시하고 서버의 now() 로 덮어쓴다. (REST 로 직접 검증:
    //   INSERT 는 보낸 값 유지 / UPDATE 는 서버시각으로 교체, 마이크로초 6자리)
    //
    //   그 결과 pickFreshState 는 서로 다른 두 시계를 비교하게 된다:
    //     · localTs  = 브라우저 시계 (사용자가 카트를 바꾼 순간)
    //     · serverTs = 서버 시계 (그 변경이 push 된 순간, 약 120ms 뒤)
    //
    //   ① 정상 흐름에서도 serverTs 가 항상 조금 더 최신이라 매 로드마다 server 가 이긴다.
    //      (내용이 같으니 평소엔 티가 안 남)
    //   ② 그리고 init 은 server 가 이기면 localTs := serverTs 로 맞춘다.
    //      → 브라우저 시계가 서버보다 조금이라도 느리면, 그 다음 로컬 변경이 찍는
    //        브라우저 시각이 방금 저장한 serverTs 보다 과거가 된다 = localTs 가 뒤로 감김.
    //      → 이후 로컬은 영원히 서버를 못 이긴다. push 가 한 번이라도 실패하면
    //        그 삭제는 되돌릴 방법이 없고, 지울 때마다 옛 항목이 계속 부활한다.
    //        (사장님이 반복 신고하신 "지웠는데 또 올라와" 의 정체)
    //
    //   해결: 로컬 시각을 절대 뒤로 가지 않게(단조 증가) 만든다. 로컬 변경은 언제나
    //   "마지막으로 알고 있는 상태보다 최신" 으로 기록되므로, 시계 오차와 무관하게
    //   사용자의 최신 조작이 이긴다. push 가 실패해도 다음 로드에서 로컬이 이겨 삭제가 유지된다.
    // ─────────────────────────────────────────────────────────────────────────
    function bumpLocalTs() {
        var next = Math.max(Date.now(), readLocalTs() + 1);
        writeLocalTs(new Date(next).toISOString());
        return next;
    }
    // server: {items, updatedAt} | null   local: Array
    // 반환: { items: Array, source: 'server'|'local', tsIso: string }
    function pickFreshState(server, localItems) {
        var serverTs = server && server.updatedAt ? Date.parse(server.updatedAt) : 0;
        var localTs = readLocalTs();
        var nowIso = new Date().toISOString();
        // 1. 서버 행이 아예 없으면 → local 채택
        if (!server || !Array.isArray(server.items)) {
            return { items: localItems || [], source: 'local', tsIso: localTs ? new Date(localTs).toISOString() : nowIso };
        }
        // 2026-07-19: [빈 서버가 절대 못 이기던 버그]
        //   예전엔 "서버가 비어있으면 무조건 local 채택" 이었다. 그래서 한 기기/탭에서 전체비우기를 해
        //   서버를 비워도, 옛 항목을 들고 있는 다른 기기·탭이 그걸 다시 살려서 재푸시했다.
        //   → "비어있음" 도 하나의 상태다. 서버가 더 최근에 비워졌으면 그 빈 상태를 따른다.
        if (server.items.length === 0) {
            if (serverTs && serverTs > localTs) {
                return { items: [], source: 'server', tsIso: server.updatedAt || nowIso };
            }
            return { items: localItems || [], source: 'local', tsIso: localTs ? new Date(localTs).toISOString() : nowIso };
        }
        // 2026-05-15: local 이 비어있어도 ts 가 server 보다 최신이면 "의도적 비움" 으로 간주.
        //   이전 버그 — 결제 끝낸 직후나 수동 전체비움 후에도 다음 페이지로드 시 server 의 옛 항목이 부활.
        //   이제는 localTs 가 더 신선하면 빈 상태를 보존하고, 다음 push 에서 server 도 비워짐.
        if ((!localItems || localItems.length === 0) && localTs > serverTs) {
            return { items: [], source: 'local', tsIso: new Date(localTs).toISOString() };
        }
        // 2. local 비어있으면 → server 채택 (ts 없거나 server 가 더 최신인 경우)
        if (!localItems || localItems.length === 0) {
            return { items: server.items, source: 'server', tsIso: server.updatedAt || nowIso };
        }
        // 3. 양쪽 다 있으면 timestamp 비교
        if (localTs > serverTs) {
            return { items: localItems, source: 'local', tsIso: new Date(localTs).toISOString() };
        }
        return { items: server.items, source: 'server', tsIso: server.updatedAt || nowIso };
    }

    // 2026-05-15: 30일 이상 묵은 항목 자동 정리.
    //   addedAt (패브릭) / uid (timestamp, 일반상품 simple_order) 둘 다 인식.
    //   user_id 키잉이라 옛 세션·옛 기기에서 추가된 항목이 영원히 살아있던 문제 보강.
    var STALE_AGE_MS = 30 * 24 * 3600 * 1000; // 30 days
    function isStaleCartItem(it) {
        if (!it || typeof it !== 'object') return false;
        var ts = 0;
        // 1) 명시적 addedAt (cotton-print fabric item)
        if (it.addedAt) ts = Date.parse(it.addedAt);
        // 2) simple_order item: uid 는 Date.now()
        if (!ts && typeof it.uid === 'number' && it.uid > 1e12) ts = it.uid;
        if (!ts && typeof it.uid === 'string' && /^\d{13}/.test(it.uid)) ts = parseInt(it.uid, 10);
        // 3) item-level updated_at
        if (!ts && it.updated_at) ts = Date.parse(it.updated_at);
        if (!ts) return false; // 타임스탬프 추적 불가 → 보존 (안전)
        return (Date.now() - ts) > STALE_AGE_MS;
    }

    // ── localStorage interceptor ─────────────────────────
    // 2026-05-12: 도메인 통합 — localStorage 가 곧 unified cart. setItem 발생 시
    // 통째로 _unified 갱신 후 서버 push. invalid 항목은 자동 제거.
    // 2026-05-14: 변경 발생 시 LOCAL_TS_KEY 도 갱신 → 다음 pull 에서 last-write-wins 비교.
    var __origLocalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
        if (key !== LOCAL_KEY) return __origLocalSet(key, value);
        var mine = [];
        try { mine = JSON.parse(value || '[]') || []; } catch (e) {}
        var before = mine.length;
        mine = mine.filter(isValidCartItem);
        if (mine.length !== before) {
            console.warn('[cart_sync] invalid 카트 항목 ' + (before - mine.length) + '개 자동 정리');
        }
        mine.forEach(tagItem);
        mine = dedupById(mine); // 2026-07-10: 중복 __cart_id 자동 정리 (누적된 이중항목 청소)
        // 2026-05-15: localStorage quota 초과 방어.
        //   가벽 등 큰 base64 thumb 가 쌓이면 5MB 한도 초과 → __origLocalSet 이 QuotaExceededError.
        //   기존엔 이 예외가 writeCart 의 빈 catch 로 조용히 삼켜져 항목이 "안 담기던" 버그.
        //   이제: (1) _unified 는 메모리상 먼저 갱신 → 서버 push 는 정상 (서버엔 저장됨)
        //         (2) 무거운 필드(thumb/imgDataUrl/fileData) 를 떼고 재시도 → localStorage 라도 보존
        //         (3) 그래도 실패하면 사용자에게 토스트 경고
        _unified = mine;
        bumpLocalTs();   // 2026-07-19: 단조 증가 — 시계 오차로 로컬 변경이 서버에 지는 것 방지
        // 2026-07-14: 항상 초대용량(>100KB) 인라인 문자열은 localStorage 저장 전에 제거 — 정상 저장도 비대해지지 않게.
        //   (팬시 스티커 등 대용량 SVG/base64. 서버 _unified 엔 원본 유지, 디자인/칼선은 Storage URL 로 보존.)
        //   썸네일(<100KB data URL)은 유지 → 카트 미리보기 정상.
        //   2026-07-14: 깊은(중첩 포함) 탐색 — 대용량 문자열이 객체/배열 안에 있어도 제거.
        function _deepStrip(obj, path, stripped) {
            if (typeof obj === 'string') {
                if (obj.length > 100000) { stripped.push((path || '?') + '(' + obj.length + ')'); return null; }
                return obj;
            }
            if (Array.isArray(obj)) return obj.map(function (v, i) { return _deepStrip(v, path + '[' + i + ']', stripped); });
            if (obj && typeof obj === 'object') {
                var copy = {};
                for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) copy[k] = _deepStrip(obj[k], (path ? path + '.' : '') + k, stripped); }
                return copy;
            }
            return obj;
        }
        function _forLocal(arr) {
            var stripped = [];
            var out = _deepStrip(arr || [], '', stripped);
            return { arr: out, stripped: stripped, hit: stripped.length > 0 };
        }
        var _lg = _forLocal(mine);
        if (_lg.hit) console.warn('[cart_sync] 초대용량 인라인 문자열 제거 후 localStorage 저장 (서버엔 원본 보존). 제거:', _lg.stripped.join(', '));
        var _saved = false;
        try {
            __origLocalSet(key, JSON.stringify(_lg.arr));
            _saved = true;
        } catch (e1) {
            // 1차 실패 — 8KB 초과 문자열까지 전부(중첩 포함) 제거 후 재시도 (썸네일 포함, 최후수단).
            //   디자인/칼선은 Storage URL 로 보존됨 → 카트 미리보기 썸네일만 사라짐(기능 정상).
            try {
                var _stripped2 = [];
                function _deepStrip2(obj, path) {
                    if (typeof obj === 'string') {
                        if (obj.length > 8000) { _stripped2.push((path || '?') + '(' + obj.length + ')'); return null; }
                        return obj;
                    }
                    if (Array.isArray(obj)) return obj.map(function (v, i) { return _deepStrip2(v, path + '[' + i + ']'); });
                    if (obj && typeof obj === 'object') {
                        var copy = {};
                        for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) copy[k] = _deepStrip2(obj[k], (path ? path + '.' : '') + k); }
                        return copy;
                    }
                    return obj;
                }
                var slim = _deepStrip2(mine, '');
                __origLocalSet(key, JSON.stringify(slim));
                _saved = true;
                console.warn('[cart_sync] localStorage quota — 8KB+ 문자열 전부 제거 후 저장 (서버엔 원본 보존). 제거:', _stripped2.join(', '));
            } catch (e2) {
                console.error('[cart_sync] localStorage 저장 실패 (quota 초과). 서버 동기화는 계속 시도됨.', e2);
                try {
                    if (typeof window.showToast === 'function') {
                        window.showToast('카트 용량이 가득 찼습니다. 일부 항목 삭제 후 다시 시도해주세요.', 'error');
                    }
                } catch (e3) {}
            }
        }
        // 저장 성공/실패와 무관하게 서버 push 는 진행 (서버가 진실의 원천)
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
        }).then(function (serverState) {
            // serverState: { items, updatedAt } | null (옛 pull 시그니처와 호환)
            if (Array.isArray(serverState)) serverState = { items: serverState, updatedAt: null };
            var local = readLocal();
            // 2026-05-12: invalid 항목 자동 정리 (서버/로컬 양쪽)
            // 2026-05-15: + 30일 이상 묵은 stale 항목 자동 정리 — phantom 카트 항목 누적 방지
            if (serverState && Array.isArray(serverState.items)) {
                var sb1 = serverState.items.length;
                serverState.items = serverState.items
                    .filter(isValidCartItem)
                    .filter(function(it) { return !isStaleCartItem(it); });
                if (serverState.items.length !== sb1) console.warn('[cart_sync] server 항목 ' + (sb1 - serverState.items.length) + '개 정리 (invalid 또는 30일+)');
            }
            var lb1 = local.length;
            local = local
                .filter(isValidCartItem)
                .filter(function(it) { return !isStaleCartItem(it); });
            if (local.length !== lb1) console.warn('[cart_sync] local 항목 ' + (lb1 - local.length) + '개 정리 (invalid 또는 30일+)');
            local.forEach(tagItem);
            // 2026-05-14: last-write-wins by timestamp — 옛 merge-by-id 는 삭제가 부활하던 버그.
            var picked = pickFreshState(serverState, local);
            // 2026-07-10: 로드 직후 중복 __cart_id 정리 — 그동안 누적된 이중 항목(키링 등) 청소.
            var _preDedup = (picked.items || []).length;
            _unified = dedupById(picked.items);
            var _dupCleaned = _preDedup - _unified.length;
            if (_dupCleaned > 0) console.warn('[cart_sync] init — 중복 항목 ' + _dupCleaned + '개 정리');
            console.log('[cart_sync] init —', picked.source, '/', _unified.length, 'items @', picked.tsIso);
            // 로컬에 timestamp 가 없거나 server 가 더 최신이면 ts 동기화
            writeLocalTs(picked.tsIso);
            rebuildLocalFromUnified();
            // local 이 더 최신이거나 중복을 정리했으면 즉시 push (서버의 중복도 청소), 아니면 anon orphan 정리만
            var _needPush = picked.source === 'local' || _dupCleaned > 0;
            if (_userId) {
                cleanupAnonRow().then(function () {
                    if (_needPush) schedulePush();
                });
            } else if (_needPush) {
                schedulePush();
            }
            // 5) Patch outbound sibling links
            patchLinksOnce();
            var obs = new MutationObserver(patchLinksOnce);
            try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
            // 6) Re-sync when auth state changes (login/logout)
            // 2026-06-02: 사용자 전환 시 (다른 계정 로그인 / 로그아웃) 이전 사용자의 localStorage 카트가
            //   pickFreshState 의 localTs 우위로 새 사용자 카트를 덮어쓰는 버그 수정 → 그냥 서버 카트로 강제 교체.
            try {
                var c = sb();
                if (c && c.auth && typeof c.auth.onAuthStateChange === 'function') {
                    c.auth.onAuthStateChange(function (_event, session) {
                        var newUid = session && session.user ? session.user.id : null;
                        if (newUid !== _userId) {
                            var prevUid = _userId;
                            _userId = newUid;
                            // 이전 사용자 카트를 메모리·로컬에서 비움 (사용자 전환 시 절대 이전 카트가 따라오면 안 됨)
                            _unified = [];
                            bumpLocalTs();
                            rebuildLocalFromUnified();
                            // 새 사용자 server 카트 pull (또는 로그아웃이면 빈 상태 유지)
                            (newUid ? cleanupAnonRow() : Promise.resolve())
                                .then(function () { return newUid ? pull() : Promise.resolve(null); })
                                .then(function (serverState) {
                                    if (!serverState) {
                                        // 로그인했지만 server 카트도 비어있음 → 그대로 빈 상태 유지
                                        return;
                                    }
                                    if (Array.isArray(serverState)) serverState = { items: serverState, updatedAt: null };
                                    var items = (serverState && Array.isArray(serverState.items)) ? serverState.items : [];
                                    _unified = items;
                                    writeLocalTs(serverState.updatedAt || new Date().toISOString());
                                    rebuildLocalFromUnified();
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

    // 2026-05-15: 카트 전체 비우기 — 한 함수로 모든 항목 제거 + 서버 동기화
    //   부분 비움 (소스별 정리) 가 누적시키는 phantom 항목 문제 해결.
    function clearAllCart() {
        _unified = [];
        bumpLocalTs();   // 2026-07-19: 전체 비우기도 단조 증가 — 비운 상태가 서버에 지지 않게
        writeLocalRaw([]);
        // 서버 즉시 push (350ms 디바운스 우회)
        if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
        push([]);
        return Promise.resolve();
    }
    window._clearAllCart = clearAllCart;

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
            if (IS_COTTON_HOST) {
                // 레거시 cotton-print.com: cp_cart_v1 은 fabric 만 담김 → 서버의 타 source(메인) 항목 보존 필요.
                var others = _unified.filter(function (it) {
                    return it && it.__source && it.__source !== SOURCE;
                });
                _unified = dedupById(others.concat(local));
            } else {
                // 2026-07-10 FIX: 통합 cafe 도메인은 chameleon_cart_current 가 이미 모든 source 통합.
                //   기존 others.concat(local) 은 타 source(키링 등)를 이중 등록 → 카트에 같은 상품 중복.
                //   local 자체가 완전한 통합 카트이므로 그대로 사용.
                _unified = dedupById(local);
            }
            return push(_unified.slice());
        },
        clearAll: clearAllCart,
        linkToSibling: function (url) { return attachSid(url); },
        renderBanner: renderCrossDomainBanner,
        _debug: function () { return { sid: SID, unified: _unified, source: SOURCE, key: LOCAL_KEY }; }
    };

})();
