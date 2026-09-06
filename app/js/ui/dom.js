/**
 * Fabrique d'éléments et composants d'interface réutilisés par toutes les vues.
 *
 * L'application n'utilise aucun cadriciel : ces quelques fonctions suffisent à
 * décrire les écrans de façon déclarative tout en restant lisibles.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Applique une valeur d'attribut ou de propriété à un élément. */
function applyProp(node, key, value) {
  if (value === null || value === undefined || value === false) return;
  if (key === 'class') node.setAttribute('class', value);
  else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
  else if (key === 'dataset') Object.assign(node.dataset, value);
  else if (key.startsWith('on') && typeof value === 'function') {
    node.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (key === 'html') node.innerHTML = value;
  else if (key in node && !(node instanceof SVGElement)) node[key] = value;
  else node.setAttribute(key, value === true ? '' : value);
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Crée un élément HTML : el('div', { class: 'x' }, 'texte'). */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) {
    appendChildren(node, [props, ...children]);
    return node;
  }
  for (const [key, value] of Object.entries(props)) applyProp(node, key, value);
  appendChildren(node, children);
  return node;
}

/** Équivalent pour les éléments SVG. */
export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value);
  }
  appendChildren(node, children);
  return node;
}

/**
 * Remplace le contenu d'un élément en ignorant les enfants absents.
 *
 * `replaceChildren` du DOM convertit `null` en la chaîne « null » : ce passage
 * par le même filtrage que `el()` évite ce piège dans les rendus conditionnels.
 */
export function replaceContent(node, ...children) {
  clear(node);
  appendChildren(node, children);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------------------------------------ composants */

/** Carte de contenu, unité de base de la mise en page. */
export function card({ title, subtitle, action, id, class: className = '' } = {}, ...children) {
  const header = title || action
    ? el('header', { class: 'carte-tete' },
      el('div', {},
        title ? el('h2', { class: 'carte-titre' }, title) : null,
        subtitle ? el('p', { class: 'carte-soustitre' }, subtitle) : null),
      action ?? null)
    : null;
  return el('section', { class: `carte ${className}`.trim(), id }, header, ...children);
}

/** Ligne « intitulé → valeur », avec précision facultative. */
export function row(label, value, hint) {
  return el('div', { class: 'ligne' },
    el('span', { class: 'ligne-etiquette' }, label),
    el('span', { class: 'ligne-valeur' },
      value ?? '—',
      hint ? el('small', { class: 'ligne-precision' }, hint) : null));
}

/** Groupe de lignes séparé par des filets. */
export function rows(...items) {
  return el('div', { class: 'lignes' }, ...items);
}

/** Grande valeur mise en avant, pour les chiffres clés. */
export function stat(label, value, { unit, hint, tone } = {}) {
  return el('div', { class: `stat${tone ? ` stat--${tone}` : ''}` },
    el('div', { class: 'stat-valeur' }, value, unit ? el('span', { class: 'stat-unite' }, unit) : null),
    el('div', { class: 'stat-etiquette' }, label),
    hint ? el('div', { class: 'stat-precision' }, hint) : null);
}

export const statGrid = (...children) => el('div', { class: 'grille-stats' }, ...children);

/** Étiquette compacte, colorée selon la tonalité. */
export function chip(text, { tone = 'neutre', title } = {}) {
  return el('span', { class: `pastille pastille--${tone}`, title }, text);
}

/** Titre de section entre deux blocs. */
export const heading = (text, subtitle) => el('div', { class: 'entete-section' },
  el('h2', {}, text),
  subtitle ? el('p', {}, subtitle) : null);

export const paragraph = (...content) => el('p', { class: 'texte' }, ...content);

/** Bouton d'action. */
export function button(label, onClick, { variant = 'neutre', title, disabled } = {}) {
  return el('button', {
    class: `bouton bouton--${variant}`, type: 'button', onClick, title, disabled,
  }, label);
}

/** Barre de boutons exclusifs (segmented control). */
export function segmented(options, selected, onSelect) {
  const container = el('div', { class: 'segments', role: 'tablist' });
  for (const option of options) {
    container.appendChild(el('button', {
      class: `segment${option.value === selected ? ' segment--actif' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': option.value === selected ? 'true' : 'false',
      title: option.title,
      onClick: () => onSelect(option.value),
    }, option.label));
  }
  return container;
}

/** Barre de progression horizontale, valeur entre 0 et 1. */
export function meter(value, { tone = 'accent', label } = {}) {
  const clamped = Math.max(0, Math.min(1, value ?? 0));
  return el('div', { class: 'jauge', title: label },
    el('div', {
      class: `jauge-remplissage jauge-remplissage--${tone}`,
      style: { width: `${clamped * 100}%` },
    }));
}

/** Message d'état vide ou d'explication. */
export const notice = (text, tone = 'neutre') =>
  el('p', { class: `note note--${tone}` }, text);

/** Bloc dépliable, pour les contenus longs. */
export function disclosure(summaryText, ...children) {
  return el('details', { class: 'depliant' },
    el('summary', {}, summaryText),
    el('div', { class: 'depliant-corps' }, ...children));
}

/** Tableau simple à en-têtes. */
export function table(headers, bodyRows, { class: className = '' } = {}) {
  return el('div', { class: 'tableau-defilant' },
    el('table', { class: `tableau ${className}`.trim() },
      el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', {}, h)))),
      el('tbody', {}, ...bodyRows.map((cells) => el('tr', {},
        ...cells.map((cell) => el('td', {}, cell)))))));
}

/** Liste d'éléments cliquables. */
export function listItem({ leading, title, subtitle, trailing, onClick, href }) {
  const tag = href ? 'a' : (onClick ? 'button' : 'div');
  const props = { class: 'element-liste' };
  if (href) props.href = href;
  if (onClick) { props.onClick = onClick; props.type = 'button'; }
  return el(tag, props,
    leading ? el('span', { class: 'element-avant' }, leading) : null,
    el('span', { class: 'element-corps' },
      el('span', { class: 'element-titre' }, title),
      subtitle ? el('span', { class: 'element-soustitre' }, subtitle) : null),
    trailing ? el('span', { class: 'element-apres' }, trailing) : null);
}

export const list = (...items) => el('div', { class: 'liste' }, ...items);
