import assert from 'node:assert/strict';
import {cloudSafelyCoversLocal,restoreRicherCloudProfile} from '../src/persistence/cloud-profile.js';
import {alignQuestResets,installVerifiedQuestResets,obsoleteQuestIntent} from '../src/persistence/quest-reset.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {createAttemptEngine} from '../src/game/attempt-engine.js';
import {canonicalAttemptToResume} from '../src/campaign/campaign-resume.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPersistenceCoordinator} from '../src/persistence/persistence-coordinator.js';
const local={solved:{},badges:{},canonicalQuestState:{q:{solved:true,badges:{mastery:true},performance:{bestTime:1}}}};
const remote={solved:{},badges:{},canonicalQuestState:{q:{solved:false,badges:{},runPerformance:{},resetRevision:1,resetAt:'2026-11-08T00:00:00Z',rewardedBeforeReset:true}}};
assert.equal(cloudSafelyCoversLocal(local,remote),true,'explicit server reset supersedes obsolete local achievements');
const data=new Map([['lumenProgressV1',JSON.stringify(local)]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
assert.equal(restoreRicherCloudProfile(storage,remote).changed,true);
assert.deepEqual(JSON.parse(data.get('lumenProgressV1')),remote);
assert([...data.values()].includes(JSON.stringify(local)),'exact obsolete save is archived');
assert.equal(cloudSafelyCoversLocal(remote,local),false,'stale cloud cannot remove reset epoch');
console.log('PASS explicit quest reset and exact local archive');
function memory(){
 const map=new Map();return {map,get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
function indexed(){const map=new Map();return {map,entries:async prefix=>[...map].filter(([k])=>k.startsWith(prefix)),get:async k=>map.get(k)??null,put:async(k,v)=>{if(map.has(k)&&map.get(k)!==v)throw Error('Conflict');map.set(k,v)},remove:async(k,v)=>{assert.equal(map.get(k),v);map.delete(k)}}}
const unaffected={solved:true,badges:{autonomy:true},performance:{bestTime:9}},richLocal={...local,shards:7,xp:400,canonicalQuestState:{...local.canonicalQuestState,untouched:unaffected}};
const aligned=alignQuestResets(richLocal,remote);
assert.deepEqual(aligned.profile.canonicalQuestState.untouched,unaffected);
assert.equal(aligned.profile.shards,7);assert.equal(aligned.profile.xp,400);
assert.deepEqual(richLocal.canonicalQuestState.q,local.canonicalQuestState.q,'pure alignment');
assert.equal(alignQuestResets(aligned.profile,remote).changed,false,'idempotent epoch');
assert.throws(()=>alignQuestResets(remote,local),/stale/);
assert.throws(()=>alignQuestResets(local,{canonicalQuestState:{q:{resetRevision:-1}}}),/Invalid/);
const denied=memory();denied.setItem('lumenProgressV1',JSON.stringify(local));
denied.setItem=()=>{throw Error('quota')};
assert.throws(()=>installVerifiedQuestResets(denied,remote,{userId:'player'}),/quota/);
assert.equal(denied.getItem('lumenProgressV1'),JSON.stringify(local));
const switched=memory();switched.setItem('lumenProgressV1',JSON.stringify(local));
assert.throws(()=>installVerifiedQuestResets(switched,remote,{userId:'player',sessionValid:()=>false}),/session/);
for(const device of [memory(),memory()]){
 device.setItem('lumenProgressV1',JSON.stringify(local));assert(installVerifiedQuestResets(device,remote,{userId:'player'}));
 assert.equal(JSON.parse(device.getItem('lumenProgressV1')).canonicalQuestState.q.solved,false);
}
const s=memory(),fallback=indexed(),outbox=createDurableCanonicalVictoryOutbox(s,{fallback});
const old=await outbox.enqueue('player','q',{facts:{seconds:1}},{operationId:'old'});
const oldKey='lumenCanonicalVictoryOutboxV2:player:old';s.setItem(oldKey,JSON.stringify(old));
await outbox.enqueue('player','q',{facts:{seconds:120}},{operationId:'qr1.current'});
await outbox.enqueue('player','untouched',{facts:{seconds:5}},{operationId:'other-quest'});
await outbox.enqueue('other-player','q',{facts:{seconds:2}},{operationId:'other-player'});
assert.equal(await outbox.retireQuestResets('player',remote),1);
assert.deepEqual((await outbox.pending('player')).map(e=>e.operationId).sort(),['other-quest','qr1.current']);
assert.equal((await outbox.pending('other-player')).length,1);
const archive=[...fallback.map].find(([k])=>k.startsWith('lumenQuestResetIntentArchiveV1:'));
assert.deepEqual(JSON.parse(archive[1]).copies.map(c=>c.raw),[JSON.stringify(old),JSON.stringify(old)]);
assert.equal(await outbox.retireQuestResets('player',remote),0);
assert.equal(obsoleteQuestIntent({questId:'q',operationId:'qr10.wrong'},remote),true,'prefix must match full epoch');
const blockedStore=memory(),blockedIndexed=indexed(),blockedOutbox=createDurableCanonicalVictoryOutbox(blockedStore,{fallback:blockedIndexed});
await blockedOutbox.enqueue('player','q',{facts:{seconds:1}},{operationId:'stale'});
blockedIndexed.put=async()=>{throw Error('quota')};blockedStore.setItem=()=>{throw Error('quota')};
await assert.rejects(blockedOutbox.retireQuestResets('player',remote),/quota/);
assert.equal((await blockedOutbox.pending('player')).length,1,'no archive means no retirement');
const quest=canonicalQuestList().find(q=>q.legacyIndex===null),attemptStore=memory(),engine=createAttemptEngine({storage:attemptStore});
const board=quest.reg.map(row=>row.map(()=>0)),oldAttempt=engine.create({questId:quest.id,board,gridRevision:quest.gridRevision??0});
assert.equal(engine.restore({questId:quest.id,questResetRevision:1}),null);
assert([...attemptStore.map.values()].some(raw=>JSON.parse(raw).attemptId===oldAttempt.attemptId),'old active attempt archived');
const newAttempt=engine.create({questId:quest.id,board,questResetRevision:1,gridRevision:quest.gridRevision??0});
assert.match(newAttempt.attemptId,/^qr1\./);
const progress={canonicalQuestState:{[quest.id]:{...remote.canonicalQuestState.q}},xp:400,shards:7,autonomousWins:2,stars:{},challenges:{}};
assert.equal(canonicalAttemptToResume(oldAttempt,[quest],{ownerId:'player',progress}),null);
assert.equal(canonicalAttemptToResume(newAttempt,[quest],{ownerId:'player',progress}),quest);
const facts={seconds:120,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:true,qualifiedDay:'2026-11-08',qualifiedAt:'2026-11-08T12:00:00Z'};
const result=applyQuestVictory(progress,quest,facts);
assert.equal(result.firstCompletion,true);assert.equal(progress.xp,400);assert.equal(progress.shards,7);assert.equal(progress.autonomousWins,2);
assert.equal(progress.canonicalQuestState[quest.id].runPerformance.bestTime,120);
assert.equal(progress.canonicalQuestState[quest.id].badges.speed,false,'old fast record is gone');
console.log('PASS two-device reset, scoped outbox retirement, archive failure, attempts and no duplicate rewards');

// Exercise the actual hydration hook: reset retirement precedes any replay or
// wallet work, the obsolete profile is archived, and stale in-memory play reloads.
const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const start=source.indexOf('afterAuthCloudSync:async()=>{')+'afterAuthCloudSync:async()=>{'.length;
const end=source.indexOf('},holdLegacyMergeForFullRestore',start);assert(end>start);
for(const changeSession of [false,true]){
 const cache=memory(),store=indexed(),queue=createDurableCanonicalVictoryOutbox(cache,{fallback:store});
 cache.setItem('lumenProgressV1',JSON.stringify(local));cache.setItem('lumenCloudOwnerId','player');
 await queue.enqueue('player','q',{facts:{seconds:1}},{operationId:'old-device'});
 let reloads=0,context;
 context=vm.createContext({cloudHydrationGeneration:0,qaActive:false,lumenUser:{id:'player'},lumenSupabase:{},
  canonicalRecoveryContext:null,canonicalRecovery:{cancel(){}},sessionStorage:{getItem:()=>null},
  cloudProfileReady:false,cloudProfileBaseline:null,localStorage:cache,lumenProgress:local,
  loadVerifiedProfile:async()=>{if(changeSession)context.lumenUser={id:'replacement'};return structuredClone(remote)},
  currentCatalogueOrigin:{},canonicalVictoryOutbox:queue,installVerifiedQuestResets,
  location:{reload:()=>reloads++},console:{warn:()=>assert.fail('Reset hydration unexpectedly failed')},
  recordCloudDiagnostic:()=>{},updateAuthUI:()=>assert.fail('Reset must reload before UI hydration')});
 await vm.runInContext('(async()=>{'+source.slice(start,end)+'})()',context);
 assert.equal(reloads,changeSession?0:1);
 assert.equal(JSON.parse(cache.getItem('lumenProgressV1')).canonicalQuestState.q.solved,changeSession);
 assert.equal((await queue.pending('player')).length,changeSession?1:0);
 assert.equal(context.cloudProfileReady,false,'no stale ready profile published');
}
console.log('PASS production hydration reset ordering and session switch');
const coordinatedStorage=memory(),coordinatedStore=indexed(),rawBox=createDurableCanonicalVictoryOutbox(coordinatedStorage,{fallback:coordinatedStore});
await rawBox.enqueue('player','q',{facts:{seconds:1}},{operationId:'stale-coordinated'});
let session={userId:'player',client:{},generation:1};
const facade=createPersistenceCoordinator({session:()=>session}).register(rawBox),write=coordinatedStore.put;
coordinatedStore.put=async(key,raw)=>{await write(key,raw);session={...session,generation:2}};
await assert.rejects(facade.retireQuestResets('player',remote),/session|changed/i);
assert.equal((await rawBox.pending('player')).length,1,'coordinator generation prevents stale cleanup');
const shadow=createPersistenceCoordinator({mode:'shadow'}).register(rawBox);
assert.throws(()=>shadow.retireQuestResets('player',remote),/Read-only/);
console.log('PASS coordinator generation and read-only reset guards');

