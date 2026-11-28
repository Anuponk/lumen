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
- **Prochaine action** : recueillir les arbitrages ouverts du jalon 4 (navigation entre
  aventures, bilan E49, découvertes E50, formules de %), puis itérer sur le prototype.

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
