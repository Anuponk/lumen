import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {catalogueQuestDecision} from '../src/campaign/catalogue-access.js';
import {functionSource} from './source-tools.mjs';
import {gameplayDomainState} from '../src/persistence/gameplay-sync.js';
import {createConfirmedProfileCache} from '../src/persistence/transactional-command-cache.js';

test('a server-confirmed acquired replay is independent of a wallet-only hold for either quest identity',()=>{
 for(const legacyIndex of [null,10]){
  const quest={id:'confirmed',ordinal:15,legacyIndex};
  const progress=legacyIndex===null?{canonicalQuestState:{confirmed:{solved:true}}}:{solved:{10:1}};
  const context={signedIn:true,cloudReady:false,confirmedReplay:true};
  assert.equal(catalogueQuestDecision(quest,progress,[quest],context).reason,'replay');
  for(const blocked of [{confirmedReplay:false},{packAllowed:false}])assert.notEqual(catalogueQuestDecision(quest,progress,[quest],{...context,...blocked}).status,'ready');
  assert.equal(catalogueQuestDecision(quest,{},[quest],context).status,'sync-required','A permission to replay never creates completion');
 }
});
test('a direct historical replay start cannot erase an attempt or replace its board while access is held',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 let changed=0;const ctx={skyTourActive:()=>false,questIsAccessible:()=>false,attemptEngine:{snapshot:()=>({state:'COMPLETED'}),clear:()=>changed++},
  document:{getElementById:()=>({})},loadPuzzle:()=>changed++,refreshJourney:()=>changed++,canonicalActiveQuest:null,levelIndex:1,replayMode:false};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'launchReplay'),ctx);ctx.launchReplay(10);
 assert.equal(changed,0);assert.equal(ctx.levelIndex,1);
});
const client={},proof={userId:'a',client,generation:4,confirmedQuestIds:['confirmed']};
const held={signedIn:true,userId:'a',client,generation:4,ready:false,failure:{reason:'partial_reconciliation',domain:'wallet',detail:'mutable_balance'},proof};
test('domain permissions keep rewards and spending held while allowing only current server-confirmed replays',()=>{
 const state=gameplayDomainState(held);
 assert.deepEqual(state.confirmedReplayIds,['confirmed']);assert.equal(state.wallet,'review');assert.equal(state.achievements,'confirmed');assert.equal(state.rewards,'pending');assert.equal(state.profile,'review');
 for(const change of [{generation:5},{userId:'b'},{client:{}},{signedIn:false},{blocked:true},{proof:null},
  {failure:{...held.failure,domain:'reward'}},{failure:{...held.failure,domain:'storage'}},{failure:{...held.failure,detail:'unknown'}}]){
  assert.equal(gameplayDomainState({...held,...change}).confirmedReplayIds.length,0,JSON.stringify(change));
 }
});
test('the actual access helper expires its replay permission on account/client/generation/password changes',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const ctx={gameplayDomainState,qaActive:false,cloudProfileReady:false,authSessionPending:false,lumenUser:{id:'a'},lumenSupabase:client,
  cloudHydrationGeneration:4,cloudProfileFailure:held.failure,canonicalRecoveryContext:proof,sessionStorage:{getItem:()=>null}};
 vm.createContext(ctx);for(const name of ['gameplaySyncState','confirmedReplayAllowed'])vm.runInContext(functionSource(source,name),ctx);
 assert.equal(ctx.confirmedReplayAllowed({id:'confirmed'}),true);assert.equal(ctx.confirmedReplayAllowed({id:'unproven'}),false);
 ctx.cloudHydrationGeneration++;assert.equal(ctx.confirmedReplayAllowed({id:'confirmed'}),false);ctx.cloudHydrationGeneration--;
 ctx.sessionStorage.getItem=()=> '1';assert.equal(ctx.confirmedReplayAllowed({id:'confirmed'}),false);
});
test('paid help stays refused during a hold while free help needs no Wallet RPC',async()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');let calls=0,cost=1;
 const ctx={hintCost:()=>cost,verifyCost:()=>cost,lumenUser:{id:'a'},qaActive:false,unlimitedShardsEnabled:()=>false,
  walletSpendInFlight:false,legacyCommandInFlight:false,legacyVictoryBusy:false,canonicalOutboxRetryInFlight:false,lumenSupabase:{},
  attemptEngine:{snapshot:()=>({attemptId:'same-attempt'})},hintUsesThisGame:2,verifyUsesThisGame:2,authSessionPending:false,
  cloudProfileReady:false,walletCommandsSupported:async()=>{calls++;return true},msg:{textContent:''},recordCloudDiagnostic(){},refreshCanonicalOutboxNotice(){}};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'authorizeWalletSpend'),ctx);
 assert.equal(await ctx.authorizeWalletSpend('hint'),false);assert.equal(calls,0);
 cost=0;assert.equal(await ctx.authorizeWalletSpend('hint'),true);assert.equal(calls,0);
});
test('pending replay presentation never advertises an extra star or a confirmed badge',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const replay of [false,true]){
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{add(){}}});return nodes.get(id)};let stars=0;
  const ctx={pendingVictoryView:null,pendingNavigationEntries:[],lumenUser:{id:'a'},lumenSupabase:{},lumenProgress:{},questIsCompleted:()=>replay,
   attemptEngine:{snapshot:()=>({attemptId:'same-attempt'})},syncPresentation:{celebration(){},pending(){}},pauseGameClock(){},
   board:{classList:{add(){}}},document:{getElementById:node},shownPendingVictories:new Set(),launchWinStar:()=>stars++};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'presentPendingVictory'),ctx);ctx.presentPendingVictory('confirmed','op');
  assert.equal(stars,replay?0:1);assert.equal(node('successRewards').innerHTML.includes('Étoile'),!replay);
  assert.match(node('successSub').textContent,/récompenses en attente/);assert.equal(node('successAchievement').hidden,true);
 }
});
test('the confirmed cache read source preserves exact fields and rejects a superseded installation',async()=>{
 const rows=new Map();let supersede=false;
 const store={get:async key=>rows.get(key)??null,compareAndSwap:async(key,expected,raw,valid)=>{
  assert.equal(valid(),true);assert.equal(rows.get(key)??null,expected);rows.set(key,raw);
  if(supersede)rows.set(key,JSON.stringify({...JSON.parse(raw),revision:99,profile:{shards:999}}));
 }};
 const cache=createConfirmedProfileCache(store),profile={shards:3,solved:{0:1},future:{keep:1}};
 assert.deepEqual((await cache.installAndRead('a',profile)).profile,profile);supersede=true;
 await assert.rejects(cache.installAndRead('a',profile),/changed/);
});
