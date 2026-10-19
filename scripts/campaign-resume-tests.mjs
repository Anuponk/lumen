import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalAttemptToResume,nextCanonicalAtLegacyBoundary,preserveAttemptSnapshot} from '../src/campaign/campaign-resume.js';
import {canonicalQuestList,canonicalInsertedQuestDecision} from '../src/campaign/canonical-quests.js';
const quests=canonicalQuestList(),last=quests.find(q=>q.id==='planned-real-24-q10'),next=quests.find(q=>q.ordinal===last.ordinal+1);
const completed=quests.filter(q=>q.ordinal<=last.ordinal);
const progress={solved:Object.fromEntries(completed.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(completed.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true}]))};
const available=q=>canonicalInsertedQuestDecision(q,progress).status==='ready';
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
