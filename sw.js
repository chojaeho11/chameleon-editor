// Chameleon Service Worker - HTML 캐시 강제 무효화 전용
// JS/CSS/이미지 등은 건드리지 않고, HTML 요청만 네트워크 우선 처리
var CACHE_VERSION = '20260304h';

self.addEventListener('install', function(e) {
    self.skipWaiting(); // 즉시 활성화
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) { return n !== CACHE_VERSION; })
                    .map(function(n) { return caches.delete(n); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(e) {
    var url = new URL(e.request.url);

    // HTML 요청만 가로채기 (navigate 또는 text/html accept)
    if (e.request.mode === 'navigate' ||
        (e.request.method === 'GET' && e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') >= 0)) {

        // 네트워크 우선 → 실패시 캐시
        e.respondWith(
            fetch(e.request, { cache: 'no-store' }).then(function(res) {
                return res;
            }).catch(function() {
                return caches.match(e.request);
            })
        );
        return;
    }

    // 나머지 (JS, CSS, 이미지 등)는 기본 동작 그대로
});
