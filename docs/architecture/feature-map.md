# Feature map

Verified against `bef5f32` (2026-10-18). Paths are repository-relative. This lookup index complements contracts in `docs/AGENT_CONTRACTS.md`, `docs/PROGRESSION.md` and `docs/DATA_AND_ARCHITECTURE.md`. Recheck symbols after relevant changes; historical counts in validation reports are not current catalogue totals.

## Entry points and shape

Operator access/portability: private `lumen_privacy.export_account`, prepared
migration `20261022184145_lumen_account_rights_export.sql`; stable read-only
snapshot, bounded scope, manual review before sharing. Procedure:
`docs/ACCOUNT_RIGHTS_RUNBOOK.md`. Retention decisions proposed separately in
`docs/PRIVACY_RETENTION_PROPOSAL.md`; no new production cleanup enabled.

Privacy entry points: `supprimer-compte.html` prepares a request only;
`mentions-legales.html` and `confidentialite.html` are explicitly unapproved
HTML candidates, linked from `index.html`, using `src/privacy/pages.css` without
SDK/login. Owning legal text: `docs/legal/`; vendor evidence:
`docs/PRIVACY_PROCESSORS.md`. HTML presence does not clear Play readiness.

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
first-play rule and the historical-quest protocol limit to both victory surfaces.
`createSocialChallengeFromSuccess` guards pending creation and reuses that
offer's URL. Adventure focus/scroll lives in `sky-navigation.js` (`revealAdventure`).

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
| Browser dependencies | `src/vendor/`; `content/legal/browser-dependencies.json`; `scripts/browser-dependency-tests.mjs` | Exact local SDK/QR assets and hashes/license copies; no CDN scripts at startup. Updates documented in vendor README; Families review remains open |
| Play preparation / privacy | `src/analytics/events.js`: `analyticsAllowed`; `src/privacy/account-deletion.js`; `supprimer-compte.html`; `scripts/play-readiness.mjs`; `content/legal/publisher.json` | Optional product analytics defaults off; user explicitly sends a prepared deletion-request email. No automatic deletion or Play submission. Evidence and open gates in `docs/PLAY_STORE_READINESS.md` |
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
