/**
 * Vérifications d'intégrité du dépôt, destinées à l'intégration continue.
 *
 *   node tools/verifier.mjs
 *
 * Contrôle que le service worker commité correspond bien au contenu de `app/`,
 * que les jeux de données sont lisibles, et que chaque fichier référencé par
 * la page existe réellement.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServiceWorker } from './build-sw.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');

const problemes = [];
const signaler = (message) => problemes.push(message);

/* -------------------------------------------------- service worker à jour */

// La comparaison se fait sans écrire : le vérificateur ne doit rien modifier.
const commite = await readFile(join(APP, 'sw.js'), 'utf8');
const { content: attendu } = await buildServiceWorker();
if (commite !== attendu) {
  signaler('app/sw.js n’est pas à jour : lancez `npm run build:sw` et commitez le résultat.');
}

/* ------------------------------------------------------ données lisibles */

const DONNEES = ['stars.json', 'constellations.json', 'deepsky.json', 'land.json'];
for (const fichier of DONNEES) {
  try {
    JSON.parse(await readFile(join(APP, 'data', fichier), 'utf8'));
  } catch (error) {
    signaler(`app/data/${fichier} illisible : ${error.message}`);
  }
}

/* ------------------------------------------- références de la page valides */

async function lister(repertoire) {
  const entrees = await readdir(repertoire, { withFileTypes: true });
  const fichiers = [];
  for (const entree of entrees) {
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) fichiers.push(...await lister(chemin));
    else fichiers.push(relative(APP, chemin).split(sep).join('/'));
  }
  return fichiers;
}

const presents = new Set(await lister(APP));
const page = await readFile(join(APP, 'index.html'), 'utf8');
for (const attribut of page.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
  const cible = attribut[1].replace(/^\.\//, '');
  if (!presents.has(cible)) signaler(`index.html référence ${cible}, absent du dossier app/.`);
}

/* ------------------------------------- imports des modules effectivement là */

for (const fichier of presents) {
  if (!fichier.endsWith('.js') || fichier.startsWith('vendor/')) continue;
  const source = await readFile(join(APP, fichier), 'utf8');
  for (const importation of source.matchAll(/from\s+'([^']+)'|import\(\s*'([^']+)'/g)) {
    const specificateur = importation[1] ?? importation[2];
    if (!specificateur.startsWith('.')) continue;
    const base = dirname(join(APP, fichier));
    const resolu = relative(APP, join(base, specificateur)).split(sep).join('/');
    if (!presents.has(resolu)) signaler(`${fichier} importe ${specificateur}, introuvable.`);
  }
}

/* --------------------------------------------------------------- rapport */

if (problemes.length) {
  process.stderr.write(`${problemes.length} problème(s) :\n`);
  for (const probleme of problemes) process.stderr.write(`  · ${probleme}\n`);
  process.exitCode = 1;
} else {
  process.stderr.write(`Dépôt cohérent : ${presents.size} fichiers dans app/.\n`);
}
