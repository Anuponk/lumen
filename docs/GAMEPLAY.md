# Gameplay and UX specification

## Core rules
For an N x N puzzle:
- exactly N Guardians;
- one Guardian per row;
- one Guardian per column;
- one Guardian per territory;
- no two Guardians adjacent horizontally, vertically or diagonally.

The stored board uses three user-visible states: empty, excluded, Guardian. Interaction order is **empty -> excluded -> Guardian -> empty**.

A wrong intermediate Guardian is allowed to exist long enough for the player to reason/correct it. Guided assistance may explain a direct row/column/territory/touch conflict or a dead end, but the first tap is an exclusion and must not be treated as an attempted Guardian.

## Completion
There is no separate Validate action. Reaching N Guardians triggers evaluation. A correct set of Guardians wins even if unrelated exclusion marks remain. An invalid complete placement must not count as a mistake merely because it temporarily contains N Guardians.

## Learning curve
- Quest 1: play the normal board with a contextual coach. Only the expected cell actions are allowed during guided steps; unrelated taps are ignored without errors or starting the attempt. Help, pause, account and reset remain available.
- Quest 2: free play with the normal controls. Dismissible advice appears on the first Guardian and first Verify use; the first hint explains its operation in the actual hint card. Assist explains its first real conflict in context.
- Quests 1–5: manual marking, automatic marking locked off, guided control forced on.
- Quests 6–10: assistance available but optional; automatic marking defaults off.
- Quest 11: autonomy choice is presented; playing without guided control is a valid/default dismissal path.

Quest 1 retains the audited 5x5 grid with its deliberate singleton at (2,2), using zero-based coordinates. The pedagogical sequence is verified against the actual topology: Guardian (2,2), manual row exclusions, column exclusions, adjacent/diagonal exclusions, forced Guardian (4,3), reuse of the rules, drag across (4,0) and (4,1), then Guardian (3,0), followed by lighter guided practice for (0,1) and (1,4). The user requested guidance through the end of quest 1, so the later bubbles remain short and spotlight a territory rather than revealing a target cell.

Every Guardian uses the real empty -> exclusion -> Guardian cycle. All exclusions are made by the player. The first row/column/neighbors use individual taps; drag is introduced after the second Guardian with the exact same input handler as free play. Individual taps remain available as an accessible alternative to the drag. No explanatory Next/Previous buttons, automatic actions, alternative cell marks or tutorial-specific board styling are used. Only the temporary spotlight/dimming and coach bubble differ from ordinary gameplay.

The lesson is derived from canonical board state by `src/game/learning.js`. Reload restores the same attempt and half-completed tap cycle; pause/background restoration still requires explicit resume. Reset returns to the first deduction without changing attempt identity, elapsed time, assistance or campaign progression. Ordinary replay and social challenges do not activate the constrained lesson; explicit learning replay does.

Quest 1 uses the normal success experience. Quest 2 success explains the actual badge availability (Rapidité at quest 3; Autonomie/Maîtrise at quest 6) and its normal next CTA opens a lightweight Mon ciel tour. The tour points out stars, constellations and the next quest; its CTA or close action leads to quest 3. No imposed coach remains from quest 3 onward, while the existing Assist eligibility continues.

## Mobile input
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

Designed shard economy (when test override is disabled): start with 3, maximum 5; first hint free, second costs 1 shard, later hints cost 2; a player at zero shards can receive a free hint after 90 seconds. No automatic timed shard regeneration.

## Feedback and modals
Informational overlays should have sensible outside-tap behavior. Corrective overlays (guided conflict and verification correction) deliberately require explicit acknowledgement/action so a correction is not dismissed accidentally.

## Social challenges — first-performance contract

A social challenge is a competition around a **first play**, not a replay leaderboard. A fixed LUMEN grid becomes easier once its solution has been seen or memorized, so a challenge may be created only from the sender's first play on that quest. The recipient gets one challenge attempt. Mistakes do not end that attempt: the player may correct marks and Guardians until the grid is solved or the attempt is explicitly abandoned.

LUMEN guarantees the sender-side condition (the shared snapshot comes from the sender's first play). It deliberately does **not** claim that the recipient has never seen the grid. A recipient may already have passed that quest in campaign; blocking such players would make challenges unusable between players at different progression points. The backend records `previously_played` for analysis, not as a V1 eligibility gate.

The sender's time and badges stay hidden before the recipient finishes, so the reference does not become a target during solving. At the end, comparison is factual across time, Autonomy and Mastery; there is no composite score that pretends an assisted faster run is objectively better than an autonomous slower run.

**Remarkable performance** has one exact social definition: **Mastery earned on the sender's first play of that quest**. Every first play may be challenged, but this case receives stronger celebration and a more prominent “Défier un ami” CTA. Mastery earned on replay is never a remarkable social performance and cannot create a challenge.
