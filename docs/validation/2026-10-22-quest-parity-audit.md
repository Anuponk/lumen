# Chantier #522 / #516 / #521 / #515 — audit et plan

**État courant du lot de convergence :** branche `chantier/522-convergence`,
après le premier lot fusionné dans #525 (`d5d7484`). Le contrat a été arrêté à
six quêtes visibles de découverte puis compte obligatoire, avec mêmes règles
de badges/récompenses/daily/social pour toutes les quêtes et conservation des
acquis. Les mentions « proposé » et « à définir » ci-dessous décrivent l'audit
initial ; la section de convergence et les documents propriétaires consignent
les décisions ultérieures. Trois migrations candidates sont préparées et testées
en PostgreSQL jetable ; elles ne sont pas appliquées en production. La recette
Android physique de #521 reste distincte des validations navigateur simulées.

## Intégration du 23 octobre

La PR #527 intègre désormais `main` jusqu'à `a76939e` (#553, #554 puis #556). Le contrat livré
sur main prévaut : quatre badges disponibles dès la quête 1, avec explications
aux quêtes 3 et 6. La migration candidate et une régression SQL sur les ordres
1 à 6 suivent cette règle. Les corrections de quota, session, gestes et diagnostics
de main sont conservées.
Une régression lit aussi le vrai texte de la modale de règles : il annonçait
encore des verrous 3/6 et une qualification par jour. Le texte suit désormais
les quatre badges dès 1 et le cooldown de quinze minutes, sans changer la règle.

Les nouvelles régressions couvrent le blocage du rejeu authentifié pendant une
restauration incomplète, la récupération partielle d'un résumé de rejeu V2 sans
modifier la première victoire, et le rejet des faits de badge inconnus modifiés.
Le point d'entrée QA numérique oublie l'ancienne quête stable sans effacer les
acquis. Les parcours navigateur utilisent les vrais boutons de briefing/reset ;
les assertions d'annulation et d'appui immédiatement suivant restent obligatoires.
Le parcours complet a aussi reproduit un décalage tactile distinct : afficher
le compte à rebours déplaçait le plateau de 16,125 px à 390 px. Le correctif
dédié #556 réserve une ligne indépendante ; l'assertion géométrique sur cinq
largeurs et les 216 appuis restent dans le parcours général, sans réessai d'une
assertion métier échouée. La confirmation sur téléphone physique reste séparée.

Les trois migrations ont passé les assertions de parité, reçus, social privé et
capability analytics dans PostgreSQL embarqué jetable le 23 octobre. La
concurrence PostgreSQL 17 et la production restent des résultats distincts.
Aucun schéma de production n'a été appliqué.

La validation complète actualisée passe : 133 suites Node, dix parcours
navigateur, 29 suites complémentaires, 396 cas intégrés et audit strict.
Le gate de qualité dure 229,3 s avec deux workers navigateur ; le
[rapport d'intégration](quest-convergence-522-integration.json) donne les
empreintes actuelles et les limites. Une exécution antérieure s'était arrêtée
sur un défaut d'attachement CDP à 1,6 s, avant les assertions du compte ; la
relance complète inchangée passe. L'intégration du squash main conserve les
mêmes sources et scripts que cette exécution validée.

## Validation historique du 22 octobre

La validation locale de la précédente révision est conservée dans
[`quest-convergence-522.json`](quest-convergence-522.json), avec empreinte des
sources et des trois migrations : 121 suites Node, neuf parcours navigateur,
29 suites complémentaires, 396 tests intégrés et audit strict réussis. Les
210 scénarios SQL embarqués ne remplacent pas la concurrence PostgreSQL 17
de la PR. Ces empreintes ne décrivent pas l'intégration du 23 octobre.
Les captures 390 px et desktop ont été revues ; Android physique
et application du schéma en production restent non exécutés à ce stade.

État initial : **étape 1, avant corrections métier**, conformément à #522. L'audit
initial ne vaut ni correction des quatre issues, ni validation navigateur, ni recette
sur le téléphone du signalement. Aucune sauvegarde réelle n'a été utilisée.

Le découpage a été validé par l'utilisateur le 22 octobre 2026. La suite traite
#515, #516/#521 et la définition du planning publié de #522. Le tableau conserve
les constats sur `650a39b` ; GAMEPLAY/UX/DATA_AND_ARCHITECTURE/TESTING décrivent
les corrections en cours. Les écarts métier nécessitant un contrat de
convergence et la coordination avec #523 restent ouverts.

Décision produit du 22 octobre : **compte obligatoire après une phase de
découverte à définir séparément**. Le seuil et le parcours de transition ne sont
pas définis par ce chantier ; conserver les accès actuels jusqu'à ce contrat,
puis appliquer la règle à toutes les quêtes sans dépendre de leur clé historique.

Intégration : branche rebasée sur `6dc1a098cefc2e20e7fe085f0da175f00c185a68`,
qui inclut les PR #523 (persistance) et #524 (documentation d'aperçu isolé).
Les conflits d'initialisation ont conservé le rétablissement des compteurs
d'aides et le bouton de réessai cloud ; les suites Wallet et les cartes de tests
des deux chantiers sont maintenues. Aucune nouvelle migration SQL ni modification
de l'aperçu privé n'est incluse. Les validations de cet aperçu sur Android ne
constituent pas une recette du présent lot de surbrillance.

## Référence et périmètre

Premier lot validé localement après intégration de `6dc1a09` : #515 (placement,
restore/reset), #516 (premier indice exploitable), #521 (surbrillance, frontières,
effacement après tap/glissé), définition publiée et lectures/télémétrie de #522.
Le [rapport du lot](chantier-522-516-521-515.json) donne les résultats et
l'empreinte des sources testées : 118 suites Node obligatoires, neuf parcours
navigateur, 29 suites complémentaires, 396 cas in-app et audit strict sans échec.
Les captures mobile/desktop ont été inspectées ; ce n'est pas une recette Android
physique ni une validation du cloud réel. #522 reste ouvert pour les contrats
métier listés ci-dessous. Aucune fusion du chantier ni publication Production.

- Branche : `chantier/522-516-521-515`, créée depuis `origin/main`
  [`650a39b904970221a4a42c28073dade92d9f5617`](https://github.com/Anuponk/lumen/commit/650a39b904970221a4a42c28073dade92d9f5617).
- Issues : [#522](https://github.com/Anuponk/lumen/issues/522),
  [#516](https://github.com/Anuponk/lumen/issues/516),
  [#521](https://github.com/Anuponk/lumen/issues/521),
  [#515](https://github.com/Anuponk/lumen/issues/515).
- La branche locale précédente `feat/mon-ciel-adventures` est conservée ; elle
  n'a pas été fusionnée dans ce chantier.
- Coordination : [PR #523](https://github.com/Anuponk/lumen/pull/523), observée
  à `65770fab037e611ad6d76f4503e15bc8dc1a5416`, traite #248/#391/#398/#518.
  Elle touche notamment le contrôleur, les styles, les tentatives, les commandes,
  l'outbox et les contrats cloud. Réévaluer son état avant chaque lot, intégrer
  son résultat sans dupliquer les commandes ni contourner ses protections.
- #470 est fermé ; son complément demande expressément de ne pas réimplémenter
  le chantier livré dans #510. Conserver ses tests de compatibilité et distinguer
  leur résultat de la recette sur le téléphone initialement affecté.

## Inventaire exécuté sur la référence

| Modèle | Quantité observée | Propriétaire |
|---|---:|---|
| Grilles `CAT` auditées | 196 | `catalogue.js`, `audit-catalogue.mjs` |
| Quêtes du planning numérique de base | 196 | `data.js`, `progression.js` |
| Quêtes jouables avec clé numérique, dont manifeste généré | 296 | `playable-quests.js`, `staged-adventure.js` |
| Quêtes canoniques | 400 | `canonical-quests.js` |
| Quêtes canoniques sans clé numérique | 104 | manifeste `issue-222-additions.json` |
| Aventures / constellations canoniques | 4 / 40 | `content.js`, catalogue canonique |

Ces chiffres décrivent le snapshot ; ils ne deviennent pas des limites de code.
Les 298 étoiles du ciel numérique ne sont pas le total de tous les contenus
canoniques. L'audit de `CAT` seul ne certifie pas les 400 quêtes canoniques.

Identité, numéro affiché et clé de sauvegarde diffèrent réellement : la quête
visible 91 est `base-q071`, `legacyIndex=70`, `real-10` (Aigle), 6×6. La clé
numérique 90 désigne `base-q091`, quête visible 112, `real-12`. Une reproduction
de #516 doit partir de `canonicalQuestByOrdinal(91)`, jamais de l'index 90.

## Matrice des écarts #522

« Confirmé » signifie constaté dans le code ou exécuté en mémoire, selon la
colonne ; cela ne signifie pas qu'un parcours navigateur ou serveur réel a été joué.

| Surface | Constat et références | Qualification / risque | Couverture et suite |
|---|---|---|---|
| Identités / stockage | `playable-quests.js`, `canonical-quests.js`, `canonical-progress.js` : `solved[index]` / `performances[index]` contre `canonicalQuestState[id]` | Compatibilité indispensable ; ne pas renuméroter ni déplacer les acquis | `issue-222-runtime-tests`, `issue-222-profile-tests`, compatibilité catalogue |
| Composition du catalogue | `planSlots` impose dix constellations et dix quêtes, assertions `packs.length*100`, overrides réservés à deux packs ; `content.js` duplique un descripteur du manifeste | Dette confirmée de croissance ; distinguer contraintes éditoriales actuelles et limites du moteur | Fixtures N→N+k, tailles variables ; garder hashes, références et récompenses exactes |
| Accès / disponibilité | `catalogueQuestDecision` exige Auth/hydratation seulement si `legacyIndex===null` ; simulation : première quête numérique `ready`, première insertion `auth-required` / `sync-required` | Écart métier confirmé, actuellement documenté dans PROGRESSION ; décision produit de convergence nécessaire, sans ouvrir des aventures non acquises | `catalogue-access-tests` (19 cas), `catalogue-compatibility-tests` ; parité invité/compte/reprise |
| Accès acquis | Origines immuables, frontières et rattrapage dans `catalogue-origin.js` / `catalogue-access.js` | Exception légitime de compatibilité #470 ; ne pas la supprimer au nom de l'unification | Versions V1/V2/V3 synthétiques, conservation des anciennes frontières |
| Chargement / difficulté | `choose` utilise soit `canonicalActiveQuest`, soit `playableQuest` puis parfois relit `CAT` ; `qualifyDifficulty` commun | Adaptateurs techniques légitimes ; risque de perdre métadonnées ou d'utiliser un index dormant | `playable-quests.test`, `difficulty-canonical-test`, `issue-222-runtime-tests` |
| Règles / victoire | Mêmes `createGameEngine`, `validateGuardians`, plateau et cycle de cellules | Socle commun confirmé ; aucune nécessité de remplacer le moteur | `runHintTests()`, audit strict et replay des manifestes |
| Indices / assistance | Moteur commun ; coût, restrictions et plusieurs conseils utilisent encore `levelIndex` ; `startCanonicalQuest` le conserve depuis le front numérique | Risque confirmé de dépendance à l'index dormant ; effet précis à tester avec même quête et fronts différents | Régression de parité des coûts/contrôles ; #516/#521 séparés de l'économie #523 |
| Onboarding | Jalons d'indices gratuits, guidage, badges et visite utilisent des indices numériques ; les insertions commencent au numéro visible 7 ; `learningSkyDiscoveryRequired` teste `levelIndex===7` alors que GAMEPLAY décrit le passage après quête 2 | Écart code/document à arbitrer, ne pas déplacer silencieusement les leçons ; préserver SEE→UNDERSTAND→ACT | `learning-tests`, parcours learning ; comparer jalons à l'éligibilité source et à l'identité de leçon |
| Chronométrage / reset | `attempt-engine.js` commun ; ID d'essai numérique ou stable selon adaptateur | Compatibilité légitime ; garder tentative et badge run, ainsi que l'exception sociale one-shot | `attempt-engine-tests`, campaign-resume navigateur |
| Badges / qualification | `init` force `qualifying:true` pour `canonicalActiveQuest`, mais applique le cooldown à `performances[levelIndex]` sinon ; victoire canonique calcule avec ordinal, UI live avec index numérique | Écart confirmé ; une parité de fonctions de badge seule ne couvre pas l'orchestration du cooldown | `performance-badge-tests`, canonical replay navigateur ; tests transversaux cooldown/éligibilité |
| Récompenses / daily | `applyLegacyVictory` : bonus, étoiles variables, autonomie et daily ; `acknowledgeCanonicalVictory` / ledger : étoile et XP, badges ; `generatedQuestReward` a sa propre formule | Écart de contrat confirmé ; ne pas réattribuer les récompenses antérieures. Montants/propriétés explicites à valider, coordination #523 obligatoire | `legacy-command-client-tests`, `canonical-ledger-client-tests`, `generated-rewards.test` et SQL jetable |
| Mon ciel / célébration | Compteurs, cartes et révélation récemment partagés (#506/#510/#512/#520), mais branchements de navigation dans `advanceToNextPuzzle`, `renderMap`, `renderCanonicalJourneyPreview` | Ne pas refaire les correctifs livrés ; risque résiduel aux transitions et reprises | sky-navigation et canonical-replay navigateur ; invariance de navigation sans écriture |
| Social | `configureVictoryChallenge` désactive le partage sur les quêtes sans protocole historique ; `legacyIndexForActiveChallenge` refuse une identité sans clé numérique | Écart produit confirmé et documenté ; extension RPC future, pas simple activation du bouton | `issue-222-challenge-tests`, social UI/SQL ; première partie uniquement, aucun effet campagne |
| Statistiques / analytics | `currentAttemptAnalytics` prend index/constellation/performances numériques ; `trackAttemptEvent` envoie `levelIndex+1` | Risque d'attribution au front dormant pour les insertions ; tracer payload réel avant correction | `analytics-tests`, scénarios canonical avec deux fronts numériques différents |
| Local / cloud / multi-appareil | Une tentative persistée commune ; projections historiques et canoniques, namespaces Legacy/Canonical et reçus distincts | Frontière technique nécessaire avec serveurs/anciens clients. Ne pas fusionner les writers ni les namespaces avant migration prouvée | matrices cloud, durable outbox, sessions, tests SQL ; chantier propriétaire #523 |

Cause structurelle : le modèle stable rassemble le contenu, mais la sélection
de plusieurs contrats métier dépend encore de la présence d'une clé numérique
et de l'état mutable `canonicalActiveQuest`. `levelIndex` reste consommé même
quand il ne représente pas la quête jouée. Les différences de compatibilité,
d'accès historique et de protocole ne sont pas toutes des anomalies : elles
doivent rester isolées des propriétés de jeu après convergence.

## #516 — déduction reproduite

Replay déterministe de la quête visible 91 avec `createGameEngine`, marquage
auto activé. Après 15 étapes de preuve (numérotation des coordonnées ci-dessous
à partir de 1), le moteur retourne un groupe de territoires internes **0 et 2** :

- candidats sources : **L1C1, L2C1, L3C1, L4C5** ;
- colonnes réservées : **1 et 5** ;
- exclusion certaine : **L5C5**, qui appartient à un autre territoire ;
- énumération de contrôle : **1 solution** avant, **0** en imposant un Gardien
  sur L5C5. L'énumération sert à l'audit, pas à fabriquer l'indice joueur.

État exact avant cet indice (`0` vide, `1` exclusion, `2` Gardien) :

```json
[[0,0,0,0,1,1],[0,0,0,1,1,1],[0,0,0,0,1,1],
 [1,0,1,1,0,0],[1,0,1,1,0,0],[1,0,0,1,0,0]]
```

Dans le handler Indice, `group` étape 1 ne cite ni les colonnes ni l'exclusion ;
étape 2 donne les colonnes, étape 3 la cible. `hiCells` n'utilise d'abord que
`detail.source` (candidats restants), sans distinguer cible et prémisses.
La preuve est exploitable ; son premier exposé laisse le joueur reconstituer
l'action. Ce replay synthétique n'établit pas l'état exact du signalement.

Complément de recette UI : le handler préfère `simpleForcedPlacement` au moteur
général. La fixture ci-dessus vérifie donc une preuve du moteur, pas la sélection
effective de l'interface. La régression livrée utilise cet autre état valide de
la même quête, après une pose correcte et ses exclusions :

```json
[[1,1,0,0,1,1],[2,1,1,1,1,1],[1,1,0,0,1,1],
 [1,1,1,0,0,0],[1,0,1,0,0,0],[1,0,0,0,1,0]]
```

Il n'existe alors ni erreur, ni marquage direct manquant, ni placement simple.
Le handler choisit le groupe de territoires internes 1/3, sources L1C3/L1C4/
L3C3/L3C4, colonnes **3 et 4**, cible **L6C3**, avec ou sans marquage auto.
Une solution subsiste avant l'exclusion et aucune en imposant un Gardien sur la
cible. Le test ne force pas le saut de la priorité des placements simples.

Proposition à valider : garder une aide progressive mais rendre la première
demande exploitable, avec colonnes identifiées et conséquence explicite ; les
étapes suivantes détaillent la preuve sans exiger plusieurs achats pour obtenir
une action. Ne pas changer les coûts dans ce lot. Couvrir lignes/colonnes,
groupes de 2/3, marquage auto on/off, état partiellement rempli et cible certaine.

## #521 — rendu à vérifier

`render` assigne la même classe `.hi` à `hi` et `hiCells`.
`styles.css` applique une ombre cyan intérieure de 2 px et ne change le mélange
du fond territoire que de 18 % à 25 %. Les frontières restent des bordures
territoriales de 3 px (`data-t/b/l/r`). Ce mécanisme est confirmé par lecture ;
la gêne visuelle et le futur contraste doivent être vérifiés dans le navigateur.

Proposition : surbrillance intérieure dorée sous bordures et symboles, sans
remplacer `--territory`, avec distinction des prémisses et de la cible #516.
Vérifier angles, frontières partagées, groupes adjacents, vide/exclusion/Gardien,
toutes couleurs et mouvement réduit. Captures desktop et mobile obligatoires ;
une émulation tactile ne constitue pas une validation Android réelle.

## #515 — cause confirmée

Les clics ordinaires appellent `paintBoardState` → `updateLiveReward`, sans
`rewardProgressPulse`. Le rendu complet appelle cette dernière ; le dernier
Gardien déclenche justement `render`. La condition `!halfRewardShown &&
q>=ceil(n/2)` n'exige ni franchissement, ni état non terminal. Elle peut donc
annoncer « Mi-chemin » à **n/n**, avant validation de la victoire.

Simulation de la fonction actuelle extraite dans une VM avec DOM/audio factices :
pour **5, 6, 7 et 8** Gardiens requis, un premier appel à `q=n` produit
effectivement « Mi-chemin · le ciel s'éveille ». Une restauration après remise
à zéro de `halfRewardShown` peut aussi déclencher ce signal tardif.

Proposition : métrique publique = nombre de Gardiens posés / taille du plateau,
sans consultation de la solution (ne pas révéler les erreurs silencieuses).
Déclencher sur mutation réelle traversant `ceil(n/2)`, une fois par grille/run ;
initialiser silencieusement après restauration, ignorer rendus, undo et état
terminal, conserver l'interdiction de render complet pendant le drag.
Tests à écrire : avant/seuil/après, victoire valide et invalide, undo/repose,
reload avant/après seuil, reset/rejeu, aide, et tailles paires/impaires.

## Modèle cible proposé et compatibilité

### Contrat validé pour la convergence après #525

L'utilisateur a confirmé la découverte jusqu'à la quête affichée 6, puis un
compte obligatoire, avec conservation des quêtes terminées et des tentatives
réellement commencées. Il a aussi validé l'extension des règles numériques :
cooldown de 15 minutes, récompenses, activité quotidienne et défi social de
première partie identiques. Aucun crédit rétroactif ni retrait d'acquis.

Le travail suit `chantier/522-convergence` depuis `d5d7484`. Les jalons
d'apprentissage doivent lire la quête affichée active (3/6/11, indices offerts
jusqu'à 10) ; le passage protégé après quête 2 doit annoncer Mon ciel puis
présenter son vrai parcours avant quête 3. Un index numérique dormant ne peut
piloter ni ces règles ni les coûts.

Pour les récompenses, préparer une transaction versionnée recevant l'identité
stable et les faits immuables de l'essai, indépendamment du format de stockage.
Elle doit conserver les namespaces/reçus antérieurs, vérifier le compte et
verrouiller le profil avant de consulter le reçu. Même opération rejouée : même
résultat, profil courant et aucun double crédit ; faits différents : refus.
La qualification, le bonus, le compteur d'autonomie, le daily et les projections
Wallet/Legacy doivent être mis à jour dans la même transaction. Préserver la
performance du premier accomplissement et ses champs inconnus ; les résumés de
rejeu exigent un champ distinct et un garde serveur adapté. Aucune mise à jour
en masse des joueurs. Un client ne doit pas simuler ces crédits authentifiés
ni revenir à un writer ancien après une réponse ambiguë.

`quest-victory-parity-tests.mjs` a d'abord reproduit deux écarts rouges du writer :
XP sans indice malgré une autre assistance, et troisième victoire autonome.
Après le refus initial du contrôle automatique, l'utilisateur a explicitement
autorisé l'implémentation et les migrations sur la branche dédiée, avec tests
PostgreSQL jetables. La projection pure, le client à reçus V2 et les migrations
sont désormais implémentés ; ces régressions passent en conservant les acquis.
Les assertions SQL locales passent dans PostgreSQL embarqué jetable ; ce résultat
ne remplace pas les sessions concurrentes du workflow PostgreSQL 17. Le gate
complet et la CI restent requis avant livraison. Aucune de ces migrations n'est
appliquée en production ; cette application demande toujours un accord distinct.

### Suite du lot 3 : rafraîchissement des badges de Mon ciel

Sur `a989b59`, `startBadgeCooldownRefresh` associait les cartes à
`range.quests[offset]`, alors que `renderMap` affiche le catalogue canonique
avec les quêtes insérées. Une régression exécutant le vrai callback a reproduit
le remplacement du contenu de `planned-real-01-q07` par celui de la clé
numérique 0. La correction résout `data-quest-id` et lit `readQuestView` depuis
la progression vivante avant d'appeler le renderer correspondant au format
existant. Aucun acquis, cooldown, critère de badge ou accès ne change.

Le test couvre aussi l'ordre des cartes, un ID inconnu, le remplacement de la
progression après installation du timer et sa fermeture. Le scénario navigateur
exécute le callback réellement installé dans Mon ciel avec des badges distincts
pour les deux formats, sur les deux tailles d'écran du chantier.

**Onboarding impact :** pas de changement de concept, de règle, de jalon,
de texte ou de destination ; seule l'identité de l'acquis affiché est corrigée.
Les leçons et la qualification restent sous leurs sources existantes.

Une vue immuable `QuestDefinition` issue du catalogue : `id`, ordre affiché,
pack/constellation, grille auditée/difficulté, propriétés explicites de leçon,
assistance, qualification, récompense et prise en charge sociale. Ce sont des
propriétés proposées, pas un nouveau schéma déjà adopté. Aucun `isNew`/date/lot
ne pilote le gameplay. L'origine de catalogue continue de préserver les accès.

Une vue/adaptateur d'acquis résout lecture et écriture depuis l'ID stable.
`legacyIndex` reste dans l'adaptateur, les anciennes clés et les protocoles ;
il ne devient ni numéro affiché ni règle métier. L'UI conserve son unique état
vivant et l'engine actuel ; aucun second store de plateau/progression.

Migration en étapes : comparer les lectures sans écrire, conserver snapshots et
IDs/assignations/tentatives, introduire le consommateur commun, puis converger
les contrats approuvés. Garder les reçus/opérations/namespaces, cooldowns et
Maîtrises acquises, sans backfill ni double récompense. Toute modification SQL
ou de writers est coordonnée avec #523 et testée en PostgreSQL jetable avant
autorisation distincte de production. Rollback du client conserve les données.

## Découpage et critères de sortie

| Lot | Contenu | Validation requise avant livraison |
|---|---|---|
| 0 — cette étape | Audit, reproductions synthétiques, arbitrages et plan | Liens/chemins, contrats préservés, `git diff --check` |
| 1 — #515 | Signal de mi-chemin attaché aux mutations réelles | Test métier rouge puis vert, restauration/reset/undo, navigateur, suite intégrale et audit |
| 2 — #516 + #521 | Explication/action certaine et surbrillance lisible | Fixture ci-dessus, propriétés de preuve, captures desktop/mobile, frontières et onboarding |
| 3 — #522 lecture | Vue de quête commune, parité des lectures, identité analytics et UI | Comparaisons numeric/generated/inserted et N→N+k ; aucune réécriture de sauvegarde |
| 4 — #522 contrats | Après arbitrage : accès invité, cooldown, récompenses/daily, social et jalons | Alignement avec #523, compatibilité anciens clients, suites cloud/SQL/navigateur et recette |

Les lots peuvent être des commits distincts sur cette branche puis des PR
cohérentes. Ne pas fusionner/déployer ce dossier comme si les quatre issues
étaient corrigées. Aucune clôture automatique des issues.

**Onboarding impact :** aucun changement de leçon à l'étape audit. Avant les
lots 2–4, comparer le texte des indices et les jalons de coût/assistance/badges/
Mon ciel à leurs sources métier, résoudre le désaccord de navigation relevé,
et ajouter les régressions de synchronisation du contenu/timing. Ne pas toucher
aux leçons protégées sans couverture dédiée.

## Vérifications réellement exécutées

Sur la référence, avant changement applicatif :

- `node scripts/audit-catalogue.mjs` : 196 grilles, 196 références numériques,
  24 constellations, 298 étoiles ; aucun échec.
- `node scripts/catalogue-compatibility-tests.mjs` : deux révisions,
  400 identités / restaurations de nouveau joueur, compatibilité vérifiée.
- `node scripts/catalogue-access-tests.mjs` : 19/19.
- `node scripts/issue-222-challenge-tests.mjs` : identités des liens préservées.
- `node scripts/issue-222-runtime-tests.mjs` : registre canonique vérifié.
- `node scripts/canonical-ledger-contract-tests.mjs` et
  `node scripts/canonical-ledger-client-tests.mjs` : contrats SQL statiques et
  client simulé réussis ; aucune exécution SQL réelle.
- `node scripts/docs-consistency-check.mjs` : réussi.
- Inventaire, replay #516 et simulation #515 exécutés en mémoire avec les
  modules/fonction de la référence ; aucun appel de mutation GitHub ou joueur.

Non exécutés à cette étape documentaire : suite navigateur `runHintTests()`,
tests Android réel, tests SQL en base jetable, `npm run test:full`, production.
Pour chaque lot gameplay : tests métier avant/après, suite in-app complète,
audit strict et audits des manifestes concernés ; gate complet avant PR de
correction. Les résultats ciblés ci-dessus ne remplacent pas ces exigences.
