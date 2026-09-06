/**
 * Panneau de réglage du temps : sauts rapides, date et heure arbitraires,
 * vitesse d'écoulement. Toutes les vues suivent l'horloge simulée.
 */
import { el, button, notice, card, segmented } from '../ui/dom.js';
import {
  now, timeZone, setTime, shiftTime, resumeLive, setTimeRate, isLive, timeRate,
} from '../core/state.js';
import { localDateParts, startOfLocalDay } from '../core/time.js';
import { timeZoneOffsetMinutes, formatDateTime } from '../core/format.js';

const RATES = [
  { value: 0, label: 'Figé' },
  { value: 1, label: 'Réel' },
  { value: 60, label: '×60' },
  { value: 3600, label: '1 h/s' },
  { value: 86400, label: '1 j/s' },
  { value: 2592000, label: '1 mois/s' },
];

/** Convertit une saisie « date + heure locale » en instant absolu. */
function fromLocalInput(dateValue, timeValue, zone) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  let instant = nominal;
  for (let i = 0; i < 2; i += 1) {
    instant = nominal - timeZoneOffsetMinutes(new Date(instant), zone) * 60000;
  }
  return new Date(instant);
}

const pad = (value) => String(value).padStart(2, '0');

export function openTimePanel(openPanel) {
  openPanel('Temps', ({ close }) => {
    const zone = timeZone();
    const current = now();
    const parts = localDateParts(current, zone);

    const dateInput = el('input', {
      type: 'date',
      value: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    });
    const timeInput = el('input', {
      type: 'time',
      value: `${pad(parts.hour)}:${pad(parts.minute)}`,
    });

    const summary = el('p', { class: 'texte' });
    const refreshSummary = () => {
      summary.textContent = isLive()
        ? 'L’application suit l’heure réelle.'
        : `Temps simulé : ${formatDateTime(now(), zone)}.`;
    };
    refreshSummary();

    const rateRow = el('div');
    const renderRates = () => {
      rateRow.replaceChildren(segmented(
        RATES.map((entry) => ({ value: entry.value, label: entry.label })),
        isLive() ? 1 : timeRate(),
        (value) => {
          if (value === 1) resumeLive();
          else setTimeRate(value);
          renderRates();
          refreshSummary();
        },
      ));
    };
    renderRates();

    const quick = (label, action) => button(label, () => {
      action();
      refreshSummary();
    });

    return el('div', {},
      card({ title: 'Instant observé' },
        summary,
        el('div', { class: 'grille-champs' },
          el('label', { class: 'champ' }, el('span', { class: 'champ-etiquette' }, 'Date'), dateInput),
          el('label', { class: 'champ' }, el('span', { class: 'champ-etiquette' }, 'Heure locale'), timeInput)),
        button('Aller à cet instant', () => {
          setTime(fromLocalInput(dateInput.value, timeInput.value, zone));
          close();
        }, { variant: 'accent' })),

      card({ title: 'Sauts rapides' },
        el('div', { class: 'barre-boutons' },
          quick('Maintenant', resumeLive),
          quick('Minuit', () => setTime(startOfLocalDay(now(), zone))),
          quick('−1 h', () => shiftTime(-1 / 24)),
          quick('+1 h', () => shiftTime(1 / 24)),
          quick('−1 jour', () => shiftTime(-1)),
          quick('+1 jour', () => shiftTime(1)),
          quick('−1 mois', () => shiftTime(-30)),
          quick('+1 mois', () => shiftTime(30)),
          quick('−1 an', () => shiftTime(-365.25)),
          quick('+1 an', () => shiftTime(365.25)))),

      card({ title: 'Écoulement du temps' },
        rateRow,
        notice('Accélérer le temps met en mouvement la vue du système solaire et le ciel local : les orbites, les phases et les saisons se déroulent sous vos yeux.')),
    );
  });
}
