# Existing verification map

Incident investigation: `incident-investigation-tests.mjs` checks correlation,
partial state, privacy, grouped signals and actual loader account/capability
races. `incident-investigation-browser-tests.mjs` runs its shared review helper
in a dedicated browser at 390/1440,
checks native review/filter/revocation UI without creating issues or live RPC.

Report review uses real pointer clicks on visible controls in the independent
`scripts/fixtures/incident-investigation.html` document, avoiding the preceding
cloud-recovery scenario's expected reloads. Hidden/review/revoke/privacy and
capability assertions remain mandatory. It is the tenth quality browser suite,
using CDP 9235 and `ci-incident-investigation.json`; previous nine suites remain.

Optional diagnostics (#534): `diagnostic-reporter-tests.mjs` covers privacy,
transport/account races and actual Undo markers under historical fault injection.
PostgreSQL fixture/concurrency checks privileges, quotas, identity, consent and
retention. The account browser adds offline reload/reconnect and withdrawal
with native storage and synthetic Auth/RPC. See OBSERVABILITY_534 for limits.

Storage inventory/retention: `storage-maintenance-tests.mjs` owns privacy,
read-only measurement, archival/retention and failure/race coverage. The account
browser suite adds mobile touch and desktop/native IndexedDB checks, and the
quota fixture verifies space release without replacing the active profile.

Achievement backup quota (#536): `cloud-achievements-quota-recovery-tests.mjs`
covers alternate verified storage, interrupted sessions/local copies and closed
failure paths. `quota-recovery-browser.mjs` in the account suite fills native
localStorage on a blank disposable fixture and reads back the original from
native IndexedDB. This is storage validation, not a real-player repair.

Completed replay holds (#537): `campaign-presentation-tests.mjs` runs actual
detail/history renderers; `catalogue-access-tests.mjs` checks every published
completed ID. Account browser suite includes `completed-quest-hold-browser.mjs`
for native mobile touch and delayed/verified hydration with synthetic Auth/RPC.

Baseline: `bef5f32`. All paths are repository-relative. This phase indexes existing checks without changing tests or GitHub Actions. `docs/TESTING.md` retains execution contracts and detailed scenarios. Presence of a suite does not mean it ran or proves live production behavior.

## Select a check

Hydration #536: `cloud-achievements-session-recovery-tests.mjs` covers the exact
reported event ordering with synthetic discordant profiles and durable adapters;
`cloud-hydration-mirror-session-tests.mjs` covers the demonstrated late-mirror
account/client race. Both are mandatory in quality and cloud-reconciliation CI.
Physical Android and the affected player's unknown state are separate limits.

Session achievement recovery: `cloud-achievements-session-recovery-tests.mjs`
executes coverage, partial installation and the production hydration hook with
Auth event permutations, durable archive and simulated wallet fallback/restart.
`cloud-diagnostics-tests.mjs` verifies bounded server signals despite local
diagnostic failure. Device/real IndexedDB proof is separate; see #530 report.

Private physical-device preview: see
[`ISOLATED_VALIDATION_PREVIEW.md`](../ISOLATED_VALIDATION_PREVIEW.md) for the
existing Site identity, controls, offline/reconnect recipes, isolation check,
source archive and limitations. Its backend is simulated; PostgreSQL concurrency
and live account recovery require separate evidence. Historical local drivers
in the archive are reference text, not additional CI suites.

P0 integration (#248/#391/#398/#518): `cloud-wallet-command-tests.mjs` covers
lost replies, real durable outbox restart, cursor recovery and late-token account
changes; `cloud-wallet-reconciliation-tests.mjs` rejects unexplained balances.
Daily session, pending navigation, sync presentation, victory notification and
outbox health suites are required Node checks. `wallet-flow-browser.mjs` extends
the account runner with native button clicks, real browser storage and simulated
RPC; it does not prove real Android behavior. SQL fixtures run in PostgreSQL CI;
`wallet-command-concurrency.py` races duplicate and distinct competing spends.
The PWA runner checks offline public navigation with retained local/IndexedDB data.

Quest definitions / board feedback: `quest-definition-tests.mjs`,
`board-feedback-tests.mjs`, `group-hint-tests.mjs` are mandatory Node gates.
`quest-view-tests.mjs` guards stable-identity telemetry, both saved formats and
the live map refresh's stable card identity after insertion/reordering.
`board-feedback-browser.mjs` extends the existing browser runner with actual
placement, group hints and border-preservation checks. See TESTING for limits.

Issues #511/#513/#514: `social-challenge-ui-tests.mjs` executes the victory decision
matrix; `victory-challenge-browser.mjs` is imported by canonical replay tests.
`sky-issue-513-514-browser.mjs` extends the existing sky browser runner with rail
geometry/focus/touch and empty/partial/complete astronomical drawing checks.
See TESTING for synthetic transport and affected-device limits.

Astronomy source fidelity: `astronomical-fidelity-tests.mjs` (mandatory Node)
and CLI `audit-astronomical-figures.mjs`. Real overview/detail SVG fidelity and
clipping: `astronomical-rendering-browser.mjs`, invoked by the existing sky
navigation suite, all catalogue entries on three viewport sizes. Source fixtures
and their provenance are documented in `docs/ASTRONOMY_DATA_ATTRIBUTION.md`.

Card text/reward counters: `sky-navigation-browser-tests.mjs` measures text
ranges and exact counter totals in overview/detail/victory. Decorative geometry
and every increment/replay: `quest-secondary-stars-tests.mjs` (required Node gate).
Canonical Bouvier finale: `finale-responsive-browser.mjs`, imported by the
existing browser runner, seven viewports plus supported CDP safe-area overrides.
Guest account dismissal: account-session runner, repeated signup/login and
automatic post-victory offer; synthetic Auth only. See `docs/TESTING.md` for limits.

Readable existing Auth session with failed write probe: account-session browser
runner, mobile/desktop reload with synthetic session in localStorage and SDK
probe behavior simulated. Explicit logout/password recovery/account switching
remain covered. Real SDK 2.118.0 was additionally checked locally with blocked
provider requests; that check is distinct from the required fixture transport.

PWA update freshness: `service-worker-cache-tests.mjs` exercises actual worker
handlers; `service-worker-update-browser-tests.mjs` reproduces warm v9-to-v10
upgrade, stale HTTP module imports, a subsequent release with unchanged worker,
offline fallback and retained local/IndexedDB player data. Synthetic app, real
browser/service-worker/cache; no cloud writes or real-account recovery claim.

Historical command cutover and isolated recovery: `legacy-command-client-tests.mjs`
(actual scheduler/authority refusal/guards), `account-session-browser-tests.mjs`
(simulated mobile/desktop lost response and Auth resume), catalogue seed
check `legacy-command-fixtures.mjs --check`, generated SQL parity cases,
`fixtures/legacy-command-receipts.sql` and `legacy-command-concurrency.py`.
The SQL workflow uses disposable PostgreSQL; client simulations do not prove
transaction/privilege/concurrency behavior or live deployment. Details remain in
[the cloud matrix](../TESTING.md#cloud-persistence-regression-matrix).

From repository root, run a Node suite with `node scripts/<filename>.mjs` using the exact filenames below. Node 22+ is required; no npm install. Imports of JSON use import attributes. Each table row names executable files, not new proposed checks.

The table prioritizes the requested domains. For the complete current filename inventory without reading test bodies, use `rg --files scripts supabase/tests -g '*test*.mjs' -g '*equivalence.mjs' -g '*audit*.mjs' -g '*.sql' -g '*tests.py'`. Node membership is shared in `scripts/quality-gate-suites.mjs`; `scripts/quality-gate.mjs` orchestrates Node/browser checks. Not every standalone test is orchestrated there. CI scheduling, timing reports and comparison methodology: [CI efficiency](../CI_EFFICIENCY.md).

Phase 2: `npm run test:affected` / `node scripts/test-affected.mjs` selects the critical tier for known boundary edits and widens to the full client battery for uncertain impact. `--list` previews; `npm run test:full` runs the broad battery. [Commands, audit, regression proof and limits](../TESTING.md#local-affected-tests-phase-2). The gate now includes `unlocked-adventure-progress.test.mjs` and `test-affected-tests.mjs`; cloud restart and badge reload cases extend their existing suites. The phase 1 Adventure fixture failure below is corrected with separate locked/started coverage, preserving product rules.

| Domain / covered modules | Existing scripts under `scripts/` | Nature / scope |
|---|---|---|
| Campaign resume beyond numeric catalogue | `campaign-resume-tests.mjs`, `campaign-resume-browser-tests.mjs` | Authenticated mobile Grand Chien → Dauphin, canonical startup/reload/attempt identity and account-switch backup, using synthetic data and RPCs |
| Campaign cards / finale / prior badges | `campaign-presentation-tests.mjs`, `catalogue-access-tests.mjs`; browser `campaign-resume-browser-tests.mjs`, `canonical-replay-browser-tests.mjs`, `late-game-browser-tests.mjs` | Canonical counts/full illumination, historical Antlia access versus new-player order, actual finale and nonempty completion, previously earned Rapidité; no reward or player-data migration |
| Catalogue compatibility / acquired access | `catalogue-access-tests.mjs`, `catalogue-compatibility-tests.mjs`; `fixtures/catalogue-origin.sql` | Failing A/B reproduction, additive waves, local sequences, stable identities, all current new-player frontiers/reloads, UI start guard and immutable cloud cohort. SQL runs in disposable PostgreSQL only; real affected-device validation remains required |
| Divergence / profile reconciliation (`src/persistence/cloud-profile.js`) | `cloud-profile-transitions-tests.mjs`, `cloud-reconciliation-matrix-tests.mjs`, `cloud-bidirectional-reconcile-tests.mjs`, `cloud-safe-reconciliation-tests.mjs`, `performance-qualification-merge-tests.mjs`, `performance-conflict-details-tests.mjs`, `cloud-balance-reconciliation-tests.mjs` | Simulated storage/RPC, conflict, CAS and read-back assertions; qualification regression does not grant rewards |
| Hydration / guest recovery (`src/ui/game-screen.js`, persistence modules) | `first-login-cloud-restore-tests.mjs`, `cloud-hydration-stage-tests.mjs`, `partial-hydration-status-tests.mjs`, `cloud-achievements-local-recovery-tests.mjs`, `cloud-unsynced-recovery-tests.mjs`, `cloud-local-quota-tests.mjs`, `guest-transfer-tests.mjs` | Mix of executable helpers, VM-extracted UI functions and source contracts; not a real cache-loss/device test |
| Canonical ledger / badges (`src/persistence/canonical-progress.js`, outbox, UI) | `canonical-ledger-client-tests.mjs`, `canonical-ledger-contract-tests.mjs`, `canonical-ambiguous-ack-tests.mjs`, `canonical-outbox-tests.mjs`, `canonical-outbox-multi-device-tests.mjs` | Requested badges versus solved-only reply; ambiguous acknowledgement, account isolation and durable retry. Client RPC simulations are separate from real SQL fixtures |
| Server command identities | `canonical-command-client-tests.mjs`; `fixtures/canonical-command-receipts.sql`, `canonical-command-concurrency.py` in the SQL workflow; `account-session-browser-tests.mjs` | Exact receipt + current profile, lost reply, capability compatibility, session guards, atomic rollback and real concurrent SQL calls. Browser RPCs remain simulated; no production migration proof |
| Durable retry policy (`canonical-recovery-errors.js`, durable outbox, UI) | `canonical-retry-state-tests.mjs`, `canonical-durable-outbox-tests.mjs`, `canonical-outbox-recovery-tests.mjs`, `cloud-retry-scheduler-tests.mjs`; `canonical-replay-browser-tests.mjs`, `account-session-browser-tests.mjs` | Persistent auth/review holds, verified session resume, transient backoff, V1/V2 evidence retention and independent quests; real browser IndexedDB restart with simulated RPC, not a production-account test |
| Resume / cloud health (UI orchestration) | `cloud-online-retry-tests.mjs`, `cloud-resume-retry-tests.mjs`, `cloud-mirror-retry-proof-tests.mjs`, `cloud-diagnostics-tests.mjs`, `cloud-regression-matrix-tests.mjs`, `cloud-contract-check.mjs` | Reconnect/resume hooks, legacy mirror and independent diagnostic channels. Some assertions inspect/extract source; not blanket E2E |
| Performance / attempts (`src/campaign/performance.js`, progression, attempt engine) | `performance-badge-tests.mjs`, `performance-time-merge-tests.mjs`, `hint-assistance-badge-regression-tests.mjs`, `attempt-engine-tests.mjs` | Eligibility, same-run mastery, timing, assistance/error/reset evidence |
| Adventure access / navigation (content, canonical/playable navigation, sky) | `content-architecture-tests.mjs`, `unlocked-adventure-progress.test.mjs`, `playable-navigation.test.mjs`, `canonical-constellation-catchup-tests.mjs`, `sky-navigation-tests.mjs`, `locked-quest-icon-tests.mjs` | Pack access, preserved started access, accessible totals, catch-up, locks. Icon test inspects source/CSS; it is not visual browser proof |
| Auth / sessions (`src/persistence/cloud.js`, UI) | `account-email-login-tests.mjs`, `account-session-modes-tests.mjs`, `cloud-client-session-tests.mjs`, `cloud-session-guard-tests.mjs`, `oauth-return.test.mjs`, `persistence-tests.mjs` | Google/password/guest/recovery contracts, startup/event ordering and session guards; isolated simulations/source assertions |
| Auth mail (`src/auth/`, dedicated mail functions) | `auth-mail-otp-tests.mjs`, `auth-email-brand-routing-tests.mjs`, `auth-email-delivery-plan-tests.mjs`, `auth-email-hook-integration-tests.mjs`, `auth-email-ledger-contract-tests.mjs` | Historical filename `auth-mail-otp-tests.mjs` now includes rejection of retired OTP/magic-link login; recovery/confirmation and routing remain relevant |
| Social challenges (social/canonical challenge modules, UI, attempts) | `social-challenge-tests.mjs`, `social-challenge-ui-tests.mjs`, `issue-222-challenge-tests.mjs` | First-play eligibility, quest identity, terminal comparison and campaign isolation |
| Progression/daily (campaign modules, daily hydration) | `campaign-tests.mjs`, `late-game-tests.mjs`, `generated-progression.test.mjs`, `generated-rewards.test.mjs`, `daily-engagement-tests.mjs`, `daily-hydration-tests.mjs` | Legacy compatibility, catalogue boundaries, generated rewards and daily projection |
| Grids / astronomy | `audit-catalogue.mjs`, `difficulty-audit.mjs`, `validate-playable-astronomy-tests.mjs`, `astronomical-projection-tests.mjs`, `astronomical-catalogue-tests.mjs`, `content-architecture-tests.mjs` | Strict grid validity/uniqueness/proof replay; reference geometry/content contracts. See `docs/GRID_CATALOG.md` for full audits |

## Browser / aggregate commands

Phase 2 follow-up: `admin-catalogue.test.mjs`, `generated-adventure-map.test.mjs`, `staged-adventure.test.mjs` and `extended-boundary.test.mjs` now run inside the gate. Their obsolete catalogue/access expectations are corrected with retained identity, locked-access and historical-save assertions; [causes and red/green evidence](../TESTING.md#follow-up-four-obsolete-standalone-suites-corrected).

- `node scripts/quality-gate.mjs`: authoritative list of currently orchestrated Node suites plus nine browser runners. Starts its own server/browser and writes reports under `docs/validation/`. Needs Chrome/Chromium/Edge; set `LUMEN_CHROME_BIN` if needed. Some differential suites need Git and their historical baseline. Do not infer total case counts from old reports.
- Browser runners: `scripts/account-session-browser-tests.mjs`, `scripts/browser-tests.mjs`, `scripts/ux-cleanup-tests.mjs`, `scripts/learning-browser-tests.mjs`, `scripts/late-game-browser-tests.mjs`, `scripts/sky-navigation-browser-tests.mjs`, `scripts/canonical-replay-browser-tests.mjs`. Prefer aggregate orchestration; standalone setup/server/CDP/report arguments are documented in `docs/TESTING.md` and runner headers. Use isolated temporary profiles.
- `await window.runHintTests()` and `await window.lumenDiagnostics.runAllHintTests()` execute `src/testing/hint-tests.js`; these exercise real local state. Never use a player's authenticated profile. `scripts/engine-equivalence.mjs` and `scripts/ui-equivalence.mjs` compare a historical baseline; check setup in `docs/TESTING.md` first.

## SQL and other checks

`scripts/fixtures/canonical-ledger-bootstrap.sql`, `scripts/fixtures/canonical-ledger-replay.sql`, `scripts/fixtures/canonical-snapshot-guard.sql` and `scripts/fixtures/sync-health-incidents.sql` exercise real migration behavior in disposable PostgreSQL. They cover replay/idempotence, snapshot protection and incident signals. Bootstrap deliberately creates `auth`/`lumen` schemas; never run these against a player database. See `docs/TESTING.md` for the existing SQL regression procedure. `supabase/tests/391_isolated_reward_ledger.sql` and `supabase/tests/391_profile_preflight.sql` are additional existing SQL checks; inspect their prerequisites before execution.

Deployment checks also exist as `scripts/o2switch-deploy-tests.py` and `scripts/o2switch-https-tests.py`. They are indexed only; deployment/Actions optimization belongs to phase 3.

## Gaps and limits, without corrections

- Simulated RPC/session tests cannot prove live provider configuration, grants/RLS, installed-PWA storage retention or cross-device restoration. Affected-device login/reload and isolated live-account recovery remain separate manual checks described in `docs/TESTING.md`.
- Source/VM contract assertions can miss browser wiring/timing problems; a suite name alone does not establish E2E coverage. Canonical replay and account-session browser runners reduce this gap but do not prove real network/device behavior.
- `sw.js` has network-only navigation; a warm open board/offline pending victory is distinct from cold offline launch. No complete cold-offline support is claimed.
- Legacy balance reconciliation is an approximation, not a reconstructed spend/refund ledger; see `docs/architecture/dependency-map.md`. Do not declare all cloud contract scenarios implemented from passing client simulations.
- This is an index, not line/branch coverage measurement. Existing historical reports are evidence of their recorded revision only. Phase 1 checks and exact results are reported in the PR; full gameplay/browser/SQL suites are not required by a documentation-only change and are not implicitly claimed.

## Phase 1 checks (2026-10-18)

- Passed: `performance-qualification-merge-tests.mjs`, `canonical-ledger-client-tests.mjs`, `performance-badge-tests.mjs` (14 cases), `sky-navigation-tests.mjs`, `content-architecture-tests.mjs`, `cloud-contract-check.mjs` (commands prefixed with `node scripts/`). The content/policy checks pass with mandatory root contract phrases retained; no test changes were needed.
- Existing failure: `node scripts/unlocked-adventure-progress.test.mjs` fails at line 15, expected `{completed:1,total:2}`, actual `{completed:3,total:4}`. Reproduced independently on untouched `bef5f32`. Its fixture contains a solved quest in the nominally locked extra pack; current `hasPackAccess` recognizes that as started access. This is a fixture/expectation mismatch with the implemented access rule, not evidence that current players should lose access. Left unchanged for a separate phase.
- All documented concrete paths/links and the three symptom routes were checked; moved contracts were compared with the original, allowing only introduction and relative-link edits. `git diff --check` passes. Full quality gate, browser, SQL and live-device checks were not run in this documentation phase.

Guest registration, guided undo and universal badge eligibility: `guest-account-tests.mjs`, `guest-account-hydration-tests.mjs`, `guided-undo-tests.mjs`, `performance-badge-tests.mjs`; real browser interaction and SQL parity supplement these isolated fixtures (#528/#533/#529).
