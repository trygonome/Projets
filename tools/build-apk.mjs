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
import { readdir, stat } from 'node:fs/promises';
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

// Le nom du fichier dépend de la signature : « app-release.apk » quand une
// clé est configurée, « app-release-unsigned.apk » sinon. On lit donc le
// dossier de sortie plutôt que de deviner.
const sortie = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', variante);
const produits = (await readdir(sortie)).filter((nom) => nom.endsWith('.apk'));

if (!produits.length) {
  process.stderr.write(`\nAucun APK produit dans ${sortie.replace(`${ROOT}/`, '')}.\n`);
  process.exit(1);
}

for (const nom of produits) {
  const info = await stat(join(sortie, nom));
  process.stderr.write(
    `\n✓ ${join(sortie, nom).replace(`${ROOT}/`, '')} — `
    + `${(info.size / 1024 / 1024).toFixed(2)} Mo\n`,
  );
  if (nom.includes('unsigned')) {
    process.stderr.write(
      '  ⚠ APK non signé : il ne s’installera pas. Vérifiez android/keystore.properties.\n',
    );
    process.exit(1);
  }
}
