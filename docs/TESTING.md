# Testing and quality gate

## Mandatory rule
After **every modification affecting LUMEN code, gameplay or a product feature**, update the automated test contract in the same change and run the complete applicable test battery before delivery. This has two inseparable goals:
- **non-regression**: existing behavior that must remain stable stays covered; when an intentional product change invalidates an old assertion, adapt that assertion explicitly rather than simply deleting or bypassing it;
- **feature coverage**: add tests for the new behavior itself, including its important edge cases, persistence/reload semantics and interactions with existing features.

For gameplay, board, progression or catalogue changes, also run the strict grid audit. Do this even for changes that appear purely visual if they touch board DOM/input/state. A feature is not complete when its implementation exists but its test contract still describes the previous behavior.

## Browser regression suite
The app exposes `await window.runHintTests()`; the 66 original cases plus three UX regressions (#16/#17/#19) live in `src/testing/hint-tests.js`. The narrative assertion now reads the on-demand rules modal. `window.lumenDiagnostics.runAllHintTests()` runs the suite for every size. The suite runs cases sequentially and waits for asynchronous victory/reveal behavior. It covers, among other things:
- PWA install timing and standalone behavior;
- sharing/referral and account/profile behavior;
- reminder opt-in rules;
- continuous sequential progression;
- 100 quests / 12 constellations / 150 stars;
- cell cycle;
- guided conflicts and solver use;
- N x N board rendering;
- mobile drag exclusions;
- Guardian terminology;
- constellation/reward celebrations;
- replay and reset/navigation;
- modal behavior;
- learning/autonomy rules;
- victory regression cases;
- fixed row height when exclusions appear;
- success/non-success behavior;
- catalogue structural rules;
- proof-engine transparency;
- performance regressions;
- complete explainable replay of catalogue puzzles for the current tested size.

Run browser tests in an isolated guest profile: the victory fixture exercises real local progression writes. Do not run this fixture on an authenticated player's production session.

## Performance budgets currently asserted
- median `paintBoardState()` < 16 ms on the current grid;
- median `paintCell(0,0)` < 8 ms;
- ordinary click must not rebuild the whole grid;
- pointermove drag must not call full `render()`.

Treat these as regression budgets, not universal benchmark claims: device/browser hardware affects absolute timing.

## Strict grid audit gap
The embedded suite evaluates `CAT[n]` for the current board size. Run it for 5x5, 6x6, 7x7 and 8x8, then run `node scripts/audit-catalogue.mjs` to check every catalogue size and campaign reference. The two documented onboarding singleton exceptions are checked explicitly; ordinary catalogue entries must still reject singleton territories.

For the learning coach, additionally test a free tap on the background/grid/bubble, an explicit Next tap without double advancement, Previous both during and after an animation, restoration of Guardians and exclusions, review without replaying old marks, an already-marked zone message, and reset of the navigation history. Repainting unchanged cells must retain the same exclusion DOM nodes.

### Audit findings on 2026-10-03

The initial audit exposed existing explainability failures in 11 catalogue entries of size 7 and 11 of size 8; 11 of these entries were scheduled in the campaign. Their mathematical validity and uniqueness passed, but `proofEngine()` became stuck before completion. At that initial review, the affected data and proof engine were unchanged from commit `1683d1a`. These failures were subsequently resolved by the replacements below, rather than waived. See the recorded review in PRODUCT_MEMORY.

After fixing the harness and aligning its assertions with the documented onboarding exceptions and actual asynchronous UI: 66/66 embedded tests pass on 5x5 and 6x6; 65/66 pass on 7x7 and 8x8, with only the existing complete-proof-replay test failing. A real Chrome mobile viewport also verified the three-tap state cycle and touch dragging across five cells without overwriting a Guardian or scrolling the board. The learning navigation/browser checks verified stable marks, already-marked messages, free taps, backwards restoration and animation cancellation.

These are local validation results against `codex/work-in-progress`, based on `f8d94f379a27b5f8aa98ab43d53bbcdc025de708` plus the review fixes. They are not a Production deployment verification. Raw results are retained in `docs/validation/2026-10-03.json`.

### Replacement validation on 2026-10-03

After offline generation and replacement of the 22 blocked entries, all 134 grids pass structural validity, connected territories, singleton policy, exhaustive uniqueness and complete explainable replay. The audit checks stored metadata at every size where it is present. The 100 distinct campaign references, 12 constellations and 150 stars also pass. The proof engine, campaign schedule, remaining catalogue entries and persistence code are unchanged by this replacement.

In real Chrome with a 390x844 mobile viewport and isolated guest profile, `await runHintTests()` passes 66/66 cases for each of 5x5, 6x6, 7x7 and 8x8 (264 successful cases). This includes victory, replay, progression, rewards and persistence regression checks. See `docs/validation/2026-10-03-replacements.json` and the full proof metadata in `docs/validation/2026-10-03-catalogue-repaired.json`. These checks validate the local working tree; no Production deployment is claimed.

## Required manual/E2E smoke checks
The Chrome runner automates the tap/drag/reset/reload/PWA checks below. Keep explicit browser checks for scenarios not exercised by the runner:
1. first tap excludes, second places Guardian, third clears;
2. drag marks multiple exclusions and does not scroll the board;
3. quest 1 scripted flow and quest 2 faster learning flow;
4. quest 6 assistance can be disabled;
5. quest 11 autonomy prompt;
6. valid completion is detected immediately;
7. invalid N-Guardian state does not celebrate;
8. Reset keeps same quest;
9. next quest only after victory;
10. solved quest replay works and badges update from one attempt;
11. refresh preserves guest progress;
12. sign-in merges local progress;
13. install/share flows do not block play.

## Unified local / CI quality gate (#58)

Use Node 22+ and Chrome/Chromium. No npm install or application build is needed. The same command is used locally and by GitHub Actions:

```powershell
node scripts/quality-gate.mjs
```

The orchestrator runs every current Node gate, starts its own static HTTP server, launches isolated temporary browser profiles for browser/UX/learning suites, writes the usual reports under `docs/validation/`, and closes only the server/browser processes it started. On Windows it auto-detects Chrome or Edge; on Linux it looks for Chromium/Chrome. Set `LUMEN_CHROME_BIN` when the browser lives elsewhere. Any failing suite returns a non-zero exit code with a timing/status summary.

## Reproducible modular-refactor checks

Use a recent Node runtime with native ES modules, built-in `fetch` and `WebSocket` (validated with Node 22.22.3). No npm install or bundler is needed. From the repository root:

```powershell
node scripts/audit-catalogue.mjs
node scripts/engine-equivalence.mjs
node scripts/campaign-tests.mjs
node scripts/persistence-tests.mjs
node scripts/analytics-tests.mjs
node scripts/module-structure-tests.mjs
```

The differential scripts use `git show dcd9f3c872e623541be698edc212b64589d3b164:index.html` as the immutable baseline. In an environment where child-process Git is restricted, pass the exported baseline HTML path as their first argument. They do not change the catalogue or contact the live backend. `node scripts/replace-blocked-grids.mjs` remains the offline generator; without `--write` it makes no catalogue edits.

For real browser checks, start a local static server (`python -m http.server 8000`) and a separate Chrome process with `--headless=new --remote-debugging-port=9222 --user-data-dir=<isolated-temporary-profile> --no-first-run about:blank`, then run:

```powershell
node scripts/browser-tests.mjs docs/validation/refactor-26.json
```

The runner closes that isolated browser. It seeds the first two solved quests so its victory fixture has a valid continuous prefix, then removes the fixture script before testing guest reload. It runs 69 cases for each of four sizes (276 total, including all 264 original checks), actual touch cycle, drag without board reconstruction/scroll/Guardian overwrite, reset on the same quest and guest persistence. It checks active/controlling service worker after normal navigation, manifest, icon/module asset responses and uncaught exceptions. An additional forced reload bypasses cache to verify persistence independently of service-worker caching. `LUMEN_TEST_URL` and `LUMEN_CDP_URL` override server/debug endpoints.

To reproduce render equivalence, temporarily save the same baseline as `.refactor-baseline.html` in the server root, launch a fresh isolated debugging browser and run `node scripts/ui-equivalence.mjs`. Remove the temporary baseline afterwards. This compares full board DOM, geometry/colors/borders and control states on 12 quest/viewport combinations, both empty and marked.

### Local modular-refactor results

Reports `docs/validation/refactor-21.json` through `refactor-26.json` record the complete browser gate after each issue. `refactor-engine-equivalence.json` and `refactor-ui-equivalence.json` retain the differential results. The final gate covers all 134 catalogue grids, all 100 quest calculations, historical local/cloud fixtures, eight analytics scenarios and the original 66 regression labels/CSS. Campaign, tutorial timings and badge behavior are unchanged; #30/#31 were excluded.

Cloud synchronization and analytics equivalence use simulated RPCs. Live OAuth, authenticated backend writes, push delivery and Production deployment were not tested or changed. Browser performance results are local regression measurements, not device-independent guarantees.

## PR #38 UX validation

`node scripts/ux-cleanup-tests.mjs docs/validation/pr38-ux.json` uses the same isolated Chrome setup and closes the browser afterwards. It tests real mouse/key input on 390x844, 360x640 and 1440x900 viewports: twelve rules-modal scenarios across quests 1, 2, 6 and 11, open/close button, Escape, backdrop, focus restoration and preservation of board/progress/teaching state. It also triggers a missing-mark hint and an actual victory/next-quest action on each viewport. The compact mobile success card must scroll so its primary CTA remains reachable.

The structural gate retains import/shell checks and all 66 original labels in order, verifies the three additional UX cases, and allows only the documented primary-CTA and scrollability CSS changes against the refactor baseline. It does not waive other CSS differences. Historical refactor reports remain unchanged; PR #38 browser and UX reports are `pr38-browser.json` and `pr38-ux.json`. `pr38-board-equivalence.json` records twelve passing board/control comparisons with the historical baseline; `pr38-audit.json` records the full 134-grid audit.

## Responsive architecture gate

For responsive UI work, run `node scripts/responsive-architecture-tests.mjs`. It guards the #28 architecture: no desktop-only re-parenting slots, no duplicate compact journey, no viewport-driven DOM moves, CSS-owned layout breakpoints, and Pointer Events capability handling for drag-to-exclude. This gate supplements rather than replaces the browser suite, UI equivalence checks and strict catalogue audit.

## Definition of done
A gameplay change is not done unless:
- all automated tests pass;
- strict all-grid audit passes;
- relevant manual/E2E scenario passes;
- no console error was introduced;
- docs are updated when behavior changed;
- commit SHA is reported;
- intended Vercel deployment status is checked.

Never claim “all tests pass” if only static/source inspection was performed.

## Social challenge gate (#18)

Run `node scripts/social-challenge-tests.mjs` for the pure challenge contract. It must remain in the CI static/data gate.

Any change to challenge behavior must additionally verify:
- first play can challenge; replay cannot;
- first play + Mastery is the only “remarkable performance” condition;
- recipient prior campaign exposure does not block participation;
- source performance is hidden until terminal result;
- corrections are allowed and only success/explicit abandon terminate the challenge;
- reload/background reuse the same attempt ID;
- challenge success cannot mutate campaign progression, rewards or normal qualifying attempts;
- one challenge can have multiple participants, while each participant identity has one terminal attempt;
- guest display name validation and no PII in deep links;
- QR/native/copy share all point to the same opaque challenge;
- push refusal never blocks gameplay, push result deep-links correctly, and repeated results are grouped;
- RPC idempotency/concurrency and RLS/direct-write boundaries.

Challenge changes are gameplay-adjacent and therefore still require the complete browser `runHintTests()` suite and strict all-grid catalogue audit before delivery.

## Learning gate (#57)

Run `node scripts/learning-tests.mjs`, then launch an isolated debugging Chrome and run `node scripts/learning-browser-tests.mjs docs/validation/issue57-learning.json`. The browser runner closes its own Chrome. The complete existing browser suite now contains 90 cases per size (360 executions). Two historical source assertions were intentionally renamed/adapted: quests 1 and 2 now guide real board actions, and drag is enabled for the lesson's reuse/drag/practice phases. Their replacement coverage is the real interaction runner, not an allowlist or deleted regression.

The learning gate checks every taught Guardian is forced by the territory's remaining candidates, no solution cell is excluded, no coach action mutates the board, wrong taps cannot start the attempt, half of a two-tap placement survives reload, actual touch/mouse dragging does not rebuild/scroll the board, and coach bubbles fit without covering the board or normal controls. It also checks quest 1 victory/progression, guided quest 2 placement, tap refusal during its drag lesson, partial-drag reload/resume, protection outside the row throughout the gesture, then free placement/Verify, normal quest 2 victory, the sky tour and transition to quest 3. Run the full catalogue audit and existing Node/browser/UX/social gates in addition.

### CI regression-contract repair — 2026-10-04

Main `d5478e6` failed before browser execution because `module-structure-tests.mjs` still expected 79 cases while the suite contained 89. Declare every added regression label explicitly; do not derive the expected labels from the current suite or relax the historical 66-case contract. The repaired suite contains 90 cases per size (360 executions), including a new visible/hidden milestone-overlay regression.

Onboarding assertions receive their UI dependencies through the existing live adapters and import badge eligibility from its owning module. The sky-tour array is read lazily because it is initialized after suite construction. The SEE/UNDERSTAND assertion creates a quest 1 fixture, checks all six steps, numbers and rejected board taps, then restores the previous board/quest/intro state in `finally`; ordinary quest 3 boards must not be expected to show teaching numbers.

Browser fixtures acknowledge newly opened badge/auto-marking milestones through their real buttons. UX replay verifies the introduction before the first playable cell. The learning runner checks the explicit quest 2 discovery CTA, inert success backdrop, all four highlighted sky zones and the quest 3 Rapidité milestone. The touch-cycle runner requires correct placement without a guided-conflict overlay. These fixtures preserve the intended onboarding rather than removing its dialogs to make tests pass.

Local validation for #57: all 13 Node gates passed, including the unchanged 134-grid / 100-quest catalogue audit. The full browser suite passed 79/79 cases on each of four grid sizes, and the UX suite passed its 12 quest/viewport scenarios. The learning interaction runner passed the full two-quest/tour/replay journey on four viewport sizes. Reports are `docs/validation/issue57-{node,browser,ux,learning}.json`; screenshots are `docs/validation/learning-{360,390,768,1440}.png`. These are isolated local guest-profile results, not live OAuth/cloud or Production validation.

The quest 2 drag extension was revalidated on 2026-10-04 with Node 24.19.0 and Chrome 153: all 13 Node gates, the 134-grid strict audit, all 316 embedded browser cases, 12 UX scenarios, and the complete learning journey on all four viewports passed. The learning report includes `guidedQuest2Drag` and `partialQuest2Reload`, covering tap refusal, partial-drag restoration and protection outside the row through pointer release. Screenshots were regenerated and the compact 360x640 layout was visually inspected. This completes local validation on `codex/issue-57-learning`; publication and verification of the exact Production commit remain separate release steps.

CI runs the learning interaction suite with its own Chromium profile and debugger port 9223, using `LUMEN_CDP_URL` for both readiness and the test connection. Browser/UX suites use port 9222. This prevents the learning readiness probe from accepting the preceding UX browser while it is shutting down; that race caused `ECONNREFUSED` before any learning assertion ran. The full learning interaction suite remains mandatory after this infrastructure correction.

Local repair validation: all 13 Node gates pass, including the strict 134-grid / 100-quest audit; the full embedded suite passes 90/90 cases at each size, actual mobile tap/drag/reset/reload checks pass, the 12 UX scenarios pass, and the full two-quest learning/tour/replay journey passes on all four viewports without uncaught errors. Reports are docs/validation/ci-repair-{browser,ux,learning}.json. These are local isolated guest-profile results; no Production release is claimed.


## Product telemetry gate (#65)
Attempt analytics must use the attempt engine active duration and stable `attempt_id`; never rebuild duration from page timestamps. A campaign/replay Reset increments `run_index` while retaining `attempt_id`; challenge Reset remains one-shot. Run `node scripts/analytics-tests.mjs` after telemetry changes. Do not add cell-by-cell telemetry without a concrete product decision.


### Quality gate orchestration rule
Do not duplicate browser/server setup in GitHub Actions. Add new mandatory suites to `scripts/quality-gate.mjs` so local and CI execution stay identical.


## Difficulty audit (#81)
Run `node scripts/difficulty-audit.mjs [optional-report.json]` to measure the campaign independently of player telemetry. The deterministic score combines board size, explainable proof workload and the pressure of `locked/group` rules. It uses fixed thresholds rather than campaign percentiles, so future packs can be compared to the base game. The quality gate runs the audit to ensure every scheduled quest remains fully replayable; changing the score formula requires an explicit product decision and documentation.


## Late-game difficulty curve (#81 phase 2)
The base campaign intentionally consumes every currently audited 7×7 and 8×8 catalogue entry. The second half alternates easier 6×6 breathing quests with 7×7 hard steps and 8×8 expert peaks instead of using grid size as a monotonic ladder. `scripts/difficulty-audit.mjs` guards the curve itself: all five 20-quest segment averages must rise, the final segment must materially exceed the first, Q81–100 must contain several expert/expert+ peaks and several breathers, and Q100 must be expert+.

The fixed metric is `round((size-5)*6 + max(0,steps-size)*0.45 + group*1.25 + locked*0.6)`. Tiers: accessible <40, intermediate 40–54, hard 55–69, expert 70–89, expert+ ≥90. This is a reproducible solver proxy, not a claim about human solve time; validate it against #65 telemetry as data accumulates.


## Extensible content registry (#47)
`src/campaign/content.js` is the stable content boundary for future skies and packs. The current 100-quest game is pack `base-real-sky` inside `real-sky`. Existing numeric quest indices remain the legacy progression key so current players lose nothing. Future packs receive stable IDs and can be entitlement-gated without changing the puzzle engine.

The base campaign length is intentionally distinct from future catalogue length. Progression/UI/cloud merge paths derive the current base length from the content model instead of duplicating the literal 100. Payment, pack pricing and the final future-catalogue UX remain out of scope until engagement data justifies them.
