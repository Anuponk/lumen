# Lumen Analytics — audit et conception du lot A (#708)

Statut : audit du 15 novembre 2026, **actualisé le 21 novembre 2026** (§0). Lot A d'origine : aucun
développement B/C/D, aucune table, migration, activation ou modification de production.
L'état cible décidé dans [#708](https://github.com/Anuponk/lumen/issues/708) est
**une seule administration dans `/admin/analytics`**, absorbant toutes les fonctions
actuelles. La coexistence avec l'écran historique est temporaire.

## 0. Actualisation du 21/11/2026 (base `42e7af14`, production `1.11.1+719`)

L'audit du 15/11 ci-dessous reste la référence de l'inventaire F01–F24.
Les constats suivants sont devenus **obsolètes** ou ont évolué, après vérification dans le code actuel.

| Constat du 15/11 | État vérifié au 21/11 | Source |
|---|---|---|
| « B/C/D non commencés », coexistence avec un écran historique | **B1 livré** (#718) : le cockpit **est** l'espace `/admin/analytics`, une seule fenêtre `#adminCockpit` avec cinq sections (`overview`, `players`, `journeys`, `sync`, `support`), l'historique de navigation, la période dans l'URL et un refus d'accès explicite. Il n'existe plus d'écran séparé : l'entrée « Ouvrir le cockpit » ouvre la même route. | `src/ui/analytics-navigation.js` |
| Tableaux peu exploitables | **#721** : synthèse priorisée, quêtes filtrables avec échantillons, santé technique avec causes, versions et files, puis accès aux joueurs et sessions | `src/ui/analytics-dashboard.js` |
| KPI produit à zéro | **#727** : lecture agrégée des reçus serveur (`lumen_admin_quest_metrics`, `service_activity`), inconnus explicites, migration `reliable_analytics_708` **appliquée** | `supabase/migrations/20261115162545_reliable_analytics_708.sql` |
| F24 « PR #716 seulement » | **Livré** : « Aperçu : aventure pleinement maîtrisée » est dans la section Support | `index.html#adminPreviewMastery` |
| Acquisition non instrumentée | **#875 / #890 / #759** : canaux `player_share`, `player_invite`, `challenge_link` et les UTM vidéo sont portés par `app_opened` puis par la quête 1 ; requêtes manuelles dans `docs/marketing/acquisition-agregats.sql`. **Aucune vue Analytics** de ces chiffres | `src/analytics/acquisition.js` |
| Social non couvert | Défis (#18/#35), Défi du jour (#882), Espace social (#898) et duels (#896) **livrés**, avec des tables serveur fiables (`social_challenges`, `…_participations`, `…_invites`, `daily_runs`). **Aucune vue Analytics** | migrations #35/#882 |
| Trafic humain/QA/CI | Les RPC du cockpit filtrent `traffic_type='human'`. La répartition humains / QA / CI / non déterminés (complément du 18/11) **n'est affichée nulle part** | `20261007_lumen_cockpit_human_traffic_only.sql` |
| Feature `analytics_cockpit` | Inchangé : toutes les RPC `lumen_admin_*` exigent la capacité non expirée et révoquent `anon` explicitement | migrations `lumen_admin_*` |
| Collecte produit publique | **Toujours désactivée**. Seules les sources serveur et les sessions consenties ou QA alimentent les tableaux | `analyticsAllowed()` |

**Écarts de parité restants** (à traiter par les PR B/C/D de ce chantier) :
1. **F21/F22** : « Tester comme nouveau joueur », « Réinitialiser la progression QA » et « Simuler une série perdue » sont encore dans le menu Administration, hors d'Analytics ; la section Support l'annonce elle-même.
2. **F23** : le mode « éclats illimités » n'existe plus dans le code actuel (aucune référence `lumenAdminUnlimitedShards`). C'est une fonction retirée, pas un écart à migrer.
3. **Absence d'une section Acquisition et engagement** : canaux, quête 1, défis, Défi du jour, rétention lorsqu'elle est mesurable.
4. **Répartition du trafic** (humains / QA / CI / non déterminés) non affichée.
5. **Libellés historiques** : « Tableau de bord », « Ouvrir le cockpit ».

## 1. Périmètre, preuves et limites

Classification : **light, documentaire** ; les futurs lots touchant collecte,
permissions ou données devront être reclassés selon leur impact réel. Modules
propriétaires : `src/ui/game-screen.js`, `cockpit-sessions.js`, `cockpit-dates.js`,
`incident-investigation.js`, `support-panel.js`, `src/analytics/events.js` et les
RPC existantes. Invariants : aucune perte d'outil, identité explicite, activité ≠
Auth ≠ reçu serveur ≠ ACK navigateur, inconnue ≠ zéro, aucune écriture de jeu.

Base synchronisée : `origin/main` à `0cf9ef7a2845f8238061187d844e57fba85263af`
(#715, changement de compte), branche `docs/708-analytics-audit`. L'ancienne
branche locale `assets/google-play-branding` et les dossiers Android non suivis
ne font pas partie de ce lot. Références examinées :

| Travail | État GitHub observé le 15/11 | Conséquence |
|---|---|---|
| [#534](https://github.com/Anuponk/lumen/issues/534) | Fermée, label `to-be-tested` ; texte de recette physique restant | Briques déjà livrées, pas de réimplémentation ; fermeture ≠ recette démontrée |
| [#398](https://github.com/Anuponk/lumen/issues/398) | Fermée, label `in-progress` ; limites de recette dans le texte | Réutiliser santé/outbox/alertes ; ne pas prétendre Android réel validé |
| [#574](https://github.com/Anuponk/lumen/issues/574) | Fermée, label `to-be-tested` | Assistance livrée ; conserver consentement et limites de recette |
| [#711](https://github.com/Anuponk/lumen/issues/711) | Ouverte, label `to-be-tested` | #715 est sur main ; la cause de l'échec de restauration signalé n'est pas démontrée résolue |
| [PR #716](https://github.com/Anuponk/lumen/pull/716) | **Ouverte** ; branche distante à `7ad79230c4e0d675f34602bfa8bd818039aaedd7` | Aperçu maîtrise et vocabulaire diagnostic sont des dépendances candidates, pas des fonctions de main |

Le dernier commentaire de #716 signale un échec CI `module-structure-tests.mjs`
(logique inline du shell). Ce constat rapporté interdit de traiter cette PR
comme une base validée ; son correctif et son déploiement restent hors lot A.
Le commentaire de #711 atteste une correction de l'affichage dans #715 et une
recette téléphone encore non testée ; aucune validation de contamination ou de
restauration live n'est revendiquée par cet audit.

Lecture des contrats : [produit](PRODUCT_ANALYTICS.md),
[observabilité](OBSERVABILITY_534.md), [assistance](SUPPORT_574.md),
[contrats agents](AGENT_CONTRACTS.md), [architecture/cloud](DATA_AND_ARCHITECTURE.md#cloud-persistence-contract),
[tests](TESTING.md), [UX](UX_AND_VISUAL_DIRECTION.md) et cartes d'architecture.
Historique utile : `528b249` (#546), `627e655` (#547), `3fd1efb` (#554),
`0cf9ef7` (#715). Les preuves de recette existantes restent dans
[cockpit](validation/2026-10-25-cockpit-534.md) et
[support](validation/2026-10-25-support-574.md).

Vérification Supabase **métadonnées seulement**, sur le projet partagé identifié
par la documentation Lumen : définitions de fonctions/vues via `pg_proc`,
`pg_get_functiondef`, `pg_get_viewdef`, type/RLS/ACL via `pg_class` et
`pg_namespace`. Aucun SELECT sur profils, événements, comptes Auth, sauvegardes
ou captures ; aucune exécution de RPC métier ni modification SQL. Cela vérifie
des définitions et droits, pas un parcours HTTP authentifié ou une recette mobile.
Les migrations locales sont la preuve de conception ; les deux sources sont
distinguées lorsqu'elles divergent ou sont incomplètes.

## 2. Inventaire et matrice de parité

Légende : **R** réutiliser, **D** déplacer dans la navigation commune,
**E** enrichir ultérieurement, **C** créer. Droits : **A** = utilisateur Auth avec
capacité serveur `analytics_cockpit` non expirée ; **U** = `unlimited_shards`,
capacité distincte ; **Q** = environnement QA isolé. Les codes S1–S8 désignent
les sources détaillées en section 3. Tous les éléments ci-dessous sont
**non migrés** : le lot A ne crée pas l'interface cible.

| ID / fonction et opérations actuelles | Code / point d'entrée actuel | Source ; droit | Destination ; décision | Recette de parité à conserver |
|---|---|---|---|---|
| F01 Ouvrir/fermer cockpit, clic extérieur, actualiser, période 1/7/30/3650 jours | `index.html#adminCockpitOpen`, `#adminCockpit`, `#adminCockpitDays` ; `setupAdminCockpit`, `loadAdminCockpit` | S1–S6 ; A | Cadre Analytics ; R/D, E liens profonds | Ouvrir depuis Administration, retour au jeu, filtre/refresh sans perdre contexte |
| F02 Onze sections repliables indépendantes | `index.html`, `details.admin-section` | DOM ; A | Cinq sections internes ; D | Clavier, tactile, état replié conservé au rafraîchissement |
| F03 Joueurs uniques, nouveaux, revenants, DAU, WAU, sessions, commencées/terminées, feedbacks | `#adminCockpitKpis`, `loadAdminCockpit` | S1 ; A | Vue générale ; R/E définitions | Même source et périmètre affichés, données manquantes explicites |
| F04 Barres activité quotidienne | `#adminDailyChart` | S1.daily ; A | Vue générale ; R/D | Dates et nombres accessibles autrement qu'au survol |
| F05 Rétention J1/J3/J7 | `#adminRetention` | S1.retention ; A | Vue générale, détail Parcours ; R/E | Conserver accès historique, qualifier cohortes immatures avant nouvelle interprétation |
| F06 Tunnel ouverture/Q1/tutoriel/Q3/Q10 et pourcentages | `#adminFunnel` | S5.funnel remplace S1.funnel ; A | Parcours & quêtes ; R/D/E | Étapes et dénominateurs visibles, aucun tunnel ordonné inventé |
| F07 Friction : joueurs, réussite, resets, abandons explicites, indices, vérifications, médiane | `#adminFriction`, `adminAlerts` | S5.friction ; A | Parcours & quêtes ; R/D/E | Identités stables, faibles échantillons, null médiane, rejeux |
| F08 Catalogue aventures/constellations/grilles/taille/difficulté estimée | `renderAdminCatalogue` ; `src/campaign/admin-catalogue.js`, `#adminCatalogueTree` | Catalogue canonique local ; A | Parcours, raccourci Support ; R/D | Catalogue extensible, IDs/ordre réels, aucune limite de contenu codée en dur |
| F09 Alertes santé, attente ancienne, volume/retry et friction | `#adminAlerts`, `adminAlerts`, `incidentAlerts` | S1/S4/S5 ; A | Vue générale → Sync/Parcours ; R/D/E | Séparer les familles, seuils existants, pending ≠ perte |
| F10 Liste inscrits récents (250 max), nom/email autorisé, recherche insensible accents/casse/espaces | `registeredPlayers`, `renderPlayerDirectory`, `#adminPlayers` | S2 + S3 ; A | Joueurs & sessions ; R/D/E pagination | Inscrits seulement, aucun classement fictif d'anonymes, métadonnée manquante acceptable |
| F11 Tri activité/Auth/dernier reçu portefeuille, filtre de statut et badges texte/symbole/couleur | `src/ui/cockpit-sessions.js`, `cockpit-dates.js` | S3 ; A | Joueurs & sessions ; R/D | Filtre et badge partagent `playerSyncStatus`, ancien/inconnu reste distinct |
| F12 Trois dates et détail Canonical/Legacy/Wallet, observation appareil la plus ancienne | `appendPlayerDates`, `#adminPlayers` | S2.last_seen + S3 ; A | Joueurs & sessions ; R/D | Fuseau lecteur et UTC/âge, aucun reçu présenté comme ACK de tous les appareils |
| F13 Joueur → sessions analytiques/diagnostiques → épisodes → événements | `loadAdminTimeline`, `renderPlayerSessions`, `rememberSessionExpansion`, `#adminTimeline` | S6 ; A | Joueurs & sessions ; R/D | Sessions indépendantes fermées par défaut, filtres version/état, refresh conserve expansion même joueur |
| F14 Incidents : signatures, gravité, occurrences/sessions, première/dernière date | `buildIncidentInvestigation`, `renderIncidentInvestigation`, `#adminDiagnosticIncidents` | S4.diagnostics ; A | Sync & incidents ; R/D | Échantillon opt-in/partiel signalé, pas de faux taux global |
| F15 Comparaison numérique des versions, filtre version + état d'épisode | `observedVersions`, `renderIncidentInvestigation` ; sessions aussi filtrables | S4/S6 ; A | Sync & incidents ; R/D/E | Version inconnue, épisode multi-version compté dans chacune sans sommer en sessions uniques |
| F16 Suggestions de cause/reproduction, rapport assaini, téléchargement, recherche GitHub, préparation d'issue après revue | `guidance`, `incidentReport`, `githubIssueDraft`, cases de revue | S4/S6 projection fermée ; A | Sync, raccourci Support ; R/D | Aucun ticket envoyé automatiquement ; filtre/changement d'identité invalide revue et actions détachées |
| F17 Comptes créés : email, pseudo, création/Auth/activité, point atteint | `#adminAccounts` | S2 + S5.current_players ; A | Joueurs & sessions ; R/D/E pagination | Ne pas confondre liste bornée, total comptes, point observé et progression confirmée |
| F18 Feedbacks : catégorie, texte, joueur, quête, date, version | `#adminFeedbacks` | S1 feedback RPC ; A | Support & administration ; R/D/E identité stable | Texte libre protégé, aucun transfert vers télémétrie ou rapport incident automatique |
| F19 Dossier support : liste, référence/statut, dates, captures/octets, dernière consultation | `mountSupportDossier` dans la fiche joueur, `src/ui/support-panel.js` | S7 ; A + contrôle support | Support, contexte joueur ; R/D | Chargement à l'ouverture, propriétaire/cible inchangés, refus après expiration/retrait |
| F20 Télécharger dossier privé avec vérification SHA-256 ; effacer copies support | Même module, boutons `Télécharger le dossier privé` / `Effacer les copies de support` | S7 download/purge ; A + contrôle support | Support ; R/D | Hash, audit d'accès, erreur explicite ; purge ne touche jamais aux originaux du jeu |
| F21 Tester nouveau joueur, retour profil réel, reset QA confirmé | `#qaAccountSwitch`, `#qaAccountReset`, menu Administration | Local `?qa=new&qaFresh=1`, clés `lumenQa*` ; visibilité A/U/Q | Support / outils ; D/R | Garder entrée/sortie QA, confirmation reset et isolation du profil réel |
| F22 Simulation série perdue | `#qaPreviewStreakLoss`, gestionnaire dans `game-screen.js` | Présentation locale, **QA seulement** | Support / outils QA ; D/R | Ne pas rendre disponible au joueur réel par simple déplacement |
| F23 Éclats illimités, préférence mode test | `#adminUnlimitedShards`, `updateAdminTools` | `lumenAdminUnlimitedShards` ; U | Support / outils ; D/R | A seul n'accorde pas U ; ne jamais transformer ce mode en crédit serveur |
| F24 Aperçu aventure pleinement maîtrisée, sans écriture, refus si victoire/pending/hors aventure | **PR #716 seulement**, `previewAdventureMastery`, outil cockpit candidat | Célébration et catalogue existants ; A candidat | Support / aperçus ; intégrer après rebase de #716 | Vraie célébration, aucun défi, aucun changement de progression/tentative/local/cloud |

Le diagnostic Compte, copie du diagnostic, inventaire/archivage local et export
de récupération sont des **outils du propriétaire sur son appareil**, pas des
actions distantes sur un joueur sélectionné. Leur câblage reste dans
`game-screen.js` (`#showAccountSyncDiagnostic`, `#copyAccountSyncDiagnostic`,
`#archiveAccountStorage`, `#exportAccountStorage`) et les modules de récupération.
Prévoir dans Support un accès clairement nommé « cet appareil », sans déplacer
le consentement, la révocation ou la suppression du compte des joueurs dans une
action opérateur. #716 ajoute aussi le diagnostic au-dessus de l'écran de
changement de compte échoué : le préserver hors Analytics. Les fonctions
opérateur de confidentialité restent dans leurs [runbooks](ACCOUNT_RIGHTS_RUNBOOK.md),
pas dans un nouveau bouton d'exécution SQL arbitraire.

Manques réels : statut durable nouveau/en cours/résolu et lien persistant issue
pour les signatures, pagination exhaustive, export agrégé général, alertes
configurables et tunnel détaillé ne sont **pas** des actions déjà livrées. Les
états « bloqué/libéré/inconnu » décrivent des observations, pas un workflow de triage.

## 3. Cartographie des routes et données

### Routes actuelles et compatibilité

L'application est statique, modules ES natifs, sans routeur d'administration.
Le cockpit est la modale `#adminCockpit` ouverte depuis Compte → Administration.
Les IDs DOM sont des points d'entrée de code, **pas des URLs routables existantes**.
Les filtres et sélections sont en mémoire. `?qa=new&qaFresh=1` est un mode local
de test ; les liens GitHub ouvrent recherche/composition, jamais une API de création.

Proposition B : `/admin/analytics?section=players` et paramètres optionnels
`player`, `session`, `incident`, `days`, `version`. Sections : `overview`,
`players`, `journeys`, `sync`, `support`. Session analytique/diagnostique doit être
typée. Les références joueur/session sont pseudonymes mais sensibles : éviter
emails/tokens/profils dans URL, ne pas charger de ressources tierces transmettant
le referrer, vérifier l'accès côté serveur avant tout détail. À la connexion
administrateur, restaurer le lien autorisé ; hors droits, aucun contenu sensible.

Conserver le bouton historique durant B, branché sur le **même contrôleur**.
Inventorier les favoris/réécritures réellement déployés avant D : le dépôt ne
prouve pas l'existence d'une ancienne URL `/admin/cockpit`. Ne pas inventer une
redirection pour une route supposée. Tester accès direct, reload, retour navigateur,
expiration Auth et publication statique sur l'hébergeur réel. La résolution HTTP
de `/admin/analytics` est un travail B à qualifier dans le publisher, pas une
route déjà existante ni une modification d'hébergement autorisée dans A.

### Sources réutilisables

| Source | Lecteur et données effectives | Producteur / stockage / preuve | Limites et droits |
|---|---|---|---|
| S1 Synthèse + feedback | `lumen_admin_cockpit(p_days)`, `lumen_admin_feedback(p_days)` ; summary/daily/retention, retours max 250 | `lumen_track_event` → `lumen.analytics_events` ; `lumen_send_feedback` → `lumen.feedback` ; migrations `20261005_lumen_admin_cockpit.sql`, `20261007_lumen_cockpit_human_traffic_only.sql` | A, fonctions definer à search_path vide ; période 1–3650 jours ; définitions live consultées |
| S2 Annuaire | `lumen_admin_recent_players(p_limit:250)` ; `lumen_admin_accounts(p_limit:250)` | Analytics, `lumen.users` (appartenance Lumen), `lumen.profiles` pour libellé, `auth.users` pour email/dates ; `20261007_lumen_user_isolation.sql` ; définition live recent_players | Recent : fenêtre 90 j, serveur max 500 ; accounts max 1000 mais client 250 ; aucun total population garanti |
| S3 Dates/état | `lumen_admin_player_observations(text[])`, une lecture batch ≤250 clés | `lumen_commands.admin_player_observations`, reçus `canonical_receipts`, `legacy_receipts`, `wallet_receipts` et `outbox_health` ; `20261025065956_cockpit_activity_dates.sql` | A revérifié dans helper privé ; facade invoker, max par domaine avec index user/date ; pas de payload/reçu/montant exposé |
| S4 Santé/incidents | `lumen_admin_sync_health(p_days)` + helpers `outbox_health_summary`, `diagnostic_summary` | `lumen_record_sync_health` → `public.lumen_sync_health` ; `lumen_record_outbox_health` → `lumen_commands.outbox_health` ; `lumen_record_diagnostics` → `diagnostic_events/preferences/budgets` | A ; santé 1–90 j, détails ≤7 j, 30 signatures et 100 événements globaux ; outbox est état courant non filtré par période |
| S5 Quêtes | `lumen_admin_quest_metrics`, helper privé `quest_analytics` | Analytics + `lumen_commands.quest_rules` ; `20261023181918_quest_analytics_identity.sql`, remplacée pour metrics par `20261025191634_cockpit_furthest_quest.sql` | A ; friction/tunnel sur période ; `current_players` point max observé à vie pour ≤1000 joueurs récents, pas une sauvegarde complète |
| S6 Sessions | `lumen_admin_player_sessions(p_player_key)` | Helper privé, événements analytics ≤100/90 j et diagnostics ≤100/7 j consentis ; `20261025065959_cockpit_player_sessions.sql` | A + appartenance exacte ; `partial:true`, pas de jointure temporelle entre deux IDs session ; UI refuse clés anonymes |
| S7 Support | `lumen_support` actions list/download/purge côté admin ; activation/upload/revoke côté propriétaire | `lumen_commands.support_control/cases/captures/contents/access` ; `20261025200603_temporary_support.sql` | A + contrôle activé, cible/compte/expiration vérifiés ; stockage privé RLS, pas de bucket public ; consentement distinct |
| S8 Catalogue/diagnostic local | Catalogue canonique, attempt engine, anneau diagnostic local, exports existants | `src/campaign/admin-catalogue.js`, `src/persistence/diagnostic-reporter.js`, récupération locale ; documentation #534/#574 | Catalogue sans données joueur ; diagnostic local ≠ télémétrie serveur exhaustive ; aucun profil à charger pour compter les quêtes |

Migrations S4 : `20261017181513_sync_health_incident_tracking.sql`,
`20261022082203_outbox_health_observations.sql`,
`20261023103114_diagnostic_incident_mvp.sql`,
`20261023104105_diagnostic_batch_identity_guard.sql`.
Les anciennes RPC `lumen_admin_players`, `lumen_admin_player_timeline` et
`lumen_admin_quest_timeline` existent dans l'historique mais ne sont pas appelées
par le chargeur actuel : ne pas les choisir pour reconstruire un annuaire parallèle.

### Objets historiques et contrôle d'accès observé

`lumen.player_analytics` est une **vue** sans RLS propre, sans
`security_invoker` déclaré et sans grant de lecture aux rôles clients dans les
métadonnées observées. Elle agrège par navigateur, rattache au dernier utilisateur,
compte des événements legacy et contient des plages numériques historiques de
constellations : ce n'est pas la source générique pour le catalogue actuel.
`public.lumen_admin_player_snapshot` est une **table** RLS, avec SELECT authenticated
(à qualifier avec sa politique), pas la vue supposée dans l'ancien texte de #534.
Le code actuel n'en fait pas de lecture directe. Ne pas réactiver ce cache ou
exposer la vue pour servir Analytics. Inventaire SQL versionné incomplet :
`20261007_lumen_admin_player_identity_rollup.sql` est une note, pas le DDL complet.
Reproduire les définitions nécessaires sur une base jetable avant B.

Les RPC admin examinées ont un contrôle vivant A, search_path vide et pas de
secret côté client. S3/S6/support sont des façades invoker avec helper privilégié.
Les ACL live de `lumen_admin_recent_players` permettent aussi EXECUTE à PUBLIC/anon,
mais **le corps refuse** absence d'Auth/capacité : ce grant ne démontre pas une
fuite. Dette de durcissement à traiter avec tests de refus, sans présumer d'un
accès aux lignes. RLS active et absence de grants client sur `analytics_events`
et `lumen_sync_health` ont été constatées ; les permissions du snapshot ne sont
pas une autorisation de réutilisation. Pas de recette de refus HTTP exécutée dans A.

Aucune Edge Function n'est appelée par les lecteurs du cockpit : appels PostgREST
RPC directs avec la session existante. Les fonctions du dépôt `lumen-auth-mail`,
`lumen-soldezen-auth-email` et `lumen-self-erasure` restent périphériques Auth/droits
des personnes, jamais un nouveau service d'agrégation. Le projet Auth est partagé :
ne pas compter ou exposer tous les utilisateurs du projet comme joueurs Lumen.

## 4. Contrat des KPI : disponible ne signifie pas exhaustif

Règles communes proposées : heure de requête et dernière observation affichées
séparément ; calcul quotidien **UTC explicite** à fixer dans les futurs agrégats,
affichage lecteur local + UTC en détail. Les SQL historiques utilisent
`current_date`/`::date` selon fuseau DB, pas une garantie UTC issue du client.
Conserver les définitions historiques sous un badge « définition legacy ».
Nommer/versionner le contrat de lecture `analytics-read-v1` à son introduction,
sans prétendre qu'un tel champ existe aujourd'hui. Afficher source, unité,
dénominateur, fenêtre, couverture/échantillon, âge et version ; `unknown` reste
un groupe séparé. Sans observation, afficher « indisponible/non instrumenté ».

**Collecte produit actuelle désactivée** : `createAnalytics` exige
`environment.analyticsAllowed() === true`, et son appel dans `game-screen.js`
ne fournit pas ce provider. Ce fait est documenté dans PRODUCT_ANALYTICS.
Les appels source décrivent des intentions d'émission, pas des événements
actuellement envoyés. A n'a pas mesuré les volumes ni les dates de données live.

| KPI / unité | Calcul et dénominateur existants ; source | Fenêtre / fraîcheur | Usage immédiatement possible et limite |
|---|---|---|---|
| Joueurs uniques / identité mappée | DISTINCT player_key dans S1 ; nombre brut, pas de dénominateur | p_days glissants ; lecture à la demande | Historique seulement ; mapping au dernier compte du navigateur, incohérent avec S5 ; pas « nombre total de joueurs » |
| Nouveaux / revenants | S1 : première observation par anonymous_id, bool_or des navigateurs nouveaux par player_key / autres actifs | Première observation à vie, activité dans p_days | Pas nouveaux comptes ni première partie certaine ; nouveau navigateur peut rajeunir un compte |
| DAU / WAU / activité quotidienne | S1 DISTINCT player_key aujourd'hui / 7 j / date ; comptes bruts | Restreint aussi par p_days : WAU tronquée si p_days<7 | Ne pas appeler usage de jeu : `session_start` passif inclus. MAU n'est pas une clé actuelle ; unique_players avec 30 j fournit seulement un proxy d'identités observées |
| Sessions / événements début-fin | S1 DISTINCT session_id ; compte des événements canoniques **ou** legacy | p_days ; historique | Ne pas sommer `attempt_completed` et `puzzle_complete` comme tentatives uniques ; double émission possible au même résultat |
| Rétention J1/J3/J7 / navigateur | S1 : navigateurs avec événement exactement N jours après première date / cohort de premières dates entre current_date-p_days et hier | Cohorte commune aux trois taux ; lecture historique | Calcul existant mais inclut des cohortes sans recul J7 ; ni rétention compte multi-appareils ni rétention jeu. Corriger maturité et fournir n/N avant usage décisionnel |
| Comptes et créations / compte Lumen | S2 création/Auth via auth.users joint à lumen.users ; pas un COUNT global | Liste client ≤250, sans filtre p_days dans accounts | Consultable maintenant ; **total comptes/nouveaux comptes sur période non exposé**. Ne jamais compter les lignes de cette page comme total |
| Point atteint / joueur | S5 max ordinal catalogue vu dans ouverture/début/fin à vie | Population bornée par récence ; âge activité S2 | Disponible comme observation ; pas % de quêtes résolues, pas badges/solde confirmés |
| Quêtes jouées et complétion / quête | S5 DISTINCT joueurs début et fin ; completed/started, dénominateur joueurs ayant commencé dans la fenêtre | p_days ; historique | Ce n'est pas une cohorte de tentatives appariées : fin d'un début antérieur peut dépasser 100 %. Montrer n/N et limite, pas un taux de succès causal |
| Réinitialisations, abandons explicites, indices, Vérifier, guidage / événements | S5 compte par stable_quest_id ; bruts, taux futurs par tentative exposée seulement | p_days ; historique | Réutilisable si événement présent. « Abandon » signifie clic confirmé, jamais fermeture ou absence de retour |
| Temps médian actif / événements fin | S5 percentile .5 des active_seconds numériques sur attempt_completed ; N = fins avec durée valide | p_days ; historique, durée manquante exclue | Pas temps officiel pénalisé ni durée de session. Distribution/quantiles non exposés actuellement |
| Tunnel / identités par jalon | S5 comptes distincts ouverture/Q1/tutoriel/Q≥3/Q≥10 ; UI ratios sur première/étape précédente | p_days ; historique | Comptages indépendants sans ordre temporel ; ne pas appeler conversion tutoriel→Q5→constellation, encore absente |
| Activité / Auth / reçus | S2 max analytics ; S3 auth_at et max recorded_at par domaine | Activité ≤90 j annuaire ; Auth/reçus à vie ; lecture actuelle | Trois significations distinctes ; reçu = opération serveur commise, pas ACK/installation navigateur ; aucune date pending ne les remplace |
| Échecs / conflits / impactés | S4 failures=hydration_failed, blocked=réconciliations bloquées ; affected_players distinct comptes sur ces deux catégories | Santé p_days borné à 90 j ; lecture actuelle | Pas tous les flush_failed ; blocked n'est pas un COUNT de tous les CLOUD_CAS_CONFLICT. Sans exposition, pas de taux de sync global |
| Blocages anciens / comptes | S4 premier échec non résolu après dernier hydration_ready, ≥15 min | Historique nécessaire au-delà de fenêtre ; lecture actuelle | Hydratation, pas preuve de perte d'acquis ; répétition n'annule pas l'âge |
| Attentes outbox / comptes | S4 pending_players, critical_players, stalled/recurrent/large_backlogs ; DISTINCT user_id selon état | Dernier état connu par client, **hors filtre période** ; âge visible | Pas journal de commandes, ni preuve d'attente actuelle hors ligne. État ancien reste ancien ; pas de solde ou récompense déduit |
| Signatures et versions / observations | S4 occurrences, sessions, dates ; comparaison S4/S6 | Détails opt-in ≤7 j, signatures top30/timeline100 | Disponible sur échantillon borné ; même épisode multi-version non additif, pas régression statistique sans population exposée |
| Feedbacks / retours | S1 feedback_count et liste 250, fenêtre p_days | Lecture actuelle indépendante de l'analytics produit | Texte libre support, pas télémétrie minimisée ; source de signal qualitatif, aucun taux de difficulté sans exposition |

À créer après accord : progression confirmée agrégée (sans charger tous les
profils), exposition par version, rétention mature, reprise corrélée, distributions
de temps officiel, et taux d'erreurs/aides avec base d'exposition comparable.
Un tri par quêtes les plus commencées est possible sur S5 ; « quêtes difficiles »
doit combiner échantillon, durée, aides/erreurs observées et révision de grille,
jamais utiliser seulement l'estimation de difficulté du catalogue.

## 5. Événements : réemploi et manques confirmés

| Signal souhaité | Évidence actuelle | Décision C, sans activation dans A |
|---|---|---|
| quest_started/completed | `attempt_started` première action, `puzzle_start` ouverture ; `attempt_completed` et legacy `puzzle_complete` ; propriétés stables et run_index | Réutiliser les noms existants, dédupliquer `(attempt_id, run_index, type)` ; pas de deuxième série quest_* |
| hint_used / verify / guidage / erreurs | Appels existants ; attempt properties assistance/mistake, compteurs de fin selon chemin | Aligner les propriétés des chemins sans inventer un nombre d'erreurs à partir d'un booléen ; tests canoniques/legacy/replay |
| Réinitialisation / abandon | `attempt_reset`, `attempt_run_started`, clic confirmé `attempt_abandoned` | Préserver ; session interrompue distincte. Absence de reprise après X jours = mesure de suivi censurée, pas abandon certain |
| Onboarding | `tutorial_complete` accepté par ingestion et lu par SQL ; pas d'émetteur trouvé dans src courant | Instrumenter étapes sémantiques de learning et jalons catalogue, sans changer leur éligibilité ; vérifier un vrai émetteur avant d'afficher complétion |
| Inscription | account_signin_success/failure ; appels `account_offer_*`, `account_email_selected` visibles mais non inclus dans allow-list SQL examinée | Choisir schéma fermé signup/connexion et aligner allow-list ; distinguer première création de compte et reconnexion |
| sky_opened / ranking_viewed | Pas d'émetteur trouvé dans src ; pas dans l'allow-list examinée | Ajouter au canal produit seulement si utile, consentement et déduplication de vue |
| Reprise / durée officielle | attempt_id survit reload/reset ; active_seconds existe ; aucun événement produit de reprise ni mesure officielle versionnée homogène | Transition de reprise explicite, run et grid_revision, durée active séparée du score officiel ; ne pas extraire les sauvegardes privées pour refaire l'historique |
| Santé minimale | Ingestion santé accepte seulement hydration_failed/ready/reconciliation ; résultat/reason fermés | Réutiliser, ne pas envoyer tous les noms locaux comme nouveaux events santé |
| Flush, CAS, outbox, exceptions | `mapCloudDiagnostic` traduit flush_failed/conflict/retry, échecs/replays outbox en codes fermés ; exceptions/guidage opt-in | Réutiliser reporter/health/outbox selon finalité. L'anneau local, le résumé état et le flux détaillé ne sont pas trois journaux interchangeables |
| Étape changement de compte | #715 intégré ; #716 élargit `outcome` via `20261115160000_sync_health_stage_outcome.sql` | Attendre statut/head/schema #716, garder unknown sur anciens serveurs ; aucune application de cette migration dans A |
| Taux sync / convergence / réseaux | Reçus par domaine, état outbox et retry existent ; pas d'exposition complète, ACK navigateur apparié ou historique complet de transitions | Définir opération/domaine/compte et délais avec censure offline avant instrumentation ; Wi-Fi/cellulaire inconnus si API non fiable, pas d'inférence depuis user-agent |

Le canal produit existant est un appel RPC par événement, sans file durable de
batch/déduplication/retry comparable au reporter diagnostic. Une fonction appelée
en fire-and-forget ne constitue pas un transport fiable. C doit faire évoluer
**ce canal** avec lots, quotas, file bornée, TTL/backoff, purge au retrait et
propriétaire attendu serveur ; aucun second endpoint ou magasin d'événements
concurrent. La télémétrie perdue ne doit jamais retenir une commande de jeu.
Ne pas copier les budgets/consentements support dans le canal produit.

L'agrégat S1 attribue au dernier compte du navigateur, contrairement à S5 qui
privilégie l'user_id explicite puis un rattachement invité seulement non ambigu.
S2 recent_players accepte le traffic_type absent comme human, S1/S5 exigent
human explicite. Ce sont des **écarts confirmés de définitions**, pas une preuve
de contamination des sauvegardes. Avant indicateurs unifiés, aligner une
projection sûre et conserver un bucket non attribuable, avec fixtures navigateur
partagé A→B→A et invité multi-appareils. Pas de réécriture d'événements historiques.

## 6. Architecture proposée et maquettes de structure

```text
Menu Administration existant
  └─ /admin/analytics — authentification et contrôleur communs
      ├─ Vue générale ─────── KPI → détail filtré
      ├─ Joueurs & sessions ─ joueur → sessions → épisodes → événements
      ├─ Parcours & quêtes ── catalogue → quête → observations autorisées
      ├─ Sync & incidents ─── signature → épisodes → session du joueur
      └─ Support & admin ─── feedbacks, dossier consenti, QA, aperçus

Composants actuels → adaptateurs de lecture RPC existantes → mêmes tables
Collecte produit / santé / détails opt-in / support : finalités distinctes
Commandes progression / wallet / sauvegardes : aucune écriture depuis les KPI
```

Un seul état de navigation admin en mémoire : section, période/version, recherche,
tri, joueur, session typée, épisode, expansions. Il est **séparé** du board et de
la progression du jeu ; aucun serialize de cet état dans la sauvegarde. Contrôles
owner/client/capability/génération de requête déjà présents à conserver dans
chaque lecteur et chaque action asynchrone. Perte de capacité ou changement de
compte : effacement immédiat des données admin, annulation logique des réponses
tardives, invalidation des rapports et téléchargements. Chargement différé par
section ; ne plus charger six services pour consulter seulement un aperçu.

Maquettes ci-dessous : structure proposée, **aucune valeur réelle ou simulée**.
Style à reprendre de Lumen (fond céleste sobre, typographie et contrôles actuels),
contenu desktop dense lisible, états textuels associés aux couleurs.

```text
VUE GÉNÉRALE — desktop
┌ LUMEN Analytics              Période [7 j ▾] Version [Toutes ▾] ↻ ┐
│ Générale | Joueurs | Parcours | Synchronisation | Support         │
│ Actualisé …  Couverture …  [Définitions / sources]                │
│ Identités observées │ Activité │ Reçus par domaine │ Alertes       │
│ [indisponible si collecte désactivée ; aucune carte « 0 » factice] │
│ Activité par jour + tableau accessible │ Rétention mature [N]     │
│ Quêtes à examiner [n/N, limites]       │ Incidents récents →      │
└ Chaque indicateur ouvre le détail avec son périmètre conservé ───┘

JOUEURS & SESSIONS
┌ Recherche [pseudo/email] Tri [activité ▾] État [tous ▾] ──────────┐
│ Liste paginée / limites       │ Joueur sélectionné               │
│ Nom, point observé           │ Activité … Auth …                 │
│ Activité / Auth / reçus      │ Reçus Canonical / Legacy / Wallet │
│ Symbole + état + âge         │ ▸ Session analytics [version]     │
│                             │ ▾ Session diagnostic [état]       │
│                             │   ▸ Épisode → événements          │
│                             │   [Rapport] [Dossier support]     │
└ Retour à la liste : recherche, tri, filtres et sélection conservés┘

PARCOURS & QUÊTES
┌ Aventure [▾] Constellation [▾] Quête [▾] Révision [▾] ────────────┐
│ Tunnel [jalon, population, conversion définie, étape inconnue]    │
│ Quête │ débuts │ fins n/N │ durée active/officielle │ aides       │
│       │ resets │ abandons explicites │ erreurs │ échantillon    │
│ Catalogue pliable ; grille/taille/difficulté estimée disponibles  │
│ Quête → évolution/version → sessions autorisées (si attribuables)│
└ Historique conservé, nouvelles mesures absentes signalées ───────┘

SYNCHRONISATION & INCIDENTS
┌ Domaine [▾] État [▾] Version [▾] Âge du signal [▾] ──────────────┐
│ Hydratation │ Conflits observés │ Outbox actuelle │ Couverture    │
│ Signatures [occurrences, sessions, gravité, première/dernière]     │
│ Comparaison versions : volumes, exposition indisponible signalée │
│ ▾ Épisode → chronologie → conseils → joueur/session               │
│ Rapport assaini [relire □] [télécharger] [préparer issue GitHub]   │
└ Pending / échec temporaire / perte avérée : qualifications séparées┘

SUPPORT & ADMINISTRATION
┌ Joueur sélectionné …  | [Changer de joueur] ──────────────────────┐
│ Feedbacks [catégorie / date / quête / texte autorisé]              │
│ ▾ Dossier consenti : référence, dates, captures, octets, audit     │
│   [Télécharger, hash vérifié] [Effacer copies support]             │
│ Outils : [Profil QA ↔ réel] [Reset QA confirmé] [Série perdue QA]   │
│ [Éclats illimités : droit U] [Aperçu maîtrise : après #716]        │
│ Diagnostic/export local : « cet appareil », jamais le joueur distant│
└ Confirmation sensible maintenue ; action refusée après perte droit┘
```

Sur mobile 320–390 px : navigation interne compacte et intitulés accessibles,
une colonne ; la fiche remplace temporairement la liste avec bouton Retour,
pas suppression des filtres. Tables défilantes dans leur conteneur et version
textuelle des graphiques ; focus visible, `details/summary`, Escape/retour,
chargement/erreur partielle/vide, mouvement réduit. En ouverture depuis le jeu,
réutiliser pause/focus/retour existants : ne pas recréer ni remplacer la grille.
Une version globale proposée n'est active que si la source sait la filtrer :
comptes Auth et état outbox courant portent une mention hors filtre ; pas de
fausse cohérence en filtrant seulement les cartes côté client.

## 7. Livraison B/C/D, dépendances et critères d'entrée/sortie

Les sous-lots ci-dessous sont des PR petites et ordonnées, **à autoriser après
revue de A**. Pas de merge/déploiement automatique pour ce chantier. Aucune
suppression de l'historique avant recette de parité exhaustive F01–F24.

| PR proposée | Dépendances / changement | Risques et critère de recette bloquant |
|---|---|---|
| B1 Cadre et navigation uniques | Accord A ; relecture main/#716/#711 ; intégrer route statique, entrée Analytics, sections et adaptateurs de composants existants | Accès direct/reload/retour/anciens points d'entrée, desktop/mobile ; refus non-admin/expiré ; aucune seconde liste ou nouvel endpoint |
| B2 Reprise exhaustive des outils | B1 ; F01–F24, y compris QA, catalogue, feedbacks, rapports et support ; #716 fusionnée ou état explicitement adapté avant parité | Tests chaque ligne de matrice ; UI async après compte/droit change ; autorisation U distincte ; support opt-in/hash/purge et originaux intacts ; ancien écran encore accessible comme secours |
| B3 Lectures cohérentes sans nouvelle collecte | B2 ; fixtures identité/traffic, null/erreur partielle, maturité rétention ; rendre explicites définitions legacy et limites | Pas de métriques trompeuses : ne pas annoncer KPI fiable tant qu'écart non résolu ; tests SQL jetables avec n/N attendus ; absence de données ≠ zéro ; pagination et listes bornées documentées |
| C1 Contrat événements et consentement | Accord C ; B3 ; arbitrage confidentialité #316/familles/consentement ; schéma versionné, allow-list, unités/run/revision, exposition | Pas activation implicite de collecte. Fixtures duplicats/canoniques/legacy/replay/challenge/QA, aucune PII ; preuve que retrait bloque l'envoi et purge la file produit |
| C2 Transport produit borné | C1 ; faire évoluer `lumen_track_event` et son stockage existant ; batching, déduplication, TTL, quotas et owner attendu | Offline/reload/quota/réponse perdue/backoff/A→B→A ; saturation jette télémétrie plutôt que sauvegarde ; aucune mutation profile/wallet/outbox métier |
| C3 Parcours, difficulté et rétention | C2 et recul temporel suffisant ; agrégats protégés, jalons du catalogue, temps actif/officiel distincts, reprise censurée | Jeu de référence calculé indépendamment avec cohortes J1/J7 matures, quêtes/révisions stables, dénominateurs et fenêtres identiques ; version inconnue explicite ; pas de backfill inventé des étapes absentes |
| D1 Performance et rétention | C3 ; volumes/coûts mesurés ; politique légale approuvée ; réutiliser prune/cron existants | Charge/pagination/plan SQL, budgets requêtes/stockage, purge effective et retard observable ; pas de purge reçus d'idempotence/archives de récupération pour réduire coûts analytics |
| D2 Alertes et versions avancées | D1 ; exposition suffisante ; compléter pipeline existant, déduplication/seuils/hystérésis, triage si validé | Tests incidents simulés, faible n, versions multi-épisodes, anti-bruit ; suggestions GitHub toujours relues ; notifications/rapports IA hors périmètre sans décision séparée |
| D3 Parité et retrait historique | B2/B3/C3/D1/D2 ; recette fonctionnelle exhaustive et accord de retrait | Chaque F marquée migrée + preuve appareil/browser/SHA ; aucun outil oblige à rouvrir cockpit. Redirections des URLs réellement identifiées avec contexte ; retrait markup/contrôleur historique après validation, mêmes sources et autorisations |

Tests à étendre en B : `admin-menu-tests.mjs`, `admin-recent-players-tests.mjs`,
`cockpit-registered-players-tests.mjs`, `cockpit-dates-tests.mjs`,
`cockpit-sessions-tests.mjs`, `cockpit-acceptance-tests.mjs`,
`incident-investigation-tests.mjs`, `support-tests.mjs`, puis navigateurs existants
`cockpit-browser.mjs`/`incident-investigation-browser-tests.mjs` et
`support-browser.mjs`. Après intégration #716 : `test-tools-tests.mjs`,
`admin-preview-browser-tests.mjs`, `account-switch-browser-tests.mjs` et fixture
`sync-health-stage.sql`. C : `analytics-tests.mjs`, tests transport/identité,
fixtures SQL d'agrégats/RLS ; S3/S6 : fixtures cockpit-dates/sessions/furthest-quest.
Ces noms sont des dépendances de recette future, **pas des tests exécutés dans A**.

Pour code/UI/collecte : test contract dans même PR, `test:affected` pendant
correction puis gates complets et navigateurs/SQL imposés par [TESTING](TESTING.md).
Changements gameplay éventuels : runHintTests complet et audit catalogue strict,
jamais remplacés par des mocks analytics. Les lots prévus n'ont aucune raison
de modifier les contrats de sauvegarde ou les règles de jeu.

Checklist de recette fonctionnelle future, attachée au SHA exact :

| Appareil / contexte | Reproduction et résultat attendu | État dans A |
|---|---|---|
| Desktop navigateur, 1440 px | Chaque F01–F24 dans Analytics, recherche → joueur → sessions → incident → retour avec contexte | Non testé, conception seulement |
| Mobile réel PWA Android + desktop, deux comptes | A→déconnexion→B→A, aucune donnée admin ni action tardive conservée ; session Auth persistante ≠ connexion nouvelle | Non testé |
| Mobile 320–390 px et paysage, clavier/lecteur d'écran réel | Repli indépendant, filtres lisibles, focus/retour, pas de perte d'action ; reduced motion | Non testé |
| Réseau dégradé/hors ligne puis reconnexion, multi-appareils physiques | Pending conservé, dates reçus inchangées avant commit, état ancien qualifié ; collecte non bloquante | Non testé |
| Auth HTTP + PostgreSQL jetable | Invité/non-admin/capacité expirée/cible autre app refusés ; dates et agrégats exacts sur fixtures | Non testé dans A ; inspections statiques/métadonnées seulement |
| Support consenti sur téléphone réel | Activation/envoi/récupération/retrait/expiration/purge, refus après retrait, originaux intacts | Non testé dans A, limites #574 maintenues |

## 8. Volumétrie, protection des données et exploitation

Hypothèse de dimensionnement de #708 : 10 000 joueurs ×20 événements/jour =
200 000/jour, **6 millions/mois de 30 jours**. À 0,5–1,5 KiB/événement (hypothèse
incluant enveloppe, hors index), environ 3–9 GB/mois décimaux ; rétention 30–90 j
≈3–28 GB de données brutes, avant index, WAL, sauvegardes et marge. Ce ne sont
ni volumes mesurés ni tarifs fournisseur. Formule de budget : stockage retenu +
index/backups + CPU ingestion/agrégation + invocations + egress des vues/exports.
Lots de 20 événements : ≈300 000 RPC/mois au lieu de 6 millions à un appel/event,
à mesurer avec quotas et latence réels ; aucune promesse tarifaire sans mesure.

Ne pas calculer des tableaux de bord en chargeant tous les profils. Réutiliser
index date/identité/event et catalogue stable ; mesurer EXPLAIN sur données
synthétiques à 200k/j puis 10×, fenêtre 7/30/90 j, concurrence admin, pagination
et purge. Budget proposé à valider en D : première section utilisable <2 s,
lecture agrégée p95 <1 s au scénario nominal, requêtes/capture et file client
bornées ; si échec, revoir agrégation incrémentale/idempotente et index avec plan
mesuré. Publication `generated_at`, couverture et retard des agrégats nécessaires.
Les requêtes à vie S1/S5 et synthèse globale bornée en sortie mais non en scan
sont des risques identifiés ; LIMIT 100/250 ne garantit pas faible coût SQL.

Rétention existante : détails diagnostic 7 j, anciennes observations santé résolues
30 j en purge bornée, observations outbox confirmées anciennes 30 j ; conserver
incidents non résolus et ancre ready nécessaires. Support : activation 24 h,
purge du dossier à partir de 6 j par cron quotidien, refus d'accès à 7 j, audit
7 j, sous réserve de cron effectif ; voir SUPPORT_574 pour limites. Ne pas porter
les détails à 90 j sous prétexte qu'une période UI le permet. Politique produit
30–90 j et agrégats plus longs : **proposition à arbitrer**, pas règle active.
Respecter [proposition confidentialité](PRIVACY_RETENTION_PROPOSAL.md), effacement,
restauration de backups suivie de purge et projet Auth partagé.

Trois consentements/finalités restent séparés : analytics produit facultative,
diagnostics facultatifs minimisés et assistance privée explicite ; santé minimale
requise distincte. Pas de session replay/PostHog, secrets, email ou texte libre
dans les nouveaux events. Email de l'annuaire et texte des feedbacks restent
dans leur lecture admin autorisée ; dossier support jamais dans un export
d'incident ou un agrégat. Triage/audit des consultations globales à définir ;
l'audit support existe déjà. Aucun accès opérateur ne doit devenir un outil de
réparation automatique des sauvegardes.

## 9. Validation et décision attendue

Lot A : contrôle des chemins/liens locaux, cohérence documentaire et revue des
contrats préservés, `git diff --check`. Les tests applicatifs, navigateur, SQL
sur fixtures, charge et appareils physiques ne sont pas exécutés : aucun code,
contrat d'exécution, commande ou ownership n'est modifié. Les gates GitHub
documentaires restent obligatoires selon la sélection existante, sans modifier CI.

Résultats locaux du 15/11 : `scripts/docs-consistency-check.mjs` réussi via
Node installé (`C:\Program Files\nodejs\node.exe`, absent du PATH de la session),
16 liens Markdown locaux des trois documents et 20 références source/migrations
de l'audit résolus ; migration candidate #716 exclue du contrôle sur main et
vérifiée sur sa branche distante. `git diff --check` réussi. Revue des contrats :
aucun changement exécutable, règle de jeu, données persistées, consentement ou
permission. CI PR à constater séparément, sans la présumer réussie.

Onboarding impact : aucun changement exécutable ou texte joueur dans A.
L'intégration du menu admin ne justifie pas de réenseigner le jeu ; C devra
contrôler les points d'émission sur les étapes learning sans changer leur règle.
Les documents Gameplay/Progression/UX/cloud n'ont pas besoin de nouvelle règle
pour ce lot documentaire ; les contrats restent leurs sources de vérité.

Livraison : PR liée par **Refs #708**, sans fermeture, fusion ou déploiement
automatique. Après checks, A peut être « To be tested / revue documentaire » ;
#708 reste ouverte, B/C/D non commencés et recette produit non démontrée.
L'approbation attendue porte sur la navigation unique, la matrice de parité,
les limites KPI et l'ordre B/C/D. Aucune décision de conception n'autorise
implicitement une migration, l'activation du consentement ou le retrait du cockpit.
