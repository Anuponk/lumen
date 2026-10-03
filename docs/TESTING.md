# Testing and quality gate

## Mandatory rule
After **every modification affecting LUMEN gameplay**, run the complete test battery and strict grid audit before delivery. Do this even for changes that appear purely visual if they touch board DOM/input/state.

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
