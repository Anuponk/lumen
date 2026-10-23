# Guest registration, guided undo and first-quest badges

Base: `5109b299695315a538148402c639350067125746`. Issues #528, #533, #529.

## Causes and correction

- Registration selected an empty seed whenever the guest had no account owner.
  The actual hydration-hook regression fails on the base with lost solved quests,
  badges, XP and a reset shard balance. The corrected hook initializes from the
  validated guest, verifies an original backup and server read-back, and checks
  coverage before replacing local data. Another account's cache uses a fresh
  seed without inherited canonical rewards. Existing ambiguous balances remain
  pending with both copies retained; they are not guessed or silently erased.
- Undo restored the board but retained `guidedPending` and the disabled board.
  The production-handler regression fails on the base. Undo now clears pending
  and deferred guided explanations before rendering the preceding state.
  Acknowledging the explanation alone still requires correcting the Guardian.
- Badge availability had quest/progression thresholds in client and SQL command.
  All four are now eligible on every quest. Earned records, assistance rules,
  same-run Mastery and the fifteen-minute cooldown remain in force. No historical
  badge backfill. Quest 1 names the goals; quest 3 explains without an unlock
  promise; quest 6 recalls assistance choices.

## Executed evidence

- Guest ownership/backup fixtures and actual UI hydration-hook fixtures pass:
  registration, second-storage restore, duplicate auth, offline initialization,
  interrupted read-back, account change and existing-cloud preservation.
  An additional red/green regression confirms that a victory added during
  hydration I/O remains locally preserved instead of being replaced by the
  earlier guest capture; installation waits for matching server coverage.
- Badge UI fixtures pass for earned/missing badges on quests 1–4, serialized
  reload and educational dialogs. The performance suite retains assistance,
  immutable earned badges and cooldown regressions.
- Real isolated Edge with touch emulation: guided conflict → one Undo → new
  touch passes on quest indices 6 and 10, preserving the earlier Guardian.
- Full embedded suite: 99/99 at each of 5x5, 6x6, 7x7 and 8x8 (396). Actual
  touch cycle, drag, reset, guest reload, PWA and responsive finale also pass.
- Disposable embedded PostgreSQL: current client/server parity across the
  generated historical cases; immutable receipts, stale CAS, counter protection,
  wallet/daily regressions; initial guest snapshot/net balance; no repeated XP;
  early-quest badges and cross-account initialization refusal pass.
- Workflow syntax passes actionlint. Final full-gate/CI and release evidence
  are reported on the PR and deployment, separately from these local proofs.

The new SQL migration changes only the known eligibility expression of the
current historical command and refuses an unexpected definition. Existing
wallet instrumentation, privileges and receipts are preserved. It must be
applied before releasing the client. Rollback of the client must retain saved
profiles, account-scoped guest copies and receipts; never clear player storage.

No production player fixture, real Auth email or physical Android/iOS test was
performed. Synthetic Auth/transport tests and embedded PostgreSQL do not replace
the PostgreSQL 17 concurrency CI or exact-production-SHA verification.
