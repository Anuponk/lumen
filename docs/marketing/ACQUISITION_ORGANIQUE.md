# Acquisition organique : publication quotidienne et mini-puzzles (#1056, #1057)

Chantier du 27/11/2026, coordonné avec le studio vidéo [#1046](https://github.com/Anuponk/project-menlu/issues/1046) et le plan marketing de décembre (`Anuponk/lumen-marketing/plans/2026-12.md`). L'étude Facebook Instant Games ([#1058](https://github.com/Anuponk/project-menlu/issues/1058)) reste en attente.

## Décisions du propriétaire (27/11/2026)

| Sujet | Décision | Conséquence |
|---|---|---|
| Rythme de 08h00 | Du 1er au 24 décembre, chaque post est une case du calendrier de l'Avent (mini-puzzle), avec un rappel du Défi du jour officiel. Ensuite, alternance : jour impair = Défi officiel, jour pair = mini-puzzle. | Un seul post par jour. Les 15 publications éditoriales de 18h30 restent sur Metricool. |
| Visuel du Défi officiel | La grille initiale est visible : seulement les territoires, aucun Gardien. | **Risque accepté** : un joueur peut étudier la grille avant de lancer son chrono. Le visuel ne montre jamais de Gardien, d'indice ni de solution. |
| Mesure | Compteurs agrégés à partir du journal d'accès o2switch. | Aucune écriture Supabase, aucun identifiant conservé. |
| Canal de publication | **Metricool**, compte payant de Rachel, sans API (décision du 27/11/2026). L'API Meta directe a été abandonnée : l'autorisation `pages_manage_posts` restait indisponible pour l'app. | Import mensuel d'un CSV généré au format exact du modèle Metricool. Le publieur o2switch (`lumen_social_post.py`) reste dans le dépôt, **désactivé**, pour une éventuelle bascule vers l'API. |

## Ce qui est livré

| Brique | Fichiers | Réutilise |
|---|---|---|
| Calendrier des mini-puzzles, sur 62 jours (01/12/2026 → 31/01/2027) | `src/acquisition/mini-puzzle.js`, `scripts/mini-calendar.mjs`, `content/generated/mini-calendar.json` | Catalogue canonique, contrôle d'unicité recoupé avec le solveur du jeu (`createGameEngine().solutions`), dates de Paris comme le Défi du jour |
| Pages jouables sans compte | `mini/AAAA-MM-JJ.html`, `mini/index.html`, `src/acquisition/mini-game.js`, `mini-calendar-page.js`, `mini.css`, `locales.js` | `landing.css`, palette des territoires du jeu, figures astronomiques officielles, `campaignUrl` / `discoveryUrlFor` |
| Calendrier de l'Avent | `mini/index.html` : 24 cases qui s'ouvrent à la date de Paris | Même calendrier |
| Visuels 1200×630 (aperçu Open Graph et image du post) | `scripts/marketing/social-visuals.mjs` → `content/social/mini-*.jpg`, `official-*.jpg` | Pipeline Chrome/CDP de `scripts/promo-og-assets.mjs` |
| Plan des posts de 08h00 | `src/acquisition/social-posts.js`, `scripts/marketing/social-posts.mjs` → `content/generated/social-posts.json` (+ export CSV Metricool) | Calendrier du Défi du jour (`daily-schedule.json`) |
| Publieur Facebook | `scripts/lumen_social_post.py`, `scripts/o2switch-social-post.sh` | Cron o2switch et configuration privée `~/lumen-private`, comme les e-mails d'activité |
| Mesure | Pixel statique `mini/t.gif` et `scripts/lumen_mini_counts.py` | Journal d'accès o2switch |

### Mini-puzzle (#1057)

- **Grilles** : quêtes « Facile » 6×6 de la première aventure, qui est gratuite (`base-real-sky`, ordinal ≥ 13). Le vivier compte 51 grilles. Aucune n'apparaît dans le calendrier du Défi du jour : c'est vérifié sur les 371 jours planifiés. Deux jours consécutifs ne prennent jamais la même constellation. Une grille ne revient pas avant que tout le vivier ait été utilisé.
- **Difficulté** : il manque 1 Gardien du 1er au 8 décembre, 2 du 9 au 16, 3 du 17 au 24, puis 2. La complétion est unique, ce que vérifient le générateur, la CI et le solveur du jeu.
- **Rien ne fuit** : la page contient les territoires et les Gardiens déjà placés, jamais la solution des lignes manquantes. Le calendrier ne contient que des numéros de lignes.
- **Jeu** : on touche une case pour la cycler (croix, Gardien, vide), comme dans le jeu. Les conflits sont signalés (ligne, colonne, territoire, contact). La victoire illumine la vraie figure de la constellation. Les boutons « Recommencer » et « Partager » sont disponibles.
- **Après la victoire** :
  - « Découvrir LUMEN » ouvre la page de découverte dans la langue choisie ;
  - « Installer l'application » ouvre `/?install=1`, le parcours d'installation existant ;
  - « Relever le Défi du jour officiel » ouvre `/?daily=1`. Les règles officielles restent inchangées. Un invité y voit l'explication et l'entraînement non classé.
  - Chaque lien porte `utm_source=mini_puzzle` et `utm_campaign=mini_AAAA-MM-JJ`.
- **Sans compte ni installation** : la page n'utilise ni Supabase ni service worker. Elle n'écrit que l'indicateur local `lumenMiniDoneV1`, la liste des jours résolus. Une case dont la date de Paris n'est pas arrivée affiche « Cette case s'ouvre le … ».
- **Langues** : le français par défaut. La page suit sinon le choix enregistré dans Lumen (`lumen.locale`), puis la langue du navigateur, en anglais ou en espagnol. Les textes sont dans `src/acquisition/locales.js` : le catalogue de l'application (540 Ko) est trop lourd pour une page d'acquisition mobile.
- **Aperçu propriétaire** : ajouter `?preview=1` à une page datée pour jouer avant sa date, par exemple `https://lumen.nopuna.fr/mini/2026-12-01.html?preview=1`. Ce mode n'envoie aucun pixel de mesure.
- **URL stables** : `https://lumen.nopuna.fr/mini/AAAA-MM-JJ.html`, avec un aperçu Open Graph propre à chaque date. `https://lumen.nopuna.fr/mini/` présente le calendrier de l'Avent et les jours précédents.

### Publication quotidienne (#1056)

- **Contenu** : un post par jour, avec un lien et l'aperçu Open Graph de la page. Le texte reprend la légende du plan, le lien UTM `utm_source=facebook_daily` et des hashtags adaptés au sujet. La légende ne contient jamais de coordonnées ni de solution.
- **Lien du Défi officiel** : `/?daily=1&utm_source=facebook_daily&utm_medium=social&utm_campaign=daily_AAAA-MM-JJ`. Les règles officielles (tentative, chrono, classement, authentification) ne changent pas.
- **Repli** : si le visuel d'un jour manque, le post reste un simple lien, et Facebook montre l'aperçu Open Graph de la page de destination.
- **Publieur** (`lumen_social_post.py`, lancé par le cron o2switch) :
  - `LUMEN_SOCIAL_MODE` vaut `off` par défaut. Il accepte aussi `dry-run`, qui écrit le journal sans appeler Meta, et `live`.
  - **Arrêt d'urgence** : créer le fichier `~/lumen-private/social-post.stop`, ou repasser en `off`.
  - **Anti-doublon** : le registre privé `~/lumen-private/social-post-ledger.json` a une clé `facebook:AAAA-MM-JJ`, dérivée de la date de Paris. L'entrée est réservée et écrite sur disque avant l'appel à Meta. Un statut `published` est définitif.
  - **Résultat incertain** (délai dépassé, connexion perdue) : l'entrée reste `reserved`, une seule alerte part et le script ne retente jamais tout seul. Il faut vérifier la Page, puis passer l'entrée à `published` ou la supprimer.
  - **Nouvelles tentatives** : au plus 3, et seulement sur HTTP 429/5xx. Une erreur 4xx (jeton expiré, permission) est définitive.
  - **Fenêtre** : de 08h00 à 11h00, heure de Paris. Passé 11h00, le post est sauté (`skipped-late`) et une alerte part.
  - **Alertes** : une ligne sur la sortie d'erreur, envoyée par le mail du cron (`MAILTO`), avec un code de sortie non nul. Le jeton n'est jamais écrit dans le journal ni dans le registre.
- **Coût** : aucun appel Supabase, aucune CI quotidienne. Le cron lance un script Python toutes les 10 minutes entre 7h et 12h. Le travail dû est vérifié localement avant tout appel HTTP, soit au plus un appel Meta par jour.

## Quotas et options de canal (vérifiées le 27/11/2026)

- **Metricool, plan gratuit** : 1 marque, environ 20 publications programmées par mois et **pas d'API**. L'API est réservée au plan Advanced, payant, à partir d'environ 43 à 53 € par mois selon le paiement, mensuel ou annuel. Les 15 posts éditoriaux de décembre consomment déjà l'essentiel du quota gratuit, donc les 31 posts quotidiens n'y tiennent pas. Aucun abonnement n'est souscrit. Sources : [Socialk](https://socialk.it/en/pricing/metricool), [Socialync](https://www.socialync.io/blog/metricool-pricing-2026), [Postiv](https://postiv.ai/blog/metricool-review). À revérifier sur la page tarifs de Metricool avant toute souscription.
- **Export pour Metricool** : voir « Import Metricool » ci-dessous, au format exact du modèle de calendrier.
- **API Graph de Meta** : elle est gratuite. Une app Meta en mode Développement publie sur une Page que gère un de ses administrateurs, avec `pages_manage_posts`, sans App Review ni vérification d'entreprise. Ces deux démarches ne sont nécessaires que pour publier sur la Page de quelqu'un d'autre. Endpoint : `POST /{page-id}/feed` avec `message` et `link`. Sources : [Meta Pages API](https://developers.facebook.com/docs/pages-api/), [guide de publication sans App Review](https://www.creatoros.ca/blog/facebook-graph-api-page-posting-without-app-review/).
- **Ouverture de l'application Android depuis un post** : un lien `lumen.nopuna.fr` s'ouvre d'abord dans le navigateur intégré de Facebook. Les Android App Links (`assetlinks.json`, déjà publié) peuvent ouvrir l'application installée quand le lien est ouvert hors de ce navigateur. Il n'y a pas de redirection garantie vers l'application. Le parcours `/?install=1` reste l'appel à l'action « Installer ».

## Import Metricool (canal retenu)

Le modèle du calendrier Metricool (Planificateur → ⋮ → Importer CSV → Télécharger le modèle), téléchargé le 27/11/2026, compte 102 colonnes. `METRICOOL_COLUMNS` (`src/acquisition/social-posts.js`) les reprend telles quelles, et la CI vérifie l'en-tête comme chaque ligne. Chaque ligne est un post photo **Facebook uniquement**, avec :
- le texte et son lien UTM complet ;
- la date et l'heure 08:00:00 ;
- le visuel du jour (`Picture Url 1`, URL publique sur `lumen.nopuna.fr`) et son texte alternatif ;
- le raccourcisseur de liens désactivé, pour garder les UTM.

Le fichier est en UTF-8 avec BOM, comme le modèle.

1. **Répétition** : générer un post en brouillon et l'importer.
   ```
   node scripts/marketing/social-posts.mjs --metricool=test.csv --from=2026-12-01 --to=2026-12-01 --draft
   ```
   À l'import, choisir le format de date `AAAA-MM-JJ` et l'heure `HH:MM:SS`. Vérifier dans le brouillon les retours à la ligne, le lien, l'image et l'heure. Le fuseau de la marque doit être Europe/Paris. Supprimer ensuite le brouillon.
2. **Mois complet** :
   ```
   node scripts/marketing/social-posts.mjs --metricool=decembre.csv --from=2026-12-01 --to=2026-12-31
   ```
   Importer le fichier **une seule fois**. Un second import créerait des doublons, que Metricool ne détecte pas.
3. **Contrôle** : 31 posts doivent apparaître à 08h00 dans le calendrier, sans conflit avec les 15 posts éditoriaux de 18h30, ni avec les posts déjà programmés sur l'ancien compte gratuit.
4. **Arrêt** : supprimer ou repasser en brouillon les posts programmés dans Metricool.

Prévoir l'import de janvier avant le 31 décembre, en régénérant d'abord calendrier et visuels si besoin.

## Activation de l'API Meta (option non retenue)

Le jeton de Page ne doit jamais passer par un chat, un e-mail ni Git. Le script `scripts/meta-page-token.py` le récupère et l'écrit directement dans le fichier privé, sur o2switch.

1. **App Meta** :
   - sur [developers.facebook.com](https://developers.facebook.com/apps), avec le compte Facebook administrateur de la Page LUMEN, choisir **Créer une app** ;
   - comme cas d'usage, prendre « Autre », puis le type **Entreprise** ;
   - laisser l'app en mode **Développement**, sans App Review ni vérification d'entreprise ;
   - noter l'**App ID** et la **clé secrète**, dans Paramètres → Général.
2. **Jeton court** :
   - ouvrir le [Graph API Explorer](https://developers.facebook.com/tools/explorer/) ;
   - choisir cette app, puis « Obtenir un token d'accès utilisateur » ;
   - cocher `pages_show_list`, `pages_read_engagement` et `pages_manage_posts`, puis autoriser la Page LUMEN ;
   - copier le jeton affiché, valable environ une heure.
3. **Configuration privée**, dans le Terminal cPanel :
   ```
   cd ~/lumen-staging && git pull --ff-only origin main
   python3 ~/lumen-staging/scripts/meta-page-token.py
   ```
   Le script demande l'App ID, la clé secrète et le jeton court ; les deux derniers sont masqués à la saisie. Il échange le jeton court contre un jeton longue durée, vérifie les trois permissions, liste les Pages où tu peux publier et te laisse choisir LUMEN. Il écrit ensuite `~/lumen-private/social-post.env` en mode 600, avec `LUMEN_SOCIAL_MODE=dry-run`, et vérifie l'accès sans rien publier.
4. **Contrôle facultatif** : coller le jeton de Page dans le [débogueur de jetons](https://developers.facebook.com/tools/debug/accesstoken/), dans ton propre navigateur. Il doit indiquer « Expire : jamais ». `python3 ~/lumen-staging/scripts/meta-page-token.py --check` revérifie l'accès à tout moment.
5. **Cron o2switch** (cPanel → Tâches cron) :
   - renseigner l'adresse e-mail des tâches cron : elle reçoit les alertes ;
   - ajouter ces deux tâches :
   ```
   */10 7-12 * * *  bash ~/lumen-staging/scripts/o2switch-social-post.sh
   20 1 * * *       bash ~/lumen-staging/scripts/o2switch-social-post.sh --counts
   ```
6. **Simulation** : le premier passage après 08h00 écrit l'entrée `dry-run:facebook:AAAA-MM-JJ` dans `~/lumen-private/social-post-ledger.json`, sans appeler Meta. La laisser tourner au moins deux jours, à partir du 1er décembre puisque le plan commence ce jour-là.
7. **Publication réelle** : après validation, remplacer `dry-run` par `live` dans `~/lumen-private/social-post.env`. Le lendemain à 08h00, vérifier le post sur la Page : texte, lien, aperçu et absence de doublon.
8. **Arrêt d'urgence** : `touch ~/lumen-private/social-post.stop`. Supprimer le fichier relance la publication.
9. **Jeton révoqué** (changement de mot de passe, retrait de l'app, perte du rôle sur la Page) : Meta répond par une erreur 4xx. Le post du jour échoue sans nouvel essai et une alerte part par e-mail. Il suffit de refaire les étapes 2 et 3.

Le mini-puzzle n'a pas de drapeau serveur. Il se coupe en passant `"enabled": false` dans `content/generated/mini-calendar.json`, puis en régénérant les pages, ce qui demande un déploiement. Le calendrier ne peut qu'être allongé : un jour publié n'est jamais modifié.

## Mesure

- La page du mini-puzzle charge `/mini/t.gif?e=<événement>&d=<jour>&l=<langue>&s=<source>`. Les événements sont `view`, `win`, `cta_discover`, `cta_install`, `cta_official` et `share`. La source se limite à une liste autorisée, sinon elle vaut `direct`. Aucun cookie, aucun identifiant.
- `lumen_mini_counts.py` lit chaque nuit le journal de la veille, en date de Paris, et écrit `~/lumen-private/acquisition/AAAA-MM-JJ.json`. Ce fichier ne contient que des compteurs par événement, jour, source et langue. S'y ajoutent les arrivées par UTM : pages mini, Défi officiel, découverte et installation. Les IP, user-agents et référents ne sont jamais écrits. Les robots sont ignorés, dont le robot d'aperçu de Facebook.
- Le chemin du journal est `~/access-logs/lumen.nopuna.fr*` par défaut. Il se règle avec `LUMEN_ACCESS_LOGS`, à vérifier dans cPanel → Visiteurs ou Journaux bruts.
- Ne pas confondre portée et joueurs acquis : l'acquisition réelle se lit dans le tunnel existant (#708), quand la collecte est autorisée.

## Mise à jour du calendrier et des visuels

Avant le 31/01/2027, ou pour prolonger :

```
node scripts/mini-calendar.mjs --until=2027-03-31
LUMEN_TEST_URL=http://127.0.0.1:8000/ LUMEN_CDP_URL=http://127.0.0.1:9222 node scripts/marketing/social-visuals.mjs --from=2027-02-01 --to=2027-03-31
node scripts/mini-calendar.mjs && node scripts/marketing/social-posts.mjs
```

La CI refuse un calendrier, une page ou un plan qui ne sont pas à jour : `--check` des deux scripts, lancé par `organic-acquisition-tests.mjs`.

## Tests

- `scripts/organic-acquisition-tests.mjs` (quality gate) vérifie :
  - l'unicité de chaque mini-puzzle, recoupée avec le solveur du jeu, et l'absence de toute grille du Défi du jour ;
  - le contenu des pages : pas de solution, aperçu Open Graph présent ;
  - l'ouverture des cases de l'Avent à la bonne date, la palette des territoires, les catalogues FR/EN/ES ;
  - les liens UTM et les pixels sans identifiant ;
  - le plan des posts : rythme, liens, légendes sans coordonnées, visuels ;
  - la publication de `mini/` par les deux chemins o2switch.
- `scripts/mini-browser.mjs`, lancé par `landing-browser-tests.mjs` à 360, 390 et 1440 px, vérifie :
  - la case fermée avant sa date de Paris, et le basculement à minuit, heure de Paris ;
  - le cycle croix → Gardien → vide, les conflits et la victoire avec ses trois appels à l'action ;
  - l'indicateur local, l'anglais et l'espagnol, le calendrier de l'Avent ;
  - l'absence de requête Supabase et des pixels sans identifiant ;
  - le démarrage réel de la page.
- `scripts/lumen_social_post_tests.py` (`quality.yml`, étape o2switch) vérifie, avec un transport simulé :
  - le mode `off` par défaut, l'arrêt d'urgence, la fenêtre de Paris en hiver et en été, et le passage de minuit ;
  - l'absence de doublon, l'absence de nouvel essai après un résultat incertain, le plafond d'essais sur 429/5xx, l'arrêt immédiat sur 4xx, et le refus de publier après 11h00 ;
  - la simulation, la validation des posts et le refus d'un registre corrompu ;
  - l'absence du jeton dans les journaux, et les compteurs extraits du journal d'accès.

## Recette à faire

| Parcours | Appareil | Attendu |
|---|---|---|
| Lien `/mini/AAAA-MM-JJ.html` ouvert depuis Facebook | Navigateur intégré de Facebook, Android et iPhone | La grille est jouable au doigt, sans défilement horizontal. La victoire affiche les trois appels à l'action. |
| Aperçu Open Graph | Débogueur de partage Facebook, WhatsApp | Le visuel du jour s'affiche, avec son titre et sa description. |
| « Installer l'application » | Android (Chrome), iPhone (Safari) | Le parcours d'installation existant se lance. Sur iPhone, c'est la PWA. |
| « Relever le Défi du jour officiel » en invité | Mobile | Le jeu affiche l'introduction du Défi, l'explication et l'entraînement non classé. Aucune tentative officielle n'est créée. |
| Calendrier de l'Avent | Mobile, le 1er décembre à 00h05 heure de Paris | La case 1 est ouverte et la case 2 est fermée. |
| Publieur en simulation | o2switch, 3 jours | Une entrée `dry-run` par jour, et aucun appel à Meta. |
| Premier post réel | Page Facebook | Un seul post à 08h00, avec un lien UTM et un aperçu correct. Un deuxième passage du cron ne publie rien. |
| Compteurs | o2switch, le lendemain | Le fichier `acquisition/AAAA-MM-JJ.json` contient les vues et les victoires, sans IP. |
