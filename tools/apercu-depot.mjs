/**
 * Compose l'illustration du README à partir de trois captures d'écran.
 *
 *   npm start                 # dans un autre terminal
 *   node tools/apercu-depot.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './navigateur.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:8080';

const VUES = [
  { route: 'aujourdhui', attente: 2500 },
  { route: 'systeme', attente: 4500 },
  { route: 'ciel', attente: 4000 },
];

const LARGEUR = 412;
const HAUTEUR = 820;
const MARGE = 26;

const browser = await launchBrowser();
const captures = [];

for (const vue of VUES) {
  const page = await browser.newPage({
    viewport: { width: LARGEUR, height: HAUTEUR },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  await page.goto(`${BASE}/index.html#/${vue.route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(vue.attente);
  captures.push((await page.screenshot()).toString('base64'));
  await page.close();
  process.stderr.write(`  · ${vue.route}\n`);
}

// La composition se fait dans le navigateur : c'est le seul endroit où l'on
// dispose d'un canevas sans ajouter de dépendance de traitement d'images.
const page = await browser.newPage();
const dataUrl = await page.evaluate(async ({ images, largeur, hauteur, marge }) => {
  const chargees = await Promise.all(images.map((base64) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = `data:image/png;base64,${base64}`;
  })));

  const canvas = document.createElement('canvas');
  canvas.width = largeur * images.length + marge * (images.length + 1);
  canvas.height = hauteur + marge * 2;
  const context = canvas.getContext('2d');

  const fond = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  fond.addColorStop(0, '#0a0f1d');
  fond.addColorStop(0.5, '#141a30');
  fond.addColorStop(1, '#0a0f1d');
  context.fillStyle = fond;
  context.fillRect(0, 0, canvas.width, canvas.height);

  chargees.forEach((image, index) => {
    const x = marge + index * (largeur + marge);
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.55)';
    context.shadowBlur = 24;
    context.shadowOffsetY = 8;
    context.beginPath();
    context.roundRect(x, marge, largeur, hauteur, 22);
    context.fillStyle = '#05070e';
    context.fill();
    context.restore();

    context.save();
    context.beginPath();
    context.roundRect(x, marge, largeur, hauteur, 22);
    context.clip();
    context.drawImage(image, x, marge, largeur, hauteur);
    context.restore();
  });

  return canvas.toDataURL('image/png');
}, { images: captures, largeur: LARGEUR, hauteur: HAUTEUR, marge: MARGE });

await mkdir(join(ROOT, 'docs'), { recursive: true });
const sortie = join(ROOT, 'docs', 'apercu.png');
await writeFile(sortie, Buffer.from(dataUrl.split(',')[1], 'base64'));
process.stderr.write(`  → docs/apercu.png\n`);

await browser.close();
