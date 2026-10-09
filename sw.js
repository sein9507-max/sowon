/* 소원저장소 서비스 워커 — 앱 껍데기만 캐시한다. GitHub·Claude API 요청은 건드리지 않는다. */
const CACHE = 'sowon-v1.5.2';
const LOGOS = ['A', 'B', 'C', 'D'];
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'script.js', 'blog.js', 'trend.js', 'vendor/anthropic-sdk.mjs', 'vendor/standardwebhooks.mjs', 'vendor/stablelib-base64.mjs', 'vendor/fast-sha256.mjs', 'fonts/Galmuri11.woff2', 'fonts/Galmuri11-Bold.woff2',
  ...LOGOS.flatMap((k) => [`manifest-${k}.webmanifest`, `icons/${k}/icon-192.png`, `icons/${k}/apple-touch-icon.png`])];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isStatic = /\.(woff2|png)$/.test(url.pathname);   // 아이콘 그림을 바꾸면 CACHE 이름도 올린다
  if (isStatic) {            // 글꼴·아이콘: 캐시 먼저
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return res; })));
    return;
  }
  // 화면·코드: 인터넷 먼저(새 버전이 바로 보이게), 안 되면 캐시
  e.respondWith(fetch(e.request).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
