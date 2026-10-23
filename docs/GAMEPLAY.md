# Gameplay and UX specification

## Uniform quest contract (#522, convergence candidate)

Every quest uses its visible catalogue ordinal for teaching and assistance,
independently of its saved numeric key. All four badges are eligible from quest 1.
`PERFORMANCE_UNLOCKS` owns the explanations of Rapidité at quest 3 and the
four-badge system at quest 6; `questLearningRules` drives those introductions
without delaying eligibility. Assistance stays forced through 5, optional through
10; autonomous play is introduced at 11. Hints remain free through 10.

Qualified badge runs share a fifteen-minute cooldown. Replays preserve acquired
badges and first-win stars; Maîtrise is earned on one run, never accumulated.
First victories earn 10 XP plus 5 XP without a hint, even if another assistance
was used. Every third autonomous first victory earns one Éclat. Bonus quests
retain their 25 XP / one Éclat one-time award; a previously unclaimed bonus may
be earned by an actual successful replay. Stable-only bonus identities derive
from the quest ID, with cadence based on visible order. Historical bonus IDs
and star allocations stay frozen. New constellation allocations derive from
their real positions/count, including intermediate and final rewards.

At quest 6, the timed bonus permits the newly introduced optional Marquage auto;
it must not contradict that comfort introduction. Effective assistance still
removes Autonomie and therefore Maîtrise. No-hint XP and badge autonomy are
different conditions. Reload retains a hint already used in the same attempt.

Daily qualification and first-play social eligibility apply to both saved quest
formats. An unqualified run cannot become a remarkable social performance.
Previously acquired rewards are preserved, with no loading/migration backfill.
Authenticated awards require the server receipt described in
[DATA_AND_ARCHITECTURE](DATA_AND_ARCHITECTURE.md#quest-convergence-candidate-522-22-october-2026).

## Core rules
For an N x N puzzle:
- exactly N Guardians;
- one Guardian per row;
- one Guardian per column;
- one Guardian per territory;
- no two Guardians adjacent horizontally, vertically or diagonally.

The stored board uses three user-visible states: empty, excluded, Guardian. Interaction order is **empty -> excluded -> Guardian -> empty**.

Correcting the offending Guardian in guided mode consumes only that correction
gesture. The next separate tap is immediately available, without a global delay.

A wrong intermediate Guardian is allowed to exist long enough for the player to reason/correct it. Guided assistance may explain a direct row/column/territory/touch conflict or a dead end, but the first tap is an exclusion and must not be treated as an attempted Guardian.

The tap handler checks guided Guardian conflicts on the second tap, when the next state is Guardian. Rejecting the intermediate exclusion on a required solution cell would make the two-tap placement cycle impossible. The engine can still diagnose an exclusion dead end, and Verify/hints can explain an incorrect exclusion; that diagnostic must not block the first half of a tap placement.

## Completion
There is no separate Validate action. Reaching N Guardians triggers evaluation. A correct set of Guardians wins even if unrelated exclusion marks remain. An invalid complete placement must not count as a mistake merely because it temporarily contains N Guardians.

## Learning curve
- Quest 1: first observe the five temporarily numbered territories and read the six SEE -> UNDERSTAND introduction steps, then play the normal board with a contextual coach. Intro navigation leaves the board untouched and numbers disappear before ACT. Only the expected cell actions are allowed during guided steps; unrelated taps are ignored without errors or starting the attempt. Help, pause, account and reset remain available.
- Quest 2: guide the first Guardian in the singleton territory, then require a real held mouse/touch drag across the remaining first-row cells. Taps cannot skip this gesture lesson. Partial drags persist and may be resumed, including from an already excluded cell; the Guardian and cells outside the row remain protected throughout the gesture. Once the row is excluded, release the normal controls for free play. Dismissible advice appears on the first Guardian and first Verify use; the first hint explains its operation in the actual hint card. Assist explains its first real conflict in context.
- Quests 1–5: manual marking, automatic marking locked off, guided control forced on.
- Quests 6–10: assistance available but optional; automatic marking defaults off.
- Quest 11: autonomy choice is presented; playing without guided control is a valid/default dismissal path.

Quest 1 retains the audited 5x5 grid with its deliberate singleton at (2,2), using zero-based coordinates. The pedagogical sequence is verified against the actual topology: Guardian (2,2), manual row exclusions, column exclusions, adjacent/diagonal exclusions, forced Guardian (4,3), reuse of the rules, drag across (4,0) and (4,1), then Guardian (3,0), followed by lighter guided practice for (0,1) and (1,4). The user requested guidance through the end of quest 1, so the later bubbles remain short and spotlight a territory rather than revealing a target cell.

Every Guardian uses the real empty -> exclusion -> Guardian cycle. All exclusions are made by the player. The first row/column/neighbors use individual taps; drag is introduced after the second Guardian with the exact same input handler as free play. Individual taps remain available as an accessible alternative to the drag. Next advances only the pre-action introduction; after ACT, no Next/Previous button replaces player actions. There are no automatic actions, alternative cell marks or tutorial-specific board styling. Only the temporary spotlight/dimming and coach bubble differ from ordinary gameplay.

The lesson is derived from canonical board state by `src/game/learning.js`. Reload restores the same attempt and half-completed tap cycle; pause/background restoration still requires explicit resume. Reset returns to the first deduction without changing attempt identity, elapsed time, assistance or campaign progression. Ordinary replay and social challenges do not activate the constrained lesson; explicit learning replay does.

Quest 1 uses the normal success experience. Quest 2 success requires the explicit Découvrir Mon ciel CTA; its backdrop does not navigate. The tour explains four real zones in sequence: constellation navigation, quest cards, performance badges and constellation/stars. Its final CTA or close action leads to quest 3. All four badges are eligible from quest 1. The objective step names them; quest 3 explains the conditions without promising an unlock, and quest 6 recalls assistance choices. No imposed board coach remains from quest 3 onward, while the existing Assist eligibility continues.

Undo after a guided conflict restores the preceding board and clears the pending/deferred guided conflict, its card and its interaction lock. Acknowledging the explanation alone still leaves the incorrect Guardian to correct. Assistance already used remains recorded.

## Mobile input

Touch-only long press (#531): after constrained learning has finished, holding
a cell for 500 ms places a Guardian directly from empty/manual/automatic exclusion,
or removes a Guardian to the neutral stored state. It uses the same cell-action
handler, validation, assistance/mistake accounting, history and persistence as a
short click. Derived automatic exclusions still follow existing rules. A hold
fires once and consumes its release click; short taps retain empty → excluded →
Guardian → empty. Mouse/keyboard click behavior remains unchanged.

Movement over 8 px transfers to the existing exclusion drag and cancels the hold.
Multitouch, pointer cancellation, blur/background and a detached/replaced cell
cancel it. Permissions are checked again at activation: no action while paused,
loading, victorious, guided/verification-blocked or inside constrained learning.
The ordinary SEE → UNDERSTAND → ACT/two-tap/drag lessons stay intact; the help
panel presents the shortcut as available after learning. A brief outline and
optional vibration acknowledge an accepted action without additional game state.
Dragging a finger over cells marks exclusions. It must:
- avoid overwriting Guardians;
- avoid repeatedly processing the same cell in one drag;
- preserve undo via a snapshot;
- suppress the click generated after a drag;
- block native board scrolling while dragging;
- avoid full `render()` calls during pointermove.

## Reset/navigation
The main reset action is **Réinitialiser**, not “Nouvelle grille”. It resets the current quest only. The player cannot choose another unsolved quest. “Quête suivante” is available after victory. Solved quests may be reopened from the campaign map.

## Hints and verification
Hints are pedagogical: first draw attention, then explain the rule, then reveal the forced action as last resort. A placement hint must have a structured explainable proof; an opaque brute-force answer is not acceptable.

Group eliminations identify the reserved rows/columns and a certain exclusion
from the first request. Further requests explain the same proof. Golden source
cells show its premises; a brighter golden target names the cell to exclude.
Neither deductions nor hint costs change (#516/#521).

Halfway encouragement measures placed Guardians / board size without checking
hidden correctness. It fires on a real placement crossing `ceil(size / 2)`,
once per board run, before the terminal state. Rendering, hints, undo and
restoration never trigger it. Restore at/past halfway consumes the crossing
silently; reset/replay starts a fresh run (#515).

Shard economy: start with 3, **no wallet cap** (see `PROGRESSION.md`); hints are free during quests 1–10. Otherwise the first hint in an attempt is free, the second costs 1 shard, and later hints cost 2; a player at zero shards can receive a free hint after 90 seconds. First Verify use is free; subsequent uses cost 1 shard. No automatic timed shard regeneration. An authorized admin-only unlimited-shards test toggle bypasses spending.

Hint and Verify use counts are retained in the active attempt across restart, so
reopening a board neither resets its paid-help sequence nor spends twice for an
interrupted action. The operation identity includes the attempt, reset, action
and sequence. Authenticated paid help waits for the exact server receipt and
current wallet projection before being granted; free and guest rules above stay
the same. Pending or refused spending never confirms a local scalar debit.

A restored solved board waits for account restoration before awarding anything.
An acknowledged historical run reuses its original receipt and elapsed time.
Durably pending victories can show a celebration and pending star and continue
to an accessible quest; that navigation view never grants confirmed currency,
badges or Adventure rights. See `CLOUD_RECOVERY_391.md` for recovery and release
validation boundaries.

## Feedback and modals
Informational overlays should have sensible outside-tap behavior. Corrective overlays (guided conflict and verification correction) deliberately require explicit acknowledgement/action so a correction is not dismissed accidentally.

## Social challenges — first-performance contract

A social challenge is a competition around a **first play**, not a replay leaderboard. A fixed LUMEN grid becomes easier once its solution has been seen or memorized, so a challenge may be created only from the sender's first play on that quest. The recipient gets one challenge attempt. Mistakes do not end that attempt: the player may correct marks and Guardians until the grid is solved or the attempt is explicitly abandoned.

LUMEN guarantees the sender-side condition (the shared snapshot comes from the sender's first play). It deliberately does **not** claim that the recipient has never seen the grid. A recipient may already have passed that quest in campaign; blocking such players would make challenges unusable between players at different progression points. The backend records `previously_played` for analysis, not as a V1 eligibility gate.

The sender's time and badges stay hidden before the recipient finishes, so the reference does not become a target during solving. At the end, comparison is factual across time, Autonomy and Mastery; there is no composite score that pretends an assisted faster run is objectively better than an autonomous slower run.

**Remarkable performance** has one exact social definition: **Mastery earned on the sender's first play of that quest**. Every first play may be challenged, but this case receives stronger celebration and a more prominent “Défier un ami” CTA. Mastery earned on replay is never a remarkable social performance and cannot create a challenge.
