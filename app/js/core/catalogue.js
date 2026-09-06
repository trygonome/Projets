/**
 * Catalogue céleste : étoiles, figures de constellations et objets du ciel
 * profond, chargés une fois puis conservés en mémoire.
 *
 * Les coordonnées J2000 sont converties en vecteurs unitaires dès le
 * chargement : la projection d'une image du ciel se réduit alors à une
 * rotation, ce qui permet d'afficher cinq mille étoiles à chaque image.
 */

const DEG = Math.PI / 180;

/** Ascension droite et déclinaison en degrés → vecteur unitaire équatorial. */
export function equatorialVector(raDegrees, decDegrees) {
  const ra = raDegrees * DEG;
  const dec = decDegrees * DEG;
  const cos = Math.cos(dec);
  return [cos * Math.cos(ra), cos * Math.sin(ra), Math.sin(dec)];
}

/**
 * Couleur d'une étoile d'après son indice B−V.
 * Les valeurs suivent la progression usuelle du bleu (O, B) au rouge (M).
 */
export function starColor(bv) {
  const index = Math.max(-0.4, Math.min(2, bv ?? 0));
  const stops = [
    [-0.40, [155, 176, 255]],
    [0.00, [202, 216, 255]],
    [0.30, [248, 247, 255]],
    [0.58, [255, 244, 232]],
    [0.81, [255, 221, 180]],
    [1.40, [255, 187, 137]],
    [2.00, [255, 152, 108]],
  ];
  for (let i = 1; i < stops.length; i += 1) {
    if (index <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (index - p0) / (p1 - p0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return stops.at(-1)[1];
}

let loading = null;
let catalogue = null;

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Chargement impossible : ${path}`);
  return response.json();
}

/** Charge le catalogue, une seule fois pour toute la session. */
export function loadCatalogue() {
  if (catalogue) return Promise.resolve(catalogue);
  if (loading) return loading;

  loading = (async () => {
    const [starsData, constellationsData, deepSkyData] = await Promise.all([
      fetchJson('data/stars.json'),
      fetchJson('data/constellations.json'),
      fetchJson('data/deepsky.json'),
    ]);

    const stars = starsData.stars.map(([ra, dec, mag, bv], index) => {
      const label = starsData.labels[index];
      return {
        index,
        ra,
        dec,
        mag,
        bv,
        vector: equatorialVector(ra, dec),
        color: starColor(bv),
        proper: label?.[0] || '',
        designation: label?.[1] || '',
      };
    });

    const constellations = constellationsData.map((entry) => ({
      ...entry,
      center: equatorialVector(entry.ra, entry.dec),
      segments: entry.lines.map((line) =>
        line.map(([ra, dec]) => equatorialVector(ra, dec))),
    }));

    const deepSky = deepSkyData.map((entry) => ({
      ...entry,
      vector: equatorialVector(entry.ra, entry.dec),
    }));

    catalogue = { stars, constellations, deepSky };
    return catalogue;
  })();

  return loading;
}

export const catalogueIfLoaded = () => catalogue;

/** Grand cercle échantillonné, défini par sa normale équatoriale. */
export function greatCircle(poleRa, poleDec, steps = 180) {
  const pole = equatorialVector(poleRa, poleDec);
  // Deux vecteurs orthogonaux au pôle engendrent le plan du grand cercle.
  const helper = Math.abs(pole[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(helper, pole));
  const v = cross(pole, u);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push([
      u[0] * cos + v[0] * sin,
      u[1] * cos + v[1] * sin,
      u[2] * cos + v[2] * sin,
    ]);
  }
  return points;
}

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const normalize = (a) => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

export { cross, normalize, DEG };
