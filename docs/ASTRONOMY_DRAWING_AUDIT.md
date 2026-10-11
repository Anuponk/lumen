# Revue astronomique des constellations (issue #241)

## Périmètre et état

Les dessins historiques de Lumen sont définis dans `src/campaign/data.js` sous `CONSTELLATIONS`. Chaque entrée possède `name`, `count`, `pts` et `edges`. Les positions sont des **coordonnées SVG artistiques** et non une projection issue d'un catalogue d'ascension droite / déclinaison. La simple conformité du nom ou du nombre de points ne prouve donc pas l'exactitude astronomique.

Cette première livraison corrige **Orion** et introduit un contrôle structurel automatique. Elle ne constitue **pas** un audit astronomique exhaustif des autres dessins : ceux-ci restent à comparer individuellement à des cartes de référence.

## Orion — correction prioritaire

Référence de forme : [SDSS SkyServer, Orion](https://preprod.skyserver.sdss.org/dr14/en/proj/games/constellation/orion.aspx) : Bételgeuse et Bellatrix marquent les épaules, Mintaka / Alnilam / Alnitak la ceinture, Saiph et Rigel les pieds, une ligne d'étoiles pend au-dessous de la ceinture (épée). Les conventions d'orientation et de tracé varient selon la culture, la latitude et la carte choisie.

Le dessin Lumen conserve **exactement 17 slots de stars dans le même ordre**. Le tracé inclut désormais explicitement les deux segments de la ceinture, les deux épaules, les deux jambes et la ligne verticale de l'épée. Il ne modifie aucune grille, récompense, étoile déjà gagnée ni clé de sauvegarde.

## Reste à faire pour clore #241

1. Inventorier les formes des **autres** constellations historiques et celles ajoutées au catalogue, sans confondre catalogue de quêtes et dessins SVG.
2. Relever pour chacune une référence explicite (IAU pour l'identité / limites, Stellarium ou autre atlas reconnu pour les étoiles brillantes et les traits figuratifs) ; les frontières IAU ne dictent pas une figure unique.
3. Classer chacune : fidèle, stylisée reconnaissable, incohérente, à confirmer, puis corriger les incohérentes.
4. Vérifier rendus mobile/desktop et la progression de révélation des étoiles (ordre des index) ; ne pas reclasser les index sans migration.
5. Pour les nouvelles formes générées, intégrer un jeu de coordonnées stellaire documenté et valider la transformation vers les coordonnées SVG.

## Contrôle automatique ajouté

Le test de contenu vérifie le nombre de points et les segments structurants d'Orion. Ce contrôle empêche une régression accidentelle du dessin, mais **ne remplace pas la validation astronomique et visuelle**.
