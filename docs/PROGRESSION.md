# Campaign, progression and rewards

## Source of truth
The campaign is sequential and represented through constellations. Quest count derives from `CONSTELLATION_GRID_COUNTS` through the content model; the schedule must cover that count without gaps or duplicate grids. The sky target derives from the sum of `CONSTELLATIONS[].count`. Currently the catalogue contains **134 quests across 24 constellations and 298 stars**, including the unchanged historical first 100 quests / 12 constellations / 150 stars. These totals are catalogue data, not permanent limits.

A quest belongs to one constellation. Each constellation has an intermediate milestone and a final/boss quest. First completion awards the quest's sky-star value; replay does not farm additional sky stars.

## Adventures and access (#96)

The real-sky catalogue is grouped into Adventures of at most ten constellations, configured in `content.js`. The current groups are 1–10, 11–20 and 21–24. The first Adventure is included; subsequent Adventures remain visible but locked unless already owned or already started by an existing player. Their unlock mechanism is deferred. The grouping size is a product rule, not a campaign-size ceiling: new Adventures are derived as the catalogue grows.

The user's migration decision is to **retain access to Adventures already started and lock subsequent unstarted Adventures**. A solved quest in an Adventure proves it was started; a locally restored campaign/replay attempt with `startedAt` also proves it, including an unsolved first quest. Merely reaching a READY quest at the next Adventure boundary does not grant access. Social attempts do not grant campaign access. `legacyAdventureAccess` retains proven Adventure IDs in the existing local progress object, idempotently; solved history restored from cloud can reconstruct access without a new entitlement or backend RPC. An unsolved local attempt has the same device-local persistence scope as before.

Keep the existing `base-real-sky`, `real-NN`, `base-qNNN` IDs and numeric saved quest keys. Later Adventures have stable `real-adventure-NN` pack IDs. The historical `baseCampaignQuestCount()`/`baseQuestId()` namespace still describes the full real-sky legacy schedule, not the size of the free Adventure. Pack metadata determines its range/access; do not equate the full catalogue with immediately playable content.

Browsing another Adventure never changes gameplay state. Loading/continuation must respect pack access in addition to sequential progression. When the next Adventure is locked, continuation shows its notice; reload offers the last accessible quest for replay while preserving the solved prefix, stars and badges. Finishing an Adventure does not automatically unlock another. Existing entitled packs still use the real entitlement model; no acquisition flow is added.

## Bonus quests
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

The current code contains `UNLIMITED_SHARDS_TEST=true`, which overrides spending for testing. It does not change the stored product balance.

## Série de lumière
A meaningful activity validates at most one calendar day: either a first campaign completion, or a qualifying replay that actually improves an eligible performance badge. Merely opening or starting a quest does not count.

The streak is continuous and is not reset every seven days. One missed calendar day is tolerated as a grace day and does not increment the streak. A second missed day breaks it. Rewards repeat independently of the global streak count: +1 shard on day 3 of each seven-day cycle and +2 on day 7. Reward records are keyed by calendar day so a reload cannot credit the same local daily reward twice.

Guest state is persisted locally. Authenticated daily dates synchronize through the existing `lumen_save_daily` / `lumen_get_daily` RPCs. A future compatible Supabase RPC evolution is still required for server-authoritative calendar time and atomic reward credit across simultaneous devices.

## Performance badges
Per-quest performance has exactly three badges:
- 🧠 **Autonomie**: solve without effective assistance. A granted hint, Verify use, automatic marking that intervenes, or an effective guided-control intervention permanently marks the attempt as assisted. Merely enabling guided control without an intervention does not.
- ⚡ **Rapidité**: solve under the quest difficulty target. Assistance does not prevent this badge.
- ✦ **Maîtrise**: earn Autonomie and Rapidité in the **same qualifying attempt**. Never combine achievements from separate attempts.

Eligibility is progressive: quests 1–2 lock all performance badges; quests 3–5 allow Rapidité only; quest 6 onward allows all three.

A quest gets at most one **qualifying attempt per local calendar day**. READY does not consume it. The first intentional grid start consumes that day's qualification; reset keeps the same attempt and qualification, while abandoning after start does not restore it. Further same-day replays remain playable but cannot change badges. Refresh restores the same active attempt through the attempt engine.

Existing performance data is migrated conservatively: only the current versioned three-badge records are trusted as earned badges; old badge shapes are not reinterpreted into new achievements.


## Progress integrity
Only victory unlocks the next unsolved quest. Persisted solved history is normalized to a continuous prefix. A player may revisit solved quests but may not jump ahead to locked content.

Quest loading and cloud restoration must clamp to `campaignQuestCount() - 1`, derived from the current content schedule. After the wave 2 expansion (#94), quest 100 is no longer terminal. Its normal victory CTA loads quest 101; a reload or cloud restoration of 100 completed quests also resumes quest 101. Only the actual final quest stops continuation. Navigation preserves earned rewards, badges and history.

Each constellation's quest rewards must sum exactly to its star count. Historical quest awards remain unchanged. Short extension constellations distribute the stars remaining after the historical allocation evenly across their quests, with the remainder assigned to the earliest quests. Reload repairs version-4 saves previously capped at 150 from their continuous solved prefix, preserves existing valid earned stars and does not alter solved history, performance badges or other rewards. Replay grants zero additional sky stars. The UI and shared result cards derive their totals from the same content model.

When changing progression, test old/local data migration behavior and cloud merge behavior; never silently erase historical progress.

## Social challenge isolation

Social challenges are outside campaign progression. Completing a challenge never solves the corresponding campaign quest, unlocks a constellation, awards campaign stars/badges, changes the daily qualifying attempt, or transfers the challenged quest into normal progression. This remains true when the challenged quest is the participant's current campaign quest.

A challenge participation has its own attempt identity and is terminal after success or explicit abandon. Reload/background restore the same challenge attempt through the shared attempt engine; they do not grant a fresh attempt.
