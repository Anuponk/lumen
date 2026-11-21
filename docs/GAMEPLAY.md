# Gameplay and UX specification

## Official attempt time and victory (#638, #652)

The visible campaign clock is real elapsed time plus 5 seconds per Verify,
15 per Hint and 5 per effective guided intervention. Each action updates
the clock immediately with a brief penalty
label; restoration derives the sum from durable counters and does not replay
the label or add another penalty. Technical elapsed time remains available for
the unchanged Rapidité rule (strictly below 60 real seconds), bonus conditions
and cooldowns.

Victory and comparable personal records use official time for the same grid
revision. Only a strict confirmed improvement announces one new record; equality
and a better raw time alone do not. When the badges finish appearing, the podium
appears in the same performance block (#682, #794). Constellation and particle
animations may continue alongside it. Reduced motion shows results immediately.
The ranking area
shows a loading state until verified results arrive. Progress and badges are
already durable before the player leaves the victory screen. The unversioned social
challenge protocol retains real elapsed references until a compatible versioned
score protocol exists.

## Uniform quest contract (#522, convergence candidate)

Every quest uses its visible catalogue ordinal for teaching and assistance,
independently of its saved numeric key. All four badges are eligible from quest 1.
`PERFORMANCE_UNLOCKS` owns the explanations of Rapidité at quest 3 and the
four-badge system at quest 6; `questLearningRules` drives those introductions
without delaying eligibility. Guided conflict control stays forced through 5, optional through
10; marking is manual throughout the campaign (#647). Guided autonomy is introduced at 11. Hints have the same time penalty throughout.

Qualified badge runs share a fifteen-minute cooldown. Qualification is decided
when a run starts (first gesture or reset), never frozen when the grid was opened:
a grid opened during the cooldown and started after it qualifies; a qualifying
run is never demoted (#761). The ranking requires that same flag, so a refused
time is shown as not ranked while the personal record stays saved. Replays preserve acquired
badges and first-win stars; Maîtrise is earned on one run, never accumulated.
First victories earn 10 XP plus 5 XP without a hint, even if another assistance
was used. Bonus quests retain their 25 XP one-time award; a previously unclaimed bonus may
be earned by an actual successful replay. Stable-only bonus identities derive
from the quest ID, with cadence based on visible order. Historical bonus IDs
and star allocations stay frozen. New constellation allocations derive from
their real positions/count, including intermediate and final rewards.

Automatic marking is retired, including historical saved preferences. Effective assistance still
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
- Quest 1: first observe the five temporarily numbered territories and read the six SEE -> UNDERSTAND introduction steps, then play the normal board with a contextual coach. Intro navigation leaves the board untouched and numbers disappear before ACT. The numbers belong to that introduction only (`territoryNumbersVisible`, #862): they are drawn only while an intro step of an active lesson is on screen. Once the tutorial is skipped, or outside the lesson (ordinary replay, later visit to quest 1), they never return, including after reload or account change; an explicit tutorial replay shows them again. Only the expected cell actions are allowed during guided steps; unrelated taps are ignored without errors or starting the attempt. Help, pause, account and reset remain available.
- Quests 2–5: free play, with optional drag, badges and long-press advice in that order.
- All quests: manual marking; old automatic-marking preferences remain stored but are ignored (#647).
- Quest 6: no automatic-marking lesson or blocking checkbox. Guided control remains forced through 5 and optional from 6.
- Quest 11: autonomy choice is presented; playing without guided control is a valid/default dismissal path.

Quest 1 retains the audited 5x5 grid with its deliberate singleton at (2,2), using zero-based coordinates. The pedagogical sequence is verified against the actual topology: Guardian (2,2), manual row exclusions, column exclusions, adjacent/diagonal exclusions, forced Guardian (4,3), reuse of the rules, drag across (4,0) and (4,1), then Guardian (3,0), followed by lighter guided practice for (0,1) and (1,4). The user requested guidance through the end of quest 1, so the later bubbles remain short and spotlight a territory rather than revealing a target cell.

The coach translates the existing learning steps at render time. Its displayed language does not change the allowed actions, coordinates or unlock milestones.

Every Guardian uses the real empty -> exclusion -> Guardian cycle. All exclusions are made by the player. The first row/column/neighbors use individual taps; drag is introduced after the second Guardian with the exact same input handler as free play. Individual taps remain available as an accessible alternative to the drag. Next advances only the pre-action introduction; after ACT, no Next/Previous button replaces player actions. There are no automatic actions, alternative cell marks or tutorial-specific board styling. Only the temporary spotlight/dimming and coach bubble differ from ordinary gameplay.

The lesson is derived from canonical board state by `src/game/learning.js`. Reload restores the same attempt and half-completed tap cycle; pause/background restoration still requires explicit resume. Reset returns to the first deduction without changing attempt identity, elapsed time, assistance or campaign progression. Ordinary replay and social challenges do not activate the constrained lesson; explicit learning replay does.

Quest 1 and ordinary quest victories share the existing result and explicit Quête suivante / Mon ciel actions. No mandatory tour precedes quest 3. All badges are eligible from quest 1; the objective names them and the optional quest-3 advice explains them. Quest 6 keeps optional guided assistance, without a retired marking lesson. The guest registration boundary remains six visible quests; success navigation cannot bypass it.

Undo after a guided conflict restores the preceding board and clears the pending/deferred guided conflict, its card and its interaction lock. Acknowledging the explanation alone still leaves the incorrect Guardian to correct. Assistance already used remains recorded.

## Mobile input

Touch-only long press (#531): after constrained learning has finished, holding
a cell for 500 ms places a Guardian directly from empty/manual exclusion,
or removes a Guardian to the neutral stored state. It uses the same cell-action
handler, validation, assistance/mistake accounting, history and persistence as a
short click. Exclusions remain manual throughout play. A hold
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
The main reset action is **Réinitialiser** (the small ↺ button first in the command row under the grid, labelled « Réinitialiser la grille » for assistive technologies), not “Nouvelle grille”. It clears the placements of the current quest only and asks for confirmation: « Réinitialiser la grille ? Tes placements seront effacés, mais le chrono, les aides et les erreurs resteront comptabilisés. » The attempt, its official time, aids, errors and qualification continue (#851, #36); only « Rejouer » starts a new attempt. The campaign map applies the [progression and Adventure access rules](PROGRESSION.md#adventures-and-access-96). “Quête suivante” is available after victory. Solved quests may be reopened from the campaign map.

**Abandonner (#908).** After the first move, « Abandonner » asks for confirmation (« Continuer la partie » / « Abandonner et revenir au ciel ») and states the remaining qualification window. Confirming closes the attempt (`ABANDONED`, no resumable attempt) and opens Mon Ciel on the quest's constellation. The 15-minute badge/record window keeps running from the start of that attempt, so a replay within it is non-qualifying. Leaving before the first move consumes nothing. Challenges and the Défi du jour keep their one-shot abandon. Details: [PROGRESSION](PROGRESSION.md#performance-badges).

The [Google Play review grant](PROGRESSION.md#google-play-review-navigation-796)
opens direct selection in Mon ciel for the authorised account. The ordinary
board, tutorial, attempt and victory rules apply to every quest played.

## Hints and verification
Hints are pedagogical: first draw attention, then explain the rule, then reveal the forced action as last resort. A placement hint must have a structured explainable proof; an opaque brute-force answer is not acceptable.

Group eliminations identify the reserved rows/columns and a certain exclusion
from the first request. Further requests explain the same proof. Golden source
cells show its premises; a brighter golden target names the cell to exclude.
Neither deductions nor hint costs change (#516/#521). The active hint, including the rule, target coordinates and row or column list, follows the game’s FR/EN setting. Switching language re-renders the same deduction without recording another use.

Halfway encouragement measures placed Guardians / board size without checking
hidden correctness. It fires on a real placement crossing `ceil(size / 2)`,
once per board run, before the terminal state. Rendering, hints, undo and
restoration never trigger it. Restore at/past halfway consumes the crossing
silently; a reset clears the board (the encouragement may fire again), and
only a replay starts a fresh run (#851).

The only cost for an available aid is official time. Each hint adds 15 seconds,
each verification adds 5 seconds and each guided intervention adds 5 seconds.
The existing assistance qualification rules continue to apply.
Historical saves retain their stored balance with no wallet cap imposed by the
game. See [the compatibility contract](PROGRESSION.md#aides-et-historique-du-portefeuille-803).

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

During Wallet-only review, a quest already completed locally and confirmed by
the current account's server read can be replayed without spending. Its new run
is captured under the same attempt/reset ID; performance and rewards remain
pending until verified. Pending replay presentation never advertises an extra
star or confirmed badge. Free-help rules and qualification/cooldown rules remain
unchanged; paid help is refused until the Wallet is ready.

Informational overlays should have sensible outside-tap behavior. Corrective overlays (guided conflict and verification correction) deliberately require explicit acknowledgement/action so a correction is not dismissed accidentally.

## Social challenges — qualifying-run contract

**#889 (owner decision 2026-11-20) supersedes the 2026-10-04 first-play-only rule.** A challenge may be created from any **qualifying** run of the sender: a first win or a replay played outside the shared 15-minute qualification cooldown, exactly as for badges and ranking (`attempt.qualifying`). A replay inside the cooldown cannot create a challenge and the victory explains the remaining wait. Help or an error does not remove qualification (it affects badges and the comparison); a grid reset keeps the run's qualification. Because a fixed grid is easier once seen, the reference always shows its provenance — « Première résolution » or « Rejeu qualifiant » — before the attempt, in the result and in « Mes défis ». A new qualifying run creates a new, independent challenge; it never modifies an earlier one. The recipient gets one challenge attempt. Mistakes do not end that attempt: the player may correct marks and Guardians until the grid is solved or the attempt is explicitly abandoned.

LUMEN states the sender-side provenance honestly (first play or qualifying replay). It deliberately does **not** claim that the recipient has never seen the grid. A recipient may already have passed that quest in campaign; blocking such players would make challenges unusable between players at different progression points. The backend records `previously_played` for analysis, not as a V1 eligibility gate.

The sender's time and badges stay hidden before the recipient finishes, so the reference does not become a target during solving. At the end, comparison is factual across time, Autonomy and Mastery; there is no composite score that pretends an assisted faster run is objectively better than an autonomous slower run.

**Remarkable performance** means **Mastery on a qualifying run**. It receives stronger emphasis on “Défier”; the wording is « Maîtrise du premier coup » only for a first play and « Maîtrise en rejeu qualifiant » otherwise.

**Resuming a started challenge (#888).** The same browser restores the same attempt and its accumulated time. On another device or browser, the clock resumes at the time elapsed since the server recorded the participation start (pauses included), and the intro says so; if the server cannot provide that start, the resume is refused (« Termine-le là-bas ») rather than restarted from zero. The participation stays unique and the first terminal result is kept.


## Continuité des glissements (#632)

Un glissé depuis une case vide pose des marques. Depuis un rond rouge ou un
Gardien, le glissé efface uniquement les ronds rouges traversés. Retouche un
Gardien pour le retirer. Le seuil de 8 px sépare le toucher du glissé. La capture
du pointeur traite les cases traversées même lorsque les déplacements sont
groupés. Les contraintes pédagogiques s’appliquent et Annuler restaure le geste.
