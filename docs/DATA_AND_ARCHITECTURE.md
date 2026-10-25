# Data and architecture

Private recipe/control follow-up (24 October 2026): the shared-project
`lumen_recette` is private, role-isolated and uses synthetic SQL claims only.
No player copy or shared Auth mutation is permitted. Release approvals, cohort
events and the closed-by-default activation control are administrative authority;
clients cannot enroll themselves. Explicit guest capability 0 preserves the old
initializer before mutation; unknown versions refuse. The new claim endpoint also
requires activation, retaining exact issued-receipt retry. See
[recipe and activation procedure](CLOUD_RECOVERY_391.md#private-schema-recipe-and-activation-control-24-october-2026)
for installation order, actual SQL evidence and outstanding physical gates.

## Optional incident details — #534

[Audit and architecture](OBSERVABILITY_534.md). Preserve #398's live health,
outbox state, fifteen-minute alert and capability; add a private companion
detail stream, not another backlog/repair engine. `diagnostic-reporter.js` maps
fixed cloud/outbox/runtime codes and #533 blocked/Undo/released transitions.
`lumen_record_diagnostics` derives Auth identity and checks the expected account;
the same `lumen_admin_sync_health` response adds a bounded diagnostic sample,
without profile/account joins. Public RPC wrappers are invokers; privileged
writers live in the existing private schema, verify Auth and fix search_path.
RLS and revoked direct grants deny raw access. The old health INSERT/sequence
bypass closes and its compatible RPC normalises legacy text and applies quotas.

Optional details default off. Separate `diagnostic_preferences` records purpose
`534-v1`, choice and timestamp; no player profile field changes. Withdrawal
stops capture/clears the local queue, deletes own optional server details, and
persists a pending withdrawal for reconnect on failure. Consent-row locks prevent
post-withdrawal insertions. A fresh opt-in cannot replay earlier events. Auth
deletion cascades to the new preference/details, tested only in disposable SQL.
The existing #398 operational data is distinct. Pseudonyms remain personal data;
#316 publisher/legal/rights work is not declared complete.

Closed context: stable codes/severity, stage/category, timestamps, random session/
episode UUIDs, sequence/retry, normalised version, platform/browser families and
blocked/ready state. No message, stack, URL, user agent string, email, board,
balance, receipt, whole profile/save or arbitrary JSON. UUID delivery is immutable
and idempotent; signature grouping uses only these technical fields.

Queue: 30 events / 16 KiB, TTL 24 h, ten events / 8 KiB per batch, one request in
flight and five attempts with bounded exponential backoff/timeout. Capture never
awaits transport; storage denial/quota/corruption falls back to memory. Only
diagnostics can be dropped, never business intentions. Offline reload/reconnect
and obsolete account/client responses are guarded. Budgets: ten requests/minute,
120/day/account, 200 new events/day/account; global 5,000 details/day and separate
20,000 legacy health/day. A coalesced hydration-ready after a failure can bypass
the health cap so quotas cannot leave a recovered account falsely stalled; another
exception requires another accepted failure. SQL locks telemetry, never profiles.
Preference read/withdrawal remains available when ingestion quota is full.

The existing daily operator-only prune adds seven-day details, two UTC-day
budget buckets and resolved legacy health older than 30 days only if a later
hydration-ready anchor exists. Deletes cap at 20,000 rows/table/run. Never erase
unresolved health, outboxes or receipts. Physical deletion normally lags expiry
by at most the daily schedule; job failures/backlogs can extend that lag. The
cockpit shows only seven days and labels the sample opt-in/incomplete.

## Storage inventory and recovery retention

`storage-maintenance.js` measures localStorage by fixed categories and estimates
UTF-16 key/value bytes. The browser's `storage.estimate()` budget is separate
from localStorage's limit and never proves free device space. Where supported,
IndexedDB inventory reads only existing recovery/checkpoint/outbox databases;
measurement creates no database, changes no save and reveals no keys or values.

The account diagnostic offers explicit local-space maintenance. Retain two
recent immutable copies per recognized backup family (per owner for V2 unsynced
checkpoints), and archive up to 50 older copies per invocation in the existing
`lumenCloudRecoveryV1` snapshots store. Each `localStorage:<original key>` entry
preserves the exact original string. A different pre-existing archive aborts;
write/read-back and transaction completion precede local removal. Recheck the
captured session, owner, live profile bytes and source bytes after the await.
Failure or a changed session/source leaves the unverified source in place.

This is relocation, not age-based destruction of evidence. IndexedDB originals
remain exportable and do not expire. Live profiles, attempts, Auth, guest-before-
account originals, unknown keys, V1 backups, V2 latest pointers and pending
commands are excluded. No cloud acknowledgement, wallet authority or readiness
is inferred. Existing outbox acknowledgement and 40-entry diagnostic rotation
remain unchanged. UI-triggered export also includes guest and canonical metadata
originals that were previously omitted from its local prefix selection.

## Hydration refusal boundaries — #536

Hydration retains a known wallet refusal (`mutable_balance`, invalid/stale wallet
revision or invalid balance) when achievement-only recovery makes no change.
A simultaneous canonical reward refusal is reported separately; neither reason
authorizes a new merge or marks the profile ready. The wallet's IndexedDB
checkpoint proves only durable staging, not a confirmed debit or storage loss.
`reconciliationFailureDiagnostic` classifies fixed reason codes by domain;
`hydrationFailureDiagnostic` identifies the wallet receipt, profile read-back,
cache restore, acknowledgement, achievement backup/install and mirror boundary.
Only fixed stages, known error categories and allowlisted field names are used;
no revision numbers, amounts, profiles, operation/account identities or provider
messages are added to telemetry. Full snapshots and all pending intents retain
their existing preservation and acknowledgement rules.

The final asynchronous legacy-mirror verification must check the captured account
and client again before emitting readiness/failure or updating presentation.
An account/client change aborts that obsolete continuation without touching the
new session. This guard closes a reproduced race; it is not proof that Rachel's
reported acquisition conflict was caused by session switching.
See [evidence and remaining limits](validation/2026-10-23-hydration-536.md).

## Session achievement recovery — #530

Local quota follow-up (#536/#537, 23 October 2026): hydration uses
`reconcileCloudAchievementsDurably`, sharing the synchronous recovery planner
and its existing monotonic achievement rules. If the original's backup cannot
fit in localStorage, the existing `lumenCloudRecoveryV1` IndexedDB snapshot
store must commit and read back that original before the updated cache is
installed. No backup is removed. A changed account/client or local profile
during the await cancels installation. Both storage pools being full, an
unverified backup, or a cache that cannot fit retains the hold and originals.
Recovery exports now include this store as `cloudRecoveryIndexedDB` alongside
the existing unsynced checkpoints. This does not reconcile an unproven wallet,
mark partial hydration ready, grant a reward or authorize a locked replay.

The [reproduced case and release limits](validation/2026-10-22-achievement-recovery-530.md)
cover a server badge replay being rejected as an immutable canonical reward.
Coverage and partial local recovery now accept only recognized badge additions
when every non-badge field is identical. Stars, initial performance, unknown
fields and badge removal still hold; no reward or balance is recomputed.
Partial recovery retains local currency/cursors and cannot authorize hydration.
Session identity/client is rechecked after daily reads/CAS and each reconciliation
await, before applying the result to local data or readiness of another account.
Only a verified coherent installation clears the previous failure. Specific
storage/reward diagnostics use fixed fields, catalogue-validated local quest IDs
and the existing server health event without profile values or new SQL.

## Quest parity audit — #522, 2026-10-22

The [dedicated chantier audit](validation/2026-10-22-quest-parity-audit.md)
records the `650a39b` inventory, remaining numeric/stable-ID behavioral
differences, synthetic reproductions for #516/#515, the #521 rendering review,
and the implementation lots approved before corrective edits. The original
audit is not a replacement product contract or a completed persistence migration.
The branch incorporates the persistence work merged in PR #523; preserve its
wallet, receipt, pending-navigation and account guards in subsequent lots.

The first implementation lot replaces the ten-by-ten `planSlots` reconstruction
with `buildQuestDefinitions` (`src/campaign/quest-definition.js`), reading the
current published revision of `content/catalogue/access-origins.json` through
`publishedCatalogueQuests`. That content owns IDs, numeric compatibility keys,
current order and membership. The builder validates unique references,
contiguous order and membership, deriving local positions without size limits
or constellation-specific remapping. Grid adapters/overrides still resolve by
stable ID. Old keys, grid hashes, origin revisions, rewards, command protocols
and active attempts are preserved; there is no player-data migration.

Future publication appends a compatible catalogue revision and audited assets,
as already required by the compatibility contract. `quest-definition-tests.mjs`
covers variable sizes, N→N+k and recovery of a formerly complete synthetic save.
Guest/cloud, qualification, reward/daily and social differences remain separate
contract-convergence work coordinated with #523.

`quest-view.js` provides an ephemeral common read projection over numeric and
stable saved records. The active board label and attempt telemetry read its
published quest/membership, never the dormant numeric frontier. It preserves
legacy badge-version compatibility and does not add a store or mutate a save.
Stable identity telemetry and nullable historical counters are documented in
PRODUCT_ANALYTICS. `puzzle_start` now follows attempt creation/restoration.

Mon ciel's periodic badge refresh also resolves each card's `data-quest-id`
through this projection, reading the current progress object on each tick.
It must never associate a canonical card with an old numeric range by DOM
offset: inserted or reordered cards otherwise display another quest's badges.
Unknown cards and unsolved quests are ignored; badge eligibility and the two
existing saved-record formats remain unchanged.

## Account modes (2026-10-18)

Lumen has two public modes: local guest discovery without an Auth account, and an authenticated account using Google or email with a password. Email OTP/magic-link login is retired in the Lumen UI and its dedicated mail endpoint. Existing accounts retain their identity, progress and entitlements; use Google or **Créer ou réinitialiser mon mot de passe** to establish a password on the same email address. Recovery/confirmation emails remain supported. Do not disable email Auth globally: the Supabase project is shared with SoldeZen.

While the SDK restores its startup session, the mobile account menu shows a neutral pending state and disables the sign-in action. Only a resolved unauthenticated session may offer sign-in; pending rendering must preserve password-recovery state. SDK session persistence and refresh defaults remain unchanged. Subscribe to Auth events before startup session/confirmation I/O. A late startup read cannot replace a newer login/sign-out event; deferred restoration must check the account identity. An expired confirmation must never sign out an existing session. Explicit logout uses the local session scope, preserving sessions on other devices. Recovery opens the parent profile editor and waits for password creation before cloud hydration/reload. Cloud restore failures remain authenticated and visible as synchronization failures; keep divergent saves protected and provide a safe reload/retry. Refresh an open sky after successful hydration so quest availability reflects the verified account.

No player-data schema or reward reconciliation policy changes with these account modes. Live device validation remains necessary when diagnosing storage loss between login and reload; passing simulated sessions alone does not prove that an affected PWA retains its session.

### Persistent browser sessions (2026-10-19)

The browser client explicitly enables `persistSession` and `autoRefreshToken`
and passes its existing `localStorage` to the SDK. The default SDK writable-store
probe can otherwise select memory when writes fail even though an earlier saved
session remains readable. This was reproduced with SDK 2.118.0 in a real browser:
normal storage restores the synthetic session; a quota refusal before SDK loading
hides it with default storage; explicit storage restores it without any network
call or modification of the saved session. Token values are not logged.

The SDK retains its original storage key and owns refresh, rotation, expiration,
revocation and explicit local-scope logout. There is no independent credential
copy, migration, artificial user identity or extended JWT lifetime. A full store
may still prevent saving a new/refreshed session; this read-path fix is not a
durable-write fallback. Browser storage deletion, privacy policies and revoked
sessions cannot be bypassed. Keep existing cloud/session/account-switch guards.

The [Supabase session contract](https://supabase.com/docs/guides/auth/sessions)
supports long-lived renewable sessions; shared project Auth settings are not
changed. An affected player's device, storage context and fresh diagnostic must
still confirm which cause applies. Server session presence alone does not prove
the session is usable on that particular browser/PWA.

## Guest registration preservation (#528)

For an existing account, an unowned browser with no acquired guest facts must
not compare its default three-shard reserve or current catalogue origin against
the account's confirmed wallet and historical origin. `guestNeedsReconciliation`
ignores those defaults and empty daily containers when all acquisition maps/counters are empty;
all other fields still pass conservative coverage. Exact guest originals remain
archived before installation. Actual guest earnings, spending, performances,
authority revisions and unclassified evidence retain the previous safeguards.
New-account initialization still uses the complete guest seed and net balance.

`ensureAttemptStarted` writes a performance-map entry on the first gesture,
before any victory: quest index plus qualification day/timestamp. The shared
`isAttemptStartPerformance` recognizes only that exact validated shape; rewards,
times, badges, attempts and unknown fields are never classified as start-only.
An otherwise unacquired guest may restore an existing account despite these
markers. Keep the full original guest snapshot and a verified active-attempt
backup before installation; never copy the guest timestamps into the account's
cooldown or manufacture a qualified result. A failed attempt backup blocks the
installation and leaves both account and guest data intact.
Genuine guest conflicts emit the existing bounded `hydration_reconciliation`
event at `guest_reconciliation`, including its fixed reason/domain and only
known field names (otherwise `unknown_field`), without profile contents.

`guest-account.js` distinguishes an unowned guest from a signed-out account cache. Before first authenticated I/O, preserve and read back the exact guest snapshot under `lumenGuestBeforeAccount_<accountId>` (additional versions retain subsequent offline play). Initialize a missing cloud profile from the whole validated guest snapshot, including net currency, earned badges and compatibility access; use a fresh seed only for another account’s cache. Existing cloud achievements must cover the guest, or the existing conservative reconciler must succeed before installation. Recheck the latest local bytes immediately before installation: achievements earned during initialization/daily I/O must also be covered, or remain pending with the live attempt preserved. Conflicting receipts/balances stay pending with both originals preserved; never infer money, copy another account, or erase guest achievements. Initial creation remains atomic and read-back verified; no duplicate victory commands are emitted. Failed backup, offline initialization, read-back or account switch cannot install an empty profile.

## Cloud persistence contract

An existing-account ownership handoff installs the verified profile into the
single live progress object and refreshes board selection through
`nextCanonicalQuest` / `resumeHydratedCampaignSelection`. The old active attempt
is archived and verified before installation; only then may navigation replace
it. Same-owner Auth refresh/reconnect and new guest-account seeding do not
perform that handoff. No completion, cooldown, balance or reward is synthesized.
Social challenges and locked/missing frontiers remain outside this navigation.

The same selection check also handles a same-owner READY campaign board with no
start timestamp and only empty cells. If it differs from the preserved origin
frontier, its exact storage bytes are archived and verified before replacement.
This repairs an idle inserted catch-up selection without moving a started/paused
attempt or replay. An already correct selection is a no-op. Archive failure emits
the bounded `campaign_resume_deferred` / `attempt_backup` diagnostic and leaves
the board and verified account readiness intact. No player profile is modified.

The cockpit's `playerSyncStatus` presentation qualifies existing queue evidence
by observation freshness, including the oldest device timestamp. Badges and
filters share this model; full original dates/state remain under a disclosure.
Green never derives from a domain receipt/Auth date alone and does not certify
complete-device sync. This is UI-only; no authority or persistent fields change.

The administrative directory enriches its registered-player projection with the
already-loaded, capability-guarded account response by exact user identity.
Nickname/email search and email fallback remain in memory; no email is written
to telemetry/storage and no API/schema or authority changes. Native collapsible
cockpit sections retain their content and mounted open/closed state.

The administrative recent-player directory now limits its view to registered
`authenticated` / `u:` identities. Anonymous hash labels do not establish test
traffic and never authorise deletion. The view filter and timeline reset touch
no player persistence, telemetry storage, aggregate definition or backend RPC.

### Positive acquisition recovery — #391, 25 October 2026

The free game's product policy gives structurally valid positive acquisitions
the benefit of the doubt. Conservative snapshot coverage remains the ordinary
restore guard. On a same-owner hydration refusal, `reconcilePlayerAcquisitions`
uses the additive expected-account `lumen_reconcile_acquisitions` RPC and a
separate server read-back. The current session installs that verified result and
refreshes its one live progress object without a reload or new victory.

Under the existing snapshot row lock, the RPC unions catalogue-recognized solved
identities, existing badge flags and historical achievement maps. It keeps the
best compatible performance summaries, cumulative counters by maximum and latest
cooldown. Time/assistance/error facts come from one saved run. Mastery is kept
only when explicitly present, never synthesized from its components. The server's
immutable canonical first-completion record stays exact; improvements use the
existing mutable `runPerformance`. Legacy and Quest authority projections update
atomically, keeping the ordinary snapshot guards active and cursors unchanged.

Historical acquisition recovery may copy a first performance into an unversioned
`runPerformance` with empty badges. Client coverage accepts that redundant seed
only with an active Legacy authority, no pre-existing local run, exactly the
`seconds`/`assisted`/`bestTime`/`badges` shape, finite nonnegative times and exact
equality with the preserved first performance. First rewards and unknown evidence
remain protected; the seed never proves a new qualifying run or grants a badge.
Existing V3 replay coverage remains unchanged. No profile or server migration is
required, and original device bytes remain archived before installation.

Shards, Wallet revision, daily ledger, receipts and catalogue origin remain
exactly server-owned. Recovery never credits money or replays a reward from
completion. XP and skyScore keep the existing maximum policy, never addition.
Uninterpretable historical properties stay in the original instead of blocking
independent known acquisitions. Corrupt core structure, identity uncertainty or
failed archival/read-back still refuse.

Before emission, both originals are durably archived and verified with existing
recovery storage, including its IndexedDB fallback. Timestamp collisions cannot
replace an older original. The server also retains both JSONB sources in private,
RLS-enabled `lumen_commands.acquisition_recovery_sources`, keyed by owner and
SHA-256 of canonical JSONB. No direct client access or diagnostic profile payload
is added. Existing local recovery exports include the original device bytes;
server copies remain operator-readable evidence. No retention/cleanup job is added.

Two CAS attempts bound each recovery. A stale snapshot causes a fresh account
read; a lost reply is safe to repeat without another reward. Read-back,
owner/client/generation and current local bytes must match before installation.
This merge never acknowledges pending commands. Cache quota after verified
archival/read-back permits in-memory play. Missing migration/transient failure
keeps partial recovery and retry, without claiming convergence.
Transient acquisition failures use the existing retry scheduler with exponential
backoff and at most five autonomous retries per window. Online/Auth renewal wakes
that window; active play, hidden/offline documents and changed identity/client/
generation prevent emission. Structural refusal and missing migration do not loop.
An intervening server-read outage retains the retry window without granting replay
or Wallet proof. Success cancels the hold; repeated failures stay diagnosable.
`hydration_reconciliation` records `positive_acquisitions`; `hydration_ready` and
the scheduled flush report subsequent readiness. This supersedes support-only
treatment of ordinary acquisition differences. It does not authorize ambiguous
monetary reconstruction, production SQL or old-writer retirement.

Cockpit acceptance (#534 lot 3): administrative data is bound to the captured
cockpit owner as well as live capability. Switching between two authorised
accounts clears the previous view immediately. This does not change player
Auth or persistence; receipt dates retain their limited domain-commit meaning.

Cockpit sessions (#534 lot 2): capability-checked, closed administrative reads
group existing analytics and consented diagnostic sessions separately. No
session is inferred from Auth timestamps or a temporal match; no shared-browser
guest event is reassigned to a signed-in account. `ui/cockpit-sessions.js` owns
the bounded view, in-memory expansion and filters. New read-only session RPC
and supporting indexes change neither collection nor player persistence.

Administrative dates (#534 lot 1): `ui/cockpit-dates.js` displays last recorded
analytics activity separately from Auth `last_sign_in_at`. The additive
`lumen_admin_player_observations` RPC reads only latest immutable domain receipt
timestamps and existing outbox observations, behind a live, expiring cockpit
capability and Lumen account scope. These timestamps prove server commits,
not device receipt, current projection installation or full synchronization.
No player-data writer, ACK, receipt format, collection or retention changes.
See `OBSERVABILITY_534.md` for source audit and compatibility.

### Historical inventory and guest claims — lot 4

`historical-inventory.js` produces a private, mutation-free manifest. Each source
retains its original string, SHA-256, owner, origin and unknown fields. States are
`identical`, `covered_projection`, `incomplete` and `contradictory`. A covered
projection is **not** a transaction receipt. Exported receipts alone cannot
authorize a baseline: verification still uses the existing expected-account RPC
adapters. Invalid/foreign sources and ambiguous balances remain under review.
The optional `inventoryHistoricalAccount` reads the expected-account profile,
independently reads exact Wallet operation receipts, then re-reads the profile.
Only an immutable request and the existing exact Wallet coverage predicate may
classify a source as `receipt_covered`. A moving projection, foreign owner,
unknown-field mismatch or missing receipt cannot receive that classification.
This API neither installs the result nor acknowledges an outbox entry.
`node scripts/historical-inventory.mjs private-input.json private-output.json`
requires an explicit destination, refuses overwrite and prints only counts.
Input shape: `{userId,sources:[{id,owner,origin,raw}],remoteOwner,remoteRaw}`.
The result contains private save contents and must never enter Git or an issue.

An actual unowned guest's initialization now captures `lumenGuestClaimV1:<digest>`
before I/O. The immutable manifest contains the target owner, random claim ID,
original/seed strings and SHA-256 digests. A preserved source remains bound to
that target even when sign-in was interrupted. Native Web Locks serialize new
claim captures across updated same-origin tabs; without them the verified
localStorage write remains document-scoped, not a cross-tab transaction.
Manifests and the prior guest backups are retained and privately exportable.
The export also retains the local owner, active attempt and fallback outboxes.

The additive `historical_claim_rollout` migration introduces private, RLS-enabled
guest receipts, no new authenticated table grants, expected-account RPCs and
an invoker public facade. A claim atomically creates **only a missing profile**
and its receipt. Existing profiles receive `review_required`, without addition,
maximum or replacement. The seed must equal the original JSON except for the
existing default reserve when `shards` was absent. Unknown fields survive.
Account-authority fields are refused. The original new-account net-balance policy
is preserved as `new-profile-net-balance-v1`; this is an explicit historical
baseline, not a reconstruction or proof of earlier spending. Guest bytes remain
client-originated evidence, not proof of purchase or an anti-cheat attestation.

Retry retains the exact manifest. An independent claim receipt and a current
expected-account projection covering the seed are required, including after a
lost mutation reply. No response failure switches writers. Only an explicit
404/PGRST202 from capability discovery, before any claim emission, uses the
old initialization path; all other discovery failures or versions hold.
Originals are never deleted on success or rollback. Existing-account divergent
guest merges remain under the earlier conservative reconciliation contract;
this release does not claim to resolve their missing transaction history.

### Rollout and retirement evidence — lots 5–7

`rollout-gates.js` and `persistence-release-check.mjs` evaluate an explicit private
evidence file; they do not deploy, migrate players, authorize money, or activate
accounts. CI, client and server attestations must name the same exact Git SHA.
The gate requires isolated real transports, all named failure scenarios, two
distinct Android devices and shadow parity with zero second emissions. Mock
successes are deliberately insufficient. The retirement decision additionally
requires 14 elapsed calendar days of broad-cohort observation for that revision,
zero old writers, migration parity, restorable originals and a server-derived
mirror. Missing/contradictory proofs fail closed. See CLOUD_RECOVERY_391.md.

The migration prepares private `sync_cohorts` administrative rows (shadow/active,
protocol, revision, evidence digest) and an owner-bound read-only contract RPC.
It inserts **no** cohort. Browsers cannot create, activate, downgrade or delete
cohorts; active state survives a client rollback. Auth-user deletion retains its
normal FK cascade. These rows are preparation/attestation only: they do not
switch an application dispatcher or retire any RPC. No unsupported future
protocol may be activated by this schema. Existing command authorities remain.
There is intentionally no retirement stage before server projection parity.
No old snapshot/mirror writer or dormant-client reader is removed in this lot.
Such removal remains blocked until the actual release/restore evidence exists.


### Gameplay and domain readiness — lot 3

`gameplay-sync.js` derives profile, achievement, wallet and reward states from
the current account/client/hydration generation. A completed quest can be replayed
during a wallet-only reconciliation hold after an expected-account server read
confirms its stable catalogue ID in that same generation. The hydration hook
keeps only this ephemeral list of IDs, not another live profile. It is created
only for an existing same-owner cache with a Wallet diagnostic and no failed
achievement recovery. Auth in flight, password recovery, a changed account/client/
generation, missing proof, storage/reward/catalogue conflicts or unknown failures
do not grant this permission. Pack access and an actual local completion remain
independent guards for both stable-only and historical quest identities. Direct
historical replay entry now checks access before clearing the preceding attempt.

This permission enables play, not reconciliation of the ambiguous Wallet.
Free help retains its ordinary rules; paid help remains refused before mutation.
A replay solved during this hold captures locally before any capability network
read; closing offline must not depend on that read. It keeps the same attempt/reset
operation in its existing outbox and shows pending performance, without a new
star animation or confirmed badge. Rewards, daily credits and full-profile
installation still await their existing proof/readiness contracts. An older
server without Legacy commands cannot fall through to local authenticated
rewards during a hold. Retry retains the captured time, assistance, facts and
operation ID; session generation is checked on both victory paths.
Starting another accessible replay retires only the prior pending presentation
and completes its already solved attempt; its outbox entry stays intact. Failed
access/cooldown checks leave that presentation and attempt unchanged. Both map
and direct historical entry use this boundary, so a pending success cannot
suppress the next victory through a leftover global presentation flag. Existing
isolated receipt recovery may confirm commands without replacing divergent local
currency. No scalar maximum, new guest grant or entitlement is introduced.

New command confirmations now pass through `installAndRead` in the owner-bound
IndexedDB confirmed cache before reaching the UI. The re-read must match owner,
installation revision, full profile bytes and current session. A racing cache
writer/refusal reports the existing fixed cache issue; the already verified RPC
profile remains the compatibility fallback and no new command is emitted. Wallet
does this before its existing application/acknowledgement callback. Cold startup,
historical localStorage evidence and conservative hydration are retained for the
later migration lot; no old cache, backup, intention or unknown profile field is
deleted. These reads are not an independent server receipt.

Presentation distinguishes confirmed quests, Wallet review and pending rewards.
An uncertain local balance is not labelled spendable: the meter displays
« Éclats à vérifier ». Initial unverified hydration still guards completed replay
buttons. The new permission expires with the generation rather than persisting
an access flag. Rollback restores the prior stricter replay gate and compatible
adapters while retaining the exact cache/outbox formats from lot 2.


### Persistence coordinator and transactional cache — lot 2

The UI's Canonical, Legacy and Wallet adapters now share
`persistence-coordinator.js`. `submit(domain, owner, quest, evidence, identity)`
captures immutable evidence before asynchronous I/O. Its outbox facades retain
the existing namespaces, V1/V2 readers, paused states, receipts and operation IDs.
`coordinated-command-adapters.js` wraps the existing verified transports; it
does not introduce a second command emitter. Immediate actions, hydration and
reconnect replays use the same per-account queue. Account, client and hydration
generation are captured before waiting; stale work cannot start or acknowledge
through the supplied session guard. An in-flight request retains its queue slot
until settlement, including after a session change or rejected response.

Native Web Locks serialize updated clients across same-origin browsing contexts
using `lumen-command-dispatch:<owner>`. Without Web Locks, serialization is
limited to the current document; SQL locks, exact receipts and operation IDs
remain mandatory across old clients/devices. This is an explicit compatibility
limit, not a cross-device client lock. No lock release creates a new operation ID.

`transactional-command-cache.js` stores `lumenCommandCacheV1:<domain>:<owner>:<op>`
in the existing version-1 `lumen-canonical-outbox/intents` store. One read-write
transaction checks immutable bytes and commits both the original V2 intention
and its pending metadata (owner, domain, operation/quest IDs, creation time).
Acknowledgement retires the indexed intention and its pending row in one
transaction after the existing adapter proves the result. Pending metadata
contains no balance, badges, entitlements or speculative projection. A conflict
or abort leaves the original bytes intact. No database version upgrade, store
rename, key migration or old-intent enumeration change occurs. V1 and legacy
localStorage entries remain readable in place and are not silently migrated.
If IndexedDB is refused, the existing verified localStorage compatibility path
remains available; that path provides durable intent capture, not a paired
IndexedDB cache transaction. Its existing fixed storage issue reports remain.

The confirmed read model is `lumenConfirmedCacheV1:<owner>` in that same store:
one JSON record contains schema version 1, owner, local installation revision
and the entire verified profile, including unknown fields. Compare-and-swap
and a session guard prevent racing installations. The local revision is not a
server wallet cursor. Only results already verified by the existing receipt/
current-profile adapters reach its writer; no merging or numeric maximum occurs.
Cache refusal is reported as `confirmed_cache_unavailable` without retrying a
verified server effect. During this lot it is a mirror: existing verified
localStorage installation remains the UI read source. Switching that source,
domain-specific gameplay holds, guest claims and historical migration belong to
later lots. The guest profile and active attempt still use their original paths.

A coordinator constructed in `shadow` mode can inspect registered domains;
submit, dispatch, acknowledgement, pause, resume and capture archival all refuse
mutation. It is a separate read-only instance, never a second live dispatcher.
Rollback uses the original adapters and preserves both cache prefixes and every
original intention. Older clients ignore these extra keys and can still open
database version 1; pending cache rows are advisory, never replay authority.
Snapshots/CAS and the historical mirror are deliberately not retired in lot 2.

The explicit private recovery download adds `commandIndexedDB`, containing raw
intents and both cache prefixes. It performs read-only enumeration; no upload,
TTL or cleanup is introduced. Incomplete reads refuse the download. A pending
view orphaned by an older client's acknowledgement remains preserved but is
excluded from `pendingState`; actual intentions remain the replay source.


### Persistence foundations — lot 1 (23 October 2026)

Local saves return {ok:true,durable:true} only after exact read-back, otherwise
{ok:false,durable:false,code} with a fixed privacy-safe code. onSave runs only
after verified preservation; onIssue reports refusals independently. Hook failures
cannot turn a committed write into a claimed storage failure. A visible local
status reports failed preservation even for guests; no server receipt is implied.

Unreadable storage never authorizes replacement. Before replacing malformed local
bytes, preserve their exact original under lumenLocalQuarantineV1:<progressKey>:
<hash>:<length>:<collision>, read it back, and recheck the active source. Hashes
only select candidates: different bytes use a different collision slot. Failed
quarantine leaves the active original intact and refuses the save. Unsupported
catalogue origins stay held for review. Quarantine is local recovery evidence,
grants nothing, remains exportable, and is excluded from automatic archival and
deletion. Rollback preserves these keys; older clients do not recover them.

Hydration captures expected account/client and a monotonically increasing local
generation before storage/network work. Account/client replacement and every new
hydration invalidate the old generation. Both resolved and rejected awaits must
verify it before installing data or publishing current-session status. Generation
is ephemeral control state, not a persisted reward or server revision.

Cloud profile limits use 524288 UTF-8 bytes with JSONB structural-space and
scientific-number expansion reserve, rather than JavaScript character count.
Validation fails before a new RPC; server limits remain unchanged.

Existing command envelopes retain their domain/version, captured expected owner,
operation identity and immutable request. Durable acceptance, remote commit,
exact independent receipt, current covering projection and local acknowledgement
are distinct states. Neither a local save result nor a generation grants rewards.
No command namespace, receipt, outbox or authority is rewritten by this lot;
one entry point and transactional cache remain the later coordinator work.


### Explicit reviewed device recovery (#536/#537, 23 October 2026)

`approved-device-recovery.js` provides a manual installation boundary for a
historical wallet divergence after individual owner review. It does not alter
automatic reconciliation or grant clients authority over server balances.
The private `approved-device-recovery-v1` file records the explicit choice of
the verified cloud wallet, expected account, exact canonical JSON SHA-256 local
and cloud fingerprints and expiry. It is a reviewed handoff, not a signed
capability or permission to change server data. It contains no token or profile.
An operator must independently review originals and monetary discrepancies;
never automatically generate a file to release an ambiguous wallet hold.

The account diagnostic chooser checks size (4 KiB), captured owner/client and
QA exclusion. Expected-account restore and fingerprints must match. Existing
local acquisition coverage still applies after the explicit monetary choice.
Both originals are preserved in the existing exportable backup store, including
the existing `lumenBeforeCloud` export prefix for local copies and
its IndexedDB quota fallback. Owner, session and exact local bytes are rechecked
after awaits; a second cloud read must equal the first. Only the local progress
cache is installed, verified and followed by reload. No outbox, attempt, reward,
entitlement or acknowledgement is edited. Changed snapshots need another review.

No server schema, persisted profile field or recovery grant is added. Individual
repair approval is distinct from release approval. Server metadata repair and
device installation remain separate evidence; physical confirmation is required.

### Quest convergence candidate (#522, 22 October 2026)

The dedicated convergence branch introduces `quest-rules.js`, `quest-rewards.js`
and `quest-victory.js`. Visible ordinal owns teaching and assistance; all four
badges remain eligible from quest 1. The numeric
compatibility adapter preserves historical reward IDs and allocations.
`quest-victory.js` is a pure fixture/QA projection, never authenticated authority.

Migration `20261023181850_quest_contract_convergence.sql` adds V2
`lumen_commit_quest_command` / `lumen_get_quest_command`. Immutable facts,
operation ID, account and stable quest ID identify a command. For stable-only
quests the transaction locks the profile, computes rewards, records first-win
ledger evidence, updates daily/wallet authority and writes the profile and receipt
atomically. Numeric commands delegate to the existing historical transaction.
There is no bulk player rewrite or retrospective reward grant. Existing first
completion `performance`, stars, unknown fields and acquired badges survive;
mutable replay statistics live in `canonicalQuestState[id].runPerformance`.
Its attempts, best time and last qualified timestamp are server protected.

The client persists facts before I/O, independently reads the exact receipt and
the current verified profile, and checks owner/client/attempt throughout. A
solved flag alone cannot acknowledge a command. Current wallet cursors and
legitimate decreases win over an earlier receipt balance. Ambiguous errors
never select an older writer. V1 pending commands remain recoverable in their
existing namespace; a V1 badge replay cannot rewrite V2 run statistics.
An explicit missing V2 read endpoint permits V1 read recovery only.

A recreated V2 capture may be retired only after archiving its exact bytes and
original receipt, with matching operation/account/quest, unchanged immutable
facts and no improved elapsed time or uncovered badge. Readiness or a solved
flag cannot serve as this proof. Numeric cold resume restores both quest and
campaign/replay mode before the attempt engine's strict identity comparison;
a READY board does not establish preserved campaign access.

The historical outbox uses the same archival recovery for a later capture of
an already committed operation. It independently reads the original receipt
and current profile, requires the same account, operation, quest, start timestamp,
day and all assistance/qualification flags, a non-improved elapsed time, and
covered attempts/badges. Only a `22023` review pause permits this read-only
inspection; other holds remain. The later capture must postdate the receipt.
Exact original bytes and receipt are verified in a private exportable archive
before retiring that pending copy. No command is resent, receipt changed or
reward granted. Archive or session failure retains the pending operation.

Migration `20261023181900_quest_social_identity.sql` adds stable quest identity
to challenges and privacy-filtered create/get/list RPCs. Numeric URLs and
existing participation/terminal protocols retain their identity. No challenge
operation writes campaign progress, daily credit, unlocks or wallet rewards.
Migration `20261023181918_quest_analytics_identity.sql` adds capability-checked,
read-only ordinal metrics/timeline; it does not rewrite events or players.

The owner authorised these three migrations on 23 October 2026 after the
disposable PostgreSQL fixtures and concurrency CI passed. They are applied in
production under the versions above; 400 rules, RLS, grants and both identity
constraints were verified before client release. The SQL bodies retain their
tested fingerprints; filenames match the actual provider migration history.
Any subsequent production schema application needs separate owner authorization,
then schema verification before the client is released. Shared authentication settings and
SoldeZen data are outside this change. Roll back the client while retaining the
additive schema and receipts; never delete player projections to roll back.

Post-application advisor review retains the intended boundaries: private tables
have RLS and no player grants/policies; guest social RPCs reuse the existing
privacy-filtered protocol, while admin RPCs enforce a live capability (both
unauthenticated admin calls were rejected in production). These expected
[private RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
and [definer RPC](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
notices are documented rather than opening direct access. The two new
[unindexed FK notices](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
point to the immutable catalogue-key parent; rollout neither updates nor deletes
those keys. Existing shared-project advisor findings are outside this release.

Achievement installation quota (#536/#537): after a verified original backup,
an `achievement_install` quota refusal may archive one bounded batch of eligible
old originals through `archiveRecoveryBackups`, then retry installation once.
Each original is committed and read back in the existing exportable IndexedDB
store before its local copy is removed; two recent copies per family, unknown
keys, active progress and pending operations remain untouched. Owner, session
and exact local bytes must still match after archival. Any unverified archive,
remaining quota or conflicting reward keeps the hold. This automatic path is
limited to the installation quota refusal; explicit account maintenance remains
available. It does not confirm wallet balances or full synchronization.

Receipt-based wallet cache recovery uses the same verified snapshot fallback
when backup copies cannot fit in localStorage. Both local and remote originals
must be preserved before installing the exact receipt-covered projection;
session/owner/local-byte guards follow every wait. No command is replayed by
this helper, and the unchanged receipt predicate refuses unrelated acquisitions,
unknown facts and unproven currency differences. Recovery export includes local
wallet originals and both existing IndexedDB stores. No schema or reward changes.

Diagnostic investigation (#534 phase 2) is a read-only projection of the existing
capability-guarded cockpit timeline, owned by `ui/incident-investigation.js`.
It adds no persisted fields, RPC, grant, profile join or save writer. Closed
report export omits session/trace IDs and all arbitrary fields; GitHub receives
only a bounded draft after explicit administrator review. Details remain partial
and independent from #398 live health and business acknowledgements. See
OBSERVABILITY_534 for the bounded first slice and remaining phase-2 work.

Completed-quest presentation (#537) reads confirmed completion separately from
the existing action decision. A replay held for authentication/hydration keeps
its historical label and badges; this UI projection never writes progress,
changes ownership or releases a wallet/reward/storage conflict. Catalogue/pack
and direct-start guards are unchanged. See PROGRESSION and the #537 report.

### Wallet command cutover (#248/#391, 22 October 2026)

Migrations `20261022082153_wallet_command_authority.sql` and
`20261022082203_outbox_health_observations.sql` were applied in production on
22 October after explicit owner authorization. Their SQL is unchanged from the
reviewed candidate; filenames use the versions assigned by Supabase. Release
verification and operational observation remain separate from schema application.

`walletRevision` is a positive safe-integer server cursor, distinct from
`legacyVictoryRevision`. `shards` follows the current verified wallet projection,
including legitimate decreases. `wallet_authority` and immutable
`wallet_receipts` are private, RLS-enabled and not directly client-accessible.
Snapshot/CAS/backup writes cannot change wallet currency, daily projection or
cursor after activation. Trusted historical commands advance the same projection
before their existing snapshot write, under the same row lock. Canonical commands
retain their independent ledger and do not change the wallet balance.

An authenticated, verified hydration establishes the wallet with one zero-delta
`wallet-establish-v1` command. Paid hint/verify identities bind the actual attempt,
reset, action and use sequence; prices follow existing rules. Requests are durably
captured in the existing outbox under `Wallet` before mutation. Local/free/guest
rules and the zero-shard 90-second safety hint remain unchanged. If the wallet
protocol is unavailable, paid authenticated actions hold rather than debit an
unreceipted local scalar. A missing endpoint and an ambiguous failure are distinct.

Every debit/daily effect and its immutable receipt commit or roll back together.
Receipt lookup and current-profile read-back precede acknowledgement. A lost
response reuses exactly the same operation. Per-attempt hint/verify use counters
survive reload/reset through the attempt store, preventing reuse of a paid sequence.
Standalone daily claims share the existing day lock and reward keys; old daily
writers are rejected after activation, not converted into a second credit path.

No `max(local.shards,remote.shards)` recovery remains. An unexplained difference
preserves both originals and holds for review. A newer verified wallet cursor may
carry a lower balance; an equal cursor with another balance is inconsistent.
First-activation recovery requires an exact receipt delta and an otherwise
compatible local copy; unknown local data and conflicting daily evidence hold.
Backup verification must succeed before a receipt-based cache replacement.

`pending-navigation.js` creates only an ephemeral view from validated,
account-scoped durable victory intentions. It can enable the next quest under
the existing catalogue/Adventure rights policy. It never mutates or serializes
currency, badges, purchased rights or the confirmed profile. Presentation labels
the star as pending until server proof, and critical capture failure remains
visible without a modal covering the celebration. Confirmed reward eligibility,
replay and challenge isolation remain unchanged.

Historical victory retry: once an exact victory intention is durably captured,
the end-of-grid retry resumes the account-scoped canonical and historical queues
and requests fresh hydration through the same path as the account menu. It does
not resend a victory against a known blocked profile baseline. The callback
checks account, Supabase client, attempt ID and captured reset counter before
and after asynchronous resumption. An unconfirmed local capture instead keeps
the current board and retries capture. Neither path grants optimistic rewards,
discards intentions or changes profile/RPC schemas. The bounded pending-victory
diagnostic identifies the failed stage without copying player facts. Existing
unmergeable profile conflicts remain held; reloading is not proof of full sync.

PWA asset freshness (2026-10-19): the HTML build label identifies the document,
not proof that every imported native module is from that release. A real-browser
fixture reproduces fresh HTML with an old `cloud-profile.js` even after reload,
under the v9 worker and a fresh HTTP cache entry. The v10 worker bypasses HTTP
cache for same-origin public `/src/`, `/content/` and shell assets and returns
successful asset responses with `Cache-Control: no-store` so the document's
resource cache cannot retain them for the next release. The Cache API keeps an
explicit successful-response copy for network-failure fallback. HTTP refusals
are returned, never cached or disguised as offline success. Cache-write failure
does not block a valid network response. Provider/private requests are excluded.

Worker activation retires only old `lumen-assets-*` caches and claims the client;
the existing controller-change reload installs the new modules. It never clears
localStorage, IndexedDB, attempts, receipts or pending operations. This addresses
online update freshness, not atomic versioning of an entire graph under partial
network failure. The P0 extension caches only query-free public `/` and
`/index.html` navigation for offline restart; auth return URLs and private routes
never enter that cache. HTTP refusals remain visible. The reported phone still requires a
fresh diagnostic after publication; cache reproduction is not account recovery.
There is no SQL/Auth or profile reconciliation change in this delivery.

CAS error observability: `compareAndSwapCloudProfile` preserves a bounded
SQLSTATE/PostgREST code or a fixed category for exact known server guard
messages. A false CAS response has a separate conflict code. Raw provider
messages/details/hints are not attached to the thrown error. The existing
hydration recorder can therefore identify authority, permission or RPC refusals
without copying save contents. Codes do not establish that any specific player
hit a particular guard and do not change write acceptance, retries or recovery.
No migration or Auth change is required. After an exact historical authority refusal,
reconciliation also returns the names of protected fields that differ between
the attempted snapshot and the last verified cloud read. The first numeric
performance entry may include its quest index and bounded known key names;
unknown keys become `other`. Cooldown timestamps are excluded as in the server
projection. No values, arbitrary property names or full profiles enter this
diagnostic. These differences are evidence for investigation, not permission to
merge rewards, discard local progress or retry through a different writer.



### Profile field classification and transition audit (2026-10-19)

`CLOUD_PROFILE_FIELDS` in `src/persistence/cloud-profile.js` declares ownership
and reconciliation categories for the 22 currently inventoried top-level fields.
Both reconciliation paths derive their achievement/catalogue classifications
from it; coverage and compatible reconciliation share the tutorial-flag list
and validation. It is a classification contract, not a complete profile schema
validator, transaction ledger or permission to bypass a server guard.

| Fields | Ownership / reconciliation |
|---|---|
| `solved`, `stars`, `noHint`, `performances`, `autonomousWins` | Historical command projection after activation; existing achievement policies and SQL guards |
| `canonicalQuestState` | Canonical ledger; stable-quest reward evidence remains protected |
| `historyBackup`, `badges`, `legacyAdventureAccess` | Historical cache/awards/access compatibility; existing specific merge policies |
| `catalogueOrigin` | Server cohort; explicit contradictory origins hold |
| `legacyVictoryRevision` | Exact verified server cursor; never client-incremented or max-merged |
| `walletRevision` | Exact verified server wallet cursor; permits acknowledged currency decreases, never client-incremented |
| `shards` | Verified wallet projection; unexplained scalar differences preserve both originals and hold |
| `xp`, `skyScore` | Cumulative/derived compatibility policy; never evidence of a reconstructed spending history |
| `daily`, `challenges` | Existing server/command ledgers; contradictory receipts hold |
| `autonomySeen`, `fullBadgeIntroSeen`, `autoCrossUnlockSeen`, `speedBadgeIntroSeen` | Device acknowledgements; valid seen state is monotonic and grants no reward |
| `skyHistoryVersion` | Coupled score-migration marker; equal-only during reconciliation, no generic version maximum |

The audit reproduced two tutorial failures: coverage could accept a cloud copy
missing a locally acknowledged introduction; with local-only achievements, the
local-dominant path could stop on the same compatible flag before reaching the
existing two-way merge. Coverage now refuses the loss and metadata differences
route to compatible reconciliation. Invalid flags still hold. Tutorial timing,
wording, badge eligibility, and server reward projections do not change. Initial
coverage also requires equality for local unknown fields and explicitly stored
score-schema markers, so it cannot bypass the reconciler's refusal by replacing
the local copy first. Cloud-only extra fields may be adopted; a local unknown
value absent/different in cloud is retained for review, not deleted. Old caches
with such data or a conflicting explicit sky schema can therefore remain held;
this is a preservation limit, not automatic migration of those formats.

The transition suite inspects literal JavaScript profile assignments, executes
catalogue-derived guest victories, and scans outer keys of the audited SQL
`v_profile := v_profile || jsonb_build_object(...)` assignment shape. New detected
fields require classification before CI passes. This is not a complete JS/SQL
parser: renamed aliases, arbitrary dynamic writes, nested formats, older
uncollected saves and future SQL expression shapes require explicit review and
fixtures. Existing dedicated nested-performance and real-SQL suites remain required.

Remaining boundaries: global hydration still gates new historical victories;
ambiguous pre-command rewards and conflicting protected projections need audited
recovery; standalone daily/spending cutover remains open. Unknown fields and
unsupported score-schema differences are not made automatically mergeable.
No player save was imported or repaired during this audit, and an affected-phone
confirmation remains necessary after release. No SQL/Auth change is required.


Campaign resume (#470 follow-up): restoring a canonical board uses the existing
`lumenActiveAttemptV1` record and `lumenCloudOwnerId`; no server/profile field or
RPC is added. Before a verified account switch replaces a restored run, its exact
raw local record is stored in `lumenBeforeAccountSwitchAttempt_<time>` and read
back. A collision or failed verification blocks replacement. These local recovery
copies award nothing and are never uploaded as another account's progress.
Automatic numeric-to-canonical continuation waits for verified hydration and
the existing access decision. Reward intents, receipts and cloud guards remain
unchanged; the follow-up requires no production SQL migration.

Catalogue access (#470): `catalogueOrigin` is a positive published catalogue
revision in the existing profile JSON. New local campaigns carry the current
revision; unversioned nonempty profiles retain the frozen legacy cohort. Empty
profiles are classified as current before their first victory. An explicit
server origin is immutable: migration
`20261018200805_catalogue_origin_access.sql` validates revisions and rejects old
full snapshots deleting/changing it. The trigger inserts no player progress,
entitlements or rewards and performs no backfill. It is a private invoker trigger
with an empty search path and no client execution grant.

Cloud coverage/reconciliation recognizes the field explicitly. The verified
server cohort dominates an unversioned old-client cache; contradictory explicit
cohorts are held for review. No balance maximum or reward reapplication is added.
Local fresh/corrupt-storage fallbacks stamp the current revision, while old
nonempty saves remain unchanged. Canonical direct lookup also applies the shared
progression policy, separately from entitlement checks. Unknown origins require
an updated client; keep all saves and pending intents.

Apply the additive migration only with separate production approval, before
the client release. Rollback retains the guard, origin archive and profile field;
an old client dropping the field is refused, with its pending data preserved.
No Auth configuration or shared SoldeZen namespace is changed.

Historical command cutover (#391, production migration approved/applied on 2026-10-18
`20261018193133_legacy_victory_commands.sql`): immutable per-account
`attemptId-reset-resetCount` facts use `lumen_commit_legacy_command` and
`lumen_get_legacy_command`. A locked server profile, catalogue-derived private
rules and receipt apply completion, XP, sky stars, challenge/autonomy rewards,
performance, existing numeric mirror and existing Paris-calendar daily claim in
one transaction. Duration, assistance, error and frozen qualification remain
client attempt-engine evidence; this is not server puzzle/anti-cheat validation.
No backfill, balance maximum or entitlement change is introduced.

The first successful command activates private `lumen_commands.legacy_authority`
and server-owned `legacyVictoryRevision` for that account. Old backup/CAS writers
must retain its exact legacy reward projection and current revision. Cooldown
metadata is excluded from that projection. Existing cumulative XP cannot decrease;
canonical rewards may still increase it. This is a refusal, never balance merging.
Client hydration classifies `legacyVictoryRevision` as a server-owned cursor.
A verified server revision may replace an absent/older local cursor during
compatible reconciliation; it is retained exactly, never incremented or merged
by maximum. Invalid markers or a newer local revision block without writes.
Both recovery snapshots, CAS and independent read-back remain mandatory, and
server projection guards still refuse conflicting legacy reward changes.
Unknown fields retain their refusal policy. This client fix needs no SQL migration.

Attempt-counter compatibility (migration
`20261020084328_legacy_attempt_counter_metadata.sql`, approved/applied in production on 2026-10-20):
`performances[index].attempts` is a cumulative summary, not an immutable operation
receipt. Existing authenticated CAS/backup may increase this counter only while
all other historical reward/evidence fields and the victory revision remain
exact. Counts must be nonnegative PostgreSQL integers, never decrease from the
locked profile/authority floor, and cannot create/delete a performance record or
smuggle changed badges, times, versions, completions, rewards or XP decreases.
The trigger updates the private projection in the same transaction without
minting a revision, receipt or reward; later commands increment the reconciled
count. No existing profile or receipt is backfilled. CAS still detects concurrent
writes and independent read-back/local recovery copies remain mandatory.
Supabase assigned version `20261020084328`; the source file was renamed without
changing its reviewed SQL. Post-application read-only checks confirm the exact
helpers/trigger permissions, fixed search paths and no authority mismatch.
This corrects the mismatch with the existing client `max(attempts)` summary
policy, not a transaction union or proof of an unrecorded run. Other protected
performance differences still require command/audited recovery. Production
application requires separate approval after real PostgreSQL CI. Rollback may
restore the prior trigger body: the retained full projection already includes
accepted counts. Keep the helpers, receipts and player data; do not replay grants.

Preferences, canonical rewards and existing daily/spending writers
remain mutable. Old-client wins/imports changing that projection are refused:
preserve their pending local data for explicit recovery, never erase or invent
transactions. Any command failure rolls back activation, daily, mirror, rewards
and receipt together. Private tables have RLS and no client table privileges;
public invoker RPCs call private definers with empty search paths and auth checks.

Legacy intents use disjoint `lumenLegacyVictoryOutboxV2:` and
`lumenLegacyVictoryRetryV1:` keys in the existing IndexedDB/localStorage adapter.
Canonical clients cannot replay/acknowledge them. Exact same-account receipt and
current completion, requested badges and attempt counter precede acknowledgement.
Duplicates retain the initial outcome and return current state. Startup replays
before installation; background replay avoids active legacy attempts, while a
pending current win retries frozen evidence. Concurrent local edits prevent UI
installation. New victories still require verified hydration and preflush of
unrelated changes; removing that gameplay gate remains a later phase.

Queued historical command recovery may also run after a same-account verified
partial reconciliation, under the existing account/client-bound permission.
The replay shares the canonical in-flight lock, retains running/paused attempt,
current-victory, command-write, Auth, offline and visibility holds, and requires
the exact command receipt and current projection before acknowledgement. It
does not install any profile, modify divergent local bytes/balances, reload, or
report full sync. A clean fully hydrated profile retains normal reload behavior.

Both snapshot reconciliation paths treat the exact structured
`LEGACY_COMMAND_REQUIRED` refusal as `blocked / legacy_command_required` after
preserving both originals. This lets normal hydration establish partial recovery
instead of falling into a generic restore failure. No alternate snapshot write,
automatic reward conversion or suppression of the server guard occurs. Other
errors, failed CAS and failed read-back keep their existing failure behavior.
Pre-command achievements without immutable operations still require audited
recovery: acknowledging a queued command does not resolve those divergent facts.
No new persisted field, RPC, SQL migration or Auth change is required.

Only an explicitly missing read-only capability endpoint permits older-server
compatibility on an unmigrated account without an existing command intent.
Never downgrade after an attempted command or ambiguous response. Production
application requires separate approval; rollback retains RPCs, authority trigger,
receipts and intentions. Older clients can read, but cannot overwrite migrated
reward facts. Standalone daily/spending cutover and audited repair remain open.

Delivery boundaries, durable intent ownership, V1/V2 compatibility and the writer
cutover still required for #391 are documented in [Cloud recovery](CLOUD_RECOVERY_391.md).

Canonical outbox inspection distinguishes an empty readable queue from an incomplete read of its stores. A temporarily inaccessible backend retains a visible pending check and bounded retry; readable independent intentions may still recover. The replay guard is acquired before asynchronous enumeration, and cancelled scheduled work rechecks its generation before starting. Neither an unreadable record nor a missing badge is an acknowledgement.

Canonical retry policy is local metadata, separate from immutable victory evidence. `lumenCanonicalVictoryRetryV1:<user>:v2-<operation>` (or `v1-<encoded quest>` for old intentions) records only `version`, `userId`, `questId`, `operationId`, `intentCreatedAt`, `kind` and a sanitized error `code` in the existing IndexedDB store or localStorage fallback. It grants nothing and is not uploaded to the cloud profile. Unknown/transient failures retain bounded retry; an unconfirmed authentication failure pauses the account queue until a successful authenticated profile read, and an explicit request/permission/validation refusal pauses that quest for review while independent quests continue. A refusal is not proof that the reward is invalid: nothing is discarded. Verified server evidence takes precedence over either a returned error or a thrown/lost response. Classification uses status and structured codes, not provider message text; see [PostgREST error contracts](https://docs.postgrest.org/en/stable/references/errors.html).

Auth events alone cannot release a pause: the captured user/client must still match after the read and password/auth recovery must remain clear. Explicit **Réessayer** clears only that account's retry metadata before rehydrating; original intentions remain until server proof. A malformed retry record holds its quest for review and survives enumeration; explicit retry may reset this policy metadata without changing victory evidence. Failed metadata writes keep a session-only hold and report that it was not persisted. Older saves default to no pause; earlier clients ignore these sidecars, so a rollback can resume their previous retry behavior and must preserve all intentions. No SQL migration, balance, reward, entitlement or guest-save field changes.

Isolated ledger recovery: after verified cloud hydration reaches a same-owner local `partial_reconciliation`, an ephemeral permission bound to the authenticated user and exact client permits queued canonical ledger commands while full-profile readiness remains false. No local profile, in-memory progress, balance, baseline or legacy snapshot is installed or uploaded by this replay; only the verified intention is acknowledged. A full-hydration reload is forbidden in this state, and the global sync failure remains visible. Account/client changes and a new hydration invalidate the permission. Auth/password recovery, hidden/offline state, in-flight profile writes and active canonical play still hold replay; unverified restoration failures do not grant permission. This does not unlock new gameplay or authorize legacy rewards/daily/spending while reconciliation remains blocked.

Canonical command receipts (additive migration `20261018153436_canonical_command_receipts.sql`): V2 operation IDs can reach `lumen_commit_canonical_command` after authenticated `lumen_canonical_command_version` verifies protocol 1. The account is derived only from `auth.uid()`. Private `lumen_commands.canonical_receipts` owns immutable `(user_id,operation_id)`, `request` (protocol version, operation ID, quest ID, badges, performance), `outcome.newlyCompleted`, and `recorded_at`. The row is inserted in the same transaction as the existing canonical ledger/reward; it stores no whole profile, email, token or provider error. The player profile row is locked before receipt lookup and ledger invocation, retaining existing CAS/ledger serialization. A reused ID with different quest/evidence is refused, even if the quest is already solved. Separate operations still share the existing one-first-reward-per-quest constraint; separate badge runs never synthesize mastery.

`lumen_get_canonical_command` independently reads only the current account's receipt. Both command and receipt lookup require `p_expected_user_id`, copied from the captured intention owner and compared to `auth.uid()` before any access or mutation. This is a scope assertion, never an authorization source: all table predicates still use the authenticated ID. It prevents a late SDK token/account switch from sending an old intention under a new account even before the UI receives the auth event. For this protocol, both an exact receipt match and verified profile completion/requested badges are required before acknowledging a local intention, including after a lost response. Receipt outcomes describe the original command; duplicate calls return that outcome with the **current** profile, not an obsolete saved snapshot. No existing profile or V1/V2 intention is backfilled, rewritten or deleted by the migration. Public RPC wrappers use invoker rights; privileged implementations remain in the separate non-exposed `lumen_commands` schema, with fixed empty search paths, explicit auth checks, RLS and no direct client table privileges. Existing `lumen_private` auth-mail permissions remain untouched. See [Supabase function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker).

Deployment compatibility: an explicit `PGRST202` + HTTP 404 from the read-only version probe permits the existing ledger path; unknown responses, timeouts, auth errors or 5xx do not downgrade. Protocol 1 support is cached only in the current SDK client. Once a command is attempted, there is no fallback to another writer. V1 intentions have no invented operation ID and retain the existing ledger path. Old clients continue their existing ledger behavior; immutable command identity applies only to the new protocol. Rollback must retain receipts and their lookup functions; never delete them or reinterpret IDs. Keep the existing ledger during staged cutover. The migration is additive and requires separate reviewed production application; a merged client alone does not activate receipts on an older database. No receipt retention/deletion job is introduced: removing a receipt weakens command identity guarantees. This is a foundation for later legacy/daily/spending commands, not their implementation.

**Protected product invariant (#248):** anything earned or purchased by an authenticated player must be durably retrievable after another-device sign-in, PWA reinstall, local cache loss, reconnect or migration. Never replace a nonempty cloud record with an empty or stale local snapshot.

### Data ownership and invariants
| Data | Canonical source | Restore / merge rule |
|---|---|---|
| Quest completion, constellation unlocks, stars and badges | Authenticated cloud player record | Preserve earned achievements; deduplicate by stable quest/attempt identity; merge by documented progression semantics, never blind whole-profile replacement |
| Performance history and active attempts | Cloud after confirmed sync; offline changes pending | Stable identities, explicit conflict and retry policy; preserve existing history |
| Earned/spent Éclats and purchased consumables | Server-side auditable ledger / transactions for paid or spendable balances | Atomic, idempotent grants and spends; never take numeric max, which could undo a valid purchase/spend |
| Purchased skills, cosmetics, Adventure packs | Server-side immutable transaction history and current entitlements | Verify purchase server-side, grant exactly once, recover on every authenticated device; refunds/revocations as auditable state changes |
| Guest progress | Local until safely claimed by authenticated account | Explicit non-destructive account-link/merge; warn about device-local risk before paid purchase |

These are **target contracts**, not a claim that all implementations already exist. Adding paid commerce must not ship before server-side entitlements and tested restoration exist. An offline write is pending until server acknowledgement; do not label it cloud-saved prematurely. Use idempotency keys, stable IDs and authorization/RLS; separate Lumen data and SoldeZen data even when sharing a Supabase project. Test old schema/profile upgrades and delayed/out-of-order updates.

Any added player field MUST have a documented owner, cloud write/read, reconciliation policy, migration/default for old saves, and a regression test. Follow the [cloud persistence regression matrix](TESTING.md#cloud-persistence-regression-matrix) and PR impact checklist. Do not silently suppress or delete tests.

Performance qualification metadata (`performances[quest].lastQualifiedAt` and `lastQualifiedDay`) records cooldown state, not an immutable reward receipt. Reconciliation retains the latest valid timestamp and its associated local calendar day; equal instants use a deterministic day/string tie-breaker. Legacy day-only records retain the latest valid calendar day when neither snapshot has a timestamp. An absent day on the latest timestamp remains null rather than borrowing an older qualification's day. Invalid metadata or contradictory run/reward evidence still blocks reconciliation. Cloud coverage checks must preserve this metadata so a stale restore cannot shorten the 15-minute cooldown. This merge never grants rewards, increments attempts, or changes balances/entitlements. Existing verified recovery backups, compare-and-swap and read-back verification remain required; no schema migration is needed.

Performance summaries are cumulative records, not per-run reward receipts. Known numeric schema versions 2 and 3 reconcile to version 3 without recomputing badge eligibility; earned V2 mastery remains grandfathered, and merging separate badge flags never manufactures mastery. `attempts` and the summary's `stars` retain the largest observed nonnegative safe integer; attempts are only a conservative lower bound because snapshots have no run IDs, and are never summed. Best times and qualification cooldowns keep their existing merge rules. Differences involving unknown schema versions, invalid counters, conflicting run/receipt evidence and other unclassified fields remain blocked. Coverage checks reject restoring an older version or smaller summary counters. No reward, currency, entitlement or completion is granted by this summary merge; both recovery snapshots, CAS and verified read-back remain required.

Canonical snapshot protection (#391): `protect_canonical_snapshot` checks every
update of `lumen.profile_snapshots.payload`, including legacy backup and CAS
RPCs. A completed canonical quest, its first-completion metadata and earned
badges cannot disappear from a replacement snapshot. Missing/null state is
compatible with historical-only profiles; malformed state is refused. Badge
upgrades remain possible, and no numeric maximum is imposed on spendable
balances or revocable entitlements. This guard does not authorize automatic
repair of existing divergent data, protect deletion/account removal, or make
all legacy rewards server-authoritative. Its migration preflight refuses an
existing ledger/snapshot mismatch without rewriting player rows.

Cloud diagnostics (#398): local diagnostic history, local health counters and
the existing authenticated `lumen_record_sync_health` RPC are independent
best-effort channels. Quota, denied storage, corrupt local history or a logging
failure must not suppress the server incident signal or alter player state.
Remote payloads retain only event/reason/outcome/version, with identity derived
from the authenticated server session; no profile or token is transmitted.

## Client
LUMEN is a static web/PWA application using native ES modules without a build step. `index.html` is a markup shell: the existing document markup, stylesheet link, Supabase CDN script and module entry point. It has no inline JavaScript or CSS. `src/main.js` starts the UI controller; domain modules contain the application logic. `manifest.webmanifest` and `sw.js` are unchanged.

The #21–#26 migration starts from main `dcd9f3c872e623541be698edc212b64589d3b164`. Rules, catalogue, badge semantics, progression, tutorial, UX, storage keys and backend contracts are preserved. Issues #30/#31 are explicitly excluded. The stage descriptions below record the incremental extraction; the navigation map describes the final source layout.

## Astronomical generation contract (non-negotiable)
The canonical source of a constellation's visual geometry is a versioned, legally reusable stellar catalogue and documented atlas line convention, **not** manually sketched SVG points. New Adventures use IAU identities and stable HIP identifiers, extract complete RA/Dec coordinates, then derive geometry with the shared projection function. One reference constellation may back many quests; do not regenerate its sky geometry for each quest. Generation MUST reject missing reference stars/segments, invalid mapping, licensing uncertainty, and unsupported figures rather than silently substitute arbitrary shapes. Keep the legacy constellation data and player-earned star indices unchanged unless a lossless, tested compatibility/migration path is proven. A new cataloguing or rendering feature ships with completeness, visual, licensing/attribution and cloud-persistence tests. This requirement applies to all future automated generation, not only the current 40-constellation migration.

## Evolving catalogue contract

### Adventure addition is data-driven, not code-driven
Adding Adventures/packs, constellations and quests is a routine **catalogue-content update**. No fixed maximum (100/200/300 quests, fixed pack count or fixed constellation count) may be encoded into any consumer. All identifiers, campaign boundaries, page counts, completion states, unlock requirements, purchase entitlement mappings, cloud/local restoration and analytics must derive from a validated content registry. A fixed **page size** is allowed for presentation, but must never impose a fixed catalogue total. Stable identities and ordinal continuity must survive growth; adding content must not renumber previously saved quests or invalidate badges and entitlements. Availability and purchases are access policies, **not** catalogue-size constraints. A data-only addition should not require modifications to game-screen logic, authentication, persistence or UI flow. If an adapter needs editing for each new pack, correct the architecture rather than adding another hard-coded case.

Validation must include synthetic multiple-Adventures growth with unequal constellation sizes, empty/newly locked packs, a previously completed last quest, cloud and local legacy save restore, dynamic UI paging, purchase-right lookup, and a next-quest transition crossing an Adventure boundary. Never use historical fixture counts as production limits.


Catalogue expansion is an expected operation. Features must work with the content described by the loaded catalogue, including future additions, without requiring manual replacement of quest, constellation or star totals. This concerns curated content shipped with the application; it does not introduce runtime random puzzle generation or require a new remote catalogue service.

Use the appropriate source of truth:

| Concept | Owner / calculation |
|---|---|
| Audited puzzle inventory, including unused grids | `catalogue.js`: `CAT` |
| Scheduled quest → grid assignment | `data.js`: `CAMPAIGN_SIZE_SCHEDULE`, `CAMPAIGN6_ORDER` |
| Campaign/pack quest count, stable IDs, access policy | `content.js`: content registry, `baseCampaignQuestCount()`, pack metadata/access functions |
| Quest constellation, its range, current endpoint/completion | `progression.js`: `chapterForGrid()`, `constellationGridRange()`, `campaignQuestCount()`, `isCampaignFinalQuest()`, `isCampaignComplete()` |
| Sky target and exact quest rewards | `data.js`: constellation star counts and derived `SKY_TARGET`; `progression.js`: `skyStarsForGrid()` |

Do not use the number of all catalogue grids as the campaign length, or the campaign length as an entitlement decision. Content helpers belong to their domains; a new feature should use those helpers rather than create another count, state store or magic fallback. Display totals, result cards and analytics must use the same definitions as gameplay.

Preserve existing identities and ordering when appending content. Numeric quest indices remain persisted legacy keys; reordering or removing a quest or changing its grid requires a deliberate migration, not an incidental catalogue edit. Restore old local/cloud saves against the current content boundaries, retain earned badges and history, and resume an existing active attempt. A player who completed the old campaign must reach the first new quest. Completion acknowledgements must be scoped to the relevant content endpoint so an old finale acknowledgement does not suppress a new one.

Before delivering a feature or extension, assess loading/next/replay/reset, final victory, local/cloud restore, guest/authenticated paths, reward allocation and caps, Mon ciel and constellation celebrations, shared results, onboarding milestones, pack access, analytics and backend validation. Change affected consumers and documentation in the same PR. Check cached/reloaded application behavior where applicable; a changed total must not erase a player's progress or farm rewards. Mark surfaces as unchanged only after checking their dependency on the affected content.

Tests must cross-check independent representations: quest counts against contiguous schedule coverage and constellation ranges, unique valid puzzle references, and reward sums against each constellation's displayed stars and the sky target. Simulate appending N+k quests with different constellation sizes/star counts, including a one-quest constellation. Verify an old completed/capped save, the new first quest, the new final boundary, reload and replay without extra rewards. Reject malformed content rather than adjusting assertions to accept it. Keep structural, uniqueness and explainability audits for every actual grid.

Historical fixture sizes and intentional teaching milestones remain explicit product contracts. For example, the protected first-100 schedule and Orion difficulty curve describe historical content, while the current campaign endpoint comes from the registry. Tests must preserve that distinction. Run `node scripts/quality-gate.mjs` after changing content/progression; see [TESTING](TESTING.md) and [GRID_CATALOG](GRID_CATALOG.md). Include a catalogue impact statement and the required onboarding impact statement in the PR.

## Modular refactor: stage #21 (historical implementation)

Native ES modules are served directly by the existing static host; no build tool or framework is required. At stage #21 the two former inline scripts shared one module scope to preserve their initialization order. `src/ui/format.js` contains the existing date/duration formatting functions. The other domains were then extracted in separately validated stages.

The application still owns one live board (`n`, `puz`, `state`) and one canonical `lumenProgress`. Functions that use those values must read current state rather than capture a board that becomes stale on reset/replay. The first startup phase initializes tutorial/auth/identity, then local progress, then board/campaign/handlers; cloud initialization remains last. The feedback button is bound by `setupBetaFeedback`; its former inline handler and `window.openBetaFeedback` bridge were redundant and removed at #26. `window.runHintTests` and `window.lumenDiagnostics` are the browser testing entry points, not additional stores of game state.

The service worker remains network-first for scripts and the HTML navigation remains network-only. Module paths are relative to their importing file; CDN Supabase loading still precedes application execution. `hiCells`, formerly an implicit global, is now explicitly declared in the shared module scope.

### Task navigation

| Change | Source | Validation |
|---|---|---|
| Date/duration presentation | `src/ui/format.js` | Browser suite |
| Rules/proof engine | `src/game/engine.js` | Browser suite + strict catalogue audit + `scripts/engine-equivalence.mjs` |
| Campaign/catalogue | `src/campaign/catalogue.js`, `data.js`, `progression.js` | Browser suite + strict catalogue audit + `scripts/campaign-tests.mjs` |
| Persistence/auth | `src/persistence/{local,cloud,config}.js` | Guest reload + `scripts/persistence-tests.mjs` |
| Board/tutorial/UI | `src/ui/{game-screen,tutorial,sound,styles}.js/css` | Browser suite + touch smoke + `scripts/ui-equivalence.mjs` |
| Analytics/identity/referral | `src/analytics/events.js` | `scripts/analytics-tests.mjs` + browser suite |
| Regression suite/diagnostics | `src/testing/{hint-tests,diagnostics}.js`, `scripts/{browser-tests,cdp-client}.mjs` | All-size browser suite + `scripts/module-structure-tests.mjs` |
| Mon ciel / Adventures / access | `src/campaign/content.js`, `src/ui/sky-navigation.js`, UI controller integration | `scripts/sky-navigation-tests.mjs`, `scripts/sky-navigation-browser-tests.mjs`, full learning/browser gates |
| Shell/module imports/PWA | `index.html`, `src/main.js`, `manifest.webmanifest`, `sw.js` | Module structure + browser PWA asset/registration checks |

`scripts/browser-tests.mjs` runs all 66 original cases plus three UX cases on each of the four board sizes through Chrome DevTools, followed by actual touch cycle/drag/reset and guest reload checks. Use an isolated guest profile, a local static server on port 8000 and Chrome remote debugging on port 9222. Pass a report path as its first argument. Endpoints can be overridden with `LUMEN_TEST_URL` and `LUMEN_CDP_URL`. The runner closes the isolated browser after testing.

`sky-navigation.js` owns only ephemeral browsing selection (Ciel, Adventure, page and overview/detail pane). It reads the content map and current canonical progress through injected getters; it never writes quest progression. The same component serves all viewports, with six cards/page and CSS-owned column layout. The controller retains ownership of quest loading, replay, attempts and celebrations. `content.js` is the only Adventure grouping/access policy. Existing legacy IDs remain stable when its new Adventure membership is assigned.

Browser diagnostics can inject a synthetic map catalogue without editing campaign grids or saves. This tests multiple skies, access changes, dozens of Adventures and hundreds of constellation cards through the real component. Synthetic map coverage does not replace strict audits of every actual playable grid.

## Stage #22: game engine

`src/game/engine.js` exposes `createGameEngine(getBoard, getAutoCrossEnabled)`. It reads the current `{n,puz,state}` through the injected accessor and never accesses the DOM. Its API contains enumeration (`solutions`), automatic exclusions, stored-solution verification, Guardian conflict/validity checks, guided action checks and the existing proof engine. Algorithms, traversal order, reasons and hint text are retained. `solutions(board)` accepts an explicit board for the guided hypothetical placement, avoiding any mutation of application state during that calculation.

Victory validation is now called by the renderer through `validateGuardians`; rendering and celebrations remain in the application. The catalogue audit and offline generator import the same engine used in the browser instead of copying its source from HTML. `scripts/engine-equivalence.mjs` compares complete proof objects and guided/error/enumeration outputs against main commit `dcd9f3c872e623541be698edc212b64589d3b164`, across every catalogue grid and automatic-marking modes. An optional first argument supplies that baseline HTML without invoking Git.

## Stage #23: campaign

`src/campaign/catalogue.js` owns `CAT` and `LEVELS`; `data.js` owns quest metadata, fixed schedule, constellation shapes/counts and existing badge display definitions. `progression.js` exports pure campaign calculations and `createCampaign(getProgress, saveProgress, getAttempt)` for calculations that use the current canonical progress/attempt. It retains the existing performance recording and badge rules verbatim in behavior; #30/#31 remain out of scope. UI navigation, quest loading and celebration orchestration belong to the UI controller.

`scripts/campaign-tests.mjs` preserves original catalogue and historical data/reward comparisons against the starting main commit, and protects the first 100 schedule assignments against the immutable pre-wave-2 commit. Current boundaries, constellation rewards and registry coverage derive from content data. It checks four historical progress fixtures, capped-save recovery and hypothetical future extensions. Both the strict audit and generator import catalogue/campaign modules directly; the generator's optional write targets `src/campaign/catalogue.js` instead of HTML.

## Stage #24: persistence

`src/persistence/local.js` exposes `createLocalPersistence(storage,getProgress)` for existing load/save behavior. `cloud.js` exposes `createCloudPersistence(model,hooks,environment)` for profile, entitlements, auth initialization, progress and daily synchronization. `config.js` contains the same public client URL/key. No backend schema, RPC, auth provider, SDK version or storage format changed.

The model adapter has explicit getters/setters for the existing auth/progress/quest fields, so async operations observe the same live values as before. Hooks retain UI refresh and existing campaign calculations. DOM-dependent profile/auth presentation remains in the cloud module through its injected environment; it is a documented coupling, not an additional source of truth.

`scripts/persistence-tests.mjs` compares outputs, serialized progress, RPC payloads and callback effects against starting main using four local fixtures and five simulated cloud scenarios. It includes denied storage, malformed data, guest mode, empty/existing/sparse cloud progress, reconnect/sign-out and reported network errors. Real guest reload is exercised in Chrome. Live OAuth login and live authenticated cloud writes are not claimed or performed by these tests.

## Stage #25: UI and input

`src/main.js` starts `startGameScreen()` from `src/ui/game-screen.js`. This controller owns the one live board/attempt state, composes the game/campaign/persistence APIs, binds events and orchestrates rendering/navigation/celebrations. `tutorial.js` owns the existing general-help walkthrough; `sound.js` owns audio and its preference; `styles.css` is the existing CSS moved without rule changes. HTML is now markup plus stylesheet/CDN/module entry points.

The scripted coach, assistance restrictions and all timings remain unchanged. The pointermove callback has a name (`moveDragCross`) so source/performance tests can inspect the actual handler after it leaves HTML. Actual Chrome touch tests also observe board child mutations and reject a full board rebuild during drag. The 66 browser regression cases are retained; only their two HTML-source lookups were updated to inspect the real module handler.

`scripts/ui-equivalence.mjs` compares rendered board DOM, geometry, cell colors/borders and control text/visibility/enabled states with starting main. It covers empty/marked boards for quests 1, 3, 12 and 48 on 390x844, 360x640 and 1440x900 viewports (12 scenarios, both mobile and desktop). To reproduce, serve the starting main HTML temporarily as `.refactor-baseline.html` next to the current page in the isolated browser test setup, then remove that temporary file. Reports are under `docs/validation/refactor-ui-equivalence.json`. Analytics and the suite were subsequently extracted in #26.

## Stage #26: analytics, tests and final boundaries

`src/analytics/events.js` exposes `createAnalytics(getClient,environment)`: anonymous/session identity, existing event RPC payloads and referral sanitization. The UI calls it at the original startup/event locations, preserving event order. The client accessor reads the current Supabase client after async initialization. `scripts/analytics-tests.mjs` compares identity storage, event names/payloads, sanitized referrals and failed-network warnings against starting main in eight scenarios, without live writes.

`src/testing/hint-tests.js` owns all 66 original cases; `diagnostics.js` owns browser test orchestration and snapshots. Both receive explicit live state/API adapters from the controller. `window.runHintTests` and `window.lumenDiagnostics` remain the supported browser entry points. No test was removed. The development Chrome runners share `scripts/cdp-client.mjs`. `scripts/module-structure-tests.mjs` checks import targets/cycles, shell boundaries, original CSS and preservation of every case label.

The obsolete inline feedback handler/global bridge was removed after verifying the button already has its original listener. HTML retains the full markup because its IDs, accessibility attributes and DOM ordering are consumed by the unchanged UI. No substantial business logic remains in HTML. There are no compatibility copies of extracted domain algorithms.

Remaining coupling: `game-screen.js` is still a sizable imperative UI controller, owning scripted onboarding, rendering, event binding, reward presentation and PWA prompts. Cloud profile/auth presentation uses injected DOM references. Some historical regression cases inspect source strings rather than exercising every real integration. These are intentional boundaries of this behavior-preserving migration, not claims of complete UI decomposition or live backend validation.

The final browser gate also verifies active/controlling service-worker registration, manifest display/start URL, successful icon/module asset responses and absence of uncaught startup/runtime exceptions. Navigation stays network-only and assets network-first as before; full offline navigation, live OAuth, production analytics and notification delivery are not asserted.

## Subsequent UX changes (#16/#17/#19)

The modular migration reports above describe behavior-preserving extraction. PR #38 then intentionally changes hint vocabulary, primary success CTA and rules presentation. `setupRulesHelp()` in the UI controller binds the existing help dialog markup. The scripted click interceptor exempts the rules modal, preserving teaching state and allowing backdrop dismissal. The rules modal consumes no permanent board space. The compact success card is height-limited and scrollable. `scripts/ux-cleanup-tests.mjs` exercises these changes with real browser events; the suite now contains 69 cases (66 original plus three UX regressions).

## Local/guest mode
Guest play is first-class. Progress is stored in localStorage under `lumenProgressV1`; tutorial, install/push choices, anonymous/session identity and UX preferences also use localStorage keys.

Anonymous users are tracked through an anonymous identifier/session so usage can be measured without requiring authentication.

### Existing persistence contracts (inventory before #24 extraction)

The canonical `lumenProgressV1` object retains `solved`, `historyBackup`, `badges`, `noHint`, `performances`, `xp`, `challenges`, `stars`, `shards`, `daily` (dates/rewards), `skyScore` and `skyHistoryVersion`. Keys are zero-based quest indices; cloud `p_puzzle_id` values are one-based. No schema/key migration is part of the refactor.

Other existing keys: `lumenTutorialSeen`, `lumenAnonymousIdV1`, `lumenReferral`, `lumenInstalled`, `lumenInstallLater`, `lumenWelcomeDayV1`, `lumenPushChoice`, `lumenManualCrossTipSeen`, `lumenGuidedErrors`, `lumenSound`, `lumenAutoCross` and the read-only legacy `regaliaAutoCross` fallback. The Supabase SDK retains its own auth storage.

RPC contracts retained: `lumen_get_profile`, `lumen_set_nickname(p_nickname)`, `lumen_get_entitlements`, `lumen_get_progress`, `lumen_save_progress(p_puzzle_id,p_duration_seconds,p_hints_used)`, `lumen_get_daily`, `lumen_save_daily(p_play_date,p_puzzle_id)`. Analytics and feedback RPCs remain separate responsibilities. Authentication retains Google OAuth with the current origin/path redirect, `getSession`, `onAuthStateChange` and `signOut`.

The current merge prioritizes a non-empty cloud history, otherwise uses local/backup history, then derives a continuous prefix and imports missing local records. This exact existing behavior is retained; this extraction does not redesign merge policy or badge semantics.

## Supabase
The client uses Supabase. Project-side database objects for LUMEN live in the **`lumen` schema**. Relevant RPC responsibilities visible from the client include:
- profile/nickname;
- progress save/load and local-to-cloud migration;
- analytics event tracking;
- daily play;
- entitlements;
- feedback and difficulty rating.

Google OAuth is supported. When a local player signs in, local solved history must be merged to cloud rather than discarded.

## Analytics
Events include puzzle start/completion, hints, sharing/referral, installation and related engagement events. Referral parameters are sanitized before analytics.

## PWA
Installation is offered only after meaningful engagement (currently after 3 solved quests), and standalone installs should not be nagged again. Push/reminder permission must only be requested after an explicit user action; the app hides its own prompt before invoking the Android/browser permission dialog.

Push support should not be considered complete merely because subscription/server code exists: service-worker receipt/display and end-to-end delivery must be verified.

## Security
The public Supabase client key in browser code must be treated as public. Security must rely on RLS/RPC authorization, not secrecy of browser credentials. Never add service-role keys or other server secrets to this repository.


## Anonymous player observability
Anonymous play is a deliberate product mode, not an error state. Analytics should make it possible to distinguish:
- an anonymous installation/player identity;
- sessions/visits for that identity;
- authenticated user identity after sign-in;
- campaign progress such as solved quest count/current constellation;
- key engagement events such as puzzle start/completion, hints, replay, share and install.

Do not equate the number of authenticated Supabase users with the total player population. Guest players may exist only through local progress plus anonymous analytics.

When a guest later authenticates, progression merge must preserve the strongest valid continuous progress. Analytics identity linking should avoid double-counting where practical while keeping authentication data and gameplay analytics responsibilities distinct.

## Data ownership principles

Canonical stable-ID quest replays use `lumen_commit_canonical_victory`, the same
transactional server ledger as first completion. Under the player row lock,
replays merge explicitly earned badges monotonically without changing XP,
stars, first-completion performance, currency or entitlements, and without a
second reward event. Maîtrise must be explicitly earned on one run, never
inferred from accumulated badge flags. The client confirms every requested
badge by reading the cloud profile before acknowledging its durable outbox
entry; an existing solved flag alone does not confirm a replay upgrade (#453).
Campaign truth (catalogue, quest order, constellation mapping and rules) belongs to version-controlled application data/code. Player-specific mutable state belongs to local persistence and/or Supabase.

Derived UI counters should be recomputed from canonical state rather than becoming independent sources of truth. This is especially important for solved-quest totals, constellation progress, stars and unlock state: duplicated counters can drift and previously caused visible inconsistencies.


## Attempt lifecycle

Timed play is owned by `src/game/attempt-engine.js`, not by screen-open time. A canonical attempt has a stable `attemptId` and moves through `READY -> RUNNING <-> PAUSED -> COMPLETED`, or to `ABANDONED`. The engine measures accumulated active duration only.

A newly displayed board starts in READY behind a protective mask. The first intentional board gesture starts the attempt. Backgrounding pauses a running attempt; returning never silently resumes it. Reload restoration also returns a previously running attempt as PAUSED. Board state, accumulated duration, assistance and reset count are persisted with the attempt.

Reset clears the board while retaining attempt identity, elapsed active time and assistance history. Campaign, replay and challenge share this lifecycle; badge eligibility (#30) and challenge one-shot business rules (#18) remain owned by their respective features rather than duplicated in the engine.

## Social challenge architecture (#18)

Social challenges use the existing static/PWA client plus Supabase RPCs. `src/campaign/social-challenge.js` owns the domain rules and RPC adapter; `game-screen.js` only orchestrates UI/gameplay. The normal board, rule engine and attempt engine are reused: there is no duplicate challenge gameplay implementation.

Backend objects:
- `lumen.social_challenges`: immutable sender snapshot (quest, first-play performance, sender identity/display name);
- `lumen.social_challenge_participations`: one row per challenge + participant identity, with started/completed/abandoned state, performance and sender read/push state;
- `public.lumen_push_subscriptions`: existing PWA subscription store, extended with authenticated/anonymous ownership and a social-notification preference.

Challenge URLs contain only an opaque UUID (`?challenge=<id>`). They contain no nickname, time, badge, email or other PII. The pre-play RPC intentionally withholds the sender's performance until that participant has completed/abandoned; the sender can always inspect their own snapshot.

Authenticated ownership uses `auth.uid()`. Guests use the existing stable anonymous browser ID and must provide a 2–24 character display name before social participation. The unique server key `(challenge_id, participant_key)` makes a normal guest/browser one-shot. Clearing browser storage or changing browser/device can bypass guest identity, so the product must never claim absolute anonymous anti-cheat.

Challenge writes go through SECURITY DEFINER RPCs while both social tables keep RLS enabled and no direct client write contract. The live migration is named `lumen_social_challenges`; its repository companion is `supabase/migrations/20261004_lumen_social_challenges.sql`.

The existing `lumen-push` Edge Function also owns challenge-result delivery. A completed participation triggers a server-verified challenge-result notification to subscriptions owned by the sender. Push payloads reveal only that a result exists, not the result itself, and deep-link to `?myChallenges=<challenge-id>`. Notification tags are challenge-scoped so repeated results for the same shared link collapse instead of flooding the device.

One challenge link may have many independent participants. “Mes défis” is therefore sender-centric and shows participant count, unread results and each terminal result. This data model intentionally leaves sender/recipient account links compatible with the later Social V2 issue without requiring an internal friends/inbox system now.

### Security-advisor note
Supabase reports the two social tables as `rls_enabled_no_policy` and the anonymous social RPCs as callable SECURITY DEFINER functions. For #18 this is intentional: guests are a product requirement, direct table access is denied by RLS, and the narrow RPCs enforce the ownership/one-attempt contract. These warnings are not a claim that the whole project is security-clean; unrelated existing advisor warnings remain and must be reviewed separately.

## Current learning controller (#57)

`src/game/learning.js` is a pure, read-only lesson planner over the canonical board. It produces the expected cell actions and context-specific copy, using the audited opening grid and its `learnOrder`. `game-screen.js` enforces the interaction gate and presents the coach. It does not keep a second teaching board or persist a parallel lesson cursor; refresh resumes by deriving the step from the restored attempt board. Later placements spotlight the territory instead of the solution cell. Quest 2 derives a short placement/drag lesson from the same persisted board using `dragLearningStep`, then releases free gameplay and normal assistance controls. The transient pointer gesture freezes its permitted cells until release so completing the row mid-drag cannot mark unrelated cells. The older stage #25 descriptions above record the historical extraction, not the current learning behavior.

Validation: `scripts/learning-tests.mjs` proves the five forced deductions and requested exclusions; `scripts/learning-browser-tests.mjs` exercises real touch/mouse actions, ignored taps, reload, drag, complete quest 1, free quest 2 and Mon ciel navigation on 360x640, 390x844, 768x1024 and 1440x900 viewports. Both are part of the CI gate.
### Server incident age and alert scope (#398)

`20261017181513_sync_health_incident_tracking.sql` versions the existing bounded
telemetry table and RPCs. A failure is either `hydration_failed` or
`hydration_reconciliation` with outcome `blocked`. Its age starts with the first
failure after the last `hydration_ready`, using `(recorded_at,id)` to break ties.
Repeated failures must not reset this age; a reconciliation result alone is not
proof that hydration finished. The admin cockpit's existing `stalled_players`
alert includes every unresolved incident at least fifteen minutes old, even if
it started outside the selected report window. Reason/version and affected
player aggregates include blocked reconciliations within that window.

Raw telemetry remains insert-only for authenticated players, with RLS ownership
derived from JWT. Only `analytics_cockpit` capability holders can read the
aggregate RPC. `oldest_unresolved_at` is an aggregate timestamp, not an identity.
No profile snapshots are sent. This correction does not add email/push alerts,
outbox backlog telemetry, retention jobs or session/platform correlation; those
remain acceptance work under #398.


### Canonical start-state isolation and recovery

A new canonical quest uses its stable ID for its board, attempt and victory.
Starting it does not stamp a numeric `performances[levelIndex]` entry; the dormant
legacy index is not a second active quest. Legacy qualification stamping retains
its existing behavior. Canonical presentation suppresses the legacy bonus/finale
banner instead of promising a reward from an unrelated constellation.

`archiveCanonicalStartMetadata` repairs only the recognized old producer's
cooldown-only record on a dormant numeric slot absent from a verified cloud
profile, while a valid started RUNNING/PAUSED canonical attempt belongs to the
same verified account. The record must contain exactly its matching questIndex
and valid qualification timestamps, with no counters, badges, time, unknown
fields or other evidence. Existing completion/reward fields elsewhere in the
profile remain unchanged, including an already-completed legacy boundary. Both full originals are preserved and read back via
the existing recovery snapshot stores before changing local bytes. Account or
concurrent local changes abort; storage failure preserves the hold. The active
board/attempt, durable victory intentions and all earned profile fields remain
untouched. A successful archive reloads once to install coherent memory; the
recognized record no longer exists on the next pass. This is not generic
reconciliation or deletion of uncertain achievements, and never writes cloud.

Canonical victory capture is serialized for the exact account/client, stable
quest, attempt and reset while its asynchronous write/read-back is in flight.
Different contexts remain independent; an old completion cannot clear a newer
capture. Retries reuse frozen persisted evidence and become available after the
current capture exits. A local diagnostic records a fixed capture stage/category
without provider text or progress values. Server acknowledgement/read-back still
precedes success and reward presentation. No SQL/Auth change is required.

Canonical solved-board startup (follow-up to `63939b8`): rendering a restored
canonical board before startup Auth resolves must leave the board and attempt
untouched, with a neutral account-restoration message rather than a storage
failure. After verified full hydration, schedule the ordinary live-board
validator for the same owner, cloud client, quest, attempt and reset count.
Account/client/attempt changes, incomplete hydration and password recovery cancel
that wake-up. Only the existing durable outbox and server acknowledgement can
complete the attempt or award rewards. No SQL or Auth configuration change.

Committed canonical attempt recovery (`a007a70` follow-up): a restored solved
board can survive removal of its acknowledged local intent. Capture durably
before network I/O as usual, then read the exact owner/operation/quest receipt
and current verified projection before sending a command. A known receipt
restores its original reward evidence and reports an already saved victory,
never a new grant. Missing receipts retain normal command handling; unreadable,
mismatched or incomplete proof never becomes a solved-only acknowledgement.

A regenerated local V2 capture may have a later elapsed time under that same
operation ID. It is NOT acknowledged as matching changed evidence. The narrow
`archiveRecreatedCapture` path verifies the receipt and saved badges, a known
reward/entry shape, equal or worse timing/assistance, no additional earned badge,
and (unless evidence is exactly equal) creation after the receipt. It read-backs
an immutable archive containing the full local entry and accepted receipt before
retiring the unchanged active entry and retry sidecar. Unknown fields, better
times, uncovered badges, wrong owner/run, conflicting/incomplete store scans,
archive failure and changed session/record retain the pending entry. Archives
use `lumenCanonicalRecreatedCaptureArchiveV1:` in IndexedDB or localStorage,
scoped by owner, operation and capture creation time, outside active outbox scans.
No original receipt, server projection, reward, grant or local evidence is
rewritten; no SQL/Auth migration or production player write is needed.

Queued receipt recovery (`6b765bd` follow-up) also runs during verified startup
and existing outbox reconnect replay, independently of the currently displayed
quest. A canonical V2 record held for `review`/`22023` may undergo the same
read-only exact-receipt/current-projection check and narrow verified archival;
it does not resume a changed-evidence write. Other review/auth holds stay held.
Missing receipts, uncovered evidence, unreadable storage and session changes
retain the entry; unchanged-evidence ordinary replay still uses its normal path.
Already archived recovery is never acknowledged again as matching changed
evidence. Recovery cannot mutate the running board, current attempt or reset.
