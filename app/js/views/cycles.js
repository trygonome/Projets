/**
 * Vue « Cycles » : deux panneaux, la Lune et le Soleil, entre lesquels on
 * bascule sans quitter la page.
 */
import { el, segmented } from '../ui/dom.js';
import { createLunarPanel } from './cycles-lune.js';
import { createSolarPanel } from './cycles-soleil.js';

const TABS = [
  { value: 'lune', label: '☾ Lune' },
  { value: 'soleil', label: '☀ Soleil' },
];

export function mount(container, { setTimeBarVisible, params }) {
  let current = params?.[0] === 'soleil' ? 'soleil' : 'lune';

  const switcher = el('div');
  const body = el('div', { class: 'panneau-cycles' });
  container.append(switcher, body);
  setTimeBarVisible(true);

  const panels = {
    lune: createLunarPanel(),
    soleil: createSolarPanel(),
  };

  function renderSwitcher() {
    switcher.replaceChildren(segmented(TABS, current, (value) => {
      current = value;
      renderSwitcher();
      show();
      container.scrollTop = 0;
      window.scrollTo(0, 0);
    }));
  }

  function show() {
    body.replaceChildren(panels[current].node);
    panels[current].update();
  }

  renderSwitcher();
  show();

  return {
    update() { panels[current].update(); },
    setParams(next) {
      const wanted = next?.[0] === 'soleil' ? 'soleil' : 'lune';
      if (wanted !== current) { current = wanted; renderSwitcher(); show(); }
    },
    refresh() {
      panels.soleil.invalidate?.();
      show();
    },
    destroy() { setTimeBarVisible(false); },
  };
}
