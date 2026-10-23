import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersistenceCoordinator} from '../src/persistence/persistence-coordinator.js';
import {createConfirmedProfileCache,createTransactionalCommandCache} from '../src/persistence/transactional-command-cache.js';
import {configureCommandSession,createDurableCanonicalVictoryOutbox,submitWalletCommand,inspectCommandOutboxes} from '../src/persistence/coordinated-command-adapters.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup(){let current={userId:'a',client:{},generation:1};return {session:()=>current,change:patch=>{current={...current,...patch}}}}

test('one account serializes all domains and keeps the lock during a lost response',async()=>{
 const s=setup(),c=createPersistenceCoordinator(s),gate=deferred(),order=[];
 const first=c.dispatch('a',s.session().client,async()=>{order.push('quest');await gate.promise;throw Error('lost reply')});
 const second=c.dispatch('a',s.session().client,async()=>{order.push('wallet');return 'receipt'});
 await tick();assert.deepEqual(order,['quest']);
 gate.resolve();await assert.rejects(first,/lost reply/);assert.equal(await second,'receipt');assert.deepEqual(order,['quest','wallet']);
});
for(const patch of [{generation:2},{userId:'b'},{client:{}},{userId:null}])test('queued dispatch is abandoned after session change '+Object.keys(patch)[0],async()=>{
 const s=setup(),c=createPersistenceCoordinator(s),gate=deferred();let emitted=0;
 const first=c.dispatch('a',s.session().client,()=>gate.promise),second=c.dispatch('a',s.session().client,()=>{emitted++});
 await tick();s.change(patch);gate.resolve();
 await assert.rejects(first,{code:'SESSION_CHANGED'});await assert.rejects(second,{code:'SESSION_CHANGED'});assert.equal(emitted,0);
});
test('late rejection is classified as stale and cannot publish a new-session result',async()=>{
 const s=setup(),c=createPersistenceCoordinator(s),gate=deferred();
 const work=c.dispatch('a',s.session().client,()=>gate.promise);await tick();s.change({generation:2});gate.reject(Error('old server error'));
 await assert.rejects(work,{code:'SESSION_CHANGED'});
});
test('submit freezes evidence before asynchronous storage and retains original owner on invalidation',async()=>{
 const s=setup(),c=createPersistenceCoordinator(s),gate=deferred();let captured;
 c.register({domain:'Wallet',enqueue:async(userId,questId,reward,options)=>{await gate.promise;captured={userId,questId,reward,options};return captured}});
 const evidence={request:{amount:1}},work=c.submit('Wallet','a','wallet',evidence,{operationId:'same-id'});
 evidence.request.amount=99;s.change({userId:'b'});gate.resolve();await assert.rejects(work,{code:'SESSION_CHANGED'});
 assert.equal(captured.userId,'a');assert.equal(captured.reward.request.amount,1);assert.equal(captured.options.operationId,'same-id');
});
test('shadow coordinator inspects without enqueue, acknowledgement, metadata changes or RPC',async()=>{
 const c=createPersistenceCoordinator({mode:'shadow'});let writes=0;
 const box=c.register({domain:'Legacy',inspect:async()=>({pending:[{operationId:'original'}]}),enqueue:()=>writes++,acknowledge:()=>writes++,pause:()=>writes++,resume:()=>writes++,archiveRecreatedCapture:()=>writes++});
 assert.equal((await c.inspect('a')).Legacy.pending[0].operationId,'original');
 await assert.rejects(c.submit('Legacy','a','q',{}),{code:'SHADOW_ONLY'});
 for(const name of ['acknowledge','pause','resume','archiveRecreatedCapture'])assert.throws(()=>box[name](),{code:'SHADOW_ONLY'});
 assert.throws(()=>c.dispatch('a',{},()=>writes++),{code:'SHADOW_ONLY'});assert.equal(writes,0);
});
test('Web Locks uses one account key across independent coordinators',async()=>{
 const queues=new Map(),names=[],locks={request:(name,options,run)=>{names.push(name);const result=(queues.get(name)||Promise.resolve()).catch(()=>{}).then(run);queues.set(name,result);return result}};
 const a=createPersistenceCoordinator({locks}),b=createPersistenceCoordinator({locks}),gate=deferred(),order=[];
 const first=a.dispatch('a',{},async()=>{order.push('one');await gate.promise});const second=b.dispatch('a',{},()=>order.push('two'));
 await tick();assert.deepEqual(order,['one']);gate.resolve();await Promise.all([first,second]);assert.deepEqual(order,['one','two']);assert.equal(new Set(names).size,1);
});
test('transactional cache delegates both immutable intent and pending state to one storage transaction',async()=>{
 const calls=[],store=createTransactionalCommandCache({capture:async(...args)=>calls.push(args),retire:async(...args)=>calls.push(args)});
 const entry={version:2,userId:'a',operationId:'op',questId:'q',createdAt:'now',reward:{shards:123}},key='lumenCanonicalVictoryOutboxV2:a:op',raw=JSON.stringify(entry);
 await store.put(key,raw);await store.remove(key,raw);
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0][0],key);assert.equal(calls[0][1],raw);
 assert.deepEqual(JSON.parse(calls[0][3]),{version:1,userId:'a',domain:'Canonical',operationId:'op',questId:'q',createdAt:'now',status:'pending'});
 await assert.rejects(store.put(key,JSON.stringify({...entry,userId:'b'})),/owner/);
});
test('a backend lacking atomic support never claims paired preservation',async()=>{
 let writes=0;const store=createTransactionalCommandCache({put:async()=>writes++});
 await assert.rejects(store.put('lumenWalletVictoryOutboxV2:a:op',JSON.stringify({version:2,userId:'a',operationId:'op'})),/unavailable/);assert.equal(writes,0);
});
test('confirmed cache preserves unknown fields, isolates owners and refuses stale installation',async()=>{
 const rows=new Map(),store={get:async key=>rows.get(key)??null,compareAndSwap:async(key,expected,raw,valid)=>{if(!valid()||(rows.get(key)??null)!==expected)throw Error('changed');rows.set(key,raw)}},cache=createConfirmedProfileCache(store);
 const profile={shards:3,solved:{0:true},future:{keep:1}};
 await cache.install('a',profile);assert.deepEqual((await cache.read('a')).profile,profile);assert.equal(await cache.read('b'),null);
 await assert.rejects(cache.install('a',{shards:999},{sessionValid:()=>false}));assert.equal((await cache.read('a')).profile.shards,3);
 await cache.install('a',{...profile,shards:1});assert.equal((await cache.read('a')).revision,2);
});

test('actual coordinated Wallet transport retains a committed intent across generation change and verifies exactly one debit on retry',async()=>{
 const rows=new Map(),storage={get length(){return rows.size},key:i=>[...rows.keys()][i]??null,getItem:key=>rows.get(key)??null,setItem:(key,raw)=>rows.set(key,raw),removeItem:key=>rows.delete(key)};
 const fallback={entries:async()=>[],put:async()=>{throw Error('denied')},get:async()=>null,remove:async()=>{}};
 const box=createDurableCanonicalVictoryOutbox(storage,{namespace:'Wallet',fallback});
 let generation=1,debits=0,changeOnCommit=true;const receipts=new Map(),profile={solved:{},badges:{},shards:10};
 const client={rpc:async(name,args)=>{
  assert.equal(args.p_expected_user_id,'a');
  if(name==='lumen_commit_wallet_command'){
   if(!receipts.has(args.p_operation_id)){
    debits++;profile.shards--;profile.walletRevision=debits;
    receipts.set(args.p_operation_id,{version:1,operationId:args.p_operation_id,request:args.p_request,revision:debits,balance:profile.shards});
   }
   if(changeOnCommit){generation++;changeOnCommit=false}
   throw Error('lost response');
  }
  if(name==='lumen_get_wallet_command')return {data:receipts.get(args.p_operation_id)};
  if(name==='lumen_restore_profile')return {data:structuredClone(profile)};
  throw Error('Unexpected RPC '+name);
 }};
 const issues=[];configureCommandSession(()=>({userId:'a',client,generation}),{onIssue:issue=>issues.push(issue.kind)});
 const request={kind:'hint',attemptId:'attempt',resetCount:0,sequence:1};
 await assert.rejects(submitWalletCommand(box,client,'a','original-id',request),{code:'SESSION_CHANGED'});
 assert.equal((await inspectCommandOutboxes('a')).Wallet.pending[0].operationId,'original-id');assert.equal(debits,1);
 const result=await submitWalletCommand(box,client,'a','original-id',request);
 assert.equal(result.profile.shards,9);assert.equal(debits,1);assert.equal((await box.pending('a')).length,0);
 assert.ok(issues.includes('confirmed_cache_unavailable'),'A refused mirror remains observable without repeating the debit');
});
