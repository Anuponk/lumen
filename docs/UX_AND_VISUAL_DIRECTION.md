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

Quest 1 uses the same board, cell marks, controls and input handlers as ordinary play. A compact contextual bubble stays outside the board and normal action buttons. Spotlight the central singleton for the first Guardian, then whole territories for subsequent deductions. Dim unrelated cells gently; ignore unrelated taps. Keep guidance through the fifth Guardian with increasingly shorter prompts, as requested for issue #57.

The player marks exclusions manually. Row, column and diagonal neighbors are taught separately; introduce the real touch/mouse drag only after the second Guardian. There are no tutorial Next/Previous buttons or automated marking animations. Quest 2 guides a first singleton placement, then requires practicing the real mouse/touch drag across its first row before free play with dismissible advice at the first actual need and a short Mon ciel tour. The shared responsive board sizing on short mobile screens reserves room for advice while retaining visible controls and avoiding scroll. Reduced-motion preferences suppress coach transitions.

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


## One responsive game UI

Lumen uses one game DOM, one game state and one set of gameplay handlers across phones, tablets and desktop. Responsive behavior belongs primarily in CSS: the same journey component becomes compact on narrow viewports and occupies the left workspace on wide screens; the same contextual message occupies the normal flow or the wide right workspace.

JavaScript must not re-parent gameplay or progression components based on viewport width. A breakpoint may change presentation, but not which implementation is active. Interaction differences must be capability-driven: for example, drag-to-exclude is implemented with Pointer Events and ignores mouse pointers rather than assuming that a narrow viewport is touch-capable.

Do not introduce parallel `MobileX` / `DesktopX` gameplay components. If a compact presentation is needed, adapt the canonical component with CSS and preserve the same state, semantics and handlers.

## Social challenge UX

Keep the challenge loop celestial and performance-led, not leaderboard-heavy. Before play, show who sent the challenge and the one-attempt rule, but hide the sender's time/badges. After play, reveal both performances side by side and describe differences factually.

A remarkable first-play Mastery deserves stronger visual emphasis around “Défier un ami”, while “Quête suivante” remains the primary campaign continuation for an ordinary first completion. Do not turn replay Mastery into a challenge CTA.

“Mes défis” belongs under Mon ciel. New results use a small unread indicator. Push permission must be requested contextually (“Préviens-moi quand quelqu'un relève mes défis”), never as an unexplained first-launch permission prompt.


### Progressive assistance unlocks
Assistance options are introduced only when they become meaningful. On quest 6, announce **Marquage auto** with a short modal: it is an optional, legitimate comfort-oriented alternative to manual marking, not the “wrong” way to play. Explain the reward trade-off before play: using it counts as assistance, so Rapidité remains possible but Autonomie and consequently Maîtrise do not.

When the player reaches the autonomy milestone (quest 11), explain the **Contrôle guidé** choice. The player may turn it off and may re-enable it later. The important distinction is intervention, not the visual toggle alone: keeping guided control enabled does not invalidate an attempt unless it actually prevents/corrects an error. An intervention counts as assistance and removes Autonomie/Maîtrise; Rapidité remains available. Teach trade-offs without shaming assisted play.
