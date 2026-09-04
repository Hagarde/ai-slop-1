const CACHE_NAME = 'countrydoku-cache-v38';

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './favicon.svg',
  './manifest.json',
  './js/main.js',
  './js/data.js',
  './js/criteria.js',
  './js/game.js',
  './js/network.js',
  './js/ui.js',
  './js/utils.js',
  './js/stats.js',
  './js/i18n.js',
  './js/elements.js',
  './data/countries.json'
];

// Installation : Mise en cache robuste + activation immédiate
self.addEventListener('install', event => {
  self.skipWaiting(); // Devient actif immédiatement sans attendre la fermeture des onglets

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url =>
          fetch(url, { cache: 'reload' })
            .then(res => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(err => console.warn('[SW] Pré-cache échoué pour:', url, err))
        )
      );
    })
  );
});

// Activation : Nettoyage immédiat de TOUS les anciens caches + prise de contrôle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Suppression de l’ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Nouveau Service Worker activé et en contrôle.');
      return self.clients.claim(); // Contrôle immédiat de tous les onglets ouverts
    })
  );
});

// Fetch : Network-First pour le code de l'application (toujours à jour en ligne)
self.addEventListener('fetch', event => {
  // Ignorer WebRTC, TURN et requêtes non-GET
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('metered.live') || url.includes('0.peerjs.com')) return;

  const isSameOrigin = event.request.url.startsWith(self.location.origin);

  if (isSameOrigin) {
    // Stratégie Network-First pour notre code : garantit la version la plus fraîche en ligne,
    // et repli instantané sur le cache si hors-ligne.
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Pour les ressources externes (polices, CDN PeerJS) : Cache-First
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        });
      })
    );
  }
});
