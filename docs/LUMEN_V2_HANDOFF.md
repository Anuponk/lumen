# LUMEN V2 · Fiche de reprise (Codex ⇄ Claude)

À lire en premier par l'agent qui reprend. Une seule main à la fois sur
`feat/1081-lumen-v2`. Mettre à jour cette fiche et `LUMEN_V2_DECISIONS.md` à chaque
étape, puis pousser : la branche doit toujours être cohérente.

## État au 28/11/2026

- **Dernier agent** : Claude (reprise après Codex, crédit épuisé à 09:04).
- **Branche** : `feat/1081-lumen-v2`, à jour avec `main` (`1.11.1+823`).
- **Fait** : dossier de conception, audit, matrice des 50 états et 14 parcours, QA isolée,
  prototype (Mon ciel allégé, états des constellations, % quêtes + badges, cloche de
  notifications, accès verrouillés, navigation entre aventures, écran de jeu complet),
  socle Lab #1087 (non appliqué en production).
- **Décisions** : voir [LUMEN_V2_DECISIONS.md](LUMEN_V2_DECISIONS.md) (D1–D13 et arbitrages ouverts).
- **En cours** : aucune modification à moitié faite.
- **Décisions du 28/11 après relais** : D14 flèches en haut, D15 % quêtes + badges à égalité,
  D16 bilan E49 différé, D17 découvertes une fois au premier usage.
- **Fait ensuite** : D18 aventure verrouillée → boutique, D19 boutique de production, D20 code
  couleur froid → chaud (proposé). Serveur Claude : port **10888** (le port 10887 peut être
  occupé par le serveur de la copie Codex `Screenshots/lumen-v2-1081`).
- **Prochaine action** : faire valider D20, puis prototyper D17 (bulles de découverte au premier usage, fermables,
  persistées par compte) et retirer E49 du périmètre ; puis faire valider D1, D2, D7, D9,
  D11 et D12 par essai du prototype.

## Lancer et vérifier

- Prototype : `node scripts/serve-lumen-v2-prototype.mjs` →
  http://127.0.0.1:10887/docs/lumen-v2-prototype/ (panneau « Prototype » : états E01–E50).
- Fichiers : `docs/lumen-v2-prototype/` (`prototype.js`, `play-preview.js`,
  `storyboard.js`, `prototype.css`, `index.html`). Le prototype importe les vrais modules
  `src/` (catalogue, formes, traductions, podium, semaine) : ne pas les modifier pour
  le prototype.
- Captures : `docs/validation/lumen-v2-1081/<revue>/` avec `README.md` et `browser.json`.

## Conventions

- Une revue = un dossier de captures (320, 360, 390, 1280 px) + README + résultat navigateur.
- Commits `design(#1081|#1083): …`, un sujet par commit, poussés aussitôt.
- Aucune migration appliquée, aucun drapeau activé, aucune modification de `src/` hors
  intégration validée (jalon 6) sans accord du propriétaire.
