/**
 * Panneau solaire : saisons, durée du jour au fil de l'année, équation du
 * temps, analemme, éclipses et apsides terrestres.
 *
 * Ce sont les cycles qui règlent le calendrier et l'heure : on cherche ici à
 * montrer d'où viennent les irrégularités que l'horloge civile efface.
 */
import {
  el, card, rows, row, stat, statGrid, chip, notice, heading, disclosure, table, list, listItem,
} from '../ui/dom.js';
import { lineChart, scatterChart } from '../ui/graphiques.js';
import { now, observer, timeZone, setTime } from '../core/state.js';
import {
  Body, solarDay, dailyCircumstances, bodySnapshot, equationOfTime,
  solarDeclination, obliquity, localSiderealTime,
} from '../core/ephem.js';
import { seasonEvents, solarEclipseEvents } from '../core/events.js';
import { SUN, CYCLES, PLANETS } from '../data/bodies.js';
import { Astronomy } from '../core/ephem.js';
import {
  addLocalDays, localDateParts, dayOfYear, daysInYear, MS_PER_DAY, startOfLocalDay,
} from '../core/time.js';
import {
  formatTime, formatDate, formatDateTime, formatNumber, formatDegrees, formatDuration,
  formatSignedDuration, formatRelative, formatDMS, cardinalPoint, formatKm, formatAu,
} from '../core/format.js';

const MONTH_TICKS = [
  [0, 'J'], [31, 'F'], [59, 'M'], [90, 'A'], [120, 'M'], [151, 'J'],
  [181, 'J'], [212, 'A'], [243, 'S'], [273, 'O'], [304, 'N'], [334, 'D'],
];

export function createSolarPanel() {
  const node = el('div', { style: { display: 'contents' } });
  const sections = {
    etat: el('div'),
    saisons: el('div'),
    duree: el('div'),
    equation: el('div'),
    analemme: el('div'),
    eclipses: el('div'),
    terre: el('div'),
  };

  node.append(
    sections.etat,
    heading('Saisons'),
    sections.saisons,
    heading('Durée du jour au fil de l’année'),
    sections.duree,
    heading('Équation du temps', 'Pourquoi midi n’est presque jamais à midi'),
    sections.equation,
    sections.analemme,
    heading('Éclipses de Soleil'),
    sections.eclipses,
    heading('La Terre sur son orbite'),
    sections.terre,
  );

  // Les courbes annuelles coûtent des dizaines de recherches de lever :
  // elles sont recalculées seulement quand l'année ou le lieu change.
  let yearCache = null;

  function ensureYearCurves(date, place, zone) {
    const { year } = localDateParts(date, zone);
    const key = `${year}|${place.latitude}|${place.longitude}|${zone}`;
    if (yearCache?.key === key) return yearCache;

    const start = startOfLocalDay(new Date(Date.UTC(year, 0, 1, 12)), zone);
    const total = daysInYear(year);
    const dayLength = [];
    const sunrise = [];
    const sunset = [];
    const riseAzimuth = [];
    for (let day = 0; day < total; day += 5) {
      const instant = new Date(start.getTime() + day * MS_PER_DAY);
      const circumstances = dailyCircumstances(Body.Sun, instant, place, zone);
      dayLength.push([day, circumstances.visibleHours ?? 0]);
      if (circumstances.rise) {
        const snapshot = bodySnapshot(Body.Sun, circumstances.rise, place);
        riseAzimuth.push([day, snapshot.azimuth]);
        sunrise.push([day, hoursOfDay(circumstances.rise, circumstances.dayStart)]);
      }
      if (circumstances.set) {
        sunset.push([day, hoursOfDay(circumstances.set, circumstances.dayStart)]);
      }
    }

    const equation = [];
    const declination = [];
    for (let day = 0; day < total; day += 2) {
      const instant = new Date(start.getTime() + day * MS_PER_DAY);
      equation.push([day, equationOfTime(instant)]);
      declination.push([day, solarDeclination(instant)]);
    }

    yearCache = { key, year, start, total, dayLength, sunrise, sunset, riseAzimuth, equation, declination };
    return yearCache;
  }

  const hoursOfDay = (instant, dayStart) => (instant - dayStart) / 3600000;

  /* -------------------------------------------------------------- état */

  function renderState(date, place, zone) {
    const snapshot = bodySnapshot(Body.Sun, date, place);
    const day = solarDay(date, place, zone);
    const eot = equationOfTime(date);
    const declination = solarDeclination(date);

    // Heure solaire vraie : l'angle horaire du Soleil, ramené à une horloge.
    const hourAngle = Astronomy.HourAngle(Body.Sun, date, new Astronomy.Observer(
      place.latitude, place.longitude, place.height ?? 0,
    ));
    const trueSolar = (hourAngle + 12) % 24;

    sections.etat.replaceChildren(card({
      class: 'carte--accent',
      title: 'Soleil',
      subtitle: `${formatDate(date, zone, { style: 'long' })}`,
      action: chip(snapshot.altitude > -0.833 ? 'Levé' : 'Couché',
        { tone: snapshot.altitude > -0.833 ? 'accent' : 'neutre' }),
    },
    statGrid(
      stat('Hauteur', formatDegrees(snapshot.altitude, 1), { tone: 'accent' }),
      stat('Déclinaison', formatDegrees(declination, 2),
        { hint: `obliquité ${formatDegrees(obliquity(date), 3)}` }),
      stat('Heure solaire vraie', formatDuration(trueSolar),
        { hint: 'au méridien du lieu' }),
    ),
    rows(
      row('Lever', day.rise ? formatTime(day.rise, zone) : '—',
        day.rise ? `azimut ${formatDegrees(bodySnapshot(Body.Sun, day.rise, place).azimuth, 0)} · ${cardinalPoint(bodySnapshot(Body.Sun, day.rise, place).azimuth)}` : null),
      row('Midi vrai', day.transit ? formatTime(day.transit, zone) : '—',
        day.transitAltitude !== null ? `${formatDegrees(day.transitAltitude, 1)} au-dessus de l’horizon` : null),
      row('Coucher', day.set ? formatTime(day.set, zone) : '—',
        day.set ? `azimut ${formatDegrees(bodySnapshot(Body.Sun, day.set, place).azimuth, 0)} · ${cardinalPoint(bodySnapshot(Body.Sun, day.set, place).azimuth)}` : null),
      row('Durée du jour', day.visibleHours === null ? '—' : formatDuration(day.visibleHours)),
      row('Équation du temps',
        `${eot >= 0 ? '+' : '−'}${formatDuration(Math.abs(eot) / 60, { showSeconds: true })}`,
        eot >= 0 ? 'le Soleil vrai précède le Soleil moyen' : 'le Soleil vrai suit le Soleil moyen'),
      row('Temps sidéral local', formatDuration(localSiderealTime(date, place), { showSeconds: true })),
    )));
  }

  /* ----------------------------------------------------------- saisons */

  function renderSeasons(date, place, zone) {
    const { year } = localDateParts(date, zone);
    const seasons = Astronomy.Seasons(year);
    const entries = [
      { date: seasons.mar_equinox.date, name: 'Équinoxe de mars', note: 'Jour et nuit d’égale durée' },
      { date: seasons.jun_solstice.date, name: 'Solstice de juin', note: 'Soleil au plus haut au nord' },
      { date: seasons.sep_equinox.date, name: 'Équinoxe de septembre', note: 'Retour à l’équilibre' },
      { date: seasons.dec_solstice.date, name: 'Solstice de décembre', note: 'Soleil au plus bas au nord' },
    ];

    const upcoming = [...entries, ...seasonEvents(
      new Date(Date.UTC(year + 1, 0, 1)), new Date(Date.UTC(year + 1, 11, 31)),
    ).map((event) => ({ date: event.date, name: event.title, note: event.detail }))]
      .filter((entry) => entry.date > date)
      .sort((a, b) => a.date - b.date);

    const southern = place.latitude < 0;

    sections.saisons.replaceChildren(card({
      subtitle: southern
        ? 'Vous êtes dans l’hémisphère sud : les saisons sont inversées par rapport aux noms usuels.'
        : null,
    },
    list(...entries.map((entry) => {
      const circumstances = dailyCircumstances(Body.Sun, entry.date, place, zone);
      return listItem({
        leading: entry.name.includes('Solstice') ? '☀' : '⚖',
        title: entry.name,
        subtitle: `${formatDateTime(entry.date, zone)} · ${entry.note}`,
        trailing: el('span', {},
          circumstances.visibleHours === null ? '—' : formatDuration(circumstances.visibleHours),
          el('br'),
          el('small', {}, 'de jour')),
        onClick: () => setTime(entry.date),
      });
    })),
    upcoming.length
      ? notice(`Prochain passage : ${upcoming[0].name}, ${formatRelative(upcoming[0].date, date)}.`)
      : null,
    notice('Les saisons ne viennent pas de la distance au Soleil mais de l’inclinaison de '
      + `l’axe terrestre, actuellement de ${formatDegrees(obliquity(date), 2)}. `
      + 'La Terre est d’ailleurs au plus près du Soleil début janvier, en plein hiver boréal.')));
  }

  /* ------------------------------------------------- durée du jour */

  function renderDayLength(date, place, zone) {
    const curves = ensureYearCurves(date, place, zone);
    const today = dayOfYear(date, zone) - 1;
    const todayLength = dailyCircumstances(Body.Sun, date, place, zone).visibleHours;
    const yesterdayLength = dailyCircumstances(
      Body.Sun, addLocalDays(date, -1, zone), place, zone,
    ).visibleHours;
    const variation = todayLength !== null && yesterdayLength !== null
      ? (todayLength - yesterdayLength) * 3600 : null;

    // Les extrêmes tombent aux solstices : les prendre sur la courbe
    // échantillonnée tous les cinq jours donnerait une date approximative.
    const seasons = Astronomy.Seasons(curves.year);
    const extremes = [seasons.jun_solstice.date, seasons.dec_solstice.date]
      .map((instant) => ({
        instant,
        hours: dailyCircumstances(Body.Sun, instant, place, zone).visibleHours ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours);
    const [longest, shortest] = extremes;

    sections.duree.replaceChildren(card({},
      lineChart({
        series: [{ points: curves.dayLength, color: 'var(--accent)' }],
        yTicks: [4, 8, 12, 16, 20].map((value) => ({ value, label: `${value} h` })),
        xTicks: MONTH_TICKS.map(([value, label]) => ({ value, label })),
        marker: { x: today, y: todayLength ?? 0 },
        yLabel: 'durée du jour',
        xLabel: 'mois',
      }),
      el('p', { class: 'figure-legende' },
        `Année ${curves.year} à ${formatDegrees(Math.abs(place.latitude), 2)} de latitude `
        + `${place.latitude >= 0 ? 'nord' : 'sud'}. La pente est la plus forte aux équinoxes, nulle aux solstices.`),
      statGrid(
        stat('Aujourd’hui', todayLength === null ? '—' : formatDuration(todayLength),
          { hint: variation === null ? null : `${formatSignedDuration(variation)} depuis hier`, tone: 'accent' }),
        stat('Jour le plus long', formatDuration(longest.hours),
          { hint: formatDate(longest.instant, zone) }),
        stat('Jour le plus court', formatDuration(shortest.hours),
          { hint: formatDate(shortest.instant, zone) }),
      ),
      disclosure('Amplitude des levers sur l’horizon',
        lineChart({
          series: [{ points: curves.riseAzimuth, color: 'var(--azur)' }],
          yTicks: [45, 90, 135].map((value) => ({ value, label: `${value}°` })),
          xTicks: MONTH_TICKS.map(([value, label]) => ({ value, label })),
          yLabel: 'azimut du lever',
          xLabel: 'mois',
        }),
        notice('Le Soleil ne se lève à l’est exact qu’aux équinoxes. Le reste de l’année, '
          + 'son point de lever balaie l’horizon d’un solstice à l’autre — c’est ce mouvement '
          + 'que jalonnent les alignements des monuments préhistoriques.'))));
  }

  /* ------------------------------------------------ équation du temps */

  function renderEquation(date, place, zone) {
    const curves = ensureYearCurves(date, place, zone);
    const today = dayOfYear(date, zone) - 1;
    const eot = equationOfTime(date);

    sections.equation.replaceChildren(card({},
      lineChart({
        series: [{ points: curves.equation, color: 'var(--chaud)' }],
        yTicks: [-15, -10, -5, 0, 5, 10, 15].map((value) => ({ value, label: `${value}` })),
        xTicks: MONTH_TICKS.map(([value, label]) => ({ value, label })),
        zeroLine: true,
        marker: { x: today, y: eot },
        yLabel: 'minutes d’avance',
        xLabel: 'mois',
      }),
      el('p', { class: 'figure-legende' },
        'Écart entre le Soleil vrai et le Soleil moyen, en minutes. '
        + 'Positif quand le cadran solaire avance sur la montre.'),
      notice('Deux causes se superposent. D’une part l’orbite terrestre est elliptique : '
        + 'la Terre va plus vite au périhélie qu’à l’aphélie, si bien que la journée solaire '
        + 'n’a pas partout la même durée. D’autre part le Soleil se déplace sur l’écliptique, '
        + 'incliné sur l’équateur : sa progression en ascension droite varie même à vitesse '
        + 'constante. La somme des deux atteint 16 minutes début novembre et −14 minutes '
        + 'à la mi-février.')));
  }

  /* -------------------------------------------------------- analemme */

  function renderAnalemma(date, place, zone) {
    const curves = ensureYearCurves(date, place, zone);
    const points = curves.equation.map(([, minutes], index) =>
      [minutes, curves.declination[index]?.[1] ?? 0]);

    const highlights = [];
    for (const [dayIndex, label] of [[0, '1ᵉʳ janv.'], [171, 'solstice'], [355, 'solstice']]) {
      const entry = curves.equation.find(([day]) => day >= dayIndex);
      const declinationEntry = curves.declination.find(([day]) => day >= dayIndex);
      if (entry && declinationEntry) {
        highlights.push({ x: entry[1], y: declinationEntry[1], label });
      }
    }

    sections.analemme.replaceChildren(card({
      title: 'L’analemme',
      subtitle: 'La position du Soleil à la même heure d’horloge, jour après jour',
    },
    scatterChart({
      points,
      highlights: [
        ...highlights,
        {
          x: equationOfTime(date), y: solarDeclination(date),
          label: 'aujourd’hui', color: 'var(--accent)',
        },
      ],
      xLabel: 'équation du temps',
      yLabel: 'déclinaison',
      width: 320, height: 300,
    }),
    el('p', { class: 'figure-legende' },
      'Horizontalement l’équation du temps, verticalement la déclinaison. '
      + 'Photographiez le Soleil chaque semaine à la même heure : vous obtiendrez ce huit.')));
  }

  /* --------------------------------------------------------- éclipses */

  function renderEclipses(date, place, zone) {
    const eclipses = solarEclipseEvents(
      date, new Date(date.getTime() + 1500 * MS_PER_DAY), place,
    );
    const local = eclipses.filter((eclipse) => eclipse.local);

    sections.eclipses.replaceChildren(card({},
      local.length
        ? el('div', {},
          el('p', { class: 'texte' }, el('strong', {}, 'Visibles depuis votre position')),
          list(...local.slice(0, 4).map((eclipse) => listItem({
            leading: '🌞',
            title: eclipse.title,
            subtitle: `${formatDateTime(eclipse.local.peak.time.date, zone)} · ${eclipse.detail}`,
            trailing: formatRelative(eclipse.date, date),
            onClick: () => setTime(eclipse.local.peak.time.date),
          }))))
        : notice('Aucune éclipse de Soleil visible depuis votre position dans les quatre prochaines années.'),
      el('p', { class: 'texte', style: { marginTop: '10px' } },
        el('strong', {}, 'Toutes les éclipses du globe')),
      list(...eclipses.slice(0, 6).map((eclipse) => listItem({
        leading: eclipse.eclipseKind === 'total' ? '⬤' : eclipse.eclipseKind === 'annular' ? '◎' : '◐',
        title: eclipse.title,
        subtitle: `${formatDateTime(eclipse.date, zone)} · ${eclipse.detail}`,
        trailing: formatRelative(eclipse.date, date),
        onClick: () => setTime(eclipse.date),
      }))),
      notice('Une éclipse totale n’est possible que par une coïncidence remarquable : '
        + 'le Soleil est 400 fois plus grand que la Lune et se trouve 400 fois plus loin. '
        + 'Comme la Lune s’éloigne de 3,8 cm par an, cette coïncidence prendra fin '
        + 'dans environ 600 millions d’années.')));
  }

  /* ------------------------------------------------------------ Terre */

  function renderEarth(date, zone) {
    const perihelion = Astronomy.SearchPlanetApsis(Body.Earth, date);
    const next = Astronomy.NextPlanetApsis(Body.Earth, perihelion);
    const earth = PLANETS.find((planet) => planet.id === 'Earth');

    sections.terre.replaceChildren(card({},
      rows(
        row(perihelion.kind === 0 ? 'Périhélie' : 'Aphélie',
          formatDateTime(perihelion.time.date, zone),
          `${formatKm(perihelion.dist_km)} · ${formatAu(perihelion.dist_au, 5)}`),
        row(next.kind === 0 ? 'Périhélie' : 'Aphélie',
          formatDateTime(next.time.date, zone),
          `${formatKm(next.dist_km)} · ${formatAu(next.dist_au, 5)}`),
        row('Excentricité de l’orbite', formatNumber(earth.orbit.eccentricity, { digits: 5 }),
          'l’écart entre les deux vaut 3,4 %'),
        row('Obliquité actuelle', formatDMS(obliquity(date), { digits: 1 }),
          'elle oscille entre 22,1° et 24,5° en 41 000 ans'),
      ),
      table(
        ['Période', 'Durée', 'Référence'],
        [
          ['Jour sidéral', formatDuration(CYCLES.siderealDay * 24, { showSeconds: true }), 'Retour d’une étoile au méridien'],
          ['Jour solaire moyen', '24 h 00 min 00 s', 'Retour du Soleil moyen au méridien'],
          ['Année tropique', `${formatNumber(CYCLES.tropicalYear, { digits: 5 })} j`, 'Retour de l’équinoxe : règle les saisons'],
          ['Année sidérale', `${formatNumber(CYCLES.siderealYear, { digits: 5 })} j`, 'Retour devant les mêmes étoiles'],
          ['Année anomalistique', `${formatNumber(CYCLES.anomalisticYear, { digits: 5 })} j`, 'Retour au périhélie'],
        ],
      ),
      notice('Le jour sidéral est plus court de 3 min 56 s que le jour solaire : pendant '
        + 'qu’elle tourne sur elle-même, la Terre avance d’un degré sur son orbite et doit '
        + 'tourner un peu plus pour ramener le Soleil au méridien. '
        + `L’année tropique est plus courte que l’année sidérale de 20 minutes, parce que le `
        + `point vernal recule sous l’effet de la précession, dont le cycle complet dure `
        + `${formatNumber(CYCLES.precession)} ans.`),
      disclosure('Le Soleil en chiffres',
        rows(
          row('Rayon', formatKm(SUN.physical.radius), '109 fois celui de la Terre'),
          row('Masse', `${formatNumber(SUN.physical.mass / 1e30, { digits: 4 })} × 10³⁰ kg`,
            '333 000 fois celle de la Terre'),
          row('Température de surface', `${formatNumber(SUN.physical.surfaceTemperature)} °C`),
          row('Température du cœur', `${formatNumber(SUN.physical.coreTemperature / 1e6, { digits: 2 })} millions de °C`),
          row('Puissance rayonnée', `${formatNumber(SUN.physical.luminosity / 1e26, { digits: 3 })} × 10²⁶ W`),
          row('Rotation à l’équateur', `${formatNumber(SUN.physical.rotationPeriod, { digits: 2 })} j`,
            'environ 34 jours près des pôles'),
          row('Âge', `${formatNumber(SUN.physical.age / 1e9, { digits: 3 })} milliards d’années`,
            'à peu près la moitié de sa vie'),
        ))));
  }

  /* ------------------------------------------------------------ cycle */

  function update() {
    const date = now();
    const place = observer();
    const zone = timeZone();
    renderState(date, place, zone);
    renderSeasons(date, place, zone);
    renderDayLength(date, place, zone);
    renderEquation(date, place, zone);
    renderAnalemma(date, place, zone);
    renderEclipses(date, place, zone);
    renderEarth(date, zone);
  }

  return { node, update, invalidate() { yearCache = null; } };
}
