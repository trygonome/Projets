/**
 * Mise en forme des grandeurs astronomiques en français.
 *
 * Toutes les fonctions de date acceptent un fuseau IANA explicite : l'application
 * doit pouvoir afficher les circonstances d'un lieu distant sans dépendre du
 * fuseau de l'appareil.
 */

const LOCALE = 'fr-FR';

const cachedFormatters = new Map();

function dateFormatter(timeZone, options) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let formatter = cachedFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
    cachedFormatters.set(key, formatter);
  }
  return formatter;
}

export const deviceTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Décalage du fuseau, en minutes, à l'instant donné (positif à l'est). */
export function timeZoneOffsetMinutes(date, timeZone) {
  const parts = dateFormatter(timeZone, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour'), get('minute'), get('second'),
  );
  return Math.round((asUtc - date.getTime() * 1) / 60000);
}

/** Nom court du fuseau tel qu'il s'affiche à cette date (« UTC+2 », « CEST »). */
export function timeZoneLabel(date, timeZone) {
  const parts = dateFormatter(timeZone, { timeZoneName: 'shortOffset' })
    .formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}

/* ------------------------------------------------------------------- dates */

export function formatTime(date, timeZone, { seconds = false } = {}) {
  if (!date) return '—';
  return dateFormatter(timeZone, {
    hour: '2-digit', minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hourCycle: 'h23',
  }).format(date);
}

export function formatDate(date, timeZone, { style = 'medium' } = {}) {
  if (!date) return '—';
  const options = style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : style === 'short'
      ? { day: '2-digit', month: '2-digit', year: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return dateFormatter(timeZone, options).format(date);
}

export function formatDateTime(date, timeZone, options = {}) {
  if (!date) return '—';
  return `${formatDate(date, timeZone, options)} à ${formatTime(date, timeZone, options)}`;
}

/** Jour de l'année civile dans le fuseau donné, pour comparer deux instants. */
export function calendarDay(date, timeZone) {
  return dateFormatter(timeZone, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** Écart relatif lisible : « dans 3 j », « il y a 2 h ». */
export function formatRelative(date, reference = new Date()) {
  if (!date) return '—';
  const seconds = (date.getTime() - reference.getTime()) / 1000;
  const absolute = Math.abs(seconds);
  const units = [
    ['year', 31557600], ['month', 2629800], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  const [unit, size] = units.find(([, s]) => absolute >= s) ?? units.at(-1);
  return new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
    .format(Math.round(seconds / size), unit);
}

/* ------------------------------------------------------------------ nombres */

export function formatNumber(value, { digits = 0, maxDigits } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: maxDigits ?? digits,
  }).format(value);
}

/** Notation scientifique française : 1,989 × 10³⁰ */
const SUPERSCRIPTS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function formatScientific(value, digits = 3) {
  if (!Number.isFinite(value) || value === 0) return formatNumber(value, { digits });
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  const superscript = String(exponent).split('').map((c) => SUPERSCRIPTS[c]).join('');
  return `${formatNumber(mantissa, { digits })} × 10${superscript}`;
}

/* ------------------------------------------------------------------- angles */

const normalize360 = (deg) => ((deg % 360) + 360) % 360;

/** Degrés décimaux → « 23° 26′ 12″ ». */
export function formatDMS(degrees, { digits = 0, sign = false, width = 2 } = {}) {
  if (!Number.isFinite(degrees)) return '—';
  const negative = degrees < 0;
  let value = Math.abs(degrees);
  let d = Math.floor(value);
  value = (value - d) * 60;
  let m = Math.floor(value);
  let s = (value - m) * 60;
  if (Number(s.toFixed(digits)) >= 60) { s = 0; m += 1; }
  if (m >= 60) { m = 0; d += 1; }
  const prefix = negative ? '−' : (sign ? '+' : '');
  return `${prefix}${String(d).padStart(width, '0')}° `
    + `${String(m).padStart(2, '0')}′ ${formatNumber(s, { digits }).padStart(digits ? 3 + digits : 2, '0')}″`;
}

/** Ascension droite en degrés → « 6 h 45 min 09 s ». */
export function formatHMS(degrees, { digits = 0 } = {}) {
  if (!Number.isFinite(degrees)) return '—';
  const hours = normalize360(degrees) / 15;
  let h = Math.floor(hours);
  let value = (hours - h) * 60;
  let m = Math.floor(value);
  let s = (value - m) * 60;
  if (Number(s.toFixed(digits)) >= 60) { s = 0; m += 1; }
  if (m >= 60) { m = 0; h = (h + 1) % 24; }
  return `${h} h ${String(m).padStart(2, '0')} min ${formatNumber(s, { digits }).padStart(digits ? 3 + digits : 2, '0')} s`;
}

/** Angle petit : bascule automatiquement en minutes ou secondes d'arc. */
export function formatSmallAngle(degrees) {
  if (!Number.isFinite(degrees)) return '—';
  const arcsec = degrees * 3600;
  if (Math.abs(arcsec) < 60) return `${formatNumber(arcsec, { digits: 1 })}″`;
  if (Math.abs(degrees) < 1) return `${formatNumber(arcsec / 60, { digits: 1 })}′`;
  return `${formatNumber(degrees, { digits: 2 })}°`;
}

export function formatDegrees(degrees, digits = 1) {
  return Number.isFinite(degrees) ? `${formatNumber(degrees, { digits })}°` : '—';
}

/** Azimut arrondi puis ramené dans [0°, 360[ : 359,7° s'affiche 0°, non 360°. */
export function formatAzimuth(azimuth, digits = 0) {
  if (!Number.isFinite(azimuth)) return '—';
  const factor = 10 ** digits;
  const rounded = Math.round(normalize360(azimuth) * factor) / factor;
  return `${formatNumber(rounded % 360, { digits })}°`;
}

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

export function cardinalPoint(azimuth) {
  if (!Number.isFinite(azimuth)) return '—';
  return CARDINALS[Math.round(normalize360(azimuth) / 22.5) % 16];
}

/** Latitude/longitude en notation usuelle : « 48,8566° N ». */
export function formatLatitude(lat) {
  return `${formatNumber(Math.abs(lat), { digits: 4 })}° ${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLongitude(lon) {
  return `${formatNumber(Math.abs(lon), { digits: 4 })}° ${lon >= 0 ? 'E' : 'O'}`;
}

/* ------------------------------------------------------------------- durées */

/** Durée en heures décimales → « 14 h 32 min ». */
export function formatDuration(hours, { showSeconds = false } = {}) {
  if (!Number.isFinite(hours)) return '—';
  const negative = hours < 0;
  let total = Math.round(Math.abs(hours) * 3600);
  const h = Math.floor(total / 3600);
  total -= h * 3600;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  const parts = [];
  if (h) parts.push(`${h}\u202fh`);
  parts.push(h ? `${String(m).padStart(2, '0')}\u202fmin` : `${m}\u202fmin`);
  if (showSeconds) parts.push(`${String(s).padStart(2, '0')}\u202fs`);
  return (negative ? '−' : '') + parts.join('\u00a0');
}

/** Durée signée courte, pour les variations quotidiennes : « +2 min 14 s ». */
export function formatSignedDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const sign = seconds < 0 ? '−' : '+';
  const total = Math.round(Math.abs(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${sign}${m}\u202fmin\u00a0${String(s).padStart(2, '0')}\u202fs` : `${sign}${s}\u202fs`;
}

/** Période en jours → formulation adaptée à l'ordre de grandeur. */
export function formatPeriod(days) {
  if (!Number.isFinite(days)) return '—';
  const absolute = Math.abs(days);
  if (absolute < 1) return formatDuration(absolute * 24, { showSeconds: true });
  if (absolute < 400) return `${formatNumber(days, { digits: absolute < 10 ? 3 : 2 })} j`;
  return `${formatNumber(days / 365.25, { digits: 2 })} ans`;
}

/* ---------------------------------------------------------------- distances */

const KM_PER_AU = 149597870.7;
const KM_PER_LY = 9460730472580.8;

export function formatKm(km, digits = 0) {
  if (!Number.isFinite(km)) return '—';
  if (Math.abs(km) >= 1e7) return `${formatNumber(km / 1e6, { digits: 1 })} millions de km`;
  return `${formatNumber(km, { digits })} km`;
}

export function formatAu(au, digits = 4) {
  return Number.isFinite(au) ? `${formatNumber(au, { digits })} ua` : '—';
}

/** Distance présentée dans l'unité la plus parlante, avec l'équivalent. */
export function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1e7) return formatKm(km);
  if (km < 0.1 * KM_PER_LY) {
    return `${formatKm(km)} (${formatAu(km / KM_PER_AU, 3)})`;
  }
  return `${formatNumber(km / KM_PER_LY, { digits: 2 })} al`;
}

/** Temps que met la lumière à parcourir la distance donnée. */
export function formatLightTime(km) {
  if (!Number.isFinite(km)) return '—';
  const seconds = km / 299792.458;
  if (seconds < 90) return `${formatNumber(seconds, { digits: 1 })} s`;
  if (seconds < 5400) return `${formatNumber(seconds / 60, { digits: 1 })} min`;
  if (seconds < 172800) return `${formatNumber(seconds / 3600, { digits: 1 })} h`;
  return `${formatNumber(seconds / 86400, { digits: 1 })} j`;
}

export { KM_PER_AU, KM_PER_LY, normalize360 };
