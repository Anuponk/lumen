# Lumen Android — TWA, #170

Ce projet ouvre `https://lumen.nopuna.fr/` avec Android Browser Helper, sans
copier le jeu ni modifier son moteur. Le paquet n'embarque pas une copie hors
ligne de la PWA. Développement du packaging et recette Android sont distincts.
Lire [signature et domaine](SIGNING.md), [recette](TESTING.md) et
[dossier Google Play](PLAY.md) avant distribution.

## Icônes et splash

Les PNG launcher des cinq densités et le splash 512 × 512 sont rendus depuis
`../icon-maskable.svg`, identité céleste validée dans #625. Les vecteurs adaptatif
et monochrome en reprennent les arcs et l'étoile ; les dégradés restent dans les
PNG, le vecteur emploie l'or uni. Aucun nouveau dessin de constellation.
Les PNG legacy ont des coins transparents arrondis ; le splash reste opaque,
et Android applique lui-même le masque aux icônes adaptatives.

Pour régénérer, démarrer Chromium/Edge headless avec un **profil temporaire
dédié** et un port de débogage local, puis exécuter depuis `android/` :

```sh
LUMEN_CDP_URL=http://127.0.0.1:9222 node tools/render-icons.mjs
node --test tools/packaging.test.mjs
```

Le générateur ferme ce navigateur dédié, lit seulement le SVG du dépôt et
n'utilise aucun site ou compte. Il refuse une structure de SVG inattendue.
Revoir visuellement les fichiers puis laisser la CI lint/compiler les ressources.
L'acceptation dans un lanceur Android réel reste distincte.

## Compilation reproductible

Prérequis : JDK **17**, Android SDK Platform **36**, Build Tools **35.0.0**,
Node **22** pour les outils ; `ANDROID_HOME` désigne le SDK. Installer les
licences SDK avec `sdkmanager --licenses`. Le wrapper officiel vérifié télécharge
Gradle **8.13** ; AGP **8.13.2**, Android Browser Helper **2.7.3**, minSdk **24**,
targetSdk **36**. Aucun npm install ni build web nécessaire.
Les versions sont figées ; une compilation nécessite les dépôts Google/Maven.
Sous Windows, privilégier un chemin de checkout court : le lancement du binaire
AAPT2 depuis un cache à plus de 260 caractères peut échouer. Le build local de
ce lot a utilisé le même AAPT2 copié à un chemin court, sans changer sa version.

Depuis `android/` (Windows : remplacer `./gradlew` par `.\gradlew.bat`) :

```sh
node --test tools/packaging.test.mjs
./gradlew --no-daemon :app:lint :app:assembleDebug :app:bundleDebug :app:bundleRelease
```

| Sortie | Usage |
|---|---|
| `app/build/outputs/apk/debug/app-debug.apk` | APK installable, certificat local de test, package suffixé `.debug` |
| `app/build/outputs/bundle/debug/app-debug.aab` | AAB de test signé debug, pas pour Play |
| `app/build/outputs/bundle/release/app-release.aab` | Non signé sans variables de signature ; à signer avec la clé d'upload pour Play |

Le workflow [Android packaging](../.github/workflows/android-packaging.yml)
compile séparément du métier, exécute lint et valide les artefacts avec
bundletool **1.18.2**, apkanalyzer, apksigner et jarsigner. Il vérifie versions,
permissions du manifeste fusionné, liens HTTPS, absence de code natif `.so` et
signature attendue. Les APK/AAB, empreintes SHA-256 et rapports sont téléchargeables
14 jours dans Actions. Aucun secret de production, aucune étape de déploiement.
`lint.xml` ignore uniquement la suggestion de mise à jour du wrapper épinglé,
sur son fichier précis ; les autres diagnostics restent bloquants. Le wrapper
exclut ses fichiers des sauvegardes/transferts Android ; cela ne modifie pas le
stockage du navigateur ni les sauvegardes de progression existantes.
Le certificat debug CI change avec le runner : préférer une clé locale stable
pour les essais TWA sans barre d'adresse ; ne jamais conserver la clé CI.

Preuves locales et limites de la première livraison : [EVIDENCE.md](EVIDENCE.md).

`release.properties` est la source des coordonnées publiques candidates :
`fr.nopuna.lumen`, versionCode `1`, versionName `1.0.0`. Le propriétaire doit
confirmer l'ID **avant** le premier upload ; après publication il est immuable.
Chaque upload ultérieur augmente versionCode (maximum Play : 2100000000).
La version Android est indépendante de la version web `1.11.1+<commit-count>`.
Des variantes sont possibles avec `-PlumenApplicationId=fr.nopuna.lumen`
`-PlumenVersionCode=2 -PlumenVersionName=1.0.1` ; enregistrer les valeurs finales
dans le fichier suivi avant livraison. La validation CI utilise ce fichier.

## Décision technique et compatibilité

Inspection initiale : main `2209a05`, issue #170 et ses commentaires, PR #617
fermée/remplacée par #618 puis #619 ; #619 et #620 encore en cours lors de
l'inspection du 4 novembre 2026. #170 évoquait historiquement Capacitor et OTP ;
la mission actuelle privilégie TWA et le code prend en charge Google et
email/mot de passe. Les anciennes mentions « aucun projet Android » dans les
dossiers de préparation décrivent leur lot historique, antérieur à ce projet.

La TWA est adaptée : le navigateur compatible fournit le rendu et le stockage
de la même origine HTTPS, avec vérification Digital Asset Links. Aucune couche
JavaScript native, WebView personnalisée ou migration de sauvegarde ajoutée.
La PWA est en modules natifs ; `scripts/build-static.mjs` est un utilitaire de
publication web, sans rôle dans ce build Android. Le serveur reste la source
du jeu ; installer un ancien APK ne restaure pas une ancienne version web.

| Parcours | Choix et limites à vérifier sur appareil |
|---|---|
| Installation Play | AAB, Play App Signing et compte Console nécessaires ; build seul insuffisant |
| Google | OAuth web existant dans le navigateur ; aucun SDK Google Sign-In natif, donc pas de client OAuth Android ajouté par défaut. Vérifier retour HTTPS/PKCE, même navigateur/profil et même compte |
| Email/mot de passe | Formulaire web conservé ; tester confirmation/récupération depuis la messagerie et retour dans l'app |
| Défis et liens | HTTPS `lumen.nopuna.fr` autoVerify, chemin/query conservés par le lanceur ; partage via API Web Share existante selon navigateur |
| Notifications | Web Push reste géré par le navigateur, consentement web existant ; aucun service de délégation natif ni FCM. Attribution au navigateur possible. Recette réception/clic obligatoire avant toute promesse Store |
| Hors ligne | Dépend entièrement de la PWA, du cache et du stockage du navigateur ; première ouverture sans réseau non garantie. #597/#619 restent propriétaires |
| Retour/reprise | Historique navigateur, cycle de vie TWA ; tester clavier, Retour gestuel, fermeture forcée, écran verrouillé |
| Mises à jour | Jeu web via HTTPS/SW existant ; coquille via Play, versionCode croissant et certificat stable |

Une origine externe (Google/Auth) apparaît avec l'interface du navigateur ; ne
pas tenter de la déclarer comme domaine possédé. Sans DAL valide ou navigateur
TWA compatible, l'interface de repli peut afficher une barre d'adresse. Ce
comportement de sécurité ne doit pas être contourné. Le changement de navigateur,
profil ou l'effacement de ses données peut changer la session et le cache.
La désinstallation du wrapper ne prouve pas l'effacement des données web.
Portrait est demandé comme la PWA ; Android 16 peut ignorer ce choix sur grands
écrans. Tester tablettes, redimensionnement, encoches et Android récent.

Les icônes raster reprennent `icon.svg` (coins transparents), les icônes
adaptatives et le splash reprennent `icon-maskable.svg`, avec une variante
monochrome du symbole pour Android 13+. Les couleurs restent celles de la PWA.
Aucun contenu astronomique
ni catalogue modifié. La seule permission plateforme déclarée est INTERNET ;
AndroidX ajoute une permission interne par package
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, protégée par signature et vérifiée
dans le manifeste compilé. Ni publicité,
analytics natif, stockage, localisation, caméra ni paiement ajouté.

## Isolation et suites futures

Périmètre de ce lot : `android/**` et son workflow. Préserver `sw.js`, `src/**`,
`supabase/**`, les migrations, le catalogue, les textes juridiques et les tests
métier. Aucun changement de données, sauvegardes, tarifs ou onboarding.
Toute incompatibilité du jeu confirmée sur Android devient une issue liée à
#170 avec reproduction et propriétaire (#597 pour hors ligne, #316 pour droits,
#560/#391/#398 pour synchronisation). Ne pas corriger ces fonctions ici.

Sources techniques consultées le 4 novembre 2026 :
[TWA](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities),
[guide de démarrage/DAL](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start),
[Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper/releases/tag/android-browser-helper-2.7.3),
[compatibilité AGP 8.13](https://developer.android.com/build/releases/agp-8-13-0-release-notes).
