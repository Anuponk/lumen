import assert from 'node:assert/strict';
import { createCloudPersistence } from '../src/persistence/cloud.js';

function harness({cloud=[],local=[0,1],guest=false,offline=false,entitlements=[]}={}){
  const calls=[];
  const model={lumenUser:guest?null:{id:'cloud-contract-test'},lumenCloudReady:false,lumenNickname:'',
    lumenEntitlements:[],lumenCapabilities:[],lumenProgress:{
      solved:Object.fromEntries(local.map(x=>[x,1])),
      historyBackup:Object.fromEntries(local.map(x=>[x,1])),noHint:{},daily:{dates:{},rewards:{}},badges:{},performances:{}
    },sequentialSolvedCount:local.length,levelIndex:0,usedHintThisGame:false};
  model.lumenSupabase={
    rpc:async(name,args)=>{
      calls.push({name,args});
      if(offline)return {data:null,error:{message:'offline'}};
      if(name==='lumen_get_progress')return {data:cloud.map(x=>({puzzle_id:x+1})),error:null};
      if(name==='lumen_get_entitlements')return {data:entitlements,error:null};
      if(name==='lumen_get_internal_capabilities')return {data:[],error:null};
      return {data:[],error:null};
    }
  };
  const hooks={activeGameSeconds:()=>12,exactSkyScoreForSolvedPrefix:n=>n,
    saveLumenProgress:()=>{},refreshJourney:()=>{},init:()=>{},onAccountChanged:()=>{},renderDaily:()=>{}};
  const api=createCloudPersistence(model,hooks,{console:{warn:()=>{}},setTimeout:f=>f()});
  return {model,calls,api};
}

// Empty/stale cloud must not destroy offline progress; cloud is repaired with idempotent quest IDs.
{
  const h=harness({cloud:[0],local:[0,1,2]});
  await h.api.cloudMergeProgress();
  assert.deepEqual(Object.keys(h.model.lumenProgress.solved),['0','1','2']);
  assert.equal(h.model.sequentialSolvedCount,3);
  assert.deepEqual(h.calls.filter(c=>c.name==='lumen_save_progress'&&c.args.p_duration_seconds===null).map(c=>c.args.p_puzzle_id),[2,3]);
}
// Fresh device: restore cloud progress in the absence of local cache.
{
  const h=harness({cloud:[0,1,2,3],local:[]});
  await h.api.cloudMergeProgress();
  assert.deepEqual(Object.keys(h.model.lumenProgress.solved),['0','1','2','3']);
  assert.equal(h.model.sequentialSolvedCount,4);
}
// An offline error must not erase pre-existing progress or claim successful cloud readiness.
{
  const h=harness({local:[0,1,2],offline:true});
  await h.api.cloudMergeProgress();
  assert.deepEqual(Object.keys(h.model.lumenProgress.solved),['0','1','2']);
  assert.equal(h.model.lumenCloudReady,false);
}
// Paid and manually granted entitlements must be read from the server on each signed-in device.
{
  const rights=[{entitlement:'adventure-2',source:'purchase',expires_at:null},{entitlement:'skill-hint',source:'purchase',expires_at:null}];
  for(let device=0;device<2;device++){
    const h=harness({local:[],entitlements:rights});
    await h.api.loadEntitlements();
    assert.deepEqual(h.model.lumenEntitlements,rights);
    assert.equal(h.calls.filter(c=>c.name==='lumen_get_entitlements').length,1);
  }
}
// Guest user must not be able to read cloud entitlements or overwrite cloud progress.
{
  const h=harness({guest:true});
  await h.api.loadEntitlements();
  await h.api.cloudMergeProgress();
  assert.equal(h.calls.length,0);
  assert.deepEqual(h.model.lumenEntitlements,[]);
}
console.log('Cloud persistence regression: existing client contracts passed (5 scenarios).');
