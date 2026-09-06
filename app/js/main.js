/**
 * Coquille de l'application : en-tête, routage, barre d'onglets, panneaux.
 *
 * Les vues sont chargées à la demande : la vue tridimensionnelle et sa
 * bibliothèque de rendu ne sont téléchargées que si l'on s'y rend.
 */
import { el, clear, button } from './ui/dom.js';
import {
  now, observer, timeZone, subscribe, isLive, timeRate, display,
  resumeLive, setTimeRate, setTime, shiftTime,
} from './core/state.js';
import { formatTime, formatDate, timeZoneLabel, formatLatitude, formatLongitude } from './core/format.js';
import { openPlacePanel } from './views/lieu.js';
import { openTimePanel } from './views/temps.js';
import { openMenuPanel } from './views/menu.js';

/* ---------------------------------------------------------------- routes */

const ROUTES = [
  { id: 'aujourdhui', title: 'Aujourd’hui', glyph: '☀', nav: true, load: () => import('./views/aujourdhui.js') },
  { id: 'ciel', title: 'Ciel', glyph: '✦', nav: true, full: true, load: () => import('./views/ciel.js') },
  { id: 'systeme', title: 'Système', glyph: '◍', nav: true, full: true, load: () => import('./views/systeme.js') },
  { id: 'cycles', title: 'Cycles', glyph: '☾', nav: true, load: () => import('./views/cycles.js') },
  { id: 'agenda', title: 'Agenda', glyph: '❉', nav: true, load: () => import('./views/agenda.js') },
  { id: 'corps', title: 'Corps du système solaire', glyph: '🪐', load: () => import('./views/corps.js') },
  { id: 'savoir', title: 'Savoir', glyph: '📖', load: () => import('./views/savoir.js') },
  { id: 'reglages', title: 'Réglages', glyph: '⚙', load: () => import('./views/reglages.js') },
];

const routeById = (id) => ROUTES.find((route) => route.id === id);

/** Décompose « #/corps/mars » en { id, params }. */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [id, ...params] = raw.split('/').filter(Boolean);
  return { id: routeById(id) ? id : 'aujourdhui', params };
}

export function navigate(path) {
  const target = path.startsWith('#') ? path : `#/${path}`;
  if (location.hash === target) applyRoute();
  else location.hash = target;
}

/* ------------------------------------------------------------- éléments */

const dom = {
  view: document.getElementById('vue'),
  nav: document.getElementById('navigation'),
  placeButton: document.getElementById('bouton-lieu'),
  clockButton: document.getElementById('bouton-horloge'),
  menuButton: document.getElementById('bouton-menu'),
  timeBar: document.getElementById('barre-temps'),
  panel: document.getElementById('panneau'),
  panelTitle: document.getElementById('panneau-titre'),
  panelBody: document.getElementById('panneau-corps'),
  panelBackdrop: document.getElementById('panneau-fond'),
  panelClose: document.getElementById('panneau-fermer'),
};

/* --------------------------------------------------------------- panneau */

let closePanelHandler = null;

/** Ouvre le panneau modal glissant avec un contenu construit à la volée. */
export function openPanel(title, build, { onClose } = {}) {
  dom.panelTitle.textContent = title;
  clear(dom.panelBody);
  dom.panelBody.appendChild(build({ close: closePanel }));
  dom.panel.hidden = false;
  dom.panelBackdrop.hidden = false;
  closePanelHandler = onClose ?? null;
  requestAnimationFrame(() => {
    dom.panel.dataset.ouvert = 'oui';
    dom.panelBackdrop.dataset.ouvert = 'oui';
  });
}

export function closePanel() {
  dom.panel.dataset.ouvert = 'non';
  dom.panelBackdrop.dataset.ouvert = 'non';
  setTimeout(() => {
    dom.panel.hidden = true;
    dom.panelBackdrop.hidden = true;
    clear(dom.panelBody);
  }, 240);
  closePanelHandler?.();
  closePanelHandler = null;
}

dom.panelClose.addEventListener('click', closePanel);
dom.panelBackdrop.addEventListener('click', closePanel);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dom.panel.hidden) closePanel();
});

/* -------------------------------------------------------- barre de temps */

const TIME_RATES = [
  { rate: -86400, label: '−1 j/s' },
  { rate: -3600, label: '−1 h/s' },
  { rate: 0, label: 'figé' },
  { rate: 1, label: 'temps réel' },
  { rate: 3600, label: '1 h/s' },
  { rate: 86400, label: '1 j/s' },
  { rate: 2592000, label: '1 mois/s' },
];

let timeBarVisible = false;

function buildTimeBar() {
  clear(dom.timeBar);
  const index = TIME_RATES.findIndex((entry) => entry.rate === timeRate());
  const label = el('span', { class: 'barre-temps-vitesse' },
    isLive() ? 'temps réel' : (TIME_RATES[index]?.label ?? `× ${timeRate()}`));

  dom.timeBar.append(
    button('⏮', () => shiftTime(-1), { variant: 'discret', title: 'Un jour plus tôt' }),
    button('◀◀', () => stepRate(-1), { variant: 'discret', title: 'Ralentir' }),
    label,
    button('▶▶', () => stepRate(+1), { variant: 'discret', title: 'Accélérer' }),
    button('⏭', () => shiftTime(1), { variant: 'discret', title: 'Un jour plus tard' }),
    button('⟲', () => resumeLive(), { variant: 'accent', title: 'Revenir à maintenant' }),
  );
}

function stepRate(direction) {
  const current = isLive() ? 3 : TIME_RATES.findIndex((entry) => entry.rate === timeRate());
  const next = Math.max(0, Math.min(TIME_RATES.length - 1,
    (current === -1 ? 3 : current) + direction));
  const entry = TIME_RATES[next];
  if (entry.rate === 1) resumeLive();
  else setTimeRate(entry.rate);
}

export function setTimeBarVisible(visible) {
  timeBarVisible = visible;
  dom.timeBar.dataset.ouverte = visible ? 'oui' : 'non';
  // Les vues immersives placent leurs panneaux au-dessus de la barre de temps :
  // l'état est porté par le document pour que la mise en page en tienne compte.
  document.body.dataset.barreTemps = visible ? 'oui' : 'non';
  if (visible) buildTimeBar();
}

/* --------------------------------------------------------------- en-tête */

function renderHeader() {
  const date = now();
  const zone = timeZone();
  const place = observer();

  dom.placeButton.querySelector('.entete-lieu-nom').textContent = place.label;
  dom.placeButton.querySelector('.entete-lieu-detail').textContent =
    `${formatLatitude(place.latitude)} · ${formatLongitude(place.longitude)}`;

  dom.clockButton.querySelector('.entete-heure').textContent =
    formatTime(date, zone, { seconds: true });
  dom.clockButton.querySelector('.entete-date').textContent =
    `${formatDate(date, zone, { style: 'short' })} · ${timeZoneLabel(date, zone)}`;
  dom.clockButton.dataset.simule = isLive() ? 'non' : 'oui';
}

function renderNav(activeId) {
  clear(dom.nav);
  for (const route of ROUTES.filter((entry) => entry.nav)) {
    dom.nav.appendChild(el('button', {
      class: 'onglet',
      type: 'button',
      'aria-current': route.id === activeId ? 'page' : null,
      onClick: () => navigate(route.id),
    },
    el('span', { class: 'onglet-glyphe' }, route.glyph),
    el('span', { class: 'onglet-nom' }, route.title)));
  }
}

dom.placeButton.addEventListener('click', () => openPlacePanel(openPanel));
dom.clockButton.addEventListener('click', () => openTimePanel(openPanel));
dom.menuButton.addEventListener('click', () => openMenuPanel(openPanel, navigate));

/* --------------------------------------------------------- cycle de vue */

let current = null;

async function applyRoute() {
  const { id, params } = parseHash();
  const route = routeById(id);

  if (current?.id === id) {
    current.handle?.setParams?.(params);
    current.handle?.update?.();
    return;
  }

  current?.handle?.destroy?.();
  current = { id, handle: null };
  renderNav(id);
  setTimeBarVisible(false);

  clear(dom.view);
  dom.view.className = route.full ? 'vue vue--pleine' : 'vue';
  dom.view.appendChild(el('p', { class: 'note' }, 'Calcul en cours…'));

  const module = await route.load();
  if (current.id !== id) return; // navigation entre-temps

  clear(dom.view);
  const handle = module.mount(dom.view, {
    params,
    navigate,
    openPanel,
    closePanel,
    setTimeBarVisible,
  });
  current.handle = handle;
  document.title = `${route.title} — Céleste`;
  dom.view.scrollTop = 0;
  handle?.update?.();
}

/* ------------------------------------------------------- boucle d'horloge */

let lastTickSecond = -1;

function tick() {
  const date = now();
  const second = Math.floor(date.getTime() / 1000);
  if (second !== lastTickSecond) {
    lastTickSecond = second;
    renderHeader();
    if (timeBarVisible) buildTimeBar();
    current?.handle?.tick?.(date);
  }
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------ démarrage */

function applyTheme() {
  document.documentElement.dataset.theme = display().theme;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', display().theme === 'rouge' ? '#060102' : '#05070e');
}

subscribe((reason) => {
  renderHeader();
  if (reason === 'display') applyTheme();
  if (reason === 'observer' || reason === 'timezone' || reason === 'display') {
    current?.handle?.refresh?.(reason);
  }
  if (reason === 'clock') {
    buildTimeBar();
    current?.handle?.update?.();
  }
});

window.addEventListener('hashchange', applyRoute);

applyTheme();
renderHeader();
await applyRoute();
tick();

/* --------------------------------------------------- installation hors-ligne */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('Service worker non enregistré', error);
    });
  });
}

/** Conserve l'événement d'installation pour le proposer depuis les réglages. */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  document.dispatchEvent(new CustomEvent('celeste:installable'));
});

export const getInstallPrompt = () => installPrompt;
export const clearInstallPrompt = () => { installPrompt = null; };
