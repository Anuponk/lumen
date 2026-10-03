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
Per-quest performance includes:
- Sans indice;
- speed: under one minute without hint or automatic assistance;
- Sans Marquage auto;
- Maîtrise: no hint, no automatic assistance and no mistake.

A badge/performance result must describe **one attempt**. Never combine properties from different replays to manufacture a mastery result. Solved quests are replayable specifically to improve these badges.

Global badges currently include milestones for first completion, 20, 50 and 100 solved quests plus bonus-challenge milestones.

## Progress integrity
Only victory unlocks the next unsolved quest. Persisted solved history is normalized to a continuous prefix. A player may revisit solved quests but may not jump ahead to locked content.

When changing progression, test old/local data migration behavior and cloud merge behavior; never silently erase historical progress.
