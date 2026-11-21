# Lumen · Kit de six vidéos verticales

Six scripts pour YouTube Shorts, Instagram Reels et TikTok. Capture sur un profil de test local, dans la campagne standard, sans compte réel ni grille de défi. Le catalogue Lumen fournit les grilles et leurs solutions. Coordonnées ci-dessous en base 1, depuis le coin supérieur gauche.

## Capture commune

- Enregistrer en 9:16 sur Chromium Android ou sur Chromium desktop en fenêtre mobile. Sortie 1080 × 1920 à 30 i/s. Dans Lumen, garder entièrement visibles la grille et ses couleurs. Réserver les marges haute et basse aux interfaces des plateformes.
- Couper les notifications, fermer les menus de compte et masquer le nom, les notifications, les QR, les URLs de défi et les éléments de QA. Garder la grille, les gestes et les animations réelles. Placer les sous-titres hors de la grille avec un fond opaque et tester la vidéo sans son.
- Pour A, préparer la vraie grille avec les autres Gardiens déjà placés, puis lancer la capture. Pour B, ajouter des croix par les commandes du jeu ou poser les repères en surimpression sur les cellules exactes. Pour C, capturer la dernière pose et la victoire dans une seule prise. Accélérer ou couper les temps d’attente au montage, sans changer le score ni le chrono affiché.
- Exporter une version maîtresse sans filigrane. Vérifier le cadrage et la lisibilité sur Android. Les descriptions pointent vers la page de découverte. Si la plateforme rend les liens non cliquables, utiliser le lien de profil. Faire valider chaque export et sa description par le propriétaire avant toute diffusion.

Pour comparer les canaux autorisés, ajouter `?utm_source=youtube_shorts&utm_medium=social`,
`?utm_source=instagram_reels&utm_medium=social` ou `?utm_source=tiktok&utm_medium=social`
à l’URL de découverte du lien publié ou du profil correspondant. Garder l’URL
courte à l’écran. Consulter les [limites de mesure](../PRODUCT_ANALYTICS.md#mesure-dacquisition-708).

## Production reproductible (#759, 21/11/2026)

Les six vidéos sont **enregistrées à partir du vrai jeu** : vraies grilles du catalogue, Gardiens et croix posés par de vrais touchers, vraie scène de victoire. Aucun montage ne modifie le chrono ni la solution.

- **Scènes** : `scripts/marketing/video-kit-scenes.mjs` décrit, pour chaque scène, la quête, les Gardiens déjà posés, les actions minutées et les sous-titres FR/EN. `video-kit-tests.mjs` (CI) refuse un Gardien hors solution, une croix posée sur une case de la solution, ou une scène A/C qui ne termine pas la grille.
- **Enregistrement** : `node scripts/marketing/record-video-kit.mjs --out <dossier>`, avec `LUMEN_FFMPEG` (ffmpeg avec libx264 et libass) et, si besoin, `LUMEN_CHROME_BIN`.
  - **Rendu** : Chrome headless en 9:16 (405 × 720 px CSS à ×8/3, donc 1 080 × 1 920), sous-titres incrustés en haut, sous le logo, sans couvrir la grille.
  - **Hygiène** : bandeau QA, toasts et invites de compte masqués ; seules les quêtes précédant la scène sont marquées résolues.
  - **Langues** : chaque langue est enregistrée avec le jeu dans cette langue.
  - **Contrôle** : l'enregistrement échoue si un Gardien prévu n'est pas réellement sur le plateau ou si une grille A/C n'est pas résolue.
- **Sans ffmpeg** : le script conserve les images et produit les SRT. `--check` régénère seulement les SRT de [`video-kit/`](video-kit/), à téléverser comme sous-titres sur YouTube.
- **Rendus du 21/11/2026** : 12 MP4 (A1–C2 × FR/EN, 18–24 s, 1080 × 1920, H.264, 1,3–2,2 Mo), conservés **hors dépôt** sur le poste du propriétaire.
  - **Limites** : montage simple, sans musique ni zoom ; dans les versions EN, quelques textes de la scène de victoire restent en français (couverture i18n #754).
  - **Statut** : validation du propriétaire requise avant toute publication.

## A1 · Le dernier Gardien sur la quête 1 · 18 s

- **Concept et grille**. `base-q001`, Grande Ourse · Grand Chariot, 5 × 5. Laisser vide L5C4. La cinquième ligne et la quatrième colonne sont les seules libres. Le territoire restant contient cette intersection.
- **Montage et sous-titres**. 00–03 « Où placer le dernier Gardien ? » sur la grille réelle avec quatre Gardiens. 03–07 « Une seule ligne libre. » surligner L5. 07–10 « Une seule colonne libre. » surligner C4. 10–13 « Leur intersection est dans le bon territoire. » poser en L5C4. 13–15 laisser apparaître le résultat. 15–18 « Essaie Lumen » + URL.
- **Capture**. Marquage auto désactivé si disponible. Conserver les quatre placements, suivre la ligne et la colonne au montage, garder le clic et le début de l’animation dans la prise.
- **YouTube Shorts**. Peux-tu trouver le dernier Gardien de la quête 1 ? Une vraie grille de Lumen. https://lumen.nopuna.fr/decouvrir.html
- **Instagram Reels**. Quelle est ta réponse avant la révélation ? Une ligne, une colonne, un Gardien. Lumen à découvrir via le lien du profil.
- **TikTok**. Pause à la grille et choisis ta case. ✦ Essaie Lumen via le lien du profil. #JeuDeLogique

## A2 · Le dernier Gardien sur la quête 2 · 19 s

- **Concept et grille**. `base-q002`, Grande Ourse · Grand Chariot, 5 × 5. Garder L4C2 pour la fin. Le territoire de la quatrième ligne est vide. C1, C3, C4 et C5 sont prises.
- **Montage et sous-titres**. 00–03 « Un territoire attend son Gardien. » entourer la quatrième ligne. 03–07 « Les quatre autres colonnes sont prises. » repères successifs sur C1, C3, C4, C5. 07–11 « Quelle colonne reste libre ? » pause de lecture. 11–15 « La deuxième. Il ne touche aucun Gardien. » pose en L4C2. 15–19 « À toi de jouer dans Lumen » + URL.
- **Capture**. Placer les quatre autres Gardiens sur la grille réelle. Surligner L4 sans recouvrir le contraste des cellules, puis filmer la pose et garder le retour positif.
- **YouTube Shorts**. Le dernier territoire de la quête 2 attend son Gardien. Repère la bonne colonne dans Lumen. https://lumen.nopuna.fr/decouvrir.html
- **Instagram Reels**. Cherche la colonne libre avant la fin du compte à rebours. Lumen à découvrir via le lien du profil.
- **TikTok**. Une des cinq colonnes est encore libre. Tu la vois ? ✦ Lumen, lien en bio. #PuzzleLogique

## B1 · Du territoire d’une case à la deuxième étoile · 20 s

- **Concept et grille**. `base-q001`, 5 × 5. Le territoire d’une case impose L3C3. Après l’élimination des cases de sa ligne, de sa colonne et du voisinage, L5C4 est l’unique candidate de son territoire.
- **Montage et sous-titres**. 00–03 « Une déduction en 20 secondes. » afficher la grille vide. 03–07 « Ce territoire n’a qu’une case. » poser en L3C3. 07–12 « Retire la ligne, la colonne et les cases qui touchent. » montrer les marques pertinentes. 12–16 « Dans ce territoire, il reste une seule case. » pointer et poser en L5C4. 16–20 « Essaie la suite dans Lumen » + URL.
- **Capture**. Suivre l’[exemple officiel](../../comment-jouer.html). Filmer les deux poses en temps réel, puis raccourcir les marques intermédiaires au montage. Le deuxième Gardien seul ne termine pas la quête.
- **YouTube Shorts**. Deux Gardiens déduits dans la première grille de Lumen. Joue le reste de la quête. https://lumen.nopuna.fr/decouvrir.html
- **Instagram Reels**. On part d’un territoire d’une case. Regarde comment une pose en impose une autre. Lien du jeu dans le profil.
- **TikTok**. Ce Gardien en révèle un autre. Tu peux finir la grille dans Lumen. ✦ Lien en bio. #JeuDeLogique

## B2 · Pourquoi le deuxième Gardien est forcé · 21 s

- **Concept et grille**. `base-q002`, 5 × 5. L1C1 est le seul emplacement de son territoire. Dans le territoire qui comprend les autres cases de L1 et L2C1–C3, il ne reste alors que L2C3.
- **Montage et sous-titres**. 00–03 « Une case suffit à débloquer la suite. » 03–06 « Ce territoire impose le coin. » poser en L1C1. 06–11 « Même ligne et cases voisines interdites. » montrer les exclusions dans le territoire voisin. 11–17 « Il reste cette case. » poser en L2C3 après une courte pause. 17–21 « Résous la suite dans Lumen » + URL.
- **Capture**. Poser dans le coin supérieur gauche. Garder L2C3 distincte à l’image, avec un contour temporaire à contraste élevé. Laisser les autres Gardiens à découvrir.
- **YouTube Shorts**. Une case isolée suffit à trouver le deuxième Gardien de la quête 2. https://lumen.nopuna.fr/decouvrir.html
- **Instagram Reels**. Regarde le coin en haut à gauche, puis suis les cases impossibles. Découvre le jeu via le profil.
- **TikTok**. Le coin impose le prochain placement. ✦ Joue la suite dans Lumen, lien en bio. #PuzzleLogique

## C1 · La Grande Ourse se rallume · 24 s

- **Concept et grille**. `planned-real-01-q10`, quête 10 du Grand Chariot. Prendre la première complétion sur un profil de capture ayant réellement validé les neuf quêtes précédentes.
- **Montage et sous-titres**. 00–04 « Il manque une étoile au Grand Chariot. » plan réel du ciel avant la quête. 04–09 « Dernière quête de la Grande Ourse. » transition vers la grille 8 × 8 presque résolue. 09–13 « Dernier Gardien. » poser en L8C4 sur la grille préparée. 13–20 « La Grande Ourse brille à nouveau. » laisser la constellation et la vraie célébration apparaître. 20–24 « Rallume le ciel dans Lumen » + URL.
- **Capture**. Filmer le ciel avant la dernière quête, puis capturer la pose et la célébration dans une prise continue. Garder visible la transition vers la figure céleste. Recadrer les éventuelles données de profil.
- **YouTube Shorts**. Une vraie victoire dans la dernière quête de la Grande Ourse. À toi de rallumer le ciel. https://lumen.nopuna.fr/decouvrir.html
- **Instagram Reels**. De la dernière case à la constellation rallumée. Découvre la Grande Ourse dans Lumen, lien du profil.
- **TikTok**. Un dernier Gardien, et le Grand Chariot s’illumine. ✦ Lumen, lien en bio. #Constellations

## C2 · La première étoile de Cassiopée · 22 s

- **Concept et grille**. `base-q007`, quête 11 et première grille de Cassiopée, 6 × 6. Montrer une nouvelle constellation qui commence à s’allumer.
- **Montage et sous-titres**. 00–04 « Après la Grande Ourse, place à Cassiopée. » montrer la figure dans Mon ciel. 04–09 « Une nouvelle grille, une première étoile. » passer sur la vraie quête presque résolue. 09–13 « Dernier Gardien ! » poser en L6C5. 13–18 « La première étoile s’allume. » garder le résultat de la première victoire. 18–22 « Découvre ton ciel dans Lumen » + URL.
- **Capture**. Sur le même profil que C1, avancer vers Cassiopée et filmer sa première victoire. Garder le nom de la constellation à l’écran. Ne pas utiliser un rejeu pour enregistrer la première étoile.
- **YouTube Shorts**. Une nouvelle constellation commence à s’illuminer avec la première quête de Cassiopée. https://lumen.nopuna.fr/decouvrir.html
- **Instagram Reels**. L’aventure continue dans Cassiopée. Voici sa première étoile dans Lumen. Lien du jeu dans le profil.
- **TikTok**. Aujourd’hui on allume la première étoile de Cassiopée. ✦ Essaie Lumen via le lien en bio. #Constellations
