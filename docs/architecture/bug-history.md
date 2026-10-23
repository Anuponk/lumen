# Verified historical causes

Small, evidence-based register, verified from Git diffs at `bef5f32`. These are historical fixes, not diagnoses of current player incidents. Add an entry only with a concrete causal diff/reproduction and a GitHub reference; do not infer causes from issue titles. Tests below exist; execution status belongs to the PR/report that ran them.

| Symptom | Confirmed cause / fix evidence | Module | GitHub reference | Associated existing test |
|---|---|---|---|---|
| Valid taps disappear briefly after guided correction | On `cf9ec95`, correcting the offending Guardian sets a board-wide 700 ms click guard. Native touch RED leaves the next unrelated cell at 0 instead of 1; gesture-scoped compatibility-click suppression makes that same test GREEN. This confirms one path, not all behavior on Rachel's physical Android | `game-screen.js`, `gesture-click-suppression.js` | [Issue #548](https://github.com/Anuponk/lumen/issues/548), #531 | `guided-undo-browser.mjs`, `touch-input-browser.mjs` |
| Storage refusal claims the whole device is full; historical local backups have no maintenance path | On `f47d899`, the actual status formatter claims device saturation without a disk measurement. Diagnostics already rotate at 40 entries, while distinct recovery/checkpoint originals accumulate. Aggregate inventory and explicit committed/read-back archival retain recent local copies and all original evidence; no physical-device cause is inferred | `storage-maintenance.js`, account diagnostic/maintenance/export in `game-screen.js` | Follow-up to #536/#391 and PR #543 | `storage-maintenance-tests.mjs`, account browser touch flow, native quota fixture |
| Achievement restore refuses a full backup even when the updated cache fits | On `ec0a215`, synthetic backup-only quota fails before installation; the synchronous path has no alternate backup store. Durable recovery reuses the same achievement planner and the existing verified IndexedDB snapshot fallback. Full storage and wallet/reward conflicts remain holds; the affected phone is not verified | `cloud-profile.js`, hydration/export in `game-screen.js` | [Issue #536](https://github.com/Anuponk/lumen/issues/536), #537/#391 | `cloud-achievements-quota-recovery-tests.mjs`, `quota-recovery-browser.mjs` |
| Completed canonical card loses its completion label during a sync hold | RED actual-renderer tests show title/aria overwritten by the sync reason and catalogue history styled `done locked`. Keep completion alongside the reason and show a visible detail explanation; replay authorization remains unchanged. Loutre's real profile state is unproven | `game-screen.js` | [Issue #537](https://github.com/Anuponk/lumen/issues/537), #470/#391/#536 | `campaign-presentation-tests.mjs`, `catalogue-access-tests.mjs`, `completed-quest-hold-browser.mjs` |
| Known wallet refusal becomes generic; obsolete hydration reports after final mirror await | RED production-hook fixtures prove a discarded wallet reason and four late account/client mirror continuations. Retain classified refusal and recheck captured session after await; reward guards remain unchanged. Rachel's precise reward divergence is still unproven | `cloud-profile.js`, `game-screen.js` | [Issue #536](https://github.com/Anuponk/lumen/issues/536), #391/#530 | `cloud-achievements-session-recovery-tests.mjs`, `cloud-hydration-mirror-session-tests.mjs`; [report](../validation/2026-10-23-hydration-536.md) |
| Canonical badge replay blocks coverage/partial recovery after session restoration | Two red tests on `d5d7484`: exact canonical entry equality rejected a server badge addition despite identical stars/performance. Recognized badge superset coverage removes that false conflict; mutable wallet and contradictory evidence still hold. This does not diagnose the affected phone's unknown profiles | `cloud-profile.js`, hydration/status in `game-screen.js` | [Issue #530](https://github.com/Anuponk/lumen/issues/530) | `cloud-achievements-session-recovery-tests.mjs`, `cloud-diagnostics-tests.mjs`; [report](../validation/2026-10-22-achievement-recovery-530.md) |
| Real stars or quest marks missing from mobile detail; generated detail shows no drawing | Browser reproduced detail SVG below the viewport at 320x568 because its mobile height/flex basis was fixed to 190px. Generated entries also took the text-summary branch despite having a verified atlas. Responsive detail fitting and the common verified drawing fix these two presentation paths; all 88 source figures already matched | `styles.css`, `game-screen.js` | [Issue #508](https://github.com/Anuponk/lumen/issues/508), [Issue #504](https://github.com/Anuponk/lumen/issues/504) | `astronomical-rendering-browser.mjs`, `astronomical-fidelity-tests.mjs` |
| Badges label clipped on small Mon ciel cards | Fixed-height drawing consumed text space; actual text-range regression reproduced 7px overflow. Grid reserves all three text rows first, with compact gaps on short screens | `src/ui/styles.css` | [Issue #475](https://github.com/Anuponk/lumen/issues/475) | `sky-navigation-browser-tests.mjs` |
| Bouvier finale actions below the viewport | Existing board budgets omitted visible finale copy and wrapped action height. Browser reproduced buttons below 568px; measured banner/complete stack fitting includes safe-area changes | `game-screen.js`, `styles.css` | [Issue #315](https://github.com/Anuponk/lumen/issues/315) | `finale-responsive-browser.mjs` |
| A quest success can add no new astronomical point; detail total differs from overview | Legacy detail used 9 slots where canonical overview has 10. Canonical detail fixes the count; #512 gold counters were later rejected. The accepted #504 presentation lights real stars first and adds only the shortfall as unlinked secondary lights; large figures have no decoration | `astronomical-reference-svg.js`, `quest-secondary-stars.js`, `sky-navigation.js`, `game-screen.js` | [Issue #504](https://github.com/Anuponk/lumen/issues/504) | `quest-secondary-stars-tests.mjs`, sky-navigation browser |
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


## Canonical constellation detail bypasses normal formatting (`bca5ef3` follow-up)

Hiding the dormant Grand Chien panels exposed the separate unstyled canonical
list. It lacked the normal two-row quest grid, earned badge slots, badge legend
and constellation card. A browser regression fails against that release.
Remove the parallel list renderer: the game screen resolves the selected stable
constellation ID into the existing card renderer, preserving availability,
replay and launch behavior. Canonical-only star cards use the licensed atlas and
completed canonical quests; the legacy cooldown timer must skip those cards.
Mobile/desktop tests compare geometry against Grand Chien and verify live earned
badges after a timer tick without changing the active attempt. Desktop card width
is capped because visual inspection also found the shared layout clipped the star
card. Screenshots are inspected locally; no production player save is used.
Onboarding impact: the same quest, badge and sky panels remain the tutorial's
existing targets. No rule, unlock, reward or gesture changes.

CI also exposed a fixture race after account switch: signed-in controls can appear
before profile readiness. The scenario now awaits the explicit synchronized
verdict before selecting a canonical quest, retaining the access checks.


## End-of-grid save retry reuses a blocked baseline (`0a8076e` follow-up)

The pending historical-victory button called the victory coordinator again,
whereas the account menu resumed durable queues and requested fresh hydration.
A not-ready or stale baseline therefore remained blocked through the board
button. Two new client regressions fail against the pre-fix coordinator. Route
only a confirmed durable capture through the account retry path, with owner,
client and frozen attempt/reset guards; retain local-capture retry otherwise.
The browser regression checks exact operation facts and one additional receipt
across reload on mobile and desktop. Its fixture must preserve simulated server
receipts across reload and use the actually accessible quest, keeping existing
partial-recovery and access assertions. No SQL/profile schema or reward rule
changes; unknown/divergent progress remains protected.
Onboarding impact: no new terminology, gesture, destination or badge rule; the
existing save-retry action now uses the account menu's recovery mechanism.


Validation also reproduced a pre-existing 3px app overflow at 375x667 against
both `0a8076e` and the retry change. The existing small-portrait board reservation
left insufficient space for the full stack and bottom inset. Increase that
reservation by 8px without reducing action fonts or touch controls; retain the
same seven-viewport, square-grid, tap/drag and overflow assertions. Overflow
failures now include control bounds for diagnosis. UX contract reviewed: no
onboarding, gesture, eligibility or navigation change.

## Canonical cards, finale and prior badges (`7a9220e` follow-up)

Four UI regressions reproduce against the parent: canonical-only sky cards read
zero historical lit slots and no drawing count; Grand Chien's old numeric final
is only 8/10 in its expanded constellation; the numeric endpoint can announce
global completion while canonical quests remain unplayed; the victory panel
omits an acknowledged Rapidité when it was already held before the attempt.
`campaign-presentation-tests.mjs` runs those actual adapters/renderers red before
the correction. Canonical stable membership now owns presentation totals,
milestone position and nonempty completion. Prior awards remain visible with an
explicit label, without changing same-run qualification or reward persistence.

Antlia being playable with unfinished preceding additions is not itself a bug:
the acquired-access contract preserves a historical frontier. The real-catalogue
access regression checks that case and the distinct current-cohort refusal,
including serialization and unchanged rewards. Device-specific recovery remains
separate from these synthetic/browser proofs. The prepared cohort migration
`20261018200805_catalogue_origin_access.sql` is a separate server release step;
its presence in Git is not deployment evidence.


## Victory challenges and mobile Adventure rail (#511/#514, baseline `af596de`)

Canonical-only victories explicitly hid sharing while the existing social RPC
only supports historical numeric identities. The agreed scope preserves that
limit and displays a disabled action plus its reason. A real browser assertion
failed before the explanation was added. Historical first victories remain
eligible with or without Mastery; Mastery only changes emphasis. A solved old
quest with no performance metadata reproduced a false first-play classification:
completion evidence now excludes that replay. The six-case real-renderer matrix
and mobile/desktop challenge flow protect eligibility, exact grid identity,
single pending creation, URL reuse and unchanged confirmed rewards.
A further mobile/desktop reproduction showed that the unified Share handler
consumed a pending Adventure completion before opening sharing. Sharing now
opens above the victory without routing away; Next still presents the pending
Adventure celebration after the sharing dialog is closed.

The Adventure renderer replaced its buttons on each selection, losing keyboard
focus; preserving only scrollLeft also left a selected partial chip clipped. The
new browser regression failed on focus retention before correction. Rendering
now restores focus and reveals the selected chip within the rail. Focus movement
also reveals chips; Arrow/Home/End handling follows direction and long labels
wrap. Rail gestures remain separate from constellation pagination and page scroll.

Antlia (#513) is already drawn by #517: `renderMap` delegates every verified
figure, including generated entries, to the common astronomical SVG. Its two
HIP points and one segment are authentic. Empty, partial (seven) and complete
fixtures for Antlia, Delphinus and Orion preserve source geometry and all earned
lights; no extra astronomical points or save repair is needed. The partial
Antlia screenshot is distinct from the prior all-complete atlas audit.

The user confirmed the affected-phone Grand Chien/Dauphin start/reload recipe
for #470 on 22 October 2026. That is user-reported physical validation; the
phone's version was not supplied. Automated access/resume fixtures remain
separate evidence. No player save, entitlement, migration or storage purge is
part of this follow-up.
