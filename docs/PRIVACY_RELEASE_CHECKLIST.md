# Reste à faire — confidentialité PWA et préparation Play

## Décision de fusion du 25 octobre 2026

Après la préparation technique et ses contrôles verts, l'éditeur autorise
explicitement la fusion de #526 (« ok pour merger »). Cette décision remplace
le maintien obligatoire en brouillon pour la **livraison technique**. Les pages
gardent leur statut visible de candidates ; la publication normale de main
n'atteste aucune validation juridique. Les anciennes conditions de brouillon
ci-dessous décrivent la décision antérieure.

Les validations juridiques, les trois migrations SQL, les purges, les suppressions
réelles, Auth partagée, les enfants et Google Play restent des étapes distinctes,
non autorisées par ce seul accord. #316 et #170 restent ouvertes.

**Actualisation P0 du 25 octobre :** lire d'abord
[le dossier comparatif](PRIVACY_P0_CONSOLIDATION.md). Les références de tests
du 22 octobre restent historiques. L'assistance est maintenant installée et
active selon les métadonnées lues ; aucune activation par ce chantier. Les
migrations #526, les textes finaux, la fusion et Play restent non autorisés.

État au **22 octobre 2026**, [PR #526](https://github.com/Anuponk/lumen/pull/526),
issues [#316](https://github.com/Anuponk/lumen/issues/316) et
[#170](https://github.com/Anuponk/lumen/issues/170).
Référence technique testée : `8a6ef78566ce377b97b9ee74a9606763ce1d7bd7`.
Cette checklist décrit le travail restant ; elle ne vaut ni validation juridique
ni autorisation d'agir en production.

## Décisions à conserver

- **PR en brouillon jusqu'à conformité complète** selon la décision de l'éditeur,
  reconfirmée après examen de la possibilité de fusion. Pas de fusion maintenant.
- Aucune application des trois migrations de cette PR, aucun déploiement,
  effacement/export de compte réel ou nouveau service payant autorisé ici.
  L'accord antérieur concernant #523 ne couvre pas #526.
- Périmètre en cours : PWA et prérequis Play réalisables. Compte enfant supervisé
  souhaité, mais activation bloquée jusqu'au choix d'une méthode parentale validée.
  **Ne pas lancer la conversion Android ni publier sur Play.**
- Cible future : France uniquement, gratuit, sans publicité ni achats.
- Les coordonnées et déclarations déjà fournies sont dans
  [publisher.json](../content/legal/publisher.json) : ne pas les redemander.
  L'éditeur ne dispose actuellement pas des détails d'immatriculation/rétention
  demandés ; obtenir les preuves par les sources ou espaces fournisseurs adaptés.

## Déjà préparé et testé — sans activation de production

- Pages juridiques HTML candidates, demande de suppression par email à envoyer,
  analytics facultatives bloquées par défaut, SDK locaux et inventaire de licences.
- Effacement privé limité à Lumen, Auth partagée/autres applications préservées,
  protection anti-résurrection ; export opérateur d'accès/portabilité borné.
- Conservation technique bornée : liste explicite de statistiques anciennes,
  retours clôturés hors conservation motivée, abonnements push désactivés.
- **30 suites locales sans échec** et **cinq contrôles requis GitHub verts** sur
  la référence technique ci-dessus, PostgreSQL 17/concurrences compris. Ce sont
  des preuves de code et de fixtures, pas une recette de compte réel/fournisseur.
- La rétention outbox résolue à 30 jours a déjà été livrée par le chantier
  précédent ; les nouveaux mécanismes de cette PR ne sont pas actifs.

## A. Compléter la PWA avant de demander sa livraison

Chaque ligne se clôt avec une preuve datée et un résultat, pas seulement un
document rédigé. Les justificatifs privés, exports et secrets restent hors du dépôt.

| ID | Travail restant | Responsable | Preuve de clôture attendue |
|---|---|---|---|
| PWA-01 | Vérifier la mention d'immatriculation applicable à l'EI et à l'activité déclarée. Utiliser Annuaire des entreprises/INPI ou le justificatif de formalité ; ne pas inventer une ville RCS. L'attestation INPI n'a pas pu être récupérée automatiquement (HTTP 403). | Éditeur, avec recherche documentaire | Source officielle datée et formulation exacte dans le manifeste et les mentions. L'activité secondaire est déjà confirmée par l'éditeur ; distinguer cette déclaration du justificatif. |
| PWA-02 | Finaliser les mentions conditionnelles applicables et le directeur de publication. « Pas de TVA » signifie ici que l'éditeur déclare ne pas en facturer : ne pas déduire un article fiscal, une franchise ou un numéro absent. | Éditeur | Texte final cohérent avec son statut réel ; pas de fausse référence CGI ou de coordonnée remplacée par une déduction. |
| PWA-03 | Rapprocher les contrats, destinataires et réglages réellement applicables à Supabase, Resend et o2switch. Vérifier suivi d'ouverture/clics, logs, copies, accès support et traitement d'une demande individuelle. | Éditeur/opérateur des comptes | Relevé daté des offres, options et références contractuelles ; preuve privée si nécessaire. Ne pas publier d'identifiant de connexion. |
| PWA-04 | Adopter les critères de conservation proposés, leurs exceptions et leur procédure de revue. Qualifier séparément statistiques techniques, preuves historiques de jeu, diagnostics de sécurité, dossiers ouverts et acquittements. | Éditeur, puis implémentation/recette | Décision datée et correspondance exacte entre politique, mécanismes et tests ; aucune promesse de purge générale des analytics ou des reçus. |
| PWA-05 | Préparer la destination de sauvegarde, le chiffrement, la rotation et une restauration cohérente. Préserver les effacements et la barrière la plus récente avant de rouvrir une copie ancienne. | Opérateur | Recette sur données fictives, accès privé, vérification progression/reçus/solde et non-résurrection ; destination et fréquence établies sans nouveau service payant non autorisé. |
| PWA-06 | Finaliser les pages de mentions/confidentialité, bases/finalités, durées, transferts, droits et limites des copies/appareils. Compléter la revue des actifs et crédits réellement distribués. | Éditeur + développement | Pages cohérentes avec le service prévu et les preuves acquises ; licences/attributions conservées. Adapter les tests au statut final approuvé, sans retirer prématurément les avertissements candidats. |
| PWA-07 | Préparer la recette opérateur complète d'accès et de suppression avec compte fictif dédié, y compris fournisseurs et copies. Les fixtures SQL ne suffisent pas pour valider une chaîne de production. | Développement/opérateur | Scénario et critères prêts avant autorisation ; exécution après autorisation selon la phase B, sans utiliser ni effacer de compte réel. |

### Offres et durées : acquis, recommandations, inconnues

| Élément | État à conserver |
|---|---|
| Resend | **Free confirmé par l'éditeur**. Documentation fournisseur : emails/logs 30 jours, backups 7 jours. Réglages spécifiques du compte encore non contrôlés ; aucune rotation configurée par la PR. |
| o2switch | Offre **payante de base déclarée**, nom exact non confirmé. Grow annonce 30 jours de sauvegardes, mais cela ne prouve pas que le contrat est Grow. Lire contrat/espace client et archives effectivement disponibles. |
| Supabase | Offre **Free** et région européenne vérifiées en lecture seule. Ne pas promettre les backups/restaurations gérés des offres payantes. |
| Logs maîtrisés par Nopuna | Proposition : dépannage 14 jours ; sécurité/administration 6 mois, données minimales et accès restreint. Ces deux finalités ne suivent pas une même purge globale. |
| Copies maîtrisées par Nopuna | Proposition : 14 générations quotidiennes chiffrées et test mensuel. Ne pas confondre ces copies avec les cycles fournisseurs ni l'export d'accès/portabilité. |
| Conservation applicative candidate | Statistiques techniques sélectionnées 90 jours ; retours **closed depuis 180 jours**, hors conservation motivée ; push **désactivés depuis 90 jours**. Dates serveur préparées ; aucun nouveau cron installé. |

Détails et références : [fournisseurs](PRIVACY_PROCESSORS.md),
[politique proposée](PRIVACY_RETENTION_PROPOSAL.md),
[logs et sauvegardes](PRIVACY_LOGS_AND_BACKUPS.md).
La recommandation d'une durée ne prouve ni son adoption ni son application.

## B. Conditions de fusion et livraison — encore non autorisées

**Fusionner peut publier le site** : le workflow
[deploy-o2switch.yml](../.github/workflows/deploy-o2switch.yml) peut lancer le
déploiement après la qualité verte de `main` lorsque
`O2SWITCH_DEPLOY_ENABLED=true`. La valeur actuelle de cette variable n'a pas été
contrôlée ici. Ne pas supposer qu'une fusion est une simple sauvegarde de code,
ni que les migrations SQL sont appliquées par ce déploiement.

- [ ] Clore les validations PWA ci-dessus et préparer la version revue, ses
  preuves et la procédure de retour arrière.
- [ ] Obtenir une décision explicite remplaçant le maintien en brouillon et
  couvrant le périmètre exact de livraison, les migrations et le déploiement.
  Ce n'est pas une demande d'accord en cours : la décision actuelle reste non.
- [ ] Avant exécution, revoir le catalogue, les dépendances, les permissions,
  les avis de sécurité pertinents et les copies/restaurations ; conserver les
  contrats d'acquis et l'isolation Auth/SoldeZen. Établir l'ordre SQL/code.
- [ ] Revoir puis appliquer, seulement dans le périmètre autorisé, les migrations
  `20261022160212_lumen_account_erasure.sql`,
  `20261022184145_lumen_account_rights_export.sql`,
  `20261022192259_lumen_technical_retention.sql`. Elles sont actuellement préparées.
- [ ] Effectuer la recette autorisée sur compte fictif dédié : demande, droit à
  agir, export relu, effacement, ancienne session/copie bloquée, autres comptes
  et applications préservés, revue des copies/fournisseurs et des limites.
- [ ] Si retenue, activer la conservation selon une décision distincte et vérifier
  ses comptages ; aucun planificateur supplémentaire n'existe dans la PR.
- [ ] Revalider les contrôles requis sur la tête réellement livrée. Fusionner
  uniquement selon l'accord obtenu, vérifier les contrôles de `main`, puis le
  **SHA exact servi en production** et la mise à jour PWA sans vider les sauvegardes.
- [ ] Mettre à jour les preuves du manifeste seulement avec référence, date et
  résultat vérifiés. Clore #316 uniquement lorsque ses critères sont satisfaits ;
  conserver #170 ouverte tant que les prérequis natifs/Play manquent.

Les procédures d'exécution restent dans les runbooks
[effacement](ACCOUNT_DELETION_RUNBOOK.md), [droits](ACCOUNT_RIGHTS_RUNBOOK.md),
[conservation](TECHNICAL_RETENTION_RUNBOOK.md) et [livraison](RELEASE.md).
Cette checklist ne les remplace pas et n'autorise aucun effacement individuel.

## C. Étapes futures enfants / Android / Play — différées volontairement

Ces éléments ne sont pas des corrections à activer silencieusement dans le
lot PWA. Ne pas redemander maintenant un choix parental ou lancer le packaging.

- [ ] Choisir ultérieurement une méthode parentale validée, puis implémenter et
  tester le parcours supervisé, le cloisonnement et les fonctions adaptées
  (défis, pseudos, support, notifications, droits). Évaluer fournisseurs/SDK et
  exigences Families. La PR ne change pas les anciennes inscriptions PWA et
  ne prouve pas qu'elles constituent un parcours enfant conforme.
- [ ] Valider la stratégie de conteneur et un identifiant Android durable avant
  de créer le projet ; réaliser le paquet signé et protéger les clés.
- [ ] Vérifier sur véritable Android OAuth/retour à l'app, même identité PWA,
  transfert invité, sauvegarde, solde exact, reprise hors ligne, mise à jour,
  réinstallation et suppression. L'aperçu gratuit à cloud simulé ne remplace
  pas cette recette ; le maintenir selon [sa documentation](ISOLATED_VALIDATION_PREVIEW.md).
- [ ] Finaliser inventaire réseau/SDK/licences du paquet, Data Safety, cible d'âge,
  contenu, fiche et URL des pages/suppression ; établir les tests Play applicables.
- [ ] Reporter France uniquement et gratuit sans publicité/achats dans la Console,
  puis obtenir l'autorisation de publication avant tout envoi. Aucun AAB,
  signature ou envoi Console n'a été réalisé par ce chantier.

Le rapport `node scripts/play-readiness.mjs` reste un contrôle **Play complet** :
les blocages natifs/familiaux demeurent attendus tant que cette phase est différée.
Ne pas remplir des preuves fictives pour le rendre vert.

## Maintenance du suivi

Pour chaque point clos, ajouter date, version, référence et limites de preuve.
Conserver la distinction entre préparation, test isolé, validation fournisseur
et exécution en production. Mettre à jour cette checklist, la PR et les commentaires
de suivi existants de #170/#316 ensemble ; ne pas annoncer « tout terminé » à
partir d'une CI verte ou d'une page candidate.
