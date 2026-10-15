# #391 — Transactional canonical reward ledger rollout

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
