/**
 * Dessins astronomiques en SVG : disque lunaire orienté, frise lumineuse du
 * jour, trajectoire d'un astre au-dessus de l'horizon, courbes annuelles.
 *
 * Tout est vectoriel et sans dépendance : les figures restent nettes sur les
 * écrans denses des téléphones et suivent le thème par les variables CSS.
 */
import { svg, el } from './dom.js';

/* --------------------------------------------------------- disque lunaire */

/**
 * Contour de la partie sombre du disque.
 *
 * Le terminateur est la projection d'un grand cercle : à la hauteur `y`, il se
 * situe en `x = −cos(i)·√(R²−y²)`, où `i` est l'angle de phase. La formule
 * couvre d'elle-même le croissant, le quartier et la Lune gibbeuse.
 */
function shadowPath(radius, phaseAngleDeg, waxing, steps = 72) {
  const cosine = Math.cos((phaseAngleDeg * Math.PI) / 180);
  const side = waxing ? -1 : 1; // côté sombre : gauche en phase croissante
  const points = [];
  for (let k = 0; k <= steps; k += 1) {
    const t = (k / steps) * Math.PI;
    points.push([side * radius * Math.sin(t), -radius * Math.cos(t)]);
  }
  for (let k = steps; k >= 0; k -= 1) {
    const t = (k / steps) * Math.PI;
    points.push([side * cosine * radius * Math.sin(t), -radius * Math.cos(t)]);
  }
  return `M ${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')} Z`;
}

/** Mers lunaires schématiques, en coordonnées relatives au rayon. */
const MARIA = [
  [-0.30, -0.34, 0.26], [0.06, -0.40, 0.19], [0.34, -0.20, 0.16],
  [-0.44, 0.06, 0.20], [-0.14, 0.02, 0.30], [0.20, 0.12, 0.13],
  [-0.30, 0.44, 0.15], [0.44, 0.40, 0.10],
];

/**
 * Disque lunaire tel qu'il apparaît dans le ciel du lieu.
 *
 * `orientation` est l'angle de position du limbe éclairé compté depuis le
 * zénith vers l'est ; le disque est pivoté en conséquence, cornes comprises.
 */
export function moonDisc({
  phaseAngle = 90,
  waxing = true,
  orientation = null,
  size = 120,
  showMaria = true,
} = {}) {
  const radius = size / 2 - 2;
  const rotation = orientation === null ? 0 : 270 - orientation;
  const id = `lune-${Math.random().toString(36).slice(2, 8)}`;

  const surface = svg('g', {},
    svg('circle', { cx: 0, cy: 0, r: radius, fill: `url(#${id}-sol)` }),
    showMaria ? svg('g', { opacity: '0.55' }, ...MARIA.map(([x, y, r]) => svg('circle', {
      cx: (x * radius).toFixed(1), cy: (y * radius).toFixed(1), r: (r * radius).toFixed(1),
      fill: '#8d8577',
    }))) : null,
  );

  return svg('svg', {
    class: 'figure figure--lune',
    viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`,
    width: size, height: size, role: 'img',
    'aria-label': `Lune éclairée à ${Math.round((1 + Math.cos(phaseAngle * Math.PI / 180)) / 2 * 100)} %`,
  },
  svg('defs', {},
    svg('radialGradient', { id: `${id}-sol`, cx: '38%', cy: '32%', r: '78%' },
      svg('stop', { offset: '0%', 'stop-color': '#f3ece0' }),
      svg('stop', { offset: '70%', 'stop-color': '#d8d0c2' }),
      svg('stop', { offset: '100%', 'stop-color': '#b3aa9b' })),
    svg('clipPath', { id: `${id}-disque` },
      svg('circle', { cx: 0, cy: 0, r: radius }))),
  svg('g', { transform: `rotate(${rotation.toFixed(2)})`, 'clip-path': `url(#${id}-disque)` },
    surface,
    svg('path', {
      d: shadowPath(radius, phaseAngle, waxing),
      fill: '#0a0d16',
      opacity: '0.94',
    })),
  svg('circle', {
    cx: 0, cy: 0, r: radius, fill: 'none',
    stroke: 'rgba(255,255,255,0.14)', 'stroke-width': '1',
  }));
}

/* ----------------------------------------------------- frise du jour */

/** Teintes des tranches lumineuses, du plein jour à la nuit noire. */
const LIGHT_BANDS = [
  { min: 6, color: '#8ec5ff', label: 'Jour' },
  { min: -0.833, color: '#ffc978', label: 'Heure dorée' },
  { min: -4, color: '#ff8f6b', label: 'Heure bleue' },
  { min: -6, color: '#7f6bd6', label: 'Crépuscule civil' },
  { min: -12, color: '#3b3f8f', label: 'Crépuscule nautique' },
  { min: -18, color: '#1c2050', label: 'Crépuscule astronomique' },
  { min: -90, color: '#080b16', label: 'Nuit noire' },
];

const bandColor = (altitude) =>
  (LIGHT_BANDS.find((band) => altitude >= band.min) ?? LIGHT_BANDS.at(-1)).color;

/**
 * Frise horizontale des 24 heures locales, teintée selon la hauteur du Soleil.
 * `samples` est la liste des hauteurs échantillonnées régulièrement.
 */
export function dayTimeline({
  samples, width = 320, height = 46, markers = [], cursor = null,
} = {}) {
  const figure = svg('svg', {
    class: 'figure figure--frise',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': 'Répartition de la lumière au fil de la journée',
  });

  const step = width / samples.length;
  for (let i = 0; i < samples.length; i += 1) {
    figure.appendChild(svg('rect', {
      x: (i * step).toFixed(2), y: 0,
      width: (step + 0.6).toFixed(2), height: height - 12,
      fill: bandColor(samples[i]),
    }));
  }

  for (const marker of markers) {
    const x = marker.position * width;
    figure.appendChild(svg('line', {
      x1: x.toFixed(1), y1: 0, x2: x.toFixed(1), y2: height - 12,
      stroke: 'rgba(255,255,255,0.55)', 'stroke-width': '1',
      'stroke-dasharray': marker.dashed ? '3 3' : null,
    }));
    figure.appendChild(svg('text', {
      x: Math.min(width - 2, Math.max(2, x)).toFixed(1),
      y: height - 2,
      'text-anchor': x < 26 ? 'start' : x > width - 26 ? 'end' : 'middle',
      class: 'axe-texte',
    }, marker.label));
  }

  if (cursor !== null) {
    const x = cursor * width;
    figure.appendChild(svg('polygon', {
      points: `${x - 5},0 ${x + 5},0 ${x},7`,
      fill: 'var(--accent)',
    }));
    figure.appendChild(svg('line', {
      x1: x, y1: 0, x2: x, y2: height - 12,
      stroke: 'var(--accent)', 'stroke-width': '1.5',
    }));
  }

  return figure;
}

/** Légende des tranches lumineuses. */
export const lightLegend = () => el('div', { class: 'legende' },
  ...LIGHT_BANDS.slice(0, 6).map((band) => el('span', { class: 'legende-item' },
    el('i', { style: { background: band.color } }), band.label)));

/* -------------------------------------------------- trajectoire céleste */

/**
 * Coupe verticale du ciel local : l'horizon en bas, le zénith en haut, la
 * trajectoire du corps tracée d'un bord à l'autre avec sa position actuelle.
 */
export function skyPath({
  track, current, width = 320, height = 150, color = 'var(--accent)', label = '',
} = {}) {
  const margin = { left: 26, right: 12, top: 12, bottom: 24 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  // L'échelle couvre −20° à +90° : on voit aussi ce qui se passe sous l'horizon.
  const toY = (altitude) => margin.top + plotHeight * (1 - (altitude + 20) / 110);
  const toX = (fraction) => margin.left + fraction * plotWidth;

  const figure = svg('svg', {
    class: 'figure', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `Trajectoire ${label}`,
  });

  for (const altitude of [0, 30, 60, 90]) {
    const y = toY(altitude);
    figure.appendChild(svg('line', {
      x1: margin.left, y1: y.toFixed(1), x2: width - margin.right, y2: y.toFixed(1),
      class: altitude === 0 ? 'axe' : 'grille-fine',
    }));
    figure.appendChild(svg('text', {
      x: margin.left - 5, y: (y + 3).toFixed(1), 'text-anchor': 'end', class: 'axe-texte',
    }, `${altitude}°`));
  }

  const points = track.map((sample, index) =>
    `${toX(index / (track.length - 1)).toFixed(1)},${toY(sample).toFixed(1)}`);

  // Zone sous l'horizon, grisée pour marquer l'invisibilité.
  figure.appendChild(svg('rect', {
    x: margin.left, y: toY(0).toFixed(1),
    width: plotWidth, height: (toY(-20) - toY(0)).toFixed(1),
    fill: 'rgba(255,255,255,0.04)',
  }));

  figure.appendChild(svg('polyline', {
    points: points.join(' '), class: 'courbe', stroke: color,
  }));

  if (current) {
    const x = toX(current.position);
    const y = toY(current.altitude);
    figure.appendChild(svg('circle', {
      cx: x.toFixed(1), cy: y.toFixed(1), r: 5, fill: color,
      stroke: 'var(--fond)', 'stroke-width': '2',
    }));
  }

  return figure;
}

/* -------------------------------------------------------- courbe simple */

/**
 * Courbe d'une grandeur au fil d'une année ou d'un mois.
 * `series` : [{ points: [[x, y]], color, label }], coordonnées en unités réelles.
 */
export function lineChart({
  series, width = 320, height = 170, xTicks = [], yTicks = [],
  xLabel = '', yLabel = '', zeroLine = false, marker = null,
} = {}) {
  const margin = { left: 38, right: 12, top: 12, bottom: 26 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = (yMax - yMin) || 1;
  const yLow = yMin - ySpan * 0.08;
  const yHigh = yMax + ySpan * 0.08;

  const toX = (x) => margin.left + ((x - xMin) / ((xMax - xMin) || 1)) * plotWidth;
  const toY = (y) => margin.top + (1 - (y - yLow) / (yHigh - yLow)) * plotHeight;

  const figure = svg('svg', {
    class: 'figure', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `${yLabel} en fonction de ${xLabel}`,
  });

  for (const tick of yTicks) {
    const y = toY(tick.value);
    if (!Number.isFinite(y)) continue;
    figure.appendChild(svg('line', {
      x1: margin.left, y1: y.toFixed(1), x2: width - margin.right, y2: y.toFixed(1),
      class: 'grille-fine',
    }));
    figure.appendChild(svg('text', {
      x: margin.left - 5, y: (y + 3).toFixed(1), 'text-anchor': 'end', class: 'axe-texte',
    }, tick.label));
  }

  if (zeroLine && yLow < 0 && yHigh > 0) {
    figure.appendChild(svg('line', {
      x1: margin.left, y1: toY(0).toFixed(1), x2: width - margin.right, y2: toY(0).toFixed(1),
      class: 'axe',
    }));
  }

  for (const tick of xTicks) {
    const x = toX(tick.value);
    figure.appendChild(svg('text', {
      x: x.toFixed(1), y: height - 8, 'text-anchor': 'middle', class: 'axe-texte',
    }, tick.label));
  }

  for (const line of series) {
    figure.appendChild(svg('polyline', {
      points: line.points.map(([x, y]) => `${toX(x).toFixed(1)},${toY(y).toFixed(1)}`).join(' '),
      class: 'courbe',
      stroke: line.color ?? 'var(--accent)',
      'stroke-dasharray': line.dashed ? '4 4' : null,
    }));
  }

  if (marker) {
    figure.appendChild(svg('line', {
      x1: toX(marker.x).toFixed(1), y1: margin.top,
      x2: toX(marker.x).toFixed(1), y2: margin.top + plotHeight,
      stroke: 'var(--accent)', 'stroke-width': '1', 'stroke-dasharray': '3 3',
    }));
    if (Number.isFinite(marker.y)) {
      figure.appendChild(svg('circle', {
        cx: toX(marker.x).toFixed(1), cy: toY(marker.y).toFixed(1), r: 4,
        fill: 'var(--accent)', stroke: 'var(--fond)', 'stroke-width': '2',
      }));
    }
  }

  return figure;
}

/** Nuage de points, utilisé pour l'analemme. */
export function scatterChart({
  points, width = 300, height = 300, xLabel = '', yLabel = '', highlights = [],
} = {}) {
  const margin = { left: 40, right: 14, top: 14, bottom: 28 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const xMin = Math.min(...xs) - 1;
  const xMax = Math.max(...xs) + 1;
  const yMin = Math.min(...ys) - 2;
  const yMax = Math.max(...ys) + 2;
  const toX = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const toY = (y) => margin.top + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

  const figure = svg('svg', {
    class: 'figure', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `${yLabel} selon ${xLabel}`,
  });

  figure.appendChild(svg('line', {
    x1: toX(0).toFixed(1), y1: margin.top, x2: toX(0).toFixed(1),
    y2: margin.top + plotHeight, class: 'axe',
  }));

  figure.appendChild(svg('polyline', {
    points: points.map(([x, y]) => `${toX(x).toFixed(1)},${toY(y).toFixed(1)}`).join(' '),
    class: 'courbe', stroke: 'var(--accent)',
  }));

  for (const highlight of highlights) {
    figure.appendChild(svg('circle', {
      cx: toX(highlight.x).toFixed(1), cy: toY(highlight.y).toFixed(1), r: 3.5,
      fill: highlight.color ?? 'var(--azur)',
    }));
    figure.appendChild(svg('text', {
      x: (toX(highlight.x) + 7).toFixed(1), y: (toY(highlight.y) + 3).toFixed(1),
      class: 'axe-texte',
    }, highlight.label));
  }

  return figure;
}

export { bandColor, LIGHT_BANDS };
