# Verified historical causes

Small, evidence-based register, verified from Git diffs at `bef5f32`. These are historical fixes, not diagnoses of current player incidents. Add an entry only with a concrete causal diff/reproduction and a GitHub reference; do not infer causes from issue titles. Tests below exist; execution status belongs to the PR/report that ran them.

| Symptom | Confirmed cause / fix evidence | Module | GitHub reference | Associated existing test |
|---|---|---|---|---|
| Entirely new constellations locked in a historically completed adventure | Catch-up required local legacy quests, so an empty historical group always failed; earlier additions held the global frontier. The A/B regression failed before correction. Frozen catalogue origins distinguish old acquired access from normal new-player sequencing | `catalogue-access.js`, `catalogue-origin.js`, canonical adapter and UI | [Issue #470](https://github.com/Anuponk/lumen/issues/470) | `scripts/catalogue-access-tests.mjs`, `scripts/catalogue-compatibility-tests.mjs`, historical scenario in `scripts/canonical-replay-browser-tests.mjs` |
| Compatible device profiles blocked on performance qualification metadata | Qualification timestamps/day were compared like immutable reward/run evidence. Diff introduces deterministic latest-valid qualification merge and checks that remote coverage retains it; balances and earned awards are not replayed | `src/persistence/cloud-profile.js`: `mergeQualificationMetadata`, `reconcileCompatibleCloudProfiles`, `cloudSafelyCoversLocal` | [PR #465](https://github.com/Anuponk/lumen/pull/465), [causal diff 41edffe](https://github.com/Anuponk/lumen/commit/41edffe35c092aec4ca9b6583151c6bdf9aef16e) | `scripts/performance-qualification-merge-tests.mjs` |
| Canonical replay badge could be treated as saved despite absent requested badges | Ledger transport accepted a read-back containing `solved` alone, including after ambiguous RPC failure. Diff requires all earned badges on both acknowledgement paths; replay SQL/client coverage protects badge upgrades without duplicating first-completion rewards | `src/persistence/canonical-progress.js`: `commitCanonicalVictoryViaLedger`; `supabase/migrations/20261017033619_canonical_replay_badges.sql` | [Issue #453](https://github.com/Anuponk/lumen/issues/453), [causal diff 7614980](https://github.com/Anuponk/lumen/commit/7614980a8e93fc5561a6f305d7d51572bf623bc7) | `scripts/canonical-ledger-client-tests.mjs`, `scripts/fixtures/canonical-ledger-replay.sql` |
| Victory progress denominator included inaccessible adventures | Prior campaign view lacked a filtered accessible-progress projection. Diff adds `unlockedAdventureProgress`, filtering packs via `hasPackAccess` and counting distinct solved legacy/canonical quests within them | `src/campaign/canonical-quests.js`: `unlockedAdventureProgress` | [PR #362](https://github.com/Anuponk/lumen/pull/362), [causal diff d2b70d3](https://github.com/Anuponk/lumen/commit/d2b70d31fcfd9821917abf6356fb7f30ddbbba7e) | `scripts/unlocked-adventure-progress.test.mjs` (current baseline failure detailed in `docs/architecture/test-map.md`) |

For a different locked-content symptom, use the access route in `docs/architecture/debugging-guide.md` and confirm evidence before applying the same diagnosis.


Canonical start isolation, reproduced against `d10d410`: `ensureAttemptStarted`
stamped a cooldown-only numeric performance while a new stable-ID board was
active, and `renderXP` rendered the dormant legacy finale. Exact metadata-only
archival preserves both originals and the current attempt; new canonical starts
and banners stay isolated. A separate real-render regression reproduces duplicate
async victory capture with differing elapsed time. `campaign-resume-tests.mjs`,
`canonical-outbox-recovery-tests.mjs` and the authenticated Dauphin browser flow
cover prevention, conservative local recovery and one acknowledged grant. This
is not blanket repair of unknown reward conflicts or proof of live-phone recovery.

## Solved canonical board renders before Auth (`63939b8` follow-up)

Phone build 476 showed `canonical_start_metadata_archived`, `hydration_ready`
and `flush_success`, but a restored solved board produced
`canonical_victory_failed` at `context` before every INITIAL_SESSION.
The renderer tried to capture while `lumenUser` was still null; verified
hydration never retriggered the board validator. VM regression reproduces the
false capture failure; the mobile browser fixture covers a solved board cold
reload with delayed Auth and a single acknowledged grant. Defer the premature
capture, then wake the ordinary validator after full hydration with exact
owner/client/quest/attempt/reset guards. Preserve the board, attempt, outbox
and all reward authority. Live phone confirmation remains outstanding.

## Already committed canonical attempt recreated (`a007a70` follow-up)

Build 477 resumed the solved board after hydration but failed at `command`.
Read-only production checks found the original Dauphin receipt and one reward
event, saved completion and all requested badges. Bounded PostgreSQL logs for
the reported interval contained `operation evidence changed`. The completed
board had outlived local acknowledgement and recreated that operation with a
later elapsed time. Preserve immutable server rejection; recover the exact
receipt plus current projection before another command, and archive only the
strictly recognized later capture before retiring it. Node/browser regressions
retain refusal of better timing/new badges/unknown evidence and verify one grant.
No production player data was modified during investigation or correction.

## Previous-quest pending notice and hidden canonical rewards (`6b765bd`)

Build 479 diagnostic showed healthy profile flushes but one persistent canonical
outbox entry; the player had advanced into Dauphin. Exact-receipt recovery was
only wired to celebration of the active quest; queued replay skipped every
review hold. Regression reproduces a previous-quest `22023` hold and adds the
existing proof/archive path to startup/replay without another command or board
mutation. Other holds and unproven evidence remain. Independently, canonical
celebration explicitly hid `successRewards`; its browser visibility regression
fails before the fix. Reuse the animated reward renderer with confirmed badges
and the pre-operation owned badges. No eligibility, reward rule or SQL change.

## Healthy sync hidden by nickname (`9efabe0` follow-up)

The phone showed only the nickname above a permanently available diagnostic
with historical events. The healthy branch used nickname OR sync verdict.
A regression on the real menu renderer fails for a healthy named account.
Keep the nickname plus an explicit success verdict, guard busy/dirty/offline/
failure/pending states, and mirror current status into an accessible diagnostic
summary with historical-log explanation. No auth/persistence/reward rule changes.


## Dauphin detail also displays Grand Chien (`7541836` follow-up)

The authenticated mobile browser regression reproduces Mon ciel -> Dauphin:
all three legacy detail panels still have rendered rectangles despite `hidden`.
Their author-level grid/flex CSS overrides the browser hidden default, so the
old Grand Chien cards and stars appear alongside the canonical quest list.
Enforce hidden direct children within map detail. The regression checks actual
visibility, exact canonical membership, refresh, overview, return to Grand Chien,
and unchanged board/progression/attempt. No quest identity, reward or save changes.
Onboarding impact: no new destination or gesture; the existing Mon ciel tour
and legacy badge/star panels remain visible for their intended constellation.
