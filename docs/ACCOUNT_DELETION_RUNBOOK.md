# Demandes de suppression Lumen — préparation opérateur

## Canal livré dans cette branche

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
   Aucun script de cette branche ne supprime des comptes réels.

## Matrice de suppression à qualifier en environnement isolé

| Domaine | Données à couvrir / dépendance |
|---|---|
| Compte et progression Lumen | `users`, `profiles`, `progress`, `profile_snapshots`, `historical_performance`, `engagement_state`, `daily_progress`, `entitlements` |
| Transactions | `canonical_reward_events`, autorités et reçus `lumen_commands` : définir les besoins légitimes de conservation et la suppression/anonymisation correspondante, sans généraliser la rétention des logs |
| Support et activité | `analytics_events`, `analytics_excluded_actors`, `feedback`, `difficulty_ratings`, copies/export de support |
| Social | `social_challenges`, `social_challenge_participations` : préserver les autres participants sans conserver inutilement l'identité du demandeur |
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
La politique d'anonymisation sociale doit être décidée et testée avant exécution.

`recovery_backups` et la vue `player_analytics` n'ont pas RLS ; le contrôle de
privilèges ne donne aucun accès direct SELECT à `anon` ou `authenticated`
(ni DELETE à ce dernier) sur ces deux objets. Ce constat ciblé ne remplace
pas l'audit des RPC privilégiés ou des permissions d'un futur schéma familial.

## Risque de recréation après effacement

Le client actuel enregistre/retrouve son profil à la connexion et conserve des
copies locales/outbox. Une simple suppression de lignes ne suffit pas : une
ancienne session ou PWA pourrait recréer un profil ou retransmettre sa sauvegarde.
Avant d'offrir une suppression automatisée, définir et tester une révocation ou
barrière **propre à Lumen**, sa durée et la politique de réinscription explicite.
Ne pas rendre ce mécanisme global au projet Auth partagé par commodité.

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
