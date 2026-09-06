/**
 * Données physiques et orbitales du système solaire.
 *
 * Valeurs de référence : fiches NASA/JPL Planetary Fact Sheets et IAU.
 * Les masses sont en kilogrammes, les distances en kilomètres sauf mention,
 * les périodes en jours, les températures en degrés Celsius.
 *
 * Une période de rotation négative signale une rotation rétrograde.
 *
 * Les éléments orbitaux sont les éléments osculateurs J2000 du JPL, et non les
 * « distances moyennes » des fiches grand public : eux seuls sont cohérents
 * entre eux et vérifient la troisième loi de Kepler, ce que les tests
 * contrôlent.
 */

/** Rayons équatoriaux utilisés pour les diamètres apparents. */
export const BODY_RADIUS_KM = {
  Sun: 695700,
  Moon: 1737.4,
  Mercury: 2439.7,
  Venus: 6051.8,
  Earth: 6378.137,
  Mars: 3396.2,
  Jupiter: 71492,
  Saturn: 60268,
  Uranus: 25559,
  Neptune: 24764,
  Pluto: 1188.3,
};

export const SUN = {
  id: 'Sun',
  name: 'Soleil',
  symbol: '☉',
  kind: 'étoile naine jaune (type G2V)',
  color: '#ffd27d',
  physical: {
    radius: 695700,
    mass: 1.9885e30,
    density: 1408,
    gravity: 274,
    escapeVelocity: 617.7,
    surfaceTemperature: 5499,
    coreTemperature: 15700000 - 273,
    luminosity: 3.828e26,
    rotationPeriod: 25.38,
    obliquity: 7.25,
    age: 4.603e9,
    absoluteMagnitude: 4.83,
    apparentMagnitude: -26.74,
  },
  composition: [
    ['Hydrogène', 73.5], ['Hélium', 24.9], ['Oxygène', 0.8],
    ['Carbone', 0.3], ['Fer', 0.2], ['Autres', 0.3],
  ],
  facts: [
    'Le Soleil concentre 99,86 % de la masse du système solaire.',
    'Il fusionne environ 600 millions de tonnes d’hydrogène par seconde et en perd 4 millions de tonnes converties en énergie.',
    'Sa lumière met 8 min 19 s à nous parvenir ; l’énergie produite dans le cœur met, elle, des dizaines de milliers d’années à atteindre la surface.',
    'Sa rotation est différentielle : 25 jours à l’équateur, environ 34 jours près des pôles.',
    'Le cycle magnétique d’environ 11 ans inverse la polarité des pôles à chaque maximum.',
  ],
};

export const PLANETS = [
  {
    id: 'Mercury',
    name: 'Mercure',
    symbol: '☿',
    kind: 'planète tellurique',
    color: '#9c8f87',
    physical: {
      radius: 2439.7, polarRadius: 2439.7,
      mass: 3.3011e23, density: 5427, gravity: 3.70, escapeVelocity: 4.25,
      albedo: 0.142, temperatureMean: 167, temperatureMin: -173, temperatureMax: 427,
      rotationPeriod: 58.646, solarDay: 175.94, obliquity: 0.034,
    },
    orbit: {
      semiMajorAxisAu: 0.387099, semiMajorAxisKm: 57.909e6,
      eccentricity: 0.205636, inclination: 7.0050,
      period: 87.969, synodicPeriod: 115.88, orbitalSpeed: 47.36,
      perihelionAu: 0.307499, aphelionAu: 0.466699,
    },
    atmosphere: { pressure: 5e-15, composition: [['Oxygène', 42], ['Sodium', 29], ['Hydrogène', 22], ['Hélium', 6]] },
    moons: 0,
    rings: false,
    discovery: 'Connue depuis la préhistoire',
    facts: [
      'Une journée solaire y dure deux années mercuriennes : le Soleil s’y lève une fois tous les 176 jours terrestres.',
      'Sa résonance spin–orbite 3:2 est unique dans le système solaire.',
      'L’écart thermique jour/nuit atteint 600 °C, le plus grand de toutes les planètes.',
      'Son noyau de fer occupe environ 85 % de son rayon.',
      'La précession de son périhélie fut la première confirmation observationnelle de la relativité générale.',
    ],
  },
  {
    id: 'Venus',
    name: 'Vénus',
    symbol: '♀',
    kind: 'planète tellurique',
    color: '#e6c48f',
    physical: {
      radius: 6051.8, polarRadius: 6051.8,
      mass: 4.8675e24, density: 5243, gravity: 8.87, escapeVelocity: 10.36,
      albedo: 0.689, temperatureMean: 464, temperatureMin: 437, temperatureMax: 497,
      rotationPeriod: -243.025, solarDay: 116.75, obliquity: 177.36,
    },
    orbit: {
      semiMajorAxisAu: 0.723336, semiMajorAxisKm: 108.209e6,
      eccentricity: 0.006777, inclination: 3.3947,
      period: 224.701, synodicPeriod: 583.92, orbitalSpeed: 35.02,
      perihelionAu: 0.718435, aphelionAu: 0.728236,
    },
    atmosphere: { pressure: 92, composition: [['Dioxyde de carbone', 96.5], ['Azote', 3.5]] },
    moons: 0,
    rings: false,
    discovery: 'Connue depuis la préhistoire',
    facts: [
      'L’emballement de l’effet de serre y maintient 464 °C au sol, plus chaud que Mercure pourtant plus proche du Soleil.',
      'Elle tourne à l’envers : sur Vénus, le Soleil se lève à l’ouest.',
      'Sa rotation est si lente que son jour sidéral (243 jours) dépasse son année (225 jours).',
      'La pression au sol équivaut à 900 mètres de profondeur dans nos océans.',
      'C’est l’astre le plus brillant du ciel après le Soleil et la Lune : jusqu’à la magnitude −4,9.',
    ],
  },
  {
    id: 'Earth',
    name: 'Terre',
    symbol: '⊕',
    kind: 'planète tellurique',
    color: '#4a90d9',
    physical: {
      radius: 6378.137, polarRadius: 6356.752,
      mass: 5.9722e24, density: 5514, gravity: 9.807, escapeVelocity: 11.186,
      albedo: 0.306, temperatureMean: 15, temperatureMin: -89, temperatureMax: 57,
      rotationPeriod: 0.99726968, solarDay: 1, obliquity: 23.4393,
    },
    orbit: {
      semiMajorAxisAu: 1.000003, semiMajorAxisKm: 149.598e6,
      eccentricity: 0.016711, inclination: 0.0,
      period: 365.256, synodicPeriod: null, orbitalSpeed: 29.78,
      perihelionAu: 0.983290, aphelionAu: 1.016716,
    },
    atmosphere: {
      pressure: 1.014,
      composition: [['Azote', 78.08], ['Oxygène', 20.95], ['Argon', 0.93], ['Dioxyde de carbone', 0.04]],
    },
    moons: 1,
    rings: false,
    discovery: '—',
    facts: [
      'L’année tropique (365,2422 jours), qui règle les saisons, est plus courte que l’année sidérale à cause de la précession des équinoxes.',
      'Sa rotation ralentit d’environ 1,8 ms par siècle sous l’effet des marées lunaires.',
      'L’axe de rotation décrit un cône complet en 25 772 ans : c’est la précession des équinoxes.',
      'Le périhélie est atteint début janvier, en plein hiver boréal : les saisons viennent de l’inclinaison, pas de la distance.',
      'Elle est la seule planète dont la surface porte de l’eau liquide en abondance.',
    ],
  },
  {
    id: 'Mars',
    name: 'Mars',
    symbol: '♂',
    kind: 'planète tellurique',
    color: '#c1440e',
    physical: {
      radius: 3396.2, polarRadius: 3376.2,
      mass: 6.4171e23, density: 3933, gravity: 3.71, escapeVelocity: 5.03,
      albedo: 0.170, temperatureMean: -65, temperatureMin: -143, temperatureMax: 35,
      rotationPeriod: 1.025957, solarDay: 1.027491, obliquity: 25.19,
    },
    orbit: {
      semiMajorAxisAu: 1.523710, semiMajorAxisKm: 227.939e6,
      eccentricity: 0.093394, inclination: 1.8497,
      period: 686.980, synodicPeriod: 779.94, orbitalSpeed: 24.08,
      perihelionAu: 1.381457, aphelionAu: 1.665963,
    },
    atmosphere: {
      pressure: 0.00636,
      composition: [['Dioxyde de carbone', 95.3], ['Azote', 2.7], ['Argon', 1.6], ['Oxygène', 0.13]],
    },
    moons: 2,
    rings: false,
    discovery: 'Connue depuis la préhistoire',
    facts: [
      'Le jour martien, ou sol, dure 24 h 39 min 35 s — à peine plus que le nôtre.',
      'Olympus Mons culmine à 22 km, presque trois fois l’Everest.',
      'Son excentricité marquée fait varier l’éclat des oppositions de la magnitude −1,0 à −2,9.',
      'Ses deux lunes, Phobos et Deimos, sont probablement des astéroïdes capturés.',
      'Des tempêtes de poussière peuvent envelopper la planète entière pendant des mois.',
    ],
  },
  {
    id: 'Jupiter',
    name: 'Jupiter',
    symbol: '♃',
    kind: 'géante gazeuse',
    color: '#d8a26a',
    physical: {
      radius: 71492, polarRadius: 66854,
      mass: 1.8982e27, density: 1326, gravity: 24.79, escapeVelocity: 59.5,
      albedo: 0.538, temperatureMean: -108, temperatureMin: null, temperatureMax: null,
      rotationPeriod: 0.413538, solarDay: 0.413541, obliquity: 3.13,
    },
    orbit: {
      semiMajorAxisAu: 5.202887, semiMajorAxisKm: 778.340e6,
      eccentricity: 0.048386, inclination: 1.3044,
      period: 4332.589, synodicPeriod: 398.88, orbitalSpeed: 13.06,
      perihelionAu: 4.951158, aphelionAu: 5.454616,
    },
    atmosphere: { pressure: null, composition: [['Hydrogène', 89.8], ['Hélium', 10.2], ['Méthane', 0.3]] },
    moons: 97,
    rings: true,
    discovery: 'Connue depuis la préhistoire ; lunes galiléennes découvertes en 1610',
    facts: [
      'Elle pèse deux fois et demie toutes les autres planètes réunies.',
      'Sa rotation en 9 h 55 min l’aplatit visiblement : son rayon polaire est inférieur de 7 % au rayon équatorial.',
      'La Grande Tache rouge est un anticyclone observé depuis au moins 1831, assez large pour contenir la Terre.',
      'Les quatre lunes galiléennes, visibles aux jumelles, ont fourni la première preuve d’orbites autour d’un autre corps que la Terre.',
      'Elle rayonne environ 1,6 fois plus d’énergie qu’elle n’en reçoit du Soleil, résidu de sa contraction.',
    ],
  },
  {
    id: 'Saturn',
    name: 'Saturne',
    symbol: '♄',
    kind: 'géante gazeuse',
    color: '#e3c07a',
    physical: {
      radius: 60268, polarRadius: 54364,
      mass: 5.6834e26, density: 687, gravity: 10.44, escapeVelocity: 35.5,
      albedo: 0.499, temperatureMean: -139, temperatureMin: null, temperatureMax: null,
      rotationPeriod: 0.439583, solarDay: 0.439599, obliquity: 26.73,
    },
    orbit: {
      semiMajorAxisAu: 9.536676, semiMajorAxisKm: 1426.666e6,
      eccentricity: 0.053862, inclination: 2.4860,
      period: 10759.22, synodicPeriod: 378.09, orbitalSpeed: 9.64,
      perihelionAu: 9.023054, aphelionAu: 10.050298,
    },
    atmosphere: { pressure: null, composition: [['Hydrogène', 96.3], ['Hélium', 3.25], ['Méthane', 0.45]] },
    moons: 274,
    rings: true,
    discovery: 'Connue depuis la préhistoire ; anneaux identifiés par Huygens en 1655',
    facts: [
      'Sa densité moyenne de 687 kg/m³ est inférieure à celle de l’eau : elle flotterait dans un océan assez grand.',
      'Les anneaux s’étendent sur 280 000 km de diamètre mais mesurent souvent moins de dix mètres d’épaisseur.',
      'Ils se présentent de profil tous les quinze ans environ et disparaissent alors des télescopes amateurs.',
      'Un hexagone atmosphérique stable de 30 000 km de côté entoure son pôle nord.',
      'Titan est la seule lune du système solaire dotée d’une atmosphère dense et de lacs d’hydrocarbures liquides.',
    ],
  },
  {
    id: 'Uranus',
    name: 'Uranus',
    symbol: '♅',
    kind: 'géante de glaces',
    color: '#9fd8e3',
    physical: {
      radius: 25559, polarRadius: 24973,
      mass: 8.6810e25, density: 1271, gravity: 8.87, escapeVelocity: 21.3,
      albedo: 0.488, temperatureMean: -197, temperatureMin: null, temperatureMax: null,
      rotationPeriod: -0.718333, solarDay: 0.718331, obliquity: 97.77,
    },
    orbit: {
      semiMajorAxisAu: 19.189165, semiMajorAxisKm: 2870.658e6,
      eccentricity: 0.047257, inclination: 0.7726,
      period: 30685.4, synodicPeriod: 369.66, orbitalSpeed: 6.80,
      perihelionAu: 18.282334, aphelionAu: 20.095996,
    },
    atmosphere: { pressure: null, composition: [['Hydrogène', 82.5], ['Hélium', 15.2], ['Méthane', 2.3]] },
    moons: 28,
    rings: true,
    discovery: 'William Herschel, 13 mars 1781',
    facts: [
      'Son axe est basculé de 98° : elle roule sur son orbite, pôles tournés vers le Soleil à tour de rôle.',
      'Chaque pôle connaît 42 ans de jour continu puis 42 ans de nuit.',
      'C’est la première planète découverte au télescope, à la limite de la visibilité à l’œil nu (magnitude 5,7).',
      'Le méthane atmosphérique absorbe le rouge et lui donne sa teinte bleu-vert.',
      'C’est la planète la plus froide du système solaire malgré sa position intermédiaire : −224 °C au minimum.',
    ],
  },
  {
    id: 'Neptune',
    name: 'Neptune',
    symbol: '♆',
    kind: 'géante de glaces',
    color: '#4a6fd8',
    physical: {
      radius: 24764, polarRadius: 24341,
      mass: 1.02413e26, density: 1638, gravity: 11.15, escapeVelocity: 23.5,
      albedo: 0.442, temperatureMean: -201, temperatureMin: null, temperatureMax: null,
      rotationPeriod: 0.671250, solarDay: 0.671254, obliquity: 28.32,
    },
    orbit: {
      semiMajorAxisAu: 30.069923, semiMajorAxisKm: 4498.396e6,
      eccentricity: 0.008590, inclination: 1.7700,
      period: 60189.0, synodicPeriod: 367.49, orbitalSpeed: 5.43,
      perihelionAu: 29.811622, aphelionAu: 30.328224,
    },
    atmosphere: { pressure: null, composition: [['Hydrogène', 80], ['Hélium', 19], ['Méthane', 1.5]] },
    moons: 16,
    rings: true,
    discovery: 'Le Verrier et Galle, 23 septembre 1846, par le calcul',
    facts: [
      'Elle fut découverte « au bout d’une plume » : Urbain Le Verrier en calcula la position avant toute observation.',
      'Ses vents atteignent 2 100 km/h, les plus violents connus dans le système solaire.',
      'Elle n’a bouclé qu’une seule orbite depuis sa découverte, achevée en juillet 2011.',
      'Triton tourne à contresens de la rotation de Neptune : c’est un objet de Kuiper capturé.',
      'Elle n’est jamais visible à l’œil nu : magnitude 7,8 au mieux.',
    ],
  },
];

export const DWARF_PLANETS = [
  {
    id: 'Pluto', name: 'Pluton', symbol: '♇', kind: 'planète naine (plutoïde)',
    color: '#c8b6a6',
    physical: {
      radius: 1188.3, mass: 1.303e22, density: 1854, gravity: 0.620,
      escapeVelocity: 1.21, albedo: 0.52, temperatureMean: -229,
      rotationPeriod: -6.387230, obliquity: 122.53,
    },
    orbit: {
      semiMajorAxisAu: 39.482, semiMajorAxisKm: 5906.4e6,
      eccentricity: 0.2488, inclination: 17.16,
      period: 90560, synodicPeriod: 366.73, orbitalSpeed: 4.67,
      perihelionAu: 29.658, aphelionAu: 49.305,
    },
    moons: 5,
    discovery: 'Clyde Tombaugh, 18 février 1930',
    facts: [
      'En résonance 2:3 avec Neptune, Pluton passe deux fois moins souvent au périhélie que sa voisine ne boucle trois orbites.',
      'De 1979 à 1999, elle fut plus proche du Soleil que Neptune.',
      'Charon est si massive par rapport à Pluton que les deux corps tournent autour d’un barycentre situé hors de Pluton.',
      'Sa surface porte une plaine d’azote gelé de 1 000 km, Sputnik Planitia, sans aucun cratère : elle se renouvelle.',
      'Reclassée planète naine par l’UAI en août 2006.',
    ],
  },
  {
    id: 'Ceres', name: 'Cérès', symbol: '', kind: 'planète naine (ceinture principale)',
    color: '#a39b91',
    physical: { radius: 469.7, mass: 9.383e20, density: 2162, gravity: 0.28, escapeVelocity: 0.51, albedo: 0.09, temperatureMean: -105, rotationPeriod: 0.3781, obliquity: 4 },
    orbit: { semiMajorAxisAu: 2.7658, semiMajorAxisKm: 413.7e6, eccentricity: 0.0785, inclination: 10.59, period: 1681.6, orbitalSpeed: 17.9, perihelionAu: 2.5484, aphelionAu: 2.9832 },
    moons: 0,
    discovery: 'Giuseppe Piazzi, 1er janvier 1801',
    facts: [
      'Premier astéroïde découvert, considéré comme une planète pendant un demi-siècle.',
      'Elle rassemble à elle seule un quart de la masse de la ceinture principale.',
      'De la vapeur d’eau y a été détectée : son manteau pourrait être glacé.',
    ],
  },
  {
    id: 'Eris', name: 'Éris', symbol: '', kind: 'planète naine (disque des objets épars)',
    color: '#d6d6d6',
    physical: { radius: 1163, mass: 1.638e22, density: 2430, gravity: 0.82, escapeVelocity: 1.38, albedo: 0.96, temperatureMean: -231, rotationPeriod: 15.786 },
    orbit: { semiMajorAxisAu: 67.864, semiMajorAxisKm: 10152e6, eccentricity: 0.4361, inclination: 44.04, period: 203830, orbitalSpeed: 3.43, perihelionAu: 38.271, aphelionAu: 97.457 },
    moons: 1,
    discovery: 'Michael Brown et son équipe, 5 janvier 2005',
    facts: [
      'Sa découverte a provoqué la redéfinition du mot « planète » et le déclassement de Pluton.',
      'Plus massive que Pluton de 27 %, elle en est le jumeau lourd.',
      'Son albédo de 0,96 en fait l’un des corps les plus réfléchissants du système solaire.',
    ],
  },
  {
    id: 'Haumea', name: 'Hauméa', symbol: '', kind: 'planète naine (ceinture de Kuiper)',
    color: '#e0dcd0',
    physical: { radius: 816, mass: 4.006e21, density: 1885, gravity: 0.401, escapeVelocity: 0.91, albedo: 0.51, temperatureMean: -241, rotationPeriod: 0.163146 },
    orbit: { semiMajorAxisAu: 43.116, semiMajorAxisKm: 6449e6, eccentricity: 0.1912, inclination: 28.21, period: 103660, orbitalSpeed: 4.53, perihelionAu: 34.867, aphelionAu: 51.365 },
    moons: 2,
    discovery: 'Annoncée en 2005',
    facts: [
      'Elle tourne en moins de quatre heures, ce qui l’a étirée en ellipsoïde deux fois plus long que large.',
      'C’est le seul objet transneptunien connu à posséder un anneau.',
    ],
  },
  {
    id: 'Makemake', name: 'Makémaké', symbol: '', kind: 'planète naine (ceinture de Kuiper)',
    color: '#d9b7a0',
    physical: { radius: 715, mass: 3.1e21, density: 2020, gravity: 0.41, escapeVelocity: 0.76, albedo: 0.81, temperatureMean: -239, rotationPeriod: 0.9511 },
    orbit: { semiMajorAxisAu: 45.430, semiMajorAxisKm: 6796e6, eccentricity: 0.1610, inclination: 28.98, period: 111845, orbitalSpeed: 4.42, perihelionAu: 38.116, aphelionAu: 52.744 },
    moons: 1,
    discovery: 'Michael Brown et son équipe, 31 mars 2005',
    facts: [
      'Nommée d’après le dieu créateur de l’île de Pâques, découverte peu après Pâques 2005.',
      'Sa surface est couverte de méthane gelé en grains millimétriques.',
    ],
  },
];

/** Lunes remarquables, regroupées par planète hôte. */
export const MOONS = {
  Earth: [
    {
      id: 'Moon', name: 'Lune', radius: 1737.4, mass: 7.342e22, density: 3344,
      gravity: 1.62, semiMajorAxisKm: 384399, period: 27.321661, eccentricity: 0.0549,
      inclination: 5.145, albedo: 0.136, discovery: '—',
      note: 'Rotation synchrone : elle nous montre toujours la même face, aux librations près.',
    },
  ],
  Mars: [
    { id: 'Phobos', name: 'Phobos', radius: 11.27, mass: 1.0659e16, semiMajorAxisKm: 9376, period: 0.31891, eccentricity: 0.0151, inclination: 1.093, albedo: 0.071, discovery: 'Asaph Hall, 1877', note: 'Se lève à l’ouest et fait deux fois le tour du ciel martien par jour ; elle s’écrasera dans 50 millions d’années.' },
    { id: 'Deimos', name: 'Deimos', radius: 6.2, mass: 1.4762e15, semiMajorAxisKm: 23463, period: 1.26244, eccentricity: 0.0002, inclination: 0.93, albedo: 0.068, discovery: 'Asaph Hall, 1877', note: 'Si petite qu’elle ne dépasse guère l’éclat de Vénus dans le ciel de Mars.' },
  ],
  Jupiter: [
    { id: 'Io', name: 'Io', radius: 1821.6, mass: 8.9319e22, density: 3528, semiMajorAxisKm: 421700, period: 1.769138, eccentricity: 0.0041, inclination: 0.05, albedo: 0.63, discovery: 'Galilée, 1610', note: 'Corps le plus volcanique du système solaire : plus de 400 volcans actifs, chauffés par les marées.' },
    { id: 'Europa', name: 'Europe', radius: 1560.8, mass: 4.7998e22, density: 3013, semiMajorAxisKm: 671034, period: 3.551181, eccentricity: 0.009, inclination: 0.47, albedo: 0.67, discovery: 'Galilée, 1610', note: 'Un océan salé de 100 km de profondeur sous une croûte de glace : la meilleure candidate à la vie du système solaire.' },
    { id: 'Ganymede', name: 'Ganymède', radius: 2634.1, mass: 1.4819e23, density: 1936, semiMajorAxisKm: 1070412, period: 7.154553, eccentricity: 0.0013, inclination: 0.20, albedo: 0.43, discovery: 'Galilée, 1610', note: 'Plus grande lune du système solaire, plus grosse que Mercure, et la seule à posséder son propre champ magnétique.' },
    { id: 'Callisto', name: 'Callisto', radius: 2410.3, mass: 1.0759e23, density: 1834, semiMajorAxisKm: 1882709, period: 16.689017, eccentricity: 0.0074, inclination: 0.192, albedo: 0.22, discovery: 'Galilée, 1610', note: 'La surface la plus cratérisée du système solaire : elle n’a pas été renouvelée depuis 4 milliards d’années.' },
  ],
  Saturn: [
    { id: 'Titan', name: 'Titan', radius: 2574.7, mass: 1.3452e23, density: 1880, semiMajorAxisKm: 1221870, period: 15.945, eccentricity: 0.0288, inclination: 0.35, albedo: 0.22, discovery: 'Christiaan Huygens, 1655', note: 'Atmosphère d’azote à 1,5 bar, pluies de méthane et lacs d’hydrocarbures : un cycle météorologique complet.' },
    { id: 'Enceladus', name: 'Encelade', radius: 252.1, mass: 1.0802e20, density: 1609, semiMajorAxisKm: 237948, period: 1.370218, eccentricity: 0.0047, inclination: 0.009, albedo: 1.375, discovery: 'William Herschel, 1789', note: 'Des geysers de vapeur d’eau jaillissent de son pôle sud et alimentent l’anneau E.' },
    { id: 'Rhea', name: 'Rhéa', radius: 763.8, mass: 2.3065e21, semiMajorAxisKm: 527108, period: 4.518212, eccentricity: 0.001, inclination: 0.345, albedo: 0.949, discovery: 'Jean-Dominique Cassini, 1672' },
    { id: 'Iapetus', name: 'Japet', radius: 734.5, mass: 1.8056e21, semiMajorAxisKm: 3560820, period: 79.3215, eccentricity: 0.0286, inclination: 15.47, albedo: 0.25, discovery: 'Jean-Dominique Cassini, 1671', note: 'Un hémisphère noir comme du charbon, l’autre blanc comme neige, et une crête équatoriale de 13 km de haut.' },
  ],
  Uranus: [
    { id: 'Titania', name: 'Titania', radius: 788.4, mass: 3.4e21, semiMajorAxisKm: 435910, period: 8.706234, eccentricity: 0.0011, inclination: 0.34, albedo: 0.35, discovery: 'William Herschel, 1787' },
    { id: 'Oberon', name: 'Obéron', radius: 761.4, mass: 3.076e21, semiMajorAxisKm: 583520, period: 13.463234, eccentricity: 0.0014, inclination: 0.058, albedo: 0.31, discovery: 'William Herschel, 1787' },
    { id: 'Miranda', name: 'Miranda', radius: 235.8, mass: 6.59e19, semiMajorAxisKm: 129390, period: 1.413479, eccentricity: 0.0013, inclination: 4.232, albedo: 0.32, discovery: 'Gerard Kuiper, 1948', note: 'Une falaise de 20 km, Verona Rupes, la plus haute connue du système solaire.' },
  ],
  Neptune: [
    { id: 'Triton', name: 'Triton', radius: 1353.4, mass: 2.14e22, density: 2061, semiMajorAxisKm: 354759, period: -5.876854, eccentricity: 0.000016, inclination: 156.885, albedo: 0.76, discovery: 'William Lassell, 1846', note: 'Seule grande lune rétrograde : capturée, elle spirale vers Neptune et finira disloquée en anneau.' },
  ],
  Pluto: [
    { id: 'Charon', name: 'Charon', radius: 606, mass: 1.586e21, density: 1702, semiMajorAxisKm: 19591, period: 6.3872, eccentricity: 0.0002, inclination: 0.08, albedo: 0.38, discovery: 'James Christy, 1978', note: 'Pluton et Charon se font face en permanence : le seul couple du système solaire en rotation doublement synchrone.' },
  ],
};

/** La Lune, décrite comme un corps à part entière pour la vue dédiée. */
export const MOON = {
  id: 'Moon', name: 'Lune', symbol: '☾', kind: 'satellite naturel de la Terre',
  color: '#cfc8bd',
  physical: {
    radius: 1737.4, mass: 7.342e22, density: 3344, gravity: 1.62,
    escapeVelocity: 2.38, albedo: 0.136, temperatureMean: -20,
    temperatureMin: -173, temperatureMax: 127,
    rotationPeriod: 27.321661, obliquity: 6.68,
  },
  orbit: {
    semiMajorAxisKm: 384399, perigeeKm: 363300, apogeeKm: 405500,
    eccentricity: 0.0549, inclination: 5.145,
    siderealMonth: 27.321661, synodicMonth: 29.530589,
    draconiticMonth: 27.212221, anomalisticMonth: 27.554550,
    tropicalMonth: 27.321582, orbitalSpeed: 1.022,
  },
  facts: [
    'Elle s’éloigne de 3,8 cm par an : la journée terrestre s’allonge d’autant.',
    'Les nœuds de son orbite reculent en 18,6 ans, ce qui règle le retour des saisons d’éclipses.',
    'La ligne des apsides, elle, tourne dans le sens direct en 8,85 ans.',
    'Ses librations nous laissent voir 59 % de sa surface au fil des mois, et non 50 %.',
    'Son diamètre apparent varie de 29,4′ à l’apogée à 33,5′ au périgée, d’où les éclipses annulaires ou totales.',
  ],
};

/** Périodes fondamentales, référencées dans les explications. */
export const CYCLES = {
  synodicMonth: 29.530588853,
  siderealMonth: 27.321661,
  draconiticMonth: 27.212220817,
  anomalisticMonth: 27.554549878,
  tropicalYear: 365.24219,
  siderealYear: 365.256363,
  anomalisticYear: 365.259636,
  saros: 6585.3213,
  metonicCycle: 6939.688,
  precession: 25772,
  siderealDay: 0.99726968,
};

export const ALL_BODIES = [SUN, ...PLANETS, MOON, ...DWARF_PLANETS];

export const planetById = (id) => PLANETS.find((p) => p.id === id) ?? null;
export const bodyById = (id) => ALL_BODIES.find((b) => b.id === id) ?? null;
