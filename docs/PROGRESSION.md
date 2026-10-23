# Campaign, progression and rewards

## Source of truth
The campaign is sequential and represented through constellations. Quest count derives from `CONSTELLATION_GRID_COUNTS` through the content model; the schedule must cover that count without gaps or duplicate grids. The sky target derives from the sum of `CONSTELLATIONS[].count`. Currently the catalogue contains **134 quests across 24 constellations and 298 stars**, including the unchanged historical first 100 quests / 12 constellations / 150 stars. These totals are catalogue data, not permanent limits.

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

The real-sky catalogue is grouped into Adventures of at most ten constellations, configured in `content.js`. The current groups are 1–10, 11–20 and 21–24. The first Adventure is included; subsequent Adventures remain visible but locked unless already owned or already started by an existing player. Their unlock mechanism is deferred. The grouping size is a product rule, not a campaign-size ceiling: new Adventures are derived as the catalogue grows.

The user's migration decision is to **retain access to Adventures already started and lock subsequent unstarted Adventures**. A solved quest in an Adventure proves it was started; a locally restored campaign/replay attempt with `startedAt` also proves it, including an unsolved first quest. Merely reaching a READY quest at the next Adventure boundary does not grant access. Social attempts do not grant campaign access. `legacyAdventureAccess` retains proven Adventure IDs in the existing local progress object, idempotently; solved history restored from cloud can reconstruct access without a new entitlement or backend RPC. An unsolved local attempt has the same device-local persistence scope as before.

Keep the existing `base-real-sky`, `real-NN`, `base-qNNN` IDs and numeric saved quest keys. Later Adventures have stable `real-adventure-NN` pack IDs. The historical `baseCampaignQuestCount()`/`baseQuestId()` namespace still describes the full real-sky legacy schedule, not the size of the free Adventure. Pack metadata determines its range/access; do not equate the full catalogue with immediately playable content.

Browsing another Adventure never changes gameplay state. Loading/continuation must respect pack access in addition to sequential progression. When the next Adventure is locked, continuation shows its notice; reload offers the last accessible quest for replay while preserving the solved prefix, stars and badges. Finishing an Adventure does not automatically unlock another. Existing entitled packs still use the real entitlement model; no acquisition flow is added.

## Administrative catalogue access

Authenticated internal administrators with the server-provided `analytics_cockpit` or `all_adventures_access` capability may browse and enter every catalogued Adventure, including locked packs, without creating a purchase entitlement or persisting access into player progress. QA guest sessions never receive this override. Ordinary players retain the existing access policy. This exception affects pack access only: sequential quest progression and rewards remain governed by their existing rules.

## Bonus quests
After the reviewed historical-command migration, authenticated victories apply
the existing `legacy-victory.js` rules on the server. Guests and explicitly older
servers retain local rules. No-hint XP remains distinct from effective assistance;
same-run mastery, qualification cooldown, one-time challenges and first-win
rewards are preserved. Pending victories keep immutable attempt/reset facts.
Every sixth quest is a bonus challenge, rotating challenge types. Current challenge rewards are **+25 XP and +1 shard**. Challenge rewards do not replace the campaign's sky-star accounting.

## Shards
Designed economy:
- initial balance: 3;
- no wallet cap: every earned shard is retained;
- first hint in an attempt: free;
- second: 1 shard;
- subsequent: 2 shards;
- zero-shard safety valve: free hint after 90 seconds;
- no passive timed refill;
- successful bonus challenges grant +1 shard;
- every 3 new quests completed in Autonomy grant +1 shard, using the same assistance definition as performance badges.

An internal, capability-gated `unlimited_shards` toggle is implemented in `src/ui/game-screen.js`; it bypasses spending for authorized testing only, without changing the stored product balance.

## Série de lumière
A meaningful activity validates at most one calendar day: either a first campaign completion, or a qualifying replay that actually improves an eligible performance badge. Merely opening or starting a quest does not count.

The streak is continuous and is not reset every seven days. One missed calendar day is tolerated as a grace day and does not increment the streak. A second missed day breaks it. Rewards repeat independently of the global streak count: +1 shard on day 3 of each seven-day cycle and +2 on day 7. Reward records are keyed by calendar day so a reload cannot credit the same local daily reward twice.

Guest state is persisted locally. Authenticated daily claims already use
`lumen_claim_daily` with the server Europe/Paris calendar and idempotent daily
rewards, read through `lumen_get_daily` / `lumen_get_engagement`. Historical command
victories include that existing claim in their reward/receipt transaction and
project each unprojected daily reward once. The P0 wallet cutover adds durable
hint/verify debit commands and an atomic standalone daily projection. After
activation, legacy daily and snapshot wallet mutations are refused; existing
claim locks and day reward keys remain authoritative. Prices and badge rules
are unchanged. Authenticated paid help needs a verifiable server command; free
learning hints and the existing zero-shard safety hint remain available.

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
The wallet and full hydration must still be verified before canonical replay;
restored completion evidence alone does not release that hold. No previous
quest, badge, balance or entitlement is synthesized or removed by this path.

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
in its accessible name; the replay button and direct start remain guarded.
An unfinished quest retains its real prerequisite/ownership lock. Displaying
preserved history never grants a win, entitlement or permission to replay.

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
