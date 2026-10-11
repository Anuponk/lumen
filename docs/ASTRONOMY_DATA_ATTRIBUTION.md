# Sources et licence des tracés astronomiques affichés dans « Mon ciel »

Les tracés astronomiques affichés dans les cartes de constellations de **Lumen** utilisent les données de la culture « Western » de **Stellarium Sky Cultures**, produites par l'équipe Stellarium.

- Source des constellations et liaisons stellaires : https://github.com/Stellarium/stellarium-skycultures/tree/master/western
- Licence des textes et **données Western** : **Creative Commons Attribution–ShareAlike (CC BY-SA)**, selon le fichier `western/description.md` de Stellarium. Les illustrations Stellarium (sous Free Art License) **ne sont pas reprises** dans Lumen.
- Source des coordonnées astronomiques : Hipparcos New Reduction, F. van Leeuwen (2007), VizieR CDS Strasbourg, catalogue `I/311/hip2` : https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I%2F311%2Fhip2
- Transformation effectuée : sélection des HIP de chaque ligne, projection tangentielle vers l'espace SVG de Lumen ; sauvegarde du catalogue dérivé `src/data/astronomy/stellarium-western-figures.json`.
- Attribution à conserver dans toute redistribution du catalogue dérivé : « Données de constellations Western © équipe Stellarium, CC BY-SA ; coordonnées stellaires Hipparcos II via CDS VizieR. Projection et adaptation pour Lumen. »

Les étoiles allumées et les récompenses historiques restent gouvernées par la progression de Lumen. **Les cartes montrent le dessin astronomique réel à titre de référence : aucune association index historique → HIP n'est présumée.** Les représentations détaillées où le joueur révèle ses étoiles historiques ne sont pas automatiquement remappées.

La version des fichiers astronomiques est liée au résultat validé du workflow GitHub Actions 38136873670 (691 étoiles HIP, 88 figures complètes, 40/40 identités Lumen).
