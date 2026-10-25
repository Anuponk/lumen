# Diagnostic collection — #534 phases 0 and 1

## Registered-player directory (25 October 2026)

Player cards now show a compact visual status: green `✓ Sans attente observée`,
amber `… En attente`, red `! Problème signalé`, grey `? État inconnu` or
`? Signal ancien`. Colour is paired with text and a symbol. Quest/session counts
remain visible. The quest label is the furthest observed current catalogue ordinal
(see PRODUCT_ANALYTICS), so an earlier replay never lowers it. Full
activity/Auth/receipt/queue dates are retained in a closed
native “Détails de synchronisation” disclosure. One shared explanation qualifies
the signals rather than repeating paragraphs on every card.

`playerSyncStatus` is a presentation model, not a new health authority. Green
requires `confirmed` queue evidence with valid timestamps and no observation
older than 15 minutes (including `oldest_observation_at` across devices). This
15-minute display freshness policy is not an SLA or a declaration of complete
cross-device synchronisation. Recent pending/failure evidence stays amber/red;
older evidence becomes grey while its original state and dates remain in the
detail. Missing/invalid/future-inconsistent timestamps never produce green, and
Auth or domain receipt dates alone cannot produce it. The state filter uses this
same qualified model, grouping old and missing observations under unknown.
Freshness is evaluated when rendering the directory; no new polling, storage,
RPC, telemetry, data repair or change to server observations is introduced.

The directory joins the existing bounded admin account response by exact `u:`
identity. A trimmed nickname is preferred; when blank, the account email is the
visible label. Search covers both nickname and email, ignoring case, surrounding
whitespace and nickname accents. No email is inferred from event properties or
another account. If the account read fails or a player falls outside that bounded
response, the existing directory label remains available. Emails stay in the
authorised in-memory admin view, never in telemetry or local storage.

All eleven cockpit sections, including key indicators and quest friction, use
native `details/summary`, initially expanded. Their headings work by keyboard or
pointer and preserve child filters/content while collapsed. Refresh updates the
content inside each disclosure without recreating the disclosure itself; its
open/closed state is retained for the mounted cockpit. This is not a persisted
player preference. Native browser coverage loads the actual cockpit HTML at five
viewports, checks email search, toggles every section, and closes friction with
Enter. No live player query or physical-device acceptance is claimed.

The recent-player RPC definition generates `Joueur XXXX` from the anonymous
player key hash, not a test-player classification. Its existing `qa_mode` and
traffic filters exclude marked QA/automation, but a missing historical marker
cannot prove a person is fictitious. No player/event rows were inspected to
classify these labels.

The requested view now displays only registered identities (`u:` key and
`authenticated` type), using the shared `registeredPlayers` projection before
rendering and batch metadata reads. It never infers identity from the nickname.
An anonymous timeline cannot be requested; refresh clears a formerly selected
anonymous or no-longer-visible timeline and invalidates its pending response.
The heading explicitly says registered players. This is a read-only view
restriction: no SQL/schema, save, event, analytics identity/linking, collection,
retention or aggregate definition is changed. Anonymous does not mean test.

Regression contract: `cockpit-registered-players-tests.mjs` reproduced all three
failures before correction; controller tests cover filtered metadata keys and
stale selection. The independent native cockpit browser asserts that an
anonymous `Joueur 3E8B` row is absent while the registered account remains.

## Cockpit lot 3 — security and acceptance

Native 320/390/1440 screenshots also exposed repetitive source explanations in
every player card. The final view keeps one expandable date explanation and one
session explanation, with a height-bounded mobile directory. Critical dates and
observed state stay visible. Native keyboard and five-viewport checks passed
after this density adjustment; no collection or date meaning changes.

The [three-lot evidence record](validation/2026-10-25-cockpit-534.md) separates
synthetic Node/native-browser/PostgreSQL results from physical and production
acceptance. `cockpit-acceptance-tests.mjs` reproduced an administrative scope
switch retaining the prior view even when both accounts had the capability.
`updateAdminTools` now clears the directory, accounts, diagnostics, timeline and
selection immediately when the cockpit owner changes. Stale success/rejection
guards remain intact. SQL acceptance adds actual Auth change, later receipt,
optional-consent withdrawal, expired detail and response-size cases. No new
RPC, data collection, retention, player mutation or automatic repair in lot 3.

## Cockpit lot 2 — players, sessions, episodes (25 October 2026)

`ui/cockpit-sessions.js` replaces the flat directory/timeline. A labelled search,
date ordering and observed-state filter select among at most 250 recent players.
Each player opens a bounded read of at most 100 analytics events (90-day window)
and 100 optional diagnostic events (seven-day window). Native `details/summary`
provides independent closed-by-default sessions, nested diagnostic episodes and
chronological events. Version/state filters and reasonable same-player refresh
preserve session expansion in memory; account/player changes reset it. Existing
incident filters, reports and mandatory review remain unchanged. Detached report
actions are invalidated. Capability loss clears administrative data and pending
requests cannot repopulate it. Request rejection yields an explicit error.

Analytics session IDs are the existing browser `lumenAnalyticsSessionV2`, reused
within 30 minutes of inactivity, possibly across tabs/reloads; they are not Auth
sessions or reliable device identities. Diagnostic sessions are separate UUIDs
and appear separately, never joined by time proximity. Missing IDs produce
separate unknown observations. Session intervals describe the visible sample,
not true play duration. Commit timestamps from lot 1 remain per-domain account
evidence, not invented per-session ACKs. Device information stays unavailable
unless provided by existing diagnostic enums. There is no new tracking.

The invoker `lumen_admin_player_sessions` facade delegates to a private live
capability check. Explicit account ownership restricts analytics and diagnostic
reads. Guest observations require a null user and the exact anonymous key;
shared-browser events are never relinked to another account. Only closed fields
are selected, stable quest ordinals are resolved from existing rules, and optional
diagnostics require current consent. Existing user/time and anonymous/time
analytics indexes are reused (metadata verified); one diagnostic user/time index
is added. No redundant analytics indexes or unrelated index cleanup.
No profile/receipt payload, amount, email, token or arbitrary properties leave
the RPC. No collection, retention, purge, alert or player writer changes.

Automated contract: `cockpit-sessions-tests.mjs`, isolated SQL fixture and the
existing independent incident browser, extended by `cockpit-browser.mjs`.
Native keyboard, expansion/filter/refresh/reset, nested review and no horizontal
overflow are checked at 320/360/390/844 landscape/1440. Browser transport is
synthetic, not live players; accessibility-tree checks are not screen-reader
acceptance. Full CI and real-phone acceptance remain distinct gates.

## Cockpit lot 1 — dates (25 October 2026)

Baseline `429ff40`. Metadata-only reads confirmed the existing recent-player
RPC derives `last_seen` from human/non-QA analytics (90 days), including passive
`session_start`; this is **last recorded activity**, not a verified user gesture.
The existing accounts RPC already uses `auth.users.last_sign_in_at`, scoped by
`lumen.users`. Persistent-session reopening does not change this source. Neither
`profiles.updated_at` nor hydration health is a durable domain receipt.

`lumen_admin_player_observations(text[])` adds one bounded batch read after the
existing directory, for at most 250 requested keys. The private implementation
checks the live `analytics_cockpit` capability and its expiry; the public facade
is invoker. Only Lumen-owned accounts qualify. It returns Auth timestamp, latest
immutable Canonical/Legacy/Wallet receipt timestamps and aggregate outbox state
across devices. Three `(user_id, recorded_at desc)` indexes bound receipt reads;
no receipts, amounts, operation IDs, payloads, emails or secrets are returned.
No profile joins, player writes, collection, retention or business RPC changes.

Each domain timestamp proves a server-committed operation and its durable
receipt. It does **not** prove browser acknowledgement, installation of the
current projection, or that every domain/device is synchronised. Historical
writers without receipts remain unobserved. Pending/failure observations do not
advance these timestamps. A pending device is not hidden by an idle one. Idle
observations are labelled conservatively; stale/offline state is not live health.
Dates use the viewer timezone, full time and UTC/age in the detail. Missing RPC
is “Indisponible”; null receipt/Auth date is “Jamais observée”.

Migration is additive and backward-compatible; deploy schema before client.
Without it, the existing directory works and additional dates are unavailable.
Rollback client keeps receipt indexes/boundaries; never grant receipt SELECT.
Timeline awaits now guard account/client/capability and selected request, on
success and rejection. RED reproduced a stale response replacing another
account's timeline. Three new Node cases pass; SQL fixture runs in disposable
CI only, covering account scope, expired capabilities, multi-device pending and
failure dates. Physical phone and screen-reader acceptance remain required.
Onboarding impact: none; administrative observations do not change gameplay.

## Phase 2 continuation: observations by version

The existing authorised response now supplies a local version comparison and
an episode version filter, combined with the observed-state filter. Sorting is
numeric across release/build numbers; malformed versions remain an explicit
unknown bucket. Aggregate occurrence/group counts and episodes containing each
version are separate. Cross-version episodes retain their full ordered context
and count once for each version they contain; their counts cannot be summed as
unique sessions. No exposed-population denominator or comparable duration is
available, so the UI explicitly refuses error-rate/regression conclusions.

Changing either filter revokes all report checkboxes and draft URLs. Detached
actions also fail the current-render and containment checks; permission checks
remain live. A fresh review is required before preparing another GitHub draft.
No new telemetry, identifier, RPC, schema, storage, external service, live-player
read or automatic ticket/repair is introduced. Reports retain their closed
schema. Eight Node tests cover ordering/count/privacy/capability behavior; native
390/1440 checks exercise combined filters, revoked stale actions and new review.
Full local verification passed all 30 groups with two browser workers, including
all ten browser runners, strict catalogue audit and 396 embedded cases (quality
gate: 298 s). Native 390/1440 comparison/filter/review checks reported no uncaught
exceptions. Protected CI and exact published SHA remain separate release gates.

This completes version comparison within the bounded sample, not statistical
regression detection. Durable triage/backlinks, complete pagination, notifications,
consultation audit and phase-3 repairs remain separate work.

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

### Verified rollout checkpoint — 23 October

The five required checks passed on `db02e8e`, including real PostgreSQL 17
parallel identity, daily quota and withdrawal tests (run `39939126275`). The
exact tested SQL was applied with Supabase-assigned version `20261023103114`;
its normalised SHA-256 matches migration history:
`7c6890dc684e00e710fc5653ba47f90523b7376a76056e8a5eea53fd4b82e022`.
The filename/workflow reference is aligned to this assigned version; no SQL or
client behavior changes in that alignment. Final-head CI remains required.

Production metadata: RLS enabled and anon/authenticated raw SELECT/INSERT/DELETE
denied on all three new private tables; public wrappers are invokers with empty
search paths; anon cannot execute them or the cockpit; players cannot invoke
budget/prune helpers. Legacy direct INSERT is denied. The existing postgres-owned
03:17 UTC cron calls the extended prune function. Its last pre-upgrade execution
succeeded; the first execution of the upgraded body is still pending.

Advisors comparison adds only three INFO `rls_enabled_no_policy` findings for
the private RPC-only tables. This is intentional deny-by-default combined with
revoked table grants, not a reason to create permissive policies. No new WARN;
existing shared-project warnings remain. See [Supabase's explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
No production diagnostic fixture, user creation/deletion, profile query or
player-data repair was performed. Client publication is verified separately.

Pre-publication review added a RED case for two different payloads using a fresh
identity inside one batch: the original INSERT conflict path kept the first.
A telemetry-only follow-up rejects duplicate batch identities (including UUID
case aliases) before budget/data writes. Separate-delivery retry idempotence
remains unchanged. Its SQL is validated and released through the same gates;
no player profile or business command is involved.

The five required checks also passed on `c433411`, including the new RED/GREEN
batch identity regression and real PostgreSQL concurrency. The follow-up was
applied as `20261023104105`; its normalised SQL SHA-256 matches migration history:
`d5ee2737668c5c0c158758015f66cdb21237701479c70f539be77ce9e4b26087`.
Production function metadata confirms the guard is installed. The final filename
alignment changes no SQL; final-head checks and exact client publication remain
separate release gates.

## Phase 2, first investigation slice

`src/ui/incident-investigation.js` consumes only the already capability-guarded
`diagnostics.timeline` from #398's cockpit response. It adds no RPC, database
table, scheduler, player-profile join or persisted client state. Events are
revalidated against the collector's enums, limited to 100, grouped by session
and trace, then ordered by session sequence. Every episode remains a partial
opt-in sample. A last guided blocked/released marker describes an observed
transition, never current live health, confirmed save restoration or a ticket's
resolution. A retry/ack does not resolve an unrelated hydration/guided incident.

The existing alert list gains at most two grouped detail signals: last-observed
guided blocks and exceptions observed in at least three sessions. They do not
duplicate cloud/outbox alarms from #398, send notifications or open tickets.
Refresh replaces the projection; no growing notification queue or polling is
added. Thresholds describe this sample, not all-player incident rates.

The panel filters episodes by observed state and offers fixed, cautious
investigation hypotheses and reproduction steps for guided/storage/cloud/runtime
failures. No inferred cause is represented as proven. Reports are built from a
second closed-schema projection, with at most 20 events, and omit UUIDs, dates,
messages, stack traces, accounts and free context. Download stays local. Search
uses only a fixed event code. An explicit review checkbox enables a GitHub
composer URL containing a bounded sanitised draft (at most 2,000 URL characters);
the administrator still submits on GitHub. No GitHub token or direct ticket
creation endpoint is added. The composer may omit later events to fit its URL;
the local report preserves its own stated 20-event limit. This uses GitHub's
[documented URL composer](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query).

Capability/account/client checks guard requests, asynchronous results and report
actions; loss of the capability clears the diagnostic panel. The existing server
capability check remains authoritative. No SQL/grant change is needed. Existing
consent, quota and TTL policies remain unchanged; no extra server storage or
provider cost beyond the current cockpit read. Exported files/GitHub issues have
their own lifetime, so the administrator must review them before publication.

RED: the investigation module did not exist; four new behavioral tests failed.
GREEN covers #533 ordering, separated sessions, ambiguous recovery, hostile
fields/export boundaries, bounded URL and grouped alerts. A fifth test executes
the actual cockpit loader to verify non-admin refusal and ignored stale results
after account switch. The native browser extension tests rendering/filtering,
explicit review/revocation and capability loss without visiting GitHub or creating
an issue. These are synthetic fixtures, not actual player investigations.
An additional RED/GREEN case preserves bounded signature aggregates while
dropping raw signatures and arbitrary context; the targeted suite has six cases.
Local verification: full affected runner passed all 30 groups (including nine
browser suites, strict catalogue audit and hints) in 356.9 seconds. The final
390/1440 account browser was also rerun after signature rendering was added:
review/filter/revocation checks passed with zero exceptions. No GitHub page was
submitted. Server metadata confirms the existing private helper remains denied
to anon/authenticated; this client-only slice changes no grant or function.

This is a first phase-2 slice: durable triage status/issue backlinks, true
cross-version regression detection, complete episode pagination, notifications
and consultation audit remain future work. Phase 3 repairs remain excluded.
The upgraded purge's first scheduled execution is still pending: the latest
observed run on 23 October at 03:17 UTC preceded the migration. No manual purge
or real-player operation was performed.

### Publication guard and visible review regression

PR #547 passed all five protected PR checks and merged as `627e655`. Two main
quality runs then disagreed: scheduled `39946690063` passed, push `39946692433`
failed at the new browser fixture's `reviewEnabled` assertion. The publisher
correctly refused release (`39947122142`); this is not a production success.
The fixture had clicked a checkbox inside a still-closed episode with `.click()`
and inspected its change handler synchronously. Eighty isolated repetitions did
not reproduce the CI failure. A subsequent real-pointer run reproduced document
replacement: the mounted host disappeared between interaction and assertion.
The preceding cloud-recovery scenario intentionally reloads the application;
the independent report test must not share its still-settling document.

The regression now follows the real contract: assert the draft is hidden, open
the episode, assert an unchecked visible review control, send actual CDP mouse
press/release, and wait for checked/enabled state. A second actual click must
revoke the draft. Initial hiding, URL privacy, filters, revoked capabilities and
stale-action assertions are retained. A timeout reports only connected/checked/
hidden flags. No fixture assigns a successful checkbox value or weakens the
review assertion; no product, permission or player-state change is introduced.
`scripts/fixtures/incident-investigation.html` loads the real stylesheet without
starting game/Auth/cloud code. The browser helper navigates to that independent
document and waits for its ready marker before importing the actual renderer.
Earlier cloud-recovery assertions remain intact. This isolates the observed
navigation interference rather than suppressing errors or retrying a failed
business assertion.
The isolated 390/1440 account suite and then the complete affected runner both
passed after this correction: 30 groups, zero failures, with all earlier cloud
recovery checks retained. Final protected CI/publication remains a separate gate.

The #549 PR checks also passed, but exact-main run `39950073600` then failed
before review: the independent document did not reach its ready marker. Moving
pages inside the same game browser was insufficient; it still shared the prior
recovery/service-worker lifecycle. Publication remained blocked. The next
correction moves the unchanged review assertions into their own Chrome/profile
(`incident-investigation-browser-tests.mjs`), with no game/Auth/service-worker
startup and blocked Supabase/GitHub traffic. The original account test no longer
invokes the unrelated report test; all its pre-existing checks are retained.
The quality gate now requires ten browser suites, clears the extra report, and
is validated locally with the same two-browser-worker setting as CI. Ready
failures include only safe page metadata; no blanket retry, skipped assertion
or disabled protection is introduced. The isolated runner passes both viewports.
The full affected runner then passed all 30 groups with
`LUMEN_BROWSER_WORKERS=2`, including all ten mandatory browser suites. This
matches the CI concurrency setting; exact final-main verification is still
required before declaring a release.

### Authorised schema rollout, 25 October 2026

The owner explicitly authorised production SQL and delivery after CI. The exact
reviewed date SQL was applied as `20261025065956`; its LF/trim-normalised MD5
`ab6867cb3c01dc90fd95d6a119416510` matches migration history. Repository filename
and disposable fixture are aligned to the assigned version without SQL changes.
The session SQL was applied as `20261025065959` in the subsequent lot. Public
facades are invokers with empty search paths; anonymous execution and direct
player receipt/diagnostic SELECT remain denied. Missing-capability calls were
verified to reject without querying a player. Advisor comparison: no new security
or performance findings. No player profile, save, event payload or Auth row was
queried/modified. Client merge and exact publication remain separate gates.
