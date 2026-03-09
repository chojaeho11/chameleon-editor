// Chameleon Service Worker - HTML 캐시 강제 무효화 + 이미지 캐시
var CACHE_VERSION = '20260309a';
var IMG_CACHE = 'img-cache-v1';

self.addEventListener('install', function(e) {
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) { return n !== CACHE_VERSION && n !== IMG_CACHE; })
                    .map(function(n) { return caches.delete(n); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(e) {
    var url = new URL(e.request.url);

    // HTML 요청: 네트워크 우선
    if (e.request.mode === 'navigate' ||
        (e.request.method === 'GET' && e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') >= 0)) {
        e.respondWith(
            fetch(e.request, { cache: 'no-store' }).then(function(res) {
                return res;
            }).catch(function() {
                return caches.match(e.request);
            })
        );
        return;
    }

    // 이미지 요청: 캐시 우선 (외부 CDN 이미지 포함)
    if (e.request.method === 'GET' && e.request.destination === 'image') {
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                if (cached) return cached;
                return fetch(e.request).then(function(res) {
                    if (res && res.status === 200) {
                        var clone = res.clone();
                        caches.open(IMG_CACHE).then(function(cache) {
                            cache.put(e.request, clone);
                        });
                    }
                    return res;
                }).catch(function() {
                    return new Response('', { status: 404 });
                });
            })
        );
        return;
    }

    // 나머지 (JS, CSS 등)는 기본 동작 그대로
});
