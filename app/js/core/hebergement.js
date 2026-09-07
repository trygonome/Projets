/**
 * Contexte d'exécution : navigateur, site installé, ou coquille Android.
 *
 * Ce que l'application dit de son installation et de ses mises à jour en
 * dépend : proposer d'installer une application déjà empaquetée dans un APK
 * n'aurait aucun sens.
 */

/** La coquille Android charge la page avec « ?hote=android ». */
export const dansApk = () => {
  try {
    return new URLSearchParams(location.search).get('hote') === 'android';
  } catch {
    return false;
  }
};

/** Site ajouté à l'écran d'accueil, lancé hors du navigateur. */
export const installe = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true
  || window.navigator.standalone === true;

/** Décrit l'hébergement en un mot, pour l'écran des réglages. */
export function hebergement() {
  if (dansApk()) return 'apk';
  if (installe()) return 'installe';
  return 'navigateur';
}
