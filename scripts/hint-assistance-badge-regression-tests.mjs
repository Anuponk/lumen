import assert from "node:assert/strict";
import fs from "node:fs";
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {performanceAttempt} from "../src/campaign/performance.js";
const ui=fs.readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
for(const mode of ['guest','signed-in','offline']){
 let marked=0;
 const ctx={lumenProgress:{shards:0},navigator:{onLine:mode!=='offline'},lumenUser:mode==='guest'?null:{id:'a'},
  hintUsesThisGame:0,usedHintThisGame:false,attemptEngine:{markAssistance:()=>marked++,recordAssistanceUse(){}},trackAttemptEvent(){}};
 vm.createContext(ctx);vm.runInContext(functionSource(ui,'recordHintUse'),ctx);
 ctx.recordHintUse();assert.equal(ctx.lumenProgress.shards,0,mode);
 assert.equal(marked,1,mode);assert.equal(ctx.usedHintThisGame,true,mode);
 assert.equal(ctx.hintUsesThisGame,1,mode);
}
const result=performanceAttempt({questIndex:8,seconds:30,assistanceUsed:true,mistakeCommitted:false,unlockedQuestCount:10});
assert.equal(result.autonomy,false);
assert.equal(result.mastery,false);
assert.equal(result.noError,false);
assert.equal(result.speed,true);
console.log("All hint grants prevent unassisted badges on a qualifying replay");

// #775: a previous grid's flag cannot contradict this run's persisted counters.
{
 let attempt={rankingVersion:1,helpUses:{hint:0}};
 const ctx={usedHintThisGame:true,attemptEngine:{snapshot:()=>attempt}};
 vm.createContext(ctx);vm.runInContext(functionSource(ui,'hintUsedInAttempt'),ctx);
 assert.equal(vm.runInContext('hintUsedInAttempt()',ctx),false,'A fresh counted run never inherits the previous hint flag');
 attempt={rankingVersion:1,helpUses:{hint:1}};ctx.usedHintThisGame=false;
 assert.equal(vm.runInContext('hintUsedInAttempt()',ctx),true,'A restored run retains actual hint use');
 attempt={};ctx.usedHintThisGame=true;
 assert.equal(vm.runInContext('hintUsedInAttempt()',ctx),true,'Old attempts retain their historical hint evidence');
}
