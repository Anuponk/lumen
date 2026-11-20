# Défi du jour — audit, modèle et contrats (Lot 3, #882 / EPIC #881)

Source de vérité produit : [#882](https://github.com/Anuponk/lumen/issues/882).
Base auditée : `main` @ `59c99014` (Lot 2 en production, `1.11.1+702`).
Ce document fixe les choix techniques de la PR A (moteur quotidien et contrats
serveur). L'expérience joueur et le thème (PR B), puis le bilan et la mesure
(PR C), s'appuient sur ces contrats sans en créer d'autres.

## 1. Audit : besoin → existant → réutilisation → nouveau

| Besoin | Existant | Réutilisé tel quel | Adapté | Nouveau |
|---|---|---|---|---|
| Date du jour Europe/Paris, DST | `lumen_get_server_day()` (#752), `daily_progress` = **série d'activité**, pas une grille commune | Horloge serveur `now() at time zone 'Europe/Paris'` | — | Bornes d'ouverture/clôture par jour civil (23 h/25 h aux changements d'heure) |
| Grille commune immuable | Catalogue canonique, révisions de grille 0/1/2 (`canonicalQuestAtGridRevision`) | Moteur de grille, résolution par révision | — | Calendrier déterministe `content/generated/daily-schedule.json` + table `daily_puzzles` |
| Grille d'aventure payante jouable | Mode isolé des défis (#18, #883) | Isolation : aucune mutation de campagne ni de droit | Mode quotidien (PR B) | — |
| Tentative unique, reprise | Moteur de tentative (reset conserve le chrono, #851), reprise #888 (temps serveur) | `attempt-engine`, plan de reprise #888 | Initialisation du chrono au temps serveur écoulé | Ligne `daily_runs` unique par compte et par jour |
| Temps officiel et pénalités | `lumen_commands.official_time` (#638), `rankedTime` client | Formule identique (indice 15 s, vérification et contrôle guidé 5 s) | — | — |
| Classement général | Classements par grille #638 (`ranking_scores`, opération + reçu de victoire de campagne, échos virtuels) | Adhésion et pseudonyme (`ranking_members`, adhésion automatique depuis le 11/11 avec désinscription) | **Pas** les reçus de campagne (une partie quotidienne n'est pas une victoire de campagne) ni les échos virtuels (interdits ici) | Requête de classement sur `daily_runs` |
| Classement entre amis | Amitiés #35 (`social_friend_edges`, état `friends`) | Arêtes acceptées | — | Même requête filtrée (même ligne de résultat) |
| Bilan de la semaine stable | — | — | — | Instantanés `daily_standings` figés à la clôture |
| Activation maîtrisée | `lumen_commands.feature_flags` (#752), capacités `lumen.internal_capabilities` | Drapeau `daily_challenge` (désactivé par défaut) | — | Capacité `daily_preview` (test admin/QA) |
| Effacement de compte | `lumen_privacy.policy()` + `install_guards()` | Même schéma d'enregistrement que #729/#796/#35 | — | 4 tables enregistrées |
| Mesure | #708 (`trackLumenEvent`, collecte publique désactivée) | Dispositif existant | — | Événements de la PR C uniquement |

Aucun nouveau moteur de grille, de classement, d'amitié ou de chronomètre.

## 2. Modèle de données (migration additive `20261122090000_daily_challenge_882.sql`)

| Objet | Rôle | Propriétaire / effacement |
|---|---|---|
| `lumen_commands.daily_puzzles(day, quest_id, grid_revision, source)` | Grille du jour, immuable dès l'ouverture | Règle (`retain-rule`) |
| `lumen_commands.daily_runs(user_id, day, operation_id, quest_id, grid_revision, started_at, status, seconds, hint, verify, guided, score, finished_at)` | **La** tentative officielle : clé primaire `(user_id, day)` | Joueur (`delete`) |
| `lumen_commands.daily_standings(user_id, day, general_rank, general_total, friends_rank, friends_total)` | Rang figé à la clôture, pour un bilan stable | Joueur (`delete`) |
| `lumen_commands.daily_finalized(day, finalized_at)` | Marque de finalisation | Règle (`retain-rule`) |

RLS active partout, aucun droit direct ; accès uniquement par RPC
`SECURITY DEFINER` avec `search_path=''`.

## 3. Règles serveur

- **Jour** : `day = (now() at time zone 'Europe/Paris')::date`. Ouverture
  `day 00:00 Europe/Paris`, clôture `day+1 00:00 Europe/Paris` (jours de 23 h ou
  25 h aux changements d'heure).
- **Commencer** (`lumen_daily_begin`) : compte connecté avec pseudonyme, pendant
  la journée, en ligne. Crée la ligne `(user_id, day)` avec `started_at` serveur ;
  un second appel (rechargement, autre appareil, requête simultanée) renvoie **la
  même ligne** et le même `started_at`. Le client reprend au temps serveur écoulé
  si sa tentative locale n'existe pas (#888). Hors ligne : aucune tentative
  classée ne peut commencer ; l'entraînement reste possible.
- **Terminer** (`lumen_daily_finish`) : une seule fois, même identifiant
  d'opération. Le temps déclaré est borné par le temps serveur écoulé depuis
  `started_at` (+5 s). Le score est calculé par `official_time`. Une deuxième
  soumission renvoie le résultat déjà figé sans le modifier. Délai maximal :
  6 h après le début ; au-delà, la tentative est close sans classement.
- **Abandon** : statut `abandoned`, jamais classé, définitif pour le jour.
- **Entraînement** : toute partie après la tentative officielle reste
  **locale et non classée** ; aucun appel serveur ne peut modifier le résultat.
- **Cooldown #889** : non appliqué (la règle « une tentative par jour » le remplace).
- **Classements** (`lumen_daily_board`) : une seule source (`daily_runs` terminées).
  Général = joueurs participant au classement (`ranking_members.participating`)
  + soi-même ; Amis = soi-même + amis acceptés participants. Rang
  `rank() over (order by score)` : égalités au même rang, ordre d'affichage
  déterministe. Réponse : participants réels, top 3, position personnelle,
  pseudonymes publics et temps seulement (ni email, ni UUID).
- **Finalisation** : à la première lecture après `clôture + 6 h`, les rangs
  général et amis de chaque participant sont figés dans `daily_standings`. Un
  changement d'amitié, une désinscription ou un effacement ultérieur ne modifie
  pas un bilan passé.
- **Semaine** (`lumen_daily_week`) : lundi→dimanche Europe/Paris contenant la
  date demandée ; pour chaque jour, ma tentative et mes rangs (figés si
  finalisés, sinon « provisoires »). Aucun jour manqué n'est pénalisé.
- **Activation** : drapeau `daily_challenge` à `false`. Tant qu'il est faux,
  seuls les comptes ayant la capacité `daily_preview` ou `analytics_cockpit`
  peuvent jouer en classé ou consulter les classements (recette). La
  prévisualisation et le remplacement d'une grille future (sans tentative) sont
  réservés à ces comptes.

## 4. Calendrier des grilles

`node scripts/daily-schedule.mjs` génère un calendrier **append-only** depuis le
lundi 23/11/2026 : pool = quêtes canoniques « Intermédiaire » ou « Avancé »
(7×7 et 8×8, ordinal > 11), permutation déterministe par empreinte SHA-256,
aucune répétition avant épuisement du pool (294 grilles), jamais deux jours de
suite dans la même constellation. Chaque entrée fige `(questId, gridRevision)`.
`--check` refuse toute modification d'un jour déjà publié. La migration copie ce
calendrier dans `daily_puzzles`.

## 5. Limites anti-triche (documentées, non résolues)

- Le temps actif et le nombre d'aides restent déclarés par le client. Le serveur
  borne le temps : jamais négatif, jamais plus long que le temps écoulé depuis
  son propre `started_at` + 5 s. Un client modifié peut donc annoncer un temps
  plus court que la réalité (les pauses légitimes rendent la durée active
  invérifiable). La solution n'est pas vérifiée par le serveur, qui ne connaît
  pas les solutions.
- Un compte peut être recréé ; un joueur peut voir la grille avant de commencer
  (en entraînement invité). Le classement reste ludique et non doté.

## 6. Points à arbitrer avant activation publique

1. **Visibilité générale** : le défi du jour réutilise l'adhésion automatique
   des classements (#638, désinscription possible). Confirmer qu'elle couvre
   aussi le classement quotidien, et l'information affichée au joueur.
2. **Mineurs** : règle d'âge ou d'exclusion du classement général.
3. **Désinscrits dans « Mes amis »** : implémentation prudente = exclus partout
   (sauf de leur propre vue). Confirmer.
4. **Bande de difficulté** : « Intermédiaire + Avancé » proposée.
5. **Date de première ouverture** (le calendrier commence au 23/11/2026).

## 7. Tests et retour arrière

- Node : `daily-challenge-tests.mjs` (jour Paris et changements d'heure, semaine,
  pool, calendrier append-only et reproductible, grille figée, contrat de la
  migration) ; `node scripts/daily-schedule.mjs --check`.
- SQL réel (CI `ledger-sql`, migration appliquée deux fois) :
  `fixtures/daily-challenge-882.sql` (désactivation par défaut, même grille,
  tentative unique et reprise, bornes de durée, pénalités, résultat immuable,
  égalités, top 3 et position, amis et désinscrits, absence d'écriture de
  campagne, jours de 23/25 h, finalisation stable, semaine, administration,
  droits, effacement) ; `daily-concurrency.py` (6 appareils simultanés, une
  tentative et un résultat) ; `fixtures/daily-rollback-882.sql` (répétition du
  retour arrière).
- **Retour arrière** (après retrait du client, et seulement si aucune migration
  ultérieure n'a renommé `lumen_privacy.policy()`) : supprimer les RPC et
  fonctions `daily_*`, restaurer `policy_before_daily_challenge` en `policy`,
  supprimer les quatre tables et le drapeau `daily_challenge`, puis relancer
  `lumen_privacy.review_erasure`. Le SQL exact est celui de
  `scripts/fixtures/daily-rollback-882.sql` (sans le `rollback` final).
- **Production** : aucune migration appliquée sans accord explicite ; le drapeau
  reste désactivé jusqu'à la validation des gates (§6 et #882).
