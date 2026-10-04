# LUMEN — Agent instructions

This repository is the source of truth for LUMEN. Read this file and the documents under `docs/` before changing gameplay.

## Non-negotiable workflow
1. Understand the affected invariant before editing.
2. Preserve campaign progression and existing player data.
3. Every code/gameplay/feature change must update the test contract in the same change: preserve or adapt existing non-regression tests when behavior intentionally changes, and add dedicated tests for the new behavior and its edge cases.
4. After **every gameplay change**, run the complete in-app test suite (`runHintTests()`) and the strict catalogue/grid audit described in `docs/GRID_CATALOG.md`.
5. Never weaken/delete a regression test merely to make a change pass. A changed assertion must be justified by an intentional product-contract change and replaced by coverage of the new contract.
6. A grid is shippable only if it is valid, has one audited solution, and remains solvable by the explainable proof engine.
7. Test mobile interactions when touching board input: tap cycle and drag-to-exclude.
8. Before release, verify victory detection, progression, replay, rewards and persistence.
9. Do not treat a Git push as a production release. Report the Git commit SHA and verify the deployment corresponding to the intended Production commit.

## Product invariants
- 100 sequential quests across 12 constellations; exactly 150 sky stars.
- The player cannot skip an unsolved quest. “Réinitialiser” resets the current board; only victory unlocks the next quest.
- Cell cycle: empty -> exclusion -> Guardian -> empty. The first tap must never be rejected as an invalid Guardian.
- Victory depends on the Guardian placement satisfying the puzzle, not on whether all remaining cells are manually excluded.
- Guardians: exactly one per row, column and territory; Guardians cannot touch, including diagonally.
- Completed quests are replayable to improve performance badges. Badges must describe a single attempt; no farming by combining achievements from different attempts.
- Learning: quests 1–5 force assistance; 6–10 make it optional; quest 11 introduces autonomous play. Quest 1 constrains real player actions with progressively lighter guidance through all five Guardians; quest 2 guides its first Guardian and requires practicing the real drag gesture before free play with contextual advice.
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

## Social challenge invariants
- A social challenge may be created only from the sender's **first play** of that quest. Never allow replay performance to become a challenge reference.
- Social “performance remarquable” means exactly **Mastery on that first play**. It changes CTA emphasis, not challenge eligibility.
- The recipient has one challenge attempt, but may correct mistakes until solve or explicit abandon. Reload/background must restore the same attempt.
- Do not claim the recipient is seeing the grid for the first time; prior campaign exposure is allowed and recorded only for analytics.
- Hide the sender's reference performance until the recipient's attempt is terminal.
- Challenge play must never mutate campaign progression, stars, badges, daily qualification or unlocks.
- Guests remain supported but require a display name. Never put PII or performance data in challenge URLs.

- Learning handoff after quest 2 is protected: the success CTA must explicitly say **Découvrir Mon ciel**; tapping the success backdrop must not silently navigate. The first visit to Mon ciel is a sequential tour of the real UI zones (constellations, quests, performance badges, constellation/stars) before quest 3. Preserve this when changing success or map navigation.
