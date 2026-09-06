/**
 * Cohérence des jeux de données embarqués et du formatage : ce sont les deux
 * endroits où une erreur passe le plus facilement inaperçue.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PLACES, searchPlaces, nearestPlace, foldText } from '../app/js/data/places.js';
import { CONSTELLATION_NAMES, constellationName } from '../app/js/data/constellations-noms.js';
import {
  PLANETS, DWARF_PLANETS, MOONS, SUN, MOON, CYCLES, BODY_RADIUS_KM, bodyById,
} from '../app/js/data/bodies.js';
import { ARTICLES } from '../app/js/data/savoir.js';
import { METEOR_SHOWERS } from '../app/js/core/events.js';
import {
  formatDMS, formatHMS, formatDuration, formatSignedDuration, formatAzimuth,
  formatScientific, formatDistance, formatSmallAngle, cardinalPoint,
  timeZoneOffsetMinutes, formatNumber,
} from '../app/js/core/format.js';
import {
  startOfLocalDay, startOfNextLocalDay, addLocalDays, dayOfYear, julianDate,
} from '../app/js/core/time.js';
import { orientationToAim } from '../app/js/core/boussole.js';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));

/* ------------------------------------------------------------ catalogues */

test('le catalogue d’étoiles est trié par éclat et bien formé', async () => {
  const data = await readJson('../app/data/stars.json');
  assert.ok(data.stars.length > 4000, `${data.stars.length} étoiles`);
  for (let i = 1; i < data.stars.length; i += 1) {
    assert.ok(data.stars[i][2] >= data.stars[i - 1][2],
      `tri rompu à l’indice ${i}`);
  }
  for (const [ra, dec, mag] of data.stars) {
    assert.ok(ra >= 0 && ra < 360, `ascension droite ${ra}`);
    assert.ok(dec >= -90 && dec <= 90, `déclinaison ${dec}`);
    assert.ok(mag >= -2 && mag <= 6.5, `magnitude ${mag}`);
  }
});

test('Sirius ouvre le catalogue avec sa magnitude connue', async () => {
  const data = await readJson('../app/data/stars.json');
  const [ra, dec, mag] = data.stars[0];
  assert.deepEqual(data.labels['0'], ['Sirius', 'α CMa']);
  assert.ok(Math.abs(mag + 1.44) < 0.02, `magnitude ${mag}`);
  assert.ok(Math.abs(ra - 101.287) < 0.01 && Math.abs(dec + 16.716) < 0.01);
});

test('les 88 constellations ont un nom français et des figures', async () => {
  const constellations = await readJson('../app/data/constellations.json');
  assert.equal(Object.keys(CONSTELLATION_NAMES).length, 88);
  assert.equal(constellations.length, 88);
  for (const constellation of constellations) {
    assert.ok(constellation.lines.length > 0, `${constellation.id} sans figure`);
    assert.ok(constellation.fr && constellation.fr !== constellation.id,
      `${constellation.id} sans nom français`);
  }
  assert.equal(constellationName('UMa'), 'Grande Ourse');
  assert.equal(constellationName('Ori'), 'Orion');
  assert.equal(constellationName('inconnue'), 'inconnue');
});

test('les objets Messier sont numérotés de 1 à 110 sans trou', async () => {
  const objets = await readJson('../app/data/deepsky.json');
  assert.equal(objets.length, 110);
  objets.forEach((objet, index) => {
    assert.equal(objet.id, `M${index + 1}`);
    assert.ok(objet.ra >= 0 && objet.ra < 360);
    assert.ok(objet.dec >= -90 && objet.dec <= 90);
  });
});

test('aucun nom d’objet du ciel profond n’est resté en anglais', async () => {
  const objets = await readJson('../app/data/deepsky.json');
  const suspects = objets.filter((objet) => /\b(Cluster|Nebula|Galaxy)\b/.test(objet.name));
  assert.deepEqual(suspects.map((o) => o.name), []);
});

test('les contours terrestres forment des anneaux fermés cohérents', async () => {
  const terre = await readJson('../app/data/land.json');
  assert.ok(terre.polygons.length > 100);
  for (const rings of terre.polygons) {
    for (const ring of rings) {
      assert.ok(ring.length > 3);
      for (const [lon, lat] of ring) {
        assert.ok(lon >= -180.01 && lon <= 180.01, `longitude ${lon}`);
        assert.ok(lat >= -90.01 && lat <= 90.01, `latitude ${lat}`);
      }
    }
  }
});

/* ---------------------------------------------------------------- lieux */

test('tous les lieux ont des coordonnées et un fuseau valides', () => {
  for (const place of PLACES) {
    assert.ok(Math.abs(place.latitude) <= 90, `${place.name} : latitude`);
    assert.ok(Math.abs(place.longitude) <= 180, `${place.name} : longitude`);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('fr', { timeZone: place.timeZone }),
      `${place.name} : fuseau ${place.timeZone}`);
  }
});

test('la recherche de lieux ignore accents, ligatures et casse', () => {
  assert.ok(searchPlaces('quebec').some((place) => place.name === 'Québec'));
  assert.ok(searchPlaces('NOUMEA').some((place) => place.name === 'Nouméa'));
  assert.ok(searchPlaces('sao paulo').some((place) => place.name === 'São Paulo'));
  assert.ok(searchPlaces('cote d ivoire').some((place) => place.region.includes('Ivoire')));
  // Le « ø » ne se décompose pas en NFD : sans table explicite, Tromsø
  // resterait introuvable à qui tape « tromso ».
  assert.ok(searchPlaces('tromso').some((place) => place.name === 'Tromsø'));
  assert.equal(foldText('Tromsø'), 'tromso');
  assert.equal(foldText('Côte d’Ivoire'), 'cote d ivoire');
  assert.equal(foldText('Saint-Denis'), 'saint denis');
});

test('le lieu le plus proche est bien celui attendu', () => {
  const { place, distanceKm } = nearestPlace(45.75, 4.85);
  assert.equal(place.name, 'Lyon');
  assert.ok(distanceKm < 5, `${distanceKm} km`);
});

/* ------------------------------------------------------- corps célestes */

test('les données planétaires sont physiquement cohérentes', () => {
  for (const planet of [...PLANETS, ...DWARF_PLANETS]) {
    const { physical, orbit } = planet;
    assert.ok(physical.radius > 0, `${planet.name} : rayon`);
    assert.ok(physical.mass > 0, `${planet.name} : masse`);

    // La masse volumique doit correspondre au volume de l'ellipsoïde de
    // révolution : pour Saturne, aplatie de 10 %, la formule sphérique se
    // tromperait de dix pour cent.
    if (physical.density) {
      const a = physical.radius * 1000;
      const c = (physical.polarRadius ?? physical.radius) * 1000;
      const volume = (4 / 3) * Math.PI * a * a * c;
      const calculee = physical.mass / volume;
      assert.ok(Math.abs(calculee - physical.density) / physical.density < 0.08,
        `${planet.name} : densité annoncée ${physical.density}, calculée ${calculee.toFixed(0)}`);
    }

    // La pesanteur de surface doit découler de la masse et du rayon.
    if (physical.gravity) {
      const g = 6.674e-11 * physical.mass / (physical.radius * 1000) ** 2;
      assert.ok(Math.abs(g - physical.gravity) / physical.gravity < 0.06,
        `${planet.name} : pesanteur annoncée ${physical.gravity}, calculée ${g.toFixed(2)}`);
    }

    // Périhélie et aphélie doivent encadrer le demi-grand axe.
    if (orbit?.perihelionAu) {
      assert.ok(orbit.perihelionAu < orbit.semiMajorAxisAu, `${planet.name} : périhélie`);
      assert.ok(orbit.aphelionAu > orbit.semiMajorAxisAu, `${planet.name} : aphélie`);
      const excentricite = (orbit.aphelionAu - orbit.perihelionAu)
        / (orbit.aphelionAu + orbit.perihelionAu);
      assert.ok(Math.abs(excentricite - orbit.eccentricity) < 0.005,
        `${planet.name} : excentricité ${orbit.eccentricity} contre ${excentricite.toFixed(5)}`);
    }
  }
});

test('la troisième loi de Kepler se vérifie sur les huit planètes', () => {
  for (const planet of PLANETS) {
    const annees = planet.orbit.period / 365.25636;
    const rapport = annees ** 2 / planet.orbit.semiMajorAxisAu ** 3;
    assert.ok(Math.abs(rapport - 1) < 0.005,
      `${planet.name} : T²/a³ = ${rapport.toFixed(4)}`);
  }
});

test('la troisième loi se vérifie aussi sur les lunes galiléennes', () => {
  const masseJupiter = PLANETS.find((p) => p.id === 'Jupiter').physical.mass;
  const G = 6.674e-11;
  for (const moon of MOONS.Jupiter) {
    const a = moon.semiMajorAxisKm * 1000;
    const periodeCalculee = 2 * Math.PI * Math.sqrt(a ** 3 / (G * masseJupiter)) / 86400;
    assert.ok(Math.abs(periodeCalculee - moon.period) / moon.period < 0.01,
      `${moon.name} : période ${moon.period} j contre ${periodeCalculee.toFixed(3)} j`);
  }
});

test('les rayons utilisés pour les diamètres apparents suivent les fiches', () => {
  for (const [id, radius] of Object.entries(BODY_RADIUS_KM)) {
    const body = bodyById(id);
    if (!body) continue;
    assert.ok(Math.abs(body.physical.radius - radius) < 1,
      `${id} : ${body.physical.radius} contre ${radius}`);
  }
});

test('les périodes fondamentales sont exactes à la seconde près', () => {
  assert.ok(Math.abs(CYCLES.synodicMonth - 29.530588853) < 1e-6);
  assert.ok(Math.abs(CYCLES.siderealMonth - 27.321661) < 1e-5);
  assert.ok(Math.abs(CYCLES.tropicalYear - 365.24219) < 1e-4);
  // Le saros doit tomber juste sur 223 lunaisons.
  assert.ok(Math.abs(CYCLES.saros - 223 * CYCLES.synodicMonth) < 0.01);
  // Le cycle de Méton vaut 235 lunaisons, à quelques heures près de 19 années.
  assert.ok(Math.abs(235 * CYCLES.synodicMonth - 19 * CYCLES.tropicalYear) < 0.1);
});

test('le Soleil et la Lune portent leurs valeurs de référence', () => {
  assert.equal(SUN.physical.radius, 695700);
  assert.equal(MOON.orbit.semiMajorAxisKm, 384399);
  assert.ok(MOON.orbit.perigeeKm < MOON.orbit.semiMajorAxisKm);
  assert.ok(MOON.orbit.apogeeKm > MOON.orbit.semiMajorAxisKm);
});

test('les essaims de météores sont datés et localisés', () => {
  assert.ok(METEOR_SHOWERS.length >= 10);
  for (const shower of METEOR_SHOWERS) {
    assert.ok(shower.month >= 1 && shower.month <= 12, shower.name);
    assert.ok(shower.day >= 1 && shower.day <= 31, shower.name);
    assert.ok(shower.radiantRa >= 0 && shower.radiantRa < 360, shower.name);
    assert.ok(Math.abs(shower.radiantDec) <= 90, shower.name);
    assert.ok(shower.zhr > 0, shower.name);
  }
});

/* --------------------------------------------------------------- savoir */

test('les articles ont un identifiant unique et du contenu', () => {
  const identifiants = new Set();
  for (const article of ARTICLES) {
    assert.ok(!identifiants.has(article.id), `identifiant en double : ${article.id}`);
    identifiants.add(article.id);
    assert.ok(article.title && article.summary, article.id);
    assert.ok(article.blocks.length > 0, article.id);
    for (const block of article.blocks) {
      assert.ok(['p', 'h', 'ul', 'formula', 'facts'].includes(block.type),
        `${article.id} : bloc de type ${block.type}`);
    }
  }
});

/* ------------------------------------------------------------ formatage */

test('les angles se formatent selon les usages français', () => {
  assert.equal(formatDMS(23.4393, { digits: 1, sign: true }), '+23° 26′ 21,5″');
  assert.equal(formatDMS(-16.7161), '−16° 42′ 58″');
  assert.equal(formatHMS(101.2872, { digits: 1 }), '6 h 45 min 08,9 s');
  assert.equal(formatAzimuth(359.7), '0°');
  assert.equal(formatAzimuth(180.4), '180°');
  assert.equal(cardinalPoint(0), 'N');
  assert.equal(cardinalPoint(225), 'SO');
  assert.equal(cardinalPoint(90), 'E');
});

test('durées et distances restent lisibles à toutes les échelles', () => {
  assert.equal(formatDuration(13.1333), '13 h 08 min');
  assert.equal(formatSignedDuration(-210), '−3 min 30 s');
  assert.equal(formatSignedDuration(45), '+45 s');
  assert.equal(formatScientific(1.9885e30), '1,989 × 10³⁰');
  assert.ok(formatDistance(384399).startsWith('384'));
  assert.ok(formatDistance(1.496e8).includes('ua'));
  assert.ok(formatDistance(4.1e13).endsWith('al'));
  assert.equal(formatSmallAngle(0.5), '30,0′');
  assert.equal(formatNumber(1234.5, { digits: 1 }), '1 234,5');
});

/* ---------------------------------------------------------------- temps */

test('les bornes du jour local encadrent bien la journée civile', () => {
  const zone = 'Europe/Paris';
  const date = new Date('2026-07-14T15:00:00Z');
  const debut = startOfLocalDay(date, zone);
  const fin = startOfNextLocalDay(date, zone);
  assert.ok(debut < date && date < fin);
  assert.equal((fin - debut) / 3600000, 24);
});

test('les changements d’heure donnent des jours de 23 et 25 heures', () => {
  const zone = 'Europe/Paris';
  const printemps = new Date('2026-03-29T12:00:00Z');
  const automne = new Date('2026-10-25T12:00:00Z');
  assert.equal(
    (startOfNextLocalDay(printemps, zone) - startOfLocalDay(printemps, zone)) / 3600000, 23);
  assert.equal(
    (startOfNextLocalDay(automne, zone) - startOfLocalDay(automne, zone)) / 3600000, 25);
});

test('le décalage horaire suit l’heure d’été', () => {
  assert.equal(timeZoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/Paris'), 60);
  assert.equal(timeZoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/Paris'), 120);
  assert.equal(timeZoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'UTC'), 0);
  assert.equal(timeZoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Pacific/Noumea'), 660);
});

test('le quantième et la date julienne sont exacts', () => {
  assert.equal(julianDate(new Date('2000-01-01T12:00:00Z')), 2451545);
  assert.equal(dayOfYear(new Date('2026-01-01T12:00:00Z'), 'Europe/Paris'), 1);
  assert.equal(dayOfYear(new Date('2026-12-31T12:00:00Z'), 'Europe/Paris'), 365);
  assert.equal(dayOfYear(new Date('2028-12-31T12:00:00Z'), 'Europe/Paris'), 366);
  // Minuit à Paris le 1er janvier appartient encore au 31 décembre à Londres.
  assert.equal(dayOfYear(new Date('2025-12-31T23:30:00Z'), 'Europe/Paris'), 1);
  assert.equal(dayOfYear(new Date('2025-12-31T23:30:00Z'), 'Europe/London'), 365);
});

/* ------------------------------------------------------------- boussole */

test('l’orientation de l’appareil se traduit en visée du ciel', () => {
  // Le dos du téléphone est la direction visée : à plat, écran vers le haut,
  // il regarde le sol.
  const aPlat = orientationToAim(0, 0, 0);
  assert.ok(Math.abs(aPlat.altitude + 90) < 0.01, `à plat : ${aPlat.altitude}°`);

  // Écran vers le bas : le dos regarde le zénith.
  const retourne = orientationToAim(0, 180, 0);
  assert.ok(Math.abs(retourne.altitude - 90) < 0.01, `retourné : ${retourne.altitude}°`);

  // Téléphone vertical : la visée est à l'horizon, dans la direction du cap.
  for (const [alpha, azimutAttendu] of [[0, 0], [270, 90], [180, 180], [90, 270]]) {
    const vise = orientationToAim(alpha, 90, 0);
    assert.ok(Math.abs(vise.altitude) < 0.01, `hauteur ${vise.altitude}°`);
    assert.ok(Math.abs(vise.azimuth - azimutAttendu) < 0.01,
      `alpha ${alpha}° → azimut ${vise.azimuth}°, attendu ${azimutAttendu}°`);
  }

  // Incliné de 45° vers l'arrière depuis la verticale, dos vers le nord.
  const incline = orientationToAim(0, 135, 0);
  assert.ok(Math.abs(incline.altitude - 45) < 0.01, `incliné : ${incline.altitude}°`);
  assert.ok(Math.abs(incline.azimuth) < 0.01, `incliné : azimut ${incline.azimuth}°`);
});

test('le décalage d’un nombre de jours civils reste ancré sur minuit', () => {
  const zone = 'America/New_York';
  const depart = new Date('2026-11-01T10:00:00Z');
  const suivant = addLocalDays(depart, 7, zone);
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(suivant);
  assert.equal(parts, '00:00');
});
