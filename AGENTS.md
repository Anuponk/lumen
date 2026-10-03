# LUMEN — Agent instructions

This repository is the source of truth for LUMEN. Read this file and the documents under `docs/` before changing gameplay.

## Non-negotiable workflow
1. Understand the affected invariant before editing.
2. Preserve campaign progression and existing player data.
3. After **every gameplay change**, run the complete in-app test suite (`runHintTests()`) and the strict catalogue/grid audit described in `docs/GRID_CATALOG.md`.
4. Never weaken/delete a regression test merely to make a change pass.
5. A grid is shippable only if it is valid, has one audited solution, and remains solvable by the explainable proof engine.
6. Test mobile interactions when touching board input: tap cycle and drag-to-exclude.
7. Before release, verify victory detection, progression, replay, rewards and persistence.
8. Do not treat a Git push as a production release. Report the Git commit SHA and verify the deployment corresponding to the intended Production commit.

## Product invariants
- 100 sequential quests across 12 constellations; exactly 150 sky stars.
- The player cannot skip an unsolved quest. “Réinitialiser” resets the current board; only victory unlocks the next quest.
- Cell cycle: empty -> exclusion -> Guardian -> empty. The first tap must never be rejected as an invalid Guardian.
- Victory depends on the Guardian placement satisfying the puzzle, not on whether all remaining cells are manually excluded.
- Guardians: exactly one per row, column and territory; Guardians cannot touch, including diagonally.
- Completed quests are replayable to improve performance badges. Badges must describe a single attempt; no farming by combining achievements from different attempts.
- Learning: quests 1–5 force assistance; 6–10 make it optional; quest 11 introduces autonomous play. Quests 1–2 are scripted Guardian-first learning.
- Mobile drag across cells adds exclusions efficiently and must not trigger full-board renders during pointer movement.
- Guest progress works locally. Authenticated progress syncs to Supabase and local history is merged to cloud.
- Constellation progression is the canonical campaign representation.

## Before changing generated/catalogued grids
Read `docs/GRID_CATALOG.md` and `docs/TESTING.md`. Do not add a grid solely because it has a mathematical solution: it must pass uniqueness, structural, explainability and replay audits.

## Current implementation and navigation
The static application uses native ES modules without a build step. `index.html` is markup; `src/main.js` starts the UI controller. Domain ownership: `src/game/` (rules/proofs), `src/campaign/` (catalogue/progression), `src/persistence/` (local/cloud), `src/ui/` (rendering/input/tutorial/audio), `src/analytics/` (events), `src/testing/` (browser regression suite/diagnostics).

Read the task → modules → tests map in `docs/DATA_AND_ARCHITECTURE.md` and the executable commands in `docs/TESTING.md`. `window.runHintTests` and `window.lumenDiagnostics` remain available. The UI owns one live board and progress object; injected adapters must read current values, including during async callbacks. Do not add parallel state stores.

Browser automation exists under `scripts/`, alongside strict catalogue and differential tests. Do not claim browser validation unless it was actually executed. Refactoring must preserve existing behavior; pending badges/learning issues #30/#31 require separate work.

## Documentation maintenance
When a product rule, reward, progression rule, data contract, UX invariant, analytics contract or release procedure changes, update the matching document in the same PR/commit. Durable decisions made in chat must be transferred to the repository; chat history is not the project source of truth. Prefer enriching an existing document over creating a competing source. If code and docs disagree, investigate rather than silently choosing one.
