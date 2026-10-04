# LUMEN

LUMEN is a mobile-first logic puzzle/PWA built around **Guardians**, territories and a constellation-based campaign.

## Game rule
Place exactly one Guardian in every row, every column and every colored territory. Two Guardians may not touch, including diagonally.

A cell cycles: **empty -> exclusion -> Guardian -> empty**.

## Campaign
The current campaign contains 100 sequential quests grouped into 12 constellations and awards exactly 150 sky stars. Players cannot skip the current unsolved quest; solved quests can be replayed to improve performance badges.

## Architecture
LUMEN is a static application using native ES modules, with no framework or build step. `index.html` contains markup and loads `src/main.js`. Modules under `src/` separate game rules/proofs, campaign/catalogue, persistence, UI, analytics and browser tests. `manifest.webmanifest` and `sw.js` retain PWA support.

For local use, serve the repository over HTTP (for example `python -m http.server 8000`) and open `http://127.0.0.1:8000/`. ES modules require an HTTP server. Supabase and fonts retain their existing external CDN loading. See the task-to-module map in `docs/DATA_AND_ARCHITECTURE.md` and reproducible checks in `docs/TESTING.md`.

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

## Current version note
At the time this documentation was introduced (2026-10-03), `main` pointed to commit `1683d1a480bccd813677a23b683bfad6919e0129`; the UI constant was `LUMEN_APP_VERSION="beta-2026.10"`. Git tags/marketing versions and this UI constant must not be assumed to be equivalent.


