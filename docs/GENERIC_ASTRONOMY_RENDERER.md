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
