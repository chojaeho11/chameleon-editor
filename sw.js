// 2026-07-29: 최소 서비스워커 — PWA "앱 설치" 요건(fetch 핸들러 존재)만 충족.
//   ★ 캐시하지 않는다 (오프라인 캐시 없음 → 항상 최신). 기존 stale-cache 방지 정책 유지.
//   (이전 버전은 이미지/HTML 캐싱을 했으나 구버전 노출 문제로 폐기 → 무캐시 패스스루로 교체.)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    // 레거시(구버전 캐싱 SW) 캐시가 남아 있으면 전부 삭제 — 구버전 노출 방지.
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});
// 설치가능 판정용 fetch 핸들러. respondWith 하지 않으므로 브라우저 기본 네트워크로 처리(가로채지 않음 = 항상 최신).
self.addEventListener('fetch', function () { /* passthrough — no caching */ });
