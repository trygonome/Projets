/**
 * Orientation de l'appareil : diriger le planétarium en pointant le téléphone
 * vers le ciel.
 *
 * Le capteur donne trois angles d'Euler intrinsèques (Z–X′–Y″). On en
 * reconstruit la matrice de rotation de l'appareil dans le repère terrestre,
 * puis on y projette l'axe qui sort du dos du téléphone : c'est la direction
 * que l'on vise en regardant l'écran.
 */

const DEG = Math.PI / 180;

export const orientationAvailable = () =>
  typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

/**
 * Demande l'autorisation quand la plateforme l'exige (iOS ≥ 13). Ailleurs —
 * Android compris — l'accès est libre en contexte sécurisé.
 */
export async function requestOrientationPermission() {
  const requester = window.DeviceOrientationEvent?.requestPermission;
  if (typeof requester !== 'function') return true;
  try {
    return (await requester.call(window.DeviceOrientationEvent)) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Direction visée, en azimut et hauteur, à partir des angles du capteur.
 *
 * Repère terrestre : x vers l'est, y vers le nord, z vers le zénith.
 * Repère appareil : x vers la droite de l'écran, y vers son haut, z sortant
 * de l'écran vers l'utilisateur. La visée est donc l'axe −z.
 */
export function orientationToAim(alpha, beta, gamma) {
  const a = alpha * DEG;
  const b = beta * DEG;
  const g = gamma * DEG;
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);

  // Troisième colonne de R = Rz(α)·Rx(β)·Ry(γ), c'est-à-dire l'axe z de
  // l'appareil vu du repère terrestre ; la visée en est l'opposé.
  const x = -(cA * sG + sA * sB * cG);
  const y = -(sA * sG - cA * sB * cG);
  const z = -(cB * cG);

  const altitude = Math.asin(Math.max(-1, Math.min(1, z))) / DEG;
  const azimuth = ((Math.atan2(x, y) / DEG) % 360 + 360) % 360;
  return { azimuth, altitude };
}

/**
 * Écoute l'orientation absolue et appelle `onAim` à chaque mesure.
 * Renvoie une fonction d'arrêt.
 *
 * `deviceorientationabsolute` est l'événement calé sur le nord magnétique ;
 * `deviceorientation` ne l'est pas toujours, mais sert de repli, complété par
 * le cap fourni par Safari.
 */
export function watchOrientation(onAim, { smoothing = 0.18 } = {}) {
  let lissee = null;

  const handle = (event) => {
    const heading = event.webkitCompassHeading;
    // Safari donne le cap dans le sens horaire ; alpha tourne à l'inverse.
    const alpha = Number.isFinite(heading) ? 360 - heading : event.alpha;
    if (!Number.isFinite(alpha) || !Number.isFinite(event.beta)
      || !Number.isFinite(event.gamma)) return;

    const aim = orientationToAim(alpha, event.beta, event.gamma);
    // Lissage exponentiel : les capteurs magnétiques sont bruyants, et une
    // visée qui tressaute rend la carte du ciel inutilisable.
    if (!lissee) lissee = aim;
    else {
      let delta = aim.azimuth - lissee.azimuth;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lissee = {
        azimuth: (lissee.azimuth + delta * smoothing + 360) % 360,
        altitude: lissee.altitude + (aim.altitude - lissee.altitude) * smoothing,
      };
    }
    onAim(lissee, event.absolute !== false);
  };

  const type = 'ondeviceorientationabsolute' in window
    ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(type, handle, true);
  return () => window.removeEventListener(type, handle, true);
}
