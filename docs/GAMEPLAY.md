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
- Quests 1–2: scripted learning. Teach Guardians through progressive consequences; interactions are constrained while the scripted sequence is active.
- Quests 1–5: automatic marking/guided control forced.
- Quests 6–10: assistance available but optional; automatic marking defaults off.
- Quest 11: autonomy choice is presented; playing without guided control is a valid/default dismissal path.
- When automatic marking is first disabled, explain manual exclusion and drag interaction.

The first two quests use curated 5x5 boards. Quest 1 starts with the single-cell territory in the centre; quest 2 uses a different board. These are deliberate onboarding exceptions to the normal territory-size rule (see GRID_CATALOG).

The sequence introduces the five territories and the one-Guardian-per-territory rule before the first placement. Anchored speech bubbles then explain the row, column, neighbouring cells including diagonals, and any remaining cells of the occupied territory separately. New exclusions appear one at a time at 500 ms intervals in both quests; the player controls the time between explanations.

Existing exclusions remain visible and are never animated again. If a zone has no new exclusions, the bubble explicitly says its cells are already marked. After an animation, tapping any non-control area advances the explanation; the optional Next button does the same. A Guardian must still be placed on the indicated cell. Account/help/reset controls and corrective modals retain their own actions.

Previous restores the earlier explanation, Guardians and exclusions. It can cancel an in-progress animation; replaying an already visited explanation does not repeat its marking animation. Reset clears this in-memory teaching history and keeps the current quest and persisted campaign progress.

In scripted onboarding, the final legal placement is followed by its explanations before completion is recorded. Outside onboarding, a legal complete placement is evaluated immediately. In both cases victory depends on legal Guardians, not on marking every remaining cell.

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
