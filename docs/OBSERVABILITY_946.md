# Supervision proactive de Lumen (#946)

Audit initial sur `c9eb841b5a00ec28509f660d673d5843c69821e3`. Le 21 novembre 2026, le point public `/build-info.json` répondait HTTP 200 pour ce SHA (`1.11.1+738`). Cela confirme la publication web. L’audit n’a pas interrogé Auth, les achats ni le journal de messagerie en production.

| Source existante | Réutilisation | Limite vérifiée dans le dépôt |
|---|---|---|
| #398, RPC de santé de synchronisation et observations d’outbox | Brancher #947 sur les premiers échecs après le dernier succès, sur les outboxes durables et sur la résolution | Le cron de rétention ne constitue pas un transport d’alerte. Une perte réseau courte ne prouve pas un blocage. |
| #534, diagnostics limités et cockpit administrateur | Réutiliser les signatures, preuves et capacités serveur pour #947 et #949 | Les diagnostics facultatifs dépendent du consentement et ne représentent pas tous les joueurs. |
| #708, `/admin/analytics`, agrégats par version et échantillons | Étendre la même interface pour #948 et #949 | Les statistiques de réactivité et de fluidité terrain n’existent pas toutes. Le dénominateur doit rester explicite. |
| Supabase Auth partagé et `lumen.users` | Relier création Auth et première adhésion Lumen pour #950 | Une connexion Auth isolée peut concerner un autre produit. |
| Ledger serveur Stripe et Play et droits `lumen.entitlements` | Vérifier les confirmations, le montant réellement facturé et les droits pour #950 | Une confirmation fournisseur qui n’atteint pas le ledger reste hors de portée. #947 doit traiter cette réconciliation externe. |
| Brevo et cron cPanel documentés dans [le runbook o2switch](O2SWITCH_SIMPLE_CRON.md) | Même fournisseur transactionnel et même hôte de planification. Le cron applicatif et celui du déploiement ont des responsabilités différentes. | Le cron qui surveille le déploiement tourne chez l’hébergeur. #947 doit sonder depuis l’extérieur. |

Les PR ouvertes lors de l’audit portaient sur le défi, les gestes et le versionnage Play. Le lot #950 se limite à la source serveur et à l’envoi asynchrone. Les autres lots gardent leurs PR indépendantes.

## Notifications d’activité (#950)

Le worker lit les sources autoritatives et alimente `lumen_commands.activity_mail`. Le code joueur, la création de compte, les webhooks et le calcul des droits n'appellent jamais le worker ni Brevo. Les deux RPC d'exploitation sont réservées à `service_role`. Le rôle de transport ne lit pas directement la table. La politique d’effacement Lumen couvre les lignes rattachées au joueur, même si son compte Auth partagé subsiste.

- **Création.** `auth.users.created_at` et première adhésion `lumen.users.first_seen_at` dans la fenêtre. L’email doit être confirmé avant l’annonce. La date reste celle de création. Google est annoncé au premier rattachement authentifié. Les reconnexions, confirmations rejouées et changements de mot de passe ne génèrent pas d'autre notification.
- **QA.** CI et recettes automatisées utilisent des bases isolées. Pour un compte de test créé dans le projet partagé, l’opérateur définit `app_metadata.lumen_qa=true` avant le premier accès Lumen. Ce statut est contrôlé côté serveur. Un compte historique créé avant l’activation est écarté.
- **Achats.** Pour Stripe, une session concordante en mode live et un état payé dans le ledger. Pour Play, une ligne payée avec le règlement réel renseigné par la vérification Google. Les achats de licence Play et les sessions Stripe test sont exclus. Une restauration d’un ancien achat garde sa date d’origine. La vérification compare les droits actifs du produit acheté. Un droit manquant donne une notification critique distincte. Remboursements et contestations utilisent les changements d’état du ledger, avec le montant d’origine clairement libellé.
- **Minimisation.** Date, méthode et confirmation pour le compte. Produit, canal, montant, devise, date et état du droit pour l'achat. Aucun email de joueur, pseudo, pays, langue, token ni identifiant fournisseur dans le message. Le total des comptes n’est pas calculé, car les identités internes historiques ne sont pas toutes classées.
- **Envoi.** Une clé unique par compte ou achat, et une clé d’événement par changement d’état. L'état `accepted` annonce l’acceptation de l’API, pas l’arrivée dans la boîte. Une limitation HTTP 429 est réessayée avec délai, au maximum cinq tentatives. Un timeout, un 5xx ou un envoi interrompu expire en `unknown` pour vérification humaine. Cette décision privilégie l’absence de doublon dans les résultats ambigus.
- **Bornes.** Fenêtre maximale de collecte de sept jours, historique de quatorze jours purgé par le worker actif, lots de 10 par défaut et 20 au maximum. Le plafond quotidien compte les lignes qui ont fait l’objet d’une tentative depuis minuit UTC et vaut 100 par défaut. À cinq minutes par exécution, environ 288 lectures/claims par jour et un acquittement par tentative. Les délais, le plafond et le quota partagé peuvent différer la notification. Avec une indisponibilité de plus de sept jours, la recette doit vérifier la période manquante avant reprise.

### Configuration et recette opérateur

Après validation de la migration sur la base cible, installer le script Python existant dans l’espace privé de staging et faire charger à cPanel un fichier d’environnement hors docroot. Conserver un verrou `flock` pour éviter deux exécutions de la même tâche. Configurer `LUMEN_ACTIVITY_ENABLED=1` au moment de l’activation, `LUMEN_ACTIVITY_START` avec une date ISO et un fuseau, `LUMEN_ACTIVITY_KINDS` avec les catégories souhaitées, puis `LUMEN_ACTIVITY_SUPABASE_URL`, `LUMEN_ACTIVITY_SENDER`, `LUMEN_ACTIVITY_RECIPIENT`, `LUMEN_ACTIVITY_SUPABASE_KEY_FILE` et `LUMEN_ACTIVITY_BREVO_KEY_FILE`. Les deux derniers pointent vers des fichiers privés. Le fournisseur et le domaine d’envoi doivent être vérifiés dans Brevo. Les journaux ne contiennent que des compteurs et des statuts.

Le plan gratuit Brevo affiche 300 envois par jour pour l’ensemble du compte. Le plafond de Lumen laisse de la marge à l’activité normale et doit être réglé en tenant compte des autres envois. [Offres Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans). [Statuts API transactionnelle](https://developers.brevo.com/reference/send-transac-email).

Sur une base de recette isolée, exécuter la fixture SQL ou créer un compte de test via les vrais flux email et Google. Renseigner un destinataire de recette dédié, créer une confirmation d’achat Play et Stripe avec les montants de la fixture et prévoir séparément l’achat confirmé sans droit. Après un cycle cron, compter dans la boîte un avis par événement. Rejouer les callbacks et vérifier que le compte reste identique. Le scénario d’incident de recette ne doit jamais révoquer un droit de joueur réel. La CI utilise PostgreSQL jetable et une boîte simulée. Vérifier la réception réelle dans la boîte configurée avant de valider.

Poursuite dans l’ordre #947, #948, #949. Aucun réglage de production ni traitement de données de joueurs n’est effectué par la CI.

## Alertes critiques (#947)

Le lot lit les signaux existants de #398. Il utilise la file de #950 pour les messages d’ouverture et de rétablissement. Aucun appel à Brevo ne se fait depuis une requête de jeu, de sauvegarde ou de paiement. La présentation utilise la section **Synchronisation et incidents** du cockpit #534/#708.

| Signature | Gravité | Preuve d’ouverture initiale |
|---|---|---|
| Disponibilité externe | P0 | Trois sondes distinctes négatives. La sonde exige HTTP 200, un `build-info.json` valide, le plateau et le module d’entrée HTML, ainsi que la cohérence de révision. Un écart de révision est relu une fois. |
| Achat sans droit | P0 | La file #950 constate un achat confirmé et l’absence des droits attendus. Le moniteur draine ce même avis. Le rétablissement est signalé une seule fois après relecture des droits d’un achat toujours payé. |
| Hydratation | P1 | Un compte non QA atteint 15 minutes après un échec non réseau ou une réconciliation bloquée, sans succès ultérieur, **dans la fenêtre active** (`hydration_active_hours`, 24 h par défaut, #947 du 24/11). Un échec plus ancien sans retour du joueur reste dans l’historique, pas dans les incidents actifs. |
| Sauvegarde cloud | P1 | Un compte non QA dépasse 15 minutes en état critique ou revue, ou avec au moins trois échecs et une opération en attente. |
| File de sauvegardes | P2 | Au moins 20 opérations en attente depuis 15 minutes sur un compte, observées à trois sondes distinctes sans condition P1. |

Deux observations nominales distinctes ferment un épisode. Pour la sauvegarde, un état d’authentification indéterminé avec une file ancienne maintient l’alerte en attente de preuve. Seule une mesure du nouveau passage fait avancer les compteurs. Une réexécution avec le même numéro de workflow et une exécution plus ancienne sont ignorées. La file déduplique par signature et épisode. Il y a au plus un avis d’ouverture et un avis de rétablissement par épisode, sans rappel périodique. L’acquittement cible l’épisode courant et reste indépendant d’un rétablissement. Les deux RPC du cockpit exigent la capacité serveur `analytics_cockpit`, et le moniteur seul peut publier ses observations. Le cockpit signale une observation de plus de vingt minutes.

### Activation et recette de la supervision

1. En recette, valider les migrations sur une base isol?e. Pour l?activation, v?rifier les migrations d?j? install?es dans le projet Supabase SoldeZen qui h?berge les sch?mas Lumen. Appliquer les migrations manquantes dans l?ordre #950, #947, #948 puis #949, en contr?lant les pr?requis. Exécuter le workflow **External Lumen health probe** manuellement sur `main` pour la lecture HTTPS publique, sans secrets.
2. Réutiliser l'environnement GitHub `Production`, réservé à `main`. Y conserver `LUMEN_ACTIVITY_SUPABASE_KEY` et configurer `LUMEN_ACTIVITY_SUPABASE_URL`. Le moniteur met les avis en file et o2switch les envoie. Voir [Recette du transport o2switch et activation](#recette-du-transport-o2switch-et-activation).
3. Sur un environnement de recette isolé, charger les fixtures `critical-incidents*.sql` dans une base vide après le bootstrap #950, ou enregistrer des observations synthétiques croissantes avec le rôle technique configuré. Rejouer la même observation. Simuler trois échecs puis deux retours sains. Vérifier dans la boîte autorisée un avis d’ouverture P0 et un avis de rétablissement au total, puis acquitter dans **Synchronisation et incidents** avec un compte doté de la capacité. Vérifier le refus avec un compte sans capacité. En recette, conserver uniquement les métadonnées simulées et ne modifier aucun droit réel.

Le moniteur s'exécute hors d'o2switch. La sonde publique vérifie la disponibilité de la page et de sa révision. Supabase conserve les épisodes. La livraison dépend du worker o2switch et de Brevo. Si Supabase est indisponible, le workflow échoue sans pouvoir enregistrer un nouvel épisode. Les transactions fournisseur qui n’atteignent jamais le ledger nécessitent une réconciliation fournisseur distincte. Le rétablissement du droit d’achat est lu dans le serveur. Le moniteur ne déclenche aucune attribution. Les signaux du frontend nécessitent une émission côté joueur et ne permettent pas à eux seuls de détecter un appareil durablement hors ligne. Les seuils initiaux doivent être recalibrés avec la volumétrie réelle.

À cinq minutes, environ 288 sondes et 576 lectures HTTPS publiques par jour, plus une observation et une lecture de file par sondage actif. Les appels ont un budget de taille et un délai maximal. GitHub peut différer les tâches planifiées ou les désactiver après inactivité. Les runners standards des dépôts publics sont gratuits. [Planification GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). [Facturation GitHub Actions](https://docs.github.com/en/actions/concepts/billing-and-usage).


### Cadence et fraîcheur (24/11/2026)

Constat : le planning GitHub `*/5` n'a produit que 5 passages en 48 h (écarts de 4 à 12 h), d'où une dernière observation de 05:01 UTC le 24/11 et un état « obsolète » quasi permanent dans le cockpit. Le cron o2switch du worker #950, réellement exécuté toutes les cinq minutes, lance désormais `lumen_critical_monitor.py` avant l'envoi des avis (`scripts/o2switch-activity-mail.sh`, désactivable par `LUMEN_CRITICAL_MONITOR_ENABLED=0` dans le fichier privé ; un échec d'observation ne bloque jamais l'envoi). La comparaison de performance n'y tourne qu'au premier passage de chaque heure (`LUMEN_PERFORMANCE_HOURLY=1`). Le planning GitHub reste une sonde externe d'appoint, indépendante de l'hébergeur. Les deux sources envoient un échantillon horodaté en millisecondes : un échantillon plus ancien est ignoré. Le cockpit affiche l'âge de la dernière observation (« il y a N min ») et l'état obsolète au-delà de 20 minutes.

Coût : une observation et une lecture de file toutes les cinq minutes (≈ 576 RPC par jour), plus une comparaison de performance par heure (24 RPC). Aucun nouveau log ni nouvelle télémétrie.

### Réglages sans redéploiement (#947/#948)

`lumen_ops.monitor_settings` (une seule ligne, bornes vérifiées par la base) porte `hydration_active_hours` (24), `perf_min_accounts` (5), `perf_ratio` (1,5) et `perf_recent_days` (3). Lecture et modification réservées à la capacité `analytics_cockpit` : `lumen_admin_monitor_settings()` et `lumen_admin_set_monitor_settings(p_hydration_active_hours, p_perf_min_accounts, p_perf_ratio, p_perf_recent_days)` (les paramètres omis restent inchangés). Migration : `20261124130000_monitor_settings_947_948.sql`.

## Détection des régressions (#948)

L’option de mesures de performance s’affiche dans le compte et demande un accord distinct sur l’appareil, en plus du consentement aux diagnostics enregistré sur le serveur. Le navigateur choisit au hasard 25 % des onglets, mesure au maximum deux minutes et tente un envoi au plus. La base accepte une mesure par compte et jour UTC. Elle exclut les comptes QA, applique une rétention de 14 jours et efface les mesures avec le compte Lumen ou si les diagnostics sont désactivés sur le serveur. Le retrait de l’option sur l’appareil arrête ses envois. La mesure exclut les URL, les saisies, les cibles DOM, les contenus de jeu et les adresses réseau.

Les durées maximales par onglet couvrent le chargement jusqu’à `domInteractive`, l’assemblage du plateau, les interactions sur le plateau, les tâches longues, les intervalles entre images de la victoire et les RPC cloud sur liste fermée. La métrique de synchronisation mesure les RPC de sauvegarde observables par Resource Timing. Une file hors ligne ou une réconciliation incomplète relève des indicateurs #947. Le navigateur peut omettre les métriques indisponibles.

La règle P1 compare le p90 des deux versions mesurées les plus récentes sur 14 jours, à plateforme, navigateur et catégorie réseau identiques. Chaque version doit réunir 20 comptes distincts. Le p90 doit augmenter d’au moins 50 % et franchir l’écart minimal propre à la métrique. Les écarts valent 250 ms pour le chargement, 100 ms pour les RPC, 35 ms pour les tâches longues, 25 ms pour l’interaction et 15 ms pour le plateau et la victoire. Sur les observations #398, une hausse d’au moins 50 % et 5 points du taux d’échec d’hydratation déclenche aussi un P1, à partir de 20 comptes distincts par version. Pour ce taux, le dénominateur est le nombre d’hydratations terminées. Un taux de référence nul peut déclencher au seuil de 5 points.

Depuis le 24/11/2026 (#948), Lumen publiant plusieurs versions par jour avec environ un compte chacune, la comparaison porte sur des **périodes** et non plus sur deux versions isolées : la période récente (`perf_recent_days`, 3 jours) contre le reste des 14 jours conservés, à plateforme, navigateur et réseau identiques, chaque période regroupant toutes ses versions (la plus récente est citée). Le plancher est `perf_min_accounts` comptes distincts de chaque côté (5 par défaut, réglable), le ratio `perf_ratio` et les écarts absolus par mesure restent. Chaque comparaison porte un niveau de confiance : faible sous le plancher (jamais d'alerte, « Échantillon insuffisant »), moyenne au plancher, élevée au double. L'avis P1 cite les deux périodes, les tailles d'échantillon et la confiance. Le taux d'échec d'hydratation suit la même règle de période.

Le moniteur réutilise le cycle #947 et la file #950. Il met en attente au plus dix comparaisons de durée et une comparaison de taux par cycle, avec une clé stable par comparaison et un plafond d’envoi partagé. Les avis de performance suivent les mêmes états de livraison et la même rétention que la file d’activité. Aucun service payant supplémentaire. Le plafond de collecte dépend du nombre de comptes volontaires, avec au plus une ligne par compte et par jour. Avant d’activer `LUMEN_PERFORMANCE_MONITOR_ENABLED=1`, appliquer les migrations dans l’ordre #950, #947, #948 et vérifier la fixture de régression sur la base de recette. La collecte réelle dépend du nombre de comptes volontaires et du support navigateur.


## Cockpit de santé et bilan quotidien (#949)

La vue **Santé du service**, dans **Synchronisation et incidents** du cockpit existant, requiert la capacité serveur `analytics_cockpit`. Elle présente la dernière sonde externe et sa fraîcheur, les épisodes actifs, les achats sans droit en cours de suivi, les dernières alertes, les comparaisons de temps de réponse, les inscriptions effectives, les achats confirmés et les états de notification. Le sélecteur de période du cockpit borne les inscriptions, achats et avis de la file. Les filtres de version et de sévérité s’appliquent aux alertes et séries disposant de ces dimensions. Les versions inconnues restent visibles sans filtre. Les incidents actifs décrivent l’état courant et les comparaisons de performance conservent leur fenêtre de 14 jours. L’acquittement reste dans la section **Supervision proactive**.

Une inscription devient effective quand l’identité et l’adhésion Lumen sont établies, avec confirmation obligatoire pour l’email. Le volume des achats et les montants bruts sont calculés sur les confirmations vérifiées du ledger, avec les paiements ultérieurement remboursés inclus et les devises séparées. Les paiements test Stripe, comptes QA et achats Play sans règlement vérifié sont exclus. Les notifications sont limitées à la rétention de la file. Brevo fournit un état d’acceptation de l’API. Les alertes ne donnent pas toutes une version et peuvent toucher les mêmes comptes. Le bilan indique donc une borne basse des joueurs affectés, calculée à partir du plus grand nombre connu dans un incident actif hors disponibilité.

Appliquer la migration #949 après #948 sur la base de recette. Inclure `daily_summary` dans `LUMEN_ACTIVITY_KINDS` et renseigner `LUMEN_DAILY_SUMMARY_RECIPIENT` dans le fichier privé du worker o2switch. Le worker utilise `LUMEN_DAILY_SUMMARY_TIME` (08:15 par défaut) et `LUMEN_DAILY_SUMMARY_ZONE` (Europe/Paris par défaut). Ces réglages se font dans ce même fichier privé. Le premier passage après l’heure locale met en file le bilan de la veille. Les passages suivants réutilisent la même clé de date. Après une journée entière sans passage, vérifier la période sans bilan dans le cockpit. Les comptes et achats utilisent la veille locale, tandis que la disponibilité, les alertes non résolues et les joueurs affectés décrivent l’état au moment de la génération. Les changements de fuseau autour de minuit peuvent modifier la journée observée.

Le bilan ajoute au plus un message au quota partagé par jour, sans service supplémentaire. Le calcul complet s’effectue seulement si la clé de date manque. Le routage du bilan utilise son destinataire dédié. Une configuration du bilan invalide ou un échec de sa mise en file est signalé dans le journal du cron o2switch. Le traitement des autres alertes continue. L’envoi utilise les mêmes baux, règles de retry et états d’acceptation que #950. Sur la base de recette, exécuter deux passages après l’heure choisie, vérifier le total par devise et constater un seul bilan dans la boîte dédiée. Les fixtures SQL et Python simulent ce contrôle de déduplication sans envoyer de mail.

### Recette du transport o2switch et activation

La sonde GitHub met les alertes et les régressions dans la file SoldeZen. Le worker o2switch prépare le bilan dans cette file à partir de 08:15 (heure de Paris par défaut), traite la file et découvre les inscriptions et achats depuis les sources vérifiées. Une panne o2switch retarde les e-mails jusqu'au retour du worker. La sonde continue tant que GitHub et SoldeZen répondent.

Préparer `~/lumen-private/activity-mail.env` en mode `600`, avec les deux destinataires de recette et une date d'activation fixe au format ISO avec fuseau.

```bash
LUMEN_ACTIVITY_ENABLED=0
LUMEN_ACTIVITY_START='AAAA-MM-JJTHH:MM:SS+00:00'
LUMEN_ACTIVITY_SUPABASE_URL='https://PROJET.supabase.co'
LUMEN_ACTIVITY_SUPABASE_KEY_FILE="$HOME/lumen-private/activity-supabase-key"
LUMEN_ACTIVITY_BREVO_KEY_FILE="$HOME/nopuna-private/brevo-key"
LUMEN_ACTIVITY_SENDER='bonjour@nopuna.fr'
LUMEN_ACTIVITY_RECIPIENT='activite@example.invalid'
LUMEN_DAILY_SUMMARY_RECIPIENT='bilan@example.invalid'
LUMEN_ACTIVITY_KINDS='signup,purchase,refund,revocation,purchase_missing_access,purchase_access_restored,incident_open,incident_resolved,performance_regression,daily_summary'
LUMEN_ACTIVITY_BATCH=5
LUMEN_ACTIVITY_DAILY_LIMIT=120
```

Utiliser l'URL du projet SoldeZen et sa clé `service_role` dans le fichier privé indiqué, en mode `600`. La clé Brevo reste dans le fichier privé de Nopuna.

Dans le terminal cPanel, mettre à jour la copie privée après fusion et exécuter la recette.

```bash
git -C "$HOME/lumen-staging" pull --ff-only origin main
bash "$HOME/lumen-staging/scripts/o2switch-activity-mail.sh" --receipt
```

Le test consulte le schéma API SoldeZen en lecture seule, puis soumet quatre messages synthétiques `[RECETTE]` à Brevo. La CI exécute séparément les quatre parcours en PostgreSQL jetable et vérifie le rejeu sans envoi supplémentaire. En cas de refus Brevo, le journal affiche le statut HTTP et une catégorie prédéfinie. Vérifier un exemplaire de chaque message dans les boîtes configurées.

Après confirmation de la recette, fixer `LUMEN_ACTIVITY_START` à l'heure du passage en service, passer `LUMEN_ACTIVITY_ENABLED` à `1` et ajouter cette tâche dans cPanel à côté du cron de déploiement.

```cron
*/5 * * * * /bin/bash "$HOME/lumen-staging/scripts/o2switch-activity-mail.sh" >> "$HOME/lumen-private/activity-mail.log" 2>&1
```

Le script utilise `flock` pour garantir un seul traitement à la fois. Activer ensuite les variables du dépôt GitHub `LUMEN_CRITICAL_MONITOR_ENABLED=1`, `LUMEN_PERFORMANCE_MONITOR_ENABLED=1`. Contrôler le premier passage planifié. Si GitHub tarde à lancer le planning, exécuter **External Lumen health probe** sur `main` avec **Record the observation in SoldeZen**. Ce passage utilise les mêmes RPC et garde les mêmes limites que la planification. Pour suspendre les e-mails, remettre `LUMEN_ACTIVITY_ENABLED` à `0` côté o2switch.


## Sobriété Supabase Free-first (#995)

Lumen vise à rester durablement sur Supabase Free. Ce chapitre contient l'audit du 23/11/2026, la politique d'observabilité et les garde-fous. La règle courte se trouve dans `AGENTS.md`. Mesures prises en lecture seule sur le projet SoldeZen `tjdjlavmusmncuszhsuw` (schémas Lumen partagés), clone `main` `81bab1c5`. Aucun identifiant de joueur n'est reporté : les acteurs ont été regroupés par empreinte réseau tronquée.

### Méthode et limites d'attribution

- **Log Ingestion** (volume écrit dans les logs) et **Log Query** (volume parcouru par les consultations) sont deux métriques distinctes. Les volumes ci-dessous estiment l'ingestion : taille sérialisée du message et des attributs, soit environ **2,5 Ko par requête API** dans `edge_logs`. Supabase peut facturer une taille différente. L'ordre de grandeur concorde avec les 0,89 Go affichés pour le cycle.
- **Log Query, 276 Go** : non attribuable avec les outils disponibles. Aucun script, workflow ni cockpit du dépôt n'interroge l'API des logs. Les candidats restent l'explorateur de logs et les rapports du tableau de bord, ainsi que les requêtes d'agents (MCP `query_logs`) faites pendant l'incident #962. Chaque requête parcourt sa fenêtre complète, jusqu'à 24 h. Le présent audit en a exécuté une quinzaine, au plus quelques Go. Pour obtenir la ventilation par origine, la demander au support Supabase. Ne pas l'extrapoler depuis le trafic API.
- **Egress** : non mesurable par les logs, car environ 60 % des réponses RPC n'ont pas de `content-length`. Lire la page Usage de l'organisation.
- La rétention des logs du plan Free limite l'historique consultable à environ un jour. Les comparaisons à 7 et 30 jours se feront avec le relevé quotidien proposé plus bas.

### Tableau source → volume → cause → action

| Source | Volume mesuré | Cause | Statut | Action | Gain |
|---|---|---|---|---|---|
| Tests navigateur CI vers la production | 21/11 : ~57 000 requêtes HeadlessChrome sur 126 000 (`daily_today`, `list_quest_challenges_v2`, `get_historical_performance`), environ 245 adresses de runners | Prouvée | Corrigé par #979. **Zéro** requête HeadlessChrome depuis le 22/11 à 12 h UTC, malgré les PR passées ensuite en CI | Conserver le blocage. Toute nouvelle suite doit bloquer les domaines de production | ~45 % des requêtes du 21/11 |
| Boucle de rejeu `ranking_begin`/`finish` | 22/11 de 11 h à 15 h UTC : ~58 000 appels pour moins de 80 parties. 14 561 appels à 11 h pour **une** partie | Prouvée (#962) | Corrigé par #981, #983 et #988 | Aucune | Pic de 31 000 requêtes/h |
| Séries résiduelles après 17:40 UTC | Un acteur Android (TWA) : 1 488 `begin` de 17:44 à 18:31 pour ~15 parties, environ un toutes les 2 s, puis rythme normal à partir de 19 h | Hypothèse forte : onglet TWA resté sur un JS antérieur à #988 (16:12 UTC) jusqu'à son rechargement. La TWA charge le site et n'embarque aucune copie | Arrêt constaté | Le cockpit outbox (#986) permet de confirmer la version | — |
| Rythme normal du classement | 19–22 h : ~3 `begin` par partie (283 parties, 3 à 6 joueurs) | Comportement attendu : `begin` au départ, puis `begin` et `finish` idempotents à la victoire | Normal | Fusion possible du second `begin` dans `finish` (à étudier) | ~1 requête/partie |
| Tâche pg_cron `lumen-play-acknowledge` | Toutes les 30 s : 1 Edge Function, 2 RPC, 1 ligne `net._http_response` et 1 ligne `cron.job_run_details`. 240 des ~256 requêtes/h au repos, ≈ 20 Mo/jour de logs, 86 000 invocations Edge/mois. 10 390 des 12 921 lignes de `cron.job_run_details` | Prouvée. File vide : 0 acquittement dû le 23/11 | **Corrigé ici** (`20261123060000_play_ack_cron_guard_995.sql`) | L'appel HTTP n'a lieu que si un claim ou un prune a du travail. Cadence passée de 30 s à 2 min (décision du propriétaire du 23/11), car pg_cron écrit toujours 2 lignes `postgres_logs` et 1 ligne `cron.job_run_details` par passage, soit ~85 % de `postgres_logs` | ≈ 94 % des logs API au repos (~0,6 Go/mois), puis −75 % des ~125 Mo/mois de `postgres_logs` restants |
| `lumen.analytics_events` | 134 Mo (tas 76 Mo, index 58 Mo), 163 742 lignes, **aucune insertion depuis le 26/10** | Stock historique. Collecte publique désactivée (#708) | Stable | Index redondants : `analytics_events_anon_idx` (14 Mo, 8 lectures) doublonne `anonymous_occurred_idx`, `occurred_idx` doublonne `occurred_at_idx`. Rétention à décider (voir [TECHNICAL_RETENTION_RUNBOOK](TECHNICAL_RETENTION_RUNBOOK.md)) | ~18 Mo ; doublons supprimés par `20261123062000_analytics_duplicate_indexes_995.sql` (décision du propriétaire du 23/11), uniquement si le jumeau identique existe |
| `net._http_response` | 20 Mo pour 732 lignes (TTL pg_net de 6 h) | Encombrement de la table après les appels cron | Diminuera avec la garde | Aucune purge manuelle nécessaire | — |
| `cron.job_run_details` | 8,4 Mo, croissance d'environ 2 900 lignes/jour avant la garde | Pas de rétention configurée. pg_cron journalise chaque exécution, même sans travail | **Corrigé ici** (`20261123061000_cron_run_details_retention_995.sql`, décision du propriétaire du 23/11 : 7 jours) | Purge quotidienne à 03:41 UTC des exécutions terminées de plus de 7 jours, par lots de 20 000 au maximum. Elle garde toujours la dernière exécution de chaque tâche, y compris la tâche mensuelle de SoldeZen, ainsi que les exécutions en cours | Plafond d'environ 20 000 lignes (~13 Mo) au lieu de ~1,9 Mo/jour sans limite |
| Worker et sondes d'exploitation | `claim_activity_mail` ~280/jour, sonde externe toutes les 5 min (#947) | Attendu | Borné | Aucune | — |
| Préflights CORS `OPTIONS` | ~10 % des requêtes du 21/11 | Inhérent aux appels navigateur | — | Non pilotable côté Lumen | — |
| Relecture du podium toutes les 30 s | Jusqu'à ~6 `lumen_ranking_board` par partie (312 lectures pour ~50 parties chez un joueur le 22/11) | Prouvée : le réveil de 30 s relisait le podium tant que l'écran de victoire restait ouvert | Corrigé par la PR #997 | Relecture seulement après un reçu réglé ou si le podium n'est pas prêt | Plusieurs requêtes par partie |
| Sauvegarde rapide refusée avant la commande de victoire | 166 erreurs `legacy victory command required` en 15 h (400 côté API, `ERROR` côté Postgres), pendant les heures de jeu | Le client tente le CAS par empreinte avant d'enregistrer la commande de victoire, puis l'enregistre et recommence | À étudier (persistance cloud, classe critique) | Ordonner commande puis sauvegarde côté client, sans changer le contrat | ~0,5 requête en erreur par victoire |
| Sauvegarde cloud (CAS + relecture) | `cas_profile_digest` et `get_progress` appariés, environ une paire par sauvegarde | Contrat de persistance : relecture serveur obligatoire | Conservé | Aucune réduction sans revue du contrat cloud | — |

Base de données : 198 Mo sur 500 Mo. Les données métier de `lumen_commands` pèsent **13 Mo** pour 72 comptes Auth partagés. Seuls 29 comptes se sont connectés dans les 30 derniers jours, ce qui ne correspond pas au MAU facturé.

### Projections de capacité

Hypothèses mesurées le 22/11 de 19 h à 22 h UTC : environ 25 requêtes API par partie terminée, en incluant classement, défis, aide et synchronisation. Une partie classée représente environ 3 Ko de données durables (reçus canoniques, autorité de quête, classement). Le scénario retient **10 parties par joueur actif et par jour**, soit environ 250 requêtes et 0,6 Mo de logs par joueur actif et par jour. Ces chiffres viennent d'un très petit échantillon, partiellement QA. Ils doivent être recalés avec le relevé quotidien.

| DAU | Log Ingestion/mois (Free : 1 Go) | Croissance base/mois (marge ~300 Mo) | Invocations Edge/mois (Free : 500 000) | MAU Auth (Free : 50 000) |
|---|---|---|---|---|
| 100 | ~1,9 Go | ~90 Mo, saturation en ~3 mois | Achats seulement | Non limitant |
| 500 | ~9 Go | ~450 Mo, saturation en < 1 mois | Non limitant | Non limitant |
| 1 000 | ~19 Go | ~0,9 Go, saturation en ~10 jours | Non limitant | Non limitant |
| 5 000 | ~94 Go | ~4,5 Go, saturation en ~2 jours | Non limitant | Non limitant |

**Premiers quotas limitants : egress et Log Ingestion**, à égalité autour de 50 à 60 joueurs actifs par jour. Le détail de l'egress figure plus bas, dans [la section hors logs](#hors-logs--capacité-sql-egress-et-sauvegardes-999). Pour les logs, la limite ne joue que si le dépassement est facturé ou bloquant après la période de grâce. Ces conditions restent à vérifier avant toute conclusion financière. Vient ensuite la **taille de base**, à partir de quelques centaines de joueurs actifs par jour. Leviers, par ordre de rendement :

1. Réduire les requêtes par partie : regrouper les lectures au chargement, mettre en cache côté client les listes stables (`daily_today`, `list_quest_challenges_v2`, performances historiques) et supprimer les appels redondants du classement.
2. Purger les tables techniques sans valeur métier. `cron.job_run_details` est traité par #995, à 7 jours. La politique d'`analytics_events` reste à définir.
3. Ne jamais réduire les reçus, l'outbox, les achats ni les preuves de progression pour gagner de la place.

Seuil de décision Pro : une projection qui atteint 85 % d'un quota bloquant avant la fin du cycle, sans levier sûr restant.

#### Sondage en arrière-plan (#999, 24/11/2026)

Page Usage du cycle 25/10 → 25/11 : l'ingestion de logs (0,915 / 1 Go, 92 %) est le premier plafond, bien avant l'egress (23 %). Sur 24 h, les premières sources de requêtes API étaient le statut d'assistance (`lumen_support`, 592) puis le social (`lumen_list_quest_challenges_v2`, `lumen_challenge_inbox`, `lumen_friend_list`, ~1 100). Supabase émet `SIGNED_IN` à chaque retour de focus, et chaque événement relisait l'assistance et la préférence de diagnostic. Le statut d'assistance et la préférence de diagnostic ne sont désormais relus qu'au changement de compte, à la reconnexion, à l'ouverture du diagnostic, sinon au plus toutes les 15 min. Le social, au retour sur l'appli, est relu au plus toutes les 3 min par compte ; l'ouverture du menu Social relit toujours immédiatement.

## Hors logs : capacité SQL, egress et sauvegardes (#999)

Audit en lecture seule du 23/11/2026 sur le même projet. `pg_stat_statements` est cumulé depuis le 01/08/2026. Toutes les mesures sont agrégées, sans contenu de profil ni identifiant de joueur.

| Poste | Mesure | Constat | Risque | Action proposée |
|---|---|---|---|---|
| **Taille du profil cloud** | `lumen.profile_snapshots` : 32 profils, 43 Ko de JSON en moyenne, 360 Ko au maximum (~5 Ko une fois compressé en base). `canonicalQuestState` pèse 54 % et `performances` 40 %, soit ~430 et ~100 octets par quête terminée | Croissance linéaire avec la progression : ~470 Ko pour un catalogue de 880 quêtes terminé. La limite serveur est de 1 Mo (`profile_size_limit_1mib`) | Egress, CPU et à terme la limite de 1 Mo | #1000 |
| **Relecture complète du profil** | `lumen_restore_profile` : ~600 appels le 22/11, jusqu'à un toutes les ~50 s pour un joueur actif. Elle est appelée après chaque commande canonique ou legacy et chaque CAS (`loadVerifiedProfile`) | Le contrat veut que la relecture serveur fasse foi. Elle renvoie aujourd'hui tout le profil | **Egress, probable premier quota limitant** : ~2,6 Mo par joueur actif et par jour, estimé à partir des appels × taille moyenne. Les 5 Go Free sont atteints vers 60 joueurs actifs par jour | #1000 : vérification par empreinte ou par quête, en gardant l'autorité serveur |
| **CPU des sauvegardes** | Temps SQL cumulé : `cas_profile_digest` 156 ms en moyenne, `cas_profile` 102 ms, `commit_quest_command` 294 ms, `commit_legacy_command` 215 ms | Traitement du JSON complet à chaque écriture. ~0,5 à 0,8 s de CPU base par victoire | Latence et instance Free partagée lors des pics | Même levier que l'egress. Mesurer `EXPLAIN` avant tout index |
| Refus de sauvegarde rapide | 19 % des `cas_profile_digest` refusés (`legacy victory command required`) | Ordre client entre commande et sauvegarde | Requêtes et logs inutiles | #998 |
| Classement et sondages | `ranking_board` relu toutes les 30 s sur l'écran de victoire | Corrigé par #997 | — | Mesurer après déploiement |
| Edge Functions | 2 921 invocations par jour, dont ~95 % pour la tâche Play | Corrigé par #995 (garde et cadence de 2 min) | Non limitant après correction | — |
| Auth, Realtime, Storage | ~290 événements Auth, < 10 Realtime et < 15 Storage par jour | Négligeables | — | Aucune |
| Conseils Supabase (Lumen) | RLS `lumen.entitlements` réévaluée par ligne. Clés étrangères non indexées sur de petites tables. Doublons d'index déjà supprimés (#995) | Faible enjeu à ce volume | — | Traiter seulement si une mesure le justifie |
| **Sauvegardes** | Le plan Free n'a **aucune** sauvegarde automatique (documentation Supabase : sauvegardes quotidiennes à partir de Pro) | Reçus, achats et progression n'ont pas de copie hors Supabase | **Perte de données irréversible** en cas d'incident projet | Export hebdomadaire chiffré, avec restauration testée : [BACKUP_RESTORE_999](BACKUP_RESTORE_999.md) |

Les deux autres produits du projet partagé (SoldeZen et ses applications) comptent dans les mêmes quotas de l'organisation. Ce tableau ne couvre que Lumen. Les projections supposent que leur consommation reste négligeable, ce qu'il faut vérifier sur la page Usage.

**Correction des projections.** L'estimation d'egress (~2,6 Mo par joueur actif et par jour) vient d'un échantillon de 10 joueurs très actifs, aux gros profils. Elle doit être recalée avec la valeur réelle de la page Usage. La base grossit surtout avec les **joueurs** (profil mis à jour sur place, ~5 à 50 Ko compressés chacun) et les reçus par partie, plus qu'avec les journaux.

**Sauvegarde (décision du propriétaire du 23/11 : artefacts GitHub chiffrés, `auth.users` et `auth.identities` inclus).** Export hebdomadaire chiffré avec `age`, avec contrôle de restauration et conservation 90 jours. Le contenu, la configuration et la procédure de restauration sont dans [BACKUP_RESTORE_999](BACKUP_RESTORE_999.md). Pour être actif, le workflow a besoin de deux réglages du propriétaire : le secret `LUMEN_BACKUP_DATABASE_URL` et la variable `LUMEN_BACKUP_AGE_RECIPIENT`.

### Politique d'observabilité frugale

- **Niveau 1, agrégats** : compteurs par RPC et par code de raison, versions et taille de base relevés au plus une fois par jour. Pas d'événement par interaction pour les statistiques ordinaires.
- **Niveau 2, événements actionnables** : erreurs inédites, avertissements utiles et transitions critiques (sync, ranking, RTDN, achat, Auth), avec version, code de raison et corrélation pseudonymisée. La première occurrence est toujours conservée, les répétitions sont comptées.
- **Niveau 3, diagnostic temporaire** : consentement explicite (#992), portée limitée à une session, durée courte. Jamais de DEBUG permanent, de payload complet, de token ou d'email.
- **Tâches planifiées** : une tâche fréquente vérifie en SQL qu'elle a du travail avant tout appel HTTP ou Edge, comme la garde de #995. Les boucles de retry restent bornées, avec backoff et jitter. Les refus définitifs sont archivés (#981, #983, #988).
- **Consultation des logs** : préférer les tables et RPC agrégées aux requêtes de logs. Pour une requête de logs, choisir la fenêtre la plus courte possible, sélectionner seulement les colonnes utiles et ne pas relancer la même requête en boucle. Chaque consultation compte dans Log Query.
- **Données durables** : reçus, progression confirmée, commandes idempotentes, outbox et achats ne sont pas des logs. Ils sont exclus de toute purge d'économie. Une panne de télémétrie ne bloque jamais le jeu.

### Garde-fous et alertes

- La sonde #947 et le bilan quotidien #949 existent déjà. Le prochain lot ajoutera au bilan une ligne de capacité calculée en SQL, sans lecture de logs : taille de la base, cinq plus grosses tables, lignes `cron.job_run_details` et RPC du jour si disponible. Seuils proposés : 50, 70, 85 et 95 % de 500 Mo, plus une projection de saturation sur 7 jours.
- Les quotas de logs (ingestion et consultation) ne sont pas lisibles depuis la base. Relevé manuel hebdomadaire sur la page Usage de l'organisation. Activer les notifications d'usage de Supabase si le plan Free les propose.
- **Plan d'urgence** si un quota approche : suspendre la télémétrie facultative (diagnostics, mesures de performance #948), espacer les sondes, interrompre toute consultation de logs automatisée. Le jeu, la synchronisation, les achats et la sécurité ne sont pas touchés.

### Recette de la garde #995

La fixture `scripts/fixtures/play-ack-cron-guard.sql` couvre plusieurs cas : file vide sans appel, achat nouveau dû, bail en cours non dû, jeton expiré dû pour le prune, réécriture idempotente, commande `voided` inchangée. En production, vérifier après application :

```sql
select command like '%play_acknowledgement_due()%' from cron.job where jobname='lumen-play-acknowledge';
```

Ensuite, contrôler qu'aucune requête `lumen_claim_play_acknowledgements` n'apparaît dans `edge_logs` sur une heure calme. Lors d'un vrai achat Play, l'acquittement en ligne reste inchangé. Si l'acquittement en ligne échoue, la reprise intervient au plus 2 min après l'échéance du bail. Google laisse 3 jours pour acquitter. **Retour arrière** : `cron.alter_job(<id>, schedule := '30 seconds', command := <commande sans la dernière ligne and …_due()>)`.

Rétention de l'historique pg_cron : la fixture `scripts/fixtures/cron-run-details-retention.sql` vérifie le refus en dessous d'un jour, les lots bornés, la conservation de la dernière exécution par tâche et des exécutions en cours, et l'idempotence. La place libérée est réutilisée par PostgreSQL. La table ne rétrécit pas sur disque sans `VACUUM FULL`, qui n'est pas nécessaire ici. **Retour arrière** : `select cron.unschedule('lumen-cron-run-details-retention');`. Les lignes déjà purgées ne se restaurent pas : ce sont des traces techniques de l'ordonnanceur, sans donnée joueur ni preuve métier.
