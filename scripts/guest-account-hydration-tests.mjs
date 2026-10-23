import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import * as profiles from '../src/persistence/cloud-profile.js';
import * as guestAccount from '../src/persistence/guest-account.js';
import {reconcileDailyIntoCloudProfile} from '../src/persistence/daily-hydration.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
const source=process.argv.includes('--baseline')?execFileSync('../.tools/mingit/cmd/git.exe',['show','HEAD:src/ui/game-screen.js'],{encoding:'utf8'}):readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const start=source.indexOf('afterAuthCloudSync:async()=>{')+'afterAuthCloudSync:async()=>{'.length,end=source.indexOf('},holdLegacyMergeForFullRestore',start);
const guest={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{first:1},stars:{},performances:{0:{version:3,badges:{speed:true},bestTime:45}},noHint:{0:1},daily:{dates:{},rewards:{}},challenges:{},shards:2,xp:30,skyScore:2,skyHistoryVersion:4,catalogueOrigin:currentCatalogueOrigin};
function fixture({cloud=null,owner=null,offline=false,failVerification=false,switchDuringRead=false,advanceDuringHydration=false,modernClaim=false}={}){
 const data=new Map([['lumenProgressV1',JSON.stringify(guest)]]);
 if(owner)data.set('lumenCloudOwnerId',owner);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size}};
 let remote=structuredClone(cloud),initialized=0,reads=0,reloads=0,claimReceipt=null;
 const calls=[],events=[],noop=()=>{};
 const client={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_guest_claim_version')return modernClaim?{data:1}:{error:{code:'PGRST202'},status:404};
  if(offline)return {error:{code:'503'}};
  if(name==='lumen_claim_guest_profile'){
   assert.equal(args.p_expected_user_id,'a');assert.equal(args.p_manifest.userId,'a');
   assert.equal(args.p_manifest.sourceRaw,JSON.stringify(guest));
   if(!claimReceipt){initialized++;remote=JSON.parse(args.p_manifest.seedRaw);claimReceipt={version:1,userId:'a',claimId:args.p_manifest.claimId,sourceDigest:args.p_manifest.sourceDigest,seedDigest:args.p_manifest.seedDigest,policy:args.p_manifest.policy,status:'initialized'}}
   return {data:structuredClone(claimReceipt)};
  }
  if(name==='lumen_get_guest_claim')return {data:structuredClone(claimReceipt)};
  if(name==='lumen_restore_profile'){
   reads++;if(switchDuringRead)ctx.lumenUser={id:'b'};
   if(failVerification&&initialized)return {error:{code:'503'}};
   return {data:structuredClone(remote)};
  }
  if(name==='lumen_initialize_profile'){initialized++;remote??=structuredClone(args.p_payload);return {data:structuredClone(remote)}}
  if(name==='lumen_cas_profile'){assert.deepEqual(args.p_expected,remote);remote=structuredClone(args.p_payload);return {data:true}}
  if(name==='lumen_get_daily'||name==='lumen_get_engagement'){
   if(advanceDuringHydration){const next=structuredClone(guest);next.solved[2]=1;next.historyBackup[2]=1;next.xp=45;storage.setItem('lumenProgressV1',JSON.stringify(next));}
   return {data:[]};
  }
  throw Error('Unexpected RPC '+name);
 }};
 const ctx=vm.createContext({cloudHydrationGeneration:0,...profiles,...guestAccount,structuredClone,currentCatalogueOrigin,
  qaActive:false,lumenUser:{id:'a'},lumenSupabase:client,lumenProgress:structuredClone(guest),localStorage:storage,
  sessionStorage:{getItem:()=>null},canonicalRecoveryContext:null,canonicalRecovery:{cancel:noop,schedule:noop},
  cloudProfileReady:false,cloudProfileBaseline:null,cloudProfileFailure:null,canonicalResumeOwner:null,
  walletCommandsSupported:async()=>false,canonicalVictoryOutbox:{resume:async()=>{},pending:async()=>[]},
  walletOutbox:{pending:async()=>[]},
  legacyVictoryOutbox:{resume:async()=>{}},replayCanonicalVictoryOutbox:async()=>[],replayLegacyVictoryOutbox:async()=>[],
  commitCanonicalVictory:noop,commitLegacyVictoryCommand:noop,refreshCanonicalOutboxNotice:async()=>{},
  attemptEngine:{snapshot:()=>null},canonicalAttemptToResume:()=>null,canonicalQuestList:()=>[],
  reconcileDailyIntoCloudProfile,recordCloudDiagnostic:(event,details)=>events.push({event,details}),
  updateShardMeter:()=>{},renderDaily:noop,updateAuthUI:noop,refreshJourney:noop,resumeCanonicalCampaignBoundary:noop,
  resumeCanonicalVictoryAfterHydration:noop,maybeShowStreakLoss:noop,verifyLegacyProgressMirror:async()=>({ok:true,count:2}),
  document:{getElementById:()=>null},location:{reload:()=>reloads++},console:{warn:noop}
 });
 return {ctx,storage,data,calls,events,hook:vm.runInContext('(async()=>{'+source.slice(start,end)+'})',ctx),get remote(){return remote},get initialized(){return initialized},get reloads(){return reloads}};
}
{
 const f=fixture();await f.hook();
 assert.deepEqual(f.remote,guest,'Registration persists the complete guest, including its net balance');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),guest);
 const device2=new Map(),storage2={getItem:k=>device2.get(k)??null,setItem:(k,v)=>device2.set(k,v)};
 profiles.installCloudProfileLocally(storage2,f.remote);
 assert.deepEqual(JSON.parse(device2.get('lumenProgressV1')),guest,'Second device restores all earned fields');
 await f.hook();assert.equal(f.initialized,1,'Repeated auth does not replay rewards');
}
for(const options of [{offline:true},{failVerification:true},{switchDuringRead:true}]){
 const f=fixture(options),before=f.storage.getItem('lumenProgressV1');await f.hook();
 assert.equal(f.storage.getItem('lumenProgressV1'),before);
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);
 assert.equal(f.ctx.cloudProfileReady,false);
}
{
 const f=fixture({cloud:guest});await f.hook();assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),guest);
}
{
 const f=fixture({cloud:{solved:{},badges:{},shards:3,xp:0}}),raw=f.storage.getItem('lumenProgressV1');await f.hook();
 assert.equal(f.storage.getItem('lumenProgressV1'),raw,'Ambiguous preexisting account cannot erase or borrow a guest balance');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);
}
console.log('Actual hydration: guest registration, second device, retry, offline, interrupted readback, account switch and existing cloud passed');
{
 const f=fixture({modernClaim:true});await f.hook();
 assert.equal(f.reloads,1,'First owner installation follows the existing verified reload boundary');
 assert.deepEqual(f.remote,guest);assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert.ok(f.calls.includes('lumen_get_guest_claim'));assert.ok(!f.calls.includes('lumen_initialize_profile'));
 assert.equal([...f.data.keys()].filter(key=>key.startsWith('lumenGuestClaimV1:')).length,1);
 await f.hook();assert.equal(f.initialized,1,'Repeated auth cannot create a second guest grant');
 assert.equal(f.ctx.cloudProfileReady,true,'The next verified hydration reaches ready without a second claim');
 const denied=fixture({modernClaim:true,failVerification:true}),before=denied.storage.getItem('lumenProgressV1');await denied.hook();
 assert.equal(denied.storage.getItem('lumenProgressV1'),before);assert.equal(denied.storage.getItem('lumenCloudOwnerId'),null);assert.equal(denied.ctx.cloudProfileReady,false);
 console.log('Actual hydration: modern guest receipt, repeated auth, exact net balance and failed readback conservation passed');
}
{
 const f=fixture({advanceDuringHydration:true});await f.hook();
 assert.equal(JSON.parse(f.storage.getItem('lumenProgressV1')).solved[2],1,'An achievement earned during hydration is not replaced by the earlier guest capture');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null,'A later guest achievement remains pending until covered by the server');
}
