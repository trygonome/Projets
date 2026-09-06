/** Ébauche — vue « ciel » en cours de construction. */
import { el, notice } from '../ui/dom.js';

export function mount(container) {
  container.appendChild(el('div', { class: 'vue' },
    notice('Cette vue est en cours de construction.')));
  return { update() {} };
}
