// #728: client side of the mastery unlock (candidates and server calls) and the
// store seed drift check. The server owns the decision (scripts/fixtures/purchases-mastery.sql).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {PERFORMANCE_BADGES} from '../src/campaign/performance.js';
import {masteryUnlockCandidates,claimMasteryUnlocks} from '../src/ui/mastery-unlock.js';
import {storeSeed} from './adventure-store-seed.mjs';

const quests=canonicalQuestList(),packs=[...CONTENT_PACKS].sort((a,b)=>a.order-b.order);
const [first,second,third]=packs;
const all=Object.fromEntries(PERFORMANCE_BADGES.map(k=>[k,true]));
function mastered(pack,{missing=false,oldLegacy=false}={}){
 const p={solved:{},performances:{},canonicalQuestState:{}};
 quests.filter(q=>q.packId===pack.id).forEach((q,i)=>{
  const badges=missing&&i===0?{...all,speed:false}:all;
  if(q.legacyIndex!==null){p.solved[q.legacyIndex]=1;p.performances[q.legacyIndex]={version:oldLegacy&&i===0?1:3,badges}}
  else p.canonicalQuestState[q.id]={solved:true,badges};
 });
 return p;
}
const candidates=(progress,entitlements=[])=>masteryUnlockCandidates({packs:CONTENT_PACKS,quests,progress,entitlements});
assert.deepEqual(candidates({}),[],'No progress, no request');
assert.deepEqual(candidates(mastered(first)),[second.id],'A mastered Adventure asks for the next one only');
assert.deepEqual(candidates(mastered(first),[second.id]),[],'An owned Adventure is not requested again');
assert.deepEqual(candidates(mastered(first),[{entitlement:second.id,source:'admin'}]),[],'Entitlement rows are understood');
assert.deepEqual(candidates(mastered(first,{missing:true})),[],'One missing badge blocks the request');
assert.deepEqual(candidates(mastered(first,{oldLegacy:true})),[],'Pre-version-2 legacy badges do not count');
assert.deepEqual(candidates(mastered(second)),[third.id],'Mastering Adventure 2 asks for Adventure 3; the server re-verifies');
const both={...mastered(second),solved:{...mastered(first).solved,...mastered(second).solved},performances:{...mastered(first).performances,...mastered(second).performances},canonicalQuestState:{...mastered(first).canonicalQuestState,...mastered(second).canonicalQuestState}};
assert.deepEqual(candidates(both,[second.id]),[third.id],'The chain continues one Adventure at a time');

const calls=[];let current=true;
const client={rpc:async(name,args)=>{calls.push({name,...args});
 if(args.p_adventure==='boom')throw Error('offline');
 if(args.p_adventure==='refused')return {data:null,error:{code:'42501'}};
 if(args.p_adventure==='not-yet')return {data:{mastered:false,changed:false},error:null};
 if(args.p_adventure==='already')return {data:{mastered:true,changed:false},error:null};
 return {data:{mastered:true,changed:true},error:null};}};
assert.deepEqual(await claimMasteryUnlocks({client,owner:'u1',candidates:['boom','refused','not-yet','already',second.id]}),[second.id],'Only server-confirmed new unlocks are reported; failures never throw');
assert.equal(calls[0].name,'lumen_claim_mastery_unlock');assert.equal(calls[0].p_expected_user_id,'u1');
calls.length=0;
assert.deepEqual(await claimMasteryUnlocks({client,owner:'u1',candidates:[second.id,third.id],stillCurrent:()=>{const was=current;current=false;return was}}),[],'An account change stops the claims');
assert.equal(calls.length,1);
assert.deepEqual(await claimMasteryUnlocks({client:null,owner:'u1',candidates:[second.id]}),[],'Signed-out: nothing');

// Wiring: claims after a verified hydration and on a local mastery event, never for QA or before the cloud profile.
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.match(screen,/canonicalRecovery\.schedule\(\);\s*void afterVerifiedHydration\(\);/,'Claim after verified hydration');
assert.match(screen,/function afterVerifiedHydration\(\)\{refreshAdventureOffer\?\.\('mastery'\);void maybeClaimMasteryUnlocks\(\);void maybeRestorePlayPurchases\(\);void refreshPaymentChannel\(\)\.finally\(\(\)=>handleStripeReturn\(\)\)\.finally\(\(\)=>void maybeRestoreStripePurchases\(\)\)\}/,'Hydration claims mastery unlocks, restores Play and Stripe purchases and checks a Stripe return (#730)');
assert.match(screen,/transition\.kind==='adventure-mastery'\|\|transition\.kind==='campaign-mastery'\)void maybeClaimMasteryUnlocks\(\{retry:true\}\)/,'Claim on local mastery');
assert.match(screen,/if\(!lumenUser\|\|!lumenSupabase\|\|qaActive\|\|!cloudProfileReady\)return;/,'Guarded');

// The latest store seed migration matches the catalogue (Adventures, quests, products, badge keys).
const START='-- BEGIN STORE SEED',END='-- END STORE SEED';
const blocks=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8').replace(/\r\n/g,'\n')).filter(s=>s.includes(START)).map(s=>s.slice(s.indexOf(START)+START.length,s.indexOf(END)).trim());
assert(blocks.length>0);assert.equal(blocks.at(-1),storeSeed(),'Store seed drift: run node scripts/adventure-store-seed.mjs --write-seed in a new migration');
console.log('mastery-unlock-tests: candidates, claims, wiring and store seed OK');
