import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalAttemptToResume,nextCanonicalAtLegacyBoundary,preserveAttemptSnapshot} from '../src/campaign/campaign-resume.js';
import {canonicalQuestList,canonicalInsertedQuestDecision} from '../src/campaign/canonical-quests.js';
import {nextCanonicalQuest} from '../src/campaign/playable-navigation.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
const quests=canonicalQuestList(),last=quests.find(q=>q.id==='planned-real-24-q10'),next=quests.find(q=>q.ordinal===last.ordinal+1);
const completed=quests.filter(q=>q.ordinal<=last.ordinal);
const progress={solved:Object.fromEntries(completed.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(completed.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true}]))};
const available=q=>canonicalInsertedQuestDecision(q,progress).status==='ready';

test('verified ownership handoff selects a catalogue frontier and refreshes its real board without reward writes',async()=>{
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{functionSource}=await import('./source-tools.mjs');
 const source=readFileSync('src/ui/game-screen.js','utf8');
 const inserted=quests.find(q=>q.legacyIndex===null);
 for(const target of [quests[2],inserted]){
  const done=quests.filter(q=>q.ordinal<target.ordinal),profile={catalogueOrigin:currentCatalogueOrigin,
   solved:Object.fromEntries(done.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),
   canonicalQuestState:Object.fromEntries(done.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true}]))};
  const before=JSON.stringify(profile),calls=[];
  const ctx={qaActive:false,cloudProfileReady:true,lumenUser:{id:'account'},socialChallenge:null,
   lumenProgress:profile,nextCanonicalQuest,adventureAccessEntitlements:()=>[],canonicalActiveQuest:null,canonicalResumeOwner:null,
   levelIndex:0,replayMode:true,currentQuestPosition:()=>2,currentQuestLimit:()=>quests.length,
   attemptEngine:{clear:()=>calls.push('clear')},loadPuzzle:()=>calls.push('load'),refreshJourney:()=>calls.push('refresh')};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'resumeHydratedCampaignSelection'),ctx);
  assert.equal(ctx.resumeHydratedCampaignSelection(),true);
  assert.deepEqual(calls,['clear','load','refresh']);assert.equal(ctx.replayMode,false);
  assert.equal(ctx.canonicalActiveQuest?.id??quests.find(q=>q.legacyIndex===ctx.levelIndex).id,target.id);
  assert.equal(ctx.canonicalResumeOwner,target.legacyIndex===null?'account':null);
  assert.equal(JSON.stringify(profile),before,'Navigation cannot grant an acquisition or change the wallet');
  for(const patch of [{qaActive:true},{cloudProfileReady:false},{lumenUser:null},{socialChallenge:{id:'social'}}]){
   const saved=Object.fromEntries(Object.keys(patch).map(k=>[k,ctx[k]]));Object.assign(ctx,patch);calls.length=0;
   assert.equal(ctx.resumeHydratedCampaignSelection(),false);assert.deepEqual(calls,[]);Object.assign(ctx,saved);
  }
  ctx.nextCanonicalQuest=()=>({status:'locked'});calls.length=0;
  assert.equal(ctx.resumeHydratedCampaignSelection(),false);assert.deepEqual(calls,[],'Locked content cannot replace the preserved attempt');
 }
});
test('the completed numeric boundary resumes the first unfinished canonical constellation',()=>{
 const before=JSON.stringify(progress);
 assert.equal(nextCanonicalAtLegacyBoundary(quests,progress,{atBoundary:true,available}).id,next.id);
 assert.equal(JSON.stringify(progress),before);
 for(const context of [{atBoundary:false,available},{atBoundary:true,available:()=>false},{atBoundary:true,available,attempt:{state:'RUNNING'}},{atBoundary:true,available,attempt:{state:'PAUSED'}}])assert.equal(nextCanonicalAtLegacyBoundary(quests,progress,context),null);
});
test('a later frontier is independent from earlier catch-up and from ownership of the next pack',()=>{
 const historical={solved:{...progress.solved},canonicalQuestState:{[last.id]:{solved:true},[quests.find(q=>q.ordinal===last.ordinal-1).id]:{solved:true}}};
 const result=nextCanonicalAtLegacyBoundary(quests,historical,{atBoundary:true,afterOrdinal:last.ordinal,available:q=>canonicalInsertedQuestDecision(q,historical,{entitlements:['real-adventure-04']}).status==='ready'});
 assert.equal(result.id,next.id);
 assert.equal(historical.canonicalQuestState[quests.find(q=>q.legacyIndex===null).id],undefined,'Do not complete earlier optional additions');
});
test('restore a registered active canonical attempt without changing evidence',()=>{
 const attempt={attemptId:'same-run',questId:next.id,mode:'campaign',state:'PAUSED',startedAt:100,resetCount:2,activeDuration:12345,assistanceUsed:true,mistakeCommitted:true,board:next.reg.map(row=>row.map(()=>0))};
 const before=JSON.stringify(attempt);
 assert.equal(canonicalAttemptToResume(attempt,quests,{ownerId:'synthetic',accountId:'synthetic'}).id,next.id);
 assert.equal(JSON.stringify(attempt),before);
 for(const options of [{},{ownerId:'synthetic',accountId:'other'},{ownerId:'synthetic',qa:true},{ownerId:'synthetic',social:true}])assert.equal(canonicalAttemptToResume(attempt,quests,options),null);
 for(const patch of [{mode:'challenge'},{state:'COMPLETED'},{state:'ABANDONED'},{questId:'missing'},{questId:1},{board:[]},{attemptId:null}])assert.equal(canonicalAttemptToResume({...attempt,...patch},quests,{ownerId:'synthetic'}),null);
});
test('account-switch backup is verified before the old active attempt can be replaced',()=>{
 const raw='{"attemptId":"keep","board":[[1]],"resetCount":3}',values=new Map([['active',raw]]);
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const key=preserveAttemptSnapshot(storage,'active',{now:()=>123});
 assert.equal(storage.getItem(key),raw);assert.equal(storage.getItem('active'),raw);
 values.set(key,'other backup');assert.throws(()=>preserveAttemptSnapshot(storage,'active',{now:()=>123}),/collision/);
 assert.equal(storage.getItem(key),'other backup');assert.equal(storage.getItem('active'),raw);
 assert.throws(()=>preserveAttemptSnapshot({...storage,setItem(){}},'active',{now:()=>124}),/verification/);
 assert.equal(storage.getItem('active'),raw);
});


test('starting Dauphin must not create a performance under the dormant legacy index',async()=>{
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{functionSource}=await import('./source-tools.mjs');
 const source=readFileSync('src/ui/game-screen.js','utf8');let starts=0,saves=0;
 const ctx={canonicalActiveQuest:next,levelIndex:198,lumenProgress:{performances:{}},
  ATTEMPT_STATES:{READY:'READY'},attemptEngine:{snapshot:()=>({state:'READY',qualifying:true}),start(){starts++}},
  saveLumenProgress(){saves++},trackAttemptEvent(){},attemptMode:()=> 'campaign',localCalendarDay:()=> '2026-10-20'};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'ensureAttemptStarted'),ctx);ctx.ensureAttemptStarted();
 assert.deepEqual(ctx.lumenProgress.performances,{});assert.equal(saves,0);assert.equal(starts,1);
 ctx.canonicalActiveQuest=null;ctx.ensureAttemptStarted();
 assert.equal(saves,1);assert.equal(starts,2);assert.equal(ctx.lumenProgress.performances[198].questIndex,198,'Legacy qualification remains unchanged');
});

test('a canonical board never renders the dormant legacy challenge banner',async()=>{
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{functionSource}=await import('./source-tools.mjs');
 const source=readFileSync('src/ui/game-screen.js','utf8');
 const nodes={challengeBanner:{hidden:false},challengeTitle:{textContent:''},challengeCopy:{textContent:''}};
 const ctx={canonicalActiveQuest:next,levelIndex:198,lumenProgress:{stars:{}},document:{getElementById:id=>nodes[id]},
  activeBonusChallenge:()=>null,bonusChallengeFor:()=>null,canonicalQuestForLegacy:()=>({id:'historical-final'}),canonicalQuestMilestone:quest=>quest===next?null:({title:'Grand Chien',copy:'catalogue final'})};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'renderXP'),ctx);ctx.renderXP();
 assert.equal(nodes.challengeBanner.hidden,true);assert.equal(nodes.challengeTitle.textContent,'');
 ctx.canonicalActiveQuest=null;ctx.renderXP();assert.equal(nodes.challengeBanner.hidden,false);assert.equal(nodes.challengeTitle.textContent,'Grand Chien');
});


test('archive only recognized canonical-start metadata after verified backup, preserving all earned data and the run',async()=>{
 const {archiveCanonicalStartMetadata}=await import('../src/persistence/cloud-profile.js');
 const cloud={solved:{0:1},badges:{earned:true},performances:{0:{badges:{speed:true},attempts:2}},shards:7,xp:40};
 const record={questIndex:198,lastQualifiedAt:'2026-10-20T08:45:02.000Z',lastQualifiedDay:'2026-10-20'};
 const local={...structuredClone(cloud),performances:{...structuredClone(cloud.performances),198:record},future:{keep:true}};
 const attempt={questId:next.id,attemptId:'keep-run',mode:'campaign',state:'PAUSED',startedAt:1,board:next.reg.map(row=>row.map(()=>0))};
 const options={quest:next,attempt,legacyIndex:198,ownerId:'owner',accountId:'owner'};
 const fixture=(value=local)=>{
  const raw=JSON.stringify(value),map=new Map([['lumenProgressV1',raw],['lumenActiveAttemptV1',JSON.stringify(attempt)],['pending-victory','immutable']]);
  return {raw,map,storage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
 };
 const f=fixture();assert.equal((await archiveCanonicalStartMetadata(f.storage,cloud,options)).changed,true);
 const expected=structuredClone(local);delete expected.performances[198];
 assert.deepEqual(JSON.parse(f.map.get('lumenProgressV1')),expected);
 assert.equal(f.map.get('lumenActiveAttemptV1'),JSON.stringify(attempt));assert.equal(f.map.get('pending-victory'),'immutable');
 assert([...f.map].some(([k,v])=>k.startsWith('lumenBeforeCanonicalStartMetadataLocal_')&&v===f.raw));
 assert([...f.map].some(([k,v])=>k.startsWith('lumenBeforeCanonicalStartMetadataRemote_')&&v===JSON.stringify(cloud)));
 assert.equal((await archiveCanonicalStartMetadata(f.storage,cloud,options)).changed,false,'No recovery/reload loop');
 for(const patch of [{badges:{}},{attempts:1},{time:9},{future:'keep'},{questIndex:197},{lastQualifiedAt:'invalid'}]){
  const value=structuredClone(local);Object.assign(value.performances[198],patch);const g=fixture(value);
  assert.equal((await archiveCanonicalStartMetadata(g.storage,cloud,options)).changed,false);
  assert.equal(g.map.get('lumenProgressV1'),g.raw);assert.equal(g.map.size,3);
 }
 for(const patch of [{ownerId:'other'},{accountId:null},{quest:{...next,legacyIndex:198}},{attempt:{...attempt,mode:'challenge'}},{attempt:{...attempt,state:'READY'}},{attempt:{...attempt,questId:'other'}}]){
  const g=fixture();assert.equal((await archiveCanonicalStartMetadata(g.storage,cloud,{...options,...patch})).changed,false);assert.equal(g.map.get('lumenProgressV1'),g.raw);
 }
 for(const remote of [{...cloud,performances:{...cloud.performances,198:{}}}]){
  const g=fixture();assert.equal((await archiveCanonicalStartMetadata(g.storage,remote,options)).changed,false);assert.equal(g.map.get('lumenProgressV1'),g.raw);
 }
 const earned=structuredClone(local);earned.solved[198]=1;const held=fixture(earned);
 assert.equal((await archiveCanonicalStartMetadata(held.storage,cloud,options)).changed,true);
 assert.equal(JSON.parse(held.map.get('lumenProgressV1')).solved[198],1,'A completed legacy quest remains completed');
 const completedRemote={...structuredClone(cloud),solved:{...cloud.solved,198:1}},completed=fixture({...local,solved:completedRemote.solved});
 assert.equal((await archiveCanonicalStartMetadata(completed.storage,completedRemote,options)).changed,true);
 assert.deepEqual(JSON.parse(completed.map.get('lumenProgressV1')).solved,completedRemote.solved);
 for(const fault of ['backup','account','concurrent']){
  const g=fixture();let valid=true;const put=g.storage.setItem;
  g.storage.setItem=(k,v)=>{
   if(k.startsWith('lumenBeforeCanonicalStartMetadataRemote_')){
    if(fault==='backup')throw Error('quota');
    if(fault==='account')valid=false;
    if(fault==='concurrent')g.map.set('lumenProgressV1','newer local save');
   }
   put(k,v);
  };
  const call=()=>archiveCanonicalStartMetadata(g.storage,cloud,{...options,sessionValid:()=>valid});
  if(fault==='backup')await assert.rejects(call);else assert.equal((await call()).changed,false);
  assert.equal(g.map.get('lumenProgressV1'),fault==='concurrent'?'newer local save':g.raw);
 }
});
