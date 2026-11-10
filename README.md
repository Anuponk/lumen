# LUMEN

LUMEN is a mobile-first logic puzzle/PWA built around **Guardians**, territories and a constellation-based campaign.

## Game rule
Place exactly one Guardian in every row, every column and every colored territory. Two Guardians may not touch, including diagonally.

A cell cycles: **empty -> exclusion -> Guardian -> empty**.

## Campaign
The historical launch campaign contained 100 sequential quests across 12 constellations and awarded 150 sky stars. The campaign has since expanded; current quest, constellation and star totals are catalogue-derived. See `docs/PROGRESSION.md` and the runtime content catalogue for the latest figures. Players cannot skip the current unsolved quest; solved quests can be replayed to improve performance badges.

## Architecture
LUMEN is a static application using native ES modules, with no framework or build step. `index.html` contains markup and loads `src/main.js`. Modules under `src/` separate game rules/proofs, campaign/catalogue, persistence, UI, analytics and browser tests. `manifest.webmanifest` and `sw.js` retain PWA support.

For local use, serve the repository over HTTP (for example `python -m http.server 8000`) and open `http://127.0.0.1:8000/`. ES modules require an HTTP server. Pinned Supabase and QR-code browser libraries are vendored in `src/vendor/`; Supabase remains a remote backend. Start with the [current architecture](docs/DATA_AND_ARCHITECTURE.md#current-architecture), then the [feature map](docs/architecture/feature-map.md) and [testing entry points](docs/TESTING.md#current-validation-entry-points). Historical refactoring results are dated evidence, not current test totals.

Development tooling: `npm ci --ignore-scripts`, `npm run format:check`, `npm run test:affected`; run `npm run test:full` before a tooling/refactoring PR. Formatting is rolled out through the [reviewed scope](scripts/format-scope.json); see the [convention and exclusions](docs/TESTING.md#reproducible-formatting-59).

See:
- `AGENTS.md` — mandatory instructions for Codex/agents
- `docs/GAMEPLAY.md` — rules and UX invariants
- `docs/GRID_CATALOG.md` — grid catalogue, validation and generation requirements
- `docs/PROGRESSION.md` — campaign, rewards and badges
- `docs/DATA_AND_ARCHITECTURE.md` — persistence, Supabase and PWA architecture
- `docs/TESTING.md` — mandatory regression/performance checks
- `docs/RELEASE.md` — Git/Vercel workflow and release checklist
- `docs/PRODUCT_MEMORY.md` — decision history, regressions and product reasoning
- `docs/UX_AND_VISUAL_DIRECTION.md` — visual identity and UX principles

## Knowledge base
This repository is the shared project memory for humans, ChatGPT/Codex and other coding agents. Durable decisions from conversations must be consolidated here. Start with `AGENTS.md`, then use the topic documents above; avoid creating parallel documentation that duplicates an existing source.

## Historical version note — 3 October 2026
At the time this documentation was introduced (2026-10-03), `main` pointed to commit `1683d1a480bccd813677a23b683bfad6919e0129`; the UI constant was `LUMEN_APP_VERSION="beta-2026.10"`. Git tags/marketing versions and this UI constant must not be assumed to be equivalent.



