// #752: the Série de lumière is paused without deleting code or history.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import frPlay from '../src/ui/locales/fr/play.js';
import {DAILY_LIGHT_STREAK_ENABLED} from '../src/campaign/feature-flags.js';
import {grantDaily,streakFromDates} from '../src/campaign/daily-engagement.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const src=read('src/ui/game-screen.js');
const sql=read('supabase/migrations/20261116090000_pause_daily_light_streak_752.sql');
const fn=name=>src.slice(src.indexOf('function '+name+'('),src.indexOf('\n}\n',src.indexOf('function '+name+'('))+2);

assert.equal(DAILY_LIGHT_STREAK_ENABLED,false,'The Série de lumière ships paused');

// Disabled: the day is recorded (history kept) but no shard and no reward key.
const paused={daily:{dates:{'2026-11-14':1,'2026-11-15':1},rewards:{}},shards:5};
let r=grantDaily(paused,'2026-11-16',{rewards:false});
assert.deepEqual([r.credited,r.reward,r.streak,paused.shards],[true,0,3,5]);
assert.equal(paused.daily.dates['2026-11-16'],1,'History is preserved');
assert.deepEqual(paused.daily.rewards,{},'No streak reward recorded');
// Reactivation: a day already recorded during the pause is never credited.
r=grantDaily(paused,'2026-11-16');
assert.deepEqual([r.credited,r.reward,paused.shards],[false,0,5],'No retroactive credit');
// Enabled behaviour is unchanged (day 3 => +1).
const enabled={daily:{dates:{'2026-11-14':1,'2026-11-15':1},rewards:{}},shards:5};
r=grantDaily(enabled,'2026-11-16');
assert.deepEqual([r.credited,r.reward,enabled.shards],[true,1,6]);
assert.equal(streakFromDates(enabled.daily.dates,'2026-11-16'),3);

// Every player-visible entry point is gated.
assert.match(fn('renderDaily'),/^function renderDaily\(\)\{\n if\(!DAILY_LIGHT_STREAK_ENABLED\)\{hideDailyLightStreak\(\);return\}/);
for(const id of ['dailyCard','dailyCompactHelp','dailyHelpModal','dailyCelebration','streakLossModal'])assert.ok(fn('hideDailyLightStreak').includes('"'+id+'"'),id+' hidden while paused');
assert.match(fn('maybeShowStreakLoss'),/^function maybeShowStreakLoss\(\)\{\n if\(!DAILY_LIGHT_STREAK_ENABLED\)return;/);
assert.match(fn('scheduleDailyCelebration'),/if\(!DAILY_LIGHT_STREAK_ENABLED\)return;/);
assert.match(fn('maybeShowReturnWelcome'),/if\(!DAILY_LIGHT_STREAK_ENABLED\)\{copy\.textContent=t\('return\.explore'\);stars\.hidden=true;/);
assert.equal(frPlay['return.explore'],'Reprends ton exploration du ciel là où tu l’as laissée.','#945: same French copy, now from the catalogue');
assert.match(fn('setupStreakLoss'),/if\(!DAILY_LIGHT_STREAK_ENABLED\)qaPreview\.hidden=true;/);
// The player client always records history without adding a currency reward.
assert.match(src,/grantDaily\(lumenProgress,today,\{rewards:false\}\)/);
assert.match(src,/grantDaily\(profile,localCalendarDay\(\),\{rewards:false\}\)/);
for(const kept of ['function dailyStreak(','function renderDaily(','async function completeDaily(','function showDailyCelebration('])assert.ok(src.includes(kept),kept+' is preserved');

// Server: one choke point, history kept, rewards behind the flag, shipped off.
assert.match(sql,/create table if not exists lumen_commands\.feature_flags/);
assert.match(sql,/revoke all on table lumen_commands\.feature_flags from public,anon,authenticated;/);
assert.match(sql,/values\('daily_light_streak',false\) on conflict\(name\) do nothing;/);
assert.match(sql,/insert into lumen\.daily_progress\(user_id,play_date,puzzle_id,stable_quest_id\)/,'Days are still recorded');
assert.match(sql,/if inserted=1 and rewards_enabled then/,'Rewards only on first insert and only when enabled');
assert.match(sql,/revoke all on function lumen_commands\.claim_quest_daily\(integer,text\) from public,anon,authenticated;/);
console.log('daily-streak-pause-tests: flag off, no UI, no reward, history kept, no retroactive credit OK');
