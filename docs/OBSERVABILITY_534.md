# Diagnostic collection — #534 phases 0 and 1

## Phase 0: verified audit, 23 October 2026

Source: `main` at `4a0eaa4`, #398 and its six comments, #534, #316,
the checked-in SQL and read-only production catalogue/permission queries.
No player profile, save, email, token or actual incident payload was queried.

| Existing mechanism | Evidence | Reuse / gap |
|---|---|---|
| Local diagnostic ring and health counters | `game-screen.js`, `cloud-diagnostics-tests.mjs` | 40 events; storage failure does not suppress the authenticated server signal. Keep as support fallback, not a durable queue |
| Persisted hydration/reconciliation | `public.lumen_sync_health`, `lumen_record_sync_health`, migration `20261017181513` | Reuse current first-unresolved-incident age and hydration-ready semantics; no competing live incident algorithm |
| Outbox latest state and alerts | `outbox-health.js`, `lumen_commands.outbox_health`, migration `20261022082203` | Reuse session/sequence ordering, backlog/age and stable alert keys. These are a state projection, not a transition timeline |
| Capability-gated cockpit | `lumen_admin_sync_health`, `analytics_cockpit` | Extend the same authorised response/UI; do not create another analytics role or alert pipeline |
| Retention | Private `prune_sync_observations()`, daily existing pg_cron job at 03:17 UTC | Production job is active. It currently removes only confirmed outbox observations older than 30 days; extend this existing job for optional diagnostics |
| Product analytics | `lumen_track_event`, `PRODUCT_ANALYTICS.md` | Different purpose; do not copy its rich attempt properties, stable browser identity or board data into diagnostics |
| #533 reference | `showGuidedConflict`, Undo handler, `clearGuidedConflict`, guided-undo regression | Fixed locally, but no persistent error→undo→blocked/released timeline |

Production metadata confirms RLS on both telemetry tables. Players cannot read
their raw rows or the private outbox table. The cockpit has a capability check
and empty search path. However, authenticated direct INSERT remains granted on
the public health table, and its legacy RPC only truncates free reason/version
text. These bypass a strictly sanitised/quota-limited collection boundary.
Close these paths without changing the old RPC signature or incident semantics.

Security advisors have existing warnings across this shared Supabase project,
including public executable definer functions. These are not proof of a newly
introduced problem; compare affected objects after rollout. No unrelated
permissions, schemas or real player records are to be changed in this work.

## Proposed architecture

1. Preserve #398's minimal operational health/outbox projections and alerts.
2. Add a private, short-lived **companion detail stream**, not another health
   counter/backlog store. It exists because transitions/exceptions need separate
   consent, correlation and retention from unresolved operational incidents.
3. One authenticated batch RPC validates a closed schema and enabled consent,
   derives the account from JWT and checks the expected account. Private RLS
   tables have no direct player grants. Public wrappers are invokers; privileged
   writers live in the private existing `lumen_commands` schema, verify auth and
   use an empty search path. Raw messages and arbitrary JSON are not stored.
4. Extend the existing capability-gated cockpit with signature aggregates and
   a bounded sanitised timeline. No joins to profiles/accounts or emails.
5. Keep collection off by default. Explicit account-menu opt-in is recorded on
   the server with purpose/version and timestamp. Withdrawal disables collection
   and deletes only that account's optional diagnostic records. Deleting an Auth
   account cascades to the new preference/detail records. No real deletion test.

### MVP fields

Stable code, inferred severity, fixed stage/error category, occurred/received
timestamps, random session and trace UUIDs, sequence, bounded retry count,
normalised app version, platform/browser families and minimal before/after states.
No quest/attempt/device identifier is necessary for the MVP #533 trace. UUIDs
identify only a diagnostic episode/session; they are not stable tracking IDs.
No stack, error message, URL/query/hash, user agent string, keystroke, cell,
board, balance, receipt, profile/save, email, nickname, token or secret is accepted.

### Transport and budgets

- Capture is synchronous, guarded and returns immediately; transport is deferred.
  No gameplay/save/hydration path awaits diagnostics. Exceptions in diagnostics
  are swallowed without recursively reporting themselves.
- Separate bounded local diagnostic queue: at most 30 records / 16 KiB, TTL 24 h,
  account-scoped, independent of the existing local journal. Corrupt/denied/full
  storage falls back to memory; loss of diagnostics is preferable to blocking.
- Ten events / 8 KiB per request, one in flight, five attempts with exponential
  bounded backoff, timeout and reconnect retry. UUID acknowledgement makes a lost
  response idempotent. Account switching never transmits one account's queue
  using another account's session. Per-signature client cooldown bounds repeats.
- Server-enforced per-account and global daily/minute budgets, separate from
  business RPCs. A full telemetry budget drops diagnostics, never player commands.
  Count duplicate deliveries once; retain a bounded canonical signature for
  grouping, not a hash of forbidden raw data.

### Retention and privacy

Optional details: seven days; local queue: 24 hours; expired rate buckets: two
days. Extend the existing operator-only daily prune function/job, with bounded
deletes and tests; do not create a second scheduler or touch receipts/profiles.
Existing unresolved #398 state is not erased by this diagnostic TTL.
Withdrawal erases optional details immediately; server rejects stale queues from
before the current opt-in timestamp. The support UI explains purpose, account
pseudonymisation, retention, withdrawal and deletion before opt-in.

This is a conservative opt-in implementation, not a legal compliance certificate.
The publisher must complete #316's controller/contact, full privacy notice,
subprocessors/transfer review and rights procedure before Play submission.
Pseudonymous diagnostic data remains personal data. Seven days is a product
choice for short incident investigation, not a claim that all security/audit
logs have the same legal retention. References: [CNIL consent](https://www.cnil.fr/les-bases-legales/consentement),
[minimisation](https://www.cnil.fr/fr/minimiser-les-donnees-collectees),
[purpose-based retention](https://cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees).

## PR cuts and acceptance

1. Phase 0: this audited inventory/architecture and decision record only.
2. Phase 1: SQL permissions/ingestion/retention/cockpit, bounded client transport,
   targeted cloud/outbox/runtime/#533 hooks, explicit consent UI and tests.

Required evidence: RED/GREEN business tests; real disposable PostgreSQL 17
permissions, unknown-field rejection, quotas, retry idempotence, opt-out/erasure,
retention and simulated #533 timeline. Native browser checks cover offline/reload,
reconnect, denied/quota storage and non-blocking gameplay with synthetic Auth/RPC.
Run AGENTS.md client/full/catalogue/hint gates and protected GitHub checks. Review
and apply only the tested telemetry migration, inspect permissions/advisors and
the existing cron definition, then merge/publish under the user's explicit
authorization and verify the exact public build SHA. Never use production
fixtures or modify real player profiles. Actual affected-device recovery and
physical Android remain separate evidence, not blockers to reporting this MVP.

Phase 2 alert routing, admin-driven GitHub issues and advanced correlation, and
phase 3 repairs are excluded. Keep #534/#398 open for those remaining criteria.

## Costs and limits

No new provider, paid service, Edge Function or server is needed. Reuse existing
Supabase and o2switch. The MVP detail budget targets at most 5,000 accepted records
per day; seven days gives at most 35,000 recent rows. At roughly 0.5–1 KiB per row
before indexes/WAL/backups this is about 18–35 MiB of table data, with several
times that allowance for indexes and infrastructure. These are sizing estimates,
not billing quotes or measured production usage. Typical volume depends on
opt-in and error rates; dropped diagnostics at the ceiling are an explicit cost
tradeoff. RPCs, old #398 projections, retained unresolved state, shared-project
traffic and Supabase backups have their own costs/retention. Retention requires
the scheduled job to succeed; verify its execution after rollout.

The MVP does not capture guest errors, pre-bootstrap/module-import failures,
complete offline history, full crash stacks or every network request. Missing
consent, quota, TTL, offline closure and storage failures can lose diagnostics.
The cockpit must label the sample as opt-in and incomplete, not a failure rate
for all players. No profile repair, new reward writer or automated issue opening.

## Phase 1 implementation and runbook

The companion detail stream lives in the existing private `lumen_commands`
schema. Preserve #398's live projections; do not count optional detail rows as
another operational failure rate. Extend `lumen_admin_sync_health` with signature
groups and at most 100 recent timeline records (same analytics capability).
`diagnostic-reporter.js` covers cloud write/hydration/outbox failures, explicit
retry/ack markers, runtime/resource exceptions and guided Undo episodes. The
actual Undo handler emits fixed states without cells or complete board state.

Exact budgets: ten ingestion calls/minute, 120/day/account and 200 new detailed
events/day/account, 5,000 detailed events/day globally. Legacy health has its own
20,000-event/day lane, sharing the validated budget helper but not the optional
choice. A coalesced real hydration-ready may pass after an accepted failure even
at the health cap, preserving #398 resolution rather than a false stalled alert;
another exception requires another accepted failure. This can add one resolution
per accepted failure to legacy volume. Withdrawal/preference remains available
even if ingestion is quota-limited.
New queue/choice keys are separate from all save/outbox keys; cached optional
choices are account/client guarded. An offline withdrawal stops collection here,
persists a pending withdrawal and reports server erasure as unconfirmed until
reconnect. The consent row is locked across ingestion, so deletion cannot race
an in-flight insert. A re-opt-in acknowledges/discards pre-consent queue records.

The server stores no extensible raw context. The legacy public health INSERT
and sequence grant are revoked; its original four-argument RPC remains compatible
and delegates to a private authenticated enum/version normaliser. No historical
payload cleanup is triggered by applying the migration. The existing cron gains
bounded (20,000/table/run) pruning of expired optional details/budgets and only
resolved old legacy history with a later hydration-ready anchor. Never purge
unresolved health or receipts. Seven-day detail visibility and daily physical
purge can differ by up to a day normally, longer if the job fails/backlogs.
Minimal quota counters survive withdrawal only for their two UTC-day buckets;
otherwise repeated opt-out/in would bypass rate limits. Choice records remain
to honour the current preference and cascade on Auth account deletion.

Release order: protected CI on the reviewed PR → apply the exact telemetry-only
migration → verify private grants, RPC signatures, RLS, definitions, indexes and
advisors → reconcile the generated migration filename/history if needed → verify
the final reviewed head and merge → wait for exact-main publication gates →
verify public build-info and changed assets. A schema-only rollout is backward
compatible; a client on an older schema remains usable and reports preference
unavailability. Never run fixtures, create test users, invoke erasure for a real
account or query profiles in production. Rollback can disable the optional
client feature; retain schema/cron and private boundaries, never restore unsafe
direct INSERT merely to roll back UI code.

RED evidence: the old SQL grant accepts direct health INSERT; the new assertion
fails on the baseline. Client cases fail without the reporter. Initial GREEN:
16 Node cases and embedded PostgreSQL assertions pass, including secret-like
input rejection, #533 timeline, identity, quotas, opt-out/stale queue, retention,
guest/non-admin rejection and synthetic Auth cascade. The native account suite
passes 390/1440, including offline reload/reconnect and erasure, with unchanged
save bytes and zero browser exceptions. Real PostgreSQL concurrency, final full
CI, deployment SHA and advisors comparison are to be recorded in #534 after
completion; these initial results do not claim production incident recovery.
