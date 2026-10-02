const CACHE_NAME = 'aftelklok-v2';
const SHELL_URLS = [
  '/',
  '/?source=pwa',
  '/manifest.webmanifest',
  '/favicon.png',
  '/logo-fysioharlingen.png?v=2',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cacheAppShell(cache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') {
    return;
  }

  if (request.mode === 'navigate' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(fromCacheThenNetwork(request));
});

async function cacheAppShell(cache) {
  const page = await fetch('/?source=pwa');
  if (!page.ok) {
    throw new Error('app shell unavailable');
  }

  await cache.put('/?source=pwa', page.clone());
  await cache.put('/', page.clone());

  const html = await page.text();
  const assets = new Set(SHELL_URLS.filter((url) => url !== '/' && url !== '/?source=pwa'));
  for (const match of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
    if (match[1] !== '/sw.js') {
      assets.add(match[1]);
    }
  }

  await cache.addAll([...assets]);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (request.mode === 'navigate') {
        await cache.put('/', response.clone());
        await cache.put('/?source=pwa', response.clone());
      }
      return response;
    }
  } catch {
    // The server is unreachable. The cached app is used below.
  }

  const cached =
    (await cache.match(request)) ||
    (await cache.match('/?source=pwa')) ||
    (await cache.match('/'));
  return cached || Response.error();
}

async function fromCacheThenNetwork(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    void refreshCache(cache, request);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function refreshCache(cache, request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
  } catch {
    // Keep the cached file while the server is down.
  }
}
