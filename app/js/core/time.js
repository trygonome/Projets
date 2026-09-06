/**
 * Repères temporels : bornes du jour civil local, calendrier julien, échelles
 * de temps. Les recherches de lever et de coucher ont besoin d'un intervalle
 * ancré sur le jour de l'observateur, pas sur le jour UTC.
 */
import { timeZoneOffsetMinutes } from './format.js';

export const MS_PER_DAY = 86400000;
export const JD_UNIX_EPOCH = 2440587.5;

/** Date julienne (échelle UT) de l'instant donné. */
export const julianDate = (date) => date.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;

/** Siècles juliens depuis J2000.0. */
export const julianCenturies = (date) => (julianDate(date) - 2451545) / 36525;

/** Composantes année/mois/jour telles que les lit l'observateur. */
export function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second'),
  };
}

/**
 * Instant de minuit local du jour contenant `date`.
 * Le décalage dépend de l'instant cherché : deux itérations suffisent à
 * converger, y compris de part et d'autre d'un changement d'heure.
 */
export function startOfLocalDay(date, timeZone) {
  const { year, month, day } = localDateParts(date, timeZone);
  const nominal = Date.UTC(year, month - 1, day);
  let instant = nominal;
  for (let i = 0; i < 2; i += 1) {
    instant = nominal - timeZoneOffsetMinutes(new Date(instant), timeZone) * 60000;
  }
  return new Date(instant);
}

/** Minuit local du jour suivant (gère les jours de 23 h et de 25 h). */
export function startOfNextLocalDay(date, timeZone) {
  const start = startOfLocalDay(date, timeZone);
  return startOfLocalDay(new Date(start.getTime() + 36 * 3600000), timeZone);
}

/** Décale d'un nombre entier de jours civils locaux. */
export function addLocalDays(date, days, timeZone) {
  const { year, month, day } = localDateParts(date, timeZone);
  const nominal = Date.UTC(year, month - 1, day + days);
  let instant = nominal;
  for (let i = 0; i < 2; i += 1) {
    instant = nominal - timeZoneOffsetMinutes(new Date(instant), timeZone) * 60000;
  }
  return new Date(instant);
}

/** Quantième du jour dans l'année civile locale (1 au 1er janvier). */
export function dayOfYear(date, timeZone) {
  const { year } = localDateParts(date, timeZone);
  const start = startOfLocalDay(new Date(Date.UTC(year, 0, 1, 12)), timeZone);
  return Math.round((startOfLocalDay(date, timeZone) - start) / MS_PER_DAY) + 1;
}

/** Nombre de jours de l'année civile (365 ou 366). */
export function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Année décimale, utile pour interpoler des courbes annuelles. */
export function decimalYear(date, timeZone) {
  const { year } = localDateParts(date, timeZone);
  return year + (dayOfYear(date, timeZone) - 1) / daysInYear(year);
}

/** Ajoute des heures à une date sans muter l'original. */
export const addHours = (date, hours) => new Date(date.getTime() + hours * 3600000);
export const addDays = (date, days) => new Date(date.getTime() + days * MS_PER_DAY);

/** Différence en heures décimales entre deux instants. */
export const hoursBetween = (a, b) => (b.getTime() - a.getTime()) / 3600000;
