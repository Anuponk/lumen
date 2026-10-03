# LUMEN

LUMEN is a mobile-first logic puzzle/PWA built around **Guardians**, territories and a constellation-based campaign.

## Game rule
Place exactly one Guardian in every row, every column and every colored territory. Two Guardians may not touch, including diagonally.

A cell cycles: **empty -> exclusion -> Guardian -> empty**.

## Campaign
The current campaign contains 100 sequential quests grouped into 12 constellations and awards exactly 150 sky stars. Players cannot skip the current unsolved quest; solved quests can be replayed to improve performance badges.

## Architecture
The current app is intentionally compact and mostly lives in `index.html`: UI/CSS, puzzle catalogue, solver/proof engine, progression, persistence, analytics and embedded regression/performance tests. `manifest.webmanifest` and `sw.js` provide PWA support.

See:
- `AGENTS.md` — mandatory instructions for Codex/agents
- `docs/GAMEPLAY.md` — rules and UX invariants
- `docs/GRID_CATALOG.md` — grid catalogue, validation and generation requirements
- `docs/PROGRESSION.md` — campaign, rewards and badges
- `docs/DATA_AND_ARCHITECTURE.md` — persistence, Supabase and PWA architecture
- `docs/TESTING.md` — mandatory regression/performance checks
- `docs/RELEASE.md` — Git/Vercel workflow and release checklist

## Current version note
At the time this documentation was introduced (2026-10-03), `main` pointed to commit `1683d1a480bccd813677a23b683bfad6919e0129`; the UI constant was `LUMEN_APP_VERSION="beta-2026.10"`. Git tags/marketing versions and this UI constant must not be assumed to be equivalent.
