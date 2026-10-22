# UX and visual direction

## Account access (2026-10-18)

Offer **Continuer avec Google**, email plus password (create account / existing account), and **Continuer sans compte**. Remove code-email login. Former passwordless players use **Créer ou réinitialiser mon mot de passe** with the same email, preserving their existing account. Recovery opens a visible password editor. Distinguish an authenticated account still restoring its save from a guest; a restore failure offers **Réessayer la synchronisation**, never a destructive reset. During initial session restoration, show a connection check with the account action disabled; offer sign-in only after the SDK confirms a guest session. The early guest discovery and learning sequence remain unchanged.

The account menu always exposes **Diagnostic de synchronisation**, independently
of administration permissions and victory dialogs. The existing bounded local
cloud diagnostic report is readable in a read-only field and can be copied;
when the clipboard is unavailable or denied, manual selection remains possible.
Opening/copying the report changes no save, retry state or server data and uploads
nothing. It includes no account identity, token or whole player profile. This
support action does not alter gameplay onboarding.

## Visual identity

Constellation detail uses the same verified drawing and canonical reward total
for historical, inserted and generated catalogue entries. On small phones the
SVG takes the remaining detail space after text and controls; it has no fixed
190px height that can push real or secondary stars outside the window.
Short screens compact gaps, badge-legend padding and quest tiles first. Source
geometry and uniform scaling remain intact. This layout correction adds no new
interaction or reward rule. The #504 tour wording below covers the new lights.
On short overview screens, drawing and name share the top card row, with full
rows for progress and badges. Wrapped aliases no longer reduce the drawing to
a thin strip; text remains complete and uses its existing font sizes.

Mon ciel reserves space for each constellation name, progress and badge
percentage. The drawing and name can share a row; short screens retain all
six cards and readable text. Finale layout reserves the measured banner height
and fits the square board against the complete game stack, including wrapped
action labels and CSS safe-area insets. Buttons keep their readable/touch sizes.

## Accepted sky reward presentation (#504, 2026-10-22)

The gold crowns from #512 were rejected by user feedback. They are removed from
overview, detail and victory reveal. If the reference has enough real stars for
all victories, only those stars illuminate progressively. If it has fewer,
illuminate its real stars first, then one small lavender four-point light per
remaining victory. Only the actual shortfall is added: five real stars and five
secondary lights for ten victories in Delphinus, no secondary lights in Orion
when its real points suffice. All counts derive from catalogue/reference data.

Secondary lights are scattered through free sky, smaller than source circles,
unlinked, and separate from source points/segments. They remain invisible before
being earned. Their layout is deterministic and identical across views; a replay
adds no light or arrival animation. The tour explains real stars first and then
"étoiles de lumière" for small constellations. Reduced motion disables arrival
animation. Rewards, badge eligibility and saved data remain unchanged.

Before choosing the preferred secondary-star option, compare it against dust
and a subtle nebula with `node scripts/preview-quest-secondary-stars.mjs`. The
self-contained [comparison](validation/issue504-comparison.html) supports both
Delphinus and Orion at every earned state. Separate stars are easy to count;
dust is more diffuse on small views and a nebula makes individual gains less clear.

LUMEN should feel like a celestial/energy-map puzzle rather than a reskinned Queens board:
- dark space/energy-map atmosphere;
- luminous Guardians/orbs;
- organic or light territory boundaries;
- constellation/celestial reward language;
- restrained animation that clarifies state/reward rather than distracting.

Avoid generic pastel territory styling as the default visual direction.

## Board ergonomics

Hint emphasis fills the cell interior in gold, clipped to the padding box below
symbols and territory borders. Preserve all border widths/colors and territory
backgrounds. Group proofs use a brighter target and name its coordinate. The
fill is static, including with reduced motion. Halfway feedback belongs to
actual placements, never a redraw, restore or victory render (#515/#516/#521).
The next real board mutation removes the hint's emphasis and card, without a
full board render or stale gold cells after the explained action is played.
Mobile play is primary. Marking many impossible cells one-by-one was identified as unnecessary friction, which led to drag-to-exclude. Pointer interaction must remain responsive and incremental.

Board rows/cells must not visually jump when exclusion markers appear. Exclusion appearance should remain consistent between manual and automatic marking.

## Learning UX

On short screens, the compact coach for learning quests 1–2 reserves the
interactive header before measuring available space above the board. Its
height may shrink and scroll internally; it must not intercept the help button,
its focus ring, puzzle cells or normal actions. Teaching steps and eligibility
remain unchanged. The placement regression reproduces the 360x640 geometry;
the UX browser suite retains real help open/close/focus checks.
The compact coach is anchored to the board wrapper, so restoring an off-screen
help control into view moves both in the same coordinate space immediately.
It must not remain fixed over the header until a later animation frame.
The onboarding has a protected **SEE -> UNDERSTAND -> ACT** order. “Learn by playing” does not mean “act immediately”: before the first board interaction, quest 1 gives the player a short visual model of what the board is and what success means.

**SEE:** show the real quest-1 board without accepting board input. Temporarily number the five colored territories 1–5 so a new player can perceive that color/shape defines distinct territories. These numbers are teaching scaffolding only and must disappear from ordinary play.

**UNDERSTAND:** still before the first move, explain on the real board that the goal is to place Guardians and that there is exactly one Guardian per territory, one per row, one per column, and that Guardians cannot touch even diagonally.

**ACT:** only after those concepts have been presented, teach the real cell cycle: first tap/click = exclusion mark, second tap/click = Guardian. Then continue with the interactive deductions and drag lesson.

This ordering is a regression guard. A tutorial redesign may shorten copy or improve presentation, but must not require a deduction or board action before SEE and UNDERSTAND are complete.

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

### Mon ciel: Ciel → Aventure → Constellation (#96)

Use **Aventure** in player-facing text; `pack` remains the content-model term. Mon ciel has a compact Ciel selector, a horizontal Adventure rail and exactly one detailed Adventure. The selected Adventure shows its name, completed/total constellations and state. Other Adventures stay compact, including locked ones; their notice explains that the unlock method will be announced later. No store, currency price or new unlock mechanism is introduced here.

Show at most six constellation cards per page: 2×3 on mobile and 3×2 on desktop, using the same DOM/component and pagination. Cards show silhouette, name, earned/total stars, progression lock/completion and an optional mastery indicator for all mastery-eligible quests in that constellation. Previous/Next and horizontal touch swipe change the page without changing progression. The final partial page contains only actual cards. The main modal height remains bounded even with dozens of Adventures and hundreds of constellations; use horizontal navigation rather than vertical stacking.

Every constellation, including canonical-only entries such as Dauphin, uses the same quest grid, four-slot badge cards, current-quest treatment, lock icons, shared badge legend and star card. Resolve cards from the selected stable constellation ID, never a dormant numeric index. Canonical star cards use the licensed atlas and completed canonical quest count. The two rows of cards stay compact on desktop so the legend, star card and challenges action remain inside the sheet. Hidden panels stay visually hidden after refresh.

Selecting an unlocked constellation opens its detail in the same sheet: quests, performance badges and stars, with a **Toutes les constellations** back button. Completed quests keep their replay behavior. Mes défis stays reachable from the main sheet. Keyboard navigation is contained in the modal, Escape closes the appropriate notice/sheet, and notices restore focus. Long current-quest labels truncate on mobile so Mon ciel remains reachable.

Browsing and progression are separate: opening Mon ciel defaults to the Adventure of the player's real accessible progress; consulting a previous Adventure does not change the board, current attempt, unlocked quest or rewards. A refreshed access model must invalidate an inaccessible viewed Adventure and return to an accessible view. Browsing preference is intentionally not persisted across reloads.

The first guided visit after quest 2 now teaches five real zones in order: Ciels/Aventures, constellations, quests, performances, constellation drawing. Each step reveals the corresponding overview/detail pane. The first tour cannot be skipped by closing the sheet or touching the backdrop; only its final step offers **Jouer la quête 3**.

Finishing an Adventure shows a brief summary of its constellations, stars and earned performance badges. **Découvrir l’Aventure suivante** opens the next available Adventure for consultation, or its lock notice when unavailable; it never grants access or advances an unsolved quest. The actual final campaign quest retains its full-sky celebration.

## Success/reward UX
Victory should feel meaningful: quest accomplishment, stars and constellation reveal/milestones. The sky/constellation is the long-term progress visualization, not a collection of legacy rank names.

## PWA/share friction
Do not ask for installation before the player has experienced value. Current threshold is after 3 solved quests. Do not re-prompt standalone installs. Share results should make the accomplishment understandable outside the app and retain referral attribution.

## Performance perception
Touch interaction should feel immediate. Full board rerenders during drag are specifically prohibited because they create unnecessary mobile work and visual instability. Performance tests around cell and board painting protect this.

## UX cleanup #16/#17/#19

Missing direct exclusions use “Marquage manquant” and “écarter”, replacing the obsolete water-themed message. Remaining hint instructions also use “écarter” instead of “éteindre”. Hint pedagogy follows a simplest-valid-explanation rule: a forced single in a territory is preferred first, then row/column singles, before locked/group deductions. Generated French must stay natural and grammatically correct. After victory, “Quête suivante” is the highlighted primary action; sharing remains secondary. The success card scrolls within the viewport on compact screens so the action stays reachable.

Detailed rules are available through “? Revoir les règles” instead of a permanent paragraph below the board. The modal supports its close button, Escape and a backdrop click, then restores focus to the help button. Consultation preserves board/progress and the scripted teaching step; clicks in the modal must never advance onboarding.


## One responsive game UI

Lumen uses one game DOM, one game state and one set of gameplay handlers across phones, tablets and desktop. Responsive behavior belongs primarily in CSS: the same journey component becomes compact on narrow viewports and occupies the left workspace on wide screens; the same contextual message occupies the normal flow or the wide right workspace.

JavaScript must not re-parent gameplay or progression components based on viewport width. A breakpoint may change presentation, but not which implementation is active. Interaction differences must be capability-driven: for example, drag-to-exclude is implemented with Pointer Events and ignores mouse pointers rather than assuming that a narrow viewport is touch-capable.

Do not introduce parallel `MobileX` / `DesktopX` gameplay components. If a compact presentation is needed, adapt the canonical component with CSS and preserve the same state, semantics and handlers.

## Social challenge UX

Keep the challenge loop celestial and performance-led, not leaderboard-heavy. Before play, show who sent the challenge and the one-attempt rule, but hide the sender's time/badges. After play, reveal both performances side by side and describe differences factually.

A remarkable first-play Mastery deserves stronger visual emphasis around “Défier un ami”, while “Quête suivante” remains the primary campaign continuation for an ordinary first completion. Do not turn replay Mastery into a challenge CTA.

The current social RPC protocol supports historical numeric quest identities.
For a first victory on a canonical-only quest, show the challenge action disabled
with “Les défis sont disponibles uniquement sur les quêtes historiques.” This
existing limit is explicit, not a Mastery requirement. Do not substitute the new
visible ordinal for a historical grid identity. Replays hide the action and explain
the first-success rule, including old saves without performance metadata.
Repeated activation while creating a link sends one request; reopening that
victory's sharing flow reuses its link and never awards campaign rewards again.
Sharing leaves the victory behind the dialog, including at an Adventure boundary;
the pending completion remains available through the normal Next action.

The Adventure rail scrolls independently of the page and the constellation swipe
area. Selecting a partly visible chip reveals its entire label and retains keyboard
focus across rendering. Arrow keys, Home and End move focus (including RTL);
Enter/Space retain native button activation. Long future labels wrap inside the
rail rather than requiring smaller fonts. Opening Mon ciel keeps its existing
destination based on the active quest.

“Mes défis” belongs under Mon ciel. New results use a small unread indicator. Push permission must be requested contextually (“Préviens-moi quand quelqu'un relève mes défis”), never as an unexplained first-launch permission prompt.


### Quest 2 → Mon ciel learning handoff
The end of quest 2 is part of onboarding, not ordinary success navigation. The primary CTA explicitly teaches the destination: **Découvrir Mon ciel**. The success backdrop is inert at this point; opening the sky must be an intentional action.

On the first guided visit, teach the real screen progressively rather than with one generic paragraph: highlight and explain (1) constellation navigation, (2) quest/progression cards, (3) performance badges, and (4) the constellation drawing and earned stars. Use **SEE → UNDERSTAND → ACT**: one highlighted real zone and one short explanation at a time. Only the final step offers **Jouer la quête 3**.


### Progressive assistance unlocks
Assistance options are introduced only when they become meaningful. On quest 6, announce **Marquage auto** with a short modal: it is an optional, legitimate comfort-oriented alternative to manual marking, not the “wrong” way to play. Explain the reward trade-off before play: using it counts as assistance, so Rapidité remains possible but Autonomie, Sans erreur and consequently Maîtrise do not.

When the player reaches the autonomy milestone (quest 11), explain the **Contrôle guidé** choice. The player may turn it off and may re-enable it later. The important distinction is intervention, not the visual toggle alone: keeping guided control enabled does not invalidate an attempt unless it actually prevents/corrects an error. An intervention counts as assistance and removes Autonomie/Sans erreur/Maîtrise; Rapidité remains available. Teach trade-offs without shaming assisted play.


### Badge learning milestones
Do not explain performance badges before they can be earned. The onboarding must derive its timing from the real eligibility model: quests 1–2 have no badge, quest 3 introduces **Rapidité** because it is the first earnable performance reward, and quest 6 introduces **Autonomie**, **Sans erreur** and **Maîtrise** when the complete four-badge system becomes available. Explain the conditions in player language: Rapidité = beat the target time; Autonomie = succeed without assistance; Sans erreur = use no assistance and never continue after a wrong Guardian; Maîtrise = earn Autonomie, Rapidité and Sans erreur on the same badge run. A wrong Guardian removed or immediately undone before any other logical move does not break Sans erreur. Never expose the pending/error state during play. At quest 6, connect this explanation to assistance choices without portraying assisted play as inferior.


## Onboarding is coupled to product rules
Treat learning content as a live projection of the product, not static copy. A change to when or how a mechanic becomes available must trigger a review of every place that teaches that mechanic: rules, gestures, assistance, badge eligibility, unlocks, progression, Mon ciel, success flows and terminology.

Where possible, compute a teaching milestone from the same rule used by gameplay rather than copying a quest number into onboarding. If a mechanic deliberately needs a fixed pedagogical delay, document that exception. Every rule-changing PR must state its onboarding impact.

Milestone dialogs must respect `hidden` even when their visible layout uses `display:flex` or an inline display value. A hidden badge/assistance introduction must neither cover the board nor receive pointer input. Keep a visible/hidden browser regression for both dialogs.


### Sans erreur feedback rule
Sans erreur must never become an implicit correctness assistant. A wrong Guardian may be tracked internally as pending, but the UI must not change its color, sound, message, haptics or badge-state indicator. If the player removes or immediately undoes that Guardian before another logical board mutation, the pending error disappears. Otherwise it becomes a committed error for that badge run.

Campaign/replay Reset deliberately gives the player a fresh badge run and restarts its timer/assistance/error state. Social challenge Reset is different: the challenge remains the same one-shot attempt and keeps elapsed time, assistance and committed errors.


## End-of-campaign celebration
The final currently available quest is not a normal success. After the last constellation reveal, show a dedicated full-campaign celebration with explicit completion copy, a compact recap (quests, constellations, stars, Autonomy/Sans erreur/Mastery counts) and post-game actions toward Mon ciel / badge completion. Detection derives from the campaign content count, not a hard-coded quest id. The “seen” key is versioned by available quest count so a future content extension can earn its own new ending.


Canonical board identity: the header and any challenge/finale presentation must
refer to the active stable quest. A new canonical constellation never displays
a bonus or finale from the dormant numeric legacy index. Starting it does not
claim an old quest's qualification. Victory success remains gated by a durable
intention and verified server acknowledgement; repeated renders cannot create
parallel captures with different evidence. Existing learning milestones, badge
eligibility and rewards are unchanged.

A solved canonical board restored before the account is ready shows account
restoration pending rather than claiming local storage failed. After verified
restoration, validation resumes for that same attempt without requiring another
board gesture. Success still requires a confirmed cloud save. No onboarding,
controls, eligibility or reward rules change.

Resuming an already committed canonical attempt restores its confirmed result
from the exact server receipt and current profile. It must not display another
XP/star grant. A recognized later duplicate capture is retained in a verified
archive before active-pending status clears; unrecognized evidence stays pending.
No rule, badge eligibility, control or onboarding milestone changes.

Canonical victory celebrations display the shared animated reward panel after
server acknowledgement, using only badges earned by the confirmed operation
and present on the verified profile. First completion shows its one star;
replay shows only newly gained badges, without another star. Previously owned
badges are not announced again. Legacy achievement copy remains separate from
canonical identity. Eligibility, controls and learning milestones are unchanged.

The account menu must state **Progression synchronisée** explicitly for a
verified, ready account without pending work or failure; a nickname supplements
that verdict instead of replacing it. Pending local writes, offline mode,
restoration, recovery, failure and pending victories must not show success.
The diagnostic remains accessible in healthy states: show a readable **État
actuel** above the technical journal and explain that historical incidents may
already be resolved. This summary follows current state, never the mere presence
of older error events. Opening the panel refreshes the summary without a server
request. The copied report remains privacy-safe and excludes nickname/identity.


### Shared quest celebration
P0 synchronization presentation distinguishes confirmed, transient/durably pending,
persistent/protected and unconfirmed local preservation. A recoverable failure
does not open a technical modal. A durably captured solved grid may celebrate
with an explicitly pending star; newly owned badges, balances and rights still
require server confirmation. Persistent status becomes actionable after the
actual celebration ends; failed local preservation is explicit immediately.
The next known quest can use the durable navigation view under existing access
rules, without crediting the pending reward locally. Existing hint prices,
assistance teaching and badge qualification milestones remain unchanged.
Historical and canonical campaign quests share the constellation reveal and
confirmed star/badge panel. Only first completion announces a new star; replays
show the constellation and newly earned badges without awarding another star.
Previously owned acknowledged badges remain visible with « déjà obtenu »;
this does not claim they qualified on the current run. Overview cards and reveal
completion use the actual canonical quest membership, including constellations
without historical numeric slots. Finishing the numeric catalogue alone never
announces completion of all Adventures.
The reveal uses the played quest's constellation and the licensed astronomical
figure. Newly illuminated atlas points and links animate. The difficulty survey
is hidden from victory cards to keep rewards and the next-quest action visible.
Learning quest 2 retains its intentional Mon ciel CTA, and badge introduction
milestones and reward eligibility remain unchanged. Challenge and learning-only
replays retain their isolated reward rules.
