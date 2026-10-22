# Préparation Google Play — #170 et #316

Audit du 22 octobre 2026, base `6dc1a09`. Ce dossier prépare la publication ;
il ne constitue ni une soumission Play Console ni une attestation de conformité.
Les modifications de cette branche ne sont pas encore déployées.

## Décisions confirmées par le propriétaire

- Éditeur : Nopuna, nom commercial de Cédric Valente EI.
- Première publication gratuite, sans publicité, achats ni abonnement.
- Public mixte comprenant des enfants : examiner les exigences Families.
- Compte enfant supervisé avec fonctions en ligne adaptées : voir la
  [préparation des comptes familiaux](FAMILY_ACCOUNTS_DESIGN.md), non implémentée.
- Activation des comptes enfants maintenue bloquée par décision du propriétaire,
  jusqu'au choix et à la validation de la méthode de vérification parentale.
  Le rapport expose explicitement `children.activationReview` ; cela ne modifie
  pas les inscriptions PWA en production et ne configure pas Play Console.
- Première distribution Google Play limitée à la France, confirmée par le
  propriétaire. Cette décision devra être reportée dans Play Console ; le
  manifeste local ne restreint pas à lui seul une distribution externe.
- Activité secondaire de développement ou d'édition de jeux déjà déclarée,
  selon confirmation du propriétaire ; justificatifs et détails d'immatriculation
  restent à rapprocher des mentions finales.
- Hébergement web : o2switch ; identité et progression : Supabase existant.
- TVA non facturée, selon déclaration du propriétaire ; aucun fondement fiscal
  précis ni numéro de TVA n'est déduit de cette réponse.
- Préparer le produit avant le packaging ; aucune conversion Android lancée.

Les coordonnées se trouvent dans `content/legal/publisher.json`. L'adresse et
le téléphone ont été communiqués directement par le propriétaire ; le détail
d'immatriculation reste à vérifier. Ne pas leur substituer des coordonnées
déduites d'une autre source.

Pages candidates désormais consultables dans la branche : `/mentions-legales.html`
et `/confidentialite.html`, liées depuis la PWA et `/supprimer-compte.html`.
Elles se chargent sans Auth/SDK et signalent explicitement leur état non validé.
Les informations de conservation/fournisseurs et d'immatriculation restent
à finaliser ; leur présence HTML ne valide ni les preuves légales ni Play.
Le [dossier fournisseurs](PRIVACY_PROCESSORS.md) identifie la messagerie Resend
déployée et les garanties/durées publiques, sans inventer les paramètres du compte.

Validation du complément HTML : `npm run test:full`, **30 suites, aucun échec**,
quality gate 130 contrôles / 340,95 s. Le navigateur lit les deux pages à 390 et
1440 px sans scripts/login, vérifie leur statut candidat, les liens de demande,
l'absence de débordement et une sauvegarde/tentative inchangée. Ce succès de
rendu ne finalise pas les rubriques juridiques encore signalées. La tête SQL
précédente `c9d4b34` a passé les cinq contrôles requis ; le contrôle de contrat
cloud avait échoué sur les intitulés traduits de la description PR, corrigés
puis vérifiés par une exécution verte sans affaiblir le contrôle.

## État vérifié et prochaines preuves

Complément conservation : mécanisme opérateur technique préparé, non activé,
avec dates serveur et protection des preuves historiques. Procédure dans
[TECHNICAL_RETENTION_RUNBOOK](TECHNICAL_RETENTION_RUNBOOK.md). L'éditeur confirme
Resend Free et une offre o2switch payante de base ; le nom exact et les réglages
de cette dernière restent non vérifiés. [Recommandations logs et copies](PRIVACY_LOGS_AND_BACKUPS.md).

Finalisation PWA du 22 octobre : export opérateur d'accès/portabilité préparé
dans une seconde migration privée, avec [procédure](ACCOUNT_RIGHTS_RUNBOOK.md).
La [proposition de conservation](PRIVACY_RETENTION_PROPOSAL.md) distingue les
délais envisagés de la seule rétention outbox déjà livrée. Aucun de ces ajouts
ne vaut autorisation de migration ou publication. La PR reste en brouillon
selon la décision de l'éditeur. Les comptes enfants, la conversion Android et
la publication Play restent exclus de cette livraison.

Restent avant validation finale des pages PWA : adoption et mise en œuvre des
critères de conservation ; vérification des offres/réglages/contrats réellement
applicables aux fournisseurs ; mention d'immatriculation et traitement fiscal
exactement applicables à cette activité ; recette opérateur après autorisation
de migration. « Pas de TVA » est enregistré comme déclaration de l'éditeur,
sans inventer un article fiscal. Les preuves natives/Families/Console restent
des étapes futures, distinctes de ces points PWA.

| Domaine | Existant / réalisé dans cette branche | Critère encore ouvert |
|---|---|---|
| Identité | Google et email/mot de passe avec récupération ; même identité Supabase et mêmes contrats de progression | Credentials Android, retour OAuth/deep link, renouvellement et même compte sur PWA/appareil Android |
| Ancien texte de #170 | L'OTP de connexion a été retiré avant ce chantier | Actualiser le périmètre, conserver confirmation/récupération ; ne pas réintroduire l'OTP pour suivre un ancien libellé |
| Compte invité | Progression locale et mécanismes existants de transfert conservés | Recette sur futur conteneur et compte existant, sans doublon ni perte |
| Suppression | Page externe et lien dans l'app ; migration privée d'effacement Lumen, conservation Auth partagée, anonymisation sociale et barrière contre les anciennes copies | Autorisation/application production, fournisseurs/backups, traitement des appareils et recette complète ; voir runbook |
| Vie privée | Audit des données et blocage par défaut des analytics optionnels ; aucune autorisation analytics fournie en production | Pages juridiques finalisées, durées et transferts documentés, traitement des anciennes données |
| Enfants | Aucun SDK publicitaire/achat ajouté ; collecte optionnelle bloquée | Évaluation des SDK/Auth, accompagnement parental, défis/pseudos/feedback/notifications, tranches d'âge effectivement adaptées |
| Monétisation | Modèle gratuit arrêté pour cette première version | Réexaminer avant tout futur achat/publicité ; aucune intégration Billing ni CGV de vente inventée ici |
| Notifications | Web Push et consentement existants dans la PWA | Choisir adaptateur natif/FCM si nécessaire, permission Android, opt-out, réception et deep links dans tous les états |
| Scripts navigateur | Supabase JS 2.118.0 et QRCode JS 1.0.0 embarqués localement, versions/hashes/licences inventoriés | Validation SDK/enfants et inventaire réseau du paquet final ; les flux fonctionnels Supabase restent présents |
| Distribution | Aucun projet Android, AAB, signature ni Play Console créé | ID stable validé, AAB signé, clés protégées, tests internes/fermés et déclarations Console |

## Stratégie de conteneur à valider

Capacitor reste un candidat à étudier, conformément à #170. Ne pas ajouter
maintenant un WebView qui se contente de charger le site distant : le gameplay
et ses ressources devraient pouvoir être empaquetés et testés indépendamment
du serveur de pages, avec API Auth/progression existantes.

Avant adoption, produire une décision d'architecture avec preuve sur appareil :
compatibilité des modules ES, fonctionnement du stockage sous l'origine native,
OAuth et URL de retour, bouton Retour, partage, notifications et reprise.
Isoler les dépendances de plateforme à leurs frontières existantes ; les
refactorings généraux restent dans #468. Ne pas réécrire le moteur de jeu.

L'application ID n'est pas choisi automatiquement à partir du domaine : vérifier
sa propriété et son caractère durable. Enregistrer les empreintes de signature
et les redirects autorisés sans placer de clé privée dans le dépôt. Distinguer
versionCode Android, versionName, SHA de code et version du contenu.

Au 22 octobre, la documentation Android indique API cible **36 / Android 16**
pour une nouvelle application mobile. Recontrôler l'exigence à la soumission.
L'app native doit avoir son propre mécanisme de mise à jour : ne pas supposer
que le service worker PWA remplace les mises à jour Play ou certifie un AAB.

## Rapport de préparation et verrou de soumission

```sh
node scripts/play-readiness.mjs
node scripts/play-readiness.mjs --enforce
```

Le premier affiche les blocages. Le second termine avec un code non nul tant
qu'ils existent. Il doit devenir un prérequis de tout futur job de packaging/
publication Play ; aucun tel job n'est créé par ce chantier. Ce contrôle local
ne verrouille pas un compte Play Console externe.

Les entrées `evidence` exigent un statut vérifié, une référence et une date.
Les compléter seulement avec les résultats réels et leur candidat/version,
pas avec une intention ou une simulation présentée comme preuve terrain.
Le rapport reste délibérément bloqué aujourd'hui.

## Recette Android à produire lors du packaging

1. Installer l'AAB distribué par une piste interne et relever version/signature.
2. Tester Retour, clavier, focus, lecteur d'écran, portrait/rotation et tailles.
3. Créer/connecter le compte de test par chaque méthode prévue ; retrouver les
   mêmes acquis sur PWA et Android, sans déduire l'identité d'un simple email.
4. Reprendre après arrière-plan, fermeture forcée, expiration Auth et panne réseau.
5. Vérifier liens de défis, partage natif et notifications ouverte/arrière-plan/fermée.
6. Mettre à jour avec une tentative et une outbox en attente ; conserver les preuves.
7. Demander puis réaliser la suppression d'un compte isolé ; vérifier toutes les
   données concernées, l'autre application intacte et l'absence de résurrection.
8. Vérifier le parcours enfant/parent, le contenu partagé et les permissions.
9. Rapprocher le trafic réel de l'AAB des déclarations Data Safety et de la politique.

L'aperçu de [recette isolée](ISOLATED_VALIDATION_PREVIEW.md) apporte des preuves
UI/PWA et stockage avec RPC simulés. Il ne remplace pas cette recette native.

## Déclarations et fiche Store

Les [textes de fiche](PLAY_STORE_LISTING_DRAFT.md) et la
[feuille Sécurité des données](PLAY_DATA_SAFETY_WORKSHEET.md) sont préparés
pour reprise lors du packaging. Aucun champ Console n'est déclaré validé par
ces documents ; les preuves du paquet, fournisseurs et parcours restent requises.

Préparer nom Lumen et éditeur Nopuna, descriptions, captures réellement produites,
icône/splash adaptés, catégorie et questionnaire IARC. Ne pas attribuer une
classification d'âge sans questionnaire ; « enfants compris » n'implique pas
que chaque tranche d'âge convienne au jeu. Fournir les URLs publiques finales
de politique et de suppression ainsi que l'accès nécessaire aux réviseurs.

Les drafts juridiques et la matrice de données sont dans
[l'audit confidentialité](PRIVACY_AND_LEGAL_AUDIT.md). Les comptes, contrats
fournisseurs, habilitations Play Console et vérifications d'activité EI restent
des preuves à obtenir, jamais des déclarations remplies automatiquement.

Sources officielles consultées le 22 octobre 2026 :

- [API cible Google Play](https://developer.android.com/google/play/requirements/target-sdk).
- [Exigences de suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111).
- [Règles de données utilisateur](https://support.google.com/googleplay/android-developer/answer/10144311).
- [Règles Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=fr).

## Validation locale du premier lot — 22 octobre 2026

`npm run test:full` : 30 suites, aucun échec, dont le quality gate complet.
Le navigateur vérifie le parcours de demande à 390 et 1440 px avec une
messagerie simulée : confirmation requise, URL préparée, sauvegarde et tentative
inchangées. Aucun email ni aucune suppression réelle ne sont exécutés.
Les tests analytics couvrent le refus par défaut, l'autorisation explicite,
la révocation et un fournisseur d'autorisation défaillant.

Le premier passage complet avait échoué dans le nouveau pilote de recette :
il attendait les diagnostics du jeu sur une page indépendante. Le pilote
attend maintenant le chargement et le formulaire de cette page. Le passage
complet suivant est vert ; les contrôles existants restent inchangés.

## Décision de clôture

Complément effacement du 22 octobre : migration opérateur Lumen privée,
barrière contre les anciennes copies, traitement social et procédure de
maintenance préparés. Le test échoue avant la migration ; les fixtures SQL
isolées passent ensuite sur PGlite 0.5.11 / PostgreSQL 18.6, y compris avec la
chaîne réelle de migrations et la RPC de sauvegarde. Le dernier
`npm run test:full` passe : **30 suites, 0 échec** (quality gate : 130 contrôles,
490,58 s). Une première tentative avait été empêchée par le bac à sable Windows
(`spawn EPERM`) ; le passage autorisé complet est vert, sans modification des
tests pour contourner ce problème. Les contrôles PostgreSQL 17/concurrence sont
ajoutés au job SQL : l'étape d'effacement et les concurrences canonical/legacy/
wallet passent dans le [run PostgreSQL 17](https://github.com/Anuponk/lumen/actions/runs/39814327058)
sur `1ed94d1`. Le complément TVA est une déclaration de configuration/documentation,
vérifiée par les tests de préparation ; la CI de sa tête finale reste à suivre.
Ni application de migration ni effacement réel n'a été exécuté en production.
Textes de fiche et matrice Data Safety sont préparés, sans déclaration Console.

La CI du complément a ensuite reproduit à 360x640 un panneau d'apprentissage
interceptant le bouton d'aide. La réservation géométrique du bouton ne suffisait
pas : sa remise en vue déplaçait l'en-tête et la grille de 54px, sans déplacer
le coach fixé au viewport. La trace locale reproduit ce cas ; l'ancrage compact
au conteneur de grille suit maintenant le défilement immédiatement. Un test rouge
puis vert couvre ce déplacement, sans modifier les contrôles de clic/focus.
Voir la [cause vérifiée](architecture/bug-history.md). Le choix ultérieur de
maintenir l'activation enfant bloquée est couvert indépendamment par les tests
du rapport, sans modifier Auth en production.

Après intégration de `main` (`d5d7484`) et du correctif, `npm run test:full`
sur le candidat `0325695` : **30 suites, aucun échec**, quality gate compris.
Le rapport UX navigateur ne contient ni échec ni exception ; les tests existants
de clic/focus du modal d'aide sont conservés. La vérification ciblée du rapport
confirme aussi le blocage enfant, indépendamment des autres preuves renseignées.

Validation finale de l'ancrage du coach après reproduction du défilement :
trois passages ciblés réussis sur des navigateurs neufs, puis
`npm run test:full` : **30 suites, aucun échec**, quality gate complet compris.
Les tests UX sont revenus exactement à leur version d'origine, sans traces
temporaires ni changement des assertions. Le test géométrique protège aussi
la remise en vue de l'en-tête sans attendre un nouveau frame.

Complément du 22 octobre : scripts SDK/QR embarqués, inventaire de versions,
hashes et copies MIT, suppression des chargements CDN dans la page d'entrée.
`npm run test:full` repassé : 30 suites, aucun échec. Le navigateur charge les
vrais bundles locaux et génère un QR fictif ; aucun appel Auth réel n'est réalisé
par cette vérification. Les tests du worker couvrent leur copie hors ligne.

Le premier passage de ce complément avait échoué dans le nouveau pilote
asynchrone (promesse non attendue) ainsi que sur la visibilité du focus clavier
du rail dans un contrôle existant. Le pilote attend maintenant explicitement
la promesse ; le contrôle clavier est inchangé et le passage complet suivant
est vert. L'inventaire SQL de suppression a aussi été exécuté sur les seules
métadonnées : 29 relations, 24 clés étrangères. Il ne réalise aucun effacement.

#170 et #316 restent ouvertes : une page de demande, un rapport de préparation
ou une CI verte ne prouvent ni une suppression complète ni la conformité de la
future version Android. La publication Play reste bloquée jusqu'aux preuves
ci-dessus et aux validations juridiques/professionnelles applicables.
