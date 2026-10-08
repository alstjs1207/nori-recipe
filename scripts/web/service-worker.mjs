export function createServiceWorker(version, precache) {
  return `const VERSION = ${JSON.stringify(`nori-web-${version}`)};
const SHELL = VERSION + '-shell';
const MEDIA = VERSION + '-media';
const PRECACHE = ${JSON.stringify(precache)};
const MEDIA_LIMIT = 80;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(
    PRECACHE.map(path => new Request(new URL(path, self.location.origin), { cache: 'reload' }))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('nori-web-') && key !== SHELL && key !== MEDIA) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function navigation(request) {
  const cache = await caches.open(SHELL);
  const key = new URL(request.url).pathname;
  try {
    const response = await fetch(request);
    if (response.status >= 500) throw new Error('server unavailable');
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch {
    return await cache.match(key) || await cache.match('/index.html') || await cache.match('/offline.html') || Response.error();
  }
}
async function asset(request, media) {
  const cache = await caches.open(media ? MEDIA : SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (media) {
        const keys = await cache.keys();
        for (const key of keys.slice(0, Math.max(0, keys.length - MEDIA_LIMIT))) await cache.delete(key);
      }
    }
    return response;
  } catch { return Response.error(); }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (request.mode === 'navigate') { event.respondWith(navigation(request)); return; }
  const media = request.destination === 'image' || url.pathname.startsWith('/media/');
  if (media || ['script', 'style', 'font'].includes(request.destination) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(asset(request, media));
  }
});
`;
}
