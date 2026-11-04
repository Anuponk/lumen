import assert from "node:assert/strict";
import fs from "node:fs";
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {performanceAttempt} from "../src/campaign/performance.js";
import {walletReservationCost} from '../src/persistence/offline-wallet.js';
const ui=fs.readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
for(const mode of ['unlimited','safety','guest-paid','server-paid','offline-paid']){
 let marked=0;
 const ctx={walletPaidPermit:['server-paid','offline-paid'].includes(mode)?'hint':null,hintCost:()=>1,lumenProgress:{shards:mode==='safety'?0:3},
  navigator:{onLine:mode!=='offline-paid'},pendingWalletReservations:[],walletReservationCost,
  unlimitedShardsEnabled:()=>mode==='unlimited',activeGameSeconds:()=>100,lumenUser:null,qaActive:false,
  hintWasGranted:false,hintUsesThisGame:0,usedHintThisGame:false,attemptEngine:{markAssistance:()=>marked++,recordAssistanceUse(){}},
  updateHintButton(){},saveLumenProgress(){},msg:{}};
 vm.createContext(ctx);vm.runInContext(functionSource(ui,'availableShards')+'\n'+functionSource(ui,'consumeHintCost'),ctx);
 assert.equal(vm.runInContext('consumeHintCost()',ctx),true,mode);
 assert.equal(marked,1,mode);assert.equal(ctx.usedHintThisGame,true,mode);
 assert.equal(ctx.hintUsesThisGame,1,mode);
}
const result=performanceAttempt({questIndex:8,seconds:30,assistanceUsed:true,mistakeCommitted:false,unlockedQuestCount:10});
assert.equal(result.autonomy,false);
assert.equal(result.mastery,false);
assert.equal(result.noError,false);
assert.equal(result.speed,true);
console.log("All hint grants prevent unassisted badges on a qualifying replay");
