# Testing and quality gate

## KPI reliability correction — #708

`analytics-dashboard-tests.mjs` reproduces disabled-collection false zeroes and
split version labels; `analytics-tests.mjs` reproduces an open-page idle session;
`incident-investigation-tests.mjs` reproduces weekly counts above the daily budget.
`fixtures/reliable-analytics.sql` runs the real migration twice in disposable
PostgreSQL: receipts without events, cross-domain deduplication, shared browser
ownership, QA exclusion, independent WAU, unknown retention, revision-qualified
decimal medians/sample counts, stale queues, Lumen isolation and live capability
expiry/grants. It runs at the end of the existing ledger SQL CI. An isolated
embedded PostgreSQL run provides additional local evidence, not production proof.
The real-app Analytics browser retains 320/390/1440 checks and asserts receipt
cards with zero product events and unavailable retention. Production activation,
authenticated live acceptance and physical mobile remain separate checks.

## Actionable Analytics dashboards — #708

`analytics-dashboard-tests.mjs` joins the Node gate: missing versus measured zero,
sample-qualified quest signals, independent period populations, catalogue identity,
stale queue status, bounded daily series, accounts without product events and
independent technical windows. `admin-recent-players-tests.mjs` reproduces the
product-service outage hiding valid technical evidence before the correction,
then verifies the independent response and separation of product/technical alerts.

The existing `analytics-admin-browser-tests.mjs` now covers 320/390/1440 px with
real app/Chrome and synthetic Auth/RPC: journey adventure/exposure filters, quest
detail, causes/version/queue evidence, accounts without product events, links into
the shared pending-player list and sessions, and independent source outages.
Existing direct/reload/escape/history/guest/non-admin checks remain. Optional
`LUMEN_DASHBOARD_SCREENSHOTS` stores desktop fixture captures outside the repo
for visual inspection. No live accounts or player data are read by these tests.

The independent cockpit browser now deliberately opens a historical disclosure
before testing keyboard closure, because these secondary tables are closed by
default. It retains all twelve sections (including #716 preview), filter and
session tests. Admin scope-switch tests clear all new dashboard hosts. Physical
mobile, real admin Auth/data, live hosting and long-term journey instrumentation
remain separate acceptance; synthetic fixtures do not establish those results.

## Analytics administration navigation — #708 B1

`analytics-navigation-tests.mjs` joins the Node gate: deferred access, section/
history/period preservation, capability loss, original game URL and unique reuse
of cockpit hosts. `cockpit-acceptance-tests.mjs` additionally checks clearing
feedback/KPI hosts and resetting navigation when the administrator changes.

`analytics-admin-browser-tests.mjs` joins the full browser gate: real application
and Chrome at 390/1440 px, synthetic Auth/RPC, direct nested URL, reload, five
sections, retained search/period, Escape, historical entry and denial before any
admin read. The independent cockpit/report/support runner retains its existing
320/360/390/844/1440 checks after selecting the relevant section. These never
query real users or prove physical-device/live Auth/RLS acceptance. The local
gate server mirrors only `/admin/analytics`, not arbitrary SPA fallback.

`o2switch-deploy-tests.py` verifies the scoped admin rewrite, preservation of
the root hosting configuration and rollback on failed Analytics HTTP checks.
Real Bash publisher fixtures require Linux CI and are skipped on Windows.
After separate release authorization, manual acceptance must verify Apache
rewrite support and exact deployment SHA, desktop/mobile and account changes.
No live activation is part of the B1 implementation PR.

## Current validation entry points

- `npm ci --ignore-scripts` installs development tooling; runtime has no build step.
- `npm run format:check` checks the reviewed formatting scope and syntax equivalence.
- `npm run test:affected -- --list` explains test selection without running it;
  `npm run test:affected` executes it. UI, tooling and uncertain impact select full validation.
- `npm run test:full` runs the gate and complementary standalone suites. Node
  inventory: `scripts/quality-gate-suites.mjs`; browser composition: `scripts/quality-gate.mjs`.
- `await window.runHintTests()` tests one size; `await window.lumenDiagnostics.runAllHintTests()`
  derives all sizes from the catalogue. Use an isolated QA/guest profile and read
  actual totals/failures from the returned results and `docs/validation/ci-*.json`.

Old counts (66, 69, 79, 316 or 360 executions) below describe historical runs,
not current totals. `module-structure-tests.mjs` retains original case labels plus
reviewed product changes; never remove coverage to reconcile a count. Use the
[test map](architecture/test-map.md) for neighboring checks. Fixtures/CI do not
replace live-service or physical acceptance.

## Reproducible formatting (#59)

Prettier 3.6.2 and Acorn 8.15.0 are exact development-only versions, locked with
integrity in `package-lock.json`. `.prettierrc.json` defines two spaces, single
quotes, semicolons, trailing commas, 100-column wrapping and LF. Run `npm run format`
to write or `npm run format:check` to inspect. Both compare parsed syntax before
and after formatting; a syntax-tree change fails before writing. CI installs
locked tooling and runs the check.

Rollout is incremental: `scripts/format-scope.json` lists migrated modules/tools.
Unlisted legacy modules are not silently reformatted. Extend the list in dedicated
changes with behavior checks. Immutable catalogue/astronomy/generated data,
vendored dependencies and reports are excluded by `.prettierignore`; the script
never traverses them. Avoid editor-wide formatting of those files. Source-text
tests must follow the owning module or become behavior tests after extraction.

`app-updates-tests.mjs` was run against the original worker block, then the same
scenarios against `ui/app-updates.js`: first controller, one upgrade reload,
OAuth code/token exceptions, manual messages, waiting-worker activation and
asset-cache-only cleanup. The welcome regression also executes the actual new
listener. `service-worker-update-browser-tests.mjs` retains real worker/cache
upgrade and local/IndexedDB preservation checks. No live cloud transport is asserted.

Onboarding boards #650/#692: `node scripts/onboarding-grids-650-tests.mjs` recounts the
five replacement boards (uniqueness, D4 novelty, both logical engines), checks the
monotone quest 2–7 profile, the quest 4–6 plateau without advanced deductions and
the quest 7 bridge (55–70), unchanged identities/rewards/labels, revision-0 links,
absence of `gv` markers, archived old attempts, obsolete ranking archiving and the
exact scope of both migrations. Adventure 1–4 protection tests compare these IDs at revision 0.

Learning coach placement #687/#688: `learning-coach-placement-browser-tests.mjs` walks the quest-1 intro on a fresh guest at 320×568, 360×640 and 390×844 and requires zero overlap between the coach and the board, full coach text, a reachable « Suivant », a board of at least 180 px and (#690) one stable board size and coach reserve across every step; it then opens « Créer un compte » during a step and requires the account screen on top with the coach hidden, and the same step after closing. It fails on the previous centred intro panel (z-index 1500).

Victory screen #682: `node --test scripts/victory-celebration-tests.mjs` covers the five stable reward slots, confirmed-only rank messages (no lead claim with Échos, no participant counter), graded levels and composition, the shared engine (amplify without restart or downgrade, reduced motion) and the absence of quest-number conditions. `victory-layout-browser-tests.mjs` checks on real portrait viewports (320×568, 360×640, 390×844) that a board arriving after 0, 1 or 5 s moves no zone, five badges fit one row, the three secondary actions share one row below the full-width next action, the podium is ordered 2–1–3 with decreasing heights and only the player highlighted, no counter or horizontal scroll, and no particles in reduced motion. Pending victory (#682 périmètre I, #699, #706):
`victory-celebration-tests.mjs` checks the pending slots and the star owned on
replay. `gameplay-domain-tests.mjs` checks that `presentPendingVictory` opens
the single result screen and never `successOverlay`.
`victory-pending-browser-tests.mjs` (360×640, synthetic 4 s command) checks
that a pending result shows no credit, rank or challenge, then is confirmed in
place with no zone moving (≤ 1 px), one grant only, and the star still owned on
a replay. The wallet, domain-replay and campaign-resume browser flows now wait
for the shared `PENDING_VICTORY_SHOWN` condition (`cdp-client.mjs`) and use
the visible buttons of the single screen. The pending retry (`retryPendingVictoryInPlace`) is unit-tested in `gameplay-domain-tests.mjs` (no double commit, offline no-op, full-resync fallback when unready or when other victories remain), and `victory-pending-browser-tests.mjs` checks a failed command retried in place without page reload, one grant and no zone movement.

Quest review #695: `node --test scripts/quest-review-tests.mjs` covers the saved badge/star
slots (never "new"), the current-revision official time, the read-only ranking
review mode (board only, no outbox flush, no animation, neutral errors) and the Mon
ciel wiring. `quest-review-browser-tests.mjs` opens a completed quest from the real
Mon ciel tiles at 320×568, 360×640 and 390×844 and checks content, hidden
Next/Défier, reachable Rejouer/Mon ciel, no particles, no localStorage write and
the usual replay entry. `canonical-replay` and `learning` browser suites go
through the review before the replay cooldown.

Mixed pacing: `node scripts/mixed-difficulty-tests.mjs` independently rates,
recounts and replays all 480 targeted grids, checks the 200 changed / 280 retained
boards, exact protected Adventure 1–4 definitions, D4 diversity, measured score
relief/final peaks and the all-Master finale. Different constellation lengths,
attempt versions, older social geometry and stale reset-aware intents are covered.
Offline regressions retain older pending evidence while recovering a new board
version, and preserve same-version, Auth and economic-domain ordering.
`--write` regenerates `validation/mixed-logical-difficulty.json`; the ordinary
test compares that report with freshly measured output.

SQL CI explicitly uses `quest-command-fixtures --grid-revision 1` before the
new cutover. After preparation/activation it runs current changed-board parity
with a separate synthetic identity namespace, plus rollback, old API/receipt
refusal, two reset epochs, no duplicate rewards, preserved original Adventures,
unchanged-board records, historical social participation and export/erasure of
both histories. Prepared DDL must leave old clients functional until activation.
Fixtures and activation generation are offline/disposable checks, not production
authorization or evidence of real-device play.

Explicit quest resets: `node scripts/cloud-quest-reset-tests.mjs` covers obsolete
local achievements, two devices, exact archives, outbox replicas and owner scope,
quota/session holds, active attempt epochs and fresh records without duplicate
economic rewards. The full affected gate discovers this suite automatically.
`fixtures/quest-reset.sql` runs after the current catalogue/records migrations in
the canonical ledger CI: reset idempotence, original archives, access, other-player
isolation, stale snapshots/receipts/facts, old APIs, acquisition recovery and new
command retry. Current-schema privacy tests follow the additive migration.
Synthetic fixtures never authorize production account changes.

Logical difficulty #640: `node scripts/logical-difficulty-tests.mjs` verifies
solution-blind reproducible traces, prerequisite DAGs, sound deductions, stalls,
same-size board replacement, unversioned saves, offline reload, downgrade and
archive quota failures. `node scripts/logical-grid-tests.mjs` independently
recounts and replays every new grid in both logical models; checks old/new
hashes, exact replacement scope, unchanged identities/rewards/outside content,
near-duplicate distance, strict Adventure bands, within-constellation progression,
matched-size improvement, shallow guardians and first-placement depth; and checks
grandfathered cloud facts and non-duplicating replay awards. `--write` records
the deterministic distribution, excluding environment-dependent benchmark time.
Both suites are part of the quality gate. Existing frozen-grid audits continue
against the original manifests, alongside the new complete replacement audit.

The IAU browser suite additionally plays one proof-derived sample in each of
Adventures 5–8 at 390px through actual touch handlers (two taps per guardian),
without setting the board or consulting `sol` for those moves. Existing cases
cover victory, next-Adventure navigation, guest reload, offline shell and the
authenticated offline/reconnect exactly-once receipt. This is automated browser
evidence, not a human difficulty study or physical phone acceptance.

`scripts/fixtures/logical-grid-challenges.sql` runs after the actual challenge
and catalogue migrations in canonical-ledger CI's disposable PostgreSQL 17.
It checks default revision-0 links, v2/get/list round trips, hidden reference
performance, stable one-shot participation, inbox privacy, invalid revision,
wrong Adventure, unknown quest, replay rejection, narrow privileges and no
campaign write. The Node difficulty suite checks routing both revisions and
refuses an unsafe old-RPC fallback. Production application is not a test step.
Versioned read/list/start/finish also cover old-client rejection without
consuming an attempt, wrong-revision resume, private implementation denial and
prevention of a cross-grid result through the legacy finish RPC.

Onboarding impact #640: rules, gestures, assistance, badge eligibility, learning
quests and their timing are unchanged. Only later Adventure grids/labels change;
the complete embedded and learning-browser regressions remain mandatory.

Erasure UI acknowledgement: `node scripts/self-erasure-controls-tests.mjs`
executes the real controls with synthetic DOM/Auth/HTTP and cleanup spies. Six
cases reproduce unsafe cleanup on baseline, then seven pass: incomplete HTTP
success, stale session, unverified owner/token, replacement during signout,
double submission, failed signout and explicit completed acknowledgement.
The eighth check verifies the existing confirmation describes irreversible
progress loss in Lumen without infrastructure details. No real account deletion,
server deployment or physical acceptance is claimed.

Admin cockpit indexes (#962): `scripts/fixtures/admin-cockpit-indexes-962.sql` (canonical-ledger CI, #708 step) applies the migration twice. It checks the exact partial-index predicates, that the planner uses both indexes for the `cockpit_events` filters, and that `cockpit_events` keeps returning only human, non-QA events with the same owner attribution.
Device storage health (#962): `scripts/fixtures/outbox-storage-health-962.sql` (same step) applies the migration twice and checks the 14-argument observation, the unchanged 11-argument call, stale packets, bounds (no free text), identity, the summary count and anonymous alert fields, 7-day expiry, privileges and erasure registration. Client buckets: `cloud-outbox-health-tests.mjs`; admin rendering: `analytics-dashboard-tests.mjs`.

Production isolation (#962): `scripts/cdp-client.mjs::connectBrowser` blocks the production Supabase host (`tjdjlavmusmncuszhsuw.supabase.co`) for every browser suite. Any blocked-URL list a suite sets later keeps this host, so a suite can never reach production by replacing the list.

On 22 November 2026, the production logs showed about 65,000 anonymous reads a day from HeadlessChrome with the referer `http://127.0.0.1:8000/`. They came from GitHub Actions runners and local runs: 32,288 `lumen_daily_today`, 23,873 `lumen_list_quest_challenges_v2` and 9,087 `lumen_get_historical_performance`.

Set `LUMEN_TEST_ALLOW_PRODUCTION=1` only for a deliberate, documented production check; CI never sets it. `production-isolation-tests.mjs` checks the guard.

Browser shutdown: `scripts/cdp-client.mjs::closeBrowser` extends the exact
Browser.close acknowledgement-timeout policy already used by the sky suite to
the remaining unguarded core suites. The quality runner still owns process
cleanup. `browser-navigation-tests.mjs` executes the actual five suite teardowns
with successful shutdown, missing acknowledgement, an earlier failed business
assertion and unrelated transport/evaluation errors. Four suites reproduced RED
before the correction; unrelated errors and all gameplay assertions remain
blocking. This does not retry or ignore a failed test.

o2switch HTTPS deploy retry (2026-11-14): `python3 scripts/o2switch-https-tests.py` also checks that a TigerProtect refusal exits 75 while every other failure exits 1, that `o2switch-publish-attempt.sh` maps only 0/75 to `published`/`blocked`, and that `deploy-o2switch.yml` retries from at most two fresh runner jobs and fails unless one attempt published.

Public-page release packaging: `python3 scripts/o2switch-deploy-tests.py` runs
disposable Linux publisher fixtures. It checks that the three reviewed privacy
HTML pages are published byte-for-byte with mode 644, unrelated root HTML is
excluded, a forbidden page restores the previous static site, and historical
revisions without those pages remove stale managed copies. The regression was
RED at `d2bc918` (three expected failures); these are static publishing tests,
not evidence of a live account erasure or legal acceptance.

`node scripts/learning-coach-placement-tests.mjs` executes the actual coach
placement function against the 360x640 header/board geometry for quests 1–2.
It retains clear space for help/focus, board cells and actions. The existing
UX browser checks validate actual pointer clicks and modal focus restoration.
The regression also moves the board/header by the measured 54px scroll without
running another frame, verifying that the compact coach follows before a click.

Browser dependency preparation: `node scripts/browser-dependency-tests.mjs`
rejects third-party executable script URLs and checks pinned bundle hashes and
license copies. The account-session browser runner also loads the actual local
SDK and renders a synthetic QR, without live Auth. Worker cache fixtures cover
both vendor assets online/offline. This is not native or Families certification.

## Play preparation and privacy (#170/#316)

Technical retention: `technical-retention-bootstrap.sql` adds catalog-shaped
columns to the disposable fixture; the real migration runs before
`technical-retention.sql` / `technical-retention-readonly.sql`. The initial test
failed for the missing function; local SQL then passed. Tests cover default
read-only preview, confirmation and bounds, API denial, atomic rollback, clock
backdating, reopen/reenable, support holds, disabled clock guards and preserved
progress/receipts/historical evidence/unknown events. Synthetic age setup
temporarily disables only the new date triggers, never erasure guards.
`technical-retention-concurrency.py` is restricted to disposable localhost CI:
it tests concurrent reenabling with SKIP LOCKED and DDL serialization. Native
PostgreSQL 17 results are distinct from local PGlite and production evidence.

The prepared private rights-export migration is exercised by
`scripts/fixtures/account-rights.sql`, `account-rights-readonly.sql`,
`account-rights-erasure.sql` and `account-rights-after-erasure.sql`, after the
erasure migration and its concurrency tests in native PostgreSQL 17 CI.
The export test first failed for the missing function, then passed locally.
Assertions cover read-only stable snapshots, row/source-byte bounds without
truncation, missing actors, actual denial under all API roles, own receipts and
challenges, exclusion of other participants/apps/Auth and push keys, unchanged
source data, and remaining private barriers after erasure. This is disposable
fixture evidence, not a real user request or production deployment.

The preparation report also blocks `children.activationReview` while child
activation is deferred, even with synthetic complete evidence for other fields.
The positive fixture uses an explicitly enabled synthetic parental-process
state; it does not claim any production child account or consent is verified.

`privacy-readiness-tests.mjs` checks the intentionally blocked preparation
manifest, request-mail encoding/injection refusal and no destructive client path.
The account-session browser suite runs `privacy-browser.mjs` at mobile/desktop
sizes: confirmation, prepared mail only, no SDK/mail transport and unchanged
save/attempt. These tests do not execute or certify account deletion.
`analytics-tests.mjs` retains granted-payload parity and adds default-deny,
per-event revocation, permission failure and no optional session/referral storage.

`node scripts/play-readiness.mjs --enforce` is expected to fail until all real
publisher, family, deletion, native-device and Console evidence is supplied.
It is a future publishing prerequisite, not a test to weaken for green CI or a
remote Play Console lock. See [readiness](PLAY_STORE_READINESS.md).
## Temporary private assistance #574

`node scripts/support-tests.mjs` covers closed-schema copies, secrets, consent,
offline/expiry/retries, account changes and revoke/upload races. The existing
independent incident browser runs the support journey at 320×568, 360×640,
390×844 and 844×390 with real pointer input, large text and accessibility checks.
Canonical-ledger CI applies the prepared support migration in disposable
PostgreSQL, then executes `fixtures/support.sql` and `support-concurrency.py`.
Local PGlite and mocked browser RPCs are not live Supabase/physical acceptance.
Run `test-affected.mjs --full`; retain all game/cloud/embedded/catalogue gates.
See [audit, privacy contract and outstanding verification](SUPPORT_574.md).

## Fluid onboarding P1 (#569 / #576)

onboarding-fluid-tests.mjs executes the real victory handler for quests 1–5,
the quest-6 checked/already-unchecked lesson, and scoped preference recreation,
account switches and storage refusal. quest-policy tests preserve the independent
six-visible-quest registration boundary.

The account-ready handoff executes the real `updateAuthUI` and control functions:
pending identity, restored choice, same-owner refresh and account switches preserve
the selected run. `player-favorable-browser.mjs` uses different guest/account choices
and asserts the real checkbox after verified Auth, token refresh and cold reload.

learning-browser-tests.mjs retains the manual quest-1 gestures/intro (and, during that intro, real taps on the signed-out « Se connecter » and the account-switch « Diagnostic », #711), tests optional quest-2 drag with reload and direct
quest-3 navigation; the general browser suites retain rewards, replays, cloud
failure, guest claim, constellation/finale and catalogue-growth regressions.
Changed assertions replace the obsolete mandatory quest-2 lesson/tour contract
with the product decision of 25 October, without changing award eligibility.
Run test-affected.mjs --full, including all embedded runHintTests sizes and strict
catalogue checks. Physical phones, real signup/cloud transfer and screen-reader
acceptance remain separate from isolated Chromium/CDP fixtures.

## Player ergonomics (#555, #552, #566)

`ux-lot-tests.mjs` covers catalogue successors (including inserted quests and
nonconsecutive historical keys), live access refusal, missing/final quests,
challenge/lesson isolation and mutation-free navigation. The mandatory
`ux-lot-browser-tests.mjs` checks hint last-row hit testing and actual touch/mouse
input at 320×568, 360×640, 390×844, 667×375, 844×390 and 1440×900, account-copy
and signup/login modes plus retry from Mon ciel, and keyboard replay navigation.
It uses disposable guest/QA fixtures and disables service-worker installation
only in those layout fixtures; the independent PWA update suite stays mandatory.
Browser emulation does not establish physical-device, live Auth or cross-device
transfer validation. The existing account, touch/drag, cloud, embedded hint and
strict catalogue suites remain required.

## Optional first welcome/story — #532

Discovery (#754) uses `landing-seo-tests.mjs` for reciprocal language metadata,
local links, catalogue counts, social images and the publication lists.
`landing-browser-tests.mjs` checks mobile and desktop layout, language link
focus and campaign attribution from both localized pages. The same browser suite covers the rules and constellation learning guides in both languages at 360, 390 and 1440 px, including their shared artwork and keyboard-focusable language links. `acquisition-tests.mjs`
keeps the existing origin, consent and UTM restrictions.

`node scripts/locale-tests.mjs` covers ordered device languages, explicit and
automatic preferences, restricted storage, missing keys and placeholders, and
number, currency, date and plural formatting, including a partial German fixture.
`node --test scripts/i18n-es-tests.mjs` (#945) checks that the Spanish catalogue has exactly the French keys, the same placeholders and plural shapes, Spanish ¿/¡ punctuation, no French or raw-key leftovers, no string left identical to French outside a reviewed allowlist (units, symbols, identical words), consistent glossary terms, the untranslated protocol value `SUPPRIMER`, and that French/English are unchanged while `es` is offered in the selector.

`node scripts/es-journeys-browser-tests.mjs` (#945, browser gate) runs the main journeys (first launch, tutorial, account creation, challenge received by link, board, rules, account, social, friends, my challenges, circles, badge rules, sky, share, shop, quest review, victory) once in French and once in Spanish at 360 px and 1440 px, and fails on any visible text or accessible label (aria-label, title, placeholder) identical in both runs outside a short allowlist (nicknames, brand, version, numbers and symbols). It also requires no missing-translation warning, no horizontal scroll, language switching that keeps the attempt and the board, and automatic mode on an `es-MX` browser opening in Spanish.

`node scripts/my-space-browser-tests.mjs` (#959, browser gate) checks, at 360, 390 and 1440 px, for guests and signed-in players:
- the header has exactly four actions (sound, share, social, Mon espace) with one colour, one size (≥ 36 px), no colour emoji and an accessible name;
- sound toggles in one gesture;
- Mon espace holds language, help and report, shows the account section only when signed in and makes sign-in primary for guests;
- no first-level text longer than 80 characters, no scrolling, 44 px rows, only one section open at a time;
- a tip opens on tap as a status region inside the screen; Escape closes the tip, then the menu, and focus returns to Mon espace;
- help opens from Mon espace with gestures and timer folded, and focus returns on close;
- the English labels follow the language chosen in Mon espace.

`node --test scripts/beta-feedback-tests.mjs` (#960) checks:
- the report context holds only allowlisted technical fields (version, platform, browser family, screen, locale, quest, adventure, surface, error code, per-tab session id), never the raw user agent;
- error classes (offline, rate limited, message required) and kept drafts whose reference matches the server rule;
- that blocking errors, the quest help and Mon espace offer a report entry, with no floating bubble;
- that the migration is additive.

`node scripts/beta-feedback-browser-tests.mjs` (#960, browser gate) reports during a quest from Mon espace and from the help, at 360 and 390 px, as a guest and signed in. It checks:
- the attempt is paused and then unchanged;
- the draft survives closing;
- a too-short message is refused locally;
- network and rate-limit failures keep the message, and every retry reuses the same reference;
- the confirmation shows the receipt number and the sent payload carries no user agent, token or email;
- Escape returns focus, and the English labels.

`scripts/fixtures/beta-feedback-960.sql` (canonical-ledger CI) checks:
- validation, the allowlisted context and bounded strings;
- idempotent retries and the 10-per-hour limit across devices of one account;
- that legacy kinds still work;
- that guests can report while only `analytics_cockpit` holders read and triage.
`node scripts/onboarding-locale-tests.mjs` checks French and English catalogue parity
and the English copy for the actual pre-action, placement and drag steps. The
coach-placement browser suite runs the English first-open-to-tutorial path from the public game entry point in
an installed-app fixture at 320px and 360px, checking complete text, stable board
geometry, and preserved progress and attempt state.
The welcome browser suite exercises English controls, accessibility and copy at
360px while checking the live board, progress and attempt. The service worker
suite checks that the production module graph includes the welcome, learning and board catalogues in both languages. The locale suite verifies board and rules keys and placeholders against their render sites. The coach-placement browser suite checks localized controls and territory labels, opening and closing help, and preservation of the board, progress and attempt. It also changes the language in both directions during an active lesson while offline, with assertions for DOM identity, saved board and attempt, and the localized lesson and cell label. It then reloads with an English browser preference and verifies that the explicitly selected French mode stays active. The general browser gate uses a French Chrome profile for French wording assertions. The Daily Challenge browser scenario also drives the public game in English at 360 px, covering the dated intro, both boards, weekly recap, share preview and the unchanged official attempt. The ranking browser suite also exercises the English podium and personal row at 360 px while preserving nicknames and the rank supplied by the fixture. Verification wording tests cover mixed singular and plural mistakes in both languages.

The Node quality gate runs `npm run i18n:check` to check the FR/EN catalogue, text review records and newly detected hardcoded copy. The guided-check producer and render functions reject unkeyed copy even when the same string exists in the historical inventory. The mobile Chromium guided-undo scenario changes the language while a conflict is visible and checks the translated title, explanation and accessible Guardian label, the board lock and the unchanged penalty count. `i18n-audit-tests.mjs` verifies that changing French copy makes a review stale, placeholder drift is rejected, and extra occurrences of unkeyed copy fail the comparison. The [maintenance guide](UX_AND_VISUAL_DIRECTION.md#maintaining-the-translations) describes the review and inventory commands. The first-welcome browser suite switches the running game to English and checks My Sky, accessible navigation labels the localized constellation facts, badge rules, quest title, difficulty and account form while preserving the live attempt. The landing suites check the 88 cards, language metadata and localized search in the public directory. The privacy tests check both versions of the public legal pages and the localized deletion form with a captured mail draft. After reviewing changes to both versions, run `node scripts/privacy-readiness-tests.mjs --review-legal-translations` to update their review record. Node tests exercise translated password recovery, offer plurals, Adventure titles, purchase confirmation and achievement copy from the same live quest and performance state. The service worker contract requires the FR/EN catalogues in the offline module graph. The board feedback browser regression switches a visible logical hint to English and back, checks its coordinates and reserved columns, and verifies that the board, target and active attempt are preserved.

`node scripts/first-welcome-tests.mjs` covers fresh/returning/owned contexts,
deep links, denied/unverified presentation storage, exact texts, scene boundaries,
30-second completion, excluded background time and cancellation. It is mandatory
in the Node gate. `first-welcome-browser-tests.mjs` joins the full browser gate:
native Chromium with real DOM/local storage, actual 30-second playback, direct
entry, immediate skip, refresh, Aide replay of a paused existing attempt, keyboard
Escape/focus, 320/360/landscape/1440 geometry, reduced-motion emulation, transcript
and warm offline exit. It compares unchanged live profile, board and attempt bytes
around presentation actions. Existing learning/gesture/hint/cloud regressions stay.
The same suites cover the original local ambient score: mute preference, bounded
audio nodes, unavailable/refused audio and late rejection cleanup in Node;
native user activation, silent welcome, completion/skip cleanup, local mute,
transcript/background pause/resume and a full offline audio render in Chromium.
Rendering verifies a nonzero quiet signal and final fade, not subjective listening
quality. No recording or external audio dependency is introduced.

Physical acceptance remains required: listening volume/timbre on real speakers,
small Android/PWA, actual background/close,
large text and screen reader, guest → account/reconnect, and cold offline startup
under existing service-worker constraints. No physical or live-account result may
be inferred from Chromium fixtures. #532 stays open until this acceptance.

Private recipe follow-up (24 October 2026): `recette-schema-tests.mjs` rejects
external schema dependencies and player-row copying; `historical-rollout-tests.mjs`
covers explicit capability 0 and attested schema isolation without relaxing the
two-Android gate. Both belong to the full Node gate. `sync-cohort-control.sql`
runs after the historical SQL/concurrency fixtures in disposable PostgreSQL and
checks actual authenticated-role denial, public endpoint activation, emergency
stop, immutable authority and duplicate enrollment. Never run those bootstrap
fixtures on a shared project. The optional private-schema SQL smoke and its
limitations are documented in [the runbook](CLOUD_RECOVERY_391.md#private-schema-recipe-and-activation-control-24-october-2026).

Reviewed recovery: `node scripts/approved-device-recovery-tests.mjs` checks
owner/fingerprint/expiry guards, preserved acquisitions, archived originals,
unchanged pending work and safe holds on session/storage/cloud changes. The
account browser runner's `quota-recovery-browser.mjs` executes native storage
and SHA-256 installation with simulated RPC. Physical file selection and real
account recovery need separate confirmation. Never put real exports in CI,
repository sources, public issues or browser fixtures.

## Quest convergence candidate (#522)

`quest-policy-tests.mjs` checks discovery access, preservation of acquired/started
attempts, live assistance controls and milestone timing independently of dormant
numeric state. `quest-policy-browser.mjs` runs twelve real UI cases (390/1440,
visible quests 3/5/6/7/10/11) inside the standard browser suite. Learning tests
exercise quest 2's explicit sky handoff and complete sequential tour before 3.
Account browser cases retain numeric and stable guest solved boards beyond
discovery, with unchanged rewards, the same attempt ID and a paused clock after
reload. Resuming an ordinary restored board requires the real attempt-mask gesture.
`quest-victory-parity-tests.mjs` covers no-hint XP, third autonomous win,
same-run Maîtrise, cooldown, grandfathered rewards and variable future groups.
It also covers durable partial recovery of a protected V2 replay summary while
preserving first-win performance and rejecting unknown badge-field changes.
`quest-parity-matrix-tests.mjs` (#522) compares a historical quest, the latest canonical
quest and an artificial quest appended in a fixture: rewards equal published data for
all quests, same badges/XP/replay/access rules, storage keys only via the adapter.
Authenticated acquired/started replay access remains held beyond discovery
while cloud restoration is incomplete; guests retain their acquired access.
The badge UI regression also reads the actual rules dialog: four badges from
quest 1 and a fifteen-minute qualification cooldown, without obsolete daily locks.
`quest-command-tests.mjs` checks exact V2 receipts, ambiguous/lost responses,
current wallet decreases, account switching and explicit V1 compatibility.
Since #697 it also runs the combined verified read (`lumen_get_quest_command_verified`):
identical refusals (altered facts, solved-only projection, missing receipt or
profile, malformed shape), a single fallback to the two separate reads only
when the endpoint is explicitly missing (PGRST202/404), and no fallback on
a server failure. `canonical-command-client-tests.mjs` proves that a definitive
V2 "no receipt" skips the redundant V1 lookup, while a V1 row still uses the
V1 adapter. In the `canonical-ledger` workflow,
`scripts/fixtures/quest-command-verified-read.sql` checks that the combined
read equals both independent reads, never writes, keeps the account guard
and denies `anon`.
Admin recent-player tests execute the actual metrics/timeline renderers.

Delta profile read (#1000 lot 2): `profile-delta-read-tests.mjs` covers applying the
delta, the digest gate and every fallback; `fixtures/profile-delta-read.sql` checks the
server delta (additions, removals, type changes, unchanged entries omitted), the
account guard and grants.

Digest profile read (#1000): `node --test scripts/profile-digest-read-tests.mjs` covers
`confirmVerifiedProfile`: a matching digest returns a copy of the known profile with
no download; mismatch, malformed answer, error, missing endpoint (remembered), no
profile, no userId or no candidate all keep the full verified read. In
`canonical-ledger`, `scripts/fixtures/profile-digest-read.sql` checks that
`lumen_profile_digest` hashes the exact `lumen_restore_profile` text and its account
guard and grants.

Digest profile CAS: `node --test scripts/profile-digest-cas-tests.mjs` covers the
jsonb text rules, an exact digest (single call, expected profile not uploaded), the
fallback to the full CAS on mismatch, missing endpoint or unexpected answer, a
matched-but-refused conflict, and the existing refusal codes. In `canonical-ledger`,
`scripts/jsonb-digest-fixtures.mjs` generates SQL so that real PostgreSQL checks
the client jsonb text and digest (tricky keys, escapes and numbers, full 880-quest
profile), then `scripts/fixtures/profile-digest-cas.sql` checks mismatch without
write, stale digest refusal, account guard, size guard and grants.
`victory-pending-browser-tests.mjs` asserts profile writes use the digest path.

Profile size ceiling (1 MiB): `scripts/fixtures/profile-size-limit.sql` runs in
`canonical-ledger` after applying `20261115120000_profile_size_limit_1mib.sql` twice.
It checks that no profile function keeps the 512 KiB ceiling, that SECURITY DEFINER
and grants are preserved, that a 700 KB profile is accepted and that 1.1 MB is refused
unchanged; support captures keep their own limit. `local-persistence-contract-tests`
checks the exact client boundary against `MAX_PROFILE_BYTES`.

Cold account recovery (#971): the account-switch browser fixture delays the game entry point, restores an explicit Spanish preference and checks the first visible title, message and sign-out control. It also covers switching to French and recovery in English through an offline reload and reconnection. It opens beta feedback in all three languages and checks the active category and both actions, including a live language change while the dialog is open.

Account switch (#711): `account-switch-browser-tests.mjs` uses `scripts/fixtures/multi-account-browser.mjs` (per-account profiles, receipts and wallet; any RPC naming another account than the session is refused and recorded). With 800 ms per RPC it plays A → sign out → B → sign out → A: B is never shown A's progress during its load (screen held), B gets its own next quest, A's pending victory stays durable under B and is credited to A only, no call targets another account, and a failed B load stays held until « Réessayer » installs B. After an explicit sign-out, the neutral screen covers the app (also after reload), with the sign-in dialog opening above it and nothing erased locally.

Test aids and diagnostics: `node --test scripts/test-tools-tests.mjs` covers the admin adventure-mastery preview (#705: real celebration, no challenge, nothing written, refused during a victory or outside an adventure) and the bounded hydration-failure telemetry (#711: fine reason and stage). `admin-preview-browser-tests.mjs` opens the preview from the admin cockpit at 360×640, 390×844 and 412×915, starting from a previous review's leftover performance state, and requires the real quest board (rank + 3-step podium), the 5 badges and no vertical scroll, with a single CTA and no local or server write. In `canonical-ledger`, `scripts/fixtures/sync-health-stage.sql` checks that a stage from the fixed list is stored and free text becomes unknown.

The `canonical-ledger` PostgreSQL workflow installs the convergence,
social and analytics migrations after the existing wallet migration. Run
`node scripts/quest-command-fixtures.mjs --check` to compare all current server
contracts with the catalogue; its default SQL output exercises every stable-only
quest's first win and grandfathered replay. Receipt fixtures cover atomic
rollback, forged summaries, lost responses, cross-account reads and V1 recovery.
`quest-first-badges.sql` varies a stable fixture's ordinal from 1 to 6 and requires
all four badges and receipt idempotence, retaining the shipped eligibility rule.
`quest-command-concurrency.py` requires `LUMEN_SQL_FIXTURE=1`, local `lumen_test`
and synthetic auth fixtures. It races duplicates, conflicting facts, historical
and canonical victories and spending. Social fixtures preserve hidden reference,
one attempt, guest names, ownership and campaign isolation; analytics fixtures
exclude QA/automation and enforce current admin capabilities.

Embedded disposable PostgreSQL is useful for actual SQL assertions but does not
prove concurrent server sessions. The PostgreSQL CI remains required. None of
these fixtures may run against player data. Schema application and live release
remain separately authorized and verified; Android emulation does not replace
physical Android readability validation for #521.

## Missed short taps — #548

Confirmed reproduction: after correcting the offending Guardian by touching it,
the old `suppressGuidedClickUntil = now + 700` rejected every cell action for
700 ms. Native CDP touch in `guided-undo-browser.mjs` first failed (next valid
cell stayed 0 instead of 1), then passed with gesture-scoped click suppression.
The original correction still occurs once; a fresh pointerdown immediately
releases suppression. Undo and the guided lock remain covered at numeric fixture
indices 6/10.
The shared `gesture-click-suppression.js` also handles the hold's release.

`touch-input-browser.mjs` exercises consecutive native short taps across every
cell, through empty/exclusion/Guardian, at centers and inside borders, including
small movement. It also toggles the actual countdown in both directions and
requires identical board geometry at 320/360/390/768/1440 px. On `3fd1efb`,
showing it moved the board by 16.125 px at 390 px; a native border tap could
then reach the adjacent row. Reserving its space fixes that reproducible path.
Bounded passive event traces exist only in these synthetic browser fixtures.
The general browser uses the shared navigation-generation/complete/diagnostics
guard at startup, matching the learning runner. An early diagnostics object on a
document being replaced cannot satisfy startup; no business assertion is retried.
These checks do not establish the cause of every failure on
Rachel's Android. Concurrent hydration/render loss and device-specific behavior
remain unconfirmed; confirmation on the affected Android/PWA after release is
required. No affected profile/storage is inspected, changed or cleared, and no
gesture telemetry is collected. Physical Android/iOS/Safari remain untested.

## Touch Guardian hold — #531

`long-press-guardian-tests.mjs` uses a deterministic timer for the 500 ms hold,
single activation, short/mouse/keyboard preservation, movement/multitouch/cancel,
guard changes and retargeted release suppression. It also executes the actual
cell handler for direct/normal transitions, undo evidence and locked input.
The performance source regression retains the same assertions while accepting
the handler's new event parameter; painting still stays incremental.

`long-press-guardian-browser.mjs`, in the existing general browser suite, uses
native CDP touch for empty/marked placement, removal, release suppression, single
undo, cancellation, pause during hold and movement handing off to drag. Full
gameplay validation still includes all hints, strict catalogue, first-quest
learning, mouse/tap/drag, cloud and reward checks. These are isolated Chromium
fixtures; no physical Android or iOS/Safari validation is claimed.
The full suite caught the extra help copy overflowing 360×640. The help card now
scrolls within the viewport; `ux-cleanup-tests.mjs` retains the original geometry
assertion and verifies that close/replay actions remain reachable after scrolling.

The initial native pause test exposed a retargeted release: the pause mask is a
sibling of the board, so a board-only click interceptor could not see it. The
regression first failed, then passed after intercepting at document capture and
matching the original pointer identity (or board frame for legacy clicks).
Every fresh pointerdown clears stale suppression; keyboard/programmatic clicks
with detail zero remain available. Event semantics reference:
[Pointer Events click dispatch](https://www.w3.org/TR/pointerevents3/#the-click-auxclick-and-contextmenu-events).

## Optional persistent diagnostics — #534

Mandatory `diagnostic-reporter-tests.mjs`: privacy, deferred capture, offline
reload, denied/corrupt storage, queue/batch/TTL bounds, deduplication, lost replies,
single-flight timeout and account/client success/rejection races. The actual Undo
instrumentation runs under historical clear-fault injection: error → Undo →
blocked → repeated Undo → released in one episode. The unchanged guided-undo
suite remains the positive control for corrected gameplay.

`fixtures/diagnostic-incidents.sql` follows #398 migrations in PostgreSQL CI:
consent default off, closed context/identity, raw and non-admin/guest denial,
idempotence, #533 timeline, minute/global quotas, withdrawal/stale re-opt-in,
retention and synthetic Auth cascade. `diagnostic-concurrency.py` requires the
explicit disposable localhost fixture and checks concurrent duplicate delivery,
daily quota and withdrawal. No profiles are read/changed. Embedded PostgreSQL
is useful local evidence; concurrent PostgreSQL 17 CI remains authoritative.

The account browser suite checks 390/1440 pixels with native storage and synthetic
Auth/RPC: optional choice, secret-bearing ErrorEvent reduced to fixed context,
offline resource event/reload/reconnect, withdrawal and unchanged live profile.
No actual provider, real user, physical Android or affected-phone proof. Run full
client/catalogue/hint, documentation and protected CI gates as applicable.

## Hydration refusal and final-session boundary — #536

The mandatory `cloud-achievements-session-recovery-tests.mjs` now reproduces the
reported event order with synthetic data: actual canonical capture archive,
SIGNED_IN/INITIAL_SESSION (both orders), actual wallet outbox indexed checkpoint,
discordant snapshots and a safe partial hold. It checks wallet versus reward
diagnostics, offline interruption, reconstructed durable adapters on restart,
retry/idempotence, backup/install failures, privacy and unchanged local evidence.
The fallback adapter is in memory; this is not a recording of the affected
player's profiles or proof of real-device IndexedDB behavior.

`cloud-hydration-mirror-session-tests.mjs` executes the production hook and
reproduces account/client switches during successful and failed mirror awaits.
Four assertions fail before the final session guard, while the unchanged-session
positive control passes. Two further RED cases cover mirror promise rejection
after the same account/client switches; the current-session rejection remains
an explicit failure. No obsolete success/failure may be published for the
new session. Both suites run in the complete local quality gate and in CI under Cloud reconciliation matrix.
See [the #536 report](validation/2026-10-23-hydration-536.md); physical Android
and Rachel's actual reward divergence still require separate non-destructive
verification. All prior cloud, wallet, canonical and SQL regressions are retained.

## Guest, guided undo and first-quest badges (#528/#533/#529)

`guest-account-tests.mjs` and `guest-account-hydration-tests.mjs` cover guest ownership, exact backup, registration through the actual UI hydration hook, second-device installation, repeated auth, offline and interrupted verification, account change and existing-cloud preservation. Ambiguous balances retain both copies and hold instead of guessing a transaction. `guided-undo-tests.mjs` executes the actual Undo handler with pending/deferred conflicts; mobile browser smoke additionally exercises real conflict → Undo → new move. `performance-badge-tests.mjs` and embedded tests cover eligibility from quest 1, same-run awards, assistance, qualification cooldown and persisted badges. SQL parity runs the new eligibility migration before comparing current client/server outcomes, while retaining old receipt/wallet regressions. No real player fixtures or production Auth emails are used.

## Session achievement recovery — #530

#723 launch maintenance: `storage-maintenance-tests.mjs` saturates a quota with account-switch copies (with identical duplicates), runs the family-scoped archival, then checks freed space, the two kept distinct copies, one IndexedDB entry per distinct content readable identically, untouched other families and active data, idempotence, a conflicting twin archive that keeps both copies, and the game wiring.

Storage inventory/retention: `node scripts/storage-maintenance-tests.mjs` covers
fixed-category privacy-safe sizes, unavailable stores, independent browser quota,
read-only existing IndexedDB inventory, exact archival, keep-two retention,
idempotence, failed open/write/read/commit, conflicting archives and session,
owner, live-profile and source races. It runs in the full local quality gate and under the required reconciliation check in CI.
The account browser suite exercises the diagnostic and native archival at
390/1440 pixels, using actual mobile touch and scroll visibility at 390. The
quota fixture also archives an old original when real localStorage is full.
Exports retain the existing archived-originals store; VM export regressions cover
both stores and transaction aborts. These disposable fixtures are not proof of
physical-phone recovery or disk capacity. No real player is read or changed.

Quota follow-up: `cloud-achievements-quota-recovery-tests.mjs` covers the shared
durable recovery planner with backup-only quota, failed IndexedDB open/write/read,
installation quota, silent backup/install refusal, account/local changes during
backup, absent fallback, immutable conflicts and idempotent retry. The account
browser suite includes `quota-recovery-browser.mjs`: a disposable blank fixture
fills actual browser localStorage, reproduces the synchronous backup refusal,
then verifies the exact original in native IndexedDB, achievement restoration,
unchanged unconfirmed balances and retry. This storage test uses native modules;
it does not exercise real Auth/RPC or Rachel's physical phone.
The CDP evaluation explicitly awaits the asynchronous recovery and archive read;
an unresolved Promise cannot count as browser storage evidence.

`node scripts/cloud-achievements-session-recovery-tests.mjs` is a mandatory
quality-gate suite. Two business assertions failed on `d5d7484` before the fix:
coverage of a verified canonical badge upgrade, and partial recovery while a
wallet remains unconfirmed. It tests retries/restart, immutable-field and badge
loss refusals, quota/unverified backup, safe diagnostic fields, status text and
the actual UI hydration hook with both SIGNED_IN/INITIAL_SESSION orders. The
canonical capture is archived with the real durable outbox; wallet fallback
uses its asynchronous in-memory adapter, not a real browser IndexedDB database.
No command is resubmitted or intention acknowledged without proof. Readiness
and failure reset require subsequent coherent server state and verified install.
Existing account-session/browser/cloud/wallet/guest-transfer suites remain
required. An additional red/green regression covers account switches during
daily and both reconciliation awaits: an equal game profile cannot authorize
another account's baseline or readiness. The real menu test loads the new status
helper and retains its existing assertions, with additional held-state checks.
Detailed evidence and live-phone limits:
[reproduction report](validation/2026-10-22-achievement-recovery-530.md).

## Private Android validation preview

The [isolated validation preview runbook](ISOLATED_VALIDATION_PREVIEW.md) records
the reusable free private Site, synthetic backend, recipe controls, v1 offline
false-positive and v2 transport guard, actual device results and maintenance
procedure. It links a dated source/evidence archive and identifies future work.
Real browser storage and physical Android UI do not establish live Supabase
Auth/RPC, cross-device cloud or player recovery; retain independent SQL/CI proofs.

## Quest parity and board feedback (#522/#516/#521/#515)

Mandatory Node gates: `board-feedback-tests.mjs` (mutation-only halfway,
restore, terminal state, undo and reset for every size), `group-hint-tests.mjs`
(real visible quest 91, both auto-marking modes, row/column groups of 2/3,
certain action and protected lesson gate), and `quest-definition-tests.mjs`
(published identities/order/membership, variable sizes and N→N+k recovery).
`quest-view-tests.mjs` additionally executes the actual telemetry adapters with
the same stable quest at two numeric frontiers, verifies start-event identity,
nullable unavailable counters, legacy badge compatibility and read-only totals.
It executes the actual Mon ciel refresh callback with mixed stable/numeric
cards, reordered cards, an unknown ID, replaced live progress and a closed map.

`browser-tests.mjs` imports `board-feedback-browser.mjs` to check actual click
handlers and group hints on desktop/mobile, exact preservation of territory
border widths/colors, source/target roles, closing and reduced motion.
Playing the indicated exclusion also clears all hint roles/card while retaining
the same cell DOM nodes.
`board-feedback-tests.mjs` also executes drag release through the same clearing
path, preserving the single undo snapshot and prohibiting a full render.
Screenshots are saved in the system temporary directory. Mobile emulation
does not establish real Android validation. Full in-app tests and strict audits
remain mandatory.
The browser runner additionally opens the real Mon ciel, renders distinct earned
badges for inserted/numeric quests, reorders the cards and invokes its installed
refresh callback. Both viewport runs assert unchanged per-quest badge markup
and unchanged progress.

Onboarding impact: no milestone, cost, badge eligibility or forced lesson
changes in this lot. Group hints teach the same rule with an actionable first
explanation; lesson gating and preserved quest identities are covered. The
wider timing disagreement remains explicit in the audit for contract convergence.

Local combined validation on the branch incorporating main `6dc1a09` is recorded
in [the chantier report](validation/chantier-522-516-521-515.json). It includes
the normalized JavaScript source fingerprint and explicitly separates local
simulations/mobile emulation from real Android, live cloud and Production.

## Source-to-render astronomy fidelity (#508, #504 follow-up)

`node scripts/audit-astronomical-figures.mjs [report.json]` rebuilds every shipped
figure from pinned Western lines and the original import's Hipparcos II inputs,
offline. `astronomical-fidelity-tests.mjs` is mandatory in the Node gate: full
source comparison, corrupt/truncated figures and coverage, invalid coordinates,
and all playable SVG star/segment counts at zero/partial/complete reward states.
These checks do not certify a different atlas convention or a new measurement
of the original Hipparcos input.

The existing sky-navigation browser suite additionally invokes
`astronomical-rendering-browser.mjs`: every real catalogue card and detail at
320x568, 390x844 and 1440x900, all points/segments at exact projected positions,
uniform scale, visible bounds and separate reward totals. A completed synthetic
QA profile makes every constellation accessible; browsing must preserve it.
No real account, remote write, changed quest ID or source geometry is involved.
Mobile screenshots are captured for the Horizons overview and Antlia detail.

## Cards, finale, quest rewards and guest dismissal (#475/#315/#504/#356)

- `sky-navigation-browser-tests.mjs` measures actual text ranges inside every
  card, including 320x568 and enlarged 14/16px labels at 360/390px. It also checks
  actual surplus counts in overview/detail, no crowns and a new light in victory reveal.
- `quest-secondary-stars-tests.mjs` replaces the rejected orbit contract for
  #504: totals 1/4/10/17/31, every earned value, real stars first, secondary lights
  only for a shortfall, no large-figure decoration, immutable atlas geometry,
  each increment visible, no replay duplication, no missing-source substitute,
  deterministic separated positions up to 103 surplus lights, tour/motion checks.
  `node scripts/preview-quest-secondary-stars.mjs` builds the offline interactive
  comparison of secondary stars, dust and nebula before selecting the preferred
  stars. The browser audit blocks provider networking, including QA analytics.
- `browser-tests.mjs` retains teaching-grid tap/drag/PWA tests and invokes
  `finale-responsive-browser.mjs` on the canonical Bouvier finale. Seven actual
  viewport sizes check square cells, no scroll, contained controls and readable
  touch targets. Where CDP supports `setSafeAreaInsetsOverride`, mobile cases
  also exercise actual CSS env top/bottom insets of 18px. The report states
  support explicitly. Emulation does not certify a physical installed PWA.
- `account-session-browser-tests.mjs` repeatedly closes signup/login with both
  dismissal controls and completes a real fixture guest victory to trigger the
  automatic offer. Dismissal preserves achievements and resumes the next quest,
  without Auth calls. All accounts/provider transports are simulated.

Physical affected-phone confirmation remains necessary for #489 and the
installed-PWA recipe in #315; fixture success must not be presented as that proof.

## PWA update and imported-module cache regression

`service-worker-cache-tests.mjs` is mandatory in the Node gate: both HTTP and
resource-cache prevention, explicit offline copies, non-OK response retention,
private/provider request exclusion, cache failure and scoped activation cleanup.
`service-worker-update-browser-tests.mjs` is the ninth mandatory browser suite
(CDP 9232, report `ci-pwa-update.json`). It serves a synthetic module graph with
one-hour HTTP freshness, first installs the actual shipped v9 worker from
`df340a64930254c6697b0f066d35873df0debdcc`, then serves fresh HTML and observes
the stale transitive module. A real warm worker update must install the new
module; a subsequent release with unchanged worker bytes must also load fresh
code. Offline module fallback and unchanged local profile, attempt and IndexedDB
intention are checked. The test fails before the worker fix; no production
account or RPC is involved. This does not establish real-phone recovery or a
fully atomic offline application release. Existing eight browser suites remain.

## Local affected tests (phase 2)

Before marking a PR ready for review, run the applicable checks locally
and group related corrections in one push. See the
[local-first workflow](CI_EFFICIENCY.md#local-first-validation-and-publication-1039).

Requires Node 22+ and Git on PATH. No npm install or third-party test dependency:
`npm run test:affected` aliases `node scripts/test-affected.mjs`.
The application remains static native ES modules, without a build step.

| Command, from repository root | Purpose |
|---|---|
| `npm run test:affected` | Run checks for branch and local changes |
| `npm run test:affected -- --list` | Print paths, selected suites and widening reasons without execution |
| `npm run test:affected -- --base origin/main` | Explicit comparison reference; fetch before starting work |
| `npm run test:full` | Existing quality gate, standalone Node tests absent from that gate, cloud policy check |
| `node scripts/test-affected-tests.mjs` | Native Node tests of selection and real Git change detection |

All options also work with the direct Node command. Detection includes committed
changes since the merge base, staged/unstaged changes and untracked files.
NUL-delimited paths and disabled rename detection retain both rename paths,
including spaces/Unicode. Missing Git/reference/history widens to the full client
suite, never an empty successful selection. It does not fetch refs automatically.

Known persistence, performance, progression/access, attempt and challenge edits
select a broad critical tier: cloud reconciliation/hydration, offline outbox,
badges/assistance, auth, challenges, navigation, progression and cloud policy.
Modified standalone tests run themselves and that tier. The allowlist and filename
families live in `scripts/test-affected.mjs`. New/unknown modules, deleted tests,
UI/shared engine/content, SQL, configuration and tooling widen to the full client
suite. The phase 2 PR itself widens because it changes the selector/package setup.
Clean trees and Markdown-only changes skip runtime checks; still validate
links/contracts and `git diff --check`.

Existing checks mix native `node:test`, standalone `node:assert/strict`, VM/source
contracts, seven CDP browser runners, Python checks and SQL fixtures. Node has no
native affected-import selection for these scripts. Introducing Jest/Vitest would
add dependencies and still miss dynamic source reads and UI/SQL relationships.
The selector reuses existing entry points; `scripts/quality-gate-suites.mjs` shares
the gate's existing Node list to avoid duplicate execution in full mode. The gate
gains the selector and previously un-orchestrated Adventure regression. Actions
workflow files are unchanged.

During corrections, group related fixes and run affected checks. The console shows
suite status/time and at most the final 12,000 error characters on failure; full
output stays in an OS temporary directory. Failed suites do not prevent later
suites from running; any failure yields nonzero exit. Browser reports retain
their existing validation directory. Run full checks before PR and when impact is
uncertain. A targeted pass never waives applicable browser, catalogue, SQL or
isolated-device requirements. Full mode is the **client** battery: it does not
provision PostgreSQL, execute Python/PHP deployment checks or prove live Auth/RLS.

### Audit and regression evidence (2026-10-18)

Reference verified: `main` at `449c7bd` contains phase 1 AGENTS.md and maps. The
[verification map](architecture/test-map.md) remains the domain index. Coverage
means behavior, not measured line/branch percentages. No reliable global coverage
percentage or token/cache measurements were available; none are claimed.

Existing high-risk coverage includes stale snapshots, conflicts/CAS, read-back,
quota, offline retries, account isolation, assistance, same-run badges, challenge
isolation and catalogue growth. Remaining gaps: real provider/session retention,
multi-device network races, installed-PWA storage eviction, cold offline start,
paid entitlement lifecycle and actual SQL authorization. Retain the SQL workflow
and isolated-account matrix; client simulations/source assertions cannot prove
these behaviors. The added regressions call production modules.

| Scenario / command | Added behavior and edge cases |
|---|---|
| `node scripts/performance-qualification-merge-tests.mjs` | CAS succeeds but read-back fails; serialized storage restart recovers verified remote state without another write, changing rewards/balances or discarding recovery evidence |
| `node scripts/performance-badge-tests.mjs` | Award same-run badges, serialize/restore, replay with assistance/errors without qualification: preserve badges, best time/stars, qualification timestamp and balances; now 15 cases |
| `node scripts/unlocked-adventure-progress.test.mjs` | Truly locked versus previously started access; READY/social versus campaign attempt, no browsing mutation, reload, appended canonical quest, reordered metadata, differing pack sizes and empty catalogue |

The Adventure suite failed on untouched `449c7bd`: its "locked" fixture already
contained a solved quest granting started access under `hasPackAccess` and the
preserved contract. The old locked exclusion expectations remain on a truly
unstarted fixture; an explicit started-access assertion covers the original save.
No application source or business rule changed.

All three commands exit 0 on Node 22.22.0 / Windows. Red/green proof used an isolated
temporary copy: each defect below made its suite exit 1, while correct-code
controls exit 0. These are mutation checks, not three new production bugs.

| Temporary defect, never delivered | Observed failure |
|---|---|
| Final compatible-reconciliation write path: replace `const verified=await loadVerifiedProfile(supabase)` with `const verified=updated` | Missing expected rejection on failed read-back |
| `savePerformance`: replace retained `priorBadges` with an empty object | Earned badges become false on nonqualifying replay |
| `hasPackAccess`: remove the `started` contribution | Started-access progress falls from 3/4 to 1/2 |

To repeat: `git worktree add --detach ../lumen-phase2-proof HEAD`, run the three
controls there, introduce one listed defect, run its command and verify nonzero
exit, restore the file, then rerun to green. Never mutate player data or loosen
assertions to make this proof pass.

Initial full-client run: all 85 orchestrated Node suites passed, including strict
catalogue audit and the two newly wired suites. Account-session browser and the
complete embedded hint suite passed before the generic browser runner stopped on
its viewport assertion (375×667, app vertical overflow 3 px). Among 32 supplemental
standalone suites, four failed: `admin-catalogue.test.mjs` and
`generated-adventure-map.test.mjs` expect 34 constellations rather than 40;
`extended-boundary.test.mjs` expects all historical/generated content accessible;
`staged-adventure.test.mjs` expects staging-only access. All four failures and the
identical viewport error were reproduced in an untouched `449c7bd` worktree.
These were the initial failures; their corrections are recorded below. The gate
stops at the browser failure; later runners require separate execution.

Those five remaining runners were then executed through the existing server/CDP
orchestration on dedicated ports: UX cleanup, learning (including real drag and
reload), late-game progression/recovery, sky navigation/access and canonical
badge replay all passed. Together with account-session browser, six of seven
runners pass locally; the generic runner retains its baseline viewport failure.

Timing observations: initial gate 57.8 s, including historical engine equivalence
25.3 s, account-session browser 9.0 s and generic browser 7.8 s before failure.
Most critical Node suites took roughly 0.1–0.3 s. These single observations are not
benchmarks. Cloud matrices overlap policy/source assertions with behavior tests;
retain them for distinct failure paths. Avoid duplicate gate/supplemental Node
runs, without removing browser/SQL coverage. General Actions work remains phase 3.

The actual CLI was also exercised with a temporary whitespace-only change in
`src/persistence/cloud-profile.js`: `node scripts/test-affected.mjs --base HEAD`
selected 59 critical checks, all passed, then the file was restored byte for byte.
Plan checks verified clean HEAD → no runtime checks, absent reference → full
fallback, and the PR branch → full mode for tooling/setup changes. Generated
untracked validation reports also widen conservatively; archive/clean those
reports before the next iteration to avoid an unnecessary full rerun.

### Follow-up: four obsolete standalone suites corrected

All four suites were rerun on `7434c5d` and exited 1 before edits. The causes were
confirmed against the product access contract and Git history, without changing
application code, content, save keys or entitlement rules:

| Suite | Correction and retained protection |
|---|---|
| `admin-catalogue.test.mjs` | Compare complete pack/constellation identities and numeric quest coverage with the owning registry/manifest. Include canonical reservations without fabricating numeric save keys; retain generated quest identities and difficulty checks. Reserved constellations were registered in `f1abdfe` (#399). |
| `generated-adventure-map.test.mjs` | Include base, generated and reserved constellations; check map membership, historical pack/index anchors, locked default, ownership and retained started access. No replacement of 34 with another fixed total. |
| `extended-boundary.test.mjs` | Separate the catalogue boundary from fresh-player access. Test restored started history, generated entitlement, locked gaps and all-pack ownership. Preserve the frozen historical completion cases and variable-size metadata fixture; see `PROGRESSION.md`, Adventures and access. |
| `staged-adventure.test.mjs` | Distinguish immutable snapshot provenance (`staging-only`) from current map registration (`e7bbc93`, #199) and playable bridge (#203). Retain historical indices and audit checks; verify every generated playable ID, audited solution and locked default. |

Run each with `node scripts/<suite>`: all four now exit 0 (nine native test cases).
Each corrected suite was also run against one deliberate defect in an isolated
copy: omitted admin reservation, omitted map reservations, bypassed locked access,
or changed generated save ID. Controls exit 0; all four defects yield exit 1.
This checks that updating obsolete expectations retained meaningful regressions.

The four suites are now in `quality-gate-suites.mjs`, so existing GitHub CI executes
them before browser checks; full mode no longer repeats them as standalone tests.
They also belong to the affected critical tier (now 63 checks). A selector
regression first failed because known content/persistence edits omitted these
neighbors; after extending the filename families, all four native selector tests
pass and a content edit selects all 63 checks.
`node scripts/test-affected.mjs --full` was rerun: all 89 gate Node suites and all
28 supplemental Node suites pass, as does the cloud policy check. Local full mode
still exits 1 solely on the previously reproduced Edge viewport overflow (3 px at
375×667); account-session browser and embedded hint checks pass before that
failure. The other five browser runners passed earlier on unchanged application
code and were not repeated. The final PR records CI results for the new commit.

## Account modes and session transitions

`node scripts/account-session-modes-tests.mjs` covers startup read/login races, stale deferred work after sign-out, recovery subscription before verification, failed confirmation preserving a session, local-scope logout, and removal of OTP entry points. `account-email-login-tests.mjs` now checks password/Google/guest and recovery; `auth-mail-otp-tests.mjs` retains the mail failure/throttle/branding cases and intentionally replaces retired OTP-length cases with rejection of magic-link login. These run in the quality gate with existing cloud regression suites.

The session modes suite also executes the real mobile menu renderer for pending, restored-account and confirmed-guest states, preserving the recovery flag while pending. The account-session browser suite delays startup session restoration on mobile and desktop and checks that clicking the disabled action cannot initiate authentication or logout before restoration completes. This covers a premature sign-in invitation, not loss of real device credentials.

Before release, validate Google/password login and reload on an isolated account, recovery through password creation, guest discovery, and an existing account with cloud history. Never impersonate a real player's session or clear their local cache to test restoration. Affected-device session persistence is an outstanding manual check unless explicitly verified; production reads and mocked tests do not establish that result.

## Dynamic catalogue growth regression contract

`campaign-presentation-tests.mjs` reproduces four presentation failures against
the pre-fix UI: canonical-only cards reading zero historical stars, a prior
Rapidité missing from victory rewards, Grand Chien 8/10 labelled final, and the
numeric endpoint ending an incomplete canonical campaign. The actual adapter and
renderers are exercised, plus empty/variable-size/growing catalogue fixtures.
`catalogue-access-tests.mjs` checks independent entry to owned Antlia for both
historical and current cohorts, within-Adventure prerequisites and serialization without
reward mutation. These are synthetic tests, not affected-account evidence.

Owned Adventure entry (#783): `scripts/owned-adventure-access-tests.mjs` covers
Adventures 4/6 without earlier progress, own-Adventure sequencing, denied unowned
direct entry, runtime bounds, delayed/error rights, account/request ordering and
unchanged save bytes. `scripts/owned-adventure-browser-tests.mjs` uses synthetic
authenticated RPCs on a mobile viewport: delayed-rights labels, actual map starts
and reload restoration for each Adventure. No real purchase is made. Acceptance
still requires a confirmed Sandbox purchase on a real device, logout/login and a
second device with the same account; check saved progression, badges and records.

`campaign-resume-browser-tests.mjs` checks zero/nonzero totals, partial versus
completed Dauphin/Petit Cheval cards, full illumination, mobile/desktop refresh
and unchanged progress/attempt bytes. `canonical-replay-browser-tests.mjs` checks
a previously held Rapidité remains visible with « déjà obtenu » and no duplicate
star. `late-game-browser-tests.mjs` rejects the old numeric endgame and plays the
actual catalogue's final board through its victory CTA and endgame summary on
mobile/desktop. This replaces the obsolete numeric-finale expectation while
retaining capped-save, 100→101, reload and reward regressions. Browser Auth/RPC
fixtures remain simulated; they do not prove a reported phone is repaired.

Onboarding impact: quest 2 retains its explicit Mon ciel handoff; the eligibility
milestones, assistance and badge teaching rules do not change. Finale terminology
now follows canonical membership without changing reward rules or saved data.
Every change affecting content, progression, shop, sky navigation or saved state must test catalogue growth without source-code boundary edits:
- Existing catalogue N → N+k quests, with multiple appended Adventures of different sizes.
- First and final quest of each Adventure, crossing pack boundaries, and visible locked/unlocked packs.
- New constellations with varying quest counts and calculated stars; navigation/pagination beyond the first page.
- Previously complete cloud/local player resume into newly appended content without loss of badges, stars, currency or entitlements.
- Historical fixed quest numbers remain test fixtures only, not current campaign endpoints.
Tests should assert relationships derived from the content registry rather than a specific future total. Documentation alone is not proof of runtime coverage.

The ranking guard assertions in `scripts/fixtures/official-time.sql` require the
fixed #962 reason for an absent run, invalid counters, a hint-flag mismatch, a
versioned assistance mismatch and a changed replay. The same fixture verifies
one confirmed score, the original receipt and an unchanged player snapshot.
## Daily Challenge notification enrollment (#1032)

`daily-push-ui-tests.mjs` verifies explicit browser permission, the separate
device registration, account change, dismissal, disabled rollout, expiry and
the fixed deep link using synthetic browser APIs. `daily-push-dispatch-tests.mjs`
covers job authorization, provider eligibility, expiry, failure and dispatch
deduplication without contacting providers. The Daily Challenge journey
continues to exercise the ordinary experience while the rollout is unavailable.
See [the delivery checklist](DAILY_PUSH_1032.md#étapes-de-livraison) for physical
device acceptance and publication requirements.

## Foreground refresh and background releases

`app-updates-tests.mjs` covers first installation, public metadata validation,
the five-minute check, foreground checks, deferred reload and OAuth protection.
`service-worker-update-browser-tests.mjs` verifies an identical-worker release
in a retained Chromium tab, deferral while busy and preservation of local
progress, the attempt and the pending IndexedDB intent through an offline reload.
`daily-challenge-browser.mjs` simulates an expired Paris day with the server
mocked and asserts the header switches from played to available in the same page.

## Cloud persistence regression matrix

Critical alert tests run the production migration against disposable PostgreSQL and simulate interrupted transport, replayed observations, one affected account and unauthorized acknowledgements. The public probe test also rejects maintenance HTML with HTTP 200.

The [admin activity mail tests](OBSERVABILITY_946.md#configuration-et-recette-opérateur) cover deduplication and role grants in disposable PostgreSQL and capture mail with a simulated provider.

Review navigation (#796) uses `play-review-navigation-tests.mjs` for catalogue,
normal guard preservation, stale account responses and attempt backup.
`play-review-navigation-browser-tests.mjs` exercises Mon ciel on a mobile
viewport with synthetic Auth, entitlements and victory receipts.
`scripts/fixtures/play-review-navigation.sql` checks the real RPC, table
privileges, audit history, expiry, revocation and the account erasure policy
in disposable PostgreSQL. The [Android checklist](../android/TESTING.md#recette-du-compte-de-revue-play-796)
covers acceptance on a Play-installed build.

Signup confirmation (#814) is exercised by `account-email-login-tests.mjs`
and the account-session browser suite on mobile and desktop. Mail responses are
synthetic. The suite covers delayed acceptance, duplicate clicks and mode changes,
provider and network failures, HTTP 429, and the successful notice with spam
guidance. It verifies unchanged guest progress and checks that the screen fits
without adding scroll. The auth-mail endpoint tests retain their rate-limit and
provider rejection cases. No live e-mail is sent by these checks.

### Chantier #806

Les suites `offline-wallet-ui-tests.mjs`, `hint-assistance-badge-regression-tests.mjs`
et `official-time-browser-tests.mjs` vérifient le compte des aides, le chrono
officiel, les records à la reprise et les badges. Les scénarios navigateur
hors ligne vérifient l’absence de nouvelles dépenses à la reconnexion.
Le scénario Wallet d’`account-session-browser-tests.mjs` vérifie qu’une demande
historique reste récupérable par son reçu après redémarrage. Conserver la
matrice #801 et les suites Wallet/SQL.

Sur Android (Chrome et application installée), iOS (Safari et écran d’accueil)
et ordinateur (souris et clavier), effectuer les vérifications suivantes.

1. Ouvrir une quête existante, effectuer deux indices et deux vérifications,
   puis répéter hors ligne. Chaque action ajoute sa pénalité une fois.
   Recharger, reprendre et résoudre. Comparer le temps et les badges après
   connexion sur un deuxième appareil. Garder intactes les données du Chrome
   historique de #801 et vérifier les reçus en attente avec le diagnostic.
2. Glisser à partir d’un rond rouge en traversant d’autres ronds, un Gardien
   et des cases vides. Seuls les ronds disparaissent. Annuler restaure tout
   le glissé. Retoucher un Gardien le retire. Vérifier aussi le marquage depuis
   une case vide et la leçon de glissé en quête 2.
3. Rejouer le scénario Android 806-4A sur Toucan, quête 641 (8 × 8), avec
   Contrôle guidé activé. Provoquer une impasse, puis tester aussi un indice
   long. Le panneau commence au bord inférieur de la grille. Les cases
   restent visibles et la grille garde sa taille et sa position. Les
   commandes sont masquées pendant la lecture et utilisables après
   « J’ai compris ». Tester aussi en paysage et avec la police agrandie.
   Seul le texte du panneau défile. Vérifier la fermeture au toucher et au
   clavier, puis les pénalités +5 s et +15 s.
4. Terminer une quête avec de nouveaux badges, puis la rejouer pendant le
   délai de qualification. Vérifier le rang, le record et la raison du refus
   du classement, avec et sans podium. Refaire avec le réseau lent et la
   réduction des mouvements. Vérifier la lisibilité des textes et l’accès
   aux boutons à 320 px et avec le zoom.

### Historical Chrome hydration (#801)

`guest-account-hydration-tests.mjs` runs the actual hydration hook with a
synthetic digest CAS enforcing Wallet authority. It checks an ownerless
historical save, exact archived bytes, compatible signed-in recovery, daily
history refusal, a Wallet command refusal without full-CAS fallback, a competing
debit, restart and repeated hydration. `account-switch-browser-tests.mjs`
opens the real UI in Chrome with synthetic Auth and RPCs and covers both a
fresh storage profile and a historical profile against the Wallet guard.
Wallet command and outbox suites retain their existing receipt and replay
checks. Production data and migrations are outside these tests.

The same suite simulates the `lumen_reconcile_acquisitions` server contract
for the +665 diagnostic: divergent `shards` and `daily`, empty outboxes,
achievements recovered, wallet and daily unchanged, no client CAS, reload
without a second recovery. It also covers a concurrent spend (one controlled
retry), a refused (`22023`) or unavailable recovery (everything preserved) and
an ownerless cache with an account cursor (never merged).

### E-mail links, recovery and installed app (#820, #832)

`auth-link-recovery-tests.mjs` covers native and branded link verdicts, expired,
reused, malformed and network failures, the recovery request contract (200 with
and without `{ok:true}`, 429, 5xx, network, invalid address) and password
update classification. `pwa-first-open-tests.mjs` covers eligibility, the
existing-data guard, the confirmed new adventure and the iOS guest warning.
The same suite covers the recovery screen state machine (`ui/password-recovery.js`):
mismatch, double submission, network failure then retry, provider rules,
expired session, account change, missing session and no password in state.
In Chrome, `account-session-browser-tests.mjs` checks the sign-up verdict,
an expired branded link, a native error redirect and the recovery screen
(dedicated dialog, reload, mismatch, first network failure then success,
readable verdict without reload).
`install-request-browser-tests.mjs` checks the iPhone guest warning and the
installed app's first opening, with an emulated iPhone user agent. WebKit and
a real home-screen app are not exercised: Chrome cannot reproduce iOS storage
separation, and no live e-mail is sent.

Manual acceptance (dedicated QA account, no personal data in reports):

1. PC Chrome, historical #801 profile, storage intact: sign in. The game opens
   with its quests, badges, XP and records, without « Historique à vérifier ».
   Reload, sign out/in, compare on a second device. Diagnostics show
   `guest_acquisitions_recovered` once.
2. iPhone Safari, guest with a few quests: open the install sheet. The
   warning appears and installing stays possible. Install, open the app:
   the « J’ai déjà joué » screen appears instead of quest 1.
3. Same iPhone: create an account in Safari, wait for « Progression
   synchronisée », open the app, choose « J’ai déjà joué », sign in. Progress
   matches Safari. Reopen the app: no repeat of the choice.
4. Android Chrome and installed app: same as 2–3. The storage is normally
   shared, so the choice may not appear when progress exists.
5. Sign-up link (branded and native): « Adresse e-mail confirmée ! Ton compte
   Lumen est prêt. », action matching the session. Reopen the same link:
   « Ce lien n’est plus valide », never a success.
6. Forgotten password: request, receive the e-mail (inbox/spam), open the link
   on PC and Android, set a 12+ character password. The new password signs in,
   the old one is refused, progress and purchases are unchanged. Repeat with
   an unknown address (same message), five quick requests (rate-limit
   message) and an older link (expired message).

After the approved web release, confirm the deployed version in the account
menu on the original Chrome profile. Keep localStorage and IndexedDB intact.
Sign in to the same account and verify that the game opens with its existing
quests, badges, XP, records, rewards, wallet and purchased access. Compare on
a second device, then reload and sign out/in on the original profile. Confirm
that the wallet and unlocked content stay consistent, including after any
already queued command is resolved. For a hold, open « Diagnostic » and record
only the app version, stage, fixed reason and result. Keep the original storage
and use the existing recovery procedure for any unverified historical data.

Play prices P1 (#729/#731/#786): `node scripts/play-billing-tests.mjs` mocks Digital
Goods and Payment Request for nine SKUs, reordering, missing/empty/failed details,
invalid amounts/currencies, unavailable service, delayed loading, successful retry,
payment support and timeout. It executes the production screen's price wiring and
offer DOM to verify refresh/CTA states, hidden sky offer after a unit purchase,
unchanged progress and no purchase on price loading. Chrome outside the TWA and
Stripe exclusion remain covered. `adventure-offer-tests.mjs`,
`stripe-checkout-client-tests.mjs`, `sales-terms-tests.mjs` and
`android/tools/packaging.test.mjs` retain adjacent contracts. These are mocks/source
checks, not Play Console or physical-device evidence. The no-transaction manual
recipe and native/Web delivery distinction are in [android/PLAY.md](../android/PLAY.md).
`quest-review-browser-tests.mjs` additionally exercises the real offer DOM with
synthetic Play loading, failure, retry and enabled prices at 360×640 and 1440×900,
without opening a payment sheet. Its existing review checks also cover 320/390px.

Competition #638 / marking retirement #647: `ranking-client-tests.mjs` covers
durable offline/reload staging, counters, account/client changes, begin/finish
races, withdrawal and quota. `manual-marking-tests.mjs` checks stale preferences
and the live engine injection independently of historical solver simulation.
For #775 the client regression also exercises an older `22023` refusal before
an independent first score and reload: only the rejected capture remains.
`quest-review-tests.mjs` checks partial flush confirmation, reconnect while the
current result is pending, and a non-qualification notice surviving refresh.
`hint-assistance-badge-regression-tests.mjs` checks counted-run isolation from
a previous UI hint flag and preservation of old unversioned hint evidence.
These are synthetic client tests, not a live publication of a player's score.
`ranking-browser-tests.mjs` covers 320/390/1440px, actual retired controls, the
production list animation, top-10/centered/boundary fixtures, virtual labels,
new-record visibility and reduced motion. Synthetic RPC fixtures are not live
account or physical-device acceptance. `fixtures/ranking.sql` exercises the
real migration/APIs in disposable PostgreSQL: receipt admission, +5/+15,
frozen cooldown, privacy/grants and withdrawal. `ranking-concurrency.py` checks
simultaneous device starts/finishes in CI. Existing full `runHintTests`, strict
catalogue/proof audit and cloud matrix remain mandatory.

Sky-return navigation: `sky-return-tests.mjs` tests the actual map opener and
stable-identity precedence across variable catalogue sizes and multiple skies;
`sky-return-browser-tests.mjs` opens a real board in every Adventure, browses
elsewhere, returns from the header and from a replay victory, and verifies the
adventure/constellation/page plus unchanged progression and attempt identity.

`cloud-reset-browser-tests.mjs` exercises the full authenticated hydration,
automatic reload and real grid-card opening after a 200-grid epoch change.
Both ordinary storage and backup-only Web Storage quota with native IndexedDB
must retain the exact original (including old wins), install the reset, reach
ready and open a grid without granting a new victory. Async owner/session/cache
changes and archive refusal are covered by `cloud-quest-reset-tests.mjs`.

Support sizing: `node scripts/support-tests.mjs` constructs the full current
catalogue projection with two synthetic checkpoints. The current projection
must remain complete, optional copies must fit the server's spaced/decimal
`jsonb::text` limit including later incident/counter metadata, and all source
bytes must remain unchanged. Compact-only and exponent cases cross the limit;
the real validator is exercised independently in disposable `fixtures/support.sql`.
No production fixture or real-account upload is implied by these tests.

Support #776: the same Node suite now requires explicit confirmation of a
manual filtered preview; reconnect and automatic incidents cannot approve it.
`support-browser.mjs` (via `incident-investigation-browser-tests.mjs`) covers the
native controls, server-acknowledged receipt and exact private reference lookup.
`fixtures/support-reference.sql` runs after the new migration twice in isolated
ledger CI: older case identity, admin/expired capability, foreign owner, unknown
reference, hash, audit, revocation and retention. No production migration or
physical-phone delivery is claimed. See the acceptance checklist in SUPPORT_574.

`node scripts/cloud-pending-victory-tests.mjs` exercises production result
retry functions and the bounded scheduler with real durable outboxes and
synthetic command confirmation. Canonical and historical results recover while
open; transient failures preserve operation identity, Auth/review holds prevent
resends, account changes during inspection and simultaneous online/timer wakes
cannot authorize a stale or concurrent command. An obsolete client inspection
cannot hold the current result's retry lock. Dirty profiles, active writes,
reset attempts, hidden/offline and recovery sessions stay held. Existing ledger
and historical command suites retain exact receipt/current-profile checks.
The diagnostic assertion admits only existing fixed incident vocabulary, never
provider text or payload. These simulations do not prove physical-device or
live-account recovery; reproduce the affected pending victory after deployment.

### Lumen-only erasure (#316, prepared migration)

Current-schema extension: `fixtures/privacy-current-schema.sql` runs after the
real main migration chain, including #593. It covers private audit attribution,
expired cases, rollback of copies and saves, rights export without third-party
operator/reference fields, erased-UID and delayed-upload refusals, real support
revocation preserving saves, unknown audits and changed guard arguments.
`privacy-optional-support.sql` checks absence and partial-schema refusal inside
a disposable rollback. `privacy-support-concurrency.py` uses distinct PostgreSQL
connections for support/erasure lock ordering and duplicate erasure. Historical
#526 fixtures run separately in `lumen_privacy_test`; current-schema fixtures and
existing command concurrency remain in `lumen_test`. No production fixtures.

Legal-page candidates: `privacy-browser.mjs` loads the actual HTML pages at
390/1440 px, opening `mentions-legales.html` / `confidentialite.html` independently
without SDK/login/scripts, verifies viewport fit, visible candidate status,
the rights-request link and unchanged save/attempt. The existing mailto checks
and real local-library checks remain. Rendering does not certify legal content
or production publication; the preparation evidence fields remain unverified.

`canonical-ledger.yml` adds `account-erasure-bootstrap.sql`, real migration
`20261022160212_lumen_account_erasure.sql`, `account-erasure.sql` and
`account-erasure-concurrency.py` after the actual snapshot/ledger/wallet
regressions on disposable PostgreSQL **17**. No provider connection, real
identity or paid database. The extra fixture schema fails if reused.

All 26 owned data tables are seeded. Assertions cover erasure, social sender
anonymization, other participants, shared Auth/other-app preservation, rule
retention, explicit confirmation, missing/shared actors, contradictory keys,
schema/guard drift, mid-deletion rollback, retry, anonymous/cache resurrection,
an incoming cross-application cascade rejected before any deletion,
old JWTs on every guarded table and the real backup RPC. Anon/player/service
roles have no private access. Repeatable-read writes fail closed. Separate
Python connections cover both lock orders: erasure commits before a blocked
old writer, and an in-flight write commits before the locked erasure review.
The existing canonical/legacy/wallet concurrency suites run again with new
synthetic accounts after guard installation, preserving normal players' command
receipts, exact balances and restore behavior.

The initial pre-migration assertion failed on the missing Lumen-only function.
Local PGlite 0.5.11 / PostgreSQL 18.6 checks synthetic SQL and the actual migration
chain; it does not replace PostgreSQL 17 concurrency CI, provider retention,
parental verification or future native-device erasure. Production application
and `accountDeletionEndToEnd` remain separate gates. See the deletion runbook.
Celestial UI: `celestial-ux-tests.mjs` covers variable/reordered/growing catalogue
membership, distinct completion/mastery, empty denominators, explicit historical
badges, input immutability and deterministic continuous dust. The native
`celestial-ux-browser.mjs` extends the sky navigation runner: first real
constellation/Adventure wins, one scene, skip by hit-tested input, keyboard focus,
locked following Adventure, reload silence, unchanged rewards on navigation and
reduced motion. Screens: 320×568, 360×640, 390×844, 844×390 and desktop. It saves
0/25/50/75/100% comparisons for small/large/additional-light constellations under
`docs/validation/milky-way-*.png`; restored mastery must be static and original
astronomical/secondary lights remain intact. The late-game runner asserts a
single global finale with the full-catalogue recap and preserved historical
award. Auth/RPC and QA data are synthetic; physical Android, screen readers and
real cross-device acceptance remain separate.

Ownership-handoff presentation: `player-favorable-browser.mjs` asserts the
actual active quest identity, rendered label and grid immediately after restore,
before any map interaction, then again after reload. Virgin and first-gesture
devices use simulated Auth/RPC and retain original archives and exact balances.
Same-owner token refresh preserves the selected board/run. The production hook
fixture checks handoff once, readiness without document restart, and no handoff
when a new account is seeded from guest progress. `campaign-resume-tests.mjs`
covers numeric and inserted canonical frontiers, unavailable content and social,
QA and unverified-session guards. Learning rules and gestures are unchanged;
the restored quest uses the existing board/tutorial initialization.

Same-owner historical frontier: a native synthetic browser restores an owned
READY canonical catch-up board while numeric acquisitions already reach a later
Adventure. Assert the later origin frontier, matching grid/label, exact original
attempt archive and unchanged cloud/balance without a map visit. The existing
same-owner test now supplies an actual started/paused run rather than an idle
placeholder and retains its board/run assertions. Helper tests keep started,
paused, replay, nonempty and already-correct selections; a failed archive must
not lock the hydrated account. Hydration-hook fixtures retain their existing
session/mirror assertions while stubbing this separately tested UI selection.

Historical acquisition seed compatibility: `quest-victory-parity-tests.mjs`
guards verified unversioned first-performance copies, original archival and
idempotent retry. Divergent times/assistance, added badges or unknown fields,
unsupported versions, changed first rewards, existing local runs, missing
authority and Wallet conflicts remain refused. The real hydration hook in
`cloud-achievements-session-recovery-tests.mjs` installs once and reaches readiness
after the ordinary reload without another recovery RPC or victory. These use
synthetic data; affected-device confirmation remains separate.

Virgin-browser restoration: `guest-account-tests.mjs` and the actual UI hook in
`guest-account-hydration-tests.mjs` cover an unowned starter with three shards and
the current catalogue against an existing historical account, including a zero
or spent cloud balance. Retain guest originals and assert no profile write,
initialization, reward or wallet change on restore/reload. Real guest acquisitions,
spending, performances and unknown evidence must still require coverage.
`player-favorable-browser.mjs` now clears the synthetic device's local storage,
including owner identity, and restores from the realistic starter reserve. This
replaces the insufficient fixture that retained the owner and omitted currency.
Native browser checks use simulated Auth/RPC; a real private-window login remains
separate acceptance evidence.

Guest first-gesture regression: the actual `ensureAttemptStarted` producer runs
before the extracted hydration hook in `guest-account-hydration-tests.mjs`.
Assert restoration despite start-only timestamps, exact guest and active-board
archives, unchanged cloud cooldown/rewards/wallet, and refusal on failed attempt
backup. The helper matrix rejects completed results, extra/unknown fields,
malformed dates and mismatched indices. `campaign-resume-tests.mjs` retains
canonical start-archive coverage of the shared classifier.
`player-favorable-browser.mjs` additionally boots a signed-out virgin device,
uses a native mouse gesture to start the quest, then signs in through the actual
Auth callback and checks profile/attempt archives and unchanged mock cloud.

`cockpit-dates-tests.mjs` also guards visual status: recent confirmed/pending/
failure observations, missing/invalid/future dates, receipt-only evidence and an
old second-device observation. No stale signal becomes green. Native cockpit
browser tests cover badges/text, closed date details with all prior evidence
retained, qualified state filters and five viewport widths without overflow.

The registered-player suite also covers exact account/email joins, blank
nicknames, email search with/without a nickname, case/whitespace/accents, missing
metadata and source immutability. The loader fixture verifies email delivery to
the renderer. `cockpit-browser.mjs` mounts the real cockpit HTML, verifies email
fallback/search, every section's native disclosure, keyboard collapse of quest
friction and retained content/filters. Five viewports include 320 px and mobile
landscape; no live RPC or physical-device validation is implied.

`cockpit-registered-players-tests.mjs` verifies registered-only directory
projection without source mutation or nickname heuristics, its bound, and no
anonymous timeline RPC. The controller fixture covers metadata filtering and
clearing a previously anonymous selection; the independent cockpit browser
asserts the same directory boundary at all five existing viewports.

Player-favorable hydration (#391, 25 October 2026):
`cloud-player-favorable-tests.mjs` covers preserved originals, expected-account
read-back, bounded CAS races, response loss, restart/second-device restoration,
missing migration and storage/session interruption. The production hydration hook
is executed by `cloud-achievements-session-recovery-tests.mjs`, including automatic
readiness without reload, preserved pending Wallet intent and scheduled flush.
The actual UI backoff definition is also executed: lost reply, intervening read
outage, bounded repeated failures, account switch, active play and offline wake.
The existing conservative suites remain intact; an unavailable recovery endpoint
still exposes their previous protected holds.

`fixtures/player-favorable-acquisitions.sql` runs with real RPCs and projection
guards after the Quest migrations in `ledger-sql`: complementary acquisitions,
one-sided badges, immutable first evidence, best run, no synthesized Mastery,
unknown fields, unchanged confirmed spending/cursors/receipts, repeated import
and subsequent command replay. `acquisition-recovery-concurrency.py` verifies
parallel recovery and a duplicate spend on disposable PostgreSQL 17. Native
browser coverage uses synthetic Auth/RPC; installed Android/PWA and physical
second-device acceptance remain separate, unverified release criteria.

`node scripts/cockpit-acceptance-tests.mjs` verifies administrator-to-administrator
scope clearing, rejected/stale timeline responses and separate activity/Auth/
commit dates during resumed synchronization. Acceptance evidence and untested
physical scenarios: `docs/validation/2026-10-25-cockpit-534.md`. All prior cockpit,
incident browser and PostgreSQL tests remain required.

Cockpit sessions #534: `node scripts/cockpit-sessions-tests.mjs` covers bounded
chronological grouping, missing identities and separate diagnostic correlation.
The independent incident browser now also runs `cockpit-browser.mjs` at five
viewports, with native keyboard, expansion/filter/refresh, capability clearing,
empty views, nested reviewed reports and accessibility-tree checks. Its RPCs
are synthetic; physical phone and screen reader remain separate acceptance.
`fixtures/cockpit-sessions.sql` tests the actual RPC in isolated PostgreSQL:
non-admin/expired capability, shared-browser account separation and closed data.

Cockpit #534: `node scripts/cockpit-dates-tests.mjs` checks independent date
sources, persistent-session Auth, missing signals, timezone/UTC/age and stale
account results. `scripts/fixtures/cockpit-dates.sql` is required in the isolated
ledger CI; never execute fixtures against production. It verifies capability
expiry, Lumen account scope, immutable receipt dates and multi-device pending.

Historical recreated-capture recovery: `canonical-durable-outbox-tests.mjs`
reproduces a committed 37-second run with a later 41-second local copy and a
`22023` review pause. It verifies archival without resending for a covered copy
created either before or after the better server receipt. It rejects improved
times and changed flags even on an older capture, wrong identity/owner, missing
projected attempts/badges, denied archival and account changes. The real UI
reconnect regression also preserves the server profile, receipt and local view
while retiring an older slower copy through reads and verified archival only.
This intentionally replaces the former older-capture rejection: chronology
alone cannot override an exact same-operation receipt proving a better result.
Run the historical client,
canonical outbox, storage/export, hydration and full affected suites as well.
Phone recovery remains a separate acceptance check. Onboarding impact: none;
no rule, reward, assistance or navigation destination changes.

Historical/rollout preparation: `historical-rollout-tests.mjs` covers byte-level
inventory and unknown fields, foreign owners, ambiguous balances, immutable
account-bound guest manifests, denied storage, lost replies and receipt reads,
independent receipt/profile verification, session changes and strictly scoped
old-server fallback. It also refuses mocked/stale/shared-production rollout
proofs and premature retirement. The read-only RPC inventory also checks exact Wallet receipt/request coverage,
expected owner and stable before/after projection, without mutation or ack.
The account browser suite adds `historical-claim-browser.mjs` with native localStorage and Web Crypto; Auth/RPC
remain synthetic. It preserves its originals and exercises a restarted adapter,
lost reply/read, exactly one effect and the read-only inventory.

`historical-claim-rollout.sql` exercises the actual additive migration in the
disposable CI PostgreSQL database: expected account, private tables, anonymous
refusal, exact immutable receipts, no merge into an existing account, rollback
on receipt failure, durable administrative activation and forbidden downgrade.
`guest-claim-concurrency.py` checks simultaneous identical retries and competing
owners in localhost-only fixture mode. These are not live Supabase or Android
tests. Run `node scripts/test-affected.mjs --full` before delivery; retain all
prior guest, Wallet, badge, quota and recovery regressions.


Lot 3: `gameplay-domain-tests.mjs` covers both quest identities, the direct
historical start guard (both reproduced failing before correction),
navigation from a pending success to another replay without dropping the old
intention (also reproduced failing before correction), expected
account/client/generation/password scope, unknown/reward/storage refusals, free
versus paid help, pending replay presentation without a new star or confirmed
badge, and confirmed-cache read-back/races. Legacy UI regressions also check an
unsupported command server during a hold, immutable facts across readiness retry,
and durable capture even while a capability network response would remain pending,
and a generation change after commit without local installation or a second
reward. The native account browser suite runs `domain-replay-browser.mjs`:
verified Wallet conflict, actual map starts for stable/historical acquired replay,
free and refused paid hint, solved boards with pending rewards, immutable intents
through document restart and preserved balance/unknown fields. The original
initial-hydration replay hold remains tested. Auth/RPC are synthetic; no phone
recovery or production data is inferred. Full in-app hints, strict catalogue and
all prior cloud/Wallet/badge suites remain mandatory.


Lot 2: `persistence-coordinator-tests.mjs` is required by the quality gate.
It covers one-account serialization, rejected responses, queued work after
account/client/generation/logout changes, immutable capture, mutation-free shadow
inspection, shared lock naming and owner-bound cache installation. The account
generation is also rechecked after asynchronous acknowledgement inspection;
its regression fails before the facade injects the guard. The account
browser suite also runs `transactional-command-cache-browser.mjs`: native
IndexedDB paired capture, an actual aborted write transaction, conflict rollback,
restart before/after acknowledgement, unknown-field preservation, owner isolation,
stale-install refusal, version-1 old-client opening, and native Web Locks across
two same-origin browsing contexts. These are disposable fixtures, not live Auth,
production SQL or physical Android recovery evidence. Existing command receipt,
Wallet, quota and guest tests remain required.


Lot 1: local-persistence-contract-tests.mjs covers verified save/refusal, silent
failure, unavailable reads, exact quarantine, failed backups, changed source,
unsupported origins and UTF-8/JSONB sizing. cloud-hydration-generation-tests.mjs
executes the production hook with late rejected restores under account/client/
generation/logout changes and a same-session control. Both suites are required
in the quality gate. Existing mirror/session assertions remain enabled; their VM
fixtures now supply the real generation state. Native quota browser coverage
also verifies a malformed original is archived before replacement. No fixture
uses production data. Physical Android/live Auth and SQL remain separate evidence.


Quota continuation (#536/#537): `storage-maintenance-tests.mjs` reproduces
`achievement_install` failure with retained old backups, verified archival and
one installation retry; aborted archive commits preserve the active original.
`cloud-wallet-quota-recovery-tests.mjs` checks both original copies, exact receipt
coverage, repeat recovery, unavailable/failed storage, silent write refusal and
session/owner/local changes. The native account quota fixture now requires a
larger achievement projection, committed archival and receipted wallet recovery
at the actual localStorage quota. It uses a disposable origin and synthetic
profiles, never a real player account. Real-device recovery remains separate.

Phase-2 diagnostic investigation (#534): `incident-investigation-tests.mjs`
checks ordered #533 episodes, session isolation, partial-window semantics,
closed report export/GitHub drafts, grouped alerts and the actual cockpit loader's
capability/account race guard. `incident-investigation-browser-tests.mjs` runs
`incident-investigation-browser.mjs` in a dedicated Chrome process at 390/1440,
with native rendering, state filters, explicit
review/revocation and stale-action refusal. It creates no GitHub issue and reads
no real accounts. Existing collection/privacy/SQL tests remain mandatory.

The report-review browser fixture opens the episode, checks that its checkbox
is visible/unchecked, then uses real CDP mouse press/release and bounded state
waits. A second click must revoke the URL. It retains hidden-before-review,
privacy/filter/capability assertions; it never assigns a passing checked state.
This replaces a synchronous scripted click inside a closed details element
that failed `reviewEnabled` in main CI after a green PR. A real-pointer run then
observed the host disappear during a preceding recovery reload. The helper now
navigates to `scripts/fixtures/incident-investigation.html`, waits for its ready
marker and imports the actual renderer with the real CSS, without starting
Auth/cloud/game code. Earlier recovery tests remain unchanged. The publication
gate correctly blocked the failed main run.

The same-tab isolation in #549 still failed fixture readiness on main
`39950073600`. The report now has its own mandatory tenth browser suite (CDP
9235, `ci-incident-investigation.json`), with a fresh browser/profile and blocked
Supabase/GitHub traffic. It never starts the game, Auth or a service worker;
its ready-marker failure includes only pathname/state/game/marker flags.
The nine prior suites and all their recovery assertions stay mandatory. The
quality runner clears the tenth report before execution too. Validate with
`LUMEN_BROWSER_WORKERS=2` as used by CI, not only the serial default.

Completed quest presentation (#537): `campaign-presentation-tests.mjs` executes
the actual detail/catalogue renderers with a minimal DOM. It distinguishes
completed history from a replay action hold across Auth, hydration, unsupported
origin, serialized restored copies and missing rights/prerequisites. The
catalogue-access suite checks every published stable quest's standalone completed
evidence without granting new rights. `completed-quest-hold-browser.mjs`, included
in the account browser suite, uses native modules and browser storage with
synthetic Auth/RPC for mobile touch during a delayed restore and verified replay.
No real-player profile is read or changed; physical Android and Loutre's actual
account state remain separate field validation.

### P0 integration: wallet, pending victories and observations (22 October 2026)

PR CI must not mutate the catalogue it verifies. The issue-222 generator retains
its audit and downloadable artifact, with read-only repository permission and
no automatic branch commit/push. `issue-222-runtime-tests.mjs` guards that
boundary; `catalogue-compatibility-tests.mjs` still verifies all immutable quest
identities and ordinals. A generator-triggered ordinal rewrite was caught during
this lot and reverted to the already validated catalogue, without a new revision.

The mandatory Node gate includes `cloud-daily-session-tests.mjs`,
`cloud-wallet-command-tests.mjs`, `cloud-wallet-reconciliation-tests.mjs`,
`cloud-pending-navigation-tests.mjs`, `cloud-sync-presentation-tests.mjs`,
`cloud-victory-notification-tests.mjs` and `cloud-outbox-health-tests.mjs`.
They cover account/client/logout races, exact receipts after lost responses,
first-activation cache recovery, refusal of unrelated/unknown local data,
currency decreases, preserved originals, all four presentation states,
non-modal transient failures and bounded private telemetry under quota.

`wallet-flow-browser.mjs` extends the existing account browser suite with actual
pointer actions, native modules and real IndexedDB/localStorage: lost debit reply,
missing receipt then restart, same paid hint sequence, two offline wins,
pending-star presentation, next-quest navigation and recovery. Its Auth/RPC
transport is synthetic; this does not replace PostgreSQL or Android validation.

The SQL gate adds the two prepared migrations and
`wallet-command-receipts.sql` / `outbox-health-observations.sql`. Assertions cover
exactly one debit, altered evidence, expected account, stale snapshots/cursor
removal, atomic rollback, daily deduplication, historical-command compatibility,
private access, incident age, late packets, stable alert keys and retention.
`wallet-command-concurrency.py` uses the explicitly guarded disposable localhost
  database; duplicate requests, distinct competing spends and insufficient funds
  cannot overdraw the wallet.

Legacy tests that expected a maximum shard balance now assert a protected hold,
unchanged cloud and retained local evidence. Independent achievement, XP, daily
and performance merge cases remain covered. Hint grant tests execute all grant
branches, including server-confirmed spending, rather than counting source text.

Release gates are `quality`, `ledger-sql`, `reconciliation`, `docs-consistency`
and `cloud-contract` on the reviewed PR SHA. They must be required by branch
protection; running workflows alone does not enforce that. Android installed-PWA,
multi-device field validation and the specific Loutre recipe remain separate
manual exit evidence. No production fixtures or real-player repair are authorized
by a green test run.

Victory challenges (#511): the existing social UI Node suite executes the real
renderer's first-win/replay/Mastery/support matrix. The canonical replay browser
suite imports `victory-challenge-browser.mjs`: mobile/desktop first victories
with/without Mastery, old solved saves without performance metadata, actual
pointer activation, one simulated RPC for repeated activation, exact historical
grid identity and unchanged confirmed rewards. Canonical-only first victories
show the agreed disabled action and explanation; no server migration is involved.

Mon ciel (#513/#514): `sky-issue-513-514-browser.mjs`, invoked by the existing
sky suite, measures selected chips and complete labels at 320/360/390/430/1440px,
focus retention, keyboard navigation, native touch scrolling, RTL, long labels,
page overflow and the existing reopen destination. Antlia, Delphinus and Orion
are checked empty/partial/complete at mobile/desktop sizes, with genuine points
and segments, earned lights and unchanged progress. Antlia at seven completions
is captured in `validation/issue513-antlia-partial-390.png`; tabs are captured in
`validation/issue514-tabs-390.png`. All profiles are synthetic; provider traffic is
blocked. The affected phone's #470 recipe was separately confirmed by the user
on 22 October 2026; no device version was supplied with that confirmation.

Session-readable/quota regression: `account-session-browser-tests.mjs` now uses
actual browser localStorage for its synthetic Auth session and models the SDK's
default writable-probe failure. With a readable existing session, the real UI
must remain signed in after reload, including mobile. This failed before the
explicit SDK storage option; recovery, explicit logout, account changes and
isolated command recovery remain covered. The transport is simulated; this
mandatory test does not exercise a production Auth service or prove a particular
phone is repaired. A separate isolated local check with the real public SDK
2.118.0 reproduced default-versus-explicit storage behavior with synthetic
sessions and all provider requests blocked. It is not a required network fetch
in CI. No token/credential fixture is copied from a real user.

`cloud-profile-tests.mjs` also reproduces lost server codes during CAS wrapping.
Known legacy/canonical/catalogue guard messages become fixed diagnostic codes;
other SQLSTATE/PostgREST codes remain bounded, unknown shapes become
`CLOUD_WRITE_REFUSED`, a codeless transport failure (`Failed to fetch`, `Load failed`, abort/timeout) becomes `CLOUD_NETWORK` (#697), and a false CAS result becomes `CLOUD_CAS_CONFLICT`.
Fixtures assert one refused RPC, no fallback/retry and no provider message,
details, hint or cause leaking into the diagnostic error. These tests verify
observability only, not the cause or recovery of a particular player refusal.


`node scripts/cloud-profile-transitions-tests.mjs` runs 56 synthetic transition
and producer-classification checks. Eight new hydration assertions fail before
the tutorial coverage/routing fix: seen flags must survive a covering-cloud
restore and local-dominant achievements must reach the compatible policy.
Two additional failing assertions require initial coverage to retain unknown local
fields and hold explicit score-schema differences before installation.
The matrix combines four flags, absent/zero/older/current command revisions,
both device directions, second-device installation, V2/V3 summaries, retries,
CAS/read-back failures, invalid shapes and protected command refusal with an
unchanged pending intent. It checks detected JS/SQL fields against the shared
contract and runs guest victory output across the actual catalogue.

This gate runs in the full local quality gate and under Cloud reconciliation matrix in CI.
Its RPC/storage fixtures and bounded source scanners do not replace real SQL,
real Auth/account-switch/PWA coverage or production-device confirmation. The
mock projection guard tests client refusal handling, not PostgreSQL equivalence.
Existing reward, outbox, account and SQL regressions remain required.


Grand Chien/Dauphin resume: `campaign-resume-tests.mjs` verifies boundary selection,
no redirect of running/paused attempts, stable-ID restoration, exclusions and
verified account-switch backups. The additional mandatory
The same browser suite checks Dauphin in the shared quest grid: exact stable-ID membership, standard card dimensions against Grand Chien on mobile/desktop, current/locked states, four earned badge slots, matching constellation drawing/count, and all detail panels contained in the sheet. It checks refresh, overview, return to Grand Chien, and the periodic cooldown refresh without overwriting canonical badges; browsing preserves the live board, progress and attempt. Canonical replay browser tests use the same quest grid for the six added constellations.

`campaign-resume-browser-tests.mjs` exercises authenticated mobile startup at the
completed numeric boundary, the actual Next handler, reload of the started
canonical attempt and a second account. Profiles/RPCs are synthetic; no player
save or production write is used. That delivery added the eighth browser suite;
the PWA update suite above brought it to nine; independent incident review now
brings the current quality gate to ten.
Learning navigation/reload uses the shared `navigateAndWait` document-epoch
check; readiness of the previous page cannot satisfy the next viewport's setup.

Catalogue access (#470): mandatory Node gates `catalogue-access-tests.mjs`,
`catalogue-origin-cloud-tests.mjs` and `catalogue-compatibility-tests.mjs` cover the failing A/B regression, existing and
wholly new constellations, incomplete adventures, local ordering, repeated
additive waves, renumbering, replay, pack/auth/cloud refusals, the actual UI start
adapter, and all current quests with a new-player save/reload after each victory.
The frozen origin manifest must match published content, retain prior identities,
save keys and puzzle hashes, and have a matching additive server revision.
`fixtures/catalogue-origin.sql` runs after the existing real ledger fixtures in
disposable PostgreSQL 17: empty/new versus historical cohorts, old backup/CAS
refusal, immutable markers, unknown origins and unaffected preferences/spending.
`catalogue-origin-fixtures.mjs` additionally generates SQL from the published
metadata to verify the actual server default and acceptance of every archived
cohort, so a future revision cannot pass with a stale server default.
Never run these fixtures against player data. Synthetic fixtures are not proof
of deployment or resolution on an affected mobile account.

Historical migration: `legacy-command-client-tests.mjs` is a mandatory Node gate
for exact receipt/current projection, lost replies, account changes, no duplicate
reward, namespace isolation and existing hint/badge/challenge rules.
It also executes the actual background scheduler with a durable historical
intention during verified partial hydration: one receipt, unchanged local bytes
and in-memory profile, no snapshot writer/reload, account/client/active-attempt
holds, shared replay lock, lost response, auth pause and clean-ready recovery.
Both reconciliation paths reproduce the actual structured server authority
refusal and retain the two recovery snapshots without a fallback write.
The account-session browser suite covers this refusal-to-partial-recovery flow
on mobile and desktop, followed by canonical and historical command recovery,
lost historical response, persistent auth hold and verified token-refresh resume.
It also solves an accessible historical board with a blocked baseline, clicks
its actual save-retry button and follows fresh authenticated hydration. The
simulated server retains profile and exact receipts across reloads; assertions
require one additional command, identical facts/operation identity and one
counted attempt on both mobile and desktop. Quest identity comes from the live
accessible board, not an assumed diagnostic jump past campaign prerequisites.
The client suite covers not-ready/stale-baseline retries and account, client or
attempt-reset changes during asynchronous resumption.
Its transaction transport is simulated; PostgreSQL guards remain covered by the
existing real-SQL suite. These tests do not prove an affected phone is repaired
or reconstruct ambiguous pre-command achievements.
The same client suite reproduces hydration blocked on `legacyVictoryRevision`
with an absent/older local cursor and a local tutorial acknowledgement. It checks
exact server revision and rewards, preserved local/remote backups, verified
installation and idempotence; newer/invalid cursors and unknown fields stay
blocked. Concurrent CAS refusal and failed read-back retain local data. These
storage/RPC simulations do not establish recovery on an affected phone.
`legacy-command-fixtures.mjs --check` verifies the SQL rule seed against catalogue
modules. The SQL workflow generates first-win cases for every historical quest
and replay/assistance/cooldown variants, comparing actual PostgreSQL outcomes and
profiles with JavaScript rule application. Daily metadata is excluded from that
parity comparison and has dedicated real-SQL server-day/streak assertions.
`fixtures/legacy-command-receipts.sql` covers atomic receipt/daily/mirror rollback,
daily reward, reset identity, altered evidence, user scope, privileges, retired
backup/CAS and legitimate spends. `legacy-command-concurrency.py` covers concurrent
duplicates, distinct runs, altered facts and racing stale backup. These fixtures
also cover refusal of cumulative-XP loss while legitimate shard spending remains
allowed. Catalogue seed checks combine migration seeds chronologically: generate
future catalogue changes in a new CLI-created migration, never edit applied SQL.
These fixtures require disposable PostgreSQL only, never player data. Local mock results do not
establish SQL behavior or production deployment; require the real SQL CI result.

Canonical command receipts: `canonical-command-client-tests.mjs` is a mandatory
Node gate. It reproduces the previously missing operation identity and covers
exact receipt verification, lost responses, solved-without-receipt rejection,
changed evidence, V1 compatibility, old-server capability detection, no downgrade
after ambiguous errors, requested badges and account switches across async reads.
The client and real SQL fixtures also require the expected account to match the
server's authenticated ID, rejecting a late SDK token switch and null/mismatched
receipt owners before any mutation or lookup.
The account-session browser scenario uses simulated protocol-1 RPCs with real
IndexedDB on mobile/desktop; the operation ID must reach the receipt.
The `Canonical ledger SQL regression` workflow applies the real additive migration
and `fixtures/canonical-command-receipts.sql` in disposable PostgreSQL 17, then
`canonical-command-concurrency.py`: original receipt/current profile, modified
evidence refusal, auth isolation/privileges, transaction rollback on receipt-write
failure, duplicate/different/conflicting concurrent commands and one quest grant.
The concurrency runner requires explicit fixture mode and a fixed localhost
`lumen_test` database without Supabase `auth.sessions`. Never run these fixtures
against player data. Local client tests do not establish actual SQL behavior;
require the PostgreSQL CI result before approval. Production migration application,
advisors and post-application verification are separate from simulated transport.

Durable recovery (#391): `canonical-outbox-recovery-tests.mjs`,
`canonical-durable-outbox-tests.mjs`, `canonical-retry-state-tests.mjs` and `cloud-retry-scheduler-tests.mjs` are
mandatory Node gates. They cover independent recovery after refusal, requested
badge verification, async adapters, immutable per-run records, old V1 records,
storage failure, account isolation and retry cancellation/backoff. The existing
canonical replay browser runner also tests real IndexedDB after a new document,
denied localStorage and a preserved corrupt V1 entry. See
[delivery scope and remaining cutover](CLOUD_RECOVERY_391.md); these checks do
not establish legacy transaction authority or actual player recovery.

`canonical-retry-state-tests.mjs` covers structured status/code classification,
verified read-back after returned errors and thrown lost responses, persistent
auth/review holds after restart, V1 compatibility, unchanged evidence, account
isolation, same-quest order, independent recovery, transient retries, corrupt
metadata and failure to persist a pause. Auth refresh requires a verified read
and matching user/client after asynchronous work; an auth event or a failed
read cannot release the hold. Explicit retry resets policy metadata only.
The canonical replay browser runner also verifies a refusal hold across a real
IndexedDB/new-document restart with localStorage denied, zero automatic ledger
calls while held, and successful explicit retry without changing evidence.

Additional recovery regressions cover simultaneous online/timer signals during
asynchronous enumeration, releasing the guard after a read error, incomplete
storage inspection followed by restored access, and account cancellation before
the queued microtask starts. Each regression was observed failing before its fix.

Isolated ledger replay uses `canonical-outbox-recovery-tests.mjs` for the actual
UI policy and replay functions, and `account-session-browser-tests.mjs` for
hydration through verified legacy conflict to an acknowledged queued victory.
The browser uses simulated Auth/RPC and real localStorage/IndexedDB at mobile
and desktop sizes. Assert byte-for-byte local preservation, no legacy snapshot
upload, no reload loop, retained global sync failure, and one server grant.
Account/client changes, password recovery, unverified restore, active play,
offline/hidden state and in-flight profile writes must still hold recovery.
Its auth-refusal scenario additionally checks the visible session-renewal status,
no retry on repeated online events, then verified read and replay after a simulated
`TOKEN_REFRESHED`, with one first-completion grant, unchanged local progress and
the global legacy conflict still visible.

Canonical replay (#453): `node scripts/canonical-ledger-client-tests.mjs` covers
both final Grande Ourse quests through the gameplay ledger transport, including
lost acknowledgements, stale solved-only replies, durable outbox retention and
unchanged first-completion rewards. The `Canonical ledger SQL regression`
workflow executes both real migrations and the replay fixtures in disposable
PostgreSQL; it verifies badge-only updates, imported pre-ledger completions,
idempotence, account isolation and no mastery assembled across different runs.
Never execute these bootstrap/fixture scripts against a player database.

Snapshot replacement (#391): the SQL workflow also executes the actual legacy
backup/CAS RPC migrations, `20261017180841_protect_canonical_snapshot.sql` and
`scripts/fixtures/canonical-snapshot-guard.sql`. It tests stale CAS, destructive
matching CAS, legacy overwrite, badge removal, altered first rewards, malformed
state, valid spends/revocations, badge upgrades, no double reward and account
isolation. Without the guard, the fixture fails with `destructive CAS accepted`.

Mobile account diagnostics: scripts/cloud-diagnostics-tests.mjs also verifies
that the account menu exposes the report without a victory/admin gate, and runs
the actual display/copy helpers for successful, denied and missing clipboards.
The report remains readable for manual copy. These VM checks do not replace the
installed-phone check or diagnose a particular player's reconciliation failure.

Diagnostic channel independence (#398): `scripts/cloud-diagnostics-tests.mjs`
executes the production recorder with quota, denied storage, corrupt diagnostic
history, health-counter and console failures. Each fault must still send the
privacy-limited authenticated health event. Guest/QA/event guards remain tested.

**Release-blocking contract (#248).** For every feature, assess the impact on *all* existing cloud-saved data, not only new fields. Before declaring a change ready, cover the affected cases below with automated tests. Keep a separate isolated test Supabase environment/accounts; never run destructive fixtures against real players. Mark unautomated cases explicitly as outstanding: documenting them does not count as a passing test.

| Scenario | Required assertion |
|---|---|
| Account A on device 1 → device 2 | Same completed quests, constellation progress, stars, badges, Éclats, skills and Adventure entitlements |
| Cache cleared / PWA reinstalled | Every acknowledged cloud achievement and purchased right is restored |
| Old local snapshot reintroduced | Cloud progress is never rolled back by stale local state |
| Network interrupted, retry and duplicate request | Pending state is distinguishable; idempotent writes cause no lost or duplicate grants |
| Concurrent tabs/devices | Deterministic reconciliation with no duplicate rewards, no lost progress |
| Guest account registration / linking | Existing cloud and local achievements are preserved without duplicates |
| Paid skill or pack purchase + webhook replay | Server confirms purchase exactly once and restores right after sign-in on other device |
| Spend, refund or entitlement revoke | Valid changes propagate and remain auditable; no naive max merge |
| Old save format / new schema | Backward-compatible restore/migration without losing existing fields |
| Lumen and SoldeZen shared Supabase | Authorization/RLS and ownership keep accounts and application records isolated |

All new saved fields require round-trip, reload, restore, migration and conflict tests. Run the existing persistence/regression tests too. A PR failing these required checks cannot merge. See `AGENTS.md` and [DATA_AND_ARCHITECTURE](DATA_AND_ARCHITECTURE.md#cloud-persistence-contract).

Run `node scripts/performance-qualification-merge-tests.mjs` for qualification cooldown reconciliation. It reproduces the quest 183 `lastQualifiedAt` conflict in both device orders, checks midnight/legacy/null/offset metadata, unchanged achievements and balances, stale-cloud coverage, idempotent retry, verified recovery snapshots, concurrent CAS refusal and read-back failure. Invalid dates and contradictory run/reward evidence must remain blocked. This suite is included in the unified quality gate.

The same performance reconciliation suite also covers known V2/V3 format compatibility, repeated same-version replays, both device orders, conservative attempt/star summaries, stale restore prevention, retained historical mastery, no mastery assembled from separate badge flags, unsupported versions and invalid counters. The previous expectation that a different valid cumulative `attempts` count must block is intentionally replaced: `savePerformance` increments that aggregate on replay. Conflicting per-run/receipt evidence still blocks. A passing synthetic regression does not establish recovery of a real player account.

## Mandatory rule
After **every modification affecting LUMEN code, gameplay or a product feature**, update the automated test contract in the same change and run the complete applicable test battery before delivery. This has two inseparable goals:
- **non-regression**: existing behavior that must remain stable stays covered; when an intentional product change invalidates an old assertion, adapt that assertion explicitly rather than simply deleting or bypassing it;
- **feature coverage**: add tests for the new behavior itself, including its important edge cases, persistence/reload semantics and interactions with existing features.

For gameplay, board, progression or catalogue changes, also run the strict grid audit. Do this even for changes that appear purely visual if they touch board DOM/input/state. A feature is not complete when its implementation exists but its test contract still describes the previous behavior.

## Browser regression suite
The app exposes `await window.runHintTests()`; current cases live in
`src/testing/hint-tests.js`. The original extraction had 66 cases and #38 added
three UX regressions; later additions/intentional changes are guarded by
`module-structure-tests.mjs`. The narrative assertion reads the rules modal.
`window.lumenDiagnostics.runAllHintTests()` runs the current suite for every
catalogue size, sequentially and awaiting victory/reveal behavior. Coverage includes:
- PWA install timing and standalone behavior;
- sharing/referral and account/profile behavior;
- reminder opt-in rules;
- continuous sequential progression;
- catalogue-driven campaign size, constellation mapping and exact per-constellation/total star rewards;
- cell cycle;
- guided conflicts and solver use;
- N x N board rendering;
- mobile drag exclusions, including the #805 real Chrome swipe, a stationary tap whose pointer release remains uncancelled, and one-step undo in `ux-lot-browser-tests.mjs` (since HeadlessChrome 157 a synthesized CDP drag loses its page `touchend`, so one neutral tap outside the board resets the synthetic gesture before the asserted tap; real-device Android check: tap a Guardian right after a swipe);
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

The gate also runs `node scripts/late-game-tests.mjs` and the isolated-browser `node scripts/late-game-browser-tests.mjs <report-path>`. They cover quest 100 → 101, unsolved-quest locking, replay, the actual campaign boundary, cloud restoration with extended histories, the normal celebration CTA on mobile/desktop, reward preservation, reload of quest 101 and restoration of its active attempt.

On 2026-10-04, against main `57c958e` plus the continuation fix, these dedicated checks pass. The complete embedded suite was executed for 5x5, 6x6, 7x7 and 8x8: 96/98 cases pass per size, with the existing 100 quests / 12 constellations and exactly 150 sky stars assertions failing after #94. The strict catalogue audit and difficulty/campaign/content-architecture gates also fail on the expansion's existing count, historical-data and finale contracts. These assertions remain intact; the unified gate is not green. Reports are `quest100-transition.json`, `quest100-embedded.json` and `quest100-node.json` under `docs/validation/`.

The subsequent CI repair replaces those fixed-total assertions with cross-checks of the content model, contiguous schedule, unique puzzle references and exact rewards for every constellation. Catalogue growth must automatically affect loading, cloud restore, final-quest detection, registry IDs, shared result cards and sky totals. Campaign tests retain the immutable first-100 schedule and rewards, historical save comparisons and Q81–100 difficulty contract; that historic Orion finale is distinct from the current campaign endpoint. Additional fixtures simulate appending 1, 2, 3 and 10 quests with different constellation star counts, verifying updated boundaries, IDs, rewards and recovery of previously capped saves without changing actual catalogue data.

Repair validation: all 17 Node gates and all four browser runners pass in the unified gate. The actual embedded suite passes 98/98 cases on each of 5x5, 6x6, 7x7 and 8x8 (392 cases); touch cycle/drag, reset, reload, PWA, UX and learning suites pass. The late-game browser runner also restores a capped pre-final save, completes the actual final quest and verifies the full sky and endgame celebration on mobile/desktop. Reports are `docs/validation/dynamic-catalogue-{audit,browser,ux,learning,late-game,summary}` (JSON). These are isolated local guest tests and simulated cloud fixtures, not live OAuth or Production verification.

Use Node 22+ and Chrome/Chromium. No npm install or application build is needed. The same command is used locally and by GitHub Actions:

```powershell
node scripts/quality-gate.mjs
```

The orchestrator runs every current Node gate, starts its own static HTTP server, launches isolated temporary browser profiles for browser/UX/learning suites, writes the usual reports under `docs/validation/`, and closes only the server/browser processes it started. On Windows it auto-detects Chrome or Edge; on Linux it looks for Chromium/Chrome. Set `LUMEN_CHROME_BIN` when the browser lives elsewhere. Any failing suite returns a non-zero exit code with a timing/status summary.

## Reproducible modular-refactor checks

Historical reproducibility — the October 2026 extraction baseline. Commands still
describe differential checks against immutable commits; the counts in this section
belong to those recorded runs. Use the current entry points above for today's
browser suite and catalogue. Never replace current totals with 69/79-case snapshots.

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
- any qualifying run (first win or replay outside the 15-minute cooldown) can challenge; a run inside the cooldown cannot and explains the wait (#889);
- the reference states « Première résolution » / « Rejeu qualifiant »; a replay is never sent as `p_first_play=true`;
- a started challenge resumes with its own time in the same browser, at the server-measured elapsed time elsewhere, or is refused without proof (#888);
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
- RPC idempotency/concurrency and RLS/direct-write boundaries;
- the recipient plays the exact challenged grid, including a locked Adventure, without gaining access to it;
- a finished link reopens on its result (lowercase server status), never on a second attempt;
- “Mes défis” shows canonical visible quest numbers for historical, stable and revised challenges.

#908 Abandon: `abandon-attempt-908-tests.mjs` covers the window from the start (T+1 / T+15), the latest of victory and start, per-player isolation, pruning, corrupt or denied storage, reload, the terminal abandon, server demotion only (never promotion, never for challenges), FR/EN copy per mode and the game-screen wiring. `abandon-attempt-browser-tests.mjs` (390 / 1440) plays a real canonical replay: before the first move, cancel and Escape, confirm then Mon Ciel on the constellation, a replay inside the window (non-qualifying, no badge), reload, then expiry at T+16.

#921 In-game confirmations: `lumen-dialog-tests.mjs` forbids any native `alert`/`confirm`/`prompt` in the game sources, checks the wiring of every confirmation (grid reset, friend removal, QA reset, abandon) and the FR/EN copy, which keeps the consequences explicit. `lumen-dialog-browser-tests.mjs` (360×640 FR, 390×844 EN, 1440×900 FR) opens the grid reset after a real tap: Lumen copy, `alertdialog`, safe default focus, Tab trapped, ≥44 px targets, no scroll; Cancel, Escape, backdrop and Back (`history.back()`) keep the marks and the attempt; confirming clears only the marks and keeps the run, its time, aids and qualification; no native dialog is opened. Physical Android/iOS Back is manual acceptance.
#925 Menu pause: `menu-pause-tests.mjs` drives the real attempt engine with a fake clock: one pause and one resume per menu session, no time counted while open and none lost, chained menus and a loading menu (`hold`) keep the pause, an already paused grid or a backgrounded app never resumes, another attempt is never resumed. `menu-pause-browser-tests.mjs` (360×640, 1440×900) opens Social, Account, Help (Escape), Report and Share during a running quest: paused state, frozen `activeDuration`, opaque inert mask covering the board, one resume on close; chained Help → Account samples never expose the grid; manual pause, background and the Abandonner dialog are covered. Physical Android Back, lock screen and network resume are manual acceptance.

#708 Lot D: `analytics-versions-tests.mjs` (rates with exposure, small samples never flagged, unknown version, unavailable source, escaping); `scripts/fixtures/admin-version-health-708.sql` in canonical-ledger CI (access, per-version hydrations/failures/blocked/players/waiting devices, period window, ordering, no identifier, bounds); `analytics-admin-browser-tests.mjs` checks the release comparison in Synchronisation & incidents.

#708 Lot C: `analytics-engagement-tests.mjs` (missing data never shown as 0, rates only with a denominator and n, « Non mesurable » while public collection is disabled, unavailable source, escaping, EN copy); `scripts/fixtures/admin-engagement-708.sql` in canonical-ledger CI (guest/player/anon refused, traffic classes by priority, QA and CI excluded from the funnel, challenge and daily counters, no identifier, period bounds); `analytics-admin-browser-tests.mjs` opens the sixth section at 320/390/1440 and writes `docs/validation/analytics-acquisition-*.png` with `LUMEN_ANALYTICS_CAPTURES`.

#759 kit: `video-kit-tests.mjs` checks the six video scenes against the catalogue solutions (no invented Guardian, no cross on a solution cell, A/C scenes complete the grid, 15–30 s, CTA, FR/EN SRT); `scripts/marketing/record-video-kit.mjs` (not in CI) records them from the real game.

#759: `lumen-share-tests.mjs` also checks the English invitation, result text and card copy (`inviteShare`, `resultShareData(model,t)`, `shareCardCopy`), that private fields never leak, and that the dialog’s native share keeps a specific link (challenge) while generic discovery shares get `player_share`.

#896 compact list (recette 21/11): `duel-view-tests.mjs` also checks the quest named once, one line per player (none hidden), every state without an invented verdict or `0:00`, the autonomy rule, share actions collapsed but with their `data-*` attributes, escaping and long names, EN copy, and pins a SHA-256 of `renderDuelCard()` output (validated card unchanged). `duel-browser.mjs` runs « Mes défis » at 320/360/390/1440 with a three-player challenge: no horizontal scroll, card heights, 44 px targets, untruncated verdicts, share menu, copy link, detail card, Escape and focus return.

#896: `duel-view-tests.mjs` covers verdicts from both roles, the autonomy rule, every non-comparable state (pending, playing, abandoned either side, missing time), gap wording, notes (#887/#889), escaping, contract builders, recipient matching and the three lists; `duel-browser.mjs` (canonical replay suite) checks « Mes défis » at 360/1440 (won/lost/tied/playing/abandoned), the detail card (verdict and both times on screen, one winner, Escape and focus return, copy link), « Amis et défis » received/sent, the result notification opening the duel and English copy, and writes `docs/validation/duel-*.png` when `LUMEN_DUEL_CAPTURES` is set.

#898 (Lot 4, PR A): `social-hub-tests.mjs` checks the global badge sum, that each moved entry/counter id exists once inside the panel and the section order; `social-hub-browser.mjs` (canonical replay suite) covers the guest at 360×640, signed-in 390/1440, keyboard opening, focus trap, Escape with focus restoration, #35 counters feeding the badge, the rankings split, the daily route and writes `docs/validation/social-hub-*.png` when `LUMEN_SOCIAL_CAPTURES` is set. `credits-browser-tests.mjs` opens the panel before focusing the invitation. PR B: `social-notifications-tests.mjs` covers storage per account and corruption, silent baseline, acceptance detection, 30-day expiry, removed friend, deduplication, ordering, read state, extra badge units, French/English copy, guest, throttling, offline (last list kept) and account switch; `social-hub-browser.mjs` checks the feed (4 events, « Nouveau », nicknames only), reading on viewing (badge 4 → 3), opening Mes défis (badge → 2), no ghost after reading, offline notice, `online` refresh and the received challenge link.

#882 (Lot 3, PR A): see [DAILY_CHALLENGE.md §7](DAILY_CHALLENGE.md#7-tests-et-retour-arrière) — `daily-challenge-tests.mjs`, `fixtures/daily-challenge-882.sql`, `daily-concurrency.py` and the rollback rehearsal run in canonical-ledger CI. `fixtures/supabase-default-anon-grants.sql` reproduces Supabase's default `anon` grants before `20261122100000_daily_anon_revoke_882.sql`; `fixtures/daily-anon-revoke-882.sql` then asserts only `lumen_daily_today` stays guest-callable (also covers #889 `lumen_create_qualifying_challenge`).

#35 (Lot 2): `social-friends-tests.mjs` (client RPC names/arguments, French
errors, statuses, escaped renderers without technical IDs), `friends-browser.mjs`
(imported by the canonical replay suite: guest explanation without calls,
account add/refuse/accept, received challenge with provenance, send to a friend
from « Mes défis », link opening, 390/1440 px) and
`fixtures/friends-direct-challenges-35.sql` in canonical-ledger CI (account and
nickname required, exact search, idempotent request, quiet decline + cooldown,
crossing requests, daily limit, direct challenge ownership/friendship, one
participation, inbox privacy, removal, privileges, Lumen erasure of both sides).
`fixtures/friends-rollback-35.sql` rehearses the documented production rollback of
PR #893 in a rolled-back transaction (tables and RPCs removed, erasure policy chain
restored, erasure review still passing, #892 writer untouched).

#887: `scripts/fixtures/challenge-grid-revision-887.sql` (canonical-ledger CI, after the migration applied twice) seeds numbered challenges as production stored them and replays the private repair: only the challenge with a sender run on revision 1 within 30 min is repaired; pre-switch, revision-0-run and stale-evidence rows keep revision 0; re-run changes nothing; old-board results keep status/time/badges and are flagged; get_v2/list_v2 expose the flag only to the participant and the sender; v1 reader/start refuse the repaired link; a v2 result on the pinned board is comparable; the writer pins revision 1 on the numbered path, refuses unknown revisions and corrects a stale client from its own run; helpers stay private. `challenge-rpc-contract-tests.mjs` now requires the same board and pinned revision for historical numbers too; `duel-view-tests.mjs` checks the `different-board` state (no winner, both times) and `social-challenge-tests.mjs` the played revision and the refusal on an old server.

#927: `scripts/fixtures/current-nicknames-927.sql` (canonical-ledger CI, migration applied twice, then the #887 fixture and RPC matrix re-run) renames a sender and a participant through `lumen_set_nickname`: old links, the participant's own result, the sender's history and the v1 reader show the current nicknames; a guest who typed the same name and an account without a ready nickname keep their snapshot; a guest sender keeps its stored name; times, statuses, order and the challenge row are identical before/after; snapshots stay stored; no user ID or email in the output; no foreign listing; an erased sender stays « Compte supprimé »; the resolver is private. `challenge-rpc-contract-tests.mjs` requires every challenge reader to resolve names by account ID.

#929: `scripts/fixtures/private-circles-929.sql` (canonical-ledger CI, with Supabase default anon grants reproduced before the migration, applied twice) covers guests and nickname-less accounts refused; no anon EXECUTE and no direct table access; name rules; an outsider gets nothing (detail, board, rename, link, leave: same `circle_not_found` as an unknown circle); friends-only invitations, idempotent re-invite, foreign answer refused; member vs owner permissions; refusal and 24 h cooldown; 7-day hashed links, preview without members, join, revoked/expired/unknown links indistinguishable and useless; 3 active links; ranking of members only with official scores (penalties included), ties, members without time, no virtual player, public board unchanged; removal; 20 members and 10 circles limits; ownership transfer on leave, deletion of an empty circle with its links/invitations; owner deletion; Lumen erasure transferring ownership; no e-mail or user ID in outputs. `circles-tests.mjs` checks the RPC contract, error copy FR/EN, link format and ranking view model; `circles-browser-tests.mjs` (360, 390, 1440; FR/EN) drives the real page with an in-page model of that contract: guest, empty state, invalid name, creation, friend invitation, link with manual copy fallback, leave confirmation, invitation acceptance and private ranking, Escape, deep-link join and invalid link, offline retry.

#883 (Lot 0): `challenge-rpc-contract-tests.mjs` checks, for historical, #650
soft-revision, stable revision-0 and revised challenges, that each create/get/
start/finish/list RPC chosen by the client exists in the migrations with
compatible parameters and guest grants, and that the start/finish wrappers only
refuse revised rows. `scripts/fixtures/challenge-rpc-matrix.sql` runs the same
matrix on the real migrated schema in canonical-ledger CI (create, hidden
reference, one participation across reloads, wrong-route refusal, immutable
terminal result, second signed-in profile abandoning, sender inbox/read,
privacy, no campaign write). `challenge-recipient-browser.mjs`, imported by
`canonical-replay-browser-tests.mjs`, opens real `?challenge=` links as a guest
without Adventures at 390/1440 px against an in-page model of that contract (#881
Lot 1 adds: a newcomer sees the rules summary and opens the rules without
starting the attempt, with « Relever le défi » visible without scrolling; the
help never offers a learning replay and a forced one cannot swap the grid). The
RPC transport is simulated there: real-device and live-backend acceptance stay
manual.

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
Do not duplicate browser/server setup in GitHub Actions. Add new mandatory browser suites to `scripts/quality-gate-browser-suites.mjs`, consumed by `scripts/quality-gate.mjs`, so local and CI execution share one inventory. Node membership remains in `scripts/quality-gate-suites.mjs`.

The PR workflow runs Node checks and three browser partitions concurrently, retaining two browser workers per runner and all existing assertions. The final required `quality` job rejects failed, cancelled, missing or unexpectedly skipped dependencies. Documentation-only classification and optional learning selection keep their existing rules. `node scripts/quality-gate.mjs` still runs the full local gate; `--node-only` and `--browser-shard=1/3` (also `2/3`, `3/3`) run the CI partitions. Run `node scripts/quality-gate-shards-tests.mjs` and `node scripts/quality-gate-pool-tests.mjs` after orchestration edits. See [CI efficiency](CI_EFFICIENCY.md) for reports, baseline and measurement limits. No gameplay or onboarding contract changes.


## Difficulty audit (#81)
Run `node scripts/difficulty-audit.mjs [optional-report.json]` to measure the campaign independently of player telemetry. The deterministic score combines board size, explainable proof workload and the pressure of `locked/group` rules. It uses fixed thresholds rather than campaign percentiles, so future packs can be compared to the base game. The quality gate runs the audit to ensure every scheduled quest remains fully replayable; changing the score formula requires an explicit product decision and documentation.


## Late-game difficulty curve (#81 phase 2)
The base campaign intentionally consumes every currently audited 7×7 and 8×8 catalogue entry. The second half alternates easier 6×6 breathing quests with 7×7 hard steps and 8×8 expert peaks instead of using grid size as a monotonic ladder. `scripts/difficulty-audit.mjs` guards the curve itself: all five 20-quest segment averages must rise, the final segment must materially exceed the first, Q81–100 must contain several expert/expert+ peaks and several breathers, and Q100 must be expert+.

The fixed metric is `round((size-5)*6 + max(0,steps-size)*0.45 + group*1.25 + locked*0.6)`. Tiers: accessible <40, intermediate 40–54, hard 55–69, expert 70–89, expert+ ≥90. This is a reproducible solver proxy, not a claim about human solve time; validate it against #65 telemetry as data accumulates.


## Extensible content registry (#47)
`src/campaign/content.js` is the stable content boundary for future skies and packs. The current 100-quest game is pack `base-real-sky` inside `real-sky`. Existing numeric quest indices remain the legacy progression key so current players lose nothing. Future packs receive stable IDs and can be entitlement-gated without changing the puzzle engine.

The base campaign length is intentionally distinct from future catalogue length. Progression/UI/cloud merge paths derive the current base length from the content model instead of duplicating the literal 100. Payment, pack pricing and the final future-catalogue UX remain out of scope until engagement data justifies them.


## Ownership integration (#66)
The production backend already exposes `lumen_get_entitlements()` over `lumen.entitlements` (`entitlement`, `source`, `granted_at`, optional `expires_at`). Do not create a parallel ownership table. Authenticated startup/sign-in loads that RPC into the client content model; sign-out/anonymous mode clears account entitlements and therefore sees only packs whose registry access is `included`.

`Mon ciel` obtains its constellation navigation from `contentMapModel()`, including stable content/pack IDs and access state, while preserving the existing legacy constellation indexes and puzzle progress keys. Future skies/packs can therefore extend the registry without duplicating the base catalogue in UI code.


## Tutorial skip eligibility (#80)
Do not use `lumenTutorialSeen` as proof of onboarding completion: it only means the introductory slides were dismissed/completed. Durable skip eligibility is `lumenTutorialCompletedV1`, granted only after Q2 succeeds, with Q1+Q2 solved progress as a recovery fallback after cloud restore.

A genuine first-time player never sees “Passer le tutoriel”. A player who has already completed Q1+Q2 may skip only a voluntary learning replay; doing so returns to the prior quest and must not mutate solved quests, badges, shards or milestone state. QA new-player mode uses its isolated `lumenQa...` namespace and a fresh QA reset clears that proof.


## Rapidité countdown UX (#88)
The Rapidité badge threshold itself is unchanged. The visual countdown window is 30 seconds: the indicator appears when 30 s remain and its fill represents `remaining / 30s`. The first 20 seconds stay deliberately subdued; only the final 10 seconds receive a modest visual emphasis. No blinking/pulsing animation is allowed and the countdown must remain outside the puzzle grid.


## Internal tester capabilities (#33)
Never authorize admin/tester tools from a browser email comparison or localStorage alone. The client must first receive the capability from `lumen_get_internal_capabilities()`. Local device preferences may only toggle a capability already granted by the server. Commercial ownership remains in `lumen.entitlements`; internal tester capabilities live separately in `lumen.internal_capabilities`.

## Issue #340 — diverse generator regression

Run `node scripts/generate-diverse-grids-tests.mjs` to cover seeded determinism, all five geometry profiles, connected regions, Guardian constraints, symmetry signatures, exhaustive uniqueness (for accepted candidates) and replay. New grids remain offline and unscheduled until reviewed; no player-save mutation. This focused contract supplements, and does not replace, `node scripts/quality-gate.mjs` and `node scripts/audit-catalogue.mjs`. A full quality gate is required before merge. Do not label the heuristic score as a validated human-difficulty metric.

## Administrative Adventure access regression contract

- Signed-in account with trusted `analytics_cockpit` capability: all catalogued Adventures appear accessible, and entering a normally locked Adventure is permitted.
- Signed-in account with `all_adventures_access` capability: same result; the list is derived dynamically from `CONTENT_PACKS`.
- Ordinary signed-in account, signed-out guest, and QA new-player session: locked Adventures remain locked unless already owned or legitimately started.
- Signing out immediately removes the administrative override; it is never written to entitlements, `legacyAdventureAccess`, or cloud/local progression.
- Administrative navigation must not mark an unsolved quest as solved, award stars, or bypass the ordinary sequential quest completion rules.
- Repeat after cloud restoration, page reload, and switching accounts; confirm normal players do not inherit administrative access.
The disposable SQL job also runs `scripts/fixtures/sync-health-incidents.sql`
against the real sync-health migration: blocked reconciliation, repeated recent
failures, recovered players, equal timestamps in both orders, incidents older
than the report window, and authorization/RLS boundaries. The simulated
incidents exercise the same `stalled_players` count consumed by the cockpit
alert; they never insert into production telemetry.

## Documentation consistency gate

The `Documentation consistency` GitHub Actions workflow runs `node scripts/docs-consistency-check.mjs` on pull requests and pushes to main. It checks selected source-of-truth invariants (badge names/count, speed target, shard policy, test scripts, agent map links). On pull requests it also checks that changes to mapped modules include a review/update of at least one owning document. See `scripts/docs-consistency-check.mjs` for mappings.

This is a **drift detector, not a proof of complete documentation correctness**: it does not execute gameplay, validate all prose or inspect browser behavior. If a rule is intentionally changed, update its source code, owning documentation and regression tests together; update the checker only to reflect the new verified contract. Avoid no-op documentation changes solely to satisfy the gate. Review documentation and source diffs during PR review.


## Historical authority refusal diagnostics

`legacy-command-client-tests.mjs` reproduces the previously empty protected-field
report on both reconciliation paths. It checks solved/performance differences,
known performance-key names, unknown-key redaction, omitted cooldown timestamps,
unchanged inputs/local bytes, both recovery copies and one refused write without
fallback. The account-session browser regression verifies that the field names
reach the actual local diagnostic on mobile/desktop under simulated Auth/RPC.
This is diagnostic coverage, not repair of an affected account's divergent save.


## Historical attempt-count compatibility

`legacy-command-client-tests.mjs` verifies both counter-only reconciliation paths:
maximum cumulative summary, exact server reward/cursor preservation, independent
read-back, original local bytes and both recovery copies. The isolated
`fixtures/legacy-attempt-counter.sql` fails under the original authority trigger
and passes with `20261020084328_legacy_attempt_counter_metadata.sql`. It exercises
counter-only CAS and backup, stale expected state, idempotence, invalid/deleted/
decreasing/overflowing counters, reward/evidence/version/revision/XP smuggling,
transaction rollback, immutable receipts, other-account isolation, exact private
projection and the next legitimate command. Private helpers remain inaccessible
to anon/authenticated. PostgreSQL CI also races counter-only CAS against a real
command in `legacy-command-concurrency.py`; either order preserves one grant,
all receipts and a monotonic count. Local embedded PostgreSQL is additional
validation, not a substitute for CI PostgreSQL 17 or affected-device verification.
No fixture may run against production. Applying the migration requires separate
approval; passing tests do not establish repair of any existing phone save.


## Canonical start isolation and victory capture

`campaign-resume-tests.mjs` executes the real start/menu renderer to reproduce
numeric performance pollution and the stale legacy finale banner. It verifies
canonical start leaves numeric performance untouched. Its recovery matrix checks
both original snapshots, unchanged rewards/unknown profile fields/run/intent,
idempotence, wrong owner/quest/mode/state, preservation of completed legacy
boundaries, refusal of cloud-present performance records, invalid
metadata, reward-bearing or unknown entries, quota, account switch and concurrent
edits. Unrecognized data remains held for review.

`canonical-outbox-recovery-tests.mjs` reproduces two victory renders racing before
durable enqueue completes with different elapsed time, then requires one immutable
capture and a released guard after failure; retained account/quest/reset tests
still reject stale async UI effects. `campaign-resume-browser-tests.mjs` exercises
Dauphin after Grand Chien with simulated protected snapshot RPCs and real browser
storage: no stale banner or numeric performance, recognized old-state recovery
with the same attempt, account isolation, and a real solved-board render twice
leading to one command receipt/grant and verified success. These simulations do
not establish recovery of a player's live phone or arbitrary storage failures.

Canonical solved-board Auth resume: `canonical-outbox-recovery-tests.mjs`
reproduces the false startup capture error before `lumenUser` is restored and
checks hydration wake-up isolation across account, client, quest, attempt,
reset, owner, readiness and password recovery changes. The campaign-resume
browser fixture persists a solved RUNNING board, reloads with delayed Auth,
and requires the success dialog, original attempt identity, one reward grant
and unchanged legacy progress. This is simulated Auth/RPC browser coverage;
confirmation on the affected phone remains necessary after publication.

Committed attempt regression: `canonical-command-client-tests.mjs` verifies
read-only recovery of a receipt after local acknowledgement, no new write,
missing receipt and incomplete reward projection. Durable outbox tests require
verified original-entry/receipt archival before cleanup; better times, uncovered
badges, unknown evidence, changed identity/session and failed archive preserve
the local intent. Existing changed-evidence server rejection tests remain.
The campaign mobile browser fixture persists RPC receipts across reloads and
rejects changed evidence as the real command does; it then recreates a later
capture under an already committed attempt, requires verified success, identical
attempt/XP, one grant and a byte-equivalent archived entry. This uses simulated
RPCs and real browser storage, not a production account session. Live affected
phone confirmation is still required after publication.

The campaign-resume RPC fixture also enforces exact JSONB-style CAS baseline
equality before snapshot replacement, with a deliberately stale-baseline probe.
A permissive mock previously accepted stale snapshots and could overwrite a
just-confirmed synthetic canonical reward; this does not reflect PostgreSQL CAS.
The success assertion retains exact quest, grant, XP and attempt checks.

Queued receipt/canonical celebration regression: the outbox recovery suite
reproduces a prior quest paused with `22023`, allows only receipt recovery, and
retains auth/unrelated review holds, missing receipts and stale-session cases.
The mobile campaign fixture checks the visible animated canonical reward panel,
then advances to the following quest, places a Guardian and reloads with an old
quest's paused duplicate. It requires archival/recovery, no pending-sync notice,
one grant/unchanged XP, and the exact active quest/attempt/board retained.

Explicit sync verdict: account-session Node tests require a healthy named account
to show a success verdict, and forbid it for busy/dirty/offline/failed/pending
states. Existing Auth/recovery guards remain covered. Diagnostics keep their
privacy/copy-fallback assertions and require an accessible current-state summary.
The campaign browser fixture opens the account menu and diagnostic and checks
that the visible summary matches the current verdict above the technical log.

The account-switch browser setup explicitly opens its target canonical quest
through the new account’s sky and canonical quest panel, including catalogue-driven
pagination. A switched account need not inherit the previous account’s active
quest. Exact quest, attempt, grant, XP and archive assertions remain mandatory.


Shared quest celebration regression: `canonical-replay-browser-tests.mjs`
checks mobile/desktop first completion and replay in an isolated QA profile:
constellation reveal, confirmed star, newly earned badges, no duplicate replay
star, no difficulty survey, reachable next action and reload-safe badge state.
`astronomical-reference-svg-tests.mjs` checks arrived real points/links and
absence of arrival animation when no star was gained. No live account writes.


## Privacy #316: PostgreSQL integration workflow

`.github/workflows/privacy-sql-integration.yml` starts a disposable PostgreSQL
17 service on pull requests. `python3 scripts/privacy-sql-integration.py`
extracts the **actual** `lumen_privacy.scope_predicate` migration function,
executes it in PostgreSQL with synthetic support cases and access rows, and
asserts that the target user's actor and case-linked records are selected while
another user's records are excluded. All changes are rolled back. No
production credentials, Supabase project, or live player records are used.
This is a **scope regression only**; end-to-end erasure, trigger barriers,
retention, rights export and production compatibility still need testing.


### Complete migration smoke test

`python3 scripts/privacy-full-erasure.test.py` is also run by the same disposable PostgreSQL 17 GitHub Actions job. It constructs a synthetic catalog from the migration's real policy, installs the **entire** erasure migration, verifies explicit confirmation, deletes a fixture Lumen profile, retains another player's profile and synthetic `auth.users`/SoldeZen records, and checks the post-erasure write barrier. The entire transaction is rolled back. This is a synthetic smoke test, not a substitute for a schema-accurate production rehearsal or legal approval.


### #316 — Supabase isolated Edge HTTP smoke

Erasure UI completion (#316, 2026-11-14): `self-erasure-controls-tests.mjs` runs the real handler with a sign-out that never settles; a deleted account must still clear device data and its stored session and reload, and a kept account must report the interruption instead of waiting.

Full account deletion (#316, 2026-11-14): the handler tests also cover the sign-in account deletion order (erasure → `lumen_account_deletable` → `auth.admin.deleteUser`), shared/unknown/failed cases keeping the account, and no check when erasure is not acknowledged; `test-erasure-release-gate.mjs` statically checks the fail-closed SQL, self-only erased status and the client notice before the nickname gate.

`node scripts/self-erasure-handler-tests.mjs` executes the actual Edge handler
with synthetic Auth/RPC boundaries. It checks a forged target, denied identity,
confirmation/origin/method refusals, SQL failure and incomplete acknowledgements.
The latter returned HTTP 200 before the fix and now returns 409. No SQL, live
Auth, credentials or deletion is used; authorized isolated E2E is still required.
The workflow `.github/workflows/erasure-qa-smoke.yml` checks the deployed `lumen-erasure-qa-smoke` endpoint from a GitHub-hosted runner. It expects HTTP 401 without a bearer token, 405 for GET, and 403 for an untrusted browser Origin. This endpoint has no service-role key, no SQL erasure invocation, and cannot delete data. Passing this smoke test is **not** an authenticated end-to-end account-erasure test; the destructive release gate remains blocked until separately validated in isolated QA.
## Offline PWA shell and update regression (#597 / #618)

`node scripts/android-offline-preflight.mjs` runs in the PR quality workflow and
checks the mandatory public service-worker shell entrypoints, repository assets,
install-failure guards and public navigation restrictions. This is static
preflight, not proof that a quest opens offline on a physical Android device.

`node scripts/service-worker-update-browser-tests.mjs` exercises a real
service-worker upgrade with a synthetic application. Its cache assertions derive
the current version from `sw.js` rather than assuming the historical v10 name.
The worker now refuses installation if any mandatory precache fetch fails; this
avoids activating an incomplete new shell. Neither test guarantees the entire
transitive ES-module graph or quest content is available offline.

Release acceptance still requires Android installed-PWA testing: warm a playable
quest online, close the app, switch to airplane mode, reopen and play that quest,
then reconnect and confirm the pending attempt synchronizes once without lost
progress. Do not cache OAuth callbacks, private responses or cloud APIs.

## Android APK startup smoke (#170 / PR #621)

The Android packaging workflow builds a debug APK, installs it on a Google APIs Android 35 emulator and launches the existing `com.google.androidbrowserhelper.trusted.LauncherActivity` component. Since #845, that component is an alias for Lumen’s native launcher. It collects `android-startup-logcat.txt` as a downloadable artifact on success or failure, and fails when a fatal startup exception is detected. Consult `android/TESTING.md` for the physical-device matrix. This automated smoke is **not** proof of TWA rendering, Digital Asset Links verification, OAuth, real-phone functionality or production readiness; inspect Logcat before attributing any crash to missing asset links.

## Offline full catalogue foundation (#597)

The service worker v14 now follows same-origin static ES imports/exports and CSS
imports from the mandatory shell entrypoints, including the imported catalogue
JSON assets. Installation must finish fetching these dependencies before the
new worker can activate. The static preflight checks this contract. This does
**not** yet validate offline progression, complete runtime/dynamic imports,
quota/eviction handling, guest registration boundary, or reconciliation after
reconnection. Do not declare #597 complete or release this without a real
Android offline multi-quest test and cloud persistence regression checks.

### Offline multi-quest Android acceptance (#597, required before full validation)
1. On Wi-Fi, sign in and complete verified cloud hydration. Wait for the service worker to finish installing; verify its cache contains every public quest definition used by the published catalogue, including a locked quest never previously opened.
2. Turn on airplane mode, force-close the PWA, then reopen it. The sky, an unopened available grid, and the next grid must all load. The durable owner-bound continuation marker is valid only for the same account, offline, for at most 30 days after successful online hydration; it is not authentication or a cloud receipt.
3. Complete two sequential quests offline, with a badge and best time. Both completions must be durably recorded, immediately unlock the next quest, and survive another force-close. Durable Canonical/Legacy outbox entries supply a navigation-only view; confirmed profiles, badges, rewards and balances are not fabricated.
4. Reconnect and verify that canonical and legacy command outboxes replay once, reward balances are not duplicated, best times and badges remain correct, and all completed quests stay unlocked.
5. Repeat with a failed sync, storage quota pressure, account switch and a revoked session. The previous account's pending commands must never be attributed to the new account. Do not clear local outboxes to recover.
6. Fail one mandatory catalogue asset during installation: the old active worker must remain usable and the new worker must not claim offline readiness.

The 4 November delivery mission permits integration after applicable automated gates, with status To be tested while physical acceptance remains. Do not mark #597 Done or certify release readiness solely from static or synthetic checks. Real Android cold start and end-to-end cloud reconciliation remain required.

### Offline regression corrections — 4 November 2026

The actual worker installation is executed against the repository files in
service-worker-cache-tests.mjs. A bare optional SDK package specifier previously
resolved to a nonexistent local path and rejected installation; only URL paths
are crawled now. Storage quota refusal retains the old shell without activation.
The owner-resume suite resolves the UI imports and exercises restart/account
isolation, catching the missing runtime import. The outbox suite checks a solved
board resuming after verified offline Auth while cloud hydration is unavailable.
Historical cloud recovery is deferred offline rather than launching an unhandled
network request at startup. Existing unverified/account/run/recovery guards remain.

The campaign-resume browser suite uses native Cache API, IndexedDB and actual
network disconnection: offline reload, three wins, three next quests, another reload
and reconnect with exact-once synthetic receipts. Auth/RPC are mocked; this is
not a physical Android, actual expired-token or second-device acceptance result.

Measured repository graph: 102 resources, approximately 2.06 MB uncompressed;
per-file Brotli estimate 345 kB. Browser storage overhead and device quotas vary.

Paid offline aids (owner decision, 4 November): `offline-wallet-tests.mjs` uses
the actual durable Wallet outbox for restart, immutable retry, tariffs, owner
isolation, two concurrent tabs, quota and unavailable inventory/lock. A simulated
server refusal retains the identical debit in review and does not alter earned
progress. The campaign browser now completes three quests offline, reloads before
the third, uses a paid Verify and checks one wallet debit and one grant per win
after reconnect. Actual Auth/RPC/device acceptance remains separate. The cache
graph is now 102 resources, approximately 2.06 MB raw / 345 kB estimated Brotli.

Prepared offline startup does not invoke SDK session refresh. It uses only the
matching bounded device-owner record and registers one Auth initialization on
reconnection. The browser mock refuses any offline getSession call, including
the expired-token refresh path. This is local continuation only: no new cloud
authentication, entitlement, reward or server-side privilege is granted.

The offline browser fixture also refuses every request at its local HTTP server,
so a worker cannot escape page-only DevTools emulation. It evicts a mandatory
module from Cache API and clears only the disposable browser HTTP cache, then
asserts an explicit loading/reconnection message and unchanged IndexedDB entry
count. Reconnection repairs the assets and synchronizes the same operations.
Worker v14 readiness validates the recorded asset manifest after eviction;
redirects never enter public caches. Both network and offline fallback responses
use no-store HTTP headers, while Cache API retains the explicit offline copies.
## Records personnels (#600)

- `node scripts/personal-records-tests.mjs` : deux générations de quêtes,
  minima indépendants, replays non qualifiants, aucune inférence historique,
  récompenses inchangées et récupération du meilleur record cloud/local.
- `node scripts/personal-records-browser-tests.mjs` via le lanceur CDP : vraie
  interface QA à 320/390/1440 px, avant partie, nouveau record, rechargement,
  absence de débordement horizontal et reduced-motion. Aucune Auth réelle.
- CI PostgreSQL 17 : migration dans une base jetable, parité intégrale des deux
  commandes avec les projections JS, puis `scripts/fixtures/personal-records.sql`.
  Les fixtures de parité s’exécutent après toutes les extensions de commandes ;
  leurs profils historiques portent l’origine catalogue explicite de test.

Recette restant nécessaire : deux appareils authentifiés, conflit de temps
absolu/sans aide, aide payante puis victoire, reprise d’une victoire hors ligne,
ancienne sauvegarde sans record et Android réel. Ne pas annoncer cette partie
serveur active tant que sa migration et son read-back ne sont pas vérifiés.
## Candidat d’intégration de l’aventure 5 (#598 / #599)

- `adventure-05-runtime-tests.mjs` vérifie les 400 anciens IDs/ordres/hashs
  exacts, les 100 ajouts, l’accès, la séquence, les rewards et les replays. Un
  test de courbe a reproduit le tri décroissant initial avant sa correction.
- `validate-fifth-adventure.mjs` rejoue l’unicité, proofEngine, la connexité,
  l’absence de singleton et de collisions D4 contre le reste du catalogue.
- `adventure-05-browser-tests.mjs` parcourt les vraies cartes/grilles QA à
  320/390/1440 px, réussit deux quêtes, conserve l’ancien préfixe, recharge et
  attend la présence effective du JSON dans Cache API. Auth réelle non testée.
- PostgreSQL 17 jetable : migrations records/catalogue puis parités complètes
  Legacy/Quest, anciens/nouveaux profils et `fixtures/adventure-05.sql`.
- Worker v15 renouvelle le manifeste complet ; les tests d’update préservent
  les intentions et les scénarios offline existants restent obligatoires.

Recette restant nécessaire : difficulté perçue, rendu des dix constellations,
Android réel, deux comptes/appareils, vieux client puis mise à jour, activation
serveur autorisée et vérification du SHA publié. Les fixtures ne publient pas
l’aventure et ne modifient aucun joueur de production.

## TWA Digital Asset Links on o2switch (#170)

The Android debug APK built by GitHub Actions on PR #621 uses package `fr.nopuna.lumen.debug`. The **specific distributed APK** certificate was extracted from its APK Signature Scheme v2 block (SHA-256 fingerprint recorded in `.well-known/assetlinks.json`). CI debug certificates are ephemeral: **new GitHub builds have different fingerprints** and must not be assumed verified by this file. The eventual Play package `fr.nopuna.lumen` must use its **real Play App Signing certificate** in a separate statement before publication.

The o2switch static publisher stages `.well-known/assetlinks.json`, merges it into the existing live DAL without deleting other applications' statements, and verifies an HTTPS GET of the exact expected package/fingerprint. A missing/forbidden file triggers rollback of the entire static deployment. Tests in `scripts/o2switch-deploy-tests.py` cover preservation, publication and rollback. This is a public trust declaration; no private signing key is stored in Git. Do not substitute the upload key fingerprint for Play App Signing.

Release acceptance: verify `https://lumen.nopuna.fr/.well-known/assetlinks.json` returns 200, JSON, no redirects; test Android's domain verification and launch the **same APK whose certificate is listed** to verify the browser toolbar is absent. A successful HTTP check alone does not guarantee that a specific browser/device accepts TWA verification.

For release verification, use the *original* APK from Android workflow run 41882238087 (artifact 13350282143); rebuilding a debug APK changes the CI signing certificate and invalidates the published fingerprint. After the public DAL is verified, force-stop and relaunch the installed app. Do not remove its browser data as a workaround.

## Catalogue complet 88 / 880

Le gate enregistre `iau-completion-tests.mjs`, `validate-iau-completion.mjs` et
`iau-completion-browser-tests.mjs`. Le premier conserve le préfixe de 500 quêtes
et fait terminer les 380 nouvelles ; le second rejoue les preuves et vérifie le
rapport déterministe ; le navigateur joue les transitions et les deux finales
à 320/390/1440 px avec consultation hors ligne. Le mode QA désactive volontairement
la restauration automatique de compte ; `iau-completion-cloud-browser-tests.mjs`
vérifie la reprise A6 authentifiée, l’identité de tentative hors ligne, une
victoire en attente puis confirmée à la reconnexion et conservée au redémarrage.
Cette suite partage la fixture RPC synthétique de `campaign-resume-browser-tests.mjs`.
Les contrats serveur relèvent de la CI ledger-sql. Voir le
[rapport du catalogue](CATALOGUE_88.md) et la recette physique encore distincte.

Le job d’astronomie lance aussi `python scripts/vizier-fetch-tests.py` : une
expiration réseau du CDS utilise le miroir VizieR officiel du CfA pour le même
catalogue, sans rendre verts les cas de réponse vide, invalide ou indisponible
sur les deux serveurs. Le rapport frais et l’audit des sources figées restent
des preuves complémentaires.


## Régressions groupées #629, #632 et #627

`offline-wallet-ui-tests.mjs` reproduit le refus avec solde 80 et panne réseau malgré le signal en ligne ; conserve les refus Auth/métier et sans preuve. `offline-wallet-tests.mjs` couvre concurrence, quota, identité et file en revue. `drag-grid-path-tests.mjs` exécute le vrai gestionnaire avec événements espacés (RED avant correctif). `celestial-ux-tests.mjs` vérifie le dernier badge d’aventure et les priorités (RED avant correctif).

La quality gate ajoute `tap-jitter-browser-tests.mjs` (#994 : appui avec 0–14 px de roulis dans la case, simple et double, 360/412 px), `offline-hint-purchase-browser-tests.mjs`, `offline-hint-network-browser-tests.mjs`, `drag-cascade-browser-tests.mjs`, `adventure-mastery-browser-tests.mjs`. Profils et RPC sont synthétiques ; Chromium exerce les vrais boutons, le stockage durable, la reconnexion, les gestes tactiles et les scènes mobiles/bureau. Rapports CI : `ci-offline-hint.json`, `ci-offline-hint-network.json`, `ci-drag-cascade.json`, `ci-adventure-mastery.json`.

`adventure-mastery-browser-tests.mjs` couvre aussi 360×640 et 390×844 (#705) : aucun CTA « Revoir mon aventure », aucun défilement vertical de la carte, et le dernier bouton reste dans la hauteur utile. Il vérifie aussi le libellé « Maîtrisée » visible dans la barre d’aventures et le fond rempli distinct, conservé lorsque la sélection change. La navigation et le rechargement conservent les acquis sans récompense ajoutée.

#886 : `adventure-mastery-browser-tests.mjs` vérifie aussi le défilé grand format (une figure par constellation, plus grande que la tuile de mosaïque), les résultats masqués sur place pendant le défilé, l’accélération au premier tap puis « Passer », la fin naturelle en moins de 8 s (1440×900), l’absence de défilé en mouvement réduit (390×844), le tracé doré du récapitulatif, le message valorisant et les statistiques conservées ; le rechargement ne rejoue rien. `mastery-prelude-tests.mjs` borne la durée pour 1 à 20 constellations et vérifie le câblage (événement consommé une fois, aucune persistance). Recette Android/iOS physique : manuelle.

Recette physique restante : indice avec 80 Éclats en mode avion puis reconnexion ; glissement pendant scintillement avec/sans marquage automatique ; dernier badge d’aventure puis réouverture de Mon ciel, avec fond doré et libellé de maîtrise lisibles. Ces tests simulés ne valent pas recette sur téléphone. Les issues restent ouvertes « To be tested » jusqu’à acceptation.

## Highscore et séquence de victoire

La quality gate exécute victory-presentation-tests.mjs et ranking-browser-tests.mjs :
fin effective/annulation, minimum de deux secondes, attente sans limite puis
bouton explicite pointeur/clavier, podium et carte,
Top 3/hors podium/sans score/Échos, reduced-motion, largeur 320/390/768/1440 et
petites hauteurs 320/360/480. Les fixtures highscore-before.sql,
highscore-between.sql et highscore.sql
encadrent deux applications de la nouvelle migration dans PostgreSQL jetable :
doublons historiques, unicité, renommage, opposition sans tentative, nouveau compte
entre deux applications de la migration, dry-run, minima et rollback.
La concurrence SQL complète reste obligatoire en CI. Les tests simulés ne prouvent
ni l'information juridique, ni une compétition entre comptes de production, ni la
recette sur téléphone physique ; voir HIGHSCORE_ROLLOUT.md.

Le chrono officiel est couvert par official-time-tests.mjs et
official-time-browser-tests.mjs : 60 + 75 = 135 secondes, comparaison à 110/150/135,
pénalité immédiate, géométrie de mise en page inchangée, absence d’annonce en double,
preuve persistée avant ouverture du classement et capability conservée après
fermeture hors ligne de la PWA. Les compteurs répétés/restaurés n’émettent pas de
nouvelle animation. fixtures/official-time.sql et official-time-concurrency.py
vérifient les deux générations de commandes, droits, read-back, import historique,
retrait et plusieurs appareils dans PostgreSQL 17 jetable. Aucun test SQL de fixture
ne doit viser la production ; voir OFFICIAL_TIME_ROLLOUT.md pour le plan opérateur.

## Sélection CI des PR purement documentaires

Le job GitHub Actions `Lumen quality gate` conserve son statut de contrôle obligatoire, mais évite ses tests applicatifs pour une pull request ne modifiant **que** `AGENTS.md` ou des fichiers `docs/**/*.md` (hors `docs/validation/`). Le contrôle indépendant `Documentation consistency` reste exécuté. La détection compare les commits base et head ; si la comparaison échoue ou si un fichier inconnu, généré, SQL, applicatif ou de workflow est touché, la gate complète reste obligatoire (fail closed). Les pushes sur `main`, lancements manuels et contrôles programmés ne changent pas. Une PR modifiant elle-même la CI exécute donc la gate complète.

Ce filtrage ne remplace ni les tests ciblés pendant le développement ni les contrats de sauvegarde et de synchronisation. Avant de fusionner, vérifier que le check `quality` reste présent et vert sur une PR documentaire et que la gate complète s'exécute sur une PR de code.

## Sélection conservatrice du navigateur Learning

Sur les pull requests, la quality gate conserve les tests Node et les autres suites navigateur. Le test coûteux `learning-browser-tests.mjs` peut être ignoré uniquement lorsque **tous** les fichiers modifiés appartiennent à une liste fermée de zones isolées : `AGENTS.md`, documentation Markdown hors `docs/validation/`, trois modules spécifiques au classement/records (`src/persistence/ranking.js`, `src/ui/ranking.js`, `src/ui/personal-records.js`) ou leurs trois scripts de test (`scripts/ranking-tests.mjs`, `scripts/ranking-client-tests.mjs`, `scripts/personal-records-tests.mjs`). Toute modification partagée (moteur, tutoriel, onboarding, gestes, navigation, CSS, sauvegarde, authentification, configuration, CI, scripts inconnus) déclenche Learning. Une erreur de diff ou une liste vide entraîne également son exécution. Les pushes sur `main`, exécutions planifiées et manuelles gardent Learning systématiquement. Le rapport `ci-quality-summary.json` permet de constater l'absence de la suite sur les PR éligibles ; le check qualité reste obligatoire.

Cette première liste volontairement restrictive est à élargir seulement après analyse des dépendances et validation de PR représentatives. Le filtrage n'affecte pas les contrats cloud indépendants.

## o2switch release authorization

The full quality suite runs on pull requests. After a squash merge, the publisher verifies the exact merged commit, its PR provenance, and the successful PR quality, cloud persistence, reconciliation, SQL ledger, and documentation workflows. Cloud reconciliation and SQL ledger must also pass for the exact `main` SHA. Direct or unverified commits cannot deploy. A failed or missing check blocks publication; the deployment must never silently bypass a gate.

### Victory responsiveness on slow networks (#697, #698)

`victory-clock-freeze-tests.mjs` (quality gate) proves the shown official time and the captured victory seconds freeze at local detection while the engine keeps running behind them, that a re-edited board resumes the live clock, and that the freeze precedes any await. `legacy-command-client-tests.mjs` and `canonical-outbox-recovery-tests.mjs` hold a slow command open: the durable pending card appears once only after the durable capture, nothing is credited before confirmation, a later confirmation upgrades it (pending navigation entry removed, `victory_pending_upgraded`, `victory_sync_timing`), a failure keeps the same card with calm copy, and a retry tap cannot interrupt the running command. These are mocked VM checks, not real 4G measurements.

## Admin Adventure grants (#724)

- `scripts/adventure-access-tests.mjs` (Node, quality gate): locked rows derived from `CONTENT_PACKS`, server-state mapping, reason bounds, `CONTENT_PACKS` import in `game-screen.js` and the transient `all_adventures_access` override.
- `scripts/adventure-access-browser.mjs` (in `incident-investigation-browser-tests.mjs`, 4 viewports): native clicks, reason required, grant/revoke, a server failure never shown as success, detached panel refused, no overflow.
- `scripts/admin-recent-players-tests.mjs`: the panel receives the selected player and a revocable authorization.
- SQL (`ledger-sql`): `scripts/fixtures/adventure-access-before.sql` aligns fixture tables with production, the migration is applied twice, then `scripts/fixtures/adventure-access.sql` checks refusals (player, expired capability, account mismatch, invalid Adventure/reason/player), idempotent grant/revoke, audit attribution and the erasure policy.

## Purchases and mastery unlocks (#728)

- `scripts/mastery-unlock-tests.mjs` (Node, quality gate): client candidates (next Adventure only, owned rows, a missing badge, legacy version < 2), server calls (only confirmed unlocks, failures never throw, an account change stops the claims), wiring guards in `game-screen.js`, and store seed drift.
- SQL (`ledger-sql`): `adventure-store-seed.mjs --check`, the migration and its completion fix each applied twice, then `scripts/fixtures/purchases-mastery.sql`. The fixture includes an Adventure 1 canonical quest in the production shape (a won run without `solved`). It covers private ledger and grants, idempotency, identity conflicts, validation, the €5 cap, refund/dispute/won dispute, whole-sky product, non-EUR purchases, preserved admin and mastery rights, real legacy and canonical mastery of Adventure 1 (a missing badge, legacy version 1), idempotent and audited claims, one Adventure at a time, and the erasure policy.

## Locked Adventure offer (#731, #811, #1029)

`adventure-offer-tests.mjs` checks distinct delivered quests, constellations
and Adventures for the featured offer, including previously acquired content.
`sky-navigation-browser-tests.mjs` verifies offer order, terms, the free
return at mobile and desktop widths, and the badge filter at both levels
including catalogue order, returning to detail and the completed empty state.
Payment and restore scenarios use the existing synthetic provider checks.

For #811, `adventure-offer-tests.mjs` covers both counters, each zero case,
historical canonical wins and strict badge evidence. The synthetic screen
wiring in `play-billing-tests.mjs` holds hydration, changes profiles, then
installs verified progression and a mastery entitlement while the offer
stays open. It checks that counts and action update independently of the
paid controls. `sky-navigation-browser-tests.mjs` opens the real notice at
mobile and desktop widths and verifies the rule, counters and no page scroll.
The #728 SQL fixture remains the grant and persistence contract.

- `scripts/adventure-offer-tests.mjs` (Node, quality gate): prices from `store-catalogue.js` and parity with the server seed, missing quests and badges derived from the catalogue (plural forms), mastered, guest and locked-previous wording, intention-only funding text, and removal of the placeholder.
- `sky-navigation-browser-tests.mjs`: real tap on a locked Adventure (3 viewports). Checks that the offer replaces the lock text, purchase buttons are disabled with prices, the web-only €5 cap text and the free mastery path (with what is left) are shown, QA sessions get no account prompt, « Pourquoi ? » expands, and there is no horizontal overflow.

## Google Play purchases (#729)

- `scripts/play-purchase-handler-tests.mjs` (quality gate) runs the real Edge handler with synthetic Auth, RPC and Google boundaries, and an RS256 assertion verified with a generated key. It covers: identity from Auth, amount and currency from the verified Google order, acknowledgement after recording, pending/cancelled/invalid/unavailable recording nothing, a token owned by another account, a non-EUR region, boundary refusals, and voided refunds with pagination behind the operator secret.
- `scripts/play-billing-tests.mjs` (quality gate): availability only with the Digital Goods API, mapping of server answers (never success on error), Payment Request method and sku, sheet completion, restore, localised prices, hiding the whole-sky offer after a unit purchase without any fixed Play price claim, and wiring.
- `android/tools/packaging.test.mjs`: billing delegation service, `PaymentActivity`/`PaymentService` and the `billing:1.2.0` dependency stay declared.
- SQL (`ledger-sql`): `scripts/fixtures/play-purchase-gateway.sql` covers the original server-only gateway and refund lookup. `scripts/fixtures/play-regional-receipts.sql` covers restricted writes, the exact provider amount, EUR credit isolation, replay at a changed price, cross-account refusal, refund protection and receipt retention. The migrations run twice on disposable PostgreSQL. For Play acceptance use test and real-order provider evidence separately. Verify the Orders API permission, missing products and localization without submitting payment unless explicitly authorized.

For #885, the client replay uses the actual restoration and shop status handlers. It reproduces the old unsolicited notice from an invalid Digital Goods entry on an account with zero Lumen purchases. The regression checks empty inventory for fresh and progressed accounts, repeated automatic checks, bounded diagnostics for verifier errors, revoked rights, foreign accounts, and a paid receipt whose access is missing even after a successful entitlement response. Manual restore distinguishes empty inventory from verification errors, offers retry without paying again and confirms access only after a successful read-back. It checks both FR and EN, and tests source isolation with a Stripe notice. Installed Android and regular Chrome/PWA acceptance is tracked in #885.

For #823, the handler fixtures cover an absent RPC, lost acknowledgement, unbound and mismatched accounts, a privately reconciled legacy order, pending and cancelled purchases, and verified refund replay. The client fixture exercises the real restore action with a synthetic Play list on a second device, an unavailable verifier then a successful retry, immediate entitlement read-back, account handoff, and unchanged progress, stars, badges and currency. The Play restore fixture has no Payment Request API. The PostgreSQL ledger fixtures cover service-only grants, duplicate and refund replay, and exact regional settlement. See the [Android recovery checklist](../android/PLAY.md#récupération-et-déploiement-google-play-823) for live acceptance.

#833 finalisation: `play-billing-tests.mjs` checks the `play_test_checkout` gate (only that capability opens the bound checkout while `PLAY_CHECKOUT_AVAILABLE` is false; the tester sees the unticked waiver and no pause notice; revocation closes it again; other capabilities never open Play) and the throttled foreground recovery and its wiring. `play-purchase-handler-tests.mjs` adds the operator `readiness` probe (secret required, no record, acknowledgement, token or secret in the reply; 403 on `orders` or `products` and missing RTDN configuration make it not ready), two deliveries of the same purchase (one identity, no repricing, no refund, no second acknowledgement) and a recorded token presented for another product (refused, nothing recorded). These are synthetic boundaries: they do not simulate a real Google Play purchase.

The #833 wrapper 1.0.1 (2) regression in `play-billing-tests.mjs` exercises
the mounted Play offer with the release switch off and on. It covers native
marker validation, absent/rejected marker, Payment Request readiness,
validated prices, restoration without Payment Request, unchecked consent
before an eligible purchase, and confirmation only after entitlement
read-back. Automatic Play restoration stays silent for unverified purchases
and purchases owned by another account. A manual check shows an account-specific
result in the offer, and a separate unverified purchase cannot hide a confirmed right. The Play Console, authenticated RTDN delivery, both cron HTTP
responses and the real installed wrapper remain in the
[Android acceptance checklist](../android/PLAY.md#recette-du-wrapper-101-2-et-réactivation-833-pr-837).

For #833, the same handler mocks verify scheduling before acknowledgement and
retry without a live client. The canonical ledger gate replays both migrations
and verifies retry leases, account erasure, mixed-provider distinct Adventure
counting, refunds, and preservation of mastery and admin rights.

For #962, `play-purchase-handler-tests.mjs` proves that an independently
reconciled unbound order can be restored by RTDN, after Google settlement and
identity proof. An unresolved owner remains retryable without any ledger
write. The tests distinguish provider failure from missing ownership and
verify that redelivery uses the same redacted diagnostic key.
For #729 RTDN, the handler mocks prove the expected Google identity checks,
bound registration without a browser session, pending redelivery, and verified
refunds and duplicates. The SQL fixture covers binding preparation, lookup
permissions, account-switch denial and erasure. The browser fixture verifies
that Payment Request receives the binding prepared for the active account.
Wrapper compatibility tests cover the reserved native probe, the old wrapper
response and the release switch. Android packaging builds the patched adapter.
Signing and purchase acknowledgement still require installation from a Play track.

For #819/#818, the store tests cover its server count at zero through five,
the full-sky bundle, delayed replies, account handoff, and price and consent
copy. The ledger fixture checks the authenticated read and cross-account
denial. The shop displays no count while the server response is unavailable.

## Stripe Checkout, web/PWA TEST mode (#730)

- `scripts/stripe-handler-tests.mjs` (quality gate) runs the real `lumen-stripe-checkout` and `lumen-stripe-webhook` handlers with `_shared/lumen-stripe.ts`, synthetic Auth, RPC and Stripe API boundaries, and HMAC signatures computed by Node. It covers: session created from the server reservation (price, currency, metadata, controlled return URLs, idempotency key); unauthenticated, unknown product, missing waiver and forged body prices refused; ownership, eligibility, double click, rate limit; superseded session expired and failed creation released; live keys, live events and live sessions refused and never logged; missing, wrong, expired or tampered signatures; paid read back from Stripe regardless of the event payload; pending, failed, expired and open sessions; duplicate webhooks; a stale event after a refund; full/partial refunds; open, won and lost disputes; payment-intent lookup; 5xx on temporary failures and 409 on identity conflicts; status and restore limited to the signed-in player.
- `scripts/stripe-checkout-client-tests.mjs` (quality gate): web-only availability (test capability, never with a resolved Play Billing service, `LUMEN_NATIVE_APP` or a remembered `android-app://` launch; regression: Chrome Android exposing a rejecting `getDigitalGoodsService` still gets Stripe), only the product id and waiver sent, only a Stripe Checkout URL opened, return parameters consumed once, polling never reports success before server `paid`, one message per state, and wiring.
- SQL (`ledger-sql`): the migration applied twice, then `scripts/fixtures/stripe-checkout.sql` — service-role-only functions and private table, erasure policy, test-account isolation (real player and expired capability refused), catalogue price, inactive/free/unknown products, admin and mastery rights not resold, waiver, busy/reuse/supersede, one checkout in flight, live rows refused, forged amount/currency/product/account, unknown sessions, pending/failed granting nothing, paid, duplicate (one purchase, one event), full refund with progress untouched, late `paid` after refund ignored, disputes in any order, €5 cap through Stripe singles, sky after single, rate limit, own sessions only, test reset keeping real purchases, and no accounting record for TEST payments.
- Updated wiring contracts: `play-billing-tests.mjs` (offer available with Play Billing or the web Stripe checkout), `mastery-unlock-tests.mjs` (verified hydration also checks a Stripe return), `sales-terms-tests.mjs` (the waiver is checked before any provider).
- Manual Sandbox acceptance: [STRIPE_730](STRIPE_730.md), steps 6 to 10.
- Real-sales switch: `stripe-handler-tests.mjs` (live key reserves live checkouts, refused while the switch is off, only `cs_live_` sessions handed out, webhook accepts only events and read-backs of its key mode, trimmed secret, logged refusal reason, invoice footer); `stripe-checkout-client-tests.mjs` (`live` channel opens the web checkout to every signed-in player, never in the Play app); SQL `scripts/fixtures/stripe-live-switch.sql` after the migration applied twice (off by default, channel per account, live reservation and reuse, mode/prefix constraint, mode mismatch refused, idempotent replay, refund, test reset never touches real sales, accounting archive of real sales).
- **Not testable here:** a real Play purchase. It needs the Play Console, products, a service account and an internal test track (see `android/PLAY.md`).

## Presentation page and search basics (#736)

- `scripts/landing-seo-tests.mjs` (Node, quality gate) checks:
  - description and Open Graph tags on the game and on the page, with no inline script in the game shell;
  - the page facts (constellations, quests, Adventures, size of the free Adventure) derived from the catalogue;
  - in-game terminology (Gardien), the adjacency rule, and the Stellarium/Hipparcos attribution;
  - structured data, image sizes and the 1200×630 JPEG;
  - `robots.txt` (only `/admin/` is excluded; code and styles stay crawlable) and `sitemap.xml`;
  - the presence of the new files in both release scripts and in `o2switch-deploy-tests.py`;
  - #758 « Comment jouer » (`comment-jouer.html`): head, `HowTo` data, rules and tap cycle as in GAMEPLAY.md, and a worked example derived from the real first quest by `scripts/how-to-play.mjs` (unique solution, first two deductions, colour names, the remaining Gardiens) with up-to-date SVG illustrations;
  - #769 « Apprendre les constellations en jouant » (`apprendre-constellations.html`): head, no script, first-Adventure constellation names and sizes and the 88 total from the catalogue, the honest Southern Cross note, attribution and cross-links.
- `scripts/landing-browser-tests.mjs` (browser inventory, report `ci-landing.json`) runs `scripts/landing-browser.mjs` at 360, 390 and 1440 px on the three pages (`/decouvrir.html`, `/comment-jouer.html`, `/apprendre-constellations.html`): images load, the « Jouer » button is reachable (and keyboard-focusable on the how-to page), nothing overflows horizontally, no executable script runs, and the structured data parses.
- How-to illustrations: `node scripts/how-to-play.mjs` regenerates `src/landing/how-to-play-*.svg` from the catalogue; `--check` fails when they are stale.
- Visuals: `node scripts/landing-assets.mjs` with a served app and `LUMEN_CDP_URL` (QA mode, synthetic progress).
- Social previews (#932): `node scripts/promo-og-assets.mjs` composes `src/landing/og.jpg` / `og-en.jpg` (1200×630) from `board.webp` and the official Ursa Major figure. `PROMO_PREVIEW_DIR=docs/validation` also writes the messenger-like previews `og-promo-{fr,en}-small.png`. `lumen-share-tests.mjs` covers attaching the picture to « Partager Lumen ». `social-hub-browser` checks the real `og.jpg` bytes in the native share payload.
- Owner after deployment: Google Search Console (sitemap), the Rich Results Test and the Open Graph preview.

## Fiches des 88 constellations (#856)

- `node scripts/constellation-facts-tests.mjs` vérifie la couverture, les
  identifiants IAU et catalogue, les sources et les surfaces et rangs.
- `node scripts/render-constellations.mjs --check` vérifie que le HTML statique
  correspond à la source commune. Les suites landing vérifient le SEO, le
  parcours sans JavaScript, la recherche et les formats mobile et ordinateur.
- La suite navigateur Mon ciel vérifie l’indépendance des boutons, le contenu
  identique depuis les deux vues, le focus, Échap et une consultation sans
  réseau avec le cache du service worker. Les captures de revue se trouvent
  dans l’artefact navigateur quand `LUMEN_FACT_SCREENSHOTS` est défini.
- Recette physique avant publication. Ouvrir une même fiche depuis les deux
  vues, consulter plusieurs fiches en mode avion, vérifier Safari iPhone et la
  PWA installée, puis essayer la recherche publique et le lien vers le jeu.
  Relire en priorité la Grande Ourse, la Croix du Sud, Orion, le Réticule et le
  Peintre.

## CI scope: presentation page only (#744)

`scripts/ci-scope.mjs` classifies each pull-request diff.
- **The CI always runs the copy from the base commit**, so a PR cannot loosen its own scope. If the base has no script, the full gate runs.
- **It fails closed:** an empty or unreadable diff, or any unknown path, means `full`.

| Scope | Files changed (all of them) | What runs |
|---|---|---|
| `docs` | `docs/**/*.md` (outside `docs/validation/`) and `AGENTS.md` | Unchanged rule: `node` and `browser` jobs skipped |
| `landing` | `decouvrir.html`, `comment-jouer.html`, `apprendre-constellations.html`, `robots.txt`, `sitemap.xml`, `src/landing/*`, the `scripts/landing-*.mjs` files, `scripts/how-to-play.mjs`, with or without docs | Formatting and o2switch release tests; `landing-seo-tests`; `landing-browser-tests` on shard 1 |
| `full` | Anything else, e.g. `index.html`, `sw.js`, `src/` outside `landing`, release scripts, workflows, `ci-scope.mjs` | Everything |

**What `landing` skips:** the other Node suites, the cloud steps, browser shards 2 and 3, and the `ledger-sql` and `reconciliation` jobs.

**Mechanics:**
- `prepare` (`quality.yml`) exposes `scope`, and `LUMEN_QUALITY_SCOPE` reaches `quality-gate.mjs` in both the `node` and `browser` jobs.
- The browser matrix schedules only shard 1 for `landing`. `selectQualityPlan` (`quality-gate-browser-suites.mjs`) runs the page suite there and rejects unknown scopes.
- `canonical-ledger.yml` and `cloud-reconciliation-matrix.yml` each have a `scope` job. Their required job is skipped for `landing`; a skipped required job reports success.
- Pushes to `main` always run everything.

**Tests:**
- `scripts/ci-scope-tests.mjs` (quality gate): classification, fail-closed CLI and wiring.
- `quality-gate-shards-tests.mjs`: the landing plan.

For full PRs, ten Node suites run in their required cloud workflows only. The
complete local quality inventory still includes them. See
[CI efficiency](CI_EFFICIENCY.md#remove-duplicate-pr-execution-1039).

## Private repository: authenticated deployment checks (#742)

`python3 scripts/o2switch-deploy-tests.py` (quality gate, Linux) covers the read-only GitHub token in `~/.config/lumen/github-token`:
- `o2switch-ci-status.py` sends `Authorization: Bearer` only when `GH_TOKEN` is set;
- the exact-SHA path passes the token to the gate, and without a file the gate stays anonymous;
- a file that is not mode 600 stops the publish before any change, and the token never appears in the output;
- the fallback cron sends the token to a loopback API fixture (`LUMEN_GITHUB_API`, which only accepts `https://api.github.com` or `http://127.0.0.1:<port>`);
- both release scripts load the file under the same rules.
Not testable here: the real private repository. The owner checks a deployment after installing the token and switching the repository to private.

## Mobile UX stabilization (#793)

- `account-switch-browser-tests.mjs` covers startup with a stored session and no
  local profile, delayed hydration, A → B → A isolation, verified offline use,
  reconnect after an offline account switch, and recovery after an injected
  failure. These are synthetic accounts.
- `ux-lot-browser-tests.mjs`, `board-feedback-browser.mjs` and
  `guided-undo-browser.mjs` check stable board geometry, real pointer input and
  the highlighted cell when an assistance card is open.
- `victory-presentation-tests.mjs` keeps the two-second minimum, verifies that
  the podium can appear while longer effects are running, and checks reduced
  motion and cancellation when leaving the victory screen.
- Physical acceptance covers slow mobile data, airplane mode and reconnect,
  Safari and installed PWA, and Android Chrome. See #793 for the issue checklist.

## Install from the presentation page (#748)

- `scripts/daily-streak-pause-tests.mjs` (Node, quality gate, #752) checks that the Série de lumière ships paused: every player entry point is gated, guest and QA days are recorded without reward, a day recorded during the pause is never credited after reactivation, the enabled day-3 reward is unchanged and the server migration keeps history while rewards stay behind the flag. `scripts/fixtures/daily-streak-pause.sql` (ledger-sql) replays the paused and reactivated server claims, and checks that `feature_flags` is classified so that `review_erasure` still passes (fix `20261116195500_feature_flags_privacy_752.sql`).
- `scripts/fixtures/purchase-accounting-records.sql` (ledger-sql, #732) checks the minimal accounting record kept after a purchase deletion: no player access or identity column, `retain-rule` classification with a passing erasure review, nothing archived while the account exists, exact records with the final status, the Paris calendar-year retention boundary, other players untouched, and a purge of expired records only.
- `scripts/credits-tests.mjs` (Node, quality gate, #740) checks that the CC BY-SA attribution, its four links and the ShareAlike scope sit in the account menu (not in Mon ciel), and that `src/data/astronomy/NOTICE.md` exists. `scripts/credits-browser-tests.mjs` (browser, port 9264, `ci-credits.json`) opens the account menu as a guest at 360×640, expands « Crédits et sources », checks the links, readable text, no horizontal overflow, and focus return on close.
- #732 ready to sell: `scripts/sales-terms-tests.mjs` (Node, quality gate) mounts the offer in a minimal DOM: the never pre-ticked waiver box precedes the buy buttons, a click without it opens no payment and shows the reminder, a click with it passes `waiver.accepted` to `purchaseAdventure` (which refuses a missing waiver); no box where no purchase can start; the terms link. It also checks `cgv.html` (catalogue prices, TVA 293 B, L221-28 13°, minors, honest mediator status), the legal notice, the privacy « Achats » section, both release lists, and that `play-readiness` accepts `paid-content-no-ads` without a mediator blocker.
- Purchase restore (#823 / #730): `scripts/adventure-offer-tests.mjs` checks Play-only manual recovery alongside automatic hydration, and `scripts/play-billing-tests.mjs` checks the visible retry, confirmed rights refresh and account isolation. `scripts/stripe-handler-tests.mjs` checks automatic web restore of unsettled Stripe sessions.
- `scripts/purchase-thanks-tests.mjs` (quality gate, #730): thank-you model (catalogue name, whole sky, unknown product, no absolute promise), dialog semantics, focus, explore/later/Escape/backdrop each close it once without a leaked listener, one dialog at a time, and wiring after a server-confirmed Play or Stripe purchase only.
- `scripts/install-request-tests.mjs` (Node, quality gate) checks:
  - `?install=1` is read once and removed from the URL (other parameters and the hash are kept), before the first-visit welcome checks the URL;
  - the copy: native prompt, iPhone steps (including opening the QR arrival in Safari) or menu ⋮ steps, never a dead button;
  - the request skips the quest-12 rule but never asks an installed app, and waits for the welcome;
  - `#installOptin` is in the scripted-learning tap allowlist;
  - the page link, and the QR file regenerated from the vendored encoder, with its finder patterns.
- `scripts/install-request-browser-tests.mjs` (quality gate browser suite), for a new visitor at 390 px:
  - the welcome still plays, then the sheet appears;
  - a real tap on « Plus tard » closes it during the tutorial;
  - no repeat after reload, and a plain visit is unchanged.
- `scripts/landing-browser.mjs`: on phones the install link is shown and the QR is hidden; on computers (≥ 900 px with a fine pointer) the QR is shown and loads, and the link is hidden.
- Acquisition (#708) : `node scripts/acquisition-tests.mjs` vérifie la liste UTM, le référent de même origine, l’absence de collecte sans autorisation, les seules transitions de campagne en quête 1 et la tolérance aux échecs du transport ; #881 Lot 1 y ajoute la paire `player_invite` (Inviter distinct de Partager) et le canal `challenge_link` d’un document ouvert depuis un lien de défi, jamais sur la tentative elle-même. La suite Chromium de la page publique clique sur « Jouer » depuis un lien UTM et vérifie le référent reçu dans le jeu. Voir le [contrat de mesure](PRODUCT_ANALYTICS.md#mesure-dacquisition-708).
- Partage (#779/#759) : `node scripts/lumen-share-tests.mjs` couvre le contenu des payloads publics (dont les libellés « Constellation rallumée » / « Aventure accomplie » de #881 Lot 1 et les URL de campagne distinctes Inviter/Partager), l’annulation native et Clipboard. `victory-challenge-browser.mjs` vérifie en fin d’aventure le titre et le texte du partage, sans lien de défi. `credits-browser-tests.mjs` vérifie le menu invité au clavier en portrait, la copie desktop, la sélection manuelle et la conservation de la grille. `victory-layout-browser-tests.mjs` vérifie le partage du texte et du PNG après une vraie victoire QA. `quest-view-tests.mjs` et `late-game-tests.mjs` conservent la parité du contenu exporté après croissance du catalogue. `victory-pending-browser-tests.mjs` vérifie que l’action reste inaccessible jusqu’à confirmation et que la révélation garde ses dimensions. [Recette de publication](marketing/PARTAGE_LUMEN.md#recette-après-publication).
- QR: `node scripts/landing-qr.mjs` regenerates it, and `--check` verifies it. It was decoded once with an external reader during review; the test itself has no decoder dependency.
- Owner: scan the QR with an Android phone and an iPhone, and install from both.

## One layout on every screen (#749)

`scripts/desktop-layout-browser-tests.mjs` (browser inventory, report `ci-desktop-layout.json`) runs in two parts.

**Static check of `styles.css`:**
- the only wide-screen block left is the `@media (min-width:701px)` column block;
- no phone width condition (700/900/1100 px) remains, except the rules for landscape phones.

**Browser check at 390×844, 1024×768, 1440×900 and 1920×1080 (QA player past the tutorial):**
- no horizontal overflow;
- the phone header (account button) is present;
- there is no fixed side panel, and the quest banner and board stay inside the column.

From 701 px wide, it also checks that:
- the column is at most 520 px wide and centered;
- the board is larger than on a phone when the screen is at least 900 px tall, and at least 300 px otherwise;
- the actions are visible without scrolling;
- « Mon ciel » stays in the same 520 px column.

Phones keep exactly their previous rules: the transformation only removed desktop-only blocks and widened the phone conditions. All existing browser suites passed locally with the new layout.

## UX navigation / store #784 / #786

`quest-review-tests.mjs` and `adventure-offer-tests.mjs` extend the existing quality
gate: immediate accessible neighbours, unfinished views, stale ranking replies,
edge-safe gestures, incremental delivered content and provider prices.
For #817, the same mandatory browser suite also signs in with a simulated
profile and starts native Chromium touches on the real review podium, at
360×640 and 390×844. The board response replaces the touched skeleton during
the gesture. Both directions, ordinary taps, vertical and edge drags, and
button-origin gestures are checked along with unchanged progress. The unit
suite checks horizontal intent, pointer capture, cancellation and touch identity.
The same browser scenario samples rendered frames throughout the swipe and
the next ranking's delayed arrival. At 360×640 and 390×844 it checks the
dialog's horizontal position, opacity and scroll, and checks that a one-line
off-podium rank does not move the dialog or its actions when loaded.
`quest-review-browser-tests.mjs` exercises touch and keyboard browsing without
progress/attempt changes at 320/360/390/1440px and the actual store at 360/1440px.
Set `LUMEN_UX_CAPTURE_DIR` to an existing temporary directory to retain screenshots.
The existing sales-terms regression keeps consent before payment and checks both
checkout product IDs. No rules, server RPCs, save schemas or prices change.
An offer with no delivered additions is disabled and never claims ownership of
future or unavailable content.
Physical PWA/TWA native back gestures and live provider purchases remain separate
acceptance checks; browser fixtures do not demonstrate a real transaction.

## Android native update acceptance (#845)

See [the physical Play update matrix](../android/TESTING.md#recette-google-play-845)
for Play eligibility, the required and flexible flows and preserving session,
attempt and pending commands across an in-place update. The native JVM policy
tests and debug launcher smoke run in Android packaging CI. Web updates remain
covered by `scripts/app-updates-tests.mjs`. Android launcher copy is displayed
before the TWA and has no impact on onboarding steps or gameplay.

### Chantier 3 — offline, performances, mobile (#847, #851, #828, #830, #829)

- `offline-network-browser-tests.mjs` (Chrome, synthetic accounts): verified
  hydration writes the offline proof; airplane cold start and second restart;
  Auth refresh, RPC failure and silent backend while `navigator.onLine` is true;
  reconnection; another stored identity and a missing proof stay on the explicit
  offline screen with data untouched; no server write while unreachable.
- `attempt-engine-tests.mjs`, `official-time-tests.mjs`, `quest-review-tests.mjs`
  and the in-app `runHintTests()` case: reset keeps time, aids, errors,
  qualification and run identity; legacy attempts keep their begun id; refusal
  causes and the record/ranked comparison on the result screen.
- `hint-catalogue-audit-tests.mjs`: all published quests solved by the hint
  engine from empty, with and without automatic marking; quest 23 completed
  grid; no internal solver message.
- `landscape-layout-browser-tests.mjs`: 844×340, 844×390, 667×320, 932×430
  landscape, plus portrait and desktop: whole grid and controls visible, no
  overlap, no page scroll.
- `webkit-smoke-tests.mjs` (Playwright WebKit, non-blocking workflow
  `webkit-smoke.yml`, manual + nightly, about 4 s of tests locally): portrait
  quest, tap, hint, both landscapes, offline guest reload when a service worker
  is available. Not a substitute for Safari on a real iPhone.

Manual acceptance:
1. Android (Chrome or Play app), signed in: play online until « Progression
   synchronisée », airplane mode, close and reopen: the game opens (« hors
   connexion »), play and win a quest, reopen still offline, reconnect: the
   victory syncs once. Diagnostic: account menu → Diagnostic de synchronisation.
2. Wi-Fi without Internet (router unplugged): same as 1, the screen must not stay
   on « Chargement de ton ciel… » beyond about 25 s.
3. Reset: start a quest, use a hint, reset (read the confirmation), finish: the
   time and the +15 s remain; the result shows the ranked verdict. Replay after
   15 min: new run, ranked if better.
4. Quest 23 on iPhone: finish the grid while the account restores, then press
   Indice: the victory is validated, never a technical message.
5. iPhone Safari portrait then landscape (bars visible), quest 36: grid and the
   three buttons visible, no overlap; rotate twice.
6. Android edge gesture (#821): swipe from each screen edge on a running quest,
   inside the grid, on the ranking podium and between results. Record whether
   the system Back preview appears (Android setting « Navigation par gestes »).


### Supervision des performances (#948)

Run `node scripts/performance-sampler-tests.mjs` for opt-in, closed metric payload, owner switching, timers, and bounded animation sampling. The **Performance monitoring tests** workflow uses PostgreSQL 17 with `scripts/fixtures/performance-monitor*.sql` after the activity and incident migrations. It checks permission boundaries, separated cohorts, the sample floor, a simulated slowdown and a hydration failure-rate increase, stable notification keys, retention and revocation. The deployment smoke check and real mailbox receipt remain separate.


### Réglages de supervision et cadence (#947/#948, 24/11/2026)

`scripts/fixtures/monitor-settings-947-948.sql` runs after the #950/#947/#948 migrations and `20261124130000_monitor_settings_947_948.sql` (applied twice) in the **Performance monitoring tests** workflow; the critical-incident and health-cockpit workflows replay the same migration. It covers the default thresholds, a stale versus a recent hydration failure, the window setting, one recovery notice per episode, monotonic millisecond samples, the performance floor (4/4 silent, 5/5 alerts with medium confidence), pooled builds per period, the floor setting, capability-gated settings RPCs, CHECK bounds and privileges. `performance-monitor.sql` keeps its 19-versus-20 boundary by setting the floor to 20. `python -B scripts/lumen_critical_monitor_tests.py` checks millisecond samples, the hourly performance gate and that the host cron observes before draining without blocking it; `lumen_activity_mail_tests.py` checks the confidence line and that the recommended `LUMEN_ACTIVITY_KINDS` never claims signups (#950). `analytics-admin-browser-tests.mjs` checks the observation age and the confidence label. On Windows, run the Python suites with an interpreter that has `tzdata` (Europe/Paris digest).

### Cockpit et bilan quotidien (#949)

The `health-cockpit.yml` PostgreSQL job runs `scripts/fixtures/health-cockpit.sql` with the preceding observability migrations. It covers capability checks, verified signup and purchase sources, currency totals, timezone date bounds, outage state, aggregate privacy and one digest per local date. `python -B scripts/lumen_critical_monitor_tests.py` exercises local time and separate recipient routing with a synthetic transport. `analytics-admin-browser-tests.mjs` checks the health panel and filters through the real cockpit at 320, 390 and 1440 pixels, using mock Auth and database responses.


### External monitor deployment configuration (#946)

Run `python -B scripts/lumen_critical_monitor_tests.py` and `python -B scripts/lumen_activity_mail_tests.py` with their synthetic RPCs and transport. When changing `.github/workflows/lumen-external-monitor.yml`, verify that a manual run with the default input executes only the public probe without secrets. The observation job requires `main` and its activation flag and runs from the schedule or an explicit `record_observation=true` manual dispatch. Check both manual modes and the next schedule after deployment. The job shares the web release's `Production` environment and uses its secrets without creating a deployment record. Verify the environment's main-only policy before adding operational secrets. A real receipt test still requires approved access to SoldeZen and Brevo and a test mailbox.

`lumen-mail-receipt.yml` exercises the four scenarios and replay in disposable PostgreSQL on PRs and manual runs using a simulated transport. The o2switch receipt command checks the SoldeZen API schema read-only and submits four synthetic previews to Brevo. Verify provider acceptance and mailbox receipt separately. The monitor uses the observation RPCs without Brevo or mail claiming. Worker tests assert that the o2switch cron queues the previous local day at or after 08:15 and continues processing ordinary notices if the digest RPC fails.
