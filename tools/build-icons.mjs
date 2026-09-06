/**
 * Produit les icônes PNG de l'application à partir de l'icône vectorielle.
 * Nécessite Playwright ; les PNG résultants sont commités, la génération
 * n'est donc à relancer que si le dessin change.
 *
 *   node tools/build-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './navigateur.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'app', 'icons');

/** Les icônes masquables doivent tenir dans le cercle sûr : 80 % du côté. */
const TARGETS = [
  { file: 'icone-192.png', size: 192, padding: 0 },
  { file: 'icone-512.png', size: 512, padding: 0 },
  { file: 'icone-maskable-512.png', size: 512, padding: 0.11 },
];

const source = await readFile(join(ICONS, 'icone.svg'), 'utf8');
const browser = await launchBrowser();

for (const target of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  const inset = Math.round(target.size * target.padding);
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>
      html,body{margin:0;width:${target.size}px;height:${target.size}px;background:#05070e}
      svg{position:absolute;inset:${inset}px;width:${target.size - inset * 2}px;height:${target.size - inset * 2}px}
    </style>${source}`);
  const buffer = await page.screenshot({ omitBackground: false });
  await writeFile(join(ICONS, target.file), buffer);
  process.stderr.write(`  → app/icons/${target.file} (${(buffer.length / 1024).toFixed(0)} Ko)\n`);
  await page.close();
}

await browser.close();
