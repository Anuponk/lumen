# Preuves locales LUMEN V2 · 28 novembre 2026

## Avant / après

| Fenêtre en px | Mon ciel V1, SHA de production | Prototype V2 |
| --- | --- | --- |
| 320 × 568 | [Capture V1](v1-320.png) | [Capture V2](v2-320.png) |
| 360 × 640 | [Capture V1](v1-360.png) | [Capture V2](v2-360.png) |
| 390 × 844 | [Capture V1](v1-390.png) | [Capture V2](v2-390.png) |
| 1280 × 800 | [Capture V1](v1-1280.png) | [Capture V2](v2-1280.png) |

[Détail de Cassiopée, 390 × 844](v2-detail-390.png).

Edge en mode headless sur Windows, sorties réseau externes bloquées. La V1
exécute le SHA Web `73e75850a15ab16dfb76dfa88e9a7223808e052b` avec le
mode QA. Le prototype importe les données du catalogue du clone et ajoute une
progression et un classement simulés. Les captures illustrent la composition.
Les progressions affichées entre V1 et V2 diffèrent.

[V1](v1.json) et [prototype](v2.json) contiennent trois mesures par taille.
Sur la fenêtre 390 × 844, la médiane de `domContentLoadedEventEnd` vaut
3 285 ms pour le paquet V1 et 326 ms pour le prototype. L’échantillon est petit
et les cycles de chargement n’ont pas le même périmètre. Les deux applications
à règles et données identiques seront mesurées au jalon 5.

## Contrôles exécutés

- Prototype, Edge : 50 destinations ouvertes, 10 cartes initiales et 8 dans
  l’aventure finale, absence de débordement des cartes de l’aperçu à 320,
  360, 390 et 1280 px, profil de 10 lignes à quatre badges, filtre donnant
  six lignes, barre masquée en grille, podium et quatre rangs distincts.
  Aucune ressource externe observée. Le contrôle vérifie l’ouverture de chaque
  état de conception. La validation des interactions métier reste à faire.
- Application, [Mon espace](my-space.json) : six cas invité/connecté à 360,
  390 et 1440 px, passage en anglais, accès LUMEN Lab pour un compte de fixture
  et disparition après refus serveur.
- Node : LUMEN Lab (5), badges (15), quotas Premium (22), service worker (21),
  espagnol (5), Mon ciel, retour, détail depuis victoire, classements, Social,
  Ma semaine, mise à jour et échantillonnage de performance. Audit de
  traduction sur 2 180 clés FR/EN, documentation, format et diff vérifiés.
- PostgreSQL éphémère : la [fixture SQL #1087](../../../scripts/fixtures/ux-lab-1087.sql)
  valide V1 par défaut, accès propriétaire, exclusion invité et témoin,
  expiration et désactivation globale.

## Recette à compléter

Mesures du Défi sur l’appareil du propriétaire, Safari iPhone, PWA installée,
Android réel, achats Stripe/Play, notifications et synchronisation entre deux
appareils restent à couvrir. Le retour effectif V2 → V1 et l’activation
exclusivement propriétaire requièrent le rendu V2 du jalon 4 puis la recette
des jalons 5 et 6. Voir la [matrice](../../LUMEN_V2_MATRIX.md).
