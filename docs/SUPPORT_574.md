# Temporary assistance — #574

## Audit and minimal architecture (25 October 2026)

Base: `7306fd5` on main, isolated branch `feat/support-574`. Read #574, #534,
#398, #391, #316, current AGENTS/preserved contracts, architecture/test maps,
cloud contract, observability and release documentation. GitHub PRs #545, #546,
#547, #554, #559, #561–565, #577–583, #587–591 are merged. Active PRs at audit:
#568 (workflow), #540 (hosting), #526 and #456 (legal preparation); their content
is not treated as merged. Celebrations #575/#519 remain outside this change.

| Audit question | Existing source and reuse |
|---|---|
| Where are diagnostics produced/stored? | `game-screen.js` local 40-event cloud ring; `diagnostic-reporter.js` bounded optional structured incidents; private `lumen_commands.diagnostic_events` and #398 health/outbox projections |
| How are they transmitted? | Authenticated `lumen_record_diagnostics`, fixed schema, bounded queue/backoff/identity; operational health remains separate |
| Consent and retention? | #534 opt-in, withdrawal retry, seven-day details; existing `prune_sync_observations` daily job. That consent never permits support copies |
| Save exports? | `exportLumenRecoveryBundle` reads selected localStorage families, recovery/checkpoint IndexedDB and `exportCommandStorage`. #559 includes recovery originals; export stays local |
| Reliable copy without changing original? | Read the exact owned current local profile and at most two owned V2 checkpoint copies; typed projection only. No save/flush/reconcile/ack/repair call. Reuse the actual export's source family; do not upload its raw multicomponent envelope |
| Admin authorization? | Live server `analytics_cockpit` capability, including expiry; public invoker/private definer pattern, empty search path, no raw grants/RLS deny-by-default |
| Cockpit host? | `loadAdminTimeline` selected registered player. Append a closed native “Dossier d’assistance” disclosure, bound to current account/client/request/DOM |
| Purge/encryption/audit? | Extend existing #398 cron hook. HTTPS transport and provider disk protection; no existing reusable application encryption/key-management layer. New private support access log; payload is never sent to telemetry or console |
| Blocked reconciliation risk? | Raw export can include foreign/unowned archives and secrets; a new business flush could race recovery. Support reads only, bypasses gameplay readiness, uses its own volatile queue and its own RPC/locks |

Private Storage was evaluated against [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
For this bounded MVP, private PostgreSQL content is simpler: one transaction can
verify consent, insert metadata/content, acknowledge, revoke and delete, without
an upload/finalize/orphan-object service. Content lives in `support_contents`,
separate from metadata and ordinary telemetry. No bucket, object URL, signed
download bearer token, Edge Function or service-role browser key is introduced.
There is therefore no direct bucket access or signed-link expiry surface to
test. Downloads pass through fresh authenticated/capability checks every time,
and produce only a short-lived local Blob URL, immediately revoked.

## Data and privacy contract

Activation requires the player's specific unchecked opt-in, purpose `574-v1`.
Server-generated random case reference; 24-hour activation. The server derives
ownership from Auth and checks expected user on every operation. No local
preference, email comparison or client capability is authoritative. Support
access also checks the existing capability and its expiry on every operation.

Copies use a closed schema of catalogue-derived quest ordinals, fixed numeric/
boolean profile metrics (solved, stars, earned badge flags, result times, attempt
counts, balances/revisions), counts of readable pending queues, fixed incident
codes and a normalized build. At most 20 assistance-period incident codes are
kept in memory; routine retry/ack/release codes do not trigger full captures.
No free text, keys, account names, raw messages/stack traces, Auth storage,
URLs, tokens, cookies, receipts, pending request bodies or arbitrary nested JSON
are accepted. Client projection and independent SQL validation reject unknown
properties and string-valued facts; injected nested fake secrets are tested.
Server content fingerprints use SHA-256 of the exact canonical JSON text;
downloads include that text and the browser verifies its hash before saving.

This is a **filtered diagnostic copy, not a lossless restorable backup**.
Unknown fields, old unscoped originals, guest/foreign records, raw command
archives and IndexedDB archives without proved account attribution stay local.
Originals and the existing complete manual recovery download remain untouched.
Current local ownership must match even when hydration is blocked. Missing,
corrupt, inaccessible or oversized local evidence produces a failed preparation,
never a destructive cleanup or fabricated empty-profile success.

Support facts remain private personal data. The account UI names their purpose,
authorized recipients, 24 hours, retention, withdrawal and download limitations.
#316 legal/provider/rights review is still required; this is not a compliance
certificate. Admin downloads cannot be remotely recalled: support must restrict
them to an encrypted managed device, avoid public exports/issues and delete by
the same retention deadline. Browser/service-worker caches are not a server
archive; Supabase requests remain network-only under the existing worker rules.
Verify provider access logs do not record request/response bodies before rollout.

## Transport, revocation and limits

One volatile copy, max 512 KiB serialized server JSON (whitespace may make the
server bound stricter than compact client JSON), TTL one hour, five timed tries,
stable UUID and immutable payload across retries. A lost successful response
reuses the original receipt. Server confirmation is required before “Envoyé”.
No durable support payload is written to localStorage/IndexedDB; closing the
page cancels its pending copy. This avoids retaining another private backup and
competing with the business outbox. It is an explicit MVP offline limitation,
not a promise of delivery after page closure. Existing diagnostic queues remain
unchanged. Reconnecting the same open page retries; identity/client changes
drop its volatile evidence. An in-flight old response cannot change the new UI.

Client incident cooldown: 15 minutes after a confirmed capture; repeated
incidents while one capture is pending reuse it. Server: one new capture/minute,
eight retained captures per account, three activations/account/day, 32 MiB total
retained payload budget. A globally locked support-only control row serializes
the global byte budget. These caps reject support traffic without dropping game
saves. Consent/read/revoke are separate from upload quotas. The present caps
bound retained payload, not infrastructure billing or denial-of-service costs;
existing gateway/Auth rate protection still applies. Metadata/TOAST/index/bloat
overhead is additional; monitor database size and vacuum normally.

Revocation immediately blocks locally, cancels retry/capture, attempts abort,
persists an owner-scoped pending-withdrawal marker and sends an authenticated
server revocation. Only an acknowledged transaction reports deletion. Same-owner
support advisory locks serialize upload, download, withdrawal and purge; a prior
upload is deleted by revocation, a later one is refused. No original is removed.
All that owner's support content/capture metadata is deleted atomically; minimal
case/consent and access records expire with the short support TTL. If storage
is denied, pending withdrawal survives only this document; explicitly retry
while connected before closing it. Server revocation remains authoritative
across tabs/devices; storage events refresh sibling tabs. Existing Auth gateway
validates tokens; this feature does not replace Supabase session validation.

## Retention, deployment and rollback

Source migration `20261025200603_temporary_support.sql` was applied with explicit
owner authorization on 25 October 2026; the provider assigned production version
`20261025204916` (`temporary_support`). The SQL is unchanged; its LF SHA-256 is
`4b36d2f429a03f4b34c36230c8db6bea4eb7b0210bed01b7c107f41ace7252f4`.
The private control was enabled at `2026-10-25T20:50:52Z`, after verification.
Each player must still opt in separately. The migration's default remains false
for a new installation. A missing/unavailable RPC exposes an unavailable state.
Merge permission alone never authorizes SQL installation or activation.

The existing daily prune calls `prune_support` and deletes whole cases after
six days from activation, cascading content/metadata. This permits physical
deletion before seven days at the normal daily schedule. Reads/downloads also
refuse cases older than seven days. A failed/disabled job can delay physical
erasure: monitor it; do not claim a hard physical deadline without that check.
Access logs expire at seven days. Do not reintroduce purged support content from
backups; restored infrastructure requires the same purge before any reopening.

Authorized rollout procedure:

1. Confirm final exact-head CI, run synthetic tests in an isolated Supabase
   environment, verify HTTPS and current provider at-rest protection/settings.
2. Inspect `support_*` grants, RLS, public invoker/private definer search paths,
   anonymous refusal, normal-user cross-account refusal and admin expiry.
3. With the owner's explicit approval, apply the reviewed migration transactionally,
   compare its hash/history, leave control disabled, compare Security Advisor.
4. Confirm the existing cron invokes the extended helper and observes successful
   execution; check database headroom and backup/log retention. Do not query
   private player saves for this verification.
5. With explicit activation approval, enable the private control as an operator.
   Use synthetic accounts for activation→capture→support download/hash→revoke→
   denied replay and confirmed content deletion. Check the access audit.
6. Verify the published merge SHA and affected-phone/PWA journey. Keep #574 open
   as **To be tested** until physical/real-cloud acceptance is demonstrated.

Rollback: set the private control false to reject activation, upload and admin
reads, retaining authenticated owner withdrawal. Revert the client if necessary;
keep existing game data, support purge hook and restrictive permissions. Do not
drop a populated private table before its deletion/retention is verified. Full
schema withdrawal after purge: remove the public wrapper/private support helper
and validators, remove **only** `+lumen_commands.prune_support()` from the reviewed
cron function, then remove empty support tables/helper. No business tables,
writers, outboxes, receipts or protections are rolled back. Deleted support
copies cannot be reconstructed; originals on the player device remain intact.

## Cost estimate

Synthetic projections measured locally, with no player saves: ten completed
quests produce 3,728 bytes for one copy / 11,052 for three; 100 quests produce
35,878 / 107,502 bytes; the current full catalogue produces 146,630 / 439,758
bytes. Server JSON text sizes for those three-copy fixtures are respectively
12,599, 122,315 and 499,265 bytes (measured in local PGlite), before disk/TOAST
overhead.
The 512 KiB server cap accommodates the full-catalogue synthetic projection
with two checkpoints; larger/denser real profiles can still be refused explicitly.
At 100 cases/month × 3 captures × an assumed 40 KiB:
about 11.7 MiB/month ingested and 2.7 MiB steady seven-day retained payload;
one complete admin download/capture adds roughly the same monthly egress.
At 1,000 cases/month this becomes 117 MiB/month ingested and about 27 MiB
retained; larger copies reach the 32 MiB cap earlier and are refused. Actual
JSONB/TOAST/index overhead and WAL are not bounded by serialized payload bytes.

[Supabase pricing](https://supabase.com/pricing), checked 25 October 2026:
Free includes 500 MB database, 5 GB egress and 1 GB object storage. This design
uses the database quota, not the unused object-storage allocation. The 32 MiB
payload cap alone is about 6.7% of 500 MB, before overhead/other apps. Read-only
provider metadata on 25 October confirms the shared project's **Free** plan and
EU Central region. `pg_database_size` reports **163,032,211 bytes** (163 MB,
155.5 MiB), including other applications. Adding the entire support payload cap
would bring that aggregate to about 196.6 MB before extra table/index/WAL/bloat
growth. This database-size reading is not the provider's complete billing meter
or a reserved quota. No extra service/subscription is purchased. Marginal charge is
expected zero only while included quotas suffice; refusal is preferable to
silently upgrading. On the published Pro offer, the base is from $25/month,
included disk 8 GB and ordinary egress 250 GB; this task does not authorize it.

Current [Supabase changelog](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
was reviewed: obsolete CBC suites are due to be removed from HTTP APIs from
10 November 2026 at the earliest. No client/API signature change is needed here;
real-device acceptance should use supported TLS/browser versions.

## Authorized production rollout (25 October 2026)

The owner explicitly authorized publication retry, SQL migration and activation.
PR [#593](https://github.com/Anuponk/lumen/pull/593) is merged at
`e0c7f200d85e70875d0b42945976b447c941527e`. Its exact main quality, ledger-SQL,
reconciliation and documentation checks passed. Deployment
[40232014218](https://github.com/Anuponk/lumen/actions/runs/40232014218)
first received HTTP 503 from the publishing receiver; the authorized retry
succeeded. Public HTTPS `build-info.json` reported `1.11.1+534` at that SHA.
SHA-256 comparisons of the five affected public JS/CSS modules matched the
reviewed source after LF normalization.

Before installation, a server-side adaptation of `scripts/fixtures/support.sql`
ran in private `lumen_recette`. Only schema references, the synthetic identity
reader/FKs and grants were relocated. The support function bodies and validators
were retained. A separate NOLOGIN/NOINHERIT/NOBYPASSRLS caller had only schema usage
and required RPC execution; QA objects belonged to the existing private runner.
The existing production cron hook was not executed in QA; its presence was
checked separately after installation. Synthetic actors and capability rows
replaced shared Auth/capability dependencies.

The complete fixture passed: consent, same-user guards, guessed foreign
references, idempotence/conflicting identity, nested fake secrets, minute/owner/
global quotas, capability expiry, audit/hash, deletion-failure rollback,
revocation/rejected replay and cascading expiry. A caught subtransaction rolled
back every QA object, caller role and synthetic row. Migration-history marker
`20261025204857_support_574_private_recipe_verification` records that successful
verification, not a persistent QA installation. QA actors remained empty and
`lumen_recette.support_cases` and the temporary caller role were absent afterward.
No shared Auth or player-save rows were inserted, read or changed.

Production history attested the exact source SQL hash above. All five support
tables have RLS enabled and no raw SELECT/INSERT/UPDATE/DELETE access for
`anon`/`authenticated`. The public wrapper is invoker; the private support RPC
is definer; all four new functions have empty search paths. Anonymous execution
is denied; only the authenticated role can execute the two support entry points.
Validation and pruning remain private. Additional production SQL checks, with
synthetic claims and rollback, confirmed the disabled operator gate, anonymous
denial, expected-user mismatch refusal, ordinary-user admin refusal and withdrawal.
After enabling, status still returned disabled without player consent, upload
without consent was refused, and withdrawal returned deleted.

Live HTTPS RPC calls using only the public key returned 401/42501 for anonymous
access and 401/PGRST301 for an invalid token. These checks and SQL synthetic claims
do **not** prove a signed-in Auth session's full HTTP lifecycle. That acceptance
remains open; no private player session or save was used.

Security Advisor comparison added only five INFO `rls_enabled_no_policy` notices
for the deliberately RPC-only private tables
([linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
No new warning/error was introduced. Existing unrelated findings were not changed.
Cron job 5 is active at `17 3 * * *`, its last pre-install execution succeeded at
`2026-10-25T03:17:00Z`, and the exact existing prune function now includes
`+lumen_commands.prune_support()`. Direct support pruning returned zero on the
empty production tables. A scheduled post-install execution is still to observe.
At activation, cases/captures/contents/access were all empty.

Aggregate database size after installation was 164,367,507 bytes. No plan,
subscription, Auth configuration, log setting or backup job was changed.
Observed PostgreSQL settings: SSL on, statement logging DDL, error parameter
logging zero; no API-role logging override was found. A read-only inspection of
gateway-log attribute names found request/response metadata and no body fields;
no private log values were retrieved. This bounded check is not a guarantee about
unobservable provider internals or future settings.
[Provider security](https://supabase.com/security) documents encryption at rest
and TLS. [Backup documentation](https://supabase.com/docs/guides/platform/backups)
reserves managed daily-backup access for paid plans; no Free-plan backup coverage
or operator export inventory was independently attested. Operator exports must
exclude support contents or obey the same deletion/restore-purge policy.
The #316 provider/backup policy review remains open.

## Verification and outstanding acceptance

`support-tests.mjs` covers closed projection, nested fake secrets, account
ownership, no consent, acknowledgement, duplicate retries, switching accounts,
revocation races, offline/TTL, bounded attempts and incident storms. Disposable
`fixtures/support.sql` verifies the real migration, deny-by-default, quotas,
identity, capability expiry, audit, hash, withdrawal and cascading purge.
`support-concurrency.py` adds real PostgreSQL parallel retries/revocation/purge
to the existing SQL CI. The native support browser fixture joins the existing
independent cockpit runner at 320×568, 360×640, 390×844 and 844×390, with real
pointer input, large text, accessibility tree and stale admin-action refusal.

Full-suite results and exact candidate/release SHAs are recorded in the PR and
#574. Local SQL uses PGlite, not a claim of live Supabase/RLS/Storage behavior.
Completed production and isolated-server checks are recorded above. Remaining:
signed-in synthetic Auth/HTTP lifecycle and session expiry, the first scheduled
post-install purge result, real phone portrait/landscape, large system fonts and
screen reader, second-device session/account changes, PWA background/closure,
physical gameplay during support failures and #316 privacy/provider/backup policy
acceptance. #574 stays open as **To be tested**.

Onboarding impact: account technical support does not change puzzle assistance,
the Marquage auto lesson, badge eligibility, navigation or teaching milestones.
No celebration component, reconciliation algorithm, game writer or persisted
player field is changed.
