# Demandes de suppression Lumen — procédure opérateur

## Canal livré dans cette branche

Actualisation P0 du 25 octobre : [audit comparatif, inventaire, état observé et
conditions](PRIVACY_P0_CONSOLIDATION.md). Les chiffres « 29 relations / 26 tables »
ci-dessous décrivent le périmètre historique du 22 octobre ; la politique actuelle
reconnaît aussi les relations récentes lorsqu'elles sont installées.

### Extension diagnostics, commandes et assistance

`policy()` couvre diagnostics/préférences/budgets individuels, autorités de run,
reçus invités, cohortes/événements et archives de récupération d'acquis. Règles et
contrôles globaux sont conservés. Aucune règle de synchronisation n'est modifiée.
Pour #593, l'ordre est contenus → consultations → captures → dossiers ; les logs
sans FK sont rattachés avant de perdre l'ID de dossier. Une consultation effectuée
par le demandeur en tant qu'administrateur est aussi effacée ; les autres dossiers
et participants restent intacts. Aucun délai de conservation légal n'est inventé.

Les anciens IDs de dossiers deviennent des empreintes `key` supplémentaires dans
la barrière, préfixées `support:`. Ils empêchent une insertion tardive de log ou de
capture sans recréer un dossier supprimé. Même propriétaire, conservation et revue
de réinscription que les autres barrières ; aucune donnée métier n'y est copiée.

`support_access.privacy_owner_id` conserve le rattachement serveur quand le cron
supprime le dossier. Ce champ est privé, suit l'expiration du journal et la demande
d'effacement, et n'est jamais exporté au demandeur. Une trace ancienne déjà
orpheline sans rattachement bloque l'effacement : revue ou expiration réelle
vérifiée, pas de déduction de propriétaire ni de purge générale d'autres joueurs.

L'absence complète du support reste compatible ; une installation ultérieure doit
appeler `lumen_privacy.install_guards()` dans sa transaction propriétaire avant
activation. Vérifier ensuite `review_erasure`. Ne pas changer le SQL déjà appliqué
de #593. Une garde de mauvais type, condition ou arguments bloque la revue.

Suivi privé d'une demande : reçu → identité vérifiée → périmètre approuvé →
transaction effectuée → contrôles des copies/fournisseurs → réponse. Une erreur,
un timeout, une limite fournisseur ou une suppression partielle maintient le
dossier ouvert avec son résultat exact ; jamais « Compte supprimé » par défaut.

`/supprimer-compte.html` prépare un email au contact de Nopuna, également
accessible par « Supprimer mon compte » dans l'application. Aucun login ni
réinstallation n'est exigé pour accéder à ce canal. Sans JavaScript, un lien
mailto direct reste disponible. Le navigateur ne soumet aucune requête à Auth
ou à la base ; le joueur doit envoyer son message dans sa messagerie.

Le formulaire demande l'adresse du compte et une confirmation. Il ne collecte
ni mot de passe, jeton, sauvegarde, document d'identité ni date de naissance.
Une autre adresse de contact reste utilisable lorsque le joueur a perdu son accès.
Ce canal permet de **demander** la suppression ; il ne démontre pas que le
processus opérateur ci-dessous a été exécuté ou validé.

## Qualification et autorisations

1. Accuser réception, dater la demande et expliquer la vérification nécessaire
   ainsi que le délai applicable. Ne pas annoncer que les données sont effacées.
2. Vérifier de façon proportionnée l'identité/droit à agir et la portée Lumen,
   notamment pour un parent. Une adresse saisie dans un formulaire non authentifié
   ne prouve pas la propriété d'un compte.
3. Résoudre l'identité serveur, les acteurs anonymes réellement rattachés et les
   dépendances à partir de preuves ; ne pas effacer tous les acteurs mentionnant
   simplement un nom ou une adresse. Faire valider les cas ambigus.
4. Inventorier les éventuels autres services de l'identité partagée. Une demande
   Lumen ne doit pas supprimer SoldeZen. `auth.admin.deleteUser` global ne constitue
   pas une implémentation sûre de ce processus.
5. Faire approuver l'opération et sa portée, puis employer un opérateur autorisé.
   La migration préparée n'est pas appliquée en production. Ne jamais exécuter
   les fixtures sur des comptes réels ; l'opération exige une demande vérifiée.

## Matrice du mécanisme préparé, à qualifier avant production

| Domaine | Données à couvrir / dépendance |
|---|---|
| Compte et progression Lumen | `users`, `profiles`, `progress`, `profile_snapshots`, `historical_performance`, `engagement_state`, `daily_progress`, `entitlements` |
| Transactions | `canonical_reward_events`, autorités et reçus `lumen_commands` : effacement Lumen demandé, sans exception financière inventée ; barrière distincte contre la résurrection |
| Support et activité | `analytics_events`, `analytics_excluded_actors`, `feedback`, `difficulty_ratings`, copies/export de support |
| Social | `social_challenges` : créateur désidentifié ; `social_challenge_participations` : participations du demandeur supprimées, autres joueurs préservés |
| Notifications et exploitation | `lumen_push_subscriptions`, `lumen_sync_health`, `outbox_health`, `internal_capabilities`, `recovery_backups`, `lumen_admin_player_snapshot` et caches dérivés |
| Fournisseurs et sauvegardes | Email, logs, sauvegardes et tiers : connaître les destinataires, délais et exceptions avant de confirmer la clôture |
| Auth commune et autres applications | Déterminer la portée autorisée et la conservation nécessaire pour les autres services ; ne pas appliquer de cascade globale |

Le schéma évolue : rapprocher cette liste des tables, clés étrangères, triggers,
fonctions et données dérivées réelles avant toute exécution. Les sélections sur
un `anonymous_id` seulement déclaré par le demandeur sont insuffisantes.

### Vérification du catalogue — 22 octobre 2026

La requête [d'inventaire](../supabase/tests/privacy_catalog_inventory.sql) a été
exécutée en lecture seule sur les métadonnées du schéma, sans lire de lignes de
joueurs ni d'identités Auth. Elle inventorie tables/vues, colonnes, droits directs
et clés étrangères ; elle ne supprime rien et ne prouve pas l'effacement.

Les références Auth de `analytics_events`, `difficulty_ratings`, `feedback`,
`historical_performance`, `social_challenges` et des participations utilisent
`ON DELETE SET NULL` : effacer une identité Auth laisserait donc notamment des
identifiants anonymes, pseudos, textes et propriétés. Les cascades des profils
et reçus ne couvrent pas ces données. Les sauvegardes de récupération et les
copies de cockpit exigent également un traitement explicite.

Une participation référence son défi avec `ON DELETE CASCADE` : supprimer
simplement le défi d'un demandeur peut affecter les autres participants.
La procédure préparée anonymise le créateur et préserve les autres participants ;
ses tests isolés doivent passer avant toute exécution réelle.

Le contrôle complémentaire des FK **entrantes**, tous schémas sources compris,
ne relève que la référence aux règles canoniques (NO ACTION) et celle des
participations vers les défis (CASCADE). Aucune autre FK vers une table Lumen
n'est présente dans ce catalogue au 22 octobre. Une fixture ajoute exprès une
cascade depuis une autre application : rouge avant le garde-fou de dépendances,
verte après, sans toucher à la base réelle.

`recovery_backups` et la vue `player_analytics` n'ont pas RLS ; le contrôle de
privilèges ne donne aucun accès direct SELECT à `anon` ou `authenticated`
(ni DELETE à ce dernier) sur ces deux objets. Ce constat ciblé ne remplace
pas l'audit des RPC privilégiés ou des permissions d'un futur schéma familial.

## Risque de recréation après effacement

Le client actuel enregistre/retrouve son profil à la connexion et conserve des
copies locales/outbox. Une simple suppression de lignes ne suffit pas : une
ancienne session ou PWA pourrait recréer un profil ou retransmettre sa sauvegarde.
La migration ci-dessous prépare une barrière **propre à Lumen**, sans révocation
des sessions Auth communes ni suppression automatique côté navigateur.
Sa conservation et ses limites doivent figurer dans l'information au demandeur
et la politique validée avant activation.

Ne pas effacer localement les intentions d'un autre compte pour afficher une
fausse réussite. Le nettoyage de l'appareil du demandeur doit être explicite,
limité à la portée adéquate et réalisé après l'exécution vérifiée ; les anciennes
copies sur d'autres appareils et les droits des autres utilisateurs restent à tester.

## Preuve de recette requise avant clôture

En environnement isolé, créer un compte synthétique avec données Lumen et
autre application, puis couvrir : progression, reçus, défi à deux participants,
feedback, notifications, cache administratif et sauvegarde de récupération.

Tester demande invalide, compte tiers, parent, doublon, panne à mi-opération,
compte exclusivement Lumen et compte partagé. Vérifier après traitement :
effacement/anonymisation des données prévues, exceptions documentées, données
de l'autre application intactes, retry idempotent, sessions/anciens appareils et
réinscription sans résurrection involontaire des copies. Refaire sur le futur AAB.

Consigner version, contexte, catégories traitées et résultat, sans reproduire
de sauvegarde complète ou jeton dans le ticket. Répondre au demandeur avec les
résultats et éventuelles limites fondées. Le test de préparation d'un email ne
remplace aucune de ces étapes : `accountDeletionEndToEnd` reste non vérifié.

## Mécanisme livré pour revue — non appliqué en production

Migration : `20261022160212_lumen_account_erasure.sql`. Le schéma privé
`lumen_privacy` ne comporte aucun RPC public. Seul le propriétaire de la base
peut appeler `review_erasure(uuid,text[])` et `erase_account(uuid,text[],text)`.
`anon`, `authenticated` et `service_role` n'ont ni usage du schéma, ni droit de
lecture ou d'exécution. Une session ayant un `auth.uid()` est refusée.

Le tableau d'acteurs contient des identifiants anonymes **déjà vérifiés par
l'opérateur**, jamais déduits automatiquement du formulaire, d'un pseudo ou
d'un événement analytics déclaratif. La revue refuse un acteur lié au compte
mais omis, ou un acteur/player key lié à un autre compte. Résoudre toute
ambiguïté avant l'effacement ; aucun parcours parental n'est activé.

La politique couvre les 29 relations inventoriées : suppression dans 25 tables,
anonymisation du créateur de `social_challenges`, conservation des deux tables
de règles et de la vue dérivée. Reçus, autorités, sauvegardes de récupération,
feedback, notifications et caches Lumen sont inclus. Aucune exception financière
n'est inventée pour cette version gratuite. Le créateur du défi devient
NULL/« Compte supprimé » ; son résultat de référence sans identité et les autres
participants restent, tandis que ses propres participations sont supprimées.

### Barrière et conservation proposée

Les seules métadonnées conservées dans la barrière sont le type, l'empreinte
SHA-256 des UID/acteurs/player keys et la date d'effacement. Elles sont
**pseudonymisées**, pas anonymes : aucun email, profil, message ou reçu recopié.
Conservation proposée : tant que l'identité partagée ou d'anciennes copies
peuvent réécrire dans Lumen. Aucune purge automatique ou réinscription implicite
n'est prévue. Retirer une barrière exige une décision de réinscription et une
revue des anciennes copies. Ce n'est pas le délai de 30 jours des observations.

Les 26 tables de données ont une garde INSERT/UPDATE. Ancien UID, acteur ou
player key, même via RPC privilégiée ou JWT encore valide : refus
`42501 / LUMEN_ACCOUNT_ERASED`. READ COMMITTED est exigé ; les écritures en
REPEATABLE READ/SERIALIZABLE sont refusées pour empêcher une ancienne vue des
données de contourner la barrière. Ne pas présenter ce refus comme une victoire
confirmée, vider une outbox ou changer d'acteur pour le contourner.

L'opération prend des locks SHARE ROW EXCLUSIVE dans un ordre stable sur les
tables de données puis refait la revue. Elle attend les écritures en cours et
bloque les nouvelles pendant cette opération manuelle. Toute erreur annule
effacement et barrière ; le retry est idempotent. Prévoir une fenêtre calme et
des délais bornés. Ne jamais contourner un lock ou désactiver les triggers.

### Exécution après autorisation de production

1. Vérifier l'autorisation explicite et l'application de la migration, la CI
   PostgreSQL 17, la demande, les acteurs et le périmètre. Aucun test synthétique
   en production ; ne jamais appeler `auth.admin.deleteUser` pour cette demande.
2. Dans une session propriétaire dédiée (`auth.uid()` NULL), appeler seulement
   `lumen_privacy.review_erasure(uid, acteurs_verifies)` pour examiner les
   comptages par catégorie. Cette revue ne modifie pas les données. Inventorier
   séparément les fournisseurs, exports, copies de support et backups physiques.
3. Après contrôle, ouvrir une transaction READ COMMITTED ; fixer
   `SET LOCAL lock_timeout='5s'` et `SET LOCAL statement_timeout='60s'` ; appeler
   `lumen_privacy.erase_account(uid, acteurs_verifies, 'ERASE LUMEN ' || uid)`.
   COMMIT uniquement si le résultat correspond à la demande, sinon ROLLBACK.
4. Refaire les contrôles appropriés. Consigner seulement version, catégories et
   résultat dans le ticket privé, sans profils, jetons ou identifiants publics.
5. Confirmer l'effacement logique Lumen et les limites réelles : identité commune,
   défi désidentifié, barrière, copies locales, sauvegardes physiques/fournisseurs.
   Ne pas promettre leur purge sans preuve. Le nettoyage d'appareil reste
   explicite et ne doit pas effacer un autre compte.

### Maintenance et limites de preuve

Une nouvelle table Lumen, une garde désactivée ou une nouvelle colonne sociale
non couverte bloque l'opération. Une nouvelle FK entrante, même depuis une autre
application, exige une revue : seule la référence connue au défi est permise,
car son ID ne change pas lors de l'anonymisation. Toute évolution (notamment famille) doit mettre
à jour politique, triggers et tests **avant activation**, pour les comptes déjà
effacés aussi. Ne pas retirer les gardes lors d'un retour à l'ancien code.

Les fixtures `account-erasure-bootstrap.sql` / `account-erasure.sql` et
`account-erasure-concurrency.py` sont réservées aux bases jetables. Elles
couvrent toutes les tables, portée ambiguë, accès, rollback, retry, anciens
clients, autres participants et autre application. PGlite 0.5.11 / PostgreSQL
18.6 vérifie localement le SQL ; seule la CI PostgreSQL 17 vérifie les vraies
connexions concurrentes. Cela ne prouve ni purge fournisseur, ni recette native,
ni autorité parentale. `accountDeletionEndToEnd` reste une validation séparée.

Références techniques : [locks PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html)
et [visibilité des fonctions VOLATILE](https://www.postgresql.org/docs/17/xfunc-volatility.html).
