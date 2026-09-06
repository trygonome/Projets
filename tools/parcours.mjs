/**
 * Parcours de bout en bout : visite chaque vue, ouvre chaque panneau, actionne
 * les principaux contrôles et signale la moindre erreur de console.
 *
 *   npm start                # dans un autre terminal
 *   node tools/parcours.mjs
 *
 * C'est le filet de sécurité de l'interface, là où les tests unitaires ne vont
 * pas : une vue qui ne se construit plus se voit immédiatement.
 */
import { launchBrowser } from './navigateur.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const problemes = [];
let etapes = 0;

const browser = await launchBrowser();
const page = await browser.newPage({
  viewport: { width: 412, height: 820 },
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
});

page.on('pageerror', (error) => problemes.push(`exception : ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problemes.push(`console : ${message.text()}`);
});

/** Exécute une étape et note son résultat. */
async function etape(nom, action) {
  const avant = problemes.length;
  try {
    await action();
    await page.waitForTimeout(400);
  } catch (error) {
    problemes.push(`${nom} : ${error.message}`);
  }
  etapes += 1;
  const nouvelles = problemes.length - avant;
  process.stderr.write(`  ${nouvelles ? '✗' : '·'} ${nom}\n`);
}

const aller = async (route, attente = 1200) => {
  await page.goto(`${BASE}/index.html#/${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(attente);
};

/* ------------------------------------------------------------- les vues */

for (const route of ['aujourdhui', 'cycles', 'cycles/soleil', 'agenda', 'corps', 'savoir', 'reglages']) {
  await etape(`vue ${route}`, () => aller(route, 2200));
}
await etape('vue ciel', () => aller('ciel', 3500));
await etape('vue systeme', () => aller('systeme', 4000));

/* ------------------------------------------------------------ les fiches */

for (const corps of ['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Moon', 'Pluto', 'Ceres', 'Eris', 'Haumea', 'Makemake']) {
  await etape(`fiche ${corps}`, () => aller(`corps/${corps}`, 900));
}

/* ---------------------------------------------------------- les articles */

await aller('savoir', 800);
const articles = await page.$$eval('.element-liste', (noeuds) => noeuds.length);
for (let i = 0; i < articles; i += 1) {
  await etape(`article ${i + 1}/${articles}`, async () => {
    await aller('savoir', 400);
    await page.locator('.element-liste').nth(i).click();
    await page.waitForTimeout(300);
  });
}

/* ----------------------------------------------------------- les panneaux */

await aller('aujourdhui', 1500);

await etape('panneau du lieu', async () => {
  await page.locator('#bouton-lieu').click();
  await page.waitForSelector('#panneau[data-ouvert="oui"]');
  await page.locator('#panneau input[type=search]').fill('tromso');
  await page.waitForTimeout(300);
  await page.locator('#panneau .element-liste').first().click();
  await page.waitForTimeout(1200);
});

await etape('lieu polaire pris en compte', async () => {
  const texte = await page.locator('.entete-lieu-nom').textContent();
  if (!texte.includes('Troms')) throw new Error(`lieu inattendu : ${texte}`);
});

await etape('retour à un lieu tempéré', async () => {
  await page.locator('#bouton-lieu').click();
  await page.waitForSelector('#panneau[data-ouvert="oui"]');
  await page.locator('#panneau input[type=search]').fill('paris');
  await page.waitForTimeout(300);
  await page.locator('#panneau .element-liste').first().click();
  await page.waitForTimeout(1200);
});

await etape('panneau du temps', async () => {
  await page.locator('#bouton-horloge').click();
  await page.waitForSelector('#panneau[data-ouvert="oui"]');
  await page.locator('#panneau input[type=date]').fill('2027-08-02');
  await page.locator('#panneau input[type=time]').fill('11:00');
  await page.getByRole('button', { name: 'Aller à cet instant' }).click();
  await page.waitForTimeout(1500);
});

await etape('date simulée signalée', async () => {
  const simule = await page.locator('#bouton-horloge').getAttribute('data-simule');
  if (simule !== 'oui') throw new Error('le bandeau ne signale pas le temps simulé');
});

await etape('retour au temps réel', async () => {
  await page.locator('#bouton-horloge').click();
  await page.waitForSelector('#panneau[data-ouvert="oui"]');
  await page.getByRole('button', { name: 'Maintenant' }).click();
  await page.locator('#panneau-fermer').click();
  await page.waitForTimeout(600);
});

await etape('menu et navigation vers les corps', async () => {
  await page.locator('#bouton-menu').click();
  await page.waitForSelector('#panneau[data-ouvert="oui"]');
  await page.getByRole('button', { name: /Corps du système solaire/ }).click();
  await page.waitForTimeout(1200);
  if (!page.url().includes('corps')) throw new Error('navigation sans effet');
});

/* ------------------------------------------------------- les interactions */

await etape('planétarium : cadrages et calques', async () => {
  await aller('ciel', 3500);
  for (const nom of ['Sud', 'Voûte']) {
    await page.getByRole('button', { name: nom, exact: true }).click();
    await page.waitForTimeout(500);
  }
  for (const nom of ['Grille', 'Ciel profond', 'Figures']) {
    await page.getByRole('button', { name: nom }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: nom }).click();
    await page.waitForTimeout(300);
  }
});

await etape('système : échelles et cadrages', async () => {
  await aller('systeme', 4000);
  for (const nom of ['Distances réelles', 'Tout à l’échelle', 'Compressée']) {
    await page.getByRole('button', { name: nom }).click();
    await page.waitForTimeout(900);
  }
  for (const nom of ['Système interne', 'Vue d’ensemble']) {
    await page.getByRole('button', { name: nom }).click();
    await page.waitForTimeout(900);
  }
});

await etape('agenda : portées et familles', async () => {
  await aller('agenda', 2500);
  await page.getByRole('tab', { name: '3 mois' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Rapprochements' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Nœuds lunaires' }).click();
  await page.waitForTimeout(2000);
});

await etape('réglages : vision nocturne', async () => {
  await aller('reglages', 1500);
  const bascule = page.locator('.bascule input').first();
  await bascule.click();
  await page.waitForTimeout(500);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (theme !== 'rouge') throw new Error(`thème ${theme}`);
  await bascule.click();
  await page.waitForTimeout(400);
});

/* --------------------------------------------------------------- rapport */

await browser.close();

process.stderr.write(`\n${etapes} étapes parcourues.\n`);
if (problemes.length) {
  process.stderr.write(`${problemes.length} problème(s) :\n`);
  for (const probleme of problemes) process.stderr.write(`  · ${probleme}\n`);
  process.exitCode = 1;
} else {
  process.stderr.write('Aucune erreur.\n');
}
