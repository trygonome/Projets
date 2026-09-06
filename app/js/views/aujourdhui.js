/**
 * Tableau de bord du lieu et du jour : ce que fait le ciel maintenant.
 *
 * Les grandeurs qui changent de seconde en seconde (hauteurs, azimuts) sont
 * recalculées à chaque battement ; les circonstances du jour, bien plus
 * coûteuses, sont mises en cache tant que la date locale ne change pas.
 */
import { el, card, rows, row, stat, statGrid, chip, notice, heading, disclosure, list, listItem } from '../ui/dom.js';
import { moonDisc, dayTimeline, skyPath, lightLegend } from '../ui/graphiques.js';
import { now, observer, timeZone } from '../core/state.js';
import {
  Body, PLANETS, bodySnapshot, solarDay, dailyCircumstances, moonState,
  localSiderealTime, equationOfTime, moonLimbOrientation, visibilityState,
  nextMoonQuarters, bodyName, subastralPoint,
} from '../core/ephem.js';
import { startOfLocalDay, startOfNextLocalDay, addLocalDays, addHours } from '../core/time.js';
import {
  formatTime, formatDuration, formatSignedDuration, formatDegrees, formatDMS,
  formatNumber, formatSmallAngle, cardinalPoint, formatKm, formatRelative, formatAzimuth,
  calendarDay, formatDate, formatLatitude, formatLongitude,
} from '../core/format.js';

/** Recalcule les circonstances du jour, coûteuses, et les mémorise. */
function computeDailyContext(date, place, zone) {
  const sun = solarDay(date, place, zone);
  const moon = dailyCircumstances(Body.Moon, date, place, zone);
  const yesterday = addLocalDays(date, -1, zone);
  const previousLength = dailyCircumstances(Body.Sun, yesterday, place, zone).visibleHours;

  const start = startOfLocalDay(date, zone);
  const end = startOfNextLocalDay(date, zone);
  const spanHours = (end - start) / 3600000;

  // Échantillonnage de la hauteur du Soleil et de la Lune sur la journée.
  const steps = 96;
  const sunTrack = [];
  const moonTrack = [];
  for (let i = 0; i <= steps; i += 1) {
    const instant = addHours(start, (i / steps) * spanHours);
    sunTrack.push(bodySnapshot(Body.Sun, instant, place).altitude);
    moonTrack.push(bodySnapshot(Body.Moon, instant, place).altitude);
  }

  return {
    key: `${calendarDay(date, zone)}|${place.latitude}|${place.longitude}|${zone}`,
    sun, moon, previousLength, start, end, spanHours, sunTrack, moonTrack,
  };
}

/** Position d'un instant dans la journée locale, entre 0 et 1. */
const dayFraction = (instant, context) =>
  instant ? (instant - context.start) / (context.end - context.start) : null;

const timeOrDash = (value, zone) => (value ? formatTime(value, zone) : '—');

export function mount(container) {
  let context = null;
  const sections = {
    soleil: el('div'),
    lune: el('div'),
    ciel: el('div'),
    reperes: el('div'),
  };

  container.append(
    sections.soleil,
    sections.lune,
    heading('Le ciel maintenant', 'Corps du système solaire au-dessus de l’horizon'),
    sections.ciel,
    heading('Repères du lieu'),
    sections.reperes,
  );

  function ensureContext(date, place, zone) {
    const key = `${calendarDay(date, zone)}|${place.latitude}|${place.longitude}|${zone}`;
    if (!context || context.key !== key) context = computeDailyContext(date, place, zone);
    return context;
  }

  /* ------------------------------------------------------------ Soleil */

  function renderSun(date, place, zone, ctx) {
    const snapshot = bodySnapshot(Body.Sun, date, place);
    const { sun } = ctx;
    const above = snapshot.altitude > -0.833;

    const markers = [];
    if (sun.rise) markers.push({ position: dayFraction(sun.rise, ctx), label: formatTime(sun.rise, zone) });
    if (sun.set) markers.push({ position: dayFraction(sun.set, ctx), label: formatTime(sun.set, zone) });

    const variation = ctx.previousLength !== null && sun.visibleHours !== null
      ? (sun.visibleHours - ctx.previousLength) * 3600
      : null;

    const nextEvent = above && sun.set && sun.set > date
      ? { label: 'Coucher', value: sun.set }
      : (sun.rise && sun.rise > date
        ? { label: 'Lever', value: sun.rise }
        : { label: 'Lever', value: dailyCircumstances(Body.Sun, addLocalDays(date, 1, zone), place, zone).rise });

    const content = card({
      class: 'carte--accent',
      title: 'Soleil',
      subtitle: sun.status === 'circumpolaire' ? 'Soleil de minuit : il ne se couche pas'
        : sun.status === 'jamais-leve' ? 'Nuit polaire : il ne se lève pas'
        : `${nextEvent.label} ${formatRelative(nextEvent.value, date)}`,
      action: chip(above ? 'Au-dessus de l’horizon' : 'Sous l’horizon',
        { tone: above ? 'accent' : 'neutre' }),
    },
    statGrid(
      stat('Hauteur', formatDegrees(snapshot.altitude, 1), { tone: 'accent' }),
      stat('Azimut', formatAzimuth(snapshot.azimuth), { hint: cardinalPoint(snapshot.azimuth) }),
      stat('Durée du jour',
        sun.visibleHours === null ? '—' : formatDuration(sun.visibleHours),
        { hint: variation === null ? null : `${formatSignedDuration(variation)} depuis hier` }),
    ),

    el('div', {},
      dayTimeline({
        samples: ctx.sunTrack,
        markers,
        cursor: dayFraction(date, ctx),
      }),
      lightLegend()),

    rows(
      row('Lever', timeOrDash(sun.rise, zone),
        sun.rise ? `azimut ${formatAzimuth(bodySnapshot(Body.Sun, sun.rise, place).azimuth)} · ${cardinalPoint(bodySnapshot(Body.Sun, sun.rise, place).azimuth)}` : null),
      row('Midi solaire vrai', timeOrDash(sun.transit, zone),
        sun.transitAltitude !== null ? `hauteur maximale ${formatDegrees(sun.transitAltitude, 1)}` : null),
      row('Coucher', timeOrDash(sun.set, zone),
        sun.set ? `azimut ${formatAzimuth(bodySnapshot(Body.Sun, sun.set, place).azimuth)} · ${cardinalPoint(bodySnapshot(Body.Sun, sun.set, place).azimuth)}` : null),
    ),

    disclosure('Crépuscules, heure dorée et heure bleue',
      rows(
        row('Aube astronomique', twilightTime(sun.twilights.astronomique, 'rising', zone), 'le Soleil passe sous −18°'),
        row('Aube nautique', twilightTime(sun.twilights.nautique, 'rising', zone), 'l’horizon marin devient discernable'),
        row('Aube civile', twilightTime(sun.twilights.civil, 'rising', zone), 'on lit dehors sans lumière'),
        row('Heure bleue du matin', intervalLabel(sun.blueHour.morning, zone)),
        row('Heure dorée du matin', intervalLabel(sun.goldenHour.morning, zone)),
        row('Heure dorée du soir', intervalLabel(sun.goldenHour.evening, zone)),
        row('Heure bleue du soir', intervalLabel(sun.blueHour.evening, zone)),
        row('Crépuscule civil', twilightTime(sun.twilights.civil, 'setting', zone)),
        row('Crépuscule nautique', twilightTime(sun.twilights.nautique, 'setting', zone)),
        row('Crépuscule astronomique', twilightTime(sun.twilights.astronomique, 'setting', zone)),
        row('Nuit noire', sun.nightHours === null
          ? 'aucune ce jour'
          : formatDuration(sun.nightHours),
        sun.twilights.astronomique.reached === false
          ? 'le Soleil ne descend jamais sous −18°'
          : null),
      )),

    skyPath({
      track: ctx.sunTrack,
      current: { position: dayFraction(date, ctx), altitude: snapshot.altitude },
      label: 'du Soleil',
      color: 'var(--accent)',
    }),
    el('p', { class: 'figure-legende' },
      'Hauteur du Soleil au fil de la journée locale, de minuit à minuit.'));

    sections.soleil.replaceChildren(content);
  }

  function twilightTime(twilight, direction, zone) {
    if (twilight.reached === false) return 'n’a pas lieu';
    return timeOrDash(twilight[direction], zone);
  }

  function intervalLabel([from, to], zone) {
    if (!from || !to) return '—';
    return `${formatTime(from, zone)} → ${formatTime(to, zone)}`;
  }

  /* -------------------------------------------------------------- Lune */

  function renderMoon(date, place, zone, ctx) {
    const state = moonState(date, place);
    const snapshot = state.position;
    const orientation = moonLimbOrientation(date, place);
    const { moon } = ctx;
    const nextQuarter = nextMoonQuarters(date, 1)[0];
    const above = snapshot.altitude > -0.5;

    const content = card({
      title: 'Lune',
      subtitle: `${state.phaseName} · ${formatNumber(state.illuminatedFraction * 100, { digits: 0 })} % éclairée`,
      action: chip(above ? 'Visible' : 'Sous l’horizon', { tone: above ? 'azur' : 'neutre' }),
    },
    el('div', { class: 'bloc-lune' },
      moonDisc({
        phaseAngle: state.phaseAngle,
        waxing: state.waxing,
        orientation: above ? orientation : null,
        size: 116,
      }),
      el('div', { class: 'bloc-lune-donnees' },
        rows(
          row('Âge', `${formatNumber(state.age, { digits: 1 })} j`, `sur ${formatNumber(29.53, { digits: 2 })} j de lunaison`),
          row('Prochaine phase', nextQuarter.name, formatRelative(nextQuarter.date, date)),
          row('Distance', formatKm(state.distanceKm), `${formatSmallAngle(state.angularDiameter)} de diamètre`),
          row('Hauteur', formatDegrees(snapshot.altitude, 1), `azimut ${formatAzimuth(snapshot.azimuth)} · ${cardinalPoint(snapshot.azimuth)}`),
        ))),

    above ? el('p', { class: 'figure-legende' },
      'Le disque est orienté comme vous le voyez en levant les yeux : '
      + `le limbe éclairé pointe à ${formatDegrees(orientation, 0)} du zénith.`) : null,

    rows(
      row('Lever', timeOrDash(moon.rise, zone),
        moon.status === 'circumpolaire' ? 'ne se couche pas aujourd’hui' : null),
      row('Passage au méridien', timeOrDash(moon.transit, zone),
        moon.transitAltitude !== null ? `hauteur ${formatDegrees(moon.transitAltitude, 1)}` : null),
      row('Coucher', timeOrDash(moon.set, zone)),
      row('Magnitude', formatNumber(state.magnitude, { digits: 1 })),
    ),

    skyPath({
      track: ctx.moonTrack,
      current: { position: dayFraction(date, ctx), altitude: snapshot.altitude },
      label: 'de la Lune',
      color: 'var(--azur)',
    }));

    sections.lune.replaceChildren(content);
  }

  /* --------------------------------------------------------- planètes */

  function renderSky(date, place, zone) {
    const sun = bodySnapshot(Body.Sun, date, place);
    const entries = [...PLANETS, Body.Pluto]
      .map((body) => {
        const snapshot = bodySnapshot(body, date, place);
        return { body, snapshot, visibility: visibilityState(snapshot, sun) };
      })
      .sort((a, b) => b.snapshot.altitude - a.snapshot.altitude);

    const visible = entries.filter((entry) => entry.snapshot.altitude > -0.5);
    const hidden = entries.filter((entry) => entry.snapshot.altitude <= -0.5);

    const item = (entry) => listItem({
      leading: el('span', { class: 'point-corps', style: { background: planetColor(entry.body) } }),
      title: bodyName(entry.body),
      subtitle: `${entry.snapshot.constellation.name} · magnitude ${formatNumber(entry.snapshot.magnitude, { digits: 1 })}`
        + (entry.snapshot.angularDiameter ? ` · ${formatSmallAngle(entry.snapshot.angularDiameter)}` : ''),
      trailing: el('span', {},
        el('strong', {}, formatDegrees(entry.snapshot.altitude, 0)),
        el('br'),
        el('small', {}, cardinalPoint(entry.snapshot.azimuth))),
      onClick: () => { location.hash = `#/corps/${entry.body}`; },
    });

    sections.ciel.replaceChildren(card({},
      visible.length
        ? list(...visible.map(item))
        : notice('Aucune planète au-dessus de l’horizon en ce moment.'),
      visible.length
        ? notice(sun.altitude > -0.833
          ? 'Le Soleil est levé : seules les plus brillantes se devinent, aux jumelles et loin du Soleil.'
          : `Conditions : ${visible[0].visibility.label.toLowerCase()}.`)
        : null,
      hidden.length
        ? disclosure(`Sous l’horizon (${hidden.length})`, list(...hidden.map(item)))
        : null));
  }

  /* --------------------------------------------------------- repères */

  function renderMarkers(date, place, zone, ctx) {
    const sidereal = localSiderealTime(date, place);
    const eot = equationOfTime(date);
    const sun = bodySnapshot(Body.Sun, date, place);
    const subsolar = subastralPoint(Body.Sun, date);
    const submoon = subastralPoint(Body.Moon, date);

    sections.reperes.replaceChildren(card({},
      rows(
        row('Temps sidéral local', `${formatDuration(sidereal, { showSeconds: true })}`,
          'ascension droite qui passe au méridien'),
        row('Équation du temps', `${eot >= 0 ? '+' : '−'}${formatDuration(Math.abs(eot) / 60, { showSeconds: true })}`,
          eot >= 0 ? 'le cadran solaire avance sur la montre' : 'le cadran solaire retarde sur la montre'),
        row('Déclinaison du Soleil', formatDMS(sun.dec, { sign: true }),
          `${sun.dec >= 0 ? 'hémisphère nord' : 'hémisphère sud'} favorisé`),
        row('Point subsolaire', `${formatLatitude(subsolar.latitude)} · ${formatLongitude(subsolar.longitude)}`,
          'là où le Soleil est au zénith'),
        row('Point sublunaire', `${formatLatitude(submoon.latitude)} · ${formatLongitude(submoon.longitude)}`,
          'là où la Lune est au zénith'),
        row('Jour civil', formatDate(date, zone, { style: 'long' })),
      )));
  }

  /* ------------------------------------------------------------ cycle */

  function update() {
    const date = now();
    const place = observer();
    const zone = timeZone();
    const ctx = ensureContext(date, place, zone);
    renderSun(date, place, zone, ctx);
    renderMoon(date, place, zone, ctx);
    renderSky(date, place, zone);
    renderMarkers(date, place, zone, ctx);
  }

  let lastMinute = -1;

  return {
    update,
    tick(date) {
      // Les hauteurs bougent lentement : une actualisation par minute suffit,
      // sauf pour le curseur de la frise qui suit le battement de l'horloge.
      const minute = Math.floor(date.getTime() / 60000);
      if (minute !== lastMinute) {
        lastMinute = minute;
        update();
      }
    },
    refresh() {
      context = null;
      update();
    },
    destroy() { context = null; },
  };
}

const PLANET_COLORS = {
  Mercury: '#9c8f87', Venus: '#e6c48f', Mars: '#c1440e', Jupiter: '#d8a26a',
  Saturn: '#e3c07a', Uranus: '#9fd8e3', Neptune: '#4a6fd8', Pluto: '#c8b6a6',
};

const planetColor = (body) => PLANET_COLORS[body] ?? 'var(--texte-doux)';
