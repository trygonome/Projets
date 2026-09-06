/**
 * Fiches des corps du système solaire.
 *
 * Sans paramètre, la vue présente l'index illustré ; avec un identifiant, la
 * fiche détaillée du corps : position du moment, visibilité, données physiques
 * et orbitales, satellites et faits marquants.
 */
import {
  el, card, rows, row, stat, statGrid, chip, notice, heading, disclosure,
  table, list, listItem, button, meter,
} from '../ui/dom.js';
import { bodyGlobe } from '../ui/textures.js';
import { now, observer, timeZone, setTime } from '../core/state.js';
import {
  Body, bodySnapshot, dailyCircumstances, bodyName, visibilityState, moonState,
} from '../core/ephem.js';
import { Astronomy } from '../core/ephem.js';
import { planetaryAspectEvents, elongationEvents } from '../core/events.js';
import {
  SUN, PLANETS, DWARF_PLANETS, MOON, MOONS, bodyById,
} from '../data/bodies.js';
import { MS_PER_DAY } from '../core/time.js';
import {
  formatTime, formatDateTime, formatNumber, formatScientific, formatDegrees,
  formatSmallAngle, formatKm, formatAu, formatDistance, formatLightTime,
  formatPeriod, formatDuration, formatHMS, formatDMS, cardinalPoint, formatRelative,
} from '../core/format.js';

/** Corps dont l'éphéméride sait calculer une position. */
const EPHEMERIS_BODIES = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Earth', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

let landPolygons = null;
const globeCache = new Map();

async function ensureLand() {
  if (landPolygons !== null) return landPolygons;
  try {
    landPolygons = (await (await fetch('data/land.json')).json()).polygons;
  } catch {
    landPolygons = [];
  }
  return landPolygons;
}

/** Vignette sphérique d'un corps, mémorisée par taille. */
function globe(id, size) {
  const key = `${id}|${size}`;
  const provisional = id === 'Earth' && !landPolygons?.length;
  if (!globeCache.has(key)) {
    const rendered = bodyGlobe(id, { size, landPolygons });
    if (provisional) return rendered;
    globeCache.set(key, rendered);
  }
  const canvas = globeCache.get(key);
  const clone = canvas.cloneNode(true);
  clone.getContext('2d').drawImage(canvas, 0, 0);
  return clone;
}

export function mount(container, { navigate, params }) {
  let currentId = params?.[0] ?? null;
  const body = el('div', { style: { display: 'contents' } });
  container.append(body);

  /* -------------------------------------------------------------- index */

  function renderIndex() {
    const date = now();
    const place = observer();

    const tile = (entry) => el('button', {
      class: 'vignette-corps', type: 'button',
      onClick: () => navigate(`corps/${entry.id}`),
    },
    el('span', { class: 'vignette-globe-hote' }, globe(entry.id, 44)),
    el('span', { class: 'vignette-nom' }, entry.name),
    el('span', { class: 'vignette-detail' }, tileDetail(entry, date)));

    body.replaceChildren(
      card({
        class: 'carte--plate',
        title: 'Le système solaire',
        subtitle: 'Huit planètes, une étoile, cinq planètes naines reconnues et des centaines de lunes',
      }),
      heading('Étoile et planètes'),
      el('div', { class: 'grille-corps' },
        ...[SUN, ...PLANETS].map(tile)),
      heading('Satellite de la Terre'),
      el('div', { class: 'grille-corps' }, tile(MOON)),
      heading('Planètes naines'),
      el('div', { class: 'grille-corps' }, ...DWARF_PLANETS.map(tile)),
      heading('Lunes remarquables', 'Les mondes qui gravitent autour des planètes'),
      renderMoonIndex(),
      renderComparison(place, date),
    );
  }

  /**
   * Sous-titre d'une vignette : l'éclat du moment quand l'éphéméride le
   * connaît, la distance orbitale sinon.
   */
  function tileDetail(entry, date) {
    if (entry.id === 'Earth') return 'notre monde';
    if (entry.id === 'Sun' || EPHEMERIS_BODIES.has(entry.id)) {
      const magnitude = magnitudeLabel(entry.id, date);
      if (magnitude) return magnitude;
    }
    if (entry.orbit?.semiMajorAxisAu) {
      return `${formatAu(entry.orbit.semiMajorAxisAu, 1)} du Soleil`;
    }
    return entry.kind;
  }

  function magnitudeLabel(id, date) {
    try {
      const illumination = Astronomy.Illumination(id, date);
      return `magnitude ${formatNumber(illumination.mag, { digits: 1 })}`;
    } catch {
      return '';
    }
  }

  function renderMoonIndex() {
    const entries = [];
    for (const [host, moons] of Object.entries(MOONS)) {
      const hostBody = bodyById(host);
      for (const moon of moons) {
        if (moon.id === 'Moon') continue;
        entries.push({ host: hostBody?.name ?? host, moon });
      }
    }
    return card({},
      list(...entries.map(({ host, moon }) => listItem({
        leading: host[0],
        title: moon.name,
        subtitle: `${host} · rayon ${formatKm(moon.radius)} · période ${formatPeriod(Math.abs(moon.period))}`,
        trailing: moon.discovery ? moon.discovery.split(',').pop().trim() : '',
      }))));
  }

  /** Comparaison visuelle des tailles, ramenées au rayon terrestre. */
  function renderComparison(place, date) {
    const earth = PLANETS.find((planet) => planet.id === 'Earth');
    const bodies = [...PLANETS, MOON, ...DWARF_PLANETS.slice(0, 1)];
    const maximum = Math.max(...bodies.map((entry) => entry.physical.radius));

    return card({
      title: 'Tailles comparées',
      subtitle: 'Rayons rapportés à celui de la Terre',
    },
    el('div', { class: 'lignes' },
      ...bodies.map((entry) => el('div', { class: 'ligne' },
        el('span', { class: 'ligne-etiquette' }, entry.name),
        el('span', { style: { flex: '1', maxWidth: '52%' } },
          meter(entry.physical.radius / maximum, {
            tone: entry.id === 'Earth' ? 'accent' : 'azur',
          })),
        el('span', { class: 'ligne-valeur' },
          `× ${formatNumber(entry.physical.radius / earth.physical.radius, { digits: 2 })}`)))),
    void place, void date);
  }

  /* -------------------------------------------------------------- fiche */

  function renderSheet(id) {
    const data = bodyById(id);
    if (!data) { renderIndex(); return; }
    const date = now();
    const place = observer();
    const zone = timeZone();
    const isSun = id === 'Sun';
    const isMoon = id === 'Moon';
    const isEarth = id === 'Earth';
    const hasEphemeris = EPHEMERIS_BODIES.has(id);

    const parts = [
      el('div', { class: 'barre-boutons' },
        button('‹ Tous les corps', () => navigate('corps'), { variant: 'discret' })),
      renderHeader(data, id),
    ];

    if (hasEphemeris && !isEarth) parts.push(renderPosition(id, data, date, place, zone));
    if (isMoon) parts.push(renderMoonExtra(date, place));
    if (hasEphemeris && !isEarth && !isSun && !isMoon) {
      parts.push(heading('Rendez-vous à venir'), renderAspects(id, date, zone));
    }
    parts.push(heading('Données physiques'), renderPhysical(data, id));
    if (data.orbit) parts.push(heading('Orbite'), renderOrbit(data, id));
    if (data.atmosphere) parts.push(heading('Atmosphère'), renderAtmosphere(data));
    const moons = MOONS[id];
    if (moons?.length) parts.push(heading('Satellites'), renderMoons(moons));
    if (data.facts?.length) parts.push(heading('À retenir'), renderFacts(data));

    body.replaceChildren(...parts);
  }

  function renderHeader(data, id) {
    return card({},
      el('div', { class: 'fiche-entete' },
        el('span', { class: 'fiche-globe-hote' }, globe(id, 76)),
        el('div', {},
          el('div', { class: 'fiche-titre' }, `${data.symbol ?? ''} ${data.name}`.trim()),
          el('div', { class: 'fiche-genre' }, data.kind),
          data.discovery && data.discovery !== '—'
            ? el('div', { class: 'fiche-genre' }, `Découverte : ${data.discovery}`)
            : null)));
  }

  function renderPosition(id, data, date, place, zone) {
    const snapshot = bodySnapshot(id, date, place);
    const circumstances = dailyCircumstances(id, date, place, zone);
    const sun = bodySnapshot(Body.Sun, date, place);
    const visibility = id === 'Sun'
      ? { visible: snapshot.altitude > -0.833, label: snapshot.altitude > -0.833 ? 'Au-dessus de l’horizon' : 'Sous l’horizon' }
      : visibilityState(snapshot, sun);

    return card({
      title: 'En ce moment',
      subtitle: formatDateTime(date, zone),
      action: chip(visibility.label, { tone: visibility.visible ? 'vif' : 'neutre' }),
    },
    statGrid(
      stat('Hauteur', formatDegrees(snapshot.altitude, 1), { tone: 'accent' }),
      stat('Azimut', formatDegrees(snapshot.azimuth, 0), { hint: cardinalPoint(snapshot.azimuth) }),
      snapshot.magnitude !== null
        ? stat('Magnitude', formatNumber(snapshot.magnitude, { digits: 1 }))
        : stat('Constellation', snapshot.constellation.symbol),
    ),
    rows(
      row('Ascension droite', formatHMS(snapshot.ra, { digits: 1 })),
      row('Déclinaison', formatDMS(snapshot.dec, { sign: true, digits: 1 })),
      row('Constellation', snapshot.constellation.name, snapshot.constellation.latin),
      row('Distance à la Terre', formatDistance(snapshot.distanceKm),
        `la lumière met ${formatLightTime(snapshot.distanceKm)}`),
      snapshot.helioDistanceAu !== null
        ? row('Distance au Soleil', formatAu(snapshot.helioDistanceAu, 4),
          formatKm(snapshot.helioDistanceAu * 149597870.7))
        : null,
      snapshot.angularDiameter
        ? row('Diamètre apparent', formatSmallAngle(snapshot.angularDiameter))
        : null,
      snapshot.phaseFraction !== null && id !== 'Sun'
        ? row('Phase', `${formatNumber(snapshot.phaseFraction * 100, { digits: 0 })} % éclairée`,
          `angle de phase ${formatDegrees(snapshot.phaseAngle, 1)}`)
        : null,
      snapshot.elongation !== null
        ? row('Élongation solaire', formatDegrees(snapshot.elongation, 1),
          snapshot.elongation < 15 ? 'trop près du Soleil pour être observé' : null)
        : null,
      snapshot.ringTilt !== null && snapshot.ringTilt !== undefined
        ? row('Inclinaison des anneaux', formatDegrees(snapshot.ringTilt, 2),
          Math.abs(snapshot.ringTilt) < 1 ? 'anneaux vus par la tranche' : null)
        : null,
    ),
    circumstances.status === 'circumpolaire'
      ? notice('Circumpolaire aujourd’hui : ce corps ne se couche pas.')
      : circumstances.status === 'jamais-leve'
        ? notice('Ce corps ne se lève pas aujourd’hui depuis votre position.')
        : rows(
          row('Lever', circumstances.rise ? formatTime(circumstances.rise, zone) : '—'),
          row('Passage au méridien', circumstances.transit ? formatTime(circumstances.transit, zone) : '—',
            circumstances.transitAltitude !== null ? `hauteur ${formatDegrees(circumstances.transitAltitude, 1)}` : null),
          row('Coucher', circumstances.set ? formatTime(circumstances.set, zone) : '—'),
          row('Temps au-dessus de l’horizon',
            circumstances.visibleHours === null ? '—' : formatDuration(circumstances.visibleHours)),
        ),
    void data);
  }

  function renderMoonExtra(date, place) {
    const state = moonState(date, place);
    return card({ title: 'Phase et librations' },
      rows(
        row('Phase', state.phaseName,
          `${formatNumber(state.illuminatedFraction * 100, { digits: 1 })} % éclairée`),
        row('Âge de la lunaison', `${formatNumber(state.age, { digits: 2 })} j`),
        row('Libration en longitude', formatDegrees(state.libration.longitude, 2)),
        row('Libration en latitude', formatDegrees(state.libration.latitude, 2)),
      ),
      button('Voir les cycles lunaires', () => navigate('cycles/lune')));
  }

  function renderAspects(id, date, zone) {
    const horizon = new Date(date.getTime() + 900 * MS_PER_DAY);
    const aspects = planetaryAspectEvents(date, horizon)
      .filter((event) => event.body === id);
    const elongations = ['Mercury', 'Venus'].includes(id)
      ? elongationEvents(date, horizon).filter((event) => event.body === id)
      : [];
    const events = [...aspects, ...elongations].sort((a, b) => a.date - b.date);

    return card({},
      events.length
        ? list(...events.slice(0, 6).map((event) => listItem({
          leading: event.kind === 'opposition' ? '⚹' : event.kind === 'elongation' ? '↔' : '☌',
          title: event.title,
          subtitle: `${formatDateTime(event.date, zone)} · ${event.detail}`,
          trailing: formatRelative(event.date, date),
          onClick: () => setTime(event.date),
        })))
        : notice('Aucun rendez-vous notable dans les deux prochaines années.'));
  }

  function renderPhysical(data, id) {
    const physical = data.physical;
    const earth = PLANETS.find((planet) => planet.id === 'Earth').physical;
    const relative = (value, reference, digits = 2) =>
      value ? `× ${formatNumber(value / reference, { digits })} la Terre` : null;

    return card({},
      rows(
        row('Rayon équatorial', formatKm(physical.radius),
          id === 'Earth' ? null : relative(physical.radius, earth.radius)),
        physical.polarRadius && physical.polarRadius !== physical.radius
          ? row('Rayon polaire', formatKm(physical.polarRadius),
            `aplatissement ${formatNumber((1 - physical.polarRadius / physical.radius) * 100, { digits: 2 })} %`)
          : null,
        row('Masse', `${formatScientific(physical.mass)} kg`,
          id === 'Earth' ? null : relative(physical.mass, earth.mass, 3)),
        physical.density ? row('Masse volumique', `${formatNumber(physical.density)} kg/m³`,
          physical.density < 1000 ? 'moins dense que l’eau' : null) : null,
        physical.gravity ? row('Pesanteur de surface', `${formatNumber(physical.gravity, { digits: 2 })} m/s²`,
          id === 'Earth' ? null : `un poids de 70 kg y pèserait ${formatNumber(70 * physical.gravity / 9.807, { digits: 0 })} kg`) : null,
        physical.escapeVelocity
          ? row('Vitesse de libération', `${formatNumber(physical.escapeVelocity, { digits: 2 })} km/s`) : null,
        physical.rotationPeriod
          ? row('Rotation sidérale', formatPeriod(Math.abs(physical.rotationPeriod)),
            physical.rotationPeriod < 0 ? 'rétrograde : le Soleil s’y lève à l’ouest' : null) : null,
        physical.solarDay && Math.abs(physical.solarDay - Math.abs(physical.rotationPeriod)) > 0.01
          ? row('Jour solaire', formatPeriod(physical.solarDay), 'du midi au midi suivant') : null,
        physical.obliquity !== undefined
          ? row('Obliquité', formatDegrees(physical.obliquity, 2), obliquityNote(physical.obliquity)) : null,
        physical.albedo ? row('Albédo', formatNumber(physical.albedo, { digits: 3 }),
          `${formatNumber(physical.albedo * 100, { digits: 0 })} % de la lumière renvoyée`) : null,
        physical.temperatureMean !== undefined && physical.temperatureMean !== null
          ? row('Température moyenne', `${formatNumber(physical.temperatureMean)} °C`,
            physical.temperatureMin !== null && physical.temperatureMin !== undefined
              ? `de ${formatNumber(physical.temperatureMin)} à ${formatNumber(physical.temperatureMax)} °C` : null)
          : null,
        physical.surfaceTemperature
          ? row('Température de surface', `${formatNumber(physical.surfaceTemperature)} °C`) : null,
        physical.luminosity
          ? row('Puissance rayonnée', `${formatScientific(physical.luminosity)} W`) : null,
        data.moons !== undefined ? row('Satellites connus', formatNumber(data.moons)) : null,
        data.rings !== undefined ? row('Anneaux', data.rings ? 'oui' : 'non') : null,
      ));
  }

  function obliquityNote(obliquity) {
    if (obliquity > 150) return 'axe presque retourné';
    if (obliquity > 80) return 'axe couché sur l’orbite : saisons extrêmes';
    if (obliquity < 3) return 'axe presque droit : pas de saisons marquées';
    return 'à l’origine des saisons';
  }

  function renderOrbit(data, id) {
    const orbit = data.orbit;
    return card({},
      rows(
        orbit.semiMajorAxisAu
          ? row('Demi-grand axe', formatAu(orbit.semiMajorAxisAu, 6), formatKm(orbit.semiMajorAxisKm))
          : row('Demi-grand axe', formatKm(orbit.semiMajorAxisKm)),
        orbit.perihelionAu
          ? row('Périhélie / aphélie',
            `${formatAu(orbit.perihelionAu, 4)} — ${formatAu(orbit.aphelionAu, 4)}`,
            `variation de ${formatNumber((orbit.aphelionAu / orbit.perihelionAu - 1) * 100, { digits: 1 })} %`)
          : null,
        orbit.perigeeKm
          ? row('Périgée / apogée', `${formatKm(orbit.perigeeKm)} — ${formatKm(orbit.apogeeKm)}`)
          : null,
        row('Excentricité', formatNumber(orbit.eccentricity, { digits: 5 }),
          orbit.eccentricity > 0.1 ? 'orbite nettement elliptique' : 'orbite presque circulaire'),
        row('Inclinaison', formatDegrees(orbit.inclination, 3),
          id === 'Earth' ? 'plan de référence' : 'sur l’écliptique'),
        orbit.period ? row('Période de révolution', formatPeriod(orbit.period),
          orbit.period > 400 ? `${formatNumber(orbit.period / 365.25, { digits: 2 })} années terrestres` : null) : null,
        orbit.synodicPeriod
          ? row('Période synodique', formatPeriod(orbit.synodicPeriod),
            'retour de la même configuration vue de la Terre') : null,
        orbit.siderealMonth
          ? row('Mois sidéral', `${formatNumber(orbit.siderealMonth, { digits: 6 })} j`) : null,
        orbit.synodicMonth
          ? row('Mois synodique', `${formatNumber(orbit.synodicMonth, { digits: 6 })} j`,
            'retour de la même phase') : null,
        orbit.orbitalSpeed
          ? row('Vitesse orbitale', `${formatNumber(orbit.orbitalSpeed, { digits: 2 })} km/s`,
            `${formatNumber(orbit.orbitalSpeed * 3600)} km/h`) : null,
      ));
  }

  function renderAtmosphere(data) {
    const { pressure, composition } = data.atmosphere;
    const total = composition.reduce((sum, [, share]) => sum + share, 0);
    return card({},
      pressure !== null && pressure !== undefined
        ? rows(row('Pression au sol',
          pressure < 0.001
            ? `${formatScientific(pressure)} bar`
            : `${formatNumber(pressure, { digits: pressure < 10 ? 4 : 0 })} bar`,
          pressure > 2 ? `× ${formatNumber(pressure / 1.014, { digits: 0 })} la pression terrestre`
            : pressure < 0.5 && pressure > 0 ? `${formatNumber(pressure / 1.014 * 100, { digits: 2 })} % de la pression terrestre` : null))
        : notice('Pas de surface définie : la pression augmente continûment avec la profondeur.'),
      el('div', { class: 'lignes' },
        ...composition.map(([name, share]) => el('div', { class: 'ligne' },
          el('span', { class: 'ligne-etiquette' }, name),
          el('span', { style: { flex: '1', maxWidth: '46%' } }, meter(share / total, { tone: 'azur' })),
          el('span', { class: 'ligne-valeur' }, `${formatNumber(share, { digits: share < 1 ? 2 : 1 })} %`)))));
  }

  function renderMoons(moons) {
    return card({},
      table(
        ['Lune', 'Rayon', 'Demi-grand axe', 'Période'],
        moons.map((moon) => [
          moon.name,
          formatKm(moon.radius),
          formatKm(moon.semiMajorAxisKm),
          formatPeriod(Math.abs(moon.period)),
        ]),
      ),
      ...moons.filter((moon) => moon.note).map((moon) =>
        disclosure(moon.name, el('p', { class: 'texte' }, moon.note),
          notice(`Découverte : ${moon.discovery}`))));
  }

  function renderFacts(data) {
    return card({},
      el('ul', { class: 'article' }, ...data.facts.map((fact) => el('li', {}, fact))));
  }

  /* ------------------------------------------------------------- cycle */

  function update() {
    if (currentId) renderSheet(currentId);
    else renderIndex();
  }

  (async () => {
    await ensureLand();
    // Le premier rendu a pu se faire sans les contours : on le refait une fois
    // les données disponibles pour que la Terre reçoive sa vraie surface.
    globeCache.delete('Earth|44');
    globeCache.delete('Earth|76');
    update();
  })();

  return {
    update,
    setParams(params) {
      currentId = params?.[0] ?? null;
      update();
      container.scrollTop = 0;
      window.scrollTo(0, 0);
    },
    refresh() { update(); },
  };
}
