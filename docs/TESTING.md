# Testing and quality gate

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
Authenticated acquired/started replay access remains held beyond discovery
while cloud restoration is incomplete; guests retain their acquired access.
The badge UI regression also reads the actual rules dialog: four badges from
quest 1 and a fifteen-minute qualification cooldown, without obsolete daily locks.
`quest-command-tests.mjs` checks exact V2 receipts, ambiguous/lost responses,
current wallet decreases, account switching and explicit V1 compatibility.
Admin recent-player tests execute the actual metrics/timeline renderers.

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
new session. Both suites run in the quality gate and Cloud reconciliation matrix.
See [the #536 report](validation/2026-10-23-hydration-536.md); physical Android
and Rachel's actual reward divergence still require separate non-destructive
verification. All prior cloud, wallet, canonical and SQL regressions are retained.

## Guest, guided undo and first-quest badges (#528/#533/#529)

`guest-account-tests.mjs` and `guest-account-hydration-tests.mjs` cover guest ownership, exact backup, registration through the actual UI hydration hook, second-device installation, repeated auth, offline and interrupted verification, account change and existing-cloud preservation. Ambiguous balances retain both copies and hold instead of guessing a transaction. `guided-undo-tests.mjs` executes the actual Undo handler with pending/deferred conflicts; mobile browser smoke additionally exercises real conflict → Undo → new move. `performance-badge-tests.mjs` and embedded tests cover eligibility from quest 1, same-run awards, assistance, qualification cooldown and persisted badges. SQL parity runs the new eligibility migration before comparing current client/server outcomes, while retaining old receipt/wallet regressions. No real player fixtures or production Auth emails are used.

## Session achievement recovery — #530

Storage inventory/retention: `node scripts/storage-maintenance-tests.mjs` covers
fixed-category privacy-safe sizes, unavailable stores, independent browser quota,
read-only existing IndexedDB inventory, exact archival, keep-two retention,
idempotence, failed open/write/read/commit, conflicting archives and session,
owner, live-profile and source races. It is mandatory in quality/reconciliation.
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
`catalogue-access-tests.mjs` distinguishes historical Antlia access from a
current-cohort prerequisite refusal and checks repeated serialization without
reward mutation. These are synthetic tests, not affected-account evidence.

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

## Cloud persistence regression matrix

Historical/rollout preparation: `historical-rollout-tests.mjs` covers byte-level
inventory and unknown fields, foreign owners, ambiguous balances, immutable
account-bound guest manifests, denied storage, lost replies and receipt reads,
independent receipt/profile verification, session changes and strictly scoped
old-server fallback. It also refuses mocked/stale/shared-production rollout
proofs and premature retirement. The account browser suite adds
`historical-claim-browser.mjs` with native localStorage and Web Crypto; Auth/RPC
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
`CLOUD_WRITE_REFUSED`, and a false CAS result becomes `CLOUD_CAS_CONFLICT`.
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

This gate runs in both the unified quality gate and Cloud reconciliation matrix.
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
The app exposes `await window.runHintTests()`; the 66 original cases plus three UX regressions (#16/#17/#19) live in `src/testing/hint-tests.js`. The narrative assertion now reads the on-demand rules modal. `window.lumenDiagnostics.runAllHintTests()` runs the suite for every size. The suite runs cases sequentially and waits for asynchronous victory/reveal behavior. It covers, among other things:
- PWA install timing and standalone behavior;
- sharing/referral and account/profile behavior;
- reminder opt-in rules;
- continuous sequential progression;
- catalogue-driven campaign size, constellation mapping and exact per-constellation/total star rewards;
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
