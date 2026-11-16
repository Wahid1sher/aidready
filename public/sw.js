// AidReady service worker: keeps the app shell (and its fonts) cached so the app opens with no signal.
const CACHE = 'aidready-v1';
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/icon.svg', '/manifest.webmanifest'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Never cache API traffic (Firebase, Gemini); only our own files and the font files.
  if (req.method !== 'GET' || (url.origin !== self.location.origin && !FONTS.includes(url.origin))) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});
