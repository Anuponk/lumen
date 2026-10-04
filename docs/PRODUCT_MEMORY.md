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

## Modular migration #20–#26 — 2026-10-03

The user authorized a progressive refactor on `codex/modular-refactor`, starting at main `dcd9f3c`, with one validated commit per extraction. Native ES modules preserve the static hosting model. The engine, catalogue/campaign, local/cloud persistence, UI/styles/tutorial/audio, analytics and browser test infrastructure now have explicit owners under `src/`.

The key constraint is functional equivalence. Live accessors preserve board/progress/auth state across resets, replay and asynchronous callbacks; snapshots must not replace the canonical mutable state. Full browser suites, strict catalogue audits and differential comparisons against the original main protect this decision. No gameplay or badge-policy correction was bundled into the migration. Pending #30/#31 remain separate even where current implementation and desired future semantics differ.

The HTML feedback inline handler/global bridge was redundant with its existing bound listener and removed. Browser test entry points remain available. PWA caching/navigation policy and existing CDN/backend contracts are unchanged. This is local branch validation, not a production deployment record.

## PR #38 review corrections — 2026-10-03

Browser validation exposed two integration problems in the UX cleanup: scripted free-tap handling intercepted clicks in the new rules modal (advancing the lesson and blocking backdrop dismissal), and the success CTA fell below a 360x640 viewport. The modal is now excluded from the teaching interceptor, and the success card scrolls within a capped height. No puzzle, campaign, persistence, badge or learning policy changed.

Four remaining hint instructions still said “éteindre”; these now say “écarter”, with no proof or deduction change. The original narrative test read the retired permanent rules paragraph; it now asserts Guardian vocabulary in the rules modal. The structural freeze test now explicitly permits the approved CTA/scroll CSS and requires all original test labels plus the three new UX cases. A browser regression script covers twelve modal scenarios and vocabulary/CTA behavior on three screen sizes. PR #38 remains unmerged during this validation.

## Why social challenges use first plays — 2026-10-04

The initial #18 concept was a strict one-shot recipient challenge against any shared performance. This was rejected as unfair: the sender may have replayed a fixed grid many times and memorized its solution before sharing a very fast run. Giving the recipient the same number of retries was also rejected because repeated exposure rapidly turns a logic puzzle into memory.

The chosen philosophy is therefore asymmetric but honest: **the sender may create a challenge only from their first play; the recipient gets one challenge attempt**. LUMEN can guarantee the sender condition. It cannot guarantee the recipient has never seen that quest, because the recipient may be further ahead in campaign. V1 accepts that limitation rather than preventing friends at different progression levels from challenging each other.

A challenge attempt is not sudden-death. Wrong choices may be corrected; it ends on solve or explicit abandon. The sender's performance stays secret until then.

“Performance remarquable” is not a vague percentile or generic good run. For social challenges it means exactly **Mastery on the first play**. That condition strengthens the challenge CTA because it combines speed and autonomy before the sender could learn the solution. Replayed Mastery can still matter to personal progression but is deliberately excluded from challenge creation.

Sharing without interaction was also rejected as low-value. In the current product philosophy, social sharing exists to create a challenge loop. Results return to the sender in “Mes défis” and through contextual push notifications; guests remain allowed but must choose a visible first name/nickname.

## 2026-10-04 — Issue #57: learning through real gameplay

The user authorized implementation and requested more guidance through the end of quest 1. The audited existing first grid was retained after proving the exact five forced territory deductions. Replace explanatory Next/Previous/automatic animations with user-made actions on the ordinary board. Guide the singleton, row, column and diagonals separately, explain the second deduction, then introduce the ordinary drag gesture. Keep lighter territory-focused guidance for the remaining Guardians. The user additionally requested partial guidance in quest 2 to learn click-and-drag. Guide its first singleton Guardian, then require a real mouse/touch drag across the other cells in that row before releasing free play with contextual tips and actual Assist/Verify/Hint feedback. Its ordinary success leads through Mon ciel to quest 3; badge eligibility remains unchanged.

Lesson state is derived from the canonical persisted board, preserving reset/pause/reload semantics. Normal replay and social challenges bypass the lesson. Add pure lesson tests and real browser interaction coverage to CI; retain/adapt the original regression contract and run the complete strict grid audit. Shared short-screen sizing keeps both ordinary controls and advice visible.


## 2026-10-04 — Onboarding regression guard: SEE -> UNDERSTAND -> ACT

A later interactive-onboarding refactor made quest 1 start too quickly: the player was asked to act before having time to understand the colored territories and the complete rule model. This unintentionally removed an earlier pedagogical layer.

The durable product philosophy is therefore **SEE -> UNDERSTAND -> ACT**. Quest 1 first exposes the real board as an object to observe, with temporary territory numbers 1–5. It then explains the goal and the four constraints (one Guardian per territory, row and column; no touching including diagonals). Only after that does the player touch the board and learn the real two-tap cycle: exclusion first, Guardian second.

“Learning through real gameplay” from issue #57 remains valid after this pre-action phase. It means that once interaction starts, teaching uses the real board and real gestures; it must not be interpreted again as permission to skip perception and rule comprehension. Any future onboarding refactor must preserve this ordering and its regression tests.


## 2026-10-04 — Quest 2 handoff teaches Mon ciel
After quest 2, onboarding must explicitly teach the progression screen. Do not auto-navigate when the player taps an arbitrary part of the success overlay. The success CTA is **Découvrir Mon ciel** and starts a sequential tour of the actual Mon ciel UI: constellation tabs, quest/progression cards, performance badges, then the constellation/stars visualization. The final tour action continues to quest 3. This extends the protected SEE → UNDERSTAND → ACT philosophy beyond the board itself.


## 2026-10-04 — Teach assistance when it unlocks
Do not front-load Marquage auto or Contrôle guidé trade-offs into the initial tutorial. Introduce each at the moment it becomes a real player choice. Quest 6 introduces Marquage auto as an optional comfort/fluidity playstyle and explains that actual use is assistance: Rapidité remains eligible, Autonomie and therefore Maîtrise do not. At the later autonomy milestone (quest 11), explain that Contrôle guidé may be disabled or re-enabled; simply leaving it enabled is not itself a badge penalty, but an actual guided intervention is assistance and removes Autonomie/Maîtrise. Assisted play is a valid playstyle and must not be framed negatively.


## 2026-10-04 — Teach badges only when they become earnable
Badge onboarding is progressive and tied to `performanceEligibility`, not arbitrary quest numbers. Quests 1–2 deliberately have no performance badge. Quest 3 is the first badge milestone and introduces Rapidité, the only eligible badge through quest 5. Quest 6 introduces the full performance system: Autonomie, Rapidité and Maîtrise. Autonomie requires no assistance; Rapidité requires beating the target time; Maîtrise requires both on the same attempt. If badge eligibility changes in code, onboarding timing and tests must change with it.


## 2026-10-04 — Onboarding dependency rule
The tutorial and later learning milestones are dependent product surfaces. They must never drift from gameplay rules. Any future change to rules, unlock timing, badge eligibility, assistance behavior, gestures, progression/navigation concepts or terminology requires an onboarding impact check even if the original request does not mention onboarding. Prefer one source of truth: teaching should derive its timing from gameplay eligibility/unlock rules whenever possible. Example: moving Rapidité eligibility to quest 8 must automatically or explicitly move its teaching milestone to quest 8. PRs changing such concepts are incomplete until onboarding and its regression tests are reviewed.

## 2026-10-04 — CI repair exposes blocked placement and hidden dialogs

The structural test manifest lagged behind ten new embedded regressions, so main CI stopped before executing any browser checks. Once that manifest was reconciled, missing test adapters and a quest 1 assertion running on ordinary boards exposed further harness failures. The fix retains every regression label and exercises the full introduction using a restored fixture instead of weakening its assertion.

Real touch tests then exposed two player-facing defects: badge/auto-marking dialogs with `hidden` were still displayed by their flex CSS, and the new exclusion-dead-end diagnostic blocked the first tap on every required Guardian cell. Because a Guardian requires an intermediate exclusion, the interactive handler must validate its placement on the second tap. The exclusion diagnostic remains tested in the engine, while ordinary tap placement and real learning actions remain possible. Teaching dialogs still appear and are acknowledged at their intended milestones; only hidden dialogs stop intercepting input.
