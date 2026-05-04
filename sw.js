// sw.js

const CACHE_NAME = 'miproduccion-cache-v8';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/supabase.js',
  './manifest.json',
  'https://unpkg.com/dexie@4.0.4/dist/dexie.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests (POST, PATCH, DELETE = data mutations)
  if (event.request.method !== 'GET') return;
  // Skip Supabase API calls
  if (event.request.url.includes('supabase.co') || event.request.url.includes('supabase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache the fresh response
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
