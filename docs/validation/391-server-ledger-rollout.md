# #391 — Transactional canonical reward ledger rollout

## Follow-up audit — 17 October 2026

The ledger transport is now enabled in the deployed client, including replay
badge upgrades from #453. Read-only inspection confirms that the production
backup and CAS RPCs still accept whole-profile replacements without protecting
canonical acquisitions. The new `20261017180841_protect_canonical_snapshot.sql`
closes this gap for all payload updates. Its isolated regression fails before
the guard and passes afterward. A production aggregate preflight found zero
ledger receipts missing a solved snapshot; no player profile was inspected or
rewritten for the test.

Deploy only after the SQL/quality gates pass. The migration installs a trigger
and rewrites no player rows. Verify trigger definition, ACL and aggregate
ledger consistency afterward. DDL rollback is limited to dropping this trigger
and function; never drop reward receipts or replace player profiles. Retain the
guard during ordinary client rollback, including older backup/CAS clients.

These fixes do not close #391/#398: real-device QA, durable canonical outbox
fallback when localStorage is unavailable, full historical reward authority,
admin recovery and complete incident monitoring/alert validation still require
their own evidence. The historical preparation notes below describe the
original rollout, not the current client activation state.

The accompanying `20261017181513_sync_health_incident_tracking.sql` fixes the
admin stalled-player metric: blocked reconciliations count, the first unresolved
failure determines age, repeated failures cannot restart the clock, and a ready
event resolves it. Synthetic incidents and authenticated/non-admin access are
covered in the disposable SQL job. Existing telemetry is preserved. Deploy the
snapshot guard first, then this migration; neither rewrites player profiles.
Rollback the health RPC from the preceding deployed definition if necessary,
retaining its telemetry table, policies and history. No outbound alert channel
or retention job is enabled by this migration.

The migration `20261015_canonical_reward_ledger.sql` is **not automatically
deployed** by this pull request. It introduces an append-only,
per-player/per-quest ledger and one authenticated RPC that atomically writes
both the event and the existing JSON profile under a row lock.

## Safe deployment order

1. Snapshot/backup `lumen.profile_snapshots` and schema. Do not rewrite
   players' data to migrate historical quest completions.
2. Review the migration and run it in a controlled migration environment.
3. Generate the SQL allowlist from the current deployed catalogue:
   `node scripts/generate-canonical-ledger-seed.mjs > canonical-seed.sql`.
   Inspect IDs and execute this SQL after creating the allowlist table.
4. Verify `select count(*) from lumen.canonical_quest_allowlist`, inspect
   RLS, function EXECUTE ACL and the unique composite key. Test using
   dedicated accounts only, never real players.
5. On a test account with an initialized snapshot, submit one canonical
   quest, submit it again, and race two clients. The first credit should be
   10/15 XP; every later credit should be zero. Verify one event and that
   the JSON snapshot matches. Test unauthorized and unknown quest IDs.
6. Only after database verification, wire the client to the server RPC in
   a separate activation; do not silently fall back to snapshot CAS after
   an ambiguous RPC failure. Back up existing profiles before activation.

## Constraints

The ledger initially records **newly committed** quests. Existing canonical
completions in snapshots are recognized as solved, without inventing
retroactive ledger events or XP. Historic (numeric) quests and daily rewards
are outside the RPC scope. Daily rewards already have an independent
transactional mechanism.

The current client continues using its existing CAS implementation until
the migration has been validated and its call path intentionally activated.
A schema migration alone cannot resolve every legacy divergence or provide
cross-device outbox transfer: the locally stored intent remains device-local.
Admin recovery and true browser-level multi-device tests remain required.

## Rollback

Before enabling the new RPC on clients, revert the migration through a
reviewed DDL rollback if needed. After clients begin committing events, do
not drop the ledger (it is the durable receipt); restore compatible client
behavior first and preserve an immutable backup and audit history.
