# Cloud recovery delivery and remaining cutover (#391)

This is a staged implementation record, not a declaration that #391 is closed.

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

## Reproduced incidents

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
legacy wins, daily rewards or spending while a legacy conflict remains. Their
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
