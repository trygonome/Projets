/**
 * Panneau de choix du lieu d'observation : géolocalisation, recherche dans le
 * répertoire embarqué, ou saisie manuelle des coordonnées.
 */
import { el, button, notice, listItem, list, card } from '../ui/dom.js';
import { searchPlaces, PLACES } from '../data/places.js';
import { locateObserver, applyPlace, geolocationAvailable } from '../core/geo.js';
import { observer, setObserver } from '../core/state.js';
import { formatLatitude, formatLongitude, formatNumber } from '../core/format.js';

export function openPlacePanel(openPanel) {
  openPanel('Lieu d’observation', ({ close }) => {
    const container = el('div', { class: 'panneau-contenu' });
    const status = el('div');
    const results = list();

    const renderResults = (query) => {
      results.replaceChildren(...searchPlaces(query, 30).map((place) => listItem({
        title: place.name,
        subtitle: `${place.region} · ${formatLatitude(place.latitude)} ${formatLongitude(place.longitude)}`,
        trailing: place.height ? `${formatNumber(place.height)} m` : null,
        onClick: () => { applyPlace(place); close(); },
      })));
      if (!results.childElementCount) {
        results.replaceChildren(notice('Aucun lieu ne correspond. Saisissez les coordonnées ci-dessous.'));
      }
    };

    const search = el('input', {
      type: 'search',
      placeholder: 'Rechercher une ville ou un observatoire',
      autocomplete: 'off',
      onInput: (event) => renderResults(event.target.value),
    });

    const locateButton = button('Utiliser ma position', async () => {
      status.replaceChildren(notice('Localisation en cours…'));
      try {
        const { place, distanceKm } = await locateObserver();
        status.replaceChildren(notice(
          `Position obtenue${place && distanceKm < 200 ? ` — à ${formatNumber(distanceKm, { digits: 0 })} km de ${place.name}` : ''}.`,
          'accent',
        ));
        setTimeout(close, 700);
      } catch (error) {
        status.replaceChildren(notice(error.message, 'alerte'));
      }
    }, { variant: 'accent' });

    const current = observer();
    const latitude = el('input', { type: 'number', step: '0.0001', min: '-90', max: '90', value: current.latitude });
    const longitude = el('input', { type: 'number', step: '0.0001', min: '-180', max: '180', value: current.longitude });
    const height = el('input', { type: 'number', step: '1', value: current.height ?? 0 });

    const manual = card({ title: 'Coordonnées exactes' },
      el('div', { class: 'grille-champs' },
        el('label', { class: 'champ' }, el('span', { class: 'champ-etiquette' }, 'Latitude (°)'), latitude),
        el('label', { class: 'champ' }, el('span', { class: 'champ-etiquette' }, 'Longitude (°)'), longitude),
        el('label', { class: 'champ' }, el('span', { class: 'champ-etiquette' }, 'Altitude (m)'), height)),
      notice('Latitude positive vers le nord, longitude positive vers l’est.'),
      button('Appliquer ces coordonnées', () => {
        const lat = Number(latitude.value);
        const lon = Number(longitude.value);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)
          || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          status.replaceChildren(notice('Coordonnées hors limites.', 'alerte'));
          return;
        }
        setObserver({
          latitude: lat,
          longitude: lon,
          height: Number(height.value) || 0,
          label: `${formatLatitude(lat)} ${formatLongitude(lon)}`,
          source: 'manuel',
        });
        close();
      }, { variant: 'accent' }));

    container.append(
      el('div', { class: 'champ' }, search),
      geolocationAvailable() ? locateButton : notice('Géolocalisation indisponible sur cet appareil.'),
      status,
      el('p', { class: 'entete-section' }, el('h2', {}, `Répertoire (${PLACES.length} lieux)`)),
      results,
      manual,
    );

    renderResults('');
    setTimeout(() => search.focus(), 120);
    return container;
  });
}
