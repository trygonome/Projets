/**
 * Vérification du moteur d'éphémérides contre des faits astronomiques
 * indépendants : périodes fondamentales, géométrie des saisons, éclipses
 * documentées, bornes physiques connues.
 *
 * On évite d'y figer des valeurs produites par le moteur lui-même : un test
 * qui se compare à sa propre sortie ne prouve rien.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import * as Astronomy from '../app/vendor/astronomy.js';
import {
  Body, bodySnapshot, solarDay, dailyCircumstances, moonState, equationOfTime,
  solarDeclination, obliquity, nextMoonQuarters, localSiderealTime,
  subastralPoint, angularDiameter,
} from '../app/js/core/ephem.js';

const PARIS = { latitude: 48.8566, longitude: 2.3522, height: 35 };
const ZONE = 'Europe/Paris';

/* ------------------------------------------------------------- saisons */

test('les solstices portent la déclinaison solaire à l’obliquité', () => {
  const seasons = Astronomy.Seasons(2026);
  const june = solarDeclination(seasons.jun_solstice.date);
  const december = solarDeclination(seasons.dec_solstice.date);
  const tilt = obliquity(seasons.jun_solstice.date);

  assert.ok(Math.abs(june - tilt) < 0.02,
    `déclinaison de juin ${june} contre obliquité ${tilt}`);
  assert.ok(Math.abs(december + tilt) < 0.02,
    `déclinaison de décembre ${december} contre obliquité ${tilt}`);
});

test('la déclinaison solaire s’annule aux équinoxes', () => {
  const seasons = Astronomy.Seasons(2026);
  for (const equinox of [seasons.mar_equinox.date, seasons.sep_equinox.date]) {
    assert.ok(Math.abs(solarDeclination(equinox)) < 0.01,
      `déclinaison ${solarDeclination(equinox)} à l’équinoxe`);
  }
});

test('les saisons tombent aux dates attendues du calendrier', () => {
  const seasons = Astronomy.Seasons(2026);
  const day = (date) => [date.getUTCMonth() + 1, date.getUTCDate()];
  assert.deepEqual(day(seasons.mar_equinox.date)[0], 3);
  assert.ok([19, 20, 21].includes(day(seasons.mar_equinox.date)[1]));
  assert.ok([20, 21, 22].includes(day(seasons.jun_solstice.date)[1]));
  assert.ok([21, 22, 23].includes(day(seasons.sep_equinox.date)[1]));
  assert.ok([20, 21, 22].includes(day(seasons.dec_solstice.date)[1]));
});

test('l’obliquité vaut environ 23,44° et décroît d’environ 47″ par siècle', () => {
  const maintenant = obliquity(new Date('2026-01-01T00:00:00Z'));
  assert.ok(maintenant > 23.4 && maintenant < 23.45, `obliquité vraie ${maintenant}`);

  // La décroissance séculaire porte sur l'obliquité *moyenne* : l'obliquité
  // vraie y ajoute la nutation, qui oscille de ±9,2″ en 18,6 ans et brouillerait
  // complètement la mesure sur un intervalle de cent ans.
  const moyenne = (date) => Astronomy.e_tilt(new Astronomy.AstroTime(date)).mobl;
  const ecart = (moyenne(new Date('2026-01-01T00:00:00Z'))
    - moyenne(new Date('2126-01-01T00:00:00Z'))) * 3600;
  assert.ok(ecart > 44 && ecart < 50, `variation séculaire ${ecart}″`);

  // La nutation, elle, ne dépasse jamais une dizaine de secondes d'arc.
  let amplitude = 0;
  for (let jour = 0; jour < 6800; jour += 20) {
    const date = new Date(Date.UTC(2026, 0, 1) + jour * 86400000);
    amplitude = Math.max(amplitude,
      Math.abs(obliquity(date) - moyenne(date)) * 3600);
  }
  assert.ok(amplitude > 8 && amplitude < 10, `amplitude de nutation ${amplitude}″`);
});

/* -------------------------------------------------------- durée du jour */

test('le jour dure environ douze heures aux équinoxes', () => {
  const equinox = Astronomy.Seasons(2026).mar_equinox.date;
  const duree = dailyCircumstances(Body.Sun, equinox, PARIS, ZONE).visibleHours;
  // Réfraction et diamètre du disque allongent le jour de quelques minutes.
  assert.ok(duree > 12.05 && duree < 12.25, `durée ${duree} h`);
});

test('les durées extrêmes du jour à Paris encadrent les valeurs connues', () => {
  const seasons = Astronomy.Seasons(2026);
  const ete = dailyCircumstances(Body.Sun, seasons.jun_solstice.date, PARIS, ZONE).visibleHours;
  const hiver = dailyCircumstances(Body.Sun, seasons.dec_solstice.date, PARIS, ZONE).visibleHours;
  assert.ok(ete > 16.1 && ete < 16.3, `solstice d’été ${ete} h`);
  assert.ok(hiver > 8.1 && hiver < 8.3, `solstice d’hiver ${hiver} h`);
});

test('le Soleil de minuit et la nuit polaire apparaissent au-delà du cercle polaire', () => {
  const tromso = { latitude: 69.6496, longitude: 18.956, height: 10 };
  const ete = dailyCircumstances(Body.Sun, new Date('2026-06-21T12:00:00Z'), tromso, 'Europe/Oslo');
  const hiver = dailyCircumstances(Body.Sun, new Date('2026-12-21T12:00:00Z'), tromso, 'Europe/Oslo');
  assert.equal(ete.status, 'circumpolaire');
  assert.equal(hiver.status, 'jamais-leve');
});

test('la hauteur méridienne suit 90° − latitude + déclinaison', () => {
  const date = new Date('2026-05-15T12:00:00Z');
  const jour = solarDay(date, PARIS, ZONE);
  const attendu = 90 - PARIS.latitude + solarDeclination(jour.transit);
  assert.ok(Math.abs(jour.transitAltitude - attendu) < 0.1,
    `hauteur ${jour.transitAltitude} contre ${attendu}`);
});

test('la nuit astronomique n’existe pas à Paris au solstice d’été', () => {
  const jour = solarDay(new Date('2026-06-21T12:00:00Z'), PARIS, ZONE);
  assert.equal(jour.twilights.astronomique.reached, false);
  assert.equal(jour.nightHours, null);
  // En décembre, en revanche, elle dure plusieurs heures.
  const hiver = solarDay(new Date('2026-12-21T12:00:00Z'), PARIS, ZONE);
  assert.equal(hiver.twilights.astronomique.reached, true);
  assert.ok(hiver.nightHours > 10 && hiver.nightHours < 13, `nuit ${hiver.nightHours} h`);
});

/* ------------------------------------------------------------ la Lune */

test('l’intervalle moyen entre nouvelles Lunes vaut le mois synodique', () => {
  const quartiers = nextMoonQuarters(new Date('2026-01-01T00:00:00Z'), 200)
    .filter((quartier) => quartier.quarter === 0);
  const duree = (quartiers.at(-1).date - quartiers[0].date)
    / 86400000 / (quartiers.length - 1);
  assert.ok(Math.abs(duree - 29.530589) < 0.02, `lunaison moyenne ${duree} j`);
});

test('les quartiers se succèdent dans l’ordre et à un quart de lunaison', () => {
  const quartiers = nextMoonQuarters(new Date('2026-03-01T00:00:00Z'), 12);
  for (let i = 1; i < quartiers.length; i += 1) {
    assert.equal(quartiers[i].quarter, (quartiers[i - 1].quarter + 1) % 4);
    const ecart = (quartiers[i].date - quartiers[i - 1].date) / 86400000;
    assert.ok(ecart > 6.2 && ecart > 6 && ecart < 8.5, `écart ${ecart} j`);
  }
});

test('la pleine Lune est éclairée à plus de 99 %, la nouvelle à moins de 1 %', () => {
  const quartiers = nextMoonQuarters(new Date('2026-04-01T00:00:00Z'), 8);
  for (const quartier of quartiers) {
    const etat = moonState(quartier.date, PARIS);
    if (quartier.quarter === 2) {
      assert.ok(etat.illuminatedFraction > 0.99, `pleine Lune ${etat.illuminatedFraction}`);
    }
    if (quartier.quarter === 0) {
      assert.ok(etat.illuminatedFraction < 0.01, `nouvelle Lune ${etat.illuminatedFraction}`);
    }
    if (quartier.quarter === 1 || quartier.quarter === 3) {
      assert.ok(Math.abs(etat.illuminatedFraction - 0.5) < 0.01,
        `quartier ${etat.illuminatedFraction}`);
    }
  }
});

test('la distance lunaire reste dans ses bornes connues', () => {
  let minimum = Infinity;
  let maximum = 0;
  for (let jour = 0; jour < 400; jour += 1) {
    const distance = moonState(
      new Date(Date.UTC(2026, 0, 1) + jour * 86400000), null,
    ).distanceKm;
    minimum = Math.min(minimum, distance);
    maximum = Math.max(maximum, distance);
  }
  assert.ok(minimum > 355000 && minimum < 371000, `périgée minimal ${minimum} km`);
  assert.ok(maximum > 400000 && maximum < 407000, `apogée maximal ${maximum} km`);
});

test('le diamètre apparent de la Lune varie de 29,3′ à 33,5′', () => {
  const valeurs = [];
  for (let jour = 0; jour < 400; jour += 1) {
    valeurs.push(moonState(
      new Date(Date.UTC(2026, 0, 1) + jour * 86400000), null,
    ).angularDiameter * 60);
  }
  assert.ok(Math.min(...valeurs) > 29.2 && Math.min(...valeurs) < 29.9);
  assert.ok(Math.max(...valeurs) > 33 && Math.max(...valeurs) < 33.8);
});

/* ---------------------------------------------------------- éclipses */

test('l’éclipse totale du 2 août 2027 est bien identifiée', () => {
  // L'une des plus longues du siècle, plus de six minutes sur la haute Égypte.
  const eclipse = Astronomy.SearchGlobalSolarEclipse(new Date('2027-07-01T00:00:00Z'));
  assert.equal(eclipse.kind, 'total');
  assert.equal(eclipse.peak.date.getUTCFullYear(), 2027);
  assert.equal(eclipse.peak.date.getUTCMonth() + 1, 8);
  assert.equal(eclipse.peak.date.getUTCDate(), 2);
  // Le maximum tombe sur l'Égypte : autour de 25° N et 33° E.
  assert.ok(Math.abs(eclipse.latitude - 25) < 3, `latitude ${eclipse.latitude}`);
  assert.ok(Math.abs(eclipse.longitude - 33) < 4, `longitude ${eclipse.longitude}`);
});

test('l’éclipse totale du 12 août 2026 traverse bien l’Atlantique nord', () => {
  const eclipse = Astronomy.SearchGlobalSolarEclipse(new Date('2026-08-01T00:00:00Z'));
  assert.equal(eclipse.kind, 'total');
  assert.equal(eclipse.peak.date.getUTCDate(), 12);
  assert.ok(eclipse.latitude > 60, `latitude ${eclipse.latitude}`);
});

test('une éclipse se répète un saros plus tard', () => {
  const SAROS = 6585.3213;
  const premiere = Astronomy.SearchGlobalSolarEclipse(new Date('2027-01-01T00:00:00Z'));
  const attendue = new Date(premiere.peak.date.getTime() + SAROS * 86400000);
  const suivante = Astronomy.SearchGlobalSolarEclipse(
    new Date(attendue.getTime() - 5 * 86400000),
  );
  const ecart = Math.abs(suivante.peak.date - attendue) / 3600000;
  assert.ok(ecart < 6, `écart de ${ecart} h au saros suivant`);
});

test('toute éclipse survient à moins de 18° d’un nœud lunaire', () => {
  let eclipse = Astronomy.SearchGlobalSolarEclipse(new Date('2026-01-01T00:00:00Z'));
  for (let i = 0; i < 6; i += 1) {
    const noeud = Astronomy.SearchMoonNode(
      new Date(eclipse.peak.date.getTime() - 20 * 86400000),
    );
    let plusProche = Math.abs(noeud.time.date - eclipse.peak.date);
    const suivant = Astronomy.NextMoonNode(noeud);
    plusProche = Math.min(plusProche, Math.abs(suivant.time.date - eclipse.peak.date));
    // La Lune parcourt 13,2° par jour : 18° font moins de 1,4 jour.
    assert.ok(plusProche / 86400000 < 1.4,
      `éclipse du ${eclipse.peak.date.toISOString()} à ${plusProche / 86400000} j du nœud`);
    eclipse = Astronomy.NextGlobalSolarEclipse(eclipse.peak);
  }
});

/* ---------------------------------------------------------- planètes */

test('les élongations maximales respectent les valeurs connues', () => {
  const bornes = { Mercury: [17.5, 28.5], Venus: [45, 47.5] };
  for (const [corps, [minimum, maximum]] of Object.entries(bornes)) {
    let evenement = Astronomy.SearchMaxElongation(corps, new Date('2026-01-01T00:00:00Z'));
    for (let i = 0; i < 6; i += 1) {
      assert.ok(evenement.elongation >= minimum && evenement.elongation <= maximum,
        `${corps} : élongation ${evenement.elongation}`);
      evenement = Astronomy.SearchMaxElongation(
        corps, new Date(evenement.time.date.getTime() + 20 * 86400000),
      );
    }
  }
});

test('la Terre passe au périhélie début janvier et à l’aphélie début juillet', () => {
  let apside = Astronomy.SearchPlanetApsis(Body.Earth, new Date('2026-01-01T00:00:00Z'));
  const trouve = { 0: null, 1: null };
  for (let i = 0; i < 3; i += 1) {
    trouve[apside.kind] ??= apside;
    apside = Astronomy.NextPlanetApsis(Body.Earth, apside);
  }
  assert.equal(trouve[0].time.date.getUTCMonth() + 1, 1, 'périhélie en janvier');
  assert.equal(trouve[1].time.date.getUTCMonth() + 1, 7, 'aphélie en juillet');
  assert.ok(trouve[0].dist_au > 0.9829 && trouve[0].dist_au < 0.9835);
  assert.ok(trouve[1].dist_au > 1.0165 && trouve[1].dist_au < 1.0171);
});

test('le diamètre apparent du Soleil varie de 31,5′ à 32,5′', () => {
  const valeurs = [];
  for (let jour = 0; jour < 366; jour += 3) {
    const date = new Date(Date.UTC(2026, 0, 1) + jour * 86400000);
    const distance = bodySnapshot(Body.Sun, date, PARIS).distanceKm;
    valeurs.push(angularDiameter(Body.Sun, distance) * 60);
  }
  assert.ok(Math.min(...valeurs) > 31.4 && Math.min(...valeurs) < 31.7);
  assert.ok(Math.max(...valeurs) > 32.4 && Math.max(...valeurs) < 32.8);
});

test('les magnitudes des planètes restent dans leurs plages connues', () => {
  // Mercure grimpe jusqu'à +7 près de sa conjonction supérieure, lorsqu'il est
  // au plus loin derrière le Soleil : la plage utile à l'œil est bien plus
  // étroite, mais la plage physique va de −2,5 à +7,3.
  const plages = {
    Mercury: [-2.5, 7.3], Venus: [-4.9, -3.7], Mars: [-3.0, 1.9],
    Jupiter: [-2.95, -1.5], Saturn: [-0.6, 1.3],
    Uranus: [5.3, 6.1], Neptune: [7.6, 8.1],
  };
  for (const [corps, [minimum, maximum]] of Object.entries(plages)) {
    for (let jour = 0; jour < 800; jour += 11) {
      const date = new Date(Date.UTC(2026, 0, 1) + jour * 86400000);
      const magnitude = Astronomy.Illumination(corps, date).mag;
      assert.ok(magnitude >= minimum - 0.15 && magnitude <= maximum + 0.15,
        `${corps} le ${date.toISOString().slice(0, 10)} : magnitude ${magnitude}`);
    }
  }
});

/* ------------------------------------------------- équation du temps */

test('l’équation du temps atteint ses extrêmes connus', () => {
  const valeurs = [];
  for (let jour = 0; jour < 366; jour += 1) {
    const date = new Date(Date.UTC(2026, 0, 1, 12) + jour * 86400000);
    valeurs.push({ jour, valeur: equationOfTime(date), date });
  }
  const maximum = valeurs.reduce((a, b) => (b.valeur > a.valeur ? b : a));
  const minimum = valeurs.reduce((a, b) => (b.valeur < a.valeur ? b : a));

  assert.ok(maximum.valeur > 16 && maximum.valeur < 16.8,
    `maximum ${maximum.valeur} min`);
  assert.equal(maximum.date.getUTCMonth() + 1, 11, 'maximum début novembre');
  assert.ok(minimum.valeur < -14 && minimum.valeur > -14.5,
    `minimum ${minimum.valeur} min`);
  assert.equal(minimum.date.getUTCMonth() + 1, 2, 'minimum à la mi-février');
});

test('l’équation du temps s’annule quatre fois dans l’année', () => {
  let changements = 0;
  let precedent = equationOfTime(new Date(Date.UTC(2026, 0, 1, 12)));
  for (let jour = 1; jour < 365; jour += 1) {
    const valeur = equationOfTime(new Date(Date.UTC(2026, 0, 1, 12) + jour * 86400000));
    if (Math.sign(valeur) !== Math.sign(precedent)) changements += 1;
    precedent = valeur;
  }
  assert.equal(changements, 4);
});

/* ------------------------------------------------------ repères locaux */

test('le temps sidéral gagne environ quatre minutes par jour solaire', () => {
  const depart = new Date('2026-05-01T22:00:00Z');
  const debut = localSiderealTime(depart, PARIS);
  const fin = localSiderealTime(new Date(depart.getTime() + 86400000), PARIS);
  const gain = ((fin - debut + 24) % 24) * 60;
  assert.ok(Math.abs(gain - 3.9345) < 0.05, `gain ${gain} min`);
});

test('le point subsolaire suit la déclinaison et tourne d’un tour par jour', () => {
  const date = new Date('2026-06-21T12:00:00Z');
  const point = subastralPoint(Body.Sun, date);
  assert.ok(Math.abs(point.latitude - solarDeclination(date)) < 0.01);
  const plusTard = subastralPoint(Body.Sun, new Date(date.getTime() + 3600000));
  let derive = point.longitude - plusTard.longitude;
  if (derive < -180) derive += 360;
  if (derive > 180) derive -= 360;
  assert.ok(Math.abs(derive - 15) < 0.3, `dérive horaire ${derive}°`);
});

test('le Soleil culmine au sud à Paris et au nord sous les tropiques austraux', () => {
  const jour = solarDay(new Date('2026-12-21T12:00:00Z'), PARIS, ZONE);
  const azimut = bodySnapshot(Body.Sun, jour.transit, PARIS).azimuth;
  assert.ok(Math.abs(azimut - 180) < 1, `azimut ${azimut}`);

  const sydney = { latitude: -33.8688, longitude: 151.2093, height: 58 };
  const jourSud = solarDay(new Date('2026-12-21T00:00:00Z'), sydney, 'Australia/Sydney');
  const azimutSud = bodySnapshot(Body.Sun, jourSud.transit, sydney).azimuth;
  assert.ok(azimutSud < 5 || azimutSud > 355, `azimut austral ${azimutSud}`);
});

test('lever et coucher encadrent la culmination', () => {
  for (const corps of [Body.Sun, Body.Moon, Body.Jupiter]) {
    const circonstances = dailyCircumstances(
      corps, new Date('2026-10-15T12:00:00Z'), PARIS, ZONE,
    );
    if (circonstances.status !== 'normal' || !circonstances.transit) continue;
    const hauteurCulmination = circonstances.transitAltitude;
    assert.ok(hauteurCulmination > circonstances.antitransitAltitude,
      `${corps} : culmination sous l’anti-culmination`);
  }
});
