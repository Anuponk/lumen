# LUMEN V2 · Dossier de conception

[Audit et référence V1](LUMEN_V2_AUDIT.md) · [Matrice des 50 états et 14 parcours](LUMEN_V2_MATRIX.md) · [Recette isolée et retour V1](LUMEN_V2_QA.md) · [Journal des décisions](LUMEN_V2_DECISIONS.md) · [Fiche de reprise](LUMEN_V2_HANDOFF.md)

## Ouvrir le prototype

Depuis le clone de travail, exécuter `node scripts/serve-lumen-v2-prototype.mjs`.
Ouvrir [le prototype local](http://127.0.0.1:10887/docs/lumen-v2-prototype/).
Le panneau « Prototype · progression simulée · référentiel de recette » donne
accès aux 50 états E01–E50 et à la comparaison V1. L’appli utilise le catalogue
du dépôt, ses formes astronomiques, ses traductions et ses composants podium et
semaine. Progression, temps fictifs et joueurs de classement servent à explorer
la composition. Les états secondaires utilisent des captures historiques
lorsqu’elles existent ou des cartes annotées. Ils restent à recetter sur
l’application avec un backend isolé.

## Changements proposés

| Surface | V1 observée | V2 proposée |
| --- | --- | --- |
| Arrivée et navigation | Grille par défaut. Mon ciel, Social et Compte via les commandes existantes. | Arrivée dans Mon ciel, identifié dans l’en-tête. L’onglet Mon ciel y ramène. Mon espace est accessible par une icône secondaire. La barre basse disparaît sous la grille et dans ses écrans d’aide et de pause. Le retour en haut reste accessible. |
| Mon ciel | Six constellations par page, rails aventure et sélection de ciel, pourcentages de badges. | Les constellations sont visibles ensemble. Chaque carte porte un pourcentage et un état identifié par un symbole, un libellé et une teinte. Le bandeau Aventure affiche la complétion globale, les quêtes et les badges. Le bouton Badges affiche les compteurs par catégorie. |
| Détail constellation | Navigation et cartes de quête avec état et badges. | Les flèches à côté du nom d’aventure ouvrent la première constellation de l’aventure choisie. Les commandes dans le bas de la page parcourent les constellations de l’aventure active. La fiche, le filtre et la prochaine quête restent accessibles selon les droits. |
| Jouer et Défi | Plateau et retour à Mon ciel. « Ma semaine » déjà dans le Défi, avec raccourci Social. | Reprise en un geste depuis Mon ciel. Jouer donne accès à la reprise et au Défi. Historique et semaine restent dans le Défi. |
| Résolution | Territoires colorés, Gardiens, chrono et aides. | En-tête de quête avec Retour et Pause, chrono officiel et compteur au-dessus de la grille, Annuler, Effacer, Vérifier et Indice directement en dessous. Les frontières de territoire ressortent et la barre de navigation laisse la place à la grille. |
| Classements | Podium et listes de classement. La liste complète est présente sur le `main` de départ (#1079). | Podium existant, liste complète et swipe aventure. Défi quotidien global et amis. |
| Social, compte, boutique | Composants et contrats déjà disponibles. | Les notifications sont accessibles depuis la cloche en haut à droite, avec compteur, et depuis Social. Chaque notification ouvre le duel, la demande d’ami ou le résultat concerné. La boutique reste accessible depuis le compte et les limites. |
| Fidélisation | Records, tableaux de progression, célébrations et Ma semaine. | Donner un accès explicite aux acquis existants. Étudier le bilan E49 avec faits du compte et le déclenchement ponctuel E50 après une action pertinente. |

La planche 03 a servi à la composition de Mon ciel et des lignes de quête.
Le bandeau d’aventure reprend la hiérarchie de la planche 02, et l’en-tête
Mon ciel celle de la planche 01. [Sources dans #1083](https://github.com/Anuponk/project-menlu/issues/1083#issuecomment-7234785317)
Le prototype reprend l’échelle et la typographie des composants de jeu ainsi
que les symboles de badges du produit. Le compte de référence est synthétique.
Les captures V1 proviennent d’Edge sur le SHA Web de production, en mode QA.

Le pourcentage de complétion proposé additionne les quêtes résolues et les
badges acquis, puis divise par le total des quêtes et des badges possibles.
L’affichage arrondit à l’entier inférieur et réserve 100 % à la maîtrise.
Au niveau de l’aventure, le calcul utilise les totaux du catalogue.
La carte conserve un libellé même lorsque les couleurs se distinguent mal.

Le prototype illustre une aventure ouverte et une aventure verrouillée.
L’aventure verrouillée reste consultable depuis Mon ciel avec une entrée « Voir
l’accès ». Ses quêtes portent un cadenas. Dans une aventure accessible, une
quête verrouillée par la progression révèle son prérequis. La décision d’accès
est issue du modèle de catalogue avec les droits et la progression de la fixture.

Une demande ou un duel reçu reste à traiter jusqu’à la décision. Le résultat
est signalé comme lu à son ouverture. Le prototype illustre le compteur et
les destinations avec des notifications fictives. L’intégration réutilisera
les entrées et compteurs du parcours Social existant (#898).

L’impact sur l’apprentissage sera vérifié au jalon 4. Le premier accueil,
le guide de jeu, la visite de Mon ciel et les explications de badges
conservent leur ordre et leur éligibilité. Les points d’arrivée et de retour
des étapes guidées seront recettés contre leur destination V2.

## Décisions à valider

1. Valider la vue Mon ciel allégée et les compteurs dans le mode Badges.
   Tester le parcours Mon ciel → reprise → retour ainsi que le passage entre
   Mon ciel et Classements. Chaque onglet garde sa propre aventure. Confirmer
   la navigation proposée entre aventures depuis le détail.
2. Valider l’emplacement du bilan E49 dans Mon espace et sa portée, notamment
   la pertinence d’un bilan sur sept jours en plus de la semaine du Défi.
3. Valider les indications de première découverte E50 et leur moment
   d’affichage. Le prototype montre la destination. Les règles de fréquence
   et de persistance doivent être validées par parcours.

Les [captures de Mon ciel et des notifications](validation/lumen-v2-1081/sky-review/README.md)
complètent le [dossier de preuves initial](validation/lumen-v2-1081/README.md).
Voir également les [cas d’accès et de navigation depuis une constellation](validation/lumen-v2-1081/access-review/README.md).
Les [captures de l’écran de jeu](validation/lumen-v2-1081/play-review/README.md)
montrent la quête simulée, la pause, les règles, la vérification et le Défi.
Passer au jalon 4 après accord explicite sur la conception, puis recetter V1 et V2
avant activation privée.
