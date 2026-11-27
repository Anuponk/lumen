# LUMEN Premium — socle commercial, quotas et transition (#1030)

**LUMEN Gratuit — Jouez chaque jour. LUMEN Premium — Jouez sans limites.**
Premium : 4,99 € en achat unique, sans publicité ni abonnement. Source de vérité
fonctionnelle : issue #1030. Ce document décrit le contrat technique livré et ce
qui reste à faire avant le lancement.

> **État : tout est désactivé en production.** Aucun joueur ne voit de changement
> tant que le propriétaire n'a pas activé les réglages commerciaux (§ 8). Aucune
> activation publique automatique.

## 1. Existant réutilisé

| Besoin | Réutilisé | Ajout #1030 |
|---|---|---|
| Achats, remboursements, litiges | `lumen_commands.purchases` / `record_purchase` (#728, #729, #730) | produit `lumen-premium` (inactif) |
| Droits de contenu | `lumen.entitlements` + `sync_purchase_entitlements` (#728/#865) | Premium possède le ciel principal comme `real-sky-all` |
| Restauration Play / Stripe | Edge `lumen-play-purchase`, `lumen-stripe-checkout` (#823, #878) | SKU `lumen_premium`, libellé Stripe |
| Identité de tentative | `attemptId` de `attempt-engine.js` (#851) | clé de décompte des quotas |
| Cooldown 15 min | `qualification-window.js` (#327, #908) | inchangé, commun Gratuit/Premium |
| Analytics | `ranking_runs` (une ligne par tentative), reçus canoniques, cockpit #708 | `lumen_admin_quota_simulation` |
| Exclusion admin/QA | `lumen.internal_capabilities` ; les tentatives QA ne sont jamais envoyées | même règle |
| Cercles privés | V1 #929 (14 RPC, RLS, effacement) | création Premium derrière `premium_circles` |
| Archives des défis | `lumen_commands.daily_puzzles`, mode entraînement du Défi (#882/#1015) | `lumen_daily_archive` (jour passé seulement) |
| Effacement RGPD | `lumen_privacy.policy()` chaînée | 6 tables inscrites |

## 2. Droit Premium serveur

Le droit Premium est **distinct** des droits d'aventure et de la maîtrise. Il est
calculé à la lecture par `lumen_commands.premium_status(user)`, dans cet ordre :

| Origine | Règle | Source renvoyée |
|---|---|---|
| Achat Premium | `lumen-premium` payé | `premium_purchase` |
| Tout le ciel | `real-sky-all` payé | `sky_purchase` |
| Complément intégral | un `real-sky-upgrade-N` payé | `sky_upgrade` |
| Cinq aventures | ≥ 5 aventures `real-adventure-02..09` distinctes payées | `five_adventures` |
| Attribution tracée | ligne active de `lumen_commands.premium_grants` | `admin_full_sky` / `admin` |

Conséquences : restauration, multiappareils, remboursement et litige suivent le
registre d'achats sans écriture supplémentaire ; un remboursement qui fait passer
sous la règle retire Premium, les contenus déjà acquis restent soumis aux règles
existantes (#728). Les anciens SKU restent dans le catalogue pour les restaurations.

**Ciel intégral attribué par l'administration** : `premium_backfill(true)` crée une
attribution tracée (`premium_grants` + `premium_grant_events`) uniquement quand les
8 aventures verrouillées sont détenues par des droits d'origine administrative
(`admin`, `admin_*`, `manual`). `premium_backfill(false)` est un inventaire à blanc,
avec des empreintes courtes et jamais d'identifiant. Rollback :
`premium_revoke_grant(user)` (la ligne et l'événement sont conservés).

### Inventaire de production (lecture seule, 27/11/2026)

| Profil | Comptes | Décision |
|---|---|---|
| Tout le ciel acheté (payé) | 1 | Premium automatique (dérivé) |
| Ciel intégral par attribution administrative | 2 (dont 1 compte interne et le compte de revue Google Play) | Premium via `premium_backfill(true)` au lancement |
| Ciel intégral mixte : 7 attributions admin + 1 achat | 1 (compte interne) | **Cas non couvert — à arbitrer** |
| 7/8 aventures attribuées (compte interne) | 1 | Partiel : pas de Premium |
| 1 à 4 aventures achetées / attribuées / maîtrisées | 5 | Conservation, sans Premium |
| Uniquement achats remboursés | 1 | Gratuit |
| Complément intégral payé, cinq achats unitaires payés | 0 | (règles prêtes) |

Cas à soumettre au propriétaire : (1) ciel intégral composé d'attributions admin et
d'achats ; (2) le compte de revue Google Play deviendra Premium par la règle
« attribution administrative » — à confirmer ; (3) sources `manual` assimilées à
l'administration.

## 3. Moteur de quotas

Module pur `src/campaign/premium-quota.js` (sans DOM), branché au seul point
`ensureAttemptStarted()` de `game-screen.js`.

- Phase découverte : les 3 premières constellations (30 quêtes, ordre du catalogue —
  la 4ᵉ commence à `base-q021`). Seuil `quota_threshold_constellation`.
- Activation **durable** au premier geste sur une quête de la 4ᵉ constellation, ou
  par la progression (une quête de la 4ᵉ constellation déjà terminée) : les joueurs
  déjà avancés sont concernés dès le lancement. Ensuite les quotas couvrent tout le
  ciel, premières constellations comprises.
- Décompte au premier geste d'une **nouvelle identité de tentative** : jamais à
  l'ouverture, ni au reset (identité conservée), ni à la reprise (déjà démarrée).
- Nature : quête jamais gagnée → nouvelle quête (y compris après abandon) ; après la
  première victoire → rejeu.
- Exemptions : Défi du jour et ses événements, duels (`socialChallenge`), tutoriel
  (`scriptedLearningActive`, `learningReplayActive`). Aucun mode entraînement de
  contournement n'est ajouté.
- Limite atteinte : le geste n'est pas joué, une fenêtre Lumen explique la limite et
  propose Premium seulement si l'offre est disponible. Aucun compteur affiché avant
  la limite. Une partie en cours n'est jamais interrompue.
- Valeur des nouvelles quêtes **non décidée** : tant que `quota_new_daily` est nul, il
  ne bloque jamais, et le serveur refuse `quotas_enabled=true`.

### Journée et fuseau

Journée = date civile locale dans le fuseau IANA courant (DST géré par le fuseau).
Une tentative est imputée au jour de son démarrage. Garde contre la double remise à
zéro : `effectiveDay = max(dernier jour utilisé, min(jour du fuseau courant, jour du
fuseau du dernier jour utilisé))` — la clé ne recule jamais et un nouveau jour n'est
atteint que lorsque le fuseau du jour précédent l'a aussi atteint. Voyager vers l'est
retarde la remise à zéro de l'écart horaire le premier jour ; jamais de jour gagné.

### Hors ligne, multiappareils et compromis

- Registre local par compte (`lumenQuotaV1:<owner>`, 8 jours max) : le jeu hors ligne
  consomme le quota local restant.
- Réconciliation groupée `lumen_quota_sync` (≤ 40 tentatives, dédupliquées par
  `(user_id, attempt_id)`), envoyée près d'une limite ou toutes les 3 tentatives, et à
  l'hydratation. Le serveur **n'annule jamais** une partie jouée : il l'enregistre et
  renvoie les compteurs qui font foi ; le client compte `serveur + local en attente`.
- Activation monotone des deux côtés (la plus ancienne gagne).
- Compromis acceptés et documentés : deux appareils hors ligne simultanément peuvent
  dépasser la limite d'au plus le quota d'un appareil jusqu'à la synchronisation ; un
  invité peut effacer son stockage local ; un client modifié peut ne pas déclarer ses
  tentatives. Aucun avantage compétitif n'en découle (classements et badges
  inchangés, option A). Un contrôle serveur strict imposerait un appel réseau
  bloquant par tentative et casserait le jeu hors ligne : écarté.

## 4. Équité (option A)

Classements communs, cooldown identique, aucun plafond de tentatives classantes,
badges identiques, tentative officielle unique du Défi du jour préservée. Aucun code
de classement ou de badge n'est modifié par ce chantier.

## 5. Boutique

`adventure-offer.js` : avec `shop_premium` (et le produit actif), l'offre d'une
aventure verrouillée devient une carte unique « LUMEN Premium — Jouez sans limites »
au prix du produit (Google Play : prix régional ; Web : prix catalogue) ; les cartes
« Cette aventure » / « Tout le ciel » ne sont plus proposées. Le déblocage par
maîtrise reste affiché. Stripe refuse Premium à un compte déjà Premium
(`already_owned`). Badge discret `#premiumBadge` dans « Compte ». Textes FR/EN/ES.

## 6. Lot 2 — état

| Fonction | Serveur | Client |
|---|---|---|
| Cercles : création Premium, participation gratuite | `lumen_circle_create` contrôle `premium_circles` | message `circle_premium_required` |
| Archives jouables | `lumen_daily_archive(day)` : jour passé uniquement, aucune écriture de run ni de classement | **à faire** : entrée « Rejouer » dans l'historique #1015 et mode entraînement daté |
| Statistiques avancées | `lumen_premium_stats` : historique paginé (≤ 50), série 90 j, records | **à faire** : écran joueur et agrégation par difficulté |

Perte du droit Premium par le créateur d'un cercle : le cercle, ses membres, ses
invitations et liens restent ; il ne peut plus en créer de nouveau. Les membres
continuent gratuitement.

## 7. Supabase Free-first

| Situation | Coût |
|---|---|
| Tout désactivé (aujourd'hui) | ≤ 1 lecture `lumen_get_commerce_config` (≈ 400 o) par joueur et par 6 h, aucune écriture |
| Lancement, joueur Premium ou en découverte | + 1 `lumen_get_commerce_state` à l'hydratation |
| Lancement, gratuit au-delà du seuil | + ≈ 1 `lumen_quota_sync` pour 3 tentatives ; ≈ 120 o par tentative stockée, purge à 45 jours |
| Statistiques / archives | à la demande, bornées, pagination par curseur |

Aucun polling, heartbeat ni télémétrie par geste. Index : `quota_attempts(user_id,
local_day)`.

## 8. Activation et rollback

Réglages `lumen_commands.commerce_settings` (SQL `lumen_commands.set_commerce_setting`
ou RPC `lumen_admin_set_commerce_setting`, capacité `commerce_admin`, audit
`commerce_settings_audit`) :

`premium_enabled`, `shop_premium`, `quotas_enabled`, `quota_threshold_constellation`
(4), `quota_new_daily` (null), `quota_replay_daily` (5), `premium_stats`,
`premium_archives`, `premium_circles`, `premium_cosmetics`. Recette : capacité
`premium_preview` (aucun effet public).

Plan de lancement (après recette des lots 0–2 et accord explicite) :
1. Créer le produit Play `lumen_premium` (4,99 €) ; publier l'AAB qui l'accepte.
2. `select lumen_commands.premium_backfill(false);` → revue ; puis `(true)`.
3. `quota_new_daily` = valeur validée.
4. `update lumen_commands.store_products set active=true where product_id='lumen-premium';`
   puis désactiver les nouvelles ventes unitaires et de ciel (`active=false`) — les
   produits restent pour restaurations et remboursements. Ne rien désactiver dans les
   consoles Play/Stripe.
5. `premium_enabled`, `shop_premium`, `premium_circles`, `premium_stats`,
   `premium_archives` ; enfin `quotas_enabled`.
6. Mettre à jour CGV, pages publiques, fiches store et supports.

Rollback : remettre `quotas_enabled` puis `premium_enabled` à `false` (effet au plus
6 h, immédiat à la prochaine ouverture si le cache est vidé) ; réactiver les anciens
produits ; `premium_revoke_grant` pour une attribution. Aucune donnée n'est
supprimée ; les achats Premium restent des achats du ciel principal.

## 9. Lot 0 — calibration du quota (27/11/2026)

Source : `ranking_runs` (une ligne par tentative d'un compte connecté), du 11 au
27/11/2026, jours Europe/Paris, comptes à capacité interne exclus. Nouvelle quête =
avant la première victoire de cette quête ; rejeu = après. Seuil = 4ᵉ constellation
selon le catalogue.

| Segment | Joueurs | Jours-joueur | Nouvelles quêtes P50/P75/P80/P90/P95/P99 | Rejeux P50/P75/P80/P90/P95/P99 |
|---|---|---|---|---|
| Gratuits, découverte | 17 | 31 | 4 / 6 / 8 / 10 / 14 / 17 | 0 / 1 / 1 / 4 / 6 / 32 |
| Gratuits, après le seuil | 6 | 21 | 11 / 47 / 48 / 68 / 88 / 90 | 3 / 7 / 18 / 30 / 53 / 58 |
| Acheteurs | 3 | 5 | (trop peu de données) | |

Simulation (gratuits après le seuil, rejeux = 5/jour) :

| Quota nouvelles quêtes | Jours atteignant la limite nouvelles | … rejeux | … l'une des deux | Tentatives au-delà |
|---|---|---|---|---|
| 5 | 81 % | 33 % | 81 % | 81 % |
| 10 | 67 % | 33 % | 71 % | 71 % |
| 15 | 43 % | 33 % | 62 % | 65 % |
| 20 | 43 % | 33 % | 62 % | 59 % |
| 30 | 29 % | 33 % | 52 % | 49 % |
| 50 | 19 % | 33 % | 43 % | 34 % |

Durées (victoires avec durée valide, 16 joueurs, 41 jours-joueur) : quête P50 59 s,
P90 190 s ; minutes de jeu par jour-joueur P50 6, P75 12, P90 15, P99 66.

**Limites** : 6 joueurs gratuits au-delà du seuil, essentiellement des testeurs très
engagés ; invités non observables ; tentatives QA jamais envoyées ; 17 jours
d'historique ; `analytics_events` vide depuis le 26/10 ; la durée ne couvre que les
victoires. **Aucun seuil ne peut être validé statistiquement** : l'objectif 80–90 % de
jours sans limite exigerait ≥ 68 nouvelles quêtes/jour sur cet échantillon, et le
quota de rejeux validé (5) serait atteint 1 jour sur 3.

Recommandation : ne pas figer la valeur maintenant ; garder les quotas désactivés,
relancer `lumen_admin_quota_simulation` après 4 semaines et ≥ 30 joueurs gratuits
au-delà du seuil (aucune collecte nouvelle nécessaire : `ranking_runs` suffit pour les
comptes). Hypothèse de travail à confirmer : un quota entre 15 et 20 nouvelles quêtes
correspond à P95–P99 de la phase découverte ; le propriétaire peut aussi réexaminer
les 5 rejeux.

## 10. Recette

Matrice (à exécuter avec `premium_preview`, sans activation publique) :

| # | Scénario | Attendu |
|---|---|---|
| 1 | 30 premières quêtes | aucun quota, aucune mention Premium |
| 2 | Premier geste sur `base-q021` | activation durable, 1ʳᵉ nouvelle quête comptée |
| 3 | Retour vers les constellations 1–3 | quotas appliqués |
| 4 | Épuiser nouvelles quêtes / rejeux | fenêtre de limite au geste suivant, pas avant |
| 5 | Abandon avant 1ʳᵉ victoire puis relance | compte comme nouvelle quête |
| 6 | Rejeu après victoire | compte comme rejeu |
| 7 | Reset de grille, reprise après fermeture | aucun décompte supplémentaire |
| 8 | Partie commencée à 23:58, finie à 00:05 | comptée la veille, aucune interruption |
| 9 | Changement de fuseau (Paris → Tokyo → Paris) | pas de double remise à zéro |
| 10 | Passage heure d'hiver / d'été | remise à zéro à minuit local |
| 11 | Hors ligne puis reconnexion | quota local, envoi groupé, dédupliqué |
| 12 | Deux appareils | compteurs serveur adoptés, pas de double compte |
| 13 | Profils historiques (§ 2) | `premium_backfill(false)` conforme |
| 14 | Achat Stripe/Play Premium, restauration, remboursement | droit, ciel, retrait |
| 15 | Classements, badges, cooldown | inchangés |
| 16 | Défi du jour, duels, tutoriel | hors quota |
| 17 | Cercles : création gratuite refusée, participation libre | conforme |
| 18 | Archives et statistiques (après lot 2 client) | |
| 19 | FR/EN/ES, desktop, Android, PWA iPhone | textes, pas de scroll en jeu |

Tests automatisés : `scripts/premium-quota-tests.mjs` (18 cas : règles, minuit, DST,
fuseau, hors ligne, multiappareils, client Free-first, câblage),
`scripts/fixtures/premium-foundation-1030.sql` (CI canonical-ledger, migration
appliquée deux fois, droits négatifs, effacement), parité SKU dans
`adventure-offer-tests.mjs`.
