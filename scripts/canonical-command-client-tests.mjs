import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {commitCanonicalVictoryViaLedger as transport} from '../src/persistence/canonical-progress.js';
const ownerId='00000000-0000-0000-0000-000000000001';
const commitCanonicalVictoryViaLedger=(client,id,reward,options={})=>transport(client,id,reward,{userId:ownerId,...options});
const quest=canonicalQuestList().find(q=>q.legacyIndex===null),reward={badges:{autonomy:true},performance:{seconds:20},stars:1};
const base=()=>({solved:{},badges:{},canonicalQuestState:{},xp:0});
function fixture(){
 const state={profile:base(),receipts:new Map(),calls:[],missing:false,lost:false,readLost:false,versionError:null,userId:ownerId};
 const client={rpc:async(name,args)=>{
  state.calls.push([name,args]);
  if(['lumen_commit_canonical_command','lumen_get_canonical_command'].includes(name)&&args.p_expected_user_id!==state.userId)return {data:null,error:{code:'42501'},status:403};
  if(name==='lumen_canonical_command_version')return state.versionError||{data:state.missing?null:1,error:state.missing?{code:'PGRST202'}:null,status:state.missing?404:200};
  if(name==='lumen_get_canonical_command')return {data:state.readLost?null:state.receipts.get(args.p_operation_id)??null,error:null};
  if(name==='lumen_restore_profile')return {data:structuredClone(state.profile),error:null};
  if(!['lumen_commit_canonical_command','lumen_commit_canonical_victory'].includes(name))throw Error('Unexpected RPC '+name);
  const request={version:1,operationId:args.p_operation_id,questId:args.p_quest_id,badges:args.p_badges,performance:args.p_performance};
  const prior=state.receipts.get(args.p_operation_id);
  if(prior&&JSON.stringify({...prior,newlyCompleted:undefined,recordedAt:undefined})!==JSON.stringify(request))return {data:null,error:{code:'22023'},status:400};
  const fresh=!state.profile.canonicalQuestState[args.p_quest_id]?.solved;
  state.profile.canonicalQuestState[args.p_quest_id]={solved:true,badges:args.p_badges};
  if(fresh)state.profile.xp+=15;
  if(name==='lumen_commit_canonical_command'&&!prior)state.receipts.set(args.p_operation_id,{...request,newlyCompleted:fresh,recordedAt:'2026-10-18T00:00:00Z'});
  if(state.lost)throw Error('response lost');
  return {data:{profile:structuredClone(state.profile),newlyCompleted:fresh},error:null};
 }};
 return {state,client};
}
test('immutable operation identity reaches the server and is verified independently',async()=>{
 const {client,state}=fixture();
 const saved=await commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'});
 assert.ok(state.calls.some(([name,args])=>name==='lumen_commit_canonical_command'&&args.p_operation_id==='run-1'));
 assert.equal(state.calls.find(([name])=>name==='lumen_commit_canonical_command')[1].p_expected_user_id,ownerId,'Server must bind the intended account even if the SDK token switches late');
 assert.ok(state.calls.some(([name])=>name==='lumen_get_canonical_command'));
 assert.equal(saved.receipt.operationId,'run-1');assert.equal(saved.profile.xp,15);
});
test('response lost after commit recovers the exact receipt without a legacy write',async()=>{
 const {client,state}=fixture();state.lost=true;
 const saved=await commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'});
 assert.equal(saved.alreadySaved,true);assert.equal(saved.receipt.operationId,'run-1');
 assert.equal(state.calls.filter(([name])=>name==='lumen_commit_canonical_command').length,1);
 assert.equal(state.calls.some(([name])=>name==='lumen_commit_canonical_victory'),false);
});
test('solved state alone cannot acknowledge an operation without its receipt',async()=>{
 const {client,state}=fixture();state.readLost=true;
 await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'}));
 assert.equal(state.receipts.size,1);assert.equal(state.profile.xp,15);
});
test('changed operation evidence is refused even if the quest is already solved',async()=>{
 const {client,state}=fixture();await commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'});
 const original=JSON.stringify(state.profile);
 await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,{...reward,performance:{seconds:19}},{operationId:'run-1'}),e=>e.code==='22023');
 assert.equal(JSON.stringify(state.profile),original);assert.equal(state.receipts.size,1);
});
test('explicitly absent capability retains old-server compatibility; ambiguous probes never downgrade',async()=>{
 const {client,state}=fixture();state.missing=true;
 await commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'});
 assert.equal(state.calls.filter(([name])=>name==='lumen_commit_canonical_victory').length,1);
 for(const error of [{code:'PGRST003',status:504},{code:'PGRST301',status:401},{code:'PGRST202',status:503}]){
  const f=fixture();f.state.versionError={data:null,error,status:error.status};
  await assert.rejects(commitCanonicalVictoryViaLedger(f.client,quest.id,reward,{operationId:'run-1'}));
  assert.equal(f.state.calls.some(([name])=>name.startsWith('lumen_commit')),false);
 }
});
test('after advertised support, a missing command cannot fall back to legacy writes',async()=>{
 const {client,state}=fixture(),rpc=client.rpc;
 client.rpc=async(name,args)=>name==='lumen_commit_canonical_command'?{error:{code:'PGRST202'},status:404}:rpc(name,args);
 await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'}));
 assert.equal(state.calls.some(([name])=>name==='lumen_commit_canonical_victory'),false);
});
test('session change during capability lookup stops before any mutation',async()=>{
 const {client,state}=fixture(),rpc=client.rpc;let valid=true;
 client.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='lumen_canonical_command_version')valid=false;return result};
 await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1',sessionValid:()=>valid}));
 assert.equal(state.calls.some(([name])=>name.startsWith('lumen_commit')),false);
});
test('session change after the write retains evidence rather than accepting another account read',async()=>{
 const {client,state}=fixture(),rpc=client.rpc;let valid=true;
 client.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='lumen_commit_canonical_command')valid=false;return result};
 await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1',sessionValid:()=>valid}));
 assert.equal(state.receipts.size,1);assert.equal(state.calls.some(([name])=>name==='lumen_get_canonical_command'),false);
});
test('V1 entries keep their old ledger transport without inventing a command identity',async()=>{
 const {client,state}=fixture();await commitCanonicalVictoryViaLedger(client,quest.id,reward);
 assert.equal(state.calls.some(([name])=>name==='lumen_canonical_command_version'),false);
 assert.equal(state.receipts.size,0);assert.equal(state.profile.xp,15);
});
test('receipt integrity and requested badge projection remain required on read-back',async()=>{
 for(const mode of ['wrong-id','wrong-quest','wrong-evidence','wrong-version','missing-badge','missing-profile']){
  const {client,state}=fixture(),rpc=client.rpc;
  client.rpc=async(name,args)=>{
   const result=await rpc(name,args);
   if(name==='lumen_get_canonical_command'&&result.data){
    result.data=structuredClone(result.data);
    if(mode==='wrong-id')result.data.operationId='other';
    if(mode==='wrong-quest')result.data.questId='other';
    if(mode==='wrong-evidence')result.data.badges={speed:true};
    if(mode==='wrong-version')result.data.version=2;
   }
   if(name==='lumen_restore_profile'&&mode==='missing-badge')result.data.canonicalQuestState[quest.id].badges={};
   if(name==='lumen_restore_profile'&&mode==='missing-profile')result.data=null;
   return result;
  };
  await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'}),undefined,mode);
  assert.equal(state.receipts.size,1);assert.equal(state.profile.xp,15);
 }
});
test('thrown provider errors cannot enter persisted retry errors or player diagnostics',async()=>{
 for(const stage of ['lumen_canonical_command_version','lumen_get_canonical_command','lumen_restore_profile']){
  const {client,state}=fixture(),rpc=client.rpc;
  client.rpc=async(name,args)=>{if(name===stage)throw Object.assign(Error('private-provider-detail'),{code:'PGRST003'});return rpc(name,args)};
  await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'}),e=>!e.message.includes('private-provider-detail'));
  assert.equal(state.calls.some(([name])=>name==='lumen_commit_canonical_victory'),false);
 }
});
test('a late SDK token switch is refused by the server expected-account assertion',async()=>{
 const {client,state}=fixture(),rpc=client.rpc;
 client.rpc=async(name,args)=>{if(name==='lumen_commit_canonical_command')state.userId='00000000-0000-0000-0000-000000000002';return rpc(name,args)};
 await assert.rejects(commitCanonicalVictoryViaLedger(client,quest.id,reward,{operationId:'run-1'}));
 assert.equal(state.profile.xp,0);assert.equal(state.receipts.size,0);
});
