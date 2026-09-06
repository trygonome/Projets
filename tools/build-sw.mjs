/**
 * Génère le service worker et la liste des fichiers à mettre en cache.
 *
 * La version du cache est l'empreinte du contenu : une seule modification
 * suffit à la faire changer, et l'ancien cache est alors purgé.
 *
 *   node tools/build-sw.mjs
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');

/** Fichiers et dossiers exclus du cache hors-ligne. */
const EXCLUDED = new Set(['sw.js', '.DS_Store']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (EXCLUDED.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

export async function buildServiceWorker() {
  const files = (await walk(APP))
    .map((path) => relative(APP, path).split(sep).join('/'))
    .sort();

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(await readFile(join(APP, file)));
  }
  const version = hash.digest('hex').slice(0, 12);

  let total = 0;
  for (const file of files) total += (await stat(join(APP, file))).size;

  const content = `/**
 * Service worker de Céleste.
 *
 * Toute l'application est mise en cache à l'installation : une fois la
 * première visite faite, elle fonctionne sans aucune connexion. Les
 * ressources ne changeant qu'au déploiement, la stratégie est « cache
 * d'abord », avec une actualisation en arrière-plan.
 *
 * Fichier produit par tools/build-sw.mjs — ne pas modifier à la main.
 */
const VERSION = '${version}';
const CACHE = \`celeste-\${VERSION}\`;

/** ${files.length} fichiers, ${(total / 1024 / 1024).toFixed(2)} Mo au total. */
const RESSOURCES = ${JSON.stringify(['./', ...files], null, 2)};

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
`;

  return { content, version, files, bytes: total };
}

// Exécution directe : on écrit le fichier. Importé, le module se contente de
// fournir le contenu attendu, ce dont le vérificateur a besoin.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { content, version, files, bytes } = await buildServiceWorker();
  await writeFile(join(APP, 'sw.js'), content);
  process.stderr.write(
    `  → app/sw.js — version ${version}, ${files.length} fichiers, `
    + `${(bytes / 1024 / 1024).toFixed(2)} Mo\n`,
  );
}
