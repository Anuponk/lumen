# Assistance, diagnostics et cockpit — chantier E (#959 #960 #1020 #708 #848)

Chaîne visée : **joueur → signalement → diagnostic → analyse admin → réponse → notification joueur → résolution**.
Migration unique et additive : `supabase/migrations/20261126200000_assistance_loop_chantier_e.sql` (aucune nouvelle table).
Fixture SQL : `scripts/fixtures/assistance-loop-chantier-e.sql` (CI `canonical-ledger`, migration appliquée deux fois).

## 1. Entrée unique et diagnostic (#959, #960)

- **« Signaler un problème »** est l'unique entrée d'envoi. Elle regroupe bug, question et suggestion.
- **Bug** : la case **« Envoyer les données nécessaires au diagnostic »** est obligatoire et jamais précochée. Le texte indispensable au consentement reste visible sous la case. La durée et les destinataires sont dans l'infobulle ⓘ. Le paquet minimal comprend :
  - le contexte (version, appareil, quête, écran, session d'onglet) ;
  - le journal de synchronisation (60 événements au plus, #1010) ;
  - l'**instantané du moment** (`src/ui/report-snapshot.js`) : grille courante encodée en chiffres, état de la tentative (chrono actif, pénalités/aides, qualifiante, resets), écran ou menu ouvert, connexion, hydratation, opérations en attente par domaine, dernier succès et dernière erreur du journal, saturation du stockage.
  - L'instantané est pris **à l'ouverture du formulaire**, à partir de la mémoire et du stockage local, **sans aucune requête Supabase**. Il ne modifie ni la partie, ni la tentative, ni la progression.
- **Question / suggestion** : contexte de base seulement, sans journal ni instantané. Le serveur applique la même règle : `lumen_send_feedback_v4` ignore journal, instantané et références pour un autre type que `bug`.
- **Copie complète du compte** : seconde option, réservée aux joueurs connectés, jamais précochée.
  - Un aperçu local (« Voir ce qui sera envoyé ») est disponible avant l'envoi.
  - Le dossier d'assistance de 24 h est activé **avant** le signalement. Le signalement garde ainsi une **référence** (`support_case_id`, `support_capture_id`) à la capture exacte, sans copier son contenu.
  - La référence n'est conservée que si le dossier appartient à l'appelant.
- **Hors ligne** : le signalement et son instantané restent en brouillon (`queued`). Un seul nouvel essai silencieux part au retour du réseau. Le joueur n'est averti du succès qu'après le reçu du serveur.
- **Visiteur** : le formulaire prévient avant l'envoi que la réponse ne sera visible que sur cet appareil.
- **« Données et confidentialité »** (ancien « Données et diagnostic ») conserve :
  - les consentements ;
  - l'activation de 24 h pour les captures d'incident ;
  - le statut et la référence ;
  - la relance d'une copie en échec ;
  - la désactivation avec effacement.
- La parité avec l'ancien envoi « Transmettre mon diagnostic » est assurée par « Signaler un problème » : même session d'assistance, aperçu local, référence de capture fixée. Le bouton d'envoi redondant du panneau et sa revue sont donc supprimés. Les explications détaillées sont repliées.

## 2. Réponses aux joueurs (#1020)

Arbitrages du propriétaire (24/11/2026) :

- l'échange est limité au signalement concerné ;
- une réponse du joueur rouvre le signalement (« En cours ») ;
- aucun email en V1 ;
- un visiteur lit la réponse sur le même appareil.

| Élément | Contrat |
|---|---|
| Stockage | `lumen.feedback.thread` (au plus 30 messages de 2 000 caractères et 80 Ko), `answered_at` et `player_read_at` dans la **même ligne**. L'effacement de compte et la rétention de 180 jours après résolution s'appliquent donc sans changement. |
| Statuts | `new` Reçu, `reviewed` En cours, `answered` Réponse disponible, `closed` Résolu (`fixed` historique = Résolu). La **lecture** (`player_read_at`) est distincte du **traitement**. |
| Joueur | `lumen_my_feedback` lit ses propres signalements : connecté par `auth.uid()`, visiteur par (`anonymous_id`, référence secrète du brouillon ≥ 16 caractères, issue de `crypto.getRandomValues`). Au plus 20 éléments sur 365 jours. `p_summary` ne renvoie que le compteur ; `p_mark_read` marque comme lues les réponses affichées. `lumen_feedback_reply` est idempotent par référence de message, limité à 5 messages par heure et par signalement. |
| Admin | `lumen_admin_feedback_inbox` : pages de 30 par clé, filtres statut/catégorie/joueur, compteurs. `lumen_admin_feedback_detail` : journal, instantané, échange, état de la capture **par références**. `lumen_admin_feedback_reply` : idempotent, « Répondre » ou « Répondre et résoudre ». `lumen_admin_feedback_set_status`. Tous exigent `analytics_cockpit`. |
| Notification | Pastille discrète sur Mon espace et compteur sur « Mes signalements ». Un résumé est lu à l'ouverture de Mon espace (au plus toutes les 10 min) et une fois par session, 8 s après le démarrage. Pas de polling, pas de Realtime, rien d'affiché pendant la quête. |

État de la copie complète dans le détail admin : `none`, `pending` (< 1 h), `received` (date, octets), `failed`, `expired` (dossier disparu), `deleted` (révoqué ou purgé). Le contenu n'est accessible que par le **dossier d'assistance** existant (#574), avec ses règles d'accès et d'expiration.

## 3. Cockpit : santé des joueurs (#708, tests 3 et 4)

**Causes confirmées en lecture seule en production le 24/11 :**

1. *Dernière activité 25/10.* Elle provenait de `lumen.analytics_events`, dont la collecte publique est coupée depuis le 25/10 (0 événement en 7 jours), alors que les reçus de quêtes du joueur dataient du jour même.
2. *« ? Signal ancien ».* `admin_player_observations` calculait la fraîcheur sur la plus **ancienne** ligne `outbox_health` de tous les appareils. Le premier appareil du compte observé datait du 04/11, donc le seuil de 15 minutes n'était jamais respecté.

**Nouveau contrat** : `lumen_admin_player_health` fait une seule lecture bornée (250 clés, 5 appareils par joueur). Le verdict est calculé par `src/ui/player-health.js` :

- **En difficulté** : sauvegarde `critical`/`review`, ≥ 3 échecs, reconnexion nécessaire avec opérations, stockage saturé ou en erreur (7 j), ou chargement du profil en échec non résolu (30 j, hors réseau). L'ancienneté de l'observation n'efface pas ces états.
- **En attente** : opérations non confirmées sans échec durable.
- **Sain** : dernière observation de chaque appareil sans anomalie, quelle que soit son ancienneté.
- **Non évalué** : aucune observation technique. Un reçu de quête prouve le jeu, pas la santé technique.
- La **fraîcheur** (« Dernier contrôle », date et ancienneté) est une colonne à part.
- **Dernière quête** = dernier reçu canonique ou legacy (quête terminée et reçue par le serveur). Ce n'est jamais une connexion Auth, une requête de fond ou un événement analytique. En l'absence de reçu, la cellule affiche « Aucune observée ».

Présentation (arbitrage : tableau dense, triable et filtrable) :

- colonnes Joueur, Santé et raison, Dernière quête, Progression, Attente, Web, Android, Dernier contrôle, Signalements, « Voir le diagnostic » ;
- filtres à compteurs (Tous, En difficulté, En attente, Non évalués, Sains), recherche et « Signalements ouverts » ;
- tri par colonne (`aria-sort`) ; filtres, tri et recherche conservés au rafraîchissement ;
- la fiche joueur s'ouvre par une **synthèse**, avec les détails techniques repliés.

Parcours couverts :

- incident → joueurs concernés (filtres « En difficulté » / « En attente ») ;
- joueur → sessions, épisodes et dossier ;
- joueur → signalements, et signalement → joueur ou dossier d'assistance exact ;
- retour au signalement : la liste reste filtrée.

« Simuler une série perdue » : l'outil n'existe plus dans le code ni dans l'interface, car les séries de lumière ont été retirées (#752). Il n'est pas réintroduit.

## 4. Versions Web et Android (#848)

- **Web** : version et SHA de build sont déjà envoyés par l'observation d'appareil existante (`outbox_health.app_version`, corrigée par #986). La dernière version vue par horodatage s'affiche dans le cockpit.
- **Android natif** : `LauncherActivity.getLaunchingUrl()` ajoute `#lumen-native=<versionName>+<versionCode>` (`NativeVersion.java`).
  - Un **fragment** est utilisé, et non une query : le shell hors ligne reste en cache (`sw.js` n'accepte que le document sans query) et la valeur n'atteint jamais un serveur.
  - Le jeu lit cette valeur une fois, l'enlève de l'URL et la garde en `sessionStorage`. Un onglet Chrome partage le `localStorage` de l'application installée et ne doit pas se déclarer natif.
  - La valeur part avec l'observation existante (`p_native_version`, surcharge à 15 arguments) **seulement quand elle change**.
  - Côté serveur, `native_version` est conservée par appareil, et une session navigateur (`null`) ne l'efface pas.
  - Aucune version n'est déduite d'un user agent.
  - Rien ne passe par le profil CAS, l'outbox métier ou le wallet.
- **Nouvel AAB requis** pour la partie native. La publication Google Play n'est pas automatique. Ne pas déclarer la remontée native fonctionnelle avant un essai sur un appareil équipé de cet AAB.
- Limite : une ligne `outbox_health` confirmée est purgée 30 jours après sa confirmation. La dernière version Android d'un appareil inutilisé depuis plus de 30 jours disparaît donc.

## 5. Permissions et confidentialité

- Fonctions joueur (`anon`, `authenticated`) : `lumen_send_feedback_v4`, `lumen_my_feedback`, `lumen_feedback_reply`. Elles n'accèdent jamais aux signalements d'un autre compte ou d'un autre appareil (fixture : accès croisé refusé, référence seule insuffisante, référence courte refusée).
- Fonctions admin (`authenticated` et vérification serveur de `analytics_cockpit`) : `lumen_admin_feedback_inbox`, `lumen_admin_feedback_detail`, `lumen_admin_feedback_reply`, `lumen_admin_feedback_set_status`, `lumen_admin_player_health`. `anon` n'a aucun droit d'exécution sur ces fonctions.
- Assistants privés : `sanitize_feedback_snapshot`, `feedback_owned`, `feedback_capture_state`, `require_cockpit`.
- L'instantané passe par une liste blanche : noms de clés, scalaires, un niveau d'imbrication, grille en chiffres, 8 Ko au plus. Il ne contient ni texte libre, ni e-mail, ni jeton, ni identifiant de tentative ou d'appareil.
- Les textes des joueurs et des administrateurs sont rendus avec `textContent` (test navigateur anti-injection).

## 6. Budget Supabase Free-first

Hypothèses :

- 1 à 3 % des joueurs actifs envoient un signalement par jour ;
- 2 à 5 consultations du cockpit par jour ;
- les joueurs connectés ouvrent Mon espace environ 2 fois par session.

Mesures de production du 24/11 : 32 comptes, 62 lignes d'appareil (~500 o chacune), 8 signalements (journal moyen 5,5 Ko). Les autres valeurs sont des **estimations**.

| Parcours | Avant | Après |
|---|---|---|
| Envoyer un signalement | 1 RPC (v3) avec journal pour tous les types | 1 RPC (v4). Bug : + instantané ~0,6–1,5 Ko. Question/suggestion : **−5,5 Ko** (sans journal). Copie complète inchangée (activation + capture). |
| Ouvrir le cockpit (liste joueurs) | 10 RPC + 1 observations ; feedbacks : 250 lignes complètes | 9 RPC + 1 boîte de réception (30 lignes sans données lourdes) + 1 santé. Santé ~30 Ko pour 32 comptes, ~250 Ko au pire pour 250 comptes × 5 appareils. |
| Consulter un diagnostic | 1 RPC journal à la demande | 1 RPC détail (journal, instantané, échange, état de capture) ; dossier sur dépliage (existant) |
| Consulter / envoyer une réponse | — | Joueur : 1 résumé (< 200 o) au plus toutes les 10 min, 1 liste à l'ouverture, 1 envoi. Admin : 1 RPC. |
| Écriture des versions | — | 0 requête supplémentaire : le champ natif accompagne l'observation existante, écrite seulement au changement. |
| Stockage | — | Bug : instantané ~1 Ko ; échange typique < 2 Ko (plafond 80 Ko) ; 2 colonnes par appareil |

Ordre de grandeur des résumés « Mes signalements » : environ 300, 1 500 et 3 000 petits appels par jour pour 100, 500 et 1 000 joueurs actifs connectés. Ajout de stockage pour 1 000 joueurs actifs : environ 30 signalements par jour × 2–3 Ko, soit **< 30 Mo par an** avant rétention.

## 7. Migration, dépendances et rollback

- Dépendances : `lumen.feedback` (v2/v3, rétention et effacement), `lumen_commands.support_*` (#574), `outbox_health` (#962), `public.lumen_sync_health`, reçus canoniques, legacy et wallet.
- La migration est additive et idempotente : colonnes nullables, contrainte de statut élargie, surcharges, aucune donnée réécrite.
- Rollback : supprimer les fonctions créées, restaurer le corps précédent de `lumen_admin_feedback_set_status` et la contrainte de statut, puis supprimer les colonnes ajoutées. Le client garde ses replis v3/v2 et 14 arguments sur `PGRST202`.
- Ordre de déploiement : migration en production après CI verte, puis Web. L'AAB est publié séparément.

## 8. Tests

- SQL : `scripts/fixtures/assistance-loop-chantier-e.sql`.
- Unitaires : `report-snapshot-tests`, `player-health-tests`, `native-version-tests`, `cockpit-dates-tests`, `analytics-dashboard-tests`, `beta-feedback-tests`, `admin-recent-players-tests`.
- Navigateur : `beta-feedback-browser-tests` (diagnostic obligatoire, copie jamais précochée, file hors ligne, instantané) ; `incident-investigation-browser-tests` via `cockpit-browser`, `support-browser` et `assistance-browser` (tableau, boîte de réception, « Mes signalements »).
- Android : `NativeVersionTest`.
- Recette sur appareil réel encore nécessaire :
  - TWA avec le nouvel AAB ;
  - Safari iPhone ;
  - PWA Android hors ligne puis reconnexion ;
  - réponse réelle de bout en bout sur deux comptes.
