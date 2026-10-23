# Feature map

Persistence lot 2: UI command imports → coordinated-command-adapters.js →
persistence-coordinator.js → existing Canonical/Legacy/Wallet proof adapters.
transactional-command-cache.js uses indexed-outbox-store.js version 1 to pair
immutable intentions with pending metadata and mirror owner-bound verified
profiles. Legacy UI cache reads remain active. Tests: persistence-coordinator-tests.mjs
and transactional-command-cache-browser.mjs (account-session browser suite).
Shadow instances inspect only; same-origin Web Locks serialize updated tabs.
See the cloud contract for fallback, authority and rollback limits.


Persistence foundations (lot 1): local.js returns verified durable results and
quarantines malformed bytes before replacement; game-screen.js reports refusals
and scopes hydration to account/client/generation, including rejected awaits.
profile-size.js owns the UTF-8/JSONB size boundary. Required checks:
local-persistence-contract-tests.mjs and cloud-hydration-generation-tests.mjs.
No reward authority, command identity or outbox format changes.

Reviewed device recovery (#536/#537): `persistence/approved-device-recovery.js`
installs a re-read cloud snapshot after an explicit reviewed file matches the
authenticated owner and exact local/cloud SHA-256 digests. `game-screen.js`
exposes the account diagnostic chooser; no file/profile upload or pending purge.

Incident versions (#534): `ui/incident-investigation.js` derives ordered version
observations from the existing bounded cockpit response, combines episode filters
and revokes review/draft actions whenever the view changes. No new persistence.

Installation quota (#536/#537): `cloud-profile.js` retries achievement installation
once after verified bounded archival by `storage-maintenance.js`. Wallet
`recoverWalletCacheDurably` uses the existing original snapshot store and exact
receipt predicate. Neither path fabricates rewards or releases unproven holds.

Countdown touch stability (#548): `ui/styles.css` reserves the hidden countdown's
space. `clock()` owns visibility; cells keep their coordinates across transitions.

Guided correction (#548): `ui/gesture-click-suppression.js` scopes suppression
to the handled pointer's release, shared with Guardian hold. `game-screen.js`
clears it on each new gesture; no global post-correction input cooldown.

Touch hold (#531): `ui/long-press-guardian.js` recognises one 500 ms touch and
suppresses its own release click. `game-screen.js` owns live guards and dispatches
the dedicated gesture into the existing cell handler; no alternate game writer.

Incident investigation (#534 phase 2): `ui/incident-investigation.js` owns
bounded episode grouping, observed-state filters, fixed hypotheses and sanitised
report/GitHub drafts. `game-screen.js` feeds only authorised diagnostic data and
adds grouped detail signals to the existing alert list. No new persistence.

Optional incidents (#534): `persistence/diagnostic-reporter.js` owns bounded
transport, fixed codes and safe runtime listeners; `game-screen.js` owns account
choice, cloud/outbox hooks and #533 markers. The diagnostic migration extends
the same #398 cockpit/cron and hardens legacy ingestion. See OBSERVABILITY_534.

Storage diagnostics/retention: `persistence/storage-maintenance.js` owns aggregate
size inventory and verified archival of older recovery copies; `game-screen.js`
wires account diagnostics, explicit maintenance and recovery export. See
DATA_AND_ARCHITECTURE for exclusions and transaction/session guards.

Local quota recovery: `cloud-profile.js` `reconcileCloudAchievementsDurably`
uses the existing verified IndexedDB snapshot fallback before cache installation;
the account recovery export includes that store. See DATA_AND_ARCHITECTURE and
the quota suite/native browser scenario in TESTING. Wallet holds stay separate.

Completed quest holds (#537): `game-screen.js` preserves completed card labels
and displays the replay hold in constellation detail. `catalogue-access.js` and
the canonical adapter still own action authorization; no persistence policy changes.

Verified against `bef5f32` (2026-10-18). Paths are repository-relative. This lookup index complements contracts in `docs/AGENT_CONTRACTS.md`, `docs/PROGRESSION.md` and `docs/DATA_AND_ARCHITECTURE.md`. Recheck symbols after relevant changes; historical counts in validation reports are not current catalogue totals.

## Entry points and shape

Hydration #536: `cloud-profile.js` fixed-domain/stage diagnostic helpers retain
wallet refusals separately from partial reward recovery. The game-screen hook
checks its account/client after the final mirror await. No new reward policy,
writer or profile field; see `docs/validation/2026-10-23-hydration-536.md`.

Guest registration (#528): `src/persistence/guest-account.js` selects an ownership-safe initial profile and verifies an account-scoped original backup before UI hydration. Existing cloud conflicts retain guest progress. Guided Undo (#533): UI `clearGuidedConflict` clears the stale interaction lock while restoring history. Badge eligibility (#529): `performanceEligibility` exposes all four goals from quest 1; quest 3/6 are explanations, not badge unlocks.

Session recovery #530: `cloud-profile.js` canonical achievement coverage accepts
only server badge additions on identical immutable victory evidence.
`achievementRecoveryDiagnostic` supplies fixed failure categories;
UI `cloudReconciliationMessage` explains held local data. See the dedicated
report in `docs/validation/2026-10-22-achievement-recovery-530.md`.

Published definitions: `quest-definition.js` validates the current revision
exposed by `catalogue-origin.js` and consumed by `canonical-quests.js`, with
variable sizes and unchanged saved identities/grids. Board feedback lives in
UI `rewardProgressPulse` (real mutations versus render/restore) and the group
hint handler (source/target roles).
`quest-view.js` owns the ephemeral saved-record/label projection consumed by
`init`, `currentAttemptAnalytics`, `trackCurrentPuzzleStart` and
`startBadgeCooldownRefresh`; telemetry and periodic card updates keep historical
keys separate from active stable quest identity.

Victory challenge visibility: UI `configureVictoryChallenge` applies the existing
first-play rule to both victory surfaces. The stable quest social migration adds
a stable-ID RPC while preserving the historical numeric protocol.
`createSocialChallengeFromSuccess` guards pending creation and reuses that
offer's URL. Adventure focus/scroll lives in `sky-navigation.js` (`revealAdventure`).

Quest convergence (#522): `quest-rules.js` owns visible teaching/access milestones
and shared qualification; `quest-rewards.js` owns compatibility reward definitions;
`quest-victory.js` is the pure QA/fixture projection. `quest-command.js` validates
V2 receipt/current-profile authority. See the cloud candidate contract in
`DATA_AND_ARCHITECTURE.md`; the three pending 20261022 quest migrations require
separate production authorization. Admin quest reads use stable metrics/timeline.

Astronomy fidelity: `scripts/audit-astronomical-figures.mjs` rebuilds all shipped
figures from versioned source fixtures under `scripts/fixtures/astronomy/`.
`renderMap` selects `renderCanonicalSky` for every verified catalogue figure,
including generated entries; mobile detail CSS reserves drawing space.

Quest reward marks: `questSecondaryStarsSvg` in
`src/ui/astronomical-reference-svg.js`, consumed by overview navigation and
detail/victory primary SVGs. Canonical quest metadata owns every displayed total;
only a real-star shortfall adds decorative lights through `quest-secondary-stars.js`. Large figures have no decoration; source geometry and awards are unchanged.
Finale viewport fitting: `fitFinaleBoard` in `game-screen.js`, observed banner/app
content size plus CSS square-board budgets in `styles.css`.

`index.html` loads the Supabase CDN client and `src/main.js` → `startGameScreen()` in `src/ui/game-screen.js`. Native ES modules without a required application bundler. A root `package.json` provides `test:affected` and `test:full` scripts; do not confuse the absence of a build step with the absence of a package manifest. `src/ui/styles.css` owns styling; `manifest.webmanifest` and `sw.js` own PWA metadata/network behavior. `scripts/build-static.mjs` is a packaging utility, not a required application bundler. The large UI controller wires factories, mutable live state, rendering and async hooks; search symbols before reading excerpts.

| Feature | Responsible files / principal symbols | Entry / source of truth |
|---|---|---|
| Private Android recipe preview | `docs/ISOLATED_VALIDATION_PREVIEW.md`; source is the existing private Sites project, with a dated archive under `docs/validation/isolated-preview-20261022/` | Reusable isolated UI/PWA/storage validation with synthetic Auth/RPC; v2 verifies uncached HTTP before simulated acknowledgement. Not live account/cloud proof |
| P0 wallet and offline recovery | `src/persistence/wallet-command.js`, `pending-navigation.js`, `sync-presentation.js`, `outbox-health.js`; UI `authorizeWalletSpend`, `presentPendingVictory`, `refreshCanonicalOutboxNotice` | Wallet durable domain, immutable receipt and current cursor; pending navigation never grants rewards or access; unobtrusive celebration status; private aggregate observations. Prepared SQL requires separate approval; runbook in `docs/CLOUD_RECOVERY_391.md` |
| Persistent Auth storage | UI `window.supabase.createClient` initialization | Explicit persistent localStorage and automatic renewal; SDK retains token/key/rotation authority. Readable existing sessions survive the SDK writable-probe failure; no quota-write or revoked-session bypass |
| PWA updates / public asset freshness | `sw.js`: install/activate/fetch; UI `checkLumenUpdate` and controller-change reload | Same-origin managed assets bypass HTTP/resource cache; explicit successful Cache API fallback; document version alone does not identify every dependency |
| Canonical campaign resume | `src/campaign/campaign-resume.js`; UI `restoreCanonicalCampaignAttempt`, `resumeCanonicalCampaignBoundary`, `resumeCanonicalVictoryAfterHydration` | Stable-ID attempt restored before `init`; verified hydration resumes the first canonical quest at a completed numeric boundary and rechecks a restored solved board for the same owner/run. Preserve evidence and verify backup on account switch |
| Catalogue compatibility / acquired access | `src/campaign/catalogue-access.js`: `catalogueQuestDecision`; `catalogue-origin.js`: `catalogueOrigin`; `canonical-quests.js`: `canonicalCampaignQuestDecision`; `content/catalogue/access-origins.json` | Frozen origin identities + verified completion → local/global frontier; pack/auth/cloud gates stay separate. Server immutable cohort trigger; see PROGRESSION #470 |
| Historical victory commands | `src/campaign/legacy-victory.js`, `src/persistence/legacy-command.js`; UI `captureLegacyCommandVictory`, `canReplayLegacyOutbox`, `retryPendingLegacyOutboxOnReconnect`; migration `20261018193133_legacy_victory_commands.sql` | Legacy durable namespace → catalogue-derived server effects/receipt/authority → exact receipt/current projection. Queued commands may recover under verified partial hydration without local installation; wallet/daily cutover is prepared in the P0 integration above; read-only `loadCommittedLegacyAttempt` recovers an acknowledged run without recapturing elapsed time |
| Cloud hydration/sync | `src/ui/game-screen.js`: `afterAuthCloudSync` hook, `flushCloudProfile`, `scheduleCloudProfile`, `confirmCloudReward`; `src/persistence/cloud-profile.js`: `loadVerifiedProfile`, `archiveCanonicalStartMetadata`, `reconcileCompatibleCloudProfiles`, `cloudSafelyCoversLocal`, `compareAndSwapCloudProfile`, `CLOUD_PROFILE_FIELDS` | Auth callback → verified snapshot / guarded reconciliation; server profile, not last local write |
| Canonical command receipts | `src/persistence/canonical-command.js`: `canonicalCommandsSupported`, `commitCanonicalCommand`; `supabase/migrations/20261018153436_canonical_command_receipts.sql` | Protocol-1 V2 operation identity → private immutable receipt + existing ledger in one transaction → account-scoped receipt lookup and verified current profile. Additive migration requires separate reviewed application; V1/old servers retain existing ledger |
| Canonical victories/retry | `src/persistence/canonical-progress.js`: `commitCanonicalVictoryViaLedger`, `acknowledgeCanonicalVictory`; `src/persistence/durable-canonical-outbox.js`, `indexed-outbox-store.js`: async V1/V2 intent storage and retry sidecars; `canonical-recovery-errors.js`: structured refusal classification; `canonical-outbox.js`: `replayCanonicalVictoryOutbox`; `cloud-retry-scheduler.js`: bounded retry; UI: `celebrateCanonicalSuccess`, `canReplayCanonicalOutbox`, `retryPendingCanonicalOutboxOnReconnect`, `resumeCanonicalAfterAuthRefresh`, `retryAccountCloudSync` | Stable quest ID → ledger RPC → read-back; immutable per-run evidence, IndexedDB/localStorage, old intents preserved; auth holds require verified session reads, review holds allow independent quests; verified legacy conflict permits session-bound background replay without replacing local progress; see `docs/CLOUD_RECOVERY_391.md` for remaining authority cutover |
| Local/guest/offline | `src/persistence/local.js`: `createLocalPersistence`; `src/game/attempt-engine.js`: `createAttemptEngine`; `src/persistence/guest-transfer.js`: `exportGuestSave`, `importGuestSave`; `sw.js` | Guest `lumenProgressV1`; attempt `lumenActiveAttemptV1`; authenticated local data is cache/staging, not proof of server acknowledgement |
| Auth/account switching | `src/persistence/cloud.js`: `initLumenCloud`, `confirmBrandedAuthLink`, `signIn`, `emailPasswordAuth`, `requestPasswordRecovery`, `setAccountPassword`, `signOut`; UI: `updateAuthUI`, `setupMobileAuth` | Google, email/password, local guest. Auth events precede startup I/O; recovery precedes hydration. OTP login retired; recovery/confirmation retained |
| Auth mail routing | `src/auth/email-brand-routing.js`, `src/auth/email-delivery-plan.js`; `supabase/functions/lumen-auth-mail/index.ts`, `supabase/functions/lumen-soldezen-auth-email/index.ts` | Dedicated mail functions and shared-project isolation; see `docs/AUTH_APP_SEPARATION.md` |
| Badges/replay | `src/campaign/performance.js`: `performanceEligibility`, `performanceAttempt`, `mergeEarnedBadges`, `badgeCooldownRemaining`; `src/campaign/progression.js`: `createCampaign` → `performanceRun`, `savePerformance`; UI: `celebrateSuccess`, `celebrateCanonicalSuccess`, `performanceBadges`, `canonicalPerformanceBadges` | Attempt evidence → eligible single run → awards. Legacy: `performances[index]`; new canonical: `canonicalQuestState[id].badges`. Profile-level `badges` is distinct |
| Progression/access | `src/campaign/content.js`: `CONTENT_PACKS`, `CONTENT_CONSTELLATIONS`, `hasPackAccess`, `preserveStartedAdventureAccess`, `contentMapModel`; `src/campaign/canonical-quests.js`: `canonicalQuestList`, `canonicalNextUnsolved`, `unlockedAdventureProgress`; `src/campaign/playable-navigation.js`: `resolveCanonicalQuest`, `nextCanonicalQuest` | Catalogue owns membership/order; included pack, entitlements or preserved started access own availability. READY alone and challenge play do not grant access |
| Catalogue/rewards | `src/campaign/data.js`, `src/campaign/catalogue.js`, `src/campaign/playable-quests.js`, `src/campaign/generated-rewards.js`, `src/campaign/generated-progression.js`; `content/generated/first-adventure.json`, `content/generated/issue-222-additions.json`, `content/generated/diverse-adventures-3-4.json` | Legacy schedule/audited grids plus generated manifests; `canonical-quests.js` composes stable identities. No fixed total replaces these relationships |
| Social challenges | `src/campaign/social-challenge.js`: `challengeEligibility`, `challengeSnapshot`, `createChallengeClient`; `src/campaign/canonical-challenges.js`: `resolveChallengeQuest`; UI: `bootstrapSocialChallenge`, `finishSocialChallenge` | `?challenge=` → RPCs → isolated challenge attempt; first play only, no campaign grants |
| Daily engagement | `src/campaign/daily-engagement.js`: `grantDaily`, `grantAutonomyMilestone`; `src/persistence/daily-hydration.js`: `reconcileDailyIntoCloudProfile`; `src/persistence/cloud.js`: `cloudMergeDaily`, `cloudSaveDaily` | Daily/engagement reads and profile hydration; independent of social challenge rewards |
| Rules/attempts/learning | `src/game/engine.js`: `createGameEngine`; `src/game/attempt-engine.js`: `createAttemptEngine`; `src/game/learning.js`; `src/ui/tutorial.js` | Live board → rules/proofs → attempt evidence. Campaign reset/replay differs from one-shot social attempts |
| Sky UI/astronomy | `src/ui/sky-navigation.js`: `createSkyNavigation`; `src/ui/astronomical-projection.js`, `src/ui/astronomical-catalogue.js`, `src/ui/astronomical-reference-svg.js` | Content/canonical view → sky rendering; licensed reference geometry |
| Campaign presentation / completion | `src/campaign/canonical-quests.js`: `canonicalScopeProgress`, `canonicalCampaignComplete`, `canonicalQuestMilestone`; UI `renderXP`, `showSkyReveal`, `endgameStats`, `renderSuccessRewards` | Current stable quest membership owns card counts, finale position and nonempty completion; acknowledged badges distinguish prior awards. Historical reward storage is unchanged |
| Analytics/diagnostics | `src/analytics/events.js`: `createAnalytics`; `src/testing/diagnostics.js`: `createDiagnostics`; UI: `recordCloudDiagnostic`, `cloudDiagnosticReport`, `recordCloudHealth`, `showAccountCloudDiagnostic` (account-menu read-only report) | Observations are not authoritative achievements/transactions |

Continue with the matching symptom in `docs/architecture/debugging-guide.md`, then select checks from `docs/architecture/test-map.md`.

Canonical committed-attempt recovery: `src/persistence/canonical-command.js` (`loadCommittedCanonicalAttempt`), `durable-canonical-outbox.js` (`archiveRecreatedCapture`) and UI `celebrateCanonicalSuccess` preserve/recover an exact owner/operation receipt without a second grant; see DATA_AND_ARCHITECTURE.

Queued canonical receipt recovery: UI `recoverQueuedCanonicalReceipt` connects the exact-receipt archive path to hydration/replay for earlier quests; canonical celebration uses `renderSuccessRewards` only after verified completion.
