# Cloud recovery delivery and remaining cutover (#391)

This is a staged implementation record, not a declaration that #391 is closed.

## Player-favorable recovery candidate (25 October 2026)

The approved free-game policy is implemented by the existing hydration fallback
and an additive `lumen_reconcile_acquisitions` RPC. See the owning
[positive acquisition contract](DATA_AND_ARCHITECTURE.md#positive-acquisition-recovery--391-25-october-2026).
The snapshot lock, CAS baseline, immutable originals and verified current read
make retries safe. No per-player, conflict-index or application-version rule is
used. Ordinary CAS/backup writers retain their existing protections.

Deployment requires reviewed application of
`20261025093627_player_favorable_acquisitions.sql` and the matching client.
The migration has no backfill, cohort enrollment or automatic production job.
Client-before-SQL remains safe: a missing endpoint retains the existing partial
recovery. Rollback keeps archives, receipts and projection guards; do not undo
recovered player data. This candidate has no production authorization.

Known limits: unknown quest identities are archived pending compatible content;
unknown noncritical metadata is retained in originals rather than interpreted.
An unproven local currency credit is not restored as spendable shards. Confirmed
server spending remains effective while known quests become accessible. Real
Android/PWA and two physical devices remain acceptance work after review and an
approved release; simulated transport/SQL tests do not establish field recovery.

## Final delivery evidence (22 October 2026)

The owner explicitly authorized both production SQL migrations, the final merge
and deployment. Production applied `20261022082153_wallet_command_authority`
and `20261022082203_outbox_health_observations`. Supabase assigned these versions;
the reviewed SQL from candidate `65770fa` is unchanged. Repository migration
filenames and the isolated PostgreSQL workflow match that history. No backfill,
player repair, fixture or additional paid resource was created in production.

Post-migration checks confirm the three tables have RLS and deny direct reads to
both client roles, historical commands adopt the wallet projection and the
capability-gated cockpit includes outbox health. Required candidate CI passed
quality, cloud-contract, reconciliation, ledger-sql and docs-consistency; the
metadata-only delivery commit requires those same gates before the single merge.

The owner's Android recipe on the free isolated preview v2 confirms two pending
victories in airplane mode with Wi-Fi disabled, followed by confirmation after
reconnection and reload. That preview uses simulated Auth/RPC; it does not prove
live Supabase transport or the installed-PWA update scenario. The v1 fixture's
false acknowledgements under a stale navigator.onLine were reproduced and fixed
in the preview only; uncached HTTP reachability gates every synthetic RPC. Browser
checks cover normal and stale connectivity indicators, offline restart and
one-time replay without duplicated rewards or debits. The owner separately
reports Loutre resolved; do not attribute that recovery to this unreleased code.

Production publication, operational retention scheduling and live observation
must be recorded after their actual verification. Keep the issues requiring
those results open; schema application and merge alone do not prove completion.

## P0 integration and recovery runbook (22 October 2026)

Baseline: `650a39b904970221a4a42c28073dade92d9f5617`. Work is integrated on one
topic branch; no intermediate merge or publication. #470 stays outside the lot
and its completed phone recipe is retained; #468 retains general refactoring.

Prepared work covers daily session isolation, wallet commands/receipts and
snapshot guards, exact-cursor reconciliation, pending-only navigation,
non-blocking celebrations and outbox health observations. It does not authorize
production SQL, deployment, player repair or closure of the four tracking issues.

Profile restore, initialization and CAS have additive expected-account overloads.
The P0 client captures its owner/client before hydration awaits and binds these
requests on the server; delayed SDK token changes cannot install a foreign
profile before the UI auth callback. An unresolved startup session cannot award
a guest victory from a restored solved board. Legacy zero-argument readers and
existing writers remain available to old clients under their existing guards.
After acknowledgement, a restored solved historical board reads its existing
operation receipt and current profile before celebrating. It does not recapture
elapsed time or create a changed intention for the same immutable identity.
An offline receipt lookup still retains a durable victory before holding.

### Diagnose without changing player data

1. Record document/module build, PWA/browser mode, account context and the bounded
   diagnostic event/stage/code. Never copy tokens, email or complete saves into logs.
2. Distinguish capture failure, retained durable intention, receipt read failure,
   stale cursor, protected-field conflict and failed cache installation. A health
   observation or solved flag alone is not a command acknowledgement.
3. Preserve the local/remote originals and existing outbox/attempt stores. The
   export action is available without purging or resetting player state.
4. Verify the same expected account and exact operation request, independently
   read its receipt, then read the current profile. Replay the same identity after
   a lost reply. Never reinstall the old profile from a receipt.
5. A verified wallet receipt may restore only its exact delta/cursor with all
   unrelated local fields preserved. Corruption, quota, unknown fields, contradictory
   evidence or missing authority remain an actionable hold. Do not infer old debits
   or grants from their maximum or convert pre-command wins automatically.
6. For an ambiguous historical divergence, prepare a separate evidence-backed
   recovery proposal. No real-player write/backfill is part of this lot.

### Observation and alerts

The existing capability-gated sync-health cockpit adds private per-client outbox
observations: pending count, oldest pending timestamp, failures, state, release
and bounded platform. Device/session IDs are random UUIDs, never Auth tokens or
emails; operation IDs, requests, profiles and reward facts are excluded. A server
expected-account assertion prevents late-token changes from attributing an old
observation to another account. Sequence/session-start ordering rejects old packets.

Alerts cover critical preservation immediately, unresolved operations at fifteen
minutes, three failures and twenty pending operations. Their keys stay stable
for an unresolved incident; retries do not reset its age. The cockpit displays
them once per row rather than creating repeated player toasts. This is a cockpit
alert, not a claim that email/push delivery has been installed.

`lumen_commands.prune_sync_observations()` removes only resolved metadata older
than thirty days, with no player access. Production scheduling requires a reviewed
operator/cron step after migration approval. Unresolved incidents and all command
receipts remain retained; dropping receipts during rollback would break idempotence.
Denied browser storage may force a new random client ID on reload; a badly skewed
device clock may delay observation acceptance. Neither condition changes gameplay
or proves recovery. Diagnose stale observations rather than clearing unknown work.

### Delivery and rollback boundaries

Do not merge before the complete lot's applicable gates and Android exit recipe.
The migrations were applied with explicit owner authorization, as recorded above.
Rollout must coordinate the wallet-aware
client, additive SQL and old-PWA update path. Existing old clients can require an
update after wallet activation; the server guard must remain active.
Rollback retains authority, receipts and durable intentions. Returning to a client
that debits local currency is not a safe rollback for an activated account.

Candidate CI, the device offline/reconnection recipe and the owner's Loutre
confirmation are recorded above. Installed-PWA update and actual production
publication/observation remain distinct evidence, never inferred from emulation.

Local validation completed on 22 October: `npm run test:full`, 30 outer suites
with zero failures; its quality gate contains 114 Node suites and nine browser
paths (379.8 seconds), plus 29 complementary outer suites. The catalogue audit
and embedded hint regressions passed. Targeted historical-command tests pass
31 cases, including acknowledged-run restart and offline receipt lookup.
PGlite exercised the prepared SQL with existing catalogue-origin guards: wallet
receipts/rollback/daily/baseline refusal/account isolation and outbox alert/retention
fixtures passed. PGlite is distinct from PostgreSQL 17 concurrent CI and live
Supabase. No Android, Loutre, production SQL or deployment result is implied.
`main` required checks and administrator enforcement were applied and verified
by a separate GitHub settings read; see `docs/RELEASE.md`.

### Remaining risks and issue decisions

| Priority | Remaining condition | Required evidence / response |
|---|---|---|
| P0 release | Wallet activation changes the authoritative writer; old clients can hold after activation | Coordinate approved additive SQL, candidate client and PWA update. Keep server guards and receipts during rollback |
| P0 exit | Android preview offline/reconnect passes; owner reports Loutre resolved; installed-PWA update and live candidate transport remain distinct | Preserve recorded evidence and verify actual publication/device update. No real profile repair is authorized |
| P1 recovery | Unknown fields or unreceipted historical currency/daily credits cannot be safely inferred | Keep both originals and a visible review hold; reconcile by audited evidence, never max/reset/backfill |
| P1 operations | Server observations and retention need approved rollout and operator scheduling | Verify capability-gated alerts and resolved-only pruning after application. Offline clients cannot report until transport returns |
| P2 update | Interrupted loads do not provide atomic replacement of the complete module graph | Verify actual module/build versions and retained stores on device; do not purge player data |

| Issue | Candidate contribution | Closure recommendation |
|---|---|---|
| #248 | Permanent ownership contract, field inventory, PR declaration and five enforced checks on `main` | Contract scope is ready for review once exact-SHA CI passes; do not infer #391/#398 completion |
| #391 | Wallet/daily commands, immutable receipts, guarded reconciliation, durable pending navigation and restart recovery | Keep open until approved rollout and Android/Loutre recovery evidence; ambiguous profiles stay explicitly tracked |
| #398 | Cross-cutting regression gates, isolated SQL/chaos/browser coverage, private aggregate cockpit alerts and retention function | Keep open until PostgreSQL CI, real Android/Loutre, operational retention and live observations are demonstrated |
| #518 | Four sync states, pending celebration and star, deferred persistent warnings, immediate preservation-risk notice | Keep open until candidate CI and actual Android celebration/recovery recipe are validated |

### Android candidate exit recipe (partial device evidence recorded above)

Use an isolated test account and record exact server/document/module SHA,
Android version, browser/PWA version and installed mode. Do not clear a real
player's storage. Capture before/after confirmed currency, rewards, attempt and
outbox counts without publishing the save payload.

1. Confirm a normal victory and paid help; reconnect from a second device and
   verify the same confirmed acquisitions and lower balance after the spend.
2. In airplane mode, finish two accessible quests. Both celebrations and pending
   stars stay visible; navigation continues without granting confirmed rewards.
3. Close and reopen the installed PWA offline. Restore the board/intents; return
   online, replay each original identity and confirm exactly one reward/debit.
4. Interrupt a response after server commit, restart and retry. Verify the exact
   receipt/current profile, original elapsed time and no recreated intention.
5. Update the worker during pending work, then reopen. Verify actual imported
   module versions, retained localStorage/IndexedDB and recovery without reset.
6. Exercise persistent failure and local-preservation failure in an isolated
   fixture: deferred actionable status for protected work, immediate explicit
   warning for real preservation risk, export available, no false synchronized state.
7. Separately validate the Loutre divergence under its approved diagnostic
   procedure. The general test account and the completed #470 phone recipe do
   not establish recovery of that historical account.

## Attempt-counter refusal (2026-10-20)

The post-#492 report localizes the refusal to a cumulative performance attempt
count. Reproduced the same counter-only CAS refusal in disposable PostgreSQL.
The client already merges cumulative attempt summaries by maximum without
reapplying rewards, while the authority trigger required exact counter equality.
Migration `20261020084328_legacy_attempt_counter_metadata.sql` permits only a
valid monotonic counter update with all other reward/evidence fields exact,
retaining CAS, private authority consistency and immutable receipts. No profile
backfill or reward conversion occurs. Production application was explicitly approved and completed on 2026-10-20
after PostgreSQL 17 and all other PR #493 checks passed. Supabase assigned
version `20261020084328`; only the source filename/references were aligned,
without SQL or production-history edits. Read-only postchecks confirmed private
function permissions, fixed search paths and consistent authority projections.
No player fixture, profile backfill or Auth change was performed. The existing
client can retry against the active server correction; affected-device sync
confirmation remains outstanding. Unknown/contradictory reward facts remain held for review.

## Follow-up after field-transition fixes (2026-10-19)

Baseline `fd31a22` includes #483 (account-menu diagnostics), #484 (exact server
revision classification), #485 (shared field policies/transition tests) and #486
(safe CAS refusal codes). The latest mobile report identifies
`LEGACY_COMMAND_REQUIRED` during bidirectional reconciliation; it does not
identify which local reward facts differ, nor prove they can be reconstructed.

Reproduced two remaining boundaries before correction: the exact historical
authority refusal escaped as a generic restore failure, and queued historical
commands were held behind full hydration even when canonical commands could
recover independently. Both reconciliation paths now preserve their existing
two recovery copies and return a partial hold for this exact refusal only.
Independent queued historical commands use their existing transaction/receipt
protocol under the same account/client-bound verified recovery permission,
with a shared replay lock and all active-play/Auth/visibility holds retained.
Partial recovery neither replaces local data nor reloads or declares full sync.
Other write errors retain their failure semantics; there is no fallback writer.

Authority-refusal diagnostics now identify differing protected field names and,
for the first numeric performance entry, known key names. Unknown keys are
redacted and values/cooldown timestamps are omitted. This comparison describes
the attempted snapshot versus the verified cloud read; it does not prove the
origin or validity of a local reward, or grant an alternate write path. A new
report is still needed to localize the affected device's divergence.

This is not automatic repair of ambiguous pre-command wins/imports. No player
save is rewritten, no reward facts are invented and new gameplay remains gated
while its baseline is unresolved. Audited recovery, standalone daily/spending
authority and production observation remain open. No SQL/Auth change is needed.
See DATA_AND_ARCHITECTURE for the current authority contract and TESTING for
the executable Node and simulated mobile/desktop regression coverage. Historical
delivery notes below describe the state at each earlier stage.

Historical cutover follows deployed #479 (`1.11.1+463 · b97154b`). Production
migration `20261018193133_legacy_victory_commands.sql` was approved, applied and
verified on 2026-10-18. Its SQL is identical to the reviewed migration; the file
was renamed to match the Supabase-assigned version without editing production
history. Client publication awaits verification of the merged SHA.
It adds immutable historical receipts, catalogue-derived rules, atomic daily/mirror
effects and per-account authority guarding old snapshot reward writes. See
[ownership and rollback](DATA_AND_ARCHITECTURE.md#cloud-persistence-contract) and
[client/SQL validation](TESTING.md#cloud-persistence-regression-matrix).
Standalone daily/spending writers, global hydration decoupling, audited recovery
of ambiguous pre-cutover data and production observation remain open in #391.
Updated baseline: `b1c272eb46c958d04adfb1fd8b06fbb49214951f` (2026-10-18),
including the deployed performance-summary compatibility fix #473.

The durable outbox step #472 is deployed as `ba9bf44` (version 460).
Isolated background replay #477 is deployed as `88b2c61` (version 461).
Persistent retry holds #478 are deployed as `30a07e8` (version 462), with owner
mobile confirmation. The current follow-up prepares server command receipts;
the production migration and remaining writer cutover are still separate steps.

## Prior delivery record (before the P0 integration above)

The following inventory and validation describe earlier delivered stages. The
P0 section above supersedes their planned cutover and migration status; neither
section declares production rollout or issue closure.

### Reproduced incidents

The mobile diagnostic supplied on 2026-10-18 reports build `1.11.1+452`,
`9533f82`, `reward_conflict` on `performances[183].lastQualifiedAt`, followed
by `hydration_partial_reconciliation_pending` and blocked victory flushes.
No account identity, token, save or diagnostic payload is copied here.

That build precedes #465 (`bef5f32`), which merges valid qualification metadata
without treating its timestamp as an immutable reward receipt. The existing
`performance-qualification-merge-tests.mjs` protects both device orders,
cooldown preservation, old records, conflicting evidence, CAS and failed read-back.
It passes locally. A later incompatible comparison of cumulative performance
schema metadata was corrected by #473: known V2/V3 formats and cumulative
attempt/star summaries now reconcile without awarding anything. Recovery of
the reported mobile incident was confirmed after deployment of
`1.11.1+458 · b1c272e`. This is one live recovery confirmation, not validation
of every cloud path. Preserve local progress and pending wins; never ask the
player to clear application data.

The following additional failure boundaries were reproduced before correction:

| Failure | Before | New contract |
|---|---|---|
| First queued quest refused | Later independent quests never attempted | Keep refused intent and continue independent quests; retain same-quest order |
| Stale solved-only result | Requested badges could be discarded by generic replay | Require solved plus every requested earned badge before removing the intent |
| Async durable adapter | Replay iterated a Promise | Await queue reads and acknowledgement transactions |
| Corrupt record | Strict V1 enumeration stopped recovery of every victory | Preserve/report corrupt records and recover independent valid records |
| Local storage denied/full | No alternative durable intent store | Verify an IndexedDB transaction; fall back to verified localStorage |
| Separate runs of one quest | A single per-quest slot could retain only one run | Separate immutable V2 operation IDs; acknowledge only the matching operation |
| Connectivity returns once | Another transient failure waited for a new online/resume event | Bounded exponential backoff with jitter while safe replay remains possible |
| Online and timer race during durable read | Both could enter replay before its guard was set | Acquire the guard before the first await, release it on all exits |
| One store temporarily unreadable | An empty other store could stop recovery | Expose incomplete inspection, keep a pending check and bounded retry |
| Account change before queued work starts | A cancelled microtask could still run | Recheck generation and readiness before invoking recovery |

## Intent ownership and compatibility

`durable-canonical-outbox.js` stores only unacknowledged canonical victory
intentions. It does not grant ownership, write balances or confirm a victory.
The transactional server ledger and verified read-back remain authoritative.

V2 records have `version`, `operationId`, `userId`, `questId`, `reward` and
`createdAt`. Gameplay derives the operation ID from the persisted attempt ID
and reset counter; retries reuse its frozen reward evidence rather than sampling
a later clock value. Reward evidence is immutable for an operation ID. These operation
IDs currently identify client outbox records; the existing RPC still deduplicates
first-completion rewards by player/quest. This is not yet a general server command
receipt protocol for legacy rewards, spending or daily operations.

IndexedDB `lumen-canonical-outbox` / `intents` is preferred; localStorage is the
fallback. Neither a resolved request nor JS memory counts as a durable write:
the transaction must complete and its value must be read back. If both stores
fail, gameplay reports that local preservation is not confirmed.

Existing `lumenCanonicalVictoryOutboxV1:<user>:<quest>` records stay readable
in place. V2 keys are `lumenCanonicalVictoryOutboxV2:<user>:<operation>`.
Malformed, cross-account or conflicting copies are retained for recovery and
reported through bounded diagnostic reason codes. They are never deleted as
part of enumeration. A conflicting copy cannot be used as acknowledgement.
Acknowledgement removes only a matching immutable operation after server proof.
A local cleanup failure does not invalidate a verified remote victory; the
remaining record can safely replay against the existing idempotent ledger.

Older clients ignore V2 records and the new IndexedDB store. A rollback must
preserve them and require a compatible client for their recovery. Never downgrade
by clearing storage or translating pending wins into whole-profile writes.
An unacknowledged local intention cannot survive deletion of all local storage.

## Recovery scheduling and current holds

`cloud-retry-scheduler.js` coalesces concurrent signals and retries with jitter,
starting at 1–2 seconds and capped at 60 seconds. An empty queue stops retrying.
Account changes cancel the old schedule; replay checks the captured account and
client after each asynchronous commit before removing data.
The replay guard covers asynchronous queue reads too. Cancellation before the
first microtask prevents the old scheduled run from starting for another account.

An empty readable store is not proof that an unreadable store has no intentions.
Inspection exposes whether both stores were read; incomplete reads retain a
visible pending check and bounded retry even when no valid entry was enumerated.
No missing/unreadable record is treated as acknowledged or deleted. A permanently
denied backend may therefore retain this status; readable valid entries can still
recover, while retries remain subject to the normal visibility/auth/profile holds.

Automatic replay remains held while the document is hidden/offline, auth or
password recovery is pending, an active canonical quest exists or a profile
write is busy. A normally ready but dirty profile still holds replay.

After same-owner hydration has verified the remote profile but cannot reconcile
local legacy data, it records an ephemeral permission bound to that user and
exact cloud client. This permits queued canonical ledger replay despite full
profile readiness remaining false or local legacy changes remaining dirty.
The ledger RPC locks and changes its server snapshot transactionally; snapshot
CAS remains guarded against stale writes. No local snapshot, in-memory progress,
currency, baseline or legacy writer is changed by this isolated recovery.
Read-back must confirm the requested badges before the intention is removed.
There is no reload on isolated success, and the global partial-sync status stays
visible. The permission is cleared on account/client replacement and new
hydration; a restore error alone cannot authorize it.

This is background intention recovery, not an unlock for new canonical gameplay,
new legacy wins, daily rewards or spending while a legacy conflict remains. Their
remaining global hydration dependency still requires the writer/authority cutover.
Invalid/server-refused operations are preserved. The following retry policy
adds explicit holds without declaring a server refusal permanently invalid.

### Persistent retry holds

`canonical-recovery-errors.js` classifies structured error codes and HTTP status
after a verified read-back attempt. A thrown RPC error follows the same read-back
path as a returned error, because a lost response may follow a committed reward.
Confirmed completion and all requested badges still acknowledge the intention.
Provider messages, details, payloads and tokens are not retained in retry metadata.

| Unconfirmed result | Recovery policy |
|---|---|
| Network/unknown failure, HTTP 408/429 or 5xx | Existing bounded retry; never infer permanent invalidity |
| HTTP 401 or `PGRST301`/`302`/`303` | Persist an account auth hold; verified authenticated read required before release |
| Explicit HTTP 400/403/404/413/422, validation/permission codes, unavailable quest | Persist a review hold for that quest; independent quests continue |

Status 5xx/408/429 takes priority over a structured refusal code. `P0001` is a
generic server exception, not proof of bad player data; the UI requests review
and retains the intention. The code/status mappings follow the
[PostgREST error reference](https://docs.postgrest.org/en/stable/references/errors.html).
Unknown errors remain retryable rather than being silently classified as invalid.

Retry metadata has its own `lumenCanonicalVictoryRetryV1:` prefix in the existing
IndexedDB `intents` store or verified localStorage fallback. Keys bind the user
and V2 operation (or V1 quest); `intentCreatedAt` also binds the exact intention.
Fields and restore/rollback policy are owned by the
[cloud persistence contract](DATA_AND_ARCHITECTURE.md#cloud-persistence-contract).
Every held intention remains returned by `pending`; inspection separately exposes
`paused`, `retryable` and `authRequired`. The scheduler stops network replay for
known held work; incomplete storage reads can still retain bounded storage checks.
Later intentions for the same quest retain their order. Auth holds cover the
account queue because its credentials are shared.

A new verified hydration or a deferred `SIGNED_IN`/`TOKEN_REFRESHED` handler may
clear only auth holds after a successful profile read with the same user/client.
The latter does not install a profile, clear the global legacy failure or reload.
The **Réessayer** action explicitly clears the current account's policy metadata,
then rehydrates; it does not acknowledge or rewrite pending rewards. Review holds
survive token refresh. Corrupt metadata remains held/reported until explicit retry.
If both stores reject the pause write, a session-only hold prevents immediate
loops but cannot promise the hold survives restart; durable victory evidence
remains unchanged. Earlier clients ignore these new sidecars and can resume their
old retry behavior after rollback. Recovery still requires a compatible client
for V2 intentions. No server schema or reward authority changes in this phase.

## Writer inventory and cutover still required

### Command-receipt foundation under review

Production DDL was separately approved and applied on 2026-10-18 as migration
`20261018153436_canonical_command_receipts.sql`. Supabase assigned this applied
version; the earlier review filename was renamed to match it with identical SQL.
Production migration history was retained unchanged. Post-application metadata
checks confirmed function signatures, invoker/definer boundaries, empty search
paths, RLS and denied direct client table access; advisors added no notices.
No player profile was rewritten. Client merge/deployment verification remains
a distinct release step.

The inventory confirms that legacy victory orchestration still combines local
completion, performance, daily activity and currency before full-profile CAS.
Replacing only its transport would not establish a trustworthy transaction or
reconstruct historical spend/grant identities. Before that cutover, the existing
canonical ledger gains protocol-1 command receipts through an additive migration.
This is not a legacy authority cutover and does not relax hydration/gameplay holds.

The V2 immutable operation identity is forwarded by active play and outbox replay.
Capability detection is authenticated/read-only; a missing old-server endpoint
allows the old ledger, but an ambiguous error or a command attempt never does.
Account/client/attempt guards run again after the capability await and before
mutation, preventing a queued operation from being sent under a switched session.
The mutation and receipt RPCs also assert the captured expected user against
`auth.uid()` server-side, covering a late SDK token switch before UI notification.
Private receipts bind account, operation, quest and exact JSON evidence; receipt
and reward commit or roll back together. An independent receipt lookup plus the
current verified profile is required for acknowledgement. JSON object key order
does not change evidence. Replaying an accepted command returns its original
outcome with the latest profile, so later progress is not restored backwards.
Missing/mismatched proof retains the intention; old V1 entries remain supported.

The [data contract](DATA_AND_ARCHITECTURE.md#cloud-persistence-contract) owns the
new fields, access, deployment/rollback policy and limits. No production migration
is implied by preparing or merging this client. Keep receipts indefinitely until
a reviewed retention policy preserves command identity; do not drop them during
rollback. Separate review/application and real-device validation are still needed.
Existing old clients can still invoke their old ledger; the wider legacy/daily/
spending writer retirement and general command authority remain open.

| Writer / boundary | Current responsibility | Required before final closure |
|---|---|---|
| `lumen_commit_canonical_victory` / `canonical-progress.js` | Canonical first rewards and badge upgrades, transaction + read-back | General command receipts and validation policy; preserve first rewards and per-run evidence |
| `lumen_cas_profile` / `cloud-profile.js`, UI flush/reconciliation | Full snapshot writes against expected baseline | Replace business mutations with commands; retain a guarded compatibility/migration path |
| `lumen_backup_profile` / explicit backup helpers | Historical snapshot backup writer | Retire or restrict after migration; never reintroduce an unchecked replacement path |
| `lumen_initialize_profile` | First profile creation | Verify onboarding/guest claim and safe old-client behavior |
| `lumen_save_progress` / `cloud.js` | Historical progress mirror and legacy write paths | Make the read model derive from authoritative commits, with old writers restricted |
| Daily/engagement RPCs and local reward paths | Daily activity and rewards | Inventory exact transaction identities and move ambiguous grants/spends to authoritative commands |
| `saveLumenProgress` / local persistence | Guest save, authenticated cache and staging | Retain pending legacy changes until a verified migration/recovery decision |
| Server entitlements/capabilities | Rights read by the client | Keep rights server-owned; no inferred purchase/access from an outbox intention |

The canonical SQL guard already prevents deletion of confirmed canonical
acquisitions through snapshot writers. It does not establish server authority
for every legacy acquisition, balance or historical reward. In particular,
existing max-balance reconciliation is not a transaction reconstruction.

## Validation and release

### Audit trajectory: remaining lot gates (23 October 2026)

The historical inventory and new-account guest claim are additive preparation.
No private player profile is available in this checkout. Rachel/Loutre/Chloé
recovery remains unverified; no baseline may be selected on their behalf.
Keep their original ownership, unknown fields and pending operation identities.
For existing-account contradictions, use the independently reviewed #558 path
only after comparing the actual private copies and current server receipts.

The following operational gates remain mandatory, even when automated tests pass:

1. Supply an isolated Lumen project and accounts, or the private schema recipe
   described below. Never run disposable bootstrap fixtures against the shared
   SoldeZen project. Apply additive migrations to recipe first,
   verify advisors/RLS and restore an export there; record the actual version.
2. Run the existing coordinator in read-only shadow inspection, without a second
   dispatcher/emission. Record exact client/server Git revision, parity and all
   failures. Administrative cohort records are attestation preparation; they do
   not enable a second writer and have no client activation endpoint.
3. Execute `RECETTE_SCENARIOS` from `rollout-gates.js` on real transports and two
   physical Android devices. Keep private evidence references, exact revision,
   transport (`real` or `mock`) and pass/failure for every scenario. The visible
   guest quest 6 → account → stable quest 7 must use catalogue identities, not
   `solved[6]`. Confirm affected player recovery separately before closing issues.
4. Create an evidence file with format `persistence-release-evidence-v1`, app
   `Lumen`, `revision`, isolated `projectRef`/`productionProjectRef`, protocol 1,
   `serverRevision`/`clientRevision`, `ci:{revision,success}`, per-scenario
   `{revision,passed,transport,reference}`, `physicalAndroid:{revision,passed,devices}`,
   `shadow:{revision,parity,secondEmissions}`, and zero `losses`, `doubleRewards`,
   `unreviewedBaselines`. Run `node scripts/persistence-release-check.mjs FILE activate`.
   An operator must review referenced evidence; self-reported JSON is not proof.
5. After authorized release, verify the exact production SHA per RELEASE.md.
   Start with QA/internal cohorts and stop new activations at the first
   conservation failure; keep already active authorities, receipts and archives.
6. Before retirement, additionally require `observation:{revision,startedAt,endedAt,
   broadCohort}` spanning at least 14 days, `legacyWriters:0`, `migrationParity:true`,
   `originalsRestorable:true`, `mirrorServerDerived:true`. Run the checker with
   `retire`. Verify old-client rejection, a dormant intent, export restoration and
   rollback to a compatible client before a separate writer-removal change.

### Private schema recipe and activation control (24 October 2026)

The owner selected a dedicated schema on the shared SoldeZen project.
`scripts/recette-schema.mjs` compiles reviewed structure metadata into an optional
bootstrap for an **empty** `lumen_recette`: empty business tables, selected
functions/triggers and whitelisted catalogue rules. No player rows are copied.
It never resets existing objects or modifies shared Auth. The NOLOGIN/NOINHERIT
runner owns QA objects only; all QA tables have RLS and no browser/API grants.
A private `auth_uid()` reads synthetic SQL claims without Auth access. This is
a constrained compiler, not a general SQL parser; reviewed metadata and database
role isolation remain required. Disposable `auth`/`lumen` bootstraps stay forbidden
on the shared project.

`supabase/recette/smoke.sql` executes real Quest/Wallet/guest commands under that
role: isolation, receipt-failure rollback, immutable retry, independent receipt
and current projection, one first reward, same-run Mastery and stable quest-7 ID.
The 24 October run passed, including cohort controls. All synthetic writes were
rolled back; profiles, guest receipts and cohorts remained empty. This is SQL
proof with synthetic claims, **not** live Auth, HTTP transport or Android proof.
The structure source is observed server DDL; its recorded Git baseline identifies
client code and is not an independent server Git attestation.

The checker accepts `environment: schema_isolated` with
`schemaIsolation:{revision,schema:'lumen_recette',role:'lumen_recette_runner',
reference,productionAccess:false,sharedAuthWrites:false,publicApi:false,
rlsEnabled:true}` and actual project references. Review the referenced grants
audit. Exact versions, real transports, two Androids and observation still apply.

Migration `20261024042823_sync_cohort_activation_control.sql` adds private release
approvals, an admin-only cohort setter, activation events and an emergency stop
defaulting to false. Browsers cannot approve or enroll accounts. Capability 0
explicitly selects compatibility before mutation; 1 requires an active cohort.
The claim endpoint enforces activation too. Previously issued exact receipts stay
retryable without a second seed. Stopping new activations preserves active
authority; downgrade is refused. Approval digests require operator review.

Deploy the client accepting capability 0 **before** installing historical-claim
and activation-control migrations atomically in application schemas. Never install
the historical migration alone: its original capability returns 1 globally.
Neither production application migration was applied during the schema recipe.
No real account was approved or enrolled.

One Android is offered for guided testing. The second device, real-transport
release evidence and 14-day broad observation remain open. CAS/mirror writers,
old readers and recovery archives remain until the retirement gate passes.
Lots 5–7 cannot be declared operationally complete from SQL/CI alone.

Current preparation does not remove CAS, mirror repair, compatibility RPCs,
historical readers or backups. No blanket production migration, cohort activation
or cleanup is justified by the presence of these tools. The physical recipe,
observation and gated writer removal cannot be declared completed by CI.


New mandatory Node suites: `canonical-outbox-recovery-tests.mjs`,
`canonical-durable-outbox-tests.mjs`, `canonical-retry-state-tests.mjs`,
`cloud-retry-scheduler-tests.mjs`.
Existing V1/multi-device/ledger regressions remain enabled. The canonical replay
browser runner additionally exercises real IndexedDB with denied localStorage,
a new document, an independent victory after refusal and a corrupt V1 record.
It now also checks persistent review holds, no automatic RPC after a new document,
and explicit retry retaining evidence. Node regressions cover auth/review/transient
classification, V1/V2 holds, failed pause persistence, corrupt policy metadata,
verified lost-response acknowledgement and account/client guards during auth resume.
The browser transport is simulated; production accounts and RPCs are not mutated.

Isolated recovery regressions execute the actual UI policy/replay functions:
verified legacy divergence, unchanged local bytes/in-memory progress, no reload,
account/client/active-play/auth/offline/visibility holds, network refusal and
online scheduling without a legacy write. The account-session browser runner
also runs the full hydration-to-recovery flow with simulated Auth/RPC and real
IndexedDB on mobile/desktop, checking one grant, no snapshot write, unchanged
local data and continued global partial-sync status. These are not live-account
or live-database validation.
The same browser flow includes an auth refusal, repeated online events without
another ledger call, and successful replay after verified token-refresh read-back.

Run `node scripts/test-affected.mjs --full` before the PR. Preserve the actual
results and distinguish Node fixtures, browser storage, isolated SQL, and live
account verification. No database migration is part of this client delivery.

The next phases of #391/#398 remain open: broader real-device recovery validation,
legacy authoritative commands, safe old-client retirement, non-global hydration,
audited repair of ambiguous profiles, server-side command refusal/repair policy and production
observation. A CI pass is not proof of those phases. The proposed 14-day
observation starts only after the agreed architecture cutover is generally
deployed and its recovery objectives are defined.
