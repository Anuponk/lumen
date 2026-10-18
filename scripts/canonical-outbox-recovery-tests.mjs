import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';

const storage=()=>{const values=new Map();return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const reward={badges:{autonomy:true},stars:1};
const saved=id=>({profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true}}}}});

test('one refused quest does not stop another independent durable victory',async()=>{
 const box=createCanonicalVictoryOutbox(storage());
 box.enqueue('player','blocked',reward);box.enqueue('player','independent',reward);
 const calls=[];
 const confirmed=await replayCanonicalVictoryOutbox(box,'player',async id=>{
  calls.push(id);if(id==='blocked')throw Error('quest unavailable');return saved(id);
 });
 assert.deepEqual(calls,['blocked','independent']);
 assert.equal(confirmed.length,1);
 assert.deepEqual(box.pending('player').map(e=>e.questId),['blocked']);
});

test('a solved-only stale reply cannot discard pending earned badges',async()=>{
 const box=createCanonicalVictoryOutbox(storage());box.enqueue('player','replay',reward);
 const confirmed=await replayCanonicalVictoryOutbox(box,'player',async()=>({profile:{canonicalQuestState:{replay:{solved:true,badges:{}}}}}));
 assert.equal(confirmed.length,0);
 assert.equal(box.pending('player').length,1);
});

test('a session switch during commit keeps the old account intent',async()=>{
 const box=createCanonicalVictoryOutbox(storage());box.enqueue('old','quest',reward);
 let current=true;
 await replayCanonicalVictoryOutbox(box,'old',async id=>{current=false;return saved(id);},{sessionValid:()=>current});
 assert.equal(box.pending('old').length,1);assert.equal(box.pending('new').length,0);
});

test('asynchronous durable adapters are awaited before removing a victory',async()=>{
 let removed=false;
 const box={pending:async()=>[{userId:'player',questId:'quest',reward}],acknowledge:async()=>{await Promise.resolve();removed=true;}};
 const confirmed=await replayCanonicalVictoryOutbox(box,'player',async id=>saved(id));
 assert.equal(removed,true);assert.equal(confirmed.length,1);
});
