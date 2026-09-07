# Céleste sur Android

Il y a deux façons d'avoir Céleste sur un téléphone : installer l'**APK**, ou
ajouter le **site** à l'écran d'accueil. Les deux donnent la même application,
qui fonctionne sans connexion dans les deux cas.

| | APK | Site installé |
| --- | --- | --- |
| Où le prendre | fichier `.apk` | adresse de publication |
| Connexion nécessaire | jamais, même au premier lancement | une fois, pour le premier chargement |
| Mise à jour | réinstaller le fichier | automatique |
| Poids | 1,7 Mo | 1,9 Mo mis en cache |
| Prérequis | autoriser les sources inconnues | HTTPS |

## Installer l'APK

1. Copier `celeste-1.0.0.apk` sur le téléphone — câble, cloud, ou téléchargement
   depuis la page des versions du dépôt.
2. L'ouvrir depuis le gestionnaire de fichiers.
3. Android demande d'autoriser l'installation depuis cette source : c'est un
   réglage par application, à accorder au gestionnaire de fichiers ou au
   navigateur qui a servi le fichier.
4. Installer, puis lancer Céleste depuis l'écran d'accueil.

L'APK n'est pas passé par le Play Store : Android affichera un avertissement.
C'est le comportement normal pour une application distribuée par fichier.

### Mettre à jour

Une nouvelle version s'installe par-dessus l'ancienne — réglages et lieu
conservés — **à condition qu'elle soit signée avec la même clé**. Si vous
reconstruisez l'APK avec une autre clé, il faut désinstaller d'abord.

## Installer le site

1. Ouvrir l'adresse de publication dans **Chrome**.
2. Menu **⋮** → **Installer l'application**, ou **Ajouter à l'écran d'accueil**.

Le premier lancement met en cache environ deux mégaoctets ; ensuite, plus rien
n'est téléchargé. Sur iPhone, le chemin passe par Partager puis **Sur l'écran
d'accueil**.

## Ce qu'il y a dans l'APK

La coquille Android tient en une classe, `MainActivity`, et une seule
dépendance, `androidx.webkit`. Elle n'ajoute aucune fonctionnalité : elle
héberge l'application web, qui est la même que celle publiée sur le web, copiée
telle quelle dans les assets.

Le point délicat est l'**origine**. Chargée depuis `file://`, une application à
modules ES ne démarrerait pas : le navigateur refuse les imports croisés sur ce
schéma, et le stockage local y est cloisonné. `WebViewAssetLoader` sert donc les
assets sous une origine `https://appassets.androidplatform.net/` — un domaine
réservé par AndroidX, jamais résolu sur le réseau. Le WebView traite alors
l'application exactement comme un site : modules, stockage local et service
worker compris.

Rien ne sort de l'appareil. L'APK ne déclare aucune permission réseau.

## Construire l'APK soi-même

Il faut un JDK 17 ou plus, et le SDK Android (plateforme 35, build-tools 35).

```sh
export ANDROID_HOME=/chemin/vers/android-sdk
npm run build:apk            # release
npm run build:apk -- debug   # variante de débogage
```

Le script enchaîne les étapes dans l'ordre qui compte : régénérer le service
worker — qui porte l'empreinte du contenu —, copier `app/` dans les assets,
vérifier la cohérence du dépôt, puis lancer Gradle. L'APK sort dans
`android/app/build/outputs/apk/`.

Pour régénérer les icônes après modification du dessin :

```sh
npm run build:android-icons
```

### Signature

Sans configuration, la variante `release` est signée avec la clé de débogage
d'Android : installable, mais impropre à une distribution.

Pour signer avec votre propre clé, créez-en une puis décrivez-la dans
`android/keystore.properties` — fichier ignoré par git, comme la clé elle-même :

```sh
keytool -genkeypair -v -keystore android/celeste-release.jks \
  -alias celeste -keyalg RSA -keysize 4096 -validity 10950 -storetype PKCS12
```

```properties
# android/keystore.properties
storeFile=celeste-release.jks
storePassword=…
keyAlias=celeste
keyPassword=…
```

**Gardez cette clé.** Elle seule permet de publier des mises à jour qui
s'installent par-dessus la version précédente.

### Construction automatique

Le workflow `.github/workflows/apk.yml` construit l'APK à chaque poussée et le
dépose en artefact téléchargeable. Sur une publication, il le joint aussi à la
version. Pour qu'il signe avec votre clé, ajoutez quatre secrets au dépôt :
`KEYSTORE_BASE64` (la clé encodée par `base64 -w0`), `KEYSTORE_PASSWORD`,
`KEY_ALIAS` et `KEY_PASSWORD`.

## Autorisations

Céleste ne demande que deux choses, et seulement si on les lui demande : la
**position**, pour calculer les levers, les couchers et le ciel du lieu, et les
**capteurs d'orientation**, pour la boussole du planétarium. Les deux refus sont
parfaitement viables — le répertoire embarqué compte 126 lieux, les coordonnées
peuvent être saisies à la main, et la carte du ciel se dirige au doigt.

Rien n'est envoyé nulle part : il n'y a aucun serveur derrière l'application.
Les réglages restent dans le stockage local du WebView.

## Compatibilité

- **Android 7.0** et plus récent (API 24).
- Le WebView se met à jour par le Play Store, indépendamment de la version
  d'Android : même un appareil ancien dispose d'un moteur récent, avec WebGL 2
  pour la vue tridimensionnelle.
- L'application se dessine bord à bord et respecte encoches et barres système.
