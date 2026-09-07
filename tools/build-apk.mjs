/**
 * Construit l'APK de bout en bout, dans le bon ordre.
 *
 *   node tools/build-apk.mjs [debug|release]
 *
 * L'ordre compte : le service worker embarque l'empreinte du contenu de app/,
 * et les assets de l'APK sont une copie de app/. Synchroniser avant de
 * régénérer le service worker figerait une version périmée dans l'APK.
 */
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const variante = (process.argv[2] ?? 'release').toLowerCase();

if (!['debug', 'release'].includes(variante)) {
  process.stderr.write(`Variante inconnue : ${variante}. Attendu « debug » ou « release ».\n`);
  process.exit(1);
}

async function etape(titre, commande, args, options = {}) {
  process.stderr.write(`\n▸ ${titre}\n`);
  const { stderr } = await run(commande, args, { cwd: ROOT, maxBuffer: 32 * 1024 * 1024, ...options });
  const lignes = stderr.split('\n').filter((ligne) =>
    ligne.trim() && !ligne.startsWith('Picked up JAVA_TOOL_OPTIONS'));
  for (const ligne of lignes.slice(-6)) process.stderr.write(`${ligne}\n`);
}

await etape('Service worker', 'node', ['tools/build-sw.mjs']);
await etape('Copie de l’application dans les assets', 'node', ['tools/sync-android.mjs']);
await etape('Cohérence du dépôt', 'node', ['tools/verifier.mjs']);

const tache = variante === 'debug' ? ':app:assembleDebug' : ':app:assembleRelease';
await etape(`Construction ${variante}`, 'gradle', ['--no-daemon', tache], {
  cwd: join(ROOT, 'android'),
  env: { ...process.env, ANDROID_HOME: process.env.ANDROID_HOME ?? '/opt/android-sdk' },
});

const nom = variante === 'debug' ? 'app-debug.apk' : 'app-release.apk';
const chemin = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', variante, nom);
const info = await stat(chemin);
process.stderr.write(
  `\n✓ ${chemin.replace(`${ROOT}/`, '')} — ${(info.size / 1024 / 1024).toFixed(2)} Mo\n`,
);
