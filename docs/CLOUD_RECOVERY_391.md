# Cloud recovery delivery and remaining cutover (#391)

This is a staged implementation record, not a declaration that #391 is closed.
Updated baseline: `b1c272eb46c958d04adfb1fd8b06fbb49214951f` (2026-10-18),
including the deployed performance-summary compatibility fix #473.

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

Automatic replay remains held while the document is hidden/offline, auth is
pending, an active canonical quest exists, the profile is dirty/busy or hydration
is incomplete. Those guards protect unsynced legacy state. Removing the global
hydration dependency requires the writer/authority cutover below; this delivery
does not bypass a real profile conflict or overwrite it to make the UI progress.
Invalid/server-refused operations are preserved; persisted per-operation error
states and permanent-vs-transient classification remain a later step.

## Writer inventory and cutover still required

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
`canonical-durable-outbox-tests.mjs`, `cloud-retry-scheduler-tests.mjs`.
Existing V1/multi-device/ledger regressions remain enabled. The canonical replay
browser runner additionally exercises real IndexedDB with denied localStorage,
a new document, an independent victory after refusal and a corrupt V1 record.
The browser transport is simulated; production accounts and RPCs are not mutated.

Run `node scripts/test-affected.mjs --full` before the PR. Preserve the actual
results and distinguish Node fixtures, browser storage, isolated SQL, and live
account verification. No database migration is part of this client delivery.

The next phases of #391/#398 remain open: broader real-device recovery validation,
legacy authoritative commands, safe old-client retirement, non-global hydration,
audited repair of ambiguous profiles, permanent error handling and production
observation. A CI pass is not proof of those phases. The proposed 14-day
observation starts only after the agreed architecture cutover is generally
deployed and its recovery objectives are defined.
