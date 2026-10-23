import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as profiles from '../src/persistence/cloud-profile.js';
import {reconcileDailyIntoCloudProfile} from '../src/persistence/daily-hydration.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';

// Execute the production hydration hook. All profiles/transports are synthetic;
// the delayed mirror represents the final asynchronous hydration boundary.
function fixture({change=null,mirrorOk=true,mirrorReject=false}={}){
 const profile={solved:{},historyBackup:{},badges:{},stars:{},performances:{},canonicalQuestState:{},
  daily:{},challenges:{},walletRevision:1,shards:9,xp:15,skyScore:0};
 const values=new Map([['lumenProgressV1',JSON.stringify(profile)],['lumenCloudOwnerId','a']]);
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const client={rpc:async name=>{
  if(name==='lumen_restore_profile')return {data:structuredClone(profile),error:null};
  if(['lumen_get_daily','lumen_get_engagement'].includes(name))return {data:[],error:null};
  assert.fail('Unexpected RPC '+name);
 }};
 const events=[],calls=[],noop=()=>{},otherProfile={...profile,xp:16},otherFailure={reason:'new_session_pending'};
 let ctx;
 const switchSession=()=>{
  if(!change)return;
  if(change==='account'){ctx.lumenUser={id:'b'};storage.setItem('lumenCloudOwnerId','b');}
  else ctx.lumenSupabase={rpc:()=>assert.fail('New client must not receive old work')};
  storage.setItem('lumenProgressV1',JSON.stringify(otherProfile));
  ctx.cloudProfileReady=false;ctx.cloudProfileBaseline=null;ctx.cloudProfileFailure=otherFailure;
 };
 ctx=vm.createContext({cloudHydrationGeneration:0,...profiles,structuredClone,currentCatalogueOrigin,reconcileDailyIntoCloudProfile,
  qaActive:false,lumenUser:{id:'a'},lumenSupabase:client,localStorage:storage,sessionStorage:{getItem:()=>null},
  lumenProgress:profile,cloudProfileReady:false,cloudProfileBaseline:null,cloudProfileFailure:null,
  canonicalRecoveryContext:null,canonicalRecovery:{cancel:noop,schedule:noop},
  walletOutbox:{pending:async()=>[]},canonicalVictoryOutbox:{resume:async()=>{},pending:async()=>[]},
  legacyVictoryOutbox:{resume:async()=>{}},replayCanonicalVictoryOutbox:async()=>[],replayLegacyVictoryOutbox:async()=>[],
  attemptEngine:{snapshot:()=>null},canonicalAttemptToResume:()=>null,canonicalQuestList:()=>[],currentQuestPosition:()=>0,
  canonicalResumeOwner:null,refreshCanonicalOutboxNotice:async()=>{},
  recordCloudDiagnostic:(event,details)=>events.push({event,...details}),
  resumeCanonicalCampaignBoundary:noop,preserveUnsyncedCloudProgress:()=>calls.push('preserve'),
  verifyLegacyProgressMirror:async()=>{switchSession();if(mirrorReject)throw Error('Synthetic mirror rejection');return mirrorOk?{ok:true,count:0}:{ok:false,reason:'synthetic_failure',pending:1};},
  updateShardMeter:()=>{},renderDaily:()=>calls.push('render'),refreshJourney:()=>calls.push('journey'),updateAuthUI:()=>calls.push('auth'),
  resumeCanonicalVictoryAfterHydration:()=>calls.push('victory'),maybeShowStreakLoss:()=>calls.push('streak'),
  document:{getElementById:()=>null},location:{reload:()=>assert.fail('Identical profile needs no reload')},
  console:{warn:(_message,error)=>{throw error}}
 });
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const start=source.indexOf('afterAuthCloudSync:async()=>{')+'afterAuthCloudSync:async()=>{'.length;
 const end=source.indexOf('},holdLegacyMergeForFullRestore',start);
 assert(end>start,'Production hydration hook exists');
 const hook=vm.runInContext('(async function(){'+source.slice(start,end)+'})',ctx);
 return {ctx,events,calls,storage,otherProfile,otherFailure,hook};
}

for(const change of ['account','client'])for(const mirrorOk of [true,false]){
 test(`late ${mirrorOk?'successful':'failed'} mirror cannot publish after ${change} switch`,async()=>{
  const f=fixture({change,mirrorOk});await f.hook();
  assert.equal(f.ctx.cloudProfileReady,false,'New session remains pending');
  assert.equal(f.ctx.cloudProfileBaseline,null,'Old hydration cannot install a new-session baseline');
  assert.equal(f.ctx.cloudProfileFailure,f.otherFailure,'Old mirror cannot replace the new-session failure');
  assert.equal(f.storage.getItem('lumenProgressV1'),JSON.stringify(f.otherProfile));
  assert(!f.events.some(event=>['hydration_ready','legacy_mirror_verified','legacy_mirror_failed'].includes(event.event)),
   'Old mirror result must not be reported as current-session verification');
  assert.deepEqual(f.calls,[],'Old mirror must not update new-session presentation or preserve its cache as failed');
 });
}

for(const change of ['account','client']){
 test(`rejected mirror cannot publish failure after ${change} switch`,async()=>{
  const f=fixture({change,mirrorReject:true});f.ctx.console.warn=()=>{};await f.hook();
  assert.equal(f.ctx.cloudProfileReady,false);assert.equal(f.ctx.cloudProfileBaseline,null);
  assert.equal(f.ctx.cloudProfileFailure,f.otherFailure,'Rejected old mirror cannot overwrite replacement-session status');
  assert.equal(f.storage.getItem('lumenProgressV1'),JSON.stringify(f.otherProfile));
  assert(!f.events.some(event=>['hydration_failed','hydration_ready','legacy_mirror_verified','legacy_mirror_failed'].includes(event.event)));
  assert.deepEqual(f.calls,[],'Rejected old mirror must not update replacement-session presentation');
 });
}

test('same-session rejected mirror remains an explicit failure',async()=>{
 const f=fixture({mirrorReject:true});f.ctx.console.warn=()=>{};await f.hook();
 assert.equal(f.ctx.cloudProfileFailure.reason,'restore_failed');
 assert(f.events.some(event=>event.event==='hydration_failed'&&event.stage==='mirror_readback'));
 assert(!f.events.some(event=>event.event==='hydration_ready'));
 assert.deepEqual(f.calls,['auth']);
});

test('same-session mirror verification still completes normal hydration',async()=>{
 const f=fixture();await f.hook();
 assert.equal(f.ctx.cloudProfileReady,true);assert.equal(f.ctx.cloudProfileFailure,null);
 assert(f.events.some(event=>event.event==='hydration_ready'&&event.legacyMirrorVerified===true));
 assert.deepEqual(f.calls,['render','journey','auth','victory','streak']);
});
