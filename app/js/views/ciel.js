/**
 * Planétarium local : le ciel tel qu'il se présente au-dessus de l'observateur.
 *
 * Le rendu est une projection stéréographique, conforme : les figures des
 * constellations gardent leur forme, ce qui permet de les reconnaître sur le
 * terrain. Le fond du ciel s'éclaircit avec la hauteur du Soleil, et les
 * étoiles s'effacent à mesure que le jour se lève, comme dans la réalité.
 */
import * as Astronomy from '../../vendor/astronomy.js';
import { el } from '../ui/dom.js';
import { loadCatalogue, greatCircle, equatorialVector, DEG } from '../core/catalogue.js';
import { now, observer, timeZone, display, setDisplay } from '../core/state.js';
import {
  Body, TRACKED_BODIES, bodyName, bodySnapshot, astroObserver, moonLimbOrientation,
} from '../core/ephem.js';
import {
  formatDegrees, formatNumber, formatSmallAngle, cardinalPoint, formatDistance,
  formatHMS, formatDMS, formatTime,
} from '../core/format.js';

const PLANET_COLORS = {
  Sun: '#ffd27d', Moon: '#e8e2d4', Mercury: '#b9aca2', Venus: '#f6e2b4',
  Mars: '#e0703c', Jupiter: '#e8c191', Saturn: '#efd9a4', Uranus: '#b6e6ee',
  Neptune: '#7f9bea', Pluto: '#cfc0b0',
};

const CARDINALS = [
  [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
  [180, 'S'], [225, 'SO'], [270, 'O'], [315, 'NO'],
];

export function mount(container, { setTimeBarVisible, navigate }) {
  const canvas = el('canvas', { class: 'surface' });
  const tools = el('div', { class: 'surface-outils surface-outils--defilante' });
  const info = el('div', { class: 'info-flottante', hidden: true });
  container.append(canvas, tools, info);
  setTimeBarVisible(true);

  const context = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let ratio = 1;

  /** Direction de visée et ouverture du champ. */
  const view = { azimuth: 180, altitude: 89.9, fov: 190 };

  const options = {
    constellations: display().showConstellations,
    deepSky: display().showDeepSky,
    labels: display().showLabels,
    grid: false,
    ecliptic: true,
  };

  let catalogue = null;
  let selected = null;
  let projected = [];

  /* ------------------------------------------------------------ projection */

  /**
   * Base orthonormée de la visée. `forward` pointe vers le centre de l'écran,
   * `right` vers la droite et `up` vers le haut.
   */
  let basis = { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] };
  let scale = 1;

  function updateBasis() {
    const az = view.azimuth * DEG;
    const alt = view.altitude * DEG;
    // Repère horizontal d'Astronomy Engine : x nord, y ouest, z zénith.
    const forward = [
      Math.cos(alt) * Math.cos(az),
      -Math.cos(alt) * Math.sin(az),
      Math.sin(alt),
    ];
    // « Haut » de l'écran : direction du zénith projetée perpendiculairement.
    let up = [-Math.sin(alt) * Math.cos(az), Math.sin(alt) * Math.sin(az), Math.cos(alt)];
    const right = [
      forward[1] * up[2] - forward[2] * up[1],
      forward[2] * up[0] - forward[0] * up[2],
      forward[0] * up[1] - forward[1] * up[0],
    ];
    up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];
    basis = { forward, up, right };
    // Projection stéréographique : le rayon vaut 2·tan(θ/2).
    //
    // Le champ demandé se rapporte à la hauteur de l'écran, comme dans une
    // lunette tenue verticalement. Au-delà de 130°, on vise la voûte entière :
    // c'est alors la largeur qui doit contenir le cercle d'horizon.
    const half = (view.fov / 2) * DEG;
    const reference = view.fov > 130 ? Math.min(width, height) : height;
    scale = reference / 2 / (2 * Math.tan(Math.min(half, 1.66) / 2));
  }

  /** Vecteur horizontal → coordonnées écran, ou null s'il est hors du champ. */
  function project(vector) {
    const { right, up, forward } = basis;
    const c = vector[0] * forward[0] + vector[1] * forward[1] + vector[2] * forward[2];
    if (c < -0.28) return null; // au-delà de ~106°, la projection diverge
    const a = vector[0] * right[0] + vector[1] * right[1] + vector[2] * right[2];
    const b = vector[0] * up[0] + vector[1] * up[1] + vector[2] * up[2];
    const factor = scale * 2 / (1 + c);
    return [width / 2 + a * factor, height / 2 - b * factor];
  }

  /* -------------------------------------------------------- fond du ciel */

  /**
   * Couleur du fond selon la hauteur du Soleil : bleu franc en plein jour,
   * dégradés du crépuscule, noir profond la nuit.
   */
  function skyTone(sunAltitude) {
    const stops = [
      [-18, [4, 6, 14]],
      [-12, [8, 12, 32]],
      [-6, [20, 28, 66]],
      [-2, [58, 58, 96]],
      [0, [104, 88, 108]],
      [3, [140, 150, 190]],
      [10, [110, 152, 208]],
      [30, [86, 138, 212]],
      [90, [72, 126, 208]],
    ];
    const altitude = Math.max(-18, Math.min(90, sunAltitude));
    for (let i = 1; i < stops.length; i += 1) {
      if (altitude <= stops[i][0]) {
        const [p0, c0] = stops[i - 1];
        const [p1, c1] = stops[i];
        const t = (altitude - p0) / (p1 - p0);
        return c0.map((value, k) => Math.round(value + (c1[k] - value) * t));
      }
    }
    return stops.at(-1)[1];
  }

  /** Magnitude limite atteignable compte tenu de la clarté du ciel. */
  function limitingMagnitude(sunAltitude) {
    if (sunAltitude < -18) return 6.5;
    if (sunAltitude > 0) return -3;
    // Entre le coucher et la nuit noire, la limite remonte progressivement.
    return -3 + ((-sunAltitude) / 18) * 9.5;
  }

  /* --------------------------------------------------------------- rendu */

  function draw() {
    const date = now();
    const place = observer();
    const zone = timeZone();
    const obs = astroObserver(place);
    const time = new Astronomy.AstroTime(date);
    const rotation = Astronomy.Rotation_EQJ_HOR(time, obs);
    const matrix = rotation.rot;

    /** Vecteur équatorial J2000 → vecteur horizontal. */
    const toHorizontal = (v) => [
      matrix[0][0] * v[0] + matrix[1][0] * v[1] + matrix[2][0] * v[2],
      matrix[0][1] * v[0] + matrix[1][1] * v[1] + matrix[2][1] * v[2],
      matrix[0][2] * v[0] + matrix[1][2] * v[1] + matrix[2][2] * v[2],
    ];

    const sun = bodySnapshot(Body.Sun, date, place);
    const background = skyTone(sun.altitude);
    const limit = limitingMagnitude(sun.altitude);

    updateBasis();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = `rgb(${background.join(',')})`;
    context.fillRect(0, 0, width, height);

    drawHorizonGlow(sun, toHorizontal, background);
    if (options.grid) drawGrid();
    drawEquatorAndEcliptic(toHorizontal);
    if (options.constellations) drawConstellations(toHorizontal, limit);
    drawStars(toHorizontal, limit, sun.altitude);
    if (options.deepSky) drawDeepSky(toHorizontal, limit);
    drawBodies(date, place, toHorizontal);
    drawHorizon();
    drawLabels();
    void zone;
  }

  /** Lueur du ciel dans la direction du Soleil, au crépuscule. */
  function drawHorizonGlow(sun, toHorizontal, background) {
    if (sun.altitude < -14 || sun.altitude > 8) return;
    const point = project(horizontalVector(sun.azimuth, Math.max(sun.altitude, -6)));
    if (!point) return;
    const intensity = Math.max(0, 1 - Math.abs(sun.altitude + 3) / 11);
    const radius = Math.min(width, height) * 0.85;
    const gradient = context.createRadialGradient(point[0], point[1], 0, point[0], point[1], radius);
    gradient.addColorStop(0, `rgba(255,178,96,${0.5 * intensity})`);
    gradient.addColorStop(0.35, `rgba(228,120,86,${0.22 * intensity})`);
    gradient.addColorStop(1, `rgba(${background.join(',')},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    void toHorizontal;
  }

  const horizontalVector = (azimuth, altitude) => {
    const az = azimuth * DEG;
    const alt = altitude * DEG;
    return [Math.cos(alt) * Math.cos(az), -Math.cos(alt) * Math.sin(az), Math.sin(alt)];
  };

  /** Cercles d'égale hauteur et méridiens d'azimut. */
  function drawGrid() {
    context.strokeStyle = 'rgba(140,170,220,0.16)';
    context.lineWidth = 1;
    for (let altitude = 20; altitude <= 80; altitude += 20) {
      strokePath(range(0, 361, 4).map((az) => horizontalVector(az, altitude)));
    }
    for (let azimuth = 0; azimuth < 360; azimuth += 30) {
      strokePath(range(0, 90, 4).map((alt) => horizontalVector(azimuth, alt)));
    }
  }

  function drawEquatorAndEcliptic(toHorizontal) {
    if (!options.ecliptic) return;
    // L'écliptique est le grand cercle dont le pôle est celui de l'écliptique.
    context.lineWidth = 1.2;
    context.strokeStyle = 'rgba(255,210,125,0.32)';
    strokePath(greatCircle(270, 66.5607).map(toHorizontal), { skipBelowHorizon: true });
    context.strokeStyle = 'rgba(111,212,255,0.20)';
    strokePath(greatCircle(0, 90).map(toHorizontal), { skipBelowHorizon: true });
  }

  function strokePath(vectors, { skipBelowHorizon = false } = {}) {
    context.beginPath();
    let started = false;
    let previous = null;
    for (const vector of vectors) {
      const point = (skipBelowHorizon && vector[2] < 0) ? null : project(vector);
      if (!point) { started = false; previous = null; continue; }
      // Un saut brutal signale un passage par le bord : on coupe le trait.
      if (started && previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) > width) {
        started = false;
      }
      if (started) context.lineTo(point[0], point[1]);
      else { context.moveTo(point[0], point[1]); started = true; }
      previous = point;
    }
    context.stroke();
  }

  const range = (from, to, step) => {
    const values = [];
    for (let value = from; value <= to; value += step) values.push(value);
    return values;
  };

  function drawConstellations(toHorizontal, limit) {
    if (limit < 2) return;
    const opacity = Math.min(0.42, Math.max(0, (limit - 2) / 4.5) * 0.42);
    context.strokeStyle = `rgba(150,190,255,${opacity})`;
    context.lineWidth = 1;
    for (const constellation of catalogue.constellations) {
      for (const segment of constellation.segments) {
        strokePath(segment.map(toHorizontal), { skipBelowHorizon: true });
      }
    }
  }

  function drawStars(toHorizontal, limit, sunAltitude) {
    const zoom = Math.min(2.4, (60 / view.fov) ** 0.34);
    for (const star of catalogue.stars) {
      if (star.mag > limit) break; // le catalogue est trié par éclat
      const vector = toHorizontal(star.vector);
      if (vector[2] < 0) continue;
      const point = project(vector);
      if (!point) continue;
      if (point[0] < -20 || point[0] > width + 20 || point[1] < -20 || point[1] > height + 20) continue;

      // Le rayon croît linéairement avec l'écart à la magnitude limite, et la
      // transparence achève d'éteindre les plus faibles : sans ce double
      // effet, toutes les étoiles se ressemblent et le ciel devient un grésil.
      const excess = limit - star.mag;
      const radius = Math.min(4.6, 0.42 + 0.6 * excess) * zoom;
      const fade = Math.max(0.2, Math.min(1, excess / 1.4));
      context.beginPath();
      context.fillStyle = `rgba(${star.color.join(',')},${fade})`;
      context.arc(point[0], point[1], radius, 0, Math.PI * 2);
      context.fill();

      // Les plus brillantes reçoivent un léger halo, qui donne sa profondeur
      // au champ et rappelle l'éblouissement de l'œil.
      if (excess > 6) {
        const halo = context.createRadialGradient(
          point[0], point[1], 0, point[0], point[1], radius * 3.4,
        );
        halo.addColorStop(0, `rgba(${star.color.join(',')},0.30)`);
        halo.addColorStop(1, `rgba(${star.color.join(',')},0)`);
        context.fillStyle = halo;
        context.beginPath();
        context.arc(point[0], point[1], radius * 3.4, 0, Math.PI * 2);
        context.fill();
      }

      if (options.labels && star.proper && star.mag < 2.2) {
        drawLabel(star.proper, point[0] + radius + 5, point[1] + 3,
          'rgba(214,228,255,0.78)', 11, point[0]);
      }
    }
    void sunAltitude;
  }

  function drawDeepSky(toHorizontal, limit) {
    if (limit < 3) return;
    const wide = view.fov > 130;
    context.strokeStyle = `rgba(140,240,200,${wide ? 0.28 : 0.5})`;
    context.lineWidth = 1;
    for (const object of catalogue.deepSky) {
      // Au champ le plus large, seuls les objets à portée de jumelles.
      if (wide && (object.mag ?? 99) > 7) continue;
      const vector = toHorizontal(object.vector);
      if (vector[2] < 0) continue;
      const point = project(vector);
      if (!point) continue;
      const size = wide ? 3 : 5.5;
      context.beginPath();
      context.ellipse(point[0], point[1], size, size * 0.68, 0, 0, Math.PI * 2);
      context.stroke();
      if (options.labels && view.fov < 110) {
        drawLabel(object.name || object.id, point[0] + size + 4, point[1] + 3,
          'rgba(140,240,200,0.72)', 10, point[0]);
      }
    }
  }

  /** Corps du système solaire, la Lune dessinée avec sa phase. */
  function drawBodies(date, place, toHorizontal) {
    projected = [];
    for (const body of TRACKED_BODIES) {
      const snapshot = bodySnapshot(body, date, place);
      const vector = toHorizontal(equatorialVector(snapshot.ra, snapshot.dec));
      if (vector[2] < -0.02) continue;
      const point = project(vector);
      if (!point) continue;

      const color = PLANET_COLORS[body] ?? '#ffffff';
      const zoom = 60 / view.fov;
      let radius = body === Body.Sun || body === Body.Moon
        ? Math.max(5, (snapshot.angularDiameter / view.fov) * Math.min(width, height))
        : Math.max(2.2, 4.4 - (snapshot.magnitude ?? 5) * 0.42) * Math.min(2, zoom ** 0.3);

      if (body === Body.Moon) drawMoonSymbol(point, radius, date, place, snapshot);
      else {
        const glow = context.createRadialGradient(
          point[0], point[1], 0, point[0], point[1], radius * 3.2,
        );
        glow.addColorStop(0, color);
        glow.addColorStop(0.25, `${color}88`);
        glow.addColorStop(1, `${color}00`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(point[0], point[1], radius * 3.2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = color;
        context.beginPath();
        context.arc(point[0], point[1], radius, 0, Math.PI * 2);
        context.fill();
      }

      projected.push({ body, snapshot, point, radius });
      if (options.labels) {
        drawLabel(bodyName(body), point[0] + radius + 6, point[1] + 4,
          body === selected ? '#ffd27d' : 'rgba(255,232,190,0.92)', 12, point[0]);
      }
    }
  }

  /** La Lune avec son terminateur, orienté comme dans le ciel. */
  function drawMoonSymbol(point, radius, date, place, snapshot) {
    const orientation = moonLimbOrientation(date, place);
    const phaseAngle = snapshot.phaseAngle ?? 90;
    const waxing = (snapshot.phaseDegrees ?? 0) < 180;

    context.save();
    context.translate(point[0], point[1]);
    context.rotate((270 - orientation) * DEG);

    context.fillStyle = '#efe9dc';
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();

    // Partie sombre : limbe du côté non éclairé, puis ellipse du terminateur.
    const cosine = Math.cos(phaseAngle * DEG);
    const side = waxing ? -1 : 1;
    context.beginPath();
    for (let k = 0; k <= 48; k += 1) {
      const t = (k / 48) * Math.PI;
      const x = side * radius * Math.sin(t);
      const y = -radius * Math.cos(t);
      if (k === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    for (let k = 48; k >= 0; k -= 1) {
      const t = (k / 48) * Math.PI;
      context.lineTo(side * cosine * radius * Math.sin(t), -radius * Math.cos(t));
    }
    context.closePath();
    context.fillStyle = 'rgba(12,16,26,0.88)';
    context.fill();
    context.restore();
  }

  /* -------------------------------------------------------------- horizon */

  /**
   * Sol et ligne d'horizon.
   *
   * En projection stéréographique, un grand cercle se projette toujours en
   * cercle ou en droite : l'horizon est donc une courbe simple. Quand il est
   * entièrement dans le champ — vue au zénith — le sol est ce qui se trouve à
   * l'extérieur ; sinon, la portion visible est refermée vers le bas de
   * l'écran, où se trouve nécessairement le sol puisque le haut est le zénith.
   */
  function drawHorizon() {
    // Échantillonnage centré sur la visée : la portion visible reste d'un seul
    // tenant, sans coupure artificielle à l'azimut 0.
    const samples = [];
    let allVisible = true;
    for (let offset = -180; offset <= 180; offset += 1.5) {
      const azimuth = (view.azimuth + offset + 720) % 360;
      const point = project(horizontalVector(azimuth, 0));
      if (point) samples.push(point);
      else allVisible = false;
    }

    if (samples.length > 3) {
      context.save();
      context.beginPath();
      if (allVisible) {
        // Horizon fermé : on remplit tout l'écran sauf l'intérieur du cercle.
        context.rect(0, 0, width, height);
        context.moveTo(samples[0][0], samples[0][1]);
        for (const [x, y] of samples.slice(1)) context.lineTo(x, y);
        context.closePath();
        context.fillStyle = 'rgb(9,11,17)';
        context.fill('evenodd');
      } else {
        context.moveTo(samples[0][0], samples[0][1]);
        for (const [x, y] of samples.slice(1)) context.lineTo(x, y);
        context.lineTo(samples.at(-1)[0], height * 3);
        context.lineTo(samples[0][0], height * 3);
        context.closePath();
        context.fillStyle = 'rgb(9,11,17)';
        context.fill();
      }
      context.restore();
    }

    context.strokeStyle = 'rgba(180,205,255,0.55)';
    context.lineWidth = 1.4;
    context.beginPath();
    samples.forEach(([x, y], index) => (index === 0
      ? context.moveTo(x, y) : context.lineTo(x, y)));
    if (allVisible) context.closePath();
    context.stroke();

    context.font = '600 12px system-ui, sans-serif';
    context.textAlign = 'center';
    for (const [azimuth, name] of CARDINALS) {
      const point = project(horizontalVector(azimuth, 2.5));
      if (!point) continue;
      context.fillStyle = name.length === 1
        ? 'rgba(255,220,160,0.95)' : 'rgba(190,205,235,0.68)';
      context.fillText(name, point[0], point[1]);
    }
    context.textAlign = 'left';
  }

  const pendingLabels = [];

  function drawLabel(text, x, y, color, size, anchorX = null) {
    pendingLabels.push({ text, x, y, color, size, anchorX: anchorX ?? x });
  }

  /** Étiquettes tracées en dernier, sans chevauchement. */
  function drawLabels() {
    const placed = [];
    context.textAlign = 'left';
    for (const label of pendingLabels) {
      if (label.y < 12 || label.y > height - 6) continue;
      context.font = `${label.size}px system-ui, sans-serif`;
      const textWidth = context.measureText(label.text).width;
      // Le texte qui déborderait à droite passe de l'autre côté de l'astre.
      let x = label.x;
      if (x + textWidth > width - 6) x = label.anchorX - textWidth - (label.x - label.anchorX);
      if (x < 4 || x + textWidth > width - 4) continue;
      if (placed.some((other) => Math.abs(other.x - x) < Math.max(48, textWidth * 0.6)
        && Math.abs(other.y - label.y) < 14)) continue;
      placed.push({ x, y: label.y });
      context.fillStyle = label.color;
      context.fillText(label.text, x, label.y);
    }
    pendingLabels.length = 0;
  }

  /* ----------------------------------------------------------- gestuelle */

  const pointers = new Map();
  let pinch = 0;

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: 0 });
    if (pointers.size === 2) pinch = pinchDistance();
  });

  canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    previous.moved += Math.abs(dx) + Math.abs(dy);
    previous.x = event.clientX;
    previous.y = event.clientY;

    if (pointers.size === 1) {
      // Le glissement déplace la visée d'un angle proportionnel au champ.
      const perPixel = view.fov / Math.min(width, height);
      view.azimuth = (view.azimuth - dx * perPixel * 0.9 + 360) % 360;
      view.altitude = Math.max(-88, Math.min(89.9, view.altitude + dy * perPixel * 0.9));
    } else if (pointers.size === 2) {
      const distance = pinchDistance();
      if (pinch > 0) view.fov = clampFov(view.fov * (pinch / distance));
      pinch = distance;
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    const entry = pointers.get(event.pointerId);
    if (entry && entry.moved < 8 && pointers.size === 1) identify(event);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = 0;
  });
  canvas.addEventListener('pointercancel', (event) => pointers.delete(event.pointerId));

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    view.fov = clampFov(view.fov * (1 + Math.sign(event.deltaY) * 0.1));
  }, { passive: false });

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  const clampFov = (value) => Math.max(2, Math.min(200, value));

  /* -------------------------------------------------------- désignation */

  function identify(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let best = null;
    let bestDistance = 34;
    for (const entry of projected) {
      const distance = Math.hypot(entry.point[0] - x, entry.point[1] - y);
      if (distance < bestDistance) { bestDistance = distance; best = entry; }
    }
    if (best) { showBody(best); return; }

    // À défaut d'un corps du système solaire, on cherche l'étoile la plus proche.
    const date = now();
    const obs = astroObserver(observer());
    const rotation = Astronomy.Rotation_EQJ_HOR(new Astronomy.AstroTime(date), obs);
    const matrix = rotation.rot;
    const toHorizontal = (v) => [
      matrix[0][0] * v[0] + matrix[1][0] * v[1] + matrix[2][0] * v[2],
      matrix[0][1] * v[0] + matrix[1][1] * v[1] + matrix[2][1] * v[2],
      matrix[0][2] * v[0] + matrix[1][2] * v[1] + matrix[2][2] * v[2],
    ];

    let star = null;
    let starDistance = 26;
    for (const candidate of catalogue.stars) {
      if (candidate.mag > 5.5) break;
      const point = project(toHorizontal(candidate.vector));
      if (!point) continue;
      const distance = Math.hypot(point[0] - x, point[1] - y);
      if (distance < starDistance) { starDistance = distance; star = candidate; }
    }
    if (star) showStar(star, toHorizontal);
    else { selected = null; info.hidden = true; }
  }

  function showBody(entry) {
    selected = entry.body;
    const snapshot = entry.snapshot;
    const details = [
      `Hauteur ${formatDegrees(snapshot.altitude, 1)} · azimut ${formatDegrees(snapshot.azimuth, 0)} (${cardinalPoint(snapshot.azimuth)})`,
      `AD ${formatHMS(snapshot.ra)} · Déc ${formatDMS(snapshot.dec, { sign: true })}`,
      snapshot.magnitude !== null ? `Magnitude ${formatNumber(snapshot.magnitude, { digits: 1 })}` : null,
      snapshot.angularDiameter ? `Diamètre apparent ${formatSmallAngle(snapshot.angularDiameter)}` : null,
      `Distance ${formatDistance(snapshot.distanceKm)}`,
      `Dans ${snapshot.constellation.name}`,
    ].filter(Boolean);

    info.hidden = false;
    info.replaceChildren(
      el('div', { class: 'info-flottante-titre' },
        el('span', {}, bodyName(entry.body)),
        el('span', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
          el('button', {
            class: 'info-flottante-fermer', onClick: () => navigate(`corps/${entry.body}`),
            title: 'Ouvrir la fiche',
          }, 'Fiche'),
          el('button', {
            class: 'info-flottante-fermer', 'aria-label': 'Fermer',
            onClick: () => { selected = null; info.hidden = true; },
          }, '✕'))),
      el('div', { class: 'info-flottante-detail' }, details.join(' · ')),
    );
  }

  function showStar(star, toHorizontal) {
    selected = null;
    const vector = toHorizontal(star.vector);
    const altitude = Math.asin(Math.max(-1, Math.min(1, vector[2]))) / DEG;
    const azimuth = (Math.atan2(-vector[1], vector[0]) / DEG + 360) % 360;
    const constellation = Astronomy.Constellation(star.ra / 15, star.dec);

    info.hidden = false;
    info.replaceChildren(
      el('div', { class: 'info-flottante-titre' },
        el('span', {}, star.proper || star.designation || 'Étoile'),
        el('button', {
          class: 'info-flottante-fermer', 'aria-label': 'Fermer',
          onClick: () => { info.hidden = true; },
        }, '✕')),
      el('div', { class: 'info-flottante-detail' }, [
        star.proper && star.designation ? star.designation : null,
        `Magnitude ${formatNumber(star.mag, { digits: 2 })}`,
        `Hauteur ${formatDegrees(altitude, 1)} · azimut ${formatDegrees(azimuth, 0)} (${cardinalPoint(azimuth)})`,
        `AD ${formatHMS(star.ra)} · Déc ${formatDMS(star.dec, { sign: true })}`,
        `Constellation ${constellation.symbol}`,
      ].filter(Boolean).join(' · ')),
    );
  }

  /* ------------------------------------------------------------- outils */

  const VIEWS = [
    { label: 'Voûte', azimuth: 180, altitude: 89.9, fov: 190 },
    { label: 'Nord', azimuth: 0, altitude: 38, fov: 95 },
    { label: 'Est', azimuth: 90, altitude: 38, fov: 95 },
    { label: 'Sud', azimuth: 180, altitude: 38, fov: 95 },
    { label: 'Ouest', azimuth: 270, altitude: 38, fov: 95 },
  ];

  function renderTools() {
    tools.replaceChildren(
      ...VIEWS.map((preset) => el('button', {
        class: 'puce-outil', type: 'button',
        onClick: () => Object.assign(view, {
          azimuth: preset.azimuth, altitude: preset.altitude, fov: preset.fov,
        }),
      }, preset.label)),
      ...[
        ['constellations', 'Figures'],
        ['deepSky', 'Ciel profond'],
        ['grid', 'Grille'],
        ['ecliptic', 'Écliptique'],
        ['labels', 'Noms'],
      ].map(([key, label]) => el('button', {
        class: 'puce-outil', type: 'button',
        'data-actif': options[key] ? 'oui' : 'non',
        onClick: () => {
          options[key] = !options[key];
          if (key === 'constellations') setDisplay({ showConstellations: options[key] });
          if (key === 'deepSky') setDisplay({ showDeepSky: options[key] });
          if (key === 'labels') setDisplay({ showLabels: options[key] });
          renderTools();
        },
      }, label)),
    );
  }

  /* ---------------------------------------------------------- cycle de vie */

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = container.clientWidth || window.innerWidth;
    height = container.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let animation = null;
  let stopped = false;

  function frame() {
    if (stopped) return;
    animation = requestAnimationFrame(frame);
    if (catalogue) draw();
  }

  (async () => {
    resize();
    renderTools();
    catalogue = await loadCatalogue();
    frame();
  })();

  return {
    update() {},
    refresh() {},
    destroy() {
      stopped = true;
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      setTimeBarVisible(false);
    },
  };
}
