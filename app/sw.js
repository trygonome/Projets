/**
 * Service worker de Céleste.
 *
 * Toute l'application est mise en cache à l'installation : une fois la
 * première visite faite, elle fonctionne sans aucune connexion. Les
 * ressources ne changeant qu'au déploiement, la stratégie est « cache
 * d'abord », avec une actualisation en arrière-plan.
 *
 * Fichier produit par tools/build-sw.mjs — ne pas modifier à la main.
 */
const VERSION = '959f01bd7483';
const CACHE = `celeste-${VERSION}`;

/** 45 fichiers, 1.94 Mo au total. */
const RESSOURCES = [
  "./",
  "data/constellations.json",
  "data/deepsky.json",
  "data/land.json",
  "data/stars.json",
  "icons/icone-192.png",
  "icons/icone-512.png",
  "icons/icone-maskable-512.png",
  "icons/icone.svg",
  "index.html",
  "js/core/boussole.js",
  "js/core/catalogue.js",
  "js/core/ephem.js",
  "js/core/events.js",
  "js/core/format.js",
  "js/core/geo.js",
  "js/core/state.js",
  "js/core/time.js",
  "js/data/bodies.js",
  "js/data/constellations-noms.js",
  "js/data/places.js",
  "js/data/savoir.js",
  "js/main.js",
  "js/ui/dom.js",
  "js/ui/graphiques.js",
  "js/ui/textures.js",
  "js/views/agenda.js",
  "js/views/aujourdhui.js",
  "js/views/ciel.js",
  "js/views/corps.js",
  "js/views/cycles-lune.js",
  "js/views/cycles-soleil.js",
  "js/views/cycles.js",
  "js/views/lieu.js",
  "js/views/menu.js",
  "js/views/reglages.js",
  "js/views/savoir.js",
  "js/views/systeme.js",
  "js/views/temps.js",
  "manifest.webmanifest",
  "styles/base.css",
  "styles/components.css",
  "styles/layout.css",
  "styles/vues.css",
  "vendor/astronomy.js",
  "vendor/three.module.min.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Les requêtes sont faites une à une : un échec isolé — un fichier
    // renommé, par exemple — ne doit pas faire échouer toute l'installation.
    await Promise.all(RESSOURCES.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (error) {
        console.warn('Ressource non mise en cache', url, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('celeste-') && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      // Rafraîchissement discret : la version suivante sera servie au
      // prochain lancement, sans jamais faire attendre l'utilisateur.
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) (await caches.open(CACHE)).put(request, fresh.clone());
        } catch {
          /* hors-ligne : le cache suffit */
        }
      })());
      return cached;
    }

    try {
      const response = await fetch(request);
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch (error) {
      // Navigation hors-ligne vers une adresse inconnue : on rend la coquille.
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'ignorer-attente') self.skipWaiting();
});
