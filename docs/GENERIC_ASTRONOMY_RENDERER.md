# Moteur astronomique générique — issue #241

## Dimensions du catalogue
Le catalogue de lancement comprend 400 **quêtes** dans quatre Aventures, chacune regroupant 10 **constellations** : 40 figures distinctes. Le moteur vise les 88 figures IAU, puis tout futur contenu sans géométrie dessinée par quête.

## Phase 1 — projection mathématique
`src/ui/astronomical-projection.js` accepte des étoiles repérées par ID stable et coordonnées RA/Dec en degrés et des polylignes de ces IDs. Il calcule une base locale, projette sur un plan, centre et ajuste sans étirement anisotrope. Il gère le passage 359°/0° et les régions polaires. Il ne lit ni n'écrit aucun profil joueur.

La projection n'est **pas encore connectée** à Mon ciel : aucune figure existante n'est remplacée en phase 1.

## Phase 2 — catalogue astronomique de confiance
1. Valider la licence, la provenance, les conditions de diffusion commerciale et l'attribution des tracés Stellarium de la culture sélectionnée. Chaque culture peut avoir sa propre licence.
2. Charger les segments avec IDs HIP et les coordonnées correspondantes du catalogue Hipparcos (RA/Dec), en versionnant la source et sa date.
3. Ajouter des adaptateurs de correspondance IAU/code local (y compris Grande Ourse/Grand Chariot et traductions), sans se fonder uniquement sur le texte affiché.
4. Vérifier la présence de chaque étoile citée, l'absence de doublons et la projection des 40 figures.
5. Préserver les vieux indices de révélation d'étoiles et le nombre de récompenses ; ne jamais réinterpréter silencieusement un ancien index. Prévoir une compatibilité d'affichage ou un mapping testé explicitement.
6. Brancher **les deux** vues Mon ciel et la révélation de constellation sur le même adaptateur, puis tester desktop/mobile et le PWA.

## Précision astronomique
L'IAU normalise les frontières de 88 constellations, pas une liste universelle de lignes à dessiner. Le rendu représente **une convention d'atlas** documentée. Utiliser des coordonnées réelles évite de reconstruire chaque forme à la main ; le choix des connexions demeure une convention.

## Règles de livraison
Ne pas confondre « projection disponible » avec « migration des 40 constellations terminée ». Aucun changement des sauvegardes, quêtes, gains, succès et entitlements dans cette phase.


## Phase 2a — audit réel des sources (11 octobre 2026)

- Tracés : `Stellarium/stellarium-skycultures/western/index.json`, 88 figures IAU, lignes référencées par IDs Hipparcos (HIP), version source SHA `70471c1a3f4da066751e33eb4cd8f168aefeba00`.
- Coordonnées pilotes : `Found-in-Space/stellarium-skycultures/packages/stellarium-skycultures-western/source/constellation-anchors.json`, 255 étoiles HIP (source SHA `4a6256419b72578cf5bdf730e387aad57c410aa7`). **Ce fichier décrit les ancres d'illustration, non toutes les étoiles des lignes.**
- Couverture vérifiée en croisant réellement les 88 lignes et les 255 ancres : **19 constellations complètes sur 88** ; **Orion n'a que 3 étoiles documentées sur les 19 nécessaires**. Ces coordonnées sont donc insuffisantes pour publier toutes les figures.
- Les licences doivent être validées à la granularité des fichiers et de la culture avant inclusion des données dans le jeu ; le packaging tiers (code MIT) ne change pas la licence du contenu Stellarium (indiqué CC BY-SA pour les données de la culture Western).
- Le générateur `scripts/build-astronomical-catalogue.mjs` accepte **deux fichiers locaux légalement réutilisables** (index Stellarium-compatible et dictionnaire `HIP: {raDeg,decDeg}`), produit un rapport détaillé et termine avec un code d'échec tant que la couverture n'est pas complète. Il **n'embarque pas** ces sources dans le produit.
- Prochaine dépendance : trouver/fournir un export complet et utilisable des coordonnées HIP avec epoch cohérente, puis résoudre explicitement le mapping entre les figures IAU et les 40 figures de Lumen. Ne remplacer aucun dessin existant tant que ce travail n'est pas complet.

Exécution hors ligne après vérification des licences :
```bash
node scripts/build-astronomical-catalogue.mjs western-index.json hip-coordinates.json astronomy-coverage.json
```
