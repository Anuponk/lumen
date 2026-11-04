# Contrat de validation Android

Les assertions Node ne certifient ni le gameplay hors ligne ni OAuth réel.
La CI compile et inspecte le paquet, sans émulateur ni appareil physique.
La recette ci-dessous est **non exécutée** au moment de l'introduction du lot.
Ne pas fermer #170 avant les preuves ; conserver le statut To be tested.

## Automatisation dédiée

Depuis `android/` : `node --test tools/packaging.test.mjs`, puis
`./gradlew :app:lint :app:assembleDebug :app:bundleDebug :app:bundleRelease`.
Le workflow dédié vérifie les artefacts compilés avec
`python3 tools/verify-artifacts.py <bundletool.jar>` (JDK/SDK installés).
Le SHA-256 de bundletool est vérifié avant exécution. Le rapport décrit
explicitement `physicalDeviceTested: false` et `productionSigned: false`.
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

En cas d'anomalie jeu, créer une issue liée à #170 et au chantier propriétaire
avec version et reproduction minimale. Pour hors ligne, ne pas modifier le
service worker ici. Aucun défaut runtime Android n'a encore été confirmé par
ce lot ; ne pas créer de faux tickets de bug à partir d'une simple hypothèse.
