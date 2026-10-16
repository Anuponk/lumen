import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reconcileCloudAchievements} from "../src/persistence/cloud-profile.js";
const ui=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(ui,/reconcileCloudAchievements\(localStorage,cloud\)/);
assert.match(ui,/cloud_achievements_locally_recovered/);
function memoryStore(initial){const m=new Map(Object.entries(initial));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),key:i=>[...m.keys()][i]??null,get length(){return m.size}}}
const old={solved:{"173":true},historyBackup:{},badges:{},stars:{},performances:{},canonicalQuestState:{},daily:{dates:["2026-10-15"]},challenges:{},xp:100,shards:9,skyScore:0};
const remote={...structuredClone(old),solved:{"173":true,"174":true,"215":true},xp:200,shards:2,daily:{dates:["2026-10-16"]}};
const store=memoryStore({lumenProgressV1:JSON.stringify(old)});
const result=reconcileCloudAchievements(store,remote);
assert.equal(result.changed,true);
const next=JSON.parse(store.getItem("lumenProgressV1"));
assert.equal(next.solved["215"],true,"cloud progress visible after recovery");
assert.equal(next.shards,9,"local shards never overwritten");
assert.equal(next.xp,100,"XP never synthesized");
assert.deepEqual(next.daily,old.daily,"daily ledger preserved");
assert.ok([...Array(store.length)].some((_,i)=>store.key(i).startsWith("lumenBeforeCloudReconcile_")),"local backup present");
console.log("Partial cloud achievement recovery preserves local rewards and makes advanced cloud quests visible");
