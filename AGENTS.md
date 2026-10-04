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
- Campaign size and sky stars derive from the content catalogue, never fixed limits. Currently: 134 sequential quests across 24 constellations / 298 stars, including the preserved historical 100 quests / 12 constellations / 150 stars. Every constellation's quest rewards must sum exactly to its star count.
- The player cannot skip an unsolved quest. “Réinitialiser” resets the current board; only victory unlocks the next quest.
- Cell cycle: empty -> exclusion -> Guardian -> empty. The first tap must never be rejected as an invalid Guardian.
- Victory depends on the Guardian placement satisfying the puzzle, not on whether all remaining cells are manually excluded.
- Guardians: exactly one per row, column and territory; Guardians cannot touch, including diagonally.
- Completed quests are replayable to improve performance badges. Badges must describe a single attempt; no farming by combining achievements from different attempts. From quest 6, Sans erreur requires no assistance and no confirmed wrong Guardian; Maîtrise requires Autonomie + Rapidité + Sans erreur on the same badge run. A campaign/replay reset starts a fresh badge run without changing the technical/social attempt identity.
- Learning onboarding is a protected **SEE -> UNDERSTAND -> ACT** sequence: quest 1 must show and number the territories, explain the goal and all four Guardian constraints, and only then allow the first board interaction. Do not collapse this into immediate action. Territory numbers are teaching-only.\n- Learning: quests 1–5 force assistance; 6–10 make it optional; quest 11 introduces autonomous play. Quest 1 constrains real player actions with progressively lighter guidance through all five Guardians; quest 2 guides its first Guardian and requires practicing the real drag gesture before free play with contextual advice.
- Mobile drag across cells adds exclusions efficiently and must not trigger full-board renders during pointer movement.
- Guest progress works locally. Authenticated progress syncs to Supabase and local history is merged to cloud.
- Constellation progression is the canonical campaign representation.

## Before changing generated/catalogued grids
Read `docs/GRID_CATALOG.md` and `docs/TESTING.md`. Do not add a grid solely because it has a mathematical solution: it must pass uniqueness, structural, explainability and replay audits.

## Evolving catalogue: mandatory design rule
Treat catalogue growth as normal throughout development, including features that do not edit content directly. Follow the [evolving catalogue contract](docs/DATA_AND_ARCHITECTURE.md#evolving-catalogue-contract).
- Derive campaign/pack boundaries, constellation ranges, star totals, completion and navigation from their owning content model. Never introduce a fixed total or last index in code, UI, analytics, persistence, fallback paths or CI.
- Distinguish all audited catalogue grids from quests scheduled in a campaign and from content accessible to a player. These counts are not interchangeable.
- Preserve existing quest IDs, grid assignments, saved history, badges and active attempts. Append content; any reordering/removal requires an explicit compatible migration. A previously complete campaign must resume at newly appended content without replaying its old finale.
- Check impacts on loading, local/cloud restoration, rewards, replay, final celebration, Mon ciel, sharing, onboarding, access and backend contracts before delivery. Record applicable impacts in the PR.
- Test hypothetical growth from N to N+k and recovery of an old completed/capped save. Assert contiguous coverage, unique references and exact rewards per constellation against data, rather than replacing old fixed totals with new ones.
- Fixed quest numbers are permitted for explicitly documented teaching milestones and frozen historical regression fixtures; they must not become limits on current content. Run the unified quality gate for content/progression changes.

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


- Assistance unlocks are teaching milestones. At quest 6 (index 5), introduce Marquage auto as an optional comfort playstyle and explain badge impact before normal play. At quest 11 (index 10), when Contrôle guidé becomes an autonomy choice, explain that it can be re-enabled; merely being enabled does not invalidate badges, but an actual guided intervention marks assistance. Assistance removes Autonomie and therefore Maîtrise, while Rapidité remains possible. Do not present assisted play as inferior.


- Badge onboarding must follow actual `performanceEligibility`: quests 1–2 teach no badge; quest 3 introduces Rapidité (the only eligible badge on quests 3–5); quest 6 introduces Autonomie, Sans erreur and Maîtrise when the full four-badge system becomes eligible. Sans erreur means no assistance and no confirmed wrong Guardian; Maîtrise means Autonomie + Rapidité + Sans erreur on the same badge run. Explain badge conditions at those exact milestones, not earlier. Keep this synchronized with performance.js if eligibility changes.


## Mandatory onboarding impact check
Onboarding is a dependent product surface, not a one-off tutorial. **Any change to a rule, unlock level, badge eligibility, assistance, interaction gesture, progression concept, navigation destination, or player-facing terminology MUST include an onboarding impact check before delivery.**

For every such change:
1. Identify whether the concept is introduced, demonstrated, unlocked, or explained anywhere in learning quests, success dialogs, Mon ciel tours, contextual tips, or assistance/badge tutorials.
2. If the underlying behavior or availability changes, update the corresponding onboarding in the same change/PR.
3. Prefer deriving tutorial timing from the same source of truth as gameplay. Do not duplicate quest numbers when an eligibility/unlock function can answer the question.
4. Add/update a regression test that compares onboarding timing/content with the gameplay source of truth.
5. In the PR description, include an **Onboarding impact** line: list the adapted learning steps, or explicitly state why no onboarding change is required.

Example: if Rapidité moves from quest 3 to quest 8, its introduction must move to the first quest where `performanceEligibility(...).speed` becomes true. A PR that changes eligibility without adapting that teaching milestone is incomplete.

This check is mandatory even when the requested change does not explicitly mention the tutorial.


## 2026-10-04 — Sans erreur and Mastery contract
Issue #82 adds **Sans erreur** as a performance badge from quest 6. A wrong Guardian is only committed as an error when the player continues with another logical board mutation before removing/undoing that Guardian. The pending state is silent: never reveal correctness during play. Any effective assistance (Hint, Verify, Auto marking, guided intervention) makes Sans erreur ineligible for that badge run.

**Mastery = Autonomy + Speed + Sans erreur on the same badge run.** Existing persisted Mastery is grandfathered and must never be revoked retroactively.

A campaign/replay **Reset** starts a fresh badge run: timer, assistance and error state restart, but the global `attemptId` is preserved. Social challenges remain one-shot: reset may clear the board, but must not reset elapsed time, assistance or committed-error state. This distinction protects challenge anti-retry semantics.
