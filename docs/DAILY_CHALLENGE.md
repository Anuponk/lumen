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

Découverte (#1003) : depuis l'activation du drapeau `daily_challenge`, le client
lit `lumen_daily_today` pour tous les joueurs, invités compris, et le serveur
décide (drapeau ou capacité `daily_preview`). La réponse est mémorisée pour la
journée : jusqu'à `closes_at` quand le défi est ouvert, 6 h sinon, avec une
seule relecture après connexion tant qu'il est fermé (un compte d'aperçu peut
l'ouvrir). Une seule lecture alimente la pastille d'en-tête, « Mes quêtes » dans
Mon ciel et le menu Social. La pastille `#dailyChip` occupe la ligne d'en-tête
existante (aucune ligne ajoutée, grille inchangée, trophée seul sous 430 px). #1013 :
elle suit la charte monochrome des icônes d'en-tête (pictogramme SVG, sans jaune
permanent) ; seul un petit point cyan signale un défi encore à jouer. Son
état « fait » est local (`lumenDailyDoneV1`, écrit à l'affichage du résultat
officiel ou d'un envoi en attente) : il n'ajoute aucun appel et ne change aucune
règle, l'écran du défi restant seul juge de la tentative unique. #898 : « Mes quêtes » dans Mon ciel et le menu Social (qui en reprend le texte) affichent le même état « déjà joué, voir le classement ». Un lien
explicite et une tentative déjà en attente gardent leurs chemins existants.

#1015 (performance) : entrer dans le défi recharge la page. Un défi **ouvert** est
identique pour tous les comptes jusqu'à `closes_at` ; la réponse que la pastille,
« Mes quêtes » ou Social viennent de lire est donc transmise à la page du défi
(`sessionStorage` `lumenDailyTodayV1`), uniquement par un **relais explicite**
(`lumenDailyHandoffV1`, posé par le clic, valable 30 s, consommé une fois).
L'écran du défi lit alors directement le classement, sans `lumen_daily_today`
séquentiel, et le même mémo alimente la pastille (plus de seconde lecture).
Tout autre chargement, un défi fermé ou proche de sa clôture (marge 60 s) relit
le serveur ; un changement de jour serveur au `begin` invalide le cache. Mesure
locale (RPC simulés à 250 ms, 390 px, 9 passages) : part réseau de l'entrée p50
526 → 265 ms, appels `lumen_daily_today` 2 → 0. Le reste du délai ressenti est le
redémarrage complet de la page (entrée et sortie), à traiter séparément.
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
  classée ne peut commencer ; l'entraînement reste possible. Le jour de la
  tentative est celui du serveur **au moment de l'appel** : si la réponse
  porte un autre `day` que la grille chargée (introduction restée ouverte
  pendant le passage de minuit Paris), le client recharge le mode sur le jour
  serveur et reprend cette tentative au temps serveur écoulé ; il ne joue
  jamais la grille de la veille contre la tentative du jour.
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

## 6 bis. Parcours joueur et thème (PR B)

- **Entrée** : « Défi du jour » (pictogramme trophée monochrome, #1013) dans « Mes quêtes » (Mon ciel), visible
  seulement si `lumen_daily_today` répond `enabled` ; date et temps restant.
  Le lien `/?daily=1` ouvre le mode (rechargement, comme les liens de défi).
- **Isolation** : une partie quotidienne est une partie de défi isolée
  (`socialChallenge` avec `daily:true`) et hérite de tous les garde-fous de
  #18 : aucune écriture de campagne, aucun classement #638, aucun badge, aucun
  apprentissage, aucune requalification. Seuls l'introduction, la soumission
  (`lumen_daily_*`) et l'horloge (temps officiel avec pénalités) diffèrent.
  La grille est la révision figée du jour, jouable gratuitement même si elle
  vient d'une aventure non achetée.
- **Introduction** : date, temps restant, « 1 tentative officielle », règles.
  Invité ou joueur sans pseudonyme : explication et entraînement non classé
  uniquement. Compte : « Relever le défi » (ou « Reprendre ma tentative » ;
  autre appareil = chrono au temps serveur écoulé ; minuit franchi pendant
  l'introduction = rechargement sur la grille du nouveau jour). Pas d'entraînement avant la
  tentative officielle pour un compte (la grille ne doit pas être révélée).
- **Résultat** : temps officiel, onglets « Général / Mes amis » (top 3, égalités,
  ma position, participants réels, états vides), zone de hauteur réservée,
  « Mon ciel » action principale (ouvre réellement Mon ciel via le paramètre
  à usage unique `?sky=1`, #1013), « S'entraîner (non classé) », prochain défi
  annoncé. Pas de partage propre au Défi du jour : le même défi est accessible à
  tous (#1013) ; le partage global de Lumen et les autres partages restent. Déjà joué : résultat
  figé, jamais de seconde tentative.
- **Hors ligne** : une tentative classée commence en ligne ; si l'envoi final
  échoue, le résultat est conservé sur l'appareil (`lumenDailyPendingV1`) et
  renvoyé au retour de la connexion ou par « Réessayer l'envoi » (même
  opération, résultat serveur immuable, jamais doublé).
- **Thème** : fond nocturne bleu/violet avec étoiles statiques, bandeau or
  « Défi du jour · date · 1 tentative officielle · fin dans … », cadre doré de la
  grille, accent or ; cases, Gardiens, territoires, marques et aides inchangés
  (vérifié par les styles calculés). Aucune animation ; l'indicateur de Maîtrise
  est masqué (aucun badge dans ce mode).
- **Captures** : `docs/validation/daily-compare-{campaign,daily,result}-{390,1440}.png`.

## 6 ter. Bilan de la semaine et mesure (PR C)

- **« Ta semaine dans les étoiles »** : modale ouverte depuis le résultat
  (« Ma semaine ») ou depuis « Ma semaine ✦ » sous l'entrée *Mes quêtes*
  (comptes connectés uniquement). Source unique : `lumen_daily_week`, résumée
  par la fonction pure `summarizeWeek` (`src/campaign/daily-week.js`).
- **Contenu** : calendrier L M M J V S D (réussi ✓, podium ★, abandonné ✕, en
  cours …, non joué ·, à venir vide ; jour encore provisoire en pointillé),
  participations X/7 (réussis, abandonnés et en cours), meilleur rang général
  (avec total), meilleur rang entre amis (seulement si au moins 2 classés),
  podiums (rang général ≤ 3), premières places entre amis (`friends_total ≥ 2`),
  meilleur temps officiel, faits marquants par jour. Un jour sans rang général
  (désinscription #638) n'invente aucun rang.
- **Provisoire / figé** : « Classements provisoires » tant qu'un jour joué
  n'est pas finalisé (fin du jour + 6 h) ; « Semaine terminée : classements
  figés » quand les 7 jours sont finalisés.
- **Navigation** : semaines passées jusqu'à la première semaine du calendrier
  (`DAILY_SCHEDULE_START`), jamais au-delà de la semaine courante.
- **Mesure** : aucun nouvel événement ni nouvelle collecte. La collecte reste
  soumise à `analyticsAllowed()` (désactivée au lancement familial). Les
  tentatives réutilisent `attempt_started` / `attempt_completed` /
  `attempt_abandoned` (`attempt_mode=challenge`) avec `daily_day` et
  `daily_training`. Les vues réutilisent l'enveloppe existante `app_opened`
  avec `surface=daily` et `daily_action` ∈ `opened`, `board_viewed`
  (`board_scope` général/amis, `board_final`) et `week_viewed`
  (`week_offset`, `week_participations`, `week_frozen`, `source`), sans
  `acquisition_channel`, donc hors tunnel d'acquisition.
- **Captures** : `docs/validation/daily-week-{390,1440}.png`.

## 7. Tests et retour arrière

- Navigateur : `daily-challenge-browser.mjs` (dans la suite de rejeu canonique) : mode désactivé, entrée Mon ciel, invité en entraînement, tentative officielle à 360/390/1440 px, grille figée et cases inchangées, cadre et bandeau visibles, deux classements, reprise sur autre appareil, introduction ouverte pendant le passage de minuit (rechargement sur le jour serveur), résultat figé puis entraînement, envoi différé hors ligne, bilan de la semaine (7 jours, provisoire, aucune donnée d'un autre joueur, aucune collecte `lumen_track_event`). `daily-view-tests.mjs` (rendu et client), `daily-week-tests.mjs` (résumé, navigation, partage, rendu).
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
  retour arrière) ; `fixtures/supabase-default-anon-grants.sql` puis
  `20261122100000_daily_anon_revoke_882.sql` et `fixtures/daily-anon-revoke-882.sql`
  (privilèges par défaut de Supabase reproduits : seul `lumen_daily_today` reste
  appelable par un invité).
- **Retour arrière** (après retrait du client, et seulement si aucune migration
  ultérieure n'a renommé `lumen_privacy.policy()`) : supprimer les RPC et
  fonctions `daily_*`, restaurer `policy_before_daily_challenge` en `policy`,
  supprimer les quatre tables et le drapeau `daily_challenge`, puis relancer
  `lumen_privacy.review_erasure`. Le SQL exact est celui de
  `scripts/fixtures/daily-rollback-882.sql` (sans le `rollback` final).
- **Production** : aucune migration appliquée sans accord explicite ; le drapeau
  reste désactivé jusqu'à la validation des gates (§6 et #882). Recette manuelle,
  activation progressive, surveillance et critères de retour arrière :
  [DAILY_CHALLENGE_ROLLOUT.md](DAILY_CHALLENGE_ROLLOUT.md).

## Langue et affichage

L’entrée, l’introduction, le bandeau, le résultat, les deux classements, le bilan hebdomadaire lisent les catalogues FR/EN. Les dates, rangs et pluriels sont formatés dans la langue de l’application. Les pseudonymes et les classements restent ceux renvoyés par le serveur.

Le jour et la semaine suivent toujours le calendrier de Paris. Le changement de langue pendant la grille actualise le bandeau et conserve la tentative et son chrono. Les aides partagées avec la campagne suivent la couverture du [chantier multilingue](https://github.com/Anuponk/lumen/issues/754).
