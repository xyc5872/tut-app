// tut-app Service Worker
// 实现离线缓存功能

const CACHE_NAME = 'tut-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安装 Service Worker - 缓存资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 缓存资源');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // 立即激活新的 Service Worker
        return self.skipWaiting();
      })
  );
});

// 激活 Service Worker - 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本缓存
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即控制所有页面
      return self.clients.claim();
    })
  );
});

// 拦截网络请求 - 离线时使用缓存
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果缓存中有，直接返回缓存
        if (response) {
          return response;
        }

        // 否则发起网络请求
        return fetch(event.request).then((response) => {
          // 检查是否是有效响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 克隆响应，因为响应只能使用一次
          const responseToCache = response.clone();

          // 将新资源缓存起来
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // 网络请求失败，返回离线页面或缓存
          console.log('[Service Worker] 网络请求失败，使用缓存');
        });
      })
  );
});
