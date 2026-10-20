# Data and architecture

## Account modes (2026-10-18)

Lumen has two public modes: local guest discovery without an Auth account, and an authenticated account using Google or email with a password. Email OTP/magic-link login is retired in the Lumen UI and its dedicated mail endpoint. Existing accounts retain their identity, progress and entitlements; use Google or **Créer ou réinitialiser mon mot de passe** to establish a password on the same email address. Recovery/confirmation emails remain supported. Do not disable email Auth globally: the Supabase project is shared with SoldeZen.

While the SDK restores its startup session, the mobile account menu shows a neutral pending state and disables the sign-in action. Only a resolved unauthenticated session may offer sign-in; pending rendering must preserve password-recovery state. SDK session persistence and refresh defaults remain unchanged. Subscribe to Auth events before startup session/confirmation I/O. A late startup read cannot replace a newer login/sign-out event; deferred restoration must check the account identity. An expired confirmation must never sign out an existing session. Explicit logout uses the local session scope, preserving sessions on other devices. Recovery opens the parent profile editor and waits for password creation before cloud hydration/reload. Cloud restore failures remain authenticated and visible as synchronization failures; keep divergent saves protected and provide a safe reload/retry. Refresh an open sky after successful hydration so quest availability reflects the verified account.

No player-data schema or reward reconciliation policy changes with these account modes. Live device validation remains necessary when diagnosing storage loss between login and reload; passing simulated sessions alone does not prove that an affected PWA retains its session.

## Cloud persistence contract

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
network failure or cold-offline startup. The reported phone still requires a
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
and reconciliation categories for the 21 currently inventoried top-level fields.
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
| `shards`, `xp`, `skyScore` | Transactions/derived score; existing legacy max recovery remains an approximation, not an audited economy |
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
`20261020081735_legacy_attempt_counter_metadata.sql`, not yet applied in production):
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
