/**
 * Localisation de l'observateur : capteur du téléphone lorsqu'il est autorisé,
 * répertoire embarqué sinon.
 */
import { nearestPlace } from '../data/places.js';
import { setObserver, setTimeZone, timeZonePreference } from './state.js';

export const geolocationAvailable = () => 'geolocation' in navigator;

/**
 * Demande la position au système. La promesse est rejetée avec un message déjà
 * traduit : les codes d'erreur de l'API sont peu parlants pour l'utilisateur.
 */
export function requestPosition({ timeout = 15000, highAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!geolocationAvailable()) {
      reject(new Error('Ce navigateur ne propose pas de géolocalisation.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        height: position.coords.altitude ?? 0,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const messages = {
          1: 'Autorisation refusée. Vous pouvez choisir un lieu dans la liste.',
          2: 'Position indisponible pour le moment.',
          3: 'La localisation a pris trop de temps.',
        };
        reject(new Error(messages[error.code] ?? 'Localisation impossible.'));
      },
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: 300000 },
    );
  });
}

/**
 * Localise puis met à jour l'état. Le nom affiché reprend la ville répertoriée
 * la plus proche quand elle est à moins de 60 km, sinon les coordonnées brutes.
 */
export async function locateObserver() {
  const position = await requestPosition();
  const { place, distanceKm } = nearestPlace(position.latitude, position.longitude);
  const label = distanceKm < 60 && place
    ? `Près de ${place.name}`
    : `${position.latitude.toFixed(3)}°, ${position.longitude.toFixed(3)}°`;

  setObserver({
    latitude: position.latitude,
    longitude: position.longitude,
    height: Number.isFinite(position.height) ? position.height : 0,
    label,
    source: 'gps',
    accuracy: position.accuracy,
  });
  return { position, place, distanceKm };
}

/** Applique un lieu du répertoire, en alignant le fuseau s'il est automatique. */
export function applyPlace(place) {
  setObserver({
    latitude: place.latitude,
    longitude: place.longitude,
    height: place.height ?? 0,
    label: place.label,
    source: 'repertoire',
  });
  if (timeZonePreference() !== 'auto') setTimeZone(place.timeZone);
}
