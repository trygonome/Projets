/**
 * Réglages : lieu, fuseau, affichage, installation hors-ligne et informations
 * sur les sources de données.
 */
import {
  el, card, rows, row, notice, heading, button, chip, disclosure, replaceContent, table,
} from '../ui/dom.js';
import {
  observer, setObserver, timeZone, timeZonePreference, setTimeZone,
  display, setDisplay, now,
} from '../core/state.js';
import { deviceTimeZone, timeZoneLabel, formatLatitude, formatLongitude, formatNumber } from '../core/format.js';
import { openPlacePanel } from './lieu.js';
import { PLACES } from '../data/places.js';
import { hebergement } from '../core/hebergement.js';

/** Fuseaux proposés en tête de liste, les plus utiles au public visé. */
const COMMON_ZONES = [
  'Europe/Paris', 'Europe/Brussels', 'Europe/Zurich', 'Europe/London',
  'America/Toronto', 'America/New_York', 'America/Los_Angeles',
  'Indian/Reunion', 'America/Martinique', 'America/Guadeloupe',
  'Pacific/Noumea', 'Pacific/Tahiti', 'Africa/Dakar', 'Africa/Casablanca', 'UTC',
];

function allTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [...new Set([...COMMON_ZONES, ...PLACES.map((place) => place.timeZone)])].sort();
  }
}

export function mount(container, { openPanel }) {
  const body = el('div', { style: { display: 'contents' } });
  container.append(body);

  let installEvent = null;
  const onInstallable = (event) => { installEvent = event; render(); };

  /** Interrupteur relié à une préférence d'affichage. */
  function toggle(title, detail, key, onChange) {
    const input = el('input', {
      type: 'checkbox',
      checked: Boolean(display()[key]),
      onChange: (event) => {
        setDisplay({ [key]: event.target.checked });
        onChange?.(event.target.checked);
      },
    });
    return el('label', { class: 'bascule' },
      el('span', { class: 'bascule-texte' },
        el('span', { class: 'bascule-titre' }, title),
        el('span', { class: 'bascule-detail' }, detail)),
      input);
  }

  function renderPlace() {
    const place = observer();
    return card({
      title: 'Lieu d’observation',
      action: chip(sourceLabel(place.source), { tone: 'azur' }),
    },
    rows(
      row('Nom', place.label),
      row('Latitude', formatLatitude(place.latitude)),
      row('Longitude', formatLongitude(place.longitude)),
      row('Altitude', `${formatNumber(place.height ?? 0)} m`,
        'elle avance le lever et retarde le coucher'),
    ),
    el('div', { class: 'barre-boutons' },
      button('Changer de lieu', () => openPlacePanel(openPanel), { variant: 'accent' })));
  }

  const sourceLabel = (source) => ({
    gps: 'position mesurée',
    repertoire: 'choisi dans la liste',
    manuel: 'coordonnées saisies',
    defaut: 'lieu par défaut',
  }[source] ?? 'lieu par défaut');

  function renderTimeZone() {
    const preference = timeZonePreference();
    const zones = allTimeZones();
    const select = el('select', {
      onChange: (event) => { setTimeZone(event.target.value); render(); },
    },
    el('option', { value: 'auto', selected: preference === 'auto' },
      `Automatique (${deviceTimeZone()})`),
    el('optgroup', { label: 'Fuseaux usuels' },
      ...COMMON_ZONES.map((zone) => el('option', {
        value: zone, selected: preference === zone,
      }, zone))),
    el('optgroup', { label: 'Tous les fuseaux' },
      ...zones.map((zone) => el('option', {
        value: zone, selected: preference === zone,
      }, zone))));

    return card({ title: 'Fuseau horaire' },
      el('label', { class: 'champ' },
        el('span', { class: 'champ-etiquette' }, 'Heures affichées dans ce fuseau'),
        select),
      notice(`Actuellement : ${timeZone()} (${timeZoneLabel(now(), timeZone())}). `
        + 'Choisir un fuseau distinct du lieu permet de préparer une observation '
        + 'à l’étranger sans se tromper d’heure.'));
  }

  // Le thème n'est pas un booléen : on remplace l'interrupteur générique.
  function renderTheme() {
    const isNight = display().theme === 'rouge';
    const input = el('input', {
      type: 'checkbox',
      checked: isNight,
      onChange: (event) => setDisplay({ theme: event.target.checked ? 'rouge' : 'nuit' }),
    });
    return el('label', { class: 'bascule' },
      el('span', { class: 'bascule-texte' },
        el('span', { class: 'bascule-titre' }, 'Vision nocturne'),
        el('span', { class: 'bascule-detail' },
          'Écran rouge, pour préserver l’adaptation de l’œil à l’obscurité')),
      input);
  }

  function renderInstall() {
    const contexte = hebergement();

    // Dans l'APK, tout est déjà sur l'appareil : proposer une installation
    // n'aurait aucun sens, et la mise à jour passe par le fichier.
    if (contexte === 'apk') {
      return card({ title: 'Application installée' },
        notice('Céleste tourne depuis l’application Android : les catalogues, '
          + 'le moteur d’éphémérides et les cartes sont dans l’appareil. Aucune '
          + 'connexion n’est nécessaire, jamais.', 'accent'),
        el('p', { class: 'texte' },
          'Pour passer à une version plus récente, installez le nouveau fichier '
          + 'APK par-dessus celui-ci : vos réglages et votre lieu sont conservés.'),
        renderCachePurge());
    }

    if (contexte === 'installe') {
      return card({ title: 'Application installée' },
        notice('Céleste est installée sur l’écran d’accueil : elle s’ouvre en '
          + 'plein écran et fonctionne sans connexion.', 'accent'),
        renderCachePurge());
    }

    return card({ title: 'Installer sur l’appareil' },
      el('p', { class: 'texte' },
        'Installée, l’application occupe tout l’écran, se lance depuis l’écran '
        + 'd’accueil et fonctionne sans réseau : tous les calculs sont faits sur '
        + 'l’appareil.'),
      installEvent
        ? el('div', { class: 'barre-boutons' },
          button('Installer maintenant', async () => {
            installEvent.prompt();
            await installEvent.userChoice;
            installEvent = null;
            render();
          }, { variant: 'accent' }))
        : notice('Sur Android : menu du navigateur, puis « Installer l’application » '
          + 'ou « Ajouter à l’écran d’accueil ». Sur iPhone : bouton Partager, '
          + 'puis « Sur l’écran d’accueil ».'),
      renderCachePurge());
  }

  function renderCachePurge() {
    return disclosure('Données hors-ligne',
      el('p', { class: 'texte' },
        'Le catalogue d’étoiles, les figures des constellations, les contours des '
        + 'côtes et le moteur d’éphémérides sont mis en cache dès la première '
        + 'visite. Aucune requête n’est faite ensuite.'),
      el('div', { class: 'barre-boutons' },
        button('Vider le cache et recharger', async () => {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
          const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
          await Promise.all(registrations.map((registration) => registration.unregister()));
          location.reload();
        })));
  }

  function renderAbout() {
    return card({ title: 'À propos' },
      el('p', { class: 'texte' },
        'Céleste calcule les positions des astres directement sur votre appareil. '
        + 'Aucune donnée ne quitte le téléphone : ni votre position, ni vos réglages.'),
      table(
        ['Élément', 'Origine'],
        [
          ['Éphémérides', 'Astronomy Engine (Don Cross), licence MIT — précision de l’ordre de la minute d’arc'],
          ['Rendu 3D', 'three.js, licence MIT'],
          ['Étoiles', 'Hipparcos et Yale Bright Star Catalogue'],
          ['Constellations', 'Figures et noms via d3-celestial'],
          ['Ciel profond', 'Catalogue Messier'],
          ['Contours terrestres', 'Natural Earth, domaine public'],
          ['Données planétaires', 'NASA/JPL Planetary Fact Sheets, Union astronomique internationale'],
        ],
      ),
      notice('Les positions du Soleil, de la Lune et des planètes sont exactes à mieux '
        + 'qu’une minute d’arc sur la période 1700–2200. Les heures de lever et de '
        + 'coucher tiennent compte de la réfraction moyenne ; les conditions réelles '
        + 'peuvent les décaler de quelques dizaines de secondes.'));
  }

  function renderReset() {
    return card({},
      el('div', { class: 'barre-boutons' },
        button('Réinitialiser les réglages', () => {
          setObserver({
            latitude: 48.8566, longitude: 2.3522, height: 35,
            label: 'Paris, France', source: 'defaut',
          });
          setTimeZone('auto');
          setDisplay({
            theme: 'nuit', horizonRefraction: true, starMagnitudeLimit: 5.5,
            showConstellations: true, showDeepSky: true, showLabels: true,
            systemScale: 'compressee', showOrbits: true,
          });
          render();
        })));
  }

  function render() {
    replaceContent(body,
      card({ class: 'carte--plate', title: 'Réglages' }),
      renderPlace(),
      renderTimeZone(),
      heading('Affichage'),
      card({},
        renderTheme(),
        toggle('Réfraction atmosphérique',
          'Relève les astres bas de 34′ à l’horizon, comme le fait l’air',
          'horizonRefraction'),
        toggle('Figures des constellations', 'Tracées dans le planétarium',
          'showConstellations'),
        toggle('Objets du ciel profond', 'Les 110 objets du catalogue Messier',
          'showDeepSky'),
        toggle('Noms des astres', 'Étiquettes dans le ciel et dans la vue du système',
          'showLabels'),
        toggle('Orbites', 'Tracées dans la vue tridimensionnelle', 'showOrbits')),
      renderInstall(),
      renderAbout(),
      renderReset());
  }

  document.addEventListener('celeste:installable', onInstallable);
  render();

  return {
    update() {},
    refresh() { render(); },
    destroy() { document.removeEventListener('celeste:installable', onInstallable); },
  };
}
