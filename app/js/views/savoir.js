/**
 * Vue « Savoir » : index des articles, puis lecture d'un article.
 *
 * Le contenu est décrit par blocs typés dans `data/savoir.js` ; cette vue se
 * contente de les mettre en page.
 */
import {
  el, card, notice, heading, list, listItem, button, table, replaceContent,
} from '../ui/dom.js';
import { ARTICLES, articleById } from '../data/savoir.js';

/** Traduit un bloc de contenu en éléments du document. */
function renderBlock(block) {
  switch (block.type) {
    case 'h':
      return el('h3', {}, block.text);
    case 'p':
      // Le contenu autorise quelques balises d'emphase, pas de code externe.
      return el('p', { html: block.text });
    case 'ul':
      return el('ul', {}, ...block.items.map((item) => el('li', { html: item })));
    case 'formula':
      return el('div', {},
        el('code', { class: 'formule' }, block.text),
        block.note ? el('p', { class: 'figure-legende' }, block.note) : null);
    case 'facts':
      return table(
        ['', '', ''],
        block.rows.map((row) => row.map((cell) => el('span', { html: cell }))),
        { class: 'tableau--reperes' },
      );
    default:
      return null;
  }
}

export function mount(container, { navigate, params }) {
  let currentId = params?.[0] ?? null;
  const body = el('div', { style: { display: 'contents' } });
  container.append(body);

  function renderIndex() {
    replaceContent(body,
      card({
        class: 'carte--plate',
        title: 'Savoir',
        subtitle: 'Quinze articles pour comprendre ce que l’application montre',
      }),
      card({},
        list(...ARTICLES.map((article) => listItem({
          leading: article.icon,
          title: article.title,
          subtitle: article.summary,
          trailing: '›',
          onClick: () => navigate(`savoir/${article.id}`),
        })))),
      notice('Les chiffres cités sont ceux des éphémérides et des fiches de la NASA et '
        + 'de l’Union astronomique internationale. Les mêmes valeurs alimentent les '
        + 'calculs de l’application.'));
  }

  function renderArticle(id) {
    const article = articleById(id);
    if (!article) { renderIndex(); return; }

    const index = ARTICLES.indexOf(article);
    const previous = ARTICLES[index - 1];
    const next = ARTICLES[index + 1];

    replaceContent(body,
      el('div', { class: 'barre-boutons' },
        button('‹ Tous les articles', () => navigate('savoir'), { variant: 'discret' })),
      card({},
        heading(`${article.icon} ${article.title}`, article.summary),
        el('div', { class: 'article' },
          ...article.blocks.map(renderBlock).filter(Boolean))),
      el('div', { class: 'barre-boutons', style: { justifyContent: 'space-between' } },
        previous
          ? button(`‹ ${previous.title}`, () => navigate(`savoir/${previous.id}`))
          : el('span'),
        next
          ? button(`${next.title} ›`, () => navigate(`savoir/${next.id}`))
          : el('span')),
    );
  }

  function update() {
    if (currentId) renderArticle(currentId);
    else renderIndex();
  }

  update();

  return {
    update() {},
    setParams(params) {
      currentId = params?.[0] ?? null;
      update();
      container.scrollTop = 0;
      window.scrollTo(0, 0);
    },
    refresh() { update(); },
  };
}
