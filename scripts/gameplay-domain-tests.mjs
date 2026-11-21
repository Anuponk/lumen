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
test('choosing another acquired replay retires only the old pending presentation, keeping its captured operation',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),client={},captured={operationId:'first-reset-0',reward:{facts:{seconds:45}}};
 const pending={userId:'a',client,attemptId:'first',questId:'first-quest'},rows=new Map([['original',JSON.stringify(captured)]]);let state='RUNNING',cleared=0;
 const ctx={pendingVictoryView:pending,lumenUser:{id:'a'},lumenSupabase:client,skyTourActive:()=>false,questIsAccessible:()=>true,
  attemptEngine:{snapshot:()=>({state,attemptId:'first'}),complete:()=>{state='COMPLETED'},clear:()=>cleared++},
  syncPresentation:{celebration(){}},hideSuccess(){},canonicalActiveQuest:null,levelIndex:0,replayMode:false,
  pendingRevealOpen:()=>true,closeUnifiedSkyReveal:()=>{closed++},
  document:{getElementById:()=>({})},loadPuzzle(){},refreshJourney(){}};let closed=0;
 vm.createContext(ctx);
 vm.runInContext(functionSource(source,'leavePendingVictoryForNavigation'),ctx);
 vm.runInContext(functionSource(source,'launchReplay'),ctx);ctx.launchReplay(10);
 assert.equal(ctx.pendingVictoryView,null);assert.equal(cleared,1);assert.equal(rows.get('original'),JSON.stringify(captured));
 assert.equal(closed,1,'#682 (I): the pending single result screen closes with its presentation');
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
test('help on a verified replay while historical wallet recovery is pending records its time penalty',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),uses=[];
 const ctx={cloudProfileReady:false,cloudProfileFailure:held.failure,hintUsesThisGame:2,usedHintThisGame:false,
  attemptEngine:{recordAssistanceUse:(...args)=>uses.push(args),markAssistance(){}},trackAttemptEvent(){}};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'recordHintUse'),ctx);
 ctx.recordHintUse();assert.deepEqual(uses,[['hint',3]]);assert.equal(ctx.usedHintThisGame,true);
 assert.equal(ctx.cloudProfileFailure,held.failure);
});
test('pending replay presentation never advertises an extra star or a confirmed badge',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const replay of [false,true]){
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{add(){}}});return nodes.get(id)};let stars=0;
  const shown=[],overlay=[],quest={id:'confirmed'};
  nodes.set('successOverlay',{classList:{add:c=>overlay.push(c)}});
  const ctx={pendingVictoryView:null,pendingNavigationEntries:[],lumenUser:{id:'a'},lumenSupabase:{},lumenProgress:{},questIsCompleted:()=>replay,
   attemptEngine:{snapshot:()=>({attemptId:'same-attempt'})},syncPresentation:{celebration(){},pending(){}},pauseGameClock(){},
   board:{classList:{add(){}}},document:{getElementById:node},shownPendingVictories:new Set(),launchWinStar:()=>stars++,
   canonicalQuestList:()=>[quest],CONTENT_CONSTELLATIONS:[],readQuestView:()=>({badges:replay?{autonomy:true}:{}}),lastRewardState:null,
   showSkyReveal:(...args)=>shown.push(args)};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'presentPendingVictory'),ctx);ctx.presentPendingVictory('confirmed','op');
  assert.equal(stars,replay?0:1);assert.equal(node('successRewards').innerHTML.includes('Étoile'),!replay);
  assert.match(node('successSub').textContent,/récompenses en attente/);assert.equal(node('successAchievement').hidden,true);
  // #682 (I) / #699: same single result screen, never the historical overlay card.
  assert.deepEqual(overlay,[],'successOverlay is never shown for a pending victory');
  assert.equal(JSON.stringify(shown),JSON.stringify([[null,null,{quest,newlyCompleted:!replay,pending:true}]]));
  assert.equal(JSON.stringify(ctx.lastRewardState),JSON.stringify({stars:0,badges:{},qualifying:false,prior:replay?{autonomy:true}:{},completed:replay,pending:true}));
  assert.equal(node('successShare').hidden,false);assert.equal(node('successShare').disabled,true,'No challenge before the server ACK');
  assert.equal(node('successNew').textContent,'Quête suivante');
  ctx.presentPendingVictory('confirmed','op');assert.equal(shown.length,1,'The same operation is presented once');
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
test('#682 (I): the pending screen retry resends in place, never twice, and reloads only when the session cannot retry',async()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),client={};
 const run=async(overrides={})=>{
  const calls=[];const pending={userId:'a',client};
  const ctx={pendingVictoryView:pending,lumenUser:{id:'a'},lumenSupabase:client,canonicalActiveQuest:{id:'q'},
   canonicalVictoryInFlight:null,legacyVictoryBusy:false,pendingVictoryRetryInFlight:null,navigator:{onLine:true},
   canonicalVictoryOutbox:{resume:async(owner,scope)=>calls.push('resume:'+scope.kind),pending:async()=>[]},legacyVictoryOutbox:{resume:async()=>calls.push('legacy'),pending:async()=>overrides.queued??[]},
   canRetryPresentedVictory:()=>true,retryPresentedVictory:async()=>{calls.push('resend');ctx.pendingVictoryView=null;return false},
   retryAccountCloudSync:async()=>calls.push('reload'),syncPresentation:{celebration(){}},recordCloudDiagnostic:e=>calls.push('diag:'+e),...overrides};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'retryPendingVictoryInPlace'),ctx);
  await ctx.retryPendingVictoryInPlace();return calls;
 };
 assert.deepEqual(await run(),['resume:all','diag:victory_pending_manual_retry','resend'],'Ready session: same operation resent on the same screen, no reload');
 assert.deepEqual(await run({canonicalVictoryInFlight:{}}),[],'A running command is never doubled');
 assert.deepEqual(await run({pendingVictoryRetryInFlight:{}}),[],'A running retry is never doubled');
 assert.deepEqual(await run({navigator:{onLine:false}}),[],'Offline: stay pending, reconnection retries automatically');
 assert.deepEqual(await run({canRetryPresentedVictory:()=>false}),['resume:all','reload'],'Unready session keeps the previous full resynchronisation');
 assert.deepEqual(await run({pendingVictoryView:null}),['reload'],'Without a presented victory, the previous behaviour is kept');
 assert.deepEqual(await run({queued:[{operationId:'earlier'}]}),['resume:all','diag:victory_pending_manual_retry','resend','reload'],'Other queued victories keep the full resynchronisation');
 assert.deepEqual(await run({canonicalActiveQuest:null}),['legacy','diag:victory_pending_manual_retry','resend'],'Historical quests use their own outbox');
});
