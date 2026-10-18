import test from 'node:test';
import assert from 'node:assert/strict';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';

function local(){const data=new Map();return {data,get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function indexed(){const data=new Map();return {data,entries:async prefix=>[...data].filter(([key])=>key.startsWith(prefix)),get:async key=>data.get(key)??null,put:async(key,raw)=>{if(data.has(key)&&data.get(key)!==raw)throw Error('immutable');data.set(key,raw)},remove:async(key,raw)=>{if(data.has(key)&&data.get(key)!==raw)throw Error('changed');data.delete(key)}};}
const unavailable={entries:async()=>{throw Error('denied')},get:async()=>{throw Error('denied')},put:async()=>{throw Error('denied')},remove:async()=>{throw Error('denied')}};
const reward={badges:{autonomy:true},stars:1};
const saved=id=>({profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true,speed:true}}}}});
const legacy=(userId,questId)=>({userId,questId,reward,createdAt:'2026-10-18T00:00:00.000Z'});

test('quota or denied localStorage still persists through the asynchronous durable store and restart',async()=>{
 const fallback=indexed();
 const denied={get length(){throw Error('denied')},getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 const box=createDurableCanonicalVictoryOutbox(denied,{fallback});
 const entry=await box.enqueue('a','q',reward);
 assert.ok(fallback.data.size);
 const restarted=createDurableCanonicalVictoryOutbox(denied,{fallback});
 assert.deepEqual(await restarted.pending('a'),[entry]);
 await replayCanonicalVictoryOutbox(restarted,'a',async id=>saved(id));
 assert.deepEqual(await restarted.pending('a'),[]);
});

test('denied IndexedDB falls back to verified localStorage, while denial of both never claims durability',async()=>{
 const storage=local(),box=createDurableCanonicalVictoryOutbox(storage,{fallback:unavailable});
 const entry=await box.enqueue('a','q',reward);
 assert.deepEqual(await createDurableCanonicalVictoryOutbox(storage,{fallback:unavailable}).pending('a'),[entry]);
 const quota={...storage,setItem(){throw Error('quota')}};
 await assert.rejects(createDurableCanonicalVictoryOutbox(quota,{fallback:unavailable}).enqueue('a','other',reward),/durably recorded/);
 assert.equal((await box.pending('a')).length,1);
});

test('corrupt old entries are preserved and reported without blocking another valid victory',async()=>{
 const storage=local(),fallback=indexed(),issues=[];
 const bad='lumenCanonicalVictoryOutboxV1:a:broken';storage.setItem(bad,'{broken');
 const box=createDurableCanonicalVictoryOutbox(storage,{fallback,onIssue:issue=>issues.push(issue.kind)});
 const pending=await box.enqueue('a','independent',reward);
 assert.equal((await box.inspect('a')).pending[0].operationId,pending.operationId);
 const results=await replayCanonicalVictoryOutbox(box,'a',async id=>saved(id));
 assert.equal(results.length,1);assert.equal(storage.getItem(bad),'{broken');
 assert.ok(issues.includes('invalid_entry'));
});

test('old V1 records survive upgrade and account isolation, including a lost response',async()=>{
 const storage=local(),fallback=indexed();
 for(const user of ['a','b'])storage.setItem('lumenCanonicalVictoryOutboxV1:'+user+':q',JSON.stringify(legacy(user,'q')));
 const box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await replayCanonicalVictoryOutbox(box,'a',async()=>{throw Error('response lost')});
 assert.equal((await box.pending('a')).length,1);assert.equal((await box.pending('b')).length,1);
 await replayCanonicalVictoryOutbox(box,'a',async id=>saved(id));
 assert.equal((await box.pending('a')).length,0);assert.equal((await box.pending('b')).length,1);
});

test('separate runs for one quest retain separate immutable operation identities and evidence',async()=>{
 const storage=local(),fallback=indexed(),box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 const first=await box.enqueue('a','q',reward,{operationId:'run-a'});
 assert.deepEqual(await box.enqueue('a','q',reward,{operationId:'run-a'}),first,'retry reuses the same immutable operation');
 const nextReward={badges:{speed:true},stars:1};
 await box.enqueue('a','q',nextReward,{operationId:'run-b'});
 assert.equal((await box.pending('a')).length,2);
 await assert.rejects(box.enqueue('a','q',nextReward,{operationId:first.operationId}),/different evidence/);
 await box.acknowledge('a','q',reward,'run-a');
 assert.deepEqual((await box.pending('a')).map(entry=>entry.reward),[nextReward]);
});

test('refused same-quest predecessor prevents reordering that quest but independent work proceeds',async()=>{
 const box=createDurableCanonicalVictoryOutbox(local(),{fallback:indexed(),now:()=> '2026-10-18T00:00:00.000Z'});
 await box.enqueue('a','q',reward,{operationId:'a'});await box.enqueue('a','q',reward,{operationId:'b'});
 await box.enqueue('a','other',reward,{operationId:'c'});
 const calls=[];
 await replayCanonicalVictoryOutbox(box,'a',async id=>{calls.push(id);if(id==='q')throw Error('refused');return saved(id)});
 assert.deepEqual(calls,['q','other']);assert.equal((await box.pending('a')).length,2);
});

test('conflicting durable copies are kept for recovery and neither is acknowledged',async()=>{
 const storage=local(),fallback=indexed(),box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 const entry=await box.enqueue('a','q',reward,{operationId:'run'});
 const key='lumenCanonicalVictoryOutboxV2:a:run';storage.setItem(key,JSON.stringify({...entry,reward:{badges:{speed:true}}}));
 assert.deepEqual(await box.pending('a'),[]);
 assert.ok((await box.inspect('a')).issues.includes('conflicting_copies'));
 await assert.rejects(box.acknowledge('a','q',reward,'run'),/requires recovery/);
 assert.equal(storage.data.size,1);assert.equal(fallback.data.size,1);
});

test('cleanup failure reports a verified win but preserves the immutable intent for idempotent retry',async()=>{
 const fallback=indexed(),issues=[];fallback.remove=async()=>{throw Error('aborted')};
 const box=createDurableCanonicalVictoryOutbox(local(),{fallback});await box.enqueue('a','q',reward);
 const results=await replayCanonicalVictoryOutbox(box,'a',async id=>saved(id),{onIssue:issue=>issues.push(issue.kind)});
 assert.equal(results.length,1);assert.equal((await box.pending('a')).length,1);assert.deepEqual(issues,['cleanup']);
});

test('an unreadable store is not proof of an empty queue; its intents recover when access returns',async()=>{
 const storage=local(),fallback=indexed();let readable=true;
 const entries=fallback.entries;fallback.entries=async prefix=>{if(!readable)throw Error('temporarily blocked');return entries(prefix)};
 const box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 const entry=await box.enqueue('a','q',reward,{operationId:'persisted'});
 readable=false;
 const uncertain=await box.inspect('a');
 assert.equal(uncertain.pending.length,0);assert.equal(uncertain.complete,false);
 assert.ok(uncertain.issues.includes('indexed_unavailable'));
 assert.equal(fallback.data.size,1,'Unreadable does not mean missing or acknowledged');
 readable=true;
 const recovered=await box.inspect('a');
 assert.equal(recovered.complete,true);assert.deepEqual(recovered.pending,[entry]);
 await replayCanonicalVictoryOutbox(box,'a',async id=>saved(id));
 assert.equal((await box.inspect('a')).pending.length,0);
});
