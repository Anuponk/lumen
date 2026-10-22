# Sources et licence des tracés astronomiques affichés dans « Mon ciel »

Les tracés astronomiques affichés dans les cartes de constellations de **Lumen** utilisent les données de la culture « Western » de **Stellarium Sky Cultures**, produites par l'équipe Stellarium.

- Source des constellations et liaisons stellaires : https://github.com/Stellarium/stellarium-skycultures/tree/master/western
- Licence des textes et **données Western** : **Creative Commons Attribution–ShareAlike (CC BY-SA)**, selon le fichier `western/description.md` de Stellarium. Les illustrations Stellarium (sous Free Art License) **ne sont pas reprises** dans Lumen.
- Source des coordonnées astronomiques : Hipparcos New Reduction, F. van Leeuwen (2007), VizieR CDS Strasbourg, catalogue `I/311/hip2` : https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I%2F311%2Fhip2
- Transformation effectuée : sélection des HIP de chaque ligne, projection tangentielle vers l'espace SVG de Lumen ; sauvegarde du catalogue dérivé `src/data/astronomy/stellarium-western-figures.json`.
- Attribution à conserver dans toute redistribution du catalogue dérivé : « Données de constellations Western © équipe Stellarium, CC BY-SA ; coordonnées stellaires Hipparcos II via CDS VizieR. Projection et adaptation pour Lumen. »

Les étoiles allumées et les récompenses restent gouvernées par la progression de Lumen. **Aucune association d'un index historique de sauvegarde à une étoile HIP n'est présumée.** L'aperçu, le détail et la révélation emploient le tracé vérifié ; son illumination est une présentation déterministe de la progression. Les petites constellations sont complétées uniquement du nombre d'étoiles de lumière nécessaire aux victoires restantes ; ces éléments décoratifs, plus petits et non reliés, ne sont pas des étoiles HIP. Les couronnes dorées de #512 sont abandonnées conformément au retour utilisateur de #504. Aucun remappage des sauvegardes ou changement des récompenses n'est effectué.

La version des fichiers astronomiques est liée au résultat validé du workflow GitHub Actions 38136873670 (691 étoiles HIP, 88 figures complètes, 40/40 identités Lumen).

## Audit #508 — 21 octobre 2026

**Résultat : les 88 figures livrées sont identiques à leur reconstruction depuis
les sources ci-dessous**, étoiles HIP ordonnées, coordonnées projetées et segments
compris. Les données n'ont pas été tronquées par la conversion, le filtrage ou la
normalisation. Les valeurs RA/Dec sont contrôlées en degrés, avec des bornes
valides, puis reprojetées par le moteur partagé.

- Lignes de comparaison : [Stellarium Western, révision vérifiée `92df9e4`](https://github.com/Stellarium/stellarium-skycultures/blob/92df9e4c48c7a3b21d4b0cfc6ce088dd8ce2f2df/western/index.json).
  [Notice de licence à cette révision](https://github.com/Stellarium/stellarium-skycultures/blob/92df9e4c48c7a3b21d4b0cfc6ce088dd8ce2f2df/western/description.md) : textes/données CC BY-SA ; aucune illustration reprise.
  La fixture [Western lines](../scripts/fixtures/astronomy/western-lines.json) conserve les lignes, y compris les métadonnées de style, sans altération.
- Coordonnées de reproduction : les 691 entrées `hip-lines.json` de
  [l'import d'origine](https://github.com/Anuponk/lumen/actions/runs/38136873670),
  artefact `lumen-astronomical-import-audit` ID `11701895503`.
  [Copie hors ligne](../scripts/fixtures/astronomy/hipparcos-line-coordinates.json),
  SHA-256 `d4f0b3f7775a7d2a00d11561292521abc9e70c59ee894b448b884aa0b056aae7`.
  Source : Hipparcos II / VizieR I/311/hip2, ICRS J1991.25 ; pas de conversion
  supplémentaire radians→degrés, ni de propagation d'époque.
- Commande : `node scripts/audit-astronomical-figures.mjs [report.json]`.
  La comparaison ne dépend pas du réseau et échoue sur une étoile, coordonnée,
  liaison ou couverture incohérente. Les tests injectent aussi ces corruptions.

La référence `70471c1…` précédemment inscrite dans la documentation ne se résout
pas sur GitHub. `92df9e4…` est le référentiel vérifié pour cet audit ; le workflow
historique téléchargeait `master` et ne permet pas d'affirmer qu'il avait figé ce
commit. Les coordonnées reproduisent l'entrée de cet import, pas une nouvelle
mesure indépendante du catalogue Hipparcos. La convention de lignes Western
n'est pas un tracé universel officiel imposé à toutes les représentations.

### Figures signalées et choix visuel

| Figure | HIP | Segments | Conclusion |
|---|---|---|---|
| Antlia | 51172, 48926 | 1 | Figure Western complète, volontairement simple |
| Apus | 72370, 81065, 81852 | 2 | Figure Western complète |
| Caelum | 21060, 21770, 21861 | 2 | Figure Western complète |
| Aries / Bélier | 13209, 9884, 8903, 8832 | 3 | Figure Western complète |

Ajouter des connexions ou points pour enrichir ces dessins changerait la
convention de référence. Aucun changement d'atlas n'est justifié par une perte
de données. Après comparaison visuelle des trois options de #504, les petites
figures reçoivent seulement les étoiles secondaires nécessaires aux victoires
restantes ; les grandes gardent uniquement leurs étoiles réelles. Le dessin de
référence n'est jamais enrichi de faux HIP ou de nouvelles liaisons.

L'audit du rendu a en revanche reproduit deux défauts : le SVG de détail mobile
fixé à 190px dépassait de la fenêtre en 320×568 ; les dix constellations générées
avaient un résumé textuel à la place du dessin dans le détail. Les corrections
réservent une zone flexible au dessin et partagent le rendu vérifié entre toutes
les figures du catalogue, sans toucher aux données ou à la progression.

### Contrôle de toutes les figures embarquées

Les nombres ci-dessous sont dérivés des lignes figées, pas des totaux de quêtes.
« Identique » porte sur l'ensemble des HIP, coordonnées projetées et segments,
et non sur une simple égalité de compteurs.

| IAU | Points HIP | Segments | Source → catalogue |
|---|---|---|---|
| And | 6 | 5 | Identique |
| Ant | 2 | 1 | Identique |
| Aps | 3 | 2 | Identique |
| Aql | 9 | 8 | Identique |
| Aqr | 15 | 14 | Identique |
| Ara | 7 | 7 | Identique |
| Ari | 4 | 3 | Identique |
| Aur | 6 | 6 | Identique |
| Boo | 9 | 9 | Identique |
| Cae | 3 | 2 | Identique |
| Cam | 5 | 5 | Identique |
| Cap | 9 | 9 | Identique |
| Car | 15 | 14 | Identique |
| Cas | 5 | 4 | Identique |
| Cen | 17 | 16 | Identique |
| Cep | 5 | 6 | Identique |
| Cet | 19 | 20 | Identique |
| Cha | 3 | 2 | Identique |
| Cir | 3 | 2 | Identique |
| CMa | 15 | 16 | Identique |
| CMi | 2 | 1 | Identique |
| Cnc | 6 | 5 | Identique |
| Col | 7 | 6 | Identique |
| Com | 3 | 2 | Identique |
| CrA | 10 | 9 | Identique |
| CrB | 7 | 6 | Identique |
| Crt | 8 | 9 | Identique |
| Cru | 4 | 2 | Identique |
| Crv | 6 | 6 | Identique |
| CVn | 2 | 1 | Identique |
| Cyg | 10 | 9 | Identique |
| Del | 5 | 5 | Identique |
| Dor | 5 | 5 | Identique |
| Dra | 15 | 15 | Identique |
| Equ | 4 | 4 | Identique |
| Eri | 28 | 27 | Identique |
| For | 2 | 1 | Identique |
| Gem | 17 | 16 | Identique |
| Gru | 9 | 9 | Identique |
| Her | 19 | 19 | Identique |
| Hor | 3 | 2 | Identique |
| Hya | 18 | 18 | Identique |
| Hyi | 5 | 4 | Identique |
| Ind | 3 | 3 | Identique |
| Lac | 6 | 6 | Identique |
| Leo | 9 | 10 | Identique |
| Lep | 13 | 14 | Identique |
| Lib | 5 | 5 | Identique |
| LMi | 4 | 4 | Identique |
| Lup | 12 | 13 | Identique |
| Lyn | 8 | 7 | Identique |
| Lyr | 5 | 5 | Identique |
| Men | 2 | 1 | Identique |
| Mic | 3 | 2 | Identique |
| Mon | 7 | 6 | Identique |
| Mus | 4 | 4 | Identique |
| Nor | 4 | 5 | Identique |
| Oct | 3 | 3 | Identique |
| Oph | 7 | 7 | Identique |
| Ori | 19 | 21 | Identique |
| Pav | 11 | 13 | Identique |
| Peg | 14 | 14 | Identique |
| Per | 11 | 10 | Identique |
| Phe | 8 | 11 | Identique |
| Pic | 3 | 2 | Identique |
| PsA | 7 | 6 | Identique |
| Psc | 18 | 19 | Identique |
| Pup | 7 | 7 | Identique |
| Pyx | 3 | 2 | Identique |
| Ret | 4 | 4 | Identique |
| Scl | 3 | 3 | Identique |
| Sco | 13 | 12 | Identique |
| Sct | 5 | 5 | Identique |
| Ser | 12 | 11 | Identique |
| Sex | 2 | 1 | Identique |
| Sge | 5 | 4 | Identique |
| Sgr | 21 | 24 | Identique |
| Tau | 12 | 12 | Identique |
| Tel | 2 | 1 | Identique |
| Tra | 3 | 3 | Identique |
| Tri | 3 | 3 | Identique |
| Tuc | 4 | 3 | Identique |
| UMa | 18 | 19 | Identique |
| UMi | 7 | 7 | Identique |
| Vel | 10 | 10 | Identique |
| Vir | 12 | 12 | Identique |
| Vol | 6 | 7 | Identique |
| Vul | 2 | 1 | Identique |
