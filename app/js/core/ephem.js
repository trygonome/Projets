/**
 * Couche éphémérides : traduit les primitives d'Astronomy Engine en grandeurs
 * directement affichables (position instantanée, circonstances du jour,
 * visibilité, points subastraux).
 *
 * Convention : toutes les positions apparentes sont géocentriques puis
 * topocentriques, corrigées de l'aberration ; les altitudes sont corrigées de
 * la réfraction lorsque l'observateur regarde réellement le ciel.
 */
import * as Astronomy from '../../vendor/astronomy.js';
import { BODY_RADIUS_KM } from '../data/bodies.js';
import { constellationName } from '../data/constellations-noms.js';
import { startOfLocalDay, startOfNextLocalDay, MS_PER_DAY } from './time.js';
import { normalize360 } from './format.js';

export const Body = Astronomy.Body;

/** Corps que l'application suit systématiquement. */
export const PLANETS = [
  Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter,
  Body.Saturn, Body.Uranus, Body.Neptune,
];

export const LUMINARIES = [Body.Sun, Body.Moon];
export const TRACKED_BODIES = [...LUMINARIES, ...PLANETS, Body.Pluto];

/** Noms français des corps, utilisés partout dans l'interface. */
export const BODY_NAMES = {
  Sun: 'Soleil', Moon: 'Lune', Mercury: 'Mercure', Venus: 'Vénus',
  Earth: 'Terre', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturne',
  Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluton',
};

export const bodyName = (body) => BODY_NAMES[body] ?? body;

const DEG = 180 / Math.PI;

/** Construit l'observateur Astronomy Engine à partir de l'état applicatif. */
export function astroObserver(observer) {
  return new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.height ?? 0,
  );
}

/* -------------------------------------------------- position instantanée */

/** Diamètre apparent en degrés d'un corps de rayon connu vu à `distanceKm`. */
export function angularDiameter(body, distanceKm) {
  const radius = BODY_RADIUS_KM[body];
  if (!radius || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  return 2 * Math.atan(radius / distanceKm) * DEG;
}

/**
 * Instantané complet d'un corps : coordonnées équatoriales et horizontales,
 * distances, éclat, phase, constellation.
 */
export function bodySnapshot(body, date, observer, { refraction = 'normal' } = {}) {
  const obs = astroObserver(observer);
  const equatorial = Astronomy.Equator(body, date, obs, true, true);
  const horizontal = Astronomy.Horizon(
    date, obs, equatorial.ra, equatorial.dec, refraction,
  );
  const distanceKm = equatorial.dist * Astronomy.KM_PER_AU;

  const snapshot = {
    body,
    name: bodyName(body),
    time: date,
    ra: equatorial.ra * 15, // heures → degrés
    raHours: equatorial.ra,
    dec: equatorial.dec,
    azimuth: horizontal.azimuth,
    altitude: horizontal.altitude,
    altitudeGeometric: Astronomy.Horizon(
      date, obs, equatorial.ra, equatorial.dec, null,
    ).altitude,
    distanceAu: equatorial.dist,
    distanceKm,
    angularDiameter: angularDiameter(body, distanceKm),
    constellation: null,
    magnitude: null,
    phaseAngle: null,
    phaseFraction: null,
    elongation: null,
    helioDistanceAu: null,
    ringTilt: null,
  };

  const constellation = Astronomy.Constellation(equatorial.ra, equatorial.dec);
  snapshot.constellation = {
    symbol: constellation.symbol,
    latin: constellation.name,
    name: constellationName(constellation.symbol),
  };

  if (body !== Body.Earth) {
    try {
      const illumination = Astronomy.Illumination(body, date);
      snapshot.magnitude = illumination.mag;
      snapshot.phaseAngle = illumination.phase_angle;
      snapshot.phaseFraction = illumination.phase_fraction;
      snapshot.helioDistanceAu = illumination.helio_dist;
      snapshot.ringTilt = illumination.ring_tilt ?? null;
    } catch {
      /* Illumination n'est pas définie pour tous les corps */
    }
  }

  if (body !== Body.Sun && body !== Body.Earth) {
    try {
      snapshot.elongation = Astronomy.Elongation(body, date).elongation;
    } catch {
      /* élongation indisponible */
    }
  }

  if (body === Body.Moon) {
    const libration = Astronomy.Libration(date);
    snapshot.angularDiameter = libration.diam_deg;
    snapshot.libration = {
      longitude: libration.elon,
      latitude: libration.elat,
      subEarthLongitude: libration.mlon,
      subEarthLatitude: libration.mlat,
      distanceKm: libration.dist_km,
    };
    snapshot.phaseDegrees = Astronomy.MoonPhase(date);
  }

  return snapshot;
}

/** Temps sidéral local apparent, en heures. */
export function localSiderealTime(date, observer) {
  const greenwich = Astronomy.SiderealTime(date);
  return ((greenwich + observer.longitude / 15) % 24 + 24) % 24;
}

/** Angle horaire d'un corps, en heures (négatif avant le passage au méridien). */
export function hourAngle(body, date, observer) {
  const value = Astronomy.HourAngle(body, date, astroObserver(observer));
  return value > 12 ? value - 24 : value;
}

/* ------------------------------------------------- circonstances du jour */

const DIRECTION_RISE = +1;
const DIRECTION_SET = -1;

/**
 * Lever, coucher et passage au méridien pour le jour civil local contenant
 * `date`. Les corps circumpolaires ou jamais levés renvoient un statut
 * explicite plutôt que des valeurs nulles muettes.
 */
export function dailyCircumstances(body, date, observer, timeZone) {
  const obs = astroObserver(observer);
  const start = startOfLocalDay(date, timeZone);
  const end = startOfNextLocalDay(date, timeZone);
  const span = (end - start) / MS_PER_DAY;

  const rise = Astronomy.SearchRiseSet(body, obs, DIRECTION_RISE, start, span);
  const set = Astronomy.SearchRiseSet(body, obs, DIRECTION_SET, start, span);

  let transit = null;
  let transitAltitude = null;
  let antitransitAltitude = null;
  try {
    const event = Astronomy.SearchHourAngle(body, obs, 0, start);
    if (event.time.date <= end) {
      transit = event.time.date;
      transitAltitude = event.hor.altitude;
    } else {
      transitAltitude = Astronomy.SearchHourAngle(body, obs, 0, start).hor.altitude;
    }
    const opposite = Astronomy.SearchHourAngle(body, obs, 12, start);
    antitransitAltitude = opposite.hor.altitude;
  } catch {
    /* recherche impossible : laissé à null */
  }

  let status = 'normal';
  if (!rise && !set) {
    status = (antitransitAltitude ?? -90) > 0 ? 'circumpolaire' : 'jamais-leve';
  }

  const riseDate = rise?.date ?? null;
  const setDate = set?.date ?? null;
  let visibleHours = null;
  if (status === 'circumpolaire') visibleHours = span * 24;
  else if (status === 'jamais-leve') visibleHours = 0;
  else if (riseDate && setDate) {
    const raw = (setDate - riseDate) / 3600000;
    visibleHours = raw > 0 ? raw : raw + span * 24;
  }

  return {
    body,
    status,
    rise: riseDate,
    set: setDate,
    transit,
    transitAltitude,
    antitransitAltitude,
    visibleHours,
    dayStart: start,
    dayEnd: end,
  };
}

/** Instants où le Soleil franchit une altitude donnée dans le jour local. */
export function sunAltitudeCrossings(altitude, date, observer, timeZone) {
  const obs = astroObserver(observer);
  const start = startOfLocalDay(date, timeZone);
  const end = startOfNextLocalDay(date, timeZone);
  const span = (end - start) / MS_PER_DAY;
  return {
    rising: Astronomy.SearchAltitude(Body.Sun, obs, DIRECTION_RISE, start, span, altitude)?.date ?? null,
    setting: Astronomy.SearchAltitude(Body.Sun, obs, DIRECTION_SET, start, span, altitude)?.date ?? null,
  };
}

/** Altitudes de référence des crépuscules et des lumières photographiques. */
export const TWILIGHT_LEVELS = [
  { key: 'civil', altitude: -6, label: 'Crépuscule civil' },
  { key: 'nautique', altitude: -12, label: 'Crépuscule nautique' },
  { key: 'astronomique', altitude: -18, label: 'Crépuscule astronomique' },
];

/**
 * Toutes les phases lumineuses du jour : lever et coucher, heures bleue et
 * dorée, trois crépuscules, durée du jour et de la nuit noire.
 */
export function solarDay(date, observer, timeZone) {
  const circumstances = dailyCircumstances(Body.Sun, date, observer, timeZone);
  const lowest = circumstances.antitransitAltitude;
  const twilights = {};
  for (const level of TWILIGHT_LEVELS) {
    const crossings = sunAltitudeCrossings(level.altitude, date, observer, timeZone);
    twilights[level.key] = {
      ...crossings,
      altitude: level.altitude,
      label: level.label,
      // Aux latitudes moyennes, le Soleil peut ne jamais descendre assez bas en
      // été : la phase n'existe simplement pas ce jour-là.
      reached: lowest === null ? null : lowest <= level.altitude,
    };
  }
  const goldenLimit = sunAltitudeCrossings(6, date, observer, timeZone);
  const blueLimit = sunAltitudeCrossings(-4, date, observer, timeZone);

  const nightHours = twilights.astronomique.setting && twilights.astronomique.rising
    ? ((twilights.astronomique.rising - twilights.astronomique.setting) / 3600000 + 24) % 24
    : null;

  return {
    ...circumstances,
    twilights,
    // L'heure dorée court du lever jusqu'à 6° de hauteur, et symétriquement le soir.
    goldenHour: {
      morning: [circumstances.rise, goldenLimit.rising],
      evening: [goldenLimit.setting, circumstances.set],
    },
    // L'heure bleue s'étend du crépuscule civil (−6°) à −4°.
    blueHour: {
      morning: [twilights.civil.rising, blueLimit.rising],
      evening: [blueLimit.setting, twilights.civil.setting],
    },
    nightHours,
  };
}

/** Durée du jour (heures) pour un jour civil donné, sans les autres calculs. */
export function dayLengthHours(date, observer, timeZone) {
  return dailyCircumstances(Body.Sun, date, observer, timeZone).visibleHours;
}

/* --------------------------------------------------------------- la Lune */

const SYNODIC_MONTH = 29.530588853;

/** Noms des phases par secteur de 45° d'élongation. */
export function phaseName(phaseDegrees) {
  const sectors = [
    'Nouvelle Lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante',
    'Pleine Lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
  ];
  const index = Math.floor((normalize360(phaseDegrees) + 22.5) / 45) % 8;
  return sectors[index];
}

/** État lunaire complet à un instant donné. */
export function moonState(date, observer) {
  const phaseDegrees = Astronomy.MoonPhase(date);
  const illumination = Astronomy.Illumination(Body.Moon, date);
  const libration = Astronomy.Libration(date);
  const previousNew = searchPreviousNewMoon(date);
  const age = (date - previousNew) / MS_PER_DAY;

  return {
    phaseDegrees,
    phaseName: phaseName(phaseDegrees),
    waxing: phaseDegrees < 180,
    illuminatedFraction: illumination.phase_fraction,
    magnitude: illumination.mag,
    phaseAngle: illumination.phase_angle,
    distanceKm: libration.dist_km,
    angularDiameter: libration.diam_deg,
    libration: {
      longitude: libration.elon,
      latitude: libration.elat,
      subEarthLongitude: libration.mlon,
      subEarthLatitude: libration.mlat,
    },
    age,
    ageFraction: age / SYNODIC_MONTH,
    previousNewMoon: previousNew,
    position: observer ? bodySnapshot(Body.Moon, date, observer) : null,
  };
}

/** Dernière nouvelle Lune précédant l'instant donné. */
export function searchPreviousNewMoon(date) {
  let quarter = Astronomy.SearchMoonQuarter(new Date(date.getTime() - 45 * MS_PER_DAY));
  let lastNew = null;
  for (let i = 0; i < 8; i += 1) {
    if (quarter.time.date > date) break;
    if (quarter.quarter === 0) lastNew = quarter.time.date;
    quarter = Astronomy.NextMoonQuarter(quarter);
  }
  return lastNew ?? new Date(date.getTime() - SYNODIC_MONTH * MS_PER_DAY);
}

export const QUARTER_NAMES = [
  'Nouvelle Lune', 'Premier quartier', 'Pleine Lune', 'Dernier quartier',
];

/** Les `count` prochains quartiers lunaires à partir de `date`. */
export function nextMoonQuarters(date, count = 8) {
  const out = [];
  let quarter = Astronomy.SearchMoonQuarter(date);
  for (let i = 0; i < count; i += 1) {
    out.push({
      quarter: quarter.quarter,
      name: QUARTER_NAMES[quarter.quarter],
      date: quarter.time.date,
    });
    quarter = Astronomy.NextMoonQuarter(quarter);
  }
  return out;
}

/**
 * Angle de position du limbe éclairé, compté vers l'est à partir du nord
 * céleste (Meeus, chapitre 48). C'est la direction dans laquelle « pointe » la
 * corne lumineuse du croissant.
 */
export function brightLimbAngle(date, observer) {
  const obs = astroObserver(observer);
  const sun = Astronomy.Equator(Body.Sun, date, obs, true, true);
  const moon = Astronomy.Equator(Body.Moon, date, obs, true, true);
  const raSun = sun.ra * 15 / DEG;
  const raMoon = moon.ra * 15 / DEG;
  const decSun = sun.dec / DEG;
  const decMoon = moon.dec / DEG;
  const dRa = raSun - raMoon;
  return Math.atan2(
    Math.cos(decSun) * Math.sin(dRa),
    Math.sin(decSun) * Math.cos(decMoon)
      - Math.cos(decSun) * Math.sin(decMoon) * Math.cos(dRa),
  ) * DEG;
}

/**
 * Angle parallactique : inclinaison du cercle horaire par rapport à la
 * verticale du lieu. Retranché à l'angle du limbe, il donne l'orientation du
 * croissant telle qu'on la voit réellement, cornes vers le haut ou de côté.
 */
export function parallacticAngle(body, date, observer) {
  const obs = astroObserver(observer);
  const equatorial = Astronomy.Equator(body, date, obs, true, true);
  const hourAngleHours = Astronomy.HourAngle(body, date, obs);
  const H = hourAngleHours * 15 / DEG;
  const latitude = observer.latitude / DEG;
  const dec = equatorial.dec / DEG;
  return Math.atan2(
    Math.sin(H),
    Math.tan(latitude) * Math.cos(dec) - Math.sin(dec) * Math.cos(H),
  ) * DEG;
}

/**
 * Orientation du croissant lunaire par rapport à la verticale du lieu :
 * 0° signifie que la partie éclairée est tournée vers le zénith.
 */
export function moonLimbOrientation(date, observer) {
  return normalize360(brightLimbAngle(date, observer) - parallacticAngle(Body.Moon, date, observer));
}

/* ------------------------------------------------ géométrie Terre–Soleil */

/** Point de la surface terrestre où l'astre est au zénith. */
export function subastralPoint(body, date) {
  const equatorial = Astronomy.Equator(body, date, new Astronomy.Observer(0, 0, 0), true, true);
  const greenwichSidereal = Astronomy.SiderealTime(date);
  const longitude = normalize360((equatorial.ra - greenwichSidereal) * 15 + 180) - 180;
  return { latitude: equatorial.dec, longitude };
}

/**
 * Équation du temps, en minutes : avance du Soleil vrai sur le Soleil moyen.
 * Positive quand le cadran solaire est en avance sur la montre.
 */
export function equationOfTime(date) {
  const sun = Astronomy.Equator(Body.Sun, date, new Astronomy.Observer(0, 0, 0), true, false);
  const greenwichSidereal = Astronomy.SiderealTime(date);
  const hourAngleSun = normalize360((greenwichSidereal - sun.ra) * 15);
  const utHours = (date.getTime() / 3600000) % 24;
  const meanSolar = normalize360((utHours - 12) * 15);
  let difference = normalize360(hourAngleSun - meanSolar + 180) - 180;
  return (difference / 15) * 60;
}

/** Déclinaison solaire apparente, en degrés. */
export function solarDeclination(date) {
  return Astronomy.Equator(Body.Sun, date, new Astronomy.Observer(0, 0, 0), true, false).dec;
}

/** Obliquité vraie de l'écliptique à la date donnée, en degrés. */
export function obliquity(date) {
  return Astronomy.e_tilt(new Astronomy.AstroTime(date)).tobl;
}

/* ------------------------------------------------------------ visibilité */

/**
 * Qualifie la visibilité d'un corps : au-dessus de l'horizon, et dans quel
 * contexte lumineux. Sert aussi bien au tableau de bord qu'aux fiches.
 */
export function visibilityState(snapshot, sunSnapshot) {
  if (snapshot.altitude < -0.5) return { visible: false, label: 'Sous l’horizon' };
  const sunAltitude = sunSnapshot.altitude;
  if (sunAltitude > -0.5) {
    return snapshot.magnitude !== null && snapshot.magnitude < -3
      ? { visible: true, label: 'Visible de jour aux jumelles' }
      : { visible: false, label: 'Noyé dans le jour' };
  }
  if (sunAltitude > -6) return { visible: true, label: 'Crépuscule civil' };
  if (sunAltitude > -12) return { visible: true, label: 'Crépuscule nautique' };
  if (sunAltitude > -18) return { visible: true, label: 'Crépuscule astronomique' };
  return { visible: true, label: 'Nuit noire' };
}

export { Astronomy, SYNODIC_MONTH };
