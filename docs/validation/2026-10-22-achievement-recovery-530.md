# Reprise des succès après renouvellement de session — #530

Base reproduite : `d5d748433838c87d9d4671681eb3a32b28e30d6d` (version signalée
1.11.1+492). Branche isolée depuis `main`, sans les changements non livrés des
PR #526 et #527. Aucun profil joueur lu, exporté ou réparé.

## Ce qui est démontré

Deux assertions échouaient avant correction :

1. Un serveur conserve la même victoire canonique, ses étoiles et sa performance
   d'origine, mais ajoute un badge obtenu en rejouant. `cloudSafelyCoversLocal`
   refusait cette copie comme si la récompense immuable avait changé.
2. Avec un solde restant à vérifier, `reconcileCloudAchievements` levait le même
   conflit et ne pouvait pas récupérer ce badge. Le diagnostic UI regroupait ce
   cas avec quota, accès stockage et échec de vérification de sauvegarde.

La reproduction synthétique correspond à une voie possible du signalement ;
le journal public ne contient pas les deux profils et ne permet pas d'affirmer
que ce badge est la cause du blocage du téléphone concerné. Les nouveaux
diagnostics servent aussi à qualifier les vrais conflits encore inconnus.

## Frontière de sécurité conservée

Une autre assertion rouge a démontré un contrôle de session manquant : un
changement A → B pendant les lectures daily pouvait marquer B prêt à partir
du profil A, même si leurs données de jeu étaient identiques. La session
capturée est maintenant revérifiée après les lectures daily, leur éventuel CAS
et chaque attente de réconciliation. Le test couvre les trois interruptions
daily/réconciliation dominante/réconciliation compatible, avec conservation du
cache du nouvel utilisateur et sans installation de la baseline de l'ancien.

La copie serveur couvre une entrée locale seulement si tous les champs hors
badges sont identiques. Les badges reconnus `autonomy`, `speed`, `noError` et
`mastery` peuvent passer d'absents/non obtenus à obtenus ; aucun badge déjà acquis
ne peut disparaître. Toute différence de badge inconnu, d'étoiles, de performance
initiale ou d'autre champ reste refusée. Le client ne compose pas une nouvelle
récompense : il conserve l'entrée exacte du serveur préalablement vérifié.

La récupération partielle garde le solde, le curseur de portefeuille, XP, daily
et autres récompenses locales. Elle ne valide aucune intention en attente,
n'appelle aucune commande d'attribution et ne rend pas `profileReady` vrai.
Un solde divergent sans preuve reste bloqué ; seul le parcours normal, après
lecture serveur cohérente et installation vérifiée, peut lever le blocage.
À cet instant seulement, l'ancien état d'échec de réconciliation est effacé.

## Diagnostic et reprise utilisateur

Les causes sont distinctes : conflit canonique, quota, stockage inaccessible,
sauvegarde non vérifiée, installation non vérifiée, profil local invalide ou
échec non classé. Les noms de champs sont limités à une liste fixe. L'identité
d'une quête n'entre dans le diagnostic local que si elle figure au catalogue
public ; aucune clé arbitraire, valeur de récompense ou erreur fournisseur n'est
recopiée. La télémétrie transmet uniquement la raison fixe et l'état blocked,
via l'événement existant `hydration_reconciliation`, même si le journal local
ne peut pas être écrit. Aucun RPC, schéma ou paramètre Auth nouveau.

Le diagnostic général de réconciliation utilise la même frontière : identifiant
du catalogue public (ou index historique réellement présent), champs du contrat
et noms de propriétés autorisés. Une assertion rouge a démontré qu'une clé
privée pouvait auparavant apparaître avant même la récupération partielle.
Le test textuel antérieur est remplacé par l'exécution du formateur réel, en
conservant l'identité exacte d'une quête connue et en refusant les clés privées.

Le compte affiche que les données sont conservées, et précise le problème de
stockage lorsqu'il est identifié. L'action existante « Réessayer » reste une
nouvelle hydratation, sans effacement du stockage ni acquittement artificiel.

## Couverture ajoutée

`scripts/cloud-achievements-session-recovery-tests.mjs`, inclus au quality gate :

- couverture du badge serveur dans un seul sens, récupération et répétition
  idempotentes, solde non confirmé préservé, reprise avec curseur serveur ultérieur ;
- vrais conflits (étoiles, performance, perte de badge, champ inconnu), quota et
  sauvegarde silencieusement refusée : octets du profil local inchangés ;
- diagnostics sans données privées et messages de statut sans fausse confirmation ;
- toutes les 256 paires de combinaisons des quatre badges reconnus, sans perte
  de badge ; clé de quête privée/inconnue exclue des diagnostics du hook réel ;
- véritable hook de production exécuté en VM avec les deux ordres de
  `SIGNED_IN` / `INITIAL_SESSION`, contrôleur Auth réel, capture réellement
  archivée par l'outbox durable et portefeuille conservé par son adaptateur de
  secours ; redémarrage/retry sans nouvelle commande ni disparition des preuves ;
- blocage explicite sur conflit/quota, puis état prêt et ancien échec retiré
  seulement après retour à un profil serveur cohérent et installation vérifiée.

Les transports Auth/RPC et le stockage de secours de ce scénario sont simulés
en mémoire ; ils ne constituent pas une recette IndexedDB sur appareil réel.
Les régressions existantes de l'outbox, reçus, pertes réseau, changement de
compte, transfert invité et navigateurs restent requises et inchangées.
`cloud-diagnostics-tests.mjs` vérifie aussi le signal serveur en cas de quota,
corruption, erreur du diagnostic ou de la console, avec exclusion invité/QA.
Le résultat complet exécuté et le SHA candidat sont consignés dans la PR.

## Livraison et clôture

Pas de migration SQL, de backfill, de réparation de profil réel, de nouvelle
permission ou de ressource payante. Retour à l'ancien client possible sans
conversion de sauvegarde ; il pourra bloquer de nouveau une amélioration de
badge, mais ne doit pas supprimer les copies et intentions conservées.

Après accord explicite de fusion/déploiement et vérification du SHA publié,
faire confirmer sur l'appareil concerné : reconnexion/rechargement, visibilité
des acquis, victoires en attente puis confirmées après retour réseau, absence
de double crédit, et disparition du blocage uniquement si l'état est cohérent.
Si le blocage persiste, utiliser la raison/champs du nouveau diagnostic et
conserver les preuves ; ne pas réinitialiser les données pour obtenir un succès.
Ne pas clore #530 comme réparation démontrée du téléphone avant cette recette.

Coordination : #391 garde les commandes et réparations structurelles, #398 la
validation transverse ; ce correctif ne modifie pas le rattachement invité de
#528. Réexaminer les zones communes `cloud-profile.js` / `game-screen.js` avant
une intégration ultérieure avec la convergence de #522 / PR #527.
