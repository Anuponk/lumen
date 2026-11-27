# Contrat de validation Android

Les assertions Node ne certifient ni le gameplay hors ligne ni OAuth réel.
La CI compile et inspecte le paquet ; un job distinct le lance sur émulateur
Google APIs 35 et conserve Logcat. Ce smoke ne valide ni TWA/DAL ni OAuth.
Il ne remplace pas un appareil physique.
La recette ci-dessous est **non exécutée** au moment de l'introduction du lot.
Ne pas fermer #170 avant les preuves ; conserver le statut To be tested.

Depuis le 5 novembre, dix tests Node couvrent aussi les dimensions exactes des
PNG et la reprise de l'étoile approuvée dans les deux vecteurs. Ils ont échoué
avec l'ancienne icône, puis passé après régénération depuis le SVG #625. La revue
locale du splash et des sources ne remplace pas le rendu du lanceur sur appareil.

## Automatisation dédiée

Pour #1034, le manifeste source et les manifests compilés APK/AAB doivent inclure
`POST_NOTIFICATIONS`, l'activité ABH `NotificationPermissionRequestActivity`
non exportée et l'icône du service existant. Installer un nouveau paquet Android
avant la recette : le web ne corrige pas le manifeste d'une ancienne installation.
Sur Android 13+, ouvrir Notifications depuis Mon espace, toucher Activer et vérifier
la demande système, le refus, l'accord puis le push de test. Aucune demande ne doit
apparaître au lancement seul. Sur Android 12 ou antérieur, vérifier aussi l'accord
et l'affichage délégué. Aucun de ces résultats physiques n'est déclaré acquis par
les tests Node ou l'émulateur de démarrage.

Depuis `android/` : `node --test tools/packaging.test.mjs`, puis
`./gradlew :app:lint :app:testDebugUnitTest :app:assembleDebug :app:bundleDebug :app:bundleRelease`.
Le workflow dédié vérifie les artefacts compilés avec
`python3 tools/verify-artifacts.py <bundletool.jar>` (JDK/SDK installés).
Le SHA-256 de bundletool est vérifié avant exécution. Le rapport décrit
explicitement `physicalDeviceTested: false` et `productionSigned: false`.
La CI vérifie aussi la signature avec une clé jetable et une transaction Play
simulée. Les tests refusent un AAB déjà signé, une empreinte incorrecte, une
piste interdite, une version dépassée et un commit après échec de validation.
La connexion réelle à Google et la piste fermée nécessitent la
[configuration de signature](SIGNING.md#générer-et-envoyer-un-aab-en-test-fermé-depuis-github).
Le contrôle des permissions du manifeste fusionné échoue si une dépendance
ajoute une permission : la déclarer et l'évaluer avant d'actualiser ce contrat.

| Contrôle | Preuve attendue |
|---|---|
| DAL générateur | Refus sans certificat, format SHA-256 strict, package exact et déduplication |
| Wrapper | SHA-256 officiel du JAR et somme de distribution épinglée |
| Configuration | HTTPS, host unique, INTERNET, provider par variante, SDK et versions figés |
| Identité visuelle | PNG des cinq densités, icône adaptative, splash bitmap |
| Secrets | Aucun keystore/clé privée dans les sources Android ; pas de secrets release dans le workflow |
| Gradle/lint | Build complet avec JDK 17 et API 36, lint bloquant |
| Artefacts | apksigner sur APK ; bundletool sur les deux AAB ; manifeste compilé, package/version/min/target/permissions/liens ; jarsigner sur AAB debug ; release CI non signée |

## Matrice physique à renseigner

Pour chaque passage conserver : SHA du wrapper, SHA/version web réellement
servie (build-info.json), nom/SHA-256 de l'artefact, package, empreinte du
certificat public, origine APK ou piste interne Play, appareil, OS, navigateur
et version, réseau, date, résultat et issue éventuelle. Utiliser des comptes
de test et ne jamais publier tokens, sauvegardes, identités ou captures privées.

Prévoir au minimum un appareil Android 13+ (permission notifications), un
Android 16/API 36 (Retour, edge-to-edge, reprise), un appareil au minimum pris
en charge si disponible et un grand écran. Comparer PWA et TWA avec le même
navigateur. Pour un échec, noter attendu/observé avant toute correction.

| Parcours | Action et résultat attendu | Résultat |
|---|---|---|
| Première installation | Installer debug APK puis, séparément, depuis piste interne Play ; bon nom/icône, ouverture sans crash | Non testé |
| Lancement icône | Splash nuit/lumière puis accueil HTTPS ; aucune barre après DAL valide | Non testé |
| Google | Se connecter, revenir depuis fournisseur externe ; même UID/compte/progression que PWA, aucune boucle | Non testé |
| Email/mot de passe | Connexion, confirmation email, récupération depuis messagerie ; clavier accessible, retour valide | Non testé |
| Auth externe | Navigateur → Auth → retour ; annuler puis réessayer ; liens de récupération sans perte de tentative | Non testé |
| Navigation jeu | Aventures → constellations → quête → ciel ; mêmes règles et sauvegarde qu'en PWA | Non testé |
| Retour Android | Clavier, écran jeu, menu, accueil ; bouton et geste, pas de double navigation ni sortie inattendue | Non testé |
| Fermer/rouvrir | Fermer puis forcer l'arrêt, relancer ; tentative/progression conservées, aucune restauration obsolète | Non testé |
| Arrière-plan | Verrouiller, changer d'app, attendre puis revenir ; rendu, session et reprise cohérents | Non testé |
| Partage défi | API partage vers app externe puis retour ; URL exacte et tentative conservée | Non testé |
| Liens profonds | Ouvrir un vrai lien défi depuis messagerie, app froide/chaude ; query intacte, bon défi, pas de progression campagne altérée | Non testé |
| Mise à jour | Installer versionCode N puis N+1 avec même signature ; mises à jour web et SW séparées, données conservées | Non testé |
| Mode avion | Préparer en ligne, ouvrir quête déjà visitée puis autre constellation, fermer/rouvrir sans réseau, revenir en ligne ; journaliser et transmettre à #597 | Non testé |
| Première ouverture sans réseau | Constater l'état de repli ; ne pas annoncer un jeu embarqué hors connexion | Non testé |
| Notifications | Accorder/refuser/révoquer le consentement ; recevoir/clic app ouverte, arrière-plan, fermée ; tester Android 13+ et attribution navigateur | Non testé |
| Repli navigateur | DAL absent/invalide, navigateur différent ; interface sécurisée visible, pas de contournement | Non testé |
| Grand écran | Rotation, redimensionnement, police agrandie et barres système ; pas d'élément essentiel masqué | Non testé |
| Compte/données | Vérifier le parcours de demande de suppression et ses limites selon #316 ; aucun effacement réel sans son autorisation propre | Non testé |

Pour les deep links :
`adb shell am start -W -a android.intent.action.VIEW -d '<URL HTTPS réelle de défi>' fr.nopuna.lumen.debug`.
Choisir un défi de test existant ; ne pas inventer de paramètre d'URL.
Tester aussi sans package explicite pour vérifier le routage Android réel.

## Recette du compte de revue Play (#796)

Utiliser un compte joueur dédié auquel l’opérateur a accordé le
[droit de revue](PLAY.md#accès-à-la-revue-google-play-796). Vérifier que les
droits d’Aventure nécessaires sont présents et que le compte ouvre seulement
les menus joueur habituels. La recette physique reste à effectuer.

- Depuis l'AAB de piste interne, ouvrir avec le compte de revue une première
  quête, une intermédiaire et une dernière dans chaque aventure autorisée.
  Vérifier l'aller-retour depuis Mon ciel et la reprise d'une vraie tentative.
- Comparer avant/après l'ouverture seule. Les victoires, records, badges,
  étoiles, achats et classements doivent rester identiques. Résoudre ensuite
  une quête de test et vérifier les récompenses normales de cette seule quête.
- Passer du compte revue au compte ordinaire puis revenir. Vérifier la
  séparation des tentatives et l’absence d’accès direct sur le compte ordinaire.
- Passer en mode avion depuis Mon ciel puis se reconnecter. Les nouveaux
  accès directs exigent une réponse du serveur, y compris sur un appareil
  neuf. Révoquer le droit côté serveur avec Mon ciel ouvert. La prochaine
  sélection exceptionnelle doit être refusée et les droits d’Aventure
  préexistants doivent être conservés.
- Transmettre dans Play Console les instructions et le compte via le champ
  privé prévu pour l'accès au contenu. La preuve publique ne contient que
  les révisions testées et le résultat par scénario.

En cas d'anomalie jeu, créer une issue liée à #170 et au chantier propriétaire
avec version et reproduction minimale. Pour hors ligne, ne pas modifier le
service worker ici. Aucun défaut runtime Android n'a encore été confirmé par
ce lot ; ne pas créer de faux tickets de bug à partir d'une simple hypothèse.

## Recette Google Play #845

`UpdatePolicyTest` couvre l’éligibilité de l’offre, le minimum explicite,
l’absence de blocage sans cible, la reprise immédiate, le téléchargement prêt
et les reports/refus par version. Le smoke de la CI lance l’alias historique
sur la variante debug. Exécuter la matrice sur téléphone, avec une installation
Play conforme au [plan de publication](PLAY.md#mises-à-jour-natives-android-845).

| Cas | Action et résultat attendu | Résultat physique |
|---|---|---|
| À jour et éligibilité | Démarrer à froid à jour, puis avec un compte Play sans accès au code supérieur. Aucune invitation dans les deux cas. | Non testé |
| Offre interne et fermée | Sur chaque piste, démarrer une installation #845 à froid avec un second code réellement proposé. La boîte française mène à la feuille Google Play. | Non testé |
| Reporter et refuser | Choisir « Plus tard », rouvrir avant/après 24 h. Annuler ensuite la feuille Play et rouvrir plusieurs fois. Le même code ne repropose rien après refus, un nouveau code peut être proposé. | Non testé |
| Téléchargement et reprise | Accepter le mode flexible, lancer une quête pendant le téléchargement, revenir via Récents. Pas de redémarrage. À la prochaine ouverture à froid après le téléchargement, toucher « Installer » et rouvrir. Même compte et même tentative. | Non testé |
| Version incompatible | Sur une piste de recette, rendre le code installé inférieur au minimum et proposer une cible compatible. Vérifier la feuille immédiate, annuler puis contrôler le repli fiche et l’absence de relance. Refaire en réussissant, puis vérifier le code installé et l’absence de blocage. | Non testé |
| Transition de piste et réseau | Tester mode avion, réseau absent, Play désactivé ou indisponible, puis une piste proposant un code inférieur au minimum. Aucun blocage sans offre compatible. Vérifier le lien de secours quand Play ne peut pas ouvrir le parcours intégré. | Non testé |
| Quête, paiement, synchronisation | Avec une offre disponible, reprendre via Récents et via l’icône pendant une quête, au retour de la feuille Billing et pendant la réconciliation. Vérifier qu’aucune feuille de mise à jour ne s’ouvre. Tester aussi un lien profond et un retour OAuth. | Non testé |
| Persistance et commerce | Créer une tentative invitée puis refaire avec un compte de recette et une commande durable hors ligne. Mettre à jour sur place sans effacer les données. Relancer et reconnecter, vérifier compte, progression et accusé de réception unique de la commande. Vérifier prix, achat de licence, liaison `obfuscatedAccountId` via le résultat vérifié côté serveur et restauration des droits, sans consigner l’identifiant. | Non testé |
| Web et autres canaux | Ouvrir le site dans Safari, Chrome Android et en PWA installée. Aucune invitation native. Vérifier une mise à jour web ordinaire sans changement de versionCode Android. | Non testé |
