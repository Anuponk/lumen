# Moteur astronomique générique — issue #241

## Règle fondatrice de génération — obligatoire
**Toute nouvelle Aventure et toute nouvelle constellation se basent sur le même référentiel astronomique validé.** Identité IAU, IDs HIP, coordonnées réelles RA/Dec, tracés d'un atlas documenté et licence compatible doivent être disponibles avant de générer une figure. Pas de points ni de segments inventés « pour dépanner », pas de dessin manuel différent par quête, et pas de génération partielle présentée comme fidèle. Le générateur échoue explicitement si les données ne couvrent pas entièrement la figure. Les anciennes sauvegardes et les indices d'étoiles révélées doivent rester récupérables par correspondance testée. Toute extension du catalogue et tout agent intervenant sur le générateur sont soumis à ce contrat, et pas seulement la migration actuelle.

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


## Phase 2b — récupération des étoiles des lignes via VizieR

L'outil `scripts/fetch-hipparcos-line-stars.py` télécharge (ou réutilise son cache ECSV) le catalogue **Hipparcos New Reduction I/311/hip2**, sélectionne **tous les identifiants HIP des lignes**, et exporte `{HIP: {raDeg,decDeg}}`. Cela élimine l'ancienne limite des 255 étoiles qui n'étaient que des ancres d'illustration. Le fichier résultant garde l'époque source **ICRS J1991.25** ; la projection géométrique est suffisante pour les figures d'affichage, mais aucune prétention à une propagation précise J2000/J2016 n'est faite.

```bash
uv run scripts/fetch-hipparcos-line-stars.py western-index.json hip-lines.json
node scripts/build-astronomical-catalogue.mjs western-index.json hip-lines.json astronomy-coverage.json
```

**Vérification requise avant inclusion dans Lumen :** les permissions de redistribution commerciales pour les données de tracé Stellarium Western et leurs exigences CC BY-SA, attribution et notice. Aucune donnée tierce n'est embarquée dans cette PR.

L'importeur traite `thin` et `bold` comme métadonnées de lignes Stellarium, jamais comme des identifiants stellaires.


## Phase 3 — pont de compatibilité visuelle (PR #289)

Le module `src/ui/astronomical-legacy-bridge.js` propose un branchement **non destructif** d'une figure astronomique vérifiée : le registre devra fournir la liste ordonnée des identifiants HIP correspondant **aux indices historiques** des étoiles déjà gagnées. Un tableau de correspondance absent, de mauvaise taille ou contenant des doublons est rejeté ; le composant garde alors le dessin existant. Seuls les segments réellement présents dans l'atlas et reliant deux étoiles correspondantes sont réutilisés. **Aucune connexion artificielle n'est inventée.** Le nombre d'étoiles et leurs index de révélation ne changent jamais.

Ce module constitue une **interface de migration**, pas une validation des mappings : actuellement, les associations historiques index -> HIP restent à établir et à approuver pour les 24 figures historiques, et la donnée HIP complète doit être obtenue puis validée avec sa licence. Les 40 dessins ne sont donc **pas encore remplacés**. Dans un prochain changement, brancher exclusivement les figures intégralement validées au composant de navigation et au détail de Mon ciel ; vérifier Orion et chaque vue en environnement de recette avant production.


## Verrou de publication du catalogue (PR #291)

L'importeur accepte les abréviations IAU à casse mixte (`UMa`, `CVn`, `CMi`, `CrB`), et non seulement les noms de type `Ori`. Pour un rapport issu de `scripts/build-astronomical-catalogue.mjs`, exécuter `node scripts/validate-playable-astronomy.mjs <rapport.json>`. La commande quitte avec le code 2 si l'une des **40 constellations canoniques** manque, est incomplète ou possède des structures HIP incompatibles. Tant que cette commande échoue, aucun nouveau tracé ne doit être activé dans l'interface.

La validation 40/40 est **distincte** du mapping entre indices de sauvegarde et identifiants HIP. Le téléchargement des données VizieR, les obligations d'attribution CC BY-SA et la correspondance historique restent des prérequis séparés. Aucun nombre de figures réellement couvertes n'est présumé avant l'exécution vérifiée sur les sources complètes.


## Exécution réelle automatisée de l'import (workflow GitHub Actions)

Le workflow `.github/workflows/astronomical-catalogue.yml` télécharge un `western/index.json` Stellarium **épinglé à un commit**, récupère les étoiles Hipparcos II nécessaires auprès de VizieR, construit les 88 tracés de la source puis valide explicitement la couverture des 40 identités utilisées par Lumen. Les fichiers temporaires (`report.json` et `hip-lines.json`) sont conservés comme artefacts CI pendant 14 jours pour analyse. Ce workflow ne publie **aucun** asset vers le jeu.

**Attribution source :** Stellarium skycultures — Western, Stellarium team, texte et données CC BY-SA (voir `western/description.md` du dépôt Stellarium, commit sélectionné) ; coordonnées stellaires tirées de VizieR `I/311/hip2`, Hipparcos New Reduction (van Leeuwen 2007), CDS Strasbourg. Avant distribution d'un catalogue dérivé, préciser l'attribution, les conditions de partage et les licences dans le produit. Si la source distante n'est pas disponible ou si une figure manque, le workflow doit échouer ; aucun faux succès ni téléchargement de données partielles ne doit permettre de déployer un tracé.
