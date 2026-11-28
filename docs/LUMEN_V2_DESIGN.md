# LUMEN V2 · Dossier de conception

[Audit et référence V1](LUMEN_V2_AUDIT.md) · [Matrice des 50 états et 14 parcours](LUMEN_V2_MATRIX.md) · [Recette isolée et retour V1](LUMEN_V2_QA.md)

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
| Arrivée et navigation | Grille par défaut. Mon ciel, Social et Compte via les commandes existantes. | Arrivée normale dans Mon ciel. Quatre entrées en bas, Compte en haut, barre masquée en résolution. Entrées spécifiques résolues en priorité. |
| Mon ciel | Six constellations par page, rails aventure et sélection de ciel, pourcentages de badges. | Toutes les constellations de l’aventure sur le même écran. Swipe et commandes visibles. Compteurs par catégorie plus total sur chacune et sur l’aventure. |
| Détail constellation | Navigation et cartes de quête avec état et badges. | Ligne de quête avec temps réel disponible, quatre emplacements, fiche, filtre et précédent/suivant. La prochaine quête répond au filtre actif. |
| Jouer et Défi | Plateau et retour à Mon ciel. « Ma semaine » déjà dans le Défi, avec raccourci Social. | Jouer expose la reprise et le Défi. Mon ciel conserve un encart Défi. Historique et semaine gardent une surface commune. |
| Classements | Podium et listes de classement. La liste complète est présente sur le `main` de départ (#1079). | Podium existant, liste complète et swipe aventure. Défi quotidien global et amis. |
| Social, compte, boutique | Composants et contrats déjà disponibles. | Social devient une entrée principale. Compte reste accessible depuis les vues principales. Boutique via Compte et les limites. |
| Fidélisation | Records, tableaux de progression, célébrations et Ma semaine. | Donner un accès explicite aux acquis existants. Étudier le bilan E49 avec faits du compte et le déclenchement ponctuel E50 après une action pertinente. |

La planche 03 a servi à la composition de Mon ciel et des lignes de quête.
Le prototype reprend l’échelle et la typographie des composants de jeu ainsi
que les symboles de badges du produit. Le compte de référence est synthétique.
Les captures V1 proviennent d’Edge sur le SHA Web de production, en mode QA.

L’impact sur l’apprentissage sera vérifié au jalon 4. Le premier accueil,
le guide de jeu, la visite de Mon ciel et les explications de badges
conservent leur ordre et leur éligibilité. Les points d’arrivée et de retour
des étapes guidées seront recettés contre leur destination V2.

## Décisions à valider

1. Accepter la densité de la vue à deux colonnes sur petit écran et le libellé
   actuel « Autonomie » pour le badge correspondant à « sans assistance ».
   La règle et le symbole restent ceux de LUMEN.
2. Valider l’emplacement du bilan E49 dans Mon espace et sa portée, notamment
   la pertinence d’un bilan sur sept jours en plus de la semaine du Défi.
3. Valider les indications de première découverte E50 et leur moment
   d’affichage. Le prototype montre la destination. Les règles de fréquence
   et de persistance doivent être validées par parcours.

Les dernières validations sont tracées dans le [dossier de preuves](validation/lumen-v2-1081/README.md).
Passer au jalon 4 après accord explicite sur la conception, puis recetter V1 et V2
avant activation privée.
