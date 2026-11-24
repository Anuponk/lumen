# Notifications du Défi du jour (#1032)

Le défi se découvre dans Lumen même si l’appareil refuse les notifications.
Le rappel facultatif de la V1 vise 18 h dans le fuseau courant de l’appareil.
L’heure de Paris continue de déterminer la date officielle du défi.

## État audité le 24 novembre 2026

- La réception Web Push existe dans le service worker de Lumen. Le client public
  historique enregistre une permission appareil et envoie ses choix à la
  fonction Supabase lumen-push, absente du dépôt.
- La version 13 de cette fonction tourne en production à la date de l’audit.
  Son job horaire envoie un rappel générique. Les colonnes historiques de
  rappel quotidien sont activées par défaut à 19 h et ne prouvent aucun
  consentement spécifique au Défi du jour.
- La version historique doit être revue avant la mise en service de la V1.
  Son code contient des identifiants secrets et ses opérations de souscription
  ne vérifient pas systématiquement le propriétaire. La remédiation et la
  rotation doivent être coordonnées avec le propriétaire et les parcours
  historiques #18. Les secrets restent hors Git et hors des rapports.
- Web Push évite un nouveau moteur pour Chrome desktop et Android TWA. Sur
  iPhone, la notification web nécessite une application ajoutée à l’écran
  d’accueil sur les versions compatibles et un geste utilisateur explicite.
  Vérifier l’installation TWA et iOS sur de vrais appareils avec le worker
  retenu avant d’annoncer la disponibilité. [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Contrat de la V1

La migration conserve les données historiques et crée trois tables privées dans
`lumen_commands`. `push_preferences` possède le choix quotidien et sa révision,
avec un état absent équivalent à désactivé. `push_devices` possède l’abonnement
et le fuseau de chaque appareil. `push_configuration` contient la clé publique
VAPID du déploiement. L’autorisation du système et la souscription du navigateur
restent propres à l’appareil. Les deux tables d’utilisateur suivent le processus
d’effacement Lumen. L’export conserve le choix et les métadonnées d’appareil.
Il masque l’endpoint et les clés de souscription.

`lumen_daily_push_v1` expose une réponse sans données d’abonnement. Son compte
provient d’une session Auth encore valide pour un profil Lumen. Le client
passe son identifiant de compte attendu pour bloquer un changement de compte
pendant une requête. Les options sont `read`, `enable`, `disable` et `unlink`.
La réponse donne la version du contrat, la disponibilité, l’état quotidien du
compte, le statut du seul appareil demandé, la révision, l’heure de rappel et
la clé publique si la fonctionnalité est disponible.

- `enable` nécessite une confirmation explicite, le numéro de révision actuel,
  un appareil, un abonnement d’un fournisseur Web Push prévu, un fuseau IANA
  et une langue FR, EN ou ES. Elle enregistre le choix et l’appareil ensemble.
- `disable` désactive le rappel au niveau du compte et avance la révision.
  `unlink` supprime l’abonnement d’un appareil du compte et avance aussi la
  révision. Les deux commandes restent disponibles si le drapeau est coupé.
- Une révision périmée est refusée. Relire l’état serveur avant toute nouvelle
  action. Si une réponse de désactivation est perdue, la relecture peut prouver
  que le choix est déjà désactivé. Une requête en attente ne vaut pas accord.
- Le drapeau `daily_push` est à `false` au départ. Sans clé publique configurée,
  le service reste indisponible même si le drapeau est activé. Les anciennes
  permissions ou lignes d’abonnement n’accordent aucun nouveau consentement.

## Réglage et réception dans Lumen

Le menu de compte affiche le réglage quand l’inscription est disponible ou
qu’un compte a déjà donné son accord. La première proposition suit un résultat
officiel confirmé. « Plus tard » masque les propositions suivantes sur cet
appareil, sans fermer l’accès volontaire au réglage. La permission système
n’est demandée qu’au clic d’activation. Le réglage distingue le choix du
compte de la permission et de la souscription de l’appareil.

Le worker sous `/src/ui/notifications/` garde sa propre inscription.
Le rappel expiré est ignoré ou fermé au clic. La destination est le défi
courant de la même origine. Lors d’un changement de compte, le client tente
de couper la réception locale et de retirer l’inscription de cet appareil.
Le worker de la page principale conserve le traitement historique.

## Envoi du rappel et mise en service

La fonction Edge `lumen-daily-push-dispatch` utilise le transport Web Push
épinglé et un secret Bearer propre au job. Configurer hors Git
`LUMEN_DAILY_PUSH_JOB_TOKEN`, `LUMEN_DAILY_PUSH_VAPID_SUBJECT`,
`LUMEN_DAILY_PUSH_VAPID_PUBLIC_KEY` et `LUMEN_DAILY_PUSH_VAPID_PRIVATE_KEY`.
La paire VAPID est dédiée à la nouvelle inscription. La clé publique
du drapeau et celle utilisée par l’envoi doivent concorder.
Le mode `--no-verify-jwt` laisse la fonction authentifier le job avec son
secret distinct de la clé Supabase de service. Conserver les deux secrets
côté serveur.

Le job appelle la fonction en POST sans paramètre toutes les cinq minutes
lorsqu’il est déployé. Une exécution traite jusqu’à 20 réservations, quatre
en parallèle. L’autorisation SQL est requise juste avant le fournisseur.
Une réponse ambiguë ne déclenche aucun nouvel envoi. Un 404 ou un 410 permet
le retrait exact d’un abonnement périmé. Le POST avec `?action=cleanup` est
réservé au même job pour l’entretien périodique. Les réponses exposent des
comptages agrégés, sans identifiant, endpoint ni secret.

La migration, la fonction et le job doivent passer par un environnement
isolé et une recette réelle avant l’activation. La PR n’installe aucun job.

## Étapes de livraison

1. Recetter le réglage Compte et son inscription volontaire. L’abonnement
   historique garde son choix d’origine. Le nouveau rappel reste désactivé
   pendant le développement du traitement d’envoi.
2. Terminer le raccordement et la recette d’envoi dans [#1034](https://github.com/Anuponk/lumen/issues/1034). Une requête groupée doit exclure les
   comptes dont le défi est déjà terminé via `daily_runs` et revérifier le
   drapeau, le choix et l’appareil avant l’envoi. Réserver une clé unique par
   appareil et jour de Paris. Limiter les tentatives, purger les abonnements
   expirés et ne pas réessayer un résultat ambigu. Le service worker doit laisser
   expirer un rappel et ouvrir le défi courant avec `/?daily=1`.
3. Faire la recette sur TWA Android, PWA iPhone installée et desktop, avec des
   comptes isolés. Vérifier le geste de consentement, les trois langues, la
   révocation, les deux appareils, minuit Paris, le changement de fuseau et une
   charge en lot. À cinq minutes par lot, un appel périodique représente au
   plus 8 928 invocations sur 31 jours, avant les appels interactifs et les
   autres services de l’organisation. Vérifier la consommation réelle avant
   d’activer un job. [Quotas des Edge Functions Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)
4. Traiter les catégories sociales et de résultats dans [#1035](https://github.com/Anuponk/lumen/issues/1035). Réutiliser la collecte
   d’événements autorisée de #708 pour la mesure agrégée dans [#1036](https://github.com/Anuponk/lumen/issues/1036).

La migration et le code sont des opérations séparées du passage en production.
Le lot de livraison nécessite des secrets fournis hors Git et le feu vert actif
du propriétaire après la recette. Pour suspendre le service V1, couper le drapeau
et arrêter le job de livraison une fois qu’il existe. Conserver les retraits
d’accord et les abonnements sous leur contrat de stockage.

## Vérification automatisée

`scripts/fixtures/daily-push-1032.sql` applique les contrôles de droits du rôle
hébergé, la séparation compte/appareil, le drapeau coupé, le consentement
explicite, la révocation avec révision et le masquage des clés dans l’export.
Le workflow de régression SQL existant applique deux fois la migration sur un
PostgreSQL isolé. Il ne contacte aucun service de notification.
