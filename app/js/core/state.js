/**
 * État applicatif : lieu d'observation, horloge simulée, préférences.
 *
 * Un unique objet observable alimente toutes les vues. L'horloge est simulée
 * plutôt que lue directement : la même arithmétique sert au temps réel, à la
 * pause, au défilement accéléré et au saut à une date arbitraire.
 */
import { deviceTimeZone } from './format.js';

const STORAGE_KEY = 'celeste.etat.v1';

const DEFAULTS = {
  observer: {
    latitude: 48.8566,
    longitude: 2.3522,
    height: 35,
    label: 'Paris, France',
    source: 'defaut',
  },
  timeZone: 'auto',
  display: {
    theme: 'nuit',
    horizonRefraction: true,
    starMagnitudeLimit: 5.5,
    showConstellations: true,
    showDeepSky: true,
    showLabels: true,
    systemScale: 'compressee',
    showOrbits: true,
  },
};

/** Fusion profonde limitée aux objets simples des préférences. */
function merge(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && base[key] && typeof base[key] === 'object') {
      out[key] = merge(base[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? merge(DEFAULTS, JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

const state = load();

/* --------------------------------------------------------------- horloge */

/**
 * L'horloge se décrit par un point d'ancrage et un taux : le temps simulé vaut
 * `anchorSimulated + (maintenant − anchorReal) × rate`. Un taux nul fige la
 * scène, un taux de 1 avec ancrage synchrone redonne le temps réel.
 */
const clock = {
  anchorReal: Date.now(),
  anchorSimulated: Date.now(),
  rate: 1,
  live: true,
};

/** Instant courant de l'application (réel ou simulé). */
export function now() {
  if (clock.live) return new Date();
  return new Date(clock.anchorSimulated + (Date.now() - clock.anchorReal) * clock.rate);
}

/** Recale l'ancrage sur l'instant simulé courant, sans discontinuité. */
function reanchor() {
  const current = now().getTime();
  clock.anchorSimulated = current;
  clock.anchorReal = Date.now();
}

/** Repasse en suivi du temps réel. */
export function resumeLive() {
  clock.live = true;
  clock.rate = 1;
  reanchor();
  notify('clock');
}

/** Fixe la vitesse d'écoulement du temps (1 = temps réel, 0 = figé). */
export function setTimeRate(rate) {
  reanchor();
  clock.rate = rate;
  clock.live = rate === 1 && clock.live;
  if (rate !== 1) clock.live = false;
  notify('clock');
}

/** Saute à une date donnée en conservant la vitesse courante. */
export function setTime(date) {
  clock.live = false;
  clock.anchorSimulated = new Date(date).getTime();
  clock.anchorReal = Date.now();
  notify('clock');
}

/** Décale le temps simulé d'un nombre de jours (positif ou négatif). */
export function shiftTime(days) {
  setTime(new Date(now().getTime() + days * 86400000));
}

export const clockState = () => ({ ...clock, live: clock.live });
export const isLive = () => clock.live;
export const timeRate = () => clock.rate;

/* ------------------------------------------------------------------ lieu */

export const observer = () => state.observer;

export function setObserver(patch) {
  state.observer = { ...state.observer, ...patch };
  persist();
  notify('observer');
}

/* ---------------------------------------------------------------- fuseau */

/** Fuseau IANA effectivement utilisé pour l'affichage. */
export function timeZone() {
  return state.timeZone === 'auto' ? deviceTimeZone() : state.timeZone;
}

export const timeZonePreference = () => state.timeZone;

export function setTimeZone(zone) {
  state.timeZone = zone;
  persist();
  notify('timezone');
}

/* ----------------------------------------------------------- préférences */

export const display = () => state.display;

export function setDisplay(patch) {
  state.display = { ...state.display, ...patch };
  persist();
  notify('display');
}

/* --------------------------------------------------------- persistance */

let persistTimer = null;

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
        observer: state.observer,
        timeZone: state.timeZone,
        display: state.display,
      }));
    } catch {
      /* stockage indisponible (navigation privée) : on continue sans persister */
    }
  }, 250);
}

/* ------------------------------------------------------------ observation */

const listeners = new Set();

/** S'abonne aux changements d'état ; renvoie la fonction de désabonnement. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(reason) {
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch (error) {
      console.error('Abonné en erreur', error);
    }
  }
}

export { notify, DEFAULTS };
