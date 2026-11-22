# Data and architecture

Analytics #708 correction (`d4d914b` baseline): the existing admin cockpit now
also reads receipt-derived service activity, without optional collection.
Private readers, access guards, UTC receipt semantics, qualified identity and
duration rules, freshness, rollback and limits are specified in
[PRODUCT_ANALYTICS](PRODUCT_ANALYTICS.md#reliable-service-activity-and-missing-coverage--708-correction).
The repeatable migration adds functions and receipt-time indexes only; no player
row, save, reward, receipt, entitlement, wallet or consent preference is changed.
Cloud merge/restore and the existing regression matrix need no rule changes.

Analytics #708 Lot C: `lumen_admin_engagement(p_days)`
(`20261121160000_admin_engagement_708.sql`) is a read-only, `analytics_cockpit`-only
aggregate reader. It reads `analytics_events`, the #18/#35 challenge tables and the
#882 `daily_runs`, and returns counts only (no identifier, nickname or URL). It
writes nothing and needs no cloud merge, restore or consent change. Contract:
[PRODUCT_ANALYTICS](PRODUCT_ANALYTICS.md#mesure-dacquisition-708).
Lot D adds `lumen_admin_version_health(p_days)` (`20261121170000_admin_version_health_708.sql`),
the same kind of read-only admin aggregate over `lumen_sync_health` and `outbox_health`, per app version.

## Current architecture

Lumen is a static PWA using native ES modules, with no application build step.
`index.html` owns markup; `src/main.js` starts `ui/game-screen.js`. The controller
composes one live board, attempt and progression model; injected getters observe
current state rather than copied snapshots. Browser dependencies are pinned
under `src/vendor/`. Development-only npm tools never enter the browser graph.

| Responsibility | Current owner / first route |
|---|---|
| Rules, proofs, active attempt | `src/game/engine.js`, `attempt-engine.js` |
| Catalogue, stable quest identity, access and rewards | `src/campaign/`; [feature map](architecture/feature-map.md) |
| Local staging, ownership, receipts and cloud restoration | `src/persistence/`; [blocking contract](#cloud-persistence-contract) |
| Board, sky, onboarding and result composition | `src/ui/game-screen.js` and injected UI modules |
| Worker updates and public asset-cache refresh | `src/ui/app-updates.js`; no access to player storage |
| Offline public shell and asset graph | `sw.js`; [release verification](RELEASE.md) |
| Telemetry and test entry points | `src/analytics/`, `src/testing/` |

Use the [feature map](architecture/feature-map.md) to locate a symptom, relevant
[dependency rows](architecture/dependency-map.md) to follow its producer/consumer,
then the [test map](architecture/test-map.md). Current executable validation is
documented in [TESTING](TESTING.md#current-validation-entry-points). Counts come
from current suite reports, not old snapshots. Fixtures/CI do not establish live
Auth, email delivery or physical-device acceptance.

Stages #21–#26 and #38 results below are historical October 2026 records. Their
counts and then-unchanged behavior apply to those snapshots; current owning
contracts/modules take precedence. Prepared migrations and activation are separate facts.

## Onboarding grid revision 1 (#650, #692)

Legacy quests 3–6 are played through `levelIndex`; `choose()` reads their revised
board from the canonical quest when it carries a grid revision. Revision 1 is the
soft revision: no `gv` operation marker, no stored `gridRevision`, and every
server guard (`grid_revision>1`) ignores it, so legacy victories, acquisitions and
saves keep their revision-0 identity. Active local attempts on the former board are
archived by the existing grid-revision restore check. Ranking runs and boards use
revision 1; a pending ranking run captured on a replaced board is moved to
`lumenRankingObsoleteV1:` instead of blocking later entries. The data-only migration
`20261114090000_onboarding_grid_revision_650.sql` sets `quest_rules.grid_revision=1`
for these four quests and must be applied right after the matching client deploys.

#692 replaces the quest 4–6 boards again **under the same revision 1** (owner
decision: only owner test runs existed; their revision-1 ranking scores are removed
by an operator script, never by a migration) and moves quest 7
(`planned-real-01-q07`, a non-legacy canonical quest) to soft revision 1. Quest 7
is played from `canonicalActiveQuest`; its new challenge links carry
`grid_revision: 1`, while older links without a revision keep the original board.
`20261114180000_quest7_grid_revision_692.sql` only moves quest 7 to revision 1,
again right after the matching client deploys.

## Mixed grid revision 2

The source-owned revision-2 manifest changes 200 boards in Adventures 5–9 and
preserves 280 targeted boards plus all Adventures 1–4. `quest_rules.grid_revision`
is private reference metadata, independent of reward JSON and player reset epochs.
The prepared migration seeds only the previous revision-1 registry; it neither
activates revision 2 nor changes any player's snapshot. `mixed-grid-revision-fixtures`
generates the explicit reviewed activation input from both immutable manifests.
Activate reference metadata only with the matching client available.

Revision-2 attempts carry `gv2.` in the existing operation identity, after an
optional `qr<reset epoch>.` prefix. The server validates the active version under
the snapshot lock before looking up a receipt. It stores `gridRevision` in new
records, refuses old badge-only writers and skips old acquisition recovery for
changed boards. Unchanged revision-0/1 commands retain their existing protocol.
Snapshot guards require the matching private authority and current grid marker.

The private three-argument `reset_replaced_quests` overload accepts only a scope
whose active reference version matches the requested epoch. It archives both the
current entry and prior reset histories, preserves spendable balances/receipts
and acquired access, and skips a repeated epoch instead of erasing new replays.
Only changed boards belong in a reset scope. `quest-reset-scope --revision 2`
derives it from hashes; `--revision 1` remains available for historical audit.
Grid and player epochs are both checked when archiving obsolete local intents,
including an older client that understands reset epochs but still plays a v1 board.
All original local bytes remain archived before replacement or retirement.
An unacknowledged historical intention outside an explicitly reset account remains
pending byte-for-byte. Its review hold blocks that board version, allowing a new
version's independent win to recover. Same-board, Auth, Legacy and Wallet holds
retain their existing ordering; a grid label can never split monetary commands.

Historical social links resolve their exact revision-0/1 geometry; current
creation requires the active registry version. Stored-link start/finish checks
remain tied to that link's revision, not the latest campaign board. Personal
campaign resets never reset a social attempt. Account export/erasure includes
all reset histories through the existing user-owned authority inventory.

## Explicit player quest reset

An operator may revoke progression on explicitly selected replacement grids.
`quest_run_authority.reset_info` privately archives each original entry and owns
the reset epoch, timestamp and cleared projection. No public reset RPC exists.
`reset_replaced_quests` locks the player snapshot, validates the supplied stable
IDs, preserves started Adventure access and advances the command cursor. It is
idempotent: running the same reset again cannot erase later replays. Purchases,
balances, cumulative XP, daily history and economic reward receipts remain intact.

Only a verified server profile may supersede a lower local quest reset epoch.
Hydration archives the exact local profile, retires obsolete same-owner canonical
intents into verified local/IndexedDB archives, then reloads. The reset cache
installer uses the existing durable recovery snapshot fallback when Web Storage
cannot fit its original copy. It awaits archival and rechecks account, session
and exact current bytes before installation. If the larger updated cache also
hits quota, one bounded archival of eligible older backups may free space;
failed/unverified archives never authorize replacement. Archive, quota or
session failures hold recovery. Active attempts also carry the epoch and archive
obsolete boards before replacement. New operation IDs start with `qr<epoch>.`;
the server rejects earlier identities and facts predating the reset, including
old receipt retries and the badge-only API. Full-profile writers cannot change
the protected projection; positive-acquisition recovery skips reset quests.

The schema migration changes no player data. Generate the explicit reset scope
with `node scripts/quest-reset-scope.mjs`, review it against the replacement
manifest, and invoke the private operator function only for separately authorized
accounts after the compatible client is available. Account IDs and original
player data must never enter public source, issues, PRs or validation logs.
Rollback must retain the epoch/guards; reinstalling an old save would undo the
requested reset. Existing privacy export/erasure includes this already inventoried
user-owned authority table and its private originals.

## Prepared technical retention (#316)

`20261022192259_lumen_technical_retention.sql` adds operator-only bounded
retention of an explicit non-gameplay event allowlist (90 days), feedback closed
for 180 days without a hold, and subscriptions disabled for 90 days. Server
transition timestamps reject backdating; unknown historical transitions start
at migration. New metadata lives on existing rows, is covered by rights export
and erasure, and never enters game snapshots or reward restoration. Preserve
functional historical analytics, accounts, receipts, recovery and unresolved
incidents. No production migration, cron or cleanup is enabled. Procedure and
rollback limits: [runbook](TECHNICAL_RETENTION_RUNBOOK.md).

## Beta reports v2 — #960

`20261122240000_beta_feedback_v2_960.sql` is additive. It only touches `lumen.feedback` (no gameplay table), and v1 (`lumen_send_feedback`, `lumen_admin_feedback`) stays as it was.

- **Kinds:** `feedback_kind_check` keeps every existing kind and adds `question` and `idea`.
- **New columns:**
  - `context jsonb` holds an allowlisted technical context: version, platform, browser family, screen, locale, quest, adventure, surface, error code and a per-tab session id. It never holds tokens, emails, the board or the raw user agent.
  - `client_ref` is the draft reference. It is unique per reporter, so a retry or a concurrent send returns the same receipt.
- **`lumen_send_feedback_v2`** (anon and authenticated) validates the kind (`bug`, `question`, `idea`), the message and the reference. It limits each device or account to 10 reports per hour and returns `{id, status, duplicate}`.
- **Administrators** read reports with `lumen_admin_feedback_v2` and set `new` → `reviewed` → `fixed` → `closed` with `lumen_admin_feedback_set_status`. Both require `analytics_cockpit`.
  - Closing starts the existing 180-day technical retention.
- **Erasure and rights export** cover the new columns, because reports stay owned by `user_id` / `anonymous_id`.
- **Client:** `src/ui/beta-feedback.js`.
  - The draft is kept in `lumenFeedbackDraftV1`, and the per-tab session id in `sessionStorage`.
  - Reporting never touches the board: the modal pauses the attempt like any menu.

## Prepared operator access and portability (#316)

`20261022184145_lumen_account_rights_export.sql` adds only a private SECURITY
INVOKER export, never a public RPC. It reuses the erasure ownership policy and
ambiguity guards, requires a stable read-only owner transaction, caps rows and
source JSON bytes, excludes Auth/other applications and strips push keys.
No writes, restore path, new persistence or gameplay effects. Manual review and
secure delivery are mandatory; see [procedure](ACCOUNT_RIGHTS_RUNBOOK.md).
Production migration remains unauthorized; PR stays draft. Proposed retention
criteria are [separate from implemented behavior](PRIVACY_RETENTION_PROPOSAL.md).
## Paused Série de lumière — #752

Migration `20261116090000_pause_daily_light_streak_752.sql` (idempotent; production application by the owner) adds the private table `lumen_commands.feature_flags` (no player access) with `daily_light_streak=false`, and redefines `lumen_commands.claim_quest_daily` — the single server route used by `lumen_claim_daily`, the wallet command, `commit_quest` and the legacy victory command. While the flag is off it still records the day in `lumen.daily_progress` but never credits `lumen.engagement_state`. Rule details: [PROGRESSION](PROGRESSION.md#série-de-lumière-en-pause-752). The flag table holds no player data and is classified `retain-rule` in `lumen_privacy.policy()` by the fix `20261116195500_feature_flags_privacy_752.sql`; without it, `review_erasure` refused every account erasure. Fixture: `scripts/fixtures/daily-streak-pause.sql`.

## Stripe Checkout, web/PWA, TEST mode — #730

Full runbook and owner steps: [STRIPE_730](STRIPE_730.md).
- **Edge Function `lumen-stripe-checkout`** (player session): `checkout` reserves through `lumen_stripe_checkout_begin` (test capability `stripe_test_checkout`, active product, catalogue price/currency, ownership, sky-after-single rule, one checkout in flight per account, 10 per hour), creates a `mode=payment` Checkout Session with that price (idempotency key = reservation) and returns its URL; `status` and `restore` re-read the player's own sessions from Stripe and record them.
- **Edge Function `lumen-stripe-webhook`** (deployed with `--no-verify-jwt`): verifies `Stripe-Signature` on the raw body (5-minute tolerance), refuses live events, then re-reads the Checkout Session (expanded payment intent and charge, disputes) instead of trusting the event. 5xx on Stripe/database failures so Stripe retries.
- **Migration** `20261117120000_stripe_checkout_test_730.sql`: private `lumen_commands.stripe_checkout_sessions` (`livemode` constrained to false; erased with the account, `delete` by `user_id` in `lumen_privacy.policy()`), `lumen_stripe_*` service-role functions, and `stripe_record_session`, whose monotonic rank (pending < failed/expired < paid < open dispute < closed dispute < refunded) makes duplicates and reordering harmless before calling `record_purchase('stripe', <cs_test_…>, …)` (#728). TEST payments (`cs_test_%`) are never archived as accounting records (#732 trigger) and `lumen_commands.stripe_test_reset(uuid)` removes them.
- **Secrets:** `STRIPE_SECRET_KEY` (`sk_`/`rk_`, test or live: the key decides the mode), `STRIPE_WEBHOOK_SECRET` (destination of the same mode; surrounding spaces ignored).
- **Real-sales switch** (migration `20261117180000_stripe_live_switch_730.sql`): `lumen_commands.feature_flags` `stripe_live`, off by default. Live checkouts are reserved only when it is on; test checkouts stay reserved to `stripe_test_checkout` accounts. `stripe_checkout_sessions.livemode` must match the session id prefix and is part of the identity checked by `stripe_record_session`. `public.lumen_payment_channel()` (authenticated) returns `live`, `test` or `off` for the client. Each checkout creates a Stripe invoice whose footer carries the waiver and the VAT exemption (CGV §6).
- **Client** (`persistence/stripe-checkout.js`): offered only on the web/PWA (never with a resolved Play Billing service, `LUMEN_NATIVE_APP` or an `android-app://` launch; the mere presence of `getDigitalGoodsService` is not a signal, Chrome Android exposes it outside the Play app) and only to accounts holding the test capability. The return URL is consumed once; success is shown only after the server reports `paid` and entitlements are reloaded, followed by the thank-you dialog (`ui/purchase-thanks.js`). The `restore` mode re-reads only unsettled sessions (open, superseded, pending); settled ones follow the webhook.

## Google Play purchases — #729

- **Edge Function `lumen-play-purchase`:**
  - `verify` authenticates the Lumen account and checks `purchases.products.get`. A new real purchase must also match the `PROCESSED` Google order, token, single SKU, exact line total and currency. The owner must match the existing receipt, Google’s obfuscated account identifier (SHA-256 of `lumen-play:` followed by the Auth UUID), or the operator’s privately reconciled legacy order. License-test purchases require a Google account identifier or an existing receipt, and carry no real settlement. Pending purchases record nothing. The server records idempotently using SHA-256 of the token, then acknowledges with Google. Failed acknowledgement remains retryable.
  - `voided` mode (`x-lumen-cron` secret): replays `voidedpurchases` as refunds with the original identity from `lumen_purchase_by_ref`. A restore can also expire a recorded right when Google reports cancellation or a matching order reports a full refund. Started Adventure access and original progress follow the existing rules.
  - `POST /rtdn` verifies the Google OIDC signature and the configured subscription before processing one-time events. It rereads the Developer API and uses the same purchase and refund paths. A new paid token uses the binding that the Auth-scoped `lumen_prepare_play_purchase` registered before checkout. Only the service can resolve an identifier back to an account. Account erasure deletes the binding. A transient failure or a refund arriving before its receipt is deferred for redelivery. Pub/Sub receives 204 once processing is complete or the purchase acknowledgement job is durable. See the [Android setup](../android/PLAY.md#notifications-google-play-rtdn).
  - The settled amount and currency are archived with the receipt. The legacy credit is kept for receipt compatibility. After migration `20261119092419_distinct_adventures_728.sql`, the server counts five distinct confirmed unit purchases, across Stripe and Play, for the main-sky unlock. An active full-sky receipt grants it directly. Refunds recalculate the count without changing progression, mastery or manual entitlements.
  - `readiness` mode (`x-lumen-cron` secret, #833): read-only pre-activation probe. It mints a Google token, calls `purchases.products.get` and `orders.get` with synthetic identifiers (400/404 = reachable, 401/403 = missing permission), lists one voided purchase, reads the ledger RPC and reports whether RTDN is configured. It records, acknowledges and returns no purchase data, token or secret. Licence-test purchases skip `orders.get`, so this probe is the only check of that permission before a real sale.
  - Client gate (#833): the Play checkout opens when `PLAY_CHECKOUT_AVAILABLE` is true, or for an account holding the server capability `play_test_checkout` (`lumen.internal_capabilities`, read through `lumen_get_internal_capabilities`). This lets a licence tester run the end-to-end acceptance while public sales stay closed. It grants nothing; every token follows the same verification. Signed-in Play apps also recheck purchases on return to the foreground (throttled to once a minute), in addition to hydration, `online` and after a purchase.
  - Migration `20261119092413_play_acknowledgement_833.sql` records the verified purchase, purchase entitlement and acknowledgement task atomically. The service-only worker leases due tasks, confirms the state with Google, and retries with a capped delay. The private queue retains its temporary token only until acknowledgement, cancellation, erasure or expiry. See the [operations and test checklist](../android/PLAY.md#récupération-et-déploiement-google-play-823).
  - Whole-sky upgrades (#865): Play SKUs `real_sky_upgrade_1..4` ↔ ledger `real-sky-upgrade-1..4` (`kind='sky_upgrade'`, tier = confirmed unit purchases). `verify` calls the service-only `lumen_sky_upgrade_eligible` before recording a new upgrade token; an outdated tier answers 409 `offer_not_eligible` without recording or acknowledging. Upgrades never feed the historical € credit. The Android wrapper (`PaymentActivity`) accepts the same SKU list. See [SHOP_865](SHOP_865.md).
  - Already-owned items (#864): Google Play owns a non-consumable per **Google account**, not per Lumen account. Before opening the Play sheet, and again after a sheet that failed or was cancelled, the client reads `listPurchases()` for that SKU (`findOwnedPlayPurchase`). A held token is sent to `verify` for the signed-in Lumen account only; no sheet opens. `paid` rereads entitlements; `owned_elsewhere` asks the player to sign in to the original Lumen account; `account_unverified` (purchase without account binding, e.g. before 19/11/2026 10:41 UTC) points to support; `not_paid` explains a cancellation. A token already **refunded** in the ledger answers `not_paid` for every account, even when another account held it (#878), never `owned_elsewhere`. A manual restore that finds several such purchases shows one sentence per state, naming the items, with the open offer's adventure first (`playOwnershipSummary`, #878). Nothing is ever transferred between Lumen accounts.
- **Secrets** (Edge Function secrets only): `LUMEN_PLAY_SERVICE_ACCOUNT`, `LUMEN_PLAY_PACKAGE`, `LUMEN_PLAY_CRON_SECRET`, optional `LUMEN_PLAY_RECOVERY_ORDERS`. The recovery map contains independently verified order-to-Auth-UUID associations. It cannot grant an entitlement without the server verifying the Google purchase. See [Android release and recovery](../android/PLAY.md#récupération-et-déploiement-google-play-823).
- **Migration** `20261115220000_play_purchase_gateway_729.sql`: `public.lumen_store_price`, `lumen_record_purchase` and `lumen_purchase_by_ref`, executable by `service_role` only. Migration `20261118212000_play_regional_receipts_729.sql` adds the Play-only gateway and nullable settled amount and currency on the private ledger and accounting archive. Apply the migration before deploying the Edge Function. Old rows keep their original values.
- Notices (#863/#885): Digital Goods inventory alone cannot establish a purchase for the signed-in Lumen account. Automatic checks display a game notice only when verification confirms payment for that account and the entitlement read-back cannot verify access. Empty inventory, stale or revoked items, unbound or foreign purchases, pending provider replies and temporary failures stay quiet in the background. Distinct failure states are recorded locally as `play_restore_check` when the result changes, without account IDs, SKUs or tokens. A temporary verifier failure does not clear an existing notice for a confirmed payment. Automatic Play notices can neither replace nor clear a separate checkout notice. The explicit shop restore reports empty inventory, confirmed access, or the relevant actionable result in FR/EN. A clean success clears itself after about 3 s.
- **Client** (`persistence/play-billing.js`): after verified hydration, on reconnect or via the secondary « Restaurer mes achats » action in the Play offer footer (#863), Digital Goods lists existing purchases without opening payment. Unresolved payments or entitlement reads retry with bounded delays scoped to that account and client. Paid or revoked receipts trigger a read of server entitlements and a refresh of Mon ciel. Digital Goods enumerates Play purchases independently of the signed-in Lumen account. The server verifies ownership against the Auth UUID. An unverified or foreign receipt alone produces no automatic notice, and a manual check explains that no purchase could be associated with the current account. Stripe retains its automatic web restore.
- **Play checkout release switch (#833):** checkout requires the release switch, the exact capability response from the installed Android wrapper, a validated price for the product, positive Payment Request readiness and a current account binding registered before opening the sheet. Price, binding probe and Payment Request diagnostics run during the pause, independently of purchase restoration. The vendored Billing adapter forwards the binding for supported single purchases. Follow the [server and installed-wrapper acceptance checklist](../android/PLAY.md#recette-du-wrapper-101-2-et-réactivation-833-pr-837) for rollout and functional acceptance.

## Purchases, store seed and mastery unlocks — #728

For #819, apply `20261119093249_main_sky_purchase_progress_819.sql` after
`20261119092419_distinct_adventures_728.sql`. The signed-in RPC checks the
expected owner against Auth and returns only the verified purchase count,
the remaining count and the full-sky status. The client uses it for display
and keeps entitlement checks authoritative for access. Deploy the CGV and
store copy after the new ledger rule is active and the terms are reviewed.

Adventure entry (#783) separates server ownership from within-Adventure quest
progression (see [PROGRESSION](PROGRESSION.md#purchases-and-mastery-unlocks-728)).
`cloud.js::loadEntitlements` keeps a transient `idle/loading/ready/error` state,
isolates responses by account, client and request generation, and retains only
same-account rights already confirmed in this client when a refresh fails. An
initial cache or another account cannot grant rights; a successful empty response
can revoke them. This state is never serialized to Supabase or IndexedDB. The
runtime index bound includes later owned Adventures; each quest still checks the
shared access policy. No migration, entitlement writer or reward command changes.

Migration `20261115200000_purchases_mastery_store_728.sql` (idempotent; production application requires explicit owner authorization) adds:
- **Store seed** (`adventure_packs`, `quest_packs`, `store_products`, `store_settings`): a server copy of the catalogue, generated by `scripts/adventure-store-seed.mjs`. `--check` (CI and `mastery-unlock-tests.mjs`) fails when the latest seed drifts from `CONTENT_PACKS`, `canonicalQuestList` or `PERFORMANCE_BADGES`; a catalogue change needs a new migration re-running `--write-seed`.
- **Purchase ledger** (`purchases` unique by provider and provider reference; `purchase_events` for status history). It is written only by `lumen_commands.record_purchase`, executable by `service_role` alone: the future Play/Stripe verifiers (#729/#730). It is idempotent, rejects identity changes, and allows paid ↔ refunded/disputed transitions. Players cannot read or write it.
- **Entitlement convergence:** `purchase` rows follow the ledger. `admin` and `mastery` rows are never expired by it. Advisory locks: 728 per player, 724 per player and Adventure, shared with #724.
- **Privacy:** `purchases` and `purchase_events` are `delete` by `user_id` in `lumen_privacy.policy()`; the seed tables are `retain-rule`. On erasure, a `BEFORE DELETE` trigger on `purchases` keeps a minimal accounting record in `lumen_commands.purchase_accounting_records` (#732, migration `20261116200000_purchase_accounting_records_732.sql`): provider, provider reference, product, amount, currency, final status and dates, **no account identity**, retained until 1 January of the 11th year after the purchase (Paris calendar), classified `retain-rule`. `purge_expired_purchase_accounting()` removes expired records; its daily schedule is an owner step.
- **Mastery completion fix** (`20261115210000_mastery_completion_fix_728.sql`): `adventure_mastery` counts a canonical quest as completed when its `quest_run_authority` projection is `solved` or records a won run (`runPerformance`). 49 production projections have no `solved` key. The function remains read-only; the badge requirement is unchanged.

## Admin Adventure grants — #724

`lumen.entitlements` now has one reviewed writer besides manual operator SQL: `lumen_commands.admin_adventure_access` (security definer, `public.lumen_admin_adventure_access` wrapper, `analytics_cockpit` capability, advisory lock per player and Adventure). Grant upserts an active row (`source='admin'`); revoke sets `expires_at`; neither touches profiles, receipts or wallets, and the client never writes entitlements. `lumen_commands.adventure_access_audit` (player, administrator, Adventure, action, reason, time) is private (RLS, no client grants), is registered in `lumen_privacy.policy()` as `delete` by `user_id` so Lumen erasure removes it, and appears in rights exports, which already require third-party review (the administrator id). Migration: `supabase/migrations/20261115180000_admin_adventure_access_724.sql`, idempotent; production application requires explicit owner authorization.

## Temporary private assistance — #574

[Audit, data contract, budgets and rollout](SUPPORT_574.md). A separate explicit
24-hour consent permits filtered owned profile/checkpoint copies through
`lumen_support`. Private support metadata/content tables stay separate from
ordinary telemetry. Existing capability/cron are reused; all operations check
Auth/ownership, admin reads are audited, revocation deletes content atomically.

Manual support sending (#776) adds an in-memory filtered preview and an explicit
confirmation before the existing capture RPC. A reconnect or incident cannot
approve that preview. Analytics reuses the same private dossier/hash reader to
look up an exact retained reference after the live capability check, including
an older dossier rather than the latest one for its owner. The prepared
`20261117051322_support_reference_lookup_776.sql` migration changes resolution
only, preserving ownership, locks, audit, revocation and retention; it requires
separate production authorization. No game writer, save format or ChatGPT
retrieval channel is added. See SUPPORT_574 for the transport and acceptance limits.
No game writer, save mutation or reconciliation change; originals remain local.
The migration/control are prepared and disabled pending explicit production
authorization. A volatile one-hour queue deliberately does not survive page
closure. Do not upload the raw multicomponent manual recovery export.

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

**Silent launch maintenance (#723).** Fifteen seconds after launch (outside QA,
once the session has settled), the game runs the same archival for the
`AccountSwitch` and `AccountSwitchAttempt` families only, without any player
action or message. A changed session interrupts it; it retries at most twice.
In every family, retention now keeps the two most recent **distinct** copies:
an identical copy (same content, another timestamp) is archived once under the
`localStorage:<key>` of its most recent twin, with the same read-back rule, so
every removed copy remains readable in IndexedDB exactly as it was.

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

Profile loading and account switch on one device (#711, #789): `updateAccountSwitchHold` covers the game with « Chargement de ton ciel… » until the current account’s profile is installed. This covers both a different local owner and a missing cache on a fresh device. Once Auth resolves to the stored owner, a valid cache can remain visible while normal synchronization continues. Offline, continuation additionally requires the existing verified offline owner record. Without that cache, the hold displays the offline state. After a failure or a 15-second wait, the hold offers « Réessayer » through the existing retry path and « Diagnostic ». The timeout changes the display while the current hydration may still finish. After an explicit sign-out (`signOutExplicitly`, flag `lumenSignedOutNeutralV1`, cleared at the next sign-in), a neutral « Tu es déconnecté » screen replaces the last account's cache view, which stays stored and is never erased. Expired sessions, offline play and first-time guests are not flagged. A failed hydration now reports to `lumen_record_sync_health` its fine reason (fixed vocabulary, e.g. `storage_quota`, `backup_unverified`) and its stage in `outcome` (fixed stage list, migration `20261115160000_sync_health_stage_outcome.sql`); anything else is stored as `unknown`, never free text. The account switch hold offers « Diagnostic » after a failure, opening the existing local diagnostic above it. While a switch is pending, `lumenAccountSwitchHoldV1` (sessionStorage) keeps the hold up across a reload (« Réessayer »): the external `account-switch-boot.js` at the top of `<body>` shows it from the first paint for a pending switch, stored session or recognized auth return, so the previous account's grid never flashes. The mark is cleared when the account is installed or on explicit sign-out. A guest becoming an account (no previous owner) keeps its existing claim and backup flow behind the loading screen. An outbox inspection interrupted by the session change (`SESSION_CHANGED`) is transient and no longer reported as a local storage failure. Reproduction (synthetic multi-account server, 800 ms per RPC): before the fix, B saw A's progress for about 5 s, and indefinitely if B's load failed; data never crossed accounts and A's pending victory stayed durable and was credited to A only. Before installing the new owner, the previous local profile (`lumenBeforeAccountSwitch_<time>`) and board (`lumenBeforeAccountSwitchAttempt_<time>`) are preserved through `preserveRecoverySnapshot`: an identical verified copy is reused, and when the localStorage quota is full the copy is written and read back in the IndexedDB store `lumenCloudRecoveryV1` instead; if neither can be verified the switch stays held. Older copies are never deleted automatically (player-controlled archiving only). The hold's « Diagnostic » shows the copyable report inside the hold card.

### Signup confirmation and the mail service (#814)

Email/password signup uses the Lumen-only `lumen-auth-mail` function. The
client shows the confirmation panel after HTTP success with an explicit
acceptance response. HTTP 429 keeps the form available with rate-limit
feedback. Network and provider failures use generic copy without the address
or the provider response. The pending submission stays single-flight through
view changes. Acceptance creates no client session and does not authorize
progression writes. The existing server limiter governs mail requests.


## Cloud persistence contract

The [critical-alert contract](OBSERVABILITY_946.md#alertes-critiques-947) reads existing sync observations and the payment access projection, and records only operational incident summaries.

The [health cockpit and digest contract](OBSERVABILITY_946.md#cockpit-de-santé-et-bilan-quotidien-949) defines a capability-gated read projection and a daily entry in the existing delivery queue. The reporting reads authoritative account and payment data without mutating profiles, purchases or entitlements.

The [performance monitoring contract](OBSERVABILITY_946.md#détection-des-régressions-948) documents a separate opt-in measurement store, retention, and aggregated administration. It uses no save or purchase write paths.

The [admin activity mail contract](OBSERVABILITY_946.md#notifications-dactivité-950) describes the read-only projection of Auth and commerce events and its separate delivery queue.

### Google Play review navigation (#796)

`lumen_commands.play_review_access_events` is private. A database operator
appends a grant with an expiry or a revocation for an Auth user. The latest
event is authoritative. Each event records the database role and time.
Lumen account erasure removes the event history for that user and prevents a
later grant from resurrecting it. See [Play operations](../android/PLAY.md#accès-à-la-revue-google-play-796).

`lumen_can_use_play_review` compares the expected account with `auth.uid()`
and returns one boolean. The map reads it online, after profile and entitlement
verification, and again on selection. It discards responses from an earlier
account, client or hydration generation. The grant stays in memory and affects
only quest prerequisites in the map. It never participates in a profile
snapshot, entitlement, command receipt or merge.

Locally suspended review attempts retain the existing attempt envelope in
account- and quest-scoped storage. They carry game state only and use the
normal grid and reset-revision checks on resume. Local Lumen erasure removes
those attempts. Navigation-only boards stay in memory until a real attempt
starts. Victory and ranking use the existing paths.

### Historical guest hydration and Wallet authority (#801)

After Wallet activation, the profile CAS retains the verified cloud projection
of `shards`, `walletRevision` and `daily` exactly. The SQL snapshot trigger
checks all three fields, including when the request uses the digest CAS. The
guest merge may still recover compatible achievements with verified read-back.
Missing empty `daily.dates` and `daily.rewards` containers carry no history.
A local date or reward that the cloud cannot cover keeps the original
snapshots pending. Hydration reads daily history without projecting it through
CAS for an active Wallet. The legacy daily write remains available before
activation.

An unresolved Wallet hold leaves the guest snapshot and account-scoped outboxes
intact and shows « Historique à vérifier » in the account loading screen.
The exact Wallet command refusal (SQLSTATE `22023`) has a fixed diagnostic
distinct from stale CAS. Recovery of an owned cache still uses the existing
operation ID, exact receipt and current-profile read-back rules. Account
ownership and readiness require the existing verified installation.

Guest acquisition recovery (#801, diagnostic +665). When the conservative
guest merge is held (`mutable_balance`, `wallet_daily_divergence`,
`wallet_command_required`, CAS conflict, reward conflict), hydration hands the
unchanged guest bytes to the existing `lumen_reconcile_acquisitions` RPC
(`positive-acquisitions-v1`). The server unions badges, stars, completed quests
and records, keeps the XP maximum, and leaves `shards`, `walletRevision`,
`daily`, receipts and command cursors exactly as stored. It archives both
sources by digest. The client sends no balance and no CAS on this path. It
installs only the re-read server profile, then takes ownership. Local balances
and daily dates the server does not adopt stay in `lumenGuestBeforeAccount_*`,
`lumenBeforeCloudReconcileLocal_*` and the server source archive. An ownerless
cache that carries `walletRevision` or `legacyVictoryRevision` belonged to an
account and is never merged into another one; it stays held. A refused or
unavailable recovery keeps every copy, records `acquisition_recovery_pending`
and keeps « Historique à vérifier ». No migration is involved.

### E-mail links and password recovery (#820)

A native Supabase redirect (`#access_token…&type=…` or `#error…`) is read
before the Auth SDK starts; its error parameters are removed from the address.
A branded `lumen_confirm` link is removed before `verifyOtp`. One verdict is
emitted after the session restore: success only after verification, and the
action follows the real session. A verified recovery link marks the recovery
pending, which keeps hydration paused until the new password is saved. The
recovery request counts as sent only on the endpoint's `{ok:true}` contract;
429, 5xx, invalid JSON and network failures have their own copy, identical for
known and unknown addresses. Password update errors map to bounded reasons and
never show the provider message. Tokens and addresses never enter diagnostics.

A recovery link opens a dedicated screen (`ui/password-recovery.js`, dialog
`#passwordRecovery`), never the sign-in form or the account menu. While the
link is checked it shows a neutral « Vérification de ton lien… » state (20 s
watchdog, then « Vérification impossible »). The form is bound to the account
whose recovery session opened it: no session, an account change or an expired
session (`session_expired`, 401/403) ends on « Ce lien n’est plus actif » with a
new-link action, and `updateUser` is not called for another account. Mismatched
entries and provider rules (weak/same password, network) keep the form.
Submission is single-flight. « Mot de passe modifié ! » appears only after
`updateUser` succeeded; the page does not reload until the player chooses
« Continuer mon aventure » (reload resumes the hydration held by recovery) or
« Se connecter » when no session remains. The 20/11/2026 field test (three
recovery sessions in three minutes, then a password sign-in) matched the former
immediate `location.reload()` that hid the success.

A native link captured by an already open Lumen window (installed app, PWA link
capturing) changes only the fragment: no navigation happens, so neither the boot
reader nor the SDK sees `#access_token`. A `hashchange` carrying an auth result
reloads the page once, which then follows the normal native-link path.

### Installed app first opening (#832)

iOS can give the home-screen app storage separate from Safari. When an installed
app opens on storage with no progress, owner, session or recovery copy (the
first-visit claim), it first offers « J’ai déjà joué — Retrouver ma progression »
(sign-in) and « Commencer une nouvelle aventure » (confirmed, then the usual
welcome). No anonymous Safari data is imported or promised. An iOS guest sees a
non-blocking warning before installing. Progress ownership and hydration rules
are unchanged.

### Retirement of player currency (#803, #806)

New hint and verification actions record assistance on the existing attempt
and use its official-time score. They create no Wallet reservation, receipt
or RPC. Historical pending requests still replay under their original owner,
operation ID and receipt rules. Stored `shards`, `walletRevision` and `daily`
remain intact, including for guest migration, wallet activation on old saves,
snapshot comparison and command recovery. The #801 guard still compares the
verified projection in full.

Older clients and existing SQL victory writers still update the hidden
compatibility ledger. The current client exposes no balance or currency reward,
and its local victory projection keeps the historical balance. Removing those
server writers or dropping their schema would require a separately validated
cutover preserving old receipts and in-flight clients. This release has no
Supabase migration or activation step.

### Competition (#638/#647)

The follow-up `20261111060216_highscore_victory.sql` returns Top 3, personal position
and the real participant total over the complete deterministic ranking. Canonical
profile names are unique after trim/case folding (3–20 characters); legacy
collisions retain their names until progressive resolution. No UUID is public.
Historical import is dry-run by default, zero penalty and minimum-only for certain
grid identities. Private per-batch backups use the erasure inventory and conditional
rollback. It never writes badges, progression or Wallet state. Automatic publishing
and historical import have separate closed activation gates. See the
[activation and restoration runbook](HIGHSCORE_ROLLOUT.md).
The old API deleted opposition even without a run. Existing Lumen accounts
without active membership are conservatively protected in a one-time frozen
cohort; only an explicit account action can rejoin them. Newly created accounts
remain eligible for automatic participation, including after migration replay.

`persistence/ranking.js` durably stages new version-1 captures separately from
progression, keyed by authenticated owner + exact victory operation ID. The
attempt restores hint/verify/guided counts; old attempts never acquire ranking
eligibility by inference. Capture precedes the victory write. Reconnect resends
the original start/counts, guards owner/client changes and retains unconfirmed
entries. Missing competition APIs never block a victory.

Private `ranking_control` records activation; `ranking_runs` reserves one
eligible start per owner/grid/revision per fifteen minutes under a transaction
advisory lock. Delayed submissions retain their original immutable start.
`ranking_finish` requires the exact canonical/historical victory receipt and
matching quest/start/hint facts. It computes penalties and retains the lower
admitted score. Nonqualifying badge runs cannot enter competition. Historical
minima follow the separately gated, revision-safe import above. Elapsed time and aid counts remain client assertions,
checked for bounds, consistency and wall time; this is not tamper-proof timing.

Ranking queue isolation (#775): a failed capture remains byte-for-byte pending,
but does not prevent independent later captures from reaching their own server
receipts. A partially failed flush still reports failure and includes successful
operation results for the current victory view. Reconnect/timer refreshes never
show an old board while that view's capture remains pending. Version-1 attempts
derive `hintUsed` from their own persisted hint counter, never a previous grid's
UI flag; old unversioned attempts retain their historical fallback. Existing
inconsistent receipts are preserved, not repaired or requalified by the client.

`lumen.profiles` owns the canonical unique nickname and durable ranking opposition;
`ranking_members` owns public participation. Automatic participation is server-gated
by the published information boundary, never inferred from reconnect.
Only nickname/place/time/penalty/own-row/virtual flags leave the board RPC; no
account ID/email. Opt-out deletes public scores and membership while retaining profile opposition; minimal private
runs retain cooldown/idempotence until Lumen erasure. The privacy inventory,
rights export and anti-resurrection guards cover all four new tables. No
progression/reward/Wallet writer is added.

`20261110190629_grid_ranking.sql` is prepared, transactional and requires separate
production authorization after the existing privacy engine. Rollback withdraws
ranking API grants and the client; retain records/guards rather than deleting
archives or restoring erased data. A new registered quest works automatically;
virtual targets can be calibrated using `ranking-reference-fixtures.mjs` during
catalogue publication. Existing clients/saves retain their contracts.

Grid revision #640 deliberately preserves earned completion, badges, records,
currency, stars and entitlements under their existing stable quest IDs. It does
not delete local facts and then allow cloud copies to resurrect them. Records
remain historical all-time quest records across this revision, not measured
completion times for the harder grid; they must not calibrate its difficulty.
Replays retain the existing exactly-once reward policy. No profile schema,
access-origin cohort or reward allowlist changes; no production SQL runs.

Only the device-local active attempt gains `gridRevision` (missing means 0).
The runtime quest's explicit replacement revision is 1; other quests remain 0.
Attempt restore requires an exact revision match as well as quest/mode, including
same-size replacements and downgrades. Before replacing a stale local board,
the engine preserves and reads back its original bytes under
`lumenActiveAttemptV1:grid-archive:<attemptId>:<revision>`. An archive collision
or write/quota failure blocks replacement. Canonical account restoration rejects
the obsolete attempt; existing account-switch preservation remains in force.
Fresh device restores cloud achievements normally and starts an empty current
grid. An old offline client's eventual earned facts follow existing cloud merge
rules and cannot inject its active board into a new grid. Pending commands and
their frozen facts/receipts are not rewritten. Rollback restores original grid
sources and rejects a revision-1 active board instead of reinterpreting it.
Worker cache v16 precaches the complete module/JSON graph before activation,
including the replacement manifest; old complete shells remain available until
the new shell is complete. See [grid revision audit](GRID_CATALOG.md#logical-difficulty-and-explicit-grid-revisions-640).

Social challenge rows separately gain server-owned `grid_revision`, default 0
for historical rows/old clients. The additive prepared migration
`20261108061843_logical_grid_challenge_revision.sql` adds a v2 creation RPC that
atomically validates the explicit Adventure 5–8 revision-1 scope and delegates
identity/name/first-play/allowlisting to the existing RPC. Versioned get/list
wrappers expose the revision in addition to already privacy-filtered fields;
old canonical get/list endpoints show revision 0 only. Versioned start/finish
require the exact stored revision before delegating to the established private
one-shot implementations, whose direct API grants are revoked. Old writers
reject revision-1 challenges without consuming an attempt or comparing a result.
Unversioned challenges resolve to original grids; revision-1 challenges
resolve to the replacement. Unknown revisions fail closed. New clients never
fallback to revision-0 creation after an unavailable/ambiguous v2 call. No reward
or campaign write is introduced. Activation order for a later authorized release:
apply and verify this additive migration first, then the complete frontend;
keep both grid revisions for old/offline links and clients. Until separately
authorized, the migration is only exercised against disposable test databases.
The existing preparation-only erasure migration also reviews `grid_revision`
as non-identifying, non-null integer metadata. Unknown social fields and altered
revision types still block erasure. Its current-schema fixture verifies that
anonymization removes the sender but retains the exact puzzle revision. This
compatibility edit does not authorize installing or activating account erasure.
If that private erasure review is already installed, the grid migration invokes
its read-only schema review and fails atomically on incompatibility; it never
silently replaces an independently activated privacy contract.

Support capture budgeting preserves the complete current typed projection and
only adds optional owner-bound checkpoints within the existing server size limit.
The budget uses `jsonb::text` bytes, reserving existing incident/counter metadata;
an oversized current projection fails explicitly. This never deletes originals,
changes a gameplay writer, retires a pending command or relaxes server validation.
See [temporary assistance](SUPPORT_574.md#capture-size-follow-up-6-november-2026).

Pending result recovery: the bounded command scheduler also retries the exact
durable victory displayed on the current result sheet, including canonical
quests whose active board intentionally blocks background outbox replay.
Automatic foreground retry requires the same owner/client/attempt/reset, a
verified clean profile, no active writer, visible online state and no Auth or
password-recovery hold. It inspects the owning outbox and retries only the exact
retryable operation; Auth/review holds are never cleared automatically. The
result stays visible and frozen facts remain the command source. Canonical
foreground refusals retain the same retry policy metadata as historical ones.
Victory failures map to existing optional diagnostic codes/stages/kinds;
no raw provider error, operation ID or profile enters that stream. No SQL,
reward, currency, receipt, entitlement or guest-save schema changes.

### Requested account erasure (prepared, not deployed)

P0 consolidation: the private policy now recognizes current optional diagnostics,
command metadata and support tables. `scope_predicate` owns indirect attribution;
`install_guards` registers the reviewed tables only. Support audit's private
`privacy_owner_id` is derived from server cases, retained through case expiry,
excluded from rights export and deleted by erasure/seven-day audit retention.
Unattributable old audit references fail closed pending review. No gameplay
profile, reward, wallet or reconciliation rule changes. See
[the comparative audit](PRIVACY_P0_CONSOLIDATION.md).

`20261022160212_lumen_account_erasure.sql` is the operator-verified exception
to durable Lumen restoration: requested erasure removes that player's Lumen
data, receipts and recovery copies atomically, preserving shared Auth and other
applications. Private scope review rejects ambiguous actors/schema changes.
Social challenges lose sender identity while other participants survive.
Private pseudonymous fingerprints and INSERT/UPDATE guards prevent old clients
and JWTs from recreating erased data; READ COMMITTED is required. No browser
request automatically executes erasure or clears local stores. Other players'
restoration, rewards and pending intentions keep their existing contracts.
See `ACCOUNT_DELETION_RUNBOOK.md` for access, locking, reenrollment, proposed
barrier retention and provider/backups limits. Separate production authorization
and verified SQL CI are required before applying this migration.
Celestial UX (#575/#519) is a read-only projection. `ui/celestial-progress.js`
captures scope completion and eligible badge counts before a victory, compares
them only after the existing confirmed outcome, and never writes a profile.
`celestial-effects.js` seeds bounded decorative SVG dust by stable identity;
`celestial-celebration.js` reuses the result sheet. Completion events and mastery
pulses exist only in memory, scoped to the current owner and catalogue membership.
No new cloud/local field, RPC, receipt, ledger, entitlement or migration is added.
Hydration/read-back alone never invokes this presentation event producer.
Reused durable intents and already-committed receipts explicitly suppress
milestone/mastery events. A scope crossing requires exactly one missing quest
before the live win; unrelated remote batches cannot manufacture a finale.

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

Profile compare-and-swap by digest (#697 follow-up, migration
`20261115140000_profile_digest_cas.sql`): with the account guard, the client sends
the SHA-256 of PostgreSQL's jsonb text for its expected profile
(`src/persistence/jsonb-digest.js`) instead of the whole profile, halving the
upload. `lumen_cas_profile_digest` locks the row, compares digests and only then
runs the unchanged `lumen_cas_profile` (same validation, triggers and guards). An
equal digest implies byte-identical jsonb text, which is stricter than the jsonb
equality of the full CAS. Any mismatch (real conflict or serialization difference),
missing endpoint or unexpected answer writes nothing and falls back to the full CAS,
so the outcome is always the full comparison's. A matched digest that the guarded
CAS refuses is a conflict, never a second write.

Cloud profile limits use 1048576 UTF-8 bytes (1 MiB since 15 November 2026,
migration `20261115120000_profile_size_limit_1mib.sql`; previously 524288) with
JSONB structural-space and scientific-number expansion reserve, rather than
JavaScript character count. The client (`MAX_PROFILE_BYTES`) and every
profile-writing server function share this ceiling; validation fails before a
new RPC. Measured then: the largest real profile was 322 KB at 584/880 quests,
about 485 KB projected at 880 before replays, resets and future packs. Support
captures (`validate_support`, `SUPPORT_MAX_BYTES`) keep their separate 512 KiB cap.

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
Since #697, the independent post-command verification uses one read-only round
trip, `lumen_get_quest_command_verified` (migration
`20261115090000_quest_command_verified_read_697.sql`). It is a separate request
after the command, never the command's own response. It returns the exact
receipt and, only if that receipt exists, the current verified profile, under
the same account guard. All receipt, projection and official-time checks are
unchanged. Only an explicitly missing endpoint (PGRST202/404) selects the two
separate reads; a malformed shape is an integrity failure. V1 and V2 receipts
share `lumen_commands.canonical_receipts`, so a definitive V2 "no receipt"
answer skips the redundant V1 lookup. A fresh canonical victory therefore costs
three sequential round trips instead of five: lookup, command, verification.

A recreated V2 capture may be retired only after archiving its exact bytes and
original receipt, with matching operation/account/quest, unchanged immutable
facts and no improved elapsed time or uncovered badge. Readiness or a solved
flag cannot serve as this proof. Numeric cold resume restores both quest and
campaign/replay mode before the attempt engine's strict identity comparison;
a READY board does not establish preserved campaign access.

The historical outbox uses the same archival recovery for a covered capture of
an already committed operation. It independently reads the original receipt
and current profile, requires the same account, operation, quest, start timestamp,
day and all assistance/qualification flags, a non-improved elapsed time, and
covered attempts/badges. Only a `22023` review pause permits this read-only
inspection; other holds remain. The capture may predate the receipt when its
elapsed time is equal or worse and all other facts are identical. Local capture
chronology is not proof of better performance and must not hold an already
confirmed better result indefinitely. Both timestamps must still be valid.
Exact original bytes and receipt are verified in a private exportable archive
before retiring that pending copy. No command is resent, receipt changed or
reward granted. Archive or session failure retains the pending operation.

Migration `20261023181900_quest_social_identity.sql` adds stable quest identity
to challenges and privacy-filtered create/get/list RPCs. Numeric URLs and
existing participation/terminal protocols retain their identity. No challenge
operation writes campaign progress, daily credit, unlocks or wallet rewards.
Migration `20261023181918_quest_analytics_identity.sql` adds capability-checked,
read-only ordinal metrics/timeline; it does not rewrite events or players.

Migration `20261025191634_cockpit_furthest_quest.sql` (prepared, not applied)
changes only the directory's compatible `current_players` projection to the
highest observed current catalogue ordinal over lifetime quest lifecycle events.
Last qualifying activity still bounds the player set; earlier replays cannot
lower its displayed point. Capability, stable identity and traffic guards,
friction windows and chronological timelines remain intact. This read model
does not repair or mutate profiles, events, rewards, balances or entitlements.
See PRODUCT_ANALYTICS for the distinction between observed reach and completion.

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
back (an identical existing copy is reused; with a full localStorage quota the
verified copy goes to IndexedDB `lumenCloudRecoveryV1`, #711). A collision or
failed verification blocks replacement. These local recovery
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

Play price loading (#729/#731): `createPlayPriceLoader` in `persistence/play-billing.js`
owns ephemeral provider availability, validated labels and safe diagnostic reasons.
`game-screen.js::renderAdventureOffer` refreshes the currently mounted offer after
loading/retry; these labels never persist, write purchases or grant entitlements.
The Play context requires provider prices even when its service fails, and stays
excluded from Stripe during retries. Existing server verification and hydration
remain authoritative. See [Play diagnostic and owner checklist](../android/PLAY.md).
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
The current topology is described [at the start of this document](#current-architecture).
The extraction records below describe the October 2026 baseline, not current
worker/cache policy, SDK distribution or test totals.

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

Historical extraction record — October 2026; current rules belong to GAMEPLAY.

`src/game/engine.js` exposes `createGameEngine(getBoard, getAutoCrossEnabled)`. It reads the current `{n,puz,state}` through the injected accessor and never accesses the DOM. Its API contains enumeration (`solutions`), automatic exclusions, stored-solution verification, Guardian conflict/validity checks, guided action checks and the existing proof engine. Algorithms, traversal order, reasons and hint text are retained. `solutions(board)` accepts an explicit board for the guided hypothetical placement, avoiding any mutation of application state during that calculation.

Victory validation is now called by the renderer through `validateGuardians`; rendering and celebrations remain in the application. The catalogue audit and offline generator import the same engine used in the browser instead of copying its source from HTML. `scripts/engine-equivalence.mjs` compares complete proof objects and guided/error/enumeration outputs against main commit `dcd9f3c872e623541be698edc212b64589d3b164`, across every catalogue grid and automatic-marking modes. An optional first argument supplies that baseline HTML without invoking Git.

## Stage #23: campaign

Historical extraction record — October 2026; current catalogue/progression contracts take precedence.

`src/campaign/catalogue.js` owns `CAT` and `LEVELS`; `data.js` owns quest metadata, fixed schedule, constellation shapes/counts and existing badge display definitions. `progression.js` exports pure campaign calculations and `createCampaign(getProgress, saveProgress, getAttempt)` for calculations that use the current canonical progress/attempt. It retains the existing performance recording and badge rules verbatim in behavior; #30/#31 remain out of scope. UI navigation, quest loading and celebration orchestration belong to the UI controller.

`scripts/campaign-tests.mjs` preserves original catalogue and historical data/reward comparisons against the starting main commit, and protects the first 100 schedule assignments against the immutable pre-wave-2 commit. Current boundaries, constellation rewards and registry coverage derive from content data. It checks four historical progress fixtures, capped-save recovery and hypothetical future extensions. Both the strict audit and generator import catalogue/campaign modules directly; the generator's optional write targets `src/campaign/catalogue.js` instead of HTML.

## Stage #24: persistence

Historical extraction record — October 2026; current persistence follows the cloud contract above.

`src/persistence/local.js` exposes `createLocalPersistence(storage,getProgress)` for existing load/save behavior. `cloud.js` exposes `createCloudPersistence(model,hooks,environment)` for profile, entitlements, auth initialization, progress and daily synchronization. `config.js` contains the same public client URL/key. No backend schema, RPC, auth provider, SDK version or storage format changed.

The model adapter has explicit getters/setters for the existing auth/progress/quest fields, so async operations observe the same live values as before. Hooks retain UI refresh and existing campaign calculations. DOM-dependent profile/auth presentation remains in the cloud module through its injected environment; it is a documented coupling, not an additional source of truth.

`scripts/persistence-tests.mjs` compares outputs, serialized progress, RPC payloads and callback effects against starting main using four local fixtures and five simulated cloud scenarios. It includes denied storage, malformed data, guest mode, empty/existing/sparse cloud progress, reconnect/sign-out and reported network errors. Real guest reload is exercised in Chrome. Live OAuth login and live authenticated cloud writes are not claimed or performed by these tests.

## Stage #25: UI and input

Historical extraction record — October 2026; subsequent UI modules and behavior have evolved.

`src/main.js` starts `startGameScreen()` from `src/ui/game-screen.js`. This controller owns the one live board/attempt state, composes the game/campaign/persistence APIs, binds events and orchestrates rendering/navigation/celebrations. `tutorial.js` owns the existing general-help walkthrough; `sound.js` owns audio and its preference; `styles.css` is the existing CSS moved without rule changes. HTML is now markup plus stylesheet/CDN/module entry points.

The scripted coach, assistance restrictions and all timings remain unchanged. The pointermove callback has a name (`moveDragCross`) so source/performance tests can inspect the actual handler after it leaves HTML. Actual Chrome touch tests also observe board child mutations and reject a full board rebuild during drag. The 66 browser regression cases are retained; only their two HTML-source lookups were updated to inspect the real module handler.

`scripts/ui-equivalence.mjs` compares rendered board DOM, geometry, cell colors/borders and control text/visibility/enabled states with starting main. It covers empty/marked boards for quests 1, 3, 12 and 48 on 390x844, 360x640 and 1440x900 viewports (12 scenarios, both mobile and desktop). To reproduce, serve the starting main HTML temporarily as `.refactor-baseline.html` next to the current page in the isolated browser test setup, then remove that temporary file. Reports are under `docs/validation/refactor-ui-equivalence.json`. Analytics and the suite were subsequently extracted in #26.

## Stage #26: analytics, tests and final boundaries

Historical extraction record — October 2026; use the current gate for suite inventory.

`src/analytics/events.js` exposes `createAnalytics(getClient,environment)`: anonymous/session identity, existing event RPC payloads and referral sanitization. The UI calls it at the original startup/event locations, preserving event order. The client accessor reads the current Supabase client after async initialization. `scripts/analytics-tests.mjs` compares identity storage, event names/payloads, sanitized referrals and failed-network warnings against starting main in eight scenarios, without live writes.

`src/testing/hint-tests.js` owns all 66 original cases; `diagnostics.js` owns browser test orchestration and snapshots. Both receive explicit live state/API adapters from the controller. `window.runHintTests` and `window.lumenDiagnostics` remain the supported browser entry points. No test was removed. The development Chrome runners share `scripts/cdp-client.mjs`. `scripts/module-structure-tests.mjs` checks import targets/cycles, shell boundaries, original CSS and preservation of every case label.

The obsolete inline feedback handler/global bridge was removed after verifying the button already has its original listener. HTML retains the full markup because its IDs, accessibility attributes and DOM ordering are consumed by the unchanged UI. No substantial business logic remains in HTML. There are no compatibility copies of extracted domain algorithms.

Remaining coupling: `game-screen.js` is still a sizable imperative UI controller, owning scripted onboarding, rendering, event binding, reward presentation and PWA prompts. Cloud profile/auth presentation uses injected DOM references. Some historical regression cases inspect source strings rather than exercising every real integration. These are intentional boundaries of this behavior-preserving migration, not claims of complete UI decomposition or live backend validation.

The final browser gate also verifies active/controlling service-worker registration, manifest display/start URL, successful icon/module asset responses and absence of uncaught startup/runtime exceptions. Navigation stays network-only and assets network-first as before; full offline navigation, live OAuth, production analytics and notification delivery are not asserted.

## Subsequent UX changes (#16/#17/#19)

Historical record — October 2026. PR #38 intentionally changed hint vocabulary,
primary success CTA and rules presentation after the behavior-preserving
extractions. `setupRulesHelp()` bound the on-demand rules modal; the scripted
interceptor exempted that modal. The compact result card was scrollable. That
snapshot contained 69 cases (66 original plus three UX regressions), not the
current total. Current rules and checks are owned by GAMEPLAY and TESTING.

## Local/guest mode
Guest play is first-class. Progress is stored in localStorage under `lumenProgressV1`; tutorial, install/push choices, anonymous/session identity and UX preferences also use localStorage keys.

Anonymous users are tracked through an anonymous identifier/session so usage can be measured without requiring authentication.

### Existing persistence contracts (inventory before #24 extraction)

Historical inventory — October 2026. These keys/RPCs document the extraction
baseline, not the complete current projection or writer authority. Consult the
[cloud contract](#cloud-persistence-contract) for current commands and recovery.

The canonical `lumenProgressV1` object retains `solved`, `historyBackup`, `badges`, `noHint`, `performances`, `xp`, `challenges`, `stars`, `shards`, `daily` (dates/rewards), `skyScore` and `skyHistoryVersion`. Keys are zero-based quest indices; cloud `p_puzzle_id` values are one-based. No schema/key migration is part of the refactor.

Other existing keys: `lumenTutorialSeen`, `lumenAnonymousIdV1`, `lumenReferral`, `lumenInstalled`, `lumenInstallLater`, `lumenWelcomeDayV1`, `lumenPushChoice`, `lumenManualCrossTipSeen`, `lumenGuidedErrors`, `lumenSound`, `lumenAutoCross` and the read-only legacy `regaliaAutoCross` fallback. The Supabase SDK retains its own auth storage.

RPC contracts retained: `lumen_get_profile`, `lumen_set_nickname(p_nickname)`, `lumen_get_entitlements`, `lumen_get_progress`, `lumen_save_progress(p_puzzle_id,p_duration_seconds,p_hints_used)`, `lumen_get_daily`, `lumen_save_daily(p_play_date,p_puzzle_id)`. Analytics and feedback RPCs remain separate responsibilities. Authentication retains Google OAuth with the current origin/path redirect, `getSession`, `onAuthStateChange` and `signOut`.

At the #24 extraction baseline, merging prioritized non-empty cloud history,
otherwise local/backup history and prefix import. That historical description
does not authorize current full-profile overwrites: owned receipts, transactional
commands and verified reconciliation now govern restoration under the cloud contract.

## Supabase
The client uses the shared Supabase project **SoldeZen** (`tjdjlavmusmncuszhsuw`).
Lumen is not a separate project in the Supabase project list. Application records live in `lumen`
and dedicated private schemas (including command and privacy machinery); public
RPC wrappers expose bounded, authorized operations. Relevant responsibilities include:
- profile/nickname;
- progress save/load and local-to-cloud migration;
- analytics event tracking;
- daily play;
- entitlements;
- feedback and difficulty rating.

Owner authorization recorded on 17 November 2026: read-only diagnosis may inspect
the Anupon account's ranking attempts and victory receipts across quests to trace
queue dependencies. This standing authorization excludes production writes and
data from the other applications sharing SoldeZen. Keep player identifiers,
tokens and raw save payloads out of public reports.

Google OAuth is supported. When a local player signs in, local solved history must be merged to cloud rather than discarded.

## Analytics
Events include puzzle start/completion, hints, sharing/referral, installation and related engagement events. Referral parameters are sanitized before analytics.

## PWA
Installation follows the initial welcome/learning flow and meaningful engagement,
using current `maybeOfferInstall` guards in `game-screen.js`; installed apps and
deferred offers remain excluded. Push/reminder permission requires explicit user
action. `setupAppUpdates` preserves the welcome on first controller acquisition
and reloads once on controller replacement, with OAuth-return exceptions. Manual
refresh only deletes `lumen-assets-*` caches, never player localStorage/IndexedDB.

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

Menus and in-game dialogs (#925: Social, Account, Help, Report, Share, friends/challenges panels, confirmations) use this same pause through `src/ui/menu-pause.js`: a RUNNING attempt is paused when the first opens (opaque mask, inert board) and resumed once when the last closes, after a 150 ms grace period that covers chained menus. An attempt already paused stays paused; backgrounding while a menu is open releases the pending resume. Mon ciel is a navigation destination and keeps its prior behaviour. The badge/ranking cooldown is wall-clock time from the qualifying start and is not affected by any pause.

Reset clears the board while retaining attempt identity, elapsed active time and assistance history. Campaign, replay and challenge share this lifecycle; badge eligibility (#30) and challenge one-shot business rules (#18) remain owned by their respective features rather than duplicated in the engine.

## Social challenge architecture (#18)

Social challenges use the existing static/PWA client plus Supabase RPCs. `src/campaign/social-challenge.js` owns the domain rules and RPC adapter; `game-screen.js` only orchestrates UI/gameplay. The normal board, rule engine and attempt engine are reused: there is no duplicate challenge gameplay implementation.

Backend objects:
- `lumen.social_challenges`: immutable sender snapshot (quest, qualifying-run performance and its `source_first_play` provenance, sender identity/display name);
- `lumen.social_challenge_participations`: one row per challenge + participant identity, with started/completed/abandoned state, performance and sender read/push state;
- `public.lumen_push_subscriptions`: existing PWA subscription store, extended with authenticated/anonymous ownership and a social-notification preference.

Challenge URLs contain only an opaque UUID (`?challenge=<id>`). They contain no nickname, time, badge, email or other PII. The pre-play RPC intentionally withholds the sender's performance until that participant has completed/abandoned; the sender can always inspect their own snapshot.

Authenticated ownership uses `auth.uid()`. Guests use the existing stable anonymous browser ID and must provide a 2–24 character display name before social participation. The unique server key `(challenge_id, participant_key)` makes a normal guest/browser one-shot. Clearing browser storage or changing browser/device can bypass guest identity, so the product must never claim absolute anonymous anti-cheat.

Challenge writes go through SECURITY DEFINER RPCs while both social tables keep RLS enabled and no direct client write contract. The live migration is named `lumen_social_challenges`; its repository companion is `supabase/migrations/20261004_lumen_social_challenges.sql`.

The existing `lumen-push` Edge Function also owns challenge-result delivery. A completed participation triggers a server-verified challenge-result notification to subscriptions owned by the sender. Push payloads reveal only that a result exists, not the result itself, and deep-link to `?myChallenges=<challenge-id>`. Notification tags are challenge-scoped so repeated results for the same shared link collapse instead of flooding the device.

One challenge link may have many independent participants. “Mes défis” is therefore sender-centric and shows participant count, unread results and each terminal result. This data model intentionally leaves sender/recipient account links compatible with the later Social V2 issue without requiring an internal friends/inbox system now.

### RPC routing matrix and recipient invariants (#883, audited 2026-11-20)

The client routes on the challenge's **stored grid revision**, not on whether a
numeric ID exists. Public `lumen_start_social_challenge` /
`lumen_finish_social_challenge` are wrappers (20261108061843) that only refuse
`grid_revision<>0`, then delegate to the private one-shot implementations in
schema `lumen`; a stable revision-0 challenge is therefore valid on them.

| Challenge kind | Snapshot identity | create | get / Mes défis | start / finish |
|---|---|---|---|---|
| Historical number (legacy index, incl. #650/#692 soft revision 1 of quests 3–7) | `questId`=legacy+1 + `gridRevision` played (#887) | `lumen_create_qualifying_challenge` (played revision) | `lumen_get_quest_challenge_v2` / `lumen_list_quest_challenges_v2` | revision 0: `lumen_start/finish_social_challenge`; revision > 0: `lumen_start/finish_quest_challenge_v2` |
| Stable ID, grid revision 0 | `stableQuestId`, `puzzle_id` null | `lumen_create_quest_challenge` (rev 0) | same v2 reads | `lumen_start/finish_social_challenge` |
| Stable ID, grid revision > 0 | `stableQuestId` + `gridRevision` | `lumen_create_quest_challenge_v2` | same v2 reads | `lumen_start/finish_quest_challenge_v2` |

Reads fall back to `lumen_get_quest_challenge` then `lumen_get_social_challenge`
only on `PGRST202` (older server).

#887 (migration `20261122110000_challenge_grid_revision_887.sql`, additive,
idempotent): a challenge is pinned to the board its sender **played**. The
client sends the attempt's `gridRevision` on the numbered path too; the writer
accepts 0 or the quest's registered revision. An older client that still sends
0 on a revised quest is corrected from the sender's own official run on that
quest (`lumen_commands.ranking_runs`, started ≤ 30 min before), the same
evidence rule as the one-time repair `lumen.repair_challenge_grid_revisions_887`
(private). Production audit 2026-11-21 (aggregates only): 5 numbered challenges
on quests 3–7; the one from 2026-10-04 is revision 0 (correct); the 4 from
2026-11-18/20 had a sender run on revision 1 started 0–2 min before and are
repaired to revision 1. Recipients resolve revision 0 with the original board
and revision 1 with the onboarding board (`resolveChallengeQuest`). Results that
were already played on the other board keep every value and get
`social_challenge_participations.board_mismatch=true`; `get_v2` exposes
`participant_board_mismatch`, `list_v2` exposes `participants[].board_mismatch`,
and `duelOutcome` returns `different-board` (both times shown, no winner).
Limit: a guest on a stale client has no server run, so its declared revision 0
is kept. Old clients cannot open repaired links (v1 readers and start/finish
wrappers refuse revision > 0: `challenge_grid_update_required`).

#927 (migration `20261122120000_current_nicknames_927.sql`): **one account =
its current nickname everywhere**. Rankings, the daily board, the challenge
inbox and friends already read `lumen.profiles`; the challenge readers
`lumen_get_social_challenge` (sender and caller names),
`lumen_list_social_challenges` and `lumen_list_quest_challenges_v2`
(participant names) now resolve, at read time, the ready nickname of the
account ID through the private `lumen.public_nickname(user, fallback)`. The
stored snapshot is only a fallback: guests/anonymous players (never matched by
an equal name) and accounts without a ready nickname keep it; erased senders
are already anonymized (« Compte supprimé »), erased participants removed.
Snapshots stay in the database. No time, rank, badge, status, link or owner
changes; no client cache holds names (notifications are rebuilt from current
lists, an « accepted » notice keyed by an old name simply expires).

### Private circles (#929, EPIC #928 V1)

Migration `20261122130000_private_circles_929.sql` (additive, idempotent).
Accounts with a ready nickname only (`lumen.social_caller`). Privacy model as
#35: every row has exactly one owner and there is no foreign key between Lumen
tables, so Lumen erasure (`lumen_privacy.policy()`, registered here) removes a
player's rows only; triggers keep circles consistent.

| Table | Owner (erasure) | Notes |
|---|---|---|
| `lumen.circles` | `owner_user_id` | name 2–30 chars, nickname character rule + apostrophes |
| `lumen.circle_members` | `user_id` | role `owner`/`member`, one owner per circle |
| `lumen.circle_invites` | `recipient_user_id` | friend invitations; `declined_at` drives the 24 h cooldown |
| `lumen.circle_links` | `created_by` | only `sha256(token)`; 7-day expiry; revocable |

Triggers: a member leaving (or erased) makes the oldest remaining member owner;
the last member leaving deletes the circle; deleting a circle deletes its
members, invitations and links. Tables have RLS and no direct grant; the
`public.lumen_circle_*` RPCs (`list`, `create`, `rename`, `delete`, `leave`,
`remove_member`, `detail`, `invite_friend`, `respond`, `link_create`,
`link_revoke`, `link_preview`, `link_join`, `board`) are `SECURITY DEFINER`,
granted to `authenticated` only (anon revoked explicitly, since hosted
Supabase grants it by default). Owner-only: rename, delete, invitations, links,
removal. A non-member gets the same `circle_not_found` as for an unknown circle;
an unknown, expired or revoked link the same `circle_link_invalid`. A valid
link preview shows only the circle name, its owner's nickname and its size.
Owner decision (2026-11-21): 20 members per circle, 10 circles per player
(owned or joined), 3 active links per circle, 20 pending friend invitations per
circle, 24 h before re-inviting after a refusal.

Private ranking (`lumen_circle_board`): the official ranked score
(`lumen_commands.ranking_scores`, seconds + penalties) of members for one quest
and grid revision, the public tie rule (`rank() over(order by score)`), no
virtual players, public filters (participating, ready nickname, not opted out of
the ranking); members without a time are only counted. The public board is
unchanged. Out of scope (#930/#931): collective challenges, seasons, points,
notifications, rewards.

Recipient invariants (`challenge-recipient-browser.mjs`,
`fixtures/challenge-rpc-matrix.sql`):
- the challenged grid is played even from a locked Adventure: `choose()` does not
  apply the campaign quest bound while `socialChallenge` is active, and challenge
  attempts never open an Adventure (`hasPackAccess` ignores `mode: challenge`);
- a challenge victory branches before every campaign mutation (no progress,
  reward, badge or entitlement);
- the server stores lowercase `started|completed|abandoned`;
  `challengeAttemptClosed` shows the result of a finished link instead of a new
  attempt, and the server never rewrites a terminal result;
- “Mes défis” labels rows with `challengeQuestLabel` (canonical visible ordinal),
  because `puzzle_id` is a frozen legacy index and is null for stable-only quests;
- `challenge_created` / `challenge_result_viewed` carry `stable_quest_id` and
  `grid_revision` so stable-only challenges stay measurable (#708);
- (#881 Lot 1) a recipient who has not completed the tutorial
  (`tutorialCompletedProof`) sees a rules summary and « Voir les règles » in the
  intro; reading them starts no attempt. During a challenge the rules help hides
  « Rejouer l'apprentissage » / « Revoir l'introduction », and
  `startLearningReplay` / the introduction replay refuse to run: both would
  have replaced the challenged grid by quest 1 and restarted its clock.

#889 / #888 (migration `20261121090000_qualifying_challenges_889_888.sql`,
additive): the `check(source_first_play)` constraint is dropped and the
versioned writer `lumen_create_qualifying_challenge` serves every kind
(historical number, stable revision 0 or registered revision). It refuses
`p_qualifying=false` and stores `p_first_play` as declared; the older writers keep
their first-play contract for older clients. The client falls back to them only
for a first win when the new writer is missing (PGRST202) and refuses a replay
rather than mislabel it. `lumen_get_quest_challenge_v2` / `lumen_list_quest_challenges_v2`
add `source_first_play`; the get also returns the caller's own
`participant_started_at` and `server_now` (never another participant's). The
client derives the resume plan with `challengeResumePlan`; a challenge attempt is
restored only for its own `challengeId` and a cross-device resume seeds
`activeDuration` with the server-measured elapsed time. Qualification itself is
declared by the client as for victory commands (the server echoes
`facts.qualifying`); the server cannot prove a guest's cooldown, exactly as it
could not prove a first play before.

Known limits: durations stay client-declared; a cross-device resume counts the
wall-clock time since the server start, pauses included. Old cached clients without these
fixes still show the previous behaviour until they update.

### Daily challenge (#882, EPIC #881 Lot 3)

Server contracts, data model, rules, anti-cheat limits and rollback are owned by
[DAILY_CHALLENGE.md](DAILY_CHALLENGE.md). Summary: one official ranked attempt per
account and Europe/Paris day (`lumen_commands.daily_runs`, primary key
`(user_id, day)`), pinned grid per day (`daily_puzzles`, seeded from
`content/generated/daily-schedule.json`), general and friends rankings computed
from the same rows, ranks frozen in `daily_standings` after close + 6 h, disabled
by the `daily_challenge` feature flag until the gates of #882 are validated.
Client (PR B): a daily run is an isolated challenge run in `game-screen.js`
(`socialChallenge.daily`), started from `/?daily=1`; see DAILY_CHALLENGE.md §6 bis.
Privileges: hosted Supabase grants `EXECUTE` to `anon` on every new `public`
function, so revoking `PUBLIC` is not enough. `20261122100000_daily_anon_revoke_882.sql`
revokes `anon` explicitly; only `lumen_daily_today` stays guest-callable. New
account-only RPCs must revoke `anon` explicitly too.

### Friends and direct challenges (#35, EPIC #881 Lot 2)

Optional, accounts only; a guest still plays any challenge link without an
account. The public identity is the existing unique nickname
(`lumen.profiles.nickname`, `nickname_ready`); RPCs take and return
nicknames only, never an email or a user ID. Migration
`20261121100000_friends_direct_challenges_35.sql` (additive, idempotent):

- `lumen.social_friend_edges`: one directed edge per player
  (`outgoing` / `incoming` / `friends` / `declined`), so each row has one
  owner and Lumen erasure never touches another player's row. A trigger on
  `lumen.profiles` deletion removes the other players' edges towards an erased
  profile; account deletion cascades through `auth.users`.
- `lumen.social_challenge_invites`: owned by the recipient, keyed by an existing
  challenge ID **without** a foreign key or a new column on
  `lumen.social_challenges` (the erasure review only accepts the participation
  FK and a fixed anonymizable column list). The sender is the challenge's own,
  anonymizable `sender_user_id`; it is never copied.
- RPCs (`authenticated` only, SECURITY DEFINER, RLS on, no table grant):
  `lumen_friend_search` (exact case-insensitive nickname, no enumeration),
  `lumen_friend_request` (idempotent; crossing requests accept; limits: 30
  pending, 10 per day, 30-day wait after a quiet decline), `lumen_friend_respond`,
  `lumen_friend_remove`, `lumen_friend_list`,
  `lumen_challenge_send_to_friend` (own challenge, accepted friend, one invite per
  challenge and friend, 30 per day), `lumen_challenge_inbox` (received with the
  caller's own status, reference hidden; sent with each friend's status and the
  finished time).
- Both tables are registered in `lumen_privacy.policy()` with
  `lumen_erasure_guard` (same pattern as #729/#796). The rights export lists the
  rows, including the friend's technical ID, under its existing
  `thirdPartyReviewRequired` operator review.

A direct challenge is an existing challenge (created by the #889 qualifying-run
writer) delivered to a friend; the one-shot participation, resume (#888),
comparison and campaign isolation are those of the link challenge. The client
module is `src/campaign/social-friends.js`; the screen is « Amis et défis »
(`#friendsModal`), with « Envoyer à un ami » from the challenge share dialog and
from « Mes défis ». Duel presentation (#896, `src/campaign/duel-view.js`) reads the
same contracts: « Mes défis » rows (`source_*`, `participants[].name/status/
duration_seconds/autonomy/mastery/previously_played/completed_at`), the friend
inbox joined to them by `challenge_id` (participant matched by name, else by a
unique identical time), and, for a finished received challenge, the read-only
`lumen_get_quest_challenge_v2` (cached per session). No migration. No push or in-app notification beyond a small counter of
pending requests and received challenges on the entry button. Since #898 the
entry buttons (`#openFriends`, `#openMyChallenges`, `#inviteLumenFriends`) and
their counters live in the Espace social panel (`src/ui/social-hub.js`), keeping
their ids so the #35 code binds them unchanged. In-app notifications
(`src/ui/social-notifications.js`, PR B) are derived from the same reads
(`lumen_friend_list`, `lumen_challenge_inbox`, `lumen_list_quest_challenges_v2`);
no table, RPC or migration is added and nothing is pushed. The only state is
local, per account and device: `localStorage['lumenSocialNotificationsV1:<user id>']`
= `{version, baseline, outgoing[], accepted[], seen[]}` (lower-case nicknames of
pending outgoing requests to notice an acceptance, acceptances kept 30 days
while the friendship exists, ids already read; bounded, ids of vanished items
forgotten). The first observation on a device is a silent baseline (no flood of
old acceptances). Guests store nothing.

### Security-advisor note
Supabase reports the two social tables as `rls_enabled_no_policy` and the anonymous social RPCs as callable SECURITY DEFINER functions. For #18 this is intentional: guests are a product requirement, direct table access is denied by RLS, and the narrow RPCs enforce the ownership/one-attempt contract. These warnings are not a claim that the whole project is security-clean; unrelated existing advisor warnings remain and must be reviewed separately.

## Onboarding local preference (#569 / #576)

ui/onboarding-preferences.js stores presentation-only auto choice and viewed tip
IDs in lumenOnboardingV1:<owner-or-guest> (QA uses the existing qaKey namespace).
The owner is read dynamically at every access; no global lumenAutoCross or
regaliaAutoCross value is imported because its account owner is unknown. Old
saves default to on after manual quest 1. Lesson/challenge constraints only alter
the active UI. Quota/refused storage keeps a scoped in-memory choice for this
session; cache loss/new devices may reset preferences. These are local settings,
never cloud achievements, rewards, entitlements or a second progress store.
The board may initialize before Auth resolves. `refreshOnboardingPreferenceOwner`
reapplies the verified account's controls when readiness and owner change, without
recreating its board or attempt. Same-owner refreshes leave the active choice alone;
temporary teaching/challenge restrictions still take precedence.
The existing cloud autoCrossUnlockSeen marker retains its normal serialization
and recovery: quest 6 sets it only after unchecking, or observing unchecked.
No new profile field, RPC, table, outbox or cloud reconciliation rule is added.

## Current learning controller (#57)

`src/game/learning.js` is a pure, read-only lesson planner over the canonical board. It produces the expected cell actions and context-specific copy, using the audited opening grid and its `learnOrder`. `game-screen.js` enforces the interaction gate and presents the coach. It does not keep a second teaching board or persist a parallel lesson cursor; refresh resumes by deriving the step from the restored attempt board. Later placements spotlight the territory instead of the solution cell. Quest 2 is free play with optional drag advice. Explicit learning replay can still derive the historical gesture lesson from the same board using `dragLearningStep`. The transient pointer gesture freezes its permitted cells until release so completing the row mid-drag cannot mark unrelated cells. The older stage #25 descriptions above record the historical extraction, not the current learning behavior.

The temporary territory numbers of the quest-1 introduction are decided by the pure `territoryNumbersVisible` (#862), computed once per render: an intro step (`learningIntroActive`) of an active scripted lesson (`scriptedLearningActive`, which honours `lumenSkipFirstGridTutorial` and explicit replays). The in-memory intro cursor resets on reload, so it alone could not hide them after a skipped tutorial.

Validation: `scripts/learning-tests.mjs` proves the five forced deductions and requested exclusions; `scripts/learning-browser-tests.mjs` exercises real touch/mouse actions, ignored taps, reload, drag, complete quest 1, free quest 2, direct ordinary continuation and optional Mon ciel navigation on 320x568, 360x640, 390x844, 768x1024 and 1440x900 viewports. Both are part of the CI gate.
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


## Privacy #316: isolated SQL regression (2026-11-01)

The operator-only `lumen_privacy` erasure migration is **not deployed** by this PR.
`support_access.actor` is compared as text to the verified UUID scope to avoid
PostgreSQL type mismatches. The private tombstone barrier and existing Lumen-only
scope remain unchanged. The `Privacy SQL integration` GitHub Actions workflow
runs a disposable PostgreSQL 17 service; it does not connect to production or
create a billable Supabase project. A green scope test does not establish that
full account erasure, anti-resurrection, or SoldeZen isolation is validated.

## Account erasure self-service (#316, pending release)

Historical proposal, superseded by the privileged boundary below (never deploy this client-callable design): the browser account menu invokes `lumen-self-erasure` with the current user JWT and explicit confirmation. The Edge Function verifies the user and calls `public.lumen_self_erase` as that user. The database derives the target from `auth.uid()` and invokes the existing transactional Lumen-only erasure policy. The shared Supabase Auth identity and SoldeZen tables are not deleted. This implementation is **not production ready** until verified guest actors and local persisted state are handled and a QA end-to-end deletion succeeds. The migration and function must be deployed together only after security review; rollback is to disable the Edge Function and revoke the RPC execute privilege, not to restore deleted player data. Cloud restore is intentionally blocked for erased identifiers by the existing erasure guards.


### #316 — Privileged erasure boundary (PR #611)

The Edge reports success only for the SQL acknowledgement `status=erased`,
`barrier=active` and `authDeleted=false`. An empty, incomplete or inconsistent
response remains an explicit failure, even when transport succeeded. The target
always comes from verified Auth; a client-supplied target is ignored.
The browser submits an explicit `SUPPRIMER` confirmation to the Lumen Edge Function. The function verifies the bearer token with Supabase Auth, then uses server-only service credentials to call `public.lumen_self_erase(uuid,text)`. The SQL entrypoint rejects non-service roles and uses the existing transactional `lumen_privacy.erase_account` policy, actor collision checks, and anti-resurrection tombstones. It never deletes shared `auth.users` or SoldeZen data. The previous client-callable JWT-clearing procedure must not be deployed. Deployment requires an isolated authenticated QA erasure and rollback verification; static CI alone is insufficient.

### #316 — Full account deletion (owner decision 2026-11-14)

After the acknowledged Lumen erasure, the Edge deletes the sign-in account through the Auth admin API only when `public.lumen_account_deletable(uuid)` (service role) returns `true`: the Lumen barrier exists and `lumen_privacy.account_used_elsewhere` finds no row in any non-Lumen table referencing `auth.users` (or owner-like uuid column). The scan fails closed. Shared SoldeZen/nounou accounts keep their sign-in identity; `public.lumen_account_erased()` lets the client show an explanation instead of an unsatisfiable nickname gate. The response adds `accountDeleted`; existing acknowledgement fields are unchanged.

### Offline catalogue and pending wins (#597)
The offline service worker caches the published static module graph and catalogue data, marking a cache ready only after successful completion. Cloud profiles and reward receipts remain authoritative. A verified account may retain a bounded, device-local owner-specific offline continuation marker; this is not cryptographic authentication and must not authorize cloud writes or another account. Canonical and legacy victory intents are stored in durable owner-bound command outboxes; pending navigation projects completion without modifying rewards or cloud state. On reconnect, command replay and cloud reconciliation must remain idempotent. Android cold-start and multi-quest acceptance remain release blockers.

Offline startup (#597, 4 November): restored solved boards are revalidated after
the same account's local Auth restoration when the bounded verified-offline
continuation marker is present, even while cloud readiness remains false.
This schedules the existing real victory validator and durable enqueue; it never
installs a cloud profile or acknowledges a reward. Switched accounts, changed
attempts/quests, unverified sessions and password recovery remain held.
Historical cloud performance recovery is deferred while navigator reports offline.

Offline paid-aid decision (owner, 4 November 2026): a verified device may use
paid Hint/Verify against its last confirmed cloud balance, less all durable
pending wallet reservations. The existing Wallet outbox stores the unchanged
server request before an aid is provided; Web Locks serialize device tabs.
No profile balance, reward or receipt is invented. The verified-owner marker
also retains that confirmed balance; older markers without a balance permit
play but require fresh online hydration before paid offline aids. Reconnect
replays through the existing coordinator and exact receipt/cache recovery.
An insufficient-balance refusal is retained for review, never erased and never
used to revoke earned progression. Offline spending across two disconnected
devices can conflict; the owner explicitly accepted retained reconciliation.
Server tariffs, eligibility and badge assistance rules remain unchanged.
## Métadonnée de record sans assistance (#600)

`performances[index].bestUnassistedTime` et
`canonicalQuestState[id].runPerformance.bestUnassistedTime` prolongent les
résumés existants ; aucun nouveau champ de profil racine ni magasin parallèle.
Les commandes Legacy/Quest calculent le minimum à partir des faits d’une
nouvelle victoire. Le reçu reste idempotent. La récupération des acquis conserve
le minimum valide sans transformer les badges cumulés en preuve historique.

La migration `20261104155248_personal_records.sql` modifie uniquement les
fonctions, avec contrôle du corps attendu ; elle ne réécrit aucune sauvegarde,
récompense, monnaie ou historique. Son déploiement serveur reste une étape
distincte, non exécutée par les tests ni par la fusion du client. Sans cette
migration, un ancien serveur continue de confirmer ses temps absolus, mais ne
confirme pas de nouveau record sans aide : le client ne le fabrique pas.
Avant activation, conserver les définitions des fonctions pour un rollback ;
un retour aux fonctions précédentes doit conserver le JSON et les reçus acquis.
## Publication append-only de l’aventure 5

Le candidat #599 conserve les révisions 1/2 et leurs digests. La révision 3
contient leur préfixe de 400 quêtes inchangé et les 100 ajouts de l’aventure 5.
Les snapshots explicites d’origine 1/2 restent lisibles et immuables ; seul un
nouveau profil sans origine est classé dans la révision courante. Aucun profil
existant n’est parcouru ni réécrit par la migration.

L’activation des 100 règles serveur et du garde d’origine doit être coordonnée
avec le client compatible. Un ancien client qui ne connaît pas l’origine 3 doit
être mis à jour ; il ne faut jamais « réparer » son profil en réécrivant cette
origine ou en supprimant ses sauvegardes. Pour revenir d’une publication,
conserver les lecteurs d’origine 3, les IDs, reçus et acquis ; ne pas redéployer
un ancien catalogue de 400 quêtes au-dessus de nouveaux acquis. Sauvegarder les
définitions des fonctions avant toute activation autorisée.

L’accès au pack et les prérequis réutilisent le contrat normal. Les grilles
verrouillées sont précachées sans conférer d’accès. Toutes les victoires et
replays passent par les commandes canoniques existantes ; aucune seconde outbox
ni règle économique ajoutée.

### Confirmation cliente de suppression (#316)

Le client conserve le compte, le client Auth et la génération de session de la
demande. Il refuse un jeton d'un autre compte et toute réponse devenue obsolète.
Un HTTP 200 seul n'autorise aucun nettoyage : la réponse JSON doit confirmer
`status=erased`, `scope=lumen`, `details=erased`. L'échec de déconnexion ou un
changement de propriétaire local conserve les données de cet appareil et affiche
un état incomplet, sans revendiquer une suppression locale réussie. Les contrôles
serveur et la recette authentifiée isolée restent obligatoires avant activation.

## Catalogue complet UAI — révision 4

Le [catalogue 88/880](CATALOGUE_88.md) ajoute les aventures 6–9 à la révision 3,
sans modifier les définitions complètes des 500 quêtes précédentes ni aucune
révision archivée. Le défaut des profils vides passe à 4 dans la migration
additive `20261106115913_complete_iau_catalogue.sql`. Les cohortes existantes
restent immuables ; aucune ligne de joueur n’est parcourue ou réécrite.
Les 380 nouvelles règles et IDs serveur précèdent le déploiement du client
compatible, après autorisation de l’activation de production. Les lecteurs
d’origine 4, règles et reçus gagnés doivent survivre à tout rollback.
Les droits d’aventure, le wallet et les preuves de victoire restent détenus
par leurs autorités existantes ; les célébrations ne sauvegardent aucun gain.

Une copie d’assistance d’un compte avancé peut dépasser les 6000 faits par
bloc. Le client utilise alors plusieurs blocs `source: local` du protocole
existant : tous les faits courants sont conservés dans l’ordre, et les trois
compteurs de file gardent leur réserve dans le premier bloc. Le plafond de
trois blocs/524288 octets JSONB reste inchangé. Les checkpoints facultatifs
s’ajoutent seulement s’ils tiennent ; les originaux restent sur l’appareil.
Un échec de taille ne tronque ni sauvegarde ni opération en attente.


## Réservations d’aides et réseau inaccessible (#629)

Le signal `navigator.onLine` ne prouve pas que le serveur est joignable. Après une erreur temporaire classée UNKNOWN, 408, 429 ou 5xx, une aide peut utiliser la réservation hors ligne existante : propriétaire vérifié sur cet appareil, preuve de solde valide, verrou inter-onglets, inventaire durable complet et identité exacte tentative/reset/type/séquence. Les refus Auth, métier ou de schéma ne permettent pas ce repli. Une file Wallet suspendue pour Auth ou revue refuse toute nouvelle réservation. Même si la restauration cloud échoue, les réservations locales du compte sont déduites du compteur.

Le solde confirmé reste distinct du disponible. La restauration authentifiée rejoue les commandes et vérifie leurs reçus avant de retirer la file. Aucun champ persistant, migration SQL ou droit ajouté ; les garanties multi-appareils et transfert invité restent inchangées.

## Temps officiel et compatibilité des reçus (#638, #652)

Le compteur actif reste une durée réelle en millisecondes. Le chrono officiel est
dérivé de cette durée et des compteurs cumulatifs hint/verify/guided (15/5/5 s).
La restauration ne crédite jamais une pénalité : elle recalcule la même somme.
Les resets de campagne remettent les compteurs à zéro ; un défi social reste
une tentative unique. Rapidité, bonus temporels, indice offert après 90 s et
cooldowns conservent leurs chronomètres métier réels.

Une nouvelle victoire peut ajouter aux huit faits existants un objet facultatif
timing {version:1, gridRevision, helpUses:{hint,verify,guided}}. Il est figé dans
les outboxes et le reçu original, sans réécriture lors d’une reprise. Le serveur
recalcule les pénalités, valide types, compteurs, assistance et révision, puis
conserve officialTimes[revision] dans les résumés Legacy et Quest existants.
Les minima bestTime/time/bestUnassistedTime restent techniques. Aucun nouveau
magasin de progression ni nouvelle autorité monétaire. La vérification de
lecture doit couvrir le record officiel avant confirmation du client.

La capability lumen_official_time_version annonce le support serveur. Avant sa
confirmation, aucun support n’est inventé. Une confirmation positive est mise
en cache pour cette URL publique de backend, afin qu’une PWA entièrement fermée
puisse reprendre hors ligne et figer les mêmes preuves. Une absence explicite
du RPC invalide ce cache ; les intentions déjà figées ne sont jamais réécrites.
Sans confirmation, les anciens faits à huit champs restent utilisables ; la victoire
et le chrono affichent leur somme locale, sans fabriquer de record confirmé.
Un record historique n’est affiché que depuis la projection officielle serveur.
Les endpoints privés de lecture ne dépendent pas de l’inscription publique.

La conversion paresseuse, dans la transaction suivante, applique la convention
historique zéro pénalité aux seuls anciens minima de révision 0. Un score déjà
compétitif est utilisé une fois, sans lui ajouter une deuxième pénalité. Si son
temps brut est le minimum historique et sa pénalité positive, ce brut n’est pas
un record sans aide ; le serveur utilise le score et un éventuel minimum sans
aide prouvé. Les minima de révision ambiguë ne sont jamais transférés. Le reçu
nouveau contient le précédent record comparable ; une égalité ne peut donc
être annoncée comme un premier record. La récupération fusionne les minima
officiels indépendamment pour chaque révision, sans toucher aux acquisitions.

Les défis sociaux existants ont un protocole non versionné de durée réelle,
sans compteurs d’aides dans la référence. Ils conservent ce protocole : comparer
un score officiel nouveau à une référence réelle ancienne serait incompatible.
Leur chrono reste celui du défi. Une évolution de ce protocole nécessite sa
propre migration versionnée des deux participants.

La présentation de victoire ne valide aucune acquisition. La progression et
les badges sont confirmés avant la célébration ; fermer avant « Voir le
classement » ne change ni leur persistance ni les intentions en attente.
Voir [le plan de migration](OFFICIAL_TIME_ROLLOUT.md).


### Diagnostic des archives de reçus canoniques (incident #700)

Les échecs de validation d'une capture recréée et de son reçu cloud restent bloquants : aucune archive n'est acquittée sans preuve vérifiée. Pour faciliter le diagnostic sans exposer les données de joueur, les erreurs d'archivage disposent de codes stables : `CAPTURE_V2_PROOF_UNCONFIRMED`, `CAPTURE_V2_PERFORMANCE_MISMATCH`, `CAPTURE_RECEIPT_PROOF_UNCONFIRMED`, `CAPTURE_RECEIPT_ORDER_CONFLICT`, `CAPTURE_STORAGE_UNCONFIRMED`, `CAPTURE_ARCHIVE_CONFLICT` et `CAPTURE_ARCHIVE_WRITE_FAILED`. Ces codes ne changent ni la politique de retry ni la validation du reçu, et ne doivent pas être interprétés comme une autorisation de supprimer une intention locale. Les conflits de version cloud (`CLOUD_CAS_CONFLICT`) sont investigués séparément.

Cause confirmée de l'incident : depuis le chrono officiel (#653), les faits V2 contiennent `timing`. L'archivage canonique accepte désormais ce champ uniquement s'il est identique à celui du reçu serveur, comme le chemin legacy ; une capture dont `timing` diffère, manque ou est ajouté reste bloquée. Les codes `CAPTURE_*` sont transmis tels quels aux diagnostics (`errorCode`) et restent de type `retry` : ils ne mettent jamais une intention en pause.

### Erreurs de transport et victoires lentes (#697, #698)

Une écriture CAS du profil qui échoue sans code fournisseur avec un message de transport (`Failed to fetch`, `Load failed`, abandon/délai) est étiquetée `CLOUD_NETWORK` au lieu de `CLOUD_WRITE_REFUSED`. Le traitement ne change pas : la progression non synchronisée est préservée et la lecture de vérification existante s'applique. Côté victoire, le chrono affiché et les secondes capturées sont figés à la détection locale ; si la commande d'une victoire déjà capturée durablement dépasse 2,5 s, la carte « victoire en attente » s'affiche pendant que la commande continue, sans aucun crédit local, puis devient la célébration confirmée après l'accusé serveur. Les événements `victory_pending_shown`, `victory_pending_upgraded` et `victory_sync_timing` (durée en ms, sans identifiant) alimentent les mesures avant/après.

**Play Console product identifiers (2026-11):** Google Play requires underscores in the external SKU (`real_adventure_02` … `real_adventure_09`, `real_sky_all`). The application converts canonical internal pack/catalogue IDs (`real-adventure-02` … `real-adventure-09`, `real-sky-all`) only at the Play API boundary. The Edge Function validates the external SKU and maps it back to the internal catalogue ID before granting any rights; no existing purchase or entitlement IDs are renamed. The Play package is `com.nopuna.lumen`.

### Offline start and unreachable backend (#847)

The owner-bound offline proof (`lumenOfflineVerifiedOwnerV1`) is written as soon
as an online hydration is verified. Before #847 it was written only as a side
effect of an access decision; #807 removed the hint-spend path that triggered it,
so a signed-in player could stay on « Tu es hors ligne » in airplane mode.
A transport failure while `navigator.onLine` is still true (Auth refresh or RPC
without HTTP answer, or a backend silent for 15 s plus an 8 s probe) is treated
as offline: the page reads `navigator.onLine` as false through an instance
property, so every existing offline rule applies unchanged. Only the stored
owner, with a valid proof and no pending identity change, plays its local cache;
otherwise the explicit offline screen stays. A probe every 30 s (backoff to
5 min, immediate on `online`) reloads once the backend answers, deferred while
an attempt is running. No data is deleted and no write is sent while unreachable.

### Attempt run identity and ranking verdict (#851)

`attemptOperationId(attempt)` (`attemptId-reset-<runSegment>`) identifies a run
for the victory receipt and the ranking capture, which `ranking_finish` matches
by this exact id. New attempts start at `runSegment: 0` and keep it across
resets; an attempt restored from an older release takes `runSegment = resetCount`;
challenges keep their historical per-reset id. The client keeps the
`ranking_begin` verdict and the run's qualification to state a refusal:
`cooldown` (begin refused, the only begin refusal), `not_qualifying`,
`not_better` (confirmed, ranked best unchanged), `unknown` otherwise. No SQL
change and no historical ranking modification.
