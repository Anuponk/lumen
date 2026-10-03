# Data and architecture

## Client
LUMEN is currently a monolithic static web/PWA application. `index.html` contains UI, CSS, catalogue, gameplay state, solver/proof logic, progression, analytics and tests. `manifest.webmanifest` and `sw.js` support installation/offline/PWA behavior.

This architecture makes cross-feature regressions easy. Refactoring into modules is desirable only if behavior is protected first by tests.

## Modular refactor: stage #21

Native ES modules are served directly by the existing static host; no build tool or framework is required. The two former inline scripts share one module scope to preserve their initialization order. `src/ui/format.js` contains the existing date/duration formatting functions. The remaining application stays in `index.html` until its domain is extracted in a separately validated stage.

The application still owns one live board (`n`, `puz`, `state`) and one canonical `lumenProgress`. Functions that use those values must read current state rather than capture a board that becomes stale on reset/replay. The first startup phase initializes tutorial/auth/identity, then local progress, then board/campaign/handlers; cloud initialization remains last. The HTML feedback action retains its explicit `window.openBetaFeedback` entry point. `window.runHintTests` and `window.lumenDiagnostics` are the browser testing entry points, not additional stores of game state.

The service worker remains network-first for scripts and the HTML navigation remains network-only. Module paths are relative to their importing file; CDN Supabase loading still precedes application execution. `hiCells`, formerly an implicit global, is now explicitly declared in the shared module scope.

### Task navigation

| Change | Source | Validation |
|---|---|---|
| Date/duration presentation | `src/ui/format.js` | Browser suite |
| Rules/proof engine | `src/game/engine.js` | Browser suite + strict catalogue audit + `scripts/engine-equivalence.mjs` |
| Campaign/catalogue | `src/campaign/catalogue.js`, `data.js`, `progression.js` | Browser suite + strict catalogue audit + `scripts/campaign-tests.mjs` |
| Persistence/auth | `src/persistence/{local,cloud,config}.js` | Guest reload + `scripts/persistence-tests.mjs` |
| Board/tutorial/UI | `index.html` (pending #25) | Browser suite + touch smoke |
| Analytics/tests | `index.html` (pending #26), `scripts/browser-tests.mjs` | Full regression gate |

`scripts/browser-tests.mjs` runs all 66 embedded cases on each of the four board sizes through Chrome DevTools, followed by actual touch cycle/drag/reset and guest reload checks. Use an isolated guest profile, a local static server on port 8000 and Chrome remote debugging on port 9222. Pass a report path as its first argument. Endpoints can be overridden with `LUMEN_TEST_URL` and `LUMEN_CDP_URL`. The runner closes the isolated browser after testing.

## Stage #22: game engine

`src/game/engine.js` exposes `createGameEngine(getBoard, getAutoCrossEnabled)`. It reads the current `{n,puz,state}` through the injected accessor and never accesses the DOM. Its API contains enumeration (`solutions`), automatic exclusions, stored-solution verification, Guardian conflict/validity checks, guided action checks and the existing proof engine. Algorithms, traversal order, reasons and hint text are retained. `solutions(board)` accepts an explicit board for the guided hypothetical placement, avoiding any mutation of application state during that calculation.

Victory validation is now called by the renderer through `validateGuardians`; rendering and celebrations remain in the application. The catalogue audit and offline generator import the same engine used in the browser instead of copying its source from HTML. `scripts/engine-equivalence.mjs` compares complete proof objects and guided/error/enumeration outputs against main commit `dcd9f3c872e623541be698edc212b64589d3b164`, across every catalogue grid and automatic-marking modes. An optional first argument supplies that baseline HTML without invoking Git.

## Stage #23: campaign

`src/campaign/catalogue.js` owns `CAT` and `LEVELS`; `data.js` owns quest metadata, fixed schedule, constellation shapes/counts and existing badge display definitions. `progression.js` exports pure campaign calculations and `createCampaign(getProgress, saveProgress, getAttempt)` for calculations that use the current canonical progress/attempt. It retains the existing performance recording and badge rules verbatim in behavior; #30/#31 remain out of scope. UI navigation, quest loading and celebration orchestration stay with the UI until #25.

`scripts/campaign-tests.mjs` compares the entire catalogue and schedule to the starting main commit, verifies calculations for all 100 quests and checks existing progress/performance serialization against four historical fixture shapes. Both the strict audit and generator import catalogue/campaign modules directly; the generator's optional write targets `src/campaign/catalogue.js` instead of HTML.

## Stage #24: persistence

`src/persistence/local.js` exposes `createLocalPersistence(storage,getProgress)` for existing load/save behavior. `cloud.js` exposes `createCloudPersistence(model,hooks,environment)` for profile, entitlements, auth initialization, progress and daily synchronization. `config.js` contains the same public client URL/key. No backend schema, RPC, auth provider, SDK version or storage format changed.

The model adapter has explicit getters/setters for the existing auth/progress/quest fields, so async operations observe the same live values as before. Hooks retain UI refresh and existing campaign calculations. DOM-dependent profile/auth presentation is injected and will be further isolated with the UI; it is not an additional source of truth.

`scripts/persistence-tests.mjs` compares outputs, serialized progress, RPC payloads and callback effects against starting main using four local fixtures and five simulated cloud scenarios. It includes denied storage, malformed data, guest mode, empty/existing/sparse cloud progress, reconnect/sign-out and reported network errors. Real guest reload is exercised in Chrome. Live OAuth login and live authenticated cloud writes are not claimed or performed by these tests.

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
