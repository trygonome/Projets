/**
 * Agenda céleste : rassemble en une liste unique les phases lunaires, éclipses,
 * saisons, apsides, oppositions, élongations et pluies de météores.
 *
 * Chaque événement partage la même forme afin que les vues puissent les trier,
 * les filtrer et les afficher sans connaître leur origine.
 */
import * as Astronomy from '../../vendor/astronomy.js';
import { Body, bodyName, PLANETS, bodySnapshot, astroObserver } from './ephem.js';
import { MS_PER_DAY } from './time.js';
import { formatDegrees, formatKm, formatNumber } from './format.js';

/** Familles d'événements, avec leur libellé et leur pictogramme. */
export const EVENT_KINDS = {
  phase: { label: 'Phase lunaire', icon: '☾' },
  eclipseLunaire: { label: 'Éclipse de Lune', icon: '🌑' },
  eclipseSolaire: { label: 'Éclipse de Soleil', icon: '🌞' },
  saison: { label: 'Saison', icon: '🍂' },
  apsideLunaire: { label: 'Apside lunaire', icon: '⌀' },
  opposition: { label: 'Opposition', icon: '⚹' },
  conjonction: { label: 'Conjonction', icon: '☌' },
  elongation: { label: 'Élongation maximale', icon: '↔' },
  meteores: { label: 'Pluie de météores', icon: '☄' },
  noeud: { label: 'Nœud lunaire', icon: '☊' },
  rapprochement: { label: 'Rapprochement', icon: '❈' },
};

const event = (kind, date, title, detail, extra = {}) => ({
  kind, date, title, detail, ...extra,
});

/* ------------------------------------------------------------ lune : phases */

const QUARTERS = ['Nouvelle Lune', 'Premier quartier', 'Pleine Lune', 'Dernier quartier'];

export function moonPhaseEvents(from, until) {
  const out = [];
  let quarter = Astronomy.SearchMoonQuarter(from);
  while (quarter.time.date <= until) {
    const distanceKm = Astronomy.Libration(quarter.time.date).dist_km;
    const detail = quarter.quarter === 2 || quarter.quarter === 0
      ? `Distance ${formatKm(distanceKm)}`
      : '';
    out.push(event('phase', quarter.time.date, QUARTERS[quarter.quarter], detail, {
      body: Body.Moon, quarter: quarter.quarter, distanceKm,
    }));
    quarter = Astronomy.NextMoonQuarter(quarter);
  }
  return out;
}

/* --------------------------------------------------------- lune : apsides */

/** Périgées et apogées, avec repérage des « super-Lunes ». */
export function lunarApsisEvents(from, until) {
  const out = [];
  let apsis = Astronomy.SearchLunarApsis(from);
  while (apsis.time.date <= until) {
    const perigee = apsis.kind === 0;
    // Une pleine Lune à moins de 360 000 km est communément appelée super-Lune.
    const phase = Astronomy.MoonPhase(apsis.time.date);
    const nearFull = Math.abs(((phase - 180 + 180) % 360) - 180) < 20;
    out.push(event(
      'apsideLunaire',
      apsis.time.date,
      perigee ? 'Périgée lunaire' : 'Apogée lunaire',
      `${formatKm(apsis.dist_km)} — diamètre apparent ${formatNumber(
        2 * Math.atan(1737.4 / apsis.dist_km) * (180 / Math.PI) * 60, { digits: 1 },
      )}′`,
      {
        body: Body.Moon,
        distanceKm: apsis.dist_km,
        superMoon: perigee && nearFull && apsis.dist_km < 360000,
      },
    ));
    apsis = Astronomy.NextLunarApsis(apsis);
  }
  return out;
}

/** Passages de la Lune par ses nœuds : les saisons d'éclipses s'y accrochent. */
export function lunarNodeEvents(from, until) {
  const out = [];
  let node = Astronomy.SearchMoonNode(from);
  while (node.time.date <= until) {
    out.push(event(
      'noeud',
      node.time.date,
      node.kind === 1 ? 'Nœud ascendant' : 'Nœud descendant',
      'La Lune traverse le plan de l’écliptique',
      { body: Body.Moon },
    ));
    node = Astronomy.NextMoonNode(node);
  }
  return out;
}

/* ------------------------------------------------------------- éclipses */

const ECLIPSE_KIND_FR = {
  penumbral: 'par la pénombre', partial: 'partielle',
  annular: 'annulaire', total: 'totale',
};

export function lunarEclipseEvents(from, until, observer) {
  const out = [];
  let eclipse = Astronomy.SearchLunarEclipse(from);
  let guard = 0;
  while (eclipse.peak.date <= until && guard < 40) {
    guard += 1;
    let visibility = 'Lune sous l’horizon depuis votre position';
    if (observer) {
      const snapshot = bodySnapshot(Body.Moon, eclipse.peak.date, observer);
      if (snapshot.altitude > 0) {
        visibility = `Lune à ${formatDegrees(snapshot.altitude)} de hauteur au maximum`;
      }
    }
    out.push(event(
      'eclipseLunaire',
      eclipse.peak.date,
      `Éclipse de Lune ${ECLIPSE_KIND_FR[eclipse.kind]}`,
      `${visibility} — obscuration ${formatNumber(eclipse.obscuration * 100, { digits: 0 })} %`,
      {
        body: Body.Moon,
        eclipseKind: eclipse.kind,
        obscuration: eclipse.obscuration,
        halfDurationPenumbral: eclipse.sd_penum,
        halfDurationPartial: eclipse.sd_partial,
        halfDurationTotal: eclipse.sd_total,
      },
    ));
    eclipse = Astronomy.NextLunarEclipse(eclipse.peak);
  }
  return out;
}

export function solarEclipseEvents(from, until, observer) {
  const out = [];
  let eclipse = Astronomy.SearchGlobalSolarEclipse(from);
  let guard = 0;
  while (eclipse.peak.date <= until && guard < 40) {
    guard += 1;
    let local = null;
    if (observer) {
      try {
        const candidate = Astronomy.SearchLocalSolarEclipse(
          new Date(eclipse.peak.date.getTime() - 2 * MS_PER_DAY), astroObserver(observer),
        );
        if (Math.abs(candidate.peak.time.date - eclipse.peak.date) < MS_PER_DAY) {
          local = candidate;
        }
      } catch {
        /* aucune éclipse visible localement dans la fenêtre */
      }
    }
    const lieu = eclipse.latitude !== undefined
      ? `maximum vers ${formatDegrees(Math.abs(eclipse.latitude))} ${eclipse.latitude >= 0 ? 'N' : 'S'}, `
        + `${formatDegrees(Math.abs(eclipse.longitude))} ${eclipse.longitude >= 0 ? 'E' : 'O'}`
      : 'centralité hors de la surface terrestre';
    out.push(event(
      'eclipseSolaire',
      eclipse.peak.date,
      `Éclipse de Soleil ${ECLIPSE_KIND_FR[eclipse.kind]}`,
      local
        ? `Visible chez vous : ${ECLIPSE_KIND_FR[local.kind]}, `
          + `${formatNumber(local.obscuration * 100, { digits: 0 })} % du disque occulté`
        : `Non visible depuis votre position — ${lieu}`,
      {
        body: Body.Sun,
        eclipseKind: eclipse.kind,
        globalPeak: eclipse.peak.date,
        latitude: eclipse.latitude ?? null,
        longitude: eclipse.longitude ?? null,
        local,
      },
    ));
    eclipse = Astronomy.NextGlobalSolarEclipse(eclipse.peak);
  }
  return out;
}

/* -------------------------------------------------------------- saisons */

export function seasonEvents(from, until) {
  const out = [];
  const startYear = from.getUTCFullYear();
  const endYear = until.getUTCFullYear();
  for (let year = startYear; year <= endYear; year += 1) {
    const seasons = Astronomy.Seasons(year);
    const entries = [
      [seasons.mar_equinox.date, 'Équinoxe de mars', 'Début du printemps boréal, de l’automne austral'],
      [seasons.jun_solstice.date, 'Solstice de juin', 'Jour le plus long de l’hémisphère nord'],
      [seasons.sep_equinox.date, 'Équinoxe de septembre', 'Début de l’automne boréal, du printemps austral'],
      [seasons.dec_solstice.date, 'Solstice de décembre', 'Nuit la plus longue de l’hémisphère nord'],
    ];
    for (const [date, title, detail] of entries) {
      if (date >= from && date <= until) out.push(event('saison', date, title, detail));
    }
  }
  return out;
}

/* ----------------------------------------------------------- planètes */

const SUPERIOR = [Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune];
const INFERIOR = [Body.Mercury, Body.Venus];

/** Oppositions et conjonctions des planètes supérieures. */
export function planetaryAspectEvents(from, until) {
  const out = [];
  for (const body of SUPERIOR) {
    for (const [angle, kind, title] of [
      [0, 'opposition', 'Opposition'],
      [180, 'conjonction', 'Conjonction solaire'],
    ]) {
      let time = Astronomy.SearchRelativeLongitude(body, angle, from);
      let guard = 0;
      while (time.date <= until && guard < 12) {
        guard += 1;
        const illumination = Astronomy.Illumination(body, time.date);
        out.push(event(
          kind,
          time.date,
          `${title} de ${bodyName(body)}`,
          kind === 'opposition'
            ? `Au plus près : ${formatNumber(illumination.geo_dist, { digits: 3 })} ua, `
              + `magnitude ${formatNumber(illumination.mag, { digits: 1 })} — visible toute la nuit`
            : 'Derrière le Soleil, inobservable',
          { body, magnitude: illumination.mag, distanceAu: illumination.geo_dist },
        ));
        time = Astronomy.SearchRelativeLongitude(
          body, angle, new Date(time.date.getTime() + 30 * MS_PER_DAY),
        );
      }
    }
  }

  for (const body of INFERIOR) {
    for (const [angle, kind, title, detail] of [
      [0, 'conjonction', 'Conjonction inférieure', 'Entre la Terre et le Soleil'],
      [180, 'conjonction', 'Conjonction supérieure', 'Derrière le Soleil'],
    ]) {
      let time = Astronomy.SearchRelativeLongitude(body, angle, from);
      let guard = 0;
      while (time.date <= until && guard < 12) {
        guard += 1;
        out.push(event(kind, time.date, `${title} de ${bodyName(body)}`, detail, { body }));
        time = Astronomy.SearchRelativeLongitude(
          body, angle, new Date(time.date.getTime() + 30 * MS_PER_DAY),
        );
      }
    }
  }
  return out;
}

/** Élongations maximales de Mercure et Vénus : leurs meilleures fenêtres. */
export function elongationEvents(from, until) {
  const out = [];
  for (const body of INFERIOR) {
    let elongation = Astronomy.SearchMaxElongation(body, from);
    let guard = 0;
    while (elongation.time.date <= until && guard < 16) {
      guard += 1;
      const evening = elongation.visibility === 'evening';
      out.push(event(
        'elongation',
        elongation.time.date,
        `${bodyName(body)} à son élongation maximale ${evening ? 'est' : 'ouest'}`,
        `${formatDegrees(elongation.elongation)} du Soleil — visible ${
          evening ? 'le soir après le coucher du Soleil' : 'le matin avant le lever du Soleil'
        }`,
        { body, elongation: elongation.elongation, visibility: elongation.visibility },
      ));
      elongation = Astronomy.SearchMaxElongation(
        body, new Date(elongation.time.date.getTime() + 20 * MS_PER_DAY),
      );
    }
  }
  return out;
}

/**
 * Rapprochements apparents entre deux corps brillants : les conjonctions
 * visuelles, celles que l'on remarque réellement dans le ciel du soir.
 */
export function conjunctionEvents(from, until, { maxSeparation = 5 } = {}) {
  const targets = [Body.Moon, ...PLANETS];
  const pairs = [];
  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      pairs.push([targets[i], targets[j]]);
    }
  }

  const out = [];
  const stepHours = 6;
  const geo = new Astronomy.Observer(0, 0, 0);
  const separation = (a, b, date) => {
    const first = Astronomy.Equator(a, date, geo, true, true);
    const second = Astronomy.Equator(b, date, geo, true, true);
    return Astronomy.AngleBetween(first.vec, second.vec);
  };

  for (const [a, b] of pairs) {
    let previous = null;
    let previousDate = null;
    let falling = false;
    for (let t = from.getTime(); t <= until.getTime(); t += stepHours * 3600000) {
      const date = new Date(t);
      const current = separation(a, b, date);
      if (previous !== null) {
        if (current > previous && falling && previous < maxSeparation) {
          // Minimum franchi entre `previousDate` et `date` : on l'affine.
          const refined = refineMinimum(a, b, previousDate, date, separation);
          out.push(event(
            'rapprochement',
            refined.date,
            `${bodyName(a)} et ${bodyName(b)} au plus près`,
            `Séparation minimale ${formatDegrees(refined.value, 2)}`,
            { body: a, secondBody: b, separation: refined.value },
          ));
        }
        falling = current < previous;
      }
      previous = current;
      previousDate = date;
    }
  }
  return out;
}

/** Affine par section dorée l'instant du minimum de séparation. */
function refineMinimum(a, b, start, end, separation) {
  let low = start.getTime() - (end - start);
  let high = end.getTime();
  for (let i = 0; i < 40; i += 1) {
    const third = (high - low) / 3;
    const m1 = low + third;
    const m2 = high - third;
    if (separation(a, b, new Date(m1)) < separation(a, b, new Date(m2))) high = m2;
    else low = m1;
  }
  const date = new Date((low + high) / 2);
  return { date, value: separation(a, b, date) };
}

/* --------------------------------------------------------- météores */

/**
 * Essaims météoritiques annuels majeurs. Les maxima varient d'un jour d'une
 * année à l'autre ; les dates données sont les maxima nominaux.
 */
export const METEOR_SHOWERS = [
  { name: 'Quadrantides', month: 1, day: 3, zhr: 110, radiantRa: 230, radiantDec: 49, constellation: 'Bouvier', parent: '2003 EH₁', note: 'Maximum très bref, quelques heures seulement.' },
  { name: 'Lyrides', month: 4, day: 22, zhr: 18, radiantRa: 271, radiantDec: 34, constellation: 'Lyre', parent: 'C/1861 G1 Thatcher', note: 'Essaim ancien, observé depuis 2 700 ans.' },
  { name: 'Êta Aquarides', month: 5, day: 6, zhr: 50, radiantRa: 338, radiantDec: -1, constellation: 'Verseau', parent: '1P/Halley', note: 'Météores rapides et rasants, favorisés dans l’hémisphère sud.' },
  { name: 'Delta Aquarides du Sud', month: 7, day: 30, zhr: 25, radiantRa: 340, radiantDec: -16, constellation: 'Verseau', parent: '96P/Machholz', note: 'Maximum étalé sur plusieurs nuits.' },
  { name: 'Perséides', month: 8, day: 12, zhr: 100, radiantRa: 48, radiantDec: 58, constellation: 'Persée', parent: '109P/Swift-Tuttle', note: 'L’essaim le plus suivi de l’hémisphère nord, sous un ciel d’été clément.' },
  { name: 'Draconides', month: 10, day: 8, zhr: 10, radiantRa: 262, radiantDec: 54, constellation: 'Dragon', parent: '21P/Giacobini-Zinner', note: 'Activité imprévisible, avec de rares tempêtes ; visible dès le crépuscule.' },
  { name: 'Orionides', month: 10, day: 21, zhr: 20, radiantRa: 95, radiantDec: 16, constellation: 'Orion', parent: '1P/Halley', note: 'Seconde rencontre annuelle avec les poussières de Halley.' },
  { name: 'Taurides du Sud', month: 11, day: 5, zhr: 5, radiantRa: 52, radiantDec: 15, constellation: 'Taureau', parent: '2P/Encke', note: 'Peu nombreuses mais riches en bolides.' },
  { name: 'Léonides', month: 11, day: 17, zhr: 15, radiantRa: 152, radiantDec: 22, constellation: 'Lion', parent: '55P/Tempel-Tuttle', note: 'Tempêtes historiques tous les 33 ans environ.' },
  { name: 'Géminides', month: 12, day: 14, zhr: 150, radiantRa: 112, radiantDec: 33, constellation: 'Gémeaux', parent: '(3200) Phaéthon', note: 'Le plus riche essaim de l’année, issu d’un astéroïde et non d’une comète.' },
  { name: 'Ursides', month: 12, day: 22, zhr: 10, radiantRa: 217, radiantDec: 76, constellation: 'Petite Ourse', parent: '8P/Tuttle', note: 'Radiant circumpolaire, observable toute la nuit.' },
];

export function meteorShowerEvents(from, until) {
  const out = [];
  for (let year = from.getUTCFullYear(); year <= until.getUTCFullYear(); year += 1) {
    for (const shower of METEOR_SHOWERS) {
      const date = new Date(Date.UTC(year, shower.month - 1, shower.day, 12));
      if (date < from || date > until) continue;
      const phase = Astronomy.MoonPhase(date);
      const illuminated = Astronomy.Illumination(Body.Moon, date).phase_fraction;
      const moonlight = illuminated > 0.6
        ? 'Lune gênante'
        : illuminated < 0.25 ? 'Ciel sans Lune' : 'Lune peu gênante';
      out.push(event(
        'meteores',
        date,
        `Maximum des ${shower.name}`,
        `Jusqu’à ${shower.zhr} météores par heure au zénith — radiant dans ${shower.constellation} — ${moonlight}`,
        { shower, moonIllumination: illuminated, moonPhase: phase },
      ));
    }
  }
  return out;
}

/* ------------------------------------------------------------ agrégation */

/**
 * Construit l'agenda complet sur une fenêtre donnée.
 * Les familles coûteuses (rapprochements) sont optionnelles.
 */
export function buildAgenda(from, {
  days = 365,
  observer = null,
  include = null,
} = {}) {
  const until = new Date(from.getTime() + days * MS_PER_DAY);
  const wanted = (kind) => !include || include.includes(kind);
  const events = [];

  if (wanted('phase')) events.push(...moonPhaseEvents(from, until));
  if (wanted('apsideLunaire')) events.push(...lunarApsisEvents(from, until));
  if (wanted('noeud')) events.push(...lunarNodeEvents(from, until));
  if (wanted('eclipseLunaire')) events.push(...lunarEclipseEvents(from, until, observer));
  if (wanted('eclipseSolaire')) events.push(...solarEclipseEvents(from, until, observer));
  if (wanted('saison')) events.push(...seasonEvents(from, until));
  if (wanted('opposition') || wanted('conjonction')) {
    events.push(...planetaryAspectEvents(from, until)
      .filter((item) => wanted(item.kind)));
  }
  if (wanted('elongation')) events.push(...elongationEvents(from, until));
  if (wanted('meteores')) events.push(...meteorShowerEvents(from, until));
  if (wanted('rapprochement')) events.push(...conjunctionEvents(from, until));

  return events.sort((a, b) => a.date - b.date);
}
