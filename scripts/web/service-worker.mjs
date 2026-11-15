import { storageImages } from "../../src/constants/playImageManifest.ts";

function workerProgram(VERSION, PRECACHE, STORAGE) {
  const SHELL = VERSION + '-shell';
  const MEDIA = VERSION + '-media';
  const MEDIA_LIMIT = 80;
  let mediaWrites = Promise.resolve();
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
  async function fallback() {
    return await (await caches.open(SHELL)).match('/nori-icon.svg') || Response.error();
  }
  async function storeResponse(cache, request, response, media) {
    const write = async () => {
      await cache.put(request, response);
      if (media) {
        const keys = await cache.keys();
        for (const key of keys.slice(0, Math.max(0, keys.length - MEDIA_LIMIT))) await cache.delete(key);
      }
    };
    if (!media) return write();
    // Bound the shared local+Storage cache even during parallel image loads.
    mediaWrites = mediaWrites.catch(() => {}).then(write);
    return mediaWrites;
  }
  async function asset(request, media, remote = false) {
    const cache = await caches.open(media ? MEDIA : SHELL);
    const cached = await cache.match(request) || (media && !remote ? await (await caches.open(SHELL)).match(request) : null);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      const readable = !['opaque', 'opaqueredirect', 'error'].includes(response.type);
      const allowed = response.ok && readable && (!remote || (response.type === 'cors' && !response.redirected &&
        /^image\//i.test(response.headers.get('content-type') || '')));
      if (allowed) {
        try { await storeResponse(cache, request, response.clone(), media); } catch { /* Cache quota does not hide a loaded image. */ }
      }
      return remote && !allowed ? fallback() : response;
    } catch { return remote ? fallback() : Response.error(); }
  }
  self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET') return;
    const prefix = STORAGE && '/storage/v1/object/public/' + STORAGE.bucket + '/';
    const storage = STORAGE && url.origin === STORAGE.origin && !url.search && !url.hash && url.pathname.startsWith(prefix) &&
      /^play_\d{3,}\/[a-f0-9]{64}\/(detail|thumbnail)\.webp$/.test(url.pathname.slice(prefix.length)) &&
      request.destination === 'image' && request.mode === 'cors' && request.credentials !== 'include';
    if (storage) { event.respondWith(asset(request, true, true)); return; }
    if (STORAGE && url.origin === STORAGE.origin && url.pathname.startsWith('/storage/')) return;
    if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;
    if (request.mode === 'navigate') { event.respondWith(navigation(request)); return; }
    const media = request.destination === 'image' || url.pathname.startsWith('/media/');
    if (media || ['script', 'style', 'font'].includes(request.destination) || url.pathname === '/manifest.webmanifest') {
      event.respondWith(asset(request, media));
    }
  });
}

export function createServiceWorker(version, precache, storage = null) {
  const allowed = storageImages(storage);
  const shell = [...new Set([...precache, ...(allowed ? ['/nori-icon.svg'] : [])])];
  return `(${workerProgram.toString()})(${JSON.stringify(`nori-web-${version}`)}, ${JSON.stringify(shell)}, ${JSON.stringify(allowed)});\n`;
}
