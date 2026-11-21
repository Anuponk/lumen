# UX and visual direction

## Analytics dashboards — #708

The unified administration is organised around two operator questions: where
players progress less easily, and which technical problems affect them. Overview
cards lead to quest evidence or player/session/incident detail. Journey filters
and review signals expose sample size and historical coverage; technical cards
separate hydration, queue age, individual observations and version/cause volumes.
Unknown data never looks like measured zero or a confirmed healthy state.

Primary analysis is visible first on an opaque, responsive desktop-first surface;
legacy counters/retention/catalogue/raw tables remain in closed disclosures.
Keyboard disclosure checks and existing support/preview actions remain. The
320/390 px layout stacks cards and contains horizontal table scrolling. No game
rule, learning step, badge eligibility, input gesture or player-facing gameplay
navigation changes; onboarding adaptation is not required.

## Localisation #754

The optional introduction, installed-app welcome and coach for the first two quests read from `src/ui/locales/{fr,en}/`. The learning engine supplies steps and allowed cells, and `src/ui/learning-copy.js` supplies their text. Chrome fixtures exercise the English onboarding through the public game entry point. The installed-app welcome keeps matching French text in the HTML shell so its actions retain labels if HTML and JavaScript load from different releases. Board controls, attempt prompts, cell labels and the rules dialog also read from the FR/EN board catalogues. The rules dialog retains its French labels in the HTML shell. Its teaching sequence, gestures and assistance penalties are identical in both languages.

To prepare an additional locale, use the French domain catalogue as a template, keep the same semantic keys and placeholder names, then register the canonical BCP 47 code, native name, availability, fallback and statically imported messages in `src/ui/i18n.js`. Use `t(key, params)` for complete messages and plural forms keyed by `Intl.PluralRules` categories with an `other` form. Use the translator’s number and date formatters for display. The French catalogue provides missing copy. Diagnostics report the key and locale. Player names and other user-provided values remain intact when inserted as parameters.

The service worker follows the static imports to cache the French and English catalogues. The French introduction keeps its existing timing, entry choices and accessibility. Guarded teaching steps begin in the game after the introduction.

The public discovery page is available in French at `/decouvrir.html` and in English at `/discover.html`. Both pages have a language link, reciprocal `hreflang` and localized social previews. French is the discovery fallback. The English discovery page links to the English rules and constellation learning guides at `/how-to-play.html` and `/learn-constellations.html`. Both guides link to their French counterpart and use reciprocal `hreflang`. The game and installation links honor the app’s language preference. The constellation directory and legal links identify their French destinations. The pages use the existing captures from the French edition.

The public game exposes a language selector in the rules dialog. The player can choose Automatic, Français or English. Automatic selects the first supported browser language and falls back to French. The explicit choice is stored on the device. Switching updates the translated text and accessibility labels without rebuilding the board or restarting the attempt. English covers onboarding, board controls, help, verification feedback, the puzzle leaderboard, personal records and the quest review’s performance copy. The Daily Challenge surfaces also use FR/EN, including both leaderboards, the weekly recap and its share text. Other screens can still display French. The remaining translations, cross-device preference, native Android app language, transactional copy, notifications and Play listing are tracked in #754.

### Maintaining the translations

Add or edit the French and English entries in the same PR. Keep messages complete and preserve the named variables in each plural form. Format the data at render time. Player nicknames, quest IDs, scores and reward state keep their existing meaning and ownership.

Run `node scripts/i18n-audit.mjs --review <key>` after checking the pair in context. The record binds the review to both texts. Editing either catalogue invalidates the record for that key. Run `npm run i18n:check` before committing. The CI rejects missing keys, invalid plurals, inconsistent variables and visible copy newly detected outside a catalogue.

Run `node scripts/i18n-audit.mjs --list` for the current migration inventory. The inventory scans the game HTML shell and JavaScript in the UI, game, campaign, privacy and landing modules. Migrate confirmed player copy to a semantic key and run `node scripts/i18n-audit.mjs --prune` to remove cleared entries. CI compares the historical inventory with the target branch to prevent it from growing.

The scan follows common text destinations and can flag technical strings or miss text assembled at runtime. Exercise player journeys in both languages, including smaller screens. Static public pages, native resources, Play copy and server-generated e-mails and notifications need checks in their own release paths.

## Optional first welcome and story — #532

A fresh local campaign opens a celestial welcome with the existing LUMEN brand,
the approved tagline and two actions: **Commencer l’aventure** opens the actual
first board; **Découvrir l’histoire** plays the approved five scenes in 30 seconds.
**Passer** is available immediately and skips only the story. Quest 1 retains
SEE → UNDERSTAND → ACT and its existing independent tutorial opt-out.

The presentation uses the first catalogue quest's licensed astronomical reference,
without invented coordinates, reward effects or a second board. The final seven
seconds fade the celestial layer above the real board. One responsive DOM serves
mobile and desktop. The game is inert while the presentation owns focus.

`lumenIntroPresentedV1` is a local presentation marker, claimed and read back
before ordinary startup. Existing profiles, attempts, owners, remembered sessions,
recovery sources, tutorial visits and parameterized/deep-link contexts bypass the
automatic welcome. Denied/unverifiable storage also bypasses it. It never enters
the player profile or cloud commands. Storage removal/new devices can remove this
local preference; a known existing profile still bypasses automatic presentation.

**Revoir l’introduction** belongs in Aide. It pauses a running attempt through the
existing pause action, preserves its board/identity/rewards and returns to that
paused game, without forcing quest 1 or restarting the attempt. Escape and Passer
restore focus. A changed account/quest/attempt or pagehide cancels obsolete work.
Hidden tabs pause narrative time. Reduced motion suppresses animated effects;
an accessible, expandable transcript pauses playback and exposes the full text.
An animation failure releases the game immediately. An original, quiet Web Audio
score accompanies the story after an explicit story/replay action. It initially
reads the current sound preference at every opening; a visible music toggle changes only this
presentation's session choice, without writing a new preference or player field.
Music pauses with hidden tabs and the transcript, resumes at the current passage,
and stops on completion, skip, Escape, cancellation or pagehide. Audio refusal or
unavailability leaves the visual story usable. No remote audio asset is needed;
cold offline startup remains the existing PWA's scope.
The first service-worker acquisition does not reload that fresh document; an
actual replacement retains the existing upgrade reload and OAuth-return guards.
The return notification remains a passive, automatically dismissed status; it
must not intercept Help or board gestures now that first installation stays on
the original document. Its text, timing and player data remain unchanged.

Domain readiness (persistence lot 3): a current verified acquired replay may be
available during Wallet review. Account status distinguishes « Quêtes confirmées ·
historique à vérifier ». Assistance on that replay uses the official-time rules.
A pending replay shows performance awaiting
confirmation, never an extra star or earned badge. Initial hydration and other
domain holds retain their visible completion/disabled-replay explanation.
Onboarding impact: discovery, help milestones and badge rules are unchanged;
no new lesson or unlock is added. The changed status/pending copy is shared by
replay surfaces rather than duplicating rules in the teaching sequence.


## Quest convergence onboarding (#522, candidate)

Discovery covers the first six visible quests. Continuing beyond them requires
an account and verified cloud readiness; dismissing that offer opens Mon ciel.
It does not unlock quest 7. Completed quests and genuinely started campaign/
replay attempts retain their acquired access. READY or social play does not
prove campaign acquisition. The account copy states the discovery boundary.

For an acquired guest attempt beyond discovery, keep the resolved board and
paused attempt while requesting the account to confirm rewards. The message
states that the board is retained; it must never erase a win or silently credit
an unconfirmed authenticated reward.

Quest 2 success explicitly says **Découvrir Mon ciel**. The success backdrop
does not navigate. The first visit tours the real constellation list, quest
cards, performance area and constellation/stars in sequence before quest 3;
earlier manual browsing returns to the current quest without granting progress.
Quest launch and early tour close cannot bypass these steps. The tour mentions
future badges without introducing their conditions ahead of their milestones.

All four badges remain eligible from quest 1 (#529). Quest 3 explains their
conditions, quest 6 recalls assistance and introduces optional Marquage auto,
and the reversible guided-control choice remains at
quest 11. Controls and hint pricing use the active quest's visible ordinal,
including stable-only quests, rather than the dormant numeric frontier. Both
replay formats display the same cooldown warning and acquired badge labels.

The incident cockpit compares observed versions within its bounded optional
sample and filters episodes by version and last observed state. Counts are not
error rates and do not prove regressions. Mixed-version episodes retain context.
Each filter change revokes report review and its draft URL; a newly displayed
report must be reviewed again. No game, teaching or saved-player behavior changes.

The hidden Rapidité countdown retains its layout space. Showing/hiding it at
the qualification thresholds must not move a cell under an ongoing touch;
the clock, badge criteria and hidden accessibility state remain unchanged.

Guided correction (#548) filters only the handled gesture's release click.
There is no 700 ms cooldown across the board: a fresh tap works immediately.

Touch shortcut (#531): a stationary 500 ms hold directly places/removes one
Guardian through the normal action rules, with a brief outline and optional
haptic feedback. Release never also short-clicks. Moving over 8 px cancels the
hold in favor of the existing drag; cancelled/multiple pointers and background
states cannot commit a pending hold. Short clicks and mouse/keyboard remain
unchanged. Constrained first-quest learning keeps its two-touch and drag lessons;
the help panel explains that the shortcut is available after that learning.
On short screens its card scrolls within the viewport, with a sticky close
header and the learning-replay action reachable at the bottom.

The diagnostic cockpit (#534 phase 2) groups the optional bounded timeline into
episodes, with filters for the last observed guided transition. Every view is
labelled partial; released input never means restored saves. Reports contain
fixed codes and cautious reproduction steps. An explicit review checkbox enables
a sanitised GitHub draft; the administrator validates publication on GitHub.
Existing issue search and local text export help investigation. No auto-ticket,
notification, live-resolution claim or player repair is introduced.

Optional diagnostics (#534) live in the existing account diagnostic panel.
Default off, explain purpose, pseudonymous account linkage, permitted technical
fields, seven-day detail period and withdrawal/erasure. A refusal never changes
gameplay or saves. Withdrawal stops locally immediately; say explicitly when
server deletion is pending offline. Existing minimal operational sync indicators
are separate. The same admin cockpit shows a bounded opt-in/incomplete sample,
using text rendering and no profile/email joins or repair action. No teaching,
assistance, eligibility or gameplay milestone changes.

## Account access (2026-10-18)

Offer **Continuer avec Google**, email plus password (create account / existing account), and **Continuer sans compte**. Remove code-email login. Former passwordless players use **Créer ou réinitialiser mon mot de passe** with the same email, preserving their existing account. Recovery opens a visible password editor. Distinguish an authenticated account still restoring its save from a guest; a restore failure offers **Réessayer la synchronisation**, never a destructive reset. During initial session restoration, show a connection check with the account action disabled; offer sign-in only after the SDK confirms a guest session. The early guest discovery and learning sequence remain unchanged.

The account menu also exposes **Crédits et sources** (#740) for every player, collapsed by default; see [ASTRONOMY_DATA_ATTRIBUTION](ASTRONOMY_DATA_ATTRIBUTION.md#attribution-visible-dans-lapp--740).

The account menu always exposes **Diagnostic de synchronisation**, independently
of administration permissions and victory dialogs. The existing bounded local
cloud diagnostic report is readable in a read-only field and can be copied;
when the clipboard is unavailable or denied, manual selection remains possible.
Opening/copying the report changes no save, retry state or server data and uploads
nothing. It includes no account identity, token or whole player profile. This
support action does not alter gameplay onboarding.

The same panel shows LUMEN's storage by category, with approximate sizes and no
account identities, keys or save contents. Browser quota is not presented as
free phone capacity; a quota refusal says LUMEN lacks storage space. An explicit
**Libérer l’espace des anciennes copies** action archives older backups after
verified read-back, keeps two recent copies per eligible family and preserves
the live profile and pending operations. **Exporter mes sauvegardes** includes
archives. Show success, partial failure or interruption without claiming sync
is repaired. The mobile panel scrolls so maintenance/export remain reachable.
These support actions change no gameplay or learning milestones.

## Visual identity

Mon ciel distinguishes a completed quest from a temporarily unavailable replay.
Completed cards retain their completion styling and accessible label, with the
specific authentication/synchronization reason when needed. The constellation
detail also shows that completed quests are preserved, so touch users do not
depend on a tooltip. Pending replay stays disabled until the existing guard
permits it; an unfinished quest still displays its actual progression lock.

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

Phones (≤ 700 px, #687, 14 November 2026): the learning coach is laid out
**above the board, never over it**, for every learning step including the quest-1
intro. Its full text stays visible (no internal clipping). Since #690 the coach
reserves **one height for the whole lesson** (its longest step at the current
screen size), so the board keeps the **same size on every « Suivant »** and guided
step. The board only gives back what that reserve pushes past the bottom of the
screen: free space below the actions is used first (390×844 keeps a full-size
board), down to a playable minimum of 180 px. The fit is measured in content
coordinates (a header scrolled out of view counts) and is re-run when controls
around the board change size, never on a step change. On short phones
(height ≤ 700 px) the attempt controls (Pause/Abandonner) and the progress line
are hidden during the guided lesson so the reserve fits (360×640: stable 219 px
board); « Passer le tutoriel » stays in the coach. On very small screens (320×568) the action row may
then extend below the fold; those actions are disabled during guided learning and
the coach's own « Suivant » stays visible. Since #749, tablets and desktop use the same
placement above the board, because they use the phone layout; the wide-screen placement described below is no longer reachable. Account screens (#688) always win: the coach stays below them,
is hidden while one is open, and resumes at the same step when it closes.

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

Show at most six constellation cards per page: 2×3 at every width since #749, using the same DOM/component and pagination. Cards show silhouette, name, earned/total stars, progression lock/completion and an optional mastery indicator for all mastery-eligible quests in that constellation. Previous/Next and horizontal touch swipe change the page without changing progression. The final partial page contains only actual cards. The main modal height remains bounded even with dozens of Adventures and hundreds of constellations; use horizontal navigation rather than vertical stacking.

Every constellation, including canonical-only entries such as Dauphin, uses the same quest grid, four-slot badge cards, current-quest treatment, lock icons, shared badge legend and star card. Resolve cards from the selected stable constellation ID, never a dormant numeric index. Canonical star cards use the licensed atlas and completed canonical quest count. The two rows of cards stay compact on desktop so the legend, star card and challenges action remain inside the sheet. Hidden panels stay visually hidden after refresh.

Selecting an unlocked constellation opens its detail in the same sheet: quests, performance badges and stars, with a **Toutes les constellations** back button. Touching a completed quest opens its **bilan** (#695): the read-only review described under the victory screen. Its « ↻ Rejouer » keeps the previous replay behavior, including the badge cooldown dialog. Mes défis stays reachable from the main sheet. Keyboard navigation is contained in the modal, Escape closes the appropriate notice/sheet, and notices restore focus. Long current-quest labels truncate on mobile so Mon ciel remains reachable.

Fiches des constellations (#853). An independent information button on each
overview card and beside the constellation name in its detail opens the same
modal. Closing with the explicit button or Escape returns keyboard focus to the
trigger. The selector inside the modal gives offline access to all educational
entries, including those in locked Adventures. Reading a fiche does not open a
constellation or grant access to its quests. The information controls stay hidden
during the existing introductory sky tour.

Browsing and progression are separate: opening Mon ciel from a board or its victory returns to that played quest's Adventure, constellation and page. Its stable constellation identity takes priority over a dormant legacy index or an earlier browsing choice. Explicit teaching destinations remain supported. Consulting a previous Adventure does not change the board, current attempt, unlocked quest or rewards. A refreshed access model must invalidate an inaccessible viewed Adventure and return to an accessible view. Browsing preference is intentionally not persisted across reloads.

The first guided visit after quest 2 now teaches five real zones in order: Ciels/Aventures, constellations, quests, performances, constellation drawing. Each step reveals the corresponding overview/detail pane. The first tour cannot be skipped by closing the sheet or touching the backdrop; only its final step offers **Jouer la quête 3**.

Finishing an Adventure shows a brief summary of its constellations, stars and earned performance badges. **Découvrir l’Aventure suivante** opens the next available Adventure for consultation, or its lock notice when unavailable; it never grants access or advances an unsolved quest. The actual final campaign quest retains its full-sky celebration.

## Success/reward UX
Victory should feel meaningful: quest accomplishment, stars and constellation reveal/milestones. The sky/constellation is the long-term progress visualization, not a collection of legacy rank names.

## PWA/share friction
Do not ask for installation before the player has experienced value. Current threshold (`maybeOfferInstall`) is after 12 solved quests, outside onboarding, the account gate and other dialogs, at most once a week after « Plus tard ». Exception (#748): a visitor who chose « Installer sur mon téléphone » or scanned the QR code on `decouvrir.html` arrives with `?install=1`. The request is removed from the URL before the first-visit welcome reads it. The sheet is offered once, right after that welcome, with the native prompt or the exact manual steps (iPhone: Partager → Sur l’écran d’accueil; otherwise menu ⋮). It stays tappable during the scripted tutorial. Do not re-prompt standalone installs. The account menu offers « Inviter des amis » to guests and signed-in players. « Partager ma réussite » is available on the confirmed victory screen alongside the separate challenge action. Both share the public discovery page, with a copy and manual selection fallback. They are optional and do not introduce a learning milestone. See the [sharing audit and release checks](marketing/PARTAGE_LUMEN.md).

## Performance perception
Touch interaction should feel immediate. Full board rerenders during drag are specifically prohibited because they create unnecessary mobile work and visual instability. Performance tests around cell and board painting protect this.

## UX cleanup #16/#17/#19

Missing direct exclusions use “Marquage manquant” and “écarter”, replacing the obsolete water-themed message. Remaining hint instructions also use “écarter” instead of “éteindre”. Hint pedagogy follows a simplest-valid-explanation rule: a forced single in a territory is preferred first, then row/column singles, before locked/group deductions. Generated French must stay natural and grammatically correct. After victory, “Quête suivante” is the highlighted primary action; sharing remains secondary. The success card scrolls within the viewport on compact screens so the action stays reachable.

Detailed rules are available through “? Revoir les règles” instead of a permanent paragraph below the board. The modal supports its close button, Escape and a backdrop click, then restores focus to the help button. Consultation preserves board/progress and the scripted teaching step; clicks in the modal must never advance onboarding.


## One responsive game UI

Lumen uses one game DOM, one game state and one set of gameplay handlers across phones, tablets and desktop. **Since #749 there is also one layout:** computers and tablets show the phone layout in a centered column of at most 520 px. The board grows up to the column width but leaves room for the header and actions on short screens; « Mon ciel » stays in the same column. There is no left journey workspace, no right message workspace, and no 3×2 constellation page. CSS keeps a single wide-screen block (`@media (min-width:701px)`, the #749 column). Phone width conditions apply at every width, except the rules for landscape phones. Do not reintroduce desktop-only layout rules without a product decision.

JavaScript must not re-parent gameplay or progression components based on viewport width. A breakpoint may change presentation, but not which implementation is active. Interaction differences must be capability-driven: for example, drag-to-exclude is implemented with Pointer Events and ignores mouse pointers rather than assuming that a narrow viewport is touch-capable.

Do not introduce parallel `MobileX` / `DesktopX` gameplay components. If a compact presentation is needed, adapt the canonical component with CSS and preserve the same state, semantics and handlers.

## Social challenge UX

**Espace social (#898, Lot 4).** One 👥 icon at the top right of the game header
(`#openSocial`, accessible name « Espace social », `aria-expanded`) opens a single
panel with, in order: Défi du jour (only when #882 reports it available), Mes
défis, Classements, Mes amis, Notifications, Inviter des amis. The panel only
routes to existing screens; it never opens by itself and nothing animates. One
global badge adds the two validated #35 counters (pending friend requests and
received friend challenges; unread link-challenge results), which now sit inside
the panel rows, so nothing is counted twice. « Classements » keeps the quest
rankings (#638, opened from a completed quest in Mon ciel) apart from the Défi du
jour rankings (général / mes amis). The Défi du jour keeps its direct entry in
« Mes quêtes ». Guests keep link challenges and the invitation and read why
friends and notifications need an account. Copy lives in the `social.*` domain
(`src/ui/locales/{fr,en}/social.js`, reviewed by `i18n-audit.mjs`). Captures:
`docs/validation/social-hub-*.png`.

« Amis et défis » (#35, row « Mes amis » of the panel) stays an optional screen,
never on the game screen and never inside a grid. Guests see why friends need an account and
keep playing link challenges. Friends are added by exact nickname; « Envoyer à un
ami » appears in the challenge share dialog and on each « Mes défis » row. Statuses
read « En attente / Commencé / Terminé / Abandonné ». The four intents stay
distinct: Partager (show an achievement), Défier (play this grid), Inviter
(discover Lumen), Ajouter un ami (persistent relation).

The « Défi du jour » (#882) has its own recognisable skin — deep night-sky
blue/violet background with static stars, a gold « Défi du jour · date ·
1 tentative officielle » banner above the grid and a gold frame around it — while
the grid itself (cells, Guardians, territories, marks, hints, errors) keeps the
campaign look and meaning. No permanent animation, no badge promise in this mode,
« Continuer » stays the primary action of its result. Details and captures:
[DAILY_CHALLENGE.md](DAILY_CHALLENGE.md).

Keep the challenge loop celestial and performance-led, not leaderboard-heavy. Before play, show who sent the challenge and the one-attempt rule, but hide the sender's time/badges. After play, reveal both performances side by side and describe differences factually.

A remarkable Mastery on a qualifying run deserves stronger visual emphasis around “Défier”, while “Quête suivante” remains the primary campaign continuation. Since #889 a qualifying replay may challenge; its wording never claims a first try (« Maîtrise en rejeu qualifiant ») and the reference shows « Rejeu qualifiant ».

The current social RPC protocol supports historical numeric quest identities.
For a first victory on a canonical-only quest, show the challenge action disabled
with “Les défis sont disponibles uniquement sur les quêtes historiques.” This
existing limit is explicit, not a Mastery requirement. Do not substitute the new
visible ordinal for a historical grid identity. A replay inside the qualification
cooldown hides the action and explains it (« Défier demande une tentative
qualifiante… Réessaie dans N min »); a qualifying replay, including an old save
without performance metadata, may challenge (#889). On a constellation/Adventure scene at
heights up to 700 px, « Partager ma réussite » shares the 38 px height of the other
celestial actions and the card spacing tightens, so « Défier » + « Partager » still
fit without scrolling at 360×640 (#705).
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

“Mes défis” belongs to the Espace social panel (#898). New results use a small unread indicator. Push permission must be requested contextually (“Préviens-moi quand quelqu'un relève mes défis”), never as an unexplained first-launch permission prompt.


### Fluid onboarding (#569 / #576, product decision 25 October 2026)
Quest 1 retains SEE → UNDERSTAND → ACT and real manual exclusions. Its result
recalls manual marking. Quests 2–5 are free play:
dismissible contextual advice explains drag (2), badges (3), then long press (4).
No automatic generic tutorial or mandatory sky tour interrupts this chain.
Help and Mon ciel remain available voluntarily. Ordinary victories retain one
shared result with earned stars/badges, primary **Quête suivante**, secondary
**Mon ciel**. Advancing requires an explicit action and existing catalogue access.
Constellation/adventure/finale handling is preserved; #575 remains separate.

### Progressive assistance choices
Marquage auto is retired (#647); all marks remain manual. Historical preferences
are preserved but ignored. No quest-six checkbox lesson or blocking unlock remains.
Assistance prevents Autonomie, Sans erreur and Maîtrise; Rapidité remains possible.
This is independent of the unchanged guest boundary: six visible quests may be
completed before registration is required to continue. No lock is bypassed.

When the player reaches the autonomy milestone (quest 11), explain the **Contrôle guidé** choice. The player may turn it off and may re-enable it later. The important distinction is intervention, not the visual toggle alone: keeping guided control enabled does not invalidate an attempt unless it actually prevents/corrects an error. An intervention counts as assistance and removes Autonomie/Sans erreur/Maîtrise; Rapidité remains available. Teach trade-offs without shaming assisted play.


### Badge learning milestones
All four performance badges are available from quest 1 (#529). Name them during the objective step without interrupting SEE → UNDERSTAND → ACT. Quest 3 explains conditions, without announcing an unlock; quest 6 connects the same conditions to assistance choices. Missing badges are discreet/grayed, earned badges are illuminated; neither uses a lock. Rapidité means less than 60 seconds; Autonomie means no effective assistance; Sans erreur means no effective assistance and no confirmed wrong Guardian; Maîtrise requires those three on the same qualifying run. Immediate correction/undo of a pending wrong Guardian does not commit the mistake. Keep the existing fifteen-minute qualification cooldown. Assisted play remains a valid choice.


## Onboarding is coupled to product rules
Treat learning content as a live projection of the product, not static copy. A change to when or how a mechanic becomes available must trigger a review of every place that teaches that mechanic: rules, gestures, assistance, badge eligibility, unlocks, progression, Mon ciel, success flows and terminology.

Where possible, compute a teaching milestone from the same rule used by gameplay rather than copying a quest number into onboarding. If a mechanic deliberately needs a fixed pedagogical delay, document that exception. Every rule-changing PR must state its onboarding impact.

Milestone dialogs must respect `hidden` even when their visible layout uses `display:flex` or an inline display value. A hidden badge/assistance introduction must neither cover the board nor receive pointer input. Keep a visible/hidden browser regression for both dialogs.


### Sans erreur feedback rule
Sans erreur must never become an implicit correctness assistant. A wrong Guardian may be tracked internally as pending, but the UI must not change its color, sound, message, haptics or badge-state indicator. If the player removes or immediately undoes that Guardian before another logical board mutation, the pending error disappears. Otherwise it becomes a committed error for that badge run.

Reset is a game action: a small ↺ icon button first in the command row under the grid (#858), narrower than Annuler, Vérifier and Indice, with the accessible name « Réinitialiser la grille »; the header keeps only technical controls. It only clears the placements, in every mode (#851): elapsed time, assistance and committed errors stay counted, as stated by its confirmation. « Rejouer » is the only fresh run. On the result screen, the private record and the best ranked time are shown side by side when they differ (« Record personnel : 0:54 · Meilleur temps classé : 1:11 »), with the current run's proven status: confirmed, not better than the ranked best, outside the 15-minute window, not qualifying, or pending. No cause is invented.

On a short landscape screen (height ≤ 500 px, e.g. iPhone Safari with its bars) the game uses two columns: information and controls on the left, the grid on the right, sized to the real height (#830).


## End-of-campaign celebration
The final currently available quest is not a normal success. Its global ending
has priority over Adventure, constellation and ordinary quest results, in the
same single celestial scene. Explicit copy confirms completion of all currently
available content, with catalogue-derived quests, constellations, stars and all
four badge counts. Post-game actions retain access to Mon ciel and missing
badges. No second finale opens after the player chooses an action.

### Sign-up confirmation (#814)

After the mail service accepts sign-up, announce the confirmation in the live status and tell the player to check their inbox and spam folder. A pending or rejected request keeps the form visible with its own feedback. Keep one submission in flight when the player changes tabs or closes the dialog. Confirmation does not imply mail delivery or a cloud save. A separate resend would need a dedicated provider operation under the existing server limits.

### E-mail link verdict (#820)

After an e-mail link, show one full-screen verdict. Success says « Adresse
e-mail confirmée ! Ton compte Lumen est prêt. » with « Continuer mon aventure »
when signed in, otherwise « Se connecter ». An expired, reused or invalid link
says « Ce lien n’est plus valide » and offers sign-in or a new recovery link;
it never mentions success. Recovery failures name the cause (rate limit,
network, unconfirmed sending) with the same copy for unknown addresses.

A recovery link opens its own full-screen step: « Choisis ton nouveau mot de
passe », « Ton lien de réinitialisation a été vérifié », fields « Nouveau mot de
passe » and « Confirmer le mot de passe », button « Enregistrer mon nouveau mot de
passe » and a quiet « Plus tard ». Errors appear under the fields without
clearing them. Success reads « Mot de passe modifié ! » and stays on screen until
the player continues or signs in.

### Installed app first opening (#832)

An installed app opened on empty storage asks first: « J’ai déjà joué —
Retrouver ma progression » (primary, sign-in) or « Commencer une nouvelle
aventure » (secondary, confirmed by a second tap). A folded help explains the
five steps for a Safari guest without promising automatic recovery. An iOS
guest's install sheet warns to create an account and sync first, with « Créer
un compte d’abord », never blocking the install. Loading copy is « Chargement
de ton ciel… ».

### Adventure offer and progress (#811)

Inside « Le savais-tu ? », give the 100% mastery rule and the remaining work on separate lines. Show only the measures that remain. If the profile is loading or unavailable, explain the status without showing counts. Once both measures reach zero, offer the existing sign-in or server verification action. A verified mastery entitlement confirms that free access is available. Keep the paid options separate and retain the existing height limit of the mobile notice.

### Celestial milestones and progressive mastery (#575 / #519)

Audit: `showSkyReveal` owns the shared quest result, licensed astronomy and
explicit Next/Sky actions. The old Adventure notice and global ending could
follow that result as another popup. Completion now projects a before/after
confirmed victory over stable catalogue membership: global ending > Adventure
> constellation > ordinary victory. Missing badges never prevent completion.
Artwork comes from `astronomicalPrimarySvg`, preserving HIP geometry, cyan
lines and secondary earned lights. No introduction or cockpit changes belong
to this lot; #588/#590 ordinary continuation and account preferences remain.

Constellation: last light (0–0.6 s), cyan trace (0.6–1.8 s), gentle breathing
(1.8–2.8 s), resting final state by 4 s. Copy: “[Name] brille à nouveau !” and
“Une nouvelle lumière a retrouvé sa place dans le ciel.” Adventure: the last
constellation leads, existing figures appear in cascade (1.5–3.5 s), then a
subtle Milky Way (3.5–5.5 s), resting by 7 s. Copy: “Aventure accomplie” and
“Chaque étoile retrouvée a repoussé l’obscurité. Ensemble, elles ont redonné vie
à ce ciel.” Reliable scope recaps use acquired quests/stars and named badges.
Narrative copy fades in during the conclusion (2.8–4 s / 5.5–7 s), with its
layout reserved from the start; actions stay available until the player chooses. “Passer
l’animation” stops decoration; reduced motion shows the final state immediately.
Next-constellation / next-Adventure requires an existing access decision and a
real unfinished quest. Otherwise return to Mon ciel. Reviewing an Adventure
uses existing map/replay navigation, without replaying its cinematic.

Mastery in Mon ciel is separate: acquired eligible badges / currently possible
badges, continuously scaled from 0 to 1. Empty scopes yield 0; catalogue growth
recomputes the denominator without revoking historical awards. Versioned legacy
and canonical badges retain existing qualification semantics; Mastery is never
inferred from three separate historical facts. A fixed bounded dust composition
seeded by stable constellation ID sits behind cyan geometry. At 0 there is no
added layer; 25% reveals dust, 50% richer light, 75% an identifiable band and
100% a subtle signature. No crowns, opaque clouds or permanent animation.
Only real badge additions queue a short owner-scoped in-memory pulse; opening,
reload, Auth, restored acquisitions or catalogue changes cannot queue one. It is
consumed by the next visible rendering and is not a persisted reward.
Repeated map refreshes retain the same short playhead rather than restarting
the animation. Recovered receipts, retrying old durable intents and remote
acquisition batches remain visually silent.

Comparable previews: [0/25/50/75/100%](validation/celestial-preview.html), generated
from the shared SVG components for a small figure, a large figure and an
additional-light figure. Native mobile and desktop milestone captures accompany
the PR; physical-device artistic acceptance remains separate.


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
rules, without crediting the pending reward locally.
The shown clock freezes at local victory detection on the official time
(penalties included); network work never moves it, and editing the board again
resumes it (#698). When a durably captured win is still unconfirmed after
2.5 s, the pending result is shown while the command continues, then
upgraded in place to the confirmed celebration (#697). Pending copy stays calm:
reconnection is requested only for an authentication hold. Existing hint prices,
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

For small play viewports, an open hint participates in the layout and scrolls
within its own card. The board fits the remaining space; short landscape views
place it beside the controls and hint. Territory rendering and cell input stay
unchanged. Closing the hint restores the ordinary layout.

At the catalogue-driven guest discovery boundary, the account dialog explicitly
asks for a free account to continue and recover progress. Creating an account
and signing in remain available through the existing form and Google action.
Dismissal allows browsing; trying an account-locked quest opens that explanation
again without starting it. Access and guest transfer rules are unchanged.

A completed quest in its ready replay state offers « Quête suivante » when its
immediate catalogue successor is accessible. Starting the replay hides this
shortcut. Navigation rechecks live access and grants no completion or reward.
Challenge and learning-only replays retain their existing navigation; notably,
the quest-2 victory still introduces Mon ciel.
## Aides hors ligne (#803)

Indice et Vérifier restent accessibles sur une quête ouverte hors ligne.
Le chrono officiel affiche la pénalité aussitôt et la tentative conserve le
compte d’aides. La récupération de l’historique de synchronisation reste visible
dans le diagnostic du compte.
## Records personnels (#600)

### Aides sur la grille (#791)

Contrôle guidé, Indice et Vérifier affichent leur texte sous la grille, à
partir de son bord inférieur. La taille et la position de la grille restent
stables pendant l’ouverture et la fermeture. Le panneau occupe
temporairement la zone des commandes et respecte la zone de sécurité
inférieure. Le texte défile dans le panneau et le bouton reste accessible.
Fermer l’explication du Contrôle guidé rend les commandes accessibles et
laisse la correction du Gardien à effectuer.

### Classement (#638)

Écran unique de victoire (#682), dans un ordre constant : constellation et
progression (« 6 / 10 étoiles »), cinq badges sur une ligne (+étoile, Autonomie,
Rapidité, Sans erreur, Maîtrise ; un badge non obtenu reste visible, atténué),
bloc « Ta performance et ton classement » (temps final, record, rang, podium),
puis « Quête suivante » pleine largeur et une rangée Mon ciel | Défier | Rejouer.
Chaque zone a sa place dès la première image : le podium arrive dans un
emplacement réservé (squelette de même gabarit), sans déplacer les autres zones.
Le podium apparaît dès la fin de l’animation des badges (#794). Le toucher
et le clavier peuvent accélérer cette transition. Les animations du ciel
continuent dans le même écran. La lecture du classement peut commencer en
parallèle. Si elle est encore en cours, l’emplacement indique son chargement.
Le rang personnel, le motif de non-classement et l’explication du défi suivent
le podium dans le flux. La hauteur s’adapte aux textes longs et au zoom.
Podium à trois marches 2–1–3 de hauteurs décroissantes 1 > 2 > 3 ; seule la
marche du joueur est mise en évidence. Hors podium : « Classement : Ne place ».
Aucun compteur de joueurs (réels, virtuels ou total) n'est affiché. Les messages
« 1re/2e/3e place ! » n'apparaissent que pour un rang confirmé par le serveur ;
« Tu prends la tête du classement ! » seulement si aucun Écho n'est sur le podium.
« Nouveau record ! » suit une amélioration confirmée.

Victoire en attente (#682 périmètre I, #699) : une victoire locale durable dont
le serveur n'a pas encore confirmé la commande utilise **le même écran unique**,
jamais l'ancienne carte `successOverlay` « Quête résolue ! ». Même ordre et même
géométrie. Le surtitre « QUÊTE RÉSOLUE » est accompagné de « Victoire conservée
sur cet appareil ». La progression affiche l'étoile attendue en « 1 en attente ».
Les cinq badges sont en pointillés « en attente », sauf ceux déjà confirmés.
La tuile de rang indique « Classement après confirmation ». L'emplacement réservé
du podium porte le statut (« confirmation cloud en attente » ou « Hors ligne ») et
« Réessayer la sauvegarde ». « Réessayer la sauvegarde » renvoie la même opération figée sur place, sans recharger la page ; la confirmation met l’écran à jour. Si la session cloud ne peut pas relancer ici (non prête, profil en écriture) ou si d’autres victoires restent en file, la resynchronisation complète précédente (rechargement) s’applique ; hors ligne, rien n’est tenté et la reconnexion relance automatiquement. « Quête suivante » et « Mon ciel » restent actifs ;
« Défier » et « Rejouer » restent à leur place mais désactivés jusqu'à la
confirmation. Rien n'est crédité, aucun rang ni défi n'est annoncé avant
l'accusé serveur. À la confirmation, le même écran est mis à jour sur place,
sans relancer l'intro ni l'animation d'étoile, sans déplacer de zone. La
célébration ne fait que s'amplifier si le niveau monte.
Badge Étoile (#706) : une quête accomplie possède toujours son étoile. Sur un
rejeu ou une victoire récupérée, l'emplacement est « déjà obtenu », jamais grisé.

Célébration graduée partagée (#682) : un seul moteur pour toutes les quêtes et
rejeux, sans condition sur le numéro de quête. Niveau 1 victoire, 2 record ou
badges remarquables (Maîtrise nouvelle ou deux nouveaux badges), 3 podium #2/#3
confirmé (ou #1 avec Échos), 4 première place confirmée sans Écho ; une
constellation terminée ajoute un accent céleste. Un rang tardif ne fait
qu'amplifier, sans relancer ni déplacer. Calibration centralisée dans
`CELEBRATION_CONFIG` (`src/ui/victory-celebration.js`) ; aucune particule
en mouvement réduit. Lumen est joué en portrait (manifeste `portrait-primary`).

Bilan d'une quête terminée (#695, décision du 14/11/2026) : toucher une quête
terminée dans Mon ciel ouvre son bilan sur la même surface que la victoire, dans
sa composition finale, mais en **lecture seule** et **sans aucun effet** :
- en-tête « TON BILAN · QUÊTE N » et constellation ;
- record officiel de la révision de grille courante, ou « Pas encore de temps
  officiel sur cette version de la grille » ;
- étoile et badges enregistrés à l'état « déjà obtenu » (jamais « nouveau ») ;
- podium lu sans envoi ni animation, avec des messages neutres hors ligne ou en
  erreur.

Seuls « ↻ Rejouer » (entrée de rejeu existante, délai des badges compris) et
« ✦ Mon ciel » (refermer) sont proposés : ni « Quête suivante » ni « Défier »,
puisqu'un défi naît d'une tentative qualifiante jouée, pas d'une consultation. Rien n'est écrit (`src/ui/quest-review.js`). Les égalités et l'ordre déterministe restent calculés sur tous
les scores côté serveur. Aucun défilement de liste ou de page.

Les profils « Écho … » portent toujours une mention « Écho virtuel » pour les lecteurs d’écran. Leurs temps fixes sont
des objectifs conçus à partir de la difficulté, pas des performances humaines.
Un joueur réel remplace un Écho jusqu'à leur disparition à dix participants.
Aucun faux effectif humain ou percentile. Participation automatique sous pseudo
unique après activation juridique et information ; opposition persistante et
réinscription explicite depuis Compte. Réseau/API indisponible : classement
en attente, jamais de blocage de Quête suivante/Mon ciel. Réduction des mouvements :
position finale immédiate. Les contrôles annoncent Vérifier +5 s, Indice +15 s
et Contrôle guidé +5 s par intervention. Le chrono augmente aussitôt, avec un
bref +5 s / +15 s sans déplacement de grille ; il continue à compter normalement.
La durée réelle reste une donnée technique ; les anciennes préférences de
marquage automatique restent inertes.
Sur mobile, le Contrôle guidé et l’indice utilisent le même panneau sous
la grille. Le Gardien à corriger reste visible pendant la lecture.

Afficher un seul meilleur record officiel comparable à la révision de grille
dans le masque de départ d’une quête déjà réussie. À la victoire confirmée,
le récapitulatif montre la tentative officielle et le meilleur record officiel.
Une amélioration strictement inférieure annonce une seule fois « Nouveau record ! »
après preuve serveur ; égalité et amélioration du seul temps réel ne suffisent pas.
La carte du classement ne répète pas cette annonce. Une courte lueur accompagne
le nouveau record ;
aucune fenêtre supplémentaire. La lueur respecte reduced-motion. Les victoires
en attente ne revendiquent pas de record confirmé. Les essais non qualifiants
restent utiles pour améliorer le temps, sans changer les badges.

## Catalogue complet et final du ciel

Les neuf aventures utilisent les mêmes cartes et la même pagination ; la dernière
affiche huit constellations, sans cases manquantes. Les intitulés et récits des
aventures 6–9 viennent du catalogue. La dernière s’intitule « Le ciel réuni ».
La célébration existante annonce séparément toutes les quêtes terminées et tous
les badges éligibles acquis (« Le ciel pleinement maîtrisé »). Une seule priorité
visuelle s’affiche si les deux seuils coïncident. Une restauration, un réessai de
reçu ou une ouverture de carte ne rejoue pas ces événements. Le panorama reste
borné aux constellations de l’aventure jouée ; le bilan global et Mon ciel donnent
accès au catalogue complet. Le composant conserve clavier, animation réduite,
tap de la surface pour accélérer et retour à Mon ciel. Aucun tutoriel ni règle d’aide ne change.


## Reconnaissance de la maîtrise d’aventure (#627)

Le panorama existant annonce « Une aventure pleinement maîtrisée » avec une lumière dorée discrète ; Mon ciel conserve un fond doré rempli, ✦ et le libellé visible et accessible « Maîtrisée » sur l’aventure. Le fond reste doré quand une autre aventure est sélectionnée ; un bord cyan indique la sélection, indépendamment de la maîtrise. Les aventures simplement terminées conservent leur aspect habituel. Le marqueur reste statique après rechargement. Une seule scène apparaît lorsque les seuils coïncident. Clavier, tap de la surface, mouvement réduit et retour à Mon ciel restent disponibles.

Fin d’aventure (#705) : les célébrations de constellation, d’aventure et de ciel n’offrent plus « Revoir mon aventure », qui doublait la navigation vers Mon ciel. Un seul retour au ciel reste proposé (« Admirer mon ciel », ou « Mon ciel » à côté de « Découvrir l’aventure suivante »). L’explication d’indisponibilité d’un défi n’apparaît que si un défi est proposé. Sur téléphone (360×640, 390×844), tout l’écran tient sans défilement vertical : sous 700 px de hauteur, les espacements, le titre, le récapitulatif et le panorama sont resserrés. La hauteur de la carte tient compte des zones de sécurité iOS/Android.

Impact onboarding #627/#629/#632 : les règles, tarifs et seuils pédagogiques restent inchangés. Le glissement devient continu ; les aides hors ligne respectent les preuves et réservations existantes. Aucun nouvel enseignement nécessaire.

## Victoire et podium compact

Une seule surface attend la fin effective des animations finies, sans attendre les
effets ambiants infinis. Un tap/clic sur toute sa surface ou Entrée/Espace/Échap
consomme la première activation et révèle le résultat sans action derrière. Aucun
bouton Passer n'est ajouté. Reduced-motion présente le résultat immédiatement.
Le podium montre trois temps (premier au centre), puis la position personnelle
et le nombre réel de participants, sans répéter la ligne du joueur du podium.
Les récompenses restent accessibles. Les apparitions durent environ 2,3 secondes
sans déplacer les commandes. Les petites hauteurs réorganisent la scène en
colonnes ; podium, résultat et page ne défilent pas. Le choix de participation et
le pseudo unique se gèrent depuis Compte. L'étape Découvrir Mon ciel en quête 2
et les enseignements des badges gardent leurs destinations et conditions.

Changement de compte (#711) : tant que la progression du compte qui vient de se connecter n’est pas installée, un écran plein « Changement de compte — Chargement de la progression de ce compte… » remplace l’application ; on ne voit ni ne joue jamais la progression du compte précédent. Hors ligne ou en cas d’échec, il explique la situation et propose « Réessayer » et « Se déconnecter ». Animation coupée en mouvement réduit.
Après une déconnexion explicite, un écran neutre « Tu es déconnecté » (« Se connecter », « Créer un compte ») remplace la progression du dernier compte, y compris après un rechargement. La fenêtre de connexion s’ouvre au-dessus. Rien n’est effacé de l’appareil. Une session simplement expirée, le jeu hors ligne et un nouvel invité ne sont pas concernés. On ne propose pas de jouer en invité : ce mode utiliserait le même cache local que le compte précédent.

Outil de test admin (#705) : le cockpit admin (« Outils de test ») propose « Aperçu : aventure pleinement maîtrisée ». Il ouvre la vraie célébration de maîtrise pour l’aventure de la quête en cours, sans défi proposé et sans rien écrire (progression, badges, tentative, sauvegarde). Il est refusé pendant une victoire ou une victoire en attente. Comme une vraie victoire finale, l’aperçu remplit lui-même le bloc de performance : meilleur temps enregistré de la quête en cours (ou « Pas encore de temps officiel… » en texte réduit), badges enregistrés et vrai classement de cette quête (podium compris), sans jamais reprendre l’état d’un écran précédent. Avec le podium, l’écran de maîtrise tient sans défilement en 360×640, 390×844 et 412×915 : sous 700 px de hauteur, podium compact (118 px), titre « Ta performance et ton classement » réservé aux lecteurs d’écran et panorama limité à 23 % de la hauteur.

## Offre d'une aventure verrouillée (#731)

Dans la TWA Play, les prix viennent exclusivement de Google : « Chargement du
prix… » pendant la requête, puis montant et devise localisés. Une erreur ou un
produit absent affiche « Prix indisponible », une explication et « Réessayer ».
La carte ouverte se rafraîchit à réception ; un CTA sans prix, canal ou contenu
valide reste désactivé, y compris après le paiement d'une autre carte. Aucune
redirection Stripe en cas d'échec Play. Voir le diagnostic dans `android/PLAY.md`.

Toucher une aventure verrouillée (cadenas) dans Mon ciel ouvre la même fenêtre qu'avant, qui présente désormais l'offre au lieu de « déverrouillage annoncé plus tard » :
- « Débloquer cette aventure · 1 € » et « Tout le vrai ciel · 5 € », avec « Tes achats à l'unité comptent : tu ne paieras jamais plus de 5 € au total ». Les boutons d'achat restent désactivés, avec la mention « Paiement bientôt disponible », jusqu'au branchement d'un fournisseur (#729, #730).
- Le chemin gratuit : « Gratuit : maîtrise « X » à 100 % (il te reste N quêtes et M badges) ». Ces chiffres viennent du catalogue et de `celestialScope`. Quand la maîtrise est atteinte, un bouton « Débloquer gratuitement » demande au serveur de vérifier (#728). Un invité est invité à se connecter.
- « Sans pub, financé par les joueurs ✨ », avec « Pourquoi ? » qui déplie le texte du petit studio indépendant. La formulation exprime une intention, jamais une promesse d'absence de profit (#732).
- Un verrou de constellation garde sa raison (quêtes précédentes) ; les sessions QA ne proposent jamais de créer un compte.
- **Accord exprès avant de payer (#732)** : là où un achat peut démarrer (joueur connecté, paiement disponible), une case **jamais pré-cochée** « Je demande l’accès immédiat à mon achat et je renonce à mon droit de rétractation de 14 jours. » précède les boutons. Sans elle, toucher un bouton d’achat n’ouvre pas le paiement : un message invite à cocher la case et le focus y est placé. Un lien « Conditions générales de vente » (`/cgv.html`) reste visible sous l’offre dans tous les cas.
- **Pas de bouton « Restaurer mes achats »** (décision du propriétaire, 17/11/2026, #730 ; remplace le bouton livré par #731). Un achat est un droit du compte : il réapparaît seul sur tout appareil connecté. Après chaque hydratation vérifiée, Lumen revérifie sans rien afficher les achats Google Play (dans l'application Play) et les paiements Stripe non encore réglés (sur le Web) ; les droits ne sont rechargés qu'après une confirmation du serveur.
- **Remerciement après achat (#730)** : une fois l'achat confirmé par le serveur et les droits rechargés (jamais sur la seule URL de retour Stripe), une fenêtre « Merci pour ton soutien ✨ » nomme l'aventure débloquée (ou « Tout le vrai ciel »), rappelle que l'achat est lié au compte et retrouvé sur tous les appareils connectés, et explique en une phrase que les achats aident à financer l'hébergement et les prochaines aventures (une intention, jamais une promesse). Boutons « Explorer l'aventure » (ou « Explorer mon ciel ») et « Plus tard » ; Échap ou un toucher hors de la carte ferment la fenêtre.
- **Entrée indépendante (#783)** : « Explorer l'aventure » ouvre le détail de sa première constellation. Une aventure possédée commence immédiatement ; ses propres quêtes restent séquentielles. Pendant le chargement des droits, Mon ciel indique « Vérification des droits… » ; une erreur indique des droits indisponibles, sans proposer un nouvel achat. L'apprentissage initial et les jalons existants restent inchangés.

## Bilans et offres — #784 / #786

Le bilan permet de consulter la quête canonique immédiatement voisine avec un
swipe horizontal (gauche : suivante, droite : précédente) ou les flèches du clavier.
La cible doit passer les mêmes gardes que Mon ciel ; aucun saut de quête verrouillée.
Une quête disponible mais inachevée affiche « À jouer », sans record ni récompense.
Seul le bouton Jouer/Rejouer lance une grille. Les réponses de classement et de
record devenues obsolètes sont ignorées. La consultation ne relance aucune fête,
préserve les gestes depuis les bords et respecte la réduction des mouvements.
Le swipe peut partir du podium, pendant ou après son chargement. Un appui simple
garde sa cible, les boutons gardent leur propre geste et le défilement vertical
reste possible si le bilan dépasse la hauteur disponible. Le classement est
consultable au swipe dès le bilan combiné affiché.
Le bilan change sur place, avec une carte qui reste fixe et opaque au
relâchement. En mode compact, le podium réserve dès le chargement la place d’une
ligne de rang personnel hors podium, pour éviter un saut des boutons.

La boutique distingue l’aventure et « tout le vrai ciel » (les autres ciels ne sont
pas inclus). Les prix viennent du catalogue partagé avec la graine serveur, ou des
prix localisés Play lorsqu’ils sont disponibles. Les compteurs portent sur les
quêtes publiées disposant d’une grille, dans les aventures rendues accessibles par
l’offre, hors aventures déjà accessibles. Elles restent à parcourir dans l’ordre ;
un achat ne termine ni ne débloque toutes leurs quêtes à la fois. Les compteurs
attendent la vérification des droits. L’astuce gratuite indique les quêtes et
badges encore manquants de l’aventure précédente selon les règles de maîtrise.

Impact onboarding : les apprentissages et leurs destinations restent valables ;
la consultation latérale ajoute un raccourci sans changer les jalons ni les droits.

## Boutique d'aventure (#863)

Ordre : case d'accès immédiat / renonciation (avant les boutons, jamais pré-cochée),
offres « Choisir » (aventure sélectionnée et son prix) puis « Tout débloquer » (une seule
offre, celle du joueur, #865), état de l'achat, progression vers les 5 aventures, encart
de déblocage gratuit, puis un pied compact : CGV et « Un achat n'apparaît pas ?
Restaurer mes achats » (action secondaire, Google Play uniquement). Un clic sur un achat
sans la case cochée n'ouvre aucun paiement : message rouge « Cochez cette case pour
poursuivre votre achat. » sous la case (`role="alert"`, `aria-describedby`,
`aria-invalid`, bordure en plus de la couleur), focus sur la case ; le message
disparaît dès qu'elle est cochée. Aucun bandeau permanent de succès de restauration
pendant le jeu.
