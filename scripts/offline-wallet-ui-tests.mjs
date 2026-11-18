import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {rankedTime} from '../src/campaign/ranking.js';

const source=fs.readFileSync('src/ui/game-screen.js','utf8');
test('repeat assistance counts once per action without a wallet write or reservation',()=>{
 const counts={hint:1,verify:1,guided:0},profile={shards:80,walletRevision:3,daily:{dates:{},rewards:{}}};
 const context={navigator:{onLine:false},lumenUser:{id:'owner'},lumenProgress:profile,hintUsesThisGame:1,verifyUsesThisGame:1,usedHintThisGame:false,
  celebrated:false,guidedPending:null,verifyPending:null,scriptedLearningActive:()=>false,
  lumenSupabase:{rpc(){assert.fail('Assistance attempted an RPC')}},
  attemptEngine:{recordAssistanceUse(kind,count){assert.equal(count,counts[kind]+1);counts[kind]=count},markAssistance(){}},
  trackAttemptEvent(){},showLearningTip(){},clearHintDisplay(){},verificationErrors:()=>[],showVerificationSuccess(){}};
 vm.createContext(context);
 for(const name of ['recordHintUse','runVerification'])vm.runInContext(functionSource(source,name),context);
 const before=structuredClone(profile);
 context.recordHintUse();context.recordHintUse();context.runVerification();
 assert.deepEqual(counts,{hint:3,verify:2,guided:0});
 assert.deepEqual(profile,before);
 assert.equal(rankedTime(20,counts).score,75);
});
