/**
 * Ouverture d'un navigateur pour les outils de génération et les tests
 * d'interface. Le binaire fourni par l'environnement est privilégié quand la
 * version téléchargée par Playwright n'est pas disponible.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const CANDIDATE_ROOTS = ['/opt/pw-browsers', process.env.PLAYWRIGHT_BROWSERS_PATH]
  .filter(Boolean);

/** Cherche un exécutable Chromium déjà présent sur la machine. */
function findChromium() {
  for (const root of CANDIDATE_ROOTS) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith('chromium')) continue;
      for (const relative of [
        'chrome-linux/chrome',
        'chrome-linux/headless_shell',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      ]) {
        const candidate = join(root, entry, relative);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

export async function launchBrowser(options = {}) {
  const executablePath = findChromium();
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...(options.args ?? [])],
  });
}
