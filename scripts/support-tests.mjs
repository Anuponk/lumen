import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSupportCopy,validateSupportCapture,projectSupportProfile} from '../src/persistence/support-capture.js';
import {createSupportSession} from '../src/persistence/support-session.js';
const owner='00000000-0000-0000-0000-000000000001';
const quests=[{id:'q1',ordinal:1,legacyIndex:0},{id:'q-next',ordinal:345,legacyIndex:null}];
const profile={solved:{0:1},shards:99,performances:{0:{badges:{mastery:true},bestTime:12,secret:'FAKE_REFRESH_SECRET'}},canonicalQuestState:{'q-next':{solved:true}},token:'FAKE_AUTH_SECRET'};
function storage(){const map=new Map([['lumenCloudOwnerId',owner],['lumenProgressV1',JSON.stringify(profile)]]);return {map,get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))}}
const packet=()=>({format:1,code:'manual',events:[],version:'unknown',copies:[{source:'local',facts:[]}]});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const timers=new Map(),calls=[],store=storage();let stamp=1800000000000,counter=0,connected=true,handler;
 const client={rpc:async(name,args)=>{calls.push(args);return handler?handler(args):{data:args.p_action==='activate'||args.p_action==='status'?{id:'case',state:'active',expires_at:new Date(stamp+86400000).toISOString()}:args.p_action==='revoke'?{state:'deleted'}:{capture_id:args.p_capture_id,received_at:new Date(stamp).toISOString()}}}};
 let ctx={userId:owner,client};
 const s=createSupportSession({context:()=>ctx,capture:()=>packet(),storage:store,now:()=>stamp,online:()=>connected,uuid:()=>String(++counter),schedule:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id},cancel:id=>timers.delete(id)});
 return {s,calls,timers,store,set handler(v){handler=v},switch(){ctx={userId:'other',client};s.changed()},guest(){ctx={client};s.changed()},offline(){connected=false},online(){connected=true},advance(n){stamp+=n}};
}
test('typed capture excludes nested secrets and foreign/unowned originals without any mutation',()=>{
 const store=storage();store.setItem('sb-session','FAKE_ACCESS_TOKEN');store.setItem('lumenBeforeCloud_1',JSON.stringify(profile));
 store.setItem('lumenUnsyncedCloudBackupV2:foreign:1:x',JSON.stringify({progress:{shards:654321}}));
 store.setItem('lumenUnsyncedCloudBackupV2:'+owner+':1:x',JSON.stringify({progress:profile,reason:'FAKE_PASSWORD'}));
 const before=JSON.stringify([...store.map]);const p=captureSupportCopy({storage:store,owner,quests});
 assert.equal(p.copies.length,2);assert.match(JSON.stringify(p),/345/);assert.doesNotMatch(JSON.stringify(p),/FAKE|token|654321|foreign/);assert.equal(JSON.stringify([...store.map]),before);
 assert.throws(()=>captureSupportCopy({storage:store,owner:'foreign',quests}),/OWNER/);
});
test('closed schema rejects forged nested fields, strings, null, oversized values and copies',()=>{
 for(const p of [{...packet(),token:'secret'},{...packet(),copies:[{source:'local',facts:[{quest:1,metric:'shards',value:'FAKE_SECRET'}]}]},{...packet(),copies:[{source:'local',facts:[{quest:1,metric:'shards',value:null}]}]},{...packet(),copies:Array(4).fill(packet().copies[0])}])assert.throws(()=>validateSupportCapture(p));
 assert.deepEqual(projectSupportProfile({solved:{0:'FAKE'},performances:{0:{badges:{mastery:{secret:123}}}}},quests),[]);
 assert.throws(()=>validateSupportCapture({...packet(),copies:[{source:'local',facts:Array(6001).fill({quest:1,metric:'solved',value:true})}]}));
});
test('no consent means no activation/capture; guests cannot activate',async()=>{
 const f=fixture();await f.s.send();await f.s.activate(false);assert.equal(f.calls.length,0);f.switch();await f.s.send();assert.equal(f.calls.length,0);
 f.guest();await f.s.activate(true);assert.equal(f.calls.length,0);
});
test('offline queue reconnects with immutable identity; only server ack confirms delivery',async()=>{
 const f=fixture();await f.s.activate(true);f.offline();await f.s.send();assert.equal(f.s.view().state,'offline');assert.equal(f.calls.length,1);
 f.online();let first;f.handler=async a=>{first??=a.p_capture_id;assert.equal(a.p_capture_id,first);return {error:true}};
 await f.s.retry();assert.equal(f.s.view().state,'failed');assert.equal(f.s.view().last,null);
 f.handler=async a=>({data:{capture_id:a.p_capture_id,received_at:new Date().toISOString()}});
 await f.s.retry();assert.equal(f.s.view().state,'confirmed');assert.equal(f.s.view().pending,false);
});
test('response lost after commit and duplicated retry keep exact payload and capture identity',async()=>{
 const f=fixture();await f.s.activate(true);const requests=[];
 f.handler=async a=>{requests.push(structuredClone(a));if(requests.length===1)throw Error('lost response');return {data:{capture_id:a.p_capture_id,received_at:new Date().toISOString()}}};
 await f.s.send();await tick();await f.s.retry();assert.deepEqual(requests[0],requests[1]);assert.equal(f.s.view().state,'confirmed');
});
test('account switch during transfer suppresses old result and clears volatile copy',async()=>{
 const f=fixture();await f.s.activate(true);let finish;f.handler=()=>new Promise(r=>{finish=r});await f.s.send();assert.equal(f.s.view().state,'sending');f.switch();finish({data:{capture_id:'2',received_at:new Date().toISOString()}});await tick();assert.equal(f.s.view().state,'disabled');assert.equal(f.s.view().pending,false);
});
test('revoke wins over in-flight upload; offline revocation remains pending through recreation',async()=>{
 const f=fixture();await f.s.activate(true);let finish;
 f.handler=a=>a.p_action==='capture'?new Promise(r=>{finish=r}):Promise.resolve({error:true});
 await f.s.send();await f.s.revoke();assert.equal(f.s.view().state,'revoking');assert.equal(f.s.view().pending,false);finish({data:{capture_id:'2',received_at:new Date().toISOString()}});await tick();assert.equal(f.s.view().state,'revoking');
 await f.s.send();assert.equal(f.calls.filter(c=>c.p_action==='capture').length,1);
 f.handler=a=>({data:{state:'deleted'}});await f.s.refresh();assert.equal(f.s.view().state,'deleted');
});
test('expired activation and stale offline copy never send; reactivation gets fresh capture',async()=>{
 const f=fixture();await f.s.activate(true);f.offline();await f.s.send();f.advance(3600001);f.online();await f.s.retry();assert.equal(f.s.view().state,'failed');assert.equal(f.s.view().pending,false);
 f.advance(86400000);await f.s.send();assert.equal(f.calls.filter(c=>c.p_action==='capture').length,0);
 await f.s.activate(true);await f.s.send();await tick();assert.equal(f.s.view().state,'confirmed');
});
test('five attempts are bounded, failures/storage quota never change game state',async()=>{
 const f=fixture();const before=f.store.getItem('lumenProgressV1');await f.s.activate(true);f.handler=()=>({error:true});await f.s.send();await tick();
 for(let i=0;i<8;i++){const scheduled=[...f.timers.values()];f.timers.clear();for(const t of scheduled)t.fn();await tick()}
 assert.equal(f.calls.filter(c=>c.p_action==='capture').length,5);assert.equal(f.store.getItem('lumenProgressV1'),before);
});
test('unacknowledged and mismatched receipts never display sent',async()=>{
 const f=fixture();await f.s.activate(true);f.handler=()=>({data:{capture_id:'wrong',received_at:new Date().toISOString()}});await f.s.send();await tick();assert.equal(f.s.view().state,'failed');assert.equal(f.s.view().last,null);
});
test('incident storms deduplicate into one pending copy and respect cooldown',async()=>{
 const f=fixture();await f.s.activate(true);for(let i=0;i<20;i++)f.s.incident('hydration_blocked');for(const t of [...f.timers.values()])if(t.ms===0)t.fn();await tick();
 assert.equal(f.calls.filter(c=>c.p_action==='capture').length,1);
 f.s.incident('runtime_exception');for(const t of [...f.timers.values()])if(t.ms===0)t.fn();await tick();assert.equal(f.calls.filter(c=>c.p_action==='capture').length,1);
});
test('scheduled old-account incident cannot capture under a newly activated account',async()=>{
 const f=fixture();await f.s.activate(true);f.s.incident('hydration_blocked');const scheduled=[...f.timers.values()];f.timers.clear();f.switch();await f.s.activate(true);
 for(const t of scheduled)t.fn();await tick();assert.equal(f.calls.filter(c=>c.p_action==='capture').length,0);
});
test('denied local storage cannot re-enable uploads after an unconfirmed revocation',async()=>{
 const f=fixture();await f.s.activate(true);f.store.getItem=()=>{throw Error('storage denied')};f.store.setItem=()=>{throw Error('quota')};f.handler=()=>({error:true});
 await f.s.revoke();await f.s.send();f.s.incident('runtime_exception');await tick();assert.equal(f.s.view().state,'revoking');assert.equal(f.calls.filter(c=>c.p_action==='capture').length,0);
});
test('missing/corrupt local profile refuses capture without touching an original',()=>{
 const s=storage();for(const raw of ['null','{"secret":"FAKE_SECRET"}','{corrupted']){s.setItem('lumenProgressV1',raw);assert.throws(()=>captureSupportCopy({storage:s,owner,quests}));assert.equal(s.getItem('lumenProgressV1'),raw)}
});
test('corrupt withdrawal metadata cannot break consent or confirmed transport',async()=>{
 for(const raw of ['null','42','"corrupt"','[]']){const f=fixture();f.store.setItem('lumenSupportRevocationsV1',raw);await f.s.activate(true);await f.s.send();await tick();assert.equal(f.s.view().state,'confirmed')}
});
