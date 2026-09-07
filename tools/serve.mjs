/**
 * Serveur statique de développement pour le dossier `app/`.
 *
 *   npm start  →  http://localhost:8080
 *
 * L'application n'a besoin d'aucune compilation : ce serveur ne fait que
 * livrer les fichiers avec les bons types MIME.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const PORT = Number(process.env.PORT ?? 8080);

/**
 * Préfixe de montage facultatif. Dans l'APK, l'application est servie sous
 * « /assets/celeste/ » et non à la racine : pouvoir reproduire ce montage ici
 * permet de vérifier que tous ses chemins sont bien relatifs.
 *
 *   PREFIXE=/assets/celeste npm start
 */
const PREFIXE = (process.env.PREFIXE ?? '').replace(/\/$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let path = decodeURIComponent(url.pathname);
  if (PREFIXE) {
    if (!path.startsWith(`${PREFIXE}/`) && path !== PREFIXE) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Hors du préfixe servi');
      return;
    }
    path = path.slice(PREFIXE.length) || '/';
  }
  if (path.endsWith('/')) path += 'index.html';

  // Empêche toute remontée hors du dossier servi.
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end('Interdit');
    return;
  }

  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Introuvable');
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Céleste servi sur http://localhost:${PORT}${PREFIXE}/\n`);
});
