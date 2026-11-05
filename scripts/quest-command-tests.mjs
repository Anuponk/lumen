import test from 'node:test';
import assert from 'node:assert/strict';
import {commitQuestCommand,loadCommittedQuestAttempt} from '../src/persistence/quest-command.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {cloudSafelyCoversLocal,reconcileCompatibleCloudProfiles} from '../src/persistence/cloud-profile.js';
const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-22',qualifiedAt:'2026-10-22T10:00:00.000Z'};

test('verified newer V2 replay restores across devices while preserving first-win and unknown evidence',async()=>{
 const local={xp:42,shards:7,skyScore:0,daily:{},solved:{},historyBackup:{},noHint:{},stars:{},challenges:{},performances:{},badges:{},legacyVictoryRevision:1,canonicalQuestState:{[quest.id]:{solved:true,stars:1,badges:{autonomy:true},performance:{seconds:80},future:{keep:true}}}};
 const remote=structuredClone(local);applyQuestVictory(remote,quest,{...facts,seconds:80});remote.legacyVictoryRevision=2;
 assert.equal(cloudSafelyCoversLocal(local,remote),true,'An old V1 cache may adopt a verified V2 summary');
 const old=structuredClone(remote);applyQuestVictory(remote,quest,{...facts,seconds:20,qualifiedAt:'2026-10-22T10:16:00.000Z'});remote.legacyVictoryRevision=3;
 assert.equal(cloudSafelyCoversLocal(old,remote),true,'Newer replay metadata may cover an older acknowledged run');
 const v1=JSON.parse(JSON.stringify(old));v1.canonicalQuestState[quest.id].badges.mastery=true;
 assert.equal(cloudSafelyCoversLocal(old,v1),true,'A recovered V1 badge may extend top-level awards without rewriting the V2 summary');
 assert.equal(cloudSafelyCoversLocal(remote,old),false,'Older server data never erases a newer local run');
 for(const field of ['performance','future']){const changed=structuredClone(remote);changed.canonicalQuestState[quest.id][field]={changed:true};assert.equal(cloudSafelyCoversLocal(local,changed),false,'Immutable/unknown evidence cannot be replaced');}
 const storage={getItem:()=>JSON.stringify(old)};
 const result=await reconcileCompatibleCloudProfiles({rpc(){throw Error('Dominant server restore must not write')}},storage,remote,{userId:'owner'});
 assert.equal(result.status,'cloud_dominant');assert.deepEqual(result.profile,remote);
});
function fixture(){
 let profile={xp:42,shards:7,autonomousWins:2,solved:{},badges:{},canonicalQuestState:{}},receipt=null,writes=0;
 const calls=[];
 const client={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_commit_quest_command'){
   if(!receipt){const outcome=applyQuestVictory(profile,quest,args.p_facts);writes++;
    receipt={request:{version:2,operationId:args.p_operation_id,questId:args.p_quest_id,facts:structuredClone(args.p_facts)},outcome,recordedAt:'2026-10-22T10:01:00Z'};
   }
   throw Error('Lost response after commit');
  }
  if(name==='lumen_get_quest_command')return {data:structuredClone(receipt)};
  if(name==='lumen_restore_profile')return {data:structuredClone(profile)};
  throw Error('Unexpected RPC '+name);
 }};
 return {client,calls,get profile(){return profile},set profile(v){profile=v},get receipt(){return receipt},set receipt(v){receipt=v},get writes(){return writes}};
}
test('lost write response uses exact independent receipt and current profile without a second reward',async()=>{
 const f=fixture(),reward={facts},options={userId:'owner'};
 const a=await commitQuestCommand(f.client,quest,reward,'run-reset-0',options);
 assert(a.newlyCompleted&&a.outcome.dailyQualified);assert.equal(a.profile.xp,57);assert.equal(a.profile.shards,8);
 f.profile.shards=2; // A newer, authoritative spend must survive receipt retry.
 const b=await commitQuestCommand(f.client,quest,reward,'run-reset-0',options);
 assert.equal(f.writes,1);assert.equal(b.profile.shards,2);
 assert.deepEqual(f.calls.slice(-3),['lumen_commit_quest_command','lumen_get_quest_command','lumen_restore_profile']);
 const recovered=await loadCommittedQuestAttempt(f.client,quest,'run-reset-0',options);
 assert.equal(recovered.newlyCompleted,false);assert.deepEqual(recovered.reward.facts,facts);assert.equal(recovered.profile.shards,2);
});
test('unconfirmed receipt, altered facts, solved-only projection and account change all retain the intention',async()=>{
 for(const mode of ['missing','altered','solved-only','account']){
  const f=fixture(),rpc=f.client.rpc;let valid=true;
  f.client.rpc=async(name,args)=>{
   const result=await rpc(name,args).catch(e=>{if(mode==='account')valid=false;throw e});
   if(name==='lumen_get_quest_command'){
    if(mode==='missing')return {data:null};
    if(mode==='altered')result.data.request.facts.seconds++;
   }
   if(name==='lumen_restore_profile'&&mode==='solved-only')result.data.canonicalQuestState[quest.id]={solved:true};
   return result;
  };
  await assert.rejects(commitQuestCommand(f.client,quest,{facts},'run-reset-0',{userId:'owner',sessionValid:()=>valid}));
  assert.equal(f.writes,1);
 }
});
test('missing read-only endpoint permits V1 recovery; ambiguous failure does not downgrade',async()=>{
 const options={userId:'owner'};
 assert.equal(await loadCommittedQuestAttempt({rpc:async()=>({data:null,error:{code:'PGRST202'},status:404})},quest,'old-run',options),null);
 await assert.rejects(loadCommittedQuestAttempt({rpc:async()=>{throw Error('offline')}},quest,'old-run',options));
 await assert.rejects(loadCommittedQuestAttempt({rpc:async()=>({data:[]})},quest,'old-run',options),'An unverified successful shape cannot downgrade');
});
