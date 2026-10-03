# UX and visual direction

## Visual identity
LUMEN should feel like a celestial/energy-map puzzle rather than a reskinned Queens board:
- dark space/energy-map atmosphere;
- luminous Guardians/orbs;
- organic or light territory boundaries;
- constellation/celestial reward language;
- restrained animation that clarifies state/reward rather than distracting.

Avoid generic pastel territory styling as the default visual direction.

## Board ergonomics
Mobile play is primary. Marking many impossible cells one-by-one was identified as unnecessary friction, which led to drag-to-exclude. Pointer interaction must remain responsive and incremental.

Board rows/cells must not visually jump when exclusion markers appear. Exclusion appearance should remain consistent between manual and automatic marking.

## Learning UX
The player should learn by playing rather than reading a large rule dump. Early quests progressively demonstrate consequences of Guardians. Guidance should explain *why* a move conflicts.

The intended progression:
1. early scripted Guardian placement;
2. visual consequences/exclusions;
3. guided reasoning;
4. optional assistance;
5. autonomous play.

For quests 1–2, use speech bubbles with a pointer to the observed grid zone rather than a fixed instruction banner. Keep the bubble outside the board so it cannot cover a placement. Emphasize newly affected cells; existing exclusion markers must remain stable in the DOM and must not flash or animate again when the explanation changes.

The row, column and neighbours are separate explanations. Mark only new exclusions, one every 500 ms. When all relevant cells are already marked, explain that fact instead of replaying an animation. Let a free tap advance after the animation, offer Previous to revisit the exact earlier board state, and keep placement steps dependent on an actual Guardian placement.

## Error UX
No lives system. When guidance is active, illegal/conflicting Guardian reasoning should identify the relevant rule and source cells. A correction should be persistent enough to be understood rather than disappearing on an accidental outside tap.

## Navigation
The campaign should answer “what do I play now?” without requiring the player to interpret multiple competing counters. The current unsolved quest is the path forward. Solved content can be replayed intentionally.

## Success/reward UX
Victory should feel meaningful: quest accomplishment, stars and constellation reveal/milestones. The sky/constellation is the long-term progress visualization, not a collection of legacy rank names.

## PWA/share friction
Do not ask for installation before the player has experienced value. Current threshold is after 3 solved quests. Do not re-prompt standalone installs. Share results should make the accomplishment understandable outside the app and retain referral attribution.

## Performance perception
Touch interaction should feel immediate. Full board rerenders during drag are specifically prohibited because they create unnecessary mobile work and visual instability. Performance tests around cell and board painting protect this.

## UX cleanup #16/#17/#19

Missing direct exclusions use “Marquage manquant” and “écarter”, replacing the obsolete water-themed message. Remaining hint instructions also use “écarter” instead of “éteindre”; hint logic is unchanged. After victory, “Quête suivante” is the highlighted primary action; sharing remains secondary. The success card scrolls within the viewport on compact screens so the action stays reachable.

Detailed rules are available through “? Revoir les règles” instead of a permanent paragraph below the board. The modal supports its close button, Escape and a backdrop click, then restores focus to the help button. Consultation preserves board/progress and the scripted teaching step; clicks in the modal must never advance onboarding.
