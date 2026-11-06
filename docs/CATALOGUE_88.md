# Catalogue astronomique complet de Lumen

Le catalogue intégré comporte **9 aventures, 88 constellations UAI distinctes et
880 quêtes**. Chaque constellation possède dix quêtes. Les cinq premières
aventures (500 quêtes) restent identiques à main bb19727 ; les aventures 6–9
ajoutent 380 grilles. Aucun droit d’accès n’est accordé par cette extension.

## Répartition exacte

| Aventure | Constellations dans l’ordre du jeu | Quêtes | Nombre |
|---|---|---|---:|
| 1 · Premières lueurs | Grande Ourse · Grand Chariot (UMa), Cassiopée (Cas), Croix du Sud (Cru), Lyre (Lyr), Cygne · Croix du Nord (Cyg), Lion (Leo), Scorpion (Sco), Gémeaux (Gem), Taureau (Tau), Aigle (Aql) | 1–100 | 100 |
| 2 · Horizons lointains | Andromède (And), Orion (Ori), Pégase (Peg), Persée (Per), Dragon (Dra), Céphée (Cep), Bouvier (Boo), Couronne boréale (CrB), Sagittaire (Sgr), Capricorne (Cap) | 101–200 | 100 |
| 3 · Au-delà de l’horizon | Verseau (Aqr), Poissons (Psc), Vierge (Vir), Grand Chien (CMa), Dauphin (Del), Petit Cheval (Equ), Hercule (Her), Lièvre (Lep), Licorne (Mon), Ophiuchus (Oph) | 201–300 | 100 |
| 4 · Horizons inconnus | Antlia (Ant), Apus (Aps), Ara (Ara), Aries (Ari), Auriga (Aur), Caelum (Cae), Camelopardalis (Cam), Cancer (Cnc), Canes Venatici (CVn), Canis Minor (CMi) | 301–400 | 100 |
| 5 · Les chemins du firmament | Baleine (Cet), Colombe (Col), Corbeau (Crv), Coupe (Crt), Dorade (Dor), Éridan (Eri), Grue (Gru), Hydre mâle (Hyi), Lézard (Lac), Loup (Lup) | 401–500 | 100 |
| 6 · Les artisans de la lumière | Fourneau (For), Horloge (Hor), Réticule (Ret), Peintre (Pic), Sculpteur (Scl), Microscope (Mic), Télescope (Tel), Compas (Cir), Règle (Nor), Sextant (Sex) | 501–600 | 100 |
| 7 · Les voyageurs de l’aube | Boussole (Pyx), Poisson volant (Vol), Mouche (Mus), Indien (Ind), Toucan (Tuc), Paon (Pav), Phénix (Phe), Carène (Car), Poupe (Pup), Voiles (Vel) | 601–700 | 100 |
| 8 · Les gardiens de l’immensité | Petit Lion (LMi), Lynx (Lyn), Petit Renard (Vul), Chevelure de Bérénice (Com), Balance (Lib), Couronne australe (CrA), Écu de Sobieski (Sct), Serpent (Ser), Hydre (Hya), Centaure (Cen) | 701–800 | 100 |
| 9 · Le ciel réuni | Flèche (Sge), Triangle (Tri), Triangle austral (TrA), Poisson austral (PsA), Caméléon (Cha), Table (Men), Octant (Oct), Petite Ourse (UMi) | 801–880 | 80 |

L’[audit préalable](CATALOGUE_88_AUDIT.md) conserve les 88 correspondances,
alias et décisions avant génération. Le Serpent représente une seule
constellation officielle, même avec ses deux parties ; Hydre/Hydre mâle et les
deux Triangles restent distincts. La Table et la Petite Ourse ne remplacent
aucune identité historique.

## Sources et génération

Les identités officielles viennent de la [liste UAI](https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx).
Les tracés utilisent exclusivement le référentiel Stellarium Western/Hipparcos
déjà versionné et ses licences : [attribution](ASTRONOMY_DATA_ATTRIBUTION.md).
L’UAI définit les régions officielles ; les traits sont la convention Western.
L’alias source Tra est présenté sous le code officiel TrA, sans modifier les
positions Hipparcos ni les segments.

`node scripts/generate-iau-completion.mjs` réutilise les générateurs existants
classic, hybrid et mosaic, avec la graine 20261106 et des pools 8/9/10.
Les autres familles essayées n’ont fourni aucun candidat unique et entièrement
prouvable aux tailles retenues ; aucune règle de validation n’a été relâchée.
Les quotas de tailles candidates sont globaux. La sélection se fait ensuite
sur le score de preuve réel, puis distribue les dix positions de chaque
constellation pour obtenir une courbe non décroissante à chaque échelle.
Les 380 formes sont distinctes sous rotations, symétries et renommages ;
elles ne reproduisent aucune grille de CAT ni des 500 quêtes précédentes.
Toutes les régions sont connexes et sans singleton.

La nouvelle sélection comprend 90 grilles 8×8, 202 grilles 9×9 et 88 grilles
10×10 : 352 mosaic, 18 hybrid et 10 classic. Les 380 portent le libellé
**Expert** du contrat existant, qui n’est pas recalibré. Le score mesuré affine
ce libellé : A6 119–159 (moyenne 133,95), A7 159–168 (164,20), A8 168–202
(173,47), A9 202–219 (208,97). A5 conserve ses scores 102–142 ; A6 prolonge
ce niveau avec un chevauchement d’entrée. Un score de preuve ne remplace pas
une mesure du temps ou de la difficulté ressentie par des joueurs.

Le [rapport détaillé des 380 quêtes](validation/iau-completion.md) donne chaque
taille, difficulté, unicité, preuve et anomalie. Le validateur recalcule les
solutions et rejoue le moteur depuis une grille vide, sans faire confiance au
statut du manifeste. Il échoue sur toute divergence ; `--write` renouvelle
uniquement le rapport déterministe. Aucun générateur ne tourne chez le joueur.

## Intégration et finale

Les registres communs alimentent Mon ciel, les cartes, les badges, les défis,
les aides et les écrans administrateurs. Les huit constellations de la dernière
aventure utilisent la pagination habituelle ; ses 80 quêtes suffisent à la
terminer. Les totaux et frontières restent dérivés des métadonnées.

La célébration existante distingue « Le ciel est réuni » (toutes les quêtes)
et « Le ciel pleinement maîtrisé » (tous les badges actuellement éligibles).
Elle choisit une seule priorité si les deux événements coïncident. Le dernier
badge peut être gagné lors d’un replay ; les restaurations et lots distants
ne fabriquent pas de célébration. Le panorama reste borné à l’aventure jouée,
avec bilan global et retour à Mon ciel, clavier et animation réduite conservés.
Aucune règle de jeu, dépense, aide ni étape d’onboarding n’est modifiée.

## Sauvegardes et activation

La révision 4 est append-only ; les révisions 1–3 restent intactes. Le hash
`iau-completion-baseline.json` protège les définitions complètes des 500 quêtes
antérieures, y compris récompenses et difficultés. Aucun backfill de compte,
réinitialisation ou renommage de clé de sauvegarde n’est prévu. Les comptes
anciens poursuivent vers A6 selon leurs droits et prérequis existants.
Une progression synthétique jouant les 880 quêtes occupe 394325 octets JSONB
estimés, sous la limite existante de 524288 ; les cas de sauvegardes historiques
plus volumineuses conservent les mécanismes existants de protection/diagnostic.
La capture facultative d’assistance peut répartir ses faits courants sur plusieurs
blocs locaux du protocole existant, sans troncature ni hausse des limites serveur.

La migration CLI `20261106115913_complete_iau_catalogue.sql` ajoute uniquement
380 règles/entrées d’allowlist et autorise la nouvelle cohorte, avec défaut 4
pour les profils vides. Elle ne touche aucune progression, récompense, identité
Auth, entitlement ou ligne de joueur existante. Elle doit être activée avant
le client révision 4, après ses contrôles SQL et l’autorisation de production
distincte. L’inventaire doit montrer 880 règles au total, 380 nouvelles et 80
pour A9 ; le déclencheur doit continuer d’interdire de réécrire les cohortes.

Un retour du client ne doit **jamais** supprimer les nouvelles règles, les
reçus, les quêtes gagnées ni la prise en charge des cohortes 4 déjà créées.
Préférer un correctif en avant ; tout rollback de défaut doit conserver les
cohortes et données existantes. Ne pas exécuter les fixtures sur la production.

## Vérifications et recette

- `node scripts/iau-completion-tests.mjs` : identité exacte, droits, séquence
  A6→A9, 80 quêtes finales, récompenses idempotentes, progression complète et taille.
- `node scripts/validate-iau-completion.mjs` : les 380 grilles et leur rapport.
- `node scripts/audit-catalogue.mjs` et les suites historiques : CAT, indices,
  régions, aides et récompenses préexistantes.
- `node scripts/audit-astronomical-figures.mjs` et
  `node scripts/validate-playable-astronomy.mjs src/data/astronomy/stellarium-western-figures.json` :
  88 références exactes et intégrité de la géométrie épinglée.
- `node scripts/test-affected.mjs --full` : gate complet, dont navigateur à
  320/390/1440 px, passages d’aventures, consultation hors ligne et finales.
- La suite d’indices intégrée dérive ses tailles du catalogue et couvre aussi
  les nouvelles grilles 9×9/10×10. Le scénario cloud A6 authentifié vérifie
  tentative conservée hors ligne, capture en attente puis confirmation unique
  après reconnexion et redémarrage, avec la fixture RPC partagée historique.
- CI ledger-sql : migrations et parité client/serveur de toutes les quêtes en
  PostgreSQL jetable ; la fixture IAU envoie 380 victoires et leurs réessais,
  puis rejoue chaque victoire depuis un second appareil synthétique sans double gain.

L’exécution locale/CI, la fusion, la publication effective et la recette réelle
sont des états distincts. Les preuves finales de PR/SHA doivent être relevées
à la livraison. Restent à accepter sur appareils physiques : lisibilité des
10×10 et gestes/aides sur petit écran, rythme Expert, parcours complet A9 et
synchronisation entre deux appareils avec coupure réseau. Les tests synthétiques
ne constituent pas une recette Android/iOS réelle. Aucun compte réel n’est modifié
pour fabriquer une preuve d’acceptation.
