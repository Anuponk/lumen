import assert from 'node:assert/strict';
import test from 'node:test';
import {inventoryHistoricalProfiles,bytesDigest} from '../src/persistence/historical-inventory.js';
import {captureGuestClaim,claimGuestProfile,GUEST_CLAIM_PREFIX} from '../src/persistence/guest-claim.js';
import {initializeCloudProfile,cloudSafelyCoversLocal} from '../src/persistence/cloud-profile.js';
import {evaluatePersistenceRollout,RECETTE_SCENARIOS} from '../src/persistence/rollout-gates.js';
const guest={solved:{0:1},badges:{},shards:2,xp:10,unknown:{retained:'étoile'}};
const raw=JSON.stringify(guest);
function storage(){const data=new Map([['lumenProgressV1',raw]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}}
test('inventory keeps original bytes, provenance, unknown fields and distinguishes contradictions',async()=>{
 const sources=[{id:'same',owner:'a',raw},{id:'foreign',owner:'b',raw},{id:'broken',owner:null,raw:'{broken'},
  {id:'money',owner:'a',raw:JSON.stringify({...guest,shards:99})},{id:'unknown',owner:'a',raw:JSON.stringify({...guest,unknown:{other:1}})}];
 const before=JSON.stringify(sources),report=await inventoryHistoricalProfiles({userId:'a',sources,remoteRaw:raw,remoteOwner:'a'});
 assert.deepEqual(report.sources.map(s=>s.status),['identical','contradictory','incomplete','contradictory','contradictory']);
 assert.equal(JSON.stringify(sources),before);assert.equal(report.mutations,0);
 for(let i=0;i<sources.length;i++){assert.equal(report.sources[i].raw,sources[i].raw);assert.equal(report.sources[i].digest,await bytesDigest(sources[i].raw))}
 assert.deepEqual(report.sources[0].unknownFields,['unknown']);
 await assert.rejects(inventoryHistoricalProfiles({userId:'a',sources,remoteRaw:raw,remoteOwner:'b'}));
});
test('coverage is never represented as a receipt or an automatic baseline',async()=>{
 const report=await inventoryHistoricalProfiles({userId:'a',sources:[{id:'old',owner:'a',raw}],remoteRaw:JSON.stringify({...guest,solved:{0:1,1:1}}),remoteOwner:'a'});
 assert.equal(report.sources[0].status,'covered_projection');assert.ok(report.sources[0].reasons.includes('independent_receipt_review_required'));
});
test('claim captures before await, reuses identity and never replaces original evidence',async()=>{
 const s=storage(),profile=structuredClone(guest),pending=captureGuestClaim(s,{userId:'a',profile,original:raw});profile.xp=999;
 const first=await pending,again=await captureGuestClaim(s,{userId:'a',profile:guest,original:raw});
 assert.deepEqual(again,first);assert.equal(JSON.parse(first.seedRaw).xp,10);assert.equal(s.getItem('lumenProgressV1'),raw);
 assert.ok([...s.data.keys()].some(k=>k.startsWith(GUEST_CLAIM_PREFIX)));
 await assert.rejects(captureGuestClaim(s,{userId:'b',profile:guest,original:raw}),'An unowned source already bound to A cannot initialize B');
 await assert.rejects(captureGuestClaim(s,{userId:'a',profile:{...guest,xp:999},original:raw}));
 assert.equal(s.getItem('lumenProgressV1'),raw);
});
test('owned, changed, unavailable and silently refused stores cannot claim guest durability',async()=>{
 for(const kind of ['owned','changed','silent','quota','session']){
  const s=storage();let valid=true;
  if(kind==='owned')s.data.set('lumenCloudOwnerId','b');
  if(kind==='changed')s.data.set('lumenProgressV1','{}');
  if(kind==='silent')s.setItem=()=>{};
  if(kind==='quota')s.setItem=()=>{throw Error('Quota')};
  if(kind==='session')valid=false;
  await assert.rejects(captureGuestClaim(s,{userId:'a',profile:guest,original:raw,sessionValid:()=>valid}));
 }
});
test('lost claim response retries the same manifest with independent receipt and current projection',async()=>{
 const s=storage(),m=await captureGuestClaim(s,{userId:'a',profile:guest,original:raw});let lost=true,effects=0,saved;
 const receipt={version:1,userId:'a',claimId:m.claimId,sourceDigest:m.sourceDigest,seedDigest:m.seedDigest,policy:m.policy,status:'initialized'};
 let readLost=true;
 const client={rpc:async(name,args)=>{
  if(name==='lumen_claim_guest_profile'){
   if(saved)assert.deepEqual(args.p_manifest,saved);else{saved=structuredClone(args.p_manifest);effects++}
   if(lost){lost=false;throw Error('Response lost')}return {data:receipt};
  }
  assert.equal(name,'lumen_get_guest_claim');if(readLost){readLost=false;throw Error('Read also unavailable')}return {data:receipt};
 }};
 const options={loadProfile:async()=>guest,covers:cloudSafelyCoversLocal};
 await assert.rejects(claimGuestProfile(client,m,options));
 const result=await claimGuestProfile(client,m,options);assert.equal(effects,1);assert.deepEqual(result.profile,guest);
});
test('receipt, projection and session must independently verify before installation',async()=>{
 const m=await captureGuestClaim(storage(),{userId:'a',profile:guest,original:raw});
 const base={version:1,userId:'a',claimId:m.claimId,sourceDigest:m.sourceDigest,seedDigest:m.seedDigest,policy:m.policy,status:'initialized'};
 for(const field of ['version','userId','claimId','sourceDigest','seedDigest','policy','status']){
  const client={rpc:async()=>({data:{...base,[field]:'wrong'}})};
  await assert.rejects(claimGuestProfile(client,m,{loadProfile:async()=>guest,covers:cloudSafelyCoversLocal}));
 }
 await assert.rejects(claimGuestProfile({rpc:async()=>({data:base})},m,{loadProfile:async()=>({...guest,shards:0}),covers:cloudSafelyCoversLocal}));
 let valid=true;
 await assert.rejects(claimGuestProfile({rpc:async()=>{valid=false;throw Error('Late rejection')}},m,{loadProfile:async()=>guest,covers:cloudSafelyCoversLocal,sessionValid:()=>valid}));
});
test('old server fallback requires exact missing-capability evidence before any claim emission',async()=>{
 for(const code of ['PGRST202','42501','503','unknown']){
  const s=storage(),calls=[];const client={rpc:async name=>{calls.push(name);if(name==='lumen_guest_claim_version')return {error:{code},status:code==='PGRST202'?404:503};return {data:guest}}};
  const work=initializeCloudProfile(client,guest,{userId:'a',guestSource:{storage:s,original:raw}});
  if(code==='PGRST202'){assert.deepEqual(await work,guest);assert.deepEqual(calls,['lumen_guest_claim_version','lumen_initialize_profile','lumen_restore_profile'])}
  else{await assert.rejects(work);assert.deepEqual(calls,['lumen_guest_claim_version'])}
 }
 const s=storage(),calls=[];const client={rpc:async name=>{calls.push(name);return name==='lumen_guest_claim_version'?{data:1}:{error:{code:'503'}}}};
 await assert.rejects(initializeCloudProfile(client,guest,{userId:'a',guestSource:{storage:s,original:raw}}));
 assert.deepEqual(calls,['lumen_guest_claim_version','lumen_claim_guest_profile','lumen_get_guest_claim']);
});
function evidence(){const revision='a'.repeat(40);return {app:'Lumen',format:'persistence-release-evidence-v1',revision,environment:'isolated',projectRef:'qa',productionProjectRef:'production',protocol:1,serverRevision:revision,clientRevision:revision,ci:{revision,success:true},scenarios:Object.fromEntries(RECETTE_SCENARIOS.map(s=>[s,{revision,passed:true,transport:'real',reference:'private-evidence:'+s}])),physicalAndroid:{revision,passed:true,devices:['A','B']},shadow:{revision,secondEmissions:0,parity:true},losses:0,doubleRewards:0,unreviewedBaselines:0,observation:{revision,startedAt:'2026-10-01',endedAt:'2026-10-15',broadCohort:true},legacyWriters:0,migrationParity:true,originalsRestorable:true,mirrorServerDerived:true}}
test('rollout refuses absent, mocked, stale and shared-production proofs',()=>{
 assert.equal(evaluatePersistenceRollout(null).activate,false);
 for(const mutate of [e=>e.environment='production',e=>e.projectRef=e.productionProjectRef,e=>e.clientRevision='b'.repeat(40),e=>e.physicalAndroid.devices=['A','A'],e=>e.scenarios.device_a_b.transport='mock',e=>delete e.scenarios.response_lost,e=>e.shadow.secondEmissions=1,e=>e.losses=1,e=>e.ci.revision='b'.repeat(40)]){
  const e=evidence();mutate(e);assert.equal(evaluatePersistenceRollout(e).activate,false);
 }
});
test('retirement requires actual observation interval, parity and restorable originals',()=>{
 assert.equal(evaluatePersistenceRollout(evidence()).retire,true);
 for(const mutate of [e=>e.observation.startedAt='2026-10-14',e=>e.observation.endedAt='2099-01-01',e=>e.legacyWriters=1,e=>e.originalsRestorable=false,e=>e.mirrorServerDerived=false,e=>e.migrationParity=false]){
  const e=evidence();mutate(e);const result=evaluatePersistenceRollout(e);assert.equal(result.activate,true);assert.equal(result.retire,false);
 }
});
