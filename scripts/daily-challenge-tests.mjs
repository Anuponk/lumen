import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parisDay,parisMidnight,dailyBounds,dailyWeek,addDays,dailyPool,planDailySchedule,dailyQuest,dailyEntry,DAILY_POOL} from '../src/campaign/daily-challenge.js';
import {canonicalQuestList,canonicalQuestById} from '../src/campaign/canonical-quests.js';
import {RANKING_PENALTIES} from '../src/campaign/ranking.js';
import {verifySchedule,scheduleHash,SCHEDULE_PATH,MIGRATION_PATH} from './daily-schedule.mjs';

// #882 (EPIC #881 Lot 3): pure daily challenge contracts.
// Europe/Paris civil day, including DST (23 h / 25 h days).
assert.equal(parisDay(new Date('2026-11-22T22:59:59Z')),'2026-11-22');
assert.equal(parisDay(new Date('2026-11-22T23:00:00Z')),'2026-11-23','midnight in Paris (UTC+1)');
assert.equal(parisDay(new Date('2027-07-01T21:59:59Z')),'2027-07-01');
assert.equal(parisDay(new Date('2027-07-01T22:00:00Z')),'2027-07-02','midnight in Paris (UTC+2)');
assert.equal(new Date(parisMidnight('2026-11-23')).toISOString(),'2026-11-22T23:00:00.000Z');
assert.equal(dailyBounds('2027-03-28').hours,23,'spring forward');
assert.equal(dailyBounds('2026-10-25').hours,25,'fall back');
assert.equal(dailyBounds('2026-11-23').hours,24);
assert.deepEqual(dailyWeek('2026-11-29'),['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29'],'Sunday belongs to the Monday week');
assert.deepEqual(dailyWeek('2026-11-23')[0],'2026-11-23');
assert.equal(addDays('2026-12-31',1),'2027-01-01');
assert.throws(()=>dailyBounds('2026-02-30'),/Invalid daily date/);

// Pool: homogeneous difficulty, no learning quests.
const quests=canonicalQuestList(),pool=dailyPool(quests);
assert(pool.length>=200,'enough grids for months without repetition');
for(const entry of pool){const q=canonicalQuestById(entry.questId);assert(DAILY_POOL.labels.includes(q.difficulty.label)&&q.ordinal>=DAILY_POOL.minOrdinal)}

// Schedule: no repeat inside a cycle, never the same constellation twice in a row,
// append-only even if a published entry later differs from the current pool.
const plan=planDailySchedule({pool,days:pool.length+20,hash:scheduleHash});
assert.equal(new Set(plan.slice(0,pool.length).map(e=>e.questId)).size,pool.length,'no repetition before the pool is exhausted');
for(let i=1;i<plan.length;i++)assert.notEqual(plan[i].constellationId,plan[i-1].constellationId,'same constellation two days running at '+plan[i].day);
const pinned={...plan[0],gridRevision:0};
const extended=planDailySchedule({pool,days:10,existing:[pinned],hash:scheduleHash});
assert.deepEqual(extended[0],pinned,'a published day is never rewritten');
assert.deepEqual(planDailySchedule({pool,days:30,hash:scheduleHash}),planDailySchedule({pool,days:30,hash:scheduleHash}),'deterministic');

// The pinned board stays exact after later catalogue revisions.
const revised=quests.find(q=>q.legacyIndex===null&&q.gridRevision===2);
const original=dailyQuest({questId:revised.id,gridRevision:0}),current=dailyQuest({questId:revised.id,gridRevision:2});
assert.notDeepEqual(original.reg,current.reg,'revision 0 keeps its original board');
assert.deepEqual(current.reg,revised.reg);
assert.throws(()=>dailyQuest({questId:revised.id,gridRevision:9}),/Unresolvable/);

// Published schedule file and migration seed agree.
const schedule=JSON.parse(fs.readFileSync(SCHEDULE_PATH,'utf8'));
assert(verifySchedule(schedule));
assert.equal(dailyEntry(schedule,'2026-11-23').day,'2026-11-23');

// Server contract: same official formula as #638, one attempt per (user, day),
// rankings from one table, disabled by default, erasure-registered.
const sql=fs.readFileSync(MIGRATION_PATH,'utf8');
assert.deepEqual(RANKING_PENALTIES,{verify:5,hint:15,guided:5},'client penalties = official_time');
assert.match(sql,/s:=lumen_commands\.official_time\(facts,r\.grid_revision\)/,'daily score uses the official #638 formula');
assert.match(sql,/primary key\(user_id,day\)/,'one official attempt per account and day');
assert.match(sql,/values\('daily_challenge',false\)/,'disabled by default');
assert.doesNotMatch(sql,/echo|virtual/i,'no virtual players in daily rankings');
for(const table of ['daily_runs','daily_standings'])assert.match(sql,new RegExp("\\('lumen_commands','"+table+"','user_id',null,null,'delete'\\)"),table+' erased with the account');
assert.equal((sql.match(/from lumen_commands\.daily_runs r/g)||[]).length>=2,true);
assert.doesNotMatch(sql,/insert into lumen_commands\.(ranking_scores|canonical_receipts)|update lumen\.profile_snapshots/,'no campaign or podium write');
console.log('daily challenge contracts: ok ('+pool.length+' grids in pool, '+schedule.days.length+' scheduled days)');
