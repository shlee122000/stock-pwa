const CACHE_NAME = 'stock-pwa-v2';
const urlsToCache = [
  '/',
  '/css/styles.css',
  '/js/app.js',
  '/manifest.json'
];

// 설치
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('캐시 열림');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 요청 처리
self.addEventListener('fetch', function(event) {
  // API 요청은 캐시하지 않고 바로 네트워크로
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // 정적 파일만 캐시 사용
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// 업데이트
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName !== CACHE_NAME;
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});