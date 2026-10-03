# Data and architecture

## Client
LUMEN is a static web/PWA application using native ES modules without a build step. `index.html` is a 16,317-byte shell: the existing document markup, stylesheet link, Supabase CDN script and module entry point. It has no inline JavaScript or CSS. `src/main.js` starts the UI controller; domain modules contain the application logic. `manifest.webmanifest` and `sw.js` are unchanged.

The #21–#26 migration starts from main `dcd9f3c872e623541be698edc212b64589d3b164`. Rules, catalogue, badge semantics, progression, tutorial, UX, storage keys and backend contracts are preserved. Issues #30/#31 are explicitly excluded. The stage descriptions below record the incremental extraction; the navigation map describes the final source layout.

## Modular refactor: stage #21

Native ES modules are served directly by the existing static host; no build tool or framework is required. At stage #21 the two former inline scripts shared one module scope to preserve their initialization order. `src/ui/format.js` contains the existing date/duration formatting functions. The other domains were then extracted in separately validated stages.

The application still owns one live board (`n`, `puz`, `state`) and one canonical `lumenProgress`. Functions that use those values must read current state rather than capture a board that becomes stale on reset/replay. The first startup phase initializes tutorial/auth/identity, then local progress, then board/campaign/handlers; cloud initialization remains last. The feedback button is bound by `setupBetaFeedback`; its former inline handler and `window.openBetaFeedback` bridge were redundant and removed at #26. `window.runHintTests` and `window.lumenDiagnostics` are the browser testing entry points, not additional stores of game state.

The service worker remains network-first for scripts and the HTML navigation remains network-only. Module paths are relative to their importing file; CDN Supabase loading still precedes application execution. `hiCells`, formerly an implicit global, is now explicitly declared in the shared module scope.

### Task navigation

| Change | Source | Validation |
|---|---|---|
| Date/duration presentation | `src/ui/format.js` | Browser suite |
| Rules/proof engine | `src/game/engine.js` | Browser suite + strict catalogue audit + `scripts/engine-equivalence.mjs` |
| Campaign/catalogue | `src/campaign/catalogue.js`, `data.js`, `progression.js` | Browser suite + strict catalogue audit + `scripts/campaign-tests.mjs` |
| Persistence/auth | `src/persistence/{local,cloud,config}.js` | Guest reload + `scripts/persistence-tests.mjs` |
| Board/tutorial/UI | `src/ui/{game-screen,tutorial,sound,styles}.js/css` | Browser suite + touch smoke + `scripts/ui-equivalence.mjs` |
| Analytics/identity/referral | `src/analytics/events.js` | `scripts/analytics-tests.mjs` + browser suite |
| Regression suite/diagnostics | `src/testing/{hint-tests,diagnostics}.js`, `scripts/{browser-tests,cdp-client}.mjs` | All-size browser suite + `scripts/module-structure-tests.mjs` |
| Shell/module imports/PWA | `index.html`, `src/main.js`, `manifest.webmanifest`, `sw.js` | Module structure + browser PWA asset/registration checks |

`scripts/browser-tests.mjs` runs all 66 embedded cases on each of the four board sizes through Chrome DevTools, followed by actual touch cycle/drag/reset and guest reload checks. Use an isolated guest profile, a local static server on port 8000 and Chrome remote debugging on port 9222. Pass a report path as its first argument. Endpoints can be overridden with `LUMEN_TEST_URL` and `LUMEN_CDP_URL`. The runner closes the isolated browser after testing.

## Stage #22: game engine

`src/game/engine.js` exposes `createGameEngine(getBoard, getAutoCrossEnabled)`. It reads the current `{n,puz,state}` through the injected accessor and never accesses the DOM. Its API contains enumeration (`solutions`), automatic exclusions, stored-solution verification, Guardian conflict/validity checks, guided action checks and the existing proof engine. Algorithms, traversal order, reasons and hint text are retained. `solutions(board)` accepts an explicit board for the guided hypothetical placement, avoiding any mutation of application state during that calculation.

Victory validation is now called by the renderer through `validateGuardians`; rendering and celebrations remain in the application. The catalogue audit and offline generator import the same engine used in the browser instead of copying its source from HTML. `scripts/engine-equivalence.mjs` compares complete proof objects and guided/error/enumeration outputs against main commit `dcd9f3c872e623541be698edc212b64589d3b164`, across every catalogue grid and automatic-marking modes. An optional first argument supplies that baseline HTML without invoking Git.

## Stage #23: campaign

`src/campaign/catalogue.js` owns `CAT` and `LEVELS`; `data.js` owns quest metadata, fixed schedule, constellation shapes/counts and existing badge display definitions. `progression.js` exports pure campaign calculations and `createCampaign(getProgress, saveProgress, getAttempt)` for calculations that use the current canonical progress/attempt. It retains the existing performance recording and badge rules verbatim in behavior; #30/#31 remain out of scope. UI navigation, quest loading and celebration orchestration belong to the UI controller.

`scripts/campaign-tests.mjs` compares the entire catalogue and schedule to the starting main commit, verifies calculations for all 100 quests and checks existing progress/performance serialization against four historical fixture shapes. Both the strict audit and generator import catalogue/campaign modules directly; the generator's optional write targets `src/campaign/catalogue.js` instead of HTML.

## Stage #24: persistence

`src/persistence/local.js` exposes `createLocalPersistence(storage,getProgress)` for existing load/save behavior. `cloud.js` exposes `createCloudPersistence(model,hooks,environment)` for profile, entitlements, auth initialization, progress and daily synchronization. `config.js` contains the same public client URL/key. No backend schema, RPC, auth provider, SDK version or storage format changed.

The model adapter has explicit getters/setters for the existing auth/progress/quest fields, so async operations observe the same live values as before. Hooks retain UI refresh and existing campaign calculations. DOM-dependent profile/auth presentation remains in the cloud module through its injected environment; it is a documented coupling, not an additional source of truth.

`scripts/persistence-tests.mjs` compares outputs, serialized progress, RPC payloads and callback effects against starting main using four local fixtures and five simulated cloud scenarios. It includes denied storage, malformed data, guest mode, empty/existing/sparse cloud progress, reconnect/sign-out and reported network errors. Real guest reload is exercised in Chrome. Live OAuth login and live authenticated cloud writes are not claimed or performed by these tests.

## Stage #25: UI and input

`src/main.js` starts `startGameScreen()` from `src/ui/game-screen.js`. This controller owns the one live board/attempt state, composes the game/campaign/persistence APIs, binds events and orchestrates rendering/navigation/celebrations. `tutorial.js` owns the existing general-help walkthrough; `sound.js` owns audio and its preference; `styles.css` is the existing CSS moved without rule changes. HTML is now markup plus stylesheet/CDN/module entry points.

The scripted coach, assistance restrictions and all timings remain unchanged. The pointermove callback has a name (`moveDragCross`) so source/performance tests can inspect the actual handler after it leaves HTML. Actual Chrome touch tests also observe board child mutations and reject a full board rebuild during drag. The 66 browser regression cases are retained; only their two HTML-source lookups were updated to inspect the real module handler.

`scripts/ui-equivalence.mjs` compares rendered board DOM, geometry, cell colors/borders and control text/visibility/enabled states with starting main. It covers empty/marked boards for quests 1, 3, 12 and 48 on 390x844, 360x640 and 1440x900 viewports (12 scenarios, both mobile and desktop). To reproduce, serve the starting main HTML temporarily as `.refactor-baseline.html` next to the current page in the isolated browser test setup, then remove that temporary file. Reports are under `docs/validation/refactor-ui-equivalence.json`. Analytics and the suite were subsequently extracted in #26.

## Stage #26: analytics, tests and final boundaries

`src/analytics/events.js` exposes `createAnalytics(getClient,environment)`: anonymous/session identity, existing event RPC payloads and referral sanitization. The UI calls it at the original startup/event locations, preserving event order. The client accessor reads the current Supabase client after async initialization. `scripts/analytics-tests.mjs` compares identity storage, event names/payloads, sanitized referrals and failed-network warnings against starting main in eight scenarios, without live writes.

`src/testing/hint-tests.js` owns all 66 original cases; `diagnostics.js` owns browser test orchestration and snapshots. Both receive explicit live state/API adapters from the controller. `window.runHintTests` and `window.lumenDiagnostics` remain the supported browser entry points. No test was removed. The development Chrome runners share `scripts/cdp-client.mjs`. `scripts/module-structure-tests.mjs` checks import targets/cycles, shell boundaries, original CSS and preservation of every case label.

The obsolete inline feedback handler/global bridge was removed after verifying the button already has its original listener. HTML retains the full markup because its IDs, accessibility attributes and DOM ordering are consumed by the unchanged UI. No substantial business logic remains in HTML. There are no compatibility copies of extracted domain algorithms.

Remaining coupling: `game-screen.js` is still a sizable imperative UI controller, owning scripted onboarding, rendering, event binding, reward presentation and PWA prompts. Cloud profile/auth presentation uses injected DOM references. Some historical regression cases inspect source strings rather than exercising every real integration. These are intentional boundaries of this behavior-preserving migration, not claims of complete UI decomposition or live backend validation.

The final browser gate also verifies active/controlling service-worker registration, manifest display/start URL, successful icon/module asset responses and absence of uncaught startup/runtime exceptions. Navigation stays network-only and assets network-first as before; full offline navigation, live OAuth, production analytics and notification delivery are not asserted.

## Local/guest mode
Guest play is first-class. Progress is stored in localStorage under `lumenProgressV1`; tutorial, install/push choices, anonymous/session identity and UX preferences also use localStorage keys.

Anonymous users are tracked through an anonymous identifier/session so usage can be measured without requiring authentication.

### Existing persistence contracts (inventory before #24 extraction)

The canonical `lumenProgressV1` object retains `solved`, `historyBackup`, `badges`, `noHint`, `performances`, `xp`, `challenges`, `stars`, `shards`, `daily` (dates/rewards), `skyScore` and `skyHistoryVersion`. Keys are zero-based quest indices; cloud `p_puzzle_id` values are one-based. No schema/key migration is part of the refactor.

Other existing keys: `lumenTutorialSeen`, `lumenAnonymousIdV1`, `lumenReferral`, `lumenInstalled`, `lumenInstallLater`, `lumenWelcomeDayV1`, `lumenPushChoice`, `lumenManualCrossTipSeen`, `lumenGuidedErrors`, `lumenSound`, `lumenAutoCross` and the read-only legacy `regaliaAutoCross` fallback. The Supabase SDK retains its own auth storage.

RPC contracts retained: `lumen_get_profile`, `lumen_set_nickname(p_nickname)`, `lumen_get_entitlements`, `lumen_get_progress`, `lumen_save_progress(p_puzzle_id,p_duration_seconds,p_hints_used)`, `lumen_get_daily`, `lumen_save_daily(p_play_date,p_puzzle_id)`. Analytics and feedback RPCs remain separate responsibilities. Authentication retains Google OAuth with the current origin/path redirect, `getSession`, `onAuthStateChange` and `signOut`.

The current merge prioritizes a non-empty cloud history, otherwise uses local/backup history, then derives a continuous prefix and imports missing local records. This exact existing behavior is retained; this extraction does not redesign merge policy or badge semantics.

## Supabase
The client uses Supabase. Project-side database objects for LUMEN live in the **`lumen` schema**. Relevant RPC responsibilities visible from the client include:
- profile/nickname;
- progress save/load and local-to-cloud migration;
- analytics event tracking;
- daily play;
- entitlements;
- feedback and difficulty rating.

Google OAuth is supported. When a local player signs in, local solved history must be merged to cloud rather than discarded.

## Analytics
Events include puzzle start/completion, hints, sharing/referral, installation and related engagement events. Referral parameters are sanitized before analytics.

## PWA
Installation is offered only after meaningful engagement (currently after 3 solved quests), and standalone installs should not be nagged again. Push/reminder permission must only be requested after an explicit user action; the app hides its own prompt before invoking the Android/browser permission dialog.

Push support should not be considered complete merely because subscription/server code exists: service-worker receipt/display and end-to-end delivery must be verified.

## Security
The public Supabase client key in browser code must be treated as public. Security must rely on RLS/RPC authorization, not secrecy of browser credentials. Never add service-role keys or other server secrets to this repository.


## Anonymous player observability
Anonymous play is a deliberate product mode, not an error state. Analytics should make it possible to distinguish:
- an anonymous installation/player identity;
- sessions/visits for that identity;
- authenticated user identity after sign-in;
- campaign progress such as solved quest count/current constellation;
- key engagement events such as puzzle start/completion, hints, replay, share and install.

Do not equate the number of authenticated Supabase users with the total player population. Guest players may exist only through local progress plus anonymous analytics.

When a guest later authenticates, progression merge must preserve the strongest valid continuous progress. Analytics identity linking should avoid double-counting where practical while keeping authentication data and gameplay analytics responsibilities distinct.

## Data ownership principles
Campaign truth (catalogue, quest order, constellation mapping and rules) belongs to version-controlled application data/code. Player-specific mutable state belongs to local persistence and/or Supabase.

Derived UI counters should be recomputed from canonical state rather than becoming independent sources of truth. This is especially important for solved-quest totals, constellation progress, stars and unlock state: duplicated counters can drift and previously caused visible inconsistencies.
