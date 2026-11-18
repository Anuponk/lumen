# Dossier de publication Google Play — Lumen

Préparation du 4 novembre 2026. Aucun upload, aucune fiche publiée ni conformité
juridique acquise. Le packaging peut être testé avant la finalisation du dossier ;
la diffusion Play exige ses propres validations. Ce document complète les
dossiers existants [préparation Play](../docs/PLAY_STORE_READINESS.md),
[fiche](../docs/PLAY_STORE_LISTING_DRAFT.md),
[Data Safety](../docs/PLAY_DATA_SAFETY_WORKSHEET.md) et
[clôture opérationnelle RGPD](../docs/RGPD_RELEASE_CHECKLIST.md).
Si un chemin juridique évolue, rechercher la checklist de #316 avant de
renseigner Console ; ne pas réinterpréter son état depuis une CI Android.

## Compte et configuration — propriétaire

- [ ] Créer/vérifier le compte développeur, identité professionnelle, coordonnées
  publiques et éventuelles obligations de vérification d'appareil/compte selon
  les demandes Console. Valider les accords et la situation du compte.
- [ ] Créer **Lumen**, langue française, type jeu, gratuit ; distribution initiale
  **France**, conformément au choix déjà documenté. Ne pas ouvrir d'autre pays.
- [ ] Vérifier l'ID publié **com.nopuna.lumen** (`release.properties`) ; premier
  versionCode **1**, versionName **1.0.0** (indépendants de la version PWA).
- [ ] Activer Play App Signing, protéger/sauvegarder la clé d'upload et relever
  le certificat de signature **de l'app** ; voir [SIGNING](SIGNING.md).
- [ ] Faire publier et vérifier DAL pour ce package/certificat, puis valider
  App Links et affichage TWA avec une installation issue de Play.
- [ ] Compiler un AAB release signé avec la vraie clé d'upload, contrôler
  signature/empreinte, package, version, SDK et bundletool ; conserver son SHA-256.
- [ ] Examiner App Bundle Explorer, rapport pré-lancement et appareils exclus.
  API cible **36**, minimum **24** dans ce projet. Pas de bibliothèque native
  `.so` dans le contrat CI ; refaire le contrôle 16 Ko si une dépendance native
  est introduite. Aucun motif d'exemption supposé pour un futur SDK.

## Contenu, droits et données — validation indispensable

- [ ] Catégorie proposée : **Jeux de réflexion / Puzzle** ; sélectionner la
  catégorie réellement disponible dans Console et répondre au questionnaire
  IARC. Ne pas attribuer soi-même une classification PEGI.
- [ ] Répondre sur publicité (première version sans publicité), accès à l'app,
  contenu, monétisation et permissions. Si la revue exige un accès connecté,
  fournir au canal privé Console un compte de test et des instructions valides.
- [ ] Public familial/accessibilité : intention éditoriale, pas une certification.
  Choisir les tranches d'âge exactes et vérifier les règles Families. Ne pas
  activer/annoncer de comptes enfants : la décision parentale reste à valider.
- [ ] Permission plateforme : **INTERNET**. AndroidX ajoute la permission interne
  `${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` protégée par
  signature. Depuis #729, la bibliothèque de paiement ajoute **com.android.vending.BILLING** et **ACCESS_NETWORK_STATE**. Le contrat CI vérifie cet ensemble exact et refuse tout autre ajout. Le navigateur conserve
  les permissions Web Push ; aucune permission native POST_NOTIFICATIONS ni
  service FCM ajouté. Ne pas affirmer leur fonctionnement avant la recette.
- [ ] Inventorier les flux de la **version web servie au moment de la revue**
  et du wrapper, pas seulement le ZIP AAB. Reprendre la feuille Data Safety :
  identité/email/UID/pseudo, progression/interactions, défis/push, feedback,
  diagnostics et fournisseurs, selon fonctions réellement actives.
- [ ] Qualifier collecte/partage/finalités, données facultatives, conservation,
  transferts et sécurité. Ne pas cocher « aucune collecte » ni promettre de
  chiffrement de bout en bout. Le transport HTTPS n'établit pas toute la conformité.
- [ ] Finaliser/valider la politique et vérifier l'accès public sans login à
  `https://lumen.nopuna.fr/confidentialite.html` ; associer la même URL dans
  Console. La présence d'une page ne vaut pas validation juridique.
- [ ] Vérifier le lien interne et la page externe
  `https://lumen.nopuna.fr/supprimer-compte.html`, puis le traitement complet
  d'une demande sur compte de test suivant #316 (fournisseurs et copies compris).
  Ne pas présenter une demande mail comme preuve d'effacement effectif.
- [ ] Valider support/publication avec l'éditeur : adresse documentée
  `valente.cedric@gmail.com`, site `https://lumen.nopuna.fr/`, identité Nopuna.
  Vérifier mentions légales et coordonnées applicables avant saisie publique.

## Textes proposés (à relire sur le paquet final)

Nom : **Lumen** (limite Console : 30 caractères).

Description courte (70 caractères ; maximum 80) :

> Des grilles de logique pour éclairer les constellations, à ton rythme.

Description longue (maximum Console 4 000 caractères) :

> Retrouve les étoiles et rallume les constellations dans Lumen, un jeu de
> logique au cœur d'un ciel nocturne.
>
> Observe la grille et place les Gardiens : un par ligne, par colonne et par
> territoire. Deux Gardiens ne doivent jamais se toucher, même en diagonale.
> Croise les indices et avance par déduction pour révéler la solution.
>
> Les premières quêtes accompagnent la découverte des règles. Explore les
> constellations, progresse à ton rythme et rejoue les quêtes pour améliorer
> tes performances. Des aides permettent de mieux comprendre une grille
> lorsque tu en as besoin.
>
> Avec son univers de lumière et ses règles accessibles, Lumen invite à
> prendre le temps de réfléchir, seul ou en famille.
>
> Découvre gratuitement les 100 premières quêtes de Lumen, sans publicité.

La dernière phrase reprend les 100 quêtes gratuites de l'Aventure 1 décidées
le 4 novembre (#170). Le modèle actuel (#725) propose les aventures 2 à 9 à
1,00 € TTC chacune et « Tout le vrai ciel » à 5,00 € TTC, prix cibles France.
Après un achat unitaire, l'offre globale est masquée ; le plafond serveur de
5 € reste applicable. Les tarifs affichés dans la TWA proviennent de Google Play.
Les droits acquis des joueurs restent protégés.
Avant soumission, accorder la fiche aux fonctions réellement actives et au prix
localisé fourni par le canal de paiement. Play Billing, droits serveur et
restauration sandbox restent à valider dans leur chantier séparé ; ne pas
implémenter de paiement dans le wrapper. Aucun hors ligne garanti, compte enfant,
promesse de confidentialité ou réception push native annoncé.

## Visuels à produire à partir d'une vraie installation

| Élément | Format/résolution | Contenu attendu / état |
|---|---|---|
| Icône fiche Play | PNG 32 bits, 512 × 512, maximum 1 Mo | Fourni (#755) : `android/store/play-icon-512.png`, rendu depuis `icon-maskable.svg` par `android/tools/render-icons.mjs` |
| Feature graphic | PNG/JPEG, 1024 × 500 | Ciel nocturne et lumière progressive ; composition finale à fournir |
| Téléphone | Au moins 2 captures réelles, JPEG/PNG 24 bits, 320–3840 px par côté, grand côté ≤ 2× petit côté | Prévoir 4–6 captures 1080 × 1920 : accueil/ciel, apprentissage, déduction, constellation révélée, progression, défi si validé |
| Tablettes si distribuées | Captures des formats 7 et 10 pouces demandés par Console ; préparer des rendus réels | Lisibilité grands écrans et orientation ; ne pas agrandir une capture téléphone artificiellement |
| Vidéo | Facultative, URL YouTube conforme | Aucun besoin de vidéo pour cette première préparation |

Conserver les couleurs et symboles existants. Masquer les données personnelles
dans les comptes de test et éviter les captures qui annoncent un état non livré.
Ne pas utiliser une maquette PWA comme preuve Android. Le dossier fournit les
icônes launcher et splash, pas de fausses captures Store.

## Tests internes, fermés et étapes d'envoi

- [ ] Créer une liste de testeurs internes (jusqu'à 100), préparer notes de
  version et lien d'inscription ; un test interne n'est pas une publication
  publique. L'upload et le lancement de piste restent à effectuer par le propriétaire.
- [ ] Installer depuis la piste interne et compléter [TESTING](TESTING.md),
  avec vrai certificat Play, liens, OAuth, reprise, mode avion et notifications.
- [ ] Pour les comptes personnels concernés créés après le 13 novembre 2023 :
  prévoir au moins **12 testeurs inscrits continûment pendant 14 jours** à un
  **test fermé**, puis demander l'accès production ; le test interne ne compte
  pas comme remplacement. Confirmer la règle applicable à ce compte dans Console.
- [ ] Corriger les défauts confirmés dans leurs chantiers respectifs ; rapprocher
  les déclarations du wrapper ET de la version web effectivement servie.
- [ ] Conserver le rapport de recette et les validations juridiques/Families.
  Aucun passage en production sans autorisation explicite distincte.

## Sources officielles à recontrôler au moment de l'upload

Consultées le 4 novembre 2026 :
[API cible](https://developer.android.com/google/play/requirements/target-sdk),
[exigences API Play](https://support.google.com/googleplay/android-developer/answer/11926878),
[16 Ko](https://developer.android.com/guide/practices/page-sizes),
[tests des comptes personnels](https://support.google.com/googleplay/android-developer/answer/14151465),
[visuels](https://support.google.com/googleplay/android-developer/answer/9866151),
[Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469),
[suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111),
[Families](https://support.google.com/googleplay/android-developer/answer/9893335).

La documentation API consultée indique API 36 pour les nouvelles soumissions ;
les échéances et rubriques Console évoluent. Ce dossier ne prétend pas avoir
inspecté le compte développeur ni validé ses déclarations administratives.

## Achats intégrés Google Play (#729) — propriétaire

L'app reste « gratuite » avec achats intégrés. La bibliothèque `billing` ajoute l'autorisation `com.android.vending.BILLING` au manifeste fusionné.
- [ ] Créer le **profil marchand** (Payments) dans la Play Console.
- [ ] Créer 9 **produits intégrés** (achat unique, non consommables), avec exactement ces identifiants Google Play (les IDs internes du catalogue restent avec des tirets) : `real_adventure_02` … `real_adventure_09` à **1,00 €** TTC, et `real_sky_all` à **5,00 €** TTC. Prix pour la France.
- [ ] Créer un **compte de service** Google Cloud avec l'API Google Play Android Developer, puis l'inviter dans la Play Console avec le droit « Afficher les données financières et gérer les commandes ». Stocker sa clé JSON uniquement comme secret Supabase `LUMEN_PLAY_SERVICE_ACCOUNT`, avec `LUMEN_PLAY_PACKAGE=com.nopuna.lumen` et un `LUMEN_PLAY_CRON_SECRET` aléatoire. Ne jamais la committer.
- [ ] Déployer l'Edge Function `lumen-play-purchase` et appliquer la migration `20261115220000_play_purchase_gateway_729.sql`.
- [ ] Planifier l'appel quotidien du mode `voided` (remboursements), avec l'en-tête `x-lumen-cron`.
- [ ] Ajouter des **testeurs de licence**, publier un AAB sur la piste de test interne, puis faire un vrai achat de test : déblocage, restauration après réinstallation, et retrait après remboursement de test.
- [ ] Data safety : déclarer l'historique d'achats (achats intégrés) ; voir #732 pour la confidentialité.

## Diagnostic « Prix indisponible » — P1 #729 / #731 / #786 (18/11/2026)

Base inspectée : `5c6e076b3d10a6771b5bb94cd5d59df0309ba0c0` (clone neuf).
Aucun accès à Play Console, aucun appareil Play, aucune transaction pendant ce
diagnostic. La cause de l'échec sur le téléphone reste à identifier avec les
raisons ci-dessous ; les défauts de code reproduits ne prouvent pas une mauvaise
configuration des produits chez Google.

Contrôle HTTP public en lecture seule le 18/11/2026 : le module
`https://lumen.nopuna.fr/src/persistence/play-billing.js` répond 200 et contient
déjà `toPlayProductId`, mais pas le nouveau loader. SHA-256 de ce module servi :
`1eb8e4daebf4f2aa88d6ffa98627560447bc9b6870ebd4e64034d63eb2e69076`.
Cela ne prouve pas la version exécutée/cache du téléphone, ni la disponibilité des SKU.

### Parcours et preuves du dépôt

1. `rememberPlayAppLaunch` / `isPlayDistributedApp` reconnaissent le referrer
   `android-app://`, le marqueur de session ou `LUMEN_NATIVE_APP`. La seule présence
   de l'API dans Chrome Android ne suffit pas : hors TWA, son appel peut échouer.
2. `getPlayBilling` demande `https://play.google.com/billing` et exige Payment Request.
   Un service effectivement obtenu confirme également le contexte Play pour les retries.
3. `game-screen.js` sélectionne les packs verrouillés du catalogue et le produit ciel.
   `toPlayProductId` traduit les IDs internes avec tirets en SKU Play avec underscores
   (correctif déjà présent dans #799). Ne pas recréer des SKU avec tirets.
4. `getDetails()` fournit des lignes associées par `itemId`, jamais par position.
   Le loader conserve des prix par ID interne pour le modèle d'offre.
5. `playPrices` valide montant décimal positif fini et devise ISO reconnue, puis
   utilise la langue du navigateur et la devise renvoyée. Une autre devise valide
   est affichée telle quelle ; vérifier la France dans Console si EUR était attendu.
6. `adventureOfferModel` impose les tarifs fournisseur dès que le contexte Play
   est connu, même si le service échoue. Aucun prix catalogue de substitution.
7. `mountAdventureOffer` désactive chaque CTA sans contenu livré, fournisseur ou
   prix valide. Le chargement est explicite ; une erreur propose « Réessayer ».
8. `purchaseAdventure` revérifie le prix et ouvre Payment Request uniquement après
   connexion et consentement. L'annulation reste silencieuse ; une erreur technique
   affiche une indisponibilité. Aucun repli Stripe dans le contexte Play.
9. Après une réponse d'achat seulement, `playVerify` transmet le jeton au serveur
   `lumen-play-purchase` ; les droits sont relus après sa confirmation. Le chargement
   des prix ne vérifie aucun achat et n'attribue aucun droit. La restauration après
   hydratation reste un flux distinct, soumis à la vérification serveur.

**Condition exacte de l'ancien libellé :** `pricesRequired === true` et absence
de `prices[pack.id]` (ou du produit ciel). `pricesRequired` dépendait uniquement
de la présence du service ; une exception, une réponse vide ou un SKU absent
donnaient tous la même carte sans raison technique. Le chargement lancé une seule
fois ne rafraîchissait pas la carte déjà montée et ne proposait aucun retry.
Une valeur `bad` était en outre acceptée comme `NaN €` : échec reproduit par le
test avant correction, puis test passant. Les mocks vérifient désormais le
rafraîchissement du vrai rendu de l'offre après réponse retardée et retry.

Diagnostic local : console distante Chrome, filtre **[Lumen Play billing]**.
Champs autorisés : `reason`, éventuellement `productId` (SKU public demandé).
La carte expose également `data-play-price-reason`. Aucun jeton, message brut
du fournisseur, compte joueur ou secret n'est journalisé.

| Raison | Signification et vérification suivante |
|---|---|
| `service_unavailable` | API absente, service refusé/nul ou délai de 12 s dépassé ; vérifier vrai lancement TWA, Chrome, connexion, DAL et installation Play |
| `payment_unsupported` | Payment Request absent, construction/probe échoué, `canMakePayment()` faux ou erreur d'ouverture ; vérifier Chrome et fournisseur du wrapper |
| `details_request_failed` | `getDetails` échoue, dépasse 12 s ou renvoie une structure invalide ; vérifier réseau, liaison de délégation et configuration Play |
| `product_not_found` | SKU demandé absent, y compris réponse vide ; ne prouve pas à lui seul que le produit est inactif : vérifier ID, disponibilité, région et option compatible |
| `product_not_available` | Le fournisseur marque explicitement le produit indisponible ; vérifier disponibilité Console (l'API peut aussi simplement omettre un produit) |
| `price_parse_failed` | Montant/devise invalide ou lignes dupliquées ; relever seulement le SKU et la raison, puis contrôler les données fournisseur |

### Checklist propriétaire — éléments externes non vérifiés

- [ ] **Compte marchand** : au niveau développeur, Paramètres → Profil de paiement
  (ou « Payments profile ») ; vérifier profil marchand lié, état du compte et
  éventuelles demandes administratives. Ne pas confondre avec l'accès à une piste.
- [ ] **Application et package** : ouvrir Lumen et relever le package dans Console /
  App Bundle Explorer. Le dépôt publie `com.nopuna.lumen`. `fr.nopuna.lumen` est
  le namespace Java et l'ancien candidat, pas l'applicationId release actuel.
  Comparer à `adb shell pm list packages` et à `LUMEN_PLAY_PACKAGE` côté serveur.
  Ne pas changer l'identité d'une application déjà publiée pour corriger les prix.
- [ ] **Produits** : Lumen → Monétiser avec Play → Produits → Produits ponctuels
  (« Produits intégrés » sur l'ancienne interface). Vérifier les neuf IDs exacts :
  `real_adventure_02`, `real_adventure_03`, `real_adventure_04`, `real_adventure_05`,
  `real_adventure_06`, `real_adventure_07`, `real_adventure_08`, `real_adventure_09`,
  `real_sky_all`. Achat définitif, non consommable ; aucun abonnement.
- [ ] **Activation et France** : ouvrir chaque produit et son option d'achat « Buy » ;
  vérifier état actif et disponibilité France du produit, de l'option ET de l'app.
  Dans Disponibilité et prix, relever **1,00 EUR TTC** par aventure et **5,00 EUR TTC**
  pour le ciel. Enregistrer/publier les changements. Si l'interface propose plusieurs
  options, vérifier une option d'achat compatible avec les anciens clients Billing
  (« backwards compatible »), sans supposer qu'une offre récente est visible du pont TWA.
- [ ] **Piste** : Tester et publier → Tests → Test interne (ou piste fermée retenue).
  Vérifier release disponible, versionCode et compte inscrit via le lien d'adhésion ;
  installer depuis Google Play avec ce compte, sans remplacer par un APK debug/sideload.
- [ ] **Licence** : au niveau développeur, Paramètres → Test de licence ; ajouter
  le compte Google utilisé sur le téléphone et enregistrer. L'inscription à la piste
  ne vaut pas inscription au test de licence. Cette recette n'autorise aucune transaction.
- [ ] **Signature** : Tester et publier → Configuration → Intégrité de l'application
  → Play App Signing. Comparer le SHA-256 du certificat de signature de l'app (pas
  la clé d'upload) au package correspondant dans
  `https://lumen.nopuna.fr/.well-known/assetlinks.json`. Vérifier TWA sans barre Chrome
  après installation Play et navigateur hôte compatible Digital Goods.
- [ ] **Serveur avant toute transaction ultérieure** : vérifier déploiement de
  `lumen-play-purchase`, secrets correctement configurés, API Developer et permissions
  du compte de service, droits du catalogue et gestion des remboursements (#728/#729).
  Leur présence en production n'a pas été contrôlée ici ; l'ancien audit de #729
  signalait une activation suspendue. Les prix peuvent s'afficher sans ce déploiement,
  mais cela ne démontre pas qu'une transaction peut être confirmée.

### Android, tests et mode de livraison

Présent dans le dépôt : ABH **2.7.3**, extension ABH Billing **1.2.0**, délégation
Digital Goods et composants PaymentActivity/PaymentService. Le
[POM publié de Billing 1.2.0](https://dl.google.com/dl/android/maven2/com/google/androidbrowserhelper/billing/1.2.0/billing-1.2.0.pom)
lu le 18/11/2026 déclare BillingClient **8.3.0**, AndroidX Browser **1.10.0** et
ABH **2.2.2** (le projet demande explicitement 2.7.3). Ce sont les dépendances
publiées, pas une preuve du graphe résolu de l'AAB installé. En environnement SDK,
contrôler `gradlew :app:dependencies --configuration releaseRuntimeClasspath` et
le manifeste fusionné ; aucun build Gradle/AAB n'a été exécuté pendant ce correctif.

Confirmé par tests synthétiques : neuf prix, ordre différent, réponse partielle/vide,
exception, formats invalides, service initialement absent, délai, retry, mise à jour
de la carte, CTA, exclusion Stripe et absence de droits accordés par les tarifs.
`node scripts/play-billing-tests.mjs`, `node scripts/adventure-offer-tests.mjs`
et `node android/tools/packaging.test.mjs` vérifient le code et les contrats source ;
ils ne remplacent pas l'appareil ni Play Console.

**Nouveau AAB nécessaire : non pour ce correctif Web.** Publier le JavaScript sur
le site suffit si l'installation contient déjà les composants Billing ci-dessus.
Les corrections de prix/activation/testeurs se font dans Console sans AAB.
**Oui** si le paquet installé n'inclut pas Billing/délégation, ou si une modification
native devient nécessaire après diagnostic. Les signatures/packages réels de
l'installation ne sont pas établis par les seuls fichiers du dépôt.

### Recette courte sans paiement réel

1. Installer depuis la piste retenue, ouvrir depuis l'icône et se connecter avec un
   compte de recette. Relever versionCode, navigateur hôte et SHA Web déployé.
2. Ouvrir une aventure verrouillée pendant le chargement : prix en cours, CTA
   désactivé ; attendre les prix réels (France : 1,00 € / 5,00 € attendus). Vérifier
   les huit aventures, puis l'absence d'offre globale sur un compte déjà acheteur unitaire.
3. Couper le réseau, provoquer un échec puis le rétablir et toucher « Réessayer » :
   la même carte doit recevoir le prix et activer seulement les produits disponibles.
   Relever uniquement les raisons structurées si un produit manque.
4. Cocher le consentement, toucher le CTA et vérifier l'ouverture de la feuille
   Google Play avec bon produit/devise/montant, puis **annuler avant toute confirmation**.
   Si le fournisseur permet une transaction de licence gratuite, ne pas la valider
   dans cette recette : aucune transaction n'est demandée. Vérifier absence de nouveau droit.
5. Ouvrir le site dans Chrome Android hors TWA : aucun parcours Google Play imposé.
   Dans la TWA, aucun bouton Stripe. Vérifier les droits déjà acquis après reconnexion.

Conserver #729 et #786 ouvertes tant que leurs critères complets ne sont pas
recettés ; ce test d'annulation ne valide ni remboursement ni restauration d'un
achat neuf. #731 était déjà fermée au démarrage : signaler la régression et sa
recette, sans nouvelle clôture automatique. Les dépendances #728/#676/#725 et
#783 ne sont pas clôturables au seul titre de ce correctif.

Références officielles consultées le 18/11/2026 :
[TWA Billing et vérification serveur](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing),
[produits, options, activation et régions](https://support.google.com/googleplay/android-developer/answer/16430488),
[testeurs de licence](https://support.google.com/googleplay/android-developer/answer/6062777).
