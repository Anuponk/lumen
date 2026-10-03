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

The intended teaching sequence is visual and progressive: Guardian placement, then exclusions caused by line, column, territory and neighbourhood constraints. Quest 1 should be more deliberate/slower than quest 2.

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
