# Campaign, progression and rewards

Mixed pacing applies only to Adventures 5–9. Adventures 1–4 retain their complete
published quest definitions and teaching rules. Difficulty levels for revised
content come from fixed logical score thresholds, not Adventure membership.
Constellations mix opening, intermediate peak, relief and final peak; the final
grid is strongest and average difficulty still rises between Adventures.
Adventure 9 consists exclusively of measured Master grids. Quotas derive from
actual catalogue membership, including differing constellation lengths.
Boards retained at the same stable ID preserve their records. Changed boards
have a distinct grid version and may receive an explicitly authorized scoped
reset; old rewards are never paid twice, and unaffected progression is preserved.

Explicit operator resets on replaced grids clear their completion, quest stars,
badges and personal records only for the authorized accounts and catalogue scope.
Previously started Adventures keep their access. Replaying earns fresh visible
progression and records. A server-owned `rewardedBeforeReset` marker prevents
paying first-win XP or autonomy milestones twice; economic bonus receipts,
currency, purchases and access rights remain acquired. Unplayed reset quests
still earn their ordinary first rewards. Other quests and players are untouched.
This exception is intentional revocation, rather than automatic save repair.
Onboarding impact: no teaching rule, gesture, badge condition or help flow changes.

## Source of truth

Issue #640 changes the puzzle layouts of Adventures 5–8 through a separate
gameplay revision. Stable membership, order, access cohorts, acquired rights,
completion and one-time rewards remain unchanged. Existing badges/records are
grandfathered quest achievements. In-progress boards from the old revision are
archived and restart empty; see the [restore contract](DATA_AND_ARCHITECTURE.md#cloud-persistence-contract).
The campaign is sequential and represented through constellations. The published canonical revision in `content/catalogue/access-origins.json`, `content.js` and `canonical-quests.js` owns membership, order and counts: **880 quests, 88 official IAU constellations, nine Adventures**. Adventures 1–8 contain ten constellations/100 quests each; Adventure 9 contains eight/80. The legacy numeric schedule and historical reward allocations remain compatibility data. Displayed constellation lights count distinct completed quests; they do not replace economic rewards or historical star balances. Catalogue totals are data, not permanent limits.

A quest belongs to one constellation. Each constellation has an intermediate milestone and a final/boss quest. First completion awards the quest's sky-star value; replay does not farm additional sky stars.

### Current catalogue presentation

Mon ciel cards count individually completed quests in the current canonical
constellation, including inserted quests and constellations without numeric
history. Each completed quest fills one displayed slot, as in the constellation
detail. This display does not rewrite historical star balances or rewards.
Drawing point counts are astronomical geometry, never quest totals. A completed
nonempty constellation illuminates its full reference figure; partial progress
does not announce completion. Empty groups are never complete.

Final-quest banners follow the played quest's position in its current canonical
constellation. Completion announcements additionally require every current quest
of that constellation, Adventure or campaign to be solved. Finishing the last
historical numeric quest cannot finish the expanded campaign. Existing reward
calculations and stored historical milestones remain unchanged.

Victory recaps retain acknowledged badges already owned, labelled « déjà obtenu »
separately from new awards. Such a label does not assert that the current attempt
qualified for that badge and never awards another star on replay. Badge eligibility,
same-run conditions and cooldown rules are unchanged.

Antlia access is subject to the same acquired-access rule below: an older player
may keep its historical frontier while new quests in the preceding Adventure
remain unfinished. This is not permission for a current-cohort player to skip
prerequisites, and pack ownership/authentication/hydration still apply.

## Adventures and access (#96)

After verified restoration of an existing account on an unowned device or an
account switch, the board and quest label select the account's next playable
catalogue frontier without opening Mon ciel. The previous profile and active
attempt are archived and verified before installation. Same-owner refreshes
retain the selected run/replay; a new account seeded from guest progress keeps
its guest run. This navigation grants no completion, reward or access, and
leaves social challenges and unavailable frontiers alone.

An existing same-owner cache may retain an earlier inserted catch-up quest in
READY state while its origin frontier is farther ahead. After verified hydration,
an empty, unstarted campaign selection is archived before moving to that frontier.
Started/paused runs and replay selections remain unchanged. No earlier catch-up
quest is marked completed; these remain available through Mon ciel. Failure to
verify this optional board archive keeps the selection and the account ready.

Target decisions confirmed on 22 October 2026 for the continuation of #522:
guest discovery covers the first six **visible** quests; an account is required
to start a later quest, independently of its persistence key. Already completed
quests remain replayable and a real started campaign/replay attempt remains
resumable; a READY boundary or social attempt is not acquired campaign access.
Pack ownership remains an independent guard. Account dismissal opens browsing;
it never postpones or bypasses the discovery boundary.

An acquired guest board remains playable. Beyond discovery, solving pauses and
persists that same attempt; confirming its victory/rewards requires the account,
for either saved quest format. No provisional reward is written and no prior
achievement is removed. Authenticated recovery resumes the retained solved board.

The approved convergence contract extends the existing numeric-quest rules to
all quests: fifteen-minute badge qualification cooldown, the same first-win,
autonomy/bonus and daily activity rules, and first-play social challenges.
Existing acquired rewards and Mastery remain preserved without retroactive
credits. Persistence formats and historical URLs remain compatibility adapters.
The owner authorised the server migrations on 23 October 2026; their schema and
permissions were verified after application. Rollout still requires the matching
client and an exact-SHA publication check, preserving the acquired-access policy.

The real-sky catalogue is grouped into Adventures of at most ten constellations, configured in `content.js`. The current catalogue has nine Adventures: eight groups of ten constellations, then one group of eight. The first Adventure is included; subsequent Adventures remain visible but locked unless already owned or already started by an existing player. Their unlock mechanism is deferred. The grouping size is a product rule, not a campaign-size ceiling: new Adventures are derived as the catalogue grows.

The user's migration decision is to **retain access to Adventures already started and lock subsequent unstarted Adventures**. A solved quest in an Adventure proves it was started; a locally restored campaign/replay attempt with `startedAt` also proves it, including an unsolved first quest. Merely reaching a READY quest at the next Adventure boundary does not grant access. Social attempts do not grant campaign access. `legacyAdventureAccess` retains proven Adventure IDs in the existing local progress object, idempotently; solved history restored from cloud can reconstruct access without a new entitlement or backend RPC. An unsolved local attempt has the same device-local persistence scope as before.

Keep the existing `base-real-sky`, `real-NN`, `base-qNNN` IDs and numeric saved quest keys. Later Adventures have stable `real-adventure-NN` pack IDs. The historical `baseCampaignQuestCount()`/`baseQuestId()` namespace still describes the full real-sky legacy schedule, not the size of the free Adventure. Pack metadata determines its range/access; do not equate the full catalogue with immediately playable content.

Browsing another Adventure never changes gameplay state. Loading/continuation must respect pack access in addition to sequential progression. When the next Adventure is locked, continuation shows its notice; reload offers the last accessible quest for replay while preserving the solved prefix, stars and badges. Finishing an Adventure does not automatically unlock another. Existing entitled packs still use the real entitlement model; no acquisition flow is added.

## Administrative catalogue access

Authenticated internal administrators with the server-provided `analytics_cockpit` or `all_adventures_access` capability may browse and enter every catalogued Adventure, including locked packs, without creating a purchase entitlement or persisting access into player progress. QA guest sessions never receive this override. Ordinary players retain the existing access policy. This exception affects pack access only: sequential quest progression and rewards remain governed by their existing rules.

## Admin Adventure grants (#724)

An internal administrator (`analytics_cockpit`, checked by the server) can grant or revoke a locked Adventure for one player from Analytics › player detail › « Aventures débloquées ». The server RPC `lumen_admin_adventure_access` validates the capability, the player and the Adventure id (`real-adventure-NN`, never the included first Adventure), requires a reason, and writes `lumen.entitlements` with source `admin`; each actual change is recorded in `lumen_commands.adventure_access_audit`. Retries are idempotent and not re-audited. The player reads the new state through `lumen_get_entitlements` at the next app start or sign-in.

Revocation expires the entitlement (`expires_at`); it never deletes progress, stars, badges or receipts, and an Adventure already started stays playable through the acquired-access policy above. The panel lists the catalogue's locked packs (`CONTENT_PACKS`, no hardcoded count) and shows only the state returned by the server. Payment is out of scope (#725) and will reuse the same entitlement table.

## Purchases and mastery unlocks (#728)

Adventure 1 stays free. After the #728 migration, the server grants the rest of the main sky when the account has five distinct, confirmed unit Adventure purchases across Stripe and Google Play. Purchase amounts and currencies do not enter the count. A verified whole-sky purchase grants it directly. The signed-in offer reads the remaining count from `lumen_get_main_sky_purchase_progress` after entitlement hydration and displays it only after a successful read for the active account. The #819 migration depends on #728. Future skies are separate.

Rights come only from the server, in `lumen.entitlements`:
- `purchase`: converged from the confirmed purchase ledger by `lumen_commands.sync_purchase_entitlements`. A refund or dispute expires the row; progress, stars and badges are never touched. An Adventure already started stays playable (acquired access).
- `mastery`: `lumen_claim_mastery_unlock` grants Adventure N+1 when Adventure N is 100% mastered (every quest completed, every badge in `PERFORMANCE_BADGES`). The server recomputes this from its own victory projections (`legacy_authority` for legacy quests, `quest_run_authority` for canonical quests; legacy badges count only from performance version 2, as in `celestialScope`). A canonical quest counts as completed when its projection is `solved` or records a won run (`runPerformance`); some historical projections carry no `solved` key (#728 fix). Permanent: never expired by purchases or refunds, never counted towards the cap, one Adventure at a time.
- `admin`: #724.

An owned Adventure opens its first quest immediately, independently of completion
in every other Adventure (#783). Quest prerequisites apply within that Adventure;
ownership never completes a quest or awards progress. Historical acquired access
and preserved attempts retain their existing exceptions. Mastery is a way to earn
ownership of the next Adventure, not a prerequisite for playing a purchased one.

The locked-Adventure offer (#731, `ui/adventure-offer.js`) shows both paths. The « Le savais-tu ? » section (#811) counts the previous Adventure’s remaining quests and badges using the same criteria as the server claim. Counts refresh with the live profile and stay hidden while account ownership or hydration is unresolved. At 100%, the action checks the server. The offer confirms the free unlock only after a refreshed mastery entitlement. Purchases stay disabled until a provider is connected. Google Play supplies its localized prices (#729). During #823, new Play purchases are paused until Android can bind purchases to the Lumen account. Signed-in Play players can restore existing purchases from the offer or through automatic recovery after hydration. Rights update after server verification and entitlement read-back. The whole-sky purchase option is still hidden after the first unit purchase. The Play offer shows the provider’s prices and makes no promise about a fixed total. Stripe uses the web catalogue and is available only on the web/PWA. [STRIPE_730](STRIPE_730.md) A Stripe return never unlocks by itself: the server reads the payment back from Stripe, and a full refund or a lost dispute expires the `purchase` right without touching progress. The client only asks for a mastery unlock: after a verified hydration and when a local victory triggers an Adventure mastery. A victory still pending on the server is retried at the next launch.

## Bonus quests
After the reviewed historical-command migration, authenticated victories apply
the existing `legacy-victory.js` rules on the server. Guests and explicitly older
servers retain local rules. No-hint XP remains distinct from effective assistance;
same-run mastery, qualification cooldown, one-time challenges and first-win
rewards are preserved. Pending victories keep immutable attempt/reset facts.
Every sixth quest is a bonus challenge, rotating challenge types. A successful
bonus awards **+25 XP** independently of the campaign's sky-star accounting.

## Aides et historique du portefeuille (#803)

Les aides disponibles ajoutent leur pénalité au chrono officiel sur tous les
appareils. Une utilisation hors ligne est comptée dans la même tentative locale.
Les badges, les records, les étoiles et les bonus XP conservent leurs règles.
Le compteur de victoires autonomes reste une donnée de progression, sans gain
de monnaie dans le client actuel. Les anciens soldes et reçus sont conservés
pour la synchronisation et les clients historiques. The compatibility
projection retains the previous no wallet cap rule.

## Série de lumière
A meaningful activity validates at most one calendar day: either a first campaign completion, or a qualifying replay that actually improves an eligible performance badge. Merely opening or starting a quest does not count.

The streak is continuous. One missed calendar day is tolerated as a grace day
and does not increment the streak. A second missed day breaks it. Historical
reward records are keyed by calendar day and remain available for old receipts.

Guest state is persisted locally. Authenticated daily claims already use
`lumen_claim_daily` with the server Europe/Paris calendar and idempotent daily
rewards, read through `lumen_get_daily` / `lumen_get_engagement`. Historical command
victories include that existing claim in their reward/receipt transaction and
project each unprojected daily reward once. The P0 wallet cutover adds durable
hint/verify debit commands and an atomic standalone daily projection. After
activation, legacy daily and snapshot wallet mutations are refused; existing
claim locks and day reward keys remain authoritative. Prices and badge rules
are unchanged. The retired paid-help path is retained as a compatibility protocol
for exact requests from older clients and existing outboxes.

### Série de lumière en pause (#752)
Product decision of 15 November 2026: the Série de lumière is **paused**, not removed.
- **Flags:** client `DAILY_LIGHT_STREAK_ENABLED=false` in `src/campaign/feature-flags.js`; server row `lumen_commands.feature_flags('daily_light_streak')=false` (migration `20261116090000_pause_daily_light_streak_752.sql`).
- **Hidden while paused:** the Mon ciel card and its help, the daily celebration, the "série perdue" dialog and its QA preview. The return toast keeps a neutral welcome without cycle or reward.
- **History is kept:** qualified days are still recorded (`progress.daily.dates`, `lumen.daily_progress`). The current client records days without granting currency.
- **Future reactivation:** the UI and the compatibility reward flag require separate review. A visual streak can use the existing qualified dates.

## Performance badges
Per-quest performance has exactly four badges, as implemented in `src/campaign/performance.js`:
- 🧠 **Autonomie**: solve without effective assistance.
- ⚡ **Rapidité**: solve in strictly less than **60 seconds**. Assistance does not prevent this badge.
- ✓ **Sans erreur**: solve without effective assistance and without a confirmed wrong Guardian.
- ✦ **Maîtrise**: earn Autonomie, Rapidité and Sans erreur in the **same qualifying attempt**. Never combine achievements from separate attempts.

All four badges are available from the first quest for guests and authenticated players (#529). Eligibility never depends on quest number, Adventure or global progression. A missing badge is shown as not earned, without a lock. Effective assistance, confirmed mistakes and the existing qualification cooldown still determine the outcome of each run. No historical badges are awarded automatically.

A quest has a **15-minute qualification cooldown** based on `lastQualifiedAt`; replay during cooldown remains possible but cannot improve qualifying badges. Reset/restore must preserve attempt identity and qualification metadata. See `badgeCooldownRemaining` and `mergeEarnedBadges` in `src/campaign/performance.js`.

Existing performance data must be migrated conservatively; never infer newly earned badges from an incompatible legacy record.

## Progress integrity

When localStorage cannot fit a recovery backup, verified cloud achievements can
still be restored using a read-back copy of the original in IndexedDB (#536).
Full profile installation and spending remain held until verified. A wallet-only
conflict may allow an already completed quest to be replayed when the current
account/client/generation also has server-verified completion for that stable ID.
Pack access still applies. Storage, reward, catalogue and unverified hydration
holds do not gain this permission. No previous quest, badge, balance or
entitlement is synthesized or removed by this path.

### Catalogue additions and acquired access (#470)

`catalogueOrigin` identifies the immutable catalogue at the start of a player's
campaign, not the currently displayed numbering. Revision 1 freezes the numeric
legacy campaign; revision 2 freezes the expanded canonical catalogue. New local
campaigns and empty server profiles start at the current revision. A nonempty
unversioned save uses revision 1 for compatibility; this is an explicit legacy
cohort rule, not an inferred date for individual victories.

`catalogue-access.js` owns campaign availability. Completed quests remain
replayable. The first unfinished quest in the origin catalogue remains available
after insertions, independently of newly added earlier prerequisites. Each prior
published catalogue since that origin is also checked: an unfinished frontier
acquired in an intermediate release remains playable after another insertion.
This reconstruction reads completion evidence without writing inferred wins. New quests
in an acquired constellation follow that constellation's current local order.
An adventure completed in the origin catalogue also opens the first unfinished
quest of each newly added constellation. Merely starting an adventure does not
open all its future constellations. New players follow their current catalogue
sequence. Pack ownership remains a separate prerequisite; inserted quests also
require authentication and verified cloud hydration.

Completion and immediate playability are separate presentation states (#537).
During an authentication/synchronization hold, an already completed quest keeps
its completed history, badges and label. Mon ciel explains the hold visibly and
in its accessible name; the replay button and direct start remain guarded until
their relevant domain proof is available. A current server-confirmed acquired
replay may run during Wallet review, with free help and durably pending results.
Paid help, new completion rewards and ambiguous profile installation stay held.
An unfinished quest retains its real prerequisite/ownership lock. Displaying
preserved history alone never grants a win, entitlement or permission to replay.

Map cards, the catalogue list, sky callbacks, direct starts and canonical
navigation use the same policy. Historical numeric continuation delegates to it.
Reasons distinguish missing rights, authentication, hydration, prerequisites and
unsupported catalogue metadata. Access does not solve quests or award XP, stars,
badges, currency or adventure-completion rewards. Current completion counters
still count actual victories in the expanded catalogue.

Publish additions by appending an immutable revision to
`content/catalogue/access-origins.json` and an additive server-cohort migration.
Retain all prior revisions, stable IDs and numeric save keys. The mandatory
compatibility gate rejects missing metadata, changed puzzle hashes, removed IDs
and future constellation/adventure moves. The already deployed legacy-to-current
constellation move remains represented in revisions 1–2. Other incompatible changes require a separately
specified migration; they are not silently supported by renumbering.
The origin is retained across cloud restore and old writers cannot erase or
rewrite an explicit server origin. Conflicting explicit cohorts require review.
No player backfill, storage purge or active-attempt rewrite is part of this fix.

Server rollout verified on 21 October 2026: the reviewed
`20261018200805_catalogue_origin_access.sql` was applied to the shared production
project as migration `20261021174237_catalogue_origin_access`. Before application,
the trigger was absent and no profiles had an explicit origin. After application,
`protect_catalogue_origin` is enabled on `lumen.profile_snapshots`, is security
invoker, and has no direct execute grant to anon/authenticated. No existing
profile was backfilled and no test fixture was run against player data.
The SQL regression passed in disposable PostgreSQL in CI on `5b50684` before
this unchanged migration was applied. Browser/client fixtures remain distinct
from confirmation on the originally affected phone. A schema rollback removes
only this trigger/function; never erase an origin already stored by a later write.

### Resuming after the numeric boundary (#470)

When the selected numeric quest is complete, verified account hydration selects
the next unfinished canonical quest after it if the shared policy permits it.
Earlier optional catch-up does not force a return to previous constellations.
For example, completing Grand Chien must offer Dauphin rather than repeatedly
loading the completed last numeric board. Running/paused attempts, explicit
replays, learning replays and social challenges are not redirected.

Startup restores an active registered canonical attempt by its stable quest ID
before board initialization can replace it with a numeric attempt. Its board,
attempt ID, reset count, assistance, mistakes and elapsed-time evidence remain
with the existing attempt engine. Loading a cached board does not acknowledge a
cloud write or grant a win. If authentication switches accounts, the prior
attempt is backed up and read back before replacement; it cannot become the new
account's attempt. QA and social challenge entry keep their existing behavior.
Only victory unlocks the next unsolved quest. Historical numeric solved history is normalized to a continuous prefix. New campaigns cannot skip prerequisites; the acquired-access compatibility policy above preserves older frontiers without fabricating completions.

Quest loading and cloud restoration must clamp to `campaignQuestCount() - 1`, derived from the current content schedule. After the wave 2 expansion (#94), quest 100 is no longer terminal. Its normal victory CTA loads quest 101; a reload or cloud restoration of 100 completed quests also resumes quest 101. Only the actual final quest stops continuation. Navigation preserves earned rewards, badges and history.

Each constellation's quest rewards must sum exactly to its star count. Historical quest awards remain unchanged. Short extension constellations distribute the stars remaining after the historical allocation evenly across their quests, with the remainder assigned to the earliest quests. Reload repairs version-4 saves previously capped at 150 from their continuous solved prefix, preserves existing valid earned stars and does not alter solved history, performance badges or other rewards. Replay grants zero additional sky stars. The UI and shared result cards derive their totals from the same content model.

When changing progression, test old/local data migration behavior and cloud merge behavior; never silently erase historical progress.

## Social challenge isolation

Social challenges are outside campaign progression. Completing a challenge never solves the corresponding campaign quest, unlocks a constellation, awards campaign stars/badges, changes the daily qualifying attempt, or transfers the challenged quest into normal progression. This remains true when the challenged quest is the participant's current campaign quest.

A challenge participation has its own attempt identity and is terminal after success or explicit abandon. Reload/background restore the same challenge attempt through the shared attempt engine; they do not grant a fresh attempt.
## Records personnels — #600

Le temps officiel unique (#638) vaut `temps réel +
5 × vérifications + 15 × indices + 5 × interventions guidées`. Une intervention du Contrôle guidé compte
comme une vérification. Un seul classement existe par identité et révision de
grille, avec une entrée par participant. Le début de la tentative fige son
admission : même délai de quinze minutes que les badges, plus réservation
serveur atomique entre appareils. Jouer pendant le délai reste possible ;
attendre à la victoire ne rend pas l'essai admissible. La qualification
badges (exigée aussi par `ranking_finish`) est réévaluée au démarrage et au reset,
jamais figée à l'ouverture de la grille (#761). Les pénalités apparaissent immédiatement au chrono. Elles ne changent
ni les badges, ni les Éclats, ni les minima bruts techniques. Rapidité conserve
strictement sa règle de moins de 60 secondes réelles, hors pénalités. Le marquage automatique est
retiré (#647), y compris dans le tutoriel et les anciennes préférences restaurées.

La reprise historique utilise une pénalité nulle par convention, jamais déduite
des badges. Seuls les minima rattachables à la bonne grille sont admissibles ;
un record de version indéterminée reste personnel. L'import conserve le meilleur
score compétitif et ne change ni progression ni récompense. Publication automatique
et reprise nécessitent leurs activations distinctes : voir [le runbook](HIGHSCORE_ROLLOUT.md).

Une victoire terminée peut améliorer le meilleur temps absolu, même lors d’une
tentative non qualifiante pour les badges. `bestUnassistedTime` est un minimum
indépendant : seuls les nouveaux parcours sans assistance et sans indice le
renseignent. Une erreur seule ne constitue pas une assistance. Aucun ancien
badge ni temps de première victoire ne prouve un ancien record sans aide.
Les règles des badges, de qualification et de récompense restent inchangées.

Les temps sont des nombres finis positifs ou nuls, au plus `MAX_SAFE_INTEGER`.
En cas de conflit, chaque minimum valide est conservé séparément. Les records
avant partie concernent uniquement les quêtes déjà réussies ; le récapitulatif
compare le parcours acquitté et le record précédent. Une victoire en attente ne
présente aucun nouveau record confirmé.
## Aventure 5 — prolongement du catalogue

Les quêtes 401–500 de « Les chemins du firmament » prolongent les aventures
existantes. Un ancien compte ayant terminé les 400 quêtes retrouve ses acquis
et poursuit vers ce pack selon ses droits et les prérequis habituels, sans
rejouer l’ancienne finale. Une victoire débloque la suivante ; posséder le pack
ne permet pas de sauter une quête. Les replays, records personnels, badges et
récompenses utilisent le même contrat canonique que les autres quêtes.

## Catalogue complet — aventures 6 à 9

La révision 4 ajoute 380 quêtes (501–880), sans modifier les 500 premières ni
les cohortes existantes. Les anciennes fins ne plafonnent pas le nouveau parcours.
La fin de campagne dépend de toutes les quêtes actuelles ; la maîtrise globale
dépend en plus de tous les badges éligibles. Replays, reçus retrouvés et
restaurations ne rejouent pas une célébration acquise. Voir [CATALOGUE_88](CATALOGUE_88.md).


## Maîtrise complète d’une aventure (#627)

Toutes les quêtes et tous les badges actuellement éligibles sont nécessaires. Le statut « Maîtrisée » est une projection des preuves existantes, sans champ ni récompense ajouté. Le dernier badge peut être gagné en replay. Une seule priorité : maîtrise globale, fin globale, maîtrise d’aventure, fin d’aventure, fin de constellation. Restaurations et reçus retrouvés ne rejouent pas ces scènes ; un changement de catalogue ne fabrique pas de franchissement.
