import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalConstellationCatchupAvailable,canonicalQuestList,canonicalInsertedQuestDecision,canonicalCampaignQuestDecision} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {insertedQuestDecision} from '../src/campaign/catalogue-access.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {hasPackAccess} from '../src/campaign/content.js';
import {catalogueQuestDecision} from '../src/campaign/catalogue-access.js';
import {nextCanonicalQuest} from '../src/campaign/playable-navigation.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const q=(id,index,pack,constellation,ordinal)=>({id,legacyIndex:index,packId:pack,constellationId:constellation,ordinal});

test('each completed published quest preserves pack access and replay independently of inserted prerequisites',()=>{
 const quests=canonicalQuestList();
 for(const quest of quests){
  const progress=quest.legacyIndex!==null?{solved:{[quest.legacyIndex]:1}}:{solved:{},canonicalQuestState:{[quest.id]:{solved:true,badges:{speed:true}}}};
  const before=JSON.stringify(progress),pack=CONTENT_PACKS.find(p=>p.id===quest.packId);
  assert.equal(hasPackAccess(pack,[],progress),true,quest.id+' completion proves started access');
  assert.deepEqual(canonicalCampaignQuestDecision(quest,progress,{signedIn:true,cloudReady:true}),{status:'ready',reason:'replay'},quest.id);
  if(quest.legacyIndex===null)assert.equal(canonicalCampaignQuestDecision(quest,progress,{signedIn:true,cloudReady:false}).status,'sync-required');
  assert.equal(JSON.stringify(progress),before,'A read cannot materialize acquisitions');
 }
});

test('Antlia: historical frontier stays acquired while a current-cohort player cannot skip new prerequisites',()=>{
 const quests=canonicalQuestList(),antlia=quests.find(q=>q.constellationId==='iau-ant');
 const preceding=quests.filter(q=>q.ordinal<antlia.ordinal);
 const historical={solved:Object.fromEntries(preceding.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:{},xp:321,shards:7};
 const context={entitlements:[antlia.packId],signedIn:true,cloudReady:true};
 const original=JSON.stringify(historical);
 assert.equal(canonicalCampaignQuestDecision(antlia,historical,context).status,'ready','Existing players retain their frontier after the insertion of Dauphin and other new constellations');
 const current={...structuredClone(historical),catalogueOrigin:currentCatalogueOrigin};
 assert.equal(canonicalCampaignQuestDecision(antlia,current,context).status,'prerequisite','Ownership does not allow a new player to skip unplayed quests');
 for(const quest of preceding.filter(q=>q.legacyIndex===null))current.canonicalQuestState[quest.id]={solved:true};
 assert.equal(canonicalCampaignQuestDecision(antlia,current,context).status,'ready');
 for(let restore=0;restore<3;restore++)assert.equal(canonicalCampaignQuestDecision(antlia,JSON.parse(JSON.stringify(historical)),context).status,'ready');
 assert.equal(JSON.stringify(historical),original,'No completion, badge or reward is backfilled');
 assert.equal(canonicalCampaignQuestDecision(antlia,{catalogueOrigin:currentCatalogueOrigin},{}).status,'pack-locked');
});
test('past completed adventure: a new constellation is independent from additions in earlier adventures',()=>{
 const quests=[q('a-old',0,'a','a-1',1),q('a-added',null,'a','a-1',2),q('b-old',1,'b','b-1',3),q('b-new-1',null,'b','b-new',4),q('b-new-2',null,'b','b-new',5)];
 const progress={solved:{0:1,1:1},canonicalQuestState:{}};
 assert.equal(canonicalConstellationCatchupAvailable(quests[3],progress,quests),true,'First quest in the new constellation must be playable');
 assert.equal(canonicalConstellationCatchupAvailable(quests[4],progress,quests),false,'Its own new sequence remains ordered');
 assert.deepEqual(progress,{solved:{0:1,1:1},canonicalQuestState:{}},'Access must not award completion');
});
test('new constellation is not granted to a merely started, incomplete historical adventure',()=>{
 const quests=[q('old-1',0,'b','b-1',1),q('old-2',1,'b','b-2',2),q('new-1',null,'b','b-new',3)];
 assert.equal(canonicalConstellationCatchupAvailable(quests[2],{solved:{0:1}},quests),false);
});

const v1=[q('a-old',0,'a','a-1',1),q('b-old',1,'b','b-1',2),q('b-old-2',2,'b','b-2',3)];
const v2=[v1[0],q('a-added',null,'a','a-1',2),{...v1[1],ordinal:3},{...v1[2],ordinal:4},q('b-new-1',null,'b','b-new',5)];
const v3=[...v2,q('b-new-2',null,'b','b-new',6),q('b-second-1',null,'b','b-second',7),q('b-second-2',null,'b','b-second',8)];
const v4=[...v3,q('b-new-3',null,'b','b-new',9),q('b-third-1',null,'b','b-third',10)];
const historic={solved:{0:1,1:1,2:1},canonicalQuestState:{},xp:123,shards:4,badges:{earned:1},legacyAdventureAccess:['b']};
test('successive additive catalogues preserve catch-up, variable group sizes and local prerequisites',()=>{
 const before=JSON.stringify(historic);
 for(const quests of [v2,v3,v4]){
  for(const id of ['b-new-1','b-second-1','b-third-1']){
   const quest=quests.find(q=>q.id===id);if(!quest)continue;
   assert.equal(insertedQuestDecision(quest,historic,quests).status,'ready');
  }
  for(const id of ['b-new-2','b-new-3','b-second-2']){
   const quest=quests.find(q=>q.id===id);if(!quest)continue;
   assert.equal(insertedQuestDecision(quest,historic,quests).status,'prerequisite');
  }
 }
 assert.equal(JSON.stringify(historic),before,'Repeated evaluation neither migrates nor mutates player data');
});
test('a later insertion cannot relock an unfinished quest acquired in an intermediate catalogue',()=>{
 const old=[q('old',0,'b','old-c',1)];
 const second=[...old,q('added-frontier',null,'b','new-c',2),q('added-later',null,'b','new-c',3)];
 const third=[old[0],q('new-before-frontier',null,'b','new-c',2),{...second[1],ordinal:3},{...second[2],ordinal:4}];
 const progress={solved:{0:1}};
 assert.equal(insertedQuestDecision(second[1],progress,second,{originQuests:old}).status,'ready');
 assert.equal(insertedQuestDecision(third[2],progress,third,{originQuests:old,pastCatalogues:[old,second]}).status,'ready','The previously acquired unfinished stable ID remains playable');
 assert.equal(insertedQuestDecision(third[3],progress,third,{originQuests:old,pastCatalogues:[old,second]}).status,'prerequisite','An old locked successor stays locked');
 assert.equal(insertedQuestDecision(third[1],progress,third,{originQuests:old,pastCatalogues:[old,second]}).status,'ready','The new insertion is available independently');
});
test('catch-up advances only its own sequence and solved quests remain replayable',()=>{
 const progress=structuredClone(historic);
 progress.canonicalQuestState['b-new-1']={solved:true};
 assert.equal(insertedQuestDecision(v4.find(q=>q.id==='b-new-1'),progress,v4).reason,'replay');
 assert.equal(insertedQuestDecision(v4.find(q=>q.id==='b-new-2'),progress,v4).status,'ready');
 assert.equal(insertedQuestDecision(v4.find(q=>q.id==='b-new-3'),progress,v4).questId,'b-new-2');
 assert.equal(progress.canonicalQuestState['a-added'],undefined);
});
test('a new player must follow the current catalogue, even in an owned adventure',()=>{
 const progress={solved:{},canonicalQuestState:{}};
 for(const quest of v4){
  if(quest.legacyIndex!==null){progress.solved[quest.legacyIndex]=1;continue}
  assert.equal(insertedQuestDecision(quest,progress,v4,{originQuests:v4}).status,'ready');
  const later=v4.find(q=>q.ordinal>quest.ordinal&&q.legacyIndex===null);
  if(later)assert.equal(insertedQuestDecision(later,progress,v4,{originQuests:v4}).status,'prerequisite');
  progress.canonicalQuestState[quest.id]={solved:true};
 }
});
test('an incomplete historical adventure preserves only constellations with their own evidence',()=>{
 const quests=[q('old-1',0,'b','c1',1),q('added-1',null,'b','c1',2),q('added-2',null,'b','c1',3),q('old-2',1,'b','c2',4),q('new-c',null,'b','c-new',5)];
 const progress={solved:{0:1}};
 assert.equal(insertedQuestDecision(quests[1],progress,quests).status,'ready');
 assert.equal(insertedQuestDecision(quests[2],progress,quests).status,'prerequisite');
 assert.equal(insertedQuestDecision(quests[4],progress,quests).status,'prerequisite');
});
test('a started canonical-only constellation survives another earlier addition',()=>{
 const progress={solved:{0:1},canonicalQuestState:{'b-new-1':{solved:true}}};
 assert.equal(insertedQuestDecision(v3.find(q=>q.id==='b-new-2'),progress,v3).status,'ready');
 assert.equal(insertedQuestDecision(v3.find(q=>q.id==='b-second-1'),progress,v3).status,'prerequisite');
});
test('historical access never creates ownership or bypasses account requirements beyond discovery; acquired replays remain accessible',()=>{
 // #522 intentionally replaces the storage-key account gate with visible quest 7.
 const later=v3.map(q=>({...q,ordinal:q.ordinal+6})),quest=later.find(q=>q.id==='b-new-1');
 for(const [context,status] of [[{packAllowed:false},'pack-locked'],[{signedIn:false},'auth-required'],[{cloudReady:false},'sync-required']]){
  assert.equal(insertedQuestDecision(quest,historic,later,context).status,status);
  const replay={...historic,canonicalQuestState:{[quest.id]:{solved:true}}};
  assert.equal(insertedQuestDecision(quest,replay,later,context).status,context.packAllowed===false?'pack-locked':context.cloudReady===false?'sync-required':'ready','Replay preserves acquired guest access without creating pack ownership or releasing an authenticated restore hold');
 }
});
test('no-history adventure and absent content cannot receive fabricated historical access',()=>{
 const quests=[q('old',0,'a','a-1',1),q('new',null,'b','b-1',2),q('new-2',null,'b','b-1',3)];
 assert.equal(insertedQuestDecision(quests[2],{solved:{0:1}},quests).status,'prerequisite');
 assert.equal(insertedQuestDecision(q('absent',null,'b','b-1',4),historic,quests).status,'missing-content');
});
test('renumbering preserves stable completion and does not touch an active attempt',()=>{
 const progress={...structuredClone(historic),canonicalQuestState:{'b-new-1':{solved:true,badges:{speed:true}}}};
 const attempt={questId:'b-new-2',attemptId:'stable-attempt',startedAt:123,resetCount:1,board:[[2,0]]};
 const before=JSON.stringify({progress,attempt});
 const renamed=v3.map((q,i)=>({...q,ordinal:10+i*3}));
 const decision=insertedQuestDecision(renamed.find(q=>q.id==='b-new-2'),progress,renamed,{attempt});
 assert.equal(decision.status,'ready');assert.equal(JSON.stringify({progress,attempt}),before);
});
test('real catalogue: every new constellation in a completed historical adventure opens exactly its first quest',()=>{
 const quests=canonicalQuestList();
 let covered=0;
 for(const pack of CONTENT_PACKS){
  const adventure=quests.filter(q=>q.packId===pack.id),old=adventure.filter(q=>q.legacyIndex!==null);
  if(!old.length)continue;
  const progress={solved:Object.fromEntries(old.map(q=>[q.legacyIndex,1])),canonicalQuestState:{},legacyAdventureAccess:[pack.id]};
  const before=JSON.stringify(progress);
  for(const id of new Set(adventure.map(q=>q.constellationId))){
   const group=adventure.filter(q=>q.constellationId===id);if(group.some(q=>q.legacyIndex!==null))continue;
   assert.equal(canonicalInsertedQuestDecision(group[0],progress).status,'ready');
   for(const quest of group.slice(1))assert.equal(canonicalInsertedQuestDecision(quest,progress).status,'prerequisite');
   covered++;
  }
  assert.equal(JSON.stringify(progress),before);
 }
 assert.ok(covered>0,'The regression must cover actual wholly new constellations');
});
test('real catalogue refuses a paid inserted quest without pack access',()=>{
 const quests=canonicalQuestList();
 const paid=CONTENT_PACKS.find(pack=>pack.access==='locked');
 const quest=quests.find(q=>q.packId===paid.id&&q.legacyIndex===null);
 assert.equal(canonicalInsertedQuestDecision(quest,{}).status,'pack-locked');
});
test('local/cloud serialization and repeated restores retain historical access',()=>{
 const quests=v4,quest=quests.find(q=>q.id==='b-new-1');
 let profile=structuredClone(historic);
 for(let device=0;device<4;device++){
  profile=JSON.parse(JSON.stringify(profile));
  assert.deepEqual(insertedQuestDecision(quest,profile,quests),{status:'ready',reason:'historical-access'});
 }
 assert.deepEqual(profile,historic);
});
test('started attempts preserve stable access, while READY and social attempts do not',()=>{
 const quest=v4.find(q=>q.id==='b-new-3'),context={originQuests:v4};
 assert.equal(catalogueQuestDecision(quest,{solved:{}},v4,{...context,attempt:{questId:quest.id,startedAt:123,mode:'campaign'}}).reason,'preserved-attempt');
 for(const attempt of [{questId:quest.id,mode:'campaign'},{questId:quest.id,startedAt:123,mode:'challenge'}])assert.equal(catalogueQuestDecision(quest,{solved:{}},v4,{...context,attempt}).status,'prerequisite');
 assert.equal(catalogueQuestDecision(quest,{solved:{}},v4,{...context,packAllowed:false,attempt:{questId:quest.id,startedAt:123,mode:'campaign'}}).status,'pack-locked');
});
test('canonical-only campaign evidence retains pack access but social/READY evidence does not',()=>{
 const pack=CONTENT_PACKS.find(p=>p.access==='locked');
 const quest=canonicalQuestList().find(q=>q.packId===pack.id&&q.legacyIndex===null);
 assert.equal(hasPackAccess(pack,[],{canonicalQuestState:{[quest.id]:{solved:true}}}),true);
 assert.equal(hasPackAccess(pack,[],{},{questId:quest.id,startedAt:123,mode:'campaign'}),true);
 assert.equal(hasPackAccess(pack,[],{},{questId:quest.id,mode:'campaign'}),false);
 assert.equal(hasPackAccess(pack,[],{},{questId:quest.id,startedAt:123,mode:'challenge'}),false);
});
test('Continue retains the historical frontier instead of forcing all earlier additions',()=>{
 const quests=canonicalQuestList();
 const solved=Object.fromEntries(quests.filter(q=>q.legacyIndex!==null&&q.packId!=='real-adventure-04').map(q=>[q.legacyIndex,1]));
 const result=nextCanonicalQuest(solved,{},['real-adventure-04']);
 assert.equal(result.status,'ready');assert.equal(result.quest.packId,'real-adventure-04');
 assert.equal(result.quest.legacyIndex,Math.max(...Object.keys(solved).map(Number))+1);
 assert.equal(Object.keys(solved).length,Object.values(solved).filter(Boolean).length,'Navigation invents no wins');
});
test('the actual UI adapter and start guard share readiness without bypassing prerequisite/cloud checks',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const quests=canonicalQuestList(),pack=CONTENT_PACKS.find(p=>p.id==='real-adventure-03');
 const group=quests.filter(q=>q.packId===pack.id&&q.constellationId===pack.id+'-new-01');
 const progress={solved:Object.fromEntries(quests.filter(q=>q.packId===pack.id&&q.legacyIndex!==null).map(q=>[q.legacyIndex,1]))};
 const context={confirmedReplayAllowed:()=>false,canonicalInsertedQuestDecision,canonicalQuestList,lumenProgress:progress,lumenEntitlements:[],adventureAccessEntitlements:()=>[],attemptEngine:{snapshot:()=>null},qaActive:false,lumenUser:{id:'synthetic'},cloudProfileReady:true};
 context.navigationProgress=()=>context.lumenProgress;
 vm.createContext(context);
 vm.runInContext(['canonicalQuestAccess','canonicalQuestAvailable','canonicalQuestLockReason','startCanonicalQuest'].map(name=>functionSource(source,name)).join('\n'),context);
 assert.equal(context.canonicalQuestAvailable(group[0]),true);
 assert.equal(context.canonicalQuestAvailable(group[1]),false);
 assert.equal(context.startCanonicalQuest(group[1]),false,'Direct start cannot bypass local order');
 assert.ok(context.canonicalQuestLockReason(group[1]).includes(String(group[0].ordinal)));
 context.cloudProfileReady=false;
 assert.equal(context.canonicalQuestAvailable(group[0]),false);
 assert.equal(context.startCanonicalQuest(group[0]),false);
 assert.equal(context.canonicalQuestLockReason(group[0]),'Synchronisation du compte requise');
 context.cloudProfileReady=true;context.lumenUser=null;
 assert.equal(context.canonicalQuestAccess(group[0]).status,'auth-required');
});
