import assert from "node:assert/strict";
import {buildMigrationPlan,migrateLegacySolved} from "./issue-222-migration-plan.mjs";

const plan=buildMigrationPlan();
assert.equal(plan.total,400);
assert.equal(plan.missing,104);
assert.equal(plan.publicationReady,false,"Do not publish missing quest slots as playable puzzles");
assert.deepEqual(plan.adventures.map(a=>a.existing),[79,85,32,100]);
assert.deepEqual(plan.adventures.map(a=>a.missing),[21,15,68,0]);
assert.deepEqual(plan.adventures.map(a=>[a.firstQuest,a.lastQuest]),[[1,100],[101,200],[201,300],[301,400]]);
assert.equal(new Set(plan.records.filter(r=>r.stableQuestId).map(r=>r.stableQuestId)).size,296);
assert.deepEqual(plan.records.map(r=>r.ordinal),Array.from({length:400},(_,i)=>i+1));
const oldProgress={"0":true,"78":true,"100":true,"195":true,"196":true,"295":true};
const mapped=migrateLegacySolved(oldProgress,plan);
assert.equal(mapped.length,6);
assert.deepEqual(mapped.map(x=>x.legacyIndex).sort((a,b)=>a-b),[0,78,100,195,196,295]);
assert(mapped.every(r=>r.id&&r.ordinal>=1&&r.ordinal<=400));
console.log(JSON.stringify({total:plan.total,missing:plan.missing,adventures:plan.adventures}));
