/**
 * Panneau lunaire : état courant, calendrier des phases, distances et apsides,
 * librations, nœuds et éclipses.
 *
 * La lunaison est le cycle le plus concret du ciel : on cherche ici à rendre
 * lisibles à la fois ce que l'on voit ce soir et la mécanique qui le produit.
 */
import {
  el, card, rows, row, stat, statGrid, chip, notice, heading, disclosure, table, list, listItem,
} from '../ui/dom.js';
import { moonDisc, lineChart } from '../ui/graphiques.js';
import { now, observer, timeZone, setTime } from '../core/state.js';
import {
  Body, moonState, moonLimbOrientation, nextMoonQuarters, dailyCircumstances,
} from '../core/ephem.js';
import { lunarApsisEvents, lunarEclipseEvents, lunarNodeEvents } from '../core/events.js';
import { MOON, CYCLES } from '../data/bodies.js';
import { localDateParts, startOfLocalDay, MS_PER_DAY } from '../core/time.js';
import {
  formatTime, formatDate, formatDateTime, formatNumber, formatKm, formatDegrees,
  formatSmallAngle, formatRelative, formatDMS, calendarDay,
} from '../core/format.js';

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

/** Écart à la distance moyenne, formulé en clair. */
function distanceHint(distanceKm) {
  const delta = distanceKm - MOON.orbit.semiMajorAxisKm;
  const magnitude = formatKm(Math.abs(delta));
  return `${magnitude} de ${delta >= 0 ? 'plus' : 'moins'} que la distance moyenne`;
}

export function createLunarPanel() {
  const node = el('div', { style: { display: 'contents' } });
  const sections = {
    etat: el('div'),
    calendrier: el('div'),
    phases: el('div'),
    distance: el('div'),
    libration: el('div'),
    eclipses: el('div'),
    mois: el('div'),
  };

  node.append(
    sections.etat,
    heading('Calendrier lunaire', 'Touchez un jour pour y transporter l’application'),
    sections.calendrier,
    sections.phases,
    heading('Distance et apsides'),
    sections.distance,
    heading('Librations', 'Pourquoi nous voyons 59 % de la Lune, et non la moitié'),
    sections.libration,
    heading('Éclipses de Lune'),
    sections.eclipses,
    heading('Les cinq mois lunaires', 'Une même révolution, cinq durées selon le repère choisi'),
    sections.mois,
  );

  /* ------------------------------------------------------------- état */

  function renderState(date, place, zone) {
    const state = moonState(date, place);
    const circumstances = dailyCircumstances(Body.Moon, date, place, zone);
    const orientation = moonLimbOrientation(date, place);
    const above = state.position.altitude > -0.5;
    const nextQuarter = nextMoonQuarters(date, 1)[0];

    sections.etat.replaceChildren(card({
      class: 'carte--accent',
      title: state.phaseName,
      subtitle: `Lunaison en cours depuis le ${formatDate(state.previousNewMoon, zone)}`,
      action: chip(state.waxing ? 'Croissante' : 'Décroissante',
        { tone: state.waxing ? 'accent' : 'froid' }),
    },
    el('div', { class: 'bloc-lune' },
      moonDisc({
        phaseAngle: state.phaseAngle,
        waxing: state.waxing,
        orientation: above ? orientation : null,
        size: 128,
      }),
      el('div', { class: 'bloc-lune-donnees' },
        rows(
          row('Éclairée', `${formatNumber(state.illuminatedFraction * 100, { digits: 1 })} %`),
          row('Âge', `${formatNumber(state.age, { digits: 2 })} j`,
            `${formatNumber(state.ageFraction * 100, { digits: 0 })} % de la lunaison`),
          row('Prochaine phase', nextQuarter.name,
            formatDateTime(nextQuarter.date, zone)),
          row('Magnitude', formatNumber(state.magnitude, { digits: 1 })),
        ))),

    statGrid(
      stat('Lever', circumstances.rise ? formatTime(circumstances.rise, zone) : '—',
        { tone: 'azur' }),
      stat('Culmination', circumstances.transit ? formatTime(circumstances.transit, zone) : '—',
        { hint: circumstances.transitAltitude !== null ? formatDegrees(circumstances.transitAltitude, 0) : null }),
      stat('Coucher', circumstances.set ? formatTime(circumstances.set, zone) : '—'),
    ),

    rows(
      row('Distance', formatKm(state.distanceKm),
        distanceHint(state.distanceKm)),
      row('Diamètre apparent', formatSmallAngle(state.angularDiameter),
        `${formatNumber(state.angularDiameter * 60, { digits: 1 })} minutes d’arc`),
      row('Hauteur', formatDegrees(state.position.altitude, 1),
        `azimut ${formatDegrees(state.position.azimuth, 0)}`),
      row('Constellation', state.position.constellation.name),
    ),

    above
      ? notice(`Le limbe éclairé pointe à ${formatDegrees(orientation, 0)} du zénith : `
        + 'le disque ci-dessus est orienté comme vous le verrez en levant les yeux.')
      : notice('La Lune est sous l’horizon : le disque est présenté cornes vers le haut, sans orientation locale.')));
  }

  /* ------------------------------------------------------- calendrier */

  function renderCalendar(date, zone) {
    const parts = localDateParts(date, zone);
    const first = startOfLocalDay(new Date(Date.UTC(parts.year, parts.month - 1, 1, 12)), zone);
    const firstWeekday = (new Date(Date.UTC(parts.year, parts.month - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
    const today = calendarDay(date, zone);

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(el('div', { class: 'calendrier-jour', 'data-hors-mois': 'oui' }));
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayDate = new Date(first.getTime() + (day - 1) * MS_PER_DAY + 12 * 3600000);
      const state = moonState(dayDate, null);
      cells.push(el('button', {
        class: 'calendrier-jour',
        type: 'button',
        'data-aujourdhui': calendarDay(dayDate, zone) === today ? 'oui' : 'non',
        title: `${formatDate(dayDate, zone)} — ${state.phaseName}, `
          + `${formatNumber(state.illuminatedFraction * 100, { digits: 0 })} % éclairée`,
        onClick: () => setTime(new Date(dayDate.getTime())),
      },
      moonDisc({
        phaseAngle: state.phaseAngle,
        waxing: state.waxing,
        size: 26,
        showMaria: false,
      }),
      el('span', { class: 'calendrier-jour-numero' }, String(day))));
    }

    sections.calendrier.replaceChildren(card({
      title: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: zone })
        .format(date),
    },
    el('div', { class: 'calendrier-lunaire' },
      ...WEEKDAYS.map((name) => el('div', { class: 'calendrier-entete' }, name))),
    el('div', { class: 'calendrier-lunaire' }, ...cells)));
  }

  /* ----------------------------------------------------------- phases */

  function renderPhases(date, zone) {
    const quarters = nextMoonQuarters(date, 8);
    sections.phases.replaceChildren(card({ title: 'Prochaines phases' },
      list(...quarters.map((quarter) => listItem({
        leading: moonDisc({
          phaseAngle: [180, 90, 0, 90][quarter.quarter],
          waxing: quarter.quarter < 2,
          size: 30,
          showMaria: false,
        }),
        title: quarter.name,
        subtitle: formatDateTime(quarter.date, zone),
        trailing: formatRelative(quarter.date, date),
        onClick: () => setTime(quarter.date),
      })))));
  }

  /* --------------------------------------------------------- distance */

  function renderDistance(date, zone) {
    const start = new Date(date.getTime() - 5 * MS_PER_DAY);
    const points = [];
    for (let i = 0; i <= 70; i += 1) {
      const instant = new Date(start.getTime() + i * MS_PER_DAY);
      points.push([i, moonState(instant, null).distanceKm / 1000]);
    }
    const apsides = lunarApsisEvents(start, new Date(start.getTime() + 70 * MS_PER_DAY));

    sections.distance.replaceChildren(card({
      title: 'Distance sur deux lunaisons',
      subtitle: 'L’orbite est une ellipse : la Lune approche et s’éloigne chaque mois',
    },
    lineChart({
      series: [{ points, color: 'var(--azur)' }],
      yTicks: [
        { value: 363, label: '363' },
        { value: 384, label: '384' },
        { value: 406, label: '406' },
      ],
      xTicks: [
        { value: 5, label: formatDate(date, zone, { style: 'short' }) },
        { value: 35, label: '+30 j' },
        { value: 65, label: '+60 j' },
      ],
      marker: { x: 5, y: moonState(date, null).distanceKm / 1000 },
      yLabel: 'milliers de kilomètres',
      xLabel: 'jours',
    }),
    el('p', { class: 'figure-legende' },
      `Périgée ${formatKm(MOON.orbit.perigeeKm)}, apogée ${formatKm(MOON.orbit.apogeeKm)} : `
      + 'un écart de 12 %, qui suffit à distinguer une éclipse totale d’une éclipse annulaire.'),

    list(...apsides.slice(0, 6).map((apsis) => listItem({
      leading: apsis.title.startsWith('Périgée') ? '↘' : '↗',
      title: apsis.title,
      subtitle: formatDateTime(apsis.date, zone),
      trailing: el('span', {},
        formatKm(apsis.distanceKm),
        apsis.superMoon ? el('br') : null,
        apsis.superMoon ? el('small', { style: { color: 'var(--accent)' } }, 'super-Lune') : null),
      onClick: () => setTime(apsis.date),
    })))));
  }

  /* -------------------------------------------------------- libration */

  function renderLibration(date, place) {
    const state = moonState(date, place);
    const { libration } = state;

    sections.libration.replaceChildren(card({},
      statGrid(
        stat('Libration en longitude', formatDegrees(libration.longitude, 2),
          { hint: libration.longitude > 0 ? 'bord est dégagé' : 'bord ouest dégagé' }),
        stat('Libration en latitude', formatDegrees(libration.latitude, 2),
          { hint: libration.latitude > 0 ? 'pôle nord incliné vers nous' : 'pôle sud incliné vers nous' }),
      ),
      rows(
        row('Point sous la Terre', `${formatDMS(libration.subEarthLatitude, { sign: true, width: 2 })} · `
          + `${formatDMS(libration.subEarthLongitude, { sign: true, width: 3 })}`,
        'lieu lunaire d’où la Terre est au zénith'),
      ),
      notice('La rotation de la Lune est régulière, sa révolution ne l’est pas : '
        + 'sur son orbite elliptique elle accélère au périgée et ralentit à l’apogée. '
        + 'Le décalage entre les deux nous laisse voir alternativement un peu au-delà '
        + 'de chaque bord — en longitude jusqu’à 8°, en latitude jusqu’à 7° du fait de '
        + 'l’inclinaison de son axe. Au total, 59 % de sa surface finit par se montrer.')));
  }

  /* --------------------------------------------------------- éclipses */

  function renderEclipses(date, place, zone) {
    const eclipses = lunarEclipseEvents(date, new Date(date.getTime() + 1100 * MS_PER_DAY), place);
    const nodes = lunarNodeEvents(date, new Date(date.getTime() + 60 * MS_PER_DAY));

    sections.eclipses.replaceChildren(card({},
      eclipses.length
        ? list(...eclipses.slice(0, 5).map((eclipse) => listItem({
          leading: eclipse.eclipseKind === 'total' ? '🌕' : '🌘',
          title: eclipse.title,
          subtitle: `${formatDateTime(eclipse.date, zone)} · ${eclipse.detail}`,
          trailing: formatRelative(eclipse.date, date),
          onClick: () => setTime(eclipse.date),
        })))
        : notice('Aucune éclipse de Lune dans les trois prochaines années.'),
      nodes.length
        ? notice(`Prochain passage par un nœud : ${formatDate(nodes[0].date, zone)}. `
          + 'Une éclipse ne peut survenir que si la pleine ou la nouvelle Lune tombe '
          + 'près d’un nœud, là où l’orbite lunaire croise le plan de l’écliptique.')
        : null));
  }

  /* ------------------------------------------------------------ mois */

  function renderMonths() {
    sections.mois.replaceChildren(card({},
      table(
        ['Mois', 'Durée', 'Ce qu’il mesure'],
        [
          ['Synodique', `${formatNumber(CYCLES.synodicMonth, { digits: 6 })} j`, 'Retour de la même phase'],
          ['Sidéral', `${formatNumber(CYCLES.siderealMonth, { digits: 6 })} j`, 'Retour devant la même étoile'],
          ['Draconitique', `${formatNumber(CYCLES.draconiticMonth, { digits: 6 })} j`, 'Retour au même nœud'],
          ['Anomalistique', `${formatNumber(CYCLES.anomalisticMonth, { digits: 6 })} j`, 'Retour au périgée'],
          ['Tropique', `${formatNumber(MOON.orbit.tropicalMonth, { digits: 6 })} j`, 'Retour au point vernal'],
        ],
      ),
      notice('Le mois synodique dépasse le mois sidéral de deux jours parce que la Terre '
        + 'avance sur son orbite pendant que la Lune tourne : il faut à celle-ci un supplément '
        + 'de course pour retrouver le même alignement avec le Soleil. '
        + `Trois cent vingt-trois mois draconitiques valant presque 242 mois synodiques, `
        + 'les éclipses se répètent à l’identique tous les 18 ans et 11 jours : c’est le saros.'),
      disclosure('Le saros en chiffres',
        rows(
          row('Durée', `${formatNumber(CYCLES.saros, { digits: 4 })} j`, '18 ans, 11 jours et 8 heures'),
          row('En mois synodiques', formatNumber(CYCLES.saros / CYCLES.synodicMonth, { digits: 4 })),
          row('En mois draconitiques', formatNumber(CYCLES.saros / CYCLES.draconiticMonth, { digits: 4 })),
          row('En mois anomalistiques', formatNumber(CYCLES.saros / CYCLES.anomalisticMonth, { digits: 4 })),
        ),
        notice('Le tiers de jour excédentaire décale l’éclipse suivante de 120° en longitude : '
          + 'il faut trois saros, soit 54 ans, pour la revoir depuis la même région.'))));
  }

  /* ----------------------------------------------------------- cycle */

  function update() {
    const date = now();
    const place = observer();
    const zone = timeZone();
    renderState(date, place, zone);
    renderCalendar(date, zone);
    renderPhases(date, zone);
    renderDistance(date, zone);
    renderLibration(date, place);
    renderEclipses(date, place, zone);
    renderMonths();
  }

  return { node, update };
}
