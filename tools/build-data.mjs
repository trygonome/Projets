/**
 * Génère les jeux de données embarqués dans l'application à partir de sources
 * publiques (Hipparcos/Yale via d3-celestial, Natural Earth via world-atlas).
 *
 * Les fichiers produits sont commités : l'application n'a besoin d'aucune étape
 * de construction pour fonctionner, y compris hors-ligne.
 *
 *   node tools/build-data.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app', 'data');

const SOURCES = {
  stars: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json',
  starNames: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.json',
  constellations: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json',
  constellationLines: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json',
  messier: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/messier.json',
  land: 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json',
};

async function fetchJson(url) {
  process.stderr.write(`  ← ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} pour ${url}`);
  return res.json();
}

const round = (value, digits) => Number(value.toFixed(digits));
const normalizeRa = (ra) => ((ra % 360) + 360) % 360;

async function emit(name, value) {
  const path = join(OUT, name);
  await writeFile(path, JSON.stringify(value));
  const size = JSON.stringify(value).length;
  process.stderr.write(`  → app/data/${name} (${(size / 1024).toFixed(0)} Ko)\n`);
}

/* ------------------------------------------------------------------ étoiles */

/** Graphies françaises usuelles des noms propres d'étoiles. */
const FRENCH_STAR_NAMES = {
  Aldebaran: 'Aldébaran', Altair: 'Altaïr', Antares: 'Antarès',
  Betelgeuse: 'Bételgeuse', Regulus: 'Régulus', Spica: 'Épi', Vega: 'Véga',
  Dubhe: 'Dubhé', Merak: 'Mérak', Alnair: 'Alnaïr', Saiph: 'Saïph',
  Vindemiatrix: 'Vindémiatrix', Phecda: 'Phecda', Alioth: 'Alioth',
  Megrez: 'Mégrez', Alkaid: 'Alkaïd', Gacrux: 'Gacrux', Acrux: 'Acrux',
  Mimosa: 'Mimosa', Rigil: 'Rigil Kentaurus', Denebola: 'Dénébola',
  Algenib: 'Algénib', Enif: 'Enif', Sadalmelik: 'Sadalmelik',
  Nunki: 'Nunki', Kaus: 'Kaus Australis', Sabik: 'Sabik',
  Alphecca: 'Alphécca', Zubenelgenubi: 'Zubénelgénubi',
};

async function buildStars() {
  const [geo, names] = await Promise.all([
    fetchJson(SOURCES.stars),
    fetchJson(SOURCES.starNames),
  ]);

  const rows = [];
  for (const feature of geo.features) {
    const [ra, dec] = feature.geometry.coordinates;
    const mag = feature.properties.mag;
    if (!Number.isFinite(mag) || mag > 6.5) continue;
    const bv = Number.parseFloat(feature.properties.bv);
    const meta = names[String(feature.id)] ?? {};
    const proper = meta.name ? (FRENCH_STAR_NAMES[meta.name] ?? meta.name) : '';
    const designation = [meta.bayer || meta.flam || meta.var || '', meta.c || '']
      .filter(Boolean).join(' ');
    rows.push({
      ra: round(normalizeRa(ra), 4),
      dec: round(dec, 4),
      mag: round(mag, 2),
      bv: Number.isFinite(bv) ? round(bv, 2) : 0,
      proper,
      designation,
    });
  }

  // Les étoiles brillantes d'abord : le rendu peut s'arrêter à un seuil sans trier.
  rows.sort((a, b) => a.mag - b.mag);

  const stars = rows.map((s) => [s.ra, s.dec, s.mag, s.bv]);
  const labels = {};
  rows.forEach((star, index) => {
    if (star.proper || star.designation) {
      labels[index] = [star.proper, star.designation];
    }
  });

  await emit('stars.json', {
    epoch: 'J2000',
    columns: ['ra_deg', 'dec_deg', 'mag', 'bv'],
    source: 'Hipparcos / Yale BSC via d3-celestial',
    stars,
    labels,
  });
  return stars.length;
}

/* ---------------------------------------------------------- constellations */

async function buildConstellations() {
  const [meta, lines] = await Promise.all([
    fetchJson(SOURCES.constellations),
    fetchJson(SOURCES.constellationLines),
  ]);

  const byId = new Map();
  for (const feature of meta.features) {
    const p = feature.properties;
    byId.set(feature.id, {
      id: feature.id,
      latin: p.la || p.name,
      fr: p.fr || p.name,
      genitive: p.gen || '',
      ra: round(normalizeRa(feature.geometry.coordinates[0]), 3),
      dec: round(feature.geometry.coordinates[1], 3),
      lines: [],
    });
  }

  for (const feature of lines.features) {
    const entry = byId.get(feature.id);
    if (!entry) continue;
    for (const segment of feature.geometry.coordinates) {
      entry.lines.push(segment.map(([ra, dec]) => [
        round(normalizeRa(ra), 3),
        round(dec, 3),
      ]));
    }
  }

  const out = [...byId.values()].filter((c) => c.lines.length > 0);
  out.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
  await emit('constellations.json', out);

  // Table statique abréviation UAI → nom français, importable sans requête :
  // le moteur d'éphémérides en a besoin de façon synchrone.
  const names = Object.fromEntries(
    [...byId.values()].map((c) => [c.id, [c.fr, c.latin, c.genitive]]),
  );
  const module = `/**\n`
    + ` * Noms français des 88 constellations, indexés par abréviation UAI.\n`
    + ` * Chaque entrée vaut [nom français, nom latin, génitif latin].\n`
    + ` *\n`
    + ` * Fichier produit par tools/build-data.mjs — ne pas modifier à la main.\n`
    + ` */\nexport const CONSTELLATION_NAMES = ${JSON.stringify(names, null, 2)};\n\n`
    + `/** Nom français d'une constellation, avec repli sur l'abréviation. */\n`
    + `export const constellationName = (symbol) =>\n`
    + `  CONSTELLATION_NAMES[symbol]?.[0] ?? symbol;\n`;
  await writeFile(join(ROOT, 'app', 'js', 'data', 'constellations-noms.js'), module);
  process.stderr.write(`  → app/js/data/constellations-noms.js\n`);

  return out.length;
}

/* ---------------------------------------------------- objets du ciel profond */

const DSO_TYPE_FR = {
  gx: 'galaxie', gc: 'amas globulaire', oc: 'amas ouvert', pl: 'nébuleuse planétaire',
  nb: 'nébuleuse', dn: 'nébuleuse obscure', snr: 'rémanent de supernova',
  ga: 'galaxie', cg: 'amas de galaxies', ast: 'astérisme', mp: 'nuage stellaire',
  dn2: 'nébuleuse obscure', bn: 'nébuleuse diffuse', en: 'nébuleuse en émission',
  rn: 'nébuleuse par réflexion', pn: 'nébuleuse planétaire',
};

const DSO_NAMES_FR = {
  M1: 'Nébuleuse du Crabe', M6: 'Amas du Papillon', M7: 'Amas de Ptolémée',
  M8: 'Nébuleuse de la Lagune', M11: 'Amas du Canard sauvage',
  M13: 'Grand amas d’Hercule', M16: 'Nébuleuse de l’Aigle',
  M17: 'Nébuleuse Oméga', M20: 'Nébuleuse Trifide',
  M22: 'Grand amas du Sagittaire', M24: 'Nuage stellaire du Sagittaire',
  M27: 'Nébuleuse de l’Haltère', M31: 'Galaxie d’Andromède',
  M33: 'Galaxie du Triangle', M42: 'Nébuleuse d’Orion',
  M43: 'Nébuleuse de De Mairan', M44: 'Amas de la Crèche', M45: 'Les Pléiades',
  M51: 'Galaxie du Tourbillon', M57: 'Nébuleuse de la Lyre',
  M63: 'Galaxie du Tournesol', M64: 'Galaxie de l’Œil noir',
  M76: 'Petite Nébuleuse de l’Haltère', M78: 'Nébuleuse de Casper',
  M81: 'Galaxie de Bode', M82: 'Galaxie du Cigare', M83: 'Galaxie australe du Moulinet',
  M87: 'Galaxie Vierge A', M97: 'Nébuleuse du Hibou',
  M101: 'Galaxie du Moulinet', M104: 'Galaxie du Sombrero',
  M110: 'Compagne d’Andromède',
};

async function buildDeepSky() {
  const messier = await fetchJson(SOURCES.messier);
  const objects = messier.features.map((feature) => {
    const p = feature.properties;
    const [ra, dec] = feature.geometry.coordinates;
    return {
      id: p.name,
      ngc: p.desig || '',
      // Le catalogue source ne propose que des noms anglais : à défaut d'un
      // nom français, on s'en tient à la désignation Messier.
      name: DSO_NAMES_FR[p.name] ?? '',
      kind: DSO_TYPE_FR[p.type] || p.type || '',
      mag: Number.isFinite(p.mag) ? round(p.mag, 1) : null,
      size: p.dim || '',
      ra: round(normalizeRa(ra), 4),
      dec: round(dec, 4),
    };
  });
  objects.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  await emit('deepsky.json', objects);
  return objects.length;
}

/* ----------------------------------------------------------- contours terre */

/** Décodeur TopoJSON minimal : renvoie les arcs en coordonnées lon/lat. */
function decodeArcs(topology) {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

/**
 * Assemble un anneau de polygone : les indices négatifs désignent un arc
 * parcouru à l'envers, et le dernier point d'un arc est le premier du suivant.
 */
function assembleRing(indices, arcs) {
  const ring = [];
  for (const index of indices) {
    const arc = index < 0 ? [...arcs[-index - 1]].reverse() : arcs[index];
    ring.push(...(ring.length ? arc.slice(1) : arc));
  }
  return ring.map(([lon, lat]) => [round(lon, 2), round(lat, 2)]);
}

async function buildLand() {
  const topology = await fetchJson(SOURCES.land);
  const arcs = decodeArcs(topology);
  const rings = [];
  for (const geometry of topology.objects.land.geometries) {
    const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
    for (const polygon of polygons) {
      for (const component of polygon) {
        const ring = assembleRing(component, arcs);
        if (ring.length > 3) rings.push(ring);
      }
    }
  }
  rings.sort((a, b) => b.length - a.length);
  await emit('land.json', {
    source: 'Natural Earth 110m (domaine public) via world-atlas',
    projection: 'lon/lat en degrés',
    rings,
  });
  return rings.length;
}

/* -------------------------------------------------------------------- main */

async function main() {
  await mkdir(OUT, { recursive: true });
  const starCount = await buildStars();
  const constellationCount = await buildConstellations();
  const dsoCount = await buildDeepSky();
  const ringCount = await buildLand();
  process.stderr.write(
    `\n${starCount} étoiles, ${constellationCount} constellations, ` +
    `${dsoCount} objets Messier, ${ringCount} contours terrestres.\n`,
  );
}

await main();
