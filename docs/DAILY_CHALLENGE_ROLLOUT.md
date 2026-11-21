# Défi du jour : recette, activation et retour arrière (#882)

Contrat technique : [DAILY_CHALLENGE.md](DAILY_CHALLENGE.md). Ce document est le
plan opérateur. Il ne vaut **ni** accord de migration en production, **ni**
activation du drapeau `daily_challenge` : chaque étape marquée 🔒 exige l'accord
explicite du propriétaire.

## 1. État de départ (audit du 21/11/2026, `main` @ `5bd2e30f`)

| Élément | État vérifié |
|---|---|
| PR #899 (moteur, SQL), #902 (parcours, thème, classements), #904 (bilan, mesure) | Fusionnées, CI complète verte |
| Client en production (o2switch) | Contient le mode ; entrée masquée car la RPC est absente |
| Migration `20261122090000_daily_challenge_882.sql` en production | **Appliquée le 21/11/2026** (éditeur SQL, par le propriétaire) ; contrôles §3 verts, empreinte du calendrier identique à `main` |
| Migration `20261122100000_daily_anon_revoke_882.sql` en production | **Appliquée le 21/11/2026** : `anon` ne peut plus exécuter que `lumen_daily_today` |
| Drapeau `daily_challenge` | `false` |
| Comptes de recette | `daily_preview` accordé à un compte de test ; un second y a accès via `analytics_cockpit` |
| Recette sur appareils réels | **Non effectuée** |

## 2. Prérequis avant migration 🔒

1. Lot 2 en production et recetté (#35, #888, #889) : la migration lit
   `social_friend_edges`, `ranking_members`, `ranking_auto`, `official_time`,
   `feature_flags`, `lumen.internal_capabilities` et `lumen_privacy.policy()`.
2. Sauvegarde ou point de restauration Supabase daté, juste avant.
3. Vérifier en lecture seule que ces objets existent :

```sql
select to_regclass('lumen_commands.quest_rules') is not null as quest_rules,
       to_regclass('lumen_commands.ranking_members') is not null as ranking_members,
       to_regclass('lumen.social_friend_edges') is not null as friends,
       to_regclass('lumen_commands.feature_flags') is not null as flags,
       to_regprocedure('lumen_commands.ranking_auto(timestamptz)') is not null as ranking_auto,
       to_regprocedure('lumen_privacy.policy()') is not null as erasure_policy,
       to_regprocedure('lumen_privacy.policy_before_daily_challenge()') is null as not_yet_chained;
```

La migration est transactionnelle (`begin … commit`) : une grille du calendrier
absente de `quest_rules` ou un objet manquant la fait échouer **sans effet
partiel**.

## 3. Application de la migration 🔒

- Appliquer le fichier tel quel (éditeur SQL Supabase ou `psql -v ON_ERROR_STOP=1`).
  Il est idempotent : la CI l'applique deux fois de suite. Le connecteur MCP
  Supabase refuse cette migration sans confirmation interactive : utiliser
  l'éditeur SQL.
- Appliquer ensuite `20261122100000_daily_anon_revoke_882.sql`. Les privilèges
  par défaut de Supabase accordent `EXECUTE` à `anon` sur toute nouvelle
  fonction de `public` ; révoquer `PUBLIC` ne suffit pas.
- Contrôles immédiats, en lecture seule :

```sql
select enabled from lumen_commands.feature_flags where name='daily_challenge';      -- false
select count(*), min(day), max(day) from lumen_commands.daily_puzzles;              -- 371, 2026-11-23, 2027-11-28
select count(*) from lumen_commands.daily_runs;                                     -- 0
select has_table_privilege('authenticated','lumen_commands.daily_runs','SELECT'),
       has_table_privilege('anon','lumen_commands.daily_standings','SELECT'),
       has_function_privilege('anon','public.lumen_daily_begin(text)','EXECUTE');   -- false, false, false (après 20261122100000)
select rel, action from lumen_privacy.policy() where rel like 'daily_%' order by rel; -- 4 lignes
```

- Côté public, appeler `lumen_daily_today` sans session doit répondre
  `{"enabled":false,…}` **sans** `quest_id` : le mode reste invisible.

## 4. Recette sur appareils réels (drapeau toujours `false`)

Comptes de recette : capacité `daily_preview` accordée par le propriétaire 🔒
(`insert into lumen.internal_capabilities(user_id,capability) values(…,'daily_preview')`).
⚠️ Cette capacité ouvre aussi `lumen_daily_preview` et `lumen_daily_override`
(remplacement des grilles futures) : à réserver à des comptes de confiance.

Les résultats de recette restent dans le classement du jour joué. Il faut donc
recetter **avant** le jour de lancement et utiliser des pseudonymes de test neutres.
Pour tester le bilan figé, la phase doit couvrir au moins **une semaine civile
complète, plus 6 h**.

Légende résultat : ✅ conforme · ❌ défaut (ouvrir un ticket) · ⏭ non testé.

| # | Scénario | Appareil(s) | Étapes | Attendu | Résultat | Date / testeur |
|---|---|---|---|---|---|---|
| R1 | Entrée depuis « Mes quêtes » | Android TWA, iPhone Safari, desktop | Mon ciel → Mes quêtes → « 🏆 Défi du jour » | Date + « fin dans … » ; ouverture de l'intro sur `?daily=1` | | |
| R2 | Même grille pour deux joueurs | 2 comptes, 2 appareils | Ouvrir le défi sur les deux | Même constellation, même taille, même disposition | | |
| R3 | Tentative officielle | Compte A | « Relever le défi » → résoudre avec 1 indice | Bandeau or « 1 tentative officielle », cadre doré, cases identiques à la campagne ; temps officiel = temps + 15 s | | |
| R4 | Résultat et classements | Comptes A et B (amis) + C (non ami) | Terminer A, B, C | Onglet Général : top 3 + « Ta position » ; Mes amis : A et B uniquement ; mêmes temps dans les deux ; aucun email ni identifiant | | |
| R5 | Reprise sur un second appareil | A : téléphone puis desktop | Commencer sur le téléphone, attendre 2 min, ouvrir sur desktop | « Reprendre ma tentative », chrono ≥ 2 min (jamais 0:00) ; un seul résultat | | |
| R6 | Fin hors ligne | Téléphone | Commencer en ligne, passer en mode avion, terminer | « envoi en attente » ; au retour réseau ou via « Réessayer l'envoi » : résultat envoyé une fois, identique | | |
| R7 | Rejeu d'entraînement | A après R3 | « S'entraîner (non classé) » → résoudre | Bandeau « Entraînement non classé » ; résultat et rang du jour inchangés | | |
| R8 | Invité | Navigation privée | Ouvrir le défi sans compte | « Connecte-toi pour être classé », pas de « Relever le défi », entraînement possible, aucune écriture serveur | | |
| R9 | Grille d'aventure verrouillée | Compte sans l'aventure du jour | Jouer le défi d'un jour `pack-real-adventure-*` | Grille jouable ; aventure toujours verrouillée ; éclats, badges, records et progression inchangés | | |
| R10 | Bilan hebdomadaire | A sur ≥ 7 jours | « Ma semaine » en cours de semaine puis le lundi suivant après 06:00 | X/7, jours manqués « · » sans pénalité, « Classements provisoires » puis « Semaine terminée : classements figés » | | |
| R11 | Minuit Paris | A, 23:55 → 00:05 | Ouvrir l'intro à 23:58, lancer après 00:00 | Rechargement sur la grille du nouveau jour, chrono de quelques secondes ; une partie commencée avant minuit se termine et compte pour la veille | | |
| R12 | Responsive | 360×640 (Android), iPhone Safari, desktop 1440 | Intro, grille, résultat, bilan | Pas de scroll horizontal ; « Continuer » visible sans défiler ; bandeau au-dessus de la grille | | |
| R13 | Abandon | A (autre jour) | « Abandonner » pendant la tentative | « Tentative abandonnée », non classée, aucune seconde tentative le même jour | | |
| R14 | Partage | A | « Partager ma performance », puis « Partager ma semaine » | Texte limité à ses propres chiffres, sans pseudonyme d'autrui | | |
| R15 | Accessibilité | Desktop clavier, OS « réduire les animations » | Parcours complet au clavier | Focus visible, onglets activables, aucune animation permanente | | |

Les points suivants sont couverts par la CI et non par la recette manuelle :
changements d'heure (jours de 23 h et 25 h), concurrence à 6 appareils,
résultat immuable, égalités, désinscrits, effacement de compte et absence
d'écriture de campagne.

## 5. Activation 🔒

Aucun mécanisme de déploiement par pourcentage n'existe. Le drapeau est global
et `daily_preview` n'est pas une cohorte bêta sûre (voir §4). Les modalités de
publication progressive sont une **décision produit** (§8).

1. Toutes les lignes R1–R15 sont ✅ ou acceptées, et les décisions du §8 sont prises.
2. Activation : `update lumen_commands.feature_flags set enabled=true where name='daily_challenge';`
3. Vérifier sans session que `lumen_daily_today` renvoie `enabled:true` et le
   `quest_id` attendu par `content/generated/daily-schedule.json` pour la date.
4. Sur un appareil réel, avec un compte non administrateur, l'entrée est visible.

## 6. Surveillance (J0 à J7)

```sql
-- Volume et issues par jour
select day, status, count(*) from lumen_commands.daily_runs group by 1,2 order by 1 desc,2;
-- Tentatives restées ouvertes (abandons implicites)
select day, count(*) filter (where status='started') started, count(*) total from lumen_commands.daily_runs group by 1 order by 1 desc;
-- Temps suspects (signalement, pas de sanction automatique)
select day, count(*) from lumen_commands.daily_runs where status='completed' and seconds < 30 group by 1;
-- Finalisations
select * from lumen_commands.daily_finalized order by day desc limit 7;
```

Également : erreurs PostgREST sur `lumen_daily_*` (`invalid_duration`,
`operation_mismatch`, `run_not_found`) et durée moyenne de `lumen_daily_board`
dans `pg_stat_statements`. Les mesures d'usage restent soumises à
`analyticsAllowed()` (#708).

## 7. Critères et procédure de retour arrière

**Niveau 1, réversible et immédiat** : `update … set enabled=false where name='daily_challenge';`.
L'entrée disparaît, `begin`, `board` et `week` sont refusés et aucune donnée n'est
supprimée. Les tentatives en cours peuvent encore être terminées (`finish` ne
dépend pas du drapeau).

À déclencher si :

- une donnée privée (email, UUID) est exposée ;
- un compte obtient deux résultats classés pour un même jour ;
- une modification de campagne, de wallet, de badge ou de droit est imputable au mode ;
- plus de 5 % des `begin` ou `finish` sont en erreur sur 1 h ;
- `lumen_daily_board` dépasse 1 s en p95 ;
- la grille affichée ne correspond pas à la grille serveur.

**Niveau 2, destructif** 🔒 : uniquement après le niveau 1, le retrait du client et
la vérification qu'aucune migration ultérieure ne renomme
`lumen_privacy.policy()`. Exécuter le contenu de
`scripts/fixtures/daily-rollback-882.sql` **sans** le `rollback` final. Ce script
est répété à chaque CI `ledger-sql`. Il supprime définitivement tentatives et
bilans : exporter `daily_runs` et `daily_standings` avant.

## 8. Décisions produit requises avant activation publique

1. **Visibilité du classement général** : réutiliser l'adhésion automatique
   #638, avec désinscription possible, pour afficher pseudonyme et temps à tous
   les joueurs connectés ? Faut-il un texte d'information dans l'intro ? Jouer
   au défi inscrit aussi aux classements des grilles #638.
2. **Protection des mineurs** : règle d'âge, exclusion du général ou
   consentement.
3. **Désinscrits dans « Mes amis »** : l'implémentation les exclut. Le confirmer.
4. **Difficulté** : bande « Intermédiaire + Avancé » (7×7 et 8×8). La confirmer.
5. **Date de lancement** : le calendrier couvre du 23/11/2026 au 28/11/2027.
6. **Publication progressive** : bascule globale, ou développement préalable
   d'une cohorte bêta distincte de `daily_preview`.
