# Dependencies and data flow

Guided correction: pointerdown on incorrect Guardian → existing correction and
save → suppress that gesture's compatibility click → next pointerdown releases
suppression immediately. Shared helper also owns long-hold click suppression.

Guardian hold: touch pointer → 500 ms recogniser / movement cancellation → live
cell/attempt/learning guards → normal cell action → existing history, mistake,
assistance and persistence. Pointer identity suppresses a release retargeted to
the pause mask. Moving hands off to exclusion drag; mouse/keyboard keep clicks.

Phase-2 investigation: existing admin capability/RPC → closed timeline projection
→ session/trace episodes → observed transitions, bounded detail alerts, reviewed
report/GitHub composer. Account/client/capability guard rejects stale results and
actions. Export never depends on accounts/profiles or live gameplay objects.

Optional diagnostics (#534): guarded capture → separate bounded queue → Auth and
closed-schema batch → consent-locked private details → existing cockpit guard.
The existing operator cron prunes bounded details/budgets/resolved old health.
No save/receipt/profile dependency or competing live incident/alert algorithm.

Storage maintenance: account diagnostic → aggregate local/IndexedDB/browser
inventory; explicit maintenance → retain recent copies → exact original in
existing IndexedDB recovery store → committed read-back + session/source recheck
→ local removal. Export includes the archive. No profile/RPC/reward mutation.

Achievement backup quota (#536): verified server achievements + unchanged local
profile → shared recovery planner → verified localStorage or IndexedDB original
→ session/owner/local-byte recheck → achievement-only cache installation.
Explicit recovery export reads both IndexedDB snapshot stores. Wallet and full
hydration holds retain their existing authority and release conditions.

Completed quest presentation (#537): confirmed progress + existing availability
decision → completed card/history + explicit replay hold. Renderers never write
the profile or change catalogue, pack, Auth or hydration guards.

Hydration #536: selected verified snapshot → existing reconciliation refusal →
classified wallet/reward/storage diagnostic and safe hold. Final mirror result →
account/client recheck → current-session presentation only. Diagnostic formatting
never supplies proof for a reward merge or wallet acknowledgement.

Session recovery #530: verified server profile → canonical badge coverage →
safe local install or protected partial recovery. Unconfirmed wallet/canonical
operations stay in their durable stores. Classified local failure → account
status and existing `hydration_reconciliation` telemetry (fixed reason only).
No new RPC, Auth configuration or persisted profile field.

Baseline: `bef5f32`. Paths are repository-relative. Consult relevant rows only. `docs/DATA_AND_ARCHITECTURE.md` owns contracts; this file identifies implemented boundaries and effects.

Published schedule (#522): current `access-origins.json` revision →
`catalogue-origin.publishedCatalogueQuests` → `quest-definition.buildQuestDefinitions`
→ canonical grid adapter. Active quest + existing progress →
`quest-view.readQuestView` → board label / attempt telemetry / stable-ID map badge refresh. These reads neither
grant access nor migrate saved rewards; old writers remain in their own domains.

| Boundary | Dependencies / flow | Effects / caution |
|---|---|---|
| P0 commands / presentation | Wallet durable intent → expected-account RPC → immutable receipt → account-bound current profile → verified cache → acknowledgement; victory intents → ephemeral `pending-navigation.js` view | Wallet, Canonical and Legacy namespaces remain isolated. Snapshot guards preserve server currency authority; pending navigation cannot serialize rewards. `sync-presentation.js` defers recoverable warnings during celebration; `outbox-health.js` emits bounded private counts, never save payloads |
| Catalogue origin / acquired access | Immutable `content/catalogue/access-origins.json` → `catalogue-origin.js` / `catalogue-access.js` → canonical adapter → map/start/navigation; local creation + guarded profile JSON | Pack ownership remains independent. Server cohort cannot be deleted/relabelled; explicit conflicts hold. Origin metadata never awards completion, changes attempts or invokes reward RPCs |
| Historical command | UI `captureLegacyCommandVictory` → Legacy durable outbox → `legacy-command.js` → locked profile, private rules/receipt/authority and existing daily/mirror RPCs | First accepted command protects legacy reward projection/revision against old snapshots. Guests/explicitly older unmigrated servers use `legacy-victory.js`; no ambiguous fallback |
| Bootstrap | `index.html` → `src/main.js` → `src/ui/game-screen.js` → injected factories | UI owns live progress/board; async callbacks must read current account/model |
| Auth | `src/persistence/cloud.js` → `src/persistence/config.js` + CDN Supabase client; `initLumenCloud` subscribes before confirmation / `getSession` | User, entitlements and capabilities change; deferred restore checks identity. Logout uses local scope. Mail functions are separate from progression RPCs |
| Catalogue | `src/campaign/data.js` / `src/campaign/catalogue.js` + generated JSON → `src/campaign/playable-quests.js` → `src/campaign/canonical-quests.js`; `src/campaign/content.js` supplies packs/access | Distinguish zero-based legacy index, one-based ordinal/RPC puzzle ID and stable canonical ID. `legacyIndex === null` identifies new canonical content |
| Campaign presentation | Canonical membership + existing legacy/canonical completion and badge records → `canonicalScopeProgress`, `canonicalCampaignComplete`, `canonicalQuestMilestone` → sky cards, banners and victory/endgame UI | Read-only projection; astronomical geometry never supplies a quest total. Historical reward calculations and saved balances remain unchanged |
| Access/UI | `src/campaign/content.js`: `hasPackAccess` → `contentMapModel`; `src/campaign/canonical-quests.js`: `unlockedAdventureProgress`; `src/campaign/playable-navigation.js` → UI / `src/ui/sky-navigation.js` | Entitlements, solved membership, started non-challenge attempt and `legacyAdventureAccess` affect access. `sky-navigation.selectedConstellation()` supplies the stable viewed ID to the shared game-screen quest-card renderer. Browsing cannot mutate progress; visible totals include accessible adventures |
| Legacy win | `src/game/engine.js` + `src/game/attempt-engine.js` → UI `celebrateSuccess` → `src/campaign/progression.js` / `src/campaign/performance.js` → local save + scheduled snapshot flush/mirror | Completion, performance, currency and daily effects share orchestration. `cloudSavePuzzle` / `verifyLegacyProgressMirror` in `src/persistence/cloud.js` use numeric legacy RPCs |
| Canonical win | `canonical-command.js`: `loadCommittedCanonicalAttempt` reads an exact receipt/current projection; durable outbox `archiveRecreatedCapture` preserves recognized regenerated evidence before retirement. Verified hydration wakes the same-owner/run validator via UI `resumeCanonicalVictoryAfterHydration`; UI `celebrateCanonicalSuccess` → `src/persistence/canonical-outbox.js` → `commitCanonicalVictoryViaLedger` in `src/persistence/canonical-progress.js` → `lumen_commit_canonical_victory` → `loadVerifiedProfile` | Intent before network; requested badges must be present on read-back before acknowledgement. Retain intent on ambiguous failure; install acknowledged profile, never send canonical IDs as legacy puzzle numbers |
| Ledger | `supabase/migrations/20261015_canonical_reward_ledger.sql` + `supabase/migrations/20261017033619_canonical_replay_badges.sql` | Allowlist and `lumen.canonical_reward_events` govern canonical grants; replay upgrades badges without duplicate first rewards. Migration presence does not prove live deployment |
| Command receipts | V2 outbox/gameplay ID → `canonical-progress.js` → `canonical-command.js` → read-only capability → `lumen_commit_canonical_command` → private `lumen_commands` receipt + existing ledger → receipt lookup and current profile read-back | Same account/profile lock; exact evidence required for reused ID; no fallback after ambiguous command; auth/attempt rechecked after capability await. V1/verified old-server compatibility retained, production migration is separate |
| Full profile | UI `afterAuthCloudSync` / `flushCloudProfile` → `src/persistence/cloud-profile.js` → restore, backup, CAS, read-back | Baseline/dirty/ready flags gate writes; preserve both sides before installation. `reconcileCompatibleCloudProfiles` uses a legacy player-favourable max for `shards`, `xp`, `skyScore`: an approximation, not a transaction ledger or purchase rule |
| Snapshot protection | `supabase/migrations/20261010_lumen_cloud_first_cas.sql`, `supabase/migrations/20261017180841_protect_canonical_snapshot.sql` → `lumen.profile_snapshots` | CAS rejects changed baseline; trigger rejects destructive canonical replacement via backup/CAS. Spends/revocations are distinct from monotonic achievements |
| Local recovery | `src/persistence/local.js`, `src/persistence/cloud-profile.js`, UI `preserveUnsyncedCloudProgress` / `exportLumenRecoveryBundle` | `lumenProgressV1`, recovery keys, `lumenUnsyncedCloudBackupV1:` / `lumenUnsyncedCloudBackupV2:`; quota fallback to IndexedDB `lumen-unsynced-checkpoints`. Exports contain sensitive saves: keep out of chat/logs |
| Reconnect/resume | UI `retryPendingCloudWriteOnReconnect`, `retryPendingCanonicalOutboxOnReconnect`; online/focus/visible-page handlers | Snapshot retry and account-scoped replay are separate. `lumenCanonicalVictoryOutboxV1:` intents persist until acknowledgement; never replay another account's intent |
| PWA | `sw.js`: network-only navigation (`cache: no-store`), other GETs network-first/cache fallback | Install caches manifest/icons, not a complete offline app. Open-board persistence does not prove cold offline navigation; external Supabase/font dependencies remain relevant |
| Challenges | URL → UI `bootstrapSocialChallenge` → `src/campaign/canonical-challenges.js` → `src/campaign/social-challenge.js` RPCs → `src/game/attempt-engine.js` | Separate completion path; one attempt with resume; no campaign badges/stars/daily/unlocks. Hide reference until terminal state |
| Daily | `src/persistence/cloud.js` daily/engagement RPCs → `src/persistence/daily-hydration.js` → profile hydration | Daily read failure can block hydration even when primary profile loaded; inspect stage first |
| Observability | UI `recordCloudDiagnostic` → bounded history, health counters, `lumen_record_sync_health`; `src/analytics/events.js` is separate | Independent best-effort channels, not acknowledgement. Server incidents: `supabase/migrations/20261017181513_sync_health_incident_tracking.sql` |

Legacy/canonical coexistence and conservative recovery do not mean every reward already has server transaction authority. Read the cloud contract before changing either path.


Historical counter-only snapshot updates use the existing profile/CAS boundary
and private authority trigger; `20261020084328_legacy_attempt_counter_metadata.sql`
allows monotonic attempts while retaining exact command-owned reward evidence.
The owning compatibility/rollback contract is DATA_AND_ARCHITECTURE, with
client/SQL/concurrency coverage in TESTING. No new public RPC or writer exists.


Canonical start-state isolation: the UI passes the registered same-owner active
canonical attempt and verified cloud profile to `archiveCanonicalStartMetadata`
in cloud-profile.js. Exact cooldown-only numeric pollution is archived in the
existing recovery stores before a single reload; uncertain/earned data is never
removed. The real start renderer and victory capture share the active stable
quest; the dormant numeric index must not supply canonical start-performance
or finale identity.
