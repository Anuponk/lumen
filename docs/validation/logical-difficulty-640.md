# Issue #640 — audit et recette

Le générateur précédent favorisait le nombre d'exclusions et la taille. Son
moteur d'indices retourne les exclusions avant les placements : compter ces
actions ne mesure pas le raisonnement minimum permettant de repérer un gardien.
Le nouveau modèle prend les singles disponibles en premier, groupe les
exclusions d'une même déduction et trace leurs dépendances. Les règles réelles
restent un gardien par ligne/colonne/territoire et aucun voisinage diagonal.
L'énumérateur reste une preuve d'unicité indépendante du score.

Reproduction : `node scripts/regenerate-logical-grids.mjs`, puis
`node scripts/logical-grid-tests.mjs --write`. Seed 64020261108, 100 000 essais,
77 632 topologies connexes, 25 309 candidates uniques, 22 076 résolutions du
modèle, 19 924 résolutions supplémentaires par le moteur d'indices. La sélection
conserve 400 grilles distinctes, éloignées d'au moins six cases entre signatures
D4 normalisées. Les modèles n'utilisent jamais la solution pour fabriquer une
déduction. Les contrôles d'acceptation recalculent toutes les métriques.

Une seconde exécution complète avec le même seed et 100 000 essais produit
exactement le même fichier : SHA-256
`0bb92fd3bc292d62b3977bc6176c3b05778f859be842c754b4bac15da11a161a`.
Le double audit indépendant des 400 grilles a pris 2,61 secondes lors de la
mesure locale Node 22.22 / Windows ; ce repère matériel n'est pas un SLA ni
une mesure de résolution humaine. Les statistiques de rejet restent dans le
JSON pour comparer les futures évolutions du générateur.

| Aventure | Palier | Score moyen avant → après | Profondeur du premier placement avant → après | Gardiens superficiels moyens avant → après | Taille moyenne avant → après |
|---|---|---:|---:|---:|---:|
| 5 | Intermédiaire | 79,34 → 131,36 | 3,22 → 4,96 | 0,76 → 0,26 | 7,50 → 8 |
| 6 | Avancé | 76,04 → 136,36 | 3,40 → 5,48 | 0,95 → 0,22 | 8,10 → 8 |
| 7 | Expert | 77,29 → 143,84 | 3,65 → 5,30 | 0,78 → 0,20 | 9 → 8 |
| 8 | Maître | 74 → 162,11 | 3,28 → 6,31 | 0,99 → 0,09 | 9,08 → 8 |

Un gardien superficiel est un placement dont la profondeur de dépendance est
au plus trois dans la politique du modèle. Moyenne globale : 0,87 → 0,1925,
soit **77,9 % de moins**. Les singles de l'état strictement vide restent nuls
dans les deux corpus : les anciennes grilles n'avaient déjà pas de singleton.
Ce résultat seul n'aurait donc pas suffi à mesurer leur facilité.

Les plages de scores après sélection sont 129,25–133,25 ; 133,50–139,75 ;
140–149 ; 149,25–190. Les quartiles, médianes et métriques par aventure sont
dans le [rapport JSON recalculable](logical-difficulty-640.json). Les tests
imposent des bandes strictement séparées et une progression non décroissante
avec gain entre première et dernière quête de chacune des 40 constellations.
Les comparaisons de taille identique passent sur les 50 anciennes 8×8 de
l'aventure 5 et les 90 anciennes 8×8 de l'aventure 6. Les aventures 7–8 sont
plus difficiles selon le modèle malgré la réduction de taille.

La mesure est un modèle logique reproductible inspiré de la littérature,
pas une corrélation démontrée avec les temps humains. Les poids et l'ordre de
départage sont documentés dans [GRID_CATALOG](../GRID_CATALOG.md). Les traces
peuvent être obtenues avec `rateLogicalDifficulty(reg)` ; les métadonnées livrées
restent compactes. Les plages ne signifient pas que chaque nouvelle grille
dépasse le maximum de l'ancienne aventure.

## Sauvegardes et déploiement

Le remplacement est explicitement autorisé pour les aventures 5–8. Les IDs,
récompenses, droits, constellations astronomiques, états terminés, badges et
records historiques restent acquis. Les progressions local/cloud utilisent les
mêmes faits : aucune suppression unilatérale à réintroduire depuis un autre
appareil. Une partie active de l'ancienne grille est sauvegardée octet pour
octet et ne peut pas être restaurée sur la nouvelle, même de même taille.
Le bug a été reproduit sur le moteur antérieur : il restaurait cette partie.
Les tests couvrent aussi le stockage saturé, les rechargements et le retour à
une version de grille antérieure.

Les défis sociaux conservent leur grille exacte : sans version, grille
historique ; version 1, nouvelle grille. La migration additive doit être
appliquée et vérifiée avant une future publication du client. Pas de fallback
qui publierait silencieusement un défi avec la mauvaise version. Aucun SQL de
production, aucun déploiement et aucune fusion sur main dans ce chantier :
la fusion pourrait déclencher le publisher automatique.

## Recette fonctionnelle à distinguer des tests automatisés

La suite navigateur rejoue les quêtes 500, 600, 700 et 800 à 390 px par gestes
tactiles réels CDP, avec placements issus de la trace et sans `setBoard` pour
ces échantillons. Elle vérifie victoire et passage d'aventure. Les autres
scénarios conservent les tests de cache hors ligne, compte, acquittement unique,
reconnexion et rechargement. Il s'agit d'une automatisation Chromium.

Pour la QA humaine sur la PR complète : jouer les premières et dernières
quêtes de chaque aventure (IDs listés dans le JSON), sans aide puis avec
indices ; relever premier gardien, temps, règles comprises et blocages. Sur
téléphone physique, reprendre une ancienne partie après mise à jour puis
tester mode avion → fermeture → réouverture → reconnexion. Sur deux appareils,
vérifier acquis historiques, nouveau replay et ancien/nouveau lien de défi.
Ces observations humaines et physiques ne sont pas présentées comme réalisées.

La recette a aussi révélé une référence de fixture au marqueur de cache v15,
adaptée à v16, et une course de coordonnées tactiles en quête 2 après fermeture
d'un indice. Deux frames de mise en page sont attendues avant de mesurer les
cibles ; les gestes et l'assertion de victoire restent identiques. Le parcours
apprentissage passe aux cinq formats, dont 320×568. La CI PostgreSQL a confirmé
les tests de défis versionnés et a signalé que la préparation RGPD refusait
la nouvelle colonne : sa liste de métadonnées revues accepte désormais le
seul entier non-null `grid_revision`. L'anonymisation et le refus des champs
inconnus/nullables sont testés ; l'activation de l'effacement reste interdite.
