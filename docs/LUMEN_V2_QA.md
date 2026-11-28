# LUMEN V2 · Recette isolée et retour V1

## Contrôle d’accès

La migration #1087 introduit le drapeau `ux_preview` avec la valeur `false`.
Une lecture authentifiée retourne `true` uniquement pour le compte auquel la
capacité `ux_v2_preview` est attribuée, tant qu’elle n’a pas expiré. Le RPC
déduit le compte de la session. Les invités et comptes anonymes sont exclus.

LUMEN Lab se trouve dans Mon espace › Compte. La préférence est locale et
indexée par compte. Elle n’a d’effet que sous une autorisation fraîche. La
lecture est limitée à l’ouverture de Mon espace et au changement de préférence
pour le compte signalé par le registre des capacités. Aucun sondage des comptes
ordinaires. Une erreur réseau, une déconnexion ou un changement de compte
désactive le contrôle. Une tentative active ou en pause bloque la bascule.

Le socle local enregistre la préférence. Le rendu reste en V1 dans ce candidat.
Le jalon 4 doit brancher le rendu autorisé aux points de navigation sûrs et
vérifier la révocation au premier de ces points, y compris lors du retour au
premier plan. Le changement de variante ne doit jamais sauvegarder ni
reconstruire le plateau, le chronomètre, les droits ou les intentions en attente.
La coexistence réelle et le retour V2 → V1 seront testés à ce moment.

## Deux niveaux de recette

| Niveau | Usage et données | État |
| --- | --- | --- |
| Prototype indépendant | Catalogue, SVG et copies d’écran du produit. Progression et classements simulés. La politique de contenu limite les lectures à l’origine du prototype, dont le catalogue JSON. Aucun SDK d’authentification, client de paiement ou service worker du produit. | Navigation de conception et contrôle de la disposition. |
| PostgreSQL éphémère | Schémas de fixture, table de drapeaux et fonction de capacité extraites des migrations existantes. Identités de test, aucun compte réel. | Migration et fixture #1087 exécutées localement. |
| Aperçu de recette PWA | Réutiliser le dispositif décrit dans [l’aperçu isolé](ISOLATED_VALIDATION_PREVIEW.md). Créer un paquet distinct à partir du futur SHA candidat. SDK et configuration du backend remplacés par des fixtures. | Préparation documentée. Version V2 à intégrer après approbation. |
| QA métier | Base locale jetable avec suite de migrations complète, identités fictives, paiements Stripe TEST et comptes Play de test, transports de notifications capturés. Créer des données nouvelles. | Recette complète à monter avant les essais métier de la V2. |
| Bêta propriétaire | Données et droits réels, activation individuelle après confirmation de l’UUID et contrôle d’un témoin. Les actions métier peuvent compter pour les classements et le social. | Jalon 6, après validation de la conception et de la recette. |

### Vérifications d’isolation

1. Examiner le paquet livré au navigateur, la configuration du SDK, les
   domaines accessibles et les requêtes. Les profils, recettes et journaux QA
   restent dans leur environnement. Exiger un profil navigateur dédié pour
   chaque combinaison identité/appareil.
2. Utiliser des adresses fictives ou contrôlées. Intercepter les SMS, mails et
   notifications. Simuler Stripe et Google Play dans les comparaisons
   d’interface, puis utiliser leurs environnements et identités de test pour les
   intégrations. Vérifier achat, refus, annulation, restauration et idempotence.
3. Établir le classement et le Défi sur les données initiales de QA, appliquer
   les scénarios de quotas, minuit et panne, puis vérifier que l’export ne
   contient aucun identifiant réel.
4. Vérifier que l’origine de recette ne rejoint ni la collecte PostHog produit,
   ni l’infrastructure de notification, ni le backend du jeu réel. Conserver
   preuve de configuration et journal réseau avec le SHA du candidat.

## Retour arrière

Au jalon 6, contrôler qu’une suppression de capacité ou la désactivation globale
rend V1 au prochain point sûr et que l’essai en cours conserve identifiant,
chrono et état. Contrôler le témoin après connexion, hors ligne et après
changement de compte. Garder l’ancienne publication Web et appliquer le processus
exact-SHA d’[o2switch](RELEASE.md) si un incident impose aussi une restauration
des actifs. Une restauration Web ne révoque ni des reçus ni des droits serveur.

## Contrôles locaux

- `node scripts/ux-lab-tests.mjs` teste le défaut V1, la réponse serveur
  inattendue, le changement de compte, la course pendant une tentative et la
  conservation de la préférence.
- `scripts/fixtures/ux-lab-1087.sql` teste le rôle anonyme, l’absence d’identité,
  le témoin, le propriétaire, l’expiration et le kill switch. Exécuter sur une
  base jetable après les dépendances de la migration.
