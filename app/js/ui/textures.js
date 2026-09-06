/**
 * Textures planétaires générées à la volée.
 *
 * Aucune image n'est téléchargée : chaque surface est peinte sur un canevas au
 * moment du premier affichage. L'application reste légère et fonctionne
 * hors-ligne, et la Terre est dessinée à partir des vrais contours des côtes.
 */

/* ------------------------------------------------------------------ bruit */

/** Générateur pseudo-aléatoire déterministe (xorshift 32 bits). */
function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

/** Grille de bruit cyclique en longitude, pour éviter la couture. */
function makeLattice(size, random) {
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i += 1) values[i] = random();
  return { size, values };
}

function sampleLattice(lattice, x, y) {
  const { size, values } = lattice;
  const fx = x * size;
  const fy = y * size;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  // Interpolation lissée : la dérivée s'annule aux nœuds, pas d'artefact carré.
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const at = (ix, iy) => values[
    (((iy % size) + size) % size) * size + (((ix % size) + size) % size)
  ];
  const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
  const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Bruit fractal : somme d'octaves d'amplitude décroissante. */
function fbm(lattices, x, y) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (const lattice of lattices) {
    sum += sampleLattice(lattice, x, y) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return sum / total;
}

function makeOctaves(seed, base = 4, count = 5) {
  const random = makeRandom(seed);
  const lattices = [];
  for (let i = 0; i < count; i += 1) {
    lattices.push(makeLattice(base * 2 ** i, random));
  }
  return lattices;
}

/* ------------------------------------------------------------- couleurs */

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Interpole une rampe de couleurs définie par des points [position, rvb]. */
function ramp(stops, t) {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i += 1) {
    if (clamped <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      return mix(c0, c1, (clamped - p0) / ((p1 - p0) || 1));
    }
  }
  return stops.at(-1)[1];
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/* ----------------------------------------------------- surfaces rocheuses */

/**
 * Surface rocheuse : bruit fractal coloré, cratères optionnels, calottes
 * polaires optionnelles. La projection est équirectangulaire.
 */
function rockyTexture({
  seed, stops, width = 1024, height = 512, craters = 0, iceCaps = 0,
  contrast = 1, latitudeShading = 0,
}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const octaves = makeOctaves(seed, 5, 6);

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    // Compression du bruit près des pôles : sans cela, la projection étire les
    // motifs en traînées horizontales aux hautes latitudes.
    const latitudeScale = Math.max(0.15, Math.cos((v - 0.5) * Math.PI));
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let value = fbm(octaves, u * latitudeScale + (1 - latitudeScale) * 0.5, v);
      value = 0.5 + (value - 0.5) * contrast;
      let color = ramp(stops, value);

      if (latitudeShading) {
        const polar = Math.abs(v - 0.5) * 2;
        color = mix(color, [255, 255, 255], polar ** 3 * latitudeShading);
      }
      if (iceCaps) {
        const polar = Math.abs(v - 0.5) * 2;
        const capEdge = 1 - iceCaps + fbm(octaves, u, v) * 0.08;
        if (polar > capEdge) {
          color = mix(color, [242, 246, 250],
            Math.min(1, (polar - capEdge) / 0.12));
        }
      }

      const index = (y * width + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  if (craters) {
    const random = makeRandom(seed * 7 + 13);
    for (let i = 0; i < craters; i += 1) {
      const cx = random() * width;
      const cy = height * (0.08 + random() * 0.84);
      const radius = 2 + random() ** 3 * (width / 26);
      const shade = 0.12 + random() * 0.2;
      const gradient = context.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${shade})`);
      gradient.addColorStop(0.72, `rgba(0,0,0,${shade * 0.35})`);
      gradient.addColorStop(0.86, `rgba(255,255,255,${shade * 0.5})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  return canvas;
}

/* --------------------------------------------------------- géantes gazeuses */

/**
 * Bandes zonales d'une géante gazeuse : la latitude fixe la couleur, un bruit
 * étiré horizontalement simule le cisaillement des vents.
 */
function bandedTexture({
  seed, stops, width = 1024, height = 512, turbulence = 0.06, bandCount = 14,
  spots = [],
}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const octaves = makeOctaves(seed, 6, 5);

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      // Le bruit déplace la latitude apparente : les bandes ondulent.
      const wobble = (fbm(octaves, u, v * 3) - 0.5) * turbulence;
      const latitude = v + wobble;
      const band = 0.5 + 0.5 * Math.sin(latitude * Math.PI * bandCount)
        * Math.cos(latitude * Math.PI * 2);
      const detail = (fbm(octaves, u * 2, v * 6) - 0.5) * 0.25;
      const color = ramp(stops, Math.max(0, Math.min(1, band * 0.75 + 0.12 + detail)));
      const index = (y * width + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  for (const spot of spots) {
    context.save();
    context.translate(spot.u * width, spot.v * height);
    context.scale(spot.rx * width, spot.ry * height);
    const gradient = context.createRadialGradient(0, 0, 0.15, 0, 0, 1);
    gradient.addColorStop(0, spot.core);
    gradient.addColorStop(0.65, spot.edge);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  return canvas;
}

/* ------------------------------------------------------------------ Terre */

/**
 * Terre dessinée à partir des contours réels des côtes (Natural Earth),
 * en projection équirectangulaire, avec relief bruité et calottes polaires.
 */
function earthTexture(rings, { width = 2048, height = 1024 } = {}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  const ocean = context.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#0d2a4a');
  ocean.addColorStop(0.3, '#123f6d');
  ocean.addColorStop(0.5, '#16528c');
  ocean.addColorStop(0.7, '#123f6d');
  ocean.addColorStop(1, '#0d2a4a');
  context.fillStyle = ocean;
  context.fillRect(0, 0, width, height);

  const toX = (lon) => ((lon + 180) / 360) * width;
  const toY = (lat) => ((90 - lat) / 180) * height;

  context.fillStyle = '#3f6b3a';
  for (const ring of rings) {
    context.beginPath();
    ring.forEach(([lon, lat], index) => {
      const x = toX(lon);
      const y = toY(lat);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
  }

  // Variation de biome : déserts chauds, forêts, toundra, appliquée seulement
  // sur les terres grâce au mode de composition « source-atop ».
  const octaves = makeOctaves(20260906, 6, 5);
  const biome = createCanvas(width / 2, height / 2);
  const biomeContext = biome.getContext('2d');
  const image = biomeContext.createImageData(biome.width, biome.height);
  for (let y = 0; y < biome.height; y += 1) {
    const v = y / biome.height;
    const latitude = 90 - v * 180;
    for (let x = 0; x < biome.width; x += 1) {
      const u = x / biome.width;
      const noise = fbm(octaves, u, v);
      const arid = Math.exp(-((Math.abs(latitude) - 24) ** 2) / 220);
      const cold = Math.max(0, (Math.abs(latitude) - 52) / 38);
      const color = ramp([
        [0.0, [58, 92, 46]],
        [0.4, [78, 106, 52]],
        [0.7, [116, 118, 66]],
        [1.0, [150, 138, 92]],
      ], noise * 0.6 + arid * 0.55 + cold * 0.1);
      const index = (y * biome.width + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 235;
    }
  }
  biomeContext.putImageData(image, 0, 0);
  context.globalCompositeOperation = 'source-atop';
  context.drawImage(biome, 0, 0, width, height);
  context.globalCompositeOperation = 'source-over';

  // Calottes polaires, tracées par-dessus terres et océans.
  const cap = (fromLat, toLat) => {
    const gradient = context.createLinearGradient(0, toY(fromLat), 0, toY(toLat));
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(248,251,255,0.96)');
    context.fillStyle = gradient;
    context.fillRect(0, Math.min(toY(fromLat), toY(toLat)), width,
      Math.abs(toY(toLat) - toY(fromLat)));
  };
  cap(72, 90);
  cap(-64, -90);

  return canvas;
}

/* ------------------------------------------------------------- anneaux */

/** Bande radiale des anneaux de Saturne, avec la division de Cassini. */
function ringTexture({ width = 1024, height = 8 } = {}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const random = makeRandom(4242);
  const grain = new Float32Array(width);
  for (let i = 0; i < width; i += 1) grain[i] = random();

  for (let x = 0; x < width; x += 1) {
    const r = x / width; // 0 = bord interne, 1 = bord externe
    // Structure radiale : anneaux C, B, division de Cassini, A.
    let opacity;
    if (r < 0.08) opacity = 0;
    else if (r < 0.26) opacity = 0.28;              // anneau C, ténu
    else if (r < 0.62) opacity = 0.92;              // anneau B, dense
    else if (r < 0.68) opacity = 0.06;              // division de Cassini
    else if (r < 0.94) opacity = 0.72;              // anneau A
    else if (r < 0.955) opacity = 0.05;             // division d'Encke
    else opacity = 0.4;

    const texture = 0.82 + grain[x] * 0.18 + Math.sin(r * 220) * 0.05;
    const color = ramp([
      [0, [150, 136, 116]],
      [0.4, [214, 200, 174]],
      [0.75, [190, 176, 152]],
      [1, [156, 146, 128]],
    ], r);

    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * 4;
      image.data[index] = color[0] * texture;
      image.data[index + 1] = color[1] * texture;
      image.data[index + 2] = color[2] * texture;
      image.data[index + 3] = Math.round(opacity * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/* ---------------------------------------------------------------- Soleil */

/** Granulation photosphérique du Soleil. */
function sunTexture({ width = 1024, height = 512 } = {}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const octaves = makeOctaves(9977, 16, 4);

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const latitudeScale = Math.max(0.2, Math.cos((v - 0.5) * Math.PI));
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const value = fbm(octaves, u * latitudeScale + (1 - latitudeScale) * 0.5, v);
      const color = ramp([
        [0, [244, 158, 44]],
        [0.45, [253, 205, 92]],
        [0.75, [255, 236, 176]],
        [1, [255, 252, 236]],
      ], value);
      const index = (y * width + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/* --------------------------------------------------------------- recettes */

/** Description de la surface de chaque corps rendu en trois dimensions. */
const RECIPES = {
  Mercury: () => rockyTexture({
    seed: 101, craters: 900, contrast: 1.35,
    stops: [[0, [66, 62, 58]], [0.45, [124, 116, 106]], [0.8, [162, 152, 140]], [1, [196, 186, 172]]],
  }),
  Venus: () => rockyTexture({
    seed: 202, contrast: 0.75,
    stops: [[0, [186, 148, 84]], [0.5, [224, 190, 126]], [1, [246, 226, 178]]],
  }),
  Mars: () => rockyTexture({
    seed: 303, craters: 260, contrast: 1.2, iceCaps: 0.1,
    stops: [[0, [96, 44, 26]], [0.35, [152, 74, 40]], [0.7, [190, 110, 62]], [1, [214, 152, 104]]],
  }),
  Moon: () => rockyTexture({
    seed: 404, craters: 1400, contrast: 1.15,
    stops: [[0, [58, 56, 52]], [0.4, [116, 112, 105]], [0.75, [162, 158, 150]], [1, [206, 202, 194]]],
  }),
  Jupiter: () => bandedTexture({
    seed: 505, bandCount: 16, turbulence: 0.09,
    stops: [[0, [140, 96, 62]], [0.3, [196, 154, 106]], [0.6, [232, 206, 172]], [0.85, [212, 172, 128]], [1, [246, 232, 210]]],
    spots: [{
      u: 0.32, v: 0.66, rx: 0.055, ry: 0.032,
      core: 'rgba(196,84,52,0.95)', edge: 'rgba(212,132,92,0.5)',
    }],
  }),
  Saturn: () => bandedTexture({
    seed: 606, bandCount: 11, turbulence: 0.05,
    stops: [[0, [176, 146, 92]], [0.4, [222, 196, 140]], [0.75, [240, 222, 178]], [1, [250, 240, 214]]],
  }),
  Uranus: () => bandedTexture({
    seed: 707, bandCount: 6, turbulence: 0.02,
    stops: [[0, [126, 186, 196]], [0.5, [162, 214, 222]], [1, [198, 234, 238]]],
  }),
  Neptune: () => bandedTexture({
    seed: 808, bandCount: 8, turbulence: 0.05,
    stops: [[0, [40, 66, 148]], [0.45, [62, 100, 190]], [0.8, [96, 138, 214]], [1, [148, 180, 232]]],
    spots: [{
      u: 0.62, v: 0.62, rx: 0.05, ry: 0.028,
      core: 'rgba(24,40,104,0.85)', edge: 'rgba(48,74,150,0.4)',
    }],
  }),
  Pluto: () => rockyTexture({
    seed: 909, craters: 320, contrast: 1.1,
    stops: [[0, [92, 74, 62]], [0.45, [154, 132, 112]], [0.8, [200, 182, 160]], [1, [232, 220, 202]]],
  }),
  Io: () => rockyTexture({
    seed: 111, contrast: 1.3,
    stops: [[0, [148, 96, 24]], [0.4, [214, 172, 62]], [0.8, [244, 224, 128]], [1, [252, 244, 196]]],
  }),
  Europa: () => rockyTexture({
    seed: 222, contrast: 0.7,
    stops: [[0, [176, 158, 138]], [0.5, [216, 204, 188]], [1, [242, 236, 226]]],
  }),
  Ganymede: () => rockyTexture({
    seed: 333, craters: 500, contrast: 1.1,
    stops: [[0, [86, 76, 68]], [0.5, [142, 130, 118]], [1, [190, 180, 168]]],
  }),
  Callisto: () => rockyTexture({
    seed: 444, craters: 1200, contrast: 1.2,
    stops: [[0, [58, 50, 44]], [0.5, [108, 96, 86]], [1, [156, 144, 130]]],
  }),
  Titan: () => rockyTexture({
    seed: 555, contrast: 0.6,
    stops: [[0, [168, 118, 44]], [0.5, [214, 166, 78]], [1, [238, 204, 132]]],
  }),
};

const cache = new Map();

/**
 * Canevas de la surface d'un corps. Le résultat est mémorisé : la génération
 * ne coûte qu'une fois par corps et par session.
 */
export function bodyCanvas(id, { landRings = null } = {}) {
  if (cache.has(id)) return cache.get(id);
  let canvas;
  if (id === 'Earth' && landRings) canvas = earthTexture(landRings);
  else if (id === 'Sun') canvas = sunTexture();
  else if (RECIPES[id]) canvas = RECIPES[id]();
  else {
    canvas = rockyTexture({
      seed: 1234, contrast: 1,
      stops: [[0, [80, 80, 84]], [0.5, [140, 140, 146]], [1, [196, 196, 202]]],
    });
  }
  cache.set(id, canvas);
  return canvas;
}

export function ringCanvas() {
  if (!cache.has('__anneaux')) cache.set('__anneaux', ringTexture());
  return cache.get('__anneaux');
}

/** Dégradé radial d'un halo lumineux, utilisé pour la couronne solaire. */
export function glowCanvas(color = '255,210,125', size = 256) {
  const key = `__halo-${color}-${size}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    size / 2, size / 2, 0, size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, `rgba(${color},0.95)`);
  gradient.addColorStop(0.18, `rgba(${color},0.42)`);
  gradient.addColorStop(0.45, `rgba(${color},0.12)`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  cache.set(key, canvas);
  return canvas;
}

export { makeRandom };
