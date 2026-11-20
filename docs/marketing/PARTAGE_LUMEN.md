# Partage et découverte de Lumen

Audit de la base `a2804ae8fd38e6f0becfc3b49cf54f0df3c99328` pour [#779](https://github.com/Anuponk/lumen/issues/779) et [#759](https://github.com/Anuponk/lumen/issues/759).

| Surface | Constat et comportement livré |
| --- | --- |
| Défi social [#18](https://github.com/Anuponk/lumen/issues/18) | La [PR #56](https://github.com/Anuponk/lumen/pull/56) a livré un lien opaque, un QR, le partage natif et la copie. La performance de référence reste masquée jusqu’à la fin de la tentative du destinataire. « Défier » reste assujetti à la première performance. |
| Invitation générale | « Inviter des amis » dans le menu du compte visible aussi aux invités. Partage natif immédiat ou dialogue avec « Copier le lien », confirmation et champ en lecture seule sélectionnable au clavier ou au toucher. |
| Victoire et record | La carte de résultat précédente n’avait plus de bouton. « Partager ma réussite » est désormais disponible depuis le résultat de victoire confirmé. Le texte et le PNG facultatif reprennent le nom de la constellation, la quête, le temps affiché et les nouveaux badges confirmés de cet essai. L’action ne publie aucun classement. Les victoires en attente, les défis et la consultation historique n’offrent pas cette action. |
| Destination publique | [Page de découverte](https://lumen.nopuna.fr/decouvrir.html) vérifiée par requête HTTPS directe, HTTP 200 à l’URL canonique. « Jouer » ouvre `/`, l’action d’installation ouvre `/?install=1`, tous deux vérifiés par HTTP 200. Le parcours d’installation réel reste à vérifier sur Android. |
| Aperçu social | Le HTML servi contient titre, description, canonique, Open Graph et `twitter:card`. Le JPEG public répond en 200, mesure 1 200 × 630 et est déclaré en absolu. La PR ajoute des champs Twitter explicites avec les mêmes valeurs que les balises Open Graph. Les robots reçoivent toutes les métadonnées dans le HTML statique. L’affichage réel dépend du cache et du client social. |

Les liens de partage général et de résultat contiennent uniquement l’URL publique. Les liens opaques de défi restent réservés à « Défier ». Le partage n’ouvre aucun contact et le jeu garde sa grille en cours.

## Recette après publication

| Scénario | Appareil | Attendu | État |
| --- | --- | --- | --- |
| T1 — Invitation et annulation | Android Chrome, PWA puis TWA | Ouvrir le menu, inviter, annuler. La feuille système se ferme et la grille courante reste jouable. Refaire et choisir une application. | À tester sur appareil |
| T2 — Copie et destination | Chromium desktop, clavier | Copier le lien, ouvrir la page dans un autre profil, démarrer le jeu. Avec Clipboard refusé, copier depuis le texte sélectionné. Contrôler l’aperçu dans un message de test privé. | À tester sur la version publiée |
| T3 — Résultat et défi | Android et desktop | Résoudre une quête, partager la victoire, vérifier le temps et les badges. Tester la copie texte et ouvrir le lien/QR produit par « Défier » avec un second profil. La référence du défi reste cachée. | À tester sur la version publiée |
| T4 — Hors connexion et reprise | PWA Android déjà ouverte et téléchargée | Couper le réseau, ouvrir l’invitation et copier le lien. La partie en cours reste accessible. Vérifier qu’une victoire en attente ne peut pas être partagée avant confirmation. | À tester sur appareil |
