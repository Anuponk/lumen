# Campaign, progression and rewards

## Source of truth
The campaign is sequential and represented through constellations. There are **100 quests across 12 constellations** and the sky contains **150 stars** exactly.

A quest belongs to one constellation. Each constellation has an intermediate milestone and a final/boss quest. First completion awards the quest's sky-star value; replay does not farm additional sky stars.

## Bonus quests
Every sixth quest is a bonus challenge, rotating challenge types. Current challenge rewards are **+25 XP and +1 shard**. Challenge rewards do not replace the campaign's sky-star accounting.

## Shards
Designed economy:
- initial balance: 3;
- maximum: 5;
- first hint in an attempt: free;
- second: 1 shard;
- subsequent: 2 shards;
- zero-shard safety valve: free hint after 90 seconds;
- no passive timed refill;
- first completion milestones can grant shards, including the current every-3-new-wins rule and successful bonus challenges.

Important: the current code contains `UNLIMITED_SHARDS_TEST=true`, which overrides the designed economy for testing. Do not mistake test mode for the product specification.

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

When changing progression, test old/local data migration behavior and cloud merge behavior; never silently erase historical progress.
