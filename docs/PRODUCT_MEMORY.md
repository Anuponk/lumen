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
