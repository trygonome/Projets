/**
 * Répertoire de lieux embarqué : l'application doit rester utilisable sans
 * réseau et sans autorisation de géolocalisation.
 *
 * Format : [nom, région, latitude, longitude, altitude en mètres, fuseau IANA].
 */
const RAW = [
  // France métropolitaine
  ['Paris', 'France', 48.8566, 2.3522, 35, 'Europe/Paris'],
  ['Marseille', 'France', 43.2965, 5.3698, 12, 'Europe/Paris'],
  ['Lyon', 'France', 45.7640, 4.8357, 173, 'Europe/Paris'],
  ['Toulouse', 'France', 43.6047, 1.4442, 146, 'Europe/Paris'],
  ['Nice', 'France', 43.7102, 7.2620, 10, 'Europe/Paris'],
  ['Nantes', 'France', 47.2184, -1.5536, 20, 'Europe/Paris'],
  ['Montpellier', 'France', 43.6108, 3.8767, 27, 'Europe/Paris'],
  ['Strasbourg', 'France', 48.5734, 7.7521, 142, 'Europe/Paris'],
  ['Bordeaux', 'France', 44.8378, -0.5792, 8, 'Europe/Paris'],
  ['Lille', 'France', 50.6292, 3.0573, 23, 'Europe/Paris'],
  ['Rennes', 'France', 48.1173, -1.6778, 40, 'Europe/Paris'],
  ['Toulon', 'France', 43.1242, 5.9280, 10, 'Europe/Paris'],
  ['Grenoble', 'France', 45.1885, 5.7245, 212, 'Europe/Paris'],
  ['Dijon', 'France', 47.3220, 5.0415, 245, 'Europe/Paris'],
  ['Angers', 'France', 47.4784, -0.5632, 20, 'Europe/Paris'],
  ['Brest', 'France', 48.3904, -4.4861, 35, 'Europe/Paris'],
  ['Le Havre', 'France', 49.4944, 0.1079, 5, 'Europe/Paris'],
  ['Clermont-Ferrand', 'France', 45.7772, 3.0870, 396, 'Europe/Paris'],
  ['Reims', 'France', 49.2583, 4.0317, 83, 'Europe/Paris'],
  ['Limoges', 'France', 45.8336, 1.2611, 250, 'Europe/Paris'],
  ['Perpignan', 'France', 42.6887, 2.8948, 42, 'Europe/Paris'],
  ['Besançon', 'France', 47.2378, 6.0241, 250, 'Europe/Paris'],
  ['Caen', 'France', 49.1829, -0.3707, 12, 'Europe/Paris'],
  ['Metz', 'France', 49.1193, 6.1757, 173, 'Europe/Paris'],
  ['Tours', 'France', 47.3941, 0.6848, 50, 'Europe/Paris'],
  ['Pau', 'France', 43.2951, -0.3708, 200, 'Europe/Paris'],
  ['Bayonne', 'France', 43.4929, -1.4748, 15, 'Europe/Paris'],
  ['Ajaccio', 'Corse', 41.9192, 8.7386, 20, 'Europe/Paris'],

  // Outre-mer
  ['Fort-de-France', 'Martinique', 14.6161, -61.0588, 10, 'America/Martinique'],
  ['Pointe-à-Pitre', 'Guadeloupe', 16.2415, -61.5330, 10, 'America/Guadeloupe'],
  ['Saint-Denis', 'La Réunion', -20.8823, 55.4504, 15, 'Indian/Reunion'],
  ['Cayenne', 'Guyane', 4.9227, -52.3269, 10, 'America/Cayenne'],
  ['Nouméa', 'Nouvelle-Calédonie', -22.2758, 166.4580, 10, 'Pacific/Noumea'],
  ['Papeete', 'Polynésie française', -17.5516, -149.5585, 5, 'Pacific/Tahiti'],
  ['Mamoudzou', 'Mayotte', -12.7806, 45.2278, 10, 'Indian/Mayotte'],
  ['Saint-Pierre', 'Saint-Pierre-et-Miquelon', 46.7811, -56.1764, 10, 'America/Miquelon'],

  // Espace francophone
  ['Bruxelles', 'Belgique', 50.8503, 4.3517, 56, 'Europe/Brussels'],
  ['Liège', 'Belgique', 50.6326, 5.5797, 70, 'Europe/Brussels'],
  ['Genève', 'Suisse', 46.2044, 6.1432, 375, 'Europe/Zurich'],
  ['Lausanne', 'Suisse', 46.5197, 6.6323, 495, 'Europe/Zurich'],
  ['Zurich', 'Suisse', 47.3769, 8.5417, 408, 'Europe/Zurich'],
  ['Luxembourg', 'Luxembourg', 49.6116, 6.1319, 300, 'Europe/Luxembourg'],
  ['Monaco', 'Monaco', 43.7384, 7.4246, 25, 'Europe/Monaco'],
  ['Montréal', 'Canada', 45.5017, -73.5673, 36, 'America/Toronto'],
  ['Québec', 'Canada', 46.8139, -71.2080, 98, 'America/Toronto'],
  ['Ottawa', 'Canada', 45.4215, -75.6972, 70, 'America/Toronto'],
  ['Toronto', 'Canada', 43.6532, -79.3832, 76, 'America/Toronto'],
  ['Vancouver', 'Canada', 49.2827, -123.1207, 2, 'America/Vancouver'],
  ['Dakar', 'Sénégal', 14.7167, -17.4677, 22, 'Africa/Dakar'],
  ['Abidjan', 'Côte d’Ivoire', 5.3600, -4.0083, 18, 'Africa/Abidjan'],
  ['Casablanca', 'Maroc', 33.5731, -7.5898, 27, 'Africa/Casablanca'],
  ['Rabat', 'Maroc', 34.0209, -6.8416, 46, 'Africa/Casablanca'],
  ['Tunis', 'Tunisie', 36.8065, 10.1815, 4, 'Africa/Tunis'],
  ['Alger', 'Algérie', 36.7538, 3.0588, 25, 'Africa/Algiers'],
  ['Kinshasa', 'RD Congo', -4.4419, 15.2663, 240, 'Africa/Kinshasa'],
  ['Yaoundé', 'Cameroun', 3.8480, 11.5021, 726, 'Africa/Douala'],
  ['Antananarivo', 'Madagascar', -18.8792, 47.5079, 1276, 'Indian/Antananarivo'],
  ['Bamako', 'Mali', 12.6392, -8.0029, 350, 'Africa/Bamako'],
  ['Ouagadougou', 'Burkina Faso', 12.3714, -1.5197, 300, 'Africa/Ouagadougou'],
  ['Beyrouth', 'Liban', 33.8938, 35.5018, 35, 'Asia/Beirut'],
  ['Port-au-Prince', 'Haïti', 18.5944, -72.3074, 30, 'America/Port-au-Prince'],

  // Europe
  ['Londres', 'Royaume-Uni', 51.5074, -0.1278, 24, 'Europe/London'],
  ['Dublin', 'Irlande', 53.3498, -6.2603, 20, 'Europe/Dublin'],
  ['Madrid', 'Espagne', 40.4168, -3.7038, 650, 'Europe/Madrid'],
  ['Barcelone', 'Espagne', 41.3874, 2.1686, 12, 'Europe/Madrid'],
  ['Lisbonne', 'Portugal', 38.7223, -9.1393, 100, 'Europe/Lisbon'],
  ['Rome', 'Italie', 41.9028, 12.4964, 21, 'Europe/Rome'],
  ['Berlin', 'Allemagne', 52.5200, 13.4050, 34, 'Europe/Berlin'],
  ['Amsterdam', 'Pays-Bas', 52.3676, 4.9041, 2, 'Europe/Amsterdam'],
  ['Vienne', 'Autriche', 48.2082, 16.3738, 171, 'Europe/Vienna'],
  ['Prague', 'Tchéquie', 50.0755, 14.4378, 200, 'Europe/Prague'],
  ['Varsovie', 'Pologne', 52.2297, 21.0122, 100, 'Europe/Warsaw'],
  ['Stockholm', 'Suède', 59.3293, 18.0686, 28, 'Europe/Stockholm'],
  ['Oslo', 'Norvège', 59.9139, 10.7522, 23, 'Europe/Oslo'],
  ['Copenhague', 'Danemark', 55.6761, 12.5683, 5, 'Europe/Copenhagen'],
  ['Helsinki', 'Finlande', 60.1699, 24.9384, 26, 'Europe/Helsinki'],
  ['Reykjavik', 'Islande', 64.1466, -21.9426, 61, 'Atlantic/Reykjavik'],
  ['Athènes', 'Grèce', 37.9838, 23.7275, 170, 'Europe/Athens'],
  ['Istanbul', 'Turquie', 41.0082, 28.9784, 39, 'Europe/Istanbul'],
  ['Moscou', 'Russie', 55.7558, 37.6173, 156, 'Europe/Moscow'],
  ['Kyiv', 'Ukraine', 50.4501, 30.5234, 179, 'Europe/Kyiv'],
  ['Tromsø', 'Norvège', 69.6496, 18.9560, 10, 'Europe/Oslo'],

  // Reste du monde
  ['Le Caire', 'Égypte', 30.0444, 31.2357, 23, 'Africa/Cairo'],
  ['Nairobi', 'Kenya', -1.2864, 36.8172, 1795, 'Africa/Nairobi'],
  ['Le Cap', 'Afrique du Sud', -33.9249, 18.4241, 25, 'Africa/Johannesburg'],
  ['Johannesburg', 'Afrique du Sud', -26.2041, 28.0473, 1753, 'Africa/Johannesburg'],
  ['Dubaï', 'Émirats arabes unis', 25.2048, 55.2708, 5, 'Asia/Dubai'],
  ['Téhéran', 'Iran', 35.6892, 51.3890, 1200, 'Asia/Tehran'],
  ['New Delhi', 'Inde', 28.6139, 77.2090, 216, 'Asia/Kolkata'],
  ['Bangkok', 'Thaïlande', 13.7563, 100.5018, 2, 'Asia/Bangkok'],
  ['Singapour', 'Singapour', 1.3521, 103.8198, 15, 'Asia/Singapore'],
  ['Pékin', 'Chine', 39.9042, 116.4074, 44, 'Asia/Shanghai'],
  ['Shanghai', 'Chine', 31.2304, 121.4737, 4, 'Asia/Shanghai'],
  ['Hong Kong', 'Chine', 22.3193, 114.1694, 25, 'Asia/Hong_Kong'],
  ['Tokyo', 'Japon', 35.6762, 139.6503, 40, 'Asia/Tokyo'],
  ['Séoul', 'Corée du Sud', 37.5665, 126.9780, 38, 'Asia/Seoul'],
  ['Sydney', 'Australie', -33.8688, 151.2093, 58, 'Australia/Sydney'],
  ['Melbourne', 'Australie', -37.8136, 144.9631, 31, 'Australia/Melbourne'],
  ['Perth', 'Australie', -31.9505, 115.8605, 15, 'Australia/Perth'],
  ['Auckland', 'Nouvelle-Zélande', -36.8485, 174.7633, 20, 'Pacific/Auckland'],
  ['New York', 'États-Unis', 40.7128, -74.0060, 10, 'America/New_York'],
  ['Chicago', 'États-Unis', 41.8781, -87.6298, 181, 'America/Chicago'],
  ['Denver', 'États-Unis', 39.7392, -104.9903, 1609, 'America/Denver'],
  ['Los Angeles', 'États-Unis', 34.0522, -118.2437, 71, 'America/Los_Angeles'],
  ['San Francisco', 'États-Unis', 37.7749, -122.4194, 16, 'America/Los_Angeles'],
  ['Honolulu', 'États-Unis', 21.3069, -157.8583, 6, 'Pacific/Honolulu'],
  ['Anchorage', 'États-Unis', 61.2181, -149.9003, 31, 'America/Anchorage'],
  ['Mexico', 'Mexique', 19.4326, -99.1332, 2240, 'America/Mexico_City'],
  ['Bogota', 'Colombie', 4.7110, -74.0721, 2640, 'America/Bogota'],
  ['Lima', 'Pérou', -12.0464, -77.0428, 154, 'America/Lima'],
  ['Santiago', 'Chili', -33.4489, -70.6693, 570, 'America/Santiago'],
  ['Buenos Aires', 'Argentine', -34.6037, -58.3816, 25, 'America/Argentina/Buenos_Aires'],
  ['Rio de Janeiro', 'Brésil', -22.9068, -43.1729, 2, 'America/Sao_Paulo'],
  ['São Paulo', 'Brésil', -23.5505, -46.6333, 760, 'America/Sao_Paulo'],
  ['Ushuaia', 'Argentine', -54.8019, -68.3030, 23, 'America/Argentina/Ushuaia'],

  // Sites d'observation remarquables
  ['Observatoire de Paris', 'Site d’observation', 48.8362, 2.3364, 67, 'Europe/Paris'],
  ['Observatoire de Greenwich', 'Site d’observation', 51.4769, 0.0005, 45, 'Europe/London'],
  ['Pic du Midi', 'Site d’observation', 42.9369, 0.1425, 2877, 'Europe/Paris'],
  ['Observatoire de Haute-Provence', 'Site d’observation', 43.9308, 5.7133, 650, 'Europe/Paris'],
  ['Paranal (VLT)', 'Site d’observation', -24.6272, -70.4042, 2635, 'America/Santiago'],
  ['La Silla', 'Site d’observation', -29.2543, -70.7346, 2400, 'America/Santiago'],
  ['Mauna Kea', 'Site d’observation', 19.8207, -155.4681, 4207, 'Pacific/Honolulu'],
  ['Roque de los Muchachos', 'Site d’observation', 28.7543, -17.8850, 2396, 'Atlantic/Canary'],
  ['Longyearbyen', 'Svalbard', 78.2232, 15.6267, 10, 'Arctic/Longyearbyen'],
  ['Base Concordia', 'Antarctique', -75.1000, 123.3500, 3233, 'Antarctica/DumontDUrville'],
  ['Pôle Sud', 'Antarctique', -89.9975, 0, 2835, 'Antarctica/South_Pole'],
];

export const PLACES = RAW.map(([name, region, latitude, longitude, height, timeZone]) => ({
  name, region, latitude, longitude, height, timeZone,
  label: region && region !== name ? `${name}, ${region}` : name,
}));

/** Retire accents et casse pour une recherche tolérante. */
export const foldText = (text) => text
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, ' ')
  .toLowerCase()
  .trim();

const INDEX = PLACES.map((place) => ({
  place,
  haystack: foldText(`${place.name} ${place.region}`),
}));

/** Recherche par préfixe puis par sous-chaîne, les préfixes d'abord. */
export function searchPlaces(query, limit = 12) {
  const needle = foldText(query);
  if (!needle) return PLACES.slice(0, limit);
  const prefix = [];
  const contains = [];
  for (const entry of INDEX) {
    if (entry.haystack.startsWith(needle)) prefix.push(entry.place);
    else if (entry.haystack.includes(needle)) contains.push(entry.place);
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** Lieu répertorié le plus proche de coordonnées données. */
export function nearestPlace(latitude, longitude) {
  let best = null;
  let bestDistance = Infinity;
  for (const place of PLACES) {
    const dLat = (place.latitude - latitude) * Math.PI / 180;
    const dLon = (place.longitude - longitude) * Math.PI / 180
      * Math.cos(latitude * Math.PI / 180);
    const distance = Math.hypot(dLat, dLon) * 6371;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = place;
    }
  }
  return { place: best, distanceKm: bestDistance };
}
