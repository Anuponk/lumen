# Lumen · Communautés, messages et calendrier de diffusion (#759)

Ce document prépare la diffusion. **Rien n'est publié automatiquement.**
Chaque publication est une action manuelle du propriétaire, qui doit d'abord relire les règles en vigueur de la communauté.
La diffusion est distincte du déploiement technique.

Principes :
- se présenter comme l'auteur du jeu ;
- montrer une vraie grille ;
- demander un retour précis ;
- répondre aux commentaires ;
- aucun faux témoignage, aucun vote sollicité ;
- jamais plusieurs communautés le même jour avec le même texte.

## 1. Communautés ciblées

Règles « vérifiées » : relevées le 21/11/2026 sur la page officielle.
« À vérifier » : la page n'a pas pu être lue automatiquement (Reddit bloque les lecteurs automatiques). Il faut alors lire les règles affichées dans la barre latérale ou l'onglet *About* juste avant de publier.

| # | Communauté | Pourquoi | Règles de promotion | Format conseillé |
|---|---|---|---|---|
| 1 | Hacker News · Show HN (news.ycombinator.com/showhn.html) | Public technique, aime les projets indépendants jouables | **Vérifiées** : projet fait soi-même, non trivial, que l'auteur est là pour discuter ; facile à essayer, idéalement sans inscription ; pas de page d'atterrissage seule ; ne jamais demander de votes ou de commentaires à des proches. Titre « Show HN: … » | Lien direct vers le jeu (`/`), texte court sur la conception des grilles et l'absence de publicité |
| 2 | r/puzzlevideogames | Jeux de logique, public cœur | À vérifier (self-promotion, flair) | Courte vidéo B1 + lien en commentaire si les règles l'exigent |
| 3 | r/WebGames | Jeux jouables dans le navigateur, sans installation | À vérifier (exigences « jouable sans inscription », titres) | Lien direct, titre descriptif |
| 4 | r/playmygame | Demande explicite de retours de joueurs | À vérifier (format de post, flair, réciprocité) | Questions précises : difficulté des quêtes 1 à 10, compréhension des règles |
| 5 | r/IndieGaming | Indépendants, visibilité | À vérifier (ratio d'auto-promotion, jours dédiés) | Vidéo C1 (constellation rallumée) |
| 6 | r/puzzles | Énigmes de logique | À vérifier (souvent réservé aux énigmes, pas aux produits) | Poster seulement une **grille-énigme** (A1) si les règles l'autorisent, sans lien promotionnel |
| 7 | r/jeuxvideo (francophone) | Public francophone | À vérifier | Présentation en français, vidéo C1 |
| 8 | itch.io (page de jeu + devlog) | Vitrine indépendante, communauté de joueurs | À vérifier (conditions de publication d'un jeu web) | Page « HTML5 » renvoyant vers le jeu, devlog avec captures |
| 9 | Mastodon / Bluesky (#gamedev, #indiegame, #puzzle) | Réseaux ouverts, pas d'algorithme payant | Pas de règle centrale : respecter les règles de l'instance et utiliser l'avertissement de contenu si demandé | Vidéos courtes, une par semaine |
| 10 | Discords de jeux de logique (par exemple communautés nonogram ou sudoku) | Joueurs très engagés | Règles propres à chaque serveur, souvent un salon dédié à l'auto-promotion : **demander aux modérateurs avant** | Message dans le salon prévu, sans mention @everyone |

## 2. Messages de présentation

Adapter chaque message à la communauté, sans copier-coller identique.
Liens à utiliser :
- jeu : `https://lumen.nopuna.fr/` ;
- découverte : `https://lumen.nopuna.fr/decouvrir.html` (FR) ou `https://lumen.nopuna.fr/discover.html` (EN) ;
- vidéos : uniquement les paramètres UTM autorisés (`youtube_shorts`, `instagram_reels`, `tiktok`), voir [KIT_VIDEOS_LUMEN.md](KIT_VIDEOS_LUMEN.md).

**FR · présentation courte**
> Bonjour ! Je développe Lumen, un jeu de logique gratuit et sans publicité : on place un Gardien par ligne, par colonne et par territoire coloré, et chaque grille résolue rallume une étoile d'une vraie constellation (88 au total). Il se joue dans le navigateur, sans compte pour commencer. Je cherche surtout des retours sur la courbe de difficulté des dix premières quêtes et sur la clarté des règles. Merci d'avance pour vos remarques, même critiques !

**EN · short introduction**
> Hi! I'm making Lumen, a free, ad-free logic puzzle: place one Guardian per row, column and coloured territory, and every solved grid relights a star of a real constellation (88 in total). It runs in the browser, no account needed to start. I'm mostly looking for feedback on the difficulty curve of the first ten quests and on how clear the rules are. Thanks for any comment, critical ones included!

**FR · Show HN / technique**
> Lumen est un jeu de grilles déductibles sans hasard : chaque grille a une solution unique et explicable, générée à partir des tracés réels des constellations (sources astronomiques sous licence). PWA sans framework, jouable hors ligne. Retours bienvenus sur les règles et la progression.

**EN · Show HN title and text**
> Show HN: Lumen – a logic puzzle where solved grids relight real constellations
> Each grid has a unique, explainable solution, built from real constellation figures (licensed astronomical sources). Framework-free PWA, works offline, no ads, no account needed to start. I'd love feedback on the rules and the progression.

**Réponse type à un retour**
> FR : Merci, c'est exactement le genre de retour dont j'ai besoin. Je note [point précis] ; puis-je te demander à quelle quête tu as bloqué ?
> EN : Thanks, that's exactly the kind of feedback I need. Noted [specific point]; may I ask which quest you got stuck on?

## 3. Calendrier progressif (proposition, 4 semaines)

Une seule nouvelle communauté par semaine. Le reste du temps sert à répondre aux retours et à corriger.
Calendrier à décaler si la recette #882 ou #898 n'est pas terminée.

| Semaine | Communauté | Contenu | Vidéo du kit | Objectif mesurable |
|---|---|---|---|---|
| S1 | r/playmygame (après lecture des règles) | Présentation + demande de retours précis | B1 | ≥ 5 retours détaillés |
| S1 | Mastodon / Bluesky | Vidéo + 2 phrases | A1 | Clics `decouvrir.html` (logs) |
| S2 | Show HN | Présentation technique | aucune (lien direct) | Démarrages quête 1 (canal non attribué, voir §5) |
| S2 | Mastodon / Bluesky | Vidéo | B2 | — |
| S3 | r/WebGames ou itch.io | Lien direct, page itch.io | C1 | Démarrages et réussites quête 1 |
| S3 | YouTube Shorts / Reels / TikTok (comptes disponibles) | Vidéos avec description du kit | A2, C2 | `app_opened` par canal UTM |
| S4 | r/IndieGaming / r/jeuxvideo | Vidéo C1, version FR pour r/jeuxvideo | C1 | Retours et ouvertures |
| J+30 | Bilan | Comparer les canaux (§5), garder 1 ou 2 canaux | — | Bilan dans #759 |

## 4. Modèle de suivi des publications

Copier ce tableau dans #759, ou dans un tableur privé, après chaque publication. Ne noter aucune donnée personnelle de commentateur.

| Date | Communauté | Lien de la publication | Texte / vidéo utilisés | UTM | Règles relues (oui/non, date) | Réactions utiles (nombre) | Retours notables (résumé) | Actions décidées | Statut modération |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

## 5. Ce que l'on pourra mesurer (lien #708)

Détail des signaux et des requêtes : [PRODUCT_ANALYTICS · Mesure d'acquisition](../PRODUCT_ANALYTICS.md#mesure-dacquisition-708) et [acquisition-agregats.sql](acquisition-agregats.sql).

- **Mesurable par canal UTM** (partages, invitations, Shorts, Reels, TikTok) : ouverture du jeu, puis démarrage et première réussite de la quête 1, dans la même session.
- **Mesurable sans canal**, en agrégats serveur : défis créés, acceptés, terminés, abandonnés et envoyés à des amis. Requête ajoutée, sans identifiant.
- **Non mesurable par conception** :
  - rétention J+7 par canal, puisqu'aucun identifiant de campagne persistant n'est conservé, par choix de confidentialité ;
  - provenance d'un lien Reddit, Show HN ou Mastodon sans UTM autorisé. Ces liens ne sont pas ajoutés à la liste des UTM, pour ne pas créer de nouvelle collecte sans décision #708 ; pour ces communautés, le bilan reste qualitatif : retours, discussions, logs agrégés de `decouvrir.html` si conservés.
- **Préalable** : la collecte produit publique reste **désactivée** tant que le propriétaire ne l'a pas décidée (#316/#170). Sans activation, seules les requêtes serveur sur les défis et les logs o2switch fourniront des chiffres.
