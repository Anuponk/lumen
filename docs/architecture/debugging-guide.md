# Progressive diagnosis

Use `docs/architecture/feature-map.md` for ownership and `docs/architecture/test-map.md` for checks. Paths/symbols verified at `bef5f32`. These are investigation routes, not claims that current player bugs reproduce.

1. **Qualify the symptom**: expected/actual behavior, version, stable quest ID and legacy index if any, guest/account, campaign/replay/challenge, device, online/resume/login timing. No credentials or full saves in chat.
2. **Consult the map**: matching feature row only, not every document.
3. **Select probable modules**: name a producer, persistence boundary and consumer. Read relevant `docs/AGENT_CONTRACTS.md` sections and owning product contracts before changing behavior.
4. **Find symbols/references**: scoped `rg -n`, paths via `rg --files`; find implementation before callers. No global content dump.
5. **Read bounded excerpts**. Keep short notes of inspected path/symbol, evidence and hypotheses. Re-read only if code/question changes. Detailed logs stay in temporary files outside tracked sources; display only relevant errors/results.
6. **Inspect recent Git changes**: `git log -5 --oneline -- <path>`, then `git show <sha> -- <path>`. Consult `docs/architecture/bug-history.md` without assuming the same cause.
7. **Confirm root cause** with reproduction, regression or trace linking input → state → boundary → output. Suspicious code/history alone is insufficient; label unresolved hypotheses.
8. **Expand only with evidence**: missing producer → direct importer; RPC error → defining migration; correct saved data/wrong display → renderer; stale device code → version/network/service worker. State the observation that warrants expansion.

## Symptom routes

| Symptom | First files/symbols | Hypotheses / next boundary | Existing checks |
|---|---|---|---|
| Cloud progression diverges | `src/ui/game-screen.js`: `afterAuthCloudSync`, `flushCloudProfile`, `hydrationStage`; `src/persistence/cloud-profile.js`: `reconcileCompatibleCloudProfiles`, `cloudSafelyCoversLocal` | Wrong account/deferred restore, partial daily hydration, stale CAS baseline, conflicting evidence versus mergeable qualification timestamps, quota. Canonical-only missing wins → `src/persistence/canonical-outbox.js` / `src/persistence/canonical-progress.js`; legacy mirror → `src/persistence/cloud.js` | `scripts/performance-qualification-merge-tests.mjs`, `scripts/cloud-reconciliation-matrix-tests.mjs`, `scripts/cloud-hydration-stage-tests.mjs`, `scripts/cloud-local-quota-tests.mjs` |
| Badge not saved | `src/campaign/performance.js`: `performanceEligibility`, `performanceAttempt`, `mergeEarnedBadges`; `src/campaign/progression.js`: `savePerformance`; UI `celebrateSuccess` / `celebrateCanonicalSuccess` | Eligible/qualifying single run? Reset/assistance evidence? Inspect `performances[index].badges` versus `canonicalQuestState[id].badges`. Local yes/cloud no → read-back, pending intent, ledger replay migration; `solved` alone is insufficient. Cloud yes/display no → UI `performanceBadges` / `canonicalPerformanceBadges` | `scripts/performance-badge-tests.mjs`, `scripts/hint-assistance-badge-regression-tests.mjs`, `scripts/canonical-ledger-client-tests.mjs`, `scripts/canonical-ambiguous-ack-tests.mjs` |
| Adventure incorrectly locked | `src/campaign/content.js`: `hasPackAccess`, `preserveStartedAdventureAccess`, `contentAccessForLegacyQuest`; `src/campaign/canonical-quests.js`: `unlockedAdventureProgress`; `src/campaign/playable-navigation.js`: `resolveCanonicalQuest` | Included/entitled/actually started? READY boundary and social play do not grant access. Verify `legacyAdventureAccess`, restored entitlements and quest/pack membership. Correct access/stale sky → UI `refreshJourney` / `renderMap`, `src/ui/sky-navigation.js`. Do not invent an unlock mechanism | `scripts/content-architecture-tests.mjs`, `scripts/unlocked-adventure-progress.test.mjs`, `scripts/playable-navigation.test.mjs`, `scripts/sky-navigation-tests.mjs` |
| Login succeeds, progress locked | `src/persistence/cloud.js`: `initLumenCloud`, revision/account guards; UI `afterAuthCloudSync`, `updateAuthUI` | Auth success differs from profile/daily restore success and recovery-password hold. Google/password supported; old OTP login intentionally retired. Verify app version first | `scripts/account-email-login-tests.mjs`, `scripts/cloud-client-session-tests.mjs`, `scripts/oauth-return.test.mjs`, `scripts/first-login-cloud-restore-tests.mjs` |
| Offline victory missing after resume | UI `retryPendingCanonicalOutboxOnReconnect`, `retryPendingCloudWriteOnReconnect`, `preserveUnsyncedCloudProgress`; `src/persistence/canonical-outbox.js`; `src/game/attempt-engine.js` | Not persisted versus not acknowledged; changed account; quota; missing online event on PWA resume. Cold launch failure → separate `sw.js` route: no navigation fallback | `scripts/canonical-outbox-tests.mjs`, `scripts/canonical-outbox-multi-device-tests.mjs`, `scripts/cloud-resume-retry-tests.mjs`, `scripts/cloud-online-retry-tests.mjs` |
| Challenge mutates campaign/loses attempt | UI `bootstrapSocialChallenge`, `finishSocialChallenge`, `celebrateSuccess`; `src/campaign/social-challenge.js`; `src/game/attempt-engine.js` | Wrong mode/identity/victory branch. Inspect `src/campaign/canonical-challenges.js` for quest resolution before server RPC definitions | `scripts/social-challenge-tests.mjs`, `scripts/social-challenge-ui-tests.mjs`, `scripts/attempt-engine-tests.mjs`, `scripts/issue-222-challenge-tests.mjs` |

## Useful bounded evidence

- **Copier le diagnostic** uses UI `cloudDiagnosticReport`; console prefix `[Lumen cloud diagnostic]`. `lumenCloudDiagnosticsV1` retains at most 40 events; `lumenCloudHealthV1` holds aggregates. These internal functions are not methods on `window.lumenDiagnostics`.
- Select nearby events: `auth_state_changed`, `hydration_reconciliation` (result/reason/conflict keys), `hydration_failed` (stage), `hydration_ready`, `flush_conflict`, `flush_failed`, `legacy_mirror_failed`, `canonical_outbox_pending`, `canonical_outbox_reconnect_failed`. Report event/stage/reason/error code, not full history.
- Network: RPC name, status/error code, timing and whether verified read-back followed. `lumen_record_sync_health` is an incident signal, not save proof. Never copy JWTs or full profile bodies.
- `window.lumenDiagnostics.snapshot()` exposes live board/progress; `skySnapshot()` exposes navigation. Inspect only required fields locally. `setupQuest`, `setBoard`, `refreshSky`, `runAllHintTests` can mutate state: use isolated QA/guest profiles, never an affected player's session.
- Preserve divergent saves; do not clear storage, run production SQL fixtures or automatically repair real players. Recovery safeguards: `docs/DATA_AND_ARCHITECTURE.md`.

Example searches from repository root:

```powershell
rg -n 'reconcileCompatibleCloudProfiles|cloudSafelyCoversLocal' src/persistence/cloud-profile.js
rg -n 'celebrateCanonicalSuccess|commitCanonicalVictory|canonicalPerformanceBadges' src/ui/game-screen.js
rg -n 'hasPackAccess|preserveStartedAdventureAccess' src/campaign/content.js
git log -5 --oneline -- src/persistence/cloud-profile.js
```

## Phase 1 localization validation

The three requested routes were walked by symbol/reference inspection: divergence → UI hydration → reconciliation/CAS; missing badge → eligibility/run → legacy performance or canonical ledger/read-back; locked adventure → pack access → canonical navigation → sky refresh. Referenced paths, symbols and checks were located. This verifies discoverability, not reproduction/correction of current player bugs. Runtime/live-device limits are recorded in `docs/architecture/test-map.md`.
