# Céleste sur Android

Céleste est une application web installable. Il y a deux façons de l'avoir sur
un téléphone, selon ce que l'on cherche.

## 1. L'installer depuis le navigateur

C'est la voie normale, et elle suffit dans la quasi-totalité des cas.

1. Ouvrir l'adresse de publication dans **Chrome** (ou Edge, Samsung Internet,
   Brave — tout navigateur fondé sur Chromium).
2. Menu **⋮** → **Installer l'application**. Si l'entrée n'apparaît pas,
   **Ajouter à l'écran d'accueil** fait la même chose.
3. Lancer Céleste depuis l'écran d'accueil.

Ce que l'on obtient :

- une icône et un nom sur l'écran d'accueil, comme n'importe quelle application ;
- le plein écran, sans barre d'adresse ;
- **le fonctionnement hors connexion** : tout est mis en cache au premier
  lancement, environ deux mégaoctets ;
- l'accès à la géolocalisation, après autorisation ;
- la **boussole** du planétarium, qui dirige la carte du ciel selon la pose du
  téléphone ;
- des raccourcis d'appui long vers le ciel, le système solaire et l'agenda.

Le seul prérequis est que le site soit servi en **HTTPS** — ce que fait GitHub
Pages. Sur `http://` en réseau local, l'installation et le mode hors-ligne sont
désactivés par le navigateur (sauf sur `localhost`).

## 2. En faire une vraie APK

Utile si l'on veut distribuer l'application par fichier, la publier sur le Play
Store, ou simplement ne dépendre d'aucun navigateur visible. Android sait
emballer un site installable dans une **Trusted Web Activity** : une APK qui
n'est qu'une coquille autour du même site, sans barre d'adresse.

Avec [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), l'outil
officiel :

```sh
npm install -g @bubblewrap/cli

# Le manifeste de l'application publiée sert de point de départ.
bubblewrap init --manifest https://VOTRE-DOMAINE/manifest.webmanifest

bubblewrap build      # produit app-release-signed.apk
bubblewrap install    # l'installe sur un téléphone branché en USB
```

Deux points d'attention :

- Bubblewrap demande un JDK 17 et le SDK Android ; il propose de les installer
  lui-même au premier lancement.
- Pour que la barre d'adresse disparaisse vraiment, il faut publier le fichier
  `/.well-known/assetlinks.json` à la racine du site, avec l'empreinte de la
  clé de signature. `bubblewrap init` affiche le contenu exact à déposer.

L’APK obtenue reste une coquille : elle charge le même site, et bénéficie donc
des mises à jour publiées sans réinstallation.

## Autorisations

Céleste ne demande que deux choses, et seulement si on les lui demande : la
**position**, pour calculer les levers, les couchers et le ciel du lieu, et les
**capteurs d'orientation**, pour la boussole du planétarium. Les deux refus sont
parfaitement viables — le répertoire embarqué compte 126 lieux, les coordonnées
peuvent être saisies à la main, et la carte du ciel se dirige au doigt.

Rien n'est envoyé nulle part : il n'y a aucun serveur derrière l'application.
Les réglages restent dans le stockage local du navigateur.
