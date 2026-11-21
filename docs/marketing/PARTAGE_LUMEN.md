# Partage et découverte de Lumen

Audit de la base `a2804ae8fd38e6f0becfc3b49cf54f0df3c99328` pour [#779](https://github.com/Anuponk/lumen/issues/779) et [#759](https://github.com/Anuponk/lumen/issues/759).

| Surface | Constat et comportement livré |
| --- | --- |
| Défi social [#18](https://github.com/Anuponk/lumen/issues/18) | La [PR #56](https://github.com/Anuponk/lumen/pull/56) a livré un lien opaque, un QR, le partage natif et la copie. La performance de référence reste masquée jusqu’à la fin de la tentative du destinataire. « Défier » reste assujetti à la première performance. |
| Invitation générale | « Inviter des amis » dans le menu du compte visible aussi aux invités. Partage natif immédiat ou dialogue avec « Copier le lien », confirmation et champ en lecture seule sélectionnable au clavier ou au toucher. |
| Victoire et record | La carte de résultat précédente n’avait plus de bouton. « Partager ma réussite » est désormais disponible depuis le résultat de victoire confirmé. Le texte et le PNG facultatif reprennent le nom de la constellation, la quête, le temps affiché et les nouveaux badges confirmés de cet essai. L’action ne publie aucun classement. Les victoires en attente, les défis et la consultation historique n’offrent pas cette action. |
| Destination publique | [Page de découverte](https://lumen.nopuna.fr/decouvrir.html) vérifiée par requête HTTPS directe, HTTP 200 à l’URL canonique. « Jouer » ouvre `/`, l’action d’installation ouvre `/?install=1`, tous deux vérifiés par HTTP 200. Le parcours d’installation réel reste à vérifier sur Android. |
| Aperçu social | Le HTML servi contient titre, description, canonique, Open Graph et `twitter:card`. Le JPEG public répond en 200, mesure 1 200 × 630 et est déclaré en absolu. La PR ajoute des champs Twitter explicites avec les mêmes valeurs que les balises Open Graph. Les robots reçoivent toutes les métadonnées dans le HTML statique. L’affichage réel dépend du cache et du client social. |

Les liens de partage général et de résultat ouvrent l’URL publique. Le partage natif d’un résultat peut y joindre le code de campagne public `player_share/referral`, l’invitation native `player_invite/referral` (#881 Lot 1), de la [mesure d’acquisition](../PRODUCT_ANALYTICS.md#mesure-dacquisition-708). La copie conserve l’URL canonique. Les liens opaques de défi restent réservés à « Défier ». Le partage n’ouvre aucun contact et le jeu garde sa grille en cours.

## Lot 1 de #881 — audit du 20/11/2026 (base `2ddea5a7`)

| Parcours | Déjà livré | Reste à tester | Lacune démontrée, corrigée dans la PR Lot 1 |
| --- | --- | --- | --- |
| Partager (victoire) | Action secondaire sur les scènes quête, constellation et aventure, sans scroll à 390/1440 px ; texte + PNG ; « Continuer »/suite reste l’action principale (#759, #872) | Partage natif iPhone, aperçu dans une messagerie réelle | En fin de constellation ou d’aventure, le texte et la carte annonçaient seulement « Quête N réussie ». Ils nomment désormais l’accomplissement célébré (« Constellation rallumée », « Aventure accomplie ») et la carte trace la vraie figure astronomique, éclairée selon la même règle que la scène de victoire. |
| Inviter (menu) | Partage natif/copie, destination validée Android + Web (#779 clôturée) | iPhone | Même code de campagne que Partager : impossible de distinguer les deux dans le tunnel. L’invitation native porte maintenant `player_invite/referral`. |
| Défier → nouveau joueur | Lien opaque, QR, copie, partage natif (#18, #883) | Recette Lot 0 (#883) | Un joueur jamais passé par le tutoriel arrivait sur une grille 7×7 sans règles. L’intro affiche un résumé et « Voir les règles » sans démarrer la tentative. « Rejouer l’apprentissage » dans l’aide remplaçait la grille défiée par la quête 1 et relançait le chrono (défi « réussi » en quelques secondes) : bloqué pendant un défi. |
| Découverte / aperçus | `decouvrir.html` + OG/Twitter complets, Lighthouse SEO 100 (#736 clôturée) ; les liens de défi `/?challenge=` héritent de l’OG générique de `index.html` | Aperçu réel WhatsApp/Messages/X | Aucune : aperçu statique volontairement générique, aucune donnée de défi exposée. |
| Mesure | `app_opened` + quête 1 par canal UTM (#875) ; collecte produit désactivée en public | Recette avec autorisation explicite (#708) | Les sorties d’un lien de défi n’étaient attribuées à aucun canal. Le jeu ouvert depuis un lien de défi porte `challenge_link` (nom de canal seul). |

Hors périmètre : amis, classement hebdomadaire, parrainage, publication de campagnes externes. L’activation de la collecte produit reste une décision propriétaire (#316/#170).

## Audit #759 du 21/11/2026 (base `efa708ed`, version `1.11.1+717`)

| Parcours | Point d’entrée | Existant | Testé (auto) | Défaut identifié | Correction |
| --- | --- | --- | --- | --- | --- |
| Partager une victoire | Scène de victoire confirmée → « Partager ma réussite » | Texte + carte PNG (constellation réelle, temps, badges), natif `player_share`, copie canonique | `lumen-share-tests`, `late-game`, `quest-view`, `victory-layout` | Texte, titre et carte **en français même en anglais** (#754) | ✅ Copie `share.*` FR/EN, carte traduite (`shareCardCopy`) |
| Défier depuis une quête | Victoire → « Défier » (#18, première performance) | Lien opaque, QR, natif, copie ; référence masquée jusqu’à la fin | `victory-challenge-browser`, `challenge-recipient-browser` | Texte « Je te défie sur LUMEN… » et toast **en français seulement** | ✅ `share.challenge*` FR/EN |
| Copier un lien | Fenêtre de partage, « Copier le lien » de « Mes défis » (#896) | Presse-papiers puis sélection manuelle | `credits-browser`, `duel-browser` | Repli de #896 : en partage **natif**, la fenêtre remplaçait le lien de défi par la page de découverte (mauvaise destination) | ✅ Le natif ne remplace que l’URL de découverte générique |
| Partage natif Android/iPhone | Bouton « Partager » si `navigator.share` | Fichier PNG joint si `canShare`, annulation silencieuse | `lumen-share-tests` (contrats) | — | Recette appareil (T1, T3) |
| Inviter un nouvel utilisateur | Espace social → « Inviter des amis » (#898) | Natif `player_invite`, sinon fenêtre + copie | `credits-browser`, `social-hub-browser` | Texte **en français seulement** | ✅ `share.inviteTitle/inviteText` FR/EN |
| Résultat du Défi du jour | Résultat #882 → « Partager ma performance » | Texte localisé (#909), ses seuls chiffres, natif `player_share` | `daily-challenge-browser`, `daily-view-tests` | — | — (recette #882) |
| Bilan hebdomadaire | « Ta semaine dans les étoiles » → « Partager ma semaine » | Texte localisé, aucune donnée d’autrui | `daily-week-tests`, `daily-challenge-browser` | — | — |
| Ouverture des liens | `decouvrir.html` / `discover.html`, `/?challenge=` | OG/Twitter FR et EN, hreflang, image 1200×630 (HTTP 200) ; défi isolé, one-shot (#18/#888) | `landing-seo-tests`, `challenge-recipient-browser` | — | Aperçu réel en messagerie à tester |
| Confidentialité | Tous | Pseudonymes et chiffres du joueur seulement ; aucun email, UUID ni jeton ; solution jamais montrée | `lumen-share-tests` (champs privés ignorés), `duel-view-tests` | — | — |

**Liens de découverte générale (#933, 21/11/2026)** : la page suit la langue d'affichage de Lumen, c'est-à-dire le choix manuel du joueur ou, à défaut, la résolution automatique de l'application (jamais la langue brute du navigateur).

| Langue de Lumen | Destination |
|---|---|
| Anglais (`en`, `en-GB`…) | `https://lumen.nopuna.fr/discover.html` |
| Français et toute autre langue ou langue indéterminée | `https://lumen.nopuna.fr/decouvrir.html` (le français est la langue par défaut de l'application) |

- Une seule fonction, `discoveryUrlFor(locale)` (`src/analytics/acquisition.js`), sert à l'invitation générale, au partage de réussite et aux partages du Défi du jour.
- Campagnes inchangées : `utm_source=player_invite` (Inviter) et `utm_source=player_share` (Partager), toujours avec `utm_medium=referral`. Elles ne figurent que sur le **partage natif** ; `campaignUrl` remplace toute requête existante, donc jamais de doublon UTM.
- « Copier le lien » garde l'URL canonique **de la même langue**, sans UTM.
- Les liens de défi `/?challenge=…` ne sont jamais remplacés par une page de découverte (opaques, one-shot, référence non révélée).
- Aperçus : `decouvrir.html` porte l'OG/Twitter français (`og.jpg`, `fr_FR`), `discover.html` l'OG/Twitter anglais (`og-en.jpg`, `en_US`).

## Recette après publication

| Scénario | Appareil | Attendu | État |
| --- | --- | --- | --- |
| T1 — Invitation et annulation | Android Chrome, PWA puis TWA | Ouvrir le menu, inviter, annuler. La feuille système se ferme et la grille courante reste jouable. Refaire et choisir une application. | À tester sur appareil |
| T2 — Copie et destination | Chromium desktop, clavier | Copier le lien, ouvrir la page dans un autre profil, démarrer le jeu. Avec Clipboard refusé, copier depuis le texte sélectionné. Contrôler l’aperçu dans un message de test privé. | À tester sur la version publiée |
| T3 — Résultat et défi | Android et desktop | Résoudre une quête, partager la victoire, vérifier le temps et les badges. Tester la copie texte et ouvrir le lien/QR produit par « Défier » avec un second profil. La référence du défi reste cachée. | À tester sur la version publiée |
| T5 — Fin de constellation et d’aventure | Android puis desktop | Terminer la dernière quête d’une constellation puis d’une aventure, « Partager ma réussite » : titre « Constellation rallumée » / « Aventure accomplie », carte avec la figure de la constellation, aucune donnée personnelle. « Constellation suivante » / « Admirer mon ciel » reste l’action principale. | À tester sur appareil |
| T6 — Nouveau joueur par défi | Second appareil en navigation privée | Ouvrir un lien de défi sans jamais avoir joué : résumé des règles, « Voir les règles », retour à l’intro, puis « Relever le défi ». Dans l’aide pendant la partie, aucun « Rejouer l’apprentissage ». | À tester sur appareil |
| T4 — Hors connexion et reprise | PWA Android déjà ouverte et téléchargée | Couper le réseau, ouvrir l’invitation et copier le lien. La partie en cours reste accessible. Vérifier qu’une victoire en attente ne peut pas être partagée avant confirmation. | À tester sur appareil |
