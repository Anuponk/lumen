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
