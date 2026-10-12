// Oceanview service worker (R-18): offline shell.
// Strategy: cache-first for app shell (same-origin GET), network-only for
// everything else. The workspace files come from the File System Access API,
// never from the network — the SW does not touch them.
const CACHE = 'oceanview-v1';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/src/main.js',
  '/src/ui/desk.js',
  '/src/ui/item.js',
  '/src/ui/capture.js',
  '/src/ui/today.js',
  '/src/ui/search.js',
  '/src/ui/review.js',
  '/src/core/frontmatter.js',
  '/src/core/tasks.js',
  '/src/core/workspace.js',
  '/src/core/fsaccess.js',
  '/src/core/idb.js',
  '/src/core/memory-adapter.js',
  '/src/core/markdown.js',
  '/src/core/placement.js',
  '/src/core/activity.js',
  '/src/core/search.js',
  '/src/core/slides.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: url.pathname === '/' }).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).then((response) => {
        if (response.ok && url.pathname.startsWith('/src/') || url.pathname === '/styles.css' || url.pathname === '/index.html') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
