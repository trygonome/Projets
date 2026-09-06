/**
 * Agenda céleste : tout ce qui va se passer dans le ciel, du prochain quartier
 * de Lune à l'éclipse totale de la décennie.
 *
 * Le calcul est fait à la demande car il balaie plusieurs années d'éphémérides ;
 * les familles coûteuses ne sont incluses que si elles sont demandées.
 */
import {
  el, card, notice, heading, listItem, list, segmented, replaceContent,
} from '../ui/dom.js';
import { now, timeZone, observer, setTime } from '../core/state.js';
import { buildAgenda, EVENT_KINDS, conjunctionEvents } from '../core/events.js';
import { MS_PER_DAY } from '../core/time.js';
import { formatTime, formatRelative } from '../core/format.js';

const RANGES = [
  { value: 90, label: '3 mois' },
  { value: 365, label: '1 an' },
  { value: 1095, label: '3 ans' },
  { value: 3650, label: '10 ans' },
];

/** Familles proposées au filtrage, dans l'ordre d'intérêt. */
const FAMILIES = [
  { key: 'eclipseSolaire', label: 'Éclipses de Soleil', default: true },
  { key: 'eclipseLunaire', label: 'Éclipses de Lune', default: true },
  { key: 'phase', label: 'Phases', default: true },
  { key: 'saison', label: 'Saisons', default: true },
  { key: 'opposition', label: 'Oppositions', default: true },
  { key: 'elongation', label: 'Élongations', default: true },
  { key: 'meteores', label: 'Météores', default: true },
  { key: 'apsideLunaire', label: 'Apsides lunaires', default: false },
  { key: 'conjonction', label: 'Conjonctions solaires', default: false },
  { key: 'rapprochement', label: 'Rapprochements', default: false, costly: true },
  { key: 'noeud', label: 'Nœuds lunaires', default: false },
];

const MONTH_FORMAT = { month: 'long', year: 'numeric' };

export function mount(container) {
  let range = 365;
  const active = new Set(FAMILIES.filter((family) => family.default).map((f) => f.key));

  const controls = el('div', { class: 'carte' });
  const results = el('div', { style: { display: 'contents' } });
  container.append(
    card({
      class: 'carte--plate',
      title: 'Agenda céleste',
      subtitle: 'Calculé pour votre position ; touchez un événement pour y transporter l’application',
    }),
    controls,
    results,
  );

  function renderControls() {
    replaceContent(controls,
      segmented(RANGES, range, (value) => { range = value; renderControls(); renderAgenda(); }),
      el('div', { class: 'barre-boutons', style: { marginTop: '10px' } },
        ...FAMILIES.map((family) => el('button', {
          class: 'puce-outil',
          type: 'button',
          'data-actif': active.has(family.key) ? 'oui' : 'non',
          onClick: () => {
            if (active.has(family.key)) active.delete(family.key);
            else active.add(family.key);
            renderControls();
            renderAgenda();
          },
        }, family.label))),
      active.has('rapprochement') && range > 365
        ? notice('Les rapprochements sont balayés heure par heure : au-delà d’un an, '
          + 'le calcul peut demander quelques secondes.', 'accent')
        : null,
    );
  }

  function renderAgenda() {
    const date = now();
    const zone = timeZone();
    const place = observer();

    if (!active.size) {
      replaceContent(results, card({}, notice('Choisissez au moins une famille d’événements.')));
      return;
    }

    replaceContent(results, card({}, notice('Calcul de l’agenda…')));

    // Le calcul est reporté d'une image pour que le message s'affiche d'abord.
    requestAnimationFrame(() => {
      const include = [...active];
      let events = buildAgenda(date, {
        days: range,
        observer: place,
        include: include.filter((key) => key !== 'rapprochement'),
      });

      if (active.has('rapprochement')) {
        // Les rapprochements se cherchent sur une fenêtre bornée : au-delà,
        // le balayage devient long sans rien apporter de plus utile.
        const window = Math.min(range, 400);
        events = [...events, ...conjunctionEvents(
          date, new Date(date.getTime() + window * MS_PER_DAY),
        )].sort((a, b) => a.date - b.date);
      }

      if (!events.length) {
        replaceContent(results, card({}, notice('Aucun événement sur cette période.')));
        return;
      }

      const groups = new Map();
      for (const event of events) {
        const key = new Intl.DateTimeFormat('fr-FR', { ...MONTH_FORMAT, timeZone: zone })
          .format(event.date);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event);
      }

      const nodes = [];
      for (const [month, items] of groups) {
        nodes.push(heading(month.charAt(0).toUpperCase() + month.slice(1),
          `${items.length} événement${items.length > 1 ? 's' : ''}`));
        nodes.push(card({}, list(...items.map((event) => renderEvent(event, date, zone)))));
      }
      replaceContent(results, ...nodes);
    });
  }

  function renderEvent(event, reference, zone) {
    const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: zone })
      .format(event.date);
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: zone })
      .format(event.date);

    return listItem({
      leading: el('span', { class: 'agenda-jour' },
        el('span', { class: 'agenda-jour-numero' }, day),
        el('span', { class: 'agenda-jour-mois' }, month.replace('.', ''))),
      title: event.title,
      subtitle: [formatTime(event.date, zone), event.detail].filter(Boolean).join(' · '),
      trailing: el('span', {},
        EVENT_KINDS[event.kind]?.icon ?? '',
        el('br'),
        el('small', {}, formatRelative(event.date, reference))),
      onClick: () => setTime(event.date),
    });
  }

  renderControls();
  renderAgenda();

  return {
    update() {},
    refresh() { renderAgenda(); },
  };
}
