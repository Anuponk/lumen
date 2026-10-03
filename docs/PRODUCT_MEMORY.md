# Product memory and decision history

This document preserves the reasoning behind LUMEN decisions. It is historical context, not a license to restore obsolete mechanics. Current specifications in GAMEPLAY/PROGRESSION take precedence.

## Identity and vocabulary
Canonical vocabulary:
- **Quête** = playable puzzle;
- **Gardien** = placed piece;
- **Étoile** = campaign/progression reward;
- **Constellation** = campaign grouping.

LUMEN deliberately moved away from a generic Queens clone identity. The desired visual language is a **dark energy/star map**, luminous orbs/Guardians, organic/light territory borders and celestial progression. Avoid drifting back toward a pastel Queens-like board.

Earlier progression vocabulary such as Étincelle, Halo, Rayonnement, Prisme and Nova was removed. Do not reintroduce it accidentally.

## Why the campaign became sequential
Early iterations exposed confusing counters and sector thresholds and allowed too much ambiguity about what the player should do next. The product direction became: one clear current quest, solve it to advance, replay solved quests for mastery. Therefore “Nouvelle grille” became **Réinitialiser**, and an unsolved player cannot skip forward.

## Why completion detection is an invariant
A serious regression occurred where a visually solved grid was not recognized as complete. Completion must be judged from the legal Guardian arrangement, independently of leftover exclusion marks. Temporary complete-but-invalid states are corrective states, not mistakes or victories.

## Why guidance has no lives
The chosen learning model is immediate pedagogical feedback, not punishment/lives. Quests 1–5 are guided, 6–10 accompanied/optional, and autonomy begins at 11. The correction option remains available. Notes/exclusions themselves must not trigger “wrong Guardian” punishment: with the current cell cycle, first tap is exclusion and Guardian is the second state.

Conflict guidance is rule-based (row, column, territory, diagonal/touch/dead-end) with visible sources/explanation.

## Why grids are curated
The original idea of having ~100 grids with increasing difficulty evolved into a curated pre-generated campaign. Runtime randomness would make difficulty, uniqueness, hints and regressions harder to control. Generation, when used, should therefore be an offline production tool followed by strict audits.

## Why explainability matters
LUMEN should teach logical deductions, not merely know the hidden answer. Hint stages deliberately progress from attention -> rule explanation -> forced action. A brute-force solution may be useful to validate uniqueness but must not masquerade as a pedagogical proof.

## Why replay exists
Solved quests can be replayed so players can improve their performance badges. A badge describes one attempt; results from separate attempts must not be combined into an artificial “perfect” run.

## Product/distribution context
LUMEN is intended to work first as a friction-light web/PWA game. A Play Store release is not a prerequisite for validating usage. The install prompt exists because a raw shared link is easy to lose after closing the browser. Installation should be suggested only after engagement, not immediately.

Sharing is intended as an acquisition loop: completion sharing includes quest/constellation context and a traceable referral link.

## Naming
“LUMEN” remains the working/product name in the repository. Prior naming exploration found both LUMEN and generic “Star Puzzle” relatively crowded, while more invented alternatives were judged harder to remember. Naming is therefore an unresolved product/brand question, not a reason for code-level renaming without an explicit decision.

## Growth/monetization
Prior discussions explored free-to-play reach, optional paid value, organic sharing/PWA acquisition, and reaching an initial ~1,000 users. These were product explorations, not committed pricing or revenue requirements. Do not hard-code monetization assumptions from those conversations without a new explicit product decision.

## Architecture/scaling principle
The gameplay is browser-local/static where possible; Vercel serves the app/CDN while Supabase handles auth, progression, analytics and notification-related backend functions. This intentionally keeps ordinary gameplay cheap to serve and supports anonymous play.

## Historical consolidation
A major consolidation removed obsolete EMBER/Fire & Water concepts and old progression terminology. When old code/comments/migrations conflict with the constellation campaign, prefer the current constellation model and investigate whether the old artifact should be removed.

## Agent rule
When changing a behavior that exists because of a past regression, add/preserve a regression test that states the reason. Do not “simplify” away unusual-looking logic without checking this history.


## Knowledge-base policy
The repository documentation is the shared memory for humans and coding agents. Chat history is useful for discovery, but it is not authoritative project documentation.

When a conversation produces a durable decision, invariant, regression lesson, data contract, operational procedure or UX rule, update the relevant repository document. Prefer enriching an existing document over creating overlapping notes.

Documentation responsibilities:
- `AGENTS.md` contains short non-negotiable instructions that an agent must read before editing;
- specification documents describe current intended behavior;
- this file records why important product choices exist and which regressions they protect against;
- obsolete ideas may remain here only when clearly labelled historical, so they cannot be mistaken for current requirements.

When code, tests and documentation disagree, do not silently rewrite history. Determine which behavior is intended, fix the inconsistent artifacts together, and preserve a regression test when the discrepancy came from a bug.

## Recent regression lessons
Several recent iterations reinforced the following rules:
- completion detection must be independent of exclusion marks;
- progression counters must derive from the canonical constellation/campaign state rather than competing legacy counters;
- a reset must never behave like a random/new-grid selector;
- mobile bulk marking needs drag-to-exclude because repeated individual taps create avoidable friction;
- a first tap is an exclusion, so guidance must not interpret it as an illegal Guardian placement;
- deployment state and Git state are different facts: branch merges, application version strings and the Vercel Production commit must be checked separately.

These are not cosmetic preferences; they are regression guards and should be reflected in tests when the affected code changes.

## Interactive onboarding decisions and audit — 2026-10-03

The player requested five visible territories, a forced first Guardian in a singleton territory at the centre, explanations tied to the observed zone, separate row/column/neighbour animations at one new mark per 500 ms, free-tap advancement, and backwards navigation. These decisions supersede the former blanket singleton ban only for the two explicitly scripted 5x5 introductions; see GAMEPLAY and GRID_CATALOG for the exact scope.

Repeating/recreating previously marked cells made the lesson appear to erase or re-mark earlier reasoning. Existing marks now retain their DOM nodes. Empty consequence groups explain that the zone is already marked. Previous restores a snapshot of the explanation and board, cancels an active animation, and reviews visited steps without another marking animation. Teaching history is transient; it does not change persisted solved quests or unlock rules.

The documentation review found that previous browser checks had not included the mandatory full embedded suite or strict all-grid audit. The suite also initialized its result array after calling the first tests, making the entire suite abort. This has been corrected. Tests now handle the async click handler and delayed victory/reveal without deleting their assertions; the singleton regression has two exact documented exceptions and still rejects every other singleton.

The strict audit verifies 134 catalogue entries, 100 distinct campaign references, 12 constellations and 150 sky stars. All stored puzzles are mathematically valid, connected and unique. The two new introductions replay with structured proofs. Existing explainability failures remain in `7/1, 7/2, 7/5, 7/6, 7/11, 7/13, 7/14, 7/15, 7/17, 7/18, 7/19` and `8/0, 8/2, 8/3, 8/4, 8/5, 8/6, 8/7, 8/8, 8/9, 8/10, 8/11` (size/catalogue index, zero-based). Comparison with commit `1683d1a` confirms the 6x6/7x7/8x8 catalogues and proof engine were not changed by the onboarding work. These failures must be fixed before claiming a passing release gate.

### Resolution of the catalogue failures — 2026-10-03

At the player's request, all 22 entries listed above were replaced with newly generated, unique, connected grids that the existing proof engine can fully explain. Their exact catalogue indices were retained, preserving quest identifiers, saved progression, rewards and campaign order. The two scripted introductions and all previously passing grids were retained. No brute-force fallback was added to the hint engine.

The deterministic offline generator and accepted JSON are retained under `scripts/`; GRID_CATALOG describes the acceptance rules and commands. The strict audit now passes all 134 entries, and the actual browser suite passes all 66 cases on each of the four board sizes. The earlier failing report is retained as historical evidence; the new replacement reports record the passing local validation. Production deployment remains a separate operation.
