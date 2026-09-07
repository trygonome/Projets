/**
 * Recopie l'application web dans les assets de l'APK, et aligne le numéro de
 * version de l'application Android sur celui du paquet.
 *
 *   node tools/sync-android.mjs
 *
 * `app/` reste l'unique source : la coquille Android n'en détient pas de
 * variante, seulement une copie régénérée avant chaque construction.
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'app');
const CIBLE = join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'celeste');

/** Le vérificateur du dépôt travaille sur app/ ; la copie n'a pas à le refaire. */
const EXCLUS = new Set(['.DS_Store']);

await rm(CIBLE, { recursive: true, force: true });
await mkdir(CIBLE, { recursive: true });
await cp(SOURCE, CIBLE, {
  recursive: true,
  filter: (chemin) => !EXCLUS.has(chemin.split(sep).pop()),
});

async function parcourir(repertoire) {
  const entrees = await readdir(repertoire, { withFileTypes: true });
  const fichiers = [];
  for (const entree of entrees) {
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) fichiers.push(...await parcourir(chemin));
    else fichiers.push(chemin);
  }
  return fichiers;
}

const fichiers = await parcourir(CIBLE);
let octets = 0;
for (const fichier of fichiers) octets += (await stat(fichier)).size;

/* ------------------------------------------------- version de l'application */

const paquet = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const gradle = join(ROOT, 'android', 'app', 'build.gradle');
let configuration = await readFile(gradle, 'utf8');

// Le code de version doit croître à chaque publication : on le dérive des
// trois nombres de la version sémantique, ce qui reste monotone et lisible.
const [majeur, mineur, correctif] = paquet.version.split('.').map(Number);
const code = majeur * 10000 + mineur * 100 + correctif;

configuration = configuration
  .replace(/versionCode \d+/, `versionCode ${code}`)
  .replace(/versionName '[^']*'/, `versionName '${paquet.version}'`);
await writeFile(gradle, configuration);

process.stderr.write(
  `  → ${relative(ROOT, CIBLE)} : ${fichiers.length} fichiers, `
  + `${(octets / 1024 / 1024).toFixed(2)} Mo\n`
  + `  → version ${paquet.version} (code ${code})\n`,
);
