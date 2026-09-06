/**
 * Capture d'écran d'une vue, au format d'un téléphone Android.
 *
 *   node tools/apercu.mjs [route] [fichier.png] [hauteur]
 *
 * Les erreurs de console sont rapportées : c'est le moyen le plus direct de
 * vérifier qu'une vue se construit sans faute.
 */
import { launchBrowser } from './navigateur.mjs';

const route = process.argv[2] ?? 'aujourdhui';
const output = process.argv[3] ?? 'apercu.png';
const height = Number(process.argv[4] ?? 900);
const base = process.env.BASE ?? 'http://localhost:8080';

const browser = await launchBrowser();
const page = await browser.newPage({
  viewport: { width: 412, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: process.env.TZ_TEST ?? 'Europe/Paris',
});

const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));

await page.goto(`${base}/index.html#/${route}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(process.env.ATTENTE ?? 1800));

// DEFILEMENT permet de cadrer une section précise d'une vue longue.
if (process.env.DEFILEMENT) {
  await page.evaluate((y) => {
    (document.getElementById('vue') ?? document.scrollingElement).scrollTop = y;
    window.scrollTo(0, y);
  }, Number(process.env.DEFILEMENT));
  await page.waitForTimeout(400);
}
await page.screenshot({ path: output, fullPage: process.env.PLEINE_PAGE === '1' });

await browser.close();

if (problems.length) {
  process.stderr.write(`\n${problems.length} problème(s) :\n${problems.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stderr.write(`Aucune erreur — capture écrite dans ${output}\n`);
}
