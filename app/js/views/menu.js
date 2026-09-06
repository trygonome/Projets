/** Menu secondaire : vues hors barre d'onglets et bascule du thème. */
import { el, list, listItem, card, notice } from '../ui/dom.js';
import { display, setDisplay } from '../core/state.js';

const ENTRIES = [
  { id: 'corps', glyph: '🪐', title: 'Corps du système solaire', subtitle: 'Fiches détaillées des planètes, lunes et planètes naines' },
  { id: 'savoir', glyph: '📖', title: 'Savoir', subtitle: 'Comprendre les cycles, les échelles et la mécanique céleste' },
  { id: 'reglages', glyph: '⚙', title: 'Réglages', subtitle: 'Affichage, fuseau horaire, installation hors-ligne' },
];

export function openMenuPanel(openPanel, navigate) {
  openPanel('Menu', ({ close }) => {
    const nightMode = display().theme === 'rouge';

    const toggle = el('input', {
      type: 'checkbox',
      checked: nightMode,
      onChange: (event) => setDisplay({ theme: event.target.checked ? 'rouge' : 'nuit' }),
    });

    return el('div', {},
      list(...ENTRIES.map((entry) => listItem({
        leading: entry.glyph,
        title: entry.title,
        subtitle: entry.subtitle,
        trailing: '›',
        onClick: () => { navigate(entry.id); close(); },
      }))),

      card({ title: 'Vision nocturne' },
        el('label', { class: 'bascule' },
          el('span', { class: 'bascule-texte' },
            el('span', { class: 'bascule-titre' }, 'Écran rouge'),
            el('span', { class: 'bascule-detail' }, 'Préserve l’accoutumance de l’œil à l’obscurité')),
          toggle),
        notice('En vingt minutes d’obscurité, l’œil gagne un facteur mille en sensibilité. Une lumière blanche détruit cette adaptation en une seconde ; la lumière rouge la préserve.')),

      el('p', { class: 'texte', style: { fontSize: '12px', textAlign: 'center', marginTop: '8px' } },
        'Céleste — éphémérides calculées sur votre appareil'),
    );
  });
}
