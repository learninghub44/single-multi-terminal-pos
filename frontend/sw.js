// Service Worker - App Shell Caching
//
// This only caches the static UI (HTML/CSS/JS). It never caches /api/*
// responses - product data, sales, everything from the API goes through
// IndexedDB via offline.js instead, so there's one clear place that decides
// what's "current" data versus what's just a queued offline write.
const CACHE_NAME = 'pos-shell-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/design-system.css',
  '/css/layout.css',
  '/css/dashboard.css',
  '/css/pos.css',
  '/css/receipt.css',
  '/js/config.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/utils.js',
  '/js/offline.js',
  '/js/components/modal.js',
  '/js/components/toast.js',
  '/js/pages/dashboard.js',
  '/js/pages/pos.js',
  '/js/pages/products.js',
  '/js/pages/inventory.js',
  '/js/pages/sales.js',
  '/js/pages/customers.js',
  '/js/pages/expenses.js',
  '/js/pages/reports.js',
  '/js/pages/users.js',
  '/js/pages/terminals.js',
  '/js/pages/settings.js',
  '/js/pages/setup.js',
  '/js/pages/accept-invite.js',
  '/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls - let the app's own online/offline handling
  // (offline.js) decide what to do when those fail.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // Network-first for the app shell: a device that's online always gets
    // the latest HTML/CSS/JS (so a redesign like this one shows up on the
    // very next load instead of waiting on a cache-version bump). Only
    // when the network is unavailable do we fall back to whatever shell
    // was last cached, so offline use still works.
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});
