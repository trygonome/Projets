/**
 * Produit les icônes de l'APK à partir des icônes vectorielles de l'application.
 *
 *   node tools/build-android-icons.mjs
 *
 * Android attend deux jeux : les icônes héritées, carrées et rondes, pour les
 * versions antérieures à 8.0, et le premier plan des icônes adaptatives, dont
 * le système compose lui-même le fond et le masque.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './navigateur.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

/** Facteurs d'échelle des densités d'écran d'Android. */
const DENSITES = [
  ['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4],
];

const ICONE_DP = 48;   // taille nominale d'une icône de lanceur
const PREMIER_PLAN_DP = 108; // toile des icônes adaptatives

const complet = await readFile(join(ROOT, 'app', 'icons', 'icone.svg'), 'utf8');
// Variante sans fond : c'est une source de construction, pas une ressource
// de l'application web — elle n'a donc pas sa place dans app/.
const symbole = await readFile(join(ROOT, 'tools', 'icones', 'icone-symbole.svg'), 'utf8');

const browser = await launchBrowser();

/**
 * Rend un SVG dans un canevas carré. `masque` découpe un cercle, `fond` peint
 * une couleur sous le dessin ; sans fond, le PNG conserve sa transparence.
 */
async function rendre(source, taille, { masque = false, fond = null } = {}) {
  const page = await browser.newPage({
    viewport: { width: taille, height: taille },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>
      html, body { margin: 0; width: ${taille}px; height: ${taille}px; }
      body { background: ${fond ?? 'transparent'};
             ${masque ? `border-radius: 50%; overflow: hidden;` : ''} }
      svg { display: block; width: ${taille}px; height: ${taille}px; }
    </style>${source}`);
  const buffer = await page.screenshot({ omitBackground: !fond });
  await page.close();
  return buffer;
}

let ecrits = 0;

for (const [densite, facteur] of DENSITES) {
  const dossier = join(RES, `mipmap-${densite}`);
  await mkdir(dossier, { recursive: true });

  const taille = Math.round(ICONE_DP * facteur);
  await writeFile(join(dossier, 'ic_launcher.png'),
    await rendre(complet, taille, { fond: '#05070e' }));
  await writeFile(join(dossier, 'ic_launcher_round.png'),
    await rendre(complet, taille, { fond: '#05070e', masque: true }));

  // Le premier plan adaptatif reste transparent : le système lui applique son
  // propre fond, déclaré dans mipmap-anydpi-v26/ic_launcher.xml.
  const tailleAvant = Math.round(PREMIER_PLAN_DP * facteur);
  await writeFile(join(dossier, 'ic_launcher_foreground.png'),
    await rendre(symbole, tailleAvant));

  ecrits += 3;
  process.stderr.write(`  · mipmap-${densite} (${taille} px, premier plan ${tailleAvant} px)\n`);
}

await browser.close();
process.stderr.write(`  → ${ecrits} fichiers écrits sous android/…/res/\n`);
