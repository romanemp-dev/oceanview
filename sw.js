// Oceanview service worker (R-18): offline shell.
// Strategy: network-first for JS/CSS/HTML (so updates reach users without a
// manual SW bump), falling back to the cache when offline. The workspace
// files come from the File System Access API, never from the network — the
// SW does not touch them.
const CACHE = 'oceanview-v12';
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
  '/src/core/changes.js',
  '/src/visual/camera-rig.js',
  '/src/visual/scene.js',
  '/src/visual/mount.js',
  '/vendor/three/three.module.js',
  '/vendor/three/three.core.js',
  '/assets/panorama/bay-view.jpg',
  '/m-rig.html',
  '/vendor/three/examples/jsm/postprocessing/EffectComposer.js',
  '/vendor/three/examples/jsm/postprocessing/RenderPass.js',
  '/vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js',
  '/vendor/three/examples/jsm/postprocessing/ShaderPass.js',
  '/vendor/three/examples/jsm/postprocessing/MaskPass.js',
  '/vendor/three/examples/jsm/postprocessing/Pass.js',
  '/vendor/three/examples/jsm/postprocessing/OutputPass.js',
  '/vendor/three/examples/jsm/shaders/CopyShader.js',
  '/vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js',
  '/vendor/three/examples/jsm/shaders/OutputShader.js',
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
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: url.pathname === '/' })),
  );
});
