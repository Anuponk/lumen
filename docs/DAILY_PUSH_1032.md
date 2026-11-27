# Notifications du Défi du jour (#1032)

Le défi se découvre dans Lumen même si l’appareil refuse les notifications.
Le rappel facultatif de la V1 vise 18 h dans le fuseau courant de l’appareil.
L’heure de Paris continue de déterminer la date officielle du défi.

## État audité le 24 novembre 2026

### Recette privée du 27 novembre 2026 (#1034)

Le retour Android après la version web 1.11.1+804 a révélé un second prérequis
dans le wrapper : `BillingDelegationService` hérite déjà du service de délégation
des notifications, mais le manifeste omettait `POST_NOTIFICATIONS` et
`NotificationPermissionRequestActivity`. Le correctif les déclare avec une
activité non exportée et l'icône monochrome existante. Android Browser Helper
peut alors traiter la demande issue du clic web explicite. Rien n'est demandé
automatiquement au démarrage. Cette correction exige un **nouveau paquet Android
installé** ; une publication web ou une mise à jour du service worker ne modifie
pas le manifeste de l'application déjà installée. La compilation CI et les
contrôles du manifeste ne prouvent pas la réception sur appareil physique.
Pendant une demande, l'interface affiche l'opération en cours au lieu du seul
état « Rappels désactivés » ; après un échec résolu, le bouton redevient utilisable.

Références du parcours natif : [activité de permission ABH](https://github.com/GoogleChrome/android-browser-helper/blob/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/NotificationPermissionRequestActivity.java),
[service de délégation AndroidX](https://developer.android.com/reference/androidx/browser/trusted/TrustedWebActivityService).

Le menu **Compte → Notifications** était absent car `daily_push=false` masquait
les réglages pour tous les comptes. Le serveur accepte désormais soit ce drapeau
public, soit la capacité privée `daily_push_preview`, valide et non expirée pour
le compte courant. La migration n'accorde cette capacité à personne. L'opération
de recette l'accorde séparément aux seuls comptes nommément autorisés, dont le
propriétaire. Le drapeau public reste désactivé. Le lot de 18 h revalide cette même
autorisation pour chaque destinataire avant d'envoyer.

Après une mise à jour de Lumen, se connecter au compte autorisé, ouvrir **Mon espace →
À propos → Notifications**, puis choisir **Activer sur cet appareil** et accepter la permission
du navigateur. Sur iPhone, ouvrir la PWA installée sur l'écran d'accueil avec un
système compatible Web Push. Une permission refusée se rétablit dans les réglages
du navigateur ou du système. Le menu indique les appareils non compatibles.

Le bouton **Envoyer ou vérifier le test** apparaît après l'inscription de cet
appareil. Un clic demande un test immédiat, même hors de la fenêtre de 18 h et
après avoir terminé le défi. Recliquer quelques secondes après consulte le résultat
sans nouvel envoi. Une seule tentative par appareil, endpoint et jour de Paris
est autorisée. Le succès affiché signifie que le fournisseur a accepté le message,
pas que l'appareil l'a reçu. Vérifier la notification « Test · Défi du jour »
(FR/EN/ES), puis son ouverture dans le défi. La réception réelle reste à constater.

`lumen_daily_push_test_v1` vérifie la session réelle, le propriétaire, la capacité,
le consentement et l'appareil avant de réserver puis de mettre en file un appel
au worker. Aucun secret ne sort de SQL/Vault. Le worker n'accepte que le secret
du job et une réservation UUID bornée. `lumen_authorize_test_push_v1` est réservé
au service et revalide le consentement, la capacité et la souscription avant une
autorisation unique. `push_test_dispatches` est privé, sous RLS, avec effacement
par compte et rétention de sept jours. Ses tickets et tags sont distincts de ceux
du rappel quotidien. Les issues restent en cours tant que la réception du test
par le propriétaire n'est pas démontrée.

Impact Free-first de la recette, par appareil et par jour : au plus un appel Edge
et un appel fournisseur ; un RPC par clic explicite, sans polling ni Realtime.
Les consultations répétées ne relancent aucun HTTP. Le job quotidien conserve
son contrôle SQL de travail dû avant HTTP. Révoquer `daily_push_preview` suspend
la recette privée ; couper seulement le drapeau public ne révoque pas cette
autorisation dédiée. Ne pas accorder cette capacité publiquement et ne pas
activer `daily_push` avant la décision distincte du propriétaire.

Les tests JS couvrent le menu, le consentement, l'isolation de compte, les tags
et le dispatch distinct. `scripts/fixtures/private-push-rehearsal-1034.sql`
vérifie les droits, l'inscription, la révocation et la déduplication avec un
transport synthétique. La CI réapplique deux fois la migration et rejoue les
contrats historiques de préférences et de dispatch.

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
pendant une requête. Les options sont `read`, `enable`, `disable`, `unlink` et `refresh`.
La réponse donne la version du contrat, la disponibilité, l’état quotidien du
compte, le statut du seul appareil demandé, la révision, l’heure de rappel et
la clé publique si la fonctionnalité est disponible.

- `enable` nécessite une confirmation explicite, le numéro de révision actuel,
  un appareil, un abonnement d’un fournisseur Web Push prévu, un fuseau IANA
  et une langue FR, EN ou ES. Elle enregistre le choix et l’appareil ensemble.
- `disable` désactive le rappel au niveau du compte et avance la révision.
  `unlink` supprime l’abonnement d’un appareil du compte et avance aussi la
  révision. Les deux commandes restent disponibles si le drapeau est coupé.
- `refresh` actualise le fuseau, la langue et l'activité d'un appareil déjà
  inscrit. Elle requiert l'accord et la révision en cours. Le navigateur
  la déclenche au retour dans Lumen après un changement ou au bout de 30 jours
  d'activité depuis le dernier enregistrement. L'accord, sa révision et les
  clés de l'inscription restent identiques.
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

## Réservation et envoi (#1034)

Quatre RPC sont réservées au rôle serveur. Elles utilisent l’horloge de la base.
La réserve découvre au plus 50 appareils par appel entre 18 h et 18 h 15
dans leur fuseau IANA. Elle exige `daily_challenge` et l'autorisation push du compte
(`daily_push` ou capacité privée de recette), une
clé publique configurée, une grille publiée pour la date de Paris, le
consentement en cours et un appareil actif. Une partie terminée dans
`daily_runs` exclut tous les appareils du compte. Le ticket de réserve dure
90 secondes au plus et ne contient aucun abonnement.

- `lumen_reserve_daily_push_v1` reçoit `p_limit`. Elle renvoie une liste
  de tickets contenant chacun `reservationId`. Deux opérateurs concurrents
  ne peuvent pas réserver deux fois le même appareil ou le même endpoint
  pour un jour de Paris.
- `lumen_authorize_daily_push_v1` reçoit `p_reservation_id`. Elle vérifie
  à nouveau la disponibilité, la partie terminée, la révision du consentement
  et l’abonnement exact. Au premier passage autorisé, elle renvoie
  `reservationId`, `challengeDay`, `expiresAt`, `locale`, `vapidPublicKey`
  et `subscription`. L’expiration correspond à la première limite entre
  18 h 15 sur l’appareil et minuit à Paris.
- `lumen_finish_daily_push_v1` reçoit `p_reservation_id` et `p_outcome`.
  Elle conserve le premier résultat terminal parmi `sent`, `expired`,
  `rejected` et `ambiguous`. Seuls les retours 404 ou 410 du fournisseur
  justifient `expired`, qui peut supprimer l’abonnement exact utilisé.
  Un changement des clés ou de l’appareil entre-temps empêche cette purge.
- `lumen_cleanup_daily_push_v1` marque les tickets de réserve périmés
  comme ignorés et les envois autorisés sans résultat comme ambigus.
  Elle purge les tickets de réservation vieux de plus de sept jours
  de Paris et les appareils sans renouvellement depuis 90 jours.

L’autorisation ne peut fournir les données d’envoi qu’une fois. Si sa réponse
est perdue ou si le fournisseur ne donne aucun résultat certain, le
traitement ne réessaie ni l’autorisation ni l’envoi. Un rappel peut alors
être manqué, en échange d’une protection contre la double notification.
Aucune clé privée ni donnée brute d’abonnement ne figure dans les tickets
de réserve. Le journal de déduplication contient seulement des empreintes et
des métadonnées de réservation. Les deux suivent l’effacement Lumen.

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

1. Valider le réglage Compte, la permission et l'inscription volontaire en
   environnement isolé. Le nouveau rappel reste désactivé en production.
2. Raccorder la fonction et le job sur l'environnement de recette
   ([#1034](https://github.com/Anuponk/lumen/issues/1034)). Vérifier la clé
   VAPID, l'autorisation juste avant envoi et le retrait des abonnements expirés.
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
Le lot public nécessite des secrets fournis hors Git et le feu vert actif
du propriétaire après la recette ; la recette privée suit l'autorisation du
26 novembre décrite plus haut. Pour suspendre le service V1, révoquer les capacités
de recette, couper le drapeau
et arrêter le job de livraison une fois qu’il existe. Conserver les retraits
d’accord et les abonnements sous leur contrat de stockage.

## Vérification automatisée

`scripts/fixtures/daily-push-1032.sql` applique les contrôles de droits du rôle
hébergé, la séparation compte/appareil, le drapeau coupé, le consentement
explicite, la révocation avec révision et le masquage des clés dans l’export.
Le workflow de régression SQL existant applique deux fois la migration sur un
PostgreSQL isolé. Il ne contacte aucun service de notification.

`scripts/fixtures/daily-push-dispatch-1034.sql` exécute le contrat de réserve
et de nettoyage. Les cas couvrent le passage à l’heure d’été en France, le
changement de jour à Paris pendant 18 h à Chicago, la révocation et la
complétion entre la réserve et l’autorisation, l’échec ambigu et la purge
conditionnelle. Aucun fournisseur n’est contacté par ce test.
