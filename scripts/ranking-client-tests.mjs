import assert from 'node:assert/strict';
import {createRankingClient} from '../src/persistence/ranking.js';
function memory(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
const storage=memory(),calls=[];let fail=false,status='pending',gate=null;
const client={async rpc(name,args){calls.push({name,args});if(gate)await gate;if(fail)throw Error('offline');return {data:name==='lumen_ranking_finish'?{status,questId:'q',improved:true}:{eligible:true}}}};
let c={owner:'test-a',client};const create=()=>createRankingClient({storage,getContext:()=>c});let ranking=create();
const q={id:'q',gridRevision:2},a={rankingVersion:1,attemptId:'attempt-test',resetCount:0,mode:'campaign',startedAt:1,helpUses:{hint:1,verify:2}};
fail=true;ranking.stage(q,a);await assert.rejects(()=>ranking.flush());assert.equal(ranking.entries(c.owner).length,1);
ranking=create();fail=false;await ranking.flush();assert.equal(ranking.entries(c.owner).length,1,'Unconfirmed victory remains pending');
status='confirmed';await ranking.flush();assert.equal(ranking.entries(c.owner).length,0);
assert.deepEqual(calls.find(c=>c.name==='lumen_ranking_finish').args,{p_operation_id:'attempt-test-reset-0',p_hint_uses:1,p_verify_uses:2});
assert.equal(ranking.capture(q,{...a,rankingVersion:undefined}),null,'No inferred historical score');
assert.equal(ranking.capture(q,{...a,mode:'challenge'}),null,'Social challenges isolated');
ranking.stage(q,{...a,resetCount:1});c={owner:'test-b',client};await ranking.flush();assert.equal(ranking.entries('test-a').length,1,'Owner B cannot send A');
c={owner:'test-a',client};let release;gate=new Promise(r=>release=r);const sending=ranking.flush();await Promise.resolve();c={owner:'test-b',client};release();await assert.rejects(()=>sending,/account changed/);gate=null;
c={owner:'test-a',client};await ranking.membership(false);assert.equal(ranking.entries('test-a').length,0,'Withdrawal retires unpublished captures');
// Begin acknowledgement racing with a completed run never removes the result.
let resume;gate=new Promise(r=>resume=r);const start=ranking.begin(q,{...a,resetCount:2});await Promise.resolve();ranking.stage(q,{...a,resetCount:2});const finish=ranking.flush();resume();await start;await finish;gate=null;
assert.equal(ranking.entries('test-a').length,0);assert.equal(calls.at(-1).name,'lumen_ranking_finish');
const denied=createRankingClient({storage:{getItem:()=>null,setItem(){throw Error('quota')}},getContext:()=>c});
assert.throws(()=>denied.stage(q,a),/quota/);
console.log('Ranking staging: offline, reload, exact counters, owner changes, begin/finish race, withdrawal and quota pass');

// #775: an older rejected capture must not prevent a first qualifying score.
{
 const store=memory(),sent=[];
 const connection={async rpc(name,args){
  if(name==='lumen_ranking_finish'){
   sent.push(args.p_operation_id);
   if(args.p_operation_id==='old-reset-0')return {error:{code:'22023'}};
   return {data:{status:'confirmed',questId:'first',improved:true}};
  }
  return {data:{eligible:true}};
 }};
 const make=()=>createRankingClient({storage:store,getContext:()=>({owner:'owner',client:connection})});
 let queue=make();queue.stage({id:'old'}, {...a,attemptId:'old'});
 queue.stage({id:'first'}, {...a,attemptId:'first',helpUses:{}});
 await assert.rejects(()=>queue.flush());
 assert.deepEqual(sent,['old-reset-0','first-reset-0'],'Every independent capture is attempted despite an earlier refusal');
 assert.deepEqual(queue.entries('owner').map(e=>e.questId),['old'],'Only the exact rejected capture remains durable');
 queue=make();assert.deepEqual(queue.entries('owner').map(e=>e.questId),['old'],'Reload preserves the refused evidence without resurrecting the confirmed score');
}

// #962: production showed one pre-#777 capture (receipt hintUsed=true, 0 counted hint)
// refused 250 times a day with ranking_finish_hint_flag_mismatch. A refusal that
// describes the stored receipt is archived (kept, never deleted) and not replayed;
// refusals that can change later stay pending.
{
 const store=memory(),sent=[];
 const reasons={'stale-reset-0':'ranking_finish_hint_flag_mismatch','early-reset-0':'ranking_finish_seconds_out_of_range'};
 const connection={async rpc(name,args){
  if(name==='lumen_ranking_finish'){
   sent.push(args.p_operation_id);
   if(reasons[args.p_operation_id])return {error:{code:'22023',message:reasons[args.p_operation_id]}};
   return {data:{status:'confirmed',questId:'fresh',improved:true}};
  }
  return {data:{eligible:true}};
 }};
 const queue=createRankingClient({storage:store,getContext:()=>({owner:'owner',client:connection})});
 for(const id of ['stale','early','fresh'])queue.stage({id}, {...a,attemptId:id});
 await assert.rejects(()=>queue.flush(),'a refusal that may change later still reports the queue as incomplete');
 assert.deepEqual(queue.entries('owner').map(e=>e.questId),['early'],'only the transient refusal stays pending');
 assert(store.getItem('lumenRankingObsoleteV1:owner:stale-reset-0'),'the permanently refused capture is archived, not deleted');
 sent.length=0;await assert.rejects(()=>queue.flush());
 assert.deepEqual(sent,['early-reset-0'],'an archived capture is never replayed');
 const single=createRankingClient({storage:memory(),getContext:()=>({owner:'owner',client:connection})});
 single.stage({id:'stale'}, {...a,attemptId:'stale'});
 assert.deepEqual((await single.flush()).map(r=>[r.status,r.reason]),[['refused','ranking_finish_hint_flag_mismatch']]);
 console.log('Ranking refusals: permanent receipt refusals archived once, time refusals kept pending');
}
