/**
 * Système solaire en trois dimensions.
 *
 * Les positions ne sont pas des orbites idéalisées : chaque corps est placé à
 * partir du vecteur héliocentrique calculé par le moteur d'éphémérides, ce qui
 * restitue excentricités, inclinaisons et perturbations. Les orbites tracées
 * sont l'échantillonnage de ces mêmes positions sur une révolution complète.
 */
import * as THREE from '../../vendor/three.module.min.js';
import * as Astronomy from '../../vendor/astronomy.js';
import { el, button, chip } from '../ui/dom.js';
import { bodyCanvas, ringCanvas, glowCanvas } from '../ui/textures.js';
import { now, display, setDisplay } from '../core/state.js';
import { bodyName, Body } from '../core/ephem.js';
import { PLANETS as PLANET_DATA, SUN, MOONS, BODY_RADIUS_KM } from '../data/bodies.js';
import { formatAu, formatKm, formatNumber, formatDegrees, formatDateTime, formatPeriod } from '../core/format.js';
import { timeZone } from '../core/state.js';

const KM_PER_AU = 149597870.7;

/** Corps rendus, du plus interne au plus externe. */
const RENDERED = [
  { id: 'Mercury', body: Body.Mercury },
  { id: 'Venus', body: Body.Venus },
  { id: 'Earth', body: Body.Earth },
  { id: 'Mars', body: Body.Mars },
  { id: 'Jupiter', body: Body.Jupiter },
  { id: 'Saturn', body: Body.Saturn },
  { id: 'Uranus', body: Body.Uranus },
  { id: 'Neptune', body: Body.Neptune },
  { id: 'Pluto', body: Body.Pluto },
];

/**
 * Modes d'échelle. Le système solaire est presque entièrement vide : à
 * distances vraies, les planètes deviennent des points invisibles. Chaque mode
 * assume un compromis différent, explicité à l'écran.
 */
const SCALES = {
  compressee: {
    label: 'Compressée',
    hint: 'Distances comprimées et corps agrandis : tout le système tient à l’écran.',
    distance: (au) => 1.5 * au ** 0.38,
    radius: (km) => 0.04 + 0.11 * (km / 71492) ** 0.42,
  },
  distances: {
    label: 'Distances réelles',
    hint: 'Distances exactes ; les corps restent agrandis pour rester visibles.',
    distance: (au) => au,
    radius: (km) => Math.max(0.02, (km / KM_PER_AU) * 2200),
  },
  vraie: {
    label: 'Tout à l’échelle',
    hint: 'Distances et tailles exactes : le vide domine, comme dans la réalité.',
    distance: (au) => au,
    radius: (km) => (km / KM_PER_AU),
    defaultDistance: 85,
  },
};

/** Position héliocentrique écliptique, en unités astronomiques. */
function helioEcliptic(body, date) {
  const vector = Astronomy.Ecliptic(Astronomy.HelioVector(body, date)).vec;
  // Repère du rendu : Y vers le nord écliptique, plan de l'écliptique en XZ.
  return new THREE.Vector3(vector.x, vector.z, -vector.y);
}

export function mount(container, { setTimeBarVisible, navigate }) {
  const canvas = el('canvas', { class: 'surface' });
  const overlay = el('div', { class: 'calque-etiquettes' });
  const tools = el('div', { class: 'surface-outils surface-outils--defilante' });
  const hint = el('p', { class: 'surface-indication' });
  const info = el('div', { class: 'info-flottante', hidden: true });
  container.append(canvas, overlay, tools, hint, info);
  setTimeBarVisible(true);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x03050b, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.0001, 20000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.075));
  const sunLight = new THREE.PointLight(0xfff2d6, 3.2, 0, 0);
  scene.add(sunLight);

  /* ------------------------------------------------------- champ d'étoiles */

  let starField = null;
  async function buildStarField() {
    const response = await fetch('data/stars.json');
    const data = await response.json();
    const positions = [];
    const colors = [];
    const sizes = [];
    const radius = 900;
    for (const [ra, dec, mag, bv] of data.stars) {
      if (mag > 5.6) continue;
      const raRad = (ra * Math.PI) / 180;
      const decRad = (dec * Math.PI) / 180;
      // Sphère céleste équatoriale, inclinée de l'obliquité pour coïncider
      // avec le repère écliptique de la scène.
      const x = Math.cos(decRad) * Math.cos(raRad);
      const y = Math.cos(decRad) * Math.sin(raRad);
      const z = Math.sin(decRad);
      const tilt = (23.4393 * Math.PI) / 180;
      const yEcl = y * Math.cos(tilt) + z * Math.sin(tilt);
      const zEcl = -y * Math.sin(tilt) + z * Math.cos(tilt);
      positions.push(x * radius, zEcl * radius, -yEcl * radius);
      const color = starColor(bv);
      colors.push(color.r, color.g, color.b);
      sizes.push(Math.max(0.6, 3.4 - mag * 0.42));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('taille', new THREE.Float32BufferAttribute(sizes, 1));
    starField = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 2.2, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    }));
    starField.renderOrder = -1;
    scene.add(starField);
  }

  /** Teinte approchée d'une étoile d'après son indice de couleur B−V. */
  function starColor(bv) {
    const t = Math.max(-0.3, Math.min(1.8, bv ?? 0));
    const warm = (t + 0.3) / 2.1;
    return new THREE.Color(
      0.66 + warm * 0.34,
      0.74 + warm * 0.16,
      1 - warm * 0.42,
    );
  }

  /* -------------------------------------------------------------- Soleil */

  const sunGroup = new THREE.Group();
  const sunTexture = new THREE.CanvasTexture(bodyCanvas('Sun'));
  sunTexture.colorSpace = THREE.SRGBColorSpace;
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshBasicMaterial({ map: sunTexture }),
  );
  const haloTexture = new THREE.CanvasTexture(glowCanvas('255,206,120'));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.85,
  }));
  sunGroup.add(sunMesh, halo);
  scene.add(sunGroup);

  /* ------------------------------------------------------------ planètes */

  const objects = new Map();

  function buildBody(entry) {
    const data = PLANET_DATA.find((p) => p.id === entry.id)
      ?? { id: entry.id, name: bodyName(entry.body), color: '#c8b6a6', physical: { radius: BODY_RADIUS_KM[entry.id], obliquity: 0 } };

    const group = new THREE.Group();
    const texture = new THREE.CanvasTexture(bodyCanvas(entry.id, { landRings: landData }));
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0 }),
    );
    // L'aplatissement des géantes est visible : on l'applique à la sphère.
    const polar = data.physical.polarRadius ?? data.physical.radius;
    mesh.scale.set(1, polar / data.physical.radius, 1);
    // L'obliquité incline l'axe de rotation par rapport au plan de l'orbite.
    mesh.rotation.z = THREE.MathUtils.degToRad(data.physical.obliquity ?? 0);
    group.add(mesh);

    let rings = null;
    if (entry.id === 'Saturn') {
      rings = buildRings(1.24, 2.32);
      rings.rotation.z = THREE.MathUtils.degToRad(data.physical.obliquity);
      group.add(rings);
    }

    const marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas(hexToRgbString(data.color), 128)),
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, opacity: 0.5,
    }));
    marker.renderOrder = 2;
    group.add(marker);

    scene.add(group);
    return { ...entry, data, group, mesh, rings, marker, orbit: null, moons: [] };
  }

  /** Disque annulaire texturé radialement. */
  function buildRings(inner, outer) {
    const geometry = new THREE.RingGeometry(inner, outer, 128, 1);
    // Les UV par défaut d'un anneau ne suivent pas le rayon : on les refait
    // pour que la texture radiale se déroule du bord interne au bord externe.
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i += 1) {
      const distance = Math.hypot(position.getX(i), position.getY(i));
      uv.setXY(i, (distance - inner) / (outer - inner), 0.5);
    }
    const texture = new THREE.CanvasTexture(ringCanvas());
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map: texture, transparent: true, side: THREE.DoubleSide,
      roughness: 1, metalness: 0, alphaTest: 0.02,
    }));
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  /* -------------------------------------------------------------- orbites */

  /** Trace l'orbite en échantillonnant les positions sur une révolution. */
  function buildOrbit(entry, scaleKey) {
    const scale = SCALES[scaleKey];
    const period = Astronomy.PlanetOrbitalPeriod(entry.body);
    const reference = now();
    const points = [];
    const steps = 256;
    for (let i = 0; i <= steps; i += 1) {
      const date = new Date(reference.getTime() + (i / steps) * period * 86400000);
      const position = helioEcliptic(entry.body, date);
      const length = position.length();
      points.push(position.multiplyScalar(scale.distance(length) / length));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: new THREE.Color(entry.data.color).multiplyScalar(0.55),
      transparent: true, opacity: 0.55,
    }));
    line.renderOrder = -1;
    return line;
  }

  /* ---------------------------------------------------------------- lunes */

  /** Lunes rendues : la Lune, et les quatre satellites galiléens. */
  function buildMoons(entry) {
    if (entry.id === 'Earth') {
      return [{ id: 'Moon', name: 'Lune', radiusKm: 1737.4, ...makeMoonMesh('Moon') }];
    }
    if (entry.id === 'Jupiter') {
      return ['Io', 'Europa', 'Ganymede', 'Callisto'].map((id) => {
        const info = MOONS.Jupiter.find((m) => m.id === id);
        return { id, name: info.name, radiusKm: info.radius, ...makeMoonMesh(id) };
      });
    }
    return [];
  }

  function makeMoonMesh(id) {
    const texture = new THREE.CanvasTexture(bodyCanvas(id));
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }),
    );
    // Un halo discret garde la lune repérable même réduite à quelques pixels.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas('220,220,235', 128)),
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, opacity: 0.35,
    }));
    halo.scale.setScalar(5);
    mesh.add(halo);
    scene.add(mesh);
    return { mesh };
  }

  /* ------------------------------------------------------------- caméra */

  /** Cadrages prédéfinis, du système interne à l'orbite de Pluton. */
  const FRAMINGS = [
    { key: 'ensemble', label: 'Vue d’ensemble', au: 39.5 },
    { key: 'interne', label: 'Système interne', au: 1.75 },
    { key: 'externe', label: 'Planètes externes', au: 30.5 },
  ];

  /**
   * Distance de caméra qui fait tenir un rayon donné dans le cadre.
   * En portrait, c'est l'ouverture horizontale qui contraint : la calculer
   * évite que les planètes externes sortent du champ.
   */
  function fitDistance(auRadius) {
    const verticalHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalf = Math.atan(Math.tan(verticalHalf) * camera.aspect);
    const radius = SCALES[scaleKey].distance(auRadius);
    return (radius / Math.min(Math.tan(verticalHalf), Math.tan(horizontalHalf))) * 1.1;
  }

  /**
   * Recul nécessaire pour cadrer un corps et son cortège de lunes.
   * La distance est déduite des données orbitales, pas de la position courante
   * des maillages : au moment du clic, les lunes viennent parfois d'être
   * rendues visibles et n'ont pas encore été placées.
   */
  function followDistance(entry) {
    const scale = SCALES[scaleKey];
    if (!entry) return fitDistance(0.02);
    const planetRadius = Math.max(scale.radius(entry.data.physical.radius), 1e-6);
    let outermost = planetRadius * 2.2;
    for (const moon of entry.moons) {
      const info = (MOONS[entry.id] ?? []).find((m) => m.id === moon.id)
        ?? { semiMajorAxisKm: 384399 };
      const ratio = info.semiMajorAxisKm / entry.data.physical.radius;
      const rendered = scaleKey === 'vraie'
        ? info.semiMajorAxisKm / KM_PER_AU
        : planetRadius * Math.min(ratio, 3 + 3 * Math.log10(Math.max(ratio, 1.01)));
      outermost = Math.max(outermost, rendered * 1.18);
    }
    const verticalHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalf = Math.atan(Math.tan(verticalHalf) * camera.aspect);
    return outermost / Math.min(Math.tan(verticalHalf), Math.tan(horizontalHalf));
  }

  function applyFraming(key) {
    const framing = FRAMINGS.find((f) => f.key === key) ?? FRAMINGS[0];
    framingKey = framing.key;
    view.focus = null;
    view.distance = clampDistance(fitDistance(framing.au));
    renderTools();
  }

  // Coordonnées sphériques autour d'une cible : simple, prévisible au doigt.
  const view = {
    target: new THREE.Vector3(0, 0, 0),
    focus: null,
    distance: 30,
    azimuth: 0.6,
    elevation: 0.55,
  };

  function updateCamera() {
    const cosElevation = Math.cos(view.elevation);
    const offset = new THREE.Vector3(
      view.distance * cosElevation * Math.sin(view.azimuth),
      view.distance * Math.sin(view.elevation),
      view.distance * cosElevation * Math.cos(view.azimuth),
    );
    camera.position.copy(view.target).add(offset);
    camera.lookAt(view.target);
    // Le plan proche doit suivre l'échelle, sinon les corps proches disparaissent.
    camera.near = Math.max(1e-6, view.distance * 0.0012);
    camera.far = Math.max(4000, view.distance * 400);
    camera.updateProjectionMatrix();
  }

  /* ----------------------------------------------------------- gestuelle */

  const pointers = new Map();
  let pinchDistance = 0;

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: 0 });
    if (pointers.size === 2) pinchDistance = currentPinch();
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
      view.azimuth -= dx * 0.006;
      view.elevation = Math.max(-1.45, Math.min(1.45, view.elevation + dy * 0.006));
    } else if (pointers.size === 2) {
      const distance = currentPinch();
      if (pinchDistance > 0) {
        view.distance = clampDistance(view.distance * (pinchDistance / distance));
      }
      pinchDistance = distance;
    }
  });

  const releasePointer = (event) => {
    const entry = pointers.get(event.pointerId);
    if (entry && entry.moved < 8 && pointers.size === 1) pick(event);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', (event) => pointers.delete(event.pointerId));

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    view.distance = clampDistance(view.distance * (1 + Math.sign(event.deltaY) * 0.12));
  }, { passive: false });

  function currentPinch() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  const clampDistance = (value) => Math.max(0.0005, Math.min(1200, value));

  /* -------------------------------------------------------- désignation */

  const raycaster = new THREE.Raycaster();

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const targets = [sunMesh, ...[...objects.values()].map((entry) => entry.mesh)];
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) {
      // Les corps lointains sont minuscules : on rattrape le clic au plus proche
      // en distance angulaire à l'écran.
      const nearest = nearestOnScreen(pointer);
      select(nearest);
      return;
    }
    const hit = hits[0].object;
    if (hit === sunMesh) select('Sun');
    else select([...objects.values()].find((entry) => entry.mesh === hit)?.id ?? null);
  }

  function nearestOnScreen(pointer) {
    let best = null;
    let bestDistance = 0.09;
    const candidates = [['Sun', sunGroup.position], ...[...objects.values()]
      .map((entry) => [entry.id, entry.group.position])];
    for (const [id, position] of candidates) {
      const projected = position.clone().project(camera);
      if (projected.z > 1) continue;
      const distance = Math.hypot(projected.x - pointer.x, projected.y - pointer.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = id;
      }
    }
    return best;
  }

  let selected = null;

  function select(id) {
    selected = id;
    renderInfo();
  }

  function renderInfo() {
    if (!selected) {
      info.hidden = true;
      return;
    }
    info.hidden = false;
    const date = now();
    const isSun = selected === 'Sun';
    const entry = objects.get(selected);
    const data = isSun ? SUN : entry?.data;
    if (!data) { info.hidden = true; return; }

    const lines = [];
    if (isSun) {
      lines.push(`Rayon ${formatKm(SUN.physical.radius)}`);
      lines.push(`${formatNumber(SUN.physical.surfaceTemperature)} °C en surface`);
    } else {
      const helio = Astronomy.HelioDistance(entry.body, date);
      const geo = Astronomy.Equator(entry.body, date, new Astronomy.Observer(0, 0, 0), true, true).dist;
      lines.push(`${formatAu(helio, 3)} du Soleil · ${formatAu(geo, 3)} de la Terre`);
      lines.push(`Révolution en ${formatPeriod(data.orbit.period)} · jour de ${formatPeriod(Math.abs(data.physical.rotationPeriod))}`);
      lines.push(`Rayon ${formatKm(data.physical.radius)} · obliquité ${formatDegrees(data.physical.obliquity, 1)}`);
    }

    info.replaceChildren(
      el('div', { class: 'info-flottante-titre' },
        el('span', {}, isSun ? 'Soleil' : data.name),
        el('span', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          button('Fiche', () => navigate(`corps/${isSun ? 'Sun' : selected}`), { variant: 'discret' }),
          el('button', { class: 'info-flottante-fermer', onClick: () => select(null), 'aria-label': 'Fermer' }, '✕'))),
      el('div', { class: 'info-flottante-detail' }, lines.join(' · ')),
      el('div', { style: { display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
        button(view.focus === selected ? 'Suivi actif' : 'Suivre ce corps', () => {
          view.focus = view.focus === selected ? null : selected;
          if (view.focus) {
            view.distance = isSun
              ? fitDistance(0.5)
              : clampDistance(followDistance(entry));
          } else {
            applyFraming(framingKey);
          }
          renderInfo();
        }, { variant: view.focus === selected ? 'accent' : 'neutre' })),
    );
  }

  /* ------------------------------------------------------------- outils */

  let scaleKey = display().systemScale in SCALES ? display().systemScale : 'compressee';
  let framingKey = 'ensemble';
  let showOrbits = display().showOrbits;
  let showLabels = display().showLabels;

  function renderTools() {
    tools.replaceChildren(
      ...Object.entries(SCALES).map(([key, scale]) => el('button', {
        class: 'puce-outil', type: 'button',
        'data-actif': key === scaleKey ? 'oui' : 'non',
        onClick: () => {
          scaleKey = key;
          setDisplay({ systemScale: key });
          rebuildOrbits();
          applyFraming(framingKey);
        },
      }, scale.label)),
      el('button', {
        class: 'puce-outil', type: 'button',
        'data-actif': showOrbits ? 'oui' : 'non',
        onClick: () => { showOrbits = !showOrbits; setDisplay({ showOrbits }); renderTools(); },
      }, 'Orbites'),
      el('button', {
        class: 'puce-outil', type: 'button',
        'data-actif': showLabels ? 'oui' : 'non',
        onClick: () => { showLabels = !showLabels; setDisplay({ showLabels }); renderTools(); },
      }, 'Noms'),
      ...FRAMINGS.map((framing) => el('button', {
        class: 'puce-outil', type: 'button',
        'data-actif': framing.key === framingKey && !view.focus ? 'oui' : 'non',
        onClick: () => {
          view.azimuth = 0.6;
          view.elevation = 0.55;
          applyFraming(framing.key);
        },
      }, framing.label)),
    );
    hint.textContent = SCALES[scaleKey].hint;
  }

  /* --------------------------------------------------------- étiquettes */

  const labels = new Map();

  function ensureLabel(id, text) {
    let node = labels.get(id);
    if (!node) {
      node = el('button', {
        class: 'etiquette', type: 'button', onClick: () => select(id.replace(/^moon-/, '')),
      }, text);
      overlay.appendChild(node);
      labels.set(id, node);
    }
    return node;
  }

  /**
   * Place les étiquettes en une passe, de la plus importante à la moins
   * importante, en écartant celles qui se chevaucheraient. Sans ce tri, la
   * bousculade du système interne rend les noms illisibles.
   */
  function renderLabels(candidates) {
    const placed = [];
    const seen = new Set();

    if (showLabels) {
      const projected = candidates
        .map((candidate) => {
          const point = candidate.position.clone().project(camera);
          return { ...candidate, point };
        })
        .filter((candidate) => candidate.point.z <= 1
          && Math.abs(candidate.point.x) < 1.15 && Math.abs(candidate.point.y) < 1.15)
        .sort((a, b) => b.priority - a.priority);

      const width = overlay.clientWidth || 1;
      const height = overlay.clientHeight || 1;
      for (const candidate of projected) {
        const x = (candidate.point.x * 0.5 + 0.5) * width;
        const y = (-candidate.point.y * 0.5 + 0.5) * height;
        const collides = placed.some(
          (other) => Math.abs(other.x - x) < 78 && Math.abs(other.y - y) < 20,
        );
        if (collides && candidate.id !== selected) continue;
        placed.push({ x, y });
        seen.add(candidate.id);
        const node = ensureLabel(candidate.id, candidate.text);
        node.style.display = 'block';
        // Les étiquettes proches du bord basculent à gauche du corps.
        const flip = x > width - 96;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.cote = flip ? 'gauche' : 'droite';
        node.dataset.actif = candidate.id === selected ? 'oui' : 'non';
      }
    }

    for (const [id, node] of labels) {
      if (!seen.has(id)) node.style.display = 'none';
    }
  }

  /* ----------------------------------------------------------- rendu */

  let landData = null;
  let orbitsBuilt = false;

  function rebuildOrbits() {
    for (const entry of objects.values()) {
      if (entry.orbit) { scene.remove(entry.orbit); entry.orbit.geometry.dispose(); }
      entry.orbit = buildOrbit(entry, scaleKey);
      scene.add(entry.orbit);
    }
    orbitsBuilt = true;
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  function frame() {
    if (stopped) return;
    animation = requestAnimationFrame(frame);
    const date = now();
    const scale = SCALES[scaleKey];

    // Soleil
    const sunRadius = Math.max(scale.radius(SUN.physical.radius), 1e-5);
    sunGroup.scale.setScalar(sunRadius);
    halo.scale.setScalar(6);
    sunLight.position.set(0, 0, 0);
    sunMesh.rotation.y = (date.getTime() / 86400000 / SUN.physical.rotationPeriod) * Math.PI * 2;

    for (const entry of objects.values()) {
      const position = helioEcliptic(entry.body, date);
      const length = position.length();
      const scaled = position.clone().multiplyScalar(scale.distance(length) / length);
      entry.group.position.copy(scaled);
      const radius = Math.max(scale.radius(entry.data.physical.radius), 1e-6);
      entry.group.scale.setScalar(radius);

      // Rotation propre : l'angle de rotation vient de l'éphéméride, la lente
      // dérive du méridien est donc exacte, y compris pour les rétrogrades.
      try {
        entry.mesh.rotation.y = THREE.MathUtils.degToRad(
          Astronomy.RotationAxis(entry.body, date).spin,
        );
      } catch {
        entry.mesh.rotation.y += 0.002;
      }

      // Le halo appartient au groupe, déjà mis à l'échelle du corps : sa taille
      // est divisée par ce facteur pour rester d'un diamètre angulaire constant
      // à l'écran. Sans cela, les planètes disparaissent en mode « tout à
      // l'échelle », où elles font moins d'un pixel.
      const haloWorld = Math.max(radius * 4.5, view.distance * 0.012);
      entry.marker.scale.setScalar(haloWorld / radius);
      entry.marker.material.opacity = haloWorld > radius * 5 ? 0.7 : 0.42;
      if (entry.orbit) entry.orbit.visible = showOrbits;

      updateMoons(entry, date, scale, scaled);
    }

    if (view.focus) {
      const focused = view.focus === 'Sun' ? sunGroup : objects.get(view.focus)?.group;
      if (focused) view.target.lerp(focused.position, 0.22);
    } else {
      view.target.lerp(new THREE.Vector3(0, 0, 0), 0.12);
    }

    updateCamera();
    renderer.render(scene, camera);

    const candidates = [{ id: 'Sun', text: 'Soleil', position: sunGroup.position, priority: 100 }];
    for (const entry of objects.values()) {
      candidates.push({
        id: entry.id,
        text: entry.data.name,
        position: entry.group.position,
        // Les corps sélectionnés ou volumineux gardent la priorité d'affichage.
        priority: (entry.id === selected ? 200 : 0) + entry.data.physical.radius / 1000,
      });
      for (const moon of entry.moons) {
        if (!moon.mesh.visible) continue;
        candidates.push({
          id: `moon-${moon.id}`, text: moon.name,
          position: moon.mesh.position, priority: 50 + moon.radiusKm / 1000,
        });
      }
    }
    renderLabels(candidates);
  }

  /**
   * Place les lunes autour de leur planète.
   *
   * À l'échelle du système, une lune placée à sa vraie distance relative
   * sortirait de l'orbite de sa planète : la distance est comprimée
   * logarithmiquement, ce qui préserve l'ordre et le rythme du ballet sans
   * quitter le voisinage de l'hôte. Les lunes n'apparaissent qu'une fois la
   * caméra assez proche pour qu'elles soient distinguables.
   */
  function updateMoons(entry, date, scale, planetPosition) {
    if (!entry.moons.length) return;
    const planetRadius = Math.max(scale.radius(entry.data.physical.radius), 1e-6);
    const visible = view.focus === entry.id || selected === entry.id
      || view.distance < planetRadius * 90;

    for (const moon of entry.moons) {
      moon.mesh.visible = visible;
      if (!visible) continue;

      let offset;
      if (moon.id === 'Moon') {
        const geo = Astronomy.Ecliptic(Astronomy.GeoMoon(date)).vec;
        offset = new THREE.Vector3(geo.x, geo.z, -geo.y);
      } else {
        const state = Astronomy.JupiterMoons(date)[moon.id.toLowerCase()];
        const equatorial = new Astronomy.Vector(
          state.x, state.y, state.z, new Astronomy.AstroTime(date),
        );
        const ecliptic = Astronomy.Ecliptic(equatorial).vec;
        offset = new THREE.Vector3(ecliptic.x, ecliptic.z, -ecliptic.y);
      }

      const trueDistanceKm = offset.length() * KM_PER_AU;
      const ratio = trueDistanceKm / entry.data.physical.radius;
      const rendered = scaleKey === 'vraie'
        ? offset.length()
        : planetRadius * Math.min(ratio, 3 + 3 * Math.log10(Math.max(ratio, 1.01)));

      moon.mesh.position.copy(planetPosition)
        .add(offset.normalize().multiplyScalar(rendered));

      // La taille d'une lune se lit par rapport à son hôte, pas sur l'échelle
      // des planètes : celle-ci, très comprimée, en ferait des jumelles de
      // Jupiter. Le rapport réel est adouci pour rester visible.
      const sizeRatio = moon.radiusKm / entry.data.physical.radius;
      moon.mesh.scale.setScalar(scaleKey === 'vraie'
        ? Math.max(scale.radius(moon.radiusKm), 1e-9)
        : planetRadius * sizeRatio ** 0.75);
    }
  }

  /* ------------------------------------------------------------ démarrage */

  let animation = null;
  let stopped = false;

  (async () => {
    try {
      landData = (await (await fetch('data/land.json')).json()).rings;
    } catch {
      landData = null;
    }
    for (const entry of RENDERED) {
      const built = buildBody(entry);
      built.moons = buildMoons(built);
      objects.set(entry.id, built);
    }
    rebuildOrbits();
    await buildStarField();
    resize();
    applyFraming('ensemble');
    updateCamera();
    frame();
  })();

  return {
    update() { renderInfo(); },
    refresh() { if (orbitsBuilt) rebuildOrbits(); },
    destroy() {
      stopped = true;
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      setTimeBarVisible(false);
      renderer.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
        else object.material?.dispose?.();
      });
    },
  };
}

/** « #a1b2c3 » → « 161,178,195 », format attendu par les dégradés du canevas. */
function hexToRgbString(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
}
