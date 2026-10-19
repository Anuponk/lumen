# Testing and quality gate

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

Before release, validate Google/password login and reload on an isolated account, recovery through password creation, guest discovery, and an existing account with cloud history. Never impersonate a real player's session or clear their local cache to test restoration. Affected-device session persistence is an outstanding manual check unless explicitly verified; production reads and mocked tests do not establish that result.

## Dynamic catalogue growth regression contract
Every change affecting content, progression, shop, sky navigation or saved state must test catalogue growth without source-code boundary edits:
- Existing catalogue N → N+k quests, with multiple appended Adventures of different sizes.
- First and final quest of each Adventure, crossing pack boundaries, and visible locked/unlocked packs.
- New constellations with varying quest counts and calculated stars; navigation/pagination beyond the first page.
- Previously complete cloud/local player resume into newly appended content without loss of badges, stars, currency or entitlements.
- Historical fixed quest numbers remain test fixtures only, not current campaign endpoints.
Tests should assert relationships derived from the content registry rather than a specific future total. Documentation alone is not proof of runtime coverage.

## Cloud persistence regression matrix

Grand Chien/Dauphin resume: `campaign-resume-tests.mjs` verifies boundary selection,
no redirect of running/paused attempts, stable-ID restoration, exclusions and
verified account-switch backups. The additional mandatory
`campaign-resume-browser-tests.mjs` exercises authenticated mobile startup at the
completed numeric boundary, the actual Next handler, reload of the started
canonical attempt and a second account. Profiles/RPCs are synthetic; no player
save or production write is used. The quality gate now runs eight browser suites.
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
